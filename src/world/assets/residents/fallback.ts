import type { Materials } from '../../materials';
import { PartKit, addArm, addFace, addLeg, createRig, finishFigure, seedFromId, type GaitStyle, type ResidentFigure } from './kit';

const STYLE: GaitStyle = {
  strideRadPerMetre: 4.6,
  refSpeed: 1.3,
  legSwing: 0.45,
  armSwing: 0.45,
  armSwingL: 1,
  armSwingR: 1,
  bob: 0.015,
  stoop: 0,
  walkLean: 0.03,
  headPitch: 0,
  armRest: 0.1,
  sway: 0.02,
  breath: 0.01,
  talkArm: 'right',
  gesture: 0.25,
  nod: 0.08,
  idlePace: 1,
};

/** Neutral grey 1.7 m figure for asset ids without a dedicated factory (the caller logs the warning). */
export function createNeutralResident(assetId: string, m: Materials): ResidentFigure {
  const kit = new PartKit(m);
  const rig = createRig('resident.neutral', { hipY: 0.8, hipX: 0.1, shoulderY: 0.52, shoulderX: 0.27, neckY: 0.58 });
  kit.capsule(rig.torso, 0x9aa0a6, [0.46, 0.6, 0.28], [0, 0.29, 0]);
  addFace(kit, rig.head, 0xdcc0a8, 0.17, 0.17);
  for (const arm of [rig.armL, rig.armR]) addArm(kit, arm, { length: 0.55, radius: 0.055, sleeve: 0x9aa0a6, sleeveLen: 0.5, skin: 0xdcc0a8 });
  for (const leg of [rig.legL, rig.legR]) addLeg(kit, leg, { hipY: 0.8, radius: 0.08, cloth: 0x6c7279, shoe: 0x3a3a3a });
  return finishFigure({ assetId, rig, style: STYLE, kit, seed: seedFromId(assetId) });
}
