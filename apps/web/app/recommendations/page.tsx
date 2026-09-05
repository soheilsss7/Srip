'use client';
import Link from 'next/link';
import { useEffect,useMemo,useState } from 'react';
import { api } from '../_lib/api';
import { ErrorCard, PageHeader, Skeleton, StatusBadge } from '../_components/page-ui';
import { suggestGlobal } from '../_lib/connections';
import {
  ThumbsUp, Sparkles, CheckCircle2, XCircle, Clock, UserCheck, PartyPopper, RefreshCw,
  Lightbulb, Link2, ChevronDown, ChevronUp, AlertTriangle, Target, Handshake, TrendingUp,
} from 'lucide-react';
import { JalaliDateField } from '../_components/jalali-date-field';

type Rec = {
  id:string; type:string; title:string; rationale?:string; confidence?:number; status:string;
  evidence?:Record<string,any>; createdAt?:string; snoozedUntil?:string|null;
  relationship?:{ id:string; sourceOrganization?:{id:string;name:string}; targetOrganization?:{id:string;name:string} }|null;
  userId?:string;
};

const unwrap=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];

const STATUS_META: Record<string,{label:string;tone:'success'|'danger'|'warning'|'info'|'neutral'|'purple'}> = {
  PROPOSED:{label:'در انتظار بررسی',tone:'info'},
  APPROVED:{label:'تأییدشده',tone:'success'},
  REJECTED:{label:'ردشده',tone:'danger'},
  SNOOZED:{label:'به تعویق افتاده',tone:'warning'},
  ASSIGNED:{label:'اختصاص‌یافته',tone:'purple'},
  EXECUTED:{label:'اجراشده',tone:'success'},
  ARCHIVED:{label:'بایگانی',tone:'neutral'},
};
const TYPE_META: Record<string,{label:string;icon:React.ReactNode;desc:string}> = {
  FOLLOW_UP:{label:'پیگیری',icon:<Clock size={14}/>,desc:'رابطه نیاز به پیگیری فعال دارد'},
  MEETING:{label:'جلسه',icon:<Handshake size={14}/>,desc:'زمان‌بندی جلسهٔ راهبردی'},
  INTRODUCTION:{label:'معرفی',icon:<Link2 size={14}/>,desc:'ایجاد ارتباط جدید'},
  RELATIONSHIP_REPAIR:{label:'ترمیم رابطه',icon:<Handshake size={14}/>,desc:'اقدام اصلاحی برای رابطه'},
  DIVERSIFICATION:{label:'تنوع‌بخشی',icon:<TrendingUp size={14}/>,desc:'کاهش ریسک تمرکز'},
  OPPORTUNITY:{label:'فرصت',icon:<Target size={14}/>,desc:'بهره‌برداری از پتانسیل'},
  RISK_MITIGATION:{label:'کاهش ریسک',icon:<AlertTriangle size={14}/>,desc:'مدیریت ریسک رابطه'},
  PROJECT_CONNECTION:{label:'پیوند پروژه',icon:<Link2 size={14}/>,desc:'اتصال پروژه به رابطه'},
  EXECUTIVE_ESCALATION:{label:'ارجاع اجرایی',icon:<Sparkles size={14}/>,desc:'نیازمند توجه مدیر ارشد'},
};

const STATUS_ORDER=['PROPOSED','APPROVED','SNOOZED','ASSIGNED','EXECUTED','REJECTED','ARCHIVED'];
const TYPE_ORDER=Object.keys(TYPE_META);

function confidenceTone(c:number){ return c>=70?'':c>=45?' mid':' low'; }

