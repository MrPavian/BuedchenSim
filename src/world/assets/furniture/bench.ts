import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * E-004 Hofbank (1.6 x 0.5 x 0.85 m). A yard bench knocked together from offcut planks: two simple dark frames
 * (front leg, tall rear post, seat bearer, stretcher), a seat of four planks and a backrest of two planks in
 * mixed wood tones and slightly different lengths. Front (+Z) = the side one sits facing; the backrest is at -Z.
 * The longest plank spans the full width, so the bounding box equals the catalog size.
 */
export function createBenchE004(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const seatY = h * 0.53; // top of the seat
  const plankT = 0.035;
  const leg = 0.055;
  const frameT = 0.05;
  const frameX = hw - 0.14; // centre of each frame, set in from the plank ends

  // Frames (YZ plane): front leg, rear post up to the top, seat bearer, low stretcher, backrest brace.
  for (const sx of [-1, 1]) {
    const x0 = sx * frameX - frameT / 2;
    const x1 = sx * frameX + frameT / 2;
    b.box(f.benchFrame, x0, x1, 0, seatY - plankT, hd - 0.04 - leg, hd - 0.04);
    b.box(f.benchFrame, x0, x1, 0, h - 0.06, -hd + 0.02, -hd + 0.02 + leg);
    b.box(f.benchFrame, x0, x1, seatY - plankT - 0.045, seatY - plankT, -hd + 0.02, hd - 0.04);
    b.box(f.benchFrame, x0, x1, h * 0.14, h * 0.14 + 0.04, -hd + 0.02, hd - 0.04);
    b.box(f.benchFrame, x0, x1, h - 0.3, h - 0.26, -hd + 0.02 + leg, -hd + 0.02 + leg + 0.08);
  }

  // Seat: four planks across the depth, offcut lengths and tones, offset a little so the ends do not line up.
  const seatPlanks: Array<{ mat: typeof f.benchOak; len: number; shift: number }> = [
    { mat: f.benchOak, len: w, shift: 0 },
    { mat: f.benchPine, len: w - 0.1, shift: 0.04 },
    { mat: f.benchBrown, len: w - 0.04, shift: -0.02 },
    { mat: f.benchGrey, len: w - 0.16, shift: -0.05 },
  ];
  const gap = 0.012;
  const seatDepth = d - 0.1;
  const plankD = (seatDepth - gap * (seatPlanks.length - 1)) / seatPlanks.length;
  seatPlanks.forEach((p, i) => {
    const z1 = hd - i * (plankD + gap);
    b.box(p.mat, p.shift - p.len / 2, p.shift + p.len / 2, seatY - plankT, seatY, z1 - plankD, z1);
  });

  // Backrest: two planks on the rear posts, the upper one reaching exactly to the catalog height.
  const backT = 0.03;
  const backZ0 = -hd;
  const rails = [
    { mat: f.benchPine, len: w - 0.2, shift: -0.05, y1: h - 0.17 },
    { mat: f.benchBrown, len: w - 0.08, shift: 0.03, y1: h },
  ];
  rails.forEach((p) => {
    b.box(p.mat, p.shift - p.len / 2, p.shift + p.len / 2, p.y1 - 0.12, p.y1, backZ0, backZ0 + backT);
  });
  // Seat-to-back support plank behind the seat.
  b.box(f.benchFrame, -frameX, frameX, seatY - 0.12, seatY - 0.05, -hd + 0.02, -hd + 0.05);
  return b.build(asset.assetId);
}
