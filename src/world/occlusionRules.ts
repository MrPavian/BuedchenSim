import { wallRect } from '../game/kioskGeometry';
import type { KioskDef, Rect, Vec2, WallSide } from '../game/types';

/**
 * Pure decision logic for the dollhouse cutaway (no three, no DOM, unit-tested).
 *
 * Rule: nothing is ever transparent. While the player is inside the kiosk the whole roof is hidden and the
 * camera-facing (south) wall is cut down to the cut height; the east/west walls are cut as well when the
 * camera's line of sight to the player crosses their upper part (with a margin, so they do not flicker).
 * The north wall (backdrop) never changes. While the player is outside nothing is cut at all (the
 * building stays solid; the player shows as an x-ray silhouette instead, see playerFigure.ts).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CutDecision {
  roof: boolean;
  /** Which wall sides are cut down to the cut height. North is always false. */
  walls: Record<WallSide, boolean>;
}

/** Heights of the sample points on the figure (feet, torso, head). */
export const SIGHT_HEIGHTS: readonly number[] = [0.15, 0.9, 1.65];
/** Sideways/vertical tolerance (m) around a wall's upper part when testing the line of sight. */
export const SIGHT_MARGIN = 0.35;

export function isInsideKiosk(player: Vec2, footprint: Rect): boolean {
  return player.x > footprint.minX && player.x < footprint.maxX && player.z > footprint.minZ && player.z < footprint.maxZ;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Segment/AABB intersection (slab method). */
export function segmentHitsBox(a: Vec3, b: Vec3, box: Bounds): boolean {
  let t0 = 0;
  let t1 = 1;
  const axes: Array<[number, number, number, number]> = [
    [a.x, b.x, box.minX, box.maxX],
    [a.y, b.y, box.minY, box.maxY],
    [a.z, b.z, box.minZ, box.maxZ],
  ];
  for (const [p, q, lo, hi] of axes) {
    const d = q - p;
    if (Math.abs(d) < 1e-12) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let near = (lo - p) / d;
    let far = (hi - p) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

/** Upper part (above the cut) of one wall as a box. */
function upperWallBounds(kiosk: KioskDef, side: WallSide, cutHeight: number): Bounds {
  const r = wallRect(kiosk, side);
  return { minX: r.minX, maxX: r.maxX, minY: cutHeight, maxY: kiosk.height, minZ: r.minZ, maxZ: r.maxZ };
}

export function decideCut(kiosk: KioskDef, cutHeight: number, player: Vec2, camera: Vec3): CutDecision {
  const none: CutDecision = { roof: false, walls: { south: false, north: false, east: false, west: false } };
  if (!isInsideKiosk(player, kiosk.footprint)) return none;
  const walls: CutDecision['walls'] = { south: true, north: false, east: false, west: false };
  for (const side of ['east', 'west'] as const) {
    const b = upperWallBounds(kiosk, side, cutHeight);
    const grown: Bounds = {
      minX: b.minX - SIGHT_MARGIN,
      maxX: b.maxX + SIGHT_MARGIN,
      minY: b.minY - 0.1,
      maxY: b.maxY + 0.1,
      minZ: b.minZ - SIGHT_MARGIN,
      maxZ: b.maxZ + SIGHT_MARGIN,
    };
    for (const y of SIGHT_HEIGHTS) {
      if (segmentHitsBox(camera, { x: player.x, y, z: player.z }, grown)) {
        walls[side] = true;
        break;
      }
    }
  }
  return { roof: true, walls };
}

/** Sample heights (chest, head) used to decide whether the building hides the figure; the feet are ignored. */
export const SILHOUETTE_HEIGHTS: readonly number[] = [0.9, 1.65];
/** Hysteresis (m): while the silhouette is shown the kiosk volume is grown by this much, so it does not flicker. */
export const SILHOUETTE_HYSTERESIS = 0.15;

/**
 * Whether the x-ray silhouette should be drawn: only while the player is outside and the kiosk volume
 * (footprint x height) lies between camera and the chest or head. Furniture, crates and the low south wall
 * never trigger it, so hidden feet simply stay hidden.
 */
export function shouldShowSilhouette(kiosk: KioskDef, camera: Vec3, figure: Vec2, wasShown = false): boolean {
  if (isInsideKiosk(figure, kiosk.footprint)) return false;
  const f = kiosk.footprint;
  const g = wasShown ? SILHOUETTE_HYSTERESIS : 0;
  const box: Bounds = { minX: f.minX - g, maxX: f.maxX + g, minY: 0, maxY: kiosk.height + g, minZ: f.minZ - g, maxZ: f.maxZ + g };
  return SILHOUETTE_HEIGHTS.some((y) => segmentHitsBox(camera, { x: figure.x, y, z: figure.z }, box));
}
