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

/* ⛓ تضمین بقای زنجیره: هر اجرا در پایان (موفق یا ناموفق) یک اجرای جانشین می‌فرستد.
   اگر ظرفیت پر باشد، جانشین در شروع خودش بی‌صدا بیرون می‌رود — بدون ضرر. */
const relay = () => {
  try {
    let tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    if (!tok) {
      try {
        const gd = execSync('git rev-parse --git-dir', { stdio: ['ignore', 'pipe'] }).toString().trim();
        const cfg = fs.readFileSync(`${gd}/config`, 'utf8');
        const m = cfg.match(/basic\s+([A-Za-z0-9+/=]{20,})/i);
        if (m) tok = Buffer.from(m[1], 'base64').toString('utf8').split(':').pop();
      } catch {}
    }
    if (!tok) {
      try {
        const hdr = execSync('git config --get-all http.https://github.com/.extraheader', { stdio: ['ignore', 'pipe'] }).toString();
        const m2 = hdr.match(/basic\s+([A-Za-z0-9+/=]{20,})/i);
        if (m2) tok = Buffer.from(m2[1], 'base64').toString('utf8').split(':').pop();
      } catch {}
    }
    const repo = process.env.GITHUB_REPOSITORY || 'soheilsss7/Srip';
    if (!tok) { dump('relay', 'توکن نیست'); return; }
    execSync(`curl -s -X POST -H "authorization: Bearer ${tok}" -H "accept: application/vnd.github+json" -H "content-type: application/json" https://api.github.com/repos/${repo}/dispatches -d '{"event_type":"rasmio-run"}'`, { stdio: 'ignore', timeout: 30_000 });
    dump('relay', 'یک جانشین فرستاده شد');
  } catch (e) { dump('relay-error', String((e && e.message) || e)); }
};

try {
  await import('./bot.mjs');
  dump('bot-finished', 'ربات بدون خطا تمام شد');
  push('bot-finished');
} catch (e) {
  dump('crash', String((e && e.stack) || e));
  push('crash');
  relay();
  process.exit(1);
}
relay();
