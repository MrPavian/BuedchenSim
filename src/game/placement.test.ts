import { describe, expect, it } from 'vitest';
import { testPack } from './testing/fixture-pack';
import {
  frontStrip,
  placementBaseHeight,
  placementCollides,
  placementColliders,
  placementFootprint,
  placementFront,
  quarterTurnToRadians,
} from './placement';
import type { AssetDef, PlacementDef } from './types';

const asset = (patch: Partial<AssetDef> = {}): AssetDef => ({
  assetId: 'T-1',
  name: 'T',
  category: 'furniture',
  size: { width: 2, depth: 1, height: 1.5 },
  collides: true,
  allowedRotations: [0, 90, 180, 270],
  scalable: true,
  ...patch,
});
const placement = (patch: Partial<PlacementDef> = {}): PlacementDef => ({
  id: 'placement.t',
  assetId: 'T-1',
  position: { x: 10, z: 20 },
  rotation: 0,
  ...patch,
});

describe('placementFootprint', () => {
  it('is centred on the pivot at rotation 0 / 180', () => {
    for (const rotation of [0, 180] as const) {
      expect(placementFootprint(placement({ rotation }), asset())).toEqual({ minX: 9, maxX: 11, minZ: 19.5, maxZ: 20.5 });
    }
  });
  it('swaps width and depth at 90 / 270', () => {
    for (const rotation of [90, 270] as const) {
      expect(placementFootprint(placement({ rotation }), asset())).toEqual({ minX: 9.5, maxX: 10.5, minZ: 19, maxZ: 21 });
    }
  });
  it('applies scale', () => {
    expect(placementFootprint(placement({ scale: 2 }), asset())).toEqual({ minX: 8, maxX: 12, minZ: 19, maxZ: 21 });
  });
});

describe('placementFront', () => {
  it('matches three.js rotation.y = deg * PI / 180 applied to +Z', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const a = quarterTurnToRadians(rotation);
      // Rotation about +Y: x' = x cos + z sin, z' = -x sin + z cos, for (0, 0, 1).
      const expected = { x: Math.sin(a), z: Math.cos(a) };
      const front = placementFront({ rotation });
      expect(front.x).toBeCloseTo(expected.x, 12);
      expect(front.z).toBeCloseTo(expected.z, 12);
    }
  });
  it('has the documented directions', () => {
    expect(placementFront({ rotation: 0 })).toEqual({ x: 0, z: 1 });
    expect(placementFront({ rotation: 90 })).toEqual({ x: 1, z: 0 });
    expect(placementFront({ rotation: 180 })).toEqual({ x: 0, z: -1 });
    expect(placementFront({ rotation: 270 })).toEqual({ x: -1, z: 0 });
  });
  it('front strip lies on the front side of the footprint', () => {
    const fp = { minX: 0, maxX: 2, minZ: 0, maxZ: 1 };
    expect(frontStrip(fp, { x: 0, z: 1 }, 0.6)).toEqual({ minX: 0, maxX: 2, minZ: 1, maxZ: 1.6 });
    expect(frontStrip(fp, { x: 0, z: -1 }, 0.6)).toEqual({ minX: 0, maxX: 2, minZ: -0.6, maxZ: 0 });
    expect(frontStrip(fp, { x: 1, z: 0 }, 0.6)).toEqual({ minX: 2, maxX: 2.6, minZ: 0, maxZ: 1 });
    expect(frontStrip(fp, { x: -1, z: 0 }, 0.6)).toEqual({ minX: -0.6, maxX: 0, minZ: 0, maxZ: 1 });
  });
});

describe('collision flags and base height', () => {
  it('supported placements never collide; the override beats the asset default', () => {
    expect(placementCollides(placement(), asset())).toBe(true);
    expect(placementCollides(placement({ collides: false }), asset())).toBe(false);
    expect(placementCollides(placement(), asset({ collides: false }))).toBe(false);
    expect(placementCollides(placement({ collides: true }), asset({ collides: false }))).toBe(true);
    expect(placementCollides(placement({ on: 'placement.x', collides: true }), asset())).toBe(false);
  });

  const { layout, assets } = testPack;
  it('base height is 0 on the ground and the supporter top when "on" is set', () => {
    const counter = layout.placements.find((p) => p.id === 'placement.counter') as PlacementDef;
    const register = layout.placements.find((p) => p.id === 'placement.register') as PlacementDef;
    expect(placementBaseHeight(counter, layout, assets)).toBe(0);
    expect(placementBaseHeight(register, layout, assets)).toBe(1.0);
  });

  it('colliders list only colliding placements with their footprints', () => {
    const colliders = placementColliders(layout, assets);
    expect(colliders.map((c) => c.placementId)).toEqual([
      'placement.counter',
      'placement.wall-shelf-north',
      'placement.wall-shelf-west',
    ]);
    const counter = colliders[0]?.rect;
    expect(counter?.minX).toBeCloseTo(-2.4, 9);
    expect(counter?.maxX).toBeCloseTo(0.4, 9);
    expect(counter?.minZ).toBeCloseTo(1.2, 9);
    expect(counter?.maxZ).toBeCloseTo(1.85, 9);
    const west = colliders[2]?.rect;
    expect(west?.maxX).toBeCloseTo(-2.45, 9);
    expect(west?.maxZ).toBeCloseTo(1.0, 9);
  });
});
