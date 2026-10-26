'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,Modal,PageHeader,StatusBadge} from '../_components/page-ui';
import {Search as SearchIcon, Building2, Users, Share2, CalendarDays, FolderKanban, Target, FileText, StickyNote, Bookmark, Play, Pencil, Trash2, Save, SearchX, Clock, Power} from 'lucide-react';

const RESULT_TYPES=['organization','person','relationship','meeting','interaction','project','opportunity','document','note'];
const TYPE_META:Record<string,{label:string;icon:React.ReactNode;tone:string}> = {
  organization:{label:'سازمان',icon:<Building2 size={14}/>,tone:'ic-blue'},
  person:{label:'شخص',icon:<Users size={14}/>,tone:'ic-purple'},
  relationship:{label:'رابطه',icon:<Share2 size={14}/>,tone:'ic-teal'},
  meeting:{label:'جلسه',icon:<CalendarDays size={14}/>,tone:'ic-indigo'},
  interaction:{label:'تعامل',icon:<Clock size={14}/>,tone:'ic-gold'},
  project:{label:'پروژه',icon:<FolderKanban size={14}/>,tone:'ic-green'},
  opportunity:{label:'فرصت',icon:<Target size={14}/>,tone:'ic-violet'},
  document:{label:'سند',icon:<FileText size={14}/>,tone:'ic-red'},
  note:{label:'یادداشت',icon:<StickyNote size={14}/>,tone:'ic-slate'},
};
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

