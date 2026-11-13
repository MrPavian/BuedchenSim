import type { DomainContext } from './domain';
import type { TalkResult } from './dialogue';
import { findNpcState } from './npcSelectors';
import type { RoutineActivity } from './npcTypes';
import { relationshipTier, type RelationshipTier } from './relationship';
import type { NpcStatus } from './state';
import type { Vec2 } from './types';

/** Read-only view of one resident (a copy; world code that needs positions every frame reads `game.state.npcs`). */
export interface NpcView {
  id: string;
  status: NpcStatus;
  position: Vec2;
  heading: number;
  placeId: string | null;
  /** In the world, i.e. not away. */
  visible: boolean;
  /** Has an unresolved wish and waits for service. */
  hasWish: boolean;
  /** Activity of the routine entry that drives the resident (for idle animation); null when heading home or away. */
  activity: RoutineActivity | null;
  relationship: number;
  tier: RelationshipTier;
}

export interface NpcApi {
  /** All residents of the content in content order. */
  list(): NpcView[];
  get(npcId: string): NpcView | null;
  /**
   * Opens a conversation (same as `interact()` on a resident; the distance and facing rule lives in the interaction lookup,
   * not here). A waiting customer with an unresolved wish gets the built-in customer conversation, otherwise the
   * highest-priority dialogue whose conditions hold. Rejections: 'unknown_npc', 'npc_away', 'dialogue_already_open',
   * 'nothing_to_say'.
   */
  talk(npcId: string): TalkResult;
}

export function createNpcApi(ctx: DomainContext, talk: (npcId: string) => TalkResult): NpcApi {
  const view = (id: string): NpcView | null => {
    const def = Object.hasOwn(ctx.content.npcs, id) ? ctx.content.npcs[id] : undefined;
    const npc = findNpcState(ctx.state(), id);
    if (!def || !npc) return null;
    const entry = npc.routineId === null ? undefined : def.routine.find((r) => r.id === npc.routineId);
    return {
      id,
      status: npc.status,
      position: { x: npc.position.x, z: npc.position.z },
      heading: npc.heading,
      placeId: npc.placeId,
      visible: npc.status !== 'away',
      hasWish: npc.wish !== null && npc.wish.resolved === null,
      activity: entry?.activity ?? null,
      relationship: npc.relationship,
      tier: relationshipTier(npc.relationship),
    };
  };
  return {
    list() {
      const out: NpcView[] = [];
      for (const id of Object.keys(ctx.content.npcs)) {
        const v = view(id);
        if (v) out.push(v);
      }
      return out;
    },
    get: view,
    talk,
  };
}
