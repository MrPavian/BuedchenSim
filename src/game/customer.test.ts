import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_DIALOGUE_ID } from './dialogue';
import { findNpcInteraction, angleBetween } from './interaction';
import { createInitialState } from './state';
import { testPack } from './testing/fixture-pack';
import {
  giveWish,
  mutable,
  newGame,
  openShutter,
  run,
  runUntil,
  setFlag,
  setTime,
  stockShelves,
  summon,
} from './testing/harness';
import { pickWish } from './wishes';
import type { Game } from './game';
import type { ContentPack, NpcDef } from './types';

const STAMM = 'npc.stammkunde';
const KURIER = 'npc.kurier';

/** A game with open shop, stocked shelves and the resident `id` waiting with the given wish in front of the player. */
function waiting(id: string, wishId: string, minute = 540): Game {
  const game = newGame();
  setTime(game, minute);
  openShutter(game);
  stockShelves(game);
  summon(game, id, 'waiting');
  giveWish(game, id, wishId);
  return game;
}

const cash = (game: Game): number => game.state.economy.cashCents;
const shelf = (game: Game, productId: string): number =>
  Object.values(game.state.economy.shelves)
    .filter((s) => s.productId === productId)
    .reduce((n, s) => n + s.quantity, 0);

describe('wish choice', () => {
  const def = testPack.npcs[STAMM] as NpcDef;
  const state = (minute: number, day: number, seed: number) => {
    const s = createInitialState(testPack, seed);
    s.calendar.minute = minute;
    s.calendar.day = day;
    return s;
  };

  it('only offers wishes whose conditions hold', () => {
    expect(pickWish(def, state(500, 1, 1), 1, 'r')?.id).toBe('wish.water');
    expect(pickWish(def, state(1100, 1, 1), 1, 'r')?.id).toBe('wish.beer');
    const big = state(500, 1, 1);
    big.story.flags['test.big-order'] = true;
    expect(pickWish(def, big, 1, 'r')?.id).toBe('wish.stock-out'); // weight 1000 dominates
    expect(pickWish({ ...def, wishes: [] }, state(500, 1, 1), 1, 'r')).toBeNull();
    expect(pickWish({ ...def, wishes: undefined }, state(500, 1, 1), 1, 'r')).toBeNull();
  });

  it('is deterministic for the same seed, day and routine, and varies across days', () => {
    const two: NpcDef = {
      ...def,
      wishes: [
        { id: 'wish.a', lines: [{ productId: 'product.test-water', quantity: 1 }], text: 'a' },
        { id: 'wish.b', lines: [{ productId: 'product.test-water', quantity: 2 }], text: 'b' },
      ],
    };
    const picks = (seed: number) => Array.from({ length: 40 }, (_, i) => pickWish(two, state(500, i + 1, seed), seed, 'r')?.id);
    expect(picks(3)).toEqual(picks(3));
    expect(new Set(picks(3))).toEqual(new Set(['wish.a', 'wish.b']));
    expect(picks(3)).not.toEqual(picks(4));
    // weights shift the share
    const heavy: NpcDef = { ...two, wishes: [{ ...(two.wishes?.[0] as object), weight: 9 } as never, two.wishes?.[1] as never] };
    const share = Array.from({ length: 400 }, (_, i) => pickWish(heavy, state(500, i + 1, 3), 3, 'r')?.id).filter((x) => x === 'wish.a').length / 400;
    expect(share).toBeGreaterThan(0.8);
  });
});

