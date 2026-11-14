import { dateOfDay, type Season } from '../game/date';
import type { Game } from '../game/game';
import { formatClock } from './format';
import { texts } from './texts';

/** One day row of the calendar panel. */
export interface CalendarDayView {
  day: number;
  isToday: boolean;
  /** "Mo 7.6." */
  label: string;
  /** "Montag, 7. Juni 2027" */
  longLabel: string;
  season: Season;
  /** Names of the events on this day (as the player can know them today). */
  events: string[];
  /** Expected demand changes, strongest first: "Eis ↑↑", "Zeitungen ↓" (empty when nothing stands out). */
  demand: string[];
  weather: {
    symbol: string;
    /** "Sonnig" for the exact days, "eher nass" for the tendency days. */
    text: string;
    range: string;
    /** "sicher" or "Tendenz, 75 % sicher". */
    reliability: string;
    sure: boolean;
  };
}

export interface CalendarView {
  /** "Montag, 7. Juni 2027" */
  todayLabel: string;
  /** "Sommer" */
  seasonLabel: string;
  season: Season;
  /** Today and the following six days. */
  days: CalendarDayView[];
  /** "☂ Leichter Regen · 14 °C (10–19 °C)" */
  weatherNow: string;
  /** Events relevant now: running, announced, planned (60 days), finished yesterday. */
  events: CalendarEventView[];
}

export interface CalendarEventView {
  id: string;
  name: string;
  description: string;
  status: 'planned' | 'announced' | 'active' | 'completed';
  statusLabel: string;
  /** "Sa 12.6." or "Sa 14.8. – So 15.8.", plus hours when the event has them. */
  when: string;
  /** "Mehr Nachfrage: Bier, Kaltgetränke" */
  demand: string;
}

function shortDate(day: number): string {
  const d = dateOfDay(day);
  return texts.calendar.dayLabel(texts.weekdayShort[d.weekday], texts.dateShort(d.dayOfMonth, d.month));
}

/** Short HUD text: "7. Juni 2027 · Sommer". */
export function hudDateText(day: number): string {
  const d = dateOfDay(day);
  return `${texts.date(d.dayOfMonth, d.month, d.year)} · ${texts.seasonNames[d.season]}`;
}

/** HUD weather: "☀ 24 °C". */
export function hudWeatherText(game: Pick<Game, 'weather'>): string {
  const env = game.weather.environment();
  return `${texts.weather.symbols[env.weather.condition]} ${texts.weather.now(env.temperature)}`;
}

function longLabel(day: number): string {
  const d = dateOfDay(day);
  return `${texts.weekdayLong[d.weekday]}, ${texts.date(d.dayOfMonth, d.month, d.year)}`;
}

/** Pure: reads the state, changes nothing (opening the panel never changes the game). */
export function buildCalendarView(game: Pick<Game, 'state' | 'content' | 'weather' | 'events' | 'demand'>): CalendarView {
  const today = game.state.calendar.day;
  const d = dateOfDay(today);
  const days: CalendarDayView[] = [];
  const forecast = game.weather.forecast();
  const outlook = game.demand.outlook();
  for (let i = 0; i < 7; i += 1) {
    const day = today + i;
    const di = dateOfDay(day);
    const f = forecast[i];
    const sure = f !== undefined && f.condition !== null;
    days.push({
      weather: f
        ? {
            symbol: f.condition ? texts.weather.symbols[f.condition] : texts.weather.tendencySymbols[f.tendency],
            text: f.condition ? texts.weather.conditions[f.condition] : texts.weather.tendencies[f.tendency],
            range: texts.weather.range(f.low, f.high),
            reliability: sure ? texts.calendar.sure : texts.calendar.tendency(f.confidence),
            sure,
          }
        : { symbol: '', text: '', range: '', reliability: '', sure: false },
      day,
      isToday: i === 0,
      label: texts.calendar.dayLabel(texts.weekdayShort[di.weekday], texts.dateShort(di.dayOfMonth, di.month)),
      longLabel: longLabel(day),
      season: di.season,
      events: game.events.onDay(day).map((e) => e.name),
      demand: (outlook[i]?.groups ?? [])
        .filter((g) => Math.abs(g.delta) >= 6)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 3)
        .map((g) => `${g.label} ${g.delta >= 15 ? '↑↑' : g.delta > 0 ? '↑' : g.delta <= -15 ? '↓↓' : '↓'}`),
    });
  }
  const env = game.weather.environment();
  const weatherNow = `${texts.weather.symbols[env.weather.condition]} ${texts.weather.conditions[env.weather.condition]} · ${texts.weather.now(env.temperature)} (${texts.weather.range(env.weather.low, env.weather.high)})`;
  const order = { active: 0, announced: 1, planned: 2, completed: 3 } as const;
  const events: CalendarEventView[] = game.events
    .current()
    .slice()
    .sort((a, b) => order[a.status] - order[b.status] || a.occurrence.startDay - b.occurrence.startDay)
    .map((e) => {
      const hours = e.def.hours ? ` · ${texts.calendar.hours(formatClock(e.def.hours.from), formatClock(e.def.hours.to))}` : '';
      return {
        id: e.def.id,
        name: e.def.name,
        description: e.def.description,
        status: e.status,
        statusLabel: texts.calendar.status[e.status],
        when: texts.calendar.when(shortDate(e.occurrence.startDay), shortDate(e.occurrence.endDay)) + hours,
        demand: texts.calendar.demand(e.def.productGroups.join(', ')),
      };
    });
  return { todayLabel: longLabel(today), seasonLabel: texts.seasonNames[d.season], season: d.season, days, weatherNow, events };
}
