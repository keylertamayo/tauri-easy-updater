import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  splitting: false,
  minify: false,
  outExtension({ format }) {
    if (format === 'cjs') return { js: '.cjs' };
    return { js: '.mjs' };
  },
  banner: {
    js: '#!/usr/bin/env node'
  }
});

