import { BoxGeometry, Group, Mesh, type Material, type Object3D } from 'three';
import type { FurnitureDef } from '../../game/types';
import type { Materials } from '../materials';

function part(w: number, h: number, d: number, material: Material, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function rigFor(def: FurnitureDef, assetId: string): { root: Group; w: number; d: number } {
  const r = def.rect;
  const root = new Group();
  root.name = assetId;
  // Pivot: ground centre of the footprint.
  root.position.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
  return { root, w: r.maxX - r.minX, d: r.maxZ - r.minZ };
}

/** I-001 sales counter: body, overhanging top slab, darker plinth. */
export function createCounterI001(def: FurnitureDef, m: Materials): Object3D {
  const { root, w, d } = rigFor(def, 'I-001');
  const topH = 0.06;
  const plinthH = 0.1;
  root.add(part(w - 0.04, def.height - topH - plinthH, d - 0.04, m.counterBody, 0, plinthH + (def.height - topH - plinthH) / 2, 0));
  root.add(part(w - 0.1, plinthH, d - 0.1, m.wood, 0, plinthH / 2, 0));
  root.add(part(w, topH, d, m.counterTop, 0, def.height - topH / 2, 0));
  return root;
}

/** I-003 wall shelf: two uprights, a back panel and evenly spaced boards (empty, greybox). */
export function createWallShelfI003(def: FurnitureDef, m: Materials): Object3D {
  const { root, w, d } = rigFor(def, 'I-003');
  const h = def.height;
  const board = 0.04;
  root.add(part(0.05, h, d, m.wood, -w / 2 + 0.025, h / 2, 0));
  root.add(part(0.05, h, d, m.wood, w / 2 - 0.025, h / 2, 0));
  root.add(part(w, h, 0.03, m.woodLight, 0, h / 2, -d / 2 + 0.015));
  const levels = 5;
  for (let i = 0; i < levels; i += 1) {
    const y = 0.1 + (i * (h - 0.14)) / (levels - 1);
    root.add(part(w - 0.08, board, d, m.woodLight, 0, y, 0));
  }
  return root;
}

/** Fallback for unknown furniture ids: a visible magenta block. */
export function createFurniturePlaceholder(def: FurnitureDef, m: Materials): Object3D {
  const { root, w, d } = rigFor(def, def.assetId);
  root.add(part(w, def.height, d, m.placeholder, 0, def.height / 2, 0));
  return root;
}
