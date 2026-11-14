import { AnimationMixer, Box3, Group, Vector3, type AnimationAction, type Mesh, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ResidentAnimation, ResidentFigure } from './kit';

/**
 * Residents that have a GLB model (Auftrag 04.5/04.6). The models are built by `tools/characters/build_mh_resident.py`
 * (Blender, from CC0 MakeHuman data) and served from `public/`. Contract of a file: one skinned figure, 1 unit = 1 m,
 * pivot at the feet, front +Z, clips named "idle", "walk" (one stride cycle) and "talk"; optional morph targets
 * "friendly", "thoughtful" and "blink" on the face meshes. Residents without an entry keep their procedural figure.
 */
export const RESIDENT_MODELS: Readonly<Record<string, { url: string; walkSpeed: number }>> = {
  // walkSpeed: the speed (m/s) at which the walk clip plays at its authored rate (stride length per second).
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

/** Deterministic pseudo-random sequence per figure (no Math.random: reproducible screenshots and tests). */
function sequence(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Facial expression state: weights per morph name, eased towards their targets. */
interface FaceMorph {
  influences: number[];
  index: Partial<Record<'friendly' | 'thoughtful' | 'blink', number>>;
}

/** While talking the face alternates between friendly and thoughtful, each held for a few seconds. */
const TALK_PHASES: readonly { mood: 'friendly' | 'thoughtful'; seconds: number }[] = [
  { mood: 'friendly', seconds: 3.2 },
  { mood: 'thoughtful', seconds: 2.4 },
  { mood: 'friendly', seconds: 2.6 },
];

/**
 * A resident figure from a GLB: its own skeleton clone, an animation mixer and the three clips blended by the same
 * rules as the procedural figures (walk weight follows the speed, talk overrides, idle fills the rest). Faces with
 * morph targets blink now and then and show a friendly or thoughtful expression while talking.
 */
export function createGlbResident(assetId: string, gltf: GLTF, walkSpeed: number): ResidentFigure {
  const root = new Group();
  root.name = assetId;
  const model = cloneSkinned(gltf.scene);
  const faces: FaceMorph[] = [];
  model.traverse((o: Object3D) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // Skinned meshes move beyond their bind-pose bounds; the figure is small, culling it per mesh saves nothing.
    mesh.frustumCulled = false;
    const dict = mesh.morphTargetDictionary;
    if (dict && mesh.morphTargetInfluences) {
      faces.push({
        influences: mesh.morphTargetInfluences,
        index: { friendly: dict.friendly, thoughtful: dict.thoughtful, blink: dict.blink },
      });
    }
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
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const height = box.max.y;
  // Head height (speech bubble, look target) from the head bone when present: correct under caps and helmets.
  const headBone = model.getObjectByName('head');
  const headHeight = headBone ? headBone.getWorldPosition(new Vector3()).y + 0.1 : height - 0.13;

  const random = sequence(assetId);
  let walkW = 0;
  let talkW = 0;
  let mode: ResidentAnimation = 'idle';
  let nextBlink = 1.5 + random() * 3;
  let blinkT = -1;
  let talkTime = 0;
  const mood = { friendly: 0, thoughtful: 0 };

  const setMorph = (name: 'friendly' | 'thoughtful' | 'blink', value: number): void => {
    for (const f of faces) {
      const i = f.index[name];
      if (i !== undefined) f.influences[i] = value;
    }
  };

  const updateFace = (dt: number, talking: boolean): void => {
    if (faces.length === 0) return;
    // Blink: about every 2.5-6 s, 0.18 s closing and opening.
    nextBlink -= dt;
    if (blinkT < 0 && nextBlink <= 0) {
      blinkT = 0;
      nextBlink = 2.5 + random() * 3.5;
    }
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      blink = Math.max(0, 1 - Math.abs(blinkT - 0.09) / 0.09);
      if (blinkT > 0.18) blinkT = -1;
    }
    // Expression: neutral unless talking; while talking cycle through TALK_PHASES with soft transitions.
    let target: 'friendly' | 'thoughtful' | null = null;
    if (talking) {
      talkTime += dt;
      const total = TALK_PHASES.reduce((s, p) => s + p.seconds, 0);
      let t = talkTime % total;
      for (const p of TALK_PHASES) {
        if (t < p.seconds) {
          target = p.mood;
          break;
        }
        t -= p.seconds;
      }
    } else {
      talkTime = 0;
    }
    const k = smooth(dt, 3);
    mood.friendly += ((target === 'friendly' ? 1 : 0) - mood.friendly) * k;
    mood.thoughtful += ((target === 'thoughtful' ? 1 : 0) - mood.thoughtful) * k;
    setMorph('friendly', mood.friendly);
    setMorph('thoughtful', mood.thoughtful);
    setMorph('blink', blink);
  };

  return {
    assetId,
    root,
    height,
    headHeight,
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
      updateFace(dt, talking);
    },
    animation: () => mode,
  };
}
