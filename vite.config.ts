import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    rolldownOptions: {
      output: {
        // three.js changes only on a deliberate upgrade; keeping it in its own chunk lets browsers
        // keep it cached across game updates. This does not shrink the total download.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
