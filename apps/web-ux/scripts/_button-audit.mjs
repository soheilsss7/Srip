/* ============================================================================
   ممیزی جامع تعامل — همهٔ دکمه‌ها/تب‌ها در همهٔ صفحات برای هر سه حساب.
   برای هر دکمه:
     · کلیک واقعی + MutationObserver (واکنش DOM؟)
     · خطای JS (pageerror/console) → FAIL
     · ناوبری → دنبال می‌شود و برمی‌گردد
     · مودال باز → بسته می‌شود
     · بدون هیچ واکنشی → NOOP (هشدار)
   اجرا: node scripts/_button-audit.mjs   (UI_BASE قابل تنظیم)
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';

const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');

const PAGES_ALL = [
  '/', '/organizations', '/people', '/relationships', '/network', '/meetings', '/actions',
  '/commitments', '/projects', '/opportunities', '/interactions', '/intelligence',
  '/recommendations', '/alerts', '/publics', '/board', '/analytics', '/search',
  '/calendar', '/workflows', '/notifications', '/settings', '/approvals', '/documents',
  '/requirements', '/reports', '/admin', '/workspace',
  '/imports', '/gis', '/mcp', '/portal', '/p',
];
const PAGES_CORE = ['/', '/organizations', '/network', '/publics', '/relationships', '/actions', '/workflows', '/board'];
const TENANTS = [
  { user: 'demo', pass: '123456', otp: '123456', label: 'demo', pages: PAGES_ALL },
  { user: 'pars', pass: 'pars1234', otp: null, label: 'pars', pages: PAGES_CORE },
  { user: 'aroun', pass: '12356784', otp: null, label: 'aroun', pages: PAGES_CORE },
];

const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1366, height: 900 },
});

const results = { fail: [], noop: [], clicked: 0, pages: 0, loadErrors: [] };
const log = (...a) => console.log(...a);

async function makePage() {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  const errs = [];
  page.__errs = errs;
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  /* خطاهای شبکه از خود responseها ردیابی می‌شوند (با متد و URL دقیق)؛
     پیام‌های consoleِ «Failed to load resource» حذف می‌شوند تا prefetchهای HEAD
     (صفحات موجودیت‌های ساخته‌شده در زمان اجرا روی هاست استاتیک) false-positive ندهند */
  page.on('response', (r) => {
    const u = r.url();
    /* ۴۰۳ خروجی گزارش = فاز اول جریان دو مرحله‌ای طراحی‌شده (کلاینت بلافاصله درخواست تأیید می‌سازد) */
    if (r.status() === 403 && /\/reports\/[^/]+\/export\//.test(u)) return;
    if (r.status() >= 400 && r.request().method() !== 'HEAD' && !/route\.txt|_rsc|favicon|\.txt\?/.test(u)) {
      errs.push(`HTTP ${r.status()} ${r.request().method()} ${u.split('/api/v1')[1] ?? u.replace(/^https?:\/\/[^/]+/, '')}`);
    }
  });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Download the React DevTools/i.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return page;
}

