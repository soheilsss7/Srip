/* ═══ پوستهٔ ضدگلوله — هر اتفاقی بیفتد، ردپای کاملش روی arena ذخیره می‌شود ═══ */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BRANCH = process.env.OTP_BRANCH || 'arena/01a08a50-srip';
const sh = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).toString().trim(); } catch (e) { return 'ERR: ' + String((e && e.message) || e).slice(0, 300); } };
const dump = (tag, text) => { try { fs.mkdirSync('out', { recursive: true }); fs.appendFileSync('out/boot.log', `\n===== ${tag} @ ${new Date().toISOString()} =====\n${text}\n`); } catch {} };
const push = (tag) => {
  sh('git config user.name rasmio-bot'); sh('git config user.email actions@users.noreply.github.com');
  sh('git add -f out'); sh(`git commit -m "boot: ${tag} $(date -u +%H:%M:%S)"`);
  sh(`git fetch origin ${BRANCH}`); sh(`git rebase origin/${BRANCH}`);
  const r = sh(`git push origin HEAD:${BRANCH}`);
  dump('push-' + tag, r.slice(0, 300));
};

process.on('uncaughtException', (e) => { dump('uncaught', String((e && e.stack) || e)); push('uncaught'); process.exit(1); });
process.on('unhandledRejection', (e) => { dump('rejection', String((e && e.stack) || e)); push('rejection'); process.exit(1); });

dump('boot', [
  'node ' + process.version,
  'cwd ' + process.cwd(),
  'HEAD ' + sh('git rev-parse HEAD'),
  sh('git log --oneline -3'),
  'puppeteer نصب است؟ ' + fs.existsSync('node_modules/puppeteer'),
  'پکیج‌ها: ' + sh('ls node_modules | tr "\\n" " " | head -c 400'),
  'env: ' + Object.keys(process.env).filter((k) => /RASMIO|OTP|GITHUB_REPOSITORY|PUPPETEER/.test(k)).join(','),
].join('\n'));
push('boot');

try {
  await import('./bot.mjs');
  dump('bot-finished', 'ربات بدون خطا تمام شد');
  push('bot-finished');
} catch (e) {
  dump('crash', String((e && e.stack) || e));
  push('crash');
  process.exit(1);
}
