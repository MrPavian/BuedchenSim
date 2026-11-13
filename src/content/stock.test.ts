import { describe, expect, it } from 'vitest';
import { START_CASH_CENTS } from '../game/balance';
import { findAvailableInteraction } from '../game/interaction';
import { productMaxStack, slotCapacity } from '../game/stockLayout';
import type { ContentPack, PlacementDef, ProductDef, StockSlotDef } from '../game/types';
import { ruhrgebietPack } from './regions/ruhrgebiet';
import { validateContent } from './validate';

function broken(mutate: (pack: ContentPack) => void): string[] {
  const pack = structuredClone(ruhrgebietPack);
  mutate(pack);
  return validateContent(pack);
}
const has = (errors: string[], ...needles: string[]) =>
  expect(errors.some((e) => needles.every((n) => e.includes(n))), errors.join('\n')).toBe(true);

const product = (pack: ContentPack, id: string): ProductDef => {
  const p = pack.products[id];
  if (!p) throw new Error(`fixture missing: ${id}`);
  return p;
};
const slot = (pack: ContentPack, id: string): StockSlotDef => {
  const s = pack.stockSlots.find((x) => x.id === id);
  if (!s) throw new Error(`fixture missing: ${id}`);
  return s;
};
const WATER = 'product.ruhrbrause-wasser-still';
const PILS = 'product.puettbraeu-pils';

const products = Object.values(ruhrgebietPack.products);

describe('product catalog', () => {
  it('validates with zero errors', () => {
    expect(validateContent(ruhrgebietPack)).toEqual([]);
  });

  it('has the expected shape', () => {
    expect(products.length).toBeGreaterThanOrEqual(24);
    expect(products.length).toBeLessThanOrEqual(28);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    for (const p of products) {
      expect(Number.isInteger(p.purchasePriceCents) && Number.isInteger(p.suggestedPriceCents), p.id).toBe(true);
      expect(p.purchasePriceCents, p.id).toBeLessThan(p.suggestedPriceCents);
    }
    const cats = new Set(products.map((p) => p.category));
    for (const c of ['drink', 'snack', 'sweet', 'icecream', 'bakery', 'press', 'everyday'] as const) expect(cats.has(c), c).toBe(true);
    expect(products.filter((p) => p.subcategory === 'beer')).toHaveLength(2);
    expect(products.filter((p) => p.subcategory === 'tobacco')).toHaveLength(2);
    expect(products.filter((p) => p.category === 'press')).toHaveLength(3);
    expect(products.filter((p) => p.category === 'icecream').every((p) => p.storage === 'frozen')).toBe(true);
    // Exactly beer and tobacco are age restricted.
    for (const p of products) {
      expect(p.minimumAge !== undefined, p.id).toBe(p.subcategory !== undefined);
      if (p.subcategory === 'beer') expect(p.minimumAge).toBe(16);
      if (p.subcategory === 'tobacco') expect(p.minimumAge).toBe(18);
      if (p.subcategory === 'tobacco') expect(p.storage).toBe('counter');
    }
  });

  it('gives every product its own asset in catalog order and a distinct label', () => {
    products.forEach((p, i) => expect(p.assetId).toBe(`P-${String(i + 1).padStart(3, '0')}`));
    const looks = products.map((p) => `${p.label.primaryColor}/${p.label.accentColor}/${p.label.text}`.toLowerCase());
    expect(new Set(looks).size).toBe(products.length);
    for (const p of products) {
      const asset = ruhrgebietPack.assets[p.assetId];
      expect(asset?.category).toBe('product');
      expect(asset?.collides).toBe(false);
      expect(asset?.scalable).toBe(false);
    }
  });

  it('one unit of every product is affordable with the start cash', () => {
    const total = products.reduce((sum, p) => sum + p.purchasePriceCents, 0);
    expect(total).toBeLessThan(START_CASH_CENTS);
  });

  it('every product has a sensible capacity in its best slot (1..64)', () => {
    for (const p of products) {
      const asset = ruhrgebietPack.assets[p.assetId];
      if (!asset) throw new Error(p.assetId);
      const best = Math.max(
        ...ruhrgebietPack.stockSlots
          .filter((s) => s.accepts === p.storage)
          .map((s) => slotCapacity(s, asset.size, { maxStack: productMaxStack(p) })),
      );
      expect(best, p.id).toBeGreaterThanOrEqual(1);
      expect(best, p.id).toBeLessThanOrEqual(64);
    }
  });

  it('has 40-70 slots, all of a kind that exists on a placement', () => {
    expect(ruhrgebietPack.stockSlots.length).toBeGreaterThanOrEqual(40);
    expect(ruhrgebietPack.stockSlots.length).toBeLessThanOrEqual(70);
    const kinds = new Set(ruhrgebietPack.stockSlots.map((s) => s.accepts));
    expect([...kinds].sort()).toEqual(['cooled', 'counter', 'frozen', 'press', 'shelf']);
  });
});

