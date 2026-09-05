'use client';
import React from 'react';
import { DataTable, Empty, ErrorCard, Loading, Modal, PageHeader } from './page-ui';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { RefreshCw, Plus, Search, X } from 'lucide-react';

export type OperationalConfig = {
  eyebrow: string; title: string; description: string; endpoint: string;
  columns?: string[]; labels?: Record<string,string>;
  searchParam?: string; create?: { fields: Array<{name:string;label:string;type?:'text'|'date'|'number'|'textarea'|'select';required?:boolean;options?:string[]}> };
  permission?: string;
};
function rowsOf(x:any):any[]{ if(Array.isArray(x)) return x; if(Array.isArray(x?.items)) return x.items; if(Array.isArray(x?.rows)) return x.rows; if(Array.isArray(x?.data)) return x.data; return x?[x]:[]; }
const ENUM_COLS=new Set(['status','state','priority','type','kind','relationshipType','classification','scanStatus','uploadStatus','sensitivity','category','severity','effect','role','source','purpose']);
function display(k:string,v:any){ if(v==null)return '—'; if(typeof v==='object')return v.name??v.title??v.label??v.id??JSON.stringify(v); return String(v); }
export function OperationalTable({config}:{config:OperationalConfig}){
  const [rows,setRows]=React.useState<any[]>([]),[query,setQuery]=React.useState(''),[form,setForm]=React.useState<Record<string,string>>({}),[loading,setLoading]=React.useState(true),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[open,setOpen]=React.useState(false);
  const load=React.useCallback(async()=>{setLoading(true);setError('');try{const suffix=query&&config.searchParam?`?${config.searchParam}=${encodeURIComponent(query)}`:'';setRows(rowsOf(await api(config.endpoint+suffix)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[config.endpoint,config.searchParam,query]);
  React.useEffect(()=>{load()},[load]);
  const cols=config.columns??(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[]);
  async function create(e:React.FormEvent){e.preventDefault();if(!config.create)return;setSaving(true);setError('');try{const payload:any={};for(const f of config.create.fields){if(form[f.name]!==undefined&&form[f.name]!=='')payload[f.name]=f.type==='number'?Number(form[f.name]):form[f.name]}await api(config.endpoint,{method:'POST',body:JSON.stringify(payload)});setForm({});setOpen(false);await load()}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
  return <main className="feature-page">
    <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={
      <div className="toolbar">
        {config.create&&<button className="btn btn-primary" onClick={()=>{setError('');setForm({});setOpen(true)}}><Plus size={15}/> ایجاد</button>}
        <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> بازخوانی</button>
      </div>
    }/>
    <ErrorCard message={error}/>
    <section className="section-card">
      <div className="section-head">
        <div><h2>داده‌ها</h2><p>داده فقط از API مجاز سرور خوانده می‌شود.</p></div>
        {config.searchParam&&(
          <div className="toolbar-search">
            <Search size={15}/>
            <input aria-label="جستجو" placeholder="جستجو…" value={query} onChange={e=>setQuery(e.target.value)} style={{minHeight:36,fontSize:12.5}}/>
          </div>
        )}
      </div>
      {loading?<Loading/>:rows.length?<DataTable columns={cols.map(k=>({key:k,label:config.labels?.[k]??k}))} rows={rows.map(r=>Object.fromEntries(cols.map(k=>[k,display(k,r[k])])))}/>:<Empty>داده‌ای برای این Scope وجود ندارد.</Empty>}
    </section>
   <Modal open={open} title="ایجاد" description="اطلاعات جدید را وارد کنید؛ اعتبارسنجی نهایی در سرور انجام می‌شود." onClose={()=>setOpen(false)}
     footer={<>
       <button className="btn btn-secondary" type="button" onClick={()=>setOpen(false)}><X size={14}/> انصراف</button>
       <button className="btn btn-primary" type="submit" form="op-modal-form" disabled={saving}>{saving?'در حال ذخیره…':'ذخیره'}</button>
     </>}>
     <form id="op-modal-form" className="entity-form" onSubmit={create}>
       {config.create?.fields.map(f=>(
         <div className={`field ${f.type==='textarea'||f.type==='select'?'full':''}`} key={f.name}>
           <label className="field-label">{f.label}{f.required&&<span className="req"> *</span>}</label>
           {f.type==='textarea'
             ? <textarea value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>
             : f.type==='select'
               ? <select value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{fa(o)}</option>)}</select>
               : <input type={f.type??'text'} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}
         </div>
       ))}
     </form>
   </Modal>
  </main>;
}
