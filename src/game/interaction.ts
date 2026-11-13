import { NPC_TALK_MAX_ANGLE, NPC_TALK_RADIUS } from './balance';
import type { InteractionKind, InteractionPointDef, Vec2 } from './types';

export type InteractionAction =
  | 'door.open'
  | 'door.close'
  | 'shutter.open'
  | 'shutter.close'
  | 'register.use'
  | 'storage.use';

export interface AvailableInteraction {
  pointId: string;
  kind: InteractionKind;
  action: InteractionAction;
}

/** A resident the player can talk to (kind 'npc'). `pointId` is the npc id, so views can treat both targets alike. */
export interface NpcInteraction {
  pointId: string;
  kind: 'npc';
  action: 'npc.talk';
  npcId: string;
}

/** What `interact()` would act on: a resident (wins) or a kiosk point. */
export type InteractionTarget = AvailableInteraction | NpcInteraction;

export interface KioskOpenState {
  doorOpen: boolean;
  shutterOpen: boolean;
}

/** Nearest point whose radius contains the position (inclusive). Ties: first in list order. */
export function findNearestInteractionPoint(
  points: readonly InteractionPointDef[],
  position: Vec2,
): InteractionPointDef | null {
  let best: InteractionPointDef | null = null;
  let bestDist = Infinity;
  for (const point of points) {
    const dist = Math.hypot(point.position.x - position.x, point.position.z - position.z);
    if (dist <= point.radius && dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }
  return best;
}

export function actionFor(kind: InteractionKind, kiosk: KioskOpenState): InteractionAction {
  if (kind === 'door') return kiosk.doorOpen ? 'door.close' : 'door.open';
  if (kind === 'shutter') return kiosk.shutterOpen ? 'shutter.close' : 'shutter.open';
  return kind === 'register' ? 'register.use' : 'storage.use';
}

export function findAvailableInteraction(
  points: readonly InteractionPointDef[],
  position: Vec2,
  kiosk: KioskOpenState,
): AvailableInteraction | null {
  const point = findNearestInteractionPoint(points, position);
  if (!point) return null;
  return { pointId: point.id, kind: point.kind, action: actionFor(point.kind, kiosk) };
}

/** What the resident lookup needs of a resident's state. */
export interface TalkCandidate {
  status: string;
  position: Vec2;
}

/** Smallest absolute difference between two angles, in 0..PI. */
export function angleBetween(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  const d = (((a - b) % twoPi) + twoPi) % twoPi;
  return d > Math.PI ? twoPi - d : d;
}

/**
 * Nearest visible (status not 'away') resident within NPC_TALK_RADIUS that the player roughly faces (angle between the
 * player's heading and the direction to the resident <= NPC_TALK_MAX_ANGLE; a resident practically on the player counts
 * as faced). `ids` gives the order for ties. Pure and allocation-free apart from the result.
 */
export function findNpcInteraction(
  ids: readonly string[],
  npcs: Readonly<Record<string, TalkCandidate>>,
  player: { position: Vec2; heading: number },
): NpcInteraction | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const id of ids) {
    const c = npcs[id];
    if (!c || c.status === 'away') continue;
    const dx = c.position.x - player.position.x;
    const dz = c.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > NPC_TALK_RADIUS || dist >= bestDist) continue;
    if (dist > 0.05 && angleBetween(Math.atan2(dx, dz), player.heading) > NPC_TALK_MAX_ANGLE) continue;
    best = id;
    bestDist = dist;
  }
  return best === null ? null : { pointId: best, kind: 'npc', action: 'npc.talk', npcId: best };
}
