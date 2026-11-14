import { environmentOf } from './environment';
import { describe, expect, it, vi } from 'vitest';
import { RELATIONSHIP_TIER_THRESHOLDS } from './balance';
import type { DomainContext } from './domain';
import { createGame } from './game';
import { relationshipTier } from './relationship';
import { createInitialState } from './state';
import { advanceQuestStep, applyStoryEffect, changeRelationship, setQuestOutcome } from './story';
import { testPack } from './testing/fixture-pack';
import { mutable, newGame, setTime, summon } from './testing/harness';
import type { ContentPack, DialogueDef } from './types';

const STAMM = 'npc.stammkunde';
const KURIER = 'npc.kurier';
const NACH = 'npc.nachbarin';

function talkTo(id: string, minute = 540, day = 1) {
  const game = newGame();
  setTime(game, minute, day);
  summon(game, id);
  return game;
}

describe('opening a conversation', () => {
  it('rejects unknown and absent residents and a second open conversation', () => {
    const game = newGame();
    expect(game.npcs.talk('npc.nobody')).toEqual({ ok: false, reason: 'unknown_npc' });
    expect(game.npcs.talk(STAMM)).toEqual({ ok: false, reason: 'npc_away' });
    summon(game, STAMM);
    summon(game, KURIER);
    expect(game.npcs.talk(STAMM)).toEqual({ ok: true });
    expect(game.npcs.talk(KURIER)).toEqual({ ok: false, reason: 'dialogue_already_open' });
    expect(game.npcs.talk(STAMM)).toEqual({ ok: false, reason: 'dialogue_already_open' });
  });

  it('needs at least one candidate dialogue', () => {
    const pack: ContentPack = structuredClone(testPack);
    pack.dialogues = {};
    const game = newGame(7, pack);
    summon(game, STAMM);
    expect(game.npcs.talk(STAMM)).toEqual({ ok: false, reason: 'nothing_to_say' });
    expect(game.state.npcs[STAMM]?.status).toBe('at_place'); // nothing changed
    expect(game.state.npcs[STAMM]?.greetedDay).toBeNull();
  });

  it('picks the highest priority whose conditions hold; once-dialogues drop out after being seen', () => {
    const game = talkTo(STAMM);
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.dispute'); // priority 10 beats 1
    game.dialogue.close();
    // started quest -> the dispute dialogue's condition no longer holds
    mutable(game).story.quests['quest.dispute'] = { step: 'step.heard', outcome: null };
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.greeting');
    game.dialogue.close();
    // mediated outcome -> follow-up (priority 20, once)
    mutable(game).story.quests['quest.dispute'] = { step: 'step.decided', outcome: 'outcome.mediated' };
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.followup');
    game.dialogue.choose('thanks');
    expect(game.dialogue.current()).toBeNull();
    expect(game.state.story.seenDialogues).toContain('dialogue.stammkunde.followup');
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.greeting'); // the once-dialogue is gone
  });

  it('marks the resident as talking, faces the player and restores the status afterwards', () => {
    const game = talkTo(KURIER);
    const changes: string[] = [];
    game.signals.on('npc.status.changed', (p) => changes.push(`${p.npcId}:${p.status}`));
    const opened = vi.fn();
    const closed = vi.fn();
    game.signals.on('dialogue.opened', opened);
    game.signals.on('dialogue.closed', closed);
    game.npcs.talk(KURIER);
    const npc = game.state.npcs[KURIER];
    expect(npc?.status).toBe('talking');
    expect(npc?.heading).toBeCloseTo(Math.PI); // the player is to the north (-z)
    expect(opened).toHaveBeenCalledWith({ npcId: KURIER, dialogueId: 'dialogue.kurier.greeting' });
    expect(npc?.lastTalk).toEqual({ day: 1, minute: 540 });
    game.dialogue.close();
    expect(game.state.npcs[KURIER]?.status).toBe('at_place');
    expect(closed).toHaveBeenCalledWith({ npcId: KURIER });
    expect(changes).toEqual([`${KURIER}:talking`, `${KURIER}:at_place`]);
  });

  it('a talking resident stands still while the clock runs, then resumes walking', () => {
    const game = talkTo(NACH);
    const state = mutable(game);
    state.npcs[NACH]!.status = 'walking';
    state.npcs[NACH]!.route = ['wp.w3'];
    state.npcs[NACH]!.routineId = 'r.yard-visit';
    state.npcs[NACH]!.placeId = 'place.yard';
    game.npcs.talk(NACH);
    const before = { ...state.npcs[NACH]!.position };
    for (let i = 0; i < 120; i += 1) game.tick(1 / 60);
    expect(state.npcs[NACH]!.position).toEqual(before);
    game.dialogue.close();
    expect(state.npcs[NACH]!.status).toBe('walking');
  });
});

