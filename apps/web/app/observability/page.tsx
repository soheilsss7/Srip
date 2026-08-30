'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';import{useWorkspace}from'../_components/workspace';

type Hist = Record<string, { count?: number; sum?: number; buckets?: Record<string, number> }>;
type Snapshot = { requests?: number; errors?: number; averageLatencyMs?: number; uptimeSeconds?: number; activeUsers?: number; availabilityPercent?: number; process?: { rssBytes?: number; heapUsedBytes?: number; heapTotalBytes?: number; cpuPercent?: number }; apiLatency?: Hist; dbLatency?: Hist; queue?: Record<string, number>; storage?: Record<string, number>; ai?: Record<string, number> };
function Mb(n?: number){return n===undefined?'—':(n/1048576).toFixed(1)+' MB';}

export default function Observability(){
  const{can}=useWorkspace();
  const allowed=can('metrics.read');
  const [d,setD]=useState<Snapshot|null>(null),[q,setQ]=useState<Record<string,number>|null>(null),[e,setE]=useState('');
  useEffect(()=>{if(!allowed)return;Promise.all([api<Snapshot>('/observability/summary'),api('/observability/queue').catch(()=>null)]).then(([s,sqn]:any)=>{setD(s);if(sqn)setQ(Array.isArray(sqn)?Object.fromEntries(sqn.map((x:any)=>[x?.key??x?.name,x?.count??x?.pending??0])):sqn)}).catch(x=>setE((x as Error).message))},[allowed]);
  const histRows=(h?:Hist)=>Object.entries(h??{}).map(([k,v])=>({key:k,count:v?.count??0,avg:Math.max(0,Number(((v?.sum??0)/(v?.count||1)).toFixed(2)))+'ms'}));
  const kvRows=(o?:Record<string,number>)=>Object.entries(o??{}).map(([k,v])=>({key:k,value:String(v)}));
  const uptime=(s?:number)=>{if(s===undefined)return '—';const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600);return `${d}d ${h}h`;};
  const p=d?.process??{};
  const health = (d?.availabilityPercent??100)>=99 ? 'success' : ((d?.availabilityPercent??100)>=95?'warning':'danger');
  if(!allowed)return <main className="feature-page"><PageHeader eyebrow="RUNTIME" title="Observability" description="سلامت لحظه‌ای سرویس."/><section className="panel"><Empty>مجوز مشاهده Observability برای شما فعال نیست.</Empty></section></main>;
  return <main className="feature-page"><PageHeader eyebrow="RUNTIME" title="Observability" description="API latency، DB latency، Queue و Runtime telemetry — snapshot لحظه‌ای سلامت سرویس." actions={<Badge tone={health as 'success'|'warning'|'danger'}>Availability {d?.availabilityPercent??100}%</Badge>}/><ErrorCard message={e}/>{!d?<Loading/>:<>
    <section className="kpi-grid">
      <div className="kpi-card"><span>درخواست‌ها</span><strong>{d?.requests??0}</strong></div>
      <div className="kpi-card"><span>خطاها</span><strong>{d?.errors??0}</strong></div>
      <div className="kpi-card"><span>Avg Latency</span><strong>{d?.averageLatencyMs??0}ms</strong></div>
      <div className="kpi-card"><span>Uptime</span><strong>{uptime(d?.uptimeSeconds)}</strong></div>
      <div className="kpi-card"><span>کاربران فعال</span><strong>{d?.activeUsers??0}</strong></div>
      <div className="kpi-card"><span>CPU</span><strong>{p.cpuPercent??0}%</strong></div>
      <div className="kpi-card"><span>Heap Used</span><strong>{Mb(p.heapUsedBytes)}</strong></div>
      <div className="kpi-card"><span>RSS</span><strong>{Mb(p.rssBytes)}</strong></div>
    </section>
    <section className="grid2">
      <div className="panel"><h2>API Latency</h2>{Object.keys(d?.apiLatency??{}).length?<DataTable columns={[{key:'key',label:'مسیر'},{key:'count',label:'تعداد'},{key:'avg',label:'میانگین'}]} rows={histRows(d?.apiLatency)}/>:<Empty>بدون داده</Empty>}</div>
      <div className="panel"><h2>DB Latency</h2>{Object.keys(d?.dbLatency??{}).length?<DataTable columns={[{key:'key',label:'عملیات'},{key:'count',label:'تعداد'},{key:'avg',label:'میانگین'}]} rows={histRows(d?.dbLatency)}/>:<Empty>بدون داده</Empty>}</div>
    </section>
    <section className="grid2">
      <div className="panel"><h2>Queue Snapshot</h2>{q&&Object.keys(q).length?<DataTable columns={[{key:'key',label:'صف'},{key:'value',label:'وضعیت'}]} rows={kvRows(q)}/>:<Empty>بدون داده صف</Empty>}</div>
      <div className="panel"><h2>AI Usage</h2>{Object.keys(d?.ai??{}).length?<DataTable columns={[{key:'key',label:'نوع'},{key:'value',label:'مقدار'}]} rows={kvRows(d?.ai)}/>:<Empty>بدون داده</Empty>}</div>
    </section>
  </>}</main>;
}
