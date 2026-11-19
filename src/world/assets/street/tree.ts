import { BufferAttribute, BufferGeometry, Group, IcosahedronGeometry, Mesh, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { taper } from './geo';
import { getStreetMaterials } from './materials';

/** Deterministic jitter in [-1, 1] for a (quantised) vertex position, so shared corners move together. */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (Math.round(x * 100) * 73856093) ^ (Math.round(y * 100) * 19349663) ^ (Math.round(z * 100) * 83492791) ^ (seed * 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

interface Blob {
  x: number;
  y: number;
  z: number;
  r: number;
  mat: 'leafA' | 'leafB' | 'leafC';
}

/** Crown blobs relative to the crown centre (metres, before the final fit to the catalog size). */
const BLOBS: Blob[] = [
  { x: 0, y: 0, z: 0, r: 1.15, mat: 'leafA' },
  { x: -0.85, y: -0.35, z: 0.45, r: 0.85, mat: 'leafB' },
  { x: 0.8, y: -0.2, z: -0.5, r: 0.9, mat: 'leafC' },
  { x: 0.2, y: 0.75, z: 0.2, r: 0.8, mat: 'leafB' },
  { x: -0.2, y: -0.15, z: -0.9, r: 0.75, mat: 'leafA' },
];

/**
 * E-007 Straßenbaum (3.2 x 3.2 x 6.0 m). Deciduous street tree: tapered trunk with two branch stubs and a crown of
 * five low-poly icosahedron blobs with seeded vertex jitter (flat shaded, three leaf tones baked as vertex colours). The crown is a child
 * group named 'crown' whose origin sits at the top of the trunk, so wind sway (6.3/6.5) can rotate it. Extents are
 * fitted so the bounding box equals the catalog size. Collision uses only the trunk (AssetDef.collider).
 */
export function createTreeE007(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const trunkTop = h * 0.5;
  const root = new Group();
  root.name = asset.assetId;

  const trunk = new PartBuilder({ vertexColors: s.baked });
  trunk.geometry(s.bark, taper(0.2, 0.28, 0, 0.35, 0, 0, 10));
  trunk.geometry(s.bark, taper(0.12, 0.2, 0.35, trunkTop + 0.3, 0, 0, 10));
  trunk.bar(s.bark, [0, trunkTop - 0.2, 0], [-0.55, trunkTop + 0.55, 0.25], 0.12);
  trunk.bar(s.bark, [0, trunkTop - 0.1, 0], [0.5, trunkTop + 0.6, -0.2], 0.1);
  for (const child of trunk.build('trunk').children) root.add(child);

  // Crown: blobs merged per leaf material, then fitted to w x d and the top at h.
  const byMaterial = new Map<Material, BufferGeometry[]>();
  BLOBS.forEach((blob, index) => {
    const g = new IcosahedronGeometry(blob.r, 1);
    const pos = g.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const k = 1 + hash3(x, y, z, index + 1) * 0.14;
      pos.setXYZ(i, x * k + blob.x, y * k * 0.9 + blob.y, z * k + blob.z);
    }
    g.computeVertexNormals();
    const c = s[blob.mat].color;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    const list = byMaterial.get(s.baked);
    if (list) list.push(g);
    else byMaterial.set(s.baked, [g]);
  });
  // Bounds over all blobs.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const list of byMaterial.values()) {
    for (const g of list) {
      g.computeBoundingBox();
      const bb = g.boundingBox;
      if (!bb) continue;
      minX = Math.min(minX, bb.min.x);
      maxX = Math.max(maxX, bb.max.x);
      minY = Math.min(minY, bb.min.y);
      maxY = Math.max(maxY, bb.max.y);
      minZ = Math.min(minZ, bb.min.z);
      maxZ = Math.max(maxZ, bb.max.z);
    }
  }
  const crownBottom = trunkTop - 0.1;
  const sx = w / (maxX - minX);
  const sz = d / (maxZ - minZ);
  const sy = (h - crownBottom) / (maxY - minY);
  const crown = new Group();
  crown.name = 'crown';
  crown.position.y = trunkTop;
  for (const [material, list] of byMaterial) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) throw new Error('Could not merge tree crown');
    merged.translate(-(minX + maxX) / 2, -minY, -(minZ + maxZ) / 2);
    merged.scale(sx, sy, sz);
    merged.translate(0, crownBottom - trunkTop, 0);
    const mesh = new Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  }
  root.add(crown);
  return root;
}
