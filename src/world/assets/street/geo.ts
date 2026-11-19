import { CylinderGeometry, type BufferGeometry } from 'three';

/** Upright (optionally tapered) cylinder from y0 to y1 at (cx, cz). 16 segments keep the extents exact on both axes. */
export function taper(rTop: number, rBottom: number, y0: number, y1: number, cx = 0, cz = 0, segments = 16): BufferGeometry {
  return new CylinderGeometry(rTop, rBottom, y1 - y0, segments).translate(cx, (y0 + y1) / 2, cz);
}

/** Cylinder whose axis runs along X from x0 to x1 at height cy, depth cz. */
export function cylX(r: number, x0: number, x1: number, cy: number, cz: number, segments = 8): BufferGeometry {
  return new CylinderGeometry(r, r, x1 - x0, segments).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, cy, cz);
}

/** Cylinder whose axis runs along Z from z0 to z1 at (cx, cy). */
export function cylZ(r: number, cx: number, cy: number, z0: number, z1: number, segments = 8): BufferGeometry {
  return new CylinderGeometry(r, r, z1 - z0, segments).rotateX(Math.PI / 2).translate(cx, cy, (z0 + z1) / 2);
}
