import { STORAGE_CAPACITY_UNITS } from '../../game/balance';
import {
  findProduct,
  freeStorageUnits,
  shelfQuantity,
  slotCapacityFor,
  storageQuantity,
} from '../../game/selectors';
import type { ProductDef } from '../../game/types';
import { ageBadge, button, el, quantityInput, swatch, testId } from '../dom';
import { formatEuro } from '../format';
import type { Panel, PanelContext } from '../modal';
import { texts } from '../texts';
import {
  MAX_QUANTITY_INPUT,
  ageLabel,
  categoryLabel,
  clampInt,
  defaultRestockQuantity,
  groupSlotsByPlacement,
  productList,
  reasonText,
  slotLabel,
  storageKindLabel,
  summarizeOrder,
} from '../viewModel';

type Tab = 'stock' | 'order' | 'delivery' | 'restock';
const TABS: Tab[] = ['stock', 'order', 'delivery', 'restock'];

interface Message {
  kind: 'ok' | 'error';
  text: string;
}

interface SlotUi {
  productId: string | null;
  quantity: number | null;
  takeQuantity: number | null;
}

function nameCell(product: ProductDef): HTMLElement {
  const cell = el('div', 'ui-product');
  cell.append(swatch(product.label));
  const names = el('div', 'ui-product-names');
  const line = el('div', 'ui-product-name');
  line.append(el('span', undefined, product.name));
  const age = ageLabel(product.minimumAge);
  if (age && product.minimumAge !== undefined) {
    line.append(ageBadge(age, texts.product.ageTitle(product.minimumAge), `age-${product.id}`));
  }
  names.append(line, el('div', 'ui-muted ui-small', `${product.brand} · ${categoryLabel(product)}`));
  cell.append(names);
  return cell;
}

