import { AnimationMixer, Box3, Group, type AnimationAction, type Mesh, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ResidentAnimation, ResidentFigure } from './kit';

/**
 * Residents that have a hand-checked GLB model (Auftrag 04.5, character prototype). The model is built by
 * `tools/characters/build_mh_resident.py` (Blender, from CC0 MakeHuman data) and served from `public/`. Contract of the file: one skinned figure,
 * 1 unit = 1 m, pivot at the feet, front +Z, clips named "idle", "walk" (one stride cycle) and "talk".
 * Residents without an entry keep their procedural figure.
 */
export const RESIDENT_MODELS: Readonly<Record<string, { url: string; walkSpeed: number }>> = {
  // walkSpeed: the speed (m/s) at which the walk clip plays at its authored rate.
  'N-002': { url: 'models/residents/n-002.glb', walkSpeed: 0.9 },
};

const loads = new Map<string, Promise<GLTF>>();

/** Loads a model once per URL (shared by every resident using it). */
export function loadResidentModel(url: string): Promise<GLTF> {
  let p = loads.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url);
    loads.set(url, p);
  }
  return p;
}

const smooth = (dt: number, rate: number): number => 1 - Math.exp(-dt * rate);

/**
 * A resident figure from a GLB: its own skeleton clone, an animation mixer and the three clips blended by the same
 * rules as the procedural figures (walk weight follows the speed, talk overrides, idle fills the rest).
 */
export function createGlbResident(assetId: string, gltf: GLTF, walkSpeed: number): ResidentFigure {
  const root = new Group();
  root.name = assetId;
  const model = cloneSkinned(gltf.scene);
  model.traverse((o: Object3D) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // Skinned meshes move beyond their bind-pose bounds; the figure is small, culling it per mesh saves nothing.
    mesh.frustumCulled = false;
  });
  root.add(model);
  const mixer = new AnimationMixer(model);
  const action = (name: string): AnimationAction | null => {
    const clip = gltf.animations.find((c) => c.name === name);
    if (!clip) return null;
    const a = mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    return a;
  };
  const idle = action('idle');
  const walk = action('walk');
  const talk = action('talk');
  idle?.setEffectiveWeight(1);
  mixer.update(0);
  const box = new Box3().setFromObject(model);
  const height = box.max.y;

  let walkW = 0;
  let talkW = 0;
  let mode: ResidentAnimation = 'idle';
  return {
    assetId,
    root,
    height,
    headHeight: height - 0.13,
    update(dt, speed, talking) {
      const moving = speed > 0.06 && !talking;
      walkW += ((moving ? 1 : 0) - walkW) * smooth(dt, 8);
      talkW += ((talking ? 1 : 0) - talkW) * smooth(dt, 6);
      mode = talking ? 'talk' : moving ? 'walk' : 'idle';
      const w = Math.min(1, walkW);
      const t = Math.min(1 - w, talkW);
      walk?.setEffectiveWeight(w);
      talk?.setEffectiveWeight(t);
      idle?.setEffectiveWeight(Math.max(0, 1 - w - t));
      if (walk) walk.timeScale = Math.min(1.6, Math.max(0.5, speed / walkSpeed));
      mixer.update(dt);
    },
    animation: () => mode,
  };
}
