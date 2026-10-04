/* ============================================================================
   authenticity-cases-ui.mjs — باتری E2E گام ۸.۲: پروندهٔ اصالت F13
   ورود demo → /intelligence → پنل «پرونده‌های اصالت (F13)» → پروندهٔ باز خوشهٔ
   دستگاه → بازبینی انسانی (تأیید با یادداشت) → اعمال محدودیت → اعتراض →
   ابطال (OVERTURNED) → بسته شدن.
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
  headless: true, defaultViewport: { width: 1280, height: 950 },
});
const page = await browser.newPage();

const clickBtn = (txt) => page.evaluate((t) => {
  [...document.querySelectorAll('.authenticity-cases button')]
    .find(b => (b.textContent ?? '').includes(t))?.click();
}, txt);
const waitFormClosed = () => page.waitForFunction(() => !document.querySelector('.authenticity-cases input[aria-label="یادداشت تصمیم"]'), { timeout: 30000 });
const waitBtn = (txt) => page.waitForFunction((t2) => [...document.querySelectorAll('.authenticity-cases button')].some(b => (b.textContent ?? '').includes(t2)), { timeout: 30000 }, txt);
const setNote = (v) => page.evaluate((val) => {
  const el = document.querySelector('.authenticity-cases input[aria-label="یادداشت تصمیم"]');
  const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
  d.call(el, val);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
const ac1RowHas = (txt) => page.waitForFunction((t2) => {
  const row = [...document.querySelectorAll('.authenticity-cases .listRow')].find(r => (r.textContent ?? '').includes('خوشهٔ دستگاه'));
  return !!row && (row.textContent ?? '').includes(t2);
}, { timeout: 30000 }, txt);

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

  try { await page.goto(`${BASE}/intelligence`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.authenticity-cases', { timeout: 30000 });
  ok('پنل «پرونده‌های اصالت (F13)» زیر پنل اصالت و ریسک', true);
  const head = await page.evaluate(() => {
    const t = document.querySelector('.authenticity-cases')?.textContent ?? '';
    return { levels: t.includes('قرنطینه + هشدار') && t.includes('ثبت و ادامه'),
      rule: t.includes('فقط پس از بازبینی انسانی'),
      open: t.includes('خوشهٔ دستگاه'), closed: t.includes('client@arya-tech.ir') };
  });
  ok('سیاست چهارسطحی + قاعدهٔ بازبینی انسانی + دو پروندهٔ بذر (باز و بسته)',
    head.levels && head.rule && head.open && head.closed, JSON.stringify(head));

  /* بازبینی انسانی: تأیید با یادداشت */
  await waitBtn('بازبینی: تأیید اقدام');
  await clickBtn('بازبینی: تأیید اقدام');
  await page.waitForSelector('.authenticity-cases input[aria-label="یادداشت تصمیم"]', { timeout: 30000 });
  await setNote('الگوی مزرعهٔ دستگاه با پایش شبکه تأیید شد');
  await new Promise(r => setTimeout(r, 600));
  await clickBtn('ثبت تأیید بازبین');
  await waitFormClosed();
  await ac1RowHas('demo@srip.local');
  ok('بازبینی انسانی با یادداشت → بازبین در پروندهٔ خوشهٔ دستگاه ثبت شد', true);

  /* اعمال اقدام محدودکننده پس از بازبینی */
  await waitBtn('اعمال اقدام محدودکننده');
  await clickBtn('اعمال اقدام محدودکننده');
  await page.waitForSelector('.authenticity-cases input[aria-label="یادداشت تصمیم"]', { timeout: 30000 });
  await setNote('اعمال پس از تأیید بازبین');
  await new Promise(r => setTimeout(r, 600));
  await clickBtn('اعمال پس از بازبینی');
  await waitFormClosed();
  await ac1RowHas('محدودیت اعمال‌شده');
  ok('اعمال محدودیت موقت پس از بازبینی → نشان «محدودیت اعمال‌شده»', true);

  /* اعتراض و ابطال */
  await waitBtn('ثبت اعتراض');
  await clickBtn('ثبت اعتراض');
  await page.waitForSelector('.authenticity-cases input[aria-label="یادداشت تصمیم"]', { timeout: 30000 });
  await setNote('این دستگاه‌ها ترمینال‌های سازمانی هستند');
  await new Promise(r => setTimeout(r, 600));
  await clickBtn('ثبت اعتراض');
  await waitFormClosed();
  await waitBtn('نتیجهٔ اعتراض');
  await clickBtn('نتیجهٔ اعتراض');
  await page.waitForSelector('.authenticity-cases select[aria-label="نتیجهٔ اعتراض"]', { timeout: 30000 });
  await page.evaluate(() => {
    const el = document.querySelector('.authenticity-cases select[aria-label="نتیجهٔ اعتراض"]');
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
    d.call(el, 'OVERTURNED');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await setNote('مستندات ترمینال‌های سازمانی پذیرفته شد');
  await new Promise(r => setTimeout(r, 600));
  await clickBtn('ثبت نتیجه');
  await waitFormClosed();
  await ac1RowHas('ابطال — محدودیت برداشته شد');
  const finalState = await page.evaluate(async () => {
    const tok = sessionStorage.getItem('srip_access_token');
    const r = await fetch('/api/v1/authenticity/cases', { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json();
    const c = j.items.find(x => x.id === 'ac-1');
    return { status: c.status, enforced: c.enforcedAction, outcome: c.outcome, appeal: c.appeal?.outcome };
  });
  ok('ابطال اعتراض (OVERTURNED) → محدودیت برداشته و پرونده بسته شد',
    finalState.status === 'RESOLVED' && !finalState.enforced && finalState.outcome === 'APPEAL_OVERTURNED' && finalState.appeal === 'OVERTURNED',
    JSON.stringify(finalState));
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nAUTHENTICITY-CASES-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
