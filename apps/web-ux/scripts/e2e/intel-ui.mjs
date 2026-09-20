import puppeteer from 'puppeteer-core';
import sparticuz from '@sparticuz/chromium';

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ═══════════════════════════════════════════════════════════════════════════
   intel-ui.mjs — هاب «هوش» و غنی‌سازی منابع رسمی
   ۱) نوار تب هاب در همهٔ صفحات هوش می‌ماند (رفع «حرف‌شدن» منو)
   ۲) غنی‌سازی: زیرمجموعهٔ «پیشنهادهای هوشمند» + سایدبار زون هوش
   ۳) جریان کامل غنی‌سازی: پویش ← پیشنهاد ← پذیرش ← اعمال روی پروفایل
   ۴) ماندگاری دادهٔ SW: نوشته‌ها بعد از بستن/بازکردن مرورگر می‌مانند
   ═══════════════════════════════════════════════════════════════════════════ */

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';
const EXE = process.env.CHROME_EXE ?? resolve(E2E_DIR, 'chromium');
const PROFILE = process.env.INTEL_PROFILE ?? '/tmp/intel-e2e-profile';
console.log('chromium:', EXE);
const launch = () => puppeteer.launch({
  executablePath: EXE,
  env: { ...process.env, LD_LIBRARY_PATH: (process.env.CHROME_LD ?? join(E2E_DIR, 'nss')) + ':' + (process.env.LD_LIBRARY_PATH ?? '') },
  args: [...sparticuz.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 1440, height: 960 },
  userDataDir: PROFILE, // پروفایل پایدار → Cache API بین دو اجرا می‌ماند (تست ماندگاری)
});
let browser = await launch();
let page = await browser.newPage();
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('PASS', name);
  else { console.log('FAIL', name, extra); fails++; }
};
async function clickByText(sel, text) {
  return page.evaluate((s, t) => {
    const els = [...document.querySelectorAll(s)];
    const el = els.find(e => (e.textContent ?? '').trim().includes(t));
    if (!el) return false;
    el.click(); return true;
  }, sel, text);
}
async function waitForText(text, timeout = 20000) {
  try {
    await page.waitForFunction(t => (document.body.textContent ?? '').includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}
async function hubTabs() {
  return page.evaluate(() => [...document.querySelectorAll('nav.tabs:not(.sub-tabs) a[role="tab"]')].map(a => (a.textContent ?? '').trim()));
}
async function login() {
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
}

try {
  await login();
  ok('login', await waitForText('پیشخوان'));

  // 0) بازنشانی دادهٔ دمو — اجرای تکرارپذیر
  ok('demo reset', await page.evaluate(async (BASE) => {
    const t = sessionStorage.getItem('srip_access_token');
    if (!t) return false;
    const r = await fetch(`${BASE}/api/v1/dev/reset`, { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    return r.ok;
  }, BASE));

  /* ── ۱) سایدبار: غنی‌سازی در زون «هوش» است، نه «مخاطب‌ها» ── */
  await page.goto(`${BASE}/intelligence`, { waitUntil: 'networkidle0', timeout: 60000 });
  const sidebar = await page.evaluate(() => {
    const zones = [...document.querySelectorAll('nav a[href*="enrichment"]')];
    return { count: zones.length };
  });
  ok('سایدبار: غنی‌سازی فقط یک‌بار', sidebar.count === 1, 'count=' + sidebar.count);
  const sidebarZone = await page.evaluate(() => {
    const link = document.querySelector('nav.side-nav a[href*="enrichment"]');
    if (!link) return '';
    const zone = link.closest('.nav-zone');
    return zone?.querySelector('.nav-zone-title span')?.textContent ?? '';
  });
  ok('سایدبار: غنی‌سازی زیر زون هوش', sidebarZone.trim() === 'هوش', 'zone=' + sidebarZone);

  /* ── ۲) نوار تب هاب در همهٔ صفحات هوش ── */
  const TABS = ['هوش رابطه', 'دستیار هوشمند', 'پیشنهادها', 'بریف هفتگی', 'گزارش‌ها'];
  const checkHub = async (name) => {
    const tabs = await hubTabs();
    ok(`هاب در ${name}: هر ۵ تب حاضر`, tabs.length === 5 && TABS.every(t => tabs.some(x => x.includes(t))), JSON.stringify(tabs));
  };
  await checkHub('/intelligence');

  // کلیک روی «دستیار هوشمند» — منو باید بماند (باگ گزارش‌شده)
  ok('کلیک تب دستیار هوشمند', await clickByText('nav.tabs:not(.sub-tabs) a[role="tab"]', 'دستیار هوشمند'));
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  ok('رفتیم به /ai', page.url().includes('/ai'), page.url());
  await checkHub('/ai');

  // پیشنهادها
  ok('کلیک تب پیشنهادها', await clickByText('nav.tabs:not(.sub-tabs) a[role="tab"]', 'پیشنهادها'));
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  ok('رفتیم به /recommendations', page.url().includes('/recommendations'), page.url());
  await checkHub('/recommendations');
  const subs = await page.evaluate(() => [...document.querySelectorAll('nav.sub-tabs a[role="tab"]')].map(a => (a.textContent ?? '').trim()));
  ok('زیرمجموعه‌های پیشنهادها: خودش + غنی‌سازی', subs.length === 2 && subs.some(x => x.includes('پیشنهادهای هوشمند')) && subs.some(x => x.includes('غنی‌سازی منابع رسمی')), JSON.stringify(subs));

  // غنی‌سازی از طریق زیرمجموعه
  ok('کلیک زیرمجموعهٔ غنی‌سازی', await clickByText('nav.sub-tabs a[role="tab"]', 'غنی‌سازی منابع رسمی'));
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('رفتیم به /enrichment', page.url().includes('/enrichment'), page.url());
  await checkHub('/enrichment');
  const recActive = await page.evaluate(() => {
    const a = [...document.querySelectorAll('nav.tabs:not(.sub-tabs) a[role="tab"]')].find(x => (x.textContent ?? '').includes('پیشنهادها'));
    return a?.className ?? '';
  });
  ok('روی /enrichment تب مادر «پیشنهادها» فعال است', recActive.includes('tab-active'), recActive);

  // گزارش‌ها
  ok('کلیک تب گزارش‌ها', await clickByText('nav.tabs:not(.sub-tabs) a[role="tab"]', 'گزارش‌ها'));
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('رفتیم به /reports', page.url().includes('/reports'), page.url());
  await checkHub('/reports');

  // بریف هفتگی
  ok('کلیک تب بریف هفتگی', await clickByText('nav.tabs:not(.sub-tabs) a[role="tab"]', 'بریف هفتگی'));
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('رفتیم به /ai-executive-brief', page.url().includes('/ai-executive-brief'), page.url());
  await checkHub('/ai-executive-brief');

  /* ── ۳) جریان غنی‌سازی: پویش ← بازبینی ← تأیید (فردی و گروهی) ── */
  await page.goto(`${BASE}/enrichment`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  ok('صفحهٔ غنی‌سازی: سه منبع رسمی', await page.evaluate(() => document.querySelectorAll('.p3-src').length === 3));
  ok('دکمهٔ پویش همهٔ منابع', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('پویش همهٔ منابع'))));
  ok('دکمهٔ پویش تک‌منبع روی کارت', await page.evaluate(() => document.querySelectorAll('.p3-src button').length >= 1));
  ok('راهنمای «چطور کار می‌کند؟» با سه گام', await page.evaluate(() => {
    const t = document.body.textContent ?? '';
    return t.includes('چطور کار می‌کند؟') && t.includes('۱. پویش کنید') && t.includes('۲. بازبینی کنید') && t.includes('۳. تأیید کنید');
  }));
  ok('متن user-facing: بدون واژهٔ توسعه (مسترپلن/فاز/الگوی/شبیه‌ساز)', await page.evaluate(() => {
    const t = document.body.textContent ?? '';
    return !['مسترپلن', 'الگوی', 'شبیه‌ساز', 'TSC', 'Affinity'].some(w => t.includes(w)) && !/فاز\s*[۳0-9]/.test(t);
  }));
  ok('فیلترهای صف: منبع + اطمینان + جستجو', await page.evaluate(() => {
    const sels = [...document.querySelectorAll('select')].map(x => x.getAttribute('aria-label') ?? '');
    return sels.some(x => x.includes('فیلتر منبع')) && sels.some(x => x.includes('فیلتر اطمینان')) && !!document.querySelector('.toolbar-search input');
  }));
  ok('نمای «سازمان‌ها و پوشش پروفایل» خالی نیست', await page.evaluate(() => (document.body.textContent ?? '').includes('سازمان‌ها و پوشش پروفایل')));

  // ۳-الف) پویش تک‌منبع → دو پیشنهاد اطمینان‌بالا
  ok('پویش منبع «سامانهٔ ثبت شرکت‌ها»', await clickByText('.p3-src button', 'پویش این منبع'));
  await new Promise(r => setTimeout(r, 3000));
  const rows1 = await page.evaluate(() => document.querySelectorAll('.p3-row').length);
  ok('پویش تک‌منبع: پیشنهاد ساخته شد', rows1 >= 1, 'rows=' + rows1);

  // ۳-ب) پذیرش گروهی اطمینان‌بالا
  const bulkShown = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').includes('پذیرش گروهی اطمینان بالا'));
    if (!b) return null;
    b.click(); return b.textContent ?? '';
  });
  ok('دکمهٔ «پذیرش گروهی اطمینان بالا» دیده و کلیک شد', typeof bulkShown === 'string' && bulkShown.length > 0, String(bulkShown));
  await new Promise(r => setTimeout(r, 3000));
  ok('پیام پذیرش گروهی', await waitForText('پیشنهاد پذیرفته'));
  const orgRows = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('نمای سازمان‌ها: ردیف با پوشش', orgRows >= 3, 'rows=' + orgRows);

  // ۳-پ) پویش تک‌سازمان از نمای سازمان‌ها
  ok('دکمهٔ «غنی‌سازی این سازمان»', await clickByText('button', 'غنی‌سازی این سازمان'));
  await new Promise(r => setTimeout(r, 3000));
  ok('پویش تک‌سازمان: پیشنهاد تازه', await page.evaluate(() => document.querySelectorAll('.p3-row').length >= 1));

  // ۳-ت) پذیرش فردی + ثبت در پروفایل
  const firstOrgHref = await page.evaluate(() => document.querySelector('.p3-row a')?.getAttribute('href') ?? null);
  ok('پذیرش اولین پیشنهاد', await clickByText('.p3-row button', 'پذیرش'));
  await new Promise(r => setTimeout(r, 3000));
  ok('پیام تأیید پس از پذیرش', await waitForText('با منبع و سطح اطمینان در پروفایل ثبت شد'));

  // تب تعیین‌تکلیف‌شده: ردیف‌های پذیرفته‌شده
  ok('رفتن به تب تعیین‌تکلیف‌شده', await clickByText('[role="tab"]', 'تعیین‌تکلیف‌شده'));
  await new Promise(r => setTimeout(r, 800));
  const decidedOk = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.p3-row')];
    return rows.filter(r => (r.textContent ?? '').includes('پذیرفته‌شده')).length >= 2;
  });
  ok('ردیف‌های پذیرفته‌شده (فردی + گروهی) در تعیین‌تکلیف‌شده‌ها', decidedOk);

  // اعمال روی پروفایل سازمان
  if (firstOrgHref) {
    /* href در بیلد استاتیک شامل basePath است (مثل /Srip/srip2/organizations/org-3) — دوبار چسباندن ممنوع */
    const u = new URL(BASE);
    const basePath = u.pathname.replace(/\/+$/, '');
    const target = firstOrgHref.startsWith(basePath + '/') ? u.origin + firstOrgHref : BASE + firstOrgHref;
    await page.goto(target, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    ok('پروفایل سازمان: فیلد غنی‌شده با منبع', await page.evaluate(() => {
      const t = document.body.textContent ?? '';
      return t.includes('غنی') && (t.includes('اطمینان') || t.includes('منبع'));
    }));
  } else ok('پروفایل سازمان: فیلد غنی‌شده با منبع', false, 'no href');

  /* ── ۴) ماندگاری دادهٔ دمو در Service Worker (Cache API) ── */
  await browser.close();
  browser = await launch(); // همان پروفایل → همان Cache API
  page = await browser.newPage();
  await login();
  await page.goto(`${BASE}/enrichment`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  ok('ماندگاری SW: تعیین‌تکلیف‌شده‌ها پس از ری‌استارت مرورگر', await clickByText('[role="tab"]', 'تعیین‌تکلیف‌شده').then(async () => {
    await new Promise(r => setTimeout(r, 800));
    return page.evaluate(() => [...document.querySelectorAll('.p3-row')].some(r => (r.textContent ?? '').includes('پذیرفته‌شده')));
  }));
  ok('ماندگاری SW: نمای سازمان‌ها پوشش را نگه داشته', await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.table-wrap .confidence-fill')];
    return bars.some(b => parseFloat((b.style.width ?? '0')) > 0);
  }));

  // موبایل ۳۶۰×۷۶۰: نوار تب هاب بدون سرریز
  await page.setViewport({ width: 360, height: 760 });
  await page.goto(`${BASE}/intelligence`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  const mob = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tabs: document.querySelectorAll('nav.tabs:not(.sub-tabs) a').length,
  }));
  ok('موبایل: تب‌های هاب حاضر و بدون سرریز افقی', mob.tabs === 5 && mob.overflow <= 0, JSON.stringify(mob));
} catch (e) {
  console.log('E2E ERROR:', e.message);
  fails++;
} finally {
  await browser.close().catch(() => {});
}
console.log(fails ? `\nE2E FAILED (${fails})` : '\nUI E2E ALL GREEN');
process.exit(fails ? 1 : 0);
