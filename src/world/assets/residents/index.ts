import { log } from '../../../core/log';
import type { Materials } from '../../materials';
import { createDeryaN003 } from './derya';
import { createNeutralResident } from './fallback';
import { createGuenterN002 } from './guenter';
import { createJonasN006 } from './jonas';
import type { ResidentFactory, ResidentFigure } from './kit';
import { createMarleneN007 } from './marlene';

export type { ResidentAnimation, ResidentFigure, ResidentFactory } from './kit';

/**
 * Resident figure factories by asset id (the content pack's `NpcDef.assetId` selects one). Every factory
 * builds a figure with the pivot at the feet, facing +Z, about 1.6-1.85 m tall.
 */
const residentFactories: Record<string, ResidentFactory> = {
  'N-002': createGuenterN002,
  'N-003': createDeryaN003,
  'N-006': createJonasN006,
  'N-007': createMarleneN007,
};

const warned = new Set<string>();

export function hasResidentFactory(assetId: string): boolean {
  return Object.hasOwn(residentFactories, assetId);
}

export function residentAssetIds(): string[] {
  return Object.keys(residentFactories);
}

/** Unknown asset ids yield a neutral figure and one console warning; this never throws. */
export function createResident(assetId: string, m: Materials): ResidentFigure {
  const factory = Object.hasOwn(residentFactories, assetId) ? residentFactories[assetId] : undefined;
  if (factory) return factory(assetId, m);
  if (!warned.has(assetId)) {
    warned.add(assetId);
    log.warn(`No resident factory for asset id "${assetId}"; using the neutral figure`);
  }
  return createNeutralResident(assetId, m);
}
