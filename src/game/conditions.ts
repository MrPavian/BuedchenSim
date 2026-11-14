import type { Environment } from './environment';
import type { Condition } from './npcTypes';
import { weekdayOf } from './selectors';
import type { DeepReadonly, GameState } from './state';

/**
 * What conditions may read. `env` is the derived environment (weather, temperature, season; see environment.ts);
 * without it, environment conditions never match.
 */
export type ConditionContext = DeepReadonly<Pick<GameState, 'npcs' | 'story' | 'calendar'>> & { readonly env?: Environment };

function has(record: object, key: string): boolean {
  return Object.hasOwn(record, key);
}

/**
 * Pure evaluation of a closed set of conditions; unknown ids never throw, they simply do not match
 * (an unknown resident has no relationship, an unknown quest is not started).
 */
export function evaluateCondition(cond: DeepReadonly<Condition>, ctx: ConditionContext): boolean {
  switch (cond.type) {
    case 'flag': {
      const set = has(ctx.story.flags, cond.id) && ctx.story.flags[cond.id] === true;
      return set === (cond.value ?? true);
    }
    case 'relationshipAtLeast':
      return has(ctx.npcs, cond.npcId) && (ctx.npcs[cond.npcId]?.relationship ?? 0) >= cond.value;
    case 'relationshipBelow':
      return has(ctx.npcs, cond.npcId) && (ctx.npcs[cond.npcId]?.relationship ?? 0) < cond.value;
    case 'questStep':
      return has(ctx.story.quests, cond.questId) && ctx.story.quests[cond.questId]?.step === cond.step;
    case 'questOutcome':
      return has(ctx.story.quests, cond.questId) && ctx.story.quests[cond.questId]?.outcome === cond.outcome;
    case 'questNotStarted': {
      if (!has(ctx.story.quests, cond.questId)) return true;
      const q = ctx.story.quests[cond.questId];
      return !q || (q.step === null && q.outcome === null);
    }
    case 'time':
      return ctx.calendar.minute >= cond.from && ctx.calendar.minute < cond.to;
    case 'weekday':
      return cond.days.includes(weekdayOf(ctx.calendar.day));
    case 'seen':
      return ctx.story.seenDialogues.includes(cond.dialogueId);
    case 'memory':
      return has(ctx.npcs, cond.npcId) && (ctx.npcs[cond.npcId]?.memories.includes(cond.memoryId) ?? false);
    case 'dayAtLeast':
      return ctx.calendar.day >= cond.day;
    case 'weather':
      return ctx.env !== undefined && cond.conditions.includes(ctx.env.weather.condition);
    case 'temperatureAtLeast':
      return ctx.env !== undefined && ctx.env.temperature >= cond.value;
    case 'temperatureBelow':
      return ctx.env !== undefined && ctx.env.temperature < cond.value;
    case 'season':
      return ctx.env !== undefined && cond.seasons.includes(ctx.env.season);
    case 'not':
      return !evaluateCondition(cond.condition, ctx);
    case 'any':
      return cond.conditions.some((c) => evaluateCondition(c, ctx));
  }
}

/** All conditions hold; absent or empty list = true. */
export function conditionsHold(conditions: readonly DeepReadonly<Condition>[] | undefined, ctx: ConditionContext): boolean {
  if (!conditions) return true;
  for (const c of conditions) if (!evaluateCondition(c, ctx)) return false;
  return true;
}
