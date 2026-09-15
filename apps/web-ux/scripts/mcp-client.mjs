/* ============================================================================
   کلاینت MCP نمونهٔ SRIP (مسترپلن فاز ۲/۱۵)
   اتصال Streamable-HTTP به سرور MCP فقط-خواندنی و پرسش‌های استاندارد.
   اجرا:  node scripts/mcp-client.mjs            (پیش‌فرض :4000)
          MCP_URL=http://localhost:4000/api/v1/mcp node scripts/mcp-client.mjs
   خروجی: گزارش ۱۰ پرسش استاندارد + خروجی 0/1 (سبز/قرمز) — قابل استفاده در CI.
   احراز هویت: ابتدا ورود pars سپس توکن در هدر Authorization (سازگار با موک).
   ============================================================================ */
const MCP_BASE = process.env.MCP_URL ?? 'http://localhost:4000/api/v1';
const BASE = MCP_BASE.endsWith('/mcp') ? MCP_BASE : MCP_BASE.replace(/\/+$/, '') + '/mcp';
const LOGIN = BASE.replace(/\/mcp$/, '') + '/auth/login';

let pass = 0, fail = 0;
const failures = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

async function login() {
  const r = await fetch(LOGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pars@srip.local', password: 'pars1234' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error('ورود ناموفق: ' + JSON.stringify(j).slice(0, 120));
  return j.accessToken;
}

async function rpc(token, id, method, params) {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`RPC خطا: ${j.error.message}`);
  return j.result;
}

const call = (token, id, name, args) => rpc(token, id, 'tools/call', { name, arguments: args });

async function main() {
  console.log('═══ کلاینت MCP نمونهٔ SRIP — ۱۰ پرسش استاندارد ═══\n');
  const token = await login();
  ok('اتصال و احراز هویت', true);

  /* ۱) initialize */
  const init = await rpc(token, 1, 'initialize');
  ok('۱) initialize → پروتکل و قابلیت ابزارها', init?.protocolVersion && init?.capabilities?.tools);

  /* ۲) tools/list */
  const tools = await rpc(token, 2, 'tools/list');
  ok('۲) tools/list → ۶ ابزار فقط-خواندنی', (tools?.tools ?? []).length === 6 && tools.tools.every(t => t.inputSchema));

  /* ۳) جست‌وجوی گراف */
  const sg = await call(token, 3, 'search_graph', { query: 'شریف' });
  const sgData = sg.structuredContent;
  ok('۳) «دانشگاه شریف را در شبکه پیدا کن»', (sgData?.organizations ?? []).some(o => o.id === 'org-ac-sharif'));

  /* ۴) جست‌وجوی اشخاص */
  const sg2 = await call(token, 4, 'search_graph', { query: 'وزارت' });
  ok('۴) «نهادهای وزارتی فهرست کن»', (sg2.structuredContent?.organizations ?? []).length >= 3);

  /* ۵) پروفایل ذینفع */
  const prof = await call(token, 5, 'stakeholder_profile', { organizationId: 'org-pars' });
  ok('۵) «پروفایل هلدینگ پارس»', prof.structuredContent?.organization?.name === 'هلدینگ پارس' && prof.structuredContent.relationshipCount >= 1);

  /* ۶) امتیاز رابطه */
  const rel = await call(token, 6, 'relationship_score', { fromOrganizationId: 'org-pars', toOrganizationId: 'org-pars-01' });
  const relOk = rel.structuredContent?.relationshipId || rel.error;
  ok('۶) «امتیاز رابطهٔ پارس و پارس انرژی»', !!relOk, JSON.stringify(rel).slice(0, 80));

  /* ۷) مسیر پیشنهادی */
  const path = await call(token, 7, 'suggested_path', { from: 'org-pars', to: 'org-ac-sharif', maxHops: 3 });
  ok('۷) «مسیر معرفی تا دانشگاه شریف»', typeof path.structuredContent?.found === 'boolean' && Array.isArray(path.structuredContent?.edges));

  /* ۸) شکاف‌های عمومی */
  const gaps = await call(token, 8, 'public_gaps', { organizationId: 'org-pars' });
  ok('۸) «شکاف‌های پوشش عمومی پارس»', typeof gaps.structuredContent?.totalGaps === 'number');

  /* ۹) ذکرهای رسانه‌ای */
  const med = await call(token, 9, 'media_mentions', { organizationId: 'org-ac-sharif' });
  ok('۹) «پوشش رسانه‌ای دانشگاه شریف»', Array.isArray(med.structuredContent?.mentions) && med.structuredContent._meta?.sourceIds?.length > 0);

  /* ۱۰) هر پاسخ با شناسهٔ منبع و تاریخ داده (ضد توهم) */
  const sample = [sg, prof, path, gaps, med];
  ok('۱۰) هر پاسخ با _meta (تاریخ داده + شناسهٔ منبع)', sample.every(r => r.structuredContent?._meta?.dataDate && 'sourceIds' in r.structuredContent._meta));

  console.log(`\n═══ MCP client: pass=${pass} fail=${fail} ═══`);
  if (failures.length) { console.log('FAILURES:'); for (const f of failures) console.log(' -', f); }
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch(e => { console.error('❌ کلاینت MCP شکست خورد:', e.message); process.exitCode = 1; });
