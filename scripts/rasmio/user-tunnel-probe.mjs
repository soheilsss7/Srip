import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {isIP} from 'node:net';
import {loadPublicTunnelCatalog,publicTunnelManifest} from './public-tunnel-catalog.mjs';import {UserTunnelManager,clientArchive} from './user-tunnel-manager.mjs';import {userTunnelFile} from './rotating-proxy-transport.mjs';import {transportCurlArgs} from './proxy-transport.mjs';
const execute=promisify(execFile);
export async function runUserTunnelProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,''),file=`out/user-tunnel-probe-${runId}.json`,files=[file];fs.mkdirSync('out',{recursive:true});
 const catalog=loadPublicTunnelCatalog(userTunnelFile),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'user-public-tunnel-probe-'));const manager=new UserTunnelManager({scratch,maxClients:3});
 const report={runId,startedAt:new Date().toISOString(),mode:'user-tunnel-probe',source:userTunnelFile,sources:catalog.sources,total:catalog.total,accepted:catalog.accepted.length,rejected:catalog.rejected,duplicates:catalog.duplicates,clientSHA256:clientArchive.sha256,attempts:[],verifiedProfiles:[],canonicalRecordsChanged:false,fullCoverageVerified:false,healthOnly:true,originProfilesRequested:0};
 let candidates=catalog.accepted;
 let payload={};try{payload=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).client_payload||{};}catch{}
 if(payload.retryAfterCapacityRun!==undefined){
  const previousRun=String(payload.retryAfterCapacityRun);if(!/^\d+$/.test(previousRun))throw new Error('Invalid retry reference');
  const previous=JSON.parse(fs.readFileSync(`out/user-tunnel-probe-${previousRun}.json`,'utf8'));
  if(previous.source!==userTunnelFile||previous.clientSHA256!==clientArchive.sha256)throw new Error('Retry source mismatch');
  const ids=new Set(previous.attempts.filter(a=>a.reason==='echo-or-tunnel-transport-failed'&&Date.parse(a.finishedAt)-Date.parse(a.startedAt)<25).map(a=>a.id));
  candidates=catalog.accepted.filter(c=>ids.has(c.id.slice(0,16)));report.retryAfterCapacityRun=previousRun;report.scope='Only prior near-instant unassessed failures after correcting local client-capacity accounting';
 }
 report.selectedConfigurations=candidates.length;
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));save();
 try{
  await manager.prepare();report.clientChecksumVerified=true;let index=0,refused=false;
  await Promise.all(Array.from({length:3},async()=>{while(index<candidates.length&&!refused){
   const c=candidates[index++],attempt={id:c.id.slice(0,16),line:c.line,sourceFile:c.sourceFile,protocol:c.outbound.protocol,startedAt:new Date().toISOString()};report.attempts.push(attempt);save();
   try{
    const endpoint=await manager.start(c);
    const {stdout}=await execute('curl',[...transportCurlArgs(endpoint.url,'https://api.ipify.org/?format=json',{trustedLocal:true}).filter(x=>x!=='--fail'),'--write-out','\n__USER_HEALTH__%{http_code}'],{env:manager.env,timeout:14000,maxBuffer:10000});
    const split=stdout.lastIndexOf('\n__USER_HEALTH__'),status=Number(stdout.slice(split+16));attempt.status=status;
    if([401,403,429].includes(status)){refused=true;throw Error('echo-provider-refused');}
    if(split<0||status!==200)throw Error('echo-not-200');
    let ip;try{ip=JSON.parse(stdout.slice(0,split)).ip;}catch{throw Error('invalid-echo-json');}if(!isIP(ip))throw Error('invalid-echo-ip');attempt.observedExitIP=ip;attempt.outcome='https-echo-verified';
   }catch(error){attempt.outcome='failed';attempt.reason=['tunnel-client-capacity','tunnel-dns-failed','tunnel-public-ipv4-required','tunnel-client-config-rejected','tunnel-client-exited','tunnel-listener-timeout','echo-provider-refused','echo-not-200','invalid-echo-json','invalid-echo-ip'].includes(error.message)?error.message:'echo-or-tunnel-transport-failed';}
   finally{manager.stop(c.id);attempt.finishedAt=new Date().toISOString();save();}
  }}));
  report.echoProviderRefused=refused;report.verifiedConfigurations=report.attempts.filter(a=>a.outcome==='https-echo-verified').length;report.verifiedIndependentExitIPs=[...new Set(report.attempts.map(a=>a.observedExitIP).filter(Boolean))];
 }catch{report.error='tunnel-client-install-or-probe-failed';}
 finally{manager.close();fs.rmSync(scratch,{recursive:true,force:true});report.finishedAt=new Date().toISOString();save();}
 return {files,report};
}
