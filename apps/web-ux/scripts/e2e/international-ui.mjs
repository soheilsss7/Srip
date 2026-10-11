import puppeteer from 'puppeteer-core';
import sparticuz from '@sparticuz/chromium';

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ═══ فاز ۱۴ مسترپلن v14 — باتری UI ارتباطات بین‌المللی (/international · F17)
   چک‌ها: ناوبری/مجوز · نقشهٔ بازارها و گروه‌ها · جدول پرونده‌ها · مودال F17 (چهار تب) ·
   قاعدهٔ DD gate (۴۰۰) · قاعدهٔ هویت/حقوقی (۴۰۰) · ترجمه بدون بازبین (۴۰۰) ·
   پایش ماهانه (خط مبنا) · ارجاع F14 ═══ */

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';
const EXE = process.env.CHROME_EXE ?? resolve(E2E_DIR, 'chromium');
console.log('chromium:', EXE);
const browser = await puppeteer.launch({
  executablePath: EXE,
  env: {...process.env, LD_LIBRARY_PATH: (process.env.CHROME_LD ?? join(E2E_DIR, 'nss')) + ':' + (process.env.LD_LIBRARY_PATH ?? '')},
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
async function textOf(sel) { return page.$eval(sel, el => el.textContent ?? '').catch(() => ''); }
async function clickByText(sel, text) {
  const clicked = await page.evaluate((s, t) => {
    const els = [...document.querySelectorAll(s)];
    const el = els.find(e => (e.textContent ?? '').trim().includes(t));
    if (!el) return false;
    el.click(); return true;
  }, sel, text);
  return clicked;
}
async function waitForText(text, timeout = 20000) {
  try {
    await page.waitForFunction(t => (document.body.textContent ?? '').includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}
async function waitForSel(sel, timeout = 15000) {
  try { await page.waitForSelector(sel, { timeout }); return true; } catch { return false; }
}

try {
  // 1) login
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
  ok('login → dashboard', await page.evaluate(() => location.pathname.includes('dashboard')) || await waitForText('پیشخوان'), 'url=' + page.url());

  // بازنشانی دادهٔ دمو برای تکرارپذیری
  ok('demo reset', await page.evaluate(async (BASE) => {
    const t = sessionStorage.getItem('srip_access_token');
    if (!t) return false;
    const r = await fetch(`${BASE}/api/v1/dev/reset`, { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    return r.ok;
  }, BASE));

  // 2) ناوبری: آیتم منو در ناحیهٔ مخاطب‌ها
  const navOk = await page.evaluate(() => {
    const a = document.querySelector('a[href$="/international"]');
    if (!a) return { link: false };
    const zone = a.closest('[data-zone], nav section, .nav-zone');
    return { link: true, label: (a.textContent ?? '').trim(), inZone: !!(a.closest('nav')) };
  });
  ok('ناوبری: آیتم «ارتباطات بین‌المللی» در ناحیهٔ مخاطب‌ها (Globe)', navOk.link && navOk.label.includes('ارتباطات بین‌المللی'), JSON.stringify(navOk));

  // 3) صفحهٔ /international — سربرگ + قاعدهٔ ثابت فروش
  await page.goto(`${BASE}/international`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('صفحهٔ F17: سربرگ + قاعدهٔ ثابت «فروش فقط با مرجع مجاز»',
    await waitForText('ارتباطات بین‌المللی (F17)') && !!(await page.$('[data-intl-sale-rule]')));

  // 4) نقشهٔ بازارها و گروه‌های هدف
  const map = await page.evaluate(() => ({
    countries: [...document.querySelectorAll('tr[data-intl-country]')].map(r => r.getAttribute('data-intl-country')),
    groups: [...document.querySelectorAll('tr[data-intl-group]')].map(r => r.getAttribute('data-intl-group')),
    txt: (document.querySelector('.data-intl-map')?.textContent ?? ''),
  }));
  ok('نقشهٔ بازارها: ۳ کشور اولویت‌دار با دلیل + شش گروه هدف ۱۰.۶.۱ با هدف و خروجی',
    map.countries.length === 3 && map.groups.length === 6
      && map.groups.includes('UNIVERSITY') && map.groups.includes('INVESTOR') && map.groups.includes('EXPERT')
      && map.txt.includes('هدف ارتباط') && map.txt.includes('خروجی قابل ثبت'), JSON.stringify(map));

  // 5) جدول پرونده‌های طرف ارتباط (بذر ۴ پرونده)
  const rows = await page.evaluate(() => [...document.querySelectorAll('tr[data-intl-id]')].map(r => ({
    id: r.getAttribute('data-intl-id'), identity: r.getAttribute('data-identity'), status: r.getAttribute('data-status'),
    txt: r.textContent ?? '',
  })));
  ok('جدول پرونده‌ها: ۴ پروندهٔ بذر با هویت/وضعیت/مسئول',
    rows.length === 4
      && rows.some(r => r.id === 'intl-1' && r.identity === 'VERIFIED' && r.txt.includes('دانشگاه'))
      && rows.some(r => r.id === 'intl-4' && r.identity === 'REJECTED' && r.status === 'CLOSED')
      && rows.every(r => r.txt.includes('—') || r.txt.length > 20), JSON.stringify(rows.map(r => r.id)));

  // 6) مودال F17 با چهار تب — پروندهٔ intl-1
  await page.evaluate(() => {
    const tr = document.querySelector('tr[data-intl-id="intl-1"]');
    const btn = [...(tr?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('پرونده'));
    btn?.click();
  });
  ok('مودال F17: باز شدن پروندهٔ intl-1 با تب‌های اطلاعات/مکاتبات/نسخه‌های متن/بررسی‌ها',
    await waitForText('پروندهٔ F17') && !!(await page.$('[data-intl-tabs]')));
  const tabsOk = await page.evaluate(() => [...document.querySelectorAll('[data-intl-tabs] button')].map(b => (b.textContent ?? '').trim()));
  ok('مودال F17: چهار تب کامل', ['اطلاعات', 'مکاتبات', 'نسخه‌های متن', 'بررسی‌ها و ارجاع'].every(x => tabsOk.includes(x)), JSON.stringify(tabsOk));
  await clickByText('[data-intl-tabs] button', 'نسخه‌های متن');
  ok('تب نسخه‌های متن: نسخهٔ مرجع فارسی + ترجمهٔ بازبینی‌شدهٔ intl-1',
    await waitForText('مرجع فارسی') && await waitForText('ترجمه'));
  const tvCount = await page.evaluate(() => document.querySelectorAll('[data-intl-texts] li').length);
  ok('تب نسخه‌های متن: دو نسخهٔ بذر (fa مرجع + en ترجمه)', tvCount === 2, `n=${tvCount}`);

  // 7) قاعدهٔ ۳ (ترجمه بدون بازبین → ۴۰۰)
  await page.evaluate(() => { (document.querySelector('[data-intl-tv-lang]')).value = ''; });
  await page.type('[data-intl-tv-lang]', 'de');
  await page.type('[data-intl-tv-reviewer]', ' ');
  await page.evaluate(() => { const el = document.querySelector('[data-intl-tv-add]'); el.click(); });
  ok('قاعدهٔ ۳: ترجمه بدون بازبین → پیام ۴۰۰ سرور در مودال',
    await waitForText('متن فارسی مرجع می‌ماند؛ ترجمه بدون منبع و بازبین تأیید نمی‌شود.'));

  // 8) قاعدهٔ ۲ (اشتراک داده بدون هویت تأییدشده → ۴۰۰) — تب بررسی‌ها روی intl-1? هویت VERIFIED است؛
  //    از پروندهٔ intl-2 (در حال بررسی) استفاده می‌کنیم
  await page.evaluate(() => { [...document.querySelectorAll('button[aria-label], .modal button')].slice(-1); (document.querySelector('.modal .modal-close, .modal [aria-label="بستن"]'))?.click?.(); });
  await page.evaluate(() => {
    const tr = document.querySelector('tr[data-intl-id="intl-2"]');
    const btn = [...(tr?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('پرونده'));
    btn?.click();
  });
  await clickByText('[data-intl-tabs] button', 'بررسی‌ها');
  ok('تب بررسی‌ها: انتخابگر هویت/حقوقی/مالی/اشتراک داده', await waitForSel('[data-intl-f="dataSharePerm"]'));
  await page.select('[data-intl-f="dataSharePerm"]', 'LIMITED');
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ بررسی‌ها'))?.click(); });
  ok('قاعدهٔ ۲: اشتراک داده با هویت بررسی‌نشده → پیام ۴۰۰ (هویت و بررسی حقوقی باید کامل باشد)',
    await waitForText('پیش از تبادل اطلاعات حساس'));

  // 9) قاعدهٔ ۱ (پیام محصول‌محور بدون DD → ۴۰۰) — فرم ایجاد
  await page.evaluate(() => { document.querySelector('.modal [aria-label="بستن"], .modal .modal-close') ? (document.querySelector('.modal .modal-close, .modal [aria-label="بستن"]')).click?.() : document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  await new Promise(r => setTimeout(r, 600));
  const canCreate = await page.evaluate(() => !!document.querySelector('[data-intl-create-submit]') || [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('پروندهٔ جدید F17')));
  if (canCreate) {
    await clickByText('button', 'پروندهٔ جدید F17');
    ok('فرم ایجاد F17 باز شد', await waitForSel('[data-intl-f="country"]'));
    await page.type('[data-intl-f="country"]', 'اتریش');
    await page.type('[data-intl-f="orgName"]', 'نهاد آزمون');
    await page.type('[data-intl-f="purpose"]', 'زمینه‌یابی');
    await page.select('[data-intl-f="messageType"]', 'PRODUCT');
    await page.type('[data-intl-f="ownerRole"]', 'مدیر استراتژی');
    await page.type('[data-intl-f="message"]', 'پیام محصول‌محور بدون پروندهٔ DD');
    await page.evaluate(() => { (document.querySelector('[data-intl-create-submit]')).click(); });
    ok('قاعدهٔ ۱: پیام محصول‌محور بدون DD متصل → پیام ۴۰۰ در فرم ایجاد',
      await waitForText('Due Diligence'));
    await page.evaluate(() => { (document.querySelector('.modal .modal-close, .modal [aria-label="بستن"]'))?.click?.(); });
  } else {
    ok('فرم ایجاد F17 باز شد', false, 'دکمهٔ ایجاد یافت نشد');
  }

  // 10) پایش ماهانه — جدول پنج‌معیاره با خط مبنا
  const reviews = await page.evaluate(() => ({
    n: document.querySelectorAll('tr[data-intl-review]').length,
    baseline: [...document.querySelectorAll('tr[data-intl-review]')].some(r => r.getAttribute('data-baseline') === '1'),
    txt: (document.querySelector('.data-intl-reviews')?.textContent ?? ''),
  }));
  ok('پایش ماهانهٔ ۱۰.۶.۴: دو ماه بذر با خط مبنا و پنج معیار',
    reviews.n === 2 && reviews.baseline
      && reviews.txt.includes('پوشش نقشهٔ ذی‌نفعان اولویت‌دار')
      && reviews.txt.includes('فرصت‌های واجد شرایط'), JSON.stringify(reviews));

  // 11) قواعد کنترل حقوقی (۱۰.۶.۳)
  const rules = await page.evaluate(() => document.querySelectorAll('[data-intl-rule]').length);
  ok('پنل قواعد کنترل حقوقی: پنج قاعدهٔ ۱۰.۶.۳', rules === 5, `n=${rules}`);

  // 12) ارجاع F14 — پروندهٔ intl-2 (بدون ارجاع) → دکمهٔ ارجاع
  const refBtn = await page.evaluate(() => {
    const tr = document.querySelector('tr[data-intl-id="intl-2"]');
    const btn = [...(tr?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('ارجاع به F14'));
    if (!btn) return false; btn.click(); return true;
  });
  ok('دکمهٔ «ارجاع به F14» در ردیف پروندهٔ بدون ارجاع', refBtn);
  if (refBtn) {
    ok('تب بررسی‌ها: جعبهٔ ارجاع با انتخاب کارت F14', await waitForSel('[data-intl-referral]') && await waitForSel('[data-intl-pack]'));
    const hasPacks = await page.evaluate(() => (document.querySelector('[data-intl-pack]'))?.options.length > 1);
    ok('فهرست کارت‌های F14 بارگذاری شد (بسته‌های آماده‌سازی)', hasPacks);
    await page.evaluate(() => {
      const sel = document.querySelector('[data-intl-pack]');
      if (sel?.options?.length > 1) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.evaluate(() => { (document.querySelector('[data-intl-referral-submit]'))?.click(); });
    const referred = await waitForText('فرصت به کارت F14 ارجاع شد');
    ok('ثبت ارجاع فرصت به F14 → پیام موفق و قاعدهٔ فروش', referred);
  }

  // 13) خروجی CSV/JSON — دکمه‌های خروجی
  const expBtns = await page.evaluate(() => [...document.querySelectorAll('.data-intl-contacts button')].filter(b => (b.textContent ?? '').includes('CSV') || (b.textContent ?? '').includes('JSON')).length);
  ok('خروجی JSON/CSV در پنل پرونده‌ها', expBtns >= 2, `n=${expBtns}`);

  // 14) جست‌وجو/فیلتر — صفحه را تازه باز می‌کنیم (بازبارگذاری پس از ارجاع، تایمینگ hydration را جابه‌جا می‌کند)
  await page.goto(`${BASE}/international`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const searchSel = '.data-intl-contacts input[aria-label*="جست"], .data-intl-contacts input[type="search"]';
  const searchReady = await waitForSel(searchSel, 20000);
  if (searchReady) {
    await page.click(searchSel);
    await page.type(searchSel, 'زوریخ');
  }
  await new Promise(r => setTimeout(r, 1200));
  const filtered = await page.evaluate(() => document.querySelectorAll('tr[data-intl-id]').length);
  ok('جست‌وجوی جدول پرونده‌ها (زوریخ → ۱ ردیف)', filtered === 1, `n=${filtered}`);
} catch (e) {
  console.error('FATAL', e?.message ?? String(e));
  fails++;
} finally {
  await browser.close();
}
console.log(fails === 0 ? '\nALL PASS ✓' : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
