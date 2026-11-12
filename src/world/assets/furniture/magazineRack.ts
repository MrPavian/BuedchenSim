import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-007 Zeitschriftenstaender. Dark walnut frame with a stepped side silhouette (each tier recedes
 * towards the back), five tilted birch trays with front lips (+Z) and blank muted cover placeholders
 * in six colours (no titles, no layouts).
 */
export function createMagazineRackI007(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const baseH = Math.min(0.1, h * 0.07);
  const sideT = 0.03;
  const backT = 0.02;
  const tiers = 5;
  const stepH = (h - baseH) / tiers;
  const stepZ = d * 0.1;
  const tilt = 0.3;
  const trayT = 0.02;

  b.box(f.walnutDark, -hw, hw, 0, baseH, -hd, hd);
  b.box(f.walnutDark, -hw + sideT, hw - sideT, baseH, h, -hd, -hd + backT);
  const innerW = w - 2 * sideT;
  const perRow = Math.max(2, Math.floor(innerW / 0.17));
  const coverW = innerW / perRow - 0.022;
  const coverH = Math.min(0.2, stepH * 0.7);

  for (let k = 0; k < tiers; k += 1) {
    const y0 = baseH + k * stepH;
    const y1 = y0 + stepH;
    const zf = hd - k * stepZ;
    b.box(f.walnut, -hw, -hw + sideT, y0, y1, -hd, zf);
    b.box(f.walnut, hw - sideT, hw, y0, y1, -hd, zf);

    // Tilted tray: front end lower than the back end.
    const zb = -hd + backT;
    const len = (zf - zb - 0.02) / Math.cos(tilt) - trayT * Math.tan(tilt);
    const cz = (zf + zb) / 2 - 0.01;
    const cy = y0 + stepH * 0.3;
    b.tilted(f.birch, innerW, trayT, len, 0, cy, cz, tilt);

    // Front lip at the low end of the tray.
    const frontZ = cz + (len / 2) * Math.cos(tilt) - (trayT / 2) * Math.sin(tilt);
    const frontY = cy - (len / 2) * Math.sin(tilt) + (trayT / 2) * Math.cos(tilt);
    b.box(f.walnut, -hw + sideT, hw - sideT, frontY - 0.02, frontY + 0.04, frontZ - 0.014, Math.min(frontZ, zf));

    // Blank covers leaning back on the tray, near the lip.
    const u = len / 2 - 0.05;
    const sx = [0, -Math.sin(tilt), Math.cos(tilt)] as const;
    const nx = [0, Math.cos(tilt), Math.sin(tilt)] as const;
    const px = cy + sx[1] * u + nx[1] * (trayT / 2);
    const pz = cz + sx[2] * u + nx[2] * (trayT / 2);
    const lean = -0.32;
    const dirY = Math.cos(lean);
    const dirZ = Math.sin(lean);
    for (let j = 0; j < perRow; j += 1) {
      const x = -innerW / 2 + (j + 0.5) * (innerW / perRow);
      const mat = f.covers[(k * 2 + j * 3) % f.covers.length];
      if (!mat) continue;
      const hVar = coverH * (0.88 + 0.12 * (((k + j) * 7) % 3) / 2);
      b.tilted(mat, coverW, hVar, 0.006, x, px + (hVar / 2) * dirY + 0.004, pz + (hVar / 2) * dirZ, lean);
    }
  }
  const zTop = hd - (tiers - 1) * stepZ;
  b.box(f.walnut, -hw, hw, h - 0.03, h, -hd, zTop);
  return b.build(asset.assetId);
}
