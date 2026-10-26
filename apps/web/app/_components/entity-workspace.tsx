'use client';
import {FormEvent,useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,Modal,PageHeader} from './page-ui';
import {RefreshCw, Plus, X} from 'lucide-react';
type Field={name:string;label:string;type?:'text'|'number'|'date'|'datetime-local'|'textarea'|'select';required?:boolean;options?:string[];placeholder?:string};
export type EntityConfig={
 title:string;eyebrow:string;description:string;endpoint:string;permission?:string;
 fields:Field[];columns?:string[];columnLabels?:Record<string,string>;
 query?:string;createLabel?:string;
};
const unwrap=(x:any)=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.rows)?x.rows:Array.isArray(x?.data)?x.data:x?[x]:[];
const pretty=(v:any)=>v==null?'—':typeof v==='object'?(v.name??v.title??v.label??v.id??JSON.stringify(v)):String(v);
export function EntityWorkspace({config}:{config:EntityConfig}){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[form,setForm]=useState<Record<string,string>>({}),[open,setOpen]=useState(false);
 const load=async()=>{setLoading(true);setError('');try{setRows(unwrap(await api(config.endpoint+(config.query??''))))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[config.endpoint,config.query]);
 const columns=config.columns?.length?config.columns:(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[]);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError('');try{const payload:any={};config.fields.forEach(f=>{const v=form[f.name];if(v!==undefined&&v!=='')payload[f.name]=f.type==='number'?Number(v):v});await api(config.endpoint,{method:'POST',body:JSON.stringify(payload)});setForm({});setOpen(false);await load()}catch(x){setError((x as Error).message)}finally{setSaving(false)}}
 const createLabel=config.createLabel??`ثبت ${config.title}`;
 return <main className="feature-page">
   <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={
     <div className="toolbar">
       <button className="btn btn-primary" onClick={()=>{setError('');setForm({});setOpen(true)}}><Plus size={15}/> {createLabel}</button>
       <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> بازخوانی</button>
     </div>
   }/>
   <ErrorCard message={error}/>
   <div className="entity-layout">
    <section className="section-card">
      <div className="section-head">
        <div><h2>داده‌های فعلی</h2><p>مجوز و محدوده در سرور اعمال می‌شوند.</p></div>
        <span className="chip info">{rows.length} مورد</span>
      </div>
      {loading?<Loading/>:rows.length===0?<Empty/>:<DataTable columns={columns.map(k=>({key:k,label:config.columnLabels?.[k]??k}))} rows={rows.map(r=>Object.fromEntries(columns.map(k=>[k,pretty(r[k])])))} />}
    </section>
   </div>

   <Modal open={open} title={createLabel} description="اطلاعات را وارد کنید؛ اعتبارسنجی نهایی در سرور انجام می‌شود." onClose={()=>setOpen(false)}
     footer={<>
       <button className="btn btn-secondary" type="button" onClick={()=>setOpen(false)}><X size={14}/> انصراف</button>
       <button className="btn btn-primary" type="submit" form="entity-modal-form" disabled={saving}>{saving?'در حال ثبت…':createLabel}</button>
     </>}>
     <form id="entity-modal-form" className="entity-form" onSubmit={submit}>
       {config.fields.map(f=>(
         <div className={`field ${f.type==='textarea'||f.type==='select'?'full':''}`} key={f.name}>
           <label className="field-label">{f.label}{f.required&&<span className="req"> *</span>}</label>
           {f.type==='textarea'
             ? <textarea placeholder={f.placeholder} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>
             : f.type==='select'
               ? <select value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>
               : <input type={f.type??'text'} placeholder={f.placeholder} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}
         </div>
       ))}
     </form>
   </Modal>
 </main>;
}
