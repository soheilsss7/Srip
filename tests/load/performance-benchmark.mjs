/**
 * PHASE AL backend performance benchmark.
 * Measures P50/P95/P99 for the requested read paths.
 * Requires a running API and an authenticated token; no mocks are used.
 *
 * Required: API_URL, PERF_AUTH_TOKEN
 * Optional: PERF_CONCURRENCY=10 PERF_REQUESTS=100 PERF_ORGANIZATION_ID=...
 * Optional route overrides: PERF_ORG_PATH, PERF_PEOPLE_PATH, PERF_RELATIONSHIPS_PATH,
 * PERF_RELATIONSHIP_DETAIL_PATH, PERF_SEARCH_PATH, PERF_NETWORK_PATH,
 * PERF_DASHBOARD_PATH, PERF_REPORT_PATH
 */
const base = (process.env.API_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const token = process.env.PERF_AUTH_TOKEN;
if (!token) { console.error('PERF_AUTH_TOKEN is required'); process.exit(2); }
const concurrency = Math.max(1, Number(process.env.PERF_CONCURRENCY || 10));
const requests = Math.max(1, Number(process.env.PERF_REQUESTS || 100));
const orgId = process.env.PERF_ORGANIZATION_ID;
const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
const routes = [
  ['organization-list', process.env.PERF_ORG_PATH || `/organizations${query}`],
  ['people-list', process.env.PERF_PEOPLE_PATH || `/people${query}`],
  ['relationship-list', process.env.PERF_RELATIONSHIPS_PATH || `/relationships${query}`],
  ['relationship-detail', process.env.PERF_RELATIONSHIP_DETAIL_PATH || `/relationships/${process.env.PERF_RELATIONSHIP_ID || 'REQUIRED'}`],
  ['search', process.env.PERF_SEARCH_PATH || '/search?q=bank&limit=20'],
  ['network', process.env.PERF_NETWORK_PATH || `/network/graph${query}`],
  ['dashboard-metrics', process.env.PERF_DASHBOARD_PATH || '/analytics/summary'],
  ['reporting', process.env.PERF_REPORT_PATH || `/reports/executive-summary${query}`],
];
const percentile = (xs,p) => xs[Math.min(xs.length-1, Math.max(0, Math.ceil(xs.length*p)-1))];
async function run(name,path) {
  if (path.includes('/REQUIRED')) return {name, skipped:true, reason:'set PERF_RELATIONSHIP_ID'};
  const samples=[]; let failures=0, cursor=0;
  async function worker(){ while(true){ const i=cursor++; if(i>=requests)return; const t=performance.now(); try { const r=await fetch(`${base}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}}); if(!r.ok) failures++; } catch { failures++; } samples.push(performance.now()-t); }}
  await Promise.all(Array.from({length:Math.min(concurrency,requests)},worker));
  samples.sort((a,b)=>a-b);
  const result={name,path,requests,concurrency,failures,p50Ms:Number(percentile(samples,.50).toFixed(2)),p95Ms:Number(percentile(samples,.95).toFixed(2)),p99Ms:Number(percentile(samples,.99).toFixed(2))};
  result.targetMs=name==='search'?1000:500; result.pass=failures===0 && result.p95Ms<result.targetMs; return result;
}
const results=[]; for(const [name,path] of routes) results.push(await run(name,path));
const runnable=results.filter(x=>!x.skipped); const pass=runnable.length>0 && runnable.every(x=>x.pass);
console.log(JSON.stringify({phase:'AL',target:{apiP95Ms:500,searchP95Ms:1000},results,pass},null,2));
process.exit(pass?0:1);
