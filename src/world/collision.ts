import type { Rect, Vec2 } from '../game/types';

/**
 * Pure 2D collision math (no three, no DOM): a circle moving among axis-aligned rects.
 * Movement is split into sub-steps shorter than the radius so thin walls cannot be
 * tunnelled, and every sub-step is followed by a push-out, which yields natural sliding.
 */

const MAX_PUSH_ITERATIONS = 4;
const EPSILON = 1e-9;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Pushes a circle centre out of a single rect; returns the corrected position. */
export function pushOutOfRect(x: number, z: number, radius: number, rect: Rect): Vec2 {
  const cx = clamp(x, rect.minX, rect.maxX);
  const cz = clamp(z, rect.minZ, rect.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const dist2 = dx * dx + dz * dz;
  if (dist2 >= radius * radius) return { x, z };
  if (dist2 > EPSILON) {
    const dist = Math.sqrt(dist2);
    const k = (radius - dist) / dist;
    return { x: x + dx * k, z: z + dz * k };
  }
  // Centre is inside the rect: leave through the nearest face.
  const toMinX = x - rect.minX;
  const toMaxX = rect.maxX - x;
  const toMinZ = z - rect.minZ;
  const toMaxZ = rect.maxZ - z;
  const smallest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
  if (smallest === toMinX) return { x: rect.minX - radius, z };
  if (smallest === toMaxX) return { x: rect.maxX + radius, z };
  if (smallest === toMinZ) return { x, z: rect.minZ - radius };
  return { x, z: rect.maxZ + radius };
}

function clampToBounds(p: Vec2, bounds: Rect): Vec2 {
  return { x: clamp(p.x, bounds.minX, bounds.maxX), z: clamp(p.z, bounds.minZ, bounds.maxZ) };
}

/** Resolves overlaps with all obstacles (and the bounds) at a position. */
export function resolvePosition(position: Vec2, radius: number, obstacles: readonly Rect[], bounds: Rect): Vec2 {
  let p = clampToBounds(position, bounds);
  for (let i = 0; i < MAX_PUSH_ITERATIONS; i += 1) {
    let moved = false;
    for (const rect of obstacles) {
      const next = pushOutOfRect(p.x, p.z, radius, rect);
      if (next.x !== p.x || next.z !== p.z) {
        p = next;
        moved = true;
      }
    }
    p = clampToBounds(p, bounds);
    if (!moved) break;
  }
  return p;
}

/**
 * Moves a circle by `delta`, sliding along obstacles. The result always lies within
 * `bounds` (the circle centre, same convention as `walkBounds`).
 */
export function moveCircle(
  start: Vec2,
  delta: Vec2,
  radius: number,
  obstacles: readonly Rect[],
  bounds: Rect,
): Vec2 {
  const length = Math.hypot(delta.x, delta.z);
  const steps = Math.max(1, Math.ceil(length / (radius * 0.5)));
  const sx = delta.x / steps;
  const sz = delta.z / steps;
  let p = resolvePosition(start, radius, obstacles, bounds);
  for (let i = 0; i < steps; i += 1) {
    p = resolvePosition({ x: p.x + sx, z: p.z + sz }, radius, obstacles, bounds);
  }
  return p;
}

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
