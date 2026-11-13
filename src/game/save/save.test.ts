import { describe, expect, it, vi } from 'vitest';
import { setLogSink } from '../../core/log';
import { testPack } from '../testing/fixture-pack';
import { createGame } from '../game';
import { createInitialState } from '../state';
import {
  CURRENT_SCHEMA_VERSION,
  createSaveStore,
  parseSave,
  serializeSave,
  type KeyValueStore,
} from './save';

const content = testPack;

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function saveJson(overrides: Record<string, unknown> = {}, stateOverrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: '2026-11-11T10:00:00.000Z',
    state: { ...createInitialState(content), ...stateOverrides },
    ...overrides,
  });
}

describe('serialize / parse', () => {
  it('roundtrips the state', () => {
    const state = createInitialState(content);
    state.player.position = { x: 2.5, z: 1.25 };
    state.player.heading = -1.5;
    state.kiosk.doorOpen = true;
    const result = parseSave(serializeSave(state, new Date('2026-01-02T03:04:05Z')), content);
    expect(result).toEqual({ status: 'ok', state });
  });

  it('writes schemaVersion and savedAt', () => {
    const parsed = JSON.parse(serializeSave(createInitialState(content), new Date('2026-01-02T03:04:05Z')));
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.savedAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it('clamps positions into walkBounds', () => {
    const result = parseSave(saveJson({}, { player: { position: { x: 999, z: -999 }, heading: 0 } }), content);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.state.player.position).toEqual({ x: 11, z: -7 });
  });

  it('flags newer versions as unsupported', () => {
    expect(parseSave(saveJson({ schemaVersion: 4 }), content)).toEqual({ status: 'unsupported_version', version: 4 });
    expect(parseSave(saveJson({ schemaVersion: 99 }), content)).toEqual({ status: 'unsupported_version', version: 99 });
  });

  it.each([
    ['empty string', ''],
    ['garbage', 'not json {'],
    ['array', '[]'],
    ['null', 'null'],
    ['missing version', JSON.stringify({ savedAt: 'x', state: {} })],
    ['string version', saveJson({ schemaVersion: '1' })],
    ['fractional version', saveJson({ schemaVersion: 1.5 })],
    ['zero version', saveJson({ schemaVersion: 0 })],
    ['missing savedAt', saveJson({ savedAt: undefined })],
    ['missing state', saveJson({ state: undefined })],
    ['wrong position type', saveJson({}, { player: { position: { x: '1', z: 2 }, heading: 0 } })],
    ['null number', saveJson({}, { player: { position: { x: null, z: 2 }, heading: 0 } })],
    ['missing heading', saveJson({}, { player: { position: { x: 1, z: 2 } } })],
    ['missing kiosk', saveJson({}, { kiosk: undefined })],
    ['non-boolean door', saveJson({}, { kiosk: { doorOpen: 1, shutterOpen: false } })],
    ['missing regionId', saveJson({}, { regionId: undefined })],
  ])('treats %s as corrupt', (_name, json) => {
    expect(parseSave(json, content).status).toBe('corrupt');
  });

  it('rejects non-finite numbers (serialized as null)', () => {
    const state = createInitialState(content);
    state.player.heading = Number.NaN;
    expect(parseSave(serializeSave(state), content).status).toBe('corrupt');
  });

  it('reports a region mismatch clearly', () => {
    const result = parseSave(saveJson({}, { regionId: 'region.other' }), content);
    expect(result).toEqual({
      status: 'corrupt',
      reason: expect.stringContaining('region.other'),
    });
  });
});

describe('migration chain', () => {
  const fake1to2 = (save: Record<string, unknown>): Record<string, unknown> => {
    const state = save['state'] as Record<string, unknown>;
    return { ...save, state: { ...state, regionId: state['regionId'] } };
  };

  it('applies migrations in order up to the current version', () => {
    const order: number[] = [];
    const result = parseSave(saveJson({ schemaVersion: 1 }), content, {
      currentVersion: 3,
      migrations: {
        1: (s) => {
          order.push(1);
          const state = s['state'] as Record<string, unknown>;
          return { ...s, state: { ...state, kiosk: { doorOpen: true, shutterOpen: false } } };
        },
        2: (s) => {
          order.push(2);
          expect(s['schemaVersion']).toBe(2);
          return s;
        },
      },
    });
    expect(order).toEqual([1, 2]);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.state.kiosk.doorOpen).toBe(true);
  });

  it('only applies the missing steps', () => {
    const step1 = vi.fn(fake1to2);
    const step2 = vi.fn((s: Record<string, unknown>) => s);
    parseSave(saveJson({ schemaVersion: 2 }), content, { currentVersion: 3, migrations: { 1: step1, 2: step2 } });
    expect(step1).not.toHaveBeenCalled();
    expect(step2).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported_version when a step is missing', () => {
    expect(parseSave(saveJson({ schemaVersion: 1 }), content, { currentVersion: 3, migrations: { 2: fake1to2 } })).toEqual({
      status: 'unsupported_version',
      version: 1,
    });
  });

  it('turns a throwing migration into corrupt', () => {
    const result = parseSave(saveJson({ schemaVersion: 1 }), content, {
      currentVersion: 2,
      migrations: {
        1: () => {
          throw new Error('kaputt');
        },
      },
    });
    expect(result).toEqual({ status: 'corrupt', reason: expect.stringContaining('kaputt') });
  });
});