describe('customer flow', () => {
  it('walks to the window, expresses the wish (signal), is served once and leaves', () => {
    const game = newGame();
    openShutter(game);
    stockShelves(game);
    const wishes = vi.fn();
    const sales = vi.fn();
    game.signals.on('npc.wish', wishes);
    game.signals.on('sale.completed', sales);
    setTime(game, 479.9);
    expect(runUntil(game, () => game.npcs.get(STAMM)?.hasWish === true, 200)).toBe(true);
    expect(wishes).toHaveBeenCalledWith({ npcId: STAMM, wishId: 'wish.water' });
    // go to the register side of the counter: 1.6 m from the customer
    game.player.setPose({ x: -1.6, z: 0.95 }, 0);
    expect(game.getInteractionTarget()).toMatchObject({ kind: 'npc', npcId: STAMM });

    const cashBefore = cash(game);
    const waterBefore = shelf(game, 'product.test-water');
    expect(game.interact()).toEqual({ ok: true });
    const view = game.dialogue.current();
    expect(view).toMatchObject({ npcId: STAMM, dialogueId: CUSTOMER_DIALOGUE_ID, nodeId: 'offer', text: 'Zwei Wasser, bitte.' });
    expect(view?.options.map((o) => o.id)).toEqual(['sell', 'decline']); // no ID check: nothing restricted
    expect(view?.customer).toMatchObject({ wishId: 'wish.water', totalCents: 200, minimumAge: null, stage: 'offer' });

    const result = game.dialogue.choose('sell');
    expect(result).toMatchObject({ ok: true, ended: false });
    expect(cash(game)).toBe(cashBefore + 200);
    expect(shelf(game, 'product.test-water')).toBe(waterBefore - 2);
    const sale = game.state.economy.transactions.at(-1);
    expect(sale).toMatchObject({ kind: 'sale', totalCents: 200, npcId: STAMM });
    expect(sales).toHaveBeenCalledTimes(1);
    expect(sales).toHaveBeenCalledWith({ transactionId: sale?.id, totalCents: 200, npcId: STAMM });
    expect(game.state.npcs[STAMM]?.wish?.resolved).toBe('sold');
    expect(game.state.npcs[STAMM]?.memories).toContain('served:wish.water');
    expect(game.state.npcs[STAMM]?.relationship).toBe(30 + 1 + 2); // greeting + content effect of the wish
    expect(game.dialogue.current()).toMatchObject({ nodeId: 'sold', text: 'Danke.' });
    expect(game.dialogue.current()?.options).toEqual([{ id: 'close', text: 'Tschüss.' }]);

    // double triggering: repeated choose / interact / frames can never pay twice
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'wish_already_resolved' });
    expect(game.dialogue.choose('decline')).toEqual({ ok: false, reason: 'wish_already_resolved' });
    expect(game.interact()).toEqual({ ok: false, reason: 'dialogue_already_open' });
    run(game, 0.5);
    expect(cash(game)).toBe(cashBefore + 200);
    expect(game.state.economy.transactions.filter((t) => t.kind === 'sale')).toHaveLength(1);

    expect(game.dialogue.choose('close')).toEqual({ ok: true, ended: true });
    expect(game.state.npcs[STAMM]?.status).toBe('walking'); // heads home
    expect(game.npcs.get(STAMM)?.hasWish).toBe(false);
    expect(game.npcs.talk(STAMM)).toMatchObject({ ok: true }); // can still be greeted on the way
    game.dialogue.close();
    expect(runUntil(game, () => game.state.npcs[STAMM]?.status === 'away', 200)).toBe(true);
    expect(game.state.npcs[STAMM]?.wish).toBeNull();
    expect(shelf(game, 'product.test-water')).toBe(waterBefore - 2);
    // it does not come back for a second wish the same day (routine done)
    run(game, 20);
    expect(game.state.npcs[STAMM]?.status).toBe('away');
  });

  it('declining resolves the wish: memory, leaves, no sale', () => {
    const game = waiting(STAMM, 'wish.water');
    game.npcs.talk(STAMM);
    const cashBefore = cash(game);
    expect(game.dialogue.choose('decline')).toEqual({ ok: true, ended: false });
    expect(game.dialogue.current()).toMatchObject({ nodeId: 'declined', text: 'Schade.' });
    expect(game.state.npcs[STAMM]?.wish?.resolved).toBe('declined');
    expect(game.state.npcs[STAMM]?.memories).toContain('declined:wish.water');
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'wish_already_resolved' });
    game.dialogue.choose('close');
    expect(cash(game)).toBe(cashBefore);
    expect(game.state.economy.transactions).toHaveLength(0);
    expect(game.state.npcs[STAMM]?.status).toBe('walking');
  });

  it('a failed sale keeps the wish open, shows the reason and allows declining', () => {
    const game = waiting(STAMM, 'wish.stock-out');
    game.npcs.talk(STAMM);
    const result = game.dialogue.choose('sell');
    expect(result).toEqual({ ok: false, reason: 'insufficient_stock' });
    expect(game.dialogue.current()).toMatchObject({ nodeId: 'offer', text: 'Nicht genug da.' });
    expect(game.dialogue.current()?.customer?.failureReason).toBe('insufficient_stock');
    expect(game.state.npcs[STAMM]?.wish?.resolved).toBeNull();
    expect(game.state.economy.transactions).toHaveLength(0);
    expect(game.dialogue.choose('decline')).toMatchObject({ ok: true });
    expect(game.state.npcs[STAMM]?.wish?.resolved).toBe('declined');
  });

  it('reasons without a specific line use the fallback; a closed shutter rejects the sale', () => {
    const game = waiting(STAMM, 'wish.water');
    mutable(game).kiosk.shutterOpen = false;
    game.npcs.talk(STAMM);
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'kiosk_closed' });
    expect(game.dialogue.current()?.text).toBe('Geht nicht.');
    mutable(game).kiosk.shutterOpen = true;
    expect(game.dialogue.choose('sell')).toMatchObject({ ok: true });
  });

  it('closing the conversation keeps an unresolved wish open and the resident waiting', () => {
    const game = waiting(STAMM, 'wish.water');
    game.npcs.talk(STAMM);
    game.dialogue.close();
    expect(game.state.npcs[STAMM]?.status).toBe('waiting');
    expect(game.npcs.get(STAMM)?.hasWish).toBe(true);
    expect(game.npcs.talk(STAMM)).toEqual({ ok: true });
    expect(game.dialogue.current()?.dialogueId).toBe(CUSTOMER_DIALOGUE_ID);
  });

  it('a customer who is not served before its window ends leaves with the memory ignored:<wish>', () => {
    const game = newGame();
    openShutter(game);
    setTime(game, 586);
    expect(runUntil(game, () => game.npcs.get(STAMM)?.hasWish === true, 100)).toBe(true);
    expect(runUntil(game, () => game.state.npcs[STAMM]?.status === 'away', 200)).toBe(true);
    expect(game.state.npcs[STAMM]?.memories).toContain('ignored:wish.water');
  });

  it('chooses the same wish for the same seed and day (reload gives the same decision)', () => {
    const wishOf = (seed: number) => {
      const game = newGame(seed);
      openShutter(game);
      setTime(game, 1090);
      mutable(game).calendar.speed = 4;
      expect(runUntil(game, () => game.npcs.get(STAMM)?.hasWish === true, 200)).toBe(true);
      return game.state.npcs[STAMM]?.wish?.wishId;
    };
    expect(wishOf(11)).toBe('wish.beer'); // the only wish valid in the evening
    expect(wishOf(11)).toBe(wishOf(11));
  });
});

