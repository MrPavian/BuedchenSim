import type { RegionLayout } from '../../../game/types';
import { ruhrgebietNav } from './nav';

/** Layout of the first kiosk (K-001): placement list for the interior and yard, plus sidewalk, curb, street and yard. */
export const ruhrgebietLayout: RegionLayout = {
  kiosk: {
    assetId: 'K-001',
    footprint: { minX: -3, maxX: 3, minZ: -2, maxZ: 2 },
    height: 3.2,
    wallThickness: 0.15,
    openings: [
      { id: 'opening.sales-window', kind: 'window', side: 'south', from: -2.4, to: 0.4, sill: 1.0, head: 2.2 },
      { id: 'opening.door', kind: 'door', side: 'south', from: 1.5, to: 2.5, sill: 0, head: 2.1 },
    ],
    signText: 'BÜDCHEN AM ECK',
  },
  layoutVersion: 1,
  /**
   * Kiosk interior x -2.85..2.85, z -1.85..1.85; sales window and door in the south wall.
   * Tall items (>= 1.5 m) stand against the north/west walls, away from the south wall (camera side).
   * Rotation: counter-clockwise seen from above; 0 = front toward +Z, 90 = +X, 180 = -Z, 270 = -X.
   */
  placements: [
    // Sales: counter directly behind the window (rect x -2.4..0.4, z 1.2..1.85), register on top.
    { id: 'placement.counter', assetId: 'I-001', position: { x: -1.0, z: 1.525 }, rotation: 0, role: 'sales' },
    {
      id: 'placement.register',
      assetId: 'I-002',
      position: { x: -0.2, z: 1.525 },
      rotation: 180,
      on: 'placement.counter',
      role: 'checkout',
    },
    // Wall shelves: north wall (front south) and west wall (front east); both face the room.
    { id: 'placement.wall-shelf-north', assetId: 'I-003', position: { x: -1.65, z: -1.65 }, rotation: 0, role: 'display' },
    { id: 'placement.wall-shelf-west', assetId: 'I-003', position: { x: -2.65, z: -0.2 }, rotation: 90, role: 'display' },
    // North wall row, west to east: drinks fridge, magazine rack, storage shelf.
    { id: 'placement.fridge', assetId: 'I-005', position: { x: 0.05, z: -1.5 }, rotation: 0, role: 'cooling' },
    { id: 'placement.magazine-rack', assetId: 'I-007', position: { x: 0.95, z: -1.65 }, rotation: 0, role: 'display' },
    { id: 'placement.storage-shelf', assetId: 'I-011', position: { x: 2.1, z: -1.6 }, rotation: 0, role: 'storage' },
    // East wall: chest freezer, front toward the room (west).
    { id: 'placement.freezer', assetId: 'I-006', position: { x: 2.525, z: -0.6 }, rotation: 270, role: 'freezing' },
    // Free-standing middle shelf between the shelves and the counter.
    { id: 'placement.middle-shelf', assetId: 'I-004', position: { x: -1.0, z: -0.2 }, rotation: 0, role: 'display' },
    // Returns: one crate area at the east end of the counter inside, one outside against the west wall (visible from the camera).
    { id: 'placement.returns-inside', assetId: 'I-012', position: { x: 0.95, z: 1.5 }, rotation: 180, role: 'returns' },
    { id: 'placement.returns-yard', assetId: 'I-012', position: { x: -3.45, z: 0.6 }, rotation: 270, role: 'returns' },
    // Story consequences (exist only with their flag). Yard bench north of the yard place (x -6.4..-4.8, z -0.75..-0.25), front toward
    // the street; residents stand 0.65 m in front of it. Validation treats gated placements as present.
    { id: 'placement.yard-bench', assetId: 'E-004', position: { x: -5.6, z: -0.5 }, rotation: 0, requiresFlag: 'yard.bench' },
    // Framed photo on the customer-side half of the counter at the west end of the window (x -2.16..-1.84, z 1.70..1.80):
    // clear of the register (x -0.425..0.025) and the counter stock slots (z <= 1.525), visible through the window.
    {
      id: 'placement.kiosk-photo',
      assetId: 'I-013',
      position: { x: -2.0, z: 1.75 },
      rotation: 0,
      on: 'placement.counter',
      requiresFlag: 'kiosk.photo',
    },
  ],
  ground: [
    { id: 'ground.sidewalk', assetId: 'E-001', kind: 'sidewalk', rect: { minX: -12, maxX: 12, minZ: 2, maxZ: 5 } },
    { id: 'ground.curb', kind: 'curb', rect: { minX: -12, maxX: 12, minZ: 5, maxZ: 5.2 } },
    { id: 'ground.street', assetId: 'E-002', kind: 'street', rect: { minX: -12, maxX: 12, minZ: 5.2, maxZ: 11 } },
    { id: 'ground.yard', kind: 'yard', rect: { minX: -12, maxX: 12, minZ: -8, maxZ: 2 } },
  ],
  walkBounds: { minX: -11, maxX: 11, minZ: -7, maxZ: 4.8 },
  spawn: { position: { x: 0.9, z: 3.6 }, heading: Math.PI },
  interactionPoints: [
    { id: 'interaction.door', kind: 'door', position: { x: 2.0, z: 2.0 }, radius: 1.4, openingId: 'opening.door' },
    {
      id: 'interaction.shutter',
      kind: 'shutter',
      position: { x: -1.0, z: 1.6 },
      radius: 1.7,
      openingId: 'opening.sales-window',
      // Marker on the outer zinc ledge (wall outer face z 2.075, ledge to z 2.355, top at 1.0 m), in front of the closed flap
      // (front face z 2.17) and clear of the open one: a flat ellipse of x 1.0 / z 0.085 around z 2.265.
      marker: { position: { x: -1.0, z: 2.265 }, height: 1.0, radius: 1.0, radiusZ: 0.085 },
    },
    // Till: standing spot behind the counter next to the register (about x -0.2, z 0.9; the counter blocks z > 0.9).
    // Radius 0.45 keeps it nearer than the shutter only within ~0.4 m of the register; further west (x <= -0.8) the shutter wins.
    // Marker: flat ellipse on the counter top, staff-side strip beside the register (register footprint z 1.325..1.725).
    {
      id: 'interaction.register',
      kind: 'register',
      position: { x: -0.2, z: 0.95 },
      radius: 0.45,
      marker: { position: { x: -0.2, z: 1.262 }, height: 1.0, radius: 0.24, radiusZ: 0.055 },
    },
    // Back storage: standing spot in front of the storage rack I-011 (x 1.5..2.7, z -1.85..-1.35), west of the
    // freezer (x >= 2.2); the player circle fits at about x 1.75, z -1.0. Marker: ring on the floor in front of the rack.
    {
      id: 'interaction.storage',
      kind: 'storage',
      position: { x: 1.75, z: -1.0 },
      radius: 0.6,
      marker: { position: { x: 1.75, z: -1.0 }, height: 0.03, radius: 0.35 },
    },
  ],
  nav: ruhrgebietNav,
};
