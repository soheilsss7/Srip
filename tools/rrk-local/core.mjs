import crypto from 'node:crypto';
export const normalizeDigits=s=>String(s||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
export function sourceURL(value){
 const u=new URL(value);if(u.protocol!=='https:'||!['rrk.ir','www.rrk.ir'].includes(u.hostname)||u.port||u.username||u.password)throw new Error('نشانی باید HTTPS و متعلق به rrk.ir باشد');
 const safe=new URL(u.origin+u.pathname);
 for(const [k,v]of u.searchParams)if(/^(?:p28_)?(?:id|code|newsid|hcnewsid|referencenumber|trackingnumber)$/i.test(k)&&/^[\w-]{1,100}$/.test(v))safe.searchParams.set(k,v);
 return safe.href;
}
export function redactPersonalNumbers(text){return normalizeDigits(text).replace(/(?<!\d)\d{10}(?!\d)/g,'[شمارهٔ شخصی/ده‌رقمی حذف شد]');}
export function noticeFromFields(fields,url){
 const nationalId=normalizeDigits(fields.companyNationalId).replace(/\s/g,'');
 if(!/^\d{11}$/.test(nationalId))throw new Error('شناسه ملی ۱۱رقمی شرکت پیدا نشد؛ پرونده وارد نشد');
 const original=String(fields.noticeText||'').trim();
 if(original.length<40)throw new Error('متن آگهی پیدا نشد یا بسیار کوتاه است');
 const text=redactPersonalNumbers(original),tracking=normalizeDigits(fields.tracking||'').trim();
 const source=sourceURL(url);
 const evidence={companyNationalId:nationalId,companyName:redactPersonalNumbers(fields.companyName||''),tracking:/^[\w-]{3,80}$/.test(tracking)?tracking:null,registrationNumber:redactPersonalNumbers(fields.registrationNumber||''),letterDate:redactPersonalNumbers(fields.letterDate||''),title:redactPersonalNumbers(fields.title||''),text,sourceURL:source};
 const contentHash=crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
 const recordId=evidence.tracking?`rrk:${evidence.tracking}`:`rrk:sha256:${contentHash}`;
 const observations=[];
 const roles='مدیر\\s*عامل|رئیس\\s*هی[ئأ]ت\\s*مدیره|نایب\\s*رئیس\\s*هی[ئأ]ت\\s*مدیره|عضو\\s*هی[ئأ]ت\\s*مدیره|بازرس\\s*اصلی|بازرس\\s*علی[‌\\s]*البدل';
 const re=new RegExp(`(?:آقای|خانم)\\s+([\\p{Script=Arabic}‌]+(?:\\s+[\\p{Script=Arabic}‌]+){1,5}?)\\s+(?:(?:به\\s+شماره\\s+ملی|کد\\s*ملی|به\\s+کد\\s*ملی)\\s*\\d{10}\\s+)?(?:به\\s*سمت|بسمت)\\s+(${roles})`,'gu');
 for(const m of normalizeDigits(original).matchAll(re)){
  const n=observations.length;observations.push({observationId:`${recordId}:person-observation:${n}`,name:m[1].replace(/\s+/g,' ').trim(),role:m[2].replace(/\s+/g,' ').trim(),identityResolution:'unresolved',currentRoleVerified:false,evidence:redactPersonalNumbers(m[0])});
 }
 return {recordId,source:'rrk.ir',...evidence,contentHash,capturedAt:new Date().toISOString(),personObservations:observations,coverage:{fullProfileVerified:false,allRelationshipsVerified:false,parser:'conservative-explicit-name-role-v1'},privacy:{tenDigitNumbersRedacted:true,browserSessionExported:false}};
}
export function graphFor(records){
 const nodes=new Map(),edges=[];
 for(const r of records){
  const company=`company:${r.companyNationalId}`;nodes.set(company,{id:company,type:'company',nationalId:r.companyNationalId,name:r.companyName});
  for(const p of r.personObservations){nodes.set(p.observationId,{id:p.observationId,type:'person-observation',name:p.name,identityResolution:'unresolved'});edges.push({from:p.observationId,to:company,role:p.role,sourceRecord:r.recordId,sourceURL:r.sourceURL,letterDate:r.letterDate,currentRoleVerified:false,evidence:p.evidence});}
 }
 return {nodes:[...nodes.values()],edges,identityMergesPerformed:0};
}
export function robotAllows(text,url){
 const target=new URL(url).pathname;
 // Conservative: apply every Disallow group, not just the wildcard group.
 for(const line of text.split(/\r?\n/)){const m=line.replace(/#.*/,'').match(/^\s*Disallow\s*:\s*(\S+)/i);if(!m)continue;
  const rule=m[1],escaped=rule.split('*').map(s=>s.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*');
  if(new RegExp('^'+escaped).test(target))return false;
 }
 return true;
}
export function validateRecord(r){
 if(r.source!=='rrk.ir'||!/^\d{11}$/.test(r.companyNationalId||''))throw new Error('Invalid source/company identity');
 const evidence={companyNationalId:r.companyNationalId,companyName:r.companyName,tracking:r.tracking,registrationNumber:r.registrationNumber,letterDate:r.letterDate,title:r.title,text:r.text,sourceURL:sourceURL(r.sourceURL)};
 for(const k of ['companyName','registrationNumber','letterDate','title','text'])if(typeof evidence[k]!=='string')throw new Error('Invalid notice fields');
 if(evidence.text.length<40||evidence.text.length>1000000)throw new Error('Invalid notice length');
 if(redactPersonalNumbers(evidence.text)!==evidence.text)throw new Error('Personal numbers must be redacted');
 const hash=crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
 if(hash!==r.contentHash)throw new Error('Content hash mismatch');
 if(evidence.tracking!==null&&!/^[\w-]{3,80}$/.test(evidence.tracking))throw new Error('Invalid tracking reference');
 const id=evidence.tracking?`rrk:${evidence.tracking}`:`rrk:sha256:${hash}`;
 if(id!==r.recordId)throw new Error('Record identity mismatch');
 if(!Array.isArray(r.personObservations)||r.personObservations.length>10000)throw new Error('Invalid observations');
 const observations=r.personObservations.map((p,i)=>{
  if(typeof p.name!=='string'||typeof p.role!=='string'||typeof p.evidence!=='string'||!r.text.includes(p.evidence)||!p.evidence.replace(/\s+/g,' ').includes(p.name.replace(/\s+/g,' '))||!p.evidence.replace(/\s+/g,' ').includes(p.role.replace(/\s+/g,' ')))throw new Error('Unsupported relationship evidence');
  return {observationId:`${id}:person-observation:${i}`,name:p.name,role:p.role,evidence:p.evidence,identityResolution:'unresolved',currentRoleVerified:false};
 });
 return {recordId:id,source:'rrk.ir',...evidence,contentHash:hash,capturedAt:typeof r.capturedAt==='string'?r.capturedAt:null,personObservations:observations,coverage:{fullProfileVerified:false,allRelationshipsVerified:false},privacy:{tenDigitNumbersRedacted:true,browserSessionExported:false}};
}
