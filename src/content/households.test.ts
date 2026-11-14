import { describe, expect, it } from 'vitest';
import { wishCostCents } from '../game/wishes';
import { ruhrgebietPack } from './regions/ruhrgebiet';

describe('households and purses of the real pack', () => {
  it('every resident lives in exactly one household and keeps its own routine', () => {
    const households = ruhrgebietPack.households ?? [];
    for (const npc of Object.values(ruhrgebietPack.npcs)) {
      expect(households.filter((h) => h.memberIds.includes(npc.id)), npc.id).toHaveLength(1);
      expect(npc.routine.length, npc.id).toBeGreaterThan(0);
    }
  });

  it('every resident can pay each of its own wishes (the purse only rules out what it cannot afford)', () => {
    for (const npc of Object.values(ruhrgebietPack.npcs)) {
      for (const wish of npc.wishes ?? []) {
        expect(wishCostCents(ruhrgebietPack, wish), `${npc.id} ${wish.id}`).toBeLessThanOrEqual(npc.purseCents ?? Infinity);
      }
    }
  });
});
