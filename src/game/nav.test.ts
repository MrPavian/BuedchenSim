import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from './constants';
import { layoutColliders } from './colliders';
import {
  buildNavGraph,
  distanceToSegment,
  edgeOrigin,
  findPath,
  nearestWaypoint,
  navEdgeClear,
  navReachability,
  pathLength,
} from './nav';
import { NPC_RADIUS } from './balance';
import { testPack } from './testing/fixture-pack';
import type { NavDef, Rect } from './types';

const nav = testPack.layout.nav;
const graph = buildNavGraph(nav);

describe('findPath', () => {
  it('finds the shortest path including both ends', () => {
    expect(findPath(graph, 'wp.exit-west', 'wp.w1')).toEqual(['wp.exit-west', 'wp.w1']);
    expect(findPath(graph, 'wp.w3', 'wp.w3')).toEqual(['wp.w3']);
    expect(findPath(graph, 'wp.exit-east', 'wp.win-a')).toEqual([
      'wp.exit-east',
      'wp.w4',
      'wp.w3',
      'wp.w2',
      'wp.win-a',
    ]);
  });

  it('prefers the shorter of two routes and takes the bypass when the direct edge is avoided', () => {
    const direct = findPath(graph, 'wp.w1', 'wp.w2');
    expect(direct).toEqual(['wp.w1', 'wp.w2']);
    const around = findPath(graph, 'wp.w1', 'wp.w2', ['wp.w2', 'wp.w1']); // order of the pair does not matter
    expect(around).toEqual(['wp.w1', 'wp.b1', 'wp.w2']);
    expect(pathLength(graph, around as string[])).toBeGreaterThan(pathLength(graph, direct as string[]));
  });

  it('returns null for unreachable or unknown waypoints', () => {
    expect(findPath(graph, 'wp.w1', 'wp.nope')).toBeNull();
    expect(findPath(graph, 'wp.nope', 'wp.w1')).toBeNull();
    expect(findPath(graph, 'wp.exit-west', 'wp.win-a', ['wp.w2', 'wp.win-a'])).toBeNull();
  });

  it('is deterministic', () => {
    expect(findPath(graph, 'wp.yard-a', 'wp.exit-west')).toEqual(findPath(graph, 'wp.yard-a', 'wp.exit-west'));
  });
});

describe('helpers', () => {
  it('finds the nearest waypoint and the edge a position lies on', () => {
    expect(nearestWaypoint(graph, { x: 4.9, z: 3.5 })).toBe('wp.w4');
    expect(edgeOrigin(graph, { x: 3, z: 3.6 }, 'wp.w3')).toBe('wp.w4');
    expect(edgeOrigin(graph, { x: 3, z: 3.0 }, 'wp.w3')).toBeNull();
  });

  it('measures the distance to a segment', () => {
    expect(distanceToSegment({ x: 1, z: 1 }, { x: 0, z: 0 }, { x: 2, z: 0 })).toBeCloseTo(1);
    expect(distanceToSegment({ x: -1, z: 0 }, { x: 0, z: 0 }, { x: 2, z: 0 })).toBeCloseTo(1);
    expect(distanceToSegment({ x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 })).toBeCloseTo(1);
  });
});

describe('navEdgeClear', () => {
  const wall: Rect = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };

  it('detects a segment through an obstacle', () => {
    expect(navEdgeClear({ x: -3, z: 0 }, { x: 3, z: 0 }, [wall], 0.3)).toBe(false);
    expect(navEdgeClear({ x: 0, z: -3 }, { x: 0, z: 3 }, [wall], 0.3)).toBe(false);
  });

  it('inflates the obstacle by the radius', () => {
    expect(navEdgeClear({ x: -3, z: 2.2 }, { x: 3, z: 2.2 }, [wall], 0.3)).toBe(true);
    expect(navEdgeClear({ x: -3, z: 1.25 }, { x: 3, z: 1.25 }, [wall], 0.3)).toBe(false); // 0.25 from the wall
    expect(navEdgeClear({ x: -3, z: 1.4 }, { x: 3, z: 1.4 }, [wall], 0.3)).toBe(true);
    expect(navEdgeClear({ x: -3, z: 1.4 }, { x: 3, z: 1.4 }, [wall], 0.5)).toBe(false);
  });

  it('counts touching as clear and handles ends inside the inflated area', () => {
    expect(navEdgeClear({ x: -3, z: 1.3 }, { x: 3, z: 1.3 }, [wall], 0.3)).toBe(true);
    expect(navEdgeClear({ x: 0, z: 2 }, { x: 0, z: 1.1 }, [wall], 0.3)).toBe(false);
    expect(navEdgeClear({ x: 5, z: 5 }, { x: 5, z: 5 }, [wall], 0.3)).toBe(true);
    expect(navEdgeClear({ x: 0, z: 0 }, { x: 0, z: 0 }, [wall], 0.3)).toBe(false);
  });

  it('accepts diagonal segments that miss the corner', () => {
    expect(navEdgeClear({ x: 2, z: 0.5 }, { x: 0.5, z: 2 }, [wall], 0.1)).toBe(true);
    expect(navEdgeClear({ x: 2, z: 0 }, { x: 0, z: 2 }, [wall], 0.1)).toBe(false);
  });

  it('every edge of the fixture graph is clear of the fixture colliders for a resident', () => {
    const colliders = layoutColliders(testPack.layout, testPack.assets, false);
    const radius = Math.max(NPC_RADIUS, PLAYER_RADIUS);
    for (const [a, b] of nav.edges) {
      const pa = graph.positions.get(a);
      const pb = graph.positions.get(b);
      expect(pa && pb && navEdgeClear(pa, pb, colliders, radius), `${a} - ${b}`).toBe(true);
    }
  });
});

describe('navReachability', () => {
  it('reaches every waypoint of the fixture from an exit', () => {
    const r = navReachability(nav, 'wp.exit-east');
    expect(r.unreachable).toEqual([]);
    expect(r.reachable).toHaveLength(nav.waypoints.length);
  });

  it('lists islands and treats an unknown start as unreachable everywhere', () => {
    const split: NavDef = {
      waypoints: [
        { id: 'wp.a', position: { x: 0, z: 0 } },
        { id: 'wp.b', position: { x: 1, z: 0 } },
        { id: 'wp.c', position: { x: 5, z: 0 } },
      ],
      edges: [['wp.a', 'wp.b']],
      places: [],
    };
    expect(navReachability(split, 'wp.a')).toEqual({ reachable: ['wp.a', 'wp.b'], unreachable: ['wp.c'] });
    expect(navReachability(split, 'wp.x').reachable).toEqual([]);
  });
});
