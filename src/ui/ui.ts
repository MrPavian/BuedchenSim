import type { Game } from '../game/game';
import './styles.css';
import { texts } from './texts';

export interface UiCallbacks {
  /** Called after the player confirmed "Neues Spiel"; main clears the save and resets the game. */
  onNewGame(): void;
}

export interface Ui {
  notify(text: string): void;
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
  prompt.hidden = true;
  const key = element('kbd', undefined, texts.interactionKey);
  const promptLabel = element('span');
  prompt.append(key, promptLabel);
  prompt.addEventListener('click', () => {
    game.interact();
    prompt.blur(); // keep E/Space from re-triggering the focused button
  });
  overlay.append(prompt);

  const renderPrompt = (): void => {
    const available = game.getAvailableInteraction();
    if (!available) {
      prompt.hidden = true;
      return;
    }
    promptLabel.textContent = texts.interaction[available.action];
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

  const offs = [
    game.signals.on('interaction.available.changed', renderPrompt),
    game.signals.on('game.state.replaced', renderPrompt),
  ];

  return {
    notify,
    showFatal(message, details) {
      showFatalError(root, { message, details });
    },
    dispose() {
      for (const off of offs) off();
      timers.forEach((t) => window.clearTimeout(t));
      if (confirmTimer !== undefined) window.clearTimeout(confirmTimer);
      overlay.remove();
    },
  };
}
