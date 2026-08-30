'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
import {useWorkspace} from '../_components/workspace';
const list=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
const pct=(n:any)=>typeof n==='number'?Math.round(n*100)/100:n;
const toneFor=(s?:string):'success'|'warning'|'danger'|'info'|'neutral'=>({ACTIVE:'success',HEALTHY:'success',WARN:'warning',DANGER:'danger'}[s??''] as any)??'neutral';
export default function Intelligence(){
 const {scopeId,can}=useWorkspace();
 const canReadRelationship=can('relationship.read');
 const canReadNetwork=can('network.read');
 const canWriteRelationship=can('relationship.write');
 const [risk,setRisk]=useState<any[]>([]),[opps,setOpps]=useState<any[]>([]),[coverage,setCoverage]=useState<any>(null),[net,setNet]=useState<any>(null);
 const [versions,setVersions]=useState<any[]>([]),[loaded,setLoaded]=useState(false),[e,setE]=useState(''),[busy,setBusy]=useState('');
 const [vName,setVName]=useState(''),[vNotes,setVNotes]=useState(''),[calib,setCalib]=useState<Record<string,any>>({});
 const [showCreate,setShowCreate]=useState(false);
 async function load(){if(!canReadRelationship&&!canReadNetwork){setLoaded(true);return}setE('');try{const scope=scopeId!=='all'?`?organizationId=${encodeURIComponent(scopeId)}`:'';const [r,o,c,n,v]=await Promise.all([canReadRelationship?api('/intelligence/risk-signals'+scope):Promise.resolve([]),canReadRelationship?api('/intelligence/opportunity-detection'+scope):Promise.resolve([]),canReadRelationship?api('/intelligence/strategic-coverage'+scope):Promise.resolve(null),canReadNetwork?api('/intelligence/network'+scope):Promise.resolve(null),canReadRelationship?api('/intelligence/score-versions'):Promise.resolve([])]);setRisk(list(r));setOpps(list(o));setCoverage(c);setNet(n);setVersions(list(v));}catch(x){setE((x as Error).message)}finally{setLoaded(true)}}
 useEffect(()=>{void load()},[scopeId,canReadRelationship,canReadNetwork]);
 async function createVersion(){if(!canWriteRelationship)return;if(!vName.trim()){setE('نام نسخه الزامی است.');return}setBusy('create');setE('');try{await api('/intelligence/score-versions',{method:'POST',body:JSON.stringify({name:vName.trim(),weights:{},notes:vNotes||undefined})});setVName('');setVNotes('');setShowCreate(false);await load()}catch(x){setE((x as Error).message)}finally{setBusy('')}}
 async function activate(v:any){if(!canWriteRelationship)return;setBusy('act'+v.id);setE('');try{await api(`/intelligence/score-versions/${v.id}/activate`,{method:'POST',body:JSON.stringify({})});await load()}catch(x){setE((x as Error).message)}finally{setBusy('')}}
 async function toggleCalib(v:any){if(!canReadRelationship)return;setBusy('cal'+v.id);setE('');try{const s:any=await api(`/intelligence/score-calibrations/${v.id}/summary`);setCalib(c=>({...c,[v.id]:s}))}catch(x){setE((x as Error).message)}finally{setBusy('')}}
 const label=(n:any)=>n?.label??n?.name??n?.id??'—';
 if(!canReadRelationship&&!canReadNetwork)return <main className="feature-page"><PageHeader eyebrow="STRATEGIC INTELLIGENCE" title="هوشمندی شبکه" description="Relationship Health، Risk، Opportunity و Network Intelligence."/><section className="panel"><Empty>مجوز مشاهده هوشمندی برای شما فعال نیست.</Empty></section></main>;
 return <main className="feature-page"><PageHeader eyebrow="STRATEGIC INTELLIGENCE" title="هوشمندی شبکه" description="Relationship Health، Risk، Opportunity، Strategic Coverage، Network Intelligence و Score Versioning؛ بدون فعال‌کردن AI Provider."/>
 <ErrorCard message={e}/>
 {!loaded&&!e?<Loading/>:<>
 <section className="dashboard-grid">
  <article className="panel"><h2>Risk Signals</h2>{risk.length===0?<Empty>سیگنال ریسکی در Scope شما نیست.</Empty>:<DataTable columns={['relationshipId','riskScore','healthScore','resilienceScore','signals'].map(k=>({key:k,label:k}))} rows={risk.map(r=>({...r,riskScore:<Badge tone={r.riskScore>=70?'danger':r.riskScore>=40?'warning':'success'}>{r.riskScore}</Badge>,signals:Array.isArray(r.signals)?r.signals.map((s:string)=><span key={s} className="pill"> {s} </span>):r.signals}))}/>}</article>
  <article className="panel"><h2>Opportunity Detection</h2>{opps.length===0?<Empty>فرصت قابل‌تشخیصی وجود ندارد.</Empty>:<DataTable columns={['relationshipId','type','confidence','reason','sourceOrganizationId','targetOrganizationId'].map(k=>({key:k,label:k}))} rows={opps.map(o=>({...o,confidence:<Badge tone={o.confidence>=70?'success':o.confidence>=40?'warning':'info'}>{pct(o.confidence)}</Badge>}))}/>}</article>
 </section>
 {coverage&&<section className="panel"><div className="panel-title"><div><h2>Strategic Coverage</h2><p>پوشش روابط استراتژیک (Strategic ≥ 60) در Scope فعلی</p></div></div>
  <div className="kpi-grid"><div className="kpi-card"><small>روابط استراتژیک</small><strong>{coverage.strategicRelationships??0}</strong></div><div className="kpi-card"><small>استراتژیک سالم (Health ≥60)</small><strong>{coverage.healthyStrategicRelationships??0}</strong></div><div className="kpi-card"><small>استراتژیک تاب‌آور (Resilience ≥60)</small><strong>{coverage.resilientStrategicRelationships??0}</strong></div><div className="kpi-card"><small>درصد پوشش سالم</small><strong>{pct(coverage.coveragePercent)}%</strong></div></div>
  <p className="muted">Scope Organizations: {coverage.scopeOrganizations??'—'} · Bounded: {coverage.bounded==null?'—':String(coverage.bounded)}</p>
 </section>}
 {net&&<section className="dashboard-grid">
  <article className="panel"><div className="panel-title"><div><h2>Network Centrality</h2></div></div>{list(net.centrality).length===0?<Empty/>:<DataTable columns={[{key:'node',label:'گره'},{key:'degree',label:'درجه'}]} rows={list(net.centrality).map((x:any)=>({node:label(x.node),degree:x.degree}))}/>}</article>
  <article className="panel"><div className="panel-title"><div><h2>Bridge People</h2></div></div>{list(net.bridgePeople).length===0?<Empty/>:<DataTable columns={[{key:'node',label:'شخص'},{key:'bridgeScore',label:'Bridge Score'}]} rows={list(net.bridgePeople).map((x:any)=>({node:label(x.node),bridgeScore:x.bridgeScore}))}/>}</article>
  <article className="panel"><div className="panel-title"><div><h2>Bottlenecks</h2></div></div>{list(net.bottlenecks).length===0?<Empty/>:<DataTable columns={[{key:'node',label:'گره'},{key:'bottleneckScore',label:'امتیاز گلوگاه'},{key:'riskyConnections',label:'اتصال پرریسک'}]} rows={list(net.bottlenecks).map((x:any)=>({node:label(x.node),bottleneckScore:x.bottleneckScore,riskyConnections:x.riskyConnections}))}/>}</article>
  <article className="panel"><div className="panel-title"><div><h2>Single Points of Failure</h2></div></div>{list(net.singlePointsOfFailure).length===0?<Empty/>:<DataTable columns={[{key:'node',label:'گره'},{key:'fragmentationIncrease',label:'افزایش قطعه‌قطعه‌شدن'}]} rows={list(net.singlePointsOfFailure).map((x:any)=>({node:label(x.node),fragmentationIncrease:x.fragmentationIncrease}))}/>}</article>
 </section>}
 <section className="panel"><div className="panel-title"><div><h2>Score Versions</h2><p>{versions.length} نسخه</p></div>{canWriteRelationship&&<button className="secondary-action" onClick={()=>setShowCreate(s=>!s)} disabled={!!busy}>{showCreate?'بستن':'نسخه جدید'}</button>}</div>
 {canWriteRelationship&&showCreate&&<div className="entity-form"><label>نام نسخه<input value={vName} onChange={e=>setVName(e.target.value)} placeholder="مثلاً core-scoring"/></label><label>یادداشت کالیبراسیون<textarea value={vNotes} onChange={e=>setVNotes(e.target.value)} placeholder="اختیاری"/></label><button className="primary-action" onClick={createVersion} disabled={!!busy}>{busy==='create'?'در حال ثبت…':'ثبت نسخه'}</button></div>}
 {versions.length===0?<Empty>نسخه امتیازدهی ثبت نشده است.</Empty>:<div className="list">{versions.map(v=><article className="panel compact" key={v.id}><div className="panel-title"><div><strong>{v.name} · v{v.version}</strong><small className="muted">وزن‌ها: {JSON.stringify(v.weights)}</small></div><span><Badge tone={toneFor(v.status)}>{v.status}</Badge>{canWriteRelationship&&v.status!=='ACTIVE'&&<button className="secondary-action" onClick={()=>activate(v)} disabled={!!busy}>فعال‌سازی</button>}<button className="secondary-action" onClick={()=>toggleCalib(v)} disabled={!!busy}>{calib[v.id]?'پنهان‌کردن':'خلاصه کالیبراسیون'}</button></span></div>
 {calib[v.id]&&<><div className="kpi-grid"><div className="kpi-card"><small>نمونه‌ها</small><strong>{calib[v.id].samples??0}</strong></div><div className="kpi-card"><small>MAE</small><strong>{calib[v.id].meanAbsoluteError??'—'}</strong></div><div className="kpi-card"><small>نتایج مشاهده‌شده</small><strong>{Array.isArray(calib[v.id].outcomes)?calib[v.id].outcomes.length:0}</strong></div></div><p className="muted">{Array.isArray(calib[v.id].outcomes)?calib[v.id].outcomes.join('، '):''} · Bounded: {String(calib[v.id].bounded??'—')}</p></>}
 </article>)}</div>}
 </section>
 </>}</main>
}