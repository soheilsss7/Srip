/* ============================================================================
   capacity-env-research-ui.mjs — باتری E2E گام ۱۰.۴:
   F03 ممیزی ظرفیت و دارایی (تب ممیزی /program) · F04 کارت محیط/ذی‌نفع/رقیب
   (/intelligence) · F07 طرح پژوهش و داوری (/strategy) — با قواعد سرور.
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

  /* ── ۱) F03 در تب ممیزی ── */
  try { await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('.segmented button, [role=tab]', { timeout: 60000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'ممیزی سه‌گانه');
    btn?.click();
  });
  await page.waitForSelector('section[data-f03] tbody tr', { timeout: 60000 });
  const ca = await page.evaluate(() => {
    const s = document.querySelector('section[data-f03]');
    const t = s?.textContent ?? '';
    return {
      count: s?.querySelectorAll('tbody tr').length,
      person: t.includes('فرد'),
      asset: t.includes('دارایی'),
      risk: t.includes('بالا'),
      action: t.includes('مهاجرت'),
    };
  });
  ok('F03: تب ممیزی — دو برگهٔ بذر (فرد و دارایی) با ریسک بالا و اقدام',
    ca.count === 2 && ca.person && ca.asset && ca.risk && ca.action, JSON.stringify(ca));

  /* قاعدهٔ ریسک بالا بدون اقدام */
  await page.evaluate(() => [...document.querySelectorAll('section[data-f03] button')].find(b => (b.textContent ?? '').includes('برگهٔ ممیزی جدید'))?.click());
  await page.waitForSelector('.modal-backdrop form#ca-form', { timeout: 30000 });
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#ca-form');
    const set = (el, v, ev) => { Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event(ev, { bubbles: true })); };
    const sels = form.querySelectorAll('select');
    const inputs = form.querySelectorAll('input');
    set(inputs[0], 'سرور پشتیبان قدیمی', 'input'); /* نام دارایی */
    set(sels[2], 'HIGH', 'change'); /* ریسک = سومین سِلکت */
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ برگهٔ ممیزی'))?.click());
  await page.waitForFunction(() => (document.querySelector('.modal-backdrop')?.textContent ?? '').includes('بدون اقدام'), { timeout: 30000 });
  ok('F03: ریسک «بالا» بدون اقدام → پیام خطای سرور در فرم', true);
  /* ثبت اقدام و ذخیره */
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#ca-form');
    const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const inputs = [...form.querySelectorAll('input')];
    const act = inputs.find(i => (i.parentElement?.textContent ?? '').includes('اقدام'));
    set(act, 'راه‌اندازی پشتیبان دوم تا پایان ماه');
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ برگهٔ ممیزی'))?.click());
  await page.waitForFunction(() => document.querySelectorAll('section[data-f03] tbody tr').length === 3, { timeout: 30000 });
  ok('F03: با ثبت اقدام، برگهٔ پرریسک ذخیره شد و ردیف سوم ظاهر شد', true);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  /* ── ۲) F04 در هوشمندی ── */
  try { await page.goto(`${BASE}/intelligence`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('section[data-f04] tbody tr', { timeout: 60000 });
  const env = await page.evaluate(() => {
    const s = document.querySelector('section[data-f04]');
    const t = s?.textContent ?? '';
    return {
      count: s?.querySelectorAll('tbody tr').length,
      kinds: t.includes('رقیب') && t.includes('عموم‌ها'),
      alertOn: t.includes('فعال'),
      flowCol: t.includes('وضعیت گردش F05'),
    };
  });
  ok('F04: دو کارت بذر (رقیب مصوب با هشدار فعال + عمومی پیش‌نویس) با ستون گردش F05',
    env.count === 2 && env.kinds && env.alertOn && env.flowCol, JSON.stringify(env));

  /* کارت تازه → تصویب → فعال‌سازی هشدار */
  await page.evaluate(() => [...document.querySelectorAll('section[data-f04] button')].find(b => (b.textContent ?? '').includes('کارت محیط جدید'))?.click());
  await page.waitForSelector('.modal-backdrop form#env-form', { timeout: 30000 });
  await page.evaluate(() => {
    const form = document.querySelector('.modal-backdrop form#env-form');
    const set = (el, v, ev) => { Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event(ev, { bubbles: true })); };
    const sels = form.querySelectorAll('select');
    const inputs = form.querySelectorAll('input');
    set(sels[0], 'STAKEHOLDER', 'change');
    set(inputs[0], 'موضع ذی‌نفع', 'input'); /* نوع اطلاعات */
    set(inputs[1], 'اتاق بازرگانی موضع انتقادی نسبت به طرح طبقه‌بندی گرفت', 'input'); /* نشانهٔ تغییر */
    set(inputs[2], 'بیانیهٔ رسمی اتاق', 'input'); /* منبع */
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ کارت محیط'))?.click());
  await page.waitForFunction(() => document.querySelectorAll('section[data-f04] tbody tr').length === 3, { timeout: 30000 });
  ok('F04: کارت ذی‌نفع تازه ثبت شد (پیش‌نویس، هشدار غیرفعال)', true);
  /* تصویب → فعال‌سازی هشدار */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f04] tbody tr')].find(tr => (tr.textContent ?? '').includes('اتاق بازرگانی'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('تصویب'))?.click();
  });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('section[data-f04] tbody tr')].find(tr => (tr.textContent ?? '').includes('اتاق بازرگانی'));
    return row && (row.textContent ?? '').includes('فعال‌سازی هشدار');
  }, { timeout: 30000 });
  ok('F04: تصویب کارت در گردش F05 → دکمهٔ فعال‌سازی هشدار ظاهر شد', true);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f04] tbody tr')].find(tr => (tr.textContent ?? '').includes('اتاق بازرگانی'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('فعال‌سازی هشدار'))?.click();
  });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('section[data-f04] tbody tr')].find(tr => (tr.textContent ?? '').includes('اتاق بازرگانی'));
    return row && (row.textContent ?? '').includes('فعال') && !(row.textContent ?? '').includes('فعال‌سازی هشدار');
  }, { timeout: 30000 });
  ok('F04: هشدار پس از تصویب فعال شد (چیپ فعال)', true);

  /* ── ۳) F07 در راهبرد ── */
  try { await page.goto(`${BASE}/strategy`, { waitUntil: 'networkidle0', timeout: 90000 }); } catch {}
  await page.waitForSelector('section[data-f07] tbody tr', { timeout: 60000 });
  const res = await page.evaluate(() => {
    const s = document.querySelector('section[data-f07]');
    const t = s?.textContent ?? '';
    return {
      count: s?.querySelectorAll('tbody tr').length,
      published: t.includes('منتشرشده'),
      inReview: t.includes('در داوری'),
      verdictBtn: [...(s?.querySelectorAll('button') ?? [])].some(b => (b.textContent ?? '').includes('رأی داور ۱')),
      publishBtn: [...(s?.querySelectorAll('button') ?? [])].some(b => (b.textContent ?? '').includes('انتشار')),
    };
  });
  ok('F07: دو طرح بذر — منتشرشده با دو تأیید + در داوری با دکمه‌های رأی و انتشار',
    res.count === 2 && res.published && res.inReview && res.verdictBtn && res.publishBtn, JSON.stringify(res));

  /* انتشار res-2 پیش از تکمیل داوران → خطا */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('section[data-f07] tbody tr')].find(tr => (tr.textContent ?? '').includes('در داوری'));
    [...(row?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('انتشار'))?.click();
  });
  await page.waitForFunction(() => (document.querySelector('section[data-f07]')?.textContent ?? '').includes('دو داور مستقل'), { timeout: 30000 });
  ok('F07: انتشار بدون دو داور → پیام خطای سرور (حلقهٔ ۱۵.۳)', true);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nCAPACITY-ENV-RESEARCH-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
