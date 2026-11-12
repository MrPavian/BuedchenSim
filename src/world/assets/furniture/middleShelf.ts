import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-004 Mittelregal. Free-standing gondola: dark base, sage-green end caps and central back panel,
 * cream shelves with price rails on both long sides (+Z and -Z), cream blank header. Empty.
 */
export function createMiddleShelfI004(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const endT = 0.04;
  const baseH = 0.1;
  const back = 0.03;
  const headH = 0.1;
  const board = 0.025;
  const rail = 0.016;

  b.box(f.gondolaBody, -hw, -hw + endT, 0, h, -hd, hd);
  b.box(f.gondolaBody, hw - endT, hw, 0, h, -hd, hd);
  b.box(f.gondolaBase, -hw + endT, hw - endT, 0, baseH, -hd + 0.03, hd - 0.03);
  b.box(f.gondolaBody, -hw + endT, hw - endT, baseH, h - headH, -back / 2, back / 2);
  b.box(f.gondolaShelf, -hw + endT, hw - endT, h - headH, h, -hd + 0.02, hd - 0.02);

  const levels = 4;
  const y0 = baseH + 0.1;
  const y1 = h - headH - 0.15;
  for (let i = 0; i < levels; i += 1) {
    const y = y0 + (i * (y1 - y0)) / (levels - 1);
    for (const s of [-1, 1]) {
      const zIn = (s * back) / 2;
      const zOut = s * (hd - rail);
      b.box(f.gondolaShelf, -hw + endT, hw - endT, y, y + board, Math.min(zIn, zOut), Math.max(zIn, zOut));
      const r0 = s * (hd - rail);
      const r1 = s * hd;
      b.box(f.priceRail, -hw + endT, hw - endT, y - 0.015, y + board + 0.012, Math.min(r0, r1), Math.max(r0, r1));
    }
  }
  return b.build(asset.assetId);
}
