/* تست دستی نمای دسته‌ای گراف — dev :3000 */
import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';

const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const BASE = 'http://localhost:3000';
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const ok = (name, cond, extra = '') => console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);

await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
await page.type('#login-email', 'pars');
await page.type('#login-pass', 'pars1234');
await page.click('.auth-form button[type=submit]');
await new Promise(r => setTimeout(r, 3500));
await page.goto(BASE + '/network', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 6000));

const info = await page.evaluate(() => {
  const svg = document.querySelector('.net-graph-zone svg');
  const texts = svg ? [...svg.querySelectorAll('text')].map(t => t.textContent ?? '') : [];
  const all = texts.join(' | ');
  return {
    hasPars: all.includes('هلدینگ پارس'),
    hasSub: all.includes('پارس انرژی') || all.includes('پارس مالی'),
    hasEntity: all.includes('شورای ملی') || all.includes('دانشگاه تهران') || all.includes('دیجی‌کالا'),
    trays: [...svg?.querySelectorAll('[data-tray]') ?? []].map(g => ({
      key: g.getAttribute('data-tray'),
      txt: (g.textContent ?? '').slice(0, 60),
    })),
    ego: !!svg?.querySelector('[data-ego="true"]'),
    dock: !!document.querySelector('[data-tray-dock]'),
    colored: document.querySelector('[data-categorized-count]')?.textContent ?? '0',
    panel: !!document.querySelector('[data-tray-panel]'),
    textCount: texts.filter(t => t.trim().length > 2).length,
  };
});
ok('اگو (هلدینگ پارس) در مرکز', info.hasPars && info.ego);
ok('زیرمجموعه‌های پارس در سینی', info.hasSub);
ok('نهادهای عموم سند در سینی‌ها', info.hasEntity);
ok('سینی‌های دسته رندر شده‌اند', info.trays.length >= 4, `n=${info.trays.length}`);
ok('پنل دسته به‌صورت پیش‌فرض بسته است', !info.panel);
console.log('  سینی‌ها:', JSON.stringify(info.trays, null, 1).slice(0, 700));
ok('شمار گره دسته‌بندی‌شده', true, info.colored);

/* باز کردن اولین سینی */
await page.evaluate(() => {
  /* کلیک روی دکمهٔ «باز کردن» سینی اول */
  const dock = document.querySelector('[data-tray-dock]');
  const btn = [...(dock?.querySelectorAll('[data-tray] g') ?? [])].find(g => (g.textContent ?? '').includes('باز کردن'));
  if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 1200));
const panel1 = await page.evaluate(() => {
  const p = document.querySelector('[data-tray-panel]');
  const chips = p ? p.querySelectorAll('rect').length : 0;
  const txt = p ? (p.textContent ?? '') : '';
  return { open: !!p, chips, txt: txt.slice(0, 150), hasTehranUni: txt.includes('دانشگاه') };
});
ok('پنل دسته باز شد', panel1.open, `chips≈${panel1.chips}`);

/* بستن با ✕ */
await page.evaluate(() => {
  const p = document.querySelector('[data-tray-panel]');
  const x = p && [...p.querySelectorAll('g')].find(g => (g.textContent ?? '').trim() === '✕');
  if (x) x.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 900));
const closed = await page.evaluate(() => !document.querySelector('[data-tray-panel]'));
ok('پنل با کلیک بسته شد', closed);

/* سوییچ به کلاسیک */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').trim() === 'کلاسیک');
  if (b) b.click();
});
await new Promise(r => setTimeout(r, 2500));
const classic = await page.evaluate(() => {
  const svg = document.querySelector('.net-graph-zone svg');
  const texts = [...(svg?.querySelectorAll('text') ?? [])].map(t => t.textContent ?? '').join(' | ');
  return { noDock: !document.querySelector('[data-tray-dock]'), hasSub: texts.includes('پارس انرژی') || texts.includes('پارس مالی'), count: (svg?.querySelectorAll('text') ?? []).length };
});
ok('نمای کلاسیک: سینی حذف و همهٔ سازمان‌ها حاضرند', classic.noDock && classic.hasSub, `texts=${classic.count}`);

/* بازگشت به دسته‌ای */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').trim() === 'دسته‌ای');
  if (b) b.click();
});
await new Promise(r => setTimeout(r, 2000));
const backNested = await page.evaluate(() => !!document.querySelector('[data-tray-dock]'));
ok('بازگشت به نمای دسته‌ای', backNested);

await page.screenshot({ path: '/tmp/network-nested.png' });
await browser.close();
console.log('done');
