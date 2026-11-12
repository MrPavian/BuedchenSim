import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-011 Lagerregal. Heavy-duty steel rack: four blue perforated uprights, orange load beams and cross
 * braces, four chipboard shelves, three plain unmarked cardboard boxes. Open towards +Z.
 */
export function createStorageRackI011(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const up = 0.05;
  const slot = 0.004;

  // Uprights: faces toward +Z/-Z carry a slot row (perforation hint).
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -hw : hw - up;
    for (const sz of [-1, 1]) {
      const z0 = sz < 0 ? -hd + slot : hd - up;
      const z1 = sz < 0 ? -hd + up : hd - slot;
      b.box(f.rackBlue, x0, x0 + up, 0, h, z0, z1);
      const zs0 = sz < 0 ? -hd : hd - slot;
      const rows = Math.floor((h - 0.25) / 0.12);
      for (let i = 0; i < rows; i += 1) {
        const y = 0.15 + i * 0.12;
        b.box(f.rackSlot, x0 + up / 2 - 0.007, x0 + up / 2 + 0.007, y, y + 0.03, zs0, zs0 + slot);
      }
    }
  }

  // Shelves: orange beams front/back, orange end rails, chipboard boards on top.
  const levels = 4;
  const lo = 0.2;
  const hi = h - 0.2;
  const step = (hi - lo) / (levels - 1);
  const xi0 = -hw + up;
  const xi1 = hw - up;
  for (let i = 0; i < levels; i += 1) {
    const y = lo + i * step;
    b.box(f.rackOrange, xi0, xi1, y - 0.06, y, hd - 0.035, hd - 0.01);
    b.box(f.rackOrange, xi0, xi1, y - 0.06, y, -hd + 0.01, -hd + 0.035);
    b.box(f.rackOrange, -hw + 0.01, -hw + 0.035, y - 0.05, y, -hd + up, hd - up);
    b.box(f.rackOrange, hw - 0.035, hw - 0.01, y - 0.05, y, -hd + up, hd - up);
    b.box(f.chipboard, xi0, xi1, y, y + 0.025, -hd + 0.02, hd - 0.02);
  }

  // Cross braces: back plane X and one diagonal per end plane.
  const t = 0.022;
  const zb = -hd + 0.012;
  b.bar(f.rackOrange, [xi0 + 0.02, 0.12, zb], [xi1 - 0.02, h - 0.1, zb], t);
  b.bar(f.rackOrange, [xi1 - 0.02, 0.12, zb], [xi0 + 0.02, h - 0.1, zb], t);
  b.bar(f.rackOrange, [-hw + 0.0275, 0.12, -hd + up + 0.01], [-hw + 0.0275, h - 0.1, hd - up - 0.01], t);
  b.bar(f.rackOrange, [hw - 0.0275, 0.12, hd - up - 0.01], [hw - 0.0275, h - 0.1, -hd + up + 0.01], t);

  // Plain unmarked cartons (a lighter tape band on top only).
  const boxH = Math.min(0.3, step - 0.1);
  const carton = (x: number, level: number, cw: number, ch: number, cd: number): void => {
    const y = lo + level * step + 0.025;
    b.box(f.cardboard, x - cw / 2, x + cw / 2, y, y + ch, -cd / 2, cd / 2);
    b.box(f.tape, x - 0.03, x + 0.03, y + ch, y + ch + 0.002, -cd / 2, cd / 2);
  };
  const cartonD = Math.min(0.34, d - 0.12);
  carton(-w * 0.2, 0, Math.min(0.42, w * 0.34), boxH, cartonD);
  carton(w * 0.22, 0, Math.min(0.36, w * 0.28), boxH * 0.85, cartonD);
  carton(-w * 0.05, 2, Math.min(0.38, w * 0.3), boxH * 0.8, cartonD);
  return b.build(asset.assetId);
}
