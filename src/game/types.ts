/**
 * Content contracts for phase 1.
 * Coordinates: 1 unit = 1 m, Y up, ground plane is X/Z; +X = east (screen right),
 * +Z = south (toward the camera/street).
 */
import type { CustomerLines, DialogueDef, NavDef, NpcDef, QuestDef } from './npcTypes';

export type * from './npcTypes';

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

export type AssetCategory = 'building' | 'furniture' | 'ground' | 'product';

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
  /**
   * Story flag (state.story.flags) that makes this placement exist (e.g. a bench built after a story decision).
   * Absent: always present. Validation treats gated placements as present (conservative).
   */
  requiresFlag?: string;
}

export interface GroundAreaDef {
  id: string;
  assetId?: string;
  kind: 'sidewalk' | 'street' | 'yard' | 'curb';
  rect: Rect;
}

/** `door` and `shutter` toggle a wall opening; `register` (till) and `storage` (goods management) only ask the UI to open a panel. */
export type InteractionKind = 'door' | 'shutter' | 'register' | 'storage';

export interface InteractionPointDef {
  id: string;
  kind: InteractionKind;
  position: Vec2;
  radius: number;
  /** Required for `door` and `shutter` (the wall opening they operate); unused for `register` and `storage`. */
  openingId?: string;
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
  /** Hand-kept walking graph and places of the residents. */
  nav: NavDef;
}

/** Kind of presentation place a product needs. */
export type StorageKind = 'shelf' | 'cooled' | 'frozen' | 'counter' | 'press';

export type ProductCategory = 'drink' | 'snack' | 'sweet' | 'icecream' | 'bakery' | 'press' | 'everyday';

/** Clearly marked product groups inside a category. */
export type ProductSubcategory = 'beer' | 'tobacco';

/** Shared model factory of the world layer: products with the same package kind share one shape. */
export type PackageKind =
  | 'glass-bottle'
  | 'pet-bottle'
  | 'can'
  | 'bag'
  | 'bar'
  | 'box'
  | 'ice-stick'
  | 'ice-cup'
  | 'pastry'
  | 'magazine';

/** Catalog entry of one sellable product. All prices are integer cents. */
export interface ProductDef {
  /** Stable content id, prefix 'product.'; never renamed or reused. */
  id: string;
  /** Display name. */
  name: string;
  /** Fictional brand family. */
  brand: string;
  category: ProductCategory;
  subcategory?: ProductSubcategory;
  purchasePriceCents: number;
  suggestedPriceCents: number;
  /** What kind of presentation place the product needs. */
  storage: StorageKind;
  /** Legal minimum age (16 or 18). Absent = unrestricted. The ONLY source of the age restriction. */
  minimumAge?: number;
  demandTags: string[];
  /** Register id of the product model ('P-0xx'); its AssetDef.size is the size of ONE unit. */
  assetId: string;
  package: PackageKind;
  /** Overrides the package's default stack limit (see balance.ts). */
  maxStack?: number;
  label: { primaryColor: string; accentColor: string; text: string };
}

/**
 * A box on a placement that holds goods of one product at a time. Defined in the placement's LOCAL frame at
 * rotation 0 (pivot = ground centre, front = +Z), independent of Three.js.
 */
export interface StockSlotDef {
  /** Stable id, prefix 'slot.'. */
  id: string;
  placementId: string;
  accepts: StorageKind;
  /** Bottom-centre of the box in the placement's local frame (y = height above the placement's base). */
  origin: { x: number; y: number; z: number };
  /** Extent of the box: width along X, depth along Z, height along Y. */
  size: { width: number; depth: number; height: number };
}

export interface ContentPack {
  regionId: string;
  name: string;
  /** Asset catalog used by this pack, keyed by asset id. */
  assets: Record<string, AssetDef>;
  layout: RegionLayout;
  /** Product catalog, keyed by product id. */
  products: Record<string, ProductDef>;
  /** Presentation slots on placements. */
  stockSlots: StockSlotDef[];
  /** Residents, keyed by npc id. */
  npcs: Record<string, NpcDef>;
  /** Dialogues, keyed by dialogue id. */
  dialogues: Record<string, DialogueDef>;
  /** Quests, keyed by quest id. */
  quests: Record<string, QuestDef>;
  /** Generic lines of the built-in customer dialogue. */
  customerLines: CustomerLines;
}
