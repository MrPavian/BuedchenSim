import { Group, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { kioskCutHeight, type Box } from '../../../game/kioskGeometry';
import type { KioskDef, WallOpening, WallSide } from '../../../game/types';
import type { KioskMaterials } from './materials';
import { KIOSK_NAMES, createScalableGroup, type KioskAnimated } from './parts';

/** Everything the part builders share. Builders add into the content groups using root coordinates. */
export interface KioskContext {
  kiosk: KioskDef;
  m: KioskMaterials;
  /** World position of the footprint centre (= root position). */
  cx: number;
  cz: number;
  /** Dollhouse cut height (sales window sill). */
  cut: number;
  /** Parent of everything that never hides. */
  fixed: Group;
  /** Content groups above the cut per wall side (root coordinates, offset by the wrapper). */
  upper: Record<WallSide, Group>;
  /** Roof content group (root coordinates). */
  roof: Group;
  salesWindow: WallOpening | undefined;
  door: WallOpening | undefined;
  /** Registered by builders for door/flap swing animation. */
  animated: Record<string, KioskAnimated>;
  /** Fixtures that views may address (lamps, downpipe, plates). */
  fixtures: Object3D[];
  /** Extra cut groups living outside the side content (e.g. the upper door leaf inside the rotating pivot). */
  cutExtras: Record<WallSide, Object3D[]>;
}

export interface KioskContextBundle {
  ctx: KioskContext;
  /** Wrappers to add to the root, per side. */
  wrappers: Record<WallSide, Object3D>;
  roofWrapper: Object3D;
}

export function createKioskContext(kiosk: KioskDef, m: KioskMaterials, fixed: Group): KioskContextBundle {
  const fp = kiosk.footprint;
  const cut = kioskCutHeight(kiosk);
  const make = (side: WallSide) => createScalableGroup(`${KIOSK_NAMES.cutPrefix}${side}`, cut);
  const south = make('south');
  const north = make('north');
  const east = make('east');
  const west = make('west');
  const roof = createScalableGroup(KIOSK_NAMES.roof, kiosk.height);
  const ctx: KioskContext = {
    kiosk,
    m,
    cx: (fp.minX + fp.maxX) / 2,
    cz: (fp.minZ + fp.maxZ) / 2,
    cut,
    fixed,
    upper: { south: south.content, north: north.content, east: east.content, west: west.content },
    roof: roof.content,
    salesWindow: kiosk.openings.find((o) => o.kind === 'window' && o.side === 'south'),
    door: kiosk.openings.find((o) => o.kind === 'door'),
    animated: {},
    fixtures: [],
    cutExtras: { south: [], north: [], east: [], west: [] },
  };
  return {
    ctx,
    wrappers: { south: south.wrapper, north: north.wrapper, east: east.wrapper, west: west.wrapper },
    roofWrapper: roof.wrapper,
  };
}

/** Converts a data-space box (world x/z) to root-local coordinates. */
export function localBox(ctx: KioskContext, b: Box): Box {
  return { ...b, minX: b.minX - ctx.cx, maxX: b.maxX - ctx.cx, minZ: b.minZ - ctx.cz, maxZ: b.maxZ - ctx.cz };
}

/** Plain mesh helper with shadow flags. */
export function mesh(geometry: BufferGeometry, material: Material, name?: string, cast = true, receive = true): Mesh {
  const m = new Mesh(geometry, material);
  if (name) m.name = name;
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Outward yaw per side: local +Z of an opening rig points away from the building. */
const SIDE_YAW: Record<WallSide, number> = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

export interface OpeningFrame {
  /** Half width of the opening along the wall. */
  halfWidth: number;
  /** Half the wall thickness: the wall's outer face lies at local z = +halfWall, the inner face at -halfWall. */
  halfWall: number;
}

/**
 * A rig at an opening: origin on the wall centre line at the opening centre, local +Z = outward,
 * local +X along the wall (south: +x, north: -x, east: -z, west: +z; the hinge side of doors is always +X),
 * Y absolute (ground = 0).
 */
export function createOpeningRig(ctx: KioskContext, o: WallOpening, name: string): { rig: Group; frame: OpeningFrame } {
  const fp = ctx.kiosk.footprint;
  const t = ctx.kiosk.wallThickness;
  const centre = (o.from + o.to) / 2;
  const rig = new Group();
  rig.name = name;
  switch (o.side) {
    case 'south':
      rig.position.set(centre - ctx.cx, 0, fp.maxZ - t / 2 - ctx.cz);
      break;
    case 'north':
      rig.position.set(centre - ctx.cx, 0, fp.minZ + t / 2 - ctx.cz);
      break;
    case 'east':
      rig.position.set(fp.maxX - t / 2 - ctx.cx, 0, centre - ctx.cz);
      break;
    case 'west':
      rig.position.set(fp.minX + t / 2 - ctx.cx, 0, centre - ctx.cz);
      break;
  }
  rig.rotation.y = SIDE_YAW[o.side];
  return { rig, frame: { halfWidth: (o.to - o.from) / 2, halfWall: t / 2 } };
}
