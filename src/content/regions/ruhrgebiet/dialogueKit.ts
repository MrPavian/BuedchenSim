import type { Condition, DialogueOption, Effect } from '../../../game/types';

/** Small builders for dialogue data (pure data in, pure data out; no behaviour). */

export const rel = (npcId: string, delta: number, key: string): Effect => ({ type: 'relationship', npcId, delta, key });
export const mem = (npcId: string, memoryId: string): Effect => ({ type: 'remember', npcId, memoryId });
export const step = (questId: string, stepId: string): Effect => ({ type: 'questStep', questId, step: stepId });
export const outcome = (questId: string, outcomeId: string): Effect => ({ type: 'questOutcome', questId, outcome: outcomeId });
export const flag = (id: string, value = true): Effect => ({ type: 'setFlag', id, value });

export const when = {
  flag: (id: string, value = true): Condition => ({ type: 'flag', id, value }),
  time: (from: number, to: number): Condition => ({ type: 'time', from, to }),
  relAtLeast: (npcId: string, value: number): Condition => ({ type: 'relationshipAtLeast', npcId, value }),
  step: (questId: string, stepId: string): Condition => ({ type: 'questStep', questId, step: stepId }),
  outcome: (questId: string, outcomeId: string): Condition => ({ type: 'questOutcome', questId, outcome: outcomeId }),
  notStarted: (questId: string): Condition => ({ type: 'questNotStarted', questId }),
  seen: (dialogueId: string): Condition => ({ type: 'seen', dialogueId }),
  memory: (npcId: string, memoryId: string): Condition => ({ type: 'memory', npcId, memoryId }),
  not: (condition: Condition): Condition => ({ type: 'not', condition }),
};

export function opt(
  id: string,
  text: string,
  extra: { when?: Condition[]; effects?: Effect[]; next?: string } = {},
): DialogueOption {
  return { id, text, ...extra };
}

/** Option that ends the conversation without effects. */
export const bye = (text: string, id = 'bye'): DialogueOption => opt(id, text);

export const MORNING = when.time(360, 720);
export const AFTERNOON = when.time(720, 1020);
export const EVENING = when.time(1020, 1320);
