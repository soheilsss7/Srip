'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../_lib/api';
import { DataTable, Empty, ErrorCard, Loading } from '../_components/page-ui';

type Node={id:string;label:string;type:string;organizationId?:string}; type Edge={id:string;source:string;target:string;kind:string;weight:number;risk:number;strategicImportance:number;label?:string}; type Graph={nodes:Node[];edges:Edge[];meta:any};
const STATUSES=['PROSPECTIVE','ACTIVE','AT_RISK','DORMANT','ARCHIVED'];

function renderAnalysis(kind:string,rows:any[]){
  if(!rows.length) return <Empty>داده‌ای برای این تحلیل یافت نشد.</Empty>;
  const nodeName=(x:any)=>x?.node?.name??x?.node?.displayName??x?.node?.label??(typeof x?.node==='string'?x.node:'—');
  const metric=(x:any)=>kind==='centrality'?('degree' in x?x.degree:x.degreeScore)
    :kind==='bridges'?('bridgeScore' in x?x.bridgeScore:'—')
    :kind==='bottlenecks'?('bottleneckScore' in x?x.bottleneckScore:'—')
    :('fragmentationIncrease' in x?x.fragmentationIncrease:'—');
  const cols=kind==='bottlenecks'?[{key:'node',label:'گره'},{key:'score',label:'Bottleneck'},{key:'risky',label:'Risky'}] : kind==='connectors'?[{key:'node',label:'گره'},{key:'score',label:'Connector'},{key:'version',label:'Version'}]:[{key:'node',label:'گره'},{key:'score',label:'امتیاز'}];
  const mapped=rows.map(x=>{
    if(kind==='connectors')return{node:nodeName(x),score:Number(x.connectorScore).toFixed(2),version:x.scoreVersion??'—'};
    if(kind==='bottlenecks')return{node:nodeName(x),score:Number(x.bottleneckScore).toFixed(2),risky:x.riskyConnections??'—'};
    return{node:nodeName(x),score:String(metric(x))};
  });
  return <DataTable columns={cols} rows={mapped}/>;
}

export default function Page(){
 const [connectors,setConnectors]=useState<any[]>([]); const [graph,setGraph]=useState<Graph|null>(null); const [q,setQ]=useState(''); const [type,setType]=useState('all'); const [status,setStatus]=useState(''); const [focus,setFocus]=useState(''); const [mode,setMode]=useState<'shortest'|'best'>('shortest'); const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [path,setPath]=useState<any>(null); const [analysis,setAnalysis]=useState<any>(null); const [analysisKind,setAnalysisKind]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const params=new URLSearchParams();if(q)params.set('q',q);if(type!=='all')params.set('type',type);if(status)params.set('status',status);if(focus)params.set('focus',focus);setGraph(await apiGet(`/network/graph?${params.toString()}`));}catch(e:any){setError(e?.message||'Unable to load network');}finally{setLoading(false)}};
 const runPath=async()=>{if(!from||!to)return;setError('');try{setPath(await apiGet(`/network/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`));}catch(e:any){setError(e?.message||'Unable to calculate path')}};
 const loadConnectors=async()=>{setError('');setAnalysisKind('connectors');try{setAnalysis(await apiGet('/network/connectors'))}catch(e:any){setError(e?.message||'Unable to load connectors')}};
 const runAnalysis=async(endpoint:string)=>{setError('');setAnalysisKind(endpoint);try{setAnalysis(await apiGet(`/network/${endpoint}`))}catch(e:any){setError(e?.message||'Unable to load analysis')}};
 useEffect(()=>{load()},[]);
 const positions=useMemo(()=>{if(!graph)return new Map<string,{x:number;y:number}>();const m=new Map<string,{x:number;y:number}>();graph.nodes.forEach((n,i)=>{const a=(i/Math.max(1,graph.nodes.length))*Math.PI*2;m.set(n.id,{x:300+220*Math.cos(a),y:220+160*Math.sin(a)})});return m},[graph]);
 const orgNodes=graph?graph.nodes.filter(n=>n.type==='organization'):[];
 return <main className="shell"><header className="topbar"><strong>SRIP</strong><a href="/">Dashboard</a></header><section className="hero"><p className="eyebrow">SRIP Workspace</p><h1>Network Intelligence</h1><p>Authorization-aware graph, filters, paths and network-risk analysis.</p></section>{loading?<Loading/>:<><ErrorCard message={error}/><section className="card"><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input aria-label="Search network" placeholder="Search organizations, people, projects" value={q} onChange={e=>setQ(e.target.value)}/><select aria-label="Node type" value={type} onChange={e=>setType(e.target.value)}><option value="all">All</option><option value="organization">Organizations</option><option value="person">People</option><option value="project">Projects</option></select><select aria-label="Relationship status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select><select aria-label="Focus node" value={focus} onChange={e=>setFocus(e.target.value)}><option value="">No focus</option>{graph?.nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select><button onClick={load}>Apply</button></div>
 {graph&&<>
  <p><strong>{graph.meta.organizationCount}</strong> organizations · <strong>{graph.meta.peopleCount}</strong> people · <strong>{graph.meta.projectCount}</strong> projects · <strong>{graph.meta.relationshipCount}</strong> relationships</p>
  <div className="card"><h2>Graph</h2><svg viewBox="0 0 600 440" width="100%" role="img" aria-label="Network graph" style={{minHeight:320}}>{graph.edges.slice(0,120).map((e,i)=>{const a=positions.get(e.source),b=positions.get(e.target);return a&&b?<line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={Math.max(1,Math.min(6,e.weight/20))}/>:null})}{graph.nodes.slice(0,120).map(n=>{const p=positions.get(n.id)!;return <g key={n.id}><circle cx={p.x} cy={p.y} r="18"/><text x={p.x} y={p.y+32} textAnchor="middle" fontSize="9">{n.label.slice(0,22)}</text></g>})}</svg></div>
  <div className="card"><h2>Connection path (organization nodes)</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><select value={from} onChange={e=>setFrom(e.target.value)}><option value="">From</option>{orgNodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select><select value={to} onChange={e=>setTo(e.target.value)}><option value="">To</option>{orgNodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select><select value={mode} onChange={e=>setMode(e.target.value as any)}><option value="shortest">Shortest</option><option value="best">Best</option></select><button onClick={runPath}>Find path</button></div>{path&&<p>{path.found?`${path.hops} hops · cost ${path.totalCost ?? '—'}`:'No visible path found'}</p>}</div>
  <div className="card"><h2>Network analysis</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>runAnalysis('centrality')}>Centrality</button><button onClick={loadConnectors}>Connectors</button><button onClick={()=>runAnalysis('bridges')}>Bridge people</button><button onClick={()=>runAnalysis('bottlenecks')}>Bottlenecks</button><button onClick={()=>runAnalysis('single-points-of-failure')}>Single points of failure</button></div>{analysis&&<div className="table-wrap" style={{marginTop:12}}>{renderAnalysis(analysisKind||'centrality',Array.isArray(analysis)?analysis:(analysis?.items??[]))}</div>}</div>
  <div className="card"><h2>Visible nodes</h2>{graph.nodes.slice(0,120).map(n=><div key={n.id} style={{display:'flex',justifyContent:'space-between',padding:6,borderTop:'1px solid var(--srip-border)'}}><span>{n.label}</span><small>{n.type}</small></div>)}</div>
 </>}</section></>}</main>;
}
