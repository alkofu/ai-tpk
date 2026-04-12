import * as esbuild from 'esbuild'

await Promise.all([
  esbuild.build({
    entryPoints: ['src/installer/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: 'dist/installer.js',
    banner: {
      js: '#!/usr/bin/env node',
    },
  }),
  esbuild.build({
    entryPoints: ['src/launcher/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: 'dist/launcher.js',
    banner: {
      js: '#!/usr/bin/env node',
    },
  }),
])