describe('save store', () => {
  it('uses the documented key and default slot', () => {
    const mem = memoryStore();
    const store = createSaveStore(mem);
    expect(store.save(createInitialState(content))).toEqual({ ok: true });
    expect([...mem.data.keys()]).toEqual(['buedchensim.save.slot1']);
    expect(createSaveStore(mem, 'a').save(createInitialState(content)).ok).toBe(true);
    expect(mem.data.has('buedchensim.save.a')).toBe(true);
  });

  it('roundtrips through the store and returns empty when nothing is saved', () => {
    const store = createSaveStore(memoryStore());
    expect(store.load(content)).toEqual({ status: 'empty' });
    const state = createInitialState(content);
    state.kiosk.shutterOpen = true;
    store.save(state);
    expect(store.load(content)).toEqual({ status: 'ok', state });
  });

  it('clear removes the save', () => {
    const store = createSaveStore(memoryStore());
    store.save(createInitialState(content));
    store.clear();
    expect(store.load(content)).toEqual({ status: 'empty' });
  });

  it('handles storage exceptions on save', () => {
    const restore = setLogSink(() => {});
    const store = createSaveStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    });
    const result = store.save(createInitialState(content));
    restore();
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('QuotaExceededError') });
  });

  it('handles storage exceptions on load and clear', () => {
    const restore = setLogSink(() => {});
    const store = createSaveStore({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(store.load(content).status).toBe('corrupt');
    expect(() => store.clear()).not.toThrow();
    restore();
  });

  it('handles a missing store', () => {
    const store = createSaveStore(null);
    expect(store.save(createInitialState(content))).toEqual({ ok: false, reason: 'storage_unavailable' });
    expect(store.load(content)).toEqual({ status: 'empty' });
    expect(() => store.clear()).not.toThrow();
  });

  it('backs up corrupt saves instead of silently overwriting', () => {
    const mem = memoryStore();
    mem.data.set('buedchensim.save.slot1', 'garbage{');
    const result = createSaveStore(mem).load(content);
    expect(result.status).toBe('corrupt');
    expect(mem.data.get('buedchensim.save.slot1.backup')).toBe('garbage{');
  });

  it('backs up unsupported-version saves', () => {
    const mem = memoryStore();
    const raw = saveJson({ schemaVersion: 7 });
    mem.data.set('buedchensim.save.slot1', raw);
    expect(createSaveStore(mem).load(content)).toEqual({ status: 'unsupported_version', version: 7 });
    expect(mem.data.get('buedchensim.save.slot1.backup')).toBe(raw);
  });

  it('does not write a backup for valid or empty saves', () => {
    const mem = memoryStore();
    const store = createSaveStore(mem);
    store.load(content);
    store.save(createInitialState(content));
    store.load(content);
    expect(mem.data.has('buedchensim.save.slot1.backup')).toBe(false);
  });

  it('survives a failing backup write', () => {
    const restore = setLogSink(() => {});
    const store = createSaveStore({
      getItem: () => 'garbage',
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    });
    expect(store.load(content).status).toBe('corrupt');
    restore();
  });
});

