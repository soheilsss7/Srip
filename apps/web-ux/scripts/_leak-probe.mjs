import puppeteer from 'puppeteer-core';
import { join, resolve } from 'node:path';
const BASE = process.env.PROBE_BASE ?? 'http://localhost:3000';
const E2E = join('/home/user/Srip/apps/web-ux', '.e2e-browser');
const browser = await puppeteer.launch({
  executablePath: resolve(E2E, 'chromium'),
  env: { ...process.env, LD_LIBRARY_PATH: resolve(E2E, 'nss') },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: true, defaultViewport: { width: 1280, height: 900 },
});
const MARKERS = ['هلدینگ آریا','آریا فناوری','پترو صنعت','گروه ساختمانی سدنا','قطعات البرز','صندوق سرمایه‌گذاری امید','استانداری تهران','اتاق بازرگانی تهران','سارا محمدی','بانک ملّی','کاربر دمو','demo@srip.local','مدیر ارشد (مالک)','سارا محمدی'];
const DEMO_HREF = /\/(organizations\/org-(1|2|3|4|5|6|7|8|9|10|11|12)(?!\d)|people\/p-(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19)(?!\d)|relationships\/r-(1|2|3|4|5|6|7|8|9|10|11|12)(?!\d))(\/|$|\?)/;
const PAGES = ['/','/organizations','/organizations/org-pars','/organizations/org-pars-01','/organizations/org-inst-01','/people','/relationships','/relationships/r-pars-01','/network','/publics','/actions','/meetings','/commitments','/projects','/opportunities','/interactions','/recommendations','/alerts','/intelligence','/analytics','/calendar','/documents','/notifications','/strategy','/workspace'];
async function scan(user, pass) {
  const page = await browser.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.type('#login-email', user);
  await page.type('#login-pass', pass);
  await page.click('.auth-form button[type=submit]');
  await new Promise(r => setTimeout(r, 3000));
  console.log(`\n════════ حساب: ${user} ════════`);
  for (const p of PAGES) {
    console.log('   …', p);
    await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    const res = await page.evaluate(() => {
      const txt = document.body.innerText ?? '';
      const hrefs = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
      return { txt, hrefs };
    });
    const names = MARKERS.filter(m => res.txt.includes(m));
    const badHrefs = [...new Set(res.hrefs.filter(h => DEMO_HREF.test(h)))].slice(0, 4);
    if (names.length || badHrefs.length) {
      console.log(`❌ ${p.padEnd(28)}`, names.length ? 'نام‌ها: ' + names.join('،') : '', badHrefs.length ? ' | لینک دمو: ' + badHrefs.join(' ') : '');
    }
  }
  /* عموم‌ها: تب اعضا */
  await page.goto(BASE + '/publics', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    const sel = document.querySelector('select');
    if (sel) { const opt = [...sel.options].find(o => (o.textContent ?? '').includes('هلدینگ پارس')); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
  });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[role="tab"]')].find(x => (x.textContent ?? '').includes('اعضا')); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 3000));
  const pubTxt = await page.evaluate(() => document.body.innerText ?? '');
  const pubBad = MARKERS.filter(m => pubTxt.includes(m));
  console.log(pubBad.length ? `❌ /publics اعضا: ${pubBad.join('،')}` : '✓ /publics اعضا تمیز');
  await page.close();
}
await scan('aroun', '12356784');
await scan('pars', 'pars1234');
await browser.close();
