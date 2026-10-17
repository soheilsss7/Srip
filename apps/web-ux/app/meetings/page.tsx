'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, unwrapList } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { ErrorCard, Modal, PageHeader, Skeleton, StatCard, StatusBadge, Toolbar } from '../_components/page-ui';
import { CalendarDays, Users, Zap, ShieldCheck, Plus, CheckCircle2, Clock, RefreshCw, SearchX, Save, FileText, AlertTriangle, Building2, Share2, ChevronLeft } from 'lucide-react';
import { JalaliDateField } from '../_components/jalali-date-field';

type Meeting={
  id:string;title:string;startAt:string;endAt?:string;objective?:string;agenda?:string;outcome?:string;notes?:string;
  preMeetingBrief?:string;location?:string;meetingUrl?:string;status?:string;completedAt?:string;
  organization?:{id:string;name:string}|null;relationshipId?:string;
  participants:{person:{id:string;firstName:string;lastName:string}}[];
  actions:any[];commitments:any[];
};
type Org={id:string;name:string;type?:string};
type Rel={id:string;sourceOrganization?:{name:string}|null;targetOrganization?:{name:string}|null;relationshipType?:string};

const fmtNum=(v:number|undefined|null):string=> v==null?'—':new Intl.NumberFormat('fa-IR').format(v);
const fmtDateTime=(iso:string):string=> new Date(iso).toLocaleString('fa-IR',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
const STATUS_TONE:Record<string,'success'|'info'|'warning'|'danger'|'neutral'>={
  UPCOMING:'info', COMPLETED:'success', OVERDUE:'danger', SCHEDULED:'info',
};

export default function MeetingsPage(){
  const { scopeId } = useWorkspace();
  const [items,setItems]=useState<Meeting[]>([]);
  const [orgs,setOrgs]=useState<Org[]>([]);
  const [rels,setRels]=useState<Rel[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [upcoming,setUpcoming]=useState(false);
  const [query,setQuery]=useState('');
  const [form,setForm]=useState({title:'',startAt:'',endAt:'',objective:'',agenda:'',location:'',meetingUrl:'',organizationId:'',relationshipId:''});
  const [createOpen,setCreateOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [outcomeDrafts,setOutcomeDrafts]=useState<Record<string,string>>({});
  const [outcomeSaving,setOutcomeSaving]=useState<string|null>(null);
  const [formError,setFormError]=useState('');
  /* مسترپلن فاز ۱/۱ — بریف پیش از جلسه + ثبت یک‌کلیکی پس از جلسه (الگوی Introhive) */
  const [info,setInfo]=useState('');
  const [briefFor,setBriefFor]=useState<Meeting|null>(null);
  const [brief,setBrief]=useState<any>(null);
  const [briefLoading,setBriefLoading]=useState(false);
  const [quickFor,setQuickFor]=useState<Meeting|null>(null);
  const [quick,setQuick]=useState({type:'MEETING',subject:'',sentiment:'0',actionTitle:'',actionDueAt:'',commitmentDescription:'',commitmentDueAt:'',nextStep:''});
  const [quickSaving,setQuickSaving]=useState(false);
  const [quickError,setQuickError]=useState('');

  async function openBrief(m:Meeting){
    setBriefFor(m); setBrief(null); setBriefLoading(true); setError('');
    try{ setBrief(await api<any>(`/meetings/${m.id}/brief`)); }
    catch(e){ setError((e as Error).message); setBriefFor(null); }
    finally{ setBriefLoading(false); }
  }

  async function submitQuick(e:FormEvent){
    e.preventDefault();
    if(!quickFor) return;
    if(!quick.subject.trim()){ setQuickError('موضوع تعامل لازم است.'); return; }
    setQuickSaving(true); setQuickError('');
    try{
      const out=await api<any>(`/meetings/${quickFor.id}/quick-log`,{method:'POST',body:JSON.stringify({
        type:quick.type,
        subject:quick.subject.trim(),
        sentiment:Number(quick.sentiment),
        actionTitle:quick.actionTitle.trim()||undefined,
        actionDueAt:quick.actionDueAt?new Date(quick.actionDueAt).toISOString():undefined,
        commitmentDescription:quick.commitmentDescription.trim()||undefined,
        commitmentDueAt:quick.commitmentDueAt?new Date(quick.commitmentDueAt).toISOString():undefined,
        nextStep:quick.nextStep.trim()||undefined,
      })});
      setInfo(`ثبت سریع انجام شد: تعامل${out.actionCreated?' + اقدام':''}${out.commitmentCreated?' + تعهد':''} در یک ثبت ساخته شد.`);
      setQuickFor(null);
      setQuick({type:'MEETING',subject:'',sentiment:'0',actionTitle:'',actionDueAt:'',commitmentDescription:'',commitmentDueAt:'',nextStep:''});
      await load();
    }catch(e:any){ setQuickError(e.message); }
    finally{ setQuickSaving(false); }
  }

  const scopeQS = scopeId !== 'all' ? `?organizationId=${encodeURIComponent(scopeId)}` : '';

  const load=useCallback(()=>{
    setLoading(true); setError('');
    const sep = scopeQS ? '&' : '?';
    return api<Meeting[]>(`/meetings${scopeQS}${scopeQS?'':'?'}upcoming=${upcoming}${scopeId!=='all'?`&organizationId=${encodeURIComponent(scopeId)}`:''}`)
      .then(x=>setItems(unwrapList<Meeting>(x)))
      .catch(e=>setError((e as Error).message))
      .finally(()=>setLoading(false));
  },[scopeId,upcoming,scopeQS]);
  useEffect(()=>{ load(); },[load]);

  /* سازمان‌ها و روابط برای فرم برنامه‌ریزی */
  useEffect(()=>{
    Promise.all([
      api<any>('/organizations').catch(()=>[]),
      api<any>('/relationships').catch(()=>[]),
    ]).then(([o,r])=>{
      setOrgs(unwrapList<Org>(o));
      setRels(unwrapList<Rel>(r));
    });
  },[scopeId]);
  const setF=(k:keyof typeof form)=>(v:string|React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setForm(f=>({...f,[k]:typeof v==='string'?v:v.target.value}));
  const orgName=(id:string)=>orgs.find(o=>o.id===id)?.name??'—';
  const relLabel=(r:Rel)=>`${r.sourceOrganization?.name??'—'} ↔ ${r.targetOrganization?.name??'—'}${r.relationshipType?` (${fa(r.relationshipType)})`:''}`;

  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return items;
    return items.filter(m=>
      m.title.toLowerCase().includes(q) ||
      (m.objective??'').toLowerCase().includes(q) ||
      m.participants.some(p=>`${p.person.firstName} ${p.person.lastName}`.toLowerCase().includes(q)) ||
      (m.organization?.name??'').toLowerCase().includes(q)
    );
  },[items,query]);

  const stats = useMemo(()=>{
    const now=Date.now();
    const up=items.filter(m=>(m.status??(new Date(m.startAt).getTime()>now?'UPCOMING':'OVERDUE'))==='UPCOMING').length;
    const done=items.filter(m=>m.status==='COMPLETED'||!!m.outcome).length;
    const pendingOutcome=items.filter(m=>new Date(m.startAt).getTime()<now && !m.outcome).length;
    const actions=items.reduce((a,m)=>a+(m.actions?.length??0),0);
    const commitments=items.reduce((a,m)=>a+(m.commitments?.length??0),0);
    return {total:items.length, upcoming:up, withOutcome:done, pendingOutcome, actions, commitments};
  },[items]);

  async function submit(e:FormEvent){
    e.preventDefault(); setSaving(true); setError(''); setFormError('');
    const startAt=new Date(form.startAt);
    if(!form.title.trim()||!form.startAt||Number.isNaN(startAt.getTime())){ setFormError('عنوان و زمان شروع (معتبر) لازم است.'); setSaving(false); return; }
    try{
      await api('/meetings',{method:'POST',body:JSON.stringify({
        title:form.title.trim(),
        startAt:startAt.toISOString(),
        endAt:form.endAt?new Date(form.endAt).toISOString():undefined,
        objective:form.objective.trim()||undefined,
        agenda:form.agenda.trim()||undefined,
        location:form.location.trim()||undefined,
        meetingUrl:form.meetingUrl.trim()||undefined,
        organizationId:form.organizationId||undefined,
        relationshipId:form.relationshipId||undefined,
      })});
      setForm({title:'',startAt:'',endAt:'',objective:'',agenda:'',location:'',meetingUrl:'',organizationId:'',relationshipId:''});
      setCreateOpen(false); await load();
    }catch(e:any){ setError(e.message); }
    finally{ setSaving(false); }
  }

  async function saveOutcome(id:string){
    const value=(outcomeDrafts[id]??'').trim();
    if(!value) return;
    setOutcomeSaving(id); setError('');
    try{
      await api(`/meetings/${id}/outcome`,{method:'POST',body:JSON.stringify({outcome:value})});
      setOutcomeDrafts(d=>({...d,[id]:''})); await load();
    }catch(e:any){ setError(e.message); }
    finally{ setOutcomeSaving(null); }
  }

  function personName(p:any){ return `${p.person.firstName} ${p.person.lastName}`.trim(); }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری جلسات"
        title="جلسات"
        description="دستور کار، شرکت‌کنندگان، نتایج و تصمیم‌ها — پیوند داده‌شده به اقدامات و تعهدات."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15}/> بازخوانی</button>
            <button className="btn btn-primary" onClick={()=>{setError('');setFormError('');setCreateOpen(true)}}><Plus size={16}/> برنامه‌ریزی جلسه</button>
          </>
        }
      />
      <ErrorCard message={error}/>
      {info && <div className="success-card" role="status">{info}</div>}

      {loading ? (
        <div className="stat-grid">{[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-card" style={{height:110}}/>)}</div>
      ) : (
        <div className="stat-grid">
          <StatCard icon={<CalendarDays size={18}/>} label="کل جلسات" value={fmtNum(stats.total)} href="/meetings" iconClass="ic-indigo" sub="در محدودهٔ مجاز"/>
          <StatCard icon={<Clock size={18}/>} label="جلسات آینده" value={fmtNum(stats.upcoming)} iconClass="ic-teal"/>
          <StatCard icon={<CheckCircle2 size={18}/>} label="با نتیجهٔ ثبت‌شده" value={fmtNum(stats.withOutcome)} iconClass="ic-green" sub={stats.total?`${fmtNum(Math.round(stats.withOutcome/stats.total*100))}٪ از جلسات`:''}/>
          {stats.pendingOutcome>0 && (
            <StatCard icon={<AlertTriangle size={18}/>} label="در انتظار ثبت نتیجه" value={fmtNum(stats.pendingOutcome)} iconClass="ic-red" sub="جلسات برگزارشدهٔ بدون نتیجه"/>
          )}
          <StatCard icon={<Zap size={18}/>} label="اقدامات پیوندی" value={fmtNum(stats.actions)} href="/actions" iconClass="ic-gold"/>
          <StatCard icon={<ShieldCheck size={18}/>} label="تعهدات پیوندی" value={fmtNum(stats.commitments)} href="/commitments" iconClass="ic-red"/>
        </div>
      )}

      <Toolbar search={query} onSearch={setQuery} searchPlaceholder="جستجوی عنوان، هدف، شرکت‌کننده یا سازمان…">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={!upcoming} className={!upcoming?'active':''} onClick={()=>setUpcoming(false)}>همهٔ جلسات</button>
          <button role="tab" aria-selected={upcoming} className={upcoming?'active':''} onClick={()=>setUpcoming(true)}>جلسات آینده</button>
        </div>
        <span className="chip info" style={{marginInlineStart:'auto'}}>{fmtNum(filtered.length)} جلسه</span>
      </Toolbar>

      {loading ? (
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))'}}>
          {[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-card" style={{height:220}}/>)}
        </div>
      ) : filtered.length===0 ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><SearchX size={24}/></div>
          <strong>{items.length===0?'جلسه‌ای ثبت نشده است':'نتیجه‌ای یافت نشد'}</strong>
          <p>{items.length===0?'از دکمهٔ «برنامه‌ریزی جلسه» برای ثبت اولین جلسه استفاده کنید.':'عبارت جستجو یا فیلتر را تغییر دهید.'}</p>
        </div>
      ) : (
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',alignItems:'start'}}>
          {filtered.map(m=>{
            const start=new Date(m.startAt);
            const st=m.status??(start.getTime()<Date.now()?(m.outcome?'COMPLETED':'OVERDUE'):'UPCOMING');
            return (
              <article className="rec-card" key={m.id} style={{gap:10}}>
                <div className="rec-head" style={{flexDirection:'column',gap:8}}>
                  <div className="match-meta" style={{display:'flex',gap:8,flexWrap:'wrap',width:'100%'}}>
                    <StatusBadge tone={STATUS_TONE[st]??'neutral'}>
                      {st==='UPCOMING'?<Clock size={12}/>:st==='COMPLETED'?<CheckCircle2 size={12}/>:<AlertTriangle size={12}/>}
                      {fa(st)}
                    </StatusBadge>
                    <StatusBadge tone="neutral">
                      <CalendarDays size={12}/> {fmtDateTime(m.startAt)}
                    </StatusBadge>
                    {m.organization?.name && <StatusBadge tone="info"><Building2 size={12}/> {m.organization.name}</StatusBadge>}
                  </div>
                  <h3 style={{fontSize:15.5,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <Link href={`/meetings/${m.id}`} style={{flex:1,minWidth:0}}>{m.title}</Link>
                    <Link className="row-action" href={`/meetings/${m.id}`} aria-label={`مشاهدهٔ جزئیات ${m.title}`}><ChevronLeft size={15}/></Link>
                  </h3>
                </div>
                {m.objective && <p className="rec-rationale" style={{margin:0}}>{m.objective}</p>}
                <div className="rec-rel">
                  <Users size={13}/> شرکت‌کنندگان: {m.participants?.length?m.participants.map(personName).join('، '):'—'}
                </div>
                <div className="rec-rel" style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  <span style={{display:'inline-flex',alignItems:'center',gap:5}}><Zap size={13}/> {fmtNum(m.actions?.length??0)} اقدام</span>
                  <span style={{display:'inline-flex',alignItems:'center',gap:5}}><ShieldCheck size={13}/> {fmtNum(m.commitments?.length??0)} تعهد</span>
                  {m.preMeetingBrief && <span style={{display:'inline-flex',alignItems:'center',gap:5}}><FileText size={13}/> بریف پیش‌جلسه</span>}
                </div>
                {m.agenda && <details className="rec-rationale" style={{fontSize:11.5}}><summary style={{cursor:'pointer',fontWeight:800,color:'var(--srip-accent-text)'}}>دستور کار</summary><p style={{marginTop:6,lineHeight:1.8,whiteSpace:'pre-line'}}>{m.agenda}</p></details>}
                <div className="rec-actions" style={{paddingTop:2,marginTop:0}}>
                  <button className="btn btn-secondary btn-sm" onClick={()=>openBrief(m)} title={`بریف پیش از جلسهٔ ${m.title}`}>
                    <FileText size={13}/> بریف جلسه
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setQuickError('');setQuickFor(m)}} title={`ثبت سریع پس از جلسهٔ ${m.title}`}>
                    <Zap size={13}/> ثبت سریع پس از جلسه
                  </button>
                </div>
                {m.outcome && <p className="rec-rationale" style={{background:'var(--srip-accent-softer)',borderRadius:'var(--radius-md)',padding:'9px 12px',margin:0}}><b style={{color:'var(--srip-accent-text)'}}>نتیجه: </b>{m.outcome}</p>}
                {st!=='COMPLETED' && (
                  <div className="rec-actions" style={{paddingTop:10,marginTop:0}}>
                    <div className="inline-form" style={{flex:1}}>
                      <input className="inline-input" style={{flex:1,minWidth:0}} placeholder="ثبت نتیجهٔ جلسه…" value={outcomeDrafts[m.id]??''} onChange={e=>setOutcomeDrafts(d=>({...d,[m.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')saveOutcome(m.id)}}/>
                      <button className="btn btn-primary btn-sm" onClick={()=>saveOutcome(m.id)} disabled={outcomeSaving===m.id||!(outcomeDrafts[m.id]??'').trim()}>
                        <Save size={13}/> {outcomeSaving===m.id?'در حال…':'ذخیره نتیجه'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        title="برنامه‌ریزی جلسه جدید"
        description="جلسه ثبت می‌شود و در فهرست و تقویم محدودهٔ شما ظاهر می‌شود."
        onClose={()=>setCreateOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setCreateOpen(false)}>انصراف</button>
          <button className="btn btn-primary" form="meeting-create-form" type="submit" disabled={saving}>{saving?'در حال ثبت…':'ثبت جلسه'}</button>
        </>}
      >
        {formError && <div className="error-card" role="alert">{formError}</div>}
        <form id="meeting-create-form" className="entity-form org-form" onSubmit={submit}>
          <div className="form-section-head"><h3>زمان و مکان</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="m-title">عنوان جلسه <span className="req">*</span></label>
              <input id="m-title" required value={form.title} onChange={setF('title')} placeholder="مثلاً: جلسهٔ راهبردی با شریک کلیدی"/>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="m-start">شروع <span className="req">*</span></label>
              <JalaliDateField id="m-start" withTime required value={form.startAt} onChange={setF('startAt')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="m-end">پایان (اختیاری)</label>
              <JalaliDateField id="m-end" withTime value={form.endAt} onChange={setF('endAt')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="m-loc">مکان</label>
              <input id="m-loc" value={form.location} onChange={setF('location')} placeholder="دفتر مرکزی / آنلاین"/>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="m-url">لینک جلسه</label>
              <input id="m-url" dir="ltr" value={form.meetingUrl} onChange={setF('meetingUrl')} placeholder="https://…"/>
            </div>
          </div>
          <div className="form-section-head"><h3>ارتباط با شبکه</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="m-org"><Share2 size={12}/> سازمان مرتبط</label>
              <select id="m-org" value={form.organizationId} onChange={setF('organizationId')}>
                <option value="">بدون سازمان</option>
                {orgs.map(o=><option key={o.id} value={o.id}>{o.name}{o.type?` — ${fa(o.type)}`:''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="m-rel">رابطهٔ مرتبط</label>
              <select id="m-rel" value={form.relationshipId} onChange={setF('relationshipId')}>
                <option value="">بدون رابطه</option>
                {rels.map(r=><option key={r.id} value={r.id}>{relLabel(r)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-section-head"><h3>هدف و دستور کار</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="m-obj">هدف جلسه</label>
              <textarea id="m-obj" value={form.objective} onChange={setF('objective')} placeholder="هدف و خروجی مورد انتظار جلسه…"/>
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="m-agenda">دستور کار</label>
              <textarea id="m-agenda" value={form.agenda} onChange={setF('agenda')} placeholder="دستور کار جلسه… (هر مورد در یک خط)"/>
            </div>
          </div>
        </form>
      </Modal>

      {/* ─── مسترپلن فاز ۱/۱: بریف پیش از جلسه (الگوی Introhive) ─── */}
      <Modal
        open={!!briefFor}
        title={`بریف پیش از جلسه — ${briefFor?.title??''}`}
        description="پروفایل حاضران، وضعیت رابطه، تعاملات اخیر و توصیه‌ها — همه از دادهٔ همین فضای کاری."
        onClose={()=>setBriefFor(null)}
        footer={<button className="btn btn-secondary" onClick={()=>setBriefFor(null)}>بستن</button>}
      >
        {briefLoading||!brief ? (
          <div className="skeleton skeleton-card" style={{height:140}}/>
        ) : (
          <div style={{display:'grid',gap:12}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {brief.organization&&<span className="chip info"><Building2 size={12}/> {brief.organization.name}</span>}
              {brief.relationship&&(
                <Link className="chip neutral" href={`/relationships/${brief.relationship.id}`} style={{textDecoration:'none'}}>
                  <Share2 size={12}/> {brief.relationship.name}
                </Link>
              )}
              {brief.cadence&&brief.cadence.status==='CRITICAL'&&<span className="chip danger">آهنگ ارتباط از دست رفته: {fmtNum(brief.cadence.daysSinceLastInteraction)} روز</span>}
              {brief.cadence&&brief.cadence.status==='WARN'&&<span className="chip warning">آهنگ ارتباط عقب‌افتاده: {fmtNum(brief.cadence.daysSinceLastInteraction)} روز</span>}
              {brief.concentration&&<span className="chip warning">تمرکز {fmtNum(brief.concentration.topShare)}٪ روی {brief.concentration.topName??'—'}</span>}
            </div>
            {brief.relationship&&(
              <div className="kpi-grid" style={{margin:0}}>
                <div className="kpi-card" style={{margin:0}}><small>سلامت</small><strong>{fmtNum(brief.relationship.healthScore)}</strong></div>
                <div className="kpi-card" style={{margin:0}}><small>ریسک</small><strong>{fmtNum(brief.relationship.riskScore)}</strong></div>
                <div className="kpi-card" style={{margin:0}}><small>راهبردی</small><strong>{fmtNum(brief.relationship.strategicScore)}</strong></div>
                <div className="kpi-card" style={{margin:0}}><small>تاب‌آوری</small><strong>{fmtNum(brief.relationship.resilienceScore)}</strong></div>
              </div>
            )}
            <div>
              <h4 style={{fontSize:13,margin:'0 0 6px'}}>شرکت‌کنندگان ({fmtNum(brief.participants?.length??0)})</h4>
              <div className="table-wrap"><table>
                <thead><tr><th>شخص</th><th>سازمان</th><th>نفوذ</th><th>تعامل با ما</th><th>آخرین تماس</th></tr></thead>
                <tbody>
                  {(brief.participants??[]).map((p:any)=>(
                    <tr key={p.id}>
                      <td><b>{p.name}</b>{p.title?` — ${p.title}`:''}{p.champion&&<span className="chip success" style={{marginInlineStart:6}}>حامی</span>}</td>
                      <td>{p.organization??'—'}</td>
                      <td>{fmtNum(p.influenceScore)}</td>
                      <td>{fmtNum(p.interactionsWithUs)} تعامل{p.openCommitments>0?` · ${fmtNum(p.openCommitments)} تعهد باز`:''}</td>
                      <td>{p.lastInteractionAt?fmtDateTime(p.lastInteractionAt):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
            {(brief.lastInteractions?.length>0)&&(
              <div>
                <h4 style={{fontSize:13,margin:'0 0 6px'}}>آخرین تعاملات رابطه</h4>
                <ul style={{margin:0,paddingInlineStart:18,display:'grid',gap:4}}>
                  {brief.lastInteractions.map((x:any)=>(
                    <li key={x.id} style={{fontSize:12.5}}>{fa(x.type)}: {x.subject} — {fmtDateTime(x.occurredAt)}</li>
                  ))}
                </ul>
              </div>
            )}
            {(brief.openActions?.length>0||brief.openCommitments?.length>0)&&(
              <div>
                <h4 style={{fontSize:13,margin:'0 0 6px'}}>کارهای باز پیشین</h4>
                <ul style={{margin:0,paddingInlineStart:18,display:'grid',gap:4}}>
                  {brief.openActions.map((a:any)=><li key={a.id} style={{fontSize:12.5}}><Zap size={11}/> {a.title}</li>)}
                  {brief.openCommitments.map((c:any)=><li key={c.id} style={{fontSize:12.5}}><ShieldCheck size={11}/> {c.description}</li>)}
                </ul>
              </div>
            )}
            {brief.publicsCriticalGaps?.length>0&&(
              <div className="error-card" role="note" style={{margin:0}}>
                <b>شکاف‌های بحرانی عمومی مرتبط:</b>
                <ul style={{margin:'6px 0 0',paddingInlineStart:18}}>
                  {brief.publicsCriticalGaps.map((g:any,i:number)=><li key={i} style={{fontSize:12.5}}>{g.title??g.groupFa??g.gapId}</li>)}
                </ul>
              </div>
            )}
            <div>
              <h4 style={{fontSize:13,margin:'0 0 6px'}}>توصیه‌ها برای این جلسه</h4>
              <ol style={{margin:0,paddingInlineStart:20,display:'grid',gap:5}}>
                {brief.recommendations.map((r:string,i:number)=><li key={i} style={{fontSize:12.5,lineHeight:1.8}}>{r}</li>)}
              </ol>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── مسترپلن فاز ۱/۱: ثبت یک‌کلیکی پس از جلسه ─── */}
      <Modal
        open={!!quickFor}
        title={`ثبت سریع پس از جلسه — ${quickFor?.title??''}`}
        description="تعامل، اقدام و تعهد جلسه در یک ثبت ساخته می‌شوند؛ شرکت‌کنندهٔ بیرونی به‌صورت خودکار به تعامل الصاق می‌شود."
        onClose={()=>setQuickFor(null)}
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setQuickFor(null)}>انصراف</button>
          <button className="btn btn-primary" form="meeting-quick-form" type="submit" disabled={quickSaving}>{quickSaving?'در حال ثبت…':'ثبت یک‌جای نتیجه'}</button>
        </>}
      >
        {quickError && <div className="error-card" role="alert">{quickError}</div>}
        <form id="meeting-quick-form" className="entity-form org-form" onSubmit={submitQuick}>
          <div className="form-section-head"><h3>تعامل</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="q-type">نوع تعامل</label>
              <select id="q-type" value={quick.type} onChange={e=>setQuick(f=>({...f,type:e.target.value}))}>
                <option value="MEETING">جلسه</option>
                <option value="CALL">تماس تلفنی</option>
                <option value="EMAIL">ایمیل</option>
                <option value="MESSAGE">پیام</option>
                <option value="NOTE">یادداشت</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="q-sent">حس کلی جلسه</label>
              <select id="q-sent" value={quick.sentiment} onChange={e=>setQuick(f=>({...f,sentiment:e.target.value}))}>
                <option value="1">مثبت</option>
                <option value="0">خنثی</option>
                <option value="-1">منفی</option>
              </select>
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="q-subject">موضوع تعامل <span className="req">*</span></label>
              <input id="q-subject" required value={quick.subject} onChange={e=>setQuick(f=>({...f,subject:e.target.value}))} placeholder="مثلاً: توافق اولیه روی خط اعتباری"/>
            </div>
          </div>
          <div className="form-section-head"><h3>اقدام پس از جلسه (اختیاری)</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="q-act">عنوان اقدام</label>
              <input id="q-act" value={quick.actionTitle} onChange={e=>setQuick(f=>({...f,actionTitle:e.target.value}))} placeholder="مثلاً: ارسال صورت‌های مالی"/>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="q-actdue">موعد اقدام</label>
              <JalaliDateField id="q-actdue" value={quick.actionDueAt} onChange={v=>setQuick(f=>({...f,actionDueAt:v}))} />
            </div>
          </div>
          <div className="form-section-head"><h3>تعهد ثبت‌شده (اختیاری)</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="q-com">تعهد</label>
              <input id="q-com" value={quick.commitmentDescription} onChange={e=>setQuick(f=>({...f,commitmentDescription:e.target.value}))} placeholder="مثلاً: ارائهٔ طرح توجیهی"/>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="q-comdue">موعد تعهد</label>
              <JalaliDateField id="q-comdue" value={quick.commitmentDueAt} onChange={v=>setQuick(f=>({...f,commitmentDueAt:v}))} />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="q-next">قدم بعدی</label>
              <input id="q-next" value={quick.nextStep} onChange={e=>setQuick(f=>({...f,nextStep:e.target.value}))} placeholder="مثلاً: هماهنگی جلسهٔ بعدی"/>
            </div>
          </div>
        </form>
      </Modal>
    </main>
  );
}
