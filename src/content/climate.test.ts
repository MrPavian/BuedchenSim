import { describe, expect, it } from 'vitest';
import { ruhrgebietClimate as climate } from './regions/ruhrgebiet/climate';
import { dateOfDay } from '../game/date';
import { forecast, forecastFor, temperatureAt, weatherOfDay, WEATHER_CONDITIONS } from '../game/weather';

const YEARS = 3;
const DAYS = 365 * YEARS;

describe('weather', () => {
  it('is deterministic and independent of the order days are asked for', () => {
    const a = weatherOfDay(7, climate, 200);
    expect(weatherOfDay(7, climate, 200)).toEqual(a);
    const fresh = [...climate];
    expect(weatherOfDay(7, fresh, 200)).toEqual(a); // a new memo computes the same chain
    expect(weatherOfDay(8, climate, 200)).not.toEqual(a);
  });

  it('follows the seasons: all seven conditions occur, snow and frost only in the cold months, hot days in summer', () => {
    const counts = new Map<string, number>();
    let summerHigh = 0;
    let winterHigh = 0;
    let summerDays = 0;
    let winterDays = 0;
    let hot = 0;
    let heatSpells = 0;
    let run = 0;
    for (const seed of [1, 2, 3]) {
      for (let d = 1; d <= DAYS; d++) {
        const w = weatherOfDay(seed, climate, d);
        const { month } = dateOfDay(d);
        counts.set(w.condition, (counts.get(w.condition) ?? 0) + 1);
        if (w.condition === 'snow' || w.condition === 'frost') expect([11, 12, 1, 2, 3]).toContain(month);
        expect(w.high).toBeGreaterThanOrEqual(w.low + 2);
        if (month >= 6 && month <= 8) {
          summerHigh += w.high;
          summerDays++;
          if (w.high >= 30) hot++;
        }
        if (month === 12 || month <= 2) {
          winterHigh += w.high;
          winterDays++;
        }
        run = w.high >= 30 ? run + 1 : 0;
        if (run === 3) heatSpells++;
      }
    }
    for (const c of WEATHER_CONDITIONS) expect(counts.get(c) ?? 0, c).toBeGreaterThan(0);
    expect(summerHigh / summerDays).toBeGreaterThan(20);
    expect(winterHigh / winterDays).toBeLessThan(8);
    expect(hot).toBeGreaterThan(5);
    // Heat waves (3+ days >= 30 °C) happen, but not every week: about 1-6 per summer.
    expect(heatSpells / (3 * YEARS)).toBeGreaterThanOrEqual(0.5);
    expect(heatSpells / (3 * YEARS)).toBeLessThanOrEqual(6);
  });

  it('gives a stable forecast: three exact days, four uncertain ones that never change while the day stays the same', () => {
    const f = forecast(5, climate, 40);
    expect(f).toHaveLength(7);
    for (const d of f.slice(0, 3)) {
      const w = weatherOfDay(5, climate, d.day);
      expect(d).toMatchObject({ condition: w.condition, low: w.low, high: w.high, confidence: 100 });
    }
    for (const d of f.slice(3)) {
      expect(d.condition).toBeNull();
      expect(d.confidence).toBeLessThan(100);
      expect(d.high - d.low).toBeGreaterThan(2);
    }
    expect(forecast(5, climate, 40)).toEqual(f); // asking again (menu reopened) gives the same
    // Seen from a later day, the far days get exact.
    expect(forecastFor(5, climate, 44, 1).condition).toBe(weatherOfDay(5, climate, 45).condition);
  });

  it('rises from the morning low to the afternoon high and cools in the evening', () => {
    const w = weatherOfDay(1, climate, 30);
    expect(temperatureAt(w, 360)).toBeCloseTo(w.low, 0);
    expect(temperatureAt(w, 900)).toBeCloseTo(w.high, 0);
    expect(temperatureAt(w, 1320)).toBeLessThan(w.high);
    expect(temperatureAt(w, 1320)).toBeGreaterThan(w.low);
  });
});
