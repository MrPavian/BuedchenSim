import { BoxGeometry, Group, Mesh, type Material, type Object3D } from 'three';
import type { KioskDef, WallOpening, WallSide } from '../../game/types';
import { buildWallPieces, wallRect, type Box } from '../../game/kioskGeometry';
import { createSignTexture, type Materials } from '../materials';

/** Names the views look up (not gameplay data). */
export const KIOSK_NAMES = {
  door: 'kiosk.door.leaf',
  shutter: 'kiosk.shutter.flap',
  roof: 'kiosk.roof',
  sign: 'kiosk.sign',
  wallPrefix: 'kiosk.wall.',
} as const;

const SIGN_WIDTH = 3.6;
const SIGN_HEIGHT = 0.6;
const ROOF_OVERHANG = 0.3;
const ROOF_THICKNESS = 0.2;

/** Outward yaw per side: local +Z of the rig points away from the building. */
const SIDE_YAW: Record<WallSide, number> = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
/** World direction of the rig's local +X along the wall: +1 = increasing coordinate. */
const SIDE_ALONG_SIGN: Record<WallSide, 1 | -1> = { south: 1, north: -1, east: -1, west: 1 };

function boxMesh(box: Box, material: Material | Material[], cx: number, cz: number, name: string): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ),
    material,
  );
  mesh.position.set((box.minX + box.maxX) / 2 - cx, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2 - cz);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** BoxGeometry face order: +x, -x, +y, -y, +z, -z. Outer = brick, inner = plaster, top = cap. */
function wallFaceMaterials(side: WallSide, m: Materials): Material[] {
  const faces: Material[] = [m.brick, m.brick, m.brickCap, m.brick, m.brick, m.brick];
  const outer = { east: 0, west: 1, north: 5, south: 4 }[side];
  const inner = { east: 1, west: 0, north: 4, south: 5 }[side];
  faces[outer] = m.brick;
  faces[inner] = m.plaster;
  return faces;
}

/** Rig at an opening: positioned on the wall centre line, local +Z = outward. */
function openingRig(kiosk: KioskDef, o: WallOpening, alongWorld: number, cx: number, cz: number): Group {
  const r = wallRect(kiosk, o.side);
  const rig = new Group();
  if (o.side === 'north' || o.side === 'south') {
    rig.position.set(alongWorld - cx, 0, (r.minZ + r.maxZ) / 2 - cz);
  } else {
    rig.position.set((r.minX + r.maxX) / 2 - cx, 0, alongWorld - cz);
  }
  rig.rotation.y = SIDE_YAW[o.side];
  return rig;
}

function buildDoor(kiosk: KioskDef, o: WallOpening, m: Materials, cx: number, cz: number): Group {
  const sign = SIDE_ALONG_SIGN[o.side];
  const hinge = sign > 0 ? o.to : o.from;
  const rig = openingRig(kiosk, o, hinge, cx, cz);
  const leafW = o.to - o.from - 0.02;
  const leafH = o.head - o.sill - 0.02;
  const pivot = new Group();
  pivot.name = KIOSK_NAMES.door;
  const leaf = new Mesh(new BoxGeometry(leafW, leafH, 0.05), m.door);
  leaf.position.set(-leafW / 2 - 0.01, o.sill + leafH / 2 + 0.01, 0);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  const handle = new Mesh(new BoxGeometry(0.05, 0.22, 0.12), m.doorHandle);
  handle.position.set(-leafW + 0.1, o.sill + 1.0, 0);
  handle.castShadow = true;
  pivot.add(leaf, handle);
  rig.add(pivot);
  return rig;
}

