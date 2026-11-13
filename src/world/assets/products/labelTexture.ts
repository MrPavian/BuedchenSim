import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { hash01, luminance, mix } from './kit';

/**
 * Original label art for the fictional products: a canvas texture per product built from its brand colours,
 * an accent band/shape and the label text. Returns null without a DOM (node tests); callers then fall back to
 * the flat primary colour. Lettering is only drawn where it can be read (`text: true`), otherwise the label
 * is made of colour blocks.
 */

export type LabelLayout =
  /** The texture is the front face (bags, boxes, magazines, sleeves): the whole image is visible from +Z. */
  | 'front'
  /** The texture wraps around a cylinder (bottles, cans): the front sits in the centre, the rest repeats bands. */
  | 'wrap';

export interface LabelArt {
  layout: LabelLayout;
  /** Real size of the labelled area in metres (sets the pixel size and the proportions). */
  widthM: number;
  heightM: number;
  primary: string;
  accent: string;
  text: string;
  /** Draw the label text (false = colour blocks only). */
  drawText: boolean;
  /** Beer/tobacco: one plain band and the text, no decorative shapes. */
  sober: boolean;
  /** Style variant 0..3, normally derived from the product id. */
  style: number;
  /** Bags: crimped seams (hatched strips) at top and bottom, as a fraction of the height. */
  crimp?: number;
  /** Magazines: layout with a masthead, a picture block and text lines. */
  cover?: boolean;
  /** Draws a hinge line of a lid (boxes/tins) at this fraction from the top. */
  lidLine?: number;
}

const PX_PER_M = 1500;
const MIN_PX = 96;
const MAX_PX = 512;

export function labelPixelSize(art: Pick<LabelArt, 'widthM' | 'heightM'>): { w: number; h: number } {
  const clamp = (v: number): number => Math.min(MAX_PX, Math.max(MIN_PX, Math.round(v)));
  const scale = Math.max(1, MIN_PX / Math.min(art.widthM * PX_PER_M, art.heightM * PX_PER_M));
  return { w: clamp(art.widthM * PX_PER_M * scale), h: clamp(art.heightM * PX_PER_M * scale) };
}

type Ctx = CanvasRenderingContext2D;

const FONT = '"Arial Black", "Helvetica Neue", Impact, Arial, sans-serif';

/** Best readable ink on a background: the accent when it contrasts enough, else near-black or white. */
function ink(bg: string, accent: string): string {
  const lb = luminance(bg);
  if (Math.abs(luminance(accent) - lb) > 0.38) return accent;
  return lb > 0.45 ? '#1d1b18' : '#fbf7ea';
}

