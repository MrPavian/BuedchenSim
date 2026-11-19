import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { getStreetMaterials } from './materials';

/**
 * E-014 Gehwegbank (1.8 x 0.6 x 0.85 m). Municipal sidewalk bench: two dark-green cast end frames (front leg, raked
 * rear leg, seat bearer, armrest), three seat slats and two backrest slats in warm wood. Front (+Z) = the side one sits
 * facing; the backrest is at -Z. Distinct from the offcut yard bench E-004.
 */
export function createSidewalkBenchE014(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const b = new PartBuilder({ vertexColors: s.baked });
  const hw = w / 2;
  const hd = d / 2;
  const seatY = 0.45;
  const frameT = 0.05;
  const leg = 0.05;
  const rearBottomZ = -hd + 0.12; // the raked rear leg leans back by 0.08 m over its height
  const rearTopZ = -hd + 0.03;
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? hw - frameT : -hw;
    const x1 = sx > 0 ? hw : -hw + frameT;
    // Front leg and rear leg raked back to the backrest top.
    b.box(s.benchFrame, x0, x1, 0, seatY, hd - 0.09 - leg, hd - 0.09);
    b.bar(s.benchFrame, [sx * (hw - frameT / 2), 0, rearBottomZ], [sx * (hw - frameT / 2), h - 0.03, rearTopZ], leg);
    // Seat bearer, foot rail and armrest (front end reaches the seat front).
    b.box(s.benchFrame, x0, x1, seatY - 0.05, seatY, -hd + 0.14, hd - 0.04);
    b.box(s.benchFrame, x0, x1, 0, 0.04, -hd + 0.1, hd - 0.04);
    b.box(s.benchFrame, x0, x1, seatY + 0.17, seatY + 0.2, -hd + 0.14, hd);
    b.box(s.benchFrame, x0, x1, seatY, seatY + 0.17, hd - 0.07 - leg, hd - 0.07);
  }
  // Seat: three slats across the depth.
  const slatW = 0.095;
  const gap = 0.02;
  const inner = hw - frameT;
  for (let i = 0; i < 3; i += 1) {
    const z1 = hd - i * (slatW + gap);
    b.box(s.benchSlat, -inner, inner, seatY, seatY + 0.03, z1 - slatW, z1);
  }
  // Backrest: two slats on the front of the raked leg, tilted with it; the upper slat reaches the catalog height.
  const rake = -Math.atan2(rearBottomZ - rearTopZ, h - 0.03);
  for (const yc of [0.62, h - 0.05]) {
    const zc = rearBottomZ + ((rearTopZ - rearBottomZ) * yc) / (h - 0.03) + 0.04;
    b.tilted(s.benchSlat, 2 * inner, 0.1, 0.03, 0, yc, zc, rake);
  }
  return b.build(asset.assetId);
}
