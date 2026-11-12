import { createSignals, type Signals } from '../core/signals';
import { createCalendarApi, tickClock, type CalendarApi } from './clock';
import type { DomainContext } from './domain';
import { createEconomyApi, type CloseDayResult, type EconomyApi, type SaleRequest, type SaleResult } from './economy';
import type { GameEvents } from './events';
import {
  findAvailableInteraction,
  type AvailableInteraction,
  type InteractionAction,
} from './interaction';
import type { ActionResult } from './result';
import { CURRENT_SCHEMA_VERSION, type SaveFile } from './save/save';
import { createInitialState, type DeepReadonly, type GameState } from './state';
import type { ContentPack, Vec2 } from './types';

export type { ActionResult, AvailableInteraction, CalendarApi, CloseDayResult, EconomyApi, GameEvents, InteractionAction, SaleRequest, SaleResult };

export interface Game {
  readonly state: DeepReadonly<GameState>;
  readonly content: ContentPack;
  readonly signals: Pick<Signals<GameEvents>, 'on'>;
  readonly player: { setPose(position: Vec2, heading: number): ActionResult };
  /** Pause, speed and day start. */
  readonly calendar: CalendarApi;
  /** Orders, storage, shelves, sales and the day close. */
  readonly economy: EconomyApi;
  /**
   * Advances the day clock by real seconds (called from the fixed-step update of the loop). Ignores
   * invalid dt, does nothing while paused or outside phase 'open'.
   */
  tick(dtSeconds: number): void;
  /** Nearest point within its radius of the player; transient, NOT part of GameState. */
  getAvailableInteraction(): AvailableInteraction | null;
  /**
   * Door/shutter: toggles the opening. Register/storage: changes nothing and emits `interaction.triggered`.
   * `{ ok: false, reason: 'nothing_in_range' }` when no point is in range.
   */
  interact(): ActionResult;
  /** Deep-copy snapshot. */
  save(): SaveFile;
  /** Back to the initial state; emits `game.state.replaced`. */
  reset(): void;
  /**
   * Replaces the whole state (e.g. after loading a save); emits `game.state.replaced`.
   * The state must already be validated (see `parseSave`); region mismatch is rejected.
   */
  load(state: GameState): ActionResult;
}

function sameInteraction(a: AvailableInteraction | null, b: AvailableInteraction | null): boolean {
  if (a === null || b === null) return a === b;
  return a.pointId === b.pointId && a.action === b.action;
}

export function createGame(content: ContentPack, initialState?: GameState): Game {
  const signals = createSignals<GameEvents>();
  let state: GameState = initialState ? structuredClone(initialState) : createInitialState(content);
  const bounds = content.layout.walkBounds;

  const computeInteraction = (): AvailableInteraction | null =>
    findAvailableInteraction(content.layout.interactionPoints, state.player.position, state.kiosk);

  let current: AvailableInteraction | null = computeInteraction();

  /** Recomputes the cached interaction and emits only when pointId or action changed. */
  const refreshInteraction = (): void => {
    const next = computeInteraction();
    if (sameInteraction(current, next)) return;
    current = next;
    signals.emit('interaction.available.changed', { interaction: next ? { ...next } : null });
  };

  const ctx: DomainContext = { state: () => state, content, emit: signals.emit };
  const calendar = createCalendarApi(ctx);
  const economy = createEconomyApi(ctx);

  const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

  return {
    get state() {
      return state;
    },
    content,
    signals: { on: signals.on },
    player: {
      setPose(position, heading) {
        if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(heading)) {
          return { ok: false, reason: 'invalid_pose' };
        }
        state.player.position = {
          x: clamp(position.x, bounds.minX, bounds.maxX),
          z: clamp(position.z, bounds.minZ, bounds.maxZ),
        };
        state.player.heading = heading;
        refreshInteraction();
        return { ok: true };
      },
    },
    calendar,
    economy,
    tick(dtSeconds) {
      tickClock(ctx, dtSeconds);
    },
    getAvailableInteraction() {
      return current ? { ...current } : null;
    },
    interact() {
      const available = computeInteraction();
      if (!available) return { ok: false, reason: 'nothing_in_range' };
      if (available.kind === 'register' || available.kind === 'storage') {
        signals.emit('interaction.triggered', { pointId: available.pointId, kind: available.kind });
        return { ok: true };
      }
      if (available.kind === 'door') {
        state.kiosk.doorOpen = !state.kiosk.doorOpen;
        signals.emit('kiosk.door.changed', { open: state.kiosk.doorOpen });
      } else {
        state.kiosk.shutterOpen = !state.kiosk.shutterOpen;
        signals.emit('kiosk.shutter.changed', { open: state.kiosk.shutterOpen });
      }
      refreshInteraction();
      return { ok: true };
    },
    save() {
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        state: structuredClone(state),
      };
    },
    reset() {
      state = createInitialState(content);
      current = computeInteraction();
      signals.emit('game.state.replaced', {});
    },
    load(next) {
      if (next.regionId !== content.regionId) return { ok: false, reason: 'region_mismatch' };
      state = structuredClone(next);
      current = computeInteraction();
      signals.emit('game.state.replaced', {});
      return { ok: true };
    },
  };
}
