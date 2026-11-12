import { describe, expect, it, vi } from 'vitest';
import { createGame, type Game } from './game';
import { testPack } from './testing/fixture-pack';

function setup(): Game {
  return createGame(testPack);
}

describe('day clock', () => {
  it('advances one game minute per real second at normal speed', () => {
    const game = setup();
    game.tick(1);
    expect(game.state.calendar.minute).toBeCloseTo(361);
    for (let i = 0; i < 60; i += 1) game.tick(1 / 60);
    expect(game.state.calendar.minute).toBeCloseTo(362);
  });

  it('does not run while paused and continues after resume', () => {
    const game = setup();
    const changed = vi.fn();
    game.signals.on('calendar.changed', changed);
    expect(game.calendar.pause()).toEqual({ ok: true });
    game.tick(10);
    expect(game.state.calendar.minute).toBe(360);
    game.calendar.pause(); // already paused: no second signal
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenLastCalledWith({ paused: true, speed: 1, phase: 'open' });
    game.calendar.resume();
    game.tick(10);
    expect(game.state.calendar.minute).toBeCloseTo(370);
  });

  it('runs at 2x and 4x and rejects other speeds', () => {
    const game = setup();
    expect(game.calendar.setSpeed(2)).toEqual({ ok: true });
    game.tick(10);
    expect(game.state.calendar.minute).toBeCloseTo(380);
    game.calendar.setSpeed(4);
    game.tick(10);
    expect(game.state.calendar.minute).toBeCloseTo(420);
    expect(game.calendar.setSpeed(3 as never)).toEqual({ ok: false, reason: 'invalid_speed' });
    expect(game.state.calendar.speed).toBe(4);
  });

  it('ignores negative, zero and non-finite dt', () => {
    const game = setup();
    for (const dt of [-5, 0, Number.NaN, Infinity, -Infinity]) game.tick(dt);
    expect(game.state.calendar.minute).toBe(360);
  });

  it('clamps at 22:00 with a huge dt and signals the end exactly once', () => {
    const game = setup();
    const ending = vi.fn();
    const changed = vi.fn();
    game.signals.on('day.ending', ending);
    game.signals.on('calendar.changed', changed);
    game.tick(1_000_000);
    game.tick(1_000_000);
    game.tick(5);
    expect(game.state.calendar).toMatchObject({ minute: 1320, phase: 'awaiting_close', day: 1 });
    expect(ending).toHaveBeenCalledTimes(1);
    expect(ending).toHaveBeenCalledWith({ day: 1 });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ paused: false, speed: 1, phase: 'awaiting_close' });
  });

  it('never closes the day by itself and does not tick in awaiting_close or closed', () => {
    const game = setup();
    const ended = vi.fn();
    game.signals.on('day.ended', ended);
    game.tick(100_000);
    expect(ended).not.toHaveBeenCalled();
    expect(game.economy.closeDay().ok).toBe(true);
    game.tick(100);
    expect(game.state.calendar.minute).toBe(1320);
    expect(game.state.calendar.phase).toBe('closed');
  });

  it('does not emit a signal for ordinary ticks', () => {
    const game = setup();
    const any = vi.fn();
    game.signals.on('calendar.changed', any);
    game.signals.on('day.ending', any);
    for (let i = 0; i < 100; i += 1) game.tick(0.5);
    expect(any).not.toHaveBeenCalled();
  });

  it('runs independently of door and shutter', () => {
    const game = setup();
    expect(game.state.kiosk.shutterOpen).toBe(false);
    game.tick(5);
    expect(game.state.calendar.minute).toBeCloseTo(365);
  });

  it('closes the day only once and starts the next day on request', () => {
    const game = setup();
    const started = vi.fn();
    const ended = vi.fn();
    game.signals.on('day.started', started);
    game.signals.on('day.ended', ended);
    expect(game.calendar.startNextDay()).toEqual({ ok: false, reason: 'day_not_closed' });
    game.tick(100_000);
    game.calendar.setSpeed(4);
    expect(game.calendar.startNextDay()).toEqual({ ok: false, reason: 'day_not_closed' });
    expect(game.economy.closeDay().ok).toBe(true);
    expect(game.economy.closeDay()).toEqual({ ok: false, reason: 'day_already_closed' });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith({ day: 1 });
    expect(game.calendar.startNextDay()).toEqual({ ok: true });
    expect(game.state.calendar).toEqual({ day: 2, minute: 360, paused: false, speed: 4, phase: 'open' });
    expect(started).toHaveBeenCalledWith({ day: 2 });
    expect(game.calendar.startNextDay().ok).toBe(false);
  });

  it('allows an explicit early close while open', () => {
    const game = setup();
    game.tick(60);
    const result = game.economy.closeDay();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.closedAtMinute).toBe(420);
    expect(game.state.calendar.phase).toBe('closed');
  });
});
