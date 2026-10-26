/* ============================================================================
   ai-assist-ui.mjs — باتری E2E گام ۷.۴: اولویت‌بندی فرصت + پیشنهاد اقدام بعدی
   ورود demo → صفحهٔ فرصت → محاسبهٔ امتیاز و دلیل → صفحهٔ تعاملات →
   انتخاب تعامل → پیشنهاد → ثبت با تأیید.
   ============================================================================ */
import puppeteer from 'puppeteer-core';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

const browser = await puppeteer.launch({
  executablePath: resolve(E2E_DIR, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E_DIR, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();

try {
  /* ورود دمو */
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', 'demo');
  await page.type('#login-pass', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForSelector('#login-otp', { timeout: 30000 });
  await page.type('#login-otp', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => localStorage.setItem('srip2_tour_done', '1'));

  /* ── ۱) صفحهٔ فرصت: اولویت‌بندی ── */
  const oppId = await page.evaluate(async () => {
    const tok = sessionStorage.getItem('srip_access_token');
    const r = await fetch('/api/v1/opportunities', { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json(); const items = j.items ?? j;
    const open = items.filter((x) => !['WON', 'LOST'].includes(x.status));
    return (open[0] ?? items[0])?.id ?? null;
  });
  ok('فرصت دمو از API خوانده شد', !!oppId, `id=${oppId}`);
  try { await page.goto(`${BASE}/opportunities/${oppId}`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.ai-opp-priority', { timeout: 30000 });
  ok('پنل «اولویت‌بندی هوشمند» در صفحهٔ فرصت', true);
  await page.evaluate(() => [...document.querySelectorAll('.ai-opp-priority button')].find(b => (b.textContent ?? '').includes('محاسبهٔ امتیاز'))?.click());
  await page.waitForFunction(() => document.querySelectorAll('.ai-opp-priority .listRow').length >= 3, { timeout: 30000 });
  const pri = await page.evaluate(() => {
    const t = document.querySelector('.ai-opp-priority')?.textContent ?? '';
    return { score: t.includes('از ۱۰۰'), factors: document.querySelectorAll('.ai-opp-priority .listRow').length,
      noAuto: t.includes('بدون رد یا قبول خودکار'), value: t.includes('ارزش فرصت'), recency: t.includes('تازگی تعامل') };
  });
  ok('امتیاز + سه عامل (ارزش/احتمال/تازگی تعامل) + «بدون رد یا قبول خودکار»',
    pri.score && pri.factors === 3 && pri.noAuto && pri.value && pri.recency, JSON.stringify(pri));

  /* ── ۲) صفحهٔ تعاملات: پیشنهاد اقدام بعدی ── */
  try { await page.goto(`${BASE}/interactions`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.ai-next-action select', { timeout: 30000 });
  ok('پنل «پیشنهاد اقدام بعدی» در صفحهٔ تعاملات', true);
  await page.evaluate(() => {
    const sel = document.querySelector('.ai-next-action select');
    const s = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    s.call(sel, sel.options[1].value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.evaluate(() => [...document.querySelectorAll('.ai-next-action button')].find(b => (b.textContent ?? '').includes('پیشنهاد اقدام بعدی'))?.click());
  await page.waitForFunction(() => (document.querySelector('.ai-next-action')?.textContent ?? '').includes('اقدام پیشنهادی'), { timeout: 30000 });
  const prop = await page.evaluate(() => {
    const t = document.querySelector('.ai-next-action')?.textContent ?? '';
    return { title: t.includes('اقدام پیشنهادی'), msg: t.includes('پیام پیشنهادی'),
      due: t.includes('مهلت پیشنهادی'), basis: t.includes('مبنای پیشنهاد'), confirm: t.includes('ثبت اقدام با تأیید من') };
  });
  ok('پیشنهاد چهارقلمی: اقدام + پیام + مهلت + مبنا (از داده)',
    prop.title && prop.msg && prop.due && prop.basis, JSON.stringify(prop));
  page.on('dialog', d => d.accept());
  await page.evaluate(() => [...document.querySelectorAll('.ai-next-action button')].find(b => (b.textContent ?? '').includes('ثبت اقدام با تأیید من'))?.click());
  await page.waitForFunction(() => !document.querySelector('.ai-next-action .detail-grid'), { timeout: 30000 });
  const created = await page.evaluate(async () => {
    const tok = sessionStorage.getItem('srip_access_token');
    const r = await fetch('/api/v1/actions', { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json(); const items = j.items ?? j;
    return items.some((x) => String(x.description ?? '').includes('پیشنهاد اقدام بعدی'));
  });
  ok('ثبت با تأیید کاربر: اقدام «از پیشنهاد اقدام بعدی» در فهرست اقدامات', created);
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nAI-ASSIST-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
