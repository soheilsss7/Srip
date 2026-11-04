import fs from 'node:fs';import path from 'node:path';import {newestRunFirst,endpointEligible} from './proxy-health-policy.mjs';
export function readUserTunnelHints(out){
 const hints={};const files=fs.readdirSync(out).filter(f=>/^(?:proxy-transport|user-tunnel-probe)-\d+\.json$/.test(f)).sort(newestRunFirst).slice(0,16).reverse();
 const note=(id,ip,at,profile=false)=>{if(!/^[a-f0-9]{16}$/.test(id||'')||!ip||!Number.isFinite(Date.parse(at)))return;const old=hints[id];if(!old||Date.parse(at)>=old.checkedAt)hints[id]={ip,checkedAt:Date.parse(at),profile:profile||old?.profile===true};};
 for(const file of files){try{const d=JSON.parse(fs.readFileSync(path.join(out,file),'utf8'));for(const h of d.health||[])if(h.outcome==='https-echo-verified')note(h.tunnelId,h.observedExitIP,h.at);for(const h of d.attempts||[])if(h.outcome==='https-echo-verified')note(h.id,h.observedExitIP,h.finishedAt);for(const o of d.outcomes||[])if(o.success)note(o.tunnelId,o.observedExitIP,o.at,true);}catch{}}
 return hints;
}
export function prioritizeUserCandidates(rotated,{health={},hints={},available,now=Date.now(),limit=8}){
 return rotated.map((entry,order)=>{
  const c=entry.candidate,h=health[`user-tunnel:${c.id}`],hint=hints[c.id.slice(0,16)];
  if(!endpointEligible(h,available,now))return null;
  const observed=h?.observedExitIP?{ip:h.observedExitIP,at:h.checkedAt}:hint?{ip:hint.ip,at:hint.checkedAt}:null;
  // Bounded revalidation for dynamic exits, not permanent exclusion and not an
  // assumption that a new config alias creates an unused IP budget.
  if(observed&&!available(observed.ip)&&now-observed.at<60*60*1000)return null;
  const recentFailure=h?.failures>0&&h.checkedAt>=(hint?.checkedAt||0);const healthy=!recentFailure&&(h?.observedExitIP&&!h.failures||hint&&now-hint.checkedAt<60*60*1000);
  return {entry,order,rank:hint?.profile&&healthy?0:healthy?1:h?3:2};
 }).filter(Boolean).sort((a,b)=>a.rank-b.rank||a.order-b.order).slice(0,limit).map(x=>x.entry);
}
