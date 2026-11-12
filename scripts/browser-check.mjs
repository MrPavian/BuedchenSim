// Real-browser check: builds the game, serves it with `vite preview`, drives it with real key
// presses in Chromium (Playwright) and writes screenshots to docs/screenshots/.
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

const build = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0) {
  console.error('Build failed');
  process.exit(1);
}

const port = await freePort();
const server = spawn(
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

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const problems = [];
const watch = (page, label) => {
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`${label} console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${label} pageerror: ${e.message}`));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  watch(page, 'main');
  // Collects every notice text (they fade after a few seconds, so polling later would miss them).
  await page.addInitScript(() => {
    window.__notices = [];
    new MutationObserver(() => {
      for (const n of document.querySelectorAll('.ui-notice')) if (!window.__notices.includes(n.textContent)) window.__notices.push(n.textContent);
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
  await sleep(1500);

  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__buedchen.game.state)));
  const pos = async () => (await st()).player.position;

  // Records key event timestamps inside the page so speeds are measured in page time.
  await page.evaluate(() => {
    window.__keyLog = [];
    for (const type of ['keydown', 'keyup']) {
      window.addEventListener(type, (e) => {
        if (!e.repeat) window.__keyLog.push({ type, code: e.code, t: e.timeStamp });
      }, true);
    }
  });

  const hold = async (keys, ms) => {
    const before = await pos();
    await page.evaluate(() => (window.__keyLog.length = 0));
    for (const k of keys) await page.keyboard.down(k);
    await sleep(ms);
    for (const k of keys) await page.keyboard.up(k);
    await sleep(120);
    const after = await pos();
    const log = await page.evaluate(() => window.__keyLog);
    const down = log.find((e) => e.type === 'keydown')?.t ?? 0;
    const up = [...log].reverse().find((e) => e.type === 'keyup')?.t ?? down + ms;
    return { before, after, dx: after.x - before.x, dz: after.z - before.z, seconds: (up - down) / 1000 };
  };

  // Greedy controller with real key presses until close to a target (or timeout).
  const walkTo = async (target, timeoutMs = 9000, tol = 0.12) => {
    const held = new Set();
    const set = async (code, on) => {
      if (on && !held.has(code)) { await page.keyboard.down(code); held.add(code); }
      if (!on && held.has(code)) { await page.keyboard.up(code); held.delete(code); }
    };
    const end = Date.now() + timeoutMs;
    let p;
    while (Date.now() < end) {
      p = await pos();
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      if (Math.abs(dx) < tol && Math.abs(dz) < tol) break;
      await set('KeyD', dx > tol);
      await set('KeyA', dx < -tol);
      await set('KeyS', dz > tol);
      await set('KeyW', dz < -tol);
      await sleep(20);
    }
    for (const code of [...held]) await set(code, false);
    await sleep(150);
    return pos();
  };

  const promptText = () =>
    page.evaluate(() => {
      const el = document.querySelector('.ui-prompt');
      return el && !el.hidden && getComputedStyle(el).display !== 'none' ? el.textContent.replace(/^E/, '').trim() : null;
    });

  // Frame rate (info only; very low rates make speed checks unreliable).
  const fps = await page.evaluate(
    () => new Promise((resolve) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => (performance.now() - t0 > 1000 ? resolve(n) : (n++, requestAnimationFrame(tick)));
      requestAnimationFrame(tick);
    }),
  );
  console.log(`info: ~${fps} frames/s in this headless software-GL environment`);

  // 1. Canvas renders non-blank.
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { exists: false };
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return { exists: true, w: c.width, h: c.height, glOk: !!gl && !gl.isContextLost() };
  });
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
  const first = await analyse();
  record('1 Canvas vorhanden, WebGL ok, Bild nicht leer', canvasInfo.exists && canvasInfo.glOk && first.colours > 40, `${canvasInfo.w}x${canvasInfo.h}, ${first.colours} Farbklassen`);
  record('1b Spielfigur im Bild sichtbar', first.figure !== null, first.figure ? `${first.figure.n} Pixel` : 'nicht gefunden');

  // 2. Movement.
  const right = await hold(['KeyD'], 500);
  const left = await hold(['KeyA'], 500);
  const up = await hold(['KeyW'], 250);
  await hold(['KeyS'], 250);
  record('2a D bewegt +X', right.dx > 0.8 && Math.abs(right.dz) < 0.05, `dx=${f(right.dx)}`);
  record('2b A bewegt -X', left.dx < -0.8, `dx=${f(left.dx)}`);
  record('2c W bewegt -Z', up.dz < -0.4 && Math.abs(up.dx) < 0.05, `dz=${f(up.dz)}`);
  // Speed: sample the position on every animation frame inside the page while the keys stay held and
  // fit a line through distance over time. Endpoint timing and frame bursts barely affect the slope.
  const cruise = async (keys, ms) => {
    for (const k of keys) await page.keyboard.down(k);
    await sleep(250);
    const samples = await page.evaluate((duration) => new Promise((resolve) => {
      const out = [];
      const t0 = performance.now();
      const tick = () => {
        const p = window.__buedchen.game.state.player.position;
        const t = performance.now();
        out.push({ t: (t - t0) / 1000, x: p.x, z: p.z });
        if (t - t0 >= duration) resolve(out); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), ms);
    for (const k of keys) await page.keyboard.up(k);
    await sleep(120);
    const first = samples[0];
    const last = samples[samples.length - 1];
    const pts = samples.map((p) => ({ t: p.t, d: Math.hypot(p.x - first.x, p.z - first.z) }));
    const n = pts.length;
    const mt = pts.reduce((a, p) => a + p.t, 0) / n;
    const md = pts.reduce((a, p) => a + p.d, 0) / n;
    const slope = pts.reduce((a, p) => a + (p.t - mt) * (p.d - md), 0) / pts.reduce((a, p) => a + (p.t - mt) ** 2, 0);
    return { dx: last.x - first.x, dz: last.z - first.z, speed: slope, frames: n };
  };
  // Open yard west of the kiosk: nothing to slide along in either run.
  await walkTo({ x: -10, z: 0 }, 15000);
  const straight = await cruise(['KeyD'], 1300);
  await walkTo({ x: -10, z: 0 }, 15000);
  const diag = await cruise(['KeyW', 'KeyD'], 1300);
  const speedStraight = straight.speed;
  const speedDiag = diag.speed;
  const ratio = speedDiag / speedStraight;
  record('2d Diagonale ~ gleiche Geschwindigkeit wie geradeaus', ratio > 0.9 && ratio < 1.1 && speedStraight > 3.1 && speedStraight < 3.9 && diag.dx > 0 && diag.dz < 0 && Math.abs(Math.abs(diag.dx) - Math.abs(diag.dz)) < 0.2, `gerade ${f(speedStraight)} m/s, diagonal ${f(speedDiag)} m/s, Verhältnis ${f(ratio)}; erwartet ~3.5 m/s`);

  // 3. Camera follows: walk 6 m east, the figure stays in the same screen region.
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

  // 4. Collision with the wall / closed door.
  await walkTo({ x: 0.9, z: 3.6 });
  const wall = await hold(['KeyW'], 2000);
  record('4a Kollision: Wand stoppt Lauf nach Norden', wall.after.z > 2 + 0.3 - 0.01 && wall.after.z < 2.5, `z=${f(wall.after.z)}`);
  await walkTo({ x: 2.0, z: 3.2 });
  const door = await hold(['KeyW'], 2000);
  record('4b Kollision: geschlossene Tür blockiert', !(await st()).kiosk.doorOpen && door.after.z > 2 + 0.3 - 0.01, `z=${f(door.after.z)}`);

  // 5. Door interaction.
  const text1 = await promptText();
  const doorPos = await pos();
  const promptBox = await page.evaluate(() => {
    const r = document.querySelector('.ui-prompt').getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0 };
  });
  record('5a Prompt „Tür öffnen" sichtbar nahe der Tür', text1 === 'Tür öffnen' && promptBox.visible && Math.hypot(doorPos.x - 2, doorPos.z - 2) <= 1.4, `Text=${JSON.stringify(text1)}`);
  await page.keyboard.press('KeyE');
  await sleep(300);
  const text2 = await promptText();
  record('5b E öffnet die Tür, Prompt wechselt zu „Tür schließen"', (await st()).kiosk.doorOpen === true && text2 === 'Tür schließen', `Text=${JSON.stringify(text2)}`);
  const inside = await hold(['KeyW'], 800);
  record('5c Durch die offene Tür in den Innenraum (z < 2)', inside.after.z < 1.7, `z=${f(inside.after.z)}`);

  // 6. Shutter from inside behind the counter.
  await walkTo({ x: 2.0, z: 0.5 });
  const behind = await walkTo({ x: -1.0, z: 0.6 });
  const text3 = await promptText();
  await page.keyboard.press('KeyE');
  await sleep(300);
  const text4 = await promptText();
  record('6 Verkaufsklappe von innen hinter der Theke', behind.z < 1.0 && text3 === 'Verkaufsklappe öffnen' && (await st()).kiosk.shutterOpen === true && text4 === 'Verkaufsklappe schließen', `${JSON.stringify(text3)} -> ${JSON.stringify(text4)}`);

  // Walk around to the back of the kiosk (door stays open) for the persistence check.
  await walkTo({ x: 2.0, z: 0.8 });
  await walkTo({ x: 2.0, z: 3.2 });
  await walkTo({ x: 4.8, z: 3.2 });
  await walkTo({ x: 4.8, z: -4.2 });
  const back = await walkTo({ x: 0.0, z: -4.2 });
  record('6b Kiosk umrundet, Spieler steht hinter dem Kiosk', back.z < -3.9 && Math.abs(back.x) < 0.3, `x=${f(back.x)} z=${f(back.z)}`);

  // 7. Persistence across reload.
  const saved = await st();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // flush autosave like a real unload
  await page.reload();
  await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
  await sleep(800);
  const restored = await st();
  const noticeShown = await page.evaluate(() => window.__notices.includes('Spielstand geladen'));
  record(
    '7 Reload stellt Position und Tür/Klappe wieder her',
    Math.hypot(restored.player.position.x - saved.player.position.x, restored.player.position.z - saved.player.position.z) < 0.05 &&
      restored.kiosk.doorOpen === saved.kiosk.doorOpen && restored.kiosk.shutterOpen === saved.kiosk.shutterOpen &&
      restored.kiosk.doorOpen && restored.kiosk.shutterOpen && noticeShown,
    `x=${f(restored.player.position.x)} z=${f(restored.player.position.z)}, Hinweis „Spielstand geladen" ${noticeShown ? 'sichtbar' : 'fehlt'}`,
  );
  await context.close();

  // Screenshots at deviceScaleFactor 2, each in a fresh context that starts from a save file
  // (poses are set via localStorage; the interaction flow above used real key presses).
  const shoot = async (file, poseState, expectPrompt) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((s) => {
      localStorage.setItem('buedchensim.save.slot1', JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), state: s }));
    }, { regionId: 'region.ruhrgebiet', ...poseState });
    const p = await ctx.newPage();
    watch(p, file);
    await p.goto(url);
    await p.waitForFunction(() => window.__buedchen?.game, null, { timeout: 15000 });
    await sleep(3500);
    const prompt = await p.evaluate(() => {
      const el = document.querySelector('.ui-prompt');
      return el && !el.hidden ? el.textContent : null;
    });
    await p.screenshot({ path: path.join(shotDir, file) });
    await ctx.close();
    if (expectPrompt) record(`Screenshot ${file}: Prompt sichtbar`, prompt !== null, JSON.stringify(prompt));
    else record(`Screenshot ${file} geschrieben`, true);
  };
  await shoot('auftrag-01-aussen.png', { player: { position: { x: 1.7, z: 3.1 }, heading: Math.PI }, kiosk: { doorOpen: false, shutterOpen: true } }, true);
  await shoot('auftrag-01-innen.png', { player: { position: { x: -0.6, z: 0.5 }, heading: Math.PI }, kiosk: { doorOpen: true, shutterOpen: true } }, true);
  await shoot('auftrag-01-rueckseite.png', { player: { position: { x: 0, z: -4.2 }, heading: 0 }, kiosk: { doorOpen: false, shutterOpen: false } }, false);
} catch (error) {
  record('Unerwarteter Fehler im Check-Skript', false, error instanceof Error ? error.stack : String(error));
} finally {
  record('8 Keine Konsolenfehler / pageerrors', problems.length === 0, problems.join(' | '));
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Checks bestanden`);
process.exit(failed.length === 0 ? 0 : 1);
