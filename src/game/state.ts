import { DAY_START_MINUTE, DEFAULT_SPEED, START_CASH_CENTS, type GameSpeed } from './balance';
import type { ContentPack, Vec2 } from './types';

/** 'open' = clock runs; 'awaiting_close' = 22:00 reached, waiting for the day close; 'closed' = day closed, waiting for the next day. */
export type DayPhase = 'open' | 'awaiting_close' | 'closed';

export interface CalendarState {
  /** Starts at 1. */
  day: number;
  /** Minutes since midnight, may be fractional. */
  minute: number;
  paused: boolean;
  speed: GameSpeed;
  phase: DayPhase;
}

export interface ProductLine {
  productId: string;
  quantity: number;
}

export interface TransactionLine {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Transaction {
  id: number;
  day: number;
  /** Whole minutes since midnight. */
  minute: number;
  kind: 'purchase' | 'sale';
  lines: TransactionLine[];
  totalCents: number;
}

export interface DayReport {
  day: number;
  revenueCents: number;
  costOfGoodsSoldCents: number;
  purchaseCents: number;
  /** revenue - cost of goods sold */
  grossProfitCents: number;
  /** revenue - purchases */
  cashFlowCents: number;
  cashEndCents: number;
  salesCount: number;
  closedAtMinute: number;
}

export interface ShelfStock {
  productId: string;
  quantity: number;
}

export interface PendingDelivery {
  lines: ProductLine[];
  totalCents: number;
}

export interface TodayTotals {
  revenueCents: number;
  purchaseCents: number;
  costOfGoodsSoldCents: number;
  salesCount: number;
}

export interface EconomyState {
  cashCents: number;
  /** Back storage: units per product id (no zero entries). */
  storage: Record<string, number>;
  /** Presentation slots: slot id -> goods (empty slots have no entry). */
  shelves: Record<string, ShelfStock>;
  pendingDelivery: PendingDelivery | null;
  today: TodayTotals;
  lastReport: DayReport | null;
  /** Newest TRANSACTION_LIMIT transactions, oldest first. */
  transactions: Transaction[];
  nextTransactionId: number;
}

/**
 * Plain JSON data only. People/story sections arrive via save migrations in later phases.
 * Transient UI state (cart, age confirmation) is NOT part of it.
 */
export interface GameState {
  regionId: string;
  /** heading in radians, 0 = facing +Z, positive toward +X (atan2(dx, dz)). */
  player: { position: Vec2; heading: number };
  kiosk: { doorOpen: boolean; shutterOpen: boolean };
  calendar: CalendarState;
  economy: EconomyState;
}

export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export function createEmptyToday(): TodayTotals {
  return { revenueCents: 0, purchaseCents: 0, costOfGoodsSoldCents: 0, salesCount: 0 };
}

export function createInitialCalendar(): CalendarState {
  return { day: 1, minute: DAY_START_MINUTE, paused: false, speed: DEFAULT_SPEED, phase: 'open' };
}

export function createInitialEconomy(): EconomyState {
  return {
    cashCents: START_CASH_CENTS,
    storage: {},
    shelves: {},
    pendingDelivery: null,
    today: createEmptyToday(),
    lastReport: null,
    transactions: [],
    nextTransactionId: 1,
  };
}

export function createInitialState(content: ContentPack): GameState {
  const { spawn } = content.layout;
  return {
    regionId: content.regionId,
    player: { position: { x: spawn.position.x, z: spawn.position.z }, heading: spawn.heading },
    kiosk: { doorOpen: false, shutterOpen: false },
    calendar: createInitialCalendar(),
    economy: createInitialEconomy(),
  };
}
