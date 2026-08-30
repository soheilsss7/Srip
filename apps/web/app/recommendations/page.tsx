'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
import {useWorkspace} from '../_components/workspace';
export default function Recommendations(){
 const {can}=useWorkspace();
 const canRead=can('recommendation.read');
 const canWrite=can('recommendation.write');
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[snoozeUntil,setSnoozeUntil]=useState<Record<string,string>>({});
 const unwrap=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
 const load=async()=>{if(!canRead){setLoading(false);setItems([]);return}setLoading(true);setError('');try{setItems(unwrap(await api('/recommendations')))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[canRead]);
 async function generate(){if(!canWrite)return;setBusy('generate');try{await api('/recommendations/generate',{method:'POST',body:JSON.stringify({})});await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function act(id:string,action:string,body:unknown={}){if(!canWrite)return;setBusy(id+action);try{await api(`/recommendations/${id}/${action}`,{method:'POST',body:JSON.stringify(body)});await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const snooze=(id:string)=>{if(!canWrite)return;const until=snoozeUntil[id];if(!until||isNaN(new Date(until).getTime())){setError('برای Snooze یک زمان پایان معتبر انتخاب کنید.');return;}act(id,'snooze',{until:new Date(until).toISOString()});};
 if(!canRead)return <main className="feature-page"><PageHeader eyebrow="ACTIONABLE INTELLIGENCE" title="Recommendations" description="پیشنهادهای عملیاتی با شواهد و تأیید انسانی."/><section className="panel"><Empty>مجوز مشاهده پیشنهادها برای شما فعال نیست.</Empty></section></main>;
 return <main className="feature-page"><PageHeader eyebrow="ACTIONABLE INTELLIGENCE" title="Recommendations" description="هر پیشنهاد باید Evidence، Confidence، Reason و Human Approval داشته باشد." actions={canWrite?<button className="primary-action" onClick={generate} disabled={!!busy}>{busy==='generate'?'در حال تولید…':'تولید پیشنهادها'}</button>:undefined}/><ErrorCard message={error}/> {loading?<Loading/>:<section className="recommendation-list">{items.length?items.map(r=><article className="panel" key={r.id}><div className="panel-title"><div><h2><a href={`/recommendations/${r.id}`}>{r.title??r.type??'Recommendation'}</a></h2><p>{r.rationale??r.reason??'بدون توضیح ثبت‌شده'}</p></div><Badge tone={r.status==='APPROVED'?'success':r.status==='REJECTED'?'danger':'info'}>{r.status??'PROPOSED'}</Badge></div><div className="metric-list"><div><span>Confidence</span><strong>{r.confidence??'—'}</strong></div><div><span>Evidence</span><strong>{r.evidence?'دارای شواهد':'—'}</strong></div></div>{['PROPOSED','SNOOZED','ASSIGNED'].includes(r.status)&&<div className="toolbar"><a className="primary-action" href={`/recommendations/${r.id}`}>مشاهده</a>{canWrite&&<><button disabled={!!busy} onClick={()=>act(r.id,'approve')}>Approve</button><button disabled={!!busy} onClick={()=>act(r.id,'reject')}>Reject</button><input type="datetime-local" value={snoozeUntil[r.id]??''} onChange={e=>setSnoozeUntil(s=>({...s,[r.id]:e.target.value}))} aria-label="Snooze until"/><button disabled={!!busy} onClick={()=>snooze(r.id)}>Snooze</button></>}</div>}</article>):<div className="empty-state">پیشنهادی برای نمایش وجود ندارد.</div>}</section>}</main>;
}
