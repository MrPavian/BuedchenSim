import { shelfQuantity } from '../../game/selectors';
import { ageBadge, button, el, swatch, testId } from '../dom';
import { formatEuro } from '../format';
import type { Panel, PanelContext } from '../modal';
import { texts } from '../texts';
import { ageLabel, buildCartView, categoryLabel, clampCart, productList, reasonText } from '../viewModel';

interface Message {
  kind: 'ok' | 'error';
  text: string;
}

/**
 * Till: cart of shelf goods and the sale. Cart and age confirmation live only here, are reset after a sale
 * and on close, and are never part of the game state. The game decides whether a sale is accepted.
 */
export function createTillPanel(ctx: PanelContext): Panel {
  const { game } = ctx;
  const content = game.content;
  const cart = new Map<string, number>();
  let ageConfirmed = false;
  let message: Message | null = null;

  const reset = (): void => {
    cart.clear();
    ageConfirmed = false;
    message = null;
  };
  const change = (productId: string, delta: number): void => {
    const next = (cart.get(productId) ?? 0) + delta;
    if (next <= 0) cart.delete(productId);
    else cart.set(productId, Math.min(next, shelfQuantity(game.state, productId)));
    message = null;
    ctx.refresh();
  };

  return {
    id: 'till',
    title: () => texts.till.title,
    reset,
    render(body) {
      const state = game.state;
      clampCart(cart, (id) => shelfQuantity(state, id));
      const view = buildCartView(content, cart);
      if (view.minimumAge === null) ageConfirmed = false;

      if (state.calendar.phase !== 'open') {
        body.append(testId(el('p', 'ui-warning', texts.till.dayNotOpen), 'till-warning'));
      } else if (!state.kiosk.shutterOpen) {
        body.append(testId(el('p', 'ui-warning', texts.till.shutterClosed), 'till-warning'));
      }

      const columns = el('div', 'ui-till');

      // Products on the shelves
      const left = el('div', 'ui-till-products');
      left.append(el('h3', 'ui-subtitle', texts.till.products));
      const sellable = productList(content).filter((p) => shelfQuantity(state, p.id) > 0);
      if (sellable.length === 0) {
        left.append(testId(el('p', 'ui-muted', texts.till.noShelfStock), 'till-empty'));
      }
      for (const product of sellable) {
        const shelf = shelfQuantity(state, product.id);
        const inCart = cart.get(product.id) ?? 0;
        const row = testId(el('div', 'ui-till-row'), `till-row-${product.id}`);
        const cell = el('div', 'ui-product');
        cell.append(swatch(product.label));
        const names = el('div', 'ui-product-names');
        const line = el('div', 'ui-product-name');
        line.append(el('span', undefined, product.name));
        const age = ageLabel(product.minimumAge);
        if (age && product.minimumAge !== undefined) {
          line.append(ageBadge(age, texts.product.ageTitle(product.minimumAge), `till-age-${product.id}`));
        }
        names.append(line, el('div', 'ui-muted ui-small', `${product.brand} · ${categoryLabel(product)}`));
        cell.append(names);
        row.append(cell);
        row.append(el('span', 'ui-num ui-money', formatEuro(product.suggestedPriceCents)));
        row.append(testId(el('span', 'ui-num ui-small', texts.till.available(shelf)), `till-avail-${product.id}`));
        const add = button('+', `till-add-${product.id}`, () => change(product.id, 1), 'ui-btn ui-btn-step');
        add.title = texts.till.add;
        add.setAttribute('aria-label', `${texts.till.add}: ${product.name}`);
        add.disabled = inCart >= shelf;
        row.append(add);
        left.append(row);
      }

      // Cart
      const right = el('div', 'ui-till-cart');
      right.append(el('h3', 'ui-subtitle', texts.till.cart));
      if (view.lines.length === 0) right.append(testId(el('p', 'ui-muted', texts.till.emptyCart), 'cart-empty'));
      for (const line of view.lines) {
        const row = testId(el('div', 'ui-cart-row'), `cart-line-${line.productId}`);
        const dec = button('−', `till-remove-${line.productId}`, () => change(line.productId, -1), 'ui-btn ui-btn-step');
        dec.title = texts.till.remove;
        dec.setAttribute('aria-label', `${texts.till.remove}: ${line.name}`);
        const name = el('span', 'ui-cart-name');
        name.append(el('span', undefined, line.name));
        name.append(el('span', 'ui-muted ui-small', `${formatEuro(line.unitCents)}`));
        row.append(
          dec,
          testId(el('span', 'ui-num', `${line.quantity}×`), `cart-qty-${line.productId}`),
          name,
          testId(el('span', 'ui-num ui-money', formatEuro(line.lineCents)), `cart-line-total-${line.productId}`),
        );
        right.append(row);
      }

      const sums = el('div', 'ui-sums');
      const sub = el('div', 'ui-sum');
      sub.append(el('span', undefined, texts.till.subtotal), testId(el('span', 'ui-money', formatEuro(view.totalCents)), 'cart-subtotal'));
      const total = el('div', 'ui-sum ui-sum-total');
      total.append(el('span', undefined, texts.till.total), testId(el('strong', 'ui-money', formatEuro(view.totalCents)), 'cart-total'));
      sums.append(sub, total);
      right.append(sums);

      if (view.minimumAge !== null) {
        const label = el('label', 'ui-check');
        const box = el('input');
        box.type = 'checkbox';
        box.checked = ageConfirmed;
        testId(box, 'till-age-checkbox');
        box.addEventListener('change', () => {
          ageConfirmed = box.checked;
          message = null;
          ctx.refresh();
        });
        label.append(box, el('span', undefined, texts.till.ageCheck(view.minimumAge)));
        right.append(label, testId(el('p', 'ui-muted ui-small', texts.till.ageHint), 'till-age-note'));
      }

      const msg = el('div', `ui-message ${message?.kind ?? ''}`, message?.text ?? '');
      msg.hidden = message === null;
      msg.setAttribute('role', message?.kind === 'error' ? 'alert' : 'status');
      right.append(testId(msg, 'till-message'));

      const actions = el('div', 'ui-actions');
      const cancel = button(texts.till.cancel, 'till-cancel', () => ctx.close(), 'ui-btn');
      const submit = button(texts.till.submit, 'till-submit', () => {
        const lines = view.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
        const result = game.economy.completeSale({ lines, ageCheckConfirmed: ageConfirmed });
        if (!result.ok) {
          message = { kind: 'error', text: reasonText(result.reason) };
          ctx.refresh();
          return;
        }
        const text = texts.till.sold(formatEuro(result.transaction.totalCents));
        reset();
        message = { kind: 'ok', text };
        ctx.notify(text);
        ctx.refresh();
      }, 'ui-btn ui-btn-primary');
      submit.disabled = view.lines.length === 0;
      actions.append(cancel, submit);
      right.append(actions);

      columns.append(left, right);
      body.append(columns);
    },
  };
}
