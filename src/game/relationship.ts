import { RELATIONSHIP_MAX, RELATIONSHIP_MIN, RELATIONSHIP_TIER_THRESHOLDS } from './balance';

/** Relationship tiers (German UI names: fremd, bekannt, vertraut, eng verbunden). */
export type RelationshipTier = 'stranger' | 'acquaintance' | 'trusted' | 'close';

/** Pure selector: stranger < 20, acquaintance 20-49, trusted 50-79, close >= 80 (thresholds in balance.ts). */
export function relationshipTier(value: number): RelationshipTier {
  if (value >= RELATIONSHIP_TIER_THRESHOLDS.close) return 'close';
  if (value >= RELATIONSHIP_TIER_THRESHOLDS.trusted) return 'trusted';
  if (value >= RELATIONSHIP_TIER_THRESHOLDS.acquaintance) return 'acquaintance';
  return 'stranger';
}

/** Rounds to an integer and clamps to 0..100. */
export function clampRelationship(value: number): number {
  return Math.min(RELATIONSHIP_MAX, Math.max(RELATIONSHIP_MIN, Math.round(value)));
}