describe('interaction points', () => {
  const points = ruhrgebietPack.layout.interactionPoints;
  const open = { doorOpen: true, shutterOpen: true };
  const at = (x: number, z: number) => findAvailableInteraction(points, { x, z }, open)?.kind;

  it('register, shutter and storage are each selectable at a natural standing spot', () => {
    expect(at(-0.2, 0.9)).toBe('register'); // behind the counter, beside the till
    expect(at(-1.2, 0.9)).toBe('shutter'); // behind the counter, at the sales window
    expect(at(1.75, -1.0)).toBe('storage'); // in front of the storage rack
    expect(at(2.0, 2.4)).toBe('door');
  });

  it('register and storage need no openingId', () => {
    for (const p of points.filter((x) => x.kind === 'register' || x.kind === 'storage')) expect(p.openingId).toBeUndefined();
    expect(points.map((p) => p.kind).sort()).toEqual(['door', 'register', 'shutter', 'storage']);
  });
});

describe('product validation errors', () => {
  it('product ids and keys', () => {
    has(broken((p) => { product(p, WATER).id = 'wasser'; }), 'catalog key', 'does not match');
    has(broken((p) => { product(p, WATER).id = 'wasser'; }), 'must start with "product."');
    has(
      broken((p) => {
        const clone = { ...product(p, PILS), id: product(p, WATER).id };
        p.products['product.other'] = clone;
      }),
      'duplicate product id',
    );
  });

  it('names, brand and label', () => {
    has(broken((p) => { product(p, WATER).name = ' '; }), 'name must not be empty');
    has(broken((p) => { product(p, WATER).brand = ''; }), 'brand must not be empty');
    has(broken((p) => { product(p, WATER).label.primaryColor = 'blue'; }), 'primaryColor', '#rrggbb');
    has(broken((p) => { product(p, WATER).label.accentColor = '#fff'; }), 'accentColor', '#rrggbb');
    has(broken((p) => { product(p, WATER).label.text = ''; }), 'label text');
  });

  it('prices', () => {
    has(broken((p) => { product(p, WATER).purchasePriceCents = 0.5; }), 'purchasePriceCents', 'positive safe integer');
    has(broken((p) => { product(p, WATER).suggestedPriceCents = -1; }), 'suggestedPriceCents', 'positive safe integer');
    has(broken((p) => { product(p, WATER).purchasePriceCents = 80; }), 'purchase price must be lower');
    has(broken((p) => { product(p, WATER).purchasePriceCents = Number.MAX_SAFE_INTEGER + 2; }), 'safe integer');
  });

  it('enums', () => {
    has(broken((p) => { (product(p, WATER) as { storage: string }).storage = 'attic'; }), 'unknown storage kind');
    has(broken((p) => { (product(p, WATER) as { package: string }).package = 'sack'; }), 'unknown package kind');
    has(broken((p) => { (product(p, WATER) as { category: string }).category = 'toys'; }), 'unknown category');
    has(broken((p) => { (product(p, WATER) as { subcategory: string }).subcategory = 'wine'; }), 'unknown subcategory');
  });

  it('age restriction', () => {
    has(broken((p) => { product(p, PILS).minimumAge = 21; }), 'minimumAge 21 must be 16 or 18');
    has(broken((p) => { delete product(p, PILS).minimumAge; }), 'requires a minimumAge');
  });

  it('assets', () => {
    has(broken((p) => { product(p, WATER).assetId = 'P-999'; }), 'unknown asset "P-999"');
    has(broken((p) => { product(p, WATER).assetId = 'I-001'; }), 'expected "product"');
    has(broken((p) => { product(p, WATER).assetId = product(p, PILS).assetId; }), 'used by more than one product');
    has(broken((p) => { delete p.products[WATER]; }), 'not used by any product');
  });

  it('every product needs a compatible slot with capacity', () => {
    has(broken((p) => { p.stockSlots = p.stockSlots.filter((s) => s.accepts !== 'frozen'); }), 'no compatible "frozen" slot');
    has(
      broken((p) => {
        const asset = p.assets[product(p, WATER).assetId];
        if (asset) asset.size.width = 5;
      }),
      WATER,
      'capacity',
    );
  });
});

