'use client';
import React from 'react';
import { DataTable, Empty, ErrorCard, Loading, PageHeader } from './page-ui';
import { api } from '../_lib/api';

export type OperationalConfig = {
  eyebrow: string; title: string; description: string; endpoint: string;
  columns?: string[]; labels?: Record<string,string>;
  searchParam?: string; create?: { fields: Array<{name:string;label:string;type?:'text'|'date'|'number'|'textarea'|'select';required?:boolean;options?:string[]}> };
  permission?: string;
};
function rowsOf(x:any):any[]{ if(Array.isArray(x)) return x; if(Array.isArray(x?.items)) return x.items; if(Array.isArray(x?.rows)) return x.rows; if(Array.isArray(x?.data)) return x.data; return x?[x]:[]; }
function display(v:any){ if(v==null)return '—'; if(typeof v==='object')return v.name??v.title??v.label??v.id??JSON.stringify(v); return String(v); }
export function OperationalTable({config}:{config:OperationalConfig}){
  const [rows,setRows]=React.useState<any[]>([]),[query,setQuery]=React.useState(''),[form,setForm]=React.useState<Record<string,string>>({}),[loading,setLoading]=React.useState(true),[saving,setSaving]=React.useState(false),[error,setError]=React.useState('');
  const load=React.useCallback(async()=>{setLoading(true);setError('');try{const suffix=query&&config.searchParam?`?${config.searchParam}=${encodeURIComponent(query)}`:'';setRows(rowsOf(await api(config.endpoint+suffix)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[config.endpoint,config.searchParam,query]);
  React.useEffect(()=>{load()},[load]);
  const cols=config.columns??(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[]);
  async function create(e:React.FormEvent){e.preventDefault();if(!config.create)return;setSaving(true);setError('');try{const payload:any={};for(const f of config.create.fields){if(form[f.name]!==undefined&&form[f.name]!=='')payload[f.name]=f.type==='number'?Number(form[f.name]):form[f.name]}await api(config.endpoint,{method:'POST',body:JSON.stringify(payload)});setForm({});await load()}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
  return <main className="feature-page"><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<button className="secondary-action" onClick={load}>بازخوانی</button>}/><ErrorCard message={error}/><div className={config.create?'entity-layout':''}>
    {config.create&&<section className="panel"><h2>ایجاد</h2><form className="entity-form" onSubmit={create}>{config.create.fields.map(f=><label key={f.name}>{f.label}{f.type==='textarea'?<textarea value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>:f.type==='select'?<select value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input type={f.type??'text'} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}</label>)}<button className="primary-action" disabled={saving}>{saving?'در حال ذخیره…':'ذخیره'}</button></form></section>}
    <section className="panel"><div className="panel-title"><div><h2>داده‌ها</h2><p>داده فقط از API مجاز Backend خوانده می‌شود.</p></div><input aria-label="جستجو" placeholder="جستجو…" value={query} onChange={e=>setQuery(e.target.value)}/></div>{loading?<Loading/>:rows.length?<DataTable columns={cols.map(k=>({key:k,label:config.labels?.[k]??k}))} rows={rows.map(r=>Object.fromEntries(cols.map(k=>[k,display(r[k])])))}/>:<Empty>داده‌ای برای این Scope وجود ندارد.</Empty>}</section>
  </div></main>
}
