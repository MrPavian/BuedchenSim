import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

/**
 * I-002 Kasse. Front (+Z) = operator side: cash drawer with a pull slot, a sloped keypad block with
 * light, green and orange keys, and a tilted screen on a rear column (blank, neutral dashes only).
 * Charcoal body, light drawer face, pale green screen.
 */
export function createRegisterI002(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const bodyH = h * 0.46;
  const face = 0.012;

  // Body and drawer face.
  b.box(f.regBody, -hw, hw, 0, bodyH, -hd, hd - face);
  b.box(f.regDrawer, -hw + 0.03, hw - 0.03, h * 0.05, bodyH - h * 0.05, hd - face, hd - 0.004);
  b.box(f.regBody, -w * 0.11, w * 0.11, bodyH * 0.5 - 0.006, bodyH * 0.5 + 0.006, hd - 0.004, hd);

  // Sloped keypad block (front half) with keys.
  const tilt = 0.35;
  const len = d * 0.5;
  const thick = 0.03;
  const kw = w - 0.06;
  const halfZ = (len / 2) * Math.cos(tilt) + (thick / 2) * Math.sin(tilt);
  const halfY = (len / 2) * Math.sin(tilt) + (thick / 2) * Math.cos(tilt);
  const cz = hd - face - halfZ - 0.004;
  const cy = bodyH + halfY;
  b.tilted(f.regBody, kw, thick, len, 0, cy, cz, tilt);
  const alongLen = [0, Math.sin(tilt) * -1, Math.cos(tilt)] as const; // direction towards the +Z end of the slab
  const up = [0, Math.cos(tilt), Math.sin(tilt)] as const;
  const cols = 4;
  const rows = 3;
  const keyW = (kw - 0.06) / cols - 0.008;
  const keyL = (len - 0.05) / rows - 0.008;
  const keyH = 0.012;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u = -len / 2 + 0.025 + (r + 0.5) * ((len - 0.05) / rows);
      const x = -kw / 2 + 0.03 + (c + 0.5) * ((kw - 0.06) / cols);
      const n = thick / 2 + keyH / 2;
      const kx = x;
      const ky = cy + alongLen[1] * u + up[1] * n;
      const kz = cz + alongLen[2] * u + up[2] * n;
      const mat = c === cols - 1 ? (r === 0 ? f.keyGreen : f.keyOrange) : f.keyLight;
      b.tilted(mat, keyW, keyH, keyL, kx, ky, kz, tilt);
    }
  }

  // Rear column and tilted screen (faces the operator, i.e. +Z and up).
  const colD = d * 0.22;
  const colW = w * 0.62;
  b.box(f.regBody, -colW / 2, colW / 2, bodyH, h, -hd, -hd + colD);
  const sTilt = -0.3;
  const plateH = (h - bodyH) * 0.72;
  const sz = -hd + colD + 0.012;
  const sy = h - plateH / 2 - 0.018;
  b.tilted(f.regBody, colW, plateH, 0.02, 0, sy, sz, sTilt);
  const nz = [0, -Math.sin(sTilt), Math.cos(sTilt)] as const; // plate normal
  b.tilted(f.screen, colW - 0.04, plateH - 0.03, 0.006, 0, sy + nz[1] * 0.012, sz + nz[2] * 0.012, sTilt);
  for (let i = 0; i < 3; i += 1) {
    const dy = (i - 1) * plateH * 0.22;
    const dc = Math.cos(sTilt);
    b.tilted(f.screenDash, colW * (i === 1 ? 0.3 : 0.5), 0.012, 0.004, 0, sy + dy * dc + nz[1] * 0.017, sz + dy * Math.sin(sTilt) + nz[2] * 0.017, sTilt);
  }
  return b.build(asset.assetId);
}
