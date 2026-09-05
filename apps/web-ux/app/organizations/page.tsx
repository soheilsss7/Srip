'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { api, unwrapList } from '../_lib/api';
import { ErrorCard, Modal, PageHeader, Skeleton, StatCard, StatusBadge, Toolbar } from '../_components/page-ui';
import { Building2, Users, Share2, FolderKanban, Target, Plus, Layers, SearchX, RefreshCw, HeartPulse, AlertTriangle, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';

type Org = { id:string; name:string; type:string; industry?:string|null; country?:string|null; parentOrganizationId?:string|null; owner?:{name:string}|null; _count:{people:number;sourceRelationships:number;targetRelationships:number;projects:number;opportunities:number} };
type Rel = { id:string; sourceOrganizationId?:string|null; targetOrganizationId?:string|null; status?:string|null; healthScore?:number|null; riskScore?:number|null; strategicScore?:number|null; nextActionAt?:string|null; relationshipType?:string|null };
type Interaction = { id:string; organizationId?:string|null; occurredAt?:string|null };

const TYPE_LABELS: Record<string,string> = {
  HOLDING:'هلدینگ', SUBSIDIARY:'زیرمجموعه', CUSTOMER:'مشتری', PARTNER:'شریک', BANK:'بانک',
  GOVERNMENT:'دولتی', INVESTOR:'سرمایه‌گذار', SUPPLIER:'تأمین‌کننده', OTHER:'سایر',
};
const TYPE_TONES: Record<string,string> = {
  HOLDING:'purple', SUBSIDIARY:'info', CUSTOMER:'success', PARTNER:'info', BANK:'warning',
  GOVERNMENT:'neutral', INVESTOR:'warning', SUPPLIER:'neutral', OTHER:'neutral',
};
const ORG_TYPES = ['HOLDING','SUBSIDIARY','CUSTOMER','PARTNER','BANK','GOVERNMENT','INVESTOR','SUPPLIER','OTHER'];
const SORTS = [
  { value:'name', label:'نام سازمان' },
  { value:'health', label:'وضعیت رابطه (ضعیف‌ترین اول)' },
  { value:'risk', label:'بیشترین ریسک' },
  { value:'stale', label:'قدیمی‌ترین تعامل' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);

/* برچسب وضعیت رابطه بر پایهٔ تحقیق (باندهای سلامت استاندارد) */
function healthBand(h: number | null): { label: string; tone: 'success'|'info'|'warning'|'danger'|'neutral'; cls: string } {
  if (h == null) return { label:'بدون رابطه', tone:'neutral', cls:'h-null' };
  if (h >= 75) return { label:'سالم', tone:'success', cls:'h-hi' };
  if (h >= 55) return { label:'پایدار', tone:'info', cls:'h-mid' };
  if (h >= 40) return { label:'در معرض ریسک', tone:'warning', cls:'h-low' };
  return { label:'بحرانی', tone:'danger', cls:'h-crit' };
}

/* «مدت پیش» به فارسی */
function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return fmtNum(Math.abs(d)) + ' روز دیگر';
  if (d === 0) return 'امروز';
  if (d === 1) return 'دیروز';
  if (d < 30) return fmtNum(d) + ' روز پیش';
  if (d < 365) return fmtNum(Math.floor(d / 30)) + ' ماه پیش';
  return fmtNum(Math.floor(d / 365)) + ' سال پیش';
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function HealthCell({ health, risk }: { health: number | null; risk: number | null }) {
  const band = healthBand(health);
  if (health == null) return <span className="health-cell"><span className={`health-dot ${band.cls}`} />بدون رابطه</span>;
  return (
    <span className="health-cell" title={`ریسک ${fmtNum(risk)}`}>
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
     })});
     setForm({ name:'', type:'OTHER', industry:'', country:'', parent:'' });
     setCreateOpen(false); await load();
   }catch(err){ setError((err as Error).message); }
   finally{ setSaving(false); }
 }

 const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
   setForm(f=>({ ...f, [k]: e.target.value }));

 return (
  <main className="feature-page">
    <PageHeader
      eyebrow="فهرست اصلی"
      title="سازمان‌ها"
      description="وضعیت رابطه با هر سازمان، ریسک، آخرین تعامل و اقدام بعدی — همه در یک نگاه. ساختار سلسله‌مراتبی و زمینهٔ ارتباطات در محدودهٔ دسترسی شما."
      actions={
        <>
          <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15}/> بازخوانی</button>
          <button className="btn btn-primary" onClick={()=>setCreateOpen(true)}><Plus size={16}/> سازمان جدید</button>
        </>
      }
    />
    <ErrorCard message={error}/>

    {loading ? (
      <div className="stat-grid">{[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-card" style={{height:110}}/>)}</div>
    ) : (
      <div className="stat-grid">
        <StatCard icon={<Building2 size={18}/>} label="کل سازمان‌ها" value={fmtNum(stats.total)} href="/organizations" iconClass="ic-blue" sub="در محدودهٔ مجاز"/>
        <StatCard icon={<Layers size={18}/>} label="هلدینگ‌ها" value={fmtNum(stats.byType['HOLDING']??0)} iconClass="ic-purple" sub={`${fmtNum(stats.byType['SUBSIDIARY']??0)} زیرمجموعه`}/>
        <StatCard icon={<Users size={18}/>} label="اشخاص مرتبط" value={fmtNum(stats.people)} href="/people" iconClass="ic-teal"/>
        <StatCard icon={<Share2 size={18}/>} label="روابط ثبت‌شده" value={fmtNum(stats.relsCount)} href="/relationships" iconClass="ic-indigo"/>
        <StatCard icon={<AlertTriangle size={18}/>} label="در معرض ریسک" value={fmtNum(stats.atRisk)} href="/relationships" iconClass="ic-red" sub="سلامت زیر ۵۵ یا بحرانی"/>
        <StatCard icon={<FolderKanban size={18}/>} label="پروژه‌ها" value={fmtNum(stats.projects)} href="/projects" iconClass="ic-gold"/>
        <StatCard icon={<Target size={18}/>} label="فرصت‌ها" value={fmtNum(stats.opps)} href="/opportunities" iconClass="ic-green"/>
      </div>
    )}

    <Toolbar search={query} onSearch={setQuery} searchPlaceholder="جستجوی نام، صنعت یا کشور…">
      <select aria-label="فیلتر نوع" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="toolbar-select">
        <option value="ALL">همهٔ انواع</option>
        {ORG_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </select>
      <label className="toolbar-sort" aria-label="مرتب‌سازی">
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
        <strong>{items.length===0?'سازمانی ثبت نشده است':'نتیجه‌ای یافت نشد'}</strong>
        <p>{items.length===0?'از دکمهٔ «سازمان جدید» برای ثبت اولین سازمان استفاده کنید.':'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
      </div>
    ) : (
      <div className="table-wrap">
        <table className="org-table">
          <thead>
            <tr>
              <th>نام سازمان</th><th>نوع</th>
              <th>وضعیت رابطه</th><th>ریسک</th>
              <th>آخرین تعامل</th><th>اقدام بعدی</th>
              <th>اشخاص</th><th>روابط</th><th>پروژه/فرصت</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o=>{
              const band = healthBand(o.health);
              return (
              <tr key={o.id} className={o.health!=null && o.health<55 ? 'row-alert' : ''}>
                <td>
                  <Link className="t-primary" href={`/organizations/${o.id}`}>{o.name}</Link>
                  <div className="t-muted">{o.industry || '—'}{o.owner?.name ? ` · مالک: ${o.owner.name}` : ''}</div>
                </td>
                <td><StatusBadge tone={(TYPE_TONES[o.type] as any)??'neutral'}>{TYPE_LABELS[o.type]??'سایر'}</StatusBadge></td>
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
      title="ثبت سازمان جدید"
      description="سازمان در محدودهٔ دسترسی شما ایجاد می‌شود و بلافاصله در فهرست با وضعیت «بدون رابطه» ظاهر می‌شود."
      onClose={()=>setCreateOpen(false)}
      footer={<>
        <button className="btn btn-secondary" onClick={()=>setCreateOpen(false)}>انصراف</button>
        <button className="btn btn-primary" form="org-create-form" type="submit" disabled={saving}>{saving?'در حال ثبت…':'ثبت سازمان'}</button>
      </>}
    >
      <form id="org-create-form" className="entity-form org-form" onSubmit={create}>
        <div className="form-section-head"><h3>اطلاعات پایه</h3></div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="org-name">نام سازمان <span className="req">*</span></label>
            <input id="org-name" value={form.name} onChange={set('name')} minLength={2} placeholder="مثلاً: شرکت فناوری آریا" required autoFocus/>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="org-type">نوع سازمان</label>
            <select id="org-type" value={form.type} onChange={set('type')}>
              {ORG_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>

        <div className="form-section-head"><h3>مشخصات تکمیلی</h3></div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="org-industry">صنعت</label>
            <input id="org-industry" value={form.industry} onChange={set('industry')} placeholder="مثلاً: نرم‌افزار، بانکداری، پتروشیمی"/>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="org-country">کشور</label>
            <input id="org-country" value={form.country} onChange={set('country')} placeholder="مثلاً: ایران"/>
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="org-parent">سازمان مادر (اختیاری)</label>
            <select id="org-parent" value={form.parent} onChange={set('parent')}>
              <option value="">بدون سازمان مادر</option>
              {items.filter(o=>o.id!==form.parent).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <span className="field-hint">برای ساخت سلسله‌مراتب هلدینگ، سازمان مادر را انتخاب کنید؛ این سازمان به‌صورت «زیرمجموعه» در نمای گروه نمایش داده می‌شود.</span>
          </div>
        </div>
      </form>
    </Modal>
  </main>
 );
}
