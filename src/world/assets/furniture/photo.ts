import { CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace, type Material, type Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import { rng } from '../kiosk/textures';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';
import { getFurnitureMaterials } from './materials';

const PHOTO_W = 192;
const PHOTO_H = 240;

/**
 * The picture of I-013: a faded sepia snapshot of a small kiosk with a striped awning and a sign that cannot be
 * read (scribble only, no brand), a pale sky, a wet pavement, and "1972" in small handwriting in the lower corner.
 * Null without a DOM (node tests); the caller then uses a flat colour.
 */
export function createKioskPhotoTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rand = rng(1972);

  // Sky and ground.
  const sky = ctx.createLinearGradient(0, 0, 0, PHOTO_H * 0.62);
  sky.addColorStop(0, '#d8cdb4');
  sky.addColorStop(1, '#eee4cc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.fillStyle = '#a89a80';
  ctx.fillRect(0, PHOTO_H * 0.72, PHOTO_W, PHOTO_H * 0.28);
  ctx.fillStyle = '#8f8068';
  ctx.fillRect(0, PHOTO_H * 0.72, PHOTO_W, 4);

  // Neighbouring building edge (dark) on the left.
  ctx.fillStyle = '#9b8c72';
  ctx.fillRect(0, 20, 26, PHOTO_H * 0.72 - 20);

  // The kiosk: body, roof, window, door.
  const bx = 42;
  const by = 94;
  const bw = 112;
  const bh = 96;
  ctx.fillStyle = '#7c6c54';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#5d5040';
  ctx.fillRect(bx - 6, by - 14, bw + 12, 14);
  // Sign board with illegible scribble.
  ctx.fillStyle = '#e9dfc6';
  ctx.fillRect(bx + 10, by - 12, bw - 20, 10);
  ctx.strokeStyle = '#6a5c48';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + 14, by - 6);
  for (let x = bx + 14; x < bx + bw - 14; x += 5) ctx.lineTo(x, by - 6 + (rand() - 0.5) * 6);
  ctx.stroke();
  // Sales window and striped awning.
  ctx.fillStyle = '#d8ceb6';
  ctx.fillRect(bx + 10, by + 24, 62, 44);
  ctx.fillStyle = '#4e4332';
  ctx.fillRect(bx + 14, by + 36, 54, 28);
  const stripes = 9;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#b0a28a' : '#f0e8d4';
    ctx.fillRect(bx + 4 + (i * (bw - 8)) / stripes, by + 6, (bw - 8) / stripes, 22);
  }
  ctx.fillStyle = '#6a5c48';
  ctx.fillRect(bx + 4, by + 28, bw - 8, 3);
  // Door and a leaning crate.
  ctx.fillStyle = '#5d5040';
  ctx.fillRect(bx + 84, by + 26, 20, 70);
  ctx.fillStyle = '#8a7a60';
  ctx.fillRect(bx + 4, by + 76, 26, 20);

  // Age: sepia veil, scratches, vignette, border.
  ctx.fillStyle = 'rgba(176, 140, 88, 0.22)';
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.strokeStyle = 'rgba(255, 250, 235, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i += 1) {
    const x = rand() * PHOTO_W;
    ctx.beginPath();
    ctx.moveTo(x, rand() * 40);
    ctx.lineTo(x + (rand() - 0.5) * 12, 80 + rand() * (PHOTO_H - 80));
    ctx.stroke();
  }
  const vignette = ctx.createRadialGradient(PHOTO_W / 2, PHOTO_H / 2, 60, PHOTO_W / 2, PHOTO_H / 2, 160);
  vignette.addColorStop(0, 'rgba(60, 40, 20, 0)');
  vignette.addColorStop(1, 'rgba(60, 40, 20, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);

  // Handwritten year in the lower right corner.
  ctx.fillStyle = 'rgba(48, 36, 24, 0.85)';
  ctx.font = 'italic 18px "Segoe Script", "Bradley Hand", cursive';
  ctx.save();
  ctx.translate(PHOTO_W - 62, PHOTO_H - 12);
  ctx.rotate(-0.06);
  ctx.fillText('1972', 0, 0);
  ctx.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * I-013 Gerahmtes Kioskfoto (0.32 x 0.10 x 0.40 m). A small wooden stand (base plate, rear strut) carrying a
 * dark wooden frame with a cream passepartout and the old kiosk photo, leaning back by a few degrees. The frame
 * is sized so the whole object fits the catalog box exactly (width = base plate, top = catalog height).
 */
export function createPhotoI013(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const f = getFurnitureMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const baseT = 0.02;
  const frameD = 0.022;
  const frameW = w - 0.02;

  // Lean angle so the frame just fits the depth of the base: (H/2) sin t + (frameD/2) cos t = d/2.
  let tilt = 0.2;
  const approxH = h - baseT;
  const sin = (d / 2 - frameD / 2) / (approxH / 2);
  if (sin > 0.03 && sin < 0.6) tilt = Math.asin(sin);
  const frameH = (h - baseT - frameD * Math.sin(tilt)) / Math.cos(tilt);
  const cy = baseT + (frameH / 2) * Math.cos(tilt) + (frameD / 2) * Math.sin(tilt);

  b.box(f.photoStand, -hw, hw, 0, baseT, -hd, hd);
  b.box(f.photoStand, -hw + 0.02, hw - 0.02, baseT, baseT + 0.012, hd - 0.03, hd - 0.012); // front lip
  // Rear strut: a thin bar from the frame back down to the base.
  b.bar(f.photoStand, [0, baseT, -hd + 0.005], [0, cy + 0.02, -(frameH / 2 - 0.1) * Math.sin(tilt) - frameD / 2 - 0.004], 0.012);

  // Frame: dark wood body plus a cream passepartout slightly proud of it; the picture goes on top.
  const matW = frameW - 0.04;
  const matH = frameH - 0.04;
  b.tilted(f.photoFrame, frameW, frameH, frameD, 0, cy, 0, -tilt);
  const nz = [0, Math.sin(tilt), Math.cos(tilt)] as const; // frame normal (front face)
  const off = frameD / 2 + 0.0008;
  b.tilted(f.photoMat, matW, matH, 0.0016, 0, cy + nz[1] * off, nz[2] * off, -tilt);
  const group = b.build(asset.assetId);

  // The picture itself (a plane in front of the passepartout).
  const texture = createKioskPhotoTexture();
  let material: Material = f.photoBlank;
  if (texture) {
    m.textures.push(texture);
    material = new MeshLambertMaterial({ map: texture, emissive: 0x2a2418 });
  }
  const picW = matW - 0.05;
  const picH = matH - 0.05;
  const picture = new Mesh(new PlaneGeometry(picW, picH), material);
  const poff = frameD / 2 + 0.0022;
  picture.position.set(0, cy + nz[1] * poff, nz[2] * poff);
  picture.rotation.x = -tilt;
  picture.name = `${asset.assetId}.picture`;
  group.add(picture);
  return group;
}
