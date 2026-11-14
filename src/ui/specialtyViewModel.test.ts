import { describe, expect, it } from 'vitest';
import { mutable, newGame, setTime } from '../game/testing/harness';
import { MASSE, ONION, specialty, specialtyPack } from '../game/testing/specialtyPack';
import { buildSpecialtyViews, qualityWord } from './specialtyViewModel';

describe('specialty view model', () => {
  it('shows ingredients, possible batches, the expected quality and the first goal before the first batch', () => {
    const game = newGame(7, specialtyPack);
    setTime(game, 600, 1);
    mutable(game).economy.storage = { [MASSE]: 2, 'product.test-water': 3 };
    const [v] = buildSpecialtyViews(game);
    expect(v?.stage).toBe(0);
    expect(v?.possibleBatches).toBe(1); // water: 3 / 2
    expect(v?.ingredients.map((i) => [i.productId, i.inStorage, i.enough])).toEqual([[MASSE, 2, true], ['product.test-water', 3, true]]);
    expect(v?.optional?.productId).toBe(ONION);
    expect(v?.optional?.enough).toBe(false);
    expect(v?.expectedQuality).toEqual({ plain: 48, withOptional: 56 });
    expect(v?.next?.requirements).toHaveLength(1);
    expect(v?.production).toBeNull();
  });

  it('shows the running production with progress and ready time, then the next stage requirements', () => {
    const game = newGame(7, specialtyPack);
    setTime(game, 600, 1);
    mutable(game).economy.storage = { [MASSE]: 2, 'product.test-water': 4 };
    expect(game.specialty.startProduction(specialty.id, 1, false).ok).toBe(true);
    mutable(game).calendar.minute = 620;
    const [running] = buildSpecialtyViews(game);
    expect(running?.production?.progress).toBeCloseTo(0.5);
    expect(running?.production?.readyClock).toBe('10:40');
    expect(running?.production?.remainingMinutes).toBe(20);
    mutable(game).calendar.minute = 640;
    game.tick(1 / 60);
    const [done] = buildSpecialtyViews(game);
    expect(done?.stage).toBe(1);
    expect(done?.finished.storage).toBe(6);
    expect(done?.next?.name).toBe('Geheimtipp');
    expect(done?.next?.requirements.every((r) => !r.met)).toBe(true);
  });

  it('names the quality in words', () => {
    expect(qualityWord(30)).toBe('misslungen');
    expect(qualityWord(56)).toBe('ordentlich');
    expect(qualityWord(90)).toBe('hervorragend');
  });
});
