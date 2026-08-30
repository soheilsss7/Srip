'use client';
import {useState} from 'react';
import {api,apiUpload} from '../../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
import {EntityPicker} from '../../_components/entity-picker';
import {useWorkspace} from '../../_components/workspace';

export default function ImportPage(){
  const {scopeId,can}=useWorkspace();
  const canImport=can('data.import');
  const canApprove=can('data.import.approve');
  const[file,setFile]=useState<File|null>(null),[entityType,setEntityType]=useState('ORGANIZATION'),[organizationId,setOrganizationId]=useState(''),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[e,setE]=useState('');
  async function upload(){if(!canImport||!file)return;setBusy(true);setE('');try{const d=await apiUpload('/data/import/preview',file,'file',{entityType,organizationId:organizationId||''});setPreview(d)}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
  async function approve(){if(!canApprove||!preview?.id)return;setBusy(true);setE('');try{const d=await api(`/data/import/${encodeURIComponent(preview.id)}/approve`,{method:'POST',body:'{}'});setPreview(d)}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
  const approved=preview?.status==='APPROVED';
  const rows:any[]=Array.isArray(preview?.rows)?preview.rows:[];
  const rowTone: Record<string, 'success'|'warning'|'danger'|'info'>={ VALID:'success', DUPLICATE:'warning', INVALID:'danger' };
  if(!canImport)return <main className="feature-page"><PageHeader eyebrow="DATA IMPORT" title="ورود داده" description="پیش‌نمایش و تأیید داده‌های ورودی."/><section className="panel"><Empty>مجوز ورود داده برای شما فعال نیست.</Empty></section></main>;
  return <main className="feature-page">
    <PageHeader eyebrow="DATA IMPORT" title="ورود داده" description="Upload → Mapping → Validation → Duplicate Detection → Preview → Approval → Import → Report. انتخاب entityType (ORGANIZATION یا PERSON) الزامی است."/>
    <ErrorCard message={e}/>
    <section className="panel"><form className="form-grid" onSubmit={(ev)=>{ev.preventDefault();upload();}}>
      <label className="inline-field">نوع موجودیت
        <select value={entityType} onChange={ev=>setEntityType(ev.target.value)} disabled={busy}>
          <option value="ORGANIZATION">ORGANIZATION</option>
          <option value="PERSON">PERSON</option>
        </select></label>
      <EntityPicker label="سازمان مقصد (اختیاری)" endpoint="/organizations" value={organizationId} onChange={setOrganizationId} disabled={busy} scopeId={scopeId}/>
      <label className="inline-field">فایل<input type="file" accept=".csv,.xlsx,.xls,.json,.txt" onChange={ev=>setFile(ev.target.files?.[0]??null)} disabled={busy}/></label>
      <button className="primary-action" disabled={!file||busy}>{busy?'در حال پردازش…':'Preview'}</button>
    </form></section>
    {preview&&<section className="panel">
      <div className="panel-title"><h2>Preview</h2>{approved?<Badge tone="success">APPROVED</Badge>:<Badge tone="info">{preview.status??'PREVIEWED'}</Badge>}</div>
      <section className="kpi-grid">
        <div className="kpi-card"><span>کل ردیف‌ها</span><strong>{preview.totalRows??0}</strong></div>
        <div className="kpi-card"><span>معتبر</span><strong>{preview.summary?.valid??'—'}</strong></div>
        <div className="kpi-card"><span>نامعتبر</span><strong>{preview.summary?.invalid??'—'}</strong></div>
        <div className="kpi-card"><span>تکراری</span><strong>{preview.summary?.duplicates??preview.totalDuplicates??'—'}</strong></div>
      </section>
      <div className="table-wrap">{rows.length?<DataTable columns={[{key:'rowNumber',label:'ردیف'},{key:'status',label:'Status'},{key:'raw',label:'داده'},{key:'errors',label:'خطاها'}]} rows={rows.map(r=>({rowNumber:r.rowNumber??'—',status:<Badge tone={rowTone[r.status]??'info'}>{r.status??'—'}</Badge>,raw:r.normalizedData?JSON.stringify(r.normalizedData).slice(0,80):'—',errors:Array.isArray(r.errors)&&r.errors.length?r.errors.join('؛ '):'—'}))}/>:<Empty>ردیفی در پیش‌نمایش نیست.</Empty>}</div>
      {!approved&&canApprove&&<div className="toolbar"><button className="primary-action" disabled={busy} onClick={approve}>{busy?'در حال تأیید…':'Approve Import'}</button></div>}{!approved&&!canApprove&&<div className="notice" role="status">این پیش‌نمایش برای تأیید نهایی به مجوز جداگانه نیاز دارد.</div>}
    </section>}
  </main>;
}
