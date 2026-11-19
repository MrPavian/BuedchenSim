import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { getStreetMaterials } from './materials';

/**
 * E-013 Verteilerkasten (0.9 x 0.35 x 1.2 m). Grey-beige utility cabinet on a dark plinth with a projecting cap, a door
 * seam with two handle plates, louvre vents low on the doors and a few faded blank stickers (no lettering). Front = +Z.
 */
export function createUtilityBoxE013(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const b = new PartBuilder({ vertexColors: s.baked });
  const hw = w / 2;
  const hd = d / 2;
  const plinth = 0.1;
  const cap = 0.045;
  const inset = 0.015;
  b.box(s.boxPlinth, -hw, hw, 0, plinth, -hd, hd);
  b.box(s.boxBody, -hw + inset, hw - inset, plinth, h - cap, -hd + inset, hd - inset);
  b.box(s.boxCap, -hw, hw, h - cap, h, -hd, hd);
  const fz = hd - inset; // front face
  // Door seam (two leaves) and handle plates.
  b.box(s.boxVent, -0.008, 0.008, plinth + 0.02, h - cap - 0.02, fz, fz + 0.004);
  b.box(s.boxVent, -0.05, -0.02, 0.62, 0.78, fz, fz + 0.014);
  b.box(s.boxVent, 0.02, 0.05, 0.62, 0.78, fz, fz + 0.014);
  // Louvre vents low on each door.
  for (const cx of [-0.22, 0.22]) {
    for (let i = 0; i < 5; i += 1) {
      const y = plinth + 0.08 + i * 0.035;
      b.box(s.boxVent, cx - 0.14, cx + 0.14, y, y + 0.018, fz, fz + 0.01);
    }
  }
  // Faded stickers (blank colour fields, slightly rotated look via offsets).
  b.box(s.stickerOrange, -0.36, -0.22, 0.88, 1.0, fz, fz + 0.003);
  b.box(s.stickerTeal, 0.12, 0.3, 0.93, 1.03, fz, fz + 0.003);
  b.box(s.stickerCream, 0.26, 0.38, 0.5, 0.58, fz, fz + 0.003);
  b.box(s.stickerRed, -0.34, -0.26, 0.36, 0.42, fz, fz + 0.003);
  // Side vent slots.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const y = 0.55 + i * 0.04;
      b.box(s.boxVent, sx > 0 ? hw - inset : -hw + inset - 0.006, sx > 0 ? hw - inset + 0.006 : -hw + inset, y, y + 0.02, -0.08, 0.08);
    }
  }
  return b.build(asset.assetId);
}
