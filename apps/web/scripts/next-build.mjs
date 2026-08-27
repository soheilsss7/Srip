import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const isAndroid = process.platform === 'android';

if (isAndroid && !args.includes('--webpack')) {
  args.push('--webpack');
}

const nextBin = require.resolve('next/dist/bin/next');

const result = spawnSync(process.execPath, [nextBin, 'build', ...args], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);