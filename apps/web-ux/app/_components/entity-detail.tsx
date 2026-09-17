'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {api,ApiError} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from './page-ui';
import {RefreshCw, ChevronLeft, Clock, CheckCircle2, XCircle} from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

const arr=(x:any)=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.data)?x.data:Array.isArray(x?.rows)?x.rows:[];
const value=(x:any)=>x==null?'—':typeof x==='object'?(x.name??x.title??x.label??x.id??JSON.stringify(x)):String(x);

const STATUS_FA: Record<string,string> = lt({
  ACTIVE:t('فعال'), DONE:t('انجام‌شده'), COMPLETED:t('تکمیل‌شده'), APPROVED:t('تأییدشده'), EXECUTED:t('اجرا شده'),
  SUCCESS:t('موفق'), OPEN:t('باز'), FULFILLED:t('انجام‌شده'), HEALTHY:t('سالم'), REJECTED:t('ردشده'),
  CANCELLED:t('لغوشده'), FAILED:t('ناموفق'), BLOCKED:t('مسدود'), ARCHIVED:t('بایگانی‌شده'), LOST:t('از دست رفته'),
  OVERDUE:t('عقب‌افتاده'), CRITICAL:t('بحرانی'), WATCH:t('تحت نظر'), PENDING:t('در انتظار'), SNOOZED:t('به تعویق افتاده'),
  AT_RISK:t('در معرض ریسک'), IN_PROGRESS:t('در حال انجام'), PLANNED:t('برنامه‌ریزی‌شده'), WARNING:t('هشدار'),
  PROPOSED:t('پیشنهادی'), ASSIGNED:t('اختصاص‌یافته'), DEVELOPING:t('در حال توسعه'), INTRODUCED:t('معرفی‌شده'),
  IDENTIFIED:t('شناسایی‌شده'), INITIAL_CONTACT:t('تماس اولیه'), STRATEGIC:t('راهبردی'), MITIGATED:t('کاهش‌یافته'),
  ACCEPTED:t('پذیرفته‌شده'), ERASED:t('پاک‌شده'), GRANTED:t('اعطاشده'), PROCESSING:t('در حال پردازش'),
  SATISFIED:t('برآورده‌شده'), UNENGAGED:t('بدون درگیری'), DORMANT:t('خفته'), PROSPECTIVE:t('آینده‌نگر'),
  RISING:t('رو به رشد'), DECLINING:t('در حال افول'), STABLE:t('پایدار'), NEGOTIATION:t('در حال مذاکره'),
  LOYAL:t('وفادار'), NEW:t('جدید'), TRANSITION:t('در گذار'), EXPANDING:t('در حال گسترش'),
  CLOSED:t('بسته'), ERASURE:t('پاک‌سازی'), EXPORT:t('خروجی'), ACCESS:t('دسترسی'), NEGATIVE:t('منفی'),
  POSITIVE:t('مثبت'), NEUTRAL:t('خنثی'), LOW:t('کم'), MEDIUM:t('متوسط'), HIGH:t('زیاد'),
  PHONE:t('تلفن'), EMAIL:t('ایمیل'), ADDRESS:t('نشانی'), WEBSITE:t('وب‌سایت'), LINKEDIN:t('لینکدین'), OTHER:t('سایر'),
  INTERNAL:t('داخلی'), CONFIDENTIAL:t('محرمانه'), RESTRICTED:t('محدود'), PUBLIC:t('عمومی'),
  READY:t('آماده'), CLEAN:t('پاک'), NOT_REQUIRED:t('غیرضروری'), QUARANTINED:t('قرنطینه‌شده'), INFECTED:t('آلوده'),
  ERROR:t('خطا'), CUSTOMER:t('مشتری'), SUPPLIER:t('تأمین‌کننده'), PARTNER:t('شریک'), COMPETITOR:t('رقبا'),
  INVESTOR:t('سرمایه‌گذار'), REGULATOR:t('ناظر'), GOVERNMENT:t('دولت'), MEDIA:t('رسانه'), NGO:t('سازمان مردم‌نهاد'),
});
const KEY_FA: Record<string,string> = lt({
  id:t('شناسه'), firstName:t('نام'), lastName:t('نام خانوادگی'), displayName:t('نام نمایشی'), email:t('ایمیل'),
  phone:t('تلفن'), title:t('سمت'), department:t('بخش'), country:t('کشور'), city:t('شهر'), address:t('نشانی'),
  type:t('نوع'), status:t('وضعیت'), state:t('وضعیت'), name:t('نام'), description:t('توضیح'), summary:t('خلاصه'),
  notes:t('یادداشت‌ها'), objective:t('هدف'), agenda:t('دستور کار'), outcome:t('نتیجه'), decisions:t('تصمیم‌ها'),
  createdAt:t('تاریخ ایجاد'), updatedAt:t('تاریخ به‌روزرسانی'), createdBy:t('ایجادشده توسط'),
  organizationId:t('شناسه سازمان'), personId:t('شناسه شخص'), relationshipId:t('شناسه رابطه'),
  meetingId:t('شناسه جلسه'), projectId:t('شناسه پروژه'), ownerId:t('شناسه مالک'), assigneeId:t('شناسه مسئول'),
  relationshipType:t('نوع رابطه'), healthScore:t('امتیاز سلامت'), riskScore:t('امتیاز ریسک'),
  strategicScore:t('امتیاز راهبردی'), influenceScore:t('امتیاز نفوذ'), decisionPower:t('قدرت تصمیم'),
  sourceOrganizationId:t('شناسه سازمان مبدأ'), targetOrganizationId:t('شناسه سازمان مقصد'),
  interactionCount:t('تعداد تعاملات'), meetingCount:t('تعداد جلسات'), lastInteractionAt:t('آخرین تعامل'),
  nextMeetingAt:t('جلسه بعدی'), sentiment:t('احساس'), importance:t('اهمیت'), followUpRequired:t('نیازمند پیگیری'),
  followUpAt:t('موعد پیگیری'), occurredAt:t('زمان وقوع'), startAt:t('شروع'), endAt:t('پایان'), dueAt:t('سررسید'),
  completedAt:t('تاریخ تکمیل'), probability:t('احتمال'), impact:t('تأثیر'), mitigation:t('پایش'),
  priority:t('اولویت'), category:t('دسته'), score:t('امتیاز'), value:t('ارزش'), version:t('نسخه'), purpose:t('هدف'),
  legalBasis:t('مبنای قانونی'), classification:t('طبقه‌بندی'), retentionDays:t('روزهای نگهداری'),
  erasable:t('قابل پاک‌سازی'), source:t('منبع'), label:t('برچسب'), isPrimary:t('اصلی'), key:t('کلید'),
  enabled:t('فعال'), rollout:t('گسترش تدریجی'), permissions:t('مجوزها'), role:t('نقش'), effect:t('اثر'),
  permissionKey:t('کلید مجوز'), severity:t('شدت'), ipAddress:t('نشانی IP'), userAgent:t('مرورگر'),
  eventType:t('نوع رویداد'), kind:t('نوع'), date:t('تاریخ'), time:t('زمان'), url:t('نشانی'), meetingUrl:t('لینک جلسه'),
  location:t('مکان'), industry:t('صنعت'), parentOrganizationId:t('سازمان مادر'), parentUnitId:t('واحد والد'),
  organizationName:t('نام سازمان'), organization:t('سازمان'), person:t('شخص'), relationship:t('رابطه'),
  totalRecords:t('تعداد رکوردها'), jobId:t('شناسه کار'), manifestUrl:t('نشانی خروجی'), until:t('تا تاریخ'),
  suggestedTitle:t('عنوان پیشنهادی'), suggestedDueAt:t('سررسید پیشنهادی'), text:t('متن'), matchedKeyword:t('کلیدواژه'),
});
const labelOf=(k:string)=>KEY_FA[k]??(k.replace(/[A-Z]/g,c=>' '+c.toLowerCase()).replace(/_/g,' '));
const faValue=(v:any)=>STATUS_FA[String(v).toUpperCase()]??v;

/** Pretty-print a single field (dates, booleans, ids) */
function prettyField(key:string,v:any){
  if(v==null||v==='') return <span className="t-muted">—</span>;
  if(typeof v==='boolean') return <StatusBadge tone={v?'success':'neutral'}>{v?t('بله'):t('خیر')}</StatusBadge>;
  if(typeof v==='object') return <span dir="ltr" style={{fontSize:11.5}}>{value(v)}</span>;
  const s=String(v);
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const d=new Date(s);
    if(!isNaN(d.getTime())){
      try{ return <span>{d.toLocaleString(localeTag(),{dateStyle:'medium',timeStyle:'short'})}</span>; }catch{}
    }
  }
  if(key.toLowerCase().includes('status')||key.toLowerCase().includes('state'))
    return <StatusBadge tone={statusTone(s)}>{faValue(s)}</StatusBadge>;
  if(key==='id'||key.endsWith('Id')) return <span className="t-muted" dir="ltr" style={{fontSize:11}}>{s}</span>;
  if(/^[a-z_]+$/.test(s)) return <span dir="ltr" style={{fontSize:11.5}}>{s}</span>;
  return <span>{s}</span>;
}
function statusTone(s:string):'success'|'danger'|'warning'|'info'|'neutral'{
  const u=s.toUpperCase();
  if(['ACTIVE','DONE','COMPLETED','APPROVED','EXECUTED','SUCCESS','OPEN','FULFILLED','HEALTHY'].includes(u)) return 'success';
  if(['REJECTED','CANCELLED','FAILED','BLOCKED','ARCHIVED','LOST','OVERDUE','CRITICAL'].includes(u)) return 'danger';
  if(['WATCH','PENDING','SNOOZED','AT_RISK','IN_PROGRESS','PLANNED','WARNING'].includes(u)) return 'warning';
  if(['PROPOSED','ASSIGNED','DEVELOPING','INTRODUCED','IDENTIFIED','INITIAL_CONTACT','STRATEGIC'].includes(u)) return 'info';
  return 'neutral';
}
function StatusBadge({children,tone}:{children:React.ReactNode;tone:'success'|'danger'|'warning'|'info'|'neutral'}){
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function EntityDetail({title,eyebrow,endpoint,id,actions=[],timelineEndpoint,backHref,backLabel}:{
  title:string;eyebrow:string;endpoint:string;id:string;
  actions?:{label:string;method:'POST'|'PATCH'|'DELETE';path:string;body?:unknown;confirm?:string;tone?:'primary'|'secondary'|'danger'}[];
  timelineEndpoint?:string;backHref?:string;backLabel?:string;
}){
 const[d,setD]=useState<any>(null),[timeline,setTimeline]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
   try{
     setError('');
     setD(await api(`${endpoint}/${encodeURIComponent(id)}`));
     if(timelineEndpoint) setTimeline(arr(await api(`${timelineEndpoint.replace(':id',encodeURIComponent(id))}`)));
   }catch(e){setError(e instanceof ApiError?e.message:(e as Error).message)}
 },[endpoint,id,timelineEndpoint]);
 useEffect(()=>{load()},[load]);
 async function act(a:any){
   if(a.confirm&&!confirm(a.confirm))return;
   setBusy(true);
   try{await api(a.path.replace(':id',encodeURIComponent(id)),{method:a.method,body:a.method==='DELETE'?undefined:JSON.stringify(a.body??{})});await load();}
   catch(e){setError((e as Error).message)}
   finally{setBusy(false)}
 }
 const fields=d?Object.entries(d).filter(([k])=>!k.startsWith('_')&&k!=='timeline'&&typeof d[k]!=='function').slice(0,30):[];
 return (
  <main className="feature-page">
    <nav className="breadcrumbs" aria-label={t('مسیر')}>
      {backHref?<><Link href={backHref}>{backLabel??t('بازگشت')}</Link><span className="sep">/</span><span className="current">{title}</span></>
      :<span className="current">{title}</span>}
    </nav>
    <PageHeader eyebrow={eyebrow} title={title} description={`${t('شناسه:')} ${id}`} actions={
      <div className="toolbar">
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={busy}><RefreshCw size={14}/> {t('بازخوانی')}</button>
        {actions.map(a=>
          <button key={a.label} disabled={busy}
            className={`btn btn-sm ${a.method==='DELETE'||a.tone==='danger'?'btn-danger':a.tone==='secondary'?'btn-secondary':'btn-primary'}`}
            onClick={()=>act(a)}>{a.label}</button>)}
      </div>
    }/>
    <ErrorCard message={error}/>
    {!d&&!error?<Loading/>:d?<>
      <section className="section-card">
        <div className="section-head">
          <div><h2>{t('جزئیات')}</h2><p>{t('دادهٔ زنده از سرور — فقط در محدودهٔ دسترسی شما')}</p></div>
          {d.status!==undefined&&<StatusBadge tone={statusTone(String(d.status))}>{faValue(String(d.status))}</StatusBadge>}
        </div>
        <div className="detail-grid">{fields.map(([k,v])=>
          <div className="detail-item" key={k}><small>{labelOf(k)}</small><strong>{prettyField(k,v)}</strong></div>
        )}</div>
      </section>
      {timelineEndpoint&&(
        <section className="section-card">
          <div className="section-head">
            <div><h2><Clock size={17}/> {t('خط زمانی')}</h2><p>{t('رویدادهای ثبت‌شده برای این موجودیت')}</p></div>
            <span className="chip info">{timeline.length} رویداد</span>
          </div>
          {timeline.length?(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {timeline.slice(0,30).map((x:any,i:number)=>(
                <div className="ai-match-card" key={x.id??i} style={{flexDirection:'row',alignItems:'center',gap:10,display:'flex'}}>
                  <span className="chip neutral">{faValue((x as any).kind)??t('رویداد')}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <b>{x.title||x.subject||x.description||x.name||x.eventType||'—'}</b>
                    {(x.date||x.createdAt)?<div className="match-meta" style={{marginTop:2}}>{new Date(x.date??x.createdAt).toLocaleString(localeTag(),{dateStyle:'medium',timeStyle:'short'})}</div>:null}
                  </div>
                  {x.status&&<StatusBadge tone={statusTone(String(x.status))}>{faValue(String(x.status))}</StatusBadge>}
                </div>
              ))}
            </div>
          ):<Empty>{t('رویدادی ثبت نشده است.')}</Empty>}
        </section>
      )}
    </>:null}
  </main>
 );
}

export {CheckCircle2, XCircle, ChevronLeft};
