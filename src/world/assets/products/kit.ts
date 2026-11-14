import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small kit for the product model factories. Parts are added with a material; `build()` merges everything that
 * shares a material into ONE mesh, so a product has only a handful of meshes (label, cap, ...) and the stock
 * view can turn each of them into one InstancedMesh. Product meshes never cast or receive shadows.
 */
export class ProductBuilder {
  private readonly buckets = new Map<Material, BufferGeometry[]>();

  add(material: Material, geometry: BufferGeometry): this {
    const list = this.buckets.get(material);
    if (list) list.push(geometry);
    else this.buckets.set(material, [geometry]);
    return this;
  }

  build(name: string): Group {
    const root = new Group();
    root.name = name;
    for (const [material, geometries] of this.buckets) {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      if (!merged) throw new Error(`Could not merge product geometry for ${name}`);
      if (geometries.length > 1) geometries.forEach((g) => g.dispose());
      const mesh = new Mesh(merged, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      root.add(mesh);
    }
    this.buckets.clear();
    return root;
  }
}

/** Lathe around Y from a profile of [radius, height] points (bottom to top); the seam (u = 0) sits at -Z, so u = 0.5 faces +Z. */
export function lathe(profile: ReadonlyArray<readonly [number, number]>, segments: number): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  ).rotateY(Math.PI);
}

/** Deterministic hash in [0, 1) of a string (used to pick label styles and noise per product). */
export function hash01(text: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h / 4294967296;
}

/** Linear mix of two CSS colours (t = 0 -> a, t = 1 -> b), returned as '#rrggbb'. */
export function mix(a: string, b: string, t: number): string {
  const ca = new Color(a);
  const cb = new Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}

/** Relative luminance (0..1) of a CSS colour. */
export function luminance(css: string): number {
  const c = new Color(css);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Pillow-shaped sack (chip bag, ice wrapper, pouch): a subdivided box whose thickness follows a profile, thickest
 * in the middle and pinched towards the crimped top/bottom and the sealed sides. The bounding box stays exactly
 * w x h x d (pivot = bottom centre, front +Z); the front face UVs span the whole texture.
 */
export function pillowGeometry(w: number, h: number, d: number, crimp = 0.16, sideEdge = 0.22): BoxGeometry {
  // 4 x 6 subdivisions keep the pillow bulge readable at game-camera distance (was 8 x 14 x 2: 5x the triangles).
  const geometry = new BoxGeometry(w, h, d, 4, 6, 1);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    const nx = Math.abs(pos.getX(i)) / (w / 2);
    const ny = Math.abs(pos.getY(i)) / (h / 2);
    const k = (crimp + (1 - crimp) * (1 - ny ** 2.6)) * (sideEdge + (1 - sideEdge) * (1 - nx ** 2.2));
    pos.setZ(i, pos.getZ(i) * k);
  }
  geometry.computeVertexNormals();
  return geometry.translate(0, h / 2, 0);
}

/** Writes a constant vertex colour attribute. */
export function paintVertices(geometry: BufferGeometry, colorAt: (x: number, y: number, z: number) => Color): void {
  const pos = geometry.getAttribute('position');
  const data = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const c = colorAt(pos.getX(i), pos.getY(i), pos.getZ(i));
    data[i * 3] = c.r;
    data[i * 3 + 1] = c.g;
    data[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
}
