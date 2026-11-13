import type { DeepReadonly, GameState, NpcState } from './state';

/** Safe lookup (prototype-free) of a resident's saved state. */
export function findNpcState(state: GameState, npcId: string): NpcState | undefined;
export function findNpcState(state: DeepReadonly<GameState>, npcId: string): DeepReadonly<NpcState> | undefined;
export function findNpcState(state: DeepReadonly<GameState>, npcId: string): DeepReadonly<NpcState> | undefined {
  return Object.hasOwn(state.npcs, npcId) ? state.npcs[npcId] : undefined;
}
