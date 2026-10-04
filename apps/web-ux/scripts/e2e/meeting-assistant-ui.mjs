/* ============================================================================
   meeting-assistant-ui.mjs — باتری E2E گام ۷.۳: دستیار جلسه
   ورود demo → صفحهٔ جلسه → ورود رونوشت → پیشنهاد چهارگانهٔ قابل ویرایش →
   حذف یک پیشنهاد → «ثبت با تأیید صاحب جلسه» → پیام موفقیت.
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

  /* یک جلسهٔ دمو از API بگیر */
  const meetingId = await page.evaluate(async () => {
    const tok = sessionStorage.getItem('srip_access_token');
    const r = await fetch('/api/v1/meetings', { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json();
    const items = j.items ?? j;
    return Array.isArray(items) && items.length ? items[0].id : null;
  });
  ok('جلسهٔ دمو از API خوانده شد', !!meetingId, `id=${meetingId}`);

  try { await page.goto(`${BASE}/meetings/${meetingId}`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch {}
  await page.waitForSelector('.ai-meeting-assistant', { timeout: 30000 });
  ok('پنل «دستیار جلسه» در صفحهٔ جلسه دیده می‌شود', true);

  /* برچسب فقط-پیشنهاد */
  const badge = await page.evaluate(() => (document.querySelector('.ai-meeting-assistant')?.textContent ?? '').includes('فقط پیشنهاد'));
  ok('برچسب «فقط پیشنهاد» روی پنل', badge);

  /* ورود رونوشت و پیشنهاد */
  await page.waitForSelector('textarea[aria-label="متن یا رونوشت جلسه"]', { timeout: 15000 });
  await page.type('textarea[aria-label="متن یا رونوشت جلسه"]',
    'جلسهٔ بررسی همکاری برگزار شد. توافق شد که نمونهٔ اول محصول تا پایان ماه تحویل شود. تصمیم گرفتیم قرارداد چارچوب را یک سال تمدید کنیم. شرکت متعهد شد مستندات فنی را تا تاریخ بعدی ارائه کند. آقای رضایی مسئول پیگیری مسائل گمرکی است. تیم فنی اقدام می‌کند تا طرح فنی را تا هفتهٔ بعد آماده کند.');
  await page.evaluate(() => [...document.querySelectorAll('.ai-meeting-assistant button')].find(b => (b.textContent ?? '').includes('پیشنهاد پیش‌نویس'))?.click());
  await page.waitForSelector('textarea[aria-label="خلاصهٔ پیشنهادی"]', { timeout: 30000 });
  const draft = await page.evaluate(() => {
    const panel = document.querySelector('.ai-meeting-assistant');
    return {
      summary: (panel?.querySelector('textarea[aria-label="خلاصهٔ پیشنهادی"]')?.value ?? '').length,
      decisions: panel?.querySelectorAll('input[aria-label^="تصمیم‌ها"]').length,
      commitments: panel?.querySelectorAll('input[aria-label^="تعهدها"]').length,
      actions: panel?.querySelectorAll('input[aria-label^="اقدام‌های بعدی"]').length,
      confirmBtn: [...(panel?.querySelectorAll('button') ?? [])].some(b => (b.textContent ?? '').includes('ثبت با تأیید صاحب جلسه')),
    };
  });
  ok('پیشنهاد چهارگانه: خلاصه + تصمیم + تعهد + اقدام بعدی (همه قابل ویرایش)',
    draft.summary > 10 && draft.decisions >= 1 && draft.commitments >= 1 && draft.actions >= 1,
    JSON.stringify(draft));

  /* ویرایش‌پذیری: حذف یک اقدام */
  const beforeRemove = draft.actions;
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.ai-meeting-assistant button[aria-label="حذف پیشنهاد"]')];
    btns[btns.length - 1]?.click();
  });
  await page.waitForFunction((n) => document.querySelectorAll('.ai-meeting-assistant input[aria-label^="اقدام‌های بعدی"]').length === n - 1, { timeout: 15000 }, beforeRemove);
  ok('قابل ویرایش: حذف یک پیشنهاد از فهرست', true);

  /* ثبت با تأیید صاحب جلسه */
  await page.evaluate(() => [...document.querySelectorAll('.ai-meeting-assistant button')].find(b => (b.textContent ?? '').includes('ثبت با تأیید صاحب جلسه'))?.click());
  await page.waitForFunction(() => (document.body.textContent ?? '').includes('پیش‌نویس با تأیید شما ثبت شد'), { timeout: 30000 });
  ok('ثبت با تأیید صاحب جلسه: پیام موفقیت با شمارش تعهد/اقدام', true);
  const persisted = await page.evaluate(async () => {
    const tok = sessionStorage.getItem('srip_access_token');
    const [c, a] = await Promise.all([
      fetch('/api/v1/commitments', { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
      fetch('/api/v1/actions', { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
    ]);
    const cl = c.items ?? c, al = a.items ?? a;
    return {
      commitment: cl.some((x) => String(x.notes ?? '').includes('دستیار جلسه')),
      action: al.some((x) => String(x.description ?? '').includes('دستیار جلسه') || String(x.title ?? '').includes('پیگیری')),
    };
  });
  ok('ثبت واقعی: تعهد و اقدامِ «از دستیار جلسه» در فهرست‌ها ظاهر شدند',
    persisted.commitment && persisted.action, JSON.stringify(persisted));
} catch (e) {
  fail++; failures.push(`استثنا: ${e.message}`);
  console.error('  ❌ استثنا:', e.message);
} finally {
  await browser.close();
}

console.log(`\nMEETING-ASSISTANT-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('  Failed:', failures.join(' | '));
process.exit(fail > 0 ? 1 : 0);
