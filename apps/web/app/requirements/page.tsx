'use client';
import {useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
import {EntityPicker} from '../_components/entity-picker';
import {useWorkspace} from '../_components/workspace';

type Conn = { targetOrganization?: { name?: string; industry?: string | null; type?: string; id?: string }; connectionType?: string; scope?: string; targetFit?: number; pathStrength?: number; successProbability?: number; path?: { hopCount?: number; organizationIds?: string[] } | null; connectorPerson?: { displayName?: string; firstName?: string; lastName?: string } | null; recommendation?: string };
type Result = { requirement?: { title?: string; description?: string | null; category?: string | null; id?: string }; summary?: { direct?: number; indirect?: number; internal?: number; external?: number; gaps?: number }; bestConnection?: Conn | null; directConnections?: Conn[]; indirectConnections?: Conn[]; relationshipGaps?: Conn[]; recommendations?: Array<{ rank?: number; title?: string; rationale?: string; successProbability?: number; targetOrganizationId?: string }> };

export default function Requirements(){
  const {scopeId}=useWorkspace();
  const [id,setId]=useState(''),[requirementLabel,setRequirementLabel]=useState(''),[limit,setLimit]=useState('20'),[data,setData]=useState<Result|null>(null),[loading,setLoading]=useState(false),[e,setE]=useState('');
  async function run(){setE('');setLoading(true);try{setData(await api<Result>(`/requirements/${encodeURIComponent(id)}/matches?limit=${encodeURIComponent(limit)}`))}catch(x){setE((x as Error).message);setData(null)}finally{setLoading(false)}}
  const card=(c:Conn,i:number)=>(
    <article className="panel compact" key={i}>
      <div className="panel-title"><div><h3>{c.targetOrganization?.name ?? 'Unknown'}</h3><p>{(c.targetOrganization?.industry || '—')} · {c.targetOrganization?.type ?? '—'}</p></div>
        <Badge tone={c.connectionType==='DIRECT'?'success':c.scope==='INTERNAL'?'info':'warning'}>{c.connectionType ?? '—'} / {c.scope ?? '—'}</Badge></div>
      <div className="metric-list">
        <div><span>Target Fit</span><strong>{Math.round(c.targetFit??0)}%</strong></div>
        <div><span>Path Strength</span><strong>{Math.round(c.pathStrength??0)}%</strong></div>
        <div><span>Success Prob.</span><strong>{Math.round(c.successProbability??0)}%</strong></div>
        <div><span>Hops</span><strong>{c.path?.hopCount ?? '—'}</strong></div>
        {c.connectorPerson && <div><span>Connector</span><strong>{c.connectorPerson.displayName ?? `${c.connectorPerson.firstName} ${c.connectorPerson.lastName}`}</strong></div>}
      </div>
      {c.recommendation && <p className="muted">{c.recommendation}</p>}
    </article>
  );
  const s=data?.summary;
  return <main className="feature-page">
    <PageHeader eyebrow="PROJECT REQUIREMENTS" title="Requirement Matching" description="Requirement-to-Relationship: برای یک Requirement پروژه، پوشش ارتباطی قابل مشاهده و Permission-aware را محاسبه کنید." actions={<Badge tone="info">{data?`${s?.direct??0} direct / ${s?.indirect??0} indirect`:'انتظار query'}</Badge>}/>
    <section className="panel"><form className="form-grid" onSubmit={(e)=>{e.preventDefault();run();}}>
      <EntityPicker label="نیازمندی پروژه" endpoint="/projects/requirements/picker" value={id} selectedLabel={requirementLabel} onChange={value=>{setId(value);setData(null)}} onLabelChange={(_,label)=>setRequirementLabel(label)} scopeId={scopeId} required disabled={loading}/>
      <label className="inline-field">Limit<input type="number" min="1" max="100" value={limit} onChange={e=>setLimit(e.target.value)} disabled={loading}/></label>
      <button className="primary-action" disabled={!id||loading}>{loading?'در حال محاسبه…':'محاسبه Match'}</button>
    </form></section>
    <ErrorCard message={e}/>
    {loading?<Loading/>:data&&(<>
      <section className="kpi-grid">
        <div className="kpi-card"><span>Direct</span><strong>{s?.direct??0}</strong></div>
        <div className="kpi-card"><span>Indirect</span><strong>{s?.indirect??0}</strong></div>
        <div className="kpi-card"><span>Internal</span><strong>{s?.internal??0}</strong></div>
        <div className="kpi-card"><span>External</span><strong>{s?.external??0}</strong></div>
        <div className="kpi-card"><span>Gaps</span><strong>{s?.gaps??0}</strong></div>
      </section>
      {data.recommendations?.length?<section className="panel"><h2>Best Connections</h2>{data.recommendations.map(r=>(<div className="panel compact" key={r.rank}><strong>#{r.rank} · {r.title}</strong><span className="muted">{r.rationale}</span><Badge tone="success">{Math.round(r.successProbability??0)}%</Badge></div>))}</section>:null}
      <section className="grid2">
        <div className="panel"><h2>Direct Connections</h2><div className="action-list">{(data.directConnections??[]).map(card)}</div>{(data.directConnections??[]).length===0&&<Empty>بدون اتصال مستقیم</Empty>}</div>
        <div className="panel"><h2>Indirect Connections</h2><div className="action-list">{(data.indirectConnections??[]).map(card)}</div>{(data.indirectConnections??[]).length===0&&<Empty>بدون اتصال غیرمستقیم</Empty>}</div>
      </section>
      <section className="panel"><h2>Relationship Gaps</h2>{data.relationshipGaps?.length?<DataTable columns={[{key:'org',label:'سازمان'},{key:'fit',label:'Fit'},{key:'reason',label:'دلیل'}]} rows={(data.relationshipGaps??[]).map((g:Conn)=>({org:g.targetOrganization?.name??'—',fit:`${Math.round(g.targetFit??0)}%`,reason:g.recommendation??'—'}))}/>:<Empty>هیچ Gap یافت نشد.</Empty>}</section>
    </>)}
  </main>;
}
