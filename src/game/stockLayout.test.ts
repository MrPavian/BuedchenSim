import { describe, expect, it } from 'vitest';
import { slotCapacity, slotUnitPositions, productMaxStack } from './stockLayout';

const slot = { origin: { x: 0.5, y: 1, z: -0.2 }, size: { width: 1, depth: 0.3, height: 0.5 } };
const unit = { width: 0.07, depth: 0.07, height: 0.22 };

describe('slotUnitPositions', () => {
  it('places every unit inside the slot box', () => {
    for (const maxStack of [1, 2, 3]) {
      for (const p of slotUnitPositions(slot, unit, { maxStack })) {
        expect(p.x - unit.width / 2).toBeGreaterThanOrEqual(slot.origin.x - slot.size.width / 2 - 1e-9);
        expect(p.x + unit.width / 2).toBeLessThanOrEqual(slot.origin.x + slot.size.width / 2 + 1e-9);
        expect(p.z - unit.depth / 2).toBeGreaterThanOrEqual(slot.origin.z - slot.size.depth / 2 - 1e-9);
        expect(p.z + unit.depth / 2).toBeLessThanOrEqual(slot.origin.z + slot.size.depth / 2 + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(slot.origin.y - 1e-9);
        expect(p.y + unit.height).toBeLessThanOrEqual(slot.origin.y + slot.size.height + 1e-9);
      }
    }
  });

  it('never lets two units overlap', () => {
    const positions = slotUnitPositions(slot, unit, { maxStack: 2 });
    expect(positions.length).toBeGreaterThan(1);
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i]!;
        const b = positions[j]!;
        const overlap =
          Math.abs(a.x - b.x) < unit.width - 1e-9 &&
          Math.abs(a.z - b.z) < unit.depth - 1e-9 &&
          Math.abs(a.y - b.y) < unit.height - 1e-9;
        expect(overlap).toBe(false);
      }
    }
  });

  it('capacity equals the number of positions and grows with stacking', () => {
    const one = slotCapacity(slot, unit, { maxStack: 1 });
    const two = slotCapacity(slot, unit, { maxStack: 2 });
    expect(one).toBe(slotUnitPositions(slot, unit, { maxStack: 1 }).length);
    expect(one).toBe(12 * 3); // 12 columns, 3 rows
    expect(two).toBe(one * 2);
    expect(slotCapacity(slot, unit, { maxStack: 5 })).toBe(two); // limited by the slot height (0.5 / 0.22 = 2 layers)
    expect(slotCapacity(slot, unit)).toBe(one); // default: no stacking
  });

  it('is monotonic in the slot size', () => {
    let last = 0;
    for (let width = 0.05; width <= 1.5; width += 0.05) {
      const capacity = slotCapacity({ ...slot, size: { ...slot.size, width } }, unit);
      expect(capacity).toBeGreaterThanOrEqual(last);
      last = capacity;
    }
  });

  it('fills the front row (+Z) first, then further back, then the next layer', () => {
    const positions = slotUnitPositions(slot, unit, { maxStack: 2 });
    expect(positions[0]!.z).toBeGreaterThan(positions[12]!.z);
    expect(positions[0]!.y).toBe(1);
    expect(positions[positions.length - 1]!.y).toBeCloseTo(1 + unit.height);
    expect(positions[0]!.x).toBeLessThan(positions[1]!.x);
  });

  it('returns nothing when the unit does not fit or the sizes are invalid', () => {
    expect(slotUnitPositions(slot, { width: 2, depth: 0.07, height: 0.1 })).toEqual([]);
    expect(slotUnitPositions(slot, { width: 0.1, depth: 0.1, height: 0.6 })).toEqual([]);
    expect(slotUnitPositions(slot, { width: 0, depth: 0.1, height: 0.1 })).toEqual([]);
    expect(slotUnitPositions(slot, { width: Number.NaN, depth: 0.1, height: 0.1 })).toEqual([]);
  });

  it('takes the stack limit from the product or its package', () => {
    expect(productMaxStack({ package: 'bar' })).toBe(3);
    expect(productMaxStack({ package: 'bar', maxStack: 1 })).toBe(1);
  });
});
