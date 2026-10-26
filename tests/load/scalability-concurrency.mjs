#!/usr/bin/env node
/**
 * Staging-only scalability gate. Requires a real populated environment.
 * It deliberately exercises bounded server-side paths; it never downloads a full graph/table.
 */
const base = process.env.API_URL || 'http://127.0.0.1:4000/api/v1';
const token = process.env.PERF_AUTH_TOKEN;
const org = process.env.PERF_ORGANIZATION_ID || '';
const concurrency = Number(process.env.SCALABILITY_CONCURRENCY || 20);
const rounds = Number(process.env.SCALABILITY_ROUNDS || 10);
if (!token) throw new Error('PERF_AUTH_TOKEN is required');
const headers = { Authorization: `Bearer ${token}` };
const paths = [
  `/network/graph?organizationId=${encodeURIComponent(org)}&limit=250`,
  `/search?q=bank&limit=100${org ? `&organizationId=${encodeURIComponent(org)}` : ''}`,
  `/reports/company${org ? `?organizationId=${encodeURIComponent(org)}` : ''}`,
];
const samples = [];
let failures = 0;
async function hit(path) {
  const started = performance.now();
  try {
    const response = await fetch(`${base}${path}`, { headers });
    await response.arrayBuffer();
    if (!response.ok) failures++;
  } catch { failures++; }
  samples.push(performance.now() - started);
}
for (let round = 0; round < rounds; round++) {
  const work = [];
  for (let i = 0; i < concurrency; i++) work.push(hit(paths[i % paths.length]));
  await Promise.all(work);
}
samples.sort((a, b) => a - b);
const pct = p => samples[Math.min(samples.length - 1, Math.floor((samples.length - 1) * p))];
const result = {
  requests: samples.length,
  concurrency,
  rounds,
  failures,
  p50Ms: Number(pct(.50).toFixed(2)),
  p95Ms: Number(pct(.95).toFixed(2)),
  p99Ms: Number(pct(.99).toFixed(2)),
  boundedGraphLimit: 250,
  boundedSearchLimit: 100,
  pass: failures === 0,
};
console.log(JSON.stringify(result, null, 2));
process.exit(failures ? 1 : 0);
