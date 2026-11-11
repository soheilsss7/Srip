import fs from 'node:fs';
import {PublicProxyTransport} from './proxy-transport.mjs';
import {loadPublicTunnelCatalog,publicTunnelManifest} from './public-tunnel-catalog.mjs';
import {UserTunnelManager,clientArchive} from './user-tunnel-manager.mjs';
import {readUserTunnelHints,prioritizeUserCandidates} from './user-tunnel-scheduling.mjs';
export const userTunnelFile=publicTunnelManifest;
export function rotatingUserCandidates(candidates,cursor,max=8){
 if(!candidates.length)return [];const offset=(Number.isInteger(cursor)&&cursor>=0?cursor:0)%candidates.length;
 return Array.from({length:Math.min(max,candidates.length)},(_,i)=>({candidate:candidates[(offset+i)%candidates.length],nextCursor:(offset+i+1)%candidates.length}));
}
export async function createRotatingProxyTransport(options){
 const pool=await new PublicProxyTransport(options).initialize();
 if(!fs.existsSync(userTunnelFile)||process.env.USER_PUBLIC_TUNNELS==='0')return pool;
 const catalog=loadPublicTunnelCatalog(userTunnelFile);
 pool.report.userTunnels={enabled:true,source:userTunnelFile,sources:catalog.sources,total:catalog.total,accepted:catalog.accepted.length,rejected:catalog.rejected,duplicates:catalog.duplicates,rotation:'up to eight configurations attempted per run; persistent cursor advances on attempt; shared four-page observed-IP budget',clientSHA256:clientArchive.sha256};
 pool.state.userTunnels ||= {cursor:0};
 const hints=readUserTunnelHints(pool.out);const selection=prioritizeUserCandidates(rotatingUserCandidates(catalog.accepted,pool.state.userTunnels.cursor,catalog.accepted.length),{health:pool.state.endpointHealth,hints,available:ip=>pool.available(ip),now:pool.now()});pool.report.userTunnels.scheduling='profile-success first, healthy second, untested then expired failures; exhausted observed exits revalidated no more than hourly';
 const manager=new UserTunnelManager({scratch:pool.scratch,env:pool.env,maxClients:8});let prepared;
 pool.resolveCandidate=async candidate=>{
  if(!candidate.userTunnel)return candidate;
  pool.state.userTunnels.cursor=candidate.nextCursor;pool.save();
  prepared ||= manager.prepare();await prepared;return manager.start(candidate.userTunnel);
 };
 const originalClose=pool.close.bind(pool);pool.close=()=>{manager.close();originalClose();};
 pool.candidates=[...selection.map(({candidate,nextCursor})=>({url:`user-tunnel:${candidate.id}`,userTunnel:candidate,nextCursor})),...pool.candidates].slice(0,pool.maxChecks);
 pool.report.userTunnels.selected=selection.map(({candidate})=>({id:candidate.id.slice(0,16),line:candidate.line,protocol:candidate.outbound.protocol}));pool.report.candidateCount=pool.candidates.length;pool.save();await pool.warmup({concurrency:3});return pool;
}
