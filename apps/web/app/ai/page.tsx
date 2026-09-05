'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { fa } from '../_lib/fa';
import { PageHeader } from '../_components/page-ui';
import {
  Sparkles, Search, CalendarCheck, FileText, ListChecks, ShieldCheck, AlertTriangle, Target,
  Lightbulb, Briefcase, Send, History, Cpu, Zap, Database, Clock, Wand2, CheckCircle2, Info,
  Users, ArrowLeft, Link2,
} from 'lucide-react';

/* ---------------------------------------------------------------------------
   Deterministic intelligence model — works fully without any LLM.
   Each intent carries: label, icon, description, example prompts and a
   template. The backend rule-engine (deterministic-gateway) answers with
   permission-aware evidence; the UI renders it structurally.
   --------------------------------------------------------------------------- */
const INTENTS: Array<{
  id: string; label: string; desc: string; icon: React.ReactNode; placeholder: string;
  quick: Array<{ label: string; text: string }>;
}> = [
  { id:'SMART_SEARCH', label:'جستجوی هوشمند', desc:'جستجوی سازمان، جلسه و تعامل در محدودهٔ مجاز', icon:<Search size={16}/>,
    placeholder:'مثلاً: جلسات اخیر با تأمین‌کننده‌ها را نشان بده…',
    quick:[
      {label:'جلسات اخیر', text:'جلسات اخیر با تامین کنندگان را فهرست کن'},
      {label:'تعاملات با مشتری', text:'تعاملات اخیر با مشتریان کلیدی را نشان بده'},
      {label:'سازمان‌های بانکی', text:'سازمان‌های نوع بانک را فهرست کن'},
      {label:'چرا ریسک؟', text:'کدام روابط در معرض ریسک هستند و چرا؟'},
    ]},
  { id:'MEETING_BRIEF', label:'بریف جلسه', desc:'خلاصهٔ آمادگی برای جلسه: هدف، شرکت‌کنندگان، اقدامات', icon:<CalendarCheck size={16}/>,
    placeholder:'عنوان یا موضوع جلسه را بنویسید…',
    quick:[
      {label:'آماده‌سازی جلسه', text:'برای جلسه آتی درباره همکاری راهبردی بریف آمادگی تهیه کن'},
      {label:'بریف جلسه با بانک', text:'بریف جلسه با نمایندگان بانک را آماده کن'},
    ]},
  { id:'MEETING_SUMMARY', label:'خلاصهٔ جلسه', desc:'استخراج خلاصه از متن یادداشت‌های جلسه', icon:<FileText size={16}/>,
    placeholder:'متن یادداشت‌های جلسه را اینجا قرار دهید…',
    quick:[
      {label:'متن نمونه', text:'جلسه با حضور مدیرعامل برگزار شد. توافق شد قرارداد تا پایان ماه امضا شود. نیاز به پیگیری از تیم حقوقی داریم.'},
    ]},
  { id:'ACTION_EXTRACTION', label:'استخراج اقدام', desc:'تشخیص اقدام‌های مشخص از متن — نیازمند تأیید انسانی', icon:<ListChecks size={16}/>,
    placeholder:'متن را بنویسید؛ اقدام‌ها شناسایی می‌شوند…',
    quick:[
      {label:'متن نمونه', text:'ما باید پیش‌فاکتور را تا جمعه ارسال کنیم. لطفاً گزارش مالی را آماده کنید و با تیم فروش هماهنگ شوید.'},
    ]},
  { id:'COMMITMENT_EXTRACTION', label:'استخراج تعهد', desc:'تشخیص تعهدهای طرفین از متن — نیازمند تأیید انسانی', icon:<ShieldCheck size={16}/>,
    placeholder:'متن را بنویسید؛ تعهدها شناسایی می‌شوند…',
    quick:[
      {label:'متن نمونه', text:'تیم ما متعهد شد نسخه اول را تحویل دهد و آن‌ها قول دادند زیرساخت را آماده کنند. موعد تحویل دو هفته آینده است.'},
    ]},
  { id:'RISK_DETECTION', label:'تشخیص ریسک', desc:'شناسایی سیگنال‌های ریسک در متن: تاخیر، انسداد، نگرانی', icon:<AlertTriangle size={16}/>,
    placeholder:'متن را بنویسید؛ سیگنال‌های ریسک استخراج می‌شوند…',
    quick:[
      {label:'متن نمونه', text:'متاسفانه پروژه با تاخیر مواجه شده و تامین مواد دچار مشکل است. ریسک لغو سفارش توسط مشتری وجود دارد.'},
    ]},
  { id:'OPPORTUNITY_DETECTION', label:'تشخیص فرصت', desc:'شناسایی سیگنال‌های فرصت: توسعه، همکاری، تمدید', icon:<Target size={16}/>,
    placeholder:'متن را بنویسید؛ سیگنال‌های فرصت استخراج می‌شوند…',
    quick:[
      {label:'متن نمونه', text:'مشتری علاقه‌مند به توسعه همکاری در بازار جدید است و پیشنهاد تمدید قرارداد را داده.'},
    ]},
  { id:'NEXT_BEST_ACTION', label:'اقدام بعدی', desc:'پیشنهاد بهترین اقدام بعدی بر اساس شواهد مجاز', icon:<Lightbulb size={16}/>,
    placeholder:'رابطه، سازمان یا وضعیت را بنویسید…',
    quick:[
      {label:'بررسی رابطه', text:'بهترین اقدام بعدی برای روابط کلیدی من چیست؟'},
      {label:'پیگیری', text:'برای پیگیری فرصت‌های باز چه اقدام‌هایی پیشنهاد می‌کنی؟'},
    ]},
  { id:'EXECUTIVE_BRIEF', label:'بریف راهبردی', desc:'گزارش هفتگی اجرایی: جلسات، ریسک‌ها، تعهدات، فرصت‌ها', icon:<Briefcase size={16}/>,
    placeholder:'گزارش هفتگی راهبردی این هفته را آماده کن…',
    quick:[
      {label:'بریف این هفته', text:'خلاصه راهبردی هفته جاری را آماده کن'},
    ]},
];

