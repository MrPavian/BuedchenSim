import { STORAGE_CAPACITY_UNITS, TRANSACTION_LIMIT } from './balance';
import type { DomainContext } from './domain';
import type { ActionResult } from './result';
import {
  cartMinimumAge,
  findProduct,
  findSlot,
  freeStorageUnits,
  shelfQuantity,
  slotCapacityFor,
  storageQuantity,
} from './selectors';
import type { DayReport, ProductLine, Transaction, TransactionLine } from './state';

export interface SaleRequest {
  lines: readonly ProductLine[];
  /**
   * The player confirmed the ID check for THIS sale. Valid for this single call only and never stored.
   */
  ageCheckConfirmed: boolean;
  /**
   * A resident customer buys. Adds: 'unknown_customer'; for restricted goods the resident's own age (from content)
   * must reach the minimum age ('customer_underage', even when `ageCheckConfirmed` is true: the player's confirmation
   * is never proof of a resident's age). The player's till sales omit this field and behave as before.
   */
  customer?: { npcId: string };
}

export type SaleResult = { ok: true; transaction: Transaction } | { ok: false; reason: string };
export type CloseDayResult = { ok: true; report: DayReport } | { ok: false; reason: string };

export interface EconomyApi {
  /** Orders goods from the (single, fictional) supplier; cash is deducted at once, delivery stays pending until received. */
  placeOrder(lines: readonly ProductLine[]): ActionResult;
  /** Credits the pending delivery to the back storage. */
  receiveDelivery(): ActionResult;
  /** Back storage -> presentation slot. */
  restock(slotId: string, productId: string, quantity: number): ActionResult;
  /** Presentation slot -> back storage (frees the slot for another product). */
  unstock(slotId: string, quantity: number): ActionResult;
  /** Atomic sale from presentation stock at suggested prices. */
  completeSale(request: SaleRequest): SaleResult;
  /** Ends the day (phase 'open' or 'awaiting_close'); exactly once per day. */
  closeDay(): CloseDayResult;
}

type Merged = { ok: true; lines: ProductLine[] } | { ok: false; reason: string };

/** Validates a line list and merges duplicate products (first occurrence order). */
function mergeLines(ctx: DomainContext, lines: readonly ProductLine[], emptyReason: string): Merged {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, reason: emptyReason };
  const merged = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) return { ok: false, reason: 'invalid_quantity' };
    if (!findProduct(ctx.content, line.productId)) return { ok: false, reason: 'unknown_product' };
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
  }
  return { ok: true, lines: [...merged].map(([productId, quantity]) => ({ productId, quantity })) };
}

