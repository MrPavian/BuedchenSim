import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';
import type { FurnitureMaterials } from './materials';

/** Rectangular wall ring (four bars) with rounded outer corners (cylinders). */
function ring(
  b: PartBuilder,
  mat: FurnitureMaterials['freezerBody'],
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
  wt: number, r: number,
): void {
  b.box(mat, x0 + r, x1 - r, y0, y1, z1 - wt, z1);
  b.box(mat, x0 + r, x1 - r, y0, y1, z0, z0 + wt);
  b.box(mat, x0, x0 + wt, y0, y1, z0 + r, z1 - r);
  b.box(mat, x1 - wt, x1, y0, y1, z0 + r, z1 - r);
  for (const cx of [x0 + r, x1 - r]) for (const cz of [z0 + r, z1 - r]) b.cylinder(mat, r, y0, y1, cx, cz, 10);
}

/**
 * I-006 Eistruhe. Cream chest body with rounded corners and an aqua front stripe, grey rim with lip,
 * two sliding glass lids over an empty pale well with a wire divider basket, front control/vent panel
 * with a knob (+Z), four dark feet.
 */
export function createFreezerI006(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const i = 0.012;
  const r = 0.05;
  const wt = 0.07;
  const legH = 0.07;
  const rimH = 0.07;
  const yBody1 = h - rimH;
  const floorTop = legH + 0.12;

  // Feet.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(f.grille, sx * (hw - 0.1) - 0.04, sx * (hw - 0.1) + 0.04, 0, legH, sz * (hd - 0.1) - 0.04, sz * (hd - 0.1) + 0.04);
  }
  // Body: well floor plus wall ring; rim ring on top at full size (small lip).
  b.box(f.freezerBody, -hw + i + r, hw - i - r, legH, floorTop, -hd + i, hd - i);
  b.box(f.freezerBody, -hw + i, hw - i, legH, floorTop, -hd + i + r, hd - i - r);
  ring(b, f.freezerBody, -hw + i, hw - i, legH, yBody1, -hd + i, hd - i, wt, r);
  ring(b, f.freezerRim, -hw, hw, yBody1, h, -hd, hd, wt, r + 0.005);
  b.box(f.fridgeInner, -hw + wt, hw - wt, floorTop, floorTop + 0.006, -hd + wt, hd - wt);

  // Front: aqua stripe, control panel with vent slots and a knob.
  b.box(f.freezerStripe, -hw + i + r, hw - i - r, legH + 0.42 * (yBody1 - legH), legH + 0.52 * (yBody1 - legH), hd - i, hd - i + 0.004);
  const px0 = -hw + 0.14;
  const py0 = legH + 0.1 * (yBody1 - legH);
  const py1 = legH + 0.32 * (yBody1 - legH);
  b.box(f.freezerPanel, px0, px0 + 0.3, py0, py1, hd - i, hd - 0.004);
  for (let k = 0; k < 3; k += 1) {
    const y = py0 + 0.02 + k * ((py1 - py0 - 0.04) / 3);
    b.box(f.freezerFrame, px0 + 0.16, px0 + 0.28, y, y + 0.01, hd - 0.004, hd);
  }
  b.cylinderZ(f.freezerFrame, 0.022, px0 + 0.07, (py0 + py1) / 2, hd - 0.004, hd);

  // Wire divider basket at one end of the well.
  const bx0 = -hw + wt + 0.02;
  const bx1 = bx0 + (w - 2 * wt) * 0.38;
  const bz0 = -hd + wt + 0.02;
  const bz1 = hd - wt - 0.02;
  const by0 = floorTop + 0.006;
  const by1 = yBody1 - 0.03;
  const rod = 0.012;
  b.box(f.wire, bx0, bx1, by1, by1 + rod, bz0, bz0 + rod);
  b.box(f.wire, bx0, bx1, by1, by1 + rod, bz1 - rod, bz1);
  b.box(f.wire, bx0, bx0 + rod, by1, by1 + rod, bz0, bz1);
  b.box(f.wire, bx1 - rod, bx1, by1, by1 + rod, bz0, bz1);
  for (const x of [bx0, bx1 - rod]) for (const z of [bz0, bz1 - rod]) b.box(f.wire, x, x + rod, by0, by1, z, z + rod);
  b.box(f.wire, bx0, bx1, by0, by0 + rod, bz0, bz0 + rod);
  b.box(f.wire, bx0, bx1, by0, by0 + rod, bz1 - rod, bz1);
  b.box(f.wire, bx1 - rod, bx1, by0, by1, (bz0 + bz1) / 2, (bz0 + bz1) / 2 + rod);

  // Two sliding glass lids (the right one slightly lower so they overlap) with aluminium end bars.
  const gx0 = -hw + wt - 0.005;
  const gx1 = hw - wt + 0.005;
  const gz0 = -hd + wt - 0.005;
  const gz1 = hd - wt + 0.005;
  const mid = 0.03;
  const lidT = 0.008;
  const yA = h - 0.05;
  const yB = h - 0.036;
  b.box(f.glass, gx0, mid, yA, yA + lidT, gz0, gz1);
  b.box(f.glass, -mid, gx1, yB, yB + lidT, gz0, gz1);
  b.box(f.freezerFrame, gx0, gx0 + 0.015, yA, yA + 0.02, gz0, gz1);
  b.box(f.freezerFrame, mid - 0.015, mid, yA, yA + 0.02, gz0, gz1);
  b.box(f.freezerFrame, -mid, -mid + 0.015, yB, yB + 0.02, gz0, gz1);
  b.box(f.freezerFrame, gx1 - 0.015, gx1, yB, yB + 0.02, gz0, gz1);
  for (const x of [mid - 0.02, -mid + 0.02]) {
    const y = x > 0 ? yA : yB;
    b.box(f.freezerPanel, x - 0.03, x + 0.03, y + 0.02, y + 0.026, -0.05, 0.05);
  }
  return b.build(asset.assetId);
}
