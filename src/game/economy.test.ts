import { describe, expect, it, vi } from 'vitest';
import { STORAGE_CAPACITY_UNITS, TRANSACTION_LIMIT } from './balance';
import { createGame, type Game } from './game';
import {
  cartMinimumAge,
  cartNeedsAgeCheck,
  cartTotalCents,
  freeStorageUnits,
  shelfQuantity,
  slotCapacityFor,
  slotsAccepting,
  storageQuantity,
  storageUnits,
} from './selectors';
import { createInitialState } from './state';
import { testPack } from './testing/fixture-pack';

const WATER = 'product.test-water'; // shelf, 40 -> 100
const COLA = 'product.test-cola'; // cooled, 55 -> 130
const BEER = 'product.test-beer'; // shelf, 16+, 70 -> 150
const TOBACCO = 'product.test-tobacco'; // counter, 18+, 520 -> 650
const SHELF_1 = 'slot.shelf-north-1';
const SHELF_2 = 'slot.shelf-north-2';
const COOLED = 'slot.cooled-west';
const COUNTER = 'slot.counter-top';

function setup(options: { shutterOpen?: boolean } = {}): Game {
  const state = createInitialState(testPack);
  state.kiosk.shutterOpen = options.shutterOpen ?? true;
  return createGame(testPack, state);
}

/** Orders and receives goods, then moves them to the slot. */
function stocked(slotId: string, productId: string, quantity: number, options: { shutterOpen?: boolean } = {}): Game {
  const game = setup(options);
  expect(game.economy.placeOrder([{ productId, quantity }]).ok).toBe(true);
  expect(game.economy.receiveDelivery().ok).toBe(true);
  expect(game.economy.restock(slotId, productId, quantity).ok).toBe(true);
  return game;
}

describe('start values', () => {
  it('starts with 300.00 EUR, empty storage and shelves, no order', () => {
    const { economy } = setup().state;
    expect(economy.cashCents).toBe(30000);
    expect(economy.storage).toEqual({});
    expect(economy.shelves).toEqual({});
    expect(economy.pendingDelivery).toBeNull();
    expect(economy.today).toEqual({ revenueCents: 0, purchaseCents: 0, costOfGoodsSoldCents: 0, salesCount: 0 });
    expect(economy.lastReport).toBeNull();
    expect(economy.transactions).toEqual([]);
  });
});

