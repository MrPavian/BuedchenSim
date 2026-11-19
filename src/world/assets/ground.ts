import { BoxGeometry, BufferAttribute, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, PlaneGeometry, type BufferGeometry, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GroundAreaDef } from '../../game/types';
import { createAsphaltTexture, createNoiseTexture, createSlabTexture, palette, type Materials } from '../materials';

/** Top of the walkable sidewalk slab; the kiosk floor uses the same height. */
export const SIDEWALK_HEIGHT = 0.03;
const CURB_HEIGHT = 0.12;
const LOWERED_CURB_HEIGHT = 0.03;

function dims(def: GroundAreaDef) {
  const r = def.rect;
  return { w: r.maxX - r.minX, d: r.maxZ - r.minZ, cx: (r.minX + r.maxX) / 2, cz: (r.minZ + r.maxZ) / 2 };
}

function flatPlane(def: GroundAreaDef, material: MeshLambertMaterial, y: number): Mesh {
  const { w, d, cx, cz } = dims(def);
  const mesh = new Mesh(new PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, y, cz);
  mesh.receiveShadow = true;
  return mesh;
}

/** E-001 sidewalk: thin concrete slab, one texture of 0.5 x 0.5 m plates (joints, stains, cracks); no mesh per plate. */
export function createSidewalkE001(def: GroundAreaDef, m: Materials): Object3D {
  const { w, d, cx, cz } = dims(def);
  const texture = createSlabTexture(w, d);
  m.textures.push(texture);
  // Named 'paved' so the atmosphere view can darken it when wet.
  const mesh = new Mesh(new BoxGeometry(w, SIDEWALK_HEIGHT, d), new MeshLambertMaterial({ map: texture, name: 'paved' }));
  mesh.position.set(cx, SIDEWALK_HEIGHT / 2, cz);
  mesh.receiveShadow = true;
  mesh.name = 'E-001';
  return mesh;
}

/** E-002 street: asphalt with a dashed centre line (one InstancedMesh). */
export function createStreetE002(def: GroundAreaDef, m: Materials): Object3D {
  const { w, d, cx, cz } = dims(def);
  const root = new Group();
  root.name = 'E-002';
  const texture = createAsphaltTexture(w, d);
  m.textures.push(texture);
  root.add(flatPlane(def, new MeshLambertMaterial({ map: texture, name: 'paved' }), 0.001));

  const dashLength = 2;
  const gap = 2;
  const count = Math.floor(w / (dashLength + gap));
  const dashes = new InstancedMesh(new PlaneGeometry(dashLength, 0.15), m.roadLine, count);
  const matrix = new Matrix4();
  for (let i = 0; i < count; i += 1) {
    const x = cx - w / 2 + gap / 2 + dashLength / 2 + i * (dashLength + gap);
    matrix.makeRotationX(-Math.PI / 2).setPosition(x, 0.004, cz);
    dashes.setMatrixAt(i, matrix);
  }
  dashes.receiveShadow = true;
  root.add(dashes);
  root.add(createStreetIron(def));
  return root;
}

const GRATE_FRAME = [0.14, 0.14, 0.15] as const;
const GRATE_BAR = [0.3, 0.3, 0.32] as const;
const IRON = [0.2, 0.2, 0.21] as const;

function colored(geometry: BufferGeometry, rgb: readonly [number, number, number]): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) data.set(rgb, i * 3);
  geometry.setAttribute('color', new BufferAttribute(data, 3));
  return geometry;
}

/** Gully grates along the curb (every ~8 m) and one round manhole cover in the lane: a single merged mesh. */
function createStreetIron(def: GroundAreaDef): Object3D {
  const { w, cx } = dims(def);
  const parts: BufferGeometry[] = [];
  const grateZ = def.rect.minZ + 0.15;
  for (let x = cx - w / 2 + 4; x < cx + w / 2 - 2; x += 8) {
    parts.push(colored(new BoxGeometry(0.5, 0.03, 0.3).translate(x, 0.016, grateZ), GRATE_FRAME));
    for (let i = 0; i < 5; i += 1) {
      parts.push(colored(new BoxGeometry(0.5 - 0.06, 0.012, 0.025).translate(x, 0.034, grateZ - 0.1 + i * 0.05), GRATE_BAR));
    }
  }
  // Manhole cover with a raised ring and a cross rib.
  const mx = cx + 5.5;
  const mz = def.rect.minZ + 1.7;
  parts.push(colored(new CylinderGeometry(0.34, 0.34, 0.02, 20).translate(mx, 0.011, mz), IRON));
  parts.push(colored(new CylinderGeometry(0.26, 0.26, 0.012, 20).translate(mx, 0.026, mz), GRATE_BAR));
  parts.push(colored(new BoxGeometry(0.5, 0.014, 0.04).translate(mx, 0.03, mz), IRON));
  parts.push(colored(new BoxGeometry(0.04, 0.014, 0.5).translate(mx, 0.03, mz), IRON));
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('Could not merge street ironwork');
  parts.forEach((g) => g.dispose());
  const material = new MeshLambertMaterial({ vertexColors: true, name: 'streetIron' });
  const mesh = new Mesh(merged, material);
  mesh.name = 'E-002.iron';
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * E-001-B curb: granite-grey kerb stone (about 0.12 m) with a top chamfer look (a slightly narrower cap box) and lowered
 * stretches (0.03 m, flush with the sidewalk) where `def.lowered` lists X ranges. One merged mesh.
 */
export function createCurb(def: GroundAreaDef, m: Materials): Object3D {
  const { w, d, cx, cz } = dims(def);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const lowered = [...(def.lowered ?? [])].sort((a, b) => a.from - b.from);
  const geometries: BufferGeometry[] = [];
  const stone = (from: number, to: number, height: number): void => {
    if (to - from < 1e-4) return;
    const cap = Math.min(0.025, height / 3);
    geometries.push(new BoxGeometry(to - from, height - cap, d).translate((from + to) / 2, (height - cap) / 2, cz));
    geometries.push(new BoxGeometry(to - from, cap, d - 0.05).translate((from + to) / 2, height - cap / 2, cz));
  };
  let cursor = x0;
  for (const range of lowered) {
    stone(cursor, Math.max(cursor, range.from), CURB_HEIGHT);
    stone(Math.max(cursor, range.from), Math.min(x1, range.to), LOWERED_CURB_HEIGHT);
    cursor = Math.max(cursor, Math.min(x1, range.to));
  }
  stone(cursor, x1, CURB_HEIGHT);
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error('Could not merge curb geometry');
  geometries.forEach((g) => g.dispose());
  const mesh = new Mesh(merged, m.curb);
  mesh.name = 'E-001-B';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createYard(def: GroundAreaDef, m: Materials): Object3D {
  const { w, d } = dims(def);
  const texture = createNoiseTexture(palette.yard, 0.18, 9);
  texture.repeat.set(w / 4, d / 4);
  m.textures.push(texture);
  // Named so the atmosphere view can tint the lawn by season and weather.
  const material = new MeshLambertMaterial({ map: texture, name: 'yard' });
  return flatPlane(def, material, 0);
}

export function createGroundPlaceholder(def: GroundAreaDef, m: Materials): Object3D {
  return flatPlane(def, m.placeholder, 0.002);
}
