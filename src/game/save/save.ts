import { log } from '../../core/log';
import { DAY_END_MINUTE, DAY_START_MINUTE, SPEEDS, TRANSACTION_LIMIT, type GameSpeed } from '../balance';
import type { ActionResult } from '../result';
import { findProduct, findSlot, slotCapacityFor } from '../selectors';
import {
  createInitialCalendar,
  createInitialEconomy,
  type CalendarState,
  type DayPhase,
  type DayReport,
  type EconomyState,
  type GameState,
  type PendingDelivery,
  type ShelfStock,
  type Transaction,
  type TransactionLine,
} from '../state';
import type { ContentPack } from '../types';

export const CURRENT_SCHEMA_VERSION = 2;

export interface SaveFile {
  schemaVersion: number;
  savedAt: string;
  state: GameState;
}

export type LoadResult =
  /**
   * `warnings` is present only when entries had to be dropped or clamped because the content changed
   * (unknown product or slot ids, incompatible or over-full slots).
   */
  | { status: 'ok'; state: GameState; warnings?: string[] }
  | { status: 'empty' }
  | { status: 'corrupt'; reason: string }
  /** Newer than this build, or no migration path. */
  | { status: 'unsupported_version'; version: number };

/** Converts a save payload of version n to version n+1 (the runner updates `schemaVersion`). */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** 1 -> 2: adds the day clock and the economy with their initial values; position, door and shutter stay. */
const migrateV1toV2: Migration = (save) => {
  const state = save['state'];
  if (!isRecord(state)) return save; // validation reports it
  return { ...save, state: { ...state, calendar: createInitialCalendar(), economy: createInitialEconomy() } };
};

/** migrations[n] converts version n to n+1. */
export const migrations: Readonly<Record<number, Migration>> = { 1: migrateV1toV2 };

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

function integer(value: unknown, path: string, min = 0): Checked<number> {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    return { ok: false, reason: `${path} must be an integer >= ${min}` };
  }
  return { ok: true, value };
}

function text(value: unknown, path: string): Checked<string> {
  if (typeof value !== 'string') return { ok: false, reason: `${path} must be a string` };
  return { ok: true, value };
}

function objectAt(value: unknown, path: string): Checked<Record<string, unknown>> {
  if (!isRecord(value)) return { ok: false, reason: `${path} must be an object` };
  return { ok: true, value };
}

function arrayAt(value: unknown, path: string): Checked<unknown[]> {
  if (!Array.isArray(value)) return { ok: false, reason: `${path} must be an array` };
  return { ok: true, value };
}

function validateCalendar(raw: unknown): Checked<CalendarState> {
  const obj = objectAt(raw, 'state.calendar');
  if (!obj.ok) return obj;
  const c = obj.value;
  const day = integer(c['day'], 'state.calendar.day', 1);
  if (!day.ok) return day;
  const minute = finite(c['minute'], 'state.calendar.minute');
  if (!minute.ok) return minute;
  if (minute.value < DAY_START_MINUTE || minute.value > DAY_END_MINUTE) {
    return { ok: false, reason: `state.calendar.minute must be within ${DAY_START_MINUTE}..${DAY_END_MINUTE}` };
  }
  const paused = bool(c['paused'], 'state.calendar.paused');
  if (!paused.ok) return paused;
  const speed = c['speed'];
  if (!SPEEDS.includes(speed as GameSpeed)) return { ok: false, reason: `state.calendar.speed must be one of ${SPEEDS.join(', ')}` };
  const phase = c['phase'];
  if (phase !== 'open' && phase !== 'awaiting_close' && phase !== 'closed') {
    return { ok: false, reason: 'state.calendar.phase must be open, awaiting_close or closed' };
  }
  return {
    ok: true,
    value: { day: day.value, minute: minute.value, paused: paused.value, speed: speed as GameSpeed, phase: phase as DayPhase },
  };
}

const REPORT_FIELDS = [
  'revenueCents',
  'costOfGoodsSoldCents',
  'purchaseCents',
  'grossProfitCents',
  'cashFlowCents',
  'cashEndCents',
  'salesCount',
  'closedAtMinute',
] as const;
/** Fields that may legitimately be negative (differences). */
const SIGNED_REPORT_FIELDS: readonly string[] = ['grossProfitCents', 'cashFlowCents'];

