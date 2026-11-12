import { Color, DoubleSide, MeshBasicMaterial, MeshLambertMaterial, type Texture } from 'three';
import type { Materials } from '../../materials';
import {
  createAwningTexture,
  createBrickTexture,
  createDoormatTexture,
  createFlapTexture,
  createFloorTexture,
  createInteriorWallTexture,
  createPlateTexture,
  createRoofTexture,
  createSignTexture,
} from './textures';

/** Kiosk-specific colours (fictional, regional: brick, plaster, concrete, painted wood, zinc). */
export const kioskPalette = {
  plaster: 0xe3d5b6,
  concrete: 0x9a968d,
  cap: 0x8c8982,
  metal: 0x4d565a,
  zinc: 0xa7aeb0,
  paintTeal: 0x2f6a6e,
  frame: 0xe8dcc0,
  stoneThreshold: 0xaaa69b,
  lampWarm: 0xfff0c8,
  awningA: 0xc9902f,
  awningB: 0xf2e7c9,
} as const;

/** Materials owned by the kiosk factory; textures are registered on `Materials.textures` for disposal. */
export interface KioskMaterials {
  /** Solid-builder buckets (all use vertex colours for dirt/wear). */
  buckets: Record<
    'brick' | 'inner' | 'reveal' | 'cap' | 'plinth' | 'band' | 'roofTop' | 'coping' | 'fascia',
    MeshLambertMaterial
  >;
  floor: MeshLambertMaterial;
  doormat: MeshLambertMaterial;
  threshold: MeshLambertMaterial;
  metal: MeshLambertMaterial;
  zinc: MeshLambertMaterial;
  frame: MeshLambertMaterial;
  paintTeal: MeshLambertMaterial;
  paintTealDark: MeshLambertMaterial;
  glass: MeshLambertMaterial;
  awningTop: MeshLambertMaterial;
  awningUnder: MeshLambertMaterial;
  awningTrim: MeshLambertMaterial;
  lampGlow: MeshBasicMaterial;
  /** Self-lit sign/plate faces are created per size (texture depends on dimensions). */
  signFace(text: string, w: number, h: number): MeshLambertMaterial;
  plateFace(text: string, w: number, h: number): MeshLambertMaterial;
  flapFace(w: number, h: number): MeshLambertMaterial;
}

const cache = new WeakMap<Materials, KioskMaterials>();

export function getKioskMaterials(base: Materials): KioskMaterials {
  const hit = cache.get(base);
  if (hit) return hit;

  const own = (t: Texture | null): Texture | null => {
    if (t) base.textures.push(t);
    return t;
  };
  const lambert = (color: number, extra: Partial<ConstructorParameters<typeof MeshLambertMaterial>[0]> = {}): MeshLambertMaterial =>
    new MeshLambertMaterial({ color, ...extra });
  const textured = (tex: Texture | null, fallback: number, extra: Partial<ConstructorParameters<typeof MeshLambertMaterial>[0]> = {}): MeshLambertMaterial =>
    tex ? new MeshLambertMaterial({ map: tex, ...extra }) : new MeshLambertMaterial({ color: fallback, ...extra });

  const brickTex = own(createBrickTexture());
  const interiorTex = own(createInteriorWallTexture());
  const roofTex = own(createRoofTexture());
  const floorTex = own(createFloorTexture());
  const awningTex = own(createAwningTexture('#c9902f', '#f2e7c9'));
  const matTex = own(createDoormatTexture());

  const vc = { vertexColors: true };
  const buckets: KioskMaterials['buckets'] = {
    brick: textured(brickTex, 0xb5694c, vc),
    inner: textured(interiorTex, 0xe9dcb8, vc),
    reveal: lambert(kioskPalette.plaster, vc),
    cap: lambert(kioskPalette.cap, vc),
    plinth: lambert(kioskPalette.concrete, vc),
    band: lambert(kioskPalette.plaster, vc),
    roofTop: textured(roofTex, 0x4a4e55, vc),
    coping: lambert(kioskPalette.zinc, vc),
    fascia: lambert(0xd5c7a6, vc),
  };

  const floor = textured(floorTex, 0xcdb597);
  const doormat = textured(matTex, 0x3a3935);

  const faceMaterial = (tex: Texture | null, fallback: number, emissive: number): MeshLambertMaterial => {
    const mat = tex
      ? new MeshLambertMaterial({ map: tex, emissive: new Color(emissive), emissiveMap: tex, emissiveIntensity: 0.5 })
      : new MeshLambertMaterial({ color: fallback });
    return mat;
  };

  const out: KioskMaterials = {
    buckets,
    floor,
    doormat,
    threshold: lambert(kioskPalette.stoneThreshold),
    metal: lambert(kioskPalette.metal),
    zinc: lambert(kioskPalette.zinc),
    frame: lambert(kioskPalette.frame),
    paintTeal: lambert(kioskPalette.paintTeal),
    paintTealDark: lambert(0x255458),
    glass: lambert(0x9fb9bd, { emissive: new Color(0x1c2a2c) }),
    awningTop: textured(awningTex, kioskPalette.awningA, { side: DoubleSide }),
    awningUnder: lambert(0xcdbf9d),
    awningTrim: lambert(kioskPalette.awningA),
    lampGlow: new MeshBasicMaterial({ color: kioskPalette.lampWarm }),
    signFace: (text, w, h) => faceMaterial(own(createSignTexture(text, w, h)), 0x25483f, 0xffe6b0),
    plateFace: (text, w, h) => faceMaterial(own(createPlateTexture(text, w, h)), 0xefe3c2, 0x806a40),
    flapFace: (w, h) => textured(own(createFlapTexture(w, h)), 0x3f7d73),
  };
  cache.set(base, out);
  return out;
}
