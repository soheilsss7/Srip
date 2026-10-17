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
const LIMIT = Number(process.env.CRAWL_LIMIT || 400); // سقف هر اجرا — زنجیرهٔ اجراها گراف را کامل می‌کند
const TIME_BUDGET_S = Number(process.env.CRAWL_TIME_BUDGET_S || 1300); // بودجهٔ خزندگی هر اجرا (ثانیه) — همیشه قبل از سقف ۳۰دقیقه‌ای job تمام می‌شود تا خروجی کامیت شود
const DELAY_MS = Number(process.env.CRAWL_DELAY_MS || 5000);
const SESSION_KEY = process.env.RASMIO_SESSION_KEY || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const line = '[rasmio] ' + a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(line); try { fs.appendFileSync(`${OUT}/run.log`, new Date().toISOString() + ' ' + line + '\n'); } catch {} };
const mask = (s) => String(s).slice(0, 2) + '***' + String(s).slice(-2);

const progress = (step, data = {}) => { try { fs.writeFileSync(`${OUT}/progress.json`, JSON.stringify({ step, at: new Date().toISOString(), ...data }, null, 1)); } catch {} };
const dbg = (name, data) => { try { fs.writeFileSync(`${OUT}/dbg-${name}.json`, typeof data === 'string' ? data : JSON.stringify(data, null, 1)); } catch {} };
class FatalError extends Error { constructor(m) { super(m); this.isFatal = true; } }
const fatal = (msg, extra = {}) => { try { fs.writeFileSync(`${OUT}/fatal.json`, JSON.stringify({ msg, at: new Date().toISOString(), ...extra }, null, 1)); } catch {}; try { fs.appendFileSync(`${OUT}/run.log`, new Date().toISOString() + ' FATAL ' + msg + '\n'); } catch {}; console.error('❌ ' + msg); try { botPush('fatal'); } catch {}; throw new FatalError(msg); };

/* ربات خودش خروجی/لاگ/نشست را همان لحظه پوش می‌کند — دیگر هیچ اطلاعاتی گم نمی‌شود */
function botPush(tag) {
  /* git خودش با اعتبارنامهٔ checkout پوش می‌کند — نیازی به env توکن نیست (باگ ۶) */
  const sh = (c) => { try { execSync(c, { stdio: 'pipe', timeout: 60_000 }); return true; } catch { return false; } };
  sh('git config user.name "rasmio-bot"');
  sh('git config user.email "actions@users.noreply.github.com"');
  sh('git add -f out'); sh('git add -f shots'); sh('git add -f data'); sh('git add -f frontier.json');
  if (!sh(`git commit -m "rasmio-bot: ${tag} (${new Date().toISOString().slice(11, 19)})"`)) return;
  for (let i = 0; i < 3; i++) {
    sh('git rebase --abort || true'); /* ربیز نیمه‌کارهٔ مانده = فاجعهٔ ۱۷ مهر — همیشه پاک شود */
    sh(`git fetch origin ${BRANCH}`);
    sh(`git rebase origin/${BRANCH}`);
    if (sh(`git push origin HEAD:${BRANCH}`)) { log('bot-push:', tag); return; }
  }
  try { dbg('botpush-failed', tag); } catch {}
}

