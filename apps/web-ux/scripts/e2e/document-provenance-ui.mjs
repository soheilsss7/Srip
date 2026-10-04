/* ============================================================================
   document-provenance-ui.mjs — باتری E2E گام ۸.۳: اصالت داده و منشأ محتوا
   ورود demo → /documents/files → اثرانگشت SHA-256 سند → زنجیرهٔ منشأ →
   تغییر طبقه‌بندی (نسخهٔ ۲) → زنجیرهٔ دوم → بارگذاری فایل واقعی با اثرانگشت.
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
const TMP_PDF = '/tmp/e2e-83-sample.pdf';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

writeFileSync(TMP_PDF, Buffer.from('%PDF-1.4\n% E2E sample document for step 8.3 — provenance chain\n%%EOF\n', 'utf8'));

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

  /* ── ۱) فهرست اسناد با اثرانگشت ── */
  try { await page.goto(`${BASE}/documents/files`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.panel.compact', { timeout: 30000 });
  const fpCount = await page.evaluate(() => [...document.querySelectorAll('.panel.compact small')].filter(s => (s.textContent ?? '').includes('SHA-256:')).length);
  ok('هر سند اثرانگشت SHA-256 خود را نشان می‌دهد', fpCount >= 4, `count=${fpCount}`);

  /* ── ۲) زنجیرهٔ منشأ سند seed ── */
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('منشأ و مسیر تغییر'))?.click());
  await page.waitForFunction(() => (document.querySelector('.modal, [role=dialog]')?.textContent ?? document.body.textContent).includes('بارگذاری اولیه'), { timeout: 30000 });
  const chain1 = await page.evaluate(() => {
    const t = document.body.textContent ?? '';
    return { uploaded: t.includes('بارگذاری اولیهٔ سند در مخزن'), ok: t.includes('زنجیره سالم'), v1: t.includes('نسخهٔ 1') };
  });
  ok('زنجیرهٔ منشأ: حلقهٔ «بارگذاری اولیه» + نشان «زنجیره سالم»',
    chain1.uploaded && chain1.ok && chain1.v1, JSON.stringify(chain1));
  const fpBefore = await page.evaluate(() => (document.body.textContent.match(/🔒 SHA-256: ([0-9a-f]{20})/) ?? [])[1] ?? '');

  /* ── ۳) تغییر طبقه‌بندی → نسخهٔ ۲ ── */
  await page.evaluate(() => document.querySelector('.modal-close, [aria-label=بستن]')?.click() ?? [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'انصراف')?.click());
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.panel.compact select')][0];
    const next = sel.value === 'RESTRICTED' ? 'CONFIDENTIAL' : 'RESTRICTED'; /* مقصدی متفاوت از مقدار فعلی */
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    d.call(sel, next);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => /نسخهٔ \d+ در زنجیرهٔ منشأ ثبت شد/.test(document.body.textContent ?? ''), { timeout: 30000 });
  ok('تغییر طبقه‌بندی → ثبت نسخهٔ تازه در زنجیرهٔ منشأ (پیام تأیید)', true);

  /* ── ۴) زنجیرهٔ دوحلقه‌ای ── */
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('منشأ و مسیر تغییر'))?.click());
  await page.waitForFunction(() => {
    const t = document.body.textContent ?? '';
    return t.includes('بارگذاری اولیه') && t.includes('تغییر طبقه‌بندی') && t.includes('زنجیره سالم');
  }, { timeout: 30000 });
  ok('زنجیرهٔ کامل: حلقهٔ «بارگذاری اولیه» + حلقهٔ «تغییر طبقه‌بندی» + سلامت زنجیره', true);
  const fpAfter = await page.evaluate(() => (document.body.textContent.match(/🔒 SHA-256: ([0-9a-f]{20})/) ?? [])[1] ?? '');
  ok('اثرانگشت پس از تغییر طبقه‌بندی عوض شد (منشأ تغییرپذیر در زنجیره ثبت می‌شود)', !!fpBefore && !!fpAfter && fpBefore !== fpAfter, `${fpBefore} → ${fpAfter}`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'انصراف')?.click());
  await new Promise(r => setTimeout(r, 500));

  /* ── ۵) بارگذاری فایل واقعی → اثرانگشت هنگام بارگذاری ── */
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'بارگذاری سند')?.click());
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(TMP_PDF);
  await page.evaluate(() => {
    const sel = document.querySelector('.entity-form select');
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    d.call(sel, 'CONFIDENTIAL');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'بارگذاری' && !b.disabled)?.click());
  await page.waitForFunction(() => (document.body.textContent ?? '').includes('اثرانگشت SHA-256:'), { timeout: 30000 });
  ok('بارگذاری فایل → اثرانگشت SHA-256 همان لحظه محاسبه و اعلام شد', true);
  const newRow = await page.evaluate(() => {
    const arts = [...document.querySelectorAll('.panel.compact')];
    const t = arts[0]?.textContent ?? '';
    return { hasFp: t.includes('SHA-256:'), hasSample: t.includes('e2e-83-sample') };
  });
  ok('سند تازه در فهرست با اثرانگشت ظاهر شد', newRow.hasFp && newRow.hasSample, JSON.stringify(newRow));
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
  try { rmSync(TMP_PDF); } catch {}
}

console.log(`\nDOCUMENT-PROVENANCE-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
