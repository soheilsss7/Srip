/* بازتولید باگ: نصب SW قدیمی → انتشار جدید → ورود pars → کلیک روی رابطهٔ پارس */
import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';
import fs from 'node:fs';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const B = 'http://localhost:4100/Srip/srip2';
const launch = () => puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 360, height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userDataDir: '/tmp/repro/profile',
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const phase = process.argv[2] ?? 'all';
if (phase === 'all' || phase === 'p1') {
  const b = await launch(); const p = await b.newPage();
  await p.goto(B + '/login', { waitUntil: 'networkidle0', timeout: 90000 });
  await sleep(2500);
  console.log('فاز۱ (SW قدیمی نصب شد):', await p.evaluate(async () => await fetch('/Srip/srip2/api/v1/health').then(r => r.json()).then(j => j.mockVersion).catch(() => 'ERR')));
  await b.close();
}
if (phase === 'all' || phase === 'p2') {
  fs.writeFileSync('/tmp/repro/USE_NEW', '1');
  const b = await launch(); const p = await b.newPage();
  /* ردیابی ناوبری‌ها */
  let navCount = 0;
  p.on('framenavigated', f => { if (f === p.mainFrame() && navCount < 40) { navCount++; console.log('  NAV[' + navCount + ']:', f.url().replace('http://localhost:4100', '')); } });
  await p.goto(B + '/login', { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
  await sleep(4000);
  await p.waitForSelector('#login-email', { timeout: 30000 }).catch(() => {});
  await p.type('#login-email', 'pars');
  await p.type('#login-pass', 'pars1234');
  await p.click('.auth-form button[type=submit]').catch(() => {});
  await sleep(8000);
  console.log('بعد از ورود:', p.url().replace('http://localhost:4100', ''));
  /* رفتن به روابط */
  await p.goto(B + '/relationships', { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
  await sleep(4000);
  /* کلیک روی اولین ردیف رابطه */
  const clicked = await p.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/relationships/"]')].filter(a => /\/relationships\/[^/]+$/.test(a.getAttribute('href')));
    if (!links.length) return 'no-links';
    links[0].click();
    return 'clicked:' + links[0].getAttribute('href');
  });
  console.log('کلیک:', clicked);
  await sleep(12000); /* اگر حلقهٔ ریدایرکت باشد اینجا ظاهر می‌شود */
  console.log('URL نهایی:', p.url().replace('http://localhost:4100', ''));
  const txt = await p.evaluate(() => (document.body.innerText ?? '').slice(0, 200).replace(/\n/g, '|'));
  console.log('متن صفحه:', txt);
  await b.close();
}
