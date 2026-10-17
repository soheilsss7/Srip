/**
 * SRIP demo-mock regression suite (durable replacement for /tmp suites).
 *
 * Spawns a fresh instance of apps/web-ux/scripts/mock-api.mjs (deterministic
 * demo backend) on a dedicated port, then verifies the P0→P3 relationship
 * upgrade contract: knowledge/capital/pulse, NBA, SNA, meeting intel,
 * compliance (screen/decide), institutional memory (transfer/handoff),
 * light-GNN predictions and the board overview. It also proves unknown
 * routes return 404 JSON without killing the server.
 *
 * Usage:
 *   node tests/e2e/mock-demo-regression.mjs [--port 4571]
 *
 * Exit code 0 = all green.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mockPath = join(here, '..', '..', 'apps', 'web-ux', 'scripts', 'mock-api.mjs');
const portIdx = process.argv.indexOf('--port');
const PORT = String(portIdx >= 0 ? process.argv[portIdx + 1] : 4571);
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; fails.push(`${name} :: ${detail}`); console.log(`FAIL  ${name}  ${detail}`); }
};

const api = async (path, { method = 'GET', token, body } = {}) => {
  const h = { accept: 'application/json' };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (token) h.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
};

const waitHealth = async (timeoutMs = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) { const j = await r.json(); if (j?.status === 'ok') return j; }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

async function main() {
  const server = spawn(process.execPath, [mockPath, '--reset'], {
    cwd: join(here, '..', '..', 'apps', 'web-ux'),
    env: { ...process.env, MOCK_API_PORT: PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', (d) => { logs += d; });
  server.stderr.on('data', (d) => { logs += d; });

  const kill = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill('SIGKILL'); } catch {} } };
  process.on('exit', kill);
  try {
    const health = await waitHealth();
    ok('mock health up', !!health, logs.slice(-400));
    if (!health) return;

    // ---- auth ----
    const noTok = await api('/relationships');
    ok('no-token -> 401', noTok.status === 401, `status=${noTok.status}`);
    const login = await api('/auth/login', { method: 'POST', body: { username: 'demo', password: '123456', otp: '123456' } });
    const TOK = login.json?.accessToken || '';
    ok('demo login', login.status === 200 && !!TOK, `status=${login.status}`);
    const cl = await api('/auth/login', { method: 'POST', body: { username: 'client', password: '123456', otp: '123456' } });
    ok('client login scoped', cl.status === 200 && !!cl.json?.accessToken, `status=${cl.status}`);

    // ---- P1 core ----
    const k = await api('/knowledge', { token: TOK });
    ok('knowledge 12', k.status === 200 && k.json?.items?.length === 12, `status=${k.status} n=${k.json?.items?.length}`);
    const cap = await api('/relationships/capital', { token: TOK });
    ok('capital rows 6', cap.status === 200 && cap.json?.items?.length === 6, `status=${cap.status} n=${cap.json?.items?.length}`);
    const pulse = await api('/relationships/r-4/pulse', { token: TOK });
    ok('r-4 pulse', pulse.status === 200 && !!pulse.json?.trend && !!pulse.json?.capital, `status=${pulse.status}`);
    const survey = await api('/relationships/r-4/pulse-survey', { token: TOK });
    ok('r-4 pulse-survey 3q', survey.status === 200 && survey.json?.questions?.length === 3, `status=${survey.status}`);

    // ---- P2 ----
    const nba = await api('/intelligence/nba', { token: TOK });
    ok('nba >= 5 with urgency', nba.status === 200 && (nba.json?.items?.length ?? 0) >= 5 && nba.json.items.every((i) => i.urgencyLabel), `status=${nba.status} n=${nba.json?.items?.length}`);
    const sna = await api('/network/sna', { token: TOK });
    ok('sna density + holes', sna.status === 200 && sna.json?.kpis?.densityOrg > 0 && (sna.json?.structuralHoles?.length ?? 0) >= 1, `status=${sna.status}`);
    const path = await api('/network/path?from=org-2&to=org-7&mode=best&maxHops=3', { token: TOK });
    ok('warm path org-2→org-7', path.status === 200 && path.json?.found && path.json?.hops === 2 && path.json?.score === 80, `status=${path.status} ${JSON.stringify(path.json).slice(0, 120)}`);
    const intel = await api('/meetings/m-1/intel', { token: TOK });
    ok('meeting m-1 intel', intel.status === 200 && ['POSITIVE', 'NEUTRAL', 'CONCERNED'].includes(intel.json?.tone), `status=${intel.status}`);

    // ---- P3-1 compliance ----
    const comp = await api('/governance/compliance', { token: TOK });
    const ck = comp.json?.kpis || {};
    ok('compliance KPIs', comp.status === 200 && ck.organizations === 8 && ck.uboCoverage === 100 && (ck.flaggedUbo ?? 0) >= 1 && ck.openFindings >= 1 && ck.dossiers >= 1, `status=${comp.status} ${JSON.stringify(ck)}`);
    ok('compliance UBO rows', Array.isArray(comp.json?.ubos) && comp.json.ubos.length >= 1, `ubos=${comp.json?.ubos?.length}`);
    const screen = await api('/governance/compliance/screen', { token: TOK, method: 'POST', body: { reason: 'بررسی دورهای' } });
    const sk = screen.json?.view?.kpis || {};
    ok('screen creates findings', screen.status === 200 && screen.json?.ok && screen.json?.createdFindings >= 1 && sk.openFindings >= ck.openFindings, `status=${screen.status} created=${screen.json?.createdFindings} open=${sk.openFindings}`);
    const beforeDossiers = sk.dossiers;
    const decide = await api('/governance/compliance/org-6/decide', { token: TOK, method: 'POST', body: { decision: 'ESCALATED', rationale: 'نیاز به بررسی بیشتر' } });
    const dk = decide.json?.view?.kpis || {};
    ok('decide ESCALATED dossier', decide.status === 200 && decide.json?.ok && dk.dossiers === beforeDossiers + 1 && dk.openFindings < sk.openFindings, `status=${decide.status} ${JSON.stringify(dk)}`);

    // ---- P3-2 institutional memory ----
    const tx = await api('/intelligence/knowledge-transfer?relationshipId=r-2', { token: TOK });
    ok('transfer view r-2', tx.status === 200 && tx.json?.contacts?.length === 3 && (tx.json?.whoKnowsWho?.length ?? 0) >= 1 && (tx.json?.brief?.length ?? 0) > 100 && tx.json?.access === 'full', `status=${tx.status} contacts=${tx.json?.contacts?.length} brief=${tx.json?.brief?.length}`);
    const handoff = await api('/intelligence/knowledge-transfer/r-2/handoff', { token: TOK, method: 'POST', body: { toPersonId: 'p-9', note: 'انتقال دانش' } });
    ok('handoff ok', handoff.status === 200 && handoff.json?.ok && handoff.json?.transfer?.toName && !!handoff.json?.view?.transferred, `status=${handoff.status} ${JSON.stringify(handoff.json).slice(0, 160)}`);
    const dup = await api('/intelligence/knowledge-transfer/r-2/handoff', { token: TOK, method: 'POST', body: { toPersonId: 'p-9' } });
    ok('handoff duplicate 409', dup.status === 409, `status=${dup.status}`);

    // ---- P3-3 light GNN ----
    const pred = await api('/network/predict', { token: TOK });
    const pk = pred.json?.kpis || {};
    ok('predict KPIs', pred.status === 200 && pk.predictedLinks >= 10 && pk.topScore > 0 && pk.clusters >= 1 && pk.warmPaths >= 1, `status=${pred.status} ${JSON.stringify(pk)}`);
    ok('predict rows', Array.isArray(pred.json?.predictedLinks) && pred.json.predictedLinks.length >= 1 && Array.isArray(pred.json?.clusters) && Array.isArray(pred.json?.warmPaths), `links=${pred.json?.predictedLinks?.length} clusters=${pred.json?.clusters?.length} warm=${pred.json?.warmPaths?.length}`);

    // ---- P3-4 board ----
    const board = await api('/board/overview', { token: TOK });
    const bk = board.json?.kpis || {};
    ok('board KPIs', board.status === 200 && bk.portfolioCapital > 0 && bk.roi > 0 && bk.revenueAtRisk > 0 && (bk.singlePointPeople ?? 0) >= 1 && bk.avgHealth > 0, `status=${board.status} ${JSON.stringify(bk)}`);
    ok('board ROI rows', Array.isArray(board.json?.rows) && board.json.rows.length >= 1 && Array.isArray(board.json?.singlePeople) && board.json.singlePeople.length >= 1, `rows=${board.json?.rows?.length} sp=${board.json?.singlePeople?.length}`);

    // ---- unknown route must NOT crash ----
    const nope = await api('/nonexistent/deep/path', { token: TOK });
    ok('unknown -> 404 JSON', nope.status === 404 && typeof nope.json?.message === 'string', `status=${nope.status} ${JSON.stringify(nope.json).slice(0, 90)}`);
    const after = await api('/health');
    ok('server alive after 404', after.status === 200 && after.json?.status === 'ok', `status=${after.status}`);
  } finally {
    kill();
  }

  console.log(`\nSUMMARY pass=${pass} fail=${fail}`);
  if (fails.length) {
    console.log('FAILURES:');
    for (const f of fails) console.log(' -', f);
  }
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
