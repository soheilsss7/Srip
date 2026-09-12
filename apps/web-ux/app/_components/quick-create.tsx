'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import { JalaliDateField } from './jalali-date-field';

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
const ORG_TYPES: Opt[] = [
  { value:'HOLDING', label:'هلدینگ' }, { value:'SUBSIDIARY', label:'زیرمجموعه' }, { value:'CUSTOMER', label:'مشتری' },
  { value:'PARTNER', label:'شریک' }, { value:'BANK', label:'بانک' }, { value:'GOVERNMENT', label:'دولتی' },
  { value:'INVESTOR', label:'سرمایه‌گذار' }, { value:'SUPPLIER', label:'تأمین‌کننده' }, { value:'OTHER', label:'سایر' },
];
const REL_TYPES: Opt[] = [
  { value:'STRATEGIC_PARTNERSHIP', label:'مشارکت راهبردی' }, { value:'BANKING', label:'بانکی' }, { value:'CUSTOMER', label:'مشتری' },
  { value:'SUPPLY', label:'تأمین' }, { value:'INVESTMENT', label:'سرمایه‌گذاری' }, { value:'GOVERNMENT', label:'دولتی' },
  { value:'SUBSIDIARY', label:'زیرمجموعه' }, { value:'HOLDING', label:'هلدینگ' }, { value:'PARTNER', label:'شریک' }, { value:'OTHER', label:'سایر' },
];
const MARKET_KINDS: Opt[] = [
  { value:'MARKET', label:'بازاری' }, { value:'NON_MARKET', label:'غیربازاری (عمومی)' }, { value:'HYBRID', label:'هیبریدی' },
];
const PRIORITIES: Opt[] = [
  { value:'CRITICAL', label:'بحرانی' }, { value:'HIGH', label:'بالا' }, { value:'MEDIUM', label:'متوسط' }, { value:'LOW', label:'پایین' },
];
const ACTION_STATUSES: Opt[] = [
  { value:'OPEN', label:'باز' }, { value:'IN_PROGRESS', label:'در حال انجام' }, { value:'BLOCKED', label:'مسدود' }, { value:'DONE', label:'انجام‌شده' },
];
const RISKS: Opt[] = [ { value:'HIGH', label:'بالا' }, { value:'MEDIUM', label:'متوسط' }, { value:'LOW', label:'پایین' } ];
const COMMITMENT_STATUSES: Opt[] = [ { value:'OPEN', label:'باز' }, { value:'FULFILLED', label:'ایفا شده' } ];
const DIRECTIONS: Opt[] = [ { value:'OURS', label:'تعهد ما' }, { value:'THEIRS', label:'تعهد طرف مقابل' } ];
const PROJECT_STATUSES: Opt[] = [
  { value:'PLANNED', label:'برنامه‌ریزی‌شده' }, { value:'IN_PROGRESS', label:'در حال اجرا' }, { value:'ON_HOLD', label:'معلق' }, { value:'DONE', label:'تکمیل‌شده' }, { value:'CANCELLED', label:'لغو‌شده' },
];
const OPP_STATUSES: Opt[] = [
  { value:'IDENTIFIED', label:'شناسایی‌شده' }, { value:'ACTIVE', label:'باز' }, { value:'PROPOSAL', label:'در حال پیشنهاد' },
  { value:'NEGOTIATION', label:'در حال مذاکره' }, { value:'WON', label:'برنده' }, { value:'LOST', label:'از دست رفته' }, { value:'ON_HOLD', label:'معلق' },
];
const OPP_SOURCES: Opt[] = [
  { value:'COLD', label:'سرد (بدون معرفی)' }, { value:'EVENT', label:'رویداد' }, { value:'REFERRAL', label:'معرفی' }, { value:'EXISTING_RELATIONSHIP', label:'رابطهٔ موجود' },
];

