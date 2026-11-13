import { describe, expect, it } from 'vitest';
import { WEEK_LENGTH } from './balance';
import { weekdayOf } from './selectors';

describe('weekdayOf', () => {
  it('day 1 is Monday (0)', () => {
    expect(weekdayOf(1)).toBe(0);
  });

  it('counts through the week and wraps', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayOf)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayOf(8)).toBe(0);
    expect(weekdayOf(1 + 10 * WEEK_LENGTH + 2)).toBe(2);
  });

  it('is total: day 0 and negatives wrap backwards, junk falls back to Monday', () => {
    expect(weekdayOf(0)).toBe(6);
    expect(weekdayOf(-6)).toBe(0);
    expect(weekdayOf(Number.NaN)).toBe(0);
    expect(weekdayOf(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
