import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../game/types';
import { ruhrgebietPack } from './regions/ruhrgebiet';
import { validateContent } from './validate';

function broken(mutate: (pack: ContentPack) => void): string[] {
  const pack = structuredClone(ruhrgebietPack);
  mutate(pack);
  return validateContent(pack);
}

const first = <T>(items: T[]): T => {
  const item = items[0];
  if (item === undefined) throw new Error('fixture missing');
  return item;
};

describe('validateContent', () => {
  it('accepts the ruhrgebiet pack', () => {
    expect(validateContent(ruhrgebietPack)).toEqual([]);
  });

  it('exposes the agreed ids and layout facts', () => {
    expect(ruhrgebietPack.regionId).toBe('region.ruhrgebiet');
    expect(ruhrgebietPack.layout.kiosk.openings.map((o) => o.id)).toEqual(['opening.sales-window', 'opening.door']);
  });

  it('rejects a bad region id', () => {
    expect(broken((p) => (p.regionId = 'ruhr'))).toEqual([expect.stringContaining('must start with "region."')]);
  });

  it('rejects duplicate ids and wrong prefixes', () => {
    const errors = broken((p) => {
      first(p.layout.kiosk.openings).id = 'opening.door';
      first(p.layout.furniture).id = 'counter';
    });
    expect(errors).toContain('duplicate opening id "opening.door"');
    expect(errors).toContain('furniture id "counter" must start with "furniture."');
  });

  it('rejects inverted rects', () => {
    const errors = broken((p) => {
      p.layout.walkBounds.minX = 50;
    });
    expect(errors).toContain('walkBounds must have min < max on both axes');
  });

  it('rejects openings outside the wall', () => {
    const errors = broken((p) => {
      first(p.layout.kiosk.openings).to = 5;
    });
    expect(errors.some((e) => e.includes('"opening.sales-window"') && e.includes('outside the south wall extent'))).toBe(true);
  });

  it('rejects sill >= head and head above the kiosk height', () => {
    const errors = broken((p) => {
      const o = first(p.layout.kiosk.openings);
      o.sill = 2.5;
      o.head = 9;
    });
    expect(errors).toContain('opening "opening.sales-window" head 9 exceeds kiosk height 3.2');
    expect(broken((p) => (first(p.layout.kiosk.openings).sill = 3))).toContain(
      'opening "opening.sales-window" must have sill < head',
    );
  });

  it('rejects overlapping openings on the same wall', () => {
    const errors = broken((p) => {
      first(p.layout.kiosk.openings).to = 2;
    });
    expect(errors).toContain('openings "opening.sales-window" and "opening.door" overlap on the south wall');
  });

  it('rejects furniture outside the interior', () => {
    const errors = broken((p) => {
      first(p.layout.furniture).rect = { minX: 10, maxX: 11, minZ: 10, maxZ: 11 };
    });
    expect(errors).toContain('furniture "furniture.counter" is not inside the kiosk interior');
  });

  it('rejects a spawn outside walkBounds, in a wall or in furniture', () => {
    expect(broken((p) => (p.layout.spawn.position = { x: 50, z: 0 }))).toContain('spawn position is outside walkBounds');
    expect(broken((p) => (p.layout.spawn.position = { x: 0, z: 1.9 }))).toContain('spawn position is inside a kiosk wall');
    expect(broken((p) => (p.layout.spawn.position = { x: -1, z: 1.5 }))).toContain(
      'spawn position is inside furniture "furniture.counter"',
    );
  });

  it('rejects interaction points with unknown or mismatched openings', () => {
    expect(
      broken((p) => {
        first(p.layout.interactionPoints).openingId = 'opening.nope';
      }),
    ).toContain('interaction point "interaction.door" references unknown opening "opening.nope"');
    expect(
      broken((p) => {
        first(p.layout.interactionPoints).openingId = 'opening.sales-window';
      }).some((e) => e.includes('needs a door opening')),
    ).toBe(true);
  });

  it('rejects interaction points outside walkBounds', () => {
    expect(
      broken((p) => {
        first(p.layout.interactionPoints).position = { x: 0, z: 30 };
      }),
    ).toContain('interaction point "interaction.door" is outside walkBounds');
  });

  it('rejects non-finite numbers', () => {
    const errors = broken((p) => {
      p.layout.spawn.heading = Number.NaN;
    });
    expect(errors).toEqual(['layout.spawn.heading is not a finite number']);
  });
});
