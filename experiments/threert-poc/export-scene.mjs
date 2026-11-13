// Proof of concept, NOT part of the game. Starts the unchanged game in headless Chromium through capture/index.html,
// stocks the shelves through the game's own economy actions (debug hook), and writes:
//   out/kiosk.glb          the three.js scene as GLB with PBR materials (lights and rasterizer-only helpers removed)
//   out/scene-info.json    what the rasterizer scene contains, its lights and the game camera
//   out/three-<view>.png   the game's own WebGL picture of the same views, for the comparison
// Usage: node experiments/threert-poc/export-scene.mjs [--views inside,outside]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');

/** Player poses that give the views of the comparison (the follow camera sits behind/above the figure). */
const VIEWS = {
  inside: { x: 0.6, z: -0.3, heading: Math.PI },
  outside: { x: -0.6, z: 3.6, heading: Math.PI },
};

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
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--config', path.join(here, 'vite.config.mjs'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite did not start')), 30000);
  server.stdout.on('data', (d) => String(d).includes('127.0.0.1') && (clearTimeout(t), resolve()));
});

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let exitCode = 0;
try {
  const info = {};
  for (const [view, pose] of Object.entries(VIEWS)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await context.addInitScript((s) => {
      localStorage.setItem('buedchensim.save.slot1', JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), state: s }));
    }, { regionId: 'region.ruhrgebiet', player: { position: { x: pose.x, z: pose.z }, heading: pose.heading }, kiosk: { doorOpen: true, shutterOpen: true } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => (errors.push(e.message), console.error('pageerror', e.message)));
    page.on('console', (m) => process.env.POC_VERBOSE && console.log('console', m.type(), m.text()));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`http://127.0.0.1:${port}/experiments/threert-poc/capture/index.html?debug`);
    await page.waitForFunction(() => window.__poc?.ready() && window.__buedchen?.game, null, { timeout: 60000 });

    // Stock a representative assortment through the game's own actions (same as a player would, in batches because
    // the back storage holds 400 units). Only for this PoC; the game is not changed.
    const stocked = await page.evaluate(() => {
      const { game } = window.__buedchen;
      const state = structuredClone(game.state);
      state.economy.cashCents = 10_000_000;
      game.load(state);
      const content = game.content;
      const products = Object.values(content.products);
      let units = 0;
      const byKind = new Map();
      for (const p of products) byKind.set(p.storage, [...(byKind.get(p.storage) ?? []), p]);
      const slots = content.stockSlots;
      const cap = (slot, product) => {
        const asset = content.assets[product.assetId];
        // capacity is the game's own selector, exposed through the economy's validation: try a large restock later
        return asset ? 1 : 0;
      };
      void cap;
      let turn = 0;
      for (const slot of slots) {
        const candidates = byKind.get(slot.accepts) ?? [];
        if (candidates.length === 0) continue;
        const product = candidates[turn++ % candidates.length];
        // Fill about two thirds of the slot: order, receive, restock; shrink on rejection.
        for (let q = 24; q >= 1; q = Math.floor(q / 2)) {
          if (!game.economy.placeOrder([{ productId: product.id, quantity: q }]).ok) continue;
          game.economy.receiveDelivery();
          if (game.economy.restock(slot.id, product.id, q).ok) {
            units += q;
            break;
          }
          // did not fit: take it back out of the storage count by restocking smaller amounts next loop
        }
      }
      return units;
    });
    await page.waitForTimeout(2500); // camera settles, stock view rebuilt
    await page.screenshot({ path: path.join(out, `three-${view}.png`) });
    const stats = await page.evaluate(() => window.__buedchen.world.getRenderStats?.() ?? null);
    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const step = () => (++n < 60 ? requestAnimationFrame(step) : resolve((n * 1000) / (performance.now() - t0)));
          requestAnimationFrame(step);
        }),
    );
    info[view] = { stocked, stats, fpsSoftwareGl: fps, ...(await page.evaluate(() => window.__poc.describe())) };
    // Exported in the state the game shows for this view (inside: roof and upper south wall cut away).
    // Emission in nits differs by time of day (auto exposure adapts to the scene; a sign that reads well at noon
    // floods the frame at night), so the outside view is exported twice.
    const NITS = { day: { signNits: 250, panelNits: 600, lampNits: 2500 }, night: { signNits: 25, panelNits: 60, lampNits: 400 } };
    for (const time of view === 'outside' ? ['day', 'night'] : ['day']) {
      const glb = await page.evaluate((nits) => window.__poc.exportGlb({ metalHeuristic: true, ...nits }), NITS[time]);
      const file = time === 'day' ? `kiosk-${view}.glb` : `kiosk-${view}-${time}.glb`;
      writeFileSync(path.join(out, file), Buffer.from(glb.base64, 'base64'));
      info[`export-${view}${time === 'day' ? '' : `-${time}`}`] = { file, nits: NITS[time], bytes: glb.bytes, mapping: glb.mapping, instancedMeshes: glb.instancedMeshes, expandedUnits: glb.expandedUnits, bakedUv: glb.bakedUv, bakedColours: glb.bakedColours, materials: glb.materials };
    }
    info[view].errors = errors;
    if (errors.length) exitCode = 1;
    await context.close();
  }
  writeFileSync(path.join(out, 'scene-info.json'), JSON.stringify(info, null, 2));
  console.log(JSON.stringify({ exportInside: info['export-inside']?.bytes, exportOutside: info['export-outside']?.bytes, inside: { stocked: info.inside.stocked, stats: info.inside.stats, fps: info.inside.fpsSoftwareGl, errors: info.inside.errors }, outside: { fps: info.outside.fpsSoftwareGl, errors: info.outside.errors } }, null, 1));
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
process.exit(exitCode);
