import { describe, expect, it } from 'vitest';
import { dayOfDate } from '../game/date';
import { createGame } from '../game/game';
import { createInitialState } from '../game/state';
import { ruhrgebietPack } from './regions/ruhrgebiet';

describe('demand of the Ruhr kiosk', () => {
  it('reacts to heat, rain, events, weekday and time of day', () => {
    const product = (id: string) => ruhrgebietPack.products[id]!;
    const game = createGame(ruhrgebietPack, undefined, 3);
    const ice = game.demand.forProduct('product.eiskumpel-stieleis-himbeere')!;
    expect(ice.base).toBe(50);
    // Find a hot sunny day and a heavy-rain day of this seed and compare the ice demand.
    const find = (pred: (d: number) => boolean) => {
      for (let d = 1; d < 400; d++) if (pred(d)) return d;
      throw new Error('no such day');
    };
    const hot = find((d) => game.weather.onDay(d).high >= 30);
    const wet = find((d) => game.weather.onDay(d).condition === 'heavy-rain' && game.weather.onDay(d).high < 22);
    const at = (day: number, minute: number) => {
      const s = createInitialState(ruhrgebietPack, 3);
      s.calendar.day = day;
      s.calendar.minute = minute;
      game.load(s);
    };
    at(hot, 900);
    const iceHot = game.demand.forProduct('product.eiskumpel-stieleis-himbeere')!.value;
    at(wet, 900);
    const iceWet = game.demand.forProduct('product.eiskumpel-stieleis-himbeere')!.value;
    const paperWet = game.demand.forProduct('product.halden-echo-lokalblatt')!.value;
    expect(iceHot).toBeGreaterThan(iceWet + 20);
    expect(paperWet).toBeGreaterThan(50);
    // Home game: beer demand up while active, back to normal afterwards (effects end with the event).
    const homeGame = dayOfDate({ year: 2027, month: 6, dayOfMonth: 12 });
    at(homeGame, 780);
    const beerGame = game.demand.forProduct('product.puettbraeu-pils')!;
    at(homeGame, 1260);
    const beerAfter = game.demand.forProduct('product.puettbraeu-pils')!;
    expect(beerGame.events).toBeGreaterThan(0);
    expect(beerAfter.events).toBe(0);
    expect(product('product.puettbraeu-pils').demandTags).toContain('matchday');
  });

  it('the calendar outlook flags the home game and stays the same when asked twice', () => {
    const game = createGame(ruhrgebietPack, undefined, 3);
    const outlook = game.demand.outlook();
    expect(outlook).toHaveLength(7);
    const saturday = outlook.find((d) => d.day === dayOfDate({ year: 2027, month: 6, dayOfMonth: 12 }))!;
    expect(saturday.groups.find((g) => g.id === 'beer')!.delta).toBeGreaterThan(15);
    expect(game.demand.outlook()).toEqual(outlook);
  });

  it('never sells by itself: a whole day with customers but no player leaves cash, stock and transactions unchanged', () => {
    const game = createGame(ruhrgebietPack, undefined, 3);
    const s = createInitialState(ruhrgebietPack, 3);
    s.kiosk.shutterOpen = true;
    s.economy.storage = { 'product.puettbraeu-pils': 20 };
    s.calendar.day = dayOfDate({ year: 2027, month: 6, dayOfMonth: 12 }); // busy home game day
    game.load(s);
    for (let i = 0; i < 2000 && game.state.calendar.phase === 'open'; i++) game.tick(0.5);
    expect(game.state.economy.transactions).toHaveLength(0);
    expect(game.state.economy.cashCents).toBe(s.economy.cashCents);
    expect(game.state.economy.storage).toEqual({ 'product.puettbraeu-pils': 20 });
  });
});
