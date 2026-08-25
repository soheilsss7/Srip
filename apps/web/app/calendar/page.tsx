'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {DataTable,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
export default function Calendar(){
 const [rows,setRows]=useState<any[]>([]),[e,setE]=useState(''),[loading,setLoading]=useState(true),[upcoming,setUpcoming]=useState(true);
 const load=async()=>{setLoading(true);setE('');try{const x=await api<any>(`/meetings?upcoming=${upcoming}`);setRows(Array.isArray(x)?x:x?.items??x?.rows??[])}catch(x){setE((x as Error).message)}finally{setLoading(false)}};useEffect(()=>{load()},[upcoming]);
 return <main className="feature-page"><PageHeader eyebrow="CALENDAR / MEETINGS" title="تقویم جلسات" description="نمای عملیاتی جلسات با Participant، Organization، Relationship، Agenda و Outcome." actions={<button className="primary-action" onClick={()=>location.href='/meetings'}>+ جلسه جدید</button>}/><div className="toolbar"><button onClick={()=>setUpcoming(true)} className={upcoming?'primary-action':'secondary-action'}>پیش‌رو</button><button onClick={()=>setUpcoming(false)} className={!upcoming?'primary-action':'secondary-action'}>همه</button><button onClick={load} className="secondary-action">بازخوانی</button></div><ErrorCard message={e}/>{loading?<Loading/>:<section className="panel"><DataTable columns={['title','startAt','endAt','status','organization','relationship'].map(k=>({key:k,label:k}))} rows={rows.map(r=>({...r,organization:r.organization?.name??r.organization,relationship:r.relationship?.id??r.relationship}))}/></section>}</main>
}
