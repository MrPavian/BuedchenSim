export interface Input {
  /** Screen-relative direction on the ground plane (W = -Z, D = +X), normalised; zero if idle. */
  axis(): { x: number; z: number };
  dispose(): void;
}

const KEY_GROUPS = {
  north: ['KeyW', 'ArrowUp'],
  south: ['KeyS', 'ArrowDown'],
  west: ['KeyA', 'ArrowLeft'],
  east: ['KeyD', 'ArrowRight'],
} as const;

const HANDLED = new Set<string>(Object.values(KEY_GROUPS).flat());

function inFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Keyboard state; `onInteract` fires on E keydown (no auto-repeat). */
export function createInput(onInteract: () => void): Input {
  const down = new Set<string>();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (inFormControl(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (HANDLED.has(event.code)) {
      down.add(event.code);
      event.preventDefault();
    } else if (event.code === 'KeyE' && !event.repeat) {
      onInteract();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    down.delete(event.code);
  };
  const clear = (): void => down.clear();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);

  const any = (codes: readonly string[]): boolean => codes.some((c) => down.has(c));

  return {
    axis() {
      const x = (any(KEY_GROUPS.east) ? 1 : 0) - (any(KEY_GROUPS.west) ? 1 : 0);
      const z = (any(KEY_GROUPS.south) ? 1 : 0) - (any(KEY_GROUPS.north) ? 1 : 0);
      const length = Math.hypot(x, z);
      return length === 0 ? { x: 0, z: 0 } : { x: x / length, z: z / length };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    },
  };
}
