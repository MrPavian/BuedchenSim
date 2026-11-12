import { PACKAGE_MAX_STACK, UNIT_GAP_METERS } from './balance';
import type { ProductDef, StockSlotDef } from './types';

/**
 * Single source of truth for how goods are arranged in a stock slot. The world layer draws units at exactly
 * these positions, so capacity always equals what is visible and models never overlap.
 */

export interface UnitSize {
  width: number;
  depth: number;
  height: number;
}

/** Position in the placement's local frame: bottom-centre of one unit. */
export interface UnitPosition {
  x: number;
  y: number;
  z: number;
}

export interface StockLayoutOptions {
  /** Gap between neighbouring units in metres (default UNIT_GAP_METERS). */
  gap?: number;
  /** Maximum number of layers (default 1 = no stacking). */
  maxStack?: number;
}

const EPSILON = 1e-9;

function fits(available: number, unit: number, gap: number): number {
  return Math.max(0, Math.floor((available + gap + EPSILON) / (unit + gap)));
}

/** Layer limit of a product: its own override or the default of its package kind. */
export function productMaxStack(product: Pick<ProductDef, 'package' | 'maxStack'>): number {
  return product.maxStack ?? PACKAGE_MAX_STACK[product.package];
}

/**
 * Positions of all units a slot can hold, in fill order: layer by layer, front row (+Z) first,
 * left to right. The first n entries are where n units stand, so capacity is monotonic.
 * Columns run along the width (centred), rows along the depth (flush with the front edge).
 */
export function slotUnitPositions(
  slot: Pick<StockSlotDef, 'origin' | 'size'>,
  unit: UnitSize,
  options: StockLayoutOptions = {},
): UnitPosition[] {
  const gap = Math.max(0, options.gap ?? UNIT_GAP_METERS);
  const { width, depth, height } = slot.size;
  const sizes = [unit.width, unit.depth, unit.height, width, depth, height, gap];
  if (sizes.some((v) => !Number.isFinite(v)) || unit.width <= 0 || unit.depth <= 0 || unit.height <= 0) return [];

  const columns = fits(width, unit.width, gap);
  const rows = fits(depth, unit.depth, gap);
  const stack = Math.max(1, Math.floor(options.maxStack ?? 1));
  const layers = Math.min(stack, Math.floor((height + EPSILON) / unit.height));
  if (columns === 0 || rows === 0 || layers === 0) return [];

  const blockWidth = columns * unit.width + (columns - 1) * gap;
  const startX = slot.origin.x - blockWidth / 2 + unit.width / 2;
  const frontZ = slot.origin.z + depth / 2 - unit.depth / 2;

  const positions: UnitPosition[] = [];
  for (let layer = 0; layer < layers; layer += 1) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        positions.push({
          x: startX + column * (unit.width + gap),
          y: slot.origin.y + layer * unit.height,
          z: frontZ - row * (unit.depth + gap),
        });
      }
    }
  }
  return positions;
}

/** Number of units a slot holds; by definition the length of `slotUnitPositions`. */
export function slotCapacity(
  slot: Pick<StockSlotDef, 'origin' | 'size'>,
  unit: UnitSize,
  options: StockLayoutOptions = {},
): number {
  return slotUnitPositions(slot, unit, options).length;
}
