'use client';
import {useCallback,useEffect,useState} from 'react';
import {api,apiUpload} from '../_lib/api';
import {Badge,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
import {EntityPicker} from '../_components/entity-picker';
import {useWorkspace} from '../_components/workspace';
const unwrap=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
const fmtBytes=(b:any)=>typeof b==='number'?(b>=1048576?(b/1048576).toFixed(1)+' MB':b>=1024?(b/1024).toFixed(1)+' KB':b+' B'):'—';
const fmtDate=(d:any)=>d?new Date(d).toLocaleString():'—';
const toneFor=(s?:string):'success'|'warning'|'danger'|'info'|'neutral'=>(({READY:'success',CLEAN:'success',NOT_REQUIRED:'info',PENDING:'warning',QUARANTINED:'warning',REJECTED:'danger',INFECTED:'danger',ERROR:'danger'} as any)[s??''])??'neutral';
export default function Documents(){
 const {scopeId}=useWorkspace();
 const [docs,setDocs]=useState<any[]>([]),[status,setStatus]=useState<any>(null),[orgId,setOrgId]=useState('');
 const [file,setFile]=useState<File|null>(null),[classification,setClassification]=useState('INTERNAL');
 const [indexText,setIndexText]=useState<string>(''),[idxFor,setIdxFor]=useState<string>('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const params=orgId?`?organizationId=${encodeURIComponent(orgId)}`:'';
   const [docsR,statusR]=await Promise.all([api(`/documents${params}`),api('/documents/status')]);setDocs(unwrap(docsR));setStatus(statusR);}catch(x){setError((x as Error).message)}finally{setLoading(false)}},[orgId]);
 useEffect(()=>{load()},[load]);
 async function doUpload(){if(!file){setNotice('یک فایل انتخاب کنید.');return}setBusy('upload');setNotice('');setError('');try{const extra:Record<string,string>={classification};if(orgId)extra.organizationId=orgId;await apiUpload('/documents/upload',file,'file',extra);setFile(null);setNotice('فایل بارگذاری و اسکن شد.');await load()}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function download(id:string){setBusy('dl'+id);setError('');try{const r:any=await api(`/documents/${id}/signed-url`);if(r?.url)window.open(r.url,'_blank','noopener');else setError('Signed URL در دسترس نیست.');}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function indexDoc(id:string){if(!indexText.trim()){setNotice('متن محتوا را برای Index وارد کنید.');return}setBusy('idx'+id);setNotice('');setError('');try{await api(`/documents/${id}/index`,{method:'POST',body:JSON.stringify({text:indexText})});setIdxFor('');setIndexText('');setNotice('محتوا ایندکس شد.');}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 return <main className="feature-page"><PageHeader eyebrow="DOCUMENTS" title="مدیریت اسناد" description="بارگذاری امن، اسکن بدافزار، ایندکس محتوا و دانلود امضاء‌شده با مجوز سازمانی." actions={<button className="primary-action" onClick={()=>document.getElementById('file')?.click()} disabled={!!busy}>بارگذاری سند</button>}/>
 <ErrorCard message={error}/>{notice&&<div className="notice" role="status">{notice}</div>}
 <section className="dashboard-grid">
  <article className="panel"><div className="panel-title"><div><h2>نقطه حاکمیت اسناد</h2></div></div><div className="kpi-grid"><div className="kpi-card"><small>ماژول</small><strong>{status?.module??'—'}</strong></div><div className="kpi-card"><small>Status</small><strong>{status?.status??'—'}</strong></div><div className="kpi-card"><small>Capabilities</small><strong>{(status?.capabilities??[]).length}</strong></div></div><p className="muted">{Array.isArray(status?.capabilities)?status.capabilities.join(' · '):''}</p></article>
  <article className="panel"><div className="panel-title"><div><h2>نقشه بارگذاری</h2><p>اعتبارسنجی MIME/Ext، قرنطینه، اسکن بدافزار و دسترسی امضاء‌شده.</p></div></div><input id="file" type="file" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={!!busy}/>{file&&<div className="entity-form"><label>طبقه‌بندی<select value={classification} onChange={e=>setClassification(e.target.value)}>{['INTERNAL','CONFIDENTIAL','RESTRICTED','PUBLIC'].map(c=><option key={c} value={c}>{c}</option>)}</select></label><EntityPicker label="سازمان (اختیاری)" endpoint="/organizations" value={orgId} onChange={setOrgId} scopeId={scopeId}/><button className="primary-action" onClick={doUpload} disabled={!!busy}>{busy==='upload'?'در حال اسکن…':'بارگذاری'}</button></div>}</article>
 </section>
 <section className="panel"><div className="panel-title"><div><h2>اسناد</h2><p>{docs.length} سند</p></div><div className="toolbar"><EntityPicker label="فیلتر سازمان" endpoint="/organizations" value={orgId} onChange={setOrgId} scopeId={scopeId}/><button className="secondary-action" onClick={load} disabled={!!busy}>اعمال فیلتر</button></div></div>
 {loading?<Loading/>:docs.length===0?<Empty>سندی در Scope شما نیست.</Empty>:<div className="list">{docs.map(d=><article className="panel compact" key={d.id}><div className="panel-title"><div><strong>{d.name}</strong><small className="muted">{d.mimeType} · {fmtBytes(d.sizeBytes)} · {d.classification} · {fmtDate(d.createdAt)}</small></div><span><Badge tone={toneFor(d.scanStatus)}>scan:{d.scanStatus}</Badge><Badge tone={toneFor(d.uploadStatus)}>up:{d.uploadStatus}</Badge></span></div><div className="toolbar">
  <button className="secondary-action" disabled={!!busy||d.uploadStatus!=='READY'} onClick={()=>download(d.id)}>{busy==='dl'+d.id?'…':'دانلود'}</button>
  <button className="secondary-action" onClick={()=>setIdxFor(idxFor===d.id?'':d.id)} disabled={!!busy}>{idxFor===d.id?'انصراف':'ایندکس'}</button>
 </div>
 {idxFor===d.id&&<div className="entity-form"><label>متن محتوا برای ایندکس<textarea value={indexText} onChange={e=>setIndexText(e.target.value)} placeholder="متن سند برای chunking/redaction/ایندکس"/></label><button className="primary-action" onClick={()=>indexDoc(d.id)} disabled={!!busy}>{busy==='idx'+d.id?'در حال ایندکس…':'ثبت و ایندکس'}</button></div>}
 </article>)}</div>}
 </section>
 </main>;
}