const INTENT_BY_ID = Object.fromEntries(INTENTS.map(i=>[i.id,i]));
const CAP_FA:Record<string,string> = {
  'smart-search':'جستجوی هوشمند','meeting-brief':'بریف جلسه','meeting-summary':'خلاصهٔ جلسه',
  'action-extraction':'استخراج اقدام','commitment-extraction':'استخراج تعهد','risk-detection':'تشخیص ریسک',
  'opportunity-detection':'تشخیص فرصت','next-best-action':'اقدام بعدی','executive-brief':'بریف راهبردی','evidence':'شواهد',
};
const evLen=(ev:any,k:string)=>Array.isArray(ev?.[k])?ev[k].length:0;

type HistoryItem = { intent: string; query: string; ts: number; ok: boolean };

const HISTORY_KEY = 'srip_ai_history_v1';

export default function AI(){
  const [intent,setIntent]=useState('SMART_SEARCH');
  const [query,setQuery]=useState('');
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [history,setHistory]=useState<HistoryItem[]>([]);
  const [status,setStatus]=useState<any>(null);
  const [usage,setUsage]=useState<any>(null);
  const [providerHealth,setProviderHealth]=useState<any>(null);
  const [showMeta,setShowMeta]=useState(false);
  const resultRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    try{ setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY)??'[]')); }catch{}
    apiGet('/ai/status').then(setStatus).catch(()=>{});
    apiGet('/ai/usage').then(setUsage).catch(()=>{});
    apiGet('/ai/provider-health').then(setProviderHealth).catch(()=>{});
  },[]);

  const meta = INTENT_BY_ID[intent];

  /** Core execution — used by send, quick chips and history replay. */
  function execute(text:string, recordHistory:boolean, intentOverride?:string){
    const useIntent = intentOverride ?? intent;
    setBusy(true); setError(''); setResult(null);
    api('/ai/query',{method:'POST',body:JSON.stringify({intent:useIntent,query:text})})
      .then((r:any)=>{
        setResult(r);
        if(recordHistory){
          const next=[{intent:useIntent,query:text,ts:Date.now(),ok:true},...history.filter(h=>h.query!==text)].slice(0,12);
          setHistory(next);
          try{ localStorage.setItem(HISTORY_KEY,JSON.stringify(next)); }catch{}
        }
        setTimeout(()=>resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),60);
      })
      .catch(x=>setError((x as Error).message))
      .finally(()=>setBusy(false));
  }

  function ask(){
    const text=query.trim();
    if(!text || busy) return;
    execute(text, true);
  }

  function runQuick(text:string){
    if(busy) return;
    setQuery(text);
    execute(text, true);
  }

  function pickHistory(h:HistoryItem){
    if(busy) return;
    setIntent(h.intent);
    setQuery(h.query);
    execute(h.query, false, h.intent);
  }

  const usageTotal = useMemo(()=>{
    if(!usage) return null;
    const c=usage._count?._all??0;
    return {queries:c};
  },[usage]);

  const evidence = result?.evidence;
  const body = result?.result;
  const safety = result?.safety;
  const model = result?.model;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="دستیار هوش مصنوعی"
        title="دستیار هوشمند روابط"
        description="پرس‌وجو با ۹ قابلیت آماده — موتور قطعی (قاعده‌بنیان) پاسخ می‌دهد؛ بدون نیاز به مدل خارجی، با رعایت کامل محدودهٔ دسترسی."
        actions={
          <>
            <span className="chip success"><CheckCircle2 size={12}/> موتور: {status?.provider==='deterministic'?'قطعی داخلی':(status?.provider??'قطعی داخلی')}</span>
            <span className="chip info"><Cpu size={12}/> مدل خارجی: {model?.externalCall===true?'فعال':'غیرفعال'}</span>
          </>
        }
      />

      <div className="ai-layout">
        {/* ============ Sidebar: intents ============ */}
        <aside className="ai-side">
          <div className="section-card" style={{gap:10}}>
            <div className="section-head" style={{alignItems:'center'}}>
              <h2 style={{fontSize:14}}><Wand2 size={16}/> قابلیت‌های دستیار</h2>
            </div>
            <div className="ai-intent-list">
              {INTENTS.map(it=>(
                <button key={it.id} className={`ai-intent ${intent===it.id?'active':''}`} onClick={()=>{ setIntent(it.id); setQuery(''); setResult(null); }} aria-pressed={intent===it.id}>
                  <span className="ai-intent-ico">{it.icon}</span>
                  <span><b>{it.label}</b><small>{it.desc}</small></span>
                </button>
              ))}
            </div>
          </div>

          {history.length>0 && (
            <div className="section-card" style={{gap:8}}>
              <div className="section-head" style={{alignItems:'center'}}>
                <h2 style={{fontSize:13.5}}><History size={15}/> پرس‌وجوهای اخیر</h2>
                <button className="btn btn-ghost btn-sm" onClick={()=>{ setHistory([]); try{localStorage.removeItem(HISTORY_KEY);}catch{} }}>پاک‌کردن</button>
              </div>
              <div className="ai-history">
                {history.slice(0,8).map(h=>(
                  <button className="ai-history-item" key={h.ts+'-'+h.query} onClick={()=>pickHistory(h)} title={h.query}>
                    <Search size={13}/>
                    <span className="hq">{h.query}</span>
                    <span className="ht">{new Date(h.ts).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {usageTotal && (
            <div className="ai-status-bar" style={{gridTemplateColumns:'1fr'}}>
              <div className="ai-status-item">
                <span className="st-ico"><Database size={14}/></span>
                <div><b>{usageTotal.queries.toLocaleString('fa-IR')} پرس‌وجو</b><span>کل درخواست‌های ثبت‌شده</span></div>
              </div>
              <div className="ai-status-item">
                <span className="st-ico"><Clock size={14}/></span>
                <div><b>{usage?._sum?.estimatedCost??0}</b><span>هزینهٔ تخمینی (۰ = موتور داخلی)</span></div>
              </div>
            </div>
          )}
        </aside>

        {/* ============ Main: composer + results ============ */}
        <div className="ai-main">
          <div className="ai-composer">
            <div className="composer-head">
              <h2><Sparkles size={16}/> {meta.label}</h2>
              <span className="chip success"><CheckCircle2 size={12}/> آماده</span>
            </div>
            <div className="ai-quick-chips" aria-label="نمونه پرس‌وجوهای سریع">
              {meta.quick.map(q=>(
                <button key={q.label} className="ai-quick-chip" onClick={()=>runQuick(q.text)} disabled={busy}>
                  <Zap size={12}/> {q.label}
                </button>
              ))}
            </div>
            <div className="ai-input-row">
              <textarea
                value={query}
                onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)) ask(); }}
                placeholder={meta.placeholder}
                aria-label="متن پرس‌وجو"
                disabled={busy}
              />
              <button className="ai-send-btn" onClick={()=>ask()} disabled={busy||!query.trim()}>
                <Send size={19}/>
                <span>{busy?'در حال…':'ارسال'}</span>
              </button>
            </div>
            <div className="ai-hint">
              <Info size={12}/> این قابلیت به‌صورت قطعی (بدون هوش مصنوعی خارجی) کار می‌کند؛ پاسخ‌ها از داده‌های مجاز شما ساخته می‌شوند. برای ارسال: کنترل + اینتر
            </div>
          </div>

          {error && <div className="error-card" role="alert">{error}</div>}

          {busy && !result && (
            <div className="ai-msg assistant">
              <span className="msg-avatar"><Sparkles size={15}/></span>
              <div className="msg-body" style={{maxWidth:420}}>
                <div className="ai-typing" aria-label="در حال تحلیل"><i/><i/><i/></div>
                <span className="t-muted" style={{fontSize:11}}>موتور قطعی در حال بازیابی شواهد مجاز و تحلیل…</span>
              </div>
            </div>
          )}

          <div ref={resultRef} className="ai-conversation">
            {result && (
              <div className="ai-msg assistant">
                <span className="msg-avatar"><Sparkles size={15}/></span>
                <div className="msg-body">
                  <div className="msg-meta">
                    <span className="intent-tag">{INTENT_BY_ID[result.intent]?.label ?? result.intent}</span>
                    <span className="model-tag">{model?.provider==='deterministic'?'موتور قطعی داخلی':(model?.provider ?? 'موتور قطعی داخلی')}</span>
                    {model?.externalCall===false && <span className="chip success">بدون مدل خارجی</span>}
                    {safety?.permissionAwareRetrieval && <span className="chip info">محدودهٔ دسترسی رعایت شد</span>}
                    <time>{new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}</time>
                  </div>

                  {/* Structured result rendering */}
                  {body?.text && <div className="ai-prose">{body.text}</div>}

                  {body?.type==='smart_search' && (
                    <ResultMatches evidence={evidence}/>
                  )}

                  {body?.type==='meeting_brief' && (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {body?.meeting && (
                        <div className="ai-match-card">
                          <Link href={`/meetings/${body.meeting.id}`}>{body.meeting.title}</Link>
                          <p>{body.meeting.objective??'بدون هدف ثبت‌شده'}</p>
                          <div className="match-meta">
                            {body.meeting.startAt&&<span><CalendarCheck size={12}/> {new Date(body.meeting.startAt).toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'})}</span>}
                            {body.meeting.organization&&<Link href={`/organizations/${body.meeting.organization.id}`} style={{display:'inline-flex',alignItems:'center',gap:4}}><Link2 size={12}/> {body.meeting.organization.name}</Link>}
                          </div>
                        </div>
                      )}
                      {(body?.participants?.length??0)>0 && (
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          <span className="t-muted" style={{fontSize:11,fontWeight:800}}>شرکت‌کنندگان ({body.participants.length})</span>
                          <div className="ai-result-grid">
                            {body.participants.map((p:string,i:number)=><span className="ai-evidence-chip" key={i}><Users size={12}/> {p}</span>)}
                          </div>
                        </div>
                      )}
                      {(body?.actions?.length>0||body?.commitments?.length>0) && (
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          <span className="t-muted" style={{fontSize:11,fontWeight:800}}>پروندهٔ بازِ رابطه (قبل از جلسه بررسی شود):</span>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:8}}>
                            {(body.actions??[]).map((a:any)=>(
                              <div className="ai-candidate" key={a.id}><ListChecks size={14}/>
                                <div><Link href={`/actions/${a.id}`} style={{fontSize:12}}>{a.title}</Link>
                                <div className="t-muted" style={{fontSize:10.5}}>اقدام {a.status==='OPEN'?'باز':'در جریان'}{a.dueAt?` · موعد ${new Date(a.dueAt).toLocaleDateString('fa-IR')}`:''}</div></div>
                              </div>
                            ))}
                            {(body.commitments??[]).map((c:any)=>(
                              <div className="ai-candidate" key={c.id}><ShieldCheck size={14}/>
                                <div><Link href={`/commitments/${c.id}`} style={{fontSize:12}}>{c.description}</Link>
                                <div className="t-muted" style={{fontSize:10.5}}>تعهد{c.dueAt?` · سررسید ${new Date(c.dueAt).toLocaleDateString('fa-IR')}`:''}</div></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {body?.type==='meeting_summary' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div className="ai-match-card"><b>خلاصهٔ جلسه</b><p>{body.text}</p></div>
                      {(body?.decisions?.length>0||body?.actionItems?.length>0) && (
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {(body.decisions??[]).map((d:string,i:number)=><div className="ai-suggestion" key={'d'+i}><CheckCircle2 size={14}/><span>{d}</span></div>)}
                          {(body.actionItems??[]).map((d:string,i:number)=><div className="ai-suggestion" key={'a'+i}><ListChecks size={14}/><span>{d}</span></div>)}
                        </div>
                      )}
                    </div>
                  )}

                  {(body?.type==='action_extraction'||body?.type==='commitment_extraction') && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {(body?.candidates?.length??0)>0 ? body.candidates.map((c:string,i:number)=>(
                        <div className="ai-candidate" key={i}><ListChecks size={15}/><span>{c}</span></div>
                      )) : <p className="t-muted" style={{fontSize:12}}>مورد قابل استخراجی در متن یافت نشد.</p>}
                      {body?.requires_confirmation && <span className="chip warning"><AlertTriangle size={12}/> نیازمند تأیید انسانی قبل از ایجاد رکورد</span>}
                    </div>
                  )}

                  {body?.type==='risk_detection' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {body?.summary&&<span className="t-muted" style={{fontSize:11.5}}>{body.summary}</span>}
                      {(body?.signals?.length??0)>0 ? <div className="ai-result-grid">{body.signals.map((s:string,i:number)=><span className="chip danger" key={i}><AlertTriangle size={12}/> {s}</span>)}</div>
                      : <p className="t-muted" style={{fontSize:12}}>سیگنال ریسک مشخصی در متن پیدا نشد.</p>}
                    </div>
                  )}

                  {body?.type==='opportunity_detection' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {body?.summary&&<span className="t-muted" style={{fontSize:11.5}}>{body.summary}</span>}
                      {(body?.signals?.length??0)>0 ? <div className="ai-result-grid">{body.signals.map((s:string,i:number)=><span className="chip success" key={i}><Target size={12}/> {s}</span>)}</div>
                      : <p className="t-muted" style={{fontSize:12}}>سیگنال فرصت مشخصی در متن پیدا نشد.</p>}
                    </div>
                  )}

                  {body?.type==='next_best_action' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {(body?.suggestions?.length??0)>0 ? (
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {(body.suggestions as any[]).map((sg:any,i:number)=>(
                            <div className="ai-suggestion" key={i}>
                              {sg.kind==='action'?<ListChecks size={15}/>:sg.kind==='commitment'?<ShieldCheck size={15}/>:sg.kind==='relationship'?<Link2 size={15}/>:sg.kind==='opportunity'?<Target size={15}/>:<Info size={15}/>}
                              <span style={{display:'flex',flexDirection:'column',gap:3}}>
                                <span><b>{sg.text}</b>{sg.kind!=='info'&&sg.refId&&<Link href={`/${sg.kind==='relationship'?'relationships':sg.kind==='opportunity'?'opportunities':sg.kind+'s'}/${sg.refId}`} style={{marginInlineStart:8,fontSize:11,display:'inline-flex',alignItems:'center',gap:3}}>مشاهدهٔ رکورد <ArrowLeft size={11}/></Link>}</span>
                                {sg.reason&&<span className="t-muted" style={{fontSize:11}}>{sg.reason}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="t-muted" style={{fontSize:12}}>پیشنهادی برای اقدام بعدی ساخته نشد.</p>}
                    </div>
                  )}

                  {body?.type==='executive_brief' && (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {body?.period?.start&&body?.period?.end&&(
                        <div className="ai-result-grid">
                          <span className="ai-evidence-chip"><CalendarCheck size={12}/> بازه: {new Date(body.period.start).toLocaleDateString('fa-IR')} تا {new Date(body.period.end).toLocaleDateString('fa-IR')}</span>
                        </div>
                      )}
                      {body?.summary&&(
                        <div className="ai-result-grid">
                          {body.summary.meetings>0&&<span className="ai-evidence-chip">جلسات: <b>{body.summary.meetings}</b></span>}
                          {body.summary.newOpportunities>0&&<span className="ai-evidence-chip">فرصت جدید: <b>{body.summary.newOpportunities}</b></span>}
                          {body.summary.openCommitments>0&&<span className="ai-evidence-chip">تعهد باز: <b>{body.summary.openCommitments}</b></span>}
                          {body.summary.overdueActions>0&&<span className="ai-evidence-chip">اقدام عقب‌افتاده: <b>{body.summary.overdueActions}</b></span>}
                          {body.summary.relationshipRisks>0&&<span className="ai-evidence-chip">رابطهٔ پرریسک: <b>{body.summary.relationshipRisks}</b></span>}
                        </div>
                      )}
                      {(body?.recommendations?.length??0)>0 && (
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          <span className="t-muted" style={{fontSize:11,fontWeight:800}}>اقدامات پیشنهادی:</span>
                          {(body.recommendations as string[]).map((r:string,i:number)=>(
                            <div className="ai-suggestion" key={i}><Lightbulb size={14}/><span>{r}</span></div>
                          ))}
                        </div>
                      )}
                      <Link className="btn btn-secondary" style={{alignSelf:'flex-start'}} href="/ai-executive-brief"><Briefcase size={14}/> گزارش کامل هفتگی راهبردی</Link>
                    </div>
                  )}

                  {body?.type==='risk_analysis' && (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {(body?.risks?.length??0)>0 ? (
                        (body.risks as any[]).map((rk:any)=>(
                          <div className="ai-match-card" key={rk.id} style={{gap:8}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                              <Link href={`/relationships/${rk.id}`} style={{fontSize:13.5,fontWeight:800,display:'inline-flex',alignItems:'center',gap:6}}>
                                <Link2 size={14}/> {rk.name}
                              </Link>
                              <div className="ai-result-grid" style={{gap:6}}>
                                <span className="chip danger"><AlertTriangle size={12}/> ریسک {rk.riskScore}</span>
                                <span className="chip warning">سلامت {rk.healthScore}</span>
                                {rk.status==='WATCH'&&<span className="chip info">تحت نظر</span>}
                              </div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:5}}>
                              {(rk.drivers??[]).map((d:any,i:number)=>(
                                <div className="risk-driver" key={i} style={{borderInlineStartColor:d.tone==='critical'?'var(--srip-danger,#dc2626)':d.tone==='warning'?'var(--srip-warning,#f59e0b)':'var(--srip-accent)'}}>
                                  <b>{d.label}</b>
                                  <span>{d.detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : <p className="t-muted" style={{fontSize:12}}>رابطهٔ پرریسکی یافت نشد.</p>}
                    </div>
                  )}

                  {/* Evidence summary */}
                  {evidence && ['organizations','people','relationships','meetings','interactions','actions','commitments','opportunities','projects','documentChunks'].some(k=>evLen(evidence,k)>0) && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <span className="t-muted" style={{fontSize:11,fontWeight:800}}>شواهد بازیابی‌شده (محدودهٔ مجاز):</span>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {evidence.organizations?.length>0 && <span className="ai-evidence-chip"><Database size={13}/> سازمان: <b>{evidence.organizations.length}</b></span>}
                        {evidence.people?.length>0 && <span className="ai-evidence-chip"><Users size={13}/> شخص: <b>{evidence.people.length}</b></span>}
                        {evidence.relationships?.length>0 && <span className="ai-evidence-chip"><Link2 size={13}/> رابطه: <b>{evidence.relationships.length}</b></span>}
                        {evidence.meetings?.length>0 && <span className="ai-evidence-chip"><CalendarCheck size={13}/> جلسه: <b>{evidence.meetings.length}</b></span>}
                        {evidence.interactions?.length>0 && <span className="ai-evidence-chip"><Zap size={13}/> تعامل: <b>{evidence.interactions.length}</b></span>}
                        {evidence.actions?.length>0 && <span className="ai-evidence-chip"><ListChecks size={13}/> اقدام: <b>{evidence.actions.length}</b></span>}
                        {evidence.commitments?.length>0 && <span className="ai-evidence-chip"><ShieldCheck size={13}/> تعهد: <b>{evidence.commitments.length}</b></span>}
                        {evidence.opportunities?.length>0 && <span className="ai-evidence-chip"><Target size={13}/> فرصت: <b>{evidence.opportunities.length}</b></span>}
                        {evidence.projects?.length>0 && <span className="ai-evidence-chip"><Briefcase size={13}/> پروژه: <b>{evidence.projects.length}</b></span>}
                        {evidence.documentChunks?.length>0 && <span className="ai-evidence-chip"><FileText size={13}/> سند: <b>{evidence.documentChunks.length}</b></span>}
                      </div>
                    </div>
                  )}

                  {/* Safety strip */}
                  <div className="ai-safety">
                    <span className="chip success"><ShieldCheck size={12}/> آگاه از مجوز</span>
                    {safety?.humanConfirmationRequired===true && <span className="chip warning">تأیید انسانی لازم است</span>}
                    {safety?.humanConfirmationRequired===false && <span className="chip neutral">نیازی به تأیید ندارد</span>}
                    {result?.status && <span className="chip info" style={{direction:'ltr'}}>{result.status}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Engine meta (collapsible) */}
          <div className="section-card" style={{gap:10}}>
            <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}} onClick={()=>setShowMeta(s=>!s)}>
              <Info size={14}/> {showMeta?'بستن جزئیات موتور':'جزئیات موتور و شفافیت'}
            </button>
            {showMeta && (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div className="ai-note">
                  <Sparkles size={15}/>
                  <span>
                    این دستیار به‌صورت <b>قاعده‌بنیان (قطعی)</b> کار می‌کند: ابتدا شواهد فقط از داده‌های در محدودهٔ دسترسی شما بازیابی می‌شود،
                    سپس با قوانین شفاف تحلیل و پاسخ ساخته می‌شود. در صورت پیکربندی کلید امن سمت سرور، امکان اتصال به مدل خارجی
                    نیز وجود دارد؛ اما <b>هیچ عملکردی به آن وابسته نیست</b>.
                  </span>
                </div>
                {status && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                    <div className="ai-status-item"><span className="st-ico"><Cpu size={14}/></span><div><b>{status.provider==='deterministic'?'موتور قطعی داخلی':status.provider}</b><span>سرویس‌دهنده فعال</span></div></div>
                    <div className="ai-status-item"><span className="st-ico"><Zap size={14}/></span><div><b>{status.capabilities?.length??0} قابلیت</b><span>{status.capabilities?.slice(0,3).map((c:string)=>CAP_FA[c]??c).join('، ')}{(status.capabilities?.length??0)>3?' و موارد دیگر':''}</span></div></div>
                    <div className="ai-status-item"><span className="st-ico"><ShieldCheck size={14}/></span><div><b>{status.safeguards?.length??0} محافظ</b><span>مجوز · محدودهٔ دسترسی · ممیزی · تأیید انسانی</span></div></div>
                    <div className="ai-status-item"><span className="st-ico"><Database size={14}/></span><div><b>{providerHealth?.ok===true?'سالم':'تنظیم نشده'}</b><span>ارائه‌دهندهٔ خارجی — همهٔ پردازش‌ها داخلی است</span></div></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* Renders SMART_SEARCH matches grouped by entity type */
type MatchItem = {id:string; name?:string; title?:string; subject?:string; description?:string; firstName?:string; lastName?:string; summary?:string; objective?:string; type?:string; status?:string; startAt?:string; occurredAt?:string; dueAt?:string; probability?:number; organization?:any; relationship?:any};
const MATCH_GROUPS:[string,string,string][] = [
  ['organizations','سازمان‌ها','/organizations/'],
  ['people','اشخاص','/people/'],
  ['relationships','روابط','/relationships/'],
  ['meetings','جلسات','/meetings/'],
  ['interactions','تعاملات','/interactions/'],
  ['actions','اقدامات','/actions/'],
  ['commitments','تعهدات','/commitments/'],
  ['opportunities','فرصت‌ها','/opportunities/'],
  ['projects','پروژه‌ها','/projects/'],
];
const groupTitle=(g:any,kind:string)=>{
  if(kind==='organizations') return g.name??'—';
  if(kind==='people') return `${g.firstName??''} ${g.lastName??''}`.trim()||'—';
  if(kind==='relationships') return `${g.name??((g.sourceOrganization?.name??'—')+' ↔ '+(g.targetOrganization?.name??'—'))}`;
  if(kind==='meetings') return g.title??'—';
  if(kind==='interactions') return g.subject??'—';
  if(kind==='actions') return g.title??'—';
  if(kind==='commitments') return g.description??'—';
  if(kind==='opportunities') return g.name??'—';
  return g.name??'—';
};
const groupSub=(g:any,kind:string)=>{
  if(kind==='organizations') return fa(g.type)??'—';
  if(kind==='people') return [g.title,g.organization?.name].filter(Boolean).join(' · ');
  if(kind==='relationships') return [fa(g.relationshipType),`سلامت ${g.healthScore}`].filter(Boolean).join(' · ');
  if(kind==='meetings') return g.startAt?new Date(g.startAt).toLocaleDateString('fa-IR'):'—';
  if(kind==='interactions') return g.occurredAt?new Date(g.occurredAt).toLocaleDateString('fa-IR'):'—';
  if(kind==='actions') return [g.status?fa(g.status):'',g.priority?'اولویت '+fa(g.priority):''].filter(Boolean).join(' · ');
  if(kind==='commitments') return [g.status?fa(g.status):'',g.dueAt?'سررسید '+new Date(g.dueAt).toLocaleDateString('fa-IR'):''].filter(Boolean).join(' · ');
  if(kind==='opportunities') return [g.status?fa(g.status):'',g.probability!=null?`${g.probability}٪ احتمال`:''].filter(Boolean).join(' · ');
  return g.status?fa(g.status):'';
};
function ResultMatches({evidence}:{evidence:any}){
  if(!evidence) return null;
  const groups=MATCH_GROUPS.map(([k,label,base])=>({k,label,base,items:evidence[k]??[]})).filter(x=>x.items.length>0);
  if(!groups.length)
    return <p className="t-muted" style={{fontSize:12.5}}>موردی مطابق پرس‌وجو در محدودهٔ مجاز یافت نشد.</p>;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {groups.map(grp=>(
        <div key={grp.k}>
          <span className="t-muted" style={{fontSize:11,fontWeight:800}}>{grp.label} ({grp.items.length})</span>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:8,marginTop:6}}>
            {grp.items.map((o:any)=>(
              <div className="ai-match-card" key={o.id}>
                <Link href={`${grp.base}${o.id}`}>{groupTitle(o,grp.k)}</Link>
                {(o.objective||o.summary||o.description)&&<p>{o.objective??o.summary??o.description}</p>}
                <div className="match-meta"><span>{groupSub(o,grp.k)}</span></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