/** Goods management: stock overview, ordering, delivery, restocking of presentation slots. */
export function createGoodsPanel(ctx: PanelContext): Panel {
  const { game } = ctx;
  const content = game.content;
  let tab: Tab = 'stock';
  let message: Message | null = null;
  const order = new Map<string, number>();
  const slotUi = new Map<string, SlotUi>();
  let showAllSlots = false;

  const reject = (reason: string): void => {
    message = { kind: 'error', text: reasonText(reason) };
    ctx.refresh();
  };
  const success = (text: string): void => {
    message = { kind: 'ok', text };
    ctx.refresh();
  };
  const messageBox = (): HTMLElement => {
    const box = el('div', `ui-message ${message?.kind ?? ''}`, message?.text ?? '');
    box.setAttribute('role', message?.kind === 'error' ? 'alert' : 'status');
    box.hidden = message === null;
    return testId(box, 'goods-message');
  };
  const slotState = (slotId: string): SlotUi => {
    let value = slotUi.get(slotId);
    if (!value) {
      value = { productId: null, quantity: null, takeQuantity: null };
      slotUi.set(slotId, value);
    }
    return value;
  };

  // ---- Bestand
  const renderStock = (body: HTMLElement): void => {
    const products = productList(content);
    if (products.length === 0) {
      body.append(el('p', 'ui-muted', texts.panel.none));
      return;
    }
    body.append(el('p', 'ui-muted ui-small', texts.goods.stock.hint));
    const table = el('div', 'ui-table ui-table-stock');
    const head = el('div', 'ui-row ui-row-head');
    for (const label of [
      texts.goods.stock.product,
      texts.goods.stock.storage,
      texts.goods.stock.shelf,
      texts.goods.stock.price,
    ]) {
      head.append(el('span', undefined, label));
    }
    table.append(head);
    for (const product of products) {
      const row = testId(el('div', 'ui-row'), `stock-row-${product.id}`);
      row.append(nameCell(product));
      row.append(testId(el('span', 'ui-num', String(storageQuantity(game.state, product.id))), `stock-storage-${product.id}`));
      row.append(testId(el('span', 'ui-num', String(shelfQuantity(game.state, product.id))), `stock-shelf-${product.id}`));
      row.append(testId(el('span', 'ui-num ui-money', formatEuro(product.suggestedPriceCents)), `stock-price-${product.id}`));
      table.append(row);
    }
    body.append(table);
    body.append(
      el('p', 'ui-muted ui-small', `${texts.goods.order.freeStorage}: ${freeStorageUnits(game.state)} / ${STORAGE_CAPACITY_UNITS}`),
    );
  };

  // ---- Bestellen
  const renderOrder = (body: HTMLElement): void => {
    const products = productList(content);
    if (products.length === 0) {
      body.append(el('p', 'ui-muted', texts.panel.none));
      return;
    }
    const state = game.state;
    const summary = summarizeOrder(content, order, state.economy.cashCents, freeStorageUnits(state));
    if (state.calendar.phase === 'closed') body.append(el('p', 'ui-warning', texts.goods.order.closedNote));
    if (state.economy.pendingDelivery) body.append(el('p', 'ui-warning', texts.goods.order.pendingNote));
    body.append(el('p', 'ui-muted ui-small', texts.goods.order.supplier));

    const table = el('div', 'ui-table ui-table-order');
    const head = el('div', 'ui-row ui-row-head');
    for (const label of [
      texts.goods.stock.product,
      texts.goods.order.purchase,
      texts.goods.order.inStorage,
      texts.goods.order.quantity,
    ]) {
      head.append(el('span', undefined, label));
    }
    table.append(head);
    const setQuantity = (productId: string, value: number): void => {
      const next = clampInt(value, 0, MAX_QUANTITY_INPUT);
      if (next === 0) order.delete(productId);
      else order.set(productId, next);
      message = null;
      ctx.refresh();
    };
    for (const product of products) {
      const quantity = order.get(product.id) ?? 0;
      const row = testId(el('div', 'ui-row'), `order-row-${product.id}`);
      row.append(nameCell(product));
      row.append(el('span', 'ui-num ui-money', formatEuro(product.purchasePriceCents)));
      row.append(el('span', 'ui-num', String(storageQuantity(state, product.id))));
      const stepper = el('div', 'ui-stepper');
      const dec = button('−', `order-dec-${product.id}`, () => setQuantity(product.id, quantity - 1), 'ui-btn ui-btn-step');
      dec.title = texts.goods.order.decrease;
      dec.setAttribute('aria-label', `${texts.goods.order.decrease}: ${product.name}`);
      const inc = button('+', `order-inc-${product.id}`, () => setQuantity(product.id, quantity + 1), 'ui-btn ui-btn-step');
      inc.title = texts.goods.order.increase;
      inc.setAttribute('aria-label', `${texts.goods.order.increase}: ${product.name}`);
      const input = quantityInput(quantity, `order-qty-${product.id}`, MAX_QUANTITY_INPUT, (v) => setQuantity(product.id, v));
      input.setAttribute('aria-label', `${texts.goods.order.quantity}: ${product.name}`);
      stepper.append(dec, input, inc);
      row.append(stepper);
      table.append(row);
    }
    body.append(table);

    const footer = el('div', 'ui-panel-footer');
    const sums = el('div', 'ui-sums');
    const sumRow = (label: string, value: string, id: string, warn = false): void => {
      const line = el('div', 'ui-sum');
      line.append(el('span', undefined, label), testId(el('strong', `ui-money${warn ? ' ui-bad' : ''}`, value), id));
      sums.append(line);
    };
    sumRow(texts.goods.order.units, String(summary.units), 'order-units');
    sumRow(texts.goods.order.total, formatEuro(summary.totalCents), 'order-total');
    sumRow(texts.goods.order.cashAfter, formatEuro(summary.cashAfterCents), 'order-cash-after', !summary.affordable);
    sumRow(texts.goods.order.freeStorage, String(summary.freeUnitsAfter), 'order-free-units', !summary.fitsStorage);
    footer.append(sums, messageBox());
    const submit = button(texts.goods.order.submit, 'order-submit', () => {
      const lines = [...order].filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity }));
      const result = game.economy.placeOrder(lines);
      if (!result.ok) return reject(result.reason);
      order.clear();
      tab = 'delivery';
      success(texts.notices.orderPlaced(formatEuro(summary.totalCents)));
      ctx.notify(texts.notices.orderPlaced(formatEuro(summary.totalCents)));
    }, 'ui-btn ui-btn-primary');
    submit.disabled = summary.units === 0;
    footer.append(submit);
    body.append(footer);
  };

  // ---- Lieferung
  const renderDelivery = (body: HTMLElement): void => {
    const delivery = game.state.economy.pendingDelivery;
    if (!delivery) {
      const box = el('div', 'ui-empty');
      box.append(el('strong', undefined, texts.goods.delivery.none), el('p', 'ui-muted', texts.goods.delivery.noneHint));
      testId(box, 'delivery-empty');
      body.append(box, messageBox());
      return;
    }
    body.append(el('h3', 'ui-subtitle', texts.goods.delivery.pending));
    const table = el('div', 'ui-table ui-table-delivery');
    const head = el('div', 'ui-row ui-row-head');
    for (const label of [texts.goods.stock.product, texts.goods.delivery.quantity, texts.goods.delivery.unitPrice]) {
      head.append(el('span', undefined, label));
    }
    table.append(head);
    for (const line of delivery.lines) {
      const product = findProduct(content, line.productId);
      const row = testId(el('div', 'ui-row'), `delivery-row-${line.productId}`);
      if (product) row.append(nameCell(product));
      else row.append(el('span', undefined, line.productId));
      row.append(el('span', 'ui-num', String(line.quantity)));
      row.append(el('span', 'ui-num ui-money', formatEuro(product?.purchasePriceCents ?? 0)));
      table.append(row);
    }
    body.append(table);
    const footer = el('div', 'ui-panel-footer');
    const sums = el('div', 'ui-sums');
    const line = el('div', 'ui-sum');
    line.append(
      el('span', undefined, texts.goods.delivery.total),
      testId(el('strong', 'ui-money', formatEuro(delivery.totalCents)), 'delivery-total'),
    );
    sums.append(line);
    footer.append(sums, messageBox());
    footer.append(
      button(texts.goods.delivery.receive, 'delivery-receive', () => {
        const result = game.economy.receiveDelivery();
        if (!result.ok) return reject(result.reason);
        success(texts.notices.deliveryReceived);
        ctx.notify(texts.notices.deliveryReceived);
      }, 'ui-btn ui-btn-primary'),
    );
    body.append(footer);
  };

  // ---- Einräumen
  const renderRestock = (body: HTMLElement): void => {
    const groups = groupSlotsByPlacement(content);
    body.append(el('p', 'ui-muted ui-small', texts.goods.restock.hint), messageBox());
    if (groups.length === 0) {
      body.append(el('p', 'ui-muted', texts.panel.none));
      return;
    }
    const products = productList(content);
    const toggle = button(
      showAllSlots ? texts.goods.restock.onlyUsable : texts.goods.restock.showAll,
      'slots-toggle-all',
      () => {
        showAllSlots = !showAllSlots;
        ctx.refresh();
      },
      'ui-btn',
    );
    body.append(toggle);
    let shown = 0;
    for (const group of groups) {
      const section = el('section', 'ui-group');
      section.append(el('h3', 'ui-subtitle', group.label));
      let inGroup = 0;
      for (const slot of group.slots) {
        const stock = Object.hasOwn(game.state.economy.shelves, slot.id) ? game.state.economy.shelves[slot.id] : undefined;
        const ui = slotState(slot.id);
        const offered = products.filter(
          (p) =>
            p.storage === slot.accepts &&
            storageQuantity(game.state, p.id) > 0 &&
            (!stock || stock.productId === p.id) &&
            slotCapacityFor(content, slot.id, p.id) > 0, // a unit that does not fit the slot box is never offered
        );
        if (!showAllSlots && !stock && offered.length === 0) continue;
        inGroup += 1;
        const selected = offered.find((p) => p.id === ui.productId) ?? offered[0];
        const held = stock?.quantity ?? 0;
        const row = testId(el('div', 'ui-slot'), `slot-row-${slot.id}`);

        const info = el('div', 'ui-slot-info');
        info.append(el('div', 'ui-slot-name', slotLabel(content, slot)));
        info.append(el('div', 'ui-muted ui-small', texts.goods.restock.accepts(storageKindLabel(slot.accepts))));
        const heldProduct = stock ? findProduct(content, stock.productId) : undefined;
        const contentText =
          stock && heldProduct
            ? texts.goods.restock.content(heldProduct.name, stock.quantity, slotCapacityFor(content, slot.id, stock.productId))
            : texts.goods.restock.empty;
        info.append(testId(el('div', stock ? 'ui-slot-content' : 'ui-slot-content ui-muted', contentText), `slot-content-${slot.id}`));
        row.append(info);

        const controls = el('div', 'ui-slot-controls');
        if (!selected) {
          controls.append(el('span', 'ui-muted ui-small', stock ? texts.goods.restock.noMoreStock : texts.goods.restock.noStock));
        } else {
          const select = el('select', 'ui-select');
          testId(select, `slot-product-${slot.id}`);
          select.setAttribute('aria-label', texts.goods.restock.product);
          for (const product of offered) {
            const option = el('option', undefined, `${product.name} (${storageQuantity(game.state, product.id)})`);
            option.value = product.id;
            option.selected = product.id === selected.id;
            select.append(option);
          }
          select.addEventListener('change', () => {
            ui.productId = select.value;
            ui.quantity = null;
            ctx.refresh();
          });
          const capacity = slotCapacityFor(content, slot.id, selected.id);
          const avail = storageQuantity(game.state, selected.id);
          const quantity = ui.quantity ?? defaultRestockQuantity(avail, capacity, held);
          const qty = quantityInput(quantity, `slot-qty-${slot.id}`, MAX_QUANTITY_INPUT, (v) => {
            ui.quantity = clampInt(v, 0, MAX_QUANTITY_INPUT);
            ctx.refresh();
          });
          qty.setAttribute('aria-label', texts.goods.restock.quantity);
          const put = button(texts.goods.restock.put, `slot-restock-${slot.id}`, () => {
            const amount = clampInt(qty.valueAsNumber, 0, MAX_QUANTITY_INPUT);
            const result = game.economy.restock(slot.id, selected.id, amount);
            if (!result.ok) return reject(result.reason);
            ui.quantity = null;
            success(texts.goods.messages.restocked);
          });
          controls.append(select, qty, put, el('span', 'ui-muted ui-small', texts.goods.restock.capacityFor(capacity)));
        }
        row.append(controls);

        if (stock) {
          const take = el('div', 'ui-slot-controls');
          const takeQty = quantityInput(
            ui.takeQuantity ?? stock.quantity,
            `slot-unstock-qty-${slot.id}`,
            MAX_QUANTITY_INPUT,
            (v) => {
              ui.takeQuantity = clampInt(v, 0, MAX_QUANTITY_INPUT);
              ctx.refresh();
            },
          );
          takeQty.setAttribute('aria-label', texts.goods.restock.takeQuantity);
          take.append(
            takeQty,
            button(texts.goods.restock.take, `slot-unstock-${slot.id}`, () => {
              const result = game.economy.unstock(slot.id, clampInt(takeQty.valueAsNumber, 0, MAX_QUANTITY_INPUT));
              if (!result.ok) return reject(result.reason);
              ui.takeQuantity = null;
              success(texts.goods.messages.unstocked);
            }),
          );
          row.append(take);
        }
        section.append(row);
      }
      shown += inGroup;
      if (inGroup > 0) body.append(section);
    }
    if (shown === 0) body.append(testId(el('p', 'ui-muted', texts.goods.restock.nothingUsable), 'slots-none'));
  };

  return {
    id: 'goods',
    title: () => texts.goods.title,
    render(body) {
      const bar = el('div', 'ui-tabs');
      bar.setAttribute('role', 'tablist');
      for (const id of TABS) {
        const tabButton = button(
          id === 'delivery' && game.state.economy.pendingDelivery ? `${texts.goods.tabs[id]} •` : texts.goods.tabs[id], `goods-tab-${id}`, () => {
          tab = id;
          message = null;
          ctx.refresh();
        }, id === tab ? 'ui-tab active' : 'ui-tab');
        tabButton.setAttribute('role', 'tab');
        tabButton.setAttribute('aria-selected', String(id === tab));
        bar.append(tabButton);
      }
      body.append(bar);
      if (tab === 'stock') renderStock(body);
      else if (tab === 'order') renderOrder(body);
      else if (tab === 'delivery') renderDelivery(body);
      else renderRestock(body);
    },
    reset() {
      tab = 'stock';
      message = null;
      order.clear();
      slotUi.clear();
    },
  };
}
