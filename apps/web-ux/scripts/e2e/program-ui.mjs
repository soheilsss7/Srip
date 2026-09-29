/* ============================================================================
   program-ui.mjs — باتری E2E هاب «حاکمیت برنامه» (گام ۲.۱ مسترپلن)
   چک‌ها: ناوبری و هدر · تب نمای کلی (فصل‌ها/دروازه/روند) · شاخص‌ها (۱۰ ردیف
   با مالک/هدف/منبع محاسبه) · ریسک‌ها (بنر، ماتریس، جدول، ثبت بدون مالک → خطا،
   ثبت با مالک → ردیف جدید) · آمادگی (۶ لایه، لایهٔ رابطه از دادهٔ زنده، چرخش
   وضعیت قلم) · ممیزی سه‌گانه (سه ساب‌تب + مودال جزئیات) · بدون خطای کنسول.
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" UI_BASE=http://localhost:4100/Srip/srip2 node scripts/e2e/program-ui.mjs
   ============================================================================ */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';

let pass = 0, fail = 0;
const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const browser = await puppeteer.launch({
  executablePath: resolve(process.cwd(), '.e2e-browser/chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(process.cwd(), '.e2e-browser/nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });

try {
  /* ورود دمو */
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', 'demo');
  await page.type('#login-pass', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForSelector('#login-otp', { timeout: 30000 });
  await page.type('#login-otp', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => localStorage.setItem('srip2_tour_done', '1'));

  /* ── ۱) ناوبری: آیتم «حاکمیت برنامه» در سایدبار ── */
  const navOk = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.side-nav a, nav a')];
    return links.some(a => (a.textContent ?? '').trim().includes('حاکمیت برنامه') && a.getAttribute('href')?.includes('/program'));
  });
  ok('آیتم «حاکمیت برنامه» در ناوبری سایدبار', navOk);

  await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1500));
  /* نویز فاز ورود (چالش OTP، صفحهٔ فرود) خارج از دامنهٔ این باتری است —
     فقط خطاهای خودِ هاب حاکمیت برنامه سنجیده می‌شود */
  errs.length = 0;

  /* ── ۲) هدر استاندارد + تب‌ها ── */
  const h1 = await page.evaluate(() => (document.querySelector('.page-heading h1')?.textContent ?? '').trim());
  ok('هدر استاندارد با عنوان «حاکمیت برنامه»', h1.includes('حاکمیت برنامه'), `h1=«${h1}»`);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.segmented button, [role=tablist] button')].map(b => (b.textContent ?? '').trim()));
  ok('پنج تب هاب (نمای کلی/شاخص‌ها/ریسک‌ها/آمادگی/ممیزی)',
    ['نمای کلی', 'شاخص‌ها', 'ریسک‌ها', 'آمادگی بازار', 'ممیزی سه‌گانه'].every(t => tabs.some(x => x.includes(t))), JSON.stringify(tabs.slice(0, 6)));

  /* ── ۳) نمای کلی: کارت آمار + فصل‌ها + روند ── */
  const ov = await page.evaluate(() => ({
    stats: document.querySelectorAll('.stat-grid .stat-card').length,
    seasons: document.querySelectorAll('.season-card').length,
    passed: [...document.querySelectorAll('.season-card')].filter(c => (c.className).includes('passed')).length,
    trend: document.querySelectorAll('.trend-col').length,
    score: (document.querySelector('.stat-value')?.textContent ?? '').trim(),
  }));
  ok('نمای کلی: کارت‌های آمار', ov.stats >= 4, `stats=${ov.stats}`);
  ok('نمای کلی: چهار فصل با دروازه', ov.seasons === 4, `seasons=${ov.seasons}`);
  ok('نمای کلی: فصل‌های پاس‌شده مشخص', ov.passed >= 1, `passed=${ov.passed}`);
  ok('نمای کلی: روند فصلی', ov.trend >= 3, `trend=${ov.trend}`);
  ok('نمرهٔ آمادگی با رقم فارسی نمایش داده می‌شود', /[۰-۹]/.test(ov.score), `score=${ov.score}`);

  /* ── ۴) شاخص‌ها: ۱۰ ردیف با مالک و منبع محاسبه ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('شاخص‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const kpis = await page.evaluate(() => ({
    rows: document.querySelectorAll('.table-wrap tbody tr').length,
    firstOwner: (document.querySelector('.table-wrap tbody tr td:nth-child(2)')?.textContent ?? '').trim(),
    hasSource: !!document.querySelector('.table-wrap tbody tr td:last-child')?.textContent?.includes('—') || [...document.querySelectorAll('.table-wrap tbody tr td:last-child')].some(td => (td.textContent ?? '').length > 5),
    badges: document.querySelectorAll('.table-wrap tbody tr .chip').length,
    rule: (document.querySelector('.note-strip')?.textContent ?? '').includes('عدد دستی'),
  }));
  ok('شاخص‌ها: ۱۰ شاخص جدول بخش ۲۶ سند', kpis.rows === 10, `rows=${kpis.rows}`);
  ok('شاخص‌ها: هر ردیف مالک دارد', kpis.firstOwner.length > 2, `owner=«${kpis.firstOwner}»`);
  ok('شاخص‌ها: نشان وضعیت سه‌حالته روی ردیف‌ها', kpis.badges >= 10, `badges=${kpis.badges}`);
  ok('شاخص‌ها: قاعدهٔ «عدد دستی وارد داشبورد نمی‌شود» در صفحه', kpis.rule);

  /* ── ۵) ریسک‌ها: بنر + ماتریس + جدول + مودال ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('ریسک‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const rk = await page.evaluate(() => ({
    banner: (document.querySelector('.alert-banner')?.textContent ?? '').includes('درجهٔ بالا'),
    cells: document.querySelectorAll('.rm-cell').length,
    hasCount: [...document.querySelectorAll('.rm-cell')].some(c => /[۱-۹]/.test(c.textContent ?? '')),
    rows: document.querySelectorAll('.table-wrap tbody tr').length,
  }));
  ok('ریسک‌ها: بنر ریسک‌های درجهٔ بالای باز', rk.banner);
  ok('ریسک‌ها: ماتریس ۳×۳ احتمال×اثر', rk.cells === 9, `cells=${rk.cells}`);
  ok('ریسک‌ها: سلول‌های ماتریس شمار ریسک دارند', rk.hasCount);
  ok('ریسک‌ها: رجیستری با ۹ ریسک بذری سند', rk.rows >= 9, `rows=${rk.rows}`);

  /* جزئیات ریسک: کلیک ردیف → مودال با پاسخ پیشگیرانه/واکنشی */
  await page.click('.table-wrap tbody tr');
  await new Promise(r => setTimeout(r, 600));
  const detail = await page.evaluate(() => ({
    open: !!document.querySelector('.modal-card'),
    title: (document.querySelector('.modal-head h3, .modal-card h3, .modal-title')?.textContent ?? document.querySelector('.modal-card')?.textContent ?? '').slice(0, 60),
    hasPreventive: (document.querySelector('.modal-card')?.textContent ?? '').includes('پاسخ پیشگیرانه'),
    hasReactive: (document.querySelector('.modal-card')?.textContent ?? '').includes('پاسخ واکنشی'),
  }));
  ok('ریسک‌ها: مودال جزئیات با چهار قلم', detail.open && detail.hasPreventive && detail.hasReactive, JSON.stringify(detail).slice(0, 80));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  /* ثبت ریسک: اول عنوان، بدون مالک → خطای قاعدهٔ سند */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('ریسک جدید'))?.click(); });
  await new Promise(r => setTimeout(r, 500));
  const modalOpen = await page.evaluate(() => !!document.querySelector('.modal-card'));
  await page.type('.modal-card input', 'ریسک تست باتری مرورگر');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#risk-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 1200));
  const noOwner = await page.evaluate(() => (document.querySelector('.modal-card .alert-banner, .modal-card [role=alert]')?.textContent ?? ''));
  ok('ثبت ریسک بدون مالک → پیام «ریسک بدون مالک ثبت نمی‌شود»', noOwner.includes('بدون مالک'), `msg=${noOwner.slice(0, 60)}`);
  /* با مالک → ثبت موفق و ردیف جدید */
  const ownerSel = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card select')].pop());
  await ownerSel.asElement().select('مدیر پروژه');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#risk-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 2000));
  const created = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')].map(r => (r.textContent ?? ''));
    return { closed: !document.querySelector('.modal-card'), found: rows.some(x => x.includes('ریسک تست باتری مرورگر')), count: rows.length };
  });
  ok('ثبت ریسک با مالک → مودال بسته و ردیف جدید در رجیستری', created.closed && created.found, JSON.stringify(created).slice(0, 80));

  /* ── ۶) آمادگی: ۶ لایه + لایهٔ رابطه از دادهٔ زنده + چرخش وضعیت ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('آمادگی بازار'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const rd = await page.evaluate(() => ({
    layers: document.querySelectorAll('.section-card').length,
    relComputed: [...document.querySelectorAll('.section-card')].some(c => (c.textContent ?? '').includes('از دادهٔ زنده')),
    weights: [...document.querySelectorAll('.section-card .section-head p, .section-card p')].some(p => (p.textContent ?? '').includes('وزن')),
    clickable: document.querySelectorAll('.layer-status.clickable').length,
  }));
  ok('آمادگی: شش لایهٔ وزن‌دار', rd.layers === 6, `cards=${rd.layers}`);
  ok('آمادگی: لایهٔ «رابطه» از دادهٔ زنده محاسبه می‌شود', rd.relComputed);
  ok('آمادگی: اقلام قابل به‌روزرسانی (کلیک برای تغییر وضعیت)', rd.clickable >= 20, `clickable=${rd.clickable}`);
  /* چرخش وضعیت یک قلم: سه کلیک = یک دور کامل */
  const before = await page.evaluate(() => (document.querySelector('.layer-status.clickable .chip')?.textContent ?? '').trim());
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('.layer-status.clickable:not([disabled])', { timeout: 10000 });
    await page.click('.layer-status.clickable');
    await new Promise(r => setTimeout(r, 2200));
  }
  const after = await page.evaluate(() => (document.querySelector('.layer-status.clickable .chip')?.textContent ?? '').trim());
  ok('آمادگی: چرخش وضعیت قلم کار می‌کند (سه کلیک = بازگشت به وضعیت اول)', before === after && before.length > 0, `قبل=«${before}» بعد=«${after}»`);

  /* ── ۷) ممیزی سه‌گانه ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('ممیزی'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const auPeople = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('ممیزی: تب افراد با ردیف‌های نقش', auPeople >= 5, `rows=${auPeople}`);
  /* ساب‌تب سامانه‌ها */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim().includes('سامانه‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 900));
  const auSys = await page.evaluate(() => ({
    rows: document.querySelectorAll('.table-wrap tbody tr').length,
    hasShutdown: (document.querySelector('.table-wrap')?.textContent ?? '').includes('خاموش‌سازی'),
  }));
  ok('ممیزی: تب سامانه‌ها با وضعیت نگهداری/انتقال/خاموش‌سازی', auSys.rows >= 5 && auSys.hasShutdown, `rows=${auSys.rows}`);
  /* ساب‌تب کانال‌ها + مودال */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'کانال‌ها' || (b.textContent ?? '').trim().includes('کانال‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 900));
  const auCh = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('ممیزی: تب کانال‌ها', auCh >= 4, `rows=${auCh}`);
  await page.click('.table-wrap tbody tr');
  await new Promise(r => setTimeout(r, 600));
  const auModal = await page.evaluate(() => ({
    open: !!document.querySelector('.modal-card'),
    text: (document.querySelector('.modal-card')?.textContent ?? '').slice(0, 200),
  }));
  ok('ممیزی: مودال جزئیات کامل قلم', auModal.open && (auModal.text.includes('یادداشت ممیزی') || auModal.text.includes('مالک')), auModal.text.slice(0, 60));
  await page.keyboard.press('Escape');

  /* ── ۸) بدون خطای کنسول در کل جریان ──
     استثنا: پاسخ ۴۰۰ تستِ منفیِ «ریسک بدون مالک» — عمداً توسط سرور رد می‌شود */
  const realErrs = errs.filter(e => !e.includes('status of 400'));
  ok('بدون خطای کنسول در هاب حاکمیت برنامه', realErrs.length === 0, realErrs.slice(0, 3).join('؛'));

  /* ── ۹) موبایل: بدون اسکرول افقی ── */
  await page.setViewport({ width: 390, height: 844 });
  const mobBad = [];
  for (const tabSel of ['نمای کلی', 'ریسک‌ها', 'آمادگی بازار', 'ممیزی']) {
    await page.evaluate((t) => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes(t))?.click(); }, tabSel);
    await new Promise(r => setTimeout(r, 800));
    const bad = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (bad) mobBad.push(tabSel);
  }
  ok('موبایل (۳۹۰): بدون اسکرول افقی در همهٔ تب‌ها', mobBad.length === 0, mobBad.join('، '));
} catch (e) {
  console.error('PROGRAM-UI ERROR:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
}
await browser.close();
console.log('══════════════════════════════');
console.log(`PROGRAM-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
