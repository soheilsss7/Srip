const normalize=s=>String(s||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\s\u200c]+/g,' ').trim();
export function providerLimitedCompany({entity,title,url,info,text,previous={},at=new Date().toISOString()}){
 if(entity?.type!=='company'||!/^\d{11}$/.test(String(entity.id)))return null;
 const body=normalize(text);
 if(!body.includes('نبود اطلاعات کافی در منابع رسمی مانند روزنامه رسمی')||!body.includes('امکان نمایش جزئیات کامل این شرکت وجود ندارد'))return null;
 if(/سقف\s*مجاز|امکان مشاهده اطلاعات در صفحه شرکت برای شما محدود شده/.test(body))return null;
 if(normalize(info?.['شناسه ملی'])!==String(entity.id)||!title||/undefined|صفحه یافت نشد/i.test(title))return null;
 let u;try{u=new URL(url);}catch{return null;}
 if(u.protocol!=='https:'||u.hostname!=='rasmio.com'||u.pathname!==`/company/${entity.id}/direct/`)return null;
 const mergedInfo={...(previous.info||{})};let fieldsAdded=0;
 for(const [k,v] of Object.entries(info||{}))if(normalize(v)&&normalize(v)!=='-'&&(!normalize(mergedInfo[k])||normalize(mergedInfo[k])==='-')){mergedInfo[k]=v;fieldsAdded++;}
 const name=String(title).replace(/^🏢\s*/,'').replace(/\s*-\s*رسمــیو.*$/,'').trim();
 const record={...previous,type:'company',id:String(entity.id),name:previous.name||name,url:previous.url||url,info:mergedInfo,rows:previous.rows||[],availability:{status:'provider-limited-public-view',statement:'نبود اطلاعات کافی در منابع رسمی مانند روزنامه رسمی؛ امکان نمایش جزئیات کامل این شرکت وجود ندارد',sourceURL:url,observedAt:at,independentRRKAbsenceVerified:false,fullCoverageVerified:false}};
 // Preserve richer historical tables/coverage. This observation concerns only the
 // public view at capture time, not the existence of official notices.
 if(!(record.rows.length||(record.tables||[]).some(t=>(t.rows||[]).length)))record.profileCoverage={...(previous.profileCoverage||{}),status:'provider-limited',access:'anonymous-public',paginationVerified:false,fullCoverageVerified:false};
 return {record,fieldsAdded};
}
