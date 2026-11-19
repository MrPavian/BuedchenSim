import { Color, MeshLambertMaterial, type MeshLambertMaterialParameters } from 'three';
import type { Materials } from '../../materials';

/** Street furniture colours (fictional, warm, slightly weathered; municipal green and anthracite, steel, beige). */
export const streetPalette = {
  lampMast: 0x2e3b35,
  lampHead: 0x3a4540,
  lampGlass: 0xf2e6c4,
  binBody: 0x3f6b4c,
  binBand: 0x2c3a33,
  binInner: 0x1b1c1c,
  binStripe: 0xd98a2b,
  steelDark: 0x41464a,
  steel: 0x9aa1a3,
  bikeFrame: 0x3f7a55,
  bikeTyre: 0x1f1f20,
  bikeChrome: 0xb9bdbd,
  bikeSaddle: 0x4b3527,
  bikeGrip: 0x2a2a2a,
  bark: 0x6b5340,
  leafA: 0x6f9a4a,
  leafB: 0x84a855,
  leafC: 0x5d8741,
  signPost: 0x4a5052,
  signPlate: 0xf2efe4,
  signBorder: 0x24364f,
  boxBody: 0xb3ab99,
  boxCap: 0x8f8978,
  boxPlinth: 0x4b4d4d,
  boxVent: 0x3c3d3d,
  stickerOrange: 0xd49a52,
  stickerTeal: 0x7ba9a4,
  stickerCream: 0xe4dcc4,
  stickerRed: 0xa65a4a,
  benchFrame: 0x2f4a3a,
  benchSlat: 0x9a7048,
} as const;

export interface StreetMaterials {
  /** Shared vertex-colour material: street assets bake their part colours and draw as one mesh. */
  baked: MeshLambertMaterial;
  lampMast: MeshLambertMaterial;
  lampHead: MeshLambertMaterial;
  /** Lamp glass; emissive colour fixed, intensity 0 (switched on by the lighting in package 6.3). */
  lampGlow: MeshLambertMaterial;
  binBody: MeshLambertMaterial;
  binBand: MeshLambertMaterial;
  binInner: MeshLambertMaterial;
  binStripe: MeshLambertMaterial;
  steelDark: MeshLambertMaterial;
  steel: MeshLambertMaterial;
  bikeFrame: MeshLambertMaterial;
  bikeTyre: MeshLambertMaterial;
  bikeChrome: MeshLambertMaterial;
  bikeSaddle: MeshLambertMaterial;
  bikeGrip: MeshLambertMaterial;
  bark: MeshLambertMaterial;
  leafA: MeshLambertMaterial;
  leafB: MeshLambertMaterial;
  leafC: MeshLambertMaterial;
  signPost: MeshLambertMaterial;
  signPlate: MeshLambertMaterial;
  signBorder: MeshLambertMaterial;
  boxBody: MeshLambertMaterial;
  boxCap: MeshLambertMaterial;
  boxPlinth: MeshLambertMaterial;
  boxVent: MeshLambertMaterial;
  stickerOrange: MeshLambertMaterial;
  stickerTeal: MeshLambertMaterial;
  stickerCream: MeshLambertMaterial;
  stickerRed: MeshLambertMaterial;
  benchFrame: MeshLambertMaterial;
  benchSlat: MeshLambertMaterial;
}

const cache = new WeakMap<Materials, StreetMaterials>();

/** Materials shared by all street furniture factories (one set per `Materials`). */
export function getStreetMaterials(base: Materials): StreetMaterials {
  const hit = cache.get(base);
  if (hit) return hit;
  const p = streetPalette;
  const lambert = (color: number, extra: MeshLambertMaterialParameters = {}): MeshLambertMaterial =>
    new MeshLambertMaterial({ color, ...extra });
  const out: StreetMaterials = {
    baked: new MeshLambertMaterial({ vertexColors: true, name: 'streetBaked' }),
    lampMast: lambert(p.lampMast),
    lampHead: lambert(p.lampHead),
    lampGlow: lambert(p.lampGlass, { name: 'lampGlow', emissive: new Color(0xffd9a0), emissiveIntensity: 0 }),
    binBody: lambert(p.binBody),
    binBand: lambert(p.binBand),
    binInner: lambert(p.binInner),
    binStripe: lambert(p.binStripe),
    steelDark: lambert(p.steelDark),
    steel: lambert(p.steel),
    bikeFrame: lambert(p.bikeFrame),
    bikeTyre: lambert(p.bikeTyre),
    bikeChrome: lambert(p.bikeChrome),
    bikeSaddle: lambert(p.bikeSaddle),
    bikeGrip: lambert(p.bikeGrip),
    bark: lambert(p.bark),
    leafA: lambert(p.leafA, { flatShading: true }),
    leafB: lambert(p.leafB, { flatShading: true }),
    leafC: lambert(p.leafC, { flatShading: true }),
    signPost: lambert(p.signPost),
    signPlate: lambert(p.signPlate),
    signBorder: lambert(p.signBorder),
    boxBody: lambert(p.boxBody),
    boxCap: lambert(p.boxCap),
    boxPlinth: lambert(p.boxPlinth),
    boxVent: lambert(p.boxVent),
    stickerOrange: lambert(p.stickerOrange),
    stickerTeal: lambert(p.stickerTeal),
    stickerCream: lambert(p.stickerCream),
    stickerRed: lambert(p.stickerRed),
    benchFrame: lambert(p.benchFrame),
    benchSlat: lambert(p.benchSlat),
  };
  cache.set(base, out);
  return out;
}
