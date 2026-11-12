import { Group, type Object3D } from 'three';
import type { KioskDef, WallSide } from '../../../game/types';
import type { Materials } from '../../materials';
import { buildAwning } from './awning';
import { createKioskContext } from './context';
import { buildDoor } from './door';
import { buildInterior } from './interior';
import { buildLighting } from './lighting';
import { getKioskMaterials } from './materials';
import { KIOSK_NAMES, setKioskParts, type KioskParts } from './parts';
import { buildRainwater, buildRoof } from './roof';
import { buildSalesWindow } from './salesWindow';
import { buildSignage } from './signage';
import { buildWalls } from './walls';

export { KIOSK_NAMES, getKioskParts } from './parts';
export type { KioskParts, KioskAnimated } from './parts';

/**
 * K-001 Musterkiosk (Ruhrgebiet Trinkhalle). Pivot = footprint centre on the ground, units in metres.
 *
 * Parts: K-001-A/B walls + facade (walls.ts), K-001-F roof (roof.ts), K-001-C awning (awning.ts),
 * K-001-D sales window and flap (salesWindow.ts), K-001-E door (door.ts), K-001-G signage
 * (signage.ts), K-001-H lighting (lighting.ts), interior floor (interior.ts).
 * Walls come from `buildWallPieces` (shared with the colliders) so visuals and collision cannot drift.
 * Everything above the dollhouse cut height is grouped per wall side (see `KioskParts`).
 */
export function createKioskK001(kiosk: KioskDef, base: Materials): Object3D {
  const m = getKioskMaterials(base);
  const root = new Group();
  root.name = KIOSK_NAMES.root;
  const fp = kiosk.footprint;
  root.position.set((fp.minX + fp.maxX) / 2, 0, (fp.minZ + fp.maxZ) / 2);

  const fixed = new Group();
  fixed.name = 'kiosk.fixed';
  const bundle = createKioskContext(kiosk, m, fixed);
  const { ctx } = bundle;

  buildWalls(ctx);
  buildInterior(ctx);
  buildRoof(ctx);
  buildRainwater(ctx);
  buildSalesWindow(ctx);
  buildDoor(ctx);
  const signBottom = buildSignage(ctx);
  const awning = buildAwning(ctx, signBottom);
  buildLighting(ctx, awning);

  root.add(fixed);
  for (const side of ['south', 'north', 'east', 'west'] as const) root.add(bundle.wrappers[side]);
  root.add(bundle.roofWrapper);

  const cut = {} as Record<WallSide, Object3D[]>;
  for (const side of ['south', 'north', 'east', 'west'] as const) {
    // North never hides: its wrapper stays in the tree but is not offered to the occlusion.
    cut[side] = side === 'north' ? [] : [bundle.wrappers[side], ...ctx.cutExtras[side]];
  }
  const parts: KioskParts = {
    cutHeight: ctx.cut,
    cut,
    roof: bundle.roofWrapper,
    door: root.getObjectByName(KIOSK_NAMES.door) ?? null,
    flap: root.getObjectByName(KIOSK_NAMES.shutter) ?? null,
    sign: root.getObjectByName(KIOSK_NAMES.sign) ?? null,
    awning: root.getObjectByName(KIOSK_NAMES.awning) ?? null,
    fixtures: ctx.fixtures,
    animated: ctx.animated,
  };
  setKioskParts(root, parts);
  return root;
}
