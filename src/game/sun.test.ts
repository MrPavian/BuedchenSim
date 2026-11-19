import { describe, expect, it } from 'vitest';
import { dayOfDate } from './date';
import { isSummerTime, sunCrossing, sunOf } from './sun';

const day = (year: number, month: number, dayOfMonth: number): number => dayOfDate({ year, month, dayOfMonth });
const hm = (m: number | null): string => (m === null ? '-' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

describe('sun (Auftrag 06, 6.3)', () => {
  it('summer time follows the EU rule (last Sundays of March and October)', () => {
    expect(isSummerTime({ year: 2027, month: 3, dayOfMonth: 27 })).toBe(false);
    expect(isSummerTime({ year: 2027, month: 3, dayOfMonth: 28 })).toBe(true);
    expect(isSummerTime({ year: 2027, month: 10, dayOfMonth: 30 })).toBe(true);
    expect(isSummerTime({ year: 2027, month: 10, dayOfMonth: 31 })).toBe(false);
    expect(isSummerTime({ year: 2027, month: 12, dayOfMonth: 1 })).toBe(false);
  });

  it('June: sunrise about 05:15, sunset about 21:50 (Ruhr area, summer time)', () => {
    const d = day(2027, 6, 21);
    const rise = sunCrossing(d, 'rise');
    const set = sunCrossing(d, 'set');
    expect(rise).toBeGreaterThanOrEqual(5 * 60);
    expect(rise).toBeLessThanOrEqual(5 * 60 + 30);
    expect(set).toBeGreaterThanOrEqual(21 * 60 + 40);
    expect(set).toBeLessThanOrEqual(22 * 60);
    expect(hm(set)).toMatch(/^21:/);
  });

  it('December: sunrise after 08:15, sunset about 16:25', () => {
    const d = day(2027, 12, 21);
    expect(sunCrossing(d, 'rise')).toBeGreaterThanOrEqual(8 * 60 + 15);
    const set = sunCrossing(d, 'set') ?? 0;
    expect(set).toBeGreaterThanOrEqual(16 * 60 + 15);
    expect(set).toBeLessThanOrEqual(16 * 60 + 35);
  });

  it('noon sun is in the south, higher in summer than in winter; morning east, evening west', () => {
    const june = day(2027, 6, 21);
    const dec = day(2027, 12, 21);
    const juneNoon = sunOf(june, 13 * 60 + 30);
    const decNoon = sunOf(dec, 12 * 60 + 30);
    expect(juneNoon.elevationDeg).toBeGreaterThan(60);
    expect(decNoon.elevationDeg).toBeLessThan(17);
    expect(Math.abs(juneNoon.azimuthDeg)).toBeLessThan(10);
    expect(juneNoon.direction.z).toBeGreaterThan(0); // south = +Z
    expect(sunOf(june, 8 * 60).direction.x).toBeGreaterThan(0); // east = +X
    expect(sunOf(june, 19 * 60).direction.x).toBeLessThan(0);
    const len = Math.hypot(juneNoon.direction.x, juneNoon.direction.y, juneNoon.direction.z);
    expect(len).toBeCloseTo(1, 6);
  });

  it('daylight is 1 at day, 0 at night and rises monotonically through dawn', () => {
    const dec = day(2027, 12, 1);
    expect(sunOf(dec, 13 * 60).daylight).toBe(1);
    expect(sunOf(dec, 18 * 60 + 30).daylight).toBe(0);
    expect(sunOf(dec, 6 * 60).daylight).toBe(0);
    let prev = -1;
    for (let m = 6 * 60; m <= 10 * 60; m += 5) {
      const v = sunOf(dec, m).daylight;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    // At 16:30 in December it is already dusk; at 21:00 in June still light.
    expect(sunOf(dec, 16 * 60 + 30).daylight).toBeLessThan(0.6);
    expect(sunOf(day(2027, 6, 21), 21 * 60).daylight).toBeGreaterThan(0.4);
  });

  it('is deterministic', () => {
    expect(sunOf(200, 777)).toEqual(sunOf(200, 777));
  });
});