describe('slot validation errors', () => {
  const pick = (pack: ContentPack, id: string): PlacementDef => {
    const found = pack.layout.placements.find((x) => x.id === id);
    if (!found) throw new Error(id);
    return found;
  };

  it('ids and placements', () => {
    has(broken((p) => { slot(p, 'slot.fridge.1').id = 'fridge-1'; }), 'must start with "slot."');
    has(broken((p) => { slot(p, 'slot.fridge.2').id = 'slot.fridge.1'; }), 'duplicate slot id "slot.fridge.1"');
    has(broken((p) => { slot(p, 'slot.fridge.1').placementId = 'placement.nope'; }), 'unknown placement');
  });

  it('role compatibility', () => {
    has(broken((p) => { slot(p, 'slot.fridge.1').accepts = 'shelf'; }), 'slot "slot.fridge.1"', 'cannot present');
    has(broken((p) => { slot(p, 'slot.counter.1').accepts = 'cooled'; }), 'slot "slot.counter.1"', 'cannot present');
    has(broken((p) => { pick(p, 'placement.fridge').role = 'storage'; }), 'slot "slot.fridge.1"', 'cannot present');
  });

  it('bounds', () => {
    has(broken((p) => { slot(p, 'slot.fridge.1').size.width = 0.9; }), 'slot "slot.fridge.1"', 'outside the bounds');
    has(broken((p) => { slot(p, 'slot.fridge.1').origin.z = 0.6; }), 'outside the bounds');
    has(broken((p) => { slot(p, 'slot.fridge.1').size.height = 0; }), 'size must be positive');
    has(broken((p) => { slot(p, 'slot.fridge.1').origin.y = -0.1; }), 'below the base');
  });

  it('overlaps', () => {
    has(broken((p) => { slot(p, 'slot.fridge.2').origin.x = slot(p, 'slot.fridge.1').origin.x; }), 'slots "slot.fridge.1" and "slot.fridge.2"', 'overlap');
  });

  it('slots must not collide with the register on the counter', () => {
    has(
      broken((p) => {
        slot(p, 'slot.counter.5').origin.x = 0.8;
        slot(p, 'slot.counter.5').origin.z = 0;
      }),
      'slot "slot.counter.5"',
      'placement.register',
    );
  });

  it('interaction points must stay reachable', () => {
    has(
      broken((p) => {
        const point = p.layout.interactionPoints.find((i) => i.id === 'interaction.storage');
        if (point) point.position = { x: 8, z: -6.9 };
        pick(p, 'placement.returns-yard').position = { x: 8, z: -6.4 };
      }),
      'interaction point "interaction.storage"',
    );
  });
});
