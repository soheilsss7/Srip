import fs from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {chromium} from 'playwright-core';
import {noticeFromFields,graphFor,robotAllows,sourceURL} from './core.mjs';
const args=process.argv.slice(2),option=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const positive=(x,cap)=>{const n=Number(x);if(!Number.isInteger(n)||n<1||n>cap)throw new Error('حد درخواست نامعتبر');return n;};
const maxPages=positive(option('--max-pages','10'),100),maxRecords=positive(option('--max-records','100'),1000);
const browserName=option('--browser','chrome'),out=path.resolve(option('--out','rrk-output'));
if(!['chrome','msedge'].includes(browserName))throw new Error('--browser فقط chrome یا msedge');
fs.mkdirSync(out,{recursive:true});
const checkpoint=path.join(out,'checkpoint.private.json'),exportFile=path.join(out,'rrk-export.json');
let state={pending:[],doneURLs:[],completedPages:[],discovered:0},records=[];
if(fs.existsSync(checkpoint))state=JSON.parse(fs.readFileSync(checkpoint,'utf8'));
if(fs.existsSync(exportFile))records=JSON.parse(fs.readFileSync(exportFile,'utf8')).records;
const byId=new Map(records.map(r=>[r.recordId,r])),done=new Set(state.doneURLs),errors=[];let policy='',context,listPage,stopReason='batch-limit',pages=0,processed=0,newRecords=0,updatedRecords=0;
function save(){
 if(listPage&&!listPage.isClosed())state.lastSearchURL=listPage.url();
 state.doneURLs=[...done];fs.writeFileSync(checkpoint,JSON.stringify(state,null,2),{mode:0o600});
 const bundle={schemaVersion:1,source:'rrk.ir',exportedAt:new Date().toISOString(),records:[...byId.values()],graph:graphFor([...byId.values()]),collection:{scope:'user-selected-public-search-results',archiveCoverageVerified:false,stopReason,pagesVisitedThisBatch:pages,recordsReadThisBatch:processed,newRecordsThisBatch:newRecords,updatedRecordsThisBatch:updatedRecords,pendingCount:state.pending.length,failedOrBlocked:errors}};
 fs.writeFileSync(exportFile+'.tmp',JSON.stringify(bundle,null,2),{mode:0o600});fs.renameSync(exportFile+'.tmp',exportFile);
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function gate(page){
 return page.evaluate(()=>{
  const visible=e=>!!(e.getClientRects().length);
  return [...document.querySelectorAll('input[type=password],input[name*=captcha i],input[id*=captcha i],iframe[src*=captcha i]')].some(visible)||/access denied|درخواست شما مجاز نیست|The Request is not Valid|verify you are human/i.test(document.title+' '+document.body.innerText.slice(0,600));
 });
}
async function fields(page){
 return page.evaluate(()=>{
  const text=selector=>document.querySelector(selector)?.textContent?.trim()||'';
  return {tracking:text('#P28_REFERENCENUMBER_DISPLAY'),companyNationalId:text('#P28_SABTNATIONALID_DISPLAY'),companyName:text('#P28_COMPANYNAME_DISPLAY'),registrationNumber:text('#P28_SABTNUMBER_DISPLAY'),letterDate:text('#P28_SABTDATE_DISPLAY'),title:text('#P28_TITLE_DISPLAY'),noticeText:text('#P28_TEXT_DISPLAY')||text('a-dynamic-content')};
 });
}
async function drain(){
 while(state.pending.length&&processed<maxRecords){
  const url=state.pending[0];sourceURL(url);if(!robotAllows(policy,url))throw new Error('robots.txt مسیر آگهی در صف را منع کرده است');if(done.has(url)){state.pending.shift();continue;}
  const page=await context.newPage();
  try{
   const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   if(!r||[401,403,429].includes(r.status()))throw new Error('HTTP access/rate gate; stopped');
   if(!r.ok())throw new Error('HTTP '+r.status());
   sourceURL(page.url());if(!robotAllows(policy,page.url()))throw new Error('robots.txt مسیر نهایی آگهی را منع کرده است');
   await page.waitForFunction(()=>document.querySelector('#P28_SABTNATIONALID_DISPLAY')?.textContent?.trim()||document.querySelector('input[type=password]'),null,{timeout:15000});
   if(await gate(page))throw new Error('ورود/کپچا/محدودیت؛ خودکار ادامه نمی‌دهیم');
   const record=noticeFromFields(await fields(page),url);
   const old=byId.get(record.recordId);
   if(old&&old.companyNationalId!==record.companyNationalId)throw new Error('تعارض شناسه شرکت در آگهی؛ ادغام متوقف شد');
   if(!old)newRecords++;else if(old.contentHash!==record.contentHash)updatedRecords++;
   byId.set(record.recordId,record);done.add(url);state.pending.shift();processed++;save();
   console.log(`ذخیره شد: ${record.companyName} | ${record.recordId} | تعداد این نوبت: ${processed}`);
  }catch(e){errors.push({kind:'detail',message:String(e.message).replace(/https?:\/\/\S+/g,'[نشانی محلی حذف شد]').slice(0,250)});stopReason='needs-review';save();throw e;}
  finally{await page.close().catch(()=>{});}
  await pause(1500);
 }
}
try{
 console.log('این برنامه فقط روی رایانهٔ خود شما اجرا می‌شود؛ هیچ داده‌ای به Arena/GitHub ارسال نمی‌کند.');
 console.log('پوشهٔ browser-profile و checkpoint.private.json را هرگز آپلود نکنید.');
 context=await chromium.launchPersistentContext(path.join(out,'browser-profile'),{channel:browserName,headless:false,acceptDownloads:false});
 const list=(context.pages()[0]||await context.newPage());listPage=list;
 if(state.lastSearchURL)sourceURL(state.lastSearchURL);
 try{await list.goto(state.lastSearchURL||'https://rrk.ir/ords/f?p=200:199',{waitUntil:'domcontentloaded',timeout:60000});}
 catch{console.log('نشانی اولیه باز نشد؛ در همین پنجرهٔ مرورگر به صفحهٔ عمومیِ قابل‌دسترسی خودتان بروید.');}
 const rl=createInterface({input:stdin,output:stdout});
 try{await rl.question('در مرورگر فقط جست‌وجوی عمومی موردنظر را انجام بدهید. اگر ورود لازم شد، برنامه را متوقف کنید. وقتی فهرست آگهی‌ها باز شد، اینجا Enter بزنید: ');}finally{rl.close();}
 const root=new URL(list.url());sourceURL(root.href);
 if(await gate(list))throw new Error('صفحهٔ عمومی فهرست آماده نیست یا محدودیت دارد');
 const robots=await context.request.get(root.origin+'/robots.txt',{timeout:20000,maxRedirects:0});
 policy='';
 if(robots.status()===200){policy=await robots.text();if(/<html/i.test(policy))throw new Error('robots.txt معتبر نیست؛ خزش خودکار آغاز نشد');}
 else if(robots.status()!==404)throw new Error('وضعیت robots.txt نامشخص است: '+robots.status());
 if(!robotAllows(policy,list.url()))throw new Error('robots.txt این مسیر را منع کرده است');
 await drain();
 while(pages<maxPages&&processed<maxRecords){
  if(await gate(list))throw new Error('در فهرست، ورود/کپچا یا محدودیت دیده شد');
  const links=await list.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>{try{const u=new URL(h);return u.origin===location.origin&&(u.pathname.includes('f-detail-ad')||(/^\/ords\/f$/.test(u.pathname)&&/^200:28:/.test(u.searchParams.get('p')||'')));}catch{return false;}}));
  const unique=[...new Set(links)];
  if(!unique.length)throw new Error('لینک آگهی پیدا نشد؛ ساختار صفحه باید بررسی شود، پایان آرشیو فرض نمی‌کنیم');
  const signature=unique.slice().sort().join('\n');
  if(state.completedPages.includes(signature))throw new Error('این صفحه قبلاً جمع‌آوری شده؛ برای ادامه به صفحه/جست‌وجوی دیگری بروید');
  for(const u of unique){sourceURL(u);if(!robotAllows(policy,u))throw new Error('robots.txt مسیر آگهی را منع کرده است');if(!done.has(u)&&!state.pending.includes(u))state.pending.push(u);}
  state.discovered+=unique.length;pages++;save();await drain();
  if(state.pending.length||processed>=maxRecords)break;
  state.completedPages.push(signature);save();
  const selectors=['button.a-GV-pageButton--next','button[aria-label="Next"]','button[title="Next"]','button[aria-label="صفحه بعد"]','button[title="صفحه بعد"]'];
  const next=list.locator(selectors.join(',')).filter({visible:true});
  if(await next.count()!==1){stopReason='pagination-needs-review';break;}
  if(await next.isDisabled()||await next.getAttribute('aria-disabled')==='true'){stopReason='visible-search-end-unverified';break;}
  await next.click();await pause(2500);save();
  const after=await list.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>h.includes('f-detail-ad')).sort().join('\n'));
  if(after===signature)throw new Error('تغییر صفحه تأیید نشد؛ بدون مدرک ادامه نمی‌دهیم');
 }
}catch(e){stopReason='needs-review';errors.push({kind:'collector',message:String(e.message).replace(/https?:\/\/\S+/g,'[نشانی محلی حذف شد]').slice(0,300)});console.error(e.message);process.exitCode=1;}
finally{save();if(context)await context.close().catch(()=>{});console.log(`خروجی قابل ارسال: ${exportFile}`);console.log(`علت توقف: ${stopReason} | پرونده‌های خروجی: ${byId.size}`);}
