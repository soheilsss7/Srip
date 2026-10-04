'use client';
import {useCallback,useEffect,useState} from 'react';
import {api,apiUpload} from '../../_lib/api';
import {fa} from '../../_lib/fa';
import {t} from '../../_lib/i18n';
import {Badge,Empty,ErrorCard,Loading,Modal,PageHeader} from '../../_components/page-ui';
import HubTabs from '../../_components/hub-tabs';
import {BookOpen,FileText,ArrowUpRight} from 'lucide-react';
const unwrap=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
const fmtBytes=(b:any)=>typeof b==='number'?new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(b>=1048576?b/1048576:b>=1024?b/1024:b)+(b>=1048576?' مگابایت':b>=1024?' کیلوبایت':' بایت'):'—';
const fmtDate=(d:any)=>d?new Date(d).toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'}):'—';
const MIME_FA: Record<string, string> = { 'application/pdf': 'سند پی.دی.اف', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'سند متنی', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'صفحهٔ گسترده', 'application/zip': 'بایگانی', 'text/csv': 'فایل جدولی' };
const toneFor=(s?:string):'success'|'warning'|'danger'|'info'|'neutral'=>(({READY:'success',CLEAN:'success',NOT_REQUIRED:'info',PENDING:'warning',QUARANTINED:'warning',REJECTED:'danger',INFECTED:'danger',ERROR:'danger'} as any)[s??''])??'neutral';
export default function Documents(){
 const [docs,setDocs]=useState<any[]>([]),[status,setStatus]=useState<any>(null),[orgId,setOrgId]=useState('');
 const [file,setFile]=useState<File|null>(null),[classification,setClassification]=useState('INTERNAL');
 const [indexText,setIndexText]=useState<string>(''),[idxFor,setIdxFor]=useState<string>('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uploadOpen,setUploadOpen]=useState(false);
 /* گام ۸.۳ — منشأ و مسیر تغییر سند (مخزن شواهد) */
 const [provFor,setProvFor]=useState<string|null>(null),[prov,setProv]=useState<any>(null);
 async function openProvenance(id:string){setProvFor(id);setProv(null);try{setProv(await api(`/documents/${id}/provenance`))}catch(x){setError((x as Error).message)}}
 async function reclassify(id:string,classification:string){setBusy('rc'+id);setError('');try{const r:any=await api(`/documents/${id}/classification`,{method:'PATCH',body:JSON.stringify({classification})});setNotice(`${t('طبقه‌بندی تغییر کرد — نسخهٔ')} ${fa(r?.provenance?.version)} ${t('در زنجیرهٔ منشأ ثبت شد.')}`);await load()}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 const load=useCallback(async()=>{setLoading(true);setError('');try{const params=orgId?`?organizationId=${encodeURIComponent(orgId)}`:'';
   const [docsR,statusR]=await Promise.all([api(`/documents${params}`),api('/documents/status')]);setDocs(unwrap(docsR));setStatus(statusR);}catch(x){setError((x as Error).message)}finally{setLoading(false)}},[orgId]);
 useEffect(()=>{load()},[load]);
 async function doUpload(){if(!file){setNotice('یک فایل انتخاب کنید.');return}setBusy('upload');setNotice('');setError('');try{const extra:Record<string,string>={classification};if(orgId)extra.organizationId=orgId;const r:any=await apiUpload('/documents/upload',file,'file',extra);setFile(null);setUploadOpen(false);setNotice(r&&r.fingerprint?`${t('فایل بارگذاری و اسکن شد')} — ${t('اثرانگشت SHA-256:')} ${String(r.fingerprint).slice(0,20)}…`:t('فایل بارگذاری و اسکن شد'));await load()}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function download(id:string){setBusy('dl'+id);setError('');try{const r:any=await api(`/documents/${id}/signed-url`);if(r?.url)window.open(r.url,'_blank','noopener');else setError('نشانی امضاشده در دسترس نیست.');}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function indexDoc(id:string){if(!indexText.trim()){setNotice('برای ایندکس کردن محتوا، متن را وارد کنید.');return}setBusy('idx'+id);setNotice('');setError('');try{await api(`/documents/${id}/index`,{method:'POST',body:JSON.stringify({text:indexText})});setIdxFor('');setIndexText('');setNotice('محتوا ایندکس شد.');}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 return <main className="feature-page"><PageHeader eyebrow="مرکز دانش / اسناد" title="اسناد و فایل‌ها" description="بارگذاری امن، اسکن بدافزار، ایندکس محتوا و دانلود امضاء‌شده با مجوز سازمانی." actions={<button type="button" className="primary-action" onClick={()=>{setError('');setUploadOpen(true)}} disabled={!!busy}>بارگذاری سند</button>}/>
 <HubTabs tabs={[
    { href: '/documents', label: 'دانشنامه', icon: <BookOpen size={13} /> },
    { href: '/documents/files', label: 'اسناد و فایل‌ها', icon: <FileText size={13} /> },
    { href: '/help', label: 'راهنمای کامل', icon: <ArrowUpRight size={13} /> },
  ]} />
 <ErrorCard message={error}/>{notice&&<div className="notice" role="status">{notice}</div>}
 <section className="dashboard-grid">
  <article className="panel"><div className="panel-title"><div><h2>نقطه حاکمیت اسناد</h2></div></div><div className="kpi-grid"><div className="kpi-card"><small>ماژول</small><strong>{fa(status?.module??'—')}</strong></div><div className="kpi-card"><small>وضعیت</small><strong>{fa(status?.status??'—')}</strong></div><div className="kpi-card"><small>قابلیت‌ها</small><strong>{(status?.capabilities??[]).length}</strong></div></div><p className="muted">{Array.isArray(status?.capabilities)?status.capabilities.map((c: any)=>fa(c)).join(' · '):''}</p></article>
  <article className="panel"><div className="panel-title"><div><h2>نقشه بارگذاری</h2><p>اعتبارسنجی نوع فایل/پسوند، قرنطینه، اسکن بدافزار و دسترسی امضاشده.</p></div></div><button type="button" className="btn btn-primary" onClick={()=>{setError('');setUploadOpen(true)}} disabled={!!busy}>بارگذاری سند</button></article>
 </section>
 <section className="panel"><div className="panel-title"><div><h2>اسناد</h2><p>{docs.length} سند</p></div><div className="toolbar"><input value={orgId} onChange={e=>setOrgId(e.target.value)} placeholder="فیلتر بر اساس سازمان…" style={{maxWidth:220}}/><button className="secondary-action" onClick={load} disabled={!!busy}>اعمال فیلتر</button></div></div>
 {loading?<Loading/>:docs.length===0?<Empty>سندی در Scope شما نیست.</Empty>:<div className="list">{docs.map(d=><article className="panel compact" key={d.id}><div className="panel-title"><div><strong>{String(d.name).replace(/\.(pdf|docx|xlsx|csv|zip)$/i, '')}</strong><small className="muted">{MIME_FA[d.mimeType] ?? d.mimeType} · {fmtBytes(d.sizeBytes)} · {fa(d.classification)} · {fmtDate(d.createdAt)}</small></div><span><Badge tone={toneFor(d.scanStatus)}>اسکن: {fa(d.scanStatus)}</Badge><Badge tone={toneFor(d.uploadStatus)}>بارگذاری: {fa(d.uploadStatus)}</Badge></span></div><div className="toolbar">
  <button className="secondary-action" disabled={!!busy||d.uploadStatus!=='READY'} onClick={()=>download(d.id)}>{busy==='dl'+d.id?'…':'دانلود'}</button>
  <button className="secondary-action" onClick={()=>{setError('');setIdxFor(d.id)}} disabled={!!busy}>ایندکس</button>
  <button className="secondary-action" onClick={()=>openProvenance(d.id)} disabled={!!busy}>{t('منشأ و مسیر تغییر')}</button>
  <select aria-label={`${t('طبقه‌بندی')} ${d.name}`} value={d.classification} disabled={!!busy} onChange={e=>reclassify(d.id,e.target.value)}>
    {['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'].map(c=><option key={c} value={c}>{fa(c)}</option>)}
  </select>
 </div>
 {d.fingerprint&&<small className="muted" style={{direction:'ltr',display:'block',marginTop:6}}>🔒 SHA-256: {String(d.fingerprint).slice(0,20)}…</small>}
 </article>)}</div>}

 {/* گام ۸.۳ — مودال زنجیرهٔ منشأ */}
 <Modal open={!!provFor} title={`${t('منشأ و مسیر تغییر')} — ${prov?.document?.name??provFor??''}`} description={prov?.rule} onClose={()=>{setProvFor(null);setProv(null)}}>
  {prov&&(<div className="list">
    <div className="panel-title"><div><h2>{t('اثرانگشت دیجیتال')}</h2></div><Badge tone={prov.integrityOk?'success':'danger'}>{prov.integrityOk?t('زنجیره سالم'):t('ناهمخوانی اثرانگشت')}</Badge></div>
    <small style={{direction:'ltr',display:'block',wordBreak:'break-all'}}>{prov.document?.fingerprint}</small>
    <div className="list" style={{marginTop:10}}>
      {(prov.chain??[]).map((r:any)=><div className="listRow" key={r.id}>
        <span style={{flex:1}}><strong>{`${t('نسخهٔ')} ${fa(r.version)}`} — {r.changeFa}</strong>
          <small style={{display:'block'}}>{r.actor} · {new Date(r.at).toLocaleString('fa-IR')}</small>
          <small style={{display:'block',direction:'ltr',opacity:.7}}>{String(r.fingerprint??'').slice(0,24)}…</small>
          {r.note&&<small style={{display:'block',opacity:.8}}>{r.note}</small>}</span>
      </div>)}
    </div>
  </div>)}
 </Modal>
 {/* Upload modal */}
 <Modal open={uploadOpen} title="بارگذاری سند" description="فایل انتخاب کنید؛ نوع فایل و پسوند آن اعتبارسنجی و اسکن بدافزار انجام می‌شود." onClose={()=>setUploadOpen(false)}
   footer={<>
     <button type="button" className="btn btn-secondary" onClick={()=>setUploadOpen(false)}>انصراف</button>
     <button type="button" className="btn btn-primary" onClick={doUpload} disabled={!!busy||!file}>{busy==='upload'?'در حال اسکن…':'بارگذاری'}</button>
   </>}>
   <div className="entity-form">
     <div className="field full"><label className="field-label">فایل <span className="req">*</span></label><input type="file" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={!!busy}/></div>
     <div className="field full"><label className="field-label">طبقه‌بندی</label><select value={classification} onChange={e=>setClassification(e.target.value)}>{['INTERNAL','CONFIDENTIAL','RESTRICTED','PUBLIC'].map(c=><option key={c} value={c}>{fa(c)}</option>)}</select></div>
     <div className="field full"><label className="field-label">شناسهٔ سازمان (اختیاری)</label><input value={orgId} onChange={e=>setOrgId(e.target.value)} placeholder="شناسه"/></div>
   </div>
 </Modal>
 {/* Index modal */}
 <Modal open={!!idxFor} title="ایندکس محتوا" description="متن سند را برای chunking/redaction/ایندکس وارد کنید." onClose={()=>setIdxFor('')}
   footer={<>
     <button type="button" className="btn btn-secondary" onClick={()=>setIdxFor('')}>انصراف</button>
     <button type="button" className="btn btn-primary" onClick={()=>idxFor&&indexDoc(idxFor)} disabled={!!busy}>{busy==='idx'+idxFor?'در حال ایندکس…':'ثبت و ایندکس'}</button>
   </>}>
   <div className="entity-form">
     <div className="field full"><label className="field-label">متن محتوا برای ایندکس</label><textarea value={indexText} onChange={e=>setIndexText(e.target.value)} placeholder="متن سند برای قطعه‌بندی/محرمانه‌سازی/ایندکس"/></div>
   </div>
 </Modal>
 </section>
 </main>;
}