describe('order and delivery', () => {
  it('deducts cash, books a purchase and keeps the delivery pending', () => {
    const game = setup();
    const money = vi.fn();
    const placed = vi.fn();
    const stock = vi.fn();
    game.signals.on('money.changed', money);
    game.signals.on('order.placed', placed);
    game.signals.on('product.stock.changed', stock);
    expect(game.economy.placeOrder([{ productId: WATER, quantity: 10 }, { productId: BEER, quantity: 5 }])).toEqual({ ok: true });
    const { economy } = game.state;
    expect(economy.cashCents).toBe(30000 - 400 - 350);
    expect(economy.today.purchaseCents).toBe(750);
    expect(economy.pendingDelivery).toEqual({
      lines: [
        { productId: WATER, quantity: 10 },
        { productId: BEER, quantity: 5 },
      ],
      totalCents: 750,
    });
    expect(economy.storage).toEqual({});
    expect(economy.transactions).toEqual([
      {
        id: 1,
        day: 1,
        minute: 360,
        kind: 'purchase',
        lines: [
          { productId: WATER, quantity: 10, unitPriceCents: 40 },
          { productId: BEER, quantity: 5, unitPriceCents: 70 },
        ],
        totalCents: 750,
      },
    ]);
    expect(money).toHaveBeenCalledWith({ cashCents: 29250 });
    expect(placed).toHaveBeenCalledWith({ totalCents: 750 });
    expect(stock).not.toHaveBeenCalled();
  });

  it('merges duplicate lines', () => {
    const game = setup();
    game.economy.placeOrder([{ productId: WATER, quantity: 2 }, { productId: WATER, quantity: 3 }]);
    expect(game.state.economy.pendingDelivery?.lines).toEqual([{ productId: WATER, quantity: 5 }]);
  });

  it('rejects invalid orders without changing anything', () => {
    const game = setup();
    const before = structuredClone(game.state);
    expect(game.economy.placeOrder([])).toEqual({ ok: false, reason: 'empty_order' });
    expect(game.economy.placeOrder([{ productId: 'product.nope', quantity: 1 }])).toEqual({ ok: false, reason: 'unknown_product' });
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(game.economy.placeOrder([{ productId: WATER, quantity }])).toEqual({ ok: false, reason: 'invalid_quantity' });
    }
    expect(game.economy.placeOrder([{ productId: TOBACCO, quantity: 100 }])).toEqual({ ok: false, reason: 'insufficient_cash' });
    expect(game.state).toEqual(before);
  });

  it('allows an order that spends exactly all cash but never more', () => {
    const game = setup();
    // 30000 / 520 = 57.69
    expect(game.economy.placeOrder([{ productId: TOBACCO, quantity: 58 }]).ok).toBe(false);
    expect(game.economy.placeOrder([{ productId: TOBACCO, quantity: 57 }]).ok).toBe(true);
    expect(game.state.economy.cashCents).toBe(30000 - 57 * 520);
  });

  it('allows only one pending order', () => {
    const game = setup();
    game.economy.placeOrder([{ productId: WATER, quantity: 1 }]);
    expect(game.economy.placeOrder([{ productId: WATER, quantity: 1 }])).toEqual({ ok: false, reason: 'order_pending' });
  });

  it('respects the storage capacity, including the pending delivery', () => {
    const game = setup();
    expect(game.economy.placeOrder([{ productId: WATER, quantity: STORAGE_CAPACITY_UNITS + 1 }])).toEqual({
      ok: false,
      reason: 'storage_full',
    });
    expect(game.economy.placeOrder([{ productId: WATER, quantity: STORAGE_CAPACITY_UNITS }]).ok).toBe(true);
    expect(freeStorageUnits(game.state)).toBe(0);
    game.economy.receiveDelivery();
    expect(storageUnits(game.state)).toBe(STORAGE_CAPACITY_UNITS);
    expect(game.economy.placeOrder([{ productId: WATER, quantity: 1 }])).toEqual({ ok: false, reason: 'storage_full' });
  });

  it('reserves storage space for a pending delivery', () => {
    const game = stocked(SHELF_1, WATER, 20);
    game.economy.placeOrder([{ productId: WATER, quantity: STORAGE_CAPACITY_UNITS }]);
    expect(game.economy.unstock(SHELF_1, 1)).toEqual({ ok: false, reason: 'storage_full' });
  });

  it('is not possible once the day is closed, but works while awaiting close', () => {
    const game = setup();
    game.tick(1_000_000);
    expect(game.economy.placeOrder([{ productId: WATER, quantity: 1 }]).ok).toBe(true);
    game.economy.closeDay();
    const before = structuredClone(game.state);
    expect(game.economy.placeOrder([{ productId: WATER, quantity: 1 }])).toEqual({ ok: false, reason: 'day_closed' });
    expect(game.state).toEqual(before);
  });

  it('credits the delivery to the storage and clears it', () => {
    const game = setup();
    const stock = vi.fn();
    const received = vi.fn();
    game.signals.on('product.stock.changed', stock);
    game.signals.on('delivery.received', received);
    expect(game.economy.receiveDelivery()).toEqual({ ok: false, reason: 'no_delivery' });
    game.economy.placeOrder([{ productId: WATER, quantity: 10 }, { productId: COLA, quantity: 4 }]);
    expect(game.economy.receiveDelivery()).toEqual({ ok: true });
    expect(game.state.economy.storage).toEqual({ [WATER]: 10, [COLA]: 4 });
    expect(game.state.economy.pendingDelivery).toBeNull();
    expect(stock.mock.calls).toEqual([[{ productId: WATER }], [{ productId: COLA }]]);
    expect(received).toHaveBeenCalledWith({ totalCents: 620 });
    game.economy.placeOrder([{ productId: WATER, quantity: 5 }]);
    game.economy.receiveDelivery();
    expect(storageQuantity(game.state, WATER)).toBe(15);
  });
});

