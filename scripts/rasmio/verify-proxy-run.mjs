// Independent Git readback: never treats a nonempty record as a complete profile.
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {recordTransportErrors} from './readback-transport.mjs';
const [beforeArg,afterArg,runId]=process.argv.slice(2);
if(!beforeArg||!afterArg||!/^\d+$/.test(runId||''))throw new Error('Usage: node verify-proxy-run.mjs BEFORE AFTER RUN_ID');
const before=execFileSync('git',['rev-parse',beforeArg],{encoding:'utf8'}).trim();
const after=execFileSync('git',['rev-parse',afterArg],{encoding:'utf8'}).trim();
const read=(ref,file)=>execFileSync('git',['show',`${ref}:scripts/rasmio/${file}`],{encoding:'utf8',maxBuffer:256*1024*1024,stdio:['ignore','pipe','ignore']});
const hasData=x=>!!(x?.rows?.length||x?.tables?.some(t=>t.rows?.length));
const pool=JSON.parse(read(after,`out/proxy-transport-${runId}.json`));
const frontier=JSON.parse(read(after,'frontier.json'));
let receipts=[];try{receipts=read(after,`out/verified-data-${runId}.jsonl`).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{}
let networkRequests=[];try{networkRequests=read(after,`out/network-audit-${runId}.jsonl`).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{}
const records=receipts.map(r=>{
 const raw=read(after,r.file),x=JSON.parse(raw);let old=null;try{old=JSON.parse(read(before,r.file));}catch{}
 const errors=[];const check=(v,msg)=>{if(!v)errors.push(msg);};
 check(crypto.createHash('sha256').update(raw).digest('hex')===r.sha256,'SHA mismatch');
 check(`${x.type}:${x.id}`===r.key,'ID mismatch');check(x.sourceRun===runId,'sourceRun mismatch');check(x.tableSchemaVersion===2,'schema mismatch');check(hasData(x),'empty record');
 errors.push(...recordTransportErrors(x,pool,networkRequests));
 check(x.profileCoverage?.status==='unverified','unproven completeness claim');
 
 if(x.type==='company')check(String(x.info?.['شناسه ملی'])===x.id,'national ID mismatch');
 for(const t of x.tables||[])for(const row of t.rows||[])check(Array.isArray(row)&&row.length===t.columns.length,'table column width mismatch');
 return {key:r.key,name:x.name,baseline:!old?'missing':hasData(old)?'nonempty':'empty',tables:x.tables?.length||0,tableRows:(x.tables||[]).reduce((n,t)=>n+t.rows.length,0),linkedRows:x.rows.length,infoKeys:Object.keys(x.info||{}),sha256:r.sha256,proxy:x.egress?.proxy,observedExitIP:x.egress?.observedExitIP,coverage:x.profileCoverage,errors};
});
const pending=new Set(frontier.pending.map(e=>`${e.type}:${e.id}`));
const failed=pool.outcomes.filter(o=>!o.success).map(o=>({key:o.key,reason:o.reason,pending:pending.has(o.key),notCompleted:!frontier.visited[o.key]}));
const budgetViolations=pool.requests.filter(r=>!(r.exitWindowRequest>=1&&r.exitWindowRequest<=4));
const errors=[...records.flatMap(r=>r.errors.map(e=>`${r.key}: ${e}`)),...failed.filter(f=>!f.pending||!f.notCompleted).map(f=>`${f.key}: failed request lost from pending`),...budgetViolations.map(r=>`${r.key}: budget violation`)];
const report={runId,before,after,checkedAt:new Date().toISOString(),directFallback:pool.directFallback,candidateChecks:pool.health.length,verifiedEchoIPs:[...new Set(pool.health.filter(h=>h.outcome==='https-echo-verified').map(h=>h.observedExitIP))],records,failed,newlyNonempty:records.filter(r=>r.baseline!=='nonempty').length,tableRows:records.reduce((n,r)=>n+r.tableRows,0),errors,globalCompletionVerified:false};
console.log(JSON.stringify(report,null,2));if(errors.length||pool.directFallback!==false)process.exitCode=1;
