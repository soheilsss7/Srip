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
page.on('requestfailed', r => { if (r.url().includes('api/v1')) console.log('REQFAILED:', r.url().slice(0, 90), r.failure()?.errorText); });
await page.goto('http://localhost:4100/Srip/srip2/login', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForSelector('.auth-demo-row:not([disabled])', { timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('.auth-demo-row')[0].click());
await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 4000));
const s1 = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return {
    url: location.pathname, controlled: !!navigator.serviceWorker.controller,
    regs: regs.map(r => ({ scope: r.scope, active: !!r.active, state: r.active?.state })),
  };
});
console.log('after login:', JSON.stringify(s1, null, 1));
// آیا goto جدید کنترل را برمی‌گرداند؟
await page.goto('http://localhost:4100/Srip/srip2/', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
const s2 = await page.evaluate(() => ({ url: location.pathname, controlled: !!navigator.serviceWorker.controller }));
console.log('after fresh goto:', JSON.stringify(s2));
await browser.close();
