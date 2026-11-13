import { kioskColliders } from './kioskGeometry';
import { placementColliders } from './placement';
import type { AssetDef, Rect, RegionLayout } from './types';

/**
 * All obstacles for the player circle: kiosk walls (plus the closed door leaf) and the colliding
 * placements. The one list used by world movement and content reachability validation.
 */
export function layoutColliders(
  layout: Pick<RegionLayout, 'kiosk' | 'placements'>,
  assets: Readonly<Record<string, AssetDef>>,
  doorOpen: boolean,
  /** Story flags; pass them at runtime so flag-gated placements collide only once they exist. Omit for validation. */
  flags?: Readonly<Record<string, boolean>>,
): Rect[] {
  return [
    ...kioskColliders(layout.kiosk, doorOpen),
    ...placementColliders(layout, assets, flags).map((c) => ({ ...c.rect })),
  ];
}