describe('age rules of resident customers', () => {
  it('an adult needs the ID check for 16+ goods; checkId reveals the age', () => {
    const game = waiting(STAMM, 'wish.beer', 1100);
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.options.map((o) => o.id)).toEqual(['sell', 'checkId', 'decline']);
    expect(game.dialogue.current()?.customer).toMatchObject({ minimumAge: 16, ageChecked: false, revealedAge: null });
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'age_check_required' });
    expect(game.dialogue.current()?.text).toBe('Erst der Ausweis.');
    expect(game.dialogue.choose('checkId')).toMatchObject({ ok: true });
    expect(game.dialogue.current()?.text).toBe('Bitte. Ich bin 64.');
    expect(game.dialogue.current()?.customer).toMatchObject({ ageChecked: true, revealedAge: 64 });
    expect(game.dialogue.current()?.options.map((o) => o.id)).toEqual(['sell', 'decline']);
    expect(game.dialogue.choose('checkId')).toEqual({ ok: false, reason: 'option_unavailable' });
    const cashBefore = cash(game);
    expect(game.dialogue.choose('sell')).toMatchObject({ ok: true });
    expect(cash(game)).toBe(cashBefore + 150);
    expect(game.state.economy.transactions.at(-1)?.npcId).toBe(STAMM);
  });

  it('a 17-year-old can buy 16+ goods after the check but never the 18+ product, even with the check', () => {
    const beer = waiting(KURIER, 'wish.kurier-beer');
    beer.npcs.talk(KURIER);
    beer.dialogue.choose('checkId');
    expect(beer.dialogue.current()?.customer?.revealedAge).toBe(17);
    expect(beer.dialogue.choose('sell')).toMatchObject({ ok: true }); // 17 >= 16

    const tobacco = waiting(KURIER, 'wish.kurier-tobacco');
    tobacco.npcs.talk(KURIER);
    expect(tobacco.dialogue.current()?.customer?.minimumAge).toBe(18);
    expect(tobacco.dialogue.choose('sell')).toEqual({ ok: false, reason: 'age_check_required' });
    tobacco.dialogue.choose('checkId');
    const cashBefore = cash(tobacco);
    for (let i = 0; i < 3; i += 1) {
      expect(tobacco.dialogue.choose('sell')).toEqual({ ok: false, reason: 'customer_underage' });
    }
    expect(tobacco.dialogue.current()?.text).toBe('Das darf ich dir nicht geben.');
    expect(cash(tobacco)).toBe(cashBefore);
    expect(shelf(tobacco, 'product.test-tobacco')).toBe(5);
    expect(tobacco.state.economy.transactions).toHaveLength(0);
    expect(tobacco.state.npcs[KURIER]?.wish?.resolved).toBeNull();
    expect(tobacco.dialogue.choose('decline')).toMatchObject({ ok: true });
  });

  it('economy.completeSale rejects unknown customers and the underage even with a confirmed ID', () => {
    const game = newGame();
    openShutter(game);
    stockShelves(game);
    const tobacco = [{ productId: 'product.test-tobacco', quantity: 1 }];
    expect(game.economy.completeSale({ lines: tobacco, ageCheckConfirmed: true, customer: { npcId: 'npc.nobody' } })).toEqual({
      ok: false,
      reason: 'unknown_customer',
    });
    expect(game.economy.completeSale({ lines: tobacco, ageCheckConfirmed: true, customer: { npcId: KURIER } })).toEqual({
      ok: false,
      reason: 'customer_underage',
    });
    expect(game.economy.completeSale({ lines: tobacco, ageCheckConfirmed: false, customer: { npcId: STAMM } })).toEqual({
      ok: false,
      reason: 'age_check_required',
    });
    const ok = game.economy.completeSale({ lines: tobacco, ageCheckConfirmed: true, customer: { npcId: STAMM } });
    expect(ok).toMatchObject({ ok: true, transaction: { npcId: STAMM } });
    // unrestricted goods need no confirmation for a resident either
    expect(
      game.economy.completeSale({ lines: [{ productId: 'product.test-water', quantity: 1 }], ageCheckConfirmed: false, customer: { npcId: KURIER } }),
    ).toMatchObject({ ok: true });
  });

  it('the till sale of the player is unchanged: no npcId, same signal payload, player confirmation still enough', () => {
    const game = newGame();
    openShutter(game);
    stockShelves(game);
    const sales = vi.fn();
    game.signals.on('sale.completed', sales);
    const result = game.economy.completeSale({ lines: [{ productId: 'product.test-beer', quantity: 1 }], ageCheckConfirmed: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('npcId' in result.transaction).toBe(false);
      expect(sales).toHaveBeenCalledWith({ transactionId: result.transaction.id, totalCents: 150 });
    }
    expect(game.economy.completeSale({ lines: [{ productId: 'product.test-beer', quantity: 1 }], ageCheckConfirmed: false })).toEqual({
      ok: false,
      reason: 'age_check_required',
    });
  });
});

