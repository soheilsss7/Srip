import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const isAndroid = process.platform === 'android';

if (isAndroid && !args.includes('--webpack')) {
  args.push('--webpack');
}

const nextBin = require.resolve('next/dist/bin/next');

// Static GitHub Pages export (SRIP_PAGES=1) must talk to the embedded SW mock
// under the /Srip basePath. Without this env the bundle would call /api/v1 at
// the domain root (outside the SW scope) and every request 404s.
if (process.env.SRIP_PAGES === '1' && !process.env.NEXT_PUBLIC_API_URL) {
  process.env.NEXT_PUBLIC_API_URL = '/Srip/api/v1';
}

const result = spawnSync(process.execPath, [nextBin, 'build', ...args], {
  stdio: 'inherit',
});

if ((result.status ?? 1) === 0) {
  // GitHub Pages (legacy build) must not Jekyll-process the export — without
  // .nojekyll it drops the underscore dirs (_next) and the site breaks.
  // next build wipes out/, so stamp the file again after every build.
  try {
    const { writeFileSync } = require('node:fs');
    const { fileURLToPath } = require('node:url');
    const outDir = require('node:path').join(fileURLToPath(new URL('..', import.meta.url)), 'out');
    writeFileSync(require('node:path').join(outDir, '.nojekyll'), '');
  } catch (e) { console.error('[next-build] .nojekyll stamp failed', e); }
}

process.exit(result.status ?? 1);