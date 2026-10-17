'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { Badge, DataTable, Empty, ErrorCard, Loading, Modal, PageHeader } from './page-ui';
import { RefreshCw, Plus, Pencil, Trash2, X, Eye } from 'lucide-react';

type Field={name:string;label:string;type?:'text'|'number'|'date'|'datetime-local'|'textarea'|'select';required?:boolean;options?:string[];placeholder?:string};
export type CrudConfig={
 title:string; eyebrow:string; description:string; endpoint:string; permission?:string;
 fields:Field[]; columns:string[]; columnLabels?:Record<string,string>;
 idField?:string; createLabel?:string; updateLabel?:string; delete?:boolean;
 query?:string;
 detailPath?:string;
};

function unwrap(value:any):any[]{ if(Array.isArray(value)) return value; if(Array.isArray(value?.items)) return value.items; if(Array.isArray(value?.rows)) return value.rows; if(Array.isArray(value?.data)) return value.data; return value?[value]:[]; }
const ENUM_COLS=new Set(['status','state','priority','type','kind','relationshipType','classification','scanStatus','uploadStatus','sensitivity','category','severity','effect','role','source','purpose']);
function display(k:string,v:any){ if(v===null||v===undefined) return '—'; if(typeof v==='object') return v.name??v.title??v.label??v.id??'—'; return ENUM_COLS.has(k)?fa(v):String(v); }
function emptyForm(fields:Field[]){ return Object.fromEntries(fields.map(f=>[f.name,''])); }

export function CrudWorkspace({config}:{config:CrudConfig}){
 const [rows,setRows]=useState<any[]>([]),[form,setForm]=useState<Record<string,string>>(()=>emptyForm(config.fields));
 const [editing,setEditing]=useState<any|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const idField=config.idField??'id';
 const load=async()=>{setLoading(true);setError('');try{setRows(unwrap(await api(config.endpoint+(config.query??''))))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[config.endpoint,config.query]);
 function openCreate(){setEditing(null);setForm(emptyForm(config.fields));setError('');setOpen(true)}
 function beginEdit(row:any){setEditing(row);setForm(Object.fromEntries(config.fields.map(f=>[f.name,row[f.name]===undefined?'':String(row[f.name])])));setError('');setOpen(true)}
 function close(){setOpen(false);setEditing(null);}
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
   const payload:any={}; for(const f of config.fields){const v=form[f.name]; if(v!==undefined&&v!=='') payload[f.name]=f.type==='number'?Number(v):v;}
   const path=editing?`${config.endpoint}/${encodeURIComponent(editing[idField])}`:config.endpoint;
   await api(path,{method:editing?'PATCH':'POST',body:JSON.stringify(payload)}); close(); await load();
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(row:any){if(!config.delete||!row[idField])return; if(!window.confirm('این مورد حذف شود؟'))return;setBusy(true);setError('');try{await api(`${config.endpoint}/${encodeURIComponent(row[idField])}`,{method:'DELETE'});if(editing?.[idField]===row[idField])close();await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const tableRows=rows.map(r=>Object.fromEntries(config.columns.map(k=>[k,display(k,r[k])])));
 const firstCol=config.columns[0]??'id';
 const title=editing?config.updateLabel??'ویرایش':config.createLabel??'ایجاد جدید';
 return <main className="feature-page">
   <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={
     <div className="toolbar">
       <button className="btn btn-primary" onClick={openCreate}><Plus size={15}/> {config.createLabel??'ایجاد جدید'}</button>
       <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> بازخوانی</button>
     </div>
   }/>
   <ErrorCard message={error}/>
   <div className="entity-layout">
    <section className="section-card">
      <div className="section-head">
        <div><h2>فهرست</h2><p>{rows.length} مورد در پاسخ فعلی</p></div>
        <span className="chip info">{rows.length} مورد</span>
      </div>
      {loading?<Loading/>:rows.length===0?<Empty/>:<>
       <DataTable columns={config.columns.map(k=>({key:k,label:config.columnLabels?.[k]??k}))} rows={tableRows}/>
       <div className="crud-actions">
        {rows.map(r=>(
         <div key={String(r[idField])} className="crud-row-actions">
          <span className="t-primary" style={{fontWeight:800}}>{display(firstCol,r[firstCol])}</span>
          <div className="row-actions">
           {config.detailPath&&<Link className="btn btn-secondary btn-sm" href={config.detailPath.replace('{id}',encodeURIComponent(String(r[idField])))}><Eye size={13}/> مشاهده</Link>}
           <button className="btn btn-ghost btn-sm" onClick={()=>beginEdit(r)}><Pencil size={13}/> ویرایش</button>
           {config.delete&&<button className="btn btn-danger btn-sm" onClick={()=>remove(r)} disabled={busy}><Trash2 size={13}/> حذف</button>}
          </div>
         </div>
        ))}
       </div>
      </>}
    </section>
   </div>

   <Modal open={open} title={title} description={editing?'مقادیر موردنظر را اصلاح و ذخیره کنید.':'اطلاعات جدید را وارد کنید؛ مجوز و محدوده در سرور اعمال می‌شود.'} onClose={close}
     footer={<>
       <button className="btn btn-secondary" type="button" onClick={close}><X size={14}/> انصراف</button>
       <button className="btn btn-primary" type="submit" form="crud-modal-form" disabled={busy}>{busy?'در حال ذخیره…':editing?'ذخیره تغییرات':config.createLabel??'ایجاد'}</button>
     </>}>
     <form id="crud-modal-form" className="entity-form" onSubmit={submit}>
      {config.fields.map(f=>(
       <div className={`field ${f.type==='textarea'||f.type==='select'?'full':''}`} key={f.name}>
         <label className="field-label" htmlFor={`crud-${f.name}`}>{f.label}{f.required&&<span className="req"> *</span>}</label>
         {f.type==='textarea'
           ? <textarea id={`crud-${f.name}`} placeholder={f.placeholder} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>
           : f.type==='select'
             ? <select id={`crud-${f.name}`} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{fa(o)}</option>)}</select>
             : <input id={`crud-${f.name}`} placeholder={f.placeholder} type={f.type??'text'} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}
       </div>
      ))}
     </form>
   </Modal>
 </main>;
}
