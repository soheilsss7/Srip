/**
 * SRIP static-demo Service Worker harness.
 *
 * Verifies the Service Worker generated from the mock (docs/srip2/sw.js, built
 * by scripts/release-ux.sh → scripts/make-demo-sw.mjs) behaves like the Node
 * mock: same demo routes, same 404-without-crash behavior, version handshake.
 * Catches regressions in the make-demo-sw transformation (e.g. the 404-inside-
 * try layout that once produced a syntactically broken sw.js).
 *
 * Self-contained: spawns a fresh mock on a dedicated port (auth token source;
 * the SW verifies the same demo JWT itself), loads sw.js into a VM sandbox and
 * drives it like a browser fetch.
 *
 * Usage: node tests/e2e/sw-demo-harness.mjs [--sw path/to/sw.js] [--port 4572]
 * Exit code 0 = all green.
 */
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const swIdx = process.argv.indexOf('--sw');
const SW_PATH = (swIdx >= 0 ? process.argv[swIdx + 1] : '') || join(repoRoot, 'docs', 'srip2', 'sw.js');
const portIdx = process.argv.indexOf('--port');
const PORT = String(portIdx >= 0 ? process.argv[portIdx + 1] : 4572);
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`OK   ${name}`); }
  else { fail++; fails.push(`${name} :: ${detail}`); console.log(`FAIL ${name} -> ${detail}`); }
};

const waitHealth = async (timeoutMs = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
};

async function main() {
  const mockPath = join(repoRoot, 'apps', 'web-ux', 'scripts', 'mock-api.mjs');
  const server = spawn(process.execPath, [mockPath, '--reset'], {
    cwd: join(repoRoot, 'apps', 'web-ux'),
    env: { ...process.env, MOCK_API_PORT: PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', () => {});
  const kill = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill('SIGKILL'); } catch {} } };
  process.on('exit', kill);

  try {
    const health = await waitHealth();
    ok('mock health up', !!health, 'mock did not start');
    if (!health) return;

    if (!fs.existsSync(SW_PATH)) {
      ok(`sw.js exists at ${SW_PATH}`, false, 'run scripts/release-ux.sh first');
      return;
    }
    const code = fs.readFileSync(SW_PATH, 'utf8');
    const sandbox = {
      console, TextEncoder, TextDecoder, URL, crypto: globalThis.crypto,
      Response: class { constructor(b, i = {}) { this.body = b ?? null; this.status = i.status ?? 200; this.headers = new Map(Object.entries(i.headers ?? {})); this.ok = this.status < 300; } async text() { return this.body ?? ''; } async json() { return JSON.parse(this.body ?? 'null'); } },
      Request: class {}, location: { origin: 'https://soheilsss7.github.io' },
      self: { addEventListener() {}, skipWaiting() {}, registration: { scope: '/Srip/srip2/' } },
      addEventListener() {}, skipWaiting() {}, clients: { claim: () => Promise.resolve() }, event: {},
      setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean, RegExp, Map, Set, Error,
      encodeURIComponent, decodeURIComponent, atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    try { vm.runInContext(code, sandbox, { filename: 'sw.js' }); }
    catch (e) { ok('sw.js parses & boots', false, String(e?.message ?? e)); return; }

    const tok = execSync(
      `curl -s -X POST ${BASE}/auth/login -H 'Content-Type: application/json' -d '{"username":"demo","password":"123456","otp":"123456"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])'`
    ).toString().trim();
    ok('login token', tok.length > 10, `token=${tok.slice(0, 8)}`);

    const call = async (p, method = 'GET', body = '') => {
      const req = { method, url: 'https://soheilsss7.github.io/Srip/srip2/api/v1' + p, headers: new Map([['authorization', 'Bearer ' + tok], ['content-type', 'application/json']]), socket: { remoteAddress: '127.0.0.1' }, text: async () => body };
      const res = await sandbox.__swHandle(req);
      const t = await res.text();
      return { status: res.status, body: (() => { try { return JSON.parse(t); } catch { return t; } })() };
    };

    const checks = [
      ['/health', 200, (d) => d.mockVersion === '2026.09.06.4'],
      ['/knowledge', 200, (d) => d.items?.length === 12],
      ['/relationships/capital', 200, (d) => d.items?.length === 6],
      ['/relationships/r-4/pulse', 200, (d) => !!d.trend && !!d.capital],
      ['/relationships/r-4/pulse-survey', 200, (d) => d.questions?.length === 3],
      ['/intelligence/nba', 200, (d) => d.items?.length >= 5],
      ['/intelligence/risk-leverage', 200, (d) => d.kpis?.totalRevenueAtRisk > 0],
      ['/network/sna', 200, (d) => d.kpis?.densityOrg > 0 && d.structuralHoles?.length >= 1],
      ['/network/path?from=org-2&to=org-7&mode=best&maxHops=3', 200, (d) => d.found && d.hops === 2 && d.score === 80],
      ['/meetings/m-1/intel', 200, (d) => ['POSITIVE', 'NEUTRAL', 'CONCERNED'].includes(d.tone)],
      ['/governance/compliance', 200, (d) => d.kpis?.organizations === 8 && d.kpis?.uboCoverage === 100],
      ['/network/predict', 200, (d) => d.kpis?.predictedLinks >= 20 && d.kpis?.clusters === 2],
      ['/board/overview', 200, (d) => d.kpis?.portfolioCapital > 100 && d.kpis?.roi > 0],
      ['/intelligence/knowledge-transfer?relationshipId=r-2', 200, (d) => d.contacts?.length === 3 && !!d.brief],
      ['/nonexistent/deep/path', 404, (d) => typeof d.message === 'string'],
    ];
    for (const [p, want, pred] of checks) {
      const r = await call(p);
      ok(`${p} -> ${want}`, r.status === want && pred(r.body), JSON.stringify(r.body).slice(0, 120));
    }
    const post = await call('/intelligence/knowledge-transfer/r-2/handoff', 'POST', JSON.stringify({ toPersonId: 'p-9' }));
    ok('handoff -> 200', post.status === 200 && post.body?.ok, JSON.stringify(post.body).slice(0, 120));
    const dup = await call('/intelligence/knowledge-transfer/r-2/handoff', 'POST', JSON.stringify({ toPersonId: 'p-9' }));
    ok('handoff duplicate -> 409', dup.status === 409, `status=${dup.status}`);
    const screen = await call('/governance/compliance/screen', 'POST', '{}');
    ok('compliance screen -> 200', screen.status === 200 && screen.body?.ok, JSON.stringify(screen.body).slice(0, 120));
    const decide = await call('/governance/compliance/org-6/decide', 'POST', JSON.stringify({ decision: 'ESCALATED', rationale: 'x' }));
    ok('compliance decide -> 200', decide.status === 200 && decide.body?.ok, JSON.stringify(decide.body).slice(0, 120));
  } finally {
    kill();
  }

  console.log(`\nSW SUMMARY pass=${pass} fail=${fail}`);
  if (fails.length) { for (const f of fails) console.log(' -', f); }
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
