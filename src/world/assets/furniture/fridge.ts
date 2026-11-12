import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-005 Getraenkekuehlschrank. Cream insulated cabinet with a dark door frame (+Z), a transparent glass
 * door showing empty wire shelves and a warm light strip, a vertical steel handle, a slate blank header
 * and a ventilation grille at the bottom.
 */
export function createFridgeI005(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const t = 0.05; // wall thickness
  const fw = 0.055; // door frame width
  const fd = 0.04; // door frame depth
  const grilleH = h * 0.08;
  const headH = h * 0.11;
  const yIn0 = grilleH + 0.04;
  const yIn1 = h - headH;
  const frontZ = hd - fd;

  // Cabinet shell.
  b.box(f.fridgeBody, -hw, -hw + t, grilleH, yIn1, -hd, frontZ);
  b.box(f.fridgeBody, hw - t, hw, grilleH, yIn1, -hd, frontZ);
  b.box(f.fridgeBody, -hw + t, hw - t, grilleH, yIn1, -hd, -hd + t);
  b.box(f.fridgeBody, -hw + t, hw - t, grilleH, yIn0, -hd + t, frontZ);
  // Light interior liner (inside faces, slightly proud).
  const l = 0.008;
  b.box(f.fridgeInner, -hw + t, -hw + t + l, yIn0, yIn1, -hd + t, frontZ);
  b.box(f.fridgeInner, hw - t - l, hw - t, yIn0, yIn1, -hd + t, frontZ);
  b.box(f.fridgeInner, -hw + t + l, hw - t - l, yIn0, yIn1, -hd + t, -hd + t + l);
  b.box(f.fridgeInner, -hw + t + l, hw - t - l, yIn0, yIn0 + l, -hd + t + l, frontZ);

  // Header (blank, neutral slate) with a lighter blank plate.
  b.box(f.fridgeHeader, -hw, hw, yIn1, h, -hd, hd - 0.012);
  b.box(f.fridgePlate, -hw + 0.04, hw - 0.04, yIn1 + 0.03, h - 0.03, hd - 0.012, hd);

  // Door frame, glass and handle.
  b.box(f.fridgeFrame, -hw, -hw + fw, grilleH, yIn1, frontZ, hd);
  b.box(f.fridgeFrame, hw - fw, hw, grilleH, yIn1, frontZ, hd);
  b.box(f.fridgeFrame, -hw + fw, hw - fw, grilleH, grilleH + fw, frontZ, hd);
  b.box(f.fridgeFrame, -hw + fw, hw - fw, yIn1 - fw, yIn1, frontZ, hd);
  b.box(f.glass, -hw + fw, hw - fw, grilleH + fw, yIn1 - fw, hd - 0.026, hd - 0.016);
  const hx = hw - fw - 0.05;
  b.box(f.steel, hx, hx + 0.028, h * 0.33, h * 0.72, hd - 0.014, hd);

  // Warm light strips behind the frame (visible through the glass).
  const sy0 = yIn0 + 0.03;
  const sy1 = yIn1 - fw - 0.02;
  b.box(f.lightStrip, -hw + fw, -hw + fw + 0.014, sy0, sy1, frontZ - 0.02, frontZ);
  b.box(f.lightStrip, hw - fw - 0.014, hw - fw, sy0, sy1, frontZ - 0.02, frontZ);

  // Empty wire shelves.
  const shelves = 4;
  const rod = 0.008;
  const x0 = -hw + t + l;
  const x1 = hw - t - l;
  const zb = -hd + t + l;
  const zf = frontZ - 0.005;
  for (let i = 1; i <= shelves; i += 1) {
    const y = yIn0 + (i * (yIn1 - fw - yIn0)) / (shelves + 1);
    b.box(f.wire, x0, x1, y, y + rod, zb, zb + rod);
    b.box(f.wire, x0, x1, y, y + rod, zf - rod, zf);
    b.box(f.wire, x0, x0 + rod, y, y + rod, zb, zf);
    b.box(f.wire, x1 - rod, x1, y, y + rod, zb, zf);
    const rods = 6;
    for (let r = 1; r < rods; r += 1) {
      const rx = x0 + (r * (x1 - x0)) / rods;
      b.box(f.wire, rx - rod / 2, rx + rod / 2, y, y + rod, zb, zf);
    }
  }

  // Ventilation grille at the bottom.
  b.box(f.grille, -hw, hw, 0, grilleH, -hd, hd - 0.02);
  const slats = 4;
  for (let i = 0; i < slats; i += 1) {
    const y = 0.02 + (i * (grilleH - 0.04)) / slats;
    b.box(f.grilleSlat, -hw + 0.04, hw - 0.04, y, y + (grilleH - 0.04) / slats - 0.012, hd - 0.02, hd);
  }
  return b.build(asset.assetId);
}
