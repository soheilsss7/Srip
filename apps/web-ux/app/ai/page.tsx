'use client';
import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { fa } from '../_lib/fa';
import { PageHeader, Segmented, Modal } from '../_components/page-ui';
import IntelHub from '../_components/intel-hub';
import {
  Sparkles, Search, CalendarCheck, FileText, ListChecks, ShieldCheck, AlertTriangle, Target,
  Lightbulb, Briefcase, Send, History, Cpu, Zap, Database, Clock, Wand2, CheckCircle2, Info,
  Users, ArrowLeft, Link2, KeyRound, PlugZap, Pencil, Trash2, Plus, Server, Cloud, Copy, Activity,
  ClipboardCheck,
} from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۶.۱ — پنل «درگاه هوش مصنوعی»: ارائه‌دهنده‌های per-tenant با دو مسیر
   لوکال (بدون هیچ سرویس بیرونی) و کلید API. کلید فقط یک‌بار هنگام ثبت/چرخش
   نمایش داده می‌شود و پس از آن تنها ۴ رقم آخر دیده می‌شود (۱۹.۱ و ۱۹.۴ سند v6).
   ═══════════════════════════════════════════════════════════════════════ */
const AI_MODE_FA=lt<Record<string,string>>({LOCAL:'مسیر لوکال',API_KEY:'مسیر کلید API'});
const AI_KIND_FA=lt<Record<string,string>>({BUILTIN:'موتور داخلی (قطعی)',OPENAI_COMPATIBLE:'سازگار-OpenAI',ANTHROPIC:'Anthropic',GEMINI:'Gemini'});
const AI_STATUS_FA=lt<Record<string,string>>({ACTIVE:'فعال',INACTIVE:'غیرفعال',UNREACHABLE:'در دسترس نیست'});
const AI_STATUS_CHIP:Record<string,string>={ACTIVE:'success',INACTIVE:'neutral',UNREACHABLE:'danger'};
const AI_APP_FA=lt<Record<string,string>>({'org-question':'پرسش سازمانی','meeting-assist':'دستیار جلسه','dd-review':'دستیار Due Diligence','opp-priority':'اولویت‌بندی فرصت','next-action':'پیشنهاد اقدام بعدی','content-draft':'تولید محتوا','authority-monitor':'پایش مرجعیت','authenticity':'تشخیص اصالت'});
/* گام ۹.۱ — F12 */
const F12_DECISION_FA=lt<Record<string,string>>({APPROVED:'تأیید',CONDITIONAL:'مشروط',REJECTED:'رد'});
const F12_RESULT_FA=lt<Record<string,string>>({PASS:'قبول',FAIL:'مردود'});
const emptyProviderForm={name:'',mode:'LOCAL',kind:'OPENAI_COMPATIBLE',baseUrl:'',model:''};

