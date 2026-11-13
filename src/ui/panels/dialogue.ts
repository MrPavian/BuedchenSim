import type { ChooseResult } from '../../game/dialogue';
import { button, el, testId } from '../dom';
import { formatEuro } from '../format';
import type { Panel, PanelContext } from '../modal';
import { buildDialogueModel, optionForKey, type CustomerModel, type DialogueModel } from '../socialViewModel';
import { texts } from '../texts';
import { reasonText } from '../viewModel';

/** After a choice the options ignore input for this long (double click / key repeat must not choose twice). */
const LOCK_MS = 250;

/**
 * Generic dialogue panel for every resident: name, role, relationship hint, the resident's line, 2-4 options and, for
 * a waiting customer, the wished goods. It only renders `game.dialogue.current()` and calls `game.dialogue.choose` /
 * `close`; it keeps no game state (only the last rejection message and the double-activation lock).
 */
export function createDialoguePanel(ctx: PanelContext): Panel {
  const { game } = ctx;
  let message: string | null = null;
  let lockedUntil = 0;
  let active = false;
  let model: DialogueModel | null = null;
  let sessionKey = '';

  const choose = (optionId: string): void => {
    const now = performance.now();
    if (now < lockedUntil || !active) return;
    lockedUntil = now + LOCK_MS;
    const result: ChooseResult = game.dialogue.choose(optionId);
    message = result.ok ? null : reasonText(result.reason);
    if (result.ok && result.ended) return; // dialogue.closed closes the panel
    ctx.refresh();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active || !model || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const id = optionForKey(model, event.key);
    if (id === null) return;
    event.preventDefault();
    event.stopPropagation();
    choose(id);
  };
  window.addEventListener('keydown', onKeyDown, true);

  const renderCustomer = (body: HTMLElement, c: CustomerModel): void => {
    const box = el('div', 'ui-customer');
    box.append(el('h3', 'ui-subtitle', texts.dialogue.customer.wish));
    for (const line of c.lines) {
      const row = testId(el('div', 'ui-customer-line'), `customer-line-${line.productId}`);
      row.append(el('span', undefined, `${line.quantity} × ${line.name}`));
      row.append(el('span', 'ui-muted ui-small', formatEuro(line.unitCents)));
      const shelf = el('span', `ui-small ${line.short ? 'ui-bad' : 'ui-muted'}`, texts.dialogue.customer.shelf(line.onShelf));
      row.append(shelf, el('span', 'ui-num ui-money', formatEuro(line.lineCents)));
      box.append(row);
    }
    const total = el('div', 'ui-customer-line ui-customer-total');
    total.append(el('span', undefined, texts.dialogue.customer.total), el('span'), el('span'));
    total.append(testId(el('span', 'ui-num ui-money', formatEuro(c.totalCents)), 'customer-total'));
    box.append(total);
    if (c.ageLabel !== null && c.minimumAge !== null) {
      const age = testId(el('p', 'ui-small ui-muted ui-customer-age'), 'customer-age');
      age.append(el('span', undefined, texts.dialogue.customer.ageRequired(c.minimumAge)));
      if (c.revealedAgeText !== null) {
        age.append(el('span', c.underage ? 'ui-bad' : undefined, ` · ${c.revealedAgeText}`));
      }
      box.append(age);
    }
    if (c.stockWarning) {
      box.append(testId(el('p', 'ui-warning', texts.dialogue.customer.stockWarning), 'customer-stock-warning'));
    }
    body.append(box);
  };

  return {
    id: 'dialogue',
    title: () => texts.dialogue.title,
    reset() {
      active = false;
      model = null;
      message = null;
      sessionKey = '';
      game.dialogue.close(); // idempotent: harmless when the game already ended the conversation
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown, true);
    },
    render(body) {
      const view = game.dialogue.current();
      if (!view) {
        // The conversation ended without a signal reaching us: close the panel.
        queueMicrotask(() => ctx.close());
        return;
      }
      const key = `${view.npcId}|${view.dialogueId}`;
      if (key !== sessionKey) {
        sessionKey = key;
        message = null;
      }
      active = true;
      model = buildDialogueModel(game.content, game.state, view);

      const head = el('div', 'ui-dialogue-head');
      head.append(testId(el('h3', 'ui-dialogue-name', model.name), 'dialogue-name'));
      if (model.role) head.append(el('span', 'ui-muted ui-small', model.role));
      const tier = testId(el('span', 'ui-dialogue-tier', model.tierLabel), 'dialogue-tier');
      tier.title = model.tierTitle;
      tier.dataset['tier'] = model.tier;
      head.append(tier);
      body.append(head);

      body.append(testId(el('p', 'ui-dialogue-text', model.text), 'dialogue-text'));
      if (model.customer) renderCustomer(body, model.customer);
      if (message) body.append(testId(el('p', 'ui-warning ui-dialogue-message', message), 'dialogue-message'));

      const options = el('div', 'ui-dialogue-options');
      for (const option of model.options) {
        const b = button('', `dialogue-option-${option.id}`, () => choose(option.id), 'ui-btn ui-dialogue-option');
        if (option.key !== null) {
          const kbd = el('kbd', undefined, String(option.key));
          kbd.title = texts.dialogue.keyHint(option.key);
          b.append(kbd);
        }
        b.append(el('span', undefined, option.text));
        options.append(b);
      }
      body.append(options);
    },
  };
}
