import { DAILY_GREETING_BONUS, SAVE_LIMITS } from './balance';
import { conditionsHold } from './conditions';
import type { DomainContext } from './domain';
import type { EconomyApi } from './economy';
import type { DialogueDef, Effect } from './npcTypes';
import type { NpcSim } from './npcSim';
import { findNpcState } from './npcSelectors';
import { cartMinimumAge, cartTotalCents } from './selectors';
import type { DeepReadonly, ProductLine, Transaction } from './state';
import { addMemory, applyStoryEffect, changeRelationship, isCustomerEffect } from './story';

/** Id used for the built-in customer conversation in `dialogue.opened` and `DialogueView.dialogueId`. */
export const CUSTOMER_DIALOGUE_ID = 'dialogue.customer';

export interface DialogueOptionView {
  id: string;
  text: string;
}

/** Extra data of the built-in customer conversation (UI may show the goods and the revealed age). */
export interface CustomerView {
  wishId: string;
  lines: ProductLine[];
  totalCents: number;
  /** Highest minimum age of the goods, or null when unrestricted. */
  minimumAge: number | null;
  ageChecked: boolean;
  /** The resident's age, only after `checkId`. */
  revealedAge: number | null;
  stage: 'offer' | 'sold' | 'declined';
  /** Rejection reason of the last failed sale attempt, shown until the next action; else null. */
  failureReason: string | null;
}

export interface DialogueView {
  npcId: string;
  /** Content dialogue id, or CUSTOMER_DIALOGUE_ID for the built-in customer conversation. */
  dialogueId: string;
  /** Content node id; for the customer conversation 'offer' | 'sold' | 'declined'. */
  nodeId: string;
  text: string;
  /** Only options whose conditions hold. */
  options: DialogueOptionView[];
  customer?: CustomerView;
}

export type TalkResult = { ok: true } | { ok: false; reason: string };
export type ChooseResult = { ok: true; ended: boolean; transaction?: Transaction } | { ok: false; reason: string };

export interface DialogueApi {
  /** The open conversation or null. */
  current(): DialogueView | null;
  /**
   * Applies the option's effects atomically and in order, then goes to `next` or ends.
   * Rejections: 'no_dialogue', 'unknown_option', 'option_unavailable'. Customer rejections (sale failed): the reason of
   * the sale ('insufficient_stock', 'customer_underage', 'age_check_required', 'kiosk_closed', ...), 'no_wish' and
   * 'wish_already_resolved'; a rejected option changes nothing except that the customer view shows the reason.
   */
  choose(optionId: string): ChooseResult;
  /** Ends the conversation. `{ ok: false, reason: 'no_dialogue' }` when none is open. */
  close(): { ok: true } | { ok: false; reason: string };
}

export interface DialogueEngine {
  api: DialogueApi;
  /** Opens a conversation with a resident (see `NpcApi.talk`). */
  open(npcId: string): TalkResult;
  /** Drops the session without touching resident state (after the state was replaced); emits `dialogue.closed`. */
  abort(): void;
  isOpen(): boolean;
}

type CustomerAction = 'sell' | 'checkId' | 'decline';
type Notice = { kind: 'none' } | { kind: 'idChecked' } | { kind: 'failed'; reason: string };

interface Session {
  npcId: string;
  /** null = built-in customer conversation. */
  dialogueId: string | null;
  nodeId: string;
  notice: Notice;
}

/** Option ids of the built-in customer conversation. */
export const CUSTOMER_OPTION = { sell: 'sell', checkId: 'checkId', decline: 'decline', close: 'close' } as const;