describe('customer effects inside content dialogues', () => {
  function pack(): ContentPack {
    const p: ContentPack = structuredClone(testPack);
    p.dialogues['dialogue.stammkunde.greeting'] = {
      id: 'dialogue.stammkunde.greeting',
      npcId: STAMM,
      priority: 1,
      start: 'a',
      nodes: {
        a: {
          text: 'Na?',
          options: [
            {
              id: 'serve',
              text: 'Hier.',
              effects: [
                { type: 'setFlag', id: 'test.served', value: true },
                { type: 'sellWish' },
              ],
            },
          ],
        },
      },
    };
    p.npcs[STAMM] = { ...(p.npcs[STAMM] as NpcDef), dialogueIds: ['dialogue.stammkunde.greeting'] };
    return p;
  }

  it('a failing customer effect aborts the option before any other effect is applied', () => {
    const game = newGame(7, pack());
    summon(game, STAMM);
    game.npcs.talk(STAMM);
    expect(game.dialogue.choose('serve')).toEqual({ ok: false, reason: 'no_wish' });
    expect(game.state.story.flags['test.served']).toBeUndefined();
    expect(game.dialogue.current()?.nodeId).toBe('a');
  });

  it('a successful one sells once and applies the rest', () => {
    const game = newGame(7, pack());
    setTime(game, 540);
    openShutter(game);
    stockShelves(game);
    summon(game, STAMM);
    giveWish(game, STAMM, 'wish.water');
    mutable(game).npcs[STAMM]!.status = 'at_place'; // not 'waiting': the content dialogue is used, not the built-in flow
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.greeting');
    expect(game.dialogue.choose('serve')).toMatchObject({ ok: true, ended: true, transaction: { npcId: STAMM } });
    expect(game.state.story.flags['test.served']).toBe(true);
    expect(game.state.economy.transactions.filter((t) => t.kind === 'sale')).toHaveLength(1);
  });
});

