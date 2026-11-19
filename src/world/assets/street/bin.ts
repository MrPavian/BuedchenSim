import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { getStreetMaterials } from './materials';

/**
 * E-005 Mülleimer (0.45 x 0.4 x 1.0 m). Municipal sidewalk bin: steel post with a foot plate, a green open-top body
 * (0.42 x 0.36) with a dark interior and an orange stripe, a dark rim band (0.45 x 0.4) and a small ashtray plate on the
 * front of the rim. Front (+Z) = the side the stripe and the ashtray face. No lettering.
 */
export function createBinE005(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const b = new PartBuilder({ vertexColors: s.baked });
  const hw = w / 2;
  const hd = d / 2;
  const bodyHw = hw - 0.015;
  const bodyHd = hd - 0.02;
  const bodyY0 = 0.58;
  const wall = 0.025;
  // Foot plate and post.
  b.box(s.steelDark, -0.11, 0.11, 0, 0.02, -0.11, 0.11);
  b.box(s.steelDark, -0.04, 0.04, 0.02, bodyY0 + 0.02, -0.04, 0.04);
  // Body walls (open top) and floor.
  b.box(s.binBody, -bodyHw, bodyHw, bodyY0, h - 0.1, bodyHd - wall, bodyHd); // front
  b.box(s.binBody, -bodyHw, bodyHw, bodyY0, h - 0.1, -bodyHd, -bodyHd + wall); // back
  b.box(s.binBody, -bodyHw, -bodyHw + wall, bodyY0, h - 0.1, -bodyHd + wall, bodyHd - wall);
  b.box(s.binBody, bodyHw - wall, bodyHw, bodyY0, h - 0.1, -bodyHd + wall, bodyHd - wall);
  b.box(s.binBody, -bodyHw, bodyHw, bodyY0 - 0.03, bodyY0, -bodyHd, bodyHd);
  // Dark interior (visible through the open top) and orange stripe on the front.
  b.box(s.binInner, -bodyHw + wall, bodyHw - wall, bodyY0 + 0.02, h - 0.12, -bodyHd + wall, bodyHd - wall);
  b.box(s.binStripe, -bodyHw + 0.03, bodyHw - 0.03, bodyY0 + 0.1, bodyY0 + 0.15, bodyHd, bodyHd + 0.004);
  // Rim band: four bars around the opening, reaching the full footprint and the catalog height.
  const rim = 0.03;
  b.box(s.binBand, -hw, hw, h - 0.1, h, hd - rim, hd);
  b.box(s.binBand, -hw, hw, h - 0.1, h, -hd, -hd + rim);
  b.box(s.binBand, -hw, -hw + rim, h - 0.1, h, -hd + rim, hd - rim);
  b.box(s.binBand, hw - rim, hw, h - 0.1, h, -hd + rim, hd - rim);
  // Ashtray plate: small steel plate on the front of the rim with a dark slot.
  b.box(s.steel, -0.07, 0.07, h - 0.2, h - 0.12, hd - 0.004, hd);
  b.box(s.binInner, -0.045, 0.045, h - 0.17, h - 0.15, hd - 0.004, hd);
  return b.build(asset.assetId);
}
