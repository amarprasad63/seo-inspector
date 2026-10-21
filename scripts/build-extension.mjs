import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist/content', { recursive: true });
mkdirSync('dist/background', { recursive: true });

await esbuild.build({
  entryPoints: ['src/content/content-script.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  outfile: 'dist/content/content-script.js',
  legalComments: 'none',
  sourcemap: false,
});

await esbuild.build({
  entryPoints: ['src/background/service-worker.ts'],
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  outfile: 'dist/background/service-worker.js',
  legalComments: 'none',
  sourcemap: false,
});
