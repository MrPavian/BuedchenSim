import { Group, type Object3D } from 'three';
import type { WallSide } from '../../../game/types';

/** Names the views look up (not gameplay data). */
export const KIOSK_NAMES = {
  root: 'K-001',
  door: 'kiosk.door.leaf',
  shutter: 'kiosk.shutter.flap',
  roof: 'kiosk.roof',
  sign: 'kiosk.sign',
  awning: 'kiosk.awning',
  cutPrefix: 'kiosk.cut.',
  fixturesPrefix: 'kiosk.fixture.',
} as const;

/** Anything that follows a 0..1 open amount (door swing, flap swing + stays). Stored in `userData.kioskAnimated`. */
export interface KioskAnimated {
  setOpen(amount: number): void;
}

/**
 * Named parts of the K-001 factory result so views and the occlusion can address them.
 *
 * A "cut group" is a wrapper whose origin lies on the cut plane (y = cutHeight): scaling it along Y
 * to 0 lowers everything inside it onto the cut line. All content above the cut of one wall side
 * (upper wall parts, window frame head, flap, sign, awning, fixtures) lives in that side's group.
 */
export interface KioskParts {
  /** Height of the dollhouse cut in metres (the sales window sill). */
  cutHeight: number;
  /** Cut groups per wall side; north stays empty (the north wall is the backdrop). */
  cut: Record<WallSide, Object3D[]>;
  /** Origin at the underside of the roof slab; the whole roof (slab, parapet, coping, details). */
  roof: Object3D;
  /** Rotating door pivot (lower leaf part; the upper leaf part is a cut group of the south side). */
  door: Object3D | null;
  /** Rotating flap pivot. */
  flap: Object3D | null;
  sign: Object3D | null;
  awning: Object3D | null;
  /** Exterior fixtures (lamps, downpipe, plates) for views that want to address them. */
  fixtures: Object3D[];
  /** Animated parts (door, flap) keyed by name. */
  animated: Record<string, KioskAnimated>;
}

const PARTS_KEY = 'kioskParts';

export function setKioskParts(root: Object3D, parts: KioskParts): void {
  root.userData[PARTS_KEY] = parts;
}

/** Returns the parts stored on a K-001 root by the factory (throws for other objects). */
export function getKioskParts(root: Object3D): KioskParts {
  const parts = root.userData[PARTS_KEY] as KioskParts | undefined;
  if (!parts) throw new Error('Object is not a kiosk built by the K-001 factory');
  return parts;
}

/**
 * Wrapper/content pair for cut-down or hide transitions: the wrapper's origin sits at `originY`
 * (root coordinates); `content` is offset back so children can use plain root coordinates.
 */
export function createScalableGroup(name: string, originY: number): { wrapper: Group; content: Group } {
  const wrapper = new Group();
  wrapper.name = name;
  wrapper.position.y = originY;
  const content = new Group();
  content.name = `${name}.content`;
  content.position.y = -originY;
  wrapper.add(content);
  return { wrapper, content };
}