function validateReport(raw: unknown): Checked<DayReport | null> {
  if (raw === null) return { ok: true, value: null };
  const obj = objectAt(raw, 'state.economy.lastReport');
  if (!obj.ok) return obj;
  const day = integer(obj.value['day'], 'state.economy.lastReport.day', 1);
  if (!day.ok) return day;
  const out: Record<string, number> = { day: day.value };
  for (const field of REPORT_FIELDS) {
    const signed = SIGNED_REPORT_FIELDS.includes(field);
    const v = integer(obj.value[field], `state.economy.lastReport.${field}`, signed ? Number.MIN_SAFE_INTEGER : 0);
    if (!v.ok) return v;
    out[field] = v.value;
  }
  return { ok: true, value: out as unknown as DayReport };
}

function validateTransactions(raw: unknown): Checked<Transaction[]> {
  const list = arrayAt(raw, 'state.economy.transactions');
  if (!list.ok) return list;
  if (list.value.length > TRANSACTION_LIMIT) {
    return { ok: false, reason: `state.economy.transactions holds more than ${TRANSACTION_LIMIT} entries` };
  }
  const out: Transaction[] = [];
  for (const [i, entry] of list.value.entries()) {
    const path = `state.economy.transactions[${i}]`;
    const obj = objectAt(entry, path);
    if (!obj.ok) return obj;
    const t = obj.value;
    const id = integer(t['id'], `${path}.id`, 1);
    if (!id.ok) return id;
    const day = integer(t['day'], `${path}.day`, 1);
    if (!day.ok) return day;
    const minute = integer(t['minute'], `${path}.minute`);
    if (!minute.ok) return minute;
    if (t['kind'] !== 'purchase' && t['kind'] !== 'sale') return { ok: false, reason: `${path}.kind must be purchase or sale` };
    const total = integer(t['totalCents'], `${path}.totalCents`);
    if (!total.ok) return total;
    const lines = arrayAt(t['lines'], `${path}.lines`);
    if (!lines.ok) return lines;
    const outLines: TransactionLine[] = [];
    for (const [j, rawLine] of lines.value.entries()) {
      const lp = `${path}.lines[${j}]`;
      const line = objectAt(rawLine, lp);
      if (!line.ok) return line;
      const productId = text(line.value['productId'], `${lp}.productId`);
      if (!productId.ok) return productId;
      const quantity = integer(line.value['quantity'], `${lp}.quantity`, 1);
      if (!quantity.ok) return quantity;
      const price = integer(line.value['unitPriceCents'], `${lp}.unitPriceCents`);
      if (!price.ok) return price;
      outLines.push({ productId: productId.value, quantity: quantity.value, unitPriceCents: price.value });
    }
    out.push({ id: id.value, day: day.value, minute: minute.value, kind: t['kind'], lines: outLines, totalCents: total.value });
  }
  return { ok: true, value: out };
}

