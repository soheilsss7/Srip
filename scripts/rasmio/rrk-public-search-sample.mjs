// One public company search and at most two notices. Never clicks login, payment, export or CAPTCHA controls.
import fs from 'node:fs';import {noticeFromFields,validateRecord,normalizeDigits,redactPersonalNumbers} from '../../tools/rrk-local/core.mjs';
export async function samplePublicNotices(page,{runId,files,report,transport}){
 const company='10100014553';const result={companyNationalId:company,searches:0,maxNotices:2,notices:[],paymentAttempted:false,loginAttempted:false};report.publicNoticeSample=result;
 if(transport.report.stoppedOnAccessDenial)return;
 if(!await page.evaluate(()=>typeof window.apex?.item==='function'&&typeof window.apex?.server?.plugin==='function')){result.reason='Required public APEX runtime did not load; no search attempted';return;}
 if(await page.$('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],.g-recaptcha,.h-captcha')){result.reason='CAPTCHA present; no search attempted';return;}
 await page.waitForSelector('#P199_NATIONALCODECOMPANY',{timeout:10000});
 const button=await page.evaluate(()=>{const input=document.querySelector('#P199_NATIONALCODECOMPANY');const region=input?.closest('.t-Region')||document;const candidates=[...region.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&b.textContent.trim()==='جستجو');const known=candidates.find(b=>b.id==='B912476867105247978');return known?.id||(candidates.length===1?candidates[0].id:null);});
 if(!button){result.reason='No unambiguous public search button';return;}
 await page.evaluate(value=>{if(window.apex?.item)window.apex.item('P199_NATIONALCODECOMPANY').setValue(value);else {const input=document.getElementById('P199_NATIONALCODECOMPANY');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}},company);await page.evaluate(id=>document.getElementById(id).click(),button);result.searches=1;
 try{await page.waitForNetworkIdle({idleTime:1500,timeout:20000});}catch{}
 if(transport.report.stoppedOnAccessDenial)return;
 const located=await page.evaluate(()=>{
  const found=[];for(const a of document.querySelectorAll('tr a[href]')){try{const u=new URL(a.getAttribute('href'),location.href);if(u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&(u.pathname.startsWith('/ords/r/rrs/rrs-front/')||/^200:28:/.test(u.searchParams.get('p')||'')))found.push(u.href);}catch{}}for(const e of document.querySelectorAll('a,button')){for(const encoded of [e.getAttribute('href'),e.getAttribute('onclick')].filter(Boolean)){const raw=encoded.replace(/\\u002f/gi,'/').replace(/\\u0026/gi,'&').replace(/\\u003f/gi,'?').replace(/\\u003d/gi,'=');
   const candidates=[raw,...(raw.match(/(?:https:\/\/(?:www\.)?rrk\.ir)?\/?ords\/f\?p=200:28:[^\s'"<>)]*/g)||[])];
   for(const c of candidates){try{const u=new URL(c,location.href);if(u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&/^200:28:/.test(u.searchParams.get('p')||''))found.push(u.href);}catch{}}
  }}return {links:[...new Set(found)].slice(0,2),rowCount:document.querySelectorAll('.a-GV-row').length,text:document.body.innerText};
 });
 result.renderedRows=located.rowCount;result.detailLinksLocated=located.links.length;
 result.searchTextExcerpt=redactPersonalNumbers(located.text).slice(0,5000);
 for(const url of located.links){
  if(transport.report.stoppedOnAccessDenial)break;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});if(response?.status()!==200)continue;
  const fields=await page.evaluate(()=>{const value=id=>{const e=document.getElementById(id);return e?.value||e?.innerText||'';};return {companyName:value('P28_COMPANYNAME'),companyNationalId:value('P28_SABTNATIONALID_DISPLAY'),registrationNumber:value('P28_SABTNUMBER_DISPLAY'),noticeText:value('P28_TEXT_DISPLAY'),title:document.title};});
  if(normalizeDigits(fields.companyNationalId).replace(/\s/g,'')!==company){result.notices.push({accepted:false,reason:'Company identity does not match requested company'});continue;}
  try{const record=validateRecord(noticeFromFields(fields,url));record.retrieval={runId,transport:'strict-tls-curl-backed-browser',publicSearchCompany:company,fullNoticeDOMFieldReceived:true};const file=`out/rrk-notice-${record.contentHash}.json`;fs.writeFileSync(file,JSON.stringify(record,null,2));files.push(file);result.notices.push({accepted:true,file,recordId:record.recordId,characters:record.text.length,personObservations:record.personObservations.length});report.advertsExtracted++;report.relationshipsExtracted+=record.personObservations.length;}catch(e){result.notices.push({accepted:false,reason:e.message});}
 }
}
