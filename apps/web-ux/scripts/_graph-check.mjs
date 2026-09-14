/* تست نمای مرحله‌ای گراف (drill-down) — بیلد استاتیک :4100 یا dev :3000
   اجرا: node scripts/_graph-check.mjs   (UI_BASE قابل تنظیم) */
import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';

const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1440, height: 900 },
});
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

async function login(user, pass_, otp) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(async (u, p, o, api) => {
    const body = o ? { username: u, password: p, otp: o } : { username: u, password: p };
    const r = await fetch(`${location.origin}${api}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.accessToken) sessionStorage.setItem('srip_access_token', d.accessToken);
  }, user, pass_, otp, `${new URL(BASE).pathname}/api/v1`);
  await page.goto(`${BASE}/network`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 6500));
  return page;
}

/* تپ واقعی (pointerdown+pointerup) — کلیک سینتتیک به هندلرهای pointer نمی‌رسد */
async function tapNode(page, matcher) {
  await page.evaluate((m) => {
    const svg = document.querySelector('.net-graph-zone svg');
    const g = [...svg.querySelectorAll('g[data-nt]')].find(n => (n.textContent ?? '').includes(m));
    if (!g) return;
    const r = g.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 7, pointerType: 'mouse', button: 0, isPrimary: true };
    g.dispatchEvent(new PointerEvent('pointerdown', opts));
    g.dispatchEvent(new PointerEvent('pointerup', opts));
  }, matcher);
}

const snap = (page) => page.evaluate(() => {
  const svg = document.querySelector('.net-graph-zone svg');
  const reds = [...svg?.querySelectorAll('[data-redline]') ?? []];
  const sectors = [...svg?.querySelectorAll('[data-sector]') ?? []].map(g => ({
    key: g.getAttribute('data-sector'), txt: (g.textContent ?? '').trim(),
  }));
  const orgNodes = [...svg?.querySelectorAll('g[data-nt="organization"]') ?? []].map(g => {
    const c = g.querySelector('circle');
    return { ego: g.getAttribute('data-ego'), cx: c ? +c.getAttribute('cx') : null, cy: c ? +c.getAttribute('cy') : null, txt: (g.textContent ?? '').slice(0, 40) };
  });
  return {
    svgTexts: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent ?? '') : [],
    redCount: reds.length,
    redCats: [...new Set(reds.map(r => r.getAttribute('data-redline')))],
    sectors,
    orgNodes,
    panel: !!document.querySelector('[data-tray-panel]'),
    breadcrumb: !!document.querySelector('[data-breadcrumb]'),
    egoCount: orgNodes.filter(n => n.ego === 'true').length,
  };
});

/* ═══════════ مستأجر پارس: صفحهٔ اول ═══════════ */
const pars = await login('pars', 'pars1234');
let d = await snap(pars);
const parsTexts = d.svgTexts.join(' | ');
ok('پارس — اگو (هلدینگ پارس) در مرکز', d.egoCount === 1 && parsTexts.includes('هلدینگ پارس'));
const centerNode = d.orgNodes.find(n => n.ego === 'true');
ok('پارس — اگو واقعاً نزدیک مرکز بوم', centerNode && Math.abs(centerNode.cx - 800) < 40 && Math.abs(centerNode.cy - 400) < 40, `(${centerNode?.cx},${centerNode?.cy})`);
const subs = d.orgNodes.filter(n => n.ego !== 'true' && n.cx > 900 && /پارس /.test(n.txt));
ok('پارس — زیرمجموعه‌ها سمت راست', subs.length >= 10, `n=${subs.length}`);
ok('پارس — سرستون «زیرمجموعه‌ها»', parsTexts.includes('زیرمجموعه‌ها'));
ok('پارس — خط‌های قرمز عموم‌ها', d.redCount === 67, `n=${d.redCount}`);
ok('پارس — چیپ دسته‌ها (۴ دسته)', d.sectors.length === 4, JSON.stringify(d.sectors.map(s => s.key)));
const inst = d.sectors.find(s => s.key === 'INSTITUTIONAL');
ok('پارس — شمار نهادی = ۲۶', !!inst && inst.txt.includes('۲۶'), inst?.txt);
ok('پارس — breadcrumb در صفحهٔ اول مخفی', !d.breadcrumb);
ok('پارس — پنل پیش‌فرض بسته', !d.panel);

/* پنل دسته: چیپ اقتصادی (۷ عضو) */
await pars.evaluate(() => {
  const g = document.querySelector('[data-sector="ECONOMIC"]');
  g?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 900));
let panelInfo = await pars.evaluate(() => {
  const p = document.querySelector('[data-tray-panel]');
  return { open: !!p, chips: p ? p.querySelectorAll('g[style]').length : 0, txt: (p?.textContent ?? '').slice(0, 120) };
});
ok('پارس — پنل دستهٔ اقتصادی باز شد', panelInfo.open && panelInfo.txt.includes('اقتصادی'));
ok('پارس — پنل ۷ عضو دارد', panelInfo.txt.includes('۷'), panelInfo.txt.slice(0, 60));
await pars.evaluate(() => {
  const p = document.querySelector('[data-tray-panel]');
  const close = [...(p?.querySelectorAll('g') ?? [])].find(g => (g.textContent ?? '').trim() === '✕');
  close?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 700));
d = await snap(pars);
ok('پارس — پنل بسته شد', !d.panel);

/* ═══════════ Drill-down: کلیک روی زیرمجموعه ═══════════ */
await tapNode(pars, 'پارس انرژی');
await new Promise(r => setTimeout(r, 1000));
d = await snap(pars);
const energyNode = d.orgNodes.find(n => n.txt.includes('پارس انرژی'));
ok('درill — تمرکز روی پارس انرژی (مرکز)', energyNode && Math.abs(energyNode.cx - 800) < 40 && Math.abs(energyNode.cy - 400) < 40, `(${energyNode?.cx},${energyNode?.cy})`);
ok('درill — breadcrumb ظاهر شد', d.breadcrumb);
const parentVisible = d.orgNodes.some(n => n.txt.includes('هلدینگ پارس') && n.cx < 700);
ok('درill — والد (هلدینگ پارس) سمت چپ', parentVisible);
ok('درill — خط قرمز فقط در صفحهٔ اول', d.redCount === 0, `n=${d.redCount}`);
/* بازگشت */
await pars.evaluate(() => {
  const bc = document.querySelector('[data-breadcrumb]');
  const back = [...(bc?.querySelectorAll('g') ?? [])].find(g => (g.textContent ?? '').includes('بازگشت'));
  back?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 900));
d = await snap(pars);
ok('بازگشت — صفحهٔ اول (اگو مرکز + ۶۷ خط قرمز)', d.egoCount === 1 && d.redCount === 67, `red=${d.redCount}`);
await pars.close();

/* ═══════════ مستأجر آرون: شرکت x مرکز + هلدینگ پارس به‌صورت گره ═══════════ */
const aroun = await login('aroun', '12356784');
d = await snap(aroun);
const aTexts = d.svgTexts.join(' | ');
ok('آرون — اگو (شرکت x) در مرکز', d.egoCount === 1 && aTexts.includes('شرکت x'));
const parsHub = d.orgNodes.find(n => n.txt.includes('هلدینگ پارس'));
ok('آرون — هلدینگ پارس به‌صورت گره (رابطهٔ مستقیم، چپ)', !!parsHub && parsHub.cx < 700, `(${parsHub?.cx},${parsHub?.cy})`);
ok('آرون — نشان ۱۲ زیرمجموعه روی هلدینگ پارس', aTexts.includes('۱۲ زیرمجموعه'));
ok('آرون — خط‌های قرمز عموم‌ها', d.redCount === 67, `n=${d.redCount}`);
/* درill داخل هلدینگ پارس: ۱۲ زیرمجموعه */
await tapNode(aroun, 'هلدینگ پارس');
await new Promise(r => setTimeout(r, 1000));
d = await snap(aroun);
const parsSubs = d.orgNodes.filter(n => n.cx > 900 && /پارس /.test(n.txt));
ok('آرون→پارس — ۱۲ زیرمجموعه سمت راست', parsSubs.length === 12, `n=${parsSubs.length}`);
ok('آرون→پارس — شرکت x (والد) سمت چپ', d.orgNodes.some(n => n.txt.includes('شرکت x') && n.cx < 700));
await aroun.close();

/* ═══════════ مستأجر دمو ═══════════ */
const demo = await login('demo', '123456', '123456');
d = await snap(demo);
const dmTexts = d.svgTexts.join(' | ');
ok('دمو — اگو (هلدینگ آریا) در مرکز', d.egoCount === 1 && dmTexts.includes('هلدینگ آریا'));
ok('دمو — آریا فناوری زیرمجموعه (راست)', d.orgNodes.some(n => n.txt.includes('آریا فناوری') && n.cx > 900));
ok('دمو — روابط مستقیم (چپ)', d.orgNodes.some(n => n.cx < 700 && n.ego !== 'true' && n.cx !== null));
ok('دمو — خط قرمز عموم‌ها', d.redCount > 0, `n=${d.redCount}`);

/* ═══════════ نمای کلاسیک ═══════════ */
await demo.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'کلاسیک');
  btn?.click();
});
await new Promise(r => setTimeout(r, 1500));
d = await snap(demo);
ok('کلاسیک — بدون خط قرمز', d.redCount === 0, `n=${d.redCount}`);
ok('کلاسیک — همهٔ سازمان‌ها (چند برابر)', d.orgNodes.length >= 10, `orgs=${d.orgNodes.length}`);
await demo.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'مرحله‌ای');
  btn?.click();
});
await new Promise(r => setTimeout(r, 1500));
d = await snap(demo);
ok('بازگشت به مرحله‌ای', d.redCount > 0 && d.egoCount === 1);
await demo.close();

await browser.close();
console.log(`\n_summary_ pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
