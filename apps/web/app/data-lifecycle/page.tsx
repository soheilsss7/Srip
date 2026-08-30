'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';import {useWorkspace} from '../_components/workspace';

type Status = { totalLifecycleRecords?: number; byState?: Record<string, number>; byEntityType?: Record<string, number>; pendingDeletionApprovals?: number; entities?: string[]; states?: string[]; recent?: { records: Array<{ entityType?: string; entityId?: string; state?: string; reason?: string | null; transitionedAt?: string }> } };

export default function DataLifecycle(){
  const {can}=useWorkspace();
  const allowed=can('data.lifecycle_status');
  const [d,setD]=useState<Status|null>(null),[e,setE]=useState('');useEffect(()=>{if(allowed)return void api<Status>('/data-lifecycle/status').then(setD).catch(x=>setE(x.message))},[allowed]);
  const byState=d?.byState??{}, byEntity=d?.byEntityType??{}, recent=d?.recent?.records??[];
  const stateTone: Record<string,'success'|'info'|'warning'|'danger'>={ PURGED:'danger', PERMANENT:'danger', ARCHIVED:'warning', DELETED:'warning', ACTIVE:'success', PENDING:'info' };
  if(!allowed)return <main className="feature-page"><PageHeader eyebrow="DATA GOVERNANCE" title="Data Lifecycle" description="وضعیت چرخه عمر داده."/><section className="panel"><Empty>مجوز مشاهده وضعیت چرخه عمر برای شما فعال نیست.</Empty></section></main>;
  return <main className="feature-page"><PageHeader eyebrow="DATA GOVERNANCE" title="Data Lifecycle" description="Retention و lifecycle داده: سوابق lifecycle، توزیع state/entity، و تأییدیه‌های حذف دائمی در انتظار." actions={<Badge tone={d?.pendingDeletionApprovals? 'warning':'success'}>{d?.pendingDeletionApprovals||0} حذف دائمی در انتظار تأیید</Badge>}/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<>
    <section className="kpi-grid"><div className="kpi-card"><span>کل سوابق Lifecycle</span><strong>{d?.totalLifecycleRecords??0}</strong></div><div className="kpi-card"><span>State ها</span><strong>{d?.states?.length??0}</strong></div><div className="kpi-card"><span>Entity Types</span><strong>{d?.entities?.length??0}</strong></div></section>
    <section className="grid2"><div className="panel"><h2>توزیع بر اساس State</h2>{Object.keys(byState).length?<div className="metric-list">{Object.entries(byState).map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>:<Empty>بدون داده</Empty>}</div>
      <div className="panel"><h2>توزیع بر اساس Entity Type</h2>{Object.keys(byEntity).length?<div className="metric-list">{Object.entries(byEntity).map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>:<Empty>بدون داده</Empty>}</div></section>
    <section className="panel"><h2>سوابق اخیر</h2>{recent.length?<div className="table-wrap"><DataTable columns={[{key:'entityType',label:'نوع'},{key:'entityId',label:'شناسه'},{key:'state',label:'State'},{key:'reason',label:'دلیل'},{key:'at',label:'زمان'}]} rows={recent.map(r=>({entityType:r.entityType??'—',entityId:r.entityId?'رکورد مرتبط':'—',state:<Badge tone={stateTone[r.state??'']??'info'}>{r.state??'—'}</Badge>,reason:r.reason??'—',at:r.transitionedAt?new Date(r.transitionedAt).toLocaleString('fa-IR'):'—'}))}/></div>:<Empty>سابقه lifecycle ای ثبت نشده است.</Empty>}</section>
  </>}</main>;
}
