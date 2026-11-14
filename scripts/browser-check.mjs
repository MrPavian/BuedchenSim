// Real-browser check: builds the game, serves it with `vite preview`, drives it with real key
// presses in Chromium (Playwright) and writes screenshots to docs/screenshots/.
//
// Determinism rules (this headless software-GL environment runs at ~30 fps with stutter):
//  - speeds are measured against the game's own simulated time (world.getSimStats), never wall-clock time;
//  - movement checks wait for a condition (polling) instead of fixed sleeps;
//  - keyboard focus is verified before keys are pressed, all keys are released after every section;
//  - crashes, closed pages and lost WebGL contexts are reported as FAIL lines, the PASS/FAIL list is
//    always printed and server and browser are always stopped.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The documentation screenshots of Auftrag 01-03 (docs/screenshots/auftrag-0[123]-*.png) are frozen: the Phase-3 and view
// screenshots of this script go to a temporary directory outside the repository. Only the Auftrag-04 series is written to the repo.
const shotDir = mkdtempSync(path.join(os.tmpdir(), 'buedchensim-shots-'));
const shotDir04 = path.join(root, 'docs', 'screenshots', 'auftrag-04');
mkdirSync(shotDir04, { recursive: true });

// CLI: `--only economy` runs only the economy/UI flow (no old sections, no screenshots), `--only residents` only the
// residents section (Auftrag 04, incl. its screenshots), `--only shots` only the screenshot sections (E13, R13); without
// the flag everything runs (also via env BC_ONLY). BC_NOBUILD=1 skips the build (development only).
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : (process.env.BC_ONLY ?? null);
if (only !== null && !['economy', 'shots', 'residents'].includes(only)) throw new Error(`unknown --only ${only} (economy | residents | shots)`);
const runOld = only === null;
const runEconomy = only === null || only === 'economy';
const runShots = only === null || only === 'shots';
const runResidents = only === null || only === 'residents';

