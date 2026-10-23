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
      // Bundled CJS deps (e.g. yaml) call require(), which ESM lacks.
      js: [
        '#!/usr/bin/env node',
        "import { createRequire } from 'node:module';",
        'const require = createRequire(import.meta.url);',
      ].join('\n'),
    },
  }),
  esbuild.build({
    entryPoints: ['src/launcher/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    outfile: 'dist/launcher.cjs',
    banner: {
      js: '#!/usr/bin/env node',
    },
  }),
])
