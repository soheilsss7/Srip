// Connectivity assessment only. Never reuses third-party sessions, submits forms, or bypasses TLS/CAPTCHA.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inspectRrkHTML} from './rrk-probe.mjs';
import {parsePublicProxy} from './public-proxy-candidates.mjs';
const execute=promisify(execFile);
export function rrkDiagnosticArgs(url,{proxy,ipv6=false}={}){
 const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||!['rrk.ir','www.rrk.ir'].includes(u.hostname)||u.port||u.username||u.password)throw new Error('Invalid diagnostic target');
 const args=['-q','--silent','--show-error',ipv6?'-6':'-4','--connect-timeout','6','--max-time','12','--max-filesize','1500000','--max-redirs','0','--proto','=http,https','--user-agent','SripPublicSourceAssessment/1.0'];
 if(proxy){const p=parsePublicProxy(proxy);if(!p||!['http','https'].includes(p.protocol))throw new Error('Invalid diagnostic proxy');args.push('--proxy',p.url,'--noproxy','');}else args.push('--noproxy','*');
 return [...args,url,'--write-out','\n__RRK_META__%{http_code}\t%{remote_ip}\t%{time_total}\t%{redirect_url}'];
}
export async function runRrkRouteAssessment(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');fs.mkdirSync('out',{recursive:true});
 const file=`out/rrk-route-probe-${runId}.json`,scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rrk-connectivity-'));
 const env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'};
 const report={runId,mode:'rrk-bounded-route-assessment',startedAt:new Date().toISOString(),requests:[],dns:[],limits:{maxCurlTargetRequests:8,maxBrowserNavigations:1,maxBrowserRequests:60,concurrency:2,secondsPerCurlRequest:12,browserNavigationSeconds:45},canonicalRecordsChanged:false,advertsExtracted:0,relationshipsExtracted:0,verifiedProfiles:[],attempts:[],verifiedExitCount:0,fullCoverageVerified:false};
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));
 const check=async(url,options={})=>{
  const item={url,route:options.proxy?'public-proxy':options.ipv6?'direct-ipv6':'direct-ipv4',proxy:options.proxy||null,at:new Date().toISOString()};report.requests.push(item);save();
  let stdout='';
  try{({stdout}=await execute('curl',rrkDiagnosticArgs(url,options),{env,cwd:scratch,timeout:14000,maxBuffer:1600000}));}
  catch(e){stdout=String(e.stdout||'');item.error=String(e.stderr||e.message).slice(0,300);}
  const n=stdout.lastIndexOf('\n__RRK_META__');
  if(n>=0){const body=stdout.slice(0,n),[status,remoteIP,seconds,redirect]=stdout.slice(n+'\n__RRK_META__'.length).split('\t');item.status=Number(status)||0;item.remoteIP=remoteIP;item.seconds=Number(seconds);item.bytes=Buffer.byteLength(body);if(redirect){try{const u=new URL(redirect);item.redirect={host:u.hostname,path:u.pathname};}catch{}}
   if(item.status===200){item.html=inspectRrkHTML(body);item.apexIndicated=/apex\.(?:init|widget)|p_flow_id|\/i\/libraries\/apex/i.test(body);item.noticeNationalIdFields=(body.match(/P\d+_(?:SABTNATIONALID|COMPANYNAME|TEXT)_DISPLAY/g)||[]).slice(0,8);}
  }
  save();
 };
 try{
  for(const host of ['rrk.ir','www.rrk.ir']){try{report.dns.push({host,addresses:await dns.lookup(host,{all:true})});}catch(e){report.dns.push({host,error:e.message});}}save();
  const tests=[['https://rrk.ir/ords/r/rrs/rrs-front/home',{}],['https://rrk.ir/ords/r/rrs/rrs-front/%D8%AF%D8%A7%D8%AF%D9%87-%D8%A8%D8%A7%D8%B2',{}],['https://www.rrk.ir/ords/r/rrs/rrs-front/home',{}],['http://rrk.ir/ords/r/rrs/rrs-front/home',{}],['https://rrk.ir/ords/r/rrs/rrs-front/home',{ipv6:true}],['https://rrk.ir/robots.txt',{}]];
  for(let i=0;i<tests.length;i+=2)await Promise.all(tests.slice(i,i+2).map(([url,o])=>check(url,o)));
  // A network timeout is not an access grant or a denial. Two previously observed public routes can diagnose reachability.
  // Never try alternate routes after an explicit HTTP access/rate denial.
  if(!report.requests.some(r=>[200,401,403,429].includes(r.status))){
   const preferred=[];
   for(const name of fs.readdirSync('out').filter(f=>/^proxy-transport-\d+\.json$/.test(f)).sort().reverse().slice(0,30)){
    try{const d=JSON.parse(fs.readFileSync(path.join('out',name),'utf8'));for(const o of d.outcomes||[])if(o.success&&parsePublicProxy(o.proxy))preferred.push(o.proxy);}catch{}
   }
   for(const proxy of [...new Set(preferred)].slice(0,2)){
    await check('https://rrk.ir/ords/r/rrs/rrs-front/home',{proxy});
    if(report.requests.some(r=>[401,403,429].includes(r.status)))break;
   }
  }
  let browser;
  try {
   const {default:puppeteer}=await import('puppeteer');
   browser=await puppeteer.launch({headless:true,env,args:['--no-sandbox','--disable-dev-shm-usage']});
   const page=await browser.newPage();await page.setBypassServiceWorker(true);await page.setRequestInterception(true);
   let count=0;report.browser={startedAt:new Date().toISOString(),failedRequests:[]};
   page.on('request',r=>{let allowed=false;try{const u=new URL(r.url());allowed=++count<=60&&u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&!['image','font','media'].includes(r.resourceType());if(r.isNavigationRequest()&&r.frame()===page.mainFrame())allowed=allowed&&u.pathname.startsWith('/ords/');}catch{}void(allowed?r.continue():r.abort()).catch(()=>{});});
   page.on('requestfailed',r=>{if(report.browser.failedRequests.length<10)report.browser.failedRequests.push({navigation:r.isNavigationRequest(),error:r.failure()?.errorText});});
   try{const response=await page.goto('https://rrk.ir/ords/r/rrs/rrs-front/%D8%AF%D8%A7%D8%AF%D9%87-%D8%A8%D8%A7%D8%B2',{waitUntil:'domcontentloaded',timeout:45000});report.browser.status=response?.status();if(response?.status()===200){await new Promise(r=>setTimeout(r,2500));report.browser.page=await page.evaluate(()=>({title:document.title,textExcerpt:document.body.innerText.slice(0,2000).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/(?<!\d)\d{10}(?!\d)/g,'[ده‌رقمی حذف شد]'),forms:document.forms.length,advertLinks:[...document.querySelectorAll('a')].filter(a=>/آگهی|جستجو/.test(a.textContent)).map(a=>({text:a.textContent.trim().slice(0,100),path:new URL(a.href,location.href).pathname})).slice(0,15)}));}}
   catch(e){report.browser.error=String(e.message).slice(0,300);}
   report.browser.requests=count;report.browser.finishedAt=new Date().toISOString();save();
  }catch(e){report.browser={error:String(e.message).slice(0,300)};}
  finally{if(browser)await browser.close().catch(()=>{});}
 }catch(e){report.error=e.message;}
 finally{report.finishedAt=new Date().toISOString();save();fs.rmSync(scratch,{recursive:true,force:true});}
 return {files:[file],report};
}
