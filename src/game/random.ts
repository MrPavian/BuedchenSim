/**
 * Deterministic randomness. There is no Math.random in game logic: decisions are pure functions of the saved
 * world seed and of what is being decided (`roll(seed, day, npcId, purpose)`), so a reload never changes them.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mixChar(hash: number, code: number): number {
  return Math.imul(hash ^ code, FNV_PRIME) >>> 0;
}

/** Final avalanche (murmur3 fmix32) so that similar inputs give unrelated outputs. */
function avalanche(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/** 32-bit hash (unsigned) of the parts; parts are separated, so ('ab','c') differs from ('a','bc'). */
export function hashParts(...parts: readonly (string | number)[]): number {
  let hash = FNV_OFFSET;
  for (const part of parts) {
    const text = typeof part === 'number' ? String(part) : part;
    for (let i = 0; i < text.length; i += 1) hash = mixChar(hash, text.charCodeAt(i));
    hash = mixChar(hash, 0x1f); // separator
  }
  return avalanche(hash);
}

/** Stateless roll in [0, 1) from the world seed and the parts that identify the decision. */
export function roll(seed: number, ...parts: readonly (string | number)[]): number {
  return hashParts(seed, ...parts) / 0x100000000;
}

export interface Rng {
  /** Next value in [0, 1). */
  next(): number;
  /** Current internal state (32 bit); `createRng(state)` continues the sequence. */
  state(): number;
}

/** Small seeded generator (mulberry32) for the rare case that a sequence is needed. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    },
    state() {
      return a;
    },
  };
}
