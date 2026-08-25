'use client';
import {useState} from 'react';
import {api,apiUpload} from '../../_lib/api';
import {ErrorCard,PageHeader} from '../../_components/page-ui';
export default function ImportPage(){
 const[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[e,setE]=useState('');
 async function upload(){if(!file)return;setBusy(true);setE('');try{const d=await apiUpload('/data/import/preview',file);setPreview(d)}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
 async function approve(){if(!preview?.id)return;setBusy(true);try{await api(`/data/import/${encodeURIComponent(preview.id)}/approve`,{method:'POST',body:'{}'});setPreview({...preview,approved:true})}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
 return <main className="feature-page"><PageHeader eyebrow="DATA IMPORT" title="ورود داده" description="Upload → Mapping → Validation → Duplicate Detection → Preview → Approval → Import → Report"/><ErrorCard message={e}/><section className="panel"><input type="file" accept=".csv,.xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={busy}/><button className="primary-action" disabled={!file||busy} onClick={upload}>{busy?'در حال پردازش…':'Preview'}</button></section>{preview&&<section className="panel"><h2>Preview</h2><pre className="json-view">{JSON.stringify(preview,null,2)}</pre><button className="primary-action" disabled={busy||preview.approved} onClick={approve}>{preview.approved?'Approved':'Approve Import'}</button></section>}</main>
}
