import { describe, expect, it, vi } from 'vitest';
import { setLogSink } from '../../core/log';
import { testPack } from '../testing/fixture-pack';
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
    schemaVersion: 1,
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
    expect(parseSave(saveJson({ schemaVersion: 2 }), content)).toEqual({ status: 'unsupported_version', version: 2 });
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
    const result = parseSave(saveJson(), content, {
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
    expect(parseSave(saveJson(), content, { currentVersion: 3, migrations: { 2: fake1to2 } })).toEqual({
      status: 'unsupported_version',
      version: 1,
    });
  });

  it('turns a throwing migration into corrupt', () => {
    const result = parseSave(saveJson(), content, {
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
