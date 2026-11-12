import type { RegionLayout } from '../../../game/types';

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
    // Returns: one crate area at the east end of the counter inside, one in the yard behind the kiosk.
    { id: 'placement.returns-inside', assetId: 'I-012', position: { x: 0.95, z: 1.5 }, rotation: 180, role: 'returns' },
    { id: 'placement.returns-yard', assetId: 'I-012', position: { x: -1.5, z: -2.4 }, rotation: 180, role: 'returns' },
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
      marker: { position: { x: -1.0, z: 1.95 }, height: 1.03 },
    },
  ],
};
