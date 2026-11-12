import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3, type Material, type Matrix4 } from 'three';
import type { Box } from '../../../game/kioskGeometry';

/**
 * Accumulates box faces into one BufferGeometry per bucket (= material), so a whole wall or roof
 * becomes a handful of draw calls instead of six per box. Faces get world-aligned UVs and optional
 * per-vertex brightness (dirt gradients) without any extra textures.
 */

export type FaceKey = 'px' | 'nx' | 'py' | 'pz' | 'nz';

/** (x, y, z) in world coordinates of the vertex, face being drawn -> texture coordinates. */
export type UvFn = (x: number, y: number, z: number, face: FaceKey) => [number, number];
/** Vertex brightness multiplier (1 = unchanged). */
export type ShadeFn = (x: number, y: number, z: number) => number;

export interface BoxOptions {
  /** Subdivisions per face edge along the long horizontal axis / vertical axis (for vertex shading). */
  cols?: number;
  rows?: number;
  uv?: UvFn;
  shade?: ShadeFn;
  /** Applied to positions and normals after UVs/shading were computed in untransformed space. */
  transform?: Matrix4;
}

/** Planar world mapping: u along the face (x for +-z faces, z for +-x faces), v up (z for the top). */
export function planarUv(tileW: number, tileH: number): UvFn {
  return (x, y, z, face) => {
    switch (face) {
      case 'pz':
      case 'nz':
        return [x / tileW, y / tileH];
      case 'px':
      case 'nx':
        return [z / tileW, y / tileH];
      case 'py':
        return [x / tileW, z / tileH];
    }
  };
}

class Bucket {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpN = new Vector3();

export class SolidBuilder {
  private readonly buckets = new Map<string, Bucket>();

  /** `origin`: world position of the builder's local (0,0,0); added for UV/shade input only. */
  constructor(private readonly origin: { x: number; z: number } = { x: 0, z: 0 }) {}

  private bucket(name: string): Bucket {
    let b = this.buckets.get(name);
    if (!b) {
      b = new Bucket();
      this.buckets.set(name, b);
    }
    return b;
  }

  /** One planar quad a-b-c-d (counter-clockwise seen from outside), subdivided cols x rows. */
  private quad(
    name: string,
    corners: [Vector3, Vector3, Vector3, Vector3],
    face: FaceKey,
    o: BoxOptions,
    uvFallback: UvFn,
  ): void {
    const b = this.bucket(name);
    const [a, bb, , d] = corners;
    const cols = Math.max(1, o.cols ?? 1);
    const rows = Math.max(1, o.rows ?? 1);
    const uvFn = o.uv ?? uvFallback;
    const base = b.positions.length / 3;
    tmpA.subVectors(bb, a);
    tmpB.subVectors(d, a);
    tmpN.crossVectors(tmpA, tmpB).normalize();
    const nx0 = tmpN.x;
    const ny0 = tmpN.y;
    const nz0 = tmpN.z;
    const p = new Vector3();
    for (let j = 0; j <= rows; j += 1) {
      for (let i = 0; i <= cols; i += 1) {
        p.copy(a).addScaledVector(tmpA, i / cols).addScaledVector(tmpB, j / rows);
        const wx = p.x + this.origin.x;
        const wz = p.z + this.origin.z;
        const [u, v] = uvFn(wx, p.y, wz, face);
        const s = o.shade ? o.shade(wx, p.y, wz) : 1;
        let nx = nx0;
        let ny = ny0;
        let nz = nz0;
        if (o.transform) {
          p.applyMatrix4(o.transform);
          tmpN.set(nx0, ny0, nz0).transformDirection(o.transform);
          nx = tmpN.x;
          ny = tmpN.y;
          nz = tmpN.z;
        }
        b.positions.push(p.x, p.y, p.z);
        b.normals.push(nx, ny, nz);
        b.uvs.push(u, v);
        b.colors.push(s, s, s);
      }
    }
    const stride = cols + 1;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const i0 = base + j * stride + i;
        const i1 = i0 + 1;
        const i2 = i0 + stride + 1;
        const i3 = i0 + stride;
        b.indices.push(i0, i1, i2, i0, i2, i3);
      }
    }
  }

  /**
   * Adds the listed faces of an axis-aligned box. `faces` maps a face to its bucket name; faces that
   * are not listed (e.g. the bottom, hidden faces) are skipped.
   */
  box(box: Box, faces: Partial<Record<FaceKey, string>>, o: BoxOptions = {}): void {
    const { minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1 } = box;
    const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
    const fallback = planarUv(1, 1);
    const along = (spanX: number, spanZ: number): number => Math.max(1, Math.round(Math.max(spanX, spanZ) / 0.5));
    const rowsFor = o.rows ?? 1;
    if (faces.pz) this.quad(faces.pz, [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], 'pz', { ...o, cols: o.cols ?? (o.shade ? along(x1 - x0, 0) : 1), rows: rowsFor }, fallback);
    if (faces.nz) this.quad(faces.nz, [v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0)], 'nz', { ...o, cols: o.cols ?? (o.shade ? along(x1 - x0, 0) : 1), rows: rowsFor }, fallback);
    if (faces.px) this.quad(faces.px, [v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1)], 'px', { ...o, cols: o.cols ?? (o.shade ? along(z1 - z0, 0) : 1), rows: rowsFor }, fallback);
    if (faces.nx) this.quad(faces.nx, [v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0)], 'nx', { ...o, cols: o.cols ?? (o.shade ? along(z1 - z0, 0) : 1), rows: rowsFor }, fallback);
    if (faces.py) this.quad(faces.py, [v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0)], 'py', { ...o, rows: 1 }, fallback);
  }

  /** Builds one Mesh per bucket; every bucket name must have a material. */
  build(materials: Record<string, Material>, namePrefix: string, shadows = { cast: true, receive: true }): Mesh[] {
    const meshes: Mesh[] = [];
    for (const [name, b] of this.buckets) {
      const material = materials[name];
      if (!material) throw new Error(`No material for solid bucket "${name}"`);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(b.positions, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(b.normals, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(b.uvs, 2));
      geometry.setAttribute('color', new Float32BufferAttribute(b.colors, 3));
      geometry.setIndex(b.indices);
      const mesh = new Mesh(geometry, material);
      mesh.name = `${namePrefix}.${name}`;
      mesh.castShadow = shadows.cast;
      mesh.receiveShadow = shadows.receive;
      meshes.push(mesh);
    }
    return meshes;
  }
}

/** Cheap deterministic hash -> [0, 1) used for subtle wear in vertex shading. */
export function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(Math.round(x * 20) | 0, 374761393) ^ Math.imul(Math.round(y * 20) | 0, 668265263) ^ Math.imul(Math.round(z * 20) | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
