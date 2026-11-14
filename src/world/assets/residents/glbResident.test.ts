import { AnimationClip, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { RESIDENT_MODELS, createGlbResident } from './glbResident';

/** A stand-in for a loaded GLB: a 1.7 m box figure with the three named clips. */
function fakeGltf(): GLTF {
  const scene = new Group();
  const body = new Mesh(new BoxGeometry(0.5, 1.7, 0.3), new MeshBasicMaterial());
  body.name = 'body';
  body.position.y = 0.85;
  scene.add(body);
  const clip = (name: string) => new AnimationClip(name, 1, [new NumberKeyframeTrack('body.position[x]', [0, 1], [0, 0])]);
  return { scene, animations: [clip('idle'), clip('walk'), clip('talk')] } as unknown as GLTF;
}

describe('GLB resident figure', () => {
  it('registers the Günter prototype (N-002) with a model inside public/', () => {
    expect(RESIDENT_MODELS['N-002']?.url).toBe('models/residents/n-002.glb');
  });

  it('measures the height from the model and keeps its own copy of the scene', () => {
    const gltf = fakeGltf();
    const a = createGlbResident('N-002', gltf, 0.9);
    const b = createGlbResident('N-002', gltf, 0.9);
    expect(a.height).toBeCloseTo(1.7, 2);
    expect(a.headHeight).toBeLessThan(a.height);
    expect(a.root.children[0]).not.toBe(b.root.children[0]);
    let shadow = 0;
    a.root.traverse((o) => {
      if ((o as Mesh).isMesh && o.castShadow) shadow += 1;
    });
    expect(shadow).toBe(1);
  });

  it('switches between idle, walk and talk like the procedural figures', () => {
    const f = createGlbResident('N-002', fakeGltf(), 0.9);
    expect(f.animation()).toBe('idle');
    f.update(0.1, 0.9, false);
    expect(f.animation()).toBe('walk');
    f.update(0.1, 0.9, true);
    expect(f.animation()).toBe('talk');
    f.update(0.1, 0, false);
    expect(f.animation()).toBe('idle');
  });

  it('blinks now and then and shows expressions only while talking', () => {
    const gltf = fakeGltf();
    const body = gltf.scene.getObjectByName('body') as Mesh;
    const n = body.geometry.getAttribute('position').count;
    body.geometry.morphAttributes.position = ['friendly', 'thoughtful', 'blink'].map(
      () => new Float32BufferAttribute(new Float32Array(n * 3), 3),
    );
    body.updateMorphTargets();
    body.morphTargetDictionary = { friendly: 0, thoughtful: 1, blink: 2 };
    const f = createGlbResident('N-002', gltf, 0.9);
    let face: Mesh | undefined;
    f.root.traverse((o) => {
      if ((o as Mesh).isMesh) face = o as Mesh;
    });
    const w = face!.morphTargetInfluences!;
    const at = (i: number): number => w[i] ?? 0;
    let maxBlink = 0;
    for (let i = 0; i < 400; i++) {
      f.update(1 / 50, 0, false);
      maxBlink = Math.max(maxBlink, at(2));
      expect(at(0) + at(1)).toBeLessThan(0.01);
    }
    expect(maxBlink).toBeGreaterThan(0.5);
    for (let i = 0; i < 100; i++) f.update(1 / 50, 0, true);
    expect(at(0)).toBeGreaterThan(0.9);
    for (let i = 0; i < 150; i++) f.update(1 / 50, 0, true);
    expect(at(1)).toBeGreaterThan(0.5);
    for (let i = 0; i < 200; i++) f.update(1 / 50, 0, false);
    expect(at(0) + at(1)).toBeLessThan(0.05);
  });
});

