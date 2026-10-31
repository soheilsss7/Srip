import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// Serializable browser function. Reads already loaded public DOM only; never clicks or requests News.
export function extractEmbeddedNoticesFromDOM(companyId, root=document) {
  const text=n=>(n.innerText||n.textContent||'').replace(/\s+/g,' ').trim();
  const digits=s=>s.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
  if(!/^\d{11}$/.test(companyId))return [];
  const eligible=n=>!['A','SCRIPT','STYLE'].includes(n.tagName) && /^آگهی\s+(?:تغییرات|تاسیس|تأسیس|ثبت)/.test(text(n)) && text(n).length>=150 && text(n).length<=20000 && new RegExp('شناسه\\s*ملی\\s*'+companyId+'(?!\\d)').test(digits(text(n)));
  const candidates=[...root.querySelectorAll('p,div,article,section')].filter(eligible);
  const results=[],seen=new Set();
  for(const node of candidates) {
    if(candidates.some(child=>child!==node && node.contains(child)))continue;
    let container=node,noticeId=null;
    for(let depth=0;container && depth<8;depth++,container=container.parentElement) {
      const ids=[...new Set([...container.querySelectorAll('a[href]')].map(a=>{
        try{const u=new URL(a.getAttribute('href'),'https://rasmio.com');return u.origin==='https://rasmio.com' && u.pathname.match(/^\/News\/(\d+)\/?$/i)?.[1];}catch{return null;}
      }).filter(Boolean))];
      if(ids.length>1)break;
      if(ids.length===1){noticeId=ids[0];break;}
    }
    if(!noticeId)continue;
    const original=text(node),normalized=digits(original);
    const truncated=/…|\.{3}|شناسه\s*ملی\s*\d{1,10}\s*$/.test(normalized);
    const redacted=normalized.replace(/(?<!\d)\d{10}(?!\d)/g,'[شناسه شخصی حذف شد]');
    const key=noticeId+'|'+redacted;if(seen.has(key))continue;seen.add(key);
    results.push({noticeId,companyId,text:redacted,publisherNoticeURL:`https://rasmio.com/News/${noticeId}/`,publisherTruncationDetected:truncated,fullOfficialNoticeVerified:false,directOfficialSourceFetched:false});
  }
  return results;
}
export function persistEmbeddedNotices({notices,companyId,sourceURL,dataDir,outDir,runId,now=new Date().toISOString()}) {
  if(!/^\d{11}$/.test(companyId))throw new Error('Invalid company identity');
  const source=new URL(sourceURL);
  if(source.origin!=='https://rasmio.com' || source.pathname!==`/company/${companyId}/direct/`)throw new Error('Notice source mismatch');
  const receipts=[];
  for(const n of notices) {
    if(n.companyId!==companyId || !/^\d+$/.test(n.noticeId) || !n.text.includes(companyId) || /(?<!\d)\d{10}(?!\d)/.test(n.text))throw new Error('Invalid notice evidence');
    const bodySHA256=crypto.createHash('sha256').update(n.text).digest('hex');
    const file=path.join(dataDir,'sources','rasmio','notices',`${n.noticeId}.json`);
    let previous={noticeId:n.noticeId,variants:[]};
    if(fs.existsSync(file))previous=JSON.parse(fs.readFileSync(file,'utf8'));
    if(previous.noticeId!==n.noticeId || !Array.isArray(previous.variants))throw new Error('Stored notice mismatch');
    if(previous.variants.some(v=>v.bodySHA256===bodySHA256 && v.companyId===companyId))continue;
    previous.variants.push({...n,directOfficialSourceFetched:false,fullOfficialNoticeVerified:false,bodySHA256,sourceURL,acquisition:'public-company-page-dom',retrievedAt:now,sourceRun:runId});
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const serialized=JSON.stringify(previous,null,2)+'\n';fs.writeFileSync(file,serialized);
    const receipt={noticeId:n.noticeId,file,sha256:crypto.createHash('sha256').update(serialized).digest('hex'),bodySHA256,sourceURL,runId,at:now,directOfficialSourceFetched:false,truncated:n.publisherTruncationDetected};
    fs.mkdirSync(outDir,{recursive:true});fs.appendFileSync(path.join(outDir,`mirrored-notices-${String(runId).replace(/[^\w-]/g,'')}.jsonl`),JSON.stringify(receipt)+'\n');receipts.push(receipt);
  }
  return receipts;
}
