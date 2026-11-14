import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import { NPC_RADIUS } from '../game/balance';
import { layoutColliders } from '../game/colliders';
import type { Game } from '../game/game';
import { createGame } from '../game/game';
import { mutable, openShutter, run, setTime, summon, giveWish } from '../game/testing/harness';
import type { NpcState } from '../game/state';

const G = 'npc.guenter';
const D = 'npc.derya';
const J = 'npc.jonas';
const M = 'npc.marlene';

function fresh(seed = 7): Game {
  const game = createGame(ruhrgebietPack, undefined, seed);
  game.player.setPose({ x: -9, z: -6 }, 0);
  return game;
}
const npc = (game: Game, id: string): NpcState => mutable(game).npcs[id] as NpcState;
const rel = (game: Game, id: string): number => npc(game, id).relationship;
const quest = (game: Game, id: string) => game.state.story.quests[id];
const flagOf = (game: Game, id: string): boolean => game.state.story.flags[id] === true;

/** Talks to a resident on `day` at 10:00, expects the dialogue and plays the options; the conversation always ends. */
function say(game: Game, npcId: string, expectedDialogue: string, options: string[], day: number, minute = 600): void {
  setTime(game, minute, day);
  summon(game, npcId);
  expect(game.npcs.talk(npcId)).toEqual({ ok: true });
  expect(game.dialogue.current()?.dialogueId).toBe(expectedDialogue);
  for (const id of options) {
    const view = game.dialogue.current();
    expect(view?.options.map((o) => o.id), `${expectedDialogue} offers ${id}`).toContain(id);
    expect(game.dialogue.choose(id).ok).toBe(true);
  }
  if (game.dialogue.current()) game.dialogue.close();
  expect(game.dialogue.current()).toBeNull();
}

/** Opens a conversation only to read which dialogue is picked, then closes it early (which does not consume it). */
function peek(game: Game, npcId: string, day: number, minute = 600): string | undefined {
  setTime(game, minute, day);
  summon(game, npcId);
  game.npcs.talk(npcId);
  const id = game.dialogue.current()?.dialogueId;
  game.dialogue.close();
  return id;
}

/** Story A up to the decision: both sides are heard (days 2 and 3). */
function hearBothSides(game: Game): void {
  say(game, M, 'dialogue.marlene.erstes-mal', ['aushang', 'bye'], 2);
  say(game, M, 'dialogue.marlene.hof-beschwerde', ['verstehen', 'bye'], 2);
  expect(quest(game, 'quest.hof')).toEqual({ step: 'beschwerde', outcome: null });
  say(game, D, 'dialogue.derya.erstes-mal', ['werkstatt', 'bye'], 3);
  say(game, D, 'dialogue.derya.hof-seite', ['zuhoeren', 'verstanden', 'bye'], 3);
  expect(quest(game, 'quest.hof')).toEqual({ step: 'gegenseite', outcome: null });
}

type HofOutcome = 'kompromiss' | 'derya' | 'marlene' | 'neutral';
const DECISION_OPTION: Record<HofOutcome, string> = { kompromiss: 'vermitteln', derya: 'derya', marlene: 'marlene', neutral: 'raushalten' };

/** Decides story A with Derya on day 3 (her second talk of that day, so the greeting bonus is already paid). */
function decideHof(game: Game, outcome: HofOutcome): { derya: number; marlene: number } {
  const before = { derya: rel(game, D), marlene: rel(game, M) };
  say(game, D, 'dialogue.derya.hof-entscheidung', [DECISION_OPTION[outcome], 'bye'], 3);
  return { derya: rel(game, D) - before.derya, marlene: rel(game, M) - before.marlene };
}