export default function Recommendations(){
 const [items,setItems]=useState<Rec[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [snoozeUntil,setSnoozeUntil]=useState<Record<string,string>>({});
 const [statusFilter,setStatusFilter]=useState('ALL');
 const [typeFilter,setTypeFilter]=useState('ALL');
 const [query,setQuery]=useState('');
 const [explained,setExplained]=useState<Record<string,any>>({});
 const [expanding,setExpanding]=useState<string|null>(null);
 const [lists,setLists]=useState<{orgs:any[];people:any[];rels:any[];interactions:any[]}|null>(null);

 const load=async()=>{
   setLoading(true); setError('');
   try{ setItems(unwrap(await api('/recommendations'))); }
   catch(e){ setError((e as Error).message); }
   finally{ setLoading(false); }
 };
 useEffect(()=>{ load(); },[]);

 // Connection-intelligence lists — new-relationship suggestions from the
 // relationship graph + interactions/meetings outcomes (deterministic, scoped).
 useEffect(()=>{
   let alive=true;
   Promise.all([api('/organizations'),api('/people'),api('/relationships'),api('/interactions')])
     .then(([o,p,r,i])=>{
       if(!alive) return;
       setLists({orgs:unwrap(o),people:unwrap(p),rels:unwrap(r),interactions:unwrap(i)});
     }).catch(()=>{});
   return ()=>{ alive=false; };
 },[]);
 const suggestions = useMemo(()=> lists ? suggestGlobal({orgs:lists.orgs,people:lists.people,rels:lists.rels,interactions:lists.interactions},5) : [], [lists]);

 const counts = useMemo(()=>{
   const c:Record<string,number>={ALL:items.length};
   for(const s of STATUS_ORDER) c[s]=items.filter(r=>r.status===s).length;
   return c;
 },[items]);

 const filtered = useMemo(()=>{
   const q=query.trim().toLowerCase();
   return items.filter(r=>{
     if(statusFilter!=='ALL' && r.status!==statusFilter) return false;
     if(typeFilter!=='ALL' && r.type!==typeFilter) return false;
     if(!q) return true;
     return (r.title??'').toLowerCase().includes(q) || (r.rationale??'').toLowerCase().includes(q);
   });
 },[items,statusFilter,typeFilter,query]);

 async function generate(){
   setBusy('generate'); setError('');
   try{ await api('/recommendations/generate',{method:'POST',body:JSON.stringify({})}); await load(); }
   catch(e){ setError((e as Error).message); }
   finally{ setBusy(''); }
 }
 async function act(id:string,action:string,body:unknown={}){
   setBusy(id+action); setError('');
   try{ await api(`/recommendations/${id}/${action}`,{method:'POST',body:JSON.stringify(body)}); await load(); }
   catch(e){ setError((e as Error).message); }
   finally{ setBusy(''); }
 }
 const snooze=(id:string)=>{
   const until=snoozeUntil[id];
   if(!until||isNaN(new Date(until).getTime())){ setError('برای Snooze یک زمان پایان معتبر انتخاب کنید.'); return; }
   act(id,'snooze',{until:new Date(until).toISOString()});
 };
 async function toggleExplain(id:string){
   if(explained[id]){ setExplained(e=>({...e,[id]:undefined})); return; }
   setExpanding(id); setError('');
   try{ const d:any=await api(`/recommendations/${id}/explain`); setExplained(x=>({...x,[id]:d})); }
   catch(e){ setError((e as Error).message); }
   finally{ setExpanding(null); }
 }

 const evidenceEntries=(r:Rec)=>Object.entries(r.evidence??{}).filter(([,v])=>v!==null&&v!==undefined);

 return (
  <main className="feature-page">
    <PageHeader
      eyebrow="هوشمندی قابل اقدام"
      title="پیشنهادهای هوشمند"
      description="هر پیشنهاد دارای شواهد، اطمینان، دلیل و نیاز به تأیید انسانی است — تولیدشده توسط موتور قطعی، بدون وابستگی به مدل خارجی."
      actions={
        <>
          <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15}/> بازخوانی</button>
          <button className="btn btn-primary" onClick={generate} disabled={!!busy}>
            <Sparkles size={15}/> {busy==='generate'?'در حال تحلیل روابط…':'تولید پیشنهادها'}
          </button>
        </>
      }
    />
    <ErrorCard message={error}/>

    {suggestions.length>0 && (
      <section className="section-card">
        <div className="section-head">
          <div>
            <h2><Link2 size={17}/> پیشنهاد ارتباط جدید</h2>
            <p>روابط جدید پیشنهادی از دل تعاملات اخیر، جلسات و نتایج آن‌ها — موتور قطعی داخلی، بدون مدل خارجی.</p>
          </div>
          <Link href="/network" className="btn btn-ghost btn-sm">مشاهدهٔ شبکه ←</Link>
        </div>
        <div className="suggestions-grid">
          {suggestions.map(s=>(
            <Link href={s.href} key={s.id} className="ai-match-card" style={{textDecoration:'none',gap:8}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <b style={{fontSize:13.5,display:'flex',alignItems:'center',gap:8}}>
                  <span className="stat-ico ic-purple" style={{width:30,height:30,borderRadius:9}}><Link2 size={15}/></span>
                  {s.name}
                </b>
                <span className="confidence-num">{s.score}٪</span>
              </div>
              {s.sub && <span className="chip neutral" style={{alignSelf:'flex-start'}}>{s.sub}</span>}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {s.reasons.map(r=><span className="chip info" key={r}>{r}</span>)}
              </div>
              {s.via.length>0 && <div className="match-meta"><Handshake size={12}/> از طریق: {s.via.join('، ')}</div>}
              <div className="confidence-wrap">
                <div className="confidence-track"><span className="confidence-fill" style={{width:`${s.score}%`}}/></div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    )}

    {loading ? (
      <div className="stat-grid">{[0,1,2,3,4,5].map(i=><div key={i} className="skeleton skeleton-card" style={{height:92}}/>)}</div>
    ) : (
      <div className="rec-stats">
        <button className={`rec-stat ${statusFilter==='ALL'?'active':''}`} onClick={()=>setStatusFilter('ALL')}>
          <div className="rs-top"><b>{counts.ALL}</b><span className="dot" style={{background:'var(--srip-accent)'}}/></div>
          <span>همهٔ پیشنهادها</span>
        </button>
        {STATUS_ORDER.map(s=>(
          <button key={s} className={`rec-stat ${statusFilter===s?'active':''}`} onClick={()=>setStatusFilter(s)}>
            <div className="rs-top"><b>{counts[s]??0}</b><span className="dot" style={{background: s==='PROPOSED'?'var(--srip-accent)':s==='APPROVED'||s==='EXECUTED'?'var(--srip-success)':s==='REJECTED'?'var(--srip-danger)':s==='SNOOZED'?'var(--srip-amber)':s==='ASSIGNED'?'var(--purple)':'var(--text-muted)'}}/></div>
            <span>{STATUS_META[s]?.label??s}</span>
          </button>
        ))}
      </div>
    )}

    <div className="page-toolbar">
      <label className="toolbar-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجو در عنوان و دلیل…" aria-label="جستجو"/>
      </label>
      <select aria-label="فیلتر نوع پیشنهاد" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
        style={{minHeight:40,border:'1px solid var(--card-border-strong)',borderRadius:'var(--radius-md)',background:'var(--card-bg)',color:'var(--text-primary)',padding:'0 12px',fontSize:12.5,fontWeight:700,maxWidth:220}}>
        <option value="ALL">همهٔ انواع</option>
        {TYPE_ORDER.map(t=><option key={t} value={t}>{TYPE_META[t]?.label??t}</option>)}
      </select>
      <span className="chip info" style={{marginInlineStart:'auto'}}>{filtered.length} پیشنهاد</span>
    </div>

    {loading ? (
      <div className="rec-grid">{[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-card" style={{height:230}}/>)}</div>
    ) : filtered.length===0 ? (
      <div className="empty-state-v4">
        <div className="empty-ico"><ThumbsUp size={24}/></div>
        <strong>{items.length===0?'هنوز پیشنهادی تولید نشده است':'نتیجه‌ای یافت نشد'}</strong>
        <p>{items.length===0?'از دکمهٔ «تولید پیشنهادها» استفاده کنید — موتور قطعی روابط شما را تحلیل و پیشنهادهای اولویت‌دار می‌سازد.':'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
        {items.length===0 && <button className="btn btn-primary" onClick={generate} disabled={!!busy}><Sparkles size={15}/> تولید پیشنهادها</button>}
      </div>
    ) : (
      <div className="rec-grid">
        {filtered.map(r=>{
          const tm=TYPE_META[r.type]??{label:r.type,icon:<Sparkles size={14}/>,desc:''};
          const sm=STATUS_META[r.status]??{label:r.status,tone:'neutral'};
          const conf=Math.max(0,Math.min(100,Math.round(r.confidence??0)));
          const isActionable=['PROPOSED','SNOOZED','ASSIGNED'].includes(r.status);
          return (
            <article className="rec-card" key={r.id}>
              <div className="rec-head">
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                    <span className="chip purple">{tm.icon} {tm.label}</span>
                    <StatusBadge tone={sm.tone}>{sm.label}</StatusBadge>
                  </div>
                  <h3><Link href={`/recommendations/${r.id}`}>{r.title}</Link></h3>
                </div>
              </div>

              {r.rationale && <p className="rec-rationale">{r.rationale}</p>}
              {tm.desc && <span className="t-muted" style={{fontSize:11}}>{tm.desc}</span>}

              {r.relationship?.targetOrganization && (
                <div className="rec-rel">
                  <Handshake size={13}/>
                  رابطه با <Link href={`/organizations/${r.relationship.targetOrganization.id}`}>{r.relationship.targetOrganization.name}</Link>
                  {r.relationship.sourceOrganization && <span>· {r.relationship.sourceOrganization.name}</span>}
                </div>
              )}

              <div className="confidence-wrap" title={`اطمینان موتور: ${conf}٪`}>
                <span className="t-muted" style={{fontSize:10.5,fontWeight:800,whiteSpace:'nowrap'}}>اطمینان</span>
                <div className="confidence-track"><span className={`confidence-fill${confidenceTone(conf)}`} style={{width:`${conf}%`}}/></div>
                <span className="confidence-num">{conf}٪</span>
              </div>

              {evidenceEntries(r).length>0 && (
                <div className="rec-evidence">
                  {evidenceEntries(r).slice(0,5).map(([k,v])=>(
                    <span className="chip neutral" key={k} dir="ltr" title={String(v)}>{k}: {String(v)}</span>
                  ))}
                </div>
              )}

              {explained[r.id] && (
                <div className="rec-explained">
                  <b><Lightbulb size={13} style={{verticalAlign:'-2px'}}/> چرا این پیشنهاد؟</b>
                  <span>دلیل: {explained[r.id]?.reason ?? explained[r.id]?.explainability?.decision ?? '—'}</span>
                  {explained[r.id]?.explainability?.humanApprovalRequired!=null && <span>تأیید انسانی: {explained[r.id].explainability.humanApprovalRequired?'لازم است':'خیر'}</span>}
                  <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                    {Object.entries(explained[r.id]?.explainability?.factors??{}).map(([k,v]:any)=>(
                      <span className="chip neutral" key={k} dir="ltr">{k}: {String(v)}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rec-actions">
                <Link className="btn btn-secondary btn-sm" href={`/recommendations/${r.id}`}>جزئیات</Link>
                <button className="btn btn-ghost btn-sm" onClick={()=>toggleExplain(r.id)} disabled={expanding===r.id}>
                  {expanding===r.id?'در حال تحلیل…':explained[r.id]?<><ChevronUp size={13}/> بستن توضیح</>:<><ChevronDown size={13}/> چرا این پیشنهاد؟</>}
                </button>
                {isActionable && (
                  <span className="snooze-field">
                    <JalaliDateField withTime value={snoozeUntil[r.id]??''} onChange={(x)=>setSnoozeUntil(s=>({...s,[r.id]:x}))} aria-label="Snooze تا زمان" style={{width:200}}/>
                    <button className="btn btn-warning btn-sm" disabled={!!busy} onClick={()=>snooze(r.id)}><Clock size={13}/> Snooze</button>
                  </span>
                )}
                {isActionable && (
                  <span style={{display:'flex',gap:6,marginInlineStart:'auto'}}>
                    <button className="btn btn-success btn-sm" disabled={!!busy} onClick={()=>act(r.id,'approve')}><CheckCircle2 size={13}/> تأیید</button>
                    <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={()=>act(r.id,'reject')}><XCircle size={13}/> رد</button>
                  </span>
                )}
                {r.status==='APPROVED' && (
                  <button className="btn btn-primary btn-sm" style={{marginInlineStart:'auto'}} disabled={!!busy} onClick={()=>act(r.id,'execute')}><PartyPopper size={13}/> اجرا و ساخت اقدام</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    )}
  </main>
 );
}
