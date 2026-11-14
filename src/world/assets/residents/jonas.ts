import type { Materials } from '../../materials';
import { PartKit, addArm, addFace, addLeg, createRig, finishFigure, seedFromId, type GaitStyle, type ResidentFigure } from './kit';

const C = {
  hoodie: 0x363b46,
  trousers: 0x6e7580,
  shoes: 0xf1f1ef,
  skin: 0xefc29f,
  hair: 0x5b4030,
  helmet: 0xc6e63a,
  helmetBand: 0x6f8a1c,
  bag: 0x159a9c,
  bagFlap: 0x0f7476,
  reflect: 0xf3e45c,
};

export const JONAS_STYLE: GaitStyle = {
  strideRadPerMetre: 3.6,
  refSpeed: 1.8,
  legSwing: 0.62,
  armSwing: 0.65,
  armSwingL: 1,
  armSwingR: 1,
  bob: 0.03,
  stoop: 0.07,
  walkLean: 0.1,
  headPitch: 0.02,
  armRest: 0.07,
  sway: 0.02,
  breath: 0.012,
  talkArm: 'right',
  gesture: 0.3,
  nod: 0.1,
  idlePace: 1.7,
};

/**
 * N-006 Jonas, 17, bicycle courier. About 1.82 m and slim: lime cycling helmet with a visor, charcoal hoodie,
 * light grey slim trousers, white sneakers, a big teal courier bag at the back hip held by a reflective yellow
 * strap running diagonally across the chest. Long quick strides with a forward lean.
 */
export function createJonasN006(assetId: string, m: Materials): ResidentFigure {
  const kit = new PartKit(m);
  const rig = createRig('resident.jonas', { hipY: 0.86, hipX: 0.085, shoulderY: 0.52, shoulderX: 0.23, neckY: 0.58 });
  const { torso, head, armL, armR, legL, legR } = rig;

  kit.capsule(torso, C.hoodie, [0.38, 0.58, 0.25], [0, 0.28, 0]);
  kit.sphere(torso, C.hoodie, [0.12, 0.07, 0.09], [0, 0.57, -0.07]);
  // Strap across the chest (right shoulder to left hip) and the big bag at the back.
  kit.box(torso, C.reflect, [0.07, 0.6, 0.02], [0, 0.28, 0.13], [0, 0, -0.62]);
  kit.box(torso, C.bag, [0.5, 0.36, 0.17], [-0.04, 0.14, -0.2]);
  kit.box(torso, C.bagFlap, [0.52, 0.13, 0.19], [-0.04, 0.27, -0.205]);
  kit.box(torso, C.reflect, [0.52, 0.04, 0.19], [-0.04, 0.12, -0.205]);

  addFace(kit, head, C.skin, 0.16, 0.16);
  kit.sphere(head, C.hair, [0.085, 0.05, 0.05], [0, 0.1, -0.135]);
  kit.dome(head, C.helmet, [0.19, 0.17, 0.205], [0, 0.2, -0.005], [-0.12, 0, 0]);
  kit.cylinder(head, C.helmetBand, 0.193, 0.03, 0.208, [0, 0.205, -0.005]);
  kit.box(head, C.helmet, [0.2, 0.014, 0.09], [0, 0.215, 0.185], [0.2, 0, 0]);

  for (const arm of [armL, armR]) {
    addArm(kit, arm, { length: 0.54, radius: 0.048, sleeve: C.hoodie, sleeveLen: 0.5, skin: C.skin });
  }
  for (const leg of [legL, legR]) {
    addLeg(kit, leg, { hipY: 0.86, radius: 0.064, cloth: C.trousers, shoe: C.shoes, shoeSize: [0.12, 0.09, 0.27] });
  }

  return finishFigure({ assetId, rig, style: JONAS_STYLE, kit, seed: seedFromId('N-006') });
}
