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
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = path.join(root, 'docs', 'screenshots');
mkdirSync(shotDir, { recursive: true });

// CLI: `--only economy` runs only the economy/UI flow (no old sections, no screenshots), `--only shots` only the four
// auftrag-03 screenshots; without the flag everything runs (also via env BC_ONLY).
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : (process.env.BC_ONLY ?? null);
if (only !== null && !['economy', 'shots'].includes(only)) throw new Error(`unknown --only ${only} (economy | shots)`);
const runOld = only === null;
const runEconomy = only === null || only === 'economy';
const runShots = only === null || only === 'shots';

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
  const build = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.status !== 0) throw new Error('Build failed');

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
    // economy sections are named 'E…' (E13 = screenshots); everything else is an old section
    if (name.startsWith('E13') ? !runShots : name.startsWith('E') ? !runEconomy : !runOld) return;
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
    return JSON.parse(JSON.stringify({ layout: c.layout, assets: c.assets, products: c.products, stockSlots: c.stockSlots }));
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
  const capture = async (p, file) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await p.screenshot({ path: path.join(shotDir, file), timeout: 60000 });
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
  const newEcoPage = async (label, scale = 1) => {
    ecoCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
    page = await ecoCtx.newPage();
    watch(page, label);
    await page.addInitScript(initScript);
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
    record('E1a HUD: Tag 1, Uhr ab 06:00 (noch am Morgen), Startkasse 300,00 €', day === 'Tag 1' && minutes >= 360 && minutes <= 375 && cash === eur(START_CASH) && s.economy.cashCents === START_CASH, `${day}, ${await txt('hud-clock')}, ${cash}`);
    record('E1b HUD: Status „Geschlossen“ bei geschlossener Klappe, Tempo 1× aktiv, nicht pausiert', status === 'Geschlossen' && open === 'false' && !s.kiosk.shutterOpen && (await attr('hud-speed-1', 'aria-pressed')) === 'true' && (await attr('hud-pause', 'data-paused')) === 'false', `${status}`);
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
    await pressE();
    if (!(await vis('panel-till'))) throw new Error('Kassenpanel öffnet nicht');
    // (a) shutter still closed: rejected
    await clickN(`till-add-${ID.chips}`, 1);
    const k0 = await econKey();
    const warning = await vis('till-warning', 2000);
    await tid('till-submit').click();
    const msg = await messageText('till-message');
    record('E6a Verkauf bei geschlossener Klappe wird sichtbar abgelehnt, nichts ändert sich', warning && msg !== null && /Verkaufsklappe/.test(msg) && (await econKey()) === k0 && (await attr('hud-status', 'data-open')) === 'false', `Meldung ${JSON.stringify(msg)}`);
    await tid('till-cancel').click();
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
    await waitUntil(async () => ((await txt('hud-day')) === 'Tag 2' ? true : null), 4000);
    const s3 = await st();
    record('E9e „Nächsten Tag beginnen“: Tag 2, 06:00, Kasse/Lager/Regale unverändert, Tagessummen leer, Bericht geschlossen', (await txt('hud-day')) === 'Tag 2' && s3.calendar.day === 2 && s3.calendar.phase === 'open' && s3.calendar.minute >= 360 && s3.calendar.minute < 363 && s3.economy.cashCents === shelfSnapshot.cash && JSON.stringify(s3.economy.storage) === JSON.stringify(shelfSnapshot.storage) && JSON.stringify(s3.economy.shelves) === JSON.stringify(shelfSnapshot.shelves) && s3.economy.today.revenueCents === 0 && s3.economy.today.purchaseCents === 0 && (await panelOpen()) === null && (await txt('hud-cash')) === eur(shelfSnapshot.cash), `Uhr ${await txt('hud-clock')}, Kasse ${await txt('hud-cash')}`);
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
    record('E11c v1-Spielstand lädt: Position, Tür und Klappe bleiben, Wirtschaft mit Anfangswerten (Tag 1, 06:00, 300,00 €, leer)', Math.hypot(s.player.position.x + 3.5, s.player.position.z + 0.3) < 0.05 && s.kiosk.doorOpen === true && s.kiosk.shutterOpen === true && s.economy.cashCents === START_CASH && Object.keys(s.economy.storage).length === 0 && Object.keys(s.economy.shelves).length === 0 && s.economy.pendingDelivery === null && s.economy.lastReport === null && s.calendar.day === 1 && s.calendar.minute >= 360 && s.calendar.minute < 375 && s.calendar.phase === 'open' && noticeShown && (await txt('hud-day')) === 'Tag 1' && (await txt('hud-cash')) === eur(START_CASH) && (await attr('hud-status', 'data-open')) === 'true', `Tag ${s.calendar.day}, ${await txt('hud-clock')}, ${await txt('hud-cash')}, Hinweis ${noticeShown}`);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('buedchensim.save.slot1')));
    record('E11d Nach dem Laden wird im aktuellen Format (schemaVersion 2) gespeichert', stored.schemaVersion === 2 && stored.state.economy?.cashCents === START_CASH && stored.state.calendar?.day === 1, `schemaVersion ${stored.schemaVersion}`);
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
    await tid('hud-open-till').click();
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
    await tid('hud-open-goods').click();
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
  console.log(`\n${results.length - failed.length}/${results.length} Checks bestanden`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}
