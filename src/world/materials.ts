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
  curb: 0xd2cec4,
  asphalt: 0x4a4d52,
  roadLine: 0xe8e2c8,
  yard: 0x84946a,
  base: 0x7f8b66,
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

/** 4 x 4 concrete slabs with visible joints and slight per-slab tone variation (covers 4 x 4 m). */
export function createSlabTexture(): CanvasTexture {
  const cell = 64;
  const { canvas, ctx } = makeCanvas(cell * 4, cell * 4);
  const rand = rng(11);
  const base = new Color(palette.sidewalk);
  for (let ix = 0; ix < 4; ix += 1) {
    for (let iz = 0; iz < 4; iz += 1) {
      const shade = 0.94 + rand() * 0.1;
      ctx.fillStyle = `#${base.clone().multiplyScalar(shade).getHexString()}`;
      ctx.fillRect(ix * cell, iz * cell, cell, cell);
    }
  }
  ctx.strokeStyle = '#8b8780';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, canvas.height);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(canvas.width, i * cell);
    ctx.stroke();
  }
  return finishTexture(canvas, true);
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
    marker: new MeshBasicMaterial({ color: palette.marker, transparent: true }),
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