/* ═══ محافظ سقف ریپو v2: تاریخچه همیشه سبک + آرشیو روزانهٔ رایگان — با گزارش کامل هر قدم ═══ */
async function storageGuard() {
  const G = (...a) => log('🗜 [گارد]', ...a);
  try {
    const tok = selfToken();
    if (!tok) { G('توکن نیست — رد شد'); return; }
    /* ۱) فشرده‌سازی تاریخچه هر ۳۰۰ کامیت → یک اسنپ‌شات (داده‌ها کامل می‌مانند) */
    let count = 1;
    try {
      const rc = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=1`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      const link = rc.headers.get('link') || '';
      const lm = link.match(/page=(\d+)>; rel="last"/);
      if (lm) count = Number(lm[1]);
      G('کامیت‌های شاخه:', count);
    } catch (e) { G('شمارش کامیت خطا خورد:', String(e).slice(0, 80)); }
    if (count >= 300) {
      const sh = (c) => { try { execSync(c, { stdio: 'pipe', timeout: 600_000 }); return true; } catch (e) { G('گام ناموفق:', c.slice(0, 70), '→', String((e && e.message) || e).slice(0, 150)); return false; } };
      sh('git rebase --abort || true'); /* ربیز نیمه‌کاره = فاجعهٔ ۱۷ مهر (پوش درختِ قفل‌شده) */
      sh(`git fetch origin ${BRANCH}`);
      sh(`git rebase origin/${BRANCH}`);
      sh(`git push origin HEAD:${BRANCH}`);
      sh('git rebase --abort || true');
      if (sh('git checkout --orphan _squash_tmp') && sh('git add -A') && sh('git commit -q -m "snapshot: داده‌ها + تاریخچهٔ فشرده (محافظ سقف)"')) {
        /* قفل سلامت: فقط اگر گرافِ داخل اسنپ‌شات سالم و بزرگ است پوش اجباری می‌شود */
        let nodesN = 0;
        try { nodesN = Object.keys((JSON.parse(fs.readFileSync('data/graph.json', 'utf8')) || {}).nodes || {}).length; } catch {}
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
    const sm = {};
    for (const [k, v] of Object.entries(visited)) if ((v || {}).rows === 0 && k.startsWith('company:')) sm[k] = 3;
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
  try { frontier.graph = JSON.parse(fs.readFileSync(`${DATA}/graph.json`, 'utf8')); } catch { frontier.graph = { nodes: {}, edges: [] }; }
}
/* واچ‌داگ: گراف کوچک‌تر از نصف بیشینهٔ تاریخی = فاجعه → بازسازی از فایل‌های موجودیت */
{
  const _n = Object.keys(frontier.graph.nodes || {}).length;
  const _floor = Math.max(40000, Math.floor(((frontier.stats && frontier.stats.maxNodes) || 0) * 0.5));
  if (_n && _n < _floor) { log('🚨 واچ‌داگ: گراف ' + _n + ' گره < کف سلامت ' + _floor + ' → بازسازی'); rebuildFromEntities('گراف آسیب‌دیده'); }
}
const saveFrontier = () => {
  try {
    const { graph, ...rest } = frontier;
    fs.writeFileSync('frontier.json.tmp', JSON.stringify(rest));
    fs.renameSync('frontier.json.tmp', 'frontier.json');
    if (graph && graph.nodes) { fs.writeFileSync(`${DATA}/graph.json.tmp`, JSON.stringify(graph)); fs.renameSync(`${DATA}/graph.json.tmp`, `${DATA}/graph.json`); }
  } catch {}
};
const normId = (href) => {
  const pm = String(href).match(/\/person\/([0-9A-Fa-f]+)/);
  if (pm) return { type: 'person', id: pm[1] };
  const cm = String(href).match(/\/company\/(\d+)/);
  if (cm) return { type: 'company', id: cm[1] };
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
  /* اشخاص پارک می‌شوند — داده‌شان از جدول‌های شرکت‌ها می‌آید؛ شرکت‌ها اولویت‌اند */
  if (ent.type === 'person') {
    frontier.personsLater = frontier.personsLater || [];
    if (frontier.visited[k] || frontier.personsLater.some((p) => keyOf(p) === k)) return;
    frontier.personsLater.push(ent);
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
  const dTimeUp = () => (Date.now() - dT0) > 300_000; /* سهم کشف: حداکثر ۵ دقیقه — خزش هیچ‌وقت قربانی کشف نمی‌شود */
  const D = frontier.discovery = frontier.discovery || {};
  if (D.v !== DISCOVERY_V) { D.v = DISCOVERY_V; D.searchDone = false; D.search = { termIdx: 0, page: 1, mode: null, pi: 0, ppage: 1, provDone: true }; }
  const S = D.search = D.search || { termIdx: 0, page: 1, mode: null, pi: 0, ppage: 1, provDone: false };
  S.pi = S.pi || 0; S.ppage = S.ppage || 1; if (S.provDone === undefined) S.provDone = false;
  if (D.searchDone) return 0;
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
      try { await page.goto(mkUrl(SEARCH_TERMS[0], 1), { waitUntil: 'domcontentloaded', timeout: 90_000 }); } catch {}
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
  while (!S.provDone && added < maxNew && S.pi < PROVINCES.length) {
    const prov = PROVINCES[S.pi];
    let html = '';
    try {
      if (S.mode === 'fetch') {
        const r = await fetch(mkProvUrl(prov, S.ppage), { cache: 'no-store' }).catch(() => null);
        if (!r || !r.ok) { S.pi++; S.ppage = 1; continue; }
        html = await r.text();
      } else {
        try { await page.goto(mkProvUrl(prov, S.ppage), { waitUntil: 'domcontentloaded', timeout: 90_000 }); } catch { S.pi++; S.ppage = 1; continue; }
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
  while (added < maxNew && S.termIdx < SEARCH_TERMS.length) {
    const term = SEARCH_TERMS[S.termIdx];
    let html = '';
    try {
      if (S.mode === 'fetch') {
        const r = await fetch(mkUrl(term, S.page), { cache: 'no-store' }).catch(() => null);
        if (!r || !r.ok) { S.termIdx++; S.page = 1; continue; }
        html = await r.text();
      } else {
        try { await page.goto(mkUrl(term, S.page), { waitUntil: 'domcontentloaded', timeout: 90_000 }); } catch { S.termIdx++; S.page = 1; continue; }
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
  if (S.termIdx >= SEARCH_TERMS.length && !D.searchDone) { D.searchDone = true; log('کشف: همهٔ عبارت‌های جستجو مصرف شد'); }
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
  try {
    const tok = selfToken();
    dbg('self-chain', { hasToken: !!tok, tokLen: tok.length });
    if (!tok) { log('زنجیره: توکنی برای dispatch پیدا نشد'); return; }
    const MY_RUN = String(process.env.GITHUB_RUN_ID || '');
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=30`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' } });
      if (r.ok) {
        const others = ((await r.json()).workflow_runs || []).filter((x) => String(x.id) !== MY_RUN && (x.status === 'in_progress' || x.status === 'queued'));
        if (others.length) { log('زنجیره: اجرای دیگری (' + others[0].id + ') در صف/فعال است — dispatch لازم نیست، همان ادامه می‌دهد'); return; }
      }
    } catch {}
    const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ event_type: 'rasmio-run' }) });
    dbg('self-chain-status', { status: r.status });
    log(r.ok ? '⛓ زنجیره: اجرای بعدی همین حالا درخواست شد — خزش پیوسته ادامه دارد' : 'زنجیره پاسخ ' + r.status + ' داد (پشتیبان: زمان‌بندی شبانه)');
  } catch (e) { dbg('self-chain-error', String(e).slice(0, 250)); }
}

