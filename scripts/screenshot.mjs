// Dev helper: renders the running game (vite DEV server, not the dist build) at a given pose/state
// and writes a PNG. Usage:
//   node scripts/screenshot.mjs --out <png> [--x <n> --z <n> --heading <rad>]
//        [--door open|closed] [--shutter open|closed] [--scale 1]
// Seeds a valid save (localStorage key buedchensim.save.slot1) so the game starts in that state.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    args[a.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}
const args = parseArgs(process.argv.slice(2));
if (!args.out) {
  console.error('usage: node scripts/screenshot.mjs --out <png> [--x n --z n --heading rad] [--door open|closed] [--shutter open|closed] [--scale 1]');
  process.exit(2);
}
const num = (v, d) => (v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
const pose = { x: num(args.x, 0.9), z: num(args.z, 3.6), heading: num(args.heading, Math.PI) };
const state = {
  regionId: 'region.ruhrgebiet',
  player: { position: { x: pose.x, z: pose.z }, heading: pose.heading },
  kiosk: { doorOpen: args.door === 'open', shutterOpen: args.shutter === 'open' },
};
const scale = num(args.scale, 1);
const outFile = path.resolve(args.out);
mkdirSync(path.dirname(outFile), { recursive: true });

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

const port = await freePort();
const server = spawn(
  process.execPath,
  [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
);
let exitCode = 0;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite dev server did not start')), 30000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('127.0.0.1')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once('exit', () => reject(new Error('vite dev server exited')));
  });

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
    await context.addInitScript((s) => {
      localStorage.setItem('buedchensim.save.slot1', JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), state: s }));
    }, state);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/?debug`);
    await page.waitForFunction(() => window.__buedchen?.game, null, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500)); // transitions and the follow camera settle
    await page.screenshot({ path: outFile });
    const stats = await page.evaluate(() => window.__buedchen.world.getRenderStats?.() ?? null);
    if (stats) console.log(`render stats: ${JSON.stringify(stats)}`);
    console.log(`wrote ${outFile}`);
    for (const e of errors) console.error(e);
    if (errors.length > 0) exitCode = 1;
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);
