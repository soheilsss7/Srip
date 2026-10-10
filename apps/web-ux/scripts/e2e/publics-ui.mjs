import puppeteer from 'puppeteer-core';
import sparticuz from '@sparticuz/chromium';

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.e2e-browser');
const BASE = process.env.UI_BASE ?? 'http://localhost:3000';
const EXE = process.env.CHROME_EXE ?? resolve(E2E_DIR, 'chromium');
console.log('chromium:', EXE);
const browser = await puppeteer.launch({
  executablePath: EXE,
  env: {...process.env, LD_LIBRARY_PATH: (process.env.CHROME_LD ?? join(E2E_DIR, 'nss')) + ':' + (process.env.LD_LIBRARY_PATH ?? '')},
  args: [...sparticuz.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  defaultViewport: { width: 1440, height: 960 },
});
const page = await browser.newPage();
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('PASS', name);
  else { console.log('FAIL', name, extra); fails++; }
};
async function textOf(sel) { return page.$eval(sel, el => el.textContent ?? '').catch(() => ''); }
async function clickByText(sel, text) {
  const clicked = await page.evaluate((s, t) => {
    const els = [...document.querySelectorAll(s)];
    const el = els.find(e => (e.textContent ?? '').trim().includes(t));
    if (!el) return false;
    el.click(); return true;
  }, sel, text);
  return clicked;
}
async function waitForText(text, timeout = 20000) {
  try {
    await page.waitForFunction(t => (document.body.textContent ?? '').includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}

try {
  // 1) login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 60000 });
  /* ورود از طریق فرم — دکمه‌های سریع دمو حذف شده‌اند؛ حساب demo با کد MFA (هر ۶ رقم) */
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', 'demo');
  await page.type('#login-pass', '123456');
  await page.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await page.click('.auth-form button[type=submit]');
  await page.waitForSelector('#login-otp', { timeout: 15000 });
  await page.type('#login-otp', '123456');
  await page.click('.auth-form button[type=submit]');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('login → dashboard', await page.evaluate(() => location.pathname.includes('dashboard')) || await waitForText('پیشخوان'), 'url=' + page.url());

  // 0b) بازنشانی دادهٔ دمو (برای اجرای تکرارپذیر E2E)
  ok('demo reset', await page.evaluate(async (BASE) => {
    const t = sessionStorage.getItem('srip_access_token');
    if (!t) return false;
    const r = await fetch(`${BASE}/api/v1/dev/reset`, { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    return r.ok;
  }, BASE));

  // 2) open publics hub — شناسنامه به پروفایل سازمان منتقل شده؛ تب پیش‌فرض «گروه‌ها»
  await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('hub header', await waitForText('نقشهٔ عموم‌ها'));
  /* فاز ۱۳.۴ — پنل شناسایی و اولویت‌بندی (۸.۳.۲/۸.۳.۳ سند v14) */
  const statusV14 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr[data-status-v14]')];
    const card = document.querySelector('.publics-status-v14');
    const txt = (card?.textContent ?? '');
    return {
      four: ['نهفته', 'آگاه', 'فعال', 'میانجی'].every(s => rows.some(r => (r.getAttribute('data-status-v14') === s))),
      n: rows.length,
      cols: ['تعریف عملیاتی', 'نشانهٔ قابل ثبت', 'کنش ارتباطی'].every(c => txt.includes(c)),
    };
  });
  ok('پنل ۸.۳.۲: جدول وضعیت چهارتانه (نهفته/آگاه/فعال/میانجی) با تعریف، نشانه و کنش', statusV14.four && statusV14.n === 4 && statusV14.cols, JSON.stringify(statusV14));
  const flowV14 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr[data-flow-v14]')];
    const card = document.querySelector('.publics-flow-v14');
    const txt = (card?.textContent ?? '');
    return {
      n: rows.length,
      ends: txt.includes('بازبینی ماهانه عموم‌های فعال و میانجی'),
      noQuota: txt.includes('سهمیهٔ ثابت'),
      fields: txt.includes('سطح آگاهی') && txt.includes('منبع مورد اعتماد') && txt.includes('اقدام بعدی'),
    };
  });
  ok('پنل ۸.۳.۳: گردش هفت‌مرحله‌ای + قاعدهٔ اولویت (بدون سهمیهٔ ثابت) + فیلدهای نقشه', flowV14.n === 7 && flowV14.ends && flowV14.noQuota && flowV14.fields, JSON.stringify(flowV14));
  ok('بدون تب شناسنامه (منتقل‌شده به پروفایل سازمان)', await page.evaluate(() => ![...document.querySelectorAll('button[role="tab"]')].some(b => (b.textContent ?? '').includes('شناسنامه'))));
  ok('تب پیش‌فرض: گروه‌ها', await page.evaluate(() => [...document.querySelectorAll('button[role="tab"]')].some(b => (b.textContent ?? '').includes('گروه‌ها') && b.className.includes('active'))));
  ok('بدون تب تکراری «پوشش» (ادغام در هیت‌مپ)', await page.evaluate(() => ![...document.querySelectorAll('button[role="tab"]')].some(b => (b.textContent ?? '').trim() === 'پوشش')));
  ok('تب پوشش (هیت‌مپ) موجود', await page.evaluate(() => [...document.querySelectorAll('button[role="tab"]')].some(b => (b.textContent ?? '').includes('پوشش (هیت‌مپ)'))));

  // 2b) ماتریس نفوذ×حمایت — مدل تابلو: چهار ستون ناحیه + کارت اعضا + درگ بین ستون‌ها
  await clickByText('button[role="tab"]', 'ماتریس نفوذ×حمایت');
  await new Promise(r => setTimeout(r, 900));
  ok('ماتریس: عنوان بخش (تابلوی نواحی)', await waitForText('تابلوی نواحی نفوذ × حمایت'));
  ok('ماتریس: چهار ستون ناحیه', await page.evaluate(() => document.querySelectorAll('[data-zone]').length === 4), 'zones=' + await page.evaluate(() => document.querySelectorAll('[data-zone]').length));
  ok('ماتریس: کارت‌های اعضا در ستون‌ها', await page.evaluate(() => document.querySelectorAll('[data-member-card]').length >= 5), 'cards=' + await page.evaluate(() => document.querySelectorAll('[data-member-card]').length));
  ok('ماتریس: سربرگ نواحی (متحدان کلیدی/قدرتمندان محتاط)', await waitForText('متحدان کلیدی') && await waitForText('قدرتمندان محتاط'));
  ok('ماتریس: نوار سنجهٔ نفوذ/حمایت در کارت‌ها', await page.evaluate(() => (document.body.textContent ?? '').includes('نفوذ') && (document.body.textContent ?? '').includes('حمایت')));
  ok('ماتریس: راهنمای آستانهٔ ۶۰ موتور ارزیابی', await page.evaluate(() => (document.body.textContent ?? '').includes('آستانهٔ')));
  ok('ماتریس: راهنمای کشیدن کارت (تغییر موضع)', await page.evaluate(() => (document.body.textContent ?? '').includes('کشیدن کارت')));
  ok('ماتریس: نام واقعی اعضا در کارت‌ها', await page.evaluate(() => (document.body.textContent ?? '').includes('اتاق بازرگانی تهران') || (document.body.textContent ?? '').includes('شورای ملی راهبری')));
  // کلیک روی کارت → پنل جزئیات و خط زمان
  await page.evaluate(() => { const c = document.querySelector('[data-member-card]'); if (c) c.click(); });
  await new Promise(r => setTimeout(r, 700));
  ok('ماتریس: کلیک کارت → پنل جزئیات و خط زمان', await waitForText('خط زمان موضع'));
  // درگ کارت به ستون دیگر → دیالوگ ثبت علت
  const dragOK = await page.evaluate(async () => {
    const card = document.querySelector('[data-member-card]');
    const zone = [...document.querySelectorAll('[data-zone]')].find(z => z.getAttribute('data-zone') !== (card?.closest('[data-zone]')?.getAttribute('data-zone') ?? ''));
    if (!card || !zone) return false;
    const cz = card.getBoundingClientRect(), zz = zone.getBoundingClientRect();
    const x0 = cz.left + cz.width / 2, y0 = cz.top + cz.height / 2;
    const x1 = zz.left + zz.width / 2, y1 = zz.top + Math.min(zz.height - 10, 40);
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: y0, pointerId: 7 }));
    for (let k = 1; k <= 6; k++) {
      card.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x0 + (x1 - x0) * k / 6, clientY: y0 + (y1 - y0) * k / 6, pointerId: 7 }));
      await new Promise(r => setTimeout(r, 30));
    }
    card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x1, clientY: y1, pointerId: 7 }));
    await new Promise(r => setTimeout(r, 700));
    return (document.body.textContent ?? '').includes('علت تغییر موضع');
  });
  ok('ماتریس: درگ کارت به ناحیهٔ دیگر → ثبت علت', dragOK);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').includes('انصراف')); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 400));

  // 3) شناسنامهٔ سازمان در پروفایل خود سازمان
  await page.goto(`${BASE}/organizations/org-1`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('کارت شناسنامهٔ سازمان در پروفایل', await waitForText('شناسنامهٔ سازمان'));
  ok('شناسنامه: الگو و پوشش', await waitForText('پوشش عموم‌ها'));
  ok('شناسنامه: فرم ویرایش (مأموریت)', await waitForText('مأموریت سازمان'));
  await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 900));
  ok('groups count 116 (۱۰۵ قالب + ۱۱ عموم v14)', await waitForText('۱۱۶'));
  /* فاز ۱۳.۵ — نقشهٔ ۱۱ عموم v14 + دستهٔ بین‌المللی */
  ok('فیلتر دستهٔ «بین‌المللی» موجود (هفتمین دسته)', await page.evaluate(() =>
    !![...document.querySelectorAll('select option')].find(o => (o.textContent ?? '').trim() === 'بین\u200cالمللی')));
  const intlGroup = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    const r = rows.find(tr => (tr.textContent ?? '').includes('شرکای بین\u200cالمللی'));
    return !!r && (r.textContent ?? '').includes('بین\u200cالمللی');
  });
  ok('گروه «مراکز پژوهشی، … و شرکای بین‌المللی» (v14-g11) در نقشه با دستهٔ بین‌المللی', intlGroup);

  // 4) members tab
  await clickByText('button[role="tab"]', 'اعضا و ارزیابی');
  await new Promise(r => setTimeout(r, 800));
  ok('members: خلاصهٔ تحلیل مواضع (به‌جای ماتریس تکراری)', await waitForText('خلاصهٔ تحلیل مواضع'));
  ok('members: نقشهٔ ۲×۲ نواحی با شمار', await page.evaluate(() => (document.body.textContent ?? '').includes('متحدان کلیدی') && (document.body.textContent ?? '').includes('ناظران')));
  ok('members: دکمهٔ پرش به ماتریس کامل', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('ماتریس کامل نفوذ × حمایت'))));
  ok('members: ستون قابل مرتب‌سازی نفوذ/حمایت', await page.evaluate(() => [...document.querySelectorAll('th button')].some(b => (b.textContent ?? '').includes('نفوذ / حمایت'))));
  ok('members: نوار سنجهٔ نفوذ/حمایت در جدول', await page.evaluate(() => (document.body.textContent ?? '').includes('نفوذ') && (document.body.textContent ?? '').includes('حمایت')));
  const memberRows0 = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('seed members 17 (۱۵ + میانجی و نهفتهٔ v14)', memberRows0 === 17, 'rows=' + memberRows0);
  ok('members: وضعیت میانجی (۸.۳.۱ v14) در جدول — ردیف پیوست', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    return rows.some(r => (r.textContent ?? '').includes('میانجی') && (r.textContent ?? '').includes('پیوست'));
  }));
  ok('members: گزینهٔ «میانجی» در سِلکت مرحلهٔ ارزیابی', await page.evaluate(() =>
    [...document.querySelectorAll('select option')].some(o => o.value === 'MEDIATOR' && (o.textContent ?? '').includes('میانجی'))));
  /* فاز ۱۳.۲ — فیلدهای نقشهٔ عموم‌ها روی عضو (۸.۳.۱ v14) */
  ok('members: ستون «آگاهی / درگیری» در جدول', await page.evaluate(() =>
    [...document.querySelectorAll('.table-wrap thead th')].some(th => (th.textContent ?? '').includes('آگاهی / درگیری'))));
  ok('members: نشان آگاهی + مسئول روی ردیف زومیت (کامل + مدیر رسانه)', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    return rows.some(r => (r.textContent ?? '').includes('زومیت') && (r.textContent ?? '').includes('کامل') && (r.textContent ?? '').includes('مسئول: مدیر رسانه'));
  }));
  /* مودال ارزیابی: بخش v14 با فیلدها و مقادیر بذر */
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    const row = rows.find(r => (r.textContent ?? '').includes('پیوست'));
    const btn = row?.querySelector('button[title="ارزیابی و به‌روزرسانی"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 700));
  const v14modal = await page.evaluate(() => {
    const modal = document.querySelector('.modal-card');
    const wrap = modal?.querySelector('[data-v14="publics-member"]');
    return {
      open: !!modal, section: !!wrap,
      topic: (wrap?.querySelector('[data-vi="topic"]')?.value ?? ''),
      awareness: (wrap?.querySelector('[data-vi="awareness"]')?.value ?? ''),
      ownerRole: (wrap?.querySelector('[data-vi="ownerRole"]')?.value ?? ''),
      labels: [...(wrap?.querySelectorAll('.field-label') ?? [])].map(l => (l.textContent ?? '').trim()).join('|'),
    };
  });
  ok('ارزیابی: بخش «نقشهٔ عموم‌ها (۸.۳.۱ v14)» با همهٔ فیلدها', v14modal.open && v14modal.section
    && ['موضوع', 'سطح آگاهی', 'میزان درگیری', 'محدودیت اقدام', 'شبکهٔ اثر', 'منبع مورد اعتماد', 'پیام قابل اثبات', 'شاهد', 'مجرا (کانال)', 'مسئول (از چارت سازمان)', 'اقدام بعدی'].every(l => v14modal.labels.includes(l)));
  ok('ارزیابی: مقادیر بذر v14 در فرم (موضوع/آگاهی کامل/مسئول مدیر رسانه)', v14modal.topic.length > 3 && v14modal.awareness === 'FULL' && v14modal.ownerRole === 'مدیر رسانه');
  await page.evaluate(() => { const b = [...document.querySelectorAll('.modal-card button')].find(x => (x.textContent ?? '').includes('انصراف')); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 400));

  // 5) add member
  await clickByText('button', 'افزودن عضو');
  await new Promise(r => setTimeout(r, 400));
  const modalOk = await page.evaluate(() => !!(document.querySelector('.modal-card')));
  ok('modal opens', modalOk);
  await page.evaluate(() => {
    const card = document.querySelector('.modal-card');
    const selects = [...card.querySelectorAll('select')];
    // group select (first) → h-n2
    const group = selects[0];
    const opt = [...group.options].find(o => o.value === 'h-n2');
    if (opt) { group.value = 'h-n2'; group.dispatchEvent(new Event('change', { bubbles: true })); }
    // source type = organization (default), source select (second)
    const src = selects[2] ?? selects[1];
    const so = [...src.options].find(o => o.value === 'org-7');
    if (so) { src.value = 'org-7'; src.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const card = document.querySelector('.modal-card');
    const btn = [...card.querySelectorAll('button')].find(b => b.textContent.includes('افزودن'));
    if (btn) btn.click();
  });
  const addFlash = await page.waitForFunction(() => {
  const t = document.body.textContent ?? '';
  return t.includes('افزوده شد') || t.includes('افزودن شد');
}, { timeout: 15000 }).then(() => true).catch(() => false);
ok('add member flash', addFlash);
  await new Promise(r => setTimeout(r, 900));
  const memberRows1 = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('member count 18', memberRows1 === 18, 'rows=' + memberRows1);

  // 6) assess the newly added member (first row with ارزیابی button = h-n2 added last → check last row)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    const row = rows.find(r => (r.textContent ?? '').includes('ستاد')); // h-n2 = ستاد ملی؟
    const btn = row ? [...row.querySelectorAll('button')].find(b => b.title?.includes('ارزیابی')) : null;
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  ok('assess modal', await page.evaluate(() => (document.querySelector('.modal-card')?.textContent ?? '').includes('ارزیابی')));
  await page.evaluate(() => {
    const card = document.querySelector('.modal-card');
    /* ارزیابی به «بازیگر کلیدیِ در مرحلهٔ آگاه» = شکاف عقب‌ماندگی واقعی →
       محرک PUBLIC_GAP_DETECTED باید فعال شود و اقدام/اعلان خودکار بسازد */
    const stage = [...card.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'AWARE'));
    if (stage) { stage.value = 'AWARE'; stage.dispatchEvent(new Event('change', { bubbles: true })); }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    [...card.querySelectorAll('input[type="range"]')].forEach((range) => {
      setter.call(range, '80'); range.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const btn = [...card.querySelectorAll('button')].find(b => b.textContent.includes('ثبت ارزیابی'));
    if (btn) btn.click();
  });
  ok('assess flash', await waitForText('ارزیابی «') && await waitForText('بازبینی'));

  // 7) coverage tab — پس از ثبت ارزیابی، رندر جدول اعضا تمام شود بعد کلیک تب (پایداری در بار بالا)
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('پوشش')); if (b) b.click(); });
  const covOk = await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('پوشش'));
    const body = document.body.textContent ?? '';
    return !!t && t.className.includes('active') && body.includes('۱۱۶') && body.includes('٪ پوشش');
  }, { timeout: 35000 }).then(() => true).catch(() => false);
  ok('coverage totals', covOk);
  ok('هیت‌مپ پوشش عمومی (جدول منبع×دسته)', await waitForText('هیت‌مپ پوشش عمومی'));
  ok('coverage category cards', await page.evaluate(() => (document.body.textContent ?? '').includes('نهادی و حاکمیتی') && (document.body.textContent ?? '').includes('اکوسیستم فناوری و صنعت')));

  // 8) gaps tab
  await clickByText('button[role="tab"]', 'شکاف‌ها و اقدام');
  await new Promise(r => setTimeout(r, 800));
  ok('gaps list', await page.evaluate(() => (document.body.textContent ?? '').includes('شکاف‌های نقشهٔ عموم‌ها')));
  ok('gap action buttons', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('افزودن عضو'))));

  // 9) export tab
  await clickByText('button[role="tab"]', 'خروجی و رسانه');
  await new Promise(r => setTimeout(r, 800));
  ok('media seeded', await waitForText('زومیت'));
  ok('export json button', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('خروجی JSON'))));

  // 10b) per-org groups: تب «گروه‌ها»
  page.on('dialog', async d => { await d.accept().catch(() => {}); });
  await clickByText('button[role="tab"]', 'گروه‌ها');
  await new Promise(r => setTimeout(r, 900));
  ok('groups tab', await waitForText('گروه‌های نقشه'));
  ok('groups rows 100+', await page.evaluate(() => document.querySelectorAll('tr[data-gid]').length) >= 100);
  await page.evaluate(() => { const b = document.querySelector('tr[data-gid="h-m5"] button[data-act="toggle"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1500));
  ok('group deactivated', await page.evaluate(() => (document.querySelector('tr[data-gid="h-m5"]')?.textContent ?? '').includes('غیرفعال')));
  await clickByText('button[role="tab"]', 'پوشش');
  await new Promise(r => setTimeout(r, 900));
  ok('coverage 115 after deactivate (۱۱۶−۱)', await page.evaluate(() => (document.body.textContent ?? '').includes('۱۱۵')));
  await clickByText('button[role="tab"]', 'گروه‌ها');
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { const b = document.querySelector('tr[data-gid="h-m5"] button[data-act="restore"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1500));
  ok('group restored', await page.evaluate(() => { const t = document.querySelector('tr[data-gid="h-m5"]')?.textContent ?? ''; return t.includes('فعال') && !t.includes('غیرفعال'); }));
  await clickByText('button[role="tab"]', 'پوشش');
  await new Promise(r => setTimeout(r, 900));
  ok('coverage 116 after restore', await page.evaluate(() => (document.body.textContent ?? '').includes('۱۱۶')));
  await clickByText('button[role="tab"]', 'گروه‌ها');
  await new Promise(r => setTimeout(r, 900));
  await clickByText('button', 'گروه جدید');
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.modal-card')].at(-1);
    const inp = card?.querySelector('input[data-gi="fa"]');
    if (inp) {
      const proto = Object.getPrototypeOf(inp);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value') ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      desc?.set?.call(inp, 'کارگروه تست خودکار');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.modal-card')].at(-1);
    const btn = [...(card?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').includes('ساخت گروه'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  ok('custom group created', await waitForText('کارگروه تست خودکار'));
  const customGid = await page.evaluate(() => [...document.querySelectorAll('tr[data-gid]')].find(tr => (tr.textContent ?? '').includes('کارگروه تست خودکار'))?.getAttribute('data-gid'));
  await page.evaluate((gid) => { const b = document.querySelector(`tr[data-gid="${gid}"] button[data-act="delete"]`); if (b) b.click(); }, customGid);
  await new Promise(r => setTimeout(r, 1500));
  ok('custom group deleted', await page.evaluate(() => !((document.body.textContent ?? '').includes('کارگروه تست خودکار'))));
  await page.evaluate(() => { const b = document.querySelector('tr[data-gid="h-m1"] button[data-act="edit"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.modal-card')].at(-1);
    const ta = card?.querySelector('textarea[data-gi="note"]');
    if (ta) {
      const proto = Object.getPrototypeOf(ta);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value') ?? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      desc?.set?.call(ta, 'یادداشت اختصاصی تست');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.modal-card')].at(-1);
    const btn = [...(card?.querySelectorAll('button') ?? [])].find(b => (b.textContent ?? '').trim() === 'ذخیره');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  ok('group note overridden', await waitForText('یادداشت اختصاصی تست'));
  ok('group flagged overridden', await page.evaluate(() => (document.querySelector('tr[data-gid="h-m1"]')?.textContent ?? '').includes('ویرایش‌شده')));
  await page.evaluate(() => { const b = document.querySelector('tr[data-gid="h-m1"] button[data-act="restore"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1500));
  ok('group note restored', await page.evaluate(() => !((document.body.textContent ?? '').includes('یادداشت اختصاصی تست'))));

  // 11) P3: graph categories, ego, filter
  await page.goto(`${BASE}/network`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('svg [data-ego="true"]', { timeout: 30000 });
  const egoInfo = await page.evaluate(() => {
    const g = document.querySelector('svg [data-ego="true"]');
    return { label: (g?.textContent ?? '').trim(), cat: g?.getAttribute('data-cat') };
  });
  ok('graph ego', egoInfo.label.includes('خود') && egoInfo.label.includes('هلدینگ آریا'), JSON.stringify(egoInfo));
  const faNum = (v) => Number(String(v ?? '').replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
  const colored = await page.evaluate(() => document.querySelector('[data-categorized-count]')?.textContent ?? '0');
  ok('graph colored 8+', faNum(colored) >= 8, 'colored=' + colored);
  const chips = await page.evaluate(() => [...document.querySelectorAll('button[data-cat]')].map(b => ({ cat: b.getAttribute('data-cat'), count: Number(b.getAttribute('data-count') ?? 0) })));
  ok('graph 6 category chips', chips.filter(c => c.cat).length === 6, 'chips=' + chips.length);
  ok('graph 3+ categories populated', chips.filter(c => c.count > 0).length >= 3, 'populated=' + chips.filter(c => c.count > 0).length);
  const countRendered = async () => faNum(await textOf('.net-graph-head .counts b'));
  const before = await countRendered();
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[data-cat]')].find(x => x.getAttribute('data-cat') && Number(x.getAttribute('data-count') ?? 0) > 0); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 900));
  const after = await countRendered();
  ok('graph filter', after > 0 && after < before, `before=${before} after=${after}`);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[data-cat=""]')].find(x => (x.textContent ?? '').includes('همه')); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 900));
  const afterReset = await countRendered();
  ok('graph filter reset', afterReset >= before, `before=${before} reset=${afterReset}`);

  // 12) gap path suggestion
  await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 60000 });
  await waitForText('نقشهٔ عموم‌ها');
  await new Promise(r => setTimeout(r, 1200));
  await clickByText('button[role="tab"]', 'شکاف‌ها و اقدام');
  await new Promise(r => setTimeout(r, 1500));
  const gapDbg = await page.evaluate(() => ({
    path: [...document.querySelectorAll('.gap-path')].length,
    has: (document.body.textContent ?? '').includes('مسیر پیشنهادی'),
    gaps: (document.body.textContent ?? '').includes('شکاف‌های نقشهٔ عموم‌ها'),
    tabs: [...document.querySelectorAll('button[role="tab"]')].filter(b => (b.textContent ?? '').includes('شکاف')).map(b => b.className),
  }));
  ok('gap path suggestion', gapDbg.has, JSON.stringify(gapDbg));
  ok('gap path note', await page.evaluate(() => (document.body.textContent ?? '').includes('نزدیک‌ترین گره') || (document.body.textContent ?? '').includes('ورود مستقیم')));

  // 13) P4: KPI + خلاصه + Excel + گردش‌کار واقعی
  const kpiCards = await page.evaluate(() => document.querySelectorAll('.stat-grid[data-kpi="publics"] .stat-card').length);
  ok('kpi cards 6+', kpiCards >= 6, 'cards=' + kpiCards);
  ok('kpi پوشش نقشه', await page.evaluate(() => (document.body.textContent ?? '').includes('پوشش نقشه')));
  ok('خلاصهٔ مدیریتی', await page.evaluate(() => !!document.querySelector('[data-brief="publics"]') && (document.querySelector('[data-brief="publics"]')?.textContent ?? '').includes('خلاصهٔ مدیریتی نقشهٔ عموم‌ها')));
  ok('brief شکاف بحرانی', await page.evaluate(() => (document.body.textContent ?? '').includes('شکاف بحرانی')));
  await clickByText('button[role="tab"]', 'خروجی و رسانه');
  await new Promise(r => setTimeout(r, 800));
  ok('excel button', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('خروجی Excel'))));

  // 14) P4: اقدام/گردش‌کار واقعی از محرک شکاف
  await page.goto(`${BASE}/actions`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('wf created action', await waitForText('برنامهٔ رفع شکاف عموم‌ها'));
  await page.goto(`${BASE}/workflows`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('wf PUBLIC_GAP cover', await waitForText('شکاف عموم') && await waitForText('برنامهٔ پوشش'));
  // 10) sidebar has publics link
  ok('sidebar عموم‌ها', await page.evaluate(() => [...document.querySelectorAll('a')].some(a => (a.textContent ?? '').includes('عموم‌ها'))));

} catch (e) {
  console.log('FAIL exception', e.message); fails++;
} finally {
  await browser.close();
}
console.log(fails ? `E2E FAILED (${fails})` : 'UI E2E ALL GREEN');
process.exit(fails ? 1 : 0);
