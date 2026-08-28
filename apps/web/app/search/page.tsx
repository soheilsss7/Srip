'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../_components/page-ui';

const RESULT_TYPES=['organization','person','relationship','meeting','interaction','project','opportunity','document','note'];
const DETAIL_URL:Record<string,(id:string)=>string>={
  organization:id=>`/organizations/${id}`,
  person:id=>`/people/${id}`,
  relationship:id=>`/relationships/${id}`,
  meeting:id=>`/meetings/${id}`,
  interaction:id=>`/interactions/${id}`,
  project:id=>`/projects/${id}`,
  opportunity:id=>`/opportunities/${id}`,
  document:id=>`/documents/${id}`,
  note:()=>'',
};
type Result={type:string;id:string;title:string;subtitle?:string;score:number;organizationId?:string|null};
type Saved={id:string;name:string;query:string;filters?:any;enabled:boolean;lastUsedAt?:string|null;createdAt:string;updatedAt:string};

export default function Search(){
  const [q,setQ]=useState(''),[typeFilter,setTypeFilter]=useState(''),[data,setData]=useState<any>(null),[error,setError]=useState('');
  const [saved,setSaved]=useState<Saved[]>([]),[savedLoading,setSavedLoading]=useState(true),[busy,setBusy]=useState('');
  const [saveName,setSaveName]=useState(''),[editId,setEditId]=useState(''),[editName,setEditName]=useState(''),[editQuery,setEditQuery]=useState('');

  const loadSaved=useCallback(async()=>{try{const r:any=await api('/search/saved');setSaved(Array.isArray(r)?r:r?.items??[]);}catch(e){setError(e instanceof Error?e.message:'خطا در دریافت جستجوهای ذخیره‌شده');}finally{setSavedLoading(false)}},[setSaved,setSavedLoading,setError]);
  useEffect(()=>{loadSaved()},[loadSaved]);

  async function run(){if(q.trim().length<2){setError('حداقل دو نویسه برای جستجو وارد کنید.');return}try{setError('');const params=new URLSearchParams({q});if(typeFilter)params.set('type',typeFilter);setData(await api('/search?'+params.toString()))}catch(e){setError(e instanceof Error?e.message:String(e))}}
  useEffect(()=>{if(q.trim().length<2)return;const t=setTimeout(()=>run(),350);return()=>clearTimeout(t)},[q,typeFilter]);

  async function saveIt(){if(!saveName.trim()||q.trim().length<2){setError('برای ذخیره، نام و عبارت جستجو (حداقل ۲ نویسه) لازم است.');return}setBusy('save');try{await api('/search/saved',{method:'POST',body:JSON.stringify({name:saveName.trim(),query:q,enabled:true,filters:typeFilter?{type:typeFilter}:{}})});setSaveName('');setError('');await loadSaved();}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}}
  async function runSaved(id:string){setBusy('run'+id);try{setError('');const r:any=await api(`/search/saved/${id}/run`,{method:'POST'});setQ(r?.q??'');setData(r);await loadSaved();}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}}
  async function toggleSaved(s:Saved){setBusy('toggle'+s.id);try{await api(`/search/saved/${s.id}`,{method:'PATCH',body:JSON.stringify({enabled:!s.enabled})});await loadSaved();}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}}
  async function saveEdit(s:Saved){if(!editName.trim()){setError('نام جستجو نمی‌تواند خالی باشد.');return}setBusy('edit'+s.id);try{await api(`/search/saved/${s.id}`,{method:'PATCH',body:JSON.stringify({name:editName.trim(),query:editQuery})});setEditId('');setError('');await loadSaved();}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}}
  async function deleteSaved(s:Saved){if(!window.confirm(`حذف جستجوی ذخیره‌شده «${s.name}»؟`))return;setBusy('del'+s.id);try{await api(`/search/saved/${s.id}`,{method:'DELETE'});await loadSaved();}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}}
  const startEdit=(s:Saved)=>{setEditId(s.id);setEditName(s.name);setEditQuery(s.query);};

  return <main className="feature-page"><PageHeader eyebrow="GLOBAL SEARCH" title="Search" description="جستجوی authorization-aware روی موجودیت‌های اصلی و مدیریت جستجوهای ذخیره‌شده."/>
    <ErrorCard message={error}/>
    <section className="panel">
      <div className="toolbar">
        <input aria-label="Search" value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو در سازمان‌ها، افراد، جلسات، پروژه‌ها…"/>
        <select aria-label="نوع موجودیت" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">همه انواع</option>{RESULT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        <button className="primary-action" onClick={run} disabled={busy==='save'}>جستجو</button>
      </div>
      <div className="entity-form">
        <label>ذخیره جستجوی فعلی<input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="نام جستجوی ذخیره‌شده"/></label>
        <button className="secondary-action" onClick={saveIt} disabled={!!busy}>{busy==='save'?'در حال ذخیره…':'ذخیره جستجو'}</button>
      </div>
    </section>
    {data&&<section className="panel">
      <div className="panel-title"><h2>نتایج</h2><span className="muted">({data.total??0} نتیجه)</span></div>
      <div className="list">{data.results?.length?data.results.map((r:Result)=>{const href=DETAIL_URL[r.type]?.(r.id);return <article className="listRow" key={r.type+r.id}>{href?<div><strong><a href={href}>{r.title}</a></strong><small>{r.type} · {r.subtitle||''}</small></div>:<div><strong>{r.title}</strong><small>{r.type} · {r.subtitle||''}</small></div>}<Badge tone={r.score>=70?'success':r.score>=40?'warning':'neutral'}>{Math.round(r.score)}%</Badge></article>}):<div className="empty-state">نتیجه‌ای یافت نشد.</div>}</div>
    </section>}
    <section className="panel">
      <div className="panel-title"><h2>جستجوهای ذخیره‌شده</h2><span className="muted">({saved.length})</span></div>
      {savedLoading?<Loading label="در حال بارگذاری جستجوهای ذخیره‌شده…"/>:saved.length===0?<div className="empty-state">هنوز جستجویی ذخیره نکرده‌اید.</div>:
      <div className="list">{saved.map(s=><article className="panel compact" key={s.id}>
        <div className="panel-title"><div><strong>{s.name}</strong><small className="muted">{s.query||'(بدون عبارت)'}</small></div><Badge tone={s.enabled?'success':'neutral'}>{s.enabled?'فعال':'غیرفعال'}</Badge></div>
        {editId===s.id?<div className="entity-form">
          <label>نام<input value={editName} onChange={e=>setEditName(e.target.value)} aria-label="نام جستجو"/></label>
          <label>عبارت جستجو<input value={editQuery} onChange={e=>setEditQuery(e.target.value)} aria-label="عبارت جستجو"/></label>
          <div className="toolbar"><button className="primary-action" onClick={()=>saveEdit(s)} disabled={!!busy}>ذخیره</button><button onClick={()=>setEditId('')} disabled={!!busy}>انصراف</button></div>
        </div>:<div className="toolbar">
          <button className="primary-action" onClick={()=>runSaved(s.id)} disabled={!!busy}>اجرا</button>
          <button onClick={()=>toggleSaved(s)} disabled={!!busy}>{s.enabled?'غیرفعال‌کردن':'فعال‌کردن'}</button>
          <button onClick={()=>startEdit(s)} disabled={!!busy}>ویرایش</button>
          <button onClick={()=>deleteSaved(s)} disabled={!!busy}>حذف</button>
        </div>}
      </article>)}</div>}
    </section>
  </main>;
}