import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-003 Wandregal. Dark wooden side panels and divider, warm pegboard back panel (-Z, against the wall),
 * five light wooden boards with blank cream price rails on the board fronts (+Z). Empty.
 */
export function createWallShelfI003(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const side = 0.045;
  const back = 0.025;
  const board = 0.035;
  const rail = 0.014;
  const plinthH = 0.08;

  b.box(f.shelfDark, -hw, -hw + side, 0, h, -hd + back, hd);
  b.box(f.shelfDark, hw - side, hw, 0, h, -hd + back, hd);
  b.box(f.pegboard, -hw, hw, plinthH, h, -hd, -hd + back);
  b.box(f.shelfDark, -hw, hw, 0, plinthH, -hd, hd - 0.03); // base block on the floor
  // Two intermediate supports keep the long boards believable.
  for (const x of [-w / 6, w / 6]) b.box(f.shelfDark, x - 0.015, x + 0.015, plinthH, h - board, -hd + back, hd - rail - 0.02);

  const levels = 5;
  for (let i = 0; i < levels; i += 1) {
    const top = plinthH + board + 0.1 + (i * (h - plinthH - board - 0.1)) / (levels - 1);
    const y0 = top - board;
    b.box(f.shelfLight, -hw + side, hw - side, y0, top, -hd + back, hd - rail);
    // Blank price rail: slightly taller than the board, flush with the front edge.
    b.box(f.priceRail, -hw + side, hw - side, y0 - 0.02, top, hd - rail, hd);
  }
  return b.build(asset.assetId);
}