describe('story A: conflict in the back yard', () => {
  it('compromise: sawing after nine and a bench (flag yard.bench), both relationships rise', () => {
    const game = fresh();
    hearBothSides(game);
    expect(flagOf(game, 'yard.bench')).toBe(false);
    const delta = decideHof(game, 'kompromiss');
    expect(delta).toEqual({ derya: 5, marlene: 5 });
    expect(quest(game, 'quest.hof')).toEqual({ step: 'entscheidung', outcome: 'kompromiss' });
    expect(flagOf(game, 'yard.bench')).toBe(true);
    expect(npc(game, D).memories).toContain('derya:hof-kompromiss');
    expect(npc(game, M).memories).toContain('marlene:hof-kompromiss');
    // Later reactions remember the decision.
    say(game, M, 'dialogue.marlene.nachklang-kompromiss', ['ja', 'bye'], 4);
    say(game, D, 'dialogue.derya.nachklang-kompromiss', ['ja', 'bye'], 4);
    expect(peek(game, M, 5)).toBe('dialogue.marlene.bank');
    expect(peek(game, D, 5)).toBe('dialogue.derya.bank');
    expect(peek(game, J, 5)).toBe('dialogue.jonas.erstes-mal');
  });

  it('siding with Derya: Derya +6, Marlene -8, no bench, Marlene cool afterwards', () => {
    const game = fresh();
    hearBothSides(game);
    expect(decideHof(game, 'derya')).toEqual({ derya: 6, marlene: -8 });
    expect(quest(game, 'quest.hof')?.outcome).toBe('derya');
    expect(flagOf(game, 'yard.bench')).toBe(false);
    expect(npc(game, M).memories).toContain('marlene:hof-uebergangen');
    say(game, M, 'dialogue.marlene.nachklang-derya', ['ja', 'bye'], 4);
    say(game, D, 'dialogue.derya.nachklang-derya', ['ja', 'bye'], 4);
  });

  it('siding with Marlene: Marlene +6, Derya -8', () => {
    const game = fresh();
    hearBothSides(game);
    expect(decideHof(game, 'marlene')).toEqual({ derya: -8, marlene: 6 });
    expect(quest(game, 'quest.hof')?.outcome).toBe('marlene');
    expect(flagOf(game, 'yard.bench')).toBe(false);
    say(game, D, 'dialogue.derya.nachklang-marlene', ['ja', 'bye'], 4);
    say(game, M, 'dialogue.marlene.nachklang-marlene', ['ja', 'bye'], 4);
  });

  it('staying out: both are slightly disappointed and nothing changes in the yard', () => {
    const game = fresh();
    hearBothSides(game);
    expect(decideHof(game, 'neutral')).toEqual({ derya: -2, marlene: -2 });
    expect(quest(game, 'quest.hof')?.outcome).toBe('neutral');
    expect(flagOf(game, 'yard.bench')).toBe(false);
    say(game, D, 'dialogue.derya.nachklang-neutral', ['ja', 'bye'], 4);
    say(game, M, 'dialogue.marlene.nachklang-neutral', ['ja', 'bye'], 4);
  });

  it('can also be decided with Marlene, and the outcome is final', () => {
    const game = fresh();
    hearBothSides(game);
    say(game, M, 'dialogue.marlene.hof-entscheidung', ['vermitteln', 'bye'], 3);
    expect(quest(game, 'quest.hof')?.outcome).toBe('kompromiss');
    expect(flagOf(game, 'yard.bench')).toBe(true);
    // The decision dialogues are gone; no way to decide again.
    expect(peek(game, D, 4)).toBe('dialogue.derya.nachklang-kompromiss');
    expect(peek(game, D, 4)).not.toBe('dialogue.derya.hof-entscheidung');
  });

  it('mediation is only offered with trust in both (relationship >= 15)', () => {
    const game = fresh();
    hearBothSides(game);
    npc(game, D).relationship = 14;
    setTime(game, 600, 3);
    summon(game, D);
    game.npcs.talk(D);
    expect(game.dialogue.current()?.options.map((o) => o.id)).toEqual(['derya', 'marlene', 'raushalten']);
    game.dialogue.close();
  });

  it('routine consequence: with the compromise Derya starts sawing only at 09:00; after siding with Derya she keeps starting early', () => {
    const earliest = (outcome: HofOutcome): number => {
      let first = Infinity;
      for (let week = 0; week < 8; week += 1) {
        const game = fresh(3);
        mutable(game).story.quests['quest.hof'] = { step: 'entscheidung', outcome };
        setTime(game, 455, 8 + week * 7); // Monday, 07:35 (shopping window of the morning is over)
        game.tick(1 / 60);
        const d = npc(game, D);
        const at = d.status !== 'away' && d.routineId !== null ? d.routineId : null;
        if (at === 'd.saegen-frueh' || at === 'd.saegen-spaet') first = Math.min(first, 455);
        // And at 09:05 she is at work in both cases at least once over the weeks.
        const late = fresh(3);
        mutable(late).story.quests['quest.hof'] = { step: 'entscheidung', outcome };
        setTime(late, 545, 8 + week * 7);
        late.tick(1 / 60);
        if (npc(late, D).routineId !== null) first = Math.min(first, 545);
      }
      return first;
    };
    expect(earliest('derya')).toBe(455);
    expect(earliest('neutral')).toBe(455);
    expect(earliest('kompromiss')).toBe(545);
    expect(earliest('marlene')).toBe(545);
  });

  it('Marlene gives up the yard meeting after Derya won, and meets more often at the new bench', () => {
    const attends = (setup: (g: Game) => void): number => {
      let n = 0;
      for (let week = 0; week < 12; week += 1) {
        const game = fresh(5);
        setup(game);
        setTime(game, 1030, 4 + week * 7); // Thursday 17:10
        game.tick(1 / 60);
        const m = npc(game, M);
        if (m.status !== 'away' && m.placeId === 'place.yard-bench') n += 1;
      }
      return n;
    };
    const withDerya = attends((g) => (mutable(g).story.quests['quest.hof'] = { step: 'entscheidung', outcome: 'derya' }));
    const neutral = attends((g) => (mutable(g).story.quests['quest.hof'] = { step: 'entscheidung', outcome: 'neutral' }));
    const bench = attends((g) => {
      mutable(g).story.quests['quest.hof'] = { step: 'entscheidung', outcome: 'kompromiss' };
      mutable(g).story.flags['yard.bench'] = true;
    });
    expect(withDerya).toBe(0);
    expect(neutral).toBeGreaterThan(0);
    expect(bench).toBeGreaterThanOrEqual(neutral);
  });
});

