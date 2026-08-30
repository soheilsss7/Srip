'use client';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { DataTable, Empty, ErrorCard, Loading, PageHeader, Badge } from './page-ui';
import { useWorkspace } from './workspace';
export function OpsWorkspace({title,eyebrow,description,endpoint,permission,writePermission,actions=[]}:{title:string;eyebrow:string;description:string;endpoint:string;permission?:string;writePermission?:string;actions?:{label:string;path:string;method?:'GET'|'POST'|'PATCH';body?:any}[]}){
 const {can}=useWorkspace();
 const readable=!permission||can(permission);
 const writable=!writePermission||can(writePermission);
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const load=async()=>{if(!readable){setData(null);setLoading(false);return}setLoading(true);setError('');try{setData(await api(endpoint))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};useEffect(()=>{void load()},[endpoint,readable]);
 const rows=Array.isArray(data)?data:(data?.items??data?.rows??data?.data??[]);const cols=rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[];
 if(!readable)return <main className="feature-page"><PageHeader eyebrow={eyebrow} title={title} description={description}/><section className="panel"><Empty>مجوز مشاهده این بخش برای شما فعال نیست.</Empty></section></main>;
 async function act(a:any){if(a.method!=='GET'&&!writable)return;setBusy(a.label);setError('');try{if(a.method==='GET'){await api(a.path)}else{await api(a.path,{method:a.method??'POST',body:a.body?JSON.stringify(a.body):undefined})}await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 return <main className="feature-page"><PageHeader eyebrow={eyebrow} title={title} description={description} actions={<div className="toolbar"><button onClick={load}>بازخوانی</button>{actions.filter(a=>a.method==='GET'||writable).map(a=><button key={a.label} onClick={()=>act(a)} disabled={!!busy}>{busy===a.label?'در حال اجرا…':a.label}</button>)}</div>}/><ErrorCard message={error}/>{loading?<Loading/>:rows.length?<DataTable columns={cols.map(k=>({key:k,label:k}))} rows={rows}/>:<section className="panel"><Empty>داده‌ای برای این Scope در دسترس نیست.</Empty></section>}</main>
}
