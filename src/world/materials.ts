import {
  CanvasTexture,
  Color,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Material,
  type Texture,
} from 'three';

/** Flat stylised greybox palette (warm brick, concrete, asphalt, muted green). */
export const palette = {
  sky: 0xcfe2ec,
  brick: 0xb5694c,
  brickCap: 0x8e4f3a,
  plaster: 0xe7d6b8,
  roof: 0x474b52,
  floor: 0xcdb597,
  door: 0x2f6a6e,
  doorHandle: 0xe9dcb8,
  shutter: 0x3f7d73,
  wood: 0x8a6240,
  woodLight: 0xb98f5f,
  counterBody: 0x7b8a8f,
  counterTop: 0xe6e0d2,
  signBoard: 0x25483f,
  sidewalk: 0xbdb8ae,
  curb: 0xa6a49e, // granite grey kerb stone
  asphalt: 0x585b60, // Auftrag 04.5: lighter, tone mapping darkened it
  roadLine: 0xe8e2c8,
  yard: 0x7d935f, // Auftrag 04.5: a little fresher, still muted (urban lawn, not golf course)
  base: 0x78895d,
  marker: 0xffc94d,
  player: { jacket: 0x2f6bc9, pants: 0x2d3446, skin: 0xf1c8a2, cap: 0xe2502e, shoe: 0x2a2a2a },
} as const;

/** Deterministic pseudo random generator so textures look the same on every start. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

function finishTexture(canvas: HTMLCanvasElement, repeat: boolean): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
}

/**
 * E-001 concrete plates 0.5 x 0.5 m over the whole sidewalk (one texture, no repetition, so stains and cracks do not
 * form a visible grid): per-plate tone, darker joints, a few newer replacement plates, faint stains and hairline cracks
 * on randomly chosen plates. Deterministic (fixed seed).
 */
