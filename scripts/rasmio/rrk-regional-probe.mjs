// Bounded public regional routing assessment; no credentials, TLS bypass or CAPTCHA solving.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {X509Certificate} from 'node:crypto';
import {createVerifiedCurlTransport} from './rrk-verified-curl-browser.mjs';
import {samplePublicNotices} from './rrk-public-search-sample.mjs';
import {chainCompletionCandidates,prepareCertumChain} from './rrk-certum-chain.mjs';
import {parsePublicProxy} from './public-proxy-candidates.mjs';
import {robotAllows,redactPersonalNumbers} from '../../tools/rrk-local/core.mjs';
const execute=promisify(execFile);
const target='https://rrk.ir/ords/r/rrs/rrs-front/%D8%AF%D8%A7%D8%AF%D9%87-%D8%A8%D8%A7%D8%B2';
export function regionalArgs(proxy,url,{tls12=false,caBundle=null}={}){
 const p=parsePublicProxy(proxy);if(!p||!['https://rrk.ir/robots.txt','https://www.rrk.ir/robots.txt',target,target.replace('rrk.ir','www.rrk.ir')].includes(url))throw new Error('Unapproved regional route or target');
 return ['-q','--silent','--show-error','--proxy',p.url.replace(/^socks5:/,'socks5h:').replace(/^socks4:/,'socks4a:'),'--noproxy','','--proto','=https','--max-redirs','0','--connect-timeout','5','--max-time','10','--max-filesize','1500000','--user-agent','SripPublicSourceAssessment/1.0',...(caBundle?['--cacert',caBundle]:[]),...(tls12?['--tlsv1.2','--tls-max','1.2','--http1.1']:[]),url,'--write-out','\n__RRK_META__%{http_code}'];
}
export function selectRegionalProxies(source,{knownFailed=new Set(),freshOnly=false,recoveryOnly=false,tlsOnly=false,limit=24,now=Date.now()}={}) {
 const recovery=(source.recoveryProxies||[]).filter(p=>/^https:\/\/github\.com\/roosterkid\/openproxylist\/blob\/[a-f0-9]{40}\/HTTPS\.txt$/.test(p.source||'') && /^[a-f0-9]{40}$/.test(p.sourceBlob||'') && Date.parse(p.publisherUpdatedAt)>Date.parse(p.previousFailureAt) && now-Date.parse(p.publisherUpdatedAt)>=0 && now-Date.parse(p.publisherUpdatedAt)<3600000).map(p=>p.proxy);
 const candidates=recoveryOnly?recovery:freshOnly?(source.freshProxies||[]):source.proxies;
 return [...new Set(candidates)].filter(p=>parsePublicProxy(p)&&!knownFailed.has(p)&&(!tlsOnly||p==='http://93.118.120.60:8080')).slice(0,limit);
}
export function tlsCompatibilityCandidates(source,prior,deniedRoutes=new Set(),now=Date.now()) {
 return [...new Set((prior.attempts||[]).filter(a=>a.status===0 && /SSL_ERROR_SYSCALL/.test(a.error||'') && now-Date.parse(a.at)>=0 && now-Date.parse(a.at)<86400000 && source.proxies.includes(a.proxy) && !deniedRoutes.has(a.proxy)).map(a=>a.proxy))].slice(0,1);
}
export async function runRrkRegionalProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');fs.mkdirSync('out',{recursive:true});const file=`out/rrk-regional-probe-${runId}.json`,files=[file];
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rrk-regional-')),env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'};
 const report={runId,startedAt:new Date().toISOString(),mode:'rrk-public-regional-routing',limits:{routes:24,concurrency:2,secondsPerCurl:10,browserSeconds:75000,browserRequests:80},attempts:[],verifiedProfiles:[],verifiedExitCount:0,advertsExtracted:0,relationshipsExtracted:0,canonicalRecordsChanged:false,fullCoverageVerified:false};
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));let browser,verifiedTransport;save();
 try{
  const source=JSON.parse(fs.readFileSync(new URL('./rrk-regional-proxies.json',import.meta.url),'utf8'));report.proxySource={url:source.source,blob:source.sourceBlob,countryReportedByPublisher:source.countryReportedByPublisher,countryIndependentlyVerified:false};
  let tlsOnly=false,remaining=false,freshOnly=false,recoveryOnly=false,compatibilityFrom=null,completeChainFrom=null,resumeAdmittedFrom=null;try{const p=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).client_payload||{};tlsOnly=p.tlsOnly===true;remaining=p.remaining===true;freshOnly=p.freshOnly===true;recoveryOnly=p.recoveryOnly===true;if(/^\d+$/.test(String(p.compatibilityFrom||'')))compatibilityFrom=String(p.compatibilityFrom);if(/^\d+$/.test(String(p.completeChainFrom||'')))completeChainFrom=String(p.completeChainFrom);if(/^\d+$/.test(String(p.resumeAdmittedFrom||'')))resumeAdmittedFrom=String(p.resumeAdmittedFrom);}catch{}
  const knownFailed=new Set(),deniedRoutes=new Set();if(remaining||recoveryOnly||compatibilityFrom||completeChainFrom){for(const file of fs.readdirSync('out').filter(f=>/^rrk-regional-probe-.*\.json$/.test(f))){try{const old=JSON.parse(fs.readFileSync(`out/${file}`,'utf8'));for(const a of old.attempts||[]){if(a.status===0)knownFailed.add(a.proxy);if(a.proxyRefused||[401,403,429].includes(a.status))deniedRoutes.add(a.proxy);}}catch{}}}
  report.previouslyFailedRoutesSkipped=knownFailed.size;report.limits.routes=remaining?96:24;
  let proxies=selectRegionalProxies(source,{knownFailed:recoveryOnly?deniedRoutes:remaining?knownFailed:new Set(),freshOnly,recoveryOnly,tlsOnly,limit:remaining?96:24});if(compatibilityFrom){const prior=JSON.parse(fs.readFileSync(`out/rrk-regional-probe-${compatibilityFrom}.json`,'utf8'));if(String(prior.runId)!==compatibilityFrom)throw new Error('Compatibility evidence mismatch');proxies=tlsCompatibilityCandidates(source,prior,deniedRoutes);report.compatibilityEvidenceRun=compatibilityFrom;report.limits.maxCurlRequests=2;}let caBundle=null;if(completeChainFrom||resumeAdmittedFrom){const evidenceRun=resumeAdmittedFrom||completeChainFrom;const prior=JSON.parse(fs.readFileSync(`out/rrk-regional-probe-${evidenceRun}.json`,'utf8'));if(String(prior.runId)!==evidenceRun)throw new Error('Chain evidence mismatch');proxies=resumeAdmittedFrom?(prior.routeAdmitted&&prior.chainCompletion?.verifiedAgainstExistingSystemRoots&&Date.now()-Date.parse(prior.finishedAt)>=0&&Date.now()-Date.parse(prior.finishedAt)<3600000&&prior.verifiedSearchPage?.status===200?prior.attempts.filter(a=>a.robotsAllowed&&source.proxies.includes(a.proxy)).map(a=>a.proxy).slice(0,1):[]):chainCompletionCandidates(source,prior,deniedRoutes);if(!proxies.length)throw new Error('No eligible missing-issuer evidence');const chain=await prepareCertumChain(scratch,execute,env);caBundle=chain.bundle;report.chainCompletion={evidenceRun,...chain.evidence};}report.freshOnly=freshOnly;report.recoveryOnly=recoveryOnly;report.recoveryEvidence=recoveryOnly?source.recoveryProxies:undefined;report.previouslyCataloguedRoutesExcluded=freshOnly?source.previouslyCataloguedProxyCount:0;report.candidateCount=proxies.length;let admitted=null,denied=false;
  const check=async (proxy,{url='https://rrk.ir/robots.txt',tls12=false}={})=>{const item={proxy,url,tls12,at:new Date().toISOString()};report.attempts.push(item);let stdout='';try{({stdout}=await execute('curl',regionalArgs(proxy,url,{tls12,caBundle}),{env,cwd:scratch,timeout:12000,maxBuffer:1600000}));}catch(e){stdout=String(e.stdout||'');item.error=String(e.stderr||e.message).slice(0,240);item.proxyRefused=/CONNECT tunnel failed, response (?:401|403|407|429)/i.test(item.error); /* No TLS to RRK was established; never retry this refusing proxy. */}
   const n=stdout.lastIndexOf('\n__RRK_META__');if(n>=0){item.status=Number(stdout.slice(n+13))||0;const body=stdout.slice(0,n);if([401,403,429].includes(item.status))denied=true;if(item.status===404||(item.status===200&&/^\s*User-agent\s*:/mi.test(body))){item.robotsAllowed=item.status===404||robotAllows(body,target);if(item.robotsAllowed&&!admitted){admitted=proxy;report.admittedHost=new URL(url).hostname;}}}
   save();
  };
  if(compatibilityFrom){for(const proxy of proxies){await check(proxy,{url:'https://www.rrk.ir/robots.txt',tls12:true});if(!admitted&&!denied)await check(proxy,{url:'https://rrk.ir/robots.txt',tls12:true});}}else{for(let i=0;i<proxies.length&&!admitted&&!denied;i+=2){await Promise.all(proxies.slice(i,i+2).map(proxy=>check(proxy)));await new Promise(r=>setTimeout(r,1000));}}
  report.tlsDiagnostics=[];
  if(!denied&&!admitted){for(const a of report.attempts.filter(a=>/unable to get local issuer/i.test(a.error||'')||(tlsOnly&&a.proxy==='http://93.118.120.60:8080')).slice(0,2)){
   const p=parsePublicProxy(a.proxy);if(!p||p.protocol!=='http')continue;
   const d={proxy:p.url};let output='';try{const r=await execute('openssl',['s_client','-proxy',new URL(p.url).hostname+':'+new URL(p.url).port,'-connect','rrk.ir:443','-servername','rrk.ir','-showcerts','-verify_return_error','-verify_hostname','rrk.ir'],{env,cwd:scratch,timeout:15000,maxBuffer:100000});output=r.stdout;}catch(e){output=String(e.stdout||'');d.error=String(e.stderr||e.message).slice(0,600);}
   d.certificates=[];for(const cert of output.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)||[]){try{const x=new X509Certificate(cert);d.certificates.push({subject:x.subject,issuer:x.issuer,serialNumber:x.serialNumber,hostnameVerified:x.checkHost('rrk.ir')==='rrk.ir',subjectAltName:x.subjectAltName,infoAccess:x.infoAccess,validFrom:x.validFrom,validTo:x.validTo,fingerprint256:x.fingerprint256});}catch{}}
   report.tlsDiagnostics.push(d);save();
  }}
  report.stoppedOnAccessDenial=denied;report.routeAdmitted=Boolean(admitted);
  if(admitted&&!denied){
   if(caBundle){try{const {stdout}=await execute('curl',regionalArgs(admitted,target.replace('rrk.ir',report.admittedHost||'rrk.ir'),{caBundle}),{env,cwd:scratch,timeout:12000,maxBuffer:1600000});const n=stdout.lastIndexOf('\n__RRK_META__');const html=stdout.slice(0,n),status=Number(stdout.slice(n+13));report.verifiedSearchPage={status,characters:html.length,title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||null,publicSearchFormLocated:/P199_NEWSPAPERDATE_AZ/.test(html),fullNoticeExtracted:false};report.verifiedSearchPage.fields=[...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid=["']([^"']+)["']/gi)].map(m=>m[1]);const text=redactPersonalNumbers(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());report.verifiedSearchPage.textExcerpt=text.slice(0,10000);report.verifiedSearchPage.textTruncated=text.length>10000;}catch(e){report.verifiedSearchPage={error:String(e.stderr||e.message).slice(0,400)};}}
  const {default:puppeteer}=await import('puppeteer');const proxy=parsePublicProxy(admitted);browser=await puppeteer.launch({headless:true,env,args:['--no-sandbox','--disable-dev-shm-usage',`--proxy-server=${proxy.url}`,...(compatibilityFrom?['--ssl-version-max=tls1.2']:[])]});
   const page=await browser.newPage();await page.setUserAgent('SripPublicSourceAssessment/1.0');await page.setBypassServiceWorker(true);await page.setRequestInterception(true);let requests=0;
   if(caBundle)verifiedTransport=createVerifiedCurlTransport({proxy:proxy.url,bundle:caBundle,scratch,env,execute});
   page.on('request',r=>{let allowed=false;try{const u=new URL(r.url());allowed=++requests<=80&&u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&!['image','font','media','stylesheet'].includes(r.resourceType());}catch{}void(allowed?(verifiedTransport?verifiedTransport.handle(r):r.continue()):r.abort()).catch(()=>{});});
   const browserTarget=target.replace('rrk.ir',report.admittedHost||'rrk.ir');report.browser={proxy:admitted,target:browserTarget};
   try{const response=await page.goto(browserTarget,{waitUntil:'domcontentloaded',timeout:75000});report.browser.status=response?.status();if(response?.status()===200){await new Promise(r=>setTimeout(r,1500));const dom=await page.evaluate(()=>({title:document.title,text:document.body.innerText,fields:[...document.querySelectorAll('input')].map(e=>({id:e.id,type:e.type})).filter(e=>e.type!=='hidden'),buttons:[...document.querySelectorAll('button')].map(e=>({id:e.id,text:e.innerText}))}));report.browser.title=redactPersonalNumbers(dom.title);report.browser.textExcerpt=redactPersonalNumbers(dom.text).slice(0,5000);report.browser.fields=dom.fields;report.browser.buttons=dom.buttons.map(b=>({...b,text:redactPersonalNumbers(b.text)}));report.browser.publicSearchFormLocated=dom.fields.some(i=>i.id==='P199_NEWSPAPERDATE_AZ');if(verifiedTransport&&report.browser.publicSearchFormLocated)await samplePublicNotices(page,{runId,files,report,transport:verifiedTransport});}}
   catch(e){report.browser.error=e.message.slice(0,250);}report.browser.requests=requests;
  }
 }catch(e){report.error=e.message.slice(0,300);}
 finally{if(verifiedTransport){await verifiedTransport.close();report.verifiedBrowserTransport=verifiedTransport.report;}if(browser)await browser.close().catch(()=>{});fs.rmSync(scratch,{recursive:true,force:true});report.finishedAt=new Date().toISOString();save();}
 return {files,report};
}