export default function GlobalSearch(){
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

  return (
    <main className="feature-page">
      <PageHeader eyebrow="جستجوی سراسری" title="جستجوی سراسری" description="جستجوی authorization-aware روی موجودیت‌های اصلی — نتایج فقط از محدودهٔ مجاز شما."/>

      {/* Search hero */}
      <section className="ai-composer" style={{gap:14}}>
        <div className="toolbar-search" style={{maxWidth:'none',width:'100%'}}>
          <SearchIcon size={17}/>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="جستجو در سازمان‌ها، افراد، جلسات، پروژه‌ها…"
            aria-label="عبارت جستجو"
            style={{paddingInlineStart:40,minHeight:50,fontSize:14.5}}
            autoFocus
          />
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className={`ai-quick-chip ${typeFilter===''?'active-chip':''}`} style={typeFilter===''?{borderColor:'var(--srip-accent)',color:'var(--srip-accent-text)',background:'var(--srip-accent-softer)'}:undefined} onClick={()=>setTypeFilter('')}>
            همهٔ انواع
          </button>
          {RESULT_TYPES.map(t=>{
            const meta=TYPE_META[t];
            return (
              <button key={t} className="ai-quick-chip" style={typeFilter===t?{borderColor:'var(--srip-accent)',color:'var(--srip-accent-text)',background:'var(--srip-accent-softer)'}:undefined} onClick={()=>setTypeFilter(typeFilter===t?'':t)}>
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
        {q.trim().length>=2 && (
          <div className="form-actions" style={{justifyContent:'flex-start'}}>
            <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="نام جستجوی ذخیره‌شده…" aria-label="نام جستجوی ذخیره‌شده" style={{maxWidth:260}}/>
            <button className="btn btn-secondary btn-sm" onClick={saveIt} disabled={!!busy}><Save size={14}/> {busy==='save'?'در حال ذخیره…':'ذخیرهٔ جستجو'}</button>
          </div>
        )}
      </section>

      <ErrorCard message={error}/>

      {/* Results */}
      {data && (
        <section className="section-card">
          <div className="section-head">
            <div><h2><SearchIcon size={17}/> نتایج</h2><p>برای عبارت «{data.query??q}»</p></div>
            <span className="chip info">{data.total??data.results?.length??0} نتیجه</span>
          </div>
          {data.results?.length ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
              {data.results.map((r:Result)=>{
                const meta=TYPE_META[r.type]??{label:r.type,icon:<SearchIcon size={14}/>,tone:'ic-slate'};
                const href=DETAIL_URL[r.type]?.(r.id);
                const score=Math.round(r.score??0);
                return (
                  <div className="ai-match-card" key={r.type+r.id}>
                    {href
                      ? <Link href={href} style={{display:'flex',alignItems:'center',gap:9}}><span className={`stat-ico ${meta.tone}`} style={{width:30,height:30,borderRadius:9}}>{meta.icon}</span>{r.title}</Link>
                      : <b style={{display:'flex',alignItems:'center',gap:9}}><span className={`stat-ico ${meta.tone}`} style={{width:30,height:30,borderRadius:9}}>{meta.icon}</span>{r.title}</b>}
                    {r.subtitle && <p className="t-muted">{r.subtitle}</p>}
                    <div className="match-meta">
                      <span className="chip neutral">{meta.label}</span>
                      <span className="confidence-track" style={{flex:1,height:6,maxWidth:90}}><span className="confidence-fill" style={{width:`${score}%`,height:'100%',display:'block'}}/></span>
                      <span className="t-muted" style={{fontSize:10.5,fontWeight:800}}>{score}٪</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-v4">
              <div className="empty-ico"><SearchX size={24}/></div>
              <strong>نتیجه‌ای یافت نشد</strong>
              <p>عبارت دیگری را امتحان کنید یا نوع موجودیت را تغییر دهید.</p>
            </div>
          )}
        </section>
      )}

      {/* Saved searches */}
      <section className="section-card">
        <div className="section-head">
          <div><h2><Bookmark size={17}/> جستجوهای ذخیره‌شده</h2><p>دسترسی سریع به جستجوهای پرتکرار</p></div>
          <span className="chip info">{saved.length} مورد</span>
        </div>
        {savedLoading?<Loading label="در حال بارگذاری…"/>:saved.length===0?(
          <div className="empty-state-v4">
            <div className="empty-ico"><Bookmark size={24}/></div>
            <strong>هنوز جستجویی ذخیره نکرده‌اید</strong>
            <p>یک جستجو انجام دهید و با «ذخیرهٔ جستجو» آن را برای دسترسی سریع نگه دارید.</p>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
            {saved.map(s=>(
              <div className="ai-match-card" key={s.id} style={{gap:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <b style={{fontSize:13}}>{s.name}</b>
                  <StatusBadge tone={s.enabled?'success':'neutral'}>{s.enabled?'فعال':'غیرفعال'}</StatusBadge>
                </div>
                <p className="t-muted" style={{fontSize:11.5}}>«{s.query||'(بدون عبارت)'}»</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>runSaved(s.id)} disabled={!!busy}><Play size={13}/> اجرا</button>
                    <button className="btn btn-secondary btn-sm" onClick={()=>toggleSaved(s)} disabled={!!busy}><Power size={13}/> {s.enabled?'غیرفعال':'فعال'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>startEdit(s)} disabled={!!busy}><Pencil size={13}/> ویرایش</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--srip-danger)'}} onClick={()=>deleteSaved(s)} disabled={!!busy}><Trash2 size={13}/> حذف</button>
                  </div>
              </div>
            ))}
          </div>
        )}
      </section>
    {/* Edit modal */}
    <Modal open={!!editId} title="ویرایش جستجوی ذخیره‌شده" description="نام و عبارت جستجوی ذخیره‌شده را به‌روزرسانی کنید." onClose={()=>setEditId('')}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={()=>setEditId('')}>انصراف</button>
        <button type="button" className="btn btn-primary" onClick={()=>{const t=saved.find(x=>x.id===editId);if(t)saveEdit(t)}} disabled={!!busy}><Save size={13}/> ذخیره</button>
      </>}>
      <div className="entity-form">
        <div className="field full"><label className="field-label">نام</label><input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="نام" aria-label="نام جستجو"/></div>
        <div className="field full"><label className="field-label">عبارت جستجو</label><input value={editQuery} onChange={e=>setEditQuery(e.target.value)} placeholder="عبارت جستجو" aria-label="عبارت جستجو"/></div>
      </div>
    </Modal>
    </main>
  );
}
