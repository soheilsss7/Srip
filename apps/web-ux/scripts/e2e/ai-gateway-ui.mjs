/* ============================================================================
   ai-gateway-ui.mjs — باتری E2E گام ۶.۱: درگاه هوش مصنوعی (لوکال + کلید API)
   ورود demo → /ai → تب «درگاه و ارائه‌دهنده‌ها» → سه بذر · آزمون اتصال ·
   ثبت کلید با نمایش یک‌بار و ماسک ۴ رقم · افزودن/حذف ارائه‌دهنده.
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

const browser = await puppeteer.launch({
  executablePath: resolve(E2E_DIR, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E_DIR, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
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
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => localStorage.setItem('srip2_tour_done', '1'));

  /* ── ۱) صفحهٔ /ai و تب درگاه ── */
  try { await page.goto(`${BASE}/ai`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.segmented button', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.segmented button')]
    .some(b => (b.textContent ?? '').includes('درگاه و ارائه‌دهنده‌ها')), { timeout: 30000 });
  ok('صفحهٔ /ai: تب «درگاه و ارائه‌دهنده‌ها» در سگمنت‌ها', true);
  await page.evaluate(() => [...document.querySelectorAll('.segmented button')]
    .find(b => (b.textContent ?? '').includes('درگاه و ارائه‌دهنده‌ها'))?.click());
  await page.waitForSelector('.gateway-panel table tbody tr', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));

  /* ── ۲) سه بذر بخش ۳.۳ ── */
  const rows = () => page.evaluate(() => [...document.querySelectorAll('.gateway-panel .gw-row')].map(tr => tr.textContent ?? ''));
  let r1 = await rows();
  ok('درگاه: سه ارائه‌دهندهٔ بذر دیده می‌شوند (موتور محلی SRIP · Ollama · ابری)', r1.length === 3
    && r1.some(t => t.includes('موتور محلی SRIP')) && r1.some(t => t.includes('Ollama'))
    && r1.some(t => t.includes('ابری')), `rows=${r1.length}`);
  ok('درگاه: دو مسیر لوکال + یک مسیر کلید API با برچسب',
    r1.filter(t => t.includes('مسیر لوکال')).length === 2 && r1.filter(t => t.includes('مسیر کلید API')).length === 1);
  const localRow = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.gateway-panel .gw-row')].find(tr => (tr.textContent ?? '').includes('موتور محلی SRIP'));
    return { txt: row?.textContent ?? '', delBtns: row ? row.querySelectorAll('button[title="حذف"]').length : -1,
      editBtns: row ? row.querySelectorAll('button[title="ویرایش"]').length : -1 };
  });
  ok('درگاه: موتور داخلی «فعال» و حذف‌نشدنی — بدون دکمهٔ حذف/ویرایش',
    localRow.txt.includes('فعال') && localRow.txt.includes('همیشه فعال')
    && localRow.delBtns === 0 && localRow.editBtns === 0, JSON.stringify(localRow));
  ok('درگاه: Ollama «در دسترس نیست» · ابری «غیرفعال» با کلید «ثبت نشده»',
    r1.some(t => t.includes('در دسترس نیست') && t.includes('Ollama'))
    && r1.some(t => t.includes('غیرفعال') && t.includes('ثبت نشده')));

  /* ── ۳) آزمون اتصال: موتور داخلی و Ollama ── */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.gateway-panel .gw-row')].find(tr => (tr.textContent ?? '').includes('موتور محلی SRIP'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('آزمون اتصال'))?.click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.gateway-panel .gw-health-row')].some(tr => (tr.textContent ?? '').includes('srip-deterministic')), { timeout: 30000 });
  ok('آزمون اتصال: موتور داخلی → موفق با مدل srip-deterministic', true);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.gateway-panel .gw-row')].find(tr => (tr.textContent ?? '').includes('Ollama'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('آزمون اتصال'))?.click();
  });
  await page.waitForFunction(() => {
    const rowsH = [...document.querySelectorAll('.gateway-panel .gw-health-row')];
    return rowsH.some(tr => (tr.textContent ?? '').includes('Ollama') && (tr.textContent ?? '').includes('ناموفق'));
  }, { timeout: 30000 });
  ok('آزمون اتصال: Ollama در محیط تست → ناموفق (در دسترس نیست)', true);

  /* ── ۴) ثبت کلید از UI: نمایش یک‌بار + ماسک دائمی ── */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.gateway-panel .gw-row')].find(tr => (tr.textContent ?? '').includes('ابری'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('کلید'))?.click();
  });
  await page.waitForSelector('input[aria-label="کلید API"]', { timeout: 15000 });
  await page.type('input[aria-label="کلید API"]', 'sk-e2e-secret-1234');
  await page.evaluate(() => [...document.querySelectorAll('.modal-card button')].find(b => (b.textContent ?? '').includes('ثبت کلید'))?.click());
  await page.waitForFunction(() => (document.querySelector('.gw-onetime-key')?.textContent ?? '').includes('sk-e2e-secret-1234'), { timeout: 30000 });
  const noticeShown = await page.evaluate(() => (document.querySelector('.modal-card')?.textContent ?? '').includes('فقط همین یک‌بار'));
  ok('کلید: نمایش یک‌بار کلید کامل + هشدار در مودال', noticeShown);
  await page.evaluate(() => [...document.querySelectorAll('.modal-card button')].find(b => (b.textContent ?? '').includes('ذخیره کردم'))?.click());
  await page.waitForFunction(() => !document.querySelector('.gw-onetime-key'), { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));
  const afterKey = await page.evaluate(() => ({
    masked: (document.querySelector('.gateway-panel')?.textContent ?? '').includes('••••1234'),
    leaked: (document.querySelector('.gateway-panel')?.textContent ?? '').includes('sk-e2e-secret-1234'),
    active: [...document.querySelectorAll('.gateway-panel .gw-row')].some(tr => (tr.textContent ?? '').includes('ابری') && tr.textContent.includes('فعال')),
  }));
  ok('کلید: پس از بستن — ماسک ••••1234 و کلید کامل در صفحه نیست', afterKey.masked && !afterKey.leaked);
  ok('کلید: ابری با کلید → فعال', afterKey.active);

  /* ── ۵) افزودن و حذف ارائه‌دهنده از UI ── */
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel button')].find(b => (b.textContent ?? '').includes('افزودن ارائه‌دهنده'))?.click());
  await page.waitForSelector('.modal-card input', { timeout: 15000 });
  await page.evaluate(() => {
    const modal = document.querySelector('.modal-card');
    const inputs = [...modal.querySelectorAll('input')];
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], 'Ollama سرور دوم');
    set(inputs[1], 'http://localhost:11500/v1');
    set(inputs[2], 'llama3.1');
  });
  await page.evaluate(() => [...document.querySelectorAll('.modal-card button')].find(b => (b.textContent ?? '').includes('ثبت ارائه‌دهنده'))?.click());
  await page.waitForFunction(() => [...document.querySelectorAll('.gateway-panel .gw-row')].some(tr => (tr.textContent ?? '').includes('Ollama سرور دوم')), { timeout: 30000 });
  const newRowLocal = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.gateway-panel .gw-row')].find(x => (x.textContent ?? '').includes('Ollama سرور دوم'));
    return (tr?.textContent ?? '').includes('مسیر لوکال');
  });
  ok('افزودن: «Ollama سرور دوم» با مسیر لوکال ثبت شد', newRowLocal);
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.gateway-panel .gw-row')].find(x => (x.textContent ?? '').includes('Ollama سرور دوم'));
    [...(tr?.querySelectorAll('button') ?? [])].find(b => b.querySelector('svg') && b.getAttribute('title') === 'حذف')?.click();
  });
  await page.waitForFunction(() => ![...document.querySelectorAll('.gateway-panel .gw-row')].some(tr => (tr.textContent ?? '').includes('Ollama سرور دوم')), { timeout: 30000 });
  ok('حذف: ردیف دلخواه حذف شد (موتور داخلی ماند)', (await rows()).length === 3);

  /* ── ۶) گام ۶.۲ — مسیریابی کاربردها (لوکال-اول) ── */
  await page.waitForSelector('.gateway-panel .gw-route-row', { timeout: 30000 });
  const routeInfo = await page.evaluate(() => {
    const rowsR = [...document.querySelectorAll('.gateway-panel .gw-route-row')];
    return { count: rowsR.length,
      allLocal: rowsR.every(tr => {
        const sel = tr.querySelector('select');
        return (sel?.selectedOptions?.[0]?.textContent ?? '').includes('موتور محلی SRIP');
      }),
      allUsable: rowsR.every(tr => (tr.textContent ?? '').includes('در دسترس')) };
  });
  ok('مسیریابی: هفت کاربرد — همه با اصلیِ «موتور محلی SRIP» و مسیر در دسترس',
    routeInfo.count === 7 && routeInfo.allLocal && routeInfo.allUsable, JSON.stringify(routeInfo));
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('.gateway-panel .gw-route-row')].find(x => (x.textContent ?? '').includes('اولویت‌بندی فرصت'));
    const sel = tr.querySelector('select');
    const opt = [...sel.options].find(o => (o.textContent ?? '').includes('ابری'));
    if (opt) { const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; s.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    [...(tr?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('ذخیرهٔ مسیر'))?.click();
  });
  await page.waitForFunction(() => {
    const tr = [...document.querySelectorAll('.gateway-panel .gw-route-row')].find(x => (x.textContent ?? '').includes('اولویت‌بندی فرصت'));
    const sel = tr?.querySelector('select');
    return sel && (sel.selectedOptions?.[0]?.textContent ?? '').includes('ابری');
  }, { timeout: 30000 });
  ok('مسیریابی: تغییر «اولویت‌بندی فرصت» به ارائه‌دهندهٔ ابری ذخیره شد', true);

  /* ── ۷) گام ۶.۲ — خط‌مشی کنترل داده (پوشاندن/معافیت/پالایش) ── */
  await page.waitForSelector('.gateway-panel .ai-quick-chip[aria-pressed]', { timeout: 15000 });
  const patCount = await page.evaluate(() =>
    [...document.querySelectorAll('.gateway-panel .ai-quick-chip[aria-pressed]')].filter(b => (b.textContent ?? '').includes('کد ملی') || (b.textContent ?? '').includes('شبا') || (b.textContent ?? '').includes('موبایل') || (b.textContent ?? '').includes('کارت') || (b.textContent ?? '').includes('محرمانه')).length);
  ok('خط‌مشی: کاتالوگ الگوهای پوشاندن دیده می‌شود', patCount >= 4, `patterns=${patCount}`);
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel button')].find(b => (b.textContent ?? '').includes('پیش‌نمایش کنترل داده'))?.click());
  await page.waitForSelector('.gw-preview .gw-masked', { timeout: 30000 });
  const pvCloud = await page.evaluate(() => ({
    masked: document.querySelector('.gw-masked')?.textContent ?? '',
    findings: [...document.querySelectorAll('.gw-preview .chip.warning')].length,
    boundary: (document.querySelector('.gw-preview details')?.textContent ?? ''),
  }));
  ok('پیش‌نمایش ابری: کد ملی/موبایل/شبا پوشانده شد + یافته‌ها',
    pvCloud.masked.includes('[کد ملی پوشانده شد]') && pvCloud.masked.includes('[موبایل پوشانده شد]')
    && !pvCloud.masked.includes('1234567890') && pvCloud.findings >= 3, JSON.stringify(pvCloud.findings));
  ok('پیش‌نمایش ابری: مرز داده/دستور با بلوک صریح BEGIN-DATA', pvCloud.boundary.includes('BEGIN-DATA'));
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel button')].find(b => (b.textContent ?? '').includes('مسیر لوکال (معاف از پوشاندن)'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel button')].find(b => (b.textContent ?? '').includes('پیش‌نمایش کنترل داده'))?.click());
  await page.waitForFunction(() => {
    const box = document.querySelector('.gw-masked');
    return box && (box.textContent ?? '').includes('1234567890');
  }, { timeout: 30000 });
  ok('پیش‌نمایش لوکال: ورودی معاف — کد ملی دست‌نخورده', true);
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel button')].find(b => (b.textContent ?? '').includes('مسیر ابری (کلید API)'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel .ai-quick-chip[aria-pressed]')].find(b => (b.textContent ?? '').includes('کد ملی'))?.click());
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => [...document.querySelectorAll('.gateway-panel button')].find(b => (b.textContent ?? '').includes('پیش‌نمایش کنترل داده'))?.click());
  await page.waitForFunction(() => {
    const box = document.querySelector('.gw-masked');
    return box && (box.textContent ?? '').includes('1234567890') && (box.textContent ?? '').includes('[موبایل پوشانده شد]');
  }, { timeout: 30000 });
  ok('خط‌مشی: خاموش‌کردن الگوی کد ملی → فقط آن معاف می‌شود (موبایل همچنان پوشانده)', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nAI-GATEWAY-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
