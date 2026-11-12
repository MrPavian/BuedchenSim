import type { Material, Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/** One open returnable crate: floor, grid side walls with slots, end walls with handle openings. */
function crate(b: PartBuilder, mat: Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  const t = 0.014;
  const ch = y1 - y0;
  b.box(mat, x0, x1, y0, y0 + t, z0, z1);
  // Long walls (+Z/-Z): rails above and below, posts between slots.
  const posts = 5;
  for (const [a, c] of [[z0, z0 + t], [z1 - t, z1]] as const) {
    b.box(mat, x0, x1, y0, y0 + ch * 0.18, a, c);
    b.box(mat, x0, x1, y1 - ch * 0.12, y1, a, c);
    for (let i = 0; i < posts; i += 1) {
      const px = x0 + (i * (x1 - x0 - 0.03)) / (posts - 1);
      b.box(mat, px, px + 0.03, y0, y1, a, c);
    }
  }
  // End walls (x0/x1): low band, upper band split by a handle opening.
  for (const [a, c] of [[x0, x0 + t], [x1 - t, x1]] as const) {
    const zc = (z0 + z1) / 2;
    b.box(mat, a, c, y0, y0 + ch * 0.45, z0, z1);
    b.box(mat, a, c, y0 + ch * 0.45, y1, z0, zc - 0.09);
    b.box(mat, a, c, y0 + ch * 0.45, y1, zc + 0.09, z1);
    b.box(mat, a, c, y1 - ch * 0.12, y1, z0, z1);
  }
}

/**
 * I-012 Leergut-/Kistenbereich. Grey pallet with two columns of plain returnable crates: a green column
 * of three and a sand column of two whose top crate holds a few bottle necks. Slight offsets, no logos.
 */
export function createCratesI012(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const palletH = Math.min(0.05, h * 0.07);
  const gap = 0.02;
  const colW = (w - 3 * gap) / 2 - 0.012;
  const cd = d - 0.1;
  const ch = (h - palletH) / 3;

  b.box(f.pallet, -hw, hw, 0, palletH, -hd, hd);
  const cols = [
    { x: -hw + gap + colW / 2 + 0.006, mat: f.crateGreen, n: 3, dz: 0.02 },
    { x: hw - gap - colW / 2 - 0.006, mat: f.crateSand, n: 2, dz: -0.02 },
  ];
  for (const col of cols) {
    for (let k = 0; k < col.n; k += 1) {
      const jitter = (k % 2 === 0 ? 1 : -1) * 0.008;
      const y0 = palletH + k * ch;
      const cx = col.x + jitter;
      const cz = col.dz + (k === 1 ? -jitter : jitter);
      crate(b, col.mat, cx - colW / 2, cx + colW / 2, y0, y0 + ch, cz - cd / 2, cz + cd / 2);
    }
  }
  // Plain bottle necks in the top sand crate (3 x 4), below the rim.
  const topY0 = palletH + ch;
  const cx = cols[1]?.x ?? 0;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const nx = cx - colW / 2 + 0.06 + (i * (colW - 0.12)) / 2;
      const nz = (cols[1]?.dz ?? 0) - cd / 2 + 0.07 + (j * (cd - 0.14)) / 3;
      b.cylinder(f.bottleGlass, 0.021, topY0 + 0.015, topY0 + ch - 0.015, nx, nz, 10);
    }
  }
  return b.build(asset.assetId);
}
