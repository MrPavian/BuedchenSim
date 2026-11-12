import { describe, expect, it } from 'vitest';
import { testPack } from '../game/testing/fixture-pack';
import {
  PLAYER_HEIGHT,
  buildWallPieces,
  kioskColliders,
  kioskCutHeight,
  splitWallPiecesAtHeight,
  wallExtent,
  wallRect,
  WALL_SIDES,
  type Box,
} from './kioskGeometry';

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

describe('dollhouse cut (wall upper/lower split)', () => {
  const volume = (b: Box): number => (b.maxX - b.minX) * (b.maxY - b.minY) * (b.maxZ - b.minZ);
  const pieces = buildWallPieces(kiosk);
  const cut = kioskCutHeight(kiosk);

  it('the cut height is the sales window sill', () => {
    expect(cut).toBe(1.0);
  });

  it('lower slices stay below and upper slices above the cut', () => {
    for (const s of splitWallPiecesAtHeight(pieces, cut)) {
      if (s.part === 'lower') expect(s.box.maxY).toBeLessThanOrEqual(cut + 1e-9);
      else expect(s.box.minY).toBeGreaterThanOrEqual(cut - 1e-9);
      expect(s.box.maxY).toBeGreaterThan(s.box.minY);
    }
  });

  it('slices cover exactly the same volume as the wall pieces, per side', () => {
    const slices = splitWallPiecesAtHeight(pieces, cut);
    for (const side of WALL_SIDES) {
      const before = pieces.filter((p) => p.side === side).reduce((a, p) => a + volume(p.box), 0);
      const after = slices.filter((p) => p.side === side).reduce((a, p) => a + volume(p.box), 0);
      expect(after).toBeCloseTo(before, 9);
    }
  });

  it('the lower slices of one side together cover the wall footprint up to the cut (openings excepted)', () => {
    const slices = splitWallPiecesAtHeight(pieces, cut);
    // South wall: window below-piece (0..sill) plus lower halves of the beside pieces; the door gap stays open.
    const south = slices.filter((s) => s.side === 'south' && s.part === 'lower');
    const area = south.reduce((a, s) => a + (s.box.maxX - s.box.minX) * (s.box.maxY - s.box.minY), 0);
    const [lo, hi] = wallExtent(kiosk, 'south');
    const door = kiosk.openings.find((o) => o.kind === 'door')!;
    expect(area).toBeCloseTo((hi - lo - (door.to - door.from)) * cut, 9);
  });

  it('a cut at or below a piece start leaves the pieces untouched', () => {
    const slices = splitWallPiecesAtHeight(pieces, 0);
    expect(slices.every((s) => s.part === 'upper')).toBe(true);
    expect(slices).toHaveLength(pieces.length);
  });
});
