import { DAY_START_MINUTE, DEFAULT_SPEED, START_CASH_CENTS, type GameSpeed } from './balance';
import type { ContentPack, NpcDef, Vec2 } from './types';

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
  /** Set when a resident customer bought the goods. */
  npcId?: string;
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

export type NpcStatus = 'away' | 'walking' | 'waiting' | 'at_place' | 'talking';

export interface DayTime {
  day: number;
  /** Whole minutes since midnight. */
  minute: number;
}

/** The open wish of a customer. The resolution is final: a resolved wish can never be sold again. */
export interface NpcWishState {
  wishId: string;
  lines: ProductLine[];
  /** The player checked the resident's ID (transient meaning, saved only so a reload mid-conversation is consistent). */
  ageChecked: boolean;
  resolved: 'sold' | 'declined' | null;
}

/**
 * Saved state of one resident: only what a reload needs to continue. No view, UI or dialogue-session data
 * (a saved 'talking' status is restored as 'walking' / 'waiting' / 'at_place').
 */
export interface NpcState {
  status: NpcStatus;
  position: Vec2;
  /** Radians, 0 = +Z, positive toward +X. */
  heading: number;
  /** The place the resident stands at or walks to; null when away. */
  placeId: string | null;
  /** Reserved standing spot at `placeId`; null when none (e.g. exits, pass-by). */
  spotIndex: number | null;
  /** Remaining waypoint ids; the first one is the current target. */
  route: string[];
  /** The routine entry that drives the resident; null when it is heading home or away. */
  routineId: string | null;
  /** Integer 0..100. */
  relationship: number;
  memories: string[];
  lastVisit: DayTime | null;
  lastTalk: DayTime | null;
  /** Day of the last daily greeting bonus. */
  greetedDay: number | null;
  /** Routine entries finished on `day` (reset when the day changes). */
  doneToday: { day: number; routineIds: string[] };
  wish: NpcWishState | null;
  /** Absolute game minute (`day * 1440 + minute`) since which the resident waits (shutter or service); null otherwise. */
  waitingSince: number | null;
}

export interface QuestProgress {
  step: string | null;
  outcome: string | null;
}

export interface StoryState {
  flags: Record<string, boolean>;
  /** Created with the first step or outcome. */
  quests: Record<string, QuestProgress>;
  /** Dialogues that were ended (finished or closed) at least once. */
  seenDialogues: string[];
  /** Keys of relationship effects that were already applied. */
  effectKeys: string[];
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
 * Plain JSON data only.
 * Transient UI state (cart, age confirmation) is NOT part of it.
 */
export interface GameState {
  regionId: string;
  /** heading in radians, 0 = facing +Z, positive toward +X (atan2(dx, dz)). */
  player: { position: Vec2; heading: number };
  kiosk: { doorOpen: boolean; shutterOpen: boolean };
  calendar: CalendarState;
  economy: EconomyState;
  /** Seeds all deterministic rolls of the world (routine chances, wish choice). Saved, so a reload decides identically. */
  world: { seed: number };
  npcs: Record<string, NpcState>;
  story: StoryState;
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

export function createInitialStory(): StoryState {
  return { flags: {}, quests: {}, seenDialogues: [], effectKeys: [] };
}

/** Seed used when none is given (tests, tooling). A new game in the app passes a fresh one. */
export const DEFAULT_WORLD_SEED = 1;

/** Where a resident appears: the first spot waypoint of its home exit; falls back to the origin for broken content. */
export function homeExitPosition(content: ContentPack, def: NpcDef): Vec2 {
  const nav = content.layout.nav;
  const place = nav.places.find((p) => p.id === def.homeExitPlaceId);
  const wpId = place?.spots[0]?.waypointId;
  const wp = nav.waypoints.find((w) => w.id === wpId);
  return wp ? { x: wp.position.x, z: wp.position.z } : { x: 0, z: 0 };
}

export function createInitialNpcState(content: ContentPack, def: NpcDef): NpcState {
  return {
    status: 'away',
    position: homeExitPosition(content, def),
    heading: 0,
    placeId: null,
    spotIndex: null,
    route: [],
    routineId: null,
    relationship: def.startRelationship,
    memories: [],
    lastVisit: null,
    lastTalk: null,
    greetedDay: null,
    doneToday: { day: 0, routineIds: [] },
    wish: null,
    waitingSince: null,
  };
}

export function createInitialNpcs(content: ContentPack): Record<string, NpcState> {
  const npcs: Record<string, NpcState> = {};
  for (const def of Object.values(content.npcs)) npcs[def.id] = createInitialNpcState(content, def);
  return npcs;
}

export function createInitialState(content: ContentPack, seed: number = DEFAULT_WORLD_SEED): GameState {
  const { spawn } = content.layout;
  return {
    regionId: content.regionId,
    player: { position: { x: spawn.position.x, z: spawn.position.z }, heading: spawn.heading },
    kiosk: { doorOpen: false, shutterOpen: false },
    calendar: createInitialCalendar(),
    economy: createInitialEconomy(),
    world: { seed },
    npcs: createInitialNpcs(content),
    story: createInitialStory(),
  };
}
