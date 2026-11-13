import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInput } from './input';

type Listener = (event: unknown) => void;

class FakeTarget {
  private readonly listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string, event: Record<string, unknown> = {}): void {
    for (const l of this.listeners.get(type) ?? []) l({ target: null, ...event });
  }
}

const key = (code: string): Record<string, unknown> => ({ code, preventDefault: () => undefined, repeat: false });

describe('input', () => {
  let win: FakeTarget;
  let doc: FakeTarget;

  beforeEach(() => {
    win = new FakeTarget();
    doc = new FakeTarget();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('HTMLElement', class {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports held keys as a normalised axis', () => {
    const input = createInput(() => undefined);
    win.fire('keydown', key('KeyW'));
    win.fire('keydown', key('KeyD'));
    const a = input.axis();
    expect(a.x).toBeCloseTo(Math.SQRT1_2);
    expect(a.z).toBeCloseTo(-Math.SQRT1_2);
    win.fire('keyup', key('KeyW'));
    win.fire('keyup', key('KeyD'));
    expect(input.axis()).toEqual({ x: 0, z: 0 });
  });

  it('a tap shorter than one step still counts exactly once', () => {
    const input = createInput(() => undefined);
    win.fire('keydown', key('KeyA'));
    win.fire('keyup', key('KeyA'));
    expect(input.axis()).toEqual({ x: -1, z: 0 });
    expect(input.axis()).toEqual({ x: 0, z: 0 });
  });

  it('losing focus releases every key and drops pending taps', () => {
    const input = createInput(() => undefined);
    win.fire('keydown', key('KeyS'));
    win.fire('blur');
    expect(input.axis()).toEqual({ x: 0, z: 0 });
  });

  it('E fires the interaction once per press', () => {
    const onInteract = vi.fn();
    createInput(onInteract);
    win.fire('keydown', key('KeyE'));
    win.fire('keydown', { ...key('KeyE'), repeat: true });
    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('a disabled input ignores keys and E, and disabling releases held keys', () => {
    const onInteract = vi.fn();
    const input = createInput(onInteract);
    win.fire('keydown', key('KeyW'));
    input.setEnabled(false);
    expect(input.axis()).toEqual({ x: 0, z: 0 });
    win.fire('keydown', key('KeyD'));
    win.fire('keydown', key('KeyE'));
    expect(input.axis()).toEqual({ x: 0, z: 0 });
    expect(onInteract).not.toHaveBeenCalled();
    input.setEnabled(true);
    expect(input.axis()).toEqual({ x: 0, z: 0 });
    win.fire('keydown', key('KeyD'));
    win.fire('keydown', key('KeyE'));
    expect(input.axis()).toEqual({ x: 1, z: 0 });
    expect(onInteract).toHaveBeenCalledTimes(1);
  });
});
