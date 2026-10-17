/* ============================================================================
   make-demo-sw.mjs — converts scripts/mock-api.mjs (Node HTTP server) into a
   browser Service Worker (public/sw.js) that answers /api/v1/* requests with
   the same deterministic in-memory demo data. Used by the static GitHub Pages
   build (SRIP_PAGES=1) so the whole product runs with zero backend.
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockPath = path.join(__dirname, 'mock-api.mjs');
const outPath = path.join(__dirname, '..', 'public', 'sw.js');

let src = fs.readFileSync(mockPath, 'utf8');
const lines = src.split('\n');
const find = (sub, from = 0) => lines.findIndex((l, i) => i >= from && l.includes(sub));
const assert = (idx, what) => { if (idx < 0) throw new Error(`anchor not found: ${what}`); };

/* 1) node:http / node:crypto imports -> browser crypto shim */
{
  const a = find("import http from 'node:http';");
  assert(a, 'import http');
  const b = find("import crypto from 'node:crypto';", a);
  assert(b, 'import crypto');
  lines.splice(a, b - a + 1,
    '/* Service-Worker-safe shims (replaces node built-ins) */',
    'const crypto = {',
    "  randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => '0123456789abcdef'[Math.floor(Math.random() * 16)]),",
    "  randomBytes: () => ({ toString: (enc) => (enc === 'hex' ? 'ab'.repeat(16) : '') }),",
    '};',
  );
}

/* 2) drop PORT (server only) */
{
  const p = find('const PORT = Number(process.env.MOCK_API_PORT');
  assert(p, 'PORT');
  lines.splice(p, 1);
}

/* 3) node:fs/path block + JWT/HMAC/password helpers -> browser-safe versions */
{
  const a = find("import fs from 'node:fs';");
  assert(a, 'import fs');
  const b = find('function saveDb() {');
  assert(b, 'saveDb');
  lines.splice(a, b - a,
    "const DATA_DIR = '.data';",
    "const DB_FILE = 'srip-db.json';",
    "const SECRET_FILE = 'jwt-secret';",
    '',
    'const b64url = (input) => {',
    "  let s = '';",
    '  if (typeof input === \'string\') input = new TextEncoder().encode(input);',
    '  for (const b of input) s += String.fromCharCode(b);',
    "  return btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');",
    '};',
    'const b64urlDecode = (s) => {',
    "  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);",
    '  const bin = atob(b64);',
    '  const bytes = new Uint8Array(bin.length);',
    '  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);',
    '  return {',
    "    toString: (enc) => (enc === 'hex' ? Array.from(bytes).map((x) => x.toString(16).padStart(2, '0')).join('') : new TextDecoder().decode(bytes)),",
    '  };',
    '};',
    "const JWT_SECRET = 'demo-static-srip-secret';",
    'const ACCESS_TTL = 15 * 60;',
    'const REFRESH_TTL = 7 * 24 * 3600;',
    '',
    'function signJwt(payload, ttl) {',
    "  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));",
    '  const now = Math.floor(Date.now() / 1000);',
    '  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl, jti: crypto.randomUUID() }));',
    '  return `${h}.${body}.demo`;',
    '}',
    'function verifyJwt(token) {',
    '  try {',
    "    const parts = String(token ?? '').split('.');",
    '    if (parts.length !== 3) return null;',
    '    const payload = JSON.parse(b64urlDecode(parts[1]).toString(\'utf8\'));',
    "    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;",
    '    if (DB?.revokedJtis?.includes(payload.jti)) return null;',
    '    return payload;',
    '  } catch { return null; }',
    '}',
    "function hashPassword(pw, salt) { return 'h$' + salt + '$' + String(pw); }",
    'function verifyPassword(pw, salt, hash) { return hashPassword(pw, salt) === hash; }',
  );
}

/* 4) saveDb -> in-memory no-op */
{
  const s = find('function saveDb() {');
  assert(s, 'saveDb fn');
  lines.splice(s, 1, 'function saveDb() {}');
}

/* 5) loadDb: drop fs persistence, keep in-memory seed */
{
  const a = find("if (process.argv.includes('--reset'))");
  assert(a, 'loadDb reset');
  const b = find('} catch { DB = null; }', a);
  assert(b, 'loadDb catch');
  lines.splice(a, b - a + 1);
}

/* 6) readBody -> pre-read text (Service Worker has no streams) */
{
  const a = find('const readBody=(req)=>new Promise');
  assert(a, 'readBody');
  const b = find("req.on('end',", a);
  assert(b, 'readBody end');
  const c = b + 1; // closing '});' line
  lines.splice(a, c - a + 1,
    "let __bodyText = '';",
    'const readBody = () => Promise.resolve(__bodyText ? JSON.parse(__bodyText) : {});',
  );
}

/* 7) server handler -> plain async function */
{
  const a = find('const server=http.createServer(async(req,res)=>{');
  assert(a, 'createServer');
  lines[a] = 'async function __handler(req, res) {';
}

/* 8) tail: close handler + Service Worker glue */
{
  const a = find('در Mock API وجود ندارد');
  assert(a, '404 tail');
  const tail = [
    "  json(res,404,{message:`مسیر ${method} ${path} در Mock API وجود ندارد.`});",
    '}',
    '',
    'loadDb();',
    'USERS = DB.users;',
    '',
    '/* ---------------- Service Worker glue (static GitHub Pages demo) ---------------- */',
    "self.addEventListener('install', () => self.skipWaiting());",
    "self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));",
    "self.addEventListener('fetch', (event) => {",
    '  const reqUrl = new URL(event.request.url);',
    "  if (reqUrl.origin !== location.origin || !reqUrl.pathname.includes('/api/v1')) return;",
    '  event.respondWith(__swHandle(event.request));',
    '});',
    'async function __swHandle(request) {',
    '  const url = new URL(request.url);',
    "  let path = url.pathname.replace(/\\/+$/, '') || '/';",
    "  const apiIdx = path.indexOf('/api/v1');",
    '  if (apiIdx > 0) path = path.slice(apiIdx); // strip basePath (e.g. /Srip)',
    '  const headers = {};',
    '  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;',
    '  const req = { method: request.method, url: path + url.search, headers, socket: { remoteAddress: \'127.0.0.1\' } };',
    "  __bodyText = await request.text().catch(() => '');",
    '  let __status = 200, __headers = {}, __body = null;',
    '  const res = {',
    '    setHeader() {},',
    '    writeHead(code, h) { __status = code; if (h) __headers = { ...h }; },',
    '    end(b) { if (b !== undefined) __body = b; },',
    '  };',
    '  try { await __handler(req, res); }',
    '  catch (e) { __status = 500; __body = JSON.stringify({ message: \'mock error: \' + String((e && e.message) || e) }); }',
    '  const headersOut = { ...__headers };',
    "  if (__body && !headersOut['Content-Type']) headersOut['Content-Type'] = 'application/json; charset=utf-8';",
    '  return new Response(__body, { status: __status, headers: headersOut });',
    '}',
    '',
  ];
  lines.splice(a, lines.length - a, ...tail);
}

src = lines.join('\n');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, src);
console.log(`[make-demo-sw] wrote ${outPath} (${src.length} bytes, ${lines.length} lines)`);
