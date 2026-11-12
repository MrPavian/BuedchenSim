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

/** Rotation around the vertical axis in degrees, counter-clockwise seen from above (+Y). */
export type QuarterTurn = 0 | 90 | 180 | 270;

export type AssetCategory = 'building' | 'furniture' | 'ground';

/** Functional role of a placed item (usage, not look). */
export type PlacementRole = 'sales' | 'checkout' | 'display' | 'cooling' | 'freezing' | 'storage' | 'returns';

/**
 * Catalog entry for one asset (register id, e.g. 'I-005'). The asset id is NOT a placement id:
 * one asset can be placed many times.
 */
export interface AssetDef {
  assetId: string;
  /** German display name. */
  name: string;
  category: AssetCategory;
  /** Bounding size in metres at rotation 0: width along X, depth along Z, height along Y. Pivot = ground centre of this box. */
  size: { width: number; depth: number; height: number };
  /** At rotation 0 the asset's front (customer/use side) faces +Z (south). */
  collides: boolean;
  allowedRotations: QuarterTurn[];
  scalable: boolean;
  /** May only be placed on top of another placement (e.g. cash register on the counter). */
  requiresSupport?: boolean;
  defaultRole?: PlacementRole;
}

/** One placed instance of an asset. Placements are content (not saved state). */
export interface PlacementDef {
  /** Stable id, prefix 'placement.'. */
  id: string;
  assetId: string;
  /** Pivot position on the ground plane. */
  position: Vec2;
  rotation: QuarterTurn;
  /** Only allowed when the asset is scalable. */
  scale?: number;
  /** Id of the placement this one stands on; its base is then at the supporter's height and it never collides itself. */
  on?: string;
  role?: PlacementRole;
  /** Overrides AssetDef.collides (e.g. decorative items). */
  collides?: boolean;
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
  /** Where the visual marker is shown (defaults to `position` at ground level). */
  marker?: {
    position: Vec2;
    height: number;
    /** Outer ring radius in m (default 0.42), along x. */
    radius?: number;
    /** Half depth along z in m; when smaller than `radius` the marker is drawn as a flat filled ellipse (e.g. on a narrow ledge). */
    radiusZ?: number;
  };
}

export interface RegionLayout {
  kiosk: KioskDef;
  /** Version of the placement list format/content; start at 1. */
  layoutVersion: number;
  placements: PlacementDef[];
  ground: GroundAreaDef[];
  /** The player may not leave this. */
  walkBounds: Rect;
  spawn: { position: Vec2; heading: number };
  interactionPoints: InteractionPointDef[];
}

export interface ContentPack {
  regionId: string;
  name: string;
  /** Asset catalog used by this pack, keyed by asset id. */
  assets: Record<string, AssetDef>;
  layout: RegionLayout;
}
