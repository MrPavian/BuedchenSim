export interface LoopOptions {
  /** Advances the simulation by a fixed step. */
  update(dtSeconds: number): void;
  /** Draws a frame; alpha in [0,1) is the fraction of a step left in the accumulator. */
  render(alpha: number): void;
  /** Schedules the next frame callback (main passes requestAnimationFrame). Time in ms. */
  schedule(callback: (timeMs: number) => void): void;
  stepSeconds?: number;
  maxFrameSeconds?: number;
  /** Called when update/render throws; the loop is stopped afterwards. */
  onError?(error: unknown): void;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly isRunning: boolean;
}

export function createLoop(options: LoopOptions): Loop {
  const step = options.stepSeconds ?? 1 / 60;
  const maxFrame = options.maxFrameSeconds ?? 0.25;
  let running = false;
  let generation = 0;
  let lastTimeMs: number | null = null;
  let accumulator = 0;

  const makeFrame = (gen: number) => (timeMs: number): void => {
    // Ignore stale callbacks from a previous start()/stop() cycle.
    if (!running || gen !== generation) return;
    const frameSeconds =
      lastTimeMs === null ? 0 : Math.min(Math.max((timeMs - lastTimeMs) / 1000, 0), maxFrame);
    lastTimeMs = timeMs;
    accumulator += frameSeconds;
    try {
      while (accumulator >= step) {
        options.update(step);
        accumulator -= step;
        if (!running || gen !== generation) return;
      }
      options.render(accumulator / step);
    } catch (error) {
      running = false;
      options.onError?.(error);
      return;
    }
    if (running && gen === generation) options.schedule(makeFrame(gen));
  };

  return {
    start() {
      if (running) return;
      running = true;
      generation += 1;
      lastTimeMs = null;
      accumulator = 0;
      options.schedule(makeFrame(generation));
    },
    stop() {
      running = false;
    },
    get isRunning() {
      return running;
    },
  };
}
