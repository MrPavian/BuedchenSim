import type { Rect } from './types';

const EPSILON = 1e-9;

/** True when the interiors overlap (touching edges do not count). */
export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

/** True when `inner` lies fully inside `outer` (within `tolerance`). */
export const rectContainsRect = (outer: Rect, inner: Rect, tolerance = 1e-6): boolean =>
  inner.minX >= outer.minX - tolerance &&
  inner.maxX <= outer.maxX + tolerance &&
  inner.minZ >= outer.minZ - tolerance &&
  inner.maxZ <= outer.maxZ + tolerance;

export const rectContainsPoint = (outer: Rect, x: number, z: number): boolean =>
  x >= outer.minX && x <= outer.maxX && z >= outer.minZ && z <= outer.maxZ;

function sameRange(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.abs(a0 - b0) < EPSILON && Math.abs(a1 - b1) < EPSILON;
}

/** Merges touching rects that share an extent on one axis (avoids seams between wall pieces). */
export function mergeRects(rects: readonly Rect[]): Rect[] {
  const out = rects.map((r) => ({ ...r }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i += 1) {
      for (let j = i + 1; j < out.length && !changed; j += 1) {
        const a = out[i] as Rect;
        const b = out[j] as Rect;
        if (sameRange(a.minZ, a.maxZ, b.minZ, b.maxZ) && a.minX <= b.maxX + EPSILON && b.minX <= a.maxX + EPSILON) {
          out[i] = { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: a.minZ, maxZ: a.maxZ };
          out.splice(j, 1);
          changed = true;
        } else if (
          sameRange(a.minX, a.maxX, b.minX, b.maxX) &&
          a.minZ <= b.maxZ + EPSILON &&
          b.minZ <= a.maxZ + EPSILON
        ) {
          out[i] = { minX: a.minX, maxX: a.maxX, minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) };
          out.splice(j, 1);
          changed = true;
        }
      }
    }
  }
  return out;
}
