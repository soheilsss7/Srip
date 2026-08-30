'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { Badge, DataTable, Empty, ErrorCard, Loading, PageHeader } from './page-ui';
import { EntityPicker } from './entity-picker';
import { useWorkspace } from './workspace';

type Field={name:string;label:string;type?:'text'|'number'|'date'|'datetime-local'|'textarea'|'select';required?:boolean;options?:string[];placeholder?:string;entityEndpoint?:string};
export type CrudConfig={
 title:string; eyebrow:string; description:string; endpoint:string; permission?:string;
 fields:Field[]; columns:string[]; columnLabels?:Record<string,string>;
 idField?:string; createLabel?:string; updateLabel?:string; delete?:boolean;
 query?:string;
 detailPath?:string;
};

function unwrap(value:any):any[]{ if(Array.isArray(value)) return value; if(Array.isArray(value?.items)) return value.items; if(Array.isArray(value?.rows)) return value.rows; if(Array.isArray(value?.data)) return value.data; return value?[value]:[]; }
function display(v:any){ if(v===null||v===undefined) return '—'; if(typeof v==='object') return v.name??v.displayName??v.title??v.label??(([v.sourceOrganization?.name,v.targetOrganization?.name].filter(Boolean).join(' ↔ ')||v.type)||'—'); return String(v); }
function emptyForm(fields:Field[]){ return Object.fromEntries(fields.map(f=>[f.name,''])); }

export function CrudWorkspace({config}:{config:CrudConfig}){
 const {scopeId}=useWorkspace();
 const [rows,setRows]=useState<any[]>([]),[form,setForm]=useState<Record<string,string>>(()=>emptyForm(config.fields));
 const [editing,setEditing]=useState<any|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const idField=config.idField??'id';
 const load=async()=>{setLoading(true);setError('');try{const base=config.endpoint+(config.query??'');const scoped=scopeId==='all'?base:`${base}${base.includes('?')?'&':'?'}organizationId=${encodeURIComponent(scopeId)}`;setRows(unwrap(await api(scoped)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[config.endpoint,config.query,scopeId]);
 function beginEdit(row:any){setEditing(row);setForm(Object.fromEntries(config.fields.map(f=>[f.name,row[f.name]===undefined?'':String(row[f.name])])))}
 function reset(){setEditing(null);setForm(emptyForm(config.fields));}
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
   const payload:any={}; for(const f of config.fields){const v=form[f.name]; if(v!==undefined&&v!=='') payload[f.name]=f.type==='number'?Number(v):v;}
   const path=editing?`${config.endpoint}/${encodeURIComponent(editing[idField])}`:config.endpoint;
   await api(path,{method:editing?'PATCH':'POST',body:JSON.stringify(payload)}); reset(); await load();
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(row:any){if(!config.delete||!row[idField])return; if(!window.confirm('این مورد حذف شود؟'))return;setBusy(true);setError('');try{await api(`${config.endpoint}/${encodeURIComponent(row[idField])}`,{method:'DELETE'});if(editing?.[idField]===row[idField])reset();await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const tableRows=rows.map(r=>Object.fromEntries(config.columns.map(k=>{const relationKey=k.endsWith('Id')?k.slice(0,-2):'';return [k,display(relationKey&&r[relationKey]?r[relationKey]:r[k])] })));
 return <main className="feature-page">
   <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}/>
   <ErrorCard message={error}/>
   <div className="entity-layout">
    <section className="panel">
      <div className="panel-title"><div><h2>{editing?config.updateLabel??'ویرایش':'ثبت جدید'}</h2><p>Authorization، Scope و validation نهایی در Backend اعمال می‌شود.</p></div>{editing&&<button className="secondary-action" type="button" onClick={reset}>لغو ویرایش</button>}</div>
      <form className="entity-form" onSubmit={submit}>
       {config.fields.map(f=>f.entityEndpoint?<EntityPicker key={f.name} label={f.label} value={form[f.name]??''} onChange={value=>setForm({...form,[f.name]:value})} endpoint={f.entityEndpoint} required={f.required} disabled={busy} scopeId={scopeId} selectedLabel={editing?.[f.name.slice(-2)==='Id' ? f.name.slice(0, -2) : f.name]?.name ?? editing?.[f.name.slice(-2)==='Id' ? f.name.slice(0, -2) : f.name]?.displayName ?? editing?.[f.name.slice(-2)==='Id' ? f.name.slice(0, -2) : f.name]?.title}/>:<label key={f.name}>{f.label}{f.type==='textarea'?<textarea placeholder={f.placeholder} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>:f.type==='select'?<select value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input placeholder={f.placeholder} type={f.type??'text'} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}</label>)}
       <div className="toolbar"><button className="primary-action" disabled={busy}>{busy?'در حال ذخیره…':editing?'ذخیره تغییرات':config.createLabel??'ایجاد'}</button>{editing&&<button className="secondary-action" type="button" onClick={reset}>پاک کردن فرم</button>}</div>
      </form>
    </section>
    <section className="panel">
      <div className="panel-title"><div><h2>فهرست</h2><p>{rows.length} مورد در پاسخ فعلی</p></div><button className="secondary-action" onClick={load} disabled={loading}>بازخوانی</button></div>
      {loading?<Loading/>:rows.length===0?<Empty/>:<>
       <DataTable columns={config.columns.map(k=>({key:k,label:config.columnLabels?.[k]??k}))} rows={tableRows}/>
       <div className="crud-actions">{rows.map(r=><div key={String(r[idField])} className="crud-row-actions"><span>{display(r[config.columns[0]])}</span><div>{config.detailPath&&<Link className="secondary-action" href={config.detailPath.replace('{id}',encodeURIComponent(String(r[idField])))}>مشاهده</Link>}<button onClick={()=>beginEdit(r)}>ویرایش</button>{config.delete&&<button className="danger-action" onClick={()=>remove(r)} disabled={busy}>حذف</button>}</div></div>)}</div>
      </>}
    </section>
   </div>
 </main>;
}
