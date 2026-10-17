
/**
 * Safe OWASP ASVS runtime smoke verification.
 * This is not a substitute for a professional penetration test.
 */
const base = process.env.API_URL || 'http://127.0.0.1:4000/api/v1';
const results = [];

async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); }
  catch (e) { results.push({ name, status: 'FAIL', error: String(e) }); }
}

await check('health-live', async () => {
  const r = await fetch(`${base}/health/live`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
});

await check('request-id-contract', async () => {
  const id = crypto.randomUUID();
  const r = await fetch(`${base}/health/live`, { headers: { 'x-request-id': id } });
  if (r.headers.get('x-request-id') !== id) throw new Error('request id not propagated');
});

await check('security-headers', async () => {
  const r = await fetch(`${base}/health/live`);
  for (const h of ['x-content-type-options', 'x-frame-options', 'referrer-policy']) {
    if (!r.headers.get(h)) throw new Error(`missing ${h}`);
  }
});

await check('protected-endpoint-requires-auth', async () => {
  const r = await fetch(`${base}/people`);
  if (![401, 403].includes(r.status)) throw new Error(`expected 401/403, got ${r.status}`);
});

await check('error-does-not-leak-stack', async () => {
  const r = await fetch(`${base}/people/does-not-exist`);
  const body = await r.text();
  if (/at\s+\w+\s+\(|node_modules|stack trace/i.test(body)) throw new Error('stack trace leakage');
});

const failed = results.filter(x => x.status === 'FAIL');
console.log(JSON.stringify({ results, passed: results.length - failed.length, failed: failed.length }, null, 2));
process.exit(failed.length ? 1 : 0);
