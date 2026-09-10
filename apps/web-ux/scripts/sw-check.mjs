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
await page.goto('http://localhost:4100/Srip/srip2/login', { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise(r => setTimeout(r, 2500));
console.log('login page controlled:', await page.evaluate(() => !!navigator.serviceWorker.controller));
const probe = await page.evaluate(async () => {
  const r = await fetch('/Srip/srip2/api/v1/health');
  const t = await r.text();
  return { status: r.status, head: t.slice(0, 80) };
});
console.log('fetch from login page:', JSON.stringify(probe));
await browser.close();
