
/**
 * Dependency-free API load smoke test.
 * Defaults are intentionally conservative. This is a smoke/load baseline,
 * not a replacement for k6/Gatling/Locust capacity testing.
 */
const base = process.env.API_URL || 'http://127.0.0.1:4000/api/v1';
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
const requests = Number(process.env.LOAD_REQUESTS || 200);

const samples = [];
let failures = 0;
let cursor = 0;

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= requests) return;
    const started = performance.now();
    try {
      const r = await fetch(`${base}/health/live`);
      if (!r.ok) failures++;
    } catch { failures++; }
    samples.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
samples.sort((a,b)=>a-b);
const percentile = p => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
const result = {
  requests, concurrency, failures,
  p50Ms: Number(percentile(.50).toFixed(2)),
  p95Ms: Number(percentile(.95).toFixed(2)),
  p99Ms: Number(percentile(.99).toFixed(2)),
  pass: failures === 0
};
console.log(JSON.stringify(result, null, 2));
process.exit(failures ? 1 : 0);
