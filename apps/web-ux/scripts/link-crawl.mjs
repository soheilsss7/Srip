/* ============================================================================
   SRIP Link-crawl integration check.
   Fetches every main route, extracts internal <a href> links from the SSR
   HTML and verifies each one returns HTTP 200 (no dead links).
   Usage: node scripts/link-crawl.mjs        (defaults to :3000)
   ============================================================================ */
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

const ROUTES = [
  '/', '/dashboard', '/organizations', '/organizations/org-2', '/people', '/people/p-1',
  '/relationships', '/relationships/r-1', '/network', '/meetings', '/meetings/m-1',
  '/actions', '/actions/a-1', '/commitments', '/projects', '/projects/pr-1',
  '/opportunities', '/opportunities/o-1', '/interactions', '/intelligence', '/ai',
  '/recommendations', '/recommendations/rec-1', '/search',
  '/login', '/register', '/forgot-password', '/mfa', '/password-reset', '/referrals',
  '/reports', '/admin', '/admin/master-data', '/admin/feature-flags', '/admin/sessions',
  '/data-management', '/data-quality', '/privacy', '/integrations', '/workflows',
  '/analytics', '/metrics', '/monitoring', '/observability', '/security',
  '/security-events', '/governance', '/enterprise', '/data-lifecycle', '/health',
  '/settings', '/sessions', '/notifications', '/documents', '/requirements',
  '/calendar', '/approvals', '/backend-coverage', '/workspace', '/authorization',
  '/help', '/data-exchange', '/reports',
  '/publics', '/strategy', '/partnerships', '/program', '/international', /* فاز ۱۴+ */
];

const seen = new Set();
const hrefs = new Set();
let pageOk = 0, pageFail = 0;

for (const route of ROUTES) {
  const code = await fetch(ORIGIN + route, { redirect: 'follow' }).then(r => r.status).catch(() => 0);
  if (code === 200) pageOk++; else { pageFail++; console.log(`  ❌ PAGE ${route} → ${code}`); }
  if (code !== 200 || seen.has(route)) continue;
  seen.add(route);
  const html = await fetch(ORIGIN + route).then(r => r.text()).catch(() => '');
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const href = m[1];
    if (href.startsWith('/api')) continue;
    hrefs.add(href);
  }
}

console.log(`\nPages OK: ${pageOk}  Fail: ${pageFail}`);
console.log(`Unique internal hrefs found: ${hrefs.size}`);
let linkOk = 0, linkFail = 0; const dead = [];
const list = [...hrefs].filter(h => !['/not-found-check-xyz'].includes(h)).slice(0, 150);
/* ۱۶.۲ — href های HTML با basePath (مثل /Srip/srip2/login) آمده‌اند؛ برای جلوگیری از دوبل‌شدنِ sub-path نرمال می‌شوند */
const _o = new URL(ORIGIN);
const _sub = _o.pathname.replace(/\/+$/, '');
for (const href of list) {
  let _p = href;
  if (_sub && _p === _sub) _p = '/';
  else if (_sub && _p.startsWith(_sub + '/')) _p = _p.slice(_sub.length);
  const code = await fetch(ORIGIN + _p, { redirect: 'follow' }).then(r => r.status).catch(() => 0);
  if (code === 200) linkOk++;
  else { linkFail++; dead.push(`${href}→${code}`); }
}
console.log(`Links OK: ${linkOk}  Fail: ${linkFail}`);
if (dead.length) console.log(`Dead links:\n  ${dead.join('\n  ')}`);
process.exit(pageFail > 0 || linkFail > 0 ? 1 : 0);
