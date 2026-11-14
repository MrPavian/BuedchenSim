import { conditionsHold, type ConditionContext } from './conditions';
import type { NpcDef, WishDef } from './npcTypes';
import type { ContentPack } from './types';
import { roll } from './random';

/**
 * Deterministic wish choice: among the wishes whose conditions hold, a weighted roll from
 * (seed, day, npc, routine). The same inputs always give the same wish; reloading never changes it.
 */
export function pickWish(
  def: NpcDef,
  ctx: ConditionContext,
  seed: number,
  routineId: string,
  /** Optional weight factor per wish (Auftrag 05: demand); 1 when absent. */
  factor: (wish: WishDef) => number = () => 1,
): WishDef | null {
  const wishes = def.wishes;
  if (!wishes || wishes.length === 0) return null;
  const weight = (wish: WishDef): number => {
    const f = factor(wish);
    return weightOf(wish) * (Number.isFinite(f) && f > 0 ? f : 0);
  };
  let total = 0;
  for (const wish of wishes) if (conditionsHold(wish.when, ctx)) total += weight(wish);
  if (total <= 0) return null;
  let target = roll(seed, ctx.calendar.day, def.id, 'wish', routineId) * total;
  let last: WishDef | null = null;
  for (const wish of wishes) {
    if (!conditionsHold(wish.when, ctx)) continue;
    last = wish;
    target -= weight(wish);
    if (target < 0) return wish;
  }
  return last;
}

function weightOf(wish: WishDef): number {
  const w = wish.weight ?? 1;
  return Number.isFinite(w) && w > 0 ? w : 0;
}

/** What a wish costs at the suggested prices (for the resident's purse). Unknown products cost nothing. */
export function wishCostCents(content: Pick<ContentPack, 'products'>, wish: Pick<WishDef, 'lines'>): number {
  let sum = 0;
  for (const l of wish.lines) sum += (Object.hasOwn(content.products, l.productId) ? (content.products[l.productId]?.suggestedPriceCents ?? 0) : 0) * l.quantity;
  return sum;
}
