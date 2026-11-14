import { describe, expect, it } from 'vitest';
import { constrainToCircles, moveCircle, type Circle } from './collision';
import { PLAYER_RADIUS } from '../game/constants';
import { NPC_RADIUS } from '../game/balance';

const BOUNDS = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const R = PLAYER_RADIUS;
const resident: Circle = { x: 0, z: 0, r: NPC_RADIUS };

describe('player <-> resident circle collision', () => {
  it('returns the target unchanged when no circle is hit', () => {
    const to = { x: 3, z: 0 };
    expect(constrainToCircles({ x: 4, z: 0 }, to, R, [resident])).toBe(to);
    expect(constrainToCircles({ x: 4, z: 0 }, to, R, [])).toBe(to);
  });

  it('stops the player at the sum of both radii when walking straight into a resident', () => {
    const p = moveCircle({ x: 2, z: 0 }, { x: -3, z: 0 }, R, [], BOUNDS, [resident]);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(R + NPC_RADIUS - 1e-6);
    expect(p.x).toBeCloseTo(R + NPC_RADIUS, 3);
    expect(p.z).toBeCloseTo(0, 3);
  });

  it('slides around the resident when approaching off-centre (no tunnelling, no sticking)', () => {
    let p = { x: 2, z: 0.15 };
    for (let i = 0; i < 120; i += 1) {
      p = moveCircle(p, { x: -0.05, z: 0 }, R, [], BOUNDS, [resident]);
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(R + NPC_RADIUS - 1e-6);
    }
    // Passed the resident on the +z side instead of getting stuck on the near side.
    expect(p.x).toBeLessThan(-0.3);
    expect(p.z).toBeGreaterThan(0.3);
  });

  it('cannot be pushed through the resident by a long step (sub-stepped)', () => {
    const p = moveCircle({ x: 1.5, z: 0 }, { x: -3, z: 0 }, R, [], BOUNDS, [resident]);
    expect(p.x).toBeGreaterThan(0);
  });

  it('never moves a standing player, even when a resident overlaps him', () => {
    const from = { x: 0.3, z: 0 };
    expect(constrainToCircles(from, from, R, [resident])).toBe(from);
  });

  it('lets an overlapped player walk away but not deeper in', () => {
    const from = { x: 0.3, z: 0 };
    const away = constrainToCircles(from, { x: 0.5, z: 0 }, R, [resident]);
    expect(away).toEqual({ x: 0.5, z: 0 });
    const deeper = constrainToCircles(from, { x: 0.1, z: 0 }, R, [resident]);
    expect(Math.hypot(deeper.x, deeper.z)).toBeGreaterThanOrEqual(0.3 - 1e-9);
  });

  it('keeps blocking with several residents and does not push the player into walls', () => {
    const wall = { minX: -5, maxX: 5, minZ: -2, maxZ: -1.4 };
    const circles: Circle[] = [
      { x: 0, z: -0.5, r: NPC_RADIUS },
      { x: 0.9, z: -0.5, r: NPC_RADIUS },
    ];
    let p = { x: 0.45, z: 1 };
    for (let i = 0; i < 80; i += 1) {
      p = moveCircle(p, { x: 0, z: -0.05 }, R, [wall], BOUNDS, circles);
      for (const c of circles) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThanOrEqual(R + c.r - 0.02);
      expect(p.z).toBeGreaterThanOrEqual(wall.maxZ + R - 1e-6);
    }
  });
});
