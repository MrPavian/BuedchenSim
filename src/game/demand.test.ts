import { describe, expect, it } from 'vitest';
import { demandFor, routineChance, wishDemandFactor, type DemandConfig, type DemandContext } from './demand';
import type { EventDef } from './eventCalendar';

const config: DemandConfig = {
  base: 50,
  min: 5,
  max: 100,
  weather: { sunny: { 'category:icecream': 10 }, 'heavy-rain': { 'category:icecream': -20, 'category:press': 8 } },
  temperature: [{ key: 'tag:cold', above: 22, perDegree: 2, cap: 20 }],
  season: { winter: { 'category:icecream': -12 } },
  weekdays: [{ days: [5, 6], bonus: { 'tag:weekend': 10 } }],
  timeOfDay: [{ from: 360, to: 660, bonus: { 'tag:morning': 15 } }],
};
const ice = { id: 'product.ice', category: 'icecream' as const, demandTags: ['cold', 'weekend'] };
const paper = { id: 'product.paper', category: 'press' as const, demandTags: ['morning'] };
const ctx = (patch: Partial<DemandContext> = {}): DemandContext => ({
  weather: 'cloudy', temperature: 18, season: 'summer', weekday: 2, minute: 720, activeEvents: [], ...patch,
});
const party: EventDef = {
  id: 'event.party', name: 'Party', description: 'x', schedule: { kind: 'dateRange', from: { month: 1, dayOfMonth: 1 }, to: { month: 1, dayOfMonth: 1 } },
  announceDays: 0, productGroups: [], demand: { 'category:icecream': 30 }, visitorBonus: 15,
};

describe('demand D = clamp(B + W + E + S + T)', () => {
  it('adds each factor once and reports the parts', () => {
    expect(demandFor(ice, config, ctx())).toEqual({ value: 50, base: 50, weather: 0, events: 0, season: 0, time: 0 });
    expect(demandFor(ice, config, ctx({ weather: 'sunny', temperature: 30 })).weather).toBe(10 + 16);
    expect(demandFor(ice, config, ctx({ activeEvents: [party] })).events).toBe(30);
    expect(demandFor(ice, config, ctx({ season: 'winter', weekday: 6 })).season).toBe(-12 + 10);
    expect(demandFor(paper, config, ctx({ minute: 400 })).time).toBe(15);
    expect(demandFor(paper, config, ctx({ weather: 'heavy-rain' })).value).toBe(58);
  });

  it('is bounded: never below min, never above max (no runaway multiplication)', () => {
    const cold = ctx({ weather: 'heavy-rain', season: 'winter' });
    expect(demandFor(ice, { ...config, base: 10 }, cold).value).toBe(5);
    const hot = ctx({ weather: 'sunny', temperature: 40, activeEvents: [party, party], weekday: 6 });
    expect(demandFor(ice, config, hot).value).toBe(100);
  });

  it('turns into a bounded weight factor for wishes', () => {
    expect(wishDemandFactor([ice], config, ctx())).toBe(1);
    expect(wishDemandFactor([ice], config, ctx({ activeEvents: [party] }))).toBeCloseTo(1.6);
    expect(wishDemandFactor([ice, paper], config, ctx({ weather: 'heavy-rain' }))).toBeCloseTo((30 + 58) / 2 / 50);
    expect(wishDemandFactor([], config, ctx())).toBe(1);
  });

  it('routine chance: own chance plus event visitors and the resident’s weather response, clamped', () => {
    const env = (condition: 'sunny' | 'heavy-rain', temperature = 18, activeEvents: string[] = []) => ({
      weather: { day: 1, condition, low: 10, high: 20, anomaly: 0 }, temperature, activeEvents,
    });
    const entry = { chancePercent: 70 };
    expect(routineChance(entry, {}, env('sunny'), [party])).toBe(70);
    expect(routineChance(entry, {}, env('sunny', 18, ['event.party']), [party])).toBe(85);
    const knee = { weatherResponse: { 'heavy-rain': -30, hot: -15 } };
    expect(routineChance(entry, knee, env('heavy-rain'), [])).toBe(40);
    expect(routineChance(entry, knee, env('sunny', 31), [])).toBe(55);
    expect(routineChance({ chancePercent: 95 }, {}, env('sunny', 18, ['event.party']), [party])).toBe(100);
    expect(routineChance({ chancePercent: 10 }, knee, env('heavy-rain'), [])).toBe(0);
  });
});
