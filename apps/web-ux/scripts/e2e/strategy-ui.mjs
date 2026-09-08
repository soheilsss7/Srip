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
async function clickByText(sel, text) {
  return page.evaluate((s, t) => {
    const els = [...document.querySelectorAll(s)];
    const el = els.find(e => (e.textContent ?? '').trim().includes(t));
    if (!el) return false;
    el.click(); return true;
  }, sel, text);
}
async function waitForText(text, timeout = 20000) {
  try {
    await page.waitForFunction(t => (document.body.textContent ?? '').includes(t), { timeout }, text);
    return true;
  } catch { return false; }
}
async function gotoTab(label) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').trim().includes(t));
    if (b) b.click();
  }, label);
  await new Promise(r => setTimeout(r, 1200));
}
async function selectScenario(name) {
  await gotoTab('نمای کلی');
  const done = await page.evaluate((n) => {
    const cards = [...document.querySelectorAll('.list-card')];
    const card = cards.find(c => (c.textContent ?? '').includes(n));
    const btn = card ? [...card.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'انتخاب') : null;
    if (btn) { btn.click(); return true; }
    return false;
  }, name);
  await new Promise(r => setTimeout(r, 1200));
  return done;
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.auth-demo-row')].find(x => (x.textContent ?? '').includes('مالک'));
    if (b) b.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('login → dashboard', await page.evaluate(() => location.pathname.includes('dashboard')) || await waitForText('پیشخوان'), 'url=' + page.url());

  ok('demo reset', await page.evaluate(async (BASE) => {
    const t = sessionStorage.getItem('srip_access_token');
    if (!t) return false;
    const r = await fetch(`${BASE}/api/v1/dev/reset`, { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    return r.ok;
  }, BASE));

  await page.goto(`${BASE}/strategy`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  ok('hub header', await waitForText('تحلیل راهبردی'));
  ok('seed scenario', await page.evaluate(() => (document.body.textContent ?? '').includes('جنگ قیمت با پترو صنعت')));
  ok('seed sequential', await page.evaluate(() => (document.body.textContent ?? '').includes('تهدید ورود البرز')));
  ok('archetype PD', await page.evaluate(() => (document.body.textContent ?? '').includes('معمای زندانی')));
  ok('6 tabs', await page.evaluate(() => document.querySelectorAll('button[role="tab"]').length === 6));

  ok('select sequential', await selectScenario('تهدید ورود البرز'));
  await gotoTab('شبیه‌سازی');
  ok('spe path', await waitForText('ورود به بازار'));
  ok('spe payoff', await page.evaluate(() => (document.body.textContent ?? '').includes('مسیر تعادل')));

  ok('select price war', await selectScenario('جنگ قیمت با پترو صنعت'));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').includes('ساخت سناریو از این قالب'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
  ok('tpl modal', await page.evaluate(() => (document.querySelector('.modal-card')?.textContent ?? '').includes('ساخت سناریو از قالب')));
  await page.evaluate(() => {
    const card = document.querySelector('.modal-card');
    const inp = card ? card.querySelector('input') : null;
    if (inp) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'رقابت تست خودکار');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const btn = card ? [...card.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'ساخت سناریو') : null;
    if (btn) btn.click();
  });
  ok('tpl created flash', await waitForText('ساخته شد'));
  ok('tpl in list', await page.evaluate(() => (document.body.textContent ?? '').includes('رقابت تست خودکار')));

  ok('select price war again', await selectScenario('جنگ قیمت با پترو صنعت'));
  await gotoTab('رقبا');
  ok('rivals parties', await waitForText('ماتریس‌های عایدی'));
  ok('rivals org map', await page.evaluate(() => (document.body.textContent ?? '').includes('هلدینگ آریا')));

  await gotoTab('اتصال داده');
  ok('template buttons', await page.evaluate(() => (document.body.textContent ?? '').includes('قالب JSON')));
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '{"version":1,"players":[{"name":"a"}],"strategies":{"self":["x"],"rival":["y"]},"payoffs":{"self":[[1]],"rival":[[1]]}}');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').trim() === 'اعتبارسنجی');
    if (b) b.click();
  });
  ok('import invalid', await waitForText('دست‌کم ۲ مورد'));
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '{"version":1,"players":[{"name":"خود"},{"name":"رقیب"}],"strategies":{"self":["الف","ب"],"rival":["الف","ب"]},"payoffs":{"self":[[2,0],[0,1]],"rival":[[2,0],[0,1]]}}');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const nameInp = [...document.querySelectorAll('.field input')].find(i => (i.placeholder ?? '').includes('واردشده'));
    if (nameInp) {
      const setter2 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter2.call(nameInp, 'ورودی تست خودکار');
      nameInp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').trim() === 'ورود و ساخت سناریو');
    if (b) b.click();
  });
  ok('import created', await waitForText('از دادهٔ خارجی ساخته شد'));

  // 7b) اتصال به پلتفرم دیگر (نمونهٔ قطعی data:)
  ok('conn section', await page.evaluate(() => (document.body.textContent ?? '').includes('اتصال به پلتفرم دیگر')));
  await clickByText('button', 'بارگذاری نمونه');
  await new Promise(r => setTimeout(r, 600));
  ok('conn sample', await page.evaluate(() => [...document.querySelectorAll('.field input')].some(i => (i.value ?? '').startsWith('data:application/json'))));
  await clickByText('button', 'آزمایش اتصال');
  ok('conn test ok', await waitForText('پاسخ دریافت شد'));
  await clickByText('button', 'دریافت و اعتبارسنجی');
  ok('conn pulled valid', await waitForText('داده معتبر است'));
  await clickByText('button', 'ساخت سناریو از داده دریافتی');
  ok('conn scenario', await waitForText('از اتصال ساخته شد'));
  await page.evaluate(() => {
    const urlInp = [...document.querySelectorAll('.field input')].find(i => (i.placeholder ?? '').includes('https://'));
    if (urlInp) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(urlInp, 'ht!tp://::bad');
      urlInp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await clickByText('button', 'آزمایش اتصال');
  ok('conn bad url', await waitForText('ناموفق'));

  ok('select price war sim', await selectScenario('جنگ قیمت با پترو صنعت'));
  await gotoTab('شبیه‌سازی');
  ok('sim matrix NE', await waitForText('تعادل نش'));
  ok('sim NE labels', await page.evaluate(() => (document.body.textContent ?? '').includes('شکست قیمت')));
  ok('sim delta', await page.evaluate(() => (document.body.textContent ?? '').includes('δ ≥')));
  await clickByText('button', 'اجرای شبیه‌سازی');
  ok('sim totals', await waitForText('عایدی انباشته خود'));
  ok('sim rounds 10', await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length >= 10));

  await gotoTab('پیش‌بینی و واکنش');
  await clickByText('button', 'پیش‌بینی از آخرین شبیه‌سازی');
  ok('pred recommend', await waitForText('واکنش توصیه‌شده'));
  ok('pred dist', await page.evaluate(() => (document.body.textContent ?? '').includes('توزیع پیش‌بینی رقیب')));
  ok('whatif', await page.evaluate(() => (document.body.textContent ?? '').includes('چه می‌شود اگر')));

  await gotoTab('خروجی');
  await clickByText('button', 'ساخت بریف');
  ok('brief lines', await waitForText('سناریو: جنگ قیمت با پترو صنعت'));
  ok('export json btn', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('خروجی JSON'))));
  ok('export xls btn', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('دانلود Excel'))));

  await page.goto(`${BASE}/actions`, { waitUntil: 'networkidle0', timeout: 60000 });
  ok('wf created action', await waitForText('بازبینی سناریوی راهبردی تازه'));

  ok('sidebar strategy', await page.evaluate(() => (document.body.textContent ?? '').includes('تحلیل راهبردی')));
} catch (e) {
  console.log('E2E ERROR', e);
  fails++;
}
console.log(fails ? `E2E FAILED (${fails})` : 'UI E2E ALL GREEN');
await browser.close();
process.exit(fails ? 1 : 0);
