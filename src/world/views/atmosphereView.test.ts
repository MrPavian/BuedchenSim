import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { lookFor, NIGHT_SKY, timeOfDayLook } from './atmosphereView';

const lightness = (hex: number): number => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l;

describe('time of day look (Auftrag 06, 6.3)', () => {
  const summer = lookFor('summer', 'sunny');

  it('full day keeps the season and weather look', () => {
    expect(timeOfDayLook(summer, { elevationDeg: 55, daylight: 1 })).toEqual(summer);
  });

  it('night: no sun, night sky, but a fill light rest for readability', () => {
    const night = timeOfDayLook(summer, { elevationDeg: -20, daylight: 0 });
    expect(night.sun).toBe(0);
    expect(night.sky).toBe(NIGHT_SKY);
    expect(night.hemisphere).toBeGreaterThan(summer.hemisphere * 0.25);
    expect(night.hemisphere).toBeLessThan(summer.hemisphere * 0.5);
  });

  it('dusk is darker than day, warmer sun, brighter than night', () => {
    const dusk = timeOfDayLook(summer, { elevationDeg: 2, daylight: 0.6 });
    expect(lightness(dusk.sky)).toBeLessThan(lightness(summer.sky));
    expect(lightness(dusk.sky)).toBeGreaterThan(lightness(NIGHT_SKY));
    expect(dusk.sun).toBeLessThan(summer.sun);
    const c = new Color(dusk.sunColor);
    expect(c.r - c.b).toBeGreaterThan(new Color(summer.sunColor).r - new Color(summer.sunColor).b);
  });

  it('the sun fades in continuously around sunrise', () => {
    let prev = -1;
    for (let e = -4; e <= 12; e += 1) {
      const v = timeOfDayLook(summer, { elevationDeg: e, daylight: Math.min(1, Math.max(0, (e + 6) / 12)) }).sun;
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});
