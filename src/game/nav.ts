import type { NavDef, PlaceDef, Rect, Vec2 } from './types';

/** Navigation helpers: shortest paths on the hand-kept waypoint graph, edge clearance and reachability (pure). */

export interface NavGraph {
  /** Waypoint ids in content order. */
  readonly ids: readonly string[];
  readonly positions: ReadonlyMap<string, Vec2>;
  /** Neighbours with edge length. */
  readonly neighbours: ReadonlyMap<string, readonly { id: string; length: number }[]>;
}

export function buildNavGraph(nav: NavDef): NavGraph {
  const positions = new Map<string, Vec2>();
  const neighbours = new Map<string, { id: string; length: number }[]>();
  for (const wp of nav.waypoints) {
    positions.set(wp.id, wp.position);
    neighbours.set(wp.id, []);
  }
  for (const [a, b] of nav.edges) {
    const pa = positions.get(a);
    const pb = positions.get(b);
    if (!pa || !pb || a === b) continue; // validation reports these
    const length = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    neighbours.get(a)?.push({ id: b, length });
    neighbours.get(b)?.push({ id: a, length });
  }
  return { ids: nav.waypoints.map((w) => w.id), positions, neighbours };
}

/** Same unordered pair? */
export function sameEdge(a: string, b: string, e: readonly [string, string]): boolean {
  return (a === e[0] && b === e[1]) || (a === e[1] && b === e[0]);
}

/**
 * Shortest path (Dijkstra) from `from` to `to`, both included; `[from]` when equal; null when unreachable or
 * unknown. `avoidEdge` (unordered) is ignored by the search. Ties are broken by waypoint order, so the result is deterministic.
 */
export function findPath(
  graph: NavGraph,
  from: string,
  to: string,
  avoidEdge: readonly [string, string] | null = null,
): string[] | null {
  if (!graph.positions.has(from) || !graph.positions.has(to)) return null;
  if (from === to) return [from];
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of graph.ids) {
      if (done.has(id)) continue;
      const d = dist.get(id);
      if (d !== undefined && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) return null;
    if (current === to) break;
    done.add(current);
    for (const n of graph.neighbours.get(current) ?? []) {
      if (done.has(n.id)) continue;
      if (avoidEdge && sameEdge(current, n.id, avoidEdge)) continue;
      const next = best + n.length;
      if (next < (dist.get(n.id) ?? Infinity) - 1e-12) {
        dist.set(n.id, next);
        prev.set(n.id, current);
      }
    }
  }
  const path: string[] = [to];
  let at = to;
  while (at !== from) {
    const before = prev.get(at);
    if (before === undefined) return null;
    path.push(before);
    at = before;
  }
  return path.reverse();
}

export function pathLength(graph: NavGraph, path: readonly string[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = graph.positions.get(path[i - 1] as string);
    const b = graph.positions.get(path[i] as string);
    if (a && b) total += Math.hypot(a.x - b.x, a.z - b.z);
  }
  return total;
}

/** Waypoint closest to the point (first in content order on ties); null for an empty graph. */
export function nearestWaypoint(graph: NavGraph, position: Vec2): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const id of graph.ids) {
    const p = graph.positions.get(id) as Vec2;
    const d = (p.x - position.x) ** 2 + (p.z - position.z) ** 2;
    if (d < bestD - 1e-12) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Distance from a point to the segment a-b. */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2));
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

/** The waypoint a resident on its way to `next` came from: the neighbour of `next` whose edge the position lies on. */
export function edgeOrigin(graph: NavGraph, position: Vec2, next: string, tolerance = 0.02): string | null {
  const target = graph.positions.get(next);
  if (!target) return null;
  let best: string | null = null;
  let bestD = tolerance;
  for (const n of graph.neighbours.get(next) ?? []) {
    const d = distanceToSegment(position, graph.positions.get(n.id) as Vec2, target);
    if (d <= bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}

const CLEAR_EPSILON = 1e-9;

/**
 * True when a body of `radius` can move along the segment a-b without touching a collider: the segment must not
 * enter the interior of any rect inflated by `radius` (touching is clear). For content validation.
 */
export function navEdgeClear(a: Vec2, b: Vec2, colliders: readonly Rect[], radius: number): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const c of colliders) {
    const minX = c.minX - radius + CLEAR_EPSILON;
    const maxX = c.maxX + radius - CLEAR_EPSILON;
    const minZ = c.minZ - radius + CLEAR_EPSILON;
    const maxZ = c.maxZ + radius - CLEAR_EPSILON;
    if (minX >= maxX || minZ >= maxZ) continue;
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    const slabs: [number, number, number, number][] = [
      [a.x, dx, minX, maxX],
      [a.z, dz, minZ, maxZ],
    ];
    for (const [origin, delta, lo, hi] of slabs) {
      if (Math.abs(delta) < 1e-12) {
        if (origin <= lo || origin >= hi) {
          hit = false;
          break;
        }
      } else {
        let ta = (lo - origin) / delta;
        let tb = (hi - origin) / delta;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 >= t1) {
          hit = false;
          break;
        }
      }
    }
    if (hit) return false;
  }
  return true;
}

export interface NavReachability {
  /** Waypoint ids reachable from the start (start included), in content order. */
  reachable: string[];
  /** All other waypoint ids. */
  unreachable: string[];
}

/** Flood fill over the edges from `startId`; everything is unreachable when the start is unknown. */
export function navReachability(nav: NavDef, startId: string): NavReachability {
  const graph = buildNavGraph(nav);
  const seen = new Set<string>();
  if (graph.positions.has(startId)) {
    const stack = [startId];
    seen.add(startId);
    while (stack.length > 0) {
      const id = stack.pop() as string;
      for (const n of graph.neighbours.get(id) ?? []) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          stack.push(n.id);
        }
      }
    }
  }
  return {
    reachable: graph.ids.filter((id) => seen.has(id)),
    unreachable: graph.ids.filter((id) => !seen.has(id)),
  };
}

export function findPlace(nav: NavDef, placeId: string): PlaceDef | undefined {
  return nav.places.find((p) => p.id === placeId);
}
