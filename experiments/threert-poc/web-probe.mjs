// Proof of concept, NOT part of the game. Opens a ThreeRT web build (tools/build-web.ts output, with the kiosk GLB copied
// beside it) in Playwright's Chromium and reports WebGPU availability, the page's stages, errors and frame times.
//   node experiments/threert-poc/web-probe.mjs <web build dir> [--seconds 60] [--webgpu swiftshader|default]
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../package.json'));
const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2]);
const flag = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const seconds = Number(flag('--seconds', '60'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    if (p.endsWith('probe-blank.html')) return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>probe</title>');
    const body = await readFile(p.endsWith('/') ? path.join(p, 'index.html') : p);
    res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const size = flag('--size', '640x360').split('x');
const url = `http://127.0.0.1:${server.address().port}/index.html?width=${size[0]}&height=${size[1]}&lockstep=1&scale=1`;
const args = ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist'];
if (flag('--webgpu', 'swiftshader') === 'swiftshader') args.push('--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader');
const browser = await chromium.launch({ args });
const result = { url, chromium: browser.version(), args };
try {
  const page = await browser.newPage();
  const log = [];
  page.on('console', (m) => log.push(`${m.type()}: ${m.text()}`.slice(0, 400)));
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`.slice(0, 400)));
  // ThreeRT's page (renderer/web/www/main.ts) never calls the module's `provide`, so a scene's GLB is never handed
  // over. The probe patches the served main.js to fetch and provide the files listed with --provide (PoC only).
  const provide = flag('--provide', '').split(',').filter(Boolean);
  if (provide.length) {
    await page.route('**/main.js', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        'await wasm.default();',
        `await wasm.default(); for (const f of ${JSON.stringify(provide)}) wasm.provide(f, new Uint8Array(await (await fetch(f)).arrayBuffer()));`,
      );
      await route.fulfill({ response, body });
    });
  }
  await page.goto(url.replace(/index\.html.*$/, 'probe-blank.html'));
  result.adapter = await page.evaluate(async () => {
    if (!navigator.gpu) return { webgpu: false };
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { webgpu: true, adapter: null };
    const info = a.info ?? {};
    return { webgpu: true, vendor: info.vendor, architecture: info.architecture, description: info.description, isFallback: a.isFallbackAdapter, features: [...a.features].slice(0, 30), maxStorageBuffers: a.limits.maxStorageBuffersPerShaderStage };
  });
  await page.goto(url);
  const t0 = Date.now();
  let stage = null;
  while (Date.now() - t0 < seconds * 1000) {
    stage = await page.evaluate(() => ({ stage: window.threertStage ?? null, status: document.getElementById('status')?.textContent ?? '' }));
    if (stage.stage === 'running') break;
    await page.waitForTimeout(1000);
  }
  result.reached = stage;
  result.secondsToStage = (Date.now() - t0) / 1000;
  if (stage?.stage === 'running') {
    // Lockstep: the page runs no frame by itself; the probe runs them (the frame script orbits the camera) and reads
    // the page's own frame log (renderer/web/www/frame.ts: gpu_ms, trace_ms, ...).
    const frames = Number(flag('--frames', '20'));
    const t1 = Date.now();
    await page.evaluate((n) => window.threert.run(n), frames);
    result.lockstepWallSeconds = (Date.now() - t1) / 1000;
    result.firstFrameGpuMs = await page.evaluate(() => window.threert.firstFrame());
    const rows = await page.evaluate(() => window.threert.frames.map((r) => ({ gpu: r.gpu_ms, trace: r.trace_ms, render: r.render_ms, end: r.end, scale: r.scale, guard: r.guard_trips, rebuilt: r.rebuilt })));
    const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const steady = rows.slice(Math.min(3, rows.length - 1));
    result.frameRows = rows.length;
    result.median = { gpu_ms: median(steady.map((r) => r.gpu)), trace_ms: median(steady.map((r) => r.trace)), render_ms: median(steady.map((r) => r.render)), frameEnd_ms: median(steady.map((r) => r.end)) };
    result.guardTrips = rows.at(-1)?.guard ?? null;
    result.info = await page.evaluate(() => window.threert.info);
    try {
      await page.screenshot({ path: path.join(here, 'out', 'web-probe.png'), timeout: 180000 });
      result.screenshot = 'out/web-probe.png';
    } catch (e) {
      result.screenshot = `failed: ${String(e.message).split('\n')[0]}`;
    }
  }
  result.log = log.slice(-40);
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(result, null, 1));
