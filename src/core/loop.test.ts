import { describe, expect, it, vi } from 'vitest';
import { createLoop } from './loop';

function fakeScheduler() {
  let pending: ((t: number) => void) | null = null;
  return {
    schedule: (cb: (t: number) => void): void => {
      pending = cb;
    },
    tick(timeMs: number): void {
      const cb = pending;
      pending = null;
      cb?.(timeMs);
    },
    get hasPending(): boolean {
      return pending !== null;
    },
  };
}

describe('loop', () => {
  it('runs fixed steps and passes the remainder as alpha', () => {
    const sch = fakeScheduler();
    const update = vi.fn();
    const render = vi.fn();
    const loop = createLoop({ update, render, schedule: sch.schedule, stepSeconds: 0.1 });
    loop.start();
    expect(loop.isRunning).toBe(true);
    sch.tick(1000); // first frame: no time elapsed
    expect(update).not.toHaveBeenCalled();
    expect(render).toHaveBeenLastCalledWith(0);
    sch.tick(1250); // 0.25 s => 2 steps, 0.05 left
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(0.1);
    expect(render.mock.lastCall?.[0]).toBeCloseTo(0.5, 5);
  });

  it('clamps long frames', () => {
    const sch = fakeScheduler();
    const update = vi.fn();
    const loop = createLoop({
      update,
      render: () => {},
      schedule: sch.schedule,
      stepSeconds: 0.25,
      maxFrameSeconds: 0.75,
    });
    loop.start();
    sch.tick(0);
    sch.tick(60_000);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('ignores backwards time', () => {
    const sch = fakeScheduler();
    const update = vi.fn();
    const loop = createLoop({ update, render: () => {}, schedule: sch.schedule, stepSeconds: 0.1 });
    loop.start();
    sch.tick(1000);
    sch.tick(500);
    expect(update).not.toHaveBeenCalled();
  });

  it('stops and does not reschedule', () => {
    const sch = fakeScheduler();
    const render = vi.fn();
    const loop = createLoop({ update: () => {}, render, schedule: sch.schedule });
    loop.start();
    sch.tick(0);
    expect(sch.hasPending).toBe(true);
    loop.stop();
    expect(loop.isRunning).toBe(false);
    sch.tick(100);
    expect(render).toHaveBeenCalledTimes(1);
    expect(sch.hasPending).toBe(false);
  });

  it('start is idempotent and restart resets timing', () => {
    const schedule = vi.fn();
    const loop = createLoop({ update: () => {}, render: () => {}, schedule });
    loop.start();
    loop.start();
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('passes errors to onError and stops', () => {
    const sch = fakeScheduler();
    const onError = vi.fn();
    const err = new Error('bad');
    const loop = createLoop({
      update: () => {
        throw err;
      },
      render: () => {},
      schedule: sch.schedule,
      stepSeconds: 0.1,
      onError,
    });
    loop.start();
    sch.tick(0);
    sch.tick(200);
    expect(onError).toHaveBeenCalledWith(err);
    expect(loop.isRunning).toBe(false);
    expect(sch.hasPending).toBe(false);
  });

  it('stops on render error too', () => {
    const sch = fakeScheduler();
    const onError = vi.fn();
    const loop = createLoop({
      update: () => {},
      render: () => {
        throw new Error('r');
      },
      schedule: sch.schedule,
      onError,
    });
    loop.start();
    sch.tick(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(loop.isRunning).toBe(false);
  });
});
