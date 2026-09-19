#!/usr/bin/env node
/* _tenant-check.mjs — راستی‌آزمایی E2E تفکیک مستأجر (نوبت ۲۰۲۶-۰۹-۱۹)
   · صفحهٔ ورود: بدون نشان «پلتفرم آماده بهره‌برداری» / «دسترسی‌ها بر اساس نقش…» و hint خنثی OTP
   · حساب واقعی aroun (tenant=real): هیچ «دمو» در صفحات کاربر-نما + «مسیر مطمئن» + «معرفی‌ها» بدون «(با ممیزی)»
   · حساب دمو (tenant=demo): برچسب‌های دمو همچنان موجود (گیت دوطرفه)
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_tenant-check.mjs
   پیش‌نیاز: بیلد استاتیک روی :4100 (پیش‌فرض /Srip/srip2) + mock-api روی :4300
*/
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CHROME = process.env.CHROME_EXE ?? join(ROOT, '.e2e-browser', 'chromium');
const LD = process.env.CHROME_LD ?? join(ROOT, '.e2e-browser', 'nss');
const BASE = process.env.E2E_BASE ?? 'http://localhost:4100/Srip/srip2';

if (!existsSync(CHROME)) {
  console.error('[tenant-check] کروم E2E موجود نیست — ابتدا node scripts/e2e-browser-setup.mjs');
  process.exit(1);
}

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name} ${extra}`); }
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  env: { ...process.env, LD_LIBRARY_PATH: resolve(LD) },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});

const bodyText = (p) => p.evaluate(() => document.body.innerText || '');
async function login(p, user, pass, needOtp = false) {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await p.waitForSelector('#login-email', { timeout: 30000 });
  await p.type('#login-email', user);
  await p.type('#login-pass', pass);
  await p.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await p.click('.auth-form button[type=submit]');
  let otpHintTxt = '';
  if (needOtp) {
    await p.waitForSelector('#login-otp', { timeout: 30000 }).catch(() => {});
    if (await p.evaluate(() => !!document.querySelector('#login-otp'))) {
      otpHintTxt = await bodyText(p);
      await p.type('#login-otp', '111111');
      await p.click('.auth-form button[type=submit]');
    }
  }
  await p.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  return { ok: !(await p.evaluate(() => location.pathname.endsWith('/login'))), otpHintTxt };
}
async function sweep(p, pages) {
  const texts = {};
  for (const pg of pages) {
    await p.goto(`${BASE}${pg}`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 700));
    texts[pg] = await bodyText(p);
  }
  return texts;
}

try {
  /* ---------- ۱) صفحهٔ لاگین (بدون نشست) ---------- */
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  const loginTxt = await bodyText(page);
  ok('لاگین: بدون «پلتفرم آماده بهره‌برداری است»', !loginTxt.includes('پلتفرم آماده بهره‌برداری'));
  ok('لاگین: بدون «دسترسی‌ها بر اساس نقش…»', !loginTxt.includes('دسترسی‌ها بر اساس نقش'));
  ok('لاگین: بدون «دمو»', !loginTxt.includes('دمو'));

  /* ---------- ۲) حساب واقعی aroun (tenant=real) ---------- */
  const ar = await login(page, 'aroun', '12356784');
  ok('ورود aroun', ar.ok);
  const REAL_PAGES = ['/board','/analytics','/referrals','/network','/help','/push','/enterprise','/approvals','/enrichment','/reports','/reports/export','/workflows','/p'];
  const real = await sweep(page, REAL_PAGES);
  for (const pg of REAL_PAGES) {
    ok(`aroun ${pg}: بدون «دمو»`, !real[pg].includes('دمو'), (real[pg].match(/.{0,25}دمو.{0,25}/) || [''])[0]);
    ok(`aroun ${pg}: بدون «مسیر گرم»`, !real[pg].includes('مسیر گرم'));
  }
  ok('aroun /referrals: عنوان «معرفی‌ها»', real['/referrals'].includes('معرفی‌ها'));
  ok('aroun /referrals: بدون «(با ممیزی)»', !real['/referrals'].includes('با ممیزی'));
  ok('aroun /referrals: «مسیر مطمئن»', real['/referrals'].includes('مسیر مطمئن'));
  ok('aroun /referrals: بدون «مِیشن گرم»', !real['/referrals'].includes('مِیشن گرم'));
  ok('aroun /network: «مسیر مطمئن» (نمای تحلیل)', await (async () => {
    await page.goto(`${BASE}/network`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await page.waitForSelector('[role=tab]', { timeout: 30000 }).catch(() => {});
    const clicked = await page.evaluate(() => {
      const tab = [...document.querySelectorAll('[role=tab]')].find(b => (b.textContent || '').includes('تحلیل'));
      if (tab) { tab.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 2500));
    const txt = await bodyText(page);
    return clicked && txt.includes('مسیر مطمئن');
  })());
  ok('aroun /analytics: «مطمئن» (جای گرم)', real['/analytics'].includes('مطمئن'));
  ok('aroun /analytics: بدون «دادهٔ دمو»', !real['/analytics'].includes('دادهٔ دمو'));
  ok('aroun /board: بدون «برچسب دمو»', !real['/board'].includes('برچسب دمو'));
  ok('aroun /enterprise: «در حال راه‌اندازی»', real['/enterprise'].includes('در حال راه‌اندازی'));
  ok('aroun /push: بدون «نقل‌ونقل polling در دمو»', !real['/push'].includes('نقل‌ونقل polling در دمو'));
  ok('aroun /help: بدون «بازنشانی دمو»', !real['/help'].includes('بازنشانی دمو'));

  /* ---------- ۳) حساب دمو (tenant=demo) — گیت دوطرفه ---------- */
  const page2 = await browser.newPage();
  const dm = await login(page2, 'demo', '123456', true);
  ok('ورود demo', dm.ok);
  ok('demo لاگین: hint خنثی OTP', dm.otpHintTxt.includes('کد ۶ رقمی تأیید دومرحله‌ای را وارد کنید'));
  const demo = await sweep(page2, ['/board','/analytics','/referrals']);
  ok('demo /board: «برچسب دمو» هنوز هست (گیت دوطرفه)', demo['/board'].includes('برچسب دمو'));
  ok('demo /analytics: «دادهٔ دمو» هنوز هست', demo['/analytics'].includes('دادهٔ دمو'));
  ok('demo /referrals: «مسیر مطمئن»', demo['/referrals'].includes('مسیر مطمئن'));
  ok('demo /referrals: بدون «(با ممیزی)»', !demo['/referrals'].includes('با ممیزی'));
} catch (e) {
  console.error('FATAL', e);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n========== tenant E2E: ${pass} PASS / ${fail} FAIL ==========`);
if (failures.length) { console.log('FAILURES:', failures.join(' | ')); process.exit(1); }
