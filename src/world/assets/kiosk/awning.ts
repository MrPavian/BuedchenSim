import { Matrix4 } from 'three';
import { createOpeningRig, type KioskContext } from './context';
import { KIOSK_NAMES } from './parts';
import { SolidBuilder } from './solid';
import { AWNING_TILE } from './textures';

/**
 * K-001-C awning: striped fabric on a slight slope over the sales window with a wall rail, two side
 * arms and a valance. Independent of the flap: it is mounted above the open flap's path and under
 * the sign, projects only 0.55 m and therefore neither hides the sign nor the player at the window.
 */

export const AWNING_DEPTH = 0.55;
/** Height of the rear (wall side) edge: just under the sign. */
const SIGN_GAP = 0.04;
const DROP = 0.1;
export const VALANCE = 0.08;

export interface AwningInfo {
  /** Height of the front edge's top (valance hangs below it). */
  frontY: number;
  /** Distance of the front edge from the wall's outer face. */
  reach: number;
}

export function buildAwning(ctx: KioskContext, signBottomY: number): AwningInfo | null {
  const o = ctx.salesWindow;
  if (!o) return null;
  const { m } = ctx;
  const { rig, frame } = createOpeningRig(ctx, o, KIOSK_NAMES.awning);
  const width = 2 * frame.halfWidth + 0.4;
  const outer = frame.halfWall;
  const rearY = signBottomY - SIGN_GAP;
  const frontY = rearY - DROP;
  const slope = Math.asin(DROP / AWNING_DEPTH);

  const builder = new SolidBuilder();
  const fabricUv = (x: number, _y: number, z: number): [number, number] => [x / AWNING_TILE, z];
  // Fabric: a thin slab in the awning's own frame (rear edge at the origin), tilted down towards the front.
  const tilt = new Matrix4().makeTranslation(0, rearY, outer).multiply(new Matrix4().makeRotationX(slope));
  builder.box(
    { minX: -width / 2, maxX: width / 2, minY: -0.015, maxY: 0, minZ: 0, maxZ: AWNING_DEPTH },
    { py: 'fabric', pz: 'fabric', px: 'fabric', nx: 'fabric' },
    { uv: fabricUv, transform: tilt },
  );
  // Valance hanging vertically from the front edge.
  const frontZ = outer + AWNING_DEPTH * Math.cos(slope);
  builder.box(
    { minX: -width / 2, maxX: width / 2, minY: frontY - VALANCE, maxY: frontY, minZ: frontZ - 0.01, maxZ: frontZ + 0.012 },
    { pz: 'fabric', nz: 'fabric', px: 'fabric', nx: 'fabric' },
    { uv: fabricUv },
  );
  // Frame: rail on the wall and two tilted side arms under the fabric.
  const metalFaces = { pz: 'metal', nz: 'metal', px: 'metal', nx: 'metal', py: 'metal' } as const;
  builder.box({ minX: -width / 2, maxX: width / 2, minY: rearY - 0.05, maxY: rearY + 0.005, minZ: outer, maxZ: outer + 0.04 }, metalFaces);
  for (const x of [-width / 2 + 0.05, width / 2 - 0.05]) {
    builder.box(
      { minX: x - 0.015, maxX: x + 0.015, minY: -0.045, maxY: -0.015, minZ: 0, maxZ: AWNING_DEPTH },
      metalFaces,
      { transform: tilt },
    );
  }
  for (const mesh of builder.build({ fabric: m.awningTop, metal: m.metal }, 'kiosk.awning')) rig.add(mesh);
  ctx.upper[o.side].add(rig);
  return { frontY, reach: AWNING_DEPTH * Math.cos(slope) };
}
