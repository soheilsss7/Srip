#!/usr/bin/env node
/* _agent-check.mjs — راستی‌آزمایی E2E «عامل معرفی خودکار» (مسترپلن فاز ۴/۲۴، الگوی Boomerang)
   سناریو A (مرورگر): برنامه‌ریزی عامل → واسطهٔ مجاز + پیش‌نویس → ویرایش متن →
     ارسال درخواست رضایت → ثبت معرفی REQUESTED + لاگ اجرا + راستی‌آزمایی API
   سناریو B (مرورگر): مقصد با مسیر مستقیم → حالت DIRECT (بدون واسطه، دکمهٔ «ثبت معرفی مستقیم»)
   سناریو C (API): بستن سقف → NO_ELIGIBLE_INTERMEDIARY + 409؛ بازکردن سقف → اجرا →
     رضایت واسطه → پذیرش معرفی → ممیزی
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_agent-check.mjs
*/
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CHROME = process.env.CHROME_EXE ?? join(ROOT, '.e2e-browser', 'chromium');
const LD = process.env.CHROME_LD ?? join(ROOT, '.e2e-browser', 'nss');
const BASE = process.env.E2E_BASE ?? 'http://localhost:4100/Srip/srip2';
const API = process.env.E2E_API ?? 'http://localhost:4000/api/v1';

if (!existsSync(CHROME)) {
  console.error('[agent-check] کروم E2E موجود نیست — ابتدا node scripts/e2e-browser-setup.mjs');
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.error('  ✗', label); } };

function scenario(name, { steps }) {
  console.log(`\n== ${name} ==`);
  const script = `
    const puppeteer = require('puppeteer-core');
    (async () => {
      const browser = await puppeteer.launch({
        executablePath: ${JSON.stringify(CHROME)},
        headless: true,
        args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      const consoleErrors = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
      page.on('pageerror', e => consoleErrors.push(String(e).slice(0, 300)));
      try {
        ${steps}
        console.log('CONSOLE_ERRORS:' + JSON.stringify(consoleErrors));
      } catch (e) {
        console.log('SCENARIO_FAIL:' + String(e && e.message || e).slice(0, 500));
        console.log('CONSOLE_ERRORS:' + JSON.stringify(consoleErrors));
      } finally { await browser.close(); }
    })().catch(e => { console.error('FATAL', e); process.exit(1); });
  `;
  let out = '';
  try {
    out = execFileSync('node', ['-e', script], {
      cwd: ROOT, encoding: 'utf8', timeout: 120000,
      env: { ...process.env, LD_LIBRARY_PATH: LD },
    });
  } catch (e) { out = (e.stdout ?? '') + '\n' + (e.stderr ?? ''); }
  process.stdout.write(out.replace(/CONSOLE_ERRORS:.*/s, ''));
  const errLine = out.split('\n').find(l => l.startsWith('CONSOLE_ERRORS:'));
  const errs = errLine ? JSON.parse(errLine.slice('CONSOLE_ERRORS:'.length)) : ['no-result'];
  if (out.includes('SCENARIO_FAIL:')) { fail++; console.error('  ✗ scenario crashed'); }
  return { out, errs };
}

/* ورود API + ذخیرهٔ توکن (الگوی اثبات‌شدهٔ _i18n-check سناریو ۴) */
const LOGIN_STEPS = `
  await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'networkidle2' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 20 && !navigator.serviceWorker.controller; i++) {
      await new Promise(r => setTimeout(r, 300));
    }
  });
  await page.evaluate(async () => {
    const r = await fetch(${JSON.stringify(BASE + '/api/v1/auth/login')}, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: '123456', otp: '123456' }),
    });
    const d = await r.json();
    if (d.accessToken) sessionStorage.setItem('srip_access_token', d.accessToken);
  });
`;

