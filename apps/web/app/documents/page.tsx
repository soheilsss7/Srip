'use client';
import {useState} from 'react';import Link from 'next/link';
import {apiUpload} from '../_lib/api';
export default function Documents(){
 const[file,setFile]=useState<File|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 async function upload(){if(!file)return;setBusy(true);setStatus('در حال اعتبارسنجی و اسکن...');try{const d:any=await apiUpload('/documents/upload',file);setStatus(`Uploaded and scanned: ${d?.document?.id??d?.id??'success'}`)}catch(e){setStatus((e as Error).message)}finally{setBusy(false)}}
 return <main><header><div><p className="eyebrow">SRIP · File Security</p><h1>Documents</h1><p className="muted">MIME/extension validation، quarantine، malware scan و signed download.</p></div><Link className="pill" href="/">Dashboard</Link></header><section className="panel"><label htmlFor="file">File</label><input id="file" type="file" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={busy}/><button onClick={upload} disabled={!file||busy}>{busy?'در حال اسکن…':'Secure Upload'}</button><p aria-live="polite" className="muted">{status}</p></section></main>
}
