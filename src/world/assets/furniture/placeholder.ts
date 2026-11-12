import { BoxGeometry, Group, Mesh, MeshLambertMaterial, Color, type Material, type Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';

/**
 * Generic placeholder (unknown asset ids only). Furniture factories: `(asset, materials) => Object3D`. The object is built at rotation 0 with its
 * pivot at the ground centre and a bounding box equal to `asset.size`; the front faces +Z.
 * World positions and rotates it from the placement (see world.ts).
 */

function part(w: number, h: number, d: number, material: Material, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Stable tint per asset id so different placeholders are distinguishable. */
function tintFor(assetId: string, m: Materials): MeshLambertMaterial {
  let material = m.placeholderTints.get(assetId);
  if (!material) {
    let hash = 0;
    for (const ch of assetId) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917) >>> 0;
    material = new MeshLambertMaterial({ color: new Color().setHSL((hash % 360) / 360, 0.5, 0.5) });
    m.placeholderTints.set(assetId, material);
  }
  return material;
}

/**
 * Generic placeholder for assets without a dedicated factory: a tinted box of exactly `asset.size`
 * with a lighter plate on the +Z face so the rotation is visible.
 */
export function createFurniturePlaceholder(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const plate = Math.min(0.02, d / 4);
  const root = new Group();
  root.add(part(w, h, d - plate, tintFor(asset.assetId, m), 0, h / 2, -plate / 2));
  root.add(part(w * 0.86, h * 0.8, plate, m.placeholderFront, 0, h * 0.5, d / 2 - plate / 2));
  return root;
}
