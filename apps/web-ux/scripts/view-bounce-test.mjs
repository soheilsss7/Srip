import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 360, height: 760 },
});
const page = await browser.newPage();
// ۱) ورود
await page.goto('http://localhost:4100/Srip/srip2/login', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForSelector('.auth-demo-row:not([disabled])', { timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('.auth-demo-row')[0].click());
await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 3000));
// ۲) ساخت یک اقدام واقعی (شبیه کاری که کاربر می‌کند) و گرفتن id آن
const dbg = await page.evaluate(async () => {
  const h = await fetch('/Srip/srip2/api/v1/health').then(r => r.text()).catch(e => 'ERR:' + e);
  return { controlled: !!navigator.serviceWorker.controller, url: location.pathname, health: h.slice(0, 40), keys: Object.keys(sessionStorage).slice(0, 6) };
});
console.log('pre-create debug:', JSON.stringify(dbg));
const newId = await page.evaluate(async () => {
  const t = sessionStorage.getItem('srip_access_token');
  const r = await fetch('/Srip/srip2/api/v1/actions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ title: 'آزمون ۴۰۴-بونس' }) });
  const j = await r.json();
  return j.id ?? null;
});
console.log('created action id:', newId);
// ۳) مسیر مستقیم (بدون صفحهٔ استاتیک) → باید به /view برگردد
await page.goto(`http://localhost:4100/Srip/srip2/actions/${newId}`, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 3500));
const afterBounce = await page.evaluate(() => ({ url: location.href, hasTitle: (document.body.textContent || '').includes('آزمون ۴۰۴-بونس'), notFound: (document.body.textContent || '').includes('صفحه پیدا نشد') }));
console.log('bounce result:', JSON.stringify(afterBounce));
// ۴) ناوبری سمت کلاینت (لینک داخلی) هم باید کار کند
const clientNav = await page.evaluate(async () => {
  const ok = await fetch('/Srip/srip2/api/v1/relationships').then(r => r.ok);
  return ok;
});
console.log('api via SW ok:', clientNav);
await browser.close();
