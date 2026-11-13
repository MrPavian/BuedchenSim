import { Box3, Mesh, Raycaster, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import type { StockSlotDef } from '../game/types';
import { getFurnitureMaterials } from '../world/assets/furniture/materials';
import { createFurniture } from '../world/assets/registry';
import { createMaterials } from '../world/materials';

/**
 * The slot boxes are derived from the furniture factories by hand; this test builds the real factories and checks
 * that every slot bottom rests on a surface (+-2 cm) and has free headroom. The blank placeholder magazine covers
 * of the magazine rack are ignored: the world layer replaces them with real stock.
 */
const { layout, assets, stockSlots } = ruhrgebietPack;
const TOL = 0.02;

interface Face {
  y: number;
  up: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function inspect(assetId: string) {
  const materials = createMaterials();
  const placeholders = new Set<Material>(getFurnitureMaterials(materials).covers);
  const root = createFurniture(assets[assetId] as never, materials);
  root.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  root.traverse((o: Object3D) => {
    const mesh = o as Mesh;
    if (mesh.isMesh && !placeholders.has(mesh.material as Material)) meshes.push(mesh);
  });

  const faces: Face[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (const mesh of meshes) {
    const g: BufferGeometry = mesh.geometry;
    const pos = g.getAttribute('position');
    const index = g.getIndex();
    const count = index ? index.count : pos.count;
    const at = (i: number) => (index ? index.getX(i) : i);
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(pos, at(i)).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, at(i + 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, at(i + 2)).applyMatrix4(mesh.matrixWorld);
      if (Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.y - c.y) > 1e-6) continue; // horizontal triangles only
      const normalY = b.clone().sub(a).cross(c.clone().sub(a)).y;
      if (Math.abs(normalY) < 1e-12) continue;
      faces.push({
        y: a.y,
        up: normalY > 0,
        minX: Math.min(a.x, b.x, c.x),
        maxX: Math.max(a.x, b.x, c.x),
        minZ: Math.min(a.z, b.z, c.z),
        maxZ: Math.max(a.z, b.z, c.z),
      });
    }
  }
  const raycaster = new Raycaster();
  const cast = (x: number, y: number, z: number, dir: number): number | null => {
    raycaster.set(new Vector3(x, y, z), new Vector3(0, dir, 0));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.point.y : null;
  };
  return { faces, cast, box: new Box3().setFromObject(root) };
}

const overlaps = (f: Face, s: StockSlotDef): boolean =>
  f.minX < s.origin.x + s.size.width / 2 - 1e-6 &&
  f.maxX > s.origin.x - s.size.width / 2 + 1e-6 &&
  f.minZ < s.origin.z + s.size.depth / 2 - 1e-6 &&
  f.maxZ > s.origin.z - s.size.depth / 2 + 1e-6;

describe('stock slots <-> real furniture geometry', () => {
  const byAsset = new Map<string, StockSlotDef[]>();
  for (const slot of stockSlots) {
    const placement = layout.placements.find((p) => p.id === slot.placementId);
    if (!placement) throw new Error(slot.placementId);
    byAsset.set(placement.assetId, [...(byAsset.get(placement.assetId) ?? []), slot]);
  }

  it('covers every presenting furniture asset', () => {
    expect([...byAsset.keys()].sort()).toEqual(['I-001', 'I-003', 'I-004', 'I-005', 'I-006', 'I-007']);
  });

  for (const [assetId, slots] of byAsset) {
    describe(`${assetId} ${assets[assetId]?.name ?? ''}`, () => {
      const geometry = inspect(assetId);
      for (const slot of slots) {
        it(`${slot.id}: bottom rests on a surface and the headroom is free`, () => {
          const { x, z } = slot.origin;
          const top = slot.origin.y + slot.size.height;
          const resting =
            geometry.faces.some((f) => f.up && overlaps(f, slot) && Math.abs(f.y - slot.origin.y) <= TOL) ||
            Math.abs((geometry.cast(x, slot.origin.y + 0.05, z, -1) ?? Number.NEGATIVE_INFINITY) - slot.origin.y) <= TOL;
          expect(resting, `${slot.id} y=${slot.origin.y}`).toBe(true);

          // No horizontal face (board, lid, top) inside the volume between bottom + tolerance and the top.
          const blocking = geometry.faces.filter((f) => overlaps(f, slot) && f.y > slot.origin.y + TOL + 1e-6 && f.y < top - 1e-3);
          expect(blocking.map((f) => f.y), `${slot.id} headroom`).toEqual([]);

          // Tilted surfaces (magazine trays) and anything else above: rays upward from five points.
          const hw = slot.size.width / 2 - 0.01;
          const hd = slot.size.depth / 2 - 0.01;
          for (const [dx, dz] of [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]] as const) {
            const hit = geometry.cast(x + dx, slot.origin.y + 0.03, z + dz, 1);
            expect(hit === null || hit >= top - 0.01, `${slot.id} ray ${dx},${dz} hits ${hit}`).toBe(true);
          }
        });
      }
    });
  }
});
