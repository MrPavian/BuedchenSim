import { DAY_END_MINUTE, DAY_START_MINUTE, GAME_MINUTES_PER_SECOND, SPEEDS, type GameSpeed } from './balance';
import type { DomainContext } from './domain';
import type { ActionResult } from './result';
import { createEmptyToday } from './state';

export interface CalendarApi {
  pause(): ActionResult;
  resume(): ActionResult;
  setSpeed(speed: GameSpeed): ActionResult;
  /** Only in phase 'closed': next day, 06:00, phase 'open', `today` reset, speed kept. */
  startNextDay(): ActionResult;
}

function emitChanged(ctx: DomainContext): void {
  const { paused, speed, phase } = ctx.state().calendar;
  ctx.emit('calendar.changed', { paused, speed, phase });
}

/**
 * Advances the clock by real seconds. Runs only while the phase is 'open' and not paused, never passes
 * DAY_END_MINUTE, and switches to 'awaiting_close' exactly once. Invalid or non-positive dt is ignored.
 */
export function tickClock(ctx: DomainContext, dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
  const calendar = ctx.state().calendar;
  if (calendar.phase !== 'open' || calendar.paused) return;
  const next = calendar.minute + dtSeconds * GAME_MINUTES_PER_SECOND * calendar.speed;
  if (next < DAY_END_MINUTE) {
    calendar.minute = next;
    return;
  }
  calendar.minute = DAY_END_MINUTE;
  calendar.phase = 'awaiting_close';
  ctx.emit('day.ending', { day: calendar.day });
  emitChanged(ctx);
}

export function createCalendarApi(ctx: DomainContext): CalendarApi {
  return {
    pause() {
      const calendar = ctx.state().calendar;
      if (!calendar.paused) {
        calendar.paused = true;
        emitChanged(ctx);
      }
      return { ok: true };
    },
    resume() {
      const calendar = ctx.state().calendar;
      if (calendar.paused) {
        calendar.paused = false;
        emitChanged(ctx);
      }
      return { ok: true };
    },
    setSpeed(speed) {
      if (!SPEEDS.includes(speed)) return { ok: false, reason: 'invalid_speed' };
      const calendar = ctx.state().calendar;
      if (calendar.speed !== speed) {
        calendar.speed = speed;
        emitChanged(ctx);
      }
      return { ok: true };
    },
    startNextDay() {
      const state = ctx.state();
      if (state.calendar.phase !== 'closed') return { ok: false, reason: 'day_not_closed' };
      state.calendar.day += 1;
      state.calendar.minute = DAY_START_MINUTE;
      state.calendar.phase = 'open';
      state.economy.today = createEmptyToday();
      emitChanged(ctx);
      ctx.emit('day.started', { day: state.calendar.day });
      return { ok: true };
    },
  };
}
