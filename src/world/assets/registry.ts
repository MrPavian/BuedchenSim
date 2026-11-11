import type { Object3D } from 'three';
import { log } from '../../core/log';
import type { FurnitureDef, GroundAreaDef, KioskDef } from '../../game/types';
import type { Materials } from '../materials';
import { createCounterI001, createFurniturePlaceholder, createWallShelfI003 } from './furniture';
import {
  createCurb,
  createGroundPlaceholder,
  createSidewalkE001,
  createStreetE002,
  createYard,
} from './ground';
import { createKioskK001 } from './kioskK001';

/**
 * Asset factories by asset id. Every factory returns an Object3D whose pivot is the
 * ground centre of the asset's footprint; units are metres. Content refers to assets
 * only by id, so new regions add factories here (or in their own registry) as data.
 */
const kioskFactories: Record<string, (def: KioskDef, m: Materials) => Object3D> = {
  'K-001': createKioskK001,
};

const furnitureFactories: Record<string, (def: FurnitureDef, m: Materials) => Object3D> = {
  'I-001': createCounterI001,
  'I-003': createWallShelfI003,
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

export function createFurniture(def: FurnitureDef, m: Materials): Object3D {
  const factory = furnitureFactories[def.assetId];
  if (!factory) {
    log.warn(`No furniture factory for asset id "${def.assetId}" (${def.id}); using a placeholder block`);
    return createFurniturePlaceholder(def, m);
  }
  return factory(def, m);
}

export function createGround(def: GroundAreaDef, m: Materials): Object3D {
  const byId = def.assetId ? groundFactories[def.assetId] : undefined;
  if (byId) return byId(def, m);
  if (def.assetId) log.warn(`No ground factory for asset id "${def.assetId}" (${def.id}); using kind "${def.kind}"`);
  const byKind = groundByKind[def.kind] as ((d: GroundAreaDef, mm: Materials) => Object3D) | undefined;
  return byKind ? byKind(def, m) : createGroundPlaceholder(def, m);
}
