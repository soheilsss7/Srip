import {isRegisteredDiagnosticRun} from './diagnostic-run-registry.mjs';
/* ============================================================================
   ربات رسمیو — نسخهٔ ۳ «همیشگی» (نشست ماندگار + خزندهٔ خودرشد)
   ----------------------------------------------------------------------------
   · نشست: بعد از اولین ورود، کوکی‌ها با AES-256-GCM (کلید = Secret
     RASMIO_SESSION_KEY) رمز می‌شوند و در out/session.enc ذخیره می‌شوند؛
     اجراهای بعدی بدون پیامک با همان نشست وارد می‌شوند. وقتی نشست مرد،
     ربات مثل قبل منتظر otp.txt می‌ماند (به‌ندرت).
   · خزنده: frontier.json صف BFS است — از شرکت‌های seed شروع می‌کند؛
     در هر صفحهٔ شرکت/شخص، جدول‌های هیئت‌مدیره/سهام‌داران/بازرس/مرتبط
     را می‌خواند، گره‌ها/یال‌ها را به data/graph.json می‌افزاید و
     موجودیت‌های تازه را به صف می‌گذارد. هر اجرا حداکثر LIMIT موجودیت
     جدید می‌پیماید (مهربان با سرور رسمیو) و صف را برای اجرای بعد ذخیره
     می‌کند — یعنی گراف هر شب خودش بزرگ‌تر می‌شود.
   · اجرا: schedule روزانه + repository_dispatch (عامل Arena) + دستی.
   ========================================================================== */
import puppeteer from 'puppeteer';
import { restoreIncompleteDetails, prioritizeDetailRepair, markDetailRepaired, hasDetailCounts, backfillKnownDetailQueue } from './detail-repair.mjs';
import { extractTablesFromDOM } from './table-extractor.mjs';
import { installNetworkAudit } from './network-audit.mjs';
import { PublicProxyTransport, permittedDetailURL, permittedResourceURL } from './proxy-transport.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const OUT = 'out', SHOTS = 'shots', DATA = 'data';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(`${DATA}/entities`, { recursive: true });

const BASE = process.env.RASMIO_BASE || 'https://rasmio.com';
/* Fetch audit includes discovery/probes/details; browser traffic is not counted. */
const networkAudit = installNetworkAudit({ host: new URL(BASE).hostname, out: OUT });
globalThis.fetch = networkAudit.fetch;
const LIMIT = Number(process.env.CRAWL_LIMIT || 400); // سقف هر اجرا — زنجیرهٔ اجراها گراف را کامل می‌کند
const MAX_PARALLEL = Math.max(1, Math.min(16, Number(process.env.RASMIO_PARALLEL || 1))); // ⚡ کارگرهای همزمان (اجرای تازه تضمین IP یا سهمیهٔ تازه نیست)
const SLOT = MAX_PARALLEL > 1 ? (Number(process.env.GITHUB_RUN_ID || '0') % MAX_PARALLEL) : 0; // تیکهٔ اختصاصی این کارگر از صف
const TIME_BUDGET_S = Number(process.env.CRAWL_TIME_BUDGET_S || 1300); // بودجهٔ خزندگی هر اجرا (ثانیه) — همیشه قبل از سقف ۳۰دقیقه‌ای job تمام می‌شود تا خروجی کامیت شود
const DELAY_MS = Number(process.env.CRAWL_DELAY_MS || 5000);
const SESSION_KEY = process.env.RASMIO_SESSION_KEY || '';
const PROC_T0 = Date.now();
const HARD_DEADLINE_MS = Number(process.env.JOB_DEADLINE_S || 1450) * 1000; /* سقف مطلق: job ۳۰ دقیقه است — قبلش باید پوش شود */
const hardTimeUp = () => (Date.now() - PROC_T0) > HARD_DEADLINE_MS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const line = '[rasmio] ' + a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(line); try { fs.appendFileSync(`${OUT}/run.log`, new Date().toISOString() + ' ' + line + '\n'); } catch {} };
const mask = (s) => String(s).slice(0, 2) + '***' + String(s).slice(-2);

const progress = (step, data = {}) => { try { fs.writeFileSync(`${OUT}/progress.json`, JSON.stringify({ step, at: new Date().toISOString(), ...data }, null, 1)); } catch {} };
const safeName = (n) => String(n).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
const dbg = (name, data) => { try { fs.writeFileSync(`${OUT}/dbg-${safeName(name)}.json`, typeof data === 'string' ? data : JSON.stringify(data, null, 1)); } catch {} };
/* 🧹 پاکسازی فایل‌های دیباگِ نام‌بد (کولون و غیره) — وگرنه گام آپلود آرتیفکت گیت‌هاب کل job را fail می‌کند (حادثهٔ ۱۹ مهر) */
const cleanOut = () => {
  let removed = 0;
  for (const dir of [OUT, `${OUT}/../shots`]) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.includes(':') || f.includes('?') || f.includes('*') || f.startsWith('dbg-')) { try { fs.unlinkSync(`${dir}/${f}`); removed++; } catch {} }
      }
    } catch {}
  }
  if (removed) log('🧹 out پاک‌سازی شد — ' + removed + ' فایل دیباگ/نام‌بد حذف شد (آپلود آرتیفکت سالم)');
  return removed;
};
cleanOut();
class FatalError extends Error { constructor(m) { super(m); this.isFatal = true; } }
const fatal = (msg, extra = {}) => { try { fs.writeFileSync(`${OUT}/fatal.json`, JSON.stringify({ msg, at: new Date().toISOString(), ...extra }, null, 1)); } catch {}; try { fs.appendFileSync(`${OUT}/run.log`, new Date().toISOString() + ' FATAL ' + msg + '\n'); } catch {}; console.error('❌ ' + msg); try { botPush('fatal'); } catch {}; throw new FatalError(msg); };

/* ربات خودش خروجی/لاگ/نشست را همان لحظه پوش می‌کند — دیگر هیچ اطلاعاتی گم نمی‌شود */
function botPush(tag) {
  /* git خودش با اعتبارنامهٔ checkout پوش می‌کند — نیازی به env توکن نیست (باگ ۶) */
  const sh = (c) => { try { execSync(c, { stdio: 'pipe', timeout: 60_000 }); return true; } catch { return false; } };
  sh('git config user.name "rasmio-bot"');
  sh('git config user.email "actions@users.noreply.github.com"');
  cleanOut();
  sh(`git fetch origin ${BRANCH}`);
  mergeRemoteState(); /* ⚡ ادغام پیشرفت سایر کارگرها — بدون این، هر پوش پیشرفت بقیه را پاک می‌کرد */
  sh('git add -f -A out'); sh('git add -f shots'); sh('git add -f data'); sh('git add -f frontier.json');
  try { execSync('git rm -r -q --cached --ignore-unmatch out/dbg-*', { stdio: 'pipe', timeout: 180_000 }); } catch {}
  if (!sh(`git commit -m "rasmio-bot: ${tag} (${new Date().toISOString().slice(11, 19)})"`)) return;
  for (let i = 0; i < 4; i++) {
    sh('git rebase --abort || true'); /* ربیز نیمه‌کارهٔ مانده = فاجعهٔ ۱۷ مهر — همیشه پاک شود */
    sh(`git fetch origin ${BRANCH}`);
    sh(`git rebase origin/${BRANCH}`);
    if (sh(`git push origin HEAD:${BRANCH}`)) { log('bot-push:', tag); return; }
    try { execSync(`sleep ${1 + Math.floor(Math.random() * 3)}`, { stdio: 'pipe' }); } catch {}
  }
  /* ⚡ مسیر مقاوم (چند نویسندهٔ همزمان / بعد از فشرده‌سازی): درخت کاری را روی سرِ تازه بگذار — بدون تعارض */
  sh('git rebase --abort || true');
  if (sh(`git fetch origin ${BRANCH}`) && sh(`git reset --mixed origin/${BRANCH}`)) {
    mergeRemoteState();
    sh('git add -f -A out'); sh('git add -f shots'); sh('git add -f data'); sh('git add -f frontier.json');
    if (sh(`git commit -m "rasmio-bot: ${tag} (sync)"`) && sh(`git push origin HEAD:${BRANCH}`)) { log('bot-push(sync):', tag); return; }
  }
  try { dbg('botpush-failed', tag); } catch {}
}

/* ═══ محافظ سقف ریپو v2: تاریخچه همیشه سبک + آرشیو روزانهٔ رایگان — با گزارش کامل هر قدم ═══ */
async function storageGuard() {
  log('Storage guard: automatic force-push disabled; data history must not be rewritten by concurrent jobs');
  return;
  const G = (...a) => log('🗜 [گارد]', ...a);
  try {
    const tok = selfToken();
    if (!tok) { G('توکن نیست — رد شد'); return; }
    /* 🔒 قفل فشرده‌سازی: فایل قفل در شاخه — فقط یک اجرا در هر ۳۰ دقیقه فشرده می‌کند */
    try {
      const lr = await fetch(`https://api.github.com/repos/${REPO}/contents/.squash-lock?ref=${BRANCH}`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      if (lr.ok) {
        const lj = await lr.json();
        const when = Buffer.from(lj.content, 'base64').toString().trim();
        const ageMin = (Date.now() - new Date(when).getTime()) / 60000;
        if (ageMin < 30) { G('🔒 فشرده‌سازی اخیراً انجام/تلاش شده (' + Math.round(ageMin) + ' دقیقه پیش) — رد شد'); return; }
      }
    } catch {}
    /* ۱) فشرده‌سازی تاریخچه هر ۳۰۰ کامیت → یک اسنپ‌شات (داده‌ها کامل می‌مانند) */
    let count = 1;
    try {
      const rc = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=1`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      const link = rc.headers.get('link') || '';
      const lm = link.match(/page=(\d+)>; rel="last"/);
      if (lm) count = Number(lm[1]);
      G('کامیت‌های شاخه:', count);
    } catch (e) { G('شمارش کامیت خطا خورد:', String(e).slice(0, 80)); }
    let _others = 0;
    try {
      const rr = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=50`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      if (rr.ok) _others = ((await rr.json()).workflow_runs || []).filter((x) => (x.status === 'in_progress' || x.status === 'queued')).length - 1;
    } catch {}
    /* پوش مقاوم (reset+merge) تعارض کارگرها را جبران می‌کند → فشرده‌سازی با قفل، بدون گیت «کارگر فعال» */
    if (count >= 300 && _others > 0) G('ℹ️ ' + _others + ' کارگر فعال — فشرده‌سازی با قفل انجام می‌شود (پوش مقاوم)');
    if (count >= 300) {
      /* ثبت قفل — جلوگیری از فشرده‌سازی همزمان چند اجرا */
      try {
        let lsha = null;
        try { const lr = await fetch(`https://api.github.com/repos/${REPO}/contents/.squash-lock?ref=${BRANCH}`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } }); if (lr.ok) lsha = (await lr.json()).sha; } catch {}
        await fetch(`https://api.github.com/repos/${REPO}/contents/.squash-lock`, { method: 'PUT', headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ message: 'squash-lock', content: Buffer.from(new Date().toISOString()).toString('base64'), branch: BRANCH, ...(lsha ? { sha: lsha } : {}) }) });
      } catch {}
      const sh = (c) => { try { execSync(c, { stdio: 'pipe', timeout: 600_000 }); return true; } catch (e) { G('گام ناموفق:', c.slice(0, 70), '→', String((e && e.message) || e).slice(0, 150)); return false; } };
      sh('git rebase --abort || true'); /* ربیز نیمه‌کاره = فاجعهٔ ۱۷ مهر (پوش درختِ قفل‌شده) */
      sh(`git fetch origin ${BRANCH}`);
      sh(`git rebase origin/${BRANCH}`);
      sh(`git push origin HEAD:${BRANCH}`);
      sh('git rebase --abort || true');
      /* 🛡 ایمنی: قبل از فشرده‌سازی، درختِ کاری را با سرِ شاخه یکی کن —
         وگرنه اسنپ‌شات، کدهای تازه‌ای که بعد از شروع این اجرا پوش شده را پاک می‌کرد (حادثهٔ ۲۴ مهر) */
      sh('git rebase --abort || true');
      sh(`git fetch origin ${BRANCH}`);
      sh(`git reset --mixed origin/${BRANCH}`);
      sh('git checkout -- .');
      sh(`git reset --hard origin/${BRANCH}`);
      if (sh('git checkout --orphan _squash_tmp') && sh('git add -A') && sh('git commit -q -m "snapshot: داده‌ها + تاریخچهٔ فشرده (محافظ سقف)"')) {
        /* قفل سلامت: فقط اگر گرافِ داخل اسنپ‌شات سالم و بزرگ است پوش اجباری می‌شود */
        let nodesN = 0;
        try { nodesN = countShardNodes(); } catch {}
        const floor = Math.max(1000, Math.floor(((frontier.stats && frontier.stats.maxNodes) || 0) * 0.5));
        if (nodesN >= floor) {
          if (sh(`git push -f origin HEAD:${BRANCH}`)) G('✓ تاریخچه فشرده شد (' + count + ' کامیت → ۱؛ سلامت گراف ' + nodesN + ' گره تأیید شد)');
          else G('فشرده‌سازی این بار نشد — اجرای بعدی دوباره');
        } else { G('⛔ فشرده‌سازی لغو شد — گراف اسنپ‌شات سالم نیست (' + nodesN + ' < ' + floor + ')؛ داده حفظ شد'); }
      } else G('فشرده‌سازی این بار نشد — اجرای بعدی دوباره');
    }
    /* ۲) آرشیو روزانهٔ کامل در Releases — رایگان، جدای از حجم ریپو (۷ روز نگهداری) */
    const today = new Date().toISOString().slice(0, 10);
    const tag = `data-${today}`;
    try {
      let rel = null;
      const rv = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, { headers: { authorization: `Bearer ${tok}` } });
      if (rv.ok) rel = await rv.json();
      if (!rel) {
        const cr = await fetch(`https://api.github.com/repos/${REPO}/releases`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ tag_name: tag, name: `آرشیو دادهٔ رسمیو ${today}`, body: 'پشتیبان روزانهٔ کامل (داده‌ها + گراف + صف) — رایگان و جدا از حجم ریپو', prerelease: true }) });
        if (cr.ok) { rel = await cr.json(); G('Release امروز ساخته شد'); }
        else G('ساخت Release رد شد:', cr.status);
      }
      const want = `rasmio-data-${today}.tar.gz`;
      if (rel && !(rel.assets || []).some((a) => a.name === want)) {
        const t0 = Date.now();
        execSync('tar czf /tmp/rasmio-data.tar.gz data frontier.json out/run.log', { stdio: 'pipe', timeout: 600_000 }); /* CWD خودِ ربات = scripts/rasmio */
        const buf = fs.readFileSync('/tmp/rasmio-data.tar.gz');
        G('tar آماده شد:', Math.round(buf.length / 1048576) + 'MB در', Math.round((Date.now() - t0) / 1000) + 'ثانیه');
        const up = await fetch(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=${want}`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json', 'content-type': 'application/gzip' }, body: buf });
        G(up.ok ? '✓ آرشیو روزانهٔ کامل آپلود شد (رایگان — جدای از حجم ریپو)' : 'آپلود ضمیمه رد شد: ' + up.status + ' — فردا دوباره');
      } else if (rel) G('آرشیو امروز از قبل کامل است ✓');
      /* آرشیوهای قدیمی‌تر از ۷ روز پاک شوند */
      const rl = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers: { authorization: `Bearer ${tok}` } });
      if (rl.ok) for (const r of await rl.json()) {
        const m = (r.tag_name || '').match(/^data-(\d{4}-\d{2}-\d{2})$/);
        if (m && (Date.now() - new Date(m[1] + 'T00:00:00Z').getTime()) > 7 * 86400000) {
          try { await fetch(`https://api.github.com/repos/${REPO}/releases/${r.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${tok}` } }); G('آرشیو قدیمی پاک شد:', r.tag_name); } catch {}
        }
      }
    } catch (e) { G('خطای بخش آرشیو:', String((e && e.message) || e).slice(0, 150)); }
  } catch (e) { G('خطای کلی:', String((e && e.message) || e).slice(0, 150)); }
}

/* مصرف فایل فرمان از شاخه (فایل فقط روی ریموت است — باید از آنجا حذف شود) */
function consumeRemoteFile(name, tag) {
  const sh = (c) => { try { execSync(c, { stdio: 'pipe', timeout: 60_000 }); return true; } catch { return false; } };
  sh('git config user.name "rasmio-bot"'); sh('git config user.email "actions@users.noreply.github.com"');
  sh('git add -f out'); sh('git add -f shots'); sh('git add -f data'); sh('git add -f frontier.json');
  sh(`git commit -m "rasmio-bot: ${tag}"`);
  for (let i = 0; i < 3; i++) {
    sh(`git fetch origin ${BRANCH}`);
    if (!sh(`git rebase origin/${BRANCH}`)) continue;
    sh(`git rm -f --ignore-unmatch ${name}`);
    sh(`git commit -m "rasmio-bot: consume ${name}"`);
    if (sh(`git push origin HEAD:${BRANCH}`)) { log('consume-ok:', name); return true; }
  }
  return false;
}

