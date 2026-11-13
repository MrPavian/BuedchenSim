// Vite config for the PoC capture page only (the game's own vite.config.ts is untouched). It pre-bundles three and
// the exporter together so the capture hook and the game share one three.js module instance.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export default defineConfig({
  root,
  optimizeDeps: {
    entries: ['experiments/threert-poc/capture/index.html'],
    include: ['three', 'three/examples/jsm/exporters/GLTFExporter.js'],
  },
});
