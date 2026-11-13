import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
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
  /** Real size of the labelled area in metres (sets the pixel size and the proportions). For `wrap` the width is the circumference. */
  widthM: number;
  heightM: number;
  primary: string;
  accent: string;
  text: string;
  /** Brand name of the product: picks the one emblem shared by the whole brand family. */
  brand: string;
  /** Draw the label text (false = emblem and initial only, no word). Further limited by the physical size of the lettering. */
  drawText: boolean;
  /** Beer/tobacco: one plain band and (where it fits) the text, no emblem and no decorative shapes. */
  sober: boolean;
  /** Style variant 0..3, normally derived from the product id. */
  style: number;
  /** Bags: crimped seams (hatched strips) at top and bottom, as a fraction of the height. */
  crimp?: number;
  /** Magazines: layout with a masthead, an emblem field and a price disc. */
  cover?: boolean;
  /** Draws a hinge line of a lid (boxes/tins) at this fraction from the top. */
  lidLine?: number;
  /** Paints two solid colour patches (primary top-left, accent top-right) that boxes/bars map their side and top faces to. */
  patches?: boolean;
}

/** Canvas pixels per metre of label: generous so that large lettering stays crisp when the player looks closely. */
const PX_PER_M = 3000;
const MIN_PX = 128;
const MAX_PX = 1024;
/** Size of the solid colour patches in the top corners of boxes/bars (pixels, centre sampled by the side faces). */
export const PATCH_PX = 8;
/** Smallest lettering (em height in metres) that is still drawn as a word; below it the label shows an emblem and an initial. */
const MIN_EM_M = 0.026;

export function labelPixelSize(art: Pick<LabelArt, 'widthM' | 'heightM'>): { w: number; h: number } {
  let w = art.widthM * PX_PER_M;
  let h = art.heightM * PX_PER_M;
  const up = Math.max(1, MIN_PX / Math.min(w, h));
  w *= up;
  h *= up;
  const down = Math.min(1, MAX_PX / Math.max(w, h));
  return { w: Math.max(32, Math.round(w * down)), h: Math.max(32, Math.round(h * down)) };
}

type Ctx = CanvasRenderingContext2D;

const FONT = '"Arial Black", "Helvetica Neue", Impact, Arial, sans-serif';

/** Ink colour with a clear luminance gap to `bg`: the preferred colour when it contrasts, else near-black or white. */
function inkOn(bg: string, preferred: string): string {
  const lb = luminance(bg);
  if (Math.abs(luminance(preferred) - lb) > 0.4) return preferred;
  return lb > 0.45 ? '#1d1b18' : '#fbf7ea';
}

interface TextFit {
  lines: string[];
  /** Font size in pixels (em height). */
  size: number;
}

/** Largest bold lettering that fits the box: one line, or two lines when the text splits at a space or hyphen. */
function fitLines(ctx: Ctx, text: string, maxW: number, maxH: number): TextFit {
  const options: string[][] = [[text]];
  for (let i = 1; i < text.length - 1; i += 1) {
    if (text[i] === ' ' || text[i] === '-') {
      const hyphen = text[i] === '-' ? '-' : '';
      options.push([text.slice(0, i) + hyphen, text.slice(i + 1)]);
    }
  }
  let best: TextFit = { lines: [text], size: 0 };
  for (const lines of options) {
    let size = Math.floor(maxH / (lines.length * 1.04));
    ctx.font = `900 ${size}px ${FONT}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > maxW) size = Math.floor((size * maxW) / widest);
    if (size > best.size) best = { lines, size };
  }
  return best;
}

function drawLines(ctx: Ctx, fit: TextFit, cx: number, cy: number, color: string): void {
  ctx.font = `900 ${fit.size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = fit.size * 1.04;
  const top = cy - (lineH * (fit.lines.length - 1)) / 2;
  fit.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineH + fit.size * 0.04));
}

