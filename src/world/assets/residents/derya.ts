import type { Materials } from '../../materials';
import { PartKit, addArm, addFace, addLeg, createRig, finishFigure, seedFromId, type GaitStyle, type ResidentFigure } from './kit';

const C = {
  shirt: 0xd0a23c,
  shirtDark: 0xb48a2c,
  trousers: 0x54402e,
  pads: 0x2c2c2c,
  boots: 0x5b3a21,
  skin: 0xc9916a,
  hair: 0x34241d,
  belt: 0x8b5a2b,
  pouch: 0x5e3b1f,
  steel: 0x8b9096,
  wood: 0xc08a4a,
  pencil: 0xe6c53a,
};

export const DERYA_STYLE: GaitStyle = {
  strideRadPerMetre: 4.3,
  refSpeed: 1.3,
  legSwing: 0.5,
  armSwing: 0.45,
  armSwingL: 1,
  armSwingR: 1,
  bob: 0.02,
  stoop: 0.03,
  walkLean: 0.04,
  headPitch: 0,
  armRest: 0.16,
  sway: 0.03,
  breath: 0.012,
  talkArm: 'right',
  gesture: 0.3,
  nod: 0.08,
  idlePace: 1,
};

/**
 * N-003 Derya, 38, carpenter. About 1.73 m, broad shoulders and a wide, sturdy stance: mustard work shirt with
 * rolled sleeves (bare forearms, cuff roll), brown work trousers with dark knee pads, a tan tool belt with a pouch
 * and a hammer on the left hip, heavy brown boots, dark hair in a bun with a pencil.
 */
export function createDeryaN003(assetId: string, m: Materials): ResidentFigure {
  const kit = new PartKit(m);
  const rig = createRig('resident.derya', { hipY: 0.82, hipX: 0.115, shoulderY: 0.5, shoulderX: 0.3, neckY: 0.56 });
  const { torso, head, armL, armR, legL, legR } = rig;

  kit.capsule(torso, C.shirt, [0.52, 0.57, 0.31], [0, 0.275, 0]);
  kit.box(torso, C.trousers, [0.43, 0.16, 0.28], [0, 0.0, 0]);
  // Tool belt with pouch (right hip) and hammer (left hip).
  kit.cylinder(torso, C.belt, 0.27, 0.07, 0.165, [0, 0.07, 0]);
  kit.box(torso, C.pouch, [0.13, 0.16, 0.09], [0.26, 0.0, 0.05]);
  kit.box(torso, C.wood, [0.032, 0.26, 0.032], [-0.26, -0.08, 0.04]);
  kit.box(torso, C.steel, [0.12, 0.055, 0.045], [-0.26, 0.06, 0.04]);
  kit.box(torso, C.pouch, [0.1, 0.12, 0.07], [0.07, 0.0, 0.17]);

  addFace(kit, head, C.skin, 0.175, 0.17);
  kit.dome(head, C.hair, [0.19, 0.16, 0.2], [0, 0.215, -0.02], [-0.3, 0, 0]);
  kit.sphere(head, C.hair, [0.075, 0.07, 0.07], [0, 0.27, -0.16]);
  kit.cylinder(head, C.pencil, 0.009, 0.12, 0.009, [0.09, 0.28, -0.1], [0.3, 0, -1.1]);

  for (const arm of [armL, armR]) {
    addArm(kit, arm, { length: 0.56, radius: 0.062, sleeve: C.shirt, sleeveLen: 0.22, skin: C.skin, handRadius: 0.075 });
    kit.cylinder(arm, C.shirtDark, 0.077, 0.05, 0.077, [0, -0.215, 0]);
  }

  for (const leg of [legL, legR]) {
    addLeg(kit, leg, { hipY: 0.82, radius: 0.097, cloth: C.trousers, shoe: C.boots, shoeSize: [0.15, 0.12, 0.3], taper: 0.95 });
    kit.box(leg, C.pads, [0.15, 0.15, 0.07], [0, -0.43, 0.09]);
  }

  return finishFigure({ assetId, rig, style: DERYA_STYLE, kit, seed: seedFromId('N-003') });
}