describe('dialogue content: options, conditions, effects', () => {
  it('shows only options whose conditions hold; hidden options are rejected', () => {
    const game = talkTo(STAMM, 540);
    mutable(game).story.quests['quest.dispute'] = { step: 'step.heard', outcome: null }; // greeting dialogue
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.options.map((o) => o.id)).toEqual(['chat', 'bye']);
    expect(game.dialogue.choose('evening')).toEqual({ ok: false, reason: 'option_unavailable' });
    expect(game.dialogue.choose('nothing')).toEqual({ ok: false, reason: 'unknown_option' });
    expect(game.dialogue.current()?.nodeId).toBe('a'); // rejected options change nothing
    game.dialogue.close();

    const evening = talkTo(STAMM, 1100);
    mutable(evening).story.quests['quest.dispute'] = { step: 'step.heard', outcome: null };
    evening.npcs.talk(STAMM);
    expect(evening.dialogue.current()?.options.map((o) => o.id)).toEqual(['chat', 'evening', 'bye']);
  });

  it('weekday conditions select options', () => {
    const saturday = talkTo(NACH, 700, 6);
    saturday.npcs.talk(NACH);
    expect(saturday.dialogue.current()?.options.map((o) => o.id)).toEqual(['weekend', 'bye']);
    const monday = talkTo(NACH, 700, 8);
    monday.npcs.talk(NACH);
    expect(monday.dialogue.current()?.options.map((o) => o.id)).toEqual(['bye']);
  });

  it('rejects everything without a conversation', () => {
    const game = newGame();
    expect(game.dialogue.current()).toBeNull();
    expect(game.dialogue.choose('x')).toEqual({ ok: false, reason: 'no_dialogue' });
    expect(game.dialogue.close()).toEqual({ ok: false, reason: 'no_dialogue' });
  });

  it('applies the effects of an option in order and moves on', () => {
    const game = talkTo(STAMM);
    const order: string[] = [];
    game.signals.on('story.changed', (p) => order.push(`story:${p.questId ?? p.flag}`));
    game.signals.on('memory.added', (p) => order.push(`memory:${p.memoryId}`));
    game.signals.on('relationship.changed', (p) => order.push(`rel:${p.value}:${p.tier}`));
    game.npcs.talk(STAMM); // +1 greeting: 31
    expect(game.dialogue.choose('listen')).toEqual({ ok: true, ended: false });
    expect(order).toEqual(['rel:31:acquaintance', 'story:quest.dispute', 'memory:told-dispute', 'rel:34:acquaintance']);
    expect(game.state.story.quests['quest.dispute']).toEqual({ step: 'step.heard', outcome: null });
    expect(game.state.npcs[STAMM]?.memories).toEqual(['told-dispute']);
    expect(game.dialogue.current()?.nodeId).toBe('b');

    expect(game.dialogue.choose('mediate')).toEqual({ ok: true, ended: true });
    expect(game.state.story.quests['quest.dispute']).toEqual({ step: 'step.decided', outcome: 'outcome.mediated' });
    expect(game.state.story.flags['test.mediated']).toBe(true);
    expect(game.state.npcs[STAMM]?.relationship).toBe(39);
    expect(game.dialogue.current()).toBeNull();
    expect(game.state.story.seenDialogues).toContain('dialogue.stammkunde.dispute');
  });

  it('option conditions on relationship hide the option; the alternative stays possible', () => {
    const game = talkTo(STAMM);
    mutable(game).npcs[STAMM]!.relationship = 5;
    game.npcs.talk(STAMM);
    game.dialogue.choose('listen');
    expect(game.dialogue.current()?.options.map((o) => o.id)).toEqual(['neutral']);
    expect(game.dialogue.choose('mediate')).toEqual({ ok: false, reason: 'option_unavailable' });
    game.dialogue.choose('neutral');
    expect(game.state.story.quests['quest.dispute']?.outcome).toBe('outcome.neutral');
  });

  it('seen is updated only when the conversation reaches its end, not when it is closed early', () => {
    const game = talkTo(STAMM);
    game.npcs.talk(STAMM);
    expect(game.state.story.seenDialogues).toEqual([]);
    game.dialogue.close(); // Escape: not seen, offered again
    expect(game.state.story.seenDialogues).toEqual([]);
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.dispute');
    game.dialogue.choose('listen');
    game.dialogue.choose('neutral'); // terminal option
    expect(game.state.story.seenDialogues).toEqual(['dialogue.stammkunde.dispute']);
  });

  it('closing a once-dialogue early does not consume it (regression: a story could never start)', () => {
    const game = talkTo(STAMM);
    mutable(game).story.quests['quest.dispute'] = { step: 'step.decided', outcome: 'outcome.mediated' };
    for (let i = 0; i < 3; i += 1) {
      game.npcs.talk(STAMM);
      expect(game.dialogue.current()?.dialogueId).toBe('dialogue.stammkunde.followup');
      game.dialogue.close();
    }
    game.npcs.talk(STAMM);
    game.dialogue.choose('thanks');
    expect(game.state.story.seenDialogues).toContain('dialogue.stammkunde.followup');
    game.npcs.talk(STAMM);
    expect(game.dialogue.current()?.dialogueId).not.toBe('dialogue.stammkunde.followup');
  });

  it('a dialogue whose next node does not exist ends instead of crashing', () => {
    const pack: ContentPack = structuredClone(testPack);
    const d = pack.dialogues['dialogue.kurier.greeting'] as DialogueDef;
    (d.nodes['a']!.options[0] as { next?: string }).next = 'missing';
    const game = newGame(7, pack);
    summon(game, KURIER);
    game.npcs.talk(KURIER);
    expect(game.dialogue.choose('bye')).toEqual({ ok: true, ended: true });
    expect(game.dialogue.current()).toBeNull();
  });
});

