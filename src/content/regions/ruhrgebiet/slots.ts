import type { StockSlotDef, StorageKind } from '../../../game/types';

/**
 * Presentation slots of the Ruhrgebiet kiosk. Every slot is a box in the LOCAL frame of its placement at rotation 0
 * (pivot = ground centre of the asset box, front = +Z, y = height above the placement's base). The numbers are
 * derived from the real furniture factories in src/world/assets/furniture/ (read-only for content); the integration
 * test src/integration/stock-slots.test.ts builds the factories and verifies that every slot bottom rests on a
 * surface (+-2 cm) with free headroom, so a factory change that moves a board is caught there.
 *
 * Fill order inside a slot (src/game/stockLayout.ts): layer by layer, front row (+Z edge of the slot) first.
 * Slots on the back side of the middle shelf face -Z; their rows therefore fill from the shelf centre outwards
 * until the slot is full (the world layer may mirror the fill order for those slots).
 *
 * The storage rack I-011 and the crates I-012 are back storage and have no presentation slots.
 * Ids: `slot.<placement short name>.<n>`, numbered per placement in the order below; never reused.
 */

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

interface Box {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

function make(placementShort: string, accepts: StorageKind, boxes: Box[]): StockSlotDef[] {
  return boxes.map((b, i) => ({
    id: `slot.${placementShort}.${i + 1}`,
    placementId: `placement.${placementShort}`,
    accepts,
    origin: { x: r3(b.x), y: r3(b.y), z: r3(b.z) },
    size: { width: r3(b.width), depth: r3(b.depth), height: r3(b.height) },
  }));
}

/**
 * I-003 Wandregal (2.4 x 0.4 x 2.0), wallShelf.ts: five boards, board top i = plinthH + board + 0.1 +
 * i * (h - plinthH - board - 0.1) / 4 = 0.215 + i * 0.44625 (lines 'const top = ...'); the top board (i = 4) is the
 * roof at 2.0 m and carries nothing, so four usable boards 0.215 / 0.661 / 1.108 / 1.554 m. Clear height under the
 * next board = 0.44625 - 0.035 = 0.411 m -> slot height 0.39. Two intermediate supports (x = +-0.4, 3 cm wide,
 * 'Two intermediate supports') split every board into three bays: x -1.155..-0.415, -0.385..0.385, 0.415..1.155.
 * Slots keep 1 cm to the supports. Board depth: back panel at z -0.175 to the price rail at z 0.186 -> slot z -0.165..0.175.
 */
function wallShelf(placementShort: string): StockSlotDef[] {
  const tops = [0, 1, 2, 3].map((i) => 0.215 + i * 0.44625);
  const bays = [
    { x: -0.785, width: 0.72 }, // -1.145 .. -0.425
    { x: 0, width: 0.74 }, // -0.37 .. 0.37
    { x: 0.785, width: 0.72 }, // 0.425 .. 1.145
  ];
  const boxes: Box[] = [];
  for (const top of tops) {
    for (const bay of bays) boxes.push({ x: bay.x, y: top, z: 0.005, width: bay.width, depth: 0.34, height: 0.39 });
  }
  return make(placementShort, 'shelf', boxes);
}

/**
 * I-004 Mittelregal (1.2 x 0.5 x 1.35), middleShelf.ts: boards on both long sides, board i bottom = baseH + 0.1 +
 * i * 0.3 (0.2 / 0.5 / 0.8 / 1.1), thickness 0.025 -> tops 0.225 / 0.525 / 0.825 / 1.125. Boards run from the centre
 * panel (|z| 0.015) to the price rail (|z| 0.234); inside the end caps x -0.56..0.56. Clear height to the next board
 * 0.275 -> slot height 0.26. The fourth board (1.125) has only 0.125 m under the header and carries no slot.
 * Two halves per board and side.
 */
function middleShelf(): StockSlotDef[] {
  const tops = [0.225, 0.525, 0.825];
  const boxes: Box[] = [];
  for (const side of [1, -1]) {
    for (const top of tops) {
      for (const x of [-0.28, 0.28]) boxes.push({ x, y: top, z: side * 0.125, width: 0.54, depth: 0.2, height: 0.26 });
    }
  }
  return make('middle-shelf', 'shelf', boxes);
}

/**
 * I-005 Getränkekühlschrank (0.7 x 0.7 x 2.0), fridge.ts: liner floor top yIn0 + l = 0.208, four wire shelves at
 * yIn0 + i * (yIn1 - fw - yIn0) / 5 = 0.505 / 0.81 / 1.115 / 1.42 with 8 mm rods (tops 0.513 / 0.818 / 1.123 / 1.428),
 * glass up to yIn1 - fw = 1.725. Clear height per level 0.297 -> slot height 0.29. Interior x -0.292..0.292,
 * z -0.292..0.305 (light strips at the door frame, z >= 0.29): two columns of 0.28 m, z -0.145..0.285.
 */
function fridge(): StockSlotDef[] {
  const levels = [0.208, 0.513, 0.818, 1.123, 1.428];
  const boxes: Box[] = [];
  for (const y of levels) {
    for (const x of [-0.145, 0.145]) boxes.push({ x, y, z: 0.07, width: 0.28, depth: 0.43, height: 0.29 });
  }
  return make('fridge', 'cooled', boxes);
}

/**
 * I-006 Eistruhe (1.2 x 0.65 x 0.9), freezer.ts: well floor liner top floorTop + 0.006 = 0.196 (wire basket rods
 * to 0.208), inner x -0.53..0.53, z -0.255..0.255, glass lids at 0.85. The wire basket (left end, x -0.51..-0.107,
 * 'Wire divider basket') is compartment 1 (inside the posts: x -0.495..-0.12, z +-0.22); the open well to its right
 * (x -0.09..0.53) is divided into three compartments of 0.19 m. Height 0.3 (units are at most 0.2 m tall).
 */
function freezer(): StockSlotDef[] {
  return make('freezer', 'frozen', [
    { x: -0.3075, y: 0.196, z: 0, width: 0.375, depth: 0.44, height: 0.3 },
    { x: 0, y: 0.196, z: 0, width: 0.19, depth: 0.46, height: 0.3 },
    { x: 0.2, y: 0.196, z: 0, width: 0.19, depth: 0.46, height: 0.3 },
    { x: 0.4, y: 0.196, z: 0, width: 0.19, depth: 0.46, height: 0.3 },
  ]);
}

/**
 * I-007 Zeitschriftenständer (0.8 x 0.4 x 1.5), magazineRack.ts: five tilted trays (tilt 0.3 rad, thickness 0.02),
 * tier k: zf = hd - 0.04 k, cz = -0.02 k, cy = baseH + 0.28 k + 0.084; tray top at z: cy + (cz - z) * tan(0.3) + 0.0105.
 * The front lip occupies z >= zf - 0.04. Slots sit behind the lip: depth 0.10, centre z = 0.105 - 0.04 k, bottom at the
 * tray top at the centre of the slot (0.162 + 0.2862 k; the tilt makes it +-1.6 cm over the depth). The distance to
 * the underside / lip of the next tier is >= 0.243 m -> slot height 0.235. The fifth tier has only 0.16 m under the
 * top board and carries no slot. Inner width x -0.37..0.37: three columns of 0.23 m per tier.
 * The trays are empty in the factory; the stock view draws the magazines.
 */
function magazineRack(): StockSlotDef[] {
  const boxes: Box[] = [];
  for (let k = 0; k < 4; k += 1) {
    for (const x of [-0.24, 0, 0.24]) {
      boxes.push({ x, y: 0.162 + 0.286187 * k, z: 0.105 - 0.04 * k, width: 0.23, depth: 0.1, height: 0.235 });
    }
  }
  return make('magazine-rack', 'press', boxes);
}

/**
 * I-001 Verkaufstheke (2.8 x 0.65 x 1.0), counter.ts: worktop top at h = 1.0. The register (I-002, 0.45 x 0.4,
 * local x 0.575..1.025, z -0.2..0.2) stands on the right; five slots of 0.34 m on the staff-side half (z -0.30..0.0)
 * end at x = 0.51, 6.5 cm before the register. The customer-side half of the worktop (z 0..0.325) stays free for
 * handing over goods.
 */
function counter(): StockSlotDef[] {
  const xs = [-1.18, -0.8, -0.42, -0.04, 0.34];
  return make(
    'counter',
    'counter',
    xs.map((x) => ({ x, y: 1.0, z: -0.15, width: 0.34, depth: 0.3, height: 0.3 })),
  );
}

export const ruhrgebietStockSlots: StockSlotDef[] = [
  ...counter(),
  ...wallShelf('wall-shelf-north'),
  ...wallShelf('wall-shelf-west'),
  ...fridge(),
  ...magazineRack(),
  ...middleShelf(),
  ...freezer(),
];
