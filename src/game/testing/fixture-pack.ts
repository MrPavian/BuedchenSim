import type { ContentPack, RegionLayout } from '../types';

/**
 * Self-contained test fixture so game tests do not depend on the content layer
 * (game imports core only). Mirrors the shape of a real region pack.
 */
const layout: RegionLayout = {
  kiosk: {
    assetId: 'K-001',
    footprint: { minX: -3, maxX: 3, minZ: -2, maxZ: 2 },
    height: 3.2,
    wallThickness: 0.15,
    openings: [
      { id: 'opening.sales-window', kind: 'window', side: 'south', from: -2.4, to: 0.4, sill: 1.0, head: 2.2 },
      { id: 'opening.door', kind: 'door', side: 'south', from: 1.5, to: 2.5, sill: 0, head: 2.1 },
    ],
    signText: 'TEST KIOSK',
  },
  furniture: [
    {
      id: 'furniture.counter',
      assetId: 'I-001',
      rect: { minX: -2.4, maxX: 0.4, minZ: 1.2, maxZ: 1.85 },
      height: 1.0,
    },
    {
      id: 'furniture.wall-shelf',
      assetId: 'I-003',
      rect: { minX: -2.6, maxX: 1.0, minZ: -1.85, maxZ: -1.45 },
      height: 2.0,
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
    },
  ],
};

export const testPack: ContentPack = { regionId: 'region.test', name: 'Test', layout };
