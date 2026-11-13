import { Color, MeshBasicMaterial, MeshLambertMaterial, type MeshLambertMaterialParameters } from 'three';
import type { Materials } from '../../materials';

/** Furniture colours (fictional, warm, slightly used; harmonise with the plaster walls and the tile floor). */
export const furniturePalette = {
  counterFront: 0x3a7a7d,
  counterPanel: 0x4a8f8f,
  counterWorn: 0x2c5d60,
  counterTop: 0xe8e1cf,
  edgeTrim: 0xb0875a,
  plinth: 0x3b3733,
  inner: 0x6a5441,
  drawer: 0xc29a66,
  steel: 0xa7aeb0,
  regBody: 0x4a4f55,
  regDrawer: 0xbdb7a6,
  keyLight: 0xdad4c2,
  keyGreen: 0x6a9c6a,
  keyOrange: 0xd1823a,
  screen: 0x93ad9a,
  screenDash: 0x4a5a4d,
  shelfDark: 0x6b4a30,
  priceRail: 0xefe7d2,
  pegboard: 0xd9c096,
  gondolaBody: 0x6e9078,
  gondolaShelf: 0xe6dcc0,
  gondolaBase: 0x3d4a44,
  fridgeBody: 0xece9de,
  fridgeInner: 0xf4f2ea,
  fridgeFrame: 0x2f3236,
  fridgeHeader: 0x5b6770,
  fridgePlate: 0x7b8791,
  grille: 0x33383d,
  grilleSlat: 0x7d858a,
  wire: 0xbcc2c4,
  glassTint: 0xcfe6ea,
  lightStrip: 0xfff4d6,
  freezerBody: 0xe9e3d0,
  freezerRim: 0xd4cfbf,
  freezerStripe: 0x6fb0bd,
  freezerPanel: 0x3e444a,
  freezerFrame: 0x9aa3a6,
  walnut: 0x5b4030,
  walnutDark: 0x3e2d22,
  birch: 0xd6bd90,
  rackBlue: 0x3e6188,
  rackSlot: 0x1f2f40,
  rackOrange: 0xd9822b,
  chipboard: 0xcdb98f,
  cardboard: 0xb98f5c,
  tape: 0xd9c49a,
  pallet: 0x77706a,
  crateGreen: 0x4f7d5a,
  crateSand: 0xc58a3d,
  bottleGlass: 0x7a5a36,
} as const;

/** Materials shared by all furniture factories (created once per `Materials` set, no textures). */
export interface FurnitureMaterials {
  counterFront: MeshLambertMaterial;
  counterPanel: MeshLambertMaterial;
  counterWorn: MeshLambertMaterial;
  counterTop: MeshLambertMaterial;
  edgeTrim: MeshLambertMaterial;
  plinth: MeshLambertMaterial;
  inner: MeshLambertMaterial;
  drawer: MeshLambertMaterial;
  steel: MeshLambertMaterial;
  regBody: MeshLambertMaterial;
  regDrawer: MeshLambertMaterial;
  keyLight: MeshLambertMaterial;
  keyGreen: MeshLambertMaterial;
  keyOrange: MeshLambertMaterial;
  screen: MeshLambertMaterial;
  screenDash: MeshLambertMaterial;
  shelfDark: MeshLambertMaterial;
  shelfLight: MeshLambertMaterial;
  priceRail: MeshLambertMaterial;
  pegboard: MeshLambertMaterial;
  gondolaBody: MeshLambertMaterial;
  gondolaShelf: MeshLambertMaterial;
  gondolaBase: MeshLambertMaterial;
  fridgeBody: MeshLambertMaterial;
  fridgeInner: MeshLambertMaterial;
  fridgeFrame: MeshLambertMaterial;
  fridgeHeader: MeshLambertMaterial;
  fridgePlate: MeshLambertMaterial;
  grille: MeshLambertMaterial;
  grilleSlat: MeshLambertMaterial;
  wire: MeshLambertMaterial;
  glass: MeshLambertMaterial;
  lightStrip: MeshBasicMaterial;
  freezerBody: MeshLambertMaterial;
  freezerRim: MeshLambertMaterial;
  freezerStripe: MeshLambertMaterial;
  freezerPanel: MeshLambertMaterial;
  freezerFrame: MeshLambertMaterial;
  walnut: MeshLambertMaterial;
  walnutDark: MeshLambertMaterial;
  birch: MeshLambertMaterial;
  rackBlue: MeshLambertMaterial;
  rackSlot: MeshLambertMaterial;
  rackOrange: MeshLambertMaterial;
  chipboard: MeshLambertMaterial;
  cardboard: MeshLambertMaterial;
  tape: MeshLambertMaterial;
  pallet: MeshLambertMaterial;
  crateGreen: MeshLambertMaterial;
  crateSand: MeshLambertMaterial;
  bottleGlass: MeshLambertMaterial;
}

