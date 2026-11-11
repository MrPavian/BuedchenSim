import type { InteractionKind, InteractionPointDef, Vec2 } from './types';

export type InteractionAction = 'door.open' | 'door.close' | 'shutter.open' | 'shutter.close';

export interface AvailableInteraction {
  pointId: string;
  kind: InteractionKind;
  action: InteractionAction;
}

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
  return kiosk.shutterOpen ? 'shutter.close' : 'shutter.open';
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
