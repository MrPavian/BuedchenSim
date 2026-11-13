import { SPEEDS } from '../game/balance';
import type { Game } from '../game/game';
import { button, el, testId } from './dom';
import { formatClock, formatEuro } from './format';
import { texts } from './texts';

export interface HudActions {
  openGoods(): void;
  openTill(): void;
  /** "Tag abschließen" (confirmation) or, when the day is already closed, the report. */
  closeDay(): void;
}

export interface Hud {
  /** Re-reads the game state; only touches the DOM for values that changed. */
  update(): void;
  /** Cheap per-frame check: updates only when the whole game minute changed. */
  frame(): void;
  dispose(): void;
}

/** Compact always-visible bar: day, clock, cash, kiosk status, pause/speed, panel buttons, day close. */
export function createHud(game: Game, parent: HTMLElement, actions: HudActions): Hud {
  const root = el('div', 'ui-hud');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', texts.hud.label);

  const stats = el('div', 'ui-hud-stats');
  const day = testId(el('span', 'ui-hud-day'), 'hud-day');
  const clock = testId(el('span', 'ui-hud-clock'), 'hud-clock');
  const cash = testId(el('span', 'ui-hud-cash ui-money'), 'hud-cash');
  cash.title = texts.hud.cash;
  const status = testId(el('span', 'ui-hud-status'), 'hud-status');
  const paused = testId(el('span', 'ui-hud-paused', texts.hud.paused), 'hud-paused');
  stats.append(day, clock, paused, cash, status);

  const controls = el('div', 'ui-hud-controls');
  const pause = button(texts.hud.pause, 'hud-pause', () => {
    if (game.state.calendar.paused) game.calendar.resume();
    else game.calendar.pause();
  }, 'ui-btn ui-hud-pause');
  const speedGroup = el('div', 'ui-hud-speeds');
  speedGroup.setAttribute('role', 'group');
  speedGroup.setAttribute('aria-label', texts.hud.speedLabel);
  const speedButtons = SPEEDS.map((speed) => {
    const b = button(texts.hud.speed(speed), `hud-speed-${speed}`, () => {
      game.calendar.setSpeed(speed);
    }, 'ui-btn ui-hud-speed');
    speedGroup.append(b);
    return { speed, b };
  });
  const goods = button(texts.hud.goods, 'hud-open-goods', actions.openGoods);
  const till = button(texts.hud.till, 'hud-open-till', actions.openTill);
  const closeDay = button(texts.hud.closeDay, 'hud-close-day', actions.closeDay, 'ui-btn ui-btn-primary');
  controls.append(pause, speedGroup, goods, till, closeDay);

  const hint = el('div', 'ui-hud-hint');
  hint.setAttribute('role', 'status');
  testId(hint, 'hud-closing-hint');
  hint.hidden = true;
  const hintText = el('span', undefined, texts.hud.awaitingClose);
  const hintAction = button(texts.hud.awaitingCloseAction, 'hud-closing-hint-action', actions.closeDay, 'ui-btn ui-btn-primary');
  hint.append(hintText, hintAction);

  root.append(stats, controls, hint);
  parent.append(root);

  const setText = (node: HTMLElement, text: string): void => {
    if (node.textContent !== text) node.textContent = text;
  };
  let lastMinute = -1;

  const update = (): void => {
    const { calendar, economy, kiosk } = game.state;
    lastMinute = Math.floor(calendar.minute);
    setText(day, texts.hud.day(calendar.day));
    setText(clock, formatClock(calendar.minute));
    setText(cash, formatEuro(economy.cashCents));
    setText(status, kiosk.shutterOpen ? texts.hud.open : texts.hud.closed);
    status.dataset['open'] = String(kiosk.shutterOpen);
    paused.style.visibility = calendar.paused ? 'visible' : 'hidden';
    setText(pause, calendar.paused ? texts.hud.resume : texts.hud.pause);
    pause.setAttribute('aria-pressed', String(calendar.paused));
    pause.dataset['paused'] = String(calendar.paused);
    for (const { speed, b } of speedButtons) {
      const active = calendar.speed === speed;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    }
    root.dataset['phase'] = calendar.phase;
    hint.hidden = calendar.phase !== 'awaiting_close';
    setText(closeDay, calendar.phase === 'closed' ? texts.hud.showReport : texts.hud.closeDay);
    closeDay.disabled = calendar.phase === 'closed' && economy.lastReport === null;
  };

  update();

  return {
    update,
    frame() {
      if (Math.floor(game.state.calendar.minute) !== lastMinute) update();
    },
    dispose() {
      root.remove();
    },
  };
}
