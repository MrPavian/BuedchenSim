import { layoutColliders } from '../game/colliders';
import type { AssetDef, Rect, RegionLayout } from '../game/types';

export interface WorldColliders {
  /** Door leaf blocks the opening. */
  closed: Rect[];
  /** Door open: the opening is passable. */
  open: Rect[];
}

/** The world's obstacle lists, derived only from layout data (kiosk walls + placements). */
export function buildWorldColliders(
  layout: RegionLayout,
  assets: Readonly<Record<string, AssetDef>>,
  /** Story flags: flag-gated placements collide only while their flag is set. Omit to treat every placement as present. */
  flags?: Readonly<Record<string, boolean>>,
): WorldColliders {
  return { closed: layoutColliders(layout, assets, false, flags), open: layoutColliders(layout, assets, true, flags) };
}