/** Story B up to the photo; returns after Günter's photo scene. */
function playParcel(game: Game, startDay: number, photoDialogue: string, photoOptions: string[]): void {
  say(game, G, 'dialogue.guenter.erstes-mal', ['zusagen', 'bye'], startDay);
  say(game, G, 'dialogue.guenter.paket-bitte', ['anbieten', 'bye'], startDay);
  expect(quest(game, 'quest.paket')).toEqual({ step: 'angebot', outcome: null });
  expect(flagOf(game, 'parcel.at-kiosk')).toBe(false);
  say(game, J, 'dialogue.jonas.erstes-mal', ['rad', 'bye'], startDay);
  say(game, J, 'dialogue.jonas.paket', ['annehmen', 'bye'], startDay);
  expect(flagOf(game, 'parcel.at-kiosk')).toBe(true);
  expect(quest(game, 'quest.paket')?.step).toBe('paket');
  say(game, G, 'dialogue.guenter.paket-uebergabe', ['uebergeben', 'bye'], startDay + 1);
  expect(flagOf(game, 'parcel.at-kiosk')).toBe(false);
  expect(quest(game, 'quest.paket')?.step).toBe('uebergeben');
  expect(flagOf(game, 'kiosk.photo')).toBe(false);
  say(game, G, photoDialogue, photoOptions, startDay + 2);
  expect(flagOf(game, 'kiosk.photo')).toBe(true);
  expect(quest(game, 'quest.paket')?.outcome).toBe('foto');
}

