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

  // 2) open publics hub
  await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('hub header', await waitForText('نقشهٔ عموم‌ها'));
  ok('tab شناسنامهٔ سازمان', await waitForText('شناسنامهٔ سازمان'));

  // 3) self tab content
  ok('کارت شناسنامهٔ سازمان', await waitForText('شناسنامهٔ سازمان'));
  ok('org هلدینگ آریا', await waitForText('هلدینگ آریا'));
  ok('6 kategori rows', await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length === 6), 'rows=' + await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length));
  ok('groups count 105', await waitForText('۱۰۵'));

  // 4) members tab
  await clickByText('button[role="tab"]', 'اعضا و ارزیابی');
  await new Promise(r => setTimeout(r, 800));
  ok('matrix', await page.evaluate(() => (document.body.textContent ?? '').includes('ماتریس قدرت')));
  const memberRows0 = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('seed members 14', memberRows0 === 14, 'rows=' + memberRows0);

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
  ok('member count 15', memberRows1 === 15, 'rows=' + memberRows1);

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
    const stage = [...card.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'ACTIVE'));
    if (stage) { stage.value = 'ACTIVE'; stage.dispatchEvent(new Event('change', { bubbles: true })); }
    const range = card.querySelector('input[type="range"]');
    if (range) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(range, '80'); range.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const btn = [...card.querySelectorAll('button')].find(b => b.textContent.includes('ثبت ارزیابی'));
    if (btn) btn.click();
  });
  ok('assess flash', await waitForText('ارزیابی «') && await waitForText('بازبینی'));

  // 7) coverage tab
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('پوشش')); if (b) b.click(); });
  const covOk = await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('پوشش'));
    const body = document.body.textContent ?? '';
    return !!t && t.className.includes('active') && body.includes('۱۰۵') && body.includes('٪ پوشش');
  }, { timeout: 20000 }).then(() => true).catch(() => false);
  ok('coverage totals', covOk);
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
  ok('coverage 104 after deactivate', await page.evaluate(() => (document.body.textContent ?? '').includes('۱۰۴')));
  await clickByText('button[role="tab"]', 'گروه‌ها');
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { const b = document.querySelector('tr[data-gid="h-m5"] button[data-act="restore"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1500));
  ok('group restored', await page.evaluate(() => { const t = document.querySelector('tr[data-gid="h-m5"]')?.textContent ?? ''; return t.includes('فعال') && !t.includes('غیرفعال'); }));
  await clickByText('button[role="tab"]', 'پوشش');
  await new Promise(r => setTimeout(r, 900));
  ok('coverage 105 after restore', await page.evaluate(() => (document.body.textContent ?? '').includes('۱۰۵')));
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
  await page.evaluate(() => { const b = document.querySelector('button[data-cat="INTERNAL"]'); if (b) b.click(); });
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
