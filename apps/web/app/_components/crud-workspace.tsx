'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../_lib/api';
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

type ListResult = { rows: any[]; total?: number; page?: number; pageSize?: number; totalPages?: number };
function parseList(value:any):ListResult {
  if (Array.isArray(value)) return { rows: value, total: value.length, page: 1, pageSize: value.length || 1, totalPages: 1 };
  const rows = Array.isArray(value?.items) ? value.items : Array.isArray(value?.rows) ? value.rows : Array.isArray(value?.data) ? value.data : value ? [value] : [];
  return { rows, total: Number.isFinite(value?.total) ? value.total : rows.length, page: Number(value?.page) || 1, pageSize: Number(value?.pageSize) || rows.length || 1, totalPages: Number(value?.totalPages) || 1 };
}
function display(v:any, key?:string){
  if(v===null||v===undefined||v==='') return '—';
  if(typeof v==='object') {
    if(Array.isArray(v)) return v.length ? `${v.length} مورد` : '—';
    return v.name??v.displayName??v.title??v.label??(([v.sourceOrganization?.name,v.targetOrganization?.name].filter(Boolean).join(' ↔ ')||v.type)||'جزئیات موجود');
  }
  // Foreign-key values are useful for transport but are not a user-facing label.
  if(key?.endsWith('Id')) return 'موجودیت انتخاب‌شده';
  return String(v);
}
function emptyForm(fields:Field[]){ return Object.fromEntries(fields.map(f=>[f.name,''])); }
function writePermission(permission?:string){ return permission?.endsWith('.read') ? `${permission.slice(0,-5)}.write` : permission; }
function errorText(value: unknown) {
  if (value instanceof ApiError && value.requestId) return `${value.message} (کد پیگیری: ${value.requestId.slice(0,8)})`;
  return value instanceof Error ? value.message : 'عملیات انجام نشد.';
}

