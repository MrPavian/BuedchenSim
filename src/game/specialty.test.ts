import { describe, expect, it } from 'vitest';
import { batchQuality } from './specialty';
import { mutable, newGame, openShutter, setTime } from './testing/harness';
import { CUSTOMER, FRIKA, MASSE, ONION, recipe, specialty, specialtyPack as pack } from './testing/specialtyPack';
import type { ContentPack } from './types';
import type { Game } from './game';

function setup(): Game {
  const game = newGame(7, pack);
  setTime(game, 10 * 60, 1);
  const storage = mutable(game).economy.storage;
  storage[MASSE] = 3;
  storage['product.test-water'] = 10;
  storage[ONION] = 1;
  return game;
}

/** Advances game minutes by setting the clock and ticking once (the production only looks at the clock). */
function advance(game: Game, minutes: number): void {
  mutable(game).calendar.minute += minutes;
  game.tick(1 / 60);
}

function produce(game: Game, batches = 1, optional = false): void {
  expect(game.specialty.startProduction(specialty.id, batches, optional)).toEqual({ ok: true });
  advance(game, recipe.minutesPerBatch * batches);
}

/** Moves finished units to the counter and sells `units` to the resident (one per sale). */
/** Sells `units` one by one to the resident, or to passers-by at the till (`null`). */
function sellTo(game: Game, units: number, npcId: string | null = CUSTOMER): void {
  const state = mutable(game);
  openShutter(game);
  for (let i = 0; i < units; i += 1) {
    const held = state.economy.storage[FRIKA] ?? 0;
    if (held > 0) {
      state.economy.shelves['slot.counter-top'] = { productId: FRIKA, quantity: (state.economy.shelves['slot.counter-top']?.quantity ?? 0) + held };
      delete state.economy.storage[FRIKA];
    }
    const result = game.economy.completeSale({ lines: [{ productId: FRIKA, quantity: 1 }], ageCheckConfirmed: false, ...(npcId ? { customer: { npcId } } : {}) });
    expect(result.ok).toBe(true);
  }
}

describe('specialty production', () => {
  it('needs the ingredients, consumes them at the start and delivers the units only after the production time', () => {
    const game = setup();
    const state = mutable(game);
    expect(game.specialty.startProduction(specialty.id, 4, false)).toEqual({ ok: false, reason: 'invalid_batches' });
    expect(game.specialty.startProduction(specialty.id, 2, false)).toEqual({ ok: true });
    expect(state.economy.storage[MASSE]).toBe(1);
    expect(state.economy.storage['product.test-water']).toBe(6);
    expect(state.economy.storage[ONION]).toBe(1); // optional not chosen
    expect(game.specialty.startProduction(specialty.id, 1, false)).toEqual({ ok: false, reason: 'production_running' });
    advance(game, 79);
    expect(state.economy.storage[FRIKA]).toBeUndefined();
    advance(game, 1);
    expect(state.economy.storage[FRIKA]).toBe(12);
    const s = state.specialties[specialty.id];
    expect(s?.production).toBeNull();
    expect(s?.stage).toBe(1);
    expect(s?.batchesProduced).toBe(2);
    expect(state.story.flags['test.tried']).toBe(true);
  });

  it('the finished product cannot be ordered from the supplier; the ingredients can', () => {
    const game = setup();
    expect(game.economy.placeOrder([{ productId: FRIKA, quantity: 6 }])).toEqual({ ok: false, reason: 'not_orderable' });
    expect(game.economy.placeOrder([{ productId: MASSE, quantity: 1 }])).toEqual({ ok: true });
  });

  it('refuses without ingredients and when the day is not open', () => {
    const game = setup();
    delete mutable(game).economy.storage[MASSE];
    expect(game.specialty.startProduction(specialty.id, 1, false)).toEqual({ ok: false, reason: 'missing_ingredients' });
    const g2 = setup();
    mutable(g2).calendar.phase = 'closed';
    expect(g2.specialty.startProduction(specialty.id, 1, false)).toEqual({ ok: false, reason: 'day_not_open' });
    expect(mutable(g2).economy.storage[MASSE]).toBe(3);
  });

  it('quality comes from recipe level, optional ingredients and practice (capped)', () => {
    expect(batchQuality(recipe, 1, 0, 0)).toBe(48);
    expect(batchQuality(recipe, 1, 0, 8)).toBe(56);
    expect(batchQuality(recipe, 2, 0, 0)).toBe(60);
    expect(batchQuality(recipe, 1, 100, 0)).toBe(58);
    expect(batchQuality(recipe, 9, 100, 50)).toBe(100);
    const game = setup();
    expect(game.specialty.startProduction(specialty.id, 1, true)).toEqual({ ok: true });
    expect(mutable(game).economy.storage[ONION]).toBeUndefined();
    expect(mutable(game).specialties[specialty.id]?.production?.quality).toBe(56);
  });
});

