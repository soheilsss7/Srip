import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const isAndroid = process.platform === 'android';

if (isAndroid && !args.includes('--webpack')) {
  args.push('--webpack');
}

const result = spawnSync('next', ['build', ...args], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);