import { describe, expect, it } from 'vitest';
import { conditionsHold, evaluateCondition, type ConditionContext } from './conditions';
import type { Condition } from './npcTypes';
import { testPack } from './testing/fixture-pack';
import { createInitialState } from './state';

function ctx(patch: (state: ReturnType<typeof createInitialState>) => void = () => undefined): ConditionContext {
  const state = createInitialState(testPack);
  patch(state);
  return state;
}

const yes = (c: Condition, context: ConditionContext = ctx()): boolean => evaluateCondition(c, context);

describe('evaluateCondition', () => {
  it('flag: missing counts as false, value defaults to true', () => {
    expect(yes({ type: 'flag', id: 'f' })).toBe(false);
    expect(yes({ type: 'flag', id: 'f', value: false })).toBe(true);
    const set = ctx((s) => {
      s.story.flags['f'] = true;
      s.story.flags['g'] = false;
    });
    expect(yes({ type: 'flag', id: 'f' }, set)).toBe(true);
    expect(yes({ type: 'flag', id: 'f', value: false }, set)).toBe(false);
    expect(yes({ type: 'flag', id: 'g', value: false }, set)).toBe(true);
  });

  it('does not read inherited object properties', () => {
    expect(yes({ type: 'flag', id: 'toString' })).toBe(false);
    expect(yes({ type: 'relationshipAtLeast', npcId: 'constructor', value: 0 })).toBe(false);
    expect(yes({ type: 'questNotStarted', questId: 'constructor' })).toBe(true);
  });

  it('relationship thresholds (unknown residents match neither)', () => {
    expect(yes({ type: 'relationshipAtLeast', npcId: 'npc.stammkunde', value: 30 })).toBe(true);
    expect(yes({ type: 'relationshipAtLeast', npcId: 'npc.stammkunde', value: 31 })).toBe(false);
    expect(yes({ type: 'relationshipBelow', npcId: 'npc.stammkunde', value: 31 })).toBe(true);
    expect(yes({ type: 'relationshipBelow', npcId: 'npc.stammkunde', value: 30 })).toBe(false);
    expect(yes({ type: 'relationshipAtLeast', npcId: 'npc.nobody', value: 0 })).toBe(false);
    expect(yes({ type: 'relationshipBelow', npcId: 'npc.nobody', value: 100 })).toBe(false);
  });

  it('quest conditions', () => {
    expect(yes({ type: 'questNotStarted', questId: 'quest.dispute' })).toBe(true);
    const started = ctx((s) => {
      s.story.quests['quest.dispute'] = { step: 'step.heard', outcome: null };
    });
    expect(yes({ type: 'questNotStarted', questId: 'quest.dispute' }, started)).toBe(false);
    expect(yes({ type: 'questStep', questId: 'quest.dispute', step: 'step.heard' }, started)).toBe(true);
    expect(yes({ type: 'questStep', questId: 'quest.dispute', step: 'step.decided' }, started)).toBe(false);
    expect(yes({ type: 'questOutcome', questId: 'quest.dispute', outcome: 'outcome.mediated' }, started)).toBe(false);
    const done = ctx((s) => {
      s.story.quests['quest.dispute'] = { step: 'step.decided', outcome: 'outcome.mediated' };
    });
    expect(yes({ type: 'questOutcome', questId: 'quest.dispute', outcome: 'outcome.mediated' }, done)).toBe(true);
    expect(yes({ type: 'questNotStarted', questId: 'quest.dispute' }, done)).toBe(false);
  });

  it('time is inclusive from and exclusive to', () => {
    const at = (minute: number) => ctx((s) => void (s.calendar.minute = minute));
    const c: Condition = { type: 'time', from: 480, to: 600 };
    expect(yes(c, at(479.9))).toBe(false);
    expect(yes(c, at(480))).toBe(true);
    expect(yes(c, at(599.9))).toBe(true);
    expect(yes(c, at(600))).toBe(false);
  });

  it('weekday and dayAtLeast follow the calendar day (day 1 = Monday)', () => {
    const at = (day: number) => ctx((s) => void (s.calendar.day = day));
    expect(yes({ type: 'weekday', days: [0] }, at(1))).toBe(true);
    expect(yes({ type: 'weekday', days: [0] }, at(8))).toBe(true);
    expect(yes({ type: 'weekday', days: [5, 6] }, at(6))).toBe(true);
    expect(yes({ type: 'weekday', days: [5, 6] }, at(5))).toBe(false);
    expect(yes({ type: 'dayAtLeast', day: 3 }, at(2))).toBe(false);
    expect(yes({ type: 'dayAtLeast', day: 3 }, at(3))).toBe(true);
  });

  it('seen and memory', () => {
    const c = ctx((s) => {
      s.story.seenDialogues.push('dialogue.x');
      s.npcs['npc.kurier']?.memories.push('m1');
    });
    expect(yes({ type: 'seen', dialogueId: 'dialogue.x' }, c)).toBe(true);
    expect(yes({ type: 'seen', dialogueId: 'dialogue.y' }, c)).toBe(false);
    expect(yes({ type: 'memory', npcId: 'npc.kurier', memoryId: 'm1' }, c)).toBe(true);
    expect(yes({ type: 'memory', npcId: 'npc.stammkunde', memoryId: 'm1' }, c)).toBe(false);
    expect(yes({ type: 'memory', npcId: 'npc.nobody', memoryId: 'm1' }, c)).toBe(false);
  });

  it('not and any compose', () => {
    expect(yes({ type: 'not', condition: { type: 'flag', id: 'f' } })).toBe(true);
    expect(yes({ type: 'any', conditions: [] })).toBe(false);
    expect(yes({ type: 'any', conditions: [{ type: 'flag', id: 'f' }, { type: 'dayAtLeast', day: 1 }] })).toBe(true);
    expect(yes({ type: 'not', condition: { type: 'any', conditions: [{ type: 'dayAtLeast', day: 1 }] } })).toBe(false);
  });

  it('conditionsHold needs all; absent or empty holds', () => {
    expect(conditionsHold(undefined, ctx())).toBe(true);
    expect(conditionsHold([], ctx())).toBe(true);
    expect(conditionsHold([{ type: 'dayAtLeast', day: 1 }, { type: 'flag', id: 'f' }], ctx())).toBe(false);
  });
});
