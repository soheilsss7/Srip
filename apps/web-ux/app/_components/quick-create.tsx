'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import { JalaliDateField } from './jalali-date-field';
import { lt, t } from '../_lib/i18n';

/* ============================================================================
   ایجاد سریع — فرم‌های کامل و دقیق، هم‌تراز با قرارداد API
   ----------------------------------------------------------------------------
   • انتخابگرهای واقعی: سازمان/شخص/رابطه از دادهٔ محیط خودِ کاربر لود می‌شوند
     (چون GET ها scope دارند، هر مستأجر فقط سازمان‌های خودش را می‌بیند).
   • تاریخ‌ها شمسی (JalaliDateField)؛ اعداد اعتبارسنجی‌شده؛ enum ها با select.
   • فیلدها دقیقاً همان‌هایی‌اند که endpoint مربوطه می‌پذیرد (نه بیشتر، نه کمتر).
   ============================================================================ */

type Opt = { value: string; label: string };
type Field = {
  name: string; label: string;
  type?: 'text'|'textarea'|'number'|'select'|'date'|'datetime'|'org'|'person'|'rel'|'people-multi'|'url'|'tel'|'email';
  required?: boolean; options?: Opt[]; placeholder?: string; hint?: string;
  min?: number; max?: number; step?: number; full?: boolean; default?: string;
};
type Section = { title: string; fields: Field[] };
type Entity = { key: string; label: string; endpoint: string; sections: Section[]; successName?: (v: Record<string, any>) => string };

/* ─── enum های استاندارد (همسان با صفحات اصلی و mock) ─── */
const ORG_TYPES: Opt[] = lt([
  { value:'HOLDING', label:t('هلدینگ') }, { value:'SUBSIDIARY', label:t('زیرمجموعه') }, { value:'CUSTOMER', label:t('مشتری') },
  { value:'PARTNER', label:t('شریک') }, { value:'BANK', label:t('بانک') }, { value:'GOVERNMENT', label:t('دولتی') },
  { value:'INVESTOR', label:t('سرمایه‌گذار') }, { value:'SUPPLIER', label:t('تأمین‌کننده') }, { value:'OTHER', label:t('سایر') },
]);
const REL_TYPES: Opt[] = lt([
  { value:'STRATEGIC_PARTNERSHIP', label:t('مشارکت راهبردی') }, { value:'BANKING', label:t('بانکی') }, { value:'CUSTOMER', label:t('مشتری') },
  { value:'SUPPLY', label:t('تأمین') }, { value:'INVESTMENT', label:t('سرمایه‌گذاری') }, { value:'GOVERNMENT', label:t('دولتی') },
  { value:'SUBSIDIARY', label:t('زیرمجموعه') }, { value:'HOLDING', label:t('هلدینگ') }, { value:'PARTNER', label:t('شریک') }, { value:'OTHER', label:t('سایر') },
]);
const MARKET_KINDS: Opt[] = lt([
  { value:'MARKET', label:t('بازاری') }, { value:'NON_MARKET', label:t('غیربازاری (عمومی)') }, { value:'HYBRID', label:t('هیبریدی') },
]);
const PRIORITIES: Opt[] = lt([
  { value:'CRITICAL', label:t('بحرانی') }, { value:'HIGH', label:t('بالا') }, { value:'MEDIUM', label:t('متوسط') }, { value:'LOW', label:t('پایین') },
]);
const ACTION_STATUSES: Opt[] = lt([
  { value:'OPEN', label:t('باز') }, { value:'IN_PROGRESS', label:t('در حال انجام') }, { value:'BLOCKED', label:t('مسدود') }, { value:'DONE', label:t('انجام‌شده') },
]);
const RISKS: Opt[] = lt( [ { value:'HIGH', label:t('بالا') }, { value:'MEDIUM', label:t('متوسط') }, { value:'LOW', label:t('پایین') } ]);
const COMMITMENT_STATUSES: Opt[] = lt( [ { value:'OPEN', label:t('باز') }, { value:'FULFILLED', label:t('ایفا شده') } ]);
const DIRECTIONS: Opt[] = lt( [ { value:'OURS', label:t('تعهد ما') }, { value:'THEIRS', label:t('تعهد طرف مقابل') } ]);
const PROJECT_STATUSES: Opt[] = [
  { value:'PLANNED', label:t('برنامه‌ریزی‌شده') }, { value:'IN_PROGRESS', label:t('در حال اجرا') }, { value:'ON_HOLD', label:t('معلق') }, { value:'DONE', label:t('تکمیل‌شده') }, { value:'CANCELLED', label:t('لغو‌شده') },
];
const OPP_STATUSES: Opt[] = lt([
  { value:'IDENTIFIED', label:t('شناسایی‌شده') }, { value:'ACTIVE', label:t('باز') }, { value:'PROPOSAL', label:t('در حال پیشنهاد') },
  { value:'NEGOTIATION', label:t('در حال مذاکره') }, { value:'WON', label:t('برنده') }, { value:'LOST', label:t('از دست رفته') }, { value:'ON_HOLD', label:t('معلق') },
]);
const OPP_SOURCES: Opt[] = lt([
  { value:'COLD', label:t('سرد (بدون معرفی)') }, { value:'EVENT', label:t('رویداد') }, { value:'REFERRAL', label:t('معرفی') }, { value:'EXISTING_RELATIONSHIP', label:t('رابطهٔ موجود') },
]);

