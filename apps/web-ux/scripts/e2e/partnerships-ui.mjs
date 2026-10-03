/* ============================================================================
   partnerships-ui.mjs — باتری E2E ماژول مشارکت (گام ۲.۲ مسترپلن)
   چک‌ها: ناوبری و هدر · کارت‌های آمار (تفاهم‌نامهٔ فعال/هدف ۲۵) · خط لولهٔ
   چهارسطحی مذاکره/تفاهم‌نامه/فعال/پایان با شمار مرحله‌ای · کارت شریک با نوع
   همکاری/مالک/قرارداد · اتصال به رابطه و فرصت · ثبت مشارکت بدون مالک → خطا ·
   ثبت معتبر → کارت در ستون مذاکره · فعال‌سازی بدون قرارداد → خطای قاعدهٔ سند ·
   پیوست قرارداد + فعال‌سازی موفق · بدون خطای کنسول · موبایل بدون اسکرول افقی.
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" UI_BASE=http://localhost:4100/Srip/srip2 node scripts/e2e/partnerships-ui.mjs
   ============================================================================ */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

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

  /* ── ۱) ناوبری ── */
  const navOk = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.side-nav a, nav a')];
    return links.some(a => (a.textContent ?? '').trim().includes('مشارکت‌ها') && a.getAttribute('href')?.includes('/partnerships'));
  });
  ok('آیتم «مشارکت‌ها» در ناوبری سایدبار', navOk);

  await page.goto(`${BASE}/partnerships`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1800));
  errs.length = 0; /* نویز فاز ورود (OTP/فرود) خارج از دامنه است */

  /* ── ۲) هدر + کارت‌های آمار + قاعده ── */
  const h1 = await page.evaluate(() => (document.querySelector('.page-heading h1') ?? document.querySelector('h1')?.textContent ?? '').textContent ?? document.querySelector('h1')?.textContent ?? '');
  ok('هدر استاندارد با عنوان «مشارکت‌ها»', (h1 ?? '').includes('مشارکت'), `h1=«${h1}»`);
  const stats = await page.evaluate(() => [...document.querySelectorAll('.stat-grid .stat-card')].map(c => (c.textContent ?? '').trim()));
  ok('چهار کارت آمار (تفاهم‌نامهٔ فعال/مذاکره/بازبینی/اتصال)', stats.length >= 4, `n=${stats.length}`);
  ok('کارت هدف: «X از ۲۵» با رقم فارسی', stats.some(s => /[۰-۹]+\s*از\s*[۰-۹]+/.test(s ?? '')) && stats.some(s => (s ?? '').includes('۲۵')), stats[0]?.slice(0, 60));
  const ruleTxt = await page.evaluate(() => (document.querySelector('.note-strip')?.textContent ?? ''));
  ok('قاعدهٔ سند در صفحه: فعال‌سازی بدون قرارداد ممنوع', ruleTxt.includes('بدون قرارداد'));

  /* ── ۳) خط لولهٔ چهارسطحی ── */
  const board = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('.pp-col')];
    return {
      n: cols.length,
      stages: cols.map(c => (c.querySelector('.pp-col-title')?.textContent ?? '').trim()),
      counts: cols.map(c => c.querySelectorAll('.pp-card').length),
      cards: document.querySelectorAll('.pp-card').length,
      firstCard: (document.querySelector('.pp-card')?.textContent ?? '').slice(0, 120),
    };
  });
  ok('خط لوله: چهار ستون مذاکره/تفاهم‌نامه/فعال/پایان', board.n === 4
    && ['مذاکره', 'تفاهم‌نامه', 'فعال', 'پایان'].every(x => board.stages.some(s => s.includes(x))), JSON.stringify(board.stages));
  ok('ستون‌ها شمار رکورد دارند و مجموع = کل کارت‌ها', board.counts.reduce((a, b) => a + b, 0) === board.cards && board.cards >= 9, JSON.stringify(board.counts));
  ok('کارت شریک: نام + نوع همکاری + مالک + بازبینی', /مالک/.test(board.firstCard) && /بازبینی/.test(board.firstCard), board.firstCard.slice(0, 80));

  /* ── ۴) اتصال به رابطه و فرصت ── */
  const links = await page.evaluate(() => [...document.querySelectorAll('.pp-card .pp-link')].map(a => a.getAttribute('href')));
  ok('کارت‌های متصل: پیوند «رابطه» به /relationships/:id', links.some(h => h && h.startsWith('/relationships/r-')), JSON.stringify(links.slice(0, 4)));
  ok('کارت‌های متصل: پیوند «فرصت» به /opportunities', links.some(h => h === '/opportunities'));

  /* ── ۵) مودال جزئیات ── */
  await page.click('.pp-card');
  await new Promise(r => setTimeout(r, 800));
  const detail = await page.evaluate(() => ({
    open: !!document.querySelector('.modal-card'),
    text: (document.querySelector('.modal-card')?.textContent ?? ''),
    stageChips: [...document.querySelectorAll('.pp-stage-chip')].map(b => (b.textContent ?? '').trim()),
  }));
  ok('مودال جزئیات با تعهدات دوطرفه', detail.open && detail.text.includes('تعهدات ما') && detail.text.includes('تعهدات شریک'));
  ok('چهار چیپ مرحله برای جابه‌جایی', detail.stageChips.length === 4, JSON.stringify(detail.stageChips));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  /* ── ۶) ثبت مشارکت: بدون مالک → خطا؛ با مالک → کارت در مذاکره ── */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('مشارکت جدید'))?.click(); });
  await new Promise(r => setTimeout(r, 1800)); /* گزینه‌ها بارگذاری می‌شوند */
  const partnerSel = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card select')][0]);
  await partnerSel.asElement().select('org-11');
  const typeSel = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card select')][1]);
  await typeSel.asElement().select('پژوهشی');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#partnership-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 1200));
  const noOwner = await page.evaluate(() => (document.querySelector('.modal-card .alert-banner, .modal-card [role=alert]')?.textContent ?? ''));
  ok('ثبت بدون مالک → پیام «مشارکت بدون مالک ثبت نمی‌شود»', noOwner.includes('بدون مالک'), noOwner.slice(0, 70));
  const ownerSel = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card select')][2]);
  await ownerSel.asElement().select('مدیر پروژه');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#partnership-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 2000));
  const created = await page.evaluate(() => {
    const col = document.querySelector('.pp-col[data-stage=NEGOTIATION]');
    return { closed: !document.querySelector('.modal-card'), inNeg: col ? [...col.querySelectorAll('.pp-name')].some(n => (n.textContent ?? '').includes('بورس')) : false };
  });
  ok('ثبت با مالک → مودال بسته و کارت «سازمان بورس» در ستون مذاکره', created.closed && created.inNeg, JSON.stringify(created));

  /* ── ۷) قاعدهٔ فعال‌سازی: بدون قرارداد → خطا؛ با قرارداد → فعال ── */
  await page.evaluate(() => { [...document.querySelectorAll('.pp-col[data-stage=NEGOTIATION] .pp-card')].find(c => (c.textContent ?? '').includes('بورس'))?.click(); });
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { [...document.querySelectorAll('.pp-stage-chip')].find(b => (b.textContent ?? '').includes('فعال'))?.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const actErr = await page.evaluate(() => (document.querySelector('.modal-card .alert-banner, .modal-card [role=alert]')?.textContent ?? ''));
  ok('فعال‌سازی بدون قرارداد → خطای قاعدهٔ سند (F15)', actErr.includes('بدون قرارداد') || actErr.includes('قرارداد'), actErr.slice(0, 80));
  await page.type('.pp-contract-form input', 'تفاهم‌نامهٔ پژوهشی بورس');
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => { [...document.querySelectorAll('.pp-contract-form button')].find(b => (b.textContent ?? '').includes('پیوست قرارداد'))?.click(); });
  await new Promise(r => setTimeout(r, 1800));
  await page.evaluate(() => { [...document.querySelectorAll('.pp-stage-chip')].find(b => (b.textContent ?? '').trim() === 'فعال')?.click(); });
  await new Promise(r => setTimeout(r, 2200));
  const activated = await page.evaluate(() => {
    const col = document.querySelector('.pp-col[data-stage=ACTIVE]');
    return { open: !!document.querySelector('.modal-card'), inActive: col ? [...col.querySelectorAll('.pp-name')].some(n => (n.textContent ?? '').includes('بورس')) : false };
  });
  ok('پیوست قرارداد + فعال‌سازی → کارت به ستون «فعال» می‌رود', activated.inActive, JSON.stringify(activated));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  /* ── ۸) بدون خطای کنسول (پاسخ ۴۰۰ تست منفیِ قاعده عمدی است) ── */
  const realErrs = errs.filter(e => !e.includes('status of 400'));
  ok('بدون خطای کنسول در ماژول مشارکت', realErrs.length === 0, realErrs.slice(0, 3).join('؛'));

  /* ── ۹) موبایل: بدون اسکرول افقی ── */
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 900));
  const mobBad = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok('موبایل (۳۹۰): بدون اسکرول افقی', !mobBad);
} catch (e) {
  console.error('PARTNERSHIPS-UI ERROR:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
}
await browser.close();
console.log('══════════════════════════════');
console.log(`PARTNERSHIPS-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
