import { CylinderGeometry, Group, Quaternion, Vector3, type Mesh } from 'three';
import { createOpeningRig, mesh, type KioskContext } from './context';
import { SolidBuilder, type FaceKey } from './solid';

/**
 * K-001-D sales window: frame (jambs and head), outer zinc ledge (Fensterbank) at counter height,
 * and a top-hinged flap that swings outward and up, held by two telescoping stays. The flap sits
 * in front of the frame when closed and rests slightly above horizontal when open, so it never
 * collides with the awning (which is mounted higher, see awning.ts).
 */

/** Open angle from hanging (0) in radians; slightly past horizontal. */
export const FLAP_OPEN_ANGLE = (98 * Math.PI) / 180;
export const LEDGE_DEPTH = 0.28;
const FRAME_WIDTH = 0.06;
const FRAME_OUT = 0.03;
const FLAP_OVERLAP = 0.1; // flap is wider than the opening by this much on each side
const HINGE_ABOVE_HEAD = 0.06;
const FLAP_BOTTOM_GAP = 0.02; // above the sill
const STAY_ANCHOR_Y = 1.75;

export function buildSalesWindow(ctx: KioskContext): void {
  const o = ctx.salesWindow;
  if (!o) return;
  const { m } = ctx;
  const { rig: upperRig, frame } = createOpeningRig(ctx, o, 'kiosk.window.upper');
  const { rig: fixedRig } = createOpeningRig(ctx, o, 'kiosk.window.fixed');
  const hw = frame.halfWidth;
  const tw = frame.halfWall;
  const outer = tw;
  const inner = -tw;

  // --- frame: jambs and head (above the cut: part of the cut-away facade)
  const frameBuilder = new SolidBuilder();
  const all: Partial<Record<FaceKey, string>> = { pz: 'frame', nz: 'frame', px: 'frame', nx: 'frame', py: 'frame' };
  const zFrom = inner;
  const zTo = outer + FRAME_OUT;
  frameBuilder.box({ minX: -hw, maxX: -hw + FRAME_WIDTH, minY: o.sill, maxY: o.head, minZ: zFrom, maxZ: zTo }, all);
  frameBuilder.box({ minX: hw - FRAME_WIDTH, maxX: hw, minY: o.sill, maxY: o.head, minZ: zFrom, maxZ: zTo }, all);
  frameBuilder.box({ minX: -hw, maxX: hw, minY: o.head - FRAME_WIDTH, maxY: o.head, minZ: zFrom, maxZ: zTo }, all);
  for (const part of frameBuilder.build({ frame: m.frame }, 'kiosk.window.frame')) upperRig.add(part);

  // --- ledge (fixed): zinc slab flush with the counter top, two small corbels underneath
  const ledgeBuilder = new SolidBuilder();
  ledgeBuilder.box(
    { minX: -hw - 0.05, maxX: hw + 0.05, minY: o.sill - 0.05, maxY: o.sill, minZ: outer, maxZ: outer + LEDGE_DEPTH },
    { pz: 'zinc', px: 'zinc', nx: 'zinc', py: 'zinc' },
  );
  for (const x of [-hw + 0.1, hw - 0.1]) {
    ledgeBuilder.box(
      { minX: x - 0.03, maxX: x + 0.03, minY: o.sill - 0.2, maxY: o.sill - 0.05, minZ: outer, maxZ: outer + LEDGE_DEPTH - 0.06 },
      { pz: 'frame', px: 'frame', nx: 'frame' },
    );
  }
  for (const part of ledgeBuilder.build({ zinc: m.zinc, frame: m.frame }, 'kiosk.window.ledge')) fixedRig.add(part);

  // --- flap
  const hingeY = o.head + HINGE_ABOVE_HEAD;
  const hingeZ = outer + 0.07;
  const panelW = 2 * (hw + FLAP_OVERLAP);
  const panelH = hingeY - (o.sill + FLAP_BOTTOM_GAP);
  const panelT = 0.05;
  const pivot = new Group();
  pivot.name = 'kiosk.shutter.flap';
  pivot.position.set(0, hingeY, hingeZ);

  const flapBuilder = new SolidBuilder();
  const faceMaterial = m.flapFace(panelW, panelH);
  flapBuilder.box(
    { minX: -panelW / 2, maxX: panelW / 2, minY: -panelH, maxY: 0, minZ: -panelT / 2, maxZ: panelT / 2 },
    { pz: 'front', nz: 'edge', px: 'edge', nx: 'edge', py: 'edge' },
    { uv: (x, y) => [(x + panelW / 2) / panelW, (y + panelH) / panelH] },
  );
  // Hinge barrels, leaf plates and a pull rail (moving metal).
  const metalMoving = new SolidBuilder();
  const metalAll: Partial<Record<FaceKey, string>> = { pz: 'metal', nz: 'metal', px: 'metal', nx: 'metal', py: 'metal' };
  const hingeXs = [-hw + 0.3, 0, hw - 0.3];
  for (const x of hingeXs) {
    metalMoving.box({ minX: x - 0.07, maxX: x + 0.07, minY: -0.02, maxY: 0.025, minZ: -0.025, maxZ: 0.025 }, metalAll);
    metalMoving.box({ minX: x - 0.07, maxX: x + 0.07, minY: -0.22, maxY: 0, minZ: panelT / 2, maxZ: panelT / 2 + 0.012 }, metalAll);
  }
  metalMoving.box(
    { minX: -0.25, maxX: 0.25, minY: -panelH + 0.1, maxY: -panelH + 0.14, minZ: panelT / 2, maxZ: panelT / 2 + 0.05 },
    metalAll,
  );
  for (const part of flapBuilder.build({ front: faceMaterial, edge: m.paintTeal }, 'kiosk.shutter.panel')) pivot.add(part);
  for (const part of metalMoving.build({ metal: m.metal }, 'kiosk.shutter.metal')) pivot.add(part);
  upperRig.add(pivot);

  // Static hinge straps on the wall (hinge pin at the pivot, plate on the outer wall face).
  const straps = new SolidBuilder();
  for (const x of hingeXs) {
    straps.box({ minX: x - 0.05, maxX: x + 0.05, minY: hingeY - 0.03, maxY: hingeY + 0.03, minZ: outer, maxZ: hingeZ }, metalAll);
  }
  for (const part of straps.build({ metal: m.metal }, 'kiosk.shutter.straps')) upperRig.add(part);

  // --- telescoping stays from a wall anchor to a point on the flap
  const stayX = [-hw - 0.05, hw + 0.05];
  const stayGeometry = new CylinderGeometry(0.014, 0.014, 1, 6);
  const stays: Mesh[] = stayX.map(() => {
    const stay = mesh(stayGeometry, m.metal, 'kiosk.shutter.stay', true, false);
    upperRig.add(stay);
    return stay;
  });
  const anchor = new Vector3();
  const attach = new Vector3();
  const dir = new Vector3();
  const up = new Vector3(0, 1, 0);
  const rotation = new Quaternion();
  const attachR = 0.9;

  const setOpen = (amount: number): void => {
    const theta = FLAP_OPEN_ANGLE * amount;
    pivot.rotation.x = -theta;
    stays.forEach((stay, i) => {
      const x = stayX[i] as number;
      anchor.set(x, STAY_ANCHOR_Y, outer + 0.02);
      attach.set(x, hingeY - attachR * Math.cos(theta), hingeZ + attachR * Math.sin(theta));
      dir.subVectors(attach, anchor);
      const length = dir.length();
      stay.position.copy(anchor).addScaledVector(dir, 0.5);
      stay.quaternion.copy(rotation.setFromUnitVectors(up, dir.normalize()));
      stay.scale.set(1, length, 1);
    });
  };
  setOpen(0);
  ctx.animated['flap'] = { setOpen };

  ctx.upper[o.side].add(upperRig);
  ctx.fixed.add(fixedRig);
  ctx.fixtures.push(pivot);
}