describe('specialty sales, fame and stages', () => {
  it('a sale goes through the normal economy and gives feedback from the resident', () => {
    const game = setup();
    produce(game);
    const before = game.state.economy.today.revenueCents;
    sellTo(game, 1);
    expect(game.state.economy.today.revenueCents - before).toBe(290);
    const s = game.state.specialties[specialty.id];
    expect(s?.sold).toBe(1);
    expect(s?.ratings).toBe(1);
    expect(s?.buyers[CUSTOMER]).toBe(1);
    expect(s?.feedback[0]?.npcId).toBe(CUSTOMER);
    expect(game.state.npcs[CUSTOMER]?.memories).toContain('probiert:test-frika');
    expect(s?.feedback[0]?.text).toMatch(/: /);
  });

  it('a good product becomes a Geheimtipp and then cult; the stage flags are set', () => {
    const game = setup();
    const state = mutable(game);
    const npc = state.npcs[CUSTOMER];
    if (!npc) throw new Error('npc');
    npc.relationship = 80;
    state.economy.storage[MASSE] = 20;
    state.economy.storage['product.test-water'] = 60;
    state.economy.storage[ONION] = 20;
    // First attempts, with onions: enough for an insider tip, not for cult status.
    produce(game, 2, true);
    sellTo(game, 12);
    const s = state.specialties[specialty.id];
    expect(s?.stage).toBe(2);
    expect(s?.recipeLevel).toBe(2);
    expect(state.story.flags['test.sign']).toBe(true);
    expect(state.story.flags['test.cult']).toBeUndefined();
    // The better recipe (level 2) and practice lift the quality; regular buying makes it cult.
    produce(game, 2, true);
    produce(game, 2, true);
    sellTo(game, 24);
    expect(s?.stage).toBe(3);
    expect(s?.recipeLevel).toBe(3);
    expect(state.story.flags['test.sign']).toBe(true);
    expect(state.story.flags['test.cult']).toBe(true);
    expect(s?.recommendations).toBe(1);
    expect(state.npcs[CUSTOMER]?.memories).toContain('empfiehlt:test-frika');
  });

  it('a poor product never reaches cult status, however much is sold', () => {
    const poor: ContentPack = { ...pack, recipes: [{ ...recipe, quality: { base: 20, perLevel: 0, practicePerBatch: 0, practiceCap: 0 } }] };
    const game = newGame(7, poor);
    setTime(game, 10 * 60, 1);
    const state = mutable(game);
    state.economy.storage[MASSE] = 20;
    state.economy.storage['product.test-water'] = 60;
    const npc = state.npcs[CUSTOMER];
    if (!npc) throw new Error('npc');
    npc.relationship = 100;
    for (let i = 0; i < 8; i += 1) produce(game, 1, false);
    sellTo(game, 24);
    sellTo(game, 24, null);
    const s = state.specialties[specialty.id];
    expect(s?.sold).toBe(48);
    expect(s?.stage).toBe(1);
    expect(state.story.flags['test.cult']).toBeUndefined();
    expect(state.story.flags['test.sign']).toBeUndefined();
  });

  it('sales alone do not make it famous: passers-by add little', () => {
    const game = setup();
    const state = mutable(game);
    state.economy.storage[MASSE] = 20;
    state.economy.storage['product.test-water'] = 60;
    for (let i = 0; i < 6; i += 1) produce(game, 1, false);
    sellTo(game, 30, null);
    const s = state.specialties[specialty.id];
    expect(s?.stage).toBe(1); // no ratings, no repeat buyers
    expect(s?.fame).toBeLessThan(30);
  });

  it('is deterministic for the same seed and inputs', () => {
    const run = (): unknown => {
      const game = setup();
      produce(game);
      sellTo(game, 5);
      return game.state.specialties[specialty.id];
    };
    expect(run()).toEqual(run());
  });
});
