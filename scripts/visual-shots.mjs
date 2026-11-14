// Reproducible reference views for the visual baseline (Auftrag 04.5): fixed game states (time, stock, residents,
// story flags) and fixed player poses, captured from the running app (vite dev server, headless Chromium).
//
//   node scripts/visual-shots.mjs --out <dir> [--scale 2] [--only aussen,innen]
//
// Writes <dir>/<view>.png (deviceScaleFactor --scale, default 2) and <dir>/metrics.json: per view the renderer
// statistics (draw calls, triangles, geometries, textures), drawn product units, visible residents and the frame time
// measured over 4 s at 1280x720 and deviceScaleFactor 1 with the game paused. Headless Chromium renders with
// SwiftShader (software); the frame times are only comparable with each other, never with real GPU hardware.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const outDir = path.resolve(flag('--out', 'visual-shots'));
const scale = Number(flag('--scale', '2'));
const only = flag('--only', '').split(',').filter(Boolean);
mkdirSync(outDir, { recursive: true });

const G = 'npc.guenter';
const D = 'npc.derya';
const J = 'npc.jonas';
const M = 'npc.marlene';

/** The reference views. `fill`: every presentation slot stocked to capacity; `crop`: a detail cut-out (CSS pixels). */
const VIEWS = {
  aussen: {
    note: 'Außenansicht: Fassade, Schild, Markise, Fenster, Eingang, Gehweg; Günter am Fenster, Marlene und Jonas am Eck',
    state: { day: 2, minute: 878, player: { x: -0.6, z: 3.6, h: Math.PI }, door: true, shutter: true, fill: 'some' },
    npcs: { [G]: { place: 'place.kiosk-window', spot: 1 }, [M]: { place: 'place.corner', spot: 0 }, [J]: { place: 'place.corner', spot: 2 } },
  },
  innen: {
    note: 'Innenraum: Theke, Regale, Kühlschrank, Truhe, Zeitschriftenständer voll bestückt; Spieler im Gang',
    state: { day: 2, minute: 878, player: { x: 0.6, z: -0.3, h: Math.PI }, door: true, shutter: true, fill: 'all' },
    npcs: {},
  },
  regale: {
    note: 'Bestückte Regale aus der Spielkamera: Wandregale, Mittelregal, Theke',
    state: { day: 2, minute: 878, player: { x: -1.6, z: -0.7, h: Math.PI }, door: true, shutter: true, fill: 'all' },
    npcs: {},
  },
  bewohner: {
    note: 'Bewohner im Viertel: Günter, Marlene und Derya an der Hofbank, Jonas auf dem Gehweg',
    state: { day: 4, minute: 1010, player: { x: -3.0, z: 3.4, h: Math.PI }, door: false, shutter: true, fill: 'some', flags: { 'yard.bench': true } },
    npcs: {
      [G]: { place: 'place.yard-bench', spot: 0 },
      [M]: { place: 'place.yard-bench', spot: 1 },
      [D]: { place: 'place.yard-bench', spot: 2 },
      [J]: { place: 'place.corner', spot: 0, pos: { x: -5.4, z: 3.3 }, heading: Math.PI / 2 },
    },
  },
  detail: {
    note: 'Detail Materialien: Ausschnitt der Fassade (Klinker, Putzband, Schild, Markise, Fensterbank, Tür) aus der Außenansicht',
    state: { day: 2, minute: 878, player: { x: -0.6, z: 3.6, h: Math.PI }, door: true, shutter: true, fill: 'some' },
    npcs: {},
    crop: { x: 330, y: 150, width: 640, height: 360 },
  },
};

const SOME = {
  'slot.counter.1': 'product.pottbaecker-broetchen',
  'slot.counter.3': 'product.pottbaecker-streuselteilchen',
  'slot.wall-shelf-north.1': 'product.puettbraeu-pils',
  'slot.wall-shelf-north.2': 'product.ruhrbrause-wasser-still',
  'slot.wall-shelf-north.3': 'product.naschwerk-vollmilch',
  'slot.fridge.1': 'product.zechenblitz-energy',
  'slot.fridge.2': 'product.ruhrbrause-zitronenlimo',
  'slot.magazine-rack.1': 'product.halden-echo-lokalblatt',
};

