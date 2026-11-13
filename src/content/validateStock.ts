import { placementBaseHeight, placementFootprint } from '../game/placement';
import { productMaxStack, slotCapacity } from '../game/stockLayout';
import type {
  ContentPack,
  PackageKind,
  PlacementDef,
  PlacementRole,
  ProductCategory,
  ProductSubcategory,
  Rect,
  StockSlotDef,
  StorageKind,
} from '../game/types';

/** The single place that says which storage kinds a placement role may present. */
export const STORAGE_KINDS_BY_ROLE: Readonly<Record<PlacementRole, readonly StorageKind[]>> = {
  sales: ['counter'],
  checkout: [],
  display: ['shelf', 'press'],
  cooling: ['cooled'],
  freezing: ['frozen'],
  storage: [],
  returns: [],
};

const STORAGE_KINDS: readonly string[] = ['shelf', 'cooled', 'frozen', 'counter', 'press'];
const CATEGORIES: readonly ProductCategory[] = ['drink', 'snack', 'sweet', 'icecream', 'bakery', 'press', 'everyday'];
const SUBCATEGORIES: readonly ProductSubcategory[] = ['beer', 'tobacco'];
const PACKAGES: readonly PackageKind[] = [
  'glass-bottle', 'pet-bottle', 'can', 'bag', 'bar', 'box', 'ice-stick', 'ice-cup', 'pastry', 'magazine',
];
const HEX = /^#[0-9a-fA-F]{6}$/;
const EPS = 1e-9;

