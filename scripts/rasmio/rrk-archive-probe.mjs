import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {noticeFromFields,normalizeDigits,redactPersonalNumbers,graphFor} from '../../tools/rrk-local/core.mjs';
export function permittedArchiveEntry(r){
 try{const u=new URL(r.url);return ['http:','https:'].includes(u.protocol)&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&/^\/News\/Show(?:Old)?News\.aspx$/i.test(u.pathname)&&/^\d+$/.test(u.searchParams.get('Code')||'')&&r.status==='200'&&/^crawl-data\/CC-MAIN-\d{4}-\d{2}\/segments\/[\d.]+\/warc\/[\w.-]+\.warc\.gz$/.test(r.filename)&&Number.isSafeInteger(Number(r.offset))&&Number(r.offset)>=0&&Number.isSafeInteger(Number(r.length))&&Number(r.length)>0&&Number(r.length)<2000000;}catch{return false;}
}
export function archivedHTML(bytes,entry){
 if(!permittedArchiveEntry(entry))throw new Error('Invalid archived target/range');
 const raw=gunzipSync(bytes,{maxOutputLength:8000000});const split=raw.indexOf('\r\n\r\n');if(split<0)throw new Error('Invalid WARC');
 const header=raw.subarray(0,split).toString('utf8');const target=header.match(/^WARC-Target-URI:\s*(.+)$/mi)?.[1]?.trim();
 if(target!==entry.url||!/^WARC-Type:\s*response\s*$/mi.test(header))throw new Error('WARC identity mismatch');
 const http=raw.subarray(split+4);const end=http.indexOf('\r\n\r\n');if(end<0||!/^HTTP\/\d(?:\.\d)? 200\b/.test(http.subarray(0,end).toString()))throw new Error('No archived HTTP 200');
 const headers=http.subarray(0,end).toString('latin1');if(/Transfer-Encoding:\s*chunked|Content-Encoding:/i.test(headers))throw new Error('Encoded archived HTTP not yet supported');
 const len=Number(header.match(/^Content-Length:\s*(\d+)/mi)?.[1]);if(!Number.isSafeInteger(len)||len<end+4||split+4+len>raw.length)throw new Error('Invalid WARC length');
 return http.subarray(end+4,len).toString('utf8');
}
async function bounded(url,opts={},max=2000000){
 const r=await fetch(url,{...opts,redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw new Error(`HTTP ${r.status}`);
 if(opts.headers?.Range&&r.status!==206){await r.body.cancel();throw new Error('Archive server did not honor byte range');}
 const reader=r.body.getReader();let n=0;const chunks=[];
 try{for(;;){const a=await reader.read();if(a.done)break;n+=a.value.length;if(n>max)throw new Error('Response too large');chunks.push(a.value);}}finally{await reader.cancel().catch(()=>{});}
 return {bytes:Buffer.concat(chunks),range:r.headers.get('content-range')};
}
export async function runRrkArchiveProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');fs.mkdirSync('out',{recursive:true});
 const reportFile=`out/rrk-archive-probe-${runId}.json`,files=[reportFile];
 const report={runId,mode:'rrk-public-archive-assessment',startedAt:new Date().toISOString(),limits:{indexCollections:4,maxArchivedPages:8,concurrency:1},collections:[],attempts:[],records:[],advertsExtracted:0,relationshipsExtracted:0,verifiedProfiles:[],verifiedExitCount:0,canonicalRecordsChanged:false,liveSourceFetched:false,fullCoverageVerified:false};
 let browser;const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));save();
 try{
  const entries=[],seen=new Set();
  for(const collection of ['CC-MAIN-2020-50','CC-MAIN-2019-51','CC-MAIN-2018-51','CC-MAIN-2017-51']){
   const check={collection};report.collections.push(check);
   try{const q=new URLSearchParams({url:'*.rrk.ir/*',output:'json',filter:'status:200'});const response=await bounded(`https://index.commoncrawl.org/${collection}-index?${q}`);const lines=response.bytes.toString().trim().split('\n');check.indexRows=lines.length;check.noticeEntries=0;
    for(const line of lines){let row;try{row=JSON.parse(line);}catch{continue;}if(!permittedArchiveEntry(row))continue;check.noticeEntries++;if(!seen.has(row.url)){seen.add(row.url);entries.push({...row,collection});}}
   }catch(e){check.error=e.message;}
   save();await new Promise(r=>setTimeout(r,1200));
  }
  report.candidateNotices=entries.length;
  if(entries.length){const {default:puppeteer}=await import('puppeteer');browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});}
  const captured=[];
  for(const e of entries.slice(0,8)){
   const item={sourceURL:e.url,capturedAt:e.timestamp,collection:e.collection};report.attempts.push(item);let page;
   try{
    const start=Number(e.offset),length=Number(e.length),end=start+length-1;
    const response=await bounded(`https://data.commoncrawl.org/${e.filename}`,{headers:{Range:`bytes=${start}-${end}`}},length);
    if(response.bytes.length!==length||response.range!==`bytes ${start}-${end}/${response.range?.split('/')[1]}`)throw new Error('Archive range mismatch');
    const html=archivedHTML(response.bytes,e);item.archiveSHA256=crypto.createHash('sha256').update(response.bytes).digest('hex');
    page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);page.on('request',r=>void r.abort().catch(()=>{}));
    await page.setContent(html,{waitUntil:'domcontentloaded',timeout:10000});
    const dom=await page.evaluate(()=>{
     const body=document.body.cloneNode(true);body.querySelectorAll('script,style,input,textarea,select').forEach(e=>e.remove());
     const text=body.textContent.replace(/\s+/g,' ').trim();
     return {title:document.title,text,formInputs:[...document.querySelectorAll('input')].map(e=>({id:e.id,type:e.type})).filter(e=>/captcha|securitycode/i.test(e.id)),ids:[...document.querySelectorAll('[id]')].map(e=>e.id).filter(x=>/news|company|national|bodytext/i.test(x)).slice(0,30)};
    });
    item.title=dom.title;item.structuredFieldIDs=dom.ids;
    if(dom.formInputs.some(i=>i.type!=='hidden'))throw new Error('Archived CAPTCHA/security form, not a usable notice');
    const text=normalizeDigits(dom.text);
    const nationalId=text.match(/شناسه\s*ملی\s*(?:شرکت)?\s*[:：]?\s*(\d{11})(?!\d)/)?.[1];
    const name=text.match(/آگهی\s*(?:تغییرات|تاسیس|تأسیس)\s*(?:شرکت|موسسه|مؤسسه)\s+(.{3,130}?)\s+(?:شرکت\s+سهامی|به\s*(?:شماره|شناسه)|سهامی\s*(?:خاص|عام))/)?.[1];
    if(!nationalId||!name)throw new Error('Company identity/name not available in archived page');
    const tracking=text.match(/شماره\s*پیگیری\s*(?:روزنامه\s*رسمی)?\s*[:：]?\s*(\d{6,25})/)?.[1]||`archive-${new URL(e.url).searchParams.get('Code')}`;
    const record=noticeFromFields({companyNationalId:nationalId,companyName:name,tracking,registrationNumber:text.match(/شماره\s*ثبت\s*[:：]?\s*(\d+)/)?.[1]||'',letterDate:text.match(/تاریخ\s*نامه\s*(?:اداره\s*ثبت)?\s*[:：]?\s*([\d/]+)/)?.[1]||'',title:dom.title,noticeText:text},e.url.replace(/^http:/,'https:'));
    record.acquisition={method:'commoncrawl-archive',originalURL:e.url,capturedAt:e.timestamp,collection:e.collection,filename:e.filename,offset:e.offset,length:e.length,indexDigest:e.digest,archiveSHA256:item.archiveSHA256,liveSourceVerified:false,noticeBodyBoundariesVerified:false};
    const dir='data/sources/rrk/archive/records';fs.mkdirSync(dir,{recursive:true});const file=`${dir}/${crypto.createHash('sha256').update(e.url).digest('hex')}.json`;const stored=JSON.stringify(record,null,2);fs.writeFileSync(file,stored);files.push(file);captured.push(record);
    item.outcome='archived-company-evidence-extracted';item.companyNationalId=nationalId;item.file=file;item.sha256=crypto.createHash('sha256').update(stored).digest('hex');report.records.push({recordId:record.recordId,companyNationalId:nationalId,companyName:name,file,sha256:item.sha256,personObservations:record.personObservations.length,archiveCapturedAt:e.timestamp});
   }catch(error){item.outcome='not-imported';item.error=redactPersonalNumbers(error.message).slice(0,250);}
   finally{if(page)await page.close().catch(()=>{});save();}
   await new Promise(r=>setTimeout(r,1000));
  }
  if(captured.length){const file=`data/sources/rrk/archive/graph-${runId}.json`;fs.writeFileSync(file,JSON.stringify({...graphFor(captured),liveSourceVerified:false,coverageVerified:false},null,2));files.push(file);}
  report.advertsExtracted=captured.length;report.relationshipsExtracted=captured.reduce((n,r)=>n+r.personObservations.length,0);
 }catch(e){report.error=e.message;}
 finally{if(browser)await browser.close().catch(()=>{});report.finishedAt=new Date().toISOString();save();}
 return {files,report};
}
