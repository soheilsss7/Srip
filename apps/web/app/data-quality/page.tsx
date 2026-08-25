'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,DataTable} from '../_components/page-ui';
export default function DataQuality(){
 const[d,setD]=useState<any>(null),[e,setE]=useState('');
 useEffect(()=>{api('/data-quality/overview').then(setD).catch(x=>setE((x as Error).message))},[]);
 const items=d?.items??d?.rows??d?.issues??[];
 const rows=Array.isArray(items)?items:[];
 return <main className="feature-page"><PageHeader eyebrow="DATA QUALITY" title="کیفیت داده" description="Duplicate Records، Missing Owners، Missing Contacts، Stale Relationships، Invalid Emails، Missing Organizations، Missing Dates و Incomplete Profiles."/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<section className="panel"><DataTable columns={rows[0]?Object.keys(rows[0]).slice(0,8).map(k=>({key:k,label:k})):[]} rows={rows}/></section>}</main>
}
