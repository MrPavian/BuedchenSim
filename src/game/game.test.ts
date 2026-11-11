import { describe, expect, it, vi } from 'vitest';
import { testPack } from './testing/fixture-pack';
import { createGame } from './game';
import { createInitialState } from './state';

const content = testPack;
const nearDoor = { x: 2.0, z: 2.6 };
const farAway = { x: -9, z: 3 };

describe('game facade', () => {
  it('starts at the spawn with closed door and shutter', () => {
    const game = createGame(content);
    expect(game.state).toEqual({
      regionId: 'region.test',
      player: { position: { x: 0.9, z: 3.6 }, heading: Math.PI },
      kiosk: { doorOpen: false, shutterOpen: false },
    });
    expect(game.getAvailableInteraction()).toBeNull();
  });

  it('clamps poses to walkBounds and rejects non-finite values', () => {
    const game = createGame(content);
    expect(game.player.setPose({ x: 100, z: -100 }, 1)).toEqual({ ok: true });
    expect(game.state.player.position).toEqual({ x: 11, z: -7 });
    expect(game.state.player.heading).toBe(1);
    const before = structuredClone(game.state);
    expect(game.player.setPose({ x: Number.NaN, z: 0 }, 0)).toEqual({ ok: false, reason: 'invalid_pose' });
    expect(game.player.setPose({ x: 0, z: 0 }, Infinity).ok).toBe(false);
    expect(game.state).toEqual(before);
  });

  it('reports availability and emits the change signal once', () => {
    const game = createGame(content);
    const handler = vi.fn();
    game.signals.on('interaction.available.changed', handler);
    game.player.setPose(nearDoor, 0);
    game.player.setPose({ x: 2.1, z: 2.7 }, 0.2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      interaction: { pointId: 'interaction.door', kind: 'door', action: 'door.open' },
    });
    expect(game.getAvailableInteraction()?.pointId).toBe('interaction.door');
    game.player.setPose(farAway, 0);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith({ interaction: null });
  });

  it('switches between points when the nearest changes', () => {
    const game = createGame(content);
    const handler = vi.fn();
    game.signals.on('interaction.available.changed', handler);
    game.player.setPose({ x: 2.0, z: 2.5 }, 0);
    game.player.setPose({ x: -1.0, z: 2.5 }, 0);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(game.getAvailableInteraction()?.pointId).toBe('interaction.shutter');
  });

  it('interact toggles the door, emits signals and updates the action', () => {
    const game = createGame(content);
    const door = vi.fn();
    const avail = vi.fn();
    game.signals.on('kiosk.door.changed', door);
    game.signals.on('interaction.available.changed', avail);
    game.player.setPose(nearDoor, 0);
    expect(game.interact()).toEqual({ ok: true });
    expect(game.state.kiosk.doorOpen).toBe(true);
    expect(door).toHaveBeenCalledWith({ open: true });
    expect(game.getAvailableInteraction()?.action).toBe('door.close');
    expect(avail).toHaveBeenCalledTimes(2); // appeared, then door.open -> door.close
    game.interact();
    expect(game.state.kiosk.doorOpen).toBe(false);
    expect(door).toHaveBeenLastCalledWith({ open: false });
  });

  it('interact toggles the shutter', () => {
    const game = createGame(content);
    const shutter = vi.fn();
    game.signals.on('kiosk.shutter.changed', shutter);
    game.player.setPose({ x: -1, z: 2.2 }, 0);
    game.interact();
    expect(game.state.kiosk.shutterOpen).toBe(true);
    expect(shutter).toHaveBeenCalledWith({ open: true });
    expect(game.state.kiosk.doorOpen).toBe(false);
  });

  it('interact reports nothing_in_range', () => {
    const game = createGame(content);
    expect(game.interact()).toEqual({ ok: false, reason: 'nothing_in_range' });
  });

  it('save() returns a deep copy', () => {
    const game = createGame(content);
    const snapshot = game.save();
    expect(snapshot.schemaVersion).toBe(1);
    expect(typeof snapshot.savedAt).toBe('string');
    snapshot.state.player.position.x = 5;
    snapshot.state.kiosk.doorOpen = true;
    expect(game.state.player.position.x).toBe(0.9);
    expect(game.state.kiosk.doorOpen).toBe(false);
    game.player.setPose({ x: 1, z: 1 }, 0);
    expect(snapshot.state.player.position.x).toBe(5);
  });

  it('does not alias the initial state passed in', () => {
    const initial = createInitialState(content);
    const game = createGame(content, initial);
    game.player.setPose({ x: 1, z: 4 }, 0);
    expect(initial.player.position).toEqual({ x: 0.9, z: 3.6 });
  });

  it('computes the interaction for a provided initial state', () => {
    const initial = createInitialState(content);
    initial.player.position = { ...nearDoor };
    expect(createGame(content, initial).getAvailableInteraction()?.pointId).toBe('interaction.door');
  });

  it('reset restores the initial state and emits game.state.replaced', () => {
    const game = createGame(content);
    const replaced = vi.fn();
    game.signals.on('game.state.replaced', replaced);
    game.player.setPose(nearDoor, 2);
    game.interact();
    game.reset();
    expect(replaced).toHaveBeenCalledTimes(1);
    expect(game.state).toEqual(createInitialState(content));
    expect(game.getAvailableInteraction()).toBeNull();
  });

  it('load replaces the state and rejects other regions', () => {
    const game = createGame(content);
    const replaced = vi.fn();
    game.signals.on('game.state.replaced', replaced);
    const next = createInitialState(content);
    next.kiosk.doorOpen = true;
    next.player.position = { ...nearDoor };
    expect(game.load(next)).toEqual({ ok: true });
    expect(game.state.kiosk.doorOpen).toBe(true);
    expect(game.getAvailableInteraction()?.action).toBe('door.close');
    expect(replaced).toHaveBeenCalledTimes(1);
    expect(game.load({ ...next, regionId: 'region.other' })).toEqual({ ok: false, reason: 'region_mismatch' });
    expect(replaced).toHaveBeenCalledTimes(1);
  });
});