/* انتظار هوشمند برای فایل فرمان/کد: محلی + شاخهٔ گیت‌هاب، چک هر ۵ ثانیه */
const waitForFile = async (name, maxSeconds, check) => {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < maxSeconds) {
    let t = null;
    if (fs.existsSync(name)) { try { t = fs.readFileSync(name, 'utf8').trim(); } catch {} }
    if (t == null) { try { const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/scripts/rasmio/${name}?nocache=${Date.now()}`, { cache: 'no-store' }); if (r.ok) t = (await r.text()).trim(); } catch {} }
    if (t && check(t)) return t;
    await sleep(5_000);
  }
  return null;
};

const PHONE = process.env.RASMIO_PHONE;
const REPO = process.env.GITHUB_REPOSITORY || 'soheilsss7/Srip';
const BRANCH = process.env.OTP_BRANCH || 'arena/01a08a50-srip';

/* ─── رمزنگاری نشست (AES-256-GCM + PBKDF2) ─── */
function encryptBlob(obj, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase, salt, 120_000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  return { v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ct.toString('base64') };
}
function decryptBlob(blob, passphrase) {
  const salt = Buffer.from(blob.salt, 'base64'), iv = Buffer.from(blob.iv, 'base64');
  const key = crypto.pbkdf2Sync(passphrase, salt, 120_000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]);
  return JSON.parse(pt.toString('utf8'));
}



/* ═══ 🧩 ذخیرهٔ پارچه‌پارچهٔ گراف (شارد) — هیچ فایلی به سقف ۱۰۰MB گیت‌هاب نزدیک نشود ═══ */
const GSHARDS = Number(process.env.GRAPH_SHARDS || 16);
const shardOf = (k) => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0; return ((h % GSHARDS) + GSHARDS) % GSHARDS; };
const shardPath = (i) => `${DATA}/graph/s-${String(i).padStart(2, '0')}.json`;
function saveGraphShards() {
  try {
    const g = frontier.graph || { nodes: {}, edges: [] };
    fs.mkdirSync(`${DATA}/graph`, { recursive: true });
    const buckets = []; for (let i = 0; i < GSHARDS; i++) buckets.push({ nodes: {}, edges: [] });
    for (const [k, v] of Object.entries(g.nodes || {})) buckets[shardOf(k)].nodes[k] = v;
    const seen = new Set();
    for (const e of (g.edges || [])) {
      const key = `${e.from}|${e.to}|${e.kind}|${e.role}`;
      if (seen.has(key)) continue; seen.add(key);
      buckets[shardOf(String(e.from || ''))].edges.push(e);
    }
    let n = 0, m = 0, maxB = 0;
    for (let i = 0; i < GSHARDS; i++) {
      const p = shardPath(i), body = JSON.stringify(buckets[i]);
      fs.writeFileSync(p + '.tmp', body); fs.renameSync(p + '.tmp', p);
      maxB = Math.max(maxB, body.length);
      n += Object.keys(buckets[i].nodes).length; m += buckets[i].edges.length;
    }
    fs.writeFileSync(`${DATA}/graph.json.tmp`, JSON.stringify({ sharded: true, shards: GSHARDS, nodeCount: n, edgeCount: m, maxShardMB: Math.round(maxB / 104857.6) / 10, at: new Date().toISOString() }));
    fs.renameSync(`${DATA}/graph.json.tmp`, `${DATA}/graph.json`);
    return { n, m, maxB };
  } catch (e) { return null; }
}
function loadGraph() {
  const g = { nodes: {}, edges: [] };
  try {
    const legacy = JSON.parse(fs.readFileSync(`${DATA}/graph.json`, 'utf8'));
    if (legacy && legacy.nodes) { Object.assign(g.nodes, legacy.nodes); for (const e of (legacy.edges || [])) g.edges.push(e); }
  } catch {}
  try {
    for (let i = 0; i < GSHARDS; i++) {
      const p = shardPath(i); if (!fs.existsSync(p)) continue;
      const s = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!s) continue;
      for (const [k, v] of Object.entries(s.nodes || {})) if (!(k in g.nodes)) g.nodes[k] = v;
      for (const e of (s.edges || [])) g.edges.push(e);
    }
  } catch {}
  return g;
}
function countShardNodes() {
  try { return Object.keys(frontier.graph.nodes || {}).length; } catch { return 0; }
}

/* ═══ 🛡 محافظ حجم graph.json: سقف ۱۰۰MB گیت‌هاب — هرگز لوله نشکند ═══ */
function trimGraphIfBig() {
  try {
    const p = `${DATA}/graph.json`;
    if (!fs.existsSync(p)) return 0;
    const st = fs.statSync(p);
    if (st.size < 78 * 1024 * 1024) return 0;
    const g = JSON.parse(fs.readFileSync(p, 'utf8'));
    let n = 0;
    for (const k of Object.keys(g.nodes || {})) {
      const v = g.nodes[k];
      if (v && v.info) { delete v.info; n++; }
      if (v && v.sub) delete v.sub;
    }
    /* اگر باز هم بزرگ بود، صفحه‌های اضافیِ یال‌ها را حذف کن */
    fs.writeFileSync(p, JSON.stringify(g));
    const after = fs.statSync(p).size;
    log('🛡 محافظ حجم: info از ' + n + ' گره حذف شد — ' + Math.round(st.size / 1048576) + 'MB → ' + Math.round(after / 1048576) + 'MB');
    return n;
  } catch (e) { return 0; }
}

/* ═══ خودترمیمی: بازسازی کامل گراف/صف/بازدید از فایل‌های موجودیتِ سالم (data/entities) ═══ */
function rebuildFromEntities(why) {
  try {
    const files = fs.readdirSync(`${DATA}/entities`).filter((f) => f.endsWith('.json'));
    if (files.length < 1000) { log('🔨 بازسازی رد شد — فایل موجودیت کافی نیست:', files.length); return false; }
    log('🔨 بازسازی حالت از', files.length, 'فایل موجودیت سالم… (' + why + ')');
    const nodes = {}, edges = [], visited = {}, ekeys = new Set();
    const mk = (href) => { const pm = String(href).match(/\/person\/([0-9A-Fa-f]+)/); if (pm) return { type: 'person', id: pm[1] }; const cm = String(href).match(/\/company\/(\d+)/); if (cm) return { type: 'company', id: cm[1] }; return null; };
    const now = new Date().toISOString();
    for (const f of files) {
      let d; try { d = JSON.parse(fs.readFileSync(`${DATA}/entities/${f}`, 'utf8')); } catch { continue; }
      if (!d || !d.type || !d.id) continue;
      const k = d.type + ':' + d.id;
      nodes[k] = { type: d.type, id: d.id, name: d.name || d.id, url: d.url || (d.type === 'company' ? 'https://rasmio.com/company/' + d.id : 'https://rasmio.com/person/' + d.id + '/x/') };
      const rows = Array.isArray(d.rows) ? d.rows : [];
      visited[k] = { at: now, rows: rows.length };
      for (const r of rows) {
        const t = r && r.href ? mk(r.href) : null;
        if (!t) continue;
        const tk = t.type + ':' + t.id;
        if (!nodes[tk]) nodes[tk] = { type: t.type, id: t.id, name: (r.name || (Array.isArray(r.cells) && r.cells[0] ? String(r.cells[0]).trim() : '') || t.id), url: t.type === 'company' ? 'https://rasmio.com/company/' + t.id : 'https://rasmio.com/person/' + t.id + '/x/' };
        const role = Array.isArray(r.cells) ? String(r.cells.find((c) => /مدیر|بازرس|عضو|نماینده|رئیس|حق امضا/.test(String(c)) || r.cells[1]) || '') : '';
        const ek = k + '|' + tk + '|' + (r.header || '') + '|' + role;
        if (ekeys.has(ek)) continue;
        ekeys.add(ek);
        edges.push({ from: k, to: tk, kind: r.header || '', role: role.slice(0, 60), cells: r.cells });
      }
    }
    /* صف‌ها: هدف‌های ارجاع‌شده‌ای که فایل ندارند (خزش‌نشده) */
    const pendCo = [], pendPer = [];
    for (const k of Object.keys(nodes)) {
      if (visited[k]) continue;
      const [type, id] = k.split(':');
      if (type === 'company') pendCo.push({ type, id, name: nodes[k].name });
      else pendPer.push({ type, id, name: nodes[k].name });
    }
    /* صفر-ردیف‌ها را «جارو-شده» علامت می‌زنیم — امروز از نو خزش شده‌اند؛ دور تکراری نگیریم */
    const sm = {}; /* صفر-ردیف‌ها باید دوباره جارو شوند (کار واقعی) */
    const old = frontier || {};
    frontier = {
      pending: pendCo, personsLater: pendPer, visited,
      graph: { nodes, edges },
      discovery: old.discovery && old.discovery.searchDone !== undefined ? old.discovery : { v: 9, search: { termIdx: 381, page: 1, provDone: true }, searchDone: true },
      stats: Object.assign({}, old.stats, { entities: Object.keys(visited).length, maxNodes: Math.max(Object.keys(nodes).length, (old.stats && old.stats.maxNodes) || 0) }),
      lastDay: old.lastDay, sweptMap: sm, crawlMode: old.crawlMode,
    };
    log('🔨 بازسازی کامل ✓ — گره:', Object.keys(nodes).length, '· یال:', edges.length, '· صف شرکت:', pendCo.length, '· اشخاص پارک:', pendPer.length);
    return true;
  } catch (e) { log('🔨 خطای بازسازی:', String((e && e.message) || e).slice(0, 120)); return false; }
}

/* ─── خزنده: بارگذاری صف ─── */
let frontier;
try { frontier = JSON.parse(fs.readFileSync('frontier.json', 'utf8')); } catch { frontier = null; }
if (!frontier || !Array.isArray(frontier.pending)) {
  /* فاجعهٔ ۱۷ مهر: frontier خراب → شروع خاموش از صفر. حالا: اول بازسازی از فایل‌های سالم */
  if (!rebuildFromEntities('frontier.json ناخوانا/خراب')) {
    log('🚨 بازسازی نشد — ادامه با دانه‌های اولیه (حالت اضطراری)');
    let seeds = [];
    try { seeds = JSON.parse(fs.readFileSync('companies.json', 'utf8')); } catch {}
    frontier = { pending: seeds.filter((c) => c.nationalId).map((c) => ({ type: 'company', id: c.nationalId, name: c.name })), visited: {}, graph: { nodes: {}, edges: [] }, stats: { runs: 0, entities: 0 } };
  }
}
/* گراف از frontier.json جدا شده — از data/graph.json بارگذاری می‌شود */
if (!frontier.graph || !frontier.graph.nodes || !Object.keys(frontier.graph.nodes).length) {
  try { frontier.graph = loadGraph(); log('🧩 گراف از شاردها بارگیری شد — ' + Object.keys(frontier.graph.nodes).length + ' گره / ' + frontier.graph.edges.length + ' یال'); } catch { frontier.graph = { nodes: {}, edges: [] }; }
}
const repairSummary = restoreIncompleteDetails(frontier, `${DATA}/entities`);
log('DETAIL-REPAIR', repairSummary);
const backlogSummary = backfillKnownDetailQueue(frontier, `${DATA}/entities`);
log('GRAPH-DETAIL-BACKFILL', backlogSummary);
fs.writeFileSync(`${OUT}/graph-detail-backfill-${process.env.GITHUB_RUN_ID || 'local'}.json`, JSON.stringify({ at: new Date().toISOString(), ...backlogSummary }, null, 2));
fs.writeFileSync(`${OUT}/detail-repair-${process.env.GITHUB_RUN_ID || 'local'}.json`, JSON.stringify({ at: new Date().toISOString(), ...repairSummary }, null, 2));
/* ═══ 🧽 پاک‌سازی: صف بدون تکراری + حذف گره‌های زباله (نام‌های خطای صفحه) ═══ */
try {
  const JUNK = /this page couldn|this site can.t be reached|دسترسی ندارید|خطا|error|not found|404/i;
  let removed = 0;
  for (const [k, v] of Object.entries(frontier.graph.nodes || {})) {
    if (typeof v?.url === 'string' && v.url.startsWith(BASE + BASE)) v.url = v.url.slice(BASE.length);
    const nm = String((v && v.name) || '');
    if (!nm || nm === '\u{1F3E2}' || (nm.length < 45 && JUNK.test(nm))) { delete frontier.graph.nodes[k]; removed++; }
  }
  if (removed) log('🧽 ' + removed + ' گرهٔ زباله (نام خطای صفحه) حذف شد');
  const seenP = new Set(); const before = (frontier.pending || []).length;
  /* ⚠️ فقط «خزش‌شده»ها حذف می‌شوند. بودن در گراف یعنی «کشف‌شده با اطلاعات پایه»،
     نه «خزش‌شده» — وگرنه کل صفِ اشخاص/محصولات خالی می‌شد (باگ ۲۴ مهر). */
  frontier.pending = (frontier.pending || []).filter((x) => {
    const k = x.type + ':' + x.id; if (seenP.has(k)) return false; seenP.add(k);
    return !frontier.visited[k];
  });
  const cut = before - frontier.pending.length;
  if (cut > 0) log('🧽 صف پاک‌سازی شد — ' + cut + ' مورد تکراری/خزش‌شده حذف (' + before + ' → ' + frontier.pending.length + ')');
} catch (e) {}

/* ═══ تضمین کار مداوم: صف شرکت خالی است؟ صفر-ردیف‌ها را برای جارو صف کن ═══ */
{
  try {
    frontier.sweptMap = frontier.sweptMap || {};
    const _pendCo = (frontier.pending || []).filter((x) => x.type === 'company').length;
    const _round = Math.min((frontier.sweepRound || 0) + 1, 3);
    if (_pendCo === 0 && _round <= 3) {
      const zeros = Object.entries(frontier.visited || {}).filter(([k, v]) => k.startsWith('company:') && (v || {}).rows === 0 && k !== 'company:0' && (frontier.sweptMap[k] || 0) < _round);
      if (zeros.length) {
        frontier.sweepRound = _round;
        for (const [k] of zeros) { const [type, id] = k.split(':'); frontier.sweptMap[k] = _round; delete frontier.visited[k]; (frontier.pending = frontier.pending || []).push({ type, id, name: ((frontier.graph.nodes || {})[k] || {}).name || id }); }
        log('🧹 جاروی دور ' + _round + ':', zeros.length, 'شرکتِ صفر-ردیف صف شدند — کار مداوم فعال');
      } else if (_round > 1) log('🧹 جارو: دور ' + _round + ' چیزی برای جارو نداشت');
    }
  } catch (e) { log('جارو خطا:', String((e && e.message) || e).slice(0, 100)); }
}

/* واچ‌داگ: گراف کوچک‌تر از نصف بیشینهٔ تاریخی = فاجعه → بازسازی از فایل‌های موجودیت */
{
  const _n = Object.keys(frontier.graph.nodes || {}).length;
  const _floor = Math.max(40000, Math.floor(((frontier.stats && frontier.stats.maxNodes) || 0) * 0.5));
  if (_n && _n < _floor) { log('🚨 واچ‌داگ: گراف ' + _n + ' گره < کف سلامت ' + _floor + ' → بازسازی'); rebuildFromEntities('گراف آسیب‌دیده'); }
}
/* ═══ ادغام با نسخهٔ روی شاخه (چند کارگر همزمان) — هیچ پیشرفتی پاک نمی‌شود ═══ */
function mergeRemoteState() {
  try {
    const rd = (p) => { try { return JSON.parse(execSync(`git show origin/${BRANCH}:${p}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 }).toString()); } catch { return null; } };
    const rf = rd('scripts/rasmio/frontier.json');
    if (rf) {
      frontier.visited = frontier.visited || {};
      const needsRepair = new Set([...(frontier.detailRepair?.remaining || []), ...(frontier.graphDetailBackfill?.reopened || [])]);
      for (const [k, v] of Object.entries(rf.visited || {})) {
        // An old zero/error visit must never hide a newly restored repair task.
        if (needsRepair.has(k) && !(v?.detailSchemaVersion === 2 && ((v.rows || 0) > 0 || (v.tableRows || 0) > 0))) continue;
        const a = frontier.visited[k], b = v || {};
        if (!a) frontier.visited[k] = b;
        else frontier.visited[k] = { ...b, ...a, rows: Math.max(a.rows || 0, b.rows || 0) };
      }
      const seen = new Set((frontier.pending || []).map(keyOf));
      for (const e of rf.pending || []) { const k = keyOf(e); if (!seen.has(k) && !frontier.visited[k]) { frontier.pending.push(e); seen.add(k); } }
      frontier.pending = (frontier.pending || []).filter((e) => !frontier.visited[keyOf(e)]);
      const ps = new Set((frontier.personsLater || []).map(keyOf));
      for (const e of rf.personsLater || []) { const k = keyOf(e); if (!ps.has(k) && !frontier.visited[k]) { (frontier.personsLater = frontier.personsLater || []).push(e); ps.add(k); } }
      frontier.sweptMap = frontier.sweptMap || {};
      for (const [k, v] of Object.entries(rf.sweptMap || {})) frontier.sweptMap[k] = Math.max(frontier.sweptMap[k] || 0, v || 0);
      frontier.sweepRound = Math.max(frontier.sweepRound || 0, rf.sweepRound || 0);
    }
    let rg = rd('scripts/rasmio/data/graph.json');
    if (rg && rg.sharded) {
      /* manifest است: فقط وقتی دادهٔ محلی کمتر از ادعای remote است شاردها را بیاور (صرفه‌جویی در سهمیه) */
      const localN = Object.keys((frontier.graph && frontier.graph.nodes) || {}).length;
      if (rg.nodeCount && localN < rg.nodeCount * 0.9) {
        const g2 = { nodes: {}, edges: [] };
        for (let i = 0; i < GSHARDS; i++) { const sh = rd('scripts/rasmio/data/graph/s-' + String(i).padStart(2, '0') + '.json'); if (sh && sh.nodes) { Object.assign(g2.nodes, sh.nodes); for (const e of (sh.edges || [])) g2.edges.push(e); } }
        rg = { nodes: g2.nodes, edges: g2.edges };
      } else { rg = null; }
    }
    if (rg && rg.nodes) {
      frontier.graph = frontier.graph || { nodes: {}, edges: [] };
      for (const [k, v] of Object.entries(rg.nodes || {})) if (!frontier.graph.nodes[k]) frontier.graph.nodes[k] = v;
      const have = new Set((frontier.graph.edges || []).map((e) => `${e.from}|${e.to}|${e.kind}|${e.role}`));
      for (const e of rg.edges || []) { const k = `${e.from}|${e.to}|${e.kind}|${e.role}`; if (!have.has(k)) { frontier.graph.edges.push(e); have.add(k); } }
    }
    frontier.stats = frontier.stats || {};
    frontier.stats.maxNodes = Math.max(frontier.stats.maxNodes || 0, (rg && rg.nodes ? Object.keys(rg.nodes).length : 0));
    saveFrontier();
  } catch {}
}

const saveFrontier = () => {
  try {
    const { graph, ...rest } = frontier;
    fs.writeFileSync('frontier.json.tmp', JSON.stringify(rest));
    fs.renameSync('frontier.json.tmp', 'frontier.json');
    if (graph && graph.nodes) { const r = saveGraphShards(); if (r) frontier.stats.graphNodes = r.n; }
  } catch {}
};
const normId = (href) => {
  const pm = String(href).match(/\/person\/([0-9A-Fa-f]+)/);
  if (pm) return { type: 'person', id: pm[1] };
  const cm = String(href).match(/\/company\/(\d+)/);
  if (cm) return { type: 'company', id: cm[1] };
  /* 🆕 محصول / برند / اختراع هم شناسایی می‌شوند ⇒ از صفحهٔ محصول، شرکت تازه درمی‌آید */
  const pr = String(href).match(/\/product\/([0-9A-Za-z]+)/);
  if (pr) return { type: 'product', id: pr[1] };
  const br = String(href).match(/\/brand\/([0-9A-Za-z]+)/);
  if (br) return { type: 'brand', id: br[1] };
  const pa = String(href).match(/\/patent\/([0-9A-Za-z]+)/);
  if (pa) return { type: 'patent', id: pa[1] };
  return null;
};
const keyOf = (e) => `${e.type}:${e.id}`;
/* دقت داده: موجودیت‌های «صفر-ردیف» که قبلاً بازدید شده‌اند یک‌بار در اجرای بعدی دوباره خزیده می‌شوند
   (ممکن است قربانیِ سهمیه/اعتبار بوده باشند نه واقعاً خالی). zeroRetried جلوی حلقهٔ بی‌نهایت را می‌گیرد. */
for (const [k, v] of Object.entries(frontier.visited)) {
  if (!v) continue;
  const freshZero = v.rows === 0 && !v.zeroRetried;
  const suspect = v.suspect && (v.suspectTries || 0) < 8;
  if ((freshZero || suspect) && !frontier.pending.some((p2) => keyOf(p2) === k)) {
    const [type, id] = k.split(':');
    frontier.pending.push({ type, id, name: (frontier.graph.nodes[k] || {}).name || id, zeroRetry: true });
    v.zeroRetried = true;
    v.suspectTries = (v.suspectTries || 0) + 1;
  }
}
/* مهاجرت کشف: هر بار موتور جدید نصب شد، وضعیت کشفِ نسخهٔ قبل خودکار بازنشانی می‌شود (بدون تضاد git) */
const DISCOVERY_V = 9;
/* نگهبان روزانه: هر روز جدید = یک دور کشف تازه برای شرکت‌های تازه‌ثبت‌شدهٔ رسمیو */
{
  const today = new Date().toISOString().slice(0, 10);
  if (frontier.lastDay !== today) {
    frontier.lastDay = today;
    if (frontier.discovery && frontier.discovery.searchDone) {
      frontier.discovery.searchDone = false;
      if (frontier.discovery.search) { frontier.discovery.search.termIdx = 0; frontier.discovery.search.page = 1; }
      log('🌅 تازه‌سازی روزانه: جستجوی شرکت‌های جدید رسمیو دوباره فعال شد');
    }
  }
}
if (!frontier.discovery || frontier.discovery.v !== DISCOVERY_V) {
  frontier.discovery = { v: DISCOVERY_V, search: { termIdx: 0, page: 1, provDone: true }, searchDone: false }; /* v9: استان‌ها کامل شده — مستقیم عبارت‌ها */
  log('کشف: موتور نسخهٔ ' + DISCOVERY_V + ' — وضعیت کشف بازنشانی شد');
}

const enqueue = (ent, via) => {
  if (!ent || !ent.id) return;
  const k = keyOf(ent);
  /* 🆕 اشخاص و محصولات دیگر پارکِ مطلق نمی‌شوند — مستقیم در صف (درخواست ۲۴ مهر) */
  if (ent.type === 'person' || ent.type === 'product' || ent.type === 'brand' || ent.type === 'patent') {
    if (frontier.visited[k] || frontier.pending.some((p) => keyOf(p) === k)) return;
    if (ent.type !== 'person' && frontier.pending.length > 400000) return; // Known people must not be silently dropped.
    frontier.pending.push(ent);
    if (via) dbg('enqueue-' + k, { via });
    return;
  }
  if (frontier.visited[k] || frontier.pending.some((p) => keyOf(p) === k)) return;
  frontier.pending.push(ent);
  if (via) dbg('enqueue-' + k, { via });
};

