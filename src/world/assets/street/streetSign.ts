import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { taper } from './geo';
import { getStreetMaterials } from './materials';

/** Fictional street name on the sign. */
export const STREET_NAME = 'Kokereistraße';

/** White enamel plate with a dark border and the street name; null without a DOM (node tests). */
export function createStreetSignTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 114;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#f2efe4';
  ctx.fillRect(0, 0, 512, 114);
  ctx.strokeStyle = '#24364f';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 102);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 480, 82);
  ctx.fillStyle = '#24364f';
  ctx.font = 'bold 54px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STREET_NAME, 256, 60, 440);
  // Weathering: a few light scratches.
  ctx.strokeStyle = 'rgba(120,120,110,0.25)';
  ctx.lineWidth = 1;
  for (const [x, y] of [[60, 30], [380, 84], [210, 22]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26, y + 6);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * E-012 Straßenschild (0.9 x 0.08 x 2.6 m). Steel post with a cap, two brackets and a white plate (0.9 x 0.2) carrying the
 * fictional street name "Kokereistraße" on both faces. Front = +Z.
 */
export function createStreetSignE012(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const b = new PartBuilder({ vertexColors: s.baked });
  const postR = d * 0.375;
  const plateT = d / 2 - postR;
  const plateH = 0.2;
  const plateTop = h - 0.1;
  b.geometry(s.signPost, taper(postR, postR, 0, h - 0.02, 0, 0, 8));
  b.geometry(s.signPost, taper(postR * 1.35, postR * 1.35, h - 0.03, h, 0, 0, 8));
  // Plate body (dark edge) and two clamps.
  b.box(s.signBorder, -w / 2, w / 2, plateTop - plateH, plateTop, -postR - plateT / 2 + 0.002, postR + plateT / 2 - 0.002);
  for (const y of [plateTop - 0.04, plateTop - plateH + 0.04]) {
    b.box(s.signPost, -postR * 1.4, postR * 1.4, y - 0.015, y + 0.015, -d / 2, d / 2);
  }
  const root = b.build(asset.assetId);

  const texture = createStreetSignTexture();
  const face = texture ? new MeshLambertMaterial({ map: texture, name: 'signFace' }) : s.signPlate;
  if (texture) m.textures.push(texture);
  const faces = [0, Math.PI].map((ry) =>
    new PlaneGeometry(w - 0.01, plateH - 0.01).rotateY(ry).translate(0, plateTop - plateH / 2, ry === 0 ? d / 2 + 0.0003 : -d / 2 - 0.0003),
  );
  const merged = mergeGeometries(faces, false);
  if (!merged) throw new Error('Could not merge sign faces');
  faces.forEach((g) => g.dispose());
  const plane = new Mesh(merged, face);
  plane.name = `${asset.assetId}.face`;
  plane.receiveShadow = true;
  root.add(plane);
  return root;
}
