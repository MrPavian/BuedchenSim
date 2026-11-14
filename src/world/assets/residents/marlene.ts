import type { Materials } from '../../materials';
import { PartKit, addArm, addFace, addLeg, createRig, finishFigure, seedFromId, type GaitStyle, type ResidentFigure } from './kit';

const C = {
  cardigan: 0x7e3a5c,
  blouse: 0xf0e6cf,
  skirt: 0xb08d5e,
  tights: 0x4d4455,
  shoes: 0x3a2530,
  skin: 0xedc6a8,
  hair: 0xd5cbb0,
  frames: 0x8a2a3a,
  bag: 0x9bcfae,
  bagStripe: 0x4f8a68,
};

export const MARLENE_STYLE: GaitStyle = {
  strideRadPerMetre: 5.0,
  refSpeed: 1.2,
  legSwing: 0.4,
  armSwing: 0.5,
  armSwingL: 0.25,
  armSwingR: 1,
  bob: 0.012,
  stoop: -0.02,
  walkLean: 0.02,
  headPitch: 0,
  armRest: 0.16,
  sway: 0.015,
  breath: 0.012,
  talkArm: 'right',
  gesture: 0.25,
  nod: 0.09,
  idlePace: 1.1,
};

/**
 * N-007 Marlene, 58, school secretary. About 1.63 m, upright: plum cardigan over a cream blouse, camel midi skirt
 * with dark tights, plum shoes, short silver-blonde curls, red-framed glasses, a mint shopping bag in the left hand.
 */
export function createMarleneN007(assetId: string, m: Materials): ResidentFigure {
  const kit = new PartKit(m);
  const rig = createRig('resident.marlene', { hipY: 0.71, hipX: 0.08, shoulderY: 0.5, shoulderX: 0.22, neckY: 0.54 });
  const { torso, head, armL, armR, legL, legR } = rig;

  kit.capsule(torso, C.cardigan, [0.42, 0.54, 0.27], [0, 0.27, 0]);
  kit.box(torso, C.blouse, [0.11, 0.38, 0.012], [0, 0.31, 0.138]);
  kit.sphere(torso, C.blouse, [0.1, 0.04, 0.08], [0, 0.55, 0.03]);
  kit.taper(torso, C.skirt, 0.27, 0.44, 0.2, [0, -0.17, 0]);

  addFace(kit, head, C.skin, 0.16, 0.16);
  kit.dome(head, C.hair, [0.18, 0.17, 0.185], [0, 0.2, -0.015], [-0.3, 0, 0]);
  for (const x of [-1, 1]) kit.sphere(head, C.hair, [0.065, 0.085, 0.085], [x * 0.15, 0.16, -0.03]);
  kit.sphere(head, C.hair, [0.12, 0.1, 0.07], [0, 0.15, -0.12]);
  kit.box(head, C.frames, [0.3, 0.016, 0.012], [0, 0.185, 0.158]);
  for (const x of [-1, 1]) kit.box(head, C.frames, [0.1, 0.012, 0.008], [x * 0.075, 0.155, 0.158]);

  for (const arm of [armL, armR]) {
    addArm(kit, arm, { length: 0.5, radius: 0.05, sleeve: C.cardigan, sleeveLen: 0.46, skin: C.skin });
  }
  // Shopping bag hanging from the left hand: two handles, mint body with a darker stripe.
  kit.box(armL, C.bagStripe, [0.012, 0.15, 0.012], [-0.045, -0.63, 0.0]);
  kit.box(armL, C.bagStripe, [0.012, 0.15, 0.012], [0.045, -0.63, 0.0]);
  kit.box(armL, C.bag, [0.25, 0.3, 0.11], [-0.03, -0.84, 0.0]);
  kit.box(armL, C.bagStripe, [0.252, 0.05, 0.112], [-0.03, -0.78, 0.0]);

  for (const leg of [legL, legR]) {
    addLeg(kit, leg, { hipY: 0.71, radius: 0.06, cloth: C.tights, shoe: C.shoes, shoeSize: [0.1, 0.08, 0.25] });
  }

  return finishFigure({ assetId, rig, style: MARLENE_STYLE, kit, seed: seedFromId('N-007') });
}
