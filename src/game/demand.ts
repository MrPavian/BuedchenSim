import { dateOfDay, type Season } from './date';
import type { Environment } from './environment';
import type { NpcDef, RoutineEntry } from './npcTypes';
import type { EventDef } from './eventCalendar';
import type { Weekday } from './selectors';
import type { ProductDef } from './types';
import type { WeatherCondition } from './weather';

/**
 * Demand (Auftrag 05, 5.4): a bounded, additive score per product,
 *
 *   D = clamp(B + W + E + S + T, min, max)
 *
 * B base demand, W weather and temperature, E active events, S season and weekday, T time of day. All values come from
 * content data; there is no multiplication of factors. Demand never sells anything: it only changes how likely
 * residents come (routine chances) and which wishes they pick (wish weights). Sales still need the player and
 * `economy.completeSale`.
 */

/** Keys address products: 'tag:<demandTag>', 'category:<category>' or a product id. */
export type DemandBonus = Readonly<Record<string, number>>;

export interface TemperatureRule {
  key: string;
  /** Points per °C above (`above`) or below (`below`) the threshold, capped at `cap` (absolute). */
  above?: number;
  below?: number;
  perDegree: number;
  cap: number;
}

export interface DemandConfig {
  base: number;
  min: number;
  max: number;
  weather: Readonly<Partial<Record<WeatherCondition, DemandBonus>>>;
  temperature: readonly TemperatureRule[];
  season: Readonly<Partial<Record<Season, DemandBonus>>>;
  /** Bonus on the listed weekdays (0 = Monday). */
  weekdays: readonly { days: Weekday[]; bonus: DemandBonus }[];
  /** Bonus within a time window (minutes since midnight, `to` exclusive). */
  timeOfDay: readonly { from: number; to: number; bonus: DemandBonus }[];
  /** Product groups shown to the player in the demand outlook (label + product key). */
  groups?: readonly { id: string; label: string; key: string }[];
}

export interface DemandContext {
  weather: WeatherCondition;
  temperature: number;
  season: Season;
  weekday: Weekday;
  minute: number;
  activeEvents: readonly EventDef[];
}

export interface DemandBreakdown {
  /** The clamped demand. */
  value: number;
  base: number;
  weather: number;
  events: number;
  season: number;
  time: number;
}

export function matchesKey(product: Pick<ProductDef, 'id' | 'category' | 'demandTags'>, key: string): boolean {
  if (key.startsWith('tag:')) return product.demandTags.includes(key.slice(4));
  if (key.startsWith('category:')) return product.category === key.slice(9);
  return product.id === key;
}

function bonusFor(product: Pick<ProductDef, 'id' | 'category' | 'demandTags'>, bonus: DemandBonus | undefined): number {
  if (!bonus) return 0;
  let sum = 0;
  for (const [key, value] of Object.entries(bonus)) if (matchesKey(product, key)) sum += value;
  return sum;
}

function temperatureBonus(product: Pick<ProductDef, 'id' | 'category' | 'demandTags'>, rules: readonly TemperatureRule[], t: number): number {
  let sum = 0;
  for (const r of rules) {
    if (!matchesKey(product, r.key)) continue;
    let degrees = 0;
    if (r.above !== undefined && t > r.above) degrees = t - r.above;
    else if (r.below !== undefined && t < r.below) degrees = r.below - t;
    sum += Math.sign(r.perDegree) * Math.min(Math.abs(r.perDegree) * degrees, r.cap);
  }
  return sum;
}

/** The demand of one product in a situation, with its parts (pure). */
export function demandFor(product: Pick<ProductDef, 'id' | 'category' | 'demandTags'>, config: DemandConfig, ctx: DemandContext): DemandBreakdown {
  const base = config.base;
  const weather = bonusFor(product, config.weather[ctx.weather]) + temperatureBonus(product, config.temperature, ctx.temperature);
  let events = 0;
  for (const e of ctx.activeEvents) events += bonusFor(product, e.demand);
  let season = bonusFor(product, config.season[ctx.season]);
  for (const w of config.weekdays) if (w.days.includes(ctx.weekday)) season += bonusFor(product, w.bonus);
  let time = 0;
  for (const t of config.timeOfDay) if (ctx.minute >= t.from && ctx.minute < t.to) time += bonusFor(product, t.bonus);
  const raw = base + weather + events + season + time;
  const value = Math.min(config.max, Math.max(config.min, raw));
  return { value, base, weather, events, season, time };
}