describe('story B: a parcel for Günter', () => {
  it('runs through all steps to the photo without any cash reward', () => {
    const game = fresh();
    const cash = game.state.economy.cashCents;
    const before = rel(game, G);
    playParcel(game, 2, 'dialogue.guenter.foto-offen', ['zeigen', 'aufhaengen', 'bye']);
    expect(game.state.economy.cashCents).toBe(cash);
    expect(rel(game, G)).toBeGreaterThanOrEqual(before + 3 + 6 + 8 + 4 + 1);
    expect(npc(game, G).memories).toEqual(expect.arrayContaining(['guenter:paket-angeboten', 'guenter:paket-erhalten', 'guenter:foto-geschenkt']));
    expect(npc(game, J).memories).toContain('jonas:paket-abgegeben');
    expect(flagOf(game, 'photo.stand-idee')).toBe(false);
    expect(peek(game, G, 6)).toBe('dialogue.guenter.foto-danach');
  });

  it('the player can postpone and Günter asks again; a refusal ends the story with an outcome', () => {
    const game = fresh();
    say(game, G, 'dialogue.guenter.erstes-mal', ['fragen', 'mehr', 'bye'], 2);
    say(game, G, 'dialogue.guenter.paket-bitte', ['spaeter'], 2);
    expect(quest(game, 'quest.paket')).toEqual({ step: 'bitte', outcome: null });
    say(game, G, 'dialogue.guenter.paket-nochmal', ['anbieten', 'bye'], 3);
    expect(quest(game, 'quest.paket')?.step).toBe('angebot');

    const other = fresh();
    say(other, G, 'dialogue.guenter.erstes-mal', ['offen', 'bye'], 2);
    const r = rel(other, G);
    say(other, G, 'dialogue.guenter.paket-bitte', ['absagen', 'bye'], 2);
    expect(quest(other, 'quest.paket')?.outcome).toBe('abgelehnt');
    expect(rel(other, G)).toBe(r - 3);
    // Jonas has nothing to hand over, the story cannot continue, Günter reacts once.
    expect(peek(other, J, 3)).toBe('dialogue.jonas.erstes-mal');
    expect(peek(other, J, 3)).toBe('dialogue.jonas.erstes-mal'); // closing early does not consume it
    say(other, J, 'dialogue.jonas.erstes-mal', ['bye'], 3);
    expect(peek(other, J, 3)).toBe('dialogue.jonas.moin');
    say(other, G, 'dialogue.guenter.paket-abgelehnt', ['leid', 'bye'], 4);
    expect(flagOf(other, 'kiosk.photo')).toBe(false);
  });

  it('Günter asks for the parcel only from day 2 and only after the first meeting', () => {
    const game = fresh();
    say(game, G, 'dialogue.guenter.erstes-mal', ['zusagen', 'bye'], 1);
    expect(peek(game, G, 1, 800)).toBe('dialogue.guenter.moin');
    expect(peek(game, G, 2, 800)).toBe('dialogue.guenter.paket-bitte');
  });

  it('the parcel cannot be handed over before Jonas left it', () => {
    const game = fresh();
    say(game, G, 'dialogue.guenter.erstes-mal', ['zusagen', 'bye'], 2);
    say(game, G, 'dialogue.guenter.paket-bitte', ['anbieten', 'bye'], 2);
    expect(peek(game, G, 3)).not.toBe('dialogue.guenter.paket-uebergabe');
  });
});

