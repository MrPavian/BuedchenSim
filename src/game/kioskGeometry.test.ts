import { describe, expect, it } from 'vitest';
import { testPack } from '../game/testing/fixture-pack';
import { PLAYER_HEIGHT, buildWallPieces, kioskColliders, wallExtent, wallRect, WALL_SIDES } from './kioskGeometry';

const ruhrgebietLayout = testPack.layout;

const { kiosk } = ruhrgebietLayout;

describe('kioskGeometry', () => {
  const pieces = buildWallPieces(kiosk);

  it('wall pieces cover each wall except the openings (area balance)', () => {
    for (const side of WALL_SIDES) {
      const [lo, hi] = wallExtent(kiosk, side);
      const wallArea = (hi - lo) * kiosk.height;
      const openingArea = kiosk.openings
        .filter((o) => o.side === side)
        .reduce((sum, o) => sum + (o.to - o.from) * (o.head - o.sill), 0);
      const pieceArea = pieces
        .filter((p) => p.side === side)
        .reduce((sum, p) => {
          const along = side === 'north' || side === 'south' ? p.box.maxX - p.box.minX : p.box.maxZ - p.box.minZ;
          return sum + along * (p.box.maxY - p.box.minY);
        }, 0);
      expect(pieceArea).toBeCloseTo(wallArea - openingArea, 9);
    }
  });

  it('no piece reaches into an opening', () => {
    for (const o of kiosk.openings) {
      for (const p of pieces.filter((q) => q.side === o.side)) {
        const overlapX = p.box.minX < o.to && p.box.maxX > o.from;
        const overlapY = p.box.minY < o.head && p.box.maxY > o.sill;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it('pieces lie within the wall slab', () => {
    for (const p of pieces) {
      const r = wallRect(kiosk, p.side);
      expect(p.box.minX).toBeGreaterThanOrEqual(r.minX - 1e-9);
      expect(p.box.maxX).toBeLessThanOrEqual(r.maxX + 1e-9);
      expect(p.box.minZ).toBeGreaterThanOrEqual(r.minZ - 1e-9);
      expect(p.box.maxZ).toBeLessThanOrEqual(r.maxZ + 1e-9);
    }
  });

  it('door lintel and window head piece do not block; the sill wall does', () => {
    const blockers = pieces.filter((p) => p.box.minY < PLAYER_HEIGHT);
    expect(blockers.some((p) => p.kind === 'below')).toBe(true);
    expect(blockers.some((p) => p.kind === 'above')).toBe(false);
  });

  const doorGap = { minX: 1.5, maxX: 2.5 };
  const wall = wallRect(kiosk, 'south');
  const midZ = (wall.minZ + wall.maxZ) / 2;
  const covers = (rects: ReturnType<typeof kioskColliders>, x: number) =>
    rects.some((r) => x > r.minX && x < r.maxX && midZ > r.minZ && midZ < r.maxZ);

  it('closed door adds a collider across the opening, open door removes it', () => {
    const closed = kioskColliders(kiosk, false);
    const open = kioskColliders(kiosk, true);
    const mid = (doorGap.minX + doorGap.maxX) / 2;
    expect(covers(closed, mid)).toBe(true);
    expect(covers(open, mid)).toBe(false);
    // The sales window wall always blocks.
    expect(covers(open, -1)).toBe(true);
    expect(covers(closed, -1)).toBe(true);
  });
});
