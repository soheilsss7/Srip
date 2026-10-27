// Bounded anonymous connectivity experiment, never a production proxy switch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer';
import { extractTablesFromDOM } from './table-extractor.mjs';
import { interleaveCandidates, proxyCurlArgs, allowedProbeTarget } from './public-proxy-candidates.mjs';
const exec = promisify(execFile);
const sources=[['monosans/proxy-list','proxies/all.txt'],['ProxyScrape/free-proxy-list','proxies/all/data.txt'],['proxifly/free-proxy-list','proxies/all/data.txt']];
export async function runPublicProxyProbe({repairSample=false}={}) {
  const runId=String(process.env.GITHUB_RUN_ID || 'local').replace(/[^0-9A-Za-z_-]/g,'');
  const output=`out/public-proxy-probe-${runId}.json`;
  fs.mkdirSync('out',{recursive:true});
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'anonymous-proxy-probe-'));
  const env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'};
  const report={runId,startedAt:new Date().toISOString(),mode:repairSample?'bounded-anonymous-repair-sample':'bounded-anonymous-proxy-test',limits:{candidates:20,concurrency:2,companyRequests:4,storedProfiles:2,wallSeconds:150},sources:[],attempts:[],verifiedProfiles:[],productionRoutingChanged:false,exitScope:'Echo-service-observed IP; destination-specific egress and unused target quota are not proven'};
  const files=[output];let browser;
  const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
  const started=Date.now();
  try {
    let targetIds=['10100000711'];
    if(repairSample) {
      const frontier=JSON.parse(fs.readFileSync('frontier.json','utf8'));
      targetIds=[];
      for(const key of frontier.detailRepair?.remaining || []) {
        if(!/^company:\d{11}$/.test(key))continue;
        const id=key.split(':')[1];
        try {const d=JSON.parse(fs.readFileSync(`data/entities/company-${id}.json`,'utf8'));if(d.rows?.length || d.tables?.some(t=>t.rows?.length))continue;}catch{}
        targetIds.push(id);if(targetIds.length===2)break;
      }
      if(!targetIds.length)throw new Error('No pending empty company files found');
    }
    report.targetIds=targetIds;let targetIndex=0;
    const lists=await Promise.all(sources.map(async([repo,file])=>{
      try {
        const response=await fetch(`https://api.github.com/repos/${repo}/contents/${file}`,{headers:{accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const text=await response.text();if(text.length>8000000)throw new Error('Source exceeds size bound');
        report.sources.push({repo,file,sha256:crypto.createHash('sha256').update(text).digest('hex'),lines:text.trim().split('\n').length});
        return text.trim().split('\n');
      } catch(e) {report.sources.push({repo,file,error:String(e.message).slice(0,160)});return [];}
    }));
    const previousHealthy=[];
    for(const file of fs.readdirSync('out').filter(f=>/^public-proxy-probe-[0-9A-Za-z_-]+\.json$/.test(f)).sort().reverse().slice(0,6)) {
      try { const prior=JSON.parse(fs.readFileSync(path.join('out',file),'utf8')); for(const a of prior.attempts || []) if(a.observedExitIP && /^https?:/.test(a.proxy)) previousHealthy.push(a.proxy); } catch {}
    }
    report.previouslyEchoVerifiedCandidates=previousHealthy.length;
    const candidates=interleaveCandidates([previousHealthy,...lists.map(list=>list.filter(line=>/^https?:/.test(line)))],20);
    report.protocolSelection='HTTP/HTTPS proxies';
    report.candidateCount=candidates.length;save();
    browser=await puppeteer.launch({headless:true,env,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run'],userDataDir:path.join(scratch,'browser')});
    const usedExits=new Set();let companyAttempts=0, inflightCompany=0;
    for(let i=0;i<candidates.length && Date.now()-started<150000 && report.verifiedProfiles.length<2;i+=2) {
      await Promise.all(candidates.slice(i,i+2).map(async candidate=>{
        const attempt={proxy:candidate.url,startedAt:new Date().toISOString(),phase:'echo-https'};
        report.attempts.push(attempt);const t=Date.now();let reserved=false;
        try {
          const echo=await exec('curl',proxyCurlArgs(candidate.url,'https://api.ipify.org/?format=json'),{env,cwd:scratch,timeout:10000,maxBuffer:2200000});
          const ip=JSON.parse(echo.stdout).ip;
          if(!isIP(ip))throw new Error('Echo did not return an IP');
          attempt.observedExitIP=ip;
          if(usedExits.has(ip)){attempt.outcome='duplicate-exit-skipped';return;}
          usedExits.add(ip);
          if(companyAttempts>=4 || report.verifiedProfiles.length+inflightCompany>=2){attempt.outcome='company-probe-budget-skipped';return;}
          inflightCompany++;reserved=true;attempt.phase='company-https';
          const companyId=targetIds[targetIndex++ % targetIds.length];attempt.companyId=companyId;
          let target=`https://rasmio.com/company/${companyId}/direct/`,html='';attempt.responses=[];
          for(let redirects=0;redirects<=2;redirects++) {
            if(companyAttempts>=4){attempt.outcome='company-request-budget-exhausted';return;}
            companyAttempts++;
            const response=await exec('curl',[...proxyCurlArgs(candidate.url,target,companyId),'--write-out','\n__PROBE_META__%{http_code}\t%{redirect_url}'],{env,cwd:scratch,timeout:10000,maxBuffer:2200000});
            const split=response.stdout.lastIndexOf('\n__PROBE_META__');
            if(split<0)throw new Error('Missing HTTP status metadata');
            html=response.stdout.slice(0,split);
            const [status,redirect]=response.stdout.slice(split+'\n__PROBE_META__'.length).split('\t');
            attempt.responses.push({url:target,status:Number(status),bytes:Buffer.byteLength(html),redirect:redirect||null});
            if(Number(status)>=300 && Number(status)<400) {
              if(!redirect || !allowedProbeTarget(redirect,companyId) || new URL(redirect).hostname!=='rasmio.com'){attempt.outcome='redirect-not-permitted';return;}
              target=redirect;continue;
            }
            break;
          }
          if(attempt.responses.at(-1)?.status>=300 && attempt.responses.at(-1)?.status<400){attempt.outcome='redirect-limit';return;}
          attempt.htmlTitle=(html.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]||null;
          attempt.rawTableCount=(html.match(/<table\b/gi)||[]).length;
          if(/سقف\s*مجاز|امکان مشاهده اطلاعات در صفحه شرکت برای شما محدود شده/.test(html)){attempt.outcome='explicit-access-limit';return;}
          // Browser is an offline DOM parser only; it cannot request anything from the HTML.
          const page=await browser.newPage();
          try {
            await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);
            page.on('request',r=>r.abort());
            await page.setContent(html,{waitUntil:'domcontentloaded',timeout:10000});
            const parsed=await page.evaluate(extractTablesFromDOM);
            const tableRows=parsed.tables.reduce((n,t)=>n+t.rows.length,0);
            attempt.tableRows=tableRows;attempt.tables=parsed.tables.length;
            if(!tableRows){attempt.outcome='empty-detail-response';return;}
            const info=await page.evaluate(()=>{
              const lines=(document.body.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean);
              const labels=['شناسه ملی','شماره ثبت','تاریخ تاسیس','تاریخ تأسیس','وضعیت شرکت','نوع شرکت','کد اقتصادی','سرمایه ثبتی','آخرین آگهی روزنامه رسمی','کد پستی'];const result={};
              for(const label of labels){const index=lines.findIndex(s=>s===label||s.startsWith(label+' '));if(index>=0)result[label]=lines[index]===label?(lines[index+1]||''):lines[index].slice(label.length).trim();}
              const address=lines.findIndex(s=>/نشانی ثبتی/.test(s));if(address>=0)result['نشانی']=lines.slice(address+1,address+6).find(s=>s.length>25)||lines[address+1]||'';
              return result;
            });
            const nationalId=String(info['شناسه ملی']||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
            if(!nationalId.includes(companyId)){attempt.outcome='identity-not-verified';return;}
            if(report.verifiedProfiles.some(p=>p.key===`company:${companyId}`)){attempt.outcome='duplicate-profile-not-stored';return;}
            const file=`out/public-proxy-profile-${runId}-${report.verifiedProfiles.length+1}.json`;
            const detail={type:'company',id:companyId,name:parsed.title,url:target,via:'public-proxy-curl',sourceRun:runId,fetchedAt:new Date().toISOString(),tableSchemaVersion:2,info,rows:parsed.rows,tables:parsed.tables,profileCompleteness:'unverified',probeOnly:!repairSample};
            const stored=JSON.stringify(detail,null,2);fs.writeFileSync(file,stored);files.push(file);
            report.verifiedProfiles.push({file,key:`company:${companyId}`,sampledFromPendingEmptyFile:repairSample,...(repairSample?{entityFile:`data/entities/company-${companyId}.json`}:{}),observedExitIP:ip,proxy:candidate.url,tableRows,tables:parsed.tables.length,sha256:crypto.createHash('sha256').update(stored).digest('hex'),nationalIdMatches:true});
            attempt.outcome='nonempty-company-identity-verified';
          } finally {await page.close();}
        } catch(e){attempt.outcome='request-failed';attempt.error=String(e.stderr||e.message||e).slice(0,220);}
        finally {if(reserved)inflightCompany--;attempt.elapsedMs=Date.now()-t;save();}
      }));
    }
  } catch(e){report.error=String(e.message||e).slice(0,300);}
  finally {if(browser)await browser.close().catch(()=>{});fs.rmSync(scratch,{recursive:true,force:true});report.finishedAt=new Date().toISOString();report.verifiedExitCount=new Set(report.attempts.filter(a=>a.observedExitIP).map(a=>a.observedExitIP)).size;save();}
  return {files,report};
}
