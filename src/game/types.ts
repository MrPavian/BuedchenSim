/**
 * Content contracts for phase 1.
 * Coordinates: 1 unit = 1 m, Y up, ground plane is X/Z; +X = east (screen right),
 * +Z = south (toward the camera/street).
 */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type WallSide = 'north' | 'south' | 'east' | 'west';

export interface WallOpening {
  /** e.g. 'opening.door', 'opening.sales-window' */
  id: string;
  kind: 'door' | 'window';
  side: WallSide;
  /** Extent along the wall in world coords (x for north/south walls, z for east/west). */
  from: number;
  to: number;
  /** Bottom/top height in m (door: sill 0). */
  sill: number;
  head: number;
}

export interface KioskDef {
  /** e.g. 'K-001' */
  assetId: string;
  /** Outer dimensions. */
  footprint: Rect;
  height: number;
  wallThickness: number;
  openings: WallOpening[];
  /** Fictional signage. */
  signText: string;
}

/** Greybox blocks; all of them block movement. */
export interface FurnitureDef {
  id: string;
  assetId: string;
  rect: Rect;
  height: number;
}

export interface GroundAreaDef {
  id: string;
  assetId?: string;
  kind: 'sidewalk' | 'street' | 'yard' | 'curb';
  rect: Rect;
}

export type InteractionKind = 'door' | 'shutter';

export interface InteractionPointDef {
  id: string;
  kind: InteractionKind;
  position: Vec2;
  radius: number;
  openingId: string;
}

export interface RegionLayout {
  kiosk: KioskDef;
  furniture: FurnitureDef[];
  ground: GroundAreaDef[];
  /** The player may not leave this. */
  walkBounds: Rect;
  spawn: { position: Vec2; heading: number };
  interactionPoints: InteractionPointDef[];
}

export interface ContentPack {
  regionId: string;
  name: string;
  layout: RegionLayout;
}
