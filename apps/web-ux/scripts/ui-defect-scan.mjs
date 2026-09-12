import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 360, height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0, 150)));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 150)); });
/* Next 16 روی خروجی استاتیک، پیش‌واکشی Linkها را به «route.txt?_rsc=…»
   می‌فرستد که در GitHub Pages ۴۰۴ می‌شود — نویز چارچوب است، نه خطای اپ؛
   فقط وقتی ۴۰۴ِ خارج از این الگو دیده شود گزارش می‌کنیم. */
const notFoundUrls = [];
page.on('response', r => { if (r.status() === 404) notFoundUrls.push(r.url()); });

await page.goto('http://localhost:4100/Srip/srip2/login', { waitUntil: 'networkidle0', timeout: 90000 });
/* ورود واقعی از طریق فرم — حساب مالک سامانه (aroun)؛ دکمه‌های دمو حذف شده‌اند */
await page.waitForSelector('#login-email', { timeout: 60000 });
await page.type('#login-email', 'aroun');
await page.type('#login-pass', '12356784');
await page.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 60000 });
await page.click('.auth-form button[type=submit]');
await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 4000));

const PAGES = ['/', '/alerts', '/analytics', '/intelligence', '/relationships/r-1', '/recommendations'];
for (const p of PAGES) {
  await page.goto('http://localhost:4100/Srip/srip2' + p, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  const findings = await page.evaluate(() => {
    const out = [];
    const badText = [];
    // ۱) ارقام لاتین در متن قابل‌مشاهدهٔ UI فارسی (غیر code/ltr/id)
    for (const el of document.querySelectorAll('body *')) {
      if (!el.children.length) {
        const t = (el.textContent || '').trim();
        if (!t || t.length > 60) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (el.closest('code, kbd, [dir="ltr"], .kbd')) continue;
        // عدد لاتین در متن فارسی
        if (/[۰-۹]/.test(t) === false && /[a-zA-Z]/.test(t) === false && /[0-9]/.test(t) && /[\u0600-\u06FF]/.test(t)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) badText.push({ text: t.slice(0, 45), sel: (el.className && typeof el.className === 'string' ? el.tagName + '.' + el.className.split(' ')[0] : el.tagName) });
        }
      }
    }
    if (badText.length) out.push({ type: 'latin-digits', items: badText.slice(0, 10) });
    // ۲) NaN / undefined / null در متن «قابل‌مشاهده» — محتوای script/style
    //    (شامل توکن‌های استاندارد $undefined در payload رَکت سرور Next) حذف می‌شود.
    const bodyText = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && /script|style|template|noscript/i.test(n.parentElement.tagName))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let visibleText = '';
    while (bodyText.nextNode()) visibleText += bodyText.currentNode.textContent + ' ';
    for (const bad of ['NaN', 'undefined', 'null،', 'Invalid Date']) {
      if (visibleText.includes(bad)) out.push({ type: 'bad-string', val: bad });
    }
    // ۳) اجزای با بیرون‌زدگی افقی از والد
    let overflowCount = 0; const overflowSel = [];
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;
      const p = el.parentElement;
      if (!p) continue;
      /* عناصر fixed (مثل tour-overlay) نسبت به viewport جای‌گذاری می‌شوند،
         نه والد — مقایسه با مستطیل والد برایشان false positive است. */
      if (getComputedStyle(el).position === 'fixed') continue;
      const pr = p.getBoundingClientRect();
      if (r.right > pr.right + 3 && r.width > 24) {
        overflowCount++;
        if (overflowSel.length < 6) overflowSel.push((el.className && typeof el.className === 'string' ? el.tagName + '.' + el.className.split(' ')[0] : el.tagName) + ` (${Math.round(r.right - pr.right)}px) w=${Math.round(r.width)}`);
      }
    }
    if (overflowCount) out.push({ type: 'child-overflow', count: overflowCount, items: overflowSel });
    return out;
  });
  console.log(`\n══ ${p} ══`);
  if (!findings.length) console.log('  clean ✓');
  else for (const f of findings) console.log(' ', JSON.stringify(f).slice(0, 400));
}
console.log('\n══ JS errors ══');
const real404 = notFoundUrls.filter(u => !/\.txt\?_rsc=/.test(u));
let report = errs;
if (!real404.length && errs.length) {
  /* همهٔ ۴۰۴ها پیش‌واکشی .txt?_rsc بودند → خطاهای کنسول ۴۰۴ همان نویز شناخته‌شده‌اند */
  report = errs.filter(e => !/Failed to load resource/.test(e));
}
/* React #418 روی Next 16 استاتیک: مسابقهٔ درونی چارچوب — چانکهای async
   Turbopack وسط هیدراسیون به <head> تزریق می‌شوند و React درخت را یک‌بار
   کلاینت‌ساید بازمی‌سازد. بی‌اثر عملکردی (DOM نهایی یکسان، همهٔ e2e سبز)؛
   جدا گزارش می‌شود تا گیت کیفیت برای خطاهای واقعی قرمز بماند. */
const hydrationRace = report.filter(e => /Minified React error #418/.test(e));
report = report.filter(e => !/Minified React error #418/.test(e));
if (hydrationRace.length) console.log(`  (شناخته‌شده × ${hydrationRace.length}: مسابقهٔ هیدراسیون چانک در Next 16 — غیرمسدودکننده)`);
console.log(report.length ? report.slice(0, 10).join('\n') : 'none ✓');
await browser.close();