const entities: Entity[] = [
  {
    key:'organization', label:'سازمان', endpoint:'/organizations', successName:(v)=>`«${v.name}»`,
    sections:[
      { title:'اطلاعات پایه', fields:[
        { name:'name', label:'نام سازمان', required:true, placeholder:'مثلاً: شرکت فناوری نوآور', full:true },
        { name:'type', label:'نوع سازمان', type:'select', options:ORG_TYPES, default:'OTHER' },
      ]},
      { title:'مشخصات تکمیلی', fields:[
        { name:'industry', label:'صنعت', placeholder:'مثلاً: نرم‌افزار، بانکداری، پتروشیمی' },
        { name:'country', label:'کشور', placeholder:'ایران', default:'ایران' },
        { name:'parentOrganizationId', label:'سازمان مادر', type:'org', hint:'برای ساخت سلسله‌مراتب هلدینگ', full:true },
      ]},
    ],
  },
  {
    key:'person', label:'شخص', endpoint:'/people', successName:(v)=>`«${v.firstName} ${v.lastName}»`,
    sections:[
      { title:'اطلاعات پایه', fields:[
        { name:'firstName', label:'نام', required:true, placeholder:'مثلاً: سارا' },
        { name:'lastName', label:'نام خانوادگی', required:true, placeholder:'مثلاً: محمدی' },
        { name:'organizationId', label:'سازمان', type:'org', required:true, full:true },
      ]},
      { title:'نقش و تماس', fields:[
        { name:'title', label:'سمت', placeholder:'مثلاً: مدیر فروش' },
        { name:'department', label:'واحد سازمانی', placeholder:'مثلاً: فروش' },
        { name:'email', label:'ایمیل', type:'email', placeholder:'name@company.com' },
        { name:'phone', label:'تلفن', type:'tel', placeholder:'+98 21 00000000' },
        { name:'influenceScore', label:'امتیاز نفوذ (۰ تا ۱۰۰)', type:'number', min:0, max:100, placeholder:'60' },
      ]},
    ],
  },
  {
    key:'relationship', label:'رابطه', endpoint:'/relationships', successName:(v)=>'جدید',
    sections:[
      { title:'طرفین رابطه', fields:[
        { name:'sourceOrganizationId', label:'سازمان مبدأ', type:'org', required:true },
        { name:'targetOrganizationId', label:'سازمان مقصد', type:'org', required:true },
      ]},
      { title:'مشخصات رابطه', fields:[
        { name:'relationshipType', label:'نوع رابطه', type:'select', options:REL_TYPES, required:true, default:'PARTNER' },
        { name:'marketKind', label:'جنس بازار', type:'select', options:MARKET_KINDS, default:'MARKET' },
        { name:'marketSegment', label:'سگمنت بازار', placeholder:'مثلاً: تأمین مالی دانش‌بنیان', full:true },
      ]},
    ],
  },
  {
    key:'meeting', label:'جلسه', endpoint:'/meetings', successName:(v)=>`«${v.title}»`,
    sections:[
      { title:'اطلاعات پایه', fields:[
        { name:'title', label:'عنوان جلسه', required:true, placeholder:'مثلاً: جلسهٔ راهبردی فصل', full:true },
        { name:'startAt', label:'زمان شروع', type:'datetime', required:true },
        { name:'endAt', label:'زمان پایان', type:'datetime' },
      ]},
      { title:'پیوند و مکان', fields:[
        { name:'relationshipId', label:'رابطهٔ مرتبط', type:'rel', hint:'با انتخاب رابطه، سازمان جلسه خودکار ثبت می‌شود' },
        { name:'organizationId', label:'سازمان مرتبط', type:'org' },
        { name:'location', label:'محل برگزاری', placeholder:'مثلاً: دفتر مرکزی — اتاق جلسات ۲' },
        { name:'meetingUrl', label:'لینک جلسه (ویدئوکنفرانس)', type:'url', placeholder:'https://meet.example.com/…' },
        { name:'participants', label:'شرکت‌کنندگان', type:'people-multi', full:true, hint:'با Ctrl چند نفر را انتخاب کنید' },
      ]},
      { title:'دستور جلسه', fields:[
        { name:'objective', label:'هدف جلسه', type:'textarea', placeholder:'خروجی مورد انتظار از این جلسه چیست؟', full:true },
        { name:'agenda', label:'دستور جلسه', type:'textarea', placeholder:'۱) مرورد وضعیت\n۲) …', full:true },
      ]},
    ],
  },
  {
    key:'action', label:'اقدام', endpoint:'/actions', successName:(v)=>`«${v.title}»`,
    sections:[
      { title:'اطلاعات پایه', fields:[
        { name:'title', label:'عنوان اقدام', required:true, placeholder:'مثلاً: ارسال پیش‌فاکتور', full:true },
        { name:'dueAt', label:'موعد انجام', type:'datetime' },
        { name:'priority', label:'اولویت', type:'select', options:PRIORITIES, default:'MEDIUM' },
        { name:'status', label:'وضعیت', type:'select', options:ACTION_STATUSES, default:'OPEN' },
      ]},
      { title:'مالکیت و پیوند', fields:[
        { name:'ownerId', label:'مسئول انجام', type:'person' },
        { name:'relationshipId', label:'رابطهٔ مرتبط', type:'rel' },
        { name:'organizationId', label:'سازمان مرتبط', type:'org' },
        { name:'description', label:'توضیح', type:'textarea', full:true },
      ]},
    ],
  },
  {
    key:'commitment', label:'تعهد', endpoint:'/commitments', successName:(v)=>`«${String(v.description).slice(0, 40)}…»`,
    sections:[
      { title:'شرح تعهد', fields:[
        { name:'description', label:'شرح', type:'textarea', required:true, placeholder:'مثلاً: تحویل پیش‌فاکتور نهایی', full:true },
        { name:'direction', label:'طرف تعهد', type:'select', options:DIRECTIONS, default:'OURS' },
        { name:'risk', label:'ریسک', type:'select', options:RISKS, default:'MEDIUM' },
      ]},
      { title:'زمان‌بندی', fields:[
        { name:'dueAt', label:'موعد', type:'datetime' },
        { name:'reminderAt', label:'یادآوری', type:'datetime' },
        { name:'status', label:'وضعیت', type:'select', options:COMMITMENT_STATUSES, default:'OPEN' },
      ]},
      { title:'پیوند', fields:[
        { name:'relationshipId', label:'رابطهٔ مرتبط', type:'rel' },
        { name:'organizationId', label:'سازمان طرف', type:'org' },
        { name:'personId', label:'شخص طرف', type:'person' },
        { name:'notes', label:'یادداشت', type:'textarea', full:true },
      ]},
    ],
  },
  {
    key:'project', label:'پروژه', endpoint:'/projects', successName:(v)=>`«${v.name}»`,
    sections:[
      { title:'اطلاعات پایه', fields:[
        { name:'name', label:'نام پروژه', required:true, placeholder:'مثلاً: توسعهٔ پلتفرم مشتریان', full:true },
        { name:'status', label:'وضعیت', type:'select', options:PROJECT_STATUSES, default:'PLANNED' },
        { name:'priority', label:'اولویت', type:'select', options:PRIORITIES, default:'MEDIUM' },
      ]},
      { title:'پیوند و زمان‌بندی', fields:[
        { name:'organizationId', label:'سازمان پروژه', type:'org', required:true },
        { name:'ownerId', label:'مدیر پروژه', type:'person' },
        { name:'startAt', label:'تاریخ شروع', type:'date' },
        { name:'targetAt', label:'مهلت هدف', type:'date' },
      ]},
      { title:'شرح', fields:[
        { name:'objective', label:'هدف پروژه', placeholder:'چرا این پروژه انجام می‌شود؟', full:true },
        { name:'description', label:'توضیح', type:'textarea', full:true },
      ]},
    ],
  },
  {
    key:'opportunity', label:'فرصت', endpoint:'/opportunities', successName:(v)=>`«${v.name}»`,
    sections:[
      { title:'اطلاعات پایه', fields:[
        { name:'name', label:'نام فرصت', required:true, placeholder:'مثلاً: قرارداد تأمین سالانه', full:true },
        { name:'status', label:'وضعیت', type:'select', options:OPP_STATUSES, default:'IDENTIFIED' },
        { name:'sourceType', label:'منبع فرصت', type:'select', options:OPP_SOURCES, default:'COLD' },
      ]},
      { title:'ارزش و زمان', fields:[
        { name:'value', label:'ارزش (ریال)', type:'number', min:0, step:1000000, placeholder:'مثلاً: 5000000000' },
        { name:'probability', label:'احتمال موفقیت (۰ تا ۱۰۰)', type:'number', min:0, max:100, placeholder:'مثلاً: 40' },
        { name:'expectedDate', label:'تاریخ مورد انتظار', type:'date' },
      ]},
      { title:'پیوند', fields:[
        { name:'relationshipId', label:'رابطهٔ مرتبط', type:'rel' },
        { name:'organizationId', label:'سازمان فرصت', type:'org' },
        { name:'description', label:'توضیح', type:'textarea', full:true },
      ]},
    ],
  },
];

