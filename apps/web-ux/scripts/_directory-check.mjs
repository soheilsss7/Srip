#!/usr/bin/env node
/* _directory-check.mjs — راستی‌آزمایی E2E «دیتابیس روابط بیرونی» (فاز ۴/۲۵، الگوی RelSci/TSC)
   سناریو A (مرورگر، فارسی): صفحهٔ /directory + ناوبری + جست‌وجو + فیلتر دسته +
     اتصال نهاد به شبکه + راستی‌آزمایی API سازمان‌ها
   سناریو B (مرورگر، انگلیسی): ترجمهٔ کامل صفحه (TRANSLATED_ROUTES)
   سناریو C (API): جداسازی مستأجر (pars فقط سازمان خودش را می‌بیند) + متر مصرف
     تا سقف → 429 (با حساب موقت personal تا سهمیهٔ دمو نسوزد)
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_directory-check.mjs
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
  console.error('[directory-check] کروم E2E موجود نیست — ابتدا node scripts/e2e-browser-setup.mjs');
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

const loginSteps = (locale) => `
  await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'networkidle2' });
  await page.evaluate(() => { try { localStorage.setItem('srip_locale', ${JSON.stringify(locale)}); } catch (e) {} });
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

/* ─── سناریو A: فارسی — جست‌وجو + فیلتر + اتصال ─── */
{
  const { out, errs } = scenario('A: FA — search, filter, connect', {
    steps: `
      ${loginSteps('fa')}
      await page.goto(${JSON.stringify(BASE + '/directory')}, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      const body1 = await page.evaluate(() => document.body.innerText);
      console.log('PAGE_TITLE=' + body1.includes('دیتابیس روابط بیرونی'));
      console.log('USAGE_CARDS=' + (body1.includes('نهادهای کاتالوگ') && body1.includes('جست‌وجوی این ماه')));
      console.log('CATALOG_67=' + body1.includes('۶۷'));
      const nav = await page.evaluate(() => document.querySelector('.side-nav')?.innerText ?? 'NONE');
      console.log('NAV_HAS_DIR=' + nav.includes('دیتابیس روابط بیرونی'));
      /* جست‌وجوی «وزارت» */
      await page.evaluate(() => {
        const inp = document.querySelector('section[aria-label="جست‌وجوی دیتابیس بیرونی"] input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(inp, 'وزارت');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'جست‌وجو');
        btn.click();
      });
      await new Promise(r => setTimeout(r, 1500));
      const body2 = await page.evaluate(() => document.body.innerText);
      console.log('SEARCH_WAZARAT=' + (body2.includes('وزارت نیرو') && body2.includes('تنظیم‌گر')));
      console.log('RESULT_COUNT=' + ((body2.match(/نتیجه/g) ?? []).length > 0));
      /* فیلتر دسته: دانشگاه/پژوهش (ابتدا جست‌جو پاک می‌شود تا فیلتر تنها اعمال شود) */
      await page.evaluate(() => {
        const inp = document.querySelector('section[aria-label="جست‌وجوی دیتابیس بیرونی"] input');
        const isetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        isetter.call(inp, '');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        const s = document.querySelector('section[aria-label="جست‌وجوی دیتابیس بیرونی"] select');
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(s, 'ACADEMIA');
        s.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await new Promise(r => setTimeout(r, 1500));
      const body3 = await page.evaluate(() => document.body.innerText);
      console.log('FILTER_ACADEMIA=' + (body3.includes('دانشگاه تهران') && !body3.includes('وزارت نیرو')));
      /* اتصال «دانشگاه تهران» — از طریق دیالوگ جزئیات */
      const opened = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('section[aria-label="جست‌وجوی دیتابیس بیرونی"] .listRow')];
        const row = rows.find(r => r.innerText.includes('دانشگاه تهران'));
        if (!row) return false;
        const btn = [...row.querySelectorAll('button')].find(b => b.textContent.includes('اتصال به شبکهٔ من'));
        if (!btn) return false; btn.click(); return true;
      });
      console.log('DETAIL_OPENED=' + opened);
      await new Promise(r => setTimeout(r, 1200));
      const tieShown = await page.evaluate(() => document.body.innerText.includes('پیوندهای شناخته‌شدهٔ عمومی'));
      console.log('TIES_SHOWN=' + tieShown);
      const connected = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return false;
        const btn = [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'اتصال به شبکهٔ من');
        if (!btn || btn.disabled) return false; btn.click(); return true;
      });
      console.log('CONNECT_CLICKED=' + connected);
      await new Promise(r => setTimeout(r, 2000));
      const body4 = await page.evaluate(() => document.body.innerText);
      console.log('FLASH=' + body4.includes('نهاد به شبکهٔ شما متصل شد'));
      console.log('LINKED_BADGE=' + body4.includes('متصل‌شده به شبکهٔ شما'));
      /* راستی‌آزمایی API: سازمان متصل‌شده در فهرست سازمان‌های دمو */
      const apiCheck = await page.evaluate(async () => {
        const tok = sessionStorage.getItem('srip_access_token');
        const r = await fetch(${JSON.stringify(BASE + '/api/v1/organizations')}, { headers: { authorization: 'Bearer ' + tok } });
        const d = await r.json();
        const list = Array.isArray(d) ? d : (d.items ?? []);
        const hit = list.find(o => (o.directorySource ?? {}).directoryId === 'org-ac-tehran');
        return hit ? JSON.stringify({ id: hit.id, name: hit.name, tenant: hit.tenant }) : 'NOT_FOUND';
      });
      console.log('API_LINKED_ORG=' + apiCheck);
    `,
  });
  ok(out.includes('PAGE_TITLE=true'), 'A: صفحهٔ «دیتابیس روابط بیرونی» باز شد');
  ok(out.includes('USAGE_CARDS=true'), 'A: کارت‌های متر مصرف (اشتراک directory-basic)');
  ok(out.includes('CATALOG_67=true'), 'A: شمار کاتالوگ = ۶۷ (ارقام فارسی)');
  ok(out.includes('NAV_HAS_DIR=true'), 'A: ناوبری آیتم دیتابیس را دارد');
  ok(out.includes('SEARCH_WAZARAT=true'), 'A: جست‌وجوی «وزارت» → تنظیم‌گرها');
  ok(out.includes('FILTER_ACADEMIA=true'), 'A: فیلتر دستهٔ دانشگاه/پژوهش');
  ok(out.includes('DETAIL_OPENED=true'), 'A: دیالوگ جزئیات نهاد باز شد');
  ok(out.includes('TIES_SHOWN=true'), 'A: پیوندهای شناخته‌شدهٔ عمومی نمایش داده شد');
  ok(out.includes('CONNECT_CLICKED=true'), 'A: کلیک «اتصال به شبکهٔ من»');
  ok(out.includes('FLASH=true'), 'A: پیام تأیید اتصال');
  ok(out.includes('LINKED_BADGE=true'), 'A: نشان «متصل‌شده به شبکهٔ شما»');
  ok(out.includes('"name":"دانشگاه تهران"'), 'A: API — سازمان متصل‌شده در فهرست دمو');
  ok(errs.length === 0, `A: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو B: انگلیسی — صفحهٔ کاملاً ترجمه‌شده ─── */
{
  const { out, errs } = scenario('B: EN — fully translated page', {
    steps: `
      ${loginSteps('en')}
      await page.goto(${JSON.stringify(BASE + '/directory')}, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      const body = await page.evaluate(() => document.body.innerText);
      console.log('EN_TITLE=' + body.includes('External relationships database'));
      console.log('EN_USAGE=' + body.includes('Searches this month'));
      console.log('EN_REGULATOR=' + body.includes('Regulator'));
      console.log('EN_NO_FA_LEFTOVER=' + !(body.includes('دیتابیس') || body.includes('نهادهای کاتالوگ')));
      const nav = await page.evaluate(() => document.querySelector('.side-nav')?.innerText ?? 'NONE');
      console.log('EN_NAV=' + nav.includes('External relationships database'));
    `,
  });
  ok(out.includes('EN_TITLE=true'), 'B: عنوان انگلیسی صفحه');
  ok(out.includes('EN_USAGE=true'), 'B: کارت مصرف انگلیسی');
  ok(out.includes('EN_REGULATOR=true'), 'B: برچسب دستهٔ Regulator');
  ok(out.includes('EN_NO_FA_LEFTOVER=true'), 'B: بدون رشتهٔ فارسی چسبیده');
  ok(out.includes('EN_NAV=true'), 'B: ناوبری انگلیسی');
  ok(errs.length === 0, `B: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو C: جداسازی مستأجر + متر مصرف تا سقف (API) ─── */
{
  console.log('\n== C: tenant isolation + usage quota (API) ==');
  const script = `
    const API = ${JSON.stringify(API)};
    async function call(path, opts = {}) {
      const r = await fetch(API + path, opts);
      let d = null; try { d = await r.json(); } catch (e) {}
      return { status: r.status, d };
    }
    const login = async (u, p) => (await call('/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })).d.accessToken;
    const pt = await login('pars', 'pars1234');
    const H = { authorization: 'Bearer ' + pt, 'content-type': 'application/json' };

    /* ۱) pars همان نهاد را در مستأجر خودش متصل می‌کند */
    const linkPars = await call('/directory/entities/org-ac-tehran', { method: 'POST', headers: H });
    console.log('PARS_LINK_201=' + (linkPars.status === 201 || linkPars.status === 200));
    const parsOrgId = linkPars.d.linkedOrgId;
    console.log('PARS_ORG_ID=' + parsOrgId);
    /* ۲) دمو سازمان pars را نمی‌بیند و برعکس */
    const dt = await login('demo', '123456');
    const HD = { authorization: 'Bearer ' + dt };
    const demoOrgs = await call('/organizations', { headers: HD });
    const dlist = Array.isArray(demoOrgs.d) ? demoOrgs.d : (demoOrgs.d.items ?? []);
    console.log('DEMO_SEES_PARS_ORG=' + dlist.some(o => o.id === parsOrgId));
    const parsOrgs = await call('/organizations', { headers: H });
    const plist = Array.isArray(parsOrgs.d) ? parsOrgs.d : (parsOrgs.d.items ?? []);
    const demoLinked = plist.find(o => (o.directorySource ?? {}).directoryId === 'org-ac-tehran' && o.id !== parsOrgId);
    console.log('PARS_SEES_OTHER_TENANT_LINK=' + !!demoLinked);
    /* ۳) کارت alreadyLinked فقط برای مستأجر خودش */
    const parsList = await call('/directory/entities?search=' + encodeURIComponent('دانشگاه تهران'), { headers: H });
    const row = parsList.d.items.find(e => e.id === 'org-ac-tehran');
    console.log('PARS_ALREADY_LINKED=' + (row && row.alreadyLinked === true && row.linkedOrgId === parsOrgId));
    /* ۴) متر مصرف تا سقف → 429 (با حساب موقت، تا سهمیهٔ دمو/پارس نسوزد) */
    const regEmail = 'quota' + Date.now() + '@test.ir';
    const reg = await call('/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'تست سهمیه', email: regEmail, password: 'Password123456' }),
    });
    let qt = reg.d?.accessToken;
    if (!qt) {
      qt = (await call('/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: 'Password123456' }),
      })).d.accessToken;
    }
    const HQ = { authorization: 'Bearer ' + qt };
    let hit429 = false, queries = 0;
    for (let i = 0; i < 320 && !hit429; i++) {
      const r = await call('/directory/entities?pageSize=5&search=' + encodeURIComponent('دانشگاه'), { headers: HQ });
      if (r.status === 429) { hit429 = true; queries = Math.max(queries, r.d?.usage?.queries ?? 0); }
      else if (r.status === 200) { queries = r.d.usage.queries; }
      else { console.log('UNEXPECTED_STATUS=' + r.status); break; }
    }
    console.log('QUOTA_429=' + hit429);
    console.log('QUOTA_COUNTED=' + (queries >= 300));
  `;
  let out = '';
  try { out = execFileSync('node', ['-e', script], { encoding: 'utf8', timeout: 180000 }); }
  catch (e) { out = (e.stdout ?? '') + '\n' + (e.stderr ?? ''); }
  process.stdout.write(out);
  ok(out.includes('PARS_LINK_201=true'), 'C: pars نهاد را در مستأجر خودش متصل کرد');
  ok(out.includes('DEMO_SEES_PARS_ORG=false'), 'C: دمو سازمان pars را نمی‌بیند');
  ok(out.includes('PARS_SEES_OTHER_TENANT_LINK=false'), 'C: pars اتصال مستأجر دیگر را نمی‌بیند');
  ok(out.includes('PARS_ALREADY_LINKED=true'), 'C: alreadyLinked فقط برای مستأجر خودش');
  ok(out.includes('QUOTA_429=true'), 'C: سهمیهٔ ماهانه → 429 پس از اتمام');
  ok(out.includes('QUOTA_COUNTED=true'), 'C: متر مصرف تا ۳۰۰ شمارش شد');
}

console.log(`\n========== directory E2E: ${pass} PASS / ${fail} FAIL ==========`);
process.exit(fail ? 1 : 0);
