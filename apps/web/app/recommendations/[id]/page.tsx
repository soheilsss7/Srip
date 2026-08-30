'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';

export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [r,setR]=useState<any>(null),[explanation,setExplanation]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [title,setTitle]=useState(''),[rationale,setRationale]=useState(''),[confidence,setConfidence]=useState('');
 const [assigneeId,setAssigneeId]=useState(''),[snoozeDatetime,setSnoozeDatetime]=useState('');

 const load=useCallback(async()=>{setError('');try{const v:any=await api(`/recommendations/${id}`);setR(v);setTitle(v.title??'');setRationale(v.rationale??'');setConfidence(v.confidence!=null?String(v.confidence):'')}catch(e){setError((e as Error).message)}},[id]);
 useEffect(()=>{load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>){setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const act=(action:string,body:unknown={})=>doIt(action,()=>api(`/recommendations/${id}/${action}`,{method:'POST',body:JSON.stringify(body)}));
 async function save(){await doIt('patch',()=>api(`/recommendations/${id}`,{method:'PATCH',body:JSON.stringify({title:title.trim()||undefined,rationale:rationale.trim()||undefined,confidence:confidence.trim()===''?undefined:Math.min(100,Math.max(0,Number(confidence)))})}))}
 async function showExplain(){setExplanation(null);setError('');try{setExplanation(await api(`/recommendations/${id}/explain`))}catch(e){setError((e as Error).message)}}

 return <main className="feature-page">
  <PageHeader eyebrow="RECOMMENDATION" title={r?.title??'Recommendation'} description="جزئیات پیشنهاد و وضعیت اجرای آن." actions={<div className="toolbar"><a className="secondary-action" href="/recommendations">بازگشت</a><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button></div>}/>
  <ErrorCard message={error}/>
  {!r&&!error?<Loading/>:r&&<>
   <section className="panel">
    <div className="panel-title"><div><h2>{r.type??'Recommendation'}</h2><p>{r.rationale??''}</p></div><Badge tone={r.status==='APPROVED'?'success':r.status==='REJECTED'?'danger':'info'}>{r.status??'PROPOSED'}</Badge></div>
    <div className="metric-list"><div><span>Confidence</span><strong>{r.confidence??'—'}%</strong></div><div><span>Has Evidence</span><strong>{r.evidence?'بله':'خیر'}</strong></div></div>
    <div className="detail-grid">{[['Relationship',r.relationship?.relationshipType],['Source org',r.relationship?.sourceOrganization?.name],['Target org',r.relationship?.targetOrganization?.name],['Assigned to',r.assignedToId],['Decided by',r.decisionById],['Decision at',r.decisionAt?new Date(r.decisionAt).toLocaleString():''],['Snoozed until',r.snoozedUntil?new Date(r.snoozedUntil).toLocaleString():'']].filter(([,v])=>v!=null&&v!=='').map(([k,v])=><div className="detail-item" key={String(k)}><small>{String(k)}</small><strong>{String(v)}</strong></div>)}</div>
    {r.evidence!=null&&typeof r.evidence==='object'&&Object.keys(r.evidence).length>0&&<div className="detail-grid">{Object.entries(r.evidence).map(([ek,ev])=><div className="detail-item" key={ek}><small>{ek}</small><strong>{typeof ev==='object'?JSON.stringify(ev).slice(0,400):String(ev)}</strong></div>)}</div>}
   </section>

   <section className="panel"><div className="panel-title"><h2>تصمیم</h2></div>
    <div className="toolbar"><button className="secondary-action" disabled={!!busy} onClick={()=>act('approve')}>{busy==='approve'?'…':'Approve'}</button><button className="secondary-action" disabled={!!busy} onClick={()=>act('reject')}>{busy==='reject'?'…':'Reject'}</button><button className="primary-action" disabled={!!busy} onClick={()=>act('accept')}>{busy==='accept'?'…':'Accept'}</button><button className="danger-action" disabled={!!busy} onClick={()=>act('execute')}>{busy==='execute'?'…':'Execute'}</button></div>
   </section>

   <section className="panel"><div className="panel-title"><h2>Snooze / Assign</h2></div>
    <form className="entity-form" onSubmit={e=>{e.preventDefault();if(!snoozeDatetime||isNaN(new Date(snoozeDatetime).getTime())){setError('زمان پایان Snooze را انتخاب کنید.');return}act('snooze',{until:new Date(snoozeDatetime).toISOString()})}}>
     <label>Snooze تا تاریخ<input type="datetime-local" value={snoozeDatetime} onChange={e=>setSnoozeDatetime(e.target.value)} aria-label="Snooze until"/></label>
     <button className="primary-action" disabled={!!busy}>Snooze</button>
    </form>
    <form className="entity-form" onSubmit={e=>{e.preventDefault();if(!assigneeId.trim()){setError('Assignee نیاز است.');return}act('assign',{assigneeId:assigneeId.trim()})}}>
     <label>Assignee (user ID)<input value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} placeholder="user uuid"/></label>
     <button className="primary-action" disabled={!!busy}>Assign</button>
    </form>
   </section>

   <section className="panel"><div className="panel-title"><h2>ویرایش</h2></div>
    <form className="entity-form" onSubmit={e=>{e.preventDefault();save()}}>
     <label>عنوان<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
     <label>توضیح (Rationale)<textarea value={rationale} onChange={e=>setRationale(e.target.value)}/></label>
     <label>Confidence (0-100)<input type="number" min={0} max={100} value={confidence} onChange={e=>setConfidence(e.target.value)}/></label>
     <button className="primary-action" disabled={!!busy}>{busy==='patch'?'در حال ذخیره…':'ذخیره'}</button>
    </form>
   </section>

   <section className="panel"><div className="panel-title"><div><h2>Explainability</h2></div><button className="secondary-action" onClick={showExplain} disabled={!!busy}>Explain</button></div>
    {explanation&&<>
      {explanation.reason?<p>{String(explanation.reason)}</p>:null}
      {explanation.explainability?.humanApprovalRequired!=null&&<p>Human approval required: {explanation.explainability.humanApprovalRequired?'بله':'خیر'}</p>}
      {Array.isArray(explanation.evidence)&&explanation.evidence.length?<div className="detail-grid">{explanation.evidence.map((e:any,i:number)=><div className="detail-item" key={i}><strong>{typeof e==='object'?JSON.stringify(e).slice(0,400):String(e)}</strong></div>)}</div>:null}
    </>}
   </section>
  </>}
 </main>;
}