function GatewayPanel(){
  const [providers,setProviders]=useState<any[]>([]);
  const [rule,setRule]=useState('');
  const [error,setError]=useState('');
  const [health,setHealth]=useState<Record<string,any>>({});
  const [busyId,setBusyId]=useState('');
  const [keyFor,setKeyFor]=useState<any>(null);
  const [keyInput,setKeyInput]=useState('');
  const [keyResult,setKeyResult]=useState<any>(null);
  const [editFor,setEditFor]=useState<any>(null);
  const [createForm,setCreateForm]=useState<any>(null);
  /* گام ۶.۲ — مسیریابی کاربردها + خط‌مشی کنترل داده */
  const [routing,setRouting]=useState<any>(null);
  const [policy,setPolicy]=useState<any>(null);
  const [rowDraft,setRowDraft]=useState<Record<string,any>>({});
  const [pvText,setPvText]=useState('قرارداد محرمانه — کد ملی 1234567890، موبایل 09121234567 و شبا IR123456789012345678901234 در متن.');
  const [pvMode,setPvMode]=useState<'LOCAL'|'API_KEY'>('API_KEY');
  const [pv,setPv]=useState<any>(null);
  /* گام ۶.۳ — پایش فنی و کلید توقف */
  const [gw,setGw]=useState<any>(null);
  /* گام ۹.۱ — F12 کارت کاربرد و ارزیابی AI */
  const [useCases,setUseCases]=useState<any>(null);
  const [f12For,setF12For]=useState<any>(null); /* کارت باز‌شده */
  const [f12Run,setF12Run]=useState<any>(null); /* فرم اجرای آزمون */
  const [f12Dec,setF12Dec]=useState<any>(null); /* فرم تصمیم انتشار */
  /* گام ۹.۲ — شناسنامهٔ مدل (F17) */
  const [modelCards,setModelCards]=useState<any>(null);
  const [mcEdit,setMcEdit]=useState<any>(null);
  /* گام ۷.۱ — نمایهٔ معنایی و جست‌وجوی ترکیبی */
  const [ragIndex,setRagIndex]=useState<any>(null);
  const [ragQuery,setRagQuery]=useState('');
  const [ragResults,setRagResults]=useState<any>(null);
  const [calls,setCalls]=useState<any[]>([]);
  const [usageG,setUsageG]=useState<any>(null);
  const [haltFor,setHaltFor]=useState<any>(null); /* {scope:'GLOBAL'|appKey} */
  const [haltReason,setHaltReason]=useState('');

  function reload(){
    apiGet('/ai/providers').then((r:any)=>{
      setProviders(r.items??[]); setRule(String(r.rule??''));
    }).catch(x=>setError((x as Error).message));
    apiGet('/ai/routing').then((r:any)=>{setRouting(r);setRowDraft({});}).catch(()=>{});
    apiGet('/ai/data-policy').then(setPolicy).catch(()=>{});
    apiGet('/ai/gateway').then(setGw).catch(()=>{});
    apiGet('/ai/calls').then((r:any)=>setCalls(r.items??[])).catch(()=>{});
    apiGet('/ai/usage').then((r:any)=>setUsageG(r?.gateway??null)).catch(()=>{});
    apiGet('/ai/rag/index').then(setRagIndex).catch(()=>{});
    apiGet('/ai/use-cases').then((r:any)=>{setUseCases(r);setF12For((f:any)=>f?(r.items??[]).find((c:any)=>c.id===f.id)??f:f);}).catch(()=>{});
    apiGet('/ai/model-cards').then(setModelCards).catch(()=>{});
  }
  useEffect(()=>{reload();},[]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runHealth(p:any){
    setBusyId(p.id); setError('');
    try{ const r=await api(`/ai/providers/${p.id}/health`,{method:'POST'});
      setHealth(h=>({...h,[p.id]:r})); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function saveKey(){
    setBusyId('key'); setError('');
    try{
      const r=await api(`/ai/providers/${keyFor.id}/key`,{method:'POST',body:JSON.stringify({key:keyInput})});
      setKeyResult(r); setKeyInput(''); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function saveEdit(){
    setBusyId('edit'); setError('');
    try{
      await api(`/ai/providers/${editFor.id}`,{method:'PATCH',body:JSON.stringify({
        name:editFor.name,baseUrl:editFor.baseUrl,model:editFor.model})});
      setEditFor(null); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function createProvider(){
    setBusyId('create'); setError('');
    try{
      await api('/ai/providers',{method:'POST',body:JSON.stringify(createForm)});
      setCreateForm(null); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function removeProvider(p:any){
    setBusyId(p.id); setError('');
    try{ await api(`/ai/providers/${p.id}`,{method:'DELETE'}); reload(); }
    catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }

  async function saveRoute(appKey:string){
    const d=rowDraft[appKey]; if(!d) return;
    setBusyId('route-'+appKey); setError('');
    try{
      await api('/ai/routing',{method:'PATCH',body:JSON.stringify({application:appKey,
        providerId:d.providerId,model:d.model,fallbackProviderId:d.fallbackProviderId??'',fallbackModel:d.fallbackModel})});
      reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function togglePattern(key:string,val:boolean){
    setError('');
    try{
      const r:any=await api('/ai/data-policy',{method:'PATCH',body:JSON.stringify({patterns:{[key]:val}})});
      setPolicy((p:any)=>({...p,...r}));
    }catch(x:any){ setError(x.message); }
  }
  async function runPreview(){
    setBusyId('preview'); setError('');
    try{ const r=await api('/ai/data-policy/preview',{method:'POST',body:JSON.stringify({text:pvText,mode:pvMode})});
      setPv(r);
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }

  async function runRagSearch(){
    if(!ragQuery.trim()) return;
    setBusyId('rag'); setError('');
    try{ const r=await api('/ai/rag/search',{method:'POST',body:JSON.stringify({query:ragQuery,limit:10})});
      setRagResults(r);
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }

  async function setGateway(body:any){
    setBusyId('gateway'); setError('');
    try{ await api('/ai/gateway',{method:'PATCH',body:JSON.stringify(body)}); reload(); }
    catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function submitHalt(){
    if(!haltFor) return;
    setBusyId('gateway'); setError('');
    try{
      const body=haltFor==='GLOBAL'
        ?{status:'HALTED',reason:haltReason}
        :{application:haltFor,halted:true,reason:haltReason};
      await api('/ai/gateway',{method:'PATCH',body:JSON.stringify(body)});
      setHaltFor(null); setHaltReason(''); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }

  /* گام ۹.۱ — F12: ثبت اجرای آزمون و تصمیم انتشار */
  async function f12TestRun(card:any){
    if(!f12Run?.result) return;
    setBusyId('f12-'+card.id); setError('');
    try{
      await api(`/ai/use-cases/${card.id}`,{method:'POST',body:JSON.stringify({result:f12Run.result,findings:f12Run.findings??''})});
      setF12Run(null); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }
  async function f12SaveDecision(card:any){
    if(!f12Dec?.releaseDecision) return;
    setBusyId('f12d-'+card.id); setError('');
    try{
      await api(`/ai/use-cases/${card.id}`,{method:'PATCH',body:JSON.stringify({releaseDecision:f12Dec.releaseDecision,rollback:f12Dec.rollback??card.rollback})});
      setF12Dec(null); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }

  /* گام ۹.۲ — ذخیرهٔ شناسنامهٔ مدل */
  async function mcSave(){
    if(!mcEdit) return;
    setBusyId('mc-'+mcEdit.id); setError('');
    try{
      await api(`/ai/model-cards/${mcEdit.id}`,{method:'PATCH',body:JSON.stringify({version:mcEdit.version,limitations:mcEdit.limitations})});
      setMcEdit(null); reload();
    }catch(x:any){ setError(x.message); } finally{ setBusyId(''); }
  }

  const active=providers.filter(p=>p.status==='ACTIVE').length;
  const unreachable=providers.filter(p=>p.status==='UNREACHABLE').length;
  const inactive=providers.filter(p=>p.status==='INACTIVE').length;

  return (
    <div className="ai-composer gateway-panel">
      <div className="composer-head">
        <h2><Server size={16}/> {t('درگاه هوش مصنوعی — دو مسیر')}</h2>
        <span className="chip success"><CheckCircle2 size={12}/> {t('مسیر لوکال همیشه در دسترس')}</span>
      </div>
      <p className="ai-hint" style={{margin:0}}>
        <Info size={12}/> {t('هیچ جزئی از سامانه مستقیم به مدل وصل نمی‌شود؛ همه‌چیز از درگاه می‌گذرد. مسیر لوکال (موتور داخلی قطعی یا Ollama و هر endpoint سازگار-OpenAI روی دستگاه) بدون هیچ سرویس بیرونی کار می‌کند و مسیر کلید API، ارائه‌دهندهٔ ابری را با کلید محفوظ اضافه می‌کند.')}
      </p>
      {error && <div className="banner error" role="alert" style={{display:'flex',gap:8,alignItems:'center'}}><AlertTriangle size={14}/> {error}</div>}

      <div className="ai-quick-chips" aria-label={t('خلاصهٔ وضعیت درگاه')}>
        <span className="chip success">{t('فعال')}: {fa(active)}</span>
        <span className="chip neutral">{t('غیرفعال')}: {fa(inactive)}</span>
        <span className="chip danger">{t('در دسترس نیست')}: {fa(unreachable)}</span>
        <button className="ai-quick-chip" style={{borderStyle:'dashed'}} onClick={()=>setCreateForm({...emptyProviderForm})}>
          <Plus size={12}/> {t('افزودن ارائه‌دهنده')}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>{t('ارائه‌دهنده')}</th><th>{t('مسیر')}</th><th>{t('نوع')}</th>
            <th>{t('نشانی و مدل')}</th><th>{t('وضعیت')}</th><th>{t('کلید')}</th><th>{t('عملیات')}</th>
          </tr></thead>
          <tbody>
            {providers.map((p:any)=>(
              <Fragment key={p.id}>
                <tr className="gw-row" data-provider={p.id}>
                  <td className="t-primary">{p.name}{p.builtin && <span className="chip info" style={{marginInlineStart:6}}>{t('همیشه فعال — حذف نمی‌شود')}</span>}</td>
                  <td><span className={`chip ${p.mode==='LOCAL'?'info':'purple'}`}>{p.mode==='LOCAL'?<Server size={11}/>:<Cloud size={11}/>} {AI_MODE_FA[p.mode]??p.mode}</span></td>
                  <td>{AI_KIND_FA[p.kind]??p.kind}</td>
                  <td className="t-muted" style={{fontSize:11.5}}>
                    {p.baseUrl??t('بدون شبکه — داخل مرورگر')}
                    {p.model?` · ${p.model}`:''}
                  </td>
                  <td><span className={`chip ${AI_STATUS_CHIP[p.status]??'neutral'}`}>{AI_STATUS_FA[p.status]??p.status}</span></td>
                  <td className="t-muted">{p.mode==='API_KEY'?(p.hasKey?`••••${p.keyLast4}`:t('ثبت نشده')):t('—')}</td>
                  <td>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>runHealth(p)} disabled={busyId===p.id} title={t('آزمون اتصال')}><PlugZap size={13}/> {busyId===p.id?t('…'):t('آزمون اتصال')}</button>
                      {p.mode==='API_KEY' && <button className="btn btn-ghost btn-sm" onClick={()=>{setKeyFor(p);setKeyResult(null);setKeyInput('');}} title={t('ثبت/چرخش کلید')}><KeyRound size={13}/> {t('کلید')}</button>}
                      {!p.builtin && <button className="btn btn-ghost btn-sm" onClick={()=>setEditFor({...p})} title={t('ویرایش')}><Pencil size={13}/></button>}
                      {!p.builtin && <button className="btn btn-ghost btn-sm" onClick={()=>removeProvider(p)} disabled={busyId===p.id} title={t('حذف')}><Trash2 size={13}/></button>}
                    </div>
                  </td>
                </tr>
                {health[p.id] && (
                  <tr className="gw-health-row"><td colSpan={7}>
                    <div className={`banner ${health[p.id].ok?'success':'error'}`} style={{display:'flex',gap:8,alignItems:'flex-start',margin:0}}>
                      {health[p.id].ok?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>}
                      <span>
                        <b>{t('آزمون اتصال')} «{p.name}»:</b> {health[p.id].ok?t('موفق'):t('ناموفق')}
                        {health[p.id].ok?` — ${fa((health[p.id].models??[]).length)} ${t('مدل')}`:''}
                        {` (${fa(health[p.id].latencyMs ?? 0)}${t('میلی‌ثانیه')})`}
                        {(health[p.id].models??[]).length>0 && <span className="t-muted" style={{marginInlineStart:6}}>{(health[p.id].models??[]).join(' · ')}</span>}
                        <span className="t-muted" style={{display:'block',marginTop:2}}>{health[p.id].detail}</span>
                      </span>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rule && <p className="field-hint">{rule}</p>}

      {/* ═══ گام ۶.۲ — مسیریابی کاربردها (لوکال-اول، ابری جایگزین) ═══ */}
      <div className="composer-head" style={{marginTop:18}}>
        <h2><Target size={16}/> {t('مسیریابی کاربردها — لوکال اول، ابری جایگزین')}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>{t('کاربرد')}</th><th>{t('ارائه‌دهنده و مدل اصلی')}</th><th>{t('جایگزین')}</th><th>{t('وضعیت مسیر')}</th><th></th>
          </tr></thead>
          <tbody>
            {(routing?.items??[]).map((r:any)=>(
              <tr key={r.application} className="gw-route-row" data-app={r.application}>
                <td className="t-primary">{r.label}</td>
                <td>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <select value={rowDraft[r.application]?.providerId??r.providerId??''}
                      onChange={e=>setRowDraft((d)=>({...d,[r.application]:{...d[r.application],providerId:e.target.value}}))}>
                      {(routing?.providers??[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input style={{width:150}} dir="ltr" placeholder={t('مدل')}
                      value={rowDraft[r.application]?.model??r.model??''}
                      onChange={e=>setRowDraft((d)=>({...d,[r.application]:{...d[r.application],model:e.target.value}}))} />
                  </div>
                </td>
                <td>
                  <select value={rowDraft[r.application]?.fallbackProviderId??r.fallbackProviderId??''}
                    onChange={e=>setRowDraft((d)=>({...d,[r.application]:{...d[r.application],fallbackProviderId:e.target.value}}))}>
                    <option value="">{t('— بدون جایگزین')}</option>
                    {(routing?.providers??[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td>
                  {r.usable
                    ?<span className="chip success">{t('در دسترس')}</span>
                    :<span className="chip danger">{t('مسیر فعال ندارد — کلید ثبت نشده')}</span>}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={()=>saveRoute(r.application)}
                    disabled={!rowDraft[r.application]||busyId==='route-'+r.application}>
                    {busyId==='route-'+r.application?t('…'):t('ذخیرهٔ مسیر')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {routing?.rule && <p className="field-hint">{routing.rule}</p>}

      {/* ═══ گام ۹.۱ — F12 کارت کاربرد و ارزیابی AI ═══ */}
      <div className="composer-head" style={{marginTop:18}}>
        <h2><ClipboardCheck size={16}/> {t('کارت کاربرد و ارزیابی AI (F12)')}</h2>
        {useCases&&(useCases.coverage?.missing?.length
          ?<span className="chip danger">{t('کاربرد بدون کارت')}: {fa(useCases.coverage.missing.length)}</span>
          :<span className="chip success">{t('هر کاربرد فعال درگاه کارت دارد')}</span>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>{t('کاربرد')}</th><th>{t('سطح اختیار')}</th><th>{t('مدل (زنده)')}</th><th>{t('تصمیم انتشار')}</th><th>{t('آخرین آزمون')}</th><th></th>
          </tr></thead>
          <tbody>
            {(useCases?.items??[]).map((c:any)=>(
              <tr key={c.id} data-f12={c.application}>
                <td className="t-primary">{AI_APP_FA[c.application]??c.application}</td>
                <td><span className="chip neutral">{c.authority}</span></td>
                <td dir="ltr" className="t-muted">{c.providerName} — {c.model}</td>
                <td><span className={`chip ${c.releaseDecision==='APPROVED'?'success':c.releaseDecision==='CONDITIONAL'?'warning':'danger'}`}>{F12_DECISION_FA[c.releaseDecision]??c.releaseDecision}</span></td>
                <td>{c.lastTestResult
                  ?<span className={`chip ${c.lastTestResult==='PASS'?'success':'danger'}`}>{F12_RESULT_FA[c.lastTestResult]??c.lastTestResult}</span>
                  :<span className="chip neutral">{t('ثبت نشده')}</span>}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>{setF12For(c);setF12Run(null);setF12Dec(null);}}>{t('کارت F12')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {useCases?.rule && <p className="field-hint">{useCases.rule}</p>}

      {/* جزئیات کارت F12 — هر سیزده ستون + فرم آزمون/تصمیم */}
      <Modal open={!!f12For} title={`${t('کارت F12')} — ${f12For?(AI_APP_FA[f12For.application]??f12For.application):''}`}
        description={f12For?`${t('سطح اختیار')}: ${f12For.authority}`:undefined}
        onClose={()=>{setF12For(null);setF12Run(null);setF12Dec(null);}}>
        {f12For&&(<div className="list">
          <div className="panel-title"><div><h2>{t('مشخصات کاربرد (۱۹.۲)')}</h2></div>
            <span className={`chip ${f12For.status==='ACTIVE'?'success':'warning'}`}>{f12For.status==='ACTIVE'?t('فعال'):t('متوقف')}</span></div>
          <div className="listRow"><span style={{flex:1}}>
            <strong>{t('مسئله')}</strong><small style={{display:'block'}}>{f12For.problem}</small>
            <strong>{t('کاربر')}</strong><small style={{display:'block'}}>{f12For.user}</small>
            <strong>{t('دادهٔ مجاز')}</strong><small style={{display:'block'}}>{f12For.allowedData}</small>
            <strong>{t('ابزار')}</strong><small style={{display:'block'}}>{f12For.tool}</small>
            <strong>{t('روش بازیابی')}</strong><small style={{display:'block'}}>{f12For.retrieval}</small>
            <strong>{t('مجموعهٔ آزمون')}</strong><small style={{display:'block'}}>{f12For.testSet?.name} — {fa(f12For.testSet?.cases)} {t('مورد')}</small>
            <strong>{t('میزان اتکای پاسخ به منبع')}</strong><small style={{display:'block'}}>{f12For.sourceReliance}</small>
            <strong>{t('امنیت')}</strong><small style={{display:'block'}}>{f12For.security}</small>
            <strong>{t('تأیید انسانی')}</strong><small style={{display:'block'}}>{f12For.humanConfirm}</small>
            <strong>{t('روش بازگشت ایمن')}</strong><small style={{display:'block'}}>{f12For.rollback}</small>
            <strong>{t('مدل (زنده)')}</strong><small style={{display:'block',direction:'ltr'}}>{f12For.providerName} — {f12For.model}</small>
          </span></div>
          {(f12For.testRuns??[]).length>0&&(<div className="panel-title"><div><h2>{t('اجراهای اخیر آزمون')}</h2></div></div>)}
          {(f12For.testRuns??[]).slice(0,5).map((r:any)=>(
            <div className="listRow" key={r.id}><span style={{flex:1}}>
              <strong>{F12_RESULT_FA[r.result]??r.result}</strong>
              <small style={{display:'block'}}>{r.actor} · {new Date(r.at).toLocaleString('fa-IR')}</small>
              {r.findings&&<small style={{display:'block',opacity:.8}}>{r.findings}</small>}
            </span></div>
          ))}
          <div className="panel-title"><div><h2>{t('ثبت اجرای آزمون')}</h2></div></div>
          <div className="entity-form">
            <div className="field"><label className="field-label">{t('نتیجه')}</label>
              <select value={f12Run?.result??''} onChange={e=>setF12Run((f:any)=>({...f,result:e.target.value}))}>
                <option value="">— {t('انتخاب کنید')} —</option>
                <option value="PASS">{t('قبول')}</option>
                <option value="FAIL">{t('مردود')}</option>
              </select></div>
            <div className="field full"><label className="field-label">{t('یافته‌ها')}</label>
              <input value={f12Run?.findings??''} onChange={e=>setF12Run((f:any)=>({...f,findings:e.target.value}))} placeholder={t('مثال: تزریق دستور در سند بازیابی‌شده')}/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={()=>f12TestRun(f12For)} disabled={!f12Run?.result||busyId==='f12-'+f12For.id}>
              {busyId==='f12-'+f12For.id?t('…'):t('ثبت اجرای آزمون')}</button>
          </div>
          <div className="panel-title"><div><h2>{t('تصمیم انتشار')}</h2></div></div>
          <div className="entity-form">
            <div className="field"><label className="field-label">{t('تصمیم انتشار')}</label>
              <select value={f12Dec?.releaseDecision??''} onChange={e=>setF12Dec((d:any)=>({...d,releaseDecision:e.target.value}))}>
                <option value="">— {t('انتخاب کنید')} —</option>
                <option value="APPROVED">{t('تأیید')}</option>
                <option value="CONDITIONAL">{t('مشروط')}</option>
                <option value="REJECTED">{t('رد')}</option>
              </select></div>
            <div className="field full"><label className="field-label">{t('روش بازگشت ایمن')}</label>
              <input value={f12Dec?.rollback??f12For.rollback} onChange={e=>setF12Dec((d:any)=>({...d,rollback:e.target.value}))}/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={()=>f12SaveDecision(f12For)} disabled={!f12Dec?.releaseDecision||busyId==='f12d-'+f12For.id}>
              {busyId==='f12d-'+f12For.id?t('…'):t('ثبت تصمیم انتشار')}</button>
          </div>
        </div>)}
      </Modal>

      {/* ═══ گام ۹.۲ — شناسنامهٔ مدل (F17) ═══ */}
      <div className="composer-head" style={{marginTop:18}}>
        <h2><FileText size={16}/> {t('شناسنامهٔ مدل — متصل به ارائه‌دهنده')}</h2>
        <span className="chip neutral">{t('مدل · نسخه · منشأ · محدودیت‌ها')}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>{t('مدل')}</th><th>{t('نسخه')}</th><th>{t('منشأ')}</th><th>{t('ارائه‌دهنده (زنده)')}</th><th>{t('محدودیت‌ها')}</th><th>{t('کاربردهای متصل')}</th><th></th>
          </tr></thead>
          <tbody>
            {(modelCards?.items??[]).map((c:any)=>(
              <tr key={c.id} data-amc={c.providerId}>
                <td className="t-primary" dir="ltr">{c.model}</td>
                <td dir="ltr">{c.version}</td>
                <td>{c.originFa}</td>
                <td>
                  {c.providerName}
                  <span className={`chip ${c.providerStatus==='ACTIVE'?'success':c.providerStatus==='UNREACHABLE'?'danger':'neutral'}`} style={{marginInlineStart:6}}>
                    {AI_STATUS_FA[c.providerStatus]??c.providerStatus}
                  </span>
                </td>
                <td className="t-muted" style={{maxWidth:320}}>{c.limitations}</td>
                <td className="t-muted">{(c.useCasesFa??[]).join(' · ')||'—'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>setMcEdit({...c})}>{t('ویرایش')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modelCards?.rule && <p className="field-hint">{modelCards.rule}</p>}
      <Modal open={!!mcEdit} title={`${t('شناسنامهٔ مدل')} — ${mcEdit?.model??''}`} description={mcEdit?`${t('ارائه‌دهنده')}: ${mcEdit.providerName}`:undefined} onClose={()=>setMcEdit(null)}>
        {mcEdit&&(<div className="entity-form">
          <div className="field"><label className="field-label">{t('نسخه')}</label>
            <input dir="ltr" value={mcEdit.version} onChange={e=>setMcEdit((m:any)=>({...m,version:e.target.value}))}/></div>
          <div className="field full"><label className="field-label">{t('محدودیت‌ها')}</label>
            <textarea rows={3} value={mcEdit.limitations} onChange={e=>setMcEdit((m:any)=>({...m,limitations:e.target.value}))}/></div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={mcSave} disabled={busyId==='mc-'+mcEdit.id}>
              {busyId==='mc-'+mcEdit.id?t('…'):t('ذخیرهٔ شناسنامهٔ مدل')}</button>
          </div>
        </div>)}
      </Modal>

      {/* ═══ گام ۶.۲ — خط‌مشی کنترل داده (۱۹.۴) ═══ */}
      <div className="composer-head" style={{marginTop:18}}>
        <h2><ShieldCheck size={16}/> {t('خط‌مشی کنترل داده — پوشاندن، مرز و پالایش')}</h2>
      </div>
      <div className="ai-quick-chips" aria-label={t('الگوهای پوشاندن')}>
        {(policy?.patternsCatalog??[]).map((pt:any)=>(
          <button key={pt.key} type="button"
            className="ai-quick-chip"
            style={{opacity:policy?.patterns?.[pt.key]?1:.5,borderStyle:policy?.patterns?.[pt.key]?'solid':'dashed'}}
            aria-pressed={!!policy?.patterns?.[pt.key]}
            onClick={()=>togglePattern(pt.key,!policy?.patterns?.[pt.key])}>
            {policy?.patterns?.[pt.key]?<CheckCircle2 size={12}/>:<AlertTriangle size={12}/>} {pt.label}
          </button>
        ))}
      </div>
      <div className="form-grid" style={{marginTop:8}}>
        <div className="field full">
          <label className="field-label">{t('متن پیش‌نمایش')}</label>
          <textarea rows={2} value={pvText} onChange={e=>setPvText(e.target.value)} />
        </div>
        <div className="field full" style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div className="segmented" style={{margin:0}}>
            <button type="button" className={pvMode==='API_KEY'?'active':''} onClick={()=>setPvMode('API_KEY')}>{t('مسیر ابری (کلید API)')}</button>
            <button type="button" className={pvMode==='LOCAL'?'active':''} onClick={()=>setPvMode('LOCAL')}>{t('مسیر لوکال (معاف از پوشاندن)')}</button>
          </div>
          <button type="button" className="srip-button primary" onClick={()=>runPreview()} disabled={busyId==='preview'}>
            {busyId==='preview'?t('در حال…'):t('پیش‌نمایش کنترل داده')}
          </button>
        </div>
      </div>
      {pv && (
        <div className="gw-preview" style={{marginTop:10,display:'grid',gap:8}}>
          <div>
            <b>{pvMode==='LOCAL'?t('ورودی ارسالی (مسیر لوکال — معاف):'):t('ورودی پوشانده‌شده پیش از ارسال ابری:')}</b>
            <div className="gw-masked" style={{marginTop:4,padding:10,border:'1px solid var(--card-border-strong)',borderRadius:10,whiteSpace:'pre-wrap',fontSize:12.5}}>{pv.masked}</div>
          </div>
          <div>
            <b>{t('خروجی پس از پالایش (همهٔ مسیرها):')}</b>
            <div style={{marginTop:4,padding:10,border:'1px solid var(--card-border-strong)',borderRadius:10,whiteSpace:'pre-wrap',fontSize:12.5}}>{pv.filteredOutput}</div>
          </div>
          <div className="ai-quick-chips">
            {(pv.findings??[]).map((f:any)=>(
              <span key={f.key} className="chip warning">{f.label} ×{fa(f.count)}</span>
            ))}
            {(pv.findings??[]).length===0 && <span className="chip neutral">{t('الگوی محرمانه‌ای یافت نشد')}</span>}
          </div>
          <p className="field-hint" style={{margin:0}}>{pv.note}</p>
          <details>
            <summary style={{cursor:'pointer',fontSize:12.5}}>{t('مرز داده و دستور — قالب ارسال به مدل (۱۹.۴)')}</summary>
            <pre style={{whiteSpace:'pre-wrap',fontSize:11.5,margin:'6px 0 0',padding:10,border:'1px dashed var(--card-border-strong)',borderRadius:8}}>{pv.boundary}</pre>
          </details>
        </div>
      )}
      {policy?.rule && <p className="field-hint">{policy.rule}</p>}

      {/* ═══ گام ۷.۱ — نمایهٔ معنایی و جست‌وجوی ترکیبی ═══ */}
      <div className="composer-head" style={{marginTop:18}}>
        <h2><Database size={16}/> {t('نمایهٔ معنایی و جست‌وجوی ترکیبی')}</h2>
        <span className="chip info">{fa(ragIndex?.totals?.all ?? 0)} {t('مدخل نمایه‌شده')}</span>
      </div>
      <div className="ai-quick-chips" aria-label={t('ترکیب نمایهٔ معنایی')}>
        <span className="chip">{t('سند دانشی')}: {fa(ragIndex?.totals?.knowledge ?? 0)}</span>
        <span className="chip">{t('سند مخزن')}: {fa(ragIndex?.totals?.document ?? 0)} ({fa(ragIndex?.documents?.indexed ?? 0)} {t('نمایه‌شده')} · {fa(ragIndex?.documents?.pending ?? 0)} {t('در انتظار')})</span>
        <span className="chip">{t('رکورد ساختاریافته')}: {fa(ragIndex?.totals?.record ?? 0)}</span>
        <span className="chip">{t('یال گراف روابط')}: {fa(ragIndex?.totals?.graph ?? 0)}</span>
      </div>
      <div className="ai-input-row" style={{marginTop:10}}>
        <input
          className="as-input"
          value={ragQuery}
          onChange={e=>setRagQuery(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); runRagSearch(); } }}
          placeholder={t('جست‌وجوی ترکیبی در اسناد، رکوردها و گراف… (مثلاً: تأمین‌کننده)')}
          aria-label={t('جست‌وجوی ترکیبی نمایهٔ معنایی')}
          disabled={busyId==='rag'}
        />
        <button className="ai-send-btn" onClick={()=>runRagSearch()} disabled={busyId==='rag'||!ragQuery.trim()}>
          <Search size={17}/><span>{busyId==='rag'?t('در حال…'):t('بگرد')}</span>
        </button>
      </div>
      {ragResults && (
        <div className="gw-rag-results" style={{marginTop:10,display:'grid',gap:6}}>
          <div className="ai-quick-chips">
            <span className="chip">{t('یافت‌شده')}: {fa(ragResults.stats?.matched ?? 0)}</span>
            <span className="chip">{t('بازیابی‌شده')}: {fa(ragResults.stats?.retrieved ?? 0)}</span>
            <span className="chip">{t('از مجموع')} {fa(ragResults.stats?.indexed ?? 0)} {t('مدخل نمایه‌شده')}</span>
          </div>
          {(ragResults.items??[]).map((r:any)=>(
            <div key={r.entryId} className="gw-rag-hit section-card" style={{padding:'10px 12px',gap:6}}>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <span className="chip info">{r.sourceTypeFa}</span>
                <b style={{fontSize:13}}>{r.title}</b>
                <span className="chip neutral" title={t('امتیاز تطبیق')}>{t('امتیاز')}: {fa(r.score)}</span>
                {r.shared && <span className="chip">{t('دانش مشترک محصول')}</span>}
              </div>
              {r.snippet && <p className="t-muted" style={{margin:0,fontSize:12}}>{r.snippet}</p>}
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',fontSize:11.5}} className="t-muted">
                <span>{t('منشأ')}: {r.origin?.source}{r.origin?.owner?` — ${r.origin.owner}`:''}{r.origin?.uploadedBy?` — ${r.origin.uploadedBy}`:''}</span>
                <Link className="p3-chip" href={r.url}>{t('نمایش منبع')}</Link>
              </div>
            </div>
          ))}
          {(ragResults.items??[]).length===0 && <p className="t-muted" style={{margin:0}}>{t('چیزی در محدودهٔ مجاز شما یافت نشد.')}</p>}
          <p className="field-hint" style={{margin:0}}>{ragResults.rule}</p>
        </div>
      )}
      {ragIndex?.rule && !ragResults && <p className="field-hint">{ragIndex.rule}</p>}

      {/* ═══ گام ۶.۳ — پایش فنی، داشبورد مصرف و کلید توقف ═══ */}
      <div className="composer-head" style={{marginTop:18}}>
        <h2><Activity size={16}/> {t('پایش فنی و کلید توقف')}</h2>
        <span className={`chip ${gw?.status==='HALTED'?'danger':'success'}`}>
          {gw?.status==='HALTED'?t('درگاه متوقف است — بازگشت به فرآیند انسانی'):t('درگاه فعال')}
        </span>
      </div>
      {gw?.status==='HALTED' && (
        <div className="banner danger" style={{display:'flex',gap:8,alignItems:'center'}}>
          <AlertTriangle size={14}/>
          <span>{t('درگاه هوش مصنوعی متوقف است — همهٔ فراخوانی‌های AI پاسخ «بازگشت به فرآیند انسانی» می‌گیرند.')}
            {gw.reason?` ${t('دلیل')}: ${gw.reason}`:''}{gw.actorEmail?` · ${t('اقدام‌کننده')}: ${gw.actorEmail}`:''}</span>
        </div>
      )}
      <div className="ai-quick-chips" aria-label={t('کلید توقف کاربردها')}>
        {gw?.status==='HALTED'
          ?<button className="srip-button primary" onClick={()=>setGateway({status:'ACTIVE'})} disabled={busyId==='gateway'}>{t('فعال‌سازی درگاه')}</button>
          :<button className="srip-button" style={{borderColor:'var(--srip-danger)',color:'var(--srip-danger)'}} onClick={()=>{setHaltFor('GLOBAL');setHaltReason('');}}>{t('توقف کل درگاه')}</button>}
        {(gw?.applications??[]).map((a:any)=>(
          <button key={a.application} type="button" className="ai-quick-chip"
            style={{opacity:a.halted?1:.6,borderStyle:a.halted?'solid':'dashed',borderColor:a.halted?'var(--srip-danger)':undefined}}
            aria-pressed={a.halted}
            onClick={()=>{ if(a.halted) setGateway({application:a.application,halted:false}); else { setHaltFor(a.application); setHaltReason(''); } }}>
            {a.halted?<AlertTriangle size={12}/>:<ShieldCheck size={12}/>} {a.label}
          </button>
        ))}
      </div>
      {usageG && (
        <div style={{marginTop:10,display:'grid',gap:10}}>
          <div className="ai-quick-chips" aria-label={t('خلاصهٔ مصرف درگاه')}>
            <span className="chip">{t('فراخوانی‌ها')}: {fa(usageG.totals.calls)}</span>
            <span className="chip">{t('هزینهٔ برآوردی')}: {fa(usageG.totals.cost)}</span>
            <span className="chip">{t('میانگین زمان پاسخ')}: {fa(usageG.totals.avgMs)} {t('میلی‌ثانیه')}</span>
            <span className="chip danger">{t('خطاها')}: {fa(usageG.totals.errors)}</span>
            <span className="chip warning">{t('توقف‌ها')}: {fa(usageG.totals.halted)}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('کاربرد')}</th><th>{t('فراخوانی‌ها')}</th><th>{t('خطاها')}</th><th>{t('میانگین زمان پاسخ')}</th><th>{t('هزینهٔ برآوردی')}</th></tr></thead>
              <tbody>
                {(usageG.byApplication??[]).map((a:any)=>(
                  <tr key={a.application} className="gw-usage-app"><td className="t-primary">{a.label}</td>
                    <td>{fa(a.calls)}</td><td>{fa(a.errors)}</td><td>{fa(a.avgMs)} {t('میلی‌ثانیه')}</td><td dir="ltr">{fa(a.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ارائه‌دهنده')}</th><th>{t('فراخوانی‌ها')}</th><th>{t('هزینهٔ برآوردی')}</th></tr></thead>
              <tbody>
                {(usageG.byProvider??[]).map((a:any)=>(
                  <tr key={a.providerName} className="gw-usage-prov"><td className="t-primary">{a.providerName}</td>
                    <td>{fa(a.calls)}</td><td dir="ltr">{fa(a.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint" style={{margin:0}}>{usageG.rule}</p>
        </div>
      )}
      <div className="composer-head" style={{marginTop:14}}>
        <h3 style={{fontSize:13.5}}><History size={14}/> {t('سابقهٔ فراخوانی‌ها (از لاگ درگاه)')}</h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t('زمان')}</th><th>{t('کاربرد')}</th><th>{t('ارائه‌دهنده')}</th><th>{t('مدل')}</th><th>{t('وضعیت')}</th><th>{t('هزینهٔ برآوردی')}</th><th>{t('زمان پاسخ')}</th></tr></thead>
          <tbody>
            {calls.slice(0,10).map((c:any)=>(
              <tr key={c.id} className="gw-call-row">
                <td className="t-muted" style={{fontSize:11.5,whiteSpace:'nowrap'}} dir="ltr">{new Date(c.at).toLocaleString(localeTag())}</td>
                <td>{(AI_APP_FA[c.application])??c.application}</td>
                <td className="t-muted" style={{fontSize:11.5}}>{c.providerName??'—'}</td>
                <td className="t-muted" style={{fontSize:11.5}} dir="ltr">{c.model??'—'}</td>
                <td><span className={`chip ${c.status==='OK'?'success':c.status==='HALTED'?'warning':'danger'}`}>{c.status}</span></td>
                <td dir="ltr">{fa(c.costEstimate)}</td>
                <td>{fa(c.durationMs)} {t('میلی‌ثانیه')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gw?.rule && <p className="field-hint">{gw.rule}</p>}

      {/* مودال توقف (کلی یا کاربرد) — دلیل الزامی */}
      <Modal open={!!haltFor} title={haltFor==='GLOBAL'?t('توقف کل درگاه هوش مصنوعی'):t('توقف کاربرد')} onClose={()=>setHaltFor(null)}
        description={t('توقف بدون دلیل ثبت نمی‌شود؛ دلیل و اقدام‌کننده در سابقهٔ درگاه ثبت می‌شود (۱۹.۴ سند v6).')}>
        <form className="form-grid" onSubmit={(e)=>{e.preventDefault();submitHalt();}}>
          <div className="field full">
            <label className="field-label">{t('دلیل توقف')}</label>
            <textarea rows={3} value={haltReason} onChange={e=>setHaltReason(e.target.value)} required
              placeholder={t('مثلاً: رخداد امنیتی مشهور — تا پایان بررسی، همهٔ فراخوانی‌ها به فرآیند انسانی برمی‌گردد.')} />
          </div>
          <div className="form-actions">
            <button type="button" className="srip-button" onClick={()=>setHaltFor(null)}>{t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busyId==='gateway'}>{busyId==='gateway'?t('در حال…'):t('ثبت و توقف')}</button>
          </div>
        </form>
      </Modal>

      {/* مودال ثبت/چرخش کلید — نمایش یک‌بار کلید کامل */}
      <Modal open={!!keyFor} title={t('ثبت/چرخش کلید API')} onClose={()=>{setKeyFor(null);setKeyResult(null);}}
        description={keyFor?`${keyFor.name} — ${keyFor.baseUrl}`:undefined}>
        {keyResult ? (
          <div>
            <div className="banner warning" style={{display:'flex',gap:8}}>
              <AlertTriangle size={14}/>
              <span>{keyResult.notice}</span>
            </div>
            <div className="gw-onetime-key" style={{margin:'10px 0',padding:12,border:'1px dashed var(--srip-amber)',borderRadius:10,fontFamily:'monospace',direction:'ltr',textAlign:'left',fontSize:14,wordBreak:'break-all'}}>
              {keyResult.key}
            </div>
            <div className="form-actions">
              <button type="button" className="srip-button" onClick={()=>{try{navigator.clipboard?.writeText(String(keyResult.key));}catch{} }}><Copy size={14}/> {t('کپی کلید')}</button>
              <button type="button" className="srip-button primary" onClick={()=>{setKeyFor(null);setKeyResult(null);}}>{t('ذخیره کردم — بستن')}</button>
            </div>
          </div>
        ) : (
          <form className="form-grid" onSubmit={(e)=>{e.preventDefault();saveKey();}}>
            <div className="field full">
              <label className="field-label">{t('کلید API')}</label>
              <input value={keyInput} onChange={e=>setKeyInput(e.target.value)} dir="ltr"
                placeholder="sk-…" required minLength={8} aria-label={t('کلید API')} />
            </div>
            <p className="field-hint">{t('کلید فقط همین یک‌بار نمایش داده می‌شود و سپس تنها ۴ رقم آخر نگه داشته می‌شود؛ کلید کامل هرگز ذخیره یا بازگردانی نمی‌شود.')}</p>
            <div className="form-actions">
              <button type="button" className="srip-button" onClick={()=>setKeyFor(null)}>{t('انصراف')}</button>
              <button type="submit" className="srip-button primary" disabled={busyId==='key'}>{busyId==='key'?t('در حال…'):t('ثبت کلید')}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* مودال ویرایش ارائه‌دهنده */}
      <Modal open={!!editFor} title={t('ویرایش ارائه‌دهنده')} onClose={()=>setEditFor(null)}>
        {editFor && (
          <form className="form-grid" onSubmit={(e)=>{e.preventDefault();saveEdit();}}>
            <div className="field full">
              <label className="field-label">{t('نام ارائه‌دهنده')}</label>
              <input value={editFor.name??''} onChange={e=>setEditFor((f:any)=>({...f,name:e.target.value}))} required minLength={3} />
            </div>
            <div className="field full">
              <label className="field-label">{t('نشانی (Base URL)')}</label>
              <input value={editFor.baseUrl??''} onChange={e=>setEditFor((f:any)=>({...f,baseUrl:e.target.value}))} dir="ltr" required placeholder="http://localhost:11434/v1" />
            </div>
            <div className="field full">
              <label className="field-label">{t('مدل پیش‌فرض')}</label>
              <input value={editFor.model??''} onChange={e=>setEditFor((f:any)=>({...f,model:e.target.value}))} dir="ltr" placeholder="llama3.1" />
            </div>
            <div className="form-actions">
              <button type="button" className="srip-button" onClick={()=>setEditFor(null)}>{t('انصراف')}</button>
              <button type="submit" className="srip-button primary" disabled={busyId==='edit'}>{busyId==='edit'?t('در حال…'):t('ذخیره')}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* مودال ارائه‌دهندهٔ جدید */}
      <Modal open={!!createForm} title={t('ارائه‌دهندهٔ جدید')} onClose={()=>setCreateForm(null)}
        description={t('مسیر لوکال بدون سرویس بیرونی و بدون کلید کار می‌کند؛ مسیر کلید API پس از ثبت کلید فعال می‌شود.')}>
        {createForm && (
          <form className="form-grid" onSubmit={(e)=>{e.preventDefault();createProvider();}}>
            <div className="field full">
              <label className="field-label">{t('نام ارائه‌دهنده')}</label>
              <input value={createForm.name} onChange={e=>setCreateForm((f:any)=>({...f,name:e.target.value}))} required minLength={3} placeholder={t('مثلاً: Ollama سرور سازمان')} />
            </div>
            <div className="field">
              <label className="field-label">{t('مسیر')}</label>
              <select value={createForm.mode} onChange={e=>setCreateForm((f:any)=>({...f,mode:e.target.value}))}>
                <option value="LOCAL">{t('مسیر لوکال (بدون سرویس بیرونی)')}</option>
                <option value="API_KEY">{t('مسیر کلید API')}</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">{t('نوع')}</label>
              <select value={createForm.kind} onChange={e=>setCreateForm((f:any)=>({...f,kind:e.target.value}))}>
                <option value="OPENAI_COMPATIBLE">{AI_KIND_FA.OPENAI_COMPATIBLE}</option>
                <option value="ANTHROPIC">{AI_KIND_FA.ANTHROPIC}</option>
                <option value="GEMINI">{AI_KIND_FA.GEMINI}</option>
              </select>
            </div>
            <div className="field full">
              <label className="field-label">{t('نشانی (Base URL)')}</label>
              <input value={createForm.baseUrl} onChange={e=>setCreateForm((f:any)=>({...f,baseUrl:e.target.value}))} dir="ltr" required placeholder="http://localhost:11434/v1" />
            </div>
            <div className="field full">
              <label className="field-label">{t('مدل پیش‌فرض (اختیاری)')}</label>
              <input value={createForm.model} onChange={e=>setCreateForm((f:any)=>({...f,model:e.target.value}))} dir="ltr" placeholder="llama3.1" />
            </div>
            <div className="form-actions">
              <button type="button" className="srip-button" onClick={()=>setCreateForm(null)}>{t('انصراف')}</button>
              <button type="submit" className="srip-button primary" disabled={busyId==='create'}>{busyId==='create'?t('در حال…'):t('ثبت ارائه‌دهنده')}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

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
  { id:'SMART_SEARCH', label:t('جستجوی هوشمند'), desc:t('جستجوی سازمان، جلسه و تعامل در محدودهٔ مجاز'), icon:<Search size={16}/>,
    placeholder:t('مثلاً: جلسات اخیر با تأمین‌کننده‌ها را نشان بده…'),
    quick:[
      {label:t('جلسات اخیر'), text:t('جلسات اخیر با تامین کنندگان را فهرست کن')},
      {label:t('تعاملات با مشتری'), text:t('تعاملات اخیر با مشتریان کلیدی را نشان بده')},
      {label:t('سازمان‌های بانکی'), text:t('سازمان‌های نوع بانک را فهرست کن')},
      {label:t('چرا ریسک؟'), text:t('کدام روابط در معرض ریسک هستند و چرا؟')},
    ]},
  { id:'MEETING_BRIEF', label:t('بریف جلسه'), desc:t('خلاصهٔ آمادگی برای جلسه: هدف، شرکت‌کنندگان، اقدامات'), icon:<CalendarCheck size={16}/>,
    placeholder:t('عنوان یا موضوع جلسه را بنویسید…'),
    quick:[
      {label:t('آماده‌سازی جلسه'), text:t('برای جلسه آتی درباره همکاری راهبردی بریف آمادگی تهیه کن')},
      {label:t('بریف جلسه با بانک'), text:t('بریف جلسه با نمایندگان بانک را آماده کن')},
    ]},
  { id:'MEETING_SUMMARY', label:t('خلاصهٔ جلسه'), desc:t('استخراج خلاصه از متن یادداشت‌های جلسه'), icon:<FileText size={16}/>,
    placeholder:t('متن یادداشت‌های جلسه را اینجا قرار دهید…'),
    quick:[
      {label:t('متن نمونه'), text:t('جلسه با حضور مدیرعامل برگزار شد. توافق شد قرارداد تا پایان ماه امضا شود. نیاز به پیگیری از تیم حقوقی داریم.')},
    ]},
  { id:'ACTION_EXTRACTION', label:t('استخراج اقدام'), desc:t('تشخیص اقدام‌های مشخص از متن — نیازمند تأیید انسانی'), icon:<ListChecks size={16}/>,
    placeholder:t('متن را بنویسید؛ اقدام‌ها شناسایی می‌شوند…'),
    quick:[
      {label:t('متن نمونه'), text:t('ما باید پیش‌فاکتور را تا جمعه ارسال کنیم. لطفاً گزارش مالی را آماده کنید و با تیم فروش هماهنگ شوید.')},
    ]},
  { id:'COMMITMENT_EXTRACTION', label:t('استخراج تعهد'), desc:t('تشخیص تعهدهای طرفین از متن — نیازمند تأیید انسانی'), icon:<ShieldCheck size={16}/>,
    placeholder:t('متن را بنویسید؛ تعهدها شناسایی می‌شوند…'),
    quick:[
      {label:t('متن نمونه'), text:t('تیم ما متعهد شد نسخه اول را تحویل دهد و آن‌ها قول دادند زیرساخت را آماده کنند. موعد تحویل دو هفته آینده است.')},
    ]},
  { id:'RISK_DETECTION', label:t('تشخیص ریسک'), desc:t('شناسایی سیگنال‌های ریسک در متن: تاخیر، انسداد، نگرانی'), icon:<AlertTriangle size={16}/>,
    placeholder:t('متن را بنویسید؛ سیگنال‌های ریسک استخراج می‌شوند…'),
    quick:[
      {label:t('متن نمونه'), text:t('متاسفانه پروژه با تاخیر مواجه شده و تامین مواد دچار مشکل است. ریسک لغو سفارش توسط مشتری وجود دارد.')},
    ]},
  { id:'OPPORTUNITY_DETECTION', label:t('تشخیص فرصت'), desc:t('شناسایی سیگنال‌های فرصت: توسعه، همکاری، تمدید'), icon:<Target size={16}/>,
    placeholder:t('متن را بنویسید؛ سیگنال‌های فرصت استخراج می‌شوند…'),
    quick:[
      {label:t('متن نمونه'), text:t('مشتری علاقه‌مند به توسعه همکاری در بازار جدید است و پیشنهاد تمدید قرارداد را داده.')},
    ]},
  { id:'NEXT_BEST_ACTION', label:t('اقدام بعدی'), desc:t('پیشنهاد بهترین اقدام بعدی بر اساس شواهد مجاز'), icon:<Lightbulb size={16}/>,
    placeholder:t('رابطه، سازمان یا وضعیت را بنویسید…'),
    quick:[
      {label:t('بررسی رابطه'), text:t('بهترین اقدام بعدی برای روابط کلیدی من چیست؟')},
      {label:t('پیگیری'), text:t('برای پیگیری فرصت‌های باز چه اقدام‌هایی پیشنهاد می‌کنی؟')},
    ]},
  { id:'EXECUTIVE_BRIEF', label:t('بریف راهبردی'), desc:t('گزارش هفتگی اجرایی: جلسات، ریسک‌ها، تعهدات، فرصت‌ها'), icon:<Briefcase size={16}/>,
    placeholder:t('گزارش هفتگی راهبردی این هفته را آماده کن…'),
    quick:[
      {label:t('بریف این هفته'), text:t('خلاصه راهبردی هفته جاری را آماده کن')},
    ]},
];

const INTENT_BY_ID = Object.fromEntries(INTENTS.map(i=>[i.id,i]));
const CAP_FA:Record<string,string> = lt({
  'smart-search':t('جستجوی هوشمند'),'meeting-brief':t('بریف جلسه'),'meeting-summary':t('خلاصهٔ جلسه'),
  'action-extraction':t('استخراج اقدام'),'commitment-extraction':t('استخراج تعهد'),'risk-detection':t('تشخیص ریسک'),
  'opportunity-detection':t('تشخیص فرصت'),'next-best-action':t('اقدام بعدی'),'executive-brief':t('بریف راهبردی'),'evidence':t('شواهد'),
});
const evLen=(ev:any,k:string)=>Array.isArray(ev?.[k])?ev[k].length:0;

type HistoryItem = { intent: string; query: string; ts: number; ok: boolean };

const HISTORY_KEY = 'srip_ai_history_v1';
/* فاز ۳/۲۲: برچسب انواع ارجاع دستیار زبان طبیعی */
const REF_FA: Record<string, string> = lt( { ORGANIZATION: t('سازمان'), RELATIONSHIP: t('رابطه'), PERSON: t('شخص'), COMMITMENT: t('تعهد'), INTERACTION: t('تعامل'), MENTION: t('ذکر رسانه‌ای'), GAP: t('شکاف'), ENRICHMENT: t('غنی‌سازی') });

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
  /* فاز ۳/۲۲: پرسش‌وپاسخ آزاد به زبان طبیعی — همان لایهٔ MCP برای انسان */
  const [mode,setMode]=useState<'FREE'|'STRUCT'|'GATEWAY'>('FREE');
  const [freeQ,setFreeQ]=useState('');
  const [chat,setChat]=useState<Array<{q:string;a:any}>>([]);
  const [freeBusy,setFreeBusy]=useState(false);
  const [faq,setFaq]=useState<string[]>([]);
  const chatRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    try{ setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY)??'[]')); }catch{}
    apiGet('/ai/status').then(setStatus).catch(()=>{});
    apiGet('/ai/usage').then(setUsage).catch(()=>{});
    apiGet('/ai/provider-health').then(setProviderHealth).catch(()=>{});
    apiGet<{items:string[]}>('/assistant/suggestions').then(r=>setFaq(r.items??[])).catch(()=>{});
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

  /** فاز ۳/۲۲ — پرسش آزاد: موتور قطعی روی گراف با ارجاع به رکورد منبع */
  function askFree(preset?:string){
    const text=(preset??freeQ).trim();
    if(!text || freeBusy) return;
    setFreeBusy(true); setError(''); setFreeQ(''); setResult(null);
    api<any>('/ai/ask',{method:'POST',body:JSON.stringify({question:text})})
      .then(a=>{
        setChat(prev=>[...prev,{q:text,a}]);
        setTimeout(()=>{ try{ chatRef.current?.scrollTo({top:chatRef.current.scrollHeight,behavior:'smooth'}); }catch{} },60);
      })
      .catch(x=>setError((x as Error).message))
      .finally(()=>setFreeBusy(false));
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
        eyebrow={t('دستیار هوش مصنوعی')}
        title={t('دستیار هوشمند روابط')}
        description={t('پرسش‌وپاسخ آزاد به زبان طبیعی روی گراف روابط + ۹ قابلیت آماده — موتور قطعی (قاعده‌بنیان) پاسخ می‌دهد؛ بدون مدل خارجی، با ارجاع به رکورد منبع و «نمی‌دانم» صادقانه برای خارج از دامنه.')}
        actions={
          <>
            <span className="chip success"><CheckCircle2 size={12}/> موتور: {status?.provider==='deterministic'?t('قطعی داخلی'):(status?.provider??t('قطعی داخلی'))}</span>
            <span className="chip info"><Cpu size={12}/> مدل خارجی: {model?.externalCall===true?t('فعال'):t('غیرفعال')}</span>
          </>
        }
      />
      <IntelHub />

      <div className="ai-layout">
        {/* ============ Sidebar: intents ============ */}
        <aside className="ai-side">
          <div className="section-card" style={{gap:10}}>
            <div className="section-head" style={{alignItems:'center'}}>
              <h2 style={{fontSize:14}}><Wand2 size={16}/> {t('قابلیت‌های دستیار')}</h2>
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
                <h2 style={{fontSize:13.5}}><History size={15}/> {t('پرس‌وجوهای اخیر')}</h2>
                <button className="btn btn-ghost btn-sm" onClick={()=>{ setHistory([]); try{localStorage.removeItem(HISTORY_KEY);}catch{} }}>{t('پاک‌کردن')}</button>
              </div>
              <div className="ai-history">
                {history.slice(0,8).map(h=>(
                  <button className="ai-history-item" key={h.ts+'-'+h.query} onClick={()=>pickHistory(h)} title={h.query}>
                    <Search size={13}/>
                    <span className="hq">{h.query}</span>
                    <span className="ht">{new Date(h.ts).toLocaleTimeString(localeTag(),{hour:'2-digit',minute:'2-digit'})}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {usageTotal && (
            <div className="ai-status-bar" style={{gridTemplateColumns:'1fr'}}>
              <div className="ai-status-item">
                <span className="st-ico"><Database size={14}/></span>
                <div><b>{usageTotal.queries.toLocaleString(localeTag())} پرس‌وجو</b><span>{t('کل درخواست‌های ثبت‌شده')}</span></div>
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
          <div style={{marginBottom:12}}>
            <Segmented
              options={[{value:'FREE',label:t('پرسش آزاد (زبان طبیعی)')},{value:'STRUCT',label:t('قابلیت‌های آماده')},{value:'GATEWAY',label:t('درگاه و ارائه‌دهنده‌ها')}]}
              value={mode} onChange={(v)=>setMode(v)} />
          </div>
          {mode==='FREE' ? (
            <div className="ai-composer">
              <div className="composer-head">
                <h2><Sparkles size={16}/> {t('پرسش‌وپاسخ آزاد روی گراف')}</h2>
                <span className="chip success"><CheckCircle2 size={12}/> {t('موتور قطعی + ارجاع به منبع')}</span>
              </div>
              <div className="as-chat" ref={chatRef} style={{maxHeight:380}} aria-live="polite">
                {chat.length===0 && (
                  <div className="as-empty">
                    <p style={{margin:0}}>{t('مثلاً بپرسید: «سلامت این حساب چقدر است؟» یا «مسیر معرفی از شرکت x به پارس انرژی چیست؟» یا «تعهدات معوق کدام‌اند؟»')}</p>
                  </div>
                )}
                {chat.map((m,i)=>(
                  <div key={i} className="as-turn">
                    <div className="as-q"><Users size={14} style={{flexShrink:0}}/><span>{m.q}</span></div>
                    <div className={`as-a ${m.a?.outOfScope?'as-oos':''}`}>
                      <p style={{margin:0,whiteSpace:'pre-wrap'}}>{m.a?.answer}</p>
                      <div className="as-meta">
                        {m.a?.intentFa && <span className="chip">{m.a.intentFa}</span>}
                        {m.a?.engineFa && <span className="chip info">{m.a.engineFa}</span>}
                        {typeof m.a?.confidence==='number' && m.a?.confidence>0 && (
                          <span className="chip">{t('سطح اطمینان')}: {fa(m.a.confidence)}٪</span>
                        )}
                        {m.a?.answer && !m.a?.outOfScope && <span className="chip warning">{t('فقط پیشنهاد')}</span>}
                        {(m.a?.sources??[]).slice(0,6).map((s:any,j:number)=>(
                          <Link key={'src'+j} className="p3-chip" href={s.url} title={s.sourceTypeFa}>{s.sourceTypeFa} — {String(s.title).slice(0,32)}</Link>
                        ))}
                        {(m.a?.references??[]).slice(0,5).map((r:any,j:number)=>(
                          <span key={j} className="p3-chip" title={`${REF_FA[r.type]??r.type}: ${r.id}`}>{REF_FA[r.type]??r.type} — {String(r.label).slice(0,30)}</span>
                        ))}
                        {m.a?._meta?.dataDate && <span className="as-date">داده تا {new Date(m.a._meta.dataDate).toLocaleDateString(localeTag())}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {freeBusy && <div className="as-a as-typing"><Sparkles size={14}/><span>{t('در حال بررسی گراف…')}</span></div>}
              </div>
              <div className="ai-quick-chips" aria-label={t('پرسش‌های پرتکرار')}>
                {faq.slice(0,10).map(q=>(
                  <button key={q} className="ai-quick-chip" onClick={()=>askFree(q)} disabled={freeBusy}>{q}</button>
                ))}
              </div>
              <div className="ai-input-row">
                <input
                  className="as-input"
                  value={freeQ}
                  onChange={e=>setFreeQ(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); askFree(); } }}
                  placeholder={t('پرسش خود را به زبان طبیعی بنویسید…')}
                  aria-label={t('پرسش آزاد دستیار')}
                  maxLength={500}
                  disabled={freeBusy}
                />
                <button className="ai-send-btn" onClick={()=>askFree()} disabled={freeBusy||!freeQ.trim()}>
                  <Send size={19}/>
                  <span>{freeBusy?t('در حال…'):t('بپرس')}</span>
                </button>
              </div>
              <div className="ai-hint">
                <Info size={12}/> پاسخ‌ها فقط از دادهٔ واقعی همین مستأجر و با ارجاع به رکورد منبع ساخته می‌شوند؛ برای خارج از دامنه صادقانه «نمی‌دانم» گفته می‌شود.
              </div>
            </div>
          ) : mode==='GATEWAY' ? (
            <GatewayPanel/>
          ) : (
          <div className="ai-composer">
            <div className="composer-head">
              <h2><Sparkles size={16}/> {meta.label}</h2>
              <span className="chip success"><CheckCircle2 size={12}/> {t('آماده')}</span>
            </div>
            <div className="ai-quick-chips" aria-label={t('نمونه پرس‌وجوهای سریع')}>
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
                aria-label={t('متن پرس‌وجو')}
                disabled={busy}
              />
              <button className="ai-send-btn" onClick={()=>ask()} disabled={busy||!query.trim()}>
                <Send size={19}/>
                <span>{busy?t('در حال…'):t('ارسال')}</span>
              </button>
            </div>
            <div className="ai-hint">
              <Info size={12}/> این قابلیت به‌صورت قطعی (بدون هوش مصنوعی خارجی) کار می‌کند؛ پاسخ‌ها از داده‌های مجاز شما ساخته می‌شوند. برای ارسال: کنترل + اینتر
            </div>
          </div>
          )}

          {error && <div className="error-card" role="alert">{error}</div>}

          {busy && !result && (
            <div className="ai-msg assistant">
              <span className="msg-avatar"><Sparkles size={15}/></span>
              <div className="msg-body" style={{maxWidth:420}}>
                <div className="ai-typing" aria-label={t('در حال تحلیل')}><i/><i/><i/></div>
                <span className="t-muted" style={{fontSize:11}}>{t('موتور قطعی در حال بازیابی شواهد مجاز و تحلیل…')}</span>
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
                    <span className="model-tag">{model?.provider==='deterministic'?t('موتور قطعی داخلی'):(model?.provider ?? t('موتور قطعی داخلی'))}</span>
                    {model?.externalCall===false && <span className="chip success">{t('بدون مدل خارجی')}</span>}
                    {safety?.permissionAwareRetrieval && <span className="chip info">{t('محدودهٔ دسترسی رعایت شد')}</span>}
                    <time>{new Date().toLocaleTimeString(localeTag(),{hour:'2-digit',minute:'2-digit'})}</time>
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
                          <p>{body.meeting.objective??t('بدون هدف ثبت‌شده')}</p>
                          <div className="match-meta">
                            {body.meeting.startAt&&<span><CalendarCheck size={12}/> {new Date(body.meeting.startAt).toLocaleString(localeTag(),{dateStyle:'medium',timeStyle:'short'})}</span>}
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
                          <span className="t-muted" style={{fontSize:11,fontWeight:800}}>{t('پروندهٔ بازِ رابطه (قبل از جلسه بررسی شود):')}</span>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:8}}>
                            {(body.actions??[]).map((a:any)=>(
                              <div className="ai-candidate" key={a.id}><ListChecks size={14}/>
                                <div><Link href={`/actions/${a.id}`} style={{fontSize:12}}>{a.title}</Link>
                                <div className="t-muted" style={{fontSize:10.5}}>اقدام {a.status==='OPEN'?t('باز'):t('در جریان')}{a.dueAt?` ${t('· موعد')} ${new Date(a.dueAt).toLocaleDateString(localeTag())}`:''}</div></div>
                              </div>
                            ))}
                            {(body.commitments??[]).map((c:any)=>(
                              <div className="ai-candidate" key={c.id}><ShieldCheck size={14}/>
                                <div><Link href={`/commitments/${c.id}`} style={{fontSize:12}}>{c.description}</Link>
                                <div className="t-muted" style={{fontSize:10.5}}>تعهد{c.dueAt?` ${t('· سررسید')} ${new Date(c.dueAt).toLocaleDateString(localeTag())}`:''}</div></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {body?.type==='meeting_summary' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div className="ai-match-card"><b>{t('خلاصهٔ جلسه')}</b><p>{body.text}</p></div>
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
                      )) : <p className="t-muted" style={{fontSize:12}}>{t('مورد قابل استخراجی در متن یافت نشد.')}</p>}
                      {body?.requires_confirmation && <span className="chip warning"><AlertTriangle size={12}/> {t('نیازمند تأیید انسانی قبل از ایجاد رکورد')}</span>}
                    </div>
                  )}

                  {body?.type==='risk_detection' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {body?.summary&&<span className="t-muted" style={{fontSize:11.5}}>{body.summary}</span>}
                      {(body?.signals?.length??0)>0 ? <div className="ai-result-grid">{body.signals.map((s:string,i:number)=><span className="chip danger" key={i}><AlertTriangle size={12}/> {s}</span>)}</div>
                      : <p className="t-muted" style={{fontSize:12}}>{t('سیگنال ریسک مشخصی در متن پیدا نشد.')}</p>}
                    </div>
                  )}

                  {body?.type==='opportunity_detection' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {body?.summary&&<span className="t-muted" style={{fontSize:11.5}}>{body.summary}</span>}
                      {(body?.signals?.length??0)>0 ? <div className="ai-result-grid">{body.signals.map((s:string,i:number)=><span className="chip success" key={i}><Target size={12}/> {s}</span>)}</div>
                      : <p className="t-muted" style={{fontSize:12}}>{t('سیگنال فرصت مشخصی در متن پیدا نشد.')}</p>}
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
                                <span><b>{sg.text}</b>{sg.kind!=='info'&&sg.refId&&<Link href={`/${sg.kind==='relationship'?'relationships':sg.kind==='opportunity'?'opportunities':sg.kind+'s'}/${sg.refId}`} style={{marginInlineStart:8,fontSize:11,display:'inline-flex',alignItems:'center',gap:3}}>{t('مشاهدهٔ رکورد')} <ArrowLeft size={11}/></Link>}</span>
                                {sg.reason&&<span className="t-muted" style={{fontSize:11}}>{sg.reason}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="t-muted" style={{fontSize:12}}>{t('پیشنهادی برای اقدام بعدی ساخته نشد.')}</p>}
                    </div>
                  )}

                  {body?.type==='executive_brief' && (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {body?.period?.start&&body?.period?.end&&(
                        <div className="ai-result-grid">
                          <span className="ai-evidence-chip"><CalendarCheck size={12}/> بازه: {new Date(body.period.start).toLocaleDateString(localeTag())} تا {new Date(body.period.end).toLocaleDateString(localeTag())}</span>
                        </div>
                      )}
                      {body?.summary&&(
                        <div className="ai-result-grid">
                          {body.summary.meetings>0&&<span className="ai-evidence-chip">{t('جلسات:')} <b>{body.summary.meetings}</b></span>}
                          {body.summary.newOpportunities>0&&<span className="ai-evidence-chip">{t('فرصت جدید:')} <b>{body.summary.newOpportunities}</b></span>}
                          {body.summary.openCommitments>0&&<span className="ai-evidence-chip">{t('تعهد باز:')} <b>{body.summary.openCommitments}</b></span>}
                          {body.summary.overdueActions>0&&<span className="ai-evidence-chip">{t('اقدام عقب‌افتاده:')} <b>{body.summary.overdueActions}</b></span>}
                          {body.summary.relationshipRisks>0&&<span className="ai-evidence-chip">{t('رابطهٔ پرریسک:')} <b>{body.summary.relationshipRisks}</b></span>}
                        </div>
                      )}
                      {(body?.recommendations?.length??0)>0 && (
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          <span className="t-muted" style={{fontSize:11,fontWeight:800}}>{t('اقدامات پیشنهادی:')}</span>
                          {(body.recommendations as string[]).map((r:string,i:number)=>(
                            <div className="ai-suggestion" key={i}><Lightbulb size={14}/><span>{r}</span></div>
                          ))}
                        </div>
                      )}
                      <Link className="btn btn-secondary" style={{alignSelf:'flex-start'}} href="/ai-executive-brief"><Briefcase size={14}/> {t('گزارش کامل هفتگی راهبردی')}</Link>
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
                                {rk.status==='WATCH'&&<span className="chip info">{t('تحت نظر')}</span>}
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
                      ) : <p className="t-muted" style={{fontSize:12}}>{t('رابطهٔ پرریسکی یافت نشد.')}</p>}
                    </div>
                  )}

                  {/* Evidence summary */}
                  {evidence && ['organizations','people','relationships','meetings','interactions','actions','commitments','opportunities','projects','documentChunks'].some(k=>evLen(evidence,k)>0) && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <span className="t-muted" style={{fontSize:11,fontWeight:800}}>{t('شواهد بازیابی‌شده (محدودهٔ مجاز):')}</span>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {evidence.organizations?.length>0 && <span className="ai-evidence-chip"><Database size={13}/> {t('سازمان:')} <b>{evidence.organizations.length}</b></span>}
                        {evidence.people?.length>0 && <span className="ai-evidence-chip"><Users size={13}/> {t('شخص:')} <b>{evidence.people.length}</b></span>}
                        {evidence.relationships?.length>0 && <span className="ai-evidence-chip"><Link2 size={13}/> {t('رابطه:')} <b>{evidence.relationships.length}</b></span>}
                        {evidence.meetings?.length>0 && <span className="ai-evidence-chip"><CalendarCheck size={13}/> {t('جلسه:')} <b>{evidence.meetings.length}</b></span>}
                        {evidence.interactions?.length>0 && <span className="ai-evidence-chip"><Zap size={13}/> {t('تعامل:')} <b>{evidence.interactions.length}</b></span>}
                        {evidence.actions?.length>0 && <span className="ai-evidence-chip"><ListChecks size={13}/> {t('اقدام:')} <b>{evidence.actions.length}</b></span>}
                        {evidence.commitments?.length>0 && <span className="ai-evidence-chip"><ShieldCheck size={13}/> {t('تعهد:')} <b>{evidence.commitments.length}</b></span>}
                        {evidence.opportunities?.length>0 && <span className="ai-evidence-chip"><Target size={13}/> {t('فرصت:')} <b>{evidence.opportunities.length}</b></span>}
                        {evidence.projects?.length>0 && <span className="ai-evidence-chip"><Briefcase size={13}/> {t('پروژه:')} <b>{evidence.projects.length}</b></span>}
                        {evidence.documentChunks?.length>0 && <span className="ai-evidence-chip"><FileText size={13}/> {t('سند:')} <b>{evidence.documentChunks.length}</b></span>}
                      </div>
                    </div>
                  )}

                  {/* Safety strip */}
                  <div className="ai-safety">
                    <span className="chip success"><ShieldCheck size={12}/> {t('آگاه از مجوز')}</span>
                    {safety?.humanConfirmationRequired===true && <span className="chip warning">{t('تأیید انسانی لازم است')}</span>}
                    {safety?.humanConfirmationRequired===false && <span className="chip neutral">{t('نیازی به تأیید ندارد')}</span>}
                    {result?.status && <span className="chip info" style={{direction:'ltr'}}>{result.status}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Engine meta (collapsible) */}
          <div className="section-card" style={{gap:10}}>
            <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}} onClick={()=>setShowMeta(s=>!s)}>
              <Info size={14}/> {showMeta?t('بستن جزئیات موتور'):t('جزئیات موتور و شفافیت')}
            </button>
            {showMeta && (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div className="ai-note">
                  <Sparkles size={15}/>
                  <span>
                    {t('این دستیار به‌صورت')} <b>{t('قاعده‌بنیان (قطعی)')}</b> {t('کار می‌کند: ابتدا شواهد فقط از داده‌های در محدودهٔ دسترسی شما بازیابی می‌شود، سپس با قوانین شفاف تحلیل و پاسخ ساخته می‌شود. در صورت پیکربندی کلید امن سمت سرور، امکان اتصال به مدل خارجی نیز وجود دارد؛ اما')} <b>{t('هیچ عملکردی به آن وابسته نیست')}</b>.
                  </span>
                </div>
                {status && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                    <div className="ai-status-item"><span className="st-ico"><Cpu size={14}/></span><div><b>{status.provider==='deterministic'?t('موتور قطعی داخلی'):status.provider}</b><span>{t('سرویس‌دهنده فعال')}</span></div></div>
                    <div className="ai-status-item"><span className="st-ico"><Zap size={14}/></span><div><b>{status.capabilities?.length??0} قابلیت</b><span>{status.capabilities?.slice(0,3).map((c:string)=>CAP_FA[c]??c).join(t('،'))}{(status.capabilities?.length??0)>3?t('و موارد دیگر'):''}</span></div></div>
                    <div className="ai-status-item"><span className="st-ico"><ShieldCheck size={14}/></span><div><b>{status.safeguards?.length??0} محافظ</b><span>{t('مجوز · محدودهٔ دسترسی · ممیزی · تأیید انسانی')}</span></div></div>
                    <div className="ai-status-item"><span className="st-ico"><Database size={14}/></span><div><b>{providerHealth?.ok===true?t('سالم'):t('تنظیم نشده')}</b><span>{t('ارائه‌دهندهٔ خارجی — همهٔ پردازش‌ها داخلی است')}</span></div></div>
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
  ['organizations',t('سازمان‌ها'),'/organizations/'],
  ['people',t('اشخاص'),'/people/'],
  ['relationships',t('روابط'),'/relationships/'],
  ['meetings',t('جلسات'),'/meetings/'],
  ['interactions',t('تعاملات'),'/interactions/'],
  ['actions',t('اقدامات'),'/actions/'],
  ['commitments',t('تعهدات'),'/commitments/'],
  ['opportunities',t('فرصت‌ها'),'/opportunities/'],
  ['projects',t('پروژه‌ها'),'/projects/'],
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
  if(kind==='relationships') return [fa(g.relationshipType),`${t('سلامت')} ${g.healthScore}`].filter(Boolean).join(' · ');
  if(kind==='meetings') return g.startAt?new Date(g.startAt).toLocaleDateString(localeTag()):'—';
  if(kind==='interactions') return g.occurredAt?new Date(g.occurredAt).toLocaleDateString(localeTag()):'—';
  if(kind==='actions') return [g.status?fa(g.status):'',g.priority?t('اولویت')+fa(g.priority):''].filter(Boolean).join(' · ');
  if(kind==='commitments') return [g.status?fa(g.status):'',g.dueAt?t('سررسید')+new Date(g.dueAt).toLocaleDateString(localeTag()):''].filter(Boolean).join(' · ');
  if(kind==='opportunities') return [g.status?fa(g.status):'',g.probability!=null?`${g.probability}${t('٪ احتمال')}`:''].filter(Boolean).join(' · ');
  return g.status?fa(g.status):'';
};
function ResultMatches({evidence}:{evidence:any}){
  if(!evidence) return null;
  const groups=MATCH_GROUPS.map(([k,label,base])=>({k,label,base,items:evidence[k]??[]})).filter(x=>x.items.length>0);
  if(!groups.length)
    return <p className="t-muted" style={{fontSize:12.5}}>{t('موردی مطابق پرس‌وجو در محدودهٔ مجاز یافت نشد.')}</p>;
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
