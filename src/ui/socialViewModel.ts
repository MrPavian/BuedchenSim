import type { DialogueView } from '../game/dialogue';
import { relationshipTier, type RelationshipTier } from '../game/relationship';
import { findNpcState } from '../game/npcSelectors';
import { findProduct, shelfQuantity } from '../game/selectors';
import type { DeepReadonly, GameState } from '../game/state';
import type { ContentPack } from '../game/types';
import { formatClock } from './format';
import { texts } from './texts';
import { ageLabel } from './viewModel';

/** Pure view models of the dialogue panel and the journal (DOM-free). */

type State = DeepReadonly<GameState>;

/** Maximum number of option keys (1..4). */
export const MAX_OPTION_KEYS = 4;

export function tierLabel(tier: RelationshipTier): string {
  return texts.relationship.tier[tier];
}

export function tierTitle(tier: RelationshipTier): string {
  return texts.relationship.tierTitle[tier];
}

// --- Dialogue panel ---------------------------------------------------------------------------------------------

export interface DialogueOptionModel {
  id: string;
  text: string;
  /** Keyboard shortcut 1..4, null beyond the fourth option. */
  key: number | null;
}

export interface CustomerLineModel {
  productId: string;
  name: string;
  quantity: number;
  unitCents: number;
  lineCents: number;
  /** Units currently on the shelves. */
  onShelf: number;
  /** Not enough on the shelves for this line. */
  short: boolean;
}

export interface CustomerModel {
  stage: 'offer' | 'sold' | 'declined';
  lines: CustomerLineModel[];
  totalCents: number;
  /** "ab 16" or null. */
  ageLabel: string | null;
  minimumAge: number | null;
  /** "Ausweis: 17 Jahre" after checking the ID, else null. */
  revealedAgeText: string | null;
  /** The shown age is below the minimum age (the sale will be refused). */
  underage: boolean;
  stockWarning: boolean;
  failureReason: string | null;
}

export interface DialogueModel {
  npcId: string;
  name: string;
  role: string;
  tier: RelationshipTier;
  tierLabel: string;
  tierTitle: string;
  text: string;
  options: DialogueOptionModel[];
  customer: CustomerModel | null;
}

export function buildDialogueModel(content: ContentPack, state: State, view: DialogueView): DialogueModel {
  const def = Object.hasOwn(content.npcs, view.npcId) ? content.npcs[view.npcId] : undefined;
  const tier = relationshipTier(findNpcState(state, view.npcId)?.relationship ?? 0);
  let customer: CustomerModel | null = null;
  if (view.customer) {
    const c = view.customer;
    const lines: CustomerLineModel[] = [];
    for (const line of c.lines) {
      const product = findProduct(content, line.productId);
      if (!product) continue;
      const onShelf = shelfQuantity(state, line.productId);
      lines.push({
        productId: line.productId,
        name: product.name,
        quantity: line.quantity,
        unitCents: product.suggestedPriceCents,
        lineCents: line.quantity * product.suggestedPriceCents,
        onShelf,
        short: onShelf < line.quantity,
      });
    }
    customer = {
      stage: c.stage,
      lines,
      totalCents: c.totalCents,
      ageLabel: ageLabel(c.minimumAge ?? undefined),
      minimumAge: c.minimumAge,
      revealedAgeText: c.revealedAge === null ? null : texts.dialogue.customer.idShown(c.revealedAge),
      underage: c.revealedAge !== null && c.minimumAge !== null && c.revealedAge < c.minimumAge,
      stockWarning: c.stage === 'offer' && lines.some((l) => l.short),
      failureReason: c.failureReason,
    };
  }
  return {
    npcId: view.npcId,
    name: def?.name ?? view.npcId,
    role: def?.role ?? '',
    tier,
    tierLabel: tierLabel(tier),
    tierTitle: tierTitle(tier),
    text: view.text,
    options: view.options.map((o, i) => ({ id: o.id, text: o.text, key: i < MAX_OPTION_KEYS ? i + 1 : null })),
    customer,
  };
}

/** Option id for a pressed key ("1".."4"), or null. */
export function optionForKey(model: Pick<DialogueModel, 'options'>, key: string): string | null {
  if (!/^[1-4]$/.test(key)) return null;
  return model.options.find((o) => o.key === Number(key))?.id ?? null;
}

// --- Journal ----------------------------------------------------------------------------------------------------

export interface JournalPerson {
  npcId: string;
  name: string;
  role: string;
  bio: string;
  tier: RelationshipTier;
  tierLabel: string;
  tierTitle: string;
  lastTalk: string;
  /** Wishes fulfilled for this person (from the engine's `served:` memories); null when none. */
  servedText: string | null;
}

export interface JournalQuest {
  questId: string;
  title: string;
  /** Journal text of the current step (active) or of the outcome (finished). */
  text: string;
}

export interface JournalView {
  people: JournalPerson[];
  active: JournalQuest[];
  finished: JournalQuest[];
}

/**
 * What the player knows: people already talked to, stories that were started (current step only) and finished
 * stories (outcome only). Quests not started and future steps never appear; raw memory ids are never shown.
 */
export function buildJournalView(content: ContentPack, state: State): JournalView {
  const people: JournalPerson[] = [];
  for (const def of Object.values(content.npcs)) {
    const npc = findNpcState(state, def.id);
    if (!npc || npc.lastTalk === null) continue;
    const tier = relationshipTier(npc.relationship);
    const served = npc.memories.filter((m) => m.startsWith('served:')).length;
    people.push({
      npcId: def.id,
      name: def.name,
      role: def.role,
      bio: def.bio,
      tier,
      tierLabel: tierLabel(tier),
      tierTitle: tierTitle(tier),
      lastTalk: texts.journal.lastTalk(npc.lastTalk.day, formatClock(npc.lastTalk.minute)),
      servedText: served > 0 ? texts.journal.served(served) : null,
    });
  }
  const active: JournalQuest[] = [];
  const finished: JournalQuest[] = [];
  for (const quest of Object.values(content.quests)) {
    const progress = Object.hasOwn(state.story.quests, quest.id) ? state.story.quests[quest.id] : undefined;
    if (!progress) continue;
    if (progress.outcome !== null) {
      const outcome = quest.outcomes.find((o) => o.id === progress.outcome);
      if (outcome) finished.push({ questId: quest.id, title: quest.title, text: outcome.journal });
    } else if (progress.step !== null) {
      const step = quest.steps.find((s) => s.id === progress.step);
      if (step) active.push({ questId: quest.id, title: quest.title, text: step.journal });
    }
  }
  return { people, active, finished };
}

// --- Feedback ---------------------------------------------------------------------------------------------------

const TIER_ORDER: Record<RelationshipTier, number> = { stranger: 0, acquaintance: 1, trusted: 2, close: 3 };

/** Short notice when the tier changed, else null. Restrained: no numbers. */
export function tierChangeNotice(name: string, from: RelationshipTier, to: RelationshipTier): string | null {
  if (from === to) return null;
  if (TIER_ORDER[to] < TIER_ORDER[from]) return texts.notices.tierDown(name);
  if (to === 'stranger') return null;
  return texts.notices.tierUp[to](name);
}

/** Memories that are routine bookkeeping (a sale) and not worth a notice. */
export function isMemorableMemory(memoryId: string): boolean {
  // Engine memories (served wishes, event visits) are not announced as a notice.
  return !memoryId.startsWith('served:') && !memoryId.startsWith('erlebt:');
}