/* ═══ کشف از صفحات جستجوی شرکت‌های رسمیو: /search/companies/?q=… ═══ */
const PROVINCES = ['تهران','البرز','اصفهان','فارس','خراسان رضوی','خراسان شمالی','خراسان جنوبی','آذربایجان شرقی','آذربایجان غربی','اردبیل','بوشهر','چهارمحال و بختیاری','خوزستان','زنجان','سمنان','سیستان و بلوچستان','قزوین','قم','کردستان','کرمان','کرمانشاه','گیلان','گلستان','لرستان','مازندران','مرکزی','هرمزگان','همدان','یزد','ایلام','کهگیلویه وبویراحمد'];
const SEARCH_TERMS = ["فناوران", "شرکت", "بازرگانی", "صنایع", "مهندسی", "فناوری", "سرمایه", "ساختمان", "پزشکی", "آموزش", "تجارت", "توسعه", "هلدینگ", "پتروشیمی", "معدن", "کشاورزی", "صنعتی", "خدمات", "ارتباطات", "تجهیزات", "پارس", "ایران", "تهران", "اصفهان", "مشهد", "تبریز", "شیراز", "کرج", "اهواز", "یزد", "کرمان", "همدان", "گروه", "بین‌الملل", "تجارتی", "مشارکت", "تعاونی", "آبی", "غذایی", "دارویی", "صادرات", "واردات", "توزیع", "تولید", "عمران", "نفت", "گاز", "فولاد", "مس", "آلومینیوم", "سیمان", "بتن", "حمل و نقل", "لجستیک", "بیمه", "دارو", "نساجی", "پوشاک", "چاپ", "بسته‌بندی", "پلاستیک", "شیشه", "سرامیک", "کاشی", "چوب", "خودرو", "ماشین‌آلات", "تجهیزات پزشکی", "تبلیغات", "گردشگری", "هتل", "رستوران", "نمایشگاه", "املاک", "مصالح", "ابزار", "الکترونیک", "کامپیوتر", "برق", "تاسیسات", "autos", "تولیدی", "صنعت", "حسابرسی", "ایرانیان", "مدیریت", "ماشین", "گستر", "آریا", "نوین", "استان", "اتحادیه", "سازان", "الملل", "سازی", "مجتمع", "تامین", "کیش", "بسته", "بندی", "کشت", "شیمی", "شرق", "المللی", "رسمی", "گسترش", "ساختمانی", "پارسیان", "آلات", "حسابداران", "صندوق", "فارس", "مالی", "سپهر", "سازه", "انرژی", "نگین", "کارکنان", "خراسان", "غرب", "آتیه", "آزاد", "سبز", "پویا", "بانک", "آرمان", "امین", "مهر", "منطقه", "زرین", "آسیا", "مسکن", "جهان", "البرز", "روستایی", "کیمیا", "تدبیر", "شهر", "آذر", "پاسارگاد", "شهرستان", "امید", "زاگرس", "سپاهان", "پترو", "گلستان", "ایلام", "اسلامی", "شیر", "صبا", "کارخانجات", "فرآورده", "شرکتهای", "کار", "معدنی", "ستاره", "پایدار", "نیرو", "لوله", "چابهار", "آوری", "شیمیایی", "سامان", "نور", "نیک", "آرد", "هوشمند", "خاورمیانه", "سینا", "پیشرو", "ساخت", "سازمان", "اطلاعات", "سلامت", "کارگزاری", "شمال", "صنف", "نوآوران", "کاسپین", "آهن", "پردیس", "توس", "کویر", "حساب", "افق", "جنوب", "گیلان", "پگاه", "ذوب", "ملی", "اختصاصی", "کوثر", "سهند", "خلیج", "مواد", "بازارگردانی", "آذربایجان", "خزر", "آفرین", "گستران", "دامپروری", "پالایش", "قشم", "پاستوریزه", "پاک", "خدماتی", "معادن", "ارومیه", "خوزستان", "میبد", "پخش", "فنی", "سنگ", "آینده", "ساز", "نگر", "اوراق", "بهادار", "اردبیل", "اعتماد", "آرین", "کردستان", "نصر", "پیشگامان", "سیستم", "طلایی", "داروسازی", "پرورش", "لرستان", "نورد", "فرش", "کابل", "پرتو", "اندیشان", "همکاران", "بهداشتی", "فجر", "قند", "دشت", "حمایت", "بخش", "پلیمر", "موتور", "رفاه", "فرا", "کرمانشاه", "نوید", "پایا", "قطعات", "ثابت", "بوشهر", "آرتا", "اقتصادی", "پژوهش", "روی", "کاران", "آوران", "بنیاد", "اقتصاد", "فیروزه", "داران", "زنجان", "کاوه", "مشاورین", "ارزش", "سامانه", "ایمن", "ملت", "مرکز", "آریان", "مشاور", "فردا", "فرآوری", "قزوین", "سبلان", "الکتریک", "دقیق", "بیرجند", "همراه", "ارگ", "مانا", "پردازش", "غیر", "مپنا", "غدیر", "اعتبار", "اندیش", "پویش", "اندیشه", "دانا", "سرام", "سپید", "ارتباط", "اروند", "بازار", "ارقام", "نیروی", "پردازان", "ویرا", "دماوند", "دانش", "آفتاب", "امیر", "کبیر", "الماس", "سایپا", "فراز", "بازنشستگی", "آباد", "طلوع", "کالای", "کیان", "تابان", "عالی", "مصرف", "بزرگ", "درآمد", "توان", "اطلس", "آذین", "الوند", "پرشیا", "ارس", "جهاد", "راد", "پارت", "ایساتیس", "آفرینان", "ماهان", "داده", "آوند", "خرم", "آرا", "غذائی", "طراحی", "زمین", "دیزل", "تجهیز", "اراک", "آمل", "پارسه", "محاسب", "سهام", "آسمان", "مروارید", "بیستون", "پروفیل", "سیم", "لبنی", "رنگ", "دامداران", "پلاست", "بنیان", "هزار", "گرگان", "داروئی", "بجنورد", "زنجیره", "شمالی", "جنوبی", "دلیجان", "کارا", "نوآوری", "نوش", "مازندران", "فرهنگی", "آوا", "رشد", "ایده", "تراز", "نما", "مهام", "خاور", "خیریه", "ثروت", "نقش", "پرشین", "پیام", "فارمد", "یکتا", "مهرگان"];
async function discoverSeeds(maxNew = 400) {
  let added = 0;
  const dT0 = Date.now();
  const dTimeUp = () => (Date.now() - dT0) > Number(process.env.DISCOVER_TIME_MS || 700_000) || hardTimeUp(); /* سهم کشف: حداکثر ۵ دقیقه — خزش هیچ‌وقت قربانی کشف نمی‌شود */
  const D = frontier.discovery = frontier.discovery || {};
  if (D.v !== DISCOVERY_V) { D.v = DISCOVERY_V; D.searchDone = false; D.search = { termIdx: 0, page: 1, mode: null, pi: 0, ppage: 1, provDone: true }; }
  const S = D.search = D.search || { termIdx: 0, page: 1, mode: null, pi: 0, ppage: 1, provDone: false };
  S.pi = S.pi || 0; S.ppage = S.ppage || 1; if (S.provDone === undefined) S.provDone = false;
  /* ═══ 🧪 پروب ۵: آیا API محدودمان کرده؟ ۵ عبارت شناخته‌شده، آرام ═══ */
  try {
    if (!fs.existsSync(`${DATA}/probe-api5.json`)) {
      const H = { accept: 'application/json, text/plain, */*', 'accept-language': 'fa-IR,fa;q=0.9', referer: `${BASE}/search/all/`, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };
      const R = { at: new Date().toISOString(), tests: [] };
      for (const t of ['فناوران', 'بازرگانی', 'صنایع', 'مهندسی', 'پتروشیمی', 'آ', 'دد', 'a']) {
        const u = `${BASE}/api/search/search/all?page=0&pageSize=60&q=${encodeURIComponent(t)}`;
        try {
          const r = await fetch(u, { headers: H, cache: 'no-store' });
          const txt = await r.text();
          let j = null; try { j = JSON.parse(txt); } catch {}
          R.tests.push({ t, s: r.status, n: (j && j.hits) ? j.hits.length : -1, total: j && j.totalCount, len: txt.length, head: txt.slice(0, 100) });
        } catch (e) { R.tests.push({ t, err: String(e).slice(0, 60) }); }
        await sleep(2500);
      }
      try { fs.writeFileSync(`${DATA}/probe-api5.json`, JSON.stringify(R, null, 1)); } catch {}
      log('🧪 پروب ۵: ' + R.tests.map((x) => (x.t + '=' + x.n)).join(' '));
    }
  } catch (e) { log('🧪 خطای پروب ۵:', String((e && e.message) || e).slice(0, 80)); }
  /* ═══ 🚀🚀 فاز APIQ: انفجار جستجو — هزاران عبارت × ۱۶۵ صفحه با ۸ درخواست همزمان ═══ */
  {
    if (D.apiq && D.apiq.v !== 7) D.apiq = null;  /* نسخهٔ ۲: بازپیمایش با آهنگ درست */
    const AQ = D.apiq = D.apiq || { v: 7, termIdx: 0, page: -1, next: {}, done: false, found: 0, queries: 0, zero: 0 };
    if (!D.apiqTerms) {
      const FA = 'آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'.split('');
      const EN = 'abcdefghijklmnopqrstuvwxyz'.split('');
      const NUM = '۰۱۲۳۴۵۶۷۸۹'.split('');
      const terms = [];
      const push = (t) => { if (t && !terms.includes(t)) terms.push(t); };
      /* حروف دوگانه اول — هر کدام مجموعهٔ محدود و متمایز ⇒ پوشش بالا بدون بریدن در سقف ۹,۹۶۰ */
      FA.forEach((c) => FA.forEach((d) => push(c + d)));
      SEARCH_TERMS.forEach(push);
      PROVINCES.forEach(push);
      FA.forEach(push);
      EN.forEach(push);
      NUM.forEach(push);
      D.apiqTerms = terms;
      log('🚀🚀 عبارت‌های کشف ساخته شد: ' + terms.length + ' عبارت');
    }
    const TERMS = D.apiqTerms;
    AQ.quotaOut = false;
    AQ.pace = Number(process.env.APIQ_PACE_MS || 700);
    if (!AQ.done) {
      const H = { accept: 'application/json, text/plain, */*', 'accept-language': 'fa-IR,fa;q=0.9', referer: `${BASE}/search/all/`, 'user-agent': UA_NORM || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };
      const ST = {};
      let pace = AQ.pace || Number(process.env.APIQ_PACE_MS || 700);   /* فاصلهٔ بین درخواست‌ها — محترمانه */
      let badRun = 0;
      const J = async (u) => {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const r = await fetch(u, { headers: H, cache: 'no-store' });
            ST[r.status] = (ST[r.status] || 0) + 1;
            if (r.status === 429 || r.status === 403 || r.status === 503) {
              badRun++;
              if (badRun >= 8) { AQ.quotaOut = true; return null; }  /* سهمیهٔ این IP تمام — وقت را نسوزان */
              const ra = Number(r.headers.get('retry-after') || 0);
              pace = Math.min(Math.round(pace * 1.8), 15000);
              AQ.pace = pace;
              await sleep(ra ? Math.min(ra * 1000, 60_000) : Math.min(4000 * attempt + 3000, 25_000));
              continue;
            }
            if (!r.ok) return null;
            badRun = Math.max(0, badRun - 1);
            pace = Math.max(250, Math.round(pace * 0.92));
            AQ.pace = pace;
            return await r.json();
          } catch { ST.err = (ST.err || 0) + 1; await sleep(2000); }
        }
        return null;
      };
      const pendKeys = new Set((frontier.pending || []).map((x) => x.type + ':' + x.id));
      /* «تازه» یعنی در کل گراف نباشد، نه فقط خزش‌نشده — وگرنه ۵۰۰ هزار گرهٔ موجود
         دوباره «تازه» شمرده می‌شدند و صف با تکراری پر می‌شد (باگ ۲۴ مهر) */
      const seen = new Set(Object.keys(frontier.visited || {}));
      for (const k of Object.keys(frontier.graph.nodes || {})) seen.add(k);
      const N = frontier.graph.nodes = frontier.graph.nodes || {};
      let got = 0, reqs = 0, qDone = 0;
      const handle = (hits) => {
        let fresh = 0;
        for (const h of hits || []) {
          const link = String(h.link || '');
          const m = link.match(/^\/(company|person|brand|product|patent|invention)\/([A-Za-z0-9]+)/);
          if (!m) continue;
          const type = m[1], id = m[2];
          const key = type + ':' + id;
          if (!seen.has(key)) {
            seen.add(key); got++; fresh++;
            /* 🆕 همهٔ نوع‌ها (شرکت/شخص/محصول/برند/اختراع) در صف خزش می‌روند */
            if (!frontier.pending.some((x) => x.type === type && x.id === id)) {
              pendKeys.add(key);
              frontier.pending.push({ type, id, name: h.title || undefined });
            }
          }
          if (!N[key]) {
            N[key] = { type, id, name: h.title || undefined, url: `${BASE}${link}`, ...(h.information ? { info: String(h.information).slice(0, 220) } : {}), ...(h.subTitle ? { sub: h.subTitle } : {}) };
          }
          if (added >= maxNew) break;
        }
        added += fresh;
        return fresh;
      };
      AQ.dead = AQ.dead || [];
      const deadSet = new Set(AQ.dead);
      let tcur = AQ.termIdx + (typeof SLOT === 'number' ? SLOT : 0);
      while (!AQ.done && !dTimeUp() && added < maxNew && !AQ.quotaOut) {
        AQ.termIdx = tcur;
        const term = TERMS[tcur % TERMS.length];
        if (term === undefined) { AQ.done = true; log('🚀🚀 ✅ همهٔ ' + TERMS.length + ' عبارت پیموده شد — کل تازه: ' + AQ.found); break; }
        if (deadSet.has(term)) { tcur++; AQ.page = -1; continue; }
        /* شروع عبارت: عمق واقعی را از totalCount بفهم */
        AQ.next = AQ.next || {};
        if (AQ.next[term] === undefined) {
          const j0 = await J(`${BASE}/api/search/search/all?page=0&pageSize=60&q=${encodeURIComponent(term)}`);
          reqs++;
          if (!j0 || !Array.isArray(j0.hits)) { tcur++; AQ.page = -1; continue; }
          if (j0.hits.length === 0) { AQ.dead.push(term); deadSet.add(term); tcur++; AQ.page = -1; continue; }
          const total = Number(j0.totalCount || j0.hits.length);
          AQ.next[term] = Math.max(0, Math.min(165, Math.ceil(Math.min(total, 9960) / 60) - 1));  /* از عمیق‌ترین صفحه به عقب */
          AQ.termTotal = total;
          handle(j0.hits);
        }
        AQ.page = AQ.next[term];
        let termFresh = 0, okPages = 0, badPages = 0;
        while (AQ.page >= 0 && !dTimeUp() && added < maxNew && !AQ.quotaOut) {
          const j = await J(`${BASE}/api/search/search/all?page=${AQ.page}&pageSize=60&q=${encodeURIComponent(term)}`);
          reqs++;
          if (!j || !Array.isArray(j.hits)) { badPages++; AQ.page--; if (badPages >= 6 || AQ.quotaOut) break; continue; }
          badPages = 0; okPages++;
          termFresh += handle(j.hits);
          AQ.page--;
          AQ.next[term] = AQ.page;
          if (okPages % 10 === 0) saveFrontier();
          await sleep(pace);
        }
        AQ.queries++; AQ.found += termFresh; qDone++;
        if (okPages > 0 && termFresh === 0 && AQ.page < 0) { AQ.dead.push(term); deadSet.add(term); AQ.zero++; }
        if (termFresh) { AQ.emptyTerms = 0; log('🚀🚀 «' + term + '» (کل ' + AQ.termTotal + ') → ' + termFresh + ' تازه · ' + okPages + ' صفحه (کل: ' + AQ.found + ' · عبارت ' + AQ.termIdx + '/' + TERMS.length + ')'); }
        if (AQ.page < 0) { tcur++; AQ.page = -1; }   /* عبارت کامل پیموده شد */
        saveFrontier();
      }
      if (reqs > 0 && !(ST && ST['200'])) log('🔄 سهمیهٔ این IP تمام شد — اجرا تمام می‌شود تا اجرای بعدی با IP تازه بیاید');
      log('🚀🚀 فاز APIQ این اجرا: ' + qDone + ' عبارت، ' + reqs + ' درخواست، ' + got + ' تازه · صف: ' + frontier.pending.length + ' · مرده: ' + AQ.dead.length + (AQ.quotaOut ? ' · 🚫 سهمیهٔ IP تمام' : '') + ' · وضعیت‌ها: ' + JSON.stringify(ST) + ' · ' + pace + 'ms');
    }
  }
  /* ═══ 🚀 فاز API: کشف کامل از API واقعی جستجو (سریع‌ترین و کامل‌ترین منبع) ═══ */
  {
    const A = D.api = D.api || { page: 0, size: 60, total: null, pages: null, done: false, found: 0, reqs: 0 };
    if (!A.done) {
      const H = { accept: 'application/json, text/plain, */*', 'accept-language': 'fa-IR,fa;q=0.9', referer: `${BASE}/search/all/`, 'user-agent': UA_NORM || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };
      const J = async (u) => { try { const r = await fetch(u, { headers: H, cache: 'no-store' }); if (!r.ok) return null; return await r.json(); } catch { return null; } };
      if (!A.pages) {
        const j0 = await J(`${BASE}/api/search/search/all?page=0&pageSize=${A.size}`);
        if (j0) { A.total = j0.totalCount ?? null; A.pages = j0.possiblePages ?? (A.total ? Math.ceil(A.total / A.size) : 200); A.page = 0; log('🚀 API کشف: کل نتایج ' + A.total + ' · صفحات ' + A.pages); }
      }
      let got = 0, pages = 0;
      while (!A.done && A.pages && A.page < A.pages && added < maxNew && !dTimeUp()) {
        const j = await J(`${BASE}/api/search/search/all?page=${A.page}&pageSize=${A.size}`);
        A.reqs++;
        if (!j || !Array.isArray(j.hits)) { await sleep(1500); A.miss = (A.miss || 0) + 1; if (A.miss >= 5) { A.done = true; log('🚀 API: پنج پاسخ بد پیاپی — توقف'); } A.page++; continue; }
        A.miss = 0;
        if (j.hits.length === 0) { A.done = true; A.pages = A.page; log('🚀 ✅ پایان نتایج API در صفحهٔ ' + A.page + ' (کل تازه: ' + A.found + ')'); break; }
        let fresh = 0;
        for (const h of j.hits) {
          const link = String(h.link || '');
          const m = link.match(/^\/(company|person)\/([A-Za-z0-9]+)/);
          const type = m ? m[1] : (link.startsWith('/company') ? 'company' : link.startsWith('/person') ? 'person' : null);
          const id = m ? m[2] : (h.id ? String(h.id) : null);
          if (!type || !id) continue;
          const k = `${type}:${id}`;
          if (frontier.visited[k] || frontier.pending.some((x) => x.type === type && x.id === id)) continue;
          frontier.pending.push({ type, id, name: h.title || undefined });
          fresh++; added++; got++;
          if (added >= maxNew) break;
        }
        A.page++; pages++; A.found += fresh;
        if (fresh) log('🚀 API ص ' + A.page + '/' + A.pages + ' → ' + j.hits.length + ' نتیجه، ' + fresh + ' تازه (کل API: ' + A.found + ')');
        saveFrontier();
        if (A.page >= A.pages) { A.done = true; log('🚀 ✅ کل API جستجو پیموده شد — ' + A.pages + ' صفحه · ' + A.found + ' تازه'); }
        await sleep(250);
      }
      log('🚀 فاز API این اجرا: ' + pages + ' صفحه، ' + got + ' تازه · صف: ' + frontier.pending.length);
    }
  }
  /* 🚀 فاز APIQ ثابت کرده هزاران شرکت می‌آورد؛ فازهای قدیمی مرورگری خروجی صفر دارند
     و کل بودجهٔ کشف را می‌بلعیدند. وقتی APIQ زنده است، آن‌ها خاموش می‌شوند. */
  const APIQ_LIVE = !!(D.apiq && D.apiq.found > 0);
  if (APIQ_LIVE && !D.oldOffLogged) { D.oldOffLogged = true; log('🚀 فازهای قدیمی کشف (استان/عبارت/ALL) خاموش شد — APIQ با ' + D.apiq.found + ' شرکت کار می‌کند'); }
  if (D.searchDone && (D.deep && D.deep.termIdx >= SEARCH_TERMS.length) && fs.existsSync(`${DATA}/probe-all3.json`) && (D.all && D.all.done) && (D.api && D.api.done) && (D.apiq && D.apiq.done)) return 0; /* تا کاوش‌ها ذخیره نشده‌اند، ادامه بده */
  /* مرحلهٔ ۱: پیمایش سیستماتیک استان‌ها — پوشش کامل ایندکس جستجوی رسمیو */
  const mkProvUrl = (prov, p) => `${BASE}/search/companies/?provinces=${encodeURIComponent(prov)}&q=&page=${p}`;
  const mkUrl = (t, p) => `${BASE}/search/companies/?q=${encodeURIComponent(t)}${p > 1 ? `&page=${p}` : ''}`;
  /* پروب: fetch یا رندر مرورگر؟ */
  if (!S.mode) {
    const r = await fetch(mkUrl(SEARCH_TERMS[0], 1), { cache: 'no-store' }).catch(() => null);
    const html = r && r.ok ? await r.text() : '';
    const nFetch = (html.match(/\/company\/\d+/g) || []).length;
    let mode = null;
    if (nFetch >= 3) mode = 'fetch';
    else {
      try { await page.goto(mkUrl(SEARCH_TERMS[0], 1), { waitUntil: 'domcontentloaded', timeout: 30_000 }); } catch {}
      await sleep(7000);
      const html2 = await page.content().catch(() => '');
      const nB = (html2.match(/\/company\/\d+/g) || []).length;
      dbg('probe-companies-browser', { n: nB, url: page.url().slice(0, 120) });
      try { dbg('companies-page-dump', await page.evaluate(() => ({ text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200) }))); } catch {}
      if (nB >= 3) mode = 'browser';
    }
    dbg('probe-companies', { nFetch, mode });
    if (!mode) { D.searchDone = true; log('کشف: صفحهٔ /search/companies هم نتیجه نداد'); return 0; }
    S.mode = mode;
    log('کشف: حالت', mode, 'فعال شد —', nFetch, 'لینک');
  }
  /* ── مرحلهٔ ۱: استان‌ها (پیمایش کامل تا آخرین صفحه) ── */
  while (!S.provDone && added < maxNew && S.pi < PROVINCES.length && !APIQ_LIVE) {
    const prov = PROVINCES[S.pi];
    let html = '';
    try {
      if (S.mode === 'fetch') {
        const r = await fetch(mkProvUrl(prov, S.ppage), { cache: 'no-store' }).catch(() => null);
        if (!r || !r.ok) { S.pi++; S.ppage = 1; continue; }
        html = await r.text();
      } else {
        try { await page.goto(mkProvUrl(prov, S.ppage), { waitUntil: 'domcontentloaded', timeout: 30_000 }); } catch { S.pi++; S.ppage = 1; continue; }
        await sleep(6000);
        html = await page.content();
      }
    } catch (e) { log('کشف: خطای شبکه استان ' + prov + ' — رد شد:', String(e).slice(0, 60)); await sleep(2000); continue; }
    const compIds = new Set([...html.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]));
    let found = 0;
    for (const id of compIds) {
      const k = `company:${id}`;
      if (frontier.visited[k] || frontier.pending.some((x) => x.type === 'company' && x.id === id)) continue;
      frontier.pending.push({ type: 'company', id }); found++; added++;
      if (added >= maxNew) break;
    }
    log(`کشف استان ${S.pi + 1}/۳۱: «${prov}» صفحه ${S.ppage} → ${compIds.size} شرکت، ${found} تازه (جمع: ${added})`);
    saveFrontier();
    if (compIds.size === 0 || (found === 0 && S.ppage >= 10)) { S.pi++; S.ppage = 1; }
    else S.ppage++;
    await sleep(1500);
    if (dTimeUp()) { log('کشف: سهم زمانی این اجرا تمام شد — پیمایش استان‌ها در اجرای بعدی ادامه می‌یابد (استان ' + (S.pi + 1) + '/۳۱)'); return added; }
  }
  if (S.pi >= PROVINCES.length && !S.provDone) { S.provDone = true; log('کشف استانی کامل شد: هر ۳۱ استان پیمایش شد ✓'); }
  /* ── مرحلهٔ ۲ (فقط بعد از اتمام استان‌ها): عبارت‌ها برای شرکت‌های تازه‌ثبت‌شده ── */
  while (added < maxNew && S.termIdx < SEARCH_TERMS.length && !APIQ_LIVE) {
    const term = SEARCH_TERMS[S.termIdx];
    let html = '';
    try {
      if (S.mode === 'fetch') {
        const r = await fetch(mkUrl(term, S.page), { cache: 'no-store' }).catch(() => null);
        if (!r || !r.ok) { S.termIdx++; S.page = 1; continue; }
        html = await r.text();
      } else {
        try { await page.goto(mkUrl(term, S.page), { waitUntil: 'domcontentloaded', timeout: 30_000 }); } catch { S.termIdx++; S.page = 1; continue; }
        await sleep(6000);
        html = await page.content();
      }
    } catch (e) { log('کشف: خطای شبکه عبارت «' + term + '» — رد شد:', String(e).slice(0, 60)); await sleep(2000); continue; }
    const compIds = new Set([...html.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]));
    let found = 0;
    for (const id of compIds) {
      const k = `company:${id}`;
      if (frontier.visited[k] || frontier.pending.some((x) => x.type === 'company' && x.id === id)) continue;
      frontier.pending.push({ type: 'company', id }); found++; added++;
      if (added >= maxNew) break;
    }
    log(`کشف: «${term}» صفحه ${S.page} → ${compIds.size} شرکت در صفحه، ${found} تازه (جمع این اجرا: ${added})`);
    saveFrontier();
    if (compIds.size === 0 || (found === 0 && S.page >= 6)) { S.termIdx++; S.page = 1; }
    else S.page++;
    await sleep(1600);
    if (dTimeUp()) { log('کشف: سهم زمانی این اجرا تمام شد — ادامه در اجرای بعدی'); return added; }
  }
  if ((S.termIdx >= SEARCH_TERMS.length || APIQ_LIVE) && !D.searchDone) { D.searchDone = true; log('کشف: فاز مرورگری پایان یافت' + (APIQ_LIVE ? ' (APIQ جایگزین شد)' : '')); }
  /* ═══ مرحلهٔ ۳ (جدید): اسکن عمیق — صفحه‌های ۷ به بعد که هرگز دیده نشده ═══ */
  if (D.searchDone && added < maxNew && !APIQ_LIVE) {
    try {
      const Dp = D.deep = D.deep || { termIdx: 0, page: 7, probeDone: false };
      /* ═══ 🗂 فاز ALL: پیمایش کامل جستجوی «همه» با کلیک صفحه‌بندی (کشف بزرگ ۲۳ مهر) ═══ */
      try {
        if (!D.all || D.all.v !== 2) D.all = { v: 2, page: 0, maxPages: 200, done: false, found: 0, fails: 0 };
        const DA = D.all;
        if (DA.fails === undefined) DA.fails = 0;
        const firstId = (h) => (h.match(/\/company\/(\d+)/) || [])[1] || null;
        if (!DA.done && added < maxNew) {
          /* هر اجرا از صفحهٔ ۱ شروع می‌کند (پارامتر URL بی‌اثر است) و تا صفحهٔ DA.page جلو می‌رود */
          const target = DA.maxPages;
          await page.goto(`${BASE}/search/all/`, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
          await sleep(8000);
          log('🗂 فاز ALL شروع — پیمایش با کلیک تا پایان بودجهٔ زمانی');
          let cur = 0, got = 0, fails = 0, walked = 0;
          while (cur < DA.maxPages && added < maxNew && !dTimeUp()) {
            const h = await page.content().catch(() => '');
            const ids = [...new Set([...h.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]))];
            const before = ids[0] || null;
            let fresh = 0;
            for (const id of ids) {
              const k = `company:${id}`;
              if (frontier.visited[k]) continue;
              if (frontier.pending.some((x) => x.type === 'company' && x.id === id)) continue;
              frontier.pending.push({ type: 'company', id });
              fresh++; added++; got++;
              if (added >= maxNew) break;
            }
            cur++; walked++; DA.page = (DA.page || 0) + 1; DA.found += fresh;
            if (DA.page >= DA.maxPages) { DA.done = true; log('🗂 ALL تمام شد — به سقف ' + DA.maxPages + ' صفحه رسید'); }
            log('🗂 ALL ص ' + DA.page + ' → ' + ids.length + ' شرکت، ' + fresh + ' تازه (این اجرا: ' + got + ' · کل ALL: ' + DA.found + ')');
            saveFrontier();
            if (DA.done) break;
            /* کلیک «صفحهٔ بعد» + انتظار تا تغییر واقعی محتوا (تا ۴ تلاش) */
            let moved = false;
            for (let t = 0; t < 4 && !moved; t++) {
              const ok = await page.evaluate(() => {
                const sel = 'button[aria-label="Go to next page"]';
                let b = document.querySelector(sel);
                if (!b) b = [...document.querySelectorAll('button')].find((e) => /next page|بعدی/i.test(e.getAttribute('aria-label') || ''));
                if (b && !b.disabled) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
                return false;
              }).catch(() => false);
              if (!ok) { await sleep(1500 + t * 1000); continue; }
              for (let w = 0; w < 12; w++) {
                await sleep(900);
                const h2 = await page.content().catch(() => '');
                const id2 = firstId(h2);
                if (id2 && id2 !== before) { moved = true; break; }
              }
            }
            if (!moved) {
              fails++; DA.fails = fails;
              log('🗂 ALL: پرش به صفحهٔ بعد نشد (تلاش ' + fails + ') — توقف این اجرا، ادامه در اجرای بعد');
              if (fails >= 3) { DA.page = Math.max(0, DA.page - 1); log('🗂 ALL: سه شکست پیاپی — کل صفحه‌های پیموده‌شده: ' + DA.page); break; }
              break;
            }
            fails = 0;
            await sleep(1800 + Math.random() * 700);
          }
          if (DA.page > 150) DA.done = true;
          log('🗂 فاز ALL این اجرا: ' + walked + ' صفحه، ' + got + ' شرکت تازه · کل ALL: ' + DA.found + ' ص · صف کل: ' + frontier.pending.length);
        }
      } catch (e) { log('🗂 خطای فاز ALL:', String((e && e.message) || e).slice(0, 100)); }
      /* 🔬 کاوش ساختار صفحه‌بندی ALL (probe-all3) */
      try {
        if (!fs.existsSync(`${DATA}/probe-all3.json`)) {
          const out = { at: new Date().toISOString(), steps: [] };
          await page.goto(`${BASE}/search/all/`, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
          await sleep(9000);
          for (let i = 0; i < 8; i++) {
            const st = await page.evaluate(() => {
              const btns = [...document.querySelectorAll('button')].filter((b) => (b.className || '').includes('MuiPaginationItem'));
              const ids = [...new Set([...document.body.innerHTML.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]))];
              return {
                labels: btns.map((b) => (b.getAttribute('aria-label') || b.innerText || '').slice(0, 24)),
                disabled: btns.map((b) => !!b.disabled),
                first: ids[0] || null, n: ids.length,
                total: (document.body.innerText.match(/بیش از ([۰-۹,]+) نتیجه/) || [])[1] || null,
              };
            }).catch((e) => ({ err: String(e).slice(0, 80) }));
            out.steps.push({ i, ...st });
            /* کلیک روی صفحهٔ بعد (ترجیح: شمارهٔ بعدی، بعد فلش) */
            const clicked = await page.evaluate(() => {
              const btns = [...document.querySelectorAll('button')].filter((b) => (b.className || '').includes('MuiPaginationItem'));
              const cur = btns.find((b) => (b.getAttribute('aria-label') || '').includes('current') || b.getAttribute('aria-current'));
              const nextNum = btns.find((b) => /^Go to page \d+/.test(b.getAttribute('aria-label') || '') && !b.disabled);
              const arrow = btns.find((b) => /next page/i.test(b.getAttribute('aria-label') || '') && !b.disabled);
              const t = nextNum || arrow;
              if (t) { t.click(); return (t.getAttribute('aria-label') || ''); }
              return null;
            }).catch(() => null);
            out.steps[out.steps.length - 1].clicked = clicked;
            await sleep(3500);
          }
          try { fs.writeFileSync(`${DATA}/probe-all3.json`, JSON.stringify(out, null, 1)); log('🔬 ساختار صفحه‌بندی ذخیره شد'); } catch {}
        }
      } catch (e) { log('🔬 خطا probe-all3:', String((e && e.message) || e).slice(0, 80)); }
      /* 🌐 کاوش مرورگری مستقل (فایل‌محور): /search/all/ با رندر JS — نتیجه در data/probe-all.json */
      try {
        if (!fs.existsSync(`${DATA}/probe-all.json`)) {
          const out = { at: new Date().toISOString(), tests: [] };
          for (const [nm, u] of [['ALL-1', `${BASE}/search/all/`], ['ALL-2', `${BASE}/search/all/?page=2`], ['ALL-50', `${BASE}/search/all/?page=50`]]) {
            let c = 0, pc = 0, txt = '';
            try {
              await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45_000 });
              await sleep(10000);
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
              await sleep(4000);
              const h = await page.content();
              c = new Set([...h.matchAll(/\/company\/(\d+)/g)].map((m) => m[1])).size;
              pc = new Set([...h.matchAll(/\/person\/([0-9A-Fa-f]+)/g)].map((m) => m[1])).size;
              try { txt = (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 800))); } catch {}
            } catch (e) { txt = 'ERR ' + String((e && e.message) || e).slice(0, 100); }
            out.tests.push({ nm, url: u, companies: c, persons: pc, text: txt });
            log('🌐 [ALL] ' + nm + ' → ' + c + ' شرکت · ' + pc + ' شخص');
          }
          try { fs.writeFileSync(`${DATA}/probe-all.json`, JSON.stringify(out, null, 1)); log('🌐 نتیجهٔ کاوش در data/probe-all.json ذخیره شد'); } catch {}
        }
      } catch (e) { log('🌐 خطای کاوش ALL:', String((e && e.message) || e).slice(0, 80)); }
      /* 🔗 کشف پارامتر صفحه‌بندی /search/all با کلیک روی «بعدی» */
      try {
        if (!fs.existsSync(`${DATA}/probe-all2.json`)) {
          const out = { at: new Date().toISOString() };
          const ids = async () => {
            const h = await page.content();
            return [...new Set([...h.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]))];
          };
          await page.goto(`${BASE}/search/all/`, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
          await sleep(9000);
          out.url1 = page.url();
          out.ids1 = (await ids()).slice(0, 5);
          out.count1 = (await ids()).length;
          /* پیدا کردن دکمهٔ بعدی */
          out.nextInfo = await page.evaluate(() => {
            const cands = [...document.querySelectorAll('a,button')].filter((el) => /بعدی|next|›|»|chevron/i.test((el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.className || '')));
            return cands.slice(0, 6).map((el) => ({ tag: el.tagName, text: (el.innerText || '').trim().slice(0, 20), href: el.getAttribute('href') || '', cls: String(el.className).slice(0, 60) }));
          }).catch(() => []);
          /* کلیک روی بعدی */
          try {
            const clicked = await page.evaluate(() => {
              const el = [...document.querySelectorAll('a,button')].find((e) => /بعدی|next/i.test(((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || ''))));
              if (el) { el.click(); return true; } return false;
            });
            out.clicked = clicked;
            await sleep(6000);
            out.url2 = page.url();
            out.count2 = (await ids()).length;
            out.ids2 = (await ids()).slice(0, 5);
            out.same = JSON.stringify(out.ids1) === JSON.stringify(out.ids2);
          } catch (e) { out.clickErr = String((e && e.message) || e).slice(0, 100); }
          /* تست پارامترهای جایگزین در URL */
          out.alt = {};
          for (const q of ['?p=2', '?page=2', '?offset=61', '?from=61', '?skip=61', '?pageNumber=2']) {
            try {
              await page.goto(`${BASE}/search/all/${q}`, { waitUntil: 'domcontentloaded', timeout: 40_000 });
              await sleep(7000);
              const u = await ids();
              out.alt[q] = { count: u.length, first: u[0] || null };
            } catch { out.alt[q] = { err: 1 }; }
          }
          try { fs.writeFileSync(`${DATA}/probe-all2.json`, JSON.stringify(out, null, 1)); log('🔗 نتیجهٔ صفحه‌بندی ALL ذخیره شد'); } catch {}
        }
      } catch (e) { log('🔗 خطای probe-all2:', String((e && e.message) || e).slice(0, 80)); }
      /* کاوش یک‌باره: کدام فیلتر/عمق جواب می‌دهد؟ (نتایج در لاگ، تصمیم بعدی) */
      if (!Dp.probeDone || Dp.probeV !== 5) {
        Dp.probeDone = true; Dp.probeV = 5; Dp.probeResults = {};
        /* 🌐 کاوش با مرورگر واقعی: شاید /search/all/ فقط با JS رندر شرکت‌ها را بدهد */
        try {
          for (const [nm, u] of [['ALL-مرورگر-۱', `${BASE}/search/all/`], ['ALL-مرورگر-۲', `${BASE}/search/all/?page=2`], ['ALL-مرورگر-۵۰', `${BASE}/search/all/?page=50`]]) {
            let c = 0, pc = 0;
            try {
              await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45_000 });
              await sleep(9000);
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
              await sleep(3000);
              const h = await page.content();
              c = new Set([...h.matchAll(/\/company\/(\d+)/g)].map((m) => m[1])).size;
              pc = new Set([...h.matchAll(/\/person\/([0-9A-Fa-f]+)/g)].map((m) => m[1])).size;
              try { Dp.browserText = (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600))); } catch {}
            } catch (e) { log('🌐 خطای مرورگر', nm, String((e && e.message) || e).slice(0, 60)); }
            log('🌐 کاوش مرورگر [' + nm + '] → ' + c + ' شرکت · ' + pc + ' شخص');
            Dp.probeResults[nm] = { companies: c, persons: pc };
            saveFrontier();
          }
        } catch (e) { log('🌐 خطای کاوش مرورگر:', String((e && e.message) || e).slice(0, 80)); }
        const probes = [
          ['ALL-صفحه۱', `${BASE}/search/all/`],
          ['ALL-صفحه۲', `${BASE}/search/all/?page=2`],
          ['ALL-صفحه۵۰', `${BASE}/search/all/?page=50`],
          ['ALL-صفحه۵۰۰', `${BASE}/search/all/?page=500`],
          ['محصولات-شرکت', `${BASE}/search/products/?q=${encodeURIComponent('شرکت')}`],
          ['برندها-شرکت', `${BASE}/search/brands/?q=${encodeURIComponent('شرکت')}`],
          ['اشخاص-شرکت', `${BASE}/search/persons/?q=${encodeURIComponent('شرکت')}`],
          ['اختراع-شرکت', `${BASE}/search/patents/?q=${encodeURIComponent('شرکت')}`],
          ['محصولات-نفت', `${BASE}/search/products/?q=${encodeURIComponent('نفت')}`],
          ['برندها-پارس', `${BASE}/search/brands/?q=${encodeURIComponent('پارس')}`],
        ];
        for (const [nm, u] of probes) {
          let cnt = 0, fresh = 0, pidcn = 0;
          try {
            const rr = await fetch(u, { cache: 'no-store' });
            if (rr.ok) {
              const hh = await rr.text();
              const ids = new Set([...hh.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]));
              cnt = ids.size;
              for (const id of ids) if (!frontier.visited['company:' + id]) fresh++;
              /* ذخیرهٔ شناسه‌های تازه از ALL برای صف */
              if (nm.startsWith('ALL-') && ids.size) { Dp.allIds = Dp.allIds || {}; for (const id of ids) Dp.allIds[id] = 1; }
              pidcn = new Set([...hh.matchAll(/\/person\/([0-9A-Fa-f]+)/g)].map((m) => m[1])).size;
            }
          } catch {}
          log('🔎 کاوش کشف [' + nm + '] → ' + cnt + ' شرکت (' + fresh + ' تازه) · ' + pidcn + ' شخص');
          try { Dp.probeResults[nm] = { companies: cnt, fresh, persons: pidcn }; saveFrontier(); } catch {}
          await sleep(1500);
        }
      }
      /* اسکن عمیق واقعی: هر صفحه ۷..۸۰ برای هر عبارت */
      const dTimeUp2 = () => (Date.now() - dT0) > 300_000;
      while (added < maxNew && Dp.termIdx < SEARCH_TERMS.length && !dTimeUp2()) {
        const term = SEARCH_TERMS[Dp.termIdx];
        let html = '';
        try {
          const r = await fetch(mkUrl(term, Dp.page), { cache: 'no-store' });
          if (!r || !r.ok) { Dp.termIdx++; Dp.page = 7; continue; }
          html = await r.text();
        } catch { Dp.termIdx++; Dp.page = 7; continue; }
        const ids = new Set([...html.matchAll(/\/company\/(\d+)/g)].map((m) => m[1]));
        let found = 0;
        for (const id of ids) {
          const k = `company:${id}`;
          if (frontier.visited[k] || frontier.pending.some((x) => x.type === 'company' && x.id === id)) continue;
          frontier.pending.push({ type: 'company', id }); found++; added++;
          if (added >= maxNew) break;
        }
        if (ids.size > 0) log('🔎 عمیق: «' + term + '» ص ' + Dp.page + ' → ' + ids.size + ' شرکت، ' + found + ' تازه (کشف این اجرا: ' + added + ')');
        saveFrontier();
        if (ids.size === 0 || (found === 0 && Dp.page >= 9)) { Dp.termIdx++; Dp.page = 7; }
        else { Dp.page++; if (Dp.page > 80) { Dp.termIdx++; Dp.page = 7; } }
        await sleep(1200);
      }
      if (added) log('🔎 اسکن عمیق: ' + added + ' شرکت تازه — ادامه در اجرای بعدی (عبارت ' + (Dp.termIdx + 1) + '/' + SEARCH_TERMS.length + ' ص ' + Dp.page + ')');
    } catch (e) { log('🔎 خطای اسکن عمیق:', String((e && e.message) || e).slice(0, 100)); }
  }
  return added;
}

