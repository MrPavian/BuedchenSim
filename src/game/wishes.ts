import { conditionsHold, type ConditionContext } from './conditions';
import type { NpcDef, WishDef } from './npcTypes';
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
): WishDef | null {
  const wishes = def.wishes;
  if (!wishes || wishes.length === 0) return null;
  let total = 0;
  for (const wish of wishes) if (conditionsHold(wish.when, ctx)) total += weightOf(wish);
  if (total <= 0) return null;
  let target = roll(seed, ctx.calendar.day, def.id, 'wish', routineId) * total;
  let last: WishDef | null = null;
  for (const wish of wishes) {
    if (!conditionsHold(wish.when, ctx)) continue;
    last = wish;
    target -= weightOf(wish);
    if (target < 0) return wish;
  }
  return last;
}

function weightOf(wish: WishDef): number {
  const w = wish.weight ?? 1;
  return Number.isFinite(w) && w > 0 ? w : 0;
}
