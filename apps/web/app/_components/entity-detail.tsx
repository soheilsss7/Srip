'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {api,ApiError} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from './page-ui';
import {RefreshCw, ChevronLeft, Clock, CheckCircle2, XCircle} from 'lucide-react';

const arr=(x:any)=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.data)?x.data:Array.isArray(x?.rows)?x.rows:[];
const value=(x:any)=>x==null?'—':typeof x==='object'?(x.name??x.title??x.label??x.id??JSON.stringify(x)):String(x);

const STATUS_FA: Record<string,string> = {
  ACTIVE:'فعال', DONE:'انجام‌شده', COMPLETED:'تکمیل‌شده', APPROVED:'تأییدشده', EXECUTED:'اجرا شده',
  SUCCESS:'موفق', OPEN:'باز', FULFILLED:'انجام‌شده', HEALTHY:'سالم', REJECTED:'ردشده',
  CANCELLED:'لغوشده', FAILED:'ناموفق', BLOCKED:'مسدود', ARCHIVED:'بایگانی‌شده', LOST:'از دست رفته',
  OVERDUE:'عقب‌افتاده', CRITICAL:'بحرانی', WATCH:'تحت نظر', PENDING:'در انتظار', SNOOZED:'به تعویق افتاده',
  AT_RISK:'در معرض ریسک', IN_PROGRESS:'در حال انجام', PLANNED:'برنامه‌ریزی‌شده', WARNING:'هشدار',
  PROPOSED:'پیشنهادی', ASSIGNED:'اختصاص‌یافته', DEVELOPING:'در حال توسعه', INTRODUCED:'معرفی‌شده',
  IDENTIFIED:'شناسایی‌شده', INITIAL_CONTACT:'تماس اولیه', STRATEGIC:'راهبردی', MITIGATED:'کاهش‌یافته',
  ACCEPTED:'پذیرفته‌شده', ERASED:'پاک‌شده', GRANTED:'اعطاشده', PROCESSING:'در حال پردازش',
  SATISFIED:'برآورده‌شده', UNENGAGED:'بدون درگیری', DORMANT:'خفته', PROSPECTIVE:'آینده‌نگر',
  RISING:'رو به رشد', DECLINING:'در حال افول', STABLE:'پایدار', NEGOTIATION:'در حال مذاکره',
  LOYAL:'وفادار', NEW:'جدید', TRANSITION:'در گذار', EXPANDING:'در حال گسترش',
  CLOSED:'بسته', ERASURE:'پاک‌سازی', EXPORT:'خروجی', ACCESS:'دسترسی', NEGATIVE:'منفی',
  POSITIVE:'مثبت', NEUTRAL:'خنثی', LOW:'کم', MEDIUM:'متوسط', HIGH:'زیاد',
  PHONE:'تلفن', EMAIL:'ایمیل', ADDRESS:'نشانی', WEBSITE:'وب‌سایت', LINKEDIN:'لینکدین', OTHER:'سایر',
  INTERNAL:'داخلی', CONFIDENTIAL:'محرمانه', RESTRICTED:'محدود', PUBLIC:'عمومی',
  READY:'آماده', CLEAN:'پاک', NOT_REQUIRED:'غیرضروری', QUARANTINED:'قرنطینه‌شده', INFECTED:'آلوده',
  ERROR:'خطا', CUSTOMER:'مشتری', SUPPLIER:'تأمین‌کننده', PARTNER:'شریک', COMPETITOR:'رقبا',
  INVESTOR:'سرمایه‌گذار', REGULATOR:'ناظر', GOVERNMENT:'دولت', MEDIA:'رسانه', NGO:'سازمان مردم‌نهاد',
};
const KEY_FA: Record<string,string> = {
  id:'شناسه', firstName:'نام', lastName:'نام خانوادگی', displayName:'نام نمایشی', email:'ایمیل',
  phone:'تلفن', title:'سمت', department:'بخش', country:'کشور', city:'شهر', address:'نشانی',
  type:'نوع', status:'وضعیت', state:'وضعیت', name:'نام', description:'توضیح', summary:'خلاصه',
  notes:'یادداشت‌ها', objective:'هدف', agenda:'دستور کار', outcome:'نتیجه', decisions:'تصمیم‌ها',
  createdAt:'تاریخ ایجاد', updatedAt:'تاریخ به‌روزرسانی', createdBy:'ایجادشده توسط',
  organizationId:'شناسه سازمان', personId:'شناسه شخص', relationshipId:'شناسه رابطه',
  meetingId:'شناسه جلسه', projectId:'شناسه پروژه', ownerId:'شناسه مالک', assigneeId:'شناسه مسئول',
  relationshipType:'نوع رابطه', healthScore:'امتیاز سلامت', riskScore:'امتیاز ریسک',
  strategicScore:'امتیاز راهبردی', influenceScore:'امتیاز نفوذ', decisionPower:'قدرت تصمیم',
  sourceOrganizationId:'شناسه سازمان مبدأ', targetOrganizationId:'شناسه سازمان مقصد',
  interactionCount:'تعداد تعاملات', meetingCount:'تعداد جلسات', lastInteractionAt:'آخرین تعامل',
  nextMeetingAt:'جلسه بعدی', sentiment:'احساس', importance:'اهمیت', followUpRequired:'نیازمند پیگیری',
  followUpAt:'موعد پیگیری', occurredAt:'زمان وقوع', startAt:'شروع', endAt:'پایان', dueAt:'سررسید',
  completedAt:'تاریخ تکمیل', probability:'احتمال', impact:'تأثیر', mitigation:'پایش',
  priority:'اولویت', category:'دسته', score:'امتیاز', value:'ارزش', version:'نسخه', purpose:'هدف',
  legalBasis:'مبنای قانونی', classification:'طبقه‌بندی', retentionDays:'روزهای نگهداری',
  erasable:'قابل پاک‌سازی', source:'منبع', label:'برچسب', isPrimary:'اصلی', key:'کلید',
  enabled:'فعال', rollout:'گسترش تدریجی', permissions:'مجوزها', role:'نقش', effect:'اثر',
  permissionKey:'کلید مجوز', severity:'شدت', ipAddress:'نشانی IP', userAgent:'مرورگر',
  eventType:'نوع رویداد', kind:'نوع', date:'تاریخ', time:'زمان', url:'نشانی', meetingUrl:'لینک جلسه',
  location:'مکان', industry:'صنعت', parentOrganizationId:'سازمان مادر', parentUnitId:'واحد والد',
  organizationName:'نام سازمان', organization:'سازمان', person:'شخص', relationship:'رابطه',
  totalRecords:'تعداد رکوردها', jobId:'شناسه کار', manifestUrl:'نشانی خروجی', until:'تا تاریخ',
  suggestedTitle:'عنوان پیشنهادی', suggestedDueAt:'سررسید پیشنهادی', text:'متن', matchedKeyword:'کلیدواژه',
};
const labelOf=(k:string)=>KEY_FA[k]??(k.replace(/[A-Z]/g,c=>' '+c.toLowerCase()).replace(/_/g,' '));
const faValue=(v:any)=>STATUS_FA[String(v).toUpperCase()]??v;

