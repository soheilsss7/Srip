#!/usr/bin/env node
const base=process.env.API_URL||'http://127.0.0.1:4000/api/v1';
const token=process.env.PERF_AUTH_TOKEN;
const org=process.env.PERF_ORGANIZATION_ID;
const requests=Number(process.env.SCALABILITY_REQUESTS||20);
if(!token) throw new Error('PERF_AUTH_TOKEN is required');
const headers={Authorization:`Bearer ${token}`};
const samples=[];
async function hit(path){const t=performance.now(); const r=await fetch(`${base}${path}`,{headers}); if(!r.ok) throw new Error(`${r.status} ${path}`); await r.arrayBuffer(); return performance.now()-t;}
const paths=[`/network/graph?organizationId=${encodeURIComponent(org||'')}&limit=250`,`/search?q=bank&limit=100${org?`&organizationId=${encodeURIComponent(org)}`:''}`,`/reports/company${org?`?organizationId=${encodeURIComponent(org)}`:''}`];
for(let i=0;i<requests;i++) for(const p of paths) samples.push(await hit(p));
samples.sort((a,b)=>a-b); const pct=p=>samples[Math.min(samples.length-1,Math.floor(samples.length*p))];
console.log(JSON.stringify({requests, samples:samples.length,p50:Math.round(pct(.50)),p95:Math.round(pct(.95)),p99:Math.round(pct(.99))},null,2));
