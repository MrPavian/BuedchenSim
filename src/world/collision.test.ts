import { describe, expect, it } from 'vitest';
import { testPack } from '../game/testing/fixture-pack';
import { moveCircle, resolvePosition } from './collision';
import { kioskColliders } from './kioskGeometry';

const ruhrgebietLayout = testPack.layout;

const R = 0.3;
const bounds = ruhrgebietLayout.walkBounds;
const { kiosk, furniture } = ruhrgebietLayout;
const closed = kioskColliders(kiosk, furniture, false);
const open = kioskColliders(kiosk, furniture, true);

/** Walks with a fixed step like the game loop and returns the final position. */
function walk(
  from: { x: number; z: number },
  dir: { x: number; z: number },
  seconds: number,
  obstacles = closed,
  speed = 3.5,
  dt = 1 / 60,
) {
  let p = from;
  const len = Math.hypot(dir.x, dir.z);
  for (let t = 0; t < seconds; t += dt) {
    p = moveCircle(p, { x: (dir.x / len) * speed * dt, z: (dir.z / len) * speed * dt }, R, obstacles, bounds);
  }
  return p;
}

describe('collision', () => {
  it('free movement is unchanged', () => {
    const p = moveCircle({ x: 0, z: 4 }, { x: 0.5, z: -0.2 }, R, closed, bounds);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.z).toBeCloseTo(3.8);
  });

  it('is blocked by the south wall (closed door and wall alike)', () => {
    for (const x of [0.9, 2.0, -1.0, -2.7]) {
      const p = walk({ x, z: 3.6 }, { x: 0, z: -1 }, 3);
      expect(p.z).toBeGreaterThan(2 + R - 1e-6);
    }
  });

  it('slides along the wall when moving diagonally', () => {
    const p = walk({ x: -1, z: 3.6 }, { x: 1, z: -1 }, 1.5);
    expect(p.z).toBeGreaterThanOrEqual(2 + R - 1e-6);
    expect(p.x).toBeGreaterThan(0.5);
  });

  it('passes through the door gap only when the door is open', () => {
    const through = walk({ x: 2.0, z: 3.0 }, { x: 0, z: -1 }, 1.0, open);
    expect(through.z).toBeLessThan(1.9);
    expect(through.x).toBeCloseTo(2.0, 5);
    const blocked = walk({ x: 2.0, z: 3.0 }, { x: 0, z: -1 }, 1.0, closed);
    expect(blocked.z).toBeGreaterThan(2 + R - 1e-6);
  });

  it('does not enter through the sales window even with the shutter open', () => {
    const p = walk({ x: -1, z: 3.2 }, { x: 0, z: -1 }, 2);
    expect(p.z).toBeGreaterThan(2 + R - 1e-6);
  });

  it('the interior is blocked by the counter', () => {
    const p = walk({ x: -1.0, z: 0.0 }, { x: 0, z: 1 }, 2, open);
    expect(p.z).toBeLessThanOrEqual(1.2 - R + 1e-6);
  });

  it('does not stick in the outer corner of the building', () => {
    const p = walk({ x: 4, z: 3.5 }, { x: -1, z: -1 }, 1.5);
    expect(p.z).toBeGreaterThanOrEqual(2 + R - 1e-6);
    expect(p.x).toBeLessThan(4); // slides west along the south wall
  });

  it('can walk around the building', () => {
    let p = { x: 4.5, z: 3.5 };
    p = walk(p, { x: 0, z: -1 }, 2.5); // north along the east wall
    expect(p.z).toBeLessThan(-2.3);
    p = walk(p, { x: -1, z: 0 }, 3); // west behind the kiosk
    expect(p.x).toBeLessThan(-3.3);
  });

  it('stays within the bounds', () => {
    expect(walk({ x: 10, z: 4 }, { x: 1, z: 1 }, 2)).toEqual({ x: bounds.maxX, z: bounds.maxZ });
    const p = walk({ x: -10, z: -6 }, { x: -1, z: -1 }, 2);
    expect(p.x).toBe(bounds.minX);
    expect(p.z).toBe(bounds.minZ);
  });

  it('does not tunnel through the wall with a huge step', () => {
    const p = moveCircle({ x: 0.9, z: 3.6 }, { x: 0, z: -6 }, R, closed, bounds);
    expect(p.z).toBeGreaterThan(2 + R - 1e-6);
    const q = moveCircle({ x: 0.9, z: 3.6 }, { x: 0, z: -6 }, R, open, bounds);
    // x = 0.9 is beside the door gap, still the wall
    expect(q.z).toBeGreaterThan(2 + R - 1e-6);
  });

  it('pushes a position that starts inside an obstacle out of it', () => {
    const p = resolvePosition({ x: 0.9, z: 1.95 }, R, closed, bounds);
    const inside = p.x > -3 && p.x < 3 && p.z > 1.85 && p.z < 2;
    expect(inside).toBe(false);
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
  });

  it('zero movement is a no-op', () => {
    expect(moveCircle({ x: 1, z: 4 }, { x: 0, z: 0 }, R, closed, bounds)).toEqual({ x: 1, z: 4 });
  });
});
