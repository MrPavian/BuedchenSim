import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { quarterTurnToRadians } from '../../game/placement';
import { slotUnitPositions, type UnitSize } from '../../game/stockLayout';
import type { PlacementDef, StockSlotDef } from '../../game/types';

/**
 * Pure placement math of the stock view (no scene, no DOM): where the units of a slot stand in the placement's
 * local frame and how that frame maps to the world. The positions themselves come from `slotUnitPositions`
 * (game layer), so what is drawn always equals the capacity the game computes.
 */

/** How far goods lean back against a sloped tray (radians). */
export const TRAY_LEAN = 0.22;
/** Lift above a sloped surface so the lower edge of a leaning unit never cuts into it (metres). */
export const TRAY_CLEARANCE = 0.003;

export interface SlotFrame {
  /** The slot faces -Z (back side of a double-sided shelf): units face -Z and fill from the -Z edge. */
  mirrored: boolean;
  /** Tilt of the surface the units stand on, radians (front end lower); 0 for flat boards. */
  tilt: number;
}

/** Pose of one unit in the placement's local frame: bottom-centre position, yaw about Y, then pitch about X (negative = top leans back). */
export interface UnitPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

const NEAR = 1e-3;

/**
 * Slots that face -Z: slots on the back (z < 0) of a placement that has a slot at the same x and height on the
 * front side (z > 0), i.e. both long sides of a free-standing shelf. Staff-side-only slots (counter) are not mirrored.
 */
export function findMirroredSlots(slots: readonly StockSlotDef[]): Set<string> {
  const mirrored = new Set<string>();
  for (const slot of slots) {
    if (slot.origin.z >= -0.02) continue;
    const hasFront = slots.some(
      (other) =>
        other.placementId === slot.placementId &&
        other.origin.z > 0.02 &&
        Math.abs(other.origin.x - slot.origin.x) < NEAR &&
        Math.abs(other.origin.y - slot.origin.y) < NEAR,
    );
    if (hasFront) mirrored.add(slot.id);
  }
  return mirrored;
}

/**
 * Poses of the first `count` units of a slot. Same fill order and capacity as `slotUnitPositions`; a mirrored slot
 * reflects the rows about the slot centre (z), which keeps every unit inside the slot box.
 */
export function slotUnitPoses(
  slot: Pick<StockSlotDef, 'origin' | 'size'>,
  unit: UnitSize,
  maxStack: number,
  frame: SlotFrame,
  count: number,
): UnitPose[] {
  const positions = slotUnitPositions(slot, unit, { maxStack }).slice(0, Math.max(0, count));
  const slope = Math.tan(frame.tilt);
  return positions.map((p) => {
    if (frame.mirrored) return { x: p.x, y: p.y, z: 2 * slot.origin.z - p.z, yaw: Math.PI, pitch: 0 };
    if (frame.tilt > 0) {
      return { x: p.x, y: p.y + (slot.origin.z - p.z) * slope + TRAY_CLEARANCE, z: p.z, yaw: 0, pitch: -TRAY_LEAN };
    }
    return { x: p.x, y: p.y, z: p.z, yaw: 0, pitch: 0 };
  });
}

/** Matrix of a placement's local frame (pivot at the ground centre, base height, quarter turn, optional scale). */
export function placementMatrix(placement: PlacementDef, baseHeight: number, out = new Matrix4()): Matrix4 {
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), quarterTurnToRadians(placement.rotation));
  const s = placement.scale ?? 1;
  return out.compose(new Vector3(placement.position.x, baseHeight, placement.position.z), rotation, new Vector3(s, s, s));
}

const euler = new Euler();
const local = new Matrix4();

/** World matrix of one unit: placement frame, then the unit pose (translate, yaw, pitch). */
export function unitWorldMatrix(placementM: Matrix4, pose: UnitPose, out = new Matrix4()): Matrix4 {
  euler.set(pose.pitch, pose.yaw, 0, 'YXZ');
  local.makeRotationFromEuler(euler).setPosition(pose.x, pose.y, pose.z);
  return out.multiplyMatrices(placementM, local);
}
