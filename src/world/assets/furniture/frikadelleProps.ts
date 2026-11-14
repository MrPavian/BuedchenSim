import { CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace, type Material, type Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import { rng } from '../kiosk/textures';
import type { Materials } from '../../materials';
import { PartBuilder } from './kit';

/** Shared materials of the two Frikadelle props (cached per material set so they are shared between instances). */
interface FrikadelleMaterials {
  frameGreen: MeshLambertMaterial;
  chalkboard: MeshLambertMaterial;
  hinge: MeshLambertMaterial;
  chain: MeshLambertMaterial;
  oak: MeshLambertMaterial;
  oakDark: MeshLambertMaterial;
  enamel: MeshLambertMaterial;
}

const cache = new WeakMap<Materials, FrikadelleMaterials>();

function getMaterials(m: Materials): FrikadelleMaterials {
  const hit = cache.get(m);
  if (hit) return hit;
  const out: FrikadelleMaterials = {
    frameGreen: new MeshLambertMaterial({ color: 0x2f4a38 }),
    chalkboard: new MeshLambertMaterial({ color: 0x1d211f }),
    hinge: new MeshLambertMaterial({ color: 0x7a7d7c }),
    chain: new MeshLambertMaterial({ color: 0x55585a }),
    oak: new MeshLambertMaterial({ color: 0x9a6c3c }),
    oakDark: new MeshLambertMaterial({ color: 0x6e4a28 }),
    enamel: new MeshLambertMaterial({ color: 0xe8dcbc }),
  };
  cache.set(m, out);
  return out;
}

const HAND_FONT = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive';

/** Draws centred text, shrinking the font so it fits `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number, weight = 'bold'): void {
  let s = size;
  ctx.font = `${weight} ${s}px ${HAND_FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxWidth && w > 0) {
    s = Math.floor((s * maxWidth) / w);
    ctx.font = `${weight} ${s}px ${HAND_FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

interface BunPalette {
  bun: string;
  bunLine: string;
  patty: string;
  pattyLine: string;
  seed: string;
}

/** A simple doodle: a bun cut open with a round frikadelle in it. `r` is the half width. */
function drawBun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, p: BunPalette, filled: boolean): void {
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Lower bun half.
  ctx.beginPath();
  ctx.moveTo(cx - r, cy + r * 0.1);
  ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 0.62, cx - r * 0.5, cy + r * 0.62);
  ctx.lineTo(cx + r * 0.5, cy + r * 0.62);
  ctx.quadraticCurveTo(cx + r * 0.95, cy + r * 0.62, cx + r, cy + r * 0.1);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = p.bun;
    ctx.fill();
  }
  ctx.strokeStyle = p.bunLine;
  ctx.stroke();
  // Patty peeking out.
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.86, r * 0.3, 0, 0, Math.PI * 2);
  if (filled) {
    ctx.fillStyle = p.patty;
    ctx.fill();
  }
  ctx.strokeStyle = p.pattyLine;
  ctx.stroke();
  // Upper bun half (dome).
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.08);
  ctx.bezierCurveTo(cx - r * 1.02, cy - r * 0.95, cx + r * 1.02, cy - r * 0.95, cx + r, cy - r * 0.08);
  ctx.quadraticCurveTo(cx, cy + r * 0.12, cx - r, cy - r * 0.08);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = p.bun;
    ctx.fill();
  }
  ctx.strokeStyle = p.bunLine;
  ctx.stroke();
  // Seeds.
  ctx.fillStyle = p.seed;
  for (const [sx, sy] of [
    [-0.4, -0.5],
    [-0.1, -0.62],
    [0.25, -0.55],
    [0.5, -0.38],
    [-0.55, -0.28],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * r, cy + sy * r, r * 0.05, r * 0.028, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const CHALK_W = 256;
const CHALK_H = 480;

/**
 * The chalkboard face of I-014: hand-lettered "FRIKADELLE IM BRÖTCHEN", a bun doodle, "hausgemacht" and the
 * price in white, warm yellow and light ochre chalk. Null without a DOM (node tests).
 */
export function createKundenstopperTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CHALK_W;
  canvas.height = CHALK_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rand = rng(2027);

  ctx.fillStyle = '#1d211f';
  ctx.fillRect(0, 0, CHALK_W, CHALK_H);
  // Old wiped chalk haze.
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(210, 214, 206, ${0.015 + rand() * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(rand() * CHALK_W, rand() * CHALK_H, 30 + rand() * 60, 8 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const white = '#f1efe6';
  const yellow = '#f1d479';
  const ochre = '#d9ae6a';

  // Hand-drawn double border.
  ctx.strokeStyle = ochre;
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, CHALK_W - 20, CHALK_H - 20);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 16, CHALK_W - 32, CHALK_H - 32);

  ctx.fillStyle = yellow;
  fitText(ctx, 'FRIKADELLE', CHALK_W / 2, 78, 50, CHALK_W - 44);
  ctx.fillStyle = white;
  fitText(ctx, 'IM BRÖTCHEN', CHALK_W / 2, 122, 38, CHALK_W - 44);

  // Wavy underline.
  ctx.strokeStyle = ochre;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(34, 142);
  for (let x = 34; x <= CHALK_W - 34; x += 8) ctx.lineTo(x, 142 + Math.sin(x * 0.18) * 3);
  ctx.stroke();

  drawBun(ctx, CHALK_W / 2, 220, 72, { bun: 'rgba(217,174,106,0.35)', bunLine: ochre, patty: 'rgba(241,239,230,0.18)', pattyLine: white, seed: white }, true);

  ctx.fillStyle = white;
  fitText(ctx, 'hausgemacht', CHALK_W / 2, 330, 34, CHALK_W - 50, 'italic');

  // Price in a chalk circle.
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(CHALK_W / 2, 390, 78, 30, -0.04, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = yellow;
  fitText(ctx, '2,90 €', CHALK_W / 2, 402, 38, 120);

  ctx.fillStyle = 'rgba(217, 174, 106, 0.85)';
  fitText(ctx, 'Büdchen am Eck', CHALK_W / 2, 448, 17, CHALK_W - 60, 'italic');

  // Chalk dust and scuffs on top.
  for (let i = 0; i < 160; i += 1) {
    ctx.fillStyle = `rgba(235, 235, 225, ${0.04 + rand() * 0.08})`;
    ctx.fillRect(rand() * CHALK_W, rand() * CHALK_H, 1 + rand() * 2, 1 + rand() * 2);
  }
  return toTexture(canvas);
}

/** Finds the angle `a` of a board of length h and thickness t so that h*sin(a)+t*cos(a) = d and h*cos(a)+t*sin(a) = H. */
function solveBoard(d: number, H: number, t: number): { a: number; h: number } {
  const lenFor = (a: number): number => (d - t * Math.cos(a)) / Math.sin(a);
  let lo = 0.02;
  let hi = 1.3;
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const total = lenFor(mid) * Math.cos(mid) + t * Math.sin(mid);
    // For a fixed footprint a steeper board is shorter, so too tall means: steepen.
    if (total > H) lo = mid;
    else hi = mid;
  }
  const a = (lo + hi) / 2;
  return { a, h: lenFor(a) };
}

/**
 * I-014 Kundenstopper Frikadelle (0.55 x 0.5 x 1.0 m). A classic A-frame sidewalk chalk sign: two slanted
 * boards (dark green wooden frame, black chalkboard insert) meeting at a hinge on top, with a small spreader
 * chain. The +Z board shows the hand-lettered chalk texture; the back board repeats it. Footprint and height
 * match the catalog box exactly.
 */
export function createKundenstopperI014(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: H } = asset.size;
  const f = getMaterials(m);
  const b = new PartBuilder();
  const t = 0.03;
  const { a, h } = solveBoard(d / 2, H, t);
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const c = (h / 2) * sin + (t / 2) * cos; // z of the board centre
  const cy = H / 2;
  const hw = w / 2;
  const stile = 0.045;
  const rail = 0.055;

  /** Adds a box given in board-local coordinates (x, y up the board, z out of the face). `side` +1 front, -1 back. */
  const piece = (mat: Material, side: 1 | -1, lx: number, ly: number, lz: number, pw: number, ph: number, pd: number): void => {
    const y = cy + ly * cos + lz * sin;
    const z = side * (c - ly * sin + lz * cos);
    b.tilted(mat, pw, ph, pd, lx, y, z, -side * a);
  };

  for (const side of [1, -1] as const) {
    piece(f.frameGreen, side, -hw + stile / 2, 0, 0, stile, h, t); // stiles
    piece(f.frameGreen, side, hw - stile / 2, 0, 0, stile, h, t);
    piece(f.frameGreen, side, 0, h / 2 - rail / 2, 0, w - 2 * stile, rail, t); // top rail
    piece(f.frameGreen, side, 0, -h / 2 + rail / 2, 0, w - 2 * stile, rail, t); // bottom rail
    piece(f.chalkboard, side, 0, 0, -0.003, w - 2 * stile, h - 2 * rail, t - 0.012); // insert
  }
  // Hinge across the top and a small chain (two links of a V) on each side.
  b.box(f.hinge, -hw + 0.06, -hw + 0.12, H - 0.035, H - 0.008, -0.016, 0.016);
  b.box(f.hinge, hw - 0.12, hw - 0.06, H - 0.035, H - 0.008, -0.016, 0.016);
  const zr = c - 0.03; // chain anchor on the inner board faces, mid height
  for (const x of [-hw + stile + 0.01, hw - stile - 0.01]) {
    b.bar(f.chain, [x, cy - 0.05, -zr], [x, cy - 0.17, 0], 0.007);
    b.bar(f.chain, [x, cy - 0.17, 0], [x, cy - 0.05, zr], 0.007);
  }
  const group = b.build(asset.assetId);

  const texture = createKundenstopperTexture();
  if (texture) {
    m.textures.push(texture);
    const face = new MeshLambertMaterial({ map: texture, emissive: 0x303430 });
    const insetW = w - 2 * stile;
    const insetH = h - 2 * rail;
    for (const side of [1, -1] as const) {
      const lz = t / 2 - 0.006 + 0.0015;
      const plane = new Mesh(new PlaneGeometry(insetW, insetH), face);
      plane.position.set(0, cy + lz * sin, side * (c + lz * cos));
      plane.rotation.set(-side * a, side === 1 ? 0 : Math.PI, 0);
      plane.name = `${asset.assetId}.${side === 1 ? 'front' : 'back'}Face`;
      group.add(plane);
    }
  }
  return group;
}

const SIGN_W = 384;
const SIGN_H = 512;

/**
 * The enamel-style face of I-015: "FRIKADELLEN-FREITAG" in dark red, a small coloured frikadelle in a bun,
 * "Seit 2027 · Kult im Viertel" and "Jeden Freitag 11–15 Uhr". Null without a DOM (node tests).
 */
export function createFrikadellenFreitagTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_W;
  canvas.height = SIGN_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rand = rng(2027_05);

  ctx.fillStyle = '#e8dcbc';
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
  const red = '#8f2a1e';
  const ink = '#2c3a4a';
  const ochre = '#b8842f';

  // Painted border lines.
  ctx.strokeStyle = red;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, SIGN_W - 28, SIGN_H - 28);
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, SIGN_W - 52, SIGN_H - 52);

  ctx.fillStyle = red;
  fitText(ctx, 'FRIKADELLEN-', SIGN_W / 2, 110, 56, SIGN_W - 80);
  fitText(ctx, 'FREITAG', SIGN_W / 2, 176, 66, SIGN_W - 80);

  // Ornament line with dots.
  ctx.strokeStyle = ochre;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 206);
  ctx.lineTo(SIGN_W - 60, 206);
  ctx.stroke();
  ctx.fillStyle = ochre;
  for (const x of [SIGN_W / 2 - 24, SIGN_W / 2, SIGN_W / 2 + 24]) {
    ctx.beginPath();
    ctx.arc(x, 206, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = ink;
  fitText(ctx, 'Seit 2027 · Kult im Viertel', SIGN_W / 2, 250, 27, SIGN_W - 70, 'italic');

  drawBun(ctx, SIGN_W / 2, 350, 90, { bun: '#d9a45c', bunLine: '#6e4a28', patty: '#8a4a30', pattyLine: '#4a2a1c', seed: '#f4e8c4' }, true);

  ctx.fillStyle = red;
  fitText(ctx, 'Jeden Freitag', SIGN_W / 2, 442, 30, SIGN_W - 80);
  fitText(ctx, '11–15 Uhr', SIGN_W / 2, 480, 30, SIGN_W - 80);

  // Enamel wear: small chipped spots near the border and a few fine scratches.
  for (let i = 0; i < 40; i += 1) {
    const edge = rand() < 0.5;
    const x = edge ? (rand() < 0.5 ? 14 + rand() * 14 : SIGN_W - 28 + rand() * 14) : rand() * SIGN_W;
    const y = edge ? rand() * SIGN_H : rand() < 0.5 ? 14 + rand() * 14 : SIGN_H - 28 + rand() * 14;
    ctx.fillStyle = 'rgba(70, 60, 48, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 1 + rand() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(90, 76, 56, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const x = rand() * SIGN_W;
    const y = rand() * SIGN_H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40);
    ctx.stroke();
  }
  return toTexture(canvas);
}

