import { SAVE_LIMITS } from './balance';
import type { DomainContext } from './domain';
import { clampRelationship, relationshipTier } from './relationship';
import type { Effect } from './npcTypes';
import type { DeepReadonly } from './state';

/**
 * Story effects: relationship, flags, memories, quest progress. The only code that changes `npcs[*].relationship`,
 * `npcs[*].memories` and `story` (besides the customer flow, which uses `addMemory`). Customer effects are NOT handled
 * here (see dialogue.ts). Every function is silent about invalid ids: it ignores them (content validation reports them).
 */

export function addMemory(ctx: DomainContext, npcId: string, memoryId: string): boolean {
  const npc = Object.hasOwn(ctx.state().npcs, npcId) ? ctx.state().npcs[npcId] : undefined;
  if (!npc || npc.memories.includes(memoryId) || npc.memories.length >= SAVE_LIMITS.memoriesPerNpc) return false;
  npc.memories.push(memoryId);
  ctx.emit('memory.added', { npcId, memoryId });
  return true;
}

/** Changes the relationship (clamped 0..100); emits only when the value changed. */
export function changeRelationship(ctx: DomainContext, npcId: string, delta: number): boolean {
  const npc = Object.hasOwn(ctx.state().npcs, npcId) ? ctx.state().npcs[npcId] : undefined;
  if (!npc || !Number.isFinite(delta)) return false;
  const next = clampRelationship(npc.relationship + delta);
  if (next === npc.relationship) return false;
  npc.relationship = next;
  ctx.emit('relationship.changed', { npcId, value: next, tier: relationshipTier(next) });
  return true;
}

function setFlag(ctx: DomainContext, id: string, value: boolean): void {
  const flags = ctx.state().story.flags;
  const current = Object.hasOwn(flags, id) ? flags[id] === true : false;
  if (current === value) return;
  if (!Object.hasOwn(flags, id) && Object.keys(flags).length >= SAVE_LIMITS.flags) return;
  flags[id] = value;
  ctx.emit('story.changed', { flag: id });
}

function questOf(ctx: DomainContext, questId: string): { steps: string[]; outcomes: string[] } | null {
  const quest = Object.hasOwn(ctx.content.quests, questId) ? ctx.content.quests[questId] : undefined;
  if (!quest) return null;
  return { steps: quest.steps.map((s) => s.id), outcomes: quest.outcomes.map((o) => o.id) };
}

/** Moves a quest forward to `step` (later in the step list than the current one); ignored otherwise or after an outcome. */
export function advanceQuestStep(ctx: DomainContext, questId: string, step: string): boolean {
  const quest = questOf(ctx, questId);
  if (!quest) return false;
  const target = quest.steps.indexOf(step);
  if (target < 0) return false;
  const quests = ctx.state().story.quests;
  const progress = Object.hasOwn(quests, questId) ? quests[questId] : undefined;
  if (progress?.outcome) return false;
  const current = progress?.step ? quest.steps.indexOf(progress.step) : -1;
  if (target <= current) return false;
  quests[questId] = { step, outcome: progress?.outcome ?? null };
  ctx.emit('story.changed', { questId });
  return true;
}

/** Sets the final outcome; ignored when the quest already has one. */
export function setQuestOutcome(ctx: DomainContext, questId: string, outcome: string): boolean {
  const quest = questOf(ctx, questId);
  if (!quest || !quest.outcomes.includes(outcome)) return false;
  const quests = ctx.state().story.quests;
  const progress = Object.hasOwn(quests, questId) ? quests[questId] : undefined;
  if (progress?.outcome) return false;
  quests[questId] = { step: progress?.step ?? null, outcome };
  ctx.emit('story.changed', { questId });
  return true;
}

/** True for the effects that act on the open wish (handled by the dialogue engine). */
export function isCustomerEffect(effect: DeepReadonly<Effect>): boolean {
  return effect.type === 'sellWish' || effect.type === 'declineWish' || effect.type === 'checkId';
}

/** Applies one story effect (customer effects are skipped). Relationship effects with a key happen at most once ever. */
export function applyStoryEffect(ctx: DomainContext, effect: DeepReadonly<Effect>): void {
  switch (effect.type) {
    case 'relationship': {
      const keys = ctx.state().story.effectKeys;
      if (keys.includes(effect.key) || keys.length >= SAVE_LIMITS.effectKeys) return;
      keys.push(effect.key);
      changeRelationship(ctx, effect.npcId, effect.delta);
      return;
    }
    case 'setFlag':
      setFlag(ctx, effect.id, effect.value);
      return;
    case 'remember':
      addMemory(ctx, effect.npcId, effect.memoryId);
      return;
    case 'questStep':
      advanceQuestStep(ctx, effect.questId, effect.step);
      return;
    case 'questOutcome':
      setQuestOutcome(ctx, effect.questId, effect.outcome);
      return;
    case 'sellWish':
    case 'declineWish':
    case 'checkId':
      return;
  }
}
