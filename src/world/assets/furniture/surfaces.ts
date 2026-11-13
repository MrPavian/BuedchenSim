import { MAGAZINE_TRAY_TILT } from './magazineRack';

/**
 * Presentation surfaces that are not horizontal. Slot boxes are defined for flat boards; furniture with sloped
 * surfaces tells the stock view how much, so goods lie on the slope instead of cutting into it.
 */
const SURFACE_TILT: Readonly<Record<string, number>> = {
  'I-007': MAGAZINE_TRAY_TILT,
};

/** Tilt in radians of the presentation surfaces of a furniture asset (front end lower than the back); 0 = flat. */
export function furnitureSurfaceTilt(assetId: string): number {
  return Object.hasOwn(SURFACE_TILT, assetId) ? (SURFACE_TILT[assetId] ?? 0) : 0;
}
