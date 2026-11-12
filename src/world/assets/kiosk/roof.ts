import { BoxGeometry, ConeGeometry, CylinderGeometry } from 'three';
import { mesh, type KioskContext } from './context';
import { SolidBuilder, planarUv, type FaceKey } from './solid';
import { ROOF_TILE } from './textures';

/**
 * K-001-F roof: flat roof slab with a slight overhang, plaster parapet (attika) with a zinc coping,
 * small roof vents, plus the rainwater gutter and downpipe on the east side.
 */

const OVERHANG = 0.1;
const SLAB = 0.1;
const PARAPET_HEIGHT = 0.28;
const PARAPET_THICK = 0.14;
const COPING_HEIGHT = 0.04;
const COPING_OUT = 0.04;

export function buildRoof(ctx: KioskContext): void {
  const { kiosk, m } = ctx;
  const fp = kiosk.footprint;
  const h = kiosk.height;
  const x0 = fp.minX - ctx.cx - OVERHANG;
  const x1 = fp.maxX - ctx.cx + OVERHANG;
  const z0 = fp.minZ - ctx.cz - OVERHANG;
  const z1 = fp.maxZ - ctx.cz + OVERHANG;
  const builder = new SolidBuilder({ x: ctx.cx, z: ctx.cz });
  const roofUv = planarUv(ROOF_TILE, ROOF_TILE);

  // Slab: fascia on all four sides, membrane on top.
  builder.box(
    { minX: x0, maxX: x1, minY: h, maxY: h + SLAB, minZ: z0, maxZ: z1 },
    { pz: 'fascia', nz: 'fascia', px: 'fascia', nx: 'fascia', py: 'roofTop' },
    { uv: roofUv },
  );

  // Parapet: outer face plaster, inner face plaster, ends covered by the neighbours.
  const pY0 = h + SLAB;
  const pY1 = pY0 + PARAPET_HEIGHT;
  const t = PARAPET_THICK;
  const both = (faces: Partial<Record<FaceKey, string>>) => faces;
  builder.box(
    { minX: x0, maxX: x1, minY: pY0, maxY: pY1, minZ: z1 - t, maxZ: z1 },
    both({ pz: 'band', nz: 'band', px: 'band', nx: 'band' }),
    { uv: roofUv },
  );
  builder.box(
    { minX: x0, maxX: x1, minY: pY0, maxY: pY1, minZ: z0, maxZ: z0 + t },
    both({ pz: 'band', nz: 'band', px: 'band', nx: 'band' }),
    { uv: roofUv },
  );
  builder.box(
    { minX: x1 - t, maxX: x1, minY: pY0, maxY: pY1, minZ: z0 + t, maxZ: z1 - t },
    both({ px: 'band', nx: 'band' }),
    { uv: roofUv },
  );
  builder.box(
    { minX: x0, maxX: x0 + t, minY: pY0, maxY: pY1, minZ: z0 + t, maxZ: z1 - t },
    both({ px: 'band', nx: 'band' }),
    { uv: roofUv },
  );
  // Coping: a zinc cap over the whole parapet ring (four overlapping caps).
  const c = COPING_OUT;
  const cY1 = pY1 + COPING_HEIGHT;
  const copingFaces = { pz: 'coping', nz: 'coping', px: 'coping', nx: 'coping', py: 'coping' } as const;
  builder.box({ minX: x0 - c, maxX: x1 + c, minY: pY1, maxY: cY1, minZ: z1 - t - c, maxZ: z1 + c }, copingFaces, { uv: roofUv });
  builder.box({ minX: x0 - c, maxX: x1 + c, minY: pY1, maxY: cY1, minZ: z0 - c, maxZ: z0 + t + c }, copingFaces, { uv: roofUv });
  builder.box({ minX: x1 - t - c, maxX: x1 + c, minY: pY1, maxY: cY1, minZ: z0, maxZ: z1 }, copingFaces, { uv: roofUv });
  builder.box({ minX: x0 - c, maxX: x0 + t + c, minY: pY1, maxY: cY1, minZ: z0, maxZ: z1 }, copingFaces, { uv: roofUv });
  for (const mm of builder.build(m.buckets, 'kiosk.roof')) ctx.roof.add(mm);

  // Roof details: ventilation pipe with a cap, a small hatch/vent box.
  const vent = mesh(new CylinderGeometry(0.06, 0.06, 0.55, 10), m.metal, 'kiosk.roof.vent');
  vent.position.set(-2.1, pY0 + 0.275, -1.1);
  const ventCap = mesh(new ConeGeometry(0.11, 0.1, 10), m.metal, 'kiosk.roof.vent.cap');
  ventCap.position.set(-2.1, pY0 + 0.6, -1.1);
  const hatch = mesh(new BoxGeometry(0.55, 0.32, 0.45), m.zinc, 'kiosk.roof.hatch');
  hatch.position.set(1.7, pY0 + 0.16, -0.9);
  const hatchLid = mesh(new BoxGeometry(0.63, 0.04, 0.53), m.metal, 'kiosk.roof.hatch.lid');
  hatchLid.position.set(1.7, pY0 + 0.34, -0.9);
  ctx.roof.add(vent, ventCap, hatch, hatchLid);
}

/**
 * Rainwater: a gutter under the east overhang and a downpipe on the east wall's south end.
 * The pipe is split at the cut height so the lower part stays when the wall is cut down.
 */
export function buildRainwater(ctx: KioskContext): void {
  const { kiosk, m } = ctx;
  const fp = kiosk.footprint;
  const eastX = fp.maxX - ctx.cx;
  const zPipe = fp.maxZ - ctx.cz - 0.2;
  const xPipe = eastX + 0.08;
  const gutterTop = kiosk.height - 0.01;
  const gutterBottom = gutterTop - 0.07;

  const gutter = mesh(
    new BoxGeometry(0.07, gutterTop - gutterBottom, fp.maxZ - fp.minZ - 0.1),
    m.metal,
    'kiosk.fixture.gutter',
  );
  gutter.position.set(eastX + 0.07, (gutterTop + gutterBottom) / 2, 0);
  ctx.upper.east.add(gutter);

  const pipeBottom = 0.14;
  const pipeTop = gutterBottom;
  const pipe = (y0: number, y1: number, name: string) => {
    const p = mesh(new CylinderGeometry(0.04, 0.04, y1 - y0, 10), m.metal, name);
    p.position.set(xPipe, (y0 + y1) / 2, zPipe);
    return p;
  };
  const lower = pipe(pipeBottom, ctx.cut, 'kiosk.fixture.downpipe.lower');
  const upper = pipe(ctx.cut, pipeTop, 'kiosk.fixture.downpipe.upper');
  ctx.fixed.add(lower);
  ctx.upper.east.add(upper);
  // Two clamps against the wall.
  for (const y of [0.7, 2.2]) {
    const clamp = mesh(new BoxGeometry(0.07, 0.05, 0.1), m.metal, 'kiosk.fixture.downpipe.clamp');
    clamp.position.set(eastX + 0.045, y, zPipe);
    (y < ctx.cut ? ctx.fixed : ctx.upper.east).add(clamp);
  }
  // Foot elbow pointing away from the wall.
  const foot = mesh(new BoxGeometry(0.1, 0.07, 0.07), m.metal, 'kiosk.fixture.downpipe.foot');
  foot.position.set(xPipe + 0.06, pipeBottom - 0.02, zPipe);
  ctx.fixed.add(foot);
  ctx.fixtures.push(lower, upper, gutter);
}
