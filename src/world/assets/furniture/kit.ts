import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small geometry kit for the furniture factories. Parts are described by their extents (min/max per
 * axis) so the overall bounding box is exact by construction; everything added with the same material
 * is merged into one mesh in `build()` (one draw call per material and asset).
 */
export class PartBuilder {
  private readonly buckets = new Map<Material, BufferGeometry[]>();

  private push(material: Material, geometry: BufferGeometry): void {
    const list = this.buckets.get(material);
    if (list) list.push(geometry);
    else this.buckets.set(material, [geometry]);
  }

  /** Axis-aligned box by extents. Degenerate extents are skipped. */
  box(material: Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): this {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    if (w <= 1e-5 || h <= 1e-5 || d <= 1e-5) return this;
    this.push(material, new BoxGeometry(w, h, d).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    return this;
  }

  /** Box of size w x h x d centred at (cx, cy, cz), rotated about the X axis (positive: +Z end goes down). */
  tilted(material: Material, w: number, h: number, d: number, cx: number, cy: number, cz: number, rx: number): this {
    this.push(material, new BoxGeometry(w, h, d).rotateX(rx).translate(cx, cy, cz));
    return this;
  }

  /** Square-section bar between two points (for diagonal braces and wire rods). */
  bar(material: Material, a: [number, number, number], b: [number, number, number], t: number): this {
    const from = new Vector3(...a);
    const to = new Vector3(...b);
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1e-5) return this;
    const geometry = new BoxGeometry(t, t, len);
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir.normalize()));
    const mid = from.add(to).multiplyScalar(0.5);
    this.push(material, geometry.translate(mid.x, mid.y, mid.z));
    return this;
  }

  /** Upright cylinder standing on y0. */
  cylinder(material: Material, r: number, y0: number, y1: number, cx: number, cz: number, segments = 12): this {
    this.push(material, new CylinderGeometry(r, r, y1 - y0, segments).translate(cx, (y0 + y1) / 2, cz));
    return this;
  }

  /** Cylinder whose axis runs along Z from z0 to z1 (knobs, handles). */
  cylinderZ(material: Material, r: number, cx: number, cy: number, z0: number, z1: number, segments = 10): this {
    this.push(material, new CylinderGeometry(r, r, z1 - z0, segments).rotateX(Math.PI / 2).translate(cx, cy, (z0 + z1) / 2));
    return this;
  }

  /** Merges every material bucket into one mesh. Transparent parts neither cast nor sort-fight. */
  build(name: string): Group {
    const root = new Group();
    root.name = name;
    for (const [material, geometries] of this.buckets) {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      if (!merged) throw new Error(`Could not merge geometry for ${name}`);
      if (geometries.length > 1) geometries.forEach((g) => g.dispose());
      const mesh = new Mesh(merged, material);
      const see = material.transparent;
      mesh.castShadow = !see && !('isMeshBasicMaterial' in material);
      mesh.receiveShadow = !see;
      if (see) mesh.renderOrder = 2;
      root.add(mesh);
    }
    this.buckets.clear();
    return root;
  }
}
