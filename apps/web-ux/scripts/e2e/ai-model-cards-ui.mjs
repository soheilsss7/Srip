/* ============================================================================
   ai-model-cards-ui.mjs — باتری E2E گام ۹.۲: دفتر ثبت ریسک و انتشار AI (ماژول پلتفرمی)
   ورود demo → /ai → شناسنامهٔ مدل متصل به ارائه‌دهنده → ویرایش محدودیت‌ها →
   /program → ریسک‌های AI با چیپ AI → جزئیات هشت‌ستونی → تصمیم انتشار/توقف.
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

  /* ── ۱) شناسنامهٔ مدل در /ai ── */
  try { await page.goto(`${BASE}/ai`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('.segmented button', { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('.segmented button')]
    .find(b => (b.textContent ?? '').includes('درگاه و ارائه‌دهنده‌ها'))?.click());
  await page.waitForSelector('tr[data-amc]', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1000));
  const cards = await page.evaluate(() => [...document.querySelectorAll('tr[data-amc]')].map(tr => tr.textContent ?? ''));
  ok('شناسنامهٔ مدل برای هر ارائه‌دهندهٔ سازمان (سه کارت) با مدل/نسخه/منشأ/محدودیت‌ها',
    cards.length === 3 && cards.every(c => c.includes('demo-v6') && (c.includes('محدودیت') || c.length > 60)),
    `n=${cards.length}`);
  ok('اتصال زنده به ارائه‌دهنده — نام و وضعیت (موتور محلی SRIP + فعال)',
    cards.some(c => c.includes('موتور محلی SRIP') && c.includes('فعال')));

  /* ── ۲) ویرایش شناسنامه ── */
  await page.evaluate(() => [...document.querySelectorAll('tr[data-amc] button')][0]?.click());
  await page.waitForSelector('.modal-backdrop textarea', { timeout: 30000 });
  await page.evaluate(() => {
    const ta = document.querySelector('.modal-backdrop textarea');
    const d = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    d.call(ta, 'محدودیت تازهٔ آزمون ۹.۲');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ شناسنامهٔ مدل'))?.click());
  await page.waitForFunction(() => (document.body.textContent ?? '').includes('محدودیت تازهٔ آزمون ۹.۲'), { timeout: 30000 });
  ok('ویرایش محدودیت‌های شناسنامهٔ مدل ذخیره و در جدول نمایش داده شد', true);

  /* ── ۳) ریسک‌های AI در /program ── */
  try { await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('.segmented button, [role=tab], .chip-row button', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  /* رفتن به تب ریسک‌ها */
  const wentRisk = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a')].find(b => (b.textContent ?? '').trim() === 'ریسک‌ها' || (b.textContent ?? '').includes('ریجستری ریسک'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (wentRisk) await new Promise(r => setTimeout(r, 1500));
  await page.waitForFunction(() => (document.body.textContent ?? '').includes('ریجستری ریسک'), { timeout: 30000 });
  const aiChips = await page.evaluate(() => [...document.querySelectorAll('table .chip.purple')].filter(c => (c.textContent ?? '').trim() === 'AI').length);
  ok('ریجستری ریسک: ریسک‌های AI با چیپ «AI» مشخص شده‌اند', aiChips >= 2, `n=${aiChips}`);

  /* ── ۴) جزئیات هشت‌ستونی + تصمیم/توقف ── */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('table tbody tr')].find(tr => (tr.textContent ?? '').includes('تزریق دستور'));
    row?.click();
  });
  await page.waitForFunction(() => {
    const t = document.querySelector('.modal-backdrop')?.textContent ?? '';
    return t.includes('ستون‌های AI') && t.includes('مورد استفاده') && t.includes('یافته');
  }, { timeout: 30000 });
  const detail = await page.evaluate(() => {
    const t = document.querySelector('.modal-backdrop')?.textContent ?? '';
    return {
      cols: ['مورد استفاده', 'آزمون', 'یافته', 'نسخه', 'محدودیت', 'بازبینی', 'تصمیم انتشار', 'توقف'].every(k => t.includes(k)),
      useCase: t.includes('جست‌وجوی سازمانی'),
    };
  });
  ok('جزئیات ریسک AI: هر هشت ستون (مورد استفاده تا توقف) + کاربرد متصل', detail.cols && detail.useCase, JSON.stringify(detail));

  /* ── ۵) تغییر تصمیم انتشار + توقف ── */
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.modal-backdrop select')][0];
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    d.call(sel, 'REJECTED');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const cb = document.querySelector('.modal-backdrop input[type=checkbox]');
    if (!cb || cb.checked) return;
    cb.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ ستون‌های AI'))?.click());
  await page.waitForFunction(() => {
    const t = document.querySelector('.modal-backdrop')?.textContent ?? '';
    return t.includes('کاربرد متوقف شده است');
  }, { timeout: 30000 });
  ok('تصمیم انتشار «رد» + پرچم توقف ثبت شد و در جزئیات نمایش داده می‌شود', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nAI-MODEL-CARDS-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
