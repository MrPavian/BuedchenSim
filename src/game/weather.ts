import { DAY_END_MINUTE, DAY_START_MINUTE } from './balance';
import { dateOfDay } from './date';
import { roll } from './random';

/**
 * Weather (Auftrag 05, 5.2). Fully deterministic: the weather of a day is a pure function of the world seed, the day
 * and the weather of the day before (a short chain from day 0), so nothing has to be saved and a reload or opening a
 * menu can never re-roll it. The forecast is a pure function of (seed, target day, day it is looked at from).
 */

export type WeatherCondition = 'sunny' | 'cloudy' | 'light-rain' | 'heavy-rain' | 'fog' | 'snow' | 'frost';

export const WEATHER_CONDITIONS: readonly WeatherCondition[] = [
  'sunny', 'cloudy', 'light-rain', 'heavy-rain', 'fog', 'snow', 'frost',
];

/** Climate of one month (content data of a region). Temperatures in °C. */
export interface MonthClimate {
  /** Average daily high and low. */
  high: number;
  low: number;
  /** Relative weights of the weather conditions (temperature gates snow and frost). */
  weights: Readonly<Partial<Record<WeatherCondition, number>>>;
}

/** Twelve months, January first. */
export type Climate = readonly MonthClimate[];

export interface DayWeather {
  day: number;
  condition: WeatherCondition;
  /** Daily low and high, whole °C. */
  low: number;
  high: number;
  /** Deviation of this day's temperature from the month average (°C); carried over to the next day. */
  anomaly: number;
}

/** How strongly yesterday's temperature deviation carries over (0..1). */
const ANOMALY_PERSISTENCE = 0.72;
/** Spread of the daily random temperature change (°C). */
const ANOMALY_STEP = 3.2;
/** Weight factor for repeating yesterday's condition (weather comes in spells). */
const CONDITION_PERSISTENCE = 2.2;

function gaussian(seed: number, ...parts: (string | number)[]): number {
  // Sum of uniform rolls: cheap, deterministic, close to normal (mean 0, sd 1).
  let s = 0;
  for (let i = 0; i < 6; i += 1) s += roll(seed, ...parts, i);
  return (s - 3) / Math.sqrt(0.5);
}

function climateOf(climate: Climate, day: number): MonthClimate {
  const fallback: MonthClimate = { high: 15, low: 7, weights: { sunny: 1, cloudy: 1 } };
  return climate[dateOfDay(day).month - 1] ?? fallback;
}

/** Condition weights after temperature gates and persistence. */
function conditionWeights(month: MonthClimate, low: number, high: number, anomaly: number, previous: WeatherCondition | null): Map<WeatherCondition, number> {
  const out = new Map<WeatherCondition, number>();
  for (const c of WEATHER_CONDITIONS) {
    let w = month.weights[c] ?? 0;
    if (c === 'snow' && high > 2) w = 0;
    if (c === 'frost' && low > -1) w = 0;
    if ((c === 'light-rain' || c === 'heavy-rain') && high <= 1) w *= 0.2; // too cold for rain: snow or frost instead
    if (c === 'sunny' && anomaly > 2) w *= 1 + anomaly / 4; // warm spells are sunny
    if ((c === 'light-rain' || c === 'heavy-rain') && anomaly > 4) w *= 0.5;
    if (c === previous) w *= CONDITION_PERSISTENCE;
    if (w > 0) out.set(c, w);
  }
  if (out.size === 0) out.set('cloudy', 1);
  return out;
}

function pick(weights: Map<WeatherCondition, number>, r: number): WeatherCondition {
  let total = 0;
  for (const w of weights.values()) total += w;
  let target = r * total;
  let last: WeatherCondition = 'cloudy';
  for (const [c, w] of weights) {
    last = c;
    target -= w;
    if (target < 0) return c;
  }
  return last;
}

function nextDay(seed: number, climate: Climate, day: number, prev: DayWeather | null): DayWeather {
  const month = climateOf(climate, day);
  const anomaly = (prev?.anomaly ?? 0) * ANOMALY_PERSISTENCE + gaussian(seed, 'weather-temp', day) * ANOMALY_STEP;
  let high = month.high + anomaly;
  let low = month.low + anomaly * 0.8;
  const condition = pick(conditionWeights(month, low, high, anomaly, prev?.condition ?? null), roll(seed, 'weather-cond', day));
  // Clouds and rain keep the day cooler and the night milder; clear frost nights are colder.
  if (condition === 'heavy-rain' || condition === 'light-rain') high -= 2;
  if (condition === 'cloudy' || condition === 'fog') high -= 1;
  if (condition === 'frost') low -= 2;
  if (condition === 'sunny') high += 1;
  high = Math.round(high);
  low = Math.round(Math.min(low, high - 2));
  return { day, condition, low, high, anomaly };
}

