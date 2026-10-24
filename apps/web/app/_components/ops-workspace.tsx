'use client';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { fa, labelKey } from '../_lib/fa';
import { DataTable, Empty, ErrorCard, Loading, PageHeader, Badge } from './page-ui';
export function OpsWorkspace({title,eyebrow,description,endpoint,actions=[]}:{title:string;eyebrow:string;description:string;endpoint:string;actions?:{label:string;path:string;method?:'GET'|'POST'|'PATCH';body?:any}[]}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const load=async()=>{setLoading(true);setError('');try{setData(await api(endpoint))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};useEffect(()=>{load()},[endpoint]);
 const rows=Array.isArray(data)?data:(data?.items??data?.rows??data?.data??[]);const ENUM_COLS=new Set(['status','state','type','kind','priority','severity','effect','role','source','purpose','classification','scanStatus','uploadStatus','sensitivity','category','eventType','channels','active','enabled','isActive','approvalStatus','risk','probability','impact']);
const cols=rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[];
 async function act(a:any){setBusy(a.label);setError('');try{if(a.method==='GET'){await api(a.path)}else{await api(a.path,{method:a.method??'POST',body:a.body?JSON.stringify(a.body):undefined})}await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 return <main className="feature-page"><PageHeader eyebrow={eyebrow} title={title} description={description} actions={<div className="toolbar"><button onClick={load}>بازخوانی</button>{actions.map(a=><button key={a.label} onClick={()=>act(a)} disabled={!!busy}>{busy===a.label?'در حال اجرا…':a.label}</button>)}</div>}/><ErrorCard message={error}/>{loading?<Loading/>:rows.length?<DataTable columns={cols.map(k=>({key:k,label:labelKey(k)}))} rows={rows.map((r:any)=>Object.fromEntries(cols.map(k=>[k, r[k]==null?'—':typeof r[k]==='object'?JSON.stringify(r[k]):(ENUM_COLS.has(k)?fa(r[k]):String(r[k]))])))}/>:<section className="panel"><Empty>داده‌ای برای این Scope در دسترس نیست.</Empty></section>}</main>
}
