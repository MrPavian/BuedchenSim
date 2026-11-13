import { ruhrgebietPack } from './content/regions/ruhrgebiet';
import { validateContent } from './content/validate';
import { createLoop } from './core/loop';
import { log } from './core/log';
import { createGame, type Game } from './game/game';
import { createSaveStore, type KeyValueStore } from './game/save/save';
import { createUi, showFatalError, type Ui } from './ui/ui';
import { texts } from './ui/texts';
import { WebGLUnavailableError, createWorld, type World } from './world/world';

const AUTOSAVE_INTERVAL_MS = 10_000;
const SAVE_DEBOUNCE_MS = 300;

function getStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked or unavailable (privacy mode, sandboxed frame)
  }
}

function start(): void {
  const appRoot = document.getElementById('app');
  if (!appRoot) throw new Error('Missing #app element');
  appRoot.replaceChildren();

  let ui: Ui | null = null;
  let loopStopped = false;
  const fatal = (message: string, details?: unknown): void => {
    log.error(message, details);
    if (ui) ui.showFatal(message, details);
    else showFatalError(appRoot, { message, details });
  };

  window.addEventListener('error', (event) => fatal(texts.errors.generic, event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => fatal(texts.errors.generic, event.reason));

  const pack = ruhrgebietPack;
  const contentErrors = validateContent(pack);
  if (contentErrors.length > 0) {
    log.error('Content validation failed', contentErrors);
    if (import.meta.env.DEV) fatal(texts.errors.content, contentErrors.join('\n'));
    return;
  }

  // --- Save / load
  const saveStore = createSaveStore(getStorage());
  const loaded = saveStore.load(pack);
  const game: Game = createGame(pack, loaded.status === 'ok' ? loaded.state : undefined);

  const sceneRoot = document.createElement('div');
  sceneRoot.className = 'scene';
  appRoot.append(sceneRoot);

  let saveFailureShown = false;
  const persist = (): void => {
    const result = saveStore.save(game.save().state);
    if (result.ok) {
      saveFailureShown = false;
    } else if (!saveFailureShown) {
      saveFailureShown = true;
      ui?.notify(texts.notices.saveFailed);
    }
  };

  // Panels switch world input off while open; the world may not exist yet when the first panel opens
  // (e.g. the day report after a reload), so the state is remembered and applied after creation.
  let world: World | null = null;
  let modalOpen = false;
  ui = createUi(game, appRoot, {
    onNewGame() {
      saveStore.clear();
      game.reset();
      persist();
      ui?.notify(texts.newGame.started);
    },
    onModalChange(open) {
      modalOpen = open;
      world?.setInputEnabled(!open);
    },
  });

  try {
    world = createWorld(game, sceneRoot);
    world.setInputEnabled(!modalOpen);
  } catch (error) {
    fatal(error instanceof WebGLUnavailableError ? texts.errors.webgl : texts.errors.generic, error);
    return;
  }

  if (loaded.status === 'ok') {
    if (loaded.warnings && loaded.warnings.length > 0) {
      log.warn('Save adjusted to current content', loaded.warnings);
      ui.notify(texts.notices.loadedAdjusted(loaded.warnings.length));
    } else {
      ui.notify(texts.notices.loaded);
    }
  } else if (loaded.status === 'corrupt' || loaded.status === 'unsupported_version') ui.notify(texts.notices.corrupt);

  // Autosave: after kiosk changes, periodically, and when the page goes away.
  game.signals.on('kiosk.door.changed', persist);
  game.signals.on('kiosk.shutter.changed', persist);
  // Economy and calendar changes are saved shortly after the last one (debounced; pagehide saves at once).
  let persistTimer: number | undefined;
  const persistSoon = (): void => {
    if (persistTimer !== undefined) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = undefined;
      persist();
    }, SAVE_DEBOUNCE_MS);
  };
  for (const name of [
    'sale.completed',
    'order.placed',
    'delivery.received',
    'day.ended',
    'day.started',
    'calendar.changed',
    'product.stock.changed',
    'money.changed',
  ] as const) {
    game.signals.on(name, persistSoon);
  }
  window.setInterval(persist, AUTOSAVE_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);

  if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
    (window as unknown as { __buedchen: { game: Game; world: World; ui: Ui } }).__buedchen = { game, world, ui };
  }

  const loop = createLoop({
    update: (dt) => {
      game.tick(dt);
      world.update(dt);
    },
    render: (alpha) => {
      world?.render(alpha);
      ui?.frame();
    },
    schedule: (callback) => {
      if (!loopStopped) requestAnimationFrame(callback);
    },
    onError(error) {
      loopStopped = true;
      fatal(texts.errors.generic, error);
    },
  });
  loop.start();
}

try {
  start();
} catch (error) {
  log.error('Startup failed', error);
  const root = document.getElementById('app');
  if (root) showFatalError(root, { message: texts.errors.generic, details: error });
}
