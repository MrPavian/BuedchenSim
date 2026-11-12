import { PLAYER_RADIUS } from './constants';
import { layoutColliders } from './colliders';
import type { AssetDef, Rect, RegionLayout } from './types';

/** Flood-fill resolution in metres. */
export const REACH_CELL = 0.1;

export interface ReachGrid {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  cell: number;
  /** 1 where the player circle centre can stand and is connected to the start. */
  reachable: Uint8Array;
}

function blocked(x: number, z: number, radius: number, obstacles: readonly Rect[]): boolean {
  const r2 = (radius - 1e-9) * (radius - 1e-9);
  for (const o of obstacles) {
    const cx = Math.min(Math.max(x, o.minX), o.maxX);
    const cz = Math.min(Math.max(z, o.minZ), o.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

/**
 * Grid flood fill from the spawn point for a circle of the player radius against walls and
 * placement colliders, with doors treated as OPEN. Returns null when the spawn cell itself is blocked.
 */
export function computeReachability(
  layout: RegionLayout,
  assets: Readonly<Record<string, AssetDef>>,
  radius: number = PLAYER_RADIUS,
  cell: number = REACH_CELL,
): ReachGrid | null {
  const b = layout.walkBounds;
  const cols = Math.max(1, Math.floor((b.maxX - b.minX) / cell));
  const rows = Math.max(1, Math.floor((b.maxZ - b.minZ) / cell));
  const obstacles = layoutColliders(layout, assets, true);
  const free = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = b.minX + (i + 0.5) * cell;
      const z = b.minZ + (j + 0.5) * cell;
      free[j * cols + i] = blocked(x, z, radius, obstacles) ? 0 : 1;
    }
  }
  const si = Math.min(cols - 1, Math.max(0, Math.floor((layout.spawn.position.x - b.minX) / cell)));
  const sj = Math.min(rows - 1, Math.max(0, Math.floor((layout.spawn.position.z - b.minZ) / cell)));
  if (!free[sj * cols + si]) return null;

  const reachable = new Uint8Array(cols * rows);
  const stack: number[] = [sj * cols + si];
  reachable[sj * cols + si] = 1;
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const i = idx % cols;
    const j = (idx - i) / cols;
    const neighbours = [
      i > 0 ? idx - 1 : -1,
      i < cols - 1 ? idx + 1 : -1,
      j > 0 ? idx - cols : -1,
      j < rows - 1 ? idx + cols : -1,
    ];
    for (const n of neighbours) {
      if (n >= 0 && free[n] && !reachable[n]) {
        reachable[n] = 1;
        stack.push(n);
      }
    }
  }
  return { minX: b.minX, minZ: b.minZ, cols, rows, cell, reachable };
}

/** True when some reachable cell centre lies inside `rect` (edges included). */
export function anyReachableInRect(grid: ReachGrid, rect: Rect): boolean {
  const i0 = Math.max(0, Math.ceil((rect.minX - grid.minX) / grid.cell - 0.5));
  const i1 = Math.min(grid.cols - 1, Math.floor((rect.maxX - grid.minX) / grid.cell - 0.5));
  const j0 = Math.max(0, Math.ceil((rect.minZ - grid.minZ) / grid.cell - 0.5));
  const j1 = Math.min(grid.rows - 1, Math.floor((rect.maxZ - grid.minZ) / grid.cell - 0.5));
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) if (grid.reachable[j * grid.cols + i]) return true;
  }
  return false;
}

/** True when some reachable cell centre lies within `radius` of the point. */
export function anyReachableWithin(grid: ReachGrid, x: number, z: number, radius: number): boolean {
  const i0 = Math.max(0, Math.floor((x - radius - grid.minX) / grid.cell));
  const i1 = Math.min(grid.cols - 1, Math.ceil((x + radius - grid.minX) / grid.cell));
  const j0 = Math.max(0, Math.floor((z - radius - grid.minZ) / grid.cell));
  const j1 = Math.min(grid.rows - 1, Math.ceil((z + radius - grid.minZ) / grid.cell));
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      if (!grid.reachable[j * grid.cols + i]) continue;
      const cx = grid.minX + (i + 0.5) * grid.cell;
      const cz = grid.minZ + (j + 0.5) * grid.cell;
      if ((cx - x) ** 2 + (cz - z) ** 2 <= radius * radius) return true;
    }
  }
  return false;
}

/** True when the player can stand within ~one cell of the given point. */
export function isPointReachable(grid: ReachGrid, x: number, z: number): boolean {
  return anyReachableWithin(grid, x, z, grid.cell * 0.75);
}
