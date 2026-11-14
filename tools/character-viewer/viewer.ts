// Development tool (Auftrag 04.5, character prototype), not part of the game build. Shows a resident GLB with the
// game's tone mapping and outdoor light rig, so the figure can be judged up close and at game-camera distance.
// URL parameters: model (default ../../public/models/residents/n-002.glb), view = close | game | side | back,
// clip = idle | walk | talk, time (seconds into the clip; the animation is frozen there for screenshots).
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRenderer } from '../../src/world/renderer';
import { LIGHT } from '../../src/world/world';

const params = new URLSearchParams(location.search);
const url = params.get('model') ?? '/models/residents/n-002.glb';
const view = params.get('view') ?? 'close';
const clipName = params.get('clip') ?? 'idle';
const time = Number(params.get('time') ?? '0.5');

const renderer = createRenderer(document.body);
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new Scene();
scene.background = new Color(0xcfe2ec);
scene.add(new HemisphereLight(LIGHT.skyColor, LIGHT.groundColor, LIGHT.hemisphere));
scene.add(new AmbientLight(0xffffff, LIGHT.ambient));
const sun = new DirectionalLight(LIGHT.sunColor, LIGHT.sun);
sun.position.set(-9, 17, 11);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 60 });
sun.shadow.radius = LIGHT.shadowRadius;
scene.add(sun);
const ground = new Mesh(new PlaneGeometry(20, 20), new MeshLambertMaterial({ color: 0xbdb8ae }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new PerspectiveCamera(view === 'game' ? 42 : 30, window.innerWidth / window.innerHeight, 0.05, 100);
const result: { ok: boolean; info?: unknown; error?: string } = { ok: false };
(window as unknown as { __viewer: typeof result }).__viewer = result;

new GLTFLoader().load(
  url,
  (gltf) => {
    const model = gltf.scene;
    // expr=friendly:1,blink:0.5 sets morph target influences (facial expressions) by name.
    const expr = new Map((params.get('expr') ?? '').split(',').filter(Boolean).map((p) => {
      const [k, v] = p.split(':');
      return [k, Number(v ?? '1')] as const;
    }));
    const morphs = new Set<string>();
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const dict = m.morphTargetDictionary;
      if (dict && m.morphTargetInfluences) {
        for (const [name, i] of Object.entries(dict)) {
          morphs.add(name);
          m.morphTargetInfluences[i] = expr.get(name) ?? 0;
        }
      }
    });
    scene.add(model);
    const mixer = new AnimationMixer(model);
    const clip = gltf.animations.find((c) => c.name === clipName) ?? gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
    mixer.setTime(time);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    let triangles = 0;
    model.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
    });
    const h = size.y;
    if (view === 'game') {
      // Same offset as the game's follow camera (0, 9, 10) looking at 1.2 m above the figure.
      camera.position.set(0, 9 + 1.2, 10);
      camera.lookAt(0, 1.2, 0);
    } else {
      const dir = view === 'side' ? new Vector3(1, 0.05, 0) : view === 'back' ? new Vector3(0, 0.1, -1) : new Vector3(0.25, 0.08, 1);
      const target = view === 'close' && params.get('face') ? new Vector3(0, h * 0.9, 0) : new Vector3(0, h * 0.55, 0);
      const dist = params.get('face') ? 0.75 : 3.2;
      camera.position.copy(target).addScaledVector(dir.normalize(), dist);
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
    result.ok = true;
    result.info = { morphs: [...morphs], clips: gltf.animations.map((c) => `${c.name} ${c.duration.toFixed(2)}s`), size: size.toArray().map((v) => +v.toFixed(3)), triangles, calls: renderer.info.render.calls };
  },
  undefined,
  (error) => {
    result.error = String(error);
  },
);
