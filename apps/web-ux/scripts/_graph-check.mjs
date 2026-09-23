/* باتری E2E گراف ارتباطات (نسخهٔ بازسازی‌شده: چیدمان شعاعی + دسته‌های جمع‌شده)
   اجرا: node scripts/_graph-check.mjs   (UI_BASE قابل تنظیم — بیلد استاتیک :4100 یا dev :3000)
   پوشش:
   · آرون: نمای پیش‌فرض فقط ساختار واقعی (۱۴ گره/۱۳ پیوند) — نه ۸۱ حباب پراکنده
   · دسته‌های سازمان‌های بدون رابطه: ۴ چیپ با شمار درست + باز/بسته شدن اعضا
   · کلیک گره = پنل جزئیات + کم‌رنگی غیرهمسایه‌ها · جستجو + «پیدا کن» · زوم/متناسب
   · پارس: اگو مرکز + ۱۲ زیرمجموعه · دمو: اشخاص + عضویت + ابزار مسیر کهربایی
   · موبایل ۳۶۰ بدون سرریز · EN: عنوان/دکمه‌های انگلیسی · بدون خطای صفحه */
import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';

const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1440, height: 900 },
});
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  cond ? pass++ : fail++;
};
const pageErrors = new Map();
const track = (p) => p.on('pageerror', (e) => pageErrors.set(p, (pageErrors.get(p) ?? []).concat(e.message.slice(0, 120))));

async function login(user, pass_, otp) {
  const page = await browser.newPage();
  track(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('srip2_tour_done', '1'); } catch {} });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', user);
  await page.type('#login-pass', pass_);
  await page.click('.auth-form button[type=submit]');
  if (otp) {
    await page.waitForSelector('#login-otp', { timeout: 30000 });
    await page.type('#login-otp', otp);
    await page.click('.auth-form button[type=submit]');
  }
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 });
  await page.goto(`${BASE}/network`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 6500));
  return page;
}

const snap = (page) => page.evaluate(() => {
  const svg = document.querySelector('.net-graph-zone svg');
  const nodes = [...svg?.querySelectorAll('g[data-node]') ?? []].map(g => {
    const c = g.querySelector('circle');
    return {
      id: g.getAttribute('data-node'),
      type: g.getAttribute('data-nt'),
      ego: g.getAttribute('data-ego'),
      cx: c ? +c.getAttribute('cx') : null,
      cy: c ? +c.getAttribute('cy') : null,
      texts: [...g.querySelectorAll('text')].map(x => x.textContent ?? ''),
    };
  });
  return {
    title: document.querySelector('.net-graph-head h2')?.textContent ?? '',
    counts: document.querySelector('.net-graph-head .counts')?.textContent ?? '',
    nodes,
    edges: svg?.querySelectorAll('g[data-edge]').length ?? 0,
    stacks: [...svg?.querySelectorAll('g[data-stack]') ?? []].map(g => ({ key: g.getAttribute('data-stack'), open: g.getAttribute('data-open'), txt: (g.textContent ?? '').trim() })),
    transform: svg?.querySelector('g')?.getAttribute('transform') ?? '',
    orphanToggle: document.querySelector('.net-orphan-toggle')?.textContent ?? '',
    hasSearch: !!document.querySelector('.net-search'),
  };
});

/** تپ واقعی روی گره (pointerdown+up) — مثل لمس/کلیک کاربر */
async function tapNode(page, matcher) {
  return page.evaluate((m) => {
    const g = [...document.querySelectorAll('g[data-node]')].find(n => (n.textContent ?? '').includes(m));
    if (!g) return false;
    const r = g.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 7, pointerType: 'mouse', button: 0, isPrimary: true };
    g.dispatchEvent(new PointerEvent('pointerdown', opts));
    g.dispatchEvent(new PointerEvent('pointerup', opts));
    return true;
  }, matcher);
}
const toolbarBtn = (page, label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('.net-graph-toolbar .net-btn')].find(x => (x.textContent ?? '').includes(l));
  if (!b) return false;
  b.click();
  return true;
}, label);

