import { AnimationClip, BoxGeometry, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack } from 'three';
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
});
