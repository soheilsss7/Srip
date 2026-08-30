'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
import {EntityPicker} from '../../_components/entity-picker';
import {useWorkspace} from '../../_components/workspace';
const STATUS=['OPEN','IN_PROGRESS','DONE','BLOCKED','CANCELLED'];
export default function Page({params}:{params:Promise<{id:string}>}){
const {id}=use(params);
const {scopeId,can}=useWorkspace();
const canRead=can('action.read');
const canWrite=can('action.write');
const [a,setA]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
const [linkDepId,setLinkDepId]=useState(''); const [linkDepOpen,setLinkDepOpen]=useState(false);
 const load=useCallback(async()=>{if(!canRead){setA(null);return}setError('');try{setA(await api(`/actions/${id}`))}catch(e){setError((e as Error).message)}},[id,canRead]);
 useEffect(()=>{void load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>){if(!canWrite)return;setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function patch(body:any){await doIt('patch',()=>api(`/actions/${id}`,{method:'PATCH',body:JSON.stringify(body)}))}
 async function addDependency(dependsOnActionId:string){await doIt('dep',()=>api(`/actions/${id}/dependencies/${encodeURIComponent(dependsOnActionId)}`,{method:'POST'}));setLinkDepId('');setLinkDepOpen(false)}
 async function removeDependency(dependsOnActionId:string){if(!confirm('این وابستگی حذف شود؟'))return;await doIt('undep',()=>api(`/actions/${id}/dependencies/${encodeURIComponent(dependsOnActionId)}`,{method:'DELETE'}))}
 const deps=a?.dependencies??[];
 const blockedBy=a?.blockedBy??[];
 const info=a?Object.entries(a).filter(([k])=>!['dependencies','blockedBy','owner','createdBy','organization','relationship','meeting','project','person'].includes(k)&&typeof a[k]!=='function').slice(0,24):[];
 if(!canRead)return <main className="feature-page"><PageHeader eyebrow="ACTION" title="Action" description="پیگیری وضعیت، موعد و وابستگی‌های این اقدام."/><section className="panel"><p className="empty-state">مجوز مشاهده این اقدام برای شما فعال نیست.</p></section></main>;
 return <main className="feature-page">
  <PageHeader eyebrow="ACTION" title={a?.title??'Action'} description="پیگیری وضعیت، موعد و وابستگی‌های این اقدام." actions={<div className="toolbar"><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button>{canWrite&&<><label className="inline-label">وضعیت<select value={a?.status??'OPEN'} disabled={!!busy} onChange={e=>patch({status:e.target.value})}>{STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select></label><button className="danger-action" disabled={!!busy} onClick={()=>{if(confirm('این اقدام حذف شود؟'))doIt('del',()=>api(`/actions/${id}`,{method:'DELETE'}))}}>حذف</button></>}</div>}/>
  <ErrorCard message={error}/>
  {!a&&!error?<Loading/>:a&&<>
   <section className="panel"><div className="panel-title"><div><h2>جزئیات اقدام</h2><p>{a.description??'بدون توضیح'}</p></div><Badge tone={a.status==='DONE'?'success':a.status==='BLOCKED'?'danger':'neutral'}>{a.status??'—'}</Badge></div><div className="detail-grid">{info.map(([k,v])=>{if(v==null)return null;return <div className="detail-item" key={k}><small>{k}</small><strong>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></div>})}</div></section>
   <div className="split-panels">
    <section className="panel"><div className="panel-title"><div><h2>وابستگی‌ها (این اقدام وابسته است به…)</h2><Badge>{deps.length}</Badge></div>{canWrite&&(linkDepOpen?<span className="inline-form"><EntityPicker label="اقدام وابسته" endpoint="/actions" value={linkDepId} onChange={setLinkDepId} scopeId={scopeId}/><button className="primary-action" onClick={()=>{if(linkDepId) addDependency(linkDepId)}} disabled={!!busy||!linkDepId}>افزودن</button><button className="secondary-action" onClick={()=>{setLinkDepOpen(false);setLinkDepId('')}}>انصراف</button></span>:<button className="secondary-action" onClick={()=>setLinkDepOpen(true)} disabled={!!busy}>افزودن وابستگی</button>)}</div>{deps.length?<div className="list">{deps.map((d:any)=><div className="listRow" key={d.id??d.dependsOnActionId}><Badge tone={d.dependsOnAction?.status==='DONE'?'success':'neutral'}>{d.dependsOnAction?.status??'—'}</Badge><span><strong>{d.dependsOnAction?.title??d.dependsOnActionId}</strong><small>{d.dependsOnAction?.dueAt?`سررسید ${new Date(d.dependsOnAction.dueAt).toLocaleDateString()}`:'بدون سررسید'}</small></span>{canWrite&&<span className="resource-row-actions"><button onClick={()=>removeDependency(d.dependsOnActionId)}>حذف</button></span>}</div>)}</div>:<p className="empty-state">وابستگی ثبت نشده است.</p>}</section>
    <section className="panel"><div className="panel-title"><div><h2>مسدودکننده‌ها (Blocked By)</h2><Badge>{blockedBy.length}</Badge></div></div>{blockedBy.length?<div className="list">{blockedBy.map((b:any)=><div className="listRow" key={b.actionId}><Badge tone={b.action?.status==='DONE'?'success':'danger'}>{b.action?.status??'—'}</Badge><span><strong>{b.action?.title??b.actionId}</strong></span></div>)}</div>:<p className="empty-state">این اقدام مسدود نیست.</p>}</section>
   </div>
  </>}
 </main>;
}