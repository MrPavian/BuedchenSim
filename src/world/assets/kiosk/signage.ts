import { createOpeningRig, type KioskContext } from './context';
import { KIOSK_NAMES } from './parts';
import { SolidBuilder } from './solid';

/**
 * K-001-G signage: the layout's fictional name on a lightbox fascia above the sales window (text on the
 * outward face, never mirrored), plus a small generic enamel plate above the door.
 */

export const SIGN_HEIGHT = 0.48;
export const SIGN_TOP_GAP = 0.04; // below the roof slab
const SIGN_DEPTH = 0.12;
const PLATE_TEXT = 'Trinkhalle';

/** Returns the lower edge of the sign (used to mount the awning below it). */
export function buildSignage(ctx: KioskContext): number {
  const { kiosk, m } = ctx;
  const o = ctx.salesWindow;
  const top = kiosk.height - SIGN_TOP_GAP;
  const bottom = top - SIGN_HEIGHT;
  if (o) {
    const { rig, frame } = createOpeningRig(ctx, o, KIOSK_NAMES.sign);
    const wallLength = 2 * frame.halfWidth + 1.0;
    const width = Math.min(3.6, wallLength);
    const outer = frame.halfWall;
    const builder = new SolidBuilder();
    builder.box(
      { minX: -width / 2, maxX: width / 2, minY: bottom, maxY: top, minZ: outer, maxZ: outer + SIGN_DEPTH },
      { pz: 'face', px: 'body', nx: 'body', py: 'body' },
      { uv: (x, y) => [(x + width / 2) / width, (y - bottom) / SIGN_HEIGHT] },
    );
    // Two mounting brackets under the box.
    for (const x of [-width / 2 + 0.3, width / 2 - 0.3]) {
      builder.box({ minX: x - 0.03, maxX: x + 0.03, minY: bottom - 0.04, maxY: bottom, minZ: outer, maxZ: outer + 0.06 }, { pz: 'body', px: 'body', nx: 'body' });
    }
    for (const mesh of builder.build({ face: m.signFace(kiosk.signText, width, SIGN_HEIGHT), body: m.metal }, 'kiosk.sign')) rig.add(mesh);
    ctx.upper[o.side].add(rig);
    ctx.fixtures.push(rig);
  }

  const door = ctx.door;
  if (door) {
    const { rig, frame } = createOpeningRig(ctx, door, 'kiosk.plate');
    const w = Math.min(0.9, 2 * frame.halfWidth - 0.1);
    const h = 0.22;
    const y0 = door.head + 0.18;
    const outer = frame.halfWall;
    const builder = new SolidBuilder();
    builder.box(
      { minX: -w / 2, maxX: w / 2, minY: y0, maxY: y0 + h, minZ: outer, maxZ: outer + 0.03 },
      { pz: 'face', px: 'body', nx: 'body', py: 'body' },
      { uv: (x, y) => [(x + w / 2) / w, (y - y0) / h] },
    );
    for (const mesh of builder.build({ face: m.plateFace(PLATE_TEXT, w, h), body: m.metal }, 'kiosk.plate')) rig.add(mesh);
    ctx.upper[door.side].add(rig);
    ctx.fixtures.push(rig);
  }
  return bottom;
}
