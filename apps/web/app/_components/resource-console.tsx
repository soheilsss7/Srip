'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from '../_lib/api';
import {DataTable,Empty,ErrorCard,Loading,PageHeader} from './page-ui';
import {useWorkspace} from './workspace';
export type Field={name:string;label:string;type?:'text'|'number'|'date'|'datetime-local'|'email'|'textarea'|'select'|'checkbox';required?:boolean;options?:string[]};
export type Action={label:string;method:'POST'|'PATCH'|'DELETE';path:(id:string)=>string;confirm?:string};
export type ResourceConfig={title:string;eyebrow:string;description:string;endpoint:string;permission?:string;writePermission?:string;idField?:string;fields?:Field[];columns?:string[];labels?:Record<string,string>;create?:boolean;update?:boolean;remove?:boolean;actions?:Action[];query?:Record<string,string|number|boolean|undefined>;uppercase?:string[]};
const rowsOf=(x:any)=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.rows)?x.rows:Array.isArray(x?.data)?x.data:x?[x]:[];
const text=(v:any)=>v==null?'—':typeof v==='object'?(v.name??v.title??v.label??v.id??JSON.stringify(v)):String(v);
const writePermission=(permission?:string)=>permission?.endsWith('.read')?`${permission.slice(0,-5)}.write`:permission;
export function ResourceConsole({config}:{config:ResourceConfig}){
 const {can}=useWorkspace();
 const readable=!config.permission||can(config.permission);
 const mutating=Boolean(config.create||config.update||config.remove||config.actions?.length);
 const requiredWritePermission=config.writePermission??writePermission(config.permission);
 const writable=readable&&(!mutating||!requiredWritePermission||can(requiredWritePermission));
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState<any|null>(null),[form,setForm]=useState<Record<string,any>>({});
 const qs=useMemo(()=>{const q=config.query??{};const s=Object.entries(q).filter(([,v])=>v!==undefined).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');return s?`?${s}`:''},[config.query]);
  const load=useCallback(async()=>{if(!readable){setRows([]);setLoading(false);return}setLoading(true);setError('');try{setRows(rowsOf(await api(config.endpoint+qs)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[config.endpoint,qs,readable]);
 useEffect(()=>{load()},[load]);
 const columns=config.columns??(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')).slice(0,8):[]);
 const id=(r:any)=>String(r[config.idField??'id']??'');
 if(!readable)return <main className="feature-page"><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}/><section className="panel"><Empty>مجوز مشاهده این بخش برای شما فعال نیست.</Empty></section></main>;
 function begin(r?:any){setEditing(r??{});const f:any={};(config.fields??[]).forEach(x=>f[x.name]=r?.[x.name]??'');setForm(f)}
  function change(k:string,v:any){setForm(x=>({...x,[k]:(config.uppercase??[]).includes(k)?String(v).toUpperCase():v}))}
 async function save(e:React.FormEvent){e.preventDefault();if(!writable)return;setSaving(true);setError('');try{if(editing?.[config.idField??'id']&&config.update)await api(`${config.endpoint}/${encodeURIComponent(id(editing))}`,{method:'PATCH',body:JSON.stringify(form)});else await api(config.endpoint,{method:'POST',body:JSON.stringify(form)});setEditing(null);setForm({});await load()}catch(x){setError((x as Error).message)}finally{setSaving(false)}}
 async function remove(r:any){if(!writable||!config.remove||!id(r))return;if(!confirm('حذف این مورد انجام شود؟'))return;try{await api(`${config.endpoint}/${encodeURIComponent(id(r))}`,{method:'DELETE'});await load()}catch(x){setError((x as Error).message)}}
 async function run(a:Action,r:any){if(!writable)return;if(a.confirm&&!confirm(a.confirm))return;try{await api(a.path(id(r)),{method:a.method,body:a.method==='DELETE'?undefined:'{}'});await load()}catch(x){setError((x as Error).message)}}
 return <main className="feature-page"><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<div className="toolbar">{config.create&&writable&&<button className="primary-action" onClick={()=>begin()}>+ ایجاد</button>}<button className="secondary-action" onClick={load}>بازخوانی</button></div>}/><ErrorCard message={error}/>{editing&&<section className="panel"><div className="panel-title"><h2>{editing?.[config.idField??'id']?'ویرایش':'ایجاد'}</h2><button onClick={()=>setEditing(null)}>انصراف</button></div><form className="entity-form" onSubmit={save}>{(config.fields??[]).map(f=><label key={f.name}>{f.label}{f.type==='textarea'?<textarea value={form[f.name]??''} onChange={e=>change(f.name,e.target.value)} required={f.required}/>:f.type==='select'?<select value={form[f.name]??''} onChange={e=>change(f.name,e.target.value)} required={f.required}><option value="">انتخاب کنید</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:f.type==='checkbox'?<input type="checkbox" checked={!!form[f.name]} onChange={e=>change(f.name,e.target.checked)}/>:<input type={f.type??'text'} value={form[f.name]??''} onChange={e=>change(f.name,e.target.value)} required={f.required}/>}</label>)}<button className="primary-action" disabled={saving}>{saving?'در حال ذخیره…':'ذخیره'}</button></form></section>}{loading?<Loading/>:<section className="panel">{rows.length?<DataTable columns={columns.map(k=>({key:k,label:config.labels?.[k]??k}))} rows={rows.map(r=>Object.fromEntries(columns.map(k=>[k,text(r[k])])))}/>:<Empty/>}<div className="resource-actions">{rows.map((r,i)=><div className="resource-row-actions" key={id(r)||i}>{config.update&&writable&&<button onClick={()=>begin(r)}>ویرایش</button>}{config.remove&&writable&&id(r)&&<button onClick={()=>remove(r)}>حذف</button>}{config.actions?.map(a=>writable&&<button key={a.label} onClick={()=>run(a,r)}>{a.label}</button>)}</div>)}</div></section>}</main>
}
