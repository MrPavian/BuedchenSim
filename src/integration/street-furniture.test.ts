import { Box3, Vector3, type Mesh, type MeshLambertMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../content/assets/catalog';
import { createMaterials } from '../world/materials';
import { createFurniture, hasFurnitureFactory } from '../world/assets/registry';
import { getStreetMaterials } from '../world/assets/street/materials';

const IDS = ['E-003', 'E-005', 'E-006', 'E-007', 'E-008', 'E-012', 'E-013', 'E-014'];

describe('street furniture (E-003 .. E-014)', () => {
  const m = createMaterials();

  it('has a catalog entry with a dedicated factory for every id', () => {
    for (const id of IDS) {
      expect(assetCatalog[id], id).toBeDefined();
      expect(hasFurnitureFactory(id), id).toBe(true);
    }
  });

  it('builds to the catalog size (+-2 cm) with the pivot at the ground centre', () => {
    for (const id of IDS) {
      const asset = assetCatalog[id];
      if (!asset) throw new Error(id);
      const object = createFurniture(asset, m);
      object.updateMatrixWorld(true);
      const box = new Box3().setFromObject(object);
      const size = box.getSize(new Vector3());
      expect(Math.abs(size.x - asset.size.width), `${id} width`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(size.y - asset.size.height), `${id} height`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(size.z - asset.size.depth), `${id} depth`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(box.min.y), `${id} ground`).toBeLessThanOrEqual(0.02);
      expect(Math.abs((box.min.x + box.max.x) / 2), `${id} centre x`).toBeLessThanOrEqual(0.02);
      expect(Math.abs((box.min.z + box.max.z) / 2), `${id} centre z`).toBeLessThanOrEqual(0.02);
    }
  });

  it('collider footprints (lantern mast, tree trunk, sign post) are smaller than the box', () => {
    for (const id of ['E-003', 'E-007', 'E-012']) {
      const a = assetCatalog[id];
      expect(a?.collider, id).toBeDefined();
      expect(a?.collider?.width ?? 99).toBeLessThan(a?.size.width ?? 0);
    }
  });

  it('the lantern glass uses the shared material "lampGlow" (emissive, intensity 0, no light source)', () => {
    const lantern = createFurniture(assetCatalog['E-003']!, m);
    const glow: MeshLambertMaterial[] = [];
    let lights = 0;
    lantern.traverse((o) => {
      if ((o as { isLight?: boolean }).isLight) lights += 1;
      const mat = (o as Mesh).material as MeshLambertMaterial | undefined;
      if (mat?.name === 'lampGlow') glow.push(mat);
    });
    expect(glow).toHaveLength(1);
    expect(glow[0]).toBe(getStreetMaterials(m).lampGlow);
    expect(glow[0]?.emissive.getHex()).toBe(0xffd9a0);
    expect(glow[0]?.emissiveIntensity).toBe(0);
    expect(lights).toBe(0);
  });

  it('the tree has a "crown" group and is deterministic', () => {
    const a = createFurniture(assetCatalog['E-007']!, m);
    const b = createFurniture(assetCatalog['E-007']!, m);
    const crownA = a.getObjectByName('crown');
    expect(crownA?.children.length).toBeGreaterThanOrEqual(1);
    const positions = (o: typeof a): number[] => {
      const out: number[] = [];
      o.getObjectByName('crown')?.traverse((c) => {
        const g = (c as Mesh).geometry;
        if (g) out.push(...Array.from(g.getAttribute('position').array.slice(0, 30)));
      });
      return out;
    };
    expect(positions(a)).toEqual(positions(b));
  });

  it('shares materials across instances', () => {
    const one = createFurniture(assetCatalog['E-014']!, m);
    const two = createFurniture(assetCatalog['E-014']!, m);
    const mats = (o: typeof one): Set<unknown> => {
      const s = new Set<unknown>();
      o.traverse((c) => {
        if ((c as Mesh).isMesh) s.add((c as Mesh).material);
      });
      return s;
    };
    expect([...mats(one)].every((x) => mats(two).has(x))).toBe(true);
  });
});
