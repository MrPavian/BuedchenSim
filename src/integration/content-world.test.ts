import { Box3, Euler, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import { validateContent } from '../content/validate';
import { kioskColliders } from '../game/kioskGeometry';
import { placementColliders, placementFootprint, placementFront, quarterTurnToRadians } from '../game/placement';
import { createFurniture, hasFurnitureFactory } from '../world/assets/registry';
import { buildWorldColliders } from '../world/colliders';
import { createMaterials } from '../world/materials';

const { layout, assets } = ruhrgebietPack;

describe('content <-> world', () => {
  it('the real pack is valid', () => {
    expect(validateContent(ruhrgebietPack)).toEqual([]);
  });

  it('dedicated factories exist for I-001 and I-003; the rest use the generic placeholder', () => {
    expect(hasFurnitureFactory('I-001')).toBe(true);
    expect(hasFurnitureFactory('I-003')).toBe(true);
    const placeholders = [...new Set(layout.placements.map((p) => p.assetId))].filter((id) => !hasFurnitureFactory(id)).sort();
    // Documented state after step A; later agents replace these with real models.
    expect(placeholders).toEqual(['I-002', 'I-004', 'I-005', 'I-006', 'I-007', 'I-011', 'I-012']);
  });

  it('every placement builds an object whose bounding box matches the asset size (+-2 cm)', () => {
    const materials = createMaterials();
    for (const placement of layout.placements) {
      const asset = assets[placement.assetId];
      if (!asset) throw new Error(`unknown asset ${placement.assetId}`);
      const object = createFurniture(asset, materials);
      object.updateMatrixWorld(true);
      const size = new Box3().setFromObject(object).getSize(new Vector3());
      expect(Math.abs(size.x - asset.size.width), `${placement.id} width`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(size.z - asset.size.depth), `${placement.id} depth`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(size.y - asset.size.height), `${placement.id} height`).toBeLessThanOrEqual(0.02);
      // Pivot = ground centre of the box.
      const box = new Box3().setFromObject(object);
      expect(Math.abs(box.min.y), placement.id).toBeLessThanOrEqual(0.02);
      expect(Math.abs((box.min.x + box.max.x) / 2), placement.id).toBeLessThanOrEqual(0.02);
      expect(Math.abs((box.min.z + box.max.z) / 2), placement.id).toBeLessThanOrEqual(0.02);
    }
  });

  it('the rotated object occupies exactly the data footprint, and its front matches placementFront', () => {
    const materials = createMaterials();
    for (const placement of layout.placements) {
      const asset = assets[placement.assetId];
      if (!asset) throw new Error(`unknown asset ${placement.assetId}`);
      const object = createFurniture(asset, materials);
      object.position.set(placement.position.x, 0, placement.position.z);
      object.rotation.y = quarterTurnToRadians(placement.rotation);
      object.updateMatrixWorld(true);
      const box = new Box3().setFromObject(object);
      const fp = placementFootprint(placement, asset);
      expect(box.min.x, placement.id).toBeCloseTo(fp.minX, 1);
      expect(box.max.x, placement.id).toBeCloseTo(fp.maxX, 1);
      expect(box.min.z, placement.id).toBeCloseTo(fp.minZ, 1);
      expect(box.max.z, placement.id).toBeCloseTo(fp.maxZ, 1);
      const front = new Vector3(0, 0, 1).applyEuler(new Euler(0, quarterTurnToRadians(placement.rotation), 0));
      expect(front.x, placement.id).toBeCloseTo(placementFront(placement).x, 9);
      expect(front.z, placement.id).toBeCloseTo(placementFront(placement).z, 9);
    }
  });

  it('world colliders equal wall segments plus placement colliders (no hand-written rects)', () => {
    const world = buildWorldColliders(layout, assets);
    const placementRects = placementColliders(layout, assets).map((c) => c.rect);
    expect(world.open).toEqual([...kioskColliders(layout.kiosk, true), ...placementRects]);
    expect(world.closed).toEqual([...kioskColliders(layout.kiosk, false), ...placementRects]);
  });
});
