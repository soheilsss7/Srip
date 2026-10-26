
/**
 * IDOR runtime matrix.
 * Requires two test users with separate organization scopes.
 *
 * Usage:
 *   API_URL=... USER_A_TOKEN=... USER_B_TOKEN=... RESOURCE_ID=... \
 *   node tests/security/idor-matrix.mjs
 *
 * The matrix intentionally fails closed: a protected resource returning 2xx
 * to an unrelated user's token is a failure.
 */
const base = process.env.API_URL || 'http://127.0.0.1:4000/api/v1';
const tokenA = process.env.USER_A_TOKEN;
const tokenB = process.env.USER_B_TOKEN;
const resourceId = process.env.RESOURCE_ID;

if (!tokenA || !tokenB || !resourceId) {
  console.error('Missing USER_A_TOKEN, USER_B_TOKEN or RESOURCE_ID');
  process.exit(2);
}

async function request(token) {
  const r = await fetch(`${base}/people/${encodeURIComponent(resourceId)}`, {
    headers: { authorization: `Bearer ${token}`, 'x-request-id': crypto.randomUUID() },
  });
  return { status: r.status, body: await r.text() };
}

const own = await request(tokenA);
const foreign = await request(tokenB);

if (own.status >= 500 || foreign.status >= 500) {
  console.error(JSON.stringify({ own, foreign }, null, 2));
  process.exit(1);
}

if (foreign.status >= 200 && foreign.status < 300) {
  console.error('IDOR FAILURE: foreign principal accessed protected resource');
  process.exit(1);
}

console.log(JSON.stringify({ ownStatus: own.status, foreignStatus: foreign.status, result: 'PASS' }, null, 2));
