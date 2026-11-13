// Proof of concept, NOT part of the game. Bundles threert/kiosk-scene.ts with ThreeRT's own bundler and renders it with
// the native renderer (threert-render). Needs a built ThreeRT checkout:
//   THREERT_DIR=/path/to/ThreeRT node experiments/threert-poc/run-threert.mjs [--spp 16] [--only name,...] [--live 30]
// Writes out/rt-<variant>.png and out/rt-results.json. Run export-scene.mjs first (it writes the GLBs and the cameras).
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
const threert = process.env.THREERT_DIR;
if (!threert) throw new Error('set THREERT_DIR to a built ThreeRT checkout');
const bin = path.join(threert, 'renderer/target/release/threert-render');
const args = process.argv.slice(2);
const flag = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const spp = Number(flag('--spp', '16'));
const liveFrames = Number(flag('--live', '0'));
const only = flag('--only', '')?.split(',').filter(Boolean) ?? [];

const info = JSON.parse(readFileSync(path.join(out, 'scene-info.json'), 'utf8'));
const cam = (view) => ({ position: info[view].camera.position, target: info[view].camera.target, fov: info[view].camera.fov });
const VARIANTS = {
  'inside-day': { glb: 'kiosk-inside.glb', camera: cam('inside') },
  'outside-day': { glb: 'kiosk-outside.glb', camera: cam('outside'), extras: true },
  'outside-night': { glb: 'kiosk-outside-night.glb', camera: cam('outside'), extras: true, night: true },
};

const { bundleGame } = await import(pathToFileURL(path.join(threert, 'tools/bundle-game.ts')).href);
const gen = path.join(out, 'gen');
mkdirSync(gen, { recursive: true });
async function bundle(name, options) {
  const entry = path.join(gen, `${name}.ts`);
  const opts = { name: `buedchen-${name}`, ...options };
  writeFileSync(entry, `import { kioskGame } from "../../threert/kiosk-scene.ts";\nexport default kioskGame(${JSON.stringify(opts)});\n`);
  return (await bundleGame(entry, path.join(gen, `${name}.js`))).out;
}

const env = { ...process.env };
const results = existsJson(path.join(out, 'rt-results.json'));
function existsJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

for (const [name, v] of Object.entries(VARIANTS)) {
  if (only.length && !only.includes(name)) continue;
  const b = await bundle(name, v);
  const t0 = performance.now();
  const stdout = execFileSync(bin, ['render', b, '-o', path.join(out, `rt-${name}.png`), '--assets', out, '--spp', String(spp)], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const line = stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
  results[name] = { spp, wallMs: Math.round(performance.now() - t0), stats: line ? JSON.parse(line) : stdout.slice(-2000) };
  console.log(name, JSON.stringify({ wallMs: results[name].wallMs, trace: results[name].stats.timings_ms?.trace_ms, tris: results[name].stats.triangles }));
}

// Test 6: the real-time renderer (the one `play` shows) in a headless job: N frames at 60 fps scene time while the frame
// script orbits the camera. The job's total time includes building the scene; reported as is.
if (liveFrames > 0) {
  const b = await bundle('orbit', { ...VARIANTS['outside-day'], orbit: true });
  const p = spawn(bin, ['serve'], { env, stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = createInterface({ input: p.stdout });
  const next = () => new Promise((r) => lines.once('line', r));
  const ready = JSON.parse(await next());
  const run = async (frames, w, h) => {
    p.stdin.write(JSON.stringify({ id: `f${frames}`, game: b, assets: out, out: path.join(out, `rt-orbit-${frames}.png`), live: frames, width: w, height: h }) + '\n');
    return JSON.parse(await next());
  };
  const live = {};
  for (const [w, h] of [[640, 360], [1280, 720]]) {
    await run(1, w, h); // warm-up: builds the scene and compiles the kernels, not measured
    const one = await run(1, w, h);
    const many = await run(liveFrames + 1, w, h);
    const perFrame = (many.stats?.timings_ms?.total_ms - one.stats?.timings_ms?.total_ms) / liveFrames;
    live[`${w}x${h}`] = { oneFrameJob: one, manyFramesJob: many, msPerFrame: perFrame, fps: 1000 / perFrame };
    console.log('live', `${w}x${h}`, JSON.stringify({ msPerFrame: perFrame, fps: 1000 / perFrame, ok: many.ok, err: many.error }));
  }
  p.stdin.end();
  results.live = { ready, frames: liveFrames, ...live };
}
writeFileSync(path.join(out, 'rt-results.json'), JSON.stringify(results, null, 2));
