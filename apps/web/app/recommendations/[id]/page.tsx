'use client';
import Link from 'next/link';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {fa} from '../../_lib/fa';
import {Badge,ErrorCard,Loading,Modal,PageHeader} from '../../_components/page-ui';
import { JalaliDateField } from '../../_components/jalali-date-field';

export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [r,setR]=useState<any>(null),[explanation,setExplanation]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [title,setTitle]=useState(''),[rationale,setRationale]=useState(''),[confidence,setConfidence]=useState('');
 const [assigneeId,setAssigneeId]=useState(''),[snoozeDatetime,setSnoozeDatetime]=useState(''),[form,setForm]=useState<'snooze'|'assign'|'edit'|null>(null);

 const load=useCallback(async()=>{setError('');try{const v:any=await api(`/recommendations/${id}`);setR(v);setTitle(v.title??'');setRationale(v.rationale??'');setConfidence(v.confidence!=null?String(v.confidence):'')}catch(e){setError((e as Error).message)}},[id]);
 useEffect(()=>{load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>):Promise<boolean>{setBusy(label);setError('');try{await fn();await load();return true}catch(e){setError((e as Error).message);return false}finally{setBusy('')}}
 const act=(action:string,body:unknown={})=>doIt(action,()=>api(`/recommendations/${id}/${action}`,{method:'POST',body:JSON.stringify(body)}));
 async function save(){await doIt('patch',()=>api(`/recommendations/${id}`,{method:'PATCH',body:JSON.stringify({title:title.trim()||undefined,rationale:rationale.trim()||undefined,confidence:confidence.trim()===''?undefined:Math.min(100,Math.max(0,Number(confidence)))})}))}
 async function showExplain(){setExplanation(null);setError('');try{setExplanation(await api(`/recommendations/${id}/explain`))}catch(e){setError((e as Error).message)}}

 return <main className="feature-page">
  <PageHeader eyebrow="پیشنهاد" title={r?.title??'پیشنهاد'} description={`شناسه: ${id}`} actions={<div className="toolbar"><Link className="secondary-action" href="/recommendations">بازگشت</Link><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button></div>}/>
  <ErrorCard message={error}/>
  {!r&&!error?<Loading/>:r&&<>
   <section className="panel">
    <div className="panel-title"><div><h2>{r.type??'پیشنهاد'}</h2><p>{r.rationale??''}</p></div><Badge tone={r.status==='APPROVED'?'success':r.status==='REJECTED'?'danger':'info'}>{fa(r.status)??'پیشنهادی'}</Badge></div>
    <div className="metric-list"><div><span>اطمینان</span><strong>{r.confidence??'—'}%</strong></div><div><span>دارای شواهد</span><strong>{r.evidence?'بله':'خیر'}</strong></div></div>
    <div className="detail-grid">{[['رابطه',fa(r.relationship?.relationshipType)],['سازمان مبدأ',r.relationship?.sourceOrganization?.name],['سازمان مقصد',r.relationship?.targetOrganization?.name],['واگذار به',r.assignedToId],['تصمیم‌گیرنده',r.decisionById],['زمان تصمیم',r.decisionAt?new Date(r.decisionAt).toLocaleString():''],['تعویق تا',r.snoozedUntil?new Date(r.snoozedUntil).toLocaleString():'']].filter(([,v])=>v!=null&&v!=='').map(([k,v])=><div className="detail-item" key={String(k)}><small>{String(k)}</small><strong>{String(v)}</strong></div>)}</div>
    {r.evidence!=null&&typeof r.evidence==='object'&&Object.keys(r.evidence).length>0&&<div className="detail-grid">{Object.entries(r.evidence).map(([ek,ev])=><div className="detail-item" key={ek}><small>{ek}</small><strong>{typeof ev==='object'?JSON.stringify(ev).slice(0,400):String(ev)}</strong></div>)}</div>}
   </section>

   <section className="panel"><div className="panel-title"><h2>تصمیم</h2></div>
    <div className="toolbar"><button className="secondary-action" disabled={!!busy} onClick={()=>act('approve')}>{busy==='approve'?'…':'تأیید'}</button><button className="secondary-action" disabled={!!busy} onClick={()=>act('reject')}>{busy==='reject'?'…':'رد'}</button><button className="primary-action" disabled={!!busy} onClick={()=>act('accept')}>{busy==='accept'?'…':'پذیرش'}</button><button className="danger-action" disabled={!!busy} onClick={()=>act('execute')}>{busy==='execute'?'…':'اجرا'}</button></div>
   </section>

   <section className="panel"><div className="panel-title"><h2>تعویق / واگذاری</h2></div>
    <div className="toolbar"><button className="secondary-action" disabled={!!busy} onClick={()=>{setError('');setForm('snooze')}}>تعویق</button><button className="secondary-action" disabled={!!busy} onClick={()=>{setError('');setForm('assign')}}>واگذاری</button></div>
   </section>

   <section className="panel"><div className="panel-title"><h2>ویرایش</h2></div>
    <div className="toolbar"><button className="primary-action" disabled={!!busy} onClick={()=>{setError('');setForm('edit')}}>ویرایش</button></div>
   </section>

   <section className="panel"><div className="panel-title"><div><h2>قابل‌توضیح‌بودن</h2></div><button className="secondary-action" onClick={showExplain} disabled={!!busy}>توضیح</button></div>
    {explanation&&<>
      {explanation.reason?<p>{String(explanation.reason)}</p>:null}
      {explanation.explainability?.humanApprovalRequired!=null&&<p>Human approval required: {explanation.explainability.humanApprovalRequired?'بله':'خیر'}</p>}
      {Array.isArray(explanation.evidence)&&explanation.evidence.length?<div className="detail-grid">{explanation.evidence.map((e:any,i:number)=><div className="detail-item" key={i}><strong>{typeof e==='object'?JSON.stringify(e).slice(0,400):String(e)}</strong></div>)}</div>:null}
    </>}
   {/* Action modal */}
   <Modal open={form!==null} title={form==='snooze'?'تعویق توصیه':form==='assign'?'واگذاری توصیه':'ویرایش توصیه'} description={form==='snooze'?'توصیه را تا تاریخ مشخصی به حالت تعلیق درآورید.':form==='assign'?'توصیه را به یک کاربر اختصاص دهید.':'عنوان، توضیح و اطمینان توصیه را ویرایش کنید.'} onClose={()=>setForm(null)}
     footer={<>
       <button type="button" className="btn btn-secondary" onClick={()=>setForm(null)}>انصراف</button>
       {form==='snooze'&&<button type="submit" form="rec-snooze-form" className="btn btn-primary" disabled={!!busy}>تعویق</button>}
       {form==='assign'&&<button type="submit" form="rec-assign-form" className="btn btn-primary" disabled={!!busy}>واگذاری</button>}
       {form==='edit'&&<button type="submit" form="rec-edit-form" className="btn btn-primary" disabled={!!busy}>{busy==='patch'?'در حال ذخیره…':'ذخیره'}</button>}
     </>}>
     {form==='snooze'&&<form id="rec-snooze-form" className="entity-form" onSubmit={async e=>{e.preventDefault();if(!snoozeDatetime||isNaN(new Date(snoozeDatetime).getTime())){setError('زمان پایان تعویق را انتخاب کنید.');return}if(await act('snooze',{until:new Date(snoozeDatetime).toISOString()}))setForm(null)}}>
       <div className="field full"><label className="field-label">Snooze تا تاریخ</label><JalaliDateField withTime value={snoozeDatetime} onChange={(v)=>setSnoozeDatetime(v)} aria-label="تعویق تا" /></div>
     </form>}
     {form==='assign'&&<form id="rec-assign-form" className="entity-form" onSubmit={async e=>{e.preventDefault();if(!assigneeId.trim()){setError('شناسه کاربر الزامی است.');return}if(await act('assign',{assigneeId:assigneeId.trim()}))setForm(null)}}>
       <div className="field full"><label className="field-label">واگذار به (شناسه کاربر) <span className="req">*</span></label><input value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} placeholder="شناسه کاربر"/></div>
     </form>}
     {form==='edit'&&<form id="rec-edit-form" className="entity-form" onSubmit={async e=>{e.preventDefault();if(await doIt('patch',()=>api(`/recommendations/${id}`,{method:'PATCH',body:JSON.stringify({title:title.trim()||undefined,rationale:rationale.trim()||undefined,confidence:confidence.trim()===''?undefined:Math.min(100,Math.max(0,Number(confidence)))})})))setForm(null)}}>
       <div className="field"><label className="field-label">عنوان</label><input value={title} onChange={e=>setTitle(e.target.value)}/></div>
       <div className="field full"><label className="field-label">توضیح (Rationale)</label><textarea value={rationale} onChange={e=>setRationale(e.target.value)}/></div>
       <div className="field"><label className="field-label">اطمینان (۰-۱۰۰)</label><input type="number" min={0} max={100} value={confidence} onChange={e=>setConfidence(e.target.value)}/></div>
     </form>}
   </Modal>
   </section>
  </>}
 </main>;
}
