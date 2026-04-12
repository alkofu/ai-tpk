import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['installer/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'dist/installer.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
})
