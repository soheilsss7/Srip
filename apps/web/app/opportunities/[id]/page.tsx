'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
const STATUS=['IDENTIFIED','QUALIFYING','ACTIVE','WON','LOST'];
export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [o,setO]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{setError('');try{setO(await api(`/opportunities/${id}`))}catch(e){setError((e as Error).message)}},[id]);
 useEffect(()=>{load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>){setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function update(body:any){await doIt('patch',()=>api(`/opportunities/${id}`,{method:'PATCH',body:JSON.stringify(body)}))}
 const info=o?Object.entries(o).filter(([k])=>!['organization','project','relationship'].includes(k)&&typeof o[k]!=='function').slice(0,26):[];
 return <main className="feature-page">
  <PageHeader eyebrow="OPPORTUNITY" title={o?.name??'Opportunity'} description={`شناسه: ${id}`} actions={<div className="toolbar"><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button><label className="inline-label">وضعیت<select value={o?.status??'IDENTIFIED'} disabled={!!busy} onChange={e=>update({status:e.target.value})}>{STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select></label><button className="danger-action" disabled={!!busy} onClick={()=>{if(confirm('این فرصت حذف شود؟'))doIt('del',()=>api(`/opportunities/${id}`,{method:'DELETE'}))}}>حذف</button></div>}/>
  <ErrorCard message={error}/>
  {!o&&!error?<Loading/>:o&&<>
   <section className="panel"><div className="panel-title"><div><h2>جزئیات فرصت</h2><p>{o.description??'بدون توضیح'}</p></div><Badge tone={o.status==='WON'?'success':o.status==='LOST'?'danger':'neutral'}>{o.status??'—'}</Badge></div><div className="stat-row">{[['ارزش (value)',o.value],['احتمال (probability)',o.probability!=null?`${o.probability}%`:'—']].map(([k,v])=><div className="stat-box" key={String(k)}><span>{k}</span><strong>{String(v??'—')}</strong></div>)}</div><div className="stat-row"><label>ارزش<input type="number" defaultValue={o.value??''} onBlur={e=>{const v=Number(e.target.value);if(!isNaN(v)&&v!==o.value)update({value:v})}} disabled={!!busy}/></label><label>احتمال (%)<input type="number" min={0} max={100} defaultValue={o.probability??''} onBlur={e=>{const v=Number(e.target.value);if(!isNaN(v)&&v!==o.probability)update({probability:v})}} disabled={!!busy}/></label></div><div className="detail-grid">{info.map(([k,v])=>{if(v==null||v==='')return null;return <div className="detail-item" key={k}><small>{k}</small><strong>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></div>})}</div></section>
  </>}
 </main>;
}