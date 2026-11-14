import { dateOfDay } from './date';
import { productMaxStack, slotCapacity } from './stockLayout';
import { STORAGE_CAPACITY_UNITS } from './balance';
import type { DeepReadonly, GameState, ProductLine } from './state';
import type { ContentPack, ProductDef, StockSlotDef } from './types';

/** Pure read helpers for the UI and the world. They never mutate. */

type State = DeepReadonly<GameState>;

export function findProduct(content: ContentPack, productId: string): ProductDef | undefined {
  return Object.hasOwn(content.products, productId) ? content.products[productId] : undefined;
}

export function findSlot(content: ContentPack, slotId: string): StockSlotDef | undefined {
  return content.stockSlots.find((s) => s.id === slotId);
}

/** Weekday index: 0 = Monday ... 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Weekday of a game day, derived from its calendar date (see `date.ts`; day 1 = START_DATE, a Monday). Not part of the
 * saved state. Invalid days fall back to day 1.
 */
export function weekdayOf(day: number): Weekday {
  return dateOfDay(day).weekday;
}

/** Units of a product in the back storage. */
export function storageQuantity(state: State, productId: string): number {
  return Object.hasOwn(state.economy.storage, productId) ? (state.economy.storage[productId] ?? 0) : 0;
}

/** Total units in the back storage. */
export function storageUnits(state: State): number {
  let total = 0;
  for (const quantity of Object.values(state.economy.storage)) total += quantity;
  return total;
}

/** Units of the pending delivery. */
export function pendingUnits(state: State): number {
  let total = 0;
  for (const line of state.economy.pendingDelivery?.lines ?? []) total += line.quantity;
  return total;
}

/** Units that can still be ordered or moved into the storage (pending delivery is reserved). */
export function freeStorageUnits(state: State): number {
  return Math.max(0, STORAGE_CAPACITY_UNITS - storageUnits(state) - pendingUnits(state));
}

/** Units of a product on presentation slots (the only stock that can be sold). */
export function shelfQuantity(state: State, productId: string): number {
  let total = 0;
  for (const stock of Object.values(state.economy.shelves)) {
    if (stock.productId === productId) total += stock.quantity;
  }
  return total;
}

/** How many units of the product the slot can hold; 0 for unknown ids or an incompatible storage kind. */
export function slotCapacityFor(content: ContentPack, slotId: string, productId: string): number {
  const slot = findSlot(content, slotId);
  const product = findProduct(content, productId);
  if (!slot || !product || product.storage !== slot.accepts) return 0;
  const asset = Object.hasOwn(content.assets, product.assetId) ? content.assets[product.assetId] : undefined;
  if (!asset) return 0;
  return slotCapacity(slot, asset.size, { maxStack: productMaxStack(product) });
}

/** Slots that accept this product's storage kind, in content order. */
export function slotsAccepting(content: ContentPack, productId: string): StockSlotDef[] {
  const product = findProduct(content, productId);
  if (!product) return [];
  return content.stockSlots.filter((s) => s.accepts === product.storage);
}

/** True when any line's product has a minimum age. Unknown products count as unrestricted here. */
export function cartNeedsAgeCheck(content: ContentPack, lines: readonly ProductLine[]): boolean {
  return lines.some((line) => findProduct(content, line.productId)?.minimumAge !== undefined);
}

/** Highest minimum age in the cart, or null when nothing is restricted. */
export function cartMinimumAge(content: ContentPack, lines: readonly ProductLine[]): number | null {
  let age: number | null = null;
  for (const line of lines) {
    const min = findProduct(content, line.productId)?.minimumAge;
    if (min !== undefined && (age === null || min > age)) age = min;
  }
  return age;
}

/** Sum of quantity x suggested price; unknown products count 0. */
export function cartTotalCents(content: ContentPack, lines: readonly ProductLine[]): number {
  let total = 0;
  for (const line of lines) total += line.quantity * (findProduct(content, line.productId)?.suggestedPriceCents ?? 0);
  return total;
}

/** Sum of quantity x purchase price; unknown products count 0. */
export function orderTotalCents(content: ContentPack, lines: readonly ProductLine[]): number {
  let total = 0;
  for (const line of lines) total += line.quantity * (findProduct(content, line.productId)?.purchasePriceCents ?? 0);
  return total;
}
