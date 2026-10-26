
/**
 * S3-compatible storage integration probe.
 * Requires S3_TEST_ENDPOINT, S3_TEST_BUCKET, S3_TEST_ACCESS_KEY,
 * S3_TEST_SECRET_KEY and a pre-created bucket. Uses curl so no SDK is
 * added to the production dependency graph.
 */
const endpoint = process.env.S3_TEST_ENDPOINT;
const bucket = process.env.S3_TEST_BUCKET;
const access = process.env.S3_TEST_ACCESS_KEY;
const secret = process.env.S3_TEST_SECRET_KEY;

if (!endpoint || !bucket || !access || !secret) {
  console.log(JSON.stringify({ status: 'SKIP', reason: 'S3 test credentials not configured' }));
  process.exit(0);
}

const { spawnSync } = await import('node:child_process');
const payload = Buffer.from(`srip-storage-test-${Date.now()}`);
const key = `integration/${Date.now()}.txt`;
const target = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;

const put = spawnSync('curl', ['-fsS', '-u', `${access}:${secret}`, '-X', 'PUT', '--data-binary', payload, target], { encoding: 'utf8' });
if (put.status !== 0) { console.error(put.stderr); process.exit(1); }

const get = spawnSync('curl', ['-fsS', '-u', `${access}:${secret}`, target], { encoding: 'buffer' });
if (get.status !== 0 || !Buffer.from(get.stdout).equals(payload)) process.exit(1);

const del = spawnSync('curl', ['-fsS', '-u', `${access}:${secret}`, '-X', 'DELETE', target], { encoding: 'utf8' });
if (del.status !== 0) process.exit(1);

console.log(JSON.stringify({ status: 'PASS', key }));
