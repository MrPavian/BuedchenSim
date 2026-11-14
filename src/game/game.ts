import { createSignals, type Signals } from '../core/signals';
import { createCalendarApi, tickClock, type CalendarApi } from './clock';
import type { DomainContext } from './domain';
import { climateOf, environmentOf, type Environment } from './environment';
import { forecast, weatherOfDay, type DayWeather, type ForecastDay } from './weather';
import { createEconomyApi, type CloseDayResult, type EconomyApi, type SaleRequest, type SaleResult } from './economy';
import type { GameEvents } from './events';
import { createDialogueEngine, type DialogueApi } from './dialogue';
import {
  findAvailableInteraction,
  findNpcInteraction,
  type AvailableInteraction,
  type InteractionAction,
  type InteractionTarget,
} from './interaction';
import { createNpcApi, type NpcApi } from './npcs';
import { createNpcSim } from './npcSim';
import type { ActionResult } from './result';
import { CURRENT_SCHEMA_VERSION, type SaveFile } from './save/save';
import { createInitialState, type DeepReadonly, type GameState } from './state';
import type { ContentPack, Vec2 } from './types';

export type {
  ActionResult,
  AvailableInteraction,
  CalendarApi,
  CloseDayResult,
  DialogueApi,
  EconomyApi,
  GameEvents,
  InteractionAction,
  InteractionTarget,
  NpcApi,
  SaleRequest,
  SaleResult,
};

export interface WeatherApi {
  /** Season, today's weather and the current temperature. */
  environment(): Environment;
  /** Today and the next six days (three exact, four as a tendency). */
  forecast(): ForecastDay[];
  /** The weather of any game day (for tools and tests; the player sees only the forecast). */
  onDay(day: number): DayWeather;
}

export interface Game {
  readonly state: DeepReadonly<GameState>;
  readonly content: ContentPack;
  readonly signals: Pick<Signals<GameEvents>, 'on'>;
  readonly player: { setPose(position: Vec2, heading: number): ActionResult };
  /** Pause, speed and day start. */
  readonly calendar: CalendarApi;
  /** Orders, storage, shelves, sales and the day close. */
  readonly economy: EconomyApi;
  /** Residents: views and conversations. */
  readonly npcs: NpcApi;
  /** The open conversation (at most one): current node, choosing options, closing. */
  readonly dialogue: DialogueApi;
  /** Derived weather (never saved; pure functions of seed and day): today, the 7-day forecast, any day. */
  readonly weather: WeatherApi;
  /**
   * Advances the day clock by real seconds (called from the fixed-step update of the loop) and the residents with it.
   * Ignores invalid dt; clock and residents stand still while paused; the clock also stands still outside phase 'open'.
   */
  tick(dtSeconds: number): void;
  /**
   * The kiosk-point interaction in range (nearest point within its radius of the player; transient, NOT part of
   * GameState). Null while a resident is targeted: a resident in range wins over kiosk points.
   */
  getAvailableInteraction(): AvailableInteraction | null;
  /**
   * What `interact()` would act on: the nearest visible resident within NPC_TALK_RADIUS that the player faces
   * (kind 'npc', action 'npc.talk'; wins over kiosk points), else the kiosk point in range.
   */
  getInteractionTarget(): InteractionTarget | null;
  /**
   * Resident in range: opens the conversation (like `npcs.talk`; rejection reasons of `talk`, e.g. 'dialogue_already_open').
   * Door/shutter: toggles the opening. Register/storage: changes nothing and emits `interaction.triggered`.
   * `{ ok: false, reason: 'nothing_in_range' }` when nothing is in range.
   */
  interact(): ActionResult;
  /** Deep-copy snapshot. */
  save(): SaveFile;
  /** Back to the initial state (new game, keeps the seed given to `createGame`); emits `game.state.replaced`. */
  reset(): void;
  /**
   * Replaces the whole state (e.g. after loading a save); emits `game.state.replaced`.
   * The state must already be validated (see `parseSave`); region mismatch is rejected.
   */
  load(state: GameState): ActionResult;
}

