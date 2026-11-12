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
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = path.join(root, 'docs', 'screenshots');
mkdirSync(shotDir, { recursive: true });

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
    window.__ctxLost = 0;
    new MutationObserver(() => {
      for (const n of document.querySelectorAll('.ui-notice')) if (!window.__notices.includes(n.textContent)) window.__notices.push(n.textContent);
    }).observe(document, { childList: true, subtree: true });
    window.addEventListener('webglcontextlost', () => {
      window.__ctxLost += 1;
      console.error('webglcontextlost');
    }, true);
  };

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
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
  const data = await page.evaluate(() => JSON.parse(JSON.stringify({ layout: window.__buedchen.game.content.layout, assets: window.__buedchen.game.content.assets })));
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
  const lost = pageGone ? null : await page.evaluate(() => window.__ctxLost).catch(() => null);
  record('8b WebGL-Kontext nie verloren', lost === 0, lost === null ? 'nicht lesbar' : `${lost} Ereignisse`);

  expectClose = true;
  await context.close();
  expectClose = false;

  // ---------------------------------------------------------------- screenshots (deviceScaleFactor 2)
  // Each in a fresh context that starts from a save file: the pose is set via localStorage, everything else is the real app.
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
      // Software-GL at deviceScaleFactor 2 occasionally needs very long for one frame: retry the capture itself.
      for (let attempt = 1; ; attempt += 1) {
        try {
          await p.screenshot({ path: path.join(shotDir, file), timeout: 60000 });
          break;
        } catch (error) {
          if (attempt >= 3) throw error;
          console.log(`info: screenshot ${file} attempt ${attempt} failed (${String(error.message).split('\n')[0]}), retrying`);
        }
      }
      const wantPrompt = expect.prompt ? prompt !== null : true;
      record(`Screenshot ${file} geschrieben (Kiosk-Sicht ${v.roof ? 'Dach sichtbar' : 'Dach weg'}${prompt ? `, Prompt ${JSON.stringify(prompt)}` : ''})`, wantPrompt && v.roof === !expect.inside);
    } finally {
      expectClose = true;
      await ctx.close();
      expectClose = false;
    }
  };
  await shoot('auftrag-02-aussen.png', { player: { position: { x: 1.7, z: 3.1 }, heading: Math.PI }, kiosk: { doorOpen: false, shutterOpen: true } }, { inside: false, prompt: true });
  await shoot('auftrag-02-innen.png', { player: { position: { x: 0.6, z: -0.3 }, heading: Math.PI }, kiosk: { doorOpen: true, shutterOpen: true } }, { inside: true });
  await shoot('auftrag-02-rueckseite.png', { player: { position: { x: 0, z: -4.2 }, heading: 0 }, kiosk: { doorOpen: false, shutterOpen: false } }, { inside: false });
  await shoot('auftrag-02-seite.png', { player: { position: { x: -3.5, z: -0.3 }, heading: Math.PI }, kiosk: { doorOpen: false, shutterOpen: true } }, { inside: false });
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