/* ═══════════ مستأجر آرون: نمای پیش‌فرض فقط ساختار واقعی ═══════════ */
const aroun = await login('aroun', '12356784');
let d = await snap(aroun);
ok('آرون — عنوان «گراف ارتباطات»', d.title.includes('گراف ارتباطات'), d.title);
ok('آرون — نمای پیش‌فرض: ۱۴ گره (نه ۸۱ حباب)', d.nodes.length === 14, `n=${d.nodes.length}`);
ok('آرون — ۱۳ پیوند واقعی', d.edges === 13, `n=${d.edges}`);
ok('آرون — اگو «شرکت x» دقیقاً در مرکز بوم', (() => { const e = d.nodes.find(n => n.ego === 'true'); return !!e && Math.abs(e.cx - 800) < 2 && Math.abs(e.cy - 380) < 2; })());
ok('آرون — برچسب «خودِ شرکت» روی اگو', d.nodes.find(n => n.ego === 'true')?.texts.some(x => x.includes('خودِ شرکت')));
ok('آرون — هلدینگ پارس + ۱۲ زیرمجموعه با برچسب', (() => { const t = d.nodes.flatMap(n => n.texts).join(' | '); return t.includes('هلدینگ پارس') && ['پارس انرژی', 'پارس مالی', 'پارس محتوا', 'پارس کشاورزی'].every(x => t.includes(x)); })());
ok('آرون — بدون دسته در حالت پیش‌فرض (نهادهای بی‌رابطه مخفی)', d.stacks.length === 0, `n=${d.stacks.length}`);
ok('آرون — شمارندهٔ «۶۷ سازمان بدون رابطهٔ ثبت‌شده»', d.orphanToggle.includes('۶۷'), d.orphanToggle);
ok('آرون — جعبهٔ جستجو در نوار ابزار', d.hasSearch);
ok('آرون — بدون خطای صفحه', !(pageErrors.get(aroun) ?? []).length, (pageErrors.get(aroun) ?? [])[0] ?? '');

/* دسته‌های نهادهای بدون رابطه */
ok('آرون — روشن کردن «نهادهای بدون رابطه»', await toolbarBtn(aroun, 'نهادهای بدون رابطه'));
await new Promise(r => setTimeout(r, 2500));
d = await snap(aroun);
ok('آرون — ۴ دسته با شمار درست (۲۶/۱۸/۷/۱۶)', d.stacks.length === 4
  && d.stacks.some(s => s.key === 'INSTITUTIONAL' && s.txt.includes('۲۶'))
  && d.stacks.some(s => s.key === 'ACADEMIC' && s.txt.includes('۱۸'))
  && d.stacks.some(s => s.key === 'ECONOMIC' && s.txt.includes('۷'))
  && d.stacks.some(s => s.key === 'ECOSYSTEM' && s.txt.includes('۱۶')), JSON.stringify(d.stacks.map(s => s.txt)));
