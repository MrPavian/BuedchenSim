import type { PackageKind } from './types';

/** Central balancing values of the economy and the day clock. No magic numbers elsewhere. */

/** Cash at the start of a new game: 300.00 EUR. */
export const START_CASH_CENTS = 30000;

/** Opening time, minutes since midnight (06:00). */
export const DAY_START_MINUTE = 360;
/** Closing time, minutes since midnight (22:00). */
export const DAY_END_MINUTE = 1320;

/** Days per week. Day 1 is a Monday (START_DATE in date.ts); the weekday is derived from the date (see `weekdayOf`), never saved. */
export const WEEK_LENGTH = 7;

/** Game minutes that pass per real second at speed 1. */
export const GAME_MINUTES_PER_SECOND = 1;

export const SPEEDS = [1, 2, 4] as const;
export type GameSpeed = (typeof SPEEDS)[number];
export const DEFAULT_SPEED: GameSpeed = 1;

/** The newest transactions kept in the state. */
export const TRANSACTION_LIMIT = 200;

/** Total units the back storage may hold (pending delivery included). */
export const STORAGE_CAPACITY_UNITS = 400;

/** Free space between displayed units, in metres. */
export const UNIT_GAP_METERS = 0.01;

/** Default number of layers units may be stacked in, per package kind (a product may override it). */
export const PACKAGE_MAX_STACK: Readonly<Record<PackageKind, number>> = {
  'glass-bottle': 1,
  'pet-bottle': 1,
  can: 2,
  bag: 1,
  bar: 3,
  box: 2,
  'ice-stick': 1,
  'ice-cup': 2,
  pastry: 1,
  magazine: 3,
};

// --- Residents (phase 4) -------------------------------------------------------------------------------------------

/** Collision radius of a resident in metres (the player uses PLAYER_RADIUS). */
export const NPC_RADIUS = 0.3;
/** Extra free space residents keep to the player and to each other, in metres. */
export const NPC_CLEARANCE_MARGIN = 0.05;
/** Seconds of (clock-speed scaled) time a blocked resident waits before it looks for another route. */
export const NPC_BLOCKED_WAIT_SECONDS = 4;
/**
 * Last resort against a permanent deadlock between two walking residents with no alternative route: after this many
 * seconds of being blocked by a resident, the one with the higher id (lower priority) walks on through the other
 * until its next waypoint. Never applies to the player.
 */
export const NPC_DEADLOCK_SECONDS = 20;
/** The simulation step is split so that no single movement step is longer than this (seconds). */
export const NPC_MAX_STEP_SECONDS = 1 / 30;
/** Upper bound of real seconds one game.tick simulates for residents (the loop sends 1/60 s; larger dt is clipped). */
export const NPC_MAX_TICK_SECONDS = 5;

/** Distance within which the player can talk to a resident (works across the counter from behind it). */
export const NPC_TALK_RADIUS = 1.8;
/** Maximum angle between the player's heading and the direction to the resident, in radians (75 degrees). */
export const NPC_TALK_MAX_ANGLE = (75 * Math.PI) / 180;

/** Game minutes a customer waits for the sales shutter to open before it leaves. */
export const SHUTTER_PATIENCE_MINUTES = 30;

export const RELATIONSHIP_MIN = 0;
export const RELATIONSHIP_MAX = 100;
/** Lower bounds of the relationship tiers: stranger < 20 <= acquaintance < 50 <= trusted < 80 <= close. */
export const RELATIONSHIP_TIER_THRESHOLDS = { acquaintance: 20, trusted: 50, close: 80 } as const;
/** The only repeatable relationship gain: the first conversation of a day. */
export const DAILY_GREETING_BONUS = 1;

/** Upper bounds of the saved lists (a larger list in a save is corrupt; the engine stops adding at the limit). */
export const SAVE_LIMITS = {
  memoriesPerNpc: 200,
  routeWaypoints: 64,
  routinesDonePerDay: 64,
  wishLines: 16,
  flags: 500,
  seenDialogues: 500,
  effectKeys: 1000,
} as const;
