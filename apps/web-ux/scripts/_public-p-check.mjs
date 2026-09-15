import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
const E2E = resolve(process.cwd(), '.e2e-browser');
const browser = await puppeteer.launch({ executablePath: resolve(E2E, 'chromium'), args: ['--no-sandbox', '--disable-gpu'], env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const BASE = 'http://localhost:4100/Srip/srip2';
let ok = 0, fail = 0;
const check = (n, c, x = '') => { c ? ok++ : fail++; console.log(c ? '  ✅' : '  ❌', n, x); };

/* ۱) فرم پورتال بدون ورود */
await page.goto(`${BASE}/p?slug=pars`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
check('فرم عمومی بدون ریدایرکت به لاگین', !page.url().includes('/login'), page.url());
const h1 = await page.$eval('h1', x => x.textContent ?? '').catch(() => '');
check('عنوان پورتال پارس', h1.includes('هلدینگ پارس'), h1);
await page.evaluate(() => {
  const t = document.querySelector('#pp-msg');
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (t && set) { set.call(t, 'این یک پیام آزمایشی E2E برای چرخهٔ شکایت است.'); t.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.evaluate(() => { document.querySelector('.pp-submit')?.click(); });
await new Promise(r => setTimeout(r, 2500));
const sent = await page.$$eval('.pp-done, .pp-err', ns => ns.map(n => n.textContent?.trim().slice(0, 80)));
check('ثبت شکایت عمومی → پیام موفق', (sent.join(' ') ?? '').includes('ثبت شد'), JSON.stringify(sent).slice(0, 100));

/* ۲) نرخ‌محدود: ۵ پیام دیگر → باید بلاک شود */
let blocked = false;
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').includes('ثبت پیام تازه'));
    b?.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const t = document.querySelector('#pp-msg');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (t && set) { set.call(t, 'پیام تازه برای تست نرخ محدود پورتال عمومی.'); t.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.evaluate(() => { document.querySelector('.pp-submit')?.click(); });
  await new Promise(r => setTimeout(r, 1300));
  const txt = await page.evaluate(() => document.body.innerText);
  if (txt.includes('حد مجاز')) { blocked = true; break; }
}
check('نرخ‌محدود بعد از ۵ پیام → پیام محدودیت', blocked);
console.log('pageerrors:', errors.length ? errors : 'صفر');
await browser.close();
console.log(`═══ /p E2E: pass=${ok} fail=${fail} ═══`);
process.exit(fail || errors.length ? 1 : 0);
