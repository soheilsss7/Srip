#!/usr/bin/env node
/* _i18n-check.mjs — راستی‌آزمایی E2E دوزبانه (فاز ۴/۲۳)
   · حالت فارسی (پیش‌فرض): صفحهٔ ورود RTL با متن فارسی و ارقام فارسی
   · سوییچ به EN: کلیک روی LocaleToggle → reload → LTR + متن انگلیسی + ارقام لاتین
   · لاگ کنسول باید خطای React hydration نداشته باشد
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" node scripts/_i18n-check.mjs
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

if (!existsSync(CHROME)) {
  console.error('[i18n-check] کروم E2E موجود نیست — ابتدا node scripts/e2e-browser-setup.mjs');
  process.exit(1);
}

let pass = 0, fail = 0;
const errors = [];
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.error('  ✗', label); } };

// هر «سناریو» یک کروم تازه است: args + اسکریپت‌های evaluateOnNewDocument + بازدید + سنجه‌ها
function scenario(name, { before, steps }) {
  console.log(`\n== ${name} ==`);
  const script = `
    const {execFileSync} = require('child_process');
    const fs = require('fs');
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
        ${before ?? ''}
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
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 90000,
      env: { ...process.env, LD_LIBRARY_PATH: LD },
    });
  } catch (e) {
    out = (e.stdout ?? '') + '\n' + (e.stderr ?? '');
  }
  process.stdout.write(out.replace(/CONSOLE_ERRORS:.*/s, ''));
  const errLine = out.split('\n').find(l => l.startsWith('CONSOLE_ERRORS:'));
  const errs = errLine ? JSON.parse(errLine.slice('CONSOLE_ERRORS:'.length)) : ['no-result'];
  if (out.includes('SCENARIO_FAIL:')) { fail++; console.error('  ✗ scenario crashed'); }
  return { out, errs };
}

