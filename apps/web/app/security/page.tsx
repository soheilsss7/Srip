'use client'; import {useEffect,useState} from 'react'; import {api,unwrapList} from '../_lib/api'; import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
type Preflight={generatedAt:string;overall:string;checks:Array<{key:string;status:'PASS'|'WARN'|'FAIL';detail:string}>};
export default function Security(){
 const [events,setEvents]=useState<any[]>([]),[exports,setExports]=useState<any[]>([]),[preflight,setPreflight]=useState<Preflight|null>(null),[loading,setLoading]=useState(true),[e,setE]=useState(''),[busy,setBusy]=useState('');
 async function load(scope='all'){setLoading(true);setE('');setPreflight(scope==='preflight'?preflight:null);try{const [ev,ex]=await Promise.all([api('/security/events').then(unwrapList),api('/security/exports').then(unwrapList)]);setEvents(ev);setExports(ex);}catch(x){setE((x as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function runPreflight(){setBusy('preflight');setE('');try{setPreflight(await api<Preflight>('/security/governance/preflight'))}catch(x){setE((x as Error).message)}finally{setBusy('')}}
 const sevTone=(s:string)=>{if(s==='CRITICAL'||s==='HIGH')return'danger';if(s==='MEDIUM')return'warning';return'neutral'};
 const checkTone=(s:string)=>{if(s==='FAIL')return'danger';if(s==='WARN')return'warning';return'success'};
 const eventCols=['type','severity','ipAddress','entityType','entityId','createdAt'].map(k=>({key:k,label:k}));
 const exportCols=['exportType','entityType','recordCount','classification','createdAt'].map(k=>({key:k,label:k}));
 return <main className="feature-page"><PageHeader eyebrow="SECURITY" title="امنیت و Governance" description="Security Events، Governance Preflight و Export Audit بدون افشای رمز/کلیدها." actions={<button className="primary-action" onClick={runPreflight} disabled={!!busy}>{busy==='preflight'?'در حال بررسی…':'Governance Preflight'}</button>}/>
 <ErrorCard message={e}/>
 {preflight&&<section className="panel"><div className="panel-title"><div><h2>Governance Preflight</h2><p>{new Date(preflight.generatedAt).toLocaleString()} · تعداد چک‌ها {preflight.checks.length}</p></div><Badge tone={checkTone(preflight.overall)}>Overall: {preflight.overall}</Badge></div><div className="stat-row">{preflight.checks.map(c=><div className="stat-box" key={c.key}><span>{c.key}</span><Badge tone={checkTone(c.status)}>{c.status}</Badge><small className="muted">{c.detail}</small></div>)}</div></section>}
 {loading?<Loading/>:<>
  <section className="panel"><div className="panel-title"><div><h2>Security Events</h2><p>{events.length} رویداد</p></div></div>{events.length===0?<Empty>رویدادی در Scope شما ثبت نشده است.</Empty>:<DataTable columns={eventCols} rows={events.map(r=>({...r,severity:<Badge tone={sevTone(r.severity)}>{r.severity}</Badge>,createdAt:new Date(r.createdAt).toLocaleString()}))}/>}</section>
  <section className="panel"><div className="panel-title"><div><h2>Export Audit</h2><p>{exports.length} خروجی</p></div></div>{exports.length===0?<Empty>خروجی ثبت‌شده‌ای وجود ندارد.</Empty>:<DataTable columns={exportCols} rows={exports.map(r=>({...r,createdAt:new Date(r.createdAt).toLocaleString()}))}/>}</section>
 </>}
 </main>}