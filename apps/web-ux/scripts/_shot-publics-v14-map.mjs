/* فاز ۱۳.۵ — اسکرین‌شات نقشهٔ عموم‌های v14 (دستهٔ بین‌المللی) */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
const OUT = resolve(process.cwd(), '../../docs/screenshots/publics/v14-map.png');

const browser = await puppeteer.launch({
  executablePath: resolve(process.cwd(), '.e2e-browser/chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(process.cwd(), '.e2e-browser/nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true, defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
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
await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise(r => setTimeout(r, 2000));
/* فیلتر دسته: بین‌المللی */
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => (o.textContent ?? '').trim() === 'بین\u200cالمللی'));
  if (sel) { sel.value = 'INTERNATIONAL'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: OUT, fullPage: false });
console.log('✅ اسکرین‌شات نقشهٔ v14 ذخیره شد:', OUT);
await browser.close();