/** Pretty-print a single field (dates, booleans, ids) */
function prettyField(key:string,v:any){
  if(v==null||v==='') return <span className="t-muted">—</span>;
  if(typeof v==='boolean') return <StatusBadge tone={v?'success':'neutral'}>{v?'بله':'خیر'}</StatusBadge>;
  if(typeof v==='object') return <span dir="ltr" style={{fontSize:11.5}}>{value(v)}</span>;
  const s=String(v);
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const d=new Date(s);
    if(!isNaN(d.getTime())){
      try{ return <span>{d.toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'})}</span>; }catch{}
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
    <nav className="breadcrumbs" aria-label="مسیر">
      {backHref?<><Link href={backHref}>{backLabel??'بازگشت'}</Link><span className="sep">/</span><span className="current">{title}</span></>
      :<span className="current">{title}</span>}
    </nav>
    <PageHeader eyebrow={eyebrow} title={title} description={`شناسه: ${id}`} actions={
      <div className="toolbar">
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={busy}><RefreshCw size={14}/> بازخوانی</button>
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
          <div><h2>جزئیات</h2><p>دادهٔ زنده از سرور — فقط در محدودهٔ دسترسی شما</p></div>
          {d.status!==undefined&&<StatusBadge tone={statusTone(String(d.status))}>{faValue(String(d.status))}</StatusBadge>}
        </div>
        <div className="detail-grid">{fields.map(([k,v])=>
          <div className="detail-item" key={k}><small>{labelOf(k)}</small><strong>{prettyField(k,v)}</strong></div>
        )}</div>
      </section>
      {timelineEndpoint&&(
        <section className="section-card">
          <div className="section-head">
            <div><h2><Clock size={17}/> خط زمانی</h2><p>رویدادهای ثبت‌شده برای این موجودیت</p></div>
            <span className="chip info">{timeline.length} رویداد</span>
          </div>
          {timeline.length?(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {timeline.slice(0,30).map((x:any,i:number)=>(
                <div className="ai-match-card" key={x.id??i} style={{flexDirection:'row',alignItems:'center',gap:10,display:'flex'}}>
                  <span className="chip neutral">{faValue((x as any).kind)??'رویداد'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <b>{x.title||x.subject||x.description||x.name||x.eventType||'—'}</b>
                    {(x.date||x.createdAt)?<div className="match-meta" style={{marginTop:2}}>{new Date(x.date??x.createdAt).toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'})}</div>:null}
                  </div>
                  {x.status&&<StatusBadge tone={statusTone(String(x.status))}>{faValue(String(x.status))}</StatusBadge>}
                </div>
              ))}
            </div>
          ):<Empty>رویدادی ثبت نشده است.</Empty>}
        </section>
      )}
    </>:null}
  </main>
 );
}

export {CheckCircle2, XCircle, ChevronLeft};