/* ═══ توکن اعتبارنامهٔ checkout — برای قفل انحصار و زنجیره ═══ */
let __tokCache = null;
function selfToken() {
  if (__tokCache !== null) return __tokCache;
  let tok = '';
  try {
    const gitDir = execSync('git rev-parse --git-dir', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 }).toString().trim();
    const cfg = fs.readFileSync(`${gitDir}/config`, 'utf8');
    const m = cfg.match(/basic\s+([A-Za-z0-9+/=]{20,})/i);
    if (m) tok = Buffer.from(m[1], 'base64').toString('utf8').split(':').pop();
  } catch {}
  if (!tok) {
    try {
      const hdr = execSync('git config --get-all http.https://github.com/.extraheader', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 }).toString().trim();
      const m2 = hdr.match(/basic\s+([A-Za-z0-9+/=]{20,})/i);
      if (m2) tok = Buffer.from(m2[1], 'base64').toString('utf8').split(':').pop();
    } catch {}
  }
  __tokCache = tok || '';
  return __tokCache;
}

/* ═══ زنجیرهٔ پیوسته: اجرای بعدی فوراً dispatch می‌گردد — فقط وقتی اجرای دیگری در صف نیست ═══ */
async function selfChain() {
  return; /* capture.mjs is the only successor scheduler */
  try {
    const tok = selfToken();
    dbg('self-chain', { hasToken: !!tok, tokLen: tok.length });
    if (!tok) { log('زنجیره: توکنی برای dispatch پیدا نشد'); return; }
    const MY_RUN = String(process.env.GITHUB_RUN_ID || '');
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=30`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      await sleep(3000 + Math.random() * 12000); /* جیتر: جلوگیری از طوفان dispatch همزمان */
      const r2 = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=50`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      if (r2.ok) {
        const active = ((await r2.json()).workflow_runs || []).filter((x) => String(x.id) !== MY_RUN && !isRegisteredDiagnosticRun(x.id) && x.status === 'in_progress');
        const need = MAX_PARALLEL - active.length;
        if (need <= 0) { log('⚡ ظرفیت پر است (' + active.length + '/' + MAX_PARALLEL + ') — dispatch لازم نیست'); return; }
        log('⚡ ظرفیت: ' + active.length + '/' + MAX_PARALLEL + ' → یک کارگر تازه');
        await fetch(`https://api.github.com/repos/${REPO}/dispatches`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ event_type: 'rasmio-run' }) });
        return;
      }
    } catch {}
    const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ event_type: 'rasmio-run' }) });
    dbg('self-chain-status', { status: r.status });
    log(r.ok ? '⛓ زنجیره: اجرای بعدی همین حالا درخواست شد — خزش پیوسته ادامه دارد' : 'زنجیره پاسخ ' + r.status + ' داد (پشتیبان: زمان‌بندی شبانه)');
  } catch (e) { dbg('self-chain-error', String(e).slice(0, 250)); }
}

