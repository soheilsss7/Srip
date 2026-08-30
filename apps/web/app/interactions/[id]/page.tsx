'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
const SENTIMENT=['POSITIVE','NEUTRAL','NEGATIVE'];
const IMPORTANCE=['LOW','MEDIUM','HIGH'];
export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [x,setX]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[form,setForm]=useState({summary:'',outcome:'',followUpRequired:false});
 const load=useCallback(async()=>{setError('');try{const v:any=await api(`/interactions/${id}`);setX(v);setForm({summary:v.summary??'',outcome:v.outcome??'',followUpRequired:!!v.followUpRequired})}catch(e){setError((e as Error).message)}},[id]);
 useEffect(()=>{load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>){setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function update(body:any){await doIt('patch',()=>api(`/interactions/${id}`,{method:'PATCH',body:JSON.stringify(body)}))}
 const info=x?Object.entries(x).filter(([k])=>!['organization','person','relationship'].includes(k)&&typeof x[k]!=='function').slice(0,26):[];
 return <main className="feature-page">
  <PageHeader eyebrow="INTERACTION" title={x?.subject??'Interaction'} description="جزئیات تعامل، context سازمانی و رویدادهای مرتبط." actions={<div className="toolbar"><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button><button className="danger-action" disabled={!!busy} onClick={()=>{if(confirm('این تعامل حذف شود؟'))doIt('del',()=>api(`/interactions/${id}`,{method:'DELETE'}))}}>حذف</button></div>}/>
  <ErrorCard message={error}/>
  {!x&&!error?<Loading/>:x&&<>
   <section className="panel"><div className="panel-title"><div><h2>جزئیات تعامل</h2><p>{x.type??''}</p></div><Badge tone={x.sentiment==='POSITIVE'?'success':x.sentiment==='NEGATIVE'?'danger':'neutral'}>{x.sentiment??'—'}</Badge></div><div className="detail-grid">{info.map(([k,v])=>{if(v==null||v==='')return null;return <div className="detail-item" key={k}><small>{k}</small><strong>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></div>})}</div></section>
   <section className="panel"><div className="panel-title"><div><h2>ثبت نتیجه و پیگیری</h2></div></div><form className="entity-form" onSubmit={e=>{e.preventDefault();update({summary:form.summary,outcome:form.outcome,followUpRequired:form.followUpRequired})}}><label>خلاصه<textarea value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></label><label>نتیجه<textarea value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}/></label><label className="checkbox-label"><input type="checkbox" checked={form.followUpRequired} onChange={e=>setForm({...form,followUpRequired:e.target.checked})}/>نیازمند Follow-up</label><label>احساس/اهمیت<input type="text" list="sn" defaultValue={x.sentiment??'NEUTRAL'} onBlur={e=>{if(e.target.value&&e.target.value!==x.sentiment)update({sentiment:e.target.value})}}/><datalist id="sn">{SENTIMENT.map(s=><option key={s} value={s}/>)}</datalist></label><button className="primary-action" disabled={!!busy}>{busy==='patch'?'در حال ذخیره…':'ذخیره'}</button></form></section>
  </>}
 </main>;
}