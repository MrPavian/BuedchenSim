import { describe, expect, it } from 'vitest';
import { newGame, giveWish, mutable, openShutter, setFlag, setTime, stockShelves, summon } from '../game/testing/harness';
import { testPack } from '../game/testing/fixture-pack';
import {
  buildDialogueModel,
  buildJournalView,
  isMemorableMemory,
  optionForKey,
  tierChangeNotice,
  tierLabel,
} from './socialViewModel';
import { texts } from './texts';

const STAMM = 'npc.stammkunde';
const KURIER = 'npc.kurier';

function customerGame(npcId: string, wishId: string) {
  const game = newGame();
  setTime(game, 600);
  openShutter(game);
  summon(game, npcId, 'waiting');
  giveWish(game, npcId, wishId);
  expect(game.npcs.talk(npcId).ok).toBe(true);
  return game;
}

describe('dialogue model', () => {
  it('maps a story dialogue: name, role, tier hint, numbered options', () => {
    const game = newGame();
    setTime(game, 1100);
    summon(game, STAMM);
    game.npcs.talk(STAMM);
    const view = game.dialogue.current();
    expect(view).not.toBeNull();
    const model = buildDialogueModel(testPack, game.state, view!);
    expect(model.name).toBe('Test regular');
    expect(model.role).toBe('Regular customer');
    expect(model.tier).toBe('acquaintance');
    expect(model.tierLabel).toBe(texts.relationship.tier.acquaintance);
    expect(model.customer).toBeNull();
    expect(model.options.length).toBeGreaterThanOrEqual(2);
    expect(model.options.map((o) => o.key)).toEqual(model.options.map((_, i) => i + 1));
    expect(optionForKey(model, '1')).toBe(model.options[0]?.id);
    expect(optionForKey(model, '9')).toBeNull();
    expect(optionForKey(model, 'a')).toBeNull();
    expect(optionForKey(model, '5')).toBeNull();
  });

  it('customer: lines, totals, shelf availability and the stock warning', () => {
    const game = customerGame(STAMM, 'wish.water');
    mutable(game).economy.shelves['slot.shelf-north-1'] = { productId: 'product.test-water', quantity: 1 };
    const model = buildDialogueModel(testPack, game.state, game.dialogue.current()!);
    const c = model.customer!;
    expect(c.stage).toBe('offer');
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]).toMatchObject({ productId: 'product.test-water', quantity: 2, onShelf: 1, short: true });
    expect(c.lines[0]!.lineCents).toBe(2 * c.lines[0]!.unitCents);
    expect(c.totalCents).toBe(c.lines[0]!.lineCents);
    expect(c.stockWarning).toBe(true);
    expect(c.ageLabel).toBeNull();
    expect(model.options.map((o) => o.id)).toContain('sell');

    stockShelves(game);
    const ok = buildDialogueModel(testPack, game.state, game.dialogue.current()!).customer!;
    expect(ok.stockWarning).toBe(false);
  });

  it('customer: age requirement, revealed age after checkId, refusal of the 17-year-old', () => {
    const game = newGame();
    setTime(game, 600);
    openShutter(game);
    stockShelves(game);
    setFlag(game, 'test.kurier-tobacco');
    summon(game, KURIER, 'waiting');
    giveWish(game, KURIER, 'wish.kurier-tobacco');
    game.npcs.talk(KURIER);
    let model = buildDialogueModel(testPack, game.state, game.dialogue.current()!);
    expect(model.customer!.ageLabel).toMatch(/^ab \d+$/);
    expect(model.customer!.revealedAgeText).toBeNull();
    expect(model.options.map((o) => o.id)).toContain('checkId');

    expect(game.dialogue.choose('checkId').ok).toBe(true);
    model = buildDialogueModel(testPack, game.state, game.dialogue.current()!);
    expect(model.customer!.revealedAgeText).toBe('Ausweis: 17 Jahre');
    expect(model.customer!.underage).toBe(true);
    expect(model.options.map((o) => o.id)).not.toContain('checkId');

    const sold = game.dialogue.choose('sell');
    expect(sold.ok).toBe(false);
    model = buildDialogueModel(testPack, game.state, game.dialogue.current()!);
    expect(model.customer!.failureReason).toBe('customer_underage');
  });
});

describe('journal model', () => {
  it('is empty before anything happened and lists no unknown quests', () => {
    const game = newGame();
    const view = buildJournalView(testPack, game.state);
    expect(view).toEqual({ people: [], active: [], finished: [] });
  });

  it('shows met people with tier, but neither raw memory ids nor strangers never talked to', () => {
    const game = newGame();
    setTime(game, 1100);
    summon(game, STAMM);
    game.npcs.talk(STAMM);
    mutable(game).npcs[STAMM]!.memories.push('served:wish.water', 'served:wish.x', 'secret-memory-id');
    const view = buildJournalView(testPack, game.state);
    expect(view.people.map((p) => p.npcId)).toEqual([STAMM]);
    const p = view.people[0]!;
    expect(p).toMatchObject({ name: 'Test regular', tierLabel: tierLabel('acquaintance') });
    expect(p.servedText).toBe(texts.journal.served(2));
    expect(JSON.stringify(view)).not.toContain('secret-memory-id');
    expect(p.lastTalk).toContain('Zuletzt gesprochen');
  });

  it('active story: only the current step; finished story: only the outcome; no future steps', () => {
    const game = newGame();
    mutable(game).story.quests['quest.dispute'] = { step: 'step.heard', outcome: null };
    let view = buildJournalView(testPack, game.state);
    expect(view.active).toEqual([{ questId: 'quest.dispute', title: 'Test dispute', text: 'Heard about the dispute.' }]);
    expect(view.finished).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('Took a side');

    mutable(game).story.quests['quest.dispute'] = { step: 'step.decided', outcome: 'outcome.mediated' };
    view = buildJournalView(testPack, game.state);
    expect(view.active).toEqual([]);
    expect(view.finished).toEqual([{ questId: 'quest.dispute', title: 'Test dispute', text: 'Mediated.' }]);
  });

  it('ignores progress of quests unknown to the content', () => {
    const game = newGame();
    mutable(game).story.quests['quest.gone'] = { step: 'x', outcome: null };
    expect(buildJournalView(testPack, game.state).active).toEqual([]);
  });
});

describe('relationship feedback', () => {
  it('words tier changes restrainedly and stays silent otherwise', () => {
    expect(tierChangeNotice('Marlene', 'stranger', 'stranger')).toBeNull();
    expect(tierChangeNotice('Marlene', 'stranger', 'acquaintance')).toBe('Marlene kennt dich jetzt.');
    expect(tierChangeNotice('Marlene', 'acquaintance', 'trusted')).toContain('vertraut');
    expect(tierChangeNotice('Marlene', 'trusted', 'close')).toContain('Verbindung');
    expect(tierChangeNotice('Marlene', 'trusted', 'acquaintance')).toContain('distanzierter');
    expect(tierChangeNotice('Marlene', 'acquaintance', 'stranger')).toContain('distanzierter');
  });
  it('treats sale bookkeeping memories as not memorable', () => {
    expect(isMemorableMemory('served:wish.water')).toBe(false);
    expect(isMemorableMemory('declined:wish.water')).toBe(true);
    expect(isMemorableMemory('mediated')).toBe(true);
  });
});
