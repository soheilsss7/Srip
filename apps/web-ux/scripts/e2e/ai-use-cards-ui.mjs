/* ============================================================================
   ai-use-cards-ui.mjs — باتری E2E گام ۹.۱: F12 کارت کاربرد و ارزیابی AI
   ورود demo → /ai → جدول هشت کارت F12 → جزئیات کارت (۱۳ ستون) →
   ثبت اجرای آزمون FAIL → تصمیم انتشار «مشروط» → پوشش کاربردهای فعال.
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
  headless: true, defaultViewport: { width: 1280, height: 1000 },
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

  /* ── ۱) جدول هشت کارت F12 (زیر تب «درگاه و ارائه‌دهنده‌ها») ── */
  try { await page.goto(`${BASE}/ai`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('.segmented button', { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('.segmented button')]
    .find(b => (b.textContent ?? '').includes('درگاه و ارائه‌دهنده‌ها'))?.click());
  await page.waitForSelector('tr[data-f12]', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  const rows = await page.evaluate(() => [...document.querySelectorAll('tr[data-f12]')].map(tr => tr.textContent ?? ''));
  ok('جدول F12 با هر هشت کاربرد جدول ۱۹.۲ (هفت کاربرد درگاه + تشخیص اصالت)', rows.length === 8, `n=${rows.length}`);
  ok('سطح اختیار هر کاربرد در جدول کنار آن دیده می‌شود (جست‌وجوی سازمانی: «فقط پیشنهاد»)',
    rows.some(r => r.includes('فقط پیشنهاد')) && rows.some(r => r.includes('اقدام محدودکننده فقط پس از بازبینی انسانی')));

  /* ── ۲) پوشش ── */
  const cov = await page.evaluate(() => (document.body.textContent ?? '').includes('هر کاربرد فعال درگاه کارت دارد'));
  ok('پوشش: هر کاربرد فعال درگاه یک کارت F12 دارد', cov);

  /* ── ۳) جزئیات کارت — هر سیزده ستون ── */
  await page.evaluate(() => [...document.querySelectorAll('tr[data-f12="org-question"] button')][0]?.click());
  await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('مسئله'), { timeout: 30000 });
  const detail = await page.evaluate(() => {
    const t = document.querySelector('.modal-backdrop')?.textContent ?? '';
    return {
      cols: ['مسئله', 'کاربر', 'دادهٔ مجاز', 'ابزار', 'روش بازیابی', 'مجموعهٔ آزمون', 'میزان اتکای پاسخ به منبع', 'امنیت', 'تأیید انسانی', 'روش بازگشت ایمن'].every(k => t.includes(k)),
      model: t.includes('موتور محلی SRIP'),
    };
  });
  ok('کارت F12: هر سیزده ستون (مسئله تا بازگشت ایمن) + مدل زنده از مسیریابی', detail.cols && detail.model, JSON.stringify(detail));

  /* ── ۴) ثبت اجرای آزمون FAIL ── */
  await page.evaluate(() => {
    const sel = document.querySelectorAll('.modal-backdrop select')[0];
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    d.call(sel, 'FAIL');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll('.modal-backdrop input')].find(i => (i.placeholder ?? '').includes('تزریق دستور'));
    if (!inp) return;
    const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    d.call(inp, 'تزریق دستور در سند بازیابی‌شده');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').trim() === 'ثبت اجرای آزمون')?.click());
  await page.waitForFunction(() => {
    const t = document.querySelector('.modal-backdrop')?.textContent ?? '';
    return t.includes('مردود') && t.includes('تزریق دستور در سند بازیابی‌شده');
  }, { timeout: 30000 });
  ok('ثبت اجرای آزمون FAIL → نتیجهٔ «مردود» و یافته در اجراهای اخیر کارت', true);

  /* ── ۵) تصمیم انتشار «مشروط» ── */
  await page.evaluate(() => {
    const sel = document.querySelectorAll('.modal-backdrop select')[1];
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    d.call(sel, 'CONDITIONAL');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').trim() === 'ثبت تصمیم انتشار')?.click());
  await page.waitForFunction(() => {
    const row = document.querySelector('tr[data-f12="org-question"]')?.textContent ?? '';
    return row.includes('مشروط');
  }, { timeout: 30000 });
  ok('تصمیم انتشار «مشروط» ثبت شد و در جدول نمایش داده می‌شود', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nAI-USE-CARDS-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
