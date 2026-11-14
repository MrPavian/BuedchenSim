import type { Object3D } from 'three';
import { log } from '../../core/log';
import type { AssetDef, GroundAreaDef, KioskDef } from '../../game/types';
import type { Materials } from '../materials';
import {
  createBenchE004,
  createCounterI001,
  createCratesI012,
  createFreezerI006,
  createFridgeI005,
  createFurniturePlaceholder,
  createMagazineRackI007,
  createMiddleShelfI004,
  createPhotoI013,
  createRegisterI002,
  createStorageRackI011,
  createWallShelfI003,
} from './furniture';
import {
  createCurb,
  createGroundPlaceholder,
  createSidewalkE001,
  createStreetE002,
  createYard,
} from './ground';
import { createKioskK001 } from './kiosk';

export { createResident, hasResidentFactory, residentAssetIds, type ResidentAnimation, type ResidentFigure } from './residents';
export { createProductModel, hasProductFactory, productFactories, type ProductFactory } from './products';

/**
 * Asset factories by asset id. Every factory returns an Object3D whose pivot is the
 * ground centre of the asset's footprint; units are metres. Content refers to assets
 * only by id, so new regions add factories here (or in their own registry) as data.
 */
const kioskFactories: Record<string, (def: KioskDef, m: Materials) => Object3D> = {
  'K-001': createKioskK001,
};

/** Builds an asset at rotation 0, pivot at the ground centre, bounding box = `asset.size`, front toward +Z. */
export type FurnitureFactory = (asset: AssetDef, m: Materials) => Object3D;

const furnitureFactories: Record<string, FurnitureFactory> = {
  'I-001': createCounterI001,
  'I-002': createRegisterI002,
  'I-003': createWallShelfI003,
  'I-004': createMiddleShelfI004,
  'I-005': createFridgeI005,
  'I-006': createFreezerI006,
  'I-007': createMagazineRackI007,
  'I-011': createStorageRackI011,
  'I-012': createCratesI012,
  'I-013': createPhotoI013,
  // Yard furniture (E = environment) is built by the same furniture factories.
  'E-004': createBenchE004,
};

const groundFactories: Record<string, (def: GroundAreaDef, m: Materials) => Object3D> = {
  'E-001': createSidewalkE001,
  'E-002': createStreetE002,
};

/** Ground areas without an asset id fall back to a factory by kind. */
const groundByKind: Record<GroundAreaDef['kind'], (def: GroundAreaDef, m: Materials) => Object3D> = {
  sidewalk: createSidewalkE001,
  street: createStreetE002,
  curb: createCurb,
  yard: createYard,
};

export function createKiosk(def: KioskDef, m: Materials): Object3D {
  const factory = kioskFactories[def.assetId];
  if (!factory) throw new Error(`No kiosk factory registered for asset id "${def.assetId}"`);
  return factory(def, m);
}

/** True when the asset has a dedicated factory (otherwise the generic placeholder box is used). */
export function hasFurnitureFactory(assetId: string): boolean {
  return assetId in furnitureFactories;
}

export function createFurniture(asset: AssetDef, m: Materials): Object3D {
  const factory = furnitureFactories[asset.assetId];
  if (!factory) {
    log.warn(`No furniture factory for asset id "${asset.assetId}"; using a placeholder block`);
    return createFurniturePlaceholder(asset, m);
  }
  return factory(asset, m);
}

export function createGround(def: GroundAreaDef, m: Materials): Object3D {
  const byId = def.assetId ? groundFactories[def.assetId] : undefined;
  if (byId) return byId(def, m);
  if (def.assetId) log.warn(`No ground factory for asset id "${def.assetId}" (${def.id}); using kind "${def.kind}"`);
  const byKind = groundByKind[def.kind] as ((d: GroundAreaDef, mm: Materials) => Object3D) | undefined;
  return byKind ? byKind(def, m) : createGroundPlaceholder(def, m);
}
