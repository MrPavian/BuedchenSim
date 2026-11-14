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

/** A movable obstacle (a resident), centre and radius in metres. */
export interface Circle {
  x: number;
  z: number;
  r: number;
}

/**
 * Keeps a circle that moves from `from` to `to` out of other circles (residents). The player is only ever
 * stopped by a resident, never moved by one: the distance to a circle is kept at no less than
 * min(radius + circle.r, the distance before the move). So a resident that walked into the player does not push
 * him away (he may leave but not press deeper), and idle players (`to === from`) are never touched.
 */
export function constrainToCircles(from: Vec2, to: Vec2, radius: number, circles: readonly Circle[]): Vec2 {
  if (circles.length === 0) return to;
  let x = to.x;
  let z = to.z;
  let changed = false;
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const c of circles) {
      const before = Math.hypot(from.x - c.x, from.z - c.z);
      const allowed = Math.min(radius + c.r, before);
      let dx = x - c.x;
      let dz = z - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= allowed - EPSILON) continue;
      if (dist < 1e-6) {
        // Exactly on the centre: leave along the way we came from (or +X).
        dx = from.x - c.x || 1;
        dz = from.z - c.z;
      }
      const length = Math.hypot(dx, dz);
      x = c.x + (dx / length) * allowed;
      z = c.z + (dz / length) * allowed;
      moved = true;
      changed = true;
    }
    if (!moved) break;
  }
  return changed ? { x, z } : to;
}

/**
 * Moves a circle by `delta`, sliding along obstacles. The result always lies within
 * `bounds` (the circle centre, same convention as `walkBounds`). Optional `circles` (residents) block the
 * movement and are slid around like walls; see `constrainToCircles`.
 */
export function moveCircle(
  start: Vec2,
  delta: Vec2,
  radius: number,
  obstacles: readonly Rect[],
  bounds: Rect,
  circles: readonly Circle[] = [],
): Vec2 {
  const length = Math.hypot(delta.x, delta.z);
  const steps = Math.max(1, Math.ceil(length / (radius * 0.5)));
  const sx = delta.x / steps;
  const sz = delta.z / steps;
  let p = resolvePosition(start, radius, obstacles, bounds);
  for (let i = 0; i < steps; i += 1) {
    let next = resolvePosition({ x: p.x + sx, z: p.z + sz }, radius, obstacles, bounds);
    if (circles.length > 0) {
      const slid = constrainToCircles(p, next, radius, circles);
      // The push-out may have shoved the circle into a wall: walls win.
      next = slid === next ? next : resolvePosition(slid, radius, obstacles, bounds);
    }
    p = next;
  }
  return p;
}