describe('restock and unstock', () => {
  function withStorage(): Game {
    const game = setup();
    game.economy.placeOrder([
      { productId: WATER, quantity: 100 },
      { productId: COLA, quantity: 10 },
      { productId: BEER, quantity: 10 },
      { productId: TOBACCO, quantity: 5 },
    ]);
    game.economy.receiveDelivery();
    return game;
  }

  it('moves goods from storage to a slot', () => {
    const game = withStorage();
    const stock = vi.fn();
    game.signals.on('product.stock.changed', stock);
    expect(game.economy.restock(SHELF_1, WATER, 20)).toEqual({ ok: true });
    expect(game.state.economy.shelves[SHELF_1]).toEqual({ productId: WATER, quantity: 20 });
    expect(storageQuantity(game.state, WATER)).toBe(80);
    expect(game.economy.restock(SHELF_1, WATER, 10).ok).toBe(true);
    expect(shelfQuantity(game.state, WATER)).toBe(30);
    expect(stock).toHaveBeenCalledTimes(2);
    expect(stock).toHaveBeenCalledWith({ productId: WATER });
  });

  it('removes the storage entry when it runs empty', () => {
    const game = withStorage();
    game.economy.restock(COOLED, COLA, 10);
    expect(game.state.economy.storage).not.toHaveProperty(COLA);
  });

  it('checks storage kind compatibility', () => {
    const game = withStorage();
    expect(game.economy.restock(COOLED, WATER, 1)).toEqual({ ok: false, reason: 'storage_kind_mismatch' });
    expect(game.economy.restock(SHELF_1, COLA, 1)).toEqual({ ok: false, reason: 'storage_kind_mismatch' });
    expect(game.economy.restock(SHELF_1, TOBACCO, 1)).toEqual({ ok: false, reason: 'storage_kind_mismatch' });
    expect(game.economy.restock(COUNTER, TOBACCO, 5)).toEqual({ ok: true });
  });

  it('rejects an unknown slot or product and invalid quantities', () => {
    const game = withStorage();
    expect(game.economy.restock('slot.nope', WATER, 1)).toEqual({ ok: false, reason: 'unknown_slot' });
    expect(game.economy.restock(SHELF_1, 'product.nope', 1)).toEqual({ ok: false, reason: 'unknown_product' });
    for (const q of [0, -3, 2.5]) expect(game.economy.restock(SHELF_1, WATER, q)).toEqual({ ok: false, reason: 'invalid_quantity' });
  });

  it('rejects a wrong product in an occupied slot', () => {
    const game = withStorage();
    game.economy.restock(SHELF_1, WATER, 5);
    const before = structuredClone(game.state);
    expect(game.economy.restock(SHELF_1, BEER, 1)).toEqual({ ok: false, reason: 'slot_occupied_by_other_product' });
    expect(game.state).toEqual(before);
    expect(game.economy.restock(SHELF_2, BEER, 1).ok).toBe(true);
  });

  it('never exceeds the slot capacity', () => {
    const game = withStorage();
    const capacity = slotCapacityFor(testPack, SHELF_1, WATER);
    expect(capacity).toBe(36);
    expect(game.economy.restock(SHELF_1, WATER, 37)).toEqual({ ok: false, reason: 'slot_capacity_exceeded' });
    expect(game.economy.restock(SHELF_1, WATER, 30).ok).toBe(true);
    expect(game.economy.restock(SHELF_1, WATER, 7)).toEqual({ ok: false, reason: 'slot_capacity_exceeded' });
    expect(game.economy.restock(SHELF_1, WATER, 6).ok).toBe(true);
    expect(game.state.economy.shelves[SHELF_1]?.quantity).toBe(capacity);
  });

  it('needs enough goods in storage', () => {
    const game = withStorage();
    const before = structuredClone(game.state);
    expect(game.economy.restock(SHELF_1, BEER, 11)).toEqual({ ok: false, reason: 'insufficient_storage' });
    expect(game.economy.restock(SHELF_1, 'product.test-water', 101)).toEqual({ ok: false, reason: 'slot_capacity_exceeded' });
    expect(game.state).toEqual(before);
  });

  it('unstocks back to the storage and frees the slot for another product', () => {
    const game = withStorage();
    game.economy.restock(SHELF_1, WATER, 10);
    expect(game.economy.unstock(SHELF_1, 4)).toEqual({ ok: true });
    expect(game.state.economy.shelves[SHELF_1]?.quantity).toBe(6);
    expect(storageQuantity(game.state, WATER)).toBe(94);
    expect(game.economy.unstock(SHELF_1, 7)).toEqual({ ok: false, reason: 'insufficient_slot_stock' });
    expect(game.economy.unstock(SHELF_1, 6).ok).toBe(true);
    expect(game.state.economy.shelves).toEqual({});
    expect(game.economy.unstock(SHELF_1, 1)).toEqual({ ok: false, reason: 'slot_empty' });
    expect(game.economy.unstock('slot.nope', 1)).toEqual({ ok: false, reason: 'unknown_slot' });
    expect(game.economy.unstock(SHELF_1, 0)).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(game.economy.restock(SHELF_1, BEER, 3).ok).toBe(true);
  });
});

