'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,DataTable} from '../_components/page-ui';
export default function DataQuality(){
  const[d,setD]=useState<any>(null),[e,setE]=useState('');
  useEffect(()=>{api('/data/quality').then(setD).catch(x=>setE((x as Error).message))},[]);
  const m=d?.metrics??d??{};
  const rows=[
   ...(Array.isArray(m.missingOwners?.values)?m.missingOwners.values.map((id:any)=>({kind:'Missing Owner',target:id})):[]),
   ...(Array.isArray(m.staleRelationships?.values)?m.staleRelationships.values.map((r:any)=>({kind:'Stale Relationship',target:r.id})):[]),
   ...(Array.isArray(m.invalidEmails?.values)?m.invalidEmails.values.map((v:any)=>({kind:'Invalid Email',entity:v.entityType,target:v.id})):[]),
   ...(Array.isArray(m.missingDates?.meetings?.values)?m.missingDates.meetings.values.map((id:any)=>({kind:'Missing Meeting Date',target:id})):[]),
   ...(Array.isArray(m.missingDates?.actions?.values)?m.missingDates.actions.values.map((id:any)=>({kind:'Missing Action Date',target:id})):[]),
   ...(Array.isArray(m.missingDates?.relationships?.values)?m.missingDates.relationships.values.map((id:any)=>({kind:'Missing Review Date',target:id})):[]),
  ];
  return <main className="feature-page"><PageHeader eyebrow="DATA QUALITY" title="کیفیت داده" description="Duplicate Records، Missing Owners، Missing Contacts، Stale Relationships، Invalid Emails، Missing Organizations، Missing Dates و Incomplete Profiles."/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<section className="panel">{rows.length===0?<p className="muted">هیچ مورد کیفیتی یافت نشد.</p>:<DataTable columns={['kind','entity','target'].map(k=>({key:k,label:k}))} rows={rows}/>}</section>}</main>
}