/* باز کردن دستهٔ نهادی → ۲۶ عضو */
await aroun.evaluate(() => document.querySelector('g[data-stack="INSTITUTIONAL"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await new Promise(r => setTimeout(r, 1800));
d = await snap(aroun);
ok('آرون — باز شدن دستهٔ نهادی: ۱۴+۲۶ گره', d.nodes.length === 40, `n=${d.nodes.length}`);
ok('آرون — اعضای نهادی برچسب دارند (شورای راهبری هوش مصنوعی)', d.nodes.flatMap(n => n.texts).some(x => x.includes('شورای ملی راهبری')));
await aroun.evaluate(() => document.querySelector('g[data-stack="INSTITUTIONAL"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await new Promise(r => setTimeout(r, 1200));
d = await snap(aroun);
ok('آرون — بستن دسته: بازگشت به ۱۴ گره', d.nodes.length === 14, `n=${d.nodes.length}`);

/* کلیک گره = جزئیات + برجسته‌سازی همسایه‌ها */
ok('آرون — تپ روی «پارس مالی»', await tapNode(aroun, 'پارس مالی'));
await new Promise(r => setTimeout(r, 1200));
const rail1 = await aroun.evaluate(() => ({
  h3: document.querySelector('.net-detail h3')?.textContent ?? '',
  dimmed: [...document.querySelectorAll('g[data-node]')].filter(g => g.getAttribute('opacity') === '0.16').length,
}));
ok('آرون — پنل جزئیات: «پارس مالی»', rail1.h3.includes('پارس مالی'), rail1.h3);
ok('آرون — غیرهمسایه‌ها کم‌رنگ شدند', rail1.dimmed > 0, `n=${rail1.dimmed}`);

/* جستجو + پیدا کن */
const t0 = (await snap(aroun)).transform;
await aroun.type('.net-search', 'پارس سلامت');
await new Promise(r => setTimeout(r, 600));
ok('آرون — دکمهٔ «پیدا کن»', await toolbarBtn(aroun, 'پیدا کن'));
await new Promise(r => setTimeout(r, 1200));
const t1 = (await snap(aroun)).transform;
ok('آرون — جستجو نما را روی نتیجه مرکز کرد', t0 !== t1);

/* زوم + متناسب */
const tz0 = (await snap(aroun)).transform;
ok('آرون — دکمهٔ +', await toolbarBtn(aroun, '+'));
await new Promise(r => setTimeout(r, 500));
ok('آرون — زوم تغییر کرد', tz0 !== (await snap(aroun)).transform);
ok('آرون — دکمهٔ «متناسب»', await toolbarBtn(aroun, 'متناسب'));
await new Promise(r => setTimeout(r, 700));
const fitT = (await snap(aroun)).transform;
ok('آرون — متناسب: نما در محدودهٔ بوم', (() => { const m = /scale\(([\d.]+)\)/.exec(fitT); const k = m ? +m[1] : 0; return k > 0.2 && k <= 1.5; })(), fitT.slice(0, 50));
await aroun.close();

/* ═══════════ مستأجر پارس: اگو مرکز + ۱۲ زیرمجموعه ═══════════ */
const pars = await login('pars', 'pars1234');
d = await snap(pars);
ok('پارس — اگو «هلدینگ پارس» در مرکز', (() => { const e = d.nodes.find(n => n.ego === 'true'); return !!e && e.texts.some(x => x.includes('هلدینگ پارس')) && Math.abs(e.cx - 800) < 2; })());
ok('پارس — ۱۲ زیرمجموعه روی حلقهٔ دور اگو', (() => {
  const e = d.nodes.find(n => n.ego === 'true');
  if (!e) return false;
  const subs = d.nodes.filter(n => n.ego !== 'true' && n.type === 'organization' && /پارس /.test(n.texts.join(' ')));
  return subs.length === 12 && subs.every(n => Math.hypot(n.cx - 800, n.cy - 380) > Math.hypot(e.cx - 800, e.cy - 380) + 80);
})(), `subs=${d.nodes.filter(n => /پارس /.test(n.texts.join(' '))).length}`);
ok('پارس — بدون خطای صفحه', !(pageErrors.get(pars) ?? []).length, (pageErrors.get(pars) ?? [])[0] ?? '');
await pars.close();

/* ═══════════ مستأجر دمو: اشخاص + عضویت + مسیر کهربایی ═══════════ */
const demo = await login('demo', '123456', '123456');
d = await snap(demo);
ok('دمو — گره‌های سازمان + شخص', d.nodes.some(n => n.type === 'organization') && d.nodes.some(n => n.type === 'person'), `n=${d.nodes.length}`);
ok('دمو — اشخاص در گراف (≥ ۱۰)', d.nodes.filter(n => n.type === 'person').length >= 10, `n=${d.nodes.filter(n => n.type === 'person').length}`);
ok('دمو — شمارندهٔ گره/پیوند با ارقام فارسی', /[۰-۹]/.test(d.counts), d.counts.trim());
/* ابزار مسیر: هلدینگ آریا → بانک */
await demo.evaluate(() => {
  const sels = [...document.querySelectorAll('.net-path-tool select')];
  const from = sels[0], to = sels[1];
  const o1 = [...from.options].find(o => (o.textContent ?? '').includes('هلدینگ آریا'));
  const o2 = [...to.options].find(o => /بانک/.test(o.textContent ?? ''));
  if (o1) { from.value = o1.value; from.dispatchEvent(new Event('change', { bubbles: true })); }
  if (o2) { to.value = o2.value; to.dispatchEvent(new Event('change', { bubbles: true })); }
});
await demo.evaluate(() => { [...document.querySelectorAll('.net-path-tool .net-btn')].find(b => (b.textContent ?? '').includes('یافتن مسیر'))?.click(); });
await new Promise(r => setTimeout(r, 3000));
const pathInfo = await demo.evaluate(() => ({
  msg: document.querySelector('.net-path-msg')?.textContent ?? '',
  amber: document.querySelectorAll('g[data-edge] .net-edge-path').length,
}));
ok('دمو — مسیر سازمانی یافت شد', pathInfo.msg.includes('مسیر سازمانی یافت شد'), pathInfo.msg.slice(0, 60));
ok('دمو — یال‌های کهربایی متحرک مسیر', pathInfo.amber >= 1, `n=${pathInfo.amber}`);

/* EN: مسیر ترجمه‌شده */
await demo.evaluate(() => { try { localStorage.setItem('srip_locale', 'en'); } catch {} });
await demo.reload({ waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 6500));
const enInfo = await demo.evaluate(() => ({
  dir: document.documentElement.dir,
  lang: document.documentElement.lang,
  title: document.querySelector('.net-graph-head h2')?.textContent ?? '',
  findBtn: [...document.querySelectorAll('.net-graph-toolbar .net-btn')].some(b => (b.textContent ?? '').includes('Find')),
  orphanBtn: [...document.querySelectorAll('.net-graph-toolbar .net-btn')].some(b => (b.textContent ?? '').includes('Entities without relationships')),
  placeholder: document.querySelector('.net-search')?.getAttribute('placeholder') ?? '',
  note: !!document.querySelector('.i18n-coverage-note'),
}));
ok('EN — dir=ltr lang=en', enInfo.dir === 'ltr' && enInfo.lang === 'en');
ok('EN — عنوان Relationship graph', /relationship graph/i.test(enInfo.title), enInfo.title);
ok('EN — دکمهٔ Find + Entities without relationships', enInfo.findBtn && enInfo.orphanBtn);
ok('EN — جستجو با placeholder انگلیسی', /search/i.test(enInfo.placeholder), enInfo.placeholder);
ok('EN — بدون یادداشت پوشش (مسیر ترجمه‌شده)', !enInfo.note);
await demo.evaluate(() => { try { localStorage.setItem('srip_locale', 'fa'); } catch {} });

/* موبایل ۳۶۰×۷۶۰ */
await demo.setViewport({ width: 360, height: 760 });
await new Promise(r => setTimeout(r, 1800));
const mob = await demo.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > 361,
  svg: !!document.querySelector('.net-graph-zone svg'),
  toolbarWrapped: !!document.querySelector('.net-graph-toolbar'),
}));
ok('موبایل — بدون سرریز افقی', !mob.overflow);
ok('موبایل — گراف و نوار ابزار حاضر', mob.svg && mob.toolbarWrapped);
ok('دمو — بدون خطای صفحه (کل سناریو)', !(pageErrors.get(demo) ?? []).length, (pageErrors.get(demo) ?? [])[0] ?? '');
await demo.close();

await browser.close();
console.log(`\n========== graph E2E: ${pass} PASS / ${fail} FAIL ==========`);
process.exit(fail ? 1 : 0);
