import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, PlaneGeometry, type Object3D } from 'three';
import type { GroundAreaDef } from '../../game/types';
import { createNoiseTexture, createSlabTexture, palette, type Materials } from '../materials';

/** Top of the walkable sidewalk slab; the kiosk floor uses the same height. */
export const SIDEWALK_HEIGHT = 0.03;
const CURB_HEIGHT = 0.12;

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

/** E-001 sidewalk: thin concrete slab with a visible 1 m slab/joint pattern. */
export function createSidewalkE001(def: GroundAreaDef, m: Materials): Object3D {
  const { w, d, cx, cz } = dims(def);
  const texture = createSlabTexture();
  texture.repeat.set(w / 4, d / 4);
  m.textures.push(texture);
  const mesh = new Mesh(new BoxGeometry(w, SIDEWALK_HEIGHT, d), new MeshLambertMaterial({ map: texture }));
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
  const texture = createNoiseTexture(palette.asphalt, 0.12, 5);
  texture.repeat.set(w / 4, d / 4);
  m.textures.push(texture);
  root.add(flatPlane(def, new MeshLambertMaterial({ map: texture }), 0.001));

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
  return root;
}

export function createCurb(def: GroundAreaDef, m: Materials): Object3D {
  const { w, d, cx, cz } = dims(def);
  const mesh = new Mesh(new BoxGeometry(w, CURB_HEIGHT, d), m.curb);
  mesh.position.set(cx, CURB_HEIGHT / 2, cz);
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
