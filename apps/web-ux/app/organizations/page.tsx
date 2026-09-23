'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { api, unwrapList } from '../_lib/api';
import { ErrorCard, Modal, PageHeader, Skeleton, StatCard, StatusBadge, Toolbar } from '../_components/page-ui';
import { CriteriaBadge, CriteriaIntake, intakePayload, type AnswerMap, type Summary as CriteriaSummary } from '../_components/criteria';
import { Building2, Users, Share2, FolderKanban, Target, Plus, Layers, SearchX, RefreshCw, HeartPulse, AlertTriangle, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

type Criteria = CriteriaSummary | null;
type Org = { criteria?:Criteria; id:string; name:string; type:string; industry?:string|null; country?:string|null; parentOrganizationId?:string|null; owner?:{name:string}|null; _count:{people:number;sourceRelationships:number;targetRelationships:number;projects:number;opportunities:number} };
type Rel = { id:string; sourceOrganizationId?:string|null; targetOrganizationId?:string|null; status?:string|null; healthScore?:number|null; riskScore?:number|null; strategicScore?:number|null; nextActionAt?:string|null; relationshipType?:string|null };
type Interaction = { id:string; organizationId?:string|null; occurredAt?:string|null };

/* انواع سازمان از نظر نقش در شبکهٔ ارتباط (چارچوب ذی‌نفعان: بازاری/غیربازاری + ساختاری) */
const TYPE_LABELS: Record<string,string> = lt({
  HOLDING:t('هلدینگ'), SUBSIDIARY:t('شرکت تابعه'), CUSTOMER:t('مشتری'), SUPPLIER:t('تأمین‌کننده'),
  PARTNER:t('شریک راهبردی'), COMPETITOR:t('رقیب'), INVESTOR:t('سرمایه‌گذار'), BANK:t('بانک و مؤسسهٔ مالی'),
  GOVERNMENT:t('نهاد دولتی و تنظیم‌گر'), ACADEMIC:t('دانشگاه و پژوهش'), MEDIA:t('رسانه'),
  ASSOCIATION:t('اتاق و انجمن صنفی'), ECOSYSTEM:t('اکوسیستم فناوری و صنعت'), OTHER:t('سایر'),
});
const TYPE_TONES: Record<string,string> = {
  HOLDING:'purple', SUBSIDIARY:'info', CUSTOMER:'success', SUPPLIER:'neutral', PARTNER:'info',
  COMPETITOR:'danger', INVESTOR:'warning', BANK:'warning', GOVERNMENT:'neutral', ACADEMIC:'success',
  MEDIA:'purple', ASSOCIATION:'info', ECOSYSTEM:'info', OTHER:'neutral',
};
const ORG_TYPES = ['HOLDING','SUBSIDIARY','CUSTOMER','SUPPLIER','PARTNER','COMPETITOR','INVESTOR','BANK','GOVERNMENT','ACADEMIC','MEDIA','ASSOCIATION','ECOSYSTEM','OTHER'];
const SORTS = [
  { value:'name', label:t('نام سازمان') },
  { value:'health', label:t('وضعیت رابطه (ضعیف‌ترین اول)') },
  { value:'risk', label:t('بیشترین ریسک') },
  { value:'stale', label:t('قدیمی‌ترین تعامل') },
  { value:'coverage', label:t('ارزیابی ناقص‌تر اول') },
  { value:'criteria', label:t('امتیاز معیارها (کم‌تر اول)') },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat(localeTag()).format(v);

/* برچسب وضعیت رابطه بر پایهٔ تحقیق (باندهای سلامت استاندارد) */
function healthBand(h: number | null): { label: string; tone: 'success'|'info'|'warning'|'danger'|'neutral'; cls: string } {
  if (h == null) return { label:t('بدون رابطه'), tone:'neutral', cls:'h-null' };
  if (h >= 75) return { label:t('سالم'), tone:'success', cls:'h-hi' };
  if (h >= 55) return { label:t('پایدار'), tone:'info', cls:'h-mid' };
  if (h >= 40) return { label:t('در معرض ریسک'), tone:'warning', cls:'h-low' };
  return { label:t('بحرانی'), tone:'danger', cls:'h-crit' };
}

/* «مدت پیش» به فارسی */
function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return fmtNum(Math.abs(d)) + t('روز دیگر');
  if (d === 0) return t('امروز');
  if (d === 1) return t('دیروز');
  if (d < 30) return fmtNum(d) + t('روز پیش');
  if (d < 365) return fmtNum(Math.floor(d / 30)) + t('ماه پیش');
  return fmtNum(Math.floor(d / 365)) + t('سال پیش');
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' });
}

function HealthCell({ health, risk }: { health: number | null; risk: number | null }) {
  const band = healthBand(health);
  if (health == null) return <span className="health-cell"><span className={`health-dot ${band.cls}`} />{t('بدون رابطه')}</span>;
  return (
    <span className="health-cell" title={`${t('ریسک')} ${fmtNum(risk)}`}>
      <span className={`health-dot ${band.cls}`} />
      <span className="health-bar"><span className={`health-fill ${band.cls}`} style={{ width: `${health}%` }} /></span>
      <b className={`health-num ${band.cls}`}>{fmtNum(health)}</b>
      <small className={`health-band ${band.cls}`}>{band.label}</small>
    </span>
  );
}

export default function Page(){
 const [items,setItems]=useState<Org[]>([]);
 const [rels,setRels]=useState<Rel[]>([]);
 const [interactions,setInteractions]=useState<Interaction[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [typeFilter,setTypeFilter]=useState('ALL');
 const [sort,setSort]=useState<SortKey>('name');
 const [createOpen,setCreateOpen]=useState(false);
 const [form,setForm]=useState({ name:'', type:'OTHER', industry:'', country:'', parent:'' });
 /* پاسخ‌های پرسش‌نامای اختیاری — همان معیارهایی که امتیاز از آن‌ها ساخته می‌شود */
 const [intake,setIntake]=useState<AnswerMap>({});
 const [saving,setSaving]=useState(false);

 async function load(){
   setLoading(true); setError('');
   try{
     const [orgs, relList, interList] = await Promise.all([
       api('/organizations'), api('/relationships'), api('/interactions'),
     ]);
     setItems(unwrapList<Org>(orgs));
     setRels(unwrapList<Rel>(relList));
     setInteractions(unwrapList<Interaction>(interList));
   }
   catch(e){ setError((e as Error).message); }
   finally{ setLoading(false); }
 }
 useEffect(()=>{ load(); },[]);

 /* وضعیت رابطهٔ هر سازمان — از روابط و تعاملات واقعی */
 const enriched = useMemo(()=>{
   const lastInterByOrg = new Map<string,string>();
   for(const i of interactions){
     if(!i.organizationId) continue;
     const prev = lastInterByOrg.get(i.organizationId);
     if(!prev || (i.occurredAt ?? '') > prev) lastInterByOrg.set(i.organizationId, i.occurredAt ?? '');
   }
   return items.map(o=>{
     const mine = rels.filter(r=>r.sourceOrganizationId===o.id || r.targetOrganizationId===o.id);
     let health:number|null=null, risk:number|null=null, strategic:number|null=null, nextAt:string|null=null, worst:Rel|null=null;
     for(const r of mine){
       const h=r.healthScore ?? 0, k=r.riskScore ?? 0, st=r.strategicScore ?? 0;
       if(health==null || h<health){ health=h; worst=r; }
       risk = risk==null ? k : Math.max(risk,k);
       strategic = strategic==null ? st : Math.max(strategic,st);
       if(r.nextActionAt && (!nextAt || r.nextActionAt<nextAt)) nextAt=r.nextActionAt;
     }
     return { ...o, relCount:mine.length, health, risk, strategic, nextAt, worst, lastInter: lastInterByOrg.get(o.id) ?? null };
   });
 },[items,rels,interactions]);

 const filtered = useMemo(()=>{
   const q=query.trim().toLowerCase();
   const out = enriched.filter(o=>{
     if(typeFilter!=='ALL' && o.type!==typeFilter) return false;
     if(!q) return true;
     return o.name.toLowerCase().includes(q) || (o.industry??'').toLowerCase().includes(q) || (o.country??'').toLowerCase().includes(q);
   });
   switch(sort){
     case 'health': return [...out].sort((a,b)=>(a.health ?? 101)-(b.health ?? 101));
     case 'risk':   return [...out].sort((a,b)=>(b.risk ?? -1)-(a.risk ?? -1));
     case 'stale':  return [...out].sort((a,b)=>(a.lastInter ?? '').localeCompare(b.lastInter ?? ''));
    case 'coverage': return [...out].sort((a,b)=>(a.criteria?.coverage ?? -1)-(b.criteria?.coverage ?? -1));
    case 'criteria': return [...out].sort((a,b)=>(a.criteria?.score ?? -1)-(b.criteria?.score ?? -1));
     default:       return [...out].sort((a,b)=>a.name.localeCompare(b.name,'fa'));
   }
 },[enriched,query,typeFilter,sort]);

 const stats = useMemo(()=>{
   const byType:Record<string,number>={};
   let people=0, relsCount=0, projects=0, opps=0, atRisk=0, noRel=0;
   for(const o of enriched){
     byType[o.type]=(byType[o.type]??0)+1;
     people+=o._count?.people??0;
     relsCount+=o.relCount;
     projects+=o._count?.projects??0;
     opps+=o._count?.opportunities??0;
     if(o.health!=null && o.health<55) atRisk++;
     if(o.health==null && (o._count?.sourceRelationships??0)+(o._count?.targetRelationships??0)===0) noRel++;
   }
   return {total:enriched.length, byType, people, relsCount, projects, opps, atRisk, noRel};
 },[enriched]);

 async function create(e:FormEvent){
   e.preventDefault(); setSaving(true); setError('');
   try{
     await api('/organizations',{method:'POST',body:JSON.stringify({
       name:form.name, type:form.type,
       industry:form.industry.trim() || undefined,
       country:form.country.trim() || undefined,
       parentOrganizationId:form.parent || undefined,
       criteriaAnswers: intakePayload(intake),
     })});
     setForm({ name:'', type:'OTHER', industry:'', country:'', parent:'' });
     setIntake({});
     setCreateOpen(false); await load();
   }catch(err){ setError((err as Error).message); }
   finally{ setSaving(false); }
 }

 const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
   setForm(f=>({ ...f, [k]: e.target.value }));

 return (
  <main className="feature-page">
    <PageHeader
      eyebrow={t('فهرست اصلی')}
      title={t('سازمان‌ها')}
      description={t('وضعیت رابطه با هر سازمان، ریسک، آخرین تعامل و اقدام بعدی — همه در یک نگاه. ساختار سلسله‌مراتبی و زمینهٔ ارتباطات در محدودهٔ دسترسی شما.')}
      actions={
        <>
          <button className="btn btn-secondary" onClick={load} aria-label={t('بازخوانی')}><RefreshCw size={15}/> {t('بازخوانی')}</button>
          <button className="btn btn-primary" onClick={()=>setCreateOpen(true)}><Plus size={16}/> {t('سازمان جدید')}</button>
        </>
      }
    />
    <ErrorCard message={error}/>

    {loading ? (
      <div className="stat-grid">{[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-card" style={{height:110}}/>)}</div>
    ) : (
      <div className="stat-grid">
        <StatCard icon={<Building2 size={18}/>} label={t('کل سازمان‌ها')} value={fmtNum(stats.total)} href="/organizations" iconClass="ic-blue" sub={t('در محدودهٔ مجاز')}/>
        <StatCard icon={<Layers size={18}/>} label={t('هلدینگ‌ها')} value={fmtNum(stats.byType['HOLDING']??0)} iconClass="ic-purple" sub={`${fmtNum(stats.byType['SUBSIDIARY']??0)} ${t('زیرمجموعه')}`}/>
        <StatCard icon={<Users size={18}/>} label={t('اشخاص مرتبط')} value={fmtNum(stats.people)} href="/people" iconClass="ic-teal"/>
        <StatCard icon={<Share2 size={18}/>} label={t('روابط ثبت‌شده')} value={fmtNum(stats.relsCount)} href="/relationships" iconClass="ic-indigo"/>
        <StatCard icon={<AlertTriangle size={18}/>} label={t('در معرض ریسک')} value={fmtNum(stats.atRisk)} href="/relationships" iconClass="ic-red" sub={t('سلامت زیر ۵۵ یا بحرانی')}/>
        <StatCard icon={<FolderKanban size={18}/>} label={t('پروژه‌ها')} value={fmtNum(stats.projects)} href="/projects" iconClass="ic-gold"/>
        <StatCard icon={<Target size={18}/>} label={t('فرصت‌ها')} value={fmtNum(stats.opps)} href="/opportunities" iconClass="ic-green"/>
      </div>
    )}

    <Toolbar search={query} onSearch={setQuery} searchPlaceholder={t('جستجوی نام، صنعت یا کشور…')}>
      <select aria-label={t('فیلتر نوع')} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="toolbar-select">
        <option value="ALL">{t('همهٔ انواع')}</option>
        {ORG_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </select>
      <label className="toolbar-sort" aria-label={t('مرتب‌سازی')}>
        <ArrowDownWideNarrow size={14}/>
        <select value={sort} onChange={e=>setSort(e.target.value as SortKey)}>
          {SORTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <span className="chip info" style={{marginInlineStart:'auto'}}>{fmtNum(filtered.length)} نتیجه</span>
    </Toolbar>

    {loading ? (
      <div className="skeleton skeleton-table"/>
    ) : filtered.length===0 ? (
      <div className="empty-state-v4">
        <div className="empty-ico"><SearchX size={24}/></div>
        <strong>{items.length===0?t('سازمانی ثبت نشده است'):t('نتیجه‌ای یافت نشد')}</strong>
        <p>{items.length===0?t('از دکمهٔ «سازمان جدید» برای ثبت اولین سازمان استفاده کنید.'):t('فیلترها یا عبارت جستجو را تغییر دهید.')}</p>
      </div>
    ) : (
      <div className="table-wrap">
        <table className="org-table">
          <thead>
            <tr>
              <th>{t('نام سازمان')}</th><th>{t('نوع')}</th>
              <th>{t('وضعیت رابطه')}</th><th>{t('ریسک')}</th>
              <th>{t('آخرین تعامل')}</th><th>{t('اقدام بعدی')}</th>
              <th>{t('ارزیابی معیارها')}</th>
              <th>{t('اشخاص')}</th><th>{t('روابط')}</th><th>{t('پروژه/فرصت')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o=>{
              const band = healthBand(o.health);
              return (
              <tr key={o.id} className={o.health!=null && o.health<55 ? 'row-alert' : ''}>
                <td>
                  <Link className="t-primary" href={`/organizations/${o.id}`}>{o.name}</Link>
                  <div className="t-muted">{o.industry || '—'}{o.owner?.name ? ` ${t('· مالک:')} ${o.owner.name}` : ''}</div>
                </td>
                <td><StatusBadge tone={(TYPE_TONES[o.type] as any)??'neutral'}>{TYPE_LABELS[o.type]??t('سایر')}</StatusBadge></td>
                <td><HealthCell health={o.health} risk={o.risk}/></td>
                <td>
                  {o.risk==null ? <span className="t-muted">—</span> : (
                    <span className={`risk-cell ${o.risk>=60?'risk-hi':o.risk>=40?'risk-mid':'risk-lo'}`}>
                      {o.risk>=60?<AlertTriangle size={12}/>:null}{fmtNum(o.risk)}
                    </span>
                  )}
                </td>
                <td className="t-muted">{timeAgo(o.lastInter)}</td>
                <td className="t-muted">{o.nextAt ? fmtDate(o.nextAt) : '—'}</td>
                <td><CriteriaBadge criteria={o.criteria}/></td>
                <td className="t-num">{fmtNum(o._count?.people??0)}</td>
                <td className="t-num">{fmtNum(o.relCount)}</td>
                <td className="t-num">{fmtNum((o._count?.projects??0)+(o._count?.opportunities??0))}</td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    )}

    <Modal
      open={createOpen}
      title={t('ثبت سازمان جدید')}
      description={t('سازمان در محدودهٔ دسترسی شما ایجاد می‌شود و بلافاصله در فهرست با وضعیت «بدون رابطه» ظاهر می‌شود.')}
      onClose={()=>setCreateOpen(false)}
      footer={<>
        <button className="btn btn-secondary" onClick={()=>setCreateOpen(false)}>{t('انصراف')}</button>
        <button className="btn btn-primary" form="org-create-form" type="submit" disabled={saving}>{saving?t('در حال ثبت…'):t('ثبت سازمان')}</button>
      </>}
    >
      <form id="org-create-form" className="entity-form org-form" onSubmit={create}>
        <div className="form-section-head"><h3>{t('اطلاعات پایه')}</h3></div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="org-name">{t('نام سازمان')} <span className="req">*</span></label>
            <input id="org-name" value={form.name} onChange={set('name')} minLength={2} placeholder={t('مثلاً: شرکت فناوری آریا')} required autoFocus/>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="org-type">{t('نوع سازمان')}</label>
            <select id="org-type" value={form.type} onChange={set('type')}>
              {ORG_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>

        <div className="form-section-head"><h3>{t('مشخصات تکمیلی')}</h3></div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="org-industry">{t('صنعت')}</label>
            <input id="org-industry" value={form.industry} onChange={set('industry')} placeholder={t('مثلاً: نرم‌افزار، بانکداری، پتروشیمی')}/>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="org-country">{t('کشور')}</label>
            <input id="org-country" value={form.country} onChange={set('country')} placeholder={t('مثلاً: ایران')}/>
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="org-parent">{t('سازمان مادر (اختیاری)')}</label>
            <select id="org-parent" value={form.parent} onChange={set('parent')}>
              <option value="">{t('بدون سازمان مادر')}</option>
              {items.filter(o=>o.id!==form.parent).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <span className="field-hint">{t('برای ساخت سلسله‌مراتب هلدینگ، سازمان مادر را انتخاب کنید؛ این سازمان به‌صورت «زیرمجموعه» در نمای گروه نمایش داده می‌شود.')}</span>
          </div>
        </div>
        <div className="form-section-head"><h3>{t('معیارهای ارزیابی')}</h3></div>
        <CriteriaIntake
          subjectType="ORGANIZATION"
          answers={intake}
          onChange={setIntake}
          heading={t('چیزی که همین حالا می‌دانید (اختیاری)')}
        />
      </form>
    </Modal>
  </main>
 );
}
