'use client';
import {useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {ErrorCard,Loading,PageHeader,DataTable} from '../../_components/page-ui';
export default function DataQuality(){
  const[d,setD]=useState<any>(null),[e,setE]=useState(''),[busy,setBusy]=useState(false);
  const m=d?.metrics??d??{};
  const load=()=>{setE('');api('/data/quality').then(setD).catch(x=>setE((x as Error).message))};
  useEffect(()=>{load()},[]);
  async function scan(){setBusy(true);setE('');try{await api('/data/quality/scan',{method:'POST',body:'{}'});load()}catch(x){setE((x as Error).message)}finally{setBusy(false)}}
  const rows=[
   ...(Array.isArray(m.missingOwners?.values)?m.missingOwners.values.map((id:any)=>({kind:'Missing Owner',target:id})):[]),
   ...(Array.isArray(m.staleRelationships?.values)?m.staleRelationships.values.map((r:any)=>({kind:'Stale Relationship',target:r.id})):[]),
   ...(Array.isArray(m.invalidEmails?.values)?m.invalidEmails.values.map((v:any)=>({kind:'Invalid Email',entity:v.entityType,target:v.id})):[]),
   ...(Array.isArray(m.missingDates?.meetings?.values)?m.missingDates.meetings.values.map((id:any)=>({kind:'Missing Meeting Date',target:id})):[]),
   ...(Array.isArray(m.missingDates?.actions?.values)?m.missingDates.actions.values.map((id:any)=>({kind:'Missing Action Date',target:id})):[]),
   ...(Array.isArray(m.missingDates?.relationships?.values)?m.missingDates.relationships.values.map((id:any)=>({kind:'Missing Review Date',target:id})):[]),
  ];
  return <main className="feature-page"><PageHeader eyebrow="DATA MANAGEMENT" title="کیفیت داده" description="Duplicate Records، Missing Owners، Stale Relationships، Invalid Emails و Missing Dates. با Quality Scan مجدداً محاسبه کنید." actions={<button className="primary-action" disabled={busy} onClick={scan}>{busy?'در حال اسکن…':'Quality Scan'}</button>}/><ErrorCard message={e}/>{!d&&!e?<Loading/>:d&&<section className="panel">{rows.length===0?<p className="muted">هیچ مورد کیفیتی یافت نشد.</p>:<DataTable columns={['kind','entity','target'].map(k=>({key:k,label:k}))} rows={rows}/>}</section>}</main>;
}
