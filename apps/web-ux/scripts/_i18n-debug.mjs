// _i18n-debug.mjs — دیباگ تفکیکی #418 per load
import { execFileSync } from 'node:child_process';
const inner = `
const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({executablePath: ".e2e-browser/chromium", headless: true, args: ["--no-sandbox","--disable-dev-shm-usage"]});
  const page = await browser.newPage();
  const logs = [];
  page.on("console", m => logs.push("[console." + m.type() + "] " + m.text()));
  page.on("pageerror", e => logs.push("[pageerror] " + String(e.stack || e)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto("http://localhost:4200/Srip/srip2/login", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 800));
  console.log("=== PHASE 1 (cold, no localStorage): " + logs.length + " logs ===");
  console.log(logs.filter(l => !l.includes("reqfail")).join("\\n").slice(0, 6000) || "(clean)");
  logs.length = 0;
  await page.evaluate(() => { try { localStorage.setItem("srip_locale", "en"); } catch (e) {} });
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1200));
  console.log("=== PHASE 2 (reload, srip_locale=en): " + logs.length + " logs ===");
  console.log(logs.filter(l => !l.includes("reqfail")).join("\\n").slice(0, 6000) || "(clean)");
  const h2 = await page.$eval("h2", el => el.textContent).catch(() => "NONE");
  const dir = await page.evaluate(() => document.documentElement.dir);
  console.log("H2=" + h2 + " DIR=" + dir);
  await browser.close();
})();
`;
execFileSync('node', ['-e', inner], { stdio: 'inherit', env: { ...process.env, LD_LIBRARY_PATH: '.e2e-browser/nss' } });