/** Guard: money and quantities must stay non-negative safe integers. */
function assertCount(value: number, what: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${what} must be a non-negative integer, got ${value}`);
  return value;
}

function recordTransaction(
  ctx: DomainContext,
  kind: Transaction['kind'],
  lines: TransactionLine[],
  totalCents: number,
  npcId?: string,
): Transaction {
  const { economy, calendar } = ctx.state();
  const transaction: Transaction = {
    id: economy.nextTransactionId,
    day: calendar.day,
    minute: Math.floor(calendar.minute),
    kind,
    lines,
    totalCents,
    ...(npcId === undefined ? {} : { npcId }),
  };
  economy.nextTransactionId += 1;
  economy.transactions.push(transaction);
  if (economy.transactions.length > TRANSACTION_LIMIT) {
    economy.transactions.splice(0, economy.transactions.length - TRANSACTION_LIMIT);
  }
  return transaction;
}

export function createEconomyApi(ctx: DomainContext): EconomyApi {
  const stockChanged = (productId: string): void => ctx.emit('product.stock.changed', { productId });

  return {
    placeOrder(lines) {
      const state = ctx.state();
      const { economy } = state;
      if (state.calendar.phase === 'closed') return { ok: false, reason: 'day_closed' };
      const merged = mergeLines(ctx, lines, 'empty_order');
      if (!merged.ok) return merged;
      if (economy.pendingDelivery) return { ok: false, reason: 'order_pending' };
      let totalCents = 0;
      let units = 0;
      const transactionLines: TransactionLine[] = [];
      for (const line of merged.lines) {
        const price = findProduct(ctx.content, line.productId)?.purchasePriceCents ?? 0;
        totalCents += price * line.quantity;
        units += line.quantity;
        transactionLines.push({ productId: line.productId, quantity: line.quantity, unitPriceCents: price });
      }
      if (totalCents > economy.cashCents) return { ok: false, reason: 'insufficient_cash' };
      if (units > freeStorageUnits(state)) return { ok: false, reason: 'storage_full' };

      economy.cashCents = assertCount(economy.cashCents - totalCents, 'cash');
      economy.today.purchaseCents += totalCents;
      economy.pendingDelivery = { lines: merged.lines, totalCents };
      recordTransaction(ctx, 'purchase', transactionLines, totalCents);
      ctx.emit('money.changed', { cashCents: economy.cashCents });
      ctx.emit('order.placed', { totalCents });
      return { ok: true };
    },

    receiveDelivery() {
      const state = ctx.state();
      const { economy } = state;
      const delivery = economy.pendingDelivery;
      if (!delivery) return { ok: false, reason: 'no_delivery' };
      // The order reserved its space, so this only fails for a hand-edited or content-changed save.
      const units = delivery.lines.reduce((sum, l) => sum + l.quantity, 0);
      const stored = Object.values(economy.storage).reduce((sum, q) => sum + q, 0);
      if (stored + units > STORAGE_CAPACITY_UNITS) return { ok: false, reason: 'storage_full' };
      for (const line of delivery.lines) {
        economy.storage[line.productId] = storageQuantity(state, line.productId) + line.quantity;
      }
      economy.pendingDelivery = null;
      for (const line of delivery.lines) stockChanged(line.productId);
      ctx.emit('delivery.received', { totalCents: delivery.totalCents });
      return { ok: true };
    },

    restock(slotId, productId, quantity) {
      const state = ctx.state();
      const { economy } = state;
      const slot = findSlot(ctx.content, slotId);
      if (!slot) return { ok: false, reason: 'unknown_slot' };
      const product = findProduct(ctx.content, productId);
      if (!product) return { ok: false, reason: 'unknown_product' };
      if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, reason: 'invalid_quantity' };
      if (product.storage !== slot.accepts) return { ok: false, reason: 'storage_kind_mismatch' };
      const current = Object.hasOwn(economy.shelves, slotId) ? economy.shelves[slotId] : undefined;
      if (current && current.productId !== productId) return { ok: false, reason: 'slot_occupied_by_other_product' };
      const held = current?.quantity ?? 0;
      if (held + quantity > slotCapacityFor(ctx.content, slotId, productId)) return { ok: false, reason: 'slot_capacity_exceeded' };
      if (quantity > storageQuantity(state, productId)) return { ok: false, reason: 'insufficient_storage' };

      const left = assertCount(storageQuantity(state, productId) - quantity, 'storage');
      if (left === 0) delete economy.storage[productId];
      else economy.storage[productId] = left;
      economy.shelves[slotId] = { productId, quantity: held + quantity };
      stockChanged(productId);
      return { ok: true };
    },

    unstock(slotId, quantity) {
      const state = ctx.state();
      const { economy } = state;
      if (!findSlot(ctx.content, slotId)) return { ok: false, reason: 'unknown_slot' };
      if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, reason: 'invalid_quantity' };
      const current = Object.hasOwn(economy.shelves, slotId) ? economy.shelves[slotId] : undefined;
      if (!current) return { ok: false, reason: 'slot_empty' };
      if (quantity > current.quantity) return { ok: false, reason: 'insufficient_slot_stock' };
      if (quantity > freeStorageUnits(state)) return { ok: false, reason: 'storage_full' };

      const left = assertCount(current.quantity - quantity, 'slot stock');
      if (left === 0) delete economy.shelves[slotId];
      else economy.shelves[slotId] = { productId: current.productId, quantity: left };
      economy.storage[current.productId] = storageQuantity(state, current.productId) + quantity;
      stockChanged(current.productId);
      return { ok: true };
    },

    completeSale(request) {
      const state = ctx.state();
      const { economy } = state;
      const merged = mergeLines(ctx, request.lines, 'empty_cart');
      if (!merged.ok) return merged;
      const customerId = request.customer?.npcId;
      const customer =
        customerId !== undefined && Object.hasOwn(ctx.content.npcs, customerId) ? ctx.content.npcs[customerId] : undefined;
      if (request.customer && !customer) return { ok: false, reason: 'unknown_customer' };
      if (state.calendar.phase !== 'open') return { ok: false, reason: 'day_not_open' };
      if (!state.kiosk.shutterOpen) return { ok: false, reason: 'kiosk_closed' };
      const restricted = merged.lines.some((l) => findProduct(ctx.content, l.productId)?.minimumAge !== undefined);
      if (restricted && request.ageCheckConfirmed !== true) return { ok: false, reason: 'age_check_required' };
      if (customer) {
        const minimumAge = cartMinimumAge(ctx.content, merged.lines);
        if (minimumAge !== null && customer.age < minimumAge) return { ok: false, reason: 'customer_underage' };
      }
      for (const line of merged.lines) {
        if (line.quantity > shelfQuantity(state, line.productId)) return { ok: false, reason: 'insufficient_stock' };
      }

      // Everything is valid: compute, then mutate.
      let totalCents = 0;
      let costCents = 0;
      const transactionLines: TransactionLine[] = [];
      for (const line of merged.lines) {
        const product = findProduct(ctx.content, line.productId);
        const price = product?.suggestedPriceCents ?? 0;
        totalCents += price * line.quantity;
        costCents += (product?.purchasePriceCents ?? 0) * line.quantity;
        transactionLines.push({ productId: line.productId, quantity: line.quantity, unitPriceCents: price });
      }
      assertCount(totalCents, 'sale total');

      for (const line of merged.lines) {
        let remaining = line.quantity;
        for (const slot of ctx.content.stockSlots) {
          if (remaining === 0) break;
          const stock = Object.hasOwn(economy.shelves, slot.id) ? economy.shelves[slot.id] : undefined;
          if (!stock || stock.productId !== line.productId) continue;
          const taken = Math.min(stock.quantity, remaining);
          remaining -= taken;
          if (taken === stock.quantity) delete economy.shelves[slot.id];
          else economy.shelves[slot.id] = { productId: stock.productId, quantity: stock.quantity - taken };
        }
      }
      economy.cashCents += totalCents;
      economy.today.revenueCents += totalCents;
      economy.today.costOfGoodsSoldCents += costCents;
      economy.today.salesCount += 1;
      const transaction = recordTransaction(ctx, 'sale', transactionLines, totalCents, customer?.id);

      for (const line of merged.lines) stockChanged(line.productId);
      ctx.emit('money.changed', { cashCents: economy.cashCents });
      ctx.emit('sale.completed', {
        transactionId: transaction.id,
        totalCents,
        ...(customer ? { npcId: customer.id } : {}),
      });
      return { ok: true, transaction: structuredClone(transaction) };
    },

    closeDay() {
      const state = ctx.state();
      const { economy, calendar } = state;
      if (calendar.phase === 'closed') return { ok: false, reason: 'day_already_closed' };
      const { today } = economy;
      const report: DayReport = {
        day: calendar.day,
        revenueCents: today.revenueCents,
        costOfGoodsSoldCents: today.costOfGoodsSoldCents,
        purchaseCents: today.purchaseCents,
        grossProfitCents: today.revenueCents - today.costOfGoodsSoldCents,
        cashFlowCents: today.revenueCents - today.purchaseCents,
        cashEndCents: economy.cashCents,
        salesCount: today.salesCount,
        closedAtMinute: Math.floor(calendar.minute),
      };
      economy.lastReport = report;
      calendar.phase = 'closed';
      ctx.emit('calendar.changed', { paused: calendar.paused, speed: calendar.speed, phase: calendar.phase });
      ctx.emit('day.ended', { day: report.day });
      return { ok: true, report: structuredClone(report) };
    },
  };
}
