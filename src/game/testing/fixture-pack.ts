import type { AssetDef, ContentPack, RegionLayout } from '../types';

/**
 * Self-contained test fixture so game tests do not depend on the content layer
 * (game imports core only). Mirrors the shape of a real region pack.
 */
const assets: Record<string, AssetDef> = {
  'K-001': {
    assetId: 'K-001',
    name: 'Test building',
    category: 'building',
    size: { width: 6, depth: 4, height: 3.2 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'I-001': {
    assetId: 'I-001',
    name: 'Test counter',
    category: 'furniture',
    size: { width: 2.8, depth: 0.65, height: 1.0 },
    collides: true,
    allowedRotations: [0, 180],
    scalable: false,
  },
  'I-002': {
    assetId: 'I-002',
    name: 'Test register',
    category: 'furniture',
    size: { width: 0.45, depth: 0.4, height: 0.35 },
    collides: false,
    allowedRotations: [0, 90, 180, 270],
    scalable: false,
    requiresSupport: true,
  },
  'I-003': {
    assetId: 'I-003',
    name: 'Test wall shelf',
    category: 'furniture',
    size: { width: 2.4, depth: 0.4, height: 2.0 },
    collides: true,
    allowedRotations: [0, 90, 180, 270],
    scalable: false,
  },
  'E-001': {
    assetId: 'E-001',
    name: 'Test sidewalk',
    category: 'ground',
    size: { width: 24, depth: 3, height: 0.03 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'E-002': {
    assetId: 'E-002',
    name: 'Test street',
    category: 'ground',
    size: { width: 24, depth: 5.8, height: 0.02 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
};

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
  layoutVersion: 1,
  placements: [
    { id: 'placement.counter', assetId: 'I-001', position: { x: -1.0, z: 1.525 }, rotation: 0 },
    {
      id: 'placement.register',
      assetId: 'I-002',
      position: { x: -0.2, z: 1.525 },
      rotation: 180,
      on: 'placement.counter',
    },
    { id: 'placement.wall-shelf-north', assetId: 'I-003', position: { x: -1.65, z: -1.65 }, rotation: 0 },
    { id: 'placement.wall-shelf-west', assetId: 'I-003', position: { x: -2.65, z: -0.2 }, rotation: 90 },
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

export const testPack: ContentPack = { regionId: 'region.test', name: 'Test', assets, layout };