describe('sale', () => {
  it('books stock, cash, revenue, cost of goods and a transaction', () => {
    const game = stocked(SHELF_1, WATER, 10);
    const stock = vi.fn();
    const money = vi.fn();
    const sold = vi.fn();
    game.signals.on('product.stock.changed', stock);
    game.signals.on('money.changed', money);
    game.signals.on('sale.completed', sold);
    const cashBefore = game.state.economy.cashCents;
    const result = game.economy.completeSale({ lines: [{ productId: WATER, quantity: 3 }], ageCheckConfirmed: false });
    expect(result).toEqual({
      ok: true,
      transaction: {
        id: 2,
        day: 1,
        minute: 360,
        kind: 'sale',
        lines: [{ productId: WATER, quantity: 3, unitPriceCents: 100 }],
        totalCents: 300,
      },
    });
    const { economy } = game.state;
    expect(shelfQuantity(game.state, WATER)).toBe(7);
    expect(economy.cashCents).toBe(cashBefore + 300);
    expect(economy.today).toMatchObject({ revenueCents: 300, costOfGoodsSoldCents: 120, salesCount: 1 });
    expect(economy.transactions.at(-1)?.kind).toBe('sale');
    expect(stock).toHaveBeenCalledWith({ productId: WATER });
    expect(money).toHaveBeenCalledWith({ cashCents: cashBefore + 300 });
    expect(sold).toHaveBeenCalledWith({ transactionId: 2, totalCents: 300 });
  });

  it('removes an emptied slot entry and sells across slots in content order', () => {
    const game = setup();
    game.economy.placeOrder([{ productId: WATER, quantity: 20 }]);
    game.economy.receiveDelivery();
    game.economy.restock(SHELF_2, WATER, 5);
    game.economy.restock(SHELF_1, WATER, 5);
    const result = game.economy.completeSale({ lines: [{ productId: WATER, quantity: 7 }], ageCheckConfirmed: false });
    expect(result.ok).toBe(true);
    expect(game.state.economy.shelves).toEqual({ [SHELF_2]: { productId: WATER, quantity: 3 } });
  });

  it('sells several products in one transaction', () => {
    const game = stocked(SHELF_1, WATER, 5);
    game.economy.placeOrder([{ productId: COLA, quantity: 5 }]);
    game.economy.receiveDelivery();
    game.economy.restock(COOLED, COLA, 5);
    const result = game.economy.completeSale({
      lines: [{ productId: WATER, quantity: 2 }, { productId: COLA, quantity: 1 }],
      ageCheckConfirmed: false,
    });
    expect(result.ok && result.transaction.totalCents).toBe(330);
    expect(game.state.economy.today.salesCount).toBe(1);
  });

  it('counts only shelf stock, never the storage', () => {
    const game = setup();
    game.economy.placeOrder([{ productId: WATER, quantity: 10 }]);
    game.economy.receiveDelivery();
    expect(game.economy.completeSale({ lines: [{ productId: WATER, quantity: 1 }], ageCheckConfirmed: false })).toEqual({
      ok: false,
      reason: 'insufficient_stock',
    });
  });

  it('rejects atomically: a failing second line leaves everything untouched', () => {
    const game = stocked(SHELF_1, WATER, 5);
    const before = structuredClone(game.state);
    const handler = vi.fn();
    game.signals.on('sale.completed', handler);
    game.signals.on('money.changed', handler);
    game.signals.on('product.stock.changed', handler);
    expect(
      game.economy.completeSale({
        lines: [{ productId: WATER, quantity: 2 }, { productId: WATER, quantity: 4 }],
        ageCheckConfirmed: false,
      }),
    ).toEqual({ ok: false, reason: 'insufficient_stock' });
    expect(game.state).toEqual(before);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects invalid carts with distinct reasons', () => {
    const game = stocked(SHELF_1, WATER, 5);
    const before = structuredClone(game.state);
    const sale = (lines: { productId: string; quantity: number }[]) => game.economy.completeSale({ lines, ageCheckConfirmed: true });
    expect(sale([])).toEqual({ ok: false, reason: 'empty_cart' });
    expect(sale([{ productId: 'product.nope', quantity: 1 }])).toEqual({ ok: false, reason: 'unknown_product' });
    expect(sale([{ productId: WATER, quantity: 0 }])).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(sale([{ productId: WATER, quantity: 1.5 }])).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(sale([{ productId: WATER, quantity: 6 }])).toEqual({ ok: false, reason: 'insufficient_stock' });
    expect(game.state).toEqual(before);
  });

  it('is blocked while the shutter is closed', () => {
    const game = stocked(SHELF_1, WATER, 5, { shutterOpen: false });
    const before = structuredClone(game.state);
    expect(game.economy.completeSale({ lines: [{ productId: WATER, quantity: 1 }], ageCheckConfirmed: false })).toEqual({
      ok: false,
      reason: 'kiosk_closed',
    });
    expect(game.state).toEqual(before);
  });

  it('is blocked in awaiting_close and closed', () => {
    const game = stocked(SHELF_1, WATER, 5);
    game.tick(1_000_000);
    const sale = { lines: [{ productId: WATER, quantity: 1 }], ageCheckConfirmed: false };
    expect(game.economy.completeSale(sale)).toEqual({ ok: false, reason: 'day_not_open' });
    game.economy.closeDay();
    expect(game.economy.completeSale(sale)).toEqual({ ok: false, reason: 'day_not_open' });
    expect(shelfQuantity(game.state, WATER)).toBe(5);
  });
});

