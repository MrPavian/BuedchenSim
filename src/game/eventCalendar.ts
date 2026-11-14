import { dateOfDay, dayOfDate } from './date';
import type { Weekday } from './selectors';
import { weatherOfDay, type Climate } from './weather';

/**
 * Neighbourhood events (Auftrag 05, 5.3): data-driven, with a status derived from the day and the time. Nothing about
 * an event is saved: its occurrences are a pure function of the calendar (and, for the heat wave, of the deterministic
 * weather), so an event can never start twice and its effects end exactly when it ends.
 */

export type EventSchedule =
  /** Every `everyWeeks` weeks on a weekday, counted from `first` (a date on that weekday). */
  | { kind: 'everyNthWeek'; weekday: Weekday; everyWeeks: number; first: { year: number; month: number; dayOfMonth: number } }
  /** The n-th weekday of the listed months (e.g. the first Sunday, April to October). */
  | { kind: 'monthlyNthWeekday'; weekday: Weekday; nth: number; months: number[]; durationDays?: number }
  /** The n-th weekday of one month every year (e.g. the second Saturday of August, two days). */
  | { kind: 'yearlyNthWeekday'; month: number; weekday: Weekday; nth: number; durationDays?: number }
  /** A date range every year (inclusive), e.g. 1-24 December. */
  | { kind: 'dateRange'; from: { month: number; dayOfMonth: number }; to: { month: number; dayOfMonth: number } }
  /** Weather-driven: at least `minDays` days in a row with a high of at least `minHigh` °C. */
  | { kind: 'heatwave'; minHigh: number; minDays: number };

export type EventStatus = 'planned' | 'announced' | 'active' | 'completed';

export interface EventDef {
  /** Prefix 'event.'. */
  id: string;
  name: string;
  description: string;
  schedule: EventSchedule;
  /** Active hours on event days (minutes since midnight, `to` exclusive); absent = the whole opening day. */
  hours?: { from: number; to: number };
  /** Shown as announced this many days ahead (the heat wave only within the exact forecast). */
  announceDays: number;
  /** Product groups the event affects (for the player: "mehr Nachfrage nach …"). */
  productGroups: string[];
  /** Demand bonus while active, keyed 'tag:<demandTag>', 'category:<category>' or a product id (see demand.ts). */
  demand: Readonly<Record<string, number>>;
  /** Extra percentage points on the chances of residents' routines while active (more visitors). */
  visitorBonus: number;
  /** Decoration the world shows while the event is on (today), e.g. 'decor.football'. */
  decoration?: string;
  /** Memory residents get when they visit the kiosk while the event is active. */
  memory?: string;
}

export interface EventOccurrence {
  eventId: string;
  startDay: number;
  /** Inclusive. */
  endDay: number;
}

const SCAN_LIMIT = 40;

function nthWeekdayOfMonth(year: number, month: number, weekday: Weekday, nth: number): number {
  const first = dateOfDay(dayOfDate({ year, month, dayOfMonth: 1 }));
  const offset = (weekday - first.weekday + 7) % 7;
  return dayOfDate({ year, month, dayOfMonth: 1 + offset + (nth - 1) * 7 });
}

/** True when `day` belongs to an occurrence (heat waves need the seed and climate). */
export function isEventDay(def: EventDef, day: number, seed: number, climate: Climate): boolean {
  const s = def.schedule;
  const d = dateOfDay(day);
  switch (s.kind) {
    case 'everyNthWeek': {
      if (d.weekday !== s.weekday) return false;
      const diff = day - dayOfDate(s.first);
      return diff >= 0 && (diff / 7) % s.everyWeeks === 0;
    }
    case 'monthlyNthWeekday': {
      const len = Math.max(1, s.durationDays ?? 1);
      for (let back = 0; back < len; back += 1) {
        const di = dateOfDay(day - back);
        if (!s.months.includes(di.month)) continue;
        if (nthWeekdayOfMonth(di.year, di.month, s.weekday, s.nth) === day - back) return true;
      }
      return false;
    }
    case 'yearlyNthWeekday': {
      const len = Math.max(1, s.durationDays ?? 1);
      for (let back = 0; back < len; back += 1) {
        const di = dateOfDay(day - back);
        if (di.month === s.month && nthWeekdayOfMonth(di.year, s.month, s.weekday, s.nth) === day - back) return true;
      }
      return false;
    }
    case 'dateRange': {
      const key = d.month * 100 + d.dayOfMonth;
      const from = s.from.month * 100 + s.from.dayOfMonth;
      const to = s.to.month * 100 + s.to.dayOfMonth;
      return from <= to ? key >= from && key <= to : key >= from || key <= to;
    }
    case 'heatwave': {
      if (day < 1) return false;
      const hot = (x: number): boolean => x >= 1 && weatherOfDay(seed, climate, x).high >= s.minHigh;
      if (!hot(day)) return false;
      let start = day;
      while (start - 1 >= 1 && hot(start - 1) && day - start < SCAN_LIMIT) start -= 1;
      let end = day;
      while (hot(end + 1) && end - day < SCAN_LIMIT) end += 1;
      return end - start + 1 >= s.minDays;
    }
  }
}