export function createDialogueEngine(ctx: DomainContext, economy: EconomyApi, sim: NpcSim): DialogueEngine {
  const { content } = ctx;
  let session: Session | null = null;

  const dialogueOf = (id: string | null): DialogueDef | undefined =>
    id !== null && Object.hasOwn(content.dialogues, id) ? content.dialogues[id] : undefined;

  const openWish = (npcId: string) => {
    const wish = findNpcState(ctx.state(), npcId)?.wish;
    return wish && wish.resolved === null ? wish : null;
  };

  /** Highest priority first; ties keep the order of `dialogueIds`. `once` dialogues that were seen are skipped. */
  const pickDialogue = (npcId: string): DialogueDef | null => {
    const def = Object.hasOwn(content.npcs, npcId) ? content.npcs[npcId] : undefined;
    if (!def) return null;
    const state = ctx.state();
    let best: DialogueDef | null = null;
    for (const id of def.dialogueIds) {
      const d = dialogueOf(id);
      if (!d || d.npcId !== npcId) continue;
      if (d.once && state.story.seenDialogues.includes(d.id)) continue;
      if (!conditionsHold(d.when, { ...state, env: ctx.env() })) continue;
      if (best === null || d.priority > best.priority) best = d;
    }
    return best;
  };

  // --- Customer flow ----------------------------------------------------------------------------------------------

  /** One action on the open wish of `npcId`; the sale and the resolution happen in this single call. */
  const customerAction = (npcId: string, action: CustomerAction): ChooseResult => {
    const npc = findNpcState(ctx.state(), npcId);
    const def = content.npcs[npcId];
    const wish = npc?.wish ?? null;
    if (!npc || !def || !wish) return { ok: false, reason: 'no_wish' };
    if (wish.resolved !== null) return { ok: false, reason: 'wish_already_resolved' };
    const wishDef = def.wishes?.find((w) => w.id === wish.wishId);

    if (action === 'checkId') {
      wish.ageChecked = true;
      return { ok: true, ended: false };
    }
    if (action === 'sell') {
      const result = economy.completeSale({
        lines: wish.lines,
        ageCheckConfirmed: wish.ageChecked,
        customer: { npcId },
      });
      if (!result.ok) return { ok: false, reason: result.reason };
      wish.resolved = 'sold';
      addMemory(ctx, npcId, `served:${wish.wishId}`);
      for (const effect of wishDef?.onSold ?? []) applyStoryEffect(ctx, effect);
      sim.leave(npcId);
      return { ok: true, ended: false, transaction: result.transaction };
    }
    wish.resolved = 'declined';
    addMemory(ctx, npcId, `declined:${wish.wishId}`);
    for (const effect of wishDef?.onDeclined ?? []) applyStoryEffect(ctx, effect);
    sim.leave(npcId);
    return { ok: true, ended: false };
  };

  const customerView = (s: Session): DialogueView => {
    const npc = findNpcState(ctx.state(), s.npcId);
    const def = content.npcs[s.npcId];
    const wish = npc?.wish ?? null;
    const lines = content.customerLines;
    const wishDef = def?.wishes?.find((w) => w.id === wish?.wishId);
    const stage = wish?.resolved === 'sold' ? 'sold' : wish?.resolved === 'declined' ? 'declined' : 'offer';
    const minimumAge = wish ? cartMinimumAge(content, wish.lines) : null;
    const ageChecked = wish?.ageChecked === true;
    const revealedAge = ageChecked && def ? def.age : null;
    let text: string;
    if (stage === 'sold') text = lines.sold;
    else if (stage === 'declined') text = lines.declined;
    else if (s.notice.kind === 'failed') {
      text = Object.hasOwn(lines.failed, s.notice.reason) ? (lines.failed[s.notice.reason] as string) : lines.failedFallback;
    } else if (s.notice.kind === 'idChecked' && revealedAge !== null) {
      text = lines.idChecked.replaceAll('{age}', String(revealedAge));
    } else text = wishDef?.text ?? '';

    const options: DialogueOptionView[] = [];
    if (stage === 'offer') {
      options.push({ id: CUSTOMER_OPTION.sell, text: lines.sell });
      if (minimumAge !== null && !ageChecked) options.push({ id: CUSTOMER_OPTION.checkId, text: lines.checkId });
      options.push({ id: CUSTOMER_OPTION.decline, text: lines.decline });
    } else {
      options.push({ id: CUSTOMER_OPTION.close, text: lines.close });
    }
    return {
      npcId: s.npcId,
      dialogueId: CUSTOMER_DIALOGUE_ID,
      nodeId: stage,
      text,
      options,
      customer: {
        wishId: wish?.wishId ?? '',
        lines: wish ? wish.lines.map((l) => ({ ...l })) : [],
        totalCents: wish ? cartTotalCents(content, wish.lines) : 0,
        minimumAge,
        ageChecked,
        revealedAge,
        stage,
        failureReason: s.notice.kind === 'failed' ? s.notice.reason : null,
      },
    };
  };

  const chooseCustomer = (s: Session, optionId: string): ChooseResult => {
    if (optionId === CUSTOMER_OPTION.close) {
      if (customerView(s).customer?.stage === 'offer') return { ok: false, reason: 'option_unavailable' };
      endSession();
      return { ok: true, ended: true };
    }
    if (optionId !== CUSTOMER_OPTION.sell && optionId !== CUSTOMER_OPTION.checkId && optionId !== CUSTOMER_OPTION.decline) {
      return { ok: false, reason: 'unknown_option' };
    }
    const view = customerView(s);
    if (view.customer?.stage !== 'offer') return { ok: false, reason: 'wish_already_resolved' };
    if (!view.options.some((o) => o.id === optionId)) return { ok: false, reason: 'option_unavailable' };
    const action: CustomerAction = optionId;
    const result = customerAction(s.npcId, action);
    if (!result.ok) {
      s.notice = { kind: 'failed', reason: result.reason };
      return result;
    }
    s.notice = action === 'checkId' ? { kind: 'idChecked' } : { kind: 'none' };
    return result;
  };

  // --- Story dialogues --------------------------------------------------------------------------------------------

  const storyView = (s: Session): DialogueView | null => {
    const d = dialogueOf(s.dialogueId);
    const node = d && Object.hasOwn(d.nodes, s.nodeId) ? d.nodes[s.nodeId] : undefined;
    if (!d || !node) return null;
    const state = ctx.state();
    const cond = { ...state, env: ctx.env() };
    return {
      npcId: s.npcId,
      dialogueId: d.id,
      nodeId: s.nodeId,
      text: node.text,
      options: node.options.filter((o) => conditionsHold(o.when, cond)).map((o) => ({ id: o.id, text: o.text })),
    };
  };

  const chooseStory = (s: Session, optionId: string): ChooseResult => {
    const d = dialogueOf(s.dialogueId);
    const node = d && Object.hasOwn(d.nodes, s.nodeId) ? d.nodes[s.nodeId] : undefined;
    const option = node?.options.find((o) => o.id === optionId);
    if (!d || !node || !option) return { ok: false, reason: 'unknown_option' };
    if (!conditionsHold(option.when, { ...ctx.state(), env: ctx.env() })) return { ok: false, reason: 'option_unavailable' };

    // Customer effects first: a failing sale aborts the option before any other effect is applied.
    const effects: readonly DeepReadonly<Effect>[] = option.effects ?? [];
    let transaction: Transaction | undefined;
    for (const effect of effects) {
      if (!isCustomerEffect(effect)) continue;
      const action: CustomerAction = effect.type === 'sellWish' ? 'sell' : effect.type === 'checkId' ? 'checkId' : 'decline';
      const result = customerAction(s.npcId, action);
      if (!result.ok) return result;
      if (result.transaction) transaction = result.transaction;
    }
    for (const effect of effects) if (!isCustomerEffect(effect)) applyStoryEffect(ctx, effect);

    if (option.next !== undefined && Object.hasOwn(d.nodes, option.next)) {
      s.nodeId = option.next;
      return transaction ? { ok: true, ended: false, transaction } : { ok: true, ended: false };
    }
    endSession(true);
    return transaction ? { ok: true, ended: true, transaction } : { ok: true, ended: true };
  };

  // --- Session ----------------------------------------------------------------------------------------------------

  /**
   * `completed`: the conversation reached a terminal option. Only then does it count as seen – a conversation closed
   * early (Escape) is offered again, so a once-dialogue that starts a story can never be lost by closing it.
   */
  function endSession(completed = false): void {
    const s = session;
    if (!s) return;
    session = null;
    const seen = ctx.state().story.seenDialogues;
    if (completed && s.dialogueId !== null && !seen.includes(s.dialogueId) && seen.length < SAVE_LIMITS.seenDialogues) {
      seen.push(s.dialogueId);
    }
    sim.endTalk(s.npcId);
    ctx.emit('dialogue.closed', { npcId: s.npcId });
  }

  const api: DialogueApi = {
    current() {
      if (!session) return null;
      return session.dialogueId === null ? customerView(session) : storyView(session);
    },
    choose(optionId) {
      if (!session) return { ok: false, reason: 'no_dialogue' };
      return session.dialogueId === null ? chooseCustomer(session, optionId) : chooseStory(session, optionId);
    },
    close() {
      if (!session) return { ok: false, reason: 'no_dialogue' };
      endSession();
      return { ok: true };
    },
  };

  return {
    api,
    isOpen: () => session !== null,
    open(npcId) {
      if (session) return { ok: false, reason: 'dialogue_already_open' };
      const state = ctx.state();
      const npc = findNpcState(state, npcId);
      if (!npc || !Object.hasOwn(content.npcs, npcId)) return { ok: false, reason: 'unknown_npc' };
      if (npc.status === 'away') return { ok: false, reason: 'npc_away' };

      const customer = npc.status === 'waiting' && openWish(npcId) !== null;
      const dialogue = customer ? null : pickDialogue(npcId);
      if (!customer && !dialogue) return { ok: false, reason: 'nothing_to_say' };

      // Greeting bonus: the only repeatable relationship gain, once per day.
      if (npc.greetedDay !== state.calendar.day) {
        npc.greetedDay = state.calendar.day;
        changeRelationship(ctx, npcId, DAILY_GREETING_BONUS);
      }
      npc.lastTalk = { day: state.calendar.day, minute: Math.floor(state.calendar.minute) };
      npc.heading = Math.atan2(state.player.position.x - npc.position.x, state.player.position.z - npc.position.z);
      npc.status = 'talking';
      ctx.emit('npc.status.changed', { npcId, status: 'talking' });
      session = {
        npcId,
        dialogueId: dialogue?.id ?? null,
        nodeId: dialogue?.start ?? 'offer',
        notice: { kind: 'none' },
      };
      ctx.emit('dialogue.opened', { npcId, dialogueId: dialogue?.id ?? CUSTOMER_DIALOGUE_ID });
      return { ok: true };
    },
    abort() {
      const s = session;
      if (!s) return;
      session = null;
      ctx.emit('dialogue.closed', { npcId: s.npcId });
    },
  };
}
