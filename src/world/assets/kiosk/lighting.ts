import { BoxGeometry, CylinderGeometry, PointLight } from 'three';
import { createOpeningRig, mesh, type KioskContext } from './context';
import { VALANCE, type AwningInfo } from './awning';

/**
 * K-001-H lighting: three real point lights (no shadows; the sun is the only shadow caster)
 * - warm interior lamp,
 * - wall lamp between window and door (emissive fixture on the facade),
 * - a soft strip light under the awning.
 * Lights live in the always-visible `fixed` group so the light count (shader variant) never changes
 * when the dollhouse cut hides a wall; only their emissive fixtures belong to the cut-away facade.
 */

export const LIGHT_COUNT = 3;

export function buildLighting(ctx: KioskContext, awning: AwningInfo | null): PointLight[] {
  const { kiosk, m } = ctx;
  const fp = kiosk.footprint;
  const lights: PointLight[] = [];

  // Auftrag 04.5: 11 instead of 14 – with tone mapping the lamp no longer blows out what is right below it.
  const interior = new PointLight(0xffc27a, 11, 8, 2);
  interior.name = 'kiosk.light.interior';
  interior.position.set(0, kiosk.height - 1.0, 0);
  ctx.fixed.add(interior);
  lights.push(interior);

  const w = ctx.salesWindow;
  const d = ctx.door;
  if (!w || !d || w.side !== d.side || d.side !== 'south') return lights;

  // Wall lamp halfway between the window and the door, above the door lintel line.
  const { rig: doorRig, frame: df } = createOpeningRig(ctx, d, 'kiosk.lamp.door');
  const lampWorldX = (w.to + d.from) / 2;
  const localX = lampWorldX - (d.from + d.to) / 2; // south: rig +x = world +x
  const lampY = d.head + 0.25;
  const outer = df.halfWall;
  const arm = mesh(new BoxGeometry(0.04, 0.04, 0.18), m.metal, 'kiosk.fixture.lamp.arm', true, false);
  arm.position.set(localX, lampY, outer + 0.09);
  const housing = mesh(new CylinderGeometry(0.07, 0.09, 0.14, 10), m.metal, 'kiosk.fixture.lamp.housing', true, false);
  housing.position.set(localX, lampY, outer + 0.2);
  const glow = mesh(new BoxGeometry(0.1, 0.03, 0.1), m.lampGlow, 'kiosk.fixture.lamp.glow', false, false);
  glow.position.set(localX, lampY - 0.085, outer + 0.2);
  doorRig.add(arm, housing, glow);
  ctx.upper[d.side].add(doorRig);
  ctx.fixtures.push(arm, housing, glow);

  const doorLight = new PointLight(0xffd9a0, 1.6, 2.6, 2);
  doorLight.name = 'kiosk.light.door';
  doorLight.position.set(lampWorldX - ctx.cx, lampY - 0.15, fp.maxZ - ctx.cz + 0.2);
  ctx.fixed.add(doorLight);
  lights.push(doorLight);

  if (awning) {
    const wx = (w.from + w.to) / 2 - ctx.cx;
    const stripLight = new PointLight(0xffd9a0, 4.2, 3.2, 2);
    stripLight.name = 'kiosk.light.awning';
    stripLight.position.set(wx, awning.frontY - VALANCE - 0.12, fp.maxZ - ctx.cz + awning.reach - 0.1);
    ctx.fixed.add(stripLight);
    lights.push(stripLight);

    const { rig, frame } = createOpeningRig(ctx, w, 'kiosk.lamp.strip');
    const strip = mesh(new BoxGeometry(2 * frame.halfWidth - 0.2, 0.025, 0.04), m.lampGlow, 'kiosk.fixture.strip', false, false);
    strip.position.set(0, awning.frontY - VALANCE - 0.02, frame.halfWall + awning.reach - 0.05);
    rig.add(strip);
    ctx.upper[w.side].add(rig);
    ctx.fixtures.push(strip);
  }
  return lights;
}
