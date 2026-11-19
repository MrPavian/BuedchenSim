import { TorusGeometry, type BufferGeometry, type Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { cylZ } from './geo';
import { getStreetMaterials } from './materials';

const TYRE = 0.022;

/** Wheel torus in the XY plane, centred at (x, y). 24 tubular segments keep the extent exact. */
function wheel(x: number, y: number, outer: number): BufferGeometry {
  return new TorusGeometry(outer - TYRE, TYRE, 8, 24).translate(x, y, 0);
}

/** Mudguard: a flat band following the upper arc of the wheel. */
function mudguard(x: number, y: number, r: number, from: number, to: number): BufferGeometry {
  return new TorusGeometry(r, 0.006, 4, 10, to - from).rotateZ(from).scale(1, 1, 3.2).translate(x, y, 0);
}

/**
 * E-006 Fahrrad (1.75 x 0.5 x 1.05 m, length along X). Generic city bike: two torus wheels, green diamond frame from
 * bars, fork, seat post and saddle, stem with handlebar and grips, mudguards, rear rack, crank with pedals and a
 * kickstand. No brand lettering. Front wheel at +X.
 */
export function createBikeE006(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const b = new PartBuilder({ vertexColors: s.baked });
  const R = 0.34; // outer wheel radius
  const half = w / 2 - R; // axle x of the front wheel (rear = -half)
  const ay = R;
  const t = 0.028;

  b.geometry(s.bikeTyre, wheel(-half, ay, R));
  b.geometry(s.bikeTyre, wheel(half, ay, R));
  // Rims and hubs.
  b.geometry(s.bikeChrome, new TorusGeometry(R - TYRE * 2 - 0.006, 0.006, 4, 24).translate(-half, ay, 0));
  b.geometry(s.bikeChrome, new TorusGeometry(R - TYRE * 2 - 0.006, 0.006, 4, 24).translate(half, ay, 0));
  b.geometry(s.bikeChrome, cylZ(0.025, -half, ay, -0.04, 0.04));
  b.geometry(s.bikeChrome, cylZ(0.025, half, ay, -0.04, 0.04));
  // Spokes (two crossing bars per wheel keep it light).
  for (const x of [-half, half]) {
    b.bar(s.bikeChrome, [x - R * 0.8, ay - R * 0.5, 0], [x + R * 0.8, ay + R * 0.5, 0], 0.006);
    b.bar(s.bikeChrome, [x - R * 0.8, ay + R * 0.5, 0], [x + R * 0.8, ay - R * 0.5, 0], 0.006);
  }

  // Diamond frame.
  const bb: [number, number, number] = [-half + 0.42, 0.3, 0];
  const seatTop: [number, number, number] = [-half + 0.3, 0.86, 0];
  const headTop: [number, number, number] = [half - 0.13, 0.88, 0];
  const headBot: [number, number, number] = [half - 0.08, 0.7, 0];
  const rearAxle = (z: number): [number, number, number] => [-half, ay, z];
  b.bar(s.bikeFrame, bb, seatTop, t);
  b.bar(s.bikeFrame, seatTop, headTop, t);
  b.bar(s.bikeFrame, bb, headBot, t + 0.006);
  b.bar(s.bikeFrame, headBot, headTop, t + 0.006);
  for (const z of [-0.05, 0.05]) {
    b.bar(s.bikeFrame, [bb[0], bb[1], z], rearAxle(z), 0.02);
    b.bar(s.bikeFrame, [seatTop[0], seatTop[1] - 0.04, z], rearAxle(z), 0.02);
    b.bar(s.bikeChrome, headBot, [half, ay, z], 0.022);
  }
  // Seat post, saddle.
  b.bar(s.bikeChrome, seatTop, [seatTop[0] - 0.02, h - 0.07, 0], 0.025);
  b.box(s.bikeSaddle, seatTop[0] - 0.17, seatTop[0] + 0.07, h - 0.1, h - 0.06, -0.06, 0.06);
  b.box(s.bikeSaddle, seatTop[0] + 0.07, seatTop[0] + 0.13, h - 0.1, h - 0.075, -0.025, 0.025);
  // Stem and handlebar (top of the bar = catalog height, grips at +-d/2).
  b.bar(s.bikeChrome, headTop, [headTop[0] + 0.02, h - 0.03, 0], 0.025);
  b.box(s.bikeChrome, headTop[0] + 0.005, headTop[0] + 0.035, h - 0.03, h, -d / 2 + 0.05, d / 2 - 0.05);
  b.box(s.bikeGrip, headTop[0] + 0.005, headTop[0] + 0.035, h - 0.03, h, d / 2 - 0.05, d / 2);
  b.box(s.bikeGrip, headTop[0] + 0.005, headTop[0] + 0.035, h - 0.03, h, -d / 2, -d / 2 + 0.05);
  // Mudguards over both wheels.
  b.geometry(s.bikeFrame, mudguard(-half, ay, R + 0.005, 0.15, Math.PI * 0.85));
  b.geometry(s.bikeFrame, mudguard(half, ay, R + 0.005, 0.3, Math.PI * 0.8));
  // Rear rack on two struts.
  b.box(s.bikeChrome, -half - 0.22, -half + 0.12, ay + R + 0.065, ay + R + 0.08, -0.06, 0.06);
  for (const z of [-0.05, 0.05]) b.bar(s.bikeChrome, [-half, ay, z], [-half - 0.1, ay + R + 0.065, z], 0.01);
  // Crank, pedals and kickstand.
  b.box(s.bikeChrome, bb[0] - 0.01, bb[0] + 0.01, bb[1] - 0.09, bb[1] + 0.09, -0.005, 0.005);
  b.box(s.bikeGrip, bb[0] - 0.06, bb[0] + 0.06, bb[1] - 0.1, bb[1] - 0.085, 0.09, 0.14);
  b.box(s.bikeGrip, bb[0] - 0.06, bb[0] + 0.06, bb[1] + 0.085, bb[1] + 0.1, -0.14, -0.09);
  b.bar(s.bikeChrome, [-half + 0.1, 0.18, -0.07], [-half + 0.1, 0.02, -0.07], 0.012);
  return b.build(asset.assetId);
}