const cache = new WeakMap<Materials, FurnitureMaterials>();

export function getFurnitureMaterials(base: Materials): FurnitureMaterials {
  const hit = cache.get(base);
  if (hit) return hit;
  const p = furniturePalette;
  const lambert = (color: number, extra: MeshLambertMaterialParameters = {}): MeshLambertMaterial =>
    new MeshLambertMaterial({ color, ...extra });
  const out: FurnitureMaterials = {
    counterFront: lambert(p.counterFront),
    counterPanel: lambert(p.counterPanel),
    counterWorn: lambert(p.counterWorn),
    counterTop: lambert(p.counterTop),
    edgeTrim: lambert(p.edgeTrim),
    plinth: lambert(p.plinth),
    inner: lambert(p.inner),
    drawer: lambert(p.drawer),
    steel: lambert(p.steel),
    regBody: lambert(p.regBody),
    regDrawer: lambert(p.regDrawer),
    keyLight: lambert(p.keyLight),
    keyGreen: lambert(p.keyGreen),
    keyOrange: lambert(p.keyOrange),
    screen: lambert(p.screen, { emissive: new Color(0x2a3a2e) }),
    screenDash: lambert(p.screenDash),
    shelfDark: lambert(p.shelfDark),
    shelfLight: base.woodLight,
    priceRail: lambert(p.priceRail),
    pegboard: lambert(p.pegboard),
    gondolaBody: lambert(p.gondolaBody),
    gondolaShelf: lambert(p.gondolaShelf),
    gondolaBase: lambert(p.gondolaBase),
    fridgeBody: lambert(p.fridgeBody),
    fridgeInner: lambert(p.fridgeInner, { emissive: new Color(0x3a3a34) }),
    fridgeFrame: lambert(p.fridgeFrame),
    fridgeHeader: lambert(p.fridgeHeader),
    fridgePlate: lambert(p.fridgePlate),
    grille: lambert(p.grille),
    grilleSlat: lambert(p.grilleSlat),
    wire: lambert(p.wire),
    glass: lambert(p.glassTint, { transparent: true, opacity: 0.22, depthWrite: false, emissive: new Color(0x1c2a2c) }),
    lightStrip: new MeshBasicMaterial({ color: p.lightStrip }),
    freezerBody: lambert(p.freezerBody),
    freezerRim: lambert(p.freezerRim),
    freezerStripe: lambert(p.freezerStripe),
    freezerPanel: lambert(p.freezerPanel),
    freezerFrame: lambert(p.freezerFrame),
    walnut: lambert(p.walnut),
    walnutDark: lambert(p.walnutDark),
    birch: lambert(p.birch),
    rackBlue: lambert(p.rackBlue),
    rackSlot: lambert(p.rackSlot),
    rackOrange: lambert(p.rackOrange),
    chipboard: lambert(p.chipboard),
    cardboard: lambert(p.cardboard),
    tape: lambert(p.tape),
    pallet: lambert(p.pallet),
    crateGreen: lambert(p.crateGreen),
    crateSand: lambert(p.crateSand),
    bottleGlass: lambert(p.bottleGlass),
  };
  cache.set(base, out);
  return out;
}
