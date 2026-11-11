import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLogSink } from './log';
import { createSignals } from './signals';

type Ev = { 'a.changed': { value: number }; 'b.done': { id: string } };

describe('signals', () => {
  let restore: (() => void) | null = null;
  afterEach(() => restore?.());

  it('delivers typed payloads synchronously', () => {
    const s = createSignals<Ev>();
    const received: number[] = [];
    s.on('a.changed', (p) => received.push(p.value));
    s.emit('a.changed', { value: 3 });
    expect(received).toEqual([3]);
  });

  it('rejects wrong names and payloads at type level', () => {
    const s = createSignals<Ev>();
    // @ts-expect-error unknown event name
    s.emit('nope', {});
    // @ts-expect-error wrong payload type
    s.emit('a.changed', { value: 'x' });
    // @ts-expect-error handler payload is typed
    s.on('b.done', (p) => p.value);
  });

  it('unsubscribes', () => {
    const s = createSignals<Ev>();
    const h = vi.fn();
    const off = s.on('b.done', h);
    s.emit('b.done', { id: 'x' });
    off();
    off();
    s.emit('b.done', { id: 'y' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('supports the same handler subscribed twice independently', () => {
    const s = createSignals<Ev>();
    const h = vi.fn();
    const off1 = s.on('b.done', h);
    s.on('b.done', h);
    off1();
    s.emit('b.done', { id: 'x' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('isolates throwing handlers and logs them', () => {
    const sink = vi.fn();
    restore = setLogSink(sink);
    const s = createSignals<Ev>();
    const after = vi.fn();
    s.on('b.done', () => {
      throw new Error('boom');
    });
    s.on('b.done', after);
    expect(() => s.emit('b.done', { id: 'x' })).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith('error', expect.stringContaining('b.done'), expect.any(Error));
  });

  it('handles unsubscribe during emit', () => {
    const s = createSignals<Ev>();
    const second = vi.fn();
    let off2 = (): void => {};
    s.on('b.done', () => off2());
    off2 = s.on('b.done', second);
    s.emit('b.done', { id: 'x' });
    expect(second).toHaveBeenCalledTimes(1); // snapshot semantics for the current emit
    s.emit('b.done', { id: 'y' });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
