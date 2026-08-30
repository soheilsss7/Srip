'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
import {useWorkspace} from '../../_components/workspace';
const STATUS=['OPEN','FULFILLED','OVERDUE','CANCELLED'];
export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const {can}=useWorkspace();
 const canRead=can('commitment.read');
 const canWrite=can('commitment.write');
 const [c,setC]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[desc,setDesc]=useState('');
 const load=useCallback(async()=>{if(!canRead){setC(null);return}setError('');try{const x:any=await api(`/commitments/${id}`);setC(x);setDesc(x.description??'')}catch(e){setError((e as Error).message)}},[id,canRead]);
 useEffect(()=>{void load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>){if(!canWrite)return;setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function update(body:any){await doIt('patch',()=>api(`/commitments/${id}`,{method:'PATCH',body:JSON.stringify(body)}))}
 const info=c?Object.entries(c).filter(([k])=>!['owner','person','relationship','meeting','project','organization','recommendation'].includes(k)&&typeof c[k]!=='function').slice(0,26):[];
 if(!canRead)return <main className="feature-page"><PageHeader eyebrow="COMMITMENT" title="Commitment" description="پیگیری وضعیت، سررسید و اقدام‌های مرتبط با این تعهد."/><section className="panel"><p className="empty-state">مجوز مشاهده این تعهد برای شما فعال نیست.</p></section></main>;
 return <main className="feature-page">
  <PageHeader eyebrow="COMMITMENT" title={c?.description?.slice(0,80)??'Commitment'} description="پیگیری وضعیت، سررسید و اقدام‌های مرتبط با این تعهد." actions={<div className="toolbar"><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button>{canWrite&&<><label className="inline-label">وضعیت<select value={c?.status??'OPEN'} disabled={!!busy} onChange={e=>update({status:e.target.value})}>{STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select></label><button className="secondary-action" disabled={!!busy} onClick={()=>doIt('overdue',()=>api(`/commitments/${id}/mark-overdue`,{method:'POST'}))}>علامت‌گذاری عقب‌افتاده</button><button className="danger-action" disabled={!!busy} onClick={()=>{if(confirm('این تعهد حذف شود؟'))doIt('del',()=>api(`/commitments/${id}`,{method:'DELETE'}))}}>حذف</button></>}</div>}/>
  <ErrorCard message={error}/>
  {!c&&!error?<Loading/>:c&&<>
   <section className="panel"><div className="panel-title"><div><h2>جزئیات تعهد</h2><p>{c.source} → {c.receiver}</p></div><Badge tone={c.status==='FULFILLED'?'success':c.status==='OVERDUE'?'danger':'neutral'}>{c.status??'—'}</Badge></div><div className="detail-grid">{info.map(([k,v])=>{if(v==null||v==='')return null;return <div className="detail-item" key={k}><small>{k}</small><strong>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></div>})}</div></section>
   {canWrite&&<section className="panel"><div className="panel-title"><div><h2>توضیحات</h2></div></div><textarea className="full-note" value={desc} onChange={e=>setDesc(e.target.value)} rows={4}/><button className="primary-action" onClick={()=>update({description:desc})} disabled={!!busy||desc===c.description}>ذخیره توضیحات</button></section>}
  </>}
 </main>;
}