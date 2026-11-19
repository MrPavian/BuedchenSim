import { describe, expect, it } from 'vitest';
import { evaluateCondition } from './conditions';
import { CURRENT_SCHEMA_VERSION, parseSave, serializeSave } from './save/save';
import { createInitialState } from './state';
import { STREET } from './street';
import { mutable, newGame, openShutter, setTime } from './testing/harness';
import type { Game } from './game';

/** Cleanliness in front of the kiosk (Auftrag 06, 6.6). */

function sellMany(game: Game, n: number): void {
  const state = mutable(game);
  openShutter(game);
  const productId = Object.keys(game.content.products)[0] ?? '';
  for (let i = 0; i < n; i += 1) {
    const slot = game.content.stockSlots.find((s) => s.accepts === game.content.products[productId]?.storage);
    if (!slot) throw new Error('no slot');
    state.economy.shelves[slot.id] = { productId, quantity: 5 };
    const result = game.economy.completeSale({ lines: [{ productId, quantity: 1 }], ageCheckConfirmed: true });
    expect(result.ok).toBe(true);
  }
}

describe('street cleanliness', () => {
  it('starts clean; sales fill the bin; a full bin spills onto the sidewalk', () => {
    const game = newGame(7);
    setTime(game, 10 * 60, 1);
    expect(game.state.street).toEqual({ binFill: 0, litter: 0 });
    sellMany(game, 10);
    const afterTen = game.state.street;
    expect(afterTen.binFill).toBeGreaterThan(0);
    expect(afterTen.binFill % STREET.binPerItem).toBe(0);
    sellMany(game, 60);
    expect(game.state.street.binFill).toBeGreaterThan(100 - STREET.binPerItem);
    expect(game.state.street.litter).toBeGreaterThan(0);
    expect(game.state.street.litter).toBeLessThanOrEqual(100);
  });

  it('is deterministic for the same seed and sales', () => {
    const run = (): unknown => {
      const game = newGame(7);
      setTime(game, 10 * 60, 1);
      sellMany(game, 30);
      return game.state.street;
    };
    expect(run()).toEqual(run());
  });

  it('the street cleaning removes rubbish overnight; the bin stays full', () => {
    const game = newGame(7);
    const state = mutable(game);
    state.street = { binFill: 100, litter: 40 };
    state.calendar.phase = 'closed';
    expect(game.calendar.startNextDay()).toEqual({ ok: true });
    expect(state.calendar.day).toBe(2);
    expect(game.state.street).toEqual({ binFill: 100, litter: 40 - STREET.nightCleaning });
  });

  it('the player empties the bin and sweeps at the bin interaction point', () => {
    const game = newGame(7);
    const state = mutable(game);
    state.street = { binFill: 90, litter: 30 };
    const point = { id: 'interaction.bin', kind: 'bin' as const, position: { x: 4, z: 3 }, radius: 1 };
    (game.content.layout.interactionPoints as unknown as typeof point[]).push(point);
    expect(game.player.setPose({ x: 4, z: 3.2 }, 0)).toEqual({ ok: true });
    expect(game.getAvailableInteraction()?.action).toBe('bin.clean');
    expect(game.interact()).toEqual({ ok: true });
    expect(game.state.street).toEqual({ binFill: 0, litter: 0 });
    (game.content.layout.interactionPoints as unknown as typeof point[]).pop();
  });

  it('condition litterAtLeast', () => {
    const state = createInitialState(newGame(1).content);
    state.street.litter = 40;
    expect(evaluateCondition({ type: 'litterAtLeast', value: 35 }, state)).toBe(true);
    expect(evaluateCondition({ type: 'litterAtLeast', value: 45 }, state)).toBe(false);
  });
});

describe('schema version 5 (street)', () => {
  it('is the current version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('4 -> 5 adds a clean street and keeps everything else', () => {
    const content = newGame(1).content;
    const state = createInitialState(content);
    state.calendar.day = 9;
    const v4 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete v4['street'];
    const result = parseSave(JSON.stringify({ schemaVersion: 4, savedAt: '2026-11-19T10:00:00.000Z', state: v4 }), content);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.state.calendar.day).toBe(9);
    expect(result.state.street).toEqual({ binFill: 0, litter: 0 });
  });

  it('roundtrips the street and rejects values out of range', () => {
    const content = newGame(1).content;
    const state = createInitialState(content);
    state.street = { binFill: 64, litter: 21 };
    const ok = parseSave(serializeSave(state), content);
    expect(ok.status === 'ok' && ok.state.street).toEqual({ binFill: 64, litter: 21 });
    state.street = { binFill: 140, litter: 0 };
    expect(parseSave(serializeSave(state), content).status).toBe('corrupt');
  });
});
