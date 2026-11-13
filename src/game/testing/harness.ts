import { createGame, type Game } from '../game';
import type { GameState } from '../state';
import { testPack } from './fixture-pack';

/** Test helpers: a game with the fixture pack, a far-away player and direct (test-only) access to the state. */

export function mutable(game: Game): GameState {
  return game.state as unknown as GameState;
}

export const FAR_AWAY = { x: -9, z: -6 };

export function newGame(seed = 7, content = testPack): Game {
  const game = createGame(content, undefined, seed);
  game.player.setPose(FAR_AWAY, 0);
  return game;
}

/** Sets the clock (phase 'open') without simulating the minutes in between. */
export function setTime(game: Game, minute: number, day?: number): void {
  const calendar = mutable(game).calendar;
  calendar.minute = minute;
  calendar.phase = 'open';
  if (day !== undefined) calendar.day = day;
}

/** Ticks with the fixed 60 Hz step for the given real seconds. */
export function run(game: Game, seconds: number, step = 1 / 60): void {
  const n = Math.round(seconds / step);
  for (let i = 0; i < n; i += 1) game.tick(step);
}

/** Runs until the predicate holds (max seconds); returns whether it held. */
export function runUntil(game: Game, predicate: () => boolean, maxSeconds = 600): boolean {
  const step = 1 / 60;
  for (let i = 0; i < maxSeconds * 60; i += 1) {
    if (predicate()) return true;
    game.tick(step);
  }
  return predicate();
}

/** Puts goods directly on the shelves (test-only shortcut around ordering). */
export function stockShelves(game: Game): void {
  const economy = mutable(game).economy;
  economy.shelves['slot.shelf-north-1'] = { productId: 'product.test-water', quantity: 10 };
  economy.shelves['slot.shelf-north-2'] = { productId: 'product.test-beer', quantity: 10 };
  economy.shelves['slot.counter-top'] = { productId: 'product.test-tobacco', quantity: 5 };
}

export function openShutter(game: Game): void {
  mutable(game).kiosk.shutterOpen = true;
}

export function setFlag(game: Game, id: string, value = true): void {
  mutable(game).story.flags[id] = value;
}

/**
 * Puts a resident in front of the player for conversation tests, bypassing the simulation:
 * visible, standing 1 m south of the player (who looks south).
 */
export function summon(game: Game, npcId: string, status: 'at_place' | 'waiting' | 'walking' = 'at_place'): void {
  const state = mutable(game);
  const npc = state.npcs[npcId];
  if (!npc) throw new Error(`unknown npc ${npcId}`);
  state.player.position = { x: -9, z: -6 };
  state.player.heading = 0;
  npc.status = status;
  npc.position = { x: -9, z: -5 };
  npc.placeId = 'place.yard';
  npc.routineId = null;
  npc.route = [];
}

/** Gives a resident an open wish directly (bypasses the shop routine). */
export function giveWish(game: Game, npcId: string, wishId: string): void {
  const def = game.content.npcs[npcId];
  const wish = def?.wishes?.find((w) => w.id === wishId);
  const npc = mutable(game).npcs[npcId];
  if (!wish || !npc) throw new Error('unknown wish');
  npc.wish = { wishId, lines: wish.lines.map((l) => ({ ...l })), ageChecked: false, resolved: null };
  npc.status = 'waiting';
}
