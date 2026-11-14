import type { Game } from '../game/game';
import { testId } from './dom';
import './styles.css';
import { createHud } from './hud';
import { createModalHost, type PanelContext, type PanelId } from './modal';
import { createConfirmClosePanel, createReportPanel } from './panels/dayClose';
import { createDialoguePanel } from './panels/dialogue';
import { createGoodsPanel } from './panels/goods';
import { createCalendarPanel } from './panels/calendar';
import { createJournalPanel } from './panels/journal';
import { createTillPanel } from './panels/till';
import { formatEuro } from './format';
import { isMemorableMemory, tierChangeNotice } from './socialViewModel';
import { texts } from './texts';

export interface UiCallbacks {
  /** Called after the player confirmed "Neues Spiel"; main clears the save and resets the game. */
  onNewGame(): void;
  /**
   * A modal panel opened (true) or closed (false). main.ts uses it to switch world input off/on so the
   * player neither walks nor triggers interactions while a panel is open.
   */
  onModalChange(open: boolean): void;
  /** The player changed the weather particle setting (a device setting; main applies it to the world and stores it). */
  onWeatherEffects(level: EffectsLevel): void;
  weatherEffects(): EffectsLevel;
}

/** Weather particles: full, a quarter, or none (lighting and wet ground stay). */
export type EffectsLevel = 'full' | 'reduced' | 'off';

export type { PanelId };

export interface Ui {
  notify(text: string): void;
  /** Opens a panel ('report' only when a day report exists). Mainly for the debug hook; normally the till and goods panels open only at their interaction points and the report via the HUD. */
  openPanel(id: PanelId): void;
  closePanel(): void;
  currentPanel(): PanelId | null;
  /** Per rendered frame: refreshes the HUD clock when the whole game minute changed. */
  frame(): void;
  showFatal(message: string, details?: unknown): void;
  dispose(): void;
}

