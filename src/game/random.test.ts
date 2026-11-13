import { describe, expect, it } from 'vitest';
import { createRng, hashParts, roll } from './random';

describe('hashParts', () => {
  it('is a stable unsigned 32-bit value', () => {
    expect(hashParts('a', 1, 'b')).toBe(hashParts('a', 1, 'b'));
    const h = hashParts('npc.test', 5, 'routine');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('separates the parts', () => {
    expect(hashParts('ab', 'c')).not.toBe(hashParts('a', 'bc'));
    expect(hashParts(1, 23)).not.toBe(hashParts(12, 3));
  });

  it('gives different values for different inputs', () => {
    const values = new Set<number>();
    for (let day = 0; day < 200; day += 1) values.add(hashParts(1, day, 'npc.a'));
    expect(values.size).toBe(200);
  });
});

describe('roll', () => {
  it('is stateless: the same arguments always give the same value in [0, 1)', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = roll(42, i, 'npc.a', 'routine');
      expect(r).toBe(roll(42, i, 'npc.a', 'routine'));
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('depends on the seed and on every part', () => {
    const base = roll(1, 3, 'npc.a', 'x');
    expect(roll(2, 3, 'npc.a', 'x')).not.toBe(base);
    expect(roll(1, 4, 'npc.a', 'x')).not.toBe(base);
    expect(roll(1, 3, 'npc.b', 'x')).not.toBe(base);
    expect(roll(1, 3, 'npc.a', 'y')).not.toBe(base);
  });

  it('is roughly uniform', () => {
    let below = 0;
    const n = 4000;
    for (let i = 0; i < n; i += 1) if (roll(9, i, 'u') < 0.25) below += 1;
    expect(below / n).toBeGreaterThan(0.21);
    expect(below / n).toBeLessThan(0.29);
  });
});

describe('createRng (mulberry32)', () => {
  it('is reproducible and can continue from its state', () => {
    const a = createRng(123);
    const b = createRng(123);
    const first = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(first);
    const resumed = createRng(a.state());
    expect(resumed.next()).toBe(a.next());
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs per seed', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
});
