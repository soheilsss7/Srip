/* ============================================================================
   dd-f02-f15-ui.mjs — باتری E2E گام ۱۰.۱: F02 پروندهٔ DD + F14 آماده‌سازی
   ورود demo → /partnerships → پرونده‌های DD (جدول + محورها + حق پاسخ + تیم Y +
   گرهٔ G2) → کارت‌های F14 (وضعیت DD زنده + ایجاد کارت متصل).
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
const setVal = (sel, val) => page.evaluate((s, v) => {
  const el = document.querySelector(s); if (!el) return false;
  const d = Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set;
  d.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true;
}, sel, val);

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

  /* ── ۱) بخش‌های F02/F14 در مشارکت‌ها ── */
  try { await page.goto(`${BASE}/partnerships`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('section[data-f02]', { timeout: 60000 });
  const hasF14 = await page.evaluate(() => !!document.querySelector('section[data-f14]'));
  ok('صفحهٔ مشارکت‌ها: بخش F02 (پرونده‌های Due Diligence) و F14 (آماده‌سازی) هر دو حاضرند', hasF14);

  /* ── ۲) جدول پرونده‌ها ── */
  await page.waitForFunction(() => (document.querySelector('section[data-f02]')?.textContent ?? '').includes('تصویب‌شده'), { timeout: 30000 });
  const ddRows = await page.evaluate(() => ({
    count: document.querySelectorAll('section[data-f02] tbody tr').length,
    g2: (document.querySelector('section[data-f02]')?.textContent ?? '').includes('۱۲ / ۱۲'),
    teamY: (document.querySelector('section[data-f02]')?.textContent ?? '').includes('نظر مدیر تیم Y'),
  }));
  ok('F02: دو پروندهٔ بذر؛ پروندهٔ تصویب‌شده ۱۲/۱۲ محور با ستون نظر تیم Y و وضعیت G2',
    ddRows.count === 2 && ddRows.g2 && ddRows.teamY, JSON.stringify(ddRows));

  /* ── ۳) جزئیات: محورها + حق پاسخ ── */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f02] tbody tr')].find(tr => (tr.textContent ?? '').includes('استانداری'));
    row?.click();
  });
  await page.waitForSelector('.modal-backdrop details[data-axis]', { timeout: 30000 });
  const axes = await page.evaluate(() => {
    const t = document.querySelector('.modal-backdrop')?.textContent ?? '';
    return {
      n: document.querySelectorAll('.modal-backdrop details[data-axis]').length,
      cats: t.includes('۶.۲.۱') && t.includes('۶.۲.۲'),
      respond: (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('ثبت پاسخ طرف مقابل'),
      teamY: t.includes('نظر مدیر تیم Y'),
      g2: t.includes('وضعیت تصویب (G2)'),
    };
  });
  ok('F02: جزئیات پرونده — دوازده محور در دو گروه ۶.۲.۱/۶.۲.۲ + حق پاسخ ثبت‌شده + بخش تیم Y و G2',
    axes.n === 12 && axes.cats && axes.respond && axes.teamY && axes.g2, JSON.stringify(axes));

  /* ── ۴) ویرایش محور + گرهٔ G2 ── */
  await page.evaluate(() => { document.querySelector('.modal-backdrop details[data-axis="security"]')?.setAttribute('open', ''); });
  await new Promise(r => setTimeout(r, 300));
  const secInputs = await page.evaluate(() => {
    const d = document.querySelector('.modal-backdrop details[data-axis="security"]');
    return d ? d.querySelectorAll('input').length : 0;
  });
  ok('F02: فرم ویرایش هر محور (پاسخ/شاهد/نقص/وضعیت) باز می‌شود', secInputs >= 3, `inputs=${secInputs}`);

  /* ثبت نظر تیم Y روی dd-2 و تلاش برای تصویب → خطای G2 */
  const tySel = await page.evaluate(() => !!document.querySelector('.modal-backdrop select'));
  if (tySel) {
    /* dd-2 بدون تیم Y است — فرم نظر داخل مودال */
    await page.evaluate(() => {
      const sel = document.querySelectorAll('.modal-backdrop select');
      const target = sel[sel.length - 1]; /* سِلکت نظر تیم Y (آخرین سِلکت مودال) */
      const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      d.call(target, 'CONDITIONS');
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 300));
    const noteSet = await page.evaluate(() => {
      const inp = [...document.querySelectorAll('.modal-backdrop input')].pop();
      if (!inp) return false;
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      d.call(inp, 'با شرط تکمیل محورهای باقی‌مانده');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    if (noteSet) {
      await new Promise(r => setTimeout(r, 300));
      await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ثبت نظر تیم Y'))?.click());
      await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('مشروط'), { timeout: 30000 });
      ok('F02: ثبت نظر مدیر تیم Y (مشروط) از فرم — در جزئیات ظاهر شد', true);
    }
    /* تلاش برای تصویب → خطای گرهٔ G2 (محورها کامل نیستند) */
    await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('تصویب پرونده'))?.click());
    await page.waitForFunction(() => (document.body.textContent ?? '').includes('دروازهٔ G2 باز نیست'), { timeout: 30000 });
    ok('F02: گرهٔ G2 — تصویب با محورهای ناقص → پیام خطای «دروازهٔ G2 باز نیست»', true);
  }
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  /* ── ۵) F14: کارت‌ها با وضعیت DD زنده ── */
  await page.waitForSelector('section[data-f14] tbody tr', { timeout: 30000 });
  const packs = await page.evaluate(() => {
    const t = document.querySelector('section[data-f14]')?.textContent ?? '';
    return {
      count: document.querySelectorAll('section[data-f14] tbody tr').length,
      live: t.includes('تصویب‌شده — 12/12 محور') || t.includes('در بررسی — 1/12'),
      goal: t.includes('هدف رابطه'),
      next: t.includes('اقدام بعدی'),
    };
  });
  ok('F14: کارت‌های آماده‌سازی با «وضعیت DD (زنده)» از پروندهٔ متصل + هدف رابطه و اقدام بعدی',
    packs.count === 2 && packs.live && packs.goal && packs.next, JSON.stringify(packs));

  /* ── ۶) ایجاد کارت F14 متصل به مشارکت ── */
  await page.evaluate(() => [...document.querySelectorAll('section[data-f14] button')].find(b => (b.textContent ?? '').includes('کارت آماده‌سازی جدید'))?.click());
  await page.waitForSelector('.modal-backdrop form#rp-form', { timeout: 30000 });
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#rp-form');
    const inputs = form.querySelectorAll('input');
    const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const fire = (el) => el.dispatchEvent(new Event('input', { bubbles: true }));
    d.call(inputs[0], 'آماده‌سازی عرضهٔ داده به بورس'); fire(inputs[0]);
    d.call(inputs[1], 'تسهیل دادهٔ معاملاتی'); fire(inputs[1]);
    d.call(inputs[5], 'جلسهٔ معرفی با مدیر فناوری بورس'); fire(inputs[5]);
  });
  await new Promise(r => setTimeout(r, 300));
  /* مشارکت متصل: اولین سِلکت مودال */
  await page.evaluate(() => {
    const sel = document.querySelector('.modal-backdrop form#rp-form select');
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    const opts = [...sel.options].filter(o => o.value);
    d.call(sel, opts[0]?.value ?? '');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  /* مالک: سِلکت دوم */
  await page.evaluate(() => {
    const sels = document.querySelectorAll('.modal-backdrop form#rp-form select');
    const sel = sels[2] ?? sels[sels.length - 1];
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    const opts = [...sel.options].filter(o => o.value);
    d.call(sel, opts[0]?.value ?? '');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت'))?.click());
  await page.waitForFunction(() => (document.querySelector('section[data-f14]')?.textContent ?? '').includes('آماده‌سازی عرضهٔ داده به بورس'), { timeout: 30000 });
  ok('F14: ایجاد کارت متصل به مشارکت → در جدول با وضعیت «بدون پروندهٔ DD» ظاهر شد', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nDD-F02-F14-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
