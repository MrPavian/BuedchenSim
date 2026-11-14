import { describe, expect, it } from 'vitest';
import { START_DATE, dateOfDay, dayOfDate, daysInMonth, epochDay, fromEpochDay, isLeapYear, seasonOf } from './date';
import { weekdayOf } from './selectors';

describe('calendar dates', () => {
  it('starts on a Monday, so game day 1 keeps its weekday from before the calendar existed', () => {
    const d = dateOfDay(1);
    expect(d).toMatchObject({ ...START_DATE, weekday: 0, season: 'summer' });
    for (let day = 1; day <= 30; day++) expect(weekdayOf(day)).toBe((day - 1) % 7);
  });

  it('round-trips epoch days and matches known dates', () => {
    expect(epochDay({ year: 1970, month: 1, dayOfMonth: 1 })).toBe(0);
    expect(epochDay({ year: 2000, month: 3, dayOfMonth: 1 })).toBe(11017);
    for (let n = -1000; n < 30000; n += 37) expect(epochDay(fromEpochDay(n))).toBe(n);
    // 2027-12-24 is a Friday, 2028-01-01 a Saturday.
    expect(dateOfDay(dayOfDate({ year: 2027, month: 12, dayOfMonth: 24 })).weekday).toBe(4);
    expect(dateOfDay(dayOfDate({ year: 2028, month: 1, dayOfMonth: 1 })).weekday).toBe(5);
  });

  it('handles month, year and leap-year changes', () => {
    const lastJune = dayOfDate({ year: 2027, month: 6, dayOfMonth: 30 });
    expect(dateOfDay(lastJune + 1)).toMatchObject({ month: 7, dayOfMonth: 1 });
    const newYear = dayOfDate({ year: 2027, month: 12, dayOfMonth: 31 });
    expect(dateOfDay(newYear)).toMatchObject({ dayOfYear: 365, leapYear: false });
    expect(dateOfDay(newYear + 1)).toMatchObject({ year: 2028, month: 1, dayOfMonth: 1, dayOfYear: 1, leapYear: true });
    const feb28 = dayOfDate({ year: 2028, month: 2, dayOfMonth: 28 });
    expect(dateOfDay(feb28 + 1)).toMatchObject({ month: 2, dayOfMonth: 29 });
    expect(dateOfDay(feb28 + 2)).toMatchObject({ month: 3, dayOfMonth: 1, dayOfYear: 61 });
    expect(dateOfDay(dayOfDate({ year: 2028, month: 12, dayOfMonth: 31 })).dayOfYear).toBe(366);
    expect([isLeapYear(2028), isLeapYear(2100), isLeapYear(2000), isLeapYear(2027)]).toEqual([true, false, true, false]);
    expect([daysInMonth(2028, 2), daysInMonth(2027, 2), daysInMonth(2027, 4)]).toEqual([29, 28, 30]);
  });

  it('derives the seasons (spring Mar-May, summer Jun-Aug, autumn Sep-Nov, winter Dec-Feb)', () => {
    expect([1, 2, 3, 5, 6, 8, 9, 11, 12].map(seasonOf)).toEqual([
      'winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter',
    ]);
  });
});
