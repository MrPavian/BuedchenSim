import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { taper } from './geo';
import { getStreetMaterials } from './materials';

/**
 * E-003 Laterne (0.44 x 0.44 x 4.6 m). Ruhrgebiet-style street lamp: slim dark-green mast on a base sleeve with a
 * collar ring, a small neck, a glass bulb housing under a mushroom-shaped (Pilz) shade. The glass uses the material
 * named 'lampGlow' (emissive intensity 0); the evening lighting (Auftrag 06.3) switches it on. No light source here.
 */
export function createLanternE003(asset: AssetDef, m: Materials): Object3D {
  const { width: w, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const r = w / 2;
  const b = new PartBuilder({ vertexColors: s.baked, keep: [s.lampGlow] });
  // Base: flared foot and sleeve with a collar ring.
  b.geometry(s.lampMast, taper(0.1, 0.13, 0, 0.14));
  b.geometry(s.lampMast, taper(0.1, 0.1, 0.14, 0.95));
  b.geometry(s.lampHead, taper(0.085, 0.12, 0.95, 1.02));
  // Mast and neck.
  b.geometry(s.lampMast, taper(0.045, 0.07, 1.02, h - 0.52));
  b.geometry(s.lampHead, taper(0.07, 0.07, h - 0.56, h - 0.5));
  b.geometry(s.lampMast, taper(0.05, 0.05, h - 0.5, h - 0.36));
  // Glass housing between a bottom plate and the shade.
  b.geometry(s.lampHead, taper(0.1, 0.1, h - 0.38, h - 0.35));
  b.geometry(s.lampGlow, taper(0.17, 0.12, h - 0.35, h - 0.18));
  // Mushroom shade: wide flat cone with a small cap on top.
  b.geometry(s.lampHead, taper(0.1, r, h - 0.2, h - 0.06));
  b.geometry(s.lampHead, taper(0.04, 0.1, h - 0.06, h));
  return b.build(asset.assetId);
}
