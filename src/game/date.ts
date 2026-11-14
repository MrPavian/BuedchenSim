import type { Weekday } from './selectors';

/**
 * Calendar dates of the game (Auftrag 05). The saved state only holds the day counter (`calendar.day`, starting at 1);
 * the date, weekday and season are derived from it and the configured start date. No dependency on the system clock.
 */

export interface GameDate {
  year: number;
  /** 1..12 */
  month: number;
  /** Day of the month, 1..31. */
  dayOfMonth: number;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface DateInfo extends GameDate {
  /** Day of the year, 1..365 (366 in leap years). */
  dayOfYear: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: Weekday;
  season: Season;
  leapYear: boolean;
}

/**
 * Date of game day 1. Must be a Monday: game day 1 has always been a Monday, so saves made before the calendar existed
 * keep their weekdays (checked by a test).
 */
export const START_DATE: GameDate = { year: 2027, month: 6, dayOfMonth: 7 };

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (MONTH_DAYS[month - 1] ?? 30);
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Days since 1970-01-01 (proleptic Gregorian), integer arithmetic only (no Date object, no time zones). */
export function epochDay(date: GameDate): number {
  // Algorithm "days_from_civil" (H. Hinnant).
  const y = date.month <= 2 ? date.year - 1 : date.year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const m = date.month;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + date.dayOfMonth - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `epochDay`. */
export function fromEpochDay(days: number): GameDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const dayOfMonth = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, dayOfMonth };
}

export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 1970-01-01 was a Thursday. */
function weekdayOfEpochDay(days: number): Weekday {
  return ((((days + 3) % 7) + 7) % 7) as Weekday;
}

/** Date of a game day (day 1 = START_DATE). Non-finite days fall back to day 1. */
export function dateOfDay(day: number, start: GameDate = START_DATE): DateInfo {
  const d = Number.isFinite(day) ? Math.trunc(day) : 1;
  const days = epochDay(start) + d - 1;
  const date = fromEpochDay(days);
  return {
    ...date,
    dayOfYear: days - epochDay({ year: date.year, month: 1, dayOfMonth: 1 }) + 1,
    weekday: weekdayOfEpochDay(days),
    season: seasonOf(date.month),
    leapYear: isLeapYear(date.year),
  };
}

/** Game day of a date (inverse of `dateOfDay`); may be < 1 for dates before the start. */
export function dayOfDate(date: GameDate, start: GameDate = START_DATE): number {
  return epochDay(date) - epochDay(start) + 1;
}
