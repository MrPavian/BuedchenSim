import type { PackageKind } from './types';

/** Central balancing values of the economy and the day clock. No magic numbers elsewhere. */

/** Cash at the start of a new game: 300.00 EUR. */
export const START_CASH_CENTS = 30000;

/** Opening time, minutes since midnight (06:00). */
export const DAY_START_MINUTE = 360;
/** Closing time, minutes since midnight (22:00). */
export const DAY_END_MINUTE = 1320;

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
