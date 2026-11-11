import { log } from '../../core/log';
import type { ActionResult } from '../result';
import type { GameState } from '../state';
import type { ContentPack } from '../types';

export const CURRENT_SCHEMA_VERSION = 1;

export interface SaveFile {
  schemaVersion: number;
  savedAt: string;
  state: GameState;
}

export type LoadResult =
  | { status: 'ok'; state: GameState }
  | { status: 'empty' }
  | { status: 'corrupt'; reason: string }
  /** Newer than this build, or no migration path. */
  | { status: 'unsupported_version'; version: number };

/** Converts a save payload of version n to version n+1 (the runner updates `schemaVersion`). */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] converts version n to n+1. Empty while only version 1 exists. */
export const migrations: Readonly<Record<number, Migration>> = {};

export interface ParseOptions {
  /** Injectable for tests. */
  currentVersion?: number;
  migrations?: Readonly<Record<number, Migration>>;
}

export function serializeSave(state: GameState, now: Date = new Date()): string {
  const file: SaveFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    state,
  };
  return JSON.stringify(file);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

function finite(value: unknown, path: string): Checked<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, reason: `${path} must be a finite number` };
  }
  return { ok: true, value };
}

function bool(value: unknown, path: string): Checked<boolean> {
  if (typeof value !== 'boolean') return { ok: false, reason: `${path} must be a boolean` };
  return { ok: true, value };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function validateState(raw: unknown, content: ContentPack): Checked<GameState> {
  if (!isRecord(raw)) return { ok: false, reason: 'state must be an object' };
  if (typeof raw['regionId'] !== 'string') return { ok: false, reason: 'state.regionId must be a string' };
  if (raw['regionId'] !== content.regionId) {
    return {
      ok: false,
      reason: `save belongs to region "${raw['regionId']}" but the loaded content is "${content.regionId}"`,
    };
  }
  const player = raw['player'];
  if (!isRecord(player)) return { ok: false, reason: 'state.player must be an object' };
  const position = player['position'];
  if (!isRecord(position)) return { ok: false, reason: 'state.player.position must be an object' };
  const x = finite(position['x'], 'state.player.position.x');
  if (!x.ok) return x;
  const z = finite(position['z'], 'state.player.position.z');
  if (!z.ok) return z;
  const heading = finite(player['heading'], 'state.player.heading');
  if (!heading.ok) return heading;
  const kiosk = raw['kiosk'];
  if (!isRecord(kiosk)) return { ok: false, reason: 'state.kiosk must be an object' };
  const doorOpen = bool(kiosk['doorOpen'], 'state.kiosk.doorOpen');
  if (!doorOpen.ok) return doorOpen;
  const shutterOpen = bool(kiosk['shutterOpen'], 'state.kiosk.shutterOpen');
  if (!shutterOpen.ok) return shutterOpen;

  const b = content.layout.walkBounds;
  return {
    ok: true,
    value: {
      regionId: content.regionId,
      player: {
        position: { x: clamp(x.value, b.minX, b.maxX), z: clamp(z.value, b.minZ, b.maxZ) },
        heading: heading.value,
      },
      kiosk: { doorOpen: doorOpen.value, shutterOpen: shutterOpen.value },
    },
  };
}

export function parseSave(json: string, content: ContentPack, options: ParseOptions = {}): LoadResult {
  const currentVersion = options.currentVersion ?? CURRENT_SCHEMA_VERSION;
  const chain = options.migrations ?? migrations;

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (error) {
    return { status: 'corrupt', reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!isRecord(payload)) return { status: 'corrupt', reason: 'save must be a JSON object' };

  const version = payload['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { status: 'corrupt', reason: 'schemaVersion must be a positive integer' };
  }
  if (version > currentVersion) return { status: 'unsupported_version', version };

  let migrated: Record<string, unknown> = payload;
  for (let v = version; v < currentVersion; v += 1) {
    const step = chain[v];
    if (!step) return { status: 'unsupported_version', version };
    try {
      const result = step(migrated);
      if (!isRecord(result)) return { status: 'corrupt', reason: `migration ${v} -> ${v + 1} returned no object` };
      migrated = { ...result, schemaVersion: v + 1 };
    } catch (error) {
      return {
        status: 'corrupt',
        reason: `migration ${v} -> ${v + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  if (typeof migrated['savedAt'] !== 'string') return { status: 'corrupt', reason: 'savedAt must be a string' };
  const state = validateState(migrated['state'], content);
  if (!state.ok) return { status: 'corrupt', reason: state.reason };
  return { status: 'ok', state: state.value };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveStore {
  save(state: GameState): ActionResult;
  load(content: ContentPack): LoadResult;
  clear(): void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSaveStore(store: KeyValueStore | null, slot = 'slot1'): SaveStore {
  const key = `buedchensim.save.${slot}`;
  const backupKey = `${key}.backup`;

  return {
    save(state) {
      if (!store) return { ok: false, reason: 'storage_unavailable' };
      try {
        store.setItem(key, serializeSave(state));
        return { ok: true };
      } catch (error) {
        log.warn('Saving failed', error);
        return { ok: false, reason: `storage_error: ${errorText(error)}` };
      }
    },
    load(content) {
      if (!store) return { status: 'empty' };
      let raw: string | null;
      try {
        raw = store.getItem(key);
      } catch (error) {
        log.warn('Reading the save failed', error);
        return { status: 'corrupt', reason: `storage_error: ${errorText(error)}` };
      }
      if (raw === null) return { status: 'empty' };
      const result = parseSave(raw, content);
      if (result.status === 'corrupt' || result.status === 'unsupported_version') {
        // Keep the unreadable data so a later save cannot silently destroy it.
        try {
          store.setItem(backupKey, raw);
        } catch (error) {
          log.warn('Writing the save backup failed', error);
        }
      }
      return result;
    },
    clear() {
      if (!store) return;
      try {
        store.removeItem(key);
      } catch (error) {
        log.warn('Clearing the save failed', error);
      }
    },
  };
}
