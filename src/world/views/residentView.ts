import { Group } from 'three';
import { NPC_RADIUS } from '../../game/balance';
import type { Game } from '../../game/game';
import { createResident, type ResidentAnimation, type ResidentFigure } from '../assets/residents';
import { RESIDENT_MODELS, createGlbResident, loadResidentModel } from '../assets/residents/glbResident';
import { log } from '../../core/log';
import type { Circle } from '../collision';
import type { Materials } from '../materials';

/** Where the residents' feet stand (same ground offset as the player figure). */
const FOOT_Y = 0.02;
/** Larger one-step jumps (appearing, teleporting) are never interpolated. */
const SNAP_DISTANCE = 2.5;
/** Rates (1/s) of the exponential smoothing of the turning and of the speed fed to the animation. */
const TURN_RATE = 9;
const SPEED_RATE = 10;
const MOVING_SPEED = 0.2;

export interface ResidentInfo {
  npcId: string;
  visible: boolean;
  position: { x: number; z: number };
  /** Displayed heading in radians (0 = +Z). */
  heading: number;
  animation: ResidentAnimation;
  /** Head position projected to CSS pixels relative to the canvas; null while hidden or off screen. */
  screen: { x: number; y: number } | null;
}

export type ScreenProjector = (world: { x: number; y: number; z: number }) => { x: number; y: number; visible: boolean };

export interface ResidentView {
  root: Group;
  /** Fixed simulation step: reads the residents' poses from the game state (call after `game.tick`). */
  step(dt: number): void;
  /** Per frame: interpolates between the last two steps by `alpha` and advances the animations. */
  update(dt: number, alpha: number): void;
  /** Current collision circles of all visible residents (the same objects every call; the array is reused). */
  circles(): readonly Circle[];
  getInfo(project: ScreenProjector): ResidentInfo[];
  dispose(): void;
}

interface Entry {
  id: string;
  figure: ResidentFigure;
  circle: Circle;
  visible: boolean;
  talking: boolean;
  /** Last two fixed-step positions and the heading target of the latest step. */
  px: number;
  pz: number;
  cx: number;
  cz: number;
  heading: number;
  visualHeading: number;
  /** Smoothed speed in m/s. */
  speed: number;
  /** Needs the next frame to jump to the target instead of interpolating. */
  snap: boolean;
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Draws the residents of the content pack. Poses come straight from `game.state.npcs` (read every fixed step, no
 * copies); figures are built once. Hidden (away) residents are not drawn and do not collide.
 */
export function createResidentView(game: Game, materials: Materials): ResidentView {
  const root = new Group();
  root.name = 'residents';
  const entries: Entry[] = [];
  const active: Circle[] = [];

  for (const [id, def] of Object.entries(game.content.npcs)) {
    const figure = createResident(def.assetId, materials);
    figure.root.name = `resident.${id}`;
    figure.root.visible = false;
    root.add(figure.root);
    entries.push({
      id,
      figure,
      circle: { x: 0, z: 0, r: NPC_RADIUS },
      visible: false,
      talking: false,
      px: 0,
      pz: 0,
      cx: 0,
      cz: 0,
      heading: 0,
      visualHeading: 0,
      speed: 0,
      snap: true,
    });
  }

  // Residents with a GLB model (Auftrag 04.5 prototype) swap their procedural figure once the file is loaded; in Node
  // (tests) and when loading fails the procedural figure stays.
  let disposed = false;
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    for (const e of entries) {
      const def = game.content.npcs[e.id];
      const model = def ? RESIDENT_MODELS[def.assetId] : undefined;
      if (!def || !model) continue;
      loadResidentModel(`${import.meta.env.BASE_URL}${model.url}`)
        .then((gltf) => {
          if (disposed) return;
          const next = createGlbResident(def.assetId, gltf, model.walkSpeed);
          const old = e.figure.root;
          next.root.name = old.name;
          next.root.visible = old.visible;
          next.root.position.copy(old.position);
          next.root.rotation.copy(old.rotation);
          root.remove(old);
          root.add(next.root);
          e.figure = next;
        })
        .catch((error: unknown) => log.warn(`resident model ${model.url} not loaded, keeping the procedural figure`, error));
    }
  }

  let snapAll = true;
  const offReplaced = game.signals.on('game.state.replaced', () => {
    snapAll = true;
  });

  return {
    root,

    step(dt) {
      const npcs = game.state.npcs;
      active.length = 0;
      for (const e of entries) {
        const npc = Object.hasOwn(npcs, e.id) ? npcs[e.id] : undefined;
        if (!npc || npc.status === 'away') {
          e.visible = false;
          e.speed = 0;
          continue;
        }
        const appeared = !e.visible || snapAll || e.snap;
        const jump = Math.hypot(npc.position.x - e.cx, npc.position.z - e.cz) > SNAP_DISTANCE;
        if (appeared || jump) {
          e.px = npc.position.x;
          e.pz = npc.position.z;
          e.cx = e.px;
          e.cz = e.pz;
          e.speed = 0;
          e.snap = true;
        } else {
          e.px = e.cx;
          e.pz = e.cz;
          e.cx = npc.position.x;
          e.cz = npc.position.z;
          const instant = dt > 0 ? Math.hypot(e.cx - e.px, e.cz - e.pz) / dt : 0;
          e.speed += (instant - e.speed) * (1 - Math.exp(-dt * SPEED_RATE));
        }
        e.visible = true;
        e.talking = npc.status === 'talking';
        e.heading = npc.heading;
        e.circle.x = e.cx;
        e.circle.z = e.cz;
        active.push(e.circle);
      }
      snapAll = false;
    },

    update(dt, alpha) {
      const player = game.state.player.position;
      for (const e of entries) {
        const root3 = e.figure.root;
        if (!e.visible) {
          root3.visible = false;
          continue;
        }
        root3.visible = true;
        const x = e.px + (e.cx - e.px) * alpha;
        const z = e.pz + (e.cz - e.pz) * alpha;
        root3.position.set(x, FOOT_Y, z);

        let target = e.heading;
        if (e.talking && Math.hypot(player.x - x, player.z - z) > 0.05) {
          target = Math.atan2(player.x - x, player.z - z);
        } else if (e.speed > MOVING_SPEED) {
          const dx = e.cx - e.px;
          const dz = e.cz - e.pz;
          if (dx !== 0 || dz !== 0) target = Math.atan2(dx, dz);
        }
        if (e.snap) {
          e.visualHeading = target;
          e.snap = false;
        } else {
          e.visualHeading += wrapAngle(target - e.visualHeading) * (1 - Math.exp(-dt * TURN_RATE));
        }
        root3.rotation.y = e.visualHeading;
        e.figure.update(dt, e.speed, e.talking);
      }
    },

    circles: () => active,

    getInfo(project) {
      return entries.map((e) => {
        const head = { x: e.figure.root.position.x, y: e.figure.headHeight, z: e.figure.root.position.z };
        const p = e.visible ? project(head) : null;
        return {
          npcId: e.id,
          visible: e.visible,
          position: { x: e.figure.root.position.x, z: e.figure.root.position.z },
          heading: e.visualHeading,
          animation: e.figure.animation(),
          screen: p && p.visible ? { x: p.x, y: p.y } : null,
        };
      });
    },

    dispose() {
      disposed = true;
      offReplaced();
    },
  };
}
