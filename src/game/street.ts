import type { DomainContext } from './domain';
import { roll } from './random';
import type { Transaction } from './state';

/**
 * Cleanliness in front of the kiosk (Auftrag 06, 6.6), the one small new mechanic of phase 6. Customers sometimes
 * throw something into the bin after a purchase; once the bin is full, rubbish ends up on the sidewalk. The player
 * empties the bin and sweeps up at the bin (interaction 'bin'); overnight the street cleaning takes part of the
 * rubbish away. A dirty sidewalk only shows and makes residents comment; it never boosts sales when it is clean.
 */

export interface StreetState {
  /** Fill level of the bin E-005, 0..100. */
  binFill: number;
  /** Rubbish on the sidewalk, 0..100. */
  litter: number;
}

export const STREET = {
  /** Chance (%) that a customer throws something into the bin after a sale. */
  throwChance: 60,
  /** Bin fill per thrown item. */
  binPerItem: 8,
  /** Rubbish added per item when the bin is full. */
  litterPerItem: 7,
  /** Rubbish the street cleaning removes overnight. */
  nightCleaning: 25,
  /** From this much rubbish, residents notice it (dialogue condition `litterAtLeast` in content). */
  noticeAt: 35,
} as const;

export function createInitialStreet(): StreetState {
  return { binFill: 0, litter: 0 };
}

export interface StreetApi {
  /** Called for every completed sale (customer or till). */
  onSale(t: Pick<Transaction, 'id' | 'day'>): void;
  /** Called at the start of each day. */
  onDayStarted(): void;
  /** Empty the bin and sweep the sidewalk (the player's action at the bin). */
  clean(): void;
}

const clamp100 = (v: number): number => Math.min(100, Math.max(0, v));

export function createStreetApi(ctx: DomainContext): StreetApi {
  const changed = (): void => {
    const s = ctx.state().street;
    ctx.emit('street.changed', { binFill: s.binFill, litter: s.litter });
  };
  return {
    onSale(t) {
      const state = ctx.state();
      if (roll(state.world.seed, 'street.throw', t.day, t.id) * 100 >= STREET.throwChance) return;
      const s = state.street;
      if (s.binFill + STREET.binPerItem <= 100) s.binFill = clamp100(s.binFill + STREET.binPerItem);
      else {
        s.binFill = 100;
        s.litter = clamp100(s.litter + STREET.litterPerItem);
      }
      changed();
    },
    onDayStarted() {
      const s = ctx.state().street;
      if (s.litter === 0) return;
      s.litter = clamp100(s.litter - STREET.nightCleaning);
      changed();
    },
    clean() {
      const s = ctx.state().street;
      s.binFill = 0;
      s.litter = 0;
      changed();
    },
  };
}