export interface FatalErrorOptions {
  title?: string;
  message: string;
  details?: unknown;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function detailsText(details: unknown): string {
  if (details instanceof Error) return details.stack ?? `${details.name}: ${details.message}`;
  if (details === undefined || details === null) return '';
  return typeof details === 'string' ? details : JSON.stringify(details, null, 2);
}

/** Visible error panel; usable before a game exists (no dependency on Game). */
export function showFatalError(root: HTMLElement, options: FatalErrorOptions): void {
  root.querySelector('.ui-fatal')?.remove();
  const panel = element('div', 'ui-fatal');
  panel.setAttribute('role', 'alert');
  const card = element('div', 'ui-fatal-card');
  card.append(element('h1', undefined, options.title ?? texts.errors.title), element('p', undefined, options.message));
  const detail = detailsText(options.details);
  if (detail) {
    const wrapper = element('details');
    wrapper.append(element('summary', undefined, texts.errors.details), element('pre', undefined, detail));
    card.append(wrapper);
  }
  const reload = element('button', undefined, texts.errors.reload);
  reload.type = 'button';
  reload.addEventListener('click', () => window.location.reload());
  card.append(reload);
  panel.append(card);
  root.append(panel);
}

/** DOM overlay: controls hint, interaction prompt, notices, "Neues Spiel". No game rules here. */
export function createUi(game: Game, root: HTMLElement, callbacks: UiCallbacks): Ui {
  const overlay = element('div', 'ui');
  root.append(overlay);

  // Controls hint
  const controls = element('div', 'ui-controls');
  for (const entry of [texts.controls.move, texts.controls.interact]) {
    const row = element('div');
    row.append(element('span', 'keys', entry.keys), element('span', undefined, entry.label));
    controls.append(row);
  }
  overlay.append(controls);

  // Interaction prompt (button: click = interact)
  const prompt = element('button', 'ui-prompt');
  prompt.type = 'button';
  testId(prompt, 'prompt');
  prompt.hidden = true;
  const key = element('kbd', undefined, texts.interactionKey);
  const promptLabel = element('span');
  prompt.append(key, promptLabel);
  prompt.addEventListener('click', () => {
    game.interact();
    prompt.blur(); // keep E/Space from re-triggering the focused button
  });
  overlay.append(prompt);

  let modalOpen = false;
  const npcName = (npcId: string): string =>
    Object.hasOwn(game.content.npcs, npcId) ? (game.content.npcs[npcId]?.name ?? npcId) : npcId;
  const renderPrompt = (): void => {
    const target = game.getInteractionTarget();
    if (!target || modalOpen) {
      prompt.hidden = true;
      return;
    }
    promptLabel.textContent =
      target.kind === 'npc'
        ? texts.interactionNpc[target.action](npcName(target.npcId))
        : texts.interaction[target.action];
    prompt.hidden = false;
  };
  renderPrompt();

  // Notices
  const notices = element('div', 'ui-notices');
  notices.setAttribute('aria-live', 'polite');
  overlay.append(notices);
  const timers = new Set<number>();
  const notify = (text: string): void => {
    const notice = element('div', 'ui-notice', text);
    notices.append(notice);
    const fade = window.setTimeout(() => notice.classList.add('leaving'), 3600);
    const remove = window.setTimeout(() => {
      notice.remove();
      timers.delete(fade);
      timers.delete(remove);
    }, 4100);
    timers.add(fade);
    timers.add(remove);
  };

  // "Neues Spiel" with a second click as confirmation
  const newGame = element('button', 'ui-newgame', texts.newGame.button);
  newGame.type = 'button';
  let confirmTimer: number | undefined;
  const resetConfirm = (): void => {
    newGame.classList.remove('confirming');
    newGame.textContent = texts.newGame.button;
    if (confirmTimer !== undefined) window.clearTimeout(confirmTimer);
    confirmTimer = undefined;
  };
  newGame.addEventListener('click', () => {
    newGame.blur();
    if (confirmTimer === undefined) {
      newGame.classList.add('confirming');
      newGame.textContent = texts.newGame.confirm;
      confirmTimer = window.setTimeout(resetConfirm, 3500);
      return;
    }
    resetConfirm();
    callbacks.onNewGame();
  });
  overlay.append(newGame);

  // Panels
  const context: PanelContext = {
    game,
    notify,
    refresh: () => modal.refresh(),
    close: () => modal.close(),
    open: (id) => modal.open(id),
    weatherEffects: () => callbacks.weatherEffects(),
    setWeatherEffects: (level) => callbacks.onWeatherEffects(level),
  };
  const modal = createModalHost(
    overlay,
    {
      goods: createGoodsPanel(context),
      till: createTillPanel(context),
      report: createReportPanel(context),
      confirmClose: createConfirmClosePanel(context),
      dialogue: createDialoguePanel(context),
      journal: createJournalPanel(context),
      calendar: createCalendarPanel(context),
    },
    (open) => {
      modalOpen = open;
      renderPrompt();
      callbacks.onModalChange(open);
    },
  );
  const openPanel = (id: PanelId): void => {
    if (id === 'report' && game.state.economy.lastReport === null) return;
    if (id === 'dialogue' && game.dialogue.current() === null) return;
    // Dialogue, journal and calendar never replace an open panel.
    if ((id === 'dialogue' || id === 'journal' || id === 'calendar') && modal.current() !== null && modal.current() !== id) return;
    modal.open(id);
  };
  const hud = createHud(game, overlay, {
    closeDay: () => openPanel(game.state.calendar.phase === 'closed' ? 'report' : 'confirmClose'),
    openJournal: () => openPanel('journal'),
    openCalendar: () => openPanel('calendar'),
  });
  /** After a reload in phase 'closed' the report must be shown again. */
  const syncReport = (): void => {
    if (game.state.calendar.phase === 'closed') openPanel('report');
  };
  syncReport();

  // Relationship feedback: the tiers last seen per resident (the signal only carries the new tier).
  const knownTiers = new Map<string, string>();
  const syncTiers = (): void => {
    knownTiers.clear();
    for (const npc of game.npcs.list()) knownTiers.set(npc.id, npc.tier);
  };
  syncTiers();
  let memoryNoticeFor: string | null = null;

  /** J toggles the journal, K the calendar, anywhere (not while another panel is open, not while typing). */
  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const panel: PanelId | null = key === 'j' ? 'journal' : key === 'k' ? 'calendar' : null;
    if (panel === null || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    const open = modal.current();
    if (open === panel) modal.close();
    else if (open === null) openPanel(panel);
    else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', onKeyDown);

  const syncDialogue = (): void => {
    const open = modal.current();
    if (game.dialogue.current() === null) {
      if (open === 'dialogue') modal.close();
      return;
    }
    if (open === 'dialogue') modal.refresh();
    else if (open === null) openPanel('dialogue');
    else game.dialogue.close(); // a dialogue never opens over another panel
  };

  const refreshOn = [
    'product.stock.changed',
    'money.changed',
    'order.placed',
    'delivery.received',
    'sale.completed',
    'kiosk.shutter.changed',
  ] as const;
  const offs = [
    game.signals.on('interaction.target.changed', renderPrompt),
    game.signals.on('dialogue.opened', () => {
      memoryNoticeFor = null;
      syncDialogue();
    }),
    game.signals.on('dialogue.closed', () => {
      memoryNoticeFor = null;
      syncDialogue();
    }),
    game.signals.on('relationship.changed', ({ npcId, tier }) => {
      const before = knownTiers.get(npcId);
      knownTiers.set(npcId, tier);
      if (before === undefined || before === tier) return;
      const text = tierChangeNotice(npcName(npcId), before as typeof tier, tier);
      if (text) notify(text);
    }),
    game.signals.on('memory.added', ({ npcId, memoryId }) => {
      // Only decisions made in a conversation, once per conversation.
      if (!isMemorableMemory(memoryId) || memoryNoticeFor === npcId || game.dialogue.current()?.npcId !== npcId) return;
      memoryNoticeFor = npcId;
      notify(texts.notices.willRemember(npcName(npcId)));
    }),
    game.signals.on('sale.completed', ({ npcId, totalCents }) => {
      if (npcId !== undefined) notify(texts.notices.saleDone(formatEuro(totalCents)));
    }),
    game.signals.on('interaction.available.changed', ({ interaction }) => {
      renderPrompt();
      // A place-bound panel never outlives its place (input is locked while open; this guards teleports/replacements).
      const open = modal.current();
      if ((open === 'till' && interaction?.kind !== 'register') || (open === 'goods' && interaction?.kind !== 'storage')) {
        modal.close();
      }
    }),
    game.signals.on('interaction.triggered', ({ kind }) => {
      if (kind === 'storage') openPanel('goods');
      else if (kind === 'register') openPanel('till');
    }),
    game.signals.on('calendar.changed', () => {
      hud.update();
      modal.refresh();
    }),
    game.signals.on('day.ending', () => {
      hud.update();
      notify(texts.notices.daySummaryHint);
    }),
    game.signals.on('day.ended', () => {
      hud.update();
      openPanel('report');
    }),
    game.signals.on('day.started', ({ day }) => {
      hud.update();
      if (modal.current() === 'report') modal.close();
      notify(texts.notices.dayStarted(day));
    }),
    game.signals.on('game.state.replaced', () => {
      syncTiers();
      memoryNoticeFor = null;
      renderPrompt();
      modal.close();
      hud.update();
      syncReport();
    }),
    ...refreshOn.map((name) =>
      game.signals.on(name, () => {
        hud.update();
        modal.refresh();
      }),
    ),
  ];

  return {
    notify,
    openPanel,
    closePanel: () => modal.close(),
    currentPanel: () => modal.current(),
    frame: () => hud.frame(),
    showFatal(message, details) {
      showFatalError(root, { message, details });
    },
    dispose() {
      for (const off of offs) off();
      window.removeEventListener('keydown', onKeyDown);
      modal.dispose();
      hud.dispose();
      timers.forEach((t) => window.clearTimeout(t));
      if (confirmTimer !== undefined) window.clearTimeout(confirmTimer);
      overlay.remove();
    },
  };
}