export function createSlabTexture(widthM = 4, depthM = 4): CanvasTexture {
  const px = Math.max(1, Math.round(widthM / 0.5));
  const pz = Math.max(1, Math.round(depthM / 0.5));
  const cell = Math.max(16, Math.min(64, Math.floor(2048 / px)));
  const { canvas, ctx } = makeCanvas(cell * px, cell * pz);
  const rand = rng(11);
  const base = new Color(palette.sidewalk);
  for (let iz = 0; iz < pz; iz += 1) {
    for (let ix = 0; ix < px; ix += 1) {
      const roll = rand();
      const replaced = roll < 0.04;
      const shade = (replaced ? 1.04 : 0.93) + rand() * 0.08;
      ctx.fillStyle = `#${base.clone().multiplyScalar(shade).getHexString()}`;
      ctx.fillRect(ix * cell, iz * cell, cell, cell);
      for (let i = 0; i < 18; i += 1) {
        ctx.fillStyle = `#${base.clone().multiplyScalar(shade * (0.92 + rand() * 0.16)).getHexString()}`;
        ctx.fillRect(ix * cell + rand() * cell, iz * cell + rand() * cell, 2, 2);
      }
      if (roll > 0.94) {
        ctx.fillStyle = `rgba(70, 62, 50, ${0.06 + rand() * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(ix * cell + cell * (0.25 + rand() * 0.5), iz * cell + cell * (0.25 + rand() * 0.5), cell * (0.12 + rand() * 0.2), cell * (0.08 + rand() * 0.15), rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (roll > 0.9) {
        ctx.strokeStyle = 'rgba(60, 56, 50, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        let x = ix * cell + cell * (0.1 + rand() * 0.4);
        let y = iz * cell + 2;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k += 1) {
          x += (rand() - 0.4) * cell * 0.2;
          y += cell * (0.12 + rand() * 0.12);
          ctx.lineTo(Math.min(ix * cell + cell - 2, Math.max(ix * cell + 2, x)), Math.min(iz * cell + cell - 1, y));
        }
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = '#77736b';
  ctx.lineWidth = Math.max(2, cell / 24);
  ctx.beginPath();
  for (let i = 0; i <= px; i += 1) {
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, canvas.height);
  }
  for (let i = 0; i <= pz; i += 1) {
    ctx.moveTo(0, i * cell);
    ctx.lineTo(canvas.width, i * cell);
  }
  ctx.stroke();
  return finishTexture(canvas, false);
}

/**
 * E-002 asphalt over the whole street (one texture, no repetition): speckle, a few irregular, low-contrast repair
 * patches of different sizes, a longitudinal seam and some hairline cracks. Deterministic.
 */
export function createAsphaltTexture(widthM = 4, depthM = 4): CanvasTexture {
  const ppm = Math.max(16, Math.min(80, Math.floor(2048 / widthM)));
  const W = Math.round(widthM * ppm);
  const H = Math.round(depthM * ppm);
  const { canvas, ctx } = makeCanvas(W, H);
  const rand = rng(23);
  const base = new Color(palette.asphalt);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, W, H);
  // Large soft tone variation (worn wheel tracks are lighter), then fine speckle.
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `#${base.clone().multiplyScalar(0.96 + rand() * 0.08).getHexString()}`;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, ppm * (1 + rand() * 2), ppm * (0.4 + rand()), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < (W * H) / 60; i += 1) {
    ctx.fillStyle = `#${base.clone().multiplyScalar(1 + (rand() - 0.5) * 0.14).getHexString()}`;
    ctx.fillRect(rand() * W, rand() * H, 2 + rand() * 2, 2 + rand() * 2);
  }
  // Repair patches: one per ~6 m, irregular quadrilaterals, only slightly darker.
  const count = Math.max(1, Math.round(widthM / 6));
  for (let i = 0; i < count; i += 1) {
    const cx = ((i + 0.2 + rand() * 0.6) / count) * W;
    const cy = (0.2 + rand() * 0.6) * H;
    const hw = ppm * (0.5 + rand() * 1.2);
    const hh = ppm * (0.4 + rand() * 0.8);
    const pts: Array<[number, number]> = [
      [cx - hw + (rand() - 0.5) * ppm * 0.2, cy - hh],
      [cx + hw, cy - hh + (rand() - 0.5) * ppm * 0.2],
      [cx + hw + (rand() - 0.5) * ppm * 0.2, cy + hh],
      [cx - hw, cy + hh + (rand() - 0.5) * ppm * 0.2],
    ];
    ctx.fillStyle = `#${base.clone().multiplyScalar(0.9 + rand() * 0.04).getHexString()}`;
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(28, 28, 30, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Longitudinal seam a little off the centre line and a few hairline cracks.
  ctx.strokeStyle = 'rgba(26, 26, 30, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  let y = H * 0.32;
  ctx.moveTo(0, y);
  for (let x = 0; x <= W; x += ppm) {
    y += (rand() - 0.5) * ppm * 0.06;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < Math.round(widthM / 4); i += 1) {
    let x = rand() * W;
    let yy = rand() * H;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    for (let k = 0; k < 6; k += 1) {
      x += (rand() - 0.5) * ppm * 0.5;
      yy += (rand() - 0.5) * ppm * 0.5;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  return finishTexture(canvas, false);
}

/** Subtle speckle noise around a base colour (asphalt, yard). */
export function createNoiseTexture(baseHex: number, amount: number, seed: number): CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = rng(seed);
  const base = new Color(baseHex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i += 1) {
    const shade = 1 + (rand() - 0.5) * amount;
    ctx.fillStyle = `#${base.clone().multiplyScalar(shade).getHexString()}`;
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2 + rand() * 3);
  }
  return finishTexture(canvas, true);
}

export interface Materials {
  brick: MeshLambertMaterial;
  brickCap: MeshLambertMaterial;
  plaster: MeshLambertMaterial;
  roof: MeshLambertMaterial;
  floor: MeshLambertMaterial;
  door: MeshLambertMaterial;
  doorHandle: MeshLambertMaterial;
  shutter: MeshLambertMaterial;
  wood: MeshLambertMaterial;
  woodLight: MeshLambertMaterial;
  counterBody: MeshLambertMaterial;
  counterTop: MeshLambertMaterial;
  signBoard: MeshLambertMaterial;
  curb: MeshLambertMaterial;
  roadLine: MeshLambertMaterial;
  base: MeshLambertMaterial;
  /** Tinted placeholder for unknown asset ids. */
  placeholder: MeshLambertMaterial;
  /** Light front plate of generic furniture placeholders (makes rotation visible). */
  placeholderFront: MeshLambertMaterial;
  /** Per-asset tinted bodies of generic placeholders, created on demand. */
  placeholderTints: Map<string, MeshLambertMaterial>;
  marker: MeshBasicMaterial;
  playerJacket: MeshLambertMaterial;
  playerPants: MeshLambertMaterial;
  playerSkin: MeshLambertMaterial;
  playerCap: MeshLambertMaterial;
  playerShoe: MeshLambertMaterial;
  /** Textures owned by the factories; kept so dispose() can release them. */
  textures: Texture[];
}

export function createMaterials(): Materials {
  const lambert = (color: number): MeshLambertMaterial => new MeshLambertMaterial({ color });
  return {
    brick: lambert(palette.brick),
    brickCap: lambert(palette.brickCap),
    plaster: lambert(palette.plaster),
    roof: lambert(palette.roof),
    floor: lambert(palette.floor),
    door: lambert(palette.door),
    doorHandle: lambert(palette.doorHandle),
    shutter: lambert(palette.shutter),
    wood: lambert(palette.wood),
    woodLight: lambert(palette.woodLight),
    counterBody: lambert(palette.counterBody),
    counterTop: lambert(palette.counterTop),
    signBoard: lambert(palette.signBoard),
    curb: lambert(palette.curb),
    roadLine: lambert(palette.roadLine),
    base: lambert(palette.base),
    placeholder: lambert(0xd05fd0),
    placeholderFront: lambert(0xf2ead2),
    placeholderTints: new Map(),
    // UI colour (interaction yellow): exempt from tone mapping so it stays exactly the reserved signal colour.
    marker: new MeshBasicMaterial({ color: palette.marker, transparent: true, toneMapped: false }),
    playerJacket: lambert(palette.player.jacket),
    playerPants: lambert(palette.player.pants),
    playerSkin: lambert(palette.player.skin),
    playerCap: lambert(palette.player.cap),
    playerShoe: lambert(palette.player.shoe),
    textures: [],
  };
}

export function isMaterial(value: unknown): value is Material {
  return typeof value === 'object' && value !== null && 'isMaterial' in value;
}
