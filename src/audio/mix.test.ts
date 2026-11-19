import { describe, expect, it } from 'vitest';
import { AMBIENCE_LAYERS, ambienceMix, masterGain, type MixInput } from './mix';

const base: MixInput = { minute: 12 * 60, daylight: 1, weather: 'sunny', eventAmbience: [], inside: false };

describe('ambience mix (Auftrag 06, 6.4)', () => {
  it('every layer stays within 0..1', () => {
    for (const weather of ['sunny', 'cloudy', 'light-rain', 'heavy-rain', 'fog', 'snow', 'frost'] as const) {
      for (let minute = 0; minute < 1440; minute += 30) {
        const m = ambienceMix({ ...base, weather, minute, daylight: minute > 360 && minute < 1260 ? 1 : 0, eventAmbience: ['crowd', 'music', 'market', 'bells'] });
        for (const layer of AMBIENCE_LAYERS) {
          expect(m[layer]).toBeGreaterThanOrEqual(0);
          expect(m[layer]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('rain sounds only when it rains, stronger in heavy rain', () => {
    expect(ambienceMix(base).rain).toBe(0);
    const light = ambienceMix({ ...base, weather: 'light-rain' }).rain;
    const heavy = ambienceMix({ ...base, weather: 'heavy-rain' }).rain;
    expect(light).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(light);
  });

  it('birds sing on a fair morning, not at night and hardly in the rain', () => {
    const morning = ambienceMix({ ...base, minute: 7 * 60 }).birds;
    expect(morning).toBeGreaterThan(0.8);
    expect(ambienceMix({ ...base, minute: 23 * 60, daylight: 0 }).birds).toBe(0);
    expect(ambienceMix({ ...base, minute: 7 * 60, weather: 'heavy-rain' }).birds).toBeLessThan(morning * 0.2);
  });

  it('traffic peaks in the rush hours', () => {
    const rush = ambienceMix({ ...base, minute: 8 * 60 }).traffic;
    const noon = ambienceMix({ ...base, minute: 12 * 60 + 30 }).traffic;
    const late = ambienceMix({ ...base, minute: 21 * 60 + 30 }).traffic;
    expect(rush).toBeGreaterThan(noon);
    expect(noon).toBeGreaterThan(late);
  });

  it('event layers follow the active events', () => {
    expect(ambienceMix(base).crowd).toBe(0);
    expect(ambienceMix({ ...base, eventAmbience: ['crowd'] }).crowd).toBeGreaterThan(0);
    expect(ambienceMix({ ...base, eventAmbience: ['music'] }).music).toBeGreaterThan(0);
    expect(ambienceMix({ ...base, eventAmbience: ['bells'] }).bells).toBeGreaterThan(0);
  });

  it('inside the kiosk the outdoor sounds are muffled', () => {
    const out = ambienceMix({ ...base, weather: 'light-rain' });
    const inside = ambienceMix({ ...base, weather: 'light-rain', inside: true });
    for (const layer of AMBIENCE_LAYERS) expect(inside[layer]).toBeLessThanOrEqual(out[layer]);
    expect(inside.street).toBeLessThan(out.street);
  });

  it('master gain: off is silent, quiet below normal', () => {
    expect(masterGain('off')).toBe(0);
    expect(masterGain('quiet')).toBeGreaterThan(0);
    expect(masterGain('quiet')).toBeLessThan(masterGain('normal'));
  });

  it('is deterministic', () => {
    expect(ambienceMix({ ...base, minute: 555 })).toEqual(ambienceMix({ ...base, minute: 555 }));
  });
});
