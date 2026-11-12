import { describe, expect, it } from 'vitest';
import { computeReachability, isPointReachable } from './reachability';
import { testPack } from './testing/fixture-pack';

describe('computeReachability', () => {
  const grid = computeReachability(testPack.layout, testPack.assets);

  it('floods from the spawn', () => {
    expect(grid).not.toBeNull();
    if (!grid) return;
    expect(isPointReachable(grid, 0.9, 3.6)).toBe(true);
    expect(isPointReachable(grid, 2.0, 0.5)).toBe(true); // through the (open) door
    expect(isPointReachable(grid, -1.0, 0.8)).toBe(true); // behind the counter
  });

  it('does not enter solid obstacles or the wall', () => {
    if (!grid) throw new Error('no grid');
    expect(isPointReachable(grid, -1.0, 1.5)).toBe(false); // inside the counter
    expect(isPointReachable(grid, 0.0, 1.95)).toBe(false); // inside the sill wall
  });

  it('returns null when the spawn is blocked', () => {
    const layout = structuredClone(testPack.layout);
    layout.spawn.position = { x: -1.0, z: 1.5 };
    expect(computeReachability(layout, testPack.assets)).toBeNull();
  });
});