const entities: Entity[] = lt([
  {
    key:'organization', label:t('سازمان'), endpoint:'/organizations', successName:(v)=>`«${v.name}»`,
    sections:[
      { title:t('اطلاعات پایه'), fields:[
        { name:'name', label:t('نام سازمان'), required:true, placeholder:t('مثلاً: شرکت فناوری نوآور'), full:true },
        { name:'type', label:t('نوع سازمان'), type:'select', options:ORG_TYPES, default:'OTHER' },
      ]},
      { title:t('مشخصات تکمیلی'), fields:[
        { name:'industry', label:t('صنعت'), placeholder:t('مثلاً: نرم‌افزار، بانکداری، پتروشیمی') },
        { name:'country', label:t('کشور'), placeholder:t('ایران'), default:t('ایران') },
        { name:'parentOrganizationId', label:t('سازمان مادر'), type:'org', hint:t('برای ساخت سلسله‌مراتب هلدینگ'), full:true },
      ]},
    ],
  },
  {
    key:'person', label:t('شخص'), endpoint:'/people', successName:(v)=>`«${v.firstName} ${v.lastName}»`,
    sections:[
      { title:t('اطلاعات پایه'), fields:[
        { name:'firstName', label:t('نام'), required:true, placeholder:t('مثلاً: سارا') },
        { name:'lastName', label:t('نام خانوادگی'), required:true, placeholder:t('مثلاً: محمدی') },
        { name:'organizationId', label:t('سازمان'), type:'org', required:true, full:true },
      ]},
      { title:t('نقش و تماس'), fields:[
        { name:'title', label:t('سمت'), placeholder:t('مثلاً: مدیر فروش') },
        { name:'department', label:t('واحد سازمانی'), placeholder:t('مثلاً: فروش') },
        { name:'email', label:t('ایمیل'), type:'email', placeholder:'name@company.com' },
        { name:'phone', label:t('تلفن'), type:'tel', placeholder:'+98 21 00000000' },
        { name:'influenceScore', label:t('امتیاز نفوذ (۰ تا ۱۰۰)'), type:'number', min:0, max:100, placeholder:'60' },
      ]},
    ],
  },
  {
    key:'relationship', label:t('رابطه'), endpoint:'/relationships', successName:(v)=>t('جدید'),
    sections:[
      { title:t('طرفین رابطه'), fields:[
        { name:'sourceOrganizationId', label:t('سازمان مبدأ'), type:'org', required:true },
        { name:'targetOrganizationId', label:t('سازمان مقصد'), type:'org', required:true },
      ]},
      { title:t('مشخصات رابطه'), fields:[
        { name:'relationshipType', label:t('نوع رابطه'), type:'select', options:REL_TYPES, required:true, default:'PARTNER' },
        { name:'marketKind', label:t('جنس بازار'), type:'select', options:MARKET_KINDS, default:'MARKET' },
        { name:'marketSegment', label:t('سگمنت بازار'), placeholder:t('مثلاً: تأمین مالی دانش‌بنیان'), full:true },
      ]},
    ],
  },
  {
    key:'meeting', label:t('جلسه'), endpoint:'/meetings', successName:(v)=>`«${v.title}»`,
    sections:[
      { title:t('اطلاعات پایه'), fields:[
        { name:'title', label:t('عنوان جلسه'), required:true, placeholder:t('مثلاً: جلسهٔ راهبردی فصل'), full:true },
        { name:'startAt', label:t('زمان شروع'), type:'datetime', required:true },
        { name:'endAt', label:t('زمان پایان'), type:'datetime' },
      ]},
      { title:t('پیوند و مکان'), fields:[
        { name:'relationshipId', label:t('رابطهٔ مرتبط'), type:'rel', hint:t('با انتخاب رابطه، سازمان جلسه خودکار ثبت می‌شود') },
        { name:'organizationId', label:t('سازمان مرتبط'), type:'org' },
        { name:'location', label:t('محل برگزاری'), placeholder:t('مثلاً: دفتر مرکزی — اتاق جلسات ۲') },
        { name:'meetingUrl', label:t('لینک جلسه (ویدئوکنفرانس)'), type:'url', placeholder:'https://meet.example.com/…' },
        { name:'participants', label:t('شرکت‌کنندگان'), type:'people-multi', full:true, hint:t('با Ctrl چند نفر را انتخاب کنید') },
      ]},
      { title:t('دستور جلسه'), fields:[
        { name:'objective', label:t('هدف جلسه'), type:'textarea', placeholder:t('خروجی مورد انتظار از این جلسه چیست؟'), full:true },
        { name:'agenda', label:t('دستور جلسه'), type:'textarea', placeholder:'۱) مرورد وضعیت\n۲) …', full:true },
      ]},
    ],
  },
  {
    key:'action', label:t('اقدام'), endpoint:'/actions', successName:(v)=>`«${v.title}»`,
    sections:[
      { title:t('اطلاعات پایه'), fields:[
        { name:'title', label:t('عنوان اقدام'), required:true, placeholder:t('مثلاً: ارسال پیش‌فاکتور'), full:true },
        { name:'dueAt', label:t('موعد انجام'), type:'datetime' },
        { name:'priority', label:t('اولویت'), type:'select', options:PRIORITIES, default:'MEDIUM' },
        { name:'status', label:t('وضعیت'), type:'select', options:ACTION_STATUSES, default:'OPEN' },
      ]},
      { title:t('مالکیت و پیوند'), fields:[
        { name:'ownerId', label:t('مسئول انجام'), type:'person' },
        { name:'relationshipId', label:t('رابطهٔ مرتبط'), type:'rel' },
        { name:'organizationId', label:t('سازمان مرتبط'), type:'org' },
        { name:'description', label:t('توضیح'), type:'textarea', full:true },
      ]},
    ],
  },
  {
    key:'commitment', label:t('تعهد'), endpoint:'/commitments', successName:(v)=>`«${String(v.description).slice(0, 40)}…»`,
    sections:[
      { title:t('شرح تعهد'), fields:[
        { name:'description', label:t('شرح'), type:'textarea', required:true, placeholder:t('مثلاً: تحویل پیش‌فاکتور نهایی'), full:true },
        { name:'direction', label:t('طرف تعهد'), type:'select', options:DIRECTIONS, default:'OURS' },
        { name:'risk', label:t('ریسک'), type:'select', options:RISKS, default:'MEDIUM' },
      ]},
      { title:t('زمان‌بندی'), fields:[
        { name:'dueAt', label:t('موعد'), type:'datetime' },
        { name:'reminderAt', label:t('یادآوری'), type:'datetime' },
        { name:'status', label:t('وضعیت'), type:'select', options:COMMITMENT_STATUSES, default:'OPEN' },
      ]},
      { title:t('پیوند'), fields:[
        { name:'relationshipId', label:t('رابطهٔ مرتبط'), type:'rel' },
        { name:'organizationId', label:t('سازمان طرف'), type:'org' },
        { name:'personId', label:t('شخص طرف'), type:'person' },
        { name:'notes', label:t('یادداشت'), type:'textarea', full:true },
      ]},
    ],
  },
  {
    key:'project', label:t('پروژه'), endpoint:'/projects', successName:(v)=>`«${v.name}»`,
    sections:[
      { title:t('اطلاعات پایه'), fields:[
        { name:'name', label:t('نام پروژه'), required:true, placeholder:t('مثلاً: توسعهٔ پلتفرم مشتریان'), full:true },
        { name:'status', label:t('وضعیت'), type:'select', options:PROJECT_STATUSES, default:'PLANNED' },
        { name:'priority', label:t('اولویت'), type:'select', options:PRIORITIES, default:'MEDIUM' },
      ]},
      { title:t('پیوند و زمان‌بندی'), fields:[
        { name:'organizationId', label:t('سازمان پروژه'), type:'org', required:true },
        { name:'ownerId', label:t('مدیر پروژه'), type:'person' },
        { name:'startAt', label:t('تاریخ شروع'), type:'date' },
        { name:'targetAt', label:t('مهلت هدف'), type:'date' },
      ]},
      { title:t('شرح'), fields:[
        { name:'objective', label:t('هدف پروژه'), placeholder:t('چرا این پروژه انجام می‌شود؟'), full:true },
        { name:'description', label:t('توضیح'), type:'textarea', full:true },
      ]},
    ],
  },
  {
    key:'opportunity', label:t('فرصت'), endpoint:'/opportunities', successName:(v)=>`«${v.name}»`,
    sections:[
      { title:t('اطلاعات پایه'), fields:[
        { name:'name', label:t('نام فرصت'), required:true, placeholder:t('مثلاً: قرارداد تأمین سالانه'), full:true },
        { name:'status', label:t('وضعیت'), type:'select', options:OPP_STATUSES, default:'IDENTIFIED' },
        { name:'sourceType', label:t('منبع فرصت'), type:'select', options:OPP_SOURCES, default:'COLD' },
      ]},
      { title:t('ارزش و زمان'), fields:[
        { name:'value', label:t('ارزش (ریال)'), type:'number', min:0, step:1000000, placeholder:t('مثلاً: 5000000000') },
        { name:'probability', label:t('احتمال موفقیت (۰ تا ۱۰۰)'), type:'number', min:0, max:100, placeholder:t('مثلاً: 40') },
        { name:'expectedDate', label:t('تاریخ مورد انتظار'), type:'date' },
      ]},
      { title:t('پیوند'), fields:[
        { name:'relationshipId', label:t('رابطهٔ مرتبط'), type:'rel' },
        { name:'organizationId', label:t('سازمان فرصت'), type:'org' },
        { name:'description', label:t('توضیح'), type:'textarea', full:true },
      ]},
    ],
  },
]);