describe('age check', () => {
  it.each([
    [BEER, SHELF_1],
    [TOBACCO, COUNTER],
  ])('blocks %s without confirmation, sells with it, and does not remember it', (productId, slotId) => {
    const game = stocked(slotId, productId, 4);
    const before = structuredClone(game.state);
    const sale = (confirmed: boolean) =>
      game.economy.completeSale({ lines: [{ productId, quantity: 1 }], ageCheckConfirmed: confirmed });
    expect(sale(false)).toEqual({ ok: false, reason: 'age_check_required' });
    expect(game.state).toEqual(before);
    expect(sale(true).ok).toBe(true);
    expect(sale(false)).toEqual({ ok: false, reason: 'age_check_required' });
    expect(JSON.stringify(game.save().state)).not.toMatch(/ageCheck/i);
  });

  it('blocks a mixed cart as a whole and lets unrestricted goods through unchecked', () => {
    const game = stocked(SHELF_1, WATER, 5);
    game.economy.placeOrder([{ productId: BEER, quantity: 5 }]);
    game.economy.receiveDelivery();
    game.economy.restock(SHELF_2, BEER, 5);
    const mixed = [{ productId: WATER, quantity: 1 }, { productId: BEER, quantity: 1 }];
    expect(game.economy.completeSale({ lines: mixed, ageCheckConfirmed: false }).ok).toBe(false);
    expect(game.economy.completeSale({ lines: [mixed[0]!], ageCheckConfirmed: false }).ok).toBe(true);
    expect(game.economy.completeSale({ lines: mixed, ageCheckConfirmed: true }).ok).toBe(true);
  });

  it('derives the restriction from the product data only', () => {
    const cart = (productId: string) => [{ productId, quantity: 1 }];
    expect(cartNeedsAgeCheck(testPack, cart(WATER))).toBe(false);
    expect(cartNeedsAgeCheck(testPack, cart(BEER))).toBe(true);
    expect(cartMinimumAge(testPack, cart(WATER))).toBeNull();
    expect(cartMinimumAge(testPack, [...cart(BEER), ...cart(TOBACCO)])).toBe(18);
  });
});

describe('selectors', () => {
  it('computes totals, slots and capacities', () => {
    expect(cartTotalCents(testPack, [{ productId: WATER, quantity: 3 }, { productId: BEER, quantity: 2 }])).toBe(600);
    expect(slotsAccepting(testPack, WATER).map((s) => s.id)).toEqual([SHELF_1, SHELF_2]);
    expect(slotsAccepting(testPack, 'product.nope')).toEqual([]);
    expect(slotCapacityFor(testPack, COOLED, COLA)).toBeGreaterThan(0);
    expect(slotCapacityFor(testPack, COOLED, WATER)).toBe(0);
    expect(slotCapacityFor(testPack, 'slot.nope', WATER)).toBe(0);
  });
});

