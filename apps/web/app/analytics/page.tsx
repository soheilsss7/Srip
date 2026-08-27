'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
const list=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
export default function Analytics(){
 const [data,setData]=useState<any>(null),[net,setNet]=useState<any>(null),[wf,setWf]=useState<any>(null),[funnel,setFunnel]=useState<any>(null),[e,setE]=useState('');
 useEffect(()=>{Promise.all([api('/analytics/summary'),api('/analytics/network'),api('/analytics/workflows'),api('/analytics/recommendations/funnel')]).then(([s,n,w,f])=>{setData(s);setNet(n);setWf(w);setFunnel(f)}).catch(x=>setE((x as Error).message))},[]);
 const counts=data?.counts??{}; const eng=data?.engagement??{}; const feature=list(eng.featureUsage);
 const netAvg=net?.relationshipAverages??{}; const netKpis=[
  ['Health',netAvg.healthScore??'—'],['Strategic',netAvg.strategicScore??'—'],['Trust',netAvg.trustScore??'—'],['Influence',netAvg.influenceScore??'—'],['Access',netAvg.accessScore??'—'],['Opportunity',netAvg.opportunityScore??'—'],['Resilience',netAvg.resilienceScore??'—'],['Risk',netAvg.riskScore??'—'],['Engagement',netAvg.engagementScore??'—']];
 const wfRows=list(wf?.executions); const stages=funnel?.stages??{}; const conv=funnel?.conversion??{}; const overall=funnel?.overall??{};
 return <main className="feature-page"><PageHeader eyebrow="PRODUCT ANALYTICS" title="Analytics" description="Tenant-scoped usage, activity, strategic network، workflow execution و Recommendation Funnel."/>
 <ErrorCard message={e}/>{!data&&!e?<Loading/>:<>
 {data?.status&&<div className="notice">ماژول Analytics: <strong>{data.status}</strong></div>}
 <section className="grid2">
  <section className="panel"><div className="panel-title"><div><h2>Core Counts</h2></div></div><div className="metric-list">{Object.entries(counts).map(([k,v])=><div key={k}><span>{k}</span><strong>{String(v)}</strong></div>)}</div></section>
  <section className="panel"><div className="panel-title"><div><h2>Engagement</h2></div></div><div className="metric-list"><div><span>Active users (30d)</span><strong>{eng.activeUsers30d??0}</strong></div><div><span>Recommendation acceptance</span><strong>{eng.recommendationAcceptance??0}</strong></div><div><span>Successful connections</span><strong>{eng.successfulConnections??0}</strong></div><div><span>Relationship updates</span><strong>{eng.relationshipUpdates??0}</strong></div></div></section>
 </section>
 {feature.length>0&&<section className="panel"><div className="panel-title"><div><h2>Feature Usage (30d)</h2></div></div><DataTable columns={[{key:'feature',label:'Feature'},{key:'count',label:'Count'}]} rows={feature.map((x:any)=>({feature:x.feature,count:x.count}))}/></section>}
 {net&&<section className="panel"><div className="panel-title"><div><h2>Strategic Network Metrics</h2><p>{net.relationships??'—'} relationships · {net.opportunities??'—'} opportunities · {net.people??'—'} people · {net.referralGroups??'—'} referral groups</p></div></div>
  <div className="kpi-grid">{netKpis.map(([k,v])=><div className="kpi-card" key={k}><small>{k}</small><strong>{typeof v==='number'?Math.round(v*100)/100:v}</strong></div>)}</div>
  <DataTable columns={[{key:'k',label:'متریک'},{key:'v',label:'مقدار'}]} rows={netKpis.map(([k,v])=>({k,v}))}/>
 </section>}
 {wf&&<section className="panel"><div className="panel-title"><div><h2>Workflow Executions</h2></div></div>{wfRows.length===0?<Empty>اجرایی ثبت نشده است.</Empty>:<div className="metric-list">{wfRows.map((x:any)=><div key={x.status}><span>{x.status}</span><strong>{x.count}</strong></div>)}</div>}</section>}
 {funnel&&<section className="panel"><div className="panel-title"><div><h2>Recommendation Funnel</h2><p>{new Date(funnel.from).toLocaleDateString()} تا {new Date(funnel.to).toLocaleDateString()}</p></div></div>
  <div className="kpi-grid">{Object.entries(stages).map(([k,v])=><div className="kpi-card" key={k}><small>{k}</small><strong>{String(v)}</strong></div>)}</div>
  <div className="grid2"><div className="panel compact"><h3>Conversion</h3><div className="metric-list">{Object.entries(conv).map(([k,v])=><div key={k}><span>{k}</span><strong>{typeof v==='number'?v+'%':String(v)}</strong></div>)}</div></div>
  <div className="panel compact"><h3>Overall</h3><div className="metric-list">{Object.entries(overall).map(([k,v])=><div key={k}><span>{k}</span><strong>{typeof v==='number'?v+'%':String(v)}</strong></div>)}</div></div></div>
 </section>}
 </>}</main>
}