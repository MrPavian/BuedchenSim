import type { ContentPack, Vec2 } from './types';

/**
 * Plain JSON data only. Sections for economy/people/story/calendar are deliberately
 * absent; they arrive via save migrations in later phases.
 */
export interface GameState {
  regionId: string;
  /** heading in radians, 0 = facing +Z, positive toward +X (atan2(dx, dz)). */
  player: { position: Vec2; heading: number };
  kiosk: { doorOpen: boolean; shutterOpen: boolean };
}

export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export function createInitialState(content: ContentPack): GameState {
  const { spawn } = content.layout;
  return {
    regionId: content.regionId,
    player: { position: { x: spawn.position.x, z: spawn.position.z }, heading: spawn.heading },
    kiosk: { doorOpen: false, shutterOpen: false },
  };
}
