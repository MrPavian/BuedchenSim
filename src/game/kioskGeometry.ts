import { mergeRects } from './rects';
import type { KioskDef, Rect, WallOpening, WallSide } from './types';

/**
 * Pure kiosk geometry derived from the KioskDef. The SAME wall boxes feed the meshes
 * (assets/kioskK001.ts) and the colliders (below), so they cannot drift apart.
 */

/** Anything starting below this height blocks the (1.75 m) player. */
export const PLAYER_HEIGHT = 1.8;

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export type WallPieceKind = 'full' | 'beside' | 'below' | 'above';

export interface WallPiece {
  side: WallSide;
  kind: WallPieceKind;
  /** Opening this piece belongs to (below/above); undefined for full/beside pieces. */
  openingId?: string;
  box: Box;
}

export const WALL_SIDES: readonly WallSide[] = ['south', 'north', 'east', 'west'];

/** Footprint of one wall slab. North/south run full width, east/west fit between them. */
export function wallRect(kiosk: KioskDef, side: WallSide): Rect {
  const fp = kiosk.footprint;
  const t = kiosk.wallThickness;
  switch (side) {
    case 'south':
      return { minX: fp.minX, maxX: fp.maxX, minZ: fp.maxZ - t, maxZ: fp.maxZ };
    case 'north':
      return { minX: fp.minX, maxX: fp.maxX, minZ: fp.minZ, maxZ: fp.minZ + t };
    case 'east':
      return { minX: fp.maxX - t, maxX: fp.maxX, minZ: fp.minZ + t, maxZ: fp.maxZ - t };
    case 'west':
      return { minX: fp.minX, maxX: fp.minX + t, minZ: fp.minZ + t, maxZ: fp.maxZ - t };
  }
}

/** Interval of the wall along its own axis (x for north/south, z for east/west). */
export function wallExtent(kiosk: KioskDef, side: WallSide): [number, number] {
  const r = wallRect(kiosk, side);
  return side === 'north' || side === 'south' ? [r.minX, r.maxX] : [r.minZ, r.maxZ];
}

function makeBox(rect: Rect, side: WallSide, from: number, to: number, minY: number, maxY: number): Box {
  return side === 'north' || side === 'south'
    ? { minX: from, maxX: to, minY, maxY, minZ: rect.minZ, maxZ: rect.maxZ }
    : { minX: rect.minX, maxX: rect.maxX, minY, maxY, minZ: from, maxZ: to };
}

/** Splits all four walls into boxes around the openings. */
export function buildWallPieces(kiosk: KioskDef): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (const side of WALL_SIDES) {
    const rect = wallRect(kiosk, side);
    const [lo, hi] = wallExtent(kiosk, side);
    const openings = kiosk.openings.filter((o) => o.side === side).sort((a, b) => a.from - b.from);
    const add = (kind: WallPieceKind, from: number, to: number, minY: number, maxY: number, openingId?: string) => {
      if (!(to > from) || !(maxY > minY)) return;
      const piece: WallPiece = { side, kind, box: makeBox(rect, side, from, to, minY, maxY) };
      if (openingId !== undefined) piece.openingId = openingId;
      pieces.push(piece);
    };
    if (openings.length === 0) {
      add('full', lo, hi, 0, kiosk.height);
      continue;
    }
    let cursor = lo;
    for (const o of openings) {
      add('beside', cursor, o.from, 0, kiosk.height);
      add('below', o.from, o.to, 0, o.sill, o.id);
      add('above', o.from, o.to, o.head, kiosk.height, o.id);
      cursor = Math.max(cursor, o.to);
    }
    add('beside', cursor, hi, 0, kiosk.height);
  }
  return pieces;
}

/** Fallback height of the dollhouse cut when the kiosk has no south sales window. */
export const DEFAULT_CUT_HEIGHT = 1.0;

/** Height to which the camera-facing wall is cut down while the player is inside: the sales window sill. */
export function kioskCutHeight(kiosk: KioskDef): number {
  const window = kiosk.openings.find((o) => o.kind === 'window' && o.side === 'south');
  const sill = window?.sill ?? DEFAULT_CUT_HEIGHT;
  return Math.min(Math.max(sill, 0.1), kiosk.height - 0.1);
}

export type WallPart = 'lower' | 'upper';

/** A wall piece restricted to one side of the cut plane. */
export interface WallSlice extends WallPiece {
  part: WallPart;
}

/**
 * Splits wall pieces at `cutHeight` into a lower part (below the cut) and an upper part (above it).
 * Pieces entirely on one side are passed through unchanged; the slices cover exactly the same volume.
 */
export function splitWallPiecesAtHeight(pieces: readonly WallPiece[], cutHeight: number): WallSlice[] {
  const out: WallSlice[] = [];
  for (const piece of pieces) {
    const { minY, maxY } = piece.box;
    if (maxY <= cutHeight) {
      out.push({ ...piece, part: 'lower' });
    } else if (minY >= cutHeight) {
      out.push({ ...piece, part: 'upper' });
    } else {
      out.push({ ...piece, part: 'lower', box: { ...piece.box, maxY: cutHeight } });
      out.push({ ...piece, part: 'upper', box: { ...piece.box, minY: cutHeight } });
    }
  }
  return out;
}

export function boxToRect(box: Box): Rect {
  return { minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ };
}

/** Footprint of a door/window opening inside its wall (what a closed door leaf fills). */
export function openingRect(kiosk: KioskDef, opening: WallOpening): Rect {
  return boxToRect(makeBox(wallRect(kiosk, opening.side), opening.side, opening.from, opening.to, 0, 0));
}

/**
 * Wall obstacles for the player circle: wall pieces reaching below head height (sill walls
 * block, lintels over doors do not) and the closed door leaves. Furniture colliders come
 * from placements (see colliders.ts). Shutter state is irrelevant: the sill wall stays either way.
 */
export function kioskColliders(kiosk: KioskDef, doorOpen: boolean): Rect[] {
  const rects: Rect[] = buildWallPieces(kiosk)
    .filter((p) => p.box.minY < PLAYER_HEIGHT)
    .map((p) => boxToRect(p.box));
  if (!doorOpen) {
    for (const o of kiosk.openings) if (o.kind === 'door') rects.push(openingRect(kiosk, o));
  }
  return mergeRects(rects);
}
