'use client';
import Link from 'next/link';
import {useEffect,useState,useCallback} from 'react';
import {apiGet} from '../_lib/api';
import {fa} from '../_lib/fa';
import {ErrorCard, PageHeader, SectionCard, Skeleton, StatCard, StatusBadge} from '../_components/page-ui';
import {
  CalendarDays, Target, ShieldCheck, Zap, HeartPulse, RefreshCw, Lightbulb, FileText, Sparkles, Link2, Clock
} from 'lucide-react';
import { JalaliDateField } from '../_components/jalali-date-field';

const BRIEF_LABELS:Record<string,string> = {
  meetings:'جلسات هفته', newOpportunities:'فرصت‌های جدید', openCommitments:'تعهدات باز',
  overdueActions:'اقدامات عقب‌افتاده', relationshipRisks:'ریسک‌های رابطه',
};

export default function Page(){
  const [r,setR]=useState<any>();
  const [e,setE]=useState('');
  const [loading,setLoading]=useState(true);
  const [weekStart,setWeekStart]=useState('');
  const [refreshing,setRefreshing]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true); setE('');
    try{
      const q = weekStart ? `?weekStart=${encodeURIComponent(new Date(weekStart).toISOString())}` : '';
      setR(await apiGet(`/ai/executive-brief${q}`));
    }catch(x){ setE((x as Error)?.message||'دریافت بریف ممکن نشد'); }
    finally{ setLoading(false); setRefreshing(false); }
  },[weekStart]);

  useEffect(()=>{ load(); },[load]);

  const summary=r?.result?.summary;
  const fmt=(v?:string)=> v ? new Date(v).toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'}) : '—';

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="گزارش هوش مصنوعی"
        title="گزارش هفتگی راهبردی"
        description="خلاصهٔ حساس به دسترسی از جلسات، تعهدات، ریسک‌ها، فرصت‌ها و اقدامات پیشنهادی — تولیدشده توسط موتور قطعی (بدون نیاز به مدل خارجی)."
        actions={
          <>
            <JalaliDateField aria-label="شروع هفته" placeholder="انتخاب هفته (شمسی)…" value={weekStart} onChange={setWeekStart} style={{width:214,minHeight:40}}/>
            <button className="btn btn-secondary" onClick={()=>{setRefreshing(true);load();}} disabled={refreshing||loading}>
              <RefreshCw size={15} className={refreshing?'spin':''}/> بازتولید بریف
            </button>
          </>
        }
      />
      <ErrorCard message={e}/>

      {loading&&!r ? (
        <>
          <div className="stat-grid">{[0,1,2,3,4].map(i=><div key={i} className="skeleton skeleton-card" style={{height:110}}/>)}</div>
          <div className="skeleton skeleton-table"/>
        </>
      ) : !r ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><FileText size={24}/></div>
          <strong>بریفی در دسترس نیست</strong>
          <p>برای تولید بریف هفتگی، از دکمهٔ «بازتولید بریف» استفاده کنید.</p>
        </div>
      ) : (
        <>
          {/* Period + model meta */}
          <div className="page-toolbar">
            <StatusBadge tone="purple"><Sparkles size={12}/> موتور قطعی داخلی</StatusBadge>
            <StatusBadge tone="success"><Link2 size={12}/> بدون تماس خارجی</StatusBadge>
            <StatusBadge tone="info"><Clock size={12}/> تولید: {fmt(r?.result?.generatedAt)}</StatusBadge>
            <span className="chip" style={{marginInlineStart:'auto'}}>
              دوره: {r?.result?.period?.start?new Date(r.result.period.start).toLocaleDateString('fa-IR'):'—'} تا {r?.result?.period?.end?new Date(r.result.period.end).toLocaleDateString('fa-IR'):'—'}
            </span>
          </div>

          {/* Summary stats */}
          <div className="stat-grid">
            <StatCard icon={<CalendarDays size={18}/>} label={BRIEF_LABELS.meetings} value={summary?.meetings??0} href="/meetings" iconClass="ic-indigo"/>
            <StatCard icon={<Target size={18}/>} label={BRIEF_LABELS.newOpportunities} value={summary?.newOpportunities??0} href="/opportunities" iconClass="ic-green"/>
            <StatCard icon={<ShieldCheck size={18}/>} label={BRIEF_LABELS.openCommitments} value={summary?.openCommitments??0} href="/commitments" iconClass="ic-red"/>
            <StatCard icon={<Zap size={18}/>} label={BRIEF_LABELS.overdueActions} value={summary?.overdueActions??0} href="/actions" iconClass="ic-gold" trend={summary?.overdueActions>0?{dir:'down',text:'نیاز به پیگیری'}:undefined}/>
            <StatCard icon={<HeartPulse size={18}/>} label={BRIEF_LABELS.relationshipRisks} value={summary?.relationshipRisks??0} href="/relationships" iconClass="ic-purple" trend={summary?.relationshipRisks>0?{dir:'down',text:'نیاز به بررسی'}:undefined}/>
          </div>

          {/* Recommended actions */}
          <SectionCard title="اقدامات پیشنهادی" icon={<Lightbulb size={17}/>} description="پیشنهادهای تولیدشده بر اساس قوانین شفاف — هر اقدام نیازمند تأیید انسانی است.">
            {(r?.result?.recommendations?.length??0)>0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:9}}>
                {r.result.recommendations.map((x:string,i:number)=>(
                  <div className="ai-suggestion" key={i}><Lightbulb size={15}/>{x}</div>
                ))}
              </div>
            ) : <p className="muted">پیشنهادی برای این دوره وجود ندارد.</p>}
          </SectionCard>

          {/* Meetings */}
          <SectionCard title={`جلسات مهم (${r?.result?.importantMeetings?.length??0})`} icon={<CalendarDays size={17}/>} actions={<Link className="btn btn-ghost btn-sm" href="/meetings">همهٔ جلسات ←</Link>}>
            {(r?.result?.importantMeetings?.length??0)>0 ? (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
                {r.result.importantMeetings.map((m:any)=>(
                  <div className="ai-match-card" key={m.id}>
                    <Link href={`/meetings/${m.id}`}>{m.title}</Link>
                    <p>{m.objective||'بدون هدف ثبت‌شده'}</p>
                    <div className="match-meta"><span>{new Date(m.startAt).toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'})}</span></div>
                  </div>
                ))}
              </div>
            ) : <p className="muted">جلسه‌ای در این دوره ثبت نشده است.</p>}
          </SectionCard>

          {/* Risks */}
          <SectionCard title={`ریسک‌های رابطه (${r?.result?.risks?.length??0})`} icon={<HeartPulse size={17}/>} description="روابط با ریسک بالا یا سلامت پایین که باید بررسی شوند.">
            {(r?.result?.risks?.length??0)>0 ? (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
                {r.result.risks.map((x:any)=>(
                  <div className="ai-match-card" key={x.id}>
                    <Link href={`/relationships/${x.id}`}>{x.name??`رابطهٔ ${fa(x.status)??'—'}`}</Link>
                    <p>ریسک: {x.riskScore??'—'} · سلامت: {x.healthScore??'—'} · استراتژیک: {x.strategicScore??'—'}</p>
                    <div className="match-meta">
                      {x.riskScore>=60&&<StatusBadge tone="danger">ریسک بالا</StatusBadge>}
                      {x.healthScore<=40&&<StatusBadge tone="warning">سلامت پایین</StatusBadge>}
                      {x.nextActionAt&&<span>اقدام بعدی: {new Date(x.nextActionAt).toLocaleDateString('fa-IR')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted">ریسک قابل توجهی شناسایی نشده است.</p>}
          </SectionCard>

          {/* Commitments + overdue actions */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:14}}>
            <SectionCard title={`تعهدات باز (${r?.result?.commitments?.length??0})`} icon={<ShieldCheck size={17}/>}>
              {(r?.result?.commitments?.length??0)>0 ? (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {r.result.commitments.map((c:any)=>(
                    <div className="ai-candidate" key={c.id}><ShieldCheck size={15}/>
                      <div><b>{c.description}</b><div className="t-muted">سررسید: {c.dueAt?new Date(c.dueAt).toLocaleDateString('fa-IR'):'—'} · {fa(c.status)}</div></div>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">تعهد باز وجود ندارد.</p>}
            </SectionCard>
            <SectionCard title={`اقدامات عقب‌افتاده (${r?.result?.overdueActions?.length??0})`} icon={<Zap size={17}/>}>
              {(r?.result?.overdueActions?.length??0)>0 ? (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {r.result.overdueActions.map((a:any)=>(
                    <div className="ai-candidate" key={a.id}><Zap size={15}/>
                      <div><b>{a.title}</b><div className="t-muted">موعد گذشته: {a.dueAt?new Date(a.dueAt).toLocaleDateString('fa-IR'):'—'}</div></div>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">اقدام عقب‌افتاده‌ای وجود ندارد.</p>}
            </SectionCard>
          </div>

          {/* Opportunities */}
          <SectionCard title={`فرصت‌ها (${r?.result?.opportunities?.length??0})`} icon={<Target size={17}/>}>
            {(r?.result?.opportunities?.length??0)>0 ? (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
                {r.result.opportunities.map((o:any)=>(
                  <div className="ai-match-card" key={o.id}>
                    <Link href={`/opportunities/${o.id}`}>{o.name}</Link>
                    <div className="match-meta">
                      <StatusBadge tone={o.status==='OPEN'?'success':'info'}>{fa(o.status)}</StatusBadge>
                      <span>احتمال: {o.probability??'—'}٪</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted">فرصت جدیدی در این دوره ثبت نشده است.</p>}
          </SectionCard>

          {/* Evidence */}
          <SectionCard title="شواهد" icon={<Link2 size={17}/>} description="مستندات استفاده‌شده برای تولید این بریف — کاملاً قابل ممیزی.">
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {Object.entries(r?.result?.evidence??{}).map(([k,v]:any)=>{
                const faLabel:Record<string,string>={meetingIds:'جلسه',commitmentIds:'تعهد',actionIds:'اقدام عقب‌افتاده',relationshipIds:'رابطهٔ پرریسک',opportunityIds:'فرصت'};
                return <span className="ai-evidence-chip" key={k}>{faLabel[k]??k}: <b>{Array.isArray(v)?v.length:v}</b></span>;
              })}
            </div>
          </SectionCard>
        </>
      )}
    </main>
  );
}
