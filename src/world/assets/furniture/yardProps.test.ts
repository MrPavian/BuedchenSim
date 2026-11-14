import { Box3, Vector3, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetDef } from '../../../game/types';
import { createMaterials } from '../../materials';
import { createFurniture, hasFurnitureFactory } from '../registry';

const asset = (assetId: string, width: number, depth: number, height: number): AssetDef => ({
  assetId,
  name: assetId,
  category: 'furniture',
  size: { width, depth, height },
  collides: false,
  allowedRotations: [0, 90, 180, 270],
  scalable: false,
});

describe('story props (flag-gated placements)', () => {
  const cases = [asset('E-004', 1.6, 0.5, 0.85), asset('I-013', 0.32, 0.1, 0.4)];

  it('have dedicated factories', () => {
    for (const a of cases) expect(hasFurnitureFactory(a.assetId), a.assetId).toBe(true);
  });

  it('match the catalog size within 2 cm with the pivot at the ground centre, also for other sizes', () => {
    const m = createMaterials();
    for (const base of cases) {
      for (const [fx, fy, fz] of [
        [1, 1, 1],
        [1.2, 0.9, 1.1],
        [0.9, 1.1, 0.95],
      ] as const) {
        const a = { ...base, size: { width: base.size.width * fx, height: base.size.height * fy, depth: base.size.depth * fz } };
        const object = createFurniture(a, m);
        object.updateMatrixWorld(true);
        const box = new Box3().setFromObject(object);
        const size = box.getSize(new Vector3());
        const where = `${a.assetId} x${fx},${fy},${fz}`;
        expect(Math.abs(size.x - a.size.width), `${where} width`).toBeLessThanOrEqual(0.02);
        expect(Math.abs(size.y - a.size.height), `${where} height`).toBeLessThanOrEqual(0.02);
        expect(Math.abs(size.z - a.size.depth), `${where} depth`).toBeLessThanOrEqual(0.02);
        expect(Math.abs(box.min.y), where).toBeLessThanOrEqual(0.02);
        expect(Math.abs((box.min.x + box.max.x) / 2), where).toBeLessThanOrEqual(0.02);
        expect(Math.abs((box.min.z + box.max.z) / 2), where).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it('the bench is built from many planks and frame parts, the photo carries a picture plane (flat colour without a DOM)', () => {
    const m = createMaterials();
    const bench = createFurniture(cases[0]!, m);
    let materials = new Set<unknown>();
    bench.traverse((o) => {
      if ((o as Mesh).isMesh) materials = materials.add((o as Mesh).material);
    });
    expect(materials.size).toBeGreaterThanOrEqual(5);
    const photo = createFurniture(cases[1]!, m);
    const picture = photo.getObjectByName('I-013.picture') as Mesh | undefined;
    expect(picture?.isMesh).toBe(true);
    expect(photo.children.length).toBeGreaterThanOrEqual(3);
  });
});
