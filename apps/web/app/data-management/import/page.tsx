'use client';
import {useState} from 'react';
import {api,apiUpload} from '../../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';

export default function ImportPage(){
  const[file,setFile]=useState<File|null>(null),[entityType,setEntityType]=useState('ORGANIZATION'),[organizationId,setOrganizationId]=useState(''),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[e,setE]=useState('');
  async function upload(){if(!file)return;setBusy(true);setE('');try{const d=await apiUpload('/data/import/preview',file,'file',{entityType,organizationId:organizationId||''});setPreview(d)}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
  async function approve(){if(!preview?.id)return;setBusy(true);setE('');try{const d=await api(`/data/import/${encodeURIComponent(preview.id)}/approve`,{method:'POST',body:'{}'});setPreview(d)}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
  const approved=preview?.status==='APPROVED';
  const rows:any[]=Array.isArray(preview?.rows)?preview.rows:[];
  const rowTone: Record<string, 'success'|'warning'|'danger'|'info'>={ VALID:'success', DUPLICATE:'warning', INVALID:'danger' };
  return <main className="feature-page">
    <PageHeader eyebrow="ورود داده" title="ورود داده" description="بارگذاری ← نگاشت ← اعتبارسنجی ← شناسایی موارد تکراری ← پیش‌نمایش ← تأیید ← ورود ← گزارش. انتخاب نوع نهاد (سازمان یا شخص) الزامی است."/>
    <ErrorCard message={e}/>
    <section className="panel"><form className="form-grid" onSubmit={(ev)=>{ev.preventDefault();upload();}}>
      <label className="inline-field">نوع موجودیت
        <select value={entityType} onChange={ev=>setEntityType(ev.target.value)} disabled={busy}>
          <option value="ORGANIZATION">سازمان</option>
          <option value="PERSON">شخص</option>
        </select></label>
      <label className="inline-field">Organization ID (اختیاری)<input value={organizationId} onChange={ev=>setOrganizationId(ev.target.value)} placeholder="شناسه سازمان مقصد" disabled={busy}/></label>
      <label className="inline-field">فایل<input type="file" accept=".csv,.xlsx,.xls,.json,.txt" onChange={ev=>setFile(ev.target.files?.[0]??null)} disabled={busy}/></label>
      <button className="primary-action" disabled={!file||busy}>{busy?'در حال پردازش…':'Preview'}</button>
    </form></section>
    {preview&&<section className="panel">
      <div className="panel-title"><h2>پیش‌نمایش</h2>{approved?<Badge tone="success">تأییدشده</Badge>:<Badge tone="info">{preview.status??'PREVIEWED'}</Badge>}</div>
      <section className="kpi-grid">
        <div className="kpi-card"><span>کل ردیف‌ها</span><strong>{preview.totalRows??0}</strong></div>
        <div className="kpi-card"><span>معتبر</span><strong>{preview.summary?.valid??'—'}</strong></div>
        <div className="kpi-card"><span>نامعتبر</span><strong>{preview.summary?.invalid??'—'}</strong></div>
        <div className="kpi-card"><span>تکراری</span><strong>{preview.summary?.duplicates??preview.totalDuplicates??'—'}</strong></div>
      </section>
      <div className="table-wrap">{rows.length?<DataTable columns={[{key:'rowNumber',label:'ردیف'},{key:'status',label:'وضعیت'},{key:'raw',label:'داده'},{key:'errors',label:'خطاها'}]} rows={rows.map(r=>({rowNumber:r.rowNumber??'—',status:<Badge tone={rowTone[r.status]??'info'}>{r.status??'—'}</Badge>,raw:r.normalizedData?JSON.stringify(r.normalizedData).slice(0,80):'—',errors:Array.isArray(r.errors)&&r.errors.length?r.errors.join('؛ '):'—'}))}/>:<Empty>ردیفی در پیش‌نمایش نیست.</Empty>}</div>
      {!approved&&<div className="toolbar"><button className="primary-action" disabled={busy} onClick={approve}>{busy?'در حال تأیید…':'تأیید ورود'}</button></div>}
    </section>}
  </main>;
}
