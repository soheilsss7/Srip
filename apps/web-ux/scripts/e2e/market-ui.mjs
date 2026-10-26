import puppeteer from 'puppeteer-core';
import sparticuz from '@sparticuz/chromium';
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ═══════════════════════════════════════════════════════════════════════════
   market-ui.mjs — ورود دادهٔ بیرونی: پژوهش بازار
   فایل CSV از پلتفرم دیگر → تجزیه/تطبیق → تأیید انسانی → کامیت →
   «بینش بازار» در مرکز دانش + سند تحلیلی + فهرست دسته‌های ورود.
   ═══════════════════════════════════════════════════════════════════════════ */

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';
const EXE = process.env.CHROME_EXE ?? resolve(E2E_DIR, 'chromium');
console.log('chromium:', EXE);
const browser = await puppeteer.launch({
  executablePath: EXE,
  env: { ...process.env, LD_LIBRARY_PATH: (process.env.CHROME_LD ?? join(E2E_DIR, 'nss')) + ':' + (process.env.LD_LIBRARY_PATH ?? '') },
  args: [...sparticuz.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 1440, height: 960 },
});
const page = await browser.newPage();
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('PASS', name);
  else { console.log('FAIL', name, extra); fails++; }
};
async function waitForText(text, timeout = 20000) {
  try {
    await page.waitForFunction(t => (document.body.textContent ?? '').includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', 'demo');
  await page.type('#login-pass', '123456');
  await page.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await page.click('.auth-form button[type=submit]');
  await page.waitForSelector('#login-otp', { timeout: 15000 });
  await page.type('#login-otp', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('login', await waitForText('پیشخوان'));

  ok('demo reset', await page.evaluate(async (BASE) => {
    const t = sessionStorage.getItem('srip_access_token');
    if (!t) return false;
    const r = await fetch(`${BASE}/api/v1/dev/reset`, { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    return r.ok;
  }, BASE));

  /* ── ۱) صفحهٔ ورود دادهٔ بیرونی ── */
  await page.goto(`${BASE}/imports`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('عنوان «ورود دادهٔ بیرونی»', await waitForText('ورود دادهٔ بیرونی'));
  ok('بدون ادبیات توسعه (مسترپلن/الگو)', await page.evaluate(() => !(document.body.textContent ?? '').includes('مسترپلن')));
  ok('گزینهٔ «پژوهش بازار — CSV/JSON»', await page.evaluate(() => [...document.querySelectorAll('option')].some(o => (o.textContent ?? '').includes('پژوهش بازار'))));
  ok('سایدبار: برچسب جدید', await page.evaluate(() => !!document.querySelector('nav.side-nav a[href*="imports"]')?.textContent?.includes('ورود دادهٔ بیرونی')));

  /* ── ۲) نمونهٔ پژوهش بازار را به‌عنوان فایل واقعی بارگذاری کن ── */
  /* نمونه باید با توکن نشست گرفته شود (داخل مرورگر — SW مسیر /api/v1 را می‌گیرد) */
  const sample = await page.evaluate(async (BASE) => {
    const t = sessionStorage.getItem('srip_access_token');
    const r = await fetch(`${BASE}/api/v1/imports/sample?type=market-csv`, { headers: { authorization: `Bearer ${t}` } });
    return r.json();
  }, BASE);
  fs.writeFileSync('/tmp/market-e2e.csv', (sample.content ?? '').replace(/\r\n/g, '\n'), 'utf8');
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'market-csv'));
    if (!s) throw new Error('kind select not found');
    s.value = 'market-csv';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const fileInput = await page.$('input[type=file]');
  ok('ورودی فایل موجود', !!fileInput);
  await fileInput.uploadFile('/tmp/market-e2e.csv');
  await new Promise(r => setTimeout(r, 4500));
  ok('مودال صف تأیید باز شد', await page.evaluate(() => (document.body.textContent ?? '').includes('صف تأیید انسانی')));
  const modal = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.modal-card .listRow')];
    const t = document.body.textContent ?? '';
    return {
      rows: rows.length,
      matched: t.includes('تطبیق با سازمان شما'),
      fresh: t.includes('بازیگر تازهٔ بازار'),
      share: t.includes('سهم ۳۱٪') || t.includes('سهم ۲۸٪') || t.includes('سهم ۲۳٪'),
      competitors: t.includes('رقیب'),
      marketBtn: t.includes('ثبت نهایی دادهٔ بازار'),
    };
  });
  ok(`ردیف‌های پژوهش در صف (${modal.rows})`, modal.rows === 7, JSON.stringify(modal));
  ok('نشان تطبیق + بازیگر تازه + سهم بازار + رقبا', modal.matched && modal.fresh && modal.share && modal.competitors, JSON.stringify(modal));

  /* ── ۳) یک ردیف رد، بقیه تأیید، سپس کامیت ── */
  const rejected = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.modal-card .listRow')];
    const btn = rows[rows.length - 1]?.querySelector('button[title="رد"]');
    if (!btn) return false;
    btn.click(); return true;
  });
  await new Promise(r => setTimeout(r, 1200));
  /* دکمهٔ پذیرش روی ردیف ردشده هم می‌ماند (برای تغییر نظر) — فقط ۶ ردیف اول را می‌پذیریم */
  const accepted = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.modal-card .listRow')];
    const btns = rows.slice(0, -1).map(r => r.querySelector('button[title="پذیرش"]')).filter(Boolean);
    btns.forEach(b => b.click());
    return btns.length;
  });
  await new Promise(r => setTimeout(r, 2500));
  ok(`رد یک ردیف + پذیرش ${accepted} ردیف`, rejected && accepted === 6, `accepted=${accepted}`);
  const committed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').includes('ثبت نهایی دادهٔ بازار'));
    if (!b) return false;
    b.click(); return true;
  });
  await new Promise(r => setTimeout(r, 4000));
  ok('کامیت دادهٔ بازار', committed && await waitForText('سند تحلیل در مرکز دانش ساخته شد'));

  /* ── ۴) فهرست دسته‌ها: وضعیت کامیت‌شده ── */
  await page.goto(`${BASE}/imports`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  ok('دستهٔ «پژوهش بازار» کامیت‌شده در فهرست', await page.evaluate(() => {
    const t = document.body.textContent ?? '';
    return t.includes('پژوهش بازار') && t.includes('پیوند سازمان') && t.includes('بازیگر تازه');
  }));

  /* ── ۵) مرکز دانش: بینش بازار + سند تحلیلی ── */
  await page.goto(`${BASE}/documents`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  const kb = await page.evaluate(() => {
    const t = document.body.textContent ?? '';
    return {
      panel: t.includes('بینش بازار'),
      kpi: t.includes('رکورد پژوهش') && t.includes('پیوند با سازمان‌های شما'),
      segments: t.includes('بخش‌های بازار') && t.includes('پیشتازان سهم بازار'),
      article: [...document.querySelectorAll('a,article,strong')].some(e => (e.textContent ?? '').includes('پژوهش بازار:')),
      chip: t.includes('بازیگر تازه'),
    };
  });
  ok('بینش بازار: پنل + KPI + بخش‌ها + پیشتازان', kb.panel && kb.kpi && kb.segments, JSON.stringify(kb));
  ok('سند تحلیلی فایل در دانشنامه', kb.article, JSON.stringify(kb));

  /* ── ۶) جستجو در دانشنامه: مقالهٔ پژوهش پیدا می‌شود ── */
  await page.type('.searchbox-input', 'پژوهش بازار');
  await new Promise(r => setTimeout(r, 1600));
  ok('جستجو: مقالهٔ پژوهش در نتایج', await page.evaluate(() => (document.body.textContent ?? '').includes('رکورد واردشده')));

  /* ── ۷) موبایل ۳۶۰×۷۶۰ بدون سرریز ── */
  await page.setViewport({ width: 360, height: 760 });
  await page.goto(`${BASE}/documents`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3500));
  const mob = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panel: (document.body.textContent ?? '').includes('بینش بازار'),
  }));
  ok('موبایل: بینش بازار بدون سرریز افقی', mob.panel && mob.overflow <= 0, JSON.stringify(mob));
} catch (e) {
  console.log('E2E ERROR:', e.message);
  fails++;
} finally {
  await browser.close().catch(() => {});
}
console.log(fails ? `\nE2E FAILED (${fails})` : '\nUI E2E ALL GREEN');
process.exit(fails ? 1 : 0);
