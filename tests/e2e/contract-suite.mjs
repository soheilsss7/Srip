/**
 * SRIP contract verification suite — runs against the REAL NestJS+Postgres API.
 *
 * Verifies the contract the mock established is honored by the real backend:
 *  - auth flow (register/verify/login/refresh/logout/password-reset)
 *  - Bearer auth + standardized error envelope
 *  - Idempotency-Key OPTIONAL (no 400 when absent), dedupe when present
 *  - two-role model: tenant (RELATIONSHIP_MANAGER, own scope — mock parity)
 *    and owner (admin sees everything)
 *  - network.read for tenant (graph 200)
 *  - meetings outcome, recommendations generate/approve/reject/snooze/assign/execute → 200
 *  - pagination/filtering conventions
 *
 * Usage: node tests/e2e/contract-suite.mjs [baseUrl]
 */
const base = (process.argv[2] || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
let passCount = 0;
let failCount = 0;

function record(name, ok, detail) {
  if (ok) { passCount++; console.log(`PASS  ${name}`); }
  else { failCount++; console.log(`FAIL  ${name}  ${detail || ''}`); }
}

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { accept: 'application/json', ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (token) h.authorization = `Bearer ${token}`;
  h['x-request-id'] = crypto.randomUUID();
  h['x-correlation-id'] = crypto.randomUUID();
  const res = await fetch(base + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const email = () => `suite-${uniq()}@srip.local`;
const unwrapId = (j) => j?.data?.id || j?.id || '';

async function main() {
  // ---------- A. Health & error envelope ----------
  {
    const r = await api('/health');
    record('health 200 ok', r.status === 200 && r.json?.status === 'ok', `status=${r.status}`);
  }
  {
    const r = await api('/organizations');
    const ok = r.status === 401 && r.json?.error?.code === 'AUTH_REQUIRED' && !!r.json?.error?.requestId;
    record('no-token -> 401 AUTH_REQUIRED envelope', ok, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 140)}`);
  }

  // ---------- B. Auth contract ----------
  let userToken = '';
  let refreshToken = '';
  let userId = '';
  let tenantOrgId = '';
  const newEmail = email();
  const password = 'SuitePass!123';
  {
    const r = await api('/auth/register', { method: 'POST', body: { email: newEmail, password, name: 'Suite User' } });
    const devToken = r.json?.developmentVerificationToken;
    userId = r.json?.user?.id || '';
    record('register 201 + dev token', r.status === 201 && !!devToken, `status=${r.status}`);
    if (devToken) {
      const v = await api('/auth/email/verify', { method: 'POST', body: { token: devToken } });
      record('email verify 2xx (mock parity)', v.status >= 200 && v.status < 300, `status=${v.status}`);
    }
  }
  {
    const r = await api('/auth/login', { method: 'POST', body: { email: newEmail, password } });
    userToken = r.json?.accessToken || '';
    refreshToken = r.json?.refreshToken || '';
    record('login 200 + tokens', r.status === 200 && !!userToken && !!refreshToken, `status=${r.status}`);
  }
  {
    const r = await api('/auth/me', { token: userToken });
    record('auth/me 200', r.status === 200 && r.json?.email === newEmail, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 120)}`);
  }
  {
    const r = await api('/auth/refresh', { method: 'POST', body: { token: refreshToken } });
    const ok = r.status === 200 && !!r.json?.accessToken;
    if (ok) userToken = r.json.accessToken;
    record('refresh 200 + rotation', ok, `status=${r.status}`);
  }
  {
    const r = await api('/auth/logout', { method: 'POST', body: { token: refreshToken } });
    record('logout 200', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await api('/auth/login', { method: 'POST', body: { email: newEmail, password: 'WrongPass!999' } });
    record('bad login -> 401 AUTH_INVALID', r.status === 401 && r.json?.error?.code === 'AUTH_INVALID', `status=${r.status}`);
  }

  // ---------- Owner bootstrap: login, create tenant org, assign membership ----------
  const adminLogin = await api('/auth/login', { method: 'POST', body: { email: 'admin@srip.local', password: 'ChangeMe!123456' } });
  const adminToken = adminLogin.json?.accessToken || '';
  record('admin login 200 (owner)', adminLogin.status === 200 && !!adminToken, `status=${adminLogin.status}`);
  {
    const r = await api('/organizations', { method: 'POST', token: adminToken, body: { name: `Suite Tenant ${uniq()}`, type: 'SUBSIDIARY' } });
    tenantOrgId = unwrapId(r.json);
    record('owner POST org WITHOUT idempotency-key -> 201 (optional key)', r.status === 201 && !!tenantOrgId, `status=${r.status}`);
  }
  {
    const key = uniq();
    const body = { name: `Dedupe Org ${uniq()}`, type: 'CUSTOMER' };
    const r1 = await api('/organizations', { method: 'POST', token: adminToken, body, headers: { 'idempotency-key': key } });
    const r2 = await api('/organizations', { method: 'POST', token: adminToken, body, headers: { 'idempotency-key': key } });
    // jsonb normalizes key order, so compare canonical (sorted-key) JSON.
    const canon = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort());
    const same = canon(r1.json) === canon(r2.json);
    record('idempotency dedupe: same key -> same entity', r1.status === 201 && r2.status === 201 && same, `s1=${r1.status} s2=${r2.status} same=${same} id1=${r1.json?.id} id2=${r2.json?.id}`);
  }
  {
    const r = await api('/authorization/memberships', {
      method: 'POST', token: adminToken,
      body: { userId, organizationId: tenantOrgId, role: 'RELATIONSHIP_MANAGER' },
    });
    record('owner assigns RELATIONSHIP_MANAGER membership (mock parity)', r.status >= 200 && r.status < 300, `status=${r.status}`);
  }

  // ---------- C. Tenant scope: network (was 403 for STANDARD_USER) ----------
  {
    const r = await api('/network/graph', { token: userToken });
    record('network/graph 200 for tenant', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }

  // ---------- D. Meetings: create + outcome 200 ----------
  let meetingId = '';
  {
    const r = await api('/meetings', {
      method: 'POST', token: userToken,
      body: { title: `Suite Meeting ${uniq()}`, startAt: new Date(Date.now() + 86400000).toISOString(), objective: 'contract suite' },
    });
    meetingId = unwrapId(r.json);
    record('create meeting 201 (tenant scope)', r.status === 201 && !!meetingId, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
  if (meetingId) {
    const r = await api(`/meetings/${meetingId}/outcome`, { method: 'POST', token: userToken, body: { outcome: 'COMPLETED', notes: 'suite' } });
    record('meetings outcome 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }

  // ---------- E. Recommendations: generate/approve/snooze/assign/execute/reject ----------
  {
    const r = await api('/recommendations/generate', { method: 'POST', token: userToken, body: { organizationId: tenantOrgId } });
    // Fresh org without interactions -> deterministic engine correctly produces 0.
    record('rec generate 200 (tenant, no data -> 0 candidates)', r.status === 200 && r.json?.generated === 0, `status=${r.status} generated=${r.json?.generated}`);
  }
  {
    const r = await api('/recommendations', { token: userToken });
    record('rec list 200 (tenant scope)', r.status === 200, `status=${r.status}`);
  }
  // Lifecycle tests run on the seed fixture data (holding org, admin = owner scope).
  // Deterministic across re-runs: clean slate (reject all non-terminal), then the
  // engine produces exactly one new FOLLOW_UP recommendation per generation.
  const HOLDING = '00000000-0000-0000-0000-000000000001';
  const ADMIN_ID = '00000000-0000-0000-0000-000000000010';
  const asList = (j) => (Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : []);
  {
    const all = asList((await api('/recommendations', { token: adminToken })).json);
    for (const rec of all) {
      if (!['REJECTED', 'EXECUTED', 'ARCHIVED'].includes(rec.status)) {
        await api(`/recommendations/${rec.id}/reject`, { method: 'POST', token: adminToken, body: { reason: 'suite reset' } });
      }
    }
    const r = await api('/recommendations/generate', { method: 'POST', token: adminToken, body: { organizationId: HOLDING } });
    record('rec generate 200 (owner, fixture data)', r.status === 200 && r.json?.generated > 0, `status=${r.status} generated=${r.json?.generated}`);
  }
  const nextProposed = async () => {
    const r = await api('/recommendations?status=PROPOSED', { token: adminToken });
    return asList(r.json)[0] || {};
  };
  const A = await nextProposed();
  record('rec list 200 (owner)', !!A.id, `id=${A.id}`);
  if (A.id) {
    const vw = await api(`/recommendations/${A.id}/view`, { method: 'POST', token: adminToken });
    record('rec view 2xx (extra endpoint, not in mock)', vw.status >= 200 && vw.status < 300, `status=${vw.status}`);
    const sn = await api(`/recommendations/${A.id}/snooze`, { method: 'POST', token: adminToken, body: { until: new Date(Date.now() + 7 * 86400000).toISOString() } });
    record('rec snooze 200', sn.status === 200, `status=${sn.status}`);
    const as = await api(`/recommendations/${A.id}/assign`, { method: 'POST', token: adminToken, body: { assigneeId: ADMIN_ID } });
    record('rec assign 200', as.status === 200, `status=${as.status}`);
    const rj = await api(`/recommendations/${A.id}/reject`, { method: 'POST', token: adminToken, body: { reason: 'suite' } });
    record('rec reject 200', rj.status === 200, `status=${rj.status}`);
  }
  {
    const g2 = await api('/recommendations/generate', { method: 'POST', token: adminToken, body: { organizationId: HOLDING } });
    const B = await nextProposed();
    record('rec regenerate after terminal state', g2.json?.generated > 0 && !!B.id, `generated=${g2.json?.generated} id=${B.id}`);
    if (B.id) {
      const ap = await api(`/recommendations/${B.id}/approve`, { method: 'POST', token: adminToken });
      record('rec approve 200', ap.status === 200, `status=${ap.status}`);
      const ex = await api(`/recommendations/${B.id}/execute`, { method: 'POST', token: adminToken });
      record('rec execute 200 (after approve, mock parity)', ex.status === 200, `status=${ex.status} action=${ex.json?.action?.id}`);
    }
  }

  // ---------- F. Core read endpoints & pagination ----------
  for (const [label, path] of [
    ['organizations list', '/organizations?page=1&limit=10'],
    ['people list', '/people'],
    ['relationships list', '/relationships'],
    ['interactions list', '/interactions'],
    ['actions list', '/actions'],
    ['projects list', '/projects'],
    ['opportunities list', '/opportunities'],
    ['tags list', '/tags'],
    ['analytics summary', '/analytics/summary'],
    ['network centrality', '/network/centrality'],
    ['search', '/search?q=srip'],
    ['notifications', '/notifications'],
  ]) {
    const r = await api(path, { token: userToken });
    record(`${label} 200`, r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  }
  {
    const r = await api('/organizations?page=1&limit=5', { token: userToken });
    const data = r.json?.data ?? r.json;
    record('pagination limit honored', r.status === 200 && Array.isArray(data) && data.length <= 5, `status=${r.status} len=${Array.isArray(data) ? data.length : '?'}`);
  }

  // ---------- G. Security positives ----------
  {
    const r = await api('/organizations', { method: 'POST', token: userToken, body: { name: `Intruder ${uniq()}` } });
    const denied = r.status === 403 && ['ACCESS_DENIED', 'ORG_SCOPE_DENIED'].includes(r.json?.error?.code);
    record('tenant POST org -> 403 denied (root creation is owner-only)', denied, `status=${r.status} code=${r.json?.error?.code}`);
  }
  {
    const r = await api('/admin/overview', { token: userToken });
    record('tenant /admin/overview -> 403', r.status === 403, `status=${r.status}`);
  }

  // ---------- H. Owner scope ----------
  {
    const r = await api('/admin/overview', { token: adminToken });
    record('admin overview 200 (owner scope)', r.status === 200, `status=${r.status}`);
  }

  console.log(`\n===== ${passCount} PASS / ${failCount} FAIL =====`);
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => { console.error('SUITE CRASH:', e.message); process.exit(2); });