const startedAt = Date.now();
const results = [];
const record = (name, ok, info = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
};
const f = (n) => Number(n).toFixed(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Constants mirrored from the game for the assertions (player speed, collision radius, silhouette colour).
const PLAYER_SPEED = 3.5;
const PLAYER_RADIUS = 0.3;
const SILHOUETTE_RGB = [0x8f, 0xe7, 0xff]; // SILHOUETTE_COLOUR in src/world/playerFigure.ts
// Marker colour: palette.marker 0xffc94d (src/world/materials.ts); the pixel classifier accepts a warm yellow/orange hue range around it.

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

let server = null;
let browser = null;
const problems = [];
let pageGone = null; // reason string once the main page crashed or closed unexpectedly
let expectClose = false;

try {
  if (!process.env.BC_NOBUILD) {
    const build = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
      cwd: root,
      stdio: 'inherit',
    });
    if (build.status !== 0) throw new Error('Build failed');
  }

  const port = await freePort();
  server = spawn(
    process.execPath,
    [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 20000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('127.0.0.1')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once('exit', () => reject(new Error('vite preview exited')));
  });
  const url = `http://127.0.0.1:${port}/?debug`;

  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  browser.on('disconnected', () => {
    if (!expectClose) pageGone ??= 'Browser-Verbindung getrennt (Browser beendet/abgestürzt)';
  });

  const watch = (page, label) => {
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`${label} console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`${label} pageerror: ${e.message}`));
    page.on('crash', () => {
      pageGone ??= `${label}: Seite abgestürzt (crash-Event)`;
      problems.push(`${label} page crash`);
    });
    page.on('close', () => {
      if (!expectClose) pageGone ??= `${label}: Seite unerwartet geschlossen`;
    });
  };
  // Collects notices (they fade after a few seconds) and reports a lost WebGL context.
  const initScript = () => {
    window.__notices = [];
    window.__noticeNodes = []; // every notice element ever added (duplicates kept)
    window.__ctxLost = 0;
    new MutationObserver((records) => {
      for (const n of document.querySelectorAll('.ui-notice')) if (!window.__notices.includes(n.textContent)) window.__notices.push(n.textContent);
      for (const r of records) for (const n of r.addedNodes) if (n.classList?.contains('ui-notice')) window.__noticeNodes.push(n.textContent);
    }).observe(document, { childList: true, subtree: true });
    // Seed channel for the economy checks: a save stored in sessionStorage is written to localStorage before the app
    // loads (a plain init-script write would overwrite the autosave on every reload).
    try {
      const seed = window.sessionStorage.getItem('__seed');
      if (seed) {
        localStorage.setItem('buedchensim.save.slot1', seed);
        window.sessionStorage.removeItem('__seed');
      }
    } catch { /* ignore */ }
    window.addEventListener('webglcontextlost', () => {
      window.__ctxLost += 1;
      console.error('webglcontextlost');
    }, true);
  };

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let page = await context.newPage();
  watch(page, 'main');
  await page.addInitScript(initScript);
  await page.goto(url);
  await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
  await sleep(1000);

  // ---------------------------------------------------------------- helpers
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__buedchen.game.state)));
  const pos = async () => (await st()).player.position;
  const simStats = () => page.evaluate(() => window.__buedchen.world.getSimStats());
  const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE'];
  const releaseKeys = async () => {
    for (const k of KEYS) await page.keyboard.up(k).catch(() => undefined);
  };
  /** Verifies the page has keyboard focus; tries to restore it once. Returns false if it still has none. */
  const ensureFocus = async () => {
    const has = () => page.evaluate(() => document.hasFocus());
    if (await has()) return true;
    await page.bringToFront();
    await page.evaluate(() => window.focus());
    await sleep(100);
    return has();
  };
  const waitSteps = async (n, timeoutMs = 4000) => {
    const start = (await simStats()).steps;
    const end = Date.now() + timeoutMs;
    while (Date.now() < end && (await simStats()).steps < start + n) await sleep(30);
  };
  const waitUntil = async (pred, timeoutMs, pollMs = 50) => {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const v = await pred();
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(pollMs);
    }
  };

  /** Holds keys until `done(pos, startPos)` is true (polled) or the timeout passes. */
  const hold = async (keys, done, timeoutMs = 8000) => {
    if (!(await ensureFocus())) throw new Error('Seite hat keinen Tastaturfokus');
    const before = await pos();
    for (const k of keys) await page.keyboard.down(k);
    try {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        if (done(await pos(), before)) break;
        await sleep(40);
      }
    } finally {
      for (const k of keys) await page.keyboard.up(k);
    }
    await waitSteps(3);
    const after = await pos();
    return { before, after, dx: after.x - before.x, dz: after.z - before.z };
  };

  /**
   * Holds keys until the player stops moving (no displacement for 0.4 simulated seconds), tracking the
   * smallest distance of the player centre to `rect` (null: none) on every animation frame.
   */
  const holdUntilStopped = async (keys, rect, timeoutMs = 9000) => {
    if (!(await ensureFocus())) throw new Error('Seite hat keinen Tastaturfokus');
    for (const k of keys) await page.keyboard.down(k);
    try {
      return await page.evaluate(
        ({ rect, timeoutMs }) =>
          new Promise((resolve) => {
            const w = window.__buedchen.world;
            const g = window.__buedchen.game;
            const t0 = performance.now();
            const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
            const dist = (p) => (rect ? Math.hypot(p.x - clamp(p.x, rect.minX, rect.maxX), p.z - clamp(p.z, rect.minZ, rect.maxZ)) : Infinity);
            let min = Infinity;
            let ref = null;
            const tick = () => {
              const p = g.state.player.position;
              const s = w.getSimStats().seconds;
              min = Math.min(min, dist(p));
              if (!ref || Math.hypot(p.x - ref.x, p.z - ref.z) > 0.003) ref = { x: p.x, z: p.z, s };
              const stopped = s - ref.s >= 0.4;
              if (stopped || performance.now() - t0 > timeoutMs) resolve({ pos: { x: p.x, z: p.z }, min, stopped, finalDist: dist(p) });
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        { rect, timeoutMs },
      );
    } finally {
      for (const k of keys) await page.keyboard.up(k);
      await waitSteps(2);
    }
  };

  /**
   * Speed against simulated time: keys stay held, the page samples (sim seconds, position) twice, at least
   * `warmup` and then `window` simulated seconds apart. Both samples are taken inside single animation-frame
   * callbacks, so they are consistent however much the frames stutter.
   */
  const measureSpeed = async (keys, warmup = 0.4, windowSeconds = 1.0) => {
    if (!(await ensureFocus())) throw new Error('Seite hat keinen Tastaturfokus');
    for (const k of keys) await page.keyboard.down(k);
    try {
      return await page.evaluate(
        ({ warmup, windowSeconds }) =>
          new Promise((resolve, reject) => {
            const w = window.__buedchen.world;
            const g = window.__buedchen.game;
            const t0 = performance.now();
            const s0 = w.getSimStats().seconds;
            let a = null;
            const tick = () => {
              const s = w.getSimStats().seconds;
              const p = g.state.player.position;
              if (performance.now() - t0 > 30000) return reject(new Error('Geschwindigkeitsmessung: Zeitüberschreitung'));
              if (!a && s - s0 >= warmup) a = { s, x: p.x, z: p.z };
              if (a && s - a.s >= windowSeconds) {
                const dt = s - a.s;
                const dx = p.x - a.x;
                const dz = p.z - a.z;
                return resolve({ seconds: dt, dx, dz, speed: Math.hypot(dx, dz) / dt });
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        { warmup, windowSeconds },
      );
    } finally {
      for (const k of keys) await page.keyboard.up(k);
      await waitSteps(2);
    }
  };

  // Positioning between checks: a greedy controller running inside the page (one decision per animation frame,
  // so no Playwright round-trip latency and no overshoot oscillation). It drives the game's own keyboard
  // handlers with dispatched key events; everything that is asserted (speed, collision stops, door/shutter keys)
  // uses real Playwright key presses instead.
  const walkTo = async (target, timeoutMs = 30000, tol = 0.12) => {
    if (!(await ensureFocus())) throw new Error('Seite hat keinen Tastaturfokus');
    const res = await page.evaluate(
      ({ target, tol, timeoutMs }) =>
        new Promise((resolve) => {
          const g = window.__buedchen.game;
          const held = new Set();
          const set = (code, on) => {
            if (on && !held.has(code)) {
              held.add(code);
              window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
            } else if (!on && held.has(code)) {
              held.delete(code);
              window.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
            }
          };
          const t0 = performance.now();
          const tick = () => {
            const p = g.state.player.position;
            const dx = target.x - p.x;
            const dz = target.z - p.z;
            const timedOut = performance.now() - t0 > timeoutMs;
            const done = (Math.abs(dx) < tol && Math.abs(dz) < tol) || timedOut;
            if (done) {
              for (const c of [...held]) set(c, false);
              resolve({ timedOut, ms: Math.round(performance.now() - t0) });
              return;
            }
            // Far away: hold the key (one frame never moves more than ~0.9 m even at the 0.25 s frame clamp, so
            // holding while more than 1 m remains cannot overshoot). Near: one tap per frame = exactly one
            // 1/60 s simulation step (~6 cm), independent of the frame rate.
            for (const [axisD, plus, minus] of [[dx, 'KeyD', 'KeyA'], [dz, 'KeyS', 'KeyW']]) {
              const far = Math.abs(axisD) > 1.0;
              set(plus, far && axisD > 0);
              set(minus, far && axisD < 0);
              if (!far && Math.abs(axisD) >= tol) {
                const code = axisD > 0 ? plus : minus;
                window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
                window.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
              }
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { target, tol, timeoutMs },
    );
    await waitSteps(3);
    const end = await pos();
    if (res.timedOut) console.log(`info: walkTo (${f(target.x)}, ${f(target.z)}) timed out after ${res.ms} ms at (${f(end.x)}, ${f(end.z)})`);
    return end;
  };
  /**
   * Phase 1-3 sections predate the residents (Auftrag 04). Their clock runs, so from 06:30 a resident may stand at the
   * window, and a resident in range takes priority over the kiosk points (game rule). These sections therefore send all
   * residents home and pause the clock before they test door/shutter interactions (setup via the debug hook only).
   */
  const residentsAway = async () => {
    await page.evaluate(() => {
      const { game } = window.__buedchen;
      const st = structuredClone(game.state);
      const exitPos = (npcId) => {
        const def = game.content.npcs[npcId];
        const place = game.content.layout.nav.places.find((p) => p.id === def.homeExitPlaceId);
        const wp = game.content.layout.nav.waypoints.find((w) => w.id === place.spots[0].waypointId);
        return { x: wp.position.x, z: wp.position.z };
      };
      for (const [id, n] of Object.entries(st.npcs)) {
        Object.assign(n, { status: 'away', position: exitPos(id), placeId: null, spotIndex: null, route: [], routineId: null, wish: null, waitingSince: null });
      }
      st.calendar.paused = true;
      game.load(st);
    });
  };

  const walkVia = async (points, finalTol = 0.12) => {
    let p = await pos();
    for (let i = 0; i < points.length; i += 1) p = await walkTo(points[i], 30000, i === points.length - 1 ? finalTol : 0.2);
    return p;
  };

  const promptText = () =>
    page.evaluate(() => {
      const el = document.querySelector('.ui-prompt');
      return el && !el.hidden && getComputedStyle(el).display !== 'none' ? el.textContent.replace(/^E/, '').trim() : null;
    });
  const pressE = async () => {
    if (!(await ensureFocus())) throw new Error('Seite hat keinen Tastaturfokus');
    await page.keyboard.press('KeyE');
    await waitSteps(3);
    await sleep(250);
  };

  // Pixel analysis of a screenshot (decoded inside the page). `kind`: 'blue' | 'silhouette' | 'marker'.
  const countPixels = async (regions, kind) => {
    const buf = await page.screenshot();
    return page.evaluate(
      async ({ b64, regions, kind, sil }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const near = (v, t, tol) => Math.abs(v - t) <= tol;
        const test = {
          blue: (r, g, b) => b > r + 70 && b > g + 30,
          silhouette: (r, g, b) => near(r, sil[0], 14) && near(g, sil[1], 14) && near(b, sil[2], 14),
          // warm yellow/orange hue; wide enough for the marker blended at its lowest pulse opacity over dark surfaces
          marker: (r, g, b) => r >= 170 && g >= 120 && r >= g && g >= b + 35 && r - b >= 80 && r - g <= 80,
        }[kind];
        return regions.map(({ x0, y0, x1, y1 }) => {
          const x = Math.max(0, Math.round(x0));
          const y = Math.max(0, Math.round(y0));
          const w = Math.min(c.width, Math.round(x1)) - x;
          const h = Math.min(c.height, Math.round(y1)) - y;
          if (w <= 0 || h <= 0) return 0;
          const d = ctx.getImageData(x, y, w, h).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n += 1;
          return n;
        });
      },
      { b64: buf.toString('base64'), regions, kind, sil: SILHOUETTE_RGB },
    );
  };
  const canvasOffset = () =>
    page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left, y: r.top };
    });
  const figureBox = async () => {
    const o = await canvasOffset();
    const s = await page.evaluate(() => window.__buedchen.world.getFigureScreen());
    return { screen: s, region: { x0: o.x + s.x - 45, x1: o.x + s.x + 45, y0: o.y + s.y - 70, y1: o.y + s.y + 80 } };
  };

  // Sections: each one is isolated; an exception becomes a FAIL line, all keys are released afterwards.
  const section = async (name, fn) => {
    // economy sections are named 'E…' (E13 = screenshots), resident sections 'R…' (R13 = screenshots); everything else is an old section
    if (name.startsWith('E13') ? !runShots : name.startsWith('E') ? !runEconomy : name.startsWith('R13') ? !(runShots || runResidents) : name.startsWith('R') ? !runResidents : !runOld) return;
    if (pageGone) {
      record(`${name}: übersprungen`, false, pageGone);
      return;
    }
    try {
      await fn();
    } catch (error) {
      record(`${name}: Ausnahme`, false, pageGone ?? (error instanceof Error ? error.message.split('\n')[0] : String(error)));
    } finally {
      if (!pageGone) await releaseKeys();
    }
  };

  // Layout data from the page (serialisable) for the independent geometry in this script.
  const data = await page.evaluate(() => {
    const c = window.__buedchen.game.content;
    return JSON.parse(JSON.stringify({ layout: c.layout, assets: c.assets, products: c.products, stockSlots: c.stockSlots, npcs: c.npcs }));
  });
  const placements = data.layout.placements;
  const placementOf = (id) => placements.find((p) => p.id === id);
  const footprint = (p) => {
    const a = data.assets[p.assetId];
    const s = p.scale ?? 1;
    const swapped = p.rotation === 90 || p.rotation === 270;
    const hw = ((swapped ? a.size.depth : a.size.width) * s) / 2;
    const hd = ((swapped ? a.size.width : a.size.depth) * s) / 2;
    return { minX: p.position.x - hw, maxX: p.position.x + hw, minZ: p.position.z - hd, maxZ: p.position.z + hd };
  };
  const baseHeight = (p, depth = 0) => {
    if (p.on === undefined || depth > 8) return 0;
    const sup = placementOf(p.on);
    if (!sup) return 0;
    return baseHeight(sup, depth + 1) + data.assets[sup.assetId].size.height * (sup.scale ?? 1);
  };

  // ---------------------------------------------------------------- 0/1 basics
  await section('0 Fokus', async () => {
    record('0 Seite hat Tastaturfokus (Voraussetzung für die Tastenprüfungen)', await ensureFocus());
  });

  // Frame rate (info only).
  const fps = await page.evaluate(
    () => new Promise((resolve) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => (performance.now() - t0 > 1000 ? resolve(n) : (n++, requestAnimationFrame(tick)));
      requestAnimationFrame(tick);
    }),
  );
  console.log(`info: ~${fps} frames/s in this headless software-GL environment`);

  const analyse = async () => {
    const buf = await page.screenshot();
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const colours = new Set();
      let bx = 0, bz = 0, bn = 0;
      for (let y = 0; y < c.height; y += 2) {
        for (let x = 0; x < c.width; x += 2) {
          const i = (y * c.width + x) * 4;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          colours.add(`${r >> 4},${g >> 4},${b >> 4}`);
          // blue jacket of the player figure
          if (b > r + 70 && b > g + 30 && y < c.height - 150) { bx += x; bz += y; bn++; }
        }
      }
      return { colours: colours.size, figure: bn > 40 ? { x: bx / bn, y: bz / bn, n: bn } : null };
    }, buf.toString('base64'));
  };

  await section('1 Canvas', async () => {
    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { exists: false };
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return { exists: true, w: c.width, h: c.height, glOk: !!gl && !gl.isContextLost() };
    });
    const first = await analyse();
    record('1 Canvas vorhanden, WebGL ok, Bild nicht leer', canvasInfo.exists && canvasInfo.glOk && first.colours > 40, `${canvasInfo.w}x${canvasInfo.h}, ${first.colours} Farbklassen`);
    record('1b Spielfigur im Bild sichtbar', first.figure !== null, first.figure ? `${first.figure.n} Pixel` : 'nicht gefunden');
  });

  // ---------------------------------------------------------------- 2 movement
  await section('2 Bewegung', async () => {
    const right = await hold(['KeyD'], (p, b) => p.x - b.x > 1.0);
    const left = await hold(['KeyA'], (p, b) => p.x - b.x < -1.0);
    const up = await hold(['KeyW'], (p, b) => p.z - b.z < -0.6);
    await hold(['KeyS'], (p, b) => p.z - b.z > 0.6);
    record('2a D bewegt +X', right.dx > 0.8 && Math.abs(right.dz) < 0.05, `dx=${f(right.dx)}`);
    record('2b A bewegt -X', left.dx < -0.8 && Math.abs(left.dz) < 0.05, `dx=${f(left.dx)}`);
    record('2c W bewegt -Z', up.dz < -0.4 && Math.abs(up.dx) < 0.05, `dz=${f(up.dz)}`);
  });

  await section('2d Geschwindigkeit', async () => {
    // Open yard far west of the kiosk and clear of the crates (z < 0.15 - radius): the run must not touch any obstacle.
    await walkTo({ x: -10.5, z: -0.5 }, 30000);
    const straight = await measureSpeed(['KeyD']);
    await walkTo({ x: -10.5, z: -0.5 }, 30000);
    const diag = await measureSpeed(['KeyW', 'KeyD']);
    const within = (v) => Math.abs(v - PLAYER_SPEED) <= PLAYER_SPEED * 0.03;
    const ratio = diag.speed / straight.speed;
    record('2d Diagonale = gleiche Geschwindigkeit wie geradeaus (±3 %)', Math.abs(ratio - 1) <= 0.03 && diag.dx > 0 && diag.dz < 0, `gerade ${f(straight.speed)} m/s, diagonal ${f(diag.speed)} m/s, Verhältnis ${f(ratio)}; Simulationszeit ${f(straight.seconds)}/${f(diag.seconds)} s`);
    record('2e Geradeaus ~3,5 m/s (±3 %, Simulationszeit)', within(straight.speed) && straight.dx > 0 && Math.abs(straight.dz) < 0.02, `${f(straight.speed)} m/s`);
    record('2f Diagonal ~3,5 m/s (±3 %, Simulationszeit)', within(diag.speed), `${f(diag.speed)} m/s`);
    record('2g Diagonale: Komponenten gleich groß', Math.abs(Math.abs(diag.dx) - Math.abs(diag.dz)) <= 0.03 * Math.hypot(diag.dx, diag.dz), `dx=${f(diag.dx)} dz=${f(diag.dz)}`);
  });

  // ---------------------------------------------------------------- 3 camera
  await section('3 Kamera', async () => {
    // Waypoint west of the kiosk first: a pure diagonal from the yard can wedge the player in the building's NW corner.
    await walkTo({ x: -6, z: 3.6 });
    await walkTo({ x: 0.9, z: 3.6 });
    await sleep(900);
    const before = await analyse();
    const xBefore = (await pos()).x;
    await walkTo({ x: 6.9, z: 3.6 });
    await sleep(1200);
    const after = await analyse();
    const moved = (await pos()).x - xBefore;
    const shift = before.figure && after.figure ? Math.hypot(after.figure.x - before.figure.x, after.figure.y - before.figure.y) : Infinity;
    record('3 Kamera folgt (Figur bleibt im gleichen Bildbereich)', moved > 5 && shift < 40, `Welt ${f(moved)} m verschoben, Figur im Bild ${f(shift)} px verschoben`);
  });

  // ---------------------------------------------------------------- 4 collision with the wall / closed door
  await section('4 Wand/Tür', async () => {
    await walkTo({ x: 0.9, z: 3.6 });
    const wall = await holdUntilStopped(['KeyW'], null);
    record('4a Kollision: Wand stoppt Lauf nach Norden', wall.pos.z > 2 + 0.3 - 0.01 && wall.pos.z < 2.5, `z=${f(wall.pos.z)}`);
    await walkTo({ x: 2.0, z: 3.2 });
    const door = await holdUntilStopped(['KeyW'], null);
    record('4b Kollision: geschlossene Tür blockiert', !(await st()).kiosk.doorOpen && door.pos.z > 2 + 0.3 - 0.01, `z=${f(door.pos.z)}`);
  });

  // ---------------------------------------------------------------- 5 door interaction
  await section('5 Tür', async () => {
    const text1 = await promptText();
    const doorPos = await pos();
    const promptBox = await page.evaluate(() => {
      const r = document.querySelector('.ui-prompt').getBoundingClientRect();
      return { visible: r.width > 0 && r.height > 0 };
    });
    record('5a Prompt „Tür öffnen" sichtbar nahe der Tür', text1 === 'Tür öffnen' && promptBox.visible && Math.hypot(doorPos.x - 2, doorPos.z - 2) <= 1.4, `Text=${JSON.stringify(text1)}`);
    await pressE();
    const text2 = await promptText();
    record('5b E öffnet die Tür, Prompt wechselt zu „Tür schließen"', (await st()).kiosk.doorOpen === true && text2 === 'Tür schließen', `Text=${JSON.stringify(text2)}`);
    const inside = await hold(['KeyW'], (p) => p.z < 1.2, 6000);
    record('5c Durch die offene Tür in den Innenraum (z < 2)', inside.after.z < 1.7, `z=${f(inside.after.z)}`);
  });

  // ---------------------------------------------------------------- 6 shutter from inside behind the counter
  await section('6 Klappe', async () => {
    const counter = footprint(placementOf('placement.counter'));
    const shelf = footprint(placementOf('placement.middle-shelf'));
    const aisleZ = (shelf.maxZ + counter.minZ) / 2;
    await walkTo({ x: 2.0, z: 0.5 });
    const behind = await walkTo({ x: -1.0, z: aisleZ });
    const text3 = await promptText();
    await pressE();
    const text4 = await promptText();
    record('6 Verkaufsklappe von innen hinter der Theke', behind.z < 1.0 && text3 === 'Verkaufsklappe öffnen' && (await st()).kiosk.shutterOpen === true && text4 === 'Verkaufsklappe schließen', `${JSON.stringify(text3)} -> ${JSON.stringify(text4)}`);
  });

  // Walk around to the back of the kiosk (door stays open) for the persistence check.
  await section('6b Umrunden', async () => {
    const back = await walkVia([{ x: 2.0, z: 0.8 }, { x: 2.0, z: 3.2 }, { x: 4.8, z: 3.2 }, { x: 4.8, z: -4.2 }, { x: 0.0, z: -4.2 }]);
    record('6b Kiosk umrundet, Spieler steht hinter dem Kiosk', back.z < -3.9 && Math.abs(back.x) < 0.3, `x=${f(back.x)} z=${f(back.z)}`);
  });

  // ---------------------------------------------------------------- 7 persistence
  await section('7 Reload', async () => {
    const saved = await st();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // flush autosave like a real unload
    await page.reload();
    await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
    await waitSteps(30, 15000);
    const restored = await st();
    const noticeShown = await page.evaluate(() => window.__notices.includes('Spielstand geladen'));
    record(
      '7 Reload stellt Position und Tür/Klappe wieder her',
      Math.hypot(restored.player.position.x - saved.player.position.x, restored.player.position.z - saved.player.position.z) < 0.05 &&
        restored.kiosk.doorOpen === saved.kiosk.doorOpen && restored.kiosk.shutterOpen === saved.kiosk.shutterOpen &&
        restored.kiosk.doorOpen && restored.kiosk.shutterOpen && noticeShown,
      `x=${f(restored.player.position.x)} z=${f(restored.player.position.z)}, Hinweis „Spielstand geladen" ${noticeShown ? 'sichtbar' : 'fehlt'}`,
    );
  });

  // ---------------------------------------------------------------- 9a placements in the scene
  await section('9a Platzierungen', async () => {
    const out = await page.evaluate((ids) => ids.map((id) => ({ id, t: window.__buedchen.world.getPlacementTransform(id) })), placements.map((p) => p.id));
    const bad = [];
    for (const p of placements) {
      const t = out.find((o) => o.id === p.id)?.t;
      if (!t) { bad.push(`${p.id}: fehlt in der Szene`); continue; }
      let dRot = Math.abs(t.rotationDeg - p.rotation) % 360;
      dRot = Math.min(dRot, 360 - dRot);
      const dPos = Math.max(Math.abs(t.x - p.position.x), Math.abs(t.z - p.position.z));
      const dY = Math.abs(t.y - baseHeight(p));
      if (dPos > 0.01 || dRot > 0.5 || dY > 0.01) bad.push(`${p.id}: Δpos=${f(dPos)} Δrot=${f(dRot)} Δy=${f(dY)}`);
    }
    const supported = placements.filter((p) => p.on !== undefined);
    record(`9a Alle ${placements.length} Platzierungen in der Szene an Position/Rotation (1 cm / 0,5°), ${supported.length} gestützte auf Trägerhöhe`, bad.length === 0, bad.join('; '));
  });

  // ---------------------------------------------------------------- figure views / kiosk visibility
  const visibility = () => page.evaluate(() => window.__buedchen.world.getKioskVisibility());
  const settled = async (expectInside) => {
    // The cutaway needs 0.2 s; wait until the visibility matches and a few more frames passed.
    const ok = await waitUntil(async () => ((await visibility()).roof === !expectInside ? true : null), 8000);
    await waitSteps(20);
    return ok !== null;
  };
  const figureCheck = async (kind) => {
    const { screen, region } = await figureBox();
    const [n] = await countPixels([region], kind);
    return { n, screen };
  };

  await section('9d hinten', async () => {
    // Player stands behind the kiosk (restored by the reload): building opaque, figure as silhouette.
    const p = await pos();
    await settled(false);
    const v = await visibility();
    const sil = await figureCheck('silhouette');
    const blue = await figureCheck('blue');
    record('9d1 Hinter dem Kiosk: Figur als Silhouette erkennbar', Math.hypot(p.x, p.z + 4.2) < 0.3 && sil.n >= 800, `${sil.n} Silhouetten-Pixel, ${blue.n} Jacken-Pixel`);
    record('9d2 Hinter dem Kiosk: Dach und Südwand vollständig sichtbar (Gebäude deckend)', v.roof && v.southUpper && v.eastUpper && v.westUpper && v.lowerWalls, JSON.stringify(v));
  });

  await section('9d seitlich', async () => {
    await walkVia([{ x: -6, z: -4.2 }, { x: -6, z: -0.3 }, { x: -3.5, z: -0.3 }]);
    await settled(false);
    const v = await visibility();
    const blue = await figureCheck('blue');
    record('9d3 Seitlich (West, neben den Kisten): Figur erkennbar, Gebäude deckend', blue.n >= 500 && v.roof && v.southUpper, `${blue.n} Jacken-Pixel, ${JSON.stringify(v)}`);
    const silC = await figureCheck('silhouette');
    const silOn = await page.evaluate(() => window.__buedchen.world.isSilhouetteVisible());
    record('9d3b Seitlich neben den Kisten: keine Silhouette (nur Möbel/Kisten verdecken)', !silOn && silC.n < 60, `${silC.n} Silhouetten-Pixel, sichtbar=${silOn}`);
  });

  // ---------------------------------------------------------------- 9b collision follows the layout data
  /** Walks into a placement from a start point and verifies the player circle stops exactly at its footprint. */
  const collideCheck = async (label, id, keys, start, waypoints) => {
    const rect = footprint(placementOf(id));
    const reached = await walkVia([...waypoints, start], 0.15);
    const startDist = Math.hypot(reached.x - start.x, reached.z - start.z);
    // The approach must run toward the footprint: lateral position inside the footprint's extent on the other axis.
    const vertical = keys[0] === 'KeyW' || keys[0] === 'KeyS';
    const lateralOk = vertical ? reached.x >= rect.minX && reached.x <= rect.maxX : reached.z >= rect.minZ && reached.z <= rect.maxZ;
    const run = await holdUntilStopped(keys, rect);
    const moved = Math.hypot(run.pos.x - reached.x, run.pos.z - reached.z);
    const ok = startDist < 0.6 && lateralOk && run.stopped && moved > 0.3 && run.min >= PLAYER_RADIUS - 0.01 && run.finalDist <= PLAYER_RADIUS + 0.02;
    record(`9b ${label}: Spielerkreis stoppt am Footprint (${id})`, ok, `Start ${f(startDist)} m neben Soll, ${f(moved)} m gelaufen, Abstand Mitte→Rand min ${f(run.min)} / Ende ${f(run.finalDist)} (Radius ${PLAYER_RADIUS}), Rect x ${f(rect.minX)}..${f(rect.maxX)} z ${f(rect.minZ)}..${f(rect.maxZ)}, gestoppt=${run.stopped}`);
  };

  await section('9b Kisten außen', async () => {
    const rect = footprint(placementOf('placement.returns-yard'));
    const cz = (rect.minZ + rect.maxZ) / 2;
    // From the west toward the crates against the west wall.
    await collideCheck('Kisten außen (von Westen)', 'placement.returns-yard', ['KeyD'], { x: rect.minX - 2.5, z: cz }, [{ x: -6, z: -0.3 }, { x: -6, z: cz }]);
  });

  await section('9c Front + Klappenmarker außen', async () => {
    // Front of the kiosk at the sales window: figure unoccluded, marker visible with shutter open and closed.
    await residentsAway();
    const sw = data.layout.interactionPoints.find((p) => p.id === 'interaction.shutter');
    await walkVia([{ x: -6, z: 0.6 }, { x: -6, z: 3.4 }, { x: sw.position.x, z: 2.9 }]);
    await settled(false);
    const blue = await figureCheck('blue');
    const v = await visibility();
    record('9d4 Vor dem Kiosk: Figur erkennbar, Gebäude deckend', blue.n >= 500 && v.roof && v.southUpper, `${blue.n} Jacken-Pixel`);
    await markerCheck('außen', true);
    await markerCheck('außen', false);
  });

  await section('9c Innen + Klappenmarker innen', async () => {
    await residentsAway();
    await walkVia([{ x: 2.0, z: 3.2 }, { x: 2.0, z: 0.8 }]);
    const counter = footprint(placementOf('placement.counter'));
    const shelf = footprint(placementOf('placement.middle-shelf'));
    const aisle = { x: (shelf.minX + shelf.maxX) / 2, z: (shelf.maxZ + counter.minZ) / 2 };
    // Free spot between furniture: the aisle between middle shelf and counter must be walkable.
    const clear = placements
      .filter((p) => p.on === undefined && (p.collides ?? data.assets[p.assetId].collides))
      .every((p) => {
        const r = footprint(p);
        const dx = aisle.x - Math.min(Math.max(aisle.x, r.minX), r.maxX);
        const dz = aisle.z - Math.min(Math.max(aisle.z, r.minZ), r.maxZ);
        return Math.hypot(dx, dz) >= PLAYER_RADIUS;
      });
    const arrived = await walkTo(aisle, 15000, 0.12);
    record('9b5 Freie Stelle zwischen den Möbeln (Gang Mittelregal/Theke) ist begehbar', clear && Math.hypot(arrived.x - aisle.x, arrived.z - aisle.z) < 0.2, `Soll x=${f(aisle.x)} z=${f(aisle.z)}, erreicht x=${f(arrived.x)} z=${f(arrived.z)}`);
    await settled(true);
    const blue = await figureCheck('blue');
    const v = await visibility();
    record('9d5 Innen: Figur erkennbar', blue.n >= 500, `${blue.n} Jacken-Pixel`);
    const silI = await figureCheck('silhouette');
    record('9d5b Innen: keine Silhouette', silI.n < 60 && !(await page.evaluate(() => window.__buedchen.world.isSilhouetteVisible())), `${silI.n} Silhouetten-Pixel`);
    record('9d6 Innen: Dach ausgeblendet, obere Südwand ausgeblendet, untere Wand sichtbar', !v.roof && !v.southUpper && v.lowerWalls, JSON.stringify(v));
    await markerCheck('innen', false);
    await markerCheck('innen', true);
  });

  await section('9b Möbel innen', async () => {
    const shelfRect = footprint(placementOf('placement.middle-shelf'));
    const shelfCz = (shelfRect.minZ + shelfRect.maxZ) / 2;
    const fridge = footprint(placementOf('placement.fridge'));
    const freezer = footprint(placementOf('placement.freezer'));
    const fridgeCx = (fridge.minX + fridge.maxX) / 2;
    const freezerCz = (freezer.minZ + freezer.maxZ) / 2;
    const counter = footprint(placementOf('placement.counter'));
    const aisleZ = (shelfRect.maxZ + counter.minZ) / 2;
    await collideCheck('Mittelregal (von Osten)', 'placement.middle-shelf', ['KeyA'], { x: shelfRect.maxX + 1.6, z: shelfCz }, [{ x: shelfRect.maxX + 1.6, z: aisleZ }]);
    await collideCheck('Kühlschrank (von Süden)', 'placement.fridge', ['KeyW'], { x: fridgeCx, z: fridge.maxZ + 1.2 }, [{ x: fridgeCx, z: aisleZ }]);
    await collideCheck('Truhe (von Westen)', 'placement.freezer', ['KeyD'], { x: freezer.minX - 1.2, z: freezerCz }, [{ x: freezer.minX - 1.2, z: aisleZ }]);
  });

  /** Shutter marker: ring and gem project into the view and show marker-coloured pixels around their position. */
  async function markerCheck(where, shutterOpen) {
    // Bring the shutter into the wanted state with the real E key (needs the interaction to be available).
    if ((await st()).kiosk.shutterOpen !== shutterOpen) {
      const available = await waitUntil(async () => (await page.evaluate(() => window.__buedchen.world.getMarkerInfo('interaction.shutter')))?.highlighted, 4000);
      if (!available) throw new Error('Klappen-Interaktion an dieser Stelle nicht verfügbar');
      await pressE();
    }
    await waitSteps(30);
    await settled(where === 'innen');
    const state = (await st()).kiosk.shutterOpen;
    await waitUntil(async () => (await page.evaluate(() => window.__buedchen.world.getMarkerInfo('interaction.shutter')))?.highlighted, 3000);
    const info = await page.evaluate(() => window.__buedchen.world.getMarkerInfo('interaction.shutter'));
    const off = await canvasOffset();
    const around = (p) => ({ x0: off.x + p.x - 26, x1: off.x + p.x + 26, y0: off.y + p.y - 26, y1: off.y + p.y + 26 });
    const [ringPx, gemPx] = await countPixels([around(info.ring), around(info.gem)], 'marker');
    const label = `${where}, Klappe ${shutterOpen ? 'offen' : 'geschlossen'}`;
    record(
      `9e Klappenmarker sichtbar (${label})`,
      state === shutterOpen && info.highlighted && info.ring.visible && info.gem.visible && ringPx >= 10 && gemPx >= 60,
      `Klappe ${state ? 'offen' : 'zu'}, hervorgehoben=${info.highlighted}, Ring (${Math.round(info.ring.x)},${Math.round(info.ring.y)}) ${ringPx} Px, Edelstein (${Math.round(info.gem.x)},${Math.round(info.gem.y)}) ${gemPx} Px`,
    );
  }

  // Console errors / lost contexts of the main page so far are reported at the end (check 8).
  if (runOld) {
    const lost = pageGone ? null : await page.evaluate(() => window.__ctxLost).catch(() => null);
    record('8b WebGL-Kontext nie verloren', lost === 0, lost === null ? 'nicht lesbar' : `${lost} Ereignisse`);
  }

  expectClose = true;
  await context.close();
  expectClose = false;

  // ---------------------------------------------------------------- screenshots (deviceScaleFactor 2)
  // Each in a fresh context that starts from a save file: the pose is set via localStorage, everything else is the real app.
  // Software-GL at deviceScaleFactor 2 occasionally needs very long for one frame: retry the capture itself.
  const capture = async (p, file, dir = shotDir) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await p.screenshot({ path: path.join(dir, file), timeout: 60000 });
        return;
      } catch (error) {
        if (attempt >= 3) throw error;
        console.log(`info: screenshot ${file} attempt ${attempt} failed (${String(error.message).split('\n')[0]}), retrying`);
      }
    }
  };
  const shoot = async (file, poseState, expect) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    watch(p, file);
    await p.addInitScript(initScript);
    await p.addInitScript((s) => {
      localStorage.setItem('buedchensim.save.slot1', JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), state: s }));
    }, { regionId: 'region.ruhrgebiet', ...poseState });
    try {
      await p.goto(url);
      await p.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
      // Settled: >= 2 simulated seconds, cutaway state final, the "Spielstand geladen" notice gone.
      await p.waitForFunction(() => window.__buedchen.world.getSimStats().seconds > 2, null, { timeout: 30000 });
      await p.waitForFunction((inside) => window.__buedchen.world.getKioskVisibility().roof === !inside, expect.inside, { timeout: 30000 });
      await p.waitForFunction(() => document.querySelectorAll('.ui-notice').length === 0, null, { timeout: 30000 });
      await sleep(800);
      const prompt = await p.evaluate(() => {
        const el = document.querySelector('.ui-prompt');
        return el && !el.hidden ? el.textContent : null;
      });
      const v = await p.evaluate(() => window.__buedchen.world.getKioskVisibility());
      await capture(p, file);
      const wantPrompt = expect.prompt ? prompt !== null : true;
      record(`Screenshot ${file} geschrieben (Kiosk-Sicht ${v.roof ? 'Dach sichtbar' : 'Dach weg'}${prompt ? `, Prompt ${JSON.stringify(prompt)}` : ''})`, wantPrompt && v.roof === !expect.inside);
    } finally {
      expectClose = true;
      await ctx.close();
      expectClose = false;
    }
  };
  if (runOld) await shoot('auftrag-03-ansicht-aussen.png', { player: { position: { x: 1.7, z: 3.1 }, heading: Math.PI }, kiosk: { doorOpen: false, shutterOpen: true } }, { inside: false, prompt: true });
  if (runOld) await shoot('auftrag-03-ansicht-innen.png', { player: { position: { x: 0.6, z: -0.3 }, heading: Math.PI }, kiosk: { doorOpen: true, shutterOpen: true } }, { inside: true });
  if (runOld) await shoot('auftrag-03-ansicht-rueckseite.png', { player: { position: { x: 0, z: -4.2 }, heading: 0 }, kiosk: { doorOpen: false, shutterOpen: false } }, { inside: false });
  if (runOld) await shoot('auftrag-03-ansicht-seite.png', { player: { position: { x: -3.5, z: -0.3 }, heading: Math.PI }, kiosk: { doorOpen: false, shutterOpen: true } }, { inside: false });
  // ================================================================ economy / UI flow (Auftrag 03)
  // Drives the REAL UI (clicks on data-testids, real key presses). The debug hook is used only for reading state, for
  // the sim clock and for seeding saves (teleport/clock position); no economy action is performed through it
  // (exception: the stocking of the screenshot scene, see E13).
  const eur = (c) => {
    const a = Math.abs(c);
    return `${c < 0 ? '-' : ''}${String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(a % 100).padStart(2, '0')} €`;
  };
  const eurSigned = (c) => (c > 0 ? `+${eur(c)}` : eur(c));
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const tid = (id) => page.locator(`[data-testid="${id}"]`);
  const txt = async (id) => norm(await tid(id).first().textContent());
  const vis = (id, timeout = 5000) => tid(id).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  const gone = (id, timeout = 5000) => tid(id).first().waitFor({ state: 'hidden', timeout }).then(() => true, () => false);
  const attr = (id, name) => tid(id).first().getAttribute(name);
  const eco = async () => (await st()).economy;
  const econKey = async () => {
    const s = await st();
    const e = s.economy;
    return JSON.stringify({ c: e.cashCents, st: e.storage, sh: e.shelves, p: e.pendingDelivery, t: e.today, n: e.transactions.length, cal: [s.calendar.day, s.calendar.phase] });
  };
  const shelfSum = (e, pid) => Object.values(e.shelves).filter((s) => s.productId === pid).reduce((a, s) => a + s.quantity, 0);
  const stockInfo = () => page.evaluate(() => window.__buedchen.world.getStockInfo());
  const instancesOf = (info, pid) => info.slots.filter((s) => s.productId === pid).reduce((a, s) => a + s.instances, 0);
  const panelOpen = () => page.evaluate(() => window.__buedchen.ui.currentPanel());
  const messageText = async (id) => ((await vis(id, 3000)) ? txt(id) : null);

  const P = data.products;
  const ID = {
    chips: 'product.naschwerk-chips-paprika',
    nuts: 'product.naschwerk-erdnuesse',
    limo: 'product.ruhrbrause-zitronenlimo',
    pils: 'product.puettbraeu-pils',
    ice: 'product.eiskumpel-stieleis-himbeere',
    filter: 'product.zechenhof-filter-20',
  };
  const ORDER = { [ID.chips]: 6, [ID.nuts]: 4, [ID.limo]: 8, [ID.pils]: 10, [ID.ice]: 5 };
  const orderUnits = Object.values(ORDER).reduce((a, b) => a + b, 0);
  const orderTotal = Object.entries(ORDER).reduce((a, [id, q]) => a + q * P[id].purchasePriceCents, 0);
  const START_CASH = 30000;
  const sales = []; // successful UI sales: { id, q }
  let ctxLostTotal = 0;
  let ecoCtx = null;
  let shelfSnapshot = null;

  const reload = async (flush = true) => {
    ctxLostTotal += await page.evaluate(() => window.__ctxLost);
    if (flush) await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
    await waitSteps(30, 15000);
  };
  /** Stores the current save with `patch` merged into its state and reloads the page; the seed passes through parseSave. */
  const seedSave = async (patch) => {
    await page.evaluate((patch) => {
      const save = window.__buedchen.game.save();
      const merge = (t, p) => {
        for (const [k, v] of Object.entries(p)) {
          if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object') merge(t[k], v);
          else t[k] = v;
        }
      };
      merge(save.state, patch);
      window.sessionStorage.setItem('__seed', JSON.stringify(save));
    }, patch);
    await reload(false);
  };
  const newEcoPage = async (label, scale = 1, extraInit = null) => {
    ecoCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
    page = await ecoCtx.newPage();
    watch(page, label);
    await page.addInitScript(initScript);
    if (extraInit) await page.addInitScript(extraInit);
    await page.goto(url);
    await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
    await waitSteps(10, 15000);
  };
  const closeEcoCtx = async () => {
    if (!ecoCtx) return;
    ctxLostTotal += await page.evaluate(() => window.__ctxLost).catch(() => 0);
    expectClose = true;
    await ecoCtx.close();
    expectClose = false;
    ecoCtx = null;
  };
  const minutesOfHud = async () => {
    const m = /^(\d\d):(\d\d)$/.exec(await txt('hud-clock'));
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const setOrderQty = async (id, q) => {
    const loc = tid(`order-qty-${id}`);
    await loc.fill(String(q));
    await loc.press('Enter');
    await waitUntil(async () => (await tid(`order-qty-${id}`).inputValue()) === String(q), 3000);
  };
  const clickN = async (id, n) => {
    for (let i = 0; i < n; i += 1) await tid(id).click();
  };
  const buf = () => page.screenshot();
  /** Number of clearly different pixels (any channel > 40) below the HUD strip between two screenshots. */
  const pixelDiff = async (a, b) => {
    // The player figure, its marker and prompt animate on their own: the region around the figure is excluded.
    const fig = await figureBox();
    const ex = { x0: fig.screen.x - 160, x1: fig.screen.x + 160, y0: fig.screen.y - 260, y1: fig.screen.y + 160 };
    return page.evaluate(async ({ a, b, ex }) => {
      const load = async (s) => {
        const img = new Image();
        img.src = `data:image/png;base64,${s}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const A = await load(a);
      const B = await load(b);
      let n = 0;
      for (let y = 120; y < A.height - 10; y += 1) {
        for (let x = 0; x < A.width; x += 1) {
          const i = (y * A.width + x) * 4;
          if (x >= ex.x0 && x <= ex.x1 && y >= ex.y0 && y <= ex.y1) continue;
          if (Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])) > 40) n += 1;
        }
      }
      return n;
    }, { a: a.toString('base64'), b: b.toString('base64'), ex });
  };

  /** Takes screenshots until two consecutive ones barely differ; returns the last one and the final difference. */
  const settledShot = async () => {
    let prev = await buf();
    let diff = Infinity;
    for (let i = 0; i < 20 && diff > 300; i += 1) {
      await sleep(500);
      const next = await buf();
      diff = await pixelDiff(prev, next);
      prev = next;
    }
    return { shot: prev, diff };
  };

  let pxBefore = null;
  let pxControl = 0;

  if (runEconomy) await newEcoPage('eco');

  // ---------------------------------------------------------------- E1 HUD at the start
  await section('E1 HUD', async () => {
    const minutes = await minutesOfHud();
    const day = await txt('hud-day');
    const cash = await txt('hud-cash');
    const status = await txt('hud-status');
    const open = await attr('hud-status', 'data-open');
    const s = await st();
    record('E1a HUD: „Mo · Tag 1“, Uhr ab 06:00 (noch am Morgen), Startkasse 300,00 €', day === 'Mo · Tag 1' && minutes >= 360 && minutes <= 375 && cash === eur(START_CASH) && s.economy.cashCents === START_CASH, `${day}, ${await txt('hud-clock')}, ${cash}`);
    record('E1b HUD: Status „Geschlossen“ bei geschlossener Klappe, Tempo 1× aktiv, nicht pausiert', status === 'Geschlossen' && open === 'false' && !s.kiosk.shutterOpen && (await attr('hud-speed-1', 'aria-pressed')) === 'true' && (await attr('hud-pause', 'data-paused')) === 'false', `${status}`);
  });

  // ---------------------------------------------------------------- E1c place-bound panels: no HUD buttons, nothing at the spawn
  await section('E1c Platzbindung am Start', async () => {
    const hudButtons = await page.evaluate(() => [...document.querySelectorAll('.ui-hud [data-testid]')].map((n) => n.getAttribute('data-testid')));
    const tillGoods = await page.locator('[data-testid="hud-open-till"], [data-testid="hud-open-goods"]').count();
    record('E1c HUD hat keine Kassen-/Waren-Knöpfe (nur Tempo, Pause, Tagesabschluss)', tillGoods === 0 && hudButtons.includes('hud-close-day') && hudButtons.includes('hud-pause'), hudButtons.join(', '));
    const at = await pos();
    const k = await econKey();
    const promptAtSpawn = await promptText();
    await pressE();
    const s = await st();
    record('E1d Auf dem Gehweg (Spawn): kein Prompt, E öffnet weder Kasse noch Lager noch sonst ein Panel, nichts ändert sich', promptAtSpawn === null && (await panelOpen()) === null && (await econKey()) === k && s.kiosk.doorOpen === false && s.kiosk.shutterOpen === false, `Prompt ${JSON.stringify(promptAtSpawn)}, Position ${f(at.x)}/${f(at.z)}, Panel ${await panelOpen()}`);
    record('E1e HUD zeigt am ersten Tag den Montag („Mo · Tag 1“)', (await txt('hud-day')) === 'Mo · Tag 1' && s.calendar.day === 1, await txt('hud-day'));
  });

  // ---------------------------------------------------------------- E2 walk to storage, panel opens, input locked
  await section('E2 Lager-Interaktion', async () => {
    await walkVia([{ x: 2.0, z: 3.2 }]);
    const doorPrompt = await promptText();
    await pressE();
    record('E2a Tür per E geöffnet (Prompt „Tür öffnen“)', doorPrompt === 'Tür öffnen' && (await st()).kiosk.doorOpen === true, `Prompt ${JSON.stringify(doorPrompt)}`);
    const at = await walkVia([{ x: 2.0, z: 0.5 }, { x: 1.75, z: 0.5 }, { x: 1.75, z: -1.0 }], 0.12);
    const prompt = await promptText();
    record('E2b Am Lagerpunkt (1,75 / -1,0): Prompt sichtbar', prompt !== null && Math.hypot(at.x - 1.75, at.z + 1.0) < 0.2, `Prompt ${JSON.stringify(prompt)}, Position ${f(at.x)}/${f(at.z)}`);
    await pressE();
    const opened = await vis('panel-goods');
    record('E2c E am Lagerpunkt öffnet das Warenpanel', opened && (await panelOpen()) === 'goods' && (await promptText()) === null, `Panel ${await panelOpen()}`);
    // Held movement keys must not move the player while the panel is open.
    const before = await pos();
    for (const k of ['KeyS', 'KeyD']) await page.keyboard.down(k);
    await waitSteps(60);
    const mid = await pos();
    for (const k of ['KeyS', 'KeyD']) await page.keyboard.up(k);
    await waitSteps(5);
    record('E2d Bei offenem Panel bewegen gehaltene Tasten (S, D) den Spieler nicht', Math.hypot(mid.x - before.x, mid.z - before.z) < 0.001, `Δ=${f(Math.hypot(mid.x - before.x, mid.z - before.z))} m`);
    await page.keyboard.press('Escape');
    const closed = await gone('panel-goods');
    const run = await hold(['KeyS'], (p, b) => p.z - b.z > 0.5, 5000);
    record('E2e Escape schließt das Panel; danach bewegt S den Spieler wieder', closed && (await panelOpen()) === null && run.dz > 0.4, `Δz=${f(run.dz)}`);
    await walkTo({ x: 1.75, z: 0.5 });
    await walkTo({ x: 1.75, z: -1.0 });
    const storagePrompt = await promptText();
    await page.locator('.ui-prompt').click();
    const clickOpened = await vis('panel-goods');
    record('E2f Lagerpunkt: Prompt „Lager öffnen“; ein Klick auf den Prompt öffnet das Warenpanel wie E', storagePrompt === 'Lager öffnen' && clickOpened && (await panelOpen()) === 'goods', `Prompt ${JSON.stringify(storagePrompt)}, Panel ${await panelOpen()}`);
    await page.keyboard.press('Escape');
    await gone('panel-goods');
    // Reference screenshots (empty shelves) for the later sanity check; control = same view a moment later.
    await waitUntil(async () => !(await visibility()).roof, 8000);
    await page.waitForFunction(() => document.querySelectorAll('.ui-notice').length === 0, null, { timeout: 10000 }).catch(() => undefined);
    // The camera eases toward the player: wait until two consecutive frames of the interior are practically identical.
    const stable = await settledShot();
    pxBefore = stable.shot;
    pxControl = stable.diff;
    const ctl = stable.shot;
    if (process.env.BC_DEBUG) { writeFileSync(path.join(process.env.BC_DEBUG, 'before.png'), pxBefore); writeFileSync(path.join(process.env.BC_DEBUG, 'control.png'), ctl); }
  });

  // ---------------------------------------------------------------- E3 order
  await section('E3 Bestellung', async () => {
    await pressE();
    if (!(await vis('panel-goods'))) throw new Error('Warenpanel öffnet nicht');
    await tid('goods-tab-order').click();
    // (a) above the available cash -> rejected visibly, nothing changes (no order pending yet)
    const k0 = await econKey();
    await setOrderQty(ID.filter, 41);
    const tooMuch = 41 * P[ID.filter].purchasePriceCents;
    await waitUntil(async () => (await txt('order-total')) === eur(tooMuch), 3000);
    const cashAfterText = await txt('order-cash-after');
    await tid('order-submit').click();
    const msg1 = await messageText('goods-message');
    record('E3a Bestellung über dem Kassenbestand wird sichtbar abgelehnt, nichts ändert sich', tooMuch > START_CASH && msg1 !== null && /Nicht genug Geld/.test(msg1) && (await econKey()) === k0 && (await txt('hud-cash')) === eur(START_CASH) && cashAfterText === eur(START_CASH - tooMuch), `Summe ${eur(tooMuch)}, Rest ${cashAfterText}, Meldung ${JSON.stringify(msg1)}`);
    await setOrderQty(ID.filter, 0);
    // (b) normal order: shelf, cooled, age-restricted, frozen
    await setOrderQty(ID.chips, ORDER[ID.chips]); // fill + Enter
    await clickN(`order-inc-${ID.nuts}`, ORDER[ID.nuts]); // real clicks
    await setOrderQty(ID.limo, ORDER[ID.limo]);
    await setOrderQty(ID.pils, ORDER[ID.pils]);
    await clickN(`order-inc-${ID.ice}`, ORDER[ID.ice]);
    const okTotal = await waitUntil(async () => (await txt('order-total')) === eur(orderTotal), 3000);
    const unitsText = await txt('order-units');
    record('E3b Angezeigte Bestellsumme = Summe aus Produktdaten (Cent → Euro)', okTotal !== null && unitsText === String(orderUnits), `${await txt('order-total')} erwartet ${eur(orderTotal)}, ${unitsText} Stück`);
    await tid('order-submit').click();
    await waitUntil(async () => (await eco()).pendingDelivery !== null, 4000);
    const e1 = await eco();
    const lines = Object.fromEntries((e1.pendingDelivery?.lines ?? []).map((l) => [l.productId, l.quantity]));
    record('E3c Kasse sinkt um genau die Summe; Lieferung offen (State, HUD, Lieferansicht)', e1.cashCents === START_CASH - orderTotal && JSON.stringify(lines) === JSON.stringify(ORDER) && e1.pendingDelivery.totalCents === orderTotal && (await txt('hud-cash')) === eur(START_CASH - orderTotal) && (await attr('goods-tab-delivery', 'aria-selected')) === 'true' && (await txt('delivery-total')) === eur(orderTotal) && (await page.locator('[data-testid^="delivery-row-"]').count()) === Object.keys(ORDER).length, `Kasse ${await txt('hud-cash')}, Lieferung ${await txt('delivery-total')}`);
    // (c) second order while pending
    await tid('goods-tab-order').click();
    const k1 = await econKey();
    await clickN(`order-inc-${ID.chips}`, 1);
    await tid('order-submit').click();
    const msg2 = await messageText('goods-message');
    record('E3d Zweite Bestellung bei offener Lieferung wird sichtbar abgelehnt, nichts ändert sich', msg2 !== null && /Lieferung offen/.test(msg2) && (await econKey()) === k1, `Meldung ${JSON.stringify(msg2)}`);
    await tid(`order-dec-${ID.chips}`).click();
  });

  // ---------------------------------------------------------------- E4 delivery
  await section('E4 Lieferung', async () => {
    await tid('goods-tab-delivery').click();
    const cash = (await eco()).cashCents;
    await tid('delivery-receive').click();
    await waitUntil(async () => (await eco()).pendingDelivery === null, 4000);
    const e = await eco();
    const storageOk = Object.entries(ORDER).every(([id, q]) => e.storage[id] === q) && Object.keys(e.storage).length === Object.keys(ORDER).length;
    record('E4a Lieferung angenommen: Lager = bestellte Mengen, Kasse unverändert, Lieferansicht leer', storageOk && e.cashCents === cash && (await vis('delivery-empty')), JSON.stringify(e.storage));
    await tid('goods-tab-stock').click();
    const shown = await Promise.all(Object.keys(ORDER).map(async (id) => [id, await txt(`stock-storage-${id}`), await txt(`stock-shelf-${id}`)]));
    record('E4b Bestandsansicht zeigt Lagermengen (Regal 0)', shown.every(([id, s, sh]) => s === String(ORDER[id]) && sh === '0'), shown.map((x) => `${x[1]}/${x[2]}`).join(' '));
  });

  // ---------------------------------------------------------------- E5 restock
  await section('E5 Einräumen', async () => {
    await tid('goods-tab-restock').click();
    // Compatibility offered by the UI: the first free shelf slot offers shelf products only.
    const shelfSlot = data.stockSlots.find((s) => s.accepts === 'shelf');
    await vis(`slot-product-${shelfSlot.id}`);
    const options = await tid(`slot-product-${shelfSlot.id}`).locator('option').evaluateAll((os) => os.map((o) => o.value));
    record('E5a Einräumen-Auswahl bietet nur kompatible Produkte an (Regalplatz: Regalware, keine Kühl-/Tiefkühlware)', options.includes(ID.chips) && options.includes(ID.pils) && !options.includes(ID.limo) && !options.includes(ID.ice), options.join(', '));
    const used = new Set();
    for (const [id, q] of Object.entries(ORDER)) {
      let remaining = q;
      for (const slot of data.stockSlots.filter((s) => s.accepts === P[id].storage && !used.has(s.id))) {
        if (remaining <= 0) break;
        if (!(await tid(`slot-row-${slot.id}`).count())) continue;
        await tid(`slot-product-${slot.id}`).selectOption(id);
        if (id === ID.pils && remaining === q) {
          const qty = tid(`slot-qty-${slot.id}`);
          await qty.fill('3'); // explicit quantity for the first pils slot
          await qty.press('Enter');
        }
        await tid(`slot-restock-${slot.id}`).click();
        const got = await waitUntil(async () => ((await eco()).shelves[slot.id]?.quantity ?? 0) > 0 || null, 1500);
        used.add(slot.id);
        if (got) remaining -= (await eco()).shelves[slot.id].quantity;
      }
    }
    const e = await eco();
    const shelvesOk = Object.entries(ORDER).every(([id, q]) => shelfSum(e, id) === q && e.storage[id] === undefined);
    const compat = Object.entries(e.shelves).every(([slotId, s]) => data.stockSlots.find((x) => x.id === slotId)?.accepts === P[s.productId].storage);
    record('E5b Alles eingeräumt: Regalstände = Bestellung, Lager leer, Produkte nur auf kompatiblen Plätzen', shelvesOk && compat && Object.keys(e.storage).length === 0, `${Object.keys(e.shelves).length} belegte Plätze`);
    const slotText = await Promise.all(Object.keys(e.shelves).slice(0, 2).map((sid) => txt(`slot-content-${sid}`)));
    record('E5c Einräumen-Ansicht zeigt die belegten Plätze mit Produkt und Menge', slotText.every((t) => /\d/.test(t)), slotText.join(' | '));
    // 3D stock follows the data
    const total = Object.values(e.shelves).reduce((a, s) => a + s.quantity, 0);
    await waitUntil(async () => (await stockInfo()).drawnInstances === total, 5000);
    const info = await stockInfo();
    const fp = data.layout.kiosk.footprint;
    const bad = [];
    for (const [slotId, s] of Object.entries(e.shelves)) {
      const si = info.slots.find((x) => x.slotId === slotId);
      if (!si || si.productId !== s.productId || si.quantity !== s.quantity || si.instances !== s.quantity) bad.push(`${slotId}: ${JSON.stringify(si)}`);
      else if (!si.firstUnit || si.firstUnit.x < fp.minX || si.firstUnit.x > fp.maxX || si.firstUnit.z < fp.minZ || si.firstUnit.z > fp.maxZ || si.firstUnit.y < 0.1 || si.firstUnit.y > 2.0) bad.push(`${slotId}: firstUnit ${JSON.stringify(si.firstUnit)}`);
    }
    const strayInstances = info.slots.filter((x) => !e.shelves[x.slotId] && x.instances > 0).length;
    record('E5d 3D-Bestand (getStockInfo): Instanzen = Menge je belegtem Platz, erste Einheit im Kiosk auf plausibler Höhe, leere Plätze ohne Instanzen', bad.length === 0 && strayInstances === 0 && info.drawnInstances === total && total === orderUnits, `${total} Instanzen, ${info.instancedMeshes} InstancedMeshes${bad.length ? `; ${bad.join('; ')}` : ''}`);
    // Visual sanity: the stocked interior differs from the empty one clearly more than two shots of the unchanged view.
    await page.keyboard.press('Escape');
    await gone('panel-goods');
    await page.waitForFunction(() => document.querySelectorAll('.ui-notice').length === 0, null, { timeout: 10000 }).catch(() => undefined);
    const afterStable = await settledShot();
    const afterShot = afterStable.shot;
    const diff = await pixelDiff(pxBefore, afterShot);
    pxControl = Math.max(pxControl, afterStable.diff);
    if (process.env.BC_DEBUG) writeFileSync(path.join(process.env.BC_DEBUG, 'after.png'), afterShot);
    record('E5e Bild: bestückter Innenraum unterscheidet sich deutlich vom leeren (Pixeldifferenz ≫ Kontrolle zweier Bilder derselben Ansicht)', diff >= 250 && diff > pxControl * 5 + 100, `Differenz ${diff} px, Kontrolle ${pxControl} px`);
  });

  // ---------------------------------------------------------------- E6 sale
  await section('E6 Verkauf', async () => {
    await walkVia([{ x: 1.75, z: 0.62 }, { x: -0.2, z: 0.62 }, { x: -0.2, z: 0.95 }], 0.12);
    const registerPrompt = await promptText();
    await pressE();
    if (!(await vis('panel-till'))) throw new Error('Kassenpanel öffnet nicht');
    record('E6g Kassenpunkt: Prompt „Kasse bedienen“, E öffnet das Kassenpanel', registerPrompt === 'Kasse bedienen' && (await panelOpen()) === 'till', `Prompt ${JSON.stringify(registerPrompt)}`);
    // (a) shutter still closed: rejected
    await clickN(`till-add-${ID.chips}`, 1);
    const k0 = await econKey();
    const warning = await vis('till-warning', 2000);
    await tid('till-submit').click();
    const msg = await messageText('till-message');
    record('E6a Verkauf bei geschlossener Klappe wird sichtbar abgelehnt, nichts ändert sich', warning && msg !== null && /Verkaufsklappe/.test(msg) && (await econKey()) === k0 && (await attr('hud-status', 'data-open')) === 'false', `Meldung ${JSON.stringify(msg)}`);
    await tid('till-cancel').click();
    await gone('panel-till');
    await page.locator('.ui-prompt').click();
    const tillByClick = await vis('panel-till');
    record('E6h Ein Klick auf den Prompt öffnet die Kasse wie E', tillByClick && (await panelOpen()) === 'till', `Panel ${await panelOpen()}`);
    await page.keyboard.press('Escape');
    await gone('panel-till');
    // open the shutter with the real E key at the shutter point
    const counter = footprint(placementOf('placement.counter'));
    const shelf = footprint(placementOf('placement.middle-shelf'));
    await walkTo({ x: -1.0, z: (shelf.maxZ + counter.minZ) / 2 });
    const shutterPrompt = await promptText();
    await pressE();
    await tid('hud-status').first().waitFor({ state: 'visible' });
    const opened = await waitUntil(async () => ((await attr('hud-status', 'data-open')) === 'true' ? true : null), 3000);
    record('E6b Klappe per E geöffnet: HUD-Status „Geöffnet“', shutterPrompt === 'Verkaufsklappe öffnen' && opened && (await txt('hud-status')) === 'Geöffnet' && (await st()).kiosk.shutterOpen === true, `Prompt ${JSON.stringify(shutterPrompt)}`);
    await walkTo({ x: -0.2, z: 0.95 });
    await pressE();
    if (!(await vis('panel-till'))) throw new Error('Kassenpanel öffnet nicht (2)');
    // (b) cancel with a filled cart changes nothing and drops the cart
    const k1 = await econKey();
    const info0 = await stockInfo();
    await clickN(`till-add-${ID.chips}`, 2);
    const cartTotal = 2 * P[ID.chips].suggestedPriceCents;
    const totalOk = await waitUntil(async () => (await txt('cart-total')) === eur(cartTotal), 3000);
    await tid('till-cancel').click();
    await gone('panel-till');
    const unchanged = (await econKey()) === k1;
    await pressE();
    await vis('panel-till');
    record('E6c Abbrechen mit gefülltem Warenkorb ändert nichts; Warenkorb ist danach leer', totalOk !== null && unchanged && (await vis('cart-empty', 2000)), `Warenkorb vorher ${eur(cartTotal)}`);
    // (c) sale of the normal product
    await clickN(`till-add-${ID.chips}`, 2);
    const e0 = await eco();
    await tid('till-submit').click();
    await waitUntil(async () => (await eco()).cashCents !== e0.cashCents, 4000);
    const e1 = await eco();
    const info1 = await stockInfo();
    sales.push({ id: ID.chips, q: 2 });
    record('E6d Verkauf Chips ×2: Kasse +Summe, Regalbestand −2, HUD-Kasse, 3D-Instanzen −2', e1.cashCents === e0.cashCents + cartTotal && shelfSum(e1, ID.chips) === shelfSum(e0, ID.chips) - 2 && (await txt('hud-cash')) === eur(e1.cashCents) && e1.today.revenueCents === cartTotal && e1.today.salesCount === 1 && info1.drawnInstances === info0.drawnInstances - 2 && instancesOf(info1, ID.chips) === instancesOf(info0, ID.chips) - 2, `Kasse ${await txt('hud-cash')}, Chips Regal ${shelfSum(e1, ID.chips)}, Instanzen ${instancesOf(info1, ID.chips)}`);
    const sold = await messageText('till-message');
    record('E6e Verkaufsbestätigung sichtbar, Warenkorb nach dem Verkauf leer', sold !== null && /Verkauf abgeschlossen/.test(sold) && (await vis('cart-empty', 2000)), JSON.stringify(sold));
  });

  // ---------------------------------------------------------------- E7 age check
  await section('E7 Altersprüfung', async () => {
    const pilsPrice = P[ID.pils].suggestedPriceCents;
    await clickN(`till-add-${ID.pils}`, 2);
    const box = tid('till-age-checkbox');
    const boxVisible = await vis('till-age-checkbox', 2000);
    const unchecked = !(await box.isChecked());
    const k0 = await econKey();
    const e0 = await eco();
    await tid('till-submit').click();
    const msg = await messageText('till-message');
    record('E7a Alterspflichtiger Warenkorb ohne Häkchen: Verkauf sichtbar abgelehnt, nichts ändert sich', boxVisible && unchecked && msg !== null && /Altersprüfung/.test(msg) && (await econKey()) === k0, `Meldung ${JSON.stringify(msg)}`);
    await box.check();
    await tid('till-submit').click();
    await waitUntil(async () => (await eco()).cashCents !== e0.cashCents, 4000);
    const e1 = await eco();
    sales.push({ id: ID.pils, q: 2 });
    record('E7b Mit Häkchen gelingt der Verkauf (Kasse +Summe, Regal −2)', e1.cashCents === e0.cashCents + 2 * pilsPrice && shelfSum(e1, ID.pils) === shelfSum(e0, ID.pils) - 2 && e1.today.salesCount === 2, `Kasse ${await txt('hud-cash')}`);
    // confirmation is not remembered: next restricted cart in the same panel, and after close/reopen
    await clickN(`till-add-${ID.pils}`, 1);
    const k1 = await econKey();
    const stillUnchecked = !(await tid('till-age-checkbox').isChecked());
    await tid('till-submit').click();
    const msg2 = await messageText('till-message');
    const rejected = msg2 !== null && /Altersprüfung/.test(msg2) && (await econKey()) === k1;
    await tid('till-age-checkbox').check();
    await page.keyboard.press('Escape');
    await gone('panel-till');
    await pressE();
    await vis('panel-till');
    await clickN(`till-add-${ID.pils}`, 1);
    const afterReopen = !(await tid('till-age-checkbox').isChecked());
    record('E7c Bestätigung wird nicht gemerkt: nach Verkauf und nach Schließen/Öffnen ist das Häkchen wieder leer, Verkauf ohne Häkchen abgelehnt', stillUnchecked && rejected && afterReopen, `nach Verkauf ${stillUnchecked}, abgelehnt ${rejected}, nach Neuöffnen ${afterReopen}`);
    await tid('till-cancel').click();
    await gone('panel-till');
  });

  // ---------------------------------------------------------------- E8 clock
  await section('E8 Uhr', async () => {
    const calendar = () => page.evaluate(() => ({ ...window.__buedchen.game.state.calendar }));
    const rate = (warm, win) =>
      page.evaluate(
        ({ warm, win }) =>
          new Promise((resolve, reject) => {
            const w = window.__buedchen.world;
            const g = window.__buedchen.game;
            const t0 = performance.now();
            const s0 = w.getSimStats().seconds;
            let a = null;
            const tick = () => {
              const s = w.getSimStats().seconds;
              const m = g.state.calendar.minute;
              if (performance.now() - t0 > 60000) return reject(new Error('Uhrmessung: Zeitüberschreitung'));
              if (!a && s - s0 >= warm) a = { s, m };
              if (a && s - a.s >= win) return resolve({ sec: s - a.s, min: m - a.m, rate: (m - a.m) / (s - a.s) });
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        { warm, win },
      );
    await tid('hud-pause').click();
    await waitUntil(async () => ((await calendar()).paused ? true : null), 3000);
    const c0 = await calendar();
    const s0 = (await simStats()).steps;
    await waitSteps(90, 6000);
    const c1 = await calendar();
    const s1 = (await simStats()).steps;
    const hudPaused = (await attr('hud-pause', 'data-paused')) === 'true' && (await vis('hud-paused', 1000));
    record('E8a Pause: Uhr steht bei laufender Simulation still, HUD zeigt Pause', c1.minute === c0.minute && s1 - s0 >= 60 && hudPaused, `Minute ${f(c0.minute)} → ${f(c1.minute)}, ${s1 - s0} Sim-Schritte`);
    await tid('hud-pause').click();
    const resumed = await waitUntil(async () => ((await calendar()).minute > c1.minute ? true : null), 5000);
    record('E8b Weiter: Uhr läuft wieder', resumed !== null && (await attr('hud-pause', 'data-paused')) === 'false', '');
    await tid('hud-speed-1').click();
    const r1 = await rate(0.4, 3);
    await tid('hud-speed-4').click();
    const pressed4 = (await attr('hud-speed-4', 'aria-pressed')) === 'true' && (await attr('hud-speed-1', 'aria-pressed')) === 'false' && (await attr('hud-speed-2', 'aria-pressed')) === 'false';
    const r4 = await rate(0.4, 3);
    await tid('hud-speed-2').click();
    const pressed2 = (await attr('hud-speed-2', 'aria-pressed')) === 'true' && (await calendar()).speed === 2;
    await tid('hud-speed-1').click();
    const back = (await attr('hud-speed-1', 'aria-pressed')) === 'true' && (await calendar()).speed === 1;
    record('E8c Tempo 1×: ~1 Spielminute je Simulationssekunde (±8 %)', Math.abs(r1.rate - 1) <= 0.08, `${f(r1.rate)} min/s über ${f(r1.sec)} Sim-s`);
    record('E8d Tempo 4× läuft ca. viermal so schnell wie 1× (Verhältnis 3,6–4,4, Simulationszeit)', r4.rate / r1.rate > 3.6 && r4.rate / r1.rate < 4.4, `${f(r4.rate)} / ${f(r1.rate)} = ${f(r4.rate / r1.rate)}`);
    record('E8e Tempo-Knöpfe spiegeln den Zustand (aria-pressed 4×, 2×, 1×)', pressed4 && pressed2 && back, `4×:${pressed4} 2×:${pressed2} 1×:${back}`);
  });

  // ---------------------------------------------------------------- E9 day close
  await section('E9 Tagesabschluss', async () => {
    const before = await eco();
    shelfSnapshot = { storage: before.storage, shelves: before.shelves, cash: before.cashCents };
    const revenue = sales.reduce((a, s) => a + s.q * P[s.id].suggestedPriceCents, 0);
    const cogs = sales.reduce((a, s) => a + s.q * P[s.id].purchasePriceCents, 0);
    const exp = { revenue, cogs, purchases: orderTotal, gross: revenue - cogs, flow: revenue - orderTotal, cashEnd: START_CASH - orderTotal + revenue, sales: sales.length };
    record('E9a Spielstand vor dem Abschluss entspricht den aus Produktdaten berechneten Aktionen (Umsatz, Einkauf, Kasse)', before.today.revenueCents === exp.revenue && before.today.costOfGoodsSoldCents === exp.cogs && before.today.purchaseCents === exp.purchases && before.cashCents === exp.cashEnd, `Umsatz ${eur(exp.revenue)}, Einkauf ${eur(exp.purchases)}, Kasse ${eur(exp.cashEnd)}`);
    await tid('hud-close-day').click();
    const confirmShown = await vis('panel-confirmClose');
    await tid('confirm-close-confirm').click();
    const reportShown = await vis('panel-report');
    const t = async (id) => txt(`report-${id}`);
    const rows = { day: await t('day'), revenue: await t('revenue'), cogs: await t('cogs'), purchases: await t('purchases'), gross: await t('gross-profit'), flow: await t('cash-flow'), cashEnd: await t('cash-end'), sales: await t('sales') };
    const s = await st();
    record('E9b Bericht nach Bestätigung: Umsatz, Wareneinsatz, Einkauf, Rohertrag, Cashflow, Kasse, Verkäufe = erwartete Werte und Spielstand', confirmShown && reportShown && rows.day === '1' && rows.revenue === eur(exp.revenue) && rows.cogs === eur(exp.cogs) && rows.purchases === eur(exp.purchases) && rows.gross === eurSigned(exp.gross) && rows.flow === eurSigned(exp.flow) && rows.cashEnd === eur(exp.cashEnd) && rows.sales === String(exp.sales) && s.economy.lastReport.revenueCents === exp.revenue && s.economy.lastReport.purchaseCents === exp.purchases && s.economy.lastReport.cashEndCents === s.economy.cashCents && s.calendar.phase === 'closed', JSON.stringify(rows));
    // second close impossible
    await tid('panel-close').click();
    await gone('panel-report');
    const label = await txt('hud-close-day');
    await tid('hud-close-day').click();
    const reportAgain = await vis('panel-report');
    record('E9c Zweiter Abschluss unmöglich: Phase „closed“, Knopf zeigt „Abrechnung“ und öffnet nur den Bericht', label === 'Abrechnung' && reportAgain && (await tid('panel-confirmClose').count()) === 0 && (await attr('hud-close-day', 'disabled')) === null, `Knopf ${JSON.stringify(label)}`);
    // reload in phase closed
    const savedReport = JSON.stringify((await st()).economy.lastReport);
    await reload();
    const reportBack = await vis('panel-report', 8000);
    const rows2 = { revenue: await t('revenue'), purchases: await t('purchases'), cashEnd: await t('cash-end') };
    const s2 = await st();
    record('E9d Reload in Phase „closed“: Bericht erscheint wieder, Zahlen bleiben', reportBack && JSON.stringify(s2.economy.lastReport) === savedReport && s2.calendar.phase === 'closed' && rows2.revenue === eur(exp.revenue) && rows2.purchases === eur(exp.purchases) && rows2.cashEnd === eur(exp.cashEnd), JSON.stringify(rows2));
    // next day
    await tid('report-next-day').click();
    await waitUntil(async () => ((await txt('hud-day')) === 'Di · Tag 2' ? true : null), 4000);
    const s3 = await st();
    record('E9e „Nächsten Tag beginnen“: HUD „Di · Tag 2“ (Dienstag), 06:00, Kasse/Lager/Regale unverändert, Tagessummen leer, Bericht geschlossen', (await txt('hud-day')) === 'Di · Tag 2' && s3.calendar.day === 2 && s3.calendar.phase === 'open' && s3.calendar.minute >= 360 && s3.calendar.minute < 363 && s3.economy.cashCents === shelfSnapshot.cash && JSON.stringify(s3.economy.storage) === JSON.stringify(shelfSnapshot.storage) && JSON.stringify(s3.economy.shelves) === JSON.stringify(shelfSnapshot.shelves) && s3.economy.today.revenueCents === 0 && s3.economy.today.purchaseCents === 0 && (await panelOpen()) === null && (await txt('hud-cash')) === eur(shelfSnapshot.cash), `Uhr ${await txt('hud-clock')}, Kasse ${await txt('hud-cash')}`);
  });

  // ---------------------------------------------------------------- E11a save round trip (current format)
  await section('E11a Savegame Rundlauf', async () => {
    await tid('hud-pause').click();
    await waitUntil(async () => ((await st()).calendar.paused ? true : null), 3000);
    const a = await st();
    await reload();
    const b = await st();
    record('E11a Reload: Kasse, Lager, Regale, Tag, Uhr (pausiert), Tür/Klappe und Position bleiben erhalten', b.economy.cashCents === a.economy.cashCents && JSON.stringify(b.economy.storage) === JSON.stringify(a.economy.storage) && JSON.stringify(b.economy.shelves) === JSON.stringify(a.economy.shelves) && b.calendar.day === 2 && b.calendar.minute === a.calendar.minute && b.calendar.paused === true && b.kiosk.doorOpen === a.kiosk.doorOpen && b.kiosk.shutterOpen === a.kiosk.shutterOpen && Math.hypot(b.player.position.x - a.player.position.x, b.player.position.z - a.player.position.z) < 0.05, `Tag ${b.calendar.day}, ${await txt('hud-clock')}, Kasse ${await txt('hud-cash')}`);
    const info = await stockInfo();
    const total = Object.values(b.economy.shelves).reduce((x, s) => x + s.quantity, 0);
    record('E11b Nach dem Reload zeigt die 3D-Welt den geladenen Regalbestand', info.drawnInstances === total && total > 0, `${info.drawnInstances} Instanzen`);
  });

  // ---------------------------------------------------------------- E10 reaching 22:00
  await section('E10 Tagesende 22:00', async () => {
    await seedSave({ calendar: { minute: 1318, speed: 4, paused: true, phase: 'open' } });
    const seeded = { clock: await txt('hud-clock'), speed4: await attr('hud-speed-4', 'aria-pressed'), paused: await attr('hud-pause', 'data-paused') };
    await page.evaluate(() => {
      window.__ending = 0;
      window.__buedchen.game.signals.on('day.ending', () => { window.__ending += 1; });
    });
    const reportBefore = JSON.stringify((await st()).economy.lastReport);
    await tid('hud-pause').click(); // resume
    const reached = await page.waitForFunction(() => window.__buedchen.game.state.calendar.phase === 'awaiting_close', null, { timeout: 30000 }).then(() => true, () => false);
    await waitSteps(150, 8000);
    const s = await st();
    const hint = await vis('hud-closing-hint', 2000);
    const hintText = hint ? await txt('hud-closing-hint') : '';
    const counts = await page.evaluate(() => ({ ending: window.__ending, notices: window.__noticeNodes.filter((t) => t.includes('22:00')).length }));
    record('E10a Seed 21:58 in aktuellem Format mit Tempo 4×: Uhr steht bei 22:00 still (Phase „awaiting_close“), kein automatischer Abschluss', seeded.clock === '21:58' && seeded.speed4 === 'true' && seeded.paused === 'true' && reached && s.calendar.minute === 1320 && (await txt('hud-clock')) === '22:00' && s.calendar.day === 2 && JSON.stringify(s.economy.lastReport) === reportBefore && (await panelOpen()) === null, `Uhr ${await txt('hud-clock')}, Phase ${s.calendar.phase}`);
    record('E10b Abschlusshinweis erscheint genau einmal (HUD-Hinweis sichtbar, ein Signal, eine Meldung)', hint && /22:00/.test(hintText) && counts.ending === 1 && counts.notices === 1, `Signale ${counts.ending}, Meldungen ${counts.notices}`);
  });

  // ---------------------------------------------------------------- E11b v1 save migration
  await section('E11b Savegame v1', async () => {
    await page.evaluate(() => {
      window.sessionStorage.setItem('__seed', JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        state: { regionId: 'region.ruhrgebiet', player: { position: { x: -3.5, z: -0.3 }, heading: Math.PI }, kiosk: { doorOpen: true, shutterOpen: true } },
      }));
    });
    await reload(false);
    const s = await st();
    const noticeShown = await page.evaluate(() => window.__notices.includes('Spielstand geladen'));
    record('E11c v1-Spielstand lädt: Position, Tür und Klappe bleiben, Wirtschaft mit Anfangswerten (Tag 1, 06:00, 300,00 €, leer)', Math.hypot(s.player.position.x + 3.5, s.player.position.z + 0.3) < 0.05 && s.kiosk.doorOpen === true && s.kiosk.shutterOpen === true && s.economy.cashCents === START_CASH && Object.keys(s.economy.storage).length === 0 && Object.keys(s.economy.shelves).length === 0 && s.economy.pendingDelivery === null && s.economy.lastReport === null && s.calendar.day === 1 && s.calendar.minute >= 360 && s.calendar.minute < 375 && s.calendar.phase === 'open' && noticeShown && (await txt('hud-day')) === 'Mo · Tag 1' && (await txt('hud-cash')) === eur(START_CASH) && (await attr('hud-status', 'data-open')) === 'true', `Tag ${s.calendar.day}, ${await txt('hud-clock')}, ${await txt('hud-cash')}, Hinweis ${noticeShown}`);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('buedchensim.save.slot1')));
    record('E11d Nach dem Laden wird im aktuellen Format (schemaVersion 3) gespeichert', stored.schemaVersion === 3 && stored.state.economy?.cashCents === START_CASH && stored.state.calendar?.day === 1, `schemaVersion ${stored.schemaVersion}`);
  });

  // ---------------------------------------------------------------- E14 place-bound panels away from the place / state replacement
  await section('E14 Platzbindung', async () => {
    // (a) away from the register (here the yard west of the kiosk) there is no prompt and E opens nothing.
    const k = await econKey();
    const away = await promptText();
    await pressE();
    record('E14a Abseits von Kasse und Lager (Hof): kein Prompt, E öffnet kein Panel', away === null && (await panelOpen()) === null && (await econKey()) === k, `Prompt ${JSON.stringify(away)}`);
    // (b) a state replacement ("Neues Spiel") closes an open till panel cleanly.
    await seedSave({ player: { position: { x: -0.2, z: 0.95 }, heading: Math.PI }, kiosk: { doorOpen: true, shutterOpen: true } });
    const atRegister = await promptText();
    await pressE();
    const tillOpen = await vis('panel-till');
    // The modal backdrop covers "Neues Spiel", so the replacement is triggered through the game (as main's onNewGame does).
    await page.evaluate(() => window.__buedchen.game.reset());
    const closedByReset = await gone('panel-till', 4000);
    const afterPrompt = await promptText();
    const s = await st();
    const run = await hold(['KeyS'], (p, b) => Math.hypot(p.x - b.x, p.z - b.z) > 0.3, 5000);
    record('E14b Spielstand-Ersetzung (reset) bei offener Kasse: Panel schließt, Spieler zurück am Start ohne Prompt, Eingabe wieder frei', atRegister === 'Kasse bedienen' && tillOpen && closedByReset && (await panelOpen()) === null && afterPrompt === null && s.calendar.day === 1 && s.economy.cashCents === START_CASH && Math.hypot(run.dx, run.dz) > 0.3, `Prompt am Punkt ${JSON.stringify(atRegister)}, danach ${JSON.stringify(afterPrompt)}, Position ${f(s.player.position.x)}/${f(s.player.position.z)}`);
  });

  if (runEconomy) {
    const lost = pageGone ? null : ctxLostTotal + (await page.evaluate(() => window.__ctxLost).catch(() => 0));
    record('E12 WebGL-Kontext im Wirtschaftsabschnitt nie verloren (alle Seitenladungen)', lost === 0, lost === null ? 'nicht lesbar' : `${lost} Ereignisse`);
    await closeEcoCtx();
  }

  // ---------------------------------------------------------------- E13 screenshots Auftrag 03 (deviceScaleFactor 2)
  await section('E13 Screenshots Auftrag 03', async () => {
    if (!runShots) return;
    await newEcoPage('shots', 2);
    await seedSave({ player: { position: { x: 0.6, z: -0.3 }, heading: Math.PI }, kiosk: { doorOpen: true, shutterOpen: true }, economy: { cashCents: 100000 } });
    // Stock a representative assortment through the game actions (debug hook, this screenshot scene only): every
    // compatible slot gets up to 4 units, the products rotate over the slots of their kind, plus 2 units in storage.
    const plan = await page.evaluate(() => {
      const g = window.__buedchen.game;
      const c = g.content;
      const per = 4;
      const extra = 2;
      const byKind = {};
      for (const p of Object.values(c.products)) (byKind[p.storage] ??= []).push(p);
      const counters = {};
      const assign = [];
      for (const slot of c.stockSlots) {
        const list = byKind[slot.accepts];
        if (!list) continue;
        counters[slot.accepts] = (counters[slot.accepts] ?? -1) + 1;
        assign.push({ slotId: slot.id, productId: list[counters[slot.accepts] % list.length].id });
      }
      const need = {};
      for (const a of assign) need[a.productId] = (need[a.productId] ?? 0) + per;
      for (const p of Object.values(c.products)) need[p.id] = (need[p.id] ?? 0) + extra;
      const errors = [];
      const fallbacks = [];
      const note = (label, r) => { if (!r.ok) errors.push(`${label}: ${r.reason}`); return r.ok; };
      note('order', g.economy.placeOrder(Object.entries(need).map(([productId, quantity]) => ({ productId, quantity }))));
      note('delivery', g.economy.receiveDelivery());
      for (const a of assign) {
        // A product may not fit a slot at all (capacity 0): fall back to the next product of the same kind.
        const list = byKind[c.stockSlots.find((x) => x.id === a.slotId).accepts];
        const start = list.findIndex((p) => p.id === a.productId);
        let ok = false;
        for (let k = 0; k < list.length && !ok; k += 1) {
          const pid = list[(start + k) % list.length].id;
          for (let q = per; q >= 1 && !ok; q -= 1) ok = g.economy.restock(a.slotId, pid, q).ok;
          if (ok && k > 0) fallbacks.push(`${a.slotId}: ${a.productId} passt nicht, ${pid}`);
        }
        if (!ok) errors.push(`${a.slotId}: nicht einräumbar`);
      }
      const shelves = g.state.economy.shelves;
      return { errors, fallbacks, slots: Object.keys(shelves).length, units: Object.values(shelves).reduce((s, x) => s + x.quantity, 0), products: new Set(Object.values(shelves).map((x) => x.productId)).size, kinds: assign.length };
    });
    await page.waitForFunction((n) => window.__buedchen.world.getStockInfo().drawnInstances === n, plan.units, { timeout: 20000 });
    await page.waitForFunction(() => window.__buedchen.world.getSimStats().seconds > 2, null, { timeout: 30000 });
    await page.waitForFunction(() => window.__buedchen.world.getKioskVisibility().roof === false, null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('.ui-notice').length === 0, null, { timeout: 30000 });
    await sleep(800);
    await capture(page, 'auftrag-03-innen-bestueckt.png');
    record('Screenshot auftrag-03-innen-bestueckt.png geschrieben (Innenraum, Dach weg)', plan.errors.length === 0 && plan.units >= 150 && plan.units <= 400 && plan.products >= 20, `${plan.units} Einheiten auf ${plan.slots} Plätzen, ${plan.products} Produkte${plan.fallbacks.length ? `, Ausweichprodukte: ${plan.fallbacks.join('; ')}` : ''}${plan.errors.length ? `, Fehler: ${plan.errors.join('; ')}` : ''}`);

    // Till: normal + age-restricted product in the cart, ID check ticked, sold with the real UI.
    await page.evaluate(() => window.__buedchen.ui.openPanel('till')); // not about how the panel opens (see E6)
    await vis('panel-till');
    await clickN(`till-add-${ID.chips}`, 1);
    await clickN(`till-add-${ID.pils}`, 1);
    await tid('till-age-checkbox').check();
    const cartTotal = P[ID.chips].suggestedPriceCents + P[ID.pils].suggestedPriceCents;
    await waitUntil(async () => (await txt('cart-total')) === eur(cartTotal), 3000);
    await sleep(500);
    await capture(page, 'auftrag-03-kasse.png');
    record('Screenshot auftrag-03-kasse.png geschrieben (Warenkorb mit Chips + Pils, Altersprüfung sichtbar)', (await txt('cart-total')) === eur(cartTotal) && (await vis('till-age-checkbox', 1000)), `Summe ${await txt('cart-total')}`);
    await tid('till-submit').click();
    await waitUntil(async () => ((await eco()).today.salesCount === 1 ? true : null), 4000);
    await page.keyboard.press('Escape');
    await gone('panel-till');

    // Goods management: stock overview with storage and shelf columns.
    await page.evaluate(() => window.__buedchen.ui.openPanel('goods'));
    await vis('panel-goods');
    await sleep(500);
    await capture(page, 'auftrag-03-warenverwaltung.png');
    const e = await eco();
    record('Screenshot auftrag-03-warenverwaltung.png geschrieben (Bestandsansicht Lager/Regal)', (await txt(`stock-storage-${ID.chips}`)) === String(e.storage[ID.chips] ?? 0) && (await txt(`stock-shelf-${ID.chips}`)) === String(shelfSum(e, ID.chips)), `Chips Lager ${await txt(`stock-storage-${ID.chips}`)} / Regal ${await txt(`stock-shelf-${ID.chips}`)}`);
    await page.keyboard.press('Escape');
    await gone('panel-goods');

    // Day report.
    await tid('hud-close-day').click();
    await tid('confirm-close-confirm').click();
    await vis('panel-report');
    await sleep(500);
    await capture(page, 'auftrag-03-tagesabschluss.png');
    const rep = (await st()).economy.lastReport;
    record('Screenshot auftrag-03-tagesabschluss.png geschrieben (Tagesbericht)', rep !== null && (await txt('report-revenue')) === eur(rep.revenueCents) && rep.salesCount === 1, `Umsatz ${await txt('report-revenue')}, Einkauf ${await txt('report-purchases')}`);
    await closeEcoCtx();
  });

  // ================================================================ residents / social flow (Auftrag 04)
  // Drives the REAL UI (real key presses, clicks on data-testids). The debug hook is used to read state and to set up
  // situations (clock, story state, residents placed at a place) through game.load; every dialogue choice, every sale and
  // every interaction trigger goes through the UI. Residents arrive through their real routines in R1/R2/R3/R8/R9.
  const NPC_RADIUS = 0.3; // NPC_RADIUS in src/game/balance.ts
  const G = 'npc.guenter';
  const D = 'npc.derya';
  const J = 'npc.jonas';
  const M = 'npc.marlene';
  const NPC_IDS = [G, D, J, M];
  const npcName = (id) => data.npcs[id].name;
  const ROUTINE = { [G]: 'g.morgen', [D]: 'd.broetchen', [J]: 'j.di', [M]: 'm.werktag' };
  const COUNTER = { x: -1.0, z: 0.95, h: 0 }; // behind the counter at the sales window, facing south
  const STOCK = {
    'slot.counter.1': { productId: 'product.pottbaecker-broetchen', quantity: 6 },
    'slot.counter.2': { productId: 'product.zechenhof-drehtabak-30', quantity: 5 },
    'slot.counter.3': { productId: 'product.pottbaecker-streuselteilchen', quantity: 4 },
    'slot.magazine-rack.1': { productId: 'product.halden-echo-lokalblatt', quantity: 5 },
    'slot.wall-shelf-north.1': { productId: 'product.puettbraeu-pils', quantity: 10 },
    'slot.wall-shelf-north.2': { productId: 'product.ruhrbrause-wasser-still', quantity: 10 },
    'slot.wall-shelf-north.3': { productId: 'product.naschwerk-vollmilch', quantity: 10 },
    'slot.fridge.1': { productId: 'product.zechenblitz-energy', quantity: 5 },
    'slot.fridge.2': { productId: 'product.ruhrbrause-zitronenlimo', quantity: 5 },
    'slot.freezer.1': { productId: 'product.eiskumpel-wassereis-brause', quantity: 5 },
  };
  const weekdayOfDay = (day) => (((day - 1) % 7) + 7) % 7;
  const nav = data.layout.nav;
  const wpPos = Object.fromEntries(nav.waypoints.map((w) => [w.id, w.position]));
  const segments = nav.edges.map(([a, b]) => [wpPos[a], wpPos[b]]);
  const distToSegment = (p, [a, b]) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
  };
  const distToNav = (p) => Math.min(...segments.map((sg) => distToSegment(p, sg)));
  const distToRect = (p, r) => Math.hypot(p.x - Math.min(Math.max(p.x, r.minX), r.maxX), p.z - Math.min(Math.max(p.z, r.minZ), r.maxZ));
  /** Footprints a resident must stay out of: the kiosk and every colliding free-standing placement (gated ones only with their flag). */
  const blockersFor = (flags) => [
    data.layout.kiosk.footprint,
    ...placements
      .filter((p) => p.on === undefined && (p.collides ?? data.assets[p.assetId].collides) && (p.requiresFlag === undefined || flags[p.requiresFlag]))
      .map(footprint),
  ];

  /** In-page helpers (survive reloads through the init script). */
  const resLib = () => {
    const R = (window.__r = {});
    const game = () => window.__buedchen.game;
    const away = (n) => {
      n.status = 'away'; n.placeId = null; n.spotIndex = null; n.route = []; n.routineId = null; n.wish = null; n.waitingSince = null;
      n.doneToday = { day: 0, routineIds: [] };
    };
    const base = (spec) => {
      const g = game();
      const s = window.structuredClone(g.state);
      const places = new Map(g.content.layout.nav.places.map((p) => [p.id, p]));
      const wp = new Map(g.content.layout.nav.waypoints.map((w) => [w.id, w.position]));
      if (spec.seed !== undefined) s.world.seed = spec.seed;
      const c = s.calendar;
      if (spec.day !== undefined) c.day = spec.day;
      if (spec.minute !== undefined) c.minute = spec.minute;
      c.phase = 'open';
      c.paused = spec.paused ?? true;
      c.speed = spec.speed ?? 1;
      if (spec.shutter !== undefined) s.kiosk.shutterOpen = spec.shutter;
      if (spec.door !== undefined) s.kiosk.doorOpen = spec.door;
      if (spec.player) { s.player.position = { x: spec.player.x, z: spec.player.z }; s.player.heading = spec.player.h ?? 0; }
      if (spec.flags) Object.assign(s.story.flags, spec.flags);
      if (spec.quests) for (const [k, v] of Object.entries(spec.quests)) s.story.quests[k] = v;
      if (spec.shelves) s.economy.shelves = window.structuredClone(spec.shelves);
      if (spec.cash !== undefined) s.economy.cashCents = spec.cash;
      for (const [id, n] of Object.entries(s.npcs)) {
        const o = spec.npcs?.[id];
        if (!o) { away(n); continue; }
        const place = places.get(o.place);
        const spotIndex = o.spot === undefined ? 0 : o.spot;
        const spot = spotIndex === null ? place.spots[0] : place.spots[spotIndex];
        const pos = o.pos ?? (o.from ? wp.get(o.from) : wp.get(spot.waypointId));
        n.position = { x: pos.x, z: pos.z };
        n.heading = o.heading ?? spot.heading;
        n.placeId = o.place;
        n.spotIndex = spotIndex;
        n.routineId = o.routine ?? null;
        n.route = o.route ?? [];
        n.status = o.status ?? (n.route.length > 0 ? 'walking' : 'at_place');
        n.waitingSince = null;
        n.doneToday = { day: c.day, routineIds: [] };
        n.wish = null;
        if (o.wish) {
          const w = g.content.npcs[id].wishes.find((x) => x.id === o.wish);
          n.wish = { wishId: w.id, lines: w.lines.map((l) => ({ ...l })), ageChecked: false, resolved: null };
          n.status = 'waiting';
        }
        if (o.rel !== undefined) n.relationship = o.rel;
        for (const m of o.memories ?? []) if (!n.memories.includes(m)) n.memories.push(m);
        if (o.lastTalk) n.lastTalk = o.lastTalk;
      }
      return s;
    };
    R.arrange = (spec) => {
      const r = game().load(base(spec));
      return r;
    };
    /** First day (1..28) on which the routine entry starts for the seed, using the game's own simulation. */
    R.findEntryDay = (seed, flags, npcId, entryId) => {
      const g = game();
      const entry = g.content.npcs[npcId].routine.find((e) => e.id === entryId);
      for (let day = 1; day <= 28; day += 1) {
        g.load(base({ seed, day, minute: entry.from, paused: false, speed: 4, flags, player: { x: -1, z: 0.95, h: 0 }, shutter: true }));
        for (let i = 0; i < 4; i += 1) g.tick(0.05);
        const n = g.state.npcs[npcId];
        if (n.status !== 'away' && n.routineId === entryId) return day;
      }
      return null;
    };
    /** Simulates each day 06:00-22:00 at speed 4 (the game's own ticks): when most residents are in the world at the same time, and when somebody uses the bench. */
    R.crowd = (seed, flags) => {
      const g = game();
      let best = { count: 0, day: 0, minute: 0 };
      let bench = null;
      for (let day = 1; day <= 28; day += 1) {
        g.load(base({ seed, day, minute: 360, paused: false, speed: 4, flags, player: { x: -1, z: 0.95, h: 0 }, shutter: true }));
        for (let i = 0; i < 950; i += 1) {
          g.tick(0.25);
          const list = Object.entries(g.state.npcs).filter(([, n]) => n.status !== 'away');
          if (list.length > best.count) best = { count: list.length, day, minute: Math.floor(g.state.calendar.minute) };
          if (!bench) {
            const b = list.find(([, n]) => n.placeId === 'place.yard-bench' && n.status === 'at_place');
            if (b) bench = { npcId: b[0], day, minute: Math.floor(g.state.calendar.minute) };
          }
        }
      }
      return { best, bench };
    };
    /** Per-frame recorder of the residents (state pose, displayed pose, screen position). */
    R.mon = (on) => {
      if (!on) {
        const m = window.__mon;
        if (!m) return [];
        m.run = false;
        return m.samples;
      }
      const m = (window.__mon = { run: true, samples: [] });
      const loop = () => {
        if (!m.run) return;
        const g = game();
        const info = window.__buedchen.world.getResidentInfo();
        const row = { t: window.__buedchen.world.getSimStats().seconds, day: g.state.calendar.day, min: g.state.calendar.minute, n: {} };
        for (const i of info) {
          const n = g.state.npcs[i.npcId];
          row.n[i.npcId] = {
            vis: i.visible, vx: i.position.x, vz: i.position.z, an: i.animation, sx: i.screen ? i.screen.x : null, sy: i.screen ? i.screen.y : null,
            status: n.status, x: n.position.x, z: n.position.z, place: n.placeId, spot: n.spotIndex, wish: n.wish !== null && n.wish.resolved === null,
          };
        }
        if (m.samples.length < 12000) m.samples.push(row);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      return [];
    };
  };

  // --- Node-side helpers
  const arrange = async (spec) => {
    const r = await page.evaluate((spec) => window.__r.arrange(spec), spec);
    if (!r.ok) throw new Error(`arrange: ${r.reason}`);
    await waitSteps(4);
  };
  const dlg = () => page.evaluate(() => {
    const v = window.__buedchen.game.dialogue.current();
    return v ? JSON.parse(JSON.stringify(v)) : null;
  });
  const npcState = async (id) => (await st()).npcs[id];
  const names = (id) => `Mit ${npcName(id)} sprechen`;
  const waitPrompt = async (text, timeout = 8000) => {
    const ok = await waitUntil(async () => ((await promptText()) === text ? true : null), timeout);
    if (!ok) throw new Error(`Prompt ${JSON.stringify(text)} erscheint nicht (aktuell ${JSON.stringify(await promptText())})`);
  };
  /** Dialogue options as drawn: id, shortcut key, text. */
  const optionsDom = () => page.evaluate(() => [...document.querySelectorAll('[data-testid^="dialogue-option-"]')].map((b) => ({ id: b.dataset.testid.slice('dialogue-option-'.length), key: b.querySelector('kbd')?.textContent ?? null, text: b.textContent })));
  /** Chooses an option through the UI (`via` 'click' | 'key') and waits until the conversation moved on (node changed or ended) and the 250 ms lock is over. */
  const chooseOption = async (optionId, via = 'click') => {
    const before = await dlg();
    const opts = await optionsDom();
    const o = opts.find((x) => x.id === optionId);
    if (!o) throw new Error(`Option ${optionId} fehlt (vorhanden: ${opts.map((x) => x.id).join(', ')})`);
    if (via === 'key') {
      if (!(await ensureFocus())) throw new Error('kein Fokus');
      await page.keyboard.press(String(o.key));
    } else await tid(`dialogue-option-${optionId}`).click();
    await waitUntil(async () => {
      const now = await dlg();
      return now === null || now.nodeId !== before.nodeId || now.dialogueId !== before.dialogueId ? true : null;
    }, 4000);
    await sleep(300);
  };
  const closeDialogueIfOpen = async () => {
    if (await dlg()) {
      await page.keyboard.press('Escape');
      await gone('panel-dialogue', 4000);
    }
  };
  /** Opens the conversation with the real E key (or a click on the prompt). */
  const openTalk = async (npcId, via = 'key') => {
    await waitPrompt(names(npcId));
    if (via === 'click') await page.locator('.ui-prompt').click();
    else await pressE();
    if (!(await vis('panel-dialogue', 5000))) throw new Error('Dialogpanel öffnet nicht');
  };
  /** Sets up the resident at the sales window (clock paused), talks to him through the UI and plays the options. */
  const say = async (npcId, dialogueId, options, day, opt = {}) => {
    await arrange({ day, minute: opt.minute ?? 600, paused: true, shutter: true, door: true, player: COUNTER, npcs: { [npcId]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[npcId] } } });
    await openTalk(npcId, opt.open ?? 'key');
    const v = await dlg();
    if (v?.dialogueId !== dialogueId) throw new Error(`${npcId}: erwartet ${dialogueId}, bekommen ${v?.dialogueId}`);
    for (const o of options) await chooseOption(o, opt.via ?? 'click');
    await closeDialogueIfOpen();
    await gone('panel-dialogue', 4000);
  };
  const rel = async (id) => (await npcState(id)).relationship;
  const quest = async (id) => (await st()).story.quests[id] ?? null;
  const flagOf = async (id) => (await st()).story.flags[id] === true;
  const gated = () => page.evaluate(() => window.__buedchen.world.getGatedPlacements());
  const SEED = 7;
  const days = {}; // npcId -> day on which the routine starts (found with the game's own logic)
  let foundSeed = SEED;

  if (runResidents) {
    await newEcoPage('res', 1, resLib);
    await waitSteps(5, 15000);
  }

  // ---------------------------------------------------------------- R0 preparation: days on which every resident's routine passes its chance roll
  await section('R0 Vorbereitung', async () => {
    let ok = false;
    for (const seed of [SEED, 8, 9, 10, 11, 12, 13, 14]) {
      const found = {};
      for (const id of NPC_IDS) found[id] = await page.evaluate(([seed, id, entry]) => window.__r.findEntryDay(seed, {}, id, entry), [seed, id, ROUTINE[id]]);
      if (NPC_IDS.every((id) => found[id] !== null)) {
        Object.assign(days, found);
        foundSeed = seed;
        ok = true;
        break;
      }
    }
    record('R0 Für jede Routine (Günter Morgen, Derya Brötchen, Jonas Dienstag, Marlene Werktag) findet die Spiellogik einen Tag, an dem der Zufallswurf des gespeicherten Seeds gelingt', ok, `Seed ${foundSeed}, Tage ${JSON.stringify(days)}`);
    await arrange({ seed: foundSeed, day: 1, minute: 360, paused: true, shutter: true, door: true, player: COUNTER, shelves: STOCK });
    const s0 = await st();
    const info0 = await page.evaluate(() => window.__buedchen.world.getResidentInfo());
    record('R0b Ausgangslage geladen: Seed im Spielstand, alle vier Bewohner abwesend und nicht gezeichnet', s0.world.seed === foundSeed && NPC_IDS.every((id) => s0.npcs[id].status === 'away') && info0.length === 4 && info0.every((i) => !i.visible), `Seed ${s0.world.seed}`);
  });

  // ---------------------------------------------------------------- R1 residents appear at their scheduled times (real routines at 4x)
  const entryOf = (id) => data.npcs[id].routine.find((e) => e.id === ROUTINE[id]);
  const runs = {};
  const wishOf = {};
  await section('R1 Auftritte', async () => {
    for (const id of NPC_IDS) {
      const entry = entryOf(id);
      // load paused, let the world settle (everybody away and not drawn), then let the clock run
      await arrange({ seed: foundSeed, day: days[id], minute: entry.from, paused: true, speed: 4, shutter: true, door: true, player: COUNTER, shelves: STOCK });
      const pre = await page.evaluate((id) => ({ status: window.__buedchen.game.state.npcs[id].status, speed: window.__buedchen.game.state.calendar.speed, visible: window.__buedchen.world.getResidentInfo().find((i) => i.npcId === id).visible }), id);
      const s0 = { npcs: { [id]: { status: pre.status } }, calendar: { speed: pre.speed } };
      const initial = { visible: pre.visible };
      await page.evaluate(() => {
        window.__buedchen.game.state.calendar.paused = false;
      });
      await page.evaluate(() => window.__r.mon(true));
      const reached = await waitUntil(async () => {
        const n = await npcState(id);
        return n.status === 'waiting' ? n : null;
      }, 90000, 100);
      await waitSteps(60); // one more simulated second standing at the window (idle animation after the walk)
      const samples = await page.evaluate(() => window.__r.mon(false));
      runs[id] = samples;
      const first = samples.find((r) => r.n[id].vis);
      const last = samples[samples.length - 1];
      const n = await npcState(id);
      const spotPos = wpPos[nav.places.find((p) => p.id === 'place.kiosk-window').spots[n.spotIndex ?? 0].waypointId];
      const info = (await page.evaluate(() => window.__buedchen.world.getResidentInfo())).find((i) => i.npcId === id);
      const hudSpeed4 = (await attr('hud-speed-4', 'aria-pressed')) === 'true';
      const speed4 = hudSpeed4 && s0.calendar.speed === 4;
      wishOf[id] = n.wish?.wishId ?? null;
      record(
        `R1 ${npcName(id)} erscheint zur Routine ${entry.id} (Tag ${days[id]}, ab ${Math.floor(entry.from / 60)}:${String(entry.from % 60).padStart(2, '0')}) und geht zum Verkaufsfenster, Tempo 4×`,
        speed4 && s0.npcs[id].status === 'away' && initial && !initial.visible && first !== undefined &&
          first.min >= entry.from && first.min < entry.to && entry.weekdays.includes(weekdayOfDay(first.day)) &&
          reached !== null && n.placeId === 'place.kiosk-window' && Math.hypot(n.position.x - spotPos.x, n.position.z - spotPos.z) < 0.05 &&
          info?.visible === true && info.screen !== null && last.n[id].vis && n.status === 'waiting',
        `Wochentag ${first && entry.weekdays.includes(weekdayOfDay(first.day))}, Position ${Math.hypot(n.position.x - spotPos.x, n.position.z - spotPos.z).toFixed(3)}, letzter Frame sichtbar ${last.n[id].vis}, Anfang unsichtbar ${initial && !initial.visible}, HUD 4× ${hudSpeed4}, Zeit ${first && first.min >= entry.from && first.min < entry.to}, Bildschirm ${info?.screen !== null}, vorher away/unsichtbar, sichtbar ab ${first ? `${Math.floor(first.min / 60)}:${String(Math.floor(first.min % 60)).padStart(2, '0')}` : '-'}, Platz ${n.placeId} Spot ${n.spotIndex}, Status ${n.status}, ${samples.length} Frames`,
      );
    }
  });

  // ---------------------------------------------------------------- R2 visible, collision-free routes
  await section('R2 Wege', async () => {
    const blockers = blockersFor({});
    const summary = [];
    let good = 0;
    for (const id of NPC_IDS) {
      const samples = (runs[id] ?? []).filter((r) => r.n[id].vis);
      let path = 0;
      let screenTravel = 0;
      let maxEdge = 0;
      let maxViewEdge = 0;
      let minBlock = Infinity;
      let minBlockView = Infinity;
      let moved = 0;
      let walking = 0;
      const walkAn = new Map();
      const tail = samples.filter((r) => r.n[id].status === 'waiting').slice(-5).map((r) => r.n[id].an);
      for (let i = 0; i < samples.length; i += 1) {
        const a = samples[i].n[id];
        for (const b of blockers) {
          minBlock = Math.min(minBlock, distToRect({ x: a.x, z: a.z }, b));
          minBlockView = Math.min(minBlockView, distToRect({ x: a.vx, z: a.vz }, b));
        }
        if (a.status === 'walking') {
          walking += 1;
          walkAn.set(a.an, (walkAn.get(a.an) ?? 0) + 1);
          maxEdge = Math.max(maxEdge, distToNav({ x: a.x, z: a.z }));
          maxViewEdge = Math.max(maxViewEdge, distToNav({ x: a.vx, z: a.vz }));
        }
        if (i > 0) {
          const p = samples[i - 1].n[id];
          const d = Math.hypot(a.x - p.x, a.z - p.z);
          path += d;
          if (d > 1e-4) moved += 1;
          if (a.sx !== null && p.sx !== null) screenTravel += Math.hypot(a.sx - p.sx, a.sy - p.sy);
        }
      }
      const walkMode = [...walkAn.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      const stillMode = tail.sort((x, y) => tail.filter((v) => v === y).length - tail.filter((v) => v === x).length)[0];
      const animOk = walkMode !== undefined && stillMode !== undefined && walkMode !== stillMode;
      const ok = path > 3 && screenTravel > 80 && moved >= 5 && walking >= 5 && maxEdge < 0.06 && maxViewEdge < 0.35 && minBlock >= NPC_RADIUS - 0.02 && minBlockView >= NPC_RADIUS - 0.1 && animOk;
      if (ok) good += 1;
      summary.push(`${npcName(id).split(' ')[0]}: ${f(path)} m, ${Math.round(screenTravel)} px, Kante ${f(maxEdge)}/${f(maxViewEdge)}, Abstand Hindernis ${f(minBlock)}, Gehen=${walkMode} Stehen=${stillMode}`);
    }
    record(`R2 Mindestens zwei Bewohner gehen sichtbar (Bildposition ändert sich, Gehanimation) auf den Wegekanten (≤ 6 cm Zustand, ≤ 35 cm gezeichnet) und nie in Kiosk/Möbeln (${good} von 4 erfüllen alles)`, good >= 2, summary.join(' | '));
  });

  // ---------------------------------------------------------------- R3 several residents at once: no overlap, never the same spot, outside the furniture
  await section('R3 Gleichzeitig', async () => {
    for (const flags of [{}, { 'yard.bench': true }]) {
      const label = flags['yard.bench'] ? 'mit Hofbank' : 'ohne Hofbank';
      const found = await page.evaluate(([seed, flags]) => window.__r.crowd(seed, flags), [foundSeed, flags]);
      const target = found.best;
      await arrange({ seed: foundSeed, day: target.day, minute: Math.max(360, target.minute - 25), paused: false, speed: 4, flags, shutter: true, door: true, player: COUNTER, shelves: STOCK });
      await page.evaluate(() => window.__r.mon(true));
      const reachedCount = await waitUntil(async () => {
        const s = await st();
        return NPC_IDS.filter((id) => s.npcs[id].status !== 'away').length >= Math.min(target.count, 3) ? true : null;
      }, 60000, 100);
      await waitSteps(60);
      const samples = await page.evaluate(() => window.__r.mon(false));
      const blockers = blockersFor(flags);
      let maxVisible = 0;
      let sameSpot = 0;
      let overlap = 0;
      let inside = 0;
      let minPair = Infinity;
      for (const row of samples) {
        const vis = NPC_IDS.filter((id) => row.n[id].vis);
        maxVisible = Math.max(maxVisible, vis.length);
        const seen = new Set();
        for (const id of vis) {
          const a = row.n[id];
          if (a.spot !== null && a.status !== 'walking') {
            const key = `${a.place}#${a.spot}`;
            if (seen.has(key)) sameSpot += 1;
            seen.add(key);
          }
          for (const b of blockers) if (distToRect({ x: a.x, z: a.z }, b) < NPC_RADIUS - 0.02) inside += 1;
          for (const other of vis) {
            if (other <= id) continue;
            const d = Math.hypot(a.x - row.n[other].x, a.z - row.n[other].z);
            minPair = Math.min(minPair, d);
            if (d <= 0.3) overlap += 1;
          }
        }
      }
      record(
        `R3 ${label}: Tag ${target.day} ab ${Math.floor((target.minute - 25) / 60)}:${String((target.minute - 25) % 60).padStart(2, '0')} (Spiellogik-Suche: bis zu ${target.count} gleichzeitig) – im Browser ≥ 3 zugleich sichtbar, nie zwei auf demselben Platz-Spot, nie näher als 0,3 m, nie in Kiosk/Möbeln${flags['yard.bench'] ? '/Bank' : ''}`,
        reachedCount !== null && maxVisible >= Math.min(target.count, 3) && maxVisible >= 3 && sameSpot === 0 && overlap === 0 && inside === 0,
        `max gleichzeitig ${maxVisible}, kleinster Abstand ${f(minPair)} m, gleicher Spot ${sameSpot}, in Hindernis ${inside}, ${samples.length} Frames`,
      );
      if (flags['yard.bench']) {
        // somebody uses the bench: replay up to the moment, check the standing position at the bench spot
        const b = found.bench;
        if (!b) {
          record('R3b Mit Hofbank nutzt ein Bewohner den Bankplatz (Spiellogik-Suche über 28 Tage)', false, 'kein Bankbesuch gefunden');
        } else {
          await arrange({ seed: foundSeed, day: b.day, minute: Math.max(360, b.minute - 25), paused: false, speed: 4, flags, shutter: true, door: true, player: COUNTER, shelves: STOCK });
          const at = await waitUntil(async () => {
            const n = await npcState(b.npcId);
            return n.status === 'at_place' && n.placeId === 'place.yard-bench' ? n : null;
          }, 60000, 100);
          await waitSteps(30);
          const n = await npcState(b.npcId);
          const place = nav.places.find((p) => p.id === 'place.yard-bench');
          const spot = place.spots[n.spotIndex ?? 0];
          const sp = wpPos[spot.waypointId];
          const benchRect = footprint(placementOf('placement.yard-bench'));
          const info = (await page.evaluate(() => window.__buedchen.world.getResidentInfo())).find((i) => i.npcId === b.npcId);
          record(
            `R3b ${npcName(b.npcId)} steht mit der Hofbank am Bankplatz (Tag ${b.day}), an der Spot-Position, ohne die Bank zu durchdringen`,
            at !== null && Math.hypot(n.position.x - sp.x, n.position.z - sp.z) < 0.05 && Math.abs(n.heading - spot.heading) < 0.05 && distToRect(n.position, benchRect) >= NPC_RADIUS - 0.02 && info?.visible === true,
            `Spot ${n.spotIndex} (${f(sp.x)}/${f(sp.z)}), Abstand zur Bank ${f(distToRect(n.position, benchRect))} m, Tag ${b.day}`,
          );
        }
      }
    }
  });

  const freshGame = async () => {
    await page.evaluate(() => window.__buedchen.game.reset());
    await arrange({ seed: foundSeed, day: 1, minute: 600, paused: true, shutter: true, door: true, player: COUNTER, shelves: STOCK });
  };
  const gatedVisible = async (id) => (await gated()).find((g) => g.id === id)?.visible ?? null;
  const journalState = async () =>
    page.evaluate(() => ({
      people: [...document.querySelectorAll('[data-testid^="journal-person-"]')].map((n) => n.dataset.testid.slice('journal-person-'.length)),
      quests: [...document.querySelectorAll('[data-testid^="journal-quest-"]')].map((n) => n.dataset.testid.slice('journal-quest-'.length)),
      noPeople: !!document.querySelector('[data-testid="journal-no-people"]'),
      noActive: !!document.querySelector('[data-testid="journal-no-active"]'),
      text: document.querySelector('[data-testid="panel-journal"]')?.textContent ?? '',
    }));
  /** Opens the journal (HUD button or J), reads it, closes it with Escape. */
  const readJournal = async (via) => {
    if (via === 'key') {
      if (!(await ensureFocus())) throw new Error('kein Fokus');
      await page.keyboard.press('KeyJ');
    } else await tid('hud-open-journal').click();
    if (!(await vis('panel-journal', 4000))) throw new Error('Notizbuch öffnet nicht');
    const j = await journalState();
    await page.keyboard.press('Escape');
    await gone('panel-journal', 3000);
    return j;
  };

  // ---------------------------------------------------------------- R4 interaction at the sales window
  await section('R4 Interaktion', async () => {
    await freshGame();
    const j0 = await readJournal('click');
    record('R4a Notizbuch (HUD-Knopf) im neuen Spiel: keine Personen, keine Geschichten (nichts Ungestartetes)', j0.noPeople && j0.noActive && j0.people.length === 0 && j0.quests.length === 0, JSON.stringify(j0.people));
    await arrange({ day: 2, minute: 600, paused: true, shutter: true, door: true, player: COUNTER, npcs: { [M]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[M] } } });
    await waitPrompt(names(M));
    const promptBox = await page.evaluate(() => {
      const r = document.querySelector('.ui-prompt').getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const target = await page.evaluate(() => window.__buedchen.game.getInteractionTarget());
    const info = (await page.evaluate(() => window.__buedchen.world.getResidentInfo())).find((i) => i.npcId === M);
    record('R4b Hinter der Theke, Marlene wartet am Fenster: Prompt „Mit Marlene Hoffmann sprechen“ sichtbar, Ziel ist die Bewohnerin, sie ist gezeichnet', promptBox && target?.kind === 'npc' && target.npcId === M && info?.visible === true && info.screen !== null, `Prompt ${JSON.stringify(await promptText())}`);
    const r0 = await rel(M);
    await pressE();
    const opened = await vis('panel-dialogue');
    const v = await dlg();
    const opts = await optionsDom();
    const name = await txt('dialogue-name');
    const text = await txt('dialogue-text');
    const tier = await txt('dialogue-tier');
    record('R4c E öffnet das Dialogpanel: Name, Beziehungsstufe, Text und 2–4 Optionen mit Tasten 1…n', opened && (await panelOpen()) === 'dialogue' && name === npcName(M) && tier.length > 0 && text === norm(v.text) && v.dialogueId === 'dialogue.marlene.erstes-mal' && opts.length >= 2 && opts.length <= 4 && opts.every((o, i) => o.key === String(i + 1)) && (await promptText()) === null, `${name}, ${tier}, Optionen ${opts.map((o) => `${o.key}:${o.id}`).join(' ')}`);
    const before = await pos();
    for (const k of ['KeyS', 'KeyD']) await page.keyboard.down(k);
    await waitSteps(60);
    const mid = await pos();
    for (const k of ['KeyS', 'KeyD']) await page.keyboard.up(k);
    await waitSteps(3);
    record('R4d Bei offenem Dialog bewegen gehaltene Tasten den Spieler nicht', Math.hypot(mid.x - before.x, mid.z - before.z) < 0.001, `Δ=${f(Math.hypot(mid.x - before.x, mid.z - before.z))} m`);
    await chooseOption('aushang', 'key');
    const afterKey = await st();
    const v2 = await dlg();
    record('R4e Option per Taste 1: Beziehung steigt, Erinnerung „marlene:aushang“ gespeichert, Folgeknoten sichtbar', afterKey.npcs[M].relationship >= r0 + 3 && afterKey.npcs[M].memories.includes('marlene:aushang') && afterKey.story.effectKeys.includes('k.marlene.aushang') && v2?.nodeId === 'aushang' && (await txt('dialogue-text')) === norm(v2.text), `Beziehung ${r0} → ${afterKey.npcs[M].relationship}`);
    await chooseOption('bye', 'click');
    const closed = await gone('panel-dialogue', 4000);
    const run = await hold(['KeyD'], (p, b) => p.x - b.x > 0.3, 4000);
    record('R4f Option per Klick beendet das Gespräch: Panel zu, kein Dialog offen, Spieler bewegt sich wieder', closed && (await dlg()) === null && (await panelOpen()) === null && run.dx > 0.25, `Δx=${f(run.dx)}`);
    // second conversation: opened by clicking the prompt, closed with Escape
    await arrange({ day: 2, minute: 600, paused: true, shutter: true, door: true, player: COUNTER, npcs: { [M]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[M] } } });
    await openTalk(M, 'click');
    const v3 = await dlg();
    const optsClick = await optionsDom();
    await page.keyboard.press('Escape');
    const closedEsc = await gone('panel-dialogue', 4000);
    const q = await quest('quest.hof');
    record('R4g Klick auf den Prompt öffnet das Gespräch (Beschwerde-Dialog, 2 Optionen); Escape schließt es ohne Folgen (Geschichte nicht gestartet)', v3?.dialogueId === 'dialogue.marlene.hof-beschwerde' && optsClick.length === 2 && closedEsc && (await dlg()) === null && q === null && (await promptText()) === names(M), `Dialog ${v3?.dialogueId}, Optionen ${optsClick.map((o) => o.id).join('/')}`);
  });

  const hearBothSides = async () => {
    await say(M, 'dialogue.marlene.erstes-mal', ['aushang', 'bye'], 2);
    await say(M, 'dialogue.marlene.hof-beschwerde', ['verstehen', 'bye'], 2);
    await say(D, 'dialogue.derya.erstes-mal', ['werkstatt', 'bye'], 3);
    await say(D, 'dialogue.derya.hof-seite', ['zuhoeren', 'verstanden', 'bye'], 3);
  };

  // ---------------------------------------------------------------- R5 story A: compromise (bench), memory, reload
  await section('R5 Hofgeschichte Kompromiss', async () => {
    await freshGame();
    const benchRect = footprint(placementOf('placement.yard-bench'));
    // control run: without the bench the player walks straight through its future footprint
    await arrange({ player: { x: -5.6, z: 1.4, h: Math.PI } });
    const free = await hold(['KeyW'], (p) => p.z < -1.2, 6000);
    record('R5a Ohne Flag yard.bench: Bank nicht gezeichnet, Spieler läuft durch ihren späteren Platz (Kontrolllauf)', (await gatedVisible('placement.yard-bench')) === false && free.after.z < -1.0, `z=${f(free.after.z)}, gated ${JSON.stringify(await gated())}`);

    await say(M, 'dialogue.marlene.erstes-mal', ['aushang', 'bye'], 2);
    const rBefore = await rel(M);
    await say(M, 'dialogue.marlene.hof-beschwerde', ['verstehen', 'bye'], 2);
    const s1 = await st();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('buedchensim.save.slot1')));
    record('R5b Dialogoption „Das klingt anstrengend“ verändert den Spielstand: Geschichte Schritt „beschwerde“, Erinnerung, Beziehung +3 – und steht im gespeicherten Spielstand (Schema 3)', s1.story.quests['quest.hof']?.step === 'beschwerde' && s1.npcs[M].memories.includes('marlene:hof-beschwerde') && s1.npcs[M].relationship >= rBefore + 3 && stored.schemaVersion === 3 && stored.state.story.quests['quest.hof']?.step === 'beschwerde' && stored.state.npcs[M].memories.includes('marlene:hof-beschwerde'), `Beziehung ${rBefore} → ${s1.npcs[M].relationship}`);

    const j1 = await readJournal('key');
    record('R5c Notizbuch (Taste J): Marlene als bekannte Person, „Krach im Hinterhof“ aktiv, „Ein Paket für Günter“ (ungestartet) fehlt, Jonas/Günter/Derya noch nicht getroffen', j1.people.length === 1 && j1.people[0] === M && j1.quests.length === 1 && j1.quests[0] === 'quest.hof' && j1.text.includes(npcName(M)) && j1.text.includes('Krach im Hinterhof') && !j1.text.includes('Ein Paket für Günter'), `Personen ${j1.people.join(',')}, Geschichten ${j1.quests.join(',')}`);

    await say(D, 'dialogue.derya.erstes-mal', ['werkstatt', 'bye'], 3);
    await say(D, 'dialogue.derya.hof-seite', ['zuhoeren', 'verstanden', 'bye'], 3);
    const q2 = await quest('quest.hof');
    const before = { d: await rel(D), m: await rel(M) };
    // the decision: key press on the compromise option (only offered with trust in both)
    await arrange({ day: 3, minute: 600, paused: true, shutter: true, door: true, player: COUNTER, npcs: { [D]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[D] } } });
    await openTalk(D);
    const decide = await dlg();
    const decideOpts = (await optionsDom()).map((o) => o.id);
    await chooseOption('vermitteln', 'key');
    await chooseOption('bye', 'key');
    await gone('panel-dialogue', 4000);
    const s2 = await st();
    record('R5d Geschichte A, Entscheidung „Kompromiss“ (per Taste): Dialog bietet vier Optionen, Ausgang kompromiss, Flag yard.bench, Erinnerungen, Beziehungen Derya +5 / Marlene +5', q2?.step === 'gegenseite' && decide.dialogueId === 'dialogue.derya.hof-entscheidung' && decideOpts.join() === 'vermitteln,derya,marlene,raushalten' && s2.story.quests['quest.hof'].outcome === 'kompromiss' && s2.story.flags['yard.bench'] === true && s2.npcs[D].memories.includes('derya:hof-kompromiss') && s2.npcs[M].memories.includes('marlene:hof-kompromiss') && s2.npcs[D].relationship - before.d === 5 && s2.npcs[M].relationship - before.m === 5, `Optionen ${decideOpts.join('/')}, Δ Derya ${s2.npcs[D].relationship - before.d}, Δ Marlene ${s2.npcs[M].relationship - before.m}`);

    // bench in the scene and in the way
    await waitUntil(async () => ((await gatedVisible('placement.yard-bench')) === true ? true : null), 5000);
    await arrange({ player: { x: -5.6, z: 1.4, h: Math.PI } });
    const run = await holdUntilStopped(['KeyW'], benchRect);
    const tr = await page.evaluate(() => window.__buedchen.world.getPlacementTransform('placement.yard-bench'));
    record('R5e Nach dem Kompromiss: Bank E-004 gezeichnet (getGatedPlacements) und der Spielerkreis stoppt an ihrem Footprint', (await gatedVisible('placement.yard-bench')) === true && tr !== null && Math.abs(tr.x + 5.6) < 0.01 && run.stopped && run.pos.z > benchRect.maxZ && run.min >= PLAYER_RADIUS - 0.01 && run.finalDist <= PLAYER_RADIUS + 0.02, `Spieler endet bei z=${f(run.pos.z)}, Bankkante z=${f(benchRect.maxZ)}, Abstand ${f(run.finalDist)}`);

    // later visit: the decision is remembered, also after a reload
    await arrange({ day: 4, minute: 600, paused: true, shutter: true, door: true, player: COUNTER, npcs: { [M]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[M] } } });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await reload(false);
    const afterReload = await st();
    await waitPrompt(names(M), 10000);
    await pressE();
    await vis('panel-dialogue');
    const memo = await dlg();
    const memoText = await txt('dialogue-text');
    const memoOpts = await optionsDom();
    record('R5f Nach Reload: Entscheidung, Flag und Erinnerungen sind da, die Bank wird gezeichnet, und Marlene erinnert sich beim nächsten Besuch (Dialog „nachklang-kompromiss“ nennt die Bank)', afterReload.story.quests['quest.hof'].outcome === 'kompromiss' && afterReload.story.flags['yard.bench'] === true && afterReload.npcs[M].memories.includes('marlene:hof-kompromiss') && (await gatedVisible('placement.yard-bench')) === true && memo.dialogueId === 'dialogue.marlene.nachklang-kompromiss' && /Bank/.test(memoText), `Dialog ${memo.dialogueId}: „${memoText.slice(0, 70)}…“`);
    await chooseOption(memoOpts[0].id);
    await closeDialogueIfOpen();
    await gone('panel-dialogue', 3000);
    const j2 = await readJournal('click');
    record('R5g Notizbuch nach der Entscheidung: Geschichte „Krach im Hinterhof“ abgeschlossen (Ausgang-Text), Marlene und Derya als bekannte Personen', j2.people.includes(M) && j2.people.includes(D) && !j2.people.includes(J) && j2.text.includes('Bank') && j2.quests.join() === 'quest.hof', `Personen ${j2.people.join(',')}`);
  });

  // ---------------------------------------------------------------- R6 story A: second outcome (siding with Derya)
  await section('R6 Hofgeschichte Derya', async () => {
    await freshGame();
    await hearBothSides();
    const before = { d: await rel(D), m: await rel(M) };
    await say(D, 'dialogue.derya.hof-entscheidung', ['derya', 'bye'], 3);
    const s = await st();
    record('R6a Geschichte A, zweiter Ausgang „derya“ über die UI: Derya +6, Marlene −8, keine Bank (Flag aus, nicht gezeichnet), Erinnerung bei Marlene', s.story.quests['quest.hof'].outcome === 'derya' && s.npcs[D].relationship - before.d === 6 && s.npcs[M].relationship - before.m === -8 && s.story.flags['yard.bench'] !== true && (await gatedVisible('placement.yard-bench')) === false && s.npcs[M].memories.includes('marlene:hof-uebergangen'), `Δ Derya ${s.npcs[D].relationship - before.d}, Δ Marlene ${s.npcs[M].relationship - before.m}`);
    await arrange({ day: 4, minute: 600, paused: true, shutter: true, door: true, player: COUNTER, npcs: { [M]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[M] } } });
    await openTalk(M);
    const v = await dlg();
    await closeDialogueIfOpen();
    record('R6b Spätere Reaktion unterscheidet sich vom Kompromiss: Marlene zeigt „nachklang-derya“', v?.dialogueId === 'dialogue.marlene.nachklang-derya', v?.dialogueId);
  });

  // ---------------------------------------------------------------- R7 story B: parcel for Günter (photo / refusal)
  await section('R7 Paketgeschichte', async () => {
    await freshGame();
    record('R7a Vor der Geschichte: Foto I-013 nicht auf der Theke, Flag kiosk.photo aus', (await gatedVisible('placement.kiosk-photo')) === false && !(await flagOf('kiosk.photo')), JSON.stringify(await gated()));
    await say(G, 'dialogue.guenter.erstes-mal', ['zusagen', 'bye'], 2);
    await say(G, 'dialogue.guenter.paket-bitte', ['anbieten', 'bye'], 2);
    await say(J, 'dialogue.jonas.erstes-mal', ['rad', 'bye'], 2);
    await say(J, 'dialogue.jonas.paket', ['annehmen', 'bye'], 2);
    const mid = await st();
    await say(G, 'dialogue.guenter.paket-uebergabe', ['uebergeben', 'bye'], 3);
    const cash = (await st()).economy.cashCents;
    await say(G, 'dialogue.guenter.foto-offen', ['zeigen', 'aufhaengen', 'bye'], 4);
    const s = await st();
    await waitUntil(async () => ((await gatedVisible('placement.kiosk-photo')) === true ? true : null), 5000);
    const photo = placementOf('placement.kiosk-photo');
    const tr = await page.evaluate(() => window.__buedchen.world.getPlacementTransform('placement.kiosk-photo'));
    record('R7b Geschichte B bis zum Ende über die UI (6 Gespräche, 3 Figuren): Jonas legt das Paket ab (Flag parcel.at-kiosk), Günter übernimmt es, Ausgang „foto“, Flag kiosk.photo, keine Geldprämie', mid.story.flags['parcel.at-kiosk'] === true && s.story.flags['parcel.at-kiosk'] !== true && s.story.quests['quest.paket'].outcome === 'foto' && s.story.flags['kiosk.photo'] === true && s.economy.cashCents === cash && s.npcs[G].memories.includes('guenter:foto-geschenkt') && s.npcs[J].memories.includes('jonas:paket-abgegeben'), `Quest ${JSON.stringify(s.story.quests['quest.paket'])}`);
    record('R7c Das gerahmte Foto steht auf der Theke (gezeichnet, an der Platzierung, auf Thekenhöhe)', (await gatedVisible('placement.kiosk-photo')) === true && tr !== null && Math.abs(tr.x - photo.position.x) < 0.01 && Math.abs(tr.z - photo.position.z) < 0.01 && Math.abs(tr.y - baseHeight(photo)) < 0.01 && tr.y > 0.5, `y=${tr ? f(tr.y) : '-'} (Soll ${f(baseHeight(photo))})`);
    const j = await readJournal('click');
    record('R7d Notizbuch: „Ein Paket für Günter“ abgeschlossen (Foto), Günter und Jonas bekannt, „Krach im Hinterhof“ (ungestartet) fehlt', j.quests.join() === 'quest.paket' && j.text.includes('Foto') && j.people.includes(G) && j.people.includes(J) && !j.people.includes(M) && !j.text.includes('Krach im Hinterhof'), `Personen ${j.people.join(',')}, Geschichten ${j.quests.join(',')}`);
    // second outcome
    await freshGame();
    await say(G, 'dialogue.guenter.erstes-mal', ['offen', 'bye'], 2);
    const r = await rel(G);
    await say(G, 'dialogue.guenter.paket-bitte', ['absagen', 'bye'], 2);
    const s2 = await st();
    record('R7e Geschichte B, zweiter Ausgang „abgelehnt“ über die UI: Beziehung −3, kein Foto (Flag aus, nicht gezeichnet), Notizbuch führt die Geschichte als abgeschlossen', s2.story.quests['quest.paket'].outcome === 'abgelehnt' && s2.npcs[G].relationship === r - 3 && !s2.story.flags['kiosk.photo'] && (await gatedVisible('placement.kiosk-photo')) === false && (await readJournal('key')).quests.join() === 'quest.paket', `Beziehung ${r} → ${s2.npcs[G].relationship}`);
  });

  // ---------------------------------------------------------------- R8 wishes, sale exactly once, age limit
  const shelfOf = (e, pid) => Object.values(e.shelves).filter((s) => s.productId === pid).reduce((a, s) => a + s.quantity, 0);
  const wishDef = (id, wishId) => data.npcs[id].wishes.find((w) => w.id === wishId);
  /** Presses/clicks an option without waiting for the node to change (a refused sale keeps the node). */
  const act = async (optionId, via = 'click') => {
    const o = (await optionsDom()).find((x) => x.id === optionId);
    if (!o) throw new Error(`Option ${optionId} fehlt`);
    if (via === 'key') {
      if (!(await ensureFocus())) throw new Error('kein Fokus');
      await page.keyboard.press(String(o.key));
    } else if (via === 'dblclick') await tid(`dialogue-option-${optionId}`).dblclick();
    else await tid(`dialogue-option-${optionId}`).click();
    await sleep(500);
  };
  await section('R8 Wunsch und Verkauf', async () => {
    await freshGame();
    const wishes = NPC_IDS.map((id) => [id, wishOf[id]]).filter(([id, w]) => w !== null && data.npcs[id].wishes.some((x) => x.id === w));
    record('R8a Alle vier Bewohner haben bei ihrem Auftritt (R1) einen Warenwunsch geäußert (npc.wish, Wunsch aus den eigenen Wünschen)', wishes.length === 4 && wishes.length >= 2, wishes.map(([id, w]) => `${npcName(id).split(' ')[0]}: ${w}`).join(', '));

    for (const [id, via] of [[G, 'key'], [D, 'dblclick']]) {
      const entry = entryOf(id);
      await arrange({ seed: foundSeed, day: days[id], minute: entry.from, paused: false, speed: 4, shutter: true, door: true, player: COUNTER, shelves: STOCK });
      const arrived = await waitUntil(async () => ((await npcState(id)).status === 'waiting' ? true : null), 90000, 100);
      await tid('hud-pause').click(); // real pause button: nothing moves while we serve
      await waitUntil(async () => ((await st()).calendar.paused ? true : null), 3000);
      await openTalk(id);
      const v = await dlg();
      const w = wishDef(id, v.customer?.wishId);
      const e0 = await eco();
      const lineChecks = [];
      for (const l of w.lines) {
        const row = await txt(`customer-line-${l.productId}`);
        lineChecks.push(row.includes(`${l.quantity} ×`) && row.includes(String(shelfOf(e0, l.productId))));
      }
      const total = w.lines.reduce((a, l) => a + l.quantity * P[l.productId].suggestedPriceCents, 0);
      const sellKey = (await optionsDom()).find((o) => o.id === 'sell').key;
      record(`R8b ${npcName(id)} am Fenster: Prompt, Kundenansicht mit Wunschtext „${w.text.slice(0, 30)}…“, Waren, Regalbestand und Summe ${eur(total)}`, arrived !== null && v.dialogueId === 'dialogue.customer' && (await txt('dialogue-text')) === norm(w.text) && lineChecks.every(Boolean) && (await txt('customer-total')) === eur(total) && v.customer.totalCents === total, `Zeilen ${w.lines.map((l) => `${l.quantity}×${l.productId.split('.')[1]}`).join(', ')}`);
      const n0 = e0.transactions.length;
      if (via === 'key') {
        await page.keyboard.press(sellKey);
        await page.keyboard.press(sellKey); // second activation right away: must not sell again
      } else await tid('dialogue-option-sell').dblclick();
      await waitUntil(async () => ((await eco()).transactions.length > n0 ? true : null), 4000);
      await sleep(700);
      const e1 = await eco();
      const tx = e1.transactions[e1.transactions.length - 1];
      const stockOk = w.lines.every((l) => shelfOf(e1, l.productId) === shelfOf(e0, l.productId) - l.quantity);
      record(`R8c ${npcName(id)}: Verkauf über die Dialogoption (${via === 'key' ? 'Taste zweimal schnell' : 'Doppelklick'}) ändert Kasse und Regalbestand genau einmal; Transaktion trägt die npcId`, e1.transactions.length === n0 + 1 && e1.cashCents === e0.cashCents + total && stockOk && tx.npcId === id && (await txt('hud-cash')) === eur(e1.cashCents) && (await dlg()) !== null, `Kasse ${eur(e0.cashCents)} → ${eur(e1.cashCents)}, Transaktionen ${n0} → ${e1.transactions.length}, npcId ${tx.npcId}`);
      await closeDialogueIfOpen();
    }

    // Jonas (17) and the tobacco
    await arrange({ day: 6, minute: 660, paused: true, shutter: true, door: true, player: COUNTER, shelves: STOCK, npcs: { [J]: { place: 'place.kiosk-window', spot: 1, routine: 'j.sa', wish: 'wish.jonas-tabak' } } });
    await openTalk(J);
    const w = wishDef(J, 'wish.jonas-tabak');
    const e0 = await eco();
    const ageLine = await txt('customer-age');
    const vJ = await dlg();
    await act('sell', 'key');
    const msg1 = await messageText('dialogue-message');
    const eA = await eco();
    await act('checkId', 'click');
    const age = await txt('customer-age');
    await act('sell', 'click');
    const msg2 = await messageText('dialogue-message');
    const e1 = await eco();
    const vAfter = await dlg();
    record('R8d Jonas (17) will Drehtabak: Wunschtext, Hinweis „ab 18“; Verkauf ohne Ausweisprüfung wird sichtbar abgelehnt', vJ.dialogueId === 'dialogue.customer' && (await txt('dialogue-text')).length > 0 && ageLine.includes('18') && msg1 !== null && /Altersprüfung/.test(msg1) && eA.cashCents === e0.cashCents && eA.transactions.length === e0.transactions.length, `Alter: ${ageLine}; Meldung ${JSON.stringify(msg1)}`);
    record('R8e Nach der Ausweisprüfung zeigt die Ansicht „17 Jahre“; der Verkauf wird mit sichtbarer Meldung abgelehnt; Kasse, Regalbestand und Transaktionen bleiben unverändert', /17 Jahre/.test(age) && msg2 !== null && /Zu jung/.test(msg2) && e1.cashCents === e0.cashCents && shelfOf(e1, 'product.zechenhof-drehtabak-30') === shelfOf(e0, 'product.zechenhof-drehtabak-30') && e1.transactions.length === e0.transactions.length && vAfter?.customer?.revealedAge === 17 && w.lines[0].productId === 'product.zechenhof-drehtabak-30', `${age}; Meldung ${JSON.stringify(msg2)}; Kasse ${eur(e1.cashCents)}`);
    await closeDialogueIfOpen();
  });

  // ---------------------------------------------------------------- R9 reload keeps relationships, routine state, story progress and flags
  await section('R9 Reload Routinen', async () => {
    await freshGame();
    await say(D, 'dialogue.derya.erstes-mal', ['werkstatt', 'bye'], 2);
    await say(M, 'dialogue.marlene.erstes-mal', ['aushang', 'bye'], 2);
    await say(M, 'dialogue.marlene.hof-beschwerde', ['verstehen', 'bye'], 2);
    const entry = entryOf(D);
    await arrange({ seed: foundSeed, day: days[D], minute: entry.from, paused: false, speed: 1, shutter: true, door: true, player: COUNTER });
    const walking = await waitUntil(async () => {
      const n = await npcState(D);
      return n.status === 'walking' && n.route.length > 0 && Math.hypot(n.position.x + 10.2, n.position.z + 6.3) > 3 ? n : null;
    }, 60000, 100);
    await tid('hud-pause').click();
    await waitUntil(async () => ((await st()).calendar.paused ? true : null), 3000);
    await waitSteps(5);
    const pick = (s) => JSON.stringify({ cal: s.calendar, npcs: s.npcs, story: s.story, seed: s.world.seed, kiosk: s.kiosk, cash: s.economy.cashCents });
    const a = await st();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await reload(false);
    const b = await st();
    const info = (await page.evaluate(() => window.__buedchen.world.getResidentInfo())).find((i) => i.npcId === D);
    record('R9a Reload mitten im Weg: Deryas Position, Weg, Routine, Platz und alle Beziehungen/Erinnerungen, Geschichte (Schritt „beschwerde“), Uhr und Seed stimmen exakt überein; sie wird an derselben Stelle gezeichnet', walking !== null && pick(a) === pick(b) && b.story.quests['quest.hof']?.step === 'beschwerde' && b.npcs[D].status === 'walking' && b.npcs[D].routineId === ROUTINE[D] && info?.visible === true && Math.hypot(info.position.x - b.npcs[D].position.x, info.position.z - b.npcs[D].position.z) < 0.2, `Derya ${f(b.npcs[D].position.x)}/${f(b.npcs[D].position.z)}, Rest-Weg ${b.npcs[D].route.length} Punkte, Beziehungen D ${b.npcs[D].relationship} M ${b.npcs[M].relationship}`);
    await tid('hud-speed-4').click();
    await tid('hud-pause').click();
    const arrived = await waitUntil(async () => {
      const n = await npcState(D);
      return n.placeId === 'place.kiosk-window' && (n.status === 'waiting' || n.status === 'at_place') ? n : null;
    }, 60000, 100);
    record('R9b Nach dem Reload läuft die Routine weiter: Derya erreicht das Verkaufsfenster und äußert ihren Wunsch', arrived !== null && (await npcState(D)).spotIndex !== null, `Status ${arrived?.status}`);
  });

  if (runResidents) {
    const lost = pageGone ? null : ctxLostTotal + (await page.evaluate(() => window.__ctxLost).catch(() => 0));
    record('R12 WebGL-Kontext im Bewohner-Abschnitt nie verloren (alle Seitenladungen)', lost === 0, lost === null ? 'nicht lesbar' : `${lost} Ereignisse`);
    await closeEcoCtx();
  }

  // ---------------------------------------------------------------- R13 screenshots Auftrag 04 (deviceScaleFactor 2) -> docs/screenshots/auftrag-04/
  await section('R13 Screenshots Auftrag 04', async () => {
    await newEcoPage('shots04', 2, resLib);
    await waitSteps(10, 15000);
    const settle = async (inside) => {
      const t0 = (await simStats()).seconds;
      await page.waitForFunction((t) => window.__buedchen.world.getSimStats().seconds > t + 2, t0, { timeout: 40000 });
      await page.waitForFunction((inside) => window.__buedchen.world.getKioskVisibility().roof === !inside, inside, { timeout: 40000 });
      await page.waitForFunction(() => document.querySelectorAll('.ui-notice').length === 0, null, { timeout: 40000 });
      await sleep(800);
    };
    const shot = async (file, name, inside, checks) => {
      await settle(inside);
      const extra = await checks();
      await capture(page, file, shotDir04);
      record(`Screenshot auftrag-04/${file} geschrieben (${name})`, extra.ok, extra.info);
    };
    const infoOf = async (id) => (await page.evaluate(() => window.__buedchen.world.getResidentInfo())).find((i) => i.npcId === id);
    const base = { seed: foundSeed, shutter: true, shelves: STOCK, cash: 30000 };

    // 01: residents in the quarter (outside): Günter walks along the sidewalk, Jonas waits at the corner, Marlene at the window
    await page.evaluate(() => window.__buedchen.game.reset());
    await arrange({
      ...base, day: 2, minute: 870, paused: false, speed: 1, door: false, player: { x: 0.6, z: 2.45, h: Math.PI },
      npcs: {
        [G]: { place: 'place.corner', spot: 0, routine: 'g.ecke', from: 'wp.a-1', route: ['wp.a-2', 'wp.a-3', 'wp.a-4', 'wp.a-5', 'wp.a-6', 'wp.a-7', 'wp.a-8', 'wp.a-9', 'wp.corner-1'] },
        [J]: { place: 'place.corner', spot: 2, routine: 'j.di' },
        [M]: { place: 'place.kiosk-window', spot: 0, routine: ROUTINE[M] },
      },
    });
    await waitUntil(async () => ((await npcState(G)).position.x > -3.2 ? true : null), 40000, 50);
    await shot('01-bewohner-im-viertel.png', 'Günter geht über den Gehweg, Jonas am Eck, Marlene am Verkaufsfenster; Außenansicht', false, async () => {
      const gi = await infoOf(G);
      const ji = await infoOf(J);
      const mi = await infoOf(M);
      const visible = [gi, ji, mi].filter((i) => i?.visible && i.screen !== null).length;
      return { ok: visible === 3 && gi.animation !== (await infoOf(J)).animation, info: `${visible} Bewohner im Bild, Günter ${gi.animation} bei x=${f(gi.position.x)}, Jonas ${ji.animation}, Marlene ${mi.animation}` };
    });

    // 02: customer at the sales window, player behind the counter, prompt visible
    await arrange({ ...base, day: 2, minute: 440, paused: true, door: true, player: COUNTER, npcs: { [G]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[G], wish: 'wish.guenter-echo' } } });
    await waitPrompt(names(G));
    await shot('02-kunde-am-fenster.png', 'Günter wartet am Fenster, Spieler hinter der Theke, Prompt „Mit Günter Wollny sprechen“', true, async () => {
      const gi = await infoOf(G);
      return { ok: gi.visible && gi.screen !== null && (await promptText()) === names(G) && (await panelOpen()) === null, info: `Prompt ${JSON.stringify(await promptText())}` };
    });

    // 03: story dialogue (Marlene's complaint)
    await page.evaluate(() => window.__buedchen.game.reset());
    await arrange({ ...base, day: 2, minute: 600, paused: true, door: true, player: COUNTER });
    await say(M, 'dialogue.marlene.erstes-mal', ['aushang', 'bye'], 2);
    await arrange({ ...base, day: 2, minute: 600, paused: true, door: true, player: COUNTER, npcs: { [M]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[M] } } });
    await openTalk(M);
    await shot('03-dialog.png', 'Marlenes Beschwerde über den Sägelärm mit zwei Antwortoptionen', true, async () => {
      const v = await dlg();
      const opts = await optionsDom();
      return { ok: v.dialogueId === 'dialogue.marlene.hof-beschwerde' && opts.length >= 2 && opts.length <= 4 && (await panelOpen()) === 'dialogue', info: `${v.dialogueId}, Optionen ${opts.map((o) => o.id).join('/')}` };
    });
    await page.keyboard.press('Escape');
    await gone('panel-dialogue', 4000);

    // 04: customer view
    await arrange({ ...base, day: 2, minute: 440, paused: true, door: true, player: COUNTER, npcs: { [G]: { place: 'place.kiosk-window', spot: 1, routine: ROUTINE[G], wish: 'wish.guenter-echo' } } });
    await openTalk(G);
    await shot('04-kundenwunsch.png', 'Günters Wunsch (Echo + 2 Brötchen) mit Zeilen, Regalbestand und Summe', true, async () => {
      const v = await dlg();
      const rows = await page.locator('[data-testid^="customer-line-"]').count();
      return { ok: v.dialogueId === 'dialogue.customer' && rows >= 2 && (await txt('customer-total')) === eur(270) && (await optionsDom()).some((o) => o.id === 'sell'), info: `${rows} Zeilen, Summe ${await txt('customer-total')}` };
    });
    await page.keyboard.press('Escape');
    await gone('panel-dialogue', 4000);

    // 05: age limit
    await arrange({ ...base, day: 6, minute: 660, paused: true, door: true, player: COUNTER, npcs: { [J]: { place: 'place.kiosk-window', spot: 1, routine: 'j.sa', wish: 'wish.jonas-tabak' } } });
    await openTalk(J);
    await act('checkId', 'click');
    await act('sell', 'click');
    await shot('05-altersgrenze.png', 'Jonas (17) will Drehtabak: Ausweis „17 Jahre“, Verkauf abgelehnt', true, async () => {
      const age = await txt('customer-age');
      const msg = await messageText('dialogue-message');
      return { ok: /17 Jahre/.test(age) && msg !== null && /Zu jung/.test(msg) && (await eco()).transactions.length === 0, info: `${age}; ${msg}` };
    });
    await page.keyboard.press('Escape');
    await gone('panel-dialogue', 4000);

    await page.evaluate(() => window.__buedchen.game.reset());
    // 06: consequence of story A: the bench with residents
    await arrange({
      ...base, day: 4, minute: 1010, paused: true, door: false, player: { x: -5.4, z: 3.9, h: Math.PI },
      flags: { 'yard.bench': true }, quests: { 'quest.hof': { step: 'entscheidung', outcome: 'kompromiss' } },
      npcs: {
        [M]: { place: 'place.yard-bench', spot: 0, routine: 'm.hof-bank', heading: 0.9 },
        [G]: { place: 'place.yard-bench', spot: 2, routine: 'g.bank', heading: -0.9 },
      },
    });
    await shot('06-folge-hofbank.png', 'Hofbank (Flag yard.bench) mit Marlene und Günter am Bankplatz', false, async () => {
      const vis3 = await Promise.all([M, G].map(infoOf));
      const gp = (await gated()).find((x) => x.id === 'placement.yard-bench');
      return { ok: gp?.visible === true && vis3.every((i) => i.visible && i.screen !== null), info: `Bank gezeichnet=${gp?.visible}, ${vis3.filter((i) => i.screen).length} Bewohner im Bild` };
    });

    await page.evaluate(() => window.__buedchen.game.reset());
    // 07: consequence of story B: the photo on the counter
    await arrange({
      ...base, day: 6, minute: 600, paused: true, door: true, player: COUNTER,
      flags: { 'kiosk.photo': true }, quests: { 'quest.paket': { step: 'uebergeben', outcome: 'foto' } },
      npcs: { [G]: { place: 'place.kiosk-window', spot: 2, routine: ROUTINE[G] } },
    });
    await shot('07-folge-foto.png', 'Gerahmtes Foto I-013 auf der Theke (Flag kiosk.photo), Günter am Fenster', true, async () => {
      const gp = (await gated()).find((x) => x.id === 'placement.kiosk-photo');
      return { ok: gp?.visible === true, info: `Foto gezeichnet=${gp?.visible}` };
    });

    await page.evaluate(() => window.__buedchen.game.reset());
    // 08: journal
    await arrange({
      ...base, day: 6, minute: 600, paused: true, door: true, player: COUNTER,
      flags: { 'kiosk.photo': true },
      quests: { 'quest.hof': { step: 'gegenseite', outcome: null }, 'quest.paket': { step: 'uebergeben', outcome: 'foto' } },
      npcs: {
        [G]: { place: 'place.exit-west', spot: 0, status: 'away', rel: 52, lastTalk: { day: 5, minute: 600 }, memories: ['served:wish.guenter-echo', 'guenter:foto-geschenkt'] },
        [M]: { place: 'place.exit-hof', spot: 0, status: 'away', rel: 38, lastTalk: { day: 4, minute: 600 }, memories: ['marlene:hof-beschwerde'] },
      },
    });
    await page.evaluate(() => {
      const s = window.__buedchen.game.state;
      for (const n of Object.values(s.npcs)) { n.status = 'away'; n.placeId = null; n.spotIndex = null; }
    });
    await tid('hud-open-journal').click();
    await vis('panel-journal');
    await shot('08-notizbuch.png', 'Notizbuch mit zwei bekannten Personen, einer laufenden und einer abgeschlossenen Geschichte', true, async () => {
      const j = await journalState();
      return { ok: j.people.length === 2 && j.quests.length === 2 && j.text.includes('Krach im Hinterhof'), info: `Personen ${j.people.join(',')}, Geschichten ${j.quests.join(',')}` };
    });
    await page.keyboard.press('Escape');
    await gone('panel-journal', 3000);

    await page.evaluate(() => window.__buedchen.game.reset());
    // 09: the four figures together
    await arrange({
      ...base, day: 6, minute: 600, paused: true, door: false, player: { x: 0.9, z: 3.9, h: Math.PI / 2 },
      npcs: {
        [G]: { place: 'place.corner', spot: 0, routine: 'g.ecke', pos: { x: 3.2, z: 2.9 }, heading: 0 },
        [D]: { place: 'place.corner', spot: 1, routine: 'd.bank', pos: { x: 4.1, z: 2.9 }, heading: 0 },
        [J]: { place: 'place.corner', spot: 2, routine: 'j.di', pos: { x: 5.0, z: 2.9 }, heading: 0 },
        [M]: { place: 'place.yard-bench', spot: 0, routine: 'm.hof-bank', pos: { x: 5.9, z: 2.9 }, heading: 0 },
      },
    });
    await shot('09-figuren.png', 'Günter, Derya, Jonas und Marlene nebeneinander, dem Betrachter zugewandt', false, async () => {
      const all = await Promise.all(NPC_IDS.map(infoOf));
      return { ok: all.every((i) => i.visible && i.screen !== null), info: all.map((i) => `${i.npcId.split('.')[1]} ${Math.round(i.screen?.x ?? -1)}/${Math.round(i.screen?.y ?? -1)}`).join(' ') };
    });
    const lost = pageGone ? null : ctxLostTotal + (await page.evaluate(() => window.__ctxLost).catch(() => 0));
    record('R14 WebGL-Kontext im Screenshot-Abschnitt Auftrag 04 nie verloren', lost === 0, lost === null ? 'nicht lesbar' : `${lost} Ereignisse`);
    await closeEcoCtx();
  });

} catch (error) {
  record('Unerwarteter Fehler im Check-Skript', false, pageGone ?? (error instanceof Error ? error.stack : String(error)));
} finally {
  if (pageGone) record('Seite/Browser während des Checks verloren', false, pageGone);
  record('8 Keine Konsolenfehler / pageerrors', problems.length === 0, problems.join(' | '));
  expectClose = true;
  if (browser) await browser.close().catch(() => undefined);
  if (server) server.kill();
  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Ergebnis ---');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  console.log(`\n${results.length - failed.length}/${results.length} Checks bestanden (Laufzeit ${Math.round((Date.now() - startedAt) / 1000)} s)`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}
