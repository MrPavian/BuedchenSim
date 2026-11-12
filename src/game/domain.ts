import type { Signals } from '../core/signals';
import type { GameEvents } from './events';
import type { GameState } from './state';
import type { ContentPack } from './types';

/** What domain functions need from the game: the (replaceable) current state, the content and signal emission. */
export interface DomainContext {
  state(): GameState;
  readonly content: ContentPack;
  readonly emit: Signals<GameEvents>['emit'];
}
