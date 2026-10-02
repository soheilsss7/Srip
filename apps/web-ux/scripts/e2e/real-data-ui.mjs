/* ============================================================================
   real-data-ui.mjs — E2E دادهٔ اولیهٔ واقعی (سند عموم‌ها)
   ورود aroun (مالک سامانه، بدون MFA) → شرکت x → نقشهٔ عموم‌های هلدینگ پارس
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
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();

try {
  // 1) صفحهٔ لاگین: دکمه‌های دمو حذف شده‌اند + ورود واقعی aroun (بدون MFA)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  ok('دکمه‌های دمو حذف شده‌اند', await page.evaluate(() => document.querySelectorAll('.auth-demo-row').length === 0));
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', 'aroun');
  await page.type('#login-pass', '12356784');
  await page.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await page.click('.auth-form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('ورود aroun → پیشخوان', await page.evaluate(() => !location.pathname.endsWith('/login') && !!sessionStorage.getItem('srip_access_token')), 'url=' + page.url());

  // 2) سازمان‌ها: شرکت x و هلدینگ پارس و نهادهای سند
  await page.goto(`${BASE}/organizations`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  const bodyTxt = await page.evaluate(() => document.body.textContent ?? '');
  ok('لیست سازمان‌ها: شرکت x', bodyTxt.includes('شرکت x'));
  ok('لیست سازمان‌ها: هلدینگ پارس', bodyTxt.includes('هلدینگ پارس'));
  ok('لیست سازمان‌ها: پارس انرژی (زیرمجموعه)', bodyTxt.includes('پارس انرژی'));
  ok('جداسازی مستأجر: دنیای دمو (هلدینگ آریا) دیده نمی‌شود', !bodyTxt.includes('هلدینگ آریا') && !bodyTxt.includes('آریا فناوری'));

  /* انواع سازمان از نظر نقش ارتباطی — دادهٔ واقعی درست تایپ شده باشد */
  const typeInfo = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('.chip, .badge, tbody tr td')].map(x => (x.textContent ?? '').trim()),
    options: [...document.querySelectorAll('select option')].map(o => (o.textContent ?? '').trim()),
  }));
  const allTxt = typeInfo.chips.join(' | ');
  ok('نوع سازمان: فیلتر نقش‌محور کامل (شریک راهبردی/رقیب/دانشگاه و پژوهش/اتاق و انجمن صنفی)', ['شریک راهبردی', 'رقیب', 'دانشگاه و پژوهش', 'اتاق و انجمن صنفی'].every(l => typeInfo.options.includes(l) || allTxt.includes(l)));
  ok('نوع سازمان: «دانشگاه و پژوهش» روی دانشگاه‌ها (نه دولتی)', allTxt.includes('دانشگاه و پژوهش'));
  ok('نوع سازمان: «اتاق و انجمن صنفی» روی اتاق/انجمن‌ها (نه شریک)', allTxt.includes('اتاق و انجمن صنفی'));
  ok('نوع سازمان: «اکوسیستم فناوری و صنعت» روی شرکت‌های اکوسیستم', allTxt.includes('اکوسیستم فناوری و صنعت'));
  const orgHtml = await page.evaluate(() => document.body.innerHTML);
  ok('نوع سازمان: برچسب‌های قدیمی غلط حذف شدند (شریکِ تنها/دولتیِ دانشگاه)', !/>(?:شریک|دولتی)</.test(orgHtml));

  // 3) عموم‌ها: انتخاب هلدینگ پارس → نقشهٔ واقعی سند
  await page.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  // انتخاب سازمان پارس از منوی سازمان
  const switched = await page.evaluate(() => {
    const sel = document.querySelector('select[aria-label="سازمان"]');
    if (!sel) return false;
    const opt = [...sel.options].find(o => (o.textContent ?? '').includes('هلدینگ پارس'));
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  ok('انتخاب «هلدینگ پارس» در انتخابگر سازمان', switched);
  await new Promise(r => setTimeout(r, 3000));
  const pubTxt = await page.evaluate(() => document.body.textContent ?? '');
  ok('هدف: «مرجعیت هوش مصنوعی کشور»', await page.evaluate(() => {
    const sum = document.querySelector('[data-self-summary]');
    return !!sum && (sum.textContent ?? '').includes('مرجعیت هوش مصنوعی کشور');
  }));
  ok('قالب: هلدینگ و سرمایه‌گذاری چندبخشی', pubTxt.includes('هلدینگ و سرمایه‌گذاری چندبخشی'));
  ok('۶ دستهٔ عموم در جدول', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
    return rows.length === 6 || document.body.textContent.includes('اکوسیستم فناوری و صنعت');
  }));

  // 4) تب اعضا: نهادهای واقعی سند
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('اعضا'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  const memTxt = await page.evaluate(() => document.body.textContent ?? '');
  ok('عضو واقعی: شورای ملی راهبری هوش مصنوعی', memTxt.includes('شورای ملی راهبری هوش مصنوعی'));
  ok('عضو واقعی: دانشگاه صنعتی شریف', memTxt.includes('دانشگاه صنعتی شریف'));
  ok('عضو واقعی: دیجی‌کالا', memTxt.includes('دیجی‌کالا'));
  ok('عضو واقعی: زومیت (رسانه)', memTxt.includes('زومیت'));

  // 5) شبکه: گراف شامل پارس + نهادها + یال‌های ساختاری
  await page.goto(`${BASE}/network`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 5000));
  /* گراف بازسازی‌شده: نمای پیش‌فرض فقط ساختار واقعی؛ عموم‌های سند در دسته‌های جمع‌شده */
  const netInfo = await page.evaluate(() => {
    const svg = document.querySelector('.net-graph-zone svg');
    const labels = svg ? [...svg.querySelectorAll('text')].map(t => t.textContent ?? '') : [];
    const all = labels.join(' | ');
    return {
      hasPars: all.includes('هلدینگ پارس'),
      hasEgoX: all.includes('شرکت x'),
      nodes: svg ? svg.querySelectorAll('g[data-node]').length : 0,
      stacks: svg ? svg.querySelectorAll('g[data-stack]').length : 0,
      orphanToggle: document.querySelector('.net-orphan-toggle')?.textContent ?? '',
    };
  });
  ok('گراف شبکه: هلدینگ پارس حاضر است', netInfo.hasPars);
  ok('گراف شبکه: خودِ شرکت (شرکت x) در مرکز', netInfo.hasEgoX);
  ok('گراف شبکه: نمای تمیز — ۱۴ گره (نه ۸۱ حباب پراکنده)', netInfo.nodes === 14, 'n=' + netInfo.nodes);
  ok('گراف شبکه: شمار «۶۷ سازمان بدون رابطه» پیشنهاد نمایش', netInfo.orphanToggle.includes('۶۷'), netInfo.orphanToggle.trim());
  await page.evaluate(() => { [...document.querySelectorAll('.net-graph-toolbar .net-btn')].find(b => (b.textContent ?? '').includes('نهادهای بدون رابطه'))?.click(); });
  await new Promise(r => setTimeout(r, 2200));
  const stacksInfo = await page.evaluate(() => [...document.querySelectorAll('g[data-stack]')].map(g => (g.textContent ?? '').trim()));
  ok('گراف شبکه: دسته‌های جمع‌شدهٔ عموم (۴ دسته)', stacksInfo.length === 4 && stacksInfo.some(x => x.includes('نهادی')) && stacksInfo.some(x => x.includes('رسانه') || x.includes('اکوسیستم')), JSON.stringify(stacksInfo));
  /* نهادهای عموم سند: باز کردن دستهٔ «نهادی» → نام نهادها با برچسب */
  await page.evaluate(() => document.querySelector('g[data-stack="INSTITUTIONAL"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await new Promise(r => setTimeout(r, 1600));
  const panelTxt = await page.evaluate(() => [...document.querySelectorAll('g[data-node]')].map(g => g.textContent ?? '').join(' | '));
  ok('گراف شبکه: نهادهای عموم سند (اعضای دستهٔ نهادی)', panelTxt.includes('شورای ملی') || panelTxt.includes('وزارت') || panelTxt.includes('معاونت'), panelTxt.slice(0, 50));
  /* رنگ‌بندی دسته‌های عموم روی نهادهای سند (pubCatOfOrg از sourceId) */
  const colored = await page.evaluate(() => {
    const raw = document.querySelector('[data-categorized-count]')?.textContent ?? '0';
    const faNum = (v) => Number(String(v).replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    return faNum(raw);
  });
  ok('گراف شبکه: نهادها بر اساس دستهٔ عموم رنگ گرفته‌اند (۴۰+)', colored >= 40, 'colored=' + colored);
  /* ═══ سناریوی ۲: حساب واقعی مشتری — مدیرعامل هلدینگ پارس (فقط محیط پارس) ═══ */
  const page2 = await browser.newPage(); /* تب جدید = نشست جدا */
  await page2.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page2.waitForSelector('#login-email', { timeout: 30000 });
  await page2.type('#login-email', 'pars');
  await page2.type('#login-pass', 'pars1234');
  await page2.waitForSelector('.auth-form button[type=submit]:not([disabled])', { timeout: 30000 });
  await page2.click('.auth-form button[type=submit]');
  await page2.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  ok('ورود pars (مشتری) → پیشخوان', await page2.evaluate(() => !location.pathname.endsWith('/login') && !!sessionStorage.getItem('srip_access_token')), 'url=' + page2.url());

  /* واژهٔ درست «آهنگ ارتباط» جای «کیدنس» — صفحهٔ روابط مشتری پارس */
  await page2.goto(`${BASE}/relationships`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3500));
  const relTxt = await page2.evaluate(() => document.body.textContent ?? '');
  ok('واژه‌ها: «آهنگ ارتباط» به‌جای «کیدنس»', relTxt.includes('آهنگ ارتباط') && !relTxt.includes('کیدنس'));

  await page2.goto(`${BASE}/organizations`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  const pTxt = await page2.evaluate(() => document.body.textContent ?? '');
  ok('مشتری پارس: هلدینگ پارس + نهادهای سند', pTxt.includes('هلدینگ پارس') && pTxt.includes('پارس انرژی') && pTxt.includes('شورای ملی راهبری'));
  ok('مشتری پارس: شرکت x دیده نمی‌شود', !pTxt.includes('شرکت x'));
  ok('مشتری پارس: دنیای دمو (آریا) دیده نمی‌شود', !pTxt.includes('هلدینگ آریا') && !pTxt.includes('آریا فناوری'));

  await page2.goto(`${BASE}/publics`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3000));
  ok('مشتری پارس: نقشهٔ عموم‌های خودش (هدف «مرجعیت هوش مصنوعی کشور»)', await page2.evaluate(() => {
    const sum = document.querySelector('[data-self-summary]');
    return !!sum && (sum.textContent ?? '').includes('مرجعیت هوش مصنوعی کشور');
  }));

  /* ═══ گام ۲.۵ — پروندهٔ شناخت ۳۱بخشی در پروفایل سازمان (بخش ۶/۷ سند؛ فرم ۲ و ۳) ═══ */
  await page2.goto(`${BASE}/organizations/org-pars`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3500));
  const knl = await page2.evaluate(() => {
    const rows = [...document.querySelectorAll('.knl-table tbody tr')];
    return {
      hasCard: !!document.querySelector('.knl-steps') && [...document.querySelectorAll('h2')].some(h => (h.textContent ?? '').includes('پروندهٔ شناخت')),
      steps: document.querySelectorAll('.knl-step').length,
      currentStep: (document.querySelector('.knl-step.current')?.textContent ?? '').trim(),
      groups: document.querySelectorAll('.knl-table .knl-group').length,
      sections: rows.filter(r => !r.classList.contains('knl-group')).length,
      validRows: document.querySelectorAll('.knl-table tr.knl-valid').length,
      invalidRows: document.querySelectorAll('.knl-table tr.knl-invalid').length,
      heads: [...document.querySelectorAll('.knl-table thead th')].map(th => (th.textContent ?? '').trim()),
      reviewBtn: [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('ثبت بازبینی (۹۰ روز)')),
    };
  });
  ok('پروندهٔ شناخت: کارت ۳۱بخشی در پروفایل سازمان', knl.hasCard);
  ok('روش شناخت هفت‌مرحله‌ای؛ مرحلهٔ جاری = تحلیل', knl.steps === 7 && knl.currentStep.includes('تحلیل'), knl.currentStep);
  ok('۳۱ بخش استاندارد در ۵ گروه', knl.sections === 31 && knl.groups === 5, `sec=${knl.sections} grp=${knl.groups}`);
  ok('هر دو وضعیت معتبر/نامعتبر دیده می‌شود', knl.validRows >= 10 && knl.invalidRows >= 1, `valid=${knl.validRows} invalid=${knl.invalidRows}`);
  ok('ستون‌های جدا: داده خام / برداشت تحلیلی / منبع / تاریخ', ['داده خام', 'برداشت تحلیلی', 'منبع', 'تاریخ منبع'].every(h => knl.heads.includes(h)));
  ok('دکمهٔ «ثبت بازبینی (۹۰ روز)» حاضر است', knl.reviewBtn);

  /* مودال ثبت بخش (فرم ۲/۳): بدون منبع → نامعتبر؛ با منبع → معتبر */
  const pencil = await page2.evaluateHandle(() => [...document.querySelectorAll('.knl-table tr.knl-invalid button')][0]);
  await pencil.asElement().click();
  await page2.waitForSelector('#knowledge-form', { timeout: 30000 });
  const modalInfo = await page2.evaluate(() => ({
    areas: document.querySelectorAll('#knowledge-form textarea').length,
    src: [...document.querySelectorAll('#knowledge-form input')].filter(i => i.type !== 'date').length,
    date: !!document.querySelector('#knowledge-form input[type=date]'),
  }));
  ok('مودال ثبت بخش: دو ستون جدا (داده/برداشت) + منبع + تاریخ', modalInfo.areas === 2 && modalInfo.src === 1 && modalInfo.date);
  const dataArea = await page2.evaluateHandle(() => document.querySelectorAll('#knowledge-form textarea')[0]);
  await dataArea.asElement().type(' — تکمیل باتری E2E بدون منبع');
  await page2.evaluate(() => { (document.querySelector('#knowledge-form button[type=submit]') ?? {}).click?.(); });
  await page2.waitForFunction(() => !document.querySelector('#knowledge-form'), { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const afterNoSrc = await page2.evaluate(() => ({
    valid: document.querySelectorAll('.knl-table tr.knl-valid').length,
    invalid: document.querySelectorAll('.knl-table tr.knl-invalid').length,
  }));
  ok('ذخیرهٔ بخش بدون منبع → صریحاً «نامعتبر» می‌ماند', afterNoSrc.valid === knl.validRows && afterNoSrc.invalid === knl.invalidRows,
    `valid=${afterNoSrc.valid}`);

  const pencil2 = await page2.evaluateHandle(() => [...document.querySelectorAll('.knl-table tr.knl-invalid button')][0]);
  await pencil2.asElement().click();
  await page2.waitForSelector('#knowledge-form', { timeout: 30000 });
  const srcInput = await page2.evaluateHandle(() => [...document.querySelectorAll('#knowledge-form input')].filter(i => i.type !== 'date')[0]);
  await srcInput.asElement().type('مصاحبهٔ باتری E2E');
  await page2.evaluate(() => { (document.querySelector('#knowledge-form button[type=submit]') ?? {}).click?.(); });
  await page2.waitForFunction(() => !document.querySelector('#knowledge-form'), { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  const afterSrc = await page2.evaluate(() => ({
    valid: document.querySelectorAll('.knl-table tr.knl-valid').length,
    invalid: document.querySelectorAll('.knl-table tr.knl-invalid').length,
  }));
  ok('افزودن منبع → همان بخش «معتبر» می‌شود', afterSrc.valid === knl.validRows + 1 && afterSrc.invalid === knl.invalidRows - 1,
    `valid=${afterSrc.valid}/${knl.validRows}`);

  const revBtn = await page2.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('ثبت بازبینی')));
  await revBtn.asElement().click();
  await new Promise(r => setTimeout(r, 2500));
  const revTxt = await page2.evaluate(() => document.body.textContent ?? '');
  ok('ثبت بازبینی → اعتبار ۹۰ روزهٔ تازه', revTxt.includes('۹۰ روز مانده تا بازبینی'));

  /* ═══ گام ۲.۶ — رویدادها در تقویم + پروتکل بحران (بخش ۱۷ سند؛ فرم ۱۰ و ۱۱.۵) ═══ */
  await page2.goto(`${BASE}/calendar`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3500));
  const cal = await page2.evaluate(() => ({
    h1: (document.querySelector('.page-heading h1')?.textContent ?? '').trim(),
    legend: document.querySelectorAll('.cal-legend span').length,
    upcomingEvents: [...document.querySelectorAll('.list')].some(l => (l.textContent ?? '').includes('میزگرد داده و سیاست عمومی')),
    evRows: [...document.querySelectorAll('.ev-row')].length,
    crisisH2: [...document.querySelectorAll('h2')].some(h => (h.textContent ?? '').includes('پروتکل ارتباط بحران')),
    spokesperson: (document.querySelector('.crisis-roles')?.textContent ?? ''),
    goldenChips: [...document.querySelectorAll('.crisis-badges .srip-badge')].map(b => (b.textContent ?? '').trim()),
    activeCrisis: !!document.querySelector('.crisis-live'),
    newEventBtn: [...document.querySelectorAll('button')].some(b => (b.textContent ?? '').includes('رویداد جدید')),
  }));
  ok('تقویم: عنوان «تقویم جلسات و رویدادها»', cal.h1.includes('رویدادها'), cal.h1);
  ok('تقویم: راهنمای دو مسیر رویداد (مالکیت/حضور)', cal.legend >= 2);
  ok('تقویم: رویدادهای پیشِ رو با میزگرد بذر سند', cal.upcomingEvents && cal.evRows >= 4, `rows=${cal.evRows}`);
  ok('پروتکل بحران: سخنگو + جانشین + طلایی', cal.crisisH2 && cal.spokesperson.includes('مدیر روابط عمومی') && cal.spokesperson.includes('مدیرعامل') && cal.spokesperson.includes('۲'));
  ok('بحران‌ها: هر دو حالت واکنش (طلایی/دیرتر)', cal.goldenChips.some(c => c.includes('طلایی') && !c.includes('دیرتر')) && cal.goldenChips.some(c => c.includes('دیرتر از طلایی')), JSON.stringify(cal.goldenChips));
  ok('بحران فعال: هشدار در جریان', cal.activeCrisis);
  ok('دکمهٔ «رویداد جدید» (فرم ۱۰) حاضر است', cal.newEventBtn);

  /* ثبت رویداد تازه از فرم ۱۰ → فهرست + چک‌لیست هفت‌مرحله‌ای */
  const evTitle = `رویداد تست باتری ${Date.now().toString(36)}`;
  const newBtn = await page2.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('رویداد جدید')));
  await newBtn.asElement().click();
  await page2.waitForSelector('#event-form', { timeout: 30000 });
  const formInfo = await page2.evaluate(() => ({
    pathOpts: document.querySelectorAll('#event-form select')[0]?.options.length ?? 0,
    kindOpts: document.querySelectorAll('#event-form select')[1]?.options.length ?? 0,
    hint: (document.querySelector('#event-form .field-hint')?.textContent ?? ''),
  }));
  ok('فرم ۱۰: دو مسیر + انواع استاندارد + الزام', formInfo.pathOpts === 2 && formInfo.kindOpts >= 3, JSON.stringify(formInfo));
  const titleInp = await page2.evaluateHandle(() => [...document.querySelectorAll('#event-form input')].filter(i => i.type === 'text' || !i.type)[0]);
  await titleInp.asElement().type(evTitle);
  await page2.evaluate(() => {
    const f = document.querySelector('#event-form');
    const dt = [...f.querySelectorAll('input[type=datetime-local]')][0];
    const d = new Date(Date.now() + 75 * 86400000);
    const pad = (n) => String(n).padStart(2, '0');
    const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
    /* دور زدن value-tracker ری‌اکت با ستتر بومی */
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(dt, v);
    dt.dispatchEvent(new Event('input', { bubbles: true }));
    dt.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const ownerInp = await page2.evaluateHandle(() => [...document.querySelectorAll('#event-form input')].filter(i => i.type === 'text' || !i.type)[1]);
  await ownerInp.asElement().type('مدیر رویداد');
  await page2.evaluate(() => { (document.querySelector('#event-form button[type=submit]') ?? {}).click?.(); });
  await page2.waitForFunction(() => !document.querySelector('#event-form'), { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  const created = await page2.evaluate((ttl) => ({
    inList: [...document.querySelectorAll('.ev-row')].some(r => (r.textContent ?? '').includes(ttl)),
    badge: [...document.querySelectorAll('.ev-row')].find(r => (r.textContent ?? '').includes(ttl))?.querySelector('.ev-steps-badge')?.textContent ?? '',
  }), evTitle);
  ok('ثبت رویداد → در «رویدادهای پیشِ رو» با ۱/۷', created.inList && created.badge.includes('۱'), `badge=${created.badge.trim()}`);

  const rowBtn = await page2.evaluateHandle((ttl) => [...document.querySelectorAll('.ev-row')].find(r => (r.textContent ?? '').includes(ttl)), evTitle);
  await rowBtn.asElement().click();
  await page2.waitForSelector('.ev-checklist', { timeout: 30000 });
  const chk = await page2.evaluate(() => ({
    steps: document.querySelectorAll('.ev-steps-list .ev-step').length,
    done: document.querySelectorAll('.ev-steps-list .ev-step.done').length,
    current: (document.querySelector('.ev-steps-list .ev-step.current b')?.textContent ?? ''),
    btns: [...document.querySelectorAll('.ev-checklist button')].some(b => (b.textContent ?? '').includes('تکمیل مرحله')),
    dues: [...document.querySelectorAll('.ev-step small')].every(s => s.textContent.includes('موعد')),
  }));
  ok('چک‌لیست هفت‌مرحله‌ای: ۷ مرحله با موعد، مرحلهٔ ۱ انجام‌شده', chk.steps === 7 && chk.done === 1 && chk.current.includes('تصمیم') && chk.dues, `steps=${chk.steps} done=${chk.done}`);
  ok('دکمهٔ «تکمیل مرحله» روی مرحلهٔ جاری', chk.btns);
  const stepBtn = await page2.evaluateHandle(() => [...document.querySelectorAll('.ev-checklist button')].find(b => (b.textContent ?? '').includes('تکمیل مرحله')));
  await stepBtn.asElement().click();
  await new Promise(r => setTimeout(r, 2500));
  const afterStep = await page2.evaluate(() => ({
    done: document.querySelectorAll('.ev-steps-list .ev-step.done').length,
    current: (document.querySelector('.ev-steps-list .ev-step.current b')?.textContent ?? ''),
  }));
  ok('تکمیل مرحله → ۲ انجام‌شده و مرحلهٔ بعدی جاری', afterStep.done === 2 && afterStep.current.includes('آماده‌سازی'), `done=${afterStep.done}`);


  /* ═══ گام ۴.۲ — فرم ۸ و ۷: رسانه تخصصی و تأیید محتوا در تقویم ═══ */
  await page2.evaluate(() => { document.querySelector('.ev-checklist .modal-close, .modal-backdrop .modal-close')?.click?.(); });
  await page2.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 700));
  const cinfo = await page2.evaluate(() => ({
    hasPanel: [...document.querySelectorAll('h2')].some(h => (h.textContent ?? '').includes('رسانه تخصصی و تأیید محتوا')),
    pillars: document.querySelectorAll('.cnt-pillar').length,
    rows: [...document.querySelectorAll('.cnt-row')].map(r => (r.textContent ?? '').replace(/\s+/g, ' ').trim()),
    stats: [...document.querySelectorAll('.content-panel .pmr-stats .chip')].map(c => (c.textContent ?? '').replace(/\s+/g, ' ').trim()),
  }));
  ok('فرم ۸: پنل رسانه تخصصی با هفت ستون ریتم‌دار سند', cinfo.hasPanel && cinfo.pillars === 7, `pillars=${cinfo.pillars}`);
  ok('فرم ۸: هفت خروجی بذر پارس با ستون و ریتم', cinfo.rows.length === 7 && cinfo.rows.some(r => r.includes('پروندهٔ ویژهٔ دادهٔ باز صنعت')) && cinfo.rows.every(r => r.includes('مدیر محتوا')), `rows=${cinfo.rows.length}`);
  ok('فرم ۸: آمار وضعیت (۲ منتشرشده + ۱ تأییدشده + ۱ در بازبینی + ۳ پیش‌نویس)',
    cinfo.stats.some(c => c.includes('منتشرشده: ۲')) && cinfo.stats.some(c => c.includes('تأییدشده: ۱')) && cinfo.stats.some(c => c.includes('در بازبینی: ۱')), JSON.stringify(cinfo.stats));

  /* فرم ۷: مودال چهار کنترل — ثبت دو کنترل باقی‌ماندهٔ اپیزود پادکست → تأییدشده → انتشار */
  await (await page2.evaluateHandle(() => [...document.querySelectorAll('.cnt-row')].find(r => (r.textContent ?? '').includes('اپیزود: سخنران داده')))).asElement().click();
  await page2.waitForSelector('.cnt-detail', { timeout: 30000 });
  const d0 = await page2.evaluate(() => ({
    head: (document.querySelector('.cnt-detail-head')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ctls: document.querySelectorAll('.cnt-ctl').length,
    okCount: document.querySelectorAll('.cnt-ctl.ok').length,
    buttons: document.querySelectorAll('.cnt-ctl button').length,
    publishBtn: [...document.querySelectorAll('.cnt-detail button')].some(b => (b.textContent ?? '').trim() === 'انتشار'),
    hint: (document.querySelector('.cnt-detail .field-hint')?.textContent ?? '').includes('انتشار بدون تأیید کامل ممنوع'),
  }));
  ok('فرم ۷: مودال گردش تأیید با چهار کنترل الزامی (۲ تأییدشده، ۲ دکمهٔ ثبت)', d0.ctls === 4 && d0.okCount === 2 && d0.buttons === 2 && !d0.publishBtn && d0.hint, JSON.stringify(d0).slice(0, 80));
  for (let i = 0; i < 2; i++) {
    await page2.evaluate(() => { [...document.querySelectorAll('.cnt-ctl button')][0]?.click(); });
    await new Promise(r => setTimeout(r, 2500));
  }
  const d1 = await page2.evaluate(() => ({
    okCount: document.querySelectorAll('.cnt-ctl.ok').length,
    status: (document.querySelector('.cnt-detail-head .srip-badge')?.textContent ?? '').trim(),
    publishBtn: [...document.querySelectorAll('.cnt-detail button')].some(b => (b.textContent ?? '').trim() === 'انتشار'),
  }));
  ok('فرم ۷: ثبت دو کنترل دیگر → «تأییدشده» با دکمهٔ انتشار', d1.okCount === 4 && d1.status.includes('تأییدشده') && d1.publishBtn, JSON.stringify(d1));
  await page2.evaluate(() => { [...document.querySelectorAll('.cnt-detail button')].find(b => (b.textContent ?? '').trim() === 'انتشار')?.click(); });
  await new Promise(r => setTimeout(r, 3000));
  const d2 = await page2.evaluate(() => ({
    status: (document.querySelector('.cnt-detail-head .srip-badge')?.textContent ?? '').trim(),
    rowStatus: ([...document.querySelectorAll('.cnt-row')].find(r => (r.textContent ?? '').includes('اپیزود: سخنران داده'))?.textContent ?? '').includes('منتشرشده'),
    noBtn: ![...document.querySelectorAll('.cnt-detail button')].some(b => (b.textContent ?? '').trim() === 'انتشار'),
  }));
  ok('فرم ۷: انتشار از رابط → «منتشرشده» در مودال و فهرست؛ دکمهٔ انتشار برداشته شد', d2.status.includes('منتشرشده') && d2.rowStatus && d2.noBtn, JSON.stringify(d2));
  await page2.evaluate(() => { document.querySelector('.modal-close')?.click(); });
  await new Promise(r => setTimeout(r, 500));

  await page2.close();

  /* ═══ سناریوی ۳ (فقط بیلد استاتیک): ۴۰۴ ریشهٔ سایت نباید حلقهٔ ریدایرکت بسازد ═══
     باگ تاریخی: 404.html ریشه ریدایرکت «نسبی» ./srip2/index.html داشت؛ GitHub Pages
     آن را برای هر ۴۰۴ سرو می‌کند → در /relationships/r-pars-01 حلقهٔ بی‌نهایت
     /srip2/srip2/…/index.html می‌ساخت. اکنون: مسیر جزئیات → /view هوشمند. */
  if (process.env.UI_BASE) {
    /* تب جدید با نشست خودش (مثل کاربر واقعی که لاگین است) */
    const p3 = await browser.newPage();
    await p3.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p3.waitForSelector('#login-email', { timeout: 30000 });
    await p3.type('#login-email', 'aroun');
    await p3.type('#login-pass', '12356784');
    await p3.click('.auth-form button[type=submit]');
    await p3.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    /* الف) رابطهٔ پارس حالا صفحهٔ استاتیک خودش را دارد (بدون ۴۰۴) */
    await p3.goto(`${BASE}/relationships/r-pars-01`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3500));
    const directTxt = await p3.evaluate(() => document.body.textContent ?? '');
    ok('رابطهٔ پارس: صفحهٔ استاتیک مستقیم باز می‌شود', p3.url().includes('/relationships/r-pars-01'), 'url=' + p3.url().replace(BASE, ''));
    ok('رابطهٔ پارس: محتوای هلدینگ پارس رندر می‌شود', directTxt.includes('هلدینگ پارس') || directTxt.includes('پارس انرژی'));

    /* ب) موجودیتِ بدون صفحهٔ استاتیک → ۴۰۴ ریشهٔ هوشمند → /view (نه حلقهٔ /srip2/srip2/…) */
    const navs = [];
    p3.on('framenavigated', f => { if (f === p3.mainFrame()) navs.push(f.url()); });
    await p3.goto(`${BASE}/relationships/r-pars-99`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 6000));
    const finalUrl3 = p3.url();
    ok('۴۰۴ هوشمند: مسیر ناموجود → /view (نه حلقه)', finalUrl3.includes('/view?type=relationships&id=r-pars-99'), 'url=' + finalUrl3.replace(BASE, ''));
    ok('۴۰۴ هوشمند: بدون رشد srip2 در URL', !/srip2\/srip2/.test(finalUrl3), 'navs=' + navs.map(u => u.replace(BASE, '')).join(' ⟶ '));

    /* ج) URL آلودهٔ حلقه‌زای قبلی هم باید بی‌خطر شود */
    await p3.goto(`${BASE}/relationships/srip2/index.html`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 6000));
    const finalUrl4 = p3.url();
    ok('URL حلقه‌زای قدیمی اکنون بی‌خطر است (بدون رشد srip2)', !/srip2\/srip2/.test(finalUrl4), 'url=' + finalUrl4.replace(BASE, ''));
    await p3.close();
  }

  /* ═══ سناریوی ۴: ایجاد سریع — فرم‌های کامل با انتخابگرهای واقعی ═══ */
  {
    const q = await browser.newPage();
    await q.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await q.waitForSelector('#login-email', { timeout: 30000 });
    await q.type('#login-email', 'aroun');
    await q.type('#login-pass', '12356784');
    await q.click('.auth-form button[type=submit]');
    await q.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 60000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    /* باز کردن مودال ایجاد سریع از هدر */
    await q.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    await q.evaluate(() => { const b = document.querySelector('button[title="ایجاد سریع"]'); if (b) b.click(); });
    await q.waitForSelector('.quick-card', { timeout: 15000 });
    ok('ایجاد سریع: مودال باز می‌شود', true);

    /* فرم سازمان: فیلدهای کامل */
    const orgForm = await q.evaluate(() => {
      const labels = [...document.querySelectorAll('.quick-card .field-label')].map(l => (l.textContent ?? '').trim());
      const typeSel = document.querySelector('.quick-card select');
      return { labels: labels.slice(0, 6), typeOptions: typeSel ? [...typeSel.options].map(o => o.textContent) : [] };
    });
    ok('ایجاد سریع سازمان: فیلدهای کامل (نام/نوع/صنعت/کشور/سازمان مادر)', ['نام سازمان', 'نوع سازمان', 'صنعت', 'کشور', 'سازمان مادر'].every(l => orgForm.labels.some(x => x.includes(l))), JSON.stringify(orgForm.labels));
    ok('ایجاد سریع سازمان: نوع سازمان با گزینه‌های فارسی', orgForm.typeOptions.some(t => t.includes('هلدینگ')) && orgForm.typeOptions.some(t => t.includes('تأمین‌کننده')));

    /* ثبت سازمان واقعی از طریق فرم */
    const stamp = String(Date.now()).slice(-5);
    const orgName = `شرکت سریع‌ساز ${stamp}`;
    await q.type('.quick-card input[id="qc-name"]', orgName);
    await q.evaluate(() => { const s = document.querySelector('.quick-card select[id="qc-type"]'); s.value = 'PARTNER'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await q.type('.quick-card input[id="qc-industry"]', 'فناوری اطلاعات');
    await q.evaluate(() => { const b = [...document.querySelectorAll('.quick-card button')].find(x => (x.textContent ?? '').includes('ایجاد سازمان')); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 3500));
    const okMsg = await q.evaluate(() => (document.querySelector('.status-message')?.textContent ?? '').trim());
    ok('ایجاد سریع سازمان: ثبت موفق', okMsg.includes('با موفقیت ایجاد شد') && okMsg.includes(orgName), 'msg=' + okMsg);
    /* سازمان مادر: گزینه‌ها فقط سازمان‌های واقعی خود کاربر (بدون دمو) */
    await q.evaluate(() => { const b = [...document.querySelectorAll('.quick-types button')].find(x => (x.textContent ?? '') === 'سازمان'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 800));
    const parentOpts = await q.evaluate(() => [...(document.querySelector('select[id="qc-parentOrganizationId"]')?.options ?? [])].map(o => o.textContent));
    ok('ایجاد سریع: انتخابگر سازمان مادر پر از سازمان‌های واقعی (پارس + بدون دمو)', parentOpts.some(t => t.includes('هلدینگ پارس')) && !parentOpts.some(t => t.includes('هلدینگ آریا')), 'n=' + parentOpts.length);

    /* فرم جلسه: تاریخ شمسی + رابطهٔ واقعی */
    await q.evaluate(() => { const b = [...document.querySelectorAll('.quick-types button')].find(x => (x.textContent ?? '') === 'جلسه'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 800));
    const meetForm = await q.evaluate(() => {
      const relOpts = [...(document.querySelector('select[id="qc-relationshipId"]')?.options ?? [])].map(o => o.textContent);
      const labels = [...document.querySelectorAll('.quick-card .field-label')].map(l => (l.textContent ?? '').trim());
      return { relOpts, hasJalali: !!document.querySelector('.quick-card input[placeholder*="تاریخ"]'), labels: labels.slice(0, 12) };
    });
    ok('ایجاد سریع جلسه: انتخاب رابطه از روابط واقعی (پارس)', meetForm.relOpts.some(t => t.includes('هلدینگ پارس')), JSON.stringify(meetForm.relOpts.slice(0, 2)));
    ok('ایجاد سریع جلسه: فیلدهای کامل (هدف/دستور/محل/لینک/شرکت‌کنندگان)', ['هدف جلسه', 'دستور جلسه', 'محل برگزاری', 'لینک جلسه', 'شرکت‌کنندگان'].every(l => meetForm.labels.some(x => x.includes(l))));
    /* ثبت جلسه با تاریخ شمسی «امروز» */
    await q.type('.quick-card input[id="qc-title"]', `جلسهٔ سریع ${stamp}`);
    await q.evaluate(() => { const i = document.querySelector('.quick-card input[placeholder*="تاریخ و ساعت"]'); if (i) i.click(); });
    await new Promise(r => setTimeout(r, 800));
    await q.evaluate(() => { const b = [...document.querySelectorAll('.jalali-pop button')].find(x => (x.textContent ?? '').includes('امروز')); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 600));
    await q.evaluate(() => { const b = [...document.querySelectorAll('.quick-card button')].find(x => (x.textContent ?? '').includes('ایجاد جلسه')); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 3500));
    const meetMsg = await q.evaluate(() => (document.querySelector('.status-message')?.textContent ?? '').trim());
    ok('ایجاد سریع جلسه: ثبت موفق با تاریخ شمسی', meetMsg.includes('با موفقیت ایجاد شد'), 'msg=' + meetMsg);

    /* جلسهٔ ساخته‌شده واقعاً در فهرست جلسات است (انتظار مقاوم — رفرش اولیهٔ SW) */
    await q.goto(`${BASE}/meetings`, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
    const listOk = await q.waitForFunction((t) => (document.body.textContent ?? '').includes(t), { timeout: 20000 }, `جلسهٔ سریع ${stamp}`).then(() => true).catch(() => false);
    ok('ایجاد سریع جلسه: در فهرست جلسات ظاهر می‌شود', listOk);
    await q.close();
  }
} catch (e) {
  console.error('E2E error:', e.message);
  fail++;
  failures.push('exception: ' + e.message);
} finally {
  await browser.close();
}

console.log('\n════════════════════════════════════');
console.log(`  PASS: ${pass}   FAIL: ${fail}`);
if (failures.length) console.log(`  Failed: ${failures.join(' | ')}`);
console.log('════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