/** Memo per (seed, climate): the chain is computed once up to the highest day asked for. */
const memo = new WeakMap<Climate, Map<number, DayWeather[]>>();

/** Weather of a game day (day >= 1; smaller values are treated as day 1). */
export function weatherOfDay(seed: number, climate: Climate, day: number): DayWeather {
  const target = Math.max(1, Math.trunc(Number.isFinite(day) ? day : 1));
  let bySeed = memo.get(climate);
  if (!bySeed) {
    bySeed = new Map();
    memo.set(climate, bySeed);
  }
  let chain = bySeed.get(seed);
  if (!chain) {
    chain = [];
    bySeed.set(seed, chain);
  }
  while (chain.length < target) {
    const prev = chain.length > 0 ? (chain[chain.length - 1] as DayWeather) : null;
    chain.push(nextDay(seed, climate, chain.length + 1, prev));
  }
  return chain[target - 1] as DayWeather;
}

/**
 * Temperature at a time of day: the low around 06:00, the high around 15:00, falling towards the evening.
 * Minutes outside the opening hours are clamped.
 */
export function temperatureAt(weather: DayWeather, minute: number): number {
  const m = Math.min(Math.max(minute, DAY_START_MINUTE), DAY_END_MINUTE);
  const peak = 15 * 60;
  const t = m <= peak ? (m - DAY_START_MINUTE) / (peak - DAY_START_MINUTE) : 1 - ((m - peak) / (DAY_END_MINUTE - peak)) * 0.45;
  const shape = (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;
  return Math.round((weather.low + (weather.high - weather.low) * shape) * 10) / 10;
}

/** Coarse tendency shown for the uncertain days of the forecast. */
export type WeatherTendency = 'fair' | 'changeable' | 'wet' | 'wintry';

export function tendencyOf(condition: WeatherCondition): WeatherTendency {
  if (condition === 'sunny') return 'fair';
  if (condition === 'cloudy' || condition === 'fog') return 'changeable';
  if (condition === 'snow' || condition === 'frost') return 'wintry';
  return 'wet';
}

export interface ForecastDay {
  day: number;
  /** Days ahead of the day the forecast is made on (0 = today). */
  offset: number;
  /** Today, tomorrow and the day after: the actual condition. Later days: null (only a tendency). */
  condition: WeatherCondition | null;
  tendency: WeatherTendency;
  low: number;
  high: number;
  /** 0..100: how reliable the forecast is (100 for the first three days). */
  confidence: number;
}

/** Days with an exact forecast (today, tomorrow, the day after). */
export const SURE_FORECAST_DAYS = 3;
export const FORECAST_DAYS = 7;

/**
 * Forecast made on day `today` for `today + offset`. The first three days are exact (they equal the coming weather, so
 * they stay stable). Days 4–7 show a tendency and a wider temperature range that may be off by a deterministic error;
 * it is recomputed only when the day the forecast is made on changes (never when a menu is opened).
 */
export function forecastFor(seed: number, climate: Climate, today: number, offset: number): ForecastDay {
  const day = today + offset;
  const actual = weatherOfDay(seed, climate, day);
  if (offset < SURE_FORECAST_DAYS) {
    return { day, offset, condition: actual.condition, tendency: tendencyOf(actual.condition), low: actual.low, high: actual.high, confidence: 100 };
  }
  const uncertainty = offset - SURE_FORECAST_DAYS + 1; // 1..4
  const confidence = Math.max(40, 85 - uncertainty * 10);
  let tendency = tendencyOf(actual.condition);
  if (roll(seed, 'forecast-miss', day, today) * 100 >= confidence) {
    const options: WeatherTendency[] = ['fair', 'changeable', 'wet', 'wintry'].filter(
      (t) => t !== tendency && (t !== 'wintry' || actual.high < 6),
    ) as WeatherTendency[];
    tendency = options[Math.floor(roll(seed, 'forecast-alt', day, today) * options.length)] ?? tendency;
  }
  const shift = Math.round(gaussian(seed, 'forecast-temp', day, today) * uncertainty * 0.45);
  const spread = uncertainty;
  return { day, offset, condition: null, tendency, low: actual.low + shift - spread, high: actual.high + shift + spread, confidence };
}

export function forecast(seed: number, climate: Climate, today: number): ForecastDay[] {
  const out: ForecastDay[] = [];
  for (let i = 0; i < FORECAST_DAYS; i += 1) out.push(forecastFor(seed, climate, today, i));
  return out;
}
