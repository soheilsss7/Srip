/* ============================================================================
   SRIP Deterministic Mock API — dev/demo server (NO backend required).
   ----------------------------------------------------------------------------
   Run:  node apps/web/scripts/mock-api.mjs          (listens on :4000)
   Two demo identities:
     · OWNER   demo / 123456             → sees EVERYTHING (SUPER_ADMIN)
     · CLIENT  client / 123456           → sees ONLY its own organization
                                          (آریا فناوری) — like a partner who
                                          received the platform from the owner
     (ایمیل‌های demo@srip.local و client@arya-tech.ir هم به‌عنوان نام کاربری
     پذیرفته می‌شوند)
   The AI gateway is a rule-based deterministic engine (same as production
   'deterministic-gateway' mode): no LLM involved anywhere.
   ============================================================================ */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_API_PORT || 4000);
const V1 = '/api/v1';

/* ------------------------------ demo data ------------------------------ */
let ORGS = [
  { id:'org-1', name:'هلدینگ آریا', type:'HOLDING', industry:'مادر', country:'ایران', createdAt:'2025-11-02T08:00:00.000Z' },
  { id:'org-2', name:'آریا فناوری', type:'SUBSIDIARY', industry:'نرم‌افزار', country:'ایران', parentOrganizationId:'org-1', createdAt:'2025-11-05T08:00:00.000Z' },
  { id:'org-3', name:'بانک ملّی پارس', type:'BANK', industry:'بانکداری', country:'ایران', createdAt:'2025-11-10T08:00:00.000Z' },
  { id:'org-4', name:'شرکت پترو صنعت', type:'PARTNER', industry:'پتروشیمی', country:'ایران', createdAt:'2025-11-14T08:00:00.000Z' },
  { id:'org-5', name:'گروه ساختمانی سدنا', type:'CUSTOMER', industry:'ساخت‌وساز', country:'ایران', createdAt:'2025-12-01T08:00:00.000Z' },
  { id:'org-6', name:'تأمین‌کننده قطعات البرز', type:'SUPPLIER', industry:'قطعات صنعتی', country:'ایران', createdAt:'2025-12-12T08:00:00.000Z' },
  { id:'org-7', name:'صندوق سرمایه‌گذاری امید', type:'INVESTOR', industry:'سرمایه‌گذاری', country:'ایران', createdAt:'2026-01-08T08:00:00.000Z' },
  { id:'org-8', name:'استانداری تهران', type:'GOVERNMENT', industry:'دولتی', country:'ایران', createdAt:'2026-01-20T08:00:00.000Z' },
];
let PEOPLE = [
  { id:'p-1', firstName:'سارا', lastName:'محمدی', email:'sara@arya-tech.ir', phone:'+98 21 88001122', title:'مدیر فروش', department:'فروش', organizationId:'org-2', status:'ACTIVE', influenceScore:82 },
  { id:'p-2', firstName:'رضا', lastName:'کریمی', email:'reza@petro-sanat.ir', title:'مدیر خرید', department:'تدارکات', organizationId:'org-4', status:'ACTIVE', influenceScore:74 },
  { id:'p-3', firstName:'مریم', lastName:'حسینی', email:'maryam@bankpars.ir', title:'مدیر روابط بانکی', department:'بانکداری شرکتی', phone:'+98 21 82110033', organizationId:'org-3', status:'ACTIVE', influenceScore:91 },
  { id:'p-4', firstName:'علی', lastName:'نادری', email:'ali@sadena.ir', title:'مدیر پروژه', department:'پروژه', phone:'+98 21 88445566', organizationId:'org-5', status:'ACTIVE', influenceScore:68 },
  { id:'p-5', firstName:'نگار', lastName:'رحیمی', email:'negar@alborz-parts.ir', title:'مدیر کیفیت', department:'کیفیت', phone:'+98 26 33221100', organizationId:'org-6', status:'ACTIVE', influenceScore:61 },
  { id:'p-6', firstName:'امیر', lastName:'صادقی', email:'amir@arya-holding.ir', title:'مدیر استراتژی', department:'استراتژی', phone:'+98 21 88770011', organizationId:'org-1', status:'ACTIVE', influenceScore:88 },
  { id:'p-7', firstName:'نازنین', lastName:'کاظمی', email:'naz@arya-tech.ir', title:'مدیر محصول', department:'فنی', phone:'+98 21 88009988', organizationId:'org-2', status:'ACTIVE', influenceScore:77 },
  { id:'p-8', firstName:'حمید', lastName:'توکلی', email:'hamid@arya-tech.ir', title:'مدیر توسعه کسب‌وکار', department:'فروش', phone:'+98 21 88005566', organizationId:'org-2', status:'ACTIVE', influenceScore:71 },
];
let RELS = [
  { id:'r-1', relationshipType:'STRATEGIC_PARTNERSHIP', status:'ACTIVE', healthScore:78, riskScore:22, strategicScore:86, influenceScore:80, opportunityScore:72, resilienceScore:64, nextActionAt:'2026-09-05T09:00:00.000Z', lastInteractionAt:'2026-08-20T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-4' },
  { id:'r-2', relationshipType:'BANKING', status:'ACTIVE', healthScore:64, riskScore:48, strategicScore:92, influenceScore:90, opportunityScore:81, resilienceScore:52, nextActionAt:'2026-09-02T09:00:00.000Z', lastInteractionAt:'2026-08-25T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-3' },
  { id:'r-3', relationshipType:'CUSTOMER', status:'ACTIVE', healthScore:71, riskScore:35, strategicScore:74, influenceScore:66, opportunityScore:77, resilienceScore:58, nextActionAt:null, lastInteractionAt:'2026-08-10T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-5' },
  { id:'r-4', relationshipType:'SUPPLY', status:'WATCH', healthScore:41, riskScore:66, strategicScore:69, influenceScore:60, opportunityScore:45, resilienceScore:38, nextActionAt:'2026-09-01T09:00:00.000Z', lastInteractionAt:'2026-07-28T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-6' },
  { id:'r-5', relationshipType:'INVESTMENT', status:'ACTIVE', healthScore:82, riskScore:18, strategicScore:88, influenceScore:85, opportunityScore:90, resilienceScore:71, nextActionAt:null, lastInteractionAt:'2026-08-22T09:00:00.000Z', sourceOrganizationId:'org-1', targetOrganizationId:'org-7' },
];
let MEETINGS = [
  { id:'m-1', title:'جلسهٔ راهبردی Q3 با پترو صنعت', startAt:'2026-09-03T09:30:00.000Z', endAt:'2026-09-03T11:00:00.000Z', objective:'بررسی همکاری راهبردی و برنامه توسعه', agenda:'1) گزارش عملکرد ۲ فصل\n2) برنامه توسعه بازار\n3) زمان‌بندی قرارداد جدید', organizationId:'org-4', relationshipId:'r-1', participants:[{personId:'p-2'},{personId:'p-6'}], actions:[], commitments:[], preMeetingBrief:'تمرکز بر تمدید قرارداد و نرخ جدید.' },
  { id:'m-2', title:'مذاکره با بانک ملّی پارس', startAt:'2026-09-07T10:00:00.000Z', endAt:'2026-09-07T11:30:00.000Z', objective:'افتتاح خط اعتباری', agenda:'ارائه صورت‌های مالی و طرح توجیهی', organizationId:'org-3', relationshipId:'r-2', participants:[{personId:'p-3'}], actions:[], commitments:[], preMeetingBrief:null },
  { id:'m-3', title:'جلسهٔ پیگیری پروژه سدنا', startAt:'2026-08-25T09:00:00.000Z', endAt:'2026-08-25T10:00:00.000Z', objective:'پیشرفت فاز دوم', agenda:'بررسی مایلاستون‌ها', organizationId:'org-5', relationshipId:'r-3', participants:[{personId:'p-4'},{personId:'p-1'}], actions:[{id:'a-x1'}], commitments:[{id:'c-x1'}], outcome:'توافق شد تحویل فاز دوم ۱۰ روز زودتر انجام شود.', preMeetingBrief:null },
  { id:'m-4', title:'بررسی ریسک تأمین‌کننده البرز', startAt:'2026-08-28T08:30:00.000Z', endAt:'2026-08-28T09:15:00.000Z', objective:'مدیریت تاخیر تحویل قطعات', agenda:'تاخیرها و برنامه جبرانی', organizationId:'org-6', relationshipId:'r-4', participants:[{personId:'p-5'}], actions:[], commitments:[], outcome:'تأمین‌کننده متعهد شد تحویل‌ها را ۳ هفته شتاب دهد.', preMeetingBrief:null },
];
let ACTIONS = [
  { id:'a-1', title:'پیگیری امضای قرارداد پترو صنعت', status:'OPEN', priority:'HIGH', dueAt:'2026-09-02T09:00:00.000Z', ownerId:'p-1', relationshipId:'r-1' },
  { id:'a-2', title:'ارسال مدارک به بانک پارس', status:'IN_PROGRESS', priority:'CRITICAL', dueAt:'2026-08-30T09:00:00.000Z', ownerId:'p-3', relationshipId:'r-2' },
  { id:'a-3', title:'بررسی جایگزین تأمین‌کننده قطعات', status:'OPEN', priority:'HIGH', dueAt:'2026-09-08T09:00:00.000Z', ownerId:'p-5', relationshipId:'r-4' },
  { id:'a-4', title:'گزارش عملکرد سدنا', status:'DONE', priority:'MEDIUM', dueAt:'2026-08-20T09:00:00.000Z', ownerId:'p-4', relationshipId:'r-3' },
];
let COMMITMENTS = [
  { id:'c-1', description:'تحویل پیش‌فاکتور نهایی به پترو صنعت', dueAt:'2026-09-05T09:00:00.000Z', status:'OPEN', organizationId:'org-4', ownerId:'p-1', direction:'OURS', risk:'MEDIUM', personId:'p-2', relationshipId:'r-1', meetingId:'m-1', reminderAt:'2026-09-04T08:00:00.000Z', notes:'پس از توافق جلسهٔ راهبردی؛ پیش‌فاکتور همراه جدول تخفیف و زمان‌بندی تحویل ارسال شود.', createdAt:'2026-09-03T09:45:00.000Z' },
  { id:'c-2', description:'ارسال صورت‌های مالی حسابرسی‌شده به بانک', dueAt:'2026-08-31T09:00:00.000Z', status:'OPEN', organizationId:'org-3', ownerId:'p-6', direction:'OURS', risk:'HIGH', personId:'p-3', relationshipId:'r-2', reminderAt:'2026-08-30T09:00:00.000Z', notes:'پیش‌نیاز جلسهٔ مذاکرهٔ خط اعتباری؛ امضای مدیر مالی الزامی است.', createdAt:'2026-08-22T10:00:00.000Z' },
  { id:'c-3', description:'برنامه جبرانی تأمین قطعات', dueAt:'2026-09-10T09:00:00.000Z', status:'OPEN', organizationId:'org-6', ownerId:'p-5', direction:'THEIRS', risk:'HIGH', personId:'p-5', relationshipId:'r-4', meetingId:'m-4', projectId:'pr-2', reminderAt:'2026-09-09T09:00:00.000Z', notes:'تأمین‌کننده متعهد شد تحویل‌ها را سه هفته شتاب دهد؛ پیشرفت هر هفته راستی‌آزمایی شود.', createdAt:'2026-08-28T09:20:00.000Z' },
  { id:'c-4', description:'تسویهٔ صورتحساب فاز نخست سدنا', dueAt:'2026-08-28T09:00:00.000Z', status:'FULFILLED', fulfilledAt:'2026-08-26T11:30:00.000Z', organizationId:'org-5', ownerId:'p-8', direction:'OURS', risk:'LOW', personId:'p-4', relationshipId:'r-3', notes:'پرداخت به‌موقع انجام شد؛ رسید در پروندهٔ رابطه ثبت شد.', createdAt:'2026-08-10T09:00:00.000Z' },
];
let PROJECTS = [
  { id:'pr-1', name:'پلتفرم بانکداری شرکتی', status:'ACTIVE', priority:'CRITICAL', organizationId:'org-3', description:'پلتفرم بانکداری شرکتی برای بانک ملّی پارس', objective:'پیاده‌سازی پلتفرم بانکداری شرکتی شامل امضای دیجیتال و اتصال به هستهٔ بانکی', ownerId:'p-6', startAt:'2026-06-01T00:00:00.000Z', targetAt:'2026-12-31T00:00:00.000Z', endAt:null, createdAt:'2026-05-20T08:00:00.000Z' },
  { id:'pr-2', name:'یکپارچه‌سازی زنجیره تأمین', status:'PLANNED', priority:'MEDIUM', organizationId:'org-6', description:'اتصال سامانه‌های تأمین‌کننده البرز', objective:'یکپارچه‌سازی سامانهٔ سفارش و موجودی با البرز و کاهش زمان تدارک', ownerId:'p-5', startAt:null, targetAt:'2027-03-31T00:00:00.000Z', endAt:null, createdAt:'2026-08-15T09:00:00.000Z' },
  { id:'pr-3', name:'سامانهٔ هوش تجاری صندوق امید', status:'COMPLETED', priority:'MEDIUM', organizationId:'org-7', description:'داشبورد تحلیلی برای صندوق سرمایه‌گذاری امید', objective:'ارائهٔ داشبوردهای تحلیل پرتفوی و گزارش‌های دوره‌ای', ownerId:'p-6', startAt:'2026-01-15T00:00:00.000Z', targetAt:'2026-06-30T00:00:00.000Z', endAt:'2026-06-22T12:00:00.000Z', createdAt:'2026-01-05T08:00:00.000Z' },
];
let PROJECT_EXTRA = {
  'pr-1': {
    relationships:[{relationshipId:'r-2',status:'ENGAGED',relevance:95,required:true}],
    requirements:[
      {id:'req-1',title:'امضای دیجیتال',description:'پشتیبانی از امضای الکترونیک',category:'فنی',status:'SATISFIED',priority:'HIGH',organizationId:'org-2',createdAt:'2026-06-10T09:00:00.000Z'},
      {id:'req-2',title:'اتصال به هستهٔ بانکی',description:'اینترفیس امن با سامانهٔ مرکزی بانک',category:'فنی',status:'IN_PROGRESS',priority:'CRITICAL',organizationId:'org-2',createdAt:'2026-06-15T09:00:00.000Z'},
      {id:'req-21',title:'سامانهٔ نرمافزاری یکپارچه',description:'پیاده‌سازی نرم‌افزار بانکداری دیجیتال و یکپارچه‌سازی با هستهٔ بانک',category:'فنی',status:'OPEN',priority:'HIGH',organizationId:null,createdAt:'2026-08-25T09:00:00.000Z'},
      {id:'req-22',title:'تأمین تجهیزات و قطعات صنعتی',description:'تأمین قطعات صنعتی و تجهیزات زیرساخت برای مرکز دادهٔ بانک',category:'تأمین',status:'OPEN',priority:'CRITICAL',organizationId:null,createdAt:'2026-08-28T11:30:00.000Z'},
      {id:'req-23',title:'تأمین مالی توسعه',description:'جذب سرمایه‌گذاری برای توسعهٔ زیرساخت و ناوگان',category:'مالی',status:'OPEN',priority:'MEDIUM',organizationId:null,createdAt:'2026-08-30T10:00:00.000Z'},
    ],
    risks:[{id:'rk-1',title:'تاخیر در تحویل زیرساخت',description:'زیرساخت بانک آماده نیست',probability:40,impact:60,score:24,status:'OPEN',mitigation:'برنامه جایگزین و جلسهٔ اضطراری با واحد فناوری بانک'}],
    milestones:[{id:'ms-1',title:'فاز ۱ — نیازسنجی',description:'تکمیل شد',status:'COMPLETED',dueAt:'2026-07-15T00:00:00.000Z'},{id:'ms-2',title:'فاز ۲ — توسعه',description:'در حال اجرا',status:'IN_PROGRESS',dueAt:'2026-10-01T00:00:00.000Z'},{id:'ms-3',title:'فاز ۳ — راه‌اندازی',description:'استقرار و آموزش کاربران',status:'PLANNED',dueAt:'2026-12-15T00:00:00.000Z'}],
  },
  'pr-2': {
    relationships:[{relationshipId:'r-4',status:'ENGAGED',relevance:70,required:false}],
    requirements:[{id:'req-3',title:'قالب تبادل داده',description:'توافق روی قالب سفارش/موجودی',category:'فرایندی',status:'OPEN',priority:'HIGH',organizationId:null,createdAt:'2026-08-18T09:00:00.000Z'}],
    risks:[{id:'rk-2',title:'تغییر فرایند طرف مقابل',description:'نیاز به تغییر گردش کار داخلی البرز',probability:50,impact:40,score:20,status:'OPEN',mitigation:'کارگاه آموزشی مشترک پیش از شروع'}],
    milestones:[{id:'ms-4',title:'فاز ۰ — آماده‌سازی',description:'قرارداد و تیم پروژه',status:'PLANNED',dueAt:'2026-10-30T00:00:00.000Z'}],
  },
  'pr-3': {
    relationships:[{relationshipId:'r-5',status:'ENGAGED',relevance:60,required:false}],
    requirements:[{id:'req-4',title:'گزارش‌های دوره‌ای',description:'خروجی گزارش ماهانهٔ پرتفوی',category:'تجاری',status:'SATISFIED',priority:'MEDIUM',organizationId:'org-2',createdAt:'2026-02-01T09:00:00.000Z'}],
    risks:[{id:'rk-3',title:'کیفیت دادهٔ پایه',description:'نقص در داده‌های تاریخی',probability:30,impact:30,score:9,status:'CLOSED',mitigation:'پاک‌سازی داده با همکاری صندوق'}],
    milestones:[{id:'ms-5',title:'فاز ۱ — تحویل داشبوردها',description:'هر سه داشبورد تحویل شد',status:'COMPLETED',dueAt:'2026-05-30T00:00:00.000Z'},{id:'ms-6',title:'فاز ۲ — آموزش و استقرار',description:'پذیرش نهایی کاربران',status:'COMPLETED',dueAt:'2026-06-20T00:00:00.000Z'}],
  },
};
let OPPORTUNITIES = [
  { id:'o-1', name:'خط اعتباری ۲۰۰ میلیاردی بانک پارس', description:'افتتاح خط اعتباری ۲۰۰ میلیارد تومانی برای توسعهٔ محصولات بانکداری شرکتی', status:'ACTIVE', probability:65, value:200000000000, expectedDate:'2026-09-30T00:00:00.000Z', organizationId:'org-3', relationshipId:'r-2', projectId:'pr-1', ownerId:'p-1', createdAt:'2026-08-21T09:00:00.000Z' },
  { id:'o-2', name:'قرارداد نگهداری سدنا', description:'پیمان نگهداری سالانهٔ سامانه‌ها و زیرساخت گروه ساختمانی سدنا', status:'ACTIVE', probability:78, value:12000000000, expectedDate:'2026-10-15T00:00:00.000Z', organizationId:'org-5', relationshipId:'r-3', projectId:null, ownerId:'p-8', createdAt:'2026-08-24T09:00:00.000Z' },
  { id:'o-3', name:'توسعه بازار با پترو صنعت', description:'قرارداد دوسالهٔ پشتیبانی و توسعهٔ محصولات با شرکت پترو صنعت', status:'WON', probability:100, value:45000000000, expectedDate:'2026-09-10T00:00:00.000Z', organizationId:'org-4', relationshipId:'r-1', projectId:null, ownerId:'p-1', createdAt:'2026-08-10T09:00:00.000Z', wonAt:'2026-08-25T10:00:00.000Z' },
  { id:'o-4', name:'سرویس پایش امنیت بانک پارس', description:'مانیتورینگ امنیتی و گزارش‌های رگولاتوری برای بانک ملّی پارس', status:'IDENTIFIED', probability:20, value:30000000000, expectedDate:'2026-11-30T00:00:00.000Z', organizationId:'org-3', relationshipId:'r-2', projectId:null, ownerId:'p-7', createdAt:'2026-09-01T08:00:00.000Z' },
];
let INTERACTIONS = [
  { id:'i-1', type:'CALL', subject:'تماس با مدیر خرید پترو صنعت', summary:'در خصوص زمان‌بندی قرارداد و نرخ جدید گفت‌وگو شد؛ مدیر خرید آمادهٔ مذاکره نهایی است.', outcome:'قرار شد پیش‌فاکتور همراه جدول تخفیف ارسال شود.', durationMinutes:18, importance:'HIGH', sentiment:1, followUpRequired:true, followUpAt:'2026-09-06T09:00:00.000Z', occurredAt:'2026-08-24T10:00:00.000Z', userId:'u-1', organizationId:'org-4', relationshipId:'r-1', personId:'p-2' },
  { id:'i-2', type:'MEETING', subject:'بازدید از بانک ملّی پارس', summary:'بررسی نیازمندی‌های خط اعتباری ۲۰۰ میلیاردی و زیرساخت بانکداری شرکتی.', outcome:'مدارک تکمیلی درخواست شد؛ بانک منتظر طرح توجیهی است.', durationMinutes:75, importance:'HIGH', sentiment:0, followUpRequired:false, followUpAt:null, occurredAt:'2026-08-26T11:00:00.000Z', userId:'u-1', organizationId:'org-3', relationshipId:'r-2', personId:'p-3' },
  { id:'i-3', type:'CALL', subject:'تماس با مدیر پروژهٔ سدنا', summary:'پیگیری مایلاستون‌های فاز دوم و وضعیت نیروی اجرایی.', outcome:'در مسیر برنامه؛ تحویل فاز دوم سر موعد.', durationMinutes:12, importance:'MEDIUM', sentiment:1, followUpRequired:false, followUpAt:null, occurredAt:'2026-08-21T09:00:00.000Z', userId:'u-1', organizationId:'org-5', relationshipId:'r-3', personId:'p-4' },
  { id:'i-4', type:'MEETING', subject:'مذاکرهٔ نرخ و شرایط قرارداد پترو صنعت', summary:'مذاکرهٔ فشرده روی نرخ سرویس و مدت قرارداد؛ طرف مقابل روی تخفیف پلکانی اصرار داشت.', outcome:'توافق اولیه حاصل شد؛ امضای نهایی منوط به تأیید هیئت‌مدیرهٔ پترو.', durationMinutes:95, importance:'CRITICAL', sentiment:-1, followUpRequired:true, followUpAt:'2026-09-08T09:00:00.000Z', occurredAt:'2026-08-28T09:30:00.000Z', userId:'u-1', organizationId:'org-4', relationshipId:'r-1', personId:'p-2' },
  { id:'i-5', type:'EMAIL', subject:'اعلام تأخیر تحویل قطعات از البرز', summary:'تأمین‌کننده رسماً تأخیر ۳ هفته‌ای را اعلام و برنامهٔ جبرانی پیشنهاد کرد.', outcome:'تأمین‌کننده متعهد شد تحویل‌ها را با شیفت اضافه جبران کند.', durationMinutes:null, importance:'HIGH', sentiment:-1, followUpRequired:true, followUpAt:'2026-09-03T08:00:00.000Z', occurredAt:'2026-08-27T14:15:00.000Z', userId:'u-1', organizationId:'org-6', relationshipId:'r-4', personId:'p-5' },
  { id:'i-6', type:'MESSAGE', subject:'ارسال پیش‌فاکتور نهایی برای پترو صنعت', summary:'پیش‌فاکتور همراه جدول تخفیف و زمان‌بندی تحویل برای مدیر خرید ارسال شد.', outcome:'منتظر بازخورد مالی و خرید پترو.', durationMinutes:null, importance:'MEDIUM', sentiment:0, followUpRequired:false, followUpAt:null, occurredAt:'2026-09-01T11:40:00.000Z', userId:'u-1', organizationId:'org-4', relationshipId:'r-1', personId:'p-2' },
  { id:'i-7', type:'CALL', subject:'پیگیری مدارک خط اعتباری بانک پارس', summary:'ارسال طرح توجیهی و صورت‌های مالی حسابرسی‌شده به واحد اعتبارات.', outcome:'کارشناس اعتبارات قول بررسی ۲ هفته‌ای داد.', durationMinutes:10, importance:'MEDIUM', sentiment:0, followUpRequired:true, followUpAt:'2026-09-12T09:00:00.000Z', occurredAt:'2026-09-02T10:20:00.000Z', userId:'u-1', organizationId:'org-3', relationshipId:'r-2', personId:'p-3' },
  { id:'i-8', type:'NOTE', subject:'یادداشت بررسی سبد صندوق امید', summary:'بررسی گزارش فصلی صندوق؛ تصمیم دربارهٔ افزایش همکاری به جلسهٔ بعد موکول شد.', outcome:'پیش‌نویس پیشنهاد همکاری تهیه شود.', durationMinutes:null, importance:'LOW', sentiment:0, followUpRequired:true, followUpAt:'2026-09-20T08:00:00.000Z', occurredAt:'2026-08-30T13:00:00.000Z', userId:'u-1', organizationId:'org-7', relationshipId:'r-5', personId:'p-8' },
  { id:'i-9', type:'MEETING', subject:'جلسهٔ ارزیابی عملکرد تأمین‌کننده البرز', summary:'ارزیابی شاخص‌های کیفیت و زمان تحویل پس از تعهد جبرانی.', outcome:'توافق شد شاخص‌ها ماهانه بازبینی شود.', durationMinutes:45, importance:'MEDIUM', sentiment:0, followUpRequired:false, followUpAt:null, occurredAt:'2026-09-03T08:30:00.000Z', userId:'u-1', organizationId:'org-6', relationshipId:'r-4', personId:'p-5' },
];
let NOTIFICATIONS = [
  { id:'n-1', title:'موعد اقدام نزدیک است', body:'اقدام «پیگیری امضای قرارداد پترو صنعت» تا ۲ روز دیگر موعد دارد.', type:'REMINDER', priority:'important', isRead:false, createdAt:'2026-08-29T06:00:00.000Z' },
  { id:'n-2', title:'پیشنهاد هوشمند جدید', body:'پیشنهاد «مدیریت ریسک رابطه با البرز» تولید شد.', type:'RECOMMENDATION', priority:'recommendation', isRead:false, createdAt:'2026-08-29T05:00:00.000Z' },
  { id:'n-3', title:'نتیجه جلسه ثبت شد', body:'نتیجهٔ جلسهٔ پیگیری پروژه سدنا ثبت شد.', type:'SYSTEM', priority:'information', isRead:true, createdAt:'2026-08-25T12:00:00.000Z' },
];

let REFERRALS = [
  { id:'ref-1', title:'معرفی مدیر فروش به پترو صنعت', message:'معرفی سارا محمدی برای مدیریت حساب پترو صنعت', sourcePersonId:'p-1', targetPersonId:'p-2', sourceOrganizationId:'org-2', targetOrganizationId:'org-4', relationshipId:'r-1', status:'ACCEPTED', createdById:'u-1', recipientUserId:null, completedAt:null, notes:null, createdAt:'2026-08-18T09:00:00.000Z' },
  { id:'ref-2', title:'معرفی برای همکاری بانکی', message:'آشنایی با مدیر روابط بانکی پارس برای خط اعتباری', sourcePersonId:'p-6', targetPersonId:'p-3', sourceOrganizationId:'org-1', targetOrganizationId:'org-3', relationshipId:'r-2', status:'PENDING', createdById:'u-1', recipientUserId:null, completedAt:null, notes:null, createdAt:'2026-08-22T10:30:00.000Z' },
  { id:'ref-3', title:'معرفی تأمین‌کننده قطعات', message:'معرفی مدیر کیفیت البرز برای ارزیابی تأمین', sourcePersonId:'p-1', targetPersonId:'p-5', sourceOrganizationId:'org-2', targetOrganizationId:'org-6', relationshipId:'r-4', status:'COMPLETED', createdById:'u-1', recipientUserId:null, completedAt:'2026-08-28T11:00:00.000Z', notes:'تأمین‌کننده تأیید شد و قرارداد اولیه امضا گردید.', createdAt:'2026-08-10T08:15:00.000Z' },
  { id:'ref-4', title:'معرفی مدیر پروژه به تیم آریا', message:'آشنایی با مدیر پروژهٔ سدنا برای هم‌افزایی در پروژهٔ مشترک', sourcePersonId:'p-7', targetPersonId:null, sourceOrganizationId:'org-1', targetOrganizationId:null, relationshipId:null, status:'PENDING', createdById:'u-1', recipientUserId:'u-2', completedAt:null, notes:null, createdAt:'2026-08-29T14:20:00.000Z' },
  { id:'ref-5', title:'معرفی مشاور سرمایه‌گذاری به صندوق امید', message:'همکاری مشاورانه برای سبد سرمایه‌گذاری', sourcePersonId:'p-8', targetPersonId:'p-4', sourceOrganizationId:'org-7', targetOrganizationId:'org-5', relationshipId:'r-5', status:'DECLINED', createdById:'u-1', recipientUserId:null, completedAt:'2026-07-20T12:00:00.000Z', notes:'به دلیل تغییر اولویت‌ها رد شد.', createdAt:'2026-07-10T09:40:00.000Z' },
  { id:'ref-6', title:'معرفی مدیر خرید به سازه گستر', message:'', sourcePersonId:'p-2', targetPersonId:null, sourceOrganizationId:'org-2', targetOrganizationId:'org-8', relationshipId:null, status:'CANCELLED', createdById:'u-1', recipientUserId:null, completedAt:'2026-08-02T10:00:00.000Z', notes:null, createdAt:'2026-07-28T09:10:00.000Z' },
];

let RECS = [
  { id:'rec-1', type:'FOLLOW_UP', title:'پیگیری رابطه با بانک ملّی پارس', rationale:'اقدام بعدی ثبت‌شده برای این رابطه مهلتش رسیده است.', confidence:82, status:'PROPOSED', evidence:{nextActionAt:'2026-09-02T09:00:00.000Z', daysSinceLastInteraction:4}, relationshipId:'r-2', userId:'u-1', createdAt:'2026-08-28T08:00:00.000Z' },
  { id:'rec-2', type:'RISK_MITIGATION', title:'مدیریت ریسک رابطه با تأمین‌کننده البرز', rationale:'ریسک رابطه ۶۶ و سلامت ۴۱ است — نیاز به اقدام اصلاحی.', confidence:88, status:'PROPOSED', evidence:{riskScore:66,healthScore:41,resilienceScore:38}, relationshipId:'r-4', userId:'u-1', createdAt:'2026-08-28T08:00:00.000Z' },
  { id:'rec-3', type:'MEETING', title:'جلسهٔ راهبردی با پترو صنعت', rationale:'ارزش استراتژیک بالا همراه با تعامل اجرایی نیازمند تازه‌سازی.', confidence:76, status:'APPROVED', evidence:{strategicScore:86,daysSinceLastInteraction:9}, relationshipId:'r-1', userId:'u-1', createdAt:'2026-08-27T08:00:00.000Z' },
  { id:'rec-4', type:'OPPORTUNITY', title:'بهره‌برداری از فرصت با صندوق امید', rationale:'پتانسیل فرصت ۹۰ و سلامت رابطه کافی برای اقدام است.', confidence:79, status:'SNOOZED', snoozedUntil:'2026-09-10T09:00:00.000Z', evidence:{opportunityScore:90,healthScore:82,strategicScore:88}, relationshipId:'r-5', userId:'u-1', createdAt:'2026-08-26T08:00:00.000Z' },
  { id:'rec-5', type:'DIVERSIFICATION', title:'تنوع‌بخشی به پوشش رابطه با سدنا', rationale:'تاب‌آوری ۵۸ نشان‌دهنده ریسک تمرکز است.', confidence:64, status:'PROPOSED', evidence:{resilienceScore:58,influenceScore:66}, relationshipId:'r-3', userId:'u-1', createdAt:'2026-08-25T08:00:00.000Z' },
];
let AI_USAGE = { _count:{_all:0,byIntent:{}}, _sum:{estimatedCost:0,inputChars:0,outputChars:0} };
let PERSON_ORGS = [
  { personId:'p-1', organizationId:'org-2', roleTitle:'مدیر فروش', department:'فروش', isPrimary:true, status:'ACTIVE' },
  { personId:'p-1', organizationId:'org-4', roleTitle:'مشاور راهبردی', department:'—', isPrimary:false, status:'ACTIVE' },
  { personId:'p-7', organizationId:'org-2', roleTitle:'مدیر محصول', department:'فنی', isPrimary:true, status:'ACTIVE' },
];

const TYPE_KEYS = {
  FOLLOW_UP:'پیگیری', MEETING:'جلسه', INTRODUCTION:'معرفی', RELATIONSHIP_REPAIR:'ترمیم رابطه',
  DIVERSIFICATION:'تنوع‌بخشی', OPPORTUNITY:'فرصت', RISK_MITIGATION:'کاهش ریسک',
  PROJECT_CONNECTION:'پیوند پروژه', EXECUTIVE_ESCALATION:'ارجاع اجرایی',
};

const orgById=(id)=>ORGS.find(o=>o.id===id);
const personById=(id)=>PEOPLE.find(p=>p.id===id);
const relWithOrgs=(r)=>({...r, sourceOrganization:{id:r.sourceOrganizationId,name:orgById(r.sourceOrganizationId)?.name}, targetOrganization:{id:r.targetOrganizationId,name:orgById(r.targetOrganizationId)?.name}});

/* دلایل «چرا این رابطه در معرض ریسک است؟» — از امتیازها و سیگنال‌های واقعی همان رابطه
   (بدون دادهٔ جعلی): امتیاز ریسک/سلامت/تاب‌آوری، رکود تعامل، عقب‌افتادگی قدم بعدی،
   نبود اقدام اصلاحی باز و اقدام‌های عقب‌افتادهٔ مرتبط. */
function riskDrivers(req, r){
  const now=Date.now();
  const risk=r.riskScore??0, health=r.healthScore??100, res=r.resilienceScore??100;
  const out=[];
  const push=(tone,label,detail)=>{ out.push({tone,label,detail}); };
  if(risk>=60) push('critical','امتیاز ریسک بالا',`ریسک ${risk} از ۱۰۰ — بالاتر از آستانهٔ هشدار (۶۰).`);
  else if(risk>=40) push('warning','ریسک بالاتر از حد مطلوب',`ریسک ${risk} از ۱۰۰؛ آستانهٔ هشدار ۶۰ است.`);
  if(health<=40) push('critical','سلامت رابطهٔ بحرانی',`سلامت ${health} از ۱۰۰ — زیر آستانهٔ بحرانی (۴۰).`);
  else if(health<55) push('warning','سلامت رابطه پایین',`سلامت ${health} از ۱۰۰؛ محدودهٔ سالم از ۵۵ به بالاست.`);
  if(res<45) push('warning','تاب‌آوری ضعیف',`تاب‌آوری ${res} از ۱۰۰ — عمق شبکهٔ پشتیبان و مسیرهای جایگزین کم است.`);
  if(r.status==='WATCH') push('warning','تحت نظر (WATCH)','وضعیت رابطه توسط مالک/مدیر روابط به نظارت فعال درآمده است.');
  if(r.lastInteractionAt){
    const days=Math.floor((now-new Date(r.lastInteractionAt).getTime())/86400000);
    if(days>60) push('critical','رکود تعامل',`آخرین تعامل ${days} روز پیش بود (بیش از ۲ ماه) — رابطه رو به سردی است.`);
    else if(days>30) push('warning','فاصلهٔ طولانی از تعامل',`آخرین تعامل ${days} روز پیش بود؛ بازهٔ سالم زیر ۳۰ روز است.`);
  }
  if(r.nextActionAt&&new Date(r.nextActionAt).getTime()<now) push('warning','قدمِ برنامه‌ریزی‌شده عقب افتاده',`قدم بعدی برای ${faDate(r.nextActionAt)} تعیین شده و هنوز انجام نشده است.`);
  const openActs=scopedActions(req).filter(a=>a.relationshipId===r.id&&['OPEN','IN_PROGRESS','BLOCKED'].includes(a.status));
  if(risk>=40&&openActs.length===0) push('warning','بدون اقدام اصلاحی باز','برای این رابطه هیچ اقدام بازِ کاهش ریسک ثبت نشده است.');
  const lateActs=openActs.filter(a=>a.dueAt&&new Date(a.dueAt).getTime()<now);
  if(lateActs.length) push('critical',`${lateActs.length} اقدام عقب‌افتاده`,`نخستین: «${lateActs[0].title}» — موعد ${faDate(lateActs[0].dueAt)} گذشته است.`);
  return out.slice(0,6);
}
const orgCounts=(o)=>({
  people:PEOPLE.filter(p=>p.organizationId===o.id).length,
  sourceRelationships:RELS.filter(r=>r.sourceOrganizationId===o.id).length,
  targetRelationships:RELS.filter(r=>r.targetOrganizationId===o.id).length,
  projects:PROJECTS.filter(p=>p.organizationId===o.id).length,
  opportunities:OPPORTUNITIES.filter(p=>p.organizationId===o.id).length,
});
/* وضعیت مشتق‌شدهٔ جلسه: نتیجه دارد → تکمیل؛ هنوز نرسیده → پیشِ رو؛ گذشته بدون نتیجه → عقب‌افتاده */
const meetingStatus=(m)=>m.outcome?'COMPLETED':new Date(m.startAt).getTime()>Date.now()?'UPCOMING':'OVERDUE';
const meetingView=(m)=>({...m,status:meetingStatus(m),participants:(m.participants??[]).map((p)=>({person:personById(p.personId)?{id:p.personId,firstName:personById(p.personId).firstName,lastName:personById(p.personId).lastName}:{id:p.personId,firstName:p.personId,lastName:''}})),organization:orgById(m.organizationId)?{id:m.organizationId,name:orgById(m.organizationId).name}:null});
/* نمای غنی اقدام: مالک + رابطه + وابستگی‌های تفکیک‌شده + مسدودکننده‌ها */
const actionView=(a)=>{
  const po=personById(a.ownerId);
  const owner=po?{id:po.id,name:`${po.firstName} ${po.lastName??''}`.trim()}:null;
  const rel=RELS.find(r=>r.id===a.relationshipId);
  const relationship=rel?{id:rel.id,relationshipType:rel.relationshipType,sourceOrganization:orgById(rel.sourceOrganizationId)?{id:rel.sourceOrganizationId,name:orgById(rel.sourceOrganizationId).name}:null,targetOrganization:orgById(rel.targetOrganizationId)?{id:rel.targetOrganizationId,name:orgById(rel.targetOrganizationId).name}:null}:null;
  const resolve=(id)=>ACTIONS.find(x=>x.id===id);
  const dependencies=(a.dependencies??[]).map(resolve).filter(Boolean).map(x=>({id:x.id,title:x.title,status:x.status,priority:x.priority,dueAt:x.dueAt}));
  const blockedBy=ACTIONS.filter(x=>(x.dependencies??[]).includes(a.id)).map(x=>({id:x.id,title:x.title,status:x.status,priority:x.priority,dueAt:x.dueAt}));
  return {...a,owner,relationship,dependencies,blockedBy};
};
/* نمای غنی تعهد: سازمان طرف + مسئول اجرا + شخص طرف + رابطه/جلسه/پروژه */
const commitmentView=(c)=>{
  const now=Date.now();
  const org=orgById(c.organizationId);
  const owner=personById(c.ownerId);
  const person=personById(c.personId);
  const rel=c.relationshipId?RELS.find(r=>r.id===c.relationshipId):null;
  const meeting=c.meetingId?MEETINGS.find(m=>m.id===c.meetingId):null;
  const project=c.projectId?PROJECTS.find(p=>p.id===c.projectId):null;
  return {...c,
    organization:org?{id:org.id,name:org.name}:null,
    owner:owner?{id:owner.id,name:`${owner.firstName} ${owner.lastName??''}`.trim()}:null,
    person:person?{id:person.id,name:`${person.firstName} ${person.lastName??''}`.trim(),title:person.title}:null,
    relationship:rel?{id:rel.id,relationshipType:rel.relationshipType,sourceOrganization:orgById(rel.sourceOrganizationId)?{id:rel.sourceOrganizationId,name:orgById(rel.sourceOrganizationId).name}:null,targetOrganization:orgById(rel.targetOrganizationId)?{id:rel.targetOrganizationId,name:orgById(rel.targetOrganizationId).name}:null}:null,
    meeting:meeting?{id:meeting.id,title:meeting.title,startAt:meeting.startAt}:null,
    project:project?{id:project.id,name:project.name}:null,
    late: c.status==='OPEN' && c.dueAt && new Date(c.dueAt).getTime()<now,
  };
};
/* نمای غنی پروژه: سازمان + مالک + پیشرفت + الزامات/ریسک‌ها/مراحل/روابط پیوندی */
const projectView=(p)=>{
  const extra=PROJECT_EXTRA[p.id]??{requirements:[],risks:[],milestones:[],relationships:[]};
  const milestones=(extra.milestones??[]);
  const doneMs=milestones.filter(m=>m.status==='COMPLETED').length;
  const progress=milestones.length?Math.round(doneMs/milestones.length*100):null;
  const risks=(extra.risks??[]).map(r=>({...r,score:Math.round(((r.probability??0)*(r.impact??0))/100)}));
  const requirements=(extra.requirements??[]);
  const relationships=(extra.relationships??[]).map(x=>{
    const rel=RELS.find(r=>r.id===x.relationshipId);
    return rel?{...x,relationship:relWithOrgs(rel)}:null;
  }).filter(Boolean);
  const owner=personById(p.ownerId);
  return {...p,
    owner:owner?{id:owner.id,name:`${owner.firstName} ${owner.lastName??''}`.trim()}:null,
    organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null,
    priority:p.priority??'MEDIUM',
    progress,
    doneMilestones:doneMs,
    totalMilestones:milestones.length,
    requirements,risks,milestones,relationships,
  };
};
/* نمای غنی فرصت: سازمان + مالک + رابطه + پروژه + ارزش موزون */
const opportunityView=(o)=>{
  const owner=personById(o.ownerId);
  const rel=o.relationshipId?RELS.find(r=>r.id===o.relationshipId):null;
  const pr=o.projectId?PROJECTS.find(p=>p.id===o.projectId):null;
  const expectedValue=Math.round(((o.value??0)*(o.probability??0))/100);
  return {...o,
    owner:owner?{id:owner.id,name:`${owner.firstName} ${owner.lastName??''}`.trim()}:null,
    organization:orgById(o.organizationId)?{id:o.organizationId,name:orgById(o.organizationId).name}:null,
    relationship:rel?{id:rel.id,relationshipType:rel.relationshipType,sourceOrganization:orgById(rel.sourceOrganizationId)?{id:rel.sourceOrganizationId,name:orgById(rel.sourceOrganizationId).name}:null,targetOrganization:orgById(rel.targetOrganizationId)?{id:rel.targetOrganizationId,name:orgById(rel.targetOrganizationId).name}:null}:null,
    project:pr?{id:pr.id,name:pr.name}:null,
    expectedValue,
    openStatus:!['WON','LOST'].includes(o.status),
  };
};

/* --------------------------- identities & scope --------------------------- */
const SEED_USERS = {
  'demo@srip.local': {
    id:'u-1', email:'demo@srip.local', username:'demo', name:'مدیر ارشد (مالک)', password:'123456',
    memberships:[{id:'mb-1',organizationId:'org-1',organizationName:'هلدینگ آریا',role:'SUPER_ADMIN',department:'استراتژی',dataScope:'ALL',accessScope:'ALL',isPrimary:true}],
    permissions:['*'],
    accessibleOrganizationIds:ORGS.map(o=>o.id),
    isOwner:true,
    isActive:true,
    emailVerifiedAt:'2026-06-01T08:00:00.000Z',
    lastLoginAt:'2026-09-03T10:30:00.000Z',
    createdAt:'2026-01-15T08:00:00.000Z',
  },
  'client@arya-tech.ir': {
    id:'u-2', email:'client@arya-tech.ir', username:'client', name:'سارا محمدی', password:'123456',
    memberships:[{id:'mb-2',organizationId:'org-2',organizationName:'آریا فناوری',role:'RELATIONSHIP_MANAGER',department:'فروش',dataScope:'ORGANIZATION',accessScope:'ORGANIZATION',isPrimary:true}],
    permissions:['dashboard.read','organization.read','person.read','relationship.read','meeting.read','interaction.read','action.read','commitment.read','project.read','opportunity.read','network.read','ai.query','ai.executive_brief','recommendation.read','report.read','report.export','approval.request','approval.read','search.read','notification.read','document.read','calendar.read','help.read','privacy.read','privacy.access','privacy.export','privacy.erase','enterprise.read','feature_flag.read','analytics.read','analytics.write'],
    accessibleOrganizationIds:['org-2'],
    isOwner:false,
    isActive:true,
    emailVerifiedAt:'2026-03-02T08:00:00.000Z',
    lastLoginAt:'2026-09-02T11:15:00.000Z',
    createdAt:'2026-03-02T08:00:00.000Z',
  },
};
// نام کاربری کوتاه → ایمیلِ حساب (demo → demo@srip.local و …)
const USER_ALIASES = Object.fromEntries(
  Object.values(SEED_USERS).filter(u=>u.username).map(u=>[u.username.toLowerCase(), u.email])
);
function visibleOrgIds(req){
  const u=currentUser(req);
  if(!u) return [];
  return u.isOwner ? ORGS.map(o=>o.id) : u.accessibleOrganizationIds;
}
function inScope(req,orgId){ return visibleOrgIds(req).includes(orgId); }
const scopedOrgs=(req)=>ORGS.filter(o=>inScope(req,o.id));
const scopedPeople=(req)=>PEOPLE.filter(p=>inScope(req,p.organizationId));
// A relationship belongs to a tenant if at least one endpoint is in its scope
// (its own relationships with outside organizations remain visible).
const scopedRels=(req)=>RELS.filter(r=>inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId));
const relInScope=(req,r)=>inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId);
const scopedMeetings=(req)=>MEETINGS.filter(m=>inScope(req,m.organizationId)||(m.relationshipId&&relInScope(req,RELS.find(r=>r.id===m.relationshipId))));
const scopedInteractions=(req)=>INTERACTIONS.filter(x=>!x.deletedAt&&(inScope(req,x.organizationId)||(x.relationshipId&&relInScope(req,RELS.find(r=>r.id===x.relationshipId)))));
const scopedActions=(req)=>ACTIONS.filter(a=>{const r=RELS.find(x=>x.id===a.relationshipId);return !r||inScope(req,r.sourceOrganizationId);});
const scopedCommitments=(req)=>COMMITMENTS.filter(c=>inScope(req,c.organizationId)||(c.relationshipId&&relInScope(req,RELS.find(r=>r.id===c.relationshipId))));
const scopedProjects=(req)=>PROJECTS.filter(p=>{
  if(inScope(req,p.organizationId)) return true;
  const rels=(PROJECT_EXTRA[p.id]?.relationships??[]).map(x=>RELS.find(r=>r.id===x.relationshipId));
  return rels.some(r=>r&&relInScope(req,r));
});
const scopedOpps=(req)=>OPPORTUNITIES.filter(o=>{
  if(inScope(req,o.organizationId)) return true;
  const rel=o.relationshipId?RELS.find(r=>r.id===o.relationshipId):null;
  return rel&&relInScope(req,rel);
});
const scopedRecs=(req)=>RECS.filter(r=>{if(!r.relationshipId)return true;const rel=RELS.find(x=>x.id===r.relationshipId);return rel&&inScope(req,rel.sourceOrganizationId);});

/* ---------------------------------------------------------------------------
   Persistence & security layer (production-shaped mock backend):
     · data persisted to scripts/.data/srip-db.json (survives restarts)
     · passwords hashed with scrypt (per-user salt, timing-safe compare)
     · JWT HS256 signed tokens (15m access) + rotating refresh tokens (7d)
       with a persisted revocation list (logout / rotation)
     · append-only audit log (persisted, capped)
   Run with `--reset` to wipe the store and reseed demo data.
   --------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'srip-db.json');
const SECRET_FILE = path.join(DATA_DIR, 'jwt-secret');

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const b64urlDecode = (s) => Buffer.from(s, 'base64url');
function loadSecret() {
  if (process.env.SRIP_JWT_SECRET) return process.env.SRIP_JWT_SECRET;
  try { return fs.readFileSync(SECRET_FILE, 'utf8').trim(); }
  catch { const s = crypto.randomBytes(32).toString('hex'); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SECRET_FILE, s); return s; }
}
const JWT_SECRET = loadSecret();
const ACCESS_TTL = 15 * 60;          // 15 minutes
const REFRESH_TTL = 7 * 24 * 3600;   // 7 days

function signJwt(payload, ttl) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl, jti: crypto.randomUUID() }));
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${body}`).digest());
  return `${h}.${body}.${sig}`;
}
function verifyJwt(token) {
  try {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (expected !== s) return null;
    const payload = JSON.parse(b64urlDecode(b).toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (DB?.revokedJtis?.includes(payload.jti)) return null;
    return payload;
  } catch { return null; }
}
function hashPassword(pw, salt) { return crypto.scryptSync(String(pw), salt, 64).toString('hex'); }
function verifyPassword(pw, salt, hash) {
  const h = Buffer.from(hashPassword(pw, salt), 'hex');
  const e = Buffer.from(hash, 'hex');
  return h.length === e.length && crypto.timingSafeEqual(h, e);
}
function saveDb() { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 1)); }

let DB = null;
function loadDb() {
  if (process.argv.includes('--reset')) { try { fs.rmSync(DB_FILE, { force: true }); } catch {} }
  try {
    const d = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (d && d.version === 2) {
      ORGS = d.orgs; PEOPLE = d.people; RELS = d.rels; MEETINGS = d.meetings;
      ACTIONS = d.actions; COMMITMENTS = d.commitments; PROJECTS = d.projects;
      PROJECT_EXTRA = d.projectExtra; OPPORTUNITIES = d.opportunities;
      INTERACTIONS = d.interactions; NOTIFICATIONS = d.notifications; RECS = d.recs;
      AI_USAGE = d.aiUsage; PERSON_ORGS = d.personOrgs;
      DB = d;
      if (!Array.isArray(DB.audit)) DB.audit = [];
      if (!Array.isArray(DB.revokedJtis)) DB.revokedJtis = [];
      if (!DB.users) DB.users = {};
    }
  } catch { DB = null; }
  if (!DB) {
    DB = { version: 2, users: {}, orgs: ORGS, people: PEOPLE, rels: RELS, meetings: MEETINGS,
      actions: ACTIONS, commitments: COMMITMENTS, projects: PROJECTS, projectExtra: PROJECT_EXTRA,
      opportunities: OPPORTUNITIES, interactions: INTERACTIONS, notifications: NOTIFICATIONS,
      recs: RECS, aiUsage: AI_USAGE, personOrgs: PERSON_ORGS, audit: [], revokedJtis: [], nextId: 1 };
  }
  // seed identities with real scrypt hashes (kept on disk afterwards)
  for (const [email, u] of Object.entries(SEED_USERS)) {
    if (!DB.users[email]) {
      const salt = crypto.randomBytes(16).toString('hex');
      DB.users[email] = { ...u, salt, passwordHash: hashPassword(u.password, salt) };
      delete DB.users[email].password;
    } else {
      // merge new permissions/membership metadata into persisted user
      const prev = DB.users[email];
      if (u.permissions?.length) {
        prev.permissions = [...new Set([...(prev.permissions ?? []), ...u.permissions])];
      }
      prev.isOwner = !!u.isOwner;
      prev.accessibleOrganizationIds = u.accessibleOrganizationIds ?? prev.accessibleOrganizationIds ?? [];
      if (prev.isActive !== false) prev.isActive = true;
      prev.createdAt ??= '2026-08-01T08:00:00.000Z';
      prev.emailVerifiedAt ??= '2026-08-01T08:00:00.000Z';
      if (prev.lastLoginAt == null) prev.lastLoginAt = null;
      if (!Array.isArray(prev.memberships)) prev.memberships = [];
    }
  }
  seedRoleStore();
  seedTagStore();
  seedCustomFields();
  seedScoringRules();
  seedNotificationRules();
  seedAuditDemo();
  seedFeatureFlags();
  seedExportLog();
  seedRetention();
  seedMasterData();
  seedIntegrations();
  seedReferralStore();
  seedApprovals();
  seedWorkflowStore();
  seedSecurityEvents();
  seedPrivacyStore();
  seedEnterpriseStore();
  seedSettingsStore();
  seedSessionsStore();
  seedAnalyticsStore();
  saveDb();
}
let USERS = null;

function currentUser(req) {
  const auth = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const p = verifyJwt(auth);
  if (!p || !USERS[p.email]) return null;
  return USERS[p.email];
}
function audit(req, action, entity, entityId, outcome = 'OK', meta = {}) {
  const u = currentUser(req);
  DB.audit.unshift({ id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(), actorEmail: u?.email ?? 'anonymous', action,
    entity, entityId: entityId ?? null, outcome, ip: req.socket?.remoteAddress ?? null, meta });
  if (DB.audit.length > 500) DB.audit.length = 500;
}

/* --------------------------- admin: RBAC catalog & access recompute ----- */
const ROLE_LABELS_ADMIN={SUPER_ADMIN:'مدیر کل سیستم',HOLDING_ADMIN:'مدیر هلدینگ',HOLDING_EXECUTIVE:'مدیر ارشد هلدینگ',SUBSIDIARY_ADMIN:'مدیر شرکت',SUBSIDIARY_EXECUTIVE:'مدیر ارشد شرکت',RELATIONSHIP_MANAGER:'مدیر روابط',PROJECT_MANAGER:'مدیر پروژه',ANALYST:'تحلیلگر',STANDARD_USER:'کاربر استاندارد',READ_ONLY:'فقط خواندنی'};
const R_READ=['dashboard.read','organization.read','person.read','relationship.read','network.read','interaction.read','meeting.read','action.read','commitment.read','project.read','opportunity.read','recommendation.read','report.read','document.read','notification.read','search.read','calendar.read','help.read','user.read','session.read','analytics.read','ai.query','ai.executive_brief'];
const R_WRITE=['person.write','relationship.write','interaction.write','meeting.write','action.write','commitment.write','project.write','opportunity.write','recommendation.approve','document.write','data.manage'];
const R_READONLY_PERMS=R_READ.filter(p=>!['ai.query','ai.executive_brief','analytics.read','recommendation.read'].includes(p));
const ROLE_CATALOG=[
  {key:'SUPER_ADMIN',name:ROLE_LABELS_ADMIN.SUPER_ADMIN,description:'مالک سامانه — دسترسی کامل، غیرقابل واگذاری.',holding:true,perms:['*']},
  {key:'HOLDING_ADMIN',name:ROLE_LABELS_ADMIN.HOLDING_ADMIN,description:'مدیریت هلدینگ و همهٔ شرکت‌های زیرمجموعه.',holding:true,perms:[...R_READ,...R_WRITE,'metrics.read']},
  {key:'HOLDING_EXECUTIVE',name:ROLE_LABELS_ADMIN.HOLDING_EXECUTIVE,description:'مدیریت ارشد هلدینگ — دید کامل زیرمجموعه‌ها.',holding:true,perms:[...R_READ,'metrics.read']},
  {key:'SUBSIDIARY_ADMIN',name:ROLE_LABELS_ADMIN.SUBSIDIARY_ADMIN,description:'مدیریت شرکت — عملیات و دسترسی‌های شرکت.',holding:false,perms:[...R_READ,...R_WRITE,'metrics.read']},
  {key:'SUBSIDIARY_EXECUTIVE',name:ROLE_LABELS_ADMIN.SUBSIDIARY_EXECUTIVE,description:'مدیریت ارشد شرکت — دید کامل شرکت.',holding:false,perms:[...R_READ,'metrics.read']},
  {key:'RELATIONSHIP_MANAGER',name:ROLE_LABELS_ADMIN.RELATIONSHIP_MANAGER,description:'مدیر روابط — ثبت و پیگیری تعاملات و اقدامات.',holding:false,perms:[...R_READ,...R_WRITE]},
  {key:'PROJECT_MANAGER',name:ROLE_LABELS_ADMIN.PROJECT_MANAGER,description:'مدیر پروژه — مدیریت پروژه‌ها و اقدامات.',holding:false,perms:[...R_READ,...R_WRITE]},
  {key:'ANALYST',name:ROLE_LABELS_ADMIN.ANALYST,description:'تحلیلگر — گزارش و هوشمندی.',holding:false,perms:[...R_READ]},
  {key:'STANDARD_USER',name:ROLE_LABELS_ADMIN.STANDARD_USER,description:'کاربر استاندارد — دسترسی عملیاتی عادی.',holding:false,perms:[...R_READ]},
  {key:'READ_ONLY',name:ROLE_LABELS_ADMIN.READ_ONLY,description:'فقط خواندنی — بدون هیچ عملیات ویرایشی.',holding:false,perms:[...R_READONLY_PERMS]},
];

/* ---------- permission catalog (system-wide, deterministic) ---------- */
const PERMISSION_GROUPS_FA={General:'عمومی',Core:'هسته',Meetings:'جلسات',Work:'اقدامات و پروژه‌ها',Intelligence:'هوش و تحلیل',Knowledge:'دانش و جستجو',Account:'حساب و نشست',DataGovernance:'داده و کیفیت',Security:'امنیت',Admin:'مدیریت و یکپارچه‌سازی'};
const P_DEFS=[
  ['General','dashboard.read','مشاهده داشبورد'],
  ['Core','organization.read','مشاهده سازمان‌ها'],['Core','organization.write','ثبت و ویرایش سازمان'],['Core','org.read','مشاهده سازمان (سازگاری)'],
  ['Core','person.read','مشاهده اشخاص'],['Core','person.write','ثبت و ویرایش شخص'],
  ['Core','relationship.read','مشاهده روابط'],['Core','relationship.write','ثبت و ویرایش رابطه'],
  ['Core','interaction.read','مشاهده تعاملات'],['Core','interaction.write','ثبت تعامل'],
  ['Core','network.read','مشاهده شبکه اطلاعاتی'],
  ['Meetings','meeting.read','مشاهده جلسات'],['Meetings','meeting.write','برنامه‌ریزی و ویرایش جلسه'],['Meetings','calendar.read','مشاهده تقویم'],
  ['Work','action.read','مشاهده اقدامات'],['Work','action.write','ثبت و تغییر اقدام'],
  ['Work','commitment.read','مشاهده تعهدات'],['Work','commitment.write','ثبت و تغییر تعهد'],
  ['Work','project.read','مشاهده پروژه‌ها'],['Work','project.write','مدیریت پروژه'],
  ['Work','opportunity.read','مشاهده فرصت‌ها'],['Work','opportunity.write','ثبت و تغییر فرصت'],
  ['Work','approval.read','مشاهده تأییدها'],['Work','workflow.read','مشاهده گردش کارها'],
  ['Intelligence','analytics.read','تحلیل و هوشمندی'],['Intelligence','analytics.write','ثبت رویداد و نتیجهٔ سنجش'],['Intelligence','ai.query','پرس‌وجوی هوشمند'],['Intelligence','ai.executive_brief','گزارش راهبردی هوش مصنوعی'],
  ['Intelligence','recommendation.read','مشاهده پیشنهادها'],['Intelligence','recommendation.approve','تأیید پیشنهاد'],['Intelligence','report.read','مشاهده و خروجی گزارش‌ها'],
  ['Knowledge','document.read','مشاهده اسناد'],['Knowledge','document.write','بارگذاری و ویرایش سند'],
  ['Knowledge','search.read','جستجوی سراسری'],['Knowledge','notification.read','مشاهده اعلان‌ها'],['Knowledge','help.read','مشاهده راهنما'],
  ['Account','user.read','مدیریت حساب کاربری'],['Account','session.read','مدیریت نشست‌ها'],['Account','session.admin.revoke','ابطال مدیریتی نشست'],
  ['DataGovernance','data.manage','مدیریت داده'],['DataGovernance','data.quality.read','مشاهده کیفیت داده'],['DataGovernance','data.lifecycle_status','مشاهده چرخهٔ حیات داده'],
  ['DataGovernance','privacy.read','مشاهده حریم خصوصی'],['DataGovernance','privacy.manage','مدیریت حریم خصوصی'],['DataGovernance','audit.read','مشاهده ممیزی'],
  ['Security','security.read','مشاهده امنیت'],['Security','enterprise.security','حاکمیت و امنیت سازمانی'],
  ['Admin','admin.users','مدیریت کاربران'],['Admin','role.manage','مدیریت نقش‌ها'],['Admin','access.manage','مدیریت دسترسی‌ها'],
  ['Admin','enterprise.admin','مدیریت کل سامانه'],['Admin','enterprise.read','مشاهده حاکمیت سازمانی'],['Admin','enterprise.export','صدور خروجی سازمانی'],['Admin','feature_flag.read','مشاهده پرچم‌های ویژگی'],['Admin','feature_flag.write','مدیریت پرچم‌های ویژگی'],
  ['Admin','integration.read','مشاهده یکپارچه‌سازی‌ها'],['Admin','health.read','مشاهده سلامت'],['Admin','metrics.read','مشاهده سنجه‌ها'],
];
const PERMISSIONS=P_DEFS.map(([group,key,name])=>({group,key,name}));
const permName=(k)=>k==='*'?'دسترسی کامل (مالک)':(PERMISSIONS.find(p=>p.key===k)?.name??k);
function seedRoleStore(){
  if(!Array.isArray(DB.roles)) DB.roles=[];
  const have=new Set(DB.roles.map(r=>r.key));
  for(const c of ROLE_CATALOG){
    if(have.has(c.key)) continue;
    DB.roles.push({id:`role-${c.key}`,key:c.key,name:c.name,description:c.description,isSystem:true,holding:!!c.holding,superAdmin:c.key==='SUPER_ADMIN',permissions:[...(c.perms??[])]});
  }
}
function roleMeta(key){
  return (Array.isArray(DB?.roles)?DB.roles.find(r=>r.key===key):null) ?? ROLE_CATALOG.find(c=>c.key===key) ?? null;
}
function roleView(r){
  const perms=(r.permissions??[]);
  return {id:r.id,key:r.key,name:r.name,description:r.description??null,isSystem:!!r.isSystem,isActive:r.isActive!==false,holding:!!r.holding,superAdmin:!!r.superAdmin,
    permissionCount:perms.length,
    rolePermissions:perms.map(p=>({permission:{key:p,name:permName(p)}}))};
}
function rolesSorted(){ return [...(DB?.roles??ROLE_CATALOG)].sort((a,b)=>(b.isSystem?1:0)-(a.isSystem?1:0)||a.key.localeCompare(b.key)); }

const userById=(id)=>Object.values(USERS??DB?.users??{}).find(u=>u.id===id)??null;
function orgSubtreeIds(rootId){
  const out=[rootId]; let changed=true;
  while(changed){ changed=false; for(const o of ORGS){ if(!o.parentOrganizationId||out.includes(o.id)) continue; if(out.includes(o.parentOrganizationId)){ out.push(o.id); changed=true; } } }
  return out;
}

/* ---------- admin tags (Tag + TagAssignment, parity with real schema) ------- */
const TAG_SEED_NAMES=['مشتری کلیدی','شریک راهبردی','در حال مذاکره','ریسک بالا','فرصت ویژه','دولتی','بین‌المللی','تأمین‌کننده حیاتی'];
function seedTagStore(){
  if(!Array.isArray(DB.tags)||DB.tags.length===0){
    DB.tags=TAG_SEED_NAMES.map((name,i)=>({id:`tag-${i+1}`,name,createdAt:`2026-0${(i%6)+1}-10T08:00:00.000Z`}));
  }
  if(!Array.isArray(DB.tagAssignments)||DB.tagAssignments.length===0){
    const as=[]; let n=0;
    const add=(entityType,entityId,names)=>{ for(const nm of names){ const t=DB.tags.find(x=>x.name===nm); if(t) as.push({id:`ta-${++n}`,tagId:t.id,entityType,entityId}); } };
    ORGS.forEach((o,i)=>{ add('ORGANIZATION',o.id,[TAG_SEED_NAMES[i%4]]); if(o.type==='BANK') add('ORGANIZATION',o.id,['دولتی']); if(o.type==='SUPPLIER') add('ORGANIZATION',o.id,['تأمین‌کننده حیاتی']); });
    PEOPLE.slice(0,14).forEach((p,i)=>{ add('PERSON',p.id,[TAG_SEED_NAMES[(i+2)%5]]); });
    RELS.slice(0,6).forEach((r,i)=>{ add('RELATIONSHIP',r.id,[TAG_SEED_NAMES[(i+3)%4]]); });
    MEETINGS.slice(0,8).forEach((m,i)=>{ add('MEETING',m.id,[TAG_SEED_NAMES[(i+1)%4]]); });
    DB.tagAssignments=as;
  }
}
function tagView(t){
  const as=DB.tagAssignments.filter(a=>a.tagId===t.id);
  const by={};
  for(const a of as) by[a.entityType]=(by[a.entityType]??0)+1;
  const ENTITY_TYPE_FA={ORGANIZATION:'سازمان',PERSON:'شخص',RELATIONSHIP:'رابطه',MEETING:'جلسه',PROJECT:'پروژه',DOCUMENT:'سند',ACTION:'اقدام',INTERACTION:'تعامل'};
  return {id:t.id,name:t.name,createdAt:t.createdAt,usage:as.length,breakdown:Object.fromEntries(Object.entries(by).map(([k,v])=>[ENTITY_TYPE_FA[k]??k,v]))};
}


/* ---------- custom fields (CustomField + CustomFieldValue parity) ---------- */
const CF_ENTITY_TYPES=['Organization','Person','Relationship','Interaction','Meeting','Action','Commitment','Project','Requirement','Opportunity','Recommendation','Document','Note','Workflow','Referral','ConnectionPath','OrganizationUnit'];
const CF_FIELD_TYPES=['text','number','boolean','date','datetime','select','multiselect','email','url'];
const CF_ENTITY_FA={Organization:'سازمان',Person:'شخص',Relationship:'رابطه',Interaction:'تعامل',Meeting:'جلسه',Action:'اقدام',Commitment:'تعهد',Project:'پروژه',Requirement:'نیازمندی',Opportunity:'فرصت',Recommendation:'پیشنهاد',Document:'سند',Note:'یادداشت',Workflow:'گردش کار',Referral:'معرفی',ConnectionPath:'مسیر ارتباط',OrganizationUnit:'واحد سازمانی'};
const CF_FIELD_FA={text:'متن',number:'عدد',boolean:'بلی/خیر',date:'تاریخ',datetime:'تاریخ و زمان',select:'انتخاب تکی',multiselect:'انتخاب چندگانه',email:'ایمیل',url:'پیوند'};
const CF_SEED_DEFS=[
  ['legal_code','شناسهٔ ثبت حقوقی','Organization','text',true,true],
  ['national_id','شناسهٔ ملی','Person','text',true,true],
  ['priority','اولویت','Relationship','select',true,true,['کم','متوسط','زیاد','بحرانی']],
  ['linkedin','لینکدین','Person','url',false,true],
  ['kpi_target','هدف KPI سالانه','Organization','number',false,false],
  ['is_public','سهامی عام','Organization','boolean',false,false],
];
function seedCustomFields(){
  if(!Array.isArray(DB.customFields)||DB.customFields.length===0){
    DB.customFields=CF_SEED_DEFS.map((d,i)=>({id:`cf-${i+1}`,key:d[0],label:d[1],entityType:d[2],fieldType:d[3],options:Array.isArray(d[6])?d[6]:null,required:!!d[4],active:d[5]!==false,organizationId:null,createdById:null,createdAt:`2026-06-0${(i%5)+1}T08:00:00.000Z`,updatedAt:`2026-06-0${(i%5)+1}T08:00:00.000Z`}));
  }
  if(!Array.isArray(DB.customFieldValues)||DB.customFieldValues.length===0){
    const vs=[];
    const cf=(k)=>DB.customFields.find(x=>x.key===k);
    const text=(f,entityType,entityId,v)=>{ vs.push({id:`cfv-${f.id}-${entityId}`,customFieldId:f.id,entityType,entityId,stringValue:v}); };
    ORGS.forEach(o=>{ const l=cf('legal_code'); if(l) text(l,'Organization',o.id,`${10000+Math.floor(Math.random()*89999)}`); });
    PEOPLE.slice(0,10).forEach(p=>{ const n=cf('national_id'); if(n) text(n,'Person',p.id,`${Math.floor(Math.random()*9)+1}${String(Math.floor(Math.random()*900000000)+100000000)}`); });
    RELS.slice(0,8).forEach((r,i)=>{ const pr=cf('priority'); if(pr) vs.push({id:`cfv-${pr.id}-${r.id}`,customFieldId:pr.id,entityType:'Relationship',entityId:r.id,jsonValue:['کم','متوسط','زیاد','بحرانی'][i%4]}); });
    DB.customFieldValues=vs;
  }
}
function cfView(d){ return {id:d.id,key:d.key,label:d.label,entityType:d.entityType,fieldType:d.fieldType,options:d.options??null,required:!!d.required,active:d.active!==false,organizationId:d.organizationId??null,createdAt:d.createdAt??null,updatedAt:d.updatedAt??null,valueCount:DB.customFieldValues.filter(v=>v.customFieldId===d.id).length}; }


/* ---------- scoring rules (ScoringRule parity) ---------- */
const SCORE_TYPES=['HEALTH','RISK','STRATEGIC','INFLUENCE','OPPORTUNITY','RESILIENCE'];
const SCORE_ENTITY_TYPES=['ORGANIZATION','PERSON','RELATIONSHIP','MEETING','ACTION','PROJECT','OPPORTUNITY'];
const SC_SEED=[
  ['health_score_formula','سلامت رابطه','HEALTH','RELATIONSHIP',1.0,{inputs:['تعاملات تازه','پاسخ به تعهدات','قدمت رابطه'],formula:'۴۵٪ تازگی تعامل + ۳۰٪ پایبندی به تعهدات + ۲۵٪ قدمت و تداوم'},1,true],
  ['risk_score_formula','ریسک رابطه','RISK','RELATIONSHIP',1.0,{inputs:['وقفهٔ تعامل','تعهد عقب‌افتاده','تمرکز وابستگی'],formula:'وزن‌دهی وقفه‌ها و تعهدات معوق'},2,true],
  ['strategic_importance','اهمیت راهبردی رابطه','STRATEGIC','RELATIONSHIP',0.9,{inputs:['نقشهٔ استراتژی','حجم مبادلات','جایگاه صنعت'],formula:'ترکیب وزنی شاخص‌های راهبردی'},1,true],
  ['influence_aggregate','نفوذ ترکیبی شخص','INFLUENCE','PERSON',1.0,{inputs:['سمت','گسترهٔ ارتباطات','سابقهٔ تصمیم‌گیری'],formula:'جمع وزنی سمت و مرکزیت شبکه'},1,true],
  ['opportunity_pipeline','سیگنال فرصت','OPPORTUNITY','RELATIONSHIP',0.8,{inputs:['فرصت‌های باز','پروژه‌های مشترک'],formula:'نسبت فرصت‌های فعال به کل'},1,true],
  ['engagement_freshness','تازگی تعامل سازمان','HEALTH','ORGANIZATION',0.7,{inputs:['تعاملات ۹۰ روز اخیر'],formula:'امتیاز تازگی بر پایهٔ آخرین تعامل'},1,true],
  ['legacy_manual_formula','فرمول دستی قدیمی','RISK','PROJECT',0.5,{description:'قاعدهٔ پیشین — جایگزین نشده'},1,false],
];
function seedScoringRules(){
  if(!Array.isArray(DB.scoringRules)||DB.scoringRules.length===0){
    DB.scoringRules=SC_SEED.map((x,i)=>({id:`sr-${i+1}`,key:x[0],name:x[1],scoreType:x[2],entityType:x[3],weight:x[4],definition:x[5],version:x[6],active:x[7]!==false,organizationId:null,createdAt:`2026-05-0${(i%4)+1}T08:00:00.000Z`}));
  }
}
function srView(r){ return {id:r.id,key:r.key,name:r.name,scoreType:r.scoreType,entityType:r.entityType,weight:r.weight,definition:r.definition,version:r.version,active:r.active!==false,organizationId:r.organizationId??null,createdAt:r.createdAt??null}; }


/* ---------- notification rules (NotificationRule parity) ---------- */
const NR_CHANNELS=['IN_APP','EMAIL','PUSH'];
const NR_EVENT_TYPES=['organization.created','organization.updated','organization.deleted','person.created','person.updated','person.deleted','relationship.created','relationship.updated','relationship.deleted','interaction.created','interaction.updated','interaction.deleted','meeting.created','meeting.updated','meeting.deleted','meeting.completed','commitment.created','commitment.updated','commitment.deleted','commitment.completed','commitment.overdue','action.created','action.updated','action.deleted','action.completed','project.created','project.updated','project.deleted','score.updated','relationship.score.changed','relationship.status.changed','relationship.lifecycle.changed','opportunity.created','opportunity.updated','opportunity.deleted','opportunity.status.changed','recommendation.created','recommendation.updated','recommendation.deleted','recommendation.viewed','recommendation.accepted','recommendation.action.completed','integration.webhook.received','approval.requested','approval.approved','approval.rejected','data.import.approved','data.import.completed','integration.sync.completed','integration.sync.failed','*'];
const NR_SEED=[
  ['new_meeting_inapp','اعلان جلسهٔ جدید','meeting.created',['IN_APP'],{title:'جلسهٔ جدید برنامه‌ریزی شد',body:'جلسهٔ «{title}» در {date} با {organization} ثبت شد.'},null,true],
  ['overdue_commitment_alert','هشدار تعهد معوق','commitment.overdue',['IN_APP','EMAIL'],{title:'تعهد عقب افتاد',body:'تعهد «{description}» به موعد {dueAt} نرسیده و معوق شد.'},null,true],
  ['relationship_risk_alert','هشدار ریسک رابطه','relationship.score.changed',['IN_APP','PUSH'],{title:'تغییر ریسک رابطه',body:'امتیاز رابطهٔ «{relationship}» تغییر کرد: ریسک {riskScore}.'},{minRiskChange:5},true],
  ['new_opportunity_inapp','فرصت تجاری جدید','opportunity.created',['IN_APP'],{title:'فرصت جدید شناسایی شد',body:'فرصت «{name}» با ارزش {value} ثبت شد.'},null,true],
  ['opportunity_won_lost','تغییر وضعیت فرصت','opportunity.status.changed',['IN_APP','EMAIL'],{title:'وضعیت فرصت تغییر کرد',body:'فرصت «{name}» به وضعیت {status} رفت.'},null,true],
  ['new_recommendation','پیشنهاد هوشمند جدید','recommendation.created',['IN_APP','EMAIL'],{title:'پیشنهاد جدید آماده است',body:'پیشنهاد «{title}» با اطمینان {confidence}٪ ایجاد شد.'},null,true],
  ['integration_sync_failed_email','خطای همگام‌سازی','integration.sync.failed',['EMAIL'],{title:'همگام‌سازی ناموفق بود',body:'همگام‌سازی {provider} با خطا مواجه شد؛ بررسی کنید.'},null,true],
  ['meeting_completed_legacy','پیگیری پس از جلسه (قدیمی)','meeting.completed',['IN_APP'],{title:'جلسه برگزار شد',body:'جلسهٔ «{title}» برگزار شد.'},null,false],
];
function seedNotificationRules(){
  if(!Array.isArray(DB.notificationRules)||DB.notificationRules.length===0){
    DB.notificationRules=NR_SEED.map((x,i)=>({id:`nr-${i+1}`,key:x[0],name:x[1],eventType:x[2],channels:x[3],template:x[4],conditions:x[5]??null,active:x[6]!==false,organizationId:null,createdAt:`2026-04-0${(i%5)+1}T08:00:00.000Z`,updatedAt:`2026-04-0${(i%5)+1}T08:00:00.000Z`}));
  }
}
function nrView(r){ return {id:r.id,key:r.key,name:r.name,eventType:r.eventType,channels:Array.isArray(r.channels)?r.channels:[],conditions:r.conditions??null,template:r.template??null,active:r.active!==false,organizationId:r.organizationId??null,createdAt:r.createdAt??null,updatedAt:r.updatedAt??null}; }


/* ---------- demo audit seeding (only on a fresh DB) ---------- */
function seedAuditDemo(){
  if(!Array.isArray(DB.audit)||DB.audit.length>0) return;
  const ago=(d,h=0,m=0)=>{ const t=new Date(Date.now()-d*86400000); t.setHours(10-h,h?0:m,0,0); return t.toISOString(); };
  DB.audit=[
    {id:'au-seed-1',at:ago(3,2),actorEmail:'client@arya-tech.ir',action:'LOGIN_SUCCESS',entity:'User',entityId:'client@arya-tech.ir',outcome:'OK',ip:'10.0.4.12',meta:{}},
    {id:'au-seed-2',at:ago(3,1),actorEmail:'mina@demo.ir',action:'LOGIN_FAIL',entity:'User',entityId:'mina@demo.ir',outcome:'FAIL',ip:'185.12.4.9',meta:{reason:'bad_password'}},
    {id:'au-seed-3',at:ago(2,4),actorEmail:'demo@srip.local',action:'CREATE',entity:'Organization',entityId:'org-9',outcome:'OK',ip:'10.0.0.1',meta:{name:'توسعه فناوری پارس'}},
    {id:'au-seed-4',at:ago(2,2),actorEmail:'demo@srip.local',action:'UPDATE',entity:'Relationship',entityId:'r-4',outcome:'OK',ip:'10.0.0.1',meta:{reason:'Admin scoring re-run',riskScore:66}},
    {id:'au-seed-5',at:ago(1,5),actorEmail:'demo@srip.local',action:'PERMISSION_CHANGE',entity:'Membership',entityId:'mb-91',outcome:'OK',ip:'10.0.0.1',meta:{organizationId:'org-3',role:'SUBSIDIARY_EXECUTIVE',reason:'RBAC membership assigned/updated'}},
    {id:'au-seed-6',at:ago(1,3),actorEmail:'demo@srip.local',action:'DELETE',entity:'Tag',entityId:'tag-12',outcome:'OK',ip:'10.0.0.1',meta:{name:'قدیمی',removedAssignments:3,reason:'Admin tag deleted'}},
    {id:'au-seed-7',at:ago(1,1),actorEmail:'client@arya-tech.ir',action:'CREATE',entity:'Meeting',entityId:'m-42',outcome:'OK',ip:'10.0.4.12',meta:{title:'بازبینی فصلی'}},
    {id:'au-seed-8',at:ago(0,6),actorEmail:'demo@srip.local',action:'APPROVE',entity:'Recommendation',entityId:'rec-3',outcome:'OK',ip:'10.0.0.1',meta:{}},
    {id:'au-seed-9',at:ago(0,4),actorEmail:'demo@srip.local',action:'UPDATE',entity:'ScoringRule',entityId:'sr-2',outcome:'OK',ip:'10.0.0.1',meta:{key:'risk_score_formula',reason:'Admin scoring rule changed'}},
    {id:'au-seed-10',at:ago(0,2),actorEmail:'demo@srip.local',action:'EXPORT',entity:'Report',entityId:'relationship-health',outcome:'OK',ip:'10.0.0.1',meta:{format:'CSV',approval:'ap-1'}},
  ];
}


/* ---------- feature flags (enterprise FeatureFlag parity) ---------- */
function seedFeatureFlags(){
  if(!Array.isArray(DB.featureFlags)||DB.featureFlags.length===0){
    DB.featureFlags=[
      {id:'ff-1',key:'network_explorer',enabled:true,rollout:100,organizationId:null,description:'گراف تعاملی شبکه با وضعیت روی خط‌ها',createdAt:'2026-02-10T08:00:00.000Z'},
      {id:'ff-2',key:'ai_assistant',enabled:true,rollout:100,organizationId:null,description:'دستیار هوشمند و گزارش راهبردی',createdAt:'2026-02-11T08:00:00.000Z'},
      {id:'ff-3',key:'recommendation_engine',enabled:true,rollout:100,organizationId:null,description:'موتور پیشنهادهای هوشمند',createdAt:'2026-02-12T08:00:00.000Z'},
      {id:'ff-4',key:'experimental_search',enabled:false,rollout:10,organizationId:null,description:'جستجوی آزمایشی (نسخهٔ بعدی)',createdAt:'2026-03-05T08:00:00.000Z'},
    ];
  }
}
function ffView(f){ return {id:f.id,key:f.key,enabled:!!f.enabled,rollout:typeof f.rollout==='number'?f.rollout:100,organizationId:f.organizationId??null,description:f.description??null,createdAt:f.createdAt??null}; }


/* ---------- data export log (DataExportLog parity) ---------- */
const EXPORT_KIND_FA={};
const DATA_CLASSIFICATIONS=['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','PRIVATE','HIGHLY_CONFIDENTIAL'];
function seedExportLog(){
  if(!Array.isArray(DB.exportLog)||DB.exportLog.length===0){
    const ago=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(10-h,15,0,0);return t.toISOString();};
    DB.exportLog=[
      // DataExportLog parity (real: exportType=format, entityType=report kind, requestId=approval id)
      {id:'ex-1',userId:'u-1',organizationId:'org-1',exportType:'CSV',entityType:'relationship-health',recordCount:8,classification:'CONFIDENTIAL',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(5,1)},
      {id:'ex-2',userId:'u-2',organizationId:'org-2',exportType:'XLSX',entityType:'company',recordCount:4,classification:'INTERNAL',requestId:null,ipAddress:'10.0.4.12',createdAt:ago(4,3)},
      {id:'ex-3',userId:'u-1',organizationId:'org-1',exportType:'PDF',entityType:'network',recordCount:38,classification:'RESTRICTED',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(3,2)},
      {id:'ex-4',userId:'u-1',organizationId:'org-1',exportType:'CSV',entityType:'meeting',recordCount:22,classification:'INTERNAL',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(2,4)},
      {id:'ex-5',userId:'u-2',organizationId:'org-2',exportType:'CSV',entityType:'contact',recordCount:14,classification:'CONFIDENTIAL',requestId:null,ipAddress:'10.0.4.12',createdAt:ago(2,1)},
      {id:'ex-6',userId:'u-1',organizationId:'org-1',exportType:'XLSX',entityType:'risk',recordCount:5,classification:'HIGHLY_CONFIDENTIAL',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(1,2)},
    ];
  }
}
function exportView(x){ return {id:x.id,userId:x.userId,userName:userById(x.userId)?.name??x.userId,userEmail:userById(x.userId)?.email??null,organizationId:x.organizationId??null,organizationName:orgById(x.organizationId)?.name??null,exportType:x.exportType,entityType:x.entityType??null,recordCount:x.recordCount??0,classification:x.classification??'INTERNAL',requestId:x.requestId??null,ipAddress:x.ipAddress??null,createdAt:x.createdAt??null}; }


/* ---------- retention (DataProcessingPolicy + retention preview parity) ---------- */
const RETENTION_COLLECTIONS={Organization:'orgs',Project:'projects',Opportunity:'opportunities',Commitment:'commitments'};
const RETENTION_ENTITY_FA={Organization:'سازمان',Project:'پروژه',Opportunity:'فرصت',Commitment:'تعهد'};
function seedRetention(){
  if(!Array.isArray(DB.retentionPolicies)||DB.retentionPolicies.length===0){
    DB.retentionPolicies=[
      {id:'pol-1',entityType:'Organization',purpose:'شرکت‌های بدون تعامل فعال',legalBasis:'LEGITIMATE_INTEREST',classification:'INTERNAL',retentionDays:270,exportable:true,erasable:true,active:true,createdAt:'2026-01-05T08:00:00.000Z'},
      {id:'pol-2',entityType:'Project',purpose:'پروژه‌های بستهٔ قدیمی',legalBasis:'CONTRACT',classification:'CONFIDENTIAL',retentionDays:180,exportable:true,erasable:true,active:true,createdAt:'2026-01-05T08:00:00.000Z'},
      {id:'pol-3',entityType:'Opportunity',purpose:'فرصت‌های ازدست‌رفته',legalBasis:'LEGITIMATE_INTEREST',classification:'INTERNAL',retentionDays:400,exportable:true,erasable:false,active:true,createdAt:'2026-01-05T08:00:00.000Z'},
      {id:'pol-4',entityType:'Commitment',purpose:'تعهدات انجام‌شدهٔ قدیمی',legalBasis:'CONTRACT',classification:'CONFIDENTIAL',retentionDays:365,exportable:false,erasable:true,active:true,createdAt:'2026-01-05T08:00:00.000Z'},
      {id:'pol-5',entityType:'Interaction',purpose:'تعاملات مالی و قراردادی (الزام قانونی)',legalBasis:'LEGAL_OBLIGATION',classification:'CONFIDENTIAL',retentionDays:3650,exportable:false,erasable:false,active:true,createdAt:'2026-01-05T08:00:00.000Z'},
    ];
  }
  if(!Array.isArray(DB.retentionPurged)) DB.retentionPurged=[];
}
function retentionPreviewRows(){
  const now=Date.now();
  return (DB.retentionPolicies??[]).filter(p=>p.active&&typeof p.retentionDays==='number').map(p=>{
    const cutoffMs=now-Number(p.retentionDays)*86400000;
    const cutoff=new Date(cutoffMs).toISOString();
    const rows=(DB[RETENTION_COLLECTIONS[p.entityType]]??[]).filter(r=>{
      const c=r.createdAt;
      if(!c) return false;
      if(new Date(c).getTime()>=cutoffMs) return false;
      return !(DB.retentionPurged??[]).some(g=>g.entityType===p.entityType&&g.id===r.id);
    });
    return {entityType:p.entityType,entityName:RETENTION_ENTITY_FA[p.entityType]??p.entityType,purpose:p.purpose,retentionDays:p.retentionDays,cutoff,erasable:!!p.erasable,exportable:!!p.exportable,count:rows.length};
  });
}


/* ---------- master data (catalog parity) ---------- */
const MASTER_FREE=['industry','country'];
const MASTER_LOCKED_FA={orgType:'نوع سازمان',relType:'نوع رابطه'};
function seedMasterData(){
  if(!Array.isArray(DB.industryCatalog)||DB.industryCatalog.length===0){
    const used=[...new Set((DB.orgs??[]).map(o=>o.industry).filter(Boolean))];
    const extra=['مخابرات','بیمه','داروسازی','خودروسازی','خدمات مالی'];
    DB.industryCatalog=[...used,...extra.filter(x=>!used.includes(x))];
  }
  if(!Array.isArray(DB.countryCatalog)||DB.countryCatalog.length===0){
    const used=[...new Set((DB.orgs??[]).map(o=>o.country).filter(Boolean))];
    const extra=['امارات','آلمان','ترکیه','چین','قطر','عمان','فرانسه'];
    DB.countryCatalog=[...used,...extra.filter(x=>!used.includes(x))];
  }
}
function masterCatalog(cat){
  if(cat==='industry') return DB.industryCatalog;
  if(cat==='country') return DB.countryCatalog;
  return null;
}
function masterUsage(cat,value){
  if(cat==='industry') return (DB.orgs??[]).filter(o=>o.industry===value).length;
  if(cat==='country') return (DB.orgs??[]).filter(o=>o.country===value).length;
  if(cat==='orgType') return (DB.orgs??[]).filter(o=>o.type===value).length;
  if(cat==='relType') return (DB.rels??[]).filter(r=>r.relationshipType===value).length;
  return 0;
}
function masterView(){
  const categories=[
    {key:'industry',label:'صنعت',locked:false,editable:true},
    {key:'country',label:'کشور',locked:false,editable:true},
    {key:'orgType',label:'نوع سازمان',locked:true,editable:false},
    {key:'relType',label:'نوع رابطه',locked:true,editable:false},
  ];
  const out={categories};
  out.industry=(DB.industryCatalog??[]).map(v=>({value:v,usage:masterUsage('industry',v)}));
  out.country=(DB.countryCatalog??[]).map(v=>({value:v,usage:masterUsage('country',v)}));
  out.orgType=['HOLDING','SUBSIDIARY','CUSTOMER','PARTNER','BANK','GOVERNMENT','INVESTOR','SUPPLIER','OTHER'].map(v=>({value:v,usage:masterUsage('orgType',v)}));
  out.relType=[...new Set((DB.rels??[]).map(r=>r.relationshipType).filter(Boolean))].map(v=>({value:v,usage:masterUsage('relType',v)}));
  return out;
}


/* ---------- integrations (IntegrationConnection/SyncRun parity) ---------- */
const INT_PROVIDERS=['GOOGLE','MICROSOFT'];
const INT_KINDS=['CALENDAR','EMAIL','DRIVE','TEAMS','SHAREPOINT'];
function seedIntegrations(){
  if(!Array.isArray(DB.integrations)||DB.integrations.length===0){
    const ago=(h)=>{const t=new Date(Date.now()-h*3600000);return t.toISOString();};
    const ahead=(d)=>{const t=new Date(Date.now()+d*86400000);return t.toISOString();};
    DB.integrations=[
      {id:'int-1',userId:'u-1',organizationId:'org-1',provider:'GOOGLE',kind:'CALENDAR',status:'CONNECTED',accountLabel:'تقویم کاری محمدرضا',scopes:'calendar.readonly calendar.events',expiresAt:ahead(62),lastSyncAt:ago(22),lastError:null,createdAt:ago(24*40),deletedAt:null},
      {id:'int-2',userId:'u-1',organizationId:'org-1',provider:'GOOGLE',kind:'EMAIL',status:'ERROR',accountLabel:'ایمیل سازمانی',scopes:'gmail.readonly',expiresAt:ago(3),lastSyncAt:ago(50),lastError:'تمدید توکن ناموفق — نیاز به ورود مجدد',createdAt:ago(24*90),deletedAt:null},
      {id:'int-3',userId:'u-2',organizationId:'org-2',provider:'GOOGLE',kind:'DRIVE',status:'PENDING',accountLabel:'درایو مشترک پروژه',scopes:'drive.readonly',expiresAt:null,lastSyncAt:null,lastError:null,createdAt:ago(6),deletedAt:null},
      {id:'int-4',userId:'u-1',organizationId:'org-1',provider:'MICROSOFT',kind:'TEAMS',status:'CONNECTED',accountLabel:'تیم‌های راهبردی',scopes:'teams.read',expiresAt:ahead(35),lastSyncAt:ago(3),lastError:null,createdAt:ago(24*60),deletedAt:null},
      {id:'int-5',userId:'u-1',organizationId:'org-1',provider:'MICROSOFT',kind:'SHAREPOINT',status:'DISCONNECTED',accountLabel:'شیرپوینت اسناد',scopes:null,expiresAt:null,lastSyncAt:ago(24*120),lastError:null,createdAt:ago(24*200),deletedAt:ago(24*50)},
    ];
  }
  if(!Array.isArray(DB.integrationRuns)||DB.integrationRuns.length===0){
    const ago=(h)=>{const t=new Date(Date.now()-h*3600000);return t.toISOString();};
    const run=(i,o,status,seen,created,updated,cancelled,mp,mo)=>({id:`run-${i}`,connectionId:'int-1',kind:'CALENDAR',startedAt:o,completedAt:o,status,seen,created,updated,cancelled,matchedPeople:mp,matchedOrganizations:mo});
    DB.integrationRuns=[
      run(1,ago(22),'SUCCESS',8,2,5,1,1,1),run(2,ago(70),'SUCCESS',5,0,5,0,0,1),run(3,ago(140),'FAILED',0,0,0,0,0,0),
      {id:'run-4',connectionId:'int-4',kind:'TEAMS',startedAt:ago(3),completedAt:ago(3),status:'SUCCESS',seen:4,created:1,updated:3,cancelled:0,matchedPeople:2,matchedOrganizations:1},
      {id:'run-5',connectionId:'int-4',kind:'TEAMS',startedAt:ago(75),completedAt:ago(75),status:'SUCCESS',seen:2,created:0,updated:2,cancelled:0,matchedPeople:0,matchedOrganizations:1},
    ];
  }
}
function intView(x){ return {id:x.id,userId:x.userId,userName:userById(x.userId)?.name??null,userEmail:userById(x.userId)?.email??null,organizationId:x.organizationId??null,organizationName:orgById(x.organizationId)?.name??null,provider:x.provider,kind:x.kind,status:x.status,accountLabel:x.accountLabel??null,scopes:x.scopes??null,expiresAt:x.expiresAt??null,lastSyncAt:x.lastSyncAt??null,lastError:x.lastError??null,createdAt:x.createdAt??null,deletedAt:x.deletedAt??null}; }
function intRunView(r){ return {...r}; }


function seedReferralStore(){
  if(!Array.isArray(DB.referrals)||DB.referrals.length===0){
    DB.referrals=REFERRALS.map(r=>({...r}));
    saveDb();
  }
}
const REF_STATUS_FLOW={PENDING:['ACCEPTED','DECLINED','CANCELLED'],ACCEPTED:['COMPLETED','DECLINED','CANCELLED'],COMPLETED:[],DECLINED:[],CANCELLED:[]};

/* ---------- requirement matching engine (RequirementMatchingService parity) ---------- */
const REQ_STATUSES=['OPEN','IN_PROGRESS','SATISFIED','BLOCKED','CANCELLED'];
const REQ_PRIORITIES=['LOW','MEDIUM','HIGH','CRITICAL'];
function reqTokens(v){ return new Set(String(v??'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2)); }
function clampN(n){ return Math.max(0,Math.min(100,Math.round(n))); }
function reqOverlap(a,b){ const A=reqTokens(a),B=reqTokens(b); if(!A.size||!B.size) return 0; let hits=0; for(const t of A) if(B.has(t)) hits++; return clampN(2*hits/(A.size+B.size)*100); }
const REQ_TYPE_KEYWORDS={BANK:'bank banking financial finance',INVESTOR:'investor investment capital fund',GOVERNMENT:'government regulator regulatory authority ministry',PARTNER:'partner partnership strategic',SUPPLIER:'supplier vendor supply',CUSTOMER:'customer client',HOLDING:'holding group',SUBSIDIARY:'subsidiary company'};
function reqEdgeStrength(e){
  const base=(e.healthScore??50)*0.30+(e.resilienceScore??50)*0.25+(e.opportunityScore??50)*0.20+(e.strategicScore??50)*0.15+(100-(e.riskScore??30))*0.10;
  const bonus=e.status==='ACTIVE'?5:e.status==='WATCH'||e.status==='AT_RISK'?-10:0;
  return clampN(base+bonus);
}
function connectorPersonOf(orgId){
  const p=(DB.people??[]).find(x=>x.organizationId===orgId&&x.status!=='INACTIVE');
  return p?{id:p.id,firstName:p.firstName,lastName:p.lastName,title:p.title??null}:null;
}
function requirementMatch(requirementId){
  let hit=null;
  for(const prId of Object.keys(PROJECT_EXTRA)){ const item=(PROJECT_EXTRA[prId].requirements??[]).find(x=>x.id===requirementId); if(item){ hit={prId,item}; break; } }
  if(!hit) return {error:'نیازمندی یافت نشد.'};
  const project=PROJECTS.find(p=>p.id===hit.prId);
  const req=hit.item;
  const source=req.organizationId??project?.organizationId??null;
  const terms=Array.from(reqTokens(`${req.title} ${req.category??''} ${req.description??''}`)).slice(0,12);
  let orgs=(DB.orgs??[]).filter(o=>o.id!==source);
  if(source&&terms.length) orgs=orgs.filter(o=>terms.some(t=>`${o.name??''} ${o.industry??''}`.toLowerCase().includes(t)));
  const kwText=`${req.title} ${req.description??''} ${req.category??''}`;
  const targets=orgs.map(o=>({org:o,targetScore:source?reqOverlap(kwText,`${o.name} ${o.industry??''} ${o.type??''} ${REQ_TYPE_KEYWORDS[o.type]??''}`):0})).filter(x=>x.targetScore>0).sort((a,b)=>b.targetScore-a.targetScore).slice(0,50);
  const adj=new Map();
  for(const e of DB.rels??[]){
    if(!adj.has(e.sourceOrganizationId)) adj.set(e.sourceOrganizationId,[]);
    if(!adj.has(e.targetOrganizationId)) adj.set(e.targetOrganizationId,[]);
    adj.get(e.sourceOrganizationId).push({to:e.targetOrganizationId,edge:e});
    adj.get(e.targetOrganizationId).push({to:e.sourceOrganizationId,edge:e});
  }
  const matches=[],gaps=[];
  for(const cand of targets){
    const startAdj=adj.get(source)??[];
    let direct=null,twoHop=null;
    for(const nb of startAdj){ if(nb.to===cand.org.id){ direct=nb; break; } }
    if(!direct){ outer: for(const nb of startAdj){ for(const nb2 of adj.get(nb.to)??[]){ if(nb2.to===cand.org.id&&nb2.to!==source){ twoHop={first:nb,second:nb2}; break outer; } } } }
    const path=direct?{hopCount:1,relationshipIds:[direct.edge.id],organizationIds:[source,cand.org.id]}:(twoHop?{hopCount:2,relationshipIds:[twoHop.first.edge.id,twoHop.second.edge.id],organizationIds:[source,twoHop.first.to,cand.org.id],connectorOrganizationId:twoHop.first.to}:null);
    let pathStrength=0,healthAvg=0,trustAvg=0,engageAvg=0;
    if(path){
      const edges=path.hopCount===1?[direct.edge]:[twoHop.first.edge,twoHop.second.edge];
      pathStrength=clampN(edges.reduce((a,e)=>a+reqEdgeStrength(e),0)/edges.length);
      healthAvg=clampN(edges.reduce((a,e)=>a+(e.healthScore??50),0)/edges.length);
      trustAvg=clampN(edges.reduce((a,e)=>a+(e.resilienceScore??50),0)/edges.length);
      engageAvg=clampN(edges.reduce((a,e)=>a+(e.opportunityScore??50),0)/edges.length);
    }
    const fit=cand.targetScore;
    const proximityBonus=path?.hopCount===1?20:path?.hopCount===2?12:0;
    const successProbability=clampN(fit*0.30+pathStrength*0.35+healthAvg*0.12+trustAvg*0.12+engageAvg*0.06+proximityBonus);
    const connector=path?.hopCount===2?connectorPersonOf(path.connectorOrganizationId):path?.hopCount===1?connectorPersonOf(cand.org.id):null;
    const item={
      targetOrganization:{id:cand.org.id,name:cand.org.name,industry:cand.org.industry??null,type:cand.org.type},
      connectionType:path?.hopCount===1?'DIRECT':path?.hopCount===2?'INDIRECT':'GAP',
      scope:'EXTERNAL', targetFit:fit, pathStrength,
      successProbability:path?successProbability:0,
      path:path??null, connectorPerson:connector,
      evidence:{requirementKeywords:[...reqTokens(kwText)],targetOrganizationFit:fit,relationshipIds:path?.relationshipIds??[],pathOrganizationIds:path?.organizationIds??[],pathStrength,health:healthAvg,trust:trustAvg,engagement:engageAvg,internal:false},
      recommendation:path
        ? `مسیر ${path.hopCount===1?'مستقیم':'دوگامی'} به ${cand.org.name}${connector?` از طریق ${connector.firstName} ${connector.lastName} (${orgById(path.connectorOrganizationId)?.name??''})`:''} — با ${clampN(successProbability)}٪ احتمال موفقیت.`
        : `شکاف ارتباطی: ارتباط مستقیم یا ≤۲ گامی با ${cand.org.name} وجود ندارد.`,
    };
    if(path) matches.push(item); else gaps.push(item);
  }
  matches.sort((a,b)=>b.successProbability-a.successProbability||b.pathStrength-a.pathStrength);
  gaps.sort((a,b)=>b.targetFit-a.targetFit);
  const best=matches[0]??null;
  const recommendations=matches.slice(0,5).map((m,i)=>({rank:i+1,targetOrganizationId:m.targetOrganization.id,type:m.connectionType==='DIRECT'?'DIRECT_CONNECTION':'INTRODUCTION',title:`بهترین مسیر به ${m.targetOrganization.name}`,rationale:m.recommendation,successProbability:m.successProbability,connectorPerson:m.connectorPerson,path:m.path}));
  return {
    requirement:{id:req.id,title:req.title,description:req.description??null,category:req.category??null},
    sourceOrganizationId:source??null,
    sourceOrganizationName:source?orgById(source)?.name??null:null,
    projectName:project?.name??null,
    summary:{direct:matches.filter(x=>x.connectionType==='DIRECT').length,indirect:matches.filter(x=>x.connectionType==='INDIRECT').length,external:matches.length,internal:0,gaps:gaps.length},
    bestConnection:best,
    directConnections:matches.filter(x=>x.connectionType==='DIRECT').slice(0,20),
    indirectConnections:matches.filter(x=>x.connectionType==='INDIRECT').slice(0,20),
    gaps:gaps.slice(0,20),
    recommendations,
  };
}

/* ---------- approvals (ApprovalService parity) ---------- */
const APPROVAL_ACTIONS_MOCK={
  SENSITIVE_RELATIONSHIP_CREATE:'SENSITIVE_RELATIONSHIP_CREATE',STRATEGIC_SCORE_CHANGE:'STRATEGIC_SCORE_CHANGE',
  DATA_SHARING:'DATA_SHARING',DATA_IMPORT:'DATA_IMPORT',EXPORT:'EXPORT',DELETE:'DELETE',
};
const APPROVAL_FA={SENSITIVE_RELATIONSHIP_CREATE:'ایجاد رابطهٔ حساس',STRATEGIC_SCORE_CHANGE:'تغییر امتیاز راهبردی',DATA_SHARING:'اشتراک داده',DATA_IMPORT:'ورود داده',EXPORT:'خروجی داده',DELETE:'حذف دائمی داده'};
function seedApprovals(){
  if(!Array.isArray(DB.approvals)||DB.approvals.length===0){
    const ago=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(10-h,20,0,0);return t.toISOString();};
    DB.approvals=[
      {id:'ap-1',entityType:'Report',entityId:'relationship-health',actionType:'EXPORT',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'APPROVED',reason:'خروجی سلامت روابط برای هیئت مدیره',before:null,after:{classification:'CONFIDENTIAL',format:'CSV'},createdAt:ago(3,1),decidedAt:ago(3,0)},
      {id:'ap-2',entityType:'Report',entityId:'network',actionType:'EXPORT',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'APPROVED',reason:'خروجی شبکه برای جلسهٔ راهبردی',before:null,after:{classification:'RESTRICTED',format:'CSV'},createdAt:ago(3,4),decidedAt:ago(3,3)},
      {id:'ap-3',entityType:'Report',entityId:'risk',actionType:'EXPORT',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'APPROVED',reason:'گزارش ریسک برای کمیتهٔ ریسک',before:null,after:{classification:'HIGHLY_CONFIDENTIAL',format:'CSV'},createdAt:ago(2,3),decidedAt:ago(2,2)},
      {id:'ap-4',entityType:'Relationship',entityId:'r-1',actionType:'STRATEGIC_SCORE_CHANGE',organizationId:'org-2',requestedById:'u-2',decidedById:null,status:'PENDING',reason:'ارتقای امتیاز راهبردی پس از توافقنامهٔ مشارکت',before:{strategicScore:86},after:{strategicScore:92},createdAt:ago(1,2),decidedAt:null},
      {id:'ap-5',entityType:'Relationship',entityId:null,actionType:'SENSITIVE_RELATIONSHIP_CREATE',organizationId:'org-1',requestedById:'u-2',decidedById:null,status:'PENDING',reason:'ایجاد رابطه با استانداری برای پیگیری مجوزهای زیرساخت',before:null,after:{sourceOrganizationId:'org-5',targetOrganizationId:'org-8',relationshipType:'PARTNERSHIP',status:'PROSPECTIVE'},createdAt:ago(1,1),decidedAt:null},
      {id:'ap-6',entityType:'DataLifecycle',entityId:'org-8',actionType:'DELETE',organizationId:'org-1',requestedById:'u-2',decidedById:null,status:'PENDING',reason:'حذف دائمی سازمان دولتی بدون تعامل فعال',before:null,after:{entityType:'Organization'},createdAt:ago(0,5),decidedAt:null},
      {id:'ap-7',entityType:'Report',entityId:'network',actionType:'DATA_SHARING',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'REJECTED',reason:'اشتراک گراف شبکه با مشاور خارجی',before:null,after:{recipient:'مشاور خارجی'},createdAt:ago(5,2),decidedAt:ago(5,1),decidedReason:'نیاز به تأیید مالک داده و امضای NDA'},
    ];
  }
}
function approvalEntityLabel(a){
  const t=a.entityType;
  if(t==='Relationship'&&a.entityId){ const r=(DB.rels??[]).find(x=>x.id===a.entityId); if(r) return `${orgById(r.sourceOrganizationId)?.name??r.sourceOrganizationId} ↔ ${orgById(r.targetOrganizationId)?.name??r.targetOrganizationId}`; }
  if(t==='Person'){ const p=personById(a.entityId); return p?`${p.firstName} ${p.lastName}`:a.entityId; }
  if(t==='Organization'){ return orgById(a.entityId)?.name??a.entityId; }
  if(t==='DataLifecycle'){ const et=a.after?.entityType??null; if(et==='Organization') return orgById(a.entityId)?.name??a.entityId; if(et==='Person'){const p=personById(a.entityId); return p?`${p.firstName} ${p.lastName}`:a.entityId;} }
  return null;
}
function approvalView(a){
  const rb=userById(a.requestedById); const db_=userById(a.decidedById);
  return {...a,entityLabel:approvalEntityLabel(a),requestedByName:rb?.name??null,requestedByEmail:rb?.email??null,decidedByName:db_?.name??null,decidedByEmail:db_?.email??null,organizationName:orgById(a.organizationId)?.name??null,decidedReason:a.decidedReason??null};
}
/* ---------- security events (SecurityEvent parity) ---------- */
const SECURITY_SEV=['INFO','WARNING','HIGH','CRITICAL'];
const SECURITY_TYPES=['LOGIN_SUCCESS','LOGIN_FAILURE','ACCOUNT_LOCKED','PERMISSION_DENIED','RATE_LIMITED','SUSPICIOUS_ACCESS','EXPORT_CREATED','MFA_EVENT'];
function recordSecurity(req,type,severity,meta={},entityType=null,entityId=null,userId=null,organizationId=null){
  const u=currentUser(req);
  const row={id:`se-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type,severity,
    requestId:curReqId??null,ipAddress:req.socket?.remoteAddress??null,
    userAgent:String(req.headers['user-agent']??'').slice(0,200)||null,
    entityType,entityId,userId:userId??u?.id??null,organizationId,metadata:meta,createdAt:nowIso()};
  DB.securityEvents=DB.securityEvents??[];
  DB.securityEvents.unshift(row);
  if(DB.securityEvents.length>500) DB.securityEvents.length=500;
  saveDb();
  return row;
}
function securityEventView(x){
  const u=userById(x.userId);
  return {...x,userName:u?.name??null,userEmail:u?.email??null,organizationName:orgById(x.organizationId)?.name??null,userAgentShort:x.userAgent?(String(x.userAgent).length>70?String(x.userAgent).slice(0,70)+'…':x.userAgent):null};
}
function seedSecurityEvents(){
  if(!Array.isArray(DB.securityEvents)) DB.securityEvents=[];
  if(DB.securityEvents.length===0){
    const ago=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(10-h,25,0,0);return t.toISOString();};
    const ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    DB.securityEvents=[
      {id:'se-1',type:'LOGIN_FAILURE',severity:'WARNING',requestId:null,ipAddress:'185.12.4.9',userAgent:ua,entityType:'User',entityId:'client@arya-tech.ir',userId:'u-2',organizationId:null,metadata:{reason:'bad_password',attempts:3},createdAt:ago(2,3)},
      {id:'se-2',type:'LOGIN_SUCCESS',severity:'INFO',requestId:null,ipAddress:'10.0.4.12',userAgent:ua,entityType:'User',entityId:'client@arya-tech.ir',userId:'u-2',organizationId:null,metadata:{mfa:'TOTP'},createdAt:ago(2,1)},
      {id:'se-3',type:'SUSPICIOUS_ACCESS',severity:'CRITICAL',requestId:null,ipAddress:'203.0.113.44',userAgent:'Mozilla/5.0 (X11; Linux x86_64)',entityType:'User',entityId:'demo@srip.local',userId:null,organizationId:null,metadata:{reason:'new_device_geo_mismatch',country:'IR'},createdAt:ago(1,6)},
      {id:'se-4',type:'RATE_LIMITED',severity:'WARNING',requestId:null,ipAddress:'203.0.113.44',userAgent:null,entityType:'Auth',entityId:'/auth/login',userId:null,organizationId:null,metadata:{windowSeconds:60,limit:10},createdAt:ago(1,5)},
      {id:'se-5',type:'EXPORT_CREATED',severity:'INFO',requestId:null,ipAddress:'10.0.0.1',userAgent:ua,entityType:'Report',entityId:'relationship-health',userId:'u-1',organizationId:'org-1',metadata:{exportType:'CSV',recordCount:8,approvalId:null},createdAt:ago(1,3)},
      {id:'se-6',type:'PERMISSION_DENIED',severity:'WARNING',requestId:null,ipAddress:'10.0.4.12',userAgent:ua,entityType:'Route',entityId:'/enterprise/exports',userId:'u-2',organizationId:'org-2',metadata:{permission:'enterprise.read'},createdAt:ago(1,1)},
      {id:'se-7',type:'MFA_EVENT',severity:'INFO',requestId:null,ipAddress:'10.0.4.12',userAgent:ua,entityType:'User',entityId:'u-2',userId:'u-2',organizationId:null,metadata:{event:'ENROLLED',factor:'TOTP'},createdAt:ago(3,4)},
      {id:'se-8',type:'LOGIN_FAILURE',severity:'WARNING',requestId:null,ipAddress:'45.83.9.150',userAgent:null,entityType:'User',entityId:'mina@demo.ir',userId:null,organizationId:null,metadata:{reason:'no_user'},createdAt:ago(2,2)},
      {id:'se-9',type:'ACCOUNT_LOCKED',severity:'HIGH',requestId:null,ipAddress:'45.83.9.150',userAgent:null,entityType:'User',entityId:'mina@demo.ir',userId:null,organizationId:null,metadata:{reason:'repeated_failures',lockedMinutes:30},createdAt:ago(1,4)},
      {id:'se-10',type:'EXPORT_CREATED',severity:'INFO',requestId:null,ipAddress:'10.0.4.12',userAgent:ua,entityType:'Report',entityId:'company',userId:'u-2',organizationId:'org-2',metadata:{exportType:'XLSX',recordCount:4,approvalId:'ap-2'},createdAt:ago(0,2)},
    ];
  }
}
/* ---------- privacy & data lifecycle (PrivacyService + DataLifecycleController parity) ---------- */
const PRIVACY_TYPES=['ACCESS','EXPORT','ERASURE'];
const LIFECYCLE_STATES=['CREATION','ACTIVE','ARCHIVED','RETENTION','DELETION','RESTORED','PURGED'];
function seedPrivacyStore(){
  if(!Array.isArray(DB.consentRecords)) DB.consentRecords=[];
  if(!Array.isArray(DB.privacyRequests)) DB.privacyRequests=[];
  if(!Array.isArray(DB.lifecycleRecords)) DB.lifecycleRecords=[];
  if((DB.consentRecords??[]).length===0){
    const ago=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(10-h,0,0,0);return t.toISOString();};
    DB.consentRecords.push(
      {id:'cons-1',userId:'u-1',purpose:'marketing',version:'1.0',source:'USER',status:'GRANTED',grantedAt:ago(120,3),revokedAt:null,createdAt:ago(120,3)},
      {id:'cons-2',userId:'u-1',purpose:'analytics',version:'2.0',source:'USER',status:'GRANTED',grantedAt:ago(60,2),revokedAt:null,createdAt:ago(60,2)},
      {id:'cons-3',userId:'u-1',purpose:'third_party_sharing',version:'1.0',source:'USER',status:'REVOKED',grantedAt:ago(90,5),revokedAt:ago(15,4),createdAt:ago(90,5)},
    );
    const m={schemaVersion:'1.1',exportedAt:ago(2,3),requestId:'pr-seed-1',kind:'EXPORT',user:{id:'u-1',email:'demo@srip.local',name:'مدیر ارشد (مالک)',createdAt:'2026-01-15T08:00:00.000Z'},parts:[],data:collectUserData('u-1')};
    m.parts=Object.entries(m.data).filter(([,v])=>v.length).map(([entityType,rows])=>({entityType,count:rows.length}));
    DB.privacyManifests={ 'pr-seed-1': m };
    const total=m.parts.reduce((a,p)=>a+p.count,0);
    DB.privacyRequests.push(
      {id:'pr-seed-1',userId:'u-1',type:'EXPORT',reason:'خروجی دوره‌ای داده‌های من',status:'COMPLETED',result:{totalRecords:total,parts:m.parts.length},createdAt:ago(3,2),completedAt:ago(2,3)},
      {id:'pr-seed-2',userId:'u-1',type:'ACCESS',reason:'بررسی داده‌های ذخیره‌شدهٔ من',status:'PENDING',result:null,createdAt:ago(0,1),completedAt:null},
    );
  }
  if(DB.lifecycleRecords.length===0){
    const ago=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(10-h,40,0,0);return t.toISOString();};
    DB.lifecycleRecords=[
      {id:'lr-1',entityType:'Person',entityId:'p-9',state:'PURGED',actorId:'u-1',reason:'درخواست حذف دائمی پس از تأیید مالک',transitionedAt:ago(14,2)},
      {id:'lr-2',entityType:'Interaction',entityId:'i-8',state:'DELETION',actorId:'u-1',reason:'بایگانی تعامل توسط مالک',transitionedAt:ago(2,3)},
      {id:'lr-3',entityType:'Relationship',entityId:'r-6',state:'RESTORED',actorId:'u-1',reason:'بازگردانی رابطه از بایگانی',transitionedAt:ago(6,4)},
      {id:'lr-4',entityType:'Meeting',entityId:'m-5',state:'DELETION',actorId:'u-1',reason:'بایگانی جلسهٔ لغوشده',transitionedAt:ago(1,5)},
    ];
  }
}
function privacyRequestView(x){
  const rb=userById(x.userId);
  return {...x,requestedByName:rb?.name??null,requestedByEmail:rb?.email??null};
}
function consentView(c){ return {...c,userName:userById(c.userId)?.name??null}; }
function collectUserData(userId){
  const u=userById(userId);
  const membership=(u?.memberships??[]).map(m=>({id:m.id,organizationId:m.organizationId,organizationName:m.organizationName??orgById(m.organizationId)?.name??null,role:m.role,isPrimary:!!m.isPrimary}));
  const interactions=INTERACTIONS.filter(x=>!x.deletedAt&&x.userId===userId).map(x=>({id:x.id,type:x.type,subject:x.subject,summary:x.summary??null,outcome:x.outcome??null,importance:x.importance??'MEDIUM',occurredAt:x.occurredAt,organizationId:x.organizationId??null,relationshipId:x.relationshipId??null}));
  const notifications=(NOTIFICATIONS??[]).filter(n=>n.userId===userId).map(n=>({id:n.id,title:n.title??null,body:n.body??null,type:n.type??'INFO',isRead:!!n.isRead,createdAt:n.createdAt}));
  const consents=(DB.consentRecords??[]).filter(c=>c.userId===userId).map(c=>({id:c.id,purpose:c.purpose,version:c.version,status:c.status,source:c.source??'USER',grantedAt:c.grantedAt??null,revokedAt:c.revokedAt??null,createdAt:c.createdAt}));
  const privacyRequests=(DB.privacyRequests??[]).filter(x=>x.userId===userId).map(x=>({id:x.id,type:x.type,status:x.status,reason:x.reason??null,createdAt:x.createdAt,completedAt:x.completedAt??null}));
  const securityEvents=(DB.securityEvents??[]).filter(x=>x.userId===userId).map(x=>({id:x.id,type:x.type,severity:x.severity,createdAt:x.createdAt}));
  const audit=(DB.audit??[]).filter(a=>a.actorEmail===u?.email).map(a=>({id:a.id,action:a.action,entity:a.entity,entityId:a.entityId,outcome:a.outcome,at:a.at}));
  return {membership,interactions,notifications,consents,privacyRequests,securityEvents,audit};
}
function runPrivacyExport(req,requestId,kind){
  const row=(DB.privacyRequests??[]).find(x=>x.id===requestId);
  if(!row) return null;
  const data=collectUserData(row.userId);
  const user=userById(row.userId);
  const parts=Object.entries(data).filter(([,v])=>v.length).map(([entityType,rows])=>({entityType,count:rows.length}));
  const totalRecords=parts.reduce((a,p)=>a+p.count,0);
  const manifest={schemaVersion:'1.1',exportedAt:nowIso(),requestId,kind,user:{id:user?.id??null,email:user?.email??null,name:user?.name??null,createdAt:user?.createdAt??null},parts,data};
  DB.privacyManifests=DB.privacyManifests??{};
  DB.privacyManifests[requestId]=manifest;
  row.status='COMPLETED'; row.completedAt=nowIso(); row.result={totalRecords,parts:parts.length};
  DB.exportLog=DB.exportLog??[];
  DB.exportLog.unshift({id:`ex-${Date.now()}`,userId:row.userId,organizationId:null,exportType:kind==='ACCESS'?'GDPR_ACCESS_REQUEST':'GDPR_DATA_EXPORT',entityType:'USER_DATA',recordCount:totalRecords,classification:'CONFIDENTIAL',requestId,ipAddress:req.socket?.remoteAddress??null,createdAt:nowIso()});
  audit(req,row.type==='ACCESS'?'READ':'EXPORT','PrivacyData',row.userId,'OK',{meta:{request:requestId,kind,totalRecords,reason:'gdpr'}});
  saveDb();
  return {status:'COMPLETED',requestId,totalRecords,parts:parts.length};
}
/* ---------- enterprise governance (AuthorizationPolicy/FeatureFlag/DataExportLog parity) ---------- */
function seedEnterpriseStore(){
  if(!Array.isArray(DB.authorizationPolicies)||DB.authorizationPolicies.length===0){
    const ago=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(10-h,0,0,0);return t.toISOString();};
    DB.authorizationPolicies=[
      {id:'abac-1',key:'audit-log-view-confidential',permissionKey:'audit.read',effect:'ALLOW',role:null,organizationId:null,department:null,maxDataClassification:'CONFIDENTIAL',ownerOnly:false,subjectScope:'ALL',conditions:null,enabled:true,createdById:'u-1',createdAt:ago(120,2),updatedAt:ago(6,2)},
      {id:'abac-2',key:'deny-restricted-export',permissionKey:'report.export',effect:'DENY',role:null,organizationId:null,department:null,maxDataClassification:'RESTRICTED',ownerOnly:false,subjectScope:'ALL',conditions:null,enabled:true,createdById:'u-1',createdAt:ago(110,3),updatedAt:ago(5,3)},
      {id:'abac-3',key:'holding-exec-ai-brief',permissionKey:'ai.executive_brief',effect:'ALLOW',role:'HOLDING_EXECUTIVE',organizationId:'org-1',department:null,maxDataClassification:'CONFIDENTIAL',ownerOnly:false,subjectScope:'ORGANIZATION',conditions:null,enabled:true,createdById:'u-1',createdAt:ago(90,4),updatedAt:ago(4,4)},
      {id:'abac-4',key:'rel-mgr-interaction-write',permissionKey:'interaction.write',effect:'ALLOW',role:'RELATIONSHIP_MANAGER',organizationId:'org-2',department:null,maxDataClassification:'INTERNAL',ownerOnly:false,subjectScope:'ORGANIZATION',conditions:null,enabled:true,createdById:'u-1',createdAt:ago(60,5),updatedAt:ago(3,5)},
      {id:'abac-5',key:'sales-search-restricted-ips',permissionKey:'search.read',effect:'ALLOW',role:null,organizationId:null,department:'فروش',maxDataClassification:'CONFIDENTIAL',ownerOnly:false,subjectScope:'DEPARTMENT',conditions:{ipRange:'10.0.0.0/8'},enabled:true,createdById:'u-1',createdAt:ago(30,6),updatedAt:ago(2,6)},
      {id:'abac-6',key:'owner-only-access-manage',permissionKey:'access.manage',effect:'ALLOW',role:null,organizationId:null,department:null,maxDataClassification:'RESTRICTED',ownerOnly:true,subjectScope:'ALL',conditions:null,enabled:true,createdById:'u-1',createdAt:ago(20,7),updatedAt:ago(1,7)},
      {id:'abac-7',key:'legacy-privacy-import-rule',permissionKey:'privacy.read',effect:'ALLOW',role:'STANDARD_USER',organizationId:'org-2',department:null,maxDataClassification:'INTERNAL',ownerOnly:false,subjectScope:'ORGANIZATION',conditions:null,enabled:false,createdById:'u-1',createdAt:ago(200,8),updatedAt:ago(40,8)},
    ];
  }
}
function seedSettingsStore(){
  if(!Array.isArray(DB.mfaDevices)||DB.mfaDevices.length===0){
    DB.mfaDevices=[
      {id:'dev-1',userId:'u-1',label:'SRIP Web (دمو)',enabled:true,verifiedAt:'2026-06-01T08:00:00.000Z',secret:'MOCKMFAOWNER',createdAt:'2026-06-01T08:00:00.000Z',lastUsedAt:null,recoveryCodes:null},
    ];
  }
}
function mfaDevicesOf(userId){ return (DB.mfaDevices??[]).filter(d=>d.userId===userId); }
function mfaRequiredFor(userId){ return mfaDevicesOf(userId).some(d=>d.enabled&&d.verifiedAt); }
function mfaDeviceView(d){ return {id:d.id,label:d.label??'SRIP Web',enabled:!!d.enabled,verifiedAt:d.verifiedAt??null,lastUsedAt:d.lastUsedAt??null,createdAt:d.createdAt??null}; }
function genRecoveryCodes(n=10){
  const pool='ABCDEFGHJKMNPQRSTUVWXYZ23456789', codes=[];
  for(let i=0;i<n;i++){ let c=''; for(let j=0;j<12;j++) c+=pool[Math.floor(Math.random()*pool.length)]; codes.push(`srip-${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}`); }
  return codes;
}
function seedSessionsStore(){
  if(!Array.isArray(DB.sessions)||DB.sessions.length===0){
    const h=(n)=>{const t=new Date(Date.now()-n*3600000);return t.toISOString();};
    const d=(n)=>{const t=new Date(Date.now()+n*86400000);return t.toISOString();};
    DB.sessions=[
      {id:'s-1',userId:'u-1',tokenFamilyId:'fam-1',deviceName:'مرورگر Chrome — Windows 11',ipAddress:'10.0.0.1',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',createdAt:h(6*24),lastActivityAt:h(2),idleExpiresAt:d(0.25),absoluteExpiresAt:d(26),expiresAt:d(26),revokedAt:null,rotatedAt:null},
      {id:'s-2',userId:'u-1',tokenFamilyId:'fam-2',deviceName:'اپ‌لیکیشن SRIP — Android 14',ipAddress:'10.0.0.9',userAgent:'SRIP-App/1.4 (Android 14; SM-G996B)',createdAt:h(20*24),lastActivityAt:h(26),idleExpiresAt:h(0.2),absoluteExpiresAt:d(10),expiresAt:d(10),revokedAt:null,rotatedAt:null},
      {id:'s-3',userId:'u-1',tokenFamilyId:'fam-3',deviceName:'مرورگر Safari — macOS',ipAddress:'10.0.0.1',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',createdAt:h(30*24),lastActivityAt:h(30*24-2),idleExpiresAt:h(0),absoluteExpiresAt:h(0),expiresAt:h(0),revokedAt:h(12*24),rotatedAt:null},
      {id:'s-4',userId:'u-1',tokenFamilyId:'fam-4',deviceName:'مرورگر Firefox — Linux',ipAddress:'10.0.0.3',userAgent:'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',createdAt:h(40*24),lastActivityAt:h(40*24-3),idleExpiresAt:h(0),absoluteExpiresAt:h(0),expiresAt:h(0),revokedAt:h(6*24),rotatedAt:h(6*24),replacedBySessionId:'s-1'},
      {id:'s-5',userId:'u-2',tokenFamilyId:'fam-5',deviceName:'مرورگر Edge — Windows 11',ipAddress:'10.0.4.12',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',createdAt:h(3*24),lastActivityAt:h(5),idleExpiresAt:d(0.3),absoluteExpiresAt:d(27),expiresAt:d(27),revokedAt:null,rotatedAt:null},
    ];
  }
}
const currentSid=(req)=>{ const claims=verifyJwt(String(req.headers.authorization??'').replace(/^Bearer\s+/i,'')); return claims?.sid??null; };
function sessionView(x,sid){
  const u=userById(x.userId);
  return {id:x.id,deviceName:x.deviceName??null,ipAddress:x.ipAddress??null,userAgent:x.userAgent??null,createdAt:x.createdAt,lastActivityAt:x.lastActivityAt??null,idleExpiresAt:x.idleExpiresAt,absoluteExpiresAt:x.absoluteExpiresAt,expiresAt:x.expiresAt,revokedAt:x.revokedAt??null,rotatedAt:x.rotatedAt??null,isCurrent:!!sid&&x.id===sid,userName:u?.name??null,userEmail:u?.email??null};
}
function revokeSessionRows(ids,at){
  let n=0; for(const row of DB.sessions??[]){ if(ids.includes(row.id)&&!row.revokedAt){ row.revokedAt=at; row.rotatedAt=row.rotatedAt??null; n++; } }
  return n;
}
function authorizationPolicyView(x){
  return {...x,
    permissionName:permName(x.permissionKey),
    organizationName:orgById(x.organizationId)?.name??null,
    roleName:(DB?.roles??ROLE_CATALOG).find(r=>r.key===x.role)?.name??x.role??null,
    createdByName:userById(x.createdById)?.name??null,
    updatedAt:x.updatedAt??x.createdAt??null,
  };
}

/* ---------- workflows (Workflow/WorkflowExecution/WorkflowApproval parity) ---------- */
const WF_ACTION_TYPES=['CREATE_NOTIFICATION','CREATE_ACTION','CREATE_COMMITMENT','CREATE_OPPORTUNITY','REQUEST_APPROVAL','WAIT'];
/* ---------- product analytics store (AnalyticsService parity) ---------- */
function seedAnalyticsStore(){
  if(Array.isArray(DB.analyticsEvents)&&DB.analyticsEvents.length>0) return;
  const ev=[]; let n=0;
  const iso=(d,h)=>{const t=new Date(Date.now()-d*86400000);t.setHours(t.getHours()-(h%24),7+(n%50),0,0);return t.toISOString();};
  const orgCycle=ORGS.map(o=>o.id);
  const usersForOrg=(oid)=>{
    if(oid==='org-1') return ['u-1'];
    if(oid==='org-2') return ['u-2','u-3','u-4'];
    return ['u-3','u-4','u-5','u-6'];
  };
  const push=(userId,type,feature,organizationId,dAgo,hAgo,meta)=>{
    ev.push({id:`ae-${++n}`,userId,type,feature,organizationId:organizationId??null,metadata:meta??null,createdAt:iso(dAgo,hAgo)});
  };
  /* مصرف قابلیت‌ها: رویدادهای مشاهدهٔ هر قابلیت، پخش‌شده روی همهٔ سازمان‌ها */
  const VIEW_FEATURES=[['network_explorer',42],['smart_search',38],['meeting_briefs',27],['executive_brief',15],['recommendations',23]];
  let i=1;
  for(const [feat,total] of VIEW_FEATURES){
    for(let c=0;c<total;c++,i++){
      const org=orgCycle[i%orgCycle.length];
      const usrs=usersForOrg(org);
      push(usrs[i%usrs.length],'FEATURE_VIEWED',feat,org,((i*5)%28)+1,i*7,null);
    }
  }
  /* قیف پیشنهادها: هر پیشنهاد (frec-n) مرحله‌های پشت‌سرهم با نرخ‌های ثابت؛ شمارش واقعی از همین رویدادها */
  const FUNNEL=[['org-2',12,7,5,3,2],['org-3',8,5,4,2,1],['org-4',6,4,3,2,1],['org-5',5,3,2,2,1],['org-6',4,2,2,1,1],['org-7',2,2,2,1,0]];
  let f=0;
  for(const [org,C,ac,ca,cc,co] of FUNNEL){
    const usrs=usersForOrg(org);
    for(let x=1;x<=C;x++){
      f++;
      const rid=`frec-${f}`;
      const dAgo=((f*7)%27)+1;
      const u=usrs[f%usrs.length];
      push(u,'RECOMMENDATION_VIEWED','recommendation_funnel',org,dAgo,3,{recommendationId:rid});
      if(x<=ac) push(u,'RECOMMENDATION_ACCEPTED','recommendation_funnel',org,(dAgo+1)%28,5,{recommendationId:rid});
      if(x<=ca) push(u,'RECOMMENDATION_ACTION_CREATED','recommendation_funnel',org,(dAgo+2)%28,7,{recommendationId:rid});
      if(x<=cc) push(u,'RECOMMENDATION_ACTION_COMPLETED','recommendation_funnel',org,(dAgo+3)%28,9,{recommendationId:rid});
      if(x<=co) push(u,'RECOMMENDATION_OUTCOME','recommendation_funnel',org,(dAgo+4)%28,11,{recommendationId:rid});
    }
  }
  /* اتصال موفق و به‌روزرسانی رابطه: رویدادهای نتیجه با پخش سازمانی */
  const CONN_ORGS=[['org-2',6],['org-3',6],['org-4',5],['org-5',5],['org-6',5],['org-7',4]];
  let k=0;
  for(const [org,c] of CONN_ORGS){
    const usrs=usersForOrg(org);
    for(let x=0;x<c;x++,k++){
      push(usrs[k%usrs.length],'SUCCESSFUL_CONNECTION','connections',org,(k*11)%28,k,null);
    }
  }
  let m=0;
  const UPD_ORGS=[['org-2',16],['org-3',15],['org-4',15],['org-5',14],['org-6',14],['org-7',13]];
  for(const [org,c] of UPD_ORGS){
    const usrs=usersForOrg(org);
    for(let x=0;x<c;x++,m++){
      push(usrs[m%usrs.length],'RELATIONSHIP_UPDATED','relationship_lifecycle',org,(m*13)%28,m%24,null);
    }
  }
  DB.analyticsEvents=ev;
}

/* ---------- ops engine: health/metrics/observability (پاریتی MetricsService/HealthService) ---------- */
const MOCK_BOOT_AT = Date.now();
const OPS_BUCKETS = [5,10,25,50,100,250,500,1000,2500,5000,10000];
function synthHist(count, avgMs){
  const sum = Math.round(count * avgMs);
  const buckets = {};
  for(const b of OPS_BUCKETS){
    buckets[String(b)] = Math.min(count, Math.round(count * (1 - Math.exp(-b / Math.max(1, avgMs)))));
  }
  return { count, sum, buckets };
}
function healthStatusNow(){
  return { status:'ok', service:'srip-api', timestamp: new Date().toISOString(), dependencies:{
    database:{ status:'ok', latencyMs:6 }, redis:{ status:'ok', latencyMs:1 },
    queue:{ status:'ok' }, storage:{ status:'ok', configured:false, optional:true },
  }};
}
function metricsSnapshotNow(){
  const uptimeSeconds = Math.floor((Date.now() - MOCK_BOOT_AT) / 1000);
  const driftMin = Math.floor(uptimeSeconds / 60);
  const requests = 128450 + Math.floor(uptimeSeconds * 0.9);
  const errors = 1120 + Math.floor(uptimeSeconds * 0.012);
  const apiLatency = {};
  const API_OBS = [
    ['GET','/api/v1/auth/login',4120,46],['POST','/api/v1/auth/login',3982,54],['POST','/api/v1/auth/refresh',2940,38],
    ['GET','/api/v1/organizations',8640,28],['GET','/api/v1/people',12840,31],['GET','/api/v1/relationships',9620,34],
    ['GET','/api/v1/meetings',5110,41],['GET','/api/v1/actions',4430,33],['GET','/api/v1/commitments',3890,30],
    ['GET','/api/v1/projects',2270,36],['GET','/api/v1/opportunities',2860,38],['GET','/api/v1/network',1840,52],
    ['GET','/api/v1/search',5210,65],['GET','/api/v1/recommendations',1610,44],['GET','/api/v1/sessions',1240,22],
    ['POST','/api/v1/sessions',860,24],['POST','/api/v1/analytics/events',740,30],['GET','/api/v1/analytics/summary',2410,58],
    ['GET','/api/v1/analytics/network',1560,95],['GET','/api/v1/reports',830,140],['POST','/api/v1/workflows/executions',410,182],
    ['GET','/api/v1/security-events',720,40],['POST','/api/v1/ai/query',690,212],['POST','/api/v1/meetings/transcribe',120,900],
    ['POST','/api/v1/documents/upload',340,480],['POST','/api/v1/imports/run',38,1400],
  ];
  for(const [method, route, count, avg] of API_OBS) apiLatency[`${method} ${route}`] = synthHist(count, avg);
  const dbLatency = {};
  for(const [op, count, avg] of [['query',64200,8],['findMany',23800,14],['transaction',1860,42],['write',9120,11],['aggregate',3460,26],['raw',2040,31],['search',11800,9]]) dbLatency[op] = synthHist(count, avg);
  const queue = {
    'srip-default':{waiting:0,active:0,completed:240,failed:2,delayed:0,paused:0},
    'srip-notifications':{waiting:6,active:2,completed:18420,failed:9,delayed:4,paused:0},
    'srip-ai':{waiting:1,active:1,completed:2360,failed:1,delayed:0,paused:0},
    'srip-meetings':{waiting:2,active:0,completed:318,failed:0,delayed:2,paused:0},
    'srip-documents':{waiting:4,active:1,completed:912,failed:2,delayed:1,paused:0},
    'srip-recommendations':{waiting:8,active:1,completed:1540,failed:3,delayed:0,paused:0},
    'srip-search':{waiting:0,active:0,completed:4210,failed:0,delayed:0,paused:0},
    'srip-integrations':{waiting:3,active:1,completed:187,failed:2,delayed:0,paused:0},
    'srip-analytics':{waiting:1,active:0,completed:264,failed:0,delayed:0,paused:0},
    'srip-reminders':{waiting:12,active:1,completed:3102,failed:4,delayed:6,paused:0},
    'srip-maintenance':{waiting:0,active:0,completed:96,failed:1,delayed:0,paused:0},
    'srip-data-imports':{waiting:0,active:0,completed:74,failed:1,delayed:0,paused:0},
    'srip-privacy-exports':{waiting:0,active:0,completed:12,failed:0,delayed:0,paused:0},
    'srip-dead-letter':{waiting:3,active:0,completed:0,failed:11,delayed:0,paused:0},
  };
  const storage = {
    'documents:upload':{requests:341,errors:3,latency:synthHist(341,220),bytes:Math.round(28.4*1024**3)},
    'documents:download':{requests:912,errors:1,latency:synthHist(912,96),bytes:Math.round(612*1024**3)},
    'reports:export':{requests:187,errors:0,latency:synthHist(187,410),bytes:Math.round(96*1024**3)},
    'privacy:archive':{requests:64,errors:0,latency:synthHist(64,180),bytes:Math.round(1.2*1024**3)},
    'backups:snapshot':{requests:12,errors:0,latency:synthHist(12,2600),bytes:Math.round(52*1024**3)},
  };
  const ai = {
    'deterministic':{requests:2348,errors:6,latency:synthHist(2348,160),inputTokens:8420000,outputTokens:1260000,cost:0},
    'external':{requests:0,errors:0,latency:synthHist(0,0),inputTokens:0,outputTokens:0,cost:0},
  };
  const activeUsers = new Set((DB.analyticsEvents ?? []).map(e => e.userId)).size || 6;
  return {
    requests, errors,
    averageLatencyMs: Number((requests ? (requests * 36 + uptimeSeconds * 2) / requests : 0).toFixed(2)),
    uptimeSeconds,
    activeUsers,
    process: {
      rssBytes: 456_000_000 + (driftMin % 60) * 1_200_000,
      heapUsedBytes: 214_000_000 + (driftMin % 37) * 900_000,
      heapTotalBytes: 288_000_000,
      cpuPercent: Number((24 + ((uptimeSeconds / 5) % 140) / 10).toFixed(2)),
    },
    availabilityPercent: Number((99.93 - (driftMin % 90) * 0.002).toFixed(3)),
    apiLatency, dbLatency, queue, storage, ai,
  };
}
function opsEventsNow(){
  const base=Date.now();
  const at=(m)=>new Date(base-m*60000).toISOString();
  return [
    {id:'ev-1',level:'ERROR',message:'اتصال به Redis قطع شد؛ بازیابی خودکار پس از ۸۰۰ms انجام شد',source:'redis-client',createdAt:at(2)},
    {id:'ev-2',level:'WARN',message:'تأخیر بالای صف srip-notifications (۱۱ کار در انتظار > ۳۰s)',source:'queue-monitor',createdAt:at(9)},
    {id:'ev-3',level:'INFO',message:'اجرای زمان‌بندی‌شدهٔ بازپردازش تحلیل (analytics_recompute) با موفقیت پایان یافت',source:'scheduler',createdAt:at(14)},
    {id:'ev-4',level:'INFO',message:'اعتبارسنجی توکن تازهٔ فراهم‌کنندهٔ هوش مصنوعی (deterministic) انجام شد',source:'ai-gateway',createdAt:at(26)},
    {id:'ev-5',level:'WARN',message:'۲ تلاش ورود ناموفق برای کاربر client@arya-tech.ir',source:'auth',createdAt:at(41)},
    {id:'ev-6',level:'ERROR',message:'بازیابی ابردادهٔ سند sn-۴۲ از فضای ذخیره‌سازی ناموفق بود (بازیابی در تلاش بعدی)',source:'documents-store',createdAt:at(55)},
    {id:'ev-7',level:'INFO',message:'پشتیبان‌گیری شبانه کامل شد (۵۲ گیگابایت، ۱:۰۲)',source:'backup',createdAt:at(240)},
    {id:'ev-8',level:'INFO',message:'میانگین تأخیر سرویس در ۵ دقیقهٔ اخیر: ۳۴ms (p95: ۹۸ms)',source:'metrics',createdAt:at(260)},
    {id:'ev-9',level:'DEBUG',message:'مسیر جستجو: رتبه‌بندی مجدد نتیجهٔ جستجوی «خط اعتباری» (۸ نتیجه در ۴۱ms)',source:'search',createdAt:at(280)},
    {id:'ev-10',level:'INFO',message:'پاک‌سازی دورهای حافظهٔ پنهان انجام شد (۱۲۴ کلید)',source:'cache',createdAt:at(300)},
  ];
}
function prometheusTextNow(s){
  const lines = [];
  lines.push('# HELP srip_http_requests_total Total HTTP requests','# TYPE srip_http_requests_total counter',`srip_http_requests_total ${s.requests}`,
    '# HELP srip_http_errors_total Total HTTP 5xx responses','# TYPE srip_http_errors_total counter',`srip_http_errors_total ${s.errors}`,
    '# HELP srip_http_average_latency_ms Average HTTP latency','# TYPE srip_http_average_latency_ms gauge',`srip_http_average_latency_ms ${s.averageLatencyMs}`,
    '# HELP srip_process_uptime_seconds Process uptime','# TYPE srip_process_uptime_seconds gauge',`srip_process_uptime_seconds ${s.uptimeSeconds}`,
    '# HELP srip_active_users_30d Unique users observed in the last 30 days','# TYPE srip_active_users_30d gauge',`srip_active_users_30d ${s.activeUsers}`,
    '# HELP srip_availability_percent Observed availability percentage','# TYPE srip_availability_percent gauge',`srip_availability_percent ${s.availabilityPercent}`,
    '# HELP srip_process_resident_memory_bytes Resident process memory','# TYPE srip_process_resident_memory_bytes gauge',`srip_process_resident_memory_bytes ${s.process.rssBytes}`,
    '# HELP srip_process_heap_used_bytes Process heap used','# TYPE srip_process_heap_used_bytes gauge',`srip_process_heap_used_bytes ${s.process.heapUsedBytes}`,
    '# HELP srip_process_cpu_percent Process CPU percentage','# TYPE srip_process_cpu_percent gauge',`srip_process_cpu_percent ${s.process.cpuPercent}`);
  for(const [route,h] of Object.entries(s.apiLatency)){
    for(const b of OPS_BUCKETS) lines.push(`srip_api_latency_ms_bucket{route="${route}",le="${b}"} ${h.buckets[String(b)]}`);
    lines.push(`srip_api_latency_ms_bucket{route="${route}",le="+Inf"} ${h.count}`,`srip_api_latency_ms_sum{route="${route}"} ${h.sum}`,`srip_api_latency_ms_count{route="${route}"} ${h.count}`);
  }
  for(const [op,h] of Object.entries(s.dbLatency)){
    for(const b of OPS_BUCKETS) lines.push(`srip_db_latency_ms_bucket{operation="${op}",le="${b}"} ${h.buckets[String(b)]}`);
    lines.push(`srip_db_latency_ms_bucket{operation="${op}",le="+Inf"} ${h.count}`,`srip_db_latency_ms_sum{operation="${op}"} ${h.sum}`,`srip_db_latency_ms_count{operation="${op}"} ${h.count}`);
  }
  for(const [q,counts] of Object.entries(s.queue)) for(const [state,n] of Object.entries(counts)) lines.push(`srip_queue_jobs{queue="${q}",state="${state}"} ${n}`);
  for(const [op,v] of Object.entries(s.storage)) lines.push(`srip_storage_requests_total{operation="${op}"} ${v.requests}`,`srip_storage_errors_total{operation="${op}"} ${v.errors}`,`srip_storage_bytes_total{operation="${op}"} ${v.bytes}`);
  for(const [provider,v] of Object.entries(s.ai)) lines.push(`srip_ai_requests_total{provider="${provider}"} ${v.requests}`,`srip_ai_errors_total{provider="${provider}"} ${v.errors}`,`srip_ai_input_tokens_total{provider="${provider}"} ${v.inputTokens}`,`srip_ai_output_tokens_total{provider="${provider}"} ${v.outputTokens}`,`srip_ai_cost_total{provider="${provider}"} ${v.cost}`);
  return lines.join('\n') + '\n';
}

/* ---------- quality engine (DataQualityService + DuplicateDetectionService parity) ---------- */
const DQ_EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DQ_MAX_IDS=500;
/* پروفایل تکمیلی سازمان‌ها: فقط برای محاسبات کیفیت (در دادهٔ اصلیِ دمو موجود نیست) */
const DQ_ORG_PROFILE={
  'org-1':{website:'arya-holding.ir',email:'info@arya-holding.ir',phone:'+982188880000',registrationId:'101-1400-01',ownerId:'p-6'},
  'org-2':{website:'arya-tech.ir',email:'info@arya-tech.ir',phone:'+982188001122',registrationId:'101-1400-02',ownerId:'p-1'},
  'org-3':{website:'bankpars.ir',email:'info@bankpars.ir',phone:'+982182005050',registrationId:'111-1300-12',ownerId:null},
  'org-4':{website:'petro-sanat.com',email:'sales.petro-sanat',phone:'+982133445566',registrationId:'140-1399-08',ownerId:'p-1'},
  'org-5':{website:'sadena.ir',email:'info@sadena.ir',phone:'+982144556677',registrationId:'120-1401-15',ownerId:'p-8'},
  'org-6':{website:null,email:'info@alborz-parts.ir',phone:'+982166778899',registrationId:'155-1398-04',ownerId:'p-5'},
  'org-7':{website:'omsd.ir',email:null,phone:'+982122334455',registrationId:'105-1402-09',ownerId:'p-8'},
  'org-8':{website:'tehran.ir',email:null,phone:'+982188778899',registrationId:null,ownerId:null},
};
/* زمان بازبینی بعدی هر رابطه (فقط برای سنجش کیفیت) */
const DQ_REL_NEXT={ 'r-1':'2026-09-30T08:00:00.000Z','r-2':'2026-08-28T08:00:00.000Z','r-3':'2026-10-15T08:00:00.000Z','r-4':'2026-09-10T08:00:00.000Z','r-5':null };
const DQ_REL_CADENCE={ 'r-1':90,'r-2':60,'r-3':120,'r-4':60,'r-5':90 };
function dqNorm(v){ return String(v??'').trim().toLowerCase(); }
function dqDomain(v){ return dqNorm(v).replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0]; }
function dqPhone(v){ return String(v??'').replace(/[^0-9+]/g,'').replace(/^00/,'+'); }
function dqCap(values,total){ return { values:values.slice(0,DQ_MAX_IDS), truncated:(total??values.length)>DQ_MAX_IDS, total:total??values.length }; }
function computeQualityMetrics(req, oid){
  const u=currentUser(req);
  const isOwner=u?.isOwner??false;
  const scope=visibleOrgIds(req);
  let sel=null;
  if(oid){ sel=[oid]; }
  else if(!isOwner){ sel=scope; }
  const inSel=(org)=>sel==null||sel.includes(org);
  const orgs=ORGS.filter(o=>!o.deletedAt&&inSel(o.id));
  const people=PEOPLE.filter(p=>!p.deletedAt&&inSel(p.organizationId));
  const relById=(id)=>RELS.find(r=>r.id===id);
  const relInSel=(r)=>r&&!r.deletedAt&&(inSel(r.sourceOrganizationId)||inSel(r.targetOrganizationId));
  const rels=RELS.filter(r=>relInSel(r));
  const meetings=MEETINGS.filter(m=>!m.deletedAt&&(inSel(m.organizationId)||(m.relationshipId&&relInSel(relById(m.relationshipId)))));
  const actions=ACTIONS.filter(a=>!a.deletedAt&&((a.organizationId&&inSel(a.organizationId))||(a.relationshipId&&relInSel(relById(a.relationshipId)))||(!a.organizationId&&!a.relationshipId)));
  const interactions=INTERACTIONS.filter(x=>!x.deletedAt&&(inSel(x.organizationId)||(x.relationshipId&&relInSel(relById(x.relationshipId)))));
  const profile=(oid2)=>DQ_ORG_PROFILE[oid2]??{};
  const EMAIL_OK=(v)=>!v||DQ_EMAIL_RE.test(String(v));
  /* duplicate organizations: نام/دامنه/شماره/شناسهٔ ثبت یکسان (پاریتی duplicateOrganizations) */
  const dup=new Map();
  const dupPush=(field,reason)=>{
    const seen=new Map();
    for(const o of orgs){
      let v=null;
      if(field==='name') v=dqNorm(o.name);
      if(field==='registrationId') v=dqNorm(profile(o.id).registrationId);
      if(field==='phone') v=dqPhone(profile(o.id).phone);
      if(field==='website') v=dqDomain(profile(o.id).website);
      if(!v) continue;
      if(!seen.has(v)) seen.set(v,[]);
      seen.get(v).push(o.id);
    }
    for(const ids of seen.values()){
      if(ids.length<2) continue;
      const key=ids.slice().sort().join('|');
      const cur=dup.get(key)??{ids:ids.slice().sort(),reasons:[]};
      if(!cur.reasons.includes(reason)) cur.reasons.push(reason);
      dup.set(key,cur);
      if(dup.size>=DQ_MAX_IDS) return;
    }
  };
  dupPush('name','name'); dupPush('registrationId','registration_id'); dupPush('phone','phone'); dupPush('website','domain');
  const duplicateOrganizations=[...dup.values()].slice(0,DQ_MAX_IDS);
  /* missing owners */
  const missingOwnerOrgs=orgs.filter(o=>!profile(o.id).ownerId);
  /* missing contacts */
  const peopleOf=new Set();
  for(const p of people) peopleOf.add(p.organizationId);
  const orgNoContact=orgs.filter(o=>!peopleOf.has(o.id));
  const peopleNoContact=people.filter(p=>!p.email);
  /* stale relationships (lastInteractionAt null یا بازبینی عقب‌افتاده) */
  const stale=rels.filter(r=>!r.lastInteractionAt||(DQ_REL_NEXT[r.id]!=null&&new Date(DQ_REL_NEXT[r.id]).getTime()<Date.now()));
  /* invalid emails */
  const invalidEmails=[];
  for(const o of orgs){ const em=profile(o.id).email; if(em&&!EMAIL_OK(em)) invalidEmails.push({entityType:'Organization',id:o.id,field:'email'}); }
  for(const p of people){ if(p.email&&!EMAIL_OK(p.email)) invalidEmails.push({entityType:'Person',id:p.id,field:'email'}); }
  /* missing dates */
  const relNoDate=rels.filter(r=>DQ_REL_NEXT[r.id]==null);
  const meetNoDate=meetings.filter(m=>!m.startAt);
  const actNoDate=actions.filter(a=>!a.dueAt);
  /* incomplete profiles */
  const orgIncomplete=orgs.filter(o=>{const pr=profile(o.id);return !o.name||!o.country||!pr.website||!pr.phone||!pr.email;});
  const peopleIncomplete=people.filter(p=>!p.firstName||!p.lastName||!p.title||!p.email||!p.phone);
  const nowI=new Date().toISOString();
  const metrics={
    generatedAt:nowI,
    checks:['Duplicate Organizations','Missing Owners','Missing Contacts','Stale Relationships','Invalid Emails','Missing Organizations','Missing Dates','Incomplete Profiles'],
    duplicateOrganizations,
    missingOwners:Object.assign({values:missingOwnerOrgs.map(o=>o.id)},dqCap(missingOwnerOrgs.map(o=>o.id),missingOwnerOrgs.length)),
    missingContacts:{ organizations:Object.assign({values:orgNoContact.map(o=>o.id)},dqCap(orgNoContact.map(o=>o.id),orgNoContact.length)), people:Object.assign({values:peopleNoContact.map(p=>p.id)},dqCap(peopleNoContact.map(p=>p.id),peopleNoContact.length)) },
    staleRelationships:Object.assign({values:stale.map(r=>({id:r.id,lastInteractionAt:r.lastInteractionAt??null,nextReviewAt:DQ_REL_NEXT[r.id]??null,reviewCadenceDays:DQ_REL_CADENCE[r.id]??60}))},dqCap(stale.map(r=>r.id),stale.length)),
    invalidEmails:Object.assign({values:invalidEmails},dqCap(invalidEmails,invalidEmails.length)),
    missingOrganizations:{ people:Object.assign({values:[]},{total:0,truncated:false}), contacts:Object.assign({values:[]},{total:0,truncated:false}) },
    missingDates:{ relationships:Object.assign({values:relNoDate.map(r=>r.id)},dqCap(relNoDate.map(r=>r.id),relNoDate.length)), meetings:Object.assign({values:meetNoDate.map(m=>m.id)},dqCap(meetNoDate.map(m=>m.id),meetNoDate.length)), actions:Object.assign({values:actNoDate.map(a=>a.id)},dqCap(actNoDate.map(a=>a.id),actNoDate.length)), interactions:Object.assign({values:[]},{total:0,truncated:false}) },
    incompleteProfiles:{ organizations:Object.assign({values:orgIncomplete.map(o=>o.id)},dqCap(orgIncomplete.map(o=>o.id),orgIncomplete.length)), people:Object.assign({values:peopleIncomplete.map(p=>p.id)},dqCap(peopleIncomplete.map(p=>p.id),peopleIncomplete.length)) },
    coverage:{organizations:orgs.length,people:people.length,relationships:rels.length,interactions:interactions.length,meetings:meetings.length,actions:actions.length},
    bounded:true,
    maxReturnedIds:DQ_MAX_IDS,
  };
  return metrics;
}
function runQualitySnapshot(req,oid){
  const metrics=computeQualityMetrics(req,oid);
  const u=currentUser(req);
  const snap={id:`dqs-${Date.now()}`,organizationId:oid??null,createdById:u?.id??'system',scannedAt:new Date().toISOString(),metrics};
  const store=DB.dataQualitySnapshots=DB.dataQualitySnapshots??[];
  store.push(snap);
  if(store.length>50) store.splice(0,store.length-50);
  audit(req,'CREATE','DataQualitySnapshot',snap.id,'OK',{organizationId:oid??null,checks:8});
  saveDb();
  return snap;
}
function dqSim(a,b){
  if(!a||!b) return 0;
  if(a===b) return 1;
  const la=a.length,lb=b.length;
  const d=Array.from({length:la+1},(_,i)=>[i,...Array(lb).fill(0)]);
  for(let j=0;j<=lb;j++) d[0][j]=j;
  for(let i=1;i<=la;i++) for(let j=1;j<=lb;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return 1-d[la][lb]/Math.max(la,lb);
}
function dqDetectCandidates(entityType,data,oid,orgScope){
  const lower=(v)=>String(v??'').trim().toLowerCase();
  const nm=dqNorm(entityType==='ORGANIZATION'?data?.name:(data?.displayName||`${String(data?.firstName??'')} ${String(data?.lastName??'')}`));
  const em=lower(data?.email), ph=dqPhone(data?.phone), rg=lower(data?.registrationId), dm=dqDomain(data?.website);
  const ct=lower(data?.country);
  const prefix=nm.slice(0,4);
  const scopeSet=orgScope==null?null:new Set(orgScope);
  if(entityType==='ORGANIZATION'){
    const rows=ORGS.filter(o=>!o.deletedAt&&(scopeSet==null||scopeSet.has(o.id)));
    const out=[];
    for(const x of rows){
      const pr=DQ_ORG_PROFILE[x.id]??{};
      const reasons=[]; let score=0;
      const ns=dqSim(nm,dqNorm(x.name));
      const domainMatch=!!dm&&dqDomain(pr.website)===dm;
      const registrationMatch=!!rg&&lower(pr.registrationId)===rg;
      const phoneMatch=!!ph&&dqPhone(pr.phone)===ph;
      const countryMatch=!!ct&&lower(x.country)===ct;
      if(ns>=0.72){ score+=ns*0.40; reasons.push(`name_similarity:${ns.toFixed(3)}`); }
      if(domainMatch){ score+=0.25; reasons.push('domain'); }
      if(registrationMatch){ score+=0.25; reasons.push('registration_id'); }
      if(phoneMatch){ score+=0.20; reasons.push('phone'); }
      if(countryMatch){ score+=0.05; reasons.push('country'); }
      if(reasons.length&&score>=0.40) out.push({id:x.id,score:Math.min(1,Number(score.toFixed(3))),reasons,entityType:'ORGANIZATION'});
    }
    return out.sort((a,b)=>b.score-a.score).slice(0,10);
  }
  const rows=PEOPLE.filter(p=>!p.deletedAt&&p.organizationId===oid);
  const out=[];
  for(const x of rows){
    const reasons=[]; let score=0;
    const ns=dqSim(nm,dqNorm(`${x.firstName??''} ${x.lastName??''}`));
    const emailMatch=!!em&&lower(x.email)===em;
    const phoneMatch=!!ph&&dqPhone(x.phone)===ph;
    if(ns>=0.72){ score+=ns*0.35; reasons.push(`name_similarity:${ns.toFixed(3)}`); }
    if(emailMatch){ score+=0.35; reasons.push('email'); }
    if(phoneMatch){ score+=0.20; reasons.push('phone'); }
    if(reasons.length&&score>=0.40) out.push({id:x.id,score:Math.min(1,Number(score.toFixed(3))),reasons,entityType:'PERSON'});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,10);
}

function seedWorkflowStore(){
  if(!Array.isArray(DB.workflows)) DB.workflows=[];
  if(!Array.isArray(DB.workflowExecutions)) DB.workflowExecutions=[];
  if(!Array.isArray(DB.workflowApprovals)) DB.workflowApprovals=[];
  if(DB.workflows.length===0){
    const t=(d,h)=>{const x=new Date(Date.now()-d*86400000);x.setHours(10-h,15,0,0);return x.toISOString();};
    DB.workflows=[
      {id:'wf-1',name:'پیگیری هفتگی روابط کلیدی',entityType:'Relationship',organizationId:null,isActive:true,
       definition:{trigger:{type:'MANUAL'},conditions:[],actions:[
         {type:'CREATE_ACTION',title:'ثبت پیگیری هفتگی رابطه',priority:'MEDIUM',status:'OPEN'},
         {type:'CREATE_NOTIFICATION',title:'پیگیری رابطه ثبت شد',body:'گردش کار «پیگیری هفتگی» برای این رابطه اقدام ساخت و این اعلان را صادر کرد.',channel:'IN_APP',priority:'LOW'},
       ]},createdAt:t(9,1),updatedAt:t(9,1)},
      {id:'wf-2',name:'اعلان و تعهد پس از به‌روزرسانی رابطه',entityType:'Relationship',organizationId:null,isActive:true,
       definition:{trigger:{type:'RELATIONSHIP_UPDATED'},conditions:[],actions:[
         {type:'CREATE_NOTIFICATION',title:'رابطه به‌روزرسانی شد',body:'محرک رویداد رابطه فعال شد و تعهد بازبینی زیر ثبت گردید.',channel:'IN_APP',priority:'MEDIUM'},
         {type:'CREATE_COMMITMENT',description:'بازبینی برنامهٔ تعاملات و اقدام بعدی این رابطه',status:'OPEN',risk:'MEDIUM'},
       ]},createdAt:t(6,3),updatedAt:t(6,3)},
      {id:'wf-3',name:'تأیید دوم‌نفره و انتظار برای فرصت تازه',entityType:'Opportunity',organizationId:null,isActive:true,
       definition:{trigger:{type:'MANUAL'},conditions:[],actions:[
         {type:'REQUEST_APPROVAL',payload:{title:'اجرای گردش کار ادامه یابد؟',note:'تأیید برای ادامهٔ خودکار مراحل بعدی (انتظار و اعلان پایانی) لازم است.'}},
         {type:'WAIT',minutes:1},
         {type:'CREATE_NOTIFICATION',title:'گردش کار فرصت کامل شد',body:'پس از تأیید و پایان مهلت انتظار، گردش کار «تأیید دوم‌نفره» به پایان رسید.',channel:'IN_APP',priority:'LOW'},
       ]},createdAt:t(3,5),updatedAt:t(3,5)},
    ];
  }
}
function approvalFlowSafe(deciderId,a,decision,isOwner){
  if(!isOwner) return 'فقط مالک سامانه می‌تواند درخواست‌ها را تصمیم بگیرد.';
  if(a.status!=='PENDING') return 'این درخواست از قبل تصمیم‌گیری شده است.';
  // Demo note: in the real API a requester can never approve their own request
  // ('Requester cannot approve their own request') and any decider with
  // approval.decide decides. This demo has a single decider (the owner), so the
  // owner may also decide on requests they requested themselves; non-owners are
  // already blocked above.
  return null;
}
function recomputeUserAccess(u){
  if(u.isOwner){ u.permissions=['*']; return; }
  const perms=new Set(), orgIds=new Set();
  for(const m of u.memberships??[]){
    const meta=roleMeta(m.role);
    const ps=meta?.permissions??meta?.perms??[];
    for(const p of ps){ if(p!=='*') perms.add(p); }
    if(meta?.holding||m.accessScope==='ALL') orgSubtreeIds(m.organizationId).forEach(id=>orgIds.add(id));
    else orgIds.add(m.organizationId);
  }
  u.permissions=[...perms]; u.accessibleOrganizationIds=[...orgIds];
}
function adminUserView(u){
  return {id:u.id,email:u.email,name:u.name,isActive:u.isActive!==false,emailVerifiedAt:u.emailVerifiedAt??null,lastLoginAt:u.lastLoginAt??null,createdAt:u.createdAt??'2026-08-01T08:00:00.000Z',
    memberships:(u.memberships??[]).map(m=>({id:m.id,organizationId:m.organizationId,role:m.role,department:m.department??null,dataScope:m.dataScope??'INTERNAL',accessScope:m.accessScope??'ORGANIZATION',isPrimary:!!m.isPrimary}))};
}

/* --------------------------- deterministic AI --------------------------- */
/* موتور قطعیِ دستیار: همهٔ پاسخ‌ها از دادهٔ در محدودهٔ کاربر (scoped) و با
   شواهد عینی ساخته می‌شوند؛ هیچ پاسخِ ساختگی/ثابت داده نمی‌شود. */
const AI_TYPE_FA={BANK:'بانک',PARTNER:'شریک',SUPPLIER:'تأمین‌کننده',CUSTOMER:'مشتری',INVESTOR:'سرمایه‌گذار',GOVERNMENT:'دولت',HOLDING:'هلدینگ',SUBSIDIARY:'شرکت تابعه',OTHER:'سایر'};
const M_FA={OPEN:'باز',OVERDUE:'عقب‌افتاده',IN_PROGRESS:'در حال انجام',BLOCKED:'مسدود',DONE:'انجام‌شده',COMPLETED:'تکمیل‌شده',CANCELLED:'لغوشده',FULFILLED:'انجام‌شده',LOW:'کم',MEDIUM:'متوسط',HIGH:'زیاد',CRITICAL:'بحرانی',ACTIVE:'فعال',IDENTIFIED:'شناسایی‌شده',WON:'موفق',LOST:'از دست رفته',WATCH:'تحت نظر',PENDING:'در انتظار',ACCEPTED:'پذیرفته‌شده',PLANNED:'برنامه‌ریزی‌شده',CALL:'تماس',VISIT:'بازدید',MEETING:'جلسه',EMAIL:'ایمیل',BANKING:'بانکی',STRATEGIC_PARTNERSHIP:'مشارکت راهبردی',PARTNERSHIP:'مشارکت',CUSTOMER:'مشتری',SUPPLIER:'تأمین‌کننده',GOVERNMENT:'دولتی',INVESTOR:'سرمایه‌گذار',HOLDING:'هلدینگ',SUBSIDIARY:'شرکت تابعه',OURS:'ما',THEIRS:'طرف مقابل'};
const mfa=(v)=>M_FA[v]??'';
const personFull=(p)=>p?`${p.firstName} ${p.lastName??''}`.trim():null;
const relLabel=(r)=>r?`${orgById(r.sourceOrganizationId)?.name??'—'} ↔ ${orgById(r.targetOrganizationId)?.name??'—'}`:null;
const NOW_MS=()=>Date.now();
const isLateAt=(d,now)=>!!d&&new Date(d).getTime()<now;
const dayDiff=(d,now)=>d?Math.floor((new Date(d).getTime()-now)/86400000):null;

/* سازمان‌های قابل‌دسترس: در scope یا یکی از دو سرِ رابطهٔ در محدوده */
function reachableOrgs(req){
  const map=new Map(scopedOrgs(req).map(o=>[o.id,o]));
  for(const r of scopedRels(req)){
    const a=orgById(r.sourceOrganizationId),b=orgById(r.targetOrganizationId);
    if(a)map.set(a.id,a); if(b)map.set(b.id,b);
  }
  return [...map.values()];
}
const orgHaystack=(o)=>`${o.name} ${o.industry??''} ${AI_TYPE_FA[o.type]??''} ${o.country??''}`.toLowerCase();
const normTxt=(x)=>String(x??'').toLowerCase().replace(/\u200c/g,'');
const Q_STOP=new Set(['نوع','سازمان','سازمانی','سازمانهای','کلیدی','اخیر','نمایندگان','نماینده','بریف','آماده','آمادهسازی','تهیه','خلاصه','متن','انجام','نشان','آتی','کارها','چه','چیست','چطور','چگونه','کدام','هست','هستند','است','بود','باشد','دارد','ندارد','دارم','داری','داریم','دارن','میخواهم','میخواهیم','میخواهد','لطفا','لطفاً','برای','را','که','با','به','از','در','و','تا','من','ما','شما','آن','این','یک','دو','کن','کنید','بده','بدهید','ده','شد','شود','نمایش','بگو','بگید','توضیح','راهنمایی','وضعیت','وضعیتش','شرح','جستجو','مورد','همه','خود','ام','ات','آیا','باید','می','هم','نیز','نیست','بوده','میشه','میشود','کردن','کرد','کنم','کنیم','خواهد','خواهند','گزارش','خروجی','لیست','فهرست','بنویس','بساز','ساخت','بده','برام','هفته','ماه','سال','امروز','فردا','دیروز','آینده','پیش','بعد','جاری','آخرین','مربوط','مختلف','هیچ','جديد']);
function qTokens(ql){
  const raw=normTxt(ql).replace(/[،,؛;:؟؟!().\-«»"'ـ]/g,' ').split(/\s+/).filter(w=>w.length>=2);
  const alts=[];
  for(const t0 of raw){
    let t=t0;
    if(t.endsWith('ی')&&t.length>3)t=t.slice(0,-1);
    if(t.endsWith('های')&&t.length>4)t=t.slice(0,-3);
    if(t.endsWith('ها')&&t.length>4)t=t.slice(0,-2);
    if(t.endsWith('ات')&&t.length>4)t=t.slice(0,-2);
    if(t.endsWith('ان')&&t.length>6)t=t.slice(0,-2);
    if(Q_STOP.has(t0)||Q_STOP.has(t)||t.length<2) continue;
    const al=[t0];
    if(t!==t0) al.push(t);
    alts.push([...new Set(al)]);
  }
  return alts;
}
const matchQ=(hay,ql)=>{if(!ql)return true;const h=normTxt(hay);const toks=qTokens(ql);return toks.length>0&&toks.every(al=>al.some(w=>h.includes(w)));};
const faDate=(d)=>d?new Date(d).toLocaleDateString('fa-IR',{dateStyle:'long'}):null;
const faDateTime=(d)=>d?new Date(d).toLocaleString('fa-IR',{dateStyle:'long',timeStyle:'short'}):null;

/* جستجوی عمومی روی همهٔ نهادها با relevance — فقط محدودهٔ مجاز */
function smartPool(req,ql){
  const now=Date.now();
  const orgs=reachableOrgs(req).filter(o=>!ql||matchQ(`سازمان ${orgHaystack(o)}`,ql)).slice(0,8)
    .map(o=>({id:o.id,name:o.name,type:o.type,industry:o.industry,country:o.country}));
  const people=scopedPeople(req).filter(p=>!ql||matchQ(`شخص ${p.firstName} ${p.lastName??''} ${p.title??''} ${p.department??''} ${p.email??''} ${orgById(p.organizationId)?.name??''}`,ql)).slice(0,8)
    .map(p=>({id:p.id,firstName:p.firstName,lastName:p.lastName,title:p.title,organizationId:p.organizationId,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null}));
  const meetings=scopedMeetings(req).filter(m=>{
    if(!ql)return true;
    const org=orgById(m.organizationId);
    const rel=m.relationshipId?RELS.find(r=>r.id===m.relationshipId):null;
    return matchQ(`جلسه ${m.title} ${m.objective??''} ${m.agenda??''} ${m.outcome??''} ${org?.name??''} ${rel?relLabel(rel)+' '+rel.relationshipType+' '+mfa(rel.relationshipType):''}`,ql);
  }).sort((a,b)=>new Date(b.startAt)-new Date(a.startAt)).slice(0,8)
    .map(m=>({id:m.id,title:m.title,objective:m.objective,outcome:m.outcome,startAt:m.startAt,organizationId:m.organizationId,organization:orgById(m.organizationId)?{id:m.organizationId,name:orgById(m.organizationId).name}:null}));
  const interactions=scopedInteractions(req).filter(x=>{
    if(!ql)return true;
    const org=orgById(x.organizationId);
    const rel=x.relationshipId?RELS.find(r=>r.id===x.relationshipId):null;
    return matchQ(`تعامل ${x.subject} ${x.summary??''} ${x.outcome??''} ${x.type??''} ${mfa(x.type)} ${org?.name??''} ${rel?relLabel(rel)+' '+rel.relationshipType+' '+mfa(rel.relationshipType):''}`,ql);
  }).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)).slice(0,8)
    .map(x=>({id:x.id,subject:x.subject,summary:x.summary,outcome:x.outcome,occurredAt:x.occurredAt,organizationId:x.organizationId,organization:orgById(x.organizationId)?{id:x.organizationId,name:orgById(x.organizationId).name}:null}));
  const relationships=scopedRels(req).filter(r=>!ql||matchQ(`رابطه ${relLabel(r)} ${r.relationshipType} ${mfa(r.relationshipType)} ${r.status??''} ${mfa(r.status)} ${AI_TYPE_FA[orgById(r.sourceOrganizationId)?.type]??''} ${AI_TYPE_FA[orgById(r.targetOrganizationId)?.type]??''}`,ql)).slice(0,8)
    .map(r=>({id:r.id,name:relLabel(r),relationshipType:r.relationshipType,healthScore:r.healthScore,riskScore:r.riskScore,strategicScore:r.strategicScore,status:r.status}));
  const actions=scopedActions(req).filter(a=>!ql||matchQ(`اقدام ${a.title} ${a.status} ${mfa(a.status)} ${a.priority??''} ${mfa(a.priority)} ${['OPEN','IN_PROGRESS'].includes(a.status)&&a.dueAt&&new Date(a.dueAt).getTime()<now?'عقب‌افتاده':''} ${(a.relationshipId&&RELS.find(r=>r.id===a.relationshipId)?relLabel(RELS.find(r=>r.id===a.relationshipId)):'')}`,ql))
    .sort((a,b)=>(b.dueAt??'9999').localeCompare(a.dueAt??'9999')).slice(0,8)
    .map(a=>({id:a.id,title:a.title,status:a.status,priority:a.priority,dueAt:a.dueAt,relationshipId:a.relationshipId,relationship:a.relationshipId&&RELS.find(r=>r.id===a.relationshipId)?{id:a.relationshipId,name:relLabel(RELS.find(r=>r.id===a.relationshipId))}:null}));
  const commitments=scopedCommitments(req).filter(c=>!ql||matchQ(`تعهد ${c.description} ${c.status} ${mfa(c.status)} ${c.risk??''} ${mfa(c.risk)} ${['OPEN','OVERDUE'].includes(c.status)&&c.dueAt&&new Date(c.dueAt).getTime()<now?'عقب‌افتاده':''} ${c.notes??''} ${orgById(c.organizationId)?.name??''}`,ql))
    .sort((a,b)=>(a.dueAt??'9999').localeCompare(b.dueAt??'9999')).slice(0,8)
    .map(c=>({id:c.id,description:c.description,status:c.status,dueAt:c.dueAt,direction:c.direction,organizationId:c.organizationId,organization:orgById(c.organizationId)?{id:c.organizationId,name:orgById(c.organizationId).name}:null}));
  const projects=scopedProjects(req).filter(p=>!ql||matchQ(`پروژه ${p.name} ${p.objective??''} ${p.description??''} ${p.status??''} ${mfa(p.status)} ${orgById(p.organizationId)?.name??''}`,ql)).slice(0,6)
    .map(p=>({id:p.id,name:p.name,status:p.status,organizationId:p.organizationId,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null}));
  const opportunities=scopedOpps(req).filter(o=>!ql||matchQ(`فرصت ${o.name} ${o.description??''} ${o.status??''} ${mfa(o.status)} ${orgById(o.organizationId)?.name??''}`,ql)).slice(0,8)
    .map(o=>({id:o.id,name:o.name,status:o.status,probability:o.probability,value:o.value,expectedDate:o.expectedDate,organizationId:o.organizationId,organization:orgById(o.organizationId)?{id:o.organizationId,name:orgById(o.organizationId).name}:null}));
  return {organizations:orgs,people,meetings,interactions,relationships,actions,commitments,projects,opportunities,documentChunks:[]};
}

function aiQuery(req,intent,qRaw){
  const q=String(qRaw??'').trim();
  const ql=q.toLowerCase();
  const now=NOW_MS();
  const sentences=q.split(/[.!?؟!]+/).map(s=>s.trim()).filter(Boolean);
  const sentencesFa=sentences.filter(s=>/[\u0600-\u06FF]/.test(s));
  const src=sentencesFa.length?sentencesFa:sentences;
  const pool=smartPool(req,ql);
  let result,evidence={organizations:pool.organizations,meetings:pool.meetings,interactions:pool.interactions,documentChunks:[]};
  const safety={permissionAwareRetrieval:true,humanConfirmationRequired:false};

  switch(intent){
    case 'MEETING_BRIEF': {
      const upcoming=scopedMeetings(req).filter(m=>new Date(m.startAt).getTime()>=now-3600000).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
      const poolM=pool.meetings;
      const toks=qTokens(ql);
      const mScore=(m)=>{
        if(!ql) return 1;
        const rel=m.relationshipId?RELS.find(r=>r.id===m.relationshipId):null;
        const org=orgById(m.organizationId);
        const hay=normTxt(`جلسه ${m.title} ${m.objective??''} ${m.agenda??''} ${m.outcome??''} ${org?.name??''} ${rel?relLabel(rel)+' '+rel.relationshipType+' '+mfa(rel.relationshipType):''}`);
        return toks.reduce((n,al)=>n+(al.some(w=>hay.includes(w))?1:0),0);
      };
      let chosen=poolM.length?poolM[0]:null;
      if(!chosen){
        if(!toks.length&&upcoming.length) chosen=upcoming[0];
        else if(toks.length){
          const top=upcoming.map(m=>({m,s:mScore(m)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||(new Date(a.m.startAt)-new Date(b.m.startAt)))[0];
          chosen=top?top.m:null;
        }
      }
      if(!chosen){
        result={type:'meeting_brief',text:'جلسه‌ای مطابق پرس‌وجوی شما در محدودهٔ مجاز پیدا نشد.',meeting:null,actions:[],commitments:[]};
        break;
      }
      const m=MEETINGS.find(x=>x.id===chosen.id)??chosen;
      const rel=m.relationshipId?RELS.find(r=>r.id===m.relationshipId):null;
      const org=orgById(m.organizationId);
      const ppl=(m.participants??[]).map(p=>personById(p.personId)).filter(Boolean)
        .map(p=>`${personFull(p)}${p.title?` (${p.title})`:''}${orgById(p.organizationId)?` از ${orgById(p.organizationId).name}`:''}`);
      const relActs=scopedActions(req).filter(a=>a.relationshipId&&a.relationshipId===(rel?.id??m.relationshipId)&&!['DONE','COMPLETED','CANCELLED'].includes(a.status));
      const relComs=scopedCommitments(req).filter(c=>c.relationshipId===(rel?.id??m.relationshipId)&&['OPEN','OVERDUE'].includes(c.status));
      const briefText=[
        `آمادگی برای «${m.title}»`,
        `زمان: ${new Date(m.startAt).toLocaleString('fa-IR',{dateStyle:'long',timeStyle:'short'})}`,
        m.objective?`هدف: ${m.objective}`:null,
        org?`سازمان: ${org.name}${rel?` (${relLabel(rel)})`:''}`:null,
        ppl.length?`شرکت‌کنندگان: ${ppl.join('، ')}`:'شرکت‌کننده‌ای ثبت نشده است',
        (relActs.length||relComs.length)?`مهم: ${relActs.length} اقدام باز و ${relComs.length} تعهد باز مرتبط با همین رابطه را پیش از جلسه بررسی کنید.`:`پیشنهاد: دستور کار (${(m.agenda??'ثبت‌نشده').split('\n').filter(Boolean).length} بند) را مرور و مصوبات پیشین را همراه داشته باشید.`,
      ].filter(Boolean).join('\n');
      result={type:'meeting_brief',text:briefText,
        meeting:{id:m.id,title:m.title,objective:m.objective,startAt:m.startAt,organizationId:m.organizationId,organization:org?{id:org.id,name:org.name}:null,relationshipId:m.relationshipId},
        participants:ppl,actions:relActs.map(a=>({id:a.id,title:a.title,status:a.status,dueAt:a.dueAt})),commitments:relComs.map(c=>({id:c.id,description:c.description,status:c.status,dueAt:c.dueAt}))};
      evidence={organizations:org?[{id:org.id,name:org.name,type:org.type}]:[],meetings:[{id:m.id,title:m.title,startAt:m.startAt,organizationId:m.organizationId}],interactions:[],documentChunks:[]};
      break;
    }
    case 'MEETING_SUMMARY': {
      const decisions=sentences.filter(s=>/(تصمیم|توافق شد|توافق کردیم|قرار شد|مقرر شد|مصوب شد|تصویب شد|تصمیم گرفته)/.test(s));
      const actionSents=sentences.filter(s=>!(/(تصمیم|توافق شد|توافق کردیم|قرار شد|مقرر شد|مصوب شد|تصویب شد)/.test(s))&&/(باید|لازم است|نیاز است|می‌بایست|پیگیری|ارسال|تحویل|بررسی|هماهنگی|هماهنگ کنیم|آماده کنیم|زمان‌بندی|استعلام|ثبت|امضا|تمدید|ارائه)/.test(s));
      const lines=[];
      if(sentences.length) lines.push(`متن ورودی ${sentences.length} جمله داشت.`);
      if(decisions.length) lines.push(`${decisions.length} تصمیم کلیدی ثبت شد: ${decisions.map(s=>s.length>90?s.slice(0,90)+'…':s).join('؛ ')}`);
      if(actionSents.length) lines.push(`${actionSents.length} اقدام برای پیگیری: ${actionSents.map(s=>s.length>90?s.slice(0,90)+'…':s).join('؛ ')}`);
      if(!sentences.length) lines.push('متن ورودی خالی است؛ برای خلاصه‌سازی متنی بنویسید.');
      if(!decisions.length&&!actionSents.length&&sentences.length) lines.push(`در متن، تصمیم یا اقدام صریحی یافت نشد؛ بازنویسی: ${sentences[0].length>140?sentences[0].slice(0,140)+'…':sentences[0]}`);
      result={type:'meeting_summary',decisions,actionItems:actionSents,text:lines.join('\n')};
      safety.humanConfirmationRequired=true;
      break;
    }
    case 'ACTION_EXTRACTION': {
      const clean=s=>s.replace(/^(لطفاً|لطفا|ما باید|باید|می‌بایست|بایستی|خواهشاً|خواهشا)\s*/,'').replace(/^و\s*/,'').trim();
      const cands=src.filter(s=>/(ارسال|تحویل|پیگیری|هماهنگ|آماده|بررسی|ثبت|امضا|تمدید|ارائه|زمان‌بندی|استعلام|تسویه|پرداخت)/.test(s)||/^(لطفاً|لطفا|ما باید|باید|می‌بایست)/.test(s)).map(clean).filter(Boolean).slice(0,8);
      result={type:'action_extraction',candidates:cands,requires_confirmation:true};
      safety.humanConfirmationRequired=true;
      break;
    }
    case 'COMMITMENT_EXTRACTION': {
      const cands=src.filter(s=>/(متعهد|قول|تعهد|موعد|تا پایان|تا جمعه|تا هفته)/.test(s)).slice(0,8);
      result={type:'commitment_extraction',candidates:cands,requires_confirmation:true};
      safety.humanConfirmationRequired=true;
      break;
    }
    case 'RISK_DETECTION': {
      const signals=src.filter(s=>/(ریسک|تاخیر|تأخیر|مشکل|مسدود|لغو|نگران|انحراف|خطر|نامطمئن|نقص|کمبود|عدم|دیر شد|به تعویق|تحریم|نقدینگی)/.test(s)).slice(0,8);
      result={type:'risk_detection',signals,requires_confirmation:true,summary:signals.length?`${signals.length} سیگنال ریسک در متن شناسایی شد.`:'سیگنال ریسک مشخصی در متن پیدا نشد.'};
      safety.humanConfirmationRequired=true;
      break;
    }
    case 'OPPORTUNITY_DETECTION': {
      const signals=src.filter(s=>/(فرصت|توسعه|تمدید|همکاری|بازار جدید|ارتقا|سرمایه|علاقه‌مند|قرارداد جدید|پیشنهاد)/.test(s)).slice(0,8);
      result={type:'opportunity_detection',signals,requires_confirmation:true,summary:signals.length?`${signals.length} سیگنال فرصت در متن شناسایی شد.`:'سیگنال فرصت مشخصی در متن پیدا نشد.'};
      safety.humanConfirmationRequired=true;
      break;
    }
    case 'NEXT_BEST_ACTION': {
      const suggestions=[];
      const isOppQ=/فرصت|پیگیری فروش|قرارداد جدید|توسعه/.test(q);
      const evOf=(o)=>Math.round((o.expectedValue??Math.round((o.value??0)*(o.probability??0)/100))/1e9*10)/10;
      if(isOppQ){
        const openOpps=scopedOpps(req).filter(o=>!['WON','LOST'].includes(o.status))
          .sort((a,b)=>(evOf(b)-evOf(a)));
        for(const o of openOpps.slice(0,3)){
          const rel=o.relationshipId?RELS.find(r=>r.id===o.relationshipId):null;
          suggestions.push({kind:'opportunity',refId:o.id,text:`قدم بعدی برای فرصت «${o.name}» را برنامه‌ریزی کنید`,reason:`احتمال ${o.probability??0}٪ و ارزش موزون ${evOf(o)} میلیارد تومان${rel?'؛ رابطهٔ '+relLabel(rel):''}`});
        }
        if(!suggestions.length) suggestions.push({kind:'info',refId:null,text:'فرصت بازِ در جریانی در محدودهٔ شما نیست.',reason:'پس از ثبت فرصت جدید، پیشنهاد قدم بعدی ساخته می‌شود.'});
      } else {
        const lateActs=scopedActions(req).filter(a=>['OPEN','IN_PROGRESS'].includes(a.status)&&isLateAt(a.dueAt,now))
          .sort((a,b)=>(a.dueAt??'').localeCompare(b.dueAt??''));
        for(const a of lateActs.slice(0,3)){
          const rel=a.relationshipId?RELS.find(r=>r.id===a.relationshipId):null;
          suggestions.push({kind:'action',refId:a.id,text:`اقدام «${a.title}» را پیگیری کنید`,reason:`موعد ${a.dueAt?faDate(a.dueAt):'—'} گذشته است${rel?'؛ رابطهٔ '+relLabel(rel):''}`});
        }
        const lateComs=scopedCommitments(req).filter(c=>['OPEN','OVERDUE'].includes(c.status)&&isLateAt(c.dueAt,now));
        for(const c of lateComs.slice(0,2)){
          suggestions.push({kind:'commitment',refId:c.id,text:`تعهد «${c.description.length>60?c.description.slice(0,60)+'…':c.description}» را پیگیری کنید`,reason:`سررسید ${c.dueAt?faDate(c.dueAt):'—'} گذشته است`});
        }
        const watch=scopedRels(req).filter(r=>r.status==='WATCH'||(r.riskScore??0)>=60);
        for(const r of watch.slice(0,3)){
          const hasOpen=scopedActions(req).some(a=>a.relationshipId===r.id&&['OPEN','IN_PROGRESS','BLOCKED'].includes(a.status))||scopedCommitments(req).some(c=>c.relationshipId===r.id&&['OPEN','OVERDUE'].includes(c.status));
          if(!hasOpen) suggestions.push({kind:'relationship',refId:r.id,text:`برای رابطهٔ «${relLabel(r)}» اقدام اصلاحی ثبت کنید`,reason:`وضعیت ${r.status==='WATCH'?'تحت نظر':''} با ریسک ${r.riskScore} و سلامت ${r.healthScore}`});
        }
        const dueSoon=scopedActions(req).filter(a=>['OPEN','IN_PROGRESS'].includes(a.status)&&a.dueAt&&!isLateAt(a.dueAt,now)&&dayDiff(a.dueAt,now)<=7)
          .sort((a,b)=>(a.dueAt??'').localeCompare(b.dueAt??''));
        for(const a of dueSoon.slice(0,2)){
          suggestions.push({kind:'action',refId:a.id,text:`اقدام «${a.title}» را پیش از موعد به سرانجام برسانید`,reason:`${dayDiff(a.dueAt,now)===0?'امروز':`${dayDiff(a.dueAt,now)} روز دیگر`} موعد دارد`});
        }
        const topOpp=scopedOpps(req).filter(o=>!['WON','LOST'].includes(o.status)).sort((a,b)=>(evOf(b)-evOf(a)))[0];
        if(topOpp&&!isOppQ) suggestions.push({kind:'opportunity',refId:topOpp.id,text:`گام بعدی فرصت «${topOpp.name}» را جلو ببرید`,reason:`ارزش موزون ${evOf(topOpp)} میلیارد تومان با احتمال ${topOpp.probability}٪`});
        if(!suggestions.length) suggestions.push({kind:'info',refId:null,text:'اقدام فوری‌ای در محدودهٔ شما یافت نشد؛ وضعیت سالم است.',reason:'هیچ اقدام/تعهد عقب‌افتاده یا رابطهٔ پرریسک بدون پوشش وجود ندارد.'});
      }
      result={type:'next_best_action',suggestions:suggestions.slice(0,5),requires_confirmation:true};
      safety.humanConfirmationRequired=true;
      break;
    }
    case 'EXECUTIVE_BRIEF': {
      const brief=executiveBrief(req,undefined);
      const b=brief.result;
      result={type:'executive_brief',period:b.period,summary:b.summary,text:[
        `بریف راهبردی ${faDate(b.period.start)} تا ${faDate(b.period.end)}:`,
        `جلسات این بازه ${b.summary.meetings}، فرصت‌های جدید ${b.summary.newOpportunities}، تعهدات باز ${b.summary.openCommitments}، اقدامات عقب‌افتاده ${b.summary.overdueActions} و روابط پرریسک ${b.summary.relationshipRisks}.`,
        ...b.recommendations,
      ].join('\n'),recommendations:b.recommendations};
      break;
    }
    default: {
      /* پرس‌وجوی «ریسک/چرا» → گزارش ریسک با دلایل (به‌جای جستجوی کلیدواژه‌ای) */
      const riskTerms=['ریسک','خطر','در معرض','پرریسک','تحت نظر','بحرانی','سلامت پایین'];
      const riskAsk=riskTerms.some(t=>q.includes(t))&&/(چرا|دلیل|علت|چطور|چگونه|کدام|فهرست|لیست|بگو|توضیح|نشان|کجاست|هستند|هست|است)/.test(q);
      if(riskAsk){
        let risks=scopedRels(req).filter(r=>(r.riskScore??0)>=40||(r.healthScore??100)<55||r.status==='WATCH'||r.status==='AT_RISK');
        // اگر نام سازمان‌های یک رابطهٔ مشخص در پرس‌وجو آمده باشد، فقط همان را تحلیل کن
        const named=risks.filter(r=>{
          const a=orgById(r.sourceOrganizationId)?.name??'', b=orgById(r.targetOrganizationId)?.name??'';
          return a&&b&&q.includes(a)&&q.includes(b);
        });
        if(named.length) risks=named;
        risks=risks.sort((a,b)=>(b.riskScore??0)-(a.riskScore??0)).slice(0,6)
          .map(r=>({id:r.id,name:relLabel(r),status:r.status,riskScore:r.riskScore,healthScore:r.healthScore,strategicScore:r.strategicScore,resilienceScore:r.resilienceScore,drivers:riskDrivers(req,r)}));
        if(risks.length){
          const lines=[
            `${risks.length} رابطه در محدودهٔ شما در وضعیت ریسک قرار ${risks.length===1?'دارد':'دارند'}: ${risks.map(r=>`«${r.name}» (ریسک ${r.riskScore})`).join('، ')}`,
            'چرا؟ مهم‌ترین دلایل:',
            ...risks.slice(0,3).map(r=>`  • ${r.name}: ${(r.drivers.length?r.drivers.map(d=>d.label).join('، '):'امتیازها زیر آستانهٔ سالم‌اند')}.`),
            'برای مشاهدهٔ جزئیات و ثبت اقدام اصلاحی، روی هر رابطه کلیک کنید.',
          ];
          result={type:'risk_analysis',text:lines.join('\n'),risks};
          evidence={relationships:risks.map(r=>({id:r.id,name:r.name,riskScore:r.riskScore,healthScore:r.healthScore,status:r.status,drivers:r.drivers}))};
        } else {
          result={type:'risk_analysis',text:'در محدودهٔ مجاز شما رابطه‌ای با ریسک بالا، سلامت بحرانی یا وضعیت تحت‌نظر یافت نشد.',risks:[]};
          evidence={relationships:[]};
        }
        break;
      }
      /* اگر پرس‌وجو نوع نهاد را نام برده باشد، فقط همان گروه‌ها پاسخ می‌دهند */
      const KIND_RULES=[
        ['organizations',['سازمان','شرکت']],['people',['شخص','افراد','کارمند','کارمندان','فرد','همکار']],
        ['relationships',['رابطه','روابط','ارتباط']],['meetings',['جلسه','ملاقات','نشست']],
        ['interactions',['تعامل','تماس','دیدار']],['actions',['اقدام','کارها','پیگیری','تکلیف']],
        ['commitments',['تعهد','قول']],['opportunities',['فرصت']],['projects',['پروژه']]];
      const rawToks=normTxt(ql).replace(/[،,؛;:؟؟!().\-«»"'ـ]/g,' ').split(/\s+/).filter(w=>w.length>=2);
      const stemOf=(w)=>{let t=w;if(t.endsWith('ی')&&t.length>3)t=t.slice(0,-1);if(t.endsWith('های')&&t.length>4)t=t.slice(0,-3);if(t.endsWith('ها')&&t.length>4)t=t.slice(0,-2);if(t.endsWith('ات')&&t.length>4)t=t.slice(0,-2);if(t.endsWith('ان')&&t.length>6)t=t.slice(0,-2);return t;};
      const kinds=new Set();
      for(const w of rawToks){ const st=stemOf(w);
        for(const [k,words] of KIND_RULES) if(words.some(x=>st.includes(x)||w.includes(x))) kinds.add(k); }
      const wanted=kinds.size?kinds:new Set(['organizations','people','relationships','meetings','interactions','actions','commitments','opportunities','projects']);
      const groups=[['organizations','سازمان'],['people','شخص'],['relationships','رابطه'],['meetings','جلسه'],['interactions','تعامل'],['actions','اقدام'],['commitments','تعهد'],['opportunities','فرصت'],['projects','پروژه']].filter(([k])=>wanted.has(k));
      const total=groups.reduce((s,[k])=>s+pool[k].length,0);
      result={type:'smart_search',text:total?`${total} مورد مطابق پرس‌وجو در محدودهٔ مجاز یافت شد.`:'موردی مطابق پرس‌وجو در محدودهٔ مجاز یافت نشد.',matches:{}};
      for(const [k,label] of groups) if(pool[k].length) result.matches[k]=pool[k];
      evidence={...pool}; if(kinds.size) for(const k of Object.keys(evidence)) if(!wanted.has(k)) delete evidence[k];
      break;
    }
  }
  return {
    status:'completed_without_external_model',intent,
    evidence,result,
    model:{provider:'deterministic',externalCall:false},
    safety,
  };
}

function executiveBrief(req,weekStart){
  const scopeOrgIds=(u)=>u?.isOwner?ORGS.map(o=>o.id):u?.accessibleOrganizationIds??[];
  const endMs=Date.now();
  let startMs=weekStart?new Date(weekStart).getTime():endMs-7*86400000;
  if(!startMs||Number.isNaN(startMs)) startMs=endMs-7*86400000;
  const startIso=new Date(startMs).toISOString();
  const endIso=new Date(endMs).toISOString();
  const rels=scopedRels(req);
  const relNames=new Map(rels.map(r=>[r.id,relLabel(r)]));
  const meetings=scopedMeetings(req).filter(m=>{const t=new Date(m.startAt).getTime();return t>=startMs&&t<=endMs;})
    .sort((a,b)=>new Date(a.startAt)-new Date(b.startAt))
    .map(m=>({id:m.id,title:m.title,startAt:m.startAt,objective:m.objective,organizationId:m.organizationId,organization:orgById(m.organizationId)?{id:m.organizationId,name:orgById(m.organizationId).name}:null,participantCount:(m.participants??[]).length}));
  const commitments=scopedCommitments(req).filter(c=>['OPEN','OVERDUE'].includes(c.status))
    .map(c=>({id:c.id,description:c.description,dueAt:c.dueAt,status:c.status,organizationId:c.organizationId,organization:orgById(c.organizationId)?{id:c.organizationId,name:orgById(c.organizationId).name}:null,direction:c.direction}));
  const overdue=scopedActions(req).filter(a=>['OPEN','IN_PROGRESS'].includes(a.status)&&a.dueAt&&new Date(a.dueAt).getTime()<endMs)
    .map(a=>({id:a.id,title:a.title,dueAt:a.dueAt,status:a.status,priority:a.priority,relationshipId:a.relationshipId,relationshipName:a.relationshipId&&relNames.has(a.relationshipId)?relNames.get(a.relationshipId):null}));
  const risks=rels.filter(r=>(r.riskScore??0)>=60||(r.healthScore??0)<=40)
    .map(r=>({id:r.id,name:relLabel(r),status:r.status,riskScore:r.riskScore,healthScore:r.healthScore,strategicScore:r.strategicScore,resilienceScore:r.resilienceScore,nextActionAt:r.nextActionAt,sourceOrganizationId:r.sourceOrganizationId,targetOrganizationId:r.targetOrganizationId}));
  const oppsAll=scopedOpps(req);
  const opps=oppsAll.filter(o=>!['WON','LOST'].includes(o.status))
    .map(o=>({id:o.id,name:o.name,status:o.status,probability:o.probability,value:o.value,expectedValue:o.expectedValue??Math.round((o.value??0)*(o.probability??0)/100),organizationId:o.organizationId,organization:orgById(o.organizationId)?{id:o.organizationId,name:orgById(o.organizationId).name}:null,createdAt:o.createdAt}));
  const newInPeriod=oppsAll.filter(o=>o.createdAt&&new Date(o.createdAt).getTime()>=startMs&&new Date(o.createdAt).getTime()<=endMs).length;
  const recommendations=[];
  if(overdue.length) recommendations.push(`${overdue.length} اقدام عقب‌افتاده در محدودهٔ شماست؛ نخستین: «${overdue[0].title}»${overdue[0].relationshipName?` (${overdue[0].relationshipName})`:''}. پیگیری را امروز شروع کنید.`);
  else recommendations.push('اقدام عقب‌افتاده‌ای در محدودهٔ شما نیست.');
  const riskyNoPlan=risks.filter(r=>!scopedActions(req).some(a=>a.relationshipId===r.id&&['OPEN','IN_PROGRESS','BLOCKED'].includes(a.status)));
  if(riskyNoPlan.length) recommendations.push(`${riskyNoPlan.length} رابطهٔ پرریسک بدون اقدام باز دارد: «${riskyNoPlan[0].name}»${riskyNoPlan[0].healthScore<=40?` با سلامت ${riskyNoPlan[0].healthScore}`:''}. برای آن‌ها اقدام اصلاحی ثبت کنید.`);
  else if(risks.length) recommendations.push('روابط پرریسکِ شناسایی‌شده از قبل اقدام باز دارند؛ روند آن‌ها را راستی‌آزمایی کنید.');
  else recommendations.push('ریسک قابل توجهی در روابط شناسایی نشده است.');
  const openCount=opps.length;
  if(openCount) recommendations.push(`${openCount} فرصت باز با مجموع ارزش موزون ${Math.round(opps.reduce((s,o)=>s+(o.expectedValue??0),0)/1e9*10)/10} میلیارد تومان در جریان است؛ فرصتِ «${opps[0].name}» بالاترین اولویت را دارد.`);
  else recommendations.push('فرصت بازی در محدودهٔ شما ثبت نشده است.');
  if(meetings.length) recommendations.push(`${meetings.length} جلسه در این بازه ثبت شده: «${meetings.map(m=>m.title).slice(0,3).join('»، «')}». بریف آن‌ها را پیش از برگزاری مرور کنید.`);
  return {status:'completed',type:'executive_brief',result:{
    period:{start:startIso,end:endIso},
    generatedAt:new Date().toISOString(),
    summary:{meetings:meetings.length,newOpportunities:newInPeriod,openCommitments:commitments.length,overdueActions:overdue.length,relationshipRisks:risks.length,openOpportunities:openCount},
    importantMeetings:meetings,
    commitments,overdueActions:overdue,risks,opportunities:opps,
    recommendations,
    evidence:{meetingIds:meetings.map(x=>x.id),commitmentIds:commitments.map(x=>x.id),actionIds:overdue.map(x=>x.id),relationshipIds:risks.map(x=>x.id),opportunityIds:opps.map(x=>x.id)},
  },model:{provider:'deterministic',externalCall:false},safety:{permissionAwareRetrieval:true,humanConfirmationRequired:false}};
}

/* ------------------------------- http layer ------------------------------ */
let curMethod = 'GET';
let curReqId = '';
const json = (res, code, data) => {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-ID': curReqId });
  res.end(body);
  if (curMethod !== 'GET') { try { saveDb(); } catch (e) { console.error('[mock-api] saveDb failed', e); } }
};
const readBody=(req)=>new Promise((resolve)=>{
  let d='';
  req.on('data',c=>{ d+=c; if(d.length>2e6) req.destroy(); });
  req.on('end',()=>{ try{ resolve(d?JSON.parse(d):{}); }catch{ resolve({}); } });
});
const nowIso=()=>new Date().toISOString();

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  const path=url.pathname.replace(/\/+$/,'')||'/';
  const method=req.method??'GET';
  const q=url.searchParams;
  curMethod=method;
  curReqId=String(req.headers['x-request-id']||crypto.randomUUID());

  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,Idempotency-Key,X-Request-ID');
  res.setHeader('X-Request-ID',curReqId);
  if(method==='OPTIONS'){ res.writeHead(204); return res.end(); }

  // Authentication gate — real JWT verification on every request.
  const PUBLIC_PATHS=['/auth/login','/auth/register','/auth/refresh','/auth/password-reset/request','/auth/password-reset/confirm','/auth/mfa/required','/auth/mfa/enroll','/auth/mfa/verify','/auth/mfa/verify-enrollment',
    '/health','/health/liveness','/health/live','/health/readiness','/health/ready',
    '/metrics','/observability/metrics'];
  const authUser=currentUser(req);
  if(!authUser && !PUBLIC_PATHS.some(p=>path===`${V1}${p}`)) return json(res,401,{code:'UNAUTHENTICATED',message:'احراز هویت لازم است — ابتدا وارد شوید.'});
  const scopeOrgIds=visibleOrgIds(req);

  const is=(p)=>path===`${V1}${p}`;
  const match=(p)=>{ const m=path.match(new RegExp(`^${V1}${p.replace(/:[^/]+/g,'([^/]+)')}$`)); return m?m.slice(1):null; };

  /* ------------------------------ auth ------------------------------ */
  if(is('/auth/login') && method==='POST'){
    const b=await readBody(req);
    const ident=String(b.email??b.username??'').trim().toLowerCase();
    const key=USER_ALIASES[ident]??ident;
    if(!key||!b.password) return json(res,401,{message:'نام کاربری/ایمیل یا رمز عبور نادرست است.'});
    const u=USERS[key];
    if(!u){ audit(req,'LOGIN_FAIL','user',ident,'FAIL',{reason:'no_user'}); recordSecurity(req,'LOGIN_FAILURE','WARNING',{reason:'no_user',login:ident},'User',ident,null,null); return json(res,401,{message:'حسابی با این نام کاربری/ایمیل یافت نشد.'}); }
    if(!u.salt||!u.passwordHash||!verifyPassword(b.password,u.salt,u.passwordHash)){ audit(req,'LOGIN_FAIL','user',u.email,'FAIL',{reason:'bad_password'}); recordSecurity(req,'LOGIN_FAILURE','WARNING',{reason:'bad_password'},'User',u.email,u.id,null); return json(res,401,{message:'نام کاربری/ایمیل یا رمز عبور نادرست است.'}); }
    const mfaNeeded=mfaRequiredFor(u.id);
    if(mfaNeeded&&(!b.otp||!/^\d{6}$/.test(String(b.otp)))){ audit(req,'LOGIN_FAIL','user',u.email,'FAIL',{reason:'no_mfa'}); recordSecurity(req,'LOGIN_FAILURE','WARNING',{reason:'no_mfa'},'User',u.email,u.id,null); return json(res,401,{message:'کد تأیید دومرحله‌ای (MFA) لازم است.'}); }
    if(!u.isActive){ audit(req,'LOGIN_FAIL','user',u.email,'FAIL',{reason:'inactive'}); recordSecurity(req,'LOGIN_FAILURE','WARNING',{reason:'inactive'},'User',u.email,u.id,null); return json(res,401,{message:'نام کاربری/ایمیل یا رمز عبور نادرست است.'}); }
    u.lastLoginAt=nowIso();
    audit(req,'LOGIN_SUCCESS','user',u.email,'OK'); recordSecurity(req,'LOGIN_SUCCESS','INFO',{mfa:'TOTP'},'User',u.email,u.id,null);
    const nowL=new Date().toISOString();
    const rowId=`s-${Date.now()}`;
    DB.sessions=DB.sessions??[];
    DB.sessions.push({id:rowId,userId:u.id,tokenFamilyId:`fam-${rowId}`,deviceName:'نشست فعلی (این مرورگر)',ipAddress:req.socket?.remoteAddress??null,userAgent:String(req.headers['user-agent']??'').slice(0,300)||null,createdAt:nowL,lastActivityAt:nowL,idleExpiresAt:new Date(Date.now()+8*3600000).toISOString(),absoluteExpiresAt:new Date(Date.now()+30*86400000).toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString(),revokedAt:null,rotatedAt:null});
    saveDb();
    return json(res,200,{accessToken:signJwt({sub:u.id,email:u.email,name:u.name,isOwner:!!u.isOwner,sid:rowId},ACCESS_TTL),refreshToken:signJwt({sub:u.id,email:u.email,kind:'refresh',sid:rowId},REFRESH_TTL)});
  }
  if(is('/auth/refresh') && method==='POST'){
    const b=await readBody(req);
    const p=verifyJwt(b.token);
    if(!p||p.kind!=='refresh'||!USERS[p.email]) return json(res,401,{message:'توکن تازه‌سازی نامعتبر یا منقضی است.'});
    DB.revokedJtis.push(p.jti); // rotate: old refresh token dies
    const u=USERS[p.email];
    if(!u.isActive) return json(res,401,{message:'حساب کاربری غیرفعال است.'});
    audit(req,'TOKEN_REFRESH','user',u.email,'OK');
    return json(res,200,{accessToken:signJwt({sub:u.id,email:u.email,name:u.name,isOwner:!!u.isOwner,sid:p.sid??undefined},ACCESS_TTL),refreshToken:signJwt({sub:u.id,email:u.email,kind:'refresh',sid:p.sid??undefined},REFRESH_TTL)});
  }
  if(is('/auth/logout') && method==='POST'){
    const b=await readBody(req);
    const p=verifyJwt(b.token??b.refreshToken);
    if(p&&p.kind==='refresh') DB.revokedJtis.push(p.jti);
    audit(req,'LOGOUT','user',authUser?.email??'anonymous','OK');
    return json(res,200,{ok:true});
  }
  if(is('/auth/register') && method==='POST'){
    const b=await readBody(req);
    if(!b.email||!b.password||b.password.length<12||!b.name?.trim()) return json(res,400,{message:'نام، ایمیل و رمز (حداقل ۱۲ کاراکتر) لازم است.'});
    if(USERS[b.email]) return json(res,409,{message:'حسابی با این ایمیل وجود دارد.'});
    const salt=crypto.randomBytes(16).toString('hex');
    USERS[b.email]={id:`u-${Date.now()}`,email:b.email,name:b.name,salt,passwordHash:hashPassword(b.password,salt),memberships:[],permissions:[],accessibleOrganizationIds:[],isOwner:false,isActive:true,emailVerifiedAt:null,lastLoginAt:null,createdAt:nowIso()};
    audit(req,'REGISTER','user',b.email,'OK');
    return json(res,201,{id:USERS[b.email].id,email:b.email,status:'PENDING_VERIFICATION'});
  }
  if(is('/auth/password-reset/request') && method==='POST'){ await readBody(req); return json(res,200,{ok:true,developmentToken:'dev-reset-token-123456'}); }
  if(is('/auth/password-reset/confirm') && method==='POST'){
    const b=await readBody(req);
    if(!b.token||!b.password||b.password.length<12) return json(res,400,{message:'توکن یا رمز نامعتبر است.'});
    return json(res,200,{ok:true});
  }
  if(is('/auth/mfa/required')&&method==='GET'){
    if(!authUser) return json(res,200,{required:false});
    return json(res,200,{required:mfaRequiredFor(authUser.id)});
  }
  if(is('/auth/mfa/enroll')&&method==='POST'){
    const b=await readBody(req);
    if(!authUser) return json(res,201,{deviceId:`dev-${Date.now()}`,label:b.label??'SRIP Web',secret:'MOCKMFA',otpauthUrl:'otpauth://totp/SRIP:demo?secret=MOCKMFA'}); // legacy pre-auth demo flow
    const dev={id:`dev-${Date.now()}`,userId:authUser.id,label:String(b.label??'SRIP Web'),secret:`MOCKMFA${Math.random().toString(36).slice(2,6)}`,enabled:true,verifiedAt:null,createdAt:nowIso(),lastUsedAt:null,recoveryCodes:null};
    DB.mfaDevices=DB.mfaDevices??[];
    DB.mfaDevices.push(dev);
    audit(req,'TOKEN_CHANGE','MfaDevice',dev.id,'OK',{meta:{reason:'mfa-enrolled',label:dev.label,enabled:true}});
    saveDb();
    return json(res,201,{deviceId:dev.id,secret:dev.secret,otpauthUrl:`otpauth://totp/SRIP:${encodeURIComponent(authUser.name??'user')}?secret=${dev.secret}&issuer=SRIP&algorithm=SHA1&digits=6&period=30`});
  }
  if(is('/auth/mfa/verify-enrollment')&&method==='POST'){
    const b=await readBody(req);
    if(!b.deviceId||!/^\d{6}$/.test(String(b.code??''))) return json(res,400,{message:'کد ۶ رقمی لازم است.'});
    if(!authUser) return json(res,200,{verified:true});
    const dev=(DB.mfaDevices??[]).find(d=>d.id===b.deviceId&&d.userId===authUser.id);
    if(!dev) return json(res,404,{message:'دستگاه احراز هویت یافت نشد.'});
    dev.verifiedAt=nowIso(); dev.recoveryCodes=genRecoveryCodes();
    audit(req,'TOKEN_CHANGE','MfaDevice',dev.id,'OK',{meta:{reason:'mfa-enrollment-verified',verified:true,recoveryCodesIssued:dev.recoveryCodes.length}});
    saveDb();
    return json(res,200,{verified:true,recoveryCodes:dev.recoveryCodes});
  }
  if(is('/auth/mfa/verify')&&method==='POST'){
    const b=await readBody(req);
    if(!/^\d{6}$/.test(String(b.code??''))) return json(res,400,{message:'کد ۶ رقمی لازم است.'});
    if(authUser){
      const dev=mfaDevicesOf(authUser.id).find(d=>d.enabled&&d.verifiedAt);
      if(dev){ dev.lastUsedAt=nowIso(); audit(req,'TOKEN_CHANGE','MfaDevice',dev.id,'OK',{meta:{reason:'mfa-verified',used:true}}); saveDb(); }
    }
    return json(res,200,{verified:true});
  }
  if(is('/auth/me')) {
    const u=currentUser(req);
    if(!u) return json(res,401,{code:'UNAUTHENTICATED',message:'نشست نامعتبر است.'});
    const memberships=(u.memberships??[]).map(m=>({id:m.id,organizationId:m.organizationId,organizationName:m.organizationName??orgById(m.organizationId)?.name??null,role:m.role,department:m.department??null,dataScope:m.dataScope??null,accessScope:m.accessScope??null,scope:m.scope??null,isPrimary:!!m.isPrimary}));
    const perms=u.permissions??[];
    return json(res,200,{id:u.id,email:u.email,name:u.name,isOwner:!!u.isOwner,memberships,permissions:[...new Set(perms)],accessibleOrganizationIds:u.accessibleOrganizationIds??[]});
  }

  /* --------------------------- organizations --------------------------- */
  if(is('/organizations') && method==='GET') return json(res,200,scopedOrgs(req).map(o=>({...o,owner:{name:'کاربر دمو'},_count:orgCounts(o)})));
  if(is('/organizations') && method==='POST'){
    const b=await readBody(req);
    if(!b.name||b.name.trim().length<2) return json(res,400,{message:'نام سازمان حداقل ۲ نویسه باید باشد.'});
    const o={id:`org-${Date.now()}`,name:b.name,type:b.type??'OTHER',industry:b.industry??null,country:b.country??null,parentOrganizationId:b.parentOrganizationId??null,createdAt:nowIso()};
    ORGS.push(o);
    audit(req,'CREATE','organization',o.id,'OK',{name:o.name});
    return json(res,201,{...o,owner:{name:'کاربر دمو'},_count:orgCounts(o)});
  }
  const orgId=match('/organizations/:id');
  if(orgId&&method==='GET'){
    const o=ORGS.find(x=>x.id===orgId[0]);
    if(!o) return json(res,404,{message:'سازمان یافت نشد'});
    if(!inScope(req,o.id)) return json(res,403,{message:'دسترسی به این سازمان مجاز نیست.'});
    return json(res,200,{...o,owner:{name:'کاربر دمو'},_count:orgCounts(o)});
  }
  const orgTimeline=match('/organizations/:id/timeline');
  if(orgTimeline&&method==='GET'){
    const oid=orgTimeline[0];
    const relOf=(id)=>RELS.find(r=>r.id===id);
    const involves=(rel)=>rel&&(rel.sourceOrganizationId===oid||rel.targetOrganizationId===oid);
    const evts=[];
    MEETINGS.filter(m=>m.organizationId===oid||involves(relOf(m.relationshipId))).forEach(m=>evts.push({id:`t-m-${m.id}`,kind:'MEETING',title:m.title,date:m.startAt,status:m.outcome?'DONE':'UPCOMING'}));
    INTERACTIONS.filter(x=>x.organizationId===oid||involves(relOf(x.relationshipId))).forEach(x=>evts.push({id:`t-i-${x.id}`,kind:'INTERACTION',title:x.subject,date:x.occurredAt}));
    OPPORTUNITIES.filter(o=>o.organizationId===oid).forEach(o=>evts.push({id:`t-o-${o.id}`,kind:'OPPORTUNITY',title:o.name,date:o.createdAt,status:o.status}));
    COMMITMENTS.filter(c=>c.organizationId===oid).forEach(c=>evts.push({id:`t-c-${c.id}`,kind:'COMMITMENT',title:c.description,date:c.dueAt,status:c.status}));
    evts.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    return json(res,200,evts);
  }

  /* ------------------------------ people ------------------------------ */
  if(is('/people')&&method==='GET'){
    let list=scopedPeople(req);
    const orgParam=q.get('organizationId');
    if(orgParam) list=list.filter(p=>p.organizationId===orgParam);
    return json(res,200,list.map(p=>({...p,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null})));
  }
  const personId=match('/people/:id');
  if(personId&&method==='GET'){
    const p=PEOPLE.find(x=>x.id===personId[0]);
    if(!p) return json(res,404,{message:'شخص یافت نشد'});
    if(!inScope(req,p.organizationId)) return json(res,403,{message:'دسترسی به این شخص مجاز نیست.'});
    return json(res,200,{...p,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null});
  }
  const personOrgs=match('/people/:id/organizations');
  if(personOrgs&&method==='GET'){
    const p=PEOPLE.find(x=>x.id===personOrgs[0]);
    if(!p) return json(res,404,{message:'شخص یافت نشد'});
    return json(res,200,PERSON_ORGS.filter(a=>a.personId===p.id).map(a=>({organizationId:a.organizationId,organization:orgById(a.organizationId)?{id:a.organizationId,name:orgById(a.organizationId).name}:null,roleTitle:a.roleTitle??null,department:a.department??null,isPrimary:a.isPrimary??false,status:a.status??'ACTIVE'})));
  }
  if(personOrgs&&method==='POST'){
    const p=PEOPLE.find(x=>x.id===personOrgs[0]);
    if(!p) return json(res,404,{message:'شخص یافت نشد'});
    const b=await readBody(req);
    if(!b.organizationId||!inScope(req,b.organizationId)) return json(res,403,{message:'سازمان انتخاب‌شده در محدودهٔ دسترسی شما نیست.'});
    const org=orgById(b.organizationId);
    if(!org) return json(res,404,{message:'سازمان یافت نشد'});
    const aff={personId:p.id,organizationId:b.organizationId,roleTitle:b.roleTitle??null,department:b.department??null,isPrimary:!!b.isPrimary,status:'ACTIVE'};
    if(aff.isPrimary) PERSON_ORGS.forEach(a=>{ if(a.personId===p.id) a.isPrimary=false; });
    PERSON_ORGS.push(aff);
    audit(req,'CREATE','person_organization',`${p.id}:${b.organizationId}`,'OK');
    return json(res,201,{...aff,organization:{id:org.id,name:org.name}});
  }
  const personOrgDel=match('/people/:id/organizations/:orgId');
  if(personOrgDel&&method==='DELETE'){
    const idx=PERSON_ORGS.findIndex(a=>a.personId===personOrgDel[0]&&a.organizationId===personOrgDel[1]);
    if(idx<0) return json(res,404,{message:'انتساب یافت نشد'});
    if(PERSON_ORGS[idx].isPrimary) return json(res,400,{message:'انتساب اصلی را نمی‌توان حذف کرد.'});
    PERSON_ORGS.splice(idx,1);
    return json(res,200,{ok:true});
  }
  const personTimeline=match('/people/:id/timeline');
  if(personTimeline&&method==='GET'){
    const pid=personTimeline[0];
    const evts=[];
    MEETINGS.filter(m=>(m.participants??[]).some((p)=>p.personId===pid)).forEach(m=>evts.push({id:`t-m-${m.id}`,kind:'MEETING',title:m.title,date:m.startAt,status:m.outcome?'DONE':'UPCOMING'}));
    INTERACTIONS.forEach(x=>evts.push({id:`t-i-${x.id}`,kind:'INTERACTION',title:x.subject,date:x.occurredAt}));
    ACTIONS.filter(a=>a.ownerId===pid).forEach(a=>evts.push({id:`t-a-${a.id}`,kind:'ACTION',title:a.title,date:a.dueAt,status:a.status}));
    evts.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    return json(res,200,evts);
  }

  /* ------------------------------ core-domain ------------------------------ */
  const orgUnits=match('/core-domain/organizations/:id/units');
  if(orgUnits&&method==='GET'){
    if(orgUnits[0]!=='org-2') return json(res,200,[]);
    return json(res,200,[
      {id:'u-1',name:'واحد فروش',type:'DEPARTMENT',children:[{id:'u-1a',name:'تیم فروش شرکتی',type:'BUSINESS_UNIT'},{id:'u-1b',name:'تیم فروش دولتی',type:'BUSINESS_UNIT'}]},
      {id:'u-2',name:'واحد فنی',type:'DEPARTMENT',children:[{id:'u-2a',name:'تیم محصول',type:'BUSINESS_UNIT'}]},
      {id:'u-3',name:'واحد مالی',type:'DIVISION',children:[]},
    ]);
  }
  if(orgUnits&&method==='POST'){ const b=await readBody(req); return json(res,201,{id:`u-${Date.now()}`,name:b.name,type:b.type??'DEPARTMENT',parentUnitId:b.parentUnitId??null,children:[]}); }
  const orgContacts=match('/core-domain/organizations/:id/contacts');
  if(orgContacts&&method==='GET'){
    return json(res,200,[
      {id:'c-1',kind:'PHONE',value:'+98 21 88001122',label:'دفتر مرکزی',isPrimary:true},
      {id:'c-2',kind:'EMAIL',value:'info@arya-tech.ir',label:'عمومی',isPrimary:false},
      {id:'c-3',kind:'ADDRESS',value:'تهران، خیابان ولیعصر',label:'آدرس',isPrimary:false},
    ]);
  }
  if(orgContacts&&method==='POST'){ const b=await readBody(req); return json(res,201,{id:`c-${Date.now()}`,...b}); }
  const personContacts=match('/core-domain/people/:id/contacts');
  if(personContacts&&method==='GET'){
    return json(res,200,[
      {id:'cp-1',kind:'EMAIL',value:'sara@arya-tech.ir',label:'کاری',isPrimary:true},
      {id:'cp-2',kind:'MOBILE',value:'+98 912 000 1122',label:'شخصی',isPrimary:false},
      {id:'cp-3',kind:'LINKEDIN',value:'linkedin.com/in/sara-mohammadi',label:'لینکدین',isPrimary:false},
    ]);
  }
  if(personContacts&&method==='POST'){ const b=await readBody(req); return json(res,201,{id:`cp-${Date.now()}`,...b}); }

  /* --------------------------- relationships --------------------------- */
  if(is('/relationships')&&method==='GET'){
    let list=scopedRels(req);
    const orgParam=q.get('organizationId');
    if(orgParam) list=list.filter(r=>r.sourceOrganizationId===orgParam||r.targetOrganizationId===orgParam);
    return json(res,200,list.map(r=>({...relWithOrgs(r), riskDrivers:riskDrivers(req,r)})));
  }
  if(is('/relationships')&&method==='POST'){
    const b=await readBody(req);
    if(!b.sourceOrganizationId||!b.targetOrganizationId) return json(res,400,{message:'سازمان مبدأ و مقصد لازم است.'});
    if(!inScope(req,b.sourceOrganizationId)||!inScope(req,b.targetOrganizationId)) return json(res,403,{message:'یکی از سازمان‌ها خارج از محدوده است.'});
    const r={id:`r-${Date.now()}`,relationshipType:b.relationshipType??'OTHER',status:b.status??'ACTIVE',healthScore:b.healthScore??60,riskScore:b.riskScore??30,strategicScore:b.strategicScore??50,influenceScore:b.influenceScore??50,opportunityScore:b.opportunityScore??50,resilienceScore:b.resilienceScore??50,nextActionAt:null,lastInteractionAt:nowIso(),sourceOrganizationId:b.sourceOrganizationId,targetOrganizationId:b.targetOrganizationId};
    RELS.push(r); saveDb();
    audit(req,'CREATE','relationship',r.id,'OK',{source:r.sourceOrganizationId,target:r.targetOrganizationId});
    return json(res,201,relWithOrgs(r));
  }
  const relId=match('/relationships/:id');
  if(relId&&method==='GET'){
    const r=RELS.find(x=>x.id===relId[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    if(!inScope(req,r.sourceOrganizationId)||!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'دسترسی مجاز نیست.'});
    return json(res,200,{...relWithOrgs(r), riskDrivers:riskDrivers(req,r)});
  }
  const relTimeline=match('/relationships/:id/timeline');
  if(relTimeline&&method==='GET'){
    const r=RELS.find(x=>x.id===relTimeline[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    const evts=[];
    MEETINGS.filter(m=>!m.deletedAt&&m.relationshipId===r.id).forEach(m=>evts.push({id:m.id,kind:'MEETING',title:m.title,date:m.startAt,status:m.outcome?'DONE':'UPCOMING'}));
    INTERACTIONS.filter(x=>!x.deletedAt&&(x.relationshipId===r.id||x.organizationId===r.sourceOrganizationId||x.organizationId===r.targetOrganizationId)).forEach(x=>evts.push({id:x.id,kind:'INTERACTION',title:x.subject,date:x.occurredAt,status:x.type}));
    ACTIONS.filter(a=>!a.deletedAt&&a.relationshipId===r.id).forEach(a=>evts.push({id:a.id,kind:'ACTION',title:a.title,date:a.dueAt,status:a.status}));
    evts.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    return json(res,200,evts);
  }

  /* ------------------------------ meetings ------------------------------ */
  if(is('/meetings')&&method==='GET'){
    let list=scopedMeetings(req);
    const upcoming=q.get('upcoming')==='true';
    const orgParam=q.get('organizationId');
    if(orgParam){
      if(!inScope(req,orgParam)) return json(res,403,{code:'FORBIDDEN',message:'دسترسی به این سازمان مجاز نیست.'});
      list=list.filter(m=>m.organizationId===orgParam);
    }
    if(upcoming) list=list.filter(m=>new Date(m.startAt).getTime()>Date.now());
    return json(res,200,list.map(meetingView));
  }
  if(is('/meetings')&&method==='POST'){
    const b=await readBody(req);
    if(!b.title?.trim()||!b.startAt) return json(res,400,{message:'عنوان و زمان شروع لازم است.'});
    const mRel=b.relationshipId?RELS.find(r=>r.id===b.relationshipId):null;
    if(b.relationshipId&&!mRel) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'});
    const mOrg=b.organizationId??(mRel?mRel.sourceOrganizationId:null);
    if(mOrg&&!inScope(req,mOrg)) return json(res,403,{message:'سازمانِ جلسه خارج از محدودهٔ دسترسی شماست.'});
    if(mRel&&!relInScope(req,mRel)) return json(res,403,{message:'رابطهٔ جلسه خارج از محدودهٔ دسترسی شماست.'});
    const participants=Array.isArray(b.participants)?b.participants.map(p=>typeof p==='string'?{personId:p}:{personId:p?.personId??p?.id}).filter(p=>p.personId):[];
    if(participants.length&&!authUser?.isOwner) for(const p of participants){ const per=personById(p.personId); if(!per) return json(res,404,{message:`شخص ${p.personId} یافت نشد.`}); if(!inScope(req,per.organizationId)) return json(res,403,{message:'یکی از شرکت‌کنندگان خارج از محدودهٔ دسترسی شماست.'}); }
    const m={id:`m-${Date.now()}`,title:b.title,startAt:b.startAt,endAt:b.endAt??null,objective:b.objective??null,agenda:b.agenda??null,outcome:null,notes:null,preMeetingBrief:null,location:b.location??null,meetingUrl:b.meetingUrl??null,organizationId:mOrg,relationshipId:b.relationshipId??null,participants,actions:[],commitments:[]};
    MEETINGS.unshift(m);
    audit(req,'CREATE','meeting',m.id,'OK',{title:m.title});
    return json(res,201,meetingView(m));
  }
  const meetingInScope=(m)=>m&&(!m.organizationId||inScope(req,m.organizationId))&&(!m.relationshipId||relInScope(req,RELS.find(r=>r.id===m.relationshipId)));
  const meetingGuard=(id)=>{ const m=MEETINGS.find(x=>x.id===id); if(!m) return {code:404,msg:'جلسه یافت نشد'}; if(!meetingInScope(m)) return {code:403,msg:'دسترسی به این جلسه مجاز نیست.'}; return {m}; };
  const meetingOutcome=match('/meetings/:id/outcome');
  if(meetingOutcome&&method==='POST'){
    const b=await readBody(req);
    const g=meetingGuard(meetingOutcome[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const m=g.m;
    if(!b.outcome?.trim()) return json(res,400,{message:'نتیجه نمی‌تواند خالی باشد.'});
    m.outcome=b.outcome.trim();
    if(b.notes?.trim()) m.notes=b.notes.trim();
    if(Array.isArray(b.decisions)) m.decisions=b.decisions.filter(Boolean).map(String); else if(b.decisions?.trim) { try { const arr=JSON.parse(b.decisions); if(Array.isArray(arr)) m.decisions=arr.filter(Boolean).map(String); } catch {} }
    if(b.transcript?.trim()) m.transcript=b.transcript.trim();
    m.completedAt=nowIso();
    audit(req,'MEETING_OUTCOME','meeting',m.id,'OK');
    NOTIFICATIONS.unshift({id:`n-${Date.now()}`,title:'نتیجه جلسه ثبت شد',body:`نتیجهٔ «${m.title}» ثبت شد: ${b.outcome.trim()}`,type:'SYSTEM',priority:'information',isRead:false,createdAt:nowIso()});
    return json(res,200,meetingView(m));
  }
  const meetingId=match('/meetings/:id');
  if(meetingId&&method==='GET'){
    const g=meetingGuard(meetingId[0]); if(g.code) return json(res,g.code,{message:g.msg});
    return json(res,200,meetingView(g.m));
  }
  const meetingMinutes=match('/meetings/:id/minutes');
  if(meetingMinutes&&method==='GET'){
    const g=meetingGuard(meetingMinutes[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const m=g.m;
    const now=Date.now();
    const linkedActions=ACTIONS.filter(a=>a.relationshipId===m.relationshipId||(m.actions??[]).some(x=>x.id===a.id));
    const open=linkedActions.filter(a=>!['DONE','COMPLETED','CANCELLED'].includes(a.status??''));
    return json(res,200,{title:m.title,objective:m.objective??'—',startAt:m.startAt,endAt:m.endAt??null,location:m.location??'—',notes:m.notes??'',outcome:m.outcome??null,decisions:m.decisions??[],generatedAt:nowIso(),actionItems:{open:open.map(a=>a.title),overdueOpen:open.filter(a=>a.dueAt&&new Date(a.dueAt).getTime()<now).map(a=>a.title),completed:linkedActions.filter(a=>['DONE','COMPLETED'].includes(a.status??'')).map(a=>a.title)},commitments:{open:[],overdue:[],fulfilled:[]},isFinalized:!!m.isFinalized});
  }
  const meetingExtract=match('/meetings/:id/action-items/extract');
  if(meetingExtract&&method==='POST'){
    const g=meetingGuard(meetingExtract[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const m=g.m;
    return json(res,200,{candidates:[
      {suggestedTitle:'ارسال پیش‌فاکتور نهایی',text:'ارسال پیش‌فاکتور نهایی به پترو صنعت',suggestedDueAt:new Date(Date.now()+3*86400000).toISOString(),isCommitmentLike:false,matchedKeyword:'ارسال'},
      {suggestedTitle:'هماهنگی با تیم حقوقی',text:'هماهنگی با تیم حقوقی برای امضای قرارداد',suggestedDueAt:new Date(Date.now()+5*86400000).toISOString(),isCommitmentLike:false,matchedKeyword:'هماهنگی'},
    ]});
  }
  const meetingApply=match('/meetings/:id/action-items/apply');
  if(meetingApply&&method==='POST'){
    const b=await readBody(req);
    const m=MEETINGS.find(x=>x.id===meetingApply[0]);
    if(!m) return json(res,404,{message:'جلسه یافت نشد'});
    const created=[];
    for(const it of (b.items??[])){
      if(!it?.title) continue;
      const a={id:`a-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,title:it.title,status:'OPEN',priority:it.priority??'MEDIUM',dueAt:it.dueAt??null,ownerId:it.ownerId??null,relationshipId:m.relationshipId??null};
      ACTIONS.unshift(a); created.push({id:a.id,title:a.title});
      if(it.asCommitment) COMMITMENTS.unshift({id:`c-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,description:it.title,dueAt:it.dueAt??null,status:'OPEN',organizationId:m.organizationId??null,ownerId:it.ownerId??null});
    }
    if(created.length) m.actions=[...(m.actions??[]),...created.map(c=>({id:c.id}))];
    audit(req,'CREATE','action',created.map(c=>c.id).join(','),'OK',{count:created.length,meetingId:m.id});
    return json(res,200,{applied:true,created:created.length});
  }
  const meetingFinalize=match('/meetings/:id/finalize');
  if(meetingFinalize&&method==='POST'){ await readBody(req); const g=meetingGuard(meetingFinalize[0]); if(g.code) return json(res,g.code,{message:g.msg}); g.m.isFinalized=true; audit(req,'FINALIZE','meeting',g.m.id,'OK'); return json(res,200,{ok:true,isFinalized:true}); }

  /* ----------------------------- actions etc ----------------------------- */
  const genericList=(arr,keys)=>arr.map(x=>Object.fromEntries(keys.map(k=>[k,x[k]??null])));
  if(is('/actions')&&method==='GET') return json(res,200,scopedActions(req).map(actionView));
  if(is('/actions')&&method==='POST'){
    const b=await readBody(req);
    if(!b.title?.trim()) return json(res,400,{message:'عنوان اقدام لازم است.'});
    const actRel=b.relationshipId?RELS.find(r=>r.id===b.relationshipId):null;
    if(b.relationshipId&&!actRel) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'});
    if(actRel&&!relInScope(req,actRel)) return json(res,403,{message:'رابطهٔ اقدام خارج از محدودهٔ دسترسی شماست.'});
    if(b.organizationId&&!inScope(req,b.organizationId)) return json(res,403,{message:'سازمانِ اقدام خارج از محدودهٔ دسترسی شماست.'});
    const a={id:`a-${Date.now()}`,title:b.title,status:b.status??'OPEN',priority:b.priority??'MEDIUM',dueAt:b.dueAt??null,description:b.description??null,reminderAt:b.reminderAt??null,meetingId:b.meetingId??null,outcome:b.outcome??null,ownerId:b.ownerId??null,relationshipId:b.relationshipId??null,organizationId:b.organizationId??null};
    ACTIONS.push(a); audit(req,'CREATE','action',a.id,'OK',{title:a.title}); return json(res,201,actionView(a));
  }
  if(is('/commitments')&&method==='GET') return json(res,200,scopedCommitments(req).map(commitmentView));
  if(is('/projects')&&method==='GET') return json(res,200,scopedProjects(req).map(projectView));
  if(is('/opportunities')&&method==='GET') return json(res,200,scopedOpps(req).map(opportunityView));
  const INTERACTION_KIND_FA={CALL:'تماس تلفنی',EMAIL:'ایمیل',MEETING:'جلسه',NOTE:'یادداشت',MESSAGE:'پیام',OTHER:'سایر'};
  const INTERACTION_KIND_LIST=['CALL','EMAIL','MEETING','NOTE','MESSAGE','OTHER'];
  const PRIORITY_LIST=['LOW','MEDIUM','HIGH','CRITICAL'];
  const interactionPerson=(i)=>i.personId?personById(i.personId):null;
  const interactionRel=(i)=>{ const r=i.relationshipId?RELS.find(x=>x.id===i.relationshipId):null; return r; };
  function interactionCardView(i){
    const p=interactionPerson(i), rel=interactionRel(i);
    return {...i,
      typeName:INTERACTION_KIND_FA[i.type]??i.type,
      organization:orgById(i.organizationId)?{id:i.organizationId,name:orgById(i.organizationId).name}:null,
      person:p?{id:p.id,name:`${p.firstName??''} ${p.lastName??''}`.trim(),title:p.title??null}:null,
      relationship:rel?relWithOrgs(rel):null,
    };
  }
  function interactionTimelineOf(i){
    const scopeId=i.relationshipId?i.relationshipId:null;
    const orgScope=i.organizationId??(scopeId?(RELS.find(r=>r.id===scopeId)?.targetOrganizationId??i.organizationId):i.organizationId);
    const others=INTERACTIONS.filter(x=>!x.deletedAt&&x.id!==i.id&&(scopeId?x.relationshipId===scopeId:(x.organizationId===orgScope)));
    return others.sort((a,b)=>String(b.occurredAt??'').localeCompare(String(a.occurredAt??''))).map(x=>({id:x.id,type:x.type,typeName:INTERACTION_KIND_FA[x.type]??x.type,subject:x.subject,occurredAt:x.occurredAt,importance:x.importance??'MEDIUM',sentiment:x.sentiment??0}));
  }
  function interactionDetailView(i){
    const rel=interactionRel(i);
    const orgIds=rel?[rel.sourceOrganizationId,rel.targetOrganizationId]:[i.organizationId];
    const relRow=rel?{id:rel.id,relationshipType:rel.relationshipType,status:rel.status,healthScore:rel.healthScore,riskScore:rel.riskScore,strategicScore:rel.strategicScore,influenceScore:rel.influenceScore,sourceOrganization:orgById(rel.sourceOrganizationId)?{id:rel.sourceOrganizationId,name:orgById(rel.sourceOrganizationId).name}:null,targetOrganization:orgById(rel.targetOrganizationId)?{id:rel.targetOrganizationId,name:orgById(rel.targetOrganizationId).name}:null,nextActionAt:rel.nextActionAt,lastInteractionAt:rel.lastInteractionAt}:null;
    const byUser=userById(i.userId);
    const relId=rel?.id??null;
    return {...interactionCardView(i),relationshipDetail:relRow,loggedBy:byUser?{id:byUser.id,name:byUser.name,email:byUser.email}:null,
      related:{
        actions:ACTIONS.filter(a=>!a.deletedAt&&a.relationshipId===relId).map(a=>({id:a.id,title:a.title,status:a.status,priority:a.priority,dueAt:a.dueAt??null})).slice(0,8),
        commitments:COMMITMENTS.filter(c=>!c.deletedAt&&c.relationshipId===relId).map(c=>({id:c.id,description:c.description,dueAt:c.dueAt??null,status:c.status??'OPEN'})).slice(0,8),
        meetings:MEETINGS.filter(m=>!m.deletedAt&&(m.relationshipId===relId||(relId==null&&orgIds.includes(m.organizationId)))).map(m=>({id:m.id,title:m.title,startAt:m.startAt,outcome:m.outcome??null})).slice(0,6),
      },
      timeline:interactionTimelineOf(i),
    };
  }
  function interactionWritableScope(i){
    // paryti: assertAccess — one of org/person/relationship endpoints must be in scope
    const rel=interactionRel(i);
    const orgIds=[i.organizationId,rel?.sourceOrganizationId,rel?.targetOrganizationId,interactionPerson(i)?.organizationId].filter(Boolean);
    return orgIds.some(oid=>oid&&inScope(req,oid));
  }
  if(is('/interactions')&&method==='GET'){
    let list=scopedInteractions(req);
    const orgParam=q.get('organizationId');
    if(orgParam) list=list.filter(x=>x.organizationId===orgParam);
    return json(res,200,list.map(interactionCardView));
  }
  const interactionTimelineRoute=match('/interactions/timeline/:relationshipId');
  if(interactionTimelineRoute&&method==='GET'){
    const rid=interactionTimelineRoute[0];
    const r=RELS.find(x=>x.id===rid);
    if(!r) return json(res,404,{message:'رابطه یافت نشد.'});
    if(!relInScope(req,r)) return json(res,403,{message:'رابطه خارج از محدودهٔ دسترسی شماست.'});
    const items=INTERACTIONS.filter(x=>!x.deletedAt&&x.relationshipId===rid).sort((a,b)=>String(b.occurredAt??'').localeCompare(String(a.occurredAt??''))).map(interactionCardView);
    return json(res,200,{items,total:items.length});
  }
  const interactionId=match('/interactions/:id');
  if(interactionId&&method==='GET'){
    const x=INTERACTIONS.find(i=>i.id===interactionId[0]&&!i.deletedAt);
    if(!x) return json(res,404,{message:'تعامل یافت نشد.'});
    if(!interactionWritableScope(x)) return json(res,404,{message:'تعامل یافت نشد.'});
    return json(res,200,interactionDetailView(x));
  }
  if(interactionId&&method==='PATCH'){
    const x=INTERACTIONS.find(i=>i.id===interactionId[0]&&!i.deletedAt);
    if(!x) return json(res,404,{message:'تعامل یافت نشد.'});
    if(!interactionWritableScope(x)) return json(res,403,{message:'تعامل خارج از محدودهٔ دسترسی شماست.'});
    if(!(authUser?.permissions??[]).includes('interaction.write')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «ثبت تعامل» (interaction.write) را ندارید.'});
    const b=await readBody(req);
    const allowed=['subject','summary','outcome','durationMinutes','importance','sentiment','followUpRequired','followUpAt','type','occurredAt'];
    const before={...x};
    for(const k of allowed){
      if(b[k]===undefined) continue;
      if(k==='importance'&&b[k]&&!PRIORITY_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:`اهمیت «${b[k]}» نامعتبر است.`});
      if(k==='type'&&b[k]&&!INTERACTION_KIND_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:`نوع «${b[k]}» نامعتبر است.`});
      if(k==='sentiment'&&b[k]!=null&&![ -1, 0, 1].includes(Number(b[k]))) return json(res,400,{message:'احساس باید یکی از مقادیر ‎-۱، ۰ یا ۱ باشد.'});
      if(k==='durationMinutes'&&b[k]!=null&&(!Number.isFinite(Number(b[k]))||Number(b[k])<1)) return json(res,400,{message:'مدت باید عددی بزرگ‌تر از صفر باشد.'});
      x[k]=k==='importance'?String(b[k]).toUpperCase():k==='type'?String(b[k]).toUpperCase():b[k];
      if(k==='followUpAt'&&b[k]==='') x.followUpAt=null;
    }
    if(b.followUpRequired===false) x.followUpAt=null;
    audit(req,'UPDATE','Interaction',x.id,'OK',{meta:{before:{subject:before.subject,importance:before.importance,sentiment:before.sentiment,followUpRequired:before.followUpRequired},after:{subject:x.subject,importance:x.importance,sentiment:x.sentiment,followUpRequired:x.followUpRequired}}});
    saveDb();
    return json(res,200,interactionDetailView(x));
  }
  if(interactionId&&method==='DELETE'){
    const x=INTERACTIONS.find(i=>i.id===interactionId[0]&&!i.deletedAt);
    if(!x) return json(res,404,{message:'تعامل یافت نشد.'});
    if(!interactionWritableScope(x)) return json(res,403,{message:'تعامل خارج از محدودهٔ دسترسی شماست.'});
    if(!(authUser?.permissions??[]).includes('interaction.write')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «ثبت تعامل» (interaction.write) را ندارید.'});
    x.deletedAt=nowIso(); x.deletedById=authUser.id;
    audit(req,'DELETE','Interaction',x.id,'OK',{meta:{subject:x.subject,permanent:false,reason:'archive'}});
    saveDb();
    return json(res,200,{ok:true,id:x.id,deletedAt:x.deletedAt});
  }

  /* ----------------------------- notifications ----------------------------- */
  if(is('/notifications')&&method==='GET') return json(res,200,NOTIFICATIONS);
  if(is('/notifications/unread-count')&&method==='GET') return json(res,200,{count:NOTIFICATIONS.filter(n=>!n.isRead).length});
  if(is('/notifications/preferences')&&method==='GET') return json(res,200,{inAppEnabled:true,emailEnabled:true,pushEnabled:false,digestEnabled:false,criticalOnly:false,dailyDigest:false,weeklyDigest:false});
  if(is('/notifications/preferences')&&method==='PATCH'){ await readBody(req); return json(res,200,{ok:true}); }
  const notifRead=match('/notifications/:id/read');
  if(notifRead&&method==='PATCH'){
    const n=NOTIFICATIONS.find(x=>x.id===notifRead[0]);
    if(n) n.isRead=true;
    return json(res,200,{ok:true});
  }
  if(is('/notifications/read-all')&&method==='PATCH'){ NOTIFICATIONS.forEach(n=>n.isRead=true); return json(res,200,{ok:true}); }
  if(is('/notifications/delivery-log')&&method==='GET') return json(res,200,[]);
  if(match('/notifications/digest/:cadence')&&method==='POST') return json(res,200,{sent:false,reason:'empty'});

  /* ------------------------------ analytics ------------------------------ */
  /* موتور واقعی Analytics (پاریتی AnalyticsService): scope سازمانی، پنجرهٔ ۳۰روزه،
     شمارش از رویدادهای ذخیره‌شده، ثبت رویداد/نتیجه با مجوز analytics.write */
  const canAn=(perm)=>authUser?.isOwner||(authUser?.permissions??[]).includes(perm);
  const AN_READ_MSG='شما مجوز «تحلیل و هوشمندی» (analytics.read) را ندارید.';
  const AN_WRITE_MSG='شما مجوز «ثبت رویداد سنجش» (analytics.write) را ندارید.';
  const anScoped=(e,nullable)=>authUser?.isOwner?true:((e.organizationId==null||e.organizationId===undefined)?nullable:visibleOrgIds(req).includes(e.organizationId));
  const anEvents=(from,to,nullable)=> (DB.analyticsEvents??[]).filter(e=>anScoped(e,nullable)&&(!from||new Date(e.createdAt)>=from)&&(!to||new Date(e.createdAt)<to));
  const anPct=(num,den)=>den===0?0:Number(((num/den)*100).toFixed(2));

  if(is('/analytics/status')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    return json(res,200,{module:'analytics',status:'implemented',metrics:['activeUsers','featureUsage','recommendationAcceptance','successfulConnections','relationshipUpdates','organizations','people','relationships','meetings','actions','commitments','projects','opportunities','searches','notifications','workflowExecutions']});
  }
  if(is('/analytics/events')&&method==='POST'){
    if(!canAn('analytics.write')) return json(res,403,{message:AN_WRITE_MSG});
    const b=await readBody(req);
    if(!b||!b.type||!b.feature) return json(res,403,{message:'type و feature هر دو الزامی هستند.'});
    const orgId=b.organizationId??null;
    if(orgId&&!authUser?.isOwner&&!visibleOrgIds(req).includes(orgId)) return json(res,403,{message:'دسترسی به سازمان موردنظر (organizationId) را ندارید.'});
    const ev={id:`ae-${crypto.randomUUID().slice(0,8)}`,userId:authUser.id,type:String(b.type),feature:String(b.feature),organizationId:orgId,metadata:b.metadata??null,createdAt:nowIso()};
    DB.analyticsEvents=DB.analyticsEvents??[];
    DB.analyticsEvents.push(ev);
    saveDb();
    return json(res,200,ev);
  }
  const anOutcome=match('/analytics/recommendations/:id/outcome');
  if(anOutcome&&method==='POST'){
    if(!canAn('analytics.write')) return json(res,403,{message:AN_WRITE_MSG});
    const b=await readBody(req);
    if(!b||!b.outcome||!String(b.outcome).trim()) return json(res,403,{message:'outcome الزامی است.'});
    const rec=RECS.find(x=>x.id===anOutcome[0]);
    if(!rec) return json(res,403,{message:'پیشنهاد یافت نشد.'});
    if(!authUser?.isOwner){
      const rel=rec.relationshipId?RELS.find(x=>x.id===rec.relationshipId):null;
      const ok=rel?(visibleOrgIds(req).includes(rel.sourceOrganizationId)||visibleOrgIds(req).includes(rel.targetOrganizationId)):true;
      if(!ok) return json(res,403,{message:'دسترسی به پیشنهاد یا رابطهٔ آن را ندارید.'});
    }
    const rel=rec.relationshipId?RELS.find(x=>x.id===rec.relationshipId):null;
    const ev={id:`ae-${crypto.randomUUID().slice(0,8)}`,userId:authUser.id,type:'RECOMMENDATION_OUTCOME',feature:'recommendation_funnel',organizationId:rel?.sourceOrganizationId??null,metadata:{recommendationId:rec.id,domainEventId:`de-${crypto.randomUUID().slice(0,8)}`,outcome:String(b.outcome).trim(),outcomeValue:b.outcomeValue??null},createdAt:nowIso()};
    DB.analyticsEvents=DB.analyticsEvents??[];
    DB.analyticsEvents.push(ev);
    saveDb();
    return json(res,200,{recorded:true,eventId:ev.id,recommendationId:rec.id,outcome:String(b.outcome).trim()});
  }
  if(is('/analytics/summary')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    const from=new Date(Date.now()-30*86400000);
    const ev30=anEvents(from,null,true);
    const ev30Org=anEvents(from,null,false);
    const feat=new Map();
    for(const e of ev30){ if(e.type==='FEATURE_VIEWED'&&e.feature) feat.set(e.feature,(feat.get(e.feature)??0)+1); }
    const featureUsage=[...feat.entries()].map(([feature,count])=>({feature,count})).sort((a,b)=>b.count-a.count).slice(0,20);
    const activeUsers30d=new Set(ev30.map(e=>e.userId)).size;
    const typeCnt=(t)=>ev30Org.filter(e=>e.type===t).length;
    const wfRows=DB.workflowExecutions??[];
    const wfScoped=wfRows.filter(w=>w.organizationId!=null&&w.organizationId!==undefined);
    const workflowExecutions=wfScoped.length?wfScoped.filter(w=>anScoped({organizationId:w.organizationId},false)).length:wfRows.length;
    return json(res,200,{
      generatedAt:nowIso(),windowDays:30,cached:false,
      counts:{organizations:scopedOrgs(req).length,people:scopedPeople(req).length,relationships:scopedRels(req).length,meetings:scopedMeetings(req).length,actions:scopedActions(req).length,commitments:scopedCommitments(req).length,projects:scopedProjects(req).length,opportunities:scopedOpps(req).length,notifications:NOTIFICATIONS.length,unreadNotifications:NOTIFICATIONS.filter(n=>!n.isRead).length,workflowExecutions},
      engagement:{activeUsers30d,featureUsage,recommendationAcceptance:typeCnt('RECOMMENDATION_ACCEPTED'),recommendationAcceptanceRate:0,successfulConnections:typeCnt('SUCCESSFUL_CONNECTION'),relationshipUpdates:typeCnt('RELATIONSHIP_UPDATED')},
    });
  }
  if(is('/analytics/network')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    const qOrg=q.get('organizationId')??null;
    let global=authUser?.isOwner??false;
    let orgIds=global?null:visibleOrgIds(req);
    if(qOrg){
      if(orgIds&&!orgIds.includes(qOrg)) return json(res,403,{message:'دسترسی به سازمان موردنظر (organizationId) را ندارید.'});
      orgIds=[qOrg]; global=false;
    }
    const orgSet=new Set(orgIds??[]);
    const rels=orgIds?RELS.filter(r=>!r.deletedAt&&(orgSet.has(r.sourceOrganizationId)||orgSet.has(r.targetOrganizationId))):RELS.filter(r=>!r.deletedAt);
    const people=orgIds?PEOPLE.filter(p=>!p.deletedAt&&orgSet.has(p.organizationId)):PEOPLE.filter(p=>!p.deletedAt);
    const opps=orgIds?OPPORTUNITIES.filter(o=>!o.deletedAt&&orgSet.has(o.organizationId)):OPPORTUNITIES.filter(o=>!o.deletedAt);
    const avg=(fn)=>rels.length?Math.round(rels.reduce((s,r)=>s+fn(r),0)/rels.length):0;
    const quality=avg(r=>r.healthScore??0);
    const influence=avg(r=>r.influenceScore??0);
    const strategicValue=avg(r=>r.strategicScore??0);
    const opportunityPotential=avg(r=>r.opportunityScore??0);
    const resilience=avg(r=>r.resilienceScore??0);
    const risk=avg(r=>r.riskScore??0);
    const engagement=avg(r=>Math.round(((r.healthScore??0)+(r.influenceScore??0)+(r.opportunityScore??0))/3));
    const covered=new Set();
    for(const r of rels){ if(r.sourceOrganizationId) covered.add(r.sourceOrganizationId); if(r.targetOrganizationId) covered.add(r.targetOrganizationId); }
    const organizationsCovered=covered.size;
    const coverage=global?0:Math.min(100,Math.round(organizationsCovered/Math.max(1,(orgIds??[]).length)*100));
    const diversity=rels.length?Math.min(100,Math.round(organizationsCovered/rels.length*100)):0;
    const riskAdjusted=100-risk;
    const components={relationshipQuality:quality,influence,strategicValue,opportunityPotential,resilience,coverage,diversity,engagement,riskAdjusted};
    const avgN=(arr)=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const capital=Math.round(avgN([quality,influence,strategicValue,opportunityPotential,resilience,coverage,diversity,engagement,riskAdjusted]));
    const sri=Math.round(avgN([coverage,quality,influence,opportunityPotential,resilience]));
    const weightedOpportunityValue=opps.length?Math.round(opps.reduce((s,o)=>s+(Number(o.value)||0),0)*(opps.reduce((s,o)=>s+(Number(o.probability)||0),0)/opps.length)/100):0;
    const refs=orgIds?REFERRALS.filter(r=>(r.sourceOrganizationId&&orgSet.has(r.sourceOrganizationId))||(r.targetOrganizationId&&orgSet.has(r.targetOrganizationId))):REFERRALS;
    const successful=refs.filter(r=>r.status==='COMPLETED').length;
    return json(res,200,{
      generatedAt:nowIso(),organizationId:qOrg??null,relationshipCount:rels.length,peopleCount:people.length,opportunityCount:opps.length,
      networkCapital:{score:capital,components},
      strategicRelationshipIndex:{score:sri,breakdown:{coverage,strength:quality,influence,opportunity:opportunityPotential,resilience}},
      relationshipResilienceScore:resilience,weightedOpportunityValue,
      referralSuccessRate:{total:refs.length,successful,rate:anPct(successful,refs.length)},bounded:true,
    });
  }
  if(is('/analytics/workflows')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    const wfRows=DB.workflowExecutions??[];
    const visible=wfRows.filter(w=>w.workflowId&&((DB.workflows??[]).find(x=>x.id===w.workflowId)?.organizationId==null||anScoped({organizationId:(DB.workflows??[]).find(x=>x.id===w.workflowId)?.organizationId??null},true)));
    const counts={};
    for(const e of visible) counts[e.status]=(counts[e.status]??0)+1;
    return json(res,200,{generatedAt:nowIso(),executions:Object.entries(counts).map(([status,count])=>({status,count}))});
  }
  if(is('/analytics/recommendations/funnel')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    const to=q.get('to')?new Date(q.get('to')):new Date();
    const from=q.get('from')?new Date(q.get('from')):new Date(to.getTime()-30*86400000);
    if(from>=to) return json(res,403,{message:'بازهٔ زمانی سنجش نامعتبر است (from باید پیش از to باشد).'});
    const sets={viewed:new Set(),accepted:new Set(),actionCreated:new Set(),actionCompleted:new Set(),outcome:new Set()};
    for(const e of anEvents(from,to,false)){
      if(e.feature!=='recommendation_funnel') continue;
      const rid=e.metadata&&e.metadata.recommendationId; if(!rid) continue;
      const key=e.type==='RECOMMENDATION_VIEWED'?'viewed':e.type==='RECOMMENDATION_ACCEPTED'?'accepted':e.type==='RECOMMENDATION_ACTION_CREATED'?'actionCreated':e.type==='RECOMMENDATION_ACTION_COMPLETED'?'actionCompleted':e.type==='RECOMMENDATION_OUTCOME'?'outcome':null;
      if(key) sets[key].add(rid);
    }
    const stages=Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.size]));
    const viewed=stages.viewed,accepted=stages.accepted,actionCreated=stages.actionCreated,actionCompleted=stages.actionCompleted,outcome=stages.outcome;
    return json(res,200,{generatedAt:nowIso(),from:from.toISOString(),to:to.toISOString(),stages,
      conversion:{viewedToAcceptedPct:anPct(accepted,viewed),acceptedToActionCreatedPct:anPct(actionCreated,accepted),actionCreatedToCompletedPct:anPct(actionCompleted,actionCreated),completedToOutcomePct:anPct(outcome,actionCompleted)},
      overall:{acceptedPct:anPct(accepted,viewed),actionCreatedPct:anPct(actionCreated,viewed),actionCompletedPct:anPct(actionCompleted,viewed),outcomePct:anPct(outcome,viewed)},
    });
  }
  /* -------------------------------- AI -------------------------------- */
  if(is('/ai/status')) return json(res,200,{
    module:'ai',status:'deterministic-gateway-ready',provider:'deterministic',
    capabilities:['smart-search','meeting-brief','meeting-summary','action-extraction','commitment-extraction','risk-detection','opportunity-detection','next-best-action','executive-brief','evidence'],
    safeguards:['authentication','permission-aware-retrieval','audit','human-confirmation','no-external-model'],
  });
  if(is('/ai/provider-health')) return json(res,200,{ok:false,provider:'external-not-configured',detail:'تماس به مدل خارجی ساخته نشده؛ همهٔ پردازش‌ها روی موتور قطعی داخلی انجام می‌شود.'});
  if(is('/ai/usage')) return json(res,200,AI_USAGE);
  if(is('/ai/query')&&method==='POST'){
    const b=await readBody(req);
    if(!b.query?.trim()) return json(res,400,{message:'متن پرس‌وجو خالی است.'});
    const intent=b.intent??'SMART_SEARCH';
    const resp=aiQuery(req,intent,b.query);
    const payload={...resp,usage:{queries:++AI_USAGE._count._all,intent}};
    AI_USAGE._count.byIntent[intent]=(AI_USAGE._count.byIntent[intent]??0)+1;
    AI_USAGE._sum.inputChars+=(b.query??'').length;
    AI_USAGE._sum.outputChars+=JSON.stringify(resp).length;
    return json(res,200,payload);
  }
  if(is('/ai/executive-brief')) return json(res,200,executiveBrief(req,q.get('weekStart')||undefined));


  /* --------------------------- recommendations --------------------------- */
  if(is('/recommendations/status')) return json(res,200,{module:'recommendations',status:'implemented',types:Object.keys(TYPE_KEYS),humanApproval:true,explainability:true});
  if(is('/recommendations')&&method==='GET'){
    let list=scopedRecs(req);
    if(q.get('status')) list=list.filter(r=>r.status===q.get('status'));
    if(q.get('type')) list=list.filter(r=>r.type===q.get('type'));
    return json(res,200,list.map(r=>({...r,relationship:RELS.find(x=>x.id===r.relationshipId)?relWithOrgs(RELS.find(x=>x.id===r.relationshipId)):null})));
  }
  if(is('/recommendations/generate')&&method==='POST'){
    const before=RECS.length;
    const now=Date.now();
    for(const r of scopedRels(req)){
      const daysSince=r.lastInteractionAt?(now-new Date(r.lastInteractionAt).getTime())/86400000:365;
      const hasFollowUp=!!r.nextActionAt&&new Date(r.nextActionAt).getTime()<=now;
      if((hasFollowUp||daysSince>=60)&&!RECS.some(x=>x.relationshipId===r.id&&x.type==='FOLLOW_UP'&&['PROPOSED','ASSIGNED','SNOOZED','APPROVED'].includes(x.status))){
        RECS.unshift({id:`rec-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type:'FOLLOW_UP',title:`پیگیری رابطه با ${orgById(r.targetOrganizationId)?.name}`,rationale:hasFollowUp?'اقدام بعدی موعدش رسیده است.':`آخرین تعامل ${Math.round(daysSince)} روز پیش ثبت شده است.`,confidence:Math.round(55+Math.min(35,daysSince/4)+(hasFollowUp?10:0)),status:'PROPOSED',evidence:{daysSinceLastInteraction:Math.round(daysSince),nextActionAt:r.nextActionAt},relationshipId:r.id,userId:'u-1',createdAt:nowIso()});
      }
    }
    if(RECS.length>before) NOTIFICATIONS.unshift({id:`n-${Date.now()}`,title:'پیشنهاد هوشمند جدید',body:`${RECS.length-before} پیشنهاد جدید بر اساس روابط و تعاملات تولید شد.`,type:'RECOMMENDATION',priority:'recommendation',isRead:false,createdAt:nowIso()});
    return json(res,200,{generated:RECS.length-before,recommendations:[],candidateTypes:Object.keys(TYPE_KEYS)});
  }
  const recAction = path.match(new RegExp(`^${V1}/recommendations/([^/]+)/(approve|reject|snooze|execute)$`));
  if(recAction && method==='POST'){
    const rec=RECS.find(x=>x.id===recAction[1]);
    if(!rec) return json(res,404,{message:'پیشنهاد یافت نشد'});
    const action=recAction[2];
    if(action==='approve'){ rec.status='APPROVED'; rec.decisionAt=nowIso(); rec.snoozedUntil=null; audit(req,'APPROVE','recommendation',rec.id,'OK'); NOTIFICATIONS.unshift({id:`n-${Date.now()}`,title:'پیشنهاد تأیید شد',body:`«${rec.title}» تأیید شد و آمادهٔ اجراست.`,type:'RECOMMENDATION',priority:'information',isRead:false,createdAt:nowIso()}); return json(res,200,rec); }
    if(action==='reject'){ rec.status='REJECTED'; rec.decisionAt=nowIso(); audit(req,'REJECT','recommendation',rec.id,'OK'); return json(res,200,rec); }
    if(action==='snooze'){
      const b=await readBody(req);
      if(!b.until||new Date(b.until).getTime()<=Date.now()) return json(res,400,{message:'Snooze time must be in the future'});
      rec.status='SNOOZED'; rec.snoozedUntil=b.until; return json(res,200,rec);
    }
    if(action==='execute'){
      if(rec.status!=='APPROVED') return json(res,400,{message:'Recommendation must be approved before execution'});
      rec.status='EXECUTED'; rec.decisionAt=nowIso();
      const actionId=`a-${Date.now()}`;
      ACTIONS.push({id:actionId,title:rec.title,status:'OPEN',priority:rec.type==='RISK_MITIGATION'?'HIGH':'MEDIUM',dueAt:new Date(Date.now()+7*86400000).toISOString(),ownerId:'p-1',relationshipId:rec.relationshipId});
      audit(req,'EXECUTE','recommendation',rec.id,'OK',{actionId});
      NOTIFICATIONS.unshift({id:`n-${Date.now()}`,title:'اقدام از پیشنهاد ایجاد شد',body:`اقدام «${rec.title}» ایجاد شد (۷ روز مهلت).`,type:'SYSTEM',priority:'important',isRead:false,createdAt:nowIso()});
      return json(res,200,{recommendation:rec,action:{id:actionId,title:rec.title}});
    }
  }
  const recExplain=match('/recommendations/:id/explain');
  if(recExplain&&method==='GET'){
    const rec=RECS.find(x=>x.id===recExplain[0]);
    if(!rec) return json(res,404,{message:'پیشنهاد یافت نشد'});
    if(rec.relationshipId&&!relInScope(req,RELS.find(r=>r.id===rec.relationshipId))) return json(res,403,{message:'دسترسی به این پیشنهاد مجاز نیست.'});
    return json(res,200,{id:rec.id,type:rec.type,confidence:rec.confidence,reason:rec.rationale,evidence:rec.evidence,relationshipId:rec.relationshipId,status:rec.status,explainability:{factors:rec.evidence,decision:rec.rationale,humanApprovalRequired:true}});
  }
  const recId=match('/recommendations/:id');
  if(recId&&method==='GET'){
    const rec=RECS.find(x=>x.id===recId[0]);
    if(!rec) return json(res,404,{message:'پیشنهاد یافت نشد'});
    if(rec.relationshipId&&!relInScope(req,RELS.find(r=>r.id===rec.relationshipId))) return json(res,403,{message:'دسترسی به این پیشنهاد مجاز نیست.'});
    return json(res,200,{...rec,relationship:RELS.find(x=>x.id===rec.relationshipId)?relWithOrgs(RELS.find(x=>x.id===rec.relationshipId)):null});
  }

  /* ------------------------------- search ------------------------------- */
  if(is('/search')&&method==='GET'){
    const term=(q.get('q')??'').trim().toLowerCase();
    const type=q.get('type')??'';
    const results=[];
    if(!type||type==='organization') scopedOrgs(req).filter(o=>o.name.toLowerCase().includes(term)).forEach(o=>results.push({id:o.id,type:'organization',title:o.name,subtitle:o.type,url:`/organizations/${o.id}`,score:term?90:70}));
    if(!type||type==='person') scopedPeople(req).filter(p=>`${p.firstName} ${p.lastName}`.toLowerCase().includes(term)).forEach(p=>results.push({id:p.id,type:'person',title:`${p.firstName} ${p.lastName}`,subtitle:p.title??'',url:`/people/${p.id}`,score:term?85:65}));
    if(!type||type==='meeting') scopedMeetings(req).filter(m=>m.title.toLowerCase().includes(term)).forEach(m=>results.push({id:m.id,type:'meeting',title:m.title,subtitle:m.objective??'',url:`/meetings/${m.id}`,score:term?88:60}));
    if(!type||type==='relationship') scopedRels(req).forEach(r=>{const src=orgById(r.sourceOrganizationId)?.name,tgt=orgById(r.targetOrganizationId)?.name;if(src&&src.toLowerCase().includes(term)||tgt&&tgt.toLowerCase().includes(term))results.push({id:r.id,type:'relationship',title:`${src} ↔ ${tgt}`,subtitle:r.status,url:`/relationships/${r.id}`,score:75});});
    if(!type||type==='interaction') scopedInteractions(req).filter(x=>x.subject.toLowerCase().includes(term)||(x.outcome??'').toLowerCase().includes(term)).forEach(x=>results.push({id:x.id,type:'interaction',title:x.subject,subtitle:x.outcome??x.type??'',url:`/interactions`,score:70}));
    if(!type||type==='project') scopedProjects(req).filter(p=>p.name.toLowerCase().includes(term)).forEach(p=>results.push({id:p.id,type:'project',title:p.name,subtitle:p.status??'',url:`/projects/${p.id}`,score:72}));
    if(!type||type==='opportunity') scopedOpps(req).filter(o=>o.name.toLowerCase().includes(term)).forEach(o=>results.push({id:o.id,type:'opportunity',title:o.name,subtitle:o.status??'',url:`/opportunities/${o.id}`,score:72}));
    if(!type||type==='commitment') scopedCommitments(req).filter(c=>c.description.toLowerCase().includes(term)).forEach(c=>results.push({id:c.id,type:'commitment',title:c.description,subtitle:c.status??'',url:`/commitments`,score:68}));
    return json(res,200,{query:q.get('q'),results,count:results.length});
  }
  if(is('/search/saved')&&method==='GET') return json(res,200,[]);
  if(is('/search/saved')&&method==='POST'){ await readBody(req); return json(res,201,{id:`sv-${Date.now()}`}); }
  if(match('/search/saved/:id')&&method==='PATCH'){ await readBody(req); return json(res,200,{ok:true}); }
  if(match('/search/saved/:id')&&method==='DELETE') return json(res,200,{ok:true});
  if(match('/search/saved/:id/run')&&method==='POST'){ const b=await readBody(req); return json(res,200,{q:b.name??'search',results:[],count:0}); }

  /* ------------------------------ network ------------------------------ */
  if(is('/network/graph')&&method==='GET'){
    const term=(q.get('q')??'').toLowerCase();
    const typeFilter=q.get('type')??'all';
    const wantOrg=typeFilter==='all'||typeFilter==='organization';
    const wantPerson=typeFilter==='all'||typeFilter==='person';
    const orgNodes=[]; const personNodes=[];
    const rels=scopedRels(req).slice(0,12).filter(r=>!q.get('status')||r.status===q.get('status'));
    // org nodes: in-scope orgs + counterparty orgs of visible relationships
    const relOrgIds=new Set();
    rels.forEach(r=>{relOrgIds.add(r.sourceOrganizationId);relOrgIds.add(r.targetOrganizationId);});
    ORGS.forEach(o=>{
      const visible=inScope(req,o.id)||relOrgIds.has(o.id);
      if(!visible||!wantOrg) return;
      if(term&&!o.name.toLowerCase().includes(term)) return;
      orgNodes.push({id:`org:${o.id}`,label:o.name,type:'organization',organizationId:o.id});
    });
    scopedPeople(req).forEach(p=>{
      if(!wantPerson) return;
      if(term&&!`${p.firstName} ${p.lastName}`.toLowerCase().includes(term)) return;
      personNodes.push({id:`person:${p.id}`,label:`${p.firstName} ${p.lastName}`,type:'person',organizationId:p.organizationId});
    });
    const nodes=[...orgNodes,...personNodes];
    const nodeIds=new Set(nodes.map(n=>n.id));
    const edges=[];
    rels.forEach(r=>{
      const s=`org:${r.sourceOrganizationId}`,t=`org:${r.targetOrganizationId}`;
      if(!nodeIds.has(s)||!nodeIds.has(t)) return;
      edges.push({id:`e-${r.id}`,source:s,target:t,kind:'relationship',weight:Math.round(30+(r.healthScore??50)/2),risk:r.riskScore??0,strategicImportance:r.strategicScore??50,status:r.status,health:r.healthScore});
    });
    scopedPeople(req).forEach(p=>{
      const pid=`person:${p.id}`,oid=`org:${p.organizationId}`;
      if(!nodeIds.has(pid)||!nodeIds.has(oid)) return;
      edges.push({id:`pm-${p.id}`,source:pid,target:oid,kind:'membership',weight:15,risk:0,strategicImportance:0});
    });
    // person↔person edges derived from shared meeting participation
    const personEdges=new Set();
    MEETINGS.forEach(m=>{
      const parts=(m.participants??[]).map((x)=>`person:${x.personId}`).filter((pid)=>nodeIds.has(pid));
      for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
        const key=[parts[i],parts[j]].sort().join('|');
        if(personEdges.has(key))continue;
        personEdges.add(key);
        edges.push({id:`pp-${m.id}-${i}-${j}`,source:parts[i],target:parts[j],kind:'person_relationship',weight:12,risk:0,strategicImportance:35});
      }
    });
    return json(res,200,{nodes,edges,total:nodes.length,nextCursor:null,page:{limit:Number(q.get('limit'))||250,nextCursor:null,bounded:true},meta:{
      organizationCount:orgNodes.length,
      peopleCount:personNodes.length,
      projectCount:0,
      relationshipCount:rels.length,
      personRelationshipCount:0,
    }});
  }
  if(is('/network/path')&&method==='GET') return json(res,200,{path:null,hops:0});
  if(is('/network/connectors')&&method==='GET') return json(res,200,{connectors:[],count:0});
  if(match('/network/:endpoint')&&method==='GET') return json(res,200,{count:0,items:[]});

  /* ----------------------------- documents ----------------------------- */
  if(is('/documents')&&method==='GET') return json(res,200,[]);
  if(is('/documents/status')&&method==='GET') return json(res,200,{total:0,indexed:0,pending:0});

  /* ----------------------------- intelligence ----------------------------- */
  /* موتور تحلیلی: همهٔ خروجی‌ها از دادهٔ جاریِ محدودهٔ کاربر محاسبه می‌شود */
  const intelEngine=(req)=>{
    const now=Date.now();
    const rels=scopedRels(req).map(r=>({...r,
      srcName:orgById(r.sourceOrganizationId)?orgById(r.sourceOrganizationId).name:'—',
      dstName:orgById(r.targetOrganizationId)?orgById(r.targetOrganizationId).name:'—'}));
    const relName=(r)=>`${r.srcName} ↔ ${r.dstName}`;
    const relIds=new Set(rels.map(r=>r.id));
    const orgIds=new Set(); rels.forEach(r=>{orgIds.add(r.sourceOrganizationId);orgIds.add(r.targetOrganizationId);});
    const acts=ACTIONS.filter(a=>a.relationshipId&&relIds.has(a.relationshipId));
    const coms=COMMITMENTS.filter(c=>c.relationshipId&&relIds.has(c.relationshipId));
    const mtgs=scopedMeetings(req);
    const isLate=(d)=>!!d&&new Date(d).getTime()<now;
    const OPEN_ACT=['OPEN','IN_PROGRESS','BLOCKED'];
    const OPEN_COM=['OPEN','OVERDUE'];
    const CLOSED_ACT=['DONE','COMPLETED','CANCELLED'];
    const daysBetween=(iso)=>iso?Math.max(0,Math.floor((now-new Date(iso).getTime())/86400000)):null;

    /* ---- ۱) سیگنال‌های ریسک: شواهد عینی از اقدامات/تعهدات/جلسات/رابطه ---- */
    const riskSignals=[];
    for(const r of rels){
      const evidence=[];
      acts.filter(a=>a.relationshipId===r.id&&['OPEN','IN_PROGRESS'].includes(a.status)&&isLate(a.dueAt)).forEach(a=>evidence.push({type:'ACTION_OVERDUE',refId:a.id,title:a.title,at:a.dueAt}));
      coms.filter(c=>c.relationshipId===r.id&&c.status==='OPEN'&&isLate(c.dueAt)).forEach(c=>evidence.push({type:'COMMITMENT_OVERDUE',refId:c.id,title:c.description,at:c.dueAt}));
      acts.filter(a=>a.relationshipId===r.id&&a.status==='BLOCKED').forEach(a=>evidence.push({type:'ACTION_BLOCKED',refId:a.id,title:a.title,at:null}));
      coms.filter(c=>c.relationshipId===r.id&&c.status==='OVERDUE').forEach(c=>evidence.push({type:'COMMITMENT_OVERDUE',refId:c.id,title:c.description,at:c.dueAt}));
      if(r.status==='WATCH') evidence.push({type:'RELATIONSHIP_WATCH',refId:r.id,title:'رابطه در وضعیت «تحت نظر» قرار دارد',at:null});
      if(r.healthScore<45) evidence.push({type:'LOW_HEALTH',refId:r.id,title:`سلامت رابطه ${r.healthScore} از ۱۰۰ — زیر آستانهٔ ۴۵`,at:null});
      const stale=daysBetween(r.lastInteractionAt);
      if(stale!=null&&stale>30) evidence.push({type:'STALE_INTERACTION',refId:r.id,title:`آخرین تعامل ${stale} روز پیش بوده است`,at:r.lastInteractionAt});
      if(!evidence.length) continue;
      const overdue=evidence.filter(x=>x.type==='COMMITMENT_OVERDUE'||x.type==='ACTION_OVERDUE').length;
      let severity=r.riskScore>=60?'HIGH':r.riskScore>=40?'MEDIUM':'LOW';
      if(overdue>=2) severity='HIGH';
      else if(overdue===1&&severity==='LOW') severity='MEDIUM';
      const sevLabel=severity==='HIGH'?'ریسک بالا':severity==='MEDIUM'?'ریسک متوسط':'نیازمند توجه';
      const desc=[...new Set(evidence.slice(0,3).map(x=>x.title))].join('؛ ');
      riskSignals.push({id:`sig-${r.id}`,title:`${sevLabel}: ${relName(r)}`,severity,relationshipId:r.id,description:desc,detectedAt:nowIso(),
        relationship:{id:r.id,name:relName(r)},
        scores:{riskScore:r.riskScore,healthScore:r.healthScore,resilienceScore:r.resilienceScore},
        evidence:evidence.slice(0,6)});
    }
    riskSignals.sort((a,b)=>({HIGH:3,MEDIUM:2,LOW:1}[a.severity]??0)<({HIGH:3,MEDIUM:2,LOW:1}[b.severity]??0)?1:-1);

    /* ---- ۲) کشف فرصت: فرصت‌های باز واقعی + پیشنهاد رشد از روابط بی‌فرصت ---- */
    const opps=scopedOpps(req).filter(o=>!['WON','LOST'].includes(o.status));
    const maxV=Math.max(1,...opps.map(o=>o.value??0));
    const tracking=opps.map(o=>{
      const valueScore=Math.min(100,Math.round(((o.value??0)/maxV)*100));
      const score=Math.round(0.5*(o.probability??0)+0.5*valueScore);
      const rel=o.relationshipId?rels.find(x=>x.id===o.relationshipId):null;
      return {id:`t-${o.id}`,type:'TRACKING',title:o.name,opportunityId:o.id,relationshipId:o.relationshipId??null,relationshipName:rel?relName(rel):null,
        score,probability:o.probability??0,value:o.value??null,expectedValue:o.expectedValue??null,stage:o.status,detectedAt:o.createdAt,
        reason:`احتمال ${o.probability??0}٪ و ارزش موزون ${o.expectedValue!=null?Math.round(o.expectedValue/1e9*10)/10+' میلیارد تومان':'—'}`};
    });
    const growth=rels.filter(r=>(r.opportunityScore??0)>=60&&!opps.some(o=>o.relationshipId===r.id)).map(r=>{
      const sideName=r.dstName==='آریا فناوری'?r.srcName:r.dstName;
      return {id:`g-${r.id}`,type:'GROWTH',title:`فرصت رشد: ${relName(r)}`,relationshipId:r.id,relationshipName:relName(r),opportunityId:null,
        score:r.opportunityScore??0,probability:null,value:null,expectedValue:null,stage:null,detectedAt:r.lastInteractionAt??nowIso(),
        reason:`امتیاز فرصت رابطه ${r.opportunityScore} از ۱۰۰ و هیچ فرصت بازی در جریان نیست؛ طرفِ پیشنهادی: ${sideName}`};
    });
    const opportunities=[...tracking].sort((a,b)=>b.score-a.score).concat([...growth].sort((a,b)=>b.score-a.score));

    /* ---- ۳) پوشش راهبردی: روابط استراتژیک و شکاف‌های پوشش عملیاتی ---- */
    const strategic=rels.filter(r=>(r.strategicScore??0)>=60);
    const rows=strategic.map(r=>{
      const openActs=acts.filter(a=>a.relationshipId===r.id&&OPEN_ACT.includes(a.status)&&!CLOSED_ACT.includes(a.status));
      const openComs=coms.filter(c=>c.relationshipId===r.id&&OPEN_COM.includes(c.status));
      const futureNext=r.nextActionAt&&!isLate(r.nextActionAt);
      const covered=openActs.length>0||openComs.length>0||!!futureNext;
      const gaps=[];
      if(!openActs.length&&!openComs.length&&!futureNext) gaps.push({type:'NO_OPEN_ITEMS',title:'اقدام یا تعهد بازی ندارد و موعد بعدی ثبت نشده است'});
      if((r.healthScore??0)<60) gaps.push({type:'LOW_HEALTH',title:`سلامت ${r.healthScore} زیر آستانهٔ ۶۰`});
      if(openComs.some(c=>c.status==='OVERDUE')) gaps.push({type:'OVERDUE_COMMITMENT',title:'تعهد عقب‌افتاده دارد'});
      return {id:r.id,name:relName(r),status:r.status,strategicScore:r.strategicScore,healthScore:r.healthScore,
        resilienceScore:r.resilienceScore,riskScore:r.riskScore,opportunityScore:r.opportunityScore,
        covered,coverageGaps:gaps,openActions:openActs.length,openCommitments:openComs.length,
        nextActionAt:r.nextActionAt??null};
    });
    const coveredCount=rows.filter(r=>r.covered).length;
    const coverage={
      coveragePercent:strategic.length?Math.round(coveredCount/strategic.length*100):0,
      coverage:Math.round(coveredCount/strategic.length*100),
      total:strategic.length,
      covered:coveredCount,
      strategicRelationships:strategic.length,
      coveredStrategicRelationships:coveredCount,
      healthyStrategicRelationships:strategic.filter(r=>(r.healthScore??0)>=60).length,
      resilientStrategicRelationships:strategic.filter(r=>(r.resilienceScore??0)>=60).length,
      scopeOrganizations:orgIds.size,
      bounded:false,
      relationships:rows.sort((a,b)=>a.covered-b.covered||(b.strategicScore??0)-(a.strategicScore??0)),
    };

    /* ---- ۴) هوشمندی شبکه: گراف واقعی روابط + گلوگاه‌ها/پل‌ها ---- */
    const nodes=[...orgIds].map(id=>{const o=orgById(id);return {id,name:o?o.name:id,type:o?o.type:null}});
    const adj=new Map([...orgIds].map(id=>[id,new Set()]));
    rels.forEach(r=>{adj.get(r.sourceOrganizationId).add(r.targetOrganizationId);adj.get(r.targetOrganizationId).add(r.sourceOrganizationId);});
    const countComponents=(skip)=>{
      const seen=new Set();let comps=0;
      for(const id of orgIds){
        if(id===skip||seen.has(id))continue;
        comps++;const st=[id];seen.add(id);
        while(st.length){const v=st.pop();for(const nb of adj.get(v)??[]){if(nb===skip||seen.has(nb))continue;seen.add(nb);st.push(nb);}}
      }
      return comps;
    };
    const baseComps=countComponents(null);
    const centrality=[...orgIds].map(id=>({node:{id,name:orgById(id)?orgById(id).name:id},degree:adj.get(id).size}))
      .sort((a,b)=>b.degree-a.degree);
    const articulation=[];
    for(const id of orgIds){
      const diff=countComponents(id)-baseComps;
      if(diff>0) articulation.push({node:{id,name:orgById(id)?orgById(id).name:id},bottleneckScore:diff,fragmentationIncrease:diff,
        riskyConnections:rels.filter(r=>r.sourceOrganizationId===id||r.targetOrganizationId===id).filter(r=>(r.riskScore??0)>=50).length});
    }
    articulation.sort((a,b)=>b.bottleneckScore-a.bottleneckScore);
    /* افراد پل: حضور در جلساتِ سازمان‌های دیگر */
    const bridgeMap=new Map();
    for(const m of mtgs){
      if(!m.organizationId)continue;
      for(const p of m.participants??[]){
        const person=personById(p.personId);if(!person)continue;
        if(person.organizationId===m.organizationId||!orgIds.has(m.organizationId))continue;
        const rec=bridgeMap.get(person.id)??{person:{id:person.id,name:`${person.firstName} ${person.lastName}`,organization:orgById(person.organizationId)?orgById(person.organizationId).name:null},orgs:new Set()};
        rec.orgs.add(m.organizationId);bridgeMap.set(person.id,rec);
      }
    }
    const bridgePeople=[...bridgeMap.values()].map(x=>({person:x.person,bridgeScore:x.orgs.size,
      orgs:[...x.orgs].map(id=>({id,name:orgById(id)?orgById(id).name:id}))}))
      .sort((a,b)=>b.bridgeScore-a.bridgeScore);
    const network={nodes,edges:rels.length,centrality,bridgePeople,
      bottlenecks:articulation,
      singlePointsOfFailure:articulation.filter(x=>x.bottleneckScore>=2)};

    /* ---- ۵) نمای کلی ---- */
    const kpis={
      relationships:rels.length,
      organizations:nodes.length,
      avgHealth:rels.length?Math.round(rels.reduce((s,r)=>s+(r.healthScore??0),0)/rels.length):null,
      avgRisk:rels.length?Math.round(rels.reduce((s,r)=>s+(r.riskScore??0),0)/rels.length):null,
      avgOpportunity:rels.length?Math.round(rels.reduce((s,r)=>s+(r.opportunityScore??0),0)/rels.length):null,
      openActions:acts.filter(a=>!CLOSED_ACT.includes(a.status)).length,
      openCommitments:coms.filter(c=>OPEN_COM.includes(c.status)).length,
      lateCount:acts.filter(a=>['OPEN','IN_PROGRESS'].includes(a.status)&&isLate(a.dueAt)).length+coms.filter(c=>c.status==='OPEN'&&isLate(c.dueAt)).length,
    };
    return {generatedAt:nowIso(),kpis,riskSignals,opportunities,coverage,network};
  };
  if(is('/intelligence/overview')) return json(res,200,intelEngine(req));
  if(is('/intelligence/risk-signals')) return json(res,200,intelEngine(req).riskSignals);
  if(is('/intelligence/opportunity-detection')) return json(res,200,intelEngine(req).opportunities);
  if(is('/intelligence/strategic-coverage')) return json(res,200,intelEngine(req).coverage);
  if(is('/intelligence/network')) return json(res,200,intelEngine(req).network);

  /* ======================================================================
     Supplementary endpoints — complete UI coverage (no 404 for nav pages)
     ====================================================================== */

  /* ---- people CRUD ---- */
  if(is('/people')&&method==='POST'){
    const b=await readBody(req);
    if(!b.firstName?.trim()||!b.lastName?.trim()) return json(res,400,{message:'نام و نام خانوادگی لازم است.'});
    if(!b.organizationId||!inScope(req,b.organizationId)) return json(res,403,{message:'سازمان انتخاب‌شده در محدودهٔ دسترسی شما نیست.'});
    const p={id:`p-${Date.now()}`,firstName:b.firstName,lastName:b.lastName,email:b.email??null,phone:b.phone??null,title:b.title??null,department:b.department??null,organizationId:b.organizationId,status:'ACTIVE',influenceScore:b.influenceScore??60,decisionPower:b.decisionPower??50,accessibilityScore:b.accessibilityScore??60,country:b.country??'ایران'};
    PEOPLE.push(p);
    audit(req,'CREATE','person',p.id,'OK',{name:`${p.firstName} ${p.lastName}`});
    return json(res,201,{...p,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null});
  }

  /* ---- commitments CRUD ---- */
  if(is('/commitments')&&method==='POST'){
    const b=await readBody(req);
    if(!b.description?.trim()) return json(res,400,{message:'شرح تعهد لازم است.'});
    const rel=b.relationshipId?RELS.find(r=>r.id===b.relationshipId):null;
    if(b.relationshipId&&!rel) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'});
    const orgId=b.organizationId??(rel?rel.targetOrganizationId:'org-2');
    const orgReach=!orgId||inScope(req,orgId)||(rel&&relInScope(req,rel)&&(orgId===rel.targetOrganizationId||orgId===rel.sourceOrganizationId));
    if(!orgReach) return json(res,403,{message:'سازمان طرفِ تعهد در محدودهٔ دسترسی شما نیست.'});
    const c={id:`c-${Date.now()}`,description:b.description,dueAt:b.dueAt??null,reminderAt:b.reminderAt??null,status:b.status??'OPEN',risk:b.risk??'MEDIUM',direction:b.direction==='THEIRS'?'THEIRS':'OURS',notes:b.notes??null,organizationId:orgId,ownerId:b.ownerId??null,personId:b.personId??null,relationshipId:b.relationshipId??null,meetingId:b.meetingId??null,projectId:b.projectId??null,createdAt:nowIso(),fulfilledAt:b.status==='FULFILLED'?nowIso():null};
    COMMITMENTS.push(c);
    audit(req,'CREATE','commitment',c.id,'OK',{description:c.description});
    return json(res,201,commitmentView(c));
  }
  const commitmentId=match('/commitments/:id');
  if(commitmentId&&method==='GET'){
    const c=COMMITMENTS.find(x=>x.id===commitmentId[0]);
    if(!c) return json(res,404,{message:'تعهد یافت نشد'});
    if(!scopedCommitments(req).some(x=>x.id===c.id)) return json(res,403,{message:'دسترسی به این تعهد مجاز نیست.'});
    return json(res,200,commitmentView(c));
  }
  if(commitmentId&&method==='PATCH'){
    const c=COMMITMENTS.find(x=>x.id===commitmentId[0]);
    if(!c) return json(res,404,{message:'تعهد یافت نشد'});
    const b=await readBody(req);
    for(const k of ['ownerId','personId','meetingId','projectId'])
      if(b[k]===''||b[k]===null){ c[k]=null; delete b[k]; }
    if(b.relationshipId===''||b.relationshipId===null){ c.relationshipId=null; delete b.relationshipId; }
    if(b.organizationId===''||b.organizationId===null){ b.organizationId=undefined; }
    if(b.organizationId!==undefined){
      if(!inScope(req,b.organizationId)){
        const rel=RELS.find(r=>r.id===(b.relationshipId??c.relationshipId));
        if(!(rel&&relInScope(req,rel)&&(b.organizationId===rel.targetOrganizationId||b.organizationId===rel.sourceOrganizationId)))
          return json(res,403,{message:'سازمان طرفِ تعهد در محدودهٔ دسترسی شما نیست.'});
      }
      c.organizationId=b.organizationId; delete b.organizationId;
    } else if(b.relationshipId===undefined && c.organizationId===undefined && c.relationshipId){
      const rel=RELS.find(r=>r.id===c.relationshipId);
      if(rel) c.organizationId=rel.targetOrganizationId;
    }
    if(b.status&&b.status!==c.status){
      if(b.status==='FULFILLED'&&c.status!=='FULFILLED') c.fulfilledAt=nowIso();
      if(c.status==='FULFILLED'&&b.status!=='FULFILLED') c.fulfilledAt=null;
    }
    Object.assign(c,b);
    audit(req,'UPDATE','commitment',c.id,'OK',{description:c.description});
    return json(res,200,commitmentView(c));
  }
  if(commitmentId&&method==='DELETE'){
    const c=COMMITMENTS.find(x=>x.id===commitmentId[0]);
    if(!c) return json(res,404,{message:'تعهد یافت نشد'});
    COMMITMENTS=COMMITMENTS.filter(x=>x.id!==c.id);
    MEETINGS.forEach(m=>{ if(m.commitments) m.commitments=m.commitments.filter((x)=>x.id!==c.id&&x!==c.id); });
    audit(req,'DELETE','commitment',c.id,'OK',{description:c.description});
    return json(res,200,{ok:true});
  }
  const commOverdue=match('/commitments/:id/mark-overdue');
  if(commOverdue&&method==='POST'){
    const c=COMMITMENTS.find(x=>x.id===commOverdue[0]);
    if(!c) return json(res,404,{message:'تعهد یافت نشد'});
    c.status='OVERDUE';
    audit(req,'UPDATE','commitment',c.id,'OK',{status:'OVERDUE'});
    return json(res,200,commitmentView(c));
  }

  /* ---- interactions CRUD ---- */
  if(is('/interactions')&&method==='POST'){
    const b=await readBody(req);
    if(!String(b.subject??'').trim()) return json(res,400,{message:'موضوع تعامل لازم است.'});
    const type=String(b.type??'CALL').toUpperCase();
    if(!INTERACTION_KIND_LIST.includes(type)) return json(res,400,{message:`نوع «${b.type}» نامعتبر است (CALL/EMAIL/MEETING/NOTE/MESSAGE/OTHER).`});
    const importance=String(b.importance??'MEDIUM').toUpperCase();
    if(!PRIORITY_LIST.includes(importance)) return json(res,400,{message:`اهمیت «${b.importance}» نامعتبر است.`});
    if(b.sentiment!=null&&![ -1, 0, 1].includes(Number(b.sentiment))) return json(res,400,{message:'احساس باید یکی از مقادیر ‎-۱، ۰ یا ۱ باشد.'});
    if(!b.organizationId&&!b.relationshipId&&!b.personId) return json(res,403,{message:'تعامل باید به سازمان، رابطه یا شخص پیوند داشته باشد.'});
    if(b.relationshipId){ const r=RELS.find(x=>x.id===b.relationshipId); if(!r) return json(res,404,{message:'رابطه یافت نشد.'}); if(!relInScope(req,r)) return json(res,403,{message:'رابطه خارج از محدودهٔ دسترسی شماست.'}); }
    if(b.organizationId&&!inScope(req,b.organizationId)) return json(res,403,{message:'سازمان خارج از محدوده است.'});
    if(b.personId){ const p=personById(b.personId); if(!p) return json(res,404,{message:'شخص یافت نشد.'}); if(!inScope(req,p.organizationId)) return json(res,403,{message:'شخص خارج از محدوده است.'}); }
    if(!(authUser?.permissions??[]).includes('interaction.write')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «ثبت تعامل» (interaction.write) را ندارید.'});
    const rel=b.relationshipId?RELS.find(x=>x.id===b.relationshipId):null;
    const orgId=b.organizationId??(rel?rel.sourceOrganizationId:null)??(b.personId?personById(b.personId)?.organizationId??null:null)??null;
    const x={id:`i-${Date.now()}`,type,subject:String(b.subject).trim(),summary:b.summary??'',outcome:b.outcome??null,durationMinutes:b.durationMinutes?Number(b.durationMinutes):null,importance,followUpRequired:!!b.followUpRequired,followUpAt:b.followUpAt??null,sentiment:b.sentiment!=null?Number(b.sentiment):null,occurredAt:b.occurredAt??nowIso(),userId:authUser.id,organizationId:orgId,relationshipId:b.relationshipId??null,personId:b.personId??null};
    INTERACTIONS.unshift(x);
    audit(req,'CREATE','Interaction',x.id,'OK',{meta:{subject:x.subject,type:x.type,organizationId:orgId}});
    saveDb();
    return json(res,201,interactionCardView(x));
  }

  /* ---- opportunities CRUD ---- */
  if(is('/opportunities')&&method==='POST'){
    const b=await readBody(req);
    if(!b.name?.trim()) return json(res,400,{message:'نام فرصت لازم است.'});
    const rel=b.relationshipId?RELS.find(r=>r.id===b.relationshipId):null;
    if(b.relationshipId&&!rel) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'});
    const orgId=b.organizationId??(rel?rel.targetOrganizationId:'org-2');
    const orgReach=!orgId||inScope(req,orgId)||(rel&&relInScope(req,rel)&&(orgId===rel.targetOrganizationId||orgId===rel.sourceOrganizationId));
    if(!orgReach) return json(res,403,{message:'سازمانِ فرصت در محدودهٔ دسترسی شما نیست.'});
    const status=b.status??'IDENTIFIED';
    const o={id:`o-${Date.now()}`,name:b.name,description:b.description??null,status,probability:Math.max(0,Math.min(100,Number(b.probability)||0)),value:b.value==null?null:Number(b.value)||0,expectedDate:b.expectedDate??null,organizationId:orgId,relationshipId:b.relationshipId??null,projectId:b.projectId??null,ownerId:b.ownerId??null,createdAt:nowIso(),wonAt:status==='WON'?nowIso():null,lostAt:status==='LOST'?nowIso():null};
    OPPORTUNITIES.push(o);
    audit(req,'CREATE','opportunity',o.id,'OK',{name:o.name});
    return json(res,201,opportunityView(o));
  }
  const opportunityId=match('/opportunities/:id');
  if(opportunityId&&method==='GET'){
    const o=OPPORTUNITIES.find(x=>x.id===opportunityId[0]);
    if(!o) return json(res,404,{message:'فرصت یافت نشد'});
    if(!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    return json(res,200,opportunityView(o));
  }
  if(opportunityId&&method==='PATCH'){
    const o=OPPORTUNITIES.find(x=>x.id===opportunityId[0]);
    if(!o) return json(res,404,{message:'فرصت یافت نشد'});
    if(!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    const b=await readBody(req);
    for(const k of ['ownerId','projectId','description'])
      if(b[k]===''||b[k]===null){ o[k]=null; delete b[k]; }
    if(b.relationshipId===''||b.relationshipId===null){ o.relationshipId=null; delete b.relationshipId; }
    if(b.organizationId===''||b.organizationId===null) delete b.organizationId;
    if(b.organizationId!==undefined){
      if(!inScope(req,b.organizationId)) return json(res,403,{message:'سازمانِ فرصت در محدودهٔ دسترسی شما نیست.'});
      o.organizationId=b.organizationId; delete b.organizationId;
    }
    if(b.probability!==undefined){ o.probability=Math.max(0,Math.min(100,Number(b.probability)||0)); delete b.probability; }
    if(b.value!==undefined){ o.value=Number(b.value)||0; delete b.value; }
    if(b.status&&b.status!==o.status){
      if(b.status==='WON'){ o.wonAt=nowIso(); o.lostAt=null; if(b.probability===undefined) o.probability=100; }
      if(b.status==='LOST'){ o.lostAt=nowIso(); o.wonAt=null; if(b.probability===undefined) o.probability=0; }
      if(o.status==='WON'&&b.status!=='WON') o.wonAt=null;
      if(o.status==='LOST'&&b.status!=='LOST') o.lostAt=null;
    }
    Object.assign(o,b);
    audit(req,'UPDATE','opportunity',o.id,'OK',{name:o.name});
    return json(res,200,opportunityView(o));
  }
  if(opportunityId&&method==='DELETE'){
    const o=OPPORTUNITIES.find(x=>x.id===opportunityId[0]);
    if(!o) return json(res,404,{message:'فرصت یافت نشد'});
    if(!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    OPPORTUNITIES=OPPORTUNITIES.filter(x=>x.id!==o.id);
    audit(req,'DELETE','opportunity',o.id,'OK',{name:o.name});
    return json(res,200,{ok:true});
  }

  /* ---- actions detail ---- */
  const actionId=match('/actions/:id');
  const actionInScope=(a)=>a&&(!a.relationshipId||relInScope(req,RELS.find(r=>r.id===a.relationshipId)));
  const actionGuard=(id)=>{ const a=ACTIONS.find(x=>x.id===id); if(!a) return {code:404,msg:'اقدام یافت نشد'}; if(!actionInScope(a)) return {code:403,msg:'دسترسی به این اقدام مجاز نیست.'}; return {a}; };
  if(actionId&&method==='GET'){
    const g=actionGuard(actionId[0]); if(g.code) return json(res,g.code,{message:g.msg});
    return json(res,200,actionView(g.a));
  }
  if(actionId&&method==='PATCH'){
    const g=actionGuard(actionId[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const a=g.a;
    const b=await readBody(req);
    if(b.ownerId===''||b.ownerId===null){ a.ownerId=null; delete b.ownerId; }
    if(b.relationshipId===''||b.relationshipId===null){ a.relationshipId=null; delete b.relationshipId; }
    if(b.relationshipId){ const nr=RELS.find(r=>r.id===b.relationshipId); if(!nr) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'}); if(!relInScope(req,nr)) return json(res,403,{message:'رابطهٔ اقدام خارج از محدودهٔ دسترسی شماست.'}); }
    if(b.organizationId&&!inScope(req,b.organizationId)) return json(res,403,{message:'سازمانِ اقدام خارج از محدودهٔ دسترسی شماست.'});
    Object.assign(a,b);
    return json(res,200,actionView(a));
  }
  if(actionId&&method==='DELETE'){
    const g=actionGuard(actionId[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const idx=ACTIONS.findIndex(x=>x.id===actionId[0]);
    const [removed]=ACTIONS.splice(idx,1);
    ACTIONS.forEach(x=>{ if(x.dependencies) x.dependencies=x.dependencies.filter(d=>d!==removed.id); });
    audit(req,'DELETE','action',removed.id,'OK',{title:removed.title});
    return json(res,200,{ok:true});
  }
  const actionDep=match('/actions/:id/dependencies/:dep');
  if(actionDep&&(method==='POST'||method==='DELETE')){
    const g=actionGuard(actionDep[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const a=g.a;
    if(method==='POST'){
      const dep=ACTIONS.find(x=>x.id===actionDep[1]);
      if(!dep) return json(res,404,{message:'اقدام وابسته یافت نشد'});
      a.dependencies=a.dependencies??[];
      if(!a.dependencies.includes(actionDep[1])) a.dependencies.push(actionDep[1]);
      return json(res,200,actionView(a));
    }
    a.dependencies=(a.dependencies??[]).filter(d=>d!==actionDep[1]);
    return json(res,200,actionView(a));
  }

  /* ---- projects detail ---- */
  const projectNew=is('/projects')&&method==='POST';
  if(projectNew){
    const b=await readBody(req);
    if(!b.name?.trim()) return json(res,400,{message:'نام پروژه لازم است.'});
    const orgId=b.organizationId??'org-2';
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان پروژه در محدودهٔ دسترسی شما نیست.'});
    const pr={id:`pr-${Date.now()}`,name:b.name,status:b.status??'PLANNED',priority:b.priority??'MEDIUM',organizationId:orgId,description:b.description??null,objective:b.objective??null,ownerId:b.ownerId??null,startAt:b.startAt??null,targetAt:b.targetAt??null,endAt:null,createdAt:nowIso()};
    PROJECTS.push(pr);
    PROJECT_EXTRA[pr.id]={requirements:[],risks:[],milestones:[],relationships:[]};
    audit(req,'CREATE','project',pr.id,'OK',{name:pr.name});
    return json(res,201,projectView(pr));
  }
  /* الزامات پروژه */
  if(is('/projects/requirements')&&method==='POST'){
    const b=await readBody(req);
    if(!String(b.title||'').trim()) return json(res,400,{message:'عنوان نیازمندی لازم است.'});
    if(!b.projectId) return json(res,400,{message:'انتخاب پروژه لازم است.'});
    const pr=PROJECTS.find(x=>x.id===b.projectId);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    if(b.status&&!REQ_STATUSES.includes(b.status)) return json(res,400,{message:`وضعیت «${b.status}» نامعتبر است.`});
    if(b.priority&&!REQ_PRIORITIES.includes(b.priority)) return json(res,400,{message:`اولویت «${b.priority}» نامعتبر است.`});
    if(b.organizationId&&!orgById(b.organizationId)) return json(res,400,{message:'سازمان پوشش انتخاب‌شده یافت نشد.'});
    const extra=PROJECT_EXTRA[pr.id]??(PROJECT_EXTRA[pr.id]={requirements:[],risks:[],milestones:[],relationships:[]});
    const item={id:`req-${Date.now()}`,title:String(b.title).trim(),description:b.description??'',category:b.category??null,status:b.status??'OPEN',priority:b.priority??'MEDIUM',organizationId:b.organizationId??null,createdAt:nowIso()};
    extra.requirements.push(item); DB.projectExtra=PROJECT_EXTRA; saveDb();
    audit(req,'CREATE','ProjectRequirement',item.id,'OK',{meta:{title:item.title,projectId:pr.id,status:item.status,priority:item.priority}});
    return json(res,201,item);
  }
  const projectReq=match('/projects/requirements/:id');
  if(projectReq&&(method==='PATCH'||method==='DELETE')){
    const id=projectReq[0];
    const hit=Object.entries(PROJECT_EXTRA).map(([prId,e])=>({prId,item:(e.requirements??[]).find(x=>x.id===id)})).find(h=>h.item);
    if(!hit) return json(res,404,{message:'نیازمندی یافت نشد'});
    if(!scopedProjects(req).some(p=>p.id===hit.prId)) return json(res,403,{message:'دسترسی به پروژهٔ این نیازمندی مجاز نیست.'});
    if(method==='DELETE'){
      PROJECT_EXTRA[hit.prId].requirements=PROJECT_EXTRA[hit.prId].requirements.filter(x=>x.id!==id);
      DB.projectExtra=PROJECT_EXTRA; saveDb();
      audit(req,'DELETE','ProjectRequirement',id,'OK',{meta:{title:hit.item.title}});
      return json(res,200,{ok:true});
    }
    const b=await readBody(req);
    if(b.title!==undefined&&!String(b.title).trim()) return json(res,400,{message:'عنوان نیازمندی لازم است.'});
    if(b.status!==undefined&&!REQ_STATUSES.includes(b.status)) return json(res,400,{message:`وضعیت «${b.status}» نامعتبر است.`});
    if(b.priority!==undefined&&!REQ_PRIORITIES.includes(b.priority)) return json(res,400,{message:`اولویت «${b.priority}» نامعتبر است.`});
    if(b.organizationId!==undefined&&b.organizationId&&!orgById(b.organizationId)) return json(res,400,{message:'سازمان پوشش انتخاب‌شده یافت نشد.'});
    const before={...hit.item};
    for(const k of ['title','description','category','status','priority','organizationId']) if(b[k]!==undefined) hit.item[k]=b[k]===null?null:b[k];
    if(hit.item.organizationId===undefined) hit.item.organizationId=null;
    DB.projectExtra=PROJECT_EXTRA; saveDb();
    audit(req,'UPDATE','ProjectRequirement',id,'OK',{meta:{from:before.status??null,to:hit.item.status??null,title:hit.item.title}});
    return json(res,200,hit.item);
  }
  const reqMatchId=match('/requirements/:id/matches');
  if(reqMatchId&&method==='GET'){
    const out=requirementMatch(reqMatchId[0]);
    if(out.error) return json(res,404,{message:out.error});
    const projId=Object.keys(PROJECT_EXTRA).find(pid=>(PROJECT_EXTRA[pid].requirements??[]).some(x=>x.id===reqMatchId[0]));
    if(projId&&!scopedProjects(req).some(p=>p.id===projId)) return json(res,403,{message:'دسترسی به پروژهٔ این نیازمندی مجاز نیست.'});
    return json(res,200,out);
  }
  const projectMs=match('/projects/milestones/:id');
  if(projectMs&&(method==='PATCH'||method==='DELETE')){
    const id=projectMs[0];
    const hit=Object.entries(PROJECT_EXTRA).map(([prId,e])=>({prId,item:(e.milestones??[]).find(x=>x.id===id)})).find(h=>h.item);
    if(!hit) return json(res,404,{message:'مرحله یافت نشد'});
    if(method==='DELETE'){
      PROJECT_EXTRA[hit.prId].milestones=PROJECT_EXTRA[hit.prId].milestones.filter(x=>x.id!==id);
      audit(req,'DELETE','project_milestone',id,'OK');
      return json(res,200,{ok:true});
    }
    const b=await readBody(req);
    Object.assign(hit.item,b);
    audit(req,'UPDATE','project_milestone',id,'OK');
    return json(res,200,hit.item);
  }
  const projectRisk=match('/projects/risks/:id');
  if(projectRisk&&(method==='PATCH'||method==='DELETE')){
    const id=projectRisk[0];
    const hit=Object.entries(PROJECT_EXTRA).map(([prId,e])=>({prId,item:(e.risks??[]).find(x=>x.id===id)})).find(h=>h.item);
    if(!hit) return json(res,404,{message:'ریسک یافت نشد'});
    if(method==='DELETE'){
      PROJECT_EXTRA[hit.prId].risks=PROJECT_EXTRA[hit.prId].risks.filter(x=>x.id!==id);
      audit(req,'DELETE','project_risk',id,'OK');
      return json(res,200,{ok:true});
    }
    const b=await readBody(req);
    if(b.probability!==undefined||b.impact!==undefined){
      const p=b.probability!==undefined?Number(b.probability):(hit.item.probability??0);
      const im=b.impact!==undefined?Number(b.impact):(hit.item.impact??0);
      hit.item.probability=p; hit.item.impact=im; hit.item.score=Math.round(p*im/100);
    }
    Object.assign(hit.item,b);
    delete hit.item.score;
    hit.item.score=Math.round((hit.item.probability??0)*(hit.item.impact??0)/100);
    audit(req,'UPDATE','project_risk',id,'OK');
    return json(res,200,hit.item);
  }
  const projectId=match('/projects/:id');
  if(projectId&&method==='GET'){
    const pr=PROJECTS.find(x=>x.id===projectId[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    return json(res,200,projectView(pr));
  }
  if(projectId&&method==='PATCH'){
    const pr=PROJECTS.find(x=>x.id===projectId[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    const b=await readBody(req);
    for(const k of ['ownerId','description','objective'])
      if(b[k]===''||b[k]===null){ pr[k]=null; delete b[k]; }
    if(b.organizationId===''||b.organizationId===null) delete b.organizationId;
    if(b.organizationId!==undefined){
      if(!inScope(req,b.organizationId)) return json(res,403,{message:'سازمان پروژه در محدودهٔ دسترسی شما نیست.'});
      pr.organizationId=b.organizationId; delete b.organizationId;
    }
    if(b.status&&b.status!==pr.status){
      if(b.status==='COMPLETED'&&!pr.endAt) pr.endAt=nowIso();
      if(pr.status==='COMPLETED'&&b.status!=='COMPLETED') pr.endAt=null;
    }
    Object.assign(pr,b);
    audit(req,'UPDATE','project',pr.id,'OK',{name:pr.name});
    return json(res,200,projectView(pr));
  }
  if(projectId&&method==='DELETE'){
    const pr=PROJECTS.find(x=>x.id===projectId[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    PROJECTS=PROJECTS.filter(x=>x.id!==pr.id);
    delete PROJECT_EXTRA[pr.id];
    COMMITMENTS.forEach(c=>{ if(c.projectId===pr.id) c.projectId=null; });
    audit(req,'DELETE','project',pr.id,'OK',{name:pr.name});
    return json(res,200,{ok:true});
  }
  /* مراحل و ریسک‌های پروژه */
  const projectMilestones=match('/projects/:id/milestones');
  if(projectMilestones&&method==='GET'){
    const pr=PROJECTS.find(x=>x.id===projectMilestones[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    return json(res,200,projectView(pr).milestones);
  }
  if(projectMilestones&&method==='POST'){
    const b=await readBody(req);
    if(!b.title?.trim()) return json(res,400,{message:'عنوان مرحله لازم است.'});
    const pr=PROJECTS.find(x=>x.id===projectMilestones[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    const extra=PROJECT_EXTRA[pr.id]??(PROJECT_EXTRA[pr.id]={requirements:[],risks:[],milestones:[],relationships:[]});
    const item={id:`ms-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,title:b.title,description:b.description??'',status:b.status??'PLANNED',dueAt:b.dueAt??null};
    extra.milestones.push(item);
    audit(req,'CREATE','project_milestone',item.id,'OK',{title:item.title});
    return json(res,201,item);
  }
  const projectRisks=match('/projects/:id/risks');
  if(projectRisks&&method==='GET'){
    const pr=PROJECTS.find(x=>x.id===projectRisks[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    return json(res,200,projectView(pr).risks);
  }
  if(projectRisks&&method==='POST'){
    const b=await readBody(req);
    if(!b.title?.trim()) return json(res,400,{message:'عنوان ریسک لازم است.'});
    const pr=PROJECTS.find(x=>x.id===projectRisks[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    const extra=PROJECT_EXTRA[pr.id]??(PROJECT_EXTRA[pr.id]={requirements:[],risks:[],milestones:[],relationships:[]});
    const item={id:`rk-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,title:b.title,description:b.description??'',probability:Number(b.probability)||0,impact:Number(b.impact)||0,status:b.status??'OPEN',mitigation:b.mitigation??null};
    item.score=Math.round(item.probability*item.impact/100);
    extra.risks.push(item);
    audit(req,'CREATE','project_risk',item.id,'OK',{title:item.title});
    return json(res,201,item);
  }
  /* پیوند رابطه به پروژه */
  const projectRels=match('/projects/:id/relationships');
  if(projectRels&&method==='GET'){
    const pr=PROJECTS.find(x=>x.id===projectRels[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    return json(res,200,projectView(pr).relationships);
  }
  if(projectRels&&method==='POST'){
    const b=await readBody(req);
    if(!b.relationshipId) return json(res,400,{message:'شناسه رابطه لازم است.'});
    const pr=PROJECTS.find(x=>x.id===projectRels[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    if(!scopedProjects(req).includes(pr)) return json(res,403,{message:'دسترسی به این پروژه مجاز نیست.'});
    const rel=RELS.find(r=>r.id===b.relationshipId);
    if(!rel) return json(res,400,{message:'رابطه یافت نشد'});
    const extra=PROJECT_EXTRA[pr.id]??(PROJECT_EXTRA[pr.id]={requirements:[],risks:[],milestones:[],relationships:[]});
    if((extra.relationships??[]).some(x=>x.relationshipId===rel.id)) return json(res,400,{message:'این رابطه از پیش به پروژه پیوند شده است.'});
    extra.relationships=(extra.relationships??[]).concat({relationshipId:rel.id,status:b.status??'ENGAGED',relevance:Number(b.relevance)||null,required:!!b.required});
    audit(req,'CREATE','project_relationship',rel.id,'OK');
    return json(res,201,projectView(pr).relationships.find(x=>x.relationshipId===rel.id));
  }
  const projectRel=match('/projects/:id/relationships/:relationshipId');
  if(projectRel&&method==='DELETE'){
    const pr=PROJECTS.find(x=>x.id===projectRel[0]);
    if(!pr) return json(res,404,{message:'پروژه یافت نشد'});
    const extra=PROJECT_EXTRA[pr.id];
    const existed=extra&&(extra.relationships??[]).some(x=>x.relationshipId===projectRel[1]);
    if(!existed) return json(res,404,{message:'این رابطه به پروژه پیوند نشده است.'});
    extra.relationships=extra.relationships.filter(x=>x.relationshipId!==projectRel[1]);
    audit(req,'DELETE','project_relationship',projectRel[1],'OK');
    return json(res,200,{ok:true});
  }
  /* ---- organizations detail extras ---- */
  const orgRels=match('/organizations/:id/relationships');
  if(orgRels&&method==='GET'){
    const o=ORGS.find(x=>x.id===orgRels[0]);
    if(!o) return json(res,404,{message:'سازمان یافت نشد'});
    return json(res,200,RELS.filter(r=>r.sourceOrganizationId===o.id||r.targetOrganizationId===o.id).map(relWithOrgs));
  }

  /* ---- relationships detail actions ---- */
  const relLifecycle=match('/relationships/:id/lifecycle');
  if(relLifecycle&&method==='GET'){
    const r=RELS.find(x=>x.id===relLifecycle[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    return json(res,200,{relationshipId:r.id,lifecycleStage:r.lifecycleStage??'ACTIVE',history:[
      {stage:'ACTIVE',from:'2025-11-10T00:00:00.000Z',to:null},
    ]});
  }
  if(relLifecycle&&method==='PATCH'){
    const r=RELS.find(x=>x.id===relLifecycle[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    const b=await readBody(req);
    r.lifecycleStage=b.lifecycleStage??r.lifecycleStage??'ACTIVE';
    return json(res,200,relWithOrgs(r));
  }
  const relRecalc=match('/relationships/:id/recalculate-score');
  if(relRecalc&&method==='POST'){
    const r=RELS.find(x=>x.id===relRecalc[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    r.healthScore=Math.max(0,Math.min(99,Math.round((r.healthScore??50)*0.96)));
    return json(res,200,{ok:true,scores:{healthScore:r.healthScore,riskScore:r.riskScore,strategicScore:r.strategicScore,opportunityScore:r.opportunityScore,resilienceScore:r.resilienceScore}});
  }
  const relArchive=match('/relationships/:id/archive');
  if(relArchive&&method==='PATCH'){
    const r=RELS.find(x=>x.id===relArchive[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    r.status='ARCHIVED';
    audit(req,'ARCHIVE','relationship',r.id,'OK');
    return json(res,200,relWithOrgs(r));
  }
  const relRestore=match('/relationships/:id/restore');
  if(relRestore&&method==='POST'){
    const r=RELS.find(x=>x.id===relRestore[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    r.status='ACTIVE';
    audit(req,'RESTORE','relationship',r.id,'OK');
    return json(res,200,relWithOrgs(r));
  }
  const relPatch=match('/relationships/:id');
  if(relPatch&&method==='PATCH'){
    const r=RELS.find(x=>x.id===relPatch[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    const b=await readBody(req);
    Object.assign(r,b);
    return json(res,200,relWithOrgs(r));
  }

  /* ---- meetings participants ---- */
  const meetingParts=match('/meetings/:id/participants');
  if(meetingParts&&method==='PUT'){
    const b=await readBody(req);
    const m=MEETINGS.find(x=>x.id===meetingParts[0]);
    if(!m) return json(res,404,{message:'جلسه یافت نشد'});
    const ids=[...(b.personIds??[])].filter(id=>typeof id==='string'&&id);
    m.participants=ids.map(id=>({personId:id}));
    audit(req,'UPDATE','meeting',m.id,'OK',{participants:ids.length});
    return json(res,200,(m.participants).map((p)=>({person:personById(p.personId)?{id:p.personId,firstName:personById(p.personId).firstName,lastName:personById(p.personId).lastName}:{id:p.personId,firstName:p.personId,lastName:''}})));
  }
  if(meetingParts&&method==='GET'){
    const m=MEETINGS.find(x=>x.id===meetingParts[0]);
    if(!m) return json(res,404,{message:'جلسه یافت نشد'});
    return json(res,200,(m.participants??[]).map((p)=>({person:personById(p.personId)?{id:p.personId,firstName:personById(p.personId).firstName,lastName:personById(p.personId).lastName,title:personById(p.personId).title}:{id:p.personId,firstName:p.personId,lastName:''}})));
  }
  if(meetingParts&&method==='POST'){
    const m=MEETINGS.find(x=>x.id===meetingParts[0]);
    if(!m) return json(res,404,{message:'جلسه یافت نشد'});
    const b=await readBody(req);
    m.participants=m.participants??[];
    if(b.personId&&!m.participants.some((x)=>x.personId===b.personId)) m.participants.push({personId:b.personId});
    return json(res,201,m.participants);
  }

  /* ---- documents actions ---- */
  const docIndex=match('/documents/:id/index');
  if(docIndex&&method==='POST') return json(res,200,{ok:true,indexed:true});
  const docUrl=match('/documents/:id/signed-url');
  if(docUrl&&method==='GET') return json(res,200,{url:null,expiresAt:null});

  /* ---- admin / system ---- */
  if(is('/admin/overview')){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    return json(res,200,{users:Object.keys(USERS).length,organizations:ORGS.length,relationships:RELS.length,meetings:MEETINGS.length,actions:ACTIONS.length,auditEvents:DB.audit.length,flags:{invitesEnabled:true,featureFlagsActive:2}});
  }
  if(is('/admin/audit-log')){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const limit=Math.min(500,Math.max(1,Number(q.get('limit')||200)||200));
    const entity=(q.get('entityType')||'').trim().toLowerCase();
    const outcome=(q.get('outcome')||'').trim().toUpperCase();
    const actor=(q.get('actor')||'').trim().toLowerCase();
    const search=(q.get('search')||'').trim().toLowerCase();
    const events=DB.audit.filter(e=>{
      if(entity&&!String(e.entity??'').toLowerCase().includes(entity)) return false;
      if(outcome&&!(outcome==='FAIL'?e.outcome!=='OK':e.outcome===outcome)) return false;
      if(actor&&!String(e.actorEmail??'').toLowerCase().includes(actor)) return false;
      if(search&&!String(e.entityId??'').toLowerCase().includes(search)) return false;
      return true;
    });
    return json(res,200,{events:events.slice(0,limit),total:events.length,shown:Math.min(limit,events.length)});
  }
  if(is('/admin/audit')){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    return json(res,200,{events:DB.audit.slice(0,Math.min(200,Number(q.get('limit')||100)||100)),total:DB.audit.length});
  }
  if(is('/admin/permissions')) return json(res,200,PERMISSIONS.map(p=>{
    const holders=(DB?.roles??[]).filter(r=>(r.permissions??[]).includes(p.key)).map(r=>({role:{key:r.key,name:r.name}}));
    return {key:p.key,name:p.name,group:p.group,description:p.name,rolePermissions:holders};
  }));
  if(is('/admin/interaction-types')) return json(res,200,[
    {key:'CALL',name:'تماس'},{key:'VISIT',name:'بازدید'},{key:'MEETING',name:'جلسه'},{key:'EMAIL',name:'ایمیل'},{key:'LUNCH',name:'ناهار کاری'},{key:'EVENT',name:'رویداد'},
  ]);
  if(is('/enterprise/feature-flags')&&method==='GET'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('feature_flag.read')) return json(res,403,{message:'شما مجوز «مشاهده پرچم‌های ویژگی» (feature_flag.read) را ندارید.'});
    const qOrg=q.get('organizationId')??null;
    const rows=(DB.featureFlags??[]).filter(f=>qOrg?(!f.organizationId||f.organizationId===qOrg):true);
    return json(res,200,rows.map(ffView).sort((a,b)=>a.key.localeCompare(b.key)));
  }
  if(is('/enterprise/feature-flags')&&method==='POST'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('feature_flag.write')) return json(res,403,{message:'شما مجوز «مدیریت پرچم‌های ویژگی» (feature_flag.write) را ندارید.'});
    const b=await readBody(req);
    const key=String(b.key||'').trim();
    if(!key||!/^[a-z][a-z0-9_]{1,63}$/.test(key)) return json(res,400,{message:'کلید پرچم باید لاتین کوچک و ۲ تا ۶۴ کاراکتر باشد.'});
    const rollout=typeof b.rollout==='number'?b.rollout:Number(b.rollout??100);
    if(!Number.isFinite(rollout)||rollout<0||rollout>100) return json(res,400,{message:'درصد rollout باید بین ۰ تا ۱۰۰ باشد.'});
    const i=(DB.featureFlags??[]).findIndex(x=>x.key===key);
    let row;
    const now=nowIso();
    if(i>=0){ row=DB.featureFlags[i]; row.enabled=!!b.enabled; row.rollout=rollout; row.description=b.description??row.description??null; }
    else{ row={id:`ff-${Date.now()}`,key,enabled:!!b.enabled,rollout,organizationId:null,description:b.description??null,createdAt:now}; DB.featureFlags.push(row); }
    audit(req,'UPDATE','FeatureFlag',row.id,'OK',{meta:{key:row.key,enabled:row.enabled,rollout:row.rollout,reason:'Admin feature flag changed'}});
    return json(res,i>=0?200:201,ffView(row));
  }
  if(is('/admin/feature-flags')) return json(res,200,{flags:(DB.featureFlags??[]).map(ffView)});
  if(is('/core-domain/relationship-types')) return json(res,200,[
    {key:'STRATEGIC_PARTNERSHIP',name:'مشارکت راهبردی'},{key:'BANKING',name:'بانکی'},{key:'CUSTOMER',name:'مشتری'},
    {key:'SUPPLY',name:'تأمین'},{key:'INVESTMENT',name:'سرمایه‌گذاری'},{key:'GOVERNMENT',name:'دولتی'},{key:'SUBSIDIARY',name:'زیرمجموعه'},{key:'HOLDING',name:'هلدینگ'},
  ]);
  /* ---- admin: users & access (RBAC) — parity with real admin/authorization modules ---- */
  if(is('/admin/users')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    let list=Object.values(USERS).map(adminUserView);
    const orgId=q.get('organizationId')||undefined;
    if(orgId) list=list.filter(u=>u.memberships.some(m=>m.organizationId===orgId));
    const search=(q.get('search')||'').trim().toLowerCase();
    if(search) list=list.filter(u=>(u.email||'').toLowerCase().includes(search)||(u.name||'').toLowerCase().includes(search));
    list.sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
    return json(res,200,list.slice(0,200));
  }
  const userActiveMatch=match('/admin/users/:id/active');
  if(userActiveMatch&&method==='PATCH'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const target=userById(userActiveMatch[0]);
    if(!target) return json(res,404,{message:'کاربر یافت نشد.'});
    const b=await readBody(req);
    const active=!!b.active;
    if(authUser.id===target.id&&!active) return json(res,403,{message:'مدیر نمی‌تواند حساب جاری خودش را غیرفعال کند.'});
    target.isActive=active;
    audit(req,'UPDATE','User',target.id,'OK',{meta:{isActive:active,reason:'Admin user activation changed'}});
    return json(res,200,{id:target.id,isActive:active});
  }
  if(is('/authorization/roles')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    return json(res,200,rolesSorted().map(roleView));
  }
  if(is('/authorization/roles')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const key=String(b.key||'').trim().toUpperCase();
    if(!/^[A-Z][A-Z0-9_]{2,63}$/.test(key)) return json(res,400,{message:'کلید نقش باید ۳ تا ۶۴ کاراکتر، شروع با حرف لاتین و فقط A-Z، 0-9 یا _ باشد.'});
    if(key==='SUPER_ADMIN'||(DB?.roles??[]).some(r=>r.key===key)) return json(res,400,{message:`کلید «${key}» رزرو یا تکراری است.`});
    if(!String(b.name||'').trim()) return json(res,400,{message:'نام نمایشی نقش لازم است.'});
    const wanted=[...new Set(Array.isArray(b.permissions)?b.permissions.map(String):[])];
    const unknown=wanted.filter(k=>!PERMISSIONS.some(p=>p.key===k));
    if(unknown.length) return json(res,400,{message:`مجوزهای نامعتبر: ${unknown.join('، ')}`});
    const role={id:`role-${key}`,key,name:String(b.name).trim(),description:b.description??null,isSystem:false,holding:false,superAdmin:false,permissions:wanted};
    DB.roles.push(role);
    audit(req,'PERMISSION_CHANGE','Role',role.id,'OK',{meta:{key,reason:'RBAC custom role created'}});
    return json(res,201,roleView(role));
  }
  const rolePermsMatch=match('/authorization/roles/:key/permissions');
  if(rolePermsMatch&&method==='PUT'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const rk=decodeURIComponent(rolePermsMatch[0]);
    const role=(DB?.roles??[]).find(r=>r.key===rk);
    if(!role) return json(res,404,{message:'نقش یافت نشد.'});
    if(role.superAdmin) return json(res,400,{message:'مجوزهای نقش مالک (SUPER_ADMIN) قابل تغییر نیست.'});
    const b=await readBody(req);
    const keys=[...new Set(Array.isArray(b.permissions)?b.permissions.map(String):[])];
    const unknown=keys.filter(k=>!PERMISSIONS.some(p=>p.key===k));
    if(unknown.length) return json(res,400,{message:`مجوزهای نامعتبر: ${unknown.join('، ')}`});
    role.permissions=keys;
    audit(req,'PERMISSION_CHANGE','Role',role.id,'OK',{meta:{key:rk,permissions:keys,reason:'RBAC permissions updated'}});
    return json(res,200,roleView(role));
  }
  if(is('/authorization/memberships')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const orgId=q.get('organizationId')||null;
    const page=Math.max(1,Number(q.get('page')||1)||1), limit=Math.min(200,Math.max(1,Number(q.get('limit')||100)||100));
    const rows=[];
    for(const u of Object.values(USERS)) for(const m of u.memberships??[]){
      if(orgId&&m.organizationId!==orgId) continue;
      rows.push({id:m.id,userId:u.id,organizationId:m.organizationId,organizationName:orgById(m.organizationId)?.name??null,role:m.role,department:m.department??null,dataScope:m.dataScope??'INTERNAL',accessScope:m.accessScope??'ORGANIZATION',isPrimary:!!m.isPrimary,user:{id:u.id,email:u.email,name:u.name,isActive:u.isActive!==false}});
    }
    rows.sort((a,b)=>String(a.organizationName??'').localeCompare(String(b.organizationName??''),'fa'));
    const total=rows.length;
    return json(res,200,{items:rows.slice((page-1)*limit,page*limit),page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))});
  }
  if(is('/authorization/memberships')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const target=userById(String(b.userId||''));
    if(!target) return json(res,400,{message:'کاربر یافت نشد.'});
    const def=roleMeta(String(b.role??''));
    if(!def) return json(res,400,{message:`نقش «${String(b.role??'')}» وجود ندارد.`});
    if(def.key==='SUPER_ADMIN'&&!target.isOwner) return json(res,400,{message:'نقش SUPER_ADMIN فقط به مالک سامانه تعلق دارد و قابل واگذاری نیست.'});
    if(!orgById(String(b.organizationId||''))) return json(res,400,{message:'سازمان انتخاب‌شده معتبر نیست.'});
    if(b.accessScope==='DEPARTMENT'&&!b.department?.trim()) return json(res,400,{message:'محدودهٔ «واحد» نیاز به نام واحد/دپارتمان دارد.'});
    let mem=target.memberships.find(m=>m.organizationId===b.organizationId);
    const role=def.key, dept=b.department??null, dataScope=b.dataScope??'INTERNAL', accessScope=b.accessScope??(def.holding?'ALL':'ORGANIZATION');
    if(mem){ mem.role=role; mem.department=dept; mem.dataScope=dataScope; mem.accessScope=accessScope; if(b.isPrimary) mem.isPrimary=true; }
    else{
      mem={id:`mb-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,organizationId:b.organizationId,organizationName:orgById(b.organizationId).name,role,department:dept,dataScope,accessScope,isPrimary:!!b.isPrimary};
      target.memberships.push(mem);
    }
    if(b.isPrimary||!target.memberships.some(x=>x.isPrimary)){ for(const x of target.memberships) x.isPrimary=(x.id===mem.id); }
    recomputeUserAccess(target);
    audit(req,'PERMISSION_CHANGE','Membership',mem.id,'OK',{meta:{organizationId:b.organizationId,role,reason:'RBAC membership assigned/updated'}});
    return json(res,201,{id:mem.id,userId:target.id,organizationId:mem.organizationId,organizationName:orgById(mem.organizationId)?.name??null,role:mem.role,department:mem.department,dataScope:mem.dataScope,accessScope:mem.accessScope,isPrimary:!!mem.isPrimary});
  }
  const membershipDel=match('/authorization/memberships/:id');
  if(membershipDel&&method==='DELETE'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const mid=membershipDel[0];
    let hit=null;
    for(const u of Object.values(USERS)){
      const i=(u.memberships??[]).findIndex(m=>m.id===mid);
      if(i>=0){ hit={u,i,mem:u.memberships[i]}; break; }
    }
    if(!hit) return json(res,404,{message:'عضویت یافت نشد.'});
    if(hit.u.id===authUser.id&&hit.mem.isPrimary) return json(res,400,{message:'حذف عضویت اصلی حساب جاری ممکن نیست.'});
    hit.u.memberships.splice(hit.i,1);
    if(hit.mem.isPrimary&&hit.u.memberships.length) hit.u.memberships[0].isPrimary=true;
    recomputeUserAccess(hit.u);
    audit(req,'PERMISSION_CHANGE','Membership',mid,'OK',{meta:{organizationId:hit.mem.organizationId,reason:'RBAC membership revoked'}});
    return json(res,200,{deleted:true,id:mid});
  }


  /* ---- admin tags (parity: list/search, upsert, rename, delete) ---- */
  if(is('/admin/tags')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const search=(q.get('search')||'').trim().toLowerCase();
    let list=(DB.tags??[]).map(tagView);
    if(search) list=list.filter(t=>t.name.toLowerCase().includes(search));
    list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'fa'));
    return json(res,200,list);
  }
  if(is('/admin/tags')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const name=String(b.name||'').trim();
    if(!name||name.length>100) return json(res,400,{message:'نام برچسب باید ۱ تا ۱۰۰ کاراکتر باشد.'});
    let t=(DB.tags??[]).find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(t){ audit(req,'UPDATE','Tag',t.id,'OK',{meta:{name,reason:'Admin tag upsert'}}); return json(res,200,tagView(t)); }
    t={id:`tag-${Date.now()}`,name,createdAt:nowIso()};
    DB.tags.push(t);
    audit(req,'UPDATE','Tag',t.id,'OK',{meta:{name,reason:'Admin tag upsert'}});
    return json(res,201,tagView(t));
  }
  const tagIdMatch=match('/admin/tags/:id');
  if(tagIdMatch&&method==='PATCH'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const t=(DB.tags??[]).find(x=>x.id===tagIdMatch[0]);
    if(!t) return json(res,404,{message:'برچسب یافت نشد.'});
    const b=await readBody(req);
    const name=String(b.name||'').trim();
    if(!name||name.length>100) return json(res,400,{message:'نام برچسب باید ۱ تا ۱۰۰ کاراکتر باشد.'});
    if((DB.tags??[]).some(x=>x.id!==t.id&&x.name.toLowerCase()===name.toLowerCase())) return json(res,400,{message:'برچسبی با این نام وجود دارد.'});
    t.name=name;
    audit(req,'UPDATE','Tag',t.id,'OK',{meta:{name,reason:'Admin tag renamed'}});
    return json(res,200,tagView(t));
  }
  if(tagIdMatch&&method==='DELETE'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const t=(DB.tags??[]).find(x=>x.id===tagIdMatch[0]);
    if(!t) return json(res,404,{message:'برچسب یافت نشد.'});
    const used=DB.tagAssignments.filter(a=>a.tagId===t.id).length;
    DB.tags=DB.tags.filter(x=>x.id!==t.id);
    DB.tagAssignments=DB.tagAssignments.filter(a=>a.tagId!==t.id);
    audit(req,'DELETE','Tag',t.id,'OK',{meta:{name:t.name,removedAssignments:used,reason:'Admin tag deleted'}});
    return json(res,200,{deleted:true,id:t.id,removedAssignments:used});
  }

  /* ---- custom fields (parity with real CustomFieldsController) ---- */
  if(is('/custom-fields')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const et=q.get('entityType')||undefined;
    let list=(DB.customFields??[]).map(cfView).filter(c=>!et||c.entityType===et);
    list.sort((a,b)=>String(a.entityType).localeCompare(String(b.entityType))||a.key.localeCompare(b.key));
    return json(res,200,list);
  }
  if(is('/custom-fields')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    if(!String(b.label??'').trim()||!b.entityType||!b.fieldType) return json(res,400,{message:'کلید، برچسب، نوع نهاد و نوع فیلد لازم است.'});
    if(!CF_ENTITY_TYPES.includes(b.entityType)) return json(res,400,{message:`نوع نهاد «${b.entityType}» پشتیبانی نمی‌شود.`});
    if(!CF_FIELD_TYPES.includes(b.fieldType)) return json(res,400,{message:`نوع فیلد «${b.fieldType}» پشتیبانی نمی‌شود.`});
    const key=String(b.key||'').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');
    if(!key||key.length>100) return json(res,400,{message:'کلید فیلد باید ۱ تا ۱۰۰ کاراکتر لاتین کوچک باشد.'});
    if((b.fieldType==='select'||b.fieldType==='multiselect')&&(!Array.isArray(b.options)||!b.options.length||b.options.some((o)=>typeof o!=='string'||!String(o).trim()))) return json(res,400,{message:'گزینه‌های select/multiselect باید آرایهٔ غیرخالی از متن باشند.'});
    if(b.fieldType!=='select'&&b.fieldType!=='multiselect'&&b.options!==undefined&&b.options!==null) return json(res,400,{message:'گزینه فقط برای فیلدهای select/multiselect مجاز است.'});
    const existing=(DB.customFields??[]).find(x=>x.entityType===b.entityType&&x.key===key&&(x.organizationId??null)===null);
    if(existing&&existing.fieldType!==b.fieldType){
      const has=DB.customFieldValues.some(v=>v.customFieldId===existing.id);
      if(has) return json(res,409,{message:'تغییر نوع فیلد پس از ثبت مقدار ممکن نیست؛ فیلد را غیرفعال کنید.'});
    }
    const now=nowIso();
    const row=existing?{...existing,label:String(b.label).trim(),fieldType:b.fieldType,options:(b.fieldType==='select'||b.fieldType==='multiselect')?[...new Set(b.options.map(String))]:null,required:!!b.required,active:b.active!==false,updatedAt:now}:{id:`cf-${Date.now()}`,key,label:String(b.label).trim(),entityType:b.entityType,fieldType:b.fieldType,options:(b.fieldType==='select'||b.fieldType==='multiselect')?[...new Set(b.options.map(String))]:null,required:!!b.required,active:b.active!==false,organizationId:null,createdById:null,createdAt:now,updatedAt:now};
    if(existing){ const i=DB.customFields.findIndex(x=>x.id===existing.id); DB.customFields[i]=row; } else DB.customFields.push(row);
    audit(req,existing?'UPDATE':'CREATE','CustomField',row.id,'OK',{meta:{key:row.key,entityType:row.entityType,reason:existing?'Custom field definition updated':'Custom field definition created'}});
    return json(res,existing?200:201,cfView(row));
  }
  const cfId=match('/custom-fields/:id');
  if(cfId&&method==='DELETE'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const i=(DB.customFields??[]).findIndex(x=>x.id===cfId[0]);
    if(i<0) return json(res,404,{message:'فیلد سفارشی یافت نشد.'});
    const row=DB.customFields[i];
    const has=DB.customFieldValues.some(v=>v.customFieldId===row.id);
    if(has) return json(res,409,{message:'فیلدی که مقدار دارد را نمی‌توان حذف کرد؛ آن را غیرفعال کنید.'});
    DB.customFields.splice(i,1);
    audit(req,'DELETE','CustomField',row.id,'OK',{meta:{key:row.key,reason:'Custom field definition deleted'}});
    return json(res,200,{deleted:true,id:row.id});
  }

  /* ---- scoring rules (parity: list + upsert; no delete in real API) ---- */
  if(is('/admin/scoring-rules')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    let list=(DB.scoringRules??[]).map(srView);
    list.sort((a,b)=>String(a.createdAt??'').localeCompare(String(b.createdAt??''))*-1||a.key.localeCompare(b.key));
    return json(res,200,list);
  }
  if(is('/admin/scoring-rules')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    if(!String(b.key??'').trim()||!String(b.name??'').trim()||!b.scoreType||!b.entityType||b.definition==null) return json(res,400,{message:'کلید، نام، نوع امتیاز، نهاد و تعریف لازم است.'});
    const key=String(b.key).trim().toUpperCase();
    if(!/^[A-Z][A-Z0-9_]{2,63}$/.test(key)) return json(res,400,{message:'کلید قاعده باید ۳ تا ۶۴ کاراکتر و فقط A-Z، 0-9 یا _ باشد.'});
    if(!SCORE_TYPES.includes(String(b.scoreType))) return json(res,400,{message:`نوع امتیاز «${b.scoreType}» پشتیبانی نمی‌شود.`});
    if(!SCORE_ENTITY_TYPES.includes(String(b.entityType))) return json(res,400,{message:`نهاد «${b.entityType}» پشتیبانی نمی‌شود.`});
    const weight=typeof b.weight==='number'?b.weight:Number(b.weight??1);
    if(!Number.isFinite(weight)) return json(res,400,{message:'وزن نامعتبر است.'});
    let def=b.definition;
    if(typeof def==='string'){ try{ def=JSON.parse(def); }catch{ def={description:String(def).trim()}; } }
    const now=nowIso();
    const i=(DB.scoringRules??[]).findIndex(r=>r.key===key);
    let row;
    if(i>=0){
      row=DB.scoringRules[i];
      row.name=String(b.name).trim(); row.scoreType=String(b.scoreType); row.entityType=String(b.entityType);
      row.weight=weight; row.definition=def; row.version=typeof b.version==='number'?b.version:row.version; row.active=b.active!==false;
    }else{
      row={id:`sr-${Date.now()}`,key,name:String(b.name).trim(),scoreType:String(b.scoreType),entityType:String(b.entityType),weight,definition:def,version:typeof b.version==='number'?b.version:1,active:b.active!==false,organizationId:null,createdAt:now};
      DB.scoringRules.push(row);
    }
    audit(req,'UPDATE','ScoringRule',row.id,'OK',{meta:{key:row.key,reason:'Admin scoring rule changed'}});
    return json(res,i>=0?200:201,srView(row));
  }

  /* ---- notification rules (parity: list + upsert) ---- */
  if(is('/admin/notification-rules')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    let list=(DB.notificationRules??[]).map(nrView);
    list.sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))||a.key.localeCompare(b.key));
    return json(res,200,list);
  }
  if(is('/admin/notification-rules')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const key=String(b.key||'').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');
    if(!key) return json(res,400,{message:'کلید قاعده لازم است.'});
    if(!String(b.name||'').trim()||!b.eventType||!Array.isArray(b.channels)||b.channels.length===0||b.template==null) return json(res,400,{message:'نام، رویداد، دست‌کم یک کانال و قالب لازم است.'});
    const badCh=b.channels.filter(c=>!NR_CHANNELS.includes(String(c)));
    if(badCh.length) return json(res,400,{message:`کانال‌های نامعتبر: ${badCh.join('، ')} (فقط IN_APP/EMAIL/PUSH).`});
    if(!NR_EVENT_TYPES.includes(String(b.eventType))) return json(res,400,{message:`رویداد «${b.eventType}» پشتیبانی نمی‌شود.`});
    const tmpl=b.template;
    if(typeof tmpl==='string'){ try{ JSON.parse(tmpl); }catch{ /* plain text template accepted */ } }
    let conditions=b.conditions??null;
    if(typeof conditions==='string'){ try{ conditions=JSON.parse(conditions); }catch{ conditions={text:String(conditions)}; } }
    const now=nowIso();
    const i=(DB.notificationRules??[]).findIndex(r=>r.key===key);
    let row;
    if(i>=0){
      row=DB.notificationRules[i];
      row.name=String(b.name).trim(); row.eventType=String(b.eventType); row.channels=b.channels.map(String);
      row.template=tmpl; row.conditions=conditions; row.active=b.active!==false; row.updatedAt=now;
    }else{
      row={id:`nr-${Date.now()}`,key,name:String(b.name).trim(),eventType:String(b.eventType),channels:b.channels.map(String),template:tmpl,conditions,active:b.active!==false,organizationId:null,createdAt:now,updatedAt:now};
      DB.notificationRules.push(row);
    }
    audit(req,'UPDATE','NotificationRule',row.id,'OK',{meta:{key:row.key,reason:'Admin notification rule changed'}});
    return json(res,i>=0?200:201,nrView(row));
  }
  
  const privacyManageOk=()=>!!(authUser?.isOwner||(authUser?.permissions??[]).includes('privacy.manage'));
  const privacyReadOk=()=>!!(authUser?.isOwner||(authUser?.permissions??[]).includes('privacy.read'));
  if(is('/privacy/retention/preview')&&method==='GET'){
    if(!privacyManageOk()) return json(res,403,{message:'شما مجوز «مدیریت نگهداری» (privacy.manage) را ندارید.'});
    return json(res,200,retentionPreviewRows());
  }
  if(is('/privacy/retention/execute')&&method==='POST'){
    if(!privacyManageOk()) return json(res,403,{message:'شما مجوز «مدیریت نگهداری» (privacy.manage) را ندارید.'});
    const preview=retentionPreviewRows();
    const changed=[];
    const nowI=nowIso();
    for(const item of preview){
      if(!item.erasable||!item.count) continue;
      const cutoff=new Date(item.cutoff).getTime();
      const victims=(DB[RETENTION_COLLECTIONS[item.entityType]]??[]).filter(r=>{
        const c=r.createdAt; if(!c) return false;
        if(new Date(c).getTime()>=cutoff) return false;
        return !(DB.retentionPurged??[]).some(g=>g.entityType===item.entityType&&g.id===r.id);
      });
      if(victims.length){ changed.push({entityType:item.entityType,count:victims.length}); for(const v of victims) DB.retentionPurged.push({entityType:item.entityType,id:v.id,purgedAt:nowI}); }
    }
    saveDb();
    if(changed.length) audit(req,'DELETE','RetentionBatch',nowI,'OK',{meta:{reason:'retention-policy-execution',policies:changed.length,entities:changed}});
    return json(res,200,{executedAt:nowI,changed});
  }
  if(is('/privacy/policies')){
    if(!privacyReadOk()) return json(res,403,{message:'شما مجوز «مشاهده حریم خصوصی» (privacy.read) را ندارید.'});
    const policies=(DB.retentionPolicies??[]).filter(p=>p.active!==false)
      .sort((a,b)=>String(a.entityType).localeCompare(String(b.entityType)))
      .map(p=>({id:p.id,entityType:p.entityType,purpose:p.purpose,legalBasis:p.legalBasis,classification:p.classification,retentionDays:p.retentionDays,exportable:!!p.exportable,erasable:!!p.erasable,active:true,createdAt:p.createdAt,updatedAt:p.updatedAt??p.createdAt}));
    return json(res,200,{policies});
  }
  if(is('/privacy/audit')&&method==='GET'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('privacy.audit')) return json(res,403,{message:'شما مجوز «ممیزی حریم خصوصی» (privacy.audit) را ندارید.'});
    const rows=(DB.audit??[]).filter(a=>['PrivacyRequest','PrivacyData','UserPrivacyData'].includes(a.entity)).slice(0,500);
    return json(res,200,{rows});
  }

  if(is('/admin/master-data')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    return json(res,200,masterView());
  }
  if(is('/admin/master-data')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const cat=String(b.category||''); const value=String(b.value||'').trim();
    if(!MASTER_FREE.includes(cat)) return json(res,400,{message:'این دسته مقادیر ثابت (enum) دارد و قابل افزودن نیست.'});
    if(!value||value.length<2) return json(res,400,{message:'نام مقدار جدید باید حداقل ۲ حرف باشد.'});
    const catArr=masterCatalog(cat);
    if(catArr.includes(value)) return json(res,409,{message:`مقدار «${value}» از قبل در کاتالوگ ${cat==='industry'?'صنایع':'کشورها'} هست.`});
    catArr.push(value); saveDb();
    audit(req,'CREATE','MasterData',`${cat}:${value}`,'OK',{meta:{category:cat,label:value,reason:'Admin master data created'}});
    return json(res,201,{value,usage:0});
  }
  if(is('/admin/master-data')&&method==='PATCH'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const cat=String(b.category||''); const value=String(b.value||'').trim(); const nv=String(b.newValue||'').trim();
    if(!MASTER_FREE.includes(cat)) return json(res,400,{message:'این دسته مقادیر ثابت (enum) دارد و قابل تغییر نیست.'});
    if(!value||!nv||nv.length<2) return json(res,400,{message:'نام قدیم و جدید باید حداقل ۲ حرف باشد.'});
    const catArr=masterCatalog(cat);
    if(!catArr.includes(value)) return json(res,404,{message:`مقدار «${value}» در کاتالوگ نیست.`});
    if(catArr.includes(nv)) return json(res,409,{message:`مقدار «${nv}» از قبل در کاتالوگ هست.`});
    const i=catArr.indexOf(value); catArr[i]=nv;
    for(const o of DB.orgs??[]) if(cat==='industry'?o.industry===value:o.country===value){ if(cat==='industry')o.industry=nv; else o.country=nv; }
    saveDb();
    audit(req,'UPDATE','MasterData',`${cat}:${value}`,'OK',{meta:{category:cat,from:value,to:nv,reason:'Admin master data renamed'}});
    return json(res,200,{value:nv,usage:masterUsage(cat,nv)});
  }
  if(is('/admin/master-data')&&method==='DELETE'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const cat=String(b.category||''); const value=String(b.value||'').trim();
    if(!MASTER_FREE.includes(cat)) return json(res,400,{message:'این دسته مقادیر ثابت (enum) دارد و قابل حذف نیست.'});
    const u=masterUsage(cat,value);
    if(u>0) return json(res,409,{message:`مقدار «${value}» در ${u} رکورد استفاده شده و قابل حذف نیست.`});
    const catArr=masterCatalog(cat);
    const i=catArr.indexOf(value);
    if(i<0) return json(res,404,{message:`مقدار «${value}» در کاتالوگ نیست.`});
    catArr.splice(i,1); saveDb();
    audit(req,'DELETE','MasterData',`${cat}:${value}`,'OK',{meta:{category:cat,label:value,reason:'Admin master data removed'}});
    return json(res,200,{deleted:true,value});
  }

  if(is('/admin/integrations')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    return json(res,200,(DB.integrations??[]).map(intView).sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))));
  }
  if(is('/integrations')&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    return json(res,200,(DB.integrations??[]).map(intView));
  }
  if(is('/integrations/authorize')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const provider=String(b.provider||'').toUpperCase(); const kind=String(b.kind||'').toUpperCase();
    if(!INT_PROVIDERS.includes(provider)) return json(res,400,{message:`ارائه‌دهندهٔ «${b.provider}» نامعتبر است (گوگل/مایکروسافت).`});
    if(!INT_KINDS.includes(kind)) return json(res,400,{message:`نوع یکپارچه‌سازی «${b.kind}» نامعتبر است.`});
    const row={id:`int-${Date.now()}`,userId:authUser.id,organizationId:b.organizationId??'org-1',provider,kind,status:'PENDING',accountLabel:typeof b.accountLabel==='string'&&b.accountLabel.trim()?String(b.accountLabel).trim():null,scopes:null,expiresAt:null,lastSyncAt:null,lastError:null,createdAt:nowIso(),deletedAt:null};
    DB.integrations.push(row);
    audit(req,'CREATE','Integration',row.id,'OK',{meta:{provider,kind,reason:'Admin authorized integration'}});
    return json(res,201,intView(row));
  }
  if(is('/integrations/oauth/callback')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const b=await readBody(req);
    const row=(DB.integrations??[]).find(x=>x.id===b.connectionId);
    if(!row) return json(res,404,{message:'اتصال یافت نشد.'});
    if(row.status!=='PENDING') return json(res,409,{message:'این اتصال در حالت در انتظار نیست.'});
    row.status='CONNECTED'; row.expiresAt=new Date(Date.now()+90*86400000).toISOString(); row.lastError=null;
    saveDb();
    audit(req,'UPDATE','Integration',row.id,'OK',{meta:{provider:row.provider,kind:row.kind,state:'oauth-callback',reason:'Admin completed OAuth'}});
    return json(res,200,intView(row));
  }
  const syncId=match('/integrations/:id/sync');
  if(syncId&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const row=(DB.integrations??[]).find(x=>x.id===syncId[0]);
    if(!row) return json(res,404,{message:'اتصال یافت نشد.'});
    if(row.status!=='CONNECTED') return json(res,409,{message:'فقط اتصال متصل قابل همگام‌سازی است.'});
    const seen=2+Math.floor(Math.random()*6); const created=Math.floor(Math.random()*Math.min(3,seen+1)); const updated=Math.max(0,seen-created-Math.floor(Math.random()*2)); const cancelled=seen-created-updated;
    const nowI=nowIso();
    const run={id:`run-${Date.now()}`,connectionId:row.id,kind:row.kind,startedAt:nowI,completedAt:nowI,status:'SUCCESS',seen,created,updated,cancelled,matchedPeople:Math.floor(Math.random()*(created+1))+Math.floor(Math.random()*2),matchedOrganizations:Math.floor(Math.random()*(created+1))};
    DB.integrationRuns.unshift(run);
    row.lastSyncAt=nowI; row.lastError=null;
    saveDb();
    audit(req,'UPDATE','Integration',row.id,'OK',{meta:{kind:row.kind,seen,reason:'Admin triggered sync'}});
    return json(res,200,intRunView(run));
  }
  const runsId=match('/integrations/:id/sync-runs');
  if(runsId&&method==='GET'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    if(!(DB.integrations??[]).some(x=>x.id===runsId[0])) return json(res,404,{message:'اتصال یافت نشد.'});
    return json(res,200,(DB.integrationRuns??[]).filter(r=>r.connectionId===runsId[0]).map(intRunView).sort((a,b)=>String(b.startedAt??'').localeCompare(String(a.startedAt??''))));
  }
  const delId=match('/integrations/:id');
  if(delId&&method==='DELETE'){
    if(!authUser?.isOwner) return json(res,403,{message:'این بخش فقط برای مالک است.'});
    const row=(DB.integrations??[]).find(x=>x.id===delId[0]);
    if(!row) return json(res,404,{message:'اتصال یافت نشد.'});
    if(row.status!=='DISCONNECTED'){ row.status='DISCONNECTED'; row.deletedAt=nowIso(); saveDb(); audit(req,'DELETE','Integration',row.id,'OK',{meta:{provider:row.provider,kind:row.kind,reason:'Admin disconnected integration'}}); }
    return json(res,200,{disconnected:true,id:row.id});
  }
/* ------------------------------ referrals ------------------------------ */
  if(is('/core-domain/referrals')&&method==='GET'){
    const list=(DB.referrals??[]).filter(r=>inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId));
    const enrich=(r)=>({...r,
      sourcePerson:personById(r.sourcePersonId)?{id:r.sourcePersonId,firstName:personById(r.sourcePersonId).firstName,lastName:personById(r.sourcePersonId).lastName}:null,
      targetPerson:personById(r.targetPersonId)?{id:r.targetPersonId,firstName:personById(r.targetPersonId).firstName,lastName:personById(r.targetPersonId).lastName}:null,
      sourceOrganization:orgById(r.sourceOrganizationId)?{id:r.sourceOrganizationId,name:orgById(r.sourceOrganizationId).name}:null,
      targetOrganization:orgById(r.targetOrganizationId)?{id:r.targetOrganizationId,name:orgById(r.targetOrganizationId).name}:null,
      createdBy:userById(r.createdById)?{id:r.createdById,name:userById(r.createdById).name,email:userById(r.createdById).email}:null,
      recipientUser:userById(r.recipientUserId)?{id:r.recipientUserId,name:userById(r.recipientUserId).name,email:userById(r.recipientUserId).email}:null,
    });
    return json(res,200,list.sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))).map(enrich));
  }
  if(is('/core-domain/referrals')&&method==='POST'){
    const b=await readBody(req);
    if(!String(b.title||'').trim()) return json(res,400,{message:'عنوان معرفی لازم است.'});
    if(!b.sourceOrganizationId&&!b.sourcePersonId) return json(res,400,{message:'مبدأ معرفی (سازمان یا شخص) لازم است.'});
    if(!b.targetOrganizationId&&!b.targetPersonId&&!b.recipientUserId) return json(res,400,{message:'مقصد معرفی (سازمان، شخص یا کاربر گیرنده) لازم است.'});
    if(!authUser?.isOwner&&b.sourceOrganizationId&&!inScope(req,b.sourceOrganizationId)) return json(res,403,{message:'سازمان مبدأ خارج از محدودهٔ دسترسی شماست.'});
    const r={id:`ref-${Date.now()}`,title:String(b.title).trim(),message:b.message??null,sourcePersonId:b.sourcePersonId??null,targetPersonId:b.targetPersonId??null,sourceOrganizationId:b.sourceOrganizationId??null,targetOrganizationId:b.targetOrganizationId??null,relationshipId:b.relationshipId??null,status:'PENDING',createdById:authUser.id,recipientUserId:b.recipientUserId??null,completedAt:null,notes:null,createdAt:nowIso()};
    DB.referrals.unshift(r); saveDb();
    audit(req,'CREATE','Referral',r.id,'OK',{meta:{title:r.title,status:'PENDING'}});
    return json(res,201,{...r,createdBy:userById(r.createdById)?{id:r.createdById,name:userById(r.createdById).name}:null,recipientUser:userById(r.recipientUserId)?{id:r.recipientUserId,name:userById(r.recipientUserId).name}:null});
  }
  const refPatch=match('/core-domain/referrals/:id');
  if(refPatch&&method==='PATCH'){
    const b=await readBody(req);
    const r=(DB.referrals??[]).find(x=>x.id===refPatch[0]);
    if(!r) return json(res,404,{message:'معرفی یافت نشد.'});
    if(!authUser?.isOwner&&!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'این معرفی خارج از محدودهٔ دسترسی شماست.'});
    const before={...r};
    if(b.title!==undefined){ if(!String(b.title).trim()) return json(res,400,{message:'عنوان معرفی لازم است.'}); r.title=String(b.title).trim(); }
    if(b.message!==undefined) r.message=b.message??null;
    if(b.notes!==undefined) r.notes=b.notes??null;
    if(b.status!==undefined&&b.status!==r.status){
      const allowed=REF_STATUS_FLOW[r.status]??[];
      if(!allowed.includes(b.status)) return json(res,409,{message:`تغییر وضعیت از «${r.status}» به «${b.status}» مجاز نیست.`});
      r.status=b.status;
      r.completedAt=(b.status==='COMPLETED')?nowIso():null;
    }
    saveDb();
    audit(req,'UPDATE','Referral',r.id,'OK',{meta:{title:r.title,from:before.status,to:r.status,reason:'Referral status changed'}});
    return json(res,200,r);
  }
  /* ---------- enterprise governance engine (EnterpriseController parity) ---------- */
  const entOrgIds=(qOrg)=>authUser?.isOwner?(qOrg?[qOrg]:null):(qOrg&&visibleOrgIds(req).includes(qOrg)?[qOrg]:visibleOrgIds(req));
  const entRowInScope=(row,orgIds)=>orgIds===null?true:row.organizationId==null||orgIds.includes(row.organizationId);
  const entReadOk=()=>!!(authUser?.isOwner||(authUser?.permissions??[]).includes('enterprise.read'));
  const entAdminOk=()=>!!(authUser?.isOwner||(authUser?.permissions??[]).includes('enterprise.admin'));
  if(is('/enterprise/overview')&&method==='GET'){
    if(!entReadOk()) return json(res,403,{message:'شما مجوز «مشاهده حاکمیت سازمانی» (enterprise.read) را ندارید.'});
    const qOrg=q.get('organizationId')??null;
    const orgIds=entOrgIds(qOrg);
    const inScope=(o)=>orgIds===null||o.organizationId==null||orgIds.includes(o.organizationId);
    const policies=(DB.authorizationPolicies??[]).filter(inScope);
    const securityEvents=(DB.securityEvents??[]).filter(e=>orgIds===null||e.organizationId==null||orgIds.includes(e.organizationId));
    const exportsLog=(DB.exportLog??[]).filter(inScope);
    const flags=(DB.featureFlags??[]).filter(f=>qOrg?(!f.organizationId||f.organizationId===qOrg):true);
    return json(res,200,{
      governance:{
        policies:policies.length,
        securityEvents:securityEvents.length,
        featureFlags:flags.length,
        enabledFeatureFlags:flags.filter(f=>f.enabled).length,
        organizations:orgById(qOrg)?1:ORGS.length,
      },
      exports:{total:exportsLog.length},
      classification:{documents:{}},
      ownership:{organizations:ORGS.length},
    });
  }
  if(is('/enterprise/policies')&&method==='GET'){
    if(!entReadOk()) return json(res,403,{message:'شما مجوز «مشاهده حاکمیت سازمانی» (enterprise.read) را ندارید.'});
    const qOrg=q.get('organizationId')??null;
    const orgIds=entOrgIds(qOrg);
    const rows=(DB.authorizationPolicies??[]).filter(r=>orgIds===null||r.organizationId==null||orgIds.includes(r.organizationId))
      .sort((a,b)=>String(b.updatedAt??b.createdAt??'').localeCompare(String(a.updatedAt??a.createdAt??'')));
    return json(res,200,{policies:rows.map(authorizationPolicyView)});
  }
  if(is('/enterprise/policies')&&method==='POST'){
    if(!entAdminOk()) return json(res,403,{message:'شما مجوز «مدیریت کل سامانه» (enterprise.admin) را ندارید.'});
    const b=await readBody(req);
    const key=String(b.key??'').trim();
    if(!key||!/^[a-z][a-z0-9_\-]{1,63}$/.test(key)) return json(res,400,{message:'کلید سیاست باید لاتین کوچک (حروف، عدد، خط تیره/زیرخط) باشد.'});
    const effect=b.effect==='DENY'?'DENY':b.effect==='ALLOW'?'ALLOW':null;
    if(!effect) return json(res,400,{message:'اثر سیاست باید ALLOW یا DENY باشد.'});
    const permissionKey=String(b.permissionKey??'').trim();
    const perm=PERMISSIONS.find(x=>x.key===permissionKey);
    if(!permissionKey||!perm) return json(res,403,{message:`مجوز «${b.permissionKey}» در کاتالوگ مجوزها وجود ندارد.`});
    const orgId=b.organizationId??null;
    if(orgId&&!orgById(orgId)) return json(res,400,{message:'سازمان انتخابی نامعتبر است.'});
    const fields={permissionKey,effect,role:b.role??null,organizationId:orgId,department:b.department??null,
      maxDataClassification:b.maxDataClassification??null,ownerOnly:!!b.ownerOnly,subjectScope:b.subjectScope??null,
      conditions:b.conditions??null,enabled:b.enabled!==false,createdById:authUser.id};
    DB.authorizationPolicies=DB.authorizationPolicies??[];
    const i=DB.authorizationPolicies.findIndex(x=>x.key===key);
    let row;
    if(i>=0){ row=Object.assign(DB.authorizationPolicies[i],fields,{updatedAt:nowIso()}); }
    else{ row={id:`abac-${Date.now()}`,key,...fields,createdAt:nowIso(),updatedAt:nowIso()}; DB.authorizationPolicies.push(row); }
    audit(req,'PERMISSION_CHANGE','AuthorizationPolicy',row.id,'OK',{meta:{key:row.key,permissionKey:row.permissionKey,effect:row.effect,organizationId:row.organizationId??null,enabled:row.enabled,reason:'ABAC policy upserted'},after:authorizationPolicyView(row)});
    saveDb();
    return json(res,i>=0?200:201,authorizationPolicyView(row));
  }
  const entPolicyDel=match('/enterprise/policies/:id');
  if(entPolicyDel&&method==='DELETE'){
    if(!entAdminOk()) return json(res,403,{message:'شما مجوز «مدیریت کل سامانه» (enterprise.admin) را ندارید.'});
    const row=(DB.authorizationPolicies??[]).find(x=>x.id===entPolicyDel[0]);
    if(!row) return json(res,404,{message:'سیاست دسترسی یافت نشد.'});
    const before={...row};
    row.enabled=false; row.updatedAt=nowIso();
    audit(req,'PERMISSION_CHANGE','AuthorizationPolicy',row.id,'OK',{meta:{key:row.key,permissionKey:row.permissionKey,effect:row.effect,organizationId:row.organizationId??null,enabled:false,reason:'ABAC policy disabled'},before,after:{...row}});
    saveDb();
    return json(res,200,authorizationPolicyView(row));
  }
  if(is('/enterprise/security-events')&&method==='GET'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('enterprise.security')) return json(res,403,{message:'شما مجوز «حاکمیت و امنیت سازمانی» (enterprise.security) را ندارید.'});
    const qOrg=q.get('organizationId')??null;
    const orgIds=entOrgIds(qOrg);
    const rows=(DB.securityEvents??[]).filter(e=>orgIds===null||e.organizationId==null||orgIds.includes(e.organizationId))
      .sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))).slice(0,200);
    return json(res,200,rows.map(securityEventView));
  }
  /* ------------------- ops: health/metrics/observability (real parity) ------------------- */
  const OPS_MSG = 'شما مجوز «مشاهده سنجه‌ها» (metrics.read) را ندارید.';
  const opsOk = authUser?.isOwner || (authUser?.permissions ?? []).includes('metrics.read');
  const sn = metricsSnapshotNow();
  if(method==='GET' && is('/health')) return json(res,200,healthStatusNow());
  if(method==='GET' && (is('/health/liveness') || is('/health/live'))) return json(res,200,{status:'ok',service:'srip-api',timestamp:nowIso()});
  if(method==='GET' && (is('/health/readiness') || is('/health/ready'))){
    const st = healthStatusNow();
    const ok = st.status==='ok';
    res.writeHead(ok?200:503,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify({status:ok?'ready':'not_ready',dependencies:st.dependencies}));
    return;
  }
  if(method==='GET' && is('/metrics')){
    res.writeHead(200,{'Content-Type':'text/plain; version=0.0.4','Cache-Control':'no-store'});
    res.end(prometheusTextNow(sn));
    return;
  }
  if(method==='GET' && is('/observability/metrics')){
    res.writeHead(200,{'Content-Type':'text/plain; version=0.0.4','Cache-Control':'no-store'});
    res.end(prometheusTextNow(sn));
    return;
  }
  const OPS_GATED = [
    ['/metrics/summary',()=>sn],['/metrics/api-latency',()=>sn.apiLatency],['/metrics/db-latency',()=>sn.dbLatency],
    ['/metrics/ai',()=>sn.ai],['/metrics/storage',()=>sn.storage],['/observability/summary',()=>sn],['/observability/queue',()=>sn.queue],['/observability/events',()=>opsEventsNow()],
  ];
  for(const [p,fn] of OPS_GATED){
    if(is(p) && method==='GET'){
      if(!opsOk) return json(res,403,{message:OPS_MSG});
      return json(res,200,fn());
    }
  }
  const hasPerm=(perm)=>authUser?.isOwner||(authUser?.permissions??[]).includes(perm);
  if(is('/privacy/consents')&&method==='GET'){
    if(!hasPerm('privacy.read')) return json(res,403,{message:'شما مجوز «مشاهده حریم خصوصی» (privacy.read) را ندارید.'});
    const rows=(DB.consentRecords??[]).filter(c=>c.userId===authUser.id).sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
    return json(res,200,rows.map(consentView));
  }
  if(is('/privacy/consents')&&method==='POST'){
    if(!hasPerm('privacy.access')) return json(res,403,{message:'شما مجوز ثبت رضایت (privacy.access) را ندارید.'});
    const b=await readBody(req);
    if(!String(b.purpose??'').trim()||!String(b.version??'').trim()) return json(res,400,{message:'هدف و نسخهٔ رضایت لازم است.'});
    const purpose=String(b.purpose).trim(), version=String(b.version).trim(), source=String(b.source??'USER').toUpperCase();
    DB.consentRecords=DB.consentRecords??[];
    const exist=DB.consentRecords.find(c=>c.userId===authUser.id&&c.purpose===purpose&&c.version===version);
    let row;
    if(exist){ exist.status='GRANTED'; exist.grantedAt=nowIso(); exist.revokedAt=null; exist.source=source; row=exist; }
    else { row={id:`cons-${Date.now()}`,userId:authUser.id,purpose,version,source,status:'GRANTED',grantedAt:nowIso(),revokedAt:null,createdAt:nowIso()}; DB.consentRecords.push(row); }
    saveDb();
    audit(req,'CREATE','PrivacyData',row.id,'OK',{meta:{kind:'consent',purpose,version,source,status:'GRANTED'}});
    return json(res,200,consentView(row));
  }
  if(is('/privacy/consents/revoke')&&method==='POST'){
    if(!hasPerm('privacy.access')) return json(res,403,{message:'شما مجوز ثبت رضایت (privacy.access) را ندارید.'});
    const b=await readBody(req);
    const row=(DB.consentRecords??[]).find(c=>c.userId===authUser.id&&c.purpose===String(b.purpose??'')&&c.version===String(b.version??''));
    if(!row) return json(res,404,{message:'رضایتی با این هدف و نسخه برای شما ثبت نشده است.'});
    if(row.status!=='GRANTED') return json(res,400,{message:'این رضایت در وضعیت فعال نیست.'});
    row.status='REVOKED'; row.revokedAt=nowIso();
    saveDb();
    audit(req,'UPDATE','PrivacyData',row.id,'OK',{meta:{kind:'consent',purpose:row.purpose,version:row.version,status:'REVOKED'}});
    return json(res,200,consentView(row));
  }
  if(is('/privacy/requests')&&method==='GET'){
    if(!hasPerm('privacy.read')) return json(res,403,{message:'شما مجوز «مشاهده حریم خصوصی» (privacy.read) را ندارید.'});
    const rows=(DB.privacyRequests??[]).filter(x=>x.userId===authUser.id).sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
    return json(res,200,rows.map(privacyRequestView));
  }
  if(is('/privacy/requests')&&method==='POST'){
    if(!hasPerm('privacy.access')) return json(res,403,{message:'شما مجوز ثبت درخواست حق داده (privacy.access) را ندارید.'});
    const b=await readBody(req);
    const type=String(b.type??'').toUpperCase();
    if(!PRIVACY_TYPES.includes(type)) return json(res,400,{message:`نوع درخواست «${b.type}» نامعتبر است (ACCESS/EXPORT/ERASURE).`});
    const open=(DB.privacyRequests??[]).find(x=>x.userId===authUser.id&&x.type===type&&['PENDING','PROCESSING'].includes(x.status));
    if(open) return json(res,200,privacyRequestView(open));
    const row={id:`pr-${Date.now()}`,userId:authUser.id,type,reason:String(b.reason??'').trim()||null,status:'PENDING',result:null,createdAt:nowIso(),completedAt:null};
    DB.privacyRequests=DB.privacyRequests??[];
    DB.privacyRequests.push(row);
    saveDb();
    audit(req,'CREATE','PrivacyRequest',row.id,'OK',{meta:{type,reason:row.reason??null,reasonCode:`privacy-${type.toLowerCase()}`}});
    return json(res,201,privacyRequestView(row));
  }
  const privacyStatus=match('/privacy/requests/:id/export/status');
  if(privacyStatus&&method==='GET'){
    if(!hasPerm('privacy.export')) return json(res,403,{message:'شما مجوز «خروجی حریم خصوصی» (privacy.export) را ندارید.'});
    const row=(DB.privacyRequests??[]).find(x=>x.id===privacyStatus[0]&&x.userId===authUser.id&&['ACCESS','EXPORT'].includes(x.type));
    if(!row) return json(res,404,{message:'درخواست حریم خصوصی یافت نشد.'});
    const r2=row.result??{};
    return json(res,200,{status:row.status,requestId:row.id,completedAt:row.completedAt??null,totalRecords:r2.totalRecords??null,manifestUrl:row.status==='COMPLETED'?`/privacy/requests/${row.id}/manifest`:null});
  }
  const privacyManifest=match('/privacy/requests/:id/manifest');
  if(privacyManifest&&method==='GET'){
    if(!hasPerm('privacy.export')) return json(res,403,{message:'شما مجوز «خروجی حریم خصوصی» (privacy.export) را ندارید.'});
    const manifest=(DB.privacyManifests??{})[privacyManifest[0]];
    if(!manifest) return json(res,404,{message:'خروجی درخواست یافت نشد.'});
    const body=JSON.stringify(manifest,null,2);
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="srip-privacy-${privacyManifest[0]}.json"`});
    return res.end(body);
  }
  const privacyReq=match('/privacy/requests/:id/:verb');
  if(privacyReq&&method==='POST'){
    const verb=privacyReq[1];
    if(!['access','export','erase'].includes(verb)) return json(res,400,{message:'عملیات نامعتبر است.'});
    const permNeeded=verb==='erase'?'privacy.erase':verb==='export'?'privacy.export':'privacy.access';
    if(!hasPerm(permNeeded)) return json(res,403,{message:`شما مجوز لازم (${permNeeded}) را ندارید.`});
    const crossUser=verb==='erase';
    const row=(DB.privacyRequests??[]).find(x=>x.id===privacyReq[0]&&(crossUser?true:x.userId===authUser.id));
    if(!row) return json(res,404,{message:'درخواست حریم خصوصی یافت نشد.'});
    if(row.userId!==authUser.id&&!authUser.isOwner) return json(res,403,{message:'اجرای پاک‌سازی برای کاربران دیگر فقط توسط مالک ممکن است.'});
    if(verb==='erase'){
      if(row.type!=='ERASURE') return json(res,400,{message:'پاک‌سازی فقط روی درخواست از نوع ERASURE ممکن است.'});
      if(row.status==='COMPLETED') return json(res,400,{message:'این درخواست از قبل پردازش شده است.'});
      const blocked=(DB.retentionPolicies??[]).filter(p=>p.active!==false&&!p.erasable&&p.legalBasis==='LEGAL_OBLIGATION').map(p=>p.entityType);
      const u=userById(row.userId);
      if(u){
        // anonymization parity: name/email replaced, credentials dropped, sessions die
        // automatically because bearer tokens resolve the user by email claim.
        const anonId=String(row.userId).slice(0,8);
        const oldEmail=u.email;
        u.name=`Erased User ${anonId}`;
        u.email=`erased+${anonId}@privacy.invalid`;
        u.passwordHash=null; u.salt=null;
        u.isActive=false; u.emailVerifiedAt=null; u.deletedAt=nowIso();
        u.memberships=[]; u.permissions=[]; u.accessibleOrganizationIds=[];
        NOTIFICATIONS.filter(n=>n.userId===row.userId).forEach(n=>{n.body='[حذف‌شده بنا به درخواست حریم خصوصی]';n.title='—';});
        // migrate the erased user's entry keyed by old email in mock DB
        if(DB.users[oldEmail]===u) delete DB.users[oldEmail];
        DB.users[u.email]=u;
        DB.erasedUsers=DB.erasedUsers??[];
        DB.erasedUsers.push({id:row.userId,oldEmail,requestId:row.id,erasedAt:nowIso()});
      }
      (DB.privacyRequests??[]).filter(x=>x.userId===row.userId&&['PENDING','PROCESSING'].includes(x.status)).forEach(x=>{x.status='COMPLETED';x.completedAt=nowIso();x.result={blockedLegalRetention:blocked};});
      DB.lifecycleRecords=DB.lifecycleRecords??[];
      DB.lifecycleRecords.push({id:`lr-${Date.now()}`,entityType:'UserPrivacyData',entityId:row.userId,state:'PURGED',actorId:authUser.id,reason:'gdpr-erasure-anonymization',transitionedAt:nowIso()});
      audit(req,'DELETE','UserPrivacyData',row.userId,'OK',{meta:{reason:'gdpr-erasure-anonymization',legalRetention:blocked}});
      saveDb();
      return json(res,200,{status:'COMPLETED',anonymized:true,legalRetention:blocked});
    }
    if(!['ACCESS','EXPORT'].includes(row.type)) return json(res,400,{message:`این عملیات فقط برای درخواست‌های ACCESS/EXPORT است (نوع فعلی: ${row.type}).`});
    if(row.status==='COMPLETED'){
      const res2=row.result??{};
      return json(res,200,{status:row.status,requestId:row.id,completedAt:row.completedAt??null,totalRecords:res2.totalRecords??null,manifestUrl:`/privacy/requests/${row.id}/manifest`});
    }
    const out=runPrivacyExport(req,row.id,row.type==='ACCESS'?'ACCESS':'EXPORT');
    if(!out) return json(res,404,{message:'درخواست یافت نشد.'});
    return json(res,200,out);
  }
  if(is('/privacy/lifecycle')&&method==='POST'){
    if(!hasPerm('privacy.manage')) return json(res,403,{message:'شما مجوز «مدیریت نگهداری» (privacy.manage) را ندارید.'});
    const b=await readBody(req);
    const state=String(b.state??'').toUpperCase();
    const allowed=['CREATION','ACTIVE','ARCHIVED','RETENTION','DELETION'];
    if(!allowed.includes(state)) return json(res,400,{message:`وضعیت «${b.state}» نامعتبر است؛ فقط ${allowed.join('/')} مجاز است.`});
    if(!String(b.entityType??'').trim()||!String(b.entityId??'').trim()) return json(res,400,{message:'نوع و شناسهٔ نهاد لازم است.'});
    DB.lifecycleRecords=DB.lifecycleRecords??[];
    const row={id:`lr-${Date.now()}`,entityType:String(b.entityType).trim(),entityId:String(b.entityId).trim(),state,actorId:authUser.id,reason:String(b.reason??'').trim()||null,metadata:null,transitionedAt:nowIso()};
    DB.lifecycleRecords.push(row);
    audit(req,'UPDATE','DataLifecycleRecord',row.id,'OK',{meta:{reason:b.reason??`lifecycle-${state.toLowerCase()}`,entityType:row.entityType,entityId:row.entityId,state},after:row});
    saveDb();
    return json(res,201,row);
  }
  /* ---------- data lifecycle (DataLifecycleController parity) ---------- */
  const LIFECYCLE_ENTITY_TABLES={Interaction:{store:'INTERACTIONS',key:'id'},Meeting:{store:'MEETINGS',key:'id'},Person:{store:'PEOPLE',key:'id'},Organization:{store:'ORGS',key:'id'},Relationship:{store:'RELS',key:'id'}};
  if(is('/data-lifecycle/status')&&method==='GET'){
    if(!hasPerm('data.lifecycle_status')) return json(res,403,{message:'شما مجوز «مشاهده چرخهٔ حیات داده» (data.lifecycle_status) را ندارید.'});
    const rows=DB.lifecycleRecords??[];
    const byState={},byEntity={};
    for(const r of rows){ byState[r.state]=(byState[r.state]??0)+1; byEntity[r.entityType]=(byEntity[r.entityType]??0)+1; }
    const pendingDelete=(DB.approvals??[]).filter(a=>a.actionType==='DELETE'&&a.status==='PENDING').length;
    const recent=[...rows].sort((a,b)=>String(b.transitionedAt??'').localeCompare(String(a.transitionedAt??''))).slice(0,20)
      .map(r=>({...r,actorName:userById(r.actorId)?.name??null}));
    return json(res,200,{totalLifecycleRecords:rows.length,byState,byEntityType:byEntity,pendingDeletionApprovals:pendingDelete,entities:Object.keys(LIFECYCLE_ENTITY_TABLES),states:LIFECYCLE_STATES,recent:{records:recent}});
  }
  const dlRestore=match('/data-lifecycle/:entityType/:id/restore');
  if(dlRestore&&method==='POST'){
    if(!hasPerm('data.restore')) return json(res,403,{message:'شما مجوز «بازیابی داده» (data.restore) را ندارید.'});
    const et=dlRestore[0], eid=dlRestore[1];
    const cfg=LIFECYCLE_ENTITY_TABLES[et];
    if(!cfg) return json(res,400,{message:`نوع نهاد «${et}» برای بازگردانی پشتیبانی نمی‌شود.`});
    const store=et==='Interaction'?INTERACTIONS:et==='Meeting'?MEETINGS:et==='Person'?PEOPLE:et==='Organization'?ORGS:et==='Relationship'?RELS:null;
    const row=store.find(x=>x.id===eid);
    if(!row||!row.deletedAt) return json(res,400,{message:'فقط نهادهای بایگانی‌شده (حذف نرم) قابل بازگردانی هستند.'});
    row.deletedAt=null; row.deletedById=null;
    DB.lifecycleRecords=DB.lifecycleRecords??[];
    DB.lifecycleRecords.push({id:`lr-${Date.now()}`,entityType:et,entityId:eid,state:'RESTORED',actorId:authUser.id,reason:'restore',transitionedAt:nowIso()});
    audit(req,'RESTORE',et,eid,'OK',{meta:{reason:'restore'}});
    saveDb();
    return json(res,200,{id:eid,entityType:et,status:'RESTORED',restoredAt:nowIso()});
  }
  const dlPurge=match('/data-lifecycle/:entityType/:id/permanent-delete');
  if(dlPurge&&method==='POST'){
    if(!hasPerm('data.permanent_delete')) return json(res,403,{message:'شما مجوز «حذف دائمی داده» (data.permanent_delete) را ندارید.'});
    const et=dlPurge[0], eid=dlPurge[1];
    const cfg=LIFECYCLE_ENTITY_TABLES[et];
    if(!cfg) return json(res,400,{message:`نوع نهاد «${et}» برای حذف دائمی پشتیبانی نمی‌شود (Organization/Person از مسیر تأیید حذف پشتیبانی می‌شوند).`});
    const b=await readBody(req);
    const dup=(DB.approvals??[]).find(x=>x.entityType==='DataLifecycle'&&x.entityId===eid&&x.actionType==='DELETE'&&x.status==='PENDING');
    if(dup) return json(res,200,approvalView(dup));
    const row={id:`ap-${Date.now()}`,entityType:'DataLifecycle',entityId:eid,actionType:'DELETE',organizationId:b.organizationId??authUser?.orgId??null,requestedById:authUser.id,decidedById:null,status:'PENDING',reason:b.reason??`حذف دائمی ${et} ${eid}`,before:null,after:{entityType:et},createdAt:nowIso(),decidedAt:null};
    DB.approvals.push(row); saveDb();
    audit(req,'APPROVAL_REQUESTED','Approval',row.id,'OK',{meta:{actionType:'DELETE',entityType:'DataLifecycle',entityId:eid}});
    return json(res,201,approvalView(row));
  }
  if(is('/security/events')&&method==='GET'){
    if(!(authUser?.permissions??[]).includes('security.read')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «مشاهده امنیت» (security.read) را ندارید.'});
    const take=Math.min(Number(q.get('take'))||200,500);
    const orgIds=authUser?.isOwner?null:visibleOrgIds(req);
    const rows=(DB.securityEvents??[]).filter(x=>orgIds===null?true:(x.userId===authUser.id||(x.organizationId&&orgIds.includes(x.organizationId))));
    return json(res,200,rows.slice(0,take).map(securityEventView));
  }
  if(is('/security/exports')&&method==='GET'){
    if(!(authUser?.permissions??[]).includes('audit.read')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «مشاهده ممیزی» (audit.read) را ندارید.'});
    const take=Math.min(Number(q.get('take'))||200,500);
    const orgIds=authUser?.isOwner?null:visibleOrgIds(req);
    const rows=(DB.exportLog??[]).filter(x=>orgIds===null?true:(x.userId===authUser.id||(x.organizationId&&orgIds.includes(x.organizationId))));
    return json(res,200,rows.slice(0,take).map(exportView));
  }
  if(is('/enterprise/exports')&&method==='GET'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('enterprise.read')) return json(res,403,{message:'شما مجوز «مشاهده حاکمیت سازمانی» (enterprise.read) را ندارید.'});
    const qOrg=q.get('organizationId')??null;
    const orgIds=authUser?.isOwner?(qOrg?[qOrg]:null):(qOrg&&visibleOrgIds(req).includes(qOrg)?[qOrg]:visibleOrgIds(req));
    const rows=(DB.exportLog??[]).filter(x=>orgIds===null?true:x.organizationId==null||orgIds.includes(x.organizationId));
    return json(res,200,rows.slice(0,100).map(exportView).sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))));
  }
  if(is('/enterprise/exports')&&method==='POST'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('enterprise.export')) return json(res,403,{message:'شما مجوز «صدور خروجی سازمانی» (enterprise.export) را ندارید.'});
    const b=await readBody(req);
    if(!String(b.exportType||'').trim()) return json(res,400,{message:'نوع خروجی لازم است.'});
    if(b.organizationId&&!orgById(b.organizationId)) return json(res,400,{message:'سازمان انتخابی نامعتبر است.'});
    if(b.classification&&!DATA_CLASSIFICATIONS.includes(String(b.classification))) return json(res,400,{message:`طبقه‌بندی «${b.classification}» نامعتبر است.`});
    const row={id:`ex-${Date.now()}`,userId:authUser.id,organizationId:b.organizationId??null,exportType:String(b.exportType),entityType:b.entityType??null,recordCount:Number(b.recordCount)||0,classification:b.classification??'INTERNAL',requestId:b.requestId??null,ipAddress:req.socket?.remoteAddress??null,createdAt:nowIso()};
    DB.exportLog.unshift(row);
    audit(req,'EXPORT','Report',row.id,'OK',{meta:{exportType:row.exportType,classification:row.classification,format:'CSV',approval:row.requestId??null,reason:'Enterprise export record'}});
    return json(res,201,exportView(row));
  }
  if(is('/security/governance/preflight')&&method==='GET'){
    if(!(authUser?.permissions??[]).includes('enterprise.security')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «حاکمیت و امنیت سازمانی» (enterprise.security) را ندارید.'});
    const policies=(DB.retentionPolicies??[]).filter(p=>p.active!==false);
    const erasableNoRetention=policies.filter(p=>p.erasable&&!p.retentionDays).length;
    const checks=[
      {key:'origin-check',status:'PASS',detail:'محافظت از تغییرات متقاطع (origin) فعال است.'},
      {key:'rate-limit-fail-open',status:'PASS',detail:'محدودسازی نرخ در حالت خطا بسته (fail-closed) می‌ماند.'},
      {key:'file-scan',status:'WARN',detail:'در حالت دمو پویش بدافزار برای بارگذاری فایل الزامی نیست؛ در محیط واقعی فعال شود.'},
      {key:'secret-manager',status:'PASS',detail:'کلیدهای دمو در حافظه ساخته می‌شوند و در سورس کنترل نگهداری نمی‌شوند.'},
      {key:'data-policy-coverage',status:policies.length?(erasableNoRetention?'WARN':'PASS'):'FAIL',detail:policies.length?`${policies.length} خط‌مشی داده فعال؛ ${erasableNoRetention} خط‌مشی پاک‌شدنی بدون دورهٔ نگهداری.`:'هیچ خط‌مشی دادهٔ فعالی پیکربندی نشده است.'},
    ];
    const overall=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='WARN')?'WARN':'PASS';
    return json(res,200,{generatedAt:nowIso(),overall,checks});
  }
  if(is('/sessions')&&method==='GET'){
    if(!authUser) return json(res,401,{message:'احراز هویت لازم است.'});
    const sid=currentSid(req);
    const rows=(DB.sessions??[]).filter(x=>x.userId===authUser.id)
      .map(x=>sessionView(x,sid))
      .sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))).slice(0,100);
    return json(res,200,rows);
  }
  const ownSess=match('/sessions/:id');
  if(ownSess&&method==='DELETE'){
    if(!authUser) return json(res,401,{message:'احراز هویت لازم است.'});
    const row=(DB.sessions??[]).find(x=>x.id===ownSess[0]&&x.userId===authUser.id);
    if(!row) return json(res,404,{message:'نشست یافت نشد.'});
    if(!row.revokedAt){ row.revokedAt=nowIso(); }
    saveDb();
    return json(res,200,{count:1});
  }
  if(is('/sessions/revoke-all')&&method==='POST'){
    if(!authUser) return json(res,401,{message:'احراز هویت لازم است.'});
    const n=revokeSessionRows((DB.sessions??[]).filter(x=>x.userId===authUser.id&&!x.revokedAt).map(x=>x.id),nowIso());
    saveDb();
    return json(res,200,{count:n});
  }
  if(is('/sessions/revoke-all-except-current')&&method==='POST'){
    if(!authUser) return json(res,401,{message:'احراز هویت لازم است.'});
    const sid=currentSid(req);
    const n=revokeSessionRows((DB.sessions??[]).filter(x=>x.userId===authUser.id&&!x.revokedAt&&x.id!==sid).map(x=>x.id),nowIso());
    saveDb();
    return json(res,200,{count:n});
  }
  const admSess=match('/sessions/admin/:userId/:sessionId/revoke');
  if(admSess&&method==='POST'){
    if(!authUser?.isOwner&&!(authUser?.permissions??[]).includes('session.admin.revoke')) return json(res,403,{message:'شما مجوز «ابطال مدیریتی نشست» (session.admin.revoke) را ندارید.'});
    const row=(DB.sessions??[]).find(x=>x.id===admSess[1]&&x.userId===admSess[0]);
    if(!row) return json(res,404,{message:'نشست یافت نشد.'});
    const wasRevoked=!!row.revokedAt;
    if(!wasRevoked) row.revokedAt=nowIso();
    audit(req,'LOGOUT','Session',row.id,'OK',{meta:{reason:'admin-session-revoked',userId:row.userId,revoked:true,wasRevoked}});
    saveDb();
    return json(res,200,{count:wasRevoked?0:1,id:row.id,revokedAt:row.revokedAt});
  }
  /* ------------------------------------------------------------------
     workflows (WorkflowsService parity)
       GET  /workflows                     → list (workflow.read)
       POST /workflows                     → create (workflow.write)
       POST /workflows/:id/execute         → run from index 0 (workflow.execute)
       POST /workflows/trigger             → run all matching event-triggered
       POST /workflows/executions/:id/resume
       POST /workflows/executions/:id/approval
       POST /workflows/approvals/:id/decision
     Actions: CREATE_NOTIFICATION / CREATE_ACTION / CREATE_COMMITMENT /
              CREATE_OPPORTUNITY / REQUEST_APPROVAL / WAIT
  ------------------------------------------------------------------ */
  function wfPerm(p){ return authUser?.isOwner || (authUser?.permissions??[]).includes(p); }
  function wfScopeOk(wf){ return !wf.organizationId || inScope(req,wf.organizationId); }
  function wfEntityOrgId(type,id){
    const t=String(type??'').toLowerCase();
    if(t==='organization') return orgById(id)?.id??null;
    if(t==='person') return personById(id)?.organizationId??null;
    if(t==='relationship') return RELS.find(r=>r.id===id)?.sourceOrganizationId??null;
    const e=(arr)=>arr.find(x=>x.id===id);
    if(t==='meeting') return e(MEETINGS)?.organizationId??null;
    if(t==='commitment') return e(COMMITMENTS)?.organizationId??null;
    if(t==='project') return e(PROJECTS)?.organizationId??null;
    if(t==='opportunity') return e(OPPORTUNITIES)?.organizationId??null;
    if(t==='action'){ const a=e(ACTIONS); if(a?.organizationId) return a.organizationId; const r=a?.relationshipId?RELS.find(x=>x.id===a.relationshipId):null; return r?.sourceOrganizationId??null; }
    return null;
  }
  function wfEntityExists(type,id){
    const t=String(type??'').toLowerCase();
    if(t==='organization') return !!orgById(id);
    if(t==='person') return !!personById(id);
    if(t==='relationship') return RELS.some(r=>r.id===id);
    if(t==='meeting') return MEETINGS.some(x=>x.id===id);
    if(t==='commitment') return COMMITMENTS.some(x=>x.id===id);
    if(t==='project') return PROJECTS.some(x=>x.id===id);
    if(t==='opportunity') return OPPORTUNITIES.some(x=>x.id===id);
    if(t==='action') return ACTIONS.some(x=>x.id===id);
    return null; // unknown type → not enforced
  }
  function wfResolveLinks(type,id,context,action,fallbackOrgId){
    const c=context??{};
    const links={
      relationshipId:action.relationshipId??c.relationshipId,
      meetingId:action.meetingId??c.meetingId,
      projectId:action.projectId??c.projectId,
      personId:action.personId??c.personId,
      organizationId:action.organizationId??c.organizationId??fallbackOrgId??null,
      recommendationId:action.recommendationId??c.recommendationId??null,
    };
    const t=String(type??'').toLowerCase();
    if(t==='relationship'&&!links.relationshipId) links.relationshipId=id;
    if(t==='meeting'&&!links.meetingId) links.meetingId=id;
    if(t==='project'&&!links.projectId) links.projectId=id;
    if(t==='person'&&!links.personId) links.personId=id;
    if(t==='organization'&&!links.organizationId) links.organizationId=id;
    if(t==='recommendation'&&!links.recommendationId) links.recommendationId=id;
    return links;
  }
  function wfView(w){
    const actions=Array.isArray(w.definition?.actions)?w.definition.actions:[];
    return {...w,actionCount:actions.length,steps:actions.map(a=>({type:a.type,summary:wfStepSummary(a)})),triggerType:w.definition?.trigger?.type??'MANUAL',organizationName:w.organizationId?orgById(w.organizationId)?.name??null:null};
  }
  function wfStepSummary(a){
    switch(a?.type){
      case 'CREATE_NOTIFICATION': return a.title??'اعلان';
      case 'CREATE_ACTION': return a.title??'اقدام';
      case 'CREATE_COMMITMENT': return a.description??a.title??'تعهد';
      case 'CREATE_OPPORTUNITY': return a.name??'فرصت';
      case 'REQUEST_APPROVAL': return (a.payload?.title??a.payload?.note??'درخواست تأیید');
      case 'WAIT': return `${Number(a.minutes)||1} دقیقه انتظار`;
      default: return String(a?.type??'');
    }
  }
  function wfExecView(e){
    const wf=(DB.workflows??[]).find(x=>x.id===e.workflowId);
    return {...e,workflowName:wf?.name??null,stepCount:Array.isArray(wf?.definition?.actions)?wf.definition.actions.length:0,organizationName:e.organizationId?orgById(e.organizationId)?.name??null:null};
  }
  function wfApprovalView(a){
    const exec=(DB.workflowExecutions??[]).find(x=>x.id===a.workflowExecutionId);
    const rb=userById(a.requestedById); const db_=userById(a.decidedById);
    return {...a,requestedByName:rb?.name??null,requestedByEmail:rb?.email??null,decidedByName:db_?.name??null,decidedByEmail:db_?.email??null,workflowName:exec?(DB.workflows??[]).find(x=>x.id===exec.workflowId)?.name??null:null,entityType:exec?.entityType??null,entityId:exec?.entityId??null};
  }
  async function wfRun(wf,exec,startIndex,log){
    const actions=Array.isArray(wf.definition?.actions)?wf.definition.actions:[];
    exec.status='RUNNING'; exec.finishedAt=null; exec.resumeAt=null;
    try{
      for(let i=Math.max(0,startIndex);i<actions.length;i++){
        exec.currentActionIndex=i;
        const a=actions[i];
        const label=wfStepSummary(a);
        if(a.type==='WAIT'){
          const minutes=Math.max(1,Number(a.minutes??0));
          if(!Number.isFinite(minutes)||minutes<1){ exec.status='FAILED'; exec.finishedAt=nowIso(); exec.context={...(exec.context??{}),error:'مدت انتظار (minutes) باید عددی بزرگ‌تر از صفر باشد.'}; saveDb(); return exec; }
          exec.status='WAITING'; exec.currentActionIndex=i+1; exec.resumeAt=new Date(Date.now()+minutes*60000).toISOString();
          log.push(`⏳ گام ${i+1}: انتظار ${minutes} دقیقه — ادامه در ${exec.resumeAt}`);
          saveDb(); return exec;
        }
        if(a.type==='REQUEST_APPROVAL'){
          const wa={id:`wa-${Date.now()}`,workflowExecutionId:exec.id,status:'PENDING',requestedById:authUser.id,payload:a.payload??{note:'تصویب گردش کار'},decisionReason:null,decidedById:null,decidedAt:null,createdAt:nowIso()};
          DB.workflowApprovals.push(wa);
          exec.status='WAITING'; exec.resumeAt=null; exec.currentActionIndex=i+1;
          exec.context={...(exec.context??{}),pendingApprovalId:wa.id};
          audit(req,'APPROVAL_REQUESTED','WorkflowApproval',wa.id,'OK',{meta:{workflow:exec.workflowId,execution:exec.id,nextActionIndex:i+1}});
          log.push(`⏸ گام ${i+1}: درخواست تأیید گردش کار ثبت شد (${wa.id})`);
          saveDb(); return exec;
        }
        const links=wfResolveLinks(exec.entityType,exec.entityId,exec.context,a,wf.organizationId??wfEntityOrgId(exec.entityType,exec.entityId));
        if(a.type==='CREATE_ACTION'){
          const row={id:`a-${Date.now()}`,title:a.title??'اقدام گردش کار',status:a.status??'OPEN',priority:a.priority??'MEDIUM',dueAt:a.dueAt??null,description:a.description??null,reminderAt:null,meetingId:links.meetingId??null,outcome:null,ownerId:a.ownerId??null,relationshipId:links.relationshipId??null,organizationId:links.organizationId,projectId:links.projectId??null,personId:links.personId??null};
          ACTIONS.push(row); audit(req,'CREATE','action',row.id,'OK',{meta:{title:row.title,reason:`workflow:${wf.id}`,execution:exec.id}});
          log.push(`✓ گام ${i+1}: اقدام «${row.title}» ساخته شد (${row.id})`);
        } else if(a.type==='CREATE_COMMITMENT'){
          const row={id:`c-${Date.now()}`,description:a.description??a.title??'تعهد گردش کار',status:a.status??'OPEN',direction:a.direction??'OURS',risk:a.risk??'MEDIUM',dueAt:a.dueAt??null,reminderAt:null,ownerId:a.ownerId??null,personId:links.personId??null,relationshipId:links.relationshipId??null,meetingId:links.meetingId??null,projectId:links.projectId??null,organizationId:links.organizationId,createdAt:nowIso()};
          COMMITMENTS.push(row); audit(req,'CREATE','commitment',row.id,'OK',{meta:{reason:`workflow:${wf.id}`,execution:exec.id}});
          log.push(`✓ گام ${i+1}: تعهد «${row.description.slice(0,60)}» ساخته شد (${row.id})`);
        } else if(a.type==='CREATE_OPPORTUNITY'){
          const row={id:`o-${Date.now()}`,name:a.name??'فرصت گردش کار',status:a.status??'IDENTIFIED',probability:a.probability??0,value:a.value??0,expectedDate:a.expectedDate??null,organizationId:links.organizationId,relationshipId:links.relationshipId??null,projectId:links.projectId??null,ownerId:a.ownerId??null,createdAt:nowIso()};
          OPPORTUNITIES.push(row); audit(req,'CREATE','opportunity',row.id,'OK',{meta:{name:row.name,reason:`workflow:${wf.id}`,execution:exec.id}});
          log.push(`✓ گام ${i+1}: فرصت «${row.name}» ساخته شد (${row.id})`);
        } else if(a.type==='CREATE_NOTIFICATION'){
          const mapType=(x)=>({INFO:'SYSTEM',REMINDER:'REMINDER',RECOMMENDATION:'RECOMMENDATION'}[x]??x??'SYSTEM');
          const mapPrio=(x)=>(String(x??'MEDIUM').toUpperCase()==='HIGH'||String(x??'').toUpperCase()==='CRITICAL')?'important':'information';
          const row={id:`n-${Date.now()}`,userId:a.userId??authUser.id,title:a.title??'اعلان گردش کار',body:a.body??`گردش کار «${wf.name}» روی ${exec.entityType} ${exec.entityId}`,type:mapType(a.notificationType??'INFO'),priority:mapPrio(a.priority),isRead:false,read:false,createdAt:nowIso(),workflowExecutionId:exec.id,entityType:exec.entityType,entityId:exec.entityId};
          NOTIFICATIONS.push(row); audit(req,'CREATE','Notification',row.id,'OK',{meta:{title:row.title,workflow:wf.id}});
          log.push(`✓ گام ${i+1}: اعلان «${row.title}» صادر شد (${row.id})`);
        } else {
          exec.status='FAILED'; exec.finishedAt=nowIso(); exec.context={...(exec.context??{}),error:`اقدام «${a.type}» در گردش کار پشتیبانی نمی‌شود.`}; saveDb();
          log.push(`✗ گام ${i+1}: نوع اقدام نامعتبر`);
          return exec;
        }
        exec.context={...(exec.context??{}),['stepResult'+(i+1)]:label};
      }
      exec.status='COMPLETED'; exec.finishedAt=nowIso(); exec.currentActionIndex=actions.length; exec.resumeAt=null;
      log.push(`✔ گردش کار با موفقیت کامل شد (${actions.length} گام).`);
      saveDb(); return exec;
    }catch(e){
      exec.status='FAILED'; exec.finishedAt=nowIso(); exec.context={...(exec.context??{}),error:e?.message??'خطا در اجرای گردش کار.'};
      log.push(`✗ خطا: ${e?.message??'نامشخص'}`); saveDb(); return exec;
    }
  }
  function wfStart(req2,wf,entityType,entityId,context,triggerType,log){
    const exec={id:`we-${Date.now()}`,workflowId:wf.id,entityType,entityId,status:'RUNNING',context:context?{...context,triggerType}:{triggerType},resumeAt:null,currentActionIndex:0,requestId:curReqId??null,correlationId:null,startedAt:nowIso(),finishedAt:null,organizationId:wf.organizationId};
    DB.workflowExecutions.push(exec);
    audit(req2,'WORKFLOW_EXECUTED','WorkflowExecution',exec.id,'OK',{meta:{workflow:wf.id,trigger:triggerType,entityType,entityId}});
    return wfRun(wf,exec,0,log);
  }
  function wfConditionsPass(conditions,context){
    return (conditions??[]).every(c=>{
      const value=(c.path??'').split('.').reduce((v,k)=>v==null?undefined:v[k],context);
      if(c.exists!==undefined) return c.exists=== (value!==undefined&&value!==null);
      if('equals' in c) return value===c.equals;
      if('notEquals' in c) return value!==c.notEquals;
      return true;
    });
  }
  if(is('/workflows/executions')&&method==='GET'){
    if(!wfPerm('workflow.read')) return json(res,403,{message:'شما مجوز «مشاهده گردش کارها» (workflow.read) را ندارید.'});
    const rows=(DB.workflowExecutions??[]).filter(e=>{const wf=(DB.workflows??[]).find(x=>x.id===e.workflowId);return wf&&wfScopeOk(wf);}).sort((a,b)=>String(b.startedAt??'').localeCompare(String(a.startedAt??'')));
    return json(res,200,rows.map(wfExecView));
  }
  if(is('/workflows/approvals')&&method==='GET'){
    if(!wfPerm('workflow.read')) return json(res,403,{message:'شما مجوز «مشاهده گردش کارها» (workflow.read) را ندارید.'});
    const rows=(DB.workflowApprovals??[]).filter(a=>{const exec=(DB.workflowExecutions??[]).find(x=>x.id===a.workflowExecutionId);const wf=exec?(DB.workflows??[]).find(x=>x.id===exec.workflowId):null;return wf&&wfScopeOk(wf);}).sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
    return json(res,200,rows.map(wfApprovalView));
  }
  if(is('/workflows')&&method==='GET'){
    if(!wfPerm('workflow.read')) return json(res,403,{message:'شما مجوز «مشاهده گردش کارها» (workflow.read) را ندارید.'});
    const rows=(DB.workflows??[]).filter(w=>wfScopeOk(w)).sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
    return json(res,200,rows.map(wfView));
  }
  if(is('/workflows')&&method==='POST'){
    if(!wfPerm('workflow.write')) return json(res,403,{message:'شما مجوز «ایجاد گردش کار» (workflow.write) را ندارید.'});
    const b=await readBody(req);
    if(!String(b.name??'').trim()||!String(b.entityType??'').trim()||!b.definition) return json(res,400,{message:'نام، نوع نهاد و تعریف گردش کار لازم است.'});
    if(typeof b.definition!=='object'||!Array.isArray(b.definition.actions)) return json(res,400,{message:'تعریف گردش کار نامعتبر است (definition.actions باید آرایه باشد).'});
    for(const a of b.definition.actions){ if(!WF_ACTION_TYPES.includes(a?.type)) return json(res,400,{message:`اقدام «${a?.type}» در گردش کار پشتیبانی نمی‌شود.`}); }
    if(b.organizationId&&!inScope(req,b.organizationId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const row={id:`wf-${Date.now()}`,name:String(b.name).trim(),entityType:String(b.entityType),organizationId:b.organizationId??null,isActive:b.isActive!==false,definition:b.definition,createdAt:nowIso(),updatedAt:nowIso()};
    DB.workflows.push(row); saveDb();
    audit(req,'CREATE','Workflow',row.id,'OK',{meta:{name:row.name,entityType:row.entityType,actions:row.definition.actions.length}});
    return json(res,201,wfView(row));
  }
  const wfExecRoute=match('/workflows/:id/execute');
  if(wfExecRoute&&method==='POST'){
    if(!wfPerm('workflow.execute')) return json(res,403,{message:'شما مجوز «اجرای گردش کار» (workflow.execute) را ندارید.'});
    const wf=(DB.workflows??[]).find(x=>x.id===wfExecRoute[0]);
    if(!wf||wf.deletedAt) return json(res,404,{message:'گردش کار یافت نشد.'});
    if(!wf.isActive) return json(res,404,{message:'گردش کار فعال یافت نشد.'});
    if(!wfScopeOk(wf)) return json(res,403,{message:'گردش کار خارج از محدودهٔ دسترسی شماست.'});
    const b=await readBody(req);
    const entityType=b.entityType??wf.entityType;
    const entityId=String(b.entityId??'');
    if(!entityId) return json(res,400,{message:'شناسهٔ نهاد (entityId) برای اجرا لازم است.'});
    const def=wf.definition??{};
    const triggerType=b.triggerType??'MANUAL';
    if(def.trigger?.type&&def.trigger.type!=='MANUAL'&&def.trigger.type!==triggerType) return json(res,400,{message:'محرک گردش کار مطابقت ندارد.'});
    if(def.trigger?.entityType&&def.trigger.entityType!==entityType) return json(res,400,{message:'نوع نهاد گردش کار مطابقت ندارد.'});
    if(!wfConditionsPass(def.conditions??[],b.context??{})) return json(res,400,{message:'شرط‌های گردش کار برقرار نیستند.'});
    const log=[];
    const exec=await wfStart(req,wf,entityType,entityId,b.context??{},triggerType,log);
    return json(res,200,{...wfExecView(exec),log});
  }
  if(is('/workflows/trigger')&&method==='POST'){
    if(!wfPerm('workflow.execute')) return json(res,403,{message:'شما مجوز «اجرای گردش کار» (workflow.execute) را ندارید.'});
    const b=await readBody(req);
    const entityType=String(b.entityType??''), entityId=String(b.entityId??''), triggerType=String(b.triggerType??'MANUAL');
    if(!entityType||!entityId) return json(res,400,{message:'نوع نهاد و شناسهٔ نهاد برای شبیه‌سازی محرک لازم است.'});
    const out=[];
    for(const wf of (DB.workflows??[]).filter(w=>w.isActive&&w.entityType===entityType&&wfScopeOk(w))){
      const def=wf.definition??{};
      if(def.trigger?.type!==triggerType) continue;
      const log=[];
      const exec=await wfStart(req,wf,entityType,entityId,b.context??{},triggerType,log);
      out.push({...wfExecView(exec),log});
    }
    return json(res,200,out);
  }
  const wfResumeRoute=match('/workflows/executions/:executionId/resume');
  if(wfResumeRoute&&method==='POST'){
    if(!wfPerm('workflow.execute')) return json(res,403,{message:'شما مجوز «اجرای گردش کار» (workflow.execute) را ندارید.'});
    const exec=(DB.workflowExecutions??[]).find(x=>x.id===wfResumeRoute[0]);
    if(!exec) return json(res,404,{message:'اجرای گردش کار یافت نشد.'});
    const wf=(DB.workflows??[]).find(x=>x.id===exec.workflowId);
    if(wf&&!wfScopeOk(wf)) return json(res,403,{message:'گردش کار خارج از محدودهٔ دسترسی شماست.'});
    if(exec.status!=='WAITING') return json(res,400,{message:'اجرا در حالت انتظار نیست.'});
    if(exec.resumeAt&&new Date(exec.resumeAt).getTime()>Date.now()) return json(res,400,{message:'مهلت انتظار گردش کار هنوز نگذشته است.'});
    if(exec.context?.pendingApprovalId) return json(res,400,{message:'این اجرا در انتظار تصمیم تأیید است؛ از مسیر تصمیم‌گیری اقدام کنید.'});
    const log=[`⏩ ادامهٔ اجرا از گام ${(exec.currentActionIndex??0)+1}`];
    const updated=await wfRun(wf,exec,exec.currentActionIndex??0,log);
    return json(res,200,{...wfExecView(updated),log});
  }
  const wfApprovalRoute=match('/workflows/executions/:executionId/approval');
  if(wfApprovalRoute&&method==='POST'){
    if(!wfPerm('workflow.execute')) return json(res,403,{message:'شما مجوز «اجرای گردش کار» (workflow.execute) را ندارید.'});
    const exec=(DB.workflowExecutions??[]).find(x=>x.id===wfApprovalRoute[0]);
    if(!exec) return json(res,404,{message:'اجرای گردش کار یافت نشد.'});
    const b=await readBody(req);
    const wa={id:`wa-${Date.now()}`,workflowExecutionId:exec.id,status:'PENDING',requestedById:authUser.id,payload:b.payload??{note:'تصویب گردش کار'},decisionReason:null,decidedById:null,decidedAt:null,createdAt:nowIso()};
    DB.workflowApprovals.push(wa);
    exec.status='WAITING'; exec.resumeAt=null;
    exec.context={...(exec.context??{}),pendingApprovalId:wa.id};
    saveDb();
    audit(req,'APPROVAL_REQUESTED','WorkflowApproval',wa.id,'OK',{meta:{workflow:exec.workflowId,execution:exec.id}});
    return json(res,201,wfApprovalView(wa));
  }
  const wfDecisionRoute=match('/workflows/approvals/:approvalId/decision');
  if(wfDecisionRoute&&method==='POST'){
    if(!wfPerm('workflow.execute')) return json(res,403,{message:'فقط مالک سامانه می‌تواند درخواست‌های گردش کار را تصمیم بگیرد.'});
    const b=await readBody(req);
    const decision=String(b.decision??'');
    if(!['APPROVED','REJECTED'].includes(decision)) return json(res,400,{message:'تصمیم نامعتبر است (APPROVED یا REJECTED).'});
    const wa=(DB.workflowApprovals??[]).find(x=>x.id===wfDecisionRoute[0]);
    if(!wa) return json(res,404,{message:'درخواست تأیید گردش کار یافت نشد.'});
    if(wa.status!=='PENDING') return json(res,400,{message:'این درخواست از قبل تصمیم‌گیری شده است.'});
    wa.status=decision; wa.decidedById=authUser.id; wa.decisionReason=b.reason??null; wa.decidedAt=nowIso();
    const exec=(DB.workflowExecutions??[]).find(x=>x.id===wa.workflowExecutionId);
    if(exec){
      exec.context={...(exec.context??{}),approvalDecision:decision,approvalReason:b.reason??null,pendingApprovalId:null};
      if(decision==='REJECTED'){
        exec.status='REJECTED'; exec.finishedAt=nowIso(); exec.resumeAt=null;
        saveDb();
        audit(req,'APPROVAL_REJECTED','WorkflowExecution',exec.id,'OK',{meta:{workflow:exec.workflowId,approval:wa.id,reason:b.reason??null}});
        return json(res,200,{approval:wfApprovalView(wa)});
      }
      exec.status='RUNNING'; exec.resumeAt=null;
      saveDb();
      const log=[`✅ تأیید شد؛ ادامه از گام ${(exec.currentActionIndex??0)+1}`];
      const updated=await wfRun((DB.workflows??[]).find(x=>x.id===exec.workflowId),exec,exec.currentActionIndex??0,log);
      return json(res,200,{approval:wfApprovalView(wa),execution:{...wfExecView(updated),log}});
    }
    saveDb();
    return json(res,200,{approval:wfApprovalView(wa)});
  }
  if(is('/approvals')&&method==='GET'){
    const st=String(new URL(req.url,'http://x').searchParams.get('status')||'PENDING');
    const rows=(DB.approvals??[]).filter(a=>a.status===st);
    return json(res,200,rows.sort((a,b)=>String(a.createdAt??'').localeCompare(String(b.createdAt??''))).map(approvalView));
  }
  if(is('/approvals')&&method==='POST'){
    const b=await readBody(req);
    const action=String(b.actionType||'');
    if(!Object.values(APPROVAL_ACTIONS_MOCK).includes(action)) return json(res,400,{message:`عملیات «${b.actionType}» پشتیبانی نمی‌شود.`});
    if(!String(b.entityType||'').trim()) return json(res,400,{message:'نوع نهاد لازم است.'});
    // resource guard per action
    if(action==='STRATEGIC_SCORE_CHANGE'){
      if(!b.entityId) return json(res,400,{message:'انتخاب رابطه لازم است.'});
      const rel=(DB.rels??[]).find(x=>x.id===b.entityId);
      if(!rel) return json(res,404,{message:'رابطه یافت نشد.'});
      if(!relInScope(req,rel)) return json(res,403,{message:'این رابطه خارج از محدودهٔ دسترسی شماست.'});
      const score=Number(b.after?.strategicScore??b.strategicScore);
      if(!Number.isFinite(score)||score<0||score>100) return json(res,400,{message:'امتیاز راهبردی باید بین ۰ تا ۱۰۰ باشد.'});
      b.after={strategicScore:score}; b.before={strategicScore:rel.strategicScore??0}; b.organizationId=b.organizationId??rel.sourceOrganizationId;
    }
    if(action==='SENSITIVE_RELATIONSHIP_CREATE'){
      const d=b.after??b;
      if(!d.sourceOrganizationId||!d.targetOrganizationId) return json(res,400,{message:'سازمان مبدأ و مقصد لازم است.'});
      if(!orgById(d.sourceOrganizationId)||!orgById(d.targetOrganizationId)) return json(res,400,{message:'یکی از سازمان‌ها یافت نشد.'});
      if(d.sourceOrganizationId===d.targetOrganizationId) return json(res,400,{message:'سازمان مبدأ و مقصد نمی‌توانند یکی باشند.'});
      if(!inScope(req,d.sourceOrganizationId)||!inScope(req,d.targetOrganizationId)) return json(res,403,{message:'یکی از سازمان‌ها خارج از محدودهٔ دسترسی شماست.'});
      b.after=d; b.organizationId=b.organizationId??d.sourceOrganizationId;
    }
    if(action==='DELETE'){
      const et=String(b.after?.entityType ?? b.entityType ?? ''); b.after={entityType:et};
      if(et==='Organization'){ const o=orgById(b.entityId); if(!o) return json(res,404,{message:'سازمان یافت نشد.'}); if(!inScope(req,b.entityId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'}); }
      else if(et==='Person'){ const p=personById(b.entityId); if(!p) return json(res,404,{message:'شخص یافت نشد.'}); }
      else return json(res,400,{message:'حذف دائمی فقط برای Organization و Person پشتیبانی می‌شود.'});
    }
    const dup=(DB.approvals??[]).find(x=>x.entityType===String(b.entityType)&&x.entityId===(b.entityId??null)&&x.actionType===action&&x.status==='PENDING');
    if(dup) return json(res,200,approvalView(dup));
    const row={id:`ap-${Date.now()}`,entityType:String(b.entityType),entityId:b.entityId??null,actionType:action,organizationId:b.organizationId??authUser?.orgId??null,requestedById:authUser.id,decidedById:null,status:'PENDING',reason:b.reason??null,before:b.before??null,after:b.after??null,createdAt:nowIso(),decidedAt:null};
    DB.approvals.push(row); saveDb();
    audit(req,'APPROVAL_REQUESTED','Approval',row.id,'OK',{meta:{actionType:action,entityType:row.entityType,entityId:row.entityId,reason:row.reason??null}});
    return json(res,201,approvalView(row));
  }
  const approvalDecision=match('/approvals/:id/:decision');
  if(approvalDecision&&method==='POST'){
    const decision=approvalDecision[1];
    if(!['approve','reject'].includes(decision)) return json(res,400,{message:'تصمیم نامعتبر است.'});
    const b=await readBody(req);
    const a=(DB.approvals??[]).find(x=>x.id===approvalDecision[0]);
    if(!a) return json(res,404,{message:'درخواست تأیید یافت نشد.'});
    const guard=approvalFlowSafe(authUser.id,a,decision,!!authUser?.isOwner);
    if(guard) return json(res,403,{message:guard});
    if(decision==='approve'){
      const applied=approvalApply(req,a,b.reason);
      if(applied&&applied.error) return json(res,applied.code??409,{message:applied.error});
      a.status='APPROVED'; a.decidedById=authUser.id; a.decidedAt=nowIso(); a.decidedReason=b.reason??null;
      if(a.decidedReason!==undefined&&a.reason===null) a.reason=a.decidedReason;
      DB.approvals=DB.approvals; saveDb();
      audit(req,'APPROVAL_APPROVED','Approval',a.id,'OK',{meta:{actionType:a.actionType,entityType:a.entityType,entityId:a.entityId,reason:b.reason??null}});
      return json(res,200,{...approvalView(a),applied:applied??{approved:true}});
    }
    a.status='REJECTED'; a.decidedById=authUser.id; a.decidedAt=nowIso(); a.decidedReason=b.reason??null;
    saveDb();
    audit(req,'APPROVAL_REJECTED','Approval',a.id,'OK',{meta:{actionType:a.actionType,entityType:a.entityType,entityId:a.entityId,reason:b.reason??null}});
    return json(res,200,approvalView(a));
  }
  function approvalApply(req,a,reason){
    try{
      if(a.actionType==='STRATEGIC_SCORE_CHANGE'){
        const rel=(DB.rels??[]).find(x=>x.id===a.entityId);
        if(!rel) return {error:'رابطهٔ هدف یافت نشد.',code:404};
        const before={...rel};
        for(const k of ['strategicScore','healthScore','riskScore','influenceScore','opportunityScore','resilienceScore']){
          if(a.after&&typeof a.after[k]==='number') rel[k]=a.after[k];
        }
        saveDb();
        audit(req,'UPDATE','Relationship',rel.id,'OK',{meta:{before,after:{strategicScore:rel.strategicScore},reason:`approval:${a.id}`,approvalReason:reason??null}});
        return {applied:'STRATEGIC_SCORE_CHANGE',relationshipId:rel.id,strategicScore:rel.strategicScore};
      }
      if(a.actionType==='SENSITIVE_RELATIONSHIP_CREATE'){
        const d=a.after;
        const dup=(DB.rels??[]).find(x=>x.sourceOrganizationId===d.sourceOrganizationId&&x.targetOrganizationId===d.targetOrganizationId&&x.relationshipType===d.relationshipType);
        if(dup) return {error:'این رابطه از قبل وجود دارد.',code:409};
        if(!orgById(d.targetOrganizationId)) return {error:'سازمان مقصد حذف شده است؛ ابتدا دوباره سازمان را بسازید.',code:400};
        const row={id:`r-${Date.now()}`,relationshipType:d.relationshipType,status:d.status??'PROSPECTIVE',healthScore:50,riskScore:30,strategicScore:50,influenceScore:50,opportunityScore:50,resilienceScore:50,nextActionAt:null,lastInteractionAt:nowIso(),sourceOrganizationId:d.sourceOrganizationId,targetOrganizationId:d.targetOrganizationId};
        DB.rels.push(row); saveDb();
        audit(req,'CREATE','Relationship',row.id,'OK',{meta:{source:row.sourceOrganizationId,target:row.targetOrganizationId,type:row.relationshipType,reason:`approval:${a.id}`}});
        return {applied:'SENSITIVE_RELATIONSHIP_CREATE',relationshipId:row.id};
      }
      if(a.actionType==='DELETE'){
        const et=a.after?.entityType;
        if(et==='Organization'){
          const o=(DB.orgs??[]).find(x=>x.id===a.entityId);
          if(!o) return {error:'سازمان یافت نشد.',code:404};
          const hasRel=(DB.rels??[]).some(x=>x.sourceOrganizationId===a.entityId||x.targetOrganizationId===a.entityId);
          if(hasRel) return {error:'سازمان دارای رابطهٔ فعال است؛ ابتدا روابط را خاتمه دهید.',code:409};
          DB.orgs=DB.orgs.filter(x=>x.id!==a.entityId); ORGS=DB.orgs; saveDb();
          audit(req,'DELETE','Organization',a.entityId,'OK',{meta:{name:o.name,reason:`approval:${a.id}`,permanent:true}});
          return {applied:'DELETE',entityType:'Organization',entityId:a.entityId,name:o.name};
        }
        if(et==='Person'){
          const p=personById(a.entityId);
          DB.people=DB.people.filter(x=>x.id!==a.entityId); PEOPLE=DB.people; saveDb();
          audit(req,'DELETE','Person',a.entityId,'OK',{meta:{name:p?`${p.firstName} ${p.lastName}`:a.entityId,reason:`approval:${a.id}`,permanent:true}});
          return {applied:'DELETE',entityType:'Person',entityId:a.entityId};
        }
        return {error:'نوع نهاد برای حذف پشتیبانی نمی‌شود.',code:400};
      }
      return null; // EXPORT / DATA_SHARING / DATA_IMPORT → {approved:true} only
    }catch(e){ return {error:e?.message??'خطا در اعمال تأیید.',code:500}; }
  }
  /* ------------------- quality data (DataQualityService parity) ------------------- */
  const dqCan=(perm)=>authUser?.isOwner||(authUser?.permissions??[]).includes(perm);
  const DQ_READ_MSG='شما مجوز «مشاهده کیفیت داده» (data.quality.read) را ندارید.';
  const DQ_EXEC_MSG='شما مجوز «اجرای بازبینی کیفیت» (data.quality.execute) را ندارید.';
  const DQ_IMPORT_MSG='شما مجوز «وارد کردن داده» (data.import) را ندارید.';
  const dqGate=(oid)=>{
    if(oid&&!authUser?.isOwner&&!visibleOrgIds(req).includes(oid)) return 'شما به سازمان موردنظر (organizationId) دسترسی ندارید.';
    return null;
  };
  if(is('/data/quality')&&method==='GET'){
    if(!dqCan('data.quality.read')) return json(res,403,{message:DQ_READ_MSG});
    const oid=q.get('organizationId')??null;
    const gate=dqGate(oid); if(gate) return json(res,403,{message:gate});
    const store=DB.dataQualitySnapshots=DB.dataQualitySnapshots??[];
    if(oid==null&&(authUser?.isOwner??false)){
      const latest=[...store].reverse().find(s=>s.organizationId==null);
      if(latest) return json(res,200,latest);
    }
    if(oid!=null){
      const latest=[...store].reverse().find(s=>s.organizationId===oid);
      if(latest) return json(res,200,latest);
    }
    return json(res,200,runQualitySnapshot(req,oid));
  }
  if(is('/data/quality/scan')&&method==='POST'){
    if(!dqCan('data.quality.execute')) return json(res,403,{message:DQ_EXEC_MSG});
    const body=await readBody(req);
    const oid=body?.organizationId??null;
    const gate=dqGate(oid); if(gate) return json(res,403,{message:gate});
    return json(res,200,runQualitySnapshot(req,oid));
  }
  if(is('/data/duplicates')&&method==='GET'){
    if(!dqCan('data.quality.read')) return json(res,403,{message:DQ_READ_MSG});
    const oid=q.get('organizationId')??null;
    const gate=dqGate(oid); if(gate) return json(res,403,{message:gate});
    const snap=runQualitySnapshot(req,oid);
    return json(res,200,{snapshotId:snap.id,duplicateOrganizations:(snap.metrics?.duplicateOrganizations??[])});
  }
  if(is('/data/duplicates/detect')&&method==='POST'){
    if(!dqCan('data.import')) return json(res,403,{message:DQ_IMPORT_MSG});
    const body=await readBody(req);
    const entityType=String(body?.entityType??'').toUpperCase();
    if(entityType!=='ORGANIZATION'&&entityType!=='PERSON') return json(res,400,{message:'entityType باید ORGANIZATION یا PERSON باشد.'});
    const oid=body?.organizationId?String(body.organizationId):null;
    if(!oid) return json(res,400,{message:'organizationId برای تشخیص تکراری لازم است.'});
    const gate=dqGate(oid); if(gate) return json(res,403,{message:gate});
    const orgScope=authUser?.isOwner?null:visibleOrgIds(req);
    return json(res,200,dqDetectCandidates(entityType,body?.data??{},oid,orgScope));
  }
  if(match('/data/import/:id/approve')&&method==='POST') return json(res,200,{ok:true});
  if(is('/integrations')||is('/integrations/')&&method==='GET') return json(res,200,{integrations:[
    {id:'in-1',name:'تقویم Google',status:'CONNECTED'},{id:'in-2',name:'Slack',status:'DISCONNECTED'},
  ]});
  /* ------------------------------------------------------------------
     reports + export (ReportingService parity)
       · GET  /reports/:kind            → payload {report,generatedAt,…}
       · GET  /reports/:kind/export/:format?approvalId=…
           format: csv|xlsx|pdf|json   (xlsx/pdf fall back to CSV here)
           requires an APPROVED EXPORT approval for (Report, kind)
           writes DataExportLog row + EXPORT audit (real parity)
  ------------------------------------------------------------------ */
  const REPORT_KINDS=['relationship-health','relationship-risk','network','meeting','commitment','action','opportunity','project','company','contact','risk','influence','referral','subsidiary-comparison','executive','holding','executive-summary'];
  const REL_TYPE_FA={'STRATEGIC_PARTNERSHIP':'مشارکت راهبردی','STRATEGIC':'راهبردی','COMMERCIAL_PARTNERSHIP':'مشارکت تجاری','COMMERCIAL':'تجاری','CUSTOMER':'مشتری','SUPPLIER':'تأمین‌کننده','INVESTOR':'سرمایه‌گذار','PARTNER':'شریک','PROSPECTIVE':'در دست بررسی','FORMER':'سابق','PARTNERSHIP':'مشارکت'};
  const ORG_STATUS_FA={'ACTIVE':'فعال','INACTIVE':'غیرفعال','PROSPECTIVE':'در دست بررسی','SUSPENDED':'معلق'};
  const REL_STATUS_FA={'ACTIVE':'فعال','PROSPECTIVE':'آتی','PAUSED':'متوقف','ENDED':'پایان‌یافته','SUSPENDED':'معلق'};
  const OPP_STATUS_FA={'ACTIVE':'باز','WON':'برنده','LOST':'از دست رفته','ON_HOLD':'معلق','PROPOSAL':'در حال پیشنهاد','NEGOTIATION':'در حال مذاکره','CLOSED':'بسته'};
  function reportScope(req){
    const orgParam=q.get('organizationId');
    if(orgParam){
      if(!inScope(req,orgParam)) return {error:'سازمان خارج از محدودهٔ دسترسی شماست.',code:403};
      return {ids:[orgParam],orgId:orgParam};
    }
    return {ids:visibleOrgIds(req),orgId:null};
  }
  function reportRows(payload){
    if(Array.isArray(payload?.data)) return payload.data.map(r=>flattenForReport(r));
    const out=[];
    for(const [section,value] of Object.entries(payload??{})){
      if(['report','generatedAt'].includes(section)) continue;
      if(Array.isArray(value)) value.forEach(v=>out.push({section,...flattenForReport(v)}));
      else if(value&&typeof value==='object') out.push({section,...flattenForReport(value)});
      else out.push({section,value});
    }
    return out;
  }
  function flattenForReport(value,prefix=''){
    if(value===null||typeof value!=='object') return {[prefix||'value']:value};
    if(Array.isArray(value)) return {[prefix||'value']:JSON.stringify(value)};
    const out={};
    for(const [k,v] of Object.entries(value)) Object.assign(out,flattenForReport(v,prefix?`${prefix}.${k}`:k));
    return out;
  }
  function reportPayload(kind, orgIds){
    const orgs=ORGS.filter(o=>orgIds.includes(o.id));
    const rels=RELS.filter(r=>orgIds.includes(r.sourceOrganizationId)||orgIds.includes(r.targetOrganizationId));
    const people=PEOPLE.filter(p=>orgIds.includes(p.organizationId));
    const relIds=new Set(rels.map(r=>r.id));
    const meetings=MEETINGS.filter(m=>orgIds.includes(m.organizationId)||(m.relationshipId&&relIds.has(m.relationshipId)));
    const actions=ACTIONS.filter(a=>{if(a.relationshipId)return relIds.has(a.relationshipId);return a.organizationId?orgIds.includes(a.organizationId):true;});
    const commitments=COMMITMENTS.filter(c=>orgIds.includes(c.organizationId)||(c.relationshipId&&relIds.has(c.relationshipId)));
    const opps=OPPORTUNITIES.filter(o=>orgIds.includes(o.organizationId)||(o.relationshipId&&relIds.has(o.relationshipId)));
    const projects=PROJECTS.filter(p=>orgIds.includes(p.organizationId));
    const gen={generatedAt:nowIso()};
    const orgName=(id)=>orgById(id)?.name??id;
    const personName=(id)=>{const p=personById(id);return p?`${p.firstName??''} ${p.lastName??''}`.trim():null;};
    const relName=(r)=>r?`${orgName(r.sourceOrganizationId)} ← ${orgName(r.targetOrganizationId)}`:null;
    const relType=(k)=>REL_TYPE_FA[k]??k;
    const orgRow=(o)=>({id:o.id,name:o.name,type:o.type,status:ORG_STATUS_FA[o.status]??o.status??'ACTIVE',industry:o.industry??null,country:o.country??null,people:PEOPLE.filter(p=>p.organizationId===o.id).length,relationships:RELS.filter(r=>r.sourceOrganizationId===o.id||r.targetOrganizationId===o.id).length,meetings:MEETINGS.filter(m=>m.organizationId===o.id).length,projects:PROJECTS.filter(p=>p.organizationId===o.id).length,opportunities:OPPORTUNITIES.filter(x=>x.organizationId===o.id).length});
    const relRow=(r)=>({id:r.id,sourceOrganization:orgName(r.sourceOrganizationId),targetOrganization:orgName(r.targetOrganizationId),relationshipType:relType(r.relationshipType),status:REL_STATUS_FA[r.status]??r.status??'ACTIVE',healthScore:r.healthScore??0,riskScore:r.riskScore??0,strategicScore:r.strategicScore??0,influenceScore:r.influenceScore??0,opportunityScore:r.opportunityScore??0,resilienceScore:r.resilienceScore??0,lastInteractionAt:r.lastInteractionAt??null,nextActionAt:r.nextActionAt??null});
    switch(kind){
      case 'relationship-health':
        return {...gen,report:kind,data:rels.map(relRow)};
      case 'relationship-risk':
        return {...gen,report:kind,data:rels.filter(r=>(r.riskScore??0)>=50||(r.healthScore??100)<50).map(relRow)};
      case 'company':
        return {...gen,report:kind,data:orgs.map(orgRow)};
      case 'contact':
        return {...gen,report:kind,data:people.map(p=>({id:p.id,name:`${p.firstName??''} ${p.lastName??''}`.trim(),title:p.title??null,department:p.department??null,email:p.email??null,phone:p.phone??null,organization:orgName(p.organizationId),influenceScore:p.influenceScore??0,status:p.status??'ACTIVE'}))};
      case 'meeting':
        return {...gen,report:kind,data:meetings.map(m=>{const rel=m.relationshipId?RELS.find(r=>r.id===m.relationshipId):null;return{id:m.id,title:m.title,startAt:m.startAt,endAt:m.endAt??null,objective:m.objective??null,outcome:m.outcome??null,organization:orgName(m.organizationId),relationship:rel?relName(rel):null,participants:(m.participants??[]).map(x=>personName(x.personId)).filter(Boolean).join('؛ ')||null};})};
      case 'commitment':
        return {...gen,report:kind,data:commitments.map(c=>({id:c.id,description:c.description,dueAt:c.dueAt??null,status:c.status??'OPEN',direction:c.direction??null,priority:c.priority??'MEDIUM',owner:personName(c.ownerId),organization:orgName(c.organizationId),risk:c.risk??null,overdue:!!c.dueAt&&new Date(c.dueAt).getTime()<Date.now()&&!['DONE','COMPLETED','CANCELLED'].includes(c.status??'')}))};
      case 'action':
        return {...gen,report:kind,data:actions.map(a=>{const rel=a.relationshipId?RELS.find(r=>r.id===a.relationshipId):null;return{id:a.id,title:a.title,status:a.status??'OPEN',priority:a.priority??'MEDIUM',dueAt:a.dueAt??null,owner:personName(a.ownerId),organization:rel?orgName(rel.sourceOrganizationId):a.organizationId?orgName(a.organizationId):null,overdue:!!a.dueAt&&new Date(a.dueAt).getTime()<Date.now()&&!['DONE','COMPLETED','CANCELLED'].includes(a.status??'')};})};
      case 'opportunity':
        return {...gen,report:kind,data:opps.map(o=>({id:o.id,name:o.name,status:OPP_STATUS_FA[o.status]??o.status??'ACTIVE',probability:o.probability??0,expectedDate:o.expectedDate??null,organization:orgName(o.organizationId),project:o.projectId?PROJECTS.find(p=>p.id===o.projectId)?.name??null:null,owner:personName(o.ownerId)}))};
      case 'network':
        return {...gen,report:kind,accessibleOrganizationCount:orgs.length,summary:{organizationCount:orgs.length,peopleCount:people.length,relationshipCount:rels.length,meetings:meetings.length,commitments:commitments.length,opportunities:opps.length,projects:projects.length}};
      case 'risk':
        return {...gen,report:kind,data:[...rels].sort((a,b)=>(b.riskScore??0)-(a.riskScore??0)||(a.healthScore??0)-(b.healthScore??0)).map(r=>({id:r.id,sourceOrganization:orgName(r.sourceOrganizationId),targetOrganization:orgName(r.targetOrganizationId),riskScore:r.riskScore??0,healthScore:r.healthScore??0,strategicScore:r.strategicScore??0,nextActionAt:r.nextActionAt??null}))};
      case 'influence':
      case 'executive':
        return {...gen,report:kind,data:[...people].sort((a,b)=>(b.influenceScore??0)-(a.influenceScore??0)).map(p=>({id:p.id,name:`${p.firstName??''} ${p.lastName??''}`.trim(),title:p.title??null,department:p.department??null,organization:orgName(p.organizationId),influenceScore:p.influenceScore??0,status:p.status??'ACTIVE'}))};
      case 'referral': {
        const rows=(DB.referrals??[]).filter(x=>orgIds.includes(x.sourceOrganizationId)||orgIds.includes(x.targetOrganizationId));
        const successful=rows.filter(x=>x.status==='COMPLETED'||x.status==='ACCEPTED').length;
        return {...gen,report:kind,summary:{total:rows.length,successful,successRate:rows.length?Math.round(successful/rows.length*100):0},data:rows.map(x=>({id:x.id,title:x.title,status:x.status??'PENDING',sourceOrganization:orgName(x.sourceOrganizationId),targetOrganization:orgName(x.targetOrganizationId),sourcePerson:personName(x.sourcePersonId),targetPerson:personName(x.targetPersonId),relationshipId:x.relationshipId??null,completedAt:x.completedAt??null,createdAt:x.createdAt??null}))};
      }
      case 'project':
        return {...gen,report:kind,data:projects.map(p=>({id:p.id,name:p.name,status:p.status??'ACTIVE',priority:p.priority??'MEDIUM',objective:p.objective??null,organization:orgName(p.organizationId),owner:personName(p.ownerId),startAt:p.startAt??null,targetAt:p.targetAt??null}))};
      case 'subsidiary-comparison':
        return {...gen,report:kind,data:orgs.filter(o=>o.type==='SUBSIDIARY'||o.type==='PARTNER').map(orgRow)};
      case 'holding':
        return {...gen,report:kind,organizations:orgs.length,roots:orgs.map(o=>({id:o.id,name:o.name,type:o.type,status:ORG_STATUS_FA[o.status]??o.status??'ACTIVE',industry:o.industry??null,country:o.country??null,children:[]}))};
      case 'executive-summary': {
        const nowMs=Date.now();
        const open=opps.filter(o=>!['WON','LOST'].includes(String(o.status)));
        const upcoming=meetings.filter(m=>m.startAt&&new Date(m.startAt).getTime()>=nowMs).slice(0,20);
        const risks=rels.filter(r=>(r.riskScore??0)>=50||(r.healthScore??100)<50);
        const projectsWithOverdueWork=projects.filter(p=>p.targetAt&&new Date(p.targetAt).getTime()<nowMs&&p.status==='ACTIVE').length;
        return {...gen,report:kind,
          summary:{companies:orgs.length,relationships:rels.length,healthyRelationships:rels.filter(r=>(r.healthScore??0)>=70).length,atRiskRelationships:risks.length,openOpportunities:open.length,projects:projects.length,projectsWithOverdueWork,upcomingMeetings:upcoming.length},
          kpi:{averageRelationshipHealth:rels.length?Math.round(rels.reduce((a,r)=>a+(r.healthScore??0),0)/rels.length):0,averageRelationshipRisk:rels.length?Math.round(rels.reduce((a,r)=>a+(r.riskScore??0),0)/rels.length):0,weightedOpportunityValue:Math.round(open.reduce((a,o)=>a+(o.value??0)*(o.probability??0)/100,0))},
          trends:{relationshipHealth:{average:rels.length?Math.round(rels.reduce((a,r)=>a+(r.healthScore??0),0)/rels.length):0},opportunityPipeline:{count:open.length}},
          risks:risks.slice(0,50).map(r=>({id:r.id,relationship:`${orgName(r.sourceOrganizationId)} ← ${orgName(r.targetOrganizationId)}`,healthScore:r.healthScore??0,riskScore:r.riskScore??0,strategicScore:r.strategicScore??0,nextActionAt:r.nextActionAt??null})),
          opportunities:open.slice(0,50).map(o=>({id:o.id,name:o.name,status:OPP_STATUS_FA[o.status]??o.status,probability:o.probability??0,organization:orgName(o.organizationId),expectedDate:o.expectedDate??null})),
          recommendations:risks.slice(0,20).map(r=>({relationshipId:r.id,recommendation:'بازبینی سلامت رابطه، برنامهٔ اقدام مشترک و زمان بازبینی بعدی',nextActionAt:r.nextActionAt??null})),
          supportingData:{companies:orgs.slice(0,100).map(o=>({id:o.id,name:o.name,type:o.type})),projects:projects.slice(0,100).map(p=>({id:p.id,name:p.name,status:p.status??'ACTIVE'})),meetings:upcoming.map(m=>({id:m.id,title:m.title,startAt:m.startAt,organization:orgName(m.organizationId)}))},
        };
      }
      default:
        return {...gen,report:kind,data:[]};
    }
  }
  function assertExportApproval(req,kind){
    const approvalId=q.get('approvalId');
    const approval=approvalId?(DB.approvals??[]).find(a=>a.id===approvalId):null;
    const ok=!!approval&&approval.status==='APPROVED'&&approval.actionType==='EXPORT'&&approval.entityType==='Report'&&approval.entityId===kind&&(authUser?.isOwner||!approval.organizationId||visibleOrgIds(req).includes(approval.organizationId));
    return ok?approval:null;
  }
  function writeExportLog(req,kind,format,rows,approvalId,organizationId){
    const logRow={id:`ex-${Date.now()}`,userId:authUser.id,organizationId,exportType:format.toUpperCase(),entityType:kind,recordCount:rows.length,classification:'INTERNAL',requestId:approvalId??null,ipAddress:req.socket?.remoteAddress??null,createdAt:nowIso()};
    DB.exportLog=DB.exportLog??[];
    DB.exportLog.unshift(logRow);
    saveDb();
    audit(req,'EXPORT','Report',logRow.id,'OK',{meta:{report:kind,format:format.toUpperCase(),recordCount:rows.length,organizationId:organizationId??null,approval:approvalId??null}});
    recordSecurity(req,'EXPORT_CREATED','INFO',{exportType:format.toUpperCase(),recordCount:rows.length,report:kind,approvalId:approvalId??null},'Report',kind,authUser.id,organizationId);
    return logRow;
  }
  const reportKey=match('/reports/:key');
  if(reportKey&&method==='GET'){
    const kind=reportKey[0];
    if(!REPORT_KINDS.includes(kind)) return json(res,400,{message:`گزارش «${kind}» پشتیبانی نمی‌شود.`});
    const sc=reportScope(req);
    if(sc.error) return json(res,sc.code,{message:sc.error});
    return json(res,200,reportPayload(kind,sc.ids));
  }
  const reportExport=match('/reports/:key/export/:format');
  if(reportExport&&method==='GET'){
    const kind=reportExport[0];
    const format=String(reportExport[1]).toLowerCase();
    if(!REPORT_KINDS.includes(kind)) return json(res,400,{message:`گزارش «${kind}» پشتیبانی نمی‌شود.`});
    if(!['csv','xlsx','pdf','json'].includes(format)) return json(res,400,{message:`قالب خروجی «${format}» پشتیبانی نمی‌شود.`});
    const sc=reportScope(req);
    if(sc.error) return json(res,sc.code,{message:sc.error});
    const canExport=authUser?.isOwner||(authUser?.permissions??[]).includes('report.export');
    if(!canExport) return json(res,403,{message:'شما مجوز «خروجی گزارش» (report.export) را ندارید؛ با مالک سامانه تماس بگیرید.'});
    if(format==='json'&&!authUser?.isOwner) return json(res,403,{message:'فرمت JSON ویژهٔ مدیران سازمانی (enterprise.admin) است.'});
    const approval=assertExportApproval(req,kind);
    if(!approval) return json(res,403,{message:'خروجی گزارش فقط پس از تأیید درخواست آن صادر می‌شود؛ ابتدا «دریافت فایل» را بزنید تا درخواست تأیید ثبت شود، سپس پس از تأیید در صفحهٔ «تأییدها» دوباره تلاش کنید.'});
    const payload=reportPayload(kind,sc.ids);
    const rows=reportRows(payload);
    if(format==='json'){
      const body=JSON.stringify(payload,null,2);
      writeExportLog(req,kind,format,rows,approval.id,sc.orgId);
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="srip-${kind}.json"`});
      return res.end(body);
    }
    // csv (xlsx/pdf fall back to CSV in the demo; real API streams real xlsx/pdf)
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const esc=(v)=>{const s=v===null||v===undefined?'':String(v);return /[\",\\n\\r;]/.test(s)?'\"'+s.replace(/\"/g,'\"\"')+'\"':s;};
    const lines=['\uFEFF'+keys.map(esc).join(',')];
    for(const r of rows) lines.push(keys.map(k=>esc(r[k])).join(','));
    const body=lines.join('\r\n');
    writeExportLog(req,kind,format,rows,approval.id,sc.orgId);
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="srip-${kind}.csv"`});
    return res.end(body);
  }

  json(res,404,{message:`مسیر ${method} ${path} در Mock API وجود ندارد.`});
});

loadDb();
USERS = DB.users;

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`[mock-api] SRIP deterministic mock API listening on http://0.0.0.0:${PORT}${V1}`);
  console.log(`[mock-api] persistence: ${DB_FILE}${process.argv.includes('--reset')?' (RESET — reseeded)':''}`);
  console.log('[mock-api] OWNER  demo / 123456  (demo@srip.local — همه محدوده)');
  console.log('[mock-api] CLIENT client / 123456  (client@arya-tech.ir — فقط آریا فناوری)');
});