type Ref = { orgs: { id: string; name: string }[]; people: { id: string; firstName: string; lastName: string }[]; rels: { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null }[] };

const relLabel = (r: Ref['rels'][number]) => `${r.sourceOrganization?.name ?? '؟'} ↔ ${r.targetOrganization?.name ?? '؟'}`;
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
     setMsg({ok:true,text:`${entity.label} ${entity.successName?entity.successName(body):''} با موفقیت ایجاد شد.`});
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
         <option value="">{refLoading?'در حال دریافت…':'— انتخاب سازمان —'}</option>
         {ref.orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
       </select>;
     case 'person':
       return <select id={`qc-${f.name}`} value={val} required={f.required} onChange={e=>setField(f.name,e.target.value)}>
         <option value="">{refLoading?'در حال دریافت…':'— انتخاب شخص —'}</option>
         {ref.people.map(p=><option key={p.id} value={p.id}>{personLabel(p)}</option>)}
       </select>;
     case 'rel':
       return <select id={`qc-${f.name}`} value={val} required={f.required} onChange={e=>setField(f.name,e.target.value)}>
         <option value="">{refLoading?'در حال دریافت…':'— انتخاب رابطه —'}</option>
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
   <section className="quick-card" role="dialog" aria-label="ایجاد سریع">
    <header>
      <div><span className="eyebrow">اقدام سریع</span><h2>ایجاد سریع</h2></div>
      <button onClick={onClose} aria-label="بستن">×</button>
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
      <button className="primary-action" disabled={busy}>{busy?'در حال ثبت…':'ایجاد '+entity.label}</button>
    </form>
    {msg&&<div className={msg.ok?'status-message ok':'status-message err'} role="status">{msg.text}</div>}
   </section>
  </div>
 );
}
