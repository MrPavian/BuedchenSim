import { SolidBuilder, planarUv } from './solid';
import type { KioskContext } from './context';
import { FLOOR_TILE } from './textures';

/** Interior floor: 0.3 m two-tone tiles (0.6 m texture tile), top at 0.03 m like the sidewalk slab. */
export const FLOOR_HEIGHT = 0.03;

export function buildInterior(ctx: KioskContext): void {
  const { kiosk, m } = ctx;
  const fp = kiosk.footprint;
  const t = kiosk.wallThickness;
  const builder = new SolidBuilder({ x: ctx.cx, z: ctx.cz });
  builder.box(
    {
      minX: fp.minX + t - ctx.cx,
      maxX: fp.maxX - t - ctx.cx,
      minY: 0,
      maxY: FLOOR_HEIGHT,
      minZ: fp.minZ + t - ctx.cz,
      maxZ: fp.maxZ - t - ctx.cz,
    },
    { py: 'floor' },
    { uv: planarUv(FLOOR_TILE, FLOOR_TILE) },
  );
  for (const mesh of builder.build({ floor: m.floor }, 'kiosk.floor', { cast: false, receive: true })) ctx.fixed.add(mesh);
}
