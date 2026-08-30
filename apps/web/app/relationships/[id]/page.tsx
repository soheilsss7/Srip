'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
import {RelatedNotes} from '../../_components/related-notes';
import {QuickCreate} from '../../_components/quick-create';
import {useWorkspace} from '../../_components/workspace';
const LIFECYCLE=['IDENTIFIED','INTRODUCED','INITIAL_CONTACT','DEVELOPING','ACTIVE','STRATEGIC','DORMANT','AT_RISK','LOST'];
const STATUS=['PROSPECTIVE','ACTIVE','AT_RISK','DORMANT','ARCHIVED'];
export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const {can}=useWorkspace();
 const canRead=can('relationship.read');
 const canWrite=can('relationship.write');
 const canRestore=can('data.restore');
 const [r,setR]=useState<any>(null),[t,setT]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[quickOpen,setQuickOpen]=useState(false);
 const load=useCallback(async()=>{if(!canRead){setR(null);return}setError('');try{const [a,b]=await Promise.all([api(`/relationships/${id}`),api(`/relationships/${id}/timeline`)]);setR(a);setT(b)}catch(e){setError((e as Error).message)}},[id,canRead]);
 useEffect(()=>{void load()},[load]);
 async function doIt(label:string,fn:()=>Promise<any>,allowed=canWrite){if(!allowed)return;setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const pct=(v:any)=>v==null?'—':`${v}`;
 const milestones=t?.items?.map((x:any)=>({item:x}))??[];
 const scores=['healthScore','strategicScore','riskScore','trustScore','influenceScore','opportunityScore','resilienceScore','engagementScore'];
 if(!canRead)return <main className="feature-page"><PageHeader eyebrow="CORE DOMAIN · RELATIONSHIP PROFILE" title="Relationship" description="پروفایل رابطه و رویدادهای مرتبط."/><section className="panel"><p className="empty-state">مجوز مشاهده این رابطه برای شما فعال نیست.</p></section></main>;
 return <main className="feature-page">
  <PageHeader eyebrow="CORE DOMAIN · RELATIONSHIP PROFILE" title={r?`${r.sourceOrganization?.name} ↔ ${r.targetOrganization?.name}`:'Relationship'} description={`${r?.relationshipType??''} · ${r?.status??''}`} actions={<div className="toolbar"><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button>{canWrite&&<><button className="primary-action" onClick={()=>setQuickOpen(true)} disabled={!!busy}>+ ثبت سریع</button><label className="inline-label">وضعیت<select value={r?.status??'ACTIVE'} disabled={!!busy} onChange={e=>doIt('status',()=>api(`/relationships/${id}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})}))}>{STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select></label><label className="inline-label">مرحله چرخه زندگی<select value={r?.lifecycleStage??'ACTIVE'} disabled={!!busy} onChange={e=>doIt('lifecycle',()=>api(`/relationships/${id}/lifecycle`,{method:'PATCH',body:JSON.stringify({lifecycleStage:e.target.value})}))}>{LIFECYCLE.map(s=><option key={s} value={s}>{s}</option>)}</select></label><button className="primary-action" disabled={!!busy} onClick={()=>doIt('recalc',()=>api(`/relationships/${id}/recalculate-score`,{method:'POST'}))}>محاسبه مجدد امتیاز</button></>}{r?.status==='ARCHIVED'?(canRestore&&<button className="primary-action" disabled={!!busy} onClick={()=>doIt('restore',()=>api(`/relationships/${id}/restore`,{method:'POST'}),canRestore)}>بازیابی</button>):(canWrite&&<button className="danger-action" disabled={!!busy} onClick={()=>{if(confirm('این رابطه بایگانی شود؟'))doIt('archive',()=>api(`/relationships/${id}/archive`,{method:'PATCH'}))}}>بایگانی</button>)}</div>}/>
  <ErrorCard message={error}/>
  {!r&&!error?<Loading/>:r&&<>
   <section className="panel"><div className="panel-title"><div><h2>Scores & Ownership</h2><p>امتیازهای محاسبه‌شده Backend</p></div><div className="stat-row">{scores.map(s=><div className="stat-box" key={s}><span>{s}</span><strong>{pct(r[s])}</strong></div>)}</div></div><div className="detail-grid">{[['Owner',r.owner?.name],['Backup Owner',r.backupOwner?.name],['Lifecycle',r.lifecycleStage],['Status',r.status],['Relationship Type',r.relationshipType],['Source Org',r.sourceOrganization?.name],['Target Org',r.targetOrganization?.name]].filter(([,v])=>v!=null).map(([k,v])=> <div className="detail-item" key={String(k)}><small>{k}</small><strong>{String(v)}</strong></div>)}</div></section>
   <section className="panel"><div className="panel-title"><div><h2>Timeline</h2><Badge>{milestones.length}</Badge></div></div>{milestones.length?<div className="list">{milestones.map(({item}:any,i:number)=><div className="listRow" key={item.id??i}><span><Badge tone="neutral">{item.kind}</Badge></span><span><strong>{item.title||item.subject||item.description||item.name||item.status||'—'}</strong>{item.date?<small>{new Date(item.date).toLocaleString()}</small>:null}</span></div>)}</div>:<p className="empty-state">رویدادی در Timeline ثبت نشده است.</p>}</section>
   <RelatedNotes notes={r.notes} title="یادداشت‌های رابطه" />
   {canWrite&&<QuickCreate open={quickOpen} onClose={()=>setQuickOpen(false)} onCreated={load} context={{relationshipId:id, organizationId:r.sourceOrganizationId}} />}
  </>}
 </main>;
}