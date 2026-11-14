import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import type { Game } from '../../game/game';
import type { Rect } from '../../game/types';

/**
 * Decorations of neighbourhood events (Auftrag 05, 5.3). Shown on event days (all day, not only within the hours), built
 * once and only toggled. Purely visual: no collision, no game state. Colours are fictional (the club "SV Grubenlicht 09"
 * plays in blue and gold).
 */

export const DECORATION_IDS = ['decor.football', 'decor.streetfest', 'decor.fleamarket', 'decor.christmas', 'decor.heatwave'] as const;

export interface EventDecorView {
  readonly root: Object3D;
  update(): void;
  /** Debug: decorations currently shown. */
  visible(): string[];
  dispose(): void;
}

interface Owned {
  geometries: BufferGeometry[];
  materials: Material[];
}

function lambert(owned: Owned, color: number): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color });
  owned.materials.push(m);
  return m;
}

/** A string of triangular pennants between two points, sagging in the middle. */
function bunting(owned: Owned, from: Vector3, to: Vector3, colors: number[], sag = 0.35): Object3D {
  const group = new Group();
  const count = Math.max(4, Math.round(from.distanceTo(to) / 0.42));
  const tri = new BufferGeometry();
  tri.setAttribute('position', new Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
  tri.computeVertexNormals();
  owned.geometries.push(tri);
  const point = (t: number): Vector3 => from.clone().lerp(to, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  const dir = to.clone().sub(from).setY(0).normalize();
  const yaw = Math.atan2(dir.x, dir.z) - Math.PI / 2;
  colors.forEach((color, ci) => {
    const mat = new MeshLambertMaterial({ color, side: 2 });
    owned.materials.push(mat);
    const n = Math.ceil(count / colors.length);
    const mesh = new InstancedMesh(tri, mat, n);
    const m = new Matrix4();
    let used = 0;
    for (let i = ci; i < count; i += colors.length) {
      const p = point((i + 0.5) / count);
      m.makeRotationY(yaw).setPosition(p);
      mesh.setMatrixAt(used, m);
      used += 1;
    }
    mesh.count = used;
    group.add(mesh);
  });
  // The cord.
  const cordGeo = new CylinderGeometry(0.008, 0.008, 1, 4);
  owned.geometries.push(cordGeo);
  const cordMat = lambert(owned, 0x3a332c);
  const segments = 8;
  for (let i = 0; i < segments; i += 1) {
    const a = point(i / segments);
    const b = point((i + 1) / segments);
    const cord = new Mesh(cordGeo, cordMat);
    cord.position.copy(a).lerp(b, 0.5);
    cord.scale.set(1, a.distanceTo(b), 1);
    cord.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
    group.add(cord);
  }
  return group;
}

function pole(owned: Owned, x: number, z: number, height: number, color = 0x5d5f62): Mesh {
  const geo = new CylinderGeometry(0.035, 0.04, height, 8);
  owned.geometries.push(geo);
  const mesh = new Mesh(geo, lambert(owned, color));
  mesh.position.set(x, height / 2, z);
  mesh.castShadow = true;
  return mesh;
}

function buildFootball(owned: Owned, k: Rect, height: number): Object3D {
  const g = new Group();
  const club = [0x1f4fa8, 0xf2c230];
  const y = height - 0.3;
  // Two club pennant strings from the kiosk's front corners to poles at the kerb.
  g.add(pole(owned, k.minX - 1.6, 4.85, 2.9, 0x1f4fa8), pole(owned, k.maxX + 1.6, 4.85, 2.9, 0x1f4fa8));
  g.add(bunting(owned, new Vector3(k.minX, y, k.maxZ), new Vector3(k.minX - 1.6, 2.85, 4.85), club, 0.3));
  g.add(bunting(owned, new Vector3(k.maxX, y, k.maxZ), new Vector3(k.maxX + 1.6, 2.85, 4.85), club, 0.3));
  // Club flag on the roof (blue with a gold band), fictional.
  g.add(pole(owned, k.maxX - 0.3, k.maxZ - 0.3, height + 1.4));
  const flagGeo = new BoxGeometry(0.9, 0.55, 0.02);
  owned.geometries.push(flagGeo);
  const flag = new Mesh(flagGeo, lambert(owned, 0x1f4fa8));
  flag.position.set(k.maxX - 0.3 - 0.47, height + 1.1, k.maxZ - 0.3);
  const bandGeo = new BoxGeometry(0.9, 0.12, 0.025);
  owned.geometries.push(bandGeo);
  const band = new Mesh(bandGeo, lambert(owned, 0xf2c230));
  band.position.copy(flag.position);
  g.add(flag, band);
  return g;
}

function buildStreetfest(owned: Owned, k: Rect, height: number): Object3D {
  const g = new Group();
  const colors = [0xd94a3a, 0xf2c230, 0x3b8f5a, 0x2f6bc9, 0xf08a2c];
  const y = height - 0.3;
  g.add(pole(owned, k.minX - 3.2, 4.85, 3.0), pole(owned, k.maxX + 3.2, 4.85, 3.0));
  g.add(bunting(owned, new Vector3(k.minX, y, k.maxZ), new Vector3(k.minX - 3.2, 2.95, 4.85), colors));
  g.add(bunting(owned, new Vector3(k.maxX, y, k.maxZ), new Vector3(k.maxX + 3.2, 2.95, 4.85), colors));
  g.add(bunting(owned, new Vector3(k.minX - 3.2, 2.95, 4.85), new Vector3(k.maxX + 3.2, 2.95, 4.85), colors, 0.5));
  return g;
}

function buildFleamarket(owned: Owned): Object3D {
  const g = new Group();
  const top = new BoxGeometry(1.8, 0.04, 0.6);
  const leg = new BoxGeometry(0.04, 0.72, 0.04);
  const box = new BoxGeometry(0.4, 0.25, 0.3);
  owned.geometries.push(top, leg, box);
  const wood = lambert(owned, 0xd8c7a3);
  const legMat = lambert(owned, 0x6b6b6b);
  const goods = [0x9c5b3b, 0x5b7fa3, 0xc9a24a, 0x7a9a5a, 0xb46b8a].map((c) => lambert(owned, c));
  const tables = [
    { x: 6.2, z: -1.6, r: 0.1 },
    { x: 8.6, z: -2.4, r: -0.25 },
  ];
  tables.forEach((t, ti) => {
    const table = new Group();
    const plate = new Mesh(top, wood);
    plate.position.y = 0.74;
    plate.castShadow = true;
    table.add(plate);
    for (const [lx, lz] of [[-0.8, -0.25], [0.8, -0.25], [-0.8, 0.25], [0.8, 0.25]] as const) {
      const l = new Mesh(leg, legMat);
      l.position.set(lx, 0.36, lz);
      table.add(l);
    }
    for (let i = 0; i < 3; i += 1) {
      const item = new Mesh(box, goods[(i + ti * 2) % goods.length] as MeshLambertMaterial);
      item.position.set(-0.55 + i * 0.55, 0.89, (i % 2) * 0.1 - 0.05);
      item.rotation.y = i * 0.4;
      item.castShadow = true;
      table.add(item);
    }
    table.position.set(t.x, 0, t.z);
    table.rotation.y = t.r;
    g.add(table);
  });
  return g;
}

function buildChristmas(owned: Owned, k: Rect, height: number): Object3D {
  const g = new Group();
  // Warm light string along the front roof edge (unlit spheres: they glow).
  const bulbGeo = new SphereGeometry(0.035, 6, 4);
  owned.geometries.push(bulbGeo);
  const bulbMat = new MeshBasicMaterial({ color: new Color(0xffd37a), toneMapped: false });
  owned.materials.push(bulbMat);
  const count = 30;
  const bulbs = new InstancedMesh(bulbGeo, bulbMat, count);
  const m = new Matrix4();
  const q = new Quaternion();
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const x = k.minX + 0.05 + (k.maxX - k.minX - 0.1) * t;
    const sag = 0.08 * Math.abs(Math.sin(t * Math.PI * 6));
    m.compose(new Vector3(x, height - 0.12 - sag, k.maxZ + 0.1), q, new Vector3(1, 1, 1));
    bulbs.setMatrixAt(i, m);
  }
  g.add(bulbs);
  // Small fir tree east of the kiosk.
  const tree = new Group();
  const greens = lambert(owned, 0x2f5e3a);
  for (const [r, h, y] of [[0.55, 0.8, 0.55], [0.42, 0.7, 0.95], [0.28, 0.6, 1.3]] as const) {
    const cone = new ConeGeometry(r, h, 10);
    owned.geometries.push(cone);
    const c = new Mesh(cone, greens);
    c.position.y = y;
    c.castShadow = true;
    tree.add(c);
  }
  const trunkGeo = new CylinderGeometry(0.06, 0.07, 0.3, 6);
  owned.geometries.push(trunkGeo);
  const trunk = new Mesh(trunkGeo, lambert(owned, 0x5b3d26));
  trunk.position.y = 0.15;
  tree.add(trunk);
  tree.position.set(k.maxX + 0.6, 0, k.maxZ - 0.6);
  g.add(tree);
  return g;
}

function buildHeatwave(owned: Owned, k: Rect): Object3D {
  const g = new Group();
  const x = k.minX - 0.6;
  const z = k.maxZ + 0.35;
  g.add(pole(owned, x, z, 2.35, 0xdedede));
  const canopyGeo = new ConeGeometry(1.25, 0.45, 12, 1, true);
  owned.geometries.push(canopyGeo);
  const canopyMat = new MeshLambertMaterial({ color: 0xe9e2cf, side: 2 });
  owned.materials.push(canopyMat);
  const canopy = new Mesh(canopyGeo, canopyMat);
  canopy.position.set(x, 2.45, z);
  canopy.castShadow = true;
  g.add(canopy);
  return g;
}

export function createEventDecorView(game: Game, kiosk: { footprint: Rect; height: number }): EventDecorView {
  const owned: Owned = { geometries: [], materials: [] };
  const root = new Group();
  root.name = 'event-decorations';
  const k = kiosk.footprint;
  const decorations: Record<string, Object3D> = {
    'decor.football': buildFootball(owned, k, kiosk.height),
    'decor.streetfest': buildStreetfest(owned, k, kiosk.height),
    'decor.fleamarket': buildFleamarket(owned),
    'decor.christmas': buildChristmas(owned, k, kiosk.height),
    'decor.heatwave': buildHeatwave(owned, k),
  };
  for (const [id, object] of Object.entries(decorations)) {
    object.name = id;
    object.visible = false;
    root.add(object);
  }
  let lastKey = '';
  const update = (): void => {
    const env = game.weather.environment();
    const key = `${env.day}|${env.eventsToday.join(',')}`;
    if (key === lastKey) return;
    lastKey = key;
    const wanted = new Set(
      (game.content.events ?? []).filter((e) => env.eventsToday.includes(e.id) && e.decoration).map((e) => e.decoration as string),
    );
    for (const [id, object] of Object.entries(decorations)) object.visible = wanted.has(id);
  };
  return {
    root,
    update,
    visible: () => Object.entries(decorations).filter(([, o]) => o.visible).map(([id]) => id),
    dispose() {
      for (const g of owned.geometries) g.dispose();
      for (const m of owned.materials) m.dispose();
    },
  };
}
