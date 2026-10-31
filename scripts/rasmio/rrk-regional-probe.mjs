// Bounded public regional routing assessment; no credentials, TLS bypass or CAPTCHA solving.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {X509Certificate} from 'node:crypto';
import {parsePublicProxy} from './public-proxy-candidates.mjs';
import {robotAllows,redactPersonalNumbers} from '../../tools/rrk-local/core.mjs';
const execute=promisify(execFile);
const target='https://rrk.ir/ords/r/rrs/rrs-front/%D8%AF%D8%A7%D8%AF%D9%87-%D8%A8%D8%A7%D8%B2';
export function regionalArgs(proxy,url){
 const p=parsePublicProxy(proxy);if(!p||!['https://rrk.ir/robots.txt',target].includes(url))throw new Error('Unapproved regional route or target');
 return ['-q','--silent','--show-error','--proxy',p.url.replace(/^socks5:/,'socks5h:').replace(/^socks4:/,'socks4a:'),'--noproxy','','--proto','=https','--max-redirs','0','--connect-timeout','5','--max-time','10','--max-filesize','1500000','--user-agent','SripPublicSourceAssessment/1.0',url,'--write-out','\n__RRK_META__%{http_code}'];
}
export function selectRegionalProxies(source,{knownFailed=new Set(),freshOnly=false,tlsOnly=false,limit=24}={}) {
 const candidates=freshOnly?(source.freshProxies||[]):source.proxies;
 return [...new Set(candidates)].filter(p=>parsePublicProxy(p)&&!knownFailed.has(p)&&(!tlsOnly||p==='http://93.118.120.60:8080')).slice(0,limit);
}
export async function runRrkRegionalProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');fs.mkdirSync('out',{recursive:true});const file=`out/rrk-regional-probe-${runId}.json`,files=[file];
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rrk-regional-')),env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'};
 const report={runId,startedAt:new Date().toISOString(),mode:'rrk-public-regional-routing',limits:{routes:24,concurrency:2,secondsPerCurl:10,browserSeconds:45000,browserRequests:80},attempts:[],verifiedProfiles:[],verifiedExitCount:0,advertsExtracted:0,relationshipsExtracted:0,canonicalRecordsChanged:false,fullCoverageVerified:false};
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));let browser;save();
 try{
  const source=JSON.parse(fs.readFileSync(new URL('./rrk-regional-proxies.json',import.meta.url),'utf8'));report.proxySource={url:source.source,blob:source.sourceBlob,countryReportedByPublisher:source.countryReportedByPublisher,countryIndependentlyVerified:false};
  let tlsOnly=false,remaining=false,freshOnly=false;try{const p=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).client_payload||{};tlsOnly=p.tlsOnly===true;remaining=p.remaining===true;freshOnly=p.freshOnly===true;}catch{}
  const knownFailed=new Set();if(remaining){for(const file of fs.readdirSync('out').filter(f=>/^rrk-regional-probe-.*\.json$/.test(f))){try{const old=JSON.parse(fs.readFileSync(`out/${file}`,'utf8'));for(const a of old.attempts||[])if(a.status===0)knownFailed.add(a.proxy);}catch{}}}
  report.previouslyFailedRoutesSkipped=knownFailed.size;report.limits.routes=remaining?96:24;
  const proxies=selectRegionalProxies(source,{knownFailed:remaining?knownFailed:new Set(),freshOnly,tlsOnly,limit:remaining?96:24});report.freshOnly=freshOnly;report.previouslyCataloguedRoutesExcluded=freshOnly?source.previouslyCataloguedProxyCount:0;report.candidateCount=proxies.length;let admitted=null,denied=false;
  const check=async proxy=>{const item={proxy,at:new Date().toISOString()};report.attempts.push(item);let stdout='';try{({stdout}=await execute('curl',regionalArgs(proxy,'https://rrk.ir/robots.txt'),{env,cwd:scratch,timeout:12000,maxBuffer:1600000}));}catch(e){stdout=String(e.stdout||'');item.error=String(e.stderr||e.message).slice(0,240);item.proxyRefused=/CONNECT tunnel failed, response (?:401|403|407|429)/i.test(item.error); /* No TLS to RRK was established; never retry this refusing proxy. */}
   const n=stdout.lastIndexOf('\n__RRK_META__');if(n>=0){item.status=Number(stdout.slice(n+13))||0;const body=stdout.slice(0,n);if([401,403,429].includes(item.status))denied=true;if(item.status===404||(item.status===200&&/^\s*User-agent\s*:/mi.test(body))){item.robotsAllowed=item.status===404||robotAllows(body,target);if(item.robotsAllowed&&!admitted)admitted=proxy;}}
   save();
  };
  for(let i=0;i<proxies.length&&!admitted&&!denied;i+=2){await Promise.all(proxies.slice(i,i+2).map(check));await new Promise(r=>setTimeout(r,1000));}
  report.tlsDiagnostics=[];
  if(!denied&&!admitted){for(const a of report.attempts.filter(a=>/unable to get local issuer/i.test(a.error||'')||(tlsOnly&&a.proxy==='http://93.118.120.60:8080')).slice(0,2)){
   const p=parsePublicProxy(a.proxy);if(!p||p.protocol!=='http')continue;
   const d={proxy:p.url};let output='';try{const r=await execute('openssl',['s_client','-proxy',new URL(p.url).hostname+':'+new URL(p.url).port,'-connect','rrk.ir:443','-servername','rrk.ir','-showcerts','-verify_return_error','-verify_hostname','rrk.ir'],{env,cwd:scratch,timeout:15000,maxBuffer:100000});output=r.stdout;}catch(e){output=String(e.stdout||'');d.error=String(e.stderr||e.message).slice(0,600);}
   d.certificates=[];for(const cert of output.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)||[]){try{const x=new X509Certificate(cert);d.certificates.push({subject:x.subject,issuer:x.issuer,serialNumber:x.serialNumber,hostnameVerified:x.checkHost('rrk.ir')==='rrk.ir',subjectAltName:x.subjectAltName,infoAccess:x.infoAccess,validFrom:x.validFrom,validTo:x.validTo,fingerprint256:x.fingerprint256});}catch{}}
   report.tlsDiagnostics.push(d);save();
  }}
  report.stoppedOnAccessDenial=denied;report.routeAdmitted=Boolean(admitted);
  if(admitted&&!denied){
   const {default:puppeteer}=await import('puppeteer');const proxy=parsePublicProxy(admitted);browser=await puppeteer.launch({headless:true,env,args:['--no-sandbox','--disable-dev-shm-usage',`--proxy-server=${proxy.url}`]});
   const page=await browser.newPage();await page.setBypassServiceWorker(true);await page.setRequestInterception(true);let requests=0;
   page.on('request',r=>{let allowed=false;try{const u=new URL(r.url());allowed=++requests<=80&&u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&!['image','font','media'].includes(r.resourceType());}catch{}void(allowed?r.continue():r.abort()).catch(()=>{});});
   report.browser={proxy:admitted,target};
   try{const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});report.browser.status=response?.status();if(response?.status()===200){await new Promise(r=>setTimeout(r,1500));const dom=await page.evaluate(()=>({title:document.title,text:document.body.innerText,fields:[...document.querySelectorAll('input')].map(e=>({id:e.id,type:e.type})).filter(e=>e.type!=='hidden'),buttons:[...document.querySelectorAll('button')].map(e=>({id:e.id,text:e.innerText}))}));report.browser.title=redactPersonalNumbers(dom.title);report.browser.textExcerpt=redactPersonalNumbers(dom.text).slice(0,5000);report.browser.fields=dom.fields;report.browser.buttons=dom.buttons.map(b=>({...b,text:redactPersonalNumbers(b.text)}));report.browser.publicSearchFormLocated=dom.fields.some(i=>i.id==='P199_NEWSPAPERDATE_AZ');}}
   catch(e){report.browser.error=e.message.slice(0,250);}report.browser.requests=requests;
  }
 }catch(e){report.error=e.message.slice(0,300);}
 finally{if(browser)await browser.close().catch(()=>{});fs.rmSync(scratch,{recursive:true,force:true});report.finishedAt=new Date().toISOString();save();}
 return {files,report};
}
