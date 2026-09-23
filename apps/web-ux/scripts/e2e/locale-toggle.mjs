/* locale-toggle.mjs — E2E رفع باگ «بعد از انگلیسی، فارسی نمی‌شود»
   ریشه: تور خوش‌آمد با لایهٔ تمام‌صفحه دکمهٔ زبان را می‌پوشاند و فقط با دکمهٔ
   کوچک «رد شدن» بسته می‌شد. اکنون: Esc + کلیک روی پس‌زمینه می‌بندد و سوییچ
   رفت‌وبرگشت fa↔en راستی‌آزمایی می‌شود.
   اجرا: LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" UI_BASE=http://localhost:4100/Srip/srip2 node scripts/e2e/locale-toggle.mjs */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); } };

const browser = await puppeteer.launch({
  executablePath: resolve(process.cwd(), '.e2e-browser/chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(process.cwd(), '.e2e-browser/nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 120)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('#login-email');
  await page.type('#login-email', 'demo'); await page.type('#login-pass', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForSelector('#login-otp', { timeout: 30000 });
  await page.type('#login-otp', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  ok('تور خوش‌آمد در ورود نخست باز است', await page.evaluate(() => !!document.querySelector('.tour-overlay')));
  ok('Esc تور را می‌بندد و «دیدن» را ذخیره می‌کند',
    await page.keyboard.press('Escape').then(() => new Promise(r => setTimeout(r, 800)))
      .then(() => page.evaluate(() => !document.querySelector('.tour-overlay') && localStorage.getItem('srip2_tour_done') === '1')));

  await page.click('.locale-btn');
  await new Promise(r => setTimeout(r, 4000));
  ok('سوییچ به EN: lang=en dir=ltr', await page.evaluate(() => document.documentElement.lang === 'en' && document.documentElement.dir === 'ltr' && localStorage.getItem('srip_locale') === 'en'));

  await page.click('.locale-btn');
  await new Promise(r => setTimeout(r, 4000));
  ok('برگشت به FA (باگ اصلی کاربر): lang=fa dir=rtl', await page.evaluate(() => document.documentElement.lang === 'fa' && document.documentElement.dir === 'rtl' && localStorage.getItem('srip_locale') === 'fa'));

  /* حالت دوم: بستن تور با کلیک روی پس‌زمینهٔ تیره */
  await page.evaluate(() => { try { localStorage.removeItem('srip2_tour_done'); } catch {} });
  await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3000));
  const tourUp = await page.evaluate(() => !!document.querySelector('.tour-overlay'));
  await page.mouse.click(120, 700);
  await new Promise(r => setTimeout(r, 800));
  ok('کلیک روی پس‌زمینهٔ تور = بستن', tourUp && await page.evaluate(() => !document.querySelector('.tour-overlay')));

  ok('بدون خطای صفحه', errs.length === 0, errs[0] ?? '');
} catch (e) {
  console.error('LOCALE-TOGGLE ERROR:', e.message);
  fail++; failures.push('script error: ' + e.message);
} finally {
  await browser.close();
}
console.log(`\nLOCALE-TOGGLE: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('Failed: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