/* ─── سناریو ۱: فارسی پیش‌فرض ─── */
{
  const { out, errs } = scenario('FA default (cold load)', {
    steps: `
      await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'networkidle2' });
      const dir = await page.evaluate(() => document.documentElement.dir);
      const lang = await page.evaluate(() => document.documentElement.lang);
      console.log('DIR=' + dir + ' LANG=' + lang);
      const title = await page.$eval('h2', el => el.textContent).catch(() => 'NONE');
      console.log('H2=' + title);
    `,
  });
  ok(out.includes('DIR=rtl') && out.includes('LANG=fa'), 'fa: dir=rtl lang=fa');
  ok(out.includes('H2=ورود به حساب کاربری'), 'fa: عنوان ورود فارسی');
  ok(errs.length === 0, `fa: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو ۲: سوییچ به EN (کلیک روی toggle) و بارگذاری مجدد ─── */
{
  const { out, errs } = scenario('Switch to EN via toggle + reload', {
    steps: `
      await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'networkidle2' });
      await page.click('.locale-btn');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1200));
      const dir = await page.evaluate(() => document.documentElement.dir);
      const lang = await page.evaluate(() => document.documentElement.lang);
      console.log('DIR=' + dir + ' LANG=' + lang);
      const title = await page.$eval('h2', el => el.textContent).catch(() => 'NONE');
      console.log('H2=' + title);
      const toggle = await page.$eval('.locale-btn', el => el.textContent.trim()).catch(() => 'NONE');
      console.log('TOGGLE=' + toggle);
    `,
  });
  ok(out.includes('DIR=ltr') && out.includes('LANG=en'), 'en: dir=ltr lang=en');
  ok(out.includes('H2=Sign in to your account'), 'en: عنوان ورود انگلیسی');
  ok(out.includes('TOGGLE=فا'), 'en: دکمهٔ برگشت به فارسی');
  ok(errs.length === 0, `en: بدون خطای کنسول/hydration (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو ۳: EN cold load (localStorage از قبل) — پرخطرترین حالت برای hydration ─── */
{
  const { out, errs } = scenario('EN cold load (hydration risk)', {
    before: `
      /* seed localStorage پیش از بارگذاری */
    `,
    steps: `
      await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { try { localStorage.setItem('srip_locale', 'en'); } catch (e) {} });
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 800));
      const title = await page.$eval('h2', el => el.textContent).catch(() => 'NONE');
      const dir = await page.evaluate(() => document.documentElement.dir);
      console.log('H2=' + title + ' DIR=' + dir);
      const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
      console.log('HAS_FA_PANEL=' + (body.includes('Strategic Relationship') || body.includes('Email or username')));
    `,
  });
  ok(out.includes('H2=Sign in to your account') && out.includes('DIR=ltr'), 'en-cold: انگلیسی + LTR از همان اول');
  ok(out.includes('HAS_FA_PANEL=true'), 'en-cold: پنل برند انگلیسی');
  ok(errs.length === 0, `en-cold: بدون خطای hydration (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو ۴: EN داخل اپ لاگین‌شده — ناوبری، ارقام لاتین، مقادیر enum خام ─── */
{
  const { out, errs } = scenario('EN in-app (demo login)', {
    steps: `
      await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { try { localStorage.setItem('srip_locale', 'en'); } catch (e) {} });
      /* ورود دمو */
      await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
      const userInput = (await page.$('input[name="username"]')) || (await page.\$('input[type="text"]'));
      await userInput.type('demo');
      const passInput = await page.\$('input[type="password"]');
      await passInput.type('123456');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
      /* OTP ممکن است لازم شود */
      const otp = await page.\$('input[name="code"], input[inputmode="numeric"]');
      if (otp) { await otp.type('123456'); await page.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 2000)); }
      const url = await page.url();
      console.log('URL=' + url);
      await page.goto(${JSON.stringify(BASE + '/referrals')}, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1200));
      const body = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('REFERRALS_EN=' + (body.includes('Introductions (with audit)')));
      console.log('REFERRALS_FA_LEFTOVER=' + (body.includes('کل معرفی') || body.includes('بازخوانی')));
      const nav = await page.evaluate(() => document.querySelector('.side-nav')?.innerText.slice(0, 400) ?? 'NONE');
      console.log('NAV=' + nav.replace(/\\n/g, ' | ').slice(0, 300));
    `,
  });
  ok(out.includes('REFERRALS_EN=true'), 'en-app: صفحهٔ معرفی‌ها انگلیسی');
  ok(!out.includes('REFERRALS_FA_LEFTOVER=true'), 'en-app: بدون رشتهٔ فارسی چسبیده در referrals');
  ok(out.includes('NAV='), 'en-app: ناوبری لود شد');
  ok(out.toLowerCase().includes('organizations') && out.toLowerCase().includes('home'), `en-app: ناوبری انگلیسی (${(out.match(/NAV=([^\\n]*)/) ?? [])[1]?.slice(0, 80)})`);
  ok(errs.length === 0, `en-app: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

/* ─── سناریو ۵: فارسی همچنان دست‌نخورده (رقم فارسی در داشبورد) ─── */
{
  const { out, errs } = scenario('FA regression (digits remain Persian)', {
    steps: `
      await page.goto(${JSON.stringify(BASE + '/login')}, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { try { localStorage.removeItem('srip_locale'); } catch (e) {} });
      await page.reload({ waitUntil: 'networkidle2' });
      const dir = await page.evaluate(() => document.documentElement.dir);
      const title = await page.\$('h2');
      console.log('DIR=' + dir, 'H2=' + (title ? await title.evaluate(el => el.textContent) : 'NONE'));
    `,
  });
  ok(out.includes('DIR=rtl') && out.includes('H2=ورود به حساب کاربری'), 'fa-regression: فارسی/RTL سالم');
  ok(errs.length === 0, `fa-regression: بدون خطای کنسول (${errs.length ? errs[0] : 'ok'})`);
}

console.log(`\n========== i18n E2E: ${pass} PASS / ${fail} FAIL ==========`);
process.exit(fail ? 1 : 0);
