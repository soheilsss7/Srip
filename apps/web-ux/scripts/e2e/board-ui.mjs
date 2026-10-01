/* ============================================================================
   board-ui.mjs — E2E صفحهٔ هیئت‌مدیره + گام ۳.۱: حالت ارائهٔ مدیریتی
   (کارت‌های بزرگ شاخص، فضای سفید، روایت «یک نگاه» — همان دادهٔ /board/overview)
   اجرا:  UI_BASE=http://localhost:4100/Srip/srip2 node scripts/e2e/board-ui.mjs
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
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });

try {
  /* ورود دمو (مالک — همهٔ محدوده) */
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
  /* خطاهای مرحلهٔ ورود (۴۰۱ پیش از OTP و prefetch ریشه) انتظار می‌رود — پاک می‌کنیم */
  errs.length = 0;

  /* ── ۱) صفحهٔ board در حالت عادی ── */
  await page.goto(`${BASE}/board`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3500));
  const base = await page.evaluate(() => ({
    h1: (document.querySelector('.page-heading h1')?.textContent ?? '').trim(),
    stats: document.querySelectorAll('.stat-card').length,
    rows: document.querySelectorAll('tbody tr').length,
    presentBtn: [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('حالت ارائهٔ مدیریتی')),
  }));
  ok('board: عنوان «هیئت‌مدیره — پرتفوی روابط»', base.h1.includes('پرتفوی روابط'), base.h1);
  ok('board: چهار کارت آمار + جدول روابط', base.stats === 4 && base.rows >= 3, `stats=${base.stats} rows=${base.rows}`);
  ok('گام ۳.۱: دکمهٔ «حالت ارائهٔ مدیریتی» حاضر است', base.presentBtn);

  /* ── ۲) ورود به حالت ارائه ── */
  const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('حالت ارائهٔ مدیریتی')));
  await btn.asElement().click();
  await page.waitForSelector('.board-present', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 700));
  const pres = await page.evaluate(() => {
    const el = document.querySelector('.board-present');
    const style = el ? getComputedStyle(el) : null;
    return {
      fixed: style?.position === 'fixed',
      h1: (el?.querySelector('h1')?.textContent ?? '').trim(),
      date: (el?.querySelector('.bp-date')?.textContent ?? '').includes('تاریخ تولید'),
      narrative: [...el.querySelectorAll('.bp-narrative p')].map(p => (p.textContent ?? '').trim()),
      cards: [...el.querySelectorAll('.bp-card')].map(c => (c.querySelector('strong')?.textContent ?? '').trim()),
      cardLabels: [...el.querySelectorAll('.bp-card small')].map(c => (c.textContent ?? '').trim()),
      risks: [...el.querySelectorAll('.bp-risk b')].map(b => (b.textContent ?? '').trim()),
      people: (el.querySelector('.bp-people')?.textContent ?? ''),
      duo: el.querySelectorAll('.bp-li').length,
      exitBtn: [...el.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('خروج از ارائه')),
      demoNote: (el.querySelector('.bp-note')?.textContent ?? '').length > 10,
      faDigits: [...el.querySelectorAll('.bp-narrative p')].every(p => /[۰-۹]/.test(p.textContent ?? '')),
      isEmpty: !(el.querySelector('.bp-card strong')?.textContent ?? '').includes('—'),
    };
  });
  ok('ارائه: پوشش تمام‌صفحه (fixed) با عنوان «یک نگاه»', pres.fixed && pres.h1.includes('یک نگاه'), pres.h1);
  ok('ارائه: تاریخ تولید گزارش', pres.date);
  ok('ارائه: روایت «یک نگاه» سه‌بندی با ارقام فارسی از دادهٔ زنده',
    pres.narrative.length === 3 && pres.faDigits
    && pres.narrative[0].includes('سرمایهٔ رابطهٔ پرتفوی') && pres.narrative[1].includes('درآمد برنده‌شده') && pres.narrative[2].includes('تک‌نقطه'),
    JSON.stringify(pres.narrative).slice(0, 120));
  ok('ارائه: چهار کارت بزرگ شاخص با مقدار محاسبه‌شده',
    pres.cards.length === 4 && pres.cards.every(c => c && c !== '—') && pres.cardLabels.some(l => l.includes('سرمایهٔ رابطه')) && pres.cardLabels.some(l => l.includes('ریسک تک‌نقطه')),
    JSON.stringify(pres.cards));
  ok('ارائه: بزرگ‌ترین ریسک‌های تک‌نقطه با مقدار', pres.risks.length >= 2 && pres.risks.every(r => r.length > 3), JSON.stringify(pres.risks).slice(0, 80));
  ok('ارائه: تک‌شخص‌ها + ستون‌های سرمایه/ریسک', pres.people.includes('تک‌شخص‌ها') && pres.duo >= 6, `duo=${pres.duo}`);
  ok('ارائه: دکمهٔ خروج + برچسب دمو (حساب دمو)', pres.exitBtn && pres.demoNote);

  /* ── ۳) خروج با Esc و با دکمه ── */
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 600));
  ok('خروج با Esc → پوشش ارائه بسته می‌شود', await page.evaluate(() => !document.querySelector('.board-present')));
  const btn2 = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('حالت ارائهٔ مدیریتی')));
  await btn2.asElement().click();
  await page.waitForSelector('.board-present', { timeout: 30000 });
  await page.evaluate(() => { [...document.querySelectorAll('.board-present button')].find(b => (b.textContent ?? '').includes('خروج از ارائه'))?.click(); });
  await new Promise(r => setTimeout(r, 600));
  ok('خروج با دکمه → پوشش ارائه بسته می‌شود', await page.evaluate(() => !document.querySelector('.board-present')));

  /* ── ۴) موبایل: board عادی و پوشش ارائه بدون اسکرول افقی ── */
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 900));
  ok('موبایل (۳۹۰): صفحهٔ board بدون اسکرول افقی',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  const btn3 = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('حالت ارائهٔ مدیریتی')));
  await btn3.asElement().click();
  await page.waitForSelector('.board-present', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));
  ok('موبایل (۳۹۰): حالت ارائه بدون اسکرول افقی',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.setViewport({ width: 1280, height: 900 });

  /* ── ۵) بدون خطای کنسول ── */
  ok('بدون خطای کنسول در صفحهٔ هیئت‌مدیره', errs.length === 0, errs.slice(0, 3).join('؛'));
} catch (e) {
  console.error('BOARD-UI ERROR:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
}
await browser.close();
console.log('══════════════════════════════');
console.log(`BOARD-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
