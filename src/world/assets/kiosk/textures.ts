import { CanvasTexture, ClampToEdgeWrapping, Color, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Procedural CanvasTextures for the kiosk (K-001). Every function returns null when no DOM is
 * available (node tests); callers then fall back to flat colours. Texture scale is documented per
 * function in metres so the world mapping stays consistent on every wall.
 */

/** Deterministic pseudo random generator: textures look identical on every start. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function canvas2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

function finish(canvas: HTMLCanvasElement, wrapS: 'repeat' | 'clamp', wrapT: 'repeat' | 'clamp'): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = wrapS === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = wrapT === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
  return texture;
}

const hex = (c: Color): string => `#${c.getHexString()}`;
function shade(base: string, factor: number): string {
  return hex(new Color(base).multiplyScalar(factor));
}

/** World size of one brick texture tile (u along the wall, v up). */
export const BRICK_TILE = { w: 2.0, h: 1.2 } as const;
/** Brick format incl. joint: 0.25 x 0.075 m (brick 0.24 x 0.065 m). */
export function createBrickTexture(): CanvasTexture | null {
  const pxPerM = 400;
  const w = BRICK_TILE.w * pxPerM;
  const h = BRICK_TILE.h * pxPerM;
  const made = canvas2d(w, h);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(31);
  const unitW = 0.25 * pxPerM; // 100 px
  const unitH = 0.075 * pxPerM; // 30 px
  const brickW = 0.24 * pxPerM;
  const brickH = 0.065 * pxPerM;
  ctx.fillStyle = '#b8b0a0'; // mortar
  ctx.fillRect(0, 0, w, h);
  const tones = ['#a9533a', '#b45e40', '#9d4b35', '#bb6846', '#a65a43', '#b0583b'];
  const cols = Math.round(w / unitW);
  const rows = Math.round(h / unitH);
  // Two repaired patches (slightly different batch) and a few burnt bricks.
  const patches = [
    { c0: 2, c1: 4, r0: 3, r1: 5, tone: '#c07650' },
    { c0: 5, c1: 7, r0: 9, r1: 10, tone: '#a8654a' },
  ];
  for (let r = 0; r < rows; r += 1) {
    const offset = r % 2 === 0 ? 0 : unitW / 2;
    for (let c = -1; c < cols + 1; c += 1) {
      const x = c * unitW + offset;
      const y = h - (r + 1) * unitH; // course 0 at the bottom
      let tone = tones[Math.floor(rand() * tones.length)] as string;
      const roll = rand();
      if (roll > 0.94) tone = '#7c3d2f';
      const patch = patches.find((p) => c >= p.c0 && c <= p.c1 && r >= p.r0 && r <= p.r1);
      if (patch) tone = patch.tone;
      ctx.fillStyle = shade(tone, 0.93 + rand() * 0.14);
      for (const dx of [0, -w, w]) ctx.fillRect(x + dx, y + (unitH - brickH), brickW, brickH);
      // speckles
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(40,20,10,0.22)' : 'rgba(255,225,190,0.16)';
        const sx = x + rand() * brickW;
        const sy = y + (unitH - brickH) + rand() * brickH;
        for (const dx of [0, -w, w]) ctx.fillRect(sx + dx, sy, 2 + rand() * 4, 1.5);
      }
    }
  }
  // Soot / rain streaks: faint vertical gradients.
  for (let i = 0; i < 9; i += 1) {
    const sx = rand() * w;
    const sw = 10 + rand() * 24;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(30,22,16,${0.1 + rand() * 0.1})`);
    grad.addColorStop(1, 'rgba(30,22,16,0)');
    ctx.fillStyle = grad;
    for (const dx of [0, -w, w]) ctx.fillRect(sx + dx, 0, sw, h);
  }
  return finish(canvas, 'repeat', 'repeat');
}

/** Interior wall: u repeats every `INTERIOR_TILE_W` m, v spans 0..INTERIOR_TILE_H m (clamped, world height). */
export const INTERIOR_TILE_W = 0.6;
export const INTERIOR_TILE_H = 3.2;
/** Tile wainscot up to 1.4 m (dark border row to 1.5 m), warm plaster above. */
export function createInteriorWallTexture(): CanvasTexture | null {
  const pxPerM = 320;
  const w = INTERIOR_TILE_W * pxPerM;
  const h = INTERIOR_TILE_H * pxPerM;
  const made = canvas2d(w, h);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(77);
  const yOf = (worldY: number): number => h - worldY * pxPerM; // world height -> canvas y
  // plaster
  ctx.fillStyle = '#efe1bf';
  ctx.fillRect(0, 0, w, yOf(1.5));
  for (let i = 0; i < 260; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(160,130,80,0.07)' : 'rgba(255,250,235,0.1)';
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * yOf(1.5), 6 + rand() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  // wainscot tiles 0.15 m
  const tile = 0.15 * pxPerM;
  const base = ['#cfd9c6', '#c8d3bf', '#d4ddcc'];
  for (let ty = 0; ty < 1.4 / 0.15 + 0.01; ty += 1) {
    for (let tx = 0; tx < INTERIOR_TILE_W / 0.15; tx += 1) {
      const y = yOf(Math.min((ty + 1) * 0.15, 1.4));
      const th = Math.min(tile, yOf(ty * 0.15) - y);
      ctx.fillStyle = base[Math.floor(rand() * base.length)] as string;
      ctx.fillRect(tx * tile + 1.5, y + 1.5, tile - 3, th - 3);
    }
  }
  // grout under the tiles was left as plaster colour; draw grout lines explicitly
  ctx.strokeStyle = '#a9ab98';
  ctx.lineWidth = 2;
  for (let ty = 0; ty <= 1.4 / 0.15 + 0.01; ty += 1) {
    const y = yOf(Math.min(ty * 0.15, 1.4));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let tx = 0; tx <= INTERIOR_TILE_W / 0.15 + 0.01; tx += 1) {
    ctx.beginPath();
    ctx.moveTo(tx * tile, yOf(1.4));
    ctx.lineTo(tx * tile, yOf(0));
    ctx.stroke();
  }
  // border row
  ctx.fillStyle = '#4f867c';
  ctx.fillRect(0, yOf(1.5), w, 0.1 * pxPerM);
  ctx.fillStyle = '#e4efe6';
  ctx.fillRect(0, yOf(1.5), w, 3);
  // scuffs at the foot
  const grad = ctx.createLinearGradient(0, yOf(0.35), 0, yOf(0));
  grad.addColorStop(0, 'rgba(60,45,30,0)');
  grad.addColorStop(1, 'rgba(60,45,30,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, yOf(0.35), w, 0.35 * pxPerM);
  return finish(canvas, 'repeat', 'clamp');
}

/** Floor: 2 x 2 tiles of 0.3 m, tile covers 0.6 x 0.6 m. */
export const FLOOR_TILE = 0.6;
export function createFloorTexture(): CanvasTexture | null {
  const size = 256;
  const made = canvas2d(size, size);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(5);
  const cell = size / 2;
  const tones = ['#cdb08b', '#b8956d'];
  for (let ix = 0; ix < 2; ix += 1) {
    for (let iy = 0; iy < 2; iy += 1) {
      ctx.fillStyle = shade(tones[(ix + iy) % 2] as string, 0.97 + rand() * 0.06);
      ctx.fillRect(ix * cell, iy * cell, cell, cell);
      for (let i = 0; i < 40; i += 1) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(70,50,30,0.12)' : 'rgba(255,240,210,0.12)';
        ctx.fillRect(ix * cell + rand() * cell, iy * cell + rand() * cell, 2 + rand() * 6, 2);
      }
    }
  }
  ctx.strokeStyle = '#8a7660';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }
  return finish(canvas, 'repeat', 'repeat');
}

/** Awning fabric: stripes of 0.2 m, one tile = 0.4 m across (u). Stripes run along v (down the slope). */
export const AWNING_TILE = 0.4;
export function createAwningTexture(colourA: string, colourB: string): CanvasTexture | null {
  const w = 128;
  const h = 64;
  const made = canvas2d(w, h);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(9);
  ctx.fillStyle = colourA;
  ctx.fillRect(0, 0, w / 2, h);
  ctx.fillStyle = colourB;
  ctx.fillRect(w / 2, 0, w / 2, h);
  for (let i = 0; i < 160; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(rand() * w, rand() * h, 1, 3 + rand() * 6);
  }
  return finish(canvas, 'repeat', 'clamp');
}

/** Flat roofing membrane: 1 m tile with welded seams every 0.5 m and a few patches. */
export const ROOF_TILE = 1.0;
export function createRoofTexture(): CanvasTexture | null {
  const size = 256;
  const made = canvas2d(size, size);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(21);
  ctx.fillStyle = '#4a4e55';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(20,22,26,0.18)' : 'rgba(150,155,165,0.1)';
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 5, 2 + rand() * 5);
  }
  ctx.fillStyle = 'rgba(25,27,31,0.55)';
  ctx.fillRect(size / 2 - 1.5, 0, 3, size);
  ctx.fillRect(0, 0, 3, size);
  ctx.fillStyle = 'rgba(110,112,118,0.35)';
  ctx.fillRect(40, 150, 70, 46); // patch
  return finish(canvas, 'repeat', 'repeat');
}

/**
 * Painted board shutter face (flap): horizontal boards with a frame border, scuffs and a worn lower edge.
 * `widthM` x `heightM` is the world size of the whole texture (mapped 1:1, no repeat).
 */
export function createFlapTexture(widthM: number, heightM: number): CanvasTexture | null {
  const pxPerM = 200;
  const w = Math.round(widthM * pxPerM);
  const h = Math.round(heightM * pxPerM);
  const made = canvas2d(w, h);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(63);
  ctx.fillStyle = '#3d7a72';
  ctx.fillRect(0, 0, w, h);
  const boards = Math.max(4, Math.round(heightM / 0.14));
  const bh = h / boards;
  for (let i = 0; i < boards; i += 1) {
    ctx.fillStyle = shade('#3d7a72', 0.95 + rand() * 0.1);
    ctx.fillRect(0, i * bh + 1, w, bh - 2);
    ctx.fillStyle = 'rgba(15,40,36,0.45)';
    ctx.fillRect(0, i * bh, w, 2);
  }
  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(rand() * w, rand() * h, 8 + rand() * 30, 1.5);
  }
  // frame border (raised rail)
  ctx.strokeStyle = '#2b5a54';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.strokeStyle = 'rgba(180,215,205,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 13, w - 26, h - 26);
  // worn bottom edge and a few chips
  const grad = ctx.createLinearGradient(0, h * 0.8, 0, h);
  grad.addColorStop(0, 'rgba(70,55,40,0)');
  grad.addColorStop(1, 'rgba(70,55,40,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
  ctx.fillStyle = '#b9a98c';
  for (let i = 0; i < 7; i += 1) ctx.fillRect(14 + rand() * (w - 28), 14 + rand() * (h - 28), 3 + rand() * 5, 2 + rand() * 3);
  return finish(canvas, 'clamp', 'clamp');
}

/** Lightbox face: warm translucent-looking panel with the fictional name, never mirrored. */
export function createSignTexture(text: string, widthM: number, heightM: number): CanvasTexture | null {
  const pxPerM = 300;
  const w = Math.round(widthM * pxPerM);
  const h = Math.round(heightM * pxPerM);
  const made = canvas2d(w, h);
  if (!made) return null;
  const { canvas, ctx } = made;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1f4a40');
  grad.addColorStop(1, '#2a5a4e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#f0e2b6';
  ctx.lineWidth = Math.max(3, h * 0.03);
  ctx.strokeRect(h * 0.1, h * 0.1, w - h * 0.2, h - h * 0.2);
  const family = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
  let size = h * 0.52;
  ctx.font = `bold ${size}px ${family}`;
  const maxWidth = w - h * 0.7;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    size *= maxWidth / measured;
    ctx.font = `bold ${size}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(text, w / 2 + 3, h / 2 + size * 0.05 + 3);
  ctx.fillStyle = '#f7ecc8';
  ctx.fillText(text, w / 2, h / 2 + size * 0.05);
  return finish(canvas, 'clamp', 'clamp');
}

/** Small generic enamel plate (e.g. „Trinkhalle"). */
export function createPlateTexture(text: string, widthM: number, heightM: number): CanvasTexture | null {
  const pxPerM = 400;
  const w = Math.round(widthM * pxPerM);
  const h = Math.round(heightM * pxPerM);
  const made = canvas2d(w, h);
  if (!made) return null;
  const { canvas, ctx } = made;
  ctx.fillStyle = '#efe3c2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2f6a6e';
  ctx.lineWidth = Math.max(3, h * 0.07);
  ctx.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
  const family = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
  let size = h * 0.5;
  ctx.font = `bold ${size}px ${family}`;
  const maxWidth = w - h * 0.5;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    size *= maxWidth / measured;
    ctx.font = `bold ${size}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a4f52';
  ctx.fillText(text, w / 2, h / 2 + size * 0.05);
  return finish(canvas, 'clamp', 'clamp');
}

/** Rubber doormat with ribs, 1 x 1 m tile (repeat across the mat). */
export function createDoormatTexture(): CanvasTexture | null {
  const size = 128;
  const made = canvas2d(size, size);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = rng(3);
  ctx.fillStyle = '#3a3935';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, i, size, 3);
    ctx.fillStyle = 'rgba(120,115,100,0.18)';
    ctx.fillRect(0, i + 4, size, 1);
  }
  for (let i = 0; i < 120; i += 1) {
    ctx.fillStyle = 'rgba(150,140,115,0.18)';
    ctx.fillRect(rand() * size, rand() * size, 3, 1);
  }
  return finish(canvas, 'repeat', 'repeat');
}
