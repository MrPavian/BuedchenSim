// Proof of concept, NOT part of the game: starts the unchanged game (src/main.ts) and records the three.js scene and
// camera the game's renderer draws, by wrapping WebGLRenderer.prototype.render before the game is imported. Nothing in
// src/ is modified. The page offers `window.__poc` to the export script (export-scene.mjs).
import {
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Vector2,
  type BufferAttribute,
  type BufferGeometry,
  type InstancedMesh,
  type Texture,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  type WebGLRenderer,
  type Camera,
  type Light,
  type Material,
  type Object3D,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

let captured: { scene: Scene; camera: PerspectiveCamera } | null = null;
// WebGLRenderer defines `render` per instance (not on the prototype), so the hook sits on the callback every
// WebGLRenderer.render calls on the scene it draws: Scene.onBeforeRender(renderer, scene, camera).
const originalBefore = Scene.prototype.onBeforeRender;
Scene.prototype.onBeforeRender = function (this: Scene, renderer: WebGLRenderer, scene: Object3D, camera: Camera, ...rest: unknown[]) {
  if ((camera as PerspectiveCamera).isPerspectiveCamera) captured = { scene: this, camera: camera as PerspectiveCamera };
  return (originalBefore as (...a: unknown[]) => void).call(this, renderer, scene, camera, ...rest);
};

/** Objects that only make sense in the rasterizer (x-ray silhouette, depth-test-free markers): not exported. */
const EXCLUDE = new Set(['player.silhouette', 'interaction-markers']);

type AnyMaterial = Material & {
  color?: Color;
  map?: unknown;
  emissive?: Color;
  emissiveMap?: unknown;
  emissiveIntensity?: number;
  opacity: number;
  transparent: boolean;
  vertexColors: boolean;
  side: number;
};

interface Mapping {
  kind: 'glass' | 'emissive' | 'metal' | 'product' | 'diffuse';
  from: string;
  count: number;
  names: string[];
}

/**
 * The rasterizer's materials (mostly MeshLambertMaterial) carry no PBR parameters. ThreeRT reads PBR (roughness,
 * metalness, transmission, emission in nits), so every material is rewritten here by an explicit rule table on the
 * object names the game already gives its meshes. That table is the "notwendige Codeänderung" of the PoC: it lives
 * here, the game is not changed.
 */
const RULES: { kind: Mapping['kind']; test: (tokens: string[], m: AnyMaterial) => boolean; nits?: (o: ExportOptions) => number }[] = [
  { kind: 'glass', test: (t, m) => t.includes('glass') || (m.transparent && m.opacity < 0.6) },
  { kind: 'emissive', test: (t) => t.includes('glow') || t.includes('strip'), nits: (o) => o.lampNits },
  { kind: 'emissive', test: (t) => t.includes('face') && (t.includes('sign') || t.includes('plate')), nits: (o) => o.signNits },
  { kind: 'emissive', test: (_t, m) => !!m.emissive && m.emissive.getHex() !== 0, nits: (o) => o.panelNits },
  { kind: 'emissive', test: (_t, m) => m.type === 'MeshBasicMaterial', nits: (o) => o.signNits },
  { kind: 'metal', test: (t) => t.some((x) => ['metal', 'zinc', 'frame', 'downpipe', 'clamp', 'straps', 'gutter', 'arm', 'housing', 'foot'].includes(x)) },
  { kind: 'product', test: (t) => t[0] === 'stock' },
  { kind: 'diffuse', test: () => true },
];

function toPbr(source: AnyMaterial, meshName: string, stats: Map<string, Mapping>, options: ExportOptions): Material {
  const tokens = meshName.toLowerCase().split(/[.\-_]/);
  const rule = RULES.find((r) => r.test(tokens, source))!;
  const key = `${rule.kind}|${source.type}`;
  const entry = stats.get(key) ?? { kind: rule.kind, from: source.type, count: 0, names: [] };
  entry.count += 1;
  if (!entry.names.includes(meshName) && entry.names.length < 40) entry.names.push(meshName);
  stats.set(key, entry);
  const base = {
    name: `${rule.kind}:${meshName}`,
    color: source.color?.clone() ?? new Color(0xffffff),
    map: (source.map as never) ?? null,
    vertexColors: source.vertexColors,
    side: source.side,
  };
  switch (rule.kind) {
    case 'glass':
      return new MeshPhysicalMaterial({ ...base, color: new Color(0xffffff), map: null, transmission: 1, roughness: 0.03, metalness: 0, ior: 1.5, thickness: 0.004, side: DoubleSide });
    case 'emissive':
      return new MeshStandardMaterial({
        ...base,
        roughness: 0.6,
        emissive: source.emissive && source.emissive.getHex() !== 0 ? source.emissive.clone() : (source.color?.clone() ?? new Color(0xffffff)),
        emissiveMap: (source.emissiveMap as never) ?? (source.map as never) ?? null,
        emissiveIntensity: rule.nits!(options), // nits, exported as KHR_materials_emissive_strength
      });
    case 'metal':
      return new MeshStandardMaterial({ ...base, roughness: 0.35, metalness: options.metalHeuristic ? 0.9 : 0 });
    case 'product':
      return new MeshStandardMaterial({ ...base, roughness: 0.45, metalness: 0 });
    default:
      return new MeshStandardMaterial({ ...base, roughness: 0.85, metalness: 0 });
  }
}

interface ExportOptions {
  metalHeuristic: boolean;
  signNits: number;
  panelNits: number;
  lampNits: number;
}

function lightInfo(light: Light): Record<string, unknown> {
  light.updateWorldMatrix(true, false);
  const p = light.getWorldPosition(light.position.clone());
  const target = (light as unknown as { target?: Object3D }).target;
  return {
    type: light.type,
    name: light.name,
    color: `#${light.color.getHexString()}`,
    intensity: light.intensity,
    position: [p.x, p.y, p.z],
    distance: (light as unknown as { distance?: number }).distance ?? null,
    target: target ? target.getWorldPosition(target.position.clone()).toArray() : null,
    groundColor: (light as unknown as { groundColor?: Color }).groundColor?.getHexString() ?? null,
  };
}

const poc = {
  ready: (): boolean => captured !== null,
  /** What the rasterizer scene holds (types, counts) – for the compatibility report. */
  describe() {
    if (!captured) return null;
    const meshTypes: Record<string, number> = {};
    const materialTypes: Record<string, number> = {};
    const features: Record<string, number> = {};
    const add = (r: Record<string, number>, k: string): void => {
      r[k] = (r[k] ?? 0) + 1;
    };
    captured.scene.traverse((o) => {
      add(meshTypes, o.type);
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as AnyMaterial[];
      for (const m of mats) {
        add(materialTypes, m.type);
        if (m.vertexColors) add(features, 'vertexColors');
        if (m.transparent) add(features, 'transparent');
        if (m.map) add(features, 'map (CanvasTexture)');
        if (!m.depthTest) add(features, 'depthTest=false');
        if (m.depthFunc !== 3) add(features, `depthFunc=${m.depthFunc}`);
        if (m.side !== 0) add(features, `side=${m.side}`);
      }
      if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) add(features, 'InstancedMesh');
    });
    const lights: Record<string, unknown>[] = [];
    captured.scene.traverse((o) => {
      if ((o as Light).isLight) lights.push(lightInfo(o as Light));
    });
    const c = captured.camera;
    c.updateMatrixWorld(true);
    const dir = c.getWorldDirection(c.position.clone());
    return {
      meshTypes,
      materialTypes,
      features,
      lights,
      fog: captured.scene.fog ? { type: captured.scene.fog.type } : null,
      background: captured.scene.background instanceof Color ? `#${captured.scene.background.getHexString()}` : null,
      camera: {
        fov: c.fov,
        aspect: c.aspect,
        near: c.near,
        far: c.far,
        position: c.position.toArray(),
        target: c.position.clone().addScaledVector(dir, 10).toArray(),
      },
    };
  },
  /** Exports the scene (minus rasterizer-only helpers) as GLB with PBR materials; returns base64 and the mapping. */
  async exportGlb(options: ExportOptions = { metalHeuristic: true, signNits: 250, panelNits: 600, lampNits: 2500 }) {
    if (!captured) throw new Error('no scene captured yet');
    const root = captured.scene.clone(true);
    const remove: Object3D[] = [];
    const stats = new Map<string, Mapping>();
    root.traverse((o) => {
      if (EXCLUDE.has(o.name)) remove.push(o);
      if ((o as Light).isLight) remove.push(o); // lights are rebuilt in physical units in the ThreeRT scene
    });
    for (const o of remove) o.removeFromParent();
    // ThreeRT's glTF loader rejects EXT_mesh_gpu_instancing (what GLTFExporter writes for an InstancedMesh): each
    // instance becomes its own node that shares the geometry and material, which glTF and ThreeRT instance by mesh.
    const instanced: InstancedMesh[] = [];
    root.traverse((o) => {
      if ((o as InstancedMesh).isInstancedMesh) instanced.push(o as InstancedMesh);
    });
    let expanded = 0;
    for (const im of instanced) {
      const group = new Group();
      group.name = im.name;
      group.position.copy(im.position);
      group.quaternion.copy(im.quaternion);
      group.scale.copy(im.scale);
      const matrix = new Matrix4();
      for (let i = 0; i < im.count; i += 1) {
        im.getMatrixAt(i, matrix);
        const unit = new Mesh(im.geometry, im.material);
        unit.name = im.name;
        unit.matrixAutoUpdate = false;
        unit.matrix.copy(matrix);
        unit.matrix.decompose(unit.position, unit.quaternion, unit.scale);
        group.add(unit);
        expanded += 1;
      }
      if (im.visible && im.count > 0) im.parent?.add(group);
      im.removeFromParent();
    }
    // Two things ThreeRT's glTF path does not read (checked in renderer/src/scene.rs): KHR_texture_transform (texture
    // repeat/offset) and COLOR_0 (vertex colours). Repeat/offset are baked into the UVs; vertex colours are averaged
    // into the material colour (lossy: the kiosk's subtle per-face shading and the pastries' colour variation flatten).
    const cache = new Map<string, Material>();
    const geometryCache = new Map<string, BufferGeometry>();
    let bakedUv = 0;
    let bakedColours = 0;
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.parent?.name || 'mesh';
      const convert = (m: AnyMaterial): Material => {
        const map = m.map as Texture | null | undefined;
        const transformed = !!map && (map.repeat.x !== 1 || map.repeat.y !== 1 || map.offset.x !== 0 || map.offset.y !== 0 || map.rotation !== 0);
        const colours = m.vertexColors && !!mesh.geometry.getAttribute('color');
        if (transformed) {
          const key = `${mesh.geometry.uuid}|${map!.uuid}`;
          let g = geometryCache.get(key);
          if (!g) {
            g = mesh.geometry.clone();
            const uv = g.getAttribute('uv') as BufferAttribute | undefined;
            if (uv) {
              map!.updateMatrix();
              const v = new Vector2();
              for (let i = 0; i < uv.count; i += 1) {
                v.fromBufferAttribute(uv, i).applyMatrix3(map!.matrix);
                uv.setXY(i, v.x, v.y);
              }
              uv.needsUpdate = true;
            }
            geometryCache.set(key, g);
            bakedUv += 1;
          }
          mesh.geometry = g;
        }
        let average: Color | null = null;
        if (colours) {
          const c = mesh.geometry.getAttribute('color') as BufferAttribute;
          const sum = new Color(0, 0, 0);
          for (let i = 0; i < c.count; i += 1) sum.r += c.getX(i), sum.g += c.getY(i), sum.b += c.getZ(i);
          average = new Color(sum.r / c.count, sum.g / c.count, sum.b / c.count);
          bakedColours += 1;
        }
        const key = `${m.uuid}|${name.split('.').slice(0, 3).join('.')}|${transformed}|${average?.getHexString() ?? ''}`;
        const hit = cache.get(key);
        if (hit) return hit;
        let source = m;
        if (transformed || average) {
          source = (m as unknown as Material).clone() as AnyMaterial;
          if (transformed) {
            const flat = map!.clone();
            flat.repeat.set(1, 1);
            flat.offset.set(0, 0);
            flat.rotation = 0;
            flat.source = map!.source; // same image, exported once
            source.map = flat;
          }
          if (average) {
            source.color = (source.color ?? new Color(1, 1, 1)).clone().multiply(average);
            source.vertexColors = false;
          }
        }
        const converted = toPbr(source, name, stats, options);
        cache.set(key, converted);
        return converted;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => convert(m as AnyMaterial)) : convert(mesh.material as AnyMaterial);
    });
    root.background = null;
    root.fog = null;
    const exporter = new GLTFExporter();
    const glb = (await exporter.parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 2048 })) as ArrayBuffer;
    let binary = '';
    const bytes = new Uint8Array(glb);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), bytes: bytes.length, mapping: [...stats.values()], instancedMeshes: instanced.length, expandedUnits: expanded, bakedUv, bakedColours, materials: new Set(cache.values()).size };
  },
};

(window as unknown as { __poc: typeof poc }).__poc = poc;

// Start the game only after the hook and the API exist (main.ts may not resolve its module promise at once).
void import('../../../src/main.ts');