function sameInteraction(a: InteractionTarget | null, b: InteractionTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.pointId === b.pointId && a.action === b.action;
}

/**
 * `seed` (a number, or a function called for every new game incl. `reset()`) seeds the deterministic rolls of a new game;
 * without it tests get DEFAULT_WORLD_SEED. It is ignored when `initialState` is given (the saved seed is used).
 */
export function createGame(content: ContentPack, initialState?: GameState, seed?: number | (() => number)): Game {
  const signals = createSignals<GameEvents>();
  const newSeed = (): number | undefined => (typeof seed === 'function' ? seed() : seed);
  let state: GameState = initialState ? structuredClone(initialState) : createInitialState(content, newSeed());
  const bounds = content.layout.walkBounds;
  const npcIds = Object.keys(content.npcs);

  const kioskInteraction = (): AvailableInteraction | null =>
    findAvailableInteraction(content.layout.interactionPoints, state.player.position, state.kiosk);

  /** A resident in range wins over kiosk points. */
  const computeTarget = (): InteractionTarget | null =>
    (npcIds.length > 0 ? findNpcInteraction(npcIds, state.npcs, state.player) : null) ?? kioskInteraction();

  let currentTarget: InteractionTarget | null = computeTarget();
  let current: AvailableInteraction | null = currentTarget?.kind === 'npc' ? null : (currentTarget as AvailableInteraction | null);

  /** Recomputes the cached targets and emits only when pointId or action changed. */
  const refreshInteraction = (): void => {
    const target = computeTarget();
    if (!sameInteraction(currentTarget, target)) {
      currentTarget = target;
      signals.emit('interaction.target.changed', { target: target ? { ...target } : null });
    }
    const next = target?.kind === 'npc' ? null : (target as AvailableInteraction | null);
    if (sameInteraction(current, next)) return;
    current = next;
    signals.emit('interaction.available.changed', { interaction: next ? { ...next } : null });
  };

  const ctx: DomainContext = { state: () => state, content, emit: signals.emit, env: () => environmentOf(content, state) };
  const calendar = createCalendarApi(ctx);
  const economy = createEconomyApi(ctx);
  const sim = createNpcSim(ctx);
  const dialogueEngine = createDialogueEngine(ctx, economy, sim);
  const talk = (npcId: string) => {
    const result = dialogueEngine.open(npcId);
    refreshInteraction();
    return result;
  };
  const npcs = createNpcApi(ctx, talk);
  const dialogue: DialogueApi = {
    current: () => dialogueEngine.api.current(),
    choose(optionId) {
      const result = dialogueEngine.api.choose(optionId);
      refreshInteraction();
      return result;
    },
    close() {
      const result = dialogueEngine.api.close();
      refreshInteraction();
      return result;
    },
  };
  const replaceState = (next: GameState): void => {
    dialogueEngine.abort();
    sim.reset();
    state = next;
    currentTarget = computeTarget();
    current = currentTarget?.kind === 'npc' ? null : (currentTarget as AvailableInteraction | null);
    signals.emit('game.state.replaced', {});
  };

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
    npcs,
    dialogue,
    weather: {
      environment: () => ctx.env(),
      forecast: () => forecast(state.world.seed, climateOf(content), state.calendar.day),
      onDay: (day) => weatherOfDay(state.world.seed, climateOf(content), day),
    },
    tick(dtSeconds) {
      tickClock(ctx, dtSeconds);
      if (npcIds.length === 0) return;
      sim.tick(dtSeconds);
      refreshInteraction();
    },
    getAvailableInteraction() {
      return current ? { ...current } : null;
    },
    getInteractionTarget() {
      return currentTarget ? { ...currentTarget } : null;
    },
    interact() {
      const target = computeTarget();
      if (!target) return { ok: false, reason: 'nothing_in_range' };
      if (target.kind === 'npc') return talk(target.npcId);
      const available = target;
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
      replaceState(createInitialState(content, newSeed()));
    },
    load(next) {
      if (next.regionId !== content.regionId) return { ok: false, reason: 'region_mismatch' };
      replaceState(structuredClone(next));
      return { ok: true };
    },
  };
}