describe('link A -> B: the yard decides how the photo story ends', () => {
  const photoDialogue: Record<HofOutcome, string> = {
    kompromiss: 'dialogue.guenter.foto-kompromiss',
    derya: 'dialogue.guenter.foto-derya',
    marlene: 'dialogue.guenter.foto-marlene',
    neutral: 'dialogue.guenter.foto-neutral',
  };

  it('compromise: Günter passes on the idea of a stand and Derya builds one (flag photo.stand)', () => {
    const game = fresh();
    hearBothSides(game);
    decideHof(game, 'kompromiss');
    say(game, M, 'dialogue.marlene.nachklang-kompromiss', ['bye'], 4);
    say(game, D, 'dialogue.derya.nachklang-kompromiss', ['bye'], 4);
    playParcel(game, 5, photoDialogue.kompromiss, ['zeigen', 'aufhaengen', 'weitersagen']);
    expect(flagOf(game, 'photo.stand-idee')).toBe(true);
    expect(flagOf(game, 'photo.stand')).toBe(false);
    const r = rel(game, D);
    say(game, D, 'dialogue.derya.foto-staender', ['bitte', 'bye'], 9);
    expect(flagOf(game, 'photo.stand')).toBe(true);
    expect(rel(game, D)).toBeGreaterThan(r);
    expect(npc(game, D).memories).toContain('derya:staender-gebaut');
    expect(peek(game, G, 10)).toBe('dialogue.guenter.foto-staender');
  });

  it('Derya\'s side: Marlene comments coolly on the photo, no stand', () => {
    const game = fresh();
    hearBothSides(game);
    decideHof(game, 'derya');
    say(game, M, 'dialogue.marlene.nachklang-derya', ['bye'], 4);
    say(game, D, 'dialogue.derya.nachklang-derya', ['bye'], 4);
    playParcel(game, 5, photoDialogue.derya, ['zeigen', 'aufhaengen', 'bye']);
    say(game, M, 'dialogue.marlene.foto-kuehl', ['ruhe'], 9);
    expect(npc(game, M).memories).toContain('marlene:foto-kuehl');
    expect(flagOf(game, 'photo.stand')).toBe(false);
    expect(flagOf(game, 'photo.stand-idee')).toBe(false);
    expect(peek(game, G, 10)).toBe('dialogue.guenter.foto-danach');
  });

  it('Marlene\'s side: Derya comments coolly on the photo', () => {
    const game = fresh();
    hearBothSides(game);
    decideHof(game, 'marlene');
    say(game, D, 'dialogue.derya.nachklang-marlene', ['bye'], 4);
    say(game, M, 'dialogue.marlene.nachklang-marlene', ['bye'], 4);
    playParcel(game, 5, photoDialogue.marlene, ['zeigen', 'aufhaengen', 'bye']);
    say(game, D, 'dialogue.derya.foto-kuehl', ['ok'], 9);
    expect(npc(game, D).memories).toContain('derya:foto-kuehl');
    expect(flagOf(game, 'photo.stand')).toBe(false);
  });

  it('staying neutral: Günter remarks on it', () => {
    const game = fresh();
    hearBothSides(game);
    decideHof(game, 'neutral');
    say(game, D, 'dialogue.derya.nachklang-neutral', ['bye'], 4);
    say(game, M, 'dialogue.marlene.nachklang-neutral', ['bye'], 4);
    playParcel(game, 5, photoDialogue.neutral, ['zeigen', 'aufhaengen', 'bye']);
    expect(flagOf(game, 'photo.stand')).toBe(false);
  });

  it('the stand idea is only reachable through the compromise (state difference between the outcomes)', () => {
    const flagsAfter = (outcome: HofOutcome): string[] => {
      const game = fresh();
      hearBothSides(game);
      decideHof(game, outcome);
      say(game, M, `dialogue.marlene.nachklang-${outcome}`, ['bye'], 4);
      say(game, D, `dialogue.derya.nachklang-${outcome}`, ['bye'], 4);
      const options = outcome === 'kompromiss' ? ['zeigen', 'aufhaengen', 'weitersagen'] : ['zeigen', 'aufhaengen', 'bye'];
      playParcel(game, 5, photoDialogue[outcome], options);
      return Object.keys(game.state.story.flags).filter((f) => game.state.story.flags[f]).sort();
    };
    expect(flagsAfter('kompromiss')).toEqual(['kiosk.photo', 'photo.stand-idee', 'yard.bench']);
    expect(flagsAfter('derya')).toEqual(['kiosk.photo']);
    expect(flagsAfter('marlene')).toEqual(['kiosk.photo']);
    expect(flagsAfter('neutral')).toEqual(['kiosk.photo']);
  });

  it('flag-gated placements exist only with their flag at runtime, and a save keeps the story', () => {
    const { layout, assets } = ruhrgebietPack;
    const without = layoutColliders(layout, assets, false, {});
    const withBench = layoutColliders(layout, assets, false, { 'yard.bench': true });
    expect(withBench.length).toBe(without.length + 1);
    const game = fresh();
    hearBothSides(game);
    decideHof(game, 'kompromiss');
    const copy = createGame(ruhrgebietPack, game.save().state, 7);
    expect(copy.state.story.quests['quest.hof']?.outcome).toBe('kompromiss');
    expect(copy.state.story.flags['yard.bench']).toBe(true);
    expect(copy.state.npcs[D]?.memories).toContain('derya:hof-kompromiss');
  });
});