let browser = null, page = null;
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
async function parsePageTables(pg = page) {
  return pg.evaluate(() => {
    const rows = [];
    const tables = [];
    const seen = new Set();
    for (const t of document.querySelectorAll('table')) {
      const header = [...t.querySelectorAll('thead th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
      const allRows = [];
      for (const tr of t.querySelectorAll('tbody tr')) {
        const cells = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (cells.length) allRows.push(cells.slice(0, 10));
        const links = [...tr.querySelectorAll('a[href*="/person/"], a[href*="/company/"]')];
        if (!links.length) continue;
        const link = links.find((l) => (l.innerText || '').trim()) || links[0];
        const href = link.getAttribute('href');
        const dedupe = href + '§' + header;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        rows.push({ header, href, name: (link.innerText || '').replace(/\s+/g, ' ').trim(), cells: cells.slice(0, 8) });
      }
      if (allRows.length) tables.push({ header, rows: allRows });
    }
    const title = ((document.querySelector('h1') || {}).innerText || document.title || '').trim();
    return { title: title.trim(), rows, tables };
  });
}

async function extractEntity(ent, pg = page) {
  const url = ent.type === 'company' ? `${BASE}/company/${ent.id}` : `${BASE}/person/${ent.id}/x/`;
  /* ═══ مسیر سریع: HTML سرور (SSR) — حالت تطبیقی (کوکی/بی‌نام) ═══ */
  let parsed = null, via = 'fetch', html = '';
  const tryFetchParse = async (withCookie) => {
    const headers = { 'user-agent': UA_NORM, 'accept-language': 'fa,en' };
    if (withCookie) {
      const ck = (await pg.cookies(BASE)).map((c) => `${c.name}=${c.value}`).join('; ');
      if (ck) headers.cookie = ck;
    }
    const r = await fetch(url, { headers, redirect: 'follow', cache: 'no-store' });
    if (!r.ok) { dbg('fetch-status', { id: ent.id, withCookie, status: r.status }); return null; }
    const h = await r.text();
    await pg.setContent(h, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await sleep(400);
    return { html: h, parsed: await parsePageTables(pg) };
  };
  try {
    if (ent.type === 'person' && !frontier.personProbed) {
      frontier.personProbed = true;
      try { dbg('person-raw', { id: ent.id, rawTitle: ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').slice(0, 80), hasRelatedTable: html.includes('شرکت‌های مرتبط') || html.includes('شرکت های مرتبط'), nextF: (html.match(/self\.__next_f/g) || []).length, rawLen: html.length }); } catch {}
    }
    /* صفحهٔ شخص جدول‌هایش را با JS می‌سازد (آزمایش شد: fetch پوستهٔ خالی با عنوان سالم می‌دهد) → مستقیم مرورگر */
    const order = ent.type === 'person' ? [] : (frontier.crawlMode === 'anon' ? [false, true] : [true, false]);
    for (const wc of order) {
      const res = await tryFetchParse(wc);
      if (!res) continue;
      if (res.parsed.rows.length > 0) { html = res.html; parsed = res.parsed; via = wc ? 'fetch' : 'fetch-anon'; frontier.crawlMode = wc ? 'session' : 'anon'; break; }
      if (!html) { html = res.html; parsed = res.parsed; } /* نگه‌داشتن برای مسیر مرورگر */
    }
  } catch (e) { dbg('fetch-extract-error', { id: ent.id, e: String(e).slice(0, 120) }); }
  /* ═══ مسیر کامل مرورگر: فقط اگر لازم باشد — fetchِ سالمِ بی‌جدول یعنی صفحه واقعاً داده ندارد (SSR کامل است) و مرورگر فقط وقت می‌سوزاند ═══ */
  const fetchCleanEmpty = ent.type !== 'person' && parsed && via === 'fetch' && parsed.rows.length === 0 && parsed.tables && parsed.tables.length === 0
    && parsed.title && !/undefined/i.test(parsed.title);
  if ((!parsed || parsed.rows.length === 0) && !fetchCleanEmpty) {
    via = 'browser';
    if (ent.type === 'person') { try { await pg.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 }); await sleep(1500); } catch {} } /* گرم‌کردن کوکی */
    try { await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 }); } catch {}
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
      try { await pg.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 }); await sleep(6000); } catch {}
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
      if (val) { const key = lb.includes('تاسیس') || lb.includes('تأسیس') ? 'تاریخ تاسیس' : lb; info[key] = val.slice(0, 160); }
    }
    const ai = lines.findIndex((l) => /نشانی ثبتی/.test(l));
    if (ai >= 0) {
      /* نشانی واقعی: اولین خطِ بلندِ بعد از برچسب (برچسب خودش «نشانی ثبتی شرکت» است) */
      const val = lines.slice(ai + 1, ai + 6).find((l) => l.length > 25) || lines[ai + 1] || '';
      if (val) info['نشانی'] = val.slice(0, 260);
    }
    if (!Object.keys(info).length) info = null;
  } catch {}
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
          await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
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
  frontier.graph.nodes[keyOf(ent)] = node;
  const edges = [];
  for (const r of parsed.rows) {
    const target = normId(r.href);
    if (!target) continue;
    const tName = r.name || (r.cells[0] || '').trim();
    frontier.graph.nodes[keyOf(target)] ??= { type: target.type, id: target.id, name: tName, url: `${BASE}${r.href}` };
    const role = r.header.includes('سمت') ? (r.cells.find((c) => /مدیر|بازرس|عضو|نماینده|رئیس|حق امضا|مدیرعامل/.test(c)) || r.cells[1] || '') : (r.header.split('|')[0] || '').trim();
    edges.push({ from: keyOf(ent), to: keyOf(target), kind: r.header, role, cells: r.cells });
    enqueue({ type: target.type, id: target.id, name: tName }, keyOf(ent));
  }
  frontier.graph.edges.push(...edges.filter((e) => !frontier.graph.edges.some((x) => x.from === e.from && x.to === e.to && x.kind === e.kind && x.role === e.role)));
  try { fs.writeFileSync(`${DATA}/entities/${ent.type}-${ent.id}.json`, JSON.stringify({ ...node, via, ...(info ? { info } : {}), rows: parsed.rows, ...(parsed.tables && parsed.tables.length ? { tables: parsed.tables } : {}) }, null, 1)); } catch {}
  const dead = ent.type === 'person' && /undefined/i.test((parsed && parsed.title) || '');
  return { node, rows: parsed.rows.length, newEdges: edges.length, dead };
}

