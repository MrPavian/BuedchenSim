import { Vector3, type Camera, type Object3D } from 'three';
import type { KioskDef, Vec2, WallSide } from '../game/types';
import type { KioskParts } from './assets/kiosk';
import { decideCut } from './occlusionRules';

/**
 * Dollhouse cutaway (see occlusionRules.ts for the rule). Each cut group lowers onto its cut plane with a
 * short scale transition and is then hidden (`visible = false`); nothing is ever left translucent.
 */

const TRANSITION_SECONDS = 0.2;

interface Entry {
  object: Object3D;
  /** 0 = fully shown, 1 = fully cut. */
  amount: number;
  target: number;
}

export interface OcclusionOptions {
  parts: KioskParts;
  kiosk: KioskDef;
}

export interface Occlusion {
  update(dt: number, camera: Camera, player: Vec2, snap?: boolean): void;
  /** Shows everything at once. */
  reset(): void;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function createOcclusion({ parts, kiosk }: OcclusionOptions): Occlusion {
  const roof: Entry = { object: parts.roof, amount: 0, target: 0 };
  const walls: Record<WallSide, Entry[]> = { south: [], north: [], east: [], west: [] };
  for (const side of ['south', 'east', 'west'] as const) {
    walls[side] = parts.cut[side].map((object) => ({ object, amount: 0, target: 0 }));
  }
  const all = [roof, ...walls.south, ...walls.east, ...walls.west];
  const cameraPosition = new Vector3();

  const apply = (entry: Entry): void => {
    const shown = 1 - smooth(entry.amount);
    entry.object.scale.y = Math.max(shown, 0.001);
    entry.object.visible = entry.amount < 0.999;
  };
  for (const entry of all) apply(entry);

  return {
    update(dt, camera, player, snap = false) {
      camera.getWorldPosition(cameraPosition);
      const decision = decideCut(kiosk, parts.cutHeight, player, cameraPosition);
      roof.target = decision.roof ? 1 : 0;
      for (const side of ['south', 'east', 'west'] as const) {
        for (const entry of walls[side]) entry.target = decision.walls[side] ? 1 : 0;
      }
      const step = dt / TRANSITION_SECONDS;
      for (const entry of all) {
        if (snap) entry.amount = entry.target;
        else if (entry.amount < entry.target) entry.amount = Math.min(entry.target, entry.amount + step);
        else if (entry.amount > entry.target) entry.amount = Math.max(entry.target, entry.amount - step);
        apply(entry);
      }
    },
    reset() {
      for (const entry of all) {
        entry.amount = 0;
        entry.target = 0;
        apply(entry);
      }
    },
  };
}