/** One huge letter centred at (cx, cy), `size` px em height. */
function initial(ctx: Ctx, text: string, cx: number, cy: number, size: number, color: string): void {
  const letter = text.trim().charAt(0).toUpperCase();
  if (!letter) return;
  ctx.font = `900 ${Math.floor(size)}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, cx, cy + size * 0.04);
}

type Emblem = 'circle' | 'bolt' | 'diamond' | 'star' | 'drop' | 'flame' | 'hexagon' | 'triangle' | 'grid';

/** One original emblem per brand family (simple, solid, readable as a blob at a few pixels). */
const BRAND_EMBLEMS: Readonly<Record<string, Emblem>> = {
  Ruhrbrause: 'circle',
  Zechenblitz: 'bolt',
  Naschwerk: 'diamond',
  Eiskumpel: 'star',
  Pottsoft: 'drop',
  Funkenflug: 'bolt',
  Flammwerk: 'flame',
  'Abstoß': 'hexagon',
  Knobelschacht: 'grid',
  'Halden-Verlag': 'triangle',
};
const EMBLEM_FALLBACKS: readonly Emblem[] = ['circle', 'diamond', 'star', 'hexagon', 'drop'];

function emblemFor(brand: string): Emblem {
  const known = Object.hasOwn(BRAND_EMBLEMS, brand) ? BRAND_EMBLEMS[brand] : undefined;
  return known ?? EMBLEM_FALLBACKS[Math.floor(hash01(brand) * EMBLEM_FALLBACKS.length)] ?? 'circle';
}

/** Emblems with a roomy interior that can carry an initial letter. */
const LETTER_EMBLEMS: ReadonlySet<Emblem> = new Set<Emblem>(['circle', 'diamond', 'hexagon', 'drop']);

function polygon(ctx: Ctx, cx: number, cy: number, s: number, points: ReadonlyArray<readonly [number, number]>): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(cx + x * s, cy + y * s) : ctx.lineTo(cx + x * s, cy + y * s)));
  ctx.closePath();
}

/** Fills an emblem inside the square (cx, cy) +- s. */
function drawEmblem(ctx: Ctx, kind: Emblem, cx: number, cy: number, s: number, color: string): void {
  ctx.fillStyle = color;
  switch (kind) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'diamond':
      polygon(ctx, cx, cy, s, [[0, -1], [0.82, 0], [0, 1], [-0.82, 0]]);
      ctx.fill();
      return;
    case 'hexagon':
      polygon(ctx, cx, cy, s, [[-0.5, -0.87], [0.5, -0.87], [1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0]]);
      ctx.fill();
      return;
    case 'triangle':
      polygon(ctx, cx, cy, s, [[0, -0.95], [1, 0.8], [-1, 0.8]]);
      ctx.fill();
      return;
    case 'bolt':
      polygon(ctx, cx, cy, s, [[0.35, -1], [-0.5, 0.12], [-0.02, 0.12], [-0.38, 1], [0.52, -0.22], [0.04, -0.22]]);
      ctx.fill();
      return;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? s : s * 0.46;
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.bezierCurveTo(cx + s * 0.2, cy - s * 0.55, cx + s * 0.85, cy + s * 0.05, cx + s * 0.85, cy + s * 0.42);
      ctx.bezierCurveTo(cx + s * 0.85, cy + s * 0.82, cx + s * 0.45, cy + s, cx, cy + s);
      ctx.bezierCurveTo(cx - s * 0.45, cy + s, cx - s * 0.85, cy + s * 0.82, cx - s * 0.85, cy + s * 0.42);
      ctx.bezierCurveTo(cx - s * 0.85, cy + s * 0.05, cx - s * 0.2, cy - s * 0.55, cx, cy - s);
      ctx.closePath();
      ctx.fill();
      return;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.1, cy - s);
      ctx.bezierCurveTo(cx + s * 0.25, cy - s * 0.5, cx + s * 0.85, cy - s * 0.1, cx + s * 0.75, cy + s * 0.45);
      ctx.bezierCurveTo(cx + s * 0.68, cy + s * 0.85, cx + s * 0.35, cy + s, cx, cy + s);
      ctx.bezierCurveTo(cx - s * 0.4, cy + s, cx - s * 0.8, cy + s * 0.8, cx - s * 0.75, cy + s * 0.3);
      ctx.bezierCurveTo(cx - s * 0.72, cy, cx - s * 0.45, cy - s * 0.15, cx - s * 0.35, cy - s * 0.45);
      ctx.bezierCurveTo(cx - s * 0.1, cy - s * 0.3, cx - s * 0.05, cy - s * 0.55, cx + s * 0.1, cy - s);
      ctx.closePath();
      ctx.fill();
      return;
    case 'grid': {
      const cell = (s * 2) / 3;
      for (let gy = 0; gy < 3; gy += 1) {
        for (let gx = 0; gx < 3; gx += 1) {
          if ((gx + gy) % 2 === 0) ctx.fillRect(cx - s + gx * cell, cy - s + gy * cell, cell + 0.5, cell + 0.5);
        }
      }
      return;
    }
  }
}

function crimpStrip(ctx: Ctx, x: number, y: number, w: number, h: number, base: string): void {
  ctx.fillStyle = mix(base, '#000000', 0.22);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = mix(base, '#000000', 0.42);
  const step = Math.max(4, Math.round(w / 30));
  for (let i = 0; i < w; i += step) ctx.fillRect(x + i, y, Math.max(2, step / 2.5), h);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Content of a label inside the box (emblem, word or initial), drawn on the accent panel in `ink`.
 * Plain/sober labels get only the word (when it can be read). `pxPerM` converts pixels to real size.
 */
function drawContent(ctx: Ctx, art: LabelArt, box: Box, pxPerM: number, ink: string, panel: string): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const minEm = MIN_EM_M * pxPerM;

  if (art.sober) {
    if (!art.drawText) return;
    const fit = fitLines(ctx, art.text, box.w * 0.94, box.h * 0.82);
    if (fit.size >= minEm) drawLines(ctx, fit, cx, cy, ink);
    return;
  }

  const emblem = emblemFor(art.brand);
  const wide = box.w / box.h >= 1.35;
  if (wide) {
    // Flat bars: emblem on the left with the word beside it; when the word is too small, the emblem alone, centred.
    const s = Math.min(box.h * 0.46, box.w * 0.22);
    const tx = box.x + s * 2.5;
    const row = fitLines(ctx, art.text, box.x + box.w - tx - s * 0.2, box.h * 0.8);
    const showWord = art.drawText && row.size >= minEm;
    const ex = showWord ? box.x + s * 1.15 : cx;
    const es = showWord ? s : Math.min(box.h * 0.5, box.w * 0.4);
    drawEmblem(ctx, emblem, ex, cy, es, ink);
    if (showWord) drawLines(ctx, row, (tx + box.x + box.w) / 2, cy, ink);
    else if (LETTER_EMBLEMS.has(emblem)) initial(ctx, art.text, ex, cy, es * 1.1, panel);
    return;
  }

  const fit = fitLines(ctx, art.text, box.w * 0.96, box.h * 0.32);
  if (art.drawText && fit.size >= minEm) {
    const s = Math.min(box.w * 0.4, box.h * 0.26);
    drawEmblem(ctx, emblem, cx, box.y + box.h * 0.04 + s, s, ink);
    drawLines(ctx, fit, cx, box.y + box.h * 0.78, ink);
    return;
  }
  // Too small for a word: one big emblem, with an initial inside where the shape has room for it.
  const s = Math.min(box.w * 0.5, box.h * 0.5);
  drawEmblem(ctx, emblem, cx, cy, s, ink);
  if (LETTER_EMBLEMS.has(emblem)) initial(ctx, art.text, cx, cy + (emblem === 'drop' ? s * 0.12 : 0), s * (emblem === 'circle' ? 1.2 : 1.05), panel);
}

/** Magazine cover: accent masthead with the title, a big emblem on the colour field, a headline bar and a price disc. */
function drawCover(ctx: Ctx, art: LabelArt, w: number, h: number, pxPerM: number): void {
  const { primary, accent } = art;
  const ink = inkOn(accent, primary);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, h * 0.3);
  ctx.fillStyle = mix(accent, primary, 0.45);
  ctx.fillRect(0, h * 0.3, w, h * 0.03);
  const fit = fitLines(ctx, art.text, w * 0.92, h * 0.25);
  if (art.drawText && fit.size >= MIN_EM_M * pxPerM * 0.6) drawLines(ctx, fit, w / 2, h * 0.15, ink);
  else initial(ctx, art.text, w / 2, h * 0.15, h * 0.24, ink);
  const onBg = inkOn(primary, accent);
  drawEmblem(ctx, emblemFor(art.brand), w * 0.5, h * 0.6, Math.min(w * 0.36, h * 0.2), onBg);
  ctx.fillStyle = onBg;
  ctx.fillRect(w * 0.1, h * 0.87, w * 0.55, h * 0.05);
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.88, h * 0.065, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
}

/** Vertical extent of the accent panel as fractions of the label height: a plain band for beer/tobacco, a tall one otherwise. */
function panelSpan(art: LabelArt): { top: number; bottom: number } {
  return art.sober ? { top: 0.2, bottom: 0.8 } : { top: 0.13, bottom: 0.87 };
}

/** The wide accent panel that covers most of the body (sometimes slanted on flat fronts), drawn on the primary field. */
function drawPanel(ctx: Ctx, art: LabelArt, area: Box): void {
  const { top, bottom } = panelSpan(art);
  ctx.fillStyle = art.accent;
  // Flat fronts keep a frame of the brand colour on all sides; a wrap runs all around, so it has no side margin.
  const inset = art.layout === 'front' && !art.sober ? area.w * 0.07 : 0;
  const x0 = area.x + inset;
  const x1 = area.x + area.w - inset;
  if (!art.sober && art.style % 2 === 1 && art.layout === 'front') {
    ctx.beginPath();
    ctx.moveTo(x0, area.y + area.h * (top + 0.08));
    ctx.lineTo(x1, area.y + area.h * (top - 0.02));
    ctx.lineTo(x1, area.y + area.h * (bottom - 0.08));
    ctx.lineTo(x0, area.y + area.h * (bottom + 0.02));
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(x0, area.y + area.h * top, x1 - x0, area.h * (bottom - top));
  }
}

/** Content (emblem, word, initial) of one front design, horizontally inside `content`, vertically inside the panel. */
function drawFront(ctx: Ctx, art: LabelArt, area: Box, content: Box, pxPerM: number): void {
  const { top, bottom } = panelSpan(art);
  const inner: Box = { x: content.x, y: area.y + area.h * (top + 0.04), w: content.w, h: area.h * (bottom - top - 0.08) };
  drawContent(ctx, art, inner, pxPerM, inkOn(art.accent, art.primary), art.accent);
}

export function createLabelTexture(art: LabelArt): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const { w, h } = labelPixelSize(art);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const pxPerM = w / art.widthM;

  ctx.fillStyle = art.primary;
  ctx.fillRect(0, 0, w, h);

  if (art.cover) {
    drawCover(ctx, art, w, h, pxPerM);
  } else if (art.layout === 'wrap') {
    // The accent panel runs around the whole circumference; the front design sits in the middle (u = 0.5) and is
    // repeated at the seam (u = 0 / 1, the back), so a bottle reads from any side.
    const cw = w * 0.31;
    const area: Box = { x: 0, y: 0, w, h };
    drawPanel(ctx, art, area);
    for (const centre of [w / 2, 0, w]) {
      drawFront(ctx, art, area, { x: centre - cw / 2, y: 0, w: cw, h }, pxPerM);
    }
  } else {
    const crimp = art.crimp ?? 0;
    const ch = h * crimp;
    if (crimp > 0) {
      crimpStrip(ctx, 0, 0, w, ch, art.primary);
      crimpStrip(ctx, 0, h - ch, w, ch, art.primary);
    }
    const area: Box = { x: 0, y: ch, w, h: h - ch * 2 };
    drawPanel(ctx, art, area);
    drawFront(ctx, art, area, { x: w * 0.1, y: ch, w: w * 0.8, h: h - ch * 2 }, pxPerM);
    if (art.lidLine !== undefined) {
      ctx.fillStyle = mix(art.primary, '#000000', 0.45);
      ctx.fillRect(0, h * art.lidLine, w, Math.max(3, h * 0.02));
    }
  }

  if (art.patches) {
    ctx.fillStyle = art.primary;
    ctx.fillRect(0, 0, PATCH_PX, PATCH_PX);
    ctx.fillStyle = art.accent;
    ctx.fillRect(w - PATCH_PX, 0, PATCH_PX, PATCH_PX);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Far away, a label must stay a stable colour block: full mip chain, trilinear and the highest anisotropy the GPU allows.
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 16;
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
