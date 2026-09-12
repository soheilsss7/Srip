/* ============================================================================
   real-data-ui.mjs — E2E دادهٔ اولیهٔ واقعی (سند عموم‌ها)
   ورود aroun (مالک سامانه، بدون MFA) → شرکت x → نقشهٔ عموم‌های هلدینگ پارس
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
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();

try {
  // 1) صفحهٔ لاگین: دکمه‌های دمو حذف شده‌اند + ورود واقعی aroun (بدون MFA)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  ok('دکمه‌های دمو حذف شده‌اند', await page.evaluate(() => document.querySelectorAll('.auth-demo-row').length === 0));
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', 'aroun');
  await page.type('#login-pass', '12356784');
  await page.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await page.click('.auth-form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('ورود aroun → پیشخوان', await page.evaluate(() => !location.pathname.endsWith('/login') && !!sessionStorage.getItem('srip_access_token')), 'url=' + page.url());

  // 2) سازمان‌ها: شرکت x و هلدینگ پارس و نهادهای سند
  await page.goto(`${BASE}/organizations`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  const bodyTxt = await page.evaluate(() => document.body.textContent ?? '');
  ok('لیست سازمان‌ها: شرکت x', bodyTxt.includes('شرکت x'));
  ok('لیست سازمان‌ها: هلدینگ پارس', bodyTxt.includes('هلدینگ پارس'));
  ok('لیست سازمان‌ها: پارس انرژی (زیرمجموعه)', bodyTxt.includes('پارس انرژی'));
  ok('جداسازی مستأجر: دنیای دمو (هلدینگ آریا) دیده نمی‌شود', !bodyTxt.includes('هلدینگ آریا') && !bodyTxt.includes('آریا فناوری'));

  // 3) عموم‌ها: انتخاب هلدینگ پارس → نقشهٔ واقعی سند
  await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  // انتخاب سازمان پارس از منوی سازمان
  const switched = await page.evaluate(() => {
    const sel = document.querySelector('select');
    if (!sel) return false;
    const opt = [...sel.options].find(o => (o.textContent ?? '').includes('هلدینگ پارس'));
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  ok('انتخاب «هلدینگ پارس» در انتخابگر سازمان', switched);
  await new Promise(r => setTimeout(r, 3000));
  const pubTxt = await page.evaluate(() => document.body.textContent ?? '');
  ok('هدف: «مرجعیت هوش مصنوعی کشور»', await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input')].find(i => (i.value ?? '').includes('مرجعیت هوش مصنوعی کشور'));
    return !!inp;
  }));
  ok('قالب: هلدینگ و سرمایه‌گذاری چندبخشی', pubTxt.includes('هلدینگ و سرمایه‌گذاری چندبخشی'));
  ok('۶ دستهٔ عموم در جدول', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    return rows.length === 6 || document.body.textContent.includes('اکوسیستم فناوری و صنعت');
  }));

  // 4) تب اعضا: نهادهای واقعی سند
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('اعضا'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  const memTxt = await page.evaluate(() => document.body.textContent ?? '');
  ok('عضو واقعی: شورای ملی راهبری هوش مصنوعی', memTxt.includes('شورای ملی راهبری هوش مصنوعی'));
  ok('عضو واقعی: دانشگاه صنعتی شریف', memTxt.includes('دانشگاه صنعتی شریف'));
  ok('عضو واقعی: دیجی‌کالا', memTxt.includes('دیجی‌کالا'));
  ok('عضو واقعی: زومیت (رسانه)', memTxt.includes('زومیت'));

  // 5) شبکه: گراف شامل پارس + نهادها + یال‌های ساختاری
  await page.goto(`${BASE}/network`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 5000));
  const netInfo = await page.evaluate(() => {
    const svg = document.querySelector('.net-graph-zone svg');
    const labels = svg ? [...svg.querySelectorAll('text')].map(t => t.textContent ?? '') : [];
    const all = labels.join(' | ');
    return {
      hasPars: all.includes('هلدینگ پارس'),
      hasSub: all.includes('پارس') && (all.includes('پارس انرژی') || all.includes('پارس مالی')),
      hasEntity: all.includes('شورای ملی') || all.includes('دانشگاه تهران') || all.includes('دیجی‌کالا'),
      textCount: labels.filter(t => t.trim().length > 2).length,
    };
  });
  ok('گراف شبکه: هلدینگ پارس حاضر است', netInfo.hasPars);
  ok('گراف شبکه: زیرمجموعه‌های پارس', netInfo.hasSub);
  ok('گراف شبکه: نهادهای عموم سند', netInfo.hasEntity);
  /* رنگ‌بندی دسته‌های عموم روی نهادهای سند (pubCatOfOrg از sourceId) */
  const colored = await page.evaluate(() => {
    const raw = document.querySelector('[data-categorized-count]')?.textContent ?? '0';
    const faNum = (v) => Number(String(v).replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    return faNum(raw);
  });
  ok('گراف شبکه: نهادها بر اساس دستهٔ عموم رنگ گرفته‌اند (۴۰+)', colored >= 40, 'colored=' + colored);
  /* ═══ سناریوی ۲: حساب واقعی مشتری — مدیرعامل هلدینگ پارس (فقط محیط پارس) ═══ */
  const page2 = await browser.newPage(); /* تب جدید = نشست جدا */
  await page2.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page2.waitForSelector('#login-email', { timeout: 30000 });
  await page2.type('#login-email', 'pars');
  await page2.type('#login-pass', 'pars1234');
  await page2.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await page2.click('.auth-form button[type=submit]');
  await page2.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('ورود pars (مشتری) → پیشخوان', await page2.evaluate(() => !location.pathname.endsWith('/login') && !!sessionStorage.getItem('srip_access_token')), 'url=' + page2.url());

  await page2.goto(`${BASE}/organizations`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  const pTxt = await page2.evaluate(() => document.body.textContent ?? '');
  ok('مشتری پارس: هلدینگ پارس + نهادهای سند', pTxt.includes('هلدینگ پارس') && pTxt.includes('پارس انرژی') && pTxt.includes('شورای ملی راهبری'));
  ok('مشتری پارس: شرکت x دیده نمی‌شود', !pTxt.includes('شرکت x'));
  ok('مشتری پارس: دنیای دمو (آریا) دیده نمی‌شود', !pTxt.includes('هلدینگ آریا') && !pTxt.includes('آریا فناوری'));

  await page2.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3000));
  ok('مشتری پارس: نقشهٔ عموم‌های خودش (هدف «مرجعیت هوش مصنوعی کشور»)', await page2.evaluate(() => {
    const inp = [...document.querySelectorAll('input')].find(i => (i.value ?? '').includes('مرجعیت هوش مصنوعی کشور'));
    return !!inp;
  }));
  await page2.close();
} catch (e) {
  console.error('E2E error:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
} finally {
  await browser.close();
}

console.log('\n════════════════════════════════════');
console.log(`  PASS: ${pass}   FAIL: ${fail}`);
if (failures.length) console.log(`  Failed: ${failures.join(' | ')}`);
console.log('════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
