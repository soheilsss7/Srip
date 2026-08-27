'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
type Check={key?:string;status?:string;detail?:string};
const tone: Record<string, 'success'|'warning'|'danger'|'info'>={ PASS:'success', WARN:'warning', FAIL:'danger' };
export default function Governance(){
  const[d,setD]=useState<any>(null),[e,setE]=useState('');
  useEffect(()=>{api('/security/governance/preflight').then(setD).catch(x=>setE((x as Error).message))},[]);
  const checks:Check[]=Array.isArray(d?.checks)?d.checks:[];
  const overall=d?.overall;
  return <main className="feature-page"><PageHeader eyebrow="GOVERNANCE" title="Data Governance" description="Policy، export، security event و کنترل‌های Enterprise با Permission واقعی." actions={overall?<Badge tone={tone[overall]??'info'}>{overall}</Badge>:undefined}/><ErrorCard message={e}/>{!d&&!e?<Loading/>:d&&<section className="panel"><div className="panel-title"><h2>Preflight Checks</h2><span className="muted">{d.generatedAt?new Date(d.generatedAt).toLocaleString('fa-IR'):''}</span></div>{checks.length?<DataTable columns={[{key:'key',label:'Check'},{key:'status',label:'وضعیت'},{key:'detail',label:'جزئیات'}]} rows={checks.map(c=>({key:c.key??'—',status:<Badge tone={tone[c.status??'']??'info'}>{c.status??'—'}</Badge>,detail:c.detail??'—'}))}/>:<Empty>چکی برای نمایش وجود ندارد.</Empty>}</section>}</main>;
}
