'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from '../_lib/api';
import {fa} from '../_lib/fa';
import {DataTable,Empty,ErrorCard,Loading,Modal,PageHeader} from './page-ui';
import {RefreshCw, Plus, Pencil, Trash2, X, Play} from 'lucide-react';
export type Field={name:string;label:string;type?:'text'|'number'|'date'|'datetime-local'|'email'|'textarea'|'select'|'checkbox';required?:boolean;options?:string[]};
export type Action={label:string;method:'POST'|'PATCH'|'DELETE';path:(id:string)=>string;confirm?:string;tone?:'primary'|'secondary'|'danger'};
export type ResourceConfig={title:string;eyebrow:string;description:string;endpoint:string;idField?:string;fields?:Field[];columns?:string[];labels?:Record<string,string>;create?:boolean;update?:boolean;remove?:boolean;actions?:Action[];query?:Record<string,string|number|boolean|undefined>;uppercase?:string[]};
const rowsOf=(x:any)=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.rows)?x.rows:Array.isArray(x?.data)?x.data:x?[x]:[];
const ENUM_COLS=new Set(['status','state','priority','type','kind','relationshipType','classification','scanStatus','uploadStatus','sensitivity','category','severity','effect','role','source','purpose']);
const text=(k:string,v:any)=>v==null?'—':typeof v==='object'?(v.name??v.title??v.label??v.id??JSON.stringify(v)):(ENUM_COLS.has(k)?fa(v):String(v));
export function ResourceConsole({config}:{config:ResourceConfig}){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState<any|null>(null),[form,setForm]=useState<Record<string,any>>({}),[open,setOpen]=useState(false);
 const qs=useMemo(()=>{const q=config.query??{};const s=Object.entries(q).filter(([,v])=>v!==undefined).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');return s?`?${s}`:''},[config.query]);
 const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(rowsOf(await api(config.endpoint+qs)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[config.endpoint,qs]);
 useEffect(()=>{load()},[load]);
 const columns=config.columns??(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[]);
 const id=(r:any)=>String(r[config.idField??'id']??'');
 function begin(r?:any){setEditing(r??{});const f:any={};(config.fields??[]).forEach(x=>f[x.name]=r?.[x.name]??'');setForm(f);setError('');setOpen(true)}
 function change(k:string,v:any){setForm(x=>({...x,[k]:(config.uppercase??[]).includes(k)?String(v).toUpperCase():v}))}
 async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');try{if(editing?.[config.idField??'id']&&config.update)await api(`${config.endpoint}/${encodeURIComponent(id(editing))}`,{method:'PATCH',body:JSON.stringify(form)});else await api(config.endpoint,{method:'POST',body:JSON.stringify(form)});setEditing(null);setForm({});setOpen(false);await load()}catch(x){setError((x as Error).message)}finally{setSaving(false)}}
 function closeEdit(){setEditing(null);setForm({});setOpen(false)}
 async function remove(r:any){if(!config.remove||!id(r))return;if(!confirm('حذف این مورد انجام شود؟'))return;try{await api(`${config.endpoint}/${encodeURIComponent(id(r))}`,{method:'DELETE'});await load()}catch(x){setError((x as Error).message)}}
 async function run(a:Action,r:any){if(a.confirm&&!confirm(a.confirm))return;try{await api(a.path(id(r)),{method:a.method,body:a.method==='DELETE'?undefined:'{}'});await load()}catch(x){setError((x as Error).message)}}
 const toneCls=(a:Action)=>a.tone==='danger'?'btn-danger':a.tone==='secondary'?'btn-secondary':'btn-primary';
 return <main className="feature-page">
   <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={
     <div className="toolbar">
       {config.create&&<button className="btn btn-primary" onClick={()=>begin()}><Plus size={15}/> ایجاد</button>}
       <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> بازخوانی</button>
     </div>
   }/>
   <ErrorCard message={error}/>

   {loading?<Loading/>:(
    <section className="section-card">
      <div className="section-head">
        <div><h2>داده‌ها</h2><p>{rows.length} مورد</p></div>
        <span className="chip info">{rows.length} مورد</span>
      </div>
      {rows.length?(
        <DataTable columns={columns.map(k=>({key:k,label:config.labels?.[k]??k}))} rows={rows.map(r=>Object.fromEntries(columns.map(k=>[k,text(k,r[k])])))}/>
      ):<Empty>داده‌ای برای این Scope وجود ندارد.</Empty>}
      {(config.actions||config.update||config.remove)&&rows.length>0&&(
        <div className="crud-actions">
          {rows.map(r=>(
            <div key={id(r)} className="crud-row-actions">
              <span className="t-primary" style={{fontWeight:800}}>{text(columns[0]??'id',r[columns[0]??'id'])}</span>
              <div className="row-actions">
                {config.update&&<button className="btn btn-ghost btn-sm" onClick={()=>begin(r)}><Pencil size={13}/> ویرایش</button>}
                {config.remove&&<button className="btn btn-danger btn-sm" onClick={()=>remove(r)}><Trash2 size={13}/> حذف</button>}
                {config.actions?.map(a=><button key={a.label} className={`btn btn-sm ${toneCls(a)}`} onClick={()=>run(a,r)}><Play size={12}/> {a.label}</button>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
   )}

   <Modal open={open} title={editing?.[config.idField??'id']?'ویرایش':'ایجاد'} description="اطلاعات را وارد کنید؛ مجوز و محدوده در سرور اعمال می‌شود." onClose={closeEdit}
     footer={<>
       <button type="button" className="btn btn-secondary" onClick={closeEdit}><X size={14}/> انصراف</button>
       <button type="submit" form="rc-modal-form" className="btn btn-primary" disabled={saving}>{saving?'در حال ذخیره…':'ذخیره'}</button>
     </>}>
     <form id="rc-modal-form" className="entity-form" onSubmit={save}>
       {(config.fields??[]).map(f=>(
         <div className={`field ${f.type==='textarea'||f.type==='select'?'full':''}`} key={f.name}>
           <label className="field-label">{f.label}{f.required&&<span className="req"> *</span>}</label>
           {f.type==='textarea'
             ? <textarea value={form[f.name]??''} onChange={e=>change(f.name,e.target.value)} required={f.required}/>
             : f.type==='select'
               ? <select value={form[f.name]??''} onChange={e=>change(f.name,e.target.value)} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{fa(o)}</option>)}</select>
               : f.type==='checkbox'
                 ? <input type="checkbox" checked={!!form[f.name]} onChange={e=>change(f.name,e.target.checked)} style={{width:18,height:18,accentColor:'var(--srip-accent)'}}/>
                 : <input type={f.type??'text'} value={form[f.name]??''} onChange={e=>change(f.name,e.target.value)} required={f.required}/>}
         </div>
       ))}
     </form>
   </Modal>
 </main>;
}
