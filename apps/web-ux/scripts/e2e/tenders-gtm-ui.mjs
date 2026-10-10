/* ============================================================================
   tenders-gtm-ui.mjs — باتری E2E گام ۱۰.۲: F09 فرصت مناقصه + F16 کارت ورود
   ورود demo → /opportunities → مناقصات (جدول + قواعد نتیجه/درس‌آموخته) →
   کارت‌های ورود به بازار (وضعیت DD زنده + گرهٔ تصمیم GO).
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

const browser = await puppeteer.launch({
  executablePath: resolve(E2E_DIR, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E_DIR, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 1050 },
});
const page = await browser.newPage();

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
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => localStorage.setItem('srip2_tour_done', '1'));

  /* ── ۱) بخش‌های F09/F16 در فرصت‌ها ── */
  try { await page.goto(`${BASE}/opportunities`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('section[data-f09]', { timeout: 60000 });
  const hasF16 = await page.evaluate(() => !!document.querySelector('section[data-f16]'));
  ok('صفحهٔ فرصت‌ها: بخش F09 (مناقصات) و F16 (کارت‌های ورود به بازار) هر دو حاضرند', hasF16);

  /* ── ۲) جدول مناقصات ── */
  await page.waitForFunction(() => (document.querySelector('section[data-f09]')?.textContent ?? '').includes('برد'), { timeout: 30000 });
  const tnd = await page.evaluate(() => {
    const s = document.querySelector('section[data-f09]');
    const t = s?.textContent ?? '';
    return {
      count: s?.querySelectorAll('tbody tr').length,
      won: t.includes('برد'),
      lesson: t.includes('درس‌آموخته'),
      submitCol: t.includes('وضعیت ارسال'),
      decisionCol: t.includes('تصمیم شرکت'),
    };
  });
  ok('F09: سه مناقصهٔ بذر؛ ستون‌های تصمیم شرکت/وضعیت ارسال/نتیجه + چیپ درس‌آموختهٔ مناقصهٔ برده',
    tnd.count === 3 && tnd.won && tnd.lesson && tnd.submitCol && tnd.decisionCol, JSON.stringify(tnd));

  /* ── ۳) قاعدهٔ نتیجه: پیش از ارسال → ۴۰۰ ── */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f09] tbody tr')].find(tr => (tr.textContent ?? '').includes('شهرداری'));
    [...(row?.querySelectorAll('button') ?? [])].pop()?.click();
  });
  await page.waitForSelector('.modal-backdrop form#tnd-form', { timeout: 30000 });
  /* نتیجه → برد (بدون ارسال) و ذخیره */
  await page.evaluate(() => {
    const sels = document.querySelectorAll('.modal-backdrop form#tnd-form select');
    const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set(sels[3], 'WON'); /* مسئول/تصمیم/ارسال/نتیجه → چهارمین سِلکت */
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ مناقصه'))?.click());
  await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('نتیجه فقط پس از ارسال'), { timeout: 30000 });
  ok('F09: قاعدهٔ نتیجه — برد پیش از «ارسال شد» → پیام خطای سرور در فرم', true);

  /* ── ۴) ارسال + نتیجه بدون درس → ۴۰۰؛ با درس → ۲۰۰ ── */
  await page.evaluate(() => {
    const sels = document.querySelectorAll('.modal-backdrop form#tnd-form select');
    const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set(sels[2], 'SUBMITTED'); /* وضعیت ارسال = سومین سِلکت */
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ مناقصه'))?.click());
  await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('درس‌آموخته'), { timeout: 30000 });
  ok('F09: ثبت برد بدون درس‌آموخته → خطای «نیازمند درس‌آموخته»', true);
  /* پر کردن درس و ذخیره */
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll('.modal-backdrop form#tnd-form input')].pop();
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, 'پیش از ارسال جلسهٔ شفاف‌سازی با شهرداری بگذاریم.');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ مناقصه'))?.click());
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('section[data-f09] tbody tr');
    return [...rows].some(tr => (tr.textContent ?? '').includes('شهرداری') && (tr.textContent ?? '').includes('برد'));
  }, { timeout: 30000 });
  ok('F09: برد با درس‌آموخته ثبت شد و در جدول ظاهر شد (حلقهٔ یادگیری)', true);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 600));

  /* ── ۵) F16: کارت‌ها با وضعیت DD زنده ── */
  await page.waitForSelector('section[data-f16] tbody tr', { timeout: 30000 });
  const gtm = await page.evaluate(() => {
    const t = document.querySelector('section[data-f16]')?.textContent ?? '';
    return {
      count: document.querySelectorAll('section[data-f16] tbody tr').length,
      liveDD: t.includes('تصویب‌شده — ۱۲/۱۲ محور') && t.includes('در بررسی — ۱/۱۲ محور'),
      go: t.includes('ورود (GO)'),
      pilot: t.includes('اجرای آزمایشی'),
    };
  });
  ok('F16: دو کارت بذر با وضعیت DD زنده (تصویب‌شده ۱۲/۱۲ و در بررسی ۱/۱۲) و تصمیم‌ها',
    gtm.count === 2 && gtm.liveDD && gtm.go && gtm.pilot, JSON.stringify(gtm));

  /* ── ۶) گرهٔ GO: کارت جدید بدون DD → ۴۰۰؛ با DD تصویب‌شده → ۲۰۱ ── */
  await page.evaluate(() => [...document.querySelectorAll('section[data-f16] button')].find(b => (b.textContent ?? '').includes('کارت ورود جدید'))?.click());
  await page.waitForSelector('.modal-backdrop form#gtm-form', { timeout: 30000 });
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#gtm-form');
    const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const inputs = form.querySelectorAll('input');
    set(inputs[0], 'داشبورد تحلیلی بورس');
    /* تصمیم → GO بدون DD */
    const sels = form.querySelectorAll('select');
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sels[1], 'GO');
    sels[1].dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت ورود'))?.click());
  await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('تصمیم ورود (GO) نیازمند'), { timeout: 30000 });
  ok('F16: گرهٔ تصمیم — GO بدون پروندهٔ DD متصل → پیام خطای سرور', true);
  /* اتصال dd-1 و ذخیره */
  await page.evaluate(() => {
    const sels = document.querySelectorAll('.modal-backdrop form#gtm-form select');
    const ddSel = sels[0];
    const opt = [...ddSel.options].find(o => (o.textContent ?? '').includes('صندوق سرمایه‌گذاری امید'));
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(ddSel, opt?.value ?? '');
    ddSel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت ورود'))?.click());
  await page.waitForFunction(() => (document.querySelector('section[data-f16]')?.textContent ?? '').includes('داشبورد تحلیلی بورس'), { timeout: 30000 });
  ok('F16: کارت متصل به DD تصویب‌شده با تصمیم GO ثبت شد و در جدول ظاهر شد', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nTENDERS-GTM-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
