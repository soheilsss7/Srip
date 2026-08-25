'use client';
import {useEffect,useState} from 'react';
import {api,apiBlob} from '../_lib/api';
import {DataTable,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
const kinds=['relationship','organization','contact','meeting','commitment','action','opportunity','network','risk','influence','referral','project','subsidiary-comparison','holding-overview'];
export default function Reports(){
 const[kind,setKind]=useState('relationship'),[data,setData]=useState<any>(null),[e,setE]=useState(''),[loading,setLoading]=useState(false),[exporting,setExporting]=useState('');
 async function load(k=kind){setLoading(true);setE('');try{setData(await api(`/reports/${encodeURIComponent(k)}`))}catch(x){setE((x as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function download(format:string){
  setExporting(format);setE('');
  try{const blob=await apiBlob(`/reports/${encodeURIComponent(kind)}/export/${encodeURIComponent(format)}`);
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${kind}.${format==='xlsx'?'xlsx':format}`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(x){setE((x as Error).message)}finally{setExporting('')}
 }
 const rows=Array.isArray(data)?data:data?.rows??data?.items??data?.data??[];
 return <main className="feature-page"><PageHeader eyebrow="REPORTING" title="گزارش‌ها" description="گزارش‌های Relationship، Organization، Contact، Meeting، Commitment، Action، Opportunity، Network، Risk، Influence، Referral، Project و Executive." actions={<div className="toolbar">{['csv','pdf','xlsx'].map(f=><button className="secondary-action" key={f} disabled={!!exporting} onClick={()=>download(f)}>{exporting===f?'در حال خروجی…':`Export ${f.toUpperCase()}`}</button>)}</div>}/><section className="panel"><label>نوع گزارش<select value={kind} onChange={e=>{setKind(e.target.value);load(e.target.value)}}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label></section><ErrorCard message={e}/>{loading?<Loading/>:<section className="panel"><DataTable columns={rows[0]?Object.keys(rows[0]).slice(0,10).map(k=>({key:k,label:k})):[]} rows={rows}/></section>}</main>
}
