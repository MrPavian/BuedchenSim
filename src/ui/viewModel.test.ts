import { describe, expect, it } from 'vitest';
import { testPack } from '../game/testing/fixture-pack';
import {
  ageLabel,
  buildCartView,
  categoryLabel,
  clampCart,
  clampInt,
  defaultRestockQuantity,
  groupSlotsByPlacement,
  parseQuantity,
  placementLabel,
  reasonText,
  slotLabel,
  summarizeOrder,
} from './viewModel';
import { texts } from './texts';

describe('reasonText', () => {
  it('maps known reasons and falls back for unknown ones', () => {
    expect(reasonText('age_check_required')).toContain('Altersprüfung');
    expect(reasonText('insufficient_cash')).toBe(texts.reasons.insufficient_cash);
    expect(reasonText('something_new')).toBe(texts.reasonFallback);
    expect(reasonText('constructor')).toBe(texts.reasonFallback);
    expect(reasonText('toString')).toBe(texts.reasonFallback);
  });
  it('covers every reason the economy and calendar actions can return', () => {
    const reasons = [
      'day_closed', 'empty_order', 'invalid_quantity', 'unknown_product', 'order_pending', 'insufficient_cash',
      'storage_full', 'no_delivery', 'unknown_slot', 'storage_kind_mismatch', 'slot_occupied_by_other_product',
      'slot_capacity_exceeded', 'insufficient_storage', 'slot_empty', 'insufficient_slot_stock', 'empty_cart',
      'day_not_open', 'kiosk_closed', 'age_check_required', 'insufficient_stock', 'day_already_closed',
      'invalid_speed', 'day_not_closed', 'nothing_in_range',
    ];
    for (const reason of reasons) expect(Object.hasOwn(texts.reasons, reason), reason).toBe(true);
  });
});

describe('labels', () => {
  it('shows age labels only for restricted products', () => {
    expect(ageLabel(16)).toBe('ab 16');
    expect(ageLabel(18)).toBe('ab 18');
    expect(ageLabel(undefined)).toBeNull();
  });
  it('joins category and subcategory', () => {
    expect(categoryLabel({ category: 'drink' })).toBe('Getränke');
    expect(categoryLabel({ category: 'drink', subcategory: 'beer' })).toBe('Getränke · Bier');
    expect(categoryLabel({ category: 'everyday', subcategory: 'tobacco' })).toBe('Alltagsbedarf · Tabakwaren');
  });
});

describe('quantities', () => {
  it('parses only whole numbers', () => {
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity(' 7 ')).toBe(7);
    expect(parseQuantity('-3')).toBe(0);
    expect(parseQuantity('2,5')).toBe(0);
    expect(parseQuantity('')).toBe(0);
    expect(parseQuantity('99999')).toBe(999);
  });
  it('clamps integers', () => {
    expect(clampInt(5, 0, 3)).toBe(3);
    expect(clampInt(-1, 0, 3)).toBe(0);
    expect(clampInt(Number.NaN, 0, 3)).toBe(0);
    expect(clampInt(2.9, 0, 3)).toBe(2);
    expect(clampInt(2, 0, -4)).toBe(0);
  });
  it('default restock fills what fits and is available', () => {
    expect(defaultRestockQuantity(10, 24, 4)).toBe(10);
    expect(defaultRestockQuantity(50, 24, 4)).toBe(20);
    expect(defaultRestockQuantity(5, 4, 4)).toBe(0);
  });
});

describe('cart view', () => {
  const water = 'product.test-water';
  const beer = 'product.test-beer';
  const tobacco = 'product.test-tobacco';
  it('computes line and total amounts from integer cents', () => {
    const view = buildCartView(testPack, new Map([[water, 3], [beer, 2]]));
    expect(view.lines.map((l) => l.lineCents)).toEqual([300, 300]);
    expect(view.totalCents).toBe(600);
    expect(view.units).toBe(5);
    expect(view.minimumAge).toBe(16);
  });
  it('takes the highest minimum age and ignores unknown or empty lines', () => {
    const view = buildCartView(testPack, new Map([[beer, 1], [tobacco, 1], ['product.nope', 4], [water, 0]]));
    expect(view.minimumAge).toBe(18);
    expect(view.lines).toHaveLength(2);
    expect(view.totalCents).toBe(150 + 650);
  });
  it('an unrestricted cart has no minimum age', () => {
    expect(buildCartView(testPack, new Map([[water, 1]])).minimumAge).toBeNull();
    expect(buildCartView(testPack, new Map()).totalCents).toBe(0);
  });
  it('clampCart never exceeds shelf stock and drops empty lines', () => {
    const cart = new Map([[water, 9], [beer, 2], [tobacco, 1]]);
    clampCart(cart, (id) => (id === water ? 4 : id === beer ? 2 : 0));
    expect([...cart]).toEqual([[water, 4], [beer, 2]]);
  });
});

describe('order summary', () => {
  it('sums purchase prices and reports cash after the order and storage left', () => {
    const summary = summarizeOrder(testPack, new Map([['product.test-water', 10], ['product.test-cola', 5]]), 10000, 100);
    expect(summary.units).toBe(15);
    expect(summary.totalCents).toBe(10 * 40 + 5 * 55);
    expect(summary.cashAfterCents).toBe(10000 - 675);
    expect(summary.freeUnitsAfter).toBe(85);
    expect(summary.affordable).toBe(true);
    expect(summary.fitsStorage).toBe(true);
  });
  it('flags unaffordable and oversized orders', () => {
    const summary = summarizeOrder(testPack, new Map([['product.test-tobacco', 10]]), 1000, 5);
    expect(summary.affordable).toBe(false);
    expect(summary.cashAfterCents).toBeLessThan(0);
    expect(summary.fitsStorage).toBe(false);
  });
});

describe('slot labels', () => {
  it('derives readable names from placement and slot data', () => {
    expect(placementLabel(testPack, 'placement.wall-shelf-north')).toBe('Test wall shelf Nord');
    expect(placementLabel(testPack, 'placement.wall-shelf-west')).toBe('Test wall shelf West');
    expect(placementLabel(testPack, 'placement.counter')).toBe('Test counter');
    expect(placementLabel(testPack, 'placement.unknown')).toBe('placement.unknown');
  });
  it('numbers slots only when a placement has several', () => {
    const slots = testPack.stockSlots;
    expect(slotLabel(testPack, slots[0]!)).toBe('Test wall shelf Nord · Platz 1');
    expect(slotLabel(testPack, slots[1]!)).toBe('Test wall shelf Nord · Platz 2');
    expect(slotLabel(testPack, slots[2]!)).toBe('Test wall shelf West');
    expect(slotLabel(testPack, slots[3]!)).toBe('Test counter');
  });
  it('groups slots by placement in content order', () => {
    const groups = groupSlotsByPlacement(testPack);
    expect(groups.map((g) => g.placementId)).toEqual([
      'placement.wall-shelf-north',
      'placement.wall-shelf-west',
      'placement.counter',
    ]);
    expect(groups[0]?.slots).toHaveLength(2);
  });
});