/** In-page: builds the state for a view and loads it (setup through the debug hook only). */
function arrangeInPage({ view, some }) {
  /* global structuredClone */
  const g = window.__buedchen.game;
  const s = structuredClone(g.state);
  const places = new Map(g.content.layout.nav.places.map((p) => [p.id, p]));
  const wp = new Map(g.content.layout.nav.waypoints.map((w) => [w.id, w.position]));
  const c = s.calendar;
  Object.assign(c, { day: view.state.day, minute: view.state.minute, phase: 'open', paused: true, speed: 1 });
  s.world.seed = 7;
  s.kiosk.doorOpen = view.state.door;
  s.kiosk.shutterOpen = view.state.shutter;
  s.player.position = { x: view.state.player.x, z: view.state.player.z };
  s.player.heading = view.state.player.h;
  s.story.flags = { ...(view.state.flags ?? {}) };
  s.economy.cashCents = 30000;
  s.economy.shelves = {};
  s.economy.storage = {};
  for (const [id, n] of Object.entries(s.npcs)) {
    const o = view.npcs[id];
    Object.assign(n, { placeId: null, spotIndex: null, route: [], routineId: null, wish: null, waitingSince: null, doneToday: { day: c.day, routineIds: [] } });
    if (!o) {
      n.status = 'away';
      continue;
    }
    const spot = places.get(o.place).spots[o.spot];
    const pos = o.pos ?? wp.get(spot.waypointId);
    Object.assign(n, { status: 'at_place', position: { x: pos.x, z: pos.z }, heading: o.heading ?? spot.heading, placeId: o.place, spotIndex: o.spot });
  }
  g.load(s);
  // Stock through the game's own restock rule (capacity, storage kind): plenty in storage, then the largest quantity
  // that fits per slot. `all`: every slot with a compatible product (round robin); `some`: a fixed small assortment.
  const products = Object.values(g.content.products);
  const st = structuredClone(g.state);
  for (const p of products) st.economy.storage[p.id] = 9999;
  g.load(st);
  let units = 0;
  let turn = 0;
  for (const slot of g.content.stockSlots) {
    const candidates = products.filter((p) => p.storage === slot.accepts);
    const productId =
      view.state.fill === 'all' ? (candidates.length ? candidates[turn++ % candidates.length].id : null) : (some[slot.id] ?? null);
    if (!productId) continue;
    for (let q = 64; q >= 1; q -= 1) {
      if (g.economy.restock(slot.id, productId, q).ok) {
        units += q;
        break;
      }
    }
  }
  const end = structuredClone(g.state);
  end.economy.storage = {};
  g.load(end);
  return units;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const port = await freePort();
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite did not start')), 30000);
  server.stdout.on('data', (d) => String(d).includes('127.0.0.1') && (clearTimeout(t), resolve()));
});
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const metrics = { date: new Date().toISOString(), renderer: 'Headless Chromium ' + browser.version() + ', SwiftShader (Software-Rendering)', views: {} };
let exitCode = 0;

async function openPage(dpr) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://127.0.0.1:${port}/?debug`);
  await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 60000 });
  return { context, page, errors };
}

async function setView(page, name) {
  const units = await page.evaluate(arrangeInPage, { view: VIEWS[name], some: SOME });
  // Let the follow camera, the cut-away transition and the stock view settle (render frames, game paused).
  await page.waitForTimeout(3500);
  return units;
}

try {
  const names = Object.keys(VIEWS).filter((n) => only.length === 0 || only.includes(n));
  // Metrics at deviceScaleFactor 1 (what a 1280x720 player sees).
  const m = await openPage(1);
  for (const name of names) {
    const units = await setView(m.page, name);
    const data = await m.page.evaluate(
      () =>
        new Promise((resolve) => {
          const w = window.__buedchen.world;
          const times = [];
          let last = performance.now();
          const t0 = last;
          const step = () => {
            const now = performance.now();
            times.push(now - last);
            last = now;
            if (now - t0 < 4000) requestAnimationFrame(step);
            else {
              const sorted = [...times].sort((a, b) => a - b);
              resolve({
                stats: w.getRenderStats(),
                stock: w.getStockInfo?.().drawnInstances ?? null,
                residentsVisible: (w.getResidentInfo?.() ?? []).filter((r) => r.visible).length,
                frames: times.length,
                frameMsMedian: sorted[Math.floor(sorted.length / 2)],
                frameMsP95: sorted[Math.floor(sorted.length * 0.95)],
              });
            }
          };
          requestAnimationFrame(step);
        }),
    );
    metrics.views[name] = { note: VIEWS[name].note, stockedUnits: units, ...data };
    console.log(name, JSON.stringify(metrics.views[name]));
  }
  if (m.errors.length) (metrics.errors ??= []).push(...m.errors);
  await m.context.close();

  // Screenshots at the requested deviceScaleFactor.
  const s = await openPage(scale);
  for (const name of names) {
    await setView(s.page, name);
    const file = path.join(outDir, `${name}.png`);
    const clip = VIEWS[name].crop;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await s.page.screenshot({ path: file, timeout: 90000, ...(clip ? { clip } : {}) });
        break;
      } catch (e) {
        if (attempt === 3) throw e;
      }
    }
    console.log('wrote', path.relative(root, file));
  }
  if (s.errors.length) (metrics.errors ??= []).push(...s.errors);
  await s.context.close();
  if (metrics.errors?.length) exitCode = 1;
  writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
process.exit(exitCode);
