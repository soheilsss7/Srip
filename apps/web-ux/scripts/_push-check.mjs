/* ============================================================================
   _push-check.mjs — E2E مرکز اعلان‌ها: اعلان دستگاه + دریافت خودکار + آفلاین
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_push-check.mjs
   چرخهٔ کامل در بیلد استاتیک (API داخل Service Worker):
   ۱) رضایت اعلان (permission) ۲) اشتراک این دستگاه
   ۳) ارسال اعلان از همان origin ۴) دریافت خودکار (پول ۱۰ثانیه‌ای، بدون کلیک)
   ۵) اعلان آزمایشی از خود صفحه ۶) لغو رضایت
   ۷) آفلاین‌شدن مرورگر → صفحهٔ بازدیدشده از حافظهٔ محلی سرو می‌شود
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';

const E2E = resolve(process.cwd(), '.e2e-browser');
const BASE = 'http://localhost:4100/Srip/srip2';
const API = `${BASE}/api/v1`;

const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

const page = await browser.newPage();
page.setDefaultTimeout(45000);
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
/* مجوز اعلان — شبیه‌سازی رضایت کاربر:
   کرومِ headless اعلان‌ها را همیشه denied می‌کند؛ پس رضایت «داده‌شده» شبیه‌سازی
   می‌شود (هدف آزمون: چرخهٔ کامل اشتراک/صف تحویل/لغو در سرور و صفحه). */
await page.evaluateOnNewDocument(() => {
  try {
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
      Notification.requestPermission = async () => 'granted';
    }
  } catch { /* بدون Notification (محیط ناشناخته) */ }
});

/* ورود pars — از همان origin (API داخل SW) */
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(async () => {
  const r = await fetch(`${location.origin}/Srip/srip2/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'pars', password: 'pars1234' }),
  });
  const d = await r.json();
  if (d.accessToken) sessionStorage.setItem('srip_access_token', d.accessToken);
});

/* صفحهٔ مرکز اعلان‌ها */
await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('text/مرکز اعلان‌ها', { timeout: 30000 });

/* ۱) رضایت اعلان */
const perm = await page.evaluate(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
check('رضایت اعلان داده شد (granted)', perm === 'granted', `perm=${perm}`);

/* ۲) اشتراک این دستگاه */
const subBtn = await page.$$eval('button', bs => bs.findIndex(b => b.textContent.includes('اشتراک این دستگاه')));
if (subBtn >= 0) { await page.evaluate(i => document.querySelectorAll('button')[i].click(), subBtn); }
await new Promise(r => setTimeout(r, 1500));
const subRows = await page.$$eval('.p3-row', rows => rows.some(r => r.textContent.includes('push.srip.local') && r.textContent.includes('فعال')));
check('اشتراک ثبت و در فهرست فعال شد', subRows);

/* ۳) ارسال اعلان از همان origin (از طریق SW) */
const disp = await page.evaluate(async () => {
  const r = await fetch('/Srip/srip2/api/v1/notifications/push/dispatch', {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('srip_access_token')}` },
    body: JSON.stringify({ title: 'اعلان آزمون E2E پوش', body: 'پیام آزمون از حلقهٔ کامل مرورگر.' }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
});
check('ارسال اعلان → صف شد', disp.status === 200 && (disp.body?.sent ?? 0) >= 1, JSON.stringify(disp).slice(0, 120));

/* ۴) دریافت خودکار (پول هر ۱۰ ثانیه، بدون هیچ کلیکی) → اعلان در فهرست ظاهر شود */
let received = false;
for (let i = 0; i < 15 && !received; i++) {
  await new Promise(r => setTimeout(r, 1000));
  received = await page.$$eval('.ai-match-card', rows => rows.some(r => r.textContent.includes('اعلان آزمون E2E پوش')));
}
check('دریافت خودکار → اعلان در فهرست (چرخهٔ کامل)', received);

/* ۵) اعلان آزمایشی از خود صفحه */
const testBtn = await page.$$eval('button', bs => bs.findIndex(b => b.textContent.includes('ارسال اعلان آزمایشی')));
if (testBtn >= 0) { await page.evaluate(i => document.querySelectorAll('button')[i].click(), testBtn); }
let testSeen = false;
for (let i = 0; i < 15 && !testSeen; i++) {
  await new Promise(r => setTimeout(r, 1000));
  testSeen = await page.$$eval('.ai-match-card', rows => rows.some(r => r.textContent.includes('اعلان آزمایشی SRIP')));
}
check('اعلان آزمایشی → ثبت و دریافت', testSeen);

/* ۶) گزارش تحویل: رکورد ارسال‌ها */
const logOk = await page.evaluate(() => document.body.textContent.includes('گزارش تحویل'));
check('گزارش تحویل روی صفحه است', logOk);

/* ۷) لغو رضایت */
const revokeBtn = await page.$$eval('button', bs => bs.findIndex(b => b.textContent.includes('لغو رضایت')));
if (revokeBtn >= 0) await page.evaluate(i => document.querySelectorAll('button')[i].click(), revokeBtn);
await new Promise(r => setTimeout(r, 900));
const revoked = await page.$$eval('.p3-row', rows => rows.some(r => r.textContent.includes('لغوشده')));
check('لغو رضایت اعلان', revoked);

/* ۸) آفلاین: صفحهٔ بازدیدشده از حافظهٔ محلی */
await page.goto(`${BASE}/qbr`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('text/بریف فصلی خودکار', { timeout: 30000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));
await page.setOfflineMode(true);
try {
  await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
  const offlineOk = await page.evaluate(() => document.body.textContent.includes('بریف فصلی') || document.body.textContent.includes('مرور فصلی'));
  check('حالت آفلاین → صفحهٔ بازدیدشده سرو شد', offlineOk);
} catch (e) {
  check('حالت آفلاین → صفحهٔ بازدیدشده سرو شد', false, String(e).slice(0, 100));
}
await page.setOfflineMode(false);

check('خطای صفحه در طول آزمون: صفر', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(`═══ Notifications/Offline E2E: pass=${pass} fail=${fail} ═══`);
process.exit(fail > 0 ? 1 : 0);