/** The occurrence that contains `day`, or null. */
export function occurrenceOn(def: EventDef, day: number, seed: number, climate: Climate): EventOccurrence | null {
  if (!isEventDay(def, day, seed, climate)) return null;
  let start = day;
  while (start - day > -SCAN_LIMIT && isEventDay(def, start - 1, seed, climate)) start -= 1;
  let end = day;
  while (end - day < SCAN_LIMIT && isEventDay(def, end + 1, seed, climate)) end += 1;
  return { eventId: def.id, startDay: start, endDay: end };
}

/** Status of an event on a day it takes place, at a minute. */
function statusWithin(def: EventDef, occ: EventOccurrence, day: number, minute: number): EventStatus {
  const hours = def.hours;
  if (!hours) return 'active';
  if (day === occ.startDay && minute < hours.from) return 'announced';
  if (day === occ.endDay && minute >= hours.to) return 'completed';
  return minute >= hours.from && minute < hours.to ? 'active' : day < occ.endDay ? 'active' : 'completed';
}

/** Events taking place on `day` with their status at `minute` (no look-ahead; cheap). */
export function eventsTodayAt(defs: readonly EventDef[], day: number, minute: number, seed: number, climate: Climate): EventState[] {
  const out: EventState[] = [];
  for (const def of defs) {
    const occ = occurrenceOn(def, day, seed, climate);
    if (occ) out.push({ def, status: statusWithin(def, occ, day, minute), occurrence: occ });
  }
  return out;
}

export interface EventState {
  def: EventDef;
  status: EventStatus;
  occurrence: EventOccurrence;
}

/**
 * The status of every event seen from (today, minute): events taking place today with their status; upcoming ones
 * within their announce period as 'announced'; events that ended yesterday as 'completed'; later ones within 60 days
 * as 'planned'. Events without an occurrence in that range are omitted.
 */
export function eventStates(defs: readonly EventDef[], today: number, minute: number, seed: number, climate: Climate): EventState[] {
  const out: EventState[] = [];
  for (const def of defs) {
    const occ = occurrenceOn(def, today, seed, climate);
    if (occ) {
      out.push({ def, status: statusWithin(def, occ, today, minute), occurrence: occ });
      continue;
    }
    const horizon = def.schedule.kind === 'heatwave' ? def.announceDays : 60;
    let found: EventOccurrence | null = null;
    for (let d = today + 1; d <= today + horizon; d += 1) {
      found = occurrenceOn(def, d, seed, climate);
      if (found) break;
    }
    // An announced next occurrence wins; otherwise one that ended yesterday shows as completed, then planned ones.
    if (found && found.startDay - today <= def.announceDays) {
      out.push({ def, status: 'announced', occurrence: found });
      continue;
    }
    const recent = occurrenceOn(def, today - 1, seed, climate);
    if (recent) out.push({ def, status: 'completed', occurrence: recent });
    else if (found) out.push({ def, status: 'planned', occurrence: found });
  }
  return out;
}

/** Events that take place on `day` (for the calendar), as seen from `today` (a heat wave only within its announce window). */
export function eventsOnDay(defs: readonly EventDef[], day: number, today: number, seed: number, climate: Climate): EventDef[] {
  return defs.filter((def) => {
    if (def.schedule.kind === 'heatwave' && day - today > def.announceDays) return false;
    return isEventDay(def, day, seed, climate);
  });
}