describe('relationship cannot be farmed', () => {
  it('repeating the same options gains nothing beyond the daily greeting', () => {
    const game = fresh();
    say(game, G, 'dialogue.guenter.erstes-mal', ['fragen', 'mehr', 'bye'], 1, 800);
    const start = rel(game, G);
    // Same day: first conversation pays 'knie' once, every further one nothing.
    for (let i = 0; i < 10; i += 1) say(game, G, 'dialogue.guenter.moin', ['knie', 'bye'], 1, 800);
    expect(rel(game, G) - start).toBe(1); // 'knie' key (+1); the daily greeting was already paid in the first talk
    // Next day: only the greeting bonus (story B is parked at a step without a Günter dialogue).
    mutable(game).story.quests['quest.paket'] = { step: 'angebot', outcome: null };
    for (let i = 0; i < 10; i += 1) say(game, G, 'dialogue.guenter.moin', ['knie', 'bye'], 2, 800);
    expect(rel(game, G) - start).toBe(2);
    expect(game.state.story.effectKeys.filter((k) => k === 'k.guenter.knie')).toHaveLength(1);
  });

  it('sales give their bonus once per wish key, never again', () => {
    const game = fresh();
    stock(game);
    openShutter(game);
    setTime(game, 480, 2);
    const gains: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      summon(game, G);
      giveWish(game, G, 'wish.guenter-echo');
      game.npcs.talk(G);
      const r = rel(game, G);
      game.dialogue.choose('sell');
      gains.push(rel(game, G) - r);
      game.dialogue.close();
    }
    expect(gains).toEqual([2, 0, 0]);
  });
});

// --- Customers ---------------------------------------------------------------------------------------------------------------

function stock(game: Game): void {
  const shelves = mutable(game).economy.shelves;
  shelves['slot.counter.1'] = { productId: 'product.pottbaecker-broetchen', quantity: 6 };
  shelves['slot.counter.2'] = { productId: 'product.zechenhof-drehtabak-30', quantity: 5 };
  shelves['slot.counter.3'] = { productId: 'product.pottbaecker-streuselteilchen', quantity: 4 };
  shelves['slot.magazine-rack.1'] = { productId: 'product.halden-echo-lokalblatt', quantity: 5 };
  shelves['slot.wall-shelf-north.1'] = { productId: 'product.puettbraeu-pils', quantity: 10 };
  shelves['slot.wall-shelf-north.2'] = { productId: 'product.ruhrbrause-wasser-still', quantity: 10 };
  shelves['slot.wall-shelf-north.3'] = { productId: 'product.naschwerk-vollmilch', quantity: 10 };
  shelves['slot.fridge.1'] = { productId: 'product.zechenblitz-energy', quantity: 5 };
  shelves['slot.fridge.2'] = { productId: 'product.ruhrbrause-zitronenlimo', quantity: 5 };
  shelves['slot.freezer.1'] = { productId: 'product.eiskumpel-wassereis-brause', quantity: 5 };
}

const shelfUnits = (game: Game, productId: string): number =>
  Object.values(game.state.economy.shelves).filter((s) => s.productId === productId).reduce((n, s) => n + s.quantity, 0);