type Ref = { orgs: { id: string; name: string }[]; people: { id: string; firstName: string; lastName: string }[]; rels: { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null }[] };

const relLabel = (r: Ref['rels'][number]) => `${r.sourceOrganization?.name ?? t('؟')} ↔ ${r.targetOrganization?.name ?? t('؟')}`;
const personLabel = (p: Ref['people'][number]) => `${p.firstName} ${p.lastName}`;

export function QuickCreate({open,onClose}:{open:boolean;onClose:()=>void}){
 const [entity,setEntity]=useState<Entity>(entities[0]);
 const [v,setV]=useState<Record<string,any>>({});
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState<{ok:boolean;text:string}|null>(null);
 const [ref,setRef]=useState<Ref>({orgs:[],people:[],rels:[]});
 const [refLoading,setRefLoading]=useState(false);

 useEffect(()=>{if(!open)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[open,onClose]);
 useEffect(()=>{if(!open)return;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=''}},[open]);

 /* لود مراجع (سازمان/شخص/رابطه) — scope دار: هر مستأجر فقط دادهٔ خودش */
 useEffect(()=>{
   if(!open)return;
   let alive=true;
   setRefLoading(true);
   Promise.all([
     api<any>('/organizations').catch(()=>null),
     api<any>('/people').catch(()=>null),
     api<any>('/relationships').catch(()=>null),
   ]).then(([o,p,r])=>{
     if(!alive)return;
     /* پاسخ ممکن است آرایه یا {data:[…]} باشد — هر دو شکل پشتیبانی می‌شود */
     const arr=(x:any):any[]=>Array.isArray(x)?x:(x?.data??[]);
     setRef({
       orgs:arr(o).map((x:any)=>({id:x.id,name:x.name})),
       people:arr(p).map((x:any)=>({id:x.id,firstName:x.firstName,lastName:x.lastName})),
       rels:arr(r).map((x:any)=>({id:x.id,sourceOrganization:x.sourceOrganization??null,targetOrganization:x.targetOrganization??null})),
     });
   }).finally(()=>{if(alive)setRefLoading(false)});
   return()=>{alive=false};
 },[open]);

 /* مقدار پیش‌فرض فیلدهای select هنگام تعویض موجودیت */
 const pickEntity=(e:Entity)=>{
   setEntity(e);setMsg(null);
   const init:Record<string,any>={};
   e.sections.forEach(s=>s.fields.forEach(f=>{if(f.default!==undefined)init[f.name]=f.default;}));
   setV(init);
 };
 useEffect(()=>{if(open&&!v._init){const init:Record<string,any>={_init:true};entities[0].sections.forEach(s=>s.fields.forEach(f=>{if(f.default!==undefined)init[f.name]=f.default;}));setV(init);}},[open,v._init]);

 if(!open)return null;

 const setField=(name:string,val:any)=>setV(prev=>({...prev,[name]:val}));

 async function submit(e:React.FormEvent){
   e.preventDefault();setBusy(true);setMsg(null);
   try{
     const body:any={};
     entity.sections.forEach(s=>s.fields.forEach(f=>{
       const raw=v[f.name];
       if(raw==null||raw==='')return;
       if(f.type==='number')body[f.name]=Number(raw);
       else if(f.type==='people-multi')body[f.name]=(raw as string[]).map(id=>({personId:id}));
       else body[f.name]=raw;
     }));
     const created:any=await api(entity.endpoint,{method:'POST',body:JSON.stringify(body)});
     setMsg({ok:true,text:`${entity.label} ${entity.successName?entity.successName(body):''} ${t('با موفقیت ایجاد شد.')}`});
     const init:Record<string,any>={_init:true};
     entity.sections.forEach(s=>s.fields.forEach(f=>{if(f.default!==undefined)init[f.name]=f.default;}));
     setV(init);
     void created;
   }catch(x){setMsg({ok:false,text:(x as Error).message})}finally{setBusy(false)}
 }

 const renderInput=(f:Field)=>{
   const val=v[f.name]??'';
   switch(f.type){
     case 'date': case 'datetime':
       return <JalaliDateField id={`qc-${f.name}`} withTime={f.type==='datetime'} value={val} onChange={x=>setField(f.name,x)} required={f.required}/>;
     case 'textarea':
       return <textarea id={`qc-${f.name}`} value={val} required={f.required} placeholder={f.placeholder} rows={3} onChange={e=>setField(f.name,e.target.value)}/>;
     case 'select':
       return <select id={`qc-${f.name}`} value={val} required={f.required} onChange={e=>setField(f.name,e.target.value)}>
         {!f.required&&f.default===undefined&&<option value="">—</option>}
         {(f.options??[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
       </select>;
     case 'org':
       return <select id={`qc-${f.name}`} value={val} required={f.required} onChange={e=>setField(f.name,e.target.value)}>
         <option value="">{refLoading?t('در حال دریافت…'):t('— انتخاب سازمان —')}</option>
         {ref.orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
       </select>;
     case 'person':
       return <select id={`qc-${f.name}`} value={val} required={f.required} onChange={e=>setField(f.name,e.target.value)}>
         <option value="">{refLoading?t('در حال دریافت…'):t('— انتخاب شخص —')}</option>
         {ref.people.map(p=><option key={p.id} value={p.id}>{personLabel(p)}</option>)}
       </select>;
     case 'rel':
       return <select id={`qc-${f.name}`} value={val} required={f.required} onChange={e=>setField(f.name,e.target.value)}>
         <option value="">{refLoading?t('در حال دریافت…'):t('— انتخاب رابطه —')}</option>
         {ref.rels.map(r=><option key={r.id} value={r.id}>{relLabel(r)}</option>)}
       </select>;
     case 'people-multi':
       return <select id={`qc-${f.name}`} multiple value={val||[]} onChange={e=>setField(f.name,[...e.target.selectedOptions].map(o=>o.value))} size={Math.min(6,Math.max(3,ref.people.length))}>
         {ref.people.map(p=><option key={p.id} value={p.id}>{personLabel(p)}</option>)}
       </select>;
     default:
       return <input id={`qc-${f.name}`} type={f.type??'text'} value={val} required={f.required} placeholder={f.placeholder}
         min={f.min} max={f.max} step={f.step} onChange={e=>setField(f.name,e.target.value)}/>;
   }
 };

 return (
  <div className="quick-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
   <section className="quick-card" role="dialog" aria-label={t('ایجاد سریع')}>
    <header>
      <div><span className="eyebrow">{t('اقدام سریع')}</span><h2>{t('ایجاد سریع')}</h2></div>
      <button onClick={onClose} aria-label={t('بستن')}>×</button>
    </header>
    <div className="quick-types">{entities.map(x=><button type="button" className={x.key===entity.key?'active':''} onClick={()=>pickEntity(x)} key={x.key}>{x.label}</button>)}</div>
    <form className="entity-form" onSubmit={submit}>
      {entity.sections.map(sec=>(
        <div className="quick-form-section" key={sec.title}>
          <div className="form-section-head"><h3>{sec.title}</h3></div>
          <div className="form-grid">
            {sec.fields.map(f=>(
              <div className={`field${f.full?' full':''}`} key={f.name}>
                <label className="field-label" htmlFor={`qc-${f.name}`}>{f.label}{f.required&&<span className="req"> *</span>}</label>
                {renderInput(f)}
                {f.hint&&<span className="field-hint">{f.hint}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="primary-action" disabled={busy}>{busy ? t('در حال ثبت…') : `${t('ایجاد')} ${entity.label}`}</button>
    </form>
    {msg&&<div className={msg.ok?'status-message ok':'status-message err'} role="status">{msg.text}</div>}
   </section>
  </div>
 );
}