describe('schema version 2 (calendar and economy)', () => {
  function richState() {
    const state = createInitialState(content);
    state.player.position = { x: 2.5, z: 1.25 };
    state.kiosk.shutterOpen = true;
    state.calendar = { day: 3, minute: 612.5, paused: true, speed: 4, phase: 'open' };
    state.economy = {
      cashCents: 12345,
      storage: { 'product.test-water': 12 },
      shelves: { 'slot.shelf-north-1': { productId: 'product.test-water', quantity: 5 } },
      pendingDelivery: { lines: [{ productId: 'product.test-beer', quantity: 3 }], totalCents: 210 },
      today: { revenueCents: 500, purchaseCents: 210, costOfGoodsSoldCents: 200, salesCount: 2 },
      lastReport: {
        day: 2,
        revenueCents: 900,
        costOfGoodsSoldCents: 400,
        purchaseCents: 1000,
        grossProfitCents: 500,
        cashFlowCents: -100,
        cashEndCents: 29900,
        salesCount: 7,
        closedAtMinute: 1320,
      },
      transactions: [
        {
          id: 9,
          day: 3,
          minute: 400,
          kind: 'sale',
          lines: [{ productId: 'product.test-water', quantity: 2, unitPriceCents: 100 }],
          totalCents: 200,
        },
      ],
      nextTransactionId: 10,
    };
    return state;
  }

  function parseWith(economy: unknown, calendar: unknown = createInitialState(content).calendar) {
    return parseSave(saveJson({}, { economy, calendar }), content);
  }

  it('roundtrips a full state', () => {
    const state = richState();
    expect(parseSave(serializeSave(state), content)).toEqual({ status: 'ok', state });
  });

  it('roundtrips through the store', () => {
    const store = createSaveStore(memoryStore());
    const state = richState();
    store.save(state);
    expect(store.load(content)).toEqual({ status: 'ok', state });
  });

  it('migrates v1 and keeps position, door and shutter', () => {
    const v1 = {
      schemaVersion: 1,
      savedAt: '2026-11-11T10:00:00.000Z',
      state: {
        regionId: content.regionId,
        player: { position: { x: 2.5, z: 1.25 }, heading: -1.5 },
        kiosk: { doorOpen: true, shutterOpen: true },
      },
    };
    const result = parseSave(JSON.stringify(v1), content);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.state.player).toEqual({ position: { x: 2.5, z: 1.25 }, heading: -1.5 });
    expect(result.state.kiosk).toEqual({ doorOpen: true, shutterOpen: true });
    const initial = createInitialState(content);
    expect(result.state.calendar).toEqual(initial.calendar);
    expect(result.state.economy).toEqual(initial.economy);
    expect(result.state.economy.cashCents).toBe(30000);
    expect(result.warnings).toBeUndefined();
  });

  it('still treats a broken v1 state as corrupt', () => {
    const v1 = { schemaVersion: 1, savedAt: 'x', state: { regionId: content.regionId } };
    expect(parseSave(JSON.stringify(v1), content).status).toBe('corrupt');
  });

  it('exposes the migration in the chain', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  const economy = () => structuredClone(richState().economy) as unknown as Record<string, unknown>;
  const withEconomy = (patch: Record<string, unknown>) => ({ ...economy(), ...patch });

  it.each([
    ['negative cash', withEconomy({ cashCents: -1 })],
    ['fractional cash', withEconomy({ cashCents: 10.5 })],
    ['string cash', withEconomy({ cashCents: '100' })],
    ['negative storage', withEconomy({ storage: { 'product.test-water': -1 } })],
    ['fractional storage', withEconomy({ storage: { 'product.test-water': 1.5 } })],
    ['negative shelf quantity', withEconomy({ shelves: { 'slot.shelf-north-1': { productId: 'product.test-water', quantity: -2 } } })],
    ['fractional shelf quantity', withEconomy({ shelves: { 'slot.shelf-north-1': { productId: 'product.test-water', quantity: 0.5 } } })],
    ['shelf without product', withEconomy({ shelves: { 'slot.shelf-north-1': { quantity: 2 } } })],
    ['zero pending quantity', withEconomy({ pendingDelivery: { lines: [{ productId: 'product.test-water', quantity: 0 }], totalCents: 1 } })],
    ['negative pending total', withEconomy({ pendingDelivery: { lines: [], totalCents: -1 } })],
    ['negative revenue', withEconomy({ today: { revenueCents: -1, purchaseCents: 0, costOfGoodsSoldCents: 0, salesCount: 0 } })],
    ['missing today', withEconomy({ today: undefined })],
    ['report with fractional cash', withEconomy({ lastReport: { ...(richState().economy.lastReport as object), cashEndCents: 1.5 } })],
    ['transaction with bad kind', withEconomy({ transactions: [{ id: 1, day: 1, minute: 1, kind: 'gift', lines: [], totalCents: 0 }] })],
    ['transaction id 0', withEconomy({ transactions: [{ id: 0, day: 1, minute: 1, kind: 'sale', lines: [], totalCents: 0 }] })],
    ['too many transactions', withEconomy({ transactions: Array.from({ length: 201 }, (_, i) => ({ id: i + 1, day: 1, minute: 1, kind: 'sale', lines: [], totalCents: 0 })) })],
    ['bad nextTransactionId', withEconomy({ nextTransactionId: 0 })],
    ['economy missing', undefined],
    ['economy array', []],
  ])('treats %s as corrupt', (_name, value) => {
    expect(parseWith(value).status).toBe('corrupt');
  });

  it('accepts exactly the transaction limit', () => {
    const list = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, day: 1, minute: 1, kind: 'sale', lines: [], totalCents: 0 }));
    expect(parseWith(withEconomy({ transactions: list })).status).toBe('ok');
  });

  it.each([
    ['day 0', { day: 0, minute: 360, paused: false, speed: 1, phase: 'open' }],
    ['fractional day', { day: 1.5, minute: 360, paused: false, speed: 1, phase: 'open' }],
    ['minute before opening', { day: 1, minute: 100, paused: false, speed: 1, phase: 'open' }],
    ['minute after closing', { day: 1, minute: 1400, paused: false, speed: 1, phase: 'open' }],
    ['speed 3', { day: 1, minute: 400, paused: false, speed: 3, phase: 'open' }],
    ['phase unknown', { day: 1, minute: 400, paused: false, speed: 1, phase: 'lunch' }],
    ['paused as string', { day: 1, minute: 400, paused: 'no', speed: 1, phase: 'open' }],
  ])('rejects an invalid calendar (%s)', (_name, calendar) => {
    expect(parseWith(economy(), calendar).status).toBe('corrupt');
  });

  it('accepts fractional minutes and all phases', () => {
    for (const phase of ['open', 'awaiting_close', 'closed']) {
      expect(parseWith(economy(), { day: 2, minute: 1320, paused: false, speed: 2, phase }).status).toBe('ok');
    }
    expect(parseWith(economy(), { day: 2, minute: 400.25, paused: false, speed: 2, phase: 'open' }).status).toBe('ok');
  });

  it('drops unknown product and slot ids instead of failing, and reports them', () => {
    const result = parseWith(
      withEconomy({
        storage: { 'product.test-water': 4, 'product.gone': 9 },
        shelves: {
          'slot.shelf-north-1': { productId: 'product.test-water', quantity: 3 },
          'slot.gone': { productId: 'product.test-water', quantity: 3 },
          'slot.shelf-north-2': { productId: 'product.gone', quantity: 3 },
          'slot.cooled-west': { productId: 'product.test-water', quantity: 3 }, // kind changed
        },
        pendingDelivery: {
          lines: [{ productId: 'product.gone', quantity: 2 }, { productId: 'product.test-beer', quantity: 1 }],
          totalCents: 100,
        },
      }),
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.state.economy.storage).toEqual({ 'product.test-water': 4 });
    expect(result.state.economy.shelves).toEqual({ 'slot.shelf-north-1': { productId: 'product.test-water', quantity: 3 } });
    expect(result.state.economy.pendingDelivery?.lines).toEqual([{ productId: 'product.test-beer', quantity: 1 }]);
    expect(result.state.economy.cashCents).toBe(12345);
    expect(result.warnings).toHaveLength(5);
    expect(result.warnings?.join('\n')).toContain('product.gone');
    expect(result.warnings?.join('\n')).toContain('slot.gone');
  });

  it('removes a pending delivery whose products are all unknown', () => {
    const result = parseWith(withEconomy({ pendingDelivery: { lines: [{ productId: 'product.gone', quantity: 2 }], totalCents: 100 } }));
    expect(result.status === 'ok' && result.state.economy.pendingDelivery).toBeNull();
  });

  it('clamps shelf stock to the current slot capacity', () => {
    const result = parseWith(withEconomy({ shelves: { 'slot.shelf-north-1': { productId: 'product.test-water', quantity: 500 } } }));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.state.economy.shelves['slot.shelf-north-1']?.quantity).toBe(36);
      expect(result.warnings).toHaveLength(1);
    }
  });

  it('drops zero quantities silently', () => {
    const result = parseWith(withEconomy({ storage: { 'product.test-water': 0 }, shelves: { 'slot.shelf-north-1': { productId: 'product.test-water', quantity: 0 } } }));
    expect(result).toMatchObject({ status: 'ok' });
    if (result.status === 'ok') {
      expect(result.state.economy.storage).toEqual({});
      expect(result.state.economy.shelves).toEqual({});
      expect(result.warnings).toBeUndefined();
    }
  });

  it('lets a game start from a save with unknown ids', () => {
    const result = parseWith(withEconomy({ storage: { 'product.gone': 9 } }));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      const game = createGame(content, result.state);
      expect(game.state.economy.storage).toEqual({});
    }
  });

  it('does not persist transient UI state', () => {
    const json = serializeSave(richState());
    expect(json).not.toMatch(/cart|ageCheck/i);
  });
});