describe('pure interaction helpers', () => {
  it('angleBetween wraps around', () => {
    expect(angleBetween(0, 0)).toBe(0);
    expect(angleBetween(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleBetween(7, 7 - 2 * Math.PI)).toBeCloseTo(0);
  });

  it('findNpcInteraction takes the nearest faced resident in list order for ties', () => {
    const npcs = {
      a: { status: 'at_place', position: { x: 0, z: 1 } },
      b: { status: 'at_place', position: { x: 0, z: 1 } },
      c: { status: 'away', position: { x: 0, z: 0.5 } },
    };
    expect(findNpcInteraction(['a', 'b', 'c'], npcs, { position: { x: 0, z: 0 }, heading: 0 })).toMatchObject({ npcId: 'a' });
    expect(findNpcInteraction(['c'], npcs, { position: { x: 0, z: 0 }, heading: 0 })).toBeNull();
    expect(findNpcInteraction(['a'], npcs, { position: { x: 0, z: 0 }, heading: Math.PI })).toBeNull();
    expect(findNpcInteraction(['a'], npcs, { position: { x: 0, z: 1 }, heading: Math.PI })).toMatchObject({ npcId: 'a' }); // on top of it
  });
});

describe('shop flags', () => {
  it('flags decide which wish the courier voices (conditions on wishes)', () => {
    const game = newGame();
    openShutter(game);
    setFlag(game, 'test.kurier-tobacco');
    setTime(game, 539.9);
    expect(runUntil(game, () => game.npcs.get(KURIER)?.hasWish === true, 200)).toBe(true);
    expect(game.state.npcs[KURIER]?.wish?.wishId).toBe('wish.kurier-tobacco');
  });
});
