import { Group } from 'three';
import { createOpeningRig, type KioskContext } from './context';
import { createScalableGroup } from './parts';
import { SolidBuilder, planarUv, type FaceKey } from './solid';

/**
 * K-001-E entrance door: cream frame (jambs, head), stone threshold, doormats, and an inward-swinging
 * teal leaf with raised panels, a glass inset, kick plate, lever handle and hinges. The leaf is split at
 * the cut height: the lower half stays, the upper half is a cut group of its wall side.
 */

export const DOOR_OPEN_ANGLE = Math.PI / 2;
const FRAME_WIDTH = 0.07;
const FRAME_OUT = 0.03;
const LEAF_T = 0.05;
const THRESHOLD_TOP = 0.04;

const allFaces = (name: string): Partial<Record<FaceKey, string>> => ({ pz: name, nz: name, px: name, nx: name, py: name });

export function buildDoor(ctx: KioskContext): void {
  const o = ctx.door;
  if (!o) return;
  const { m } = ctx;
  const { rig: upperRig, frame } = createOpeningRig(ctx, o, 'kiosk.door.upper');
  const { rig: fixedRig } = createOpeningRig(ctx, o, 'kiosk.door.fixed');
  const hw = frame.halfWidth;
  const tw = frame.halfWall;
  const outer = tw;
  const inner = -tw;
  const cut = ctx.cut;

  // --- frame (jambs split at the cut), threshold, mats
  const frameLower = new SolidBuilder();
  const frameUpper = new SolidBuilder();
  const zFrom = inner;
  const zTo = outer + FRAME_OUT;
  for (const [x0, x1] of [
    [-hw, -hw + FRAME_WIDTH],
    [hw - FRAME_WIDTH, hw],
  ] as const) {
    frameLower.box({ minX: x0, maxX: x1, minY: 0, maxY: cut, minZ: zFrom, maxZ: zTo }, allFaces('frame'));
    frameUpper.box({ minX: x0, maxX: x1, minY: cut, maxY: o.head - FRAME_WIDTH, minZ: zFrom, maxZ: zTo }, allFaces('frame'));
  }
  frameUpper.box({ minX: -hw, maxX: hw, minY: o.head - FRAME_WIDTH, maxY: o.head, minZ: zFrom, maxZ: zTo }, allFaces('frame'));
  for (const part of frameLower.build({ frame: m.frame }, 'kiosk.door.frame.lower')) fixedRig.add(part);
  for (const part of frameUpper.build({ frame: m.frame }, 'kiosk.door.frame.upper')) upperRig.add(part);

  const flat = new SolidBuilder();
  flat.box({ minX: -hw, maxX: hw, minY: 0, maxY: THRESHOLD_TOP, minZ: inner, maxZ: outer + 0.12 }, { pz: 'stone', px: 'stone', nx: 'stone', py: 'stone' });
  for (const part of flat.build({ stone: m.threshold }, 'kiosk.door.threshold')) fixedRig.add(part);
  // Doormats: one outside in front of the threshold, one inside on the floor (floor top = 0.03).
  const mats = new SolidBuilder();
  const matUv = planarUv(1, 1);
  const outsideTop = 0.04;
  mats.box(
    { minX: -hw + 0.1, maxX: hw - 0.1, minY: 0.03, maxY: outsideTop, minZ: outer + 0.16, maxZ: outer + 0.66 },
    { py: 'mat', pz: 'mat', px: 'mat', nx: 'mat', nz: 'mat' },
    { uv: matUv },
  );
  mats.box(
    { minX: -hw + 0.1, maxX: hw - 0.1, minY: 0.03, maxY: 0.042, minZ: inner - 0.6, maxZ: inner - 0.1 },
    { py: 'mat', pz: 'mat', px: 'mat', nx: 'mat', nz: 'mat' },
    { uv: matUv },
  );
  for (const part of mats.build({ mat: m.doormat }, 'kiosk.door.mat')) fixedRig.add(part);

  // --- leaf: pivot at the hinge side (+X); the leaf extends towards -X and swings inward (-Y rotation)
  const leafW = 2 * hw - 2 * FRAME_WIDTH - 0.02;
  const leafBottom = 0.03;
  const leafTop = o.head - FRAME_WIDTH - 0.01;
  const hingeX = hw - FRAME_WIDTH;
  const leafZ = (outer + inner) / 2;
  const pivot = new Group();
  pivot.name = 'kiosk.door.leaf';
  pivot.position.set(hingeX, 0, leafZ);

  const lower = new SolidBuilder();
  const upper = new SolidBuilder();
  const leafX0 = -leafW;
  const leafX1 = 0;
  const h = LEAF_T / 2;
  lower.box({ minX: leafX0, maxX: leafX1, minY: leafBottom, maxY: cut, minZ: -h, maxZ: h }, allFaces('paint'));
  upper.box({ minX: leafX0, maxX: leafX1, minY: cut, maxY: leafTop, minZ: -h, maxZ: h }, allFaces('paint'));
  // raised lower panels on both faces
  const panel = { minX: leafX0 + 0.13, maxX: leafX1 - 0.13, minY: leafBottom + 0.2, maxY: cut - 0.12 };
  lower.box({ ...panel, minZ: h, maxZ: h + 0.012 }, { pz: 'paintDark', px: 'paintDark', nx: 'paintDark', py: 'paintDark' });
  lower.box({ ...panel, minZ: -h - 0.012, maxZ: -h }, { nz: 'paintDark', px: 'paintDark', nx: 'paintDark', py: 'paintDark' });
  // kick plate
  lower.box({ minX: leafX0 + 0.04, maxX: leafX1 - 0.04, minY: leafBottom, maxY: leafBottom + 0.14, minZ: h, maxZ: h + 0.008 }, { pz: 'metal', py: 'metal', px: 'metal', nx: 'metal' });
  // lever handles (both sides) at 0.9 m, hinge knuckles
  const handleX = leafX0 + 0.1;
  lower.box({ minX: handleX - 0.018, maxX: handleX + 0.018, minY: 0.82, maxY: 0.98, minZ: h, maxZ: h + 0.05 }, allFaces('metal'));
  lower.box({ minX: handleX - 0.018, maxX: handleX + 0.018, minY: 0.82, maxY: 0.98, minZ: -h - 0.05, maxZ: -h }, allFaces('metal'));
  lower.box({ minX: handleX - 0.1, maxX: handleX + 0.018, minY: 0.9, maxY: 0.935, minZ: h + 0.03, maxZ: h + 0.058 }, allFaces('metal'));
  const knuckleX = leafX1 - 0.02;
  lower.box({ minX: knuckleX - 0.02, maxX: knuckleX + 0.02, minY: 0.25, maxY: 0.37, minZ: h, maxZ: h + 0.02 }, allFaces('metal'));
  upper.box({ minX: knuckleX - 0.02, maxX: knuckleX + 0.02, minY: 1.65, maxY: 1.77, minZ: h, maxZ: h + 0.02 }, allFaces('metal'));
  // glass inset with a raised frame
  const glassX0 = leafX0 + 0.14;
  const glassX1 = leafX1 - 0.14;
  const glassY0 = cut + 0.22;
  const glassY1 = leafTop - 0.14;
  upper.box({ minX: glassX0 - 0.03, maxX: glassX1 + 0.03, minY: glassY0 - 0.03, maxY: glassY1 + 0.03, minZ: h, maxZ: h + 0.012 }, { pz: 'paintDark', px: 'paintDark', nx: 'paintDark', py: 'paintDark' });
  upper.box({ minX: glassX0 - 0.03, maxX: glassX1 + 0.03, minY: glassY0 - 0.03, maxY: glassY1 + 0.03, minZ: -h - 0.012, maxZ: -h }, { nz: 'paintDark', px: 'paintDark', nx: 'paintDark', py: 'paintDark' });
  upper.box({ minX: glassX0, maxX: glassX1, minY: glassY0, maxY: glassY1, minZ: h, maxZ: h + 0.016 }, { pz: 'glass' });
  upper.box({ minX: glassX0, maxX: glassX1, minY: glassY0, maxY: glassY1, minZ: -h - 0.016, maxZ: -h }, { nz: 'glass' });

  const materials = { paint: m.paintTeal, paintDark: m.paintTealDark, metal: m.metal, glass: m.glass };
  for (const part of lower.build(materials, 'kiosk.door.leaf.lower')) pivot.add(part);
  const { wrapper, content } = createScalableGroup('kiosk.cut.door', cut);
  for (const part of upper.build(materials, 'kiosk.door.leaf.upper')) content.add(part);
  pivot.add(wrapper);
  ctx.cutExtras[o.side].push(wrapper);
  fixedRig.add(pivot); // the lower leaf never hides; the upper leaf is its own cut group

  ctx.animated['door'] = {
    setOpen(amount: number): void {
      pivot.rotation.y = -DOOR_OPEN_ANGLE * amount;
    },
  };
  ctx.animated['door'].setOpen(0);

  ctx.upper[o.side].add(upperRig);
  ctx.fixed.add(fixedRig);
  ctx.fixtures.push(pivot);
}
