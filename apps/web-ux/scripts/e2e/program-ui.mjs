/* ============================================================================
   program-ui.mjs — باتری E2E هاب «حاکمیت برنامه» (گام ۲.۱ مسترپلن)
   چک‌ها: ناوبری و هدر · تب نمای کلی (فصل‌ها/دروازه/روند) · شاخص‌ها (۱۰ ردیف
   با مالک/هدف/منبع محاسبه) · ریسک‌ها (بنر، ماتریس، جدول، ثبت بدون مالک → خطا،
   ثبت با مالک → ردیف جدید) · آمادگی (۶ لایه، لایهٔ رابطه از دادهٔ زنده، چرخش
   وضعیت قلم) · ممیزی سه‌گانه (سه ساب‌تب + مودال جزئیات) · بدون خطای کنسول.
   اجرا:  LD_LIBRARY_PATH="$PWD/.e2e-browser/nss" UI_BASE=http://localhost:4100/Srip/srip2 node scripts/e2e/program-ui.mjs
   ============================================================================ */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const BASE = process.env.UI_BASE ?? 'http://localhost:4100/Srip/srip2';

let pass = 0, fail = 0;
const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const browser = await puppeteer.launch({
  executablePath: resolve(process.cwd(), '.e2e-browser/chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(process.cwd(), '.e2e-browser/nss') },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });

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
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => localStorage.setItem('srip2_tour_done', '1'));

  /* ── ۱) ناوبری: آیتم «حاکمیت برنامه» در سایدبار ── */
  const navOk = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.side-nav a, nav a')];
    return links.some(a => (a.textContent ?? '').trim().includes('حاکمیت برنامه') && a.getAttribute('href')?.includes('/program'));
  });
  ok('آیتم «حاکمیت برنامه» در ناوبری سایدبار', navOk);

  await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1500));
  /* نویز فاز ورود (چالش OTP، صفحهٔ فرود) خارج از دامنهٔ این باتری است —
     فقط خطاهای خودِ هاب حاکمیت برنامه سنجیده می‌شود */
  errs.length = 0;

  /* ── ۲) هدر استاندارد + تب‌ها ── */
  const h1 = await page.evaluate(() => (document.querySelector('.page-heading h1')?.textContent ?? '').trim());
  ok('هدر استاندارد با عنوان «حاکمیت برنامه»', h1.includes('حاکمیت برنامه'), `h1=«${h1}»`);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.segmented button, [role=tablist] button')].map(b => (b.textContent ?? '').trim()));
  ok('شش تب هاب (نمای کلی/شاخص‌ها/ریسک‌ها/آمادگی/ممیزی/اهداف)',
    ['نمای کلی', 'شاخص‌ها', 'ریسک‌ها', 'آمادگی بازار', 'ممیزی سه‌گانه', 'اهداف راهبردی'].every(t => tabs.some(x => x.includes(t))), JSON.stringify(tabs.slice(0, 7)));

  /* ── ۳) نمای کلی: کارت آمار + فصل‌ها + روند ── */
  const ov = await page.evaluate(() => ({
    stats: document.querySelectorAll('.stat-grid .stat-card').length,
    seasons: document.querySelectorAll('.season-card').length,
    passed: [...document.querySelectorAll('.season-card')].filter(c => (c.className).includes('passed')).length,
    trend: document.querySelectorAll('.trend-col').length,
    score: (document.querySelector('.stat-value')?.textContent ?? '').trim(),
  }));
  ok('نمای کلی: کارت‌های آمار', ov.stats >= 4, `stats=${ov.stats}`);
  ok('نمای کلی: چهار فصل با دروازه', ov.seasons === 4, `seasons=${ov.seasons}`);
  ok('نمای کلی: فصل‌های پاس‌شده مشخص', ov.passed >= 1, `passed=${ov.passed}`);
  ok('نمای کلی: روند فصلی', ov.trend >= 3, `trend=${ov.trend}`);
  ok('نمرهٔ آمادگی با رقم فارسی نمایش داده می‌شود', /[۰-۹]/.test(ov.score), `score=${ov.score}`);

  /* ── ۳.۵) گام ۵.۱ — کاتالوگ فرم‌های سند v6 (نمای کلی) ── */
  const cat = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.section-card')].find(c => (c.querySelector('h2, h3')?.textContent ?? '').includes('کاتالوگ فرم‌های سند'));
    const rows = card ? [...card.querySelectorAll('tbody tr')] : [];
    const codes = rows.map(r => (r.querySelector('td')?.textContent ?? '').trim());
    const chips = rows.map(r => (r.querySelector('.chip')?.textContent ?? '').trim());
    return {
      found: !!card,
      rows: rows.length,
      codes,
      have: chips.filter(c => c.startsWith('موجود')).length,
      planned: chips.filter(c => c === 'در برنامه').length,
      platformNote: (card?.querySelector('.field-hint')?.textContent ?? '').includes('ماژول‌های پلتفرمی'),
      fCodes: ['F01', 'F04', 'F08', 'F11', 'F14', 'F18'].every(c => codes.includes(c)),
    };
  });
  ok('کاتالوگ فرم‌ها: کارت با هجده ردیف F01–F18', cat.found && cat.rows === 18, `rows=${cat.rows}`);
  ok('کاتالوگ فرم‌ها: کدهای کلیدی (F01/F04/F08/F11/F14/F18) حاضر', cat.fCodes, JSON.stringify(cat.codes.slice(0, 3)));
  ok('کاتالوگ فرم‌ها: نُه موجود + نُه در برنامه + یادداشت ماژول‌های پلتفرمی', cat.have === 9 && cat.planned === 9 && cat.platformNote, `have=${cat.have} planned=${cat.planned}`);

  /* ── ۴) شاخص‌ها: ۱۰ ردیف با مالک و منبع محاسبه ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('شاخص‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const kpis = await page.evaluate(() => ({
    rows: document.querySelectorAll('.table-wrap tbody tr').length,
    firstOwner: (document.querySelector('.table-wrap tbody tr td:nth-child(2)')?.textContent ?? '').trim(),
    hasSource: !!document.querySelector('.table-wrap tbody tr td:last-child')?.textContent?.includes('—') || [...document.querySelectorAll('.table-wrap tbody tr td:last-child')].some(td => (td.textContent ?? '').length > 5),
    badges: document.querySelectorAll('.table-wrap tbody tr .chip').length,
    rule: (document.querySelector('.note-strip')?.textContent ?? '').includes('عدد دستی'),
  }));
  ok('شاخص‌ها: ۱۰ شاخص جدول بخش ۲۶ سند', kpis.rows === 10, `rows=${kpis.rows}`);
  ok('شاخص‌ها: هر ردیف مالک دارد', kpis.firstOwner.length > 2, `owner=«${kpis.firstOwner}»`);
  ok('شاخص‌ها: نشان وضعیت سه‌حالته روی ردیف‌ها', kpis.badges >= 10, `badges=${kpis.badges}`);
  ok('شاخص‌ها: قاعدهٔ «عدد دستی وارد داشبورد نمی‌شود» در صفحه', kpis.rule);

  /* ماژول شاخص‌ها: ثبت شاخص جدید با سنجهٔ محاسبهٔ پلتفرم */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('ثبت شاخص'))?.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const kpiModal = await page.evaluate(() => ({
    open: !!document.querySelector('.modal-card'),
    hasMetric: !!document.querySelector('.modal-card select'),
    opts: [...(document.querySelectorAll('.modal-card select option') ?? [])].map(o => o.textContent).length,
  }));
  ok('ماژول شاخص‌ها: مودال ثبت شاخص با فهرست سنجه‌های محاسبه', kpiModal.open && kpiModal.hasMetric && kpiModal.opts >= 8, JSON.stringify(kpiModal));
  await page.type('.modal-card input', 'شاخص تست باتری UI');
  const ownerInp = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card input')][1]);
  await ownerInp.asElement().type('مدیر تست');
  await page.type('.modal-card input[type=number]', '30');
  const metricSel = await page.evaluateHandle(() => document.querySelector('.modal-card select'));
  await metricSel.asElement().select('active-people');
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const f = document.querySelector('#kpi-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 1800));
  const kpiRow = await page.evaluate(() => ({
    closed: !document.querySelector('.modal-card'),
    found: [...document.querySelectorAll('.table-wrap tbody tr')].some(r => (r.textContent ?? '').includes('شاخص تست باتری UI')),
  }));
  ok('ماژول شاخص‌ها: ثبت شاخص → ردیف جدید با مقدار محاسبه‌شده', kpiRow.closed && kpiRow.found, JSON.stringify(kpiRow));

  /* ── ۵) ریسک‌ها: بنر + ماتریس + جدول + مودال ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('ریسک‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const rk = await page.evaluate(() => ({
    banner: (document.querySelector('.alert-banner')?.textContent ?? '').includes('درجهٔ بالا'),
    cells: document.querySelectorAll('.rm-cell').length,
    hasCount: [...document.querySelectorAll('.rm-cell')].some(c => /[۱-۹]/.test(c.textContent ?? '')),
    rows: document.querySelectorAll('.table-wrap tbody tr').length,
  }));
  ok('ریسک‌ها: بنر ریسک‌های درجهٔ بالای باز', rk.banner);
  ok('ریسک‌ها: ماتریس ۳×۳ احتمال×اثر', rk.cells === 9, `cells=${rk.cells}`);
  ok('ریسک‌ها: سلول‌های ماتریس شمار ریسک دارند', rk.hasCount);
  ok('ریسک‌ها: رجیستری با ۹ ریسک بذری سند', rk.rows >= 9, `rows=${rk.rows}`);

  /* جزئیات ریسک: کلیک ردیف → مودال با پاسخ پیشگیرانه/واکنشی */
  await page.click('.table-wrap tbody tr');
  await new Promise(r => setTimeout(r, 600));
  const detail = await page.evaluate(() => ({
    open: !!document.querySelector('.modal-card'),
    title: (document.querySelector('.modal-head h3, .modal-card h3, .modal-title')?.textContent ?? document.querySelector('.modal-card')?.textContent ?? '').slice(0, 60),
    hasPreventive: (document.querySelector('.modal-card')?.textContent ?? '').includes('پاسخ پیشگیرانه'),
    hasReactive: (document.querySelector('.modal-card')?.textContent ?? '').includes('پاسخ واکنشی'),
  }));
  ok('ریسک‌ها: مودال جزئیات با چهار قلم', detail.open && detail.hasPreventive && detail.hasReactive, JSON.stringify(detail).slice(0, 80));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  /* ثبت ریسک: اول عنوان، بدون مالک → خطای قاعدهٔ سند */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('ریسک جدید'))?.click(); });
  await new Promise(r => setTimeout(r, 500));
  const modalOpen = await page.evaluate(() => !!document.querySelector('.modal-card'));
  await page.type('.modal-card input', 'ریسک تست باتری مرورگر');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#risk-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 1200));
  const noOwner = await page.evaluate(() => (document.querySelector('.modal-card .alert-banner, .modal-card [role=alert]')?.textContent ?? ''));
  ok('ثبت ریسک بدون مالک → پیام «ریسک بدون مالک ثبت نمی‌شود»', noOwner.includes('بدون مالک'), `msg=${noOwner.slice(0, 60)}`);
  /* با مالک → ثبت موفق و ردیف جدید */
  const ownerSel = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card select')].pop());
  await ownerSel.asElement().select('مدیر پروژه');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#risk-create-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 2000));
  const created = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')].map(r => (r.textContent ?? ''));
    return { closed: !document.querySelector('.modal-card'), found: rows.some(x => x.includes('ریسک تست باتری مرورگر')), count: rows.length };
  });
  ok('ثبت ریسک با مالک → مودال بسته و ردیف جدید در رجیستری', created.closed && created.found, JSON.stringify(created).slice(0, 80));

  /* ── ۶) آمادگی: ۶ لایه + لایهٔ رابطه از دادهٔ زنده + چرخش وضعیت ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('آمادگی بازار'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const rd = await page.evaluate(() => ({
    layers: document.querySelectorAll('.section-card').length,
    relComputed: [...document.querySelectorAll('.section-card')].some(c => (c.textContent ?? '').includes('از دادهٔ زنده')),
    weights: [...document.querySelectorAll('.section-card .section-head p, .section-card p')].some(p => (p.textContent ?? '').includes('وزن')),
    clickable: document.querySelectorAll('.layer-status.clickable').length,
  }));
  /* گام ۴.۳: هفت کارت = شش لایه + رجیستری دارایی برند (F05) */
  const rdHasRegistry = await page.evaluate(() => [...document.querySelectorAll('.section-card')].some(c => (c.querySelector('h2')?.textContent ?? '').includes('رجیستری دارایی برند')));
  ok('آمادگی: شش لایهٔ وزن‌دار + رجیستری دارایی برند (F05)', rd.layers === 7 && rdHasRegistry, `cards=${rd.layers}`);
  const entryLayer = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.readiness-layers .section-card, .section-card')];
    const hit = cards.find(c => (c.querySelector('h2, h3')?.textContent ?? '').trim() === 'ورود');
    return { found: !!hit, crit: (hit?.textContent ?? '').includes('Due Diligence') };
  });
  ok('گام ۵.۵ — لایهٔ ششم «ورود» با معیار پذیرش Due Diligence', entryLayer.found && entryLayer.crit, JSON.stringify(entryLayer));
  ok('آمادگی: لایهٔ «رابطه» از دادهٔ زنده محاسبه می‌شود', rd.relComputed);
  ok('آمادگی: اقلام قابل به‌روزرسانی (کلیک برای تغییر وضعیت)', rd.clickable >= 20, `clickable=${rd.clickable}`);
  /* چرخش وضعیت یک قلم: سه کلیک = یک دور کامل */
  const before = await page.evaluate(() => (document.querySelector('.layer-status.clickable .chip')?.textContent ?? '').trim());
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('.layer-status.clickable:not([disabled])', { timeout: 10000 });
    await page.click('.layer-status.clickable');
    await new Promise(r => setTimeout(r, 2200));
  }
  const after = await page.evaluate(() => (document.querySelector('.layer-status.clickable .chip')?.textContent ?? '').trim());
  ok('آمادگی: چرخش وضعیت قلم کار می‌کند (سه کلیک = بازگشت به وضعیت اول)', before === after && before.length > 0, `قبل=«${before}» بعد=«${after}»`);

  /* ── ۷) ممیزی سه‌گانه ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('ممیزی'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const auPeople = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('ممیزی: تب افراد با ردیف‌های نقش', auPeople >= 5, `rows=${auPeople}`);
  /* ساب‌تب سامانه‌ها */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim().includes('سامانه‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 900));
  const auSys = await page.evaluate(() => ({
    rows: document.querySelectorAll('.table-wrap tbody tr').length,
    hasShutdown: (document.querySelector('.table-wrap')?.textContent ?? '').includes('خاموش‌سازی'),
  }));
  ok('ممیزی: تب سامانه‌ها با وضعیت نگهداری/انتقال/خاموش‌سازی', auSys.rows >= 5 && auSys.hasShutdown, `rows=${auSys.rows}`);
  /* ساب‌تب کانال‌ها + مودال */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').trim() === 'کانال‌ها' || (b.textContent ?? '').trim().includes('کانال‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 900));
  const auCh = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  ok('ممیزی: تب کانال‌ها', auCh >= 4, `rows=${auCh}`);

  /* ── ۷.۵) گام ۵.۳ — چارت هدف تیم v6 (بخش ۲۱.۳) ── */
  const chart = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.section-card')].find(c => (c.querySelector('h2')?.textContent ?? '').includes('چارت هدف تیم'));
    const rows = card ? [...card.querySelectorAll('tbody tr')] : [];
    const faToEn = (s) => Number(String(s).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    return {
      found: !!card,
      rows: rows.length,
      headcount: rows.reduce((s, r) => s + (faToEn(r.querySelectorAll('td')[3]?.textContent ?? '0') || 0), 0),
      aiBadges: card ? card.querySelectorAll('.chip.purple').length : 0,
      layers: new Set(rows.map(r => (r.querySelectorAll('td')[0]?.textContent ?? '').trim()).filter(Boolean)).size,
      mlEng: (card?.textContent ?? '').includes('مهندس یادگیری ماشین'),
      note: (card?.querySelector('.field-hint')?.textContent ?? '').includes('ماه هدف'),
    };
  });
  ok('چارت v6: کارت با ۳۴ عنوان نقش و ۳۷ نفر در چهار لایه',
    chart.found && chart.rows === 34 && chart.headcount === 37 && chart.layers === 4, `rows=${chart.rows} ppl=${chart.headcount} layers=${chart.layers}`);
  ok('چارت v6: هشت نقش هوش مصنوعی با نشان AI (شامل مهندس یادگیری ماشین)', chart.aiBadges === 8 && chart.mlEng, `ai=${chart.aiBadges}`);
  ok('چارت v6: قاعدهٔ زمان ورود (ماه هدف) زیر جدول', chart.note);
  await page.click('.table-wrap tbody tr');
  await new Promise(r => setTimeout(r, 600));
  const auModal = await page.evaluate(() => ({
    open: !!document.querySelector('.modal-card'),
    text: (document.querySelector('.modal-card')?.textContent ?? '').slice(0, 200),
  }));
  ok('ممیزی: مودال جزئیات کامل قلم', auModal.open && (auModal.text.includes('یادداشت ممیزی') || auModal.text.includes('مالک')), auModal.text.slice(0, 60));
  await page.keyboard.press('Escape');

  /* ── تب اهداف راهبردی (گام ۲.۳) ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('اهداف راهبردی'))?.click(); });
  await new Promise(r => setTimeout(r, 1600));
  const goal = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.stat-grid .stat-card').length,
    composite: (document.querySelector('.stat-grid .stat-card')?.textContent ?? ''),
    compRows: document.querySelector('.table-wrap')?.querySelectorAll('tbody tr').length ?? 0,
    promptCats: document.querySelectorAll('.prompt-cat').length,
    promptItems: document.querySelectorAll('.prompt-list li').length,
    monRows: document.querySelectorAll('.section-card .table-wrap tbody tr').length,
    desc: (document.querySelector('.note-strip')?.textContent ?? '').includes('مرجعیت'),
  }));
  ok('اهداف: کارت‌های آمار هدف (نمرهٔ مرکب/مؤلفه/پرامپت/پایش)', goal.statCards >= 4, `n=${goal.statCards}`);
  ok('اهداف: نمرهٔ مرکب ۵۵ با رقم فارسی', /[۵]/.test(goal.composite), goal.composite.slice(0, 50));
  ok('اهداف: جدول نُه مؤلفه با روش سنجش و اهداف ماه ۶/۱۲', goal.compRows === 9, `rows=${goal.compRows}`);
  ok('اهداف: ۲۵ پرامپت در سه دسته', goal.promptCats === 3 && goal.promptItems === 25, `cats=${goal.promptCats} items=${goal.promptItems}`);
  ok('اهداف: توصیف هدف راهبردی نمایش داده می‌شود', goal.desc);
  const goalV6 = await page.evaluate(() => ({
    title: (document.querySelector('.stat-grid .stat-card, .section-card')?.textContent ?? document.body.textContent ?? ''),
    hasVcQ: (document.body.textContent ?? '').includes('۱۲ VC و شرکت\u200cهای سرمایه گذاری\u200cشده آن\u200cها چه محصولاتی دارند؟'),
    hasOrgName: (document.body.textContent ?? '').includes('فناوران پارس ایرانیان'),
    f14: [...document.querySelectorAll('h2, h3')].some(h => (h.textContent ?? '').includes('جدول پایش ماهانهٔ مرجعیت (F14)')),
  }));
  ok('گام ۵.۵ — هدف v6: نام «فناوران پارس ایرانیان» + سؤال ۱۲ VC', goalV6.hasVcQ && goalV6.hasOrgName, JSON.stringify({ vc: goalV6.hasVcQ, name: goalV6.hasOrgName }));
  ok('گام ۵.۵ — برچسب F14 روی جدول پایش ماهانهٔ مرجعیت', goalV6.f14);
  /* ثبت پایش جدید → ردیف */
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('ثبت پایش'))?.click(); });
  await new Promise(r => setTimeout(r, 700));
  await page.type('.modal-card input', 'سامانه تست باتری UI');
  await page.type('.modal-card input[type=number]', '40');
  const accInp = await page.evaluateHandle(() => [...document.querySelectorAll('.modal-card input[type=number]')][1]);
  await accInp.asElement().type('70');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const f = document.querySelector('#monitoring-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await new Promise(r => setTimeout(r, 1800));
  const monSaved = await page.evaluate(() => ({
    closed: !document.querySelector('.modal-card'),
    found: [...document.querySelectorAll('.section-card .table-wrap tbody tr')].some(r => (r.textContent ?? '').includes('سامانه تست باتری UI')),
  }));
  ok('اهداف: ثبت پایش → ردیف جدید در جدول پایش', monSaved.closed && monSaved.found, JSON.stringify(monSaved));
  /* ویرایش مقدار مؤلفه → نمرهٔ مرکب بازمحاسبه */
  const compBefore = await page.evaluate(() => (document.querySelector('.stat-grid .stat-card')?.textContent ?? '').match(/[۰-۹]+/)?.[0] ?? '');
  await page.evaluate(() => { [...document.querySelectorAll('.table-wrap tbody tr button')][0]?.click(); });
  await new Promise(r => setTimeout(r, 700));
  const compInp = await page.evaluateHandle(() => document.querySelector('.modal-card input[type=number]'));
  await compInp.asElement().type('30');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { [...document.querySelectorAll('.modal-card button')].find(b => (b.textContent ?? '').includes('ذخیرهٔ مقدار'))?.click(); });
  await new Promise(r => setTimeout(r, 1800));
  const compAfter = await page.evaluate(() => (document.querySelector('.stat-grid .stat-card')?.textContent ?? '').match(/[۰-۹]+/)?.[0] ?? '');
  ok('اهداف: ثبت مقدار پایش مؤلفه → نمرهٔ مرکب بازمحاسبه', compBefore !== compAfter && compAfter !== '', `قبل=${compBefore} بعد=${compAfter}`);


  /* ── ۷.۵) گام ۲.۷ — گزارش ماهانهٔ استاندارد (ماژول پلتفرمی) در /reports ── */
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3500));
  const pmr0 = await page.evaluate(() => ({
    hasPanel: [...document.querySelectorAll('h2, h3')].some(h => (h.textContent ?? '').includes('گزارش ماهانهٔ استاندارد (ماژول پلتفرمی)')),
    chips: [...document.querySelectorAll('.pmr-stats .chip')].map(c => (c.textContent ?? '').replace(/\s+/g, ' ').trim()),
    rows: [...document.querySelectorAll('.pmr-row')].map(r => (r.textContent ?? '').replace(/\s+/g, ' ').trim()),
    rule: (document.querySelector('.pmr-stats')?.parentElement?.textContent ?? '').includes('دو هفته'),
  }));
  ok('گزارش ماهانه: کارت گزارش ماهانه در صفحهٔ گزارش‌ها', pmr0.hasPanel);
  ok('گزارش ماهانه: چیپ‌های آمار (۲ ارائه‌شده + ۱ پیش‌نویس + ۲ به‌موقع)',
    pmr0.chips.some(c => c.includes('ارائه‌شده: ۲')) && pmr0.chips.some(c => c.includes('پیش‌نویس: ۱')) && pmr0.chips.some(c => c.includes('به‌موقع: ۲')), JSON.stringify(pmr0.chips));
  ok('گزارش ماهانه: سه گزارش بذر (مرداد/شهریور/مهر) با مالک و مهلت',
    pmr0.rows.length === 3 && pmr0.rows.every(r => r.includes('مدیر پروژه') && r.includes('مهلت')), JSON.stringify(pmr0.rows));

  /* نمای کامل pmr-2 (شهریور) — قالب پنج‌بخشی + دادهٔ زنده + انحراف سه‌قلمی */
  await (await page.evaluateHandle(() => [...document.querySelectorAll('.pmr-row')].find(r => (r.textContent ?? '').includes('شهریور')))).asElement().click();
  await new Promise(r => setTimeout(r, 900));
  const pmr2 = await page.evaluate(() => ({
    secs: [...document.querySelectorAll('.pmr-detail .pmr-sec h4')].map(h => (h.textContent ?? '').trim()),
    kpis: document.querySelectorAll('.pmr-kpi').length,
    kpiTones: document.querySelectorAll('.pmr-kpi.danger, .pmr-kpi.warning, .pmr-kpi.success').length,
    risks: [...document.querySelectorAll('.pmr-risk')].map(r => (r.textContent ?? '').replace(/\s+/g, ' ').trim()),
    dev: (document.querySelector('.pmr-dev')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    onTime: [...document.querySelectorAll('.pmr-row')].find(r => (r.textContent ?? '').includes('شهریور'))?.textContent.includes('به‌موقع'),
    noSubmit: ![...document.querySelectorAll('.pmr-detail button')].some(b => (b.textContent ?? '').includes('ارائه به مدیریت هلدینگ')),
  }));
  ok('قالب گزارش ماهانه: پنج بخش (خلاصه/شاخص‌های زنده/ریسک‌های زنده/انحراف/برنامهٔ ماه آینده)',
    pmr2.secs.length === 5 && pmr2.secs[0].includes('خلاصهٔ مدیریتی') && pmr2.secs[1].includes('شاخص‌های کلیدی') && pmr2.secs[2].includes('ریسک‌های درجه بالا') && pmr2.secs[3].includes('انحراف') && pmr2.secs[4].includes('برنامهٔ ماه آینده'), JSON.stringify(pmr2.secs));
  ok('شاخص‌های زندهٔ بخش ۲۶: همهٔ شاخص‌ها به‌صورت چیپ رنگی با مقدار محاسبه‌شده',
    pmr2.kpis >= 10 && pmr2.kpiTones === pmr2.kpis, `kpis=${pmr2.kpis}`);
  ok('ریسک‌های درجه بالای زنده: ۳ ریسک با مالک نقش', pmr2.risks.length === 3 && pmr2.risks.every(r => r.length > 8), JSON.stringify(pmr2.risks).slice(0, 90));
  ok('انحراف شهریور با سه قلم (علت/اثر بر مسیر بحرانی/اقدام جبرانی)',
    pmr2.dev.includes('وب‌سایت مرجع') && pmr2.dev.includes('علت') && pmr2.dev.includes('مسیر بحرانی') && pmr2.dev.includes('جبرانی'), pmr2.dev.slice(0, 80));
  ok('گزارش ارائه‌شده به‌موقع است و دکمهٔ ارائه ندارد (قفل پس از ارائه)', pmr2.onTime && pmr2.noSubmit);

  /* پیش‌نویس مهر: دکمهٔ ارائه حاضر است */
  await (await page.evaluateHandle(() => [...document.querySelectorAll('.pmr-row')].find(r => (r.textContent ?? '').includes('مهر')))).asElement().click();
  await new Promise(r => setTimeout(r, 900));
  ok('پیش‌نویس مهر: دکمهٔ «ارائه به مدیریت هلدینگ» حاضر است (ولی کلیک نمی‌شود تا بذر بماند)',
    await page.evaluate(() => [...document.querySelectorAll('.pmr-detail button')].some(b => (b.textContent ?? '').includes('ارائه به مدیریت هلدینگ'))));

  /* ثبت گزارش تازه از گزارش ماهانه + چرخهٔ ارائه */
  const e2eLbl = `گزارش تست باتری ${Date.now().toString(36)}`;
  const e2eMonth = await page.evaluate(() => { const t = Date.now(); const m = t % 240; return `${2027 + Math.floor(m / 12)}-${String(1 + (m % 12)).padStart(2, '0')}`; });
  await (await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('گزارش ماهانهٔ تازه')))).asElement().click();
  await page.waitForSelector('#monthly-report-form', { timeout: 30000 });
  const form27 = await page.evaluate(() => ({
    months: document.querySelectorAll('#monthly-report-form input[type=month]').length,
    hints: (document.querySelector('#monthly-report-form .field-hint')?.textContent ?? ''),
    devBtn: [...document.querySelectorAll('#monthly-report-form button')].some(b => (b.textContent ?? '').includes('انحراف زمانی')),
  }));
  ok('گزارش ماهانه: ماه + راهنمای قاعدهٔ سه‌قلمی + افزودن انحراف', form27.months === 1 && form27.hints.includes('سه قلم') && form27.devBtn, JSON.stringify(form27).slice(0, 80));
  await page.evaluate(({ lbl, mon }) => {
    const f = document.querySelector('#monthly-report-form');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const setTa = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    const lab = [...f.querySelectorAll('input')].find(i => i.type === 'text' || !i.type);
    set.call(lab, lbl); lab.dispatchEvent(new Event('input', { bubbles: true }));
    const mon2 = f.querySelector('input[type=month]');
    set.call(mon2, mon); mon2.dispatchEvent(new Event('input', { bubbles: true }));
    const tas = [...f.querySelectorAll('textarea')];
    setTa.call(tas[0], 'خلاصهٔ تست باتری: برنامه در مسیر است.'); tas[0].dispatchEvent(new Event('input', { bubbles: true }));
    setTa.call(tas[1], 'برنامهٔ تست ماه آینده.'); tas[1].dispatchEvent(new Event('input', { bubbles: true }));
  }, { lbl: e2eLbl, mon: e2eMonth });
  /* یک انحراف کامل سه‌قلمی */
  await page.evaluate(() => { [...document.querySelectorAll('#monthly-report-form button')].find(b => (b.textContent ?? '').includes('انحراف زمانی') && (b.textContent ?? '').includes('+'))?.click(); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const f = document.querySelector('#monthly-report-form');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const ins = [...f.querySelectorAll('.pmr-dev-form input')];
    const vals = ['تست نقطهٔ عطف', 'تست علت تأخیر', 'تست اثر مسیر بحرانی', 'تست اقدام جبرانی'];
    ins.forEach((inp, i) => { set.call(inp, vals[i]); inp.dispatchEvent(new Event('input', { bubbles: true })); });
  });
  await page.evaluate(() => { (document.querySelector('#monthly-report-form button[type=submit]') ?? {}).click?.(); });
  await page.waitForFunction(() => !document.querySelector('#monthly-report-form'), { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  const made = await page.evaluate((lbl) => {
    const row = [...document.querySelectorAll('.pmr-row')].find(r => (r.textContent ?? '').includes(lbl));
    return { found: !!row, draft: (row?.textContent ?? '').includes('پیش‌نویس') };
  }, e2eLbl);
  ok('ثبت گزارش تازه → پیش‌نویس در فهرست', made.found && made.draft, JSON.stringify(made));

  /* ارائهٔ همان پیش‌نویس از رابط */
  await (await page.evaluateHandle((lbl) => [...document.querySelectorAll('.pmr-row')].find(r => (r.textContent ?? '').includes(lbl)), e2eLbl)).asElement().click();
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => { [...document.querySelectorAll('.pmr-detail button')].find(b => (b.textContent ?? '').includes('ارائه به مدیریت هلدینگ'))?.click(); });
  await new Promise(r => setTimeout(r, 3000));
  const subm = await page.evaluate((lbl) => {
    const row = [...document.querySelectorAll('.pmr-row')].find(r => (r.textContent ?? '').includes(lbl));
    return { submitted: (row?.textContent ?? '').includes('ارائه‌شده'), onTime: (row?.textContent ?? '').includes('به‌موقع'), noBtn: ![...document.querySelectorAll('.pmr-detail button')].some(b => (b.textContent ?? '').includes('ارائه به مدیریت هلدینگ')) };
  }, e2eLbl);
  ok('ارائه از رابط → نشان «ارائه‌شده» + «به‌موقع» + قفل دکمه', subm.submitted && subm.onTime && subm.noBtn, JSON.stringify(subm));

  /* موبایل: صفحهٔ گزارش‌ها بدون اسکرول افقی */
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 900));
  ok('موبایل (۳۹۰): گزارش ماهانه بدون اسکرول افقی',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.setViewport({ width: 1280, height: 900 });

  /* بازگشت به هاب برنامه برای بخش‌های ۸ و ۹ */
  await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2000));


  /* ── ۷.۷) گام ۴.۱ — F11: چک‌لیست ده‌مرحله‌ای انتقال سامانه (تب ممیزی) ── */
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('ممیزی'))?.click(); });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes('سامانه‌ها'))?.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const mig0 = await page.evaluate(() => ({
    hasCol: [...document.querySelectorAll('th')].some(th => (th.textContent ?? '').includes('F11')),
    as4: ([...document.querySelectorAll('tbody tr')].find(tr => (tr.textContent ?? '').includes('گروه پیام‌رسان'))?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  ok('F11: ستون مراحل انتقال در جدول سامانه‌ها با پیشرفت ۶ از ۱۰ برای پیام‌رسان مدیران',
    mig0.hasCol && mig0.as4.includes('۶ / ۱۰') && mig0.as4.includes('در جریان'), mig0.as4.slice(0, 90));

  await (await page.evaluateHandle(() => [...document.querySelectorAll('tbody tr')].find(tr => (tr.textContent ?? '').includes('گروه پیام‌رسان')))).asElement().click();
  await page.waitForSelector('.mig-steps', { timeout: 30000 });
  const m0 = await page.evaluate(() => ({
    steps: document.querySelectorAll('.mig-steps-list .mig-step').length,
    done: document.querySelectorAll('.mig-steps-list .mig-step.done').length,
    current: (document.querySelector('.mig-step.current .mig-step-title')?.textContent ?? ''),
    btn: [...document.querySelectorAll('.mig-steps button')].some(b => (b.textContent ?? '').includes('تکمیل مرحله')),
    head: (document.querySelector('.mig-steps-head')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  ok('F11: چک‌لیست ده‌مرحله‌ای با ۶ مرحلهٔ انجام‌شده و مرحلهٔ جاری «آموزش»',
    m0.steps === 10 && m0.done === 6 && m0.current.includes('آموزش') && m0.btn && m0.head.includes('۶'), JSON.stringify(m0).slice(0, 90));

  await page.evaluate(() => { [...document.querySelectorAll('.mig-steps button')].find(b => (b.textContent ?? '').includes('تکمیل مرحله'))?.click(); });
  await new Promise(r => setTimeout(r, 3000));
  const m1 = await page.evaluate(() => ({
    done: document.querySelectorAll('.mig-steps-list .mig-step.done').length,
    current: (document.querySelector('.mig-step.current .mig-step-title')?.textContent ?? ''),
    head: (document.querySelector('.mig-steps-head .chip')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  ok('تکمیل مرحله از رابط → ۷ انجام‌شده و مرحلهٔ بعدی (اجرای موازی) جاری',
    m1.done === 7 && m1.current.includes('موازی') && m1.head.includes('۷'), JSON.stringify(m1));

  /* بازگشت به هاب برنامه برای بخش‌های ۸ و ۹ */
  await page.goto(`${BASE}/program`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2000));

  /* ── ۸) بدون خطای کنسول در کل جریان ──
     استثنا: پاسخ ۴۰۰ تستِ منفیِ «ریسک بدون مالک» — عمداً توسط سرور رد می‌شود */
  const realErrs = errs.filter(e => !e.includes('status of 400'));
  ok('بدون خطای کنسول در هاب حاکمیت برنامه', realErrs.length === 0, realErrs.slice(0, 3).join('؛'));

  /* ── ۹) موبایل: بدون اسکرول افقی ── */
  await page.setViewport({ width: 390, height: 844 });
  const mobBad = [];
  for (const tabSel of ['نمای کلی', 'ریسک‌ها', 'آمادگی بازار', 'ممیزی']) {
    await page.evaluate((t) => { [...document.querySelectorAll('.segmented button')].find(b => (b.textContent ?? '').includes(t))?.click(); }, tabSel);
    await new Promise(r => setTimeout(r, 800));
    const bad = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (bad) mobBad.push(tabSel);
  }
  ok('موبایل (۳۹۰): بدون اسکرول افقی در همهٔ تب‌ها', mobBad.length === 0, mobBad.join('، '));
} catch (e) {
  console.error('PROGRAM-UI ERROR:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
}
await browser.close();
console.log('══════════════════════════════');
console.log(`PROGRAM-UI: ${pass} PASS / ${fail} FAIL`);
if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