function validateEconomy(
  raw: unknown,
  content: ContentPack,
  warnings: string[],
): Checked<EconomyState> {
  const obj = objectAt(raw, 'state.economy');
  if (!obj.ok) return obj;
  const e = obj.value;
  const cash = integer(e['cashCents'], 'state.economy.cashCents');
  if (!cash.ok) return cash;
  const nextId = integer(e['nextTransactionId'], 'state.economy.nextTransactionId', 1);
  if (!nextId.ok) return nextId;

  // Storage: strict shape, then drop products the content no longer has.
  const storageRaw = objectAt(e['storage'], 'state.economy.storage');
  if (!storageRaw.ok) return storageRaw;
  const storage: Record<string, number> = {};
  for (const [productId, quantity] of Object.entries(storageRaw.value)) {
    const q = integer(quantity, `state.economy.storage["${productId}"]`);
    if (!q.ok) return q;
    if (!findProduct(content, productId)) {
      warnings.push(`storage: unknown product "${productId}" dropped`);
    } else if (q.value > 0) {
      storage[productId] = q.value;
    }
  }

  // Shelves: strict shape, then drop unknown / incompatible entries and clamp to the slot capacity.
  const shelvesRaw = objectAt(e['shelves'], 'state.economy.shelves');
  if (!shelvesRaw.ok) return shelvesRaw;
  const shelves: Record<string, ShelfStock> = {};
  for (const [slotId, rawStock] of Object.entries(shelvesRaw.value)) {
    const path = `state.economy.shelves["${slotId}"]`;
    const stock = objectAt(rawStock, path);
    if (!stock.ok) return stock;
    const productId = text(stock.value['productId'], `${path}.productId`);
    if (!productId.ok) return productId;
    const quantity = integer(stock.value['quantity'], `${path}.quantity`);
    if (!quantity.ok) return quantity;
    const slot = findSlot(content, slotId);
    const product = findProduct(content, productId.value);
    if (!slot) {
      warnings.push(`shelves: unknown slot "${slotId}" dropped`);
    } else if (!product) {
      warnings.push(`shelves: unknown product "${productId.value}" in slot "${slotId}" dropped`);
    } else if (product.storage !== slot.accepts) {
      warnings.push(`shelves: product "${productId.value}" no longer fits slot "${slotId}" and was dropped`);
    } else if (quantity.value > 0) {
      const capacity = slotCapacityFor(content, slotId, productId.value);
      const kept = Math.min(quantity.value, capacity);
      if (kept < quantity.value) warnings.push(`shelves: slot "${slotId}" holds ${kept} instead of ${quantity.value} (capacity changed)`);
      if (kept > 0) shelves[slotId] = { productId: productId.value, quantity: kept };
    }
  }

  // Pending delivery.
  let pendingDelivery: PendingDelivery | null = null;
  if (e['pendingDelivery'] !== null) {
    const pending = objectAt(e['pendingDelivery'], 'state.economy.pendingDelivery');
    if (!pending.ok) return pending;
    const total = integer(pending.value['totalCents'], 'state.economy.pendingDelivery.totalCents');
    if (!total.ok) return total;
    const lines = arrayAt(pending.value['lines'], 'state.economy.pendingDelivery.lines');
    if (!lines.ok) return lines;
    const kept: PendingDelivery['lines'] = [];
    for (const [i, rawLine] of lines.value.entries()) {
      const lp = `state.economy.pendingDelivery.lines[${i}]`;
      const line = objectAt(rawLine, lp);
      if (!line.ok) return line;
      const productId = text(line.value['productId'], `${lp}.productId`);
      if (!productId.ok) return productId;
      const quantity = integer(line.value['quantity'], `${lp}.quantity`, 1);
      if (!quantity.ok) return quantity;
      if (findProduct(content, productId.value)) kept.push({ productId: productId.value, quantity: quantity.value });
      else warnings.push(`pending delivery: unknown product "${productId.value}" dropped`);
    }
    if (kept.length > 0) pendingDelivery = { lines: kept, totalCents: total.value };
  }

  const todayRaw = objectAt(e['today'], 'state.economy.today');
  if (!todayRaw.ok) return todayRaw;
  const today = { revenueCents: 0, purchaseCents: 0, costOfGoodsSoldCents: 0, salesCount: 0 };
  for (const field of Object.keys(today) as (keyof typeof today)[]) {
    const v = integer(todayRaw.value[field], `state.economy.today.${field}`);
    if (!v.ok) return v;
    today[field] = v.value;
  }

  const lastReport = validateReport(e['lastReport']);
  if (!lastReport.ok) return lastReport;
  const transactions = validateTransactions(e['transactions']);
  if (!transactions.ok) return transactions;

  return {
    ok: true,
    value: {
      cashCents: cash.value,
      storage,
      shelves,
      pendingDelivery,
      today,
      lastReport: lastReport.value,
      transactions: transactions.value,
      nextTransactionId: nextId.value,
    },
  };
}

function validateState(raw: unknown, content: ContentPack, warnings: string[]): Checked<GameState> {
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

  const calendar = validateCalendar(raw['calendar']);
  if (!calendar.ok) return calendar;
  const economy = validateEconomy(raw['economy'], content, warnings);
  if (!economy.ok) return economy;

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
      calendar: calendar.value,
      economy: economy.value,
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
  const warnings: string[] = [];
  const state = validateState(migrated['state'], content, warnings);
  if (!state.ok) return { status: 'corrupt', reason: state.reason };
  return warnings.length > 0 ? { status: 'ok', state: state.value, warnings } : { status: 'ok', state: state.value };
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
