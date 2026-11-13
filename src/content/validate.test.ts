import { describe, expect, it } from 'vitest';
import { placementColliders, placementFootprint } from '../game/placement';
import type { ContentPack, PlacementDef } from '../game/types';
import { ruhrgebietPack } from './regions/ruhrgebiet';
import { validateContent } from './validate';

function broken(mutate: (pack: ContentPack) => void): string[] {
  const pack = structuredClone(ruhrgebietPack);
  mutate(pack);
  return validateContent(pack);
}

const place = (pack: ContentPack, id: string): PlacementDef => {
  const found = pack.layout.placements.find((p) => p.id === id);
  if (!found) throw new Error(`fixture missing: ${id}`);
  return found;
};

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
      first(p.layout.placements).id = 'counter';
    });
    expect(errors).toContain('duplicate opening id "opening.door"');
    expect(errors).toContain('placement id "counter" must start with "placement."');
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

  it('rejects a spawn outside walkBounds, in a wall or in furniture', () => {
    expect(broken((p) => (p.layout.spawn.position = { x: 50, z: 0 }))).toContain('spawn position is outside walkBounds');
    expect(broken((p) => (p.layout.spawn.position = { x: 0, z: 1.9 }))).toContain('spawn position is inside a kiosk wall');
    expect(broken((p) => (p.layout.spawn.position = { x: -1, z: 1.5 }))).toContain(
      'spawn position is inside placement "placement.counter"',
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

  it('requires an openingId for doors and shutters but not for register and storage points', () => {
    expect(
      broken((p) => {
        delete first(p.layout.interactionPoints).openingId;
      }),
    ).toContain('interaction point "interaction.door" of kind "door" needs an openingId');
    expect(
      broken((p) => {
        p.layout.interactionPoints = p.layout.interactionPoints.filter((i) => i.kind === 'door' || i.kind === 'shutter');
        p.layout.interactionPoints.push({ id: 'interaction.register', kind: 'register', position: { x: -0.2, z: 1.0 }, radius: 0.6 });
        p.layout.interactionPoints.push({ id: 'interaction.storage', kind: 'storage', position: { x: 2.1, z: -1.0 }, radius: 0.8 });
      }),
    ).toEqual([]);
  });

  it('rejects interaction points outside walkBounds', () => {
    expect(
      broken((p) => {
        first(p.layout.interactionPoints).position = { x: 0, z: 30 };
      }),
    ).toContain('interaction point "interaction.door" is outside walkBounds');
  });

  it('rejects non-positive marker radii', () => {
    const errors = broken((p) => {
      const point = p.layout.interactionPoints[1];
      if (point?.marker) {
        point.marker.radius = 0;
        point.marker.radiusZ = -1;
      }
    });
    expect(errors).toContain('interaction point "interaction.shutter" marker radius must be positive');
    expect(errors).toContain('interaction point "interaction.shutter" marker radiusZ must be positive');
  });

  it('rejects non-finite numbers', () => {
    const errors = broken((p) => {
      p.layout.spawn.heading = Number.NaN;
    });
    expect(errors).toEqual(['layout.spawn.heading is not a finite number']);
  });

  describe('placement list and catalog', () => {
    const has = (errors: string[], ...needles: string[]) =>
      expect(errors.some((e) => needles.every((n) => e.includes(n)))).toBe(true);

    it('has the expected content shape', () => {
      const { layout, assets } = ruhrgebietPack;
      expect(layout.layoutVersion).toBe(1);
      for (const [key, asset] of Object.entries(assets)) expect(asset.assetId).toBe(key);
      for (const p of layout.placements) expect(assets[p.assetId]).toBeDefined();
      const count = (assetId: string) => layout.placements.filter((p) => p.assetId === assetId);
      expect(count('I-003').length).toBe(2);
      expect(new Set(count('I-003').map((p) => p.rotation)).size).toBe(2);
      expect(count('I-012').length).toBe(2);
      expect(new Set(count('I-012').map((p) => p.position.x < -3)).size).toBe(2); // one inside, one outside at the west wall
      expect(new Set(count('I-012').map((p) => p.rotation)).size).toBe(2);
    });

    it('rejects a non-positive layoutVersion', () => {
      has(broken((p) => (p.layout.layoutVersion = 0)), 'layoutVersion');
      has(broken((p) => (p.layout.layoutVersion = 1.5)), 'layoutVersion');
    });

    it('rejects catalog problems (key mismatch, bad size)', () => {
      has(broken((p) => { first(Object.values(p.assets)).assetId = 'X-9'; }), 'catalog key', 'X-9');
      has(broken((p) => { (p.assets['I-001'] as { size: { width: number } }).size.width = 0; }), 'asset "I-001"', 'size');
      expect(broken((p) => { (p.assets['I-001'] as { size: { width: number } }).size.width = Number.NaN; })).toEqual([
        'assets.I-001.size.width is not a finite number',
      ]);
    });

    it('rejects duplicate placement ids', () => {
      expect(broken((p) => { (p.layout.placements[1] as PlacementDef).id = 'placement.counter'; })).toContain(
        'duplicate placement id "placement.counter"',
      );
    });

    it('rejects an unknown asset', () => {
      has(broken((p) => (place(p, 'placement.fridge').assetId = 'I-999')), 'placement.fridge', 'unknown asset "I-999"');
    });

    it('rejects a rotation the asset does not allow', () => {
      has(broken((p) => (place(p, 'placement.counter').rotation = 90)), 'placement.counter', 'rotation 90');
    });

    it('rejects scale on a non-scalable asset, and non-positive scale on a scalable one', () => {
      has(broken((p) => (place(p, 'placement.fridge').scale = 1.2)), 'placement.fridge', 'not scalable');
      has(
        broken((p) => {
          (p.assets['I-005'] as { scalable: boolean }).scalable = true;
          place(p, 'placement.fridge').scale = -1;
        }),
        'placement.fridge',
        'scale',
      );
    });

    it('rejects overlapping colliding placements', () => {
      has(broken((p) => (place(p, 'placement.storage-shelf').position.x = 1.2)), 'placement.storage-shelf', 'overlaps');
    });

    it('rejects a placement that straddles a wall, and one outside walkBounds', () => {
      has(broken((p) => (place(p, 'placement.fridge').position.z = -1.9)), 'placement.fridge', 'straddles');
      has(broken((p) => (place(p, 'placement.returns-yard').position.z = -6.9)), 'placement.returns-yard', 'walkBounds');
    });

    it('rejects furniture in the door swing area', () => {
      has(broken((p) => (place(p, 'placement.returns-inside').position.x = 1.9)), 'placement.returns-inside', 'swing area', 'opening.door');
    });

    it('rejects furniture whose front cannot be reached', () => {
      // Middle shelf 0.3 m in front of the fridge leaves no room for the player circle.
      has(
        broken((p) => (place(p, 'placement.middle-shelf').position = { x: -0.1, z: -0.6 })),
        'placement.fridge',
        'cannot be used from the front',
      );
    });

    it('rejects a blocked walkway (door sealed from outside)', () => {
      const errors = broken((p) => {
        place(p, 'placement.returns-yard').position = { x: 2.0, z: 2.35 };
        place(p, 'placement.returns-yard').rotation = 0;
      });
      has(errors, 'interior is not reachable');
    });

    it('rejects bad support relations', () => {
      has(broken((p) => (place(p, 'placement.register').on = 'placement.nope')), 'placement.register', 'unknown placement');
      has(broken((p) => (place(p, 'placement.register').on = 'placement.register')), 'placement.register', 'itself');
      has(broken((p) => (place(p, 'placement.counter').on = 'placement.wall-shelf-north')), 'placement.register', 'max. one level');
      has(broken((p) => delete place(p, 'placement.register').on), 'placement.register', 'requires support');
      has(broken((p) => (place(p, 'placement.register').position.x = 1.0)), 'placement.register', 'supporter');
    });

    it('can be rearranged purely by data and stays valid', () => {
      const pack = structuredClone(ruhrgebietPack);
      const beforeColliders = placementColliders(pack.layout, pack.assets);
      const shelf = place(pack, 'placement.middle-shelf');
      const crate = place(pack, 'placement.returns-yard');
      const shelfBefore = placementFootprint(shelf, pack.assets['I-004'] as never);
      shelf.position = { x: 0.9, z: -0.3 };
      shelf.rotation = 180;
      crate.position = { x: -4.5, z: -2.4 };
      crate.rotation = 90;
      expect(validateContent(pack)).toEqual([]);
      const afterColliders = placementColliders(pack.layout, pack.assets);
      expect(afterColliders).toHaveLength(beforeColliders.length);
      const rectOf = (list: typeof afterColliders, id: string) => list.find((c) => c.placementId === id)?.rect;
      expect(rectOf(afterColliders, 'placement.middle-shelf')).not.toEqual(rectOf(beforeColliders, 'placement.middle-shelf'));
      expect(rectOf(afterColliders, 'placement.middle-shelf')).toEqual(placementFootprint(shelf, pack.assets['I-004'] as never));
      expect(placementFootprint(shelf, pack.assets['I-004'] as never)).not.toEqual(shelfBefore);
      expect(rectOf(afterColliders, 'placement.returns-yard')).toEqual(placementFootprint(crate, pack.assets['I-012'] as never));
    });
  });
});
