import type { AssetDef, QuarterTurn } from '../../game/types';
import { productAssets } from './productAssets';

const ALL: QuarterTurn[] = [0, 90, 180, 270];

/**
 * Asset catalog (register ids from docs/artwork-prompts/07-artwork-register.md).
 * Size = bounding box in metres at rotation 0 (width X, depth Z, height Y); pivot = ground centre
 * of that box; the front (use side) faces +Z at rotation 0. No asset is scalable in phase 2.
 */
export const assetCatalog: Record<string, AssetDef> = {
  'K-001': {
    assetId: 'K-001',
    name: 'Musterkiosk',
    category: 'building',
    size: { width: 6, depth: 4, height: 3.2 },
    collides: false, // walls come from kioskGeometry
    allowedRotations: [0],
    scalable: false,
  },
  'I-001': {
    assetId: 'I-001',
    name: 'Verkaufstheke',
    category: 'furniture',
    size: { width: 2.8, depth: 0.65, height: 1.0 },
    collides: true,
    allowedRotations: [0, 180],
    scalable: false,
    defaultRole: 'sales',
  },
  'I-002': {
    assetId: 'I-002',
    name: 'Kasse',
    category: 'furniture',
    size: { width: 0.45, depth: 0.4, height: 0.35 },
    collides: false,
    allowedRotations: ALL,
    scalable: false,
    requiresSupport: true,
    defaultRole: 'checkout',
  },
  'I-003': {
    assetId: 'I-003',
    name: 'Wandregal',
    category: 'furniture',
    size: { width: 2.4, depth: 0.4, height: 2.0 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'display',
  },
  'I-004': {
    assetId: 'I-004',
    name: 'Mittelregal',
    category: 'furniture',
    size: { width: 1.2, depth: 0.5, height: 1.35 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'display',
  },
  'I-005': {
    assetId: 'I-005',
    name: 'Getränkekühlschrank',
    category: 'furniture',
    size: { width: 0.7, depth: 0.7, height: 2.0 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'cooling',
  },
  'I-006': {
    assetId: 'I-006',
    name: 'Eistruhe',
    category: 'furniture',
    size: { width: 1.2, depth: 0.65, height: 0.9 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'freezing',
  },
  'I-007': {
    assetId: 'I-007',
    name: 'Zeitschriftenständer',
    category: 'furniture',
    size: { width: 0.8, depth: 0.4, height: 1.5 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'display',
  },
  'I-011': {
    assetId: 'I-011',
    name: 'Lagerregal',
    category: 'furniture',
    size: { width: 1.2, depth: 0.5, height: 1.9 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'storage',
  },
  'I-012': {
    assetId: 'I-012',
    name: 'Leergut- und Kistenbereich',
    category: 'furniture',
    size: { width: 0.9, depth: 0.7, height: 0.75 },
    collides: true,
    allowedRotations: ALL,
    scalable: false,
    defaultRole: 'returns',
  },
  // Product assets P-001 ... (one unit each); see productAssets.ts.
  ...productAssets,
  // Ground assets: size is informational (the ground areas carry their own rects).
  'E-001': {
    assetId: 'E-001',
    name: 'Gehweg',
    category: 'ground',
    size: { width: 24, depth: 3, height: 0.03 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'E-002': {
    assetId: 'E-002',
    name: 'Straße',
    category: 'ground',
    size: { width: 24, depth: 5.8, height: 0.02 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
};
