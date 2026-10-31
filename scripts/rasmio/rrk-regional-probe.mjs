// Bounded public regional routing assessment; no credentials, TLS bypass or CAPTCHA solving.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parsePublicProxy} from './public-proxy-candidates.mjs';
import {robotAllows,redactPersonalNumbers} from '../../tools/rrk-local/core.mjs';
const execute=promisify(execFile);
const target='https://rrk.ir/ords/r/rrs/rrs-front/%D8%AF%D8%A7%D8%AF%D9%87-%D8%A8%D8%A7%D8%B2';
export function regionalArgs(proxy,url){
 const p=parsePublicProxy(proxy);if(!p||!['https://rrk.ir/robots.txt',target].includes(url))throw new Error('Unapproved regional route or target');
 return ['-q','--silent','--show-error','--proxy',p.url.replace(/^socks5:/,'socks5h:').replace(/^socks4:/,'socks4a:'),'--noproxy','','--proto','=https','--max-redirs','0','--connect-timeout','5','--max-time','10','--max-filesize','1500000','--user-agent','SripPublicSourceAssessment/1.0',url,'--write-out','\n__RRK_META__%{http_code}'];
}
export async function runRrkRegionalProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');fs.mkdirSync('out',{recursive:true});const file=`out/rrk-regional-probe-${runId}.json`,files=[file];
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rrk-regional-')),env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'};
 const report={runId,startedAt:new Date().toISOString(),mode:'rrk-public-regional-routing',limits:{routes:24,concurrency:2,secondsPerCurl:10,browserSeconds:45000,browserRequests:80},attempts:[],verifiedProfiles:[],verifiedExitCount:0,advertsExtracted:0,relationshipsExtracted:0,canonicalRecordsChanged:false,fullCoverageVerified:false};
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));let browser;save();
 try{
  const source=JSON.parse(fs.readFileSync(new URL('./rrk-regional-proxies.json',import.meta.url),'utf8'));report.proxySource={url:source.source,blob:source.sourceBlob,countryReportedByPublisher:source.countryReportedByPublisher,countryIndependentlyVerified:false};
  const proxies=source.proxies.filter(p=>parsePublicProxy(p)).slice(0,24);let admitted=null,denied=false;
  const check=async proxy=>{const item={proxy,at:new Date().toISOString()};report.attempts.push(item);let stdout='';try{({stdout}=await execute('curl',regionalArgs(proxy,'https://rrk.ir/robots.txt'),{env,cwd:scratch,timeout:12000,maxBuffer:1600000}));}catch(e){stdout=String(e.stdout||'');item.error=String(e.stderr||e.message).slice(0,240);if(/(?:response|HTTP)\s*(?:401|403|429)\b/i.test(item.error))denied=true;}
   const n=stdout.lastIndexOf('\n__RRK_META__');if(n>=0){item.status=Number(stdout.slice(n+13))||0;const body=stdout.slice(0,n);if([401,403,429].includes(item.status))denied=true;if(item.status===200&&/^\s*User-agent\s*:/mi.test(body)){item.robotsAllowed=robotAllows(body,target);if(item.robotsAllowed&&!admitted)admitted=proxy;}}
   save();
  };
  for(let i=0;i<proxies.length&&!admitted&&!denied;i+=2){await Promise.all(proxies.slice(i,i+2).map(check));await new Promise(r=>setTimeout(r,1000));}
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
