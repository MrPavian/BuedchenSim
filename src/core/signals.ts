import { log } from './log';

export interface Signals<Events extends Record<string, unknown>> {
  /** Subscribes a handler; returns an unsubscribe function. */
  on<K extends keyof Events & string>(name: K, handler: (payload: Events[K]) => void): () => void;
  /** Synchronously calls all handlers. A throwing handler is logged and does not stop the others. */
  emit<K extends keyof Events & string>(name: K, payload: Events[K]): void;
}

export function createSignals<Events extends Record<string, unknown>>(): Signals<Events> {
  const handlers = new Map<string, Set<(payload: never) => void>>();

  return {
    on(name, handler) {
      let set = handlers.get(name);
      if (!set) {
        set = new Set();
        handlers.set(name, set);
      }
      // Wrap so the same function subscribed twice yields two independent subscriptions.
      const entry = (payload: never): void => handler(payload as never);
      set.add(entry);
      return () => {
        set.delete(entry);
      };
    },
    emit(name, payload) {
      const set = handlers.get(name);
      if (!set) return;
      for (const handler of [...set]) {
        try {
          handler(payload as never);
        } catch (error) {
          log.error(`Signal handler for "${name}" threw`, error);
        }
      }
    },
  };
}
