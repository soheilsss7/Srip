'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { Badge, DataTable, Empty, ErrorCard, Loading, PageHeader } from './page-ui';

type Field={name:string;label:string;type?:'text'|'number'|'date'|'textarea'|'select';required?:boolean;options?:string[]};
export type EntityConfig={title:string;eyebrow:string;description:string;endpoint:string;permission?:string;fields:Field[];columns?:string[];columnLabels?:Record<string,string>;createLabel?:string;extra?:()=>React.ReactNode};

function unwrap(value:any):any[]{if(Array.isArray(value))return value;if(Array.isArray(value?.items))return value.items;if(Array.isArray(value?.rows))return value.rows;if(Array.isArray(value?.data))return value.data;return value? [value]:[]}
function pretty(v:any){if(v===null||v===undefined)return '—'; if(typeof v==='object') return v.name??v.title??v.label??JSON.stringify(v); return String(v)}
export function EntityWorkspace({config}:{config:EntityConfig}){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState<Record<string,string>>({});
 const load=async()=>{setLoading(true);setError('');try{setRows(unwrap(await api(config.endpoint)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[config.endpoint]);
 const columns=useMemo(()=>config.columns??(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,7):[]),[rows,config.columns]);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError('');try{const payload:any={};for(const f of config.fields){if(form[f.name]!==undefined&&form[f.name]!=='')payload[f.name]=f.type==='number'?Number(form[f.name]):form[f.name]}await api(config.endpoint,{method:'POST',body:JSON.stringify(payload)});setForm({});await load()}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
 return <main className="feature-page"><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}/><ErrorCard message={error}/><div className="entity-layout"><section className="panel"><h2>{config.createLabel??`ثبت ${config.title}`}</h2><form className="entity-form" onSubmit={submit}>{config.fields.map(f=><label key={f.name}>{f.label}{f.type==='textarea'?<textarea value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>:f.type==='select'?<select value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input type={f.type??'text'} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}</label>)}<button className="primary-action" disabled={saving}>{saving?'در حال ثبت…':'ثبت'}</button></form></section><section className="panel"><div className="panel-title"><div><h2>داده‌های فعلی</h2><p>Permission و Scope در Backend enforce می‌شوند.</p></div><button className="secondary-action" onClick={load}>بازخوانی</button></div>{loading?<Loading/>:rows.length===0?<Empty/>:<DataTable columns={columns.map(k=>({key:k,label:config.columnLabels?.[k]??k}))} rows={rows.map(r=>Object.fromEntries(columns.map(k=>[k,pretty(r[k])])))} />}</section></div></main>
}