let browser = null, page = null;
let publicProxyTransport=null;
const proxyPages=new WeakMap();
const PUBLIC_PROXY_DETAILS=process.env.RASMIO_PROXY_TRANSPORT !== 'off';
let WORKERS = []; /* تب‌های همزمان برای موتور موجی */
let AUTHED = false; /* وقتی true: داده‌های ویژهٔ واردشده (ابزار شبکهٔ ارتباطات و…) هم برداشته می‌شود */
/* مخزن هویت‌های ناشناس — هر اجرا و هر چرخش، یک UA واقعی متفاوت */
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];
const pickUA = () => UA_POOL[(Math.random() * UA_POOL.length) | 0];
let UA_NORM = pickUA();
/* چرخش هویت ناشناس: کوکی/استوریج پاک + UA تازه — هر ۲۵ موجودیت یک‌بار */
async function rotateIdentity() {
  if (AUTHED) return;
  try {
    UA_NORM = pickUA();
    for (const pg of (WORKERS.length ? WORKERS : [page])) {
      try { await pg.setUserAgent(pickUA()); } catch {}
      try { const cks = await pg.cookies(); if (cks.length) await pg.deleteCookie(...cks); } catch {}
      try { await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} }); } catch {}
    }
    log('🎭 چرخش هویت ناشناس — UA/کوکی تازه برای همهٔ تب‌ها');
  } catch {}
}

/* «خطای تعداد دستگاه» — در هر مرحلهٔ ورود (پیش از شماره، پس از پیامک، پس از کد) */
const clearDeviceModal = async (stage) => {
  for (let round = 0; round < 3; round++) {
    const hasModal = await page.evaluate(() => /خطای تعداد دستگاه|حذف همه دستگاه/.test(document.body.innerText || ''));
    if (!hasModal) return;
    progress('device-limit', { stage, round });
    const act = await page.evaluate(() => {
      /* اول «حذف همه دستگاه» — قطعی و بدون ابهام؛ دستگاه‌های قدیمی ربات همه معیوب‌اند */
      const all = [...document.querySelectorAll('button, a')].find((b) => /حذف همه دستگاه/.test(b.textContent || ''));
      if (all) { all.click(); return 'deleted-all'; }
      const btns = [...document.querySelectorAll('button, a')].filter((b) => /حذف دستگاه/.test(b.textContent || ''));
      if (btns.length) { btns[0].click(); return 'deleted-device'; }
      return null;
    });
    dbg('device-limit', { stage, round, act });
    log('محدودیت دستگاه (' + stage + ') — آزادسازی:', act);
    await sleep(6000);
    await page.screenshot({ path: `${SHOTS}/05-device-limit-${stage}-${round}.png`, fullPage: true });
    await page.evaluate(() => { const c = [...document.querySelectorAll('button')].filter((b) => !b.disabled).find((b) => /^(تأیید|تایید|بله|حذف|انجام)/.test((b.textContent || '').trim())); if (c) c.click(); });
    await sleep(9000);
  }
};

/* ─── استخراج ساختاری یک صفحهٔ شرکت/شخص (جدول‌های MUI) ─── */
async function parsePageTables(pg = page) { return pg.evaluate(extractTablesFromDOM); }

async function extractEntity(ent, pg = page) {
  const route=proxyPages.get(pg);
  if(PUBLIC_PROXY_DETAILS && ['company','person'].includes(ent.type) && !route)throw new Error('proxy-required-no-direct-fallback');
  /* 🆕 آدرسِ هر نوع موجودیت — محصول/برند/اختراع هم خزش می‌شوند (درخواست ۲۴ مهر) */
  const URL_OF = {
    company: (id) => `${BASE}/company/${id}/direct/`, // Public canonical route validated by the free-proxy experiment; avoids the 308 chain.
    person: (id) => `${BASE}/person/${id}/x/`,
    product: (id) => `${BASE}/product/${id}/`,
    brand: (id) => `${BASE}/brand/${id}/`,
    patent: (id) => `${BASE}/patent/${id}/`,
    invention: (id) => `${BASE}/patent/${id}/`,
  };
  const url = (URL_OF[ent.type] || URL_OF.company)(ent.id);
  /* ═══ مسیر سریع: HTML سرور (SSR) — حالت تطبیقی (کوکی/بی‌نام) ═══ */
  let parsed = null, via = 'fetch', html = '';
  const tryFetchParse = async (withCookie) => {
    const headers = { 'user-agent': UA_NORM, 'accept-language': 'fa,en' };
    if (withCookie) {
      const ck = (await pg.cookies(BASE)).map((c) => `${c.name}=${c.value}`).join('; ');
      if (ck) headers.cookie = ck;
    }
    const r = route ? await route.fetch(url) : await fetch(url, { headers, redirect: 'follow', cache: 'no-store' });
    if (!r.ok) { const err = new Error('HTTP ' + r.status); err.retryable = true; throw err; }
    const h = await r.text();
    if (/سقف\s*مجاز|امکان مشاهده اطلاعات در صفحه شرکت برای شما محدود شده/.test(h)) {
      const err = new Error('explicit-access-limit'); err.retryable = true; throw err;
    }
    /* 🚧 سقفِ سایت: «سقف مجاز ۵ درخواست شما برای ۴ روز تکمیل شده است» — یعنی این IP دیگر صفحهٔ شرکت نمی‌گیرد.
       به‌جای تلف‌کردن وقت، بقیهٔ این اجرا صرفِ محصول/شخص/برند (بی‌سقف) می‌شود و شرکت‌ها برای IP تازه می‌مانند. */
    if (ent.type === 'company' && !route) {
      const tb0 = (h.match(/<table/gi) || []).length;
      globalThis.__rasmioZeroCo = tb0 === 0 ? (globalThis.__rasmioZeroCo || 0) + 1 : 0;
      if (globalThis.__rasmioZeroCo >= 3 && !globalThis.__rasmioWall) { globalThis.__rasmioWall = true; log('🚧 سقف شرکت‌های این IP پر شد (۳ شرکت پیاپی بی‌جدول) — بقیهٔ وقت صرفِ محصول/شخص می‌شود · اجرای بعدی؛ IP تازه تضمین نشده'); }
    }
    /* 🔎 ردیابی ۲۵ مهر: چرا شرکت‌ها ۰ ردیف می‌دهند؟ وضعیت و طول و تعداد جدولِ خام ثبت می‌شود */
    if (ent.type === 'company') {
      try {
        const tb = (h.match(/<table/gi) || []).length;
        const line = '🔎 company-fetch ' + ent.id + (withCookie ? ' [cookie]' : ' [anon]') +
            ' status=' + r.status + ' len=' + h.length + ' tables=' + tb +
            ' board=' + /هیئت\s*مدیره/.test(h) + ' wall=' + /ورود|ثبت\s*نام/.test(h);
        log(line);
        /* ✍️ فایلِ جداگانهٔ هر اجرا — چون run.log در جنگِ pushِ اجراهای همزمان گم می‌شود */
        try { fs.appendFileSync(`${OUT}/probe-${String(process.env.GITHUB_RUN_ID || 'local')}.log`, new Date().toISOString() + ' ' + line + '\n'); } catch {}
      } catch {}
    }
    await pg.setContent(h, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await sleep(400);
    return { html: h, parsed: await parsePageTables(pg) };
  };
  try {
    if (ent.type === 'person' && !frontier.personProbed) {
      frontier.personProbed = true;
      try { dbg('person-raw', { id: ent.id, rawTitle: ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').slice(0, 80), hasRelatedTable: html.includes('شرکت‌های مرتبط') || html.includes('شرکت های مرتبط'), nextF: (html.match(/self\.__next_f/g) || []).length, rawLen: html.length }); } catch {}
    }
    /* صفحهٔ شخص جدول‌هایش را با JS می‌سازد (آزمایش شد: fetch پوستهٔ خالی با عنوان سالم می‌دهد) → مستقیم مرورگر */
    /* 🎯 کشفِ بزرگ ۲۵ مهر: درخواستِ «بدون کوکی» ۱۰۰٪ جواب می‌دهد (میانگین ۱۳.۵ ردیف)
       و درخواستِ «با کوکی» فقط ۰.۲٪ (کوکیِ مانده ⇒ سایت نسخهٔ بی‌جدول می‌فرستد).
       پس همیشه اول بی‌نام امتحان می‌شود — برای همهٔ نوع‌ها، حتی اشخاص. */
    const order = [false]; /* فقط دریافت عمومی، بدون کوکی حساب */
    for (const wc of order) {
      const res = await tryFetchParse(wc);
      if (!res) continue;
      if (res.parsed.rows.length > 0) { html = res.html; parsed = res.parsed; via = wc ? 'fetch' : 'fetch-anon'; frontier.crawlMode = wc ? 'session' : 'anon'; break; }
      if (!html) { html = res.html; parsed = res.parsed; } /* نگه‌داشتن برای مسیر مرورگر */
    }
  } catch (e) { if (e.retryable) throw e; dbg('fetch-extract-error', { id: ent.id, e: String(e).slice(0, 120) }); }
  /* ═══ مسیر کامل مرورگر: فقط اگر لازم باشد — fetchِ سالمِ بی‌جدول یعنی صفحه واقعاً داده ندارد (SSR کامل است) و مرورگر فقط وقت می‌سوزاند ═══ */
  const fetchCleanEmpty = ent.type !== 'person' && parsed && via === 'fetch' && parsed.rows.length === 0 && parsed.tables && parsed.tables.length === 0
    && parsed.title && !/undefined/i.test(parsed.title);
  if ((!parsed || parsed.rows.length === 0) && !fetchCleanEmpty) {
    via = 'browser';
    if (ent.type === 'person' && !route) { try { await pg.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 }); await sleep(1500); } catch {} } /* گرم‌کردن کوکی */
    try { await pg.goto(route?.finalURL || url, { waitUntil: 'domcontentloaded', timeout: 30_000 }); } catch {}
    await sleep(2500);
    /* اسکرول تدریجی برای فعال‌سازی رندر تنبل جدول‌ها */
    try {
      await pg.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y <= h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } });
      await sleep(2500);
    } catch {}
    for (let i = 0; i < 3; i++) {
      const more = await pg.evaluate(() => {
        const b = [...document.querySelectorAll('button, a')].filter((x) => /مشاهده\s*سایر\s*موارد/.test(x.textContent || '') && (x.offsetWidth || x.offsetHeight));
        if (!b.length) return 0; b[0].click(); return b.length;
      });
      if (!more) break;
      await sleep(1800);
    }
    let parsed0 = await parsePageTables(pg);
    /* شانس دوم: ریلود — خطای استریم گاهی فقط بار اول رخ می‌دهد */
    if (parsed0.rows.length === 0) {
      try { await pg.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }); await sleep(6000); } catch {}
      const parsed1 = await parsePageTables(pg);
      if (parsed1.rows.length > parsed0.rows.length) parsed0 = parsed1;
    }
    parsed = parsed0;
    if (parsed.rows.length === 0) {
      try {
        dbg('zero-rows', { id: ent.id, type: ent.type, via, url: pg.url().slice(0, 120), title: parsed.title.slice(0, 80), tables: await pg.evaluate(() => document.querySelectorAll('table').length), textLen: await pg.evaluate(() => (document.body.innerText || '').length), rawCompanyLinks: (html.match(/\/company\/\d+/g) || []).length, headings: await pg.evaluate(() => [...document.querySelectorAll('h2, h3')].map((h) => (h.innerText || '').trim()).filter(Boolean).slice(0, 15)) });
      } catch (e) { dbg('zero-rows', { id: ent.id, type: ent.type, err: String(e).slice(0, 120) }); }
    }
  }
  /* اطلاعات پایهٔ شرکت — کامل بودن داده (تاسیس، سرمایه، ثبت، نشانی…) */
  let info = null;
  try {
    const text = await pg.evaluate(() => (document.body.innerText || ''));
    const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    info = {};
    const labels = ['تاریخ تاسیس','تاریخ تأسیس','وضعیت شرکت','نوع شرکت','شماره ثبت','کد اقتصادی','شناسه ملی','سرمایه ثبتی','آخرین آگهی روزنامه رسمی','کد پستی','کد ملی','شهر محل صدور'];
    for (const lb of labels) {
      const idx = lines.findIndex((l) => l === lb || l.startsWith(lb + ' '));
      if (idx < 0) continue;
      const same = (lines[idx] === lb) ? '' : lines[idx].slice(lb.length).trim();
      const val = same || (lines[idx + 1] && !labels.includes(lines[idx + 1]) ? lines[idx + 1] : '');
      if (val) { const key = lb.includes('تاسیس') || lb.includes('تأسیس') ? 'تاریخ تاسیس' : lb; info[key] = val; }
    }
    const ai = lines.findIndex((l) => /نشانی ثبتی/.test(l));
    if (ai >= 0) {
      /* نشانی واقعی: اولین خطِ بلندِ بعد از برچسب (برچسب خودش «نشانی ثبتی شرکت» است) */
      const val = lines.slice(ai + 1, ai + 6).find((l) => l.length > 25) || lines[ai + 1] || '';
      if (val) info['نشانی'] = val;
    }
    if (!Object.keys(info).length) info = null;
  } catch {}
  // An empty detail response is incomplete, not a successful visit.
  if (!parsed.rows.length && !(parsed.tables || []).some(t => (t.rows || []).length)) {
    const err = new Error('empty-detail-response'); err.retryable = true; throw err;
  }
  if(route && /undefined|صفحه یافت نشد/i.test(parsed.title||''))throw new Error('profile-identity-unverified');
  if(route && ent.type==='company') {
    const actualId=String(info?.['شناسه ملی']||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).match(/\d{11}/)?.[0];
    if(actualId!==String(ent.id))throw new Error('company-identity-unverified');
  }
  const egress=route?{proxy:route.proxy,observedExitIP:route.observedExitIP,mainRequests:route.mainRequests,scope:'Echo-observed IP; destination egress is unverified',directFallback:false}:null;
  if(route)via=via==='browser'?'proxy-browser':'proxy-fetch';
  let moreControls=null;
  try {moreControls=await pg.evaluate(()=>[...document.querySelectorAll('button,a')].filter(e=>/مشاهده\s*(سایر|بیشتر|همه)|نمایش\s*بیشتر/.test(e.textContent||'')).length);}catch{}
  const profileCoverage={status:'unverified',access:'anonymous-public',paginationVerified:false,moreControls,infoKeys:Object.keys(info||{}),sections:(parsed.tables||[]).length,twentyRowTables:(parsed.tables||[]).filter(t=>t.rows.length===20).length};
  /* نام: h1 → تگ title → شناسه */
  let name = parsed.title.replace(/\s*-\s*رسمــیو.*$/, '').trim();
  if (!name || /^\d+$/.test(name)) {
    const mt = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    name = (mt.replace(/^🏢\s*/, '').replace(/\s*-\s*رسمــیو.*$/, '').trim()) || ent.name || ent.id;
  }
  /* ابزار «شبکه ارتباطات» — فقط با ورود فعال است؛ لینکش را از صفحه بردار */
  let graphTool = null;
  if (pg === page && AUTHED && ent.type === 'company') {
    try {
      graphTool = await pg.evaluate(() => {
        const el = [...document.querySelectorAll('a, button')].find((x) => /شبکه\s*ارتباطات/.test((x.textContent || '').trim()));
        if (!el) return null;
        return { tag: el.tagName, href: el.href || el.getAttribute('href') || null };
      });
      /* برای ۳ شرکت اولِ هر اجرا: خود ابزار را باز کن و ساختارش را ضبط کن */
      frontier.gtProbed = frontier.gtProbed || 0;
      if (graphTool && frontier.gtProbed < 3) {
        frontier.gtProbed++;
        try {
          await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await sleep(3500);
          const clicked = await pg.evaluate(() => { const el = [...document.querySelectorAll('a, button')].find((x) => /شبکه\s*ارتباطات/.test((x.textContent || '').trim())); if (!el) return false; el.click(); return true; });
          await sleep(9000);
          const dump = await pg.evaluate(() => {
            const scripts = [...document.querySelectorAll('script')].map((sc) => sc.textContent || '').filter((t) => t.length > 3000);
            return { url: location.href, textLen: (document.body.innerText || '').length, text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1500), bigScripts: scripts.length, scriptSample: (scripts[0] || '').slice(0, 400) };
          });
          dbg('graphtool-' + frontier.gtProbed, { id: ent.id, clicked, ...dump });
          await pg.screenshot({ path: `${SHOTS}/graphtool-${frontier.gtProbed}.png`, fullPage: true });
          log('🕸 ابزار شبکهٔ ارتباطات ضبط شد (' + frontier.gtProbed + '/3):', dump.url.slice(0, 80));
        } catch (e) { dbg('graphtool-error', String(e).slice(0, 150)); }
      }
    } catch {}
  }
  /* ذخیرهٔ موجودیت */
  const node = { type: ent.type, id: ent.id, name, url, ...(graphTool && graphTool.href ? { graphTool: graphTool.href } : {}) };
  frontier.graph.nodes[keyOf(ent)] = { ...(frontier.graph.nodes[keyOf(ent)] || {}), ...node };
  const edges = [];
  for (const r of parsed.rows) {
    const target = normId(r.href);
    if (!target) continue;
    const tName = r.name || (r.cells[0] || '').trim();
    frontier.graph.nodes[keyOf(target)] ??= { type: target.type, id: target.id, name: tName, url: new URL(r.href, BASE).href };
    const role = r.header.includes('سمت') ? (r.cells.find((c) => /مدیر|بازرس|عضو|نماینده|رئیس|حق امضا|مدیرعامل/.test(c)) || r.cells[1] || '') : (r.header.split('|')[0] || '').trim();
    edges.push({ from: keyOf(ent), to: keyOf(target), kind: r.header, role, cells: r.cells });
    enqueue({ type: target.type, id: target.id, name: tName }, keyOf(ent));
  }
  frontier.graph.edges.push(...edges.filter((e) => !frontier.graph.edges.some((x) => x.from === e.from && x.to === e.to && x.kind === e.kind && x.role === e.role)));
  /* Never overwrite previously extracted detail with an empty/limited response. */
  try {
    const entityFile = `${DATA}/entities/${ent.type}-${ent.id}.json`;
    let previous = null;
    try { previous = JSON.parse(fs.readFileSync(entityFile, 'utf8')); } catch {}
    const previousRows = (previous?.rows || []).length;
    const previousTables = (previous?.tables || []).length;
    const previousTableRows=(previous?.tables||[]).reduce((n,t)=>n+(t.rows||[]).length,0);
    const incomingTableRows=(parsed.tables||[]).reduce((n,t)=>n+(t.rows||[]).length,0);
    if(previousRows>parsed.rows.length || previousTables>(parsed.tables||[]).length || previousTableRows>incomingTableRows || Object.keys(previous?.info||{}).some(k=>!Object.hasOwn(info||{},k)))throw new Error('richer-existing-detail-preserved');
    const empty = parsed.rows.length === 0 && !(parsed.tables || []).length;
    if (!(empty && (previousRows || previousTables))) {
      fs.writeFileSync(entityFile, JSON.stringify({ ...node, tableSchemaVersion: 2, via, ...(egress?{egress}:{}), profileCoverage, fetchedAt: new Date().toISOString(), sourceRun: process.env.GITHUB_RUN_ID || 'local', ...(info ? { info } : {}), rows: parsed.rows, ...(parsed.tables && parsed.tables.length ? { tables: parsed.tables } : {}) }, null, 1));
    } else log('دادهٔ قبلی حفظ شد — پاسخ جدید خالی بود:', keyOf(ent));
  } catch (e) {throw e;}
  const tableRows = (parsed.tables || []).reduce((n, t) => n + (t.rows || []).length, 0);
  if (parsed.rows.length || tableRows) {
    const storedText = fs.readFileSync(`${DATA}/entities/${ent.type}-${ent.id}.json`, 'utf8');
    const stored = JSON.parse(storedText);
    if (stored.sourceRun !== (process.env.GITHUB_RUN_ID || 'local')) throw new Error('Entity persistence verification failed');
    const receipt = { at: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID || 'local', key: keyOf(ent),
      rows: parsed.rows.length, tableRows, tables: (parsed.tables || []).length, via, sha256: crypto.createHash('sha256').update(storedText).digest('hex'),
      file: `${DATA}/entities/${ent.type}-${ent.id}.json`, ...(egress?{egress}:{}), coverageStatus:'unverified' };
    fs.appendFileSync(`${OUT}/verified-data-${process.env.GITHUB_RUN_ID || 'local'}.jsonl`, JSON.stringify(receipt) + '\n');
    log('VERIFIED-DATA', receipt);
  }
  const dead = ent.type === 'person' && /undefined/i.test((parsed && parsed.title) || '');
  return { node, rows: parsed.rows.length, tableRows, newEdges: edges.length, dead };
}