describe('relationship: keyed effects, daily greeting, clamp, tiers', () => {
  it('a keyed effect changes the value at most once ever (no farming)', () => {
    const game = talkTo(STAMM);
    mutable(game).story.quests['quest.dispute'] = { step: 'step.heard', outcome: null };
    game.npcs.talk(STAMM); // greeting +1 -> 31
    game.dialogue.choose('chat'); // +2 -> 33
    game.dialogue.close();
    expect(game.state.npcs[STAMM]?.relationship).toBe(33);
    for (let i = 0; i < 5; i += 1) {
      game.npcs.talk(STAMM);
      game.dialogue.choose('chat');
      game.dialogue.close();
    }
    expect(game.state.npcs[STAMM]?.relationship).toBe(33);
    expect(game.state.story.effectKeys).toEqual(['k.chat']);
  });

  it('the daily greeting gives +1 once per day and is the only repeatable gain', () => {
    const game = talkTo(KURIER);
    game.npcs.talk(KURIER);
    game.dialogue.close();
    game.npcs.talk(KURIER);
    game.dialogue.close();
    expect(game.state.npcs[KURIER]?.relationship).toBe(6);
    expect(game.state.npcs[KURIER]?.greetedDay).toBe(1);
    mutable(game).calendar.day = 2;
    game.npcs.talk(KURIER);
    game.dialogue.close();
    expect(game.state.npcs[KURIER]?.relationship).toBe(7);
  });

  it('clamps to 0..100 and signals only real changes', () => {
    const game = newGame();
    const changed = vi.fn();
    const emit: DomainContext['emit'] = (name, payload) => {
      if (name === 'relationship.changed') changed(payload);
    };
    const ctx: DomainContext = { state: () => mutable(game), content: testPack, emit, env: () => environmentOf(testPack, game.state) };
    mutable(game).npcs[KURIER]!.relationship = 99;
    expect(changeRelationship(ctx, KURIER, 50)).toBe(true);
    expect(game.state.npcs[KURIER]?.relationship).toBe(100);
    expect(changeRelationship(ctx, KURIER, 5)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ npcId: KURIER, value: 100, tier: 'close' });
    expect(changeRelationship(ctx, KURIER, -500)).toBe(true);
    expect(game.state.npcs[KURIER]?.relationship).toBe(0);
    expect(changeRelationship(ctx, KURIER, -1)).toBe(false);
    expect(changeRelationship(ctx, 'npc.nobody', 1)).toBe(false);
    expect(changeRelationship(ctx, KURIER, Number.NaN)).toBe(false);
  });

  it('has four tiers with the documented thresholds', () => {
    expect(RELATIONSHIP_TIER_THRESHOLDS).toEqual({ acquaintance: 20, trusted: 50, close: 80 });
    const cases: [number, string][] = [
      [0, 'stranger'], [19, 'stranger'], [20, 'acquaintance'], [49, 'acquaintance'],
      [50, 'trusted'], [79, 'trusted'], [80, 'close'], [100, 'close'],
    ];
    for (const [value, tier] of cases) expect(relationshipTier(value)).toBe(tier);
  });
});

