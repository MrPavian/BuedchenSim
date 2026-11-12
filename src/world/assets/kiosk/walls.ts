import { buildWallPieces, splitWallPiecesAtHeight, wallExtent, type WallSlice } from '../../../game/kioskGeometry';
import type { WallSide } from '../../../game/types';
import { localBox, type KioskContext } from './context';
import { SolidBuilder, hash3, planarUv, type FaceKey } from './solid';
import { BRICK_TILE, INTERIOR_TILE_H, INTERIOR_TILE_W } from './textures';

/** K-001-A (body) and K-001-B (facade): brick walls, plaster band, concrete plinth, light interior. */

const PLINTH_HEIGHT = 0.28;
const PLINTH_OUT = 0.03;
const BAND_HEIGHT = 0.3;
const BAND_OUT = 0.035;

const OUTER: Record<WallSide, FaceKey> = { south: 'pz', north: 'nz', east: 'px', west: 'nx' };
const INNER: Record<WallSide, FaceKey> = { south: 'nz', north: 'pz', east: 'nx', west: 'px' };

const brickUv = planarUv(BRICK_TILE.w, BRICK_TILE.h);
const interiorUv = (x: number, y: number, z: number, face: FaceKey): [number, number] => {
  const along = face === 'px' || face === 'nx' ? z : x;
  return [along / INTERIOR_TILE_W, y / INTERIOR_TILE_H];
};
const concreteUv = planarUv(1, 1);

/** Dirt gradient near the ground plus faint lateral blotches. */
const brickShade = (x: number, y: number, z: number): number =>
  (1 - 0.4 * Math.exp(-y / 0.38)) * (0.95 + 0.07 * hash3(x, y * 0.5, z));
const concreteShade = (x: number, y: number, z: number): number => 0.88 + 0.12 * hash3(x, y, z);

export interface WallBuild {
  /** Number of wall slices built (for tests/logging). */
  slices: WallSlice[];
}

export function buildWalls(ctx: KioskContext): WallBuild {
  const { kiosk, m } = ctx;
  const origin = { x: ctx.cx, z: ctx.cz };
  const t = kiosk.wallThickness;
  const fixedBuilder = new SolidBuilder(origin);
  const upperBuilders: Record<WallSide, SolidBuilder> = {
    south: new SolidBuilder(origin),
    north: new SolidBuilder(origin),
    east: new SolidBuilder(origin),
    west: new SolidBuilder(origin),
  };

  const slices = splitWallPiecesAtHeight(buildWallPieces(kiosk), ctx.cut);
  for (const slice of slices) {
    const side = slice.side;
    const [lo, hi] = wallExtent(kiosk, side);
    const horizontal = side === 'north' || side === 'south'; // wall runs along x
    const b = slice.box;
    const alongMin = horizontal ? b.minX : b.minZ;
    const alongMax = horizontal ? b.maxX : b.maxZ;
    const atLo = Math.abs(alongMin - lo) < 1e-9;
    const atHi = Math.abs(alongMax - hi) < 1e-9;
    // The north wall never hides; its upper slices therefore belong to the fixed set.
    const builder = slice.part === 'lower' || side === 'north' ? fixedBuilder : upperBuilders[side];
    const local = localBox(ctx, b);
    const height = b.maxY - b.minY;

    const faces: Partial<Record<FaceKey, string>> = { [OUTER[side]]: 'brick', [INNER[side]]: 'inner' };
    if (b.maxY < kiosk.height - 1e-6) faces.py = 'cap'; // cut line / sill top
    // Along-wall end faces: exposed outer corner (north/south only) or the reveal next to an opening.
    if (horizontal) {
      const negEnd: FaceKey = 'nx';
      const posEnd: FaceKey = 'px';
      if (atLo) faces[negEnd] = 'brick';
      else if (slice.kind === 'beside') faces[negEnd] = 'reveal';
      if (atHi) faces[posEnd] = 'brick';
      else if (slice.kind === 'beside') faces[posEnd] = 'reveal';
    }
    // One box carries brick/inner/cap/reveal faces; per-face UV mapping is chosen by bucket below.
    addFaces(builder, local, faces, height);

    // --- plinth (concrete base course) on everything that touches the ground
    if (b.minY <= 1e-9) {
      const ext = (atEnd: boolean): number => (atEnd ? (horizontal ? PLINTH_OUT : t + PLINTH_OUT) : 0);
      builder.box(
        decorBox(local, side, PLINTH_OUT, ext(atLo), ext(atHi), 0, Math.min(PLINTH_HEIGHT, b.maxY)),
        { [OUTER[side]]: 'plinth', py: 'plinth', ...(horizontal ? { nx: 'plinth', px: 'plinth' } : { nz: 'plinth', pz: 'plinth' }) },
        { uv: concreteUv, shade: concreteShade },
      );
    }
    // --- plaster band under the roof edge
    if (Math.abs(b.maxY - kiosk.height) < 1e-9) {
      const y0 = Math.max(b.minY, kiosk.height - BAND_HEIGHT);
      const ext = (atEnd: boolean): number => (atEnd ? (horizontal ? BAND_OUT : t + BAND_OUT) : 0);
      builder.box(
        decorBox(local, side, BAND_OUT, ext(atLo), ext(atHi), y0, kiosk.height),
        { [OUTER[side]]: 'band', ...(horizontal ? { nx: 'band', px: 'band' } : { nz: 'band', pz: 'band' }) },
        { uv: concreteUv, shade: concreteShade },
      );
    }
  }

  const meshes = (builder: SolidBuilder, prefix: string) => builder.build(m.buckets, prefix);
  for (const mesh of meshes(fixedBuilder, 'kiosk.wall.fixed')) ctx.fixed.add(mesh);
  for (const side of ['south', 'east', 'west'] as const) {
    for (const mesh of meshes(upperBuilders[side], `kiosk.wall.${side}.upper`)) ctx.upper[side].add(mesh);
  }
  return { slices };
}

