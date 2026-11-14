import { dateOfDay, type Season } from './date';
import { eventsTodayAt } from './eventCalendar';
import type { DeepReadonly, GameState } from './state';
import type { ContentPack } from './types';
import { temperatureAt, weatherOfDay, type Climate, type DayWeather } from './weather';

/**
 * Everything about "the world around the kiosk" that is derived, never saved (Auftrag 05): season, today's weather,
 * the current temperature. Phase 5 adds active events and the specialty stage. Conditions, demand and the views read
 * this instead of recomputing it.
 */
export interface Environment {
  day: number;
  season: Season;
  weather: DayWeather;
  /** °C at the current minute. */
  temperature: number;
  /** Events taking place today (any status), and the ids active right now. */
  eventsToday: readonly string[];
  activeEvents: readonly string[];
}

/** A temperate fallback climate for content packs without one (tests, tools). */
export const DEFAULT_CLIMATE: Climate = Array.from({ length: 12 }, (_, i) => {
  const t = Math.cos(((i - 6.5) / 12) * 2 * Math.PI); // -1 in January .. +1 in July
  return { high: Math.round(14 + 10 * t), low: Math.round(6 + 7 * t), weights: { sunny: 4, cloudy: 4, 'light-rain': 2, 'heavy-rain': 1, fog: 1, snow: 1, frost: 1 } };
});

export function climateOf(content: Pick<ContentPack, 'climate'>): Climate {
  return content.climate ?? DEFAULT_CLIMATE;
}

/** Pure; cheap after the first call per day (the weather chain is memoised). */
export function environmentOf(
  content: Pick<ContentPack, 'climate' | 'events'>,
  state: DeepReadonly<Pick<GameState, 'calendar' | 'world'>>,
): Environment {
  const { day, minute } = state.calendar;
  const climate = climateOf(content);
  const seed = state.world.seed;
  const weather = weatherOfDay(seed, climate, day);
  // Cached per content, seed, day and whole minute: residents ask many times per frame.
  const key = `${seed}|${day}|${Math.floor(minute)}`;
  const cached = cache.get(content);
  if (cached && cached.key === key) return cached.env;
  const eventsToday: string[] = [];
  const activeEvents: string[] = [];
  for (const e of eventsTodayAt(content.events ?? [], day, minute, seed, climate)) {
    eventsToday.push(e.def.id);
    if (e.status === 'active') activeEvents.push(e.def.id);
  }
  const env: Environment = { day, season: dateOfDay(day).season, weather, temperature: temperatureAt(weather, minute), eventsToday, activeEvents };
  cache.set(content, { key, env });
  return env;
}

const cache = new WeakMap<object, { key: string; env: Environment }>();