describe('story: quests and memories', () => {
  function storyCtx() {
    const state = createInitialState(testPack);
    const emitted: [string, unknown][] = [];
    const ctx: DomainContext = { state: () => state, content: testPack, emit: (n, p) => void emitted.push([n, p]), env: () => environmentOf(testPack, state) };
    return { state, ctx, emitted };
  }

  it('quest steps only move forward', () => {
    const { state, ctx, emitted } = storyCtx();
    expect(advanceQuestStep(ctx, 'quest.dispute', 'step.decided')).toBe(true);
    expect(advanceQuestStep(ctx, 'quest.dispute', 'step.heard')).toBe(false); // backwards
    expect(advanceQuestStep(ctx, 'quest.dispute', 'step.decided')).toBe(false); // same step
    expect(state.story.quests['quest.dispute']).toEqual({ step: 'step.decided', outcome: null });
    expect(emitted).toEqual([['story.changed', { questId: 'quest.dispute' }]]);
  });

  it('an outcome is final: a second outcome and further steps are ignored', () => {
    const { state, ctx } = storyCtx();
    expect(advanceQuestStep(ctx, 'quest.dispute', 'step.heard')).toBe(true);
    expect(setQuestOutcome(ctx, 'quest.dispute', 'outcome.neutral')).toBe(true);
    expect(setQuestOutcome(ctx, 'quest.dispute', 'outcome.mediated')).toBe(false);
    expect(advanceQuestStep(ctx, 'quest.dispute', 'step.decided')).toBe(false);
    expect(state.story.quests['quest.dispute']).toEqual({ step: 'step.heard', outcome: 'outcome.neutral' });
  });

  it('ignores unknown quests, steps and outcomes', () => {
    const { state, ctx } = storyCtx();
    expect(advanceQuestStep(ctx, 'quest.nope', 'step.heard')).toBe(false);
    expect(advanceQuestStep(ctx, 'quest.dispute', 'step.nope')).toBe(false);
    expect(setQuestOutcome(ctx, 'quest.dispute', 'outcome.nope')).toBe(false);
    expect(setQuestOutcome(ctx, 'quest.nope', 'x')).toBe(false);
    expect(state.story.quests).toEqual({});
  });

  it('remember adds a memory once; setFlag signals changes only', () => {
    const { state, ctx, emitted } = storyCtx();
    applyStoryEffect(ctx, { type: 'remember', npcId: KURIER, memoryId: 'm' });
    applyStoryEffect(ctx, { type: 'remember', npcId: KURIER, memoryId: 'm' });
    applyStoryEffect(ctx, { type: 'remember', npcId: 'npc.nobody', memoryId: 'm' });
    expect(state.npcs[KURIER]?.memories).toEqual(['m']);
    applyStoryEffect(ctx, { type: 'setFlag', id: 'f', value: true });
    applyStoryEffect(ctx, { type: 'setFlag', id: 'f', value: true });
    applyStoryEffect(ctx, { type: 'setFlag', id: 'f', value: false });
    expect(state.story.flags['f']).toBe(false);
    expect(emitted.filter(([n]) => n === 'memory.added')).toHaveLength(1);
    expect(emitted.filter(([n]) => n === 'story.changed')).toHaveLength(2);
  });

  it('both story paths work end to end and are remembered later (alternative outcomes)', () => {
    const mediate = talkTo(STAMM);
    mediate.npcs.talk(STAMM);
    mediate.dialogue.choose('listen');
    mediate.dialogue.choose('mediate');
    expect(mediate.state.story.quests['quest.dispute']?.outcome).toBe('outcome.mediated');
    // The neighbour reacts to the memory of the mediation (once); the regular thanks
    summon(mediate, NACH);
    mediate.npcs.talk(NACH);
    expect(mediate.dialogue.current()?.dialogueId).toBe('dialogue.nachbarin.reaction');
    mediate.dialogue.close();

    const neutral = talkTo(STAMM);
    neutral.npcs.talk(STAMM);
    neutral.dialogue.choose('listen');
    neutral.dialogue.choose('neutral');
    expect(neutral.state.story.quests['quest.dispute']?.outcome).toBe('outcome.neutral');
    summon(neutral, NACH);
    neutral.npcs.talk(NACH);
    expect(neutral.dialogue.current()?.dialogueId).toBe('dialogue.nachbarin.greeting'); // no memory 'mediated'
  });
});