/**
 * Weight factor for a wish: the mean demand of its products relative to the base (1 = normal). Bounded by the
 * demand bounds, so a wish can become rarer or more frequent but never impossible or certain by demand alone.
 */
export function wishDemandFactor(products: readonly Pick<ProductDef, 'id' | 'category' | 'demandTags'>[], config: DemandConfig, ctx: DemandContext): number {
  if (products.length === 0) return 1;
  let sum = 0;
  for (const p of products) sum += demandFor(p, config, ctx).value;
  return sum / products.length / config.base;
}

/** A neutral configuration: every product at its base demand (content packs without demand data, tests). */
export const NEUTRAL_DEMAND: DemandConfig = { base: 50, min: 5, max: 100, weather: {}, temperature: [], season: {}, weekdays: [], timeOfDay: [] };

/** Demand situation of the current environment (weekday from the date, events active now). */
export function demandContextOf(
  env: Pick<Environment, 'day' | 'season' | 'weather' | 'temperature' | 'activeEvents'>,
  minute: number,
  events: readonly EventDef[] | undefined,
): DemandContext {
  return {
    weather: env.weather.condition,
    temperature: env.temperature,
    season: env.season,
    weekday: dateOfDay(env.day).weekday,
    minute,
    activeEvents: (events ?? []).filter((e) => env.activeEvents.includes(e.id)),
  };
}

/** Temperature from which a resident's 'hot' weather response applies. */
export const HOT_DAY_CELSIUS = 28;

/**
 * Chance of a routine entry today: its own chance plus the visitor bonus of active events and the resident's weather
 * response, clamped to 0..100. Without events and with neutral weather it is the entry's own chance (phase 4 rules).
 */
export function routineChance(
  entry: Pick<RoutineEntry, 'chancePercent'>,
  def: Pick<NpcDef, 'weatherResponse'>,
  env: Pick<Environment, 'weather' | 'temperature' | 'activeEvents'>,
  events: readonly EventDef[] | undefined,
): number {
  let chance = entry.chancePercent;
  for (const e of events ?? []) if (env.activeEvents.includes(e.id)) chance += e.visitorBonus;
  const response = def.weatherResponse;
  if (response) {
    chance += response[env.weather.condition] ?? 0;
    if (env.temperature >= HOT_DAY_CELSIUS) chance += response.hot ?? 0;
  }
  return Math.min(100, Math.max(0, chance));
}

export interface DemandOutlookGroup {
  id: string;
  label: string;
  /**
   * Mean demand of the group's products compared with a usual day of the same season, weekday and time (mild cloudy
   * weather, no event): positive = more than usual. So the outlook shows what weather and events change.
   */
  delta: number;
}

/** The usual day a forecast day is compared with. */
export const NEUTRAL_WEATHER = { weather: 'cloudy', temperature: 18 } as const;

export interface DemandOutlookDay {
  day: number;
  groups: DemandOutlookGroup[];
}

/** Mean demand deltas per display group for a situation (pure). */
export function groupDeltas(products: readonly ProductDef[], config: DemandConfig, ctx: DemandContext): DemandOutlookGroup[] {
  const out: DemandOutlookGroup[] = [];
  for (const g of config.groups ?? []) {
    const members = products.filter((p) => matchesKey(p, g.key));
    if (members.length === 0) continue;
    const usual: DemandContext = { ...ctx, ...NEUTRAL_WEATHER, activeEvents: [] };
    let sum = 0;
    for (const p of members) sum += demandFor(p, config, ctx).value - demandFor(p, config, usual).value;
    out.push({ id: g.id, label: g.label, delta: Math.round(sum / members.length) });
  }
  return out;
}
