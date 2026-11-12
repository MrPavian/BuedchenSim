import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  GreaterDepth,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Materials } from './materials';

export interface PlayerFigure {
  /** Pivot at the feet; faces +Z at rotation 0. Contains the solid figure and its x-ray silhouette. */
  root: Group;
  /** Advances the walk cycle; `speed` in m/s. */
  animate(dt: number, speed: number): void;
}

/** Draw order: environment (0) < x-ray silhouette (1) < solid figure (2). */
export const SILHOUETTE_RENDER_ORDER = 1;
export const FIGURE_RENDER_ORDER = 2;
export const SILHOUETTE_COLOUR = 0x8fe7ff;

type Part = 'jacket' | 'pants' | 'skin' | 'cap' | 'shoe';

interface Rig {
  body: Group;
  legL: Group;
  legR: Group;
  armL: Group;
  armR: Group;
}

interface Geometries {
  torso: CapsuleGeometry;
  head: SphereGeometry;
  capDome: SphereGeometry;
  brim: BoxGeometry;
  nose: SphereGeometry;
  leg: CylinderGeometry;
  arm: CylinderGeometry;
  shoe: BoxGeometry;
}

function createGeometries(): Geometries {
  return {
    torso: new CapsuleGeometry(0.25, 0.3, 4, 12),
    head: new SphereGeometry(0.2, 16, 12),
    capDome: new SphereGeometry(0.215, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    brim: new BoxGeometry(0.26, 0.03, 0.24),
    nose: new SphereGeometry(0.045, 8, 8),
    leg: new CylinderGeometry(0.09, 0.08, 0.8, 8),
    arm: new CylinderGeometry(0.065, 0.06, 0.62, 8),
    shoe: new BoxGeometry(0.15, 0.08, 0.26),
  };
}

/** Builds one copy of the figure; the solid figure and the silhouette share geometry but not materials. */
function buildRig(g: Geometries, material: (part: Part) => Material, renderOrder: number, castShadow: boolean): Rig {
  const body = new Group();
  const mesh = (geometry: BufferGeometry, part: Part): Mesh => {
    const m = new Mesh(geometry, material(part));
    m.castShadow = castShadow;
    m.renderOrder = renderOrder;
    return m;
  };

  const torso = mesh(g.torso, 'jacket');
  torso.position.y = 1.1;
  const head = mesh(g.head, 'skin');
  head.position.y = 1.56;
  const capDome = mesh(g.capDome, 'cap');
  capDome.position.y = 1.58;
  const brim = mesh(g.brim, 'cap');
  brim.position.set(0, 1.6, 0.24);
  const nose = mesh(g.nose, 'skin');
  nose.position.set(0, 1.53, 0.2);
  body.add(torso, head, capDome, brim, nose);

  const limb = (geometry: CylinderGeometry, part: Part, x: number, y: number): Group => {
    const pivot = new Group();
    pivot.position.set(x, y, 0);
    const m = mesh(geometry, part);
    m.position.y = -geometry.parameters.height / 2;
    pivot.add(m);
    return pivot;
  };
  const legL = limb(g.leg, 'pants', -0.12, 0.8);
  const legR = limb(g.leg, 'pants', 0.12, 0.8);
  const armL = limb(g.arm, 'jacket', -0.32, 1.38);
  const armR = limb(g.arm, 'jacket', 0.32, 1.38);
  body.add(legL, legR, armL, armR);
  for (const x of [-0.12, 0.12]) {
    const shoe = mesh(g.shoe, 'shoe');
    shoe.position.set(x, 0.04, 0.04);
    body.add(shoe);
  }
  return { body, legL, legR, armL, armR };
}

/**
 * Stylised ~1.75 m figure: blue jacket, orange cap with a clear brim and nose pointing forward (+Z).
 * A second copy (the silhouette) is drawn flat with `GreaterDepth` after the environment and before the
 * solid figure: it only appears where something is in front of the figure (walls, roof, furniture) and
 * is overdrawn by the solid figure everywhere the figure itself is visible.
 */
export function createPlayerFigure(m: Materials): PlayerFigure {
  const root = new Group();
  root.name = 'player';
  const geometries = createGeometries();

  const solidMaterials: Record<Part, Material> = {
    jacket: m.playerJacket,
    pants: m.playerPants,
    skin: m.playerSkin,
    cap: m.playerCap,
    shoe: m.playerShoe,
  };
  const solid = buildRig(geometries, (part) => solidMaterials[part], FIGURE_RENDER_ORDER, true);
  solid.body.name = 'player.solid';

  const silhouetteMaterial = new MeshBasicMaterial({
    color: SILHOUETTE_COLOUR,
    depthFunc: GreaterDepth,
    depthWrite: false,
    fog: false,
  });
  const silhouette = buildRig(geometries, () => silhouetteMaterial, SILHOUETTE_RENDER_ORDER, false);
  silhouette.body.name = 'player.silhouette';
  root.add(silhouette.body, solid.body);

  const rigs = [solid, silhouette];
  let phase = 0;
  return {
    root,
    animate(dt, speed) {
      const moving = speed > 0.1;
      if (moving) phase += dt * 9;
      const swing = moving ? Math.sin(phase) * 0.55 : 0;
      for (const rig of rigs) {
        rig.legL.rotation.x = swing;
        rig.legR.rotation.x = -swing;
        rig.armL.rotation.x = -swing;
        rig.armR.rotation.x = swing;
        rig.body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.03 : 0;
      }
    },
  };
}