/**
 * I-015 Kult-Tafel Frikadellen-Freitag (0.7 x 0.06 x 1.85 m). A wall board for the outside of the kiosk: oak
 * frame with a cream enamel-style panel in the upper half (y about 0.95..1.85) and two thin oak mounting battens
 * on the back that run down to the ground, so the bounding box spans the full catalog height. The back of the
 * object is at -Z (against the wall), the face looks toward +Z.
 */
export function createFrikadellenFreitagI015(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: H } = asset.size;
  const f = getMaterials(m);
  const b = new PartBuilder();
  const hw = w / 2;
  const hd = d / 2;
  const batten = d * 0.25;
  const batW = 0.03;
  const boardBottom = H * (0.95 / 1.85);
  const frameW = 0.045;
  const zBack = -hd + batten;
  const recess = d * 0.12;

  // Mounting battens on the back, ground to top.
  b.box(f.oakDark, -hw + 0.06, -hw + 0.06 + batW, 0, H, -hd, zBack);
  b.box(f.oakDark, hw - 0.06 - batW, hw - 0.06, 0, H, -hd, zBack);
  // Oak frame.
  b.box(f.oak, -hw, -hw + frameW, boardBottom, H, zBack, hd);
  b.box(f.oak, hw - frameW, hw, boardBottom, H, zBack, hd);
  b.box(f.oak, -hw + frameW, hw - frameW, H - frameW, H, zBack, hd);
  b.box(f.oak, -hw + frameW, hw - frameW, boardBottom, boardBottom + frameW, zBack, hd);
  // Panel behind the face.
  b.box(f.enamel, -hw + frameW, hw - frameW, boardBottom + frameW, H - frameW, zBack, hd - recess);
  const group = b.build(asset.assetId);

  const texture = createFrikadellenFreitagTexture();
  if (texture) {
    m.textures.push(texture);
    const face = new MeshLambertMaterial({ map: texture, emissive: 0x2a2820 });
    const plane = new Mesh(new PlaneGeometry(w - 2 * frameW, H - boardBottom - 2 * frameW), face);
    plane.position.set(0, (boardBottom + H) / 2, hd - recess + 0.0015);
    plane.name = `${asset.assetId}.face`;
    group.add(plane);
  }
  return group;
}
