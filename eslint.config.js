import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Layer rule (enforced via no-restricted-imports):
 *   core    -> nothing
 *   game    -> core
 *   content -> game (types), core
 *   world   -> game, core, three   (receives the ContentPack as a parameter)
 *   ui      -> game, core
 *   main.ts, integration/ -> everything
 * Test files follow the rules of their layer.
 */
const threePatterns = ['three', 'three/*'];
const layerGlobs = (names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

const restrict = (patterns, layer) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: patterns.map((group) => ({
        group: Array.isArray(group) ? group : [group],
        message: `Layer rule: src/${layer} must not import this (see eslint.config.js).`,
      })),
    },
  ],
});

const domGlobals = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'HTMLElement',
  'HTMLCanvasElement',
  'Element',
  'Node',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'alert',
  'getComputedStyle',
  'ResizeObserver',
  'MutationObserver',
  'Image',
  'Audio',
].map((name) => ({ name, message: 'No DOM globals in this layer; inject what you need from main.ts.' }));

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node script; its page.evaluate callbacks run in the browser, so both global sets apply.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        Image: 'readonly',
        MutationObserver: 'readonly',
        Event: 'readonly',
      },
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      ...restrict([threePatterns, layerGlobs(['game', 'content', 'world', 'ui'])], 'core'),
      'no-restricted-globals': ['error', ...domGlobals],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      ...restrict([threePatterns, layerGlobs(['content', 'world', 'ui'])], 'game'),
      'no-restricted-globals': ['error', ...domGlobals],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: restrict([threePatterns, layerGlobs(['world', 'ui'])], 'content'),
  },
  {
    files: ['src/world/**/*.ts'],
    rules: restrict([layerGlobs(['ui', 'content'])], 'world'),
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: restrict([threePatterns, layerGlobs(['world', 'content'])], 'ui'),
  },
  {
    // Integration tests span layers on purpose (content + world); only the base rules apply here.
    files: ['src/integration/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