async function login(page, t) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(async (u, p, o) => {
    const body = o ? { username: u, password: p, otp: o } : { username: u, password: p };
    const r = await fetch(`${location.origin}${new URL(document.baseURI).pathname.replace(/\/login.*$/, '')}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.accessToken) sessionStorage.setItem('srip_access_token', d.accessToken);
  }, t.user, t.pass, t.otp);
}

const VISIBLE = `(() => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none'; })()`;

async function auditPage(page, tenant, path) {
  const url = `${BASE}${path}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2600));
  results.pages++;
  /* خطاهای بارگذاری صفحه */
  const loadErrs = page.__errs.splice(0);
  const realLoadErrs = loadErrs.filter((e) => !/route\.txt|_rsc|favicon|net::ERR_ABORTED|Download the React DevTools|Failed to load resource/i.test(e));
  if (realLoadErrs.length) {
    results.loadErrors.push({ tenant: tenant.label, path, errs: realLoadErrs.slice(0, 3) });
    log(`  ⚠ خطای بارگذاری ${path}: ${realLoadErrs[0]}`);
  }
  if (page.url().includes('/login')) { log(`  ⚠ ${path}: ریدایرکت به لاگین (نشست؟) — رد شد`); return; }

  /* فهرست دکمه‌های مرئی و فعال */
  const buttons = await page.evaluate((visFn) => {
    const els = [...document.querySelectorAll('button:enabled, [role="button"]:not([aria-disabled="true"]), [role="tab"]:not([aria-selected="true"]), a[role="button"]')];
    const vis = new Function('el', 'return ' + visFn);
    return els.filter((el) => vis(el) && !el.closest('.modal-card')).map((el, i) => ({
      i,
      tag: el.tagName,
      text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 46) || el.getAttribute('title')?.slice(0, 46) || el.getAttribute('aria-label')?.slice(0, 46) || '(بدون متن)',
      cls: String(el.className).slice(0, 30),
    })).slice(0, 42);
  }, VISIBLE).catch(() => []);

  for (const b of buttons) {
    const before = page.url();
    /* راه‌اندازی MutationObserver برای واکنش DOM */
    await page.evaluate(() => {
      window.__mutCount = 0;
      window.__mo = new MutationObserver((list) => { window.__mutCount += list.length; });
      window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    }).catch(() => {});
    const clicked = await page.evaluate((idx, visFn) => {
      const els = [...document.querySelectorAll('button:enabled, [role="button"]:not([aria-disabled="true"]), [role="tab"]:not([aria-selected="true"]), a[role="button"]')];
      const vis = new Function('el', 'return ' + visFn);
      const visible = els.filter((el) => vis(el) && !el.closest('.modal-card'));
      const el = visible[idx];
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    }, b.i, VISIBLE).catch(() => false);
    if (!clicked) continue;
    results.clicked++;
    await new Promise((r) => setTimeout(r, 420));

    const errs = page.__errs.splice(0).filter((e) => !/route\.txt|_rsc|favicon|net::ERR_ABORTED|Download the React DevTools|Failed to load resource/i.test(e));
    if (errs.length) {
      results.fail.push({ tenant: tenant.label, path, button: b.text, err: errs[0] });
      log(`  ❌ [${tenant.label}] ${path} «${b.text}» → ${errs[0].slice(0, 110)}`);
    }

    /* ناوبری؟ */
    if (page.url() !== before && !page.url().includes('/login')) {
      await new Promise((r) => setTimeout(r, 700));
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
    } else if (page.url().includes('/login')) {
      await login(page, tenant);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
    }
    /* مودال باز؟ */
    const modalOpen = await page.evaluate(() => !!document.querySelector('.modal-card')).catch(() => false);
    if (modalOpen) {
      await page.keyboard.press('Escape').catch(() => {});
      await new Promise((r) => setTimeout(r, 250));
      const still = await page.evaluate(() => !!document.querySelector('.modal-card')).catch(() => false);
      if (still) {
        await page.evaluate(() => {
          const m = document.querySelector('.modal-card');
          const close = [...(m?.querySelectorAll('button') ?? [])].find((x) => /بستن|انصراف|✕|لغو/.test(x.textContent ?? '') || x.getAttribute('aria-label')?.includes('بستن'));
          close?.click();
        }).catch(() => {});
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    /* واکنش DOM؟ */
    const muts = await page.evaluate(() => { const c = window.__mutCount ?? -1; window.__mo?.disconnect(); return c; }).catch(() => -1);
    if (muts === 0 && page.url() === before && !errs.length) {
      /* بدون هیچ واکنش — چند دکمهٔ شناخته‌شدهٔ بی‌اثر مجاز نیستند ولی برخی toggleهای هم‌وضعیت طبیعتاً no-op هستند */
      results.noop.push({ tenant: tenant.label, path, button: b.text });
    }
  }
}

for (const t of TENANTS) {
  log(`\n═══ حساب ${t.label} (${t.pages.length} صفحه) ═══`);
  const page = await makePage();
  await login(page, t);
  for (const p of t.pages) {
    await auditPage(page, t, p);
  }
  await page.close();
}

await browser.close();
log(`\n══════════════════════════════════════`);
log(`صفحات ممیزی‌شده: ${results.pages} · دکمه‌های کلیک‌شده: ${results.clicked}`);
log(`خطاها (FAIL): ${results.fail.length}`);
results.fail.slice(0, 20).forEach((f) => log(`  ❌ [${f.tenant}] ${f.path} «${f.button}» → ${f.err.slice(0, 130)}`));
log(`بدون واکنش (NOOP): ${results.noop.length}`);
results.noop.slice(0, 30).forEach((f) => log(`  ⚪ [${f.tenant}] ${f.path} «${f.button}»`));
log(`خطای بارگذاری صفحه: ${results.loadErrors.length}`);
results.loadErrors.slice(0, 10).forEach((f) => log(`  ⚠ [${f.tenant}] ${f.path} → ${f.errs[0].slice(0, 130)}`));
const bad = results.fail.length + results.loadErrors.length;
console.log(`_summary_ fail=${bad} noop=${results.noop.length} clicked=${results.clicked} pages=${results.pages}`);
process.exit(bad ? 1 : 0);
