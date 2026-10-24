/* ============================================================================
   content-assistant-ui.mjs — باتری E2E گام ۷.۵: دستیار تولید محتوا + کارت F08
   ورود demo → /calendar → بخش رسانه → پنل دستیار → انتخاب ۲ سند →
   پیشنهاد پیش‌نویس منبع‌دار → ثبت با تأیید → مودال → کارت F08 → ذخیره.
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

const browser = await puppeteer.launch({
  executablePath: resolve(E2E_DIR, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E_DIR, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 950 },
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

  /* ── پنل دستیار در تقویم/رسانه ── */
  try { await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.ai-content-assistant', { timeout: 30000 });
  ok('پنل «دستیار تولید محتوا» در بخش رسانه', true);
  const docCount = await page.evaluate(() => document.querySelectorAll('.ai-content-assistant input[type=checkbox]').length);
  ok('اسناد مجاز برای انتخاب بستهٔ منابع فهرست شده‌اند', docCount >= 2, `docs=${docCount}`);
  await page.evaluate(() => {
    document.querySelectorAll('.ai-content-assistant input[type=checkbox]').forEach((c, i) => { if (i < 2) c.click(); });
  });
  const disabledBefore = await page.evaluate(() => [...document.querySelectorAll('.ai-content-assistant button')].find(b => (b.textContent ?? '').includes('پیشنهاد پیش‌نویس منبع‌دار'))?.disabled);
  ok('با انتخاب سند، دکمهٔ پیشنهاد فعال شد', disabledBefore === false);
  await page.evaluate(() => [...document.querySelectorAll('.ai-content-assistant button')].find(b => (b.textContent ?? '').includes('پیشنهاد پیش‌نویس منبع‌دار'))?.click());
  await page.waitForSelector('.ai-content-assistant textarea[aria-label="متن پیش‌نویس"]', { timeout: 30000 });
  const draft = await page.evaluate(() => {
    const t = document.querySelector('.ai-content-assistant')?.textContent ?? '';
    const body = document.querySelector('.ai-content-assistant textarea[aria-label="متن پیش‌نویس"]')?.value ?? '';
    return { title: !!document.querySelector('.ai-content-assistant input[aria-label="عنوان پیشنهادی"]')?.value,
      cited: body.includes('[۱]') && body.includes('افشای هوش مصنوعی'),
      model: t.includes('مدل'), aiShare: t.includes('با کمک هوش مصنوعی'), approve: t.includes('ثبت پیش‌نویس با تأیید من') };
  });
  ok('پیش‌نویس منبع‌دار (ارجاع [۱] + افشای AI) + فرادادهٔ F08',
    draft.title && draft.cited && draft.model && draft.aiShare && draft.approve, JSON.stringify(draft));

  /* ثبت با تأیید */
  const titleBefore = await page.evaluate(() => document.querySelector('.ai-content-assistant input[aria-label="عنوان پیشنهادی"]')?.value ?? '');
  await page.evaluate(() => [...document.querySelectorAll('.ai-content-assistant button')].find(b => (b.textContent ?? '').includes('ثبت پیش‌نویس با تأیید من'))?.click());
  await page.waitForFunction(() => (document.querySelector('.ai-content-assistant')?.textContent ?? '').includes('پیشنهاد پیش‌نویس منبع‌دار') && !document.querySelector('.ai-content-assistant textarea'), { timeout: 30000 });
  await page.waitForFunction((t) => (document.querySelector('.cnt-list')?.textContent ?? '').includes(t), { timeout: 30000 }, titleBefore);
  ok('پیش‌نویس ثبت‌شده در فهرست خروجی‌ها ظاهر شد', true);

  /* مودال جزئیات: کارت F08 */
  await page.evaluate((t) => [...document.querySelectorAll('.cnt-list .cnt-row')].find(r => (r.textContent ?? '').includes(t))?.click(), titleBefore);
  await page.waitForSelector('.cnt-f08', { timeout: 30000 });
  ok('کارت «تولید و کنترل محتوای هوش مصنوعی (F08)» در جزئیات', true);
  const f08View = await page.evaluate(() => {
    const t = document.querySelector('.cnt-f08')?.textContent ?? '';
    return { ai: t.includes('تولید با کمک هوش مصنوعی'), model: t.includes('مدل'), c2pa: t.includes('C2PA'), edit: t.includes('ویرایش کارت F08') };
  });
  ok('نمای کارت: تولید AI + مدل + وضعیت C2PA + دکمهٔ ویرایش',
    f08View.ai && f08View.model && f08View.c2pa && f08View.edit, JSON.stringify(f08View));

  /* ویرایش کارت F08 و ذخیره */
  await page.evaluate(() => [...document.querySelectorAll('.cnt-f08 button')].find(b => (b.textContent ?? '').includes('ویرایش کارت F08'))?.click());
  await page.waitForSelector('.cnt-f08 input[aria-label="راستی‌آزما"]', { timeout: 30000 });
  await page.evaluate(() => {
    const set = (sel, v) => { const el = document.querySelector(sel); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set; d.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('.cnt-f08 input[aria-label="راستی‌آزما"]', 'راستی‌آزما محمدی');
    set('.cnt-f08 input[aria-label="حقوق استفاده"]', 'استفادهٔ داخلی');
  });
  await page.evaluate(() => [...document.querySelectorAll('.cnt-f08 button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت F08'))?.click());
  await page.waitForFunction(() => (document.querySelector('.cnt-f08')?.textContent ?? '').includes('راستی‌آزما محمدی') && !document.querySelector('.cnt-f08 input[aria-label="راستی‌آزما"]'), { timeout: 30000 });
  ok('ذخیرهٔ کارت F08: راستی‌آزما و حقوق استفاده در نمای کارت', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nCONTENT-ASSISTANT-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