function buildShutter(kiosk: KioskDef, o: WallOpening, m: Materials, cx: number, cz: number): Group {
  const centre = (o.from + o.to) / 2;
  const rig = openingRig(kiosk, o, centre, cx, cz);
  const t = kiosk.wallThickness;
  const w = o.to - o.from + 0.2;
  const h = o.head - o.sill + 0.1;
  // Hinge at the top edge on the outer wall face; the flap hangs down in front of the opening.
  const hinge = new Group();
  hinge.position.set(0, o.head + 0.05, t / 2 + 0.035);
  const flap = new Group();
  flap.name = KIOSK_NAMES.shutter;
  const panel = new Mesh(new BoxGeometry(w, h, 0.05), m.shutter);
  panel.position.set(0, -h / 2, 0);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.name = `${KIOSK_NAMES.shutter}.panel`;
  flap.add(panel);
  hinge.add(flap);
  rig.add(hinge);
  return rig;
}

/**
 * K-001 kiosk greybox. Pivot = footprint centre on the ground, units in metres.
 * Walls come from `buildWallPieces` (shared with the colliders), the openings are real gaps.
 */
export function createKioskK001(kiosk: KioskDef, m: Materials): Object3D {
  const fp = kiosk.footprint;
  const cx = (fp.minX + fp.maxX) / 2;
  const cz = (fp.minZ + fp.maxZ) / 2;
  const root = new Group();
  root.name = 'K-001';
  root.position.set(cx, 0, cz);

  const counters: Record<string, number> = {};
  for (const piece of buildWallPieces(kiosk)) {
    const key = `${piece.side}.${piece.kind}`;
    const index = (counters[key] = (counters[key] ?? -1) + 1);
    root.add(boxMesh(piece.box, wallFaceMaterials(piece.side, m), cx, cz, `${KIOSK_NAMES.wallPrefix}${key}.${index}`));
  }

  const t = kiosk.wallThickness;
  // Interior floor slightly above the yard plane.
  const floor = new Mesh(new BoxGeometry(fp.maxX - fp.minX - 2 * t, 0.03, fp.maxZ - fp.minZ - 2 * t), m.floor);
  floor.position.set(0, 0.015, 0);
  floor.receiveShadow = true;
  floor.name = 'kiosk.floor';
  root.add(floor);

  // Flat roof with overhang.
  const roof = new Mesh(
    new BoxGeometry(fp.maxX - fp.minX + 2 * ROOF_OVERHANG, ROOF_THICKNESS, fp.maxZ - fp.minZ + 2 * ROOF_OVERHANG),
    m.roof,
  );
  roof.position.set(0, kiosk.height + ROOF_THICKNESS / 2, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  roof.name = KIOSK_NAMES.roof;
  root.add(roof);

  // Sign board above the sales window (south wall), text from the layout.
  const salesWindow = kiosk.openings.find((o) => o.kind === 'window' && o.side === 'south');
  const signCentre = salesWindow ? (salesWindow.from + salesWindow.to) / 2 : cx;
  const signY = kiosk.height - SIGN_HEIGHT / 2 - 0.1;
  const signTexture = createSignTexture(kiosk.signText, SIGN_WIDTH, SIGN_HEIGHT);
  m.textures.push(signTexture);
  const faceMaterial = m.signBoard.clone();
  faceMaterial.map = signTexture;
  faceMaterial.color.set(0xffffff);
  // +z face (index 4) carries the text; it is not mirrored when seen from the south.
  const sign = new Mesh(new BoxGeometry(SIGN_WIDTH, SIGN_HEIGHT, 0.08), [
    m.signBoard,
    m.signBoard,
    m.signBoard,
    m.signBoard,
    faceMaterial,
    m.signBoard,
  ]);
  sign.position.set(signCentre - cx, signY, fp.maxZ - cz + 0.04);
  sign.castShadow = true;
  sign.name = KIOSK_NAMES.sign;
  root.add(sign);

  for (const o of kiosk.openings) {
    if (o.kind === 'door') root.add(buildDoor(kiosk, o, m, cx, cz));
    else root.add(buildShutter(kiosk, o, m, cx, cz));
  }
  return root;
}
