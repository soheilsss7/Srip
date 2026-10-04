/* ============================================================================
   exec-role-cards-ui.mjs — باتری E2E گام ۱۰.۳: F01 کنترل اجرا + F16 کارت نقش
   ورود demo → /projects (کنترل اجرا: جدول + قواعد بلاک/تکمیل) → /people
   (کارت نقش: چارت + تأیید نهایی با اهداف ۳۰/۶۰/۹۰).
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
  headless: true, defaultViewport: { width: 1280, height: 1050 },
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

  /* ── ۱) بخش کنترل اجرا در پروژه‌ها ── */
  try { await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('section[data-f01] tbody tr', { timeout: 60000 });
  const ec = await page.evaluate(() => {
    const s = document.querySelector('section[data-f01]');
    const t = s?.textContent ?? '';
    return {
      count: s?.querySelectorAll('tbody tr').length,
      codes: t.includes('P01') && t.includes('P02'),
      blocked: t.includes('بلاک'),
      scopeCol: t.includes('تغییر دامنه'),
      onTrack: t.includes('در مسیر'),
    };
  });
  ok('F01: دو کنترل اجرای بذر P01/P02 با وضعیت‌ها و ستون تغییر دامنه',
    ec.count === 2 && ec.codes && ec.blocked && ec.scopeCol && ec.onTrack, JSON.stringify(ec));

  /* ── ۲) قاعدهٔ بلاک بدون مانع → خطای سرور در فرم ── */
  await page.evaluate(() => [...document.querySelectorAll('section[data-f01] button')].find(b => (b.textContent ?? '').includes('کنترل اجرای جدید'))?.click());
  await page.waitForSelector('.modal-backdrop form#ec-form', { timeout: 30000 });
  const ecSelectCount = await page.evaluate(() => document.querySelectorAll('.modal-backdrop form#ec-form select').length);
  await page.evaluate((nSels) => {
    const form = document.querySelector('.modal-backdrop form#ec-form');
    const set = (el, v, ev) => { Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event(ev, { bubbles: true })); };
    const inputs = form.querySelectorAll('input');
    const sels = form.querySelectorAll('select');
    set(sels[0], [...sels[0].options].filter(o => o.value)[0]?.value ?? '', 'change'); /* پروژه */
    set(inputs[0], 'پایش امنیت بانک پارس فاز دوم', 'input'); /* هدف */
    set(inputs[1], 'مانیتورینگ و گزارش‌های رگولاتوری', 'input'); /* دامنه */
    set(sels[1], [...sels[1].options].filter(o => o.value)[0]?.value ?? '', 'change'); /* مالک */
    set(inputs[inputs.length - 1], '2026-12-15', 'input'); /* مهلت (input تاریخ) */
    set(sels[nSels - 1], 'BLOCKED', 'change'); /* وضعیت = آخرین سِلکت */
  }, ecSelectCount);
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کنترل اجرا'))?.click());
  await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('نیازمند ثبت مانع'), { timeout: 30000 });
  ok('F01: قاعدهٔ وضعیت — «بلاک» بدون مانع → پیام خطای سرور در فرم', true);
  /* ثبت مانع و ذخیره */
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#ec-form');
    const inputs = [...form.querySelectorAll('input')];
    const blocker = inputs.find(i => (i.parentElement?.textContent ?? '').includes('مانع'));
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(blocker, 'منتظر دسترسی لاگ سامانهٔ بانک');
    blocker.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کنترل اجرا'))?.click());
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('section[data-f01] tbody tr');
    return rows.length === 3;
  }, { timeout: 30000 });
  ok('F01: با ثبت مانع، کنترل بلاک ذخیره شد و ردیف سوم ظاهر شد (کد P03)', true);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  /* ── ۳) بخش کارت نقش در افراد ── */
  try { await page.goto(`${BASE}/people`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('section[data-f16] tbody tr', { timeout: 60000 });
  const rc = await page.evaluate(() => {
    const s = document.querySelector('section[data-f16]');
    const t = s?.textContent ?? '';
    return {
      count: s?.querySelectorAll('tbody tr').length,
      approved: t.includes('تأییدشده'),
      goals: t.includes('اهداف ۳۰/۶۰/۹۰'),
      approveBtn: [...(s?.querySelectorAll('button') ?? [])].some(b => (b.textContent ?? '').includes('تأیید نهایی')),
    };
  });
  ok('F16: دو کارت نقش بذر؛ یکی تأییدشده و یکی با دکمهٔ «تأیید نهایی»',
    rc.count === 2 && rc.approved && rc.goals && rc.approveBtn, JSON.stringify(rc));

  /* ── ۴) کارت تازه با اهداف ناقص: تأیید → خطا؛ تکمیل → تأیید ── */
  await page.evaluate(() => [...document.querySelectorAll('section[data-f16] button')].find(b => (b.textContent ?? '').includes('کارت نقش جدید'))?.click());
  await page.waitForSelector('.modal-backdrop form#rc-form', { timeout: 30000 });
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#rc-form');
    const set = (el, v, ev) => { Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event(ev, { bubbles: true })); };
    const sels = form.querySelectorAll('select');
    const free = [...sels[0].options].find(o => o.value && !o.disabled); /* نقش بدون کارت */
    set(sels[0], free?.value ?? '', 'change');
    const inputs = form.querySelectorAll('input');
    set(inputs[0], 'مالکیت چرخهٔ عملیات و پایش سامانه‌ها', 'input'); /* مأموریت */
    set(inputs[4], 'دو هفته همراهی با تیم عملیات', 'input'); /* مسیر ورود */
    set(inputs[6], 'آشنایی با پنج سامانهٔ کلیدی', 'input'); /* هدف ۳۰ */
    /* هدف ۶۰ و ۹۰ خالی می‌ماند */
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت نقش'))?.click());
  await page.waitForFunction(() => document.querySelectorAll('section[data-f16] tbody tr').length === 3, { timeout: 30000 });
  ok('F16: کارت نقش تازه از چارت (اهداف ۶۰/۹۰ خالی) ثبت شد', true);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f16] tbody tr')].find(tr => (tr.textContent ?? '').includes('ناقص'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('تأیید نهایی'))?.click();
  });
  await page.waitForFunction(() => (document.querySelector('section[data-f16]')?.textContent ?? '').includes('نیازمند اهداف ۳۰، ۶۰ و ۹۰'), { timeout: 30000 });
  ok('F16: تأیید نهایی با اهداف ناقص → پیام خطای سرور', true);
  /* تکمیل هدف ۶۰/۹۰ از فرم ویرایش و تأیید */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f16] tbody tr')].find(tr => (tr.textContent ?? '').includes('ناقص'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('ویرایش'))?.click();
  });
  await page.waitForSelector('.modal-backdrop form#rc-form', { timeout: 30000 });
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#rc-form');
    const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const inputs = [...form.querySelectorAll('input')];
    const g60 = inputs.find(i => (i.parentElement?.textContent ?? '').includes('۶۰'));
    const g90 = inputs.find(i => (i.parentElement?.textContent ?? '').includes('۹۰'));
    set(g60, 'مالکیت کامل چرخهٔ رخداد');
    set(g90, 'گذراندن ممیزی امنیتی بدون یافتهٔ بحرانی');
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت نقش'))?.click());
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    /* کارت تازه (اهدافش تازه کامل شد) آخرین ردیف جدول است — آخرین دکمهٔ تأیید */
    const btns = [...document.querySelectorAll('section[data-f16] tbody button')].filter(b => (b.textContent ?? '').includes('تأیید نهایی'));
    btns[btns.length - 1]?.click();
  });
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('section[data-f16] tbody tr');
    const approved = [...rows].filter(tr => (tr.textContent ?? '').includes('تأییدشده')).length;
    return rows.length === 3 && approved === 2 && ![...rows].some(tr => (tr.textContent ?? '').includes('ناقص'));
  }, { timeout: 30000 });
  ok('F16: پس از تکمیل اهداف ۶۰/۹۰، تأیید نهایی کارت تازه ثبت شد (دو تأییدشده، بدون کارت ناقص)', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nEXEC-ROLE-CARDS-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
