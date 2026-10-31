import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
import { interleaveCandidates, parsePublicProxy } from './public-proxy-candidates.mjs';
import { endpointEligible, healthSuccess, healthFailure, newestRunFirst } from './proxy-health-policy.mjs';
const exec=promisify(execFile);
const WINDOW=96*60*60*1000;
export function permittedDetailURL(value, ent) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.hostname!=='rasmio.com' || u.port || u.username || u.password) return false;
    if(!['company','person'].includes(ent.type))return false;
    const match=u.pathname.match(/^\/(company|person)\/([^/]+)(?:\/.*)?$/);
    return !!match && match[1]===ent.type && match[2].toUpperCase()===String(ent.id).toUpperCase() && (ent.type==='company'?/^\d{11}$/.test(ent.id):/^[a-fA-F0-9]+$/.test(ent.id));
  } catch{return false;}
}
export function permittedResourceURL(value) {
  try {const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='rasmio.com'||u.hostname.endsWith('.rasmio.com'));}catch{return false;}
}
export function reserveExit(state, ip, {now=Date.now(), max=4, windowMs=WINDOW}={}) {
  if(!isIP(ip))throw new Error('Invalid observed IP');
  state.exits ||= {};
  let entry=state.exits[ip];
  if(!entry || now-entry.lastAt>=windowMs) entry=state.exits[ip]={requests:0,lastAt:now};
  if(entry.blockedAt && now-entry.blockedAt<windowMs || entry.cooldownUntil>now || entry.requests>=max)throw new Error('proxy-exit-budget-exhausted');
  entry.requests++;entry.lastAt=now;
  return entry.requests;
}
export function transportCurlArgs(proxy,url,{profile=false}={}) {
  const p=parsePublicProxy(proxy);if(!p || !['http','https','socks5'].includes(p.protocol))throw new Error('Invalid transport proxy');
  const endpoint=p.protocol==='socks5'?p.url.replace(/^socks5:/,'socks5h:'):p.url;
  return ['-q','--silent','--show-error','--fail','--proxy',endpoint,'--noproxy','','--proto','=https','--proto-redir','=https','--max-redirs','0','--connect-timeout','5','--max-time',profile?'45':'12','--max-filesize','4194304','--user-agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36','--header','accept-language: fa,en',url];
}
export class PublicProxyTransport {
  constructor({frontier,out='out',runId=process.env.GITHUB_RUN_ID||'local',fetchImpl=globalThis.fetch,execute=exec,maxChecks=32,now=()=>Date.now()}) {
    this.frontier=frontier;this.out=out;this.runId=runId;this.fetchImpl=fetchImpl;this.execute=execute;this.maxChecks=maxChecks;this.now=now;
    frontier.proxyTransport ||= {version:1,exits:{},cursor:0};this.state=frontier.proxyTransport;this.state.endpointHealth ||= {};
    this.scratch=fs.mkdtempSync(path.join(os.tmpdir(),'anonymous-proxy-transport-'));
    this.env={PATH:process.env.PATH,HOME:this.scratch,LANG:'C.UTF-8'};
    this.file=`${out}/proxy-transport-${String(runId).replace(/[^\w-]/g,'')}.json`;
    this.report={runId,startedAt:new Date().toISOString(),enabledTypes:['company','person'],directFallback:false,policy:{requestsPerEchoExit:4,supportedTransports:['http','https','socks5'],windowHours:96,maxCandidateChecks:maxChecks,profileResponseSeconds:45,healthResponseSeconds:12,scope:'Echo-observed IP is not proof of destination egress or unused target quota; 96h is a conservative client policy'},sources:[],health:[],requests:[],outcomes:[]};
    this.ready=[];this.busy=new Set();this.waiters=[];this.checked=0;this.index=0;this.candidates=[];
    fs.mkdirSync(out,{recursive:true});
  }
  save(){try{fs.writeFileSync(this.file,JSON.stringify(this.report,null,2));}catch{}}
  async initialize(){
    for(const [url,h] of Object.entries(this.state.endpointHealth))if(this.now()-h.checkedAt>7*24*3600000)delete this.state.endpointHealth[url];
    const preferred=[];const seedHistory=!this.state.seededFromProbeHistory;
    for(const file of fs.readdirSync(this.out).filter(f=>/^public-proxy-probe-[\w-]+\.json$|^proxy-transport-[\w-]+\.json$/.test(f)).sort(newestRunFirst).slice(0,12)){
      if(path.join(this.out,file)===this.file)continue;
      try{
        const d=JSON.parse(fs.readFileSync(path.join(this.out,file),'utf8'));
        for(const p of d.verifiedProfiles||[])preferred.push(p.proxy);
        for(const h of d.health||[]) {
          if(!parsePublicProxy(h.proxy) || !isIP(h.observedExitIP))continue;
          const at=Date.parse(h.at);if(!Number.isFinite(at))continue;
          const old=this.state.endpointHealth[h.proxy];
          if(!old || at>old.checkedAt)this.state.endpointHealth[h.proxy]=healthSuccess(old,h.observedExitIP,at);
        }
        if(seedHistory)for(const a of d.attempts||[]){
          if(a.phase!=='company-https' || !isIP(a.observedExitIP) || !a.startedAt || this.now()-Date.parse(a.startedAt)>=WINDOW)continue;
          const old=this.state.exits[a.observedExitIP] ||= {requests:0,lastAt:Date.parse(a.startedAt)};
          old.requests=Math.min(4,old.requests+Math.max(1,a.responses?.length||0));old.lastAt=Math.max(old.lastAt,Date.parse(a.startedAt));
        }
        for(const o of d.outcomes||[])if(o.success)preferred.push(o.proxy);
      }catch{}
    }
    this.state.seededFromProbeHistory=true;
    for(const [ip,record] of Object.entries(this.state.exits))if(this.now()-Math.max(record.lastAt||0,record.blockedAt||0)>=WINDOW)delete this.state.exits[ip];
    const sources=[['monosans/proxy-list','proxies/all.txt'],['ProxyScrape/free-proxy-list','proxies/all/data.txt'],['proxifly/free-proxy-list','proxies/all/data.txt']];
    const lists=await Promise.all(sources.map(async([repo,file])=>{
      try{
        const r=await this.fetchImpl(`https://api.github.com/repos/${repo}/contents/${file}`,{headers:{accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(12000)});
        if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();if(text.length>8000000)throw new Error('Source too large');
        this.report.sources.push({repo,file,lines:text.trim().split('\n').length});
        return text.split('\n').filter(line=>/^(https?|socks5):/.test(line));
      }catch(e){this.report.sources.push({repo,file,error:e.message});return [];}
    }));
    const fresh=interleaveCandidates(lists,10000).map(p=>p.url);
    const offset=this.state.cursor%Math.max(fresh.length,1);
    const rotated=[...fresh.slice(offset),...fresh.slice(0,offset)];
    this.state.cursor=(offset+this.maxChecks)%Math.max(fresh.length,1);
    const universe=interleaveCandidates([preferred,rotated],10000);
    const eligible=universe.filter(p=>endpointEligible(this.state.endpointHealth[p.url],ip=>this.available(ip),this.now()));
    this.candidates=eligible.slice(0,this.maxChecks);
    this.report.skippedRecentUnavailable=universe.length-eligible.length;
    this.report.candidateUniverse=universe.length;
    this.report.candidateCount=this.candidates.length;this.save();return this;
  }
  available(ip){const e=this.state.exits[ip];return !e || this.now()-e.lastAt>=WINDOW || (!e.blockedAt && !(e.cooldownUntil>this.now()) && e.requests<4);}
  async acquire(ent){
    const begin=this.now();
    while(this.now()-begin<60000){
      let entry=this.ready.find(e=>!e.retired && !this.busy.has(e.ip) && this.available(e.ip));
      if(entry){this.busy.add(entry.ip);return this.lease(entry,ent);}
      if(this.index<this.candidates.length && this.checked<this.maxChecks){
        const candidate=this.candidates[this.index++];this.checked++;
        const observation={proxy:candidate.url,at:new Date().toISOString()};this.report.health.push(observation);
        try{
          const {stdout}=await this.execute('curl',transportCurlArgs(candidate.url,'https://api.ipify.org/?format=json'),{env:this.env,cwd:this.scratch,timeout:14000,maxBuffer:4500000});
          const ip=JSON.parse(stdout).ip;if(!isIP(ip))throw new Error('Invalid echo IP');observation.observedExitIP=ip;
          this.state.endpointHealth[candidate.url]=healthSuccess(this.state.endpointHealth[candidate.url],ip,this.now());
          if(!this.available(ip)){observation.outcome='exit-budget-or-cooldown';continue;}
          if(this.ready.some(e=>e.ip===ip && !e.retired)){observation.outcome='duplicate-echo-exit';continue;}
          entry={proxy:candidate.url,ip,retired:false};this.ready.push(entry);observation.outcome='https-echo-verified';
        }catch(e){this.state.endpointHealth[candidate.url]=healthFailure(this.state.endpointHealth[candidate.url],this.now());observation.outcome='health-failed';observation.error=String(e.stderr||e.message).slice(0,200);}
        finally{this.save();}
        continue;
      }
      if(this.busy.size){await new Promise(resolve=>{const timeout=setTimeout(resolve,2000);this.waiters.push(()=>{clearTimeout(timeout);resolve();});});continue;}
      break;
    }
    throw new Error('public-proxy-pool-unavailable');
  }
  lease(entry,ent){
    const pool=this;let closed=false;const key=`${ent.type}:${ent.id}`;
    const lease={proxy:entry.proxy,observedExitIP:entry.ip,finalURL:null,mainRequests:0,blockedHosts:[],
      reserve(kind,url){
        if(closed || entry.retired)throw new Error('proxy-lease-closed');
        if(!permittedDetailURL(url,ent))throw new Error('proxy-target-not-permitted');
        const n=reserveExit(pool.state,entry.ip,{now:pool.now()});lease.mainRequests++;
        const observation={at:new Date().toISOString(),key,kind,path:new URL(url).pathname,proxy:entry.proxy,observedExitIP:entry.ip,exitWindowRequest:n};pool.report.requests.push(observation);pool.save();return observation;
      },
      async fetch(url){
        let target=url;
        for(let redirects=0;redirects<4;redirects++){
          const observation=lease.reserve('curl',target);
          let stdout;
          try {({stdout}=await pool.execute('curl',[...transportCurlArgs(entry.proxy,target,{profile:true}).filter(a=>a!=='--fail'),'--write-out','\n__EGRESS_META__%{http_code}\t%{redirect_url}'],{env:pool.env,cwd:pool.scratch,timeout:48000,maxBuffer:4500000}));}
          catch(e){observation.error=String(e.stderr||e.message).slice(0,240);observation.partialBytesReceived=Buffer.byteLength(String(e.stdout||''));observation.partialResponseAccepted=false;pool.save();const error=new Error('proxy-curl-failed: '+observation.error);error.retryable=true;throw error;}
          const at=stdout.lastIndexOf('\n__EGRESS_META__');if(at<0)throw new Error('Missing HTTP metadata');
          const body=stdout.slice(0,at),[statusText,redirect]=stdout.slice(at+'\n__EGRESS_META__'.length).split('\t');const status=Number(statusText);
          observation.scriptHosts=[...new Set([...body.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m=>{try{return new URL(m[1],target).hostname;}catch{return 'invalid';}}))].slice(0,20);
          observation.status=status;observation.bytes=Buffer.byteLength(body);observation.rawTables=(body.match(/<table/gi)||[]).length;observation.title=(body.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]?.slice(0,160)||null;pool.save();
          if(status>=300 && status<400){if(!permittedDetailURL(redirect,ent))throw new Error('proxy-redirect-not-permitted');target=redirect;continue;}
          lease.finalURL=target;
          return {ok:status>=200 && status<300,status,text:async()=>body};
        }
        throw new Error('proxy-redirect-limit');
      },
      finish(success,reason){
        if(closed)return;closed=true;
        if(!success){entry.retired=true;pool.state.exits[entry.ip] ||= {requests:0,lastAt:pool.now()};if(/explicit-access-limit|HTTP 429|exit-budget/.test(String(reason)))pool.state.exits[entry.ip].blockedAt=pool.now();else pool.state.exits[entry.ip].cooldownUntil=pool.now()+120000;}
        pool.report.outcomes.push({at:new Date().toISOString(),key,proxy:entry.proxy,observedExitIP:entry.ip,mainRequests:lease.mainRequests,blockedResourceHosts:lease.blockedHosts,success,reason:reason?String(reason).slice(0,180):null});
        pool.busy.delete(entry.ip);for(const resolve of pool.waiters.splice(0))resolve();pool.save();
      },
    };
    return lease;
  }
  close(){this.report.finishedAt=new Date().toISOString();this.save();fs.rmSync(this.scratch,{recursive:true,force:true});}
}
