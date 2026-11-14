import { Group, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import type { AssetDef, PlacementDef, RegionLayout } from '../game/types';
import { createPlacementGates } from '../world/placementGates';

const baseAsset = (assetId: string, collides: boolean, size = { width: 1.6, depth: 0.5, height: 0.85 }): AssetDef => ({
  assetId,
  name: assetId,
  category: 'furniture',
  size,
  collides,
  allowedRotations: [0, 90, 180, 270],
  scalable: false,
});

describe('flag-gated placements', () => {
  const assets: Record<string, AssetDef> = {
    ...ruhrgebietPack.assets,
    'E-004': baseAsset('E-004', true),
    'I-013': baseAsset('I-013', false, { width: 0.32, depth: 0.1, height: 0.4 }),
  };
  const bench: PlacementDef = {
    id: 'test.bench',
    assetId: 'E-004',
    position: { x: -6, z: 8 },
    rotation: 0,
    requiresFlag: 'story.bench-built',
  };
  const photo: PlacementDef = {
    id: 'test.photo',
    assetId: 'I-013',
    position: { x: -6, z: 8 },
    rotation: 0,
    on: 'test.bench',
    requiresFlag: 'story.photo-hung',
  };
  const plain: PlacementDef = { id: 'test.plain', assetId: 'E-004', position: { x: 6, z: 8 }, rotation: 0 };
  const layout: RegionLayout = {
    ...ruhrgebietPack.layout,
    placements: [...ruhrgebietPack.layout.placements, bench, photo, plain],
  };
  const objects = new Map<string, Object3D>(layout.placements.map((p) => [p.id, new Group()]));
  const gates = createPlacementGates(layout, assets, objects);
  const covers = (rects: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>, x: number, z: number): boolean =>
    rects.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);

  it('hides gated placements and their colliders until the flag is set; ungated ones stay', () => {
    const colliders = gates.apply({});
    expect(objects.get(bench.id)?.visible).toBe(false);
    expect(objects.get(plain.id)?.visible).toBe(true);
    expect(covers(colliders.open, -6, 8)).toBe(false);
    expect(covers(colliders.closed, -6, 8)).toBe(false);
    expect(covers(colliders.closed, 6, 8)).toBe(true);
    expect(gates.list().filter((g) => [bench.id, photo.id].includes(g.id))).toEqual([
      { id: bench.id, visible: false },
      { id: photo.id, visible: false },
    ]);
  });

  it('shows the object and enables the collision when the flag turns true, and back when it turns false', () => {
    let colliders = gates.apply({ 'story.bench-built': true });
    expect(objects.get(bench.id)?.visible).toBe(true);
    expect(covers(colliders.open, -6, 8)).toBe(true);
    expect(covers(colliders.closed, -6, 8)).toBe(true);
    colliders = gates.apply({ 'story.bench-built': false });
    expect(objects.get(bench.id)?.visible).toBe(false);
    expect(covers(colliders.open, -6, 8)).toBe(false);
  });

  it('an item standing on a gated placement is hidden with it', () => {
    gates.apply({ 'story.photo-hung': true });
    expect(objects.get(photo.id)?.visible).toBe(false); // bench flag missing
    gates.apply({ 'story.photo-hung': true, 'story.bench-built': true });
    expect(objects.get(photo.id)?.visible).toBe(true);
    expect(gates.list().filter((g) => [bench.id, photo.id].includes(g.id)).every((g) => g.visible)).toBe(true);
  });

  it('keeps the door-dependent colliders of the kiosk (closed vs open differ only by the door leaf)', () => {
    const colliders = gates.apply({ 'story.bench-built': true });
    expect(colliders.closed).not.toEqual(colliders.open);
  });
});