/** Rect of a world-space footprint expressed in the local frame of a placement (quarter turns only). */
function toLocalRect(world: Rect, holder: PlacementDef): Rect {
  const rad = (holder.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  const xs: number[] = [];
  const zs: number[] = [];
  for (const wx of [world.minX, world.maxX]) {
    for (const wz of [world.minZ, world.maxZ]) {
      const dx = wx - holder.position.x;
      const dz = wz - holder.position.z;
      xs.push(dx * cos - dz * sin);
      zs.push(dx * sin + dz * cos);
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

const slotRect = (s: StockSlotDef): Rect => ({
  minX: s.origin.x - s.size.width / 2,
  maxX: s.origin.x + s.size.width / 2,
  minZ: s.origin.z - s.size.depth / 2,
  maxZ: s.origin.z + s.size.depth / 2,
});

const overlap1 = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 - EPS && b0 < a1 - EPS;
const rectsOverlapStrict = (a: Rect, b: Rect): boolean =>
  overlap1(a.minX, a.maxX, b.minX, b.maxX) && overlap1(a.minZ, a.maxZ, b.minZ, b.maxZ);

function validateProducts(pack: ContentPack, errors: string[]): void {
  const seen = new Set<string>();
  const assetUsers = new Map<string, string[]>();
  for (const [key, p] of Object.entries(pack.products)) {
    const tag = `product "${key}"`;
    if (p.id !== key) errors.push(`${tag}: catalog key does not match its id "${p.id}"`);
    if (!p.id.startsWith('product.')) errors.push(`product id "${p.id}" must start with "product."`);
    if (seen.has(p.id)) errors.push(`duplicate product id "${p.id}"`);
    seen.add(p.id);
    if (p.name.trim() === '') errors.push(`${tag}: name must not be empty`);
    if (p.brand.trim() === '') errors.push(`${tag}: brand must not be empty`);
    for (const [field, value] of [['purchasePriceCents', p.purchasePriceCents], ['suggestedPriceCents', p.suggestedPriceCents]] as const) {
      if (!Number.isSafeInteger(value) || value <= 0) errors.push(`${tag}: ${field} ${value} must be a positive safe integer`);
    }
    if (p.purchasePriceCents >= p.suggestedPriceCents) errors.push(`${tag}: purchase price must be lower than the suggested price`);
    if (!CATEGORIES.includes(p.category)) errors.push(`${tag}: unknown category "${p.category}"`);
    if (p.subcategory !== undefined && !SUBCATEGORIES.includes(p.subcategory)) errors.push(`${tag}: unknown subcategory "${p.subcategory}"`);
    if (!STORAGE_KINDS.includes(p.storage)) errors.push(`${tag}: unknown storage kind "${p.storage}"`);
    if (!PACKAGES.includes(p.package)) errors.push(`${tag}: unknown package kind "${p.package}"`);
    if (p.minimumAge !== undefined && p.minimumAge !== 16 && p.minimumAge !== 18) {
      errors.push(`${tag}: minimumAge ${p.minimumAge} must be 16 or 18`);
    }
    if (p.subcategory !== undefined && p.minimumAge === undefined) errors.push(`${tag}: subcategory "${p.subcategory}" requires a minimumAge`);
    if (p.maxStack !== undefined && (!Number.isInteger(p.maxStack) || p.maxStack < 1)) errors.push(`${tag}: maxStack must be a positive integer`);
    if (p.demandTags.some((t) => t.trim() === '')) errors.push(`${tag}: demandTags must not contain empty tags`);
    if (!HEX.test(p.label.primaryColor)) errors.push(`${tag}: label primaryColor "${p.label.primaryColor}" must be #rrggbb`);
    if (!HEX.test(p.label.accentColor)) errors.push(`${tag}: label accentColor "${p.label.accentColor}" must be #rrggbb`);
    if (p.label.text.trim() === '') errors.push(`${tag}: label text must not be empty`);

    const asset = Object.hasOwn(pack.assets, p.assetId) ? pack.assets[p.assetId] : undefined;
    if (!asset) errors.push(`${tag}: unknown asset "${p.assetId}"`);
    else if (asset.category !== 'product') errors.push(`${tag}: asset "${p.assetId}" has category "${asset.category}", expected "product"`);
    assetUsers.set(p.assetId, [...(assetUsers.get(p.assetId) ?? []), p.id]);
  }
  for (const [assetId, users] of assetUsers) {
    if (users.length > 1) errors.push(`asset "${assetId}" is used by more than one product: ${users.join(', ')}`);
  }
  for (const asset of Object.values(pack.assets)) {
    if (asset.category === 'product' && !assetUsers.has(asset.assetId)) errors.push(`product asset "${asset.assetId}" is not used by any product`);
  }

  // Every product needs at least one compatible slot that holds at least one unit.
  for (const p of Object.values(pack.products)) {
    const asset = Object.hasOwn(pack.assets, p.assetId) ? pack.assets[p.assetId] : undefined;
    if (!asset || !STORAGE_KINDS.includes(p.storage)) continue;
    const fits = pack.stockSlots.some(
      (s) => s.accepts === p.storage && slotCapacity(s, asset.size, { maxStack: productMaxStack(p) }) >= 1,
    );
    if (!fits) errors.push(`product "${p.id}" has no compatible "${p.storage}" slot with capacity >= 1`);
  }
}

function validateSlots(pack: ContentPack, errors: string[]): void {
  const { layout, assets } = pack;
  const ids = new Set<string>();
  const byPlacement = new Map<string, StockSlotDef[]>();
  for (const s of pack.stockSlots) {
    if (!s.id.startsWith('slot.')) errors.push(`slot id "${s.id}" must start with "slot."`);
    if (ids.has(s.id)) errors.push(`duplicate slot id "${s.id}"`);
    ids.add(s.id);
    const { width, depth, height } = s.size;
    if (!(width > 0 && depth > 0 && height > 0)) errors.push(`slot "${s.id}" size must be positive in all dimensions`);
    if (!STORAGE_KINDS.includes(s.accepts)) errors.push(`slot "${s.id}" accepts unknown storage kind "${s.accepts}"`);

    const placement = layout.placements.find((p) => p.id === s.placementId);
    if (!placement) {
      errors.push(`slot "${s.id}" references unknown placement "${s.placementId}"`);
      continue;
    }
    byPlacement.set(placement.id, [...(byPlacement.get(placement.id) ?? []), s]);
    const asset = assets[placement.assetId];
    if (!asset) continue;

    const role = placement.role ?? asset.defaultRole;
    const allowed = role === undefined ? [] : STORAGE_KINDS_BY_ROLE[role];
    if (!allowed.includes(s.accepts)) {
      errors.push(`slot "${s.id}" accepts "${s.accepts}", which placement "${placement.id}" (role ${role ?? 'none'}) cannot present`);
    }
    const r = slotRect(s);
    if (r.minX < -asset.size.width / 2 - EPS || r.maxX > asset.size.width / 2 + EPS || r.minZ < -asset.size.depth / 2 - EPS || r.maxZ > asset.size.depth / 2 + EPS) {
      errors.push(`slot "${s.id}" lies outside the bounds of asset "${asset.assetId}" (placement "${placement.id}")`);
    }
    if (s.origin.y < 0) errors.push(`slot "${s.id}" starts below the base of its placement`);

    // Placements standing on this one (register on the counter) must stay free.
    for (const other of layout.placements) {
      const otherAsset = assets[other.assetId];
      if (other.on !== placement.id || !otherAsset) continue;
      const local = toLocalRect(placementFootprint(other, otherAsset), placement);
      const base = placementBaseHeight(other, layout, assets) - placementBaseHeight(placement, layout, assets);
      if (rectsOverlapStrict(r, local) && overlap1(s.origin.y, s.origin.y + height, base, base + otherAsset.size.height)) {
        errors.push(`slot "${s.id}" collides with placement "${other.id}" standing on "${placement.id}"`);
      }
    }
  }

  for (const [placementId, slots] of byPlacement) {
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const a = slots[i];
        const b = slots[j];
        if (a && b && rectsOverlapStrict(slotRect(a), slotRect(b)) && overlap1(a.origin.y, a.origin.y + a.size.height, b.origin.y, b.origin.y + b.size.height)) {
          errors.push(`slots "${a.id}" and "${b.id}" of placement "${placementId}" overlap`);
        }
      }
    }
  }
}

/** Product catalog and stock slot rules (see validateContent). */
export function validateStock(pack: ContentPack): string[] {
  const errors: string[] = [];
  validateProducts(pack, errors);
  validateSlots(pack, errors);
  return errors;
}
