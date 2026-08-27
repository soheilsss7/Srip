'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';

type Hist = Record<string, { count?: number; sum?: number; buckets?: Record<string, number> }>;
type Snapshot = { requests?: number; errors?: number; averageLatencyMs?: number; uptimeSeconds?: number; activeUsers?: number; availabilityPercent?: number; process?: { rssBytes?: number; heapUsedBytes?: number; heapTotalBytes?: number; cpuPercent?: number }; apiLatency?: Hist; dbLatency?: Hist; queue?: Record<string, number>; storage?: Record<string, number>; ai?: Record<string, number> };

function Mb(n?: number){return n===undefined?'—':(n/1048576).toFixed(1)+' MB';}

export default function Metrics(){
  const [d,setD]=useState<Snapshot|null>(null),[e,setE]=useState('');
  useEffect(()=>{api<Snapshot>('/metrics/summary').then(setD).catch(x=>setE(x.message))},[]);
  const histRows=(h?:Hist)=>Object.entries(h??{}).map(([k,v])=>({key:k,count:v?.count??0,sum:(v?.sum??0).toFixed(2)+'ms',avg:Math.max(0,Number(((v?.sum??0)/(v?.count||1)).toFixed(2)))+'ms'}));
  const kvRows=(o?:Record<string,number>)=>Object.entries(o??{}).map(([k,v])=>({key:k,value:String(v)}));
  const uptime=(s?:number)=>{if(s===undefined)return '—';const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);return `${d}d ${h}h ${m}m`;};
  return <main className="feature-page"><PageHeader eyebrow="PLATFORM METRICS" title="Metrics" description="شاخص‌های عملیاتی Backend: حجم درخواست‌ها، خطاها، latencyها، uptime و telemetry پردازش."/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<>
    <section className="kpi-grid">
      <div className="kpi-card"><span>درخواست‌ها</span><strong>{d?.requests??0}</strong></div>
      <div className="kpi-card"><span>خطاها</span><strong>{d?.errors??0}</strong></div>
      <div className="kpi-card"><span>Avg Latency</span><strong>{d?.averageLatencyMs??0}ms</strong></div>
      <div className="kpi-card"><span>Uptime</span><strong>{uptime(d?.uptimeSeconds)}</strong></div>
      <div className="kpi-card"><span>کاربران فعال (۳۰d)</span><strong>{d?.activeUsers??0}</strong></div>
      <div className="kpi-card"><span>Availability</span><strong>{d?.availabilityPercent??100}%</strong></div>
      <div className="kpi-card"><span>CPU</span><strong>{d?.process?.cpuPercent??0}%</strong></div>
      <div className="kpi-card"><span>RSS</span><strong>{Mb(d?.process?.rssBytes)}</strong></div>
    </section>
    <section className="grid2">
      <div className="panel"><h2>API Latency</h2>{Object.keys(d?.apiLatency??{}).length?<DataTable columns={[{key:'key',label:'مسیر'},{key:'count',label:'تعداد'},{key:'sum',label:'کل'},{key:'avg',label:'میانگین'}]} rows={histRows(d?.apiLatency)}/>:<Empty>بدون داده</Empty>}</div>
      <div className="panel"><h2>DB Latency</h2>{Object.keys(d?.dbLatency??{}).length?<DataTable columns={[{key:'key',label:'عملیات'},{key:'count',label:'تعداد'},{key:'sum',label:'کل'},{key:'avg',label:'میانگین'}]} rows={histRows(d?.dbLatency)}/>:<Empty>بدون داده</Empty>}</div>
    </section>
    <section className="grid2">
      <div className="panel"><h2>Queue</h2>{Object.keys(d?.queue??{}).length?<DataTable columns={[{key:'key',label:'صف'},{key:'value',label:'مقدار'}]} rows={kvRows(d?.queue)}/>:<Empty>بدون داده</Empty>}</div>
      <div className="panel"><h2>Storage</h2>{Object.keys(d?.storage??{}).length?<DataTable columns={[{key:'key',label:'منبع'},{key:'value',label:'مقدار'}]} rows={kvRows(d?.storage)}/>:<Empty>بدون داده</Empty>}</div>
    </section>
  </>}</main>;
}
