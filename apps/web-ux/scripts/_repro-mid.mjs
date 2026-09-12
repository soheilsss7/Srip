import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const B = 'http://localhost:4100/Srip/srip2';
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 360, height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userDataDir: '/tmp/repro/profile2',
});
const page = await browser.newPage();
let navCount = 0;
page.on('framenavigated', f => { if (f === p_main(f) && navCount < 35) { navCount++; console.log('NAV[' + navCount + ']:', f.url().replace('http://localhost:4100', '')); } });
function p_main(f) { return f; }
await page.goto(B + '/relationships/srip2', { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 12000));
console.log('URL نهایی:', page.url().replace('http://localhost:4100', ''));
await browser.close();