/* ─── سناریو A: برنامه‌ریزی + اجرای واسطه‌ای در مرورگر ─── */
{
  const { out, errs } = scenario('A: UI plan→draft→launch (intermediary)', {
    steps: `
      ${LOGIN_STEPS}
      await page.goto(${JSON.stringify(BASE + '/referrals')}, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      const sec = await page.$('section[aria-label="عامل معرفی خودکار"]');
      console.log('SECTION=' + !!sec);
      /* انتخاب سازمان هدف (org-6 = تأمین‌کننده قطعات البرز) در سلکت عامل */
      const picked = await page.evaluate(() => {
        const s = document.querySelector('section[aria-label="عامل معرفی خودکار"] select');
        if (!s) return false;
        const opt = [...s.options].find(o => o.value === 'org-6');
        if (!opt) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(s, 'org-6');
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      });
      console.log('PICKED=' + picked);
      const planned = await page.evaluate(() => {
        const sec = document.querySelector('section[aria-label="عامل معرفی خودکار"]');
        const btn = [...sec.querySelectorAll('button')].find(b => b.textContent.includes('برنامه‌ریزی عامل'));
        if (!btn) return false; btn.click(); return true;
      });
      console.log('PLANNED=' + planned);
      await new Promise(r => setTimeout(r, 2000));
      const body1 = await page.evaluate(() => document.body.innerText);
      console.log('WARM_FOUND=' + body1.includes('مسیر مطمئن یافت شد و عامل یک واسطه'));
      console.log('INTERMEDIARY_SHOWN=' + body1.includes('سارا محمدی'));
      console.log('CONSENT_NOTE=' + body1.includes('هیچ پیامی بدون پذیرش صریح واسطه ارسال نمی‌شود'));
      const draftLen = await page.evaluate(() => {
        const ta = document.querySelector('section[aria-label="عامل معرفی خودکار"] textarea');
        return ta ? ta.value.length : 0;
      });
      console.log('DRAFT_LEN=' + draftLen);
      /* ویرایش پیش‌نویس — عامل باید متنِ کاربر را محترم بشمارد */
      await page.evaluate(() => {
        const ta = document.querySelector('section[aria-label="عامل معرفی خودکار"] textarea');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, ta.value + '\\n– نکتهٔ تکمیلی از سوی من.');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const launched = await page.evaluate(() => {
        const sec = document.querySelector('section[aria-label="عامل معرفی خودکار"]');
        const btn = [...sec.querySelectorAll('button')].find(b => b.textContent.includes('ارسال درخواست رضایت واسطه'));
        if (!btn || btn.disabled) return false; btn.click(); return true;
      });
      console.log('LAUNCHED=' + launched);
      await new Promise(r => setTimeout(r, 2500));
      const body2 = await page.evaluate(() => document.body.innerText);
      console.log('FLASH=' + body2.includes('درخواست رضایت واسطه ثبت شد'));
      console.log('ROW_AFTER_LAUNCH=' + body2.includes('با واسطه‌گری سارا محمدی'));
      console.log('RUNS_LOG=' + body2.includes('اجراهای اخیر عامل'));
      /* راستی‌آزمایی API: معرفی عامل‌ساخته دقیقاً همان قواعد را دارد */
      const apiCheck = await page.evaluate(async () => {
        const tok = sessionStorage.getItem('srip_access_token');
        const r = await fetch(${JSON.stringify(BASE + '/api/v1/core-domain/referrals')}, { headers: { authorization: 'Bearer ' + tok } });
        const rows = await r.json();
        const list = Array.isArray(rows) ? rows : (rows.items ?? []);
        const hit = list.find(x => (x.agent?.mode === 'INTERMEDIARY') && x.sourcePersonId === 'p-1'
          && String(x.message || '').includes('نکتهٔ تکمیلی از سوی من'));
        return hit ? JSON.stringify({ id: hit.id, status: hit.status, requestStatus: hit.requestStatus }) : 'NOT_FOUND';
      });
      console.log('API_AGENT_REF=' + apiCheck);
    `,
  });
  ok(out.includes('SECTION=true'), 'A: بخش «عامل معرفی خودکار» در صفحه');
  ok(out.includes('PICKED=true'), 'A: انتخاب سازمان هدف');
  ok(out.includes('PLANNED=true'), 'A: کلیک برنامه‌ریزی عامل');
  ok(out.includes('WARM_FOUND=true'), 'A: مسیر مطمئن + واسطهٔ مجاز اعلام شد');
  ok(out.includes('INTERMEDIARY_SHOWN=true'), 'A: واسطهٔ انتخاب‌شده (سارا محمدی) با کارت سقف');
  ok(out.includes('CONSENT_NOTE=true'), 'A: قاعدهٔ رضایت صریح نمایش داده شد');
  ok(out.includes('DRAFT_LEN=') && !out.includes('DRAFT_LEN=0'), 'A: پیش‌نویس متن معرفی تولید شد');
  ok(out.includes('LAUNCHED=true'), 'A: ارسال درخواست رضایت واسطه');
  ok(out.includes('FLASH=true'), 'A: پیام تأیید پس از اجرا');
  ok(out.includes('ROW_AFTER_LAUNCH=true'), 'A: معرفی جدید در فهرست با برچسب واسطه');
  ok(out.includes('RUNS_LOG=true'), 'A: لاگ «اجراهای اخیر عامل»');
  ok(out.includes('"requestStatus":"REQUESTED"'), 'A: API — معرفی عامل REQUESTED (در انتظار رضایت)');
  ok(errs.length === 0, `A: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو B: مسیر مستقیم → حالت DIRECT ─── */
{
  const { out, errs } = scenario('B: UI direct mode (no intermediary)', {
    steps: `
      ${LOGIN_STEPS}
      await page.goto(${JSON.stringify(BASE + '/referrals')}, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => {
        const s = document.querySelector('section[aria-label="عامل معرفی خودکار"] select');
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(s, 'org-4');
        s.dispatchEvent(new Event('change', { bubbles: true }));
        const btn = [...document.querySelector('section[aria-label="عامل معرفی خودکار"]').querySelectorAll('button')]
          .find(b => b.textContent.includes('برنامه‌ریزی عامل'));
        btn.click();
      });
      await new Promise(r => setTimeout(r, 2000));
      const body = await page.evaluate(() => document.body.innerText);
      console.log('DIRECT_BANNER=' + body.includes('مسیر مستقیمِ قوی موجود است'));
      console.log('NO_INTERMEDIARY_CARD=' + !body.includes('واسطهٔ انتخاب‌شده'));
      const btnLabel = await page.evaluate(() => {
        const sec = document.querySelector('section[aria-label="عامل معرفی خودکار"]');
        const btn = [...sec.querySelectorAll('button')].find(b => b.textContent.includes('ثبت معرفی مستقیم'));
        return btn && !btn.disabled;
      });
      console.log('DIRECT_BTN=' + !!btnLabel);
    `,
  });
  ok(out.includes('DIRECT_BANNER=true'), 'B: بنر «مسیر مستقیم موجود است»');
  ok(out.includes('NO_INTERMEDIARY_CARD=true'), 'B: بدون کارت واسطه در حالت مستقیم');
  ok(out.includes('DIRECT_BTN=true'), 'B: دکمهٔ «ثبت معرفی مستقیم» فعال');
  ok(errs.length === 0, `B: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو C: سقف + رضایت + پذیرش (API) ─── */
{
  console.log('\n== C: caps + consent + accept (API) ==');
  const script = `
    const API = ${JSON.stringify(API)};
    async function call(path, opts = {}) {
      const r = await fetch(API + path, opts);
      let d = null; try { d = await r.json(); } catch (e) { d = null; }
      return { status: r.status, d };
    }
    const login = await call('/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: '123456', otp: '123456' }),
    });
    const H = { authorization: 'Bearer ' + login.d.accessToken, 'content-type': 'application/json' };
    /* ۱) وضعیت فعلی سقف p-1 */
    const st0 = await call('/people/p-1/intro-settings', { headers: H });
    /* ۲) بستن سقف = مصرف‌شده */
    const used = (await call('/core-domain/referrals', { headers: H }))
      .d.filter(x => x.sourcePersonId === 'p-1' && String(x.createdAt || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
    await call('/people/p-1/intro-settings', { method: 'PUT', headers: H, body: JSON.stringify({ maxRequestsPerMonth: Math.max(0, used - 1) || 1 }) });
    const capped = await call('/core-domain/referrals/agent/plan', { method: 'POST', headers: H, body: JSON.stringify({ targetOrganizationId: 'org-6' }) });
    const cappedLaunch = await call('/core-domain/referrals/agent/launch', {
      method: 'POST', headers: H,
      body: JSON.stringify({ targetOrganizationId: 'org-6', intermediaryPersonId: 'p-1', draft: { title: 'تست سقف', message: 'متن' } }),
    });
    /* با بسته‌شدن سقف p-1، خودِ p-1 از فهرست مجازها حذف می‌شود (واسطهٔ دیگری اگر
       مجاز باشد انتخاب می‌شود — همان منطق Boomerang) */
    console.log('CAPPED_EXCLUDED=' + (capped.d.intermediary == null || capped.d.intermediary.personId !== 'p-1'));
    console.log('CAPPED_REASON=' + (capped.d.reason || '').slice(0, 40));
    console.log('CAPPED_LAUNCH_409=' + (cappedLaunch.status === 409));
    /* ۳) بازکردن سقف → واسطه برمی‌گردد */
    await call('/people/p-1/intro-settings', { method: 'PUT', headers: H, body: JSON.stringify({ maxRequestsPerMonth: 20 }) });
    const reopen = await call('/core-domain/referrals/agent/plan', { method: 'POST', headers: H, body: JSON.stringify({ targetOrganizationId: 'org-6' }) });
    console.log('REOPEN_MODE=' + reopen.d.mode);
    console.log('REOPEN_REMAINING=' + (reopen.d.intermediary ? reopen.d.intermediary.remaining : -1));
    /* ۴) اجرا → رضایت واسطه → پذیرش معرفی */
    const launch = await call('/core-domain/referrals/agent/launch', {
      method: 'POST', headers: H,
      body: JSON.stringify({ targetOrganizationId: 'org-6', intermediaryPersonId: 'p-1', draft: { title: 'معرفی سناریو C', message: 'سلام، من سارا هستم.', instruction: { goal: 'جلسهٔ سناریو C', allowed: ['معرفی دو طرف'], forbidden: ['قیمت'], boundaries: 'تست', dueDays: 30 } } }),
    });
    const rid = launch.d.id;
    console.log('LAUNCH_201=' + (launch.status === 201));
    console.log('LAUNCH_REQUESTED=' + (launch.d.requestStatus === 'REQUESTED'));
    const consent = await call('/core-domain/referrals/' + rid, { method: 'PATCH', headers: H, body: JSON.stringify({ requestStatus: 'RESPONDED_YES' }) });
    console.log('CONSENT_YES=' + (consent.d.requestStatus === 'RESPONDED_YES'));
    const accept = await call('/core-domain/referrals/' + rid, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'ACCEPTED' }) });
    console.log('ACCEPTED=' + (accept.d.status === 'ACCEPTED'));
    /* ۵) لاگ اجرا */
    const runs = await call('/core-domain/referrals/agent/runs', { headers: H });
    console.log('RUNS_HAS_LAUNCH=' + runs.d.items.some(x => x.kind === 'LAUNCH' && x.referralId === rid));
    /* ۶) بازیابی تنظیم اولیهٔ سقف */
    await call('/people/p-1/intro-settings', { method: 'PUT', headers: H, body: JSON.stringify({ maxRequestsPerMonth: st0.d.maxRequestsPerMonth }) });
  `;
  let out = '';
  try { out = execFileSync('node', ['-e', script], { encoding: 'utf8', timeout: 60000 }); }
  catch (e) { out = (e.stdout ?? '') + '\n' + (e.stderr ?? ''); }
  process.stdout.write(out);
  ok(out.includes('CAPPED_EXCLUDED=true'), 'C: بستن سقف → واسطهٔ سقف‌پر از انتخاب حذف می‌شود');
  ok(out.includes('CAPPED_LAUNCH_409=true'), 'C: اجرای عامل با سقفِ پر → 409');
  ok(out.includes('REOPEN_MODE=INTERMEDIARY'), 'C: بازکردن سقف → واسطهٔ مجاز برمی‌گردد');
  ok(out.includes('LAUNCH_201=true') && out.includes('LAUNCH_REQUESTED=true'), 'C: اجرا → معرفی PENDING/REQUESTED');
  ok(out.includes('CONSENT_YES=true'), 'C: رضایت صریح واسطه ثبت شد (RESPONDED_YES)');
  ok(out.includes('ACCEPTED=true'), 'C: پذیرش معرفی پس از رضایت');
  ok(out.includes('RUNS_HAS_LAUNCH=true'), 'C: لاگ اجرای عامل کامل است');
}

console.log(`\n========== agent E2E: ${pass} PASS / ${fail} FAIL ==========`);
process.exit(fail ? 1 : 0);
