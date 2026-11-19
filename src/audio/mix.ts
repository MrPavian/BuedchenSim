import type { EventAmbience } from '../game/eventCalendar';
import type { WeatherCondition } from '../game/weather';

/**
 * Sound mix of the neighbourhood (Auftrag 06, 6.4), as a pure function of the derived world state: which layers sound
 * and how loud (0..1, before the master volume). No Web Audio here, so the rules are unit tested in Node.
 */

export type AmbienceLayer = 'street' | 'birds' | 'traffic' | 'rain' | 'wind' | 'crowd' | 'music' | 'market' | 'bells';

export const AMBIENCE_LAYERS: readonly AmbienceLayer[] = ['street', 'birds', 'traffic', 'rain', 'wind', 'crowd', 'music', 'market', 'bells'];

export type AmbienceMix = Record<AmbienceLayer, number>;

export interface MixInput {
  /** Clock minute of the day (0..1439). */
  minute: number;
  /** 0 night .. 1 day (sunOf). */
  daylight: number;
  weather: WeatherCondition;
  /** Ambience of the events active right now. */
  eventAmbience: readonly EventAmbience[];
  /** True while the player is inside the kiosk: outdoor layers are muffled. */
  inside: boolean;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Rush hours: more traffic around 7-9 and 16-18:30, little at night. */
function trafficLevel(minute: number): number {
  const h = minute / 60;
  const peak = (centre: number, width: number): number => Math.max(0, 1 - Math.abs(h - centre) / width);
  return clamp01(0.25 + 0.6 * Math.max(peak(8, 1.5), peak(17.2, 1.8)) - (h >= 21 || h < 6 ? 0.15 : 0));
}

export function ambienceMix(input: MixInput): AmbienceMix {
  const { minute, daylight, weather, eventAmbience, inside } = input;
  const h = minute / 60;
  const wet = weather === 'light-rain' || weather === 'heavy-rain';
  const snowing = weather === 'snow';
  // Birds sing in the morning (strongest at dawn) and a little in the evening; not in rain, snow or fog, not at night.
  const morning = Math.max(0, 1 - Math.abs(h - 7) / 3);
  const evening = Math.max(0, 1 - Math.abs(h - 19.5) / 2) * 0.4;
  const birdWeather = wet || snowing ? 0.1 : weather === 'fog' ? 0.4 : weather === 'cloudy' ? 0.7 : 1;
  const mix: AmbienceMix = {
    // Snow muffles the town.
    street: (0.35 + 0.25 * daylight) * (snowing ? 0.55 : 1),
    birds: clamp01((morning + evening) * daylight * birdWeather),
    traffic: trafficLevel(minute) * (snowing ? 0.5 : 1),
    rain: weather === 'heavy-rain' ? 1 : weather === 'light-rain' ? 0.55 : 0,
    wind: weather === 'heavy-rain' ? 0.6 : snowing ? 0.45 : weather === 'cloudy' ? 0.2 : weather === 'frost' ? 0.25 : 0.08,
    crowd: eventAmbience.includes('crowd') ? 0.8 : 0,
    music: eventAmbience.includes('music') ? 0.6 : 0,
    market: eventAmbience.includes('market') ? 0.55 : 0,
    bells: eventAmbience.includes('bells') ? 0.4 * (h >= 15 ? 1 : 0.5) : 0,
  };
  if (inside) {
    for (const layer of AMBIENCE_LAYERS) mix[layer] *= layer === 'rain' ? 0.6 : 0.45;
  }
  return mix;
}

/** Master gain for the three sound settings (device setting, not game state). */
export type SoundLevel = 'off' | 'quiet' | 'normal';
export const SOUND_LEVELS: readonly SoundLevel[] = ['off', 'quiet', 'normal'];
export function masterGain(level: SoundLevel): number {
  return level === 'off' ? 0 : level === 'quiet' ? 0.35 : 0.8;
}