describe('residents as customers (real products)', () => {
  it('Günter arrives in the morning, asks for the Echo and two rolls and pays exactly once', () => {
    let game: Game | null = null;
    for (const seed of [7, 8, 9, 10, 11, 12]) {
      const g = fresh(seed);
      stock(g);
      openShutter(g);
      setTime(g, 420, 2); // Tuesday 07:00
      for (let i = 0; i < 120 * 60 && npc(g, G).status !== 'waiting'; i += 1) g.tick(1 / 60);
      if (npc(g, G).status === 'waiting') {
        game = g;
        break;
      }
    }
    if (!game) throw new Error('Günter never showed up');
    expect(npc(game, G).wish?.wishId).toBe('wish.guenter-echo');
    const cash = game.state.economy.cashCents;
    game.npcs.talk(G);
    const view = game.dialogue.current();
    expect(view?.dialogueId).toBe('dialogue.customer');
    expect(view?.text).toBe('Ein Echo und zwei Brötchen. Wenn die noch warm sind.');
    expect(view?.customer?.totalCents).toBe(180 + 2 * 45);
    const result = game.dialogue.choose('sell');
    expect(result.ok && result.transaction?.npcId).toBe(G);
    expect(game.state.economy.cashCents).toBe(cash + 270);
    expect(shelfUnits(game, 'product.halden-echo-lokalblatt')).toBe(4);
    expect(shelfUnits(game, 'product.pottbaecker-broetchen')).toBe(4);
    // A second press pays nothing.
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'wish_already_resolved' });
    game.dialogue.choose('close');
    expect(game.state.economy.cashCents).toBe(cash + 270);
    expect(shelfUnits(game, 'product.halden-echo-lokalblatt')).toBe(4);
    expect(npc(game, G).memories).toContain('served:wish.guenter-echo');
  });

  it('Günter\'s evening Pils needs the ID check and then sells to the 71-year-old', () => {
    const game = fresh();
    stock(game);
    openShutter(game);
    setTime(game, 1100, 3);
    summon(game, G);
    giveWish(game, G, 'wish.guenter-pils');
    game.npcs.talk(G);
    expect(game.dialogue.current()?.options.map((o) => o.id)).toEqual(['sell', 'checkId', 'decline']);
    const cash = game.state.economy.cashCents;
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'age_check_required' });
    expect(game.dialogue.current()?.text).toBe('Du willst erst den Ausweis sehen. Klar, frag ruhig.');
    game.dialogue.choose('checkId');
    expect(game.dialogue.current()?.text).toBe('Hier. 71 Jahre, steht alles drauf.');
    expect(game.dialogue.choose('sell').ok).toBe(true);
    expect(game.state.economy.cashCents).toBe(cash + 240);
    expect(shelfUnits(game, 'product.puettbraeu-pils')).toBe(8);
  });

  it('Derya and Marlene buy through the same economy domain', () => {
    const game = fresh();
    stock(game);
    openShutter(game);
    setTime(game, 480, 3);
    summon(game, D);
    giveWish(game, D, 'wish.derya-fruehstueck');
    game.npcs.talk(D);
    const cash = game.state.economy.cashCents;
    expect(game.dialogue.choose('sell').ok).toBe(true);
    expect(game.state.economy.cashCents).toBe(cash + 2 * 45 + 80);
    game.dialogue.close();
    setTime(game, 900, 3);
    summon(game, M);
    giveWish(game, M, 'wish.marlene-schoko');
    game.npcs.talk(M);
    expect(game.dialogue.choose('sell').ok).toBe(true);
    expect(game.state.economy.cashCents).toBe(cash + 2 * 45 + 80 + 119);
    expect(game.state.economy.transactions.map((t) => t.npcId)).toEqual([D, M]);
  });

  it('Jonas (17) can never buy tobacco, with or without an ID check; declining is remembered and answered later', () => {
    const game = fresh();
    stock(game);
    openShutter(game);
    setTime(game, 1000, 5);
    summon(game, J);
    giveWish(game, J, 'wish.jonas-tabak');
    game.npcs.talk(J);
    const view = game.dialogue.current();
    expect(view?.text).toBe('Einmal Drehtabak. Ist für meinen Onkel, der kann gerade nicht.');
    expect(view?.customer?.minimumAge).toBe(18);
    const cash = game.state.economy.cashCents;
    const units = shelfUnits(game, 'product.zechenhof-drehtabak-30');
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'age_check_required' });
    game.dialogue.choose('checkId');
    expect(game.dialogue.current()?.customer?.revealedAge).toBe(17);
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'customer_underage' });
    expect(game.dialogue.current()?.text).toBe('Okay, okay. War einen Versuch wert.');
    expect(game.state.economy.cashCents).toBe(cash);
    expect(shelfUnits(game, 'product.zechenhof-drehtabak-30')).toBe(units);
    expect(game.state.economy.transactions).toHaveLength(0);
    expect(game.dialogue.choose('decline').ok).toBe(true);
    game.dialogue.choose('close');
    expect(npc(game, J).memories).toContain('declined:wish.jonas-tabak');
    // Later: first meeting, then the reaction to the refusal.
    say(game, J, 'dialogue.jonas.erstes-mal', ['bye'], 6);
    const r = rel(game, J);
    say(game, J, 'dialogue.jonas.tabak-reaktion', ['regel', 'bye'], 6);
    expect(rel(game, J)).toBe(r + 2);
  });

  it('Jonas can buy his normal wishes', () => {
    const game = fresh();
    stock(game);
    openShutter(game);
    setTime(game, 1000, 3);
    summon(game, J);
    giveWish(game, J, 'wish.jonas-energy');
    game.npcs.talk(J);
    const cash = game.state.economy.cashCents;
    expect(game.dialogue.choose('sell').ok).toBe(true);
    expect(game.state.economy.cashCents).toBe(cash + 190);
  });

  it('a wish that cannot be met (no stock, closed shutter) is reported with the line of the reason', () => {
    const game = fresh();
    setTime(game, 1000, 3);
    summon(game, M);
    giveWish(game, M, 'wish.marlene-echo');
    game.npcs.talk(M);
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'kiosk_closed' });
    expect(game.dialogue.current()?.text).toBe('Die Klappe ist doch zu.');
    openShutter(game);
    expect(game.dialogue.choose('sell')).toEqual({ ok: false, reason: 'insufficient_stock' });
    expect(game.dialogue.current()?.text).toBe('So viel hast du davon nicht da? Dann lass lieber.');
  });
});