describe('day report and transactions', () => {
  it('reports the day exactly and resets the totals for the next day', () => {
    const game = stocked(SHELF_1, WATER, 10);
    game.economy.completeSale({ lines: [{ productId: WATER, quantity: 4 }], ageCheckConfirmed: false });
    game.tick(100);
    const closed = vi.fn();
    game.signals.on('day.ended', closed);
    const result = game.economy.closeDay();
    expect(result).toEqual({
      ok: true,
      report: {
        day: 1,
        revenueCents: 400,
        costOfGoodsSoldCents: 160,
        purchaseCents: 400,
        grossProfitCents: 240,
        cashFlowCents: 0,
        cashEndCents: 30000,
        salesCount: 1,
        closedAtMinute: 460,
      },
    });
    expect(game.state.economy.lastReport).toEqual(result.ok ? result.report : null);
    expect(game.state.economy.cashCents).toBe(30000); // no hidden money
    expect(shelfQuantity(game.state, WATER)).toBe(6); // no automatic restocking
    expect(closed).toHaveBeenCalledWith({ day: 1 });
    game.calendar.startNextDay();
    expect(game.state.economy.today).toEqual({ revenueCents: 0, purchaseCents: 0, costOfGoodsSoldCents: 0, salesCount: 0 });
    expect(game.state.economy.lastReport?.day).toBe(1);
    expect(game.state.economy.cashCents).toBe(30000);
  });

  it('can report a loss (negative gross profit / cash flow stay integers)', () => {
    const game = setup();
    game.economy.placeOrder([{ productId: TOBACCO, quantity: 10 }]);
    const result = game.economy.closeDay();
    expect(result.ok && result.report.cashFlowCents).toBe(-5200);
  });

  it('keeps only the newest transactions with increasing ids', () => {
    const game = setup();
    const total = TRANSACTION_LIMIT + 25;
    for (let i = 0; i < total; i += 1) {
      expect(game.economy.placeOrder([{ productId: WATER, quantity: 1 }]).ok).toBe(true);
      game.economy.receiveDelivery();
    }
    const { transactions, nextTransactionId } = game.state.economy;
    expect(transactions).toHaveLength(TRANSACTION_LIMIT);
    expect(transactions[0]?.id).toBe(total - TRANSACTION_LIMIT + 1);
    expect(transactions.at(-1)?.id).toBe(total);
    expect(nextTransactionId).toBe(total + 1);
  });
});

describe('invariants', () => {
  it('keeps money and quantities non-negative integers through a long random session', () => {
    const game = setup();
    let seed = 12345;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const products = [WATER, COLA, BEER, TOBACCO];
    const slots = [SHELF_1, SHELF_2, COOLED, COUNTER];
    for (let i = 0; i < 2000; i += 1) {
      const productId = products[rnd(4)]!;
      const slotId = slots[rnd(4)]!;
      switch (rnd(5)) {
        case 0:
          game.economy.placeOrder([{ productId, quantity: 1 + rnd(40) }]);
          break;
        case 1:
          game.economy.receiveDelivery();
          break;
        case 2:
          game.economy.restock(slotId, productId, 1 + rnd(30));
          break;
        case 3:
          game.economy.unstock(slotId, 1 + rnd(30));
          break;
        default:
          game.economy.completeSale({ lines: [{ productId, quantity: 1 + rnd(5) }], ageCheckConfirmed: rnd(2) === 0 });
      }
      const { economy } = game.state;
      expect(Number.isSafeInteger(economy.cashCents) && economy.cashCents >= 0).toBe(true);
      expect(storageUnits(game.state) + (economy.pendingDelivery?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0)).toBeLessThanOrEqual(
        STORAGE_CAPACITY_UNITS,
      );
      for (const q of Object.values(economy.storage)) expect(Number.isInteger(q) && q > 0).toBe(true);
      for (const [slotKey, stock] of Object.entries(economy.shelves)) {
        expect(stock.quantity).toBeGreaterThan(0);
        expect(stock.quantity).toBeLessThanOrEqual(slotCapacityFor(testPack, slotKey, stock.productId));
      }
    }
  });
});
