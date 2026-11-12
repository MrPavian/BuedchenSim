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
    expect(parseSave(saveJson({ schemaVersion: 3 }), content)).toEqual({ status: 'unsupported_version', version: 3 });
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
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
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