// --- Routines over a week --------------------------------------------------------------------------------------------------------

describe('routines over a simulated week with the real pack', () => {
  function simulateWeek(flags: Record<string, boolean>): { appeared: Set<string>; places: Set<string> } {
    const game = fresh(11);
    game.player.setPose({ x: -1.0, z: 0.95 }, 0);
    game.calendar.setSpeed(4);
    openShutter(game);
    Object.assign(mutable(game).story.flags, flags);
    const { layout, assets } = ruhrgebietPack;
    const colliders = layoutColliders(layout, assets, false, flags);
    const appeared = new Set<string>();
    const places = new Set<string>();
    const ids = Object.keys(ruhrgebietPack.npcs);
    for (let day = 1; day <= 7; day += 1) {
      while (game.state.calendar.phase === 'open') {
        game.tick(0.25); // one game minute per tick at speed 4
        const standing = new Set<string>();
        const visible = ids.filter((id) => npc(game, id).status !== 'away');
        for (const id of visible) {
          const n = npc(game, id);
          appeared.add(id);
          if (n.placeId) places.add(n.placeId);
          for (const c of colliders) {
            const inside =
              n.position.x > c.minX - (NPC_RADIUS - 0.02) && n.position.x < c.maxX + (NPC_RADIUS - 0.02) &&
              n.position.z > c.minZ - (NPC_RADIUS - 0.02) && n.position.z < c.maxZ + (NPC_RADIUS - 0.02);
            expect(inside, `${id} inside a collider at (${n.position.x.toFixed(2)}, ${n.position.z.toFixed(2)}) day ${day}`).toBe(false);
          }
          if (n.spotIndex !== null && n.status !== 'walking') {
            const key = `${n.placeId}#${n.spotIndex}`;
            expect(standing.has(key), `two residents on ${key}`).toBe(false);
            standing.add(key);
          }
        }
        for (let i = 0; i < visible.length; i += 1) {
          for (let j = i + 1; j < visible.length; j += 1) {
            const a = npc(game, visible[i] as string).position;
            const b = npc(game, visible[j] as string).position;
            expect(Math.hypot(a.x - b.x, a.z - b.z), `${visible[i]} and ${visible[j]} overlap`).toBeGreaterThan(0.3);
          }
        }
      }
      // 22:00: nobody is left once the walkers reached their exits.
      run(game, 120);
      for (const id of ids) expect(npc(game, id).status, `${id} still around after closing on day ${day}`).toBe('away');
      game.economy.closeDay();
      game.calendar.startNextDay();
    }
    return { appeared, places };
  }

  it('every resident shows up, nobody overlaps or stands in a collider, everyone is gone at 22:00', () => {
    const { appeared } = simulateWeek({});
    const residents = ['npc.derya', 'npc.guenter', 'npc.jonas', 'npc.marlene'];
    expect(residents.every((id) => appeared.has(id))).toBe(true);
    // Besides the residents only the event guests (the first home game is on Saturday of the first week).
    expect([...appeared].filter((id) => !residents.includes(id)).every((id) => id === 'npc.ole' || id === 'npc.hilde')).toBe(true);
  });

  it('with the bench built, residents use the bench place', () => {
    const { appeared, places } = simulateWeek({ 'yard.bench': true });
    expect(['npc.derya', 'npc.guenter', 'npc.jonas', 'npc.marlene'].every((id) => appeared.has(id))).toBe(true);
    expect(places.has('place.yard-bench')).toBe(true);
    expect(places.has('place.kiosk-window')).toBe(true);
    expect(places.has('place.corner')).toBe(true);
    expect(places.has('place.workshop')).toBe(true);
  });
});
