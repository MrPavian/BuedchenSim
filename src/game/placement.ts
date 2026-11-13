import type { AssetDef, PlacementDef, QuarterTurn, Rect, RegionLayout, Vec2 } from './types';

/**
 * Pure placement math (no three, no DOM). The single source for collision (world),
 * validation (content) and render transforms (world).
 */

const MAX_SUPPORT_DEPTH = 8;

export const quarterTurnToRadians = (rotation: QuarterTurn): number => (rotation * Math.PI) / 180;

/** World-space AABB of a placement: rotation 90/270 swaps width and depth; scale is applied. */
export function placementFootprint(placement: PlacementDef, asset: AssetDef): Rect {
  const scale = placement.scale ?? 1;
  const swapped = placement.rotation === 90 || placement.rotation === 270;
  const halfW = ((swapped ? asset.size.depth : asset.size.width) * scale) / 2;
  const halfD = ((swapped ? asset.size.width : asset.size.depth) * scale) / 2;
  const { x, z } = placement.position;
  return { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
}

/** Height of the placement's own box including scale. */
export function placementHeight(placement: PlacementDef, asset: AssetDef): number {
  return asset.size.height * (placement.scale ?? 1);
}

/** 0, or the supporter's top height when `on` is set. Unknown references count as ground level. */
export function placementBaseHeight(
  placement: PlacementDef,
  layout: Pick<RegionLayout, 'placements'>,
  assets: Readonly<Record<string, AssetDef>>,
  depth = 0,
): number {
  if (placement.on === undefined || depth >= MAX_SUPPORT_DEPTH) return 0;
  const supporter = layout.placements.find((p) => p.id === placement.on);
  const supporterAsset = supporter ? assets[supporter.assetId] : undefined;
  if (!supporter || !supporterAsset) return 0;
  return placementBaseHeight(supporter, layout, assets, depth + 1) + placementHeight(supporter, supporterAsset);
}

/** Supported placements never collide; otherwise the placement override wins over the asset default. */
export function placementCollides(placement: PlacementDef, asset: AssetDef): boolean {
  if (placement.on !== undefined) return false;
  return placement.collides ?? asset.collides;
}

export function placementColliders(
  layout: Pick<RegionLayout, 'placements'>,
  assets: Readonly<Record<string, AssetDef>>,
  flags?: Readonly<Record<string, boolean>>,
): Array<{ placementId: string; rect: Rect }> {
  const out: Array<{ placementId: string; rect: Rect }> = [];
  for (const placement of layout.placements) {
    if (!placementPresent(placement, flags)) continue;
    const asset = assets[placement.assetId];
    if (asset && placementCollides(placement, asset)) {
      out.push({ placementId: placement.id, rect: placementFootprint(placement, asset) });
    }
  }
  return out;
}

/**
 * Unit vector (x, z) of the front direction after rotation. Matches three.js `rotation.y = deg * PI / 180`
 * applied to the +Z vector: (sin, cos). 0 -> +Z, 90 -> +X, 180 -> -Z, 270 -> -X.
 */
export function placementFront(placement: Pick<PlacementDef, 'rotation'>): Vec2 {
  switch (placement.rotation) {
    case 0:
      return { x: 0, z: 1 };
    case 90:
      return { x: 1, z: 0 };
    case 180:
      return { x: 0, z: -1 };
    case 270:
      return { x: -1, z: 0 };
  }
}

/** Strip of the given depth directly in front of the footprint's front edge ("usable from the front"). */
export function frontStrip(footprint: Rect, front: Vec2, depth: number): Rect {
  if (front.z > 0) return { minX: footprint.minX, maxX: footprint.maxX, minZ: footprint.maxZ, maxZ: footprint.maxZ + depth };
  if (front.z < 0) return { minX: footprint.minX, maxX: footprint.maxX, minZ: footprint.minZ - depth, maxZ: footprint.minZ };
  if (front.x > 0) return { minX: footprint.maxX, maxX: footprint.maxX + depth, minZ: footprint.minZ, maxZ: footprint.maxZ };
  return { minX: footprint.minX - depth, maxX: footprint.minX, minZ: footprint.minZ, maxZ: footprint.maxZ };
}

/**
 * Whether a placement exists given the story flags. Without flags (content validation) every placement counts as
 * present, so a gated object can never be placed where it would block a route once it appears.
 */
export function placementPresent(placement: Pick<PlacementDef, 'requiresFlag'>, flags?: Readonly<Record<string, boolean>>): boolean {
  if (!placement.requiresFlag || !flags) return true;
  return flags[placement.requiresFlag] === true;
}
