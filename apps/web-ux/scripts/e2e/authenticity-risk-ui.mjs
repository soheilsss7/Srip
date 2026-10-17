/* ============================================================================
   authenticity-risk-ui.mjs — باتری E2E گام ۸.۱: موتور نشانه‌ها و امتیاز ریسک
   ورود demo → /intelligence → پنل «اصالت و ریسک» → سطح‌بندی → باز کردن موضوع →
   دلیل قابل توضیح + شواهد → ثبت نشانه با شاهد → غیرفعال با یادداشت بازبین.
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
  headless: true, defaultViewport: { width: 1280, height: 950 },
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

  /* پنل در هوشمندی */
  try { await page.goto(`${BASE}/intelligence`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.authenticity-risk', { timeout: 30000 });
  ok('پنل «اصالت و ریسک (موتور نشانه‌ها)» در صفحهٔ هوشمندی', true);
  const head = await page.evaluate(() => {
    const t = document.querySelector('.authenticity-risk')?.textContent ?? '';
    return {
      levels: ['کم', 'متوسط', 'بالا', 'بحرانی'].every(l => t.includes(l)),
      actions: t.includes('ثبت و ادامه') && t.includes('قرنطینه + هشدار'),
      rule: t.includes('امتیاز + دلیل + شاهد'),
    };
  });
  ok('چهار سطح ۱۹.۵.۱ با اقدام هر سطح + قاعدهٔ «امتیاز + دلیل + شاهد»',
    head.levels && head.actions && head.rule, JSON.stringify(head));

  /* موضوع با بالاترین امتیاز: منبع روزنامهٔ رسمی (۶۵/بالا) */
  const rows = await page.evaluate(() => [...document.querySelectorAll('.authenticity-risk .listRow')].map(r => (r.textContent ?? '').replace(/\s+/g, ' ').trim()));
  ok('موضوع‌های پایش (کاربر/منبع/سرور/دستگاه) با امتیاز فهرست شدند', rows.length >= 5 && rows.some(r => r.includes('روزنامهٔ رسمی')), `rows=${rows.length}`);

  await page.evaluate(() => [...document.querySelectorAll('.authenticity-risk .listRow > button')].find(b => (b.textContent ?? '').includes('روزنامهٔ رسمی'))?.click());
  await page.waitForFunction(() => (document.querySelector('.authenticity-risk')?.textContent ?? '').includes('وزن ۳۰'), { timeout: 30000 });
  const detail = await page.evaluate(() => {
    const t = document.querySelector('.authenticity-risk')?.textContent ?? '';
    return {
      reason: t.includes('مجموع وزن ۲ نشانهٔ فعال'),
      evid1: t.includes('گواهی TLS منبع «روزنامهٔ رسمی» تازه صادر شده است'),
      evid2: t.includes('فیلد سرمایهٔ ثبتی'),
      family: t.includes('فنی:'),
    };
  });
  ok('دلیل قابل توضیح (وزن هر نشانه) + شاهد هر دو نشانه + خانوادهٔ «فنی»',
    detail.reason && detail.evid1 && detail.evid2 && detail.family, JSON.stringify(detail));

  /* ثبت نشانهٔ تازه با شاهد */
  await page.evaluate(() => [...document.querySelectorAll('.authenticity-risk button')].find(b => (b.textContent ?? '').includes('ثبت نشانهٔ تازه'))?.click());
  await page.waitForSelector('.authenticity-risk select[aria-label="موضوع پایش"]', { timeout: 30000 });
  await page.evaluate(() => {
    const set = (sel, v) => { const el = document.querySelector(sel); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set; d.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('.authenticity-risk select[aria-label="موضوع پایش"]', 'srv-partner-portal');
    set('.authenticity-risk select[aria-label="انتخاب نشانه"]', 'certificate-anomaly');
  });
  await page.evaluate(() => {
    const el = document.querySelector('.authenticity-risk input[aria-label="شاهد نشانه"]');
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
    d.call(el, 'گواهی پورتال شریک دیروز عوض شد');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => [...document.querySelectorAll('.authenticity-risk button')].find(b => (b.textContent ?? '').includes('ثبت نشانه با شاهد'))?.click());
  await page.waitForFunction(() => !document.querySelector('.authenticity-risk select[aria-label="موضوع پایش"]'), { timeout: 30000 });
  const afterAdd = await page.evaluate(async () => {
    const tok = sessionStorage.getItem('srip_access_token');
    const r = await fetch('/api/v1/authenticity/risks', { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json();
    const srv = j.items.find(x => x.id === 'srv-partner-portal');
    return { score: srv.risk.score, level: srv.risk.levelFa, count: srv.signalCount };
  });
  ok('ثبت نشانه با شاهد از رابط → امتیاز سرور ۴۵→۷۵ (بحرانی) و شمارش ۱→۲',
    afterAdd.score === 75 && afterAdd.level === 'بحرانی' && afterAdd.count === 2, JSON.stringify(afterAdd));

  /* غیرفعال کردن با یادداشت بازبین — ردیف evidence تازه در جزئیات سرور */
  await page.evaluate(() => [...document.querySelectorAll('.authenticity-risk .listRow > button')].find(b => (b.textContent ?? '').includes('پورتال شریک'))?.click());
  await page.waitForFunction(() => (document.querySelector('.authenticity-risk')?.textContent ?? '').includes('امضای پیام وبهوک'), { timeout: 30000 });
  await page.evaluate(() => {
    /* دکمهٔ «غیرفعال با یادداشت»ِ ردیفِ خودِ نشانهٔ تازه — نه ردیف والدِ موضوع (closest = نزدیک‌ترین listRow) */
    const btn = [...document.querySelectorAll('.authenticity-risk button')]
      .filter(b => (b.textContent ?? '').includes('غیرفعال با یادداشت'))
      .find(b => b.closest('.listRow')?.textContent.includes('گواهی پورتال شریک دیروز عوض شد'));
    btn?.click();
  });
  await page.waitForSelector('.authenticity-risk input[aria-label="یادداشت بازبین"]', { timeout: 30000 });
  await page.evaluate(() => {
    const el = document.querySelector('.authenticity-risk input[aria-label="یادداشت بازبین"]');
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
    d.call(el, 'گواهی جدید توسط شریک تأیید شد — نگرانی برطرف شد');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 600)); /* صبر برای re-render و فعال‌شدن دکمهٔ ثبت */
  await page.evaluate(() => [...document.querySelectorAll('.authenticity-risk button')].find(b => (b.textContent ?? '').trim() === 'ثبت')?.click());
  let backTo45 = false;
  for (let i = 0; i < 15 && !backTo45; i++) {
    await new Promise(r => setTimeout(r, 1500));
    backTo45 = await page.evaluate(async () => {
      try {
        const tok = sessionStorage.getItem('srip_access_token');
        const r = await fetch('/api/v1/authenticity/risks', { headers: { Authorization: `Bearer ${tok}` } });
        const j = await r.json();
        return Array.isArray(j.items) && j.items.find(y => y.id === 'srv-partner-portal')?.risk?.score === 45;
      } catch { return false; }
    });
  }
  ok('غیرفعال با یادداشت بازبین → امتیاز به ۴۵ برگشت', backTo45);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nAUTHENTICITY-RISK-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
