import type { Object3D } from 'three';
import { placementPresent } from '../game/placement';
import type { AssetDef, PlacementDef, RegionLayout } from '../game/types';
import { buildWorldColliders, type WorldColliders } from './colliders';

type Flags = Readonly<Record<string, boolean>>;

export interface PlacementGates {
  /** Shows/hides the objects of flag-gated placements and returns the matching collider lists. */
  apply(flags: Flags): WorldColliders;
  /** Every gated placement and whether its object is currently drawn. */
  list(): Array<{ id: string; visible: boolean }>;
}

const MAX_SUPPORT_DEPTH = 8;

/**
 * Flag gating (`PlacementDef.requiresFlag`) of the scene objects: a gated placement is drawn and collides only
 * while its flag is set, and so does everything standing on it. Pure bookkeeping over an id -> object map.
 */
export function createPlacementGates(
  layout: RegionLayout,
  assets: Readonly<Record<string, AssetDef>>,
  objects: ReadonlyMap<string, Object3D>,
): PlacementGates {
  const byId = new Map<string, PlacementDef>(layout.placements.map((p) => [p.id, p]));
  const present = (placement: PlacementDef, flags: Flags, depth = 0): boolean => {
    if (!placementPresent(placement, flags)) return false;
    const support = placement.on === undefined || depth >= MAX_SUPPORT_DEPTH ? undefined : byId.get(placement.on);
    return support === undefined || present(support, flags, depth + 1);
  };
  return {
    apply(flags) {
      for (const placement of layout.placements) {
        const object = objects.get(placement.id);
        if (object) object.visible = present(placement, flags);
      }
      return buildWorldColliders(layout, assets, flags);
    },
    list() {
      return layout.placements
        .filter((p) => p.requiresFlag !== undefined)
        .map((p) => ({ id: p.id, visible: objects.get(p.id)?.visible ?? false }));
    },
  };
}