try {
  /* ═══ ۰) قفل انحصار — هیچ دو اجرایی همزمان نباشد (ریشهٔ گم‌شدن داده و شکست ورود) ═══ */
  const MY_RUN = String(process.env.GITHUB_RUN_ID || '');
  const ghApiRaw = async (path, method = 'GET') => fetch(`https://api.github.com${path}`, { method, headers: { authorization: `Bearer ${selfToken()}`, accept: 'application/vnd.github+json' } });
  if (selfToken()) {
    try {
      const r = await ghApiRaw(`/repos/${REPO}/actions/workflows/rasmio-v3.yml/runs?per_page=30`);
      const runs = r.ok ? ((await r.json()).workflow_runs || []) : [];
      const others = runs.filter((x) => String(x.id) !== MY_RUN && (x.status === 'in_progress' || x.status === 'queued'));
      if (others.length) {
        if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
          for (const o of others) { try { const c = await ghApiRaw(`/repos/${REPO}/actions/runs/${o.id}/cancel`, 'POST'); log('🛑 اجرای رقیب کنسل شد:', o.id, '→', c.status); } catch {} }
          await sleep(12_000);
        } else if (others.some((o) => Number(o.id) < Number(MY_RUN || '0') || !MY_RUN)) {
          /* منتظر پایان رقیب می‌مانیم (تا ۱۲ دقیقه) — خروجِ خاموش زنجیره را می‌کشت */
          log('🔒 اجرای دیگری (' + others[0].id + ') فعال است — منتظر پایانش می‌مانم…');
          let waited = 0;
          while (waited < 720_000) {
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
                /* بن‌بست دو ربات: رقیب ممکن است چون ما را «فعال» دیده باشد پخش نکرده باشد → خودمان زنجیره را روشن می‌کنیم */
                log('🔒 رقیب هنوز فعال است — برای اطمینان از ادامهٔ زنجیره، خودم اجرای بعدی را پخش می‌کنم');
                try {
                  const tokD = selfToken();
                  if (tokD) await fetch(`https://api.github.com/repos/${REPO}/dispatches`, { method: 'POST', headers: { authorization: `Bearer ${tokD}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ event_type: 'rasmio-run' }) });
                } catch {}
                process.exit(0);
              }
            }
          } catch {}
        }
      }
    } catch (e) { dbg('lock-error', String(e).slice(0, 150)); }
  }
  log('startup — راه‌اندازی مرورگر… | node', process.version);
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--window-size=1440,900'] });
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
  if (!PHONE) fatal('Secret «RASMIO_PHONE» تنظیم نشده.');
  progress('start', { pending: frontier.pending.length, visited: Object.keys(frontier.visited).length });

  /* ═══ ۱) بازیابی نشست ═══ */
  let authed = false;
  if (SESSION_KEY && fs.existsSync(`${OUT}/session.enc`)) {
    try {
      const sess = decryptBlob(JSON.parse(fs.readFileSync(`${OUT}/session.enc`, 'utf8')), SESSION_KEY);
      await page.setCookie(...(sess.cookies || []));
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      if (sess.ls) await page.evaluate((ls) => { for (const [k, v] of Object.entries(ls)) { try { localStorage.setItem(k, v); } catch {} } }, sess.ls);
      /* چک رفتاری: کاربرِ واردشده صفحهٔ ورود را نمی‌بیند (API خام بدون هدر 401 کاذب می‌دهد) */
      await page.goto(`${BASE}/login/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
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
  const wantLogin = manualLogin || (loginFlag && flagFresh && !loginUsed);
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
        await page.goto(`${BASE}/login/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
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
      try { await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 }); } catch {}
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

  /* ═══ ۴) خزندگی BFS ═══ */
  /* ═══ کشف دانه‌های تازه از نقشهٔ سایت رسمیو ═══ */
  const discovered = await discoverSeeds(Number(process.env.DISCOVER_MAX || 600)); /* همیشه فعال: ۵ دقیقه سهم کشف در هر اجرا — شرکت تازه اولویت دارد */
  if (discovered) log('کشف:', discovered, 'موجودیت تازه به صف اضافه شد — صف کل:', frontier.pending.length);

  /* ═══ پارک اشخاص: ۱۰۰٪ بودجه روی شرکت‌ها (دادهٔ اشخاص از جدول‌های شرکت‌ها جمع می‌شود) ═══ */
  frontier.personsLater = [...(frontier.personsLater || []), ...frontier.pending.filter((x) => x.type === 'person')];
  frontier.pending = frontier.pending.filter((x) => x.type !== 'person');
  if (frontier.pending.length < 60 && frontier.personsLater.length) {
    const back = frontier.personsLater.splice(0, 120).filter((x) => !frontier.visited[keyOf(x)]);
    frontier.pending.push(...back);
    log('شرکت‌های صف کم شد —', back.length, 'شخص برای خزش برگشت');
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
  /* ترتیب: شرکت‌ها اول (داده و یال تازه می‌دهند)، اشخاص بعد از آن — داخل هر گروه تصادفی */
  {
    const comps = frontier.pending.filter((x) => x.type === 'company');
    const pers = frontier.pending.filter((x) => x.type !== 'company');
    for (const grp of [comps, pers]) for (let i = grp.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [grp[i], grp[j]] = [grp[j], grp[i]]; }
    frontier.pending = [...comps, ...pers];
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
  let processed = 0, failed = 0, zeroStreak = 0;
  const processedKeys = [];
  const runReport = [];
  const crawlStart = Date.now();
  let stopReason = 'frontier-empty';
  /* ═══ موتور موجی: تا ۳ موجودیت همزمان (تب‌های مخفی) + موج تطبیقی ═══ */
  const MAX_WAVE = 4;
  let waveN = 4, zeroWaves = 0, lastCkpt = 0, lastRot = 0, paced = false;
  while (processed < LIMIT && frontier.pending.length) {
    if ((Date.now() - crawlStart) / 1000 > TIME_BUDGET_S) { stopReason = 'time-budget'; break; }
    /* رسمیو به هر IP بعد از چند درخواست پوسته می‌دهد → تعویض IP فوری (اجرای بعدی = IP تازه) */
    if (zeroStreak >= (paced ? 2 : 6)) { stopReason = 'quota-or-blocked'; break; }
    const wave = [];
    while (wave.length < Math.min(waveN, WORKERS.length) && frontier.pending.length) { /* سقف تب: هر موجودیت تب خودش */
      const e = frontier.pending.shift();
      if (!frontier.visited[keyOf(e)]) wave.push(e);
    }
    if (!wave.length) continue;
    progress('crawl', { current: keyOf(wave[0]), processed, pending: frontier.pending.length, wave: wave.length });
    const results = await Promise.all(wave.map(async (e, i) => {
      try { return { ent: e, r: await extractEntity(e, WORKERS[i] || page) }; }
      catch (err) { frontier.visited[keyOf(e)] = { ...(frontier.visited[keyOf(e)] || {}), at: new Date().toISOString(), error: String(err).slice(0, 150) }; return { ent: e, r: null }; }
    }));
    let okInWave = 0;
    for (const { ent: e, r } of results) {
      if (!r) { failed++; log('✗', keyOf(e), 'خطا'); continue; }
      const k = keyOf(e);
      frontier.visited[k] = { ...(frontier.visited[k] || {}), at: new Date().toISOString(), rows: r.rows };
      if (r.dead) { frontier.visited[k].zeroRetried = true; frontier.visited[k].suspectTries = 8; log('⛔ صفحهٔ شخص داده ندارد (undefined) — بدون تلاش مجدد'); }
      if (r.rows > 0) { delete frontier.visited[k].suspect; okInWave++; }
      processedKeys.push(k);
      runReport.push({ ...r.node, rows: r.rows, newEdges: r.newEdges });
      zeroStreak = r.rows === 0 ? zeroStreak + 1 : 0;
      processed++;
      log(`✔ [${processed}/${LIMIT}]`, k, '—', r.rows, 'ردیف');
    }
    /* توقف فوری بعد از موج: اگر IP خالی است هیچ چرت و فاصله‌ای تلف نشود */
    if (zeroStreak >= (paced ? 2 : 6)) { stopReason = 'quota-or-blocked'; break; }
    /* موج تطبیقی + حالت فاصله‌گذاری: شاید سقفِ «سرعت» IP است نه تعدادش — با فاصلهٔ بلند تست می‌کنیم */
    if (okInWave === 0) {
      zeroWaves++; waveN = 1;
      if (!paced) { paced = true; log('🐢 فاصله‌گذاری سبک — دو تستِ تکی؛ اگر داده برگشت یعنی سقف سرعت است'); await sleep(8_000); }
      else if (zeroWaves >= 2) { await sleep(8_000 + Math.random() * 6_000); zeroWaves = 0; }
    } else { zeroWaves = 0; if (okInWave === wave.length && waveN < MAX_WAVE && !paced) waveN++; }
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
  log('پایان این اجرا:', stopReason, '— صف باقی‌مانده:', frontier.pending.length);
  frontier.stats.runs++;
  frontier.stats.entities = Object.keys(frontier.visited).length;
  frontier.stats.maxNodes = Math.max(frontier.stats.maxNodes || 0, Object.keys(frontier.graph.nodes).length);
  try { fs.writeFileSync(`${DATA}/graph.json`, JSON.stringify(frontier.graph)); } catch {}
  saveFrontier();

  /* برای seed اول: کشف URL ابزار «شبکه ارتباطات» وقتی اشتراک فعال است */
  const seed = JSON.parse(fs.readFileSync('companies.json', 'utf8')).find((c) => c.nationalId);
  if (seed && AUTHED) {
    try {
      await page.goto(`${BASE}/company/${seed.nationalId}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await sleep(4000);
      const graph = await page.evaluate(() => { const el = [...document.querySelectorAll('a, button')].find((x) => /شبکه\s*ارتباطات/.test((x.textContent || '').trim())); if (!el) return null; el.click(); return true; });
      if (graph) { await sleep(9000); dbg('graph-tool-url', { url: page.url() }); await page.screenshot({ path: `${SHOTS}/graph-tool.png`, fullPage: true }); }
    } catch {}
  }

  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ at: new Date().toISOString(), authedWithoutSms: authed, processed, failed, pending: frontier.pending.length, visitedTotal: Object.keys(frontier.visited).length, nodes: Object.keys(frontier.graph.nodes).length, edges: frontier.graph.edges.length }, null, 1));
  progress('done', { processed, failed, pending: frontier.pending.length, stopReason });
  log(`✅ اجرا تمام (${stopReason}) — ${processed} موجودیت تازه · صف باقی‌مانده: ${frontier.pending.length} · کل گراف: ${Object.keys(frontier.graph.nodes).length} گره / ${frontier.graph.edges.length} یال`);
  /* ═══ زنجیرهٔ پیوسته: تا وقتی صف یا کشف باقی است، اجرای بعدی فوراً خودکار درخواست می‌شود ═══ */
  const disc = frontier.discovery || {};
  const sweepsLeft = Object.entries(frontier.visited).some(([k, v]) => k.startsWith('company:') && (v || {}).rows === 0 && ((frontier.sweptMap || {})[k] || 0) < 3);
  const moreWork = frontier.pending.some((x) => x.type === 'company') || !disc.searchDone || sweepsLeft;
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
    try { fs.writeFileSync(`${DATA}/graph.json`, JSON.stringify(frontier.graph)); } catch {}
    saveFrontier();
    const disc0 = frontier.discovery || {};
    const work0 = frontier.pending.length > 0 || !disc0.searchDone || (frontier.personsLater && frontier.personsLater.length > 0);
    if (work0) await selfChain();
    botPush('recovered');
    await storageGuard();
  } catch {}
} finally {
  try { if (browser) await browser.close(); } catch {}
}