export function CrudWorkspace({config}:{config:CrudConfig}){
 const {scopeId,can}=useWorkspace();
 const readable=!config.permission||can(config.permission);
 const writable=readable&&(!config.permission||can(writePermission(config.permission) ?? ''));
 const [rows,setRows]=useState<any[]>([]),[form,setForm]=useState<Record<string,string>>(()=>emptyForm(config.fields));
 const [editing,setEditing]=useState<any|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [page,setPage]=useState(1),[total,setTotal]=useState(0),[totalPages,setTotalPages]=useState(1);
 const idField=config.idField??'id';
 const load=useCallback(async(targetPage=page)=>{setLoading(true);setError('');try{const base=config.endpoint+(config.query??'');const separator=base.includes('?')?'&':'?';const scope=scopeId==='all'?'':`&organizationId=${encodeURIComponent(scopeId)}`;const response=await api(`${base}${separator}page=${targetPage}&pageSize=50${scope}`);const parsed=parseList(response);setRows(parsed.rows);setTotal(parsed.total??parsed.rows.length);setTotalPages(Math.max(1,parsed.totalPages??1));setPage(parsed.page??targetPage);setNotice('');}catch(e){setError(errorText(e))}finally{setLoading(false)}},[config.endpoint,config.query,scopeId,page]);
 useEffect(()=>{void load(1)},[config.endpoint,config.query,scopeId]);
 function beginEdit(row:any){if(!writable)return;setEditing(row);setNotice('');setForm(Object.fromEntries(config.fields.map(f=>[f.name,row[f.name]===undefined?'':String(row[f.name])])))}
 function reset(){setEditing(null);setForm(emptyForm(config.fields));}
 async function submit(e:FormEvent){e.preventDefault();if(!writable)return;setBusy(true);setError('');setNotice('');try{
   const payload:any={}; for(const f of config.fields){const v=form[f.name]?.trim?.() ?? form[f.name]; if(f.required&&!v) throw new Error(`فیلد «${f.label}» الزامی است.`); if(v!==undefined&&v!=='') payload[f.name]=f.type==='number'?Number(v):v;}
   const path=editing?`${config.endpoint}/${encodeURIComponent(editing[idField])}`:config.endpoint;
   await api(path,{method:editing?'PATCH':'POST',body:JSON.stringify(payload)}); reset(); setNotice(editing?'تغییرات با موفقیت ذخیره شد.':'رکورد با موفقیت ایجاد شد.'); await load(page);
 }catch(e){setError(errorText(e))}finally{setBusy(false)}}
 async function remove(row:any){if(!writable||!config.delete||!row[idField])return; if(!window.confirm('این مورد حذف یا بایگانی شود؟'))return;setBusy(true);setError('');setNotice('');try{await api(`${config.endpoint}/${encodeURIComponent(row[idField])}`,{method:'DELETE'});if(editing?.[idField]===row[idField])reset();setNotice('رکورد حذف یا بایگانی شد.');await load(page)}catch(e){setError(errorText(e))}finally{setBusy(false)}}
 const tableRows=rows.map(r=>Object.fromEntries(config.columns.map(k=>{const relationKey=k.endsWith('Id')?k.slice(0,-2):'';return [k,display(relationKey&&r[relationKey]?r[relationKey]:r[k],k)] })));
 if(!readable) return <main className="feature-page"><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}/><section className="panel"><Empty>مجوز مشاهده این بخش برای شما فعال نیست.</Empty></section></main>;
 return <main className="feature-page">
   <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}/>
   {notice&&<div className="notice" role="status">{notice}</div>}<ErrorCard message={error}/>
   <div className="entity-layout">
    {writable&&<section className="panel">
      <div className="panel-title"><div><h2>{editing?config.updateLabel??'ویرایش':'ثبت جدید'}</h2><p>Scope، مجوز و validation نهایی در Backend اعمال می‌شود.</p></div>{editing&&<button className="secondary-action" type="button" onClick={reset}>لغو ویرایش</button>}</div>
      <form className="entity-form" onSubmit={submit}>
       {config.fields.map(f=>f.entityEndpoint?<EntityPicker key={f.name} label={f.label} value={form[f.name]??''} onChange={value=>setForm({...form,[f.name]:value})} endpoint={f.entityEndpoint} required={f.required} disabled={busy} scopeId={scopeId} selectedLabel={editing?.[f.name.slice(-2)==='Id' ? f.name.slice(0, -2) : f.name]?.name ?? editing?.[f.name.slice(-2)==='Id' ? f.name.slice(0, -2) : f.name]?.displayName ?? editing?.[f.name.slice(-2)==='Id' ? f.name.slice(0, -2) : f.name]?.title}/>:<label key={f.name}>{f.label}{f.type==='textarea'?<textarea placeholder={f.placeholder} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>:f.type==='select'?<select value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input placeholder={f.placeholder} type={f.type??'text'} value={form[f.name]??''} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required}/>}</label>)}
       <div className="toolbar"><button className="primary-action" disabled={busy}>{busy?'در حال ذخیره…':editing?'ذخیره تغییرات':config.createLabel??'ایجاد'}</button>{editing&&<button className="secondary-action" type="button" onClick={reset}>پاک کردن فرم</button>}</div>
      </form>
    </section>}
    <section className="panel">
      <div className="panel-title"><div><h2>فهرست</h2><p>{total} مورد در این محدوده</p></div><button className="secondary-action" onClick={()=>void load(page)} disabled={loading}>بازخوانی</button></div>
      {loading?<Loading/>:rows.length===0?<Empty>موردی برای این محدوده پیدا نشد.</Empty>:<>
       <DataTable columns={config.columns.map(k=>({key:k,label:config.columnLabels?.[k]??k}))} rows={tableRows}/>
       <div className="crud-actions">{rows.map(r=><div key={String(r[idField])} className="crud-row-actions"><span>{display(r[config.columns[0]],config.columns[0])}</span><div>{config.detailPath&&<Link className="secondary-action" href={config.detailPath.replace('{id}',encodeURIComponent(String(r[idField])))}>مشاهده</Link>}{writable&&<button onClick={()=>beginEdit(r)}>ویرایش</button>}{writable&&config.delete&&<button className="danger-action" onClick={()=>remove(r)} disabled={busy}>حذف</button>}</div></div>)}</div>
       {totalPages>1&&<div className="pagination" aria-label="صفحه‌بندی"><button className="secondary-action" disabled={loading||page<=1} onClick={()=>void load(page-1)}>قبلی</button><span>صفحه {page} از {totalPages}</span><button className="secondary-action" disabled={loading||page>=totalPages} onClick={()=>void load(page+1)}>بعدی</button></div>}
      </>}
    </section>
   </div>
 </main>;
}
