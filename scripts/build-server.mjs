#!/usr/bin/env node

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'dist-server');

rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: [join(root, 'server', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: join(outdir, 'index.js'),
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: [
      "import { createRequire as __openharnessCreateRequire } from 'node:module';",
      'const require = __openharnessCreateRequire(import.meta.url);',
    ].join('\n'),
  },
});
