import type { Game } from '../game/game';
import { button, el, testId } from './dom';
import { texts } from './texts';

export type PanelId = 'goods' | 'till' | 'report' | 'confirmClose' | 'dialogue' | 'journal';

/** What panels get from the UI shell. */
export interface PanelContext {
  readonly game: Game;
  notify(text: string): void;
  /** Re-renders the open panel (coalesced). */
  refresh(): void;
  close(): void;
  open(id: PanelId): void;
}

export interface Panel {
  readonly id: PanelId;
  title(): string;
  /** Rebuilds the panel contents; must be idempotent and read game.state. */
  render(body: HTMLElement): void;
  /** Called on every close; resets transient state (cart, age confirmation, messages). */
  reset(): void;
  /** Optional: removes listeners the panel registered itself. */
  dispose?(): void;
}

export interface ModalHost {
  open(id: PanelId): void;
  close(): void;
  current(): PanelId | null;
  refresh(): void;
  dispose(): void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** One modal at a time over a dimmed backdrop; Escape and the close button close it; Tab stays inside. */
export function createModalHost(
  parent: HTMLElement,
  panels: Record<PanelId, Panel>,
  onChange: (open: boolean) => void,
): ModalHost {
  const backdrop = el('div', 'ui-modal');
  backdrop.hidden = true;
  const card = el('div', 'ui-panel');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.tabIndex = -1;
  const header = el('div', 'ui-panel-header');
  const title = el('h2', 'ui-panel-title');
  const closeButton = button(texts.panel.close, 'panel-close', () => host.close(), 'ui-btn ui-btn-quiet');
  header.append(title, closeButton);
  const body = el('div', 'ui-panel-body');
  card.append(header, body);
  backdrop.append(card);
  parent.append(backdrop);

  let active: PanelId | null = null;
  let previousFocus: Element | null = null;
  let refreshQueued = false;

  const render = (): void => {
    if (active === null) return;
    const panel = panels[active];
    const focused = document.activeElement;
    const focusId = focused instanceof HTMLElement && body.contains(focused) ? focused.dataset['testid'] : undefined;
    const scroll = body.scrollTop;
    title.textContent = panel.title();
    testId(card, `panel-${active}`);
    body.replaceChildren();
    panel.render(body);
    body.scrollTop = scroll;
    if (focusId) {
      const again = [...body.querySelectorAll<HTMLElement>('[data-testid]')].find((n) => n.dataset['testid'] === focusId);
      again?.focus({ preventScroll: true });
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (active === null) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      host.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...card.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const current = document.activeElement;
    if (!card.contains(current)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  const host: ModalHost = {
    open(id) {
      const wasOpen = active !== null;
      if (active !== null && active !== id) panels[active].reset();
      active = id;
      if (!wasOpen) {
        previousFocus = document.activeElement;
        backdrop.hidden = false;
        onChange(true);
      }
      render();
      if (!wasOpen || !card.contains(document.activeElement)) card.focus({ preventScroll: true });
    },
    close() {
      if (active === null) return;
      panels[active].reset();
      active = null;
      backdrop.hidden = true;
      body.replaceChildren();
      if (previousFocus instanceof HTMLElement && previousFocus !== document.body) previousFocus.blur();
      previousFocus = null;
      onChange(false);
    },
    current: () => active,
    refresh() {
      if (active === null || refreshQueued) return;
      refreshQueued = true;
      queueMicrotask(() => {
        refreshQueued = false;
        render();
      });
    },
    dispose() {
      for (const panel of Object.values(panels)) panel.dispose?.();
      window.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
    },
  };
  return host;
}