async function extractRoutedEntity(ent, defaultPage) {
  if(!PUBLIC_PROXY_DETAILS || !['company','person'].includes(ent.type))return extractEntity(ent,defaultPage);
  if(!publicProxyTransport)throw new Error('public-proxy-transport-not-ready');
  const route=await publicProxyTransport.acquire(ent);
  let context,pg,success=false,reason;
  try {
    context=await browser.createBrowserContext({proxyServer:route.proxy,proxyBypassList:['<-loopback>']});
    pg=await context.newPage();proxyPages.set(pg,route);
    await pg.setViewport({width:1440,height:900});await pg.setUserAgent(UA_NORM);
    await pg.setExtraHTTPHeaders({'accept-language':'fa,en;q=0.9'});
    await pg.setBypassServiceWorker(true);await pg.setRequestInterception(true);
    pg.on('request',request=>{
      try {
        const url=new URL(request.url());
        if(!permittedResourceURL(url.href) || ['image','media','font'].includes(request.resourceType())){if(!permittedResourceURL(url.href)&&!route.blockedHosts.includes(url.hostname)&&route.blockedHosts.length<20)route.blockedHosts.push(url.hostname);void request.abort().catch(()=>{});return;}
        if(request.isNavigationRequest() && request.frame()===pg.mainFrame()) {
          if(!permittedDetailURL(url.href,ent)){void request.abort().catch(()=>{});return;}
          route.reserve('browser-navigation',url.href);
        }
        void request.continue().catch(()=>{});
      }catch{void request.abort().catch(()=>{});}
    });
    const result=await extractEntity(ent,pg);success=result.rows>0 || result.tableRows>0;
    return result;
  } catch(e){reason=e.message||String(e);throw e;}
  finally {if(pg)proxyPages.delete(pg);if(context)await context.close().catch(()=>{});route.finish(success,reason);}
}
try {
  /* ═══ 🧭 کاوش سبک (بدون مرورگر): استخراج API واقعی جستجو از کدهای JS سایت ═══ */
  try {
    if (!fs.existsSync(`${DATA}/probe-api.json`) && !fs.existsSync(`${OUT}/probe-api.lock`)) {
      fs.writeFileSync(`${OUT}/probe-api.lock`, String(Date.now()));
      const P = { at: new Date().toISOString(), scripts: [], apiHints: {}, tests: [] };
      const get = async (u, opt) => { try { const r = await fetch(u, { cache: 'no-store', ...(opt || {}) }); return { s: r.status, ct: String(r.headers.get('content-type') || ''), t: await r.text() }; } catch (e) { return { s: 0, t: '', err: String(e).slice(0, 60) }; } };
      const home = await get(`${BASE}/search/all/`);
      P.pageLen = home.t;
      const srcs = [...new Set([...String(home.t).matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))].slice(0, 25);
      const hits = {};
      for (const src of srcs) {
        const u = src.startsWith('http') ? src : `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;
        const r = await get(u);
        const body = r.t || '';
        if (!body) continue;
        P.scripts.push({ u: u.slice(-60), len: body.length });
        for (const m of body.matchAll(/["'`](\/(?:api|backend|v1|v2)\/[a-zA-Z0-9_\-/\[\]{}.:]{2,60})["'`]/g)) {
          hits[m[1]] = (hits[m[1]] || 0) + 1;
        }
        for (const m of body.matchAll(/https?:\/\/[a-zA-Z0-9.\-]*rasmio[a-zA-Z0-9.\-/]*/g)) hits[m[0]] = (hits[m[0]] || 0) + 1;
      }
      const top = Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 60);
      P.apiHints = Object.fromEntries(top);
      /* تست نامزدهای محتمل جستجو */
      const cands = ['/api/search?q=&page=2', '/api/v1/search?q=&page=2', '/api/companies?page=2', '/api/v1/companies?page=2', '/api/search/companies?q=&page=2', '/api/v1/companies/search?q=&page=2'];
      for (const c of cands) {
        const r = await get(`${BASE}${c}`);
        const n = (String(r.t).match(/\/company\/\d+|"id":/g) || []).length;
        P.tests.push({ c, s: r.s, ct: r.ct, n, head: String(r.t).replace(/\s+/g, ' ').slice(0, 160) });
      }
      try { fs.writeFileSync(`${DATA}/probe-api.json`, JSON.stringify(P, null, 1)); } catch {}
      log('🧭 کاوش سبک تمام — اسکریپت:', P.scripts.length, '· نشانهٔ API:', top.length);
      try { fs.unlinkSync(`${OUT}/probe-api.lock`); } catch {}
    }
  } catch (e) { log('🧭 خطای کاوش سبک:', String((e && e.message) || e).slice(0, 90)); }
  /* ═══ 🧭 کاوش API واقعی جستجو (probe-api2) — کلید کشف همهٔ شرکت‌ها ═══ */
  try {
    if (!fs.existsSync(`${DATA}/probe-api2.json`)) {
      const H = { accept: 'application/json, text/plain, */*', 'accept-language': 'fa-IR,fa;q=0.9', referer: `${BASE}/search/all/`, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
      const J = async (u) => { try { const r = await fetch(u, { headers: H, cache: 'no-store' }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, len: t.length, j, head: t.slice(0, 200) }; } catch (e) { return { s: 0, head: String(e).slice(0, 80) }; } };
      const P = { at: new Date().toISOString(), tests: [], shape: null, counts: {} };
      const ids = (j) => { const t = JSON.stringify(j || ''); return [...new Set([...t.matchAll(/"?(?:companyId|id)"?\s*:\s*"?(\d{4,})"?/g)].map((m) => m[1]))].length; };
      const base = `${BASE}/api/search/search/all`;
      for (const q of ['?page=0&pageSize=60', '?page=1&pageSize=60', '?page=2&pageSize=60', '?page=163&pageSize=60', '?page=170&pageSize=60', '?page=500&pageSize=60', '?page=0&pageSize=1000', '?page=0&pageSize=200', '?page=2000&pageSize=200']) {
        const r = await J(base + q);
        const keys = r.j && typeof r.j === 'object' ? Object.keys(r.j).slice(0, 12) : null;
        const nIds = ids(r.j);
        P.tests.push({ url: base.replace(BASE, '') + q, s: r.s, len: r.len, keys, nIds, sample: String(r.head).replace(/\s+/g, ' ').slice(0, 150) });
        if (r.j && !P.shape) P.shape = JSON.stringify(r.j).slice(0, 2500);
      }
      /* انواع دیگر موجودیت */
      for (const kind of ['person', 'brand', 'product', 'patent', 'company']) {
        const r = await J(`${BASE}/api/search/search/${kind}?page=0&pageSize=10`);
        P.counts[kind] = { s: r.s, len: r.len, nIds: ids(r.j), head: String(r.head).replace(/\s+/g, ' ').slice(0, 120) };
      }
      try { fs.writeFileSync(`${DATA}/probe-api2.json`, JSON.stringify(P, null, 1)); } catch {}
      log('🧭 کاوش API جستجو تمام —', P.tests.length, 'تست');
    }
  } catch (e) { log('🧭 خطای کاوش API2:', String((e && e.message) || e).slice(0, 90)); }
  /* ═══ 🧭 کاوش کامل API (probe-api3): تعداد کل، اسکوپ‌ها، انواع ═══ */
  try {
    if (!fs.existsSync(`${DATA}/probe-api3.json`)) {
      const H = { accept: 'application/json, text/plain, */*', 'accept-language': 'fa-IR,fa;q=0.9', referer: `${BASE}/search/all/`, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
      const J = async (u) => { try { const r = await fetch(u, { headers: H, cache: 'no-store' }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, len: t.length, head: t.slice(0, 160) }; } catch (e) { return { s: 0, head: String(e).slice(0, 80) }; } };
      const P = { at: new Date().toISOString(), meta: {}, scopes: {}, params: {}, typeHist: {}, linkPrefix: {} };
      const r0 = await J(`${BASE}/api/search/search/all?page=0&pageSize=60`);
      if (r0.j) {
        P.meta = { totalCount: r0.j.totalCount, possiblePages: r0.j.possiblePages, page: r0.j.page, pageSize: r0.j.pageSize, hits: (r0.j.hits || []).length };
        for (const h of r0.j.hits || []) {
          P.typeHist[h.type] = (P.typeHist[h.type] || 0) + 1;
          const pre = String(h.link || '').split('/').filter(Boolean)[0] || 'none';
          P.linkPrefix[pre] = (P.linkPrefix[pre] || 0) + 1;
        }
        P.hitKeys = Object.keys((r0.j.hits || [])[0] || {});
      }
      for (const sc of ['all', 'companies', 'company', 'persons', 'person', 'people', 'brands', 'products', 'patents', 'inventions']) {
        const r = await J(`${BASE}/api/search/search/${sc}?page=0&pageSize=60`);
        P.scopes[sc] = { s: r.s, total: r.j && r.j.totalCount, pages: r.j && r.j.possiblePages, n: (r.j && r.j.hits || []).length, head: String(r.head).replace(/\s+/g, ' ').slice(0, 100) };
      }
      for (const [k, q] of Object.entries({ q: '&q=' + encodeURIComponent('پتروشیمی'), type1: '&type=1', types12: '&types=1,2', sortNew: '&sort=newest', noQ: '' })) {
        const r = await J(`${BASE}/api/search/search/all?page=0&pageSize=60${q}`);
        let types = {};
        for (const h of (r.j && r.j.hits) || []) types[h.type] = (types[h.type] || 0) + 1;
        P.params[k] = { s: r.s, total: r.j && r.j.totalCount, n: (r.j && r.j.hits || []).length, types };
      }
      try { fs.writeFileSync(`${DATA}/probe-api3.json`, JSON.stringify(P, null, 1)); } catch {}
      log('🧭 کاوش کامل API تمام — total:', P.meta.totalCount, 'صفحات:', P.meta.possiblePages);
    }
  } catch (e) { log('🧭 خطای کاوش API3:', String((e && e.message) || e).slice(0, 90)); }
  /* ═══ 🧭 کاوش ۴: مرز واقعی صفحه‌ها، اندازهٔ صفحه، کشف اشخاص ═══ */
  try {
    if (!fs.existsSync(`${DATA}/probe-api4.json`)) {
      const H = { accept: 'application/json, text/plain, */*', 'accept-language': 'fa-IR,fa;q=0.9', referer: `${BASE}/search/all/`, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
      const J = async (u) => { try { const r = await fetch(u, { headers: H, cache: 'no-store' }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, len: t.length }; } catch (e) { return { s: 0 }; } };
      const P = { at: new Date().toISOString(), limit: [], size: [], qdeep: [], types: [] };
      const nHits = (j) => (j && j.hits ? j.hits.length : -1);
      for (const pg of [160, 163, 164, 165, 166, 170, 200, 300, 1000]) {
        const r = await J(`${BASE}/api/search/search/all?page=${pg}&pageSize=60`);
        P.limit.push({ pg, s: r.s, n: nHits(r.j), total: r.j && r.j.totalCount, first: r.j && r.j.hits && r.j.hits[0] && r.j.hits[0].id });
      }
      for (const qs of ['pageSize=120', 'pageSize=61', 'size=200', 'limit=200', 'take=200', 'perPage=200', 'pageSize=60&page=0']) {
        const r = await J(`${BASE}/api/search/search/all?page=0&${qs}`);
        P.size.push({ qs, s: r.s, n: nHits(r.j), total: r.j && r.j.totalCount });
      }
      for (const pg of [0, 100, 200, 270, 272, 273, 300, 500, 1000]) {
        const r = await J(`${BASE}/api/search/search/all?page=${pg}&pageSize=60&q=${encodeURIComponent('پتروشیمی')}`);
        P.qdeep.push({ pg, s: r.s, n: nHits(r.j), total: r.j && r.j.totalCount, first: r.j && r.j.hits && r.j.hits[0] && r.j.hits[0].id });
      }
      for (const [label, q] of Object.entries({ personName: '&q=' + encodeURIComponent('اباذر نیکخواه'), tabPerson: '&types=1', tab2: '&types=0%2C1%2C2%2C3%2C4', st: '&searchType=1', scope: '&scope=person', ent: '&entityTypes=1' })) {
        const r = await J(`${BASE}/api/search/search/all?page=0&pageSize=60${q}`);
        const types = {};
        for (const h of (r.j && r.j.hits) || []) types[h.type] = (types[h.type] || 0) + 1;
        const pref = {};
        for (const h of (r.j && r.j.hits) || []) { const p2 = String(h.link || '').split('/').filter(Boolean)[0] || 'x'; pref[p2] = (pref[p2] || 0) + 1; }
        P.types.push({ label, s: r.s, n: nHits(r.j), total: r.j && r.j.totalCount, types, pref });
      }
      try { fs.writeFileSync(`${DATA}/probe-api4.json`, JSON.stringify(P, null, 1)); } catch {}
      log('🧭 کاوش ۴ تمام شد');
    }
  } catch (e) { log('🧭 خطای کاوش ۴:', String((e && e.message) || e).slice(0, 90)); }
  /* ═══ ۰) قفل انحصار — هیچ دو اجرایی همزمان نباشد (ریشهٔ گم‌شدن داده و شکست ورود) ═══ */
  const MY_RUN = String(process.env.GITHUB_RUN_ID || '');
  const ghApiRaw = async (path, method = 'GET') => fetch(`https://api.github.com${path}`, { method, headers: { authorization: `Bearer ${selfToken()}`, accept: 'application/vnd.github+json' } });
  if (selfToken() && process.env.RASMIO_VERIFY !== '1') {
    try {
      const r = await ghApiRaw(`/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=30`);
      const runs = r.ok ? ((await r.json()).workflow_runs || []) : [];
      /* فقط «در حال اجرا» — اجراهای در صف نباید ظرفیت را پر کنند (وگرنه هر کارگر تازه فوراً بیرون می‌رود) */
      /* فقط اجراهای واقعاً زنده حساب می‌شوند: اجرای گیرکرده/زامبی (بیش از ۲۲ دقیقه) ظرفیت را اشغال نکند */
      const FRESH_MS = 22 * 60_000;
      const others = runs.filter((x) => Date.parse(x.created_at || x.run_started_at) >= Date.parse('2026-10-26T05:00:00Z') && String(x.id) !== MY_RUN && !isRegisteredDiagnosticRun(x.id) && x.status === 'in_progress' && (!x.run_started_at || (Date.now() - new Date(x.run_started_at).getTime()) < FRESH_MS));
      /* ⚡ سقف اجرای همزمان: بیش از MAX_PARALLEL → خروج فوری (جلوگیری از انباشت و کار تکراری) */
      {
        const MINE_ID = Number(MY_RUN || '9'.repeat(15));
        const older = others.filter((o) => Number(o.id) < MINE_ID).length;
        if (others.length >= MAX_PARALLEL && older >= MAX_PARALLEL) {
          log('⚡ ظرفیت پر (' + others.length + ' فعالِ تازه، من دیرتر آمدم) — خروج فوری');
          process.exit(0);
        }
      }
      if (false) {
        if (others.some((o) => Number(o.id) < Number(MY_RUN || '0') || !MY_RUN)) {
          /* انتظار کوتاه (۳ دقیقه) — اگر رقیب هنوز فعال بود، بی‌صدا خارج می‌شویم؛ خودِ رقیب زنجیره را ادامه می‌دهد.
             پخشِ اجرای تکراری = صف انباشته و کندی (حادثهٔ ۱۹ مهر). */
          log('🔒 اجرای دیگری (' + others[0].id + ') فعال است — منتظر پایانش می‌مانم…');
          let waited = 0;
          while (waited < 180_000) {
            await sleep(30_000); waited += 30_000;
            try {
              const r2 = await ghApiRaw(`/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=30`);
              if (r2.ok) {
                const still = ((await r2.json()).workflow_runs || []).filter((x) => String(x.id) !== MY_RUN && (x.status === 'in_progress' || x.status === 'queued'));
                if (!still.length) { log('🔒 رقیب تمام شد — ادامهٔ کار'); break; }
              }
            } catch {}
          }
          try {
            const r3 = await ghApiRaw(`/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=30`);
            if (r3.ok) {
              const still = ((await r3.json()).workflow_runs || []).filter((x) => String(x.id) !== MY_RUN && (x.status === 'in_progress' || x.status === 'queued'));
              if (still.length) {
                /* رقیب زنده است و خودش زنجیره را ادامه می‌دهد — پخش تکراری ممنوع (انباشت صف) */
                log('🔒 رقیب فعال است — بدون پخش تکراری خارج می‌شوم (زنجیره دست اوست)');
                process.exit(0);
              }
            }
          } catch {}
        }
      }
    } catch (e) { dbg('lock-error', String(e).slice(0, 150)); }
  }
  if(PUBLIC_PROXY_DETAILS) {
    publicProxyTransport=await new PublicProxyTransport({frontier,out:OUT}).initialize();
    log('PUBLIC-PROXY-ENABLED', {types:['company','person'],candidates:publicProxyTransport.candidates.length,directFallback:false});
  }
  log('startup — راه‌اندازی مرورگر… | node', process.version);
  browser = await puppeteer.launch({ headless: 'new', ...(publicProxyTransport?{env:publicProxyTransport.env}:{}), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--window-size=1440,900'] });
  const newStealthPage = async () => {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1440, height: 900 });
    try { await pg.emulateTimezone('Asia/Tehran'); } catch {}
    try { await pg.setExtraHTTPHeaders({ 'accept-language': 'fa,en;q=0.9' }); } catch {}
    try { await pg.setUserAgent(UA_NORM); } catch {}
    try { await pg.setBypassServiceWorker(true); } catch {}
  /* پوشش شبح‌وار: حذف نشانه‌های خودکارسازی از نگاه صفحه (webdriver، plugins، WebGL، …) */
  await pg.evaluateOnNewDocument(() => {
    try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch {}
    try { Object.defineProperty(navigator, 'languages', { get: () => ['fa-IR', 'fa', 'en-US', 'en'] }); } catch {}
    try { Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5].map((i) => ({ name: 'Plugin ' + i, filename: 'plugin' + i + '.dll', description: '', length: 1 })) }); } catch {}
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); } catch {}
    try { Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); } catch {}
    try { window.chrome = window.chrome || { runtime: {}, loadTimes: () => ({}), csi: () => ({}) }; } catch {}
    try { const orig = navigator.permissions.query.bind(navigator.permissions); navigator.permissions.query = (p) => (p && p.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : orig(p)); } catch {}
    try { const GL = [['Intel Inc.', 'Intel Iris OpenGL Engine'], ['Google Inc. (Intel)', 'ANGLE (Intel, Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.5)'], ['Apple', 'Apple GPU']][(Math.random() * 3) | 0]; const gp = WebGLRenderingContext.prototype.getParameter; WebGLRenderingContext.prototype.getParameter = function (p) { if (p === 37445) return GL[0]; if (p === 37446) return GL[1]; return gp.call(this, p); }; } catch {}
  });
    return pg;
  };
  page = await newStealthPage();
  WORKERS = [page];
  for (let i = 1; i < 4; i++) WORKERS.push(await newStealthPage()); /* ۴ تب مستقل = موج ۴تایی بدون تداخل */
  page.on('pageerror', (e) => { try { fs.appendFileSync(`${OUT}/page-errors.log`, new Date().toISOString() + ' ' + String(e) + '\n'); } catch {} });
  log('repo:', REPO, '| branch:', BRANCH, '| phone:', PHONE ? mask(PHONE) : '—', '| session-key:', SESSION_KEY ? '✓' : '—');
  log('موتور استخراج: v8 موجی (۳ همزمان + ضدتشخیص چرخشی + تمرکز شرکت‌ها)');
  /* خزش عمومی بدون شماره تلفن و بدون ورود ادامه می‌یابد. */
  progress('start', { pending: frontier.pending.length, visited: Object.keys(frontier.visited).length });

  /* ═══ ۱) بازیابی نشست ═══ */
  let authed = false;
  if (false) { /* ورود ممنوع طبق درخواست کاربر: نشست ذخیره‌شده هم بازیابی نمی‌شود. */
    try {
      const sess = decryptBlob(JSON.parse(fs.readFileSync(`${OUT}/session.enc`, 'utf8')), SESSION_KEY);
      await page.setCookie(...(sess.cookies || []));
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (sess.ls) await page.evaluate((ls) => { for (const [k, v] of Object.entries(ls)) { try { localStorage.setItem(k, v); } catch {} } }, sess.ls);
      /* چک رفتاری: کاربرِ واردشده صفحهٔ ورود را نمی‌بیند (API خام بدون هدر 401 کاذب می‌دهد) */
      await page.goto(`${BASE}/login/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await sleep(4000);
      authed = !/login/i.test(page.url());
      dbg('session-restore', { authed, url: page.url() });
      log(authed ? '✅ نشست قبلی زنده است — بدون پیامک' : 'نشست قبلی مرده است → ورود با پیامک');
    } catch (e) { dbg('session-restore-error', String(e).slice(0, 200)); log('بازیابی نشست ناموفق:', String(e).slice(0, 120)); }
  }

  /* ═══ ۲) ورود — فقط با فرمان تازهٔ login.txt (≤۲۰ دقیقه) یا RASMIO_LOGIN=1؛ یک‌بار در عمر؛ شکست = ادامهٔ بی‌نام، هرگز فاتال ═══ */
  const loginFlag = fs.existsSync(`${OUT}/login.txt`) || process.env.RASMIO_LOGIN === '1';
  let flagFresh = process.env.RASMIO_LOGIN === '1';
  if (fs.existsSync(`${OUT}/login.txt`)) {
    try { const ts = Date.parse(fs.readFileSync(`${OUT}/login.txt`, 'utf8').trim()); flagFresh = Number.isFinite(ts) && Date.now() - ts < 20 * 60_000; } catch {}
  }
  try { fs.rmSync(`${OUT}/login.txt`, { force: true }); } catch {}
  /* اجرای دستی (دکمهٔ Run workflow) = تلاش ورود با پیامک؛ اجرای زنجیره/زمان‌بندی = همیشه بی‌نام */
  const manualLogin = process.env.RASMIO_LOGIN === '1' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  const loginUsed = fs.existsSync(`${OUT}/login-used`);
  const wantLogin = false; /* درخواست کاربر: هیچ ورود یا پیامکی انجام نشود. */
  if (!manualLogin && loginFlag && !flagFresh) log('پرچم ورود کهنه بود — نادیده گرفته شد');
  if (!manualLogin && loginFlag && loginUsed) log('ورود پیامکی قبلاً مصرف شده — بی‌نام ادامه می‌دهیم (برای ورود دوباره: Run دستی با تیک پیامک)');
  if (!authed && !wantLogin) {
    log('خزش بی‌نام ادامه می‌یابد — دادهٔ جدول‌ها عمومی است');
    frontier.crawlMode = 'anon';
  }
  if (!authed && wantLogin) {
    log('🎯 اجرای دستی — تلاش برای ورود با پیامک (۱۰ دقیقه فرصت)');
    const loginFail = (m) => { throw new Error('LOGIN|' + m); };
    try { fs.writeFileSync(`${OUT}/login-used`, new Date().toISOString()); } catch {}
    try {
      let usedOtp = null;
      for (let attempt = 1; attempt <= 2 && !authed; attempt++) {
        progress('login-page', { attempt });
        await page.goto(`${BASE}/login/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForSelector('input', { timeout: 45_000 });
        await sleep(3500);
        await clearDeviceModal('pre-phone');
        await page.screenshot({ path: `${SHOTS}/01-login.png`, fullPage: true });
        const okPhone = await page.evaluate((phone) => {
          const inp = [...document.querySelectorAll('input')].find((i) => /همراه|ایمیل|شماره/.test((i.placeholder || '') + (i.getAttribute('aria-label') || '')));
          if (!inp) return false;
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          set.call(inp, phone);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }, PHONE);
        if (!okPhone) {
          if (!/login/i.test(page.url())) { log('فیلد شماره نیست و صفحهٔ ورود نیست → از قبل وارد شده'); authed = true; break; }
          loginFail('فیلد شماره پیدا نشد');
        }
        await sleep(600);
        await page.evaluate((phone) => {
          const inp = [...document.querySelectorAll('input')].find((i) => /همراه|ایمیل|شماره/.test((i.placeholder || '') + (i.getAttribute('aria-label') || '')));
          if (inp && !((inp.value || '').replace(/\D/g, '').length >= 10)) {
            const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            set.call(inp, phone);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, PHONE);
        await sleep(400);
        const okBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /دریافت\s*کد/.test((x.textContent || '').trim())); if (!b) return false; b.click(); return true; });
        if (!okBtn) loginFail('دکمهٔ «دریافت کد ورود» پیدا نشد');
        await sleep(6000);
        await clearDeviceModal('post-phone');
        progress('sms-sent', { attempt });
        log(attempt > 1 ? 'تلاش ' + attempt + ' — پیامک تازه درخواست شد.' : '📱 پیامک درخواست شد — منتظر کد (۱۰ دقیقه)…');
        botPush('waiting-otp');

        /* کد: چک هر ۵ ثانیه — کد مصرف‌شده رد می‌شود */
        const otp = await waitForFile('otp.txt', 600, (t) => /^\d{4,8}$/.test(t) && t !== usedOtp);
        if (!otp) loginFail('کدی نرسید (۱۰ دقیقه)');
        usedOtp = otp;
        consumeRemoteFile('otp.txt', 'got-otp');
        log('کد دریافت شد:', mask(otp));
        await sleep(1500);
    const fillMode = await page.evaluate((code) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const fire = (el) => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const inputs = [...document.querySelectorAll('input')].filter(vis);
      const isPhone = (i) => /همراه|ایمیل|شماره/.test((i.placeholder || '') + (i.getAttribute('aria-label') || '')) || (i.value || '').replace(/\D/g, '').length >= 10;
      const single = inputs.find((i) => !isPhone(i) && /کد/.test((i.placeholder || '') + (i.getAttribute('aria-label') || '') + (i.name || '') + (i.id || '')));
      if (single) { set.call(single, code); fire(single); return 'single-labeled'; }
      const boxes = inputs.filter((i) => !isPhone(i) && String(i.maxLength) === '1');
      if (boxes.length >= 4 && boxes.length <= 8) { boxes.forEach((b, idx) => { if (code[idx] != null) { set.call(b, code[idx]); fire(b); } }); return 'boxes:' + boxes.length; }
      const empty = inputs.find((i) => !isPhone(i) && ['text', 'tel', 'number', 'password'].includes(i.type) && !(i.value || '').trim());
      if (empty) { set.call(empty, code); fire(empty); return 'first-empty'; }
      return null;
    }, otp);
    await sleep(500);
    const took = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.value || '').replace(/\D/g, '').length >= 4));
    if (!took) {
      const clicked = await page.evaluate(() => {
        const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const inputs = [...document.querySelectorAll('input')].filter(vis);
        const t = inputs.find((i) => /کد/.test((i.placeholder || '') + (i.getAttribute('aria-label') || ''))) || inputs.find((i) => ['text', 'tel', 'number'].includes(i.type) && !(i.value || '').length);
        if (!t) return false; t.focus(); t.click(); return true;
      });
      if (clicked) await page.keyboard.type(otp, { delay: 150 });
      dbg('otp-keyboard-fallback', { clicked, fillMode });
    }
    await sleep(800);
    const submitted = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((x) => !x.disabled);
      const b = btns.find((x) => /^(ورود|ثبت|تأیید|تایید|وارد|ادامه|ارسال|تکمیل)/.test((x.textContent || '').trim()))
            || btns.find((x) => x.getAttribute('type') === 'submit');
      if (b) { b.click(); return 'button:' + (b.textContent || '').trim().slice(0, 24); }
      const inp = [...document.querySelectorAll('input')].find((i) => (i.value || '').replace(/\D/g, '').length >= 4);
      const form = inp ? inp.closest('form') : document.querySelector('form');
      if (form && form.requestSubmit) { form.requestSubmit(); return 'form-submit'; }
      return null;
    });
    if (!submitted) {
      await page.evaluate(() => {
        const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const isPhone = (i) => /همراه|ایمیل|شماره/.test((i.placeholder || '') + (i.getAttribute('aria-label') || '')) || (i.value || '').replace(/\D/g, '').length >= 10;
        const inputs = [...document.querySelectorAll('input')].filter(vis);
        const t = inputs.find((i) => !isPhone(i) && /کد/.test((i.placeholder || '') + (i.getAttribute('aria-label') || ''))) || inputs.find((i) => { if (isPhone(i)) return false; const d = (i.value || '').replace(/\D/g, ''); return ['text', 'tel', 'number'].includes(i.type) && d.length >= 4 && d.length <= 8; });
        if (t) { t.focus(); t.click(); }
      });
      await page.keyboard.press('Enter');
    }
      dbg('otp-submit', { submitted, fillMode, attempt });
      progress('otp-submitted', { attempt });
      botPush('otp-submitted');
      await sleep(12_000);
      await page.screenshot({ path: `${SHOTS}/04-after-login.png`, fullPage: true });

      const __preDeviceTxt = await page.evaluate(() => /خطای تعداد دستگاه|حذف همه دستگاه/.test(document.body.innerText || '')).catch(() => false);
      await clearDeviceModal('post-otp');
      var stage_deviceFreed = __preDeviceTxt;

      let urlNow = page.url();
      for (let i = 0; i < 10 && /login/i.test(urlNow); i++) { await sleep(3000); urlNow = page.url(); }
      if (!/login/i.test(urlNow)) { log('✅ ورود موفق —', urlNow, '(تلاش', attempt + ')'); authed = true; AUTHED = true; frontier.crawlMode = 'session'; break; }
      /* پس از آزادسازی دستگاه: همان کد را یک‌بار دیگر بفرست — شاید جای دستگاه آزاد شده باشد */
      if (stage_deviceFreed) {
        log('تلاش مجدد با همان کد پس از آزادسازی دستگاه…');
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter((x) => !x.disabled).find((x) => /^(ورود|ثبت|تأیید|تایید|وارد|ادامه|ارسال|تکمیل)/.test((x.textContent || '').trim())); if (b) b.click(); });
        await page.keyboard.press('Enter');
        await sleep(8000);
        urlNow = page.url();
        for (let i = 0; i < 6 && /login/i.test(urlNow); i++) { await sleep(3000); urlNow = page.url(); }
        if (!/login/i.test(urlNow)) { log('✅ ورود موفق در تلاش دوم —', urlNow); authed = true; AUTHED = true; frontier.crawlMode = 'session'; break; }
      }
      /* هنوز در صفحهٔ ورود؟ اگر فرم شماره خالی برگشته، جریان ریست شده → تلاش بعدی با پیامک تازه */
      const reset = await page.evaluate(() => {
        const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        return [...document.querySelectorAll('input')].some((i) => vis(i) && /همراه|ایمیل|شماره/.test((i.placeholder || '') + (i.getAttribute('aria-label') || '')) && !((i.value || '').replace(/\D/g, '').length >= 10));
      });
      dbg('login-state', { attempt, url: urlNow, reset });
      await page.screenshot({ path: `${SHOTS}/06-login-stuck-${attempt}.png`, fullPage: true });
      if (!reset) loginFail('ورود کامل نشد');
      log('پس از آزادسازی دستگاه، جریان ورود ریست شد → تلاش دوباره با پیامک تازه…');
    }
      if (!authed) loginFail('ورود پس از ۲ تلاش کامل نشد');
    } catch (e) {
      authed = false;
      botPush('login-failed');
      log('⚠️ ورود ناموفق (' + String((e && e.message) || e).replace('LOGIN|', '').slice(0, 100) + ') — ادامهٔ خزش بی‌نام؛ دیگر پیامک نمی‌خواهد مگر با فرمان تازهٔ login.txt');
      frontier.crawlMode = 'anon';
      try { await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 }); } catch {}
    }
  }

  /* ═══ ۳) ذخیرهٔ نشست برای دفعات بعد ═══ */
  if (SESSION_KEY && authed) {
    try {
      const cookies = await page.cookies();
      const ls = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
      fs.writeFileSync(`${OUT}/session.enc`, JSON.stringify(encryptBlob({ cookies, ls }, SESSION_KEY)));
      botPush('session-saved'); /* حتی اگر همه‌چیز بعدش بترکد، نشست رویarena است → دیگر پیامک لازم نیست */
      log('🔒 نشست رمزنگاری و ذخیره شد — دفعهٔ بعد بدون پیامک');
    } catch (e) { dbg('session-save-error', String(e).slice(0, 200)); }
  } else log('⚠️ RASMIO_SESSION_KEY نیست — نشست ذخیره نمی‌شود (هر بار پیامک لازم است).');

  /* 🚀 وقتی سهمیهٔ API تمام شد و صف بزرگ است، خزش را کوتاه کن تا اجرای بعدی (IP تازه) زودتر شروع شود */
  /* Search quota is not a measured detail-page quota. A persisted search flag must not shorten later detail runs. */
  /* ═══ 🔬 کاوش شش: پیمایش بدون عبارت فقط با کلیک «صفحهٔ بعد» — تا کجا می‌رود؟ ═══ */
  try {
    if (!fs.existsSync(`${DATA}/probe-all6.json`)) {
      const P = { at: new Date().toISOString(), pages: [], netUrls: [], note: null };
      const seenUrls = new Set();
      const got = [];
      let stopReason = null;
      const onRes = async (res) => {
        const u = res.url();
        if (!/api\/search\/search\/all/.test(u)) return;
        if (!seenUrls.has(u)) { seenUrls.add(u); if (P.netUrls.length < 40) P.netUrls.push(u.replace(BASE, '').slice(0, 200)); }
        try {
          const j = await res.json();
          if (j && Array.isArray(j.hits)) got.push({ url: u, page: j.page, total: j.totalCount, n: j.hits.length, hits: j.hits });
        } catch {}
      };
      page.on('response', onRes);
      await page.goto(`${BASE}/search/all/`, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
      await sleep(9000);
      let pages = 0, newCo = 0, seenCo = 0, emptyStreak = 0, sameStreak = 0;
      const known = new Set(Object.keys(frontier.graph.nodes || {}));
      const startCo = [...known].filter((k) => k.startsWith('company:')).length;
      const t0 = Date.now();
      const BUDGET = Number(process.env.PROBE6_MS || 900_000);
      let lastSig = '';
      try {
        while ((Date.now() - t0) < BUDGET) {
          /* منتظر پاسخِ تازهٔ API */
          const before = got.length;
          let waits = 0;
          while (got.length === before && waits < 14) { await sleep(700); waits++; }
          const snap = got[got.length - 1];
          if (!snap) { stopReason = 'no-api-response'; break; }
          const sig = (snap.hits || []).map((h) => h.id).join(',');
          if (sig === lastSig) { sameStreak++; if (sameStreak >= 3) { stopReason = 'same-page-repeating'; break; } } else sameStreak = 0;
          lastSig = sig;
          pages++;
          if (snap.n === 0) { emptyStreak++; if (emptyStreak >= 3) { stopReason = 'empty-results'; break; } } else emptyStreak = 0;
          let fresh = 0;
          for (const h of snap.hits || []) {
            const link = String(h.link || '');
            const m = link.match(/^\/(company|person|brand|product|patent)\/([A-Za-z0-9]+)/);
            if (!m) continue;
            const key = m[1] + ':' + m[2];
            if (known.has(key)) { seenCo++; continue; }
            known.add(key); fresh++; newCo++;
            (frontier.graph.nodes ||= {})[key] = {
              type: m[1], id: m[2], name: h.title || undefined, url: `${BASE}${link}`,
              ...(h.information ? { info: String(h.information).slice(0, 400) } : {}),
              ...(h.subTitle ? { sub: String(h.subTitle).slice(0, 300) } : {}),
            };
          }
          if (pages % 10 === 0 || pages <= 3) {
            log('🔬 بدون‌عبارت ص' + (snap.page !== undefined ? snap.page : pages) + ' → ' + snap.n + ' نتیجه، ' + fresh + ' تازه (کل: ' + newCo + ' · تکراری: ' + seenCo + ')');
          }
          P.pages.push({ i: pages, page: snap.page, n: snap.n, fresh, total: snap.total });
          if (pages % 20 === 0) saveFrontier();
          if (pages >= 600) { stopReason = 'page-cap-600'; break; }
          /* کلیک بعدی */
          const ok = await page.evaluate(() => {
            let b = document.querySelector('button[aria-label="Go to next page"]');
            if (!b) b = [...document.querySelectorAll('button')].find((e) => /next page|بعدی/i.test(e.getAttribute('aria-label') || ''));
            if (b && !b.disabled) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
            return false;
          }).catch(() => false);
          if (!ok) { await sleep(2500); const ok2 = await page.evaluate(() => {
            let b = document.querySelector('button[aria-label="Go to next page"]');
            if (!b) b = [...document.querySelectorAll('button')].find((e) => /next page|بعدی/i.test(e.getAttribute('aria-label') || ''));
            if (b && !b.disabled) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
            return false; }).catch(() => false);
            if (!ok2) { stopReason = 'next-button-disabled'; break; }
          }
        }
      } catch (e) { stopReason = 'error:' + String((e && e.message) || e).slice(0, 60); }
      try { page.off('response', onRes); } catch {}
      if (!stopReason) stopReason = 'time-budget';
      const endCo = [...known].filter((k) => k.startsWith('company:')).length;
      P.summary = { pages, newEntities: newCo, repeats: seenCo, stopReason, seconds: Math.round((Date.now() - t0) / 1000), companiesBefore: startCo, companiesAfter: endCo };
      P.lastPages = P.pages.slice(-5);
      try { fs.writeFileSync(`${DATA}/probe-all6.json`, JSON.stringify(P, null, 1)); } catch {}
      log('🔬 نتیجهٔ پیمایش بدون‌عبارت: ' + pages + ' صفحه · ' + newCo + ' موجودیت تازه · ' + seenCo + ' تکراری · دلیل توقف: ' + stopReason);
      saveFrontier();
    }
  } catch (e) { log('🔬 خطای کاوش شش:', String((e && e.message) || e).slice(0, 100)); }

  /* ═══ ۴) خزندگی BFS ═══ */
  /* ═══ کشف دانه‌های تازه از نقشهٔ سایت رسمیو ═══ */
  const discovered = process.env.RASMIO_VERIFY === '1' || frontier.pending.length > 2000 ? 0 : await discoverSeeds(Number(process.env.DISCOVER_MAX || 8000)); /* همیشه فعال: ۵ دقیقه سهم کشف در هر اجرا — شرکت تازه اولویت دارد */
  if (discovered) log('کشف:', discovered, 'موجودیت تازه به صف اضافه شد — صف کل:', frontier.pending.length);

  /* ═══ 🆕 پرکردنِ خودکارِ صف از گراف: اشخاص و محصولات هم سهم دارند (درخواست ۲۴ مهر) ═══ */
  try {
    if ((frontier.pending || []).length < 2000) {
      const vis = frontier.visited || {};
      const have = new Set((frontier.pending || []).map((x) => x.type + ':' + x.id));
      const want = { person: 8000, product: 8000, brand: 4000, patent: 4000, company: 20000 };
      const bucket = { person: [], product: [], brand: [], patent: [], company: [] };
      for (const k of Object.keys(frontier.graph.nodes || {})) {
        const [t, id] = k.split(':');
        if (!bucket[t]) continue;
        if (vis[k] || have.has(k)) continue;
        if (bucket[t].length >= want[t]) continue;
        bucket[t].push({ type: t, id });
      }
      let n = 0;
      for (const t of Object.keys(want)) { if (bucket[t].length) { frontier.pending.push(...bucket[t]); n += bucket[t].length; } }
      if (n) log('♻️ صف از گراف پر شد: ' + n + ' موجودیت تازه (شخص ' + bucket.person.length + ' · محصول ' + bucket.product.length + ' · برند ' + bucket.brand.length + ' · اختراع ' + bucket.patent.length + ' · شرکت ' + bucket.company.length + ') · صف: ' + frontier.pending.length);
    }
  } catch (e) {}

  /* ═══ 🆕 اشخاص و محصولات دیگر از صف بیرون گذاشته نمی‌شوند (درخواست ۲۴ مهر) ═══ */
  if (frontier.personsLater && frontier.personsLater.length) {
    const back = frontier.personsLater.splice(0, 20000).filter((x) => !frontier.visited[keyOf(x)] && !frontier.pending.some((p) => keyOf(p) === keyOf(x)));
    if (back.length) { frontier.pending.push(...back); log('👥 ' + back.length + ' شخصِ پارک‌شده به صف برگشت · باقی‌مانده: ' + frontier.personsLater.length); }
  }
  /* ═══ جاروی دورهای: هر بار شرکت‌ها تمام شد، صفر-ردیف‌های باقی‌مانده یک دور دیگر با IPهای تازه (حداکثر ۳ دور) ═══ */
  if (!frontier.pending.some((x) => x.type === 'company')) {
    frontier.sweptMap = frontier.sweptMap || {};
    const ROUND = (frontier.sweepRound || 0) + 1;
    if (ROUND <= 3) {
      const zeros = Object.entries(frontier.visited).filter(([k, v]) => k.startsWith('company:') && (v || {}).rows === 0 && (frontier.sweptMap[k] || 0) < ROUND).map(([k]) => k);
      if (zeros.length) {
        frontier.sweepRound = ROUND;
        for (const k of zeros) {
          const [type, id] = k.split(':');
          frontier.sweptMap[k] = ROUND; /* حافظهٔ دورها — جدا از visited چون visited هنگام صف‌شدن حذف می‌شود */
          delete frontier.visited[k];
          frontier.pending.push({ type, id, name: (frontier.graph.nodes[k] || {}).name || id });
        }
        log('🧹 جاروی دور ' + ROUND + ':', zeros.length, 'شرکتِ صفر-ردیف دوباره صف شدند (بازدید ریست شد)');
      }
    }
  }
  /* 🆕 ترتیبِ نوبت‌گردشی: شرکت و شخص و محصول و برند و اختراع همه سهم می‌گیرند (درخواست ۲۴ مهر).
     قبلاً شرکت‌ها کلِ صف را می‌گرفتند و اشخاص/محصولات هرگز خزش نمی‌شدند. */
  {
    const groups = {};
    for (const x of frontier.pending) (groups[x.type] = groups[x.type] || []).push(x);
    for (const g of Object.values(groups)) for (let i = g.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [g[i], g[j]] = [g[j], g[i]]; }
    const WEIGHT = { company: 3, person: 3, product: 1, brand: 1, patent: 1 }; /* 🏢 شرکت اول: از هر IP فقط ۵ صفحهٔ شرکت نصیبمان می‌شود ⇒ همان اولِ اجرا (IP تازه) بگیریم */
    const order = [];
    const idx = {}; for (const t of Object.keys(groups)) idx[t] = 0;
    let total = frontier.pending.length;
    while (total > 0) {
      let moved = false;
      for (const t of Object.keys(groups)) {
        const w = WEIGHT[t] || 1;
        for (let i = 0; i < w && idx[t] < groups[t].length; i++) { order.push(groups[t][idx[t]++]); total--; moved = true; }
      }
      if (!moved) break;
    }
    frontier.pending = order;
    log('🎯 ترتیبِ صف: نوبت‌گردشی — ' + Object.entries(groups).map(([t, g]) => t + ' ' + g.length).join(' · '));
  }
  /* ═══ حالت ترکیبی: هر اجرا علاوه بر شرکت‌ها چند شخص هم خزش می‌کند (صفحهٔ شخص = جدول شرکت‌های مرتبط + آگهی‌ها) ═══ */
  if (frontier.personsLater && frontier.personsLater.length) {
    const picked = [];
    while (picked.length < 1 && frontier.personsLater.length) {
      const p = frontier.personsLater.shift();
      if (!frontier.visited[keyOf(p)] && !frontier.pending.some((x) => keyOf(x) === keyOf(p))) picked.push(p);
    }
    picked.forEach((p, i) => frontier.pending.splice(i * 4, 0, p)); /* یک شخص در سرِ هر موج ۴تایی */
    if (picked.length) log('👥 حالت ترکیبی —', picked.length, 'شخص در این اجرا هم خزش می‌شود · اشخاص باقی‌مانده:', frontier.personsLater.length);
  }
  /* ⚡ تیکه‌بندی صف: هر کارگر از موقعیت‌های SLOT, SLOT+N, … برمی‌دارد → کارگرها روی هم نمی‌افتند */
  // Separate array: takeLocal removes from shared pending; sharing it would shift twice.
  let queue = MAX_PARALLEL === 1 ? [...frontier.pending] : frontier.pending.filter((_, i) => i % MAX_PARALLEL === SLOT);
  queue = prioritizeDetailRepair(frontier, queue, 8);
  if (process.env.RASMIO_VERIFY === '1') {
    const requested = JSON.parse(process.env.RASMIO_VERIFY_KEYS || '[]');
    if (requested.length) {
      queue = requested.map(k => { const [type, id] = k.split(':'); return { type, id }; });
      for (const e of queue) { delete frontier.visited[keyOf(e)]; if (!frontier.pending.some(p => keyOf(p) === keyOf(e))) frontier.pending.push(e); }
    } else queue = ['product', 'person', 'company'].flatMap(type => frontier.pending.filter(e => e.type === type).slice(0, 2));
    log('VERIFY selected pending entities:', queue.map(keyOf));
  }
  if (MAX_PARALLEL > 1) log('⚡ کارگر ' + (SLOT + 1) + '/' + MAX_PARALLEL + ' — سهم این اجرا: ' + queue.length + ' از صف ' + frontier.pending.length);
  const takeLocal = () => {
    while (queue.length) {
      const e = queue.shift(); const k = keyOf(e);
      const idx = frontier.pending.findIndex((x) => keyOf(x) === k);
      if (idx >= 0) frontier.pending.splice(idx, 1); /* از صف مشترک حذف می‌شود تا کارگر دیگر دوباره نگیرد */
      if (!frontier.visited[k]) return e;
    }
    return null;
  };
  let processed = 0, failed = 0, zeroStreak = 0, failedStreak = 0;
  const processedKeys = [];
  const runReport = [];
  const crawlStart = Date.now();
  let stopReason = process.env.RASMIO_VERIFY === '1' ? 'verify-batch-complete' : 'frontier-empty';
  /* ═══ موتور موجی: تا ۳ موجودیت همزمان (تب‌های مخفی) + موج تطبیقی ═══ */
  const MAX_WAVE = 4;
  let waveN = process.env.RASMIO_VERIFY === '1' ? 1 : 4, zeroWaves = 0, lastCkpt = 0, lastRot = 0, paced = false;
  while (processed < LIMIT && queue.length) {
    if ((Date.now() - crawlStart) / 1000 > Math.min(TIME_BUDGET_S, Number(process.env.CRAWL_TIME_BUDGET_S || TIME_BUDGET_S))) { stopReason = 'time-budget'; break; }
    if (hardTimeUp()) { stopReason = 'hard-deadline'; log('⏰ سقف مطلق job — توقف امن و پوش داده'); break; }
    /* رسمیو به هر IP بعد از چند درخواست پوسته می‌دهد → تعویض IP فوری (اجرای بعدی؛ IP تازه تضمین نشده) */
    if (zeroStreak >= (paced ? 2 : 18)) { stopReason = 'quota-or-blocked'; break; }
    const wave = [];
    let heldCompanies = 0;
    while (wave.length < Math.min(waveN, WORKERS.length, LIMIT - processed)) { /* سقف تب: هر موجودیت تب خودش */
      const e = takeLocal();
      if (!e) break;
      /* 🚧 پشتِ دیوار: شرکت را برای اجرای بعدی (IP تازه) نگه می‌داریم و نمی‌خزیمش */
      if (!PUBLIC_PROXY_DETAILS && globalThis.__rasmioWall && e.type === 'company') { frontier.pending.push(e); heldCompanies++; continue; }
      wave.push(e);
    }
    if (!wave.length) { if (heldCompanies) { stopReason = 'company-wall'; break; } continue; }
    progress('crawl', { current: keyOf(wave[0]), processed, pending: frontier.pending.length, wave: wave.length });
    const results = await Promise.all(wave.map(async (e, i) => {
      try { return { ent: e, r: await extractRoutedEntity(e, WORKERS[i] || page) }; }
      catch (err) {
        // Failed/limited requests remain pending, not falsely marked visited.
        if (!frontier.pending.some(p => keyOf(p) === keyOf(e))) frontier.pending.push(e);
        log('FETCH-DEFERRED', keyOf(e), String(err.message || err).slice(0, 120));
        return { ent: e, r: null };
      }
    }));
    let okInWave = 0;
    if (results.every((x) => !x.r)) failedStreak++; else failedStreak = 0;
    for (const { ent: e, r } of results) {
      if (!r) { failed++; log('✗', keyOf(e), 'خطا'); continue; }
      const k = keyOf(e);
      if (!hasDetailCounts(r)) {
        delete frontier.visited[k];
        if (!frontier.pending.some(p => keyOf(p) === k)) frontier.pending.push(e);
        failed++; zeroStreak++;
        log('FETCH-DEFERRED', k, 'empty result is not a completed detail');
        continue;
      }
      frontier.visited[k] = { ...(frontier.visited[k] || {}), at: new Date().toISOString(), rows: r.rows, tableRows: r.tableRows, detailSchemaVersion: 2 };
      if (r.rows > 0 || r.tableRows > 0) { delete frontier.visited[k].suspect; markDetailRepaired(frontier, k); okInWave++; }
      /* 🚧 شرکتِ پشتِ دیوار «خزش‌شده» حساب نمی‌شود — برای اجرای بعدی با IP تازه برمی‌گردد */
      if (!PUBLIC_PROXY_DETAILS && globalThis.__rasmioWall && e.type === 'company' && r.rows === 0) { delete frontier.visited[k]; frontier.pending.push(e); heldCompanies++; }
      processedKeys.push(k);
      runReport.push({ ...r.node, rows: r.rows, newEdges: r.newEdges });
      zeroStreak = 0; // Table-only records are valid details too.
      processed++;
      log(`✔ [${processed}/${LIMIT}]`, k, '—', r.rows, 'ردیف');
    }
    if (failedStreak >= 2) { stopReason = 'blocked-fast'; break; }
    /* توقف فوری بعد از موج: اگر IP خالی است هیچ چرت و فاصله‌ای تلف نشود */
    if (zeroStreak >= (paced ? 2 : 18)) { stopReason = 'quota-or-blocked'; break; }
    /* موج تطبیقی + حالت فاصله‌گذاری: شاید سقفِ «سرعت» IP است نه تعدادش — با فاصلهٔ بلند تست می‌کنیم */
    if (okInWave === 0) {
      zeroWaves++; waveN = 1;
      /* مکث کوتاه و ادامه — به‌جای بستن اجرا (نرخ موفقیت ۳۳٪ ⇒ صفرهای پیاپی طبیعی است) */
      await sleep(4_000 + Math.random() * 5_000);
      if (zeroWaves % 3 === 0) { log('⏳ ' + zeroWaves + ' موج بدون داده — مکث و ادامه'); await sleep(6_000); }
    } else { zeroWaves = 0; if (process.env.RASMIO_VERIFY !== '1' && okInWave === wave.length && waveN < MAX_WAVE && !paced) waveN++; }
    if (processed - lastRot >= 20) { lastRot = processed; await rotateIdentity(); }
    if (processed - lastCkpt >= 25) { lastCkpt = processed; botPush('checkpoint-' + processed); }
    saveFrontier();
    /* خواب تطبیقی: موج کاملاً موفق = فاصلهٔ کوتاه؛ موج خالی = مکث مؤدبانه‌تر */
    const nap = paced
      ? 12_000 + Math.round(Math.random() * 6000)
      : (okInWave === wave.length && wave.length > 1
        ? 900 + Math.round(Math.random() * 900)
        : DELAY_MS + Math.round(Math.random() * 1500) + (processed % 30 === 29 ? 4000 + Math.round(Math.random() * 5000) : 0));
    await sleep(nap);
  }
  if (stopReason === 'quota-or-blocked') { for (const k of processedKeys) { if (frontier.visited[k] && frontier.visited[k].rows === 0) frontier.visited[k].suspect = true; } }
  publicProxyTransport?.save();
  log('پایان این اجرا:', stopReason, '— صف باقی‌مانده:', frontier.pending.length);
  frontier.stats.runs++;
  frontier.stats.entities = Object.keys(frontier.visited).length;
  frontier.stats.maxNodes = Math.max(frontier.stats.maxNodes || 0, Object.keys(frontier.graph.nodes).length);
  /* ریست یک‌باره: جاروی صفر-ردیف‌ها از دور ۱ دوباره آزاد شود (کار مداوم برای ربات) */
  if (frontier.sweepEpoch !== 2) { frontier.sweepEpoch = 2; frontier.sweptMap = {}; frontier.sweepRound = 0; log('♻️ جارو از نو آزاد شد — کار مداوم فعال'); }
  try { const r = saveGraphShards(); if (r) log('🧩 گراف پارچه‌پارچه ذخیره شد — ' + r.n + ' گره / ' + r.m + ' یال · بزرگ‌ترین قطعه ' + Math.round(r.maxB / 104857.6) / 10 + 'MB'); } catch {}
  saveFrontier();

  /* برای seed اول: کشف URL ابزار «شبکه ارتباطات» وقتی اشتراک فعال است */
  const seed = JSON.parse(fs.readFileSync('companies.json', 'utf8')).find((c) => c.nationalId);
  if (seed && AUTHED) {
    try {
      await page.goto(`${BASE}/company/${seed.nationalId}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await sleep(4000);
      const graph = await page.evaluate(() => { const el = [...document.querySelectorAll('a, button')].find((x) => /شبکه\s*ارتباطات/.test((x.textContent || '').trim())); if (!el) return null; el.click(); return true; });
      if (graph) { await sleep(9000); dbg('graph-tool-url', { url: page.url() }); await page.screenshot({ path: `${SHOTS}/graph-tool.png`, fullPage: true }); }
    } catch {}
  }

  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ at: new Date().toISOString(), authedWithoutSms: authed, processed, failed, pending: frontier.pending.length, visitedTotal: Object.keys(frontier.visited).length, nodes: Object.keys(frontier.graph.nodes).length, edges: frontier.graph.edges.length }, null, 1));
  progress('done', { processed, failed, pending: frontier.pending.length, stopReason });
  fs.writeFileSync(`${OUT}/run-summary-${process.env.GITHUB_RUN_ID || 'local'}.json`, JSON.stringify({
    at: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID || 'local', verify: process.env.RASMIO_VERIFY === '1',
    processed, failed, stopReason, pending: frontier.pending.length, proxyTransport: {enabled:PUBLIC_PROXY_DETAILS,checks:publicProxyTransport?.checked||0,successfulProfiles:publicProxyTransport?.report.outcomes.filter(o=>o.success).length||0,failedProfiles:publicProxyTransport?.report.outcomes.filter(o=>!o.success).length||0,directFallback:false}, detailRepair: { remaining: frontier.detailRepair?.remaining?.length || 0, repaired: frontier.detailRepair?.repaired || 0 }, entities: runReport
  }, null, 2));
  log(`✅ اجرا تمام (${stopReason}) — ${processed} موجودیت تازه · صف باقی‌مانده: ${frontier.pending.length} · کل گراف: ${Object.keys(frontier.graph.nodes).length} گره / ${frontier.graph.edges.length} یال`);
  /* ═══ زنجیرهٔ پیوسته: تا وقتی صف یا کشف باقی است، اجرای بعدی فوراً خودکار درخواست می‌شود ═══ */
  const disc = frontier.discovery || {};
  const sweepsLeft = Object.entries(frontier.visited).some(([k, v]) => k.startsWith('company:') && (v || {}).rows === 0 && ((frontier.sweptMap || {})[k] || 0) < 3);
  /* 🔄 هر موجودیتی در صف باشد (شرکت، شخص، محصول، برند، اختراع) زنجیره ادامه می‌یابد */
  let moreWork = (frontier.pending || []).length > 0 || !disc.searchDone || sweepsLeft ||
    ((frontier.discovery && frontier.discovery.apiq) ? !frontier.discovery.apiq.done : false);
  /* 🔄 دیگر هرگز استراحت نمی‌کنیم — بلاک یعنی «تعویض IP»: اجرا زود تمام می‌شود و اجرای بعدی با IP تازه می‌آید */
  /* زنجیرهٔ همیشگی: تا وقتی کار هست ادامه می‌دهیم — حتی وقتی نرخ محدود شد (فاصلهٔ استارت‌ها خودش خنک‌سازی است) */
  if (moreWork) await selfChain();
  else log('زنجیره متوقف شد — همهٔ کار تمام شد (صف: 0، کشف: تمام)');
  botPush('finished');
  await storageGuard();
} catch (e) {
  if (e && e.isFatal) throw e;
  /* خطای غیرمنتظره = خروجِ مؤدبانه: ذخیره + زنجیره ادامه + پوش — هرگز سکوت و مرگ */
  try {
    log('⚠️ خطای غیرمنتظره (بازیابی شد):', String((e && e.message) || e).slice(0, 150));
    try { const r2 = saveGraphShards(); if (r2) log('🧩 گراف پارچه‌پارچه ذخیره شد (بازیابی) — ' + r2.n + ' گره / ' + r2.m + ' یال'); else fs.writeFileSync(`${DATA}/graph.json`, JSON.stringify(frontier.graph)); } catch {}
    saveFrontier();
    const disc0 = frontier.discovery || {};
    const work0 = frontier.pending.length > 0 || !disc0.searchDone || (frontier.personsLater && frontier.personsLater.length > 0);
    if (work0) await selfChain();
    botPush('recovered');
    await storageGuard();
  } catch {}
} finally {
  try { if (browser) await browser.close(); } catch {}
  publicProxyTransport?.close();
}
