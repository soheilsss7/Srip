/* ui-consistency.mjs — باتری یکپارچگی رابط کاربری (مسترپلن یکپارچه‌سازی، گام ۱.۴)
   چک‌های خودکار ضدگیج‌کنندگی روی همهٔ صفحات اصلی ناوبری:
   الف) هر صفحه دقیقاً یک h1 استاندارد دارد (PageHeader یا .page-heading) — نه صفر، نه تکراری
   ب) بدون خطای کنسول/صفحه هنگام لود
   ج) بدون اسکرول افقی در دسکتاپ (۱۲۸۰) و موبایل (۳۹۰)
   د) عنوان صفحه با عنوان ناوبری هم‌خوان است (نمونه‌ای)
   اجرا: LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" UI_BASE=http://localhost:4100/Srip/srip2 node scripts/e2e/ui-consistency.mjs */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); } };

/* صفحات اصلی ناوبری (۶ ناحیه) — مسترپلن: هیچ صفحهٔ اصلی بدون هدر استاندارد نمی‌ماند */
const PAGES = [
  ['/', 'پیشخوان'], ['/notifications', 'اعلان‌ها'],
  ['/organizations', 'سازمان‌ها'], ['/people', 'اشخاص'], ['/directory', 'دیتابیس روابط بیرونی'],
  ['/relationships', 'روابط'], ['/network', 'شبکهٔ روابط'], ['/publics', 'عموم‌ها'], ['/interactions', 'تعاملات'], ['/referrals', 'معرفی‌ها'],
  ['/program', 'حاکمیت برنامه'],
  ['/partnerships', 'مشارکت'],
  ['/meetings', 'جلسات'], ['/calendar', 'تقویم'], ['/actions', 'اقدامات'], ['/commitments', 'تعهدات'], ['/projects', 'پروژه‌ها'], ['/opportunities', 'فرصت‌ها'], ['/requirements', 'نیازمندی‌ها'],
  ['/alerts', 'هشدارها'], ['/intelligence', 'هوشمندی و توصیه‌ها'], ['/board', 'هیئت‌مدیره'], ['/enrichment', 'غنی‌سازی منابع رسمی'], ['/strategy', 'تحلیل راهبردی'], ['/qbr', 'بریف فصلی (QBR)'],
  ['/workflows', 'گردش کار و تأییدها'], ['/documents', 'مرکز دانش'], ['/data-management', 'داده و کیفیت'], ['/imports', 'ورود دادهٔ بیرونی'], ['/settings', 'تنظیمات من'],
];

const browser = await puppeteer.launch({
  executablePath: resolve(process.cwd(), '.e2e-browser/chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(process.cwd(), '.e2e-browser/nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const consoleErrs = [];
page.on('pageerror', e => consoleErrs.push(e.message.slice(0, 100)));
page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 100)); });

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

  const noH1 = [], multiH1 = [], hscrollDesktop = [], errPages = [];
  for (const [path] of PAGES) {
    consoleErrs.length = 0;
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 900));
    const info = await page.evaluate(() => {
      const h1s = [...document.querySelectorAll('h1')];
      const std = h1s.filter(h => h.closest('.page-heading') || h.closest('header'));
      return {
        h1: h1s.length, std: std.length,
        title: (document.querySelector('.page-heading h1, header h1')?.textContent ?? '').trim(),
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    if (info.h1 === 0 || info.std === 0) noH1.push(path);
    if (info.h1 > 1) multiH1.push(path);
    if (info.hscroll) hscrollDesktop.push(path);
    if (consoleErrs.length) errPages.push(path);
  }

  ok('همهٔ صفحات اصلی دقیقاً یک هدر استاندارد دارند', noH1.length === 0, 'بدون هدر: ' + noH1.join('، '));
  ok('هیچ صفحه‌ای h1 تکراری ندارد', multiH1.length === 0, 'تکراری: ' + multiH1.join('، '));
  ok('هیچ صفحهٔ اصلی خطای کنسول ندارد', errPages.length === 0, 'خطا: ' + errPages.slice(0, 4).join('، '));
  ok('بدون اسکرول افقی در دسکتاپ (۱۲۸۰)', hscrollDesktop.length === 0, 'اسکرول: ' + hscrollDesktop.slice(0, 4).join('، '));

  /* موبایل — همان صفحات، فقط اسکرول افقی */
  await page.setViewport({ width: 390, height: 844 });
  const hscrollMobile = [];
  for (const [path] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));
    const bad = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (bad) hscrollMobile.push(path);
  }
  ok('بدون اسکرول افقی در موبایل (۳۹۰)', hscrollMobile.length === 0, 'اسکرول: ' + hscrollMobile.slice(0, 5).join('، '));

  /* هم‌خوانی عنوان صفحه و ناوبری — نمونه‌های کلیدی */
  await page.setViewport({ width: 1280, height: 900 });
  for (const [path, navLabel] of [['/relationships', 'روابط'], ['/publics', 'عموم'], ['/opportunities', 'فرصت'], ['/calendar', 'تقویم'], ['/program', 'حاکمیت'], ['/partnerships', 'مشارکت']]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 900));
    const title = await page.evaluate(() => (document.querySelector('.page-heading h1, header h1')?.textContent ?? '').trim());
    ok(`هم‌خوانی عنوان/ناوبری: ${navLabel}`, title.includes(navLabel), `عنوان=«${title}»`);
  }

  /* حالت خالی (گام ۱.۲) — در صفحات جستجودار، عبارت بی‌نتیجه باید حالت خالیِ
     دارای «راهنمای گام بعدی» نشان دهد (توضیح ≥۲۰ نویسه یا دکمه/پیوند اقدام). */
  const emptyBad = [], emptyChecked = [];
  for (const [path] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 900));
    const hasSearch = await page.evaluate(() =>
      !!document.querySelector('.toolbar-search input, input[type="search"], input[placeholder*="جستجو"], input[aria-label*="جستجو"]'));
    if (!hasSearch) continue;
    emptyChecked.push(path);
    await page.type('.toolbar-search input, input[type="search"], input[placeholder*="جستجو"], input[aria-label*="جستجو"]', 'ززززقق');
    /* شبکهٔ روابط جستجو را با Enter اعمال می‌کند (درخواست سرور)؛ در صفحات فیلترِ درون‌صفحه‌ای بی‌اثر است */
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1500));
    const res = await page.evaluate(() => {
      const es = document.querySelector('.empty-state-v4, .empty-people, .srip-empty');
      if (!es) return { shown: false };
      const hint = [...es.querySelectorAll('p')].map(p => p.textContent.trim()).join(' ');
      return { shown: true, guided: !!es.querySelector('button, a') || hint.length >= 20, hint: hint.slice(0, 60) };
    });
    if (!res.shown || !res.guided) emptyBad.push(`${path}${res.shown ? ' (بدون راهنما)' : ' (حالت خالی نشان نداد)'}`);
  }
  ok(`حالت خالیِ صفحات جستجودار راهنمای گام بعدی دارد (${emptyChecked.length} صفحه)`, emptyBad.length === 0, emptyBad.join('، '));
} catch (e) {
  console.error('UI-CONSISTENCY ERROR:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
}
await browser.close();
console.log('══════════════════════════');
console.log(`UI-CONSISTENCY: ${pass} PASS / ${fail} FAIL`);
if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
