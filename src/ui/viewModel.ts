import { findProduct } from '../game/selectors';
import type { ContentPack, ProductDef, StockSlotDef } from '../game/types';
import { texts } from './texts';

/** Pure view-model helpers (DOM-free) used by the panels. */

export const MAX_QUANTITY_INPUT = 999;

/** Maps a game rejection reason to a German message; unknown reasons get a generic one. */
export function reasonText(reason: string): string {
  return Object.hasOwn(texts.reasons, reason) ? (texts.reasons[reason] ?? texts.reasonFallback) : texts.reasonFallback;
}

/** "ab 16" / "ab 18" or null for unrestricted products. */
export function ageLabel(minimumAge: number | undefined): string | null {
  return minimumAge === undefined ? null : texts.product.age(minimumAge);
}

/** "Getränke" or "Getränke · Bier". */
export function categoryLabel(product: Pick<ProductDef, 'category' | 'subcategory'>): string {
  const base = texts.product.category[product.category];
  return product.subcategory ? `${base} · ${texts.product.subcategory[product.subcategory]}` : base;
}

export function storageKindLabel(kind: ProductDef['storage']): string {
  return texts.product.storage[kind];
}

/** All products in content order. */
export function productList(content: ContentPack): ProductDef[] {
  return Object.values(content.products);
}

/** Parses a user-typed quantity; anything that is not a non-negative whole number becomes 0; capped at MAX_QUANTITY_INPUT. */
export function parseQuantity(text: string): number {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return 0;
  return Math.min(Number.parseInt(trimmed, 10), MAX_QUANTITY_INPUT);
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), Math.max(min, max));
}

export interface CartLineView {
  productId: string;
  name: string;
  quantity: number;
  unitCents: number;
  lineCents: number;
  minimumAge: number | undefined;
}

export interface CartView {
  lines: CartLineView[];
  totalCents: number;
  units: number;
  /** Highest minimum age in the cart, null when unrestricted. Derived from product data only. */
  minimumAge: number | null;
}

/** Cart (product id -> quantity) with line and total amounts from integer cents; unknown products are dropped. */
export function buildCartView(content: ContentPack, cart: ReadonlyMap<string, number>): CartView {
  const lines: CartLineView[] = [];
  let totalCents = 0;
  let units = 0;
  let minimumAge: number | null = null;
  for (const [productId, quantity] of cart) {
    const product = findProduct(content, productId);
    if (!product || quantity <= 0) continue;
    const lineCents = quantity * product.suggestedPriceCents;
    lines.push({
      productId,
      name: product.name,
      quantity,
      unitCents: product.suggestedPriceCents,
      lineCents,
      minimumAge: product.minimumAge,
    });
    totalCents += lineCents;
    units += quantity;
    if (product.minimumAge !== undefined && (minimumAge === null || product.minimumAge > minimumAge)) {
      minimumAge = product.minimumAge;
    }
  }
  return { lines, totalCents, units, minimumAge };
}

/** Drops cart entries that exceed the available shelf stock (cart never holds more than the shelf). */
export function clampCart(cart: Map<string, number>, available: (productId: string) => number): void {
  for (const [productId, quantity] of [...cart]) {
    const max = available(productId);
    const next = clampInt(quantity, 0, max);
    if (next <= 0) cart.delete(productId);
    else if (next !== quantity) cart.set(productId, next);
  }
}

export interface OrderSummary {
  units: number;
  totalCents: number;
  cashAfterCents: number;
  freeUnitsAfter: number;
  /** Informational only; the game decides. */
  affordable: boolean;
  fitsStorage: boolean;
}

export function summarizeOrder(
  content: ContentPack,
  quantities: ReadonlyMap<string, number>,
  cashCents: number,
  freeUnits: number,
): OrderSummary {
  let units = 0;
  let totalCents = 0;
  for (const [productId, quantity] of quantities) {
    const product = findProduct(content, productId);
    if (!product || quantity <= 0) continue;
    units += quantity;
    totalCents += quantity * product.purchasePriceCents;
  }
  return {
    units,
    totalCents,
    cashAfterCents: cashCents - totalCents,
    freeUnitsAfter: freeUnits - units,
    affordable: totalCents <= cashCents,
    fitsStorage: units <= freeUnits,
  };
}

const DIRECTION_WORDS: Readonly<Record<string, string>> = {
  north: 'Nord',
  south: 'Süd',
  east: 'Ost',
  west: 'West',
  middle: 'Mitte',
  inside: 'innen',
  yard: 'Hof',
};

/** Readable name of a placement: asset name, plus a direction word or number when several placements share the asset. */
export function placementLabel(content: ContentPack, placementId: string): string {
  const placements = content.layout.placements;
  const placement = placements.find((p) => p.id === placementId);
  if (!placement) return placementId;
  const name = Object.hasOwn(content.assets, placement.assetId)
    ? (content.assets[placement.assetId]?.name ?? placementId)
    : placementId;
  const same = placements.filter((p) => p.assetId === placement.assetId);
  if (same.length <= 1) return name;
  const word = (id: string): string | undefined => {
    const token = id.split(/[.-]/).pop() ?? '';
    return Object.hasOwn(DIRECTION_WORDS, token) ? DIRECTION_WORDS[token] : undefined;
  };
  const mine = word(placement.id);
  const unique = mine !== undefined && same.filter((p) => word(p.id) === mine).length === 1;
  if (unique) return `${name} ${mine}`;
  return `${name} ${same.indexOf(placement) + 1}`;
}

/** "Wandregal Nord · Platz 3"; the "Platz n" part is omitted for placements with a single slot. */
export function slotLabel(content: ContentPack, slot: Pick<StockSlotDef, 'id' | 'placementId'>): string {
  const base = placementLabel(content, slot.placementId);
  const siblings = content.stockSlots.filter((s) => s.placementId === slot.placementId);
  if (siblings.length <= 1) return base;
  const index = siblings.findIndex((s) => s.id === slot.id);
  return texts.goods.restock.slotLabel(base, index + 1);
}

/** Slots grouped by placement in content order (group order = first appearance). */
export function groupSlotsByPlacement(content: ContentPack): { placementId: string; label: string; slots: StockSlotDef[] }[] {
  const groups = new Map<string, StockSlotDef[]>();
  for (const slot of content.stockSlots) {
    const list = groups.get(slot.placementId);
    if (list) list.push(slot);
    else groups.set(slot.placementId, [slot]);
  }
  return [...groups].map(([placementId, slots]) => ({ placementId, label: placementLabel(content, placementId), slots }));
}

/** Default restock amount: as many as fit and are available. */
export function defaultRestockQuantity(storageQuantity: number, capacity: number, held: number): number {
  return Math.max(0, Math.min(storageQuantity, capacity - held));
}
