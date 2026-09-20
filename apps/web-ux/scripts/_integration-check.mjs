/* ============================================================================
   _integration-check.mjs — E2E یکپارچگی فاز ۳ با پلتفرم (بیلد استاتیک + SW)
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_integration-check.mjs
   ۱) /ai: پرسش آزاد زبان طبیعی (ادغام دستیار) + «نمی‌دانم» صادقانه
   ۲) /enrichment: پذیرش پیشنهاد → /organizations/:id بخش «غنی‌شده از منابع رسمی»
   ۳) /board: دکمهٔ «بریف فصلی (QBR)» → /qbr با بریف واقعی
   ۴) پوش → صفحهٔ «اعلان‌ها» (اعلان درون‌برنامه‌ای سازمان‌محور)
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';

const E2E = resolve(process.cwd(), '.e2e-browser');
const BASE = 'http://localhost:4100/Srip/srip2';

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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const setInputValue = (page, el, value) => page.evaluate((e, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(e, v);
  e.dispatchEvent(new Event('input', { bubbles: true }));
}, el, value);
const clickByText = (page, text, selector = 'button') => page.evaluate((t, s) => {
  const els = [...document.querySelectorAll(s)];
  const el = els.find(e => e.textContent.includes(t));
  if (el) { el.click(); return true; }
  return false;
}, text, selector);

const page = await browser.newPage();
page.setDefaultTimeout(45000);
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
page.on('response', r => {
  if (r.status() >= 400 && r.request().method() !== 'HEAD' && !/route\.txt|_rsc|favicon|\.txt\?/.test(r.url()))
    errs.push(`HTTP ${r.status()} ${r.url().split('/api/v1')[1] ?? r.url()}`);
});
page.on('dialog', d => d.accept().catch(() => {}));

/* ورود pars */
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(async () => {
  const r = await fetch('/Srip/srip2/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'pars', password: 'pars1234' }),
  });
  const d = await r.json();
  if (d.accessToken) sessionStorage.setItem('srip_access_token', d.accessToken);
});

/* ═══ ۱) /ai — پرسش آزاد (دستیار یکپارچه) ═══ */
await page.goto(`${BASE}/ai`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('text/پرسش آزاد', { timeout: 30000 });
const freeModeDefault = await page.$eval('.segmented button.active', b => b.textContent).catch(() => '');
check('/ai: حالت «پرسش آزاد» پیش‌فرض', String(freeModeDefault).includes('پرسش آزاد'), String(freeModeDefault));
const input = await page.$('input.as-input');
check('/ai: ورودی پرسش آزاد present', !!input);
if (input) {
  await setInputValue(page, input, 'سلامت این حساب چقدر است؟');
  await clickByText(page, 'بپرس');
  await sleep(1800);
  const answer = await page.$$eval('.as-chat .as-a', els => els.map(e => e.textContent).join(' ')).catch(() => '');
  check('/ai: پاسخ سلامت حساب با عدد', answer.includes('سلامت کلی') && answer.includes('میانگین'), answer.slice(0, 80));
  const refs = await page.$$eval('.as-chat .as-meta .p3-chip', els => els.length).catch(() => 0);
  check('/ai: ارجاع به رکورد منبع در پاسخ', refs >= 1, String(refs));
  /* خارج از دامنه → نمی‌دانم */
  const input2 = await page.$('input.as-input');
  await setInputValue(page, input2, 'قیمت طلا فردا چقدر است؟');
  await clickByText(page, 'بپرس');
  await sleep(1500);
  const oos = await page.$$eval('.as-chat .as-a', els => els[els.length - 1]?.textContent ?? '').catch(() => '');
  check('/ai: خارج از دامنه → «نمی‌دانم» صادقانه', oos.includes('نمی‌دانم'), oos.slice(0, 70));
}

/* ═══ ۲) غنی‌سازی → پروفایل سازمان ═══ */
await page.goto(`${BASE}/enrichment`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('text/صف تأیید انسانی', { timeout: 30000 });
await clickByText(page, 'پویش همهٔ منابع');
await sleep(1500);
const accepted = await clickByText(page, 'پذیرش');
check('/enrichment: دکمهٔ پذیرش پیشنهاد کلیک شد', accepted === true);
await sleep(1500);
const acc = await page.evaluate(async () => {
  const r = await fetch('/Srip/srip2/api/v1/enrichment/suggestions?status=ACCEPTED', {
    headers: { Authorization: `Bearer ${sessionStorage.getItem('srip_access_token')}` },
  });
  const d = await r.json();
  return d.items?.[0] ?? null;
});
check('/enrichment: پیشنهاد پذیرفته شد (API)', !!acc, JSON.stringify(acc?.id));
if (acc) {
  await page.goto(`${BASE}/organizations/${acc.orgId}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('text/غنی‌شده از منابع رسمی', { timeout: 30000 });
  const profileTxt = await page.$$eval('.list', lists => lists.map(l => l.textContent).join(' ')).catch(() => '');
  check('/organizations/:id: فیلد غنی‌شده در پروفایل', profileTxt.includes(acc.fieldFa) && profileTxt.includes(acc.proposedValue), `${acc.fieldFa}=${acc.proposedValue}`);
  const srcShown = profileTxt.includes(acc.sourceNameFa ?? acc.sourceId);
  check('/organizations/:id: منبع و شفافیت نمایش داده شد', srcShown);
}

/* ═══ ۳) هیئت‌مدیره → QBR ═══ */
await page.goto(`${BASE}/board`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('text/هیئت‌مدیره', { timeout: 30000 });
const qbrLink = await page.$$eval('a.btn', as => as.some(a => a.textContent.includes('بریف فصلی')));
check('/board: دکمهٔ «بریف فصلی (QBR)»', qbrLink);
if (qbrLink) {
  await clickByText(page, 'بریف فصلی', 'a');
  await sleep(1600);
  const qbrTxt = await page.evaluate(() => document.body.textContent);
  check('/qbr: بریف فصلی بارگذاری شد', page.url().includes('/qbr') && qbrTxt.includes('مرور فصلی'), page.url());
  check('/qbr: KPI و توصیه‌ها', qbrTxt.includes('میانگین سلامت') && qbrTxt.includes('توصیه'), '');
}

/* ═══ ۴) پوش → اعلان‌ها (یکپارچگی) ═══ */
await page.evaluate(async () => {
  await fetch('/Srip/srip2/api/v1/notifications/push/dispatch', {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('srip_access_token')}` },
    body: JSON.stringify({ title: 'اعلان آزمون یکپارچگی', body: 'پیام پوش باید در اعلان‌ها هم باشد.' }),
  });
});
await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(1200);
const notifTxt = await page.evaluate(() => document.body.textContent);
check('/notifications: پیام پوش در اعلان‌های درون‌برنامه‌ای', notifTxt.includes('اعلان آزمون یکپارچگی'), '');

check('خطای صفحه/شبکه در طول آزمون: صفر', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(`═══ Integration E2E: pass=${pass} fail=${fail} ═══`);
process.exit(fail > 0 ? 1 : 0);
