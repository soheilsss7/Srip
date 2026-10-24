/* فاز ۱۲.۲ — اسکرین‌شات چارت تیم v14 (مستندسازی مسترپلن)
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_shot-team-chart-v14.mjs */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
const OUT = resolve(process.cwd(), '../../docs/screenshots/program/26-team-chart-v14.png');

const browser = await puppeteer.launch({
  executablePath: resolve(process.cwd(), '.e2e-browser/chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(process.cwd(), '.e2e-browser/nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 2 },
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
await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise(r => setTimeout(r, 1500));
/* رفتن به تب «ممیزی سه‌گانه» که کارت چارت زیر آن است */
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.segmented button, [role=tablist] button')].find(b => (b.textContent ?? '').includes('ممیزی'));
  if (t) t.click();
});
await new Promise(r => setTimeout(r, 2000));
const card = await page.$('.section-card.team-chart');
if (!card) { console.error('کارت چارت پیدا نشد'); await browser.close(); process.exit(1); }
await card.screenshot({ path: OUT });
console.log('✅ اسکرین‌شات چارت v14 ذخیره شد:', OUT);
await browser.close();
