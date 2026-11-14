import {
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { Materials } from '../../materials';

/**
 * Shared kit of the procedural resident figures (N-002, N-003, N-006, N-007, fallback).
 * Every figure is built from a handful of unit geometries (scaled per mesh) and colour-shared Lambert
 * materials, so four residents cost a few dozen draw calls and no per-frame allocations.
 * Pivot at the feet, front = +Z at rotation 0, one unit = one metre.
 */

export type ResidentAnimation = 'walk' | 'idle' | 'talk';

export interface ResidentFigure {
  /** Asset id the figure was built for (the fallback figure reports the requested id). */
  assetId: string;
  /** Feet pivot, facing +Z. */
  root: Group;
  /** Top of the figure at rest in metres. */
  height: number;
  /** Head centre height in metres (debug screen anchor). */
  headHeight: number;
  /** Advances the animation. `speed` in m/s, `talking` plays the conversation gestures. No allocations. */
  update(dt: number, speed: number, talking: boolean): void;
  /** What the figure currently shows (derived from the last update). */
  animation(): ResidentAnimation;
}

export type ResidentFactory = (assetId: string, m: Materials) => ResidentFigure;

/** Tuning of the shared animation per figure: this is what makes the gaits recognisable. */
export interface GaitStyle {
  /** Walk-cycle phase in radians per metre walked (small = long strides). */
  strideRadPerMetre: number;
  /** Speed (m/s) at which the swing amplitudes below apply; slower/faster scales them. */
  refSpeed: number;
  legSwing: number;
  armSwing: number;
  /** Per-arm multiplier of `armSwing` (carried objects swing less). */
  armSwingL: number;
  armSwingR: number;
  /** Vertical bounce in metres. */
  bob: number;
  /** Baseline forward lean of the torso (stoop) in radians. */
  stoop: number;
  /** Extra lean while walking at `refSpeed`. */
  walkLean: number;
  /** Baseline head pitch (positive = looking down). */
  headPitch: number;
  /** Outward angle of the hanging arms. */
  armRest: number;
  /** Sideways weight shift (radians of torso roll) while standing. */
  sway: number;
  /** Breathing: relative torso height change. */
  breath: number;
  /** Which arm gestures while talking. */
  talkArm: 'left' | 'right';
  /** Gesture amplitude (radians). */
  gesture: number;
  /** Nod amplitude (radians). */
  nod: number;
  /** Walking speed pace of the idle look-around speed (Hz-ish multiplier). */
  idlePace: number;
}

export interface ResidentRig {
  root: Group;
  /** Moves as a whole (bounce, weight shift); holds legs and torso. */
  body: Group;
  /** Pivot at the hips; the upper body hangs off it. */
  torso: Group;
  head: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
}

interface UnitGeometries {
  box: BoxGeometry;
  sphere: SphereGeometry;
  /** Coarser sphere for small parts (eyes, nose, ears, hands, joints). */
  bead: SphereGeometry;
  dome: SphereGeometry;
  cylinder: CylinderGeometry;
  /** Skirt: top radius 0.72, bottom 1. */
  taper: CylinderGeometry;
  /** Total height 3.2, radius 0.5; the cylindrical middle is 2.2 tall (torso shapes). */
  capsule: CapsuleGeometry;
}

interface KitCache {
  geometries: UnitGeometries;
  materials: Map<number, MeshLambertMaterial>;
}

const caches = new WeakMap<Materials, KitCache>();

function cacheFor(m: Materials): KitCache {
  const hit = caches.get(m);
  if (hit) return hit;
  const made: KitCache = {
    geometries: {
      box: new BoxGeometry(1, 1, 1),
      sphere: new SphereGeometry(1, 14, 10),
      bead: new SphereGeometry(1, 8, 6),
      dome: new SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      cylinder: new CylinderGeometry(1, 1, 1, 10),
      taper: new CylinderGeometry(0.72, 1, 1, 12),
      capsule: new CapsuleGeometry(0.5, 2.2, 3, 10),
    },
    materials: new Map(),
  };
  caches.set(m, made);
  return made;
}

type Vec3 = readonly [number, number, number];

/** Builds meshes from the shared unit geometries; one instance per figure. */
export class PartKit {
  private readonly g: UnitGeometries;
  private readonly mats: Map<number, MeshLambertMaterial>;
  /** Every mesh created through this kit (used for shadow flags and statistics). */
  readonly meshes: Mesh[] = [];

  constructor(m: Materials) {
    const c = cacheFor(m);
    this.g = c.geometries;
    this.mats = c.materials;
  }

  /** Colour-shared material: the same hex always yields the same material object. */
  mat(hex: number): MeshLambertMaterial {
    const hit = this.mats.get(hex);
    if (hit) return hit;
    const made = new MeshLambertMaterial({ color: hex });
    this.mats.set(hex, made);
    return made;
  }

  private place(parent: Object3D, geometry: BufferGeometry, material: Material, scale: Vec3, pos: Vec3, rot?: Vec3): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    parent.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  /** Box of size w x h x d centred at pos. */
  box(parent: Object3D, hex: number, size: Vec3, pos: Vec3, rot?: Vec3): Mesh {
    return this.place(parent, this.g.box, this.mat(hex), size, pos, rot);
  }

  /** Ellipsoid with the given radii (small ones automatically use the coarser geometry). */
  sphere(parent: Object3D, hex: number, radii: Vec3, pos: Vec3, rot?: Vec3): Mesh {
    const small = Math.max(radii[0], radii[1], radii[2]) < 0.1;
    return this.place(parent, small ? this.g.bead : this.g.sphere, this.mat(hex), radii, pos, rot);
  }

  /** Upper hemisphere (caps, helmets, hair) with the given radii. */
  dome(parent: Object3D, hex: number, radii: Vec3, pos: Vec3, rot?: Vec3): Mesh {
    return this.place(parent, this.g.dome, this.mat(hex), radii, pos, rot);
  }

  /** Upright cylinder: radii in x/z, length along y. */
  cylinder(parent: Object3D, hex: number, rx: number, length: number, rz: number, pos: Vec3, rot?: Vec3): Mesh {
    return this.place(parent, this.g.cylinder, this.mat(hex), [rx, length, rz], pos, rot);
  }

  /** Flared skirt: narrower at the top. */
  taper(parent: Object3D, hex: number, rx: number, length: number, rz: number, pos: Vec3): Mesh {
    return this.place(parent, this.g.taper, this.mat(hex), [rx, length, rz], pos);
  }

  /** Torso-like capsule of overall width w, height h, depth d (centred at pos). */
  capsule(parent: Object3D, hex: number, size: Vec3, pos: Vec3): Mesh {
    return this.place(parent, this.g.capsule, this.mat(hex), [size[0], size[1] / 3.2, size[2]], pos);
  }
}

export interface RigOptions {
  /** Hip height in metres (legs hang from here). */
  hipY: number;
  /** Half distance of the hip joints. */
  hipX: number;
  /** Shoulder joint height above the hips and its half distance. */
  shoulderY: number;
  shoulderX: number;
  /** Neck (head pivot) height above the hips. */
  neckY: number;
}

/** Empty skeleton of groups; the figure builders hang meshes on it. */
export function createRig(name: string, o: RigOptions): ResidentRig {
  const root = new Group();
  root.name = name;
  const body = new Group();
  const torso = new Group();
  torso.position.y = o.hipY;
  const head = new Group();
  head.position.y = o.neckY;
  const armL = new Group();
  armL.position.set(-o.shoulderX, o.shoulderY, 0);
  const armR = new Group();
  armR.position.set(o.shoulderX, o.shoulderY, 0);
  const legL = new Group();
  legL.position.set(-o.hipX, o.hipY, 0);
  const legR = new Group();
  legR.position.set(o.hipX, o.hipY, 0);
  torso.add(head, armL, armR);
  body.add(torso, legL, legR);
  root.add(body);
  return { root, body, torso, head, armL, armR, legL, legR };
}

/** Eyes, nose and ears on a head group; the face looks along +Z. `r` = head radius, `cy` = head centre in head space. */
export function addFace(kit: PartKit, head: Group, skin: number, r: number, cy: number, squash = 1): void {
  kit.sphere(head, skin, [r * 0.94, r * squash, r], [0, cy, 0]);
  kit.sphere(head, skin, [r * 0.17, r * 0.2, r * 0.2], [0, cy - r * 0.08, r * 0.98]);
  for (const x of [-1, 1]) {
    kit.sphere(head, 0x2a2420, [r * 0.07, r * 0.09, r * 0.05], [x * r * 0.36, cy + r * 0.12, r * 0.9]);
    kit.sphere(head, skin, [r * 0.12, r * 0.22, r * 0.14], [x * r * 0.95, cy, 0]);
  }
}

/** Arm hanging along -Y from its shoulder pivot: sleeve down to `sleeveLen`, bare below, hand at the end. */
export function addArm(
  kit: PartKit,
  arm: Group,
  o: { length: number; radius: number; sleeve: number; sleeveLen: number; skin: number; handRadius?: number },
): void {
  kit.sphere(arm, o.sleeve, [o.radius * 1.15, o.radius * 1.15, o.radius * 1.15], [0, 0, 0]);
  kit.cylinder(arm, o.sleeve, o.radius, o.sleeveLen, o.radius, [0, -o.sleeveLen / 2, 0]);
  const bare = o.length - o.sleeveLen;
  if (bare > 0.01) kit.cylinder(arm, o.skin, o.radius * 0.88, bare, o.radius * 0.88, [0, -o.sleeveLen - bare / 2, 0]);
  const hr = o.handRadius ?? o.radius * 1.05;
  kit.sphere(arm, o.skin, [hr, hr * 1.1, hr], [0, -o.length - hr * 0.5, 0]);
}

/** Leg hanging along -Y from the hip pivot with a shoe; `length` = hip height minus sole. */
export function addLeg(
  kit: PartKit,
  leg: Group,
  o: { hipY: number; radius: number; cloth: number; shoe: number; shoeSize?: Vec3; taper?: number },
): void {
  const len = o.hipY - 0.07;
  kit.cylinder(leg, o.cloth, o.radius, len, o.radius * (o.taper ?? 0.9), [0, -len / 2, 0]);
  const s = o.shoeSize ?? [0.13, 0.09, 0.28];
  kit.box(leg, o.shoe, s, [0, -o.hipY + s[1] / 2, s[2] * 0.2]);
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
/** Frame-rate independent smoothing factor. */
const smooth = (dt: number, rate: number): number => 1 - Math.exp(-dt * rate);

export interface FigureInit {
  assetId: string;
  rig: ResidentRig;
  style: GaitStyle;
  kit: PartKit;
  /** Distinct per figure so residents never breathe or shift in sync. */
  seed: number;
}

/**
 * Wraps a built rig into a `ResidentFigure`: walk cycle driven by distance walked (so legs match the speed),
 * breathing and weight shift when standing, gesturing and nodding while talking. Pure scalar math per frame.
 */
export function finishFigure(init: FigureInit): ResidentFigure {
  const { rig, style: s, kit, seed } = init;
  for (const mesh of kit.meshes) mesh.receiveShadow = false;
  let phase = seed * 1.7;
  let time = seed * 3.1;
  let walkW = 0;
  let talkW = 0;
  let mode: ResidentAnimation = 'idle';
  const idleSeed = seed * 2.3;

  const figure: ResidentFigure = {
    assetId: init.assetId,
    root: rig.root,
    height: 0,
    headHeight: 0,
    update(dt, speed, talking) {
      time += dt;
      const moving = speed > 0.06 && !talking;
      if (speed > 0.06) phase += speed * dt * s.strideRadPerMetre;
      walkW += ((moving ? 1 : 0) - walkW) * smooth(dt, 9);
      talkW += ((talking ? 1 : 0) - talkW) * smooth(dt, 8);
      mode = talking ? 'talk' : moving ? 'walk' : 'idle';

      const amp = walkW * clamp(speed / s.refSpeed, 0.35, 1.35);
      const sin = Math.sin(phase);
      const standing = 1 - walkW;
      const idleLook = standing * (1 - talkW);

      rig.legL.rotation.x = sin * s.legSwing * amp;
      rig.legR.rotation.x = -sin * s.legSwing * amp;

      const restL = -s.armRest;
      const restR = s.armRest;
      rig.armL.rotation.x = -sin * s.armSwing * s.armSwingL * amp;
      rig.armR.rotation.x = sin * s.armSwing * s.armSwingR * amp;
      rig.armL.rotation.z = restL;
      rig.armR.rotation.z = restR;
      // Idle: arms hang with a tiny breathing motion.
      const breatheArm = Math.sin(time * 1.7 + idleSeed) * 0.015 * standing;
      rig.armL.rotation.x += breatheArm;
      rig.armR.rotation.x -= breatheArm;

      // Talking: one arm lifts and gestures, the other stays relaxed.
      if (talkW > 0.001) {
        const gesture = rig.armR;
        const other = rig.armL;
        const g = s.talkArm === 'right' ? gesture : other;
        const wave = Math.sin(time * 4.6) * s.gesture + Math.sin(time * 2.1) * s.gesture * 0.5;
        g.rotation.x += (-0.8 + wave - g.rotation.x) * talkW;
        g.rotation.z += ((s.talkArm === 'right' ? 0.55 : -0.55) - g.rotation.z) * talkW;
      }

      rig.body.position.y = Math.abs(sin) * s.bob * amp;
      rig.body.position.x = Math.sin(time * 0.5 + idleSeed) * 0.012 * standing;
      rig.torso.rotation.x = s.stoop + s.walkLean * amp + talkW * 0.04;
      rig.torso.rotation.z = Math.sin(phase) * 0.035 * amp + Math.sin(time * 0.45 + idleSeed) * s.sway * standing;
      rig.torso.rotation.y = -Math.sin(phase) * 0.12 * amp;
      rig.torso.scale.y = 1 + Math.sin(time * 1.7 + idleSeed) * s.breath;

      rig.head.rotation.x = s.headPitch - s.stoop * 0.55 + Math.sin(time * 3.4) * s.nod * talkW;
      rig.head.rotation.y =
        Math.sin(time * 1.4) * 0.14 * talkW + Math.sin(time * 0.4 * s.idlePace + idleSeed) * 0.22 * idleLook;
      rig.head.rotation.z = Math.sin(time * 0.9 + idleSeed) * 0.03 * idleLook;
    },
    animation: () => mode,
  };

  // Rest pose -> measured height.
  figure.update(0, 0, false);
  rig.root.updateMatrixWorld(true);
  figure.height = new Box3().setFromObject(rig.root).max.y;
  figure.headHeight = rig.head.getWorldPosition(new Vector3()).y + 0.17;
  return figure;
}

/** Deterministic small number from an asset id (animation phase offsets). */
export function seedFromId(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i += 1) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 100;
}