describe('interaction target', () => {
  function placed(game: ReturnType<typeof newGame>, id: string, x: number, z: number, status: 'at_place' | 'walking' = 'at_place') {
    const npc = mutable(game).npcs[id]!;
    npc.status = status;
    npc.position = { x, z };
  }

  it('a visible resident in range that the player faces becomes the target and wins over kiosk points', () => {
    const game = newGame();
    const target = vi.fn();
    const available = vi.fn();
    game.signals.on('interaction.target.changed', target);
    game.signals.on('interaction.available.changed', available);
    game.player.setPose({ x: -1.0, z: 0.9 }, 0); // behind the counter, looking south toward the window; shutter point in range
    expect(game.getInteractionTarget()).toEqual({ pointId: 'interaction.shutter', kind: 'shutter', action: 'shutter.open' });
    placed(game, KURIER, -1.0, 2.0);
    game.player.setPose({ x: -1.0, z: 0.9 }, 0); // refreshes the interaction
    expect(game.getInteractionTarget()).toEqual({ pointId: KURIER, kind: 'npc', action: 'npc.talk', npcId: KURIER });
    expect(game.getAvailableInteraction()).toBeNull(); // the kiosk prompt gives way
    expect(available).toHaveBeenLastCalledWith({ interaction: null });
    expect(target).toHaveBeenLastCalledWith({ target: { pointId: KURIER, kind: 'npc', action: 'npc.talk', npcId: KURIER } });
  });

  it('needs the player to roughly face the resident and respects the radius', () => {
    const game = newGame();
    placed(game, KURIER, -9, -5);
    game.player.setPose({ x: -9, z: -6 }, 0); // facing +z toward it, 1 m
    expect(game.getInteractionTarget()?.kind).toBe('npc');
    game.player.setPose({ x: -9, z: -6 }, Math.PI); // facing away
    expect(game.getInteractionTarget()).toBeNull();
    game.player.setPose({ x: -9, z: -6 }, (70 * Math.PI) / 180); // 70 degrees: still within 75
    expect(game.getInteractionTarget()?.kind).toBe('npc');
    game.player.setPose({ x: -9, z: -6 }, (80 * Math.PI) / 180);
    expect(game.getInteractionTarget()).toBeNull();
    game.player.setPose({ x: -9, z: -6.9 }, 0); // 1.9 m: out of range
    expect(game.getInteractionTarget()).toBeNull();
    game.player.setPose({ x: -9, z: -6.7 }, 0); // 1.7 m: in range (across the counter)
    expect(game.getInteractionTarget()?.kind).toBe('npc');
  });

  it('an absent resident is never a target; the nearest of several wins', () => {
    const game = newGame();
    game.player.setPose({ x: -9, z: -6 }, 0);
    expect(game.getInteractionTarget()).toBeNull();
    placed(game, KURIER, -9, -4.8);
    placed(game, NACH, -9, -5.3, 'walking');
    game.player.setPose({ x: -9, z: -6 }, 0);
    expect(game.getInteractionTarget()).toMatchObject({ npcId: NACH });
  });

  it('interact() opens the conversation; a second interact is rejected; kiosk behaviour is unchanged otherwise', () => {
    const game = newGame();
    placed(game, KURIER, -9, -5);
    game.player.setPose({ x: -9, z: -6 }, 0);
    expect(game.interact()).toEqual({ ok: true });
    expect(game.dialogue.current()?.npcId).toBe(KURIER);
    expect(game.interact()).toEqual({ ok: false, reason: 'dialogue_already_open' });
    game.dialogue.close();

    const door = newGame();
    door.player.setPose({ x: 2.0, z: 2.6 }, 0);
    expect(door.interact()).toEqual({ ok: true });
    expect(door.state.kiosk.doorOpen).toBe(true);
    expect(door.dialogue.current()).toBeNull();
  });
});

describe('load and reset', () => {
  it('drop an open conversation (and signal it) and restore a saved talking status sensibly', () => {
    const game = talkTo(KURIER);
    game.npcs.talk(KURIER);
    const closed = vi.fn();
    game.signals.on('dialogue.closed', closed);
    const snapshot = game.save().state; // saved while talking
    expect(snapshot.npcs[KURIER]?.status).toBe('talking');
    game.reset();
    expect(game.dialogue.current()).toBeNull();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(game.state.npcs[KURIER]?.status).toBe('away');
    expect(createGame(testPack, createInitialState(testPack, 5)).state.world.seed).toBe(5);
  });

  it('reset starts a new game with a fresh seed from the provider', () => {
    let next = 10;
    const game = createGame(testPack, undefined, () => next++);
    expect(game.state.world.seed).toBe(10);
    game.reset();
    expect(game.state.world.seed).toBe(11);
  });
});