/** Adds brick/inner/cap/reveal faces with their bucket-specific UV mapping and shading. */
function addFaces(
  builder: SolidBuilder,
  box: Parameters<SolidBuilder['box']>[0],
  faces: Partial<Record<FaceKey, string>>,
  height: number,
): void {
  const rows = Math.max(1, Math.ceil(height / 0.2));
  const byBucket = new Map<string, Partial<Record<FaceKey, string>>>();
  for (const [face, bucket] of Object.entries(faces) as Array<[FaceKey, string]>) {
    const entry = byBucket.get(bucket) ?? {};
    entry[face] = bucket;
    byBucket.set(bucket, entry);
  }
  for (const [bucket, subset] of byBucket) {
    switch (bucket) {
      case 'brick':
        builder.box(box, subset, { uv: brickUv, shade: brickShade, rows });
        break;
      case 'inner':
        builder.box(box, subset, { uv: interiorUv });
        break;
      default:
        builder.box(box, subset, { uv: concreteUv, shade: concreteShade });
    }
  }
}

/** Slab hugging the outer face of a wall slice: `out` thick, extended along the wall at either end. */
function decorBox(
  b: ReturnType<typeof localBox>,
  side: WallSide,
  out: number,
  extLo: number,
  extHi: number,
  minY: number,
  maxY: number,
): ReturnType<typeof localBox> {
  switch (side) {
    case 'south':
      return { minX: b.minX - extLo, maxX: b.maxX + extHi, minY, maxY, minZ: b.maxZ, maxZ: b.maxZ + out };
    case 'north':
      return { minX: b.minX - extLo, maxX: b.maxX + extHi, minY, maxY, minZ: b.minZ - out, maxZ: b.minZ };
    case 'east':
      return { minX: b.maxX, maxX: b.maxX + out, minY, maxY, minZ: b.minZ - extLo, maxZ: b.maxZ + extHi };
    case 'west':
      return { minX: b.minX - out, maxX: b.minX, minY, maxY, minZ: b.minZ - extLo, maxZ: b.maxZ + extHi };
  }
}
