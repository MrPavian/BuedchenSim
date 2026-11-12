import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-001 Verkaufstheke. Front (+Z, customer side): teal panelled carcass with worn kick band;
 * back (-Z, staff side): open compartments with shelves and two drawers. Cream worktop with overhang
 * and a wooden front nosing. Colours: teal, cream, honey wood, dark plinth.
 */
export function createCounterI001(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const topT = 0.05;
  const plinthH = Math.min(0.09, h * 0.09);
  const nosing = 0.012;
  const bodyX = hw - 0.035;
  const bodyZ0 = -hd + 0.045;
  const bodyZ1 = hd - 0.045;
  const carcassZ0 = bodyZ1 - Math.min(0.3, d * 0.46);
  const yTop = h - topT;

  // Worktop: cream slab with a darker wooden nosing on the customer side.
  b.box(f.counterTop, -hw, hw, yTop, h, -hd, hd - nosing);
  b.box(f.edgeTrim, -hw, hw, yTop, h, hd - nosing, hd);
  // Kick plinth, recessed on all sides.
  b.box(f.plinth, -hw + 0.08, hw - 0.08, 0, plinthH, -hd + 0.075, hd - 0.075);

  // Front carcass with raised panels and a worn bottom band (customer side).
  b.box(f.counterFront, -bodyX, bodyX, plinthH, yTop, carcassZ0, bodyZ1);
  b.box(f.counterWorn, -bodyX, bodyX, plinthH, plinthH + 0.05, bodyZ1, bodyZ1 + 0.006);
  const panels = Math.max(2, Math.round(w / 0.7));
  const span = (2 * bodyX) / panels;
  for (let i = 0; i < panels; i += 1) {
    const x0 = -bodyX + i * span;
    b.box(f.counterPanel, x0 + 0.07, x0 + span - 0.07, plinthH + 0.1, yTop - 0.07, bodyZ1, bodyZ1 + 0.012);
  }
  // End panels.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -bodyX : bodyX - 0.03;
    b.box(f.counterFront, x0, x0 + 0.03, plinthH, yTop, bodyZ0, bodyZ1);
  }

  // Staff side: back of the carcass, floor, dividers, shelves, drawers.
  b.box(f.inner, -bodyX + 0.03, bodyX - 0.03, plinthH, yTop, carcassZ0 - 0.006, carcassZ0);
  b.box(f.shelfLight, -bodyX + 0.03, bodyX - 0.03, plinthH, plinthH + 0.025, bodyZ0, carcassZ0);
  const cells = Math.max(3, Math.round(w / 0.7));
  const cellW = (2 * (bodyX - 0.03)) / cells;
  const inner0 = -bodyX + 0.03;
  for (let i = 1; i < cells; i += 1) {
    b.box(f.shelfLight, inner0 + i * cellW - 0.0125, inner0 + i * cellW + 0.0125, plinthH, yTop, bodyZ0, carcassZ0);
  }
  const usable = yTop - plinthH;
  for (let i = 0; i < cells; i += 1) {
    const x0 = inner0 + i * cellW + 0.0125;
    const x1 = inner0 + (i + 1) * cellW - 0.0125;
    if (i === 1) {
      // Two drawers with steel pull bars.
      for (let k = 0; k < 2; k += 1) {
        const y0 = plinthH + 0.03 + k * (usable / 2 - 0.01);
        const y1 = y0 + usable / 2 - 0.05;
        b.box(f.drawer, x0 + 0.01, x1 - 0.01, y0, y1, bodyZ0, bodyZ0 + 0.03);
        const yc = (y0 + y1) / 2;
        b.box(f.steel, (x0 + x1) / 2 - 0.07, (x0 + x1) / 2 + 0.07, yc - 0.008, yc + 0.008, bodyZ0 - 0.022, bodyZ0);
      }
    } else {
      const shelves = i === 2 ? 2 : 1;
      for (let k = 1; k <= shelves; k += 1) {
        const y = plinthH + (usable * k) / (shelves + 1);
        b.box(f.shelfLight, x0, x1, y, y + 0.025, bodyZ0, carcassZ0);
      }
    }
  }
  return b.build(asset.assetId);
}
