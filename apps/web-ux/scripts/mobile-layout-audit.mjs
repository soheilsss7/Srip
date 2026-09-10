/* ============================================================================
   mobile-layout-audit.mjs — ممیزی layout در عرض موبایل
   به هر صفحه در 360×760 می‌رود و سه مشکل را با selector دقیق گزارش می‌کند:
     ۱) «هر حرف یک خط»: عنصری که تعداد خطوطش از نصف تعداد حروفش بیشتر است
     ۲) «متن روی هم افتاده»: دو عنصر برگهٔ متنی که مستطیل‌شان بیش از ۵px هم‌پوشانی دارد
     ۳) سرریز افقی صفحه
   خروجی: JSON در stdout + اسکرین‌شات در .layout-audit/
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import sparticuz from '@sparticuz/chromium';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const E2E = join(HERE, '..', '.e2e-browser');
const BASE = (process.env.UI_BASE ?? 'http://localhost:4100') + '/Srip/srip2';
const SHOTS = join(HERE, '.layout-audit');
mkdirSync(SHOTS, { recursive: true });

const PAGES = process.env.AUDIT_PAGES
  ? process.env.AUDIT_PAGES.split(',')
  : ['/', '/analytics', '/intelligence', '/recommendations', '/alerts', '/organizations', '/relationships/r-1', '/publics', '/network', '/board', '/actions', '/workflows'];

const AUDIT_FN = () => {
  const out = { letterPerLine: [], overlaps: [], hscroll: null, vw: innerWidth, pageH: document.documentElement.scrollHeight };
  if (document.documentElement.scrollWidth > innerWidth + 2)
    out.hscroll = { docW: document.documentElement.scrollWidth, vw: innerWidth };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  const inOverlay = (el) => !!(el.closest && (el.closest('.mobile-tabs') || el.closest('.tour-overlay') || el.closest('.modal-backdrop') || el.closest('.command-overlay') || el.closest('.drawer-backdrop')));
  const leafTexts = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || inOverlay(el)) continue;
    const direct = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (!direct) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'absolute') continue;
    const text = direct.replace(/\s+/g, ' ');
    // ۱) «هر حرف یک خط»: مستطیل‌های واقعی متن را می‌شماریم (نه ارتفاع جعبه که
    //    min-height آن را بزرگ می‌کند) — اگر هر خط ≤ ~۲ نویسه جا شود، متن شکسته است.
    let rects = [], range = document.createRange();
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r);
    }
    // خطِ واقعی = باند عمودی متمایز (فرگمنت‌های هم‌خط یکی حساب می‌شوند)
    const ys = [...new Set(rects.map(r => Math.round(r.top / 4)))].sort((a, b) => a - b);
    let lineCount = 0, prevBand = null;
    for (const y of ys) { if (prevBand === null || y - prevBand > 1) lineCount++; prevBand = y; }
    const lines = lineCount;
    if (lines >= 3 && text.length >= 4 && lines >= Math.ceil(text.length / 2)) {
      const avgCharsPerLine = text.length / lines;
      if (avgCharsPerLine <= 2.2) {
        out.letterPerLine.push({ sel: buildSel(el), text: text.slice(0, 40), lines, w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
      }
    }
    if (el.children.length === 0) leafTexts.push(el);
  }
  // ۲) هم‌پوشانی برگه‌ها — بر مبنای مستطیل‌های واقعی متن (نه bounding box چندخطی
  //    که در جریان inline طبیعی با عنصر بعدی هم‌پوشان دیده می‌شود)
  const cleanLeaves = leafTexts.filter(el => !inOverlay(el));
  const textRectsOf = (el) => {
    const out = [], range = document.createRange();
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push(r);
    }
    return out;
  };
  const seen = new Set();
  for (const a of cleanLeaves) {
    for (const b of cleanLeaves) {
      if (a === b) continue;
      if (a.contains(b) || b.contains(a)) continue;
      let ox = 0, oy = 0;
      outer: for (const ra of textRectsOf(a)) {
        for (const rb of textRectsOf(b)) {
          const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (x > 5 && y > 5) { ox = x; oy = y; break outer; }
        }
      }
      if (ox > 5 && oy > 5) {
        const ta = (a.textContent || '').trim().slice(0, 18), tb = (b.textContent || '').trim().slice(0, 18);
        const key = [ta, tb].sort().join('||');
        if (seen.has(key)) continue;
        // هم‌پوشانی واقعی متنی: فقط وقتی هر دو متن واقعی دارند و روی هم چسبیده‌اند
        if (!ta || !tb) continue;
        // نادیده گرفتن عناصری که پدرشان z-index لایه‌بندی عمدی دارد (badges روی hero و…)
        seen.add(key);
        out.overlaps.push({ a: { sel: buildSel(a), text: ta }, b: { sel: buildSel(b), text: tb }, ox: Math.round(ox), oy: Math.round(oy) });
      }
    }
  }
  function buildSel(el) {
    const parts = [];
    let n = el;
    for (let i = 0; i < 4 && n && n.tagName !== 'BODY'; i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.className && typeof n.className === 'string') s += '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.');
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(' > ');
  }
  out.overlaps = out.overlaps.slice(0, 12);
  out.letterPerLine = out.letterPerLine.slice(0, 15);
  return out;
};

const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') + ':' + (process.env.LD_LIBRARY_PATH ?? '') },
  args: [...sparticuz.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: Number(process.env.AUDIT_W ?? 360), height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
});

try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  // صبر تا دکمهٔ دمو فعال شود (mockReady بعد از ثبت SW روشن می‌شود؛ بار اول reload هم می‌شود)
  await page.waitForSelector('.auth-demo-row:not([disabled])', { timeout: 90000 });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.auth-demo-row')][0];
    if (b) b.click();
  });
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  console.error('after login url:', page.url());
  const results = {};
  for (const p of PAGES) {
    try {
      await page.goto(BASE + p, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2200));
      const audit = await page.evaluate(AUDIT_FN);
      results[p] = audit;
      await page.screenshot({ path: join(SHOTS, p.replace(/\//g, '_').slice(1) + '.png'), fullPage: true }).catch(() => {});
      const flag = (audit.letterPerLine.length || audit.overlaps.length || audit.hscroll) ? '⚠' : '✓';
      console.error(`${flag} ${p}  letterPerLine=${audit.letterPerLine.length} overlaps=${audit.overlaps.length} hscroll=${audit.hscroll ? audit.hscroll.docW : 'no'}`);
    } catch (e) {
      results[p] = { error: String(e).slice(0, 120) };
      console.error(`✗ ${p} — ${String(e).slice(0, 100)}`);
    }
  }
  console.log(JSON.stringify(results, null, 1));
} finally { await browser.close(); }
