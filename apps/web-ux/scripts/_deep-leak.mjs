/* پروب عمیق نشت: با حساب واقعی همهٔ endpointها را می‌خواند و هر ارجاعی
   به دنیای دمو (org-1..12، p-1..19، r-1..12، u-1..3، نام/ایمیل دمو) را
   در عمق JSON گزارش می‌کند. استفاده:
     node scripts/_deep-leak.mjs [aroun|pars]
*/
const BASE = (process.env.PROBE_BASE ?? 'http://localhost:4000') + '/api/v1';
const USER = process.argv[2] ?? 'aroun';
const PASS = USER === 'aroun' ? '12356784' : USER === 'pars' ? 'pars1234' : '123456';

const ENDPOINTS = [
  '/organizations', '/people', '/relationships', '/actions', '/meetings',
  '/commitments', '/projects', '/opportunities', '/interactions', '/recommendations',
  '/alerts', '/notifications', '/documents', '/documents/status', '/approvals',
  '/workflows', '/network/graph', '/network/columns', '/network/connectors',
  '/analytics/summary', '/analytics/network', '/analytics/recommendations/funnel', '/analytics/workflows',
  '/intelligence/overview', '/intelligence/nba', '/intelligence/risk-leverage', '/intelligence/risk-signals',
  '/strategy/archetypes', '/strategy/connections', '/strategy/scenarios', '/strategy/imports',
  '/publics/catalog', '/publics/media', '/publics/members',
  '/core-domain/referrals', '/criteria', '/criteria/nudges', '/criteria/review-queue',
  '/knowledge', '/search/saved', '/metrics/summary', '/ai/usage', '/ai/status',
  '/admin/overview', '/admin/master-data', '/authorization/memberships',
  '/admin/users', '/admin/audit-log', '/admin/audit', '/admin/tags', '/admin/feature-flags', '/admin/integrations',
  '/admin/notification-rules', '/admin/scoring-rules', '/approvals?status=APPROVED', '/approvals?status=REJECTED',
  '/notifications/unread-count', '/admin/permissions', '/admin/interaction-types',
  '/notifications/preferences', '/notifications/delivery-log',
];

/* ─── دنیای دمو ─── */
const DEMO_IDS = new Set([
  ...Array.from({ length: 12 }, (_, i) => `org-${i + 1}`),
  ...Array.from({ length: 19 }, (_, i) => `p-${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `r-${i + 1}`),
  'u-1', 'u-2', 'u-3', 'mb-1', 'mb-2', 'mb-3', 'mtg-1', 'mtg-2', 'mtg-3', 'mtg-4',
  ...Array.from({ length: 6 }, (_, i) => `a-${i + 1}`),
]);
const DEMO_TEXT = [
  'هلدینگ آریا', 'آریا فناوری', 'آریا', 'پترو صنعت', 'سدنا', 'قطعات البرز', 'صندوق سرمایه‌گذاری امید',
  'استانداری تهران', 'اتاق بازرگانی تهران', 'سارا محمدی', 'بانک ملّی', 'کاربر دمو',
  'demo@srip.local', 'client@arya-tech.ir', 'admin@srip.local', 'مدیر ارشد (مالک)', 'مدیر هلدینگ (ناظر)',
];

const hits = [];
function scan(node, path, ep) {
  if (node == null) return;
  if (Array.isArray(node)) { node.forEach((v, i) => scan(v, `${path}[${i}]`, ep)); return; }
  if (typeof node === 'object') { for (const [k, v] of Object.entries(node)) scan(v, `${path}.${k}`, ep); return; }
  const s = String(node);
  if (DEMO_IDS.has(s)) hits.push(`${ep} → ${path} = «${s}»`);
  else for (const t of DEMO_TEXT) if (s.includes(t)) { hits.push(`${ep} → ${path} ≈ «${s.slice(0, 80)}»`); break; }
}

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASS }),
});
const tok = (await login.json()).accessToken;
if (!tok) { console.error('login failed'); process.exit(1); }

for (const ep of ENDPOINTS) {
  let status = 0, body = null;
  try {
    const r = await fetch(BASE + ep, { headers: { authorization: `Bearer ${tok}` } });
    status = r.status;
    if (r.ok) body = await r.json().catch(() => null);
  } catch { /* skip */ }
  if (!body) { console.log(`  ${status === 404 || status === 403 ? '·' : '!'} ${ep} (${status})`); continue; }
  const before = hits.length;
  scan(body, '$', ep);
  const found = hits.length - before;
  console.log(`${found ? '❌' : '✓'} ${ep}${found ? ` — ${found} ارجاع دمو` : ''}`);
}
console.log(`\n═══ ${USER}: کل ارجاع‌های دمو: ${hits.length} ═══`);
for (const h of hits.slice(0, 80)) console.log('  ' + h);