describe('schema version 3 (world seed, residents, story)', () => {
  /** A v3 state in the middle of a day: a resident on its way with a route, one waiting with a wish, story progress. */
  function livingState() {
    const state = createInitialState(content, 424242);
    state.calendar = { day: 4, minute: 545.5, paused: false, speed: 2, phase: 'open' };
    state.kiosk.shutterOpen = true;
    const walker = state.npcs['npc.stammkunde']!;
    Object.assign(walker, {
      status: 'walking',
      position: { x: 3.25, z: 3.6 },
      heading: -1.57,
      placeId: 'place.window',
      spotIndex: 1,
      route: ['wp.w3', 'wp.win-b'],
      routineId: 'r.morning-shop',
      relationship: 41,
      memories: ['told-dispute'],
      lastVisit: { day: 3, minute: 500 },
      greetedDay: 3,
      doneToday: { day: 4, routineIds: [] },
    });
    const waiter = state.npcs['npc.kurier']!;
    Object.assign(waiter, {
      status: 'waiting',
      position: { x: -1.6, z: 2.55 },
      placeId: 'place.window',
      spotIndex: 0,
      routineId: 'r.shop',
      wish: { wishId: 'wish.kurier-beer', lines: [{ productId: 'product.test-beer', quantity: 1 }], ageChecked: true, resolved: null },
      waitingSince: 4 * 1440 + 541,
      lastTalk: { day: 4, minute: 543 },
    });
    state.story = {
      flags: { 'test.mediated': true, 'test.other': false },
      quests: { 'quest.dispute': { step: 'step.decided', outcome: 'outcome.mediated' } },
      seenDialogues: ['dialogue.stammkunde.dispute'],
      effectKeys: ['k.listen', 'k.mediate'],
    };
    state.economy.transactions.push({
      id: 1,
      day: 4,
      minute: 500,
      kind: 'sale',
      lines: [{ productId: 'product.test-water', quantity: 2, unitPriceCents: 100 }],
      totalCents: 200,
      npcId: 'npc.stammkunde',
    });
    state.economy.nextTransactionId = 2;
    return state;
  }

  type Raw = Record<string, unknown>;
  /** Walks into nested objects/arrays of a parsed save. */
  const node = (root: Raw, ...path: (string | number)[]): Raw => {
    let at: unknown = root;
    for (const key of path) at = (at as Record<string | number, unknown>)[key];
    return at as Raw;
  };
  const kurier = (s: Raw): Raw => node(s, 'npcs', 'npc.kurier');

  const parseState = (patch: (s: Raw) => void) => {
    const json = JSON.parse(serializeSave(livingState())) as { state: Raw };
    patch(json.state);
    return parseSave(JSON.stringify(json), content);
  };

  it('roundtrips seed, residents and story exactly', () => {
    const state = livingState();
    expect(parseSave(serializeSave(state), content)).toEqual({ status: 'ok', state });
    const store = createSaveStore(memoryStore());
    store.save(state);
    expect(store.load(content)).toEqual({ status: 'ok', state });
  });

  it('a reloaded game continues identically (same seed, same positions, same decisions)', () => {
    const a = createGame(content, livingState());
    const loaded = parseSave(serializeSave(a.save().state), content);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    const b = createGame(content, loaded.state);
    expect(b.state.world.seed).toBe(424242);
    expect(b.state.npcs).toEqual(a.state.npcs);
  });

  describe('migration', () => {
    /** What a version-2 file looks like: a rich economy, no world, npcs or story. */
    function v2Json() {
      const state = JSON.parse(JSON.stringify(livingState())) as Record<string, unknown>;
      delete state['world'];
      delete state['npcs'];
      delete state['story'];
      state['player'] = { position: { x: 2.5, z: 1.25 }, heading: -1.5 };
      state['kiosk'] = { doorOpen: true, shutterOpen: true };
      return JSON.stringify({ schemaVersion: 2, savedAt: '2026-11-11T10:00:00.000Z', state });
    }

    it('2 -> 3 keeps position, door, shutter, time, cash, storage, shelves, transactions and report', () => {
      const v3 = livingState();
      v3.economy.lastReport = {
        day: 3, revenueCents: 900, costOfGoodsSoldCents: 400, purchaseCents: 1000, grossProfitCents: 500,
        cashFlowCents: -100, cashEndCents: 29900, salesCount: 7, closedAtMinute: 1320,
      };
      v3.economy.storage = { 'product.test-water': 12 };
      v3.economy.shelves = { 'slot.shelf-north-1': { productId: 'product.test-water', quantity: 5 } };
      const raw = JSON.parse(v2Json()) as { state: Raw };
      raw.state['economy'] = JSON.parse(JSON.stringify(v3.economy));
      const result = parseSave(JSON.stringify(raw), content);
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.state.player).toEqual({ position: { x: 2.5, z: 1.25 }, heading: -1.5 });
      expect(result.state.kiosk).toEqual({ doorOpen: true, shutterOpen: true });
      expect(result.state.calendar).toEqual(v3.calendar);
      expect(result.state.economy.cashCents).toBe(v3.economy.cashCents);
      expect(result.state.economy.storage).toEqual({ 'product.test-water': 12 });
      expect(result.state.economy.shelves).toEqual(v3.economy.shelves);
      expect(result.state.economy.transactions).toEqual(v3.economy.transactions);
      expect(result.state.economy.lastReport).toEqual(v3.economy.lastReport);
      // new sections: initial residents, empty story, a derived seed; no warning for the empty list
      expect(Object.keys(result.state.npcs).sort()).toEqual(['npc.kurier', 'npc.nachbarin', 'npc.stammkunde']);
      expect(result.state.npcs['npc.stammkunde']).toEqual(createInitialState(content).npcs['npc.stammkunde']);
      expect(result.state.story).toEqual({ flags: {}, quests: {}, seenDialogues: [], effectKeys: [] });
      expect(Number.isInteger(result.state.world.seed)).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('derives the same seed every time for the same file, a different one for another file', () => {
      const seed = (json: string) => {
        const r = parseSave(json, content);
        return r.status === 'ok' ? r.state.world.seed : -1;
      };
      expect(seed(v2Json())).toBe(seed(v2Json()));
      expect(seed(v2Json())).toBeGreaterThanOrEqual(0);
      expect(seed(v2Json())).toBeLessThan(2 ** 32);
      expect(seed(v2Json().replace('2026-11-11', '2026-12-12'))).not.toBe(seed(v2Json()));
    });

    it('1 -> 2 -> 3 loads an old save', () => {
      const v1 = JSON.stringify({
        schemaVersion: 1,
        savedAt: '2026-11-11T10:00:00.000Z',
        state: { regionId: content.regionId, player: { position: { x: 1, z: 2 }, heading: 0.5 }, kiosk: { doorOpen: false, shutterOpen: true } },
      });
      const result = parseSave(v1, content);
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.state.player.position).toEqual({ x: 1, z: 2 });
      expect(result.state.kiosk.shutterOpen).toBe(true);
      expect(result.state.economy.cashCents).toBe(30000);
      expect(Object.keys(result.state.npcs)).toHaveLength(3);
      expect(result.warnings).toBeUndefined();
    });

    it('a broken version-2 state stays corrupt', () => {
      expect(parseSave(JSON.stringify({ schemaVersion: 2, savedAt: 'x', state: { regionId: content.regionId } }), content).status).toBe('corrupt');
    });
  });

  describe('strict validation of version 3', () => {
    it.each([
      ['world missing', (s: Raw) => delete s['world']],
      ['seed negative', (s: Raw) => (s['world'] = { seed: -1 })],
      ['seed fractional', (s: Raw) => (s['world'] = { seed: 1.5 })],
      ['seed above 32 bit', (s: Raw) => (s['world'] = { seed: 2 ** 32 })],
      ['npcs missing', (s: Raw) => delete s['npcs']],
      ['npcs array', (s: Raw) => (s['npcs'] = [])],
      ['story missing', (s: Raw) => delete s['story']],
      ['relationship above 100', (s: Raw) => (kurier(s)['relationship'] = 101)],
      ['relationship negative', (s: Raw) => (kurier(s)['relationship'] = -1)],
      ['relationship fractional', (s: Raw) => (kurier(s)['relationship'] = 4.5)],
      ['status unknown', (s: Raw) => (kurier(s)['status'] = 'dancing')],
      ['position not finite', (s: Raw) => (kurier(s)['position'] = { x: null, z: 1 })],
      ['route not an array', (s: Raw) => (kurier(s)['route'] = 'wp.w1')],
      ['route entry not a string', (s: Raw) => (kurier(s)['route'] = [1])],
      ['route too long', (s: Raw) => (kurier(s)['route'] = Array.from({ length: 65 }, () => 'wp.w1'))],
      ['memories too many', (s: Raw) => (kurier(s)['memories'] = Array.from({ length: 201 }, (_, i) => `m${i}`))],
      ['spot index fractional', (s: Raw) => (kurier(s)['spotIndex'] = 0.5)],
      ['wish resolved unknown', (s: Raw) => (node(kurier(s), 'wish')['resolved'] = 'maybe')],
      ['wish quantity zero', (s: Raw) => (node(kurier(s), 'wish', 'lines', 0)['quantity'] = 0)],
      ['wish ageChecked string', (s: Raw) => (node(kurier(s), 'wish')['ageChecked'] = 'yes')],
      ['doneToday missing', (s: Raw) => delete kurier(s)['doneToday']],
      ['lastVisit fractional minute', (s: Raw) => (node(s, 'npcs', 'npc.stammkunde')['lastVisit'] = { day: 1, minute: 1.5 })],
      ['waitingSince string', (s: Raw) => (kurier(s)['waitingSince'] = 'now')],
      ['resident is a number', (s: Raw) => (node(s, 'npcs')['npc.kurier'] = 3)],
      ['flag not boolean', (s: Raw) => (node(s, 'story', 'flags')['x'] = 1)],
      ['too many effect keys', (s: Raw) => (node(s, 'story')['effectKeys'] = Array.from({ length: 1001 }, (_, i) => `k${i}`))],
      ['quest progress broken', (s: Raw) => (node(s, 'story', 'quests')['quest.dispute'] = { step: 1, outcome: null })],
      ['seenDialogues not strings', (s: Raw) => (node(s, 'story')['seenDialogues'] = [1])],
      ['transaction npcId number', (s: Raw) => (node(s, 'economy', 'transactions', 0)['npcId'] = 7)],
    ])('treats %s as corrupt', (_name, patch) => {
      expect(parseState(patch).status).toBe('corrupt');
    });
  });

  describe('content-aware sanitising (unknown ids are dropped with warnings)', () => {
    const warningsOf = (r: ReturnType<typeof parseState>) => (r.status === 'ok' ? (r.warnings ?? []).join('\n') : 'not ok');

    it('drops unknown residents, dialogues and quests', () => {
      const r = parseState((s) => {
        node(s, 'npcs')['npc.gone'] = { garbage: true };
        (node(s, 'story')['seenDialogues'] as string[]).push('dialogue.gone');
        node(s, 'story', 'quests')['quest.gone'] = { step: 'x', outcome: null };
      });
      expect(r.status).toBe('ok');
      if (r.status !== 'ok') return;
      expect(Object.keys(r.state.npcs)).not.toContain('npc.gone');
      expect(r.state.story.seenDialogues).toEqual(['dialogue.stammkunde.dispute']);
      expect(Object.keys(r.state.story.quests)).toEqual(['quest.dispute']);
      expect(warningsOf(r)).toContain('npc.gone');
      expect(warningsOf(r)).toContain('dialogue.gone');
      expect(warningsOf(r)).toContain('quest.gone');
    });

    it('drops a quest with an unknown step or outcome', () => {
      const r = parseState((s) => (node(s, 'story', 'quests')['quest.dispute'] = { step: 'step.nope', outcome: null }));
      expect(r.status === 'ok' && r.state.story.quests).toEqual({});
      expect(warningsOf(r)).toContain('quest.dispute');
    });

    it('resets a resident with an unknown place, waypoint, spot, routine or wish to "away" and keeps its relationship and memories', () => {
      const cases: [string, (n: Raw) => void][] = [
        ['place', (n) => (n['placeId'] = 'place.gone')],
        ['waypoint', (n) => (n['route'] = ['wp.gone'])],
        ['spot', (n) => (n['spotIndex'] = 9)],
        ['routine', (n) => (n['routineId'] = 'r.gone')],
        ['wish', (n) => (n['wish'] = { wishId: 'wish.gone', lines: [], ageChecked: false, resolved: null })],
        ['wish product', (n) => (n['wish'] = { wishId: 'wish.water', lines: [{ productId: 'product.gone', quantity: 1 }], ageChecked: false, resolved: null })],
      ];
      for (const [name, patch] of cases) {
        const r = parseState((s) => patch(node(s, 'npcs', 'npc.stammkunde')));
        expect(r.status, name).toBe('ok');
        if (r.status !== 'ok') continue;
        const n = r.state.npcs['npc.stammkunde']!;
        expect(n.status, name).toBe('away');
        expect(n.route, name).toEqual([]);
        expect(n.placeId, name).toBeNull();
        expect(n.position, name).toEqual({ x: 10, z: 3.6 }); // home exit
        expect(n.relationship, name).toBe(41);
        expect(n.memories, name).toEqual(['told-dispute']);
        expect(warningsOf(r), name).toContain('npc.stammkunde');
      }
    });

    it('adds residents that are new in the content (with a warning when the saved list was not empty)', () => {
      const r = parseState((s) => delete node(s, 'npcs')['npc.nachbarin']);
      expect(r.status).toBe('ok');
      if (r.status !== 'ok') return;
      expect(r.state.npcs['npc.nachbarin']?.status).toBe('away');
      expect(r.state.npcs['npc.nachbarin']?.relationship).toBe(15);
      expect(warningsOf(r)).toContain('npc.nachbarin');
      expect(r.state.npcs['npc.stammkunde']?.relationship).toBe(41);
    });

    it('removes an unknown resident id from a transaction but keeps the transaction', () => {
      const r = parseState((s) => (node(s, 'economy', 'transactions', 0)['npcId'] = 'npc.gone'));
      expect(r.status).toBe('ok');
      if (r.status !== 'ok') return;
      expect(r.state.economy.transactions[0]?.npcId).toBeUndefined();
      expect(r.state.economy.transactions[0]?.totalCents).toBe(200);
      expect(warningsOf(r)).toContain('npc.gone');
    });

    it('drops unknown routine ids from the done list', () => {
      const r = parseState((s) => (kurier(s)['doneToday'] = { day: 4, routineIds: ['r.shop', 'r.gone'] }));
      expect(r.status === 'ok' && r.state.npcs['npc.kurier']?.doneToday.routineIds).toEqual(['r.shop']);
    });

    it('lets a game start from such a save', () => {
      const r = parseState((s) => (kurier(s)['placeId'] = 'place.gone'));
      expect(r.status).toBe('ok');
      if (r.status === 'ok') expect(createGame(content, r.state).npcs.get('npc.kurier')?.visible).toBe(false);
    });
  });

  describe('a saved conversation is never restored', () => {
    const talking = (patch: (n: Raw) => void) =>
      parseState((s) => {
        const n = kurier(s);
        n.status = 'talking';
        patch(n);
      });

    it('restores talking as walking, waiting or at_place', () => {
      const waiting = talking(() => undefined); // open wish, no route
      expect(waiting.status === 'ok' && waiting.state.npcs['npc.kurier']?.status).toBe('waiting');
      const standing = talking((n) => (n['wish'] = null));
      expect(standing.status === 'ok' && standing.state.npcs['npc.kurier']?.status).toBe('at_place');
      const walking = talking((n) => (n['route'] = ['wp.w3']));
      expect(walking.status === 'ok' && walking.state.npcs['npc.kurier']?.status).toBe('walking');
    });
  });

  it('does not persist transient dialogue data', () => {
    const game = createGame(content, livingState());
    game.player.setPose({ x: -9, z: -6 }, 0);
    const state = game.state as unknown as { npcs: Record<string, { position: unknown }> };
    state.npcs['npc.kurier']!.position = { x: -9, z: -5 };
    game.npcs.talk('npc.kurier');
    const json = serializeSave(game.save().state);
    expect(json).not.toMatch(/nodeId|options|dialogueId|notice/);
  });
});
