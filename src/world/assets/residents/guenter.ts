import { Group } from 'three';
import type { Materials } from '../../materials';
import { PartKit, addArm, addFace, addLeg, createRig, finishFigure, seedFromId, type GaitStyle, type ResidentFigure } from './kit';

const C = {
  jacket: 0x8e9296,
  jacketHem: 0x777c81,
  trousers: 0x4a4d54,
  shoes: 0x3b3029,
  skin: 0xe0b394,
  hair: 0xe6e3dc,
  cap: 0x68693f,
  capBrim: 0x54552f,
  scarf: 0x8a3a3a,
  wood: 0x7a4f2a,
};

export const GUENTER_STYLE: GaitStyle = {
  strideRadPerMetre: 6.0,
  refSpeed: 1.0,
  legSwing: 0.34,
  armSwing: 0.3,
  armSwingL: 1,
  armSwingR: 0.22,
  bob: 0.01,
  stoop: 0.24,
  walkLean: 0.03,
  headPitch: 0.02,
  armRest: 0.1,
  sway: 0.03,
  breath: 0.012,
  talkArm: 'left',
  gesture: 0.22,
  nod: 0.07,
  idlePace: 0.7,
};

/**
 * N-002 Guenter, 71, retired railway signalman. About 1.72 m at rest (a slight stoop takes ~6 cm off his height):
 * flat olive cap with a short brim, light grey long jacket with a red scarf, charcoal trousers, white hair at the
 * sides, a walking stick in the right hand. Narrow shoulders, rounded back, slow short steps.
 */
export function createGuenterN002(assetId: string, m: Materials): ResidentFigure {
  const kit = new PartKit(m);
  const rig = createRig('resident.guenter', { hipY: 0.78, hipX: 0.09, shoulderY: 0.52, shoulderX: 0.25, neckY: 0.6 });
  const { torso, head, armL, armR, legL, legR } = rig;

  kit.capsule(torso, C.jacket, [0.44, 0.62, 0.29], [0, 0.3, 0]);
  kit.taper(torso, C.jacketHem, 0.255, 0.2, 0.175, [0, 0.02, 0]);
  // Scarf: collar ring and a short end hanging down the chest.
  kit.cylinder(torso, C.scarf, 0.16, 0.08, 0.13, [0, 0.6, 0.0]);
  kit.box(torso, C.scarf, [0.07, 0.22, 0.03], [0.06, 0.5, 0.14]);

  addFace(kit, head, C.skin, 0.165, 0.17);
  // Hair at the sides and back, flat cap on top.
  for (const x of [-1, 1]) kit.sphere(head, C.hair, [0.045, 0.07, 0.07], [x * 0.155, 0.14, -0.02]);
  kit.sphere(head, C.hair, [0.14, 0.09, 0.07], [0, 0.12, -0.11]);
  kit.dome(head, C.cap, [0.2, 0.085, 0.215], [0, 0.235, -0.01], [-0.12, 0, 0]);
  kit.box(head, C.capBrim, [0.2, 0.02, 0.1], [0, 0.245, 0.18], [0.12, 0, 0]);

  addArm(kit, armL, { length: 0.56, radius: 0.052, sleeve: C.jacket, sleeveLen: 0.52, skin: C.skin });
  addArm(kit, armR, { length: 0.56, radius: 0.052, sleeve: C.jacket, sleeveLen: 0.52, skin: C.skin });
  // Walking stick in the right hand: crook, shaft, rubber tip. Counter-rotated so it hangs vertical despite the stoop.
  const stick = new Group();
  stick.position.set(0.005, -0.6, 0.03);
  stick.rotation.x = -GUENTER_STYLE.stoop;
  armR.add(stick);
  kit.cylinder(stick, C.wood, 0.017, 0.8, 0.017, [0, -0.29, 0]);
  kit.cylinder(stick, C.wood, 0.019, 0.12, 0.019, [0, 0.16, 0.03], [Math.PI / 2, 0, 0]);
  kit.box(stick, 0x222222, [0.04, 0.03, 0.04], [0, -0.675, 0]);

  addLeg(kit, legL, { hipY: 0.78, radius: 0.07, cloth: C.trousers, shoe: C.shoes });
  addLeg(kit, legR, { hipY: 0.78, radius: 0.07, cloth: C.trousers, shoe: C.shoes });

  return finishFigure({ assetId, rig, style: GUENTER_STYLE, kit, seed: seedFromId('N-002') });
}
