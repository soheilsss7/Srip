// One public company search and at most two notices. Never clicks login, payment, export or CAPTCHA controls.
import fs from 'node:fs';import {noticeFromFields,validateRecord,normalizeDigits} from '../../tools/rrk-local/core.mjs';
export async function samplePublicNotices(page,{runId,files,report,transport}){
 const company='10100014553';const result={companyNationalId:company,searches:0,maxNotices:2,notices:[],paymentAttempted:false,loginAttempted:false};report.publicNoticeSample=result;
 if(transport.report.stoppedOnAccessDenial)return;
 await page.waitForSelector('#P199_NATIONALCODECOMPANY',{timeout:10000});
 const button=await page.evaluate(()=>{const input=document.querySelector('#P199_NATIONALCODECOMPANY');const region=input?.closest('.t-Region')||document;const candidates=[...region.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&b.textContent.trim()==='جستجو');const known=candidates.find(b=>b.id==='B912476867105247978');return known?.id||(candidates.length===1?candidates[0].id:null);});
 if(!button){result.reason='No unambiguous public search button';return;}
 await page.type('#P199_NATIONALCODECOMPANY',company);await page.evaluate(id=>document.getElementById(id).click(),button);result.searches=1;
 try{await page.waitForNetworkIdle({idleTime:1500,timeout:20000});}catch{}
 if(transport.report.stoppedOnAccessDenial)return;
 const located=await page.evaluate(()=>{
  const found=[];for(const e of document.querySelectorAll('a,button')){for(const encoded of [e.getAttribute('href'),e.getAttribute('onclick')].filter(Boolean)){const raw=encoded.replace(/\\u002f/gi,'/').replace(/\\u0026/gi,'&').replace(/\\u003f/gi,'?').replace(/\\u003d/gi,'=');
   const candidates=[raw,...(raw.match(/(?:https:\/\/(?:www\.)?rrk\.ir)?\/?ords\/f\?p=200:28:[^\s'"<>)]*/g)||[])];
   for(const c of candidates){try{const u=new URL(c,location.href);if(u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&/^200:28:/.test(u.searchParams.get('p')||''))found.push(u.href);}catch{}}
  }}return {links:[...new Set(found)].slice(0,2),rowCount:document.querySelectorAll('.a-GV-row').length,text:document.body.innerText};
 });
 result.renderedRows=located.rowCount;result.detailLinksLocated=located.links.length;
 result.searchTextExcerpt=located.text.replace(/(?<!\d)\d{10}(?!\d)/g,'[redacted]').slice(0,5000);
 for(const url of located.links){
  if(transport.report.stoppedOnAccessDenial)break;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});if(response?.status()!==200)continue;
  const fields=await page.evaluate(()=>{const value=id=>{const e=document.getElementById(id);return e?.value||e?.innerText||'';};return {companyName:value('P28_COMPANYNAME'),companyNationalId:value('P28_SABTNATIONALID_DISPLAY'),registrationNumber:value('P28_SABTNUMBER_DISPLAY'),noticeText:value('P28_TEXT_DISPLAY'),title:document.title};});
  if(normalizeDigits(fields.companyNationalId).replace(/\s/g,'')!==company){result.notices.push({accepted:false,reason:'Company identity does not match requested company'});continue;}
  try{const record=validateRecord(noticeFromFields(fields,url));record.retrieval={runId,transport:'strict-tls-curl-backed-browser',publicSearchCompany:company,fullNoticeDOMFieldReceived:true};const file=`out/rrk-notice-${record.contentHash}.json`;fs.writeFileSync(file,JSON.stringify(record,null,2));files.push(file);result.notices.push({accepted:true,file,recordId:record.recordId,characters:record.text.length,personObservations:record.personObservations.length});report.advertsExtracted++;report.relationshipsExtracted+=record.personObservations.length;}catch(e){result.notices.push({accepted:false,reason:e.message});}
 }
}