function fitText(ctx: Ctx, text: string, maxW: number, maxH: number): number {
  let size = Math.floor(maxH);
  ctx.font = `900 ${size}px ${FONT}`;
  while (size > 6 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  return size;
}

function label(ctx: Ctx, text: string, cx: number, cy: number, maxW: number, maxH: number, color: string): void {
  fitText(ctx, text, maxW, maxH);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function crimpStrip(ctx: Ctx, x: number, y: number, w: number, h: number, base: string): void {
  ctx.fillStyle = mix(base, '#000000', 0.18);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = mix(base, '#000000', 0.38);
  const step = Math.max(3, Math.round(w / 56));
  for (let i = 0; i < w; i += step) ctx.fillRect(x + i, y, Math.max(1, step / 3), h);
}

/** Front design inside the rectangle (x0, y0, x1, y1) of the canvas. */
function drawFront(ctx: Ctx, art: LabelArt, x0: number, y0: number, x1: number, y1: number): void {
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = x0 + w / 2;
  const { primary, accent } = art;
  const sober = art.sober;

  if (sober) {
    // One plain band across the middle, two thin rules, the text. No shapes.
    ctx.fillStyle = accent;
    ctx.fillRect(x0, y0 + h * 0.4, w, h * 0.2);
    ctx.fillRect(x0, y0 + h * 0.3, w, Math.max(2, h * 0.025));
    ctx.fillRect(x0, y0 + h * 0.675, w, Math.max(2, h * 0.025));
    if (art.drawText) label(ctx, art.text, cx, y0 + h * 0.5, w * 0.9, h * 0.15, ink(accent, primary));
    return;
  }

  switch (art.style % 4) {
    case 0: {
      // Banner: a full-width accent band with the text, thin rules above and below.
      ctx.fillStyle = accent;
      ctx.fillRect(x0, y0 + h * 0.38, w, h * 0.24);
      ctx.fillStyle = mix(accent, primary, 0.35);
      ctx.fillRect(x0, y0 + h * 0.3, w, Math.max(2, h * 0.03));
      ctx.fillRect(x0, y0 + h * 0.67, w, Math.max(2, h * 0.03));
      if (art.drawText) label(ctx, art.text, cx, y0 + h * 0.5, w * 0.9, h * 0.17, ink(accent, primary));
      break;
    }
    case 1: {
      // Badge: a large accent disc with a small band beneath; the text sits in the disc.
      const r = Math.min(w * 0.5, h * 0.32);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, y0 + h * 0.45, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix(accent, primary, 0.5);
      ctx.fillRect(x0, y0 + h * 0.8, w, h * 0.06);
      if (art.drawText) label(ctx, art.text, cx, y0 + h * 0.45, r * 1.7, r * 0.55, ink(accent, primary));
      break;
    }
    case 2: {
      // Diagonal: a slanted accent block across the lower part, text on a small plate above it.
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + h * 0.62);
      ctx.lineTo(x1, y0 + h * 0.42);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = mix(primary, '#000000', 0.18);
      ctx.fillRect(x0, y0 + h * 0.16, w, h * 0.2);
      if (art.drawText) label(ctx, art.text, cx, y0 + h * 0.26, w * 0.9, h * 0.15, ink(mix(primary, '#000000', 0.18), accent));
      break;
    }
    default: {
      // Stripes: soft vertical stripes with a rounded accent plate carrying the text.
      ctx.fillStyle = mix(primary, accent, 0.22);
      const n = 5;
      for (let i = 0; i < n; i += 1) ctx.fillRect(x0 + ((i * 2 + 0.5) * w) / (n * 2), y0, w / (n * 2), h);
      ctx.fillStyle = accent;
      roundRect(ctx, x0 + w * 0.08, y0 + h * 0.36, w * 0.84, h * 0.28, Math.min(w, h) * 0.08);
      ctx.fill();
      if (art.drawText) label(ctx, art.text, cx, y0 + h * 0.5, w * 0.76, h * 0.15, ink(accent, primary));
      break;
    }
  }
}

/** Magazine cover: masthead with the title, a picture block with simple shapes, headline bars and a price disc. */
function drawCover(ctx: Ctx, art: LabelArt, w: number, h: number): void {
  const { primary, accent } = art;
  const dark = mix(primary, '#000000', 0.25);
  // Masthead.
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, w, h * 0.22);
  if (art.drawText) label(ctx, art.text, w / 2, h * 0.11, w * 0.88, h * 0.13, ink(dark, accent));
  ctx.fillStyle = accent;
  ctx.fillRect(0, h * 0.22, w, Math.max(3, h * 0.012));
  // Picture block.
  const picture = mix(primary, accent, 0.35);
  ctx.fillStyle = picture;
  ctx.fillRect(w * 0.08, h * 0.28, w * 0.84, h * 0.42);
  ctx.fillStyle = mix(picture, '#ffffff', 0.35);
  ctx.beginPath();
  ctx.arc(w * (0.3 + 0.4 * hash01(art.text)), h * 0.42, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(picture, '#000000', 0.28);
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.7);
  ctx.lineTo(w * 0.38, h * 0.5);
  ctx.lineTo(w * 0.6, h * 0.64);
  ctx.lineTo(w * 0.74, h * 0.54);
  ctx.lineTo(w * 0.92, h * 0.7);
  ctx.closePath();
  ctx.fill();
  // Headline bars.
  ctx.fillStyle = accent;
  ctx.fillRect(w * 0.08, h * 0.76, w * 0.62, h * 0.055);
  ctx.fillStyle = mix(primary, '#ffffff', 0.55);
  ctx.fillRect(w * 0.08, h * 0.85, w * 0.84, h * 0.025);
  ctx.fillRect(w * 0.08, h * 0.9, w * 0.5, h * 0.025);
  // Price disc.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.85, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

export function createLabelTexture(art: LabelArt): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const { w, h } = labelPixelSize(art);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = art.primary;
  ctx.fillRect(0, 0, w, h);

  if (art.cover) {
    drawCover(ctx, art, w, h);
  } else if (art.layout === 'wrap') {
    // Thin accent rules around the whole circumference; the front design sits in the middle third.
    ctx.fillStyle = art.accent;
    const rule = Math.max(2, h * 0.04);
    ctx.fillRect(0, 0, w, rule);
    ctx.fillRect(0, h - rule, w, rule);
    const frontW = w * 0.36;
    drawFront(ctx, art, w / 2 - frontW / 2, rule * 2, w / 2 + frontW / 2, h - rule * 2);
    // Back of the label: a quiet secondary band so the wrap does not look empty.
    ctx.fillStyle = mix(art.primary, art.accent, 0.3);
    ctx.fillRect(0, h * 0.42, w * 0.2, h * 0.16);
    ctx.fillRect(w * 0.8, h * 0.42, w * 0.2, h * 0.16);
  } else {
    const crimp = art.crimp ?? 0;
    if (crimp > 0) {
      const ch = h * crimp;
      crimpStrip(ctx, 0, 0, w, ch, art.primary);
      crimpStrip(ctx, 0, h - ch, w, ch, art.primary);
      drawFront(ctx, art, w * 0.04, ch, w * 0.96, h - ch);
    } else {
      drawFront(ctx, art, 0, 0, w, h);
    }
    if (art.lidLine !== undefined) {
      ctx.fillStyle = mix(art.primary, '#000000', 0.45);
      ctx.fillRect(0, h * art.lidLine, w, Math.max(2, h * 0.015));
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Waffle grid pattern (tiles, repeat in the material) in the waffle colour; null without a DOM. */
export function createWaffleTexture(base: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = mix(base, '#3a2208', 0.55);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.moveTo(size, 0);
  ctx.lineTo(0, size);
  ctx.moveTo(-size, 0);
  ctx.lineTo(size, size * 2);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}
