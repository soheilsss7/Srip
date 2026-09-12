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
/* نسخهٔ نمایشیِ Mock API — در هر انتشار باید عوض شود؛ چون داخل SW تزریق می‌شود و
   مرورگرها با آن، سرویس‌کارگرِ کهنه را تشخیص و خودکار به‌روزرسانی می‌کنند. */
const DEMO_MOCK_VERSION = '2026.09.12.04';

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
  /* دمو غنی‌شده (فاز ۶/عموم‌ها): بازیگران غیربازاری شش دستهٔ عموم‌ها + شبکهٔ روابط */
  { id:'org-9', name:'دانشگاه صنعتی شریف', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-02-10T08:00:00.000Z' },
  { id:'org-10', name:'اتاق بازرگانی تهران', type:'GOVERNMENT', industry:'اتاق بازرگانی و اکوسیستم کسب‌وکار', country:'ایران', createdAt:'2026-02-18T08:00:00.000Z' },
  { id:'org-11', name:'سازمان بورس و اوراق بهادار', type:'GOVERNMENT', industry:'تنظیم‌گری بازار سرمایه', country:'ایران', createdAt:'2026-03-05T08:00:00.000Z' },
  { id:'org-12', name:'صندوق نوآوری و شکوفایی', type:'INVESTOR', industry:'صندوق‌های نوآوری و فناوری', country:'ایران', createdAt:'2026-03-12T08:00:00.000Z' },
  /* ─────────────────────────────────────────────────────────────────────
     داده‌های اولیهٔ واقعی (سند عموم‌ها — docs/عموم‌ها-extracted.md)
     شرکت x = مالک پلتفرم · هلدینگ پارس = سازمان واقعی با ۱۲ حوزهٔ کاری
     و همهٔ نهادهای شش دستهٔ عموم (نهادی/علمی/اقتصادی/اکوسیستم).
     ───────────────────────────────────────────────────────────────────── */
  { id:'org-x', name:'شرکت x', type:'HOLDING', industry:'مالکیت و توسعهٔ پلتفرم', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars', name:'هلدینگ پارس', type:'HOLDING', industry:'هلدینگ چندبخشی — ۱۲ حوزهٔ کاری', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  /* ۱۲ حوزهٔ کاری هلدینگ پارس (زیرمجموعه‌های ساختاری) */
  { id:'org-pars-01', name:'پارس انرژی', type:'SUBSIDIARY', industry:'انرژی', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-02', name:'پارس آموزش', type:'SUBSIDIARY', industry:'آموزش', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-03', name:'پارس خدمات اجتماعی', type:'SUBSIDIARY', industry:'خدمات اجتماعی', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-04', name:'پارس سلامت', type:'SUBSIDIARY', industry:'سلامت', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-05', name:'پارس کشاورزی', type:'SUBSIDIARY', industry:'کشاورزی', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-06', name:'پارس مالی', type:'SUBSIDIARY', industry:'مالی', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-07', name:'پارس مسکن', type:'SUBSIDIARY', industry:'مسکن', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-08', name:'پارس صنعت', type:'SUBSIDIARY', industry:'صنعت', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-09', name:'پارس اعتباری', type:'SUBSIDIARY', industry:'اعتباری', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-10', name:'پارس طراحی صنعتی', type:'SUBSIDIARY', industry:'طراحی صنعتی', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-11', name:'پارس لجستیک', type:'SUBSIDIARY', industry:'لجستیک', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-pars-12', name:'پارس محتوا', type:'SUBSIDIARY', industry:'محتوا', country:'ایران', parentOrganizationId:'org-pars', createdAt:'2026-09-01T08:00:00.000Z' },
  /* دستهٔ ۲الف — نهادهای حاکمیتی متمرکز بر سیاست‌گذاری هوش مصنوعی */
  { id:'org-inst-01', name:'شورای ملی راهبری هوش مصنوعی', type:'GOVERNMENT', industry:'سیاست‌گذاری هوش مصنوعی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-02', name:'ستاد توسعه فناوری و کاربردی‌سازی هوش مصنوعی', type:'GOVERNMENT', industry:'اجرا و تنظیم‌گری هوش مصنوعی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-03', name:'معاونت علمی، فناوری و اقتصاد دانش‌بنیان ریاست‌جمهوری', type:'GOVERNMENT', industry:'راهبری علم و فناوری کشور', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-04', name:'صندوق توسعهٔ ملی', type:'GOVERNMENT', industry:'تأمین تسهیلات ارزی و ریالی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-05', name:'کمیسیون‌های تخصصی مجلس شورای اسلامی', type:'GOVERNMENT', industry:'قانون‌گذاری و لایحهٔ هوش مصنوعی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-06', name:'شورای عالی فضای مجازی', type:'GOVERNMENT', industry:'سیاست‌گذاری دیجیتال و داده', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-07', name:'شورای عالی انقلاب فرهنگی', type:'GOVERNMENT', industry:'چارچوب‌های فرهنگی و محتوایی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-08', name:'پژوهشگاه ارتباطات و فناوری اطلاعات', type:'GOVERNMENT', industry:'کارشناسی و تنظیم‌گری فاوا', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-09', name:'سازمان نظام صنفی رایانه‌ای', type:'PARTNER', industry:'صنف فناوری اطلاعات', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-inst-10', name:'معاونت حقوقی ریاست‌جمهوری و پژوهشگاه قوهٔ قضاییه', type:'GOVERNMENT', industry:'حاکمیت حقوقی هوش مصنوعی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  /* دستهٔ ۲ب — تنظیم‌گران بخشیِ ۱۲ حوزهٔ کاری */
  { id:'org-reg-energy', name:'وزارت نیرو', type:'GOVERNMENT', industry:'تنظیم‌گری انرژی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-oil', name:'وزارت نفت', type:'GOVERNMENT', industry:'تنظیم‌گری نفت و گاز', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-energy-eff', name:'سازمان بهره‌وری انرژی ایران', type:'GOVERNMENT', industry:'بهره‌وری انرژی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-edu', name:'وزارت آموزش و پرورش', type:'GOVERNMENT', industry:'تنظیم‌گری آموزش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-science', name:'وزارت علوم، تحقیقات و فناوری', type:'GOVERNMENT', industry:'تنظیم‌گری آموزش عالی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-welfare', name:'وزارت تعاون، کار و رفاه اجتماعی', type:'GOVERNMENT', industry:'تنظیم‌گری خدمات اجتماعی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-health', name:'وزارت بهداشت، درمان و آموزش پزشکی', type:'GOVERNMENT', industry:'تنظیم‌گری سلامت', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-fda', name:'سازمان غذا و دارو', type:'GOVERNMENT', industry:'تنظیم‌گری دارو و غذا', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-agri', name:'وزارت جهاد کشاورزی', type:'GOVERNMENT', industry:'تنظیم‌گری کشاورزی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-cbi', name:'بانک مرکزی جمهوری اسلامی ایران', type:'GOVERNMENT', industry:'تنظیم‌گری پولی و بانکی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-roads', name:'وزارت راه و شهرسازی', type:'GOVERNMENT', industry:'تنظیم‌گری مسکن و حمل‌ونقل', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-industry', name:'وزارت صنعت، معدن و تجارت', type:'GOVERNMENT', industry:'تنظیم‌گری صنعت و تجارت', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-standard', name:'سازمان استاندارد ملی ایران', type:'GOVERNMENT', industry:'استاندارد و کیفیت', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-transport', name:'سازمان راهداری و حمل‌ونقل جاده‌ای', type:'GOVERNMENT', industry:'تنظیم‌گری حمل‌ونقل جاده‌ای', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-reg-culture', name:'وزارت فرهنگ و ارشاد اسلامی', type:'GOVERNMENT', industry:'تنظیم‌گری رسانه و محتوا', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  /* دستهٔ ۳ — عموم‌های علمی، دانشگاهی و پژوهشی (دانشگاه شریف = org-9 دمو) */
  { id:'org-ac-tehran', name:'دانشگاه تهران', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-amirkabir', name:'دانشگاه صنعتی امیرکبیر', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-iust', name:'دانشگاه علم و صنعت ایران', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-kntu', name:'دانشگاه خواجه نصیرالدین طوسی', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-sbu', name:'دانشگاه شهید بهشتی', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-ferdowsi', name:'دانشگاه فردوسی مشهد', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-shiraz', name:'دانشگاه شیراز', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-nlpic', name:'مرکز نوآوری پردازش زبان طبیعی (NLPIC)', type:'PARTNER', industry:'پژوهش NLP فارسی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-csi', name:'انجمن کامپیوتر ایران (CSI)', type:'PARTNER', industry:'انجمن علمی کامپیوتر', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-ai', name:'انجمن ملی هوش مصنوعی ایران', type:'PARTNER', industry:'انجمن علمی هوش مصنوعی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-iscisc', name:'انجمن رمز ایران (ISCISC)', type:'PARTNER', industry:'انجمن علمی امنیت و رمزنگاری', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-med-tehran', name:'دانشگاه علوم پزشکی تهران', type:'GOVERNMENT', industry:'آموزش عالی علوم پزشکی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-tarbiat', name:'دانشگاه تربیت مدرس', type:'GOVERNMENT', industry:'آموزش عالی و پژوهش', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-petrol', name:'دانشگاه صنعت نفت', type:'GOVERNMENT', industry:'آموزش عالی نفت و انرژی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-allameh', name:'دانشگاه علامه طباطبائی', type:'GOVERNMENT', industry:'آموزش عالی علوم اجتماعی و اقتصاد', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-edu-research', name:'پژوهشگاه مطالعات آموزش و پرورش', type:'GOVERNMENT', industry:'پژوهش‌های تربیتی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ac-art', name:'دانشگاه هنر تهران', type:'GOVERNMENT', industry:'آموزش عالی هنر و طراحی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  /* دستهٔ ۴ — عموم‌های اقتصادی و سرمایه‌گذاری (بورس=org-11، صندوق نوآوری=org-12، اتاق تهران=org-10) */
  { id:'org-eco-tse', name:'بورس اوراق بهادار تهران', type:'GOVERNMENT', industry:'بازار سرمایه', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-eco-ifb', name:'فرابورس ایران', type:'GOVERNMENT', industry:'بازار نوآفرین (SME)', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-eco-cvc-kerman', name:'صندوق پژوهش و فناوری خطرپذیر کرمان‌موتور', type:'INVESTOR', industry:'سرمایه‌گذاری خطرپذیر شرکتی (CVC)', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-eco-vc-pasargad', name:'صندوق نوآوری پاسارگاد', type:'INVESTOR', industry:'سرمایه‌گذاری خطرپذیر', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-eco-chamber-ir', name:'اتاق بازرگانی، صنایع، معادن و کشاورزی ایران', type:'PARTNER', industry:'نهاد صنفی بخش خصوصی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  /* دستهٔ ۶ — عموم‌های اکوسیستم فناوری و صنعت (نظام صنفی رایانه‌ای = org-inst-09) */
  { id:'org-ecx-pardis', name:'پارک فناوری پردیس', type:'PARTNER', industry:'پارک علم و فناوری', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-innofactory', name:'کارخانه نوآوری (شعبهٔ پردیس)', type:'PARTNER', industry:'کارخانه نوآوری و شتاب‌دهی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-jahesh', name:'مرکز شتاب‌دهی و نوآوری جهش', type:'PARTNER', industry:'شتاب‌دهی و نوآوری', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-utpark', name:'پارک علم و فناوری دانشگاه تهران', type:'PARTNER', industry:'پارک فناوری دانشگاهی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-sharifpark', name:'پارک علم و فناوری شریف', type:'PARTNER', industry:'پارک فناوری دانشگاهی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-avatech', name:'آواتک (Avatech)', type:'PARTNER', industry:'شتاب‌دهندهٔ استارتاپی', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-finnova', name:'فینوا (Finnova)', type:'PARTNER', industry:'شتاب‌دهندهٔ فین‌تک', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-maintech', name:'شتاب‌دهندهٔ ماینتک', type:'PARTNER', industry:'شتاب‌دهندهٔ تخصصی معدن', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-sarava', name:'گروه سرمایه‌گذاری سرآوا', type:'INVESTOR', industry:'سرمایه‌گذاری در استارتاپ‌ها', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-digikala', name:'دیجی‌کالا', type:'PARTNER', industry:'تجارت الکترونیک', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-snapp', name:'اسنپ (Snapp)', type:'PARTNER', industry:'حمل‌ونقل هوشمند', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-divar', name:'دیوار', type:'PARTNER', industry:'آگهی‌های طبقه‌بندی‌شده', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-tapsi', name:'تپسی (Tapsi)', type:'PARTNER', industry:'حمل‌ونقل هوشمند', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-arvan', name:'ابرآروان (ArvanCloud)', type:'PARTNER', industry:'ابر و CDN', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-mci', name:'همراه اول', type:'PARTNER', industry:'اپراتور مخابراتی و مرکز داده', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
  { id:'org-ecx-ecommerce', name:'انجمن تجارت الکترونیک', type:'PARTNER', industry:'انجمن صنفی کسب‌وکار دیجیتال', country:'ایران', createdAt:'2026-09-01T08:00:00.000Z' },
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
  { id:'p-9', firstName:'مهران', lastName:'صادقی', email:'mehran@bankpars.ir', title:'معاون اعتباری', department:'اعتبارات', phone:'+98 21 82110044', organizationId:'org-3', status:'ACTIVE', influenceScore:86 },
  { id:'p-10', firstName:'فرهاد', lastName:'یوسفی', email:'farhad@bankpars.ir', title:'مدیر فناوری اطلاعات', department:'فناوری', phone:'+98 21 82110055', organizationId:'org-3', status:'ACTIVE', influenceScore:79 },
  { id:'p-11', firstName:'کیان', lastName:'مرادی', email:'kian@petro-sanat.ir', title:'مدیر مالی', department:'مالی', phone:'+98 21 44556677', organizationId:'org-4', status:'ACTIVE', influenceScore:72 },
  { id:'p-12', firstName:'آیدا', lastName:'شریفی', email:'aida@sadena.ir', title:'مدیر مالی', department:'مالی', phone:'+98 21 88445577', organizationId:'org-5', status:'ACTIVE', influenceScore:69 },
  { id:'p-13', firstName:'بهنام', lastName:'اقبالی', email:'behnam@sadena.ir', title:'مدیر فنی', department:'فنی', phone:'+98 21 88445588', organizationId:'org-5', status:'ACTIVE', influenceScore:64 },
  /* دمو غنی‌شده: بازیگران عموم‌ها (دانشگاه/اتاق/بورس/صندوق) + تیم آریا */
  { id:'p-14', firstName:'مهرداد', lastName:'رستگار', email:'rostagar@sharif.edu', title:'استاد گروه مهندسی کامپیوتر', department:'پژوهش', phone:'+98 21 66166xxx'.replace('xxx','000'), organizationId:'org-9', status:'ACTIVE', influenceScore:84 },
  { id:'p-15', firstName:'شیما', lastName:'آذری', email:'azari@sharif.edu', title:'سرپرست آزمایشگاه پردازش زبان', department:'پژوهش', phone:'+98 21 66166044', organizationId:'org-9', status:'ACTIVE', influenceScore:72 },
  { id:'p-16', firstName:'بهزاد', lastName:'فرهمند', email:'farahmand@tccim.ir', title:'دبیر کمیتهٔ فناوری اتاق', department:'دفتر فناوری', phone:'+98 21 88780000', organizationId:'org-10', status:'ACTIVE', influenceScore:66 },
  { id:'p-17', firstName:'لیلا', lastName:'نیک‌پی', email:'nikpay@seo.or.ir', title:'کارشناس ارشد نظارت بر ناشران', department:'نظارت', phone:'+98 21 89780000', organizationId:'org-11', status:'ACTIVE', influenceScore:61 },
  { id:'p-18', firstName:'آرش', lastName:'کیانی', email:'kiani@innovation.ir', title:'مدیر سرمایه‌گذاری', department:'سرمایه‌گذاری', phone:'+98 21 88002200', organizationId:'org-12', status:'ACTIVE', influenceScore:78 },
  { id:'p-19', firstName:'نیما', lastName:'همتی', email:'nima@arya-tech.ir', title:'تحلیلگر ارشد داده', department:'فنی', phone:'+98 21 88003300', organizationId:'org-2', status:'ACTIVE', influenceScore:58 },
];
let RELS = [
  { id:'r-1', relationshipType:'STRATEGIC_PARTNERSHIP', status:'ACTIVE', healthScore:78, riskScore:22, strategicScore:86, influenceScore:80, opportunityScore:72, resilienceScore:64, nextActionAt:'2026-09-05T09:00:00.000Z', lastInteractionAt:'2026-08-20T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-4', marketKind:'MARKET', isMarketEntry:true, marketSegment:'پتروشیمی و انرژی' },
  { id:'r-2', relationshipType:'BANKING', status:'ACTIVE', healthScore:64, riskScore:48, strategicScore:92, influenceScore:90, opportunityScore:81, resilienceScore:52, nextActionAt:'2026-09-02T09:00:00.000Z', lastInteractionAt:'2026-08-25T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-3', marketKind:'MARKET', isMarketEntry:true, marketSegment:'بانکداری و تأمین مالی' },
  { id:'r-3', relationshipType:'CUSTOMER', status:'ACTIVE', healthScore:71, riskScore:35, strategicScore:74, influenceScore:66, opportunityScore:77, resilienceScore:58, nextActionAt:null, lastInteractionAt:'2026-08-10T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-5', marketKind:'MARKET', isMarketEntry:false, marketSegment:'ساخت‌وساز و پروژه‌های عمرانی' },
  { id:'r-4', relationshipType:'SUPPLY', status:'WATCH', healthScore:41, riskScore:66, strategicScore:69, influenceScore:60, opportunityScore:45, resilienceScore:38, nextActionAt:'2026-09-01T09:00:00.000Z', lastInteractionAt:'2026-07-28T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-6', marketKind:'MARKET', isMarketEntry:false, marketSegment:'قطعات و زنجیره تأمین' },
  { id:'r-5', relationshipType:'INVESTMENT', status:'ACTIVE', healthScore:82, riskScore:18, strategicScore:88, influenceScore:85, opportunityScore:90, resilienceScore:71, nextActionAt:null, lastInteractionAt:'2026-08-22T09:00:00.000Z', sourceOrganizationId:'org-1', targetOrganizationId:'org-7', marketKind:'MARKET', isMarketEntry:false, marketSegment:'سرمایه‌گذاری' },
  { id:'r-6', relationshipType:'PARENT_SUBSIDIARY', status:'ACTIVE', healthScore:86, riskScore:12, strategicScore:84, influenceScore:70, opportunityScore:48, resilienceScore:82, nextActionAt:'2026-09-12T09:00:00.000Z', lastInteractionAt:'2026-09-02T09:00:00.000Z', sourceOrganizationId:'org-1', targetOrganizationId:'org-2', marketKind:'HYBRID', isMarketEntry:false, marketSegment:'درون‌هلدینگی' },
  // روابط غیربازاری نمونه — نهاد/تنظیم‌گر/رسانه که بازار را شکل می‌دهند بدون مبادله مستقیم
  { id:'r-7', relationshipType:'GOVERNMENT', status:'ACTIVE', healthScore:58, riskScore:42, strategicScore:90, influenceScore:88, opportunityScore:35, resilienceScore:55, nextActionAt:'2026-09-08T09:00:00.000Z', lastInteractionAt:'2026-08-18T09:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-8', marketKind:'NON_MARKET', isMarketEntry:true, marketSegment:'مجوز و تنظیم‌گری دولتی' },
  { id:'r-8', relationshipType:'PARTNER', status:'ACTIVE', healthScore:63, riskScore:38, strategicScore:76, influenceScore:67, opportunityScore:62, resilienceScore:60, trustScore:64, engagementScore:58, nextActionAt:null, lastInteractionAt:'2026-08-12T09:00:00.000Z', sourceOrganizationId:'org-1', targetOrganizationId:'org-4', marketKind:'MARKET', isMarketEntry:false, marketSegment:'همکاری فناورانه' },
  /* دمو غنی‌شده: روابط غیربازاری/هیبریدی که ستون‌های عموم‌ها و گراف شبکه را واقعی می‌کنند */
  { id:'r-9', relationshipType:'PARTNER', status:'ACTIVE', healthScore:68, riskScore:28, strategicScore:82, influenceScore:76, opportunityScore:66, resilienceScore:60, trustScore:70, engagementScore:62, cadenceDays:45, nextActionAt:'2026-09-13T09:00:00.000Z', lastInteractionAt:'2026-08-30T13:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-9', marketKind:'NON_MARKET', isMarketEntry:false, marketSegment:'پژوهش و دانشگاه' },
  { id:'r-10', relationshipType:'PARTNER', status:'ACTIVE', healthScore:60, riskScore:22, strategicScore:64, influenceScore:70, opportunityScore:55, resilienceScore:66, trustScore:62, engagementScore:58, cadenceDays:60, nextActionAt:null, lastInteractionAt:'2026-08-14T10:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-10', marketKind:'NON_MARKET', isMarketEntry:false, marketSegment:'اتاق بازرگانی و اکوسیستم کسب‌وکار' },
  { id:'r-11', relationshipType:'GOVERNMENT', status:'ACTIVE', healthScore:52, riskScore:46, strategicScore:74, influenceScore:82, opportunityScore:58, resilienceScore:55, trustScore:54, engagementScore:48, cadenceDays:30, nextActionAt:'2026-09-14T09:00:00.000Z', lastInteractionAt:'2026-08-31T11:00:00.000Z', sourceOrganizationId:'org-2', targetOrganizationId:'org-11', marketKind:'NON_MARKET', isMarketEntry:true, marketSegment:'تنظیم‌گری بازار سرمایه' },
  { id:'r-12', relationshipType:'INVESTMENT', status:'ACTIVE', healthScore:74, riskScore:26, strategicScore:80, influenceScore:68, opportunityScore:84, resilienceScore:62, trustScore:66, engagementScore:70, cadenceDays:45, nextActionAt:null, lastInteractionAt:'2026-09-04T10:30:00.000Z', sourceOrganizationId:'org-1', targetOrganizationId:'org-12', marketKind:'MARKET', isMarketEntry:false, marketSegment:'تأمین مالی دانش‌بنیان' },
  /* دادهٔ واقعی (سند عموم‌ها): ساختار هلدینگ پارس — رابطهٔ مادر/زیرمجموعهٔ ۱۲ حوزهٔ کاری */
  ...Array.from({length:12},(_,i)=>({
    id:`r-pars-${String(i+1).padStart(2,'0')}`, relationshipType:'PARENT_SUBSIDIARY', status:'ACTIVE',
    healthScore:88, riskScore:10, strategicScore:85, influenceScore:72, opportunityScore:60, resilienceScore:84,
    trustScore:90, engagementScore:82, cadenceDays:30, nextActionAt:null, lastInteractionAt:'2026-09-08T09:00:00.000Z',
    sourceOrganizationId:'org-pars', targetOrganizationId:`org-pars-${String(i+1).padStart(2,'0')}`,
    marketKind:'HYBRID', isMarketEntry:false, marketSegment:'درون‌هلدینگی — حوزهٔ کاری',
  })),
];
/* کیدنس دمو بر اساس نوع رابطه (P0-4) */
[['r-1',30],['r-2',30],['r-3',45],['r-4',30],['r-5',60],['r-6',30]].forEach(([id,cd])=>{const r=RELS.find(v=>v.id===id); if(r) r.cadenceDays=cd;});
/* فاز ۲ (ADR-0006): اعتماد و تعامل — دو فاکتور باقی‌ماندهٔ فرمول امتیاز مرکب (additive) */
[['r-1',74,68],['r-2',58,61],['r-3',66,55],['r-4',42,38],['r-5',80,72],['r-6',88,84],['r-7',52,47],['r-8',64,58]].forEach(([id,tr,en])=>{const r=RELS.find(v=>v.id===id); if(r){ r.trustScore??=tr; r.engagementScore??=en; }});
let MEETINGS = [
  { id:'m-1', title:'جلسهٔ راهبردی فصل سوم با پترو صنعت', startAt:'2026-09-03T09:30:00.000Z', endAt:'2026-09-03T11:00:00.000Z', objective:'بررسی همکاری راهبردی و برنامه توسعه', agenda:'1) گزارش عملکرد ۲ فصل\n2) برنامه توسعه بازار\n3) زمان‌بندی قرارداد جدید', organizationId:'org-4', relationshipId:'r-1', participants:[{personId:'p-2'},{personId:'p-6'}], actions:[], commitments:[], preMeetingBrief:'تمرکز بر تمدید قرارداد و نرخ جدید.' },
  { id:'m-2', title:'مذاکره با بانک ملّی پارس', startAt:'2026-09-07T10:00:00.000Z', endAt:'2026-09-07T11:30:00.000Z', objective:'افتتاح خط اعتباری', agenda:'ارائه صورت‌های مالی و طرح توجیهی', organizationId:'org-3', relationshipId:'r-2', participants:[{personId:'p-3'}], actions:[], commitments:[], preMeetingBrief:null },
  { id:'m-3', title:'جلسهٔ پیگیری پروژه سدنا', startAt:'2026-08-25T09:00:00.000Z', endAt:'2026-08-25T10:00:00.000Z', objective:'پیشرفت فاز دوم', agenda:'بررسی مایلاستون‌ها', organizationId:'org-5', relationshipId:'r-3', participants:[{personId:'p-4'},{personId:'p-1'}], actions:[{id:'a-x1'}], commitments:[{id:'c-x1'}], outcome:'توافق شد تحویل فاز دوم ۱۰ روز زودتر انجام شود.', preMeetingBrief:null },
  { id:'m-4', title:'بررسی ریسک تأمین‌کننده البرز', startAt:'2026-08-28T08:30:00.000Z', endAt:'2026-08-28T09:15:00.000Z', objective:'مدیریت تاخیر تحویل قطعات', agenda:'تاخیرها و برنامه جبرانی', organizationId:'org-6', relationshipId:'r-4', participants:[{personId:'p-5'}], actions:[], commitments:[], outcome:'تأمین‌کننده متعهد شد تحویل‌ها را ۳ هفته شتاب دهد.', preMeetingBrief:null },
  /* دمو غنی‌شده: m-5 گذشتهٔ بدون نتیجه (ماژول هشدار جلسه) + m-6 آیندهٔ عموم‌محور */
  { id:'m-5', title:'کارگاه مشترک پژوهشی با دانشگاه شریف', startAt:'2026-08-30T13:00:00.000Z', endAt:'2026-08-30T15:00:00.000Z', objective:'تعریف پروژهٔ مشترک پردازش زبان فارسی', agenda:'۱) مرور داده‌های مجموعه\n۲) تعریف خروجی‌های پژوهشی\n۳) تقسیم کار', organizationId:'org-9', relationshipId:'r-9', participants:[{personId:'p-14'},{personId:'p-15'},{personId:'p-7'}], actions:[], commitments:[], preMeetingBrief:'موضوع و ذی‌نفعان از قبل هماهنگ شده بود.', notes:'خروجی جلسه هنوز ثبت نشده است.' },
  { id:'m-6', title:'جلسهٔ کمیتهٔ فناوری اتاق بازرگانی', startAt:'2026-09-17T15:00:00.000Z', endAt:'2026-09-17T17:00:00.000Z', objective:'معرفی آریا فناوری به اعضای کمیتهٔ فناوری', agenda:'معرفی پلتفرم و بحث اولویت‌های دیجیتالی شدن کسب‌وکارها', organizationId:'org-10', relationshipId:'r-10', participants:[{personId:'p-16'},{personId:'p-8'}], actions:[], commitments:[], preMeetingBrief:'فهرست اعضای کمیته از دبیرخانه گرفته شد.' },
];
let ACTIONS = [
  { id:'a-1', title:'پیگیری امضای قرارداد پترو صنعت', status:'OPEN', priority:'HIGH', dueAt:'2026-09-02T09:00:00.000Z', ownerId:'p-1', relationshipId:'r-1' },
  { id:'a-2', title:'ارسال مدارک به بانک پارس', status:'IN_PROGRESS', priority:'CRITICAL', dueAt:'2026-08-30T09:00:00.000Z', ownerId:'p-3', relationshipId:'r-2' },
  { id:'a-3', title:'بررسی جایگزین تأمین‌کننده قطعات', status:'OPEN', priority:'HIGH', dueAt:'2026-09-08T09:00:00.000Z', ownerId:'p-5', relationshipId:'r-4' },
  { id:'a-4', title:'گزارش عملکرد سدنا', status:'DONE', priority:'MEDIUM', dueAt:'2026-08-20T09:00:00.000Z', ownerId:'p-4', relationshipId:'r-3' },
  /* دمو غنی‌شده: وضعیت‌های هشدارساز ماژول اقدام */
  { id:'a-5', title:'ارسال گزارش افشای فصلی به سازمان بورس', status:'OPEN', priority:'CRITICAL', dueAt:'2026-09-08T09:00:00.000Z', ownerId:'p-8', relationshipId:'r-11' },
  { id:'a-6', title:'تهیهٔ پیش‌نویس تفاهم‌نامهٔ پژوهشی با شریف', status:'IN_PROGRESS', priority:'HIGH', dueAt:'2026-09-13T09:00:00.000Z', ownerId:'p-7', relationshipId:'r-9' },
];
let COMMITMENTS = [
  { id:'c-1', description:'تحویل پیش‌فاکتور نهایی به پترو صنعت', dueAt:'2026-09-05T09:00:00.000Z', status:'OPEN', organizationId:'org-4', ownerId:'p-1', direction:'OURS', risk:'MEDIUM', personId:'p-2', relationshipId:'r-1', meetingId:'m-1', reminderAt:'2026-09-04T08:00:00.000Z', notes:'پس از توافق جلسهٔ راهبردی؛ پیش‌فاکتور همراه جدول تخفیف و زمان‌بندی تحویل ارسال شود.', createdAt:'2026-09-03T09:45:00.000Z' },
  { id:'c-2', description:'ارسال صورت‌های مالی حسابرسی‌شده به بانک', dueAt:'2026-08-31T09:00:00.000Z', status:'OPEN', organizationId:'org-3', ownerId:'p-6', direction:'OURS', risk:'HIGH', personId:'p-3', relationshipId:'r-2', reminderAt:'2026-08-30T09:00:00.000Z', notes:'پیش‌نیاز جلسهٔ مذاکرهٔ خط اعتباری؛ امضای مدیر مالی الزامی است.', createdAt:'2026-08-22T10:00:00.000Z' },
  { id:'c-3', description:'برنامه جبرانی تأمین قطعات', dueAt:'2026-09-10T09:00:00.000Z', status:'OPEN', organizationId:'org-6', ownerId:'p-5', direction:'THEIRS', risk:'HIGH', personId:'p-5', relationshipId:'r-4', meetingId:'m-4', projectId:'pr-2', reminderAt:'2026-09-09T09:00:00.000Z', notes:'تأمین‌کننده متعهد شد تحویل‌ها را سه هفته شتاب دهد؛ پیشرفت هر هفته راستی‌آزمایی شود.', createdAt:'2026-08-28T09:20:00.000Z' },
  { id:'c-4', description:'تسویهٔ صورتحساب فاز نخست سدنا', dueAt:'2026-08-28T09:00:00.000Z', status:'FULFILLED', fulfilledAt:'2026-08-26T11:30:00.000Z', organizationId:'org-5', ownerId:'p-8', direction:'OURS', risk:'LOW', personId:'p-4', relationshipId:'r-3', notes:'پرداخت به‌موقع انجام شد؛ رسید در پروندهٔ رابطه ثبت شد.', createdAt:'2026-08-10T09:00:00.000Z' },
  /* دمو غنی‌شده: وضعیت‌های هشدارساز ماژول تعهد */
  { id:'c-5', description:'ارسال مستندات فنی پروژهٔ مشترک پژوهشی به شریف', dueAt:'2026-09-05T09:00:00.000Z', status:'OPEN', organizationId:'org-9', ownerId:'p-7', direction:'OURS', risk:'HIGH', personId:'p-14', relationshipId:'r-9', meetingId:'m-5', reminderAt:'2026-09-04T08:00:00.000Z', notes:'پیش‌نیاز امضای تفاهم‌نامه؛ مصوبهٔ کارگاه ۳۰ مرداد.', createdAt:'2026-08-30T15:30:00.000Z' },
  { id:'c-6', description:'پرداخت حق عضویت سالانهٔ اتاق بازرگانی', dueAt:'2026-09-15T09:00:00.000Z', status:'OPEN', organizationId:'org-10', ownerId:'p-8', direction:'OURS', risk:'LOW', personId:'p-16', relationshipId:'r-10', reminderAt:'2026-09-14T08:00:00.000Z', notes:'عضویت در کمیتهٔ فناوری منوط به تسویهٔ سالانه است.', createdAt:'2026-09-01T09:00:00.000Z' },
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
[{id:'o-1',sourceType:'EXISTING_RELATIONSHIP'},{id:'o-2',sourceType:'EXISTING_RELATIONSHIP'},{id:'o-3',sourceType:'REFERRAL',sourceReferralId:'ref-1'},{id:'o-4',sourceType:'EVENT'}].forEach(x=>{const o=OPPORTUNITIES.find(v=>v.id===x.id); if(o) Object.assign(o,x);});
/* کمیتهٔ خرید (P0-2) */
let COMMITTEE = [
  { id:'cm-1', opportunityId:'o-1', personId:'p-3', role:'ECONOMIC_BUYER', status:'ENGAGED', note:'مدیر روابط بانک؛ تصمیم‌گیرندهٔ نهایی خط اعتباری.' },
  { id:'cm-2', opportunityId:'o-1', personId:'p-9', role:'CHAMPION', status:'ENGAGED', note:'معاون اعتباری؛ حامی داخلی پروژه در هیئت اعتبارات.' },
  { id:'cm-3', opportunityId:'o-1', personId:'p-10', role:'TECH_EVALUATOR', status:'ENGAGED', note:'مدیر فناوری اطلاعات؛ ارزیاب فنی سرویس مانیتورینگ.' },
  { id:'cm-4', opportunityId:'o-2', personId:'p-4', role:'ECONOMIC_BUYER', status:'ENGAGED', note:'مدیر پروژهٔ سدنا؛ سفارش‌دهندهٔ قرارداد نگهداری.' },
  { id:'cm-5', opportunityId:'o-2', personId:'p-12', role:'CHAMPION', status:'ENGAGED', note:'مدیر مالی؛ حامی پیگیر تمدید قرارداد.' },
  { id:'cm-6', opportunityId:'o-2', personId:'p-13', role:'TECH_EVALUATOR', status:'IDENTIFIED', note:'مدیر فنی؛ ارزیابی کیفیت پشتیبانی.' },
  { id:'cm-7', opportunityId:'o-3', personId:'p-2', role:'ECONOMIC_BUYER', status:'ENGAGED', note:'مدیر خرید پترو؛ امضاکنندهٔ قرارداد دوساله.' },
  { id:'cm-8', opportunityId:'o-3', personId:'p-11', role:'CHAMPION', status:'ENGAGED', note:'مدیر مالی؛ حامی راهبردی در هیئت‌مدیره.' },
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
  /* دمو غنی‌شده: تعامل‌های روابط جدید (شریف/اتاق/بورس/صندوق) */
  { id:'i-10', type:'MEETING', subject:'کارگاه مشترک پژوهشی با دانشگاه شریف', summary:'تعریف پروژهٔ مشترک پردازش زبان فارسی روی داده‌های مجموعه؛ حضور استاد گروه کامپیوتر و سرپرست آزمایشگاه.', outcome:'موضوع پروژه تفاهم شد؛ پیش‌نویس تفاهم‌نامه تا دو هفته آینده.', durationMinutes:80, importance:'HIGH', sentiment:1, followUpRequired:true, followUpAt:'2026-09-13T09:00:00.000Z', occurredAt:'2026-08-30T13:00:00.000Z', userId:'u-1', organizationId:'org-9', relationshipId:'r-9', personId:'p-14' },
  { id:'i-11', type:'EMAIL', subject:'دعوت به کمیتهٔ فناوری اتاق بازرگانی', summary:'دعوت رسمی برای عضویت آریا فناوری در کمیتهٔ فناوری اطلاعات اتاق؛ جلسهٔ بعدی مهرماه.', outcome:'عضویت در دست بررسی؛ مدارک ثبت‌نام ارسال شد.', durationMinutes:null, importance:'MEDIUM', sentiment:1, followUpRequired:false, followUpAt:null, occurredAt:'2026-08-14T10:00:00.000Z', userId:'u-1', organizationId:'org-10', relationshipId:'r-10', personId:'p-16' },
  { id:'i-12', type:'CALL', subject:'استعلام افشای اطلاعات از سازمان بورس', summary:'پرس‌وجو دربارهٔ الزامات افشای اطلاعات فصلی برای ورود آتی به بازار سرمایه.', outcome:'فهرست مستندات لازم ایمیل شد؛ مهلت ارسال پایان شهریور.', durationMinutes:14, importance:'HIGH', sentiment:0, followUpRequired:true, followUpAt:'2026-09-20T09:00:00.000Z', occurredAt:'2026-08-31T11:00:00.000Z', userId:'u-1', organizationId:'org-11', relationshipId:'r-11', personId:'p-17' },
  { id:'i-13', type:'MEETING', subject:'ارزیابی پروندهٔ دانش‌بنیان با صندوق نوآوری', summary:'بررسی پروندهٔ حمایت از پلتفرم بانکداری شرکتی؛ تمرکز بر نقشهٔ راه فناوری و تیم.', outcome:'پرونده به مرحلهٔ کارشناسی فنی رفت؛ جلسهٔ بعدی مهرماه.', durationMinutes:60, importance:'HIGH', sentiment:1, followUpRequired:true, followUpAt:'2026-10-05T09:00:00.000Z', occurredAt:'2026-09-04T10:30:00.000Z', userId:'u-1', organizationId:'org-12', relationshipId:'r-12', personId:'p-18' },
];
/* غنی‌سازی دمو: رویداد تعامل (هدف/کانال/کیفیت/نتیجه/جهت/قدم بعدی) */
const EVENT_SEED={
  'i-1':{purpose:'DECISION',channel:'PHONE',quality:4,result:'ADVANCED',direction:'MUTUAL',nextStep:'ارسال پیش‌فاکتور نهایی همراه جدول تخفیف',nextStepAt:'2026-09-05T09:00:00.000Z'},
  'i-2':{purpose:'TRUST_BUILDING',channel:'MEETING',quality:4,result:'STABLE',direction:'WE',nextStep:'ارسال مدارک تکمیلی و طرح توجیهی',nextStepAt:'2026-09-02T09:00:00.000Z'},
  'i-3':{purpose:'DECISION',channel:'PHONE',quality:3,result:'STABLE',direction:'MUTUAL',nextStep:null,nextStepAt:null},
  'i-4':{purpose:'NEGOTIATION',channel:'MEETING',quality:2,result:'REGRESSED',direction:'THEM',nextStep:'تأیید نهایی هیئت‌مدیره پترو',nextStepAt:'2026-09-08T09:00:00.000Z'},
  'i-5':{purpose:'PROBLEM_SOLVING',channel:'EMAIL',quality:2,result:'REGRESSED',direction:'THEM',nextStep:'بازبینی برنامهٔ جبرانی تأمین',nextStepAt:'2026-09-03T08:00:00.000Z'},
  'i-6':{purpose:'DECISION',channel:'MESSAGE',quality:3,result:'ADVANCED',direction:'WE',nextStep:null,nextStepAt:null},
  'i-7':{purpose:'TRUST_BUILDING',channel:'PHONE',quality:3,result:'STABLE',direction:'WE',nextStep:'پیگیری بررسی اعتبارات',nextStepAt:'2026-09-12T09:00:00.000Z'},
  'i-8':{purpose:'APPRECIATION',channel:'NOTE',quality:3,result:'STABLE',direction:'WE',nextStep:'تهیه پیش‌نویس پیشنهاد همکاری',nextStepAt:'2026-09-20T08:00:00.000Z'},
  'i-9':{purpose:'PROBLEM_SOLVING',channel:'MEETING',quality:4,result:'ADVANCED',direction:'MUTUAL',nextStep:'بازبینی ماهانه شاخص‌های کیفیت',nextStepAt:null},
  'i-10':{purpose:'TRUST_BUILDING',channel:'MEETING',quality:4,result:'ADVANCED',direction:'MUTUAL',nextStep:'پیش‌نویس تفاهم‌نامهٔ پژوهشی',nextStepAt:'2026-09-13T09:00:00.000Z'},
  'i-11':{purpose:'TRUST_BUILDING',channel:'EMAIL',quality:3,result:'STABLE',direction:'WE',nextStep:null,nextStepAt:null},
  'i-12':{purpose:'DECISION',channel:'PHONE',quality:3,result:'STABLE',direction:'THEM',nextStep:'ارسال مستندات افشای فصلی',nextStepAt:'2026-09-20T09:00:00.000Z'},
  'i-13':{purpose:'NEGOTIATION',channel:'MEETING',quality:4,result:'ADVANCED',direction:'MUTUAL',nextStep:'جلسهٔ کارشناسی فنی مهرماه',nextStepAt:'2026-10-05T09:00:00.000Z'},
};
for(const [k,v] of Object.entries(EVENT_SEED)){const x=INTERACTIONS.find(i=>i.id===k); if(x) Object.assign(x,v);}
let NOTIFICATIONS = [
  { id:'n-1', tenant:'demo', title:'موعد اقدام نزدیک است', body:'اقدام «پیگیری امضای قرارداد پترو صنعت» تا ۲ روز دیگر موعد دارد.', type:'REMINDER', priority:'important', isRead:false, createdAt:'2026-08-29T06:00:00.000Z' },
  { id:'n-2', tenant:'demo', title:'پیشنهاد هوشمند جدید', body:'پیشنهاد «مدیریت ریسک رابطه با البرز» تولید شد.', type:'RECOMMENDATION', priority:'recommendation', isRead:false, createdAt:'2026-08-29T05:00:00.000Z' },
  { id:'n-3', tenant:'demo', title:'نتیجه جلسه ثبت شد', body:'نتیجهٔ جلسهٔ پیگیری پروژه سدنا ثبت شد.', type:'SYSTEM', priority:'information', isRead:true, createdAt:'2026-08-25T12:00:00.000Z' },
];

let REFERRALS = [
  { id:'ref-1', title:'معرفی مدیر فروش به پترو صنعت', message:'معرفی سارا محمدی برای مدیریت حساب پترو صنعت', sourcePersonId:'p-1', targetPersonId:'p-2', sourceOrganizationId:'org-2', targetOrganizationId:'org-4', relationshipId:'r-1', status:'ACCEPTED', createdById:'u-1', recipientUserId:null, completedAt:null, notes:null, createdAt:'2026-08-18T09:00:00.000Z', acceptedAt:'2026-08-19T09:30:00.000Z',
    instruction:{goal:'معرفی سارا محمدی به‌عنوان حساب‌دار اصلی پترو صنعت؛ هدف: آغاز همکاری فروش در ۳۰ روز.',allowed:['قیمت‌های مصوب و تخفیف‌های قراردادی','زمان‌بندی تحویل','پروژه‌های مشترک فعلی'],forbidden:['مذاکره دربارهٔ قیمت جدید بدون تأیید مدیر فروش','اشاره به مشتریان دیگر پترو','مذاکره قرارداد مستقیم'],boundaries:'حداکثر ۲ جلسهٔ مقدماتی؛ همهٔ مذاکرات با حضور مدیر حساب. نتیجه حداکثر تا ۳۰ روز ثبت شود.',dueDays:30},
    baselineCriteria:null, postCheckins:{} },
  { id:'ref-2', title:'معرفی برای همکاری بانکی', message:'آشنایی با مدیر روابط بانکی پارس برای خط اعتباری', sourcePersonId:'p-6', targetPersonId:'p-3', sourceOrganizationId:'org-1', targetOrganizationId:'org-3', relationshipId:'r-2', status:'PENDING', createdById:'u-1', recipientUserId:null, completedAt:null, notes:null, createdAt:'2026-08-22T10:30:00.000Z',
    instruction:null, baselineCriteria:null, postCheckins:{} },
  { id:'ref-3', title:'معرفی تأمین‌کننده قطعات', message:'معرفی مدیر کیفیت البرز برای ارزیابی تأمین', sourcePersonId:'p-1', targetPersonId:'p-5', sourceOrganizationId:'org-2', targetOrganizationId:'org-6', relationshipId:'r-4', status:'COMPLETED', createdById:'u-1', recipientUserId:null, completedAt:'2026-08-28T11:00:00.000Z', notes:'تأمین‌کننده تأیید شد و قرارداد اولیه امضا گردید.', createdAt:'2026-08-10T08:15:00.000Z', acceptedAt:'2026-08-11T09:00:00.000Z',
    instruction:{goal:'ارزیابی تأمین‌کننده قطعات برای قرارداد سالانه.',allowed:['ظرفیت تولید','زمان تحویل','کیفیت و گواهی‌ها'],forbidden:['تعهد حجم بدون تأیید خرید','تغییر شرایط پرداخت'],boundaries:'فقط ارزیابی؛ قرارداد با تأیید مدیر خرید.',dueDays:30},
    baselineCriteria:{score:49,coverage:43,confidence:48,verdict:'SOLID'}, postCheckins:{FOLLOW_UP:{at:'2026-08-13T10:00:00.000Z',note:'جلسهٔ ارزیابی برگزار شد'},OUTCOME:{at:'2026-08-28T11:00:00.000Z',note:'قرارداد اولیه امضا شد'}} },
  { id:'ref-4', title:'معرفی مدیر پروژه به تیم آریا', message:'آشنایی با مدیر پروژهٔ سدنا برای هم‌افزایی در پروژهٔ مشترک', sourcePersonId:'p-7', targetPersonId:null, sourceOrganizationId:'org-1', targetOrganizationId:null, relationshipId:null, status:'PENDING', createdById:'u-1', recipientUserId:'u-2', completedAt:null, notes:null, createdAt:'2026-08-29T14:20:00.000Z',
    instruction:{goal:'هم‌افزایی تیم پروژهٔ سدنا با تیم آریا روی فاز دوم.',allowed:['مایلاستون‌های فاز دوم','تخصیص منابع'],forbidden:['تعیین سهم مالی پروژه'],boundaries:'معرفی داخلی؛ نتیجه در جلسهٔ هفتگی تیم بررسی شود.',dueDays:14},
    baselineCriteria:null, postCheckins:{} },
  { id:'ref-5', title:'معرفی مشاور سرمایه‌گذاری به صندوق امید', message:'همکاری مشاورانه برای سبد سرمایه‌گذاری', sourcePersonId:'p-8', targetPersonId:'p-4', sourceOrganizationId:'org-7', targetOrganizationId:'org-5', relationshipId:'r-5', status:'DECLINED', createdById:'u-1', recipientUserId:null, completedAt:'2026-07-20T12:00:00.000Z', notes:'به دلیل تغییر اولویت‌ها رد شد.', createdAt:'2026-07-10T09:40:00.000Z',
    instruction:null, baselineCriteria:null, postCheckins:{} },
  { id:'ref-7', title:'معرفی استاد شریف به تیم محصول آریا', message:'اتصال تیم پژوهشی دانشگاه به تیم محصول برای پروژهٔ مشترک پردازش زبان', sourcePersonId:'p-14', targetPersonId:'p-7', sourceOrganizationId:'org-9', targetOrganizationId:'org-2', relationshipId:'r-9', status:'ACCEPTED', createdById:'u-1', recipientUserId:null, completedAt:null, notes:null, createdAt:'2026-09-01T09:00:00.000Z', acceptedAt:'2026-09-02T10:00:00.000Z', instruction:{goal:'هم‌راستاسازی تیم پژوهش با نقشهٔ راه محصول در حوزهٔ پردازش زبان فارسی.',allowed:['موضوعات پژوهشی','داده‌های عمومی زبان','تقویم تقریبی همکاری'],forbidden:['انتقال دادهٔ مشتریان','تعهد مالی بدون تأیید مدیرعامل'],boundaries:'فقط هم‌اندیشی فنی؛ سند تفاهم جداگانه و با تأیید دو طرف.',dueDays:30}, baselineCriteria:null, postCheckins:{} },
  { id:'ref-6', title:'معرفی مدیر خرید به سازه گستر', message:'', sourcePersonId:'p-2', targetPersonId:null, sourceOrganizationId:'org-2', targetOrganizationId:'org-8', relationshipId:null, status:'CANCELLED', createdById:'u-1', recipientUserId:null, completedAt:'2026-08-02T10:00:00.000Z', notes:null, createdAt:'2026-07-28T09:10:00.000Z',
    instruction:null, baselineCriteria:null, postCheckins:{} },
];

[{id:'ref-1',requestStatus:'RESPONDED_YES',requestedAt:'2026-08-18T10:00:00.000Z',outcome:'MEET_BOOKED',outcomeNote:'جلسهٔ مقدماتی برگزار شد',opportunityId:'o-3'},{id:'ref-2',requestStatus:'REQUESTED',requestedAt:'2026-08-22T11:00:00.000Z',outcome:null,outcomeNote:null,opportunityId:'o-1'},{id:'ref-3',requestStatus:'RESPONDED_YES',requestedAt:'2026-08-10T09:00:00.000Z',outcome:'MEET_BOOKED',outcomeNote:'ارزیابی انجام و قرارداد اولیه امضا شد',opportunityId:null}].forEach(x=>{const r=REFERRALS.find(v=>v.id===x.id); if(r) Object.assign(r,x);});
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
/* --------------------- رویداد تعامل (P0-1) --------------------- */
const INTERACTION_PURPOSE_LIST=['DISCOVERY','TRUST_BUILDING','DECISION','NEGOTIATION','PROBLEM_SOLVING','APPRECIATION'];
const INTERACTION_CHANNEL_LIST=['MEETING','PHONE','EMAIL','MESSAGE','EVENT','OTHER'];
const INTERACTION_RESULT_LIST=['ADVANCED','STABLE','REGRESSED'];
const INTERACTION_DIRECTION_LIST=['WE','THEM','MUTUAL'];
/* --------------------- کمیته خرید (P0-2) --------------------- */
const BUYING_ROLE_LIST=['ECONOMIC_BUYER','CHAMPION','TECH_EVALUATOR','END_USER','PROCUREMENT','BLOCKER'];
const DECISION_ROLE_LIST=BUYING_ROLE_LIST.filter(r=>r!=='BLOCKER');
const COMMITTEE_MEMBER_STATUS=['IDENTIFIED','ENGAGED','LOST'];
/* --------------------- میشن معرفی (P0-3) --------------------- */
const REF_REQUEST_STATUS_LIST=['REQUESTED','RESPONDED_YES','RESPONDED_NO','NO_RESPONSE'];
const REF_OUTCOME_LIST=['MEET_BOOKED','NO_REPLY','DECLINED','منفی_FIT'];
/* --------------------- منبع فرصت (P0-5) --------------------- */
const OPPORTUNITY_SOURCE_LIST=['REFERRAL','EXISTING_RELATIONSHIP','EVENT','COLD'];
/* کیدنس هدف بر اساس نوع رابطه (P0-4): چند روز یک بار باید تعامل معنادار ثبت شود */
const CADENCE_DEFAULT={STRATEGIC_PARTNERSHIP:30,BANKING:30,CUSTOMER:45,SUPPLY:30,INVESTMENT:60,PARENT_SUBSIDIARY:30,OTHER:60};
function relCadence(r){
  const cadenceDays=r.cadenceDays??CADENCE_DEFAULT[r.relationshipType]??60;
  const last=r.lastInteractionAt??r.createdAt??nowIso();
  const daysSinceLastInteraction=Math.max(0,Math.floor((Date.now()-new Date(last).getTime())/86400000));
  const status=daysSinceLastInteraction>cadenceDays*2?'CRITICAL':daysSinceLastInteraction>cadenceDays?'WARN':'FRESH';
  const dueAt=new Date(new Date(last).getTime()+cadenceDays*86400000).toISOString();
  return {cadenceDays,daysSinceLastInteraction,status,overdueDays:Math.max(0,daysSinceLastInteraction-cadenceDays),dueAt};
}

const orgById=(id)=>ORGS.find(o=>o.id===id);
/* P0-1 دقت: ثبت/ویرایش تعامل باید روی رابطهٔ پیوند اثر بگذارد تا کیدنس واقعی شود. */
function applyInteractionToRel(rel, x){
  if(!rel) return;
  const at=x.occurredAt??nowIso();
  if(!rel.lastInteractionAt||new Date(at)>new Date(rel.lastInteractionAt)) rel.lastInteractionAt=at;
  if(x.nextStepAt){ rel.nextActionAt=x.nextStepAt; delete rel.nextActionNote; if(x.nextStep) rel.nextActionNote=String(x.nextStep).slice(0,200); }
  else if(x.nextStep===undefined&&!x.nextStepAt&&rel.nextActionNote){
    const others=(INTERACTIONS??[]).filter(i=>i.relationshipId===rel.id&&i.id!==x.id&&i.nextStepAt).sort((a,b)=>String(a.nextStepAt).localeCompare(String(b.nextStepAt)));
    if(!others.length){ rel.nextActionAt=null; delete rel.nextActionNote; }
    else { rel.nextActionAt=others[0].nextStepAt; rel.nextActionNote=others[0].nextStep??null; }
  }
}
const personById=(id)=>PEOPLE.find(p=>p.id===id);
/* ── فاز ۲ (ADR-0006): امتیاز مرکب واحد — همان فرمول و وزن‌های apps/api/src/entity-scores ──
   composite = Σ(value×weight)/Σweights · risk معکوس · فرمول نسخه‌دار (Sprint 2: بستهٔ مشترک domain-rules) */
const ENTITY_SCORE_FORMULA_VERSION='1.0.0-plan-phase2';
const SCORE_WEIGHTS={health:.25,risk:.20,strategic:.15,trust:.15,engagement:.10,influence:.05,opportunity:.05,resilience:.05};
const clampScore=(n)=>Math.max(0,Math.min(100,Number.isFinite(+n)?+n:0));
function computeEntityScore(factors,weights=SCORE_WEIGHTS){
  let weighted=0,total=0; const detail={};
  for(const key of Object.keys(SCORE_WEIGHTS)){
    const raw=clampScore(factors[key]);
    const inverted=key==='risk';
    const value=inverted?100-raw:raw;
    const weight=Math.max(0,weights[key]??SCORE_WEIGHTS[key]);
    weighted+=value*weight; total+=weight;
    detail[key]={value,weight,inverted};
  }
  return {composite:Math.round((total>0?weighted/total:0)*10)/10, factors:detail, formulaVersion:ENTITY_SCORE_FORMULA_VERSION};
}
function relEntityScore(r){
  return computeEntityScore({health:r.healthScore??60,risk:r.riskScore??30,strategic:r.strategicScore??50,trust:r.trustScore??55,engagement:r.engagementScore??50,influence:r.influenceScore??50,opportunity:r.opportunityScore??50,resilience:r.resilienceScore??50});
}
/* نمایش فارسی اعداد و تاریخ در متن‌های تولیدی (هشدارها، دلایل فرصت‌ها و…) —
   اعداد لاتین در جملهٔ فارسی ناخوانا و ناهمگون دیده می‌شوند.
   faD: تاریخ کوتاه شمسی «۱۱ شهریور» (ترتیب درست، بدون وابستگی به ICU weekday) */
const FA_DIGITS=['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const faN=(x)=>String(x).replace(/[0-9]/g,(d)=>FA_DIGITS[+d]);
const faD=(iso)=>{try{return new Date(iso).toLocaleDateString('fa-IR',{day:'numeric',month:'long'})}catch{return String(iso).slice(0,10)}};
const relWithOrgs=(r)=>{const es=relEntityScore(r);return {...r, cadence:relCadence(r), compositeScore:es.composite, scoreFactors:es.factors, scoreFormulaVersion:es.formulaVersion, sourceOrganization:{id:r.sourceOrganizationId,name:orgById(r.sourceOrganizationId)?.name}, targetOrganization:{id:r.targetOrganizationId,name:orgById(r.targetOrganizationId)?.name}};};

/* ── فاز ۳ (ADR-0007): هشدار یکپارچه — همان منطق تشخیص پراکندهٔ قبل، خروجی واحد ──
   نگاشت قفل‌شده در INTEGRATION-PLAN.md؛ هیچ آستانه‌ای تغییر نکرده. */
function relationshipAlertItems(req){
  const rels=scopedRels(req).filter(r=>!r.deletedAt);
  const now=Date.now();
  const alerts=[];
  for(const r of rels){
    const name = `${orgById(r.sourceOrganizationId)?.name ?? r.sourceOrganizationId} ↔ ${orgById(r.targetOrganizationId)?.name ?? r.targetOrganizationId}`;
    const daysStale = r.lastInteractionAt ? Math.floor((now - new Date(r.lastInteractionAt).getTime())/86400000) : 999;
    const cad = r.cadenceDays ?? 60;
    if(r.marketKind==='MARKET'){
      if((r.healthScore??100) < 45) alerts.push({id:`a-${r.id}-mHealth`, relationshipId:r.id, tone:'danger', kind:'MARKET_HEALTH', title:'رابطهٔ بازاری بحرانی', body:`«${name}» سلامت ${faN(r.healthScore)} — در زنجیرهٔ بازار مستقیم اختلال ایجاد می‌کند.`, marketKind:r.marketKind, isMarketEntry:r.isMarketEntry, health:r.healthScore, segment:r.marketSegment});
      else if((r.riskScore??0) >= 60) alerts.push({id:`a-${r.id}-mRisk`, relationshipId:r.id, tone:'warning', kind:'MARKET_RISK', title:'ریسک بالای رابطهٔ بازاری', body:`«${name}» ریسک ${faN(r.riskScore)} و بدون اقدام اصلاحی باز.`, marketKind:r.marketKind, isMarketEntry:r.isMarketEntry, risk:r.riskScore, segment:r.marketSegment});
      if(r.isMarketEntry && daysStale > cad) alerts.push({id:`a-${r.id}-entryStale`, relationshipId:r.id, tone:'danger', kind:'ENTRY_STALE', title:'نقطهٔ ورود به بازار راکد', body:`«${name}» ورودی بازار «${r.marketSegment||'—'}» است ولی ${faN(daysStale)} روز بدون تعامل مانده (هدف هر ${faN(cad)} روز).`, daysStale, cadence:cad, marketKind:r.marketKind, isMarketEntry:true, segment:r.marketSegment});
      if(daysStale > cad+15) alerts.push({id:`a-${r.id}-mStale`, relationshipId:r.id, tone: daysStale>cad+30?'danger':'warning', kind:'MARKET_STALE', title:'رابطهٔ بازاری کهنه', body:`«${name}» ${faN(daysStale)} روز بدون تعامل — خطر از دست دادن سهم بازار.`, daysStale, cadence:cad, marketKind:r.marketKind, segment:r.marketSegment});
    } else if(r.marketKind==='NON_MARKET'){
      if((r.healthScore??100) < 50) alerts.push({id:`a-${r.id}-nmHealth`, relationshipId:r.id, tone:'warning', kind:'NONMARKET_HEALTH', title:'رابطهٔ غیربازاری ناپایدار', body:`«${name}» (غیربازاری — ${r.marketSegment||'نهاد/تنظیم‌گر'}) سلامت ${faN(r.healthScore)}؛ می‌تواند مسیر ورود به بازار را مسدود کند.`, marketKind:r.marketKind, health:r.healthScore, segment:r.marketSegment});
      if((r.riskScore??0)>=55 && r.isMarketEntry) alerts.push({id:`a-${r.id}-nmBlock`, relationshipId:r.id, tone:'danger', kind:'NONMARKET_BLOCK', title:'انسداد احتمالی ورود به بازار', body:`«${name}» به‌عنوان دروازهٔ ورود «${r.marketSegment||'—'}» پرریسک شده (ریسک ${faN(r.riskScore)}). بازبینی حاکمیتی لازم است.`, marketKind:r.marketKind, isMarketEntry:true, risk:r.riskScore, segment:r.marketSegment});
    }
    if(r.marketKind==='HYBRID' && (r.healthScore??100) < 50) alerts.push({id:`a-${r.id}-hyb`, relationshipId:r.id, tone:'warning', kind:'HYBRID_RISK', title:'رابطهٔ دوگانه ناپایدار', body:`«${name}» (هیبرید — هم بازار، هم نهاد) نیازمند مراقبت دوگانه است.`, marketKind:r.marketKind, health:r.healthScore});
    if(daysStale > cad && r.status==='ACTIVE' && !alerts.some(a=>a.relationshipId===r.id && a.kind.includes('STALE'))){
      alerts.push({id:`a-${r.id}-cad`, relationshipId:r.id, tone: daysStale>cad+20?'danger':'warning', kind:'CADENCE_BREAK', title:'کیدنس شکسته', body:`«${name}» ${faN(daysStale)} روز بدون تعامل (هدف ${faN(cad)} روز).`, daysStale, cadence:cad, marketKind:r.marketKind, segment:r.marketSegment});
    }
  }
  const segments = [...new Set(rels.filter(r=>r.marketKind==='MARKET').map(r=>r.marketSegment).filter(Boolean))];
  const entrySegments = new Set(rels.filter(r=>r.isMarketEntry).map(r=>r.marketSegment).filter(Boolean));
  for(const seg of ['پتروشیمی و انرژی','بانکداری و تأمین مالی','ساخت‌وساز و پروژه‌های عمرانی','فناوری']){
    if(!entrySegments.has(seg) && !segments.includes(seg)) alerts.push({id:`a-missing-${seg}`, tone:'info', kind:'MISSING_ENTRY', title:'بازار بدون نقطهٔ ورود', body:`برای سگمنت «${seg}» هنوز نقطهٔ ورود بازاری ثبت نشده — فرصت یا ریسک پوشش.`, segment:seg});
  }
  const order={danger:0,warning:1,info:2};
  alerts.sort((a,b)=> (order[a.tone]??9)-(order[b.tone]??9) || String(a.kind).localeCompare(String(b.kind)));
  return alerts;
}
const ALERT_TONE_TO_SEVERITY={danger:'CRITICAL',warning:'WARNING',info:'INFO'};
const ALERT_MODULE_FA={RELATIONSHIP:'روابط',PUBLICS:'عموم‌ها',ACTION:'اقدامات',COMMITMENT:'تعهدات',MEETING:'جلسات',WORKFLOW:'گردش کار',DATA_QUALITY:'کیفیت داده',SECURITY:'امنیت',MONITORING:'پایش'};
function unifiedAlert(req,authUser,module,severity,entityType,entityId,title,reason,actionLabel,actionUrl,extra={}){
  /* شناسهٔ پایدار و URL-safe: hash ترکیبی (djb2) از ماژول+نهاد+عنوان — پایدار بین اجراها برای resolve */
  const djb2=(str)=>{let x=5381;for(let i=0;i<str.length;i++)x=((x<<5)+x+str.charCodeAt(i))>>>0;return x.toString(36)};
  return {id:`al-${module.toLowerCase()}-${entityId}-${djb2(module+'|'+entityId+'|'+title+'|'+severity)}`,module,moduleFa:ALERT_MODULE_FA[module],severity,entityType,entityId,title,reason,actionLabel:actionLabel??null,actionUrl:actionUrl??null,createdAt:nowIso(),resolvedAt:null,...extra};
}
function collectUnifiedAlerts(req,authUser){
  const items=[];
  const can=(perm)=>authUser?.isOwner||(authUser?.permissions??[]).includes(perm);
  /* RELATIONSHIP — همان منطق /relationships/alerts، نگاشت به شکل واحد */
  for(const a of relationshipAlertItems(req)){
    items.push(unifiedAlert(req,authUser,'RELATIONSHIP',ALERT_TONE_TO_SEVERITY[a.tone]??'INFO','RELATIONSHIP',a.relationshipId??a.id,a.title,a.body,a.relationshipId?'مشاهدهٔ رابطه':'بررسی پوشش بازار',a.relationshipId?`/relationships/${a.relationshipId}`:'/relationships',{kind:a.kind,marketKind:a.marketKind??null,segment:a.segment??null}));
  }
  /* PUBLICS — شکاف‌های بحرانی/عقب‌مانده + بازبینی سررسیدشده */
  if(can('publics.read')){
    seedPublicsStore();
    const now=Date.now();
    for(const self of (DB.publicsSelf??[])){
      if(!inScope(req,self.orgId)) continue;
      const gaps=pubGaps(self.orgId);
      /* شکاف «غایب»: فقط بحرانی (بازیگر کلیدی بدون عضو) و حداکثر ۱۰ مورد در هر سازمان —
         فهرست کامل در /publics/gaps زندگی می‌کند؛ اینجا فقط آنچه اکنون اقدام می‌خواهد. */
      const missing=gaps.gaps.filter(g=>g.kind==='missing'&&g.severity==='CRITICAL').slice(0,10);
      for(const g of missing){
        items.push(unifiedAlert(req,authUser,'PUBLICS','CRITICAL','PUBLIC_GAP',g.gapId,`شکاف عموم‌ها: ${g.groupFa}`,`در دستهٔ «${g.categoryFa}» این بازیگر کلیدی هنوز عضو ندارد. اقدام پیشنهادی: ${g.action}.`,'رفتن به نقشهٔ عموم‌ها','/publics',{categoryId:g.categoryId}));
      }
      /* شکاف «عقب‌مانده»: بازیگر کلیدی در مرحلهٔ نابالغ — همه (كم‌تعداد و اکشن‌پذیر) */
      for(const g of gaps.gaps.filter(x=>x.kind==='lagging')){
        items.push(unifiedAlert(req,authUser,'PUBLICS','WARNING','PUBLIC_GAP',g.gapId,`بازیگر کلیدی عقب‌مانده: ${g.groupFa}`,`عمومِ کلیدی در مرحلهٔ نابالغ است؛ تعامل مستقیم دوسویه لازم. ${g.sourceName?`ذی‌نفع: ${g.sourceName}.`:''}`,'رفتن به نقشهٔ عموم‌ها','/publics',{categoryId:g.categoryId,memberId:g.memberId??null}));
      }
      const due=(DB.publicsMembers??[]).filter(m=>m.orgId===self.orgId&&m.reviewDue&&new Date(m.reviewDue).getTime()<=now);
      for(const m of due){
        items.push(unifiedAlert(req,authUser,'PUBLICS','WARNING','PUBLIC_MEMBER',m.id,'بازبینی عموم سررسید شده',`ارزیابی «${pubSourceName(m)}» در گروه ${m.groupId} باید بازبینی شود (سررسید ${faD(m.reviewDue)}).`,'بازبینی عضو','/publics',{groupId:m.groupId}));
      }
    }
  }
  /* ACTION — عقب‌افتاده → CRITICAL · نزدیک سررسید (≤۷ روز) → WARNING */
  if(can('action.read')){
    const now=Date.now();
    for(const a of scopedActions(req).filter(x=>['OPEN','IN_PROGRESS'].includes(x.status)&&x.dueAt)){
      const due=new Date(a.dueAt).getTime();
      if(due<now) items.push(unifiedAlert(req,authUser,'ACTION','CRITICAL','ACTION',a.id,`اقدام عقب‌افتاده: ${a.title}`,`سررسید ${faD(a.dueAt)} گذشته است.`,`رفتن به اقدامات`,'/actions'));
      else if(due-now<=7*86400000) items.push(unifiedAlert(req,authUser,'ACTION','WARNING','ACTION',a.id,`اقدام نزدیک به سررسید: ${a.title}`,`سررسید ${faD(a.dueAt)} — کمتر از ۷ روز باقی مانده.`,'رفتن به اقدامات','/actions'));
    }
  }
  /* COMMITMENT — عقب‌افتاده → CRITICAL · نزدیک سررسید → WARNING */
  if(can('commitment.read')){
    const now=Date.now();
    for(const c of scopedCommitments(req).filter(x=>['OPEN','OVERDUE'].includes(x.status)&&x.dueAt)){
      const due=new Date(c.dueAt).getTime();
      if(due<now) items.push(unifiedAlert(req,authUser,'COMMITMENT','CRITICAL','COMMITMENT',c.id,`تعهد عقب‌افتاده: ${c.description}`,`سررسید ${faD(c.dueAt)} گذشته است؛ ${c.direction==='OURS'?'تعهد ما':'تعهد طرف مقابل'}.`,'رفتن به تعهدات','/commitments'));
      else if(due-now<=7*86400000) items.push(unifiedAlert(req,authUser,'COMMITMENT','WARNING','COMMITMENT',c.id,`تعهد نزدیک به سررسید: ${c.description}`,`سررسید ${faD(c.dueAt)} — کمتر از ۷ روز باقی مانده.`,'رفتن به تعهدات','/commitments'));
    }
  }
  /* MEETING — جلسهٔ گذشتهٔ بدون نتیجه */
  if(can('meeting.read')){
    const now=Date.now();
    for(const m of scopedMeetings(req).filter(x=>new Date(x.startAt).getTime()<now&&!x.outcome)){
      items.push(unifiedAlert(req,authUser,'MEETING','INFO','MEETING',m.id,`جلسه بدون نتیجهٔ ثبت‌شده: ${m.title}`,`جلسهٔ ${String(m.startAt).slice(0,10)} برگزار شده اما خروجی‌اش ثبت نشده — خروجی، اقدام و تعهد بعدی را ببندید.`,'ثبت نتیجهٔ جلسه','/meetings'));
    }
  }
  /* WORKFLOW — اجرای شکست‌خورده */
  if(can('workflow.read')){
    for(const e of (DB.workflowExecutions??[]).filter(x=>x.status==='FAILED')){
      const wf=(DB.workflows??[]).find(w=>w.id===e.workflowId);
      if(wf&&wf.organizationId&&!inScope(req,wf.organizationId)) continue; /* همان قاعدهٔ wfScopeOk */
      items.push(unifiedAlert(req,authUser,'WORKFLOW','CRITICAL','WORKFLOW_EXECUTION',e.id,`اجرای گردش کار شکست خورد${wf?` (${wf.name})`:''}`,`خطا: ${e.context?.error??'نامشخص'} — اجرا در ${String(e.startedAt??'').slice(0,10)}.`,'بررسی اجراها','/workflows'));
    }
  }
  /* DATA_QUALITY — از آخرین اسکن کیفیت (اگر وجود دارد؛ دادهٔ ساختگی ساخته نمی‌شود) */
  if(can('data.quality.read')&&Array.isArray(DB.dataQualitySnapshots)){
    const seen=new Set();
    for(const snap of [...DB.dataQualitySnapshots].reverse()){
      if(seen.has(snap.organizationId)) continue; seen.add(snap.organizationId);
      const issues=(snap.issues??snap.findings??[]);
      if(Array.isArray(issues)&&issues.length) items.push(unifiedAlert(req,authUser,'DATA_QUALITY','WARNING','DATA_QUALITY',snap.id||`dq-${snap.organizationId}`,`مشکل کیفیت داده در محدودهٔ ${snap.organizationId==='all'||!snap.organizationId?'کل':orgById(snap.organizationId)?.name??snap.organizationId}`,`${faN(issues.length)} مورد در آخرین اسکن (${String(snap.generatedAt??snap.createdAt??'').slice(0,10)})؛ نخستین: ${typeof issues[0]==='string'?issues[0]:issues[0]?.title??issues[0]?.message??'—'}.`,'مرکز کیفیت داده','/data-quality'));
    }
  }
  /* SECURITY — رویدادهای امنیتی بحرانی باز */
  if(can('security.read')){
    const orgIds=authUser?.isOwner?null:visibleOrgIds(req);
    for(const ev of (DB.securityEvents??[]).filter(x=>x.severity==='CRITICAL'||x.type==='ACCOUNT_LOCKED')){
      /* همان قاعدهٔ /security/events: مالک همه؛ مستأجر فقط رویدادهای خودش/سازمانش */
      if(orgIds!==null&&!(ev.userId===authUser?.id||(ev.organizationId&&orgIds.includes(ev.organizationId)))) continue;
      items.push(unifiedAlert(req,authUser,'SECURITY','CRITICAL','SECURITY_EVENT',ev.id,`رویداد امنیتی: ${ev.type}`,`${ev.metadata?.reason??'نیازمند بررسی'} از IP ${ev.ipAddress??'—'} در ${String(ev.createdAt).slice(0,10)}.`,'بررسی رویدادها','/security-events'));
    }
  }
  /* MONITORING — از سنجه‌های زندهٔ موتور (CPU/در دسترس بودن/تأخیر) */
  {
    const sn=metricsSnapshotNow();
    if(sn.process?.cpuPercent>80) items.push(unifiedAlert(req,authUser,'MONITORING','CRITICAL','RUNTIME','cpu',`بار پردازش موتور بالا (${faN(Math.round(sn.process.cpuPercent))}٪)`,`زیرساخت دمو تحت فشار است؛ پاسخ‌گویی کند می‌شود.`,'مرکز پایش','/monitoring'));
    if(sn.availabilityPercent<99) items.push(unifiedAlert(req,authUser,'MONITORING','WARNING','RUNTIME','availability',`در دسترس بودن ${faN(sn.availabilityPercent)}٪ (زیر هدف ۹۹٪)`,`افت دسترس‌پذیری در بازهٔ اخیر.`,'مرکز پایش','/monitoring'));
    if(sn.averageLatencyMs>400) items.push(unifiedAlert(req,authUser,'MONITORING','WARNING','RUNTIME','latency',`تأخیر میانگین ${faN(Math.round(sn.averageLatencyMs))} میلی‌ثانیه`,`بالای آستانهٔ ۴۰۰ میلی‌ثانیه.`,'مرکز پایش','/monitoring'));
  }
  /* فیلتر موارد resolve شده (ذخیرهٔ پایدار) */
  const resolutions=DB.alertResolutions??{};
  const sevOrder={CRITICAL:0,WARNING:1,INFO:2};
  return items.filter(a=>!resolutions[a.id]).sort((a,b)=>(sevOrder[a.severity]??9)-(sevOrder[b.severity]??9)||String(a.module).localeCompare(String(b.module)));
}

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
  {
    const cad=relCadence(r);
    if(cad.status==='CRITICAL') push('critical','کیدنس رابطه شکسته',`آخرین تعامل ${cad.daysSinceLastInteraction} روز پیش؛ هدف ${cad.cadenceDays} روز — بیش از ۲ برابر عقب است.`);
    else if(cad.status==='WARN') push('warning','کیدنس رابطه عقب افتاده',`آخرین تعامل ${cad.daysSinceLastInteraction} روز پیش؛ هدف ${cad.cadenceDays} روز است.`);
  }
  if(r.nextActionAt&&new Date(r.nextActionAt).getTime()<now) push('warning','قدمِ برنامه‌ریزی‌شده عقب افتاده',`قدم بعدی برای ${faDate(r.nextActionAt)} تعیین شده و هنوز انجام نشده است.`);
  const openActs=scopedActions(req).filter(a=>a.relationshipId===r.id&&['OPEN','IN_PROGRESS','BLOCKED'].includes(a.status));
  if(risk>=40&&openActs.length===0) push('warning','بدون اقدام اصلاحی باز','برای این رابطه هیچ اقدام بازِ کاهش ریسک ثبت نشده است.');
  const lateActs=openActs.filter(a=>a.dueAt&&new Date(a.dueAt).getTime()<now);
  if(lateActs.length) push('critical',`${faN(lateActs.length)} اقدام عقب‌افتاده`,`نخستین: «${lateActs[0].title}» — موعد ${faDate(lateActs[0].dueAt)} گذشته است.`);
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
/* خلاصهٔ دقیق کمیتهٔ خرید: بلاکرها از پوشش/نقش‌های حاضر جدا هستند و فقط وضعیت ENGAGED در چندلایه شمرده می‌شود. */
function committeeSummary(oppId){
  const rows=(COMMITTEE??[]).filter(c=>c.opportunityId===oppId);
  const present=DECISION_ROLE_LIST.filter(role=>rows.some(c=>c.role===role&&c.status!=='LOST'));
  const presentRows=rows.filter(c=>c.role!=='BLOCKER'&&c.status!=='LOST');
  const engaged=DECISION_ROLE_LIST.filter(role=>rows.some(c=>c.role===role&&c.status==='ENGAGED'));
  const blockers=rows.filter(c=>c.role==='BLOCKER');
  return {total:rows.length,requiredRoles:DECISION_ROLE_LIST.length,presentRoles:present.length,engagedRoles:engaged.length,
    coverage:DECISION_ROLE_LIST.length?Math.round(present.length/DECISION_ROLE_LIST.length*100):0,
    multiThreaded:engaged.length>=3,blockers:blockers.length,blockerNames:blockers.map(c=>personById(c.personId)?`${personById(c.personId).firstName} ${personById(c.personId).lastName??''}`.trim():null).filter(Boolean),
    present,missing:DECISION_ROLE_LIST.filter(role=>!present.includes(role)),engaged,items:presentRows};
}
/* نمای غنی فرصت: سازمان + مالک + رابطه + پروژه + ارزش موزون */
const opportunityView=(o)=>{
  const owner=personById(o.ownerId);
  const rel=o.relationshipId?RELS.find(r=>r.id===o.relationshipId):null;
  const pr=o.projectId?PROJECTS.find(p=>p.id===o.projectId):null;
  const expectedValue=Math.round(((o.value??0)*(o.probability??0))/100);
  const committee=committeeSummary(o.id);
  return {...o,committee,
    owner:owner?{id:owner.id,name:`${owner.firstName} ${owner.lastName??''}`.trim()}:null,
    organization:orgById(o.organizationId)?{id:o.organizationId,name:orgById(o.organizationId).name}:null,
    relationship:rel?{id:rel.id,relationshipType:rel.relationshipType,sourceOrganization:orgById(rel.sourceOrganizationId)?{id:rel.sourceOrganizationId,name:orgById(rel.sourceOrganizationId).name}:null,targetOrganization:orgById(rel.targetOrganizationId)?{id:rel.targetOrganizationId,name:orgById(rel.targetOrganizationId).name}:null}:null,
    project:pr?{id:pr.id,name:pr.name}:null,
    expectedValue,
    openStatus:!['WON','LOST'].includes(o.status),
  };
};

/* --------------------------- identities & scope --------------------------- */
/* ─────────── مستأجران (Multi-tenant): هر شرکت محیط اختصاصی خودش ───────────
   «دادهٔ دمو فقط در دمو»: دنیای آریا (org-1…org-12) و حساب‌های دموی آن
   (u-1، u-2، u-3) کاملاً از دادهٔ واقعی (شرکت x + هلدینگ پارس و نهادهای سند
   عموم‌ها) و حساب‌های واقعی جدا هستند. حساب تازه‌ثبت‌نام نیز بدون هیچ داده‌ای
   شروع می‌کند و محیط اختصاصی خودش را می‌سازد. */
const DEMO_ORG_IDS = new Set(['org-1','org-2','org-3','org-4','org-5','org-6','org-7','org-8','org-9','org-10','org-11','org-12']);
const DEMO_USER_IDS = new Set(['u-1','u-2','u-3']);
/* فقط seed اولیه (بدون سازمان‌های runtime) — مبنا برچسب‌گذاری مستأجر */
const REAL_ORG_IDS = new Set(ORGS.map(o=>o.id).filter(id=>!DEMO_ORG_IDS.has(id)));
const orgTenant=(o)=>{ if(!o) return null; if(o.tenant) return o.tenant; return DEMO_ORG_IDS.has(o.id)?'demo':(REAL_ORG_IDS.has(o.id)?'real':'personal'); };

const SEED_USERS = {
  /* حساب واقعی مالک سامانه — شرکت x (بدون MFA؛ ورود مستقیم با نام کاربری aroun) */
  'aroun@srip.local': {
    id:'u-aroun', email:'aroun@srip.local', username:'aroun', name:'aroun', password:'12356784',
    memberships:[{id:'mb-aroun',organizationId:'org-x',organizationName:'شرکت x',role:'SUPER_ADMIN',department:'مالکیت',dataScope:'ALL',accessScope:'ALL',isPrimary:true}],
    permissions:['*'],
    /* مالک واقعی: فقط دادهٔ واقعی (شرکت x + پارس و نهادها) — هرگز دنیای دمو */
    accessibleOrganizationIds:ORGS.map(o=>o.id).filter(id=>!DEMO_ORG_IDS.has(id)),
    isOwner:true,
    isActive:true,
    emailVerifiedAt:'2026-09-01T08:00:00.000Z',
    lastLoginAt:'2026-09-10T10:00:00.000Z',
    createdAt:'2026-09-01T08:00:00.000Z',
  },
  /* حساب واقعی مشتری سامانه: مدیرعامل هلدینگ پارس — فقط محیط پارس
     (هلدینگ + ۱۲ حوزه + نهادهای سند عموم‌ها)؛ نه شرکت x می‌بیند نه دنیای دمو.
     ورود: pars / pars1234 (بدون MFA) */
  'pars@srip.local': {
    id:'u-pars', email:'pars@srip.local', username:'pars', name:'مدیرعامل هلدینگ پارس', password:'pars1234',
    memberships:[{id:'mb-pars',organizationId:'org-pars',organizationName:'هلدینگ پارس',role:'SUPER_ADMIN',department:'هیئت‌مدیره',dataScope:'ALL',accessScope:'ALL',isPrimary:true}],
    permissions:['*'],
    accessibleOrganizationIds:ORGS.map(o=>o.id).filter(id=>!DEMO_ORG_IDS.has(id)&&id!=='org-x'),
    isOwner:false,
    isActive:true,
    emailVerifiedAt:'2026-09-05T08:00:00.000Z',
    lastLoginAt:'2026-09-11T09:00:00.000Z',
    createdAt:'2026-09-05T08:00:00.000Z',
  },
  'demo@srip.local': {
    id:'u-1', email:'demo@srip.local', username:'demo', name:'مدیر ارشد (مالک)', password:'123456',
    memberships:[{id:'mb-1',organizationId:'org-1',organizationName:'هلدینگ آریا',role:'SUPER_ADMIN',department:'استراتژی',dataScope:'ALL',accessScope:'ALL',isPrimary:true}],
    permissions:['*'],
    /* حساب دمو: فقط دنیای دمو (آریا) — هرگز دادهٔ واقعی مشتری‌ها */
    accessibleOrganizationIds:ORGS.map(o=>o.id).filter(id=>DEMO_ORG_IDS.has(id)),
    isOwner:true,
    isActive:true,
    emailVerifiedAt:'2026-06-01T08:00:00.000Z',
    lastLoginAt:'2026-09-03T10:30:00.000Z',
    createdAt:'2026-01-15T08:00:00.000Z',
  },
  'admin@srip.local': {
    id:'u-3', email:'admin@srip.local', username:'admin', name:'مدیر هلدینگ (ناظر)', password:'123456',
    memberships:[{id:'mb-3',organizationId:'org-1',organizationName:'هلدینگ آریا',role:'ADMIN',department:'هیئت‌مدیره',dataScope:'ALL',accessScope:'ALL',isPrimary:true}],
    permissions:['*'],
    /* حساب دمو: فقط دنیای دمو (آریا) */
    accessibleOrganizationIds:ORGS.map(o=>o.id).filter(id=>DEMO_ORG_IDS.has(id)),
    isOwner:true,
    isActive:true,
    emailVerifiedAt:'2026-06-01T08:00:00.000Z',
    lastLoginAt:'2026-09-01T09:00:00.000Z',
    createdAt:'2026-02-01T08:00:00.000Z',
  },
  'client@arya-tech.ir': {
    id:'u-2', email:'client@arya-tech.ir', username:'client', name:'سارا محمدی', password:'123456',
    memberships:[{id:'mb-2',organizationId:'org-2',organizationName:'آریا فناوری',role:'RELATIONSHIP_MANAGER',department:'فروش',dataScope:'ORGANIZATION',accessScope:'ORGANIZATION',isPrimary:true}],
    permissions:['dashboard.read','organization.read','person.read','relationship.read','meeting.read','interaction.read','action.read','commitment.read','project.read','opportunity.read','network.read','ai.query','ai.executive_brief','recommendation.read','report.read','مجوز خروجی گزارش','approval.request','approval.read','search.read','notification.read','document.read','calendar.read','help.read','privacy.read','privacy.access','privacy.export','privacy.erase','enterprise.read','feature_flag.read','analytics.read','analytics.write'],
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
  /* حساب دمو: فقط دنیای دمو (آریا) — دادهٔ واقعی مشتری‌ها هرگز */
  if(DEMO_USER_IDS.has(u.id)){
    const base=u.isOwner?ORGS.map(o=>o.id):(u.accessibleOrganizationIds??[]);
    return base.filter(id=>orgTenant(orgById(id))==='demo');
  }
  /* مالک واقعی (aroun): همهٔ دادهٔ واقعی (شرکت x + مشتری‌ها) — دنیای دمو هرگز */
  if(u.isOwner) return ORGS.filter(o=>orgTenant(o)!=='demo').map(o=>o.id);
  /* سایر حساب‌ها (ثبت‌نام‌شده): فقط سازمان‌های خودشان — شروع بدون داده */
  return (u.accessibleOrganizationIds??[]).filter(id=>{const o=orgById(id);return !!o&&orgTenant(o)!=='demo';});
}
/* اعلان‌های قابل‌مشاهدهٔ این مستأجر (همان قاعدهٔ داده) */
function visibleNotifications(req){
  const u=currentUser(req);
  const tn=u?(DEMO_USER_IDS.has(u.id)?'demo':(u.isOwner?'real':null)):null;
  return NOTIFICATIONS.filter(n=>{
    const t=n.tenant??'demo';
    if(t==='demo') return tn==='demo';
    if(t==='real') return tn==='real';
    return !!n.userId&&n.userId===(u?.id??null); /* personal: فقط سازنده */
  });
}
function inScope(req,orgId){ return visibleOrgIds(req).includes(orgId); }
const scopedOrgs=(req)=>ORGS.filter(o=>inScope(req,o.id));
/* سازمان اصلیِ کاربر (برای مالکیت پیش‌فرضِ آیتم‌های تازه‌ساخته) */
const primaryOrgId=(u)=>(u?.memberships??[]).find(m=>m.isPrimary)?.organizationId
  ??(u?.memberships??[])[0]?.organizationId
  ??(u?.accessibleOrganizationIds??[])[0]??null;
const scopedPeople=(req)=>PEOPLE.filter(p=>inScope(req,p.organizationId));
// A relationship belongs to a tenant if at least one endpoint is in its scope
// (its own relationships with outside organizations remain visible).
const scopedRels=(req)=>RELS.filter(r=>inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId));
const relInScope=(req,r)=>inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId);

/* ------------------------ network helpers (deterministic) ------------------------ */
// org-org graph over visible relationships (edge ids match /network/graph export)
function netOrgAdj(req){
  const adj=new Map(); const byKey=new Map();
  const rels=scopedRels(req);
  const edgeOf=(r)=>({
    id:`e-${r.id}`, source:`org:${r.sourceOrganizationId}`, target:`org:${r.targetOrganizationId}`,
    kind:'relationship',
    weight:Math.round(30+(r.healthScore??50)/2),
    risk:r.riskScore??0,
    strategicImportance:r.strategicScore??50,
    status:r.status, health:r.healthScore, label:r.relationshipType,
    edgeCategory:orgColumn(r.sourceOrganizationId)==='TEAM'?orgColumn(r.targetOrganizationId):orgColumn(r.sourceOrganizationId),
    heat:Math.round(0.6*(r.healthScore??50)+0.4*(100-(r.riskScore??0))),
  });
  const put=(u,v,rel)=>{
    const key=[u,v].sort().join('|');
    if(byKey.has(key)) return;
    byKey.set(key,rel);
    for(const [a,b] of [[u,v],[v,u]]){ if(!adj.has(a)) adj.set(a,[]); adj.get(a).push({v:b,w:edgeOf(rel).weight,risk:rel.riskScore??0}); }
  };
  for(const r of rels){ if(inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId)) put(r.sourceOrganizationId,r.targetOrganizationId,r); }
  return {adj,byKey,rels,edgeOf};
}
const PATH_RISK_THRESHOLD=60; // آستانهٔ ریسک پیوند (هم‌راستا با بقیهٔ ماژول)
// path search: shortest = BFS (hop count); best = Dijkstra over cost max(1,(101-weight)+risk*0.5)
// P1-6: سقف پرش (پیش‌فرض ۳)، امتیاز گرمای کل مسیر، دستهٔ پیوند و حاکمیت معرف
let _pathSuggesting=false; // جلوگیری از بازگشت بی‌پایان (predict → path → predict)
function netPathOrg(req,fromId,toId,mode,opts={}){
  const {adj,byKey,rels,edgeOf}=netOrgAdj(req);
  const maxHops=Math.max(1,Math.min(6,Number(opts.maxHops)||3));
  const heatOf=(rel)=>Math.round(0.6*(rel?.healthScore??50)+0.4*(100-(rel?.riskScore??0)));
  const name=(oid)=>orgById(oid)?.name??oid;
  const nodeOf=(oid)=>({id:`org:${oid}`,label:name(oid),type:'organization',organizationId:oid});
  const foundNode=(oid)=>ORGS.some(o=>o.id===oid)&&(inScope(req,oid)||[...byKey.keys()].some(k=>k.split('|').includes(oid)));

  /* ---- مسیرهای سادهٔ ممکن (DFS با سقف) برای جایگزین‌ها و بینش ریسک ---- */
  function allSimplePaths(a,b,limit){
    const out=[]; const seen=new Set([a]);
    const walk=(u,chain)=>{
      if(out.length>=12) return;
      if(u===b){ out.push([...chain]); return; }
      if(chain.length>limit) return;
      for(const nx of (adj.get(u)??[])){
        if(seen.has(nx.v)) continue;
        seen.add(nx.v); chain.push(nx.v);
        walk(nx.v,chain);
        chain.pop(); seen.delete(nx.v);
      }
    };
    walk(a,[a]);
    return out;
  }
  const pathView=(chain)=>{
    const ep=[];
    for(let i=0;i<chain.length-1;i++){
      const rel=byKey.get([chain[i],chain[i+1]].sort().join('|'));
      if(rel) ep.push(edgeOf(rel));
    }
    const avgHeat=ep.length?ep.reduce((s,e)=>s+(e.heat??50),0)/ep.length:100;
    const riskEdges=ep.filter(e=>(e.risk??0)>=PATH_RISK_THRESHOLD||(e.heat??50)<55);
    const score=Math.max(0,Math.min(100,Math.round(avgHeat-(ep.length-1)*5)));
    return {nodes:chain.map(nodeOf),edges:ep,hops:ep.length,score,
      totalCost:Math.round(ep.reduce((s,e)=>s+(mode==='best'?Math.max(1,(101-(e.health??50))+(e.risk??0)*0.5):1),0)*10)/10,
      scoreLabel:score>=85?'عالی':score>=70?'خوب':score>=55?'متوسط':'شکننده',
      isRisky:riskEdges.length>0,riskEdges:riskEdges.length};
  };
  const scoreLabelOf=(score)=>score==null?'—':score>=85?'عالی':score>=70?'خوب':score>=55?'متوسط':'شکننده';

  if(!foundNode(fromId)||!foundNode(toId)) return {found:false,mode,nodes:[],edges:[],hops:0,totalCost:null,score:null,scoreLabel:null,bounded:true,maxHops,capped:false,suggestions:[],reason:'not-found-node'};
  if(fromId===toId) return {found:true,mode,nodes:[nodeOf(fromId)],edges:[],hops:0,totalCost:0,score:100,scoreLabel:'عالی',capped:false,bounded:true,maxHops,governance:{capacityPer30Days:1,loads:[],allowed:true,blockedCount:0}};

  const cost=(u,v)=> {
    const rel=byKey.get([u,v].sort().join('|'));
    return mode==='best' ? Math.max(1,(101-(rel?.healthScore??50))+((rel?.riskScore??0)*0.5)) : 1;
  };
  /* انتخاب مسیر بهینه با Dijkstra (کوتاه‌ترین یا کم‌هزینه) */
  const prev=new Map([[fromId,null]]);
  const dist=new Map([[fromId,0]]);
  const depth=new Map([[fromId,0]]);
  const q=[fromId];
  let guard=0;
  while(q.length&&guard++<20000){
    q.sort((a,b)=>(dist.get(a)??1e9)-(dist.get(b)??1e9));
    const u=q.shift();
    if(u===toId) break;
    const du=depth.get(u)??0;
    if(du>=maxHops) continue;
    for(const n of (adj.get(u)??[])){
      const c=(dist.get(u)??0)+cost(u,n.v);
      if(c<(dist.get(n.v)??1e9)){ dist.set(n.v,c); depth.set(n.v,du+1); prev.set(n.v,u); q.push(n.v); }
    }
  }
  if(!prev.has(toId)){
    /* ---------- مسیر یافت نشد → پیشنهادهای برقراری ارتباط ---------- */
    const suggestions=[];
    if(!_pathSuggesting){
      _pathSuggesting=true;
      try{
        const pred=(predictView(req).predictedLinks??[]);
        const holes=(snaView(req).structuralHoles??[]);
        const both=(x)=>(x.fromOrg===fromId&&x.toOrg===toId)||(x.fromOrg===toId&&x.toOrg===fromId);
        for(const pl of pred.filter(both)){
          suggestions.push({id:`sg-direct-${pl.id}`,kind:'DIRECT',score:pl.score,fromOrg:pl.fromOrg,toOrg:pl.toOrg,
            fromOrgName:pl.fromOrgName,toOrgName:pl.toOrgName,sharedMeetings:pl.sharedMeetings,expectedValue:pl.expectedValue,
            reason:pl.reason?.join('؛ ')??`ایجاد پیوند مستقیم بین «${pl.fromOrgName}» و «${pl.toOrgName}» — پتانسیل همکاری شناسایی شده است.`});
        }
        for(const h of holes.filter(both)){
          suggestions.push({id:`sg-intro-${h.id}`,kind:'INTRO',score:h.score,fromOrg:h.fromOrg,toOrg:h.toOrg,
            fromOrgName:h.fromOrgName,toOrgName:h.toOrgName,viaPerson:h.viaPerson,viaPersonId:h.viaPersonId,
            toPerson:h.toPerson,toPersonId:h.toPersonId,reason:h.reason});
        }
        for(const pl of pred.filter(x=>x.fromOrg===fromId||x.toOrg===fromId).slice(0,2)){
          const other=pl.fromOrg===fromId?pl.toOrg:pl.fromOrg;
          suggestions.push({id:`sg-step-${pl.id}`,kind:'STEP',score:pl.score,fromOrg:pl.fromOrg,toOrg:pl.toOrg,
            fromOrgName:pl.fromOrgName,toOrgName:pl.toOrgName,viaOrg:other,viaOrgName:orgById(other)?.name??other,
            reason:`گام اول: پیوند «${name(fromId)}» با «${orgById(other)?.name??other}» را برقرار کنید؛ این گام، فاصلهٔ شبکه تا «${name(toId)}» را کم می‌کند (امتیاز پتانسیل ${pl.score}).`});
        }
        if(!suggestions.length){
          suggestions.push({id:'sg-create',kind:'CREATE',score:40,fromOrg:fromId,toOrg:toId,fromOrgName:name(fromId),toOrgName:name(toId),
            reason:`بین «${name(fromId)}» و «${name(toId)}» هیچ رابطهٔ مستقیم یا واسطه‌ای ثبت نشده است؛ پیشنهاد: تشکیل جلسهٔ معرفی و ثبت رابطهٔ مستقیم.`});
        }
      }finally{ _pathSuggesting=false; }
    }
    if(!suggestions.length){
      suggestions.push({id:'sg-create',kind:'CREATE',score:40,fromOrg:fromId,toOrg:toId,fromOrgName:name(fromId),toOrgName:name(toId),
        reason:`پیوند مستقیم بین این دو سازمان ثبت نشده است؛ یک جلسهٔ معرفی با ثبت رابطه می‌تواند شبکه را کامل کند.`});
    }
    suggestions.sort((a,b)=>b.score-a.score);
    return {found:false,mode,nodes:[],edges:[],hops:0,totalCost:null,score:null,scoreLabel:null,
      bounded:true,maxHops,capped:false,reason:'no-path',suggestions:suggestions.slice(0,4)};
  }

  const chain=[]; let cur=toId;
  while(cur!==null){ chain.unshift(cur); cur=prev.get(cur); }
  const primary=pathView(chain);
  const capped=primary.hops>=maxHops;

  /* حاکمیت معرف (P1-6): ظرفیت هر شخص واسط — حداکثر ۱ درخواست فعال در ۳۰ روز */
  const pathOrgIds=new Set(chain);
  const loads=PEOPLE.filter(p=>!p.deletedAt&&pathOrgIds.has(p.organizationId)).map(p=>{
    const active=REFERRALS.filter(r=>r.sourcePersonId===p.id&&!['CANCELLED','DECLINED'].includes(r.status)&&new Date(r.createdAt??0).getTime()>Date.now()-30*86400000).length;
    return {personId:p.id,name:`${p.firstName} ${p.lastName}`,title:p.title,organizationId:p.organizationId,load:active,capacity:1,allowed:active<1};
  });
  const blockedCount=loads.filter(l=>!l.allowed).length;

  /* ---------- جایگزین‌ها و بهبودها (همان مسیر ریسک‌دار) ---------- */
  const alternatives=[];
  const primSig=chain.join('>');
  for(const cp of allSimplePaths(fromId,toId,maxHops)){
    const sig=cp.join('>');
    if(sig===primSig) continue;
    const v=pathView(cp);
    alternatives.push({id:`alt-${sig.replace(/[^a-zA-Z0-9]/g,'-')}`,found:true,mode,nodes:v.nodes,edges:v.edges,hops:v.hops,
      totalCost:v.totalCost,score:v.score,scoreLabel:v.scoreLabel,isRisky:v.isRisky,riskEdges:v.riskEdges,
      capped:false,bounded:true,maxHops,governance:{capacityPer30Days:1,loads,blockedCount,allowed:blockedCount===0}});
  }
  alternatives.sort((a,b)=>b.score-a.score);
  const improvements=[];
  primary.edges.forEach((e,idx)=>{
    if((e.risk??0)>=PATH_RISK_THRESHOLD||(e.heat??50)<55){
      const a=e.source.slice(4),b=e.target.slice(4);
      improvements.push({id:`imp-${e.id}-${idx}`,kind:'STRENGTHEN',relationshipId:String(e.id).replace(/^e-/,''),
        fromOrg:a,toOrg:b,fromOrgName:name(a),toOrgName:name(b),risk:e.risk??0,health:e.health??0,heat:e.heat??0,
        action:'برنامهٔ ۹۰ روزهٔ این رابطه را اجرا کنید و سلامت/اعتماد را بالا ببرید؛ در صورتی که ریسک بالای ۶۰ است ابتدا علت ریسک را ببندید.',
        impact:`با بهبود این پیوند، امتیاز مسیر از ${primary.score} به حدود ${Math.min(100,primary.score+12)} می‌رسد.`});
    }
  });
  if(primary.isRisky&&alternatives.length){
    const best=alternatives[0];
    improvements.push({id:'imp-backup',kind:'BACKUP',relationshipId:null,fromOrg:fromId,toOrg:toId,
      fromOrgName:name(fromId),toOrgName:name(toId),risk:0,health:0,heat:best.score,
      action:`یک مسیر جایگزین آماده کنید («${best.nodes.map(n=>n.label).join(' ← ')}») تا شبکهٔ ارتباطی به یک پیوند ریسک‌دار وابسته نماند.`,
      impact:`مسیر دوم با امتیاز ${best.score} و ${best.hops} پرش به‌عنوان پشتیبان در دسترس است.`});
  }
  if(primary.isRisky&&!alternatives.length){
    improvements.push({id:'imp-bridge',kind:'BRIDGE',relationshipId:null,fromOrg:fromId,toOrg:toId,
      fromOrgName:name(fromId),toOrgName:name(toId),risk:0,health:0,heat:0,
      action:'در دادهٔ فعلی مسیر جایگزینی با همین تعداد پرش وجود ندارد؛ پیشنهاد: ایجاد رابطهٔ مستقیم بین این دو سازمان یا گسترش شبکه با معرف‌های جدید تا یک مسیر دوم شکل بگیرد.',
      impact:'با داشتن مسیر دوم، ریسک تک‌نقطهٔ این ارتباط از بین می‌رود و انتخاب مسیر آزادتر می‌شود.'});
  }
  if(blockedCount>0){
    improvements.push({id:'imp-gov',kind:'GOVERNANCE',relationshipId:null,fromOrg:fromId,toOrg:toId,
      fromOrgName:name(fromId),toOrgName:name(toId),risk:0,health:0,heat:0,
      action:'ظرفیت معرف‌های واسط در ۳۰ روز تکمیل است؛ از شخص واسط دیگری استفاده کنید یا چند روز بعد دوباره تلاش کنید.',
      impact:'حاکمیت معرف مانع اجرای فعلی مسیر می‌شود؛ با انتخاب مسیر جایگزین می‌توانید از این صف عبور کنید.'});
  }
  return {
    found:true,mode,nodes:primary.nodes,edges:primary.edges,hops:primary.hops,
    totalCost:primary.totalCost,score:primary.score,scoreLabel:primary.scoreLabel,
    capped,bounded:true,maxHops,
    isRisky:primary.isRisky,
    alternatives:alternatives.slice(0,3),
    improvements:improvements.slice(0,4),
    governance:{capacityPer30Days:1,loads,blockedCount,allowed:blockedCount===0},
  };
}
/* ─────────────── P1: سرمایهٔ رابطه، روند، اعتماد، برنامهٔ ۹۰ روزه ─────────────── */
const ORG_COLUMN={TEAM:['org-1','org-2'],CUSTOMER:['org-3','org-4','org-5'],BOARD_ADVISORS:['org-7','org-8'],PARTNERS:['org-6']};
const COLUMN_LABELS={TEAM:'تیم ما',CUSTOMER:'مشتری',BOARD_ADVISORS:'هیئت و مشاوران',PARTNERS:'شرکا'};
const REL_CLASS_LABELS={STRATEGIC:'راهبردی',CORE:'هستهٔ درآمد',GROWTH:'رشد',RISK:'در معرض ریسک',ROUTINE:'روتین'};
const orgColumn=(oid)=>Object.entries(ORG_COLUMN).find(([,ids])=>ids.includes(oid))?.[0]??'PARTNERS';
function relClass(r){
  if((r.riskScore??0)>=60) return 'RISK';
  if((r.strategicScore??0)>=80&&(r.healthScore??0)>=70) return 'STRATEGIC';
  if((r.opportunityScore??0)>=70) return 'GROWTH';
  if((r.strategicScore??0)>=70||(r.healthScore??0)>=60) return 'CORE';
  return 'ROUTINE';
}
function relSnapshotScore(s){ return Math.round(0.35*(s.health??50)+0.25*(s.strategic??50)+0.2*(s.influence??50)+0.2*(s.opportunity??50)); }
function relScore(r){ return relSnapshotScore({health:r.healthScore,strategic:r.strategicScore,influence:r.influenceScore,opportunity:r.opportunityScore}); }
function relEvidenceSummary(r,days=90){
  const since=Date.now()-days*86400000;
  const ints=INTERACTIONS.filter(x=>!x.deletedAt&&x.relationshipId===r.id&&new Date(x.occurredAt??0).getTime()>=since);
  const mtgs=MEETINGS.filter(m=>!m.deletedAt&&m.relationshipId===r.id&&new Date(m.startAt??0).getTime()>=since);
  const coms=COMMITMENTS.filter(c=>!c.deletedAt&&c.relationshipId===r.id&&new Date(c.createdAt??0).getTime()>=since);
  const acts=ACTIONS.filter(a=>!a.deletedAt&&a.relationshipId===r.id&&new Date(a.dueAt??0).getTime()>=since);
  const assessed=Object.keys(assessmentStore()[`RELATIONSHIP:${r.id}`]??{}).length;
  const seen=new Set();
  if(ints.length) seen.add('INTERACTION');
  if(mtgs.length) seen.add('MEETING');
  if(coms.length) seen.add('COMMITMENT');
  if(acts.length) seen.add('ACTION');
  if(assessed>0) seen.add('ASSESSMENT');
  return {sources:seen.size,sourceTypes:[...seen],interactions:ints.length,meetings:mtgs.length};
}
function relConfidence(r){
  const ev=relEvidenceSummary(r);
  const days=Math.max(0,Math.round((Date.now()-new Date(r.lastInteractionAt??Date.now()).getTime())/86400000));
  const recency=days<=14?10:days<=30?6:days<=60?3:0;
  return Math.min(100,Math.round(28+ev.sources*12+recency));
}
function relTrend(r){
  const snaps=(DB.scoreSnapshots??[]).filter(s=>s.relationshipId===r.id).sort((a,b)=>b.daysAgo-a.daysAgo);
  const now=relScore(r);
  const base=snaps.find(s=>Math.abs(s.daysAgo-90)<15)??snaps[0];
  const delta=base?now-base.score:0;
  const trend=delta>=5?'UP':delta<=-5?'DOWN':'FLAT';
  return {current:now,delta90d:delta,trend,confidence:relConfidence(r),baseline:base?.score??null,evidence:relEvidenceSummary(r),snapshots:snaps.slice().reverse().map(s=>({asOf:s.asOf,daysAgo:s.daysAgo,score:s.score,confidence:s.confidence}))};
}
function relPotential(req,r){
  const open=scopedOpps(req).filter(o=>!o.deletedAt&&o.relationshipId===r.id&&!['WON','LOST'].includes(o.status));
  const vSum=open.reduce((s,o)=>s+(Number(o.value)||0),0);
  const allOpen=scopedOpps(req).filter(o=>!o.deletedAt&&!['WON','LOST'].includes(o.status));
  const maxV=Math.max(1,...allOpen.map(o=>Number(o.value)||0));
  const valueScore=vSum>0?Math.min(100,Math.round(100*(vSum/maxV))):0;
  return {potential:Math.round(0.55*(r.opportunityScore??50)+0.45*valueScore),openValue:vSum,openCount:open.length};
}
function relCapital(req,r){
  const strength=r.healthScore??50,influence=r.influenceScore??50;
  const {potential,openValue,openCount}=relPotential(req,r);
  const capital=Math.round((strength/100)*(influence/100)*(potential/100)*100);
  const valueAtRisk=Math.round(openValue*(1-(r.resilienceScore??50)/100));
  return {strength,influence,potential,capital,valueAtRisk,openValue,openCount};
}
function accountPlanOf(rid){ return (DB.accountPlans??{})[rid]??null; }
function planStatusFor(rid){
  const p=accountPlanOf(rid);
  if(!p) return {exists:false};
  const open=p.items.filter(i=>i.status!=='DONE');
  return {exists:true,id:p.id,status:p.status,reviewCycleDays:p.reviewCycleDays,openCount:open.length,overdue:open.filter(i=>i.dueAt&&new Date(i.dueAt).getTime()<Date.now()).length};
}
function capitalRow(req,r){
  const c=relCapital(req,r),t=relTrend(r),p=planStatusFor(r.id);
  const className=relClass(r);
  return {relationshipId:r.id,name:`${orgById(r.sourceOrganizationId)?.name??''} ↔ ${orgById(r.targetOrganizationId)?.name??''}`,type:r.relationshipType,status:r.status,classKey:className,classLabel:REL_CLASS_LABELS[className],...c,currentScore:t.current,delta90d:t.delta90d,trend:t.trend,confidence:t.confidence,plan:p};
}
/* کالیبراسیون مدل روی نتایج واقعی (P1-4): Win/Lost + گپ امتیاز + نیمه‌عمر */
function calibrationView(req){
  const closedAll=scopedOpps(req).filter(o=>!o.deletedAt&&['WON','LOST'].includes(o.status));
  const closed=closedAll.filter(o=>o.scoreAtClose!=null);
  const won=closed.filter(o=>o.status==='WON'),lost=closed.filter(o=>o.status==='LOST');
  const avg=(rows,f)=>rows.length?Math.round(rows.reduce((s,o)=>s+f(o),0)/rows.length):0;
  const s=DB.calibrationSettings??{};
  const avgWon=avg(won,o=>Number(o.scoreAtClose)||0),avgLost=avg(lost,o=>Number(o.scoreAtClose)||0);
  const scoreGap=avgWon-avgLost;
  return {generatedAt:nowIso(),windowMonths:s.windowMonths??12,targetGap:s.targetGap??20,scoreGap,meetsTarget:scoreGap>=(s.targetGap??20),
    won:{count:won.length,avgScore:avgWon,avgValue:avg(won,o=>Number(o.value)||0),totals:won.reduce((x,o)=>x+(Number(o.value)||0),0)},
    lost:{count:lost.length,avgScore:avgLost,avgValue:avg(lost,o=>Number(o.value)||0),totals:lost.reduce((x,o)=>x+(Number(o.value)||0),0),reasons:[...new Set(lost.map(o=>o.lossReason).filter(Boolean))]},
    matched:closed.length,closedAll:closedAll.length,coverageRate:closedAll.length?Math.round(closed.length/closedAll.length*100):0,
    halfLife:{defaultDays:s.halfLifeDefault??90,familyOverrides:s.familyOverrides??{}},
    history:s.history??[],
    rows:closed.map(o=>({id:o.id,name:o.name,status:o.status,relationshipId:o.relationshipId,relationship:relWithOrgs(RELS.find(r=>r.id===o.relationshipId)??o.relationshipId?{id:o.relationshipId}:null)?.name??null,scoreAtClose:Number(o.scoreAtClose)||0,value:Number(o.value)||0,closedAt:o.wonAt??o.lostAt,lossReason:o.lossReason??null,sourceType:o.sourceType??null})).sort((a,b)=>String(b.closedAt??'').localeCompare(String(a.closedAt??''))),
    note:'گپ امتیاز Win/Lost باید ≥ ٪۲۰ باشد؛ زیر آن یعنی امتیازها خروجی واقعی را پیش‌بینی نمی‌کنند.'};
}
/* رویداد شغلی و «چه کسی در سازمان جدید او را می‌شناسد» (P1-5) */
function careerWarmPaths(req,ev){
  const toOrg=ev.to?.organizationId; if(!toOrg) return [];
  const out=[];
  for(const tp of PEOPLE.filter(p=>!p.deletedAt&&p.organizationId===toOrg&&p.id!==ev.personId)){
    const rel=scopedRels(req).find(r=>r.sourceOrganizationId===toOrg||r.targetOrganizationId===toOrg);
    let via=null;
    if(rel){ const other=rel.sourceOrganizationId===toOrg?rel.targetOrganizationId:rel.sourceOrganizationId; via={kind:'RELATIONSHIP',label:`مسیر گرم: ${orgById(other)?.name??''} ↔ ${orgById(toOrg)?.name??''}`,relationshipId:rel.id}; }
    else { const m=MEETINGS.find(mm=>(mm.participants??[]).some(x=>x.personId===tp.id)); if(m) via={kind:'MEETING',label:`جلسهٔ مشترک: ${m.title}`,meetingId:m.id}; }
    if(via) out.push({personId:tp.id,name:`${tp.firstName} ${tp.lastName}`,title:tp.title,organizationId:toOrg,orgName:orgById(toOrg)?.name??'',via});
  }
  return out;
}
function careerEventsView(req){
  const evts=(DB.careerEvents??[]).map(e=>{
    const p=personById(e.personId);
    return {...e,person:p?{id:p.id,name:`${p.firstName} ${p.lastName}`,title:p.title,organizationId:p.organizationId,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null,champion:p.champion??null}:null};
  });
  const alerts=evts.filter(e=>e.alert).map(e=>({...e,warmPaths:careerWarmPaths(req,e)}));
  const champions=PEOPLE.filter(p=>!p.deletedAt&&p.champion?.flag&&inScope(req,p.organizationId)).map(p=>({id:p.id,name:`${p.firstName} ${p.lastName}`,title:p.title,organizationId:p.organizationId,organization:orgById(p.organizationId)?.name??'',power:p.champion.power,source:p.champion.source}));
  return {generatedAt:nowIso(),events:evts,alerts,summary:{championCount:champions.length,championMoves:alerts.length},champions};
}
/* گراف ۴ ستون (P1-6): تیم/مشتری/هیئت-مشاوران/شرکا */
function networkColumns(req){
  const rels=scopedRels(req);
  const relOrgIds=new Set(); rels.forEach(r=>{relOrgIds.add(r.sourceOrganizationId);relOrgIds.add(r.targetOrganizationId);});
  const orgNodes=ORGS.filter(o=>inScope(req,o.id)||relOrgIds.has(o.id)).map(o=>({id:`org:${o.id}`,label:o.name,type:'organization',organizationId:o.id,column:orgColumn(o.id)}));
  const personNodes=scopedPeople(req).map(p=>({id:`person:${p.id}`,label:`${p.firstName} ${p.lastName}`,type:'person',organizationId:p.organizationId,column:orgColumn(p.organizationId),champion:!!p.champion?.flag}));
  const nodes=[...orgNodes,...personNodes];
  const ids=new Set(nodes.map(n=>n.id));
  const edges=[];
  const edgeCategory=(kind,src,tgt)=>{
    if(kind==='membership') return orgColumn(tgt.slice(4));
    if(kind==='person_relationship') return orgColumn(PERSON_ORGS.find(m=>m.personId===src.slice(6)&&m.isPrimary)?.organizationId??orgColumn(tgt.slice(4)));
    if(kind==='relationship') return orgColumn(src.slice(4))==='TEAM'?orgColumn(tgt.slice(4)):orgColumn(src.slice(4));
    return 'PARTNERS';
  };
  const heat=(r)=>Math.round(0.6*(r.healthScore??50)+0.4*(100-(r.riskScore??0)));
  rels.forEach(r=>{
    const s=`org:${r.sourceOrganizationId}`,t=`org:${r.targetOrganizationId}`;
    if(!ids.has(s)||!ids.has(t)) return;
    edges.push({id:`e-${r.id}`,source:s,target:t,kind:'relationship',edgeCategory:edgeCategory('relationship',s,t),weight:Math.round(30+(r.healthScore??50)/2),risk:r.riskScore??0,strategicImportance:r.strategicScore??50,status:r.status,health:r.healthScore,heat:heat(r),label:r.relationshipType});
  });
  scopedPeople(req).forEach(p=>{
    const pid=`person:${p.id}`,oid=`org:${p.organizationId}`;
    if(!ids.has(pid)||!ids.has(oid)) return;
    edges.push({id:`pm-${p.id}`,source:pid,target:oid,kind:'membership',edgeCategory:edgeCategory('membership',pid,oid),weight:15,risk:0,strategicImportance:0});
  });
  const personEdges=new Set();
  MEETINGS.forEach(m=>{
    const parts=(m.participants??[]).map(x=>`person:${x.personId}`).filter(pid=>ids.has(pid));
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      const key=[parts[i],parts[j]].sort().join('|');
      if(personEdges.has(key))continue;
      personEdges.add(key);
      edges.push({id:`pp-${m.id}-${i}-${j}`,source:parts[i],target:parts[j],kind:'person_relationship',edgeCategory:edgeCategory('person_relationship',parts[i],parts[j]),weight:12,risk:0,strategicImportance:35});
    }
  });
  const columns=Object.keys(COLUMN_LABELS).map(key=>({
    key,label:COLUMN_LABELS[key],
    nodes:nodes.filter(n=>n.column===key),
    edges:edges.filter(e=>e.edgeCategory===key),
    count:nodes.filter(n=>n.column===key).length,
  }));
  return {generatedAt:nowIso(),columns,edgesTotal:edges.length,nodesTotal:nodes.length,labels:COLUMN_LABELS,meta:{organizationCount:orgNodes.length,peopleCount:personNodes.length,relationshipCount:rels.length}};
}

/* ============================== P2 — هوشمندی ============================== */
/* --------------------------------------------------------------------------
   P2-1 NBA: صف «قدم بعدی» — باید الان/امروز/این هفته + کانال + بازده + چرا
   خانوادهٔ اولویت‌ها: موعدگذشته → ریسک بدون پوشش → کیدنس → فرصت بزرگ → برنامه
   -------------------------------------------------------------------------- */
const PRIO_FA={LOW:'کم',MEDIUM:'متوسط',HIGH:'بالا',CRITICAL:'بحرانی'};
const NBA_URGENCY={NOW:'باید الان',TODAY:'امروز',WEEK:'این هفته'};
const NBA_CHANNEL={MEETING:'جلسه',PHONE:'تماس تلفنی',EMAIL:'ایمیل'};
const NBA_URGENCY_W={NOW:0,TODAY:1,WEEK:2};
function nbaView(req){
  const now=Date.now();
  const rels=scopedRels(req);
  const relOf=(id)=>rels.find(r=>r.id===id);
  const relName=(id)=>{const r=relOf(id);return r?`${orgById(r.sourceOrganizationId)?.name??'—'} ↔ ${orgById(r.targetOrganizationId)?.name??'—'}`:null;};
  const acts=scopedActions(req);
  const coms=scopedCommitments(req);
  const opps=scopedOpps(req).filter(o=>!o.deletedAt&&!['WON','LOST'].includes(o.status));
  const evOf=(o)=>o.expectedValue??Math.round(((o.value??0)*(o.probability??0))/100);
  const items=[]; const seen=new Set();
  const add=(x)=>{ if(!x.relationshipId||seen.has(x.key))return; seen.add(x.key);
    items.push({id:x.id,kind:x.kind,refId:x.refId,relationshipId:x.relationshipId,relationshipName:relName(x.relationshipId)??x.relationshipName,
      title:x.title,text:x.text,urgency:x.urgency,urgencyLabel:NBA_URGENCY[x.urgency],channel:x.channel,channelLabel:NBA_CHANNEL[x.channel],
      expectedValue:x.expectedValue??null,why:x.why.filter(Boolean),status:'PROPOSED',createdAt:nowIso()}); };
  /* ۱) اقدامات و تعهدات موعدگذشته یا مسدود */
  acts.filter(a=>['OPEN','IN_PROGRESS','BLOCKED'].includes(a.status)&&(isLateAt(a.dueAt,now)||a.status==='BLOCKED'))
    .sort((a,b)=>(a.dueAt??'9999').localeCompare(b.dueAt??'9999')).forEach(a=>{
      add({key:`a-${a.id}`,id:`nba-a-${a.id}`,kind:'ACTION',refId:a.id,relationshipId:a.relationshipId,relationshipName:relName(a.relationshipId),
        title:a.title,text:`اقدام «${a.title}» را همین امروز پیگیری کنید`,urgency:'NOW',channel:'PHONE',expectedValue:null,
        why:[`موعد ${a.dueAt?faDate(a.dueAt):'ثبت نشده'}${isLateAt(a.dueAt,now)?' گذشته است':''}`,a.status==='BLOCKED'?'اقدام مسدود است':`اولویت ${PRIO_FA[a.priority]??'متوسط'}`]});
    });
  coms.filter(c=>['OPEN','OVERDUE'].includes(c.status)&&isLateAt(c.dueAt,now)).forEach(c=>{
      add({key:`c-${c.id}`,id:`nba-c-${c.id}`,kind:'COMMITMENT',refId:c.id,relationshipId:c.relationshipId,relationshipName:relName(c.relationshipId),
        title:c.description.slice(0,80),text:`تعهد «${c.description.length>60?c.description.slice(0,60)+'…':c.description}» سررسید گذشته — پیگیری و راستی‌آزمایی کنید`,
        urgency:'NOW',channel:'PHONE',expectedValue:null,
        why:[`سررسید ${c.dueAt?faDate(c.dueAt):'—'}`,c.direction==='THEIRS'?'تعهد طرف مقابل است — راستی‌آزمایی کنید':`ریسک ${PRIO_FA[c.risk]??'متوسط'}`]});
    });
  /* ۲) روابط در خطر بدون پوشش اقدام/تعهد */
  rels.filter(r=>r.status==='WATCH'||(r.riskScore??0)>=60).forEach(r=>{
    const hasOpen=acts.some(a=>a.relationshipId===r.id&&['OPEN','IN_PROGRESS','BLOCKED'].includes(a.status))||coms.some(c=>c.relationshipId===r.id&&['OPEN','OVERDUE'].includes(c.status));
    if(hasOpen)return;
    const relOpps=opps.filter(o=>o.relationshipId===r.id);
    add({key:`r-${r.id}`,id:`nba-r-${r.id}`,kind:'RISK',refId:r.id,relationshipId:r.id,relationshipName:relName(r.id),
      title:`اقدام اصلاحی: ${relName(r.id)??r.id}`,text:'برنامهٔ کاهش ریسک را ثبت کنید — ریسک بالا بدون هرگونه اقدام باز است',
      urgency:'NOW',channel:'MEETING',expectedValue:relOpps.reduce((s,o)=>s+evOf(o),0),
      why:[`ریسک ${r.riskScore} · سلامت ${r.healthScore} · تاب‌آوری ${r.resilienceScore}`,r.status==='WATCH'?'رابطه در وضعیت «تحت نظر»':'فرصت‌های باز این رابطه در معرض ریسک‌اند']});
  });
  /* ۳) کیدنس عقب/شکسته */
  rels.forEach(r=>{ const cad=relCadence(r); if(cad.status==='FRESH')return;
    add({key:`cad-${r.id}`,id:`nba-cad-${r.id}`,kind:'CADENCE',refId:r.id,relationshipId:r.id,relationshipName:relName(r.id),
      title:`تعامل با ${relName(r.id)??r.id}`,text:`آخرین تعامل ${cad.daysSinceLastInteraction} روز پیش ثبت شده؛ هدف کیدنس ${cad.cadenceDays} روز است`,
      urgency:cad.status==='CRITICAL'?'TODAY':'WEEK',channel:'EMAIL',expectedValue:null,
      why:[`${cad.daysSinceLastInteraction} روز سکوت`,cad.status==='CRITICAL'?'کیدنس شکسته':'کیدنس عقب افتاده']});
  });
  /* ۴) فرصت‌های بزرگ — گام بعدی */
  opps.sort((a,b)=>evOf(b)-evOf(a)).slice(0,3).forEach(o=>{
    add({key:`o-${o.id}`,id:`nba-o-${o.id}`,kind:'OPPORTUNITY',refId:o.id,relationshipId:o.relationshipId??null,relationshipName:relName(o.relationshipId),
      title:`گام بعدی «${o.name}»`,text:'قدم بعدی فرصت را با صاحب‌رابطه برنامه‌ریزی و موعد بگذارید',
      urgency:'WEEK',channel:'MEETING',expectedValue:evOf(o),
      why:[`احتمال ${faN(o.probability??0)}٪ · ارزش موزون ${faN((evOf(o)/1e9).toFixed(1))} میلیارد تومان`,o.relationshipId?`رابطهٔ ${relName(o.relationshipId)}`:null]});
  });
  /* ۵) اقدامات معوق برنامهٔ ۹۰ روزه (P1-3) */
  Object.values(DB.accountPlans??{}).forEach((plan)=>{
    (plan?.items??[]).filter(i=>!['DONE','CANCELLED','COMPLETED'].includes(i.status)&&isLateAt(i.dueAt,now)).slice(0,1).forEach(i=>{
      add({key:`ap-${i.id}`,id:`nba-ap-${i.id}`,kind:'PLAN',refId:i.id,relationshipId:plan.relationshipId,relationshipName:relName(plan.relationshipId),
        title:`برنامهٔ ۹۰ روزه: ${i.title}`,text:`اقدام برنامهٔ حساب موعدش گذشته است — وضعیت را به‌روز کنید`,
        urgency:'TODAY',channel:'EMAIL',expectedValue:null,why:[`مهلت ${faDate(i.dueAt)}`,i.focus??'']});
    });
  });
  /* ۶) جابه‌جایی حامی (P1-5) — مسیر گرم */
  const careerView=careerEventsView(req);
  careerView.alerts.forEach(e=>{
    const wp=(e.warmPaths??[])[0];
    const r=wp?.relationshipId; if(!r)return;
    const p=personById(e.personId);
    add({key:`ce-${e.id}`,id:`nba-ce-${e.id}`,kind:'CAREER',refId:e.id,relationshipId:r,relationshipName:relName(r),
      title:`تمدید شناخت: ${p?`${p.firstName} ${p.lastName}`:e.personId}`,text:`حامی جابه‌جا/ارتقا یافت — از مسیر گرمِ ${relName(r)??''} تماس تبریک و تازه‌سازی شناخت بزنید`,
      urgency:'NOW',channel:'MEETING',expectedValue:null,why:[e.note??'',`مسیر گرم از ${relName(r)}`]});
  });
  items.sort((a,b)=>(NBA_URGENCY_W[a.urgency]-NBA_URGENCY_W[b.urgency])||((b.expectedValue??0)-(a.expectedValue??0)));
  const exes=(DB.nbaExecutions??[]).filter(x=>x.userId===(currentUser(req)?.id??'u-demo'));
  const executed=exes.filter(x=>x.status==='EXECUTED');
  const dismissed=exes.filter(x=>x.status==='DISMISSED');
  const active=items.length;
  const proposed=active+executed.length; // dismissals counted separately in kpis
  return {generatedAt:nowIso(),
    kpis:{active,executed:executed.length,dismissed:dismissed.length,acceptanceRate:proposed?Math.round(100*executed.length/proposed):null},
    items:items.slice(0,12).map(x=>({...x,executed:executed.some(e=>e.suggestionId===x.id)})),
    channels:NBA_CHANNEL,urgencyLabels:NBA_URGENCY};
}
/* اجرای/ردِ NBA: اجرا = ثبت اقدام باز روی رابطه */
function nbaAct(req,id,status){
  if(!['EXECUTED','DISMISSED'].includes(status)) return {code:400,msg:'وضعیت نامعتبر است.'};
  const uid=currentUser(req)?.id??'u-demo';
  DB.nbaExecutions=Array.isArray(DB.nbaExecutions)?DB.nbaExecutions:[];
  const prev=DB.nbaExecutions.find(x=>x.suggestionId===id&&x.status==='EXECUTED');
  if(prev) return {code:409,msg:'این پیشنهاد قبلاً اجرا شده است.'};
  DB.nbaExecutions.push({suggestionId:id,status,userId:uid,at:nowIso()});
  saveDb();
  if(status==='EXECUTED'){
    const item=nbaView(req).items.find(x=>x.id===id);
    if(item?.relationshipId){
      ACTIONS.unshift({id:`a-${Date.now()}`,title:item.title,status:'OPEN',priority:'HIGH',dueAt:new Date(Date.now()+3*86400000).toISOString(),ownerId:uid,relationshipId:item.relationshipId,createdAt:nowIso()});
      saveDb();
    }
  }
  return {code:200,ok:true};
}
/* --------------------------------------------------------------------------
   P2-2 SNA پیشرفته: تراکم، خوشه (label propagation)، PageRank، ایزوله،
   شکاف ارتباطی + «پیشنهاد معرفی» با پذیرش و شمارش شاخص
   -------------------------------------------------------------------------- */
function snaView(req){
  const g=netGraphVisible(req);
  const {nodes,edges}=g;
  const adj=netUndirected(nodes,edges);
  const n=nodes.length;
  const uniqEdges=new Set(); edges.forEach(e=>uniqEdges.add([e.source,e.target].sort().join('|')));
  /* تراکم روی گراف سازمانی (روابط واقعی) — شاخص اصلی */
  const orgNodes=nodes.filter(x=>x.type==='organization');
  const orgIds=new Set(orgNodes.map(x=>x.id));
  const orgEdges=new Set(); edges.forEach(e=>{if(orgIds.has(e.source)&&orgIds.has(e.target)&&e.kind==='relationship')orgEdges.add([e.source,e.target].sort().join('|'));});
  const orgPossible=Math.max(1,orgNodes.length*(orgNodes.length-1)/2);
  const densityOrg=Math.round(100*orgEdges.size/orgPossible);
  const densityFull=n>1?Math.round(100*uniqEdges.size/(n*(n-1)/2)):null;
  /* PageRank (گراف بدون جهت، تکرار توانی قطعی) */
  const pr=new Map(nodes.map(x=>[x.id,1/Math.max(1,n)]));
  const damp=0.85;
  for(let it=0;it<40;it++){
    const next=new Map(nodes.map(x=>[x.id,(1-damp)/Math.max(1,n)]));
    nodes.forEach(u=>{const outs=adj.get(u.id)??[];const s=pr.get(u.id)??0;
      if(!outs.length){nodes.forEach(v=>next.set(v.id,(next.get(v.id)??0)+damp*s/Math.max(1,n)));}
      else outs.forEach(v=>next.set(v,(next.get(v)??0)+damp*s/outs.length));});
    next.forEach((v,k)=>pr.set(k,v));
  }
  const maxPr=Math.max(1,...[...pr.values()]);
  const pageRank=nodes.map(x=>({node:{id:x.id,label:x.label,type:x.type},score:Math.round(10000*((pr.get(x.id)??0)/maxPr))/100}))
    .sort((a,b)=>b.score-a.score).slice(0,6);
  /* خوشه‌بندی: برچسب‌گذاری قطعی با ترتیب واژه‌ای */
  const label=new Map(nodes.map(x=>[x.id,x.id]));
  for(let it=0;it<12;it++){
    let changed=0;
    [...nodes.map(x=>x.id)].sort().forEach(u=>{
      const counts=new Map();
      (adj.get(u)??[]).forEach(v=>{const l=label.get(v)??v;counts.set(l,(counts.get(l)??0)+1);});
      const best=[...counts.entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))[0];
      const nextL=best?best[0]:u;
      if(nextL!==label.get(u)){label.set(u,nextL);changed++;}
    });
    if(!changed)break;
  }
  const clusters=new Map(); label.forEach((l,id)=>{if(!clusters.has(l))clusters.set(l,[]);clusters.get(l).push(id);});
  const clusterList=[...clusters.entries()].map(([root,ids])=>({
    id:`cl-${String(root).replace(/[^a-zA-Z0-9-]/g,'-')}`,root,size:ids.length,
    nodes:ids.map(id=>({id,label:(nodes.find(x=>x.id===id)?.label??id),type:(nodes.find(x=>x.id===id)?.type??'')}))
  })).sort((a,b)=>b.size-a.size).slice(0,6);
  /* ایزوله‌ها */
  const isolates=orgNodes.filter(x=>!(adj.get(x.id)??[]).some(v=>orgIds.has(v))).map(x=>({node:{id:x.id,label:x.label,type:'organization'}}));
  /* شکاف ارتباطی + پیشنهاد معرفی */
  const personOrg=new Map(); const orgPersons=new Map();
  nodes.forEach(x=>{if(x.type==='person'){const o=edges.find(e=>e.kind==='membership'&&(e.source===x.id||e.target===x.id));const oid=o?(o.source===x.id?o.target:o.source).slice(4):null;personOrg.set(x.id,oid);if(oid){if(!orgPersons.has(oid))orgPersons.set(oid,[]);orgPersons.get(oid).push(x.id);}}});
  const ppEdges=new Set(); edges.forEach(e=>{if(e.kind!=='person_relationship')return;ppEdges.add([e.source,e.target].sort().join('|'));});
  const accepted=new Set((DB.edgeSuggestionAccepts??[]).map(x=>x.suggestionId));
  const suggestions=[];
  const metaById=new Map(nodes.map(x=>[x.id,x]));
  const seenPairs=new Set();
  nodes.filter(x=>x.type==='person').forEach(p=>{
    const oa=personOrg.get(p.id); if(!oa)return;
    nodes.filter(x=>x.type==='person'&&x.id>p.id).forEach(q=>{
      const ob=personOrg.get(q.id); if(!ob||oa===ob)return;
      const pairKey=[oa,ob].sort().join('|');
      if(seenPairs.has(pairKey))return;
      if(orgEdges.has([`org:${oa}`,`org:${ob}`].sort().join('|')))return; // رابطهٔ مستقیم هست؛ سوراخ نیست
      if(ppEdges.has([p.id,q.id].sort().join('|')))return; // همدیگر را می‌شناسند
      // سوراخ واقعی: رابطهٔ مستقیم سازمانی نیست و این دو شخص هرگز ملاقات نکرده‌اند
      seenPairs.add(pairKey);
      const pName=metaById.get(p.id)?.label??p.id, qName=metaById.get(q.id)?.label??q.id;
      const aName=orgById(oa)?.name??oa, bName=orgById(ob)?.name??ob;
      const pInf=personById(p.id.slice(7))?.influenceScore??55, qInf=personById(q.id.slice(7))?.influenceScore??55;
      const score=Math.round((pInf+qInf)/2+10);
      const targetOrg=orgColumn(ob)==='TEAM'?oa:ob;
      const targetOpps=scopedOpps(req).filter(o=>o.organizationId===targetOrg&&!['WON','LOST'].includes(o.status));
      const ev=targetOpps.reduce((s,o)=>s+(o.expectedValue??Math.round((o.value??0)*(o.probability??0)/100)),0);
      const sid=`es-${oa}-${ob}-${p.id.slice(7)}-${q.id.slice(7)}`;
      if(accepted.has(sid))return;
      suggestions.push({id:sid,fromOrg:oa,toOrg:ob,fromOrgName:aName,toOrgName:bName,viaPersonId:p.id.slice(7),viaPerson:pName,toPersonId:q.id.slice(7),toPerson:qName,
        score,expectedValue:ev,
        reason:`شکاف ارتباطی بین «${aName}» و «${bName}»: ${pName} و ${qName} هنوز همدیگر را نمی‌شناسند ولی در خوشه‌های متفاوتی‌اند — یک معرفی می‌تواند پیوند سازمانی جدید بسازد.`});
    });
  });
  suggestions.sort((a,b)=>b.score-a.score||(b.expectedValue-a.expectedValue));
  return {generatedAt:nowIso(),
    kpis:{nodes:n,edges:uniqEdges.size,densityOrg,densityFull,componentCount:netComponents(nodes,adj).length,isolatedCount:isolates.length,
      clusterCount:clusterList.length,acceptedEdges:accepted.size,proposedEdges:suggestions.length},
    density:{org:densityOrg,full:densityFull},pageRank,clusters:clusterList,isolates,
    structuralHoles:suggestions.slice(0,5).map(s=>({...s,accepted:accepted.has(s.id)}))};
}
/* --------------------------------------------------------------------------
   P2-3 هوشمندی جلسه: خلاصهٔ قاعده‌مبنا + احساسات + برچسب انسانی
   (بدون وعدهٔ LLM کامل — خروجی قطعی از متن حقیقی جلسه)
   -------------------------------------------------------------------------- */
function meetingIntel(m){
  const src=[m.outcome,m.notes,m.transcript,(m.decisions??[]).join('\n'),m.agenda].filter(Boolean).join('\n');
  const sentences=src.split(/[\n.!؟]+/).map(s=>s.trim()).filter(s=>s.length>3);
  const POS=['موفق','عالی','پیشرفت','رضایت','توافق','امضا','تأیید','مثبت','جذب','مطمئن','پایدار','رشد','توسعه','به‌موقع'];
  const NEG=['نگران','ریسک','مشکل','تأخیر','تاخیر','لغو','مسدود','کمبود','نقدینگی','اعتراض','اختلاف','کاهش','نامطمئن','نقص','انحراف','عقب'];
  const hits=(words)=>words.filter(w=>src.includes(w));
  const posHits=hits(POS), negHits=hits(NEG);
  const tone=posHits.length>negHits.length&&posHits.length?'POSITIVE':negHits.length>posHits.length?'CONCERNED':negHits.length&&posHits.length===negHits.length?'CONCERNED':'NEUTRAL';
  const confidence=Math.min(95,20+10*(posHits.length+negHits.length));
  const decisions=(m.decisions??[]).map(String);
  const actionSents=sentences.filter(s=>/(باید|لازم است|نیاز است|می‌بایست|پیگیری|ارسال|تحویل|بررسی|هماهنگی|آماده کنیم|زمان‌بندی|استعلام|ثبت|امضا|تمدید|ارائه)/.test(s)).slice(0,5);
  const openActs=(m.actions??[]).filter(a=>!['DONE','COMPLETED','CANCELLED'].includes(a.status));
  const summary=[];
  if(m.objective) summary.push(`هدف: ${m.objective}`);
  summary.push(`${(m.participants??[]).length} شرکت‌کننده · ${new Date(m.startAt).toLocaleDateString('fa-IR')}`);
  if(decisions.length) summary.push(`${decisions.length} تصمیم ثبت شده است.`);
  summary.push(openActs.length?`${openActs.length} اقدام باز از این جلسه در جریان است.`:'اقدام بازِ مانده‌ای از این جلسه نیست.');
  if(negHits.length) summary.push(`${negHits.length} نشانهٔ نگرانی در متن شناسایی شد (${negHits.slice(0,3).join('، ')}).`);
  else if(posHits.length) summary.push(`نشانهٔ مثبت: ${posHits.slice(0,3).join('، ')}.`);
  return {generatedAt:nowIso(),meetingId:m.id,summary:summary.join('\n'),tone,toneLabel:tone==='POSITIVE'?'مثبت':tone==='CONCERNED'?'نگران‌کننده':'خنثی',
    confidence,signals:{positive:posHits.slice(0,4),negative:negHits.slice(0,4)},
    decisions,detectedActions:actionSents,openActions:openActs.map(a=>({id:a.id,title:a.title,status:a.status,dueAt:a.dueAt})),
    humanLabel:m.intelTone??null,ruleBased:true};
}
/* --------------------------------------------------------------------------
   P2-4 ریسک متمرکز و اهرم: درآمد در معرض ریسک، وابستگی تک‌رابطه/تک‌شخص، اقدام جایگزین
   -------------------------------------------------------------------------- */
function riskLeverageView(req){
  const now=Date.now();
  const rels=scopedRels(req);
  const open=scopedOpps(req).filter(o=>!o.deletedAt&&!['WON','LOST'].includes(o.status));
  const evOf=(o)=>o.expectedValue??Math.round((o.value??0)*(o.probability??0)/100);
  const totalEv=open.reduce((s,o)=>s+evOf(o),0);
  const byRel=new Map(); open.forEach(o=>{if(!o.relationshipId)return;const k=o.relationshipId;if(!byRel.has(k))byRel.set(k,[]);byRel.get(k).push(o);});
  const exposures=rels.map(r=>{
    const os=byRel.get(r.id)??[]; const ev=os.reduce((s,o)=>s+evOf(o),0);
    const riskW=Math.min(1,(r.riskScore??0)/100);
    return {relationshipId:r.id,relationshipName:`${orgById(r.sourceOrganizationId)?.name??'—'} ↔ ${orgById(r.targetOrganizationId)?.name??'—'}`,
      openCount:os.length,expectedValue:ev,share:totalEv?Math.round(100*ev/totalEv):0,riskScore:r.riskScore??0,healthScore:r.healthScore??0,
      revenueAtRisk:Math.round(ev*riskW),classKey:relClass(r),classLabel:REL_CLASS_LABELS[relClass(r)]};
  }).filter(x=>x.openCount>0).sort((a,b)=>b.revenueAtRisk-a.revenueAtRisk);
  const totalAtRisk=exposures.reduce((s,x)=>s+x.revenueAtRisk,0);
  const singleRel=exposures.filter(x=>x.share>=40);
  /* وابستگی تک‌شخص: حامی/پلِ روی روابطِ دارای درآمد در معرض ریسک */
  const riskyRelIds=new Set(exposures.filter(x=>x.revenueAtRisk>0).map(x=>x.relationshipId));
  const peopleByRel=new Map();
  rels.filter(r=>riskyRelIds.has(r.id)).forEach(r=>{
    const opps=byRel.get(r.id)??[];
    opps.forEach(o=>{if(o.ownerId){if(!peopleByRel.has(o.ownerId))peopleByRel.set(o.ownerId,[]);peopleByRel.get(o.ownerId).push(r.id);}});
  });
  const singlePeople=[...peopleByRel.entries()].map(([pid,relIds])=>{
    const p=personById(pid); if(!p)return null;
    const ev=relIds.reduce((s,rid)=>s+((exposures.find(x=>x.relationshipId===rid)?.revenueAtRisk)??0),0);
    return {personId:pid,name:`${p.firstName} ${p.lastName}`,title:p.title,organizationId:p.organizationId,organization:orgById(p.organizationId)?.name??'—',
      relationships:relIds,relationshipCount:relIds.length,revenueAtRisk:ev,champion:!!p.champion?.flag,power:p.champion?.power??null,influence:p.influenceScore??0};
  }).filter(Boolean).sort((a,b)=>b.revenueAtRisk-a.revenueAtRisk).slice(0,5);
  /* اقدام جایگزین برای بالاترین مواجهه‌ها */
  const alternatives=exposures.slice(0,3).map(x=>{
    const rel=rels.find(r=>r.id===x.relationshipId); if(!rel)return null;
    const ourOrg=rel.sourceOrganizationId,targetOrg=rel.targetOrganizationId;
    const path=netPathOrg(req,ourOrg,targetOrg,'best',{maxHops:3});
    const owners=byRel.get(x.relationshipId)??[];
    const keyOwner=owners[0]?.ownerId?personById(owners[0].ownerId):null;
    const backupOwners=owners.slice(1).map(o=>personById(o.ownerId)).filter(Boolean);
    return {relationshipId:x.relationshipId,relationshipName:x.relationshipName,revenueAtRisk:x.revenueAtRisk,riskScore:x.riskScore,
      originalKeyPerson:keyOwner?{id:keyOwner.id,name:`${keyOwner.firstName} ${keyOwner.lastName}`,title:keyOwner.title}:null,
      backupKeyPersons:backupOwners.map(p=>({id:p.id,name:`${p.firstName} ${p.lastName}`,title:p.title})),
      alternatePath:path.found?{hops:path.hops,score:path.score,nodes:path.nodes.map(n=>n.label??n.name??n.id)}:null,
      action:`${path.found?`مسیر جایگزین با ${path.hops} پرش (امتیاز ${path.score}) برای این سازمان وجود دارد.`:'مسیر جایگزین سازمانی در ۳ پرش یافت نشد.'}${keyOwner?` مالک فعلی: ${keyOwner.firstName} ${keyOwner.lastName}.`:''}`};
  }).filter(Boolean);
  return {generatedAt:nowIso(),
    kpis:{totalExpectedValue:totalEv,totalRevenueAtRisk:totalAtRisk,exposureCount:exposures.length,singleRelationshipCount:singleRel.length,singlePersonCount:singlePeople.length,alternativeCount:alternatives.length},
    exposures:exposures.slice(0,6),singleRelationships:singleRel,singlePeople,alternatives};
}
/* --------------------------------------------------------------------------
   P2-5 پالس ۹۰ روزه: ۲–۳ پرسش، پیوند به خانوادهٔ معیار، حلقهٔ بسته (پاسخ → اقدام → موعد بعدی)
   -------------------------------------------------------------------------- */
const PULSE_QUESTIONS=[
  {id:'pq-opportunity',text:'در ۳ ماه گذشته، این سازمان تقاضا/فرصت جدیدی برای ما مطرح کرده است؟',criteriaFamily:'OPPORTUNITY',anchor:'پیوند مستقیم به معیار «پتانسیل فرصت» — ۰=هیچ، ۵۰=متوسط، ۱۰۰=فرصت مشخص و جدی'},
  {id:'pq-collaboration',text:'کیفیت همکاری و پایبندی به قول‌ها در این ۳ ماه چطور بوده است؟',criteriaFamily:'RELIABILITY',anchor:'۰=شکایت/قول‌های عقب‌افتاده، ۵۰=طبیعی، ۱۰۰=بدون تأخیر و قابل اعتماد'},
  {id:'pq-access',text:'دسترسی ما به تصمیم‌گیرندهٔ کلیدی این سازمان چقدر است؟',criteriaFamily:'ACCESS',anchor:'۰=فقط واسطه، ۵۰=گاهی مستقیم، ۱۰۰=دسترسی مستقیم و منظم'},
];
function pulseSurveyView(req,r){
  const list=(DB.pulseSurveys??[]).filter(x=>x.relationshipId===r.id).sort((a,b)=>b.answeredAt.localeCompare(a.answeredAt));
  const last=list[0]??null;
  const now=Date.now();
  return {relationship:relWithOrgs(r),questions:PULSE_QUESTIONS,last,
    nextDueAt:last?.nextDueAt??null,
    canSubmit:!last||new Date(last.nextDueAt).getTime()<=now,
    history:list.slice(0,6),cycleDays:90};
}
function pulseSurveySubmit(req,r,answers){
  const byId=new Map((answers??[]).map(a=>[a.questionId,Number(a.score)]));
  const rows=PULSE_QUESTIONS.map(q=>({questionId:q.id,criteriaFamily:q.criteriaFamily,score:byId.has(q.id)?Math.max(0,Math.min(100,Math.round(byId.get(q.id)))):null}));
  if(rows.some(x=>x.score==null)) return {code:400,msg:'هر سه پرسش باید پاسخ داده شوند.'};
  const avg=Math.round(rows.reduce((s,x)=>s+x.score,0)/rows.length);
  const row={id:`ps-${Date.now()}`,relationshipId:r.id,user:currentUser(req)?.id??'u-demo',answers:rows,avgScore:avg,interpretation:avg>=70?'پالس مثبت — رابطه در مسیر رشد است':avg>=45?'پالس متوسط — چند اقدام مشخص کافی است':'پالس ضعیف — مداخلهٔ ساختاری لازم است',answeredAt:nowIso(),nextDueAt:new Date(Date.now()+90*86400000).toISOString()};
  DB.pulseSurveys=Array.isArray(DB.pulseSurveys)?DB.pulseSurveys:[];
  DB.pulseSurveys.unshift(row); saveDb();
  /* حلقهٔ بسته: اقدام بازبینی + اعلان */
  ACTIONS.unshift({id:`a-${Date.now()}`,title:`بازبینی نتیجهٔ پالس ۹۰ روزهٔ ${orgById(r.targetOrganizationId)?.name??''}`,status:'OPEN',priority:avg<45?'CRITICAL':'MEDIUM',dueAt:row.nextDueAt,ownerId:row.user,relationshipId:r.id,createdAt:nowIso()});
  NOTIFICATIONS.unshift({id:`n-${Date.now()}`,userId:row.user,title:'پالس ۹۰ روزه ثبت شد',body:`${avg} از ۱۰۰ — ${row.interpretation}`,type:'INFO',priority:avg<45?'HIGH':'MEDIUM',isRead:false,createdAt:nowIso()});
  saveDb();
  return {code:200,ok:true,row};
}

/* ============================== P3 — افق ============================== */
/* --------------------------------------------------------------------------
   P3-1 پایش انطباق: غربالگری دوره‌ای + UBO + رویداد-محور + پروندهٔ تصمیم
   -------------------------------------------------------------------------- */
function seedComplianceStore(){
  const ago=(d)=>{const t=new Date(Date.now()-d*86400000);return t.toISOString();};
  const ahead=(d)=>{const t=new Date(Date.now()+d*86400000);return t.toISOString();};
  const ubos=[
    {id:'ubo-1',organizationId:'org-1',name:'رضا آریاپور',role:'مدیرعامل',ownershipPercent:61,nationality:'ایران',pep:false,riskTier:'LOW',verifiedAt:ago(30),source:'سامانهٔ ثبت شرکتها',note:null},
    {id:'ubo-2',organizationId:'org-2',name:'آریا آریاپور',role:'رییس هیئتمدیره',ownershipPercent:45,nationality:'ایران',pep:false,riskTier:'LOW',verifiedAt:ago(28),source:'سامانهٔ ثبت شرکتها',note:null},
    {id:'ubo-3',organizationId:'org-3',name:'بهرام تاج‌بخش',role:'رییس هیئتمدیره',ownershipPercent:38,nationality:'ایران',pep:false,riskTier:'LOW',verifiedAt:ago(26),source:'صورت‌های مالی ۱۴۰۳',note:null},
    {id:'ubo-4',organizationId:'org-4',name:'مجید زند',role:'بنیان‌گذار',ownershipPercent:55,nationality:'ایران',pep:false,riskTier:'MEDIUM',verifiedAt:ago(24),source:'صورت‌های مالی',note:'سهام از طریق هلدینگ خانوادگی نگهداری می‌شود.'},
    {id:'ubo-5',organizationId:'org-5',name:'فرزین رستگار',role:'بنیان‌گذار',ownershipPercent:49,nationality:'ایران',pep:false,riskTier:'LOW',verifiedAt:ago(22),source:'سامانهٔ ثبت شرکتها',note:null},
    {id:'ubo-6',organizationId:'org-6',name:'شهاب برومند',role:'مالک اصلی',ownershipPercent:52,nationality:'امارات',pep:true,riskTier:'HIGH',verifiedAt:ago(96),source:'ثبت خارجی + اظهارنامه',note:'UBO دارای سابقهٔ PEP و منابع تأمین از حوزهٔ خارجی؛ راستی‌آزمایی سالانه الزامی است.'},
    {id:'ubo-7',organizationId:'org-7',name:'لیلا صدر',role:'مدیرعامل',ownershipPercent:34,nationality:'ایران',pep:false,riskTier:'LOW',verifiedAt:ago(18),source:'اساسنامه',note:null},
    {id:'ubo-8',organizationId:'org-8',name:'محمود پرویز',role:'نمایندهٔ تام‌الاختیار',ownershipPercent:100,nationality:'ایران',pep:true,riskTier:'MEDIUM',verifiedAt:ago(104),source:'معرفی‌نامهٔ رسمی',note:'سازمان دولتی؛ نمایندهٔ تام‌الاختیار در فهرست PEP. غربالگری هر ۶۰ روز توصیه می‌شود.'},
  ];
  const schedules=ORGS.map(o=>({
    organizationId:o.id,cycleDays:o.id==='org-6'||o.id==='org-8'?60:90,
    lastScreenAt:o.id==='org-8'?ago(104):o.id==='org-6'?ago(96):ago(35),
    nextScreenAt:o.id==='org-8'?ago(4):o.id==='org-6'?ahead(4):ahead(25),
    status:'SCHEDULED',
  }));
  const findings=[
    {id:'cf-1',severity:'HIGH',type:'UBO_PEP',subject:'org-6',title:'مالک نهاییِ دارای پرچم منصب با منابع خارجی',detail:'مالک اصلی البرز (۵۲٪) در فهرست افرادِ دارای منصب است و تأمین سرمایه از حوزهٔ خارجی دارد؛ راستی‌آزمایی سالانه منقضی شده است.',trigger:'periodic',createdAt:ago(8),status:'OPEN',assignedTo:'u-1',evidence:['ubo-6']},
    {id:'cf-2',severity:'MEDIUM',type:'CAREER_EVENT',subject:'org-5',title:'خروج مدیر پروژه از سدنا',detail:'رویداد شغلی ۲ (خروج علی نادری) — دسترسی به سفارش‌دهندهٔ اقتصادی باید از نو پوشش داده شود.',trigger:'event',createdAt:ago(9),status:'OPEN',assignedTo:'u-1',evidence:['ce-2']},
    {id:'cf-3',severity:'HIGH',type:'SANCTION_LIST',subject:'org-8',title:'غربالگری دوره‌ای منقضی شده است',detail:'آخرین غربالگری استانداری تهران ۱۰۴ روز پیش بوده؛ مهلت ۶۰ روزه گذشته و نماینده دارای منصب سیاسی است.',trigger:'periodic',createdAt:ago(6),status:'OPEN',assignedTo:'u-1',evidence:['ubo-8']},
    {id:'cf-4',severity:'MEDIUM',type:'NEW_OPPORTUNITY',subject:'org-4',title:'فرصت جدید روی رابطهٔ با پترو صنعت',detail:'ثبت فرصت ۶ (توسعهٔ سرویس ابری) — بررسی انطباق مشتری جدید پیش از ورود به هیئت.',trigger:'event',createdAt:ago(3),status:'OPEN',assignedTo:'u-1',evidence:['o-6']},
  ];
  const dossiers=[
    {id:'cd-1',subject:'org-3',type:'SCREENING',decision:'CLEARED',decidedBy:'امیر صادقی',decidedAt:ago(26),rationale:'مالک نهایی تأییدشده؛ هیچ پرچمی در فهرست‌ها نیست.',evidence:['ubo-3']},
    {id:'cd-2',subject:'org-4',type:'SCREENING',decision:'CLEARED',decidedBy:'امیر صادقی',decidedAt:ago(24),rationale:'ساختار سهام شفاف؛ پس از ارائهٔ صورت‌های مالی تأیید شد.',evidence:['ubo-4']},
    {id:'cd-3',subject:'org-6',type:'UBO_CHANGE',decision:'ESCALATED',decidedBy:'امیر صادقی',decidedAt:ago(7),rationale:'پرچم منصب + منبع خارجی؛ نیازمند تأیید کمیتهٔ انطباق پیش از تمدید قرارداد.',evidence:['ubo-6','cf-1']},
  ];
  return {ubos,schedules,findings,dossiers,lastRun:ago(8)};
}
function complianceView(req){
  const st=DB.compliance??seedComplianceStore();
  const orgIds=new Set(ORGS.filter(o=>inScope(req,o.id)).map(o=>o.id));
  const relOrgIds=new Set(); scopedRels(req).forEach(r=>{relOrgIds.add(r.sourceOrganizationId);relOrgIds.add(r.targetOrganizationId);});
  const visible=o=>orgIds.has(o.id)||relOrgIds.has(o.id);
  const ubos=(st.ubos??[]).filter(u=>visible(ORGS.find(o=>o.id===u.organizationId))).map(u=>({...u,organization:orgById(u.organizationId)?{id:u.organizationId,name:orgById(u.organizationId).name}:null}));
  const schedules=(st.schedules??[]).filter(s=>visible(ORGS.find(o=>o.id===s.organizationId))).map(s=>({...s,organization:orgById(s.organizationId)?{id:s.organizationId,name:orgById(s.organizationId).name}:null,overdue:new Date(s.nextScreenAt).getTime()<Date.now()}));
  const findings=(st.findings??[]).filter(f=>visible(ORGS.find(o=>o.id===f.subject))).sort((a,b)=>({HIGH:3,MEDIUM:2,LOW:1}[a.severity]??0)<({HIGH:3,MEDIUM:2,LOW:1}[b.severity]??0)?1:-1);
  const flagged=ubos.filter(u=>u.pep||u.riskTier==='HIGH'||(u.nationality??'ایران')!=='ایران');
  const scopedOrgCount=ORGS.filter(visible).length;
  return {generatedAt:nowIso(),lastRun:st.lastRun??null,
    kpis:{organizations:scopedOrgCount,uboCoverage:scopedOrgCount?Math.round(100*ubos.length/scopedOrgCount):0,flaggedUbo:flagged.length,openFindings:findings.filter(f=>f.status==='OPEN').length,dossiers:(st.dossiers??[]).filter(d=>visible(ORGS.find(o=>o.id===d.subject))).length,overdueScreens:schedules.filter(s=>s.overdue).length},
    ubos,schedules,findings,dossiers:(st.dossiers??[]).filter(d=>visible(ORGS.find(o=>o.id===d.subject))).sort((a,b)=>b.decidedAt.localeCompare(a.decidedAt)),
    flaggedUbo:flagged};
}
function complianceScreen(req){
  DB.compliance=DB.compliance??seedComplianceStore();
  const st=DB.compliance, now=nowIso();
  st.lastRun=now;
  (st.schedules??[]).forEach(s=>{s.lastScreenAt=now;s.nextScreenAt=new Date(Date.now()+(s.cycleDays??90)*86400000).toISOString();s.status='COMPLETED';});
  const existing=new Set((st.findings??[]).filter(f=>f.status==='OPEN').map(f=>`${f.type}|${f.subject}`));
  const ups=(st.ubos??[]).filter(u=>u.pep||u.riskTier==='HIGH'||(u.nationality??'ایران')!=='ایران');
  const created=[];
  ups.forEach(u=>{
    const key=`UBO_PEP|${u.organizationId}`;
    if(existing.has(key))return;
    existing.add(key);
    const r=RELS.find(x=>x.targetOrganizationId===u.organizationId||x.sourceOrganizationId===u.organizationId);
    created.push({id:`cf-${Date.now()}-${u.organizationId}`,severity:'HIGH',type:'UBO_PEP',subject:u.organizationId,title:`غربالگری: ${orgById(u.organizationId)?.name??u.organizationId} — مالک نهاییِ دارای پرچم`,detail:`پس از غربالگری دوره‌ای، ${u.name} (${u.ownershipPercent}٪) همچنان دارای پرچم منصب/خارجی است.${r?' رابطهٔ '+relLabel(r)+' در معرض بازنگری است.':''}`,trigger:'periodic',createdAt:now,status:'OPEN',assignedTo:'u-1',evidence:[u.id]});
  });
  if(created.length) st.findings=(st.findings??[]).concat(created);
  saveDb();
  audit(req,'COMPLIANCE_SCREEN','system','compliance','OK',{findings:created.length});
  return {ok:true,createdFindings:created.length,view:complianceView(req)};
}
function complianceDecide(req,orgId,decision,rationale){
  const st=DB.compliance??seedComplianceStore();
  const org=orgById(orgId); if(!org) return {code:404,msg:'سازمان یافت نشد'};
  if(!inScope(req,orgId)) return {code:403,msg:'دسترسی به این سازمان مجاز نیست.'};
  if(!['CLEARED','ESCALATED','REJECTED'].includes(decision)) return {code:400,msg:'تصمیم باید CLEARED، ESCALATED یا REJECTED باشد.'};
  const who=currentUser(req)?.name??'کاربر';
  const row={id:`cd-${Date.now()}`,subject:orgId,type:'SCREENING',decision,decidedBy:who,decidedAt:nowIso(),rationale:String(rationale??'').trim()||null,evidence:[]};
  st.dossiers=(st.dossiers??[]).concat(row);
  (st.findings??[]).filter(f=>f.subject===orgId&&f.status==='OPEN').forEach(f=>{f.status='CLOSED';f.decidedBy=who;f.decidedAt=row.decidedAt;f.decision=decision;f.rationale=row.rationale;});
  saveDb();
  audit(req,'COMPLIANCE_DECIDE','organization',orgId,'OK',{decision});
  NOTIFICATIONS.unshift({id:`n-${Date.now()}`,userId:currentUser(req)?.id??'u-1',title:'پروندهٔ انطباق به‌روزرسانی شد',body:`${org.name}: ${decision}${row.rationale?` — ${row.rationale}`:''}`,type:'INFO',priority:decision==='ESCALATED'?'HIGH':'MEDIUM',isRead:false,createdAt:nowIso()});
  return {code:200,ok:true,decision,view:complianceView(req)};
}
/* --------------------------------------------------------------------------
   P3-2 حافظهٔ نهادی و انتقال دانش: «چه کسی چه کسی را می‌شناسد» + بستهٔ انتقال
   + بریف جانشین (دسترسی: مالک کامل، غیرمالک فقط محدودهٔ خود)
   -------------------------------------------------------------------------- */
function transferView(req,relationshipId){
  const r=RELS.find(x=>x.id===relationshipId);
  if(!r) return {code:404,msg:'رابطه یافت نشد'};
  if(!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return {code:403,msg:'دسترسی مجاز نیست.'};
  const now=Date.now();
  const rel=relWithOrgs(r);
  const cap=relCapital(req,r),trend=relTrend(r),plan=accountPlanOf(r.id);
  const className=relClass(r);
  const src=orgById(r.sourceOrganizationId),tgt=orgById(r.targetOrganizationId);
  /* مخاطبین: طرف قرارداد + کمیته + حامیان + ما */
  const relatedMeetings=scopedMeetings(req).filter(m=>m.relationshipId===r.id);
  const meetingParts=new Set(relatedMeetings.flatMap(m=>(m.participants??[]).map(p=>p.personId)));
  const targetPeople=PEOPLE.filter(p=>p.organizationId===r.targetOrganizationId);
  const ourPeople=PEOPLE.filter(p=>p.organizationId===r.sourceOrganizationId);
  const committee=(DB.committees??COMMITTEE).filter(c=>{const o=scopedOpps(req).find(x=>x.id===c.opportunityId);return o&&o.relationshipId===r.id;});
  const contacts=[...new Set([...targetPeople.map(p=>p.id),...meetingParts,...committee.map(c=>c.personId)])]
    .map(pid=>personById(pid)).filter(Boolean)
    .map(p=>({id:p.id,name:`${p.firstName} ${p.lastName}`,title:p.title,organizationId:p.organizationId,organization:orgById(p.organizationId)?.name??'—',
      influence:p.influenceScore??0,champion:!!p.champion?.flag,role:committee.find(c=>c.personId===p.id)?.role??null,
      metWith:relatedMeetings.filter(m=>(m.participants??[]).some(x=>x.personId===p.id)).map(m=>m.title)}));
  /* چه کسی چه کسی را می‌شناسد (فقط مالک/هم‌محدوده) — از جلسات مشترک و معرفی‌ها */
  const owner=!!currentUser(req)?.isOwner;
  const allMeetings=scopedMeetings(req);
  const whoKnowsWho=owner?contacts.map(c=>{
    const viaMeetings=ourPeople.filter(p=>allMeetings.some(m=>(m.participants??[]).some(x=>x.personId===p.id)&&(m.participants??[]).some(x=>x.personId===c.id)))
      .map(p=>`${p.firstName} ${p.lastName}`);
    const viaReferrals=(REFERRALS??[]).filter(x=>x.targetPersonId===c.id&&x.status!=='CANCELLED').map(x=>{const p=personById(x.sourcePersonId);return p?`${p.firstName} ${p.lastName}`:null;}).filter(Boolean);
    return {person:c,org:orgById(c.organizationId)?.name,ourContacts:[...new Set([...viaMeetings,...viaReferrals])],
      viaMeetings,viaReferrals,meetingCount:allMeetings.filter(m=>(m.participants??[]).some(x=>x.personId===c.id)).length};
  }).filter(x=>x.ourContacts.length):[]; /* غیرمالک: بدون لیست شناخت — حاکمیت معرف */
  const openActs=scopedActions(req).filter(a=>a.relationshipId===r.id&&!['DONE','COMPLETED','CANCELLED'].includes(a.status));
  const openComs=scopedCommitments(req).filter(c=>c.relationshipId===r.id&&['OPEN','OVERDUE'].includes(c.status));
  const riskSignals=riskDrivers(req,r).map((d,i)=>({id:`sig-${r.id}-${i}`,title:d.label,severity:d.tone==='critical'?'HIGH':d.tone==='warning'?'MEDIUM':'LOW',relationshipId:r.id,description:d.detail,evidence:[{type:d.tone,title:d.detail}]}));
  const interactions=INTERACTIONS.filter(i=>i.relationshipId===r.id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,6)
    .map(i=>({id:i.id,subject:i.subject,occurredAt:i.occurredAt,result:i.result,channel:i.channel,person:personById(i.personId)?`${personById(i.personId).firstName} ${personById(i.personId).lastName}`:null}));
  const transferred=(DB.knowledgeTransfers??[]).find(x=>x.relationshipId===r.id);
  const brief=[
    `بریف جانشین — ${relLabel(r)}`,
    `طبقه: ${REL_CLASS_LABELS[className]} · سرمایه ${cap.capital} · روند ${trend.trend} (${trend.delta90d}) · اعتماد ${trend.confidence}٪`,
    plan?`برنامهٔ ۹۰ روزه: ${plan.status} با ${plan.items.filter(i=>!['DONE','CANCELLED'].includes(i.status)).length} اقدام باز${plan.riskNote?` — ریسک‌نامه: ${plan.riskNote}`:''}`:'برنامهٔ ۹۰ روزه ثبت نشده است.',
    `مخاطبین کلیدی: ${contacts.slice(0,5).map(c=>`${c.name}${c.champion?' (حامی)':''}`).join('، ')||'—'}`,
    openActs.length?`اقدامات باز: ${openActs.map(a=>a.title).slice(0,3).join('؛ ')}`:'اقدام باز وجود ندارد.',
    openComs.length?`تعهدات باز: ${openComs.map(c=>c.description.slice(0,60)).slice(0,3).join('؛ ')}`:'تعهد باز وجود ندارد.',
    riskSignals.length?`ریسک‌های فعال: ${riskSignals.slice(0,3).map(s=>s.title).join('؛ ')}`:'سیگنال ریسک فعالی نیست.',
    interactions.length?`آخرین تعامل: ${interactions[0].subject} (${faDate(interactions[0].occurredAt)})`:'تعاملی ثبت نشده.',
    transferred?`انتقال دانش: در ${faDate(transferred.handedOverAt)} توسط ${transferred.fromName??''} به ${transferred.toName??''} تحویل شد.`:'انتقال دانش هنوز انجام نشده است.',
  ].join('\n');
  return {code:200,relationship:rel,classKey:className,classLabel:REL_CLASS_LABELS[className],
    capital:cap,trend,plan:plan?{...plan,items:plan.items.map(i=>({...i,owner:personById(i.ownerId)?{id:i.ownerId,name:`${personById(i.ownerId).firstName} ${personById(i.ownerId).lastName}`}:null}))}:null,
    contacts,whoKnowsWho,openActions:openActs,openCommitments:openComs,riskSignals,interactions,
    brief,transferred:transferred??null,access:owner?'full':'scoped'};
}
function transferHandoff(req,relationshipId){
  const r=RELS.find(x=>x.id===relationshipId);
  if(!r) return {code:404,msg:'رابطه یافت نشد'};
  if(!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return {code:403,msg:'دسترسی مجاز نیست.'};
  DB.knowledgeTransfers=Array.isArray(DB.knowledgeTransfers)?DB.knowledgeTransfers:[];
  if(DB.knowledgeTransfers.some(x=>x.relationshipId===relationshipId)) return {code:409,msg:'برای این رابطه قبلاً انتقال دانش ثبت شده است.'};
  const from=currentUser(req);
  const to=PEOPLE.find(p=>p.organizationId===r.sourceOrganizationId&&p.id!==from?.id)??PEOPLE.find(p=>p.organizationId===r.sourceOrganizationId);
  const row={id:`kt-${Date.now()}`,relationshipId,fromUserId:from?.id??null,fromName:from?.name??'—',toUserId:to?.id??null,toName:to?`${to.firstName} ${to.lastName}`:'—',handedOverAt:nowIso(),note:null};
  DB.knowledgeTransfers.push(row); saveDb();
  audit(req,'KNOWLEDGE_TRANSFER','relationship',relationshipId,'OK',{to:row.toName});
  NOTIFICATIONS.unshift({id:`n-${Date.now()}`,userId:row.toUserId??'u-1',title:'بستهٔ انتقال دانش آماده است',body:`بریف جانشین برای ${relLabel(r)} ساخته شد — پیش از جلسهٔ تحویل بخوانید.`,type:'INFO',priority:'MEDIUM',isRead:false,createdAt:nowIso()});
  return {code:200,ok:true,transfer:row};
}
/* --------------------------------------------------------------------------
   P3-3 GNN سبک: پیش‌بینی پیوند، خوشهٔ گراف و مسیر گرم (بدون مدل خارجی)
   -------------------------------------------------------------------------- */
function predictView(req){
  const cols=networkColumns(req);
  const orgNodes=cols.columns.flatMap(c=>c.nodes.filter(n=>n.type==='organization'));
  const orgIds=new Set(orgNodes.map(n=>n.id.replace('org:','')));
  const graph=netGraphVisible(req);
  const adj=netUndirected(graph.nodes,graph.edges);
  const relEdge=new Set(); graph.edges.filter(e=>e.kind==='relationship').forEach(e=>relEdge.add([e.source,e.target].sort().join('|')));
  /* اشتراک ملاقات: شخص a از X و b از Y در یک جلسه */
  const shared=(a,b)=>{
    let s=0;
    scopedMeetings(req).forEach(m=>{
      const parts=(m.participants??[]).map(p=>p.personId);
      const hasA=parts.some(pid=>personById(pid)?.organizationId===a);
      const hasB=parts.some(pid=>personById(pid)?.organizationId===b);
      if(hasA&&hasB)s++;
    });
    return s;
  };
  const list=[];
  const orgArr=[...orgIds].sort();
  for(let i=0;i<orgArr.length;i++)for(let j=i+1;j<orgArr.length;j++){
    const a=orgArr[i],b=orgArr[j];
    if(relEdge.has([`org:${a}`,`org:${b}`].sort().join('|')))continue; // رابطهٔ مستقیم هست
    const meetings=shared(a,b);
    const colA=orgColumn(a),colB=orgColumn(b);
    const pA=PEOPLE.filter(p=>p.organizationId===a&&p.champion?.flag).length;
    const pB=PEOPLE.filter(p=>p.organizationId===b&&p.champion?.flag).length;
    const score=Math.min(96,Math.round(22+meetings*12+(colA===colB?4:10)+Math.min(12,(pA+pB)*3)));
    list.push({id:`lp-${a}-${b}`,fromOrg:a,toOrg:b,fromOrgName:orgById(a)?.name??a,toOrgName:orgById(b)?.name??b,
      score,sharedMeetings:meetings,columnA:colA,columnB:colB,
      reason:[meetings?`${meetings} جلسهٔ مشترک بین افراد دو سازمان`:'هنوز ملاقات مشترکی ثبت نشده',colA!==colB?`پل بین ستون‌های «${COLUMN_LABELS[colA]}» و «${COLUMN_LABELS[colB]}»`:'هم‌ستون',(pA+pB)?'حامی حاضر در یکی از طرفین':''].filter(Boolean)});
  }
  list.sort((a,b)=>b.score-a.score);
  /* مسیر گرم برای فرصت‌های باز */
  const warm=[];
  const openOrgs=[...new Set(scopedOpps(req).filter(o=>!['WON','LOST'].includes(o.status)).map(o=>o.organizationId))];
  const our= orgColumn('org-1')==='TEAM'?'org-1':(ORG_COLUMN.TEAM.includes('org-2')?'org-2':'org-1');
  openOrgs.forEach(oid=>{
    if(oid===our)return;
    const path=netPathOrg(req,our,oid,'best',{maxHops:3});
    const opps=scopedOpps(req).filter(o=>o.organizationId===oid&&!['WON','LOST'].includes(o.status));
    warm.push({organizationId:oid,organizationName:orgById(oid)?.name??oid,opportunities:opps.slice(0,3).map(o=>({id:o.id,name:o.name,probability:o.probability,value:o.value})),
      found:path.found,hops:path.hops??null,score:path.score??null,path:path.found?path.nodes.map(n=>n.label??n.name??n.id):[]});
  });
  warm.sort((a,b)=>(b.found?1:0)-(a.found?1:0)||(b.score??0)-(a.score??0));
  const clusters=snaView(req).clusters;
  return {generatedAt:nowIso(),method:'deterministic-rule-graph',
    kpis:{predictedLinks:list.length,topScore:list[0]?.score??0,clusters:clusters.length,warmPaths:warm.filter(w=>w.found).length,openOpportunityOrgs:openOrgs.length},
    predictedLinks:list.slice(0,6),clusters,warmPaths:warm.slice(0,6)};
}
/* --------------------------------------------------------------------------
   P3-4 هیئت‌مدیره: ROI رابطه، سرمایهٔ پرتفوی، سلامت و ریسک تک‌نقطه
   -------------------------------------------------------------------------- */
function boardView(req){
  const rows=scopedRels(req).map(r=>{
    const cap=relCapital(req,r),trend=relTrend(r);
    const won=OPPORTUNITIES.filter(o=>o.relationshipId===r.id&&o.status==='WON').reduce((s,o)=>s+(o.value??0),0);
    const costInter=INTERACTIONS.filter(i=>i.relationshipId===r.id).length;
    const costMtgs=MEETINGS.filter(m=>m.relationshipId===r.id).length;
    const costActs=ACTIONS.filter(a=>a.relationshipId===r.id&&!['DONE','COMPLETED','CANCELLED'].includes(a.status)).length;
    const cost=costInter*1+costMtgs*2+costActs*1;
    return {relationshipId:r.id,name:relLabel(r),classKey:relClass(r),classLabel:REL_CLASS_LABELS[relClass(r)],
      healthScore:r.healthScore,riskScore:r.riskScore,strategicScore:r.strategicScore,
      capital:cap.capital,trend:trend.trend,delta90d:trend.delta90d,confidence:trend.confidence,
      wonValue:won,cost,roi:cost?Math.round(100*won/cost)/100:null,
      interactions:costInter,meetings:costMtgs,openActions:costActs,plan:!!accountPlanOf(r.id)};
  });
  const portfolioCapital=rows.reduce((s,r)=>s+r.capital,0);
  const avgHealth=rows.length?Math.round(rows.reduce((s,r)=>s+(r.healthScore??0),0)/rows.length):0;
  const wonValue=rows.reduce((s,r)=>s+r.wonValue,0);
  const totalCost=rows.reduce((s,r)=>s+r.cost,0);
  const lv=riskLeverageView(req);
  const sorted=[...rows].sort((a,b)=>(b.roi??0)-(a.roi??0));
  return {generatedAt:nowIso(),period:'۹۰ روز اخیر',
    kpis:{portfolioCapital,avgHealth,healthyCount:rows.filter(r=>(r.healthScore??0)>=60).length,atRiskCount:rows.filter(r=>r.classKey==='RISK'||(r.riskScore??0)>=60).length,
      strategicCount:rows.filter(r=>(r.strategicScore??0)>=70).length,trendUp:rows.filter(r=>r.trend==='UP').length,trendDown:rows.filter(r=>r.trend==='DOWN').length,
      wonValue,totalCost,roi:totalCost?Math.round(100*wonValue/totalCost)/100:null,
      revenueAtRisk:lv.kpis.totalRevenueAtRisk,singlePointRelationships:lv.kpis.singleRelationshipCount,singlePointPeople:lv.kpis.singlePersonCount,regressions:rows.filter(r=>r.trend==='DOWN').length},
    rows:sorted,topRisks:lv.exposures.slice(0,5),singlePeople:lv.singlePeople.slice(0,4),
    capitalTop:[...rows].sort((a,b)=>b.capital-a.capital).slice(0,5),
    riskTop:[...rows].sort((a,b)=>b.riskScore-a.riskScore).slice(0,5)};
}

// full visible graph (orgs + people + memberships + meeting edges) for analytics
function netGraphVisible(req){
  const rels=scopedRels(req);
  const relOrgIds=new Set();
  rels.forEach(r=>{relOrgIds.add(r.sourceOrganizationId);relOrgIds.add(r.targetOrganizationId);});
  const orgNodes=[],personNodes=[];
  ORGS.forEach(o=>{ if(inScope(req,o.id)||relOrgIds.has(o.id)) orgNodes.push({id:`org:${o.id}`,label:o.name,type:'organization',organizationId:o.id}); });
  scopedPeople(req).forEach(p=>personNodes.push({id:`person:${p.id}`,label:`${p.firstName} ${p.lastName}`,type:'person',organizationId:p.organizationId}));
  const nodes=[...orgNodes,...personNodes];
  const nodeIds=new Set(nodes.map(n=>n.id));
  const edges=[];
  const relEdge=(r)=>({id:`e-${r.id}`,source:`org:${r.sourceOrganizationId}`,target:`org:${r.targetOrganizationId}`,kind:'relationship',weight:Math.round(30+(r.healthScore??50)/2),risk:r.riskScore??0,strategicImportance:r.strategicScore??50,status:r.status,health:r.healthScore,label:r.relationshipType});
  rels.forEach(r=>{const s=`org:${r.sourceOrganizationId}`,t=`org:${r.targetOrganizationId}`; if(nodeIds.has(s)&&nodeIds.has(t)) edges.push(relEdge(r));});
  scopedPeople(req).forEach(p=>{const pid=`person:${p.id}`,oid=`org:${p.organizationId}`; if(nodeIds.has(pid)&&nodeIds.has(oid)) edges.push({id:`pm-${p.id}`,source:pid,target:oid,kind:'membership',weight:15,risk:0,strategicImportance:0});});
  const personEdges=new Set();
  MEETINGS.forEach(m=>{
    const parts=(m.participants??[]).map(x=>`person:${x.personId}`).filter(pid=>nodeIds.has(pid));
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      const key=[parts[i],parts[j]].sort().join('|');
      if(personEdges.has(key))continue;
      personEdges.add(key);
      edges.push({id:`pp-${m.id}-${i}-${j}`,source:parts[i],target:parts[j],kind:'person_relationship',weight:12,risk:0,strategicImportance:35});
    }
  });
  return {nodes,edges};
}
function netUndirected(nodes,edges){
  const adj=new Map();
  const push=(u,v)=>{ if(!adj.has(u))adj.set(u,[]); adj.get(u).push(v); };
  nodes.forEach(n=>adj.set(n.id,[]));
  edges.forEach(e=>{push(e.source,e.target);push(e.target,e.source);});
  return adj;
}
function netComponents(nodes,adj){
  const seen=new Set(); const comps=[];
  for(const n of nodes){
    if(seen.has(n.id))continue;
    const comp=[]; const q=[n.id]; seen.add(n.id);
    while(q.length){ const u=q.pop(); comp.push(u); for(const v of adj.get(u)??[]){ if(!seen.has(v)){seen.add(v);q.push(v);} } }
    comps.push(comp);
  }
  return comps;
}
function netPairBc(nodes,edges){
  // deterministic betweenness approximation: for every ordered node pair, walk one
  // BFS path (stable tie-break) and count passages per node.
  const adj=netUndirected(nodes,edges);
  const bc=new Map(nodes.map(n=>[n.id,0]));
  const ids=nodes.map(n=>n.id);
  for(const s of ids){
    for(const t of ids){
      if(s===t)continue;
      const prev=new Map([[s,null]]); const q=[s];
      while(q.length){ const u=q.shift(); if(u===t)break; const vs=(adj.get(u)??[]).slice().sort(); for(const v of vs){ if(!prev.has(v)){prev.set(v,u);q.push(v);} } }
      if(!prev.has(t))continue;
      let c=t;
      while(c!==s){ bc.set(c,(bc.get(c)??0)+1); c=prev.get(c); }
    }
  }
  return bc;
}
function netAnalytics(req,kind){
  const g=netGraphVisible(req);
  const nodes=g.nodes,edges=g.edges;
  const adj=netUndirected(nodes,edges);
  const name=(n)=>n.label;
  const row=(n,extra)=>({node:{id:n.id,label:name(n),name:name(n),type:n.type},...extra});
  const pairs=Math.max(1,(nodes.length-1)*(nodes.length-2)/2);
  if(kind==='centrality'){
    const deg=new Map(); edges.forEach(e=>{deg.set(e.source,(deg.get(e.source)??0)+1);deg.set(e.target,(deg.get(e.target)??0)+1);});
    const items=nodes.map(n=>row(n,{degree:deg.get(n.id)??0})).sort((a,b)=>b.degree-a.degree).slice(0,8);
    return {items,count:items.length,generatedAt:nowIso()};
  }
  if(kind==='connectors'){
    const bc=netPairBc(nodes,edges);
    const items=nodes.filter(n=>n.type==='person').map(n=>row(n,{connectorScore:Math.round((bc.get(n.id)??0)*100/pairs),scoreVersion:'نسخهٔ ۱ — گذر کوتاه‌ترین مسیرها'}))
      .sort((a,b)=>b.connectorScore-a.connectorScore).filter(x=>x.connectorScore>0).slice(0,8);
    return {items,count:items.length,generatedAt:nowIso()};
  }
  if(kind==='bridges'){
    const base=netComponents(nodes,adj).length;
    const out=[];
    for(const p of nodes.filter(n=>n.type==='person')){
      const sub=nodes.filter(n=>n.id!==p.id);
      const subAdj=netUndirected(sub,edges.filter(e=>e.source!==p.id&&e.target!==p.id));
      const increase=netComponents(sub,subAdj).length-base+1;
      if(increase>0) out.push(row(p,{bridgeScore:increase}));
    }
    return {items:out.sort((a,b)=>b.bridgeScore-a.bridgeScore).slice(0,8),count:out.length,generatedAt:nowIso()};
  }
  if(kind==='single-points-of-failure'){
    const base=netComponents(nodes,adj).length;
    const out=[];
    for(const n of nodes){
      const sub=nodes.filter(x=>x.id!==n.id);
      const subAdj=netUndirected(sub,edges.filter(e=>e.source!==n.id&&e.target!==n.id));
      const increase=netComponents(sub,subAdj).length-base+1;
      if(increase>0) out.push(row(n,{fragmentationIncrease:increase}));
    }
    return {items:out.sort((a,b)=>b.fragmentationIncrease-a.fragmentationIncrease).slice(0,8),count:out.length,generatedAt:nowIso()};
  }
  if(kind==='bottlenecks'){
    const risky=new Set(edges.filter(e=>(e.kind==='relationship'||e.kind==='person_relationship')&&(e.risk??0)>=40).map(e=>e.id));
    const deg=new Map(); edges.forEach(e=>{deg.set(e.source,(deg.get(e.source)??0)+1);deg.set(e.target,(deg.get(e.target)??0)+1);});
    const riskyDeg=new Map(); edges.forEach(e=>{ if(risky.has(e.id)){riskyDeg.set(e.source,(riskyDeg.get(e.source)??0)+1);riskyDeg.set(e.target,(riskyDeg.get(e.target)??0)+1);} });
    const items=nodes.map(n=>row(n,{bottleneckScore:Math.round((riskyDeg.get(n.id)??0)*40+(deg.get(n.id)??0)),riskyConnections:riskyDeg.get(n.id)??0}))
      .filter(x=>x.riskyConnections>0).sort((a,b)=>b.bottleneckScore-a.bottleneckScore).slice(0,8);
    return {items,count:items.length,generatedAt:nowIso()};
  }
  return {items:[],count:0,generatedAt:nowIso()};
}

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

/* ─────────────────────────────  معیارهای ارزیابی (آینۀ کاتالوگ API) ─────────────────────────────
   کاتالوگ معیارها در `scripts/criteria-data.json` نگهداری می‌شود که با
   `node scripts/sync-criteria-catalog.mjs` از `apps/api/src/criteria/criteria.catalog.ts`
   تولید می‌شود؛ در نسخۀ Service Worker همان داده از `globalThis.__SRIP_CRITERIA_DATA__`
   تزریق می‌شود (make-demo-sw.mjs). قواعد محاسبه آینهٔ `criteria.engine.ts` است:
   فقط معیارهای پاسخ‌داده‌شده در امتیاز می‌آیند، پوشش/اطمینان گزارش می‌شود،
   و معیارهای دروازه‌ای سقف امتیاز می‌گذارند. */
let CRITERIA_DATA = null;
function criteriaData() {
  if (CRITERIA_DATA) return CRITERIA_DATA;
  const attempts = () => {
    const files = ['scripts/criteria-data.json', 'apps/web-ux/scripts/criteria-data.json'];
    try { files.push(path.join(__dirname, 'criteria-data.json')); } catch {}
    for (const f of files) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch {} }
    return null;
  };
  const loaded = attempts();
  CRITERIA_DATA = loaded ?? globalThis.__SRIP_CRITERIA_DATA__ ?? { scales: {}, familyMeta: {}, familyWeights: {}, criteria: [] };
  return CRITERIA_DATA;
}
const CRITERIA_VERSION = 'criteria-v1';
const METHOD_QUALITY = { DOCUMENT: 100, VERIFIED: 90, OWNER_ASSESSED: 70, SELF_REPORTED: 55, INFERRED: 40 };
const METHOD_LABELS = { DOCUMENT: 'مدرک/سند', VERIFIED: 'راستی‌آزمایی مستقل', OWNER_ASSESSED: 'ارزیابی مدیر رابطه', SELF_REPORTED: 'خوداظهادی مخاطب', INFERRED: 'استنتاج از رفتار' };
const pct = (v) => Math.max(0, Math.min(100, Math.round(Number.isFinite(+v) ? +v : 0)));
const criteriaScale = (c) => c.anchors ?? (criteriaData().scales[c.scaleId] || { anchors: [] }).anchors;
const criteriaForSubject = (subject) => criteriaData().criteria.filter((c) => (c.appliesTo || []).includes(subject));
const criterionByCode = (code) => criteriaData().criteria.find((c) => c.code === code);
const decayOf = (ageDays, halfLife) => {
  if (ageDays == null) return 0.85;
  const r = ageDays / Math.max(30, halfLife || 365);
  return Math.max(0.35, Math.min(1, 1 - 0.3 * Math.min(1, r) - 0.25 * Math.max(0, Math.min(1, r / 2))));
};
const observedConfidence = (evidence) => (evidence > 0 ? pct(28 + 62 * (1 - Math.exp(-evidence / 6))) : 15);
const coverageValue = (contacts, senior) => (contacts <= 0 ? 0 : contacts === 1 ? (senior ? 45 : 30) : contacts === 2 ? 55 : contacts <= 4 ? 80 : 100);
const logScale = (amount) => pct(Math.log10(Math.max(1, amount)) * 20);

const assessmentStore = () => { if (!DB.assessments) DB.assessments = {}; return DB.assessments; };
const assessmentKey = (subjectType, subjectId) => `${subjectType}:${subjectId}`;
function storedAnswers(subjectType, subjectId) {
  const bucket = assessmentStore()[assessmentKey(subjectType, subjectId)] || {};
  return Object.entries(bucket).map(([criterionCode, a]) => ({ criterionCode, ...a }));
}
function saveStoredAnswers(subjectType, subjectId, list) {
  const store = assessmentStore();
  const key = assessmentKey(subjectType, subjectId);
  const bucket = store[key] ?? (store[key] = {});
  for (const a of list) {
    if (a.level == null && a.value == null) { delete bucket[a.criterionCode]; continue; }
    bucket[a.criterionCode] = {
      level: a.level ?? null, value: a.value ?? null, note: a.note ?? null, evidence: a.evidence ?? null,
      method: a.method ?? 'OWNER_ASSESSED', answeredAt: a.answeredAt ?? new Date().toISOString(),
    };
  }
  saveDb();
  return Object.keys(bucket).length;
}

/* سیگنال‌های مشاهده‌شده از داده‌های رفتاری دمو — آینهٔ CriteriaService.observedSignals */
function criteriaObserved(subjectType, subjectId) {
  const out = {};
  const now = Date.now();
  const age = (iso) => (iso ? Math.max(0, (now - new Date(iso).getTime()) / 86400000) : 365);
  const put = (code, value, evidence, label) => { if (evidence > 0) out[code] = { value: pct(value), evidence, label }; };
  const seniorTitles = /مدیر\s*عامل|مدیرعامل|ceo|chief|عضو\s*هیئت\s*مدیره|مدیر\s*ارشد|رئیس|director|president/i;
  const meetingHasSenior = (m) => (Array.isArray(m?.participants) ? m.participants : []).some((pp) => {
    const person = PEOPLE.find((x) => x.id === (pp?.personId ?? pp?.id ?? pp));
    return seniorTitles.test(String(person?.title ?? ''));
  });

  if (subjectType === 'RELATIONSHIP') {
    const rel = RELS.find((r) => r.id === subjectId);
    if (!rel) return out;
    const its = INTERACTIONS.filter((x) => x.relationshipId === subjectId);
    const its180 = its.filter((x) => age(x.occurredAt) <= 180);
    const its90 = its.filter((x) => age(x.occurredAt) <= 90);
    const contacts = new Set(its90.map((x) => x.personId).filter(Boolean)).size;
    const mts180 = MEETINGS.filter((m) => m.relationshipId === subjectId && age(m.startAt) <= 180);
    const senior = mts180.filter(meetingHasSenior).length;
    const cm = COMMITMENTS.filter((c) => c.relationshipId === subjectId);
    const done = cm.filter((c) => c.status === 'FULFILLED').length;
    const opps = OPPORTUNITIES.filter((o) => o.relationshipId === subjectId);
    const value = opps.reduce((sum, o) => sum + Number(o.value ?? 0), 0);
    const weighted = opps.reduce((sum, o) => sum + Number(o.value ?? 0) * (Number(o.probability ?? 0) / 100), 0);
    const latest = its.map((x) => x.occurredAt).sort().slice(-1)[0];
    const daysSince = latest ? age(latest) : 365;
    const withOutcome = its180.filter((x) => x.outcome).length;
    const kinds = new Set(its180.map((x) => x.type)).size;
    const parallel = RELS.filter((r) => r.id !== subjectId && ((r.sourceOrganizationId === rel.sourceOrganizationId && r.targetOrganizationId === rel.targetOrganizationId) || (r.sourceOrganizationId === rel.targetOrganizationId && r.targetOrganizationId === rel.sourceOrganizationId))).length;
    const orgValue = OPPORTUNITIES.filter((o) => o.organizationId === rel.sourceOrganizationId).reduce((sum, o) => sum + Number(o.value ?? 0), 0);
    put('ACC_MULTITHREADING', coverageValue(contacts, senior > 0), Math.max(contacts, its90.length), `${contacts} خط تماس فعال در ۹۰ روز`);
    put('NET_TIE_STRENGTH', pct(its180.length * 4 + mts180.length * 8) * 0.6 + pct(100 - daysSince * 1.1) * 0.4, its180.length + mts180.length, `آخرین تعامل ${Math.round(daysSince)} روز پیش`);
    if (cm.length) put('CAP_DELIVERY', (done / cm.length) * 100, cm.length, `${done} از ${cm.length} تعهد انجام شده`);
    if (its180.length) put('ACC_RESPONSIVENESS', (withOutcome / its180.length) * 100, its180.length, `${withOutcome} از ${its180.length} تعامل با نتیجه`);
    if (value > 0) put('VALUE_REALISED', logScale(value), opps.length, `گردش ثبت‌شده ${value.toLocaleString('fa-IR')}`);
    put('VALUE_PIPELINE', logScale(weighted), opps.length, 'ارزش وزنی پایپ‌لاین');
    put('ACC_DECISION_ACCESS', senior > 0 ? Math.min(100, 60 + senior * 10) : mts180.length ? 35 : 20, senior + mts180.length, senior ? `${senior} نشست با مدیران ارشد` : 'بدون نشست با سطح تصمیم');
    put('STRAT_EXEC_SPONSOR', senior > 0 ? Math.min(100, 55 + senior * 12) : 15, senior + mts180.length, 'درگیری مدیران ارشد در ۱۸۰ روز');
    put('NET_NON_REDUNDANCY', (kinds / 5) * 60 + (Math.min(contacts, 5) / 5) * 40, kinds + contacts, `${kinds} نوع تعامل با ${contacts} نفر`);
    put('NET_BRIDGE', Math.min(100, 20 + contacts * 12 + (senior ? 20 : 0)), Math.max(contacts, 1), 'پل میان واحدهای طرف حساب');
    put('NET_SINGLE_POINT', parallel === 0 && contacts <= 1 ? 100 : parallel === 0 ? 70 : Math.max(0, 35 - parallel * 8), parallel + 1, parallel === 0 ? 'تنها مسیر دسترسی به این سازمان' : `${parallel} رابطهٔ موازی`);
    const share = orgValue > 0 ? value / orgValue : parallel === 0 ? 0.85 : 0.2;
    put('RISK_CONCENTRATION', share * 100, parallel + 1, `سهم ${Math.round(share * 100)}٪ از گردش ثبت‌شده`);
    return out;
  }

  if (subjectType === 'ORGANIZATION') {
    const rels = RELS.filter((r) => r.sourceOrganizationId === subjectId || r.targetOrganizationId === subjectId);
    const its = INTERACTIONS.filter((x) => x.organizationId === subjectId && age(x.occurredAt) <= 180);
    const its90 = its.filter((x) => age(x.occurredAt) <= 90);
    const contacts = new Set(its90.map((x) => x.personId).filter(Boolean)).size;
    const people = PEOPLE.filter((x) => x.organizationId === subjectId).length;
    const mts = MEETINGS.filter((m) => m.organizationId === subjectId && age(m.startAt) <= 180);
    const senior = mts.filter(meetingHasSenior).length;
    const opps = OPPORTUNITIES.filter((o) => o.organizationId === subjectId);
    const value = opps.reduce((sum, o) => sum + Number(o.value ?? 0), 0);
    const weighted = opps.reduce((sum, o) => sum + Number(o.value ?? 0) * (Number(o.probability ?? 0) / 100), 0);
    const cm = COMMITMENTS.filter((c) => c.organizationId === subjectId);
    const done = cm.filter((c) => c.status === 'FULFILLED').length;
    const avg = (key) => {
      const values = rels.map((r) => r[key]).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
      if (!values.length) return null; // فیلد ثبت‌نشده با صفر یکی نیست
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };
    put('ACC_MULTITHREADING', coverageValue(contacts, senior > 0), Math.max(contacts, its90.length), `${contacts} مخاطب فعال در ۹۰ روز`);
    if (value > 0) put('VALUE_REALISED', logScale(value), opps.length, `گردش ثبت‌شده ${value.toLocaleString('fa-IR')}`);
    put('VALUE_PIPELINE', logScale(weighted), opps.length, 'ارزش وزنی فرصت‌ها');
    if (cm.length) put('CAP_DELIVERY', (done / cm.length) * 100, cm.length, `${done} از ${cm.length} تعهد انجام شده`);
    put('STRAT_EXEC_SPONSOR', senior > 0 ? Math.min(100, 55 + senior * 10) : 15, senior + mts.length, `${senior} نشست با مدیران ارشد`);
    put('NET_BRIDGE', Math.min(100, rels.length * 12 + contacts * 4), rels.length, `${rels.length} رابطهٔ ثبت‌شده`);
    put('NET_TIE_STRENGTH', its.length * 2 + mts.length * 3, its.length + mts.length, `${its.length} تعامل در ۱۸۰ روز`);
    put('NET_NON_REDUNDANCY', Math.min(100, rels.length * 10 + people * 2), rels.length + people, `${rels.length} رابطه با ${people} نفر`);
    put('NET_SINGLE_POINT', rels.length <= 1 ? 85 : Math.max(0, 60 - rels.length * 8), Math.max(1, rels.length), rels.length <= 1 ? 'تنها یک رابطهٔ ثبت‌شده' : `${rels.length} رابطه`);
    const trust = avg('trustScore');
    if (trust != null && trust > 0) put('REL_TRUST', trust, rels.length, 'میانگین اعتماد روابط');
    const risk = avg('riskScore');
    if (risk != null && risk > 0) put('RISK_CONCENTRATION', risk, rels.length, 'میانگین ریسک روابط');
    return out;
  }

  if (subjectType === 'PERSON') {
    const person = PEOPLE.find((x) => x.id === subjectId);
    if (!person) return out;
    const its = INTERACTIONS.filter((x) => x.personId === subjectId);
    const its180 = its.filter((x) => age(x.occurredAt) <= 180);
    const its90 = its.filter((x) => age(x.occurredAt) <= 90);
    const withOutcome = its180.filter((x) => x.outcome).length;
    const mts = MEETINGS.filter((m) => (m.participants ?? []).some((pp) => (pp.personId ?? pp.id) === subjectId) && age(m.startAt) <= 180);
    const colleagues = new Set(INTERACTIONS.filter((x) => x.organizationId === person.organizationId && age(x.occurredAt) <= 90).map((x) => x.personId).filter(Boolean)).size;
    const senior = /مدیر\s*عامل|مدیرعامل|ceo|chief|عضو\s*هیئت|رئیس|director|president/i.test(String(person.title ?? ''));
    const latest = its.map((x) => x.occurredAt).sort().slice(-1)[0];
    const daysSince = latest ? age(latest) : 365;
    put('ACC_RESPONSIVENESS', its180.length ? (withOutcome / its180.length) * 100 : 0, its180.length, `${withOutcome} از ${its180.length} تعامل با نتیجه`);
    put('NET_TIE_STRENGTH', pct(its180.length * 4 + mts.length * 6) * 0.6 + pct(100 - daysSince * 1.1) * 0.4, its180.length + mts.length, `آخرین تماس ${Math.round(daysSince)} روز پیش`);
    put('ACC_MULTITHREADING', coverageValue(colleagues, senior), colleagues, `${colleagues} خط تماس در سازمان او`);
    put('ACC_DECISION_ACCESS', senior ? 85 : its90.length ? 50 : 25, Math.max(1, its90.length + mts.length), senior ? 'سمت ارشد' : 'بدون نشانهٔ سطح تصمیم');
    put('NET_SINGLE_POINT', its90.length === 0 ? 70 : 20, Math.max(1, its.length), 'جایگاه تنها در مسیر دسترسی');
    if (Number(person.influenceScore ?? 0) > 0) put('STRAT_POWER', Number(person.influenceScore), Math.max(1, its.length), 'شاخص نفوذ ثبت‌شده');
    return out;
  }

  return out;
}

const normalizeCriteriaAnswers = (raw) => {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.entries(raw).map(([criterionCode, v]) => (typeof v === 'object' ? { criterionCode, ...v } : { criterionCode, value: v })) : [];
  const out = [];
  for (const item of list) {
    const code = String(item?.criterionCode ?? item?.code ?? '').toUpperCase();
    if (!code || !criterionByCode(code)) continue;
    const level = item.level == null || item.level === '' ? null : Number(item.level);
    const value = item.value == null || item.value === '' ? null : Number(item.value);
    out.push({ criterionCode: code, level: Number.isFinite(level) ? level : null, value: Number.isFinite(value) ? value : null, note: item.note ?? null, evidence: item.evidence ?? null, method: item.method ?? 'OWNER_ASSESSED', answeredAt: item.answeredAt ?? new Date().toISOString() });
  }
  return out;
};

/** like the API: an answer may only reference a criterion defined for that subject type */
const criteriaScopeError = (subjectType, rows) => {
  const bad = rows.filter((r) => {
    const c = criterionByCode(r.criterionCode);
    return c && Array.isArray(c.appliesTo) && !c.appliesTo.includes(subjectType);
  });
  return bad.length ? `معیار «${bad.map((r) => r.criterionCode).join('، ')}» برای ${subjectType} تعریف نشده است.` : null;
};

function computeCriteria(subjectType, subjectId, options = {}) {
  const data = criteriaData();
  const universe = criteriaForSubject(subjectType);
  const answers = options.answers ?? storedAnswers(subjectType, subjectId);
  const observed = options.observed ?? criteriaObserved(subjectType, subjectId);
  const byCode = new Map(answers.filter((a) => a.level != null || a.value != null).map((a) => [a.criterionCode, a]));
  const weights = { ...(data.familyWeights[subjectType] || {}) };
  const totalWeight = Object.values(weights).reduce((sum, v) => sum + v, 0) || 1;
  const lines = [];
  const families = [];
  const flags = [];
  const unknown = [];
  const reviewDue = [];
  let answeredCount = 0;
  for (const family of Object.keys(data.familyMeta)) {
    const list = universe.filter((c) => c.family === family);
    if (!list.length) continue;
    const famTotalWeight = list.reduce((sum, c) => sum + c.weight, 0) || 1;
    let scoreSum = 0, weightSum = 0, confSum = 0, knownWeight = 0;
    const famLines = [];
    for (const c of list) {
      const a = byCode.get(c.code);
      const sig = observed[c.code];
      let assessed = null, aConf = 0;
      if (a) {
        answeredCount += 1;
        assessed = a.value != null ? pct(a.value) : (criteriaScale(c).find((x) => x.level === Number(a.level)) || {}).score ?? null;
        if (assessed != null) {
          const ageDays = a.answeredAt ? Math.floor((Date.now() - new Date(a.answeredAt).getTime()) / 86400000) : null;
          const quality = METHOD_QUALITY[a.method ?? 'OWNER_ASSESSED'] ?? 60;
          const bonus = (a.evidence && String(a.evidence).length > 8 ? 10 : 0) + (a.note && String(a.note).length > 12 ? 4 : 0);
          aConf = pct((quality + bonus) * decayOf(ageDays, c.halfLifeDays));
        }
      }
      const oVal = sig && Number.isFinite(sig.value) ? pct(sig.value) : null;
      const oConf = oVal != null ? observedConfidence(sig.evidence) : 0;
      let value = null, status = 'UNKNOWN', confidence = 0;
      if (assessed != null && oVal != null) { value = Math.round((assessed * aConf + oVal * oConf) / Math.max(1, aConf + oConf)); confidence = pct(100 - ((100 - aConf) * (100 - oConf)) / 100); status = 'BLENDED'; }
      else if (assessed != null) { value = assessed; confidence = aConf; status = 'ASSESSED'; }
      else if (oVal != null) { value = oVal; confidence = oConf; status = 'OBSERVED'; }
      const ageDays = a?.answeredAt ? Math.floor((Date.now() - new Date(a.answeredAt).getTime()) / 86400000) : null;
      const weightPct = Math.round((c.weight / famTotalWeight) * ((weights[family] ?? 0) / totalWeight) * 10000) / 100;
      const gateActive = c.gate && value != null && (c.gate.trigger === 'ABOVE' ? value >= c.gate.threshold : value <= c.gate.threshold);
      const line = {
        code: c.code, family, familyName: data.familyMeta[family].name, name: c.name, nameEn: c.nameEn, why: c.why,
        polarity: c.polarity, weight: c.weight, weightPct, value, displayValue: value, confidence, status,
        needsReview: value != null && (confidence < 40 || (ageDays != null && ageDays > c.halfLifeDays * 2)),
        answerAgeDays: ageDays, reliabilityDecay: Math.round(decayOf(ageDays, c.halfLifeDays) * 100) / 100,
        note: a?.note ?? null, evidence: a?.evidence ?? null, sources: c.sources,
        anchors: criteriaScale(c), intake: c.intake ? { prompt: c.intake.prompt, help: c.intake.help, recommended: !!c.intake.recommended } : null,
        observed: sig ? { value: pct(sig.value), evidence: sig.evidence, label: sig.label } : null,
        assessed: a && assessed != null ? { value: assessed, level: Number(a.level ?? 0), method: a.method ?? 'OWNER_ASSESSED', methodLabel: METHOD_LABELS[a.method ?? 'OWNER_ASSESSED'], confidence: aConf } : null,
        gate: c.gate ? { severity: c.gate.severity, message: c.gate.message, cap: c.gate.cap, active: !!gateActive } : null,
        actionHint: value == null
          ? (c.evidence === 'OBSERVED' ? 'با ثبت تعامل/جلسه/تعهد واقعی این معیار خودکار پر می‌شود.' : c.intake ? `پاسخ به این پرسش کافی است: «${c.intake.prompt}»` : 'یک ارزیابی مستند ثبت کنید.')
          : (c.polarity === 'مثبت' ? value < 45 : value > 55) ? 'شواهد این معیار را ضعیف می‌کند؛ یک اقدام اصلاحی با مهلت تعریف کنید.' : 'وضعیت مطلوب است؛ در بازبینی بعدی تمدید شود.',
      };
      famLines.push(line);
      if (value == null) { unknown.push({ code: c.code, name: c.name, family, weightPct, prompt: c.intake?.prompt, help: c.intake?.help }); continue; }
      scoreSum += value * c.weight; weightSum += c.weight; knownWeight += c.weight; confSum += confidence * c.weight;
      if (gateActive) flags.push({ code: `GATE_${c.code}`, severity: c.gate.severity, message: c.gate.message, criterionCode: c.code });
      if (c.intake?.warnBelow != null && c.intake.warning && value <= c.intake.warnBelow) flags.push({ code: `WARN_${c.code}`, severity: 'MEDIUM', message: c.intake.warning, criterionCode: c.code });
      if (line.needsReview) reviewDue.push({ code: c.code, name: c.name, reason: confidence < 40 ? 'اطمینان کمتر از ۴۰' : 'پاسخ کهنه (بیش از دو نیمه‌عمر)' });
    }
    families.push({
      family, name: data.familyMeta[family].name, nameEn: data.familyMeta[family].nameEn, rationale: data.familyMeta[family].rationale,
      modelWeight: weights[family] ?? 0, weightPct: Math.round(((weights[family] ?? 0) / totalWeight) * 1000) / 10,
      score: weightSum > 0 ? Math.round(scoreSum / weightSum) : null,
      confidence: knownWeight > 0 ? Math.round(confSum / knownWeight) : 0,
      coveragePct: knownWeight > 0 ? Math.round((knownWeight / famTotalWeight) * 100) : 0,
      known: famLines.filter((l) => l.value != null).length, total: famLines.length, lines: famLines,
    });
    lines.push(...famLines);
  }
  let num = 0, den = 0, confNum = 0, familyCredit = 0;
  for (const f of families) {
    if (f.score == null || !f.modelWeight) continue;
    num += f.score * f.modelWeight; den += f.modelWeight; confNum += f.confidence * f.modelWeight;
  }
  for (const f of families) { if (!f.modelWeight) continue; familyCredit += f.modelWeight * (f.coveragePct / 100); }
  const rawScore = den > 0 ? Math.round(num / den) : 0;
  const knownWeightRatio = Math.min(1, familyCredit / totalWeight);
  const coverage = Math.round(knownWeightRatio * 100);
  const baseConfidence = den > 0 ? Math.round(confNum / den) : 0;
  const confidence = Math.round(baseConfidence * (0.55 + 0.45 * knownWeightRatio));
  const uncertainty = Math.round((1 - knownWeightRatio) * 28 + (100 - baseConfidence) / 12);
  const gateCaps = flags.filter((f) => f.code.startsWith('GATE_')).map((f) => criterionByCode(f.criterionCode.replace('GATE_', ''))?.gate?.cap).filter((v) => v != null);
  const gateCap = gateCaps.length ? Math.min(...gateCaps) : null;
  const score = gateCap == null ? rawScore : Math.min(rawScore, gateCap);
  const critical = flags.some((f) => f.severity === 'CRITICAL');
  const rankable = coverage >= (options.minCoverage ?? 40) && confidence >= 35 && !critical;
  const verdict = critical ? { verdictLabel: 'پرچم بحرانی', verdict: 'CRITICAL', verdictHint: 'یک دروازۀ ریسک فعال است؛ تا جمع‌شدن این مورد امتیاز اعتبار عملیاتی ندارد.' }
    : coverage < 25 ? { verdictLabel: 'داده کافی نیست', verdict: 'INSUFFICIENT_DATA', verdictHint: 'تصویر هنوز ساخته نشده؛ این عدد را مبنای تصمیم نگذارید.' }
    : confidence < 40 ? { verdictLabel: 'پیش‌نویس ارزیابی', verdict: 'PRELIMINARY', verdictHint: 'شواهد کم یا کهنه است؛ با چند پاسخ مستند امتیاز جابه‌جا می‌شود.' }
    : score < 40 ? { verdictLabel: 'ضعیف', verdict: 'AT_RISK', verdictHint: 'شواهد کافی، وضعیت نامطلوب — نیازمند اقدام.' }
    : score >= 75 && confidence >= 65 ? { verdictLabel: 'قوی', verdict: 'STRONG', verdictHint: 'شواهد کافی و باکیفیت.' }
    : { verdictLabel: 'قابل اتکا', verdict: 'SOLID', verdictHint: 'امتیاز بر پایهٔ شواهد کافی محاسبه شده است.' };
  const behavioral = subjectType === 'RELATIONSHIP'
    ? INTERACTIONS.filter((x) => x.relationshipId === subjectId).length + MEETINGS.filter((m) => m.relationshipId === subjectId).length * 2 + COMMITMENTS.filter((c) => c.relationshipId === subjectId).length + OPPORTUNITIES.filter((o) => o.relationshipId === subjectId).length
    : answeredCount * 0;
  const evidenceShare = behavioral / (behavioral + 6);
  const hints = [];
  if (coverage < 40) {
    const heavy = unknown.filter((u) => u.weightPct >= 1.5).sort((a, b) => b.weightPct - a.weightPct).slice(0, 4);
    if (heavy.length) hints.push(`برای عبور از آستانۀ رتبه‌بندی (${options.minCoverage ?? 40}٪) این ${heavy.length} معیار پرتأثیر را پاسخ دهید: ${heavy.map((u) => u.name).join('، ')}.`);
  }
  const weakest = lines.filter((l) => l.value != null && (l.polarity === 'مثبت' ? l.value < 45 : l.value > 55)).sort((a, b) => b.weightPct - a.weightPct).slice(0, 3).map((l) => l.name);
  if (weakest.length) hints.push(`ضعیف‌ترین نقاط: ${weakest.join('، ')}.`);
  if (flags.length) hints.push(`${flags.length} پرچم ثبت شده است؛ ابتدا موارد بحرانی/بالا.`);
  const out = {
    subjectType, subjectId, score, rawScore, uncertainty, rangeLow: Math.max(0, score - uncertainty), rangeHigh: Math.min(100, score + uncertainty),
    coverage, confidence, rankingScore: rankable ? Math.round(score * (0.7 + 0.3 * (confidence / 100))) : score, rankable, gateCap,
    ...verdict, families: families.filter((f) => f.modelWeight > 0), criteria: lines,
    knownCriteria: lines.filter((l) => l.value != null).length, totalCriteria: lines.length, unknown, flags, reviewDue,
    answeredCount, blend: { behavioralEvidence: behavioral, observedShare: Math.round(evidenceShare * 100), coldStart: behavioral === 0 && coverage < 25 },
    criteriaVersion: CRITERIA_VERSION, computedAt: new Date().toISOString(), hints,
  };
  return applyManual(subjectType, subjectId, out);
}
function criteriaSummaryLite(a) {
  if (!a) return null;
  return {
    score: a.score, rawScore: a.rawScore, coverage: a.coverage, confidence: a.confidence, uncertainty: a.uncertainty,
    rangeLow: a.rangeLow, rangeHigh: a.rangeHigh, rankable: a.rankable, rankingScore: a.rankingScore, gateCap: a.gateCap,
    verdict: a.verdict, verdictLabel: a.verdictLabel, verdictHint: a.verdictHint, known: a.knownCriteria, total: a.totalCriteria,
    flags: a.flags.map((f) => ({ code: f.code, severity: f.severity, criterionCode: f.criterionCode })),
    families: a.families.map((f) => ({ family: f.family, name: f.name, score: f.score, weightPct: f.weightPct, coveragePct: f.coveragePct })),
    version: a.criteriaVersion, computedAt: a.computedAt,
    manual: a.manual ?? null, effectiveScore: a.effectiveScore ?? a.score, scoreSource: a.scoreSource ?? 'MODEL',
  };
}

/* ─────────────── تنظیم دستی امتیاز (manual nudge) ───────────────
   کارشناس می‌تواند امتیاز مدل را با یک «جابه‌جایی مستند» (±۲۵) اصلاح کند؛
   منشأ اصلی امتیاز همیشه مدل می‌ماند و این تنظیم در ممیزی ثبت می‌شود. */
function manualFor(subjectType, subjectId) {
  const rows = DB?.criteriaManual ?? [];
  const m = rows.find((x) => x.subjectType === subjectType && x.subjectId === subjectId);
  if (!m) return null;
  const expired = m.expiresAt ? new Date(m.expiresAt).getTime() <= Date.now() : false;
  return { ...m, active: m.enabled !== false && !expired, expired };
}
function applyManual(subjectType, subjectId, a) {
  if (!a) return a;
  const m = manualFor(subjectType, subjectId);
  const model = Number(a.score ?? 0);
  const effective = m?.active ? Math.max(0, Math.min(100, model + (Number(m.delta) || 0))) : model;
  return {
    ...a,
    manual: m,
    effectiveScore: effective,
    scoreSource: m?.active ? 'MODEL_MANUAL' : 'MODEL',
    modelScore: model,
  };
}
function subjectLabel(type, id) {
  try {
    if (type === 'ORGANIZATION') return orgById(id)?.name ?? id;
    if (type === 'PERSON') { const p = PEOPLE.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : id; }
    if (type === 'RELATIONSHIP') { const r = RELS.find((x) => x.id === id); if (!r) return id; return `${orgById(r.sourceOrganizationId)?.name ?? '—'} ↔ ${orgById(r.targetOrganizationId)?.name ?? '—'}`; }
    if (type === 'OPPORTUNITY') return OPPORTUNITIES.find((x) => x.id === id)?.name ?? id;
  } catch { /* fall back to id */ }
  return id;
}
function safeCriteriaLite(subjectType, subjectId) {
  try { return criteriaSummaryLite(computeCriteria(subjectType, subjectId)); } catch { return null; }
}
const attachCriteria = (subjectType, rows) => rows.map((row) => {
  const id = String(row?.id ?? '');
  if (!id) return row;
  try { return { ...row, criteria: criteriaSummaryLite(computeCriteria(subjectType, id)) }; } catch { return { ...row, criteria: null }; }
});
function seedCriteriaAssessments() {
  // ارزیابی‌های اولیهٔ نمونه‌ها (۱۲ روز پیش) تا دمو با پوشش واقعی شروع شود
  const answeredAt = new Date(Date.now() - 12 * 86400000).toISOString();
  const A = (level, extra = {}) => ({ level, answeredAt, method: 'OWNER_ASSESSED', ...extra });
  return {
    'ORGANIZATION:org-3': { STRAT_POWER: A(3), STRAT_FIT: A(2), VALUE_REALISED: A(4, { evidence: 'صورت وضعیت حسابرسی‌شده ۱۴۰۴', method: 'DOCUMENT' }), VALUE_GROWTH: A(3), CAP_QUALITY_SYSTEM: A(3), CAP_DELIVERY: A(3), REL_TRUST: A(3), REL_COMMITMENT: A(2), ACC_DECISION_ACCESS: A(3), FIN_Z_SCORE: A(3, { evidence: 'Z″≈۲٫۹ بر پایه صورت‌های مالی' }), FIN_LIQUIDITY: A(3), RISK_LEGAL: A(0), RISK_UBO: A(3) },
    'ORGANIZATION:org-6': { STRAT_POWER: A(1), STRAT_FIT: A(1), CAP_QUALITY_SYSTEM: A(0, { note: 'بدون ISO 9001؛ فقط بازرسی داخلی' }), CAP_DELIVERY: A(1), REL_TRUST: A(1), REL_OPPORTUNISM: A(3, { note: 'دو بار افزایش نرخ در میانهٔ قرارداد' }), VALUE_PAYMENT: A(1), FIN_Z_SCORE: A(0, { evidence: 'نسبت جاری ۰٫۷' }), RISK_CONCENTRATION: A(1) },
    'RELATIONSHIP:r-1': { STRAT_FIT: A(3), REL_TRUST: A(3), REL_COMMITMENT: A(3), ACC_MULTITHREADING: A(3), VALUE_GROWTH: A(3), CAP_SERVICE: A(3), RISK_LEGAL: A(0) },
    'RELATIONSHIP:r-4': { STRAT_FIT: A(1), REL_TRUST: A(1), REL_OPPORTUNISM: A(3, { note: 'تغییر یک‌طرفه نرخ در میانهٔ دوره' }), CAP_DELIVERY: A(1), CAP_CAPACITY: A(1), REL_INFORMATION_HONESTY: A(1), RISK_CONCENTRATION: A(1) },
    'PERSON:p-2': { ACC_CHAMPION_POWER: A(3), ACC_DECISION_ROLE: A(2), REL_TRUST: A(3), ACC_CONTACT_STABILITY: A(3, { note: 'تغییر ساختار در تدارکات' }) },
  };
}



/* ─────────────── مرکز دانش (Knowledge Center) — محتوای واقعی و کاربردی ───────────────
   مقالات از رفتار واقعی پلتفرم نوشته شده‌اند: آستانه‌ها، وزن‌ها، سقف‌های دروازه،
   تنظیم دستی، مجوزها و جریان کار — نه متن تزئینی. */
let __rawHttpBody = '';
const KB_CATEGORIES = [
  { key: 'GETTING_STARTED', label: 'شروع سریع' },
  { key: 'SCORING', label: 'امتیازدهی' },
  { key: 'PROCESS', label: 'فرآیند و اتوماسیون' },
  { key: 'SECURITY', label: 'امنیت و دسترسی' },
  { key: 'ANALYTICS', label: 'تحلیل و هوشمندی' },
];
const KB_FAMILY_LABELS = {
  STRATEGIC: 'اهمیت و هم‌راستایی راهبردی', VALUE: 'ارزش اقتصادی', CAPABILITY: 'توانمندی عملیاتی',
  RELIABILITY: 'قابلیت اعتماد', ACCESS: 'دسترسی و نفوذ', FINANCIAL: 'مالی و منابع',
  RISK: 'ریسک و انطباق', NETWORK: 'شبکه و موقعیت',
};
const kb = (id, slug, title, excerpt, category, tags, families, readMinutes, author, body, extra = {}) =>
  ({ id, slug, title, excerpt, category, tags, families, readMinutes, author,
     updatedAt: extra.updatedAt ?? '2026-08-30T09:00:00.000Z', views: extra.views ?? 0,
     helpful: extra.helpful ?? 0, notHelpful: extra.notHelpful ?? 0, bookmarks: extra.bookmarks ?? [], body, ...extra, id, slug, title, excerpt, category, tags, families });

function seedKnowledge() {
  return [
    kb('kb-start', '5-minute-first-score', 'در پنج دقیقه به اولین امتیاز معیارها برسید', 'مسیر کوتاه از ورود تا داشتن یک امتیاز قابل اتکا برای نخستین رابطه؛ جایی که باید بروید و هر عدد یعنی چه.', 'GETTING_STARTED', ['شروع', 'امتیاز', 'گام‌به‌گام'], ['STRATEGIC', 'RELIABILITY'], 4, 'تیم محصول',
      '۱) یک سازمان و سپس یک رابطه بسازید (منوی «روابط» → «رابطهٔ جدید»). هنگام ساخت، پرسش‌نامهٔ اختیاری معیارها ظاهر می‌شود؛ آریا فناوری را با پترو صنعت وصل کنید. \n۲) به صفحهٔ همان رابطه بروید. کارت «امتیاز معیارها» عدد، پوشش اطلاعات و اطمینان را نشان می‌دهد. اگر تازه شروع کرده‌اید برچسب «داده کافی نیست» را می‌بینید — این طبیعی است و عمداً عددی نمی‌سازد. \n۳) روی «ثبت ارزیابی» بزنید و تنها پرسش‌هایی را پاسخ دهید که مطمئن هستید. هر پاسخ «ناشناخته» را از بین نمی‌برد؛ فقط آن معیار را روشن می‌کند. \n۴) تعامل‌ها، جلسه‌ها، تعهدها و فرصت‌های همان رابطه به‌صورت خودکار به‌عنوان «رفتار واقعی» وارد مدل می‌شوند و سهم مشاهده‌شده را بالا می‌برند. \n۵) برای رتبه‌بندی، پوشش باید به آستانهٔ تعریف‌شده (پیش‌فرض ۴۰٪) برسد. زیر آن، رکورد صادقانه «قابل مقایسه نیست» می‌ماند.', { views: 312, helpful: 41 }), kb('kb-scoring-model', 'how-scoring-works', 'مدل امتیازدهی دقیقاً چطور کار می‌کند؟', 'وزن خانواده‌ها، قطبیت هر معیار، سقف‌های دروازه و نقش اطمینان — تا بتوانید عدد را بخوانید، نه فقط ببینید.', 'SCORING', ['وزن‌ها', 'دروازه', 'اطمینان'], ['STRATEGIC', 'VALUE', 'CAPABILITY', 'RELIABILITY', 'ACCESS', 'FINANCIAL', 'RISK', 'NETWORK'], 6, 'تیم محصول', 'هر رابطه، سازمان، شخص و فرصت از یک کاتالوگ معیار امتیاز می‌گیرد: هر معیار به یک خانواده تعلق دارد (راهبردی، ارزش، توانمندی، قابلیت اعتماد، دسترسی، مالی، ریسک، شبکه) و وزن ۱ تا ۳ دارد. \nامتیاز هر خانواده، میانگین وزن‌دار معیارهای پاسخ‌داده‌شدهٔ همان خانواده است؛ سپس خانواده‌ها با وزن سازمانی (قابل تغییر در «مدیریت → معیارها») ترکیب می‌شوند. خانوادۀ بدون داده در تقسیم وزن حساب نمی‌شود تا «نبودِ اطلاعات» خودش نمره نشود. \nقطبیت مهم است: معیارهای ریسک (منفی) بالاتر بودن یعنی بدتر؛ معیارهای مثبت (مثبت) بالاتر یعنی بهتر. هر دو به مقیاس ۰ تا ۱۰۰ نگاشت می‌شوند. \nدروازهٔ ریسک (دروازه) از میانگین‌گیری مستثناست: اگر شرطش فعال شود، سقف امتیاز را تحمیل می‌کند — مثلاً «سقف ۴۰». این یعنی یک معیار بحرانی را چند معیار خوب «جبران» نمی‌کنند. \nدر نهایت، امتیاز بدون اطمینان ارائه نمی‌شود: پوشش (چند درصد از وزن مدل داده دارد؟) و اطمینان (کیفیت و تازگی پاسخ‌ها) کنار هر عدد می‌آیند و امتیاز رتبه‌بندی = امتیاز × (۰٫۷ + ۰٫۳ × اطمینان).', { views: 540, helpful: 86 }), kb('kb-manual', 'manual-override', 'تنظیم دستی امتیاز: چه وقت، چرا و تا کجا؟', 'وقتی دانش شما از مدل جلوتر است؛ چطور با ±۲۵ و دلیلِ الزامی این کار را بکنید و مدل را دست‌نخورده نگه دارید.', 'SCORING', ['دستی', 'ممیزی'], ['RISK', 'STRATEGIC'], 3, 'تیم محصول', 'مدل بر شواهد ساخته می‌شود؛ اما گاهی شما چیزی می‌دانید که هنوز در سیستم ثبت نشده — مانند امضای اولیهٔ قرارداد. برای همین در کارت «امتیاز معیارها» دکمهٔ «تنظیم دستی» است. \nجابه‌جایی فقط تا ±۲۵ نقطه مجاز است (عدد بزرگ‌تر یعنی احتمالاً باید دادهٔ اصلی را ثبت کنید نه امتیاز را تکان دهید). دلیل تنظیم الزامی است؛ چون در ممیزی ثبت می‌شود و بعداً باید قابل بازبینی باشد. \nانقضا را انتخاب کنید (۳۰/۹۰/۱۸۰ روز یا دائمی). پس از انقضا، امتیاز خودکار به مدل برمی‌گردد و نشان «دستی» از روی نشان‌ها برداشته می‌شود. \nهر جا «دستی» می‌بینید، یعنی امتیاز موثر = مدل ± جابه‌جایی؛ مبنای مدل هرگز بازنویسی نمی‌شود. نشان «تنظیم دستی منقضی» هم هشدار می‌دهد که جابه‌جایی دیگر اعمال نمی‌شود.', { views: 198, helpful: 33 }), kb('kb-verdict', 'verdict-ladder', 'نردبان حکم: هر برچسب یعنی چه اقدامی؟', 'قابل اتکا، پیش‌نویس، داده کافی نیست، ضعیف و پرچم بحرانی — نقشهٔ اقدام هر وضعیت.', 'SCORING', ['حکم', 'اقدام'], [], 4, 'تیم محصول', 'پرچم بحرانی: یک دروازهٔ ریسک فعال است. تا جمع‌شدن آن، هیچ رتبه‌بندی و مقایسه‌ای انجام نشود؛ اول اقدام کنید. \nداده کافی نیست (پوشش زیر ۲۵٪): تصویر ساخته نشده. عددی که می‌بینید صرفاً پرسش‌های جواب‌داده است؛ مبنای تصمیم نگیرید. \nپیش‌نویس ارزیابی (اطمینان زیر ۴۰٪): شواهد کم یا کهنه است. چند پاسخ مستند می‌تواند امتیاز را به‌شکل معنادار جابه‌جا کند — روی «ثبت ارزیابی» تمرکز کنید. \nقابل اتکا / قوی: شواهد کافی است. اینجا مقایسهٔ رتبه‌ای و تصمیم‌گیری مجاز است. «قوی» یعنی امتیاز ۷۵+ با اطمینان ۶۵+. \nضعیف: شواهد کافی و وضعیت نامطلوب — نیازمند اقدام. به «نقاط ضعف» در همان کارت نگاه کنید: سه معیاری که بیشترین اثر منفی را دارند آنجا فهرست شده‌اند.', { views: 260, helpful: 51 }), kb('kb-coverage', 'coverage-honesty', 'چرا «داده کافی نیست» درست‌تر از یک عدد خوش‌بینانه است؟', 'فلسفهٔ ناشناخته‌ها: پاسخ‌ندادن صفر حساب نمی‌شود؛ و چرا این تصمیم، امتیاز را قابل اعتمادتر می‌کند.', 'SCORING', ['پوشش', 'ناشناخته'], [], 4, 'تیم محصول', 'در این مدل، معیار بی‌پاسخ هرگز صفر فرض نمی‌شود. معیار بی‌پاسخ در «ناشناخته» می‌ماند، وزن‌ش در تقسیم حذف می‌شود و در عوض پوشش و اطمینان پایین می‌آید. \nنتیجه: یک رابطه با پنج پاسخ خوب اما پوشش ۲۰٪ هرگز «قابل اتکا» رتبه نمی‌گیرد؛ برچسب‌اش صادقانه «داده کافی نیست» است. اگر ناشناخته‌ها صفر بودند، هر رکورد نیمه‌پر با عددی نیمه‌واقعی در مقایسه‌های بالایی می‌نشست. \nدروازهٔ رتبه‌بندی (پیش‌فرض ۴۰٪ پوشش) و حداقل اطمینان ۳۵٪ همین را سخت‌گیرانه اجرا می‌کنند. به‌جای بالا بردن عدد، روی «معیارهای بدون داده» کار کنید — کارت امتیاز دقیقاً می‌گوید کدام‌ها بیشترین وزن را دارند. \nاگر ۲۴۰ نویسه دلیل نیاز نیست؛ فقط یک پاسخ کوتاه و دقیق. امتیاز، خلاصهٔ کیفیت دادهٔ شماست.', { views: 174, helpful: 29 }), kb('kb-families', 'families-and-evidence', 'هشت خانوادهٔ معیار و شواهد هر کدام', 'چرا هر خانواده وجود دارد، به چه پژوهشی وصل است و چه رفتاری در سیستم آن را «مشاهده» می‌کند.', 'SCORING', ['خانواده‌ها', 'شواهد'], ['STRATEGIC', 'VALUE', 'CAPABILITY', 'RELIABILITY', 'ACCESS', 'FINANCIAL', 'RISK', 'NETWORK'], 7, 'تیم محصول', 'اهمیت و هم‌راستایی راهبردی: برجستگی شریک، تناسب با استراتژی و قدرت ذی‌نفع (پایه: میتچل 1997). شاهد در سیستم: نوع رابطه، وضعیت، نقش سازمان در پروژه‌های مشترک. \nارزش اقتصادی: ارزش فعلی رابطه و چرخهٔ عمر آن. شاهد: ارزش فرصت‌ها و قراردادهای متصل. \nتوانمندی عملیاتی: کیفیت تحویل، ظرفیت، خدمت پس از فروش. شاهد: نتیجهٔ تعامل‌ها، جلسه‌ها و اقداماتِ خاتمه‌یافته. \nقابلیت اعتماد: ثبات رفتاری و پایبندی به قول‌ها. شاهد: تعهدهای سرموعد یا عقب‌افتاده. \nدسترسی و نفوذ: دسترسی به تصمیم‌گیرنده. شاهد: معرفی‌ها و نقش اشخاص کلیدی. \nمالی و منابع، ریسک و انطباق، شبکه و موقعیت: از وضعیت مالی، پرچم‌های ریسک، مسیرهای شبکه و مرکزیت استفاده می‌شود. هر معیار در کاتالوگ «منبع» دارد و طول عمر پاسخ‌اش (نیمه‌عمر) تعیین می‌کند چه وقت کهنه می‌شود.', { views: 233, helpful: 44 }), kb('kb-workflows', 'workflows-approvals', 'گردش‌کار و تأییدها: چه چیزی لازم است تأیید شود؟', 'اجراهای خودکار، قواعد تأیید و اینکه هر اقدام چه زمانی به «تأیید» گیر می‌کند.', 'PROCESS', ['گردش‌کار', 'تأیید'], [], 5, 'تیم محصول', 'گردش‌کارها، اقدام‌های خودکار روی رویدادها هستند (مثلاً ساخت رابطه یا وعدهٔ قرارداد). وضعیت اجرا را در «گردش‌کار و تأییدها → اجراها» ببینید. \nهر قاعده‌ای که روی «تأیید» بایستد، در صف «تأییدها» می‌آید و تا تصمیم کاربرِ دارای مجوز، اجرا متوقف می‌ماند — این عمدی است تا کارهای حساس بی‌اجازه نگذرند. \nخروجی گزارش‌ها هم همین‌طور است: «دریافت فایل» یک درخواست تأیید ثبت می‌کند و فایل واقعی پس از تأیید در صفحهٔ تأییدها صادر می‌شود. اگر پیام «ابتدا تأیید درخواست» دیدید، سراغ تأییدها بروید. \nاشخاص بدون مجوز، تنها می‌توانند اجراهایی را ببینند که در محدودهٔ سازمانی‌شان است؛ مالک سامانه همه‌چیز را می‌بیند.', { views: 121, helpful: 18 }), kb('kb-security', 'data-security', 'امنیت داده: طبقه‌بندی، تأیید دومرحله‌ای و نشست‌ها', 'مدارک واقعی: طبقه‌بندی اسناد، تأیید دومرحله‌ای، احراز هویت، نشست‌ها و رویدادهای امنیتی.', 'SECURITY', ['تأیید دومرحله‌ای', 'طبقه‌بندی', 'نشست'], [], 5, 'تیم محصول', 'ورود با تأیید دومرحله‌ای محافظت می‌شود؛ دستگاه‌های تأییدشده و کدهای بازیابی در «امنیت → دستگاه‌های من» مدیریت می‌شوند. در دمو، هر کد شش‌رقمی پذیرفته می‌شود. \nاسناد چهار طبقه دارند: داخلی، محرمانه، محدود و عمومی. بارگذاری با اعتبارسنجی نوع فایل/پسوند، قرنطینه و اسکن بدافزار همراه است؛ وضعیت هر فایل کنارش می‌آید. \nنشست‌های فعال خود را در «نشست‌های من» ببینید و از راه دور ببندید. رویدادهای ورود ناموفق، قفل حساب، تلاش بدون مجوز و صادرات در «امنیت → رویدادها» ثبت می‌شوند. \nنکتهٔ مهم: در حالت دمو (سرویس میزبانی استاتیک) همه‌چیز در مرورگر شما اجرا می‌شود و داده‌ها برای همان نشست است؛ هیچ داده‌ای به سرور واقعی نمی‌رود.', { views: 149, helpful: 22 }), kb('kb-intel', 'reading-intelligence', 'خواندن هوشمندی: سیگنال‌ها، فرصت‌ها و پوشش راهبردی', 'چهار بخش صفحهٔ هوشمندی یعنی چه و هر کدام به کدام اقدام ختم می‌شود.', 'ANALYTICS', ['هوشمندی', 'ریسک', 'فرصت'], ['RISK', 'STRATEGIC'], 6, 'تیم محصول', 'سیگنال‌های ریسک از دادهٔ واقعی ساخته می‌شوند: اقدام عقب‌افتاده، تعهد عقب‌افتاده، اقدام مسدود، سلامت پایین و تعامل کهنه. شدت بالا (۶۰+) یعنی فوری؛ بالای ۴۰ متوسط، زیر آن ملایم. تأخیر بیش از دو برابر، شدت را بالا می‌برد. \nتشخیص فرصت دو نوع است: پیگیری (فرصتِ بازِ روی رابطه) و رشد (رابطه‌ای با امتیاز فرصت ۶۰+ ولی بدون فرصت باز) — یعنی به‌جای فهرست پیوندها، به بازار رشد واقعی اشاره می‌کند. \nپوشش راهبردی، روابط استراتژیک (امتیاز راهبردی ۶۰+) را با وضعیت عملیاتی‌شان مقایسه می‌کند: اقدام باز، تعهد باز یا اقدام بعدیِ آینده. شکاف‌ها را با بدون اقدام باز و سلامت پایین می‌بیند. \nستون «معیارها» در همین جدول، امتیاز شاخص هر رابطه را به امتیاز معیارها وصل می‌کند — همان عددی که در صفحهٔ رابطه می‌بینید.', { views: 205, helpful: 37 }), kb('kb-reports', 'reports-and-export', 'گزارش‌ها و خروجی: چه مجوزی لازم است؟', 'نقشهٔ گزارش‌ها، فرمت‌ها، محدودیت متن ساختاریافته برای مدیران و جریان تأیید خروجی.', 'PROCESS', ['گزارش', 'خروجی', 'مجوز'], [], 4, 'تیم محصول', 'گزارش‌ها بر اساس محدودهٔ سازمانی شما ساخته می‌شوند و همان‌جا می‌توانید فایل جدولی/XLSX/گزارش رنگی داشته باشید. \nفرمت متن ساختاریافته مخصوص مدیران سازمانی است؛ فایل جدولی برای بقیهٔ کاربران دارای مجوز خروجی. بدون مجوز خروجی گزارش، دکمهٔ خروجی کار نمی‌کند. \nجریان تأیید: ابتدا «دریافت فایل» (ثبت درخواست)، بعد در «تأییدها» تأیید، سپس دوباره تلاش کنید. هر خروجی در لاگ تحویل و رویدادهای امنیتی ثبت می‌شود. \nدر دمو، خروجی فایل جدولی واقعی تولید می‌شود ولی صفحهٔ گسترده/سند به فایل جدولی برمی‌گردند تا بدون سرور افزوده هم کار کنند.', { views: 96, helpful: 14 }), kb('kb-network', 'network-spof', 'شبکه: مرکزیت، پل‌ها و نقطهٔ شکست واحد', 'چرا یک گره «مرکزیت» بالا یا «نقطهٔ شکست واحد» می‌گیرد و چرا این برای شما مهم است.', 'ANALYTICS', ['شبکه', 'ریسک'], ['NETWORK', 'RISK'], 4, 'تیم محصول', 'مرکزیت شبکه، گره‌هایی را نشان می‌دهد که بیشترین پیوند را دارند — آنها کانون ارتباط شما هستند؛ از دست دادن‌شان گران است. \nپل‌های ارتباطی اشخاصی هستند که دو خوشهٔ متفاوت را به هم می‌رسانند؛ معمولاً مدیرانی که در چند وضعیت نقش دارند. \nنقطهٔ شکست واحد  گره‌ای است که حذف آن شبکه را از هم باز می‌کند. اگر همان گره با پیوندهای پرریسک همراه باشد، بالاترین اولویت اقدام را دارد: حداقل یک مسیر جایگزین بسازید. \nبه یاد داشته باشید که امتیازهای این صفحه با امتیازهای معیاریِ همان گره یکی نیستند؛ اعداد شبکه ساختاری‌اند و اعداد معیار، کیفیت رابطه را می‌سنجند.', { views: 158, helpful: 26 }), kb('kb-ai', 'ai-and-brief', 'بریف اجرایی و دستیار: کجا به عددها اعتماد کنیم؟', 'تفاوت خلاصهٔ خودکار با امتیاز معیارها و مرز اعتماد در خروجی هوش مصنوعی.', 'ANALYTICS', ['هوش مصنوعی', 'بریف'], [], 4, 'تیم محصول', 'دستیار هوشمند و بریف اجرایی، متن را از همان دادهٔ ساخت‌یافته می‌سازند؛ اطلاعات جدید به پایگاه داده اضافه نمی‌کنند. برای همین قبل از اعتماد، سند مرتبط را چک کنید. \nعددهای بریف (میانگین سلامت، ریسک، فرصت) از دادهٔ واقعی و با محدودهٔ سازمانی محاسبه می‌شوند، ولی «تفسیر» متن خودکار است. \nبه‌عنوان قاعدهٔ سرانگشتی: هر جا «امتیاز معیارها» را می‌بینید، همان عدد مقیاس ۰–۱۰۰ با پوشش و اطمینان است؛ هر جا درصد یا شمارش در بریف است، منبع‌اش به دادهٔ خام وصل است. \nاگر متن بریف با امتیاز معیارها نخواند، اول پوشش را چک کنید— معمولاً دلیلش دادهٔ ناقص است نه اشتباه مدل.', { views: 172, helpful: 25 }),
  kb('kb-publics', 'publics-map', 'نقشهٔ عموم‌ها: شش دسته، شناسنامه و شکاف‌ها', 'خوانش هاب عموم‌ها: الگوی سازمان، ماتریس قدرت و علاقه، پوشش دسته‌ها، شکاف بحرانی و مسیر پیشنهادی.', 'ANALYTICS', ['عموم‌ها', 'شکاف', 'شناسنامه'], ['STRATEGIC', 'NETWORK'], 5, 'تیم محصول', '«عموم‌ها» ذی‌نفعان اثرگذار بیرون از روابط قراردادی‌اند؛ نقشهٔ آن‌ها در شش دسته ساخته می‌شود: داخلی، نهادی و حاکمیتی، علمی و دانشگاهی، اقتصادی و سرمایه‌گذاری، رسانه‌ای و عمومی، و اکوسیستم فناوری و صنعت. \nتب «شناسنامهٔ سازمان» نوع شرکت را تعیین می‌کند و الگوی همان نوع، فهرست گروه‌های هدف را می‌سازد؛ «اعضا و ارزیابی» هر عموم را با پیوند (مثلاً فعال‌کننده یا کارکردی-خروجی)، مرحلهٔ بلوغ (نهفته تا فعال)، موضع (ناظر تا بازیگر کلیدی) و قدرت/علاقه ثبت می‌کند و همان دو عدد، جایگاه گره را در ماتریس ۲×۲ می‌دهد. \n«پوشش» به تفکیک دسته نشان می‌دهد چند گروه هدف عضو دارند و کدام دسته خالی است؛ «شکاف‌ها و اقدام» شکاف‌های بحرانی (بازیگر کلیدیِ غایب یا عقب‌مانده) را با اقدام پیشنهادی و مسیر پیشنهادی روی شبکهٔ واقعی روابط نشان می‌دهد. \nگره‌های گراف شبکه با رنگ دستهٔ عموم‌ها و حلقهٔ طلایی «خودِ شرکت» برچسب می‌خورند؛ فیلتر دسته در همان صفحه گراف را تفکیک می‌کند. خلاصهٔ مدیریتی یک‌صفحه‌ای برای هیئت‌مدیره از همین داده ساخته می‌شود و خروجی JSON/CSV/Excel قابل دانلود است. \nمحرک‌های خودکار (PUBLIC_MEMBER_ADDED، PUBLIC_STAGE_CHANGED، PUBLIC_GAP_DETECTED، PUBLIC_REVIEW_DUE، MEDIA_CREATED) گردش‌کار می‌سازند و اقدام و اعلان واقعی ثبت می‌کنند.', { views: 87, helpful: 12 }),
    kb('kb-alerts', 'unified-alerts', 'هشدارهای یکپارچه: یک زنگوله برای همهٔ ماژول‌ها', 'صفحهٔ هشدارها همهٔ سیگنال‌های روابط، عموم‌ها، اقدام/تعهد، جلسات، گردش کار، کیفیت داده، امنیت و پایش را در یک نگاه فیلترپذیر می‌آورد.', 'PROCESS', ['هشدار', 'هشدار یکپارچه', 'اولویت'], [], 4, 'تیم محصول', 'پیش از این هر ماژول نوار هشدار خودش را داشت؛ حالا همهٔ تشخیص‌ها به شکل واحد (ماژول + شدت + دلیل + اقدام پیشنهادی) در «هوش ← هشدارها» می‌آیند. \\nشدت‌ها سه سطح‌اند: بحرانی (اقدام فوری — مثل تعهد عقب‌افتاده یا اجرای شکست‌خوردهٔ گردش کار)، هشدار (اقدام نزدیک — مثل شکاف بازیگر کلیدی در عموم‌ها یا ریسک رابطه) و اطلاع (بازبینی — مثل جلسهٔ بدون نتیجهٔ ثبت‌شده). \\nهر هشدار «چرا» صادر شده را می‌گوید و دکمهٔ اقدام مستقیم به موجودیت مربوط می‌برد. هشدارهای حل‌شده با ثبت پایدار از فهرست خارج می‌شوند. \\nمنطق تشخیص هیچ ماژولی تغییر نکرده؛ فقط خروجی‌ها یکجا جمع می‌شوند (ADR-0007).', { views: 64, helpful: 11 }),
    kb('kb-composite', 'entity-composite-score', 'امتیاز مرکب: یک عدد برای مقایسهٔ همهٔ روابط', 'فرمول شفاف و نسخه‌دار که هشت فاکتور رابطه را به یک عدد ۰ تا ۱۰۰ می‌رساند؛ تفکیک کامل در صفحهٔ رابطه.', 'SCORING', ['امتیاز مرکب', 'فرمول', 'وزن‌ها'], ['STRATEGIC', 'RISK', 'RELIABILITY'], 4, 'تیم محصول', 'فهرست روابط فقط «امتیاز مرکب» را نشان می‌دهد؛ در صفحهٔ رابطه تب «تفکیک امتیاز» هشت فاکتور با وزن هرکدام باز می‌شود. \\nفرمول: میانگین وزنیِ فاکتورها — سلامت ۲۵٪، ریسک ۲۰٪ (معکوس؛ ریسک بیشتر = امتیاز کمتر)، راهبردی ۱۵٪، اعتماد ۱۵٪، تعامل ۱۰٪، نفوذ ۵٪، فرصت ۵٪ و تاب‌آوری ۵٪. \\nنسخهٔ فرمول (formulaVersion) کنار امتیاز می‌آید تا تغییر وزن‌ها در طول زمان قابل ردیابی باشد. همان فرمول و همان وزن‌ها در API واقعی (apps/api) و این دمو اجرا می‌شود — یک منبع حقیقت (ADR-0006).', { views: 58, helpful: 13 }),
    kb('kb-strategy', 'strategy-hub', 'تحلیل راهبردی: سناریو، تعادل، شبیه‌سازی', 'هاب تحلیل راهبردی چطور خوانده شود: سناریو، ماتریس عایدی، تعادل نش، شبیه‌سازی تکراری، پیش‌بینی و واکنش.', 'ANALYTICS', ['راهبرد', 'تعادل نش', 'شبیه‌سازی', 'رقبا'], ['STRATEGIC', 'VALUE'], 6, 'تیم محصول', '«تحلیل راهبردی» رقابت و تعامل راهبردی را تحلیل می‌کند. \\nتب «نمای کلی» سناریوها و قالب‌های کلاسیک (معمای زندانی، شکار گوزن، تقابل، هماهنگی، سکهٔ مشابه، بازدارندگی ورود، جنگ قیمت) را نشان می‌دهد؛ «رقبا» طرف‌ها را از سازمان‌های سامانه یا دستی تعریف می‌کند. \\n«اتصال داده» دادهٔ هر پلتفرم دیگر را با قالب JSON/CSV و اعتبارسنجی سطر‌به‌سطر وارد می‌کند؛ «شبیه‌سازی» ماتریس عایدی، بهترین‌پاسخ‌ها، تعادل نش خالص و مختلط (۲×۲)، حذف غلبه، مسیر تعادل درخت ترتیبی و شبیه‌سازی تکراری بذردار را اجرا می‌کند. \\n«پیش‌بینی و واکنش» حرکت بعدی رقیب را از تاریخچه پیش‌بینی و بهترین پاسخ را توصیه می‌کند؛ «خروجی» بریف یک‌صفحه‌ای و دانلود JSON/CSV/Excel می‌دهد. \\nمحرک‌های خودکار (STRATEGY_SCENARIO_CREATED، STRATEGY_SIMULATED، STRATEGY_PREDICTED، STRATEGY_IMPORT_COMPLETED) گردش‌کار می‌سازند و اقدام و اعلان واقعی ثبت می‌کنند.', { views: 41, helpful: 9 }), ]; }  
/* اسناد واقعی مرکز دانش — در دمو بدون فایل واقعی، اما با چرخهٔ واقعی وضعیت/اسکن/ایندکس */
function seedDocuments() {
  const at = (d) => new Date(Date.now() - d * 86400000).toISOString();
  return [
    { id: 'doc-1', name: 'راهنمای امتیازدهی معیارها.pdf', mimeType: 'application/pdf', sizeBytes: 1284500, classification: 'INTERNAL', uploadedBy: 'demo@srip.local', organizationId: 'org-1', scanStatus: 'CLEAN', uploadStatus: 'READY', indexStatus: 'INDEXED', createdAt: at(9), updatedAt: at(9) },
    { id: 'doc-2', name: 'فرم معرفی شریک راهبردی.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 348000, classification: 'CONFIDENTIAL', uploadedBy: 'demo@srip.local', organizationId: 'org-1', scanStatus: 'CLEAN', uploadStatus: 'READY', indexStatus: 'PENDING', createdAt: at(6), updatedAt: at(6) },
    { id: 'doc-3', name: 'الگوی ارزیابی تأمین‌کننده.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 892000, classification: 'RESTRICTED', uploadedBy: 'client@arya-tech.ir', organizationId: 'org-3', scanStatus: 'CLEAN', uploadStatus: 'READY', indexStatus: 'INDEXED', createdAt: at(4), updatedAt: at(4) },
    { id: 'doc-4', name: 'پیش‌نویس قرارداد چارچوب همکاری.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 612000, classification: 'CONFIDENTIAL', uploadedBy: 'demo@srip.local', organizationId: 'org-3', scanStatus: 'QUARANTINED', uploadStatus: 'PENDING', indexStatus: 'PENDING', createdAt: at(1), updatedAt: at(1) },
  ];
}
/* ─────────────── P1: سرمایهٔ رابطه، روند، برنامهٔ ۹۰ روزه، کالیبراسیون و رویداد شغلی ─────────────── */
/* اسنپشات امتیازها (P1-2): پایهٔ محاسبهٔ روند/اطمینان — از همان امتیازهای رابطه، بدون دادهٔ جدا */
function seedScoreSnapshots(){
  const ago=(d)=>new Date(Date.now()-d*86400000).toISOString();
  const rows=[];
  const defs={
    'r-1':[[92,62,74,70,64,3],[60,66,78,72,67,3],[30,72,82,78,70,4],[0,78,86,80,72,5]],
    'r-2':[[92,63,88,86,75,3],[60,64,89,88,78,3],[30,62,90,90,80,4],[0,64,92,90,81,5]],
    'r-3':[[92,67,70,62,70,2],[60,69,72,63,72,2],[30,68,73,65,74,3],[0,71,74,66,77,4]],
    'r-4':[[92,55,72,66,52,3],[60,50,70,64,48,2],[30,46,69,62,45,3],[0,41,69,60,45,4]],
    'r-5':[[92,74,84,80,82,3],[60,77,85,82,85,3],[30,79,86,84,88,3],[0,82,88,85,90,4]],
    'r-6':[[92,85,83,70,46,3],[60,85,84,70,47,3],[30,86,84,70,48,4],[0,86,84,70,48,4]],
  };
  for(const [rid,d] of Object.entries(defs)) for(const [days,health,strategic,influence,opportunity,sources] of d){
    rows.push({relationshipId:rid,asOf:ago(days),daysAgo:days,health,strategic,influence,opportunity,score:relSnapshotScore({health,strategic,influence,opportunity}),sources,confidence:Math.min(100,Math.round(30+sources*12+(days<=0?10:days<=30?6:days<=60?3:0)))});
  }
  return rows;
}
/* برنامهٔ ۹۰ روزهٔ حساب (P1-3): اقدامات، مالک، مهلت، مرور ماهانه + ریسک‌نامه */
function seedAccountPlans(){
  const day=(d)=>new Date(Date.now()+d*86400000).toISOString();
  return {
    'r-1':{id:'ap-1',relationshipId:'r-1',horizonDays:90,status:'ON_TRACK',reviewCycleDays:30,reviewDates:[day(-6),day(24),day(54),day(84)],
      riskNote:'امضای نهایی منوط به تأیید هیئت‌مدیرهٔ پترو است؛ اگر تأیید تا ۳۰ روز آینده نرسد، ریسک قیمت‌گذاری و رقابت بالا می‌رود.',
      items:[
        {id:'ap1-1',title:'تمدید قرارداد دوسالهٔ پشتیبانی و توسعه',ownerId:'p-1',dueAt:day(20),status:'IN_PROGRESS',focus:'قرارداد'},
        {id:'ap1-2',title:'تثبیت نقش هیئت‌مدیرهٔ پترو — جلسه با مدیر مالی',ownerId:'p-6',dueAt:day(35),status:'TODO',focus:'کمیتهٔ خرید'},
        {id:'ap1-3',title:'جلسهٔ بازبینی دوره‌ای با مدیر خرید',ownerId:'p-8',dueAt:day(60),status:'TODO',focus:'جلسه'},
        {id:'ap1-4',title:'معرفی سرویس جدید به واحد فناوری پترو',ownerId:'p-7',dueAt:day(75),status:'TODO',focus:'رشد'},
      ]},
    'r-2':{id:'ap-2',relationshipId:'r-2',horizonDays:90,status:'NEEDS_ATTENTION',reviewCycleDays:30,reviewDates:[day(-3),day(27),day(57),day(87)],
      riskNote:'مدارک مالی خط اعتباری هنوز تکمیل نشده؛ بدون طرح توجیهی، بررسی واحد اعتبارات متوقف می‌ماند.',
      items:[
        {id:'ap2-1',title:'تکمیل مدارک مالی و طرح توجیهی خط اعتباری',ownerId:'p-6',dueAt:day(-3),status:'TODO',focus:'مالی'},
        {id:'ap2-2',title:'جلسه با واحد اعتبارات بانک',ownerId:'p-1',dueAt:day(12),status:'IN_PROGRESS',focus:'قرارداد'},
        {id:'ap2-3',title:'گزارش فنی پلتفرم بانکداری شرکتی به مدیر فناوری',ownerId:'p-7',dueAt:day(45),status:'TODO',focus:'فنی'},
      ]},
    'r-3':{id:'ap-3',relationshipId:'r-3',horizonDays:90,status:'ON_TRACK',reviewCycleDays:30,reviewDates:[day(-10),day(20),day(50),day(80)],
      riskNote:'تمرکز رابطه روی یک پروژهٔ فعال است؛ تعمیق با مدیر مالی (آیدا) پیش‌نیاز تمدید قرارداد نگهداری است.',
      items:[
        {id:'ap3-1',title:'پیش‌نویس قرارداد نگهداری سالانه',ownerId:'p-8',dueAt:day(15),status:'IN_PROGRESS',focus:'قرارداد'},
        {id:'ap3-2',title:'جلسهٔ تعمیق با مدیر مالی سدنا',ownerId:'p-1',dueAt:day(30),status:'TODO',focus:'کمیتهٔ خرید'},
        {id:'ap3-3',title:'مرور ریسک تحویل فاز دوم',ownerId:'p-7',dueAt:day(50),status:'TODO',focus:'ریسک'},
      ]},
    'r-4':{id:'ap-4',relationshipId:'r-4',horizonDays:90,status:'NEEDS_ATTENTION',reviewCycleDays:30,reviewDates:[day(-8),day(22),day(52),day(82)],
      riskNote:'رابطه در وضعیت WATCH است: سلامت ۴۱، ریسک ۶۶ و یک تعهد جبرانی باز؛ تأخیر بعدی می‌تواند زنجیرهٔ تأمین را متوقف کند.',
      items:[
        {id:'ap4-1',title:'بازبینی شروط قرارداد تأمین',ownerId:'p-5',dueAt:day(5),status:'IN_PROGRESS',focus:'قرارداد'},
        {id:'ap4-2',title:'شناسایی و ارزیابی تأمین‌کنندهٔ دوم',ownerId:'p-8',dueAt:day(25),status:'TODO',focus:'تنوع‌بخشی'},
        {id:'ap4-3',title:'جلسهٔ مشترک ریسک با مدیر کیفیت البرز',ownerId:'p-1',dueAt:day(2),status:'BLOCKED',focus:'ریسک'},
      ]},
    'r-5':{id:'ap-5',relationshipId:'r-5',horizonDays:90,status:'ON_TRACK',reviewCycleDays:30,reviewDates:[day(-5),day(25),day(55),day(85)],
      riskNote:'فرصت سرمایه‌گذاری قوی است؛ تنها ریسک، وابستگی به یک کانال ارتباطی (مدیر استراتژی) است.',
      items:[
        {id:'ap5-1',title:'گزارش فصلی پرتفوی صندوق',ownerId:'p-6',dueAt:day(10),status:'IN_PROGRESS',focus:'قرارداد'},
        {id:'ap5-2',title:'معرفی فرصت مشترک جدید به صندوق',ownerId:'p-8',dueAt:day(40),status:'TODO',focus:'رشد'},
        {id:'ap5-3',title:'تعمیق ارتباط با هیئت سرمایه‌گذاری',ownerId:'p-6',dueAt:day(60),status:'TODO',focus:'کمیتهٔ خرید'},
      ]},
  };
}
/* رویدادهای شغلی (P1-5): حرکت حامی‌ها/ارتباط‌های کلیدی */
function seedCareerEvents(){
  return [
    {id:'ce-1',personId:'p-9',type:'PROMOTED',at:'2026-08-14T09:00:00.000Z',from:{organizationId:'org-3',title:'معاون اعتباری'},to:{organizationId:'org-3',title:'قائم‌مقام مدیرعامل — حوزهٔ اعتبارات'},source:'NETWORK_SIGNAL',alert:true,note:'حامی خط اعتباری ارتقا یافت؛ تماس تبریک + تازه‌سازی شناخت در پنجرهٔ ۳۰–۶۰ روز.'},
    {id:'ce-2',personId:'p-4',type:'LEFT',at:'2026-08-05T09:00:00.000Z',from:{organizationId:'org-5',title:'مدیر پروژه'},to:{organizationId:'org-4',title:'مدیر پروژه‌های سرمایه‌گذاری'},source:'COMPETITOR_INSIGHT',alert:true,note:'علی نادری از سدنا به پترو صنعت رفت؛ او خریدار اقتصادی قراردادهای قبلی سدنا بود.'},
    {id:'ce-3',personId:'p-12',type:'TITLE_CHANGED',at:'2026-07-28T09:00:00.000Z',from:{organizationId:'org-5',title:'مدیر مالی'},to:{organizationId:'org-5',title:'مدیر مالی ارشد'},source:'ACTIVE_USER',alert:true,note:'حامی مالی قرارداد نگهداری ارتقا یافت؛ نقش او در تصویب بودجه پررنگ‌تر شده است.'},
    {id:'ce-4',personId:'p-7',type:'HIRED',at:'2026-07-01T09:00:00.000Z',from:null,to:{organizationId:'org-2',title:'مدیر محصول'},source:'ACTIVE_USER',alert:false,note:'عضو جدید تیم داخلی؛ برای ارزیابی‌های فنی مشتریان در دسترس است.'},
  ];
}
/* برچسب حامی + منبع شناسایی + قدرت حامیی (P1-5) */
const CHAMPION_TAG_SEED={
  'p-3':{flag:true,source:'WON_DEAL',power:84},
  'p-9':{flag:true,source:'ACTIVE_USER',power:76},
  'p-11':{flag:true,source:'WON_DEAL',power:88},
  'p-12':{flag:true,source:'ACTIVE_USER',power:71},
};
for(const [pid,t] of Object.entries(CHAMPION_TAG_SEED)){const p=PEOPLE.find(v=>v.id===pid); if(p) p.champion=t;}
/* تنظیم‌های کالیبراسیون مدل (P1-4): گپ هدف و نیمه‌عمر خانواده‌ها */
function seedCalibrationSettings(){
  return {targetGap:20,windowMonths:12,lastRun:new Date().toISOString(),halfLifeDefault:90,
    familyOverrides:{STRATEGIC:120,VALUE:90,CAPABILITY:75,RELIABILITY:60,ACCESS:60,FINANCIAL:90,RISK:90,NETWORK:75},
    history:[
      {period:'فصل دوم ۱۴۰۴',scoreGap:24,note:'گپ بالای هدف — تنظیم نیمه‌عمرها به منحنی فعلی'},
      {period:'فصل سوم ۱۴۰۴',scoreGap:18,note:'گپ زیر هدف — نیمه‌عمر خانوادهٔ دسترسی کوتاه‌تر شد'},
    ]};
}
/* فرصت‌های تاریخی بسته‌شده + امتیاز زمان بستن (P1-4) */
OPPORTUNITIES.push(
  {id:'o-5',name:'قرارداد پایش شبکهٔ بانک پارس',description:'مانیتورینگ و گزارش‌دهی امنیتی ۱۲ ماهه',status:'WON',probability:100,value:25000000000,expectedDate:'2026-05-20T00:00:00.000Z',organizationId:'org-3',relationshipId:'r-2',projectId:null,ownerId:'p-7',createdAt:'2026-02-10T08:00:00.000Z',wonAt:'2026-05-20T10:00:00.000Z',scoreAtClose:74,sourceType:'EXISTING_RELATIONSHIP'},
  {id:'o-6',name:'پروژهٔ یکپارچه‌سازی پترو صنعت',description:'پیاده‌سازی سامانهٔ یکپارچه',status:'LOST',probability:0,value:60000000000,expectedDate:'2026-06-10T00:00:00.000Z',organizationId:'org-4',relationshipId:'r-1',projectId:null,ownerId:'p-1',createdAt:'2026-02-01T08:00:00.000Z',lostAt:'2026-06-10T10:00:00.000Z',scoreAtClose:47,lossReason:'انتخاب تأمین‌کنندهٔ ارزان‌تر',sourceType:'EVENT'},
  {id:'o-7',name:'قرارداد نگهداری سدنا ۱۴۰۴',description:'پیمان سالانهٔ نگهداری سامانه‌ها',status:'WON',probability:100,value:8000000000,expectedDate:'2026-04-15T00:00:00.000Z',organizationId:'org-5',relationshipId:'r-3',projectId:null,ownerId:'p-8',createdAt:'2026-01-20T08:00:00.000Z',wonAt:'2026-04-15T10:00:00.000Z',scoreAtClose:61,sourceType:'REFERRAL'},
  {id:'o-8',name:'تأمین ناوگان قطعات البرز',description:'قرارداد سالانهٔ تأمین قطعات',status:'LOST',probability:0,value:15000000000,expectedDate:'2026-07-01T00:00:00.000Z',organizationId:'org-6',relationshipId:'r-4',projectId:null,ownerId:'p-5',createdAt:'2026-03-05T08:00:00.000Z',lostAt:'2026-07-01T10:00:00.000Z',scoreAtClose:38,lossReason:'ریسک تأمین مالی از سمت البرز',sourceType:'COLD'},
  {id:'o-9',name:'سرویس مشاورهٔ صندوق امید',description:'مشاورهٔ سرمایه‌گذاری ۶ ماهه',status:'WON',probability:100,value:5000000000,expectedDate:'2026-03-10T00:00:00.000Z',organizationId:'org-7',relationshipId:'r-5',projectId:null,ownerId:'p-6',createdAt:'2026-01-15T08:00:00.000Z',wonAt:'2026-03-10T10:00:00.000Z',scoreAtClose:79,sourceType:'EXISTING_RELATIONSHIP'},
);
[{id:'o-3',scoreAtClose:68}].forEach(x=>{const o=OPPORTUNITIES.find(v=>v.id===x.id); if(o) o.scoreAtClose=x.scoreAtClose;});
const kbSummary = (a, uid) => ({
  id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, category: a.category,
  tags: a.tags ?? [], families: a.families ?? [], readMinutes: a.readMinutes, author: a.author,
  updatedAt: a.updatedAt, views: a.views ?? 0, helpful: a.helpful ?? 0, notHelpful: a.notHelpful ?? 0,
  bookmarked: Array.isArray(a.bookmarks) && a.bookmarks.includes(uid), isMine: !!uid && a.author === uid,
});

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
      if (!DB.assessments) DB.assessments = {};
      if (!Array.isArray(DB.criteriaManual)) DB.criteriaManual = [];
      if (!Array.isArray(DB.knowledge)) DB.knowledge = seedKnowledge();
      if (!Array.isArray(DB.documents)) DB.documents = seedDocuments();
      if (!Array.isArray(DB.scoreSnapshots)) DB.scoreSnapshots = seedScoreSnapshots();
      if (!DB.accountPlans) DB.accountPlans = seedAccountPlans();
      if (!Array.isArray(DB.careerEvents)) DB.careerEvents = seedCareerEvents();
      if (!DB.calibrationSettings) DB.calibrationSettings = seedCalibrationSettings();
      if (!Array.isArray(DB.nbaExecutions)) DB.nbaExecutions = [];
      if (!Array.isArray(DB.edgeSuggestionAccepts)) DB.edgeSuggestionAccepts = [];
      if (!Array.isArray(DB.pulseSurveys)) DB.pulseSurveys = [];
      if (!DB.meetingIntelLabels) DB.meetingIntelLabels = {};
      if (!DB.compliance) DB.compliance = seedComplianceStore();
      if (!Array.isArray(DB.knowledgeTransfers)) DB.knowledgeTransfers = [];
    }
  } catch { DB = null; }
  if (!DB) {
    DB = { version: 2, users: {}, orgs: ORGS, people: PEOPLE, rels: RELS, meetings: MEETINGS,
      actions: ACTIONS, commitments: COMMITMENTS, projects: PROJECTS, projectExtra: PROJECT_EXTRA,
      opportunities: OPPORTUNITIES, interactions: INTERACTIONS, notifications: NOTIFICATIONS,
      recs: RECS, aiUsage: AI_USAGE, personOrgs: PERSON_ORGS, audit: [], revokedJtis: [], nextId: 1,
      assessments: seedCriteriaAssessments(), criteriaManual: [], knowledge: seedKnowledge(), documents: seedDocuments(),
      scoreSnapshots: seedScoreSnapshots(), accountPlans: seedAccountPlans(), careerEvents: seedCareerEvents(),
      calibrationSettings: seedCalibrationSettings(), nbaExecutions: [], edgeSuggestionAccepts: [],
      pulseSurveys: [], meetingIntelLabels: {}, compliance: seedComplianceStore(), knowledgeTransfers: [] };
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
  seedPublicsStore();
  seedSecurityEvents();
  seedPrivacyStore();
  seedEnterpriseStore();
  seedSettingsStore();
  seedSessionsStore();
  seedAnalyticsStore();
  saveDb();
}
let USERS = null;

/* P3: بازنشانی درجا (E2E/دمو) — همان seedهای راه‌اندازی، بدون دست‌کاری دیسک */
function resetDbInPlace(){
  DB = { version: 2, users: {}, orgs: ORGS, people: PEOPLE, rels: RELS, meetings: MEETINGS,
    actions: ACTIONS, commitments: COMMITMENTS, projects: PROJECTS, projectExtra: PROJECT_EXTRA,
    opportunities: OPPORTUNITIES, interactions: INTERACTIONS, notifications: NOTIFICATIONS,
    recs: RECS, aiUsage: AI_USAGE, personOrgs: PERSON_ORGS, audit: [], revokedJtis: [], nextId: 1,
    assessments: seedCriteriaAssessments(), criteriaManual: [], knowledge: seedKnowledge(), documents: seedDocuments(),
    scoreSnapshots: seedScoreSnapshots(), accountPlans: seedAccountPlans(), careerEvents: seedCareerEvents(),
    calibrationSettings: seedCalibrationSettings(), nbaExecutions: [], edgeSuggestionAccepts: [],
    pulseSurveys: [], meetingIntelLabels: {}, compliance: seedComplianceStore(), knowledgeTransfers: [] };
  // کاربران seed با هش‌های تازه (مثل راه‌اندازی first-run)
  for (const [email, u] of Object.entries(SEED_USERS)) {
    const salt = crypto.randomBytes(16).toString('hex');
    DB.users[email] = { ...u, salt, passwordHash: hashPassword(u.password, salt) };
    delete DB.users[email].password;
  }
  seedRoleStore(); seedTagStore(); seedCustomFields(); seedScoringRules();
  seedNotificationRules(); seedAuditDemo(); seedFeatureFlags(); seedExportLog();
  seedRetention(); seedMasterData(); seedIntegrations(); seedReferralStore();
  seedApprovals(); seedWorkflowStore(); seedPublicsStore(); seedStrategyStore(); seedSecurityEvents();
  seedPrivacyStore(); seedEnterpriseStore(); seedSettingsStore(); seedSessionsStore();
  seedAnalyticsStore(); saveDb();
}

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
const R_READ=['dashboard.read','publics.read','strategy.read','organization.read','person.read','relationship.read','network.read','interaction.read','meeting.read','action.read','commitment.read','project.read','opportunity.read','recommendation.read','report.read','document.read','notification.read','search.read','calendar.read','help.read','user.read','session.read','analytics.read','ai.query','ai.executive_brief'];
const R_WRITE=['strategy.write','publics.write','person.write','relationship.write','interaction.write','meeting.write','action.write','commitment.write','project.write','opportunity.write','recommendation.تأیید','document.write','data.manage'];
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
const PERMISSION_GROUPS_FA={General:'عمومی',Core:'هسته',Meetings:'جلسات',Work:'اقدامات و پروژه‌ها',Intelligence:'هوش و تحلیل',Knowledge:'دانش و جستجو',Account:'حساب و نشست',DataGovernance:'داده و کیفیت',Security:'امنیت',Admin:'مدیریت و یکپارچه‌سازی',Publics:'عموم‌ها',Strategy:'تحلیل راهبردی'};
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
  ['Publics','publics.read','مشاهده عموم‌ها'],['Publics','publics.write','مدیریت عموم‌ها'],
  ['Strategy','strategy.read','مشاهده تحلیل راهبردی'],['Strategy','strategy.write','مدیریت تحلیل راهبردی'],
  ['Intelligence','analytics.read','تحلیل و هوشمندی'],['Intelligence','analytics.write','ثبت رویداد و نتیجهٔ سنجش'],['Intelligence','ai.query','پرس‌وجوی هوشمند'],['Intelligence','ai.executive_brief','گزارش راهبردی هوش مصنوعی'],
  ['Intelligence','recommendation.read','مشاهده پیشنهادها'],['Intelligence','recommendation.تأیید','تأیید پیشنهاد'],['Intelligence','report.read','مشاهده و خروجی گزارش‌ها'],
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
  ['kpi_target','هدف شاخص سالانه','Organization','number',false,false],
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
const NR_EVENT_TYPES=['organization.created','organization.updated','organization.deleted','person.created','person.updated','person.deleted','relationship.created','relationship.updated','relationship.deleted','interaction.created','interaction.updated','interaction.deleted','meeting.created','meeting.updated','meeting.deleted','meeting.completed','commitment.created','commitment.updated','commitment.deleted','commitment.completed','commitment.overdue','action.created','action.updated','action.deleted','action.completed','project.created','project.updated','project.deleted','score.updated','relationship.score.changed','relationship.status.changed','relationship.lifecycle.changed','opportunity.created','opportunity.updated','opportunity.deleted','opportunity.status.changed','recommendation.created','recommendation.updated','recommendation.deleted','recommendation.viewed','recommendation.accepted','recommendation.action.completed','integration.webhook.received','approval.requested','approval.تأییدd','approval.rejected','data.import.تأییدd','data.import.completed','integration.sync.completed','integration.sync.failed','*'];
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
    {id:'au-seed-10',at:ago(0,2),actorEmail:'demo@srip.local',action:'EXPORT',entity:'Report',entityId:'relationship-health',outcome:'OK',ip:'10.0.0.1',meta:{format:'فایل جدولی',approval:'ap-1'}},
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
      {id:'ex-1',userId:'u-1',organizationId:'org-1',exportType:'فایل جدولی',entityType:'relationship-health',recordCount:8,classification:'CONFIDENTIAL',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(5,1)},
      {id:'ex-2',userId:'u-2',organizationId:'org-2',exportType:'XLSX',entityType:'company',recordCount:4,classification:'INTERNAL',requestId:null,ipAddress:'10.0.4.12',createdAt:ago(4,3)},
      {id:'ex-3',userId:'u-1',organizationId:'org-1',exportType:'PDF',entityType:'network',recordCount:38,classification:'RESTRICTED',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(3,2)},
      {id:'ex-4',userId:'u-1',organizationId:'org-1',exportType:'فایل جدولی',entityType:'meeting',recordCount:22,classification:'INTERNAL',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(2,4)},
      {id:'ex-5',userId:'u-2',organizationId:'org-2',exportType:'فایل جدولی',entityType:'contact',recordCount:14,classification:'CONFIDENTIAL',requestId:null,ipAddress:'10.0.4.12',createdAt:ago(2,1)},
      {id:'ex-6',userId:'u-1',organizationId:'org-1',exportType:'XLSX',entityType:'risk',recordCount:5,classification:'HIGHLY_CONFIDENTIAL',requestId:null,ipAddress:'10.0.0.1',createdAt:ago(1,2)},
    ];
  }
}
function exportView(x){ return {id:x.id,userId:x.userId,userName:userById(x.userId)?.name??x.userId,userEmail:userById(x.userId)?.email??null,organizationId:x.organizationId??null,organizationName:orgById(x.organizationId)?.name??null,exportType:x.exportType,entityType:x.entityType??null,recordCount:x.recordCount??0,classification:x.classification??'INTERNAL',requestId:x.requestId??null,ipAddress:x.ipAddress??null,createdAt:x.createdAt??null}; }


/* ---------- retention (DataProcessingPolicy + retention preview parity) ---------- */
const RETENTION_COLLECTIONS={Organization:'orgs',Project:'projects',Opportunity:'opportunities',Commitment:'commitments'};
const RETENTION_ENTITY_FA={Organization:'سازمان',Project:'پروژه',Opportunity:'فرصت',Commitment:'تعهد',Interaction:'تعامل',Meeting:'جلسه',Action:'اقدام',Person:'شخص'};
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

/* ---------- ممیزی معرفی (بدون آسیب به رابطه) ---------- */
const refRelCriteria = (rid) => { try { return criteriaSummaryLite(computeCriteria('RELATIONSHIP', rid)); } catch { return null; } };
const refTargetFlags = (oid) => { try { const a = computeCriteria('ORGANIZATION', oid); return (a?.flags ?? []).filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'); } catch { return []; } };
const refInstruction = (r) => (r.instruction && typeof r.instruction === 'object') ? r.instruction : null;
function referralAudit(r) {
  const checks = [];
  const ins = refInstruction(r);
  // ۱) سلامت رابطهٔ پیوند (جلوگیری از خراب‌کردن رابطه)
  if (r.relationshipId) {
    const c = refRelCriteria(r.relationshipId);
    if (!c) checks.push({ code: 'RELATIONSHIP_SAFE', label: 'رابطهٔ پیوند قابل ارزیابی نیست', level: 'WARN', detail: 'رابطهٔ رسمی پیدا نشد؛ بدون رابطهٔ ثبت‌شده اثر معرفی قابل سنجش نیست.', evidence: r.relationshipId });
    else if (c.verdict === 'CRITICAL') checks.push({ code: 'RELATIONSHIP_SAFE', label: 'رابطه در وضعیت بحرانی است', level: 'BLOCK', detail: 'دروازهٔ ریسک فعال است؛ معرفی در این وضعیت می‌تواند رابطه را خراب کند. ابتدا پرچم بحرانی را جمع کنید.', evidence: `verdict=${c.verdict}; score=${c.effectiveScore ?? c.score}` });
    else if (c.verdict === 'AT_RISK') checks.push({ code: 'RELATIONSHIP_SAFE', label: 'رابطه ضعیف است', level: 'WARN', detail: 'امتیاز معیارها پایین است؛ معرفی فقط با دستورالعمل سخت‌گیرانه و پیگیری نزدیک.', evidence: `score=${c.effectiveScore ?? c.score}; coverage=${c.coverage}%` });
    else if (c.coverage < 40) checks.push({ code: 'RELATIONSHIP_SAFE', label: 'دادهٔ رابطه ناقص است', level: 'WARN', detail: `پوشش معیارها ${c.coverage}٪ است؛ اثر معرفی بعداً قابل سنجش نیست. پاسخ به معیارها را تکمیل کنید.`, evidence: `coverage=${c.coverage}%` });
    else if (c.manual?.active) checks.push({ code: 'RELATIONSHIP_SAFE', label: 'تنظیم دستی روی رابطه فعال است', level: 'WARN', detail: 'امتیاز رابطه با تنظیم دستی (±' + (c.manual.delta || 0) + ') جابه‌جا شده؛ قبل از معرفی دقت کنید.', evidence: 'manual-active' });
    else checks.push({ code: 'RELATIONSHIP_SAFE', label: 'رابطه برای معرفی امن است', level: 'PASS', detail: `امتیاز معیارها ${c.effectiveScore ?? c.score} با پوشش ${c.coverage}٪ و حکم «${c.verdictLabel}».`, evidence: `score=${c.effectiveScore ?? c.score}` });
  } else {
    checks.push({ code: 'RELATIONSHIP_SAFE', label: 'بدون رابطهٔ رسمی', level: 'WARN', detail: 'این معرفی به رابطهٔ ثبت‌شده وصل نیست؛ اگر هدفش یک رابطهٔ موجود است، رابطه را انتخاب کنید.', evidence: 'no-relationship' });
  }
  // ۲) مقصد معتبر و فعال
  if (r.targetOrganizationId) {
    const o = orgById(r.targetOrganizationId);
    if (!o) checks.push({ code: 'TARGET_VALID', label: 'سازمان مقصد یافت نشد', level: 'BLOCK', detail: 'شناسهٔ مقصد نامعتبر است؛ معرفی ثبت نمی‌شود.', evidence: r.targetOrganizationId });
    else if (o.status && o.status !== 'ACTIVE' && o.status !== 'ACTIVE_') checks.push({ code: 'TARGET_VALID', label: 'سازمان مقصد فعال نیست', level: 'WARN', detail: `وضعیت مقصد «${o.status}» است؛ با یک طرفِ غیرفعال معرفی نسازید.`, evidence: o.status });
    else checks.push({ code: 'TARGET_VALID', label: 'مقصد معتبر و فعال است', level: 'PASS', detail: `«${o.name}» (${o.type ?? '—'})`, evidence: o.id });
  } else if (r.recipientUserId) {
    checks.push({ code: 'TARGET_VALID', label: 'مسیر داخلی (کاربر) است', level: 'PASS', detail: 'معرفی به کاربر داخلی؛ محدودهٔ سازمانی گیرنده بررسی شود.', evidence: r.recipientUserId });
  }
  // ۳) پرچم‌های سازمان مقصد
  if (r.targetOrganizationId) {
    const flags = refTargetFlags(r.targetOrganizationId);
    if (flags.some((f) => f.severity === 'CRITICAL')) checks.push({ code: 'TARGET_FLAGS', label: 'پرچم بحرانی روی مقصد', level: 'BLOCK', detail: flags[0].message, evidence: flags[0].code });
    else if (flags.length) checks.push({ code: 'TARGET_FLAGS', label: 'هشدار روی مقصد', level: 'WARN', detail: flags.map((f) => f.message).join('؛ '), evidence: flags.map((f) => f.code).join(',') });
    else checks.push({ code: 'TARGET_FLAGS', label: 'بدون پرچم ریسک', level: 'PASS', detail: 'سازمان مقصد پرچم فعال ندارد.', evidence: 'none' });
  }
  // ۴) تکرار (معرفی مشابه باز)
  const dups = (DB.referrals ?? []).filter((x) => x.id !== r.id && ['PENDING', 'ACCEPTED'].includes(x.status)
    && ((x.targetPersonId && x.targetPersonId === r.targetPersonId) || (x.targetOrganizationId && x.targetOrganizationId === r.targetOrganizationId && x.sourceOrganizationId === r.sourceOrganizationId)));
  if (dups.length) checks.push({ code: 'DUPLICATE', label: 'معرفی مشابهی در جریان است', level: 'WARN', detail: `«${dups[0].title}» (${dups[0].status}) — قبل از ثبت، تکراری نباشد.`, evidence: dups[0].id });
  else checks.push({ code: 'DUPLICATE', label: 'تکراری نیست', level: 'PASS', detail: 'معرفی مشابهِ باز وجود ندارد.', evidence: 'none' });
  // ۵) دستورالعمل (هدف + مرزها)
  if (!ins || !String(ins.goal ?? '').trim()) checks.push({ code: 'INSTRUCTION', label: 'بدون دستورالعمل', level: 'WARN', detail: 'هدف معرفی مشخص نشده؛ پذیرنده نمی‌داند «چرا» و «تا کجا» برود.', evidence: 'missing-goal' });
  else if (!String(ins.boundaries ?? '').trim()) checks.push({ code: 'INSTRUCTION', label: 'بدون مرز و محدودیت', level: 'WARN', detail: 'هدف نوشته شده ولی مرزها (چه کاری ممنوع است) مشخص نیست.', evidence: 'missing-boundaries' });
  else if (!Array.isArray(ins.forbidden) || !ins.forbidden.length) checks.push({ code: 'INSTRUCTION', label: 'بدون خط قرمز', level: 'WARN', detail: 'موضوعات ممنوع تعیین نشده؛ خطر توافق‌های بی‌اجازه.', evidence: 'missing-forbidden' });
  else checks.push({ code: 'INSTRUCTION', label: 'دستورالعمل کامل است', level: 'PASS', detail: `هدف: ${String(ins.goal).slice(0, 90)}${ins.forbidden.length ? '؛ ' + ins.forbidden.length + ' خط قرمز' : ''}`, evidence: 'complete' });
  // ۶) اشخاص مبدأ/مقصد
  const missing = [!r.sourcePersonId || personById(r.sourcePersonId) ? null : 'مبدأ', !r.targetPersonId || personById(r.targetPersonId) ? null : 'مقصد'].filter(Boolean);
  const peopleCheck = missing.length ? { code: 'PEOPLE', label: 'اشخاص معرفی نامعتبر', level: 'WARN', detail: `${missing.join(' و ')} یافت نشد.`, evidence: missing.join(',') } : { code: 'PEOPLE', label: 'اشخاص معتبرند', level: 'PASS', detail: 'مبدأ و مقصد شخصی دارند.', evidence: 'ok' };
  checks.push(peopleCheck);
  const level = checks.some((x) => x.level === 'BLOCK') ? 'BLOCKED' : checks.some((x) => x.level === 'WARN') ? 'WARN' : 'PASS';
  return { gate: level, checks, checkedAt: nowIso(), summary: { pass: checks.filter((x) => x.level === 'PASS').length, warn: checks.filter((x) => x.level === 'WARN').length, block: checks.filter((x) => x.level === 'BLOCK').length } };
}
function referralPostAudit(r) {
  if (!['ACCEPTED', 'COMPLETED'].includes(r.status)) return { gate: 'N/A', checks: [], summary: { pass: 0, warn: 0, block: 0 } };
  const checks = [];
  const accepted = r.acceptedAt ? new Date(r.acceptedAt).getTime() : null;
  // پیگیری: تعامل/جلسه روی رابطه پس از پذیرش
  const follow = accepted ? INTERACTIONS.filter((i) => (r.relationshipId && i.relationshipId === r.relationshipId) || (r.sourcePersonId && i.personId === r.sourcePersonId) || (r.targetPersonId && i.personId === r.targetPersonId))
    .filter((i) => new Date(i.occurredAt ?? 0).getTime() >= accepted) : [];
  const ci = r.postCheckins?.FOLLOW_UP;
  if (r.status === 'COMPLETED' || (accepted && Date.now() - accepted > 7 * 86400000)) {
    if (follow.length || ci) checks.push({ code: 'FOLLOW_UP', label: 'پیگیری پس از معرفی ثبت شده', level: 'PASS', detail: ci?.note ?? `نخستین تعامل: ${follow[0]?.subject ?? '—'}`, evidence: ci?.at ?? follow[0]?.occurredAt });
    else checks.push({ code: 'FOLLOW_UP', label: 'پیگیری ثبت نشده است', level: 'BLOCK', detail: 'هیچ تعامل/جلسه‌ای پس از پذیرش ثبت نشده؛ معرفی بدون پیگیری رها شده.', evidence: 'none' });
  } else checks.push({ code: 'FOLLOW_UP', label: 'پیگیری در مهلت', level: 'PASS', detail: 'تا ۷ روز پس از پذیرش فرصت ثبت پیگیری است.', evidence: 'due' });
  // نتیجه
  if (r.status === 'COMPLETED') {
    checks.push(String(r.notes ?? '').trim() ? { code: 'OUTCOME', label: 'نتیجه ثبت شده', level: 'PASS', detail: r.notes, evidence: r.completedAt } : { code: 'OUTCOME', label: 'نتیجه ثبت نشده', level: 'WARN', detail: 'معرفی «انجام‌شده» است ولی نتیجه/یادداشت پایانی ندارد.', evidence: 'no-notes' });
  }
  // اثر بر رابطه
  if (r.relationshipId) {
    const now = refRelCriteria(r.relationshipId);
    const base = r.baselineCriteria;
    if (!base) checks.push({ code: 'RELATIONSHIP_IMPACT', label: 'اثر بر رابطه قابل سنجش نیست', level: 'WARN', detail: 'خط پایهٔ امتیاز هنگام پذیرش ثبت نشده؛ برای پذیرش‌های جدید خودکار ثبت می‌شود.', evidence: 'no-baseline' });
    else if (!now) checks.push({ code: 'RELATIONSHIP_IMPACT', label: 'رابطه پیداشدنی نیست', level: 'WARN', detail: 'رابطهٔ پیوند حذف یا جابه‌جا شده است.', evidence: r.relationshipId });
    else {
      const delta = Math.round((now.effectiveScore ?? now.score) - (base.score ?? 0));
      const degraded = now.verdict === 'CRITICAL' || now.verdict === 'AT_RISK';
      if (degraded && delta < 0) checks.push({ code: 'RELATIONSHIP_IMPACT', label: 'معرفی به رابطه آسیب زده', level: 'BLOCK', detail: `امتیاز معیارها از ${base.score ?? '—'} به ${now.effectiveScore ?? now.score} رسید (${delta > 0 ? '+' : ''}${delta}) و حکم «${now.verdictLabel}» شد.`, evidence: `before=${base.score};after=${now.effectiveScore ?? now.score};delta=${delta}` });
      else if (delta < -5) checks.push({ code: 'RELATIONSHIP_IMPACT', label: 'افت محسوس در رابطه', level: 'WARN', detail: `امتیاز معیارها ${delta} واحد افت کرده (${base.score ?? '—'} → ${now.effectiveScore ?? now.score}). پیگیری لازم است.`, evidence: `delta=${delta}` });
      else checks.push({ code: 'RELATIONSHIP_IMPACT', label: 'رابطه سالم مانده', level: 'PASS', detail: `امتیاز معیارها ${base.score ?? '—'} → ${now.effectiveScore ?? now.score} (${delta > 0 ? '+' : ''}${delta})؛ حکم «${now.verdictLabel}».`, evidence: `delta=${delta}` });
    }
  }
  const level = checks.some((x) => x.level === 'BLOCK') ? 'BLOCKED' : checks.some((x) => x.level === 'WARN') ? 'WARN' : 'PASS';
  return { gate: level, checks, summary: { pass: checks.filter((x) => x.level === 'PASS').length, warn: checks.filter((x) => x.level === 'WARN').length, block: checks.filter((x) => x.level === 'BLOCK').length } };
}


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
      {id:'ap-1',entityType:'Report',entityId:'relationship-health',actionType:'EXPORT',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'APPROVED',reason:'خروجی سلامت روابط برای هیئت مدیره',before:null,after:{classification:'CONFIDENTIAL',format:'فایل جدولی'},createdAt:ago(3,1),decidedAt:ago(3,0)},
      {id:'ap-2',entityType:'Report',entityId:'network',actionType:'EXPORT',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'APPROVED',reason:'خروجی شبکه برای جلسهٔ راهبردی',before:null,after:{classification:'RESTRICTED',format:'فایل جدولی'},createdAt:ago(3,4),decidedAt:ago(3,3)},
      {id:'ap-3',entityType:'Report',entityId:'risk',actionType:'EXPORT',organizationId:'org-1',requestedById:'u-2',decidedById:'u-1',status:'APPROVED',reason:'گزارش ریسک برای کمیتهٔ ریسک',before:null,after:{classification:'HIGHLY_CONFIDENTIAL',format:'فایل جدولی'},createdAt:ago(2,3),decidedAt:ago(2,2)},
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
      {id:'se-5',type:'EXPORT_CREATED',severity:'INFO',requestId:null,ipAddress:'10.0.0.1',userAgent:ua,entityType:'Report',entityId:'relationship-health',userId:'u-1',organizationId:'org-1',metadata:{exportType:'فایل جدولی',recordCount:8,approvalId:null},createdAt:ago(1,3)},
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
      {id:'abac-2',key:'deny-restricted-export',permissionKey:'مجوز خروجی گزارش',effect:'DENY',role:null,organizationId:null,department:null,maxDataClassification:'RESTRICTED',ownerOnly:false,subjectScope:'ALL',conditions:null,enabled:true,createdById:'u-1',createdAt:ago(110,3),updatedAt:ago(5,3)},
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
  return { status:'ok', service:'srip-api', mockVersion: DEMO_MOCK_VERSION, timestamp: new Date().toISOString(), dependencies:{
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
    {id:'ev-1',level:'ERROR',message:'اتصال به ردیس قطع شد؛ بازیابی خودکار پس از ۸۰۰ میلی‌ثانیه انجام شد',source:'redis-client',createdAt:at(2)},
    {id:'ev-2',level:'WARN',message:'تأخیر بالای صف اعلانات (۱۱ کار در انتظار بیش از ۳۰ ثانیه)',source:'queue-monitor',createdAt:at(9)},
    {id:'ev-3',level:'INFO',message:'اجرای زمان‌بندی‌شدهٔ بازپردازش تحلیل با موفقیت پایان یافت',source:'scheduler',createdAt:at(14)},
    {id:'ev-4',level:'INFO',message:'اعتبارسنجی توکن تازهٔ فراهم‌کنندهٔ هوش مصنوعی (قطعی) انجام شد',source:'ai-gateway',createdAt:at(26)},
    {id:'ev-5',level:'WARN',message:'۲ تلاش ورود ناموفق برای حساب سازمانی (آریا فناوری)',source:'auth',createdAt:at(41)},
    {id:'ev-6',level:'ERROR',message:'بازیابی ابردادهٔ سند شمارهٔ ۴۲ از فضای ذخیره‌سازی ناموفق بود (بازیابی در تلاش بعدی)',source:'documents-store',createdAt:at(55)},
    {id:'ev-7',level:'INFO',message:'پشتیبان‌گیری شبانه کامل شد (۵۲ گیگابایت، ۱:۰۲)',source:'backup',createdAt:at(240)},
    {id:'ev-8',level:'INFO',message:'میانگین تأخیر سرویس در ۵ دقیقهٔ اخیر: ۳۴ میلی‌ثانیه (صدک ۹۵: ۹۸ میلی‌ثانیه)',source:'metrics',createdAt:at(260)},
    {id:'ev-9',level:'DEBUG',message:'مسیر جستجو: رتبه‌بندی مجدد نتیجهٔ جستجوی «خط اعتباری» (۸ نتیجه در ۴۱ میلی‌ثانیه)',source:'search',createdAt:at(280)},
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

/* گردش‌کارهای پیش‌فرض: هر نهاد اصلی سیستم یک محرک خودکار دارد تا موتور اتوماسیون
   «همهٔ سامانه» را پوشش دهد — رابطه، جلسه، اقدام، تعهد، تعامل، فرصت، معرفی، پروژه، شخص، سازمان. */
const WFLOW_ENTITY_FA = { Relationship:'رابطه', Organization:'سازمان', Person:'شخص', Meeting:'جلسه', Commitment:'تعهد', Action:'اقدام', Opportunity:'فرصت', Project:'پروژه', Referral:'معرفی', Interaction:'تعامل', PublicMember:'عضو عموم', Publics:'عموم‌ها', Media:'رسانه' };
const WFLOW_TRIGGER_FA = { MANUAL:'دستی', RELATIONSHIP_CREATED:'ایجاد رابطه', RELATIONSHIP_UPDATED:'به‌روزرسانی رابطه', MEETING_CREATED:'ایجاد جلسه', MEETING_COMPLETED:'ثبت نتیجهٔ جلسه', ACTION_CREATED:'ایجاد اقدام', ACTION_UPDATED:'به‌روزرسانی اقدام', ACTION_COMPLETED:'انجام اقدام', COMMITMENT_CREATED:'ایجاد تعهد', COMMITMENT_UPDATED:'به‌روزرسانی تعهد', COMMITMENT_FULFILLED:'انجام تعهد', INTERACTION_CREATED:'ثبت تعامل', OPPORTUNITY_CREATED:'ایجاد فرصت', OPPORTUNITY_UPDATED:'به‌روزرسانی فرصت', OPPORTUNITY_WON:'پیروزی فرصت', OPPORTUNITY_LOST:'از دست رفتن فرصت', PROJECT_CREATED:'ایجاد پروژه', PROJECT_UPDATED:'به‌روزرسانی پروژه', REFERRAL_CREATED:'ایجاد معرفی', REFERRAL_UPDATED:'به‌روزرسانی معرفی', REFERRAL_ACCEPTED:'پذیرش معرفی', REFERRAL_COMPLETED:'انجام معرفی', REFERRAL_DECLINED:'رد معرفی', PERSON_CREATED:'ایجاد شخص', PERSON_UPDATED:'به‌روزرسانی شخص', ORGANIZATION_CREATED:'ایجاد سازمان', ORGANIZATION_UPDATED:'به‌روزرسانی سازمان', PUBLIC_MEMBER_ADDED:'افزودن عضو عموم', PUBLIC_STAGE_CHANGED:'تغییر مرحلهٔ عموم', PUBLIC_GAP_DETECTED:'کشف گپ عموم', PUBLIC_REVIEW_DUE:'سررسید بازبینی عموم', MEDIA_CREATED:'ثبت رسانه', STRATEGY_SCENARIO_CREATED:'ایجاد سناریوی راهبردی', STRATEGY_SIMULATED:'اجرای شبیه‌سازی راهبردی', STRATEGY_PREDICTED:'پیش‌بینی و توصیهٔ واکنشی', STRATEGY_IMPORT_COMPLETED:'ورود دادهٔ راهبردی' };

/* ====================== Publics (عموم‌ها) — کاتالوگ و قالب‌ها ====================== */
const PUBLIC_LINKAGE_FA = {"ENABLING": "فعال‌کننده", "FUNCTIONAL_INPUT": "کارکردی-ورودی", "FUNCTIONAL_OUTPUT": "کارکردی-خروجی", "NORMATIVE": "هنجاری", "DIFFUSED": "پراکنده"};
const PUBLIC_STAGE_FA = {"NON_PUBLIC": "غیرعموم", "LATENT": "نهفته", "AWARE": "آگاه", "ACTIVE": "فعال"};
const PUBLIC_STANCE_FA = {"KEY_PLAYER": "بازیگر کلیدی", "INFLUENCER": "تأثیرگذار", "SUPPORTER": "حامی", "OBSERVER": "ناظر"};
const PUBLIC_CATEGORY_FA = {"INTERNAL": "داخلی", "INSTITUTIONAL": "نهادی و حاکمیتی", "ACADEMIC": "علمی، دانشگاهی و پژوهشی", "ECONOMIC": "اقتصادی و سرمایه‌گذاری", "MEDIA": "رسانه‌ای و عمومی", "ECOSYSTEM": "اکوسیستم فناوری و صنعت"};
const PUBLIC_CATEGORY_ORDER = ["INTERNAL", "INSTITUTIONAL", "ACADEMIC", "ECONOMIC", "MEDIA", "ECOSYSTEM"];
const G=(id,cat,fa,link,smin,smax,stance,kanal,note='')=>({id,cat,fa,link,stage:[smin,smax],stance,kanal,note});
const PUBLICS_TEMPLATE_LIST = [
{ id:"HOLDING", fa:"هلدینگ و سرمایه‌گذاری چندبخشی", focus:["INTERNAL", "INSTITUTIONAL", "ACADEMIC", "ECONOMIC", "MEDIA", "ECOSYSTEM"], note:"نقشهٔ شروع برای هلدینگ‌های چندبخشی؛ پوشش حوزه‌های کاری در هر ۶ دسته (قابل تنظیم)", groups:[
    G("h-i1","INTERNAL","هیئت‌مدیره هلدینگ","ENABLING","ACTIVE","ACTIVE","KEY_PLAYER","گفت‌وگوی مستقیم و مستمر","تصمیم‌گیرنده نهایی؛ روایت هسته ابتدا اینجا تثبیت می‌شود"),
    G("h-i2","INTERNAL","مدیرعامل و مدیران ارشد اجرایی (مالی، فناوری و منابع انسانی)","ENABLING","ACTIVE","ACTIVE","KEY_PLAYER","اولین دریافت‌کنندگان هر پیام کلیدی","سخنگویان طبیعی پیام کلیدی سازمان"),
    G("h-i3","INTERNAL","مدیران‌عامل حوزه‌های کاری","ENABLING","AWARE","ACTIVE","KEY_PLAYER","برنامهٔ توانمندسازی و روایت مستقل حوزه","بزرگ‌ترین ریسک پراکندگی پیام"),
    G("h-i4","INTERNAL","مدیران میانی و روسای واحد هر حوزهٔ کاری","FUNCTIONAL_INPUT","LATENT","AWARE","INFLUENCER","هم‌راستاسازی پیام هسته","مجرای انتقال به صف مقدم"),
    G("h-i5","INTERNAL","کارکنان عملیاتی حوزه‌های کاری و زیرمجموعه‌ها","FUNCTIONAL_INPUT","LATENT","LATENT","SUPPORTER","روایت‌سازی داخلی و شبکهٔ سفیران","بزرگ‌ترین جمعیت عموم داخلی"),
    G("h-i6","INTERNAL","تیم روابط‌عمومی و ارتباطات داخلی هلدینگ","ENABLING","ACTIVE","ACTIVE","KEY_PLAYER","شفافیت کامل استراتژی","هم مجری نقشه است، هم خودش عموم داخلی است"),
    G("h-i7","INTERNAL","بنیان‌گذاران/شرکای مؤسس هر حوزهٔ کاری","ENABLING","ACTIVE","ACTIVE","KEY_PLAYER","نفوذ غیررسمی و حساسیت رسانه‌ای","وزن فراتر از رسمی؛ دیده نمی‌شوند اما حساس‌اند"),
    G("h-i8","INTERNAL","کمیته‌های تخصصی (سرمایه‌گذاری/ریسک/فناوری)","ENABLING","AWARE","ACTIVE","INFLUENCER","جریان مستمر تحولات تخصصی","مجرای پیام‌های تخصصی"),
    G("h-i9","INTERNAL","کارکنان شرکت‌های زیرمجموعهٔ هر حوزهٔ کاری (لایهٔ دوم)","FUNCTIONAL_INPUT","NON_PUBLIC","LATENT","OBSERVER","آگاهی از اکوسیستم بزرگ‌تر","هویت سازمانی با شرکت زیرمجموعه است"),
    G("h-i10","INTERNAL","کارکنان و مدیران سابق کلیدی (آلومنای)","DIFFUSED","LATENT","ACTIVE","INFLUENCER","برنامهٔ آف‌بوردینگ ارتباطی","سفیر غیررسمی یا منبع ریسک افشاگری"),
    G("h-n1","INSTITUTIONAL","شورای ملی راهبری هوش مصنوعی","ENABLING","AWARE","ACTIVE","KEY_PLAYER","گفت‌وگوی رسمی و حضور در جلسات","بالاترین رکن سیاست‌گذاری هوش مصنوعی"),
    G("h-n2","INSTITUTIONAL","ستاد توسعه فناوری و کاربردی‌سازی هوش مصنوعی","ENABLING","AWARE","ACTIVE","KEY_PLAYER","همکاری اجرایی و مشاوره","جانشین سازمان ملی هوش مصنوعی؛ کانال اصلی روزمره"),
    G("h-n3","INSTITUTIONAL","معاونت علمی، فناوری و اقتصاد دانش‌بنیان ریاست‌جمهوری","ENABLING","AWARE","AWARE","KEY_PLAYER","ترمینال رسمی حمایت","سرمایه و اعتبار هم‌زمان"),
    G("h-n4","INSTITUTIONAL","صندوق توسعهٔ ملی","ENABLING","LATENT","AWARE","INFLUENCER","گزارش مالی و برنامه","کانال مالی-اعتباری پروژه‌های هوش مصنوعی"),
    G("h-n5","INSTITUTIONAL","کمیسیون‌های تخصصی مجلس (صنایع/فرهنگی و لایحهٔ هوش مصنوعی)","ENABLING","AWARE","AWARE","KEY_PLAYER","لایحهٔ هوش مصنوعی و شنیده‌شدن","قانون‌گذار نهایی چارچوب فعالیت"),
    G("h-n6","INSTITUTIONAL","شورای عالی فضای مجازی","ENABLING","AWARE","AWARE","INFLUENCER","سیاست داده و زیرساخت دیجیتال","تنظیم‌گر بالادستی داده"),
    G("h-n7","INSTITUTIONAL","شورای عالی انقلاب فرهنگی","ENABLING","AWARE","AWARE","INFLUENCER","چارچوب‌های فرهنگی و محتوایی","مرجع محتوای مدل فارسی"),
    G("h-n8","INSTITUTIONAL","پژوهشگاه ارتباطات و فناوری اطلاعات","ENABLING","AWARE","AWARE","INFLUENCER","گزارش مشترک و کارشناسی","شریک راهبری فکری"),
    G("h-n9","INSTITUTIONAL","سازمان نظام صنفی رایانه‌ای","NORMATIVE","AWARE","AWARE","INFLUENCER","عضویت و هم‌صدایی صنفی","پل ارتباط با کل صنعت فناوری"),
    G("h-n10","INSTITUTIONAL","معاونت حقوقی ریاست‌جمهوری و پژوهشگاه قوهٔ قضاییه","ENABLING","LATENT","AWARE","INFLUENCER","چارچوب ریسک حقوقی","مسئولیت الگوریتمی و مالکیت داده"),
    G("h-ns1","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ انرژی (وزارت نیرو، وزارت نفت، سازمان بهره‌وری انرژی ایران)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns2","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ آموزش (وزارت آموزش‌وپرورش، وزارت علوم)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns3","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ خدمات اجتماعی (وزارت تعاون، کار و رفاه اجتماعی)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns4","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ سلامت (وزارت بهداشت، سازمان غذا و دارو)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns5","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ کشاورزی (وزارت جهاد کشاورزی)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns6","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ مالی (بانک مرکزی، سازمان بورس)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns7","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ مسکن (وزارت راه و شهرسازی)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns8","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ صنعت (وزارت صنعت، معدن و تجارت)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns9","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ اعتباری (بانک مرکزی، شورای پول و اعتبار)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns10","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ طراحی صنعتی (وزارت صنعت، معدن و تجارت، سازمان استاندارد ملی)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns11","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ لجستیک (وزارت راه و شهرسازی، سازمان راهداری)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-ns12","INSTITUTIONAL","تنظیم‌گر بخشی حوزهٔ محتوا (وزارت فرهنگ و ارشاد، شورای عالی انقلاب فرهنگی)","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی پایبندی و مکاتبهٔ رسمی","هر حوزهٔ کاری تنظیم‌گر بخشی مستقل دارد"),
    G("h-a1","ACADEMIC","دانشگاه صنعتی شریف (برق، رایانه و هوش مصنوعی)","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","همکاری پژوهشی و رویداد مشترک","برترین قطب رایانه و هوش مصنوعی کشور"),
    G("h-a2","ACADEMIC","دانشگاه تهران (ریاضی، آمار و علوم کامپیوتر)","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","پروژهٔ مشترک و سخنرانی تخصصی","بزرگ‌ترین دانشگاه جامع کشور"),
    G("h-a3","ACADEMIC","دانشگاه صنعتی امیرکبیر (پردازش زبان فارسی و امنیت)","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","همکاری پردازش زبان فارسی","مرجع تخصصی مدل زبانی فارسی"),
    G("h-a4","ACADEMIC","دانشگاه علم و صنعت ایران","NORMATIVE","AWARE","AWARE","INFLUENCER","پروژهٔ داده و پردازش زبان","پیوند صنعتی قوی"),
    G("h-a5","ACADEMIC","دانشگاه خواجه نصیرالدین طوسی","NORMATIVE","AWARE","AWARE","INFLUENCER","استخدام و کارآموزی","تربیت مستقیم متخصص هوش مصنوعی"),
    G("h-a6","ACADEMIC","دانشگاه‌های شهید بهشتی/فردوسی مشهد/شیراز","NORMATIVE","LATENT","AWARE","SUPPORTER","رویدادهای منطقه‌ای","پوشش ملی نه فقط تهرانی"),
    G("h-a7","ACADEMIC","مرکز نوآوری پردازش زبان طبیعی ","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","همکاری محتوایی و رسانه‌ای","شریک بالقوهٔ مستقیم حوزهٔ محتوا"),
    G("h-a8","ACADEMIC","هسته‌های پژوهشی یادگیری ماشین و پردازش تصویر","NORMATIVE","AWARE","ACTIVE","INFLUENCER","میزبانی محتوای مشترک","تولیدکنندهٔ اصلی محتوای فنی"),
    G("h-a9","ACADEMIC","انجمن کامپیوتر ایران ","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","حضور در رویدادهای تخصصی","نهاد علمی رسمی کشور"),
    G("h-a10","ACADEMIC","انجمن ملی هوش مصنوعی ایران","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","همکاری کنفرانس و نشریه","انجمن تخصصی با نشریهٔ علمی"),
    G("h-a11","ACADEMIC","انجمن رمز ایران ","NORMATIVE","AWARE","AWARE","INFLUENCER","همکاری امنیت هوش مصنوعی","نهاد تخصصی امنیت و رمزنگاری"),
    G("h-a12","ACADEMIC","انجمن‌های علمی دانشجویی علوم کامپیوتر","NORMATIVE","ACTIVE","ACTIVE","SUPPORTER","کارگاه و رویداد استعدادیابی","سریع‌ترین بازتاب‌دهندهٔ محتوا"),
    G("h-as1","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ سلامت (دانشگاه‌های علوم پزشکی تهران/بهشتی/ایران)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as2","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ کشاورزی (پردیس کشاورزی کرج، تربیت مدرس)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as3","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ انرژی (دانشگاه صنعت نفت، مهندسی انرژی شریف)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as4","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ مسکن (معماری و شهرسازی علم‌وصنعت/تهران)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as5","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ مالی و اعتباری (مدیریت تهران، علامه طباطبائی)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as6","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ آموزش (تربیت مدرس، پژوهشگاه مطالعات آموزش‌وپرورش)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as7","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ صنعت و طراحی صنعتی (مهندسی صنایع شریف/امیرکبیر؛ هنر تهران)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as8","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ لجستیک (مهندسی صنایع و حمل‌ونقل علم‌وصنعت)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as9","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ خدمات اجتماعی (علوم اجتماعی تهران/علامه)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-as10","ACADEMIC","دانشگاه تخصصی بخشی حوزهٔ محتوا (ارتباطات و رسانه علامه؛ پردازش زبان امیرکبیر)","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری پژوهشی بخشی","لایهٔ دانشگاهی متناظر هر حوزهٔ کاری"),
    G("h-e1","ECONOMIC","سازمان بورس و اوراق بهادار","ENABLING","AWARE","ACTIVE","INFLUENCER","گزارش‌های رسمی و پاسخ‌گویی","تنظیم‌گر اصلی بازار سرمایه"),
    G("h-e2","ECONOMIC","بورس اوراق بهادار تهران","ENABLING","LATENT","AWARE","INFLUENCER","اعتبار حضور در بازار","مرجع نمادین هلدینگ‌های بزرگ"),
    G("h-e3","ECONOMIC","فرابورس ایران (بازار نوآفرین)","ENABLING","AWARE","AWARE","KEY_PLAYER","پذیرش و تأمین مالی","تابلوی رشد و دانش‌بنیان"),
    G("h-e4","ECONOMIC","صندوق نوآوری و شکوفایی","ENABLING","AWARE","ACTIVE","KEY_PLAYER","پروندهٔ تسهیلات","منبع مالی دانش‌بنیان"),
    G("h-e5","ECONOMIC","رویداد «دوشنبه‌های استارتاپی»","FUNCTIONAL_INPUT","ACTIVE","ACTIVE","KEY_PLAYER","حضور و ارائه","جذب سرمایهٔ جسورانه"),
    G("h-e6","ECONOMIC","صندوق‌های پژوهش و فناوری خطرپذیر شرکتی ","FUNCTIONAL_INPUT","AWARE","ACTIVE","KEY_PLAYER","مذاکرهٔ سرمایه‌گذاری مشترک","روند رو به رشد سرمایه‌گذاری خطرپذیر شرکتی"),
    G("h-e7","ECONOMIC","صندوق‌های تخصصی سرمایه‌گذاری خطرپذیر","FUNCTIONAL_INPUT","AWARE","AWARE","KEY_PLAYER","داده و بازده","تأمین مالی مراحل اولیه"),
    G("h-e8","ECONOMIC","سرمایه‌گذاران فرشته ","FUNCTIONAL_INPUT","LATENT","AWARE","SUPPORTER","شبکه‌سازی","سرمایه‌گذاران فردی اولیه"),
    G("h-e9","ECONOMIC","اتاق بازرگانی، صنایع، معادن و کشاورزی ایران","NORMATIVE","AWARE","AWARE","INFLUENCER","عضویت و هم‌صدایی","بزرگ‌ترین نهاد رسمی بخش خصوصی"),
    G("h-e10","ECONOMIC","اتاق‌های بازرگانی استانی و تخصصی","NORMATIVE","LATENT","AWARE","SUPPORTER","تعامل منطقه‌ای","مرتبط با هر حوزهٔ کاری"),
    G("h-e11","ECONOMIC","بانک‌های تجاری و تخصصی (سرمایه‌گذاری/شرکتی)","FUNCTIONAL_INPUT","AWARE","AWARE","INFLUENCER","گزارش مالی و بانکداری شرکتی","تأمین مالی سنتی"),
    G("h-e12","ECONOMIC","صندوق‌های بازنشستگی و سرمایه‌گذاران نهادی بزرگ","FUNCTIONAL_INPUT","LATENT","AWARE","INFLUENCER","گزارش بلندمدت","افق چندساله"),
    G("h-m1","MEDIA","زومیت ","DIFFUSED","ACTIVE","ACTIVE","KEY_PLAYER","روایت تخصصی با دسترسی آزاد","بخش «اخبار فناوری ایران»"),
    G("h-m2","MEDIA","دیجیاتو ","DIFFUSED","ACTIVE","ACTIVE","KEY_PLAYER","روایت تخصصی","پیشگام رسانهٔ فناوری ایران"),
    G("h-m3","MEDIA","پیوست","DIFFUSED","ACTIVE","ACTIVE","KEY_PLAYER","تحلیل سیاست‌گذاری/رگولاتوری","رسانهٔ تخصصی فاوا"),
    G("h-mx1","MEDIA","اتحاد رسانه‌ای زومیت–دیجیاتو–پیوست","DIFFUSED","ACTIVE","ACTIVE","KEY_PLAYER","کانال متمرکز؛ پایش ریسک تک‌کاناله","تفاهم‌نامهٔ اسفند ۱۴۰۳"),
    G("h-m4","MEDIA","خبرگزاری ایسنا","DIFFUSED","AWARE","ACTIVE","INFLUENCER","اخبار علمی/دانشگاهی","پل دانشگاه↔رسانه"),
    G("h-m5","MEDIA","خبرگزاری مهر","DIFFUSED","AWARE","ACTIVE","INFLUENCER","گزارش سیاست‌گذاری هوش مصنوعی","پوشش حکمرانی هوش مصنوعی"),
    G("h-m6","MEDIA","خبرگزاری ایرنا","DIFFUSED","AWARE","AWARE","INFLUENCER","کانال رسمی بیانیه‌ها","خبرگزاری رسمی کشور"),
    G("h-m7","MEDIA","خبرگزاری فارس و تسنیم","DIFFUSED","AWARE","AWARE","INFLUENCER","پوشش اقتصادی/فناوری","مخاطب عمومی گسترده"),
    G("h-m8","MEDIA","تجمیع‌کننده‌های اخبار حکمرانی هوش مصنوعی","DIFFUSED","AWARE","AWARE","INFLUENCER","پروندهٔ تحلیلی مشترک","نقش خبرگزاری تحلیلی"),
    G("h-m9","MEDIA","روزنامهٔ دنیای اقتصاد","DIFFUSED","AWARE","ACTIVE","KEY_PLAYER","تحلیل سرمایه‌گذاری","مرجع تحلیل اقتصادی کشور"),
    G("h-m10","MEDIA","تجارت‌نیوز و اقتصادنیوز","DIFFUSED","AWARE","AWARE","INFLUENCER","اخبار استارتاپی و دانش‌بنیان","آنلاین اقتصادی فعال"),
    G("h-m11","MEDIA","رسانه‌های تخصصی بازار سرمایه (فرابورس/بورس)","DIFFUSED","LATENT","AWARE","INFLUENCER","پوشش بازار نوآفرین","اخبار بازار سرمایه"),
    G("h-m12","MEDIA","شبکهٔ خبر صدا و سیما","DIFFUSED","AWARE","AWARE","INFLUENCER","پوشش رویدادهای کلان","گسترده‌ترین لایهٔ غیرآنلاین"),
    G("h-m13","MEDIA","برنامه‌های اقتصادی صدا و سیما","DIFFUSED","LATENT","AWARE","INFLUENCER","مصاحبهٔ مدیران ارشد","دسترسی به عموم سنتی"),
    G("h-m14","MEDIA","خبرنگاران تخصصی فناوری و هوش مصنوعی","DIFFUSED","ACTIVE","ACTIVE","KEY_PLAYER","ثبت فردی در پایگاه روابط","دروازه‌بان روایت رسانه‌ای"),
    G("h-m15","MEDIA","تحلیل‌گران و کارشناسان مهمان برنامه‌های اقتصادی/فناوری","DIFFUSED","AWARE","ACTIVE","INFLUENCER","جلب اعتماد و تقویت","صدای معتبر ثالث"),
    G("h-m16","MEDIA","اینفلوئنسرهای فناوری و هوش مصنوعی (اینستاگرام/یوتیوب فارسی)","DIFFUSED","AWARE","ACTIVE","INFLUENCER","محتوای بصری، همکاری غیررسمی","مخاطب جوان و پرتعامل"),
    G("h-m17","MEDIA","حساب‌های تخصصی ایکس و لینکدین فارسی","DIFFUSED","ACTIVE","ACTIVE","INFLUENCER","پاسخ‌گویی سریع","سریع‌ترین واکنش تصمیم‌سازان"),
    G("h-m18","MEDIA","کانال‌های تلگرامی تخصصی اقتصاد و استارتاپی","DIFFUSED","AWARE","ACTIVE","INFLUENCER","توزیع سریع خبر","جامعهٔ فعال اکوسیستم"),
    G("h-m19","MEDIA","کاربران نهایی محصولات ۱۲ حوزهٔ کاری","DIFFUSED","LATENT","AWARE","SUPPORTER","تجربهٔ مستقیم و روایت خام","نزدیک‌ترین عموم عمومی"),
    G("h-m20","MEDIA","شهروندان علاقه‌مند عمومی به اخبار هوش مصنوعی","DIFFUSED","AWARE","AWARE","OBSERVER","محتوای ساده‌سازی‌شده","بدون تخصص فنی"),
    G("h-m21","MEDIA","عموم غیرمرتبط با فناوری ","DIFFUSED","NON_PUBLIC","NON_PUBLIC","OBSERVER","فقط پایش؛ آمادهٔ بحران","در بحران ملی ناگهان فعال می‌شود"),
    G("h-x1","ECOSYSTEM","پارک فناوری پردیس","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","حضور در رویدادهای بزرگ","میزبان رقابت بذرپاشان"),
    G("h-x2","ECOSYSTEM","کارخانهٔ نوآوری (شعبهٔ پردیس)","NORMATIVE","ACTIVE","ACTIVE","INFLUENCER","مشارکت در برنامه‌ها","نخستین کارخانهٔ نوآوری کشور"),
    G("h-x3","ECOSYSTEM","مرکز شتاب‌دهی و نوآوری جهش","NORMATIVE","AWARE","ACTIVE","INFLUENCER","رویداد مشترک شتاب‌دهی","زیرساخت متاورسی «جهش پارک»"),
    G("h-x4","ECOSYSTEM","پارک‌های علم و فناوری دانشگاهی (تهران/شریف)","NORMATIVE","AWARE","AWARE","SUPPORTER","همکاری واسط دانشگاه-صنعت","پل دانشگاه (دستهٔ ۳) و صنعت"),
    G("h-x5","ECOSYSTEM","آواتک ","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","شتاب‌دهی مشترک","وابسته به سرآوا؛ فعال از ۱۳۹۳"),
    G("h-x6","ECOSYSTEM","فینوا ","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","شتاب‌دهی فین‌تک","تخصصی حوزهٔ فین‌تک"),
    G("h-x7","ECOSYSTEM","شتاب‌دهنده‌های تخصصی عمودی (ماینتک و…)","NORMATIVE","AWARE","ACTIVE","INFLUENCER","همکاری عمودی","الگوی شتاب‌دهی بخشی"),
    G("h-x8","ECOSYSTEM","گروه سرمایه‌گذاری سرآوا","NORMATIVE","ACTIVE","ACTIVE","KEY_PLAYER","سرمایه‌گذاری مشترک","فعال‌ترین مجموعهٔ سرمایه‌گذاری استارتاپی"),
    G("h-x9","ECOSYSTEM","هلدینگ‌های سرمایه‌گذاری چندبخشی هم‌رده","NORMATIVE","AWARE","AWARE","INFLUENCER","اتحاد و هم‌صدایی","ساختار مشابه با تمرکز متفاوت"),
    G("h-x10","ECOSYSTEM","دیجی‌کالا","NORMATIVE","AWARE","ACTIVE","INFLUENCER","همکاری زیرساخت لجستیک/داده","بزرگ‌ترین پلتفرم تجارت الکترونیک"),
    G("h-x11","ECOSYSTEM","اسنپ ","NORMATIVE","AWARE","AWARE","INFLUENCER","همکاری دادهٔ جغرافیایی","هوش مصنوعی مسیریابی"),
    G("h-x12","ECOSYSTEM","دیوار","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری مسکن و کالا","بزرگ‌ترین پلتفرم آگهی"),
    G("h-x13","ECOSYSTEM","تپسی ","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری حمل‌ونقل هوشمند","رقیب مستقیم اسنپ"),
    G("h-x14","ECOSYSTEM","ابرآروان ","NORMATIVE","AWARE","ACTIVE","INFLUENCER","همکاری ابری و شبکهٔ توزیع محتوا","زیرساخت ابری داخلی"),
    G("h-x15","ECOSYSTEM","اپراتورهای مخابراتی دارای مرکز داده (همراه اول)","NORMATIVE","AWARE","AWARE","INFLUENCER","زیرساخت ملی","شبکه و محاسبات ابری ملی"),
    G("h-x16","ECOSYSTEM","انجمن تجارت الکترونیک (کمیسیون ریتیل‌تک)","NORMATIVE","AWARE","AWARE","INFLUENCER","عضویت و هم‌صدایی","نهاد صنفی رسمی کسب‌وکار دیجیتال"),
    G("h-x17","ECOSYSTEM","سازمان نظام صنفی رایانه‌ای","NORMATIVE","ACTIVE","ACTIVE","INFLUENCER","عضویت و کمیسیون‌ها","نهاد صنفی رسمی شرکت‌های فناوری"),
  ] },
{ id:"BANK", fa:"بانک و نهاد مالی", focus:["INTERNAL", "INSTITUTIONAL", "ECONOMIC", "MEDIA", "ECOSYSTEM"], note:"ویژهٔ بانک‌ها و نهادهای مالی؛ از تنظیم‌گر و سپرده‌گذار تا فین‌تک و سهام‌دار", groups:[
    G("b-i1","INTERNAL","هیئت‌مدیره و مدیران ارشد","ENABLING","ACTIVE","ACTIVE","KEY_PLAYER","گفت‌وگوی مستقیم",""),
    G("b-i2","INTERNAL","کارکنان شعبه و مشتری‌محور","FUNCTIONAL_INPUT","LATENT","LATENT","SUPPORTER","کانال داخلی",""),
    G("b-i3","INSTITUTIONAL","بانک مرکزی و شورای پول و اعتبار","ENABLING","AWARE","AWARE","KEY_PLAYER","مکاتبهٔ رسمی و مستندسازی",""),
    G("b-i4","INSTITUTIONAL","وزارت اقتصاد و نهادهای بالادستی","ENABLING","AWARE","AWARE","INFLUENCER","گزارش رسمی",""),
    G("b-e1","ECONOMIC","سپرده‌گذاران و مشتریان بزرگ","FUNCTIONAL_OUTPUT","AWARE","AWARE","KEY_PLAYER","خدمت و اعتماد",""),
    G("b-e2","ECONOMIC","مشتریان شرکتی و کسب‌وکارهای کوچک و متوسط","FUNCTIONAL_OUTPUT","AWARE","AWARE","KEY_PLAYER","رابط شرکتی",""),
    G("b-e3","ECONOMIC","نهادهای مالی و بازار سرمایه","ENABLING","AWARE","AWARE","INFLUENCER","گزارش عملکرد",""),
    G("b-m1","MEDIA","رسانهٔ اقتصادی و خبرگزاری‌ها","DIFFUSED","AWARE","AWARE","INFLUENCER","روایت اقتصادی",""),
    G("b-x1","ECOSYSTEM","فین‌تک‌ها و شرکت‌های دانش‌بنیان","NORMATIVE","AWARE","AWARE","INFLUENCER","همکاری و نظارت",""),
  ] },
{ id:"MANUFACTURER", fa:"تولیدی و صنعتی", focus:["INTERNAL", "INSTITUTIONAL", "ECONOMIC", "ACADEMIC", "MEDIA", "ECOSYSTEM"], note:"ویژهٔ شرکت‌های تولیدی و صنعتی؛ زنجیرهٔ تأمین، تنظیم‌گر و بازار", groups:[
    G("mf-i1","INTERNAL","کارکنان و مهندسان","FUNCTIONAL_INPUT","LATENT","LATENT","SUPPORTER","روایت‌سازی داخلی",""),
    G("mf-n1","INSTITUTIONAL","وزارت صنعت، معدن و تجارت و استاندارد ملی","ENABLING","AWARE","AWARE","KEY_PLAYER","مستندسازی و مجوز",""),
    G("mf-n2","INSTITUTIONAL","سازمان حفاظت محیط‌زیست","ENABLING","LATENT","AWARE","INFLUENCER","انطباق زیست‌محیطی",""),
    G("mf-s1","ECONOMIC","تأمین‌کنندگان مواد اولیه","FUNCTIONAL_INPUT","AWARE","ACTIVE","KEY_PLAYER","قرارداد و تأمین",""),
    G("mf-c1","ECONOMIC","مشتریان صنعتی و شبکهٔ توزیع","FUNCTIONAL_OUTPUT","AWARE","ACTIVE","KEY_PLAYER","کیفیت و تحویل",""),
    G("mf-a1","ACADEMIC","پژوهشکده‌های صنعتی و دانشگاه‌های فنی","NORMATIVE","LATENT","AWARE","SUPPORTER","همکاری تحقیق و توسعه",""),
    G("mf-m1","MEDIA","رسانهٔ صنعت و اقتصادی","DIFFUSED","AWARE","AWARE","INFLUENCER","روایت صنعتی",""),
    G("mf-x1","ECOSYSTEM","انجمن صنفی و رقبای هم‌راستا","NORMATIVE","AWARE","AWARE","INFLUENCER","هم‌صدایی صنفی",""),
  ] },
{ id:"SUPPLIER", fa:"تأمین‌کننده", focus:["ECONOMIC", "INSTITUTIONAL", "ECOSYSTEM", "MEDIA", "INTERNAL"], note:"ویژهٔ تأمین‌کنندگان؛ کارفرما، زنجیرهٔ تأمین و نهادهای صنعتی", groups:[
    G("sp-c1","ECONOMIC","مشتریان کلیدی صنعتی","FUNCTIONAL_OUTPUT","AWARE","ACTIVE","KEY_PLAYER","قرارداد و خدمت",""),
    G("sp-n1","INSTITUTIONAL","مراجع مجوز و استاندارد","ENABLING","AWARE","AWARE","KEY_PLAYER","مستندسازی",""),
    G("sp-e1","ECONOMIC","بانک و تأمین مالی","FUNCTIONAL_INPUT","LATENT","AWARE","INFLUENCER","گزارش مالی",""),
    G("sp-x1","ECOSYSTEM","اتحادیه و تأمین‌کنندگان هم‌رده","NORMATIVE","AWARE","AWARE","INFLUENCER","هم‌صدایی",""),
    G("sp-m1","MEDIA","رسانهٔ تخصصی صنعت","DIFFUSED","LATENT","AWARE","OBSERVER","پایش",""),
    G("sp-i1","INTERNAL","کارکنان و پیمانکاران تولید","FUNCTIONAL_INPUT","LATENT","LATENT","SUPPORTER","کانال داخلی",""),
  ] },
{ id:"CONSTRUCTION", fa:"ساختمانی و املاک", focus:["INSTITUTIONAL", "ECONOMIC", "MEDIA"], note:"ویژهٔ شرکت‌های ساختمانی، پیمانکاران و انبوه‌سازان", groups:[
    G("cs-n1","INSTITUTIONAL","شهرداری و راه‌وشهرسازی","ENABLING","AWARE","AWARE","KEY_PLAYER","مجوز و هماهنگی",""),
    G("cs-n2","INSTITUTIONAL","نظام مهندسی و مقررات ملی","ENABLING","AWARE","AWARE","INFLUENCER","انطباق",""),
    G("cs-c1","ECONOMIC","کارفرمایان و مالکان","FUNCTIONAL_OUTPUT","AWARE","ACTIVE","KEY_PLAYER","قرارداد و تحویل",""),
    G("cs-s1","ECONOMIC","پیمانکاران جزء و تأمین‌کنندگان مصالح","FUNCTIONAL_INPUT","AWARE","ACTIVE","KEY_PLAYER","زنجیرهٔ اجرا",""),
    G("cs-e1","ECONOMIC","بانک و صندوق مسکن","FUNCTIONAL_INPUT","LATENT","AWARE","INFLUENCER","تأمین مالی",""),
    G("cs-m1","MEDIA","رسانهٔ ساختمان و اقتصادی","DIFFUSED","LATENT","AWARE","OBSERVER","پایش",""),
    G("cs-p1","MEDIA","ساکنان و شهروندان محلی","DIFFUSED","NON_PUBLIC","LATENT","OBSERVER","پایش و شفافیت",""),
  ] },
{ id:"GOVERNMENT", fa:"دولتی و عمومی", focus:["MEDIA", "INSTITUTIONAL", "ECONOMIC", "ACADEMIC", "INTERNAL"], note:"ویژهٔ دستگاه‌های دولتی و عمومی؛ ذی‌نفعان حاکمیتی و افکار عمومی", groups:[
    G("gv-p1","MEDIA","شهروندان و ذی‌نفعان خدمت","FUNCTIONAL_OUTPUT","LATENT","AWARE","SUPPORTER","شفافیت و اطلاع‌رسانی",""),
    G("gv-m1","MEDIA","رسانهٔ ملی و خبرگزاری‌ها","DIFFUSED","AWARE","ACTIVE","KEY_PLAYER","روایت رسمی",""),
    G("gv-n1","INSTITUTIONAL","نهادهای بالادستی و قوهٔ قضاییه","ENABLING","AWARE","AWARE","KEY_PLAYER","هماهنگی رسمی",""),
    G("gv-e1","ECONOMIC","بخش خصوصی و اتاق بازرگانی","NORMATIVE","AWARE","AWARE","INFLUENCER","تعامل اقتصادی",""),
    G("gv-a1","ACADEMIC","مراکز پژوهشی و دانشگاه‌ها","NORMATIVE","AWARE","AWARE","INFLUENCER","پژوهش مشترک",""),
    G("gv-i1","INTERNAL","کارکنان و مدیران دستگاه","FUNCTIONAL_INPUT","LATENT","AWARE","SUPPORTER","روایت‌سازی داخلی",""),
  ] },
{ id:"TECHNOLOGY", fa:"فناوری و نرم‌افزار", focus:["INTERNAL", "ECOSYSTEM", "ACADEMIC", "ECONOMIC", "MEDIA", "INSTITUTIONAL"], note:"ویژهٔ شرکت‌های فناوری و نرم‌افزار؛ تیم محصول، سرمایه‌گذار و مشتری", groups:[
    G("tc-i1","INTERNAL","مهندسان و مدیران محصول","FUNCTIONAL_INPUT","AWARE","ACTIVE","KEY_PLAYER","روایت‌سازی داخلی",""),
    G("tc-x1","ECOSYSTEM","پارک‌ها، شتاب‌دهنده‌ها و بیگ‌تک‌ها","NORMATIVE","AWARE","ACTIVE","KEY_PLAYER","حضور و همکاری",""),
    G("tc-a1","ACADEMIC","دانشگاه‌ها و آزمایشگاه‌های هوش مصنوعی","NORMATIVE","AWARE","ACTIVE","KEY_PLAYER","همکاری پژوهشی",""),
    G("tc-e1","ECONOMIC","سرمایه‌گذاران و صندوق‌ها","FUNCTIONAL_INPUT","AWARE","AWARE","KEY_PLAYER","داده و بازده",""),
    G("tc-m1","MEDIA","رسانهٔ فنی و اینفلوئنسرها","DIFFUSED","AWARE","ACTIVE","INFLUENCER","روایت تخصصی",""),
    G("tc-n1","INSTITUTIONAL","نظام صنفی و تنظیم‌گر","ENABLING","AWARE","AWARE","INFLUENCER","مستندسازی",""),
    G("tc-c1","ECONOMIC","مشتریان و کاربران محصول","FUNCTIONAL_OUTPUT","AWARE","ACTIVE","KEY_PLAYER","تجربهٔ محصول",""),
  ] }
];
const PUBLICS_TEMPLATES = Object.fromEntries(PUBLICS_TEMPLATE_LIST.map(t => [t.id, t]));

const seedWorkflowDefs = () => {
  const t=(d,h)=>{const x=new Date(Date.now()-d*86400000);x.setHours(10-h,15,0,0);return x.toISOString();};
  return [
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
    {id:'wf-3',name:'تأیید دونفره و انتظار برای فرصت تازه',entityType:'Opportunity',organizationId:null,isActive:true,
     definition:{trigger:{type:'OPPORTUNITY_CREATED'},conditions:[{path:'opportunity.value',exists:true}],actions:[
       {type:'REQUEST_APPROVAL',payload:{title:'اجرای گردش کار ادامه یابد؟',note:'تأیید برای ادامهٔ خودکار مراحل بعدی (انتظار و اعلان پایانی) لازم است.'}},
       {type:'WAIT',minutes:1},
       {type:'CREATE_NOTIFICATION',title:'گردش کار فرصت کامل شد',body:'پس از تأیید و پایان مهلت انتظار، گردش کار «تأیید دونفره» به پایان رسید.',channel:'IN_APP',priority:'LOW'},
     ]},createdAt:t(3,5),updatedAt:t(3,5)},
    {id:'wf-4',name:'پیگیری خودکار پس از جلسه',entityType:'Meeting',organizationId:null,isActive:true,
     definition:{trigger:{type:'MEETING_CREATED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'پیگیری مصوبات جلسه (اقدام بعدی)',priority:'HIGH'},
       {type:'CREATE_NOTIFICATION',title:'جلسه ثبت شد و پیگیری ساخته شد',body:'گردش کار «پیگیری خودکار پس از جلسه» اجرا شد؛ اقدام بعدی برای این جلسه ساخته شد.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(8,2),updatedAt:t(8,2)},
    {id:'wf-5',name:'ثبت نتیجهٔ جلسه',entityType:'Meeting',organizationId:null,isActive:true,
     definition:{trigger:{type:'MEETING_COMPLETED'},conditions:[{path:'meeting.outcome',exists:true}],actions:[
       {type:'CREATE_COMMITMENT',description:'پیگیری نتیجهٔ ثبت‌شدهٔ جلسه (تعهد بعدی)',status:'OPEN',risk:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'نتیجه جلسه ثبت شد',body:'پس از ثبت نتیجهٔ جلسه، تعهد پیگیری به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(7,1),updatedAt:t(7,1)},
    {id:'wf-6',name:'بستن اقدام با تعهد',entityType:'Action',organizationId:null,isActive:true,
     definition:{trigger:{type:'ACTION_COMPLETED'},conditions:[],actions:[
       {type:'CREATE_COMMITMENT',description:'استمرار پس از اتمام اقدام (نتیجه و درس‌آموخته)',status:'OPEN',risk:'LOW'},
       {type:'CREATE_NOTIFICATION',title:'اقدام بسته شد',body:'اقدام به پایان رسید؛ گردش کار «بستن اقدام با تعهد» یک تعهد استمراری ساخت.',channel:'IN_APP',priority:'LOW'},
     ]},createdAt:t(5,2),updatedAt:t(5,2)},
    {id:'wf-7',name:'انجام تعهد → اعلان',entityType:'Commitment',organizationId:null,isActive:true,
     definition:{trigger:{type:'COMMITMENT_FULFILLED'},conditions:[],actions:[
       {type:'CREATE_NOTIFICATION',title:'تعهد انجام شد',body:'تعهد به وضعیت «انجام‌شده» رفت و این اعلان خودکار صادر شد.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(5,4),updatedAt:t(5,4)},
    {id:'wf-8',name:'پیگیری تعامل‌های مهم',entityType:'Interaction',organizationId:null,isActive:true,
     definition:{trigger:{type:'INTERACTION_CREATED'},conditions:[{path:'interaction.importance',equals:'HIGH'},{path:'interaction.followUpRequired',exists:true}],actions:[
       {type:'CREATE_ACTION',title:'پیگیری تعامل مهم',priority:'HIGH'},
       {type:'CREATE_NOTIFICATION',title:'تعامل مهم ثبت شد',body:'تعامل با اولویت زیاد ثبت شد؛ اقدام پیگیری به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'HIGH'},
     ]},createdAt:t(4,2),updatedAt:t(4,2)},
    {id:'wf-9',name:'خوش‌آمد و تکمیل پروفایل شخص',entityType:'Person',organizationId:null,isActive:true,
     definition:{trigger:{type:'PERSON_CREATED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'تکمیل پروفایل و آشنایی با شخص تازه',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'شخص تازه ثبت شد',body:'پروفایل شخص جدید ثبت شد؛ اقدام آشنایی به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'LOW'},
     ]},createdAt:t(6,5),updatedAt:t(6,5)},
    {id:'wf-10',name:'راستی‌آزمایی سازمان تازه',entityType:'Organization',organizationId:null,isActive:true,
     definition:{trigger:{type:'ORGANIZATION_CREATED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'راستی‌آزمایی و تکمیل پروفایل سازمان',priority:'HIGH'},
       {type:'CREATE_NOTIFICATION',title:'سازمان تازه ثبت شد',body:'پروفایل سازمان جدید ثبت شد؛ اقدام راستی‌آزمایی به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(6,6),updatedAt:t(6,6)},
    {id:'wf-11',name:'پذیرش معرفی → تعهد پیگیری',entityType:'Referral',organizationId:null,isActive:true,
     definition:{trigger:{type:'REFERRAL_UPDATED'},conditions:[{path:'referral.status',equals:'ACCEPTED'}],actions:[
       {type:'CREATE_COMMITMENT',description:'پیگیری معرفی پذیرفته‌شده (گام بعدی و نتیجه)',status:'OPEN',risk:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'معرفی پذیرفته شد',body:'پذیرش معرفی ثبت شد؛ تعهد پیگیری به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(3,2),updatedAt:t(3,2)},
    {id:'wf-12',name:'نتیجهٔ معرفی → فرصت تازه',entityType:'Referral',organizationId:null,isActive:true,
     definition:{trigger:{type:'REFERRAL_UPDATED'},conditions:[{path:'referral.status',equals:'COMPLETED'}],actions:[
       {type:'CREATE_NOTIFICATION',title:'معرفی به نتیجه رسید',body:'معرفی کامل شد؛ فرصت مشتق‌شده به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'MEDIUM'},
       {type:'CREATE_OPPORTUNITY',name:'فرصت حاصل از معرفی',sourceType:'REFERRAL',probability:60},
     ]},createdAt:t(3,3),updatedAt:t(3,3)},
    {id:'wf-13',name:'برنامه‌ریزی پروژه تازه',entityType:'Project',organizationId:null,isActive:true,
     definition:{trigger:{type:'PROJECT_CREATED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'برنامه‌ریزی گام‌های بعدی پروژه',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'پروژه تازه ثبت شد',body:'پروژه جدید ثبت شد؛ اقدام برنامه‌ریزی به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'LOW'},
     ]},createdAt:t(4,4),updatedAt:t(4,4)},
    {id:'wf-14',name:'پیروزی فرصت → درس‌آموخته',entityType:'Opportunity',organizationId:null,isActive:true,
     definition:{trigger:{type:'OPPORTUNITY_UPDATED'},conditions:[{path:'opportunity.status',equals:'WON'}],actions:[
       {type:'CREATE_NOTIFICATION',title:'فرصت به پیروزی رسید',body:'وضعیت فرصت به «برنده» تغییر کرد؛ این اعلان خودکار صادر شد.',channel:'IN_APP',priority:'HIGH'},
       {type:'CREATE_ACTION',title:'ثبت درس‌آموختهٔ فرصت برنده',priority:'MEDIUM'},
     ]},createdAt:t(2,1),updatedAt:t(2,1)},
    {id:'wf-15',name:'برنامهٔ تعامل با عضو تازهٔ عموم',entityType:'PublicMember',organizationId:null,isActive:true,
     definition:{trigger:{type:'PUBLIC_MEMBER_ADDED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'برنامهٔ تعامل با عموم تازه (کانال: گروه هدف)',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'عموم تازه ثبت شد',body:'عضو تازه به نقشهٔ عموم‌ها افزوده شد؛ اقدام تعامل به‌صورت خودکار ساخته شد.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(2,2),updatedAt:t(2,2)},
    {id:'wf-16',name:'تغییر مرحلهٔ عموم → اعلان راهبردی',entityType:'PublicMember',organizationId:null,isActive:true,
     definition:{trigger:{type:'PUBLIC_STAGE_CHANGED'},conditions:[],actions:[
       {type:'CREATE_NOTIFICATION',title:'مرحلهٔ عموم تغییر کرد',body:'مرحلهٔ بلوغ یک عموم تغییر کرد؛ بازبینی روایت و تعامل لازم است.',channel:'IN_APP',priority:'HIGH'},
     ]},createdAt:t(1,3),updatedAt:t(1,3)},
    {id:'wf-17',name:'شکاف عموم → برنامهٔ پوشش',entityType:'Publics',organizationId:null,isActive:true,
     definition:{trigger:{type:'PUBLIC_GAP_DETECTED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'برنامهٔ رفع شکاف عموم‌ها',priority:'HIGH'},
       {type:'CREATE_NOTIFICATION',title:'شکاف در نقشهٔ عموم‌ها',body:'شکاف (عموم کلیدیِ غایب یا عقب‌مانده) شناسایی شد؛ برنامهٔ پوشش ساخته شد.',channel:'IN_APP',priority:'HIGH'},
     ]},createdAt:t(1,1),updatedAt:t(1,1)},
    {id:'wf-18',name:'سررسید بازبینی عموم',entityType:'PublicMember',organizationId:null,isActive:true,
     definition:{trigger:{type:'PUBLIC_REVIEW_DUE'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'بازبینی دوره‌ای عموم (داده و موضع)',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'بازبینی عموم سررسید شد',body:'ارزیابی داده/موضع این عموم کهنه شده؛ بازبینی را انجام دهید.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(1,2),updatedAt:t(1,2)},
    {id:'wf-19',name:'رسانهٔ تازه → پایش روایت',entityType:'Media',organizationId:null,isActive:true,
     definition:{trigger:{type:'MEDIA_CREATED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'راه‌اندازی پایش رسانهٔ تازه',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'رسانهٔ تازه ثبت شد',body:'منبع رسانه‌ای تازه به فهرست رسانه‌ها افزوده شد؛ پایش روایت ساخته شد.',channel:'IN_APP',priority:'LOW'},
     ]},createdAt:t(1,4),updatedAt:t(1,4)},
    {id:'wf-20',name:'سناریوی راهبردی تازه → بازبینی',entityType:'Strategy',organizationId:null,isActive:true,
     definition:{trigger:{type:'STRATEGY_SCENARIO_CREATED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'بازبینی سناریوی راهبردی تازه',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'سناریوی راهبردی تازه ثبت شد',body:'سناریوی تازه در هاب تحلیل راهبردی ساخته شد؛ بازبینی و اجرای شبیه‌سازی لازم است.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(0,4),updatedAt:t(0,4)},
    {id:'wf-21',name:'شبیه‌سازی راهبردی → اطلاع‌رسانی',entityType:'Strategy',organizationId:null,isActive:true,
     definition:{trigger:{type:'STRATEGY_SIMULATED'},conditions:[],actions:[
       {type:'CREATE_NOTIFICATION',title:'شبیه‌سازی راهبردی کامل شد',body:'شبیه‌سازی تکراری سناریو اجرا شد؛ نتیجه در تب شبیه‌سازی قابل مشاهده است.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(0,3),updatedAt:t(0,3)},
    {id:'wf-22',name:'توصیهٔ واکنشی → اقدام',entityType:'Strategy',organizationId:null,isActive:true,
     definition:{trigger:{type:'STRATEGY_PREDICTED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'اقدام روی توصیهٔ واکنشی',priority:'HIGH'},
       {type:'CREATE_NOTIFICATION',title:'توصیهٔ واکنشی تازه',body:'پیش‌بینی حرکت رقیب و توصیهٔ بهترین پاسخ آماده شد؛ اقدام متناظر ساخته شد.',channel:'IN_APP',priority:'HIGH'},
     ]},createdAt:t(0,2),updatedAt:t(0,2)},
    {id:'wf-23',name:'ورود دادهٔ راهبردی → راستی‌آزمایی',entityType:'Strategy',organizationId:null,isActive:true,
     definition:{trigger:{type:'STRATEGY_IMPORT_COMPLETED'},conditions:[],actions:[
       {type:'CREATE_ACTION',title:'راستی‌آزمایی دادهٔ واردشده از پلتفرم خارجی',priority:'MEDIUM'},
       {type:'CREATE_NOTIFICATION',title:'ورود دادهٔ راهبردی انجام شد',body:'دادهٔ پلتفرم خارجی وارد و سناریو ساخته شد؛ راستی‌آزمایی عایدی‌ها لازم است.',channel:'IN_APP',priority:'MEDIUM'},
     ]},createdAt:t(0,1),updatedAt:t(0,1)},
  ];
};
function seedWorkflowStore(){
  if(!Array.isArray(DB.workflows)) DB.workflows=[];
  if(!Array.isArray(DB.workflowExecutions)) DB.workflowExecutions=[];
  if(!Array.isArray(DB.workflowApprovals)) DB.workflowApprovals=[];
  /* ارتقای نسخهٔ بذر: گردش‌کارهای تازه به فهرست موجود هم اضافه می‌شوند (بدون حذف دستی) */
  const seedVer=Number(DB.workflowSeedVersion||0);
  if(seedVer<3){
    const defs=seedWorkflowDefs();
    for(const w of defs){
      if(!DB.workflows.some(x=>x.id===w.id)) DB.workflows.push(w);
    }
    DB.workflowSeedVersion=3;
  }
}
/* ------------------------- Publics (عموم‌ها) — داده و موتور ------------------------- */
const PUBLIC_SECTORS = ['انرژی','آموزش','خدمات اجتماعی','سلامت','کشاورزی','مالی','مسکن','صنعت','اعتباری','طراحی صنعتی','لجستیک','محتوا'];
const pubTplById=(id)=>PUBLICS_TEMPLATES[id]??PUBLICS_TEMPLATES.HOLDING;
const pubGroup=(tplId,gid)=>(pubTplById(tplId).groups??[]).find(g=>g.id===gid)??null;
const pubByOrg=(orgId)=>(DB.publicsSelf??[]).find(x=>x.orgId===orgId)??null;
const PUB_STAGE_ORDER=['NON_PUBLIC','LATENT','AWARE','ACTIVE'];
/* گروه‌های مؤثر هر سازمان = الگو + بازنویسی‌های خودش + گروه‌های اختصاصی‌اش.
   فقط دسته‌ها مشترک‌اند؛ پوشش/شکاف/اعضا همیشه از همین فهرست ساخته می‌شوند. */
const pubEffectiveGroups=(orgId)=>{
  const self=pubByOrg(orgId);
  const tpl=pubTplById(self?.templateId??'HOLDING');
  const ovs={};
  for(const o of (DB.publicsGroupOverrides??[])) if(o.orgId===orgId) ovs[o.groupId]=o;
  const out=[];
  for(const g of (tpl.groups??[])){
    const o=ovs[g.id]??{};
    const link=o.link??g.link;
    out.push({id:g.id,cat:o.cat??g.cat,fa:o.fa??g.fa,link,linkage:link,
      stage:[o.smin??g.stage[0],o.smax??g.stage[1]],stance:o.stance??g.stance,
      kanal:o.kanal??g.kanal,note:o.note!==undefined?o.note:(g.note??''),
      source:'template',overridden:['fa','note','link','smin','smax','stance','kanal','cat'].some(k=>o[k]!==undefined),
      active:o.active!==false,templateNote:g.note??''});
  }
  for(const c of (DB.publicsCustomGroups??[]).filter(x=>x.orgId===orgId))
    out.push({id:c.id,cat:c.cat,fa:c.fa,link:c.link,linkage:c.link,stage:[c.smin,c.smax],stance:c.stance,
      kanal:c.kanal,note:c.note??'',source:'custom',overridden:false,active:true,templateNote:''});
  return out;
};
const pubEffGroup=(orgId,gid)=>(pubEffectiveGroups(orgId).find(g=>g.id===gid)??null);
const pubTemplateIdFor=(companyType)=>PUBLICS_TEMPLATES[companyType]?companyType:'OTHER';
const pubTerms=(orgId)=>{
  const self=pubByOrg(orgId); const tpl=pubTplById(self?.templateId??'HOLDING');
  return {self,tpl,members:(DB.publicsMembers??[]).filter(m=>m.orgId===orgId)};
};
function seedPublicsStore(){
  if(!DB.publicsCatalog){ DB.publicsCatalog={version:1,generatedAt:nowIso(),categories:PUBLIC_CATEGORY_ORDER.map(id=>({id,fa:PUBLIC_CATEGORY_FA[id]})),linkages:PUBLIC_LINKAGE_FA,stages:PUBLIC_STAGE_FA,stances:PUBLIC_STANCE_FA,templates:PUBLICS_TEMPLATES}; }
  if(!Array.isArray(DB.publicsSelf)) DB.publicsSelf=[];
  if(!Array.isArray(DB.publicsMembers)) DB.publicsMembers=[];
  if(!Array.isArray(DB.mediaStore)) DB.mediaStore=[];
  if(!Array.isArray(DB.publicsGroupOverrides)) DB.publicsGroupOverrides=[];
  if(!Array.isArray(DB.publicsCustomGroups)) DB.publicsCustomGroups=[];
  DB.publicsStats=DB.publicsStats??{gaps:{},stageMoves:[],generatedAt:null};
  /* دمو: هلدینگ آریا (هلدینگ چندبخشی، ۱۰۵ گروه) + آریا فناوری (شرکت نرم‌افزاری، ۷ گروه) — هر شرکت نقشهٔ خودش را دارد */
  if(!DB.publicsSelf.some(x=>x.orgId==='org-1')){
    DB.publicsSelf.push({orgId:'org-1',companyType:'HOLDING',templateId:'HOLDING',structure:{sectors:PUBLIC_SECTORS.slice(),subsidiaries:['org-2'],ownership:'PRIVATE'},missionTopic:'سرمایه‌گذاری پیشرو در فناوری‌های نوین کشور',reviewedAt:nowIso(),reviewIntervalDays:90,updatedBy:null});
  }
  if(!DB.publicsSelf.some(x=>x.orgId==='org-2')){
    DB.publicsSelf.push({orgId:'org-2',companyType:'TECHNOLOGY',templateId:'TECHNOLOGY',structure:{sectors:['فناوری'],subsidiaries:[],ownership:'PRIVATE'},missionTopic:'محصول نرم‌افزاری قابل اتکا برای هلدینگ و بازار',reviewedAt:nowIso(),reviewIntervalDays:90,updatedBy:null});
  }
  /* ─────────────────────────────────────────────────────────────────────
     دادهٔ اولیهٔ واقعی — هلدینگ پارس (سند عموم‌ها)
     خودشناسی: هلدینگ ۱۲ حوزهٔ کاری · هدف: مرجعیت هوش مصنوعی کشور
     بازبینی: فصلی (۹۰ روز) طبق توصیهٔ روش‌شناختی سند
     ───────────────────────────────────────────────────────────────────── */
  if(!DB.publicsSelf.some(x=>x.orgId==='org-pars')){
    DB.publicsSelf.push({
      orgId:'org-pars', companyType:'HOLDING', templateId:'HOLDING',
      structure:{
        sectors:PUBLIC_SECTORS.slice(), /* ۱۲ حوزه: انرژی…محتوا — دقیقاً سند */
        subsidiaries:Array.from({length:12},(_,i)=>`org-pars-${String(i+1).padStart(2,'0')}`),
        ownership:'PRIVATE',
      },
      missionTopic:'مرجعیت هوش مصنوعی کشور',
      reviewedAt:nowIso(), reviewIntervalDays:90, updatedBy:null,
    });
  }
  if(DB.mediaStore.length===0){
    DB.mediaStore.push(
      {id:'m-1',name:'زومیت',type:'TECH_MEDIA',url:'zoomit.ir',audience:'تخصصی فناوری',country:'ایران',note:'بخش «اخبار فناوری ایران» با پوشش سیاست‌گذاری هوش مصنوعی',createdAt:nowIso()},
      {id:'m-2',name:'دیجیاتو',type:'TECH_MEDIA',url:'digiato.com',audience:'تخصصی فناوری',country:'ایران',note:'بیش از ۱۰ سال؛ محصول، استارتاپ، سیاست‌گذاری',createdAt:nowIso()},
      {id:'m-3',name:'پیوست',type:'TECH_MEDIA',url:'peivast.com',audience:'تخصصی فاوا',country:'ایران',note:'تحلیل سیاست‌گذاری و رگولاتوری',createdAt:nowIso()},
      {id:'m-4',name:'دنیای اقتصاد',type:'ECONOMIC_MEDIA',url:'donya-e-eqtesad.com',audience:'اقتصادی',country:'ایران',note:'مرجع تحلیل سرمایه‌گذاری',createdAt:nowIso()},
      {id:'m-5',name:'خبرگزاری ایسنا',type:'NEWS_AGENCY',url:'isna.ir',audience:'عمومی/علمی',country:'ایران',note:'پل دانشگاه و رسانه؛ پوشش اخبار علمی',createdAt:nowIso()},
      {id:'m-6',name:'خبرگزاری ایرنا',type:'NEWS_AGENCY',url:'irna.ir',audience:'عمومی',country:'ایران',note:'خبرگزاری رسمی کشور؛ کانال بیانیه‌های رسمی',createdAt:nowIso()},
      /* رسانه‌های واقعی سند عموم‌ها (هلدینگ پارس — دستهٔ ۵) */
      {id:'m-7',name:'خبرگزاری مهر',type:'NEWS_AGENCY',url:'mehrnews.com',audience:'عمومی',country:'ایران',note:'پوشش فعال سیاست‌گذاری فناوری و گزارش‌های تحلیلی حکمرانی AI',createdAt:nowIso()},
      {id:'m-8',name:'خبرگزاری فارس',type:'NEWS_AGENCY',url:'farsnews.ir',audience:'عمومی',country:'ایران',note:'پوشش گسترده اقتصادی و فناوری با مخاطب وسیع',createdAt:nowIso()},
      {id:'m-9',name:'خبرگزاری تسنیم',type:'NEWS_AGENCY',url:'tasnimnews.com',audience:'عمومی',country:'ایران',note:'پوشش اقتصادی و فناوری با مخاطب وسیع',createdAt:nowIso()},
      {id:'m-10',name:'تجارت‌نیوز',type:'ECONOMIC_MEDIA',url:'tejaratnews.com',audience:'اقتصادی',country:'ایران',note:'پوشش فعال اخبار استارتاپی و دانش‌بنیان',createdAt:nowIso()},
      {id:'m-11',name:'اقتصادنیوز',type:'ECONOMIC_MEDIA',url:'eghtesadnews.com',audience:'اقتصادی',country:'ایران',note:'پوشش اخبار بازار سرمایه و دانش‌بنیان',createdAt:nowIso()},
      {id:'m-12',name:'شبکهٔ خبر صدا و سیما',type:'BROADCAST',url:'irib.ir',audience:'عمومی ملی',country:'ایران',note:'پخش تلویزیونی رویدادهای کلان؛ گسترده‌ترین لایهٔ افکار عمومی غیرآنلاین',createdAt:nowIso()},
      {id:'m-13',name:'برنامه‌های اقتصادی صدا و سیما',type:'BROADCAST',url:'irib.ir',audience:'عمومی سنتی',country:'ایران',note:'بستر معرفی مدیران ارشد به عمومی که رسانه‌های دیجیتال تخصصی را دنبال نمی‌کنند',createdAt:nowIso()},
    );
  }
  if(!DB.publicsMembers.some(m=>m.orgId==='org-1'||m.orgId==='org-2')){
    /* دمو غنی‌شده (فاز ۶/ADR-0009): نقشهٔ عموم‌ها با اعضای واقعیِ شش دسته.
       قواعد دقت: شناسه‌های ثابت (قابل ارجاع در تست) · بازبینی سررسیدشدهٔ عمدی (PM-TC-001) ·
       بازیگر کلیدیِ عقب‌ماندهٔ عمدی (PM-TC-007) · دستهٔ نهادیِ org-2 عمداً خالی (شکاف بحرانی). */
    const mk=(id,orgId,groupId,sourceType,sourceId,stage,power,interest,stance,linkage,note,reviewDays=90)=>({id,orgId,groupId,sourceType,sourceId,linkage,stage,power,interest,stance,note,assessedAt:new Date(Date.now()-7*86400000).toISOString(),reviewDue:new Date(Date.now()+reviewDays*86400000).toISOString()});
    const arr=[
      /* ── هلدینگ آریا (org-1 · الگوی HOLDING · ۱۰۵ گروه) ── */
      mk('PM-H-001','org-1','h-n1','organization','org-8','AWARE',85,65,'INFLUENCER','ENABLING','طرف مکاتبه در مجوزهای استانی هلدینگ'),
      mk('PM-H-002','org-1','h-e11','organization','org-3','AWARE',70,75,'INFLUENCER','FUNCTIONAL_INPUT','بانک عامل تسهیلات و ضمانت‌نامه‌های هلدینگ'),
      mk('PM-H-003','org-1','h-i3','organization','org-2','ACTIVE',70,90,'KEY_PLAYER','ENABLING','زیرمجموعهٔ فناور؛ مجری پروژه‌های نرم‌افزاری هلدینگ'),
      mk('PM-H-004','org-1','h-m1','media','m-1','ACTIVE',60,80,'KEY_PLAYER','DIFFUSED','رسانهٔ مرجع پوشش اخبار هلدینگ و زیرمجموعه‌ها'),
      mk('PM-H-005','org-1','h-i1','person','p-6','ACTIVE',95,95,'KEY_PLAYER','ENABLING','عضو دبیرخانهٔ هیئت‌مدیره؛ چشمِ داخل روایت هسته'),
      mk('PM-H-006','org-1','h-a1','organization','org-9','ACTIVE',80,85,'KEY_PLAYER','NORMATIVE','قطب اصلی استعداد و پژوهش برای همهٔ حوزه‌های هلدینگ'),
      mk('PM-H-007','org-1','h-a3','person','p-15','AWARE',65,70,'INFLUENCER','NORMATIVE','سرپرست آزمایشگاه پردازش زبان؛ شریک محتوایی بالقوه'),
      mk('PM-H-008','org-1','h-e1','organization','org-11','AWARE',75,60,'INFLUENCER','ENABLING','تنظیم‌گر بازار سرمایه؛ مسیر آتی عرضه'),
      mk('PM-H-009','org-1','h-ns6','organization','org-11','AWARE',75,65,'INFLUENCER','ENABLING','تنظیم‌گر اعتباری و مالی برای حوزه‌های هلدینگ'),
      mk('PM-H-010','org-1','h-e4','organization','org-12','ACTIVE',60,80,'KEY_PLAYER','ENABLING','منبع مالی دانش‌بنیان؛ پروندهٔ پلتفرم بانکداری در کارشناسی'),
      mk('PM-H-011','org-1','h-e9','organization','org-10','AWARE',55,60,'INFLUENCER','NORMATIVE','بزرگ‌ترین نهاد رسمی بخش خصوصی؛ کانال هم‌صدایی صنعت'),
      mk('PM-H-012','org-1','h-m2','media','m-2','ACTIVE',60,75,'KEY_PLAYER','DIFFUSED','رسانهٔ پیشگام فناوری؛ پوشش زیرمجموعهٔ فناور'),
      mk('PM-H-013','org-1','h-m4','media','m-5','AWARE',65,55,'INFLUENCER','DIFFUSED','پل دانشگاه↔رسانه برای اخبار علمی هلدینگ'),
      mk('PM-H-014','org-1','h-x1','person','p-14','ACTIVE',70,75,'KEY_PLAYER','NORMATIVE','چهرهٔ شناخته‌شدهٔ اکوسیستم فناوری؛ سفیر علمی هلدینگ'),
      /* ── آریا فناوری (org-2 · الگوی TECHNOLOGY · ۷ گروه) ── */
      mk('PM-TC-001','org-2','tc-i1','person','p-1','ACTIVE',70,90,'KEY_PLAYER','ENABLING','مدیر فروش محصول نرم‌افزاری',-26), /* بازبینی ۲۶ روز عقب افتاده (ماژول هشدار عموم‌ها) */
      mk('PM-TC-002','org-2','tc-m1','media','m-1','AWARE',60,55,'INFLUENCER','DIFFUSED','رسانهٔ مرجع نقد و معرفی محصول'),
      mk('PM-TC-003','org-2','tc-a1','organization','org-9','ACTIVE',80,85,'KEY_PLAYER','NORMATIVE','شریک پژوهشی پروژهٔ پردازش زبان (رابطهٔ r-9)'),
      mk('PM-TC-004','org-2','tc-a1','person','p-15','LATENT',65,70,'KEY_PLAYER','NORMATIVE','بازیگر کلیدیِ هنوز نهفته — نیازمند تعامل مستقیم (شکاف عقب‌مانده)'),
      mk('PM-TC-005','org-2','tc-e1','organization','org-12','ACTIVE',60,80,'KEY_PLAYER','ENABLING','منبع تأمین مالی دانش‌بنیان محصول'),
      mk('PM-TC-006','org-2','tc-c1','organization','org-5','ACTIVE',55,70,'INFLUENCER','FUNCTIONAL_INPUT','مشتری مرجع؛ گواهی زندهٔ بازار محصول'),
      mk('PM-TC-007','org-2','tc-x1','person','p-14','AWARE',70,65,'INFLUENCER','NORMATIVE','اتصال‌دهندهٔ اکوسیستم فناوری و دانشگاه'),
      mk('PM-TC-008','org-2','tc-i1','person','p-7','ACTIVE',65,80,'KEY_PLAYER','ENABLING','مدیر محصول؛ روایت فنی محصول از درون'),
      /* توجه: دستهٔ نهادی org-2 (tc-n1 — تنظیم‌گر حوزهٔ فناوری) عمداً بدون عضو مانده تا شکاف بحرانی
         (بازیگر کلیدیِ غایب) در دمو دیده شود؛ مسیر پیشنهادی از رابطهٔ r-11 (سازمان بورس) می‌آید. */
    ];
    DB.publicsMembers.push(...arr);
    // پیشنهاد پیوند/قدرت-علاقه با موتور فقط برای ورودی‌های بدون مقدار (بدون بازنویسی کاربر)
    for(const m of DB.publicsMembers){ const sug=pubSuggester(m); m.linkage=m.linkage??sug.linkage; m.stance=m.stance??sug.stance; }
  }
  /* اعضای عموم‌های هلدینگ پارس — نگاشت مستقیم نهادهای سند به گروه‌های قالب HOLDING.
     مقادیر سه‌لایه (پیوند/مرحله/قدرت-علاقه) از تحلیل سند؛ اعداد قدرت/علاقه همسو با
     خانهٔ ماتریس هر گروه. گروه‌های بدون نهادِ نام‌برده در سند (سرمایه‌گذار فرشته،
     خبرنگاران فردی، اینفلوئنسرها، بانک‌های بدون نام و…) عمداً خالی می‌مانند = شکاف واقعی. */
  if(!DB.publicsMembers.some(m=>m.orgId==='org-pars')){
    const P=(id,groupId,sourceType,sourceId,stage,power,interest,stance,linkage,note)=>({id,orgId:'org-pars',groupId,sourceType,sourceId,linkage,stage,power,interest,stance,note,assessedAt:nowIso(),reviewDue:new Date(Date.now()+90*86400000).toISOString()});
    DB.publicsMembers.push(
      /* ── دستهٔ ۱: عموم‌های داخلی ── */
      P('PM-P-001','h-i1','organization','org-pars','ACTIVE',95,95,'KEY_PLAYER','ENABLING','هیئت‌مدیرهٔ هلدینگ پارس — تصمیم‌گیرندگان نهایی استراتژی؛ روایت هسته ابتدا اینجا تثبیت می‌شود'),
      P('PM-P-002','h-i2','organization','org-pars','ACTIVE',90,92,'KEY_PLAYER','ENABLING','مدیرعامل و تیم C-level هلدینگ — سخنگویان طبیعی مرجعیت هوش مصنوعی؛ اولین دریافت‌کنندگان هر پیام کلیدی'),
      P('PM-P-003','h-i3','organization','org-pars-01','ACTIVE',72,90,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ انرژی — صاحب روایت مستقل حوزه'),
      P('PM-P-004','h-i3','organization','org-pars-02','AWARE',70,88,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ آموزش — صاحب روایت مستقل حوزه'),
      P('PM-P-005','h-i3','organization','org-pars-03','AWARE',68,86,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ خدمات اجتماعی'),
      P('PM-P-006','h-i3','organization','org-pars-04','ACTIVE',72,90,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ سلامت'),
      P('PM-P-007','h-i3','organization','org-pars-05','AWARE',68,86,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ کشاورزی'),
      P('PM-P-008','h-i3','organization','org-pars-06','ACTIVE',74,92,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ مالی'),
      P('PM-P-009','h-i3','organization','org-pars-07','AWARE',68,86,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ مسکن'),
      P('PM-P-010','h-i3','organization','org-pars-08','AWARE',70,88,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ صنعت'),
      P('PM-P-011','h-i3','organization','org-pars-09','AWARE',70,88,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ اعتباری'),
      P('PM-P-012','h-i3','organization','org-pars-10','AWARE',68,86,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ طراحی صنعتی'),
      P('PM-P-013','h-i3','organization','org-pars-11','AWARE',68,86,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ لجستیک'),
      P('PM-P-014','h-i3','organization','org-pars-12','ACTIVE',72,90,'KEY_PLAYER','ENABLING','مدیرعامل و تیم رهبری حوزهٔ محتوا — شریک طبیعی هدف مدل زبانی فارسی'),
      P('PM-P-015','h-i6','organization','org-pars','ACTIVE',85,95,'KEY_PLAYER','ENABLING','تیم روابط‌عمومی و ارتباطات داخلی هلدینگ — هم مجری نقشه‌برداری است، هم خودش عموم داخلی است'),
      P('PM-P-016','h-i8','organization','org-pars','AWARE',80,70,'INFLUENCER','ENABLING','کمیته‌های سرمایه‌گذاری، ریسک و فناوری هلدینگ — مجرای پیام‌های تخصصی'),
      /* ── دستهٔ ۲الف: نهادهای سیاست‌گذاری هوش مصنوعی ── */
      P('PM-P-020','h-n1','organization','org-inst-01','AWARE',95,70,'KEY_PLAYER','ENABLING','بالاترین رکن سیاست‌گذاری هوش مصنوعی؛ حضور پارس در گفت‌وگو با این شورا مستقیماً به ادعای مرجعیت اعتبار می‌دهد'),
      P('PM-P-021','h-n2','organization','org-inst-02','AWARE',88,72,'KEY_PLAYER','ENABLING','جانشین سازمان ملی هوش مصنوعی؛ کانال اصلی تعامل روزمره — نقش محوری در پیش‌نویس لایحه'),
      P('PM-P-022','h-n3','organization','org-inst-03','AWARE',90,60,'KEY_PLAYER','ENABLING','مرجع اصلی حمایت از شرکت‌های دانش‌بنیان — سرمایه و اعتبار هم‌زمان'),
      P('PM-P-023','h-n4','organization','org-inst-04','LATENT',82,50,'INFLUENCER','ENABLING','کانال مالی-اعتباری پروژه‌های هوش مصنوعی — مرتبط با حوزه‌های مالی و اعتباری'),
      P('PM-P-024','h-n5','organization','org-inst-05','AWARE',92,55,'KEY_PLAYER','ENABLING','قانون‌گذار نهایی — روند تصویب لایحهٔ ۱۱ فصلی چارچوب فعالیت آینده را تعیین می‌کند'),
      P('PM-P-025','h-n6','organization','org-inst-06','AWARE',88,45,'INFLUENCER','ENABLING','تنظیم‌گر بالادستی حوزهٔ داده و زیرساخت دیجیتال — اثر مستقیم بر مدل‌های زبانی'),
      P('PM-P-026','h-n7','organization','org-inst-07','AWARE',86,48,'INFLUENCER','ENABLING','مرجع تأیید محتوای مدل زبانی و دانش‌پایهٔ فارسی — حوزهٔ محتوا مستقیماً درگیر است'),
      P('PM-P-027','h-n8','organization','org-inst-08','AWARE',70,62,'INFLUENCER','ENABLING','شریک راهبری فکری بالقوه؛ کانال معتبر انتشار گزارش‌های مشترک'),
      P('PM-P-028','h-n9','organization','org-inst-09','AWARE',65,68,'INFLUENCER','NORMATIVE','پل ارتباطی میان پارس و کل صنعت فناوری کشور؛ کانال تأثیر غیرمستقیم بر سیاست‌گذاری'),
      P('PM-P-029','h-n10','organization','org-inst-10','LATENT',80,42,'INFLUENCER','ENABLING','بُعد حقوقی/قضایی حاکمیت هوش مصنوعی — مسئولیت الگوریتمی و مالکیت داده'),
      /* ── دستهٔ ۲ب: تنظیم‌گران بخشیِ ۱۲ حوزه ── */
      P('PM-P-030','h-ns1','organization','org-reg-energy','AWARE',82,50,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ انرژی'),
      P('PM-P-031','h-ns1','organization','org-reg-oil','AWARE',80,48,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ انرژی'),
      P('PM-P-032','h-ns1','organization','org-reg-energy-eff','AWARE',62,45,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ انرژی'),
      P('PM-P-033','h-ns2','organization','org-reg-edu','AWARE',78,48,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ آموزش'),
      P('PM-P-034','h-ns2','organization','org-reg-science','AWARE',76,50,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ آموزش'),
      P('PM-P-035','h-ns3','organization','org-reg-welfare','AWARE',72,45,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ خدمات اجتماعی'),
      P('PM-P-036','h-ns4','organization','org-reg-health','AWARE',80,48,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ سلامت'),
      P('PM-P-037','h-ns4','organization','org-reg-fda','AWARE',70,44,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ سلامت'),
      P('PM-P-038','h-ns5','organization','org-reg-agri','AWARE',72,45,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ کشاورزی'),
      P('PM-P-039','h-ns6','organization','org-reg-cbi','AWARE',88,52,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ مالی'),
      P('PM-P-040','h-ns6','organization','org-11','AWARE',85,50,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ مالی (سازمان بورس)'),
      P('PM-P-041','h-ns7','organization','org-reg-roads','AWARE',74,46,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ مسکن'),
      P('PM-P-042','h-ns8','organization','org-reg-industry','AWARE',78,48,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ صنعت'),
      P('PM-P-043','h-ns9','organization','org-reg-cbi','AWARE',88,50,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ اعتباری (بانک مرکزی و شورای پول و اعتبار)'),
      P('PM-P-044','h-ns10','organization','org-reg-industry','AWARE',76,46,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ طراحی صنعتی'),
      P('PM-P-045','h-ns10','organization','org-reg-standard','AWARE',68,45,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ طراحی صنعتی (استاندارد)'),
      P('PM-P-046','h-ns11','organization','org-reg-roads','AWARE',72,45,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ لجستیک'),
      P('PM-P-047','h-ns11','organization','org-reg-transport','AWARE',66,44,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ لجستیک'),
      P('PM-P-048','h-ns12','organization','org-reg-culture','AWARE',76,48,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ محتوا'),
      P('PM-P-049','h-ns12','organization','org-inst-07','AWARE',86,50,'INFLUENCER','ENABLING','تنظیم‌گر بخشی حوزهٔ محتوا (شورای عالی انقلاب فرهنگی)'),
      /* ── دستهٔ ۳: علمی-دانشگاهی ── */
      P('PM-P-050','h-a1','organization','org-9','ACTIVE',85,80,'KEY_PLAYER','NORMATIVE','دانشگاه صنعتی شریف — برترین قطب کامپیوتر/AI کشور؛ میزبان دائمی CSICC؛ اولویت اول همکاری علمی'),
      P('PM-P-051','h-a2','organization','org-ac-tehran','ACTIVE',80,75,'KEY_PLAYER','NORMATIVE','بزرگ‌ترین و معتبرترین دانشگاه جامع — دسترسی هم به اساتید ارشد هم جامعهٔ دانشجویی فعال'),
      P('PM-P-052','h-a3','organization','org-ac-amirkabir','ACTIVE',78,78,'KEY_PLAYER','NORMATIVE','مرجع تخصصی NLP فارسی — میزبان NLPIC و کنفرانس ISCISC؛ شریک طبیعی حوزهٔ محتوا'),
      P('PM-P-053','h-a4','organization','org-ac-iust','AWARE',65,62,'INFLUENCER','NORMATIVE','قطب پژوهشی با پیوند صنعتی قوی — منبع داده اسمی و NLP فارسی (نمونه: PEYMA)'),
      P('PM-P-054','h-a5','organization','org-ac-kntu','AWARE',60,60,'INFLUENCER','NORMATIVE','سه گروه سخت‌افزار/نرم‌افزار/هوش مصنوعی — منبع بالقوه استخدام حوزه‌های فنی'),
      P('PM-P-055','h-a6','organization','org-ac-sbu','AWARE',55,55,'INFLUENCER','NORMATIVE','پوشش جغرافیایی خارج از تهران — روایت مرجعیت ملی، نه صرفاً تهرانی'),
      P('PM-P-056','h-a6','organization','org-ac-ferdowsi','AWARE',52,55,'INFLUENCER','NORMATIVE','پوشش جغرافیایی مشهد — روایت مرجعیت ملی'),
      P('PM-P-057','h-a6','organization','org-ac-shiraz','AWARE',52,55,'INFLUENCER','NORMATIVE','پوشش جغرافیایی شیراز — روایت مرجعیت ملی'),
      P('PM-P-058','h-a7','organization','org-ac-nlpic','AWARE',70,75,'KEY_PLAYER','NORMATIVE','مرکز تخصصی NLP فارسی — شریک بالقوهٔ مستقیم پروژه‌های محتوایی و GEO فارسی'),
      P('PM-P-059','h-a8','organization','org-ac-tehran','AWARE',55,65,'SUPPORTER','NORMATIVE','هستهٔ پژوهشی یادگیری ماشین و پردازش تصویر دانشگاه تهران — میزبان محتوای مشترک'),
      P('PM-P-060','h-a9','organization','org-ac-csi','AWARE',60,70,'KEY_PLAYER','NORMATIVE','انجمن کامپیوتر ایران — برگزارکنندهٔ CSICC با محورهای سیستم‌های هوشمند و علم داده'),
      P('PM-P-061','h-a10','organization','org-ac-ai','AWARE',62,72,'KEY_PLAYER','NORMATIVE','انجمن ملی هوش مصنوعی — نشریه و کمیته‌های تخصصی؛ پوشش صنعت/سلامت/انرژی/کشاورزی/مالی'),
      P('PM-P-062','h-a11','organization','org-ac-iscisc','AWARE',55,60,'INFLUENCER','NORMATIVE','انجمن رمز ایران — امنیت و رمزنگاری؛ AI، بلاک‌چین و رایانش کوانتومی'),
      P('PM-P-063','h-a12','organization','org-ac-tehran','ACTIVE',35,75,'SUPPORTER','NORMATIVE','انجمن‌های علمی دانشجویی (نمونهٔ محوری: انجمن علمی علوم کامپیوتر دانشگاه تهران) — کانال کارگاه و استعدادیابی'),
      /* دانشگاه‌های تخصصی بخشی (ت) */
      P('PM-P-064','h-as1','organization','org-ac-med-tehran','AWARE',65,58,'INFLUENCER','NORMATIVE','دانشگاه تخصصی بخشی حوزهٔ سلامت'),
      P('PM-P-065','h-as2','organization','org-ac-tehran','AWARE',58,55,'INFLUENCER','NORMATIVE','پردیس کشاورزی و منابع طبیعی کرج — حوزهٔ کشاورزی'),
      P('PM-P-066','h-as2','organization','org-ac-tarbiat','AWARE',56,55,'INFLUENCER','NORMATIVE','گروه کشاورزی دانشگاه تربیت مدرس — حوزهٔ کشاورزی'),
      P('PM-P-067','h-as3','organization','org-ac-petrol','AWARE',60,56,'INFLUENCER','NORMATIVE','دانشگاه صنعت نفت — حوزهٔ انرژی'),
      P('PM-P-068','h-as3','organization','org-9','AWARE',70,58,'INFLUENCER','NORMATIVE','دانشکدهٔ مهندسی انرژی دانشگاه شریف — حوزهٔ انرژی'),
      P('PM-P-069','h-as4','organization','org-ac-iust','AWARE',56,52,'INFLUENCER','NORMATIVE','دانشکدهٔ معماری و شهرسازی دانشگاه علم و صنعت — حوزهٔ مسکن'),
      P('PM-P-070','h-as4','organization','org-ac-tehran','AWARE',58,52,'INFLUENCER','NORMATIVE','دانشکدهٔ معماری دانشگاه تهران — حوزهٔ مسکن'),
      P('PM-P-071','h-as5','organization','org-ac-tehran','AWARE',60,55,'INFLUENCER','NORMATIVE','دانشکدهٔ مدیریت دانشگاه تهران — حوزهٔ مالی و اعتباری'),
      P('PM-P-072','h-as5','organization','org-ac-allameh','AWARE',56,55,'INFLUENCER','NORMATIVE','گروه اقتصاد و مالی علامه طباطبائی — حوزهٔ مالی و اعتباری'),
      P('PM-P-073','h-as6','organization','org-ac-tarbiat','AWARE',54,54,'INFLUENCER','NORMATIVE','گروه علوم تربیتی تربیت مدرس — حوزهٔ آموزش'),
      P('PM-P-074','h-as6','organization','org-ac-edu-research','AWARE',52,56,'INFLUENCER','NORMATIVE','پژوهشگاه مطالعات آموزش و پرورش — حوزهٔ آموزش'),
      P('PM-P-075','h-as7','organization','org-9','AWARE',70,56,'INFLUENCER','NORMATIVE','دانشکدهٔ مهندسی صنایع دانشگاه شریف — حوزهٔ صنعت و طراحی صنعتی'),
      P('PM-P-076','h-as7','organization','org-ac-amirkabir','AWARE',62,55,'INFLUENCER','NORMATIVE','دانشکدهٔ مهندسی صنایع امیرکبیر — حوزهٔ صنعت و طراحی صنعتی'),
      P('PM-P-077','h-as7','organization','org-ac-art','AWARE',48,58,'SUPPORTER','NORMATIVE','دانشکدهٔ هنرهای کاربردی (طراحی صنعتی) دانشگاه هنر تهران'),
      P('PM-P-078','h-as8','organization','org-ac-iust','AWARE',56,50,'INFLUENCER','NORMATIVE','دانشکدهٔ مهندسی صنایع و سیستم‌های حمل‌ونقل علم و صنعت — حوزهٔ لجستیک'),
      P('PM-P-079','h-as9','organization','org-ac-tehran','AWARE',54,52,'INFLUENCER','NORMATIVE','دانشکدهٔ علوم اجتماعی دانشگاه تهران — حوزهٔ خدمات اجتماعی'),
      P('PM-P-080','h-as9','organization','org-ac-allameh','AWARE',52,52,'INFLUENCER','NORMATIVE','دانشکدهٔ علوم اجتماعی علامه طباطبائی — حوزهٔ خدمات اجتماعی'),
      P('PM-P-081','h-as10','organization','org-ac-allameh','AWARE',56,58,'INFLUENCER','NORMATIVE','دانشکدهٔ علوم ارتباطات و رسانهٔ علامه طباطبائی — حوزهٔ محتوا'),
      P('PM-P-082','h-as10','organization','org-ac-nlpic','AWARE',70,62,'INFLUENCER','NORMATIVE','مرکز نوآوری پردازش زبان طبیعی امیرکبیر — حوزهٔ محتوا'),
      /* ── دستهٔ ۴: اقتصادی و سرمایه‌گذاری ── */
      P('PM-P-090','h-e1','organization','org-11','AWARE',85,60,'INFLUENCER','ENABLING','تنظیم‌گر اصلی بازار سرمایه — صدور مجوز و نظارت بر عرضهٔ آتی سهام'),
      P('PM-P-091','h-e2','organization','org-eco-tse','AWARE',70,45,'INFLUENCER','ENABLING','بازار اصلی سهام — مرجع نمادین حضور در بازار سرمایه'),
      P('PM-P-092','h-e3','organization','org-eco-ifb','AWARE',72,55,'INFLUENCER','ENABLING','بازار نوآفرین با تابلوهای «رشد» و «دانش‌بنیان» — پذیرش ساده‌تر برای شرکت‌های نوآور'),
      P('PM-P-093','h-e4','organization','org-12','AWARE',75,70,'KEY_PLAYER','ENABLING','نهاد حمایتی تأمین منابع توسعهٔ فناوری و تجاری‌سازی (مادهٔ ۵ قانون حمایت دانش‌بنیان)'),
      P('PM-P-094','h-e5','organization','org-12','ACTIVE',55,80,'KEY_PLAYER','FUNCTIONAL_INPUT','رویداد «دوشنبه‌های استارتاپی» برگزارشده توسط صندوق نوآوری — حضور VCها و CVCها'),
      P('PM-P-095','h-e6','organization','org-eco-cvc-kerman','AWARE',60,65,'INFLUENCER','FUNCTIONAL_INPUT','صندوق پژوهش و فناوری خطرپذیر کرمان‌موتور — نمونهٔ واقعی روند CVC صنعتی ایران'),
      P('PM-P-096','h-e7','organization','org-eco-vc-pasargad','AWARE',58,68,'INFLUENCER','FUNCTIONAL_INPUT','صندوق تخصصی سرمایه‌گذاری خطرپذیر — فعال در مراحل اولیه و رشد'),
      P('PM-P-097','h-e9','organization','org-eco-chamber-ir','AWARE',65,55,'INFLUENCER','NORMATIVE','بزرگ‌ترین نهاد رسمی بخش خصوصی — پوشش تقریباً همهٔ حوزه‌های ۱۲گانه'),
      P('PM-P-098','h-e10','organization','org-10','AWARE',50,60,'SUPPORTER','NORMATIVE','اتاق بازرگانی تهران — نمونهٔ الگوی اتاق‌های استانی و تخصصی'),
      /* ── دستهٔ ۵: رسانه‌ای و عمومی ── */
      P('PM-P-100','h-m1','media','m-1','ACTIVE',60,80,'KEY_PLAYER','DIFFUSED','زومیت — پرمخاطب‌ترین رسانهٔ فناوری؛ پوشش مستمر سیاست‌گذاری AI و اقتصاد دیجیتال'),
      P('PM-P-101','h-m2','media','m-2','ACTIVE',58,75,'KEY_PLAYER','DIFFUSED','دیجیاتو — پیشگام رسانه‌های فناوری با بیش از ۱۰ سال سابقه'),
      P('PM-P-102','h-m3','media','m-3','ACTIVE',55,78,'KEY_PLAYER','DIFFUSED','پیوست — تمرکز ویژه بر تحلیل سیاست‌گذاری و رگولاتوری فاوا'),
      P('PM-P-103','h-m4','media','m-5','AWARE',65,55,'INFLUENCER','DIFFUSED','ایسنا — پل طبیعی بین عموم دانشگاهی و رسانه‌ای'),
      P('PM-P-104','h-m5','media','m-7','AWARE',60,52,'INFLUENCER','DIFFUSED','مهر — پوشش فعال سیاست‌گذاری فناوری و گزارش‌های تحلیلی حکمرانی AI'),
      P('PM-P-105','h-m6','media','m-6','AWARE',68,45,'INFLUENCER','DIFFUSED','ایرنا — خبرگزاری رسمی؛ کانال بیانیه‌های سطح‌بالای هلدینگ'),
      P('PM-P-106','h-m7','media','m-8','AWARE',62,40,'INFLUENCER','DIFFUSED','فارس — پوشش گسترده اقتصادی و فناوری با مخاطب وسیع'),
      P('PM-P-107','h-m7','media','m-9','AWARE',60,40,'INFLUENCER','DIFFUSED','تسنیم — پوشش گسترده اقتصادی و فناوری با مخاطب وسیع'),
      P('PM-P-108','h-m8','media','m-1','AWARE',58,70,'KEY_PLAYER','DIFFUSED','زومیت/دیجیاتو در نقش تجمیع‌کنندهٔ اخبار حکمرانی AI؛ همراه اتحاد رسانه‌ای زومیت–دیجیاتو–پیوست (تفاهم‌نامهٔ اسفند ۱۴۰۳)'),
      P('PM-P-109','h-m9','media','m-4','AWARE',70,48,'INFLUENCER','DIFFUSED','دنیای اقتصاد — معتبرترین روزنامهٔ تخصصی اقتصادی؛ مرجع تحلیل عموم اقتصادی'),
      P('PM-P-110','h-m10','media','m-10','AWARE',55,58,'INFLUENCER','DIFFUSED','تجارت‌نیوز — پوشش فعال اخبار استارتاپی و دانش‌بنیان'),
      P('PM-P-111','h-m10','media','m-11','AWARE',54,58,'INFLUENCER','DIFFUSED','اقتصادنیوز — پوشش اخبار بازار سرمایه و دانش‌بنیان'),
      P('PM-P-112','h-m12','media','m-12','AWARE',75,35,'INFLUENCER','DIFFUSED','شبکهٔ خبر صدا و سیما — رسیدن به گسترده‌ترین لایهٔ افکار عمومی غیرآنلاین'),
      P('PM-P-113','h-m13','media','m-13','AWARE',60,40,'INFLUENCER','DIFFUSED','برنامه‌های اقتصادی صدا و سیما — معرفی مدیران ارشد به عموم سنتی'),
      /* ── دستهٔ ۶: اکوسیستم فناوری و صنعت ── */
      P('PM-P-120','h-x1','organization','org-ecx-pardis','AWARE',70,72,'KEY_PLAYER','NORMATIVE','پارک فناوری پردیس — میزبان رقابت بذرپاشان و رویدادهای بزرگ اکوسیستمی'),
      P('PM-P-121','h-x2','organization','org-ecx-innofactory','AWARE',58,60,'INFLUENCER','NORMATIVE','نخستین کارخانهٔ نوآوری کشور — میزبان اولین شتاب‌دهنده‌ها'),
      P('PM-P-122','h-x3','organization','org-ecx-jahesh','AWARE',55,58,'INFLUENCER','NORMATIVE','برگزارکنندهٔ مشترک رویدادهای شتاب‌دهی با پردیس؛ زیرساخت متاورسی جهش‌پارک'),
      P('PM-P-123','h-x4','organization','org-ecx-utpark','AWARE',60,65,'KEY_PLAYER','NORMATIVE','پارک علم و فناوری دانشگاه تهران — واسط دانشگاه و صنعت'),
      P('PM-P-124','h-x4','organization','org-ecx-sharifpark','AWARE',62,65,'KEY_PLAYER','NORMATIVE','پارک علم و فناوری شریف — واسط دانشگاه و صنعت'),
      P('PM-P-125','h-x5','organization','org-ecx-avatech','AWARE',62,68,'KEY_PLAYER','NORMATIVE','آواتک — از نخستین و شناخته‌شده‌ترین شتاب‌دهنده‌ها (از ۱۳۹۳)؛ وابسته به سرآوا'),
      P('PM-P-126','h-x6','organization','org-ecx-finnova','AWARE',50,62,'SUPPORTER','NORMATIVE','فینوا — شتاب‌دهندهٔ تخصصی فین‌تک'),
      P('PM-P-127','h-x7','organization','org-ecx-maintech','AWARE',45,58,'SUPPORTER','NORMATIVE','ماینتک — الگوی شتاب‌دهی عمودی/تخصصی (معدن)'),
      P('PM-P-128','h-x8','organization','org-ecx-sarava','AWARE',72,65,'KEY_PLAYER','NORMATIVE','گروه سرمایه‌گذاری سرآوا — از فعال‌ترین سرمایه‌گذاران استارتاپی؛ مؤسس آواتک'),
      P('PM-P-129','h-x10','organization','org-ecx-digikala','AWARE',85,40,'INFLUENCER','NORMATIVE','دیجی‌کالا — بزرگ‌ترین پلتفرم تجارت الکترونیک؛ زیرساخت لجستیکی و داده‌ای بزرگ‌مقیاس'),
      P('PM-P-130','h-x11','organization','org-ecx-snapp','AWARE',80,42,'INFLUENCER','NORMATIVE','اسنپ — زیرساخت دادهٔ جغرافیایی و هوش مصنوعی مسیریابی'),
      P('PM-P-131','h-x12','organization','org-ecx-divar','AWARE',72,40,'INFLUENCER','NORMATIVE','دیوار — بزرگ‌ترین پلتفرم آگهی‌های طبقه‌بندی‌شده؛ کاربرد گسترده در مسکن و کالا'),
      P('PM-P-132','h-x13','organization','org-ecx-tapsi','AWARE',65,40,'INFLUENCER','NORMATIVE','تپسی — پلتفرم حمل‌ونقل هوشمند؛ رقیب مستقیم اسنپ'),
      P('PM-P-133','h-x14','organization','org-ecx-arvan','AWARE',68,50,'INFLUENCER','NORMATIVE','ابرآروان — از بزرگ‌ترین ارائه‌دهندگان خدمات ابری و CDN داخلی'),
      P('PM-P-134','h-x15','organization','org-ecx-mci','AWARE',78,38,'INFLUENCER','NORMATIVE','همراه اول — زیرساخت شبکه و محاسبات ابری در مقیاس ملی'),
      P('PM-P-135','h-x16','organization','org-ecx-ecommerce','AWARE',55,60,'INFLUENCER','NORMATIVE','انجمن تجارت الکترونیک — نهاد صنفی رسمی کسب‌وکارهای دیجیتال (کمیسیون ریتیل‌تک)'),
      P('PM-P-136','h-x17','organization','org-inst-09','AWARE',65,68,'INFLUENCER','NORMATIVE','سازمان نظام صنفی رایانه‌ای — نهاد صنفی رسمی شرکت‌های فناوری اطلاعات'),
    );
  }
}
/* --------------------- Publics: موتور پیشنهاد، پوشش و گپ --------------------- */
function pubSourceOf(m){
  if(m.sourceType==='organization') return orgById(m.sourceId)??null;
  if(m.sourceType==='person') return personById(m.sourceId)??null;
  if(m.sourceType==='relationship') return RELS.find(r=>r.id===m.sourceId)??null;
  if(m.sourceType==='media') return (DB.mediaStore??[]).find(x=>x.id===m.sourceId)??null;
  return null;
}
function pubSourceName(m){
  const src=pubSourceOf(m); if(!src) return null;
  if(m.sourceType==='person') return `${src.firstName??''} ${src.lastName??''}`.trim()||null;
  return src.name??src.title??src.id??null;
}
function pubSignalCount(m){
  const since=Date.now()-90*86400000;
  const after=(iso)=>!!iso&&new Date(iso).getTime()>since;
  const f=(arr,key)=>Array.isArray(arr)?arr.filter(x=>x[key]===m.sourceId&&after(x.createdAt??x.startAt)).length:0;
  let n=0;
  if(m.sourceType==='organization'){
    n=f(INTERACTIONS,'organizationId')+f(MEETINGS,'organizationId')+f(ACTIONS,'organizationId')+f(COMMITMENTS,'organizationId');
  } else if(m.sourceType==='person'){
    n=f(INTERACTIONS,'personId')+f(MEETINGS,'personId')+f(ACTIONS,'personId')+f(COMMITMENTS,'personId');
  } else if(m.sourceType==='relationship'){
    n=f(INTERACTIONS,'relationshipId')+f(MEETINGS,'relationshipId')+f(ACTIONS,'relationshipId')+f(COMMITMENTS,'relationshipId');
  }
  return n;
}
function pubSuggester(m){
  const self=(DB.publicsSelf??[]).find(x=>x.orgId===m.orgId);
  const g=pubEffGroup(m.orgId,m.groupId??'')??{};
  const src=pubSourceOf(m);
  let linkage=g.linkage??'DIFFUSED';
  if(m.sourceType==='relationship'&&src){
    const rt=String(src.relationshipType??'').toUpperCase();
    linkage={REGULATORY:'ENABLING',GOVERNMENT:'ENABLING',MERGER:'ENABLING',ACQUISITION:'ENABLING',
      SUPPLIER:'FUNCTIONAL_INPUT',SHAREHOLDER:'FUNCTIONAL_INPUT',INVESTOR:'FUNCTIONAL_INPUT',INVESTMENT:'FUNCTIONAL_INPUT',PARENT_SUBSIDIARY:'FUNCTIONAL_INPUT',
      CUSTOMER:'FUNCTIONAL_OUTPUT',DISTRIBUTION:'FUNCTIONAL_OUTPUT',
      PARTNERSHIP:'NORMATIVE',COLLABORATION:'NORMATIVE',STRATEGIC_ALLIANCE:'NORMATIVE',STRATEGIC:'NORMATIVE',INTERNAL:'NORMATIVE',PARTNER:'NORMATIVE',JOINT_VENTURE:'NORMATIVE',COMMERCIAL:'NORMATIVE',COMPETITOR:'NORMATIVE',OTHER:'NORMATIVE'}[rt]??linkage;
  } else if(m.sourceType==='organization'&&src){
    const ot=String(src.type??'').toUpperCase();
    linkage={GOVERNMENT:'ENABLING',BANK:'FUNCTIONAL_INPUT',INVESTOR:'FUNCTIONAL_INPUT',SUPPLIER:'FUNCTIONAL_INPUT',SUBSIDIARY:'FUNCTIONAL_INPUT',
      HOLDING:'NORMATIVE',PARTNER:'NORMATIVE',CUSTOMER:'FUNCTIONAL_OUTPUT'}[ot]??linkage;
  } else if(m.sourceType==='media') linkage='DIFFUSED';
  const sig=pubSignalCount(m);
  const base=Array.isArray(g.stage)&&g.stage[0]?g.stage[0]:'LATENT';
  let stage=sig>=3?'ACTIVE':sig>=1?'AWARE':base;
  if(sig>=1&&stage==='NON_PUBLIC') stage='AWARE';
  let power=50,interest=60;
  if(m.sourceType==='organization'&&src){
    const ot=String(src.type??'').toUpperCase();
    power={GOVERNMENT:85,BANK:80,INVESTOR:75,HOLDING:70,PARTNER:65,CUSTOMER:60,SUPPLIER:55,SUBSIDIARY:40}[ot]??50;
    if(ot==='CUSTOMER') interest=70;
  }
  if(m.sourceType==='relationship') power=65;
  if(m.sourceType==='media') power=60;
  if(g.stance==='KEY_PLAYER') interest=75;
  else if(g.stance==='INFLUENCER') interest=55;
  else if(g.stance==='SUPPORTER') interest=65;
  else interest=30;
  const stance=(power>=60&&interest>=60)?'KEY_PLAYER':power>=60?'INFLUENCER':interest>=60?'SUPPORTER':'OBSERVER';
  return {linkage,stage,power,interest,stance,signals:sig};
}
function pubStanceOf(power,interest){
  const p=Number(power)||0,i=Number(interest)||0;
  return (p>=60&&i>=60)?'KEY_PLAYER':p>=60?'INFLUENCER':i>=60?'SUPPORTER':'OBSERVER';
}
function pubMemberView(m){
  const self=(DB.publicsSelf??[]).find(x=>x.orgId===m.orgId);
  const g=pubEffGroup(m.orgId,m.groupId??'')??{};
  const sug=pubSuggester(m);
  return {...m,orgName:orgById(m.orgId)?.name??null,sourceName:pubSourceName(m),
    sourceLabel:m.sourceType==='organization'?'سازمان':m.sourceType==='person'?'شخص':m.sourceType==='relationship'?'رابطه':'رسانه',
    groupFa:g.fa??null,categoryId:g.cat??null,categoryFa:g.cat?PUBLIC_CATEGORY_FA[g.cat]:null,
    linkageFa:PUBLIC_LINKAGE_FA[m.linkage]??null,stageFa:PUBLIC_STAGE_FA[m.stage]??null,stanceFa:PUBLIC_STANCE_FA[m.stance]??null,
    kanal:g.kanal??null,signals:sug.signals,suggested:{linkage:sug.linkage,stage:sug.stage,power:sug.power,interest:sug.interest,stance:sug.stance}};
}
function pubCoverage(orgId){
  const self=pubByOrg(orgId);
  const tpl=pubTplById(self?.templateId??'HOLDING');
  const members=(DB.publicsMembers??[]).filter(m=>m.orgId===orgId);
  const cats=tpl.focus??PUBLIC_CATEGORY_ORDER;
  const byCategory=cats.map(cid=>{
    const groups=pubEffectiveGroups(orgId).filter(g=>g.active!==false&&g.cat===cid);
    const ids=new Set(groups.map(g=>g.id));
    const mems=members.filter(m=>ids.has(m.groupId));
    const gapGroups=groups.filter(g=>!mems.some(m=>m.groupId===g.id));
    const stages={NON_PUBLIC:0,LATENT:0,AWARE:0,ACTIVE:0},stances={KEY_PLAYER:0,INFLUENCER:0,SUPPORTER:0,OBSERVER:0};
    for(const m of mems){ stages[m.stage]=(stages[m.stage]??0)+1; stances[m.stance]=(stances[m.stance]??0)+1; }
    return {categoryId:cid,fa:PUBLIC_CATEGORY_FA[cid],expected:groups.length,covered:groups.length-gapGroups.length,
      members:mems.length,stages,stances,coveragePct:groups.length?Math.round((groups.length-gapGroups.length)/groups.length*100):0,
      criticalGaps:gapGroups.filter(g=>g.stance==='KEY_PLAYER').map(g=>g.id),gapGroups:gapGroups.map(g=>g.id)};
  });
  const sum=(k)=>byCategory.reduce((a,b)=>a+b[k],0);
  const sumLen=(k)=>byCategory.reduce((a,b)=>a+b[k].length,0);
  return {orgId,orgName:orgById(orgId)?.name??null,companyType:self?.companyType??null,templateId:self?.templateId??null,
    templateFa:tpl.fa??null,missionTopic:self?.missionTopic??null,reviewedAt:self?.reviewedAt??null,
    reviewIntervalDays:self?.reviewIntervalDays??90,generatedAt:nowIso(),byCategory,
    totals:{categories:byCategory.length,groupsExpected:sum('expected'),groupsCovered:sum('covered'),members:members.length,
      keyPlayers:members.filter(m=>m.stance==='KEY_PLAYER').length,active:members.filter(m=>m.stage==='ACTIVE').length,
      gaps:sumLen('gapGroups'),criticalGaps:sumLen('criticalGaps')}};
}
/* ------------ P3: برچسب دستهٔ عموم‌ها برای گراف شبکه + مسیر پیشنهادی گپ ------------ */
// برچسب‌گذاری قطعی نمونه: هر سازمان در شبکهٔ روابط به کدام دستهٔ عموم‌ها تعلق
// دارد؟ منبع اول: اعضای ثبت‌شدهٔ نقشهٔ عموم‌ها؛ منبع دوم: برچسب نمونهٔ آریا (P3).
const PUBLIC_ORG_CATEGORY = {
  'org-1': 'INTERNAL', 'org-2': 'INTERNAL', 'org-3': 'ECONOMIC', 'org-4': 'ECONOMIC',
  'org-5': 'ECONOMIC', 'org-6': 'ECOSYSTEM', 'org-7': 'ECONOMIC', 'org-8': 'INSTITUTIONAL',
};
function pubCatOfOrg(orgId){
  const ms=DB.publicsMembers??[];
  /* اول عضوی که خودِ سازمان درباره‌اش نوشته (orgId)، بعد نهادی که در نقشهٔ
     عموم‌ها «طرف مقابل» است (sourceId) — تا نهادهای سند هم رنگ دسته بگیرند */
  const m=ms.find(x=>x.orgId===orgId&&x.sourceType==='organization')
        ??ms.find(x=>x.sourceId===orgId&&x.sourceType==='organization');
  if(m){ const g=pubGroupFromAny(m.groupId); return g?.cat??null; }
  return PUBLIC_ORG_CATEGORY[orgId]??null;
}
function pubGroupFromAny(gid){
  for(const t of PUBLICS_TEMPLATE_LIST){ const g=t.groups.find(x=>x.id===gid); if(g) return {...g, templateId:t.id}; }
  return null;
}
/** مسیر کوتاه (بدون درخواست) میان سازمان‌ها بر پایهٔ RELS — برای پیشنهاد گپ. */
function pubNetRoute(fromId,toId){
  if(fromId===toId) return [fromId];
  const adj=new Map(); const put=(a,b)=>{ if(!adj.has(a)) adj.set(a,[]); adj.get(a).push(b); };
  for(const r of RELS){ put(r.sourceOrganizationId,r.targetOrganizationId); put(r.targetOrganizationId,r.sourceOrganizationId); }
  const prev=new Map(); const q=[fromId]; const seen=new Set([fromId]);
  while(q.length){ const u=q.shift(); for(const v of (adj.get(u)??[])){ if(seen.has(v)) continue; seen.add(v); prev.set(v,u); if(v===toId){ const out=[toId]; let cur=toId; while(prev.get(cur)!==undefined){ cur=prev.get(cur); out.unshift(cur); } return out; } q.push(v); } }
  return null;
}
function pubGapPathSuggestion(orgId, gap){
  const cat=gap.categoryId ?? gap.cat; if(!cat) return null;
  const ego=orgById(orgId)?.name??orgId;
  /* نزدیک‌ترین گرهٔ موجود در همان دسته که به ego پل می‌خورد */
  let best=null; let bestRoute=null;
  for(const o of ORGS){
    if(o.id===orgId) continue;
    if(pubCatOfOrg(o.id)!==cat) continue;
    const route=pubNetRoute(orgId,o.id);
    if(route && (bestRoute===null || route.length<bestRoute.length)){ best=o; bestRoute=route; }
  }
  const tpl=pubTplById(pubByOrg(orgId)?.templateId??'HOLDING');
  const groups=pubEffectiveGroups(orgId).filter(g=>g.active!==false&&g.cat===cat).slice(0,3);
  const mediaNames=(DB.mediaStore??[]).slice(0,3).map(m=>m.name);
  const candidates=cat==='MEDIA'?mediaNames:groups.map(g=>g.fa);
  if(best){
    return {category:cat,categoryFa:PUBLIC_CATEGORY_FA[cat],route:bestRoute.map(id=>({id:`org:${id}`,label:orgById(id)?.name??id})),
      hops:Math.max(0,bestRoute.length-1),direct:false,bridges:[best.id],
      note:`نزدیک‌ترین گرهٔ موجود در دستهٔ «${PUBLIC_CATEGORY_FA[cat]}»؛ برای پوشش این شکاف، از همین مسیر ورود استفاده کنید.`,
      candidates};
  }
  return {category:cat,categoryFa:PUBLIC_CATEGORY_FA[cat],route:[{id:`org:${orgId}`,label:ego}],hops:0,direct:true,bridges:[],
    note:cat==='MEDIA'?'گرهٔ رسانه‌ای در شبکه یافت نشد؛ ورود مستقیم از رسانه‌های فهرست‌شده.':
      `در دستهٔ «${PUBLIC_CATEGORY_FA[cat]}» گرهٔ فعالی در شبکه نیست؛ ورود مستقیم یا از طریق معرف.`,
    candidates};
}
function pubGaps(orgId){
  const cov=pubCoverage(orgId);
  const tpl=pubTplById(cov.templateId??'HOLDING');
  const rows=[];
  for(const c of cov.byCategory){
    for(const gid of c.gapGroups){
      const g=pubEffGroup(orgId,gid)??{};
      const isCrit=g.stance==='KEY_PLAYER';
      rows.push({gapId:`${c.categoryId}:${gid}`,groupId:gid,groupFa:g.fa??gid,categoryId:c.categoryId,categoryFa:c.fa,
        kind:'missing',severity:isCrit?'CRITICAL':'HIGH',stance:g.stance??'OBSERVER',stanceFa:PUBLIC_STANCE_FA[g.stance]??null,
        action:isCrit?'برنامهٔ تعامل مستقیم با عموم کلیدی غایب':`برنامهٔ جذب و پایش در دستهٔ «${c.fa}»`});
    }
  }
  for(const m of (DB.publicsMembers??[]).filter(x=>x.orgId===orgId&&x.stance==='KEY_PLAYER'&&['NON_PUBLIC','LATENT','AWARE'].includes(x.stage))){
    const g=pubEffGroup(orgId,m.groupId)??{};
    rows.push({gapId:`stage:${m.id}`,groupId:m.groupId,groupFa:g.fa??m.groupId,categoryId:g.cat??null,categoryFa:g.cat?PUBLIC_CATEGORY_FA[g.cat]:null,
      kind:'lagging',severity:'HIGH',stance:'KEY_PLAYER',stanceFa:'بازیگر کلیدی',memberId:m.id,sourceName:pubSourceName(m),
      action:'تعامل مستقیم دوسویه برای رسیدن به مرحلهٔ «فعال»'});
  }
  const media=cov.byCategory.find(c=>c.categoryId==='MEDIA');
  if(media&&media.covered===0) rows.push({gapId:'MEDIA:no-cover',groupId:null,groupFa:'رسانه و افکار عمومی',categoryId:'MEDIA',categoryFa:PUBLIC_CATEGORY_FA.MEDIA,
    kind:'missing',severity:'HIGH',stance:'OBSERVER',stanceFa:'ناظر',action:'تدوین برنامهٔ رسانه‌ای (دست‌کم پایش مستمر)'});
  for(const row of rows) row.pathSuggestion=pubGapPathSuggestion(orgId,row);
  const order={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
  rows.sort((a,b)=>(order[a.severity]??9)-(order[b.severity]??9));
  return {orgId,generatedAt:nowIso(),totals:{categories:cov.byCategory.length,groupsExpected:cov.totals.groupsExpected,
    groupsCovered:cov.totals.groupsCovered,members:cov.totals.members,keyPlayers:cov.totals.keyPlayers,
    active:cov.totals.active,missing:cov.totals.gaps,lagging:rows.filter(g=>g.kind==='lagging').length,
    gaps:rows.length,criticalGaps:rows.filter(g=>g.severity==='CRITICAL').length},gaps:rows};
}
/* ================= STRATEGY: تحلیل راهبردی (چیدمان: تعامل راهبردی) =================
   دامنهٔ دقیق: تحلیل تعادل فقط برای سناریوی ۲طرفه؛ شبیه‌سازی تکراری برای ۲+ طرف.
   ترتیب عایدی در درخت ترتیبی همیشه [خود، رقیب] است. موتور قطعی است (PRNG بذردار). */
const ST_EPS = 1e-9;
const ST_RULES_FA = { TFT:'تلافی‌مثل', GRIM:'ماشه‌ای', ALLC:'همیشه‌همکاری', ALLD:'همیشه‌نقض', BESTRESP:'بهترین‌پاسخ', RANDOM:'تصادفی بذردار' };
const ST_RULES_ORDER = ['TFT','GRIM','ALLC','ALLD','BESTRESP','RANDOM'];
function stHashSeed(str){ let h=2166136261; const s=String(str??'srip'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function stRng(seed){ let a=(seed>>>0)||1; return ()=>{ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
const STRATEGY_ARCHETYPES=[
  {id:'PD',fa:'معمای زندانی',kind:'normal',story:'هر دو از همکاری سود می‌برند، اما هر یک وسوسهٔ نقض یک‌طرفه دارد؛ تعادل، نقض متقابل است (مثل شکست قیمت هم‌زمان).',
   self:['همکاری','نقض'],rival:['همکاری','نقض'],paySelf:[[3,0],[5,1]],payRival:[[3,5],[0,1]]},
  {id:'STAG',fa:'شکار گوزن',kind:'normal',story:'هماهنگی روی هدف بزرگ بهترین است، اما هراس از تنها ماندن، همه را به هدف کوچک امن می‌کشاند (مثل سرمایه‌گذاری مشترک).',
   self:['گوزن (بزرگ)','خرگوش (امن)'],rival:['گوزن (بزرگ)','خرگوش (امن)'],paySelf:[[4,0],[3,1]],payRival:[[4,3],[0,1]]},
  {id:'CHICKEN',fa:'تقابل (جوجه)',kind:'normal',story:'هر که عقب بکشد می‌بازد، اما پافشاری دوطرفه فاجعه است (مثل مزایدهٔ فرسایشی). دو تعادل نامتقارن دارد.',
   self:['گذشت','پافشاری'],rival:['گذشت','پافشاری'],paySelf:[[0,-1],[1,-10]],payRival:[[0,1],[-1,-10]]},
  {id:'COORD',fa:'هماهنگی',kind:'normal',story:'مهم هم‌جهت شدن است نه جهت خاص (مثل انتخاب استاندارد مشترک). دو تعادل قطری دارد.',
   self:['گزینه الف','گزینه ب'],rival:['گزینه الف','گزینه ب'],paySelf:[[2,0],[0,1]],payRival:[[2,0],[0,1]]},
  {id:'PENNIES',fa:'سکهٔ مشابه',kind:'normal',story:'تعامل حاصل‌جمع‌صفر بدون تعادل خالص؛ تنها تعادل، مختلط ۵۰-۵۰ است (مثل حدس حرکت رقیب در مناقصهٔ کور).',
   self:['شیر','خط'],rival:['شیر','خط'],paySelf:[[1,-1],[-1,1]],payRival:[[-1,1],[1,-1]]},
  {id:'ENTRY',fa:'بازدارندگی ورود (ترتیبی)',kind:'sequential',story:'رقیب تازه‌وارد اول تصمیم می‌گیرد؛ شرکت مستقر بعد واکنش نشان می‌دهد. با استقرای پسرو حل می‌شود.',
   self:[''],rival:[''],paySelf:[],payRival:[],
   tree:{player:'rival',actions:[
     {label:'ورود به بازار',child:{player:'self',actions:[
       {label:'جنگ قیمت',pay:[-2,-2]},
       {label:'پذیرش و تسهیم',pay:[2,2]}]}},
     {label:'عدم ورود',pay:[5,0]}]}},
  {id:'PRICEW',fa:'جنگ قیمت (تکراری)',kind:'repeated',story:'سناریوی آمادهٔ شبیه‌سازی: معمای زندانی با برچسب قیمتی، ۱۰ دور، تلافی‌مثل در برابر تلافی‌مثل.',
   self:['تثبیت قیمت','شکست قیمت'],rival:['تثبیت قیمت','شکست قیمت'],paySelf:[[3,0],[5,1]],payRival:[[3,5],[0,1]],
   suggestSim:{rounds:10,delta:0.9,selfRule:'TFT',rivalRule:'TFT'}},
];
const stArchetype=(id)=>STRATEGY_ARCHETYPES.find(a=>a.id===id)??null;
/* بهترین‌پاسخ‌ها: selfBR[ستون]=سطرها، rivalBR[سطر]=ستون‌ها */
function stBestResponses(A,B){
  const m=A.length,n=A[0].length,selfBR=[],rivalBR=[];
  for(let j=0;j<n;j++){ let mx=-Infinity; for(let i=0;i<m;i++) mx=Math.max(mx,A[i][j]);
    selfBR.push(A.map((row,i)=>row[j]>=mx-ST_EPS?i:-1).filter(x=>x>=0)); }
  for(let i=0;i<m;i++){ let mx=-Infinity; for(let j=0;j<n;j++) mx=Math.max(mx,B[i][j]);
    rivalBR.push(B[i].map((v,j)=>v>=mx-ST_EPS?j:-1).filter(x=>x>=0)); }
  return {selfBR,rivalBR};
}
function stPureNE(A,B){
  const {selfBR,rivalBR}=stBestResponses(A,B),out=[];
  for(let i=0;i<A.length;i++) for(let j=0;j<A[0].length;j++)
    if(selfBR[j].includes(i)&&rivalBR[i].includes(j)) out.push({i,j,pay:[A[i][j],B[i][j]]});
  return out;
}
/* تعادل مختلط دقیقاً ۲×۲: q احتمال ستون۰، p احتمال سطر۰ */
function stMixed22(A,B){
  const a=A[0][0],b=A[0][1],c=A[1][0],d=A[1][1],e=B[0][0],f=B[0][1],g=B[1][0],h=B[1][1];
  const dq=a-b-c+d,dp=e-f-g+h;
  if(Math.abs(dq)<ST_EPS||Math.abs(dp)<ST_EPS) return {valid:false,reason:'مخرج کسر صفر است؛ ترکیب بی‌تفاوت‌کننده یکتا وجود ندارد.'};
  const q=(d-b)/dq,p=(h-g)/dp;
  if(!(p>0&&p<1&&q>0&&q<1)) return {valid:false,reason:'جواب بیرون از بازهٔ (۰،۱) است؛ تعادل مختلط درونی وجود ندارد.',p,q};
  const eSelf=q*a+(1-q)*b,eRival=p*e+(1-p)*g;
  return {valid:true,p,q,expPay:[eSelf,eRival],note:'در این ترکیب، هر طرف دیگری را بی‌تفاوت می‌کند.'};
}
/* حذف تکراری راهبرد اکیداً مغلوب */
function stDominance(A,B,selfLabels,rivalLabels){
  let rows=A.map((_,i)=>i),cols=A[0].map((_,j)=>j); const steps=[];
  for(;;){
    let cut=null;
    for(const i of rows){ const dom=rows.find(k=>k!==i&&cols.every(j=>A[k][j]>A[i][j]+ST_EPS));
      if(dom!==undefined){ cut={type:'row',index:i,label:selfLabels[i],by:selfLabels[dom]}; rows=rows.filter(x=>x!==i); break; } }
    if(!cut) for(const j of cols){ const dom=cols.find(k=>k!==j&&rows.every(i=>B[i][k]>B[i][j]+ST_EPS));
      if(dom!==undefined){ cut={type:'col',index:j,label:rivalLabels[j],by:rivalLabels[dom]}; cols=cols.filter(x=>x!==j); break; } }
    if(!cut) break; steps.push(cut);
  }
  return {steps,remaining:{rows,cols}};
}
/* استقرای پسرو روی درخت متناهی اطلاعات‌کامل */
function stBackward(node){
  const steps=[];
  const solve=(nd,path)=>{
    if(!nd||!nd.actions) throw new Error('گرهٔ درخت معتبر نیست.');
    let best=null;
    for(const a of nd.actions){
      const sub=a.pay?{pay:a.pay,path:[...path,a.label]}:solve(a.child,[...path,a.label]);
      const mine=nd.player==='self'?sub.pay[0]:sub.pay[1];
      if(!best||mine>best.mine+ST_EPS) best={...sub,mine,choice:a.label};
    }
    steps.push({player:nd.player,choice:best.choice,pay:best.pay});
    return {pay:best.pay,path:best.path};
  };
  const r=solve(node,[]);
  return {spePath:r.path,pay:r.pay,steps};
}
/* شرط پایداری همکاری ماشه‌ای با فرض نظم [همکاری،نقض] */
function stDeltaCondition(A){
  if(A.length!==2||A[0].length!==2) return {computable:false,reason:'فقط برای ماتریس ۲×۲ با فرض سطر/ستون اول = همکاری.'};
  const R=A[0][0],S=A[0][1],T=A[1][0],P=A[1][1];
  if(!(T>R&&R>P&&P>S)) return {computable:false,reason:'نظم T>R>P>S برقرار نیست؛ فرمول ماشه‌ای اعتبار ندارد.',values:{T,R,P,S}};
  return {computable:true,deltaStar:(T-R)/(T-P),values:{T,R,P,S},rule:'اگر عامل تنزیل δ دست‌کم این مقدار باشد، همکاری با تهدید ماشه‌ای پایدار است.'};
}
/* شبیه‌سازی تکراری: coop=اندیس ۰، defect=آخرین اندیس */
function stSimulate(A,B,m,n,o={}){
  const rounds=Math.max(1,Math.min(200,Number(o.rounds??10)||10));
  const delta=Math.max(0,Math.min(0.999,Number(o.delta??0.9)));
  const rng=stRng(stHashSeed(o.seed??'srip-strategy'));
  const rules={self:o.selfRule??'TFT',rival:o.rivalRule??'TFT'};
  const argmax=(arr)=>{ let bi=0; for(let k=1;k<arr.length;k++) if(arr[k]>arr[bi]+ST_EPS) bi=k; return bi; };
  const hist=[]; let grimS=false,grimR=false,totS=0,totR=0,discS=0,discR=0,coopJoint=0;
  for(let r=0;r<rounds;r++){
    const prev=hist[hist.length-1];
    const pick=(who)=>{
      const rule=rules[who],opp=who==='self'?'rival':'self';
      const lastSelf=prev?prev.self:0,lastRival=prev?prev.rival:0;
      const oppLast=who==='self'?lastRival:lastSelf,ownM=who==='self'?m:n;
      if(rule==='ALLC') return 0;
      if(rule==='ALLD') return ownM-1;
      if(rule==='RANDOM') return Math.floor(rng()*ownM);
      if(rule==='TFT') return r===0?0:Math.min(oppLast,ownM-1);
      if(rule==='GRIM'){ if(who==='self'){ if(r>0&&lastRival!==0) grimS=true; return grimS?m-1:0; } if(r>0&&lastSelf!==0) grimR=true; return grimR?n-1:0; }
      if(rule==='BESTRESP'){ if(who==='self') return argmax(A.map(row=>row[Math.min(oppLast,n-1)])); return argmax(B[Math.min(oppLast,m-1)]); }
      return 0;
    };
    const si=pick('self'),ri=pick('rival'),ps=A[si][ri],pr=B[si][ri];
    const df=Math.pow(delta,r);
    totS+=ps; totR+=pr; discS+=ps*df; discR+=pr*df; if(si===0&&ri===0) coopJoint++;
    hist.push({round:r+1,self:si,rival:ri,paySelf:ps,payRival:pr});
  }
  const r2=(v)=>Math.round(v*100)/100;
  return {rounds,delta,rules,seed:String(o.seed??'srip-strategy'),history:hist,
    totals:{self:totS,rival:totR,discSelf:r2(discS),discRival:r2(discR)},
    coopJointRate:Math.round(coopJoint/rounds*1000)/10};
}
/* پیش‌بینی حرکت بعدی رقیب از تاریخچه + توصیهٔ بهترین پاسخ */
function stPredict(A,B,history){
  const n=B[0].length,freq=new Array(n).fill(0);
  for(const h of history??[]) if(Number.isInteger(h.rival)&&h.rival>=0&&h.rival<n) freq[h.rival]++;
  const total=freq.reduce((a,b)=>a+b,0);
  if(!total) return {ok:false,reason:'تاریخچه‌ای برای پیش‌بینی وجود ندارد؛ ابتدا شبیه‌سازی کنید یا تاریخچه وارد کنید.'};
  const dist=freq.map(f=>Math.round(f/total*1000)/1000);
  let pred=0; for(let j=1;j<n;j++) if(freq[j]>freq[pred]+ST_EPS) pred=j;
  const ties=freq.filter(f=>Math.abs(f-freq[pred])<ST_EPS).length>1;
  let tftHits=0,tftN=0;
  for(let t=1;t<(history??[]).length;t++){ const h=history[t],p=history[t-1]; if(h&&p&&Number.isInteger(h.rival)){ tftN++; if(h.rival===p.self) tftHits++; } }
  const expSelf=A.map(row=>row.reduce((s,v,j)=>s+v*dist[j],0));
  let rec=0; for(let i=1;i<expSelf.length;i++) if(expSelf[i]>expSelf[rec]+ST_EPS) rec=i;
  const r3=(v)=>Math.round(v*1000)/1000;
  return {ok:true,total,dist,predicted:pred,predictedTie:ties,tftMatchRate:tftN?Math.round(tftHits/tftN*1000)/10:null,
    recommend:rec,expPaySelf:expSelf.map(r3),bestRespToPredicted:A.map(row=>row[pred]).map((_,i)=>i).reduce((a,i)=>expSelf[i]>expSelf[a]+ST_EPS?i:a,0)};
}
/* ---------- ورود داده از پلتفرم دیگر: CSV/JSON + اعتبارسنجی ---------- */
function stParseCsv(text){
  const rows=[]; let row=[],cell='',q=false;
  const s=String(text??'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(q){ if(c==='"'){ if(s[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
    else if(c!=='\r') cell+=c;
  }
  if(cell!==''||row.length) { row.push(cell); rows.push(row); }
  return rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(x=>x!==''));
}
function stNum(v){ if(typeof v==='number') return Number.isFinite(v)?v:null; if(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))) return Number(v); return null; }
function stValidateImport(format,payload,kind){
  const errors=[],warnings=[];
  const fail=(msg)=>{ errors.push(msg); };
  if(format==='json'){
    let d; try{ d=JSON.parse(String(payload??'')); }catch{ fail('متن JSON معتبر نیست.'); return {ok:false,errors,warnings}; }
    if(!d||typeof d!=='object') { fail('سند JSON باید یک شیء باشد.'); return {ok:false,errors,warnings}; }
    if(d.version!==1) warnings.push('فیلد version برابر ۱ نیست؛ با اسکیمای نسخهٔ ۱ خوانده شد.');
    const players=Array.isArray(d.players)?d.players:[];
    if(players.length!==2) fail('بخش players باید دقیقاً ۲ طرف داشته باشد.');
    const st=d.strategies??{};
    const ss=Array.isArray(st.self)?st.self:[],rs=Array.isArray(st.rival)?st.rival:[];
    if(ss.length<2) fail('راهبردهای خود (strategies.self) دست‌کم ۲ مورد لازم دارد.');
    if(rs.length<2) fail('راهبردهای رقیب (strategies.rival) دست‌کم ۲ مورد لازم دارد.');
    const bad=new Set();
    const chkMat=(M,who,m,n)=>{ if(!Array.isArray(M)||M.length!==m){ fail(`ماتریس ${who} باید ${m} سطر داشته باشد.`); return; }
      M.forEach((r,i)=>{ if(!Array.isArray(r)||r.length!==n){ fail(`سطر ${i+1} ماتریس ${who} باید ${n} ستون داشته باشد.`); return; }
        r.forEach((v,j)=>{ if(stNum(v)===null){ fail(`خانهٔ (${i+1}،${j+1}) ماتریس ${who} عدد معتبر نیست.`); bad.add(i+','+j); } }); }); };
    const m=ss.length,n=rs.length;
    chkMat(d.payoffs?.self,'خود',m,n); chkMat(d.payoffs?.rival,'رقیب',m,n);
    let rounds=null;
    if(d.rounds!==undefined){
      if(!Array.isArray(d.rounds)) fail('بخش rounds باید آرایه باشد.');
      else { rounds=[]; const idxS=(v)=>typeof v==='number'?v:ss.indexOf(v),idxR=(v)=>typeof v==='number'?v:rs.indexOf(v);
        d.rounds.forEach((h,t)=>{ const si=idxS(h.self),ri=idxR(h.rival);
          if(!Number.isInteger(si)||si<0||si>=m||!Number.isInteger(ri)||ri<0||ri>=n){ fail(`دور ${t+1}: ارجاع راهبرد نامعتبر است.`); return; }
          rounds.push({round:Number(h.round??t+1),self:si,rival:ri,paySelf:stNum(h.paySelf)??d.payoffs.self[si][ri],payRival:stNum(h.payRival)??d.payoffs.rival[si][ri]}); }); }
    }
    if(errors.length) return {ok:false,errors,warnings};
    if(m>8||n>8) warnings.push('ماتریس بزرگ‌تر از ۸×۸ است؛ تحلیل تعادل کند می‌شود.');
    return {ok:true,errors,warnings,scenario:{kind:'normal',self:{name:String(players[0]?.name??'خود')},rival:{name:String(players[1]?.name??'رقیب')},
      selfStrats:ss.map(String),rivalStrats:rs.map(String),
      paySelf:d.payoffs.self.map(r=>r.map(stNum)),payRival:d.payoffs.rival.map(r=>r.map(stNum)),
      payoffSource:'imported',importRounds:rounds}};
  }
  if(format==='csv'){
    const rows=stParseCsv(payload);
    if(!rows.length){ fail('فایل CSV خالی است.'); return {ok:false,errors,warnings}; }
    const head=rows[0].map(h=>h.toLowerCase());
    if(kind==='matrix'){
      const need=['strategy_self','strategy_rival','pay_self','pay_rival'];
      const miss=need.filter(h=>!head.includes(h));
      if(miss.length){ fail('سرستون ناقص است؛ لازم: '+need.join('، ')); return {ok:false,errors,warnings}; }
      const ci=(h)=>head.indexOf(h),ss=[],rs=[],cells={};
      rows.slice(1).forEach((r,t)=>{ const a=r[ci('strategy_self')]??'',b=r[ci('strategy_rival')]??'';
        const ps=stNum(r[ci('pay_self')]),pr=stNum(r[ci('pay_rival')]);
        if(!a||!b){ fail(`سطر ${t+2}: نام راهبرد خالی است.`); return; }
        if(ps===null||pr===null){ fail(`سطر ${t+2}: عایدی عدد معتبر نیست.`); return; }
        if(!ss.includes(a)) ss.push(a); if(!rs.includes(b)) rs.push(b);
        const k=a+''+b; if(cells[k]) warnings.push(`سطر ${t+2}: خانهٔ تکراری؛ آخرین مقدار نگه داشته شد.`);
        cells[k]=[ps,pr]; });
      if(errors.length) return {ok:false,errors,warnings};
      if(ss.length<2||rs.length<2){ fail('دست‌کم ۲ راهبرد برای هر طرف لازم است.'); return {ok:false,errors,warnings}; }
      const A=ss.map(a=>rs.map(b=>cells[a+''+b]?cells[a+''+b][0]:null));
      const B=ss.map(a=>rs.map(b=>cells[a+''+b]?cells[a+''+b][1]:null));
      const missing=[]; A.forEach((r,i)=>r.forEach((v,j)=>{ if(v===null) missing.push(`(${ss[i]}،${rs[j]})`); }));
      if(missing.length){ fail('خانه‌های بدون داده: '+missing.slice(0,6).join('؛ ')+(missing.length>6?' و …':'')); return {ok:false,errors,warnings}; }
      return {ok:true,errors,warnings,scenario:{kind:'normal',self:{name:'خود'},rival:{name:'رقیب'},selfStrats:ss,rivalStrats:rs,paySelf:A,payRival:B,payoffSource:'imported',importRounds:null}};
    }
    /* rounds: میانگین تجربی هر خانه؛ خانهٔ دیده‌نشده صفر + هشدار صریح */
    const need=['round','self','rival'];
    const miss=need.filter(h=>!head.includes(h));
    if(miss.length){ fail('سرستون ناقص است؛ لازم: '+need.join('، ')+' (و paySelf/payRival اختیاری)'); return {ok:false,errors,warnings}; }
    const ci=(h)=>head.indexOf(h),ss=[],rs=[],acc={};
    rows.slice(1).forEach((r,t)=>{ const a=r[ci('self')]??'',b=r[ci('rival')]??'';
      if(!a||!b){ fail(`سطر ${t+2}: نام راهبرد خالی است.`); return; }
      if(!ss.includes(a)) ss.push(a); if(!rs.includes(b)) rs.push(b);
      const k=a+''+b; acc[k]=acc[k]??{s:[],r:[]};
      const ps=stNum(r[ci('payself')]??''),pr=stNum(r[ci('payrival')]??'');
      if(ps!==null) acc[k].s.push(ps); if(pr!==null) acc[k].r.push(pr); });
    if(errors.length) return {ok:false,errors,warnings};
    if(ss.length<2||rs.length<2){ fail('دست‌کم ۲ راهبرد برای هر طرف لازم است.'); return {ok:false,errors,warnings}; }
    const mean=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
    const unseen=[];
    const A=ss.map(a=>rs.map(b=>{ const k=a+''+b; if(!acc[k]||!acc[k].s.length) unseen.push(`(${a}،${b})`); return Math.round(mean(acc[k]?.s??[])*100)/100; }));
    const B=ss.map(a=>rs.map(b=>{ const k=a+''+b; return Math.round(mean(acc[k]?.r??[])*100)/100; }));
    if(unseen.length) warnings.push('خانه‌های دیده‌نشده با صفر پر شد و نیازمند بازبینی است: '+unseen.slice(0,6).join('؛ ')+(unseen.length>6?' و …':''));
    warnings.push('عایدی‌ها میانگین تجربی تاریخچه است (منبع: تجربی) نه اظهار قطعی.');
    return {ok:true,errors,warnings,scenario:{kind:'normal',self:{name:'خود'},rival:{name:'رقیب'},selfStrats:ss,rivalStrats:rs,paySelf:A,payRival:B,payoffSource:'empirical',importRounds:null}};
  }
  fail('قالب نامعتبر است؛ json یا csv.');
  return {ok:false,errors,warnings};
}
/* اعتبارسنجی سناریوی دستی/درخت */
function stValidateScenario(d){
  const errors=[];
  if(!d||typeof d!=='object') return {ok:false,errors:['بدنهٔ درخواست معتبر نیست.']};
  if(d.kind==='sequential'){
    const seen={n:0};
    const walk=(nd,depth)=>{
      if(!nd||typeof nd!=='object'){ errors.push('گرهٔ درخت معتبر نیست.'); return; }
      if(depth>6){ errors.push('عمق درخت بیش از ۶ است.'); return; }
      if(!['self','rival'].includes(nd.player)){ errors.push('طرفِ گره باید self یا rival باشد.'); return; }
      if(!Array.isArray(nd.actions)||nd.actions.length<2||nd.actions.length>6){ errors.push('هر گره ۲ تا ۶ شاخه لازم دارد.'); return; }
      for(const a of nd.actions){ seen.n++;
        if(!a||!a.label){ errors.push('برچسب شاخه خالی است.'); continue; }
        if(a.pay){ if(!Array.isArray(a.pay)||a.pay.length!==2||stNum(a.pay[0])===null||stNum(a.pay[1])===null) errors.push(`عایدی برگ «${a.label}» باید ۲ عدد باشد.`); }
        else if(a.child) walk(a.child,depth+1); else errors.push(`شاخهٔ «${a.label}» نه برگ است نه زیرگره دارد.`);
      }
    };
    walk(d.tree,0);
    if(!errors.length&&seen.n<2) errors.push('درخت دست‌کم ۲ شاخه لازم دارد.');
    return {ok:!errors.length,errors};
  }
  const ss=Array.isArray(d.selfStrats)?d.selfStrats:[],rs=Array.isArray(d.rivalStrats)?d.rivalStrats:[];
  if(ss.length<2||rs.length<2) errors.push('هر طرف دست‌کم ۲ راهبرد لازم دارد.');
  if(ss.length>12||rs.length>12) errors.push('بیش از ۱۲ راهبرد پشتیبانی نمی‌شود.');
  const chk=(M,who)=>{ if(!Array.isArray(M)||M.length!==ss.length){ errors.push(`ماتریس ${who} باید ${ss.length} سطر داشته باشد.`); return; }
    M.forEach((r,i)=>{ if(!Array.isArray(r)||r.length!==rs.length){ errors.push(`سطر ${i+1} ماتریس ${who} باید ${rs.length} ستون داشته باشد.`); return; }
      r.forEach(v=>{ if(stNum(v)===null) errors.push(`یک خانهٔ ماتریس ${who} عدد نیست.`); }); }); };
  chk(d.paySelf,'خود'); chk(d.payRival,'رقیب');
  return {ok:!errors.length,errors:[...new Set(errors)].slice(0,12)};
}
/* پیشنهاد راهبرد از روی نوع سازمان */
const ST_ORG_STRATS={HOLDING:['تثبیت','توسعه'],SUBSIDIARY:['همکاری','رقابت'],BANK:['تثبیت نرخ','رقابت قیمتی'],PARTNER:['همکاری بلندمدت','بازنگری قرارداد'],CUSTOMER:['وفاداری','چانه‌زنی'],SUPPLIER:['همکاری بلندمدت','فروش نقدی'],INVESTOR:['سرمایه‌گذاری','خروج'],GOVERNMENT:['حمایت','محدودیت']};
function stOrgSuggest(orgId){
  const o=orgById(orgId);
  if(!o) return null;
  return {orgId:o.id,name:o.name,type:o.type??null,industry:o.industry??null,suggested:ST_ORG_STRATS[o.type]??['همکاری','رقابت']};
}
/* بریف یک‌صفحه‌ای */
function stBrief(sc,analysis,sim){
  const L=[];
  L.push(`سناریو: ${sc.name} — ${sc.self?.name??'خود'} در برابر ${sc.rival?.name??'رقیب'}`);
  if(sc.kind==='sequential'){
    L.push(`نوع: سناریوی ترتیبی؛ مسیر تعادل (استقرای پسرو): ${(analysis?.spe?.spePath??[]).join(' ← ')||'—'}`);
    L.push(`عایدی مسیر تعادل: خود ${analysis?.spe?.pay?.[0]??'—'}، رقیب ${analysis?.spe?.pay?.[1]??'—'}`);
  } else {
    const ne=analysis?.pureNE??[];
    L.push(`ماتریس ${sc.selfStrats.length}×${sc.rivalStrats.length}؛ تعادل نش خالص: ${ne.length?ne.map(c=>`(${sc.selfStrats[c.i]}،${sc.rivalStrats[c.j]})`).join('؛ '):'هیچ'}`);
    if(analysis?.mixed?.valid) L.push(`تعادل مختلط: خود ${Math.round(analysis.mixed.p*100)}٪ سطر اول، رقیب ${Math.round(analysis.mixed.q*100)}٪ ستون اول`);
    if(analysis?.delta?.computable) L.push(`آستانهٔ پایداری همکاری (ماشه‌ای): δ ≥ ${Math.round(analysis.delta.deltaStar*1000)/1000}`);
  }
  if(sim) L.push(`شبیه‌سازی ${sim.rounds} دوره (${ST_RULES_FA[sim.rules.self]} در برابر ${ST_RULES_FA[sim.rules.rival]}): عایدی انباشتهٔ خود ${sim.totals.self}، رقیب ${sim.totals.rival}، همکاری دوطرفه ${sim.coopJointRate}٪`);
  if(analysis?.prediction?.ok) L.push(`پیش‌بینی حرکت بعدی رقیب: ${sc.rivalStrats[analysis.prediction.predicted]}؛ واکنش توصیه‌شده: ${sc.selfStrats[analysis.prediction.recommend]}`);
  return L;
}
/* ---------- فروشگاه سناریوها ---------- */
function seedStrategyStore(){
  if(!Array.isArray(DB.strategyScenarios)) DB.strategyScenarios=[];
  if(!Array.isArray(DB.strategyImports)) DB.strategyImports=[];
  if(!Array.isArray(DB.strategyConnections)) DB.strategyConnections=[];
  if(!DB.strategySims) DB.strategySims={};
  if(!DB.strategyScenarios.some(s=>s.id==='sc-price')){
    DB.strategyScenarios.push({id:'sc-price',orgId:'org-1',name:'جنگ قیمت با پترو صنعت',kind:'normal',archetypeId:'PD',
      self:{name:'هلدینگ آریا',orgId:'org-1'},rival:{name:'شرکت پترو صنعت',orgId:'org-4'},
      selfStrats:['تثبیت قیمت','شکست قیمت'],rivalStrats:['تثبیت قیمت','شکست قیمت'],
      paySelf:[[3,0],[5,1]],payRival:[[3,5],[0,1]],payoffSource:'stated',source:'seed',
      createdAt:nowIso(),updatedAt:nowIso()});
  }
  if(!DB.strategyScenarios.some(s=>s.id==='sc-entry')){
    const t=stArchetype('ENTRY');
    DB.strategyScenarios.push({id:'sc-entry',orgId:'org-1',name:'تهدید ورود البرز به بازار قطعات',kind:'sequential',archetypeId:'ENTRY',
      self:{name:'هلدینگ آریا',orgId:'org-1'},rival:{name:'تأمین‌کننده قطعات البرز',orgId:'org-6'},
      selfStrats:[],rivalStrats:[],paySelf:[],payRival:[],tree:JSON.parse(JSON.stringify(t.tree)),
      payoffSource:'stated',source:'seed',createdAt:nowIso(),updatedAt:nowIso()});
  }
}
function approvalFlowSafe(deciderId,a,decision,isOwner){
  if(!isOwner) return 'فقط مالک سامانه می‌تواند درخواست‌ها را تصمیم بگیرد.';
  if(a.status!=='PENDING') return 'این درخواست از قبل تصمیم‌گیری شده است.';
  // Demo note: in the real API a requester can never تأیید their own request
  // ('Requester cannot تأیید their own request') and any decider with
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
          suggestions.push({kind:'opportunity',refId:o.id,text:`قدم بعدی برای فرصت «${o.name}» را برنامه‌ریزی کنید`,reason:`احتمال ${faN(o.probability??0)}٪ و ارزش موزون ${faN(evOf(o))} میلیارد تومان${rel?'؛ رابطهٔ '+relLabel(rel):''}`});
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
        if(topOpp&&!isOppQ) suggestions.push({kind:'opportunity',refId:topOpp.id,text:`گام بعدی فرصت «${topOpp.name}» را جلو ببرید`,reason:`ارزش موزون ${faN(evOf(topOpp))} میلیارد تومان با احتمال ${faN(topOpp.probability)}٪`});
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
    model:{provider:'deterministic-gateway',externalCall:false},
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
  try {
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
    if(mfaNeeded&&(!b.otp||!/^\d{6}$/.test(String(b.otp)))){ audit(req,'LOGIN_FAIL','user',u.email,'FAIL',{reason:'no_mfa'}); recordSecurity(req,'LOGIN_FAILURE','WARNING',{reason:'no_mfa'},'User',u.email,u.id,null); return json(res,401,{message:'کد تأیید دومرحله‌ای لازم است.'}); }
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
  if(is('/organizations') && method==='GET') return json(res,200,attachCriteria('ORGANIZATION',scopedOrgs(req).map(o=>({...o,owner:{name:'کاربر دمو'},_count:orgCounts(o)}))));
  if(is('/organizations') && method==='POST'){
    const b=await readBody(req);
    if(!b.name||b.name.trim().length<2) return json(res,400,{message:'نام سازمان حداقل ۲ نویسه باید باشد.'});
    const intake = normalizeCriteriaAnswers(b.criteriaAnswers ?? b.assessment);
    const intakeScope = criteriaScopeError('ORGANIZATION', intake);
    if (intakeScope) return json(res,400,{message:intakeScope});
    /* سازمان تازه به مستأجرِ سازنده تعلق می‌گیرد: دمو→demo، مالک→real، بقیه→personal */
    const o={id:`org-${Date.now()}`,name:b.name,type:b.type??'OTHER',industry:b.industry??null,country:b.country??null,parentOrganizationId:b.parentOrganizationId??null,
      tenant:authUser?(DEMO_USER_IDS.has(authUser.id)?'demo':(authUser.isOwner?'real':'personal')):'personal',createdAt:nowIso()};
    ORGS.push(o);
    // دمو: سازندهٔ سازمان آن را در محدودهٔ دید خود می‌گیرد تا ارزیابی اولیه بلافاصله ممکن باشد
    if (authUser && !authUser.isOwner && Array.isArray(authUser.accessibleOrganizationIds) && !authUser.accessibleOrganizationIds.includes(o.id)) authUser.accessibleOrganizationIds.push(o.id);
    if (intake.length) saveStoredAnswers('ORGANIZATION', o.id, intake);
    audit(req,'CREATE','organization',o.id,'OK',{name:o.name,criteriaAnswers:intake.length});
    await autoRunWorkflows('Organization',o.id,'ORGANIZATION_CREATED',{organization:{id:o.id,name:o.name,type:o.type,industry:o.industry,country:o.country}});
    return json(res,201,attachCriteria('ORGANIZATION',[{...o,owner:{name:'کاربر دمو'},_count:orgCounts(o)}])[0]);
  }
  const orgId=match('/organizations/:id');
  if(orgId&&method==='GET'){
    const o=ORGS.find(x=>x.id===orgId[0]);
    if(!o) return json(res,404,{message:'سازمان یافت نشد'});
    if(!inScope(req,o.id)) return json(res,403,{message:'دسترسی به این سازمان مجاز نیست.'});
    return json(res,200,attachCriteria('ORGANIZATION',[{...o,owner:{name:'کاربر دمو'},_count:orgCounts(o)}])[0]);
  }
  const orgTimeline=match('/organizations/:id/timeline');
  if(orgTimeline&&method==='GET'){
    const oid=orgTimeline[0];
    if(!inScope(req,oid)) return json(res,403,{message:'دسترسی به این سازمان مجاز نیست.'});
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
    return json(res,200,attachCriteria('PERSON',list.map(p=>({...p,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null}))));
  }
  const personId=match('/people/:id');
  if(personId&&method==='GET'){
    const p=PEOPLE.find(x=>x.id===personId[0]);
    if(!p) return json(res,404,{message:'شخص یافت نشد'});
    if(!inScope(req,p.organizationId)) return json(res,403,{message:'دسترسی به این شخص مجاز نیست.'});
    return json(res,200,attachCriteria('PERSON',[{...p,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null}])[0]);
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
    await autoRunWorkflows('Person',p.id,'PERSON_UPDATED',{person:{id:p.id,firstName:p.firstName,lastName:p.lastName,title:p.title,organizationId:p.organizationId,change:'affiliation'}});
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
    const mk=q.get('marketKind');
    if(mk && ['MARKET','NON_MARKET','HYBRID'].includes(mk)) list=list.filter(r=>r.marketKind===mk);
    const ent=q.get('isMarketEntry');
    if(ent==='true') list=list.filter(r=>r.isMarketEntry);
    else if(ent==='false') list=list.filter(r=>!r.isMarketEntry);
    const seg=q.get('marketSegment');
    if(seg) list=list.filter(r=>String(r.marketSegment||'').includes(seg));
    return json(res,200,attachCriteria('RELATIONSHIP',list.map(r=>({...relWithOrgs(r), riskDrivers:riskDrivers(req,r)}))));
  }
  if(is('/relationships')&&method==='POST'){
    const b=await readBody(req);
    if(!b.sourceOrganizationId||!b.targetOrganizationId) return json(res,400,{message:'سازمان مبدأ و مقصد لازم است.'});
    if(!inScope(req,b.sourceOrganizationId)||!inScope(req,b.targetOrganizationId)) return json(res,403,{message:'یکی از سازمان‌ها خارج از محدوده است.'});
    const relIntake=normalizeCriteriaAnswers(b.criteriaAnswers??b.assessment);
    const relIntakeScope=criteriaScopeError('RELATIONSHIP',relIntake);
    if(relIntakeScope) return json(res,400,{message:relIntakeScope});
        const mk = ['MARKET','NON_MARKET','HYBRID'].includes(String(b.marketKind)) ? String(b.marketKind) : 'MARKET';
        const seg = typeof b.marketSegment==='string' ? String(b.marketSegment).trim().slice(0,120) || null : null;
        const r={id:`r-${Date.now()}`,relationshipType:b.relationshipType??'OTHER',status:b.status??'ACTIVE',cadenceDays:CADENCE_DEFAULT[b.relationshipType]??60,healthScore:b.healthScore??60,riskScore:b.riskScore??30,strategicScore:b.strategicScore??50,influenceScore:b.influenceScore??50,opportunityScore:b.opportunityScore??50,resilienceScore:b.resilienceScore??50,nextActionAt:null,lastInteractionAt:nowIso(),sourceOrganizationId:b.sourceOrganizationId,targetOrganizationId:b.targetOrganizationId, marketKind:mk, isMarketEntry:!!b.isMarketEntry, marketSegment:seg};
    RELS.push(r); saveDb();
    if(relIntake.length) saveStoredAnswers('RELATIONSHIP',r.id,relIntake);
    audit(req,'CREATE','relationship',r.id,'OK',{source:r.sourceOrganizationId,target:r.targetOrganizationId,answers:relIntake.length});
    await autoRunWorkflows('Relationship', r.id, 'RELATIONSHIP_CREATED', { relationship: { id: r.id, sourceOrganizationId: r.sourceOrganizationId, targetOrganizationId: r.targetOrganizationId, relationshipType: r.relationshipType, status: r.status, healthScore: r.healthScore, strategicScore: r.strategicScore, riskScore: r.riskScore } });
    return json(res,201,attachCriteria('RELATIONSHIP',[relWithOrgs(r)])[0]);
  }
  /* --------------------- P1: سرمایهٔ رابطه، روند و برنامهٔ ۹۰ روزه --------------------- */
  if(is('/relationships/capital')&&method==='GET'){
    const rows=scopedRels(req).filter(r=>!r.deletedAt).map(r=>capitalRow(req,r));
    const n=rows.length||1;
    return json(res,200,{generatedAt:nowIso(),items:rows,totals:{
      count:rows.length,
      capital:rows.reduce((s,x)=>s+x.capital,0),
      avgCapital:Math.round(rows.reduce((s,x)=>s+x.capital,0)/n),
      avgConfidence:Math.round(rows.reduce((s,x)=>s+x.confidence,0)/n),
      avgDelta:Math.round(rows.reduce((s,x)=>s+x.delta90d,0)/n),
      up:rows.filter(x=>x.trend==='UP').length,down:rows.filter(x=>x.trend==='DOWN').length,flat:rows.filter(x=>x.trend==='FLAT').length,
      withPlan:rows.filter(x=>x.plan.exists).length,
      openOpportunityValue:rows.reduce((s,x)=>s+x.openValue,0),
    }});
  }
  // هشدارهای هوشمند روابط — بازاری/غیربازاری + نقطه ورود به بازار
  /* فاز ۳ (ADR-0007): منطق تشخیص به relationshipAlertItems() استخراج شد (تک‌منبع؛
     آستانه‌ها و kindها عیناً حفظ شده‌اند) — این endpoint برای سازگاری عقب‌رو همان خروجی قبلی را می‌دهد. */
  if(is('/relationships/alerts')&&method==='GET'){
    const alerts=relationshipAlertItems(req);
    return json(res,200,{generatedAt:nowIso(), total:alerts.length, items:alerts.slice(0,30), summary:{danger:alerts.filter(a=>a.tone==='danger').length, warning:alerts.filter(a=>a.tone==='warning').length, info:alerts.filter(a=>a.tone==='info').length, market:alerts.filter(a=>a.marketKind==='MARKET').length, nonMarket:alerts.filter(a=>a.marketKind==='NON_MARKET').length, entry:alerts.filter(a=>a.isMarketEntry).length}});
  }
  /* ── فاز ۳ (ADR-0007): هشدار یکپارچهٔ همهٔ ماژول‌ها — یک منبع، یک شکل، فیلترپذیر ── */
  if(is('/alerts')&&method==='GET'){
    const alertsCanView=authUser?.isOwner||(authUser?.permissions??[]).includes('dashboard.read'); /* همان hasPerm، اینجا inline چون const آن پایین‌تر تعریف می‌شود */
    if(!alertsCanView) return json(res,403,{message:'شما مجوز «مشاهدهٔ داشبورد» (dashboard.read) را ندارید.'});
    const modF=q.get('module');
    const sevF=q.get('severity');
    let items=collectUnifiedAlerts(req,authUser);
    if(modF&&Object.keys(ALERT_MODULE_FA).includes(modF)) items=items.filter(a=>a.module===modF);
    if(sevF&&['CRITICAL','WARNING','INFO'].includes(sevF)) items=items.filter(a=>a.severity===sevF);
    const byModule={}; for(const a of items) byModule[a.module]=(byModule[a.module]??0)+1;
    return json(res,200,{generatedAt:nowIso(), total:items.length,
      summary:{CRITICAL:items.filter(a=>a.severity==='CRITICAL').length,WARNING:items.filter(a=>a.severity==='WARNING').length,INFO:items.filter(a=>a.severity==='INFO').length,byModule},
      modules:Object.keys(ALERT_MODULE_FA).map(m=>({id:m,fa:ALERT_MODULE_FA[m]})),
      items:items.slice(0,200)});
  }
  const alertResolve=match('/alerts/:id/resolve');
  if(alertResolve&&method==='POST'){
    const alertsCanView=authUser?.isOwner||(authUser?.permissions??[]).includes('dashboard.read');
    if(!alertsCanView) return json(res,403,{message:'شما مجوز «مشاهدهٔ داشبورد» (dashboard.read) را ندارید.'});
    const id=alertResolve[0];
    const all=collectUnifiedAlerts(req,authUser);
    if(!all.some(a=>a.id===id)&&!(DB.alertResolutions??{})[id]) return json(res,404,{message:'هشدار یافت نشد.'});
    DB.alertResolutions=DB.alertResolutions??{};
    DB.alertResolutions[id]=nowIso();
    saveDb();
    audit(req,'UPDATE','alert',id,'OK',{resolved:true});
    return json(res,200,{id,resolvedAt:DB.alertResolutions[id]});
  }
  const relPulse=match('/relationships/:id/pulse');
  if(relPulse&&method==='GET'){
    const r=RELS.find(x=>x.id===relPulse[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    if(!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'دسترسی مجاز نیست.'});
    const c=relCapital(req,r),t=relTrend(r),plan=accountPlanOf(r.id);
    const openOpps=scopedOpps(req).filter(o=>!o.deletedAt&&o.relationshipId===r.id&&!['WON','LOST'].includes(o.status));
    return json(res,200,{relationship:relWithOrgs(r),capital:c,trend:t,classKey:relClass(r),classLabel:REL_CLASS_LABELS[relClass(r)],
      plan:plan?{...plan,items:plan.items.map(i=>({...i,owner:personById(i.ownerId)?{id:i.ownerId,name:`${personById(i.ownerId).firstName} ${personById(i.ownerId).lastName}`}:null}))}:null,
      openOpportunities:openOpps.map(o=>({id:o.id,name:o.name,status:o.status,probability:o.probability,value:o.value})),
      riskDrivers:riskDrivers(req,r)});
  }
  /* P2-5: پالس ۹۰ روزه — پرسش، پاسخ و حلقهٔ بسته */
  const relPulseSurvey=match('/relationships/:id/pulse-survey');
  if(relPulseSurvey&&method==='GET'){
    const r=RELS.find(x=>x.id===relPulseSurvey[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    if(!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'دسترسی مجاز نیست.'});
    return json(res,200,pulseSurveyView(req,r));
  }
  if(relPulseSurvey&&method==='POST'){
    const r=RELS.find(x=>x.id===relPulseSurvey[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    if(!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'دسترسی مجاز نیست.'});
    const b=await readBody(req);
    const given=(b.answers??[]).filter(a=>a.questionId&&String(a.score)!==''&&a.score!=null);
    if(given.length<PULSE_QUESTIONS.length) return json(res,400,{message:'هر سه پرسش باید پاسخ داده شوند.'});
    const lastPulse=(DB.pulseSurveys??[]).filter(x=>x.relationshipId===r.id).sort((a,b)=>b.answeredAt.localeCompare(a.answeredAt))[0];
    if(lastPulse&&new Date(lastPulse.nextDueAt).getTime()>Date.now())
      return json(res,409,{code:'PULSE_WINDOW_OPEN',message:`پاسخ بعدی از ${faDate(lastPulse.nextDueAt)} مجاز است — حلقهٔ ۹۰ روزه.`});
    const out=pulseSurveySubmit(req,r,b.answers??[]);
    if(out.code!==200) return json(res,out.code,{message:out.msg});
    audit(req,'PULSE_SURVEY','relationship',r.id,'OK',{avgScore:out.row.avgScore});
    return json(res,201,{ok:true,result:out.row,view:pulseSurveyView(req,r)});
  }
  const relPlan=match('/relationships/:id/account-plan');
  if(relPlan&&method==='GET'){
    const r=RELS.find(x=>x.id===relPlan[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    const plan=accountPlanOf(r.id);
    if(!plan) return json(res,200,{exists:false,relationshipId:r.id});
    return json(res,200,{exists:true,...plan,summary:planStatusFor(r.id),items:plan.items.map(i=>({...i,owner:personById(i.ownerId)?{id:i.ownerId,name:`${personById(i.ownerId).firstName} ${personById(i.ownerId).lastName}`}:null}))});
  }
  if(relPlan&&method==='POST'){
    const r=RELS.find(x=>x.id===relPlan[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    const b=await readBody(req);
    if(!String(b.title??'').trim()) return json(res,400,{message:'عنوان اقدام الزامی است.'});
    const plan=accountPlanOf(r.id)??{id:`ap-${Date.now()}`,relationshipId:r.id,horizonDays:90,status:'ON_TRACK',reviewCycleDays:30,reviewDates:[],riskNote:'',items:[]};
    plan.items.push({id:`api-${Date.now()}`,title:String(b.title).trim().slice(0,220),ownerId:String(b.ownerId??'').trim()||null,dueAt:b.dueAt?String(b.dueAt):null,status:'TODO',focus:String(b.focus??'').trim().slice(0,60)||'عمومی'});
    DB.accountPlans=DB.accountPlans??{}; DB.accountPlans[r.id]=plan;
    const owner=plan.items[plan.items.length-1].ownerId?personById(plan.items[plan.items.length-1].ownerId):null;
    saveDb(); audit(req,'UPDATE','account-plan',r.id,'OK',{meta:{action:'add-item',title:plan.items[plan.items.length-1].title}});
    return json(res,201,{exists:true,...plan,summary:planStatusFor(r.id),items:plan.items.map(i=>({...i,owner:personById(i.ownerId)?{id:i.ownerId,name:`${personById(i.ownerId).firstName} ${personById(i.ownerId).lastName}`}:null}))});
  }
  if(relPlan&&method==='PATCH'){
    const r=RELS.find(x=>x.id===relPlan[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    const plan=accountPlanOf(r.id);
    if(!plan) return json(res,404,{message:'برنامهٔ ۹۰ روزه برای این رابطه ثبت نشده است.'});
    const b=await readBody(req);
    if(typeof b.riskNote==='string') plan.riskNote=b.riskNote.slice(0,500);
    if(['ON_TRACK','NEEDS_ATTENTION','AT_RISK'].includes(b.status)) plan.status=b.status;
    saveDb(); audit(req,'UPDATE','account-plan',r.id,'OK',{meta:{action:'update-plan'}});
    return json(res,200,{exists:true,...plan,summary:planStatusFor(r.id)});
  }
  const relPlanItem=match('/relationships/:id/account-plan/items/:itemId');
  if(relPlanItem&&method==='PATCH'){
    const r=RELS.find(x=>x.id===relPlanItem[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'}); 
    const plan=accountPlanOf(r.id);
    if(!plan) return json(res,404,{message:'برنامهٔ ۹۰ روزه برای این رابطه ثبت نشده است.'});
    const item=plan.items.find(i=>i.id===relPlanItem[1]);
    if(!item) return json(res,404,{message:'اقدام برنامه یافت نشد.'});
    const b=await readBody(req);
    if(['TODO','IN_PROGRESS','DONE','BLOCKED'].includes(b.status)) item.status=b.status;
    if(typeof b.title==='string'&&String(b.title).trim()) item.title=String(b.title).trim().slice(0,220);
    if(b.ownerId!==undefined) item.ownerId=b.ownerId||null;
    if(b.dueAt!==undefined) item.dueAt=b.dueAt||null;
    if(typeof b.focus==='string'&&String(b.focus).trim()) item.focus=String(b.focus).trim().slice(0,60);
    saveDb(); audit(req,'UPDATE','account-plan-item',item.id,'OK',{meta:{status:item.status,title:item.title}});
    return json(res,200,{...item,owner:item.ownerId&&personById(item.ownerId)?{id:item.ownerId,name:`${personById(item.ownerId).firstName} ${personById(item.ownerId).lastName}`}:null});
  }
  const relId=match('/relationships/:id');
  if(relId&&method==='GET'){
    const r=RELS.find(x=>x.id===relId[0]);
    if(!r) return json(res,404,{message:'رابطه یافت نشد'});
    if(!inScope(req,r.sourceOrganizationId)||!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'دسترسی مجاز نیست.'});
    return json(res,200,attachCriteria('RELATIONSHIP',[{...relWithOrgs(r), riskDrivers:riskDrivers(req,r)}])[0]);
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
    const mOrg=b.organizationId??(mRel?mRel.sourceOrganizationId:primaryOrgId(authUser));
    if(!mOrg) return json(res,400,{message:'سازمان جلسه لازم است (رابطه یا سازمان مرتبط را انتخاب کنید).'});
    if(mOrg&&!inScope(req,mOrg)) return json(res,403,{message:'سازمانِ جلسه خارج از محدودهٔ دسترسی شماست.'});
    if(mRel&&!relInScope(req,mRel)) return json(res,403,{message:'رابطهٔ جلسه خارج از محدودهٔ دسترسی شماست.'});
    const participants=Array.isArray(b.participants)?b.participants.map(p=>typeof p==='string'?{personId:p}:{personId:p?.personId??p?.id}).filter(p=>p.personId):[];
    if(participants.length&&!authUser?.isOwner) for(const p of participants){ const per=personById(p.personId); if(!per) return json(res,404,{message:`شخص ${p.personId} یافت نشد.`}); if(!inScope(req,per.organizationId)) return json(res,403,{message:'یکی از شرکت‌کنندگان خارج از محدودهٔ دسترسی شماست.'}); }
    const m={id:`m-${Date.now()}`,title:b.title,startAt:b.startAt,endAt:b.endAt??null,objective:b.objective??null,agenda:b.agenda??null,outcome:null,notes:null,preMeetingBrief:null,location:b.location??null,meetingUrl:b.meetingUrl??null,organizationId:mOrg,relationshipId:b.relationshipId??null,participants,actions:[],commitments:[]};
    MEETINGS.unshift(m);
    audit(req,'CREATE','meeting',m.id,'OK',{title:m.title});
    await autoRunWorkflows('Meeting', m.id, 'MEETING_CREATED', { meeting: { id: m.id, title: m.title, relationshipId: m.relationshipId, organizationId: m.organizationId, participants: m.participants } });
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
    await autoRunWorkflows('Meeting',m.id,'MEETING_COMPLETED',{meeting:{id:m.id,title:m.title,outcome:b.outcome.trim(),relationshipId:m.relationshipId??null,organizationId:m.organizationId??null}});
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
  /* P2-3: هوشمندی جلسه (قاعده‌مبنا + برچسب انسانی) */
  const meetingIntelGet=match('/meetings/:id/intel');
  const meetingIntelLabel=match('/meetings/:id/intel/label');
  if(meetingIntelGet&&method==='GET'){
    const g=meetingGuard(meetingIntelGet[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const out=meetingIntel(g.m);
    out.humanLabel=DB.meetingIntelLabels?.[g.m.id]??g.m.intelTone??null;
    return json(res,200,out);
  }
  if(meetingIntelLabel&&method==='POST'){
    const g=meetingGuard(meetingIntelLabel[0]); if(g.code) return json(res,g.code,{message:g.msg});
    const b=await readBody(req);
    const tone=String(b.tone??'');
    if(!['POSITIVE','NEUTRAL','CONCERNED'].includes(tone)) return json(res,400,{message:'برچسب باید POSITIVE، NEUTRAL یا CONCERNED باشد.'});
    DB.meetingIntelLabels=DB.meetingIntelLabels??{};
    DB.meetingIntelLabels[g.m.id]=tone; g.m.intelTone=tone;
    saveDb();
    audit(req,'MEETING_INTEL_LABEL','meeting',g.m.id,'OK',{tone});
    return json(res,200,{ok:true,tone,humanLabel:tone});
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
    ACTIONS.push(a); audit(req,'CREATE','action',a.id,'OK',{title:a.title});
    await autoRunWorkflows('Action', a.id, 'ACTION_CREATED', { action: { id: a.id, title: a.title, status: a.status, priority: a.priority, relationshipId: a.relationshipId, organizationId: a.organizationId } });
    return json(res,201,actionView(a));
  }
  if(is('/commitments')&&method==='GET') return json(res,200,scopedCommitments(req).map(commitmentView));
  if(is('/projects')&&method==='GET') return json(res,200,scopedProjects(req).map(projectView));
  if(is('/opportunities')&&method==='GET') return json(res,200,attachCriteria('OPPORTUNITY',scopedOpps(req).map(opportunityView)));
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
    const allowed=['subject','summary','outcome','durationMinutes','importance','sentiment','followUpRequired','followUpAt','type','occurredAt','purpose','channel','quality','result','direction','nextStep','nextStepAt'];
    const before={...x};
    for(const k of allowed){
      if(b[k]===undefined) continue;
      if(k==='importance'&&b[k]&&!PRIORITY_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:`اهمیت «${b[k]}» نامعتبر است.`});
      if(k==='type'&&b[k]&&!INTERACTION_KIND_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:`نوع «${b[k]}» نامعتبر است.`});
      if(k==='sentiment'&&b[k]!=null&&![ -1, 0, 1].includes(Number(b[k]))) return json(res,400,{message:'احساس باید یکی از مقادیر ‎-۱، ۰ یا ۱ باشد.'});
      if(k==='durationMinutes'&&b[k]!=null&&(!Number.isFinite(Number(b[k]))||Number(b[k])<1)) return json(res,400,{message:'مدت باید عددی بزرگ‌تر از صفر باشد.'});
      if(k==='purpose'&&b[k]&&!INTERACTION_PURPOSE_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:'هدف تعامل نامعتبر است.'});
      if(k==='channel'&&b[k]&&!INTERACTION_CHANNEL_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:'کانال نامعتبر است.'});
      if(k==='result'&&b[k]&&!INTERACTION_RESULT_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:'نتیجهٔ تعامل نامعتبر است.'});
      if(k==='direction'&&b[k]&&!INTERACTION_DIRECTION_LIST.includes(String(b[k]).toUpperCase())) return json(res,400,{message:'جهت نامعتبر است.'});
      if(k==='quality'&&b[k]!=null&&(!Number.isFinite(Number(b[k]))||Number(b[k])<1||Number(b[k])>5)) return json(res,400,{message:'کیفیت باید بین ۱ تا ۵ باشد.'});
      if(k==='nextStepAt'&&b[k]!==''&&b[k]!=null&&Number.isNaN(new Date(b[k]).getTime())) return json(res,400,{message:'موعد قدم بعدی نامعتبر است.'});
      x[k]=k==='importance'?String(b[k]).toUpperCase():k==='type'?String(b[k]).toUpperCase():b[k];
      if(k==='followUpAt'&&b[k]==='') x.followUpAt=null;
      if(k==='nextStepAt'&&b[k]==='') x.nextStepAt=null;
    }
    if(b.followUpRequired===false) x.followUpAt=null;
    applyInteractionToRel(x.relationshipId?RELS.find(r=>r.id===x.relationshipId):null,x);
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
  if(is('/notifications')&&method==='GET') return json(res,200,visibleNotifications(req));
  if(is('/notifications/unread-count')&&method==='GET') return json(res,200,{count:visibleNotifications(req).filter(n=>!n.isRead).length});
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
      counts:{organizations:scopedOrgs(req).length,people:scopedPeople(req).length,relationships:scopedRels(req).length,meetings:scopedMeetings(req).length,actions:scopedActions(req).length,commitments:scopedCommitments(req).length,projects:scopedProjects(req).length,opportunities:scopedOpps(req).length,notifications:visibleNotifications(req).length,unreadNotifications:visibleNotifications(req).filter(n=>!n.isRead).length,workflowExecutions},
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
    function sourceRows(types){return opps.filter(o=>types.includes(o.sourceType??''));}
    function srcRate(rows){return rows.length?Math.round(rows.filter(o=>o.status==='WON').length/rows.length*100):0;}
    const warmRows=sourceRows(['REFERRAL','EXISTING_RELATIONSHIP']);
    const coldRows=sourceRows(['EVENT','COLD']);
    const attribution={bySource:OPPORTUNITY_SOURCE_LIST.map(t=>{const rows=opps.filter(o=>(o.sourceType??'COLD')===t); return {type:t,count:rows.length,won:rows.filter(o=>o.status==='WON').length,value:rows.reduce((s,o)=>s+(Number(o.value)||0),0)};}),
      warm:{count:warmRows.length,won:warmRows.filter(o=>o.status==='WON').length,value:warmRows.reduce((s,o)=>s+(Number(o.value)||0),0),rate:srcRate(warmRows)},
      cold:{count:coldRows.length,won:coldRows.filter(o=>o.status==='WON').length,value:coldRows.reduce((s,o)=>s+(Number(o.value)||0),0),rate:srcRate(coldRows)}};
    return json(res,200,{
      generatedAt:nowIso(),organizationId:qOrg??null,relationshipCount:rels.length,peopleCount:people.length,opportunityCount:opps.length,
      networkCapital:{score:capital,components},
      strategicRelationshipIndex:{score:sri,breakdown:{coverage,strength:quality,influence,opportunity:opportunityPotential,resilience}},
      relationshipResilienceScore:resilience,weightedOpportunityValue,
      referralSuccessRate:{total:refs.length,successful,rate:anPct(successful,refs.length)},
      attribution,bounded:true,
    });
  }
  /* --------------------- P1: کالیبراسیون و رویدادهای شغلی --------------------- */
  if(is('/analytics/calibration')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    return json(res,200,calibrationView(req));
  }
  if(is('/analytics/calibration/half-life')&&method==='PATCH'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    const b=await readBody(req);
    const fam=String(b.family??'').trim();
    const days=Number(b.days);
    const known=Object.keys(KB_FAMILY_LABELS);
    if(!known.includes(fam)) return json(res,400,{message:'خانوادهٔ معیار نامعتبر است.'});
    if(!Number.isFinite(days)||days<15||days>365) return json(res,400,{message:'نیمه‌عمر باید بین ۱۵ تا ۳۶۵ روز باشد.'});
    DB.calibrationSettings=DB.calibrationSettings??seedCalibrationSettings();
    DB.calibrationSettings.familyOverrides[fam]=Math.round(days);
    DB.calibrationSettings.lastRun=nowIso();
    saveDb(); audit(req,'UPDATE','calibration-half-life',fam,'OK',{days:Math.round(days)});
    return json(res,200,{family:fam,days:Math.round(days),familyOverrides:DB.calibrationSettings.familyOverrides});
  }
  if(is('/analytics/career-events')&&method==='GET'){
    if(!canAn('analytics.read')) return json(res,403,{message:AN_READ_MSG});
    return json(res,200,careerEventsView(req));
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
  /* چرخهٔ عمر پیشنهاد — parity با recommendations.controller.ts واقعی:
     POST :id/view|accept|approve|reject|snooze|assign|execute + PATCH :id
     (مسیر فارسی «تأیید» برای سازگاری عقب‌رو نگه داشته شد) */
  const recAction = path.match(new RegExp(`^${V1}/recommendations/([^/]+)/(approve|accept|تأیید|reject|snooze|execute|assign|view)$`));
  if(recAction && method==='POST'){
    const rec=RECS.find(x=>x.id===recAction[1]);
    if(!rec) return json(res,404,{message:'پیشنهاد یافت نشد'});
    if(rec.relationshipId&&!relInScope(req,RELS.find(r=>r.id===rec.relationshipId))) return json(res,403,{message:'دسترسی به این پیشنهاد مجاز نیست.'});
    const action=recAction[2];
    if(action==='approve'||action==='accept'||action==='تأیید'){
      if(!['PROPOSED','SNOOZED','ASSIGNED'].includes(rec.status)) return json(res,400,{message:'Recommendation is not approvable'});
      rec.status='APPROVED'; rec.decisionById=authUser.id; rec.decisionAt=nowIso(); rec.snoozedUntil=null;
      audit(req,'APPROVE','recommendation',rec.id,'OK');
      NOTIFICATIONS.unshift({id:`n-${Date.now()}`,title:'پیشنهاد تأیید شد',body:`«${rec.title}» تأیید شد و آمادهٔ اجراست.`,type:'RECOMMENDATION',priority:'information',isRead:false,createdAt:nowIso()});
      return json(res,200,rec);
    }
    if(action==='reject'){
      if(['REJECTED','EXECUTED','ARCHIVED'].includes(rec.status)) return json(res,400,{message:'Recommendation cannot be rejected'});
      rec.status='REJECTED'; rec.decisionById=authUser.id; rec.decisionAt=nowIso(); audit(req,'REJECT','recommendation',rec.id,'OK'); return json(res,200,rec);
    }
    if(action==='snooze'){
      const b=await readBody(req);
      if(!b.until||new Date(b.until).getTime()<=Date.now()) return json(res,400,{message:'Snooze time must be in the future'});
      rec.status='SNOOZED'; rec.snoozedUntil=b.until; return json(res,200,rec);
    }
    if(action==='assign'){
      const b=await readBody(req);
      if(!b.assigneeId) return json(res,400,{message:'assigneeId لازم است.'});
      const u=Object.values(SEED_USERS).find(x=>x.id===b.assigneeId);
      if(!u||u.isActive===false) return json(res,400,{message:'Assignee is not active'});
      rec.assignedToId=b.assigneeId; rec.status='ASSIGNED'; return json(res,200,rec);
    }
    if(action==='view'){
      audit(req,'READ','recommendation',rec.id,'OK');
      return json(res,200,rec);
    }
    if(action==='execute'){
      if(rec.status!=='APPROVED') return json(res,400,{message:'Recommendation must be approved before execution'});
      if(!rec.relationshipId) return json(res,400,{message:'Executable recommendation requires a relationship'});
      rec.status='EXECUTED'; rec.decisionById=authUser.id; rec.decisionAt=nowIso();
      const actionId=`a-${Date.now()}`;
      /* اولویت مثل سرویس واقعی: RISK_MITIGATION→HIGH · EXECUTIVE_ESCALATION→CRITICAL · بقیه MEDIUM */
      const priority=rec.type==='RISK_MITIGATION'?'HIGH':rec.type==='EXECUTIVE_ESCALATION'?'CRITICAL':'MEDIUM';
      const actionRow={id:actionId,title:rec.title,status:'OPEN',priority,dueAt:new Date(Date.now()+7*86400000).toISOString(),ownerId:rec.assignedToId??authUser.id,relationshipId:rec.relationshipId,recommendationId:rec.id,createdAt:nowIso()};
      ACTIONS.push(actionRow); saveDb();
      audit(req,'EXECUTE','recommendation',rec.id,'OK',{actionId});
      NOTIFICATIONS.unshift({id:`n-${Date.now()}`,title:'اقدام از پیشنهاد ایجاد شد',body:`از پیشنهاد «${rec.title}» اقدام «${actionRow.title}» ساخته شد.`,type:'SYSTEM',priority:'important',isRead:false,createdAt:nowIso()});
      return json(res,200,{recommendation:rec,action:actionRow});
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
  if(recId&&method==='PATCH'){
    const rec=RECS.find(x=>x.id===recId[0]);
    if(!rec) return json(res,404,{message:'پیشنهاد یافت نشد'});
    if(rec.relationshipId&&!relInScope(req,RELS.find(r=>r.id===rec.relationshipId))) return json(res,403,{message:'دسترسی به این پیشنهاد مجاز نیست.'});
    const b=await readBody(req);
    if(b.title!==undefined){ if(!String(b.title).trim()) return json(res,400,{message:'عنوان نمی‌تواند خالی باشد.'}); rec.title=String(b.title).trim(); }
    if(b.rationale!==undefined) rec.rationale=String(b.rationale);
    if(b.confidence!==undefined){ const c=Number(b.confidence); if(!Number.isFinite(c)||c<0||c>100) return json(res,400,{message:'اطمینان باید بین ۰ تا ۱۰۰ باشد.'}); rec.confidence=Math.round(c); }
    audit(req,'UPDATE','recommendation',rec.id,'OK');
    return json(res,200,rec);
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
    const rels=scopedRels(req).slice(0,40).filter(r=>!q.get('status')||r.status===q.get('status'));
    // org nodes: فقط سازمان‌های درون محدودهٔ دسترسی — همتای network.service.ts واقعی.
    // (گرهٔ «طرف مقابل» ساخته نمی‌شود؛ یال رابطه فقط وقتی پذیرفته می‌شود که هر دو سرش گره باشند.
    //  برای مستأجر یعنی: سازمان خودش + اشخاصش؛ طرف‌های مقابل در فهرست روابط قابل مشاهده‌اند.)
    ORGS.forEach(o=>{
      const visible=inScope(req,o.id);
      if(!visible||!wantOrg) return;
      if(term&&!o.name.toLowerCase().includes(term)) return;
      orgNodes.push({id:`org:${o.id}`,label:o.name,type:'organization',organizationId:o.id});
    });
    scopedPeople(req).forEach(p=>{
      if(!wantPerson) return;
      if(term&&!`${p.firstName} ${p.lastName}`.toLowerCase().includes(term)) return;
      personNodes.push({id:`person:${p.id}`,label:`${p.firstName} ${p.lastName}`,type:'person',organizationId:p.organizationId});
    });
    /* P3: برچسب دستهٔ عموم‌ها روی گره‌ها + گرهٔ «خودِ شرکت» (ego) */
    const egoOrg=q.get('organizationId')
      ||(currentUser(req)?.memberships??[]).find(m=>m.isPrimary)?.organizationId
      ||(visibleOrgIds(req)[0]??null);
    for(const n of [...orgNodes,...personNodes]){
      n.category=pubCatOfOrg(n.organizationId)??null;
      n.ego=n.type==='organization'&&n.organizationId===egoOrg;
    }
    const nodes=[...orgNodes,...personNodes];
    const nodeIds=new Set(nodes.map(n=>n.id));
    const edges=[];
    rels.forEach(r=>{
      const s=`org:${r.sourceOrganizationId}`,t=`org:${r.targetOrganizationId}`;
      if(!nodeIds.has(s)||!nodeIds.has(t)) return;
      edges.push({id:`e-${r.id}`,source:s,target:t,kind:'relationship',edgeCategory:orgColumn(r.sourceOrganizationId)==='TEAM'?orgColumn(r.targetOrganizationId):orgColumn(r.sourceOrganizationId),weight:Math.round(30+(r.healthScore??50)/2),risk:r.riskScore??0,strategicImportance:r.strategicScore??50,status:r.status,health:r.healthScore,heat:Math.round(0.6*(r.healthScore??50)+0.4*(100-(r.riskScore??0)))});
    });
    scopedPeople(req).forEach(p=>{
      const pid=`person:${p.id}`,oid=`org:${p.organizationId}`;
      if(!nodeIds.has(pid)||!nodeIds.has(oid)) return;
      edges.push({id:`pm-${p.id}`,source:pid,target:oid,kind:'membership',edgeCategory:orgColumn(p.organizationId),weight:15,risk:0,strategicImportance:0});
    });
    // person↔person edges derived from shared meeting participation
    const personEdges=new Set();
    MEETINGS.forEach(m=>{
      const parts=(m.participants??[]).map((x)=>`person:${x.personId}`).filter((pid)=>nodeIds.has(pid));
      for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
        const key=[parts[i],parts[j]].sort().join('|');
        if(personEdges.has(key))continue;
        personEdges.add(key);
        const pc=orgColumn(m.organizationId??'org-1');
        edges.push({id:`pp-${m.id}-${i}-${j}`,source:parts[i],target:parts[j],kind:'person_relationship',edgeCategory:pc,weight:12,risk:0,strategicImportance:35});
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
  if(is('/network/path')&&method==='GET'){
    const fromRaw=q.get('from')??'',toRaw=q.get('to')??'';
    const fromId=fromRaw.startsWith('org:')?fromRaw.slice(4):fromRaw;
    const toId=toRaw.startsWith('org:')?toRaw.slice(4):toRaw;
    const mode=q.get('mode')==='best'?'best':'shortest';
    if(!fromId||!toId) return json(res,400,{message:'مبدأ و مقصد مسیر الزامی است.'});
    return json(res,200,netPathOrg(req,fromId,toId,mode,{maxHops:Number(q.get('maxHops'))||3}));
  }
  /* گراف ۴ ستون (P1-6) */
  if(is('/network/columns')&&method==='GET') return json(res,200,networkColumns(req));
  /* P2-2: SNA پیشرفته + پذیرش پیشنهاد پیوند */
  if(is('/network/sna')&&method==='GET') return json(res,200,snaView(req));
  /* P3-3: GNN سبک — پیش‌بینی پیوند/خوشه/مسیر گرم */
  if(is('/network/predict')&&method==='GET') return json(res,200,predictView(req));
  {
    const esAccept=match('/network/edge-suggestions/:id/accept');
    if(esAccept&&method==='POST'){
      const id=esAccept[0];
      DB.edgeSuggestionAccepts=Array.isArray(DB.edgeSuggestionAccepts)?DB.edgeSuggestionAccepts:[];
      if(!DB.edgeSuggestionAccepts.some(x=>x.suggestionId===id)){
        DB.edgeSuggestionAccepts.push({suggestionId:id,userId:currentUser(req)?.id??'u-demo',at:nowIso()});
        saveDb();
        NOTIFICATIONS.unshift({id:`n-${Date.now()}`,userId:currentUser(req)?.id??'u-demo',title:'پیشنهاد معرفی پذیرفته شد',body:`پیوند پیشنهادی ${id} برای پیگیری معرفی ثبت شد.`,type:'INFO',priority:'MEDIUM',isRead:false,createdAt:nowIso()});
      }
      return json(res,200,{ok:true,...snaView(req)});
    }
  }
  if(is('/network/connectors')&&method==='GET') return json(res,200,netAnalytics(req,'connectors'));
  if(is('/network/centrality')&&method==='GET') return json(res,200,netAnalytics(req,'centrality'));
  if(is('/network/bridges')&&method==='GET') return json(res,200,netAnalytics(req,'bridges'));
  if(is('/network/bottlenecks')&&method==='GET') return json(res,200,netAnalytics(req,'bottlenecks'));
  if(is('/network/single-points-of-failure')&&method==='GET') return json(res,200,netAnalytics(req,'single-points-of-failure'));
  if(match('/network/:endpoint')&&method==='GET') return json(res,200,{count:0,items:[]});

  /* ----------------------------- مرکز دانش ----------------------------- */
  if(is('/knowledge')&&method==='GET'){
    const uid=authUser?.id??null;
    const qq=String(q.get('q')??'').trim().toLowerCase();
    const cat=q.get('category')??'';
    const tag=q.get('tag')??'';
    const onlyMine=q.get('mine')==='1';
    let list=(DB.knowledge??[]).map((a)=>({...a}));
    if(onlyMine&&uid) list=list.filter((a)=>a.author===uid);
    if(cat) list=list.filter((a)=>a.category===cat);
    if(tag) list=list.filter((a)=>Array.isArray(a.tags)&&a.tags.includes(tag));
    if(qq) list=list.filter((a)=>`${a.title} ${a.excerpt} ${a.body} ${(a.tags??[]).join(' ')}`.toLowerCase().includes(qq));
    const tags=[...new Set((DB.knowledge??[]).flatMap((a)=>a.tags??[]))].sort((x,y)=>x.localeCompare(y,'fa'));
    const stats={
      total:(DB.knowledge??[]).length,
      views:(DB.knowledge??[]).reduce((sum,a)=>sum+(a.views??0),0),
      helpful:(DB.knowledge??[]).reduce((sum,a)=>sum+(a.helpful??0),0),
      mine:uid?(DB.knowledge??[]).filter((a)=>a.author===uid).length:0,
      bookmarks:uid?(DB.knowledge??[]).filter((a)=>Array.isArray(a.bookmarks)&&a.bookmarks.includes(uid)).length:0,
    };
    return json(res,200,{items:list.map((a)=>kbSummary(a,uid)),categories:KB_CATEGORIES,tags,stats});
  }
  {
    const kBook=match('/knowledge/:id/bookmark');
    const kVote=match('/knowledge/:id/vote');
    const kId=match('/knowledge/:id');
    if(kId||kBook||kVote){
      const uid=authUser?.id??'u-demo';
      const findArt=(idOrSlug)=>{
        const key=String(idOrSlug);
        return (DB.knowledge??[]).find((a)=>a.id===key||a.slug===key);
      };
      if(kBook&&method==='POST'){
        const art=findArt(kBook[0]);
        if(!art) return json(res,404,{message:'مقاله یافت نشد.'});
        art.bookmarks=Array.isArray(art.bookmarks)?art.bookmarks:[];
        const on=art.bookmarks.includes(uid);
        art.bookmarks=on?art.bookmarks.filter((x)=>x!==uid):[...art.bookmarks,uid];
        saveDb();
        return json(res,200,{bookmarked:!on,count:art.bookmarks.length});
      }
      if(kVote&&method==='POST'){
        const art=findArt(kVote[0]);
        if(!art) return json(res,404,{message:'مقاله یافت نشد.'});
        const b=await readBody(req);
        const helpful=b?.helpful!==false;
        if(helpful) art.helpful=(art.helpful??0)+1; else art.notHelpful=(art.notHelpful??0)+1;
        saveDb();
        return json(res,200,{kind:helpful?'helpful':'notHelpful',helpful:art.helpful,notHelpful:art.notHelpful});
      }
      if(kId&&method==='GET'){
        const art=findArt(kId[0]);
        if(!art) return json(res,404,{message:'مقاله یافت نشد.'});
        art.views=(art.views??0)+1; saveDb();
        const related=(DB.knowledge??[])
          .filter((x)=>x.id!==art.id&&(x.category===art.category||(x.families??[]).some((f)=>(art.families??[]).includes(f))))
          .sort((x,y)=>((y.views??0)-(x.views??0))).slice(0,4)
          .map((x)=>kbSummary(x,uid));
        return json(res,200,{...kbSummary(art,uid),body:art.body,related,familyLabels:KB_FAMILY_LABELS});
      }
      if(kId&&method==='PATCH'){
        if(!authUser?.isOwner) return json(res,403,{message:'ویرایش مقاله فقط برای مالک است.'});
        const art=findArt(kId[0]);
        if(!art) return json(res,404,{message:'مقاله یافت نشد.'});
        const b=await readBody(req);
        for(const k of ['title','excerpt','body','category','readMinutes']){
          if(b[k]!==undefined && (typeof b[k]==='string'||typeof b[k]==='number') && String(b[k]).trim()) art[k]=k==='readMinutes'?Math.max(1,Math.min(60,Number(b[k]))):b[k];
        }
        if(Array.isArray(b.tags)) art.tags=b.tags.map(String).filter(Boolean).slice(0,8);
        if(Array.isArray(b.families)) art.families=b.families.filter((f)=>KB_FAMILY_LABELS[f]).slice(0,8);
        art.updatedAt=nowIso();
        saveDb();
        audit(req,'UPDATE','KnowledgeArticle',art.id,'OK',{meta:{title:art.title}});
        return json(res,200,kbSummary(art,uid));
      }
      if(kId&&method==='DELETE'){
        if(!authUser?.isOwner) return json(res,403,{message:'حذف مقاله فقط برای مالک است.'});
        const art=findArt(kId[0]);
        if(!art) return json(res,404,{message:'مقاله یافت نشد.'});
        DB.knowledge=(DB.knowledge??[]).filter((x)=>x.id!==art.id);
        saveDb();
        audit(req,'DELETE','KnowledgeArticle',art.id,'OK',{meta:{title:art.title}});
        return json(res,200,{removed:true});
      }
    }
  }
  if(is('/knowledge')&&method==='POST'){
    if(!authUser?.isOwner) return json(res,403,{message:'ساخت مقاله فقط برای مالک است.'});
    const b=await readBody(req);
    if(!String(b.title??'').trim()||!String(b.body??'').trim()) return json(res,400,{message:'عنوان و متن مقاله الزامی است.'});
    const category=KB_CATEGORIES.find((c)=>c.key===b.category)?.key??'GETTING_STARTED';
    const slug=String(b.title).trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'article-'+Date.now();
    const art={id:'kb-'+Date.now(),slug,titleslug:slug,title:String(b.title).trim(),excerpt:String(b.excerpt??'').trim().slice(0,220)||String(b.body).trim().slice(0,180),category,tags:(Array.isArray(b.tags)?b.tags:[]).map(String).filter(Boolean).slice(0,8),families:(Array.isArray(b.families)?b.families:[]).filter((f)=>KB_FAMILY_LABELS[f]).slice(0,8),readMinutes:Math.max(1,Math.min(60,Number(b.readMinutes)|| Math.ceil(String(b.body).length/700))),author:authUser?.email??authUser?.name??'کارشناس',body:String(b.body),updatedAt:nowIso(),views:0,helpful:0,notHelpful:0,bookmarks:[]};
    DB.knowledge=[...((DB.knowledge??[]).filter((x)=>x.id!==art.id)),art];
    saveDb();
    audit(req,'CREATE','KnowledgeArticle',art.id,'OK',{meta:{title:art.title,category}});
    return json(res,201,kbSummary(art,authUser?.id??'u-demo'));
  }

  /* ----------------------------- documents ----------------------------- */
  if(is('/documents')&&method==='GET'){
    const organizationId=q.get('organizationId')??'';
    let list=(DB.documents??seedDocuments()).map((d)=>({...d}));
    /* اسناد هم مثل بقیهٔ داده درون محدودهٔ مستأجر می‌مانند */
    list=list.filter((d)=>d.organizationId?inScope(req,d.organizationId):false);
    if(organizationId) list=list.filter((d)=>d.organizationId===organizationId);
    return json(res,200,list);
  }
  if(is('/documents/status')&&method==='GET'){
    const list=(DB.documents??seedDocuments()).filter((d)=>d.organizationId?inScope(req,d.organizationId):false);
    return json(res,200,{module:'اسناد',status:'READY',total:list.length,indexed:list.filter((d)=>d.indexStatus==='INDEXED').length,pending:list.filter((d)=>d.scanStatus==='QUARANTINED'||d.uploadStatus==='PENDING').length,capabilities:['اعتبارسنجی نوع فایل/پسوند','قرنطینه','اسکن بدافزار','تکه‌تکه‌کردن و پاکسازی','دانلود امضاشده'],capabilitiesCount:5});
  }

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
      if(r.healthScore<45) evidence.push({type:'سلامت پایین',refId:r.id,title:`سلامت رابطه ${r.healthScore} از ۱۰۰ — زیر آستانهٔ ۴۵`,at:null});
      const cad=relCadence(r);
      if(cad.status==='CRITICAL') evidence.push({type:'CADENCE_BREACH',refId:r.id,title:`کیدنس شکسته: آخرین تعامل ${cad.daysSinceLastInteraction} روز پیش (هدف ${cad.cadenceDays})`,at:r.lastInteractionAt});
      else if(cad.status==='WARN') evidence.push({type:'CADENCE_BREACH',refId:r.id,title:`کیدنس عقب افتاده: آخرین تعامل ${cad.daysSinceLastInteraction} روز پیش (هدف ${cad.cadenceDays})`,at:r.lastInteractionAt});
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
        reason:`احتمال ${faN(o.probability??0)}٪ و ارزش موزون ${o.expectedValue!=null?faN(Math.round(o.expectedValue/1e9*10)/10)+' میلیارد تومان':'—'}`};
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
      if(!openActs.length&&!openComs.length&&!futureNext) gaps.push({type:'بدون اقدام باز',title:'اقدام یا تعهد بازی ندارد و موعد بعدی ثبت نشده است'});
      if((r.healthScore??0)<60) gaps.push({type:'سلامت پایین',title:`سلامت ${r.healthScore} زیر آستانهٔ ۶۰`});
      if(openComs.some(c=>c.status==='OVERDUE')) gaps.push({type:'OVERDUE_COMMITMENT',title:'تعهد عقب‌افتاده دارد'});
      const cad=relCadence(r);
      if(cad.status!=='FRESH') gaps.push(cad.status==='CRITICAL'?{type:'CADENCE_BREAK',title:`کیدنس شکسته: ${cad.daysSinceLastInteraction} روز (هدف ${cad.cadenceDays})`}:{type:'CADENCE_WARN',title:`کیدنس عقب افتاده: ${cad.daysSinceLastInteraction} روز (هدف ${cad.cadenceDays})`});
      return {id:r.id,name:relName(r),status:r.status,strategicScore:r.strategicScore,healthScore:r.healthScore,
        criteria:safeCriteriaLite('RELATIONSHIP',r.id),
        resilienceScore:r.resilienceScore,riskScore:r.riskScore,opportunityScore:r.opportunityScore,
        cadence:cad,covered,coverageGaps:gaps,openActions:openActs.length,openCommitments:openComs.length,
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
      cadenceBreaches:rels.filter(r=>relCadence(r).status!=='FRESH').length,
      lateCount:acts.filter(a=>['OPEN','IN_PROGRESS'].includes(a.status)&&isLate(a.dueAt)).length+coms.filter(c=>c.status==='OPEN'&&isLate(c.dueAt)).length,
    };
    return {generatedAt:nowIso(),kpis,riskSignals,opportunities,coverage,network};
  };
  if(is('/intelligence/overview')) return json(res,200,intelEngine(req));
  if(is('/intelligence/risk-signals')) return json(res,200,intelEngine(req).riskSignals);
  if(is('/intelligence/opportunity-detection')) return json(res,200,intelEngine(req).opportunities);
  if(is('/intelligence/strategic-coverage')) return json(res,200,intelEngine(req).coverage);
  if(is('/intelligence/network')) return json(res,200,intelEngine(req).network);
  /* P2-1: صف قدم بعدی (NBA) + اجرا/رد */
  if(is('/intelligence/nba')&&method==='GET') return json(res,200,nbaView(req));
  {
    const nbaRun=match('/intelligence/nba/:id/execute');
    const nbaSkip=match('/intelligence/nba/:id/dismiss');
    if(nbaRun&&method==='POST'){
      const out=nbaAct(req,nbaRun[0],'EXECUTED');
      if(out.code!==200) return json(res,out.code,{message:out.msg});
      return json(res,200,{ok:true,...nbaView(req)});
    }
    if(nbaSkip&&method==='POST'){
      const out=nbaAct(req,nbaSkip[0],'DISMISSED');
      if(out.code!==200) return json(res,out.code,{message:out.msg});
      return json(res,200,{ok:true,...nbaView(req)});
    }
  }
  /* P2-4: ریسک متمرکز و اهرم */
  if(is('/intelligence/risk-leverage')&&method==='GET') return json(res,200,riskLeverageView(req));
  /* P3-1: پایش انطباق — غربالگری دوره‌ای + UBO + پروندهٔ تصمیم */
  if(is('/governance/compliance')&&method==='GET') return json(res,200,complianceView(req));
  if(is('/governance/compliance/screen')&&method==='POST'){
    const out=complianceScreen(req);
    return json(res,200,out);
  }
  {
    const cd=match('/governance/compliance/:subject/decide');
    if(cd&&method==='POST'){
      const b=await readBody(req);
      const out=complianceDecide(req,cd[0],b.decision,b.rationale);
      if(out.code!==200) return json(res,out.code,{message:out.msg});
      return json(res,200,out);
    }
  }
  /* P3-2: حافظهٔ نهادی و انتقال دانش */
  if(is('/intelligence/knowledge-transfer')&&method==='GET'){
    const rid=q.get('relationshipId')??'';
    const out=transferView(req,rid);
    if(out.code!==200) return json(res,out.code,{message:out.msg});
    return json(res,200,out);
  }
  {
    const ktHand=match('/intelligence/knowledge-transfer/:relationshipId/handoff');
    if(ktHand&&method==='POST'){
      const out=transferHandoff(req,ktHand[0]);
      if(out.code!==200) return json(res,out.code,{message:out.msg});
      return json(res,200,{ok:true,transfer:out.transfer,view:transferView(req,ktHand[0])});
    }
  }
  /* P3-4: هیئت‌مدیره */
  if(is('/board/overview')&&method==='GET') return json(res,200,boardView(req));

  /* ======================================================================
     Supplementary endpoints — complete UI coverage (no 404 for nav pages)
     ====================================================================== */

  /* ---- people CRUD ---- */
  if(is('/people')&&method==='POST'){
    const b=await readBody(req);
    if(!b.firstName?.trim()||!b.lastName?.trim()) return json(res,400,{message:'نام و نام خانوادگی لازم است.'});
    if(!b.organizationId||!inScope(req,b.organizationId)) return json(res,403,{message:'سازمان انتخاب‌شده در محدودهٔ دسترسی شما نیست.'});
    const personIntake=normalizeCriteriaAnswers(b.criteriaAnswers??b.assessment);
    const personIntakeScope=criteriaScopeError('PERSON',personIntake);
    if(personIntakeScope) return json(res,400,{message:personIntakeScope});
    const p={id:`p-${Date.now()}`,firstName:b.firstName,lastName:b.lastName,email:b.email??null,phone:b.phone??null,title:b.title??null,department:b.department??null,organizationId:b.organizationId,status:'ACTIVE',influenceScore:b.influenceScore??60,decisionPower:b.decisionPower??50,accessibilityScore:b.accessibilityScore??60,country:b.country??'ایران'};
    PEOPLE.push(p);
    if(personIntake.length) saveStoredAnswers('PERSON',p.id,personIntake);
    audit(req,'CREATE','person',p.id,'OK',{name:`${p.firstName} ${p.lastName}`,answers:personIntake.length});
    await autoRunWorkflows('Person',p.id,'PERSON_CREATED',{person:{id:p.id,firstName:p.firstName,lastName:p.lastName,title:p.title,organizationId:p.organizationId,status:p.status}});
    return json(res,201,attachCriteria('PERSON',[{...p,organization:orgById(p.organizationId)?{id:p.organizationId,name:orgById(p.organizationId).name}:null}])[0]);
  }

  /* ---- commitments CRUD ---- */
  if(is('/commitments')&&method==='POST'){
    const b=await readBody(req);
    if(!b.description?.trim()) return json(res,400,{message:'شرح تعهد لازم است.'});
    const rel=b.relationshipId?RELS.find(r=>r.id===b.relationshipId):null;
    if(b.relationshipId&&!rel) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'});
    const orgId=b.organizationId??(rel?rel.targetOrganizationId:primaryOrgId(authUser));
    if(!orgId) return json(res,400,{message:'سازمان طرفِ تعهد لازم است.'});
    const orgReach=inScope(req,orgId)||(rel&&relInScope(req,rel)&&(orgId===rel.targetOrganizationId||orgId===rel.sourceOrganizationId));
    if(!orgReach) return json(res,403,{message:'سازمان طرفِ تعهد در محدودهٔ دسترسی شما نیست.'});
    const c={id:`c-${Date.now()}`,description:b.description,dueAt:b.dueAt??null,reminderAt:b.reminderAt??null,status:b.status??'OPEN',risk:b.risk??'MEDIUM',direction:b.direction==='THEIRS'?'THEIRS':'OURS',notes:b.notes??null,organizationId:orgId,ownerId:b.ownerId??null,personId:b.personId??null,relationshipId:b.relationshipId??null,meetingId:b.meetingId??null,projectId:b.projectId??null,createdAt:nowIso(),fulfilledAt:b.status==='FULFILLED'?nowIso():null};
    COMMITMENTS.push(c);
    audit(req,'CREATE','commitment',c.id,'OK',{description:c.description});
    await autoRunWorkflows('Commitment',c.id,'COMMITMENT_CREATED',{commitment:{id:c.id,description:c.description,status:c.status,risk:c.risk,organizationId:c.organizationId??null,relationshipId:c.relationshipId??null}});
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
    const commitmentBefore={...c};
    Object.assign(c,b);
    audit(req,'UPDATE','commitment',c.id,'OK',{description:c.description});
    const commCtx={commitment:{id:c.id,description:c.description,status:c.status,risk:c.risk,organizationId:c.organizationId??null,relationshipId:c.relationshipId??null}};
    await autoRunWorkflows('Commitment',c.id,'COMMITMENT_UPDATED',commCtx,`commitment:${c.id}:updated:${Date.now()}`);
    if(c.status==='FULFILLED'&&commitmentBefore.status!=='FULFILLED')
      await autoRunWorkflows('Commitment',c.id,'COMMITMENT_FULFILLED',commCtx,`commitment:${c.id}:fulfilled:${Date.now()}`);
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
    await autoRunWorkflows('Commitment',c.id,'COMMITMENT_UPDATED',{commitment:{id:c.id,description:c.description,status:c.status,risk:c.risk,organizationId:c.organizationId??null,relationshipId:c.relationshipId??null}},`commitment:${c.id}:overdue:${Date.now()}`);
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
    const purpose=b.purpose?String(b.purpose).toUpperCase():null;
    if(purpose&&!INTERACTION_PURPOSE_LIST.includes(purpose)) return json(res,400,{message:'هدف تعامل نامعتبر است (کشف/اعتمادسازی/تصمیم/مذاکره/حل مسئله/تجلیل).'});
    const channel=b.channel?String(b.channel).toUpperCase():null;
    if(channel&&!INTERACTION_CHANNEL_LIST.includes(channel)) return json(res,400,{message:'کانال تعامل نامعتبر است.'});
    const result=b.result?String(b.result).toUpperCase():null;
    if(result&&!INTERACTION_RESULT_LIST.includes(result)) return json(res,400,{message:'نتیجهٔ تعامل نامعتبر است (پیشرفت/ثابت/عقب‌گرد).'});
    const direction=b.direction?String(b.direction).toUpperCase():null;
    if(direction&&!INTERACTION_DIRECTION_LIST.includes(direction)) return json(res,400,{message:'جهت تعامل نامعتبر است.'});
    if(b.quality!=null&&(!Number.isFinite(Number(b.quality))||Number(b.quality)<1||Number(b.quality)>5)) return json(res,400,{message:'کیفیت باید عددی بین ۱ تا ۵ باشد.'});
    if(b.nextStepAt!=null&&b.nextStepAt!==''&&Number.isNaN(new Date(b.nextStepAt).getTime())) return json(res,400,{message:'موعد قدم بعدی نامعتبر است.'});
    const x={id:`i-${Date.now()}`,type,subject:String(b.subject).trim(),summary:b.summary??'',outcome:b.outcome??null,durationMinutes:b.durationMinutes?Number(b.durationMinutes):null,importance,followUpRequired:!!b.followUpRequired,followUpAt:b.followUpAt??null,sentiment:b.sentiment!=null?Number(b.sentiment):null,purpose,channel,quality:b.quality!=null?Number(b.quality):null,result,direction,nextStep:b.nextStep?String(b.nextStep).trim():null,nextStepAt:b.nextStepAt??null,occurredAt:b.occurredAt??nowIso(),userId:authUser.id,organizationId:orgId,relationshipId:b.relationshipId??null,personId:b.personId??null};
    INTERACTIONS.unshift(x);
    applyInteractionToRel(rel,x);
    audit(req,'CREATE','Interaction',x.id,'OK',{meta:{subject:x.subject,type:x.type,organizationId:orgId}});
    saveDb();
    await autoRunWorkflows('Interaction',x.id,'INTERACTION_CREATED',{interaction:{id:x.id,subject:x.subject,type:x.type,importance,organizationId:orgId,relationshipId:x.relationshipId??null,personId:x.personId??null,followUpRequired:!!x.followUpRequired}});
    return json(res,201,interactionCardView(x));
  }

  /* ---- opportunities CRUD ---- */
  if(is('/opportunities')&&method==='POST'){
    const b=await readBody(req);
    if(!b.name?.trim()) return json(res,400,{message:'نام فرصت لازم است.'});
    const rel=b.relationshipId?RELS.find(r=>r.id===b.relationshipId):null;
    if(b.relationshipId&&!rel) return json(res,400,{message:'رابطهٔ انتخابی یافت نشد.'});
    const orgId=b.organizationId??(rel?rel.targetOrganizationId:primaryOrgId(authUser));
    if(!orgId) return json(res,400,{message:'سازمان فرصت لازم است.'});
    const orgReach=inScope(req,orgId)||(rel&&relInScope(req,rel)&&(orgId===rel.targetOrganizationId||orgId===rel.sourceOrganizationId));
    if(!orgReach) return json(res,403,{message:'سازمانِ فرصت در محدودهٔ دسترسی شما نیست.'});
    const status=b.status??'IDENTIFIED';
    const sourceType=b.sourceType?String(b.sourceType).toUpperCase():'COLD';
    if(!OPPORTUNITY_SOURCE_LIST.includes(sourceType)) return json(res,400,{message:'منبع فرصت نامعتبر است (معرفی/رابطهٔ موجود/رویداد/سرد).'});
    if(sourceType==='REFERRAL'&&b.sourceReferralId&&!(DB.referrals??[]).some(x=>x.id===b.sourceReferralId)) return json(res,404,{message:'معرفیٔ مبدأ یافت نشد.'});
    const o={id:`o-${Date.now()}`,name:b.name,description:b.description??null,status,sourceType,sourceReferralId:b.sourceReferralId??null,probability:Math.max(0,Math.min(100,Number(b.probability)||0)),value:b.value==null?null:Number(b.value)||0,expectedDate:b.expectedDate??null,organizationId:orgId,relationshipId:b.relationshipId??null,projectId:b.projectId??null,ownerId:b.ownerId??null,createdAt:nowIso(),wonAt:status==='WON'?nowIso():null,lostAt:status==='LOST'?nowIso():null};
    OPPORTUNITIES.push(o);
    audit(req,'CREATE','opportunity',o.id,'OK',{name:o.name});
    await autoRunWorkflows('Opportunity', o.id, 'OPPORTUNITY_CREATED', { opportunity: { id: o.id, name: o.name, status: o.status, value: o.value, probability: o.probability, relationshipId: o.relationshipId, organizationId: o.organizationId } });
    return json(res,201,opportunityView(o));
  }
  const opportunityId=match('/opportunities/:id');
  if(opportunityId&&method==='GET'){
    const o=OPPORTUNITIES.find(x=>x.id===opportunityId[0]);
    if(!o) return json(res,404,{message:'فرصت یافت نشد'});
    if(!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    return json(res,200,attachCriteria('OPPORTUNITY',[opportunityView(o)])[0]);
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
    if(b.sourceType!==undefined){const st=String(b.sourceType).toUpperCase(); if(!OPPORTUNITY_SOURCE_LIST.includes(st)) return json(res,400,{message:'منبع فرصت نامعتبر است.'}); o.sourceType=st; delete b.sourceType;}
    if(b.sourceReferralId!==undefined){ o.sourceReferralId=b.sourceReferralId??null; delete b.sourceReferralId; }
    const oppBefore={...o};
    Object.assign(o,b);
    audit(req,'UPDATE','opportunity',o.id,'OK',{name:o.name});
    const oppCtx={opportunity:{id:o.id,name:o.name,status:o.status,value:o.value,probability:o.probability,relationshipId:o.relationshipId??null,organizationId:o.organizationId??null}};
    await autoRunWorkflows('Opportunity',o.id,'OPPORTUNITY_UPDATED',oppCtx,`opportunity:${o.id}:updated:${Date.now()}`);
    if(b.status&&b.status!==oppBefore.status){
      if(b.status==='WON') await autoRunWorkflows('Opportunity',o.id,'OPPORTUNITY_WON',oppCtx,`opportunity:${o.id}:won:${Date.now()}`);
      if(b.status==='LOST') await autoRunWorkflows('Opportunity',o.id,'OPPORTUNITY_LOST',oppCtx,`opportunity:${o.id}:lost:${Date.now()}`);
    }
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

  /* ---- کمیتهٔ خرید (P0-2) ---- */
  const committeeOf=(opp)=>{
    const sum=committeeSummary(opp.id);
    const items=(COMMITTEE??[]).filter(c=>c.opportunityId===opp.id).map(c=>({...c,person:personById(c.personId)?{id:c.personId,firstName:personById(c.personId).firstName,lastName:personById(c.personId).lastName??'',title:personById(c.personId).title??null,organizationId:personById(c.personId).organizationId,organization:personById(c.personId).organizationId?{id:personById(c.personId).organizationId,name:orgById(personById(c.personId).organizationId)?.name}:null}:null}));
    return {...sum,items};
  };
  const committee=match('/opportunities/:id/committee');
  if(committee&&method==='GET'){
    const o=OPPORTUNITIES.find(x=>x.id===committee[0]);
    if(!o) return json(res,404,{message:'فرصت یافت نشد'});
    if(!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    return json(res,200,{opportunityId:o.id,opportunity:{id:o.id,name:o.name},...committeeOf(o)});
  }
  if(committee&&method==='POST'){
    const o=OPPORTUNITIES.find(x=>x.id===committee[0]);
    if(!o) return json(res,404,{message:'فرصت یافت نشد'});
    if(!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    const b=await readBody(req);
    if(!b.personId) return json(res,400,{message:'شخص لازم است.'});
    const p=personById(b.personId);
    if(!p) return json(res,404,{message:'شخص یافت نشد.'});
    const role=String(b.role??'').toUpperCase();
    if(!BUYING_ROLE_LIST.includes(role)) return json(res,400,{message:'نقش نامعتبر است (خریدار اقتصادی/حامی/ارزیاب فنی/کاربر نهایی/تدارکات/بلاکر).'});
    const status=String(b.status??'IDENTIFIED').toUpperCase();
    if(!COMMITTEE_MEMBER_STATUS.includes(status)) return json(res,400,{message:'وضعیت عضو نامعتبر است.'});
    if((COMMITTEE??[]).some(c=>c.opportunityId===o.id&&c.personId===b.personId&&c.role===role)) return json(res,409,{message:'این شخص از قبل با همین نقش در کمیته ثبت شده است.'});
    if(p.organizationId&&o.organizationId&&p.organizationId!==o.organizationId) return json(res,400,{message:`عضو کمیته باید از سازمانِ خریدار باشد (${p.organizationId} ≠ ${o.organizationId}).`});
    const row={id:`cm-${Date.now()}`,opportunityId:o.id,personId:b.personId,role,status,note:b.note?String(b.note).slice(0,200):null,updatedAt:nowIso()};
    COMMITTEE.push(row); saveDb();
    audit(req,'CREATE','committee',row.id,'OK',{opportunityId:o.id,role});
    return json(res,201,row);
  }
  const committeeItem=match('/opportunities/:id/committee/:cid');
  if(committeeItem&&method==='PATCH'){
    const row=(COMMITTEE??[]).find(c=>c.id===committeeItem[1]&&c.opportunityId===committeeItem[0]);
    if(!row) return json(res,404,{message:'عضو کمیته یافت نشد.'});
    const o=OPPORTUNITIES.find(x=>x.id===row.opportunityId);
    if(!o||!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    const b=await readBody(req);
    if(b.role!==undefined){const role=String(b.role).toUpperCase(); if(!BUYING_ROLE_LIST.includes(role)) return json(res,400,{message:'نقش نامعتبر است.'}); row.role=role;}
    if(b.status!==undefined){const status=String(b.status).toUpperCase(); if(!COMMITTEE_MEMBER_STATUS.includes(status)) return json(res,400,{message:'وضعیت نامعتبر است.'}); row.status=status;}
    if(b.note!==undefined) row.note=b.note?String(b.note).slice(0,200):null;
    if(b.personId!==undefined){const np=personById(b.personId); if(!np) return json(res,404,{message:'شخص یافت نشد.'}); if(np.organizationId&&o.organizationId&&np.organizationId!==o.organizationId) return json(res,400,{message:'عضو کمیته باید از سازمانِ خریدار باشد.'}); row.personId=b.personId;}
    row.updatedAt=nowIso(); saveDb();
    audit(req,'UPDATE','committee',row.id,'OK',{opportunityId:row.opportunityId});
    return json(res,200,row);
  }
  if(committeeItem&&method==='DELETE'){
    const row=(COMMITTEE??[]).find(c=>c.id===committeeItem[1]&&c.opportunityId===committeeItem[0]);
    if(!row) return json(res,404,{message:'عضو کمیته یافت نشد.'});
    const o=OPPORTUNITIES.find(x=>x.id===row.opportunityId);
    if(!o||!scopedOpps(req).includes(o)) return json(res,403,{message:'دسترسی به این فرصت مجاز نیست.'});
    COMMITTEE=COMMITTEE.filter(c=>c.id!==row.id); saveDb();
    audit(req,'DELETE','committee',row.id,'OK',{opportunityId:row.opportunityId});
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
    const actionBefore={...a};
    Object.assign(a,b);
    const actionCtx={action:{id:a.id,title:a.title,status:a.status,priority:a.priority,relationshipId:a.relationshipId??null,organizationId:a.organizationId??null}};
    await autoRunWorkflows('Action',a.id,'ACTION_UPDATED',actionCtx,`action:${a.id}:updated:${Date.now()}`);
    const finalStatus=['DONE','COMPLETED','CANCELLED'].includes(a.status);
    if(finalStatus&&!['DONE','COMPLETED','CANCELLED'].includes(actionBefore.status))
      await autoRunWorkflows('Action',a.id,'ACTION_COMPLETED',actionCtx,`action:${a.id}:completed:${Date.now()}`);
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
    const orgId=b.organizationId??primaryOrgId(authUser);
    if(!orgId) return json(res,400,{message:'سازمان پروژه لازم است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان پروژه در محدودهٔ دسترسی شما نیست.'});
    const pr={id:`pr-${Date.now()}`,name:b.name,status:b.status??'PLANNED',priority:b.priority??'MEDIUM',organizationId:orgId,description:b.description??null,objective:b.objective??null,ownerId:b.ownerId??null,startAt:b.startAt??null,targetAt:b.targetAt??null,endAt:null,createdAt:nowIso()};
    PROJECTS.push(pr);
    PROJECT_EXTRA[pr.id]={requirements:[],risks:[],milestones:[],relationships:[]};
    audit(req,'CREATE','project',pr.id,'OK',{name:pr.name});
    await autoRunWorkflows('Project',pr.id,'PROJECT_CREATED',{project:{id:pr.id,name:pr.name,status:pr.status,priority:pr.priority,organizationId:pr.organizationId}});
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
    await autoRunWorkflows('Project',pr.id,'PROJECT_UPDATED',{project:{id:pr.id,name:pr.name,status:pr.status,priority:pr.priority,organizationId:pr.organizationId??null}},`project:${pr.id}:updated:${Date.now()}`);
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
    if(b.cadenceDays!==undefined){const cd=Number(b.cadenceDays); if(!Number.isFinite(cd)||cd<7||cd>365) return json(res,400,{message:'کیدنس باید بین ۷ تا ۳۶۵ روز باشد.'}); r.cadenceDays=Math.round(cd); delete b.cadenceDays;}
    if(b.marketKind!==undefined){ const mk=String(b.marketKind).trim().toUpperCase(); if(!['MARKET','NON_MARKET','HYBRID'].includes(mk)) return json(res,400,{message:'marketKind باید MARKET/NON_MARKET/HYBRID باشد.'}); b.marketKind=mk; }
    if(b.marketSegment!==undefined){ b.marketSegment = typeof b.marketSegment==='string' ? String(b.marketSegment).trim().slice(0,120) || null : null; }
    if(b.isMarketEntry!==undefined) b.isMarketEntry=!!b.isMarketEntry;
    Object.assign(r,b);
    audit(req,'UPDATE','relationship',r.id,'OK',{patch:Object.keys(b).join(',')});
    await autoRunWorkflows('Relationship', r.id, 'RELATIONSHIP_UPDATED', { relationship: { id: r.id, sourceOrganizationId: r.sourceOrganizationId, targetOrganizationId: r.targetOrganizationId, relationshipType: r.relationshipType, status: r.status, healthScore: r.healthScore, strategicScore: r.strategicScore, riskScore: r.riskScore } });
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
  if(is('/documents/upload')&&method==='POST'){
    const b=await readBody(req).catch(()=>({}));
    const raw=typeof __rawHttpBody==='string'?__rawHttpBody:'';
    const fname=(raw.match(/filename="([^"]+)"/)||[])[1]||String(b?.name??'سند-'+Date.now()+'.pdf');
    const guess=fname.toLowerCase().endsWith('.pdf')?'application/pdf':fname.toLowerCase().endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':fname.toLowerCase().endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':fname.toLowerCase().endsWith('.csv')?'text/csv':'application/octet-stream';
    const art={id:'doc-'+(DB.nextId++),name:fname,mimeType:String(b?.mimeType??guess),sizeBytes:Number(b?.sizeBytes)||Math.max(1024,Math.floor(raw.length*(guess==='application/pdf'?2:1))),classification:String(b?.classification??'INTERNAL'),uploadedBy:authUser?.email??'demo@srip.local',organizationId:String(b?.organizationId??'')||null,scanStatus:'CLEAN',uploadStatus:'READY',indexStatus:'PENDING',createdAt:nowIso(),updatedAt:nowIso()};
    DB.documents=[art,...(DB.documents??seedDocuments())];
    saveDb();
    audit(req,'CREATE','Document',art.id,'OK',{name:fname,classification:art.classification});
    return json(res,201,art);
  }
  const docIndex=match('/documents/:id/index');
  if(docIndex&&method==='POST'){
    const doc=(DB.documents??[]).find((d)=>d.id===docIndex[0]);
    if(doc){ doc.indexStatus='INDEXED'; doc.updatedAt=nowIso(); doc.indexedChunks=(doc.indexedChunks??0)+1; }
    saveDb();
    return json(res,200,{ok:true,indexed:true});
  }
  const docUrl=match('/documents/:id/signed-url');
  if(docUrl&&method==='GET'){
    const doc=(DB.documents??[]).find((d)=>d.id===docUrl[0]);
    return json(res,200,{url:null,expiresAt:null,name:doc?.name??null,signed:false,message:doc?'برای دانلود واقعی در حالت سرور، امضای کوتاه‌مدت صادر می‌شود؛ در دمو URL نیست.':null});
  }

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
    /* معرفی شخص→شخص هم باید دیده شود: محدوده از سازمانِ اشخاص مبدأ/مقصد تعیین میشود */
    const refInScope=(r)=>{
      const sp=r.sourcePersonId?personById(r.sourcePersonId):null;
      const tp=r.targetPersonId?personById(r.targetPersonId):null;
      return inScope(req,r.sourceOrganizationId)||inScope(req,r.targetOrganizationId)
        ||(sp&&inScope(req,sp.organizationId))||(tp&&inScope(req,tp.organizationId));
    };
    const list=(DB.referrals??[]).filter(refInScope);
    const enrich=(r)=>({...r,
      sourcePerson:personById(r.sourcePersonId)?{id:r.sourcePersonId,firstName:personById(r.sourcePersonId).firstName,lastName:personById(r.sourcePersonId).lastName}:null,
      targetPerson:personById(r.targetPersonId)?{id:r.targetPersonId,firstName:personById(r.targetPersonId).firstName,lastName:personById(r.targetPersonId).lastName}:null,
      sourceOrganization:orgById(r.sourceOrganizationId)?{id:r.sourceOrganizationId,name:orgById(r.sourceOrganizationId).name}:null,
      targetOrganization:orgById(r.targetOrganizationId)?{id:r.targetOrganizationId,name:orgById(r.targetOrganizationId).name}:null,
      createdBy:userById(r.createdById)?{id:r.createdById,name:userById(r.createdById).name,email:userById(r.createdById).email}:null,
      recipientUser:userById(r.recipientUserId)?{id:r.recipientUserId,name:userById(r.recipientUserId).name,email:userById(r.recipientUserId).email}:null,
      instruction:refInstruction(r),
      audit:referralAudit(r),
      postAudit:referralPostAudit(r),
      relationshipCriteria:r.relationshipId?refRelCriteria(r.relationshipId):null,
      opportunity:(()=>{const o=r.opportunityId?OPPORTUNITIES.find(x=>x.id===r.opportunityId):null; return o?{id:o.id,name:o.name,status:o.status,value:o.value}:null;})(),
      connectorLoad:(DB.referrals??[]).filter(x=>x.sourcePersonId===r.sourcePersonId&&['PENDING','ACCEPTED'].includes(x.status)).length,
    });
    return json(res,200,list.sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??''))).map(enrich));
  }
  if(is('/core-domain/referrals')&&method==='POST'){
    const b=await readBody(req);
    if(!String(b.title||'').trim()) return json(res,400,{message:'عنوان معرفی لازم است.'});
    if(!b.sourceOrganizationId&&!b.sourcePersonId) return json(res,400,{message:'مبدأ معرفی (سازمان یا شخص) لازم است.'});
    if(!b.targetOrganizationId&&!b.targetPersonId&&!b.recipientUserId) return json(res,400,{message:'مقصد معرفی (سازمان، شخص یا کاربر گیرنده) لازم است.'});
    if(!authUser?.isOwner&&b.sourceOrganizationId&&!inScope(req,b.sourceOrganizationId)) return json(res,403,{message:'سازمان مبدأ خارج از محدودهٔ دسترسی شماست.'});
    const ins=(b.instruction&&typeof b.instruction==='object')?{
      goal:String(b.instruction.goal??'').trim(),allowed:(Array.isArray(b.instruction.allowed)?b.instruction.allowed:[]).map(String).slice(0,6),forbidden:(Array.isArray(b.instruction.forbidden)?b.instruction.forbidden:[]).map(String).slice(0,6),boundaries:String(b.instruction.boundaries??'').trim(),dueDays:Math.max(3,Math.min(365,Number(b.instruction.dueDays)||30))}:null;
    if(b.requestStatus&&!REF_REQUEST_STATUS_LIST.includes(String(b.requestStatus).toUpperCase())) return json(res,400,{message:'وضعیت درخواست نامعتبر است.'});
    if(b.outcome&&!REF_OUTCOME_LIST.includes(String(b.outcome).toUpperCase())) return json(res,400,{message:'نتیجهٔ معرفی نامعتبر است.'});
    if(b.opportunityId&&!OPPORTUNITIES.some(x=>x.id===b.opportunityId)) return json(res,404,{message:'فرصت یافت نشد.'});
    const r={id:`ref-${Date.now()}`,title:String(b.title).trim(),message:b.message??null,sourcePersonId:b.sourcePersonId??null,targetPersonId:b.targetPersonId??null,sourceOrganizationId:b.sourceOrganizationId??null,targetOrganizationId:b.targetOrganizationId??null,relationshipId:b.relationshipId??null,status:'PENDING',createdById:authUser.id,recipientUserId:b.recipientUserId??null,completedAt:null,notes:null,createdAt:nowIso(),acceptedAt:null,instruction:ins,baselineCriteria:null,postCheckins:{},requestStatus:b.requestStatus?String(b.requestStatus).toUpperCase():null,requestedAt:b.requestStatus==='REQUESTED'?nowIso():null,outcome:b.outcome?String(b.outcome).toUpperCase():null,outcomeNote:b.outcomeNote??null,opportunityId:b.opportunityId??null};
    let acceptedSuggestion=false;
    if(b.suggestionId){
      const sid=String(b.suggestionId);
      DB.edgeSuggestionAccepts=Array.isArray(DB.edgeSuggestionAccepts)?DB.edgeSuggestionAccepts:[];
      if(!DB.edgeSuggestionAccepts.some(x=>x.suggestionId===sid)){
        DB.edgeSuggestionAccepts.push({suggestionId:sid,userId:authUser.id,referralId:r.id,at:nowIso()});
        NOTIFICATIONS.unshift({id:`n-${Date.now()}`,userId:authUser.id,title:'پیشنهاد معرفی پذیرفته شد',body:`معرفی «${r.title}» از پیشنهاد شبکه ثبت و پذیرفته شد و به فهرست معرفیها اضافه شد.`,type:'INFO',priority:'MEDIUM',isRead:false,createdAt:nowIso()});
      }
      acceptedSuggestion=true;
    }
    DB.referrals.unshift(r); saveDb();
    const auditRes=referralAudit(r);
    audit(req,'CREATE','Referral',r.id,'OK',{meta:{title:r.title,status:'PENDING',gate:auditRes.gate}});
    await autoRunWorkflows('Referral',r.id,'REFERRAL_CREATED',{referral:{id:r.id,title:r.title,status:r.status,sourcePersonId:r.sourcePersonId??null,targetPersonId:r.targetPersonId??null,sourceOrganizationId:r.sourceOrganizationId??null,targetOrganizationId:r.targetOrganizationId??null,relationshipId:r.relationshipId??null}});
    if(auditRes.gate==='BLOCKED') NOTIFICATIONS.unshift({id:`n-ref-${Date.now()}`,userId:authUser.id,type:'ALERT',title:'معرفی به ممیزی خورد',body:`«${r.title}»: ${auditRes.checks.filter((x)=>x.level==='BLOCK').map((x)=>x.label).join('، ')} — ابتدا شرایط را اصلاح کنید.`,channel:'IN_APP',priority:'HIGH',createdAt:nowIso(),readAt:null,data:{referralId:r.id}});
    return json(res,201,{...r,createdBy:userById(r.createdById)?{id:r.createdById,name:userById(r.createdById).name}:null,recipientUser:userById(r.recipientUserId)?{id:r.recipientUserId,name:userById(r.recipientUserId).name}:null,instruction:ins,audit:auditRes,acceptedSuggestion});
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
    if(b.instruction&&typeof b.instruction==='object'){
      const i=r.instruction??{goal:'',allowed:[],forbidden:[],boundaries:'',dueDays:30};
      if(b.instruction.goal!==undefined) i.goal=String(b.instruction.goal).trim();
      if(Array.isArray(b.instruction.allowed)) i.allowed=b.instruction.allowed.map(String).slice(0,6);
      if(Array.isArray(b.instruction.forbidden)) i.forbidden=b.instruction.forbidden.map(String).slice(0,6);
      if(b.instruction.boundaries!==undefined) i.boundaries=String(b.instruction.boundaries).trim();
      if(b.instruction.dueDays!==undefined) i.dueDays=Math.max(3,Math.min(365,Number(b.instruction.dueDays)||30));
      r.instruction=i;
    }
    if(b.requestStatus!==undefined){const rs=String(b.requestStatus).toUpperCase(); if(!REF_REQUEST_STATUS_LIST.includes(rs)) return json(res,400,{message:'وضعیت درخواست نامعتبر است.'}); r.requestStatus=rs; if(rs==='REQUESTED') r.requestedAt=r.requestedAt??nowIso();}
    if(b.outcome!==undefined){const oc=String(b.outcome).toUpperCase(); if(!REF_OUTCOME_LIST.includes(oc)) return json(res,400,{message:'نتیجهٔ معرفی نامعتبر است.'}); r.outcome=oc;}
    if(b.outcomeNote!==undefined) r.outcomeNote=b.outcomeNote?String(b.outcomeNote).slice(0,240):null;
    if(b.opportunityId!==undefined){ if(b.opportunityId){ const o=OPPORTUNITIES.find(x=>x.id===b.opportunityId); if(!o) return json(res,404,{message:'فرصت یافت نشد.'}); r.opportunityId=b.opportunityId; } else r.opportunityId=null; }
    const refStatusBefore=r.status;
    if(b.status!==undefined&&b.status!==r.status){
      const allowed=REF_STATUS_FLOW[r.status]??[];
      if(!allowed.includes(b.status)) return json(res,409,{message:`تغییر وضعیت از «${r.status}» به «${b.status}» مجاز نیست.`});
      if(b.status==='ACCEPTED'){
        const ar=referralAudit(r);
        if(ar.gate==='BLOCKED') return json(res,409,{message:'ممیزی پیش از معرفی اجازه نمیدهد — '+(ar.checks.filter((x)=>x.level==='BLOCK').map((x)=>x.label).join('؛ ')),audit:ar});
        r.baselineCriteria=r.relationshipId?refRelCriteria(r.relationshipId):null;
        r.acceptedAt=nowIso();
      }
      r.status=b.status;
      r.completedAt=(b.status==='COMPLETED')?nowIso():null;
      if(b.status==='COMPLETED'){ const pa=referralPostAudit(r); if(pa.gate==='BLOCKED') NOTIFICATIONS.unshift({id:`n-refp-${Date.now()}`,userId:authUser.id,type:'ALERT',title:'معرفی به رابطه آسیب زده',body:`«${r.title}»: ${pa.checks.filter((x)=>x.level==='BLOCK').map((x)=>x.label).join('، ')}`,channel:'IN_APP',priority:'HIGH',createdAt:nowIso(),readAt:null,data:{referralId:r.id}}); }
    }
    saveDb();
    audit(req,'UPDATE','Referral',r.id,'OK',{meta:{title:r.title,from:before.status,to:r.status,reason:'Referral status changed'}});
    const refCtx={referral:{id:r.id,title:r.title,status:r.status,sourcePersonId:r.sourcePersonId??null,targetPersonId:r.targetPersonId??null,sourceOrganizationId:r.sourceOrganizationId??null,targetOrganizationId:r.targetOrganizationId??null,relationshipId:r.relationshipId??null}};
    await autoRunWorkflows('Referral',r.id,'REFERRAL_UPDATED',refCtx,`referral:${r.id}:updated:${Date.now()}`);
    if(r.status!==refStatusBefore){
      if(r.status==='ACCEPTED') await autoRunWorkflows('Referral',r.id,'REFERRAL_ACCEPTED',refCtx,`referral:${r.id}:accepted:${Date.now()}`);
      if(r.status==='COMPLETED') await autoRunWorkflows('Referral',r.id,'REFERRAL_COMPLETED',refCtx,`referral:${r.id}:completed:${Date.now()}`);
      if(r.status==='DECLINED') await autoRunWorkflows('Referral',r.id,'REFERRAL_DECLINED',refCtx,`referral:${r.id}:declined:${Date.now()}`);
    }
    return json(res,200,r);
  }
  const refAudit=match('/core-domain/referrals/:id/audit');
  if(refAudit&&method==='POST'){
    const r=(DB.referrals??[]).find(x=>x.id===refAudit[0]);
    if(!r) return json(res,404,{message:'معرفی یافت نشد.'});
    if(!authUser?.isOwner&&!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'این معرفی خارج از محدودهٔ دسترسی شماست.'});
    const auditRes=referralAudit(r);
    audit(req,'UPDATE','Referral',r.id,'OK',{meta:{reason:'pre-audit re-run',gate:auditRes.gate}});
    return json(res,200,auditRes);
  }
  const refCheckin=match('/core-domain/referrals/:id/checkin');
  if(refCheckin&&method==='POST'){
    const r=(DB.referrals??[]).find(x=>x.id===refCheckin[0]);
    if(!r) return json(res,404,{message:'معرفی یافت نشد.'});
    if(!authUser?.isOwner&&!inScope(req,r.sourceOrganizationId)&&!inScope(req,r.targetOrganizationId)) return json(res,403,{message:'این معرفی خارج از محدودهٔ دسترسی شماست.'});
    const b=await readBody(req);
    const code=String(b.code??'').toUpperCase();
    if(!['FOLLOW_UP','OUTCOME'].includes(code)) return json(res,400,{message:'کد ثبت ناشناخته است.'});
    r.postCheckins=r.postCheckins??{};
    r.postCheckins[code]={at:nowIso(),note:String(b.note??'').slice(0,240)};
    saveDb();
    audit(req,'UPDATE','Referral',r.id,'OK',{meta:{reason:'post-audit checkin',code}});
    return json(res,200,{code,at:r.postCheckins[code].at,postAudit:referralPostAudit(r)});
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
  /* «*» = مجوز کامل (همان تعریف نقش SUPER_ADMIN در کاتالوگ نقش‌ها) */
  const hasPerm=(perm)=>authUser?.isOwner||(authUser?.permissions??[]).includes('*')||(authUser?.permissions??[]).includes(perm);
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
    audit(req,'EXPORT','Report',row.id,'OK',{meta:{exportType:row.exportType,classification:row.classification,format:'فایل جدولی',approval:row.requestId??null,reason:'Enterprise export record'}});
    return json(res,201,exportView(row));
  }
  if(is('/security/governance/preflight')&&method==='GET'){
    if(!(authUser?.permissions??[]).includes('enterprise.security')&&!authUser?.isOwner) return json(res,403,{message:'شما مجوز «حاکمیت و امنیت سازمانی» (enterprise.security) را ندارید.'});
    const policies=(DB.retentionPolicies??[]).filter(p=>p.active!==false);
    const erasableNoRetention=policies.filter(p=>p.erasable&&!p.retentionDays).length;
    const checks=[
      {key:'origin-check',status:'PASS',detail:'محافظت از تغییرات متقاطع (مبدأ ارسال) فعال است.'},
      {key:'rate-limit-fail-open',status:'PASS',detail:'محدودسازی نرخ در حالت خطا، بسته‌مانده عمل می‌کند.'},
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
    if(t==='referral'){ const rr=(DB.referrals??[]).find(x=>x.id===id); return rr?.targetOrganizationId??rr?.sourceOrganizationId??null; }
    if(t==='publicmember'){ const pm=(DB.publicsMembers??[]).find(x=>x.id===id); return pm?.orgId??null; }
    if(t==='publics') return id??null;
    if(t==='media') return null;
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
    if(t==='referral') return (DB.referrals??[]).some(x=>x.id===id);
    if(t==='publicmember') return (DB.publicsMembers??[]).some(x=>x.id===id);
    if(t==='publics') return !!orgById(id);
    if(t==='media') return (DB.mediaStore??[]).some(x=>x.id===id);
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
      sourceReferralId:action.sourceReferralId??c.sourceReferralId??null,
    };
    const t=String(type??'').toLowerCase();
    if(t==='relationship'&&!links.relationshipId) links.relationshipId=id;
    if(t==='meeting'&&!links.meetingId) links.meetingId=id;
    if(t==='project'&&!links.projectId) links.projectId=id;
    if(t==='person'&&!links.personId) links.personId=id;
    if(t==='organization'&&!links.organizationId) links.organizationId=id;
    if(t==='recommendation'&&!links.recommendationId) links.recommendationId=id;
    if(t==='referral'){
      if(!links.sourceReferralId) links.sourceReferralId=id;
      if(!links.relationshipId&&c.referral?.relationshipId) links.relationshipId=c.referral.relationshipId;
      if(!links.organizationId) links.organizationId=c.referral?.targetOrganizationId??c.referral?.sourceOrganizationId??fallbackOrgId??null;
    }
    if(t==='publicmember'){
      const pm=(DB.publicsMembers??[]).find(x=>x.id===id);
      if(!links.organizationId&&pm?.orgId) links.organizationId=pm.orgId;
      const src=pm?.sourceType==='relationship'?RELS.find(r=>r.id===pm.sourceId):null;
      if(src&&!links.relationshipId) links.relationshipId=src.id;
      if(src&&!links.organizationId) links.organizationId=src.targetOrganizationId??src.sourceOrganizationId;
    }
    if(t==='publics'&&!links.organizationId) links.organizationId=id??null;
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
          const row={id:`o-${Date.now()}`,name:a.name??'فرصت گردش کار',status:a.status??'IDENTIFIED',probability:a.probability??0,value:a.value??0,expectedDate:a.expectedDate??null,organizationId:links.organizationId,relationshipId:links.relationshipId??null,projectId:links.projectId??null,ownerId:a.ownerId??null,sourceType:a.sourceType??'EVENT',sourceReferralId:links.sourceReferralId??null,reason:a.reason??null,createdAt:nowIso()};
          OPPORTUNITIES.push(row); audit(req,'CREATE','opportunity',row.id,'OK',{meta:{name:row.name,reason:`workflow:${wf.id}`,execution:exec.id}});
          log.push(`✓ گام ${i+1}: فرصت «${row.name}» ساخته شد (${row.id})`);
        } else if(a.type==='CREATE_NOTIFICATION'){
          const mapType=(x)=>({INFO:'SYSTEM',REMINDER:'REMINDER',RECOMMENDATION:'RECOMMENDATION'}[x]??x??'SYSTEM');
          const mapPrio=(x)=>(String(x??'MEDIUM').toUpperCase()==='HIGH'||String(x??'').toUpperCase()==='CRITICAL')?'important':'information';
          const row={id:`n-${Date.now()}`,userId:a.userId??authUser.id,tenant:DEMO_USER_IDS.has(authUser?.id)?'demo':(authUser?.isOwner?'real':'personal'),title:a.title??'اعلان گردش کار',body:a.body??`گردش کار «${wf.name}» روی ${exec.entityType} ${exec.entityId}`,type:mapType(a.notificationType??'INFO'),priority:mapPrio(a.priority),isRead:false,read:false,createdAt:nowIso(),workflowExecutionId:exec.id,entityType:exec.entityType,entityId:exec.entityId};
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
  /* اجرای خودکار: بعد از ساخت/به‌روزرسانی هر نهاد، گردش‌کارهای هم‌محرک و فعال خودشان اجرا می‌شوند.
     آمار رویدادها برای «پوشش سراسری» ثبت می‌شود؛ eventKey مانع اجرای دوبارهٔ همان رویداد است. */
  async function autoRunWorkflows(entityType,entityId,triggerType,context={},eventKey){
    if(!Array.isArray(DB.wfEventSeen)) DB.wfEventSeen=[];
    const key=eventKey??`${entityType}:${entityId}:${triggerType}:${Date.now()}:${Math.random().toString(36).slice(2,7)}`;
    if(DB.wfEventSeen.includes(key)) return 0;
    DB.wfEventSeen.push(key);
    if(DB.wfEventSeen.length>800) DB.wfEventSeen.splice(0,DB.wfEventSeen.length-800);
    /* آمار پوشش (بدون توجه به اینکه گردش کاری اجرا شد یا نه) */
    DB.workflowStats=DB.workflowStats??{triggers:{},entities:{}};
    const tg=DB.workflowStats.triggers[triggerType]=DB.workflowStats.triggers[triggerType]??{count:0,lastAt:null};
    tg.count++; tg.lastAt=nowIso();
    const en=DB.workflowStats.entities[entityType]=DB.workflowStats.entities[entityType]??{count:0,lastAt:null,lastTrigger:null};
    en.count++; en.lastAt=nowIso(); en.lastTrigger=triggerType;
    const wfs=(DB.workflows??[]).filter(w=>w.isActive&&w.entityType===entityType&&wfScopeOk(w));
    let runs=0;
    for(const wf of wfs){
      const def=wf.definition??{};
      if(def.trigger?.type&&def.trigger.type!==triggerType) continue;
      if(!wfConditionsPass(def.conditions??[],context)) continue;
      try{ wfStart(req,wf,entityType,entityId,context,triggerType,[]); runs++; }catch(e){/* دمو پایدار بماند */}
    }
    if(runs) saveDb();
    return runs;
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
  if(is('/workflows/coverage')&&method==='GET'){
    if(!wfPerm('workflow.read')) return json(res,403,{message:'شما مجوز «مشاهده گردش کارها» (workflow.read) را ندارید.'});
    const wfs=(DB.workflows??[]).filter(w=>wfScopeOk(w));
    const execs=(DB.workflowExecutions??[]).filter(e=>{const wf=(DB.workflows??[]).find(x=>x.id===e.workflowId);return wf&&wfScopeOk(wf);});
    const stats=DB.workflowStats??{triggers:{},entities:{}};
    const byEntity=Object.keys(WFLOW_ENTITY_FA).map(t=>{
      const list=wfs.filter(w=>w.entityType===t);
      const ex=execs.filter(e=>e.entityType===t);
      const st=stats.entities[t]??{count:0,lastAt:null,lastTrigger:null};
      return {entityType:t,fa:WFLOW_ENTITY_FA[t],workflows:list.length,active:list.filter(w=>w.isActive).length,
        executions:ex.length,running:ex.filter(e=>['RUNNING','WAITING'].includes(e.status)).length,
        completed:ex.filter(e=>e.status==='COMPLETED').length,failed:ex.filter(e=>e.status==='FAILED').length,
        events:st.count,lastEventAt:st.lastAt,lastTrigger:st.lastTrigger};
    }).filter(x=>x.workflows>0||x.events>0);
    const byTrigger=Object.entries(stats.triggers).map(([type,st])=>({type,fa:WFLOW_TRIGGER_FA[type]??type,count:st.count??0,lastAt:st.lastAt??null}))
      .sort((a,b)=>b.count-a.count);
    return json(res,200,{generatedAt:nowIso(),engine:'running',
      totals:{workflows:wfs.length,active:wfs.filter(w=>w.isActive).length,executions:execs.length,
        live:execs.filter(e=>['RUNNING','WAITING'].includes(e.status)).length,
        completed:execs.filter(e=>e.status==='COMPLETED').length,failed:execs.filter(e=>e.status==='FAILED').length,
        approvalsPending:(DB.workflowApprovals??[]).filter(a=>a.status==='PENDING').length,
        coveredEntities:byEntity.filter(x=>x.active>0).length},
      byEntity,byTrigger});
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
    /* مسیرهای انگلیسی approve/reject قرارداد API واقعی‌اند؛ معادل فارسی برای سازگاری عقب‌رو می‌ماند */
    const decisionRaw=approvalDecision[1];
    const decision=decisionRaw==='approve'?'تأیید':decisionRaw==='رد'?'reject':decisionRaw;
    if(!['تأیید','reject'].includes(decision)) return json(res,400,{message:'تصمیم نامعتبر است.'});
    const b=await readBody(req);
    const a=(DB.approvals??[]).find(x=>x.id===approvalDecision[0]);
    if(!a) return json(res,404,{message:'درخواست تأیید یافت نشد.'});
    const guard=approvalFlowSafe(authUser.id,a,decision,!!authUser?.isOwner);
    if(guard) return json(res,403,{message:guard});
    if(decision==='تأیید'){
      const applied=approvalApply(req,a,b.reason);
      if(applied&&applied.error) return json(res,applied.code??409,{message:applied.error});
      a.status='APPROVED'; a.decidedById=authUser.id; a.decidedAt=nowIso(); a.decidedReason=b.reason??null;
      if(a.decidedReason!==undefined&&a.reason===null) a.reason=a.decidedReason;
      DB.approvals=DB.approvals; saveDb();
      audit(req,'APPROVAL_APPROVED','Approval',a.id,'OK',{meta:{actionType:a.actionType,entityType:a.entityType,entityId:a.entityId,reason:b.reason??null}});
      return json(res,200,{...approvalView(a),applied:applied??{تأییدd:true}});
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
      return null; // EXPORT / DATA_SHARING / DATA_IMPORT → {تأییدd:true} only
    }catch(e){ return {error:e?.message??'خطا در اعمال تأیید.',code:500}; }
  }
  /* ------------------- quality data (DataQualityService parity) ------------------- */
  const dqCan=(perm)=>authUser?.isOwner||(authUser?.permissions??[]).includes(perm);
  const DQ_READ_MSG='شما مجوز «مشاهده کیفیت داده» (data.quality.read) را ندارید.';
  const DQ_EXEC_MSG='شما مجوز «اجرای بازبینی کیفیت» (data.quality.execute) را ندارید.';
  const DQ_IMPORT_MSG='شما مجوز «وارد کردن داده» (data.import) را ندارید.';
  const dqدروازه=(oid)=>{
    if(oid&&!authUser?.isOwner&&!visibleOrgIds(req).includes(oid)) return 'شما به سازمان موردنظر (organizationId) دسترسی ندارید.';
    return null;
  };
  if(is('/data/quality')&&method==='GET'){
    if(!dqCan('data.quality.read')) return json(res,403,{message:DQ_READ_MSG});
    const oid=q.get('organizationId')??null;
    const gate=dqدروازه(oid); if(gate) return json(res,403,{message:gate});
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
    const gate=dqدروازه(oid); if(gate) return json(res,403,{message:gate});
    return json(res,200,runQualitySnapshot(req,oid));
  }
  if(is('/data/duplicates')&&method==='GET'){
    if(!dqCan('data.quality.read')) return json(res,403,{message:DQ_READ_MSG});
    const oid=q.get('organizationId')??null;
    const gate=dqدروازه(oid); if(gate) return json(res,403,{message:gate});
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
    const gate=dqدروازه(oid); if(gate) return json(res,403,{message:gate});
    const orgScope=authUser?.isOwner?null:visibleOrgIds(req);
    return json(res,200,dqDetectCandidates(entityType,body?.data??{},oid,orgScope));
  }
  if(match('/data/import/:id/تأیید')&&method==='POST') return json(res,200,{ok:true});
  if(is('/integrations')||is('/integrations/')&&method==='GET') return json(res,200,{integrations:[
    {id:'in-1',name:'تقویم Google',status:'CONNECTED'},{id:'in-2',name:'Slack',status:'DISCONNECTED'},
  ]});
  /* ------------------------------------------------------------------
     reports + export (ReportingService parity)
       · GET  /reports/:kind            → payload {report,generatedAt,…}
       · GET  /reports/:kind/export/:format?approvalId=…
           format: csv|xlsx|pdf|json   (xlsx/pdf fall back to فایل جدولی here)
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
    const canExport=authUser?.isOwner||(authUser?.permissions??[]).includes('مجوز خروجی گزارش');
    if(!canExport) return json(res,403,{message:'شما مجوز «خروجی گزارش» (مجوز خروجی گزارش) را ندارید؛ با مالک سامانه تماس بگیرید.'});
    if(format==='json'&&!authUser?.isOwner) return json(res,403,{message:'فرمت متن ساختاریافته ویژهٔ مدیران سازمانی (enterprise.admin) است.'});
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
    // csv (xlsx/pdf fall back to فایل جدولی in the demo; real API streams real xlsx/pdf)
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const esc=(v)=>{const s=v===null||v===undefined?'':String(v);return /[\",\\n\\r;]/.test(s)?'\"'+s.replace(/\"/g,'\"\"')+'\"':s;};
    const lines=['\uFEFF'+keys.map(esc).join(',')];
    for(const r of rows) lines.push(keys.map(k=>esc(r[k])).join(','));
    const body=lines.join('\r\n');
    writeExportLog(req,kind,format,rows,approval.id,sc.orgId);
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="srip-${kind}.csv"`});
    return res.end(body);
  }


  /* ───────────────────────────  معیارها و ارزیابی  ─────────────────────────── */
  if(is('/criteria')&&method==='GET'){
    const data=criteriaData();
    const subject=q.get('subjectType');
    const list=subject?criteriaForSubject(String(subject).toUpperCase()):data.criteria;
    return json(res,200,{
      version:CRITERIA_VERSION,
      families:Object.entries(data.familyMeta).map(([key,m])=>({key,...m,criteria:list.filter(c=>c.family===key).map(c=>c.code)})),
      scales:Object.fromEntries(Object.entries(data.scales).map(([k,v])=>[k,{label:v.label,anchors:v.anchors}])),
      criteria:list.map(c=>({...c,anchors:c.anchors??data.scales[c.scaleId]?.anchors??[],familyName:data.familyMeta[c.family]?.name??c.family})),
      methodLabels:METHOD_LABELS,
    });
  }
  {
    const qMatch=match('/criteria/questionnaire/:subjectType');
    if(qMatch&&method==='GET'){
      const subject=String(qMatch[0]).toUpperCase();
      if(!['ORGANIZATION','PERSON','RELATIONSHIP','OPPORTUNITY'].includes(subject)) return json(res,400,{message:'نوع سوژه نامعتبر است.'});
      const questions=criteriaForSubject(subject).filter(c=>c.intake&&c.evidence!=='OBSERVED').map(c=>({
        code:`Q_${c.code}`,criterionCode:c.code,family:c.family,familyName:criteriaData().familyMeta[c.family].name,subject,
        prompt:c.intake.prompt,help:c.intake.help,recommended:!!c.intake.recommended,polarity:c.polarity,
        warning:c.intake.warning??null,warnBelow:c.intake.warnBelow??null,anchors:criteriaScale(c),
        criterion:{...c,anchors:criteriaScale(c)},
      }));
      return json(res,200,{subjectType:subject,version:CRITERIA_VERSION,optional:true,totalCriteria:criteriaForSubject(subject).length,questions,recommendedIds:questions.filter(x=>x.recommended).map(x=>x.code),note:'همۀ پرسش‌ها اختیاری‌اند. پاسخ‌ندادنه با صفر یکسان نیست: معیار در «ناشناخته» می‌ماند و اطمینان امتیاز پایین می‌آید.'});
    }
  }
  {
    const aMatch=match('/criteria/assessment/:subjectType/:subjectId');
    if(aMatch&&(method==='GET'||method==='POST'||method==='PATCH')){
      const subject=String(aMatch[0]).toUpperCase();
      if(!['ORGANIZATION','PERSON','RELATIONSHIP','OPPORTUNITY'].includes(subject)) return json(res,400,{message:'نوع سوژه نامعتبر است.'});
      const subjectId=aMatch[1];
      const orgOf = (type,id)=>type==='ORGANIZATION'?id:type==='PERSON'?(PEOPLE.find(x=>x.id===id)?.organizationId??null):type==='OPPORTUNITY'?(RELS.find(x=>x.id===OPPORTUNITIES.find(o=>o.id===id)?.relationshipId)?.sourceOrganizationId??null):(RELS.find(x=>x.id===id)?.sourceOrganizationId??null);
      const record = subject==='ORGANIZATION'?ORGS.find(x=>x.id===subjectId):subject==='PERSON'?PEOPLE.find(x=>x.id===subjectId):subject==='OPPORTUNITY'?OPPORTUNITIES.find(x=>x.id===subjectId):RELS.find(x=>x.id===subjectId);
      if(!record) return json(res,404,{message:'رکورد موردنظر یافت نشد.'});
      const ownerOrg = orgOf(subject,subjectId);
      if(ownerOrg && !inScope(req,ownerOrg)) return json(res,403,{message:'دسترسی به ارزیابی این رکورد مجاز نیست.'});
      if(method!=='GET'){
        const b=await readBody(req);
        const answers=normalizeCriteriaAnswers(b.answers??b.criteriaAnswers??b);
        const unknownCodes=(Array.isArray(b.answers??b)?b.answers:[]).map(x=>String(x?.criterionCode??'').toUpperCase()).filter(code=>code&&!criterionByCode(code));
        if(unknownCodes.length) return json(res,400,{message:`معیارهای ناشناخته: ${unknownCodes.join('، ')}`});
        const scopeErr=criteriaScopeError(subject,answers);
        if(scopeErr) return json(res,400,{message:scopeErr});
        if(!answers.length) return json(res,400,{message:'دست‌کم یک پاسخ لازم است. اگر نمی‌دانید، این بخش را رد کنید.'});
        const savedCount=saveStoredAnswers(subject,subjectId,answers);
        let assessment; try { assessment=computeCriteria(subject,subjectId); } catch (e) { return json(res,500,{message:'محاسبۀ ارزیابی ناموفق بود: '+String(e?.message??e)}); }
        audit(req,'UPDATE','criteria',`${subject}:${subjectId}`,'OK',{answers:savedCount,score:assessment.score,coverage:assessment.coverage});
        NOTIFICATIONS.unshift({id:`n-crit-${Date.now()}`,userId:authUser?.id??'u-demo',type:assessment.flags.some(f=>f.severity==='CRITICAL')?'ALERT':'INFO',title:assessment.flags.some(f=>f.severity==='CRITICAL')?'پرچم بحرانی در ارزیابی معیارها':'ارزیابی معیارها به‌روزرسانی شد',body:assessment.flags[0]?.message??`امتیاز ${assessment.score} با پوشش ${assessment.coverage}٪ محاسبه شد.`,channel:'IN_APP',priority:assessment.flags.some(f=>f.severity==='CRITICAL')?'HIGH':'MEDIUM',createdAt:new Date().toISOString(),readAt:null,data:{subjectType:subject,subjectId}});
        return json(res,200,{savedCount,assessment:{...assessment,summary:criteriaSummaryLite(assessment)}});
      }
      try { return json(res,200,computeCriteria(subject,subjectId)); }
      catch (e) { return json(res,500,{message:'محاسبۀ ارزیابی ناموفق بود: '+String(e?.message??e)}); }
    }
  }
  if(is('/criteria/review-queue')&&method==='GET'){
    const rows=[];
    for(const [key,bucket] of Object.entries(assessmentStore())){
      const [subjectType,subjectId]=key.split(':');
      for(const [code,a] of Object.entries(bucket??{})){
        const c=criterionByCode(code); if(!c) continue;
        const age=a.answeredAt?Math.floor((Date.now()-new Date(a.answeredAt).getTime())/86400000):9999;
        if(age<c.halfLifeDays) continue;
        rows.push({subjectType,subjectId,criterionCode:code,name:c.name,age,dueInDays:c.halfLifeDays-age,reason:age>c.halfLifeDays*2?'اعتبار پاسخ گذشته (بیش از دو نیمه‌عمر)':'نزدیک به پایان اعتبار پاسخ',weight:c.weight});
      }
    }
    rows.sort((x,y)=>y.age-x.age);
    return json(res,200,{tasks:[],staleAnswers:rows,total:rows.length});
  }
  {
    const ovMatch=match('/criteria/overrides/:organizationId');
    if(ovMatch){
      const data=criteriaData();
      if(method==='GET') return json(res,200,{version:CRITERIA_VERSION,defaults:data.familyWeights,organizationId:ovMatch[0],overrides:DB.criteriaOverrides??[],families:Object.entries(data.familyMeta).map(([key,m])=>({key,...m}))});
      const b=await readBody(req);
      const subject=String(b.subjectType??'RELATIONSHIP').toUpperCase();
      const incoming=b.familyWeights??{};
      const merged={...(data.familyWeights[subject]??{})};
      for(const k of Object.keys(merged)){ const v=Number(incoming[k]); if(Number.isFinite(v)&&v>=0&&v<=1) merged[k]=v; }
      const total=Object.values(merged).reduce((sum,v)=>sum+v,0)||1;
      const normalized=Object.fromEntries(Object.entries(merged).map(([k,v])=>[k,Math.round((v/total)*10000)/10000]));
      DB.criteriaOverrides=[...(DB.criteriaOverrides??[]).filter(x=>x.subjectType!==subject),{id:'ov-'+Date.now(),organizationId:ovMatch[0],subjectType:subject,scope:b.scope??'DEFAULT',familyWeights:normalized,minCoverageForRanking:Number(b.minCoverageForRanking??40),enabled:true,updatedAt:new Date().toISOString()}];
      saveDb();
      audit(req,'UPDATE','criteria-overrides',subject,'OK',{familyWeights:normalized});
      return json(res,200,{subjectType:subject,familyWeights:normalized,minCoverageForRanking:Number(b.minCoverageForRanking??40)});
    }
  }
  {
    const covMatch=match('/criteria/coverage/:organizationId');
    if(covMatch&&method==='GET'){
      const subject=String(q.get('subjectType')??'RELATIONSHIP').toUpperCase();
      const oid=covMatch[0];
      const ids=subject==='PERSON'?PEOPLE.filter(x=>x.organizationId===oid).map(x=>x.id):subject==='ORGANIZATION'?[oid]:RELS.filter(r=>r.sourceOrganizationId===oid||r.targetOrganizationId===oid).map(r=>r.id);
      const minForRanking=Math.ceil(criteriaForSubject(subject).length*0.35);
      const rows=ids.map(id=>{const a=storedAnswers(subject,id);const answered=Object.keys(a).filter(k=>a[k].level!=null||a[k].value!=null).length;return {subjectId:id,answered,ready:answered>=minForRanking};});
      return json(res,200,{subjectType:subject,assessed:rows.filter(r=>r.answered>0).length,rankable:rows.filter(r=>r.ready).length,total:rows.length,minAnswersForRanking:minForRanking,rows});
    }
  }


  /* ─────────────── تنظیم دستی امتیاز (manual nudge) ─────────────── */
  if(is('/criteria/manual')&&method==='GET'){
    const rows=(DB.criteriaManual??[]).map((m)=>({...m,subjectLabel:subjectLabel(m.subjectType,m.subjectId),active:(m.enabled!==false)&&!(m.expiresAt&&new Date(m.expiresAt).getTime()<=Date.now())}));
    return json(res,200,{items:rows.sort((a,b)=>String(b.updatedAt??'').localeCompare(String(a.updatedAt??'')))});
  }
  {
    const mMatch=match('/criteria/manual/:subjectType/:subjectId');
    if(mMatch&&['GET','POST','PATCH','DELETE'].includes(method)){
      const subject=String(mMatch[0]).toUpperCase();
      const subjectId=mMatch[1];
      if(!['ORGANIZATION','PERSON','RELATIONSHIP','OPPORTUNITY'].includes(subject)) return json(res,400,{message:'نوع سوژه نامعتبر است.'});
      const record = subject==='ORGANIZATION'?ORGS.find(x=>x.id===subjectId):subject==='PERSON'?PEOPLE.find(x=>x.id===subjectId):subject==='OPPORTUNITY'?OPPORTUNITIES.find(x=>x.id===subjectId):RELS.find(x=>x.id===subjectId);
      if(!record) return json(res,404,{message:'رکورد موردنظر یافت نشد.'});
      const ownerOrg = subject==='ORGANIZATION'?subjectId:subject==='PERSON'?(PEOPLE.find(x=>x.id===subjectId)?.organizationId??null):subject==='OPPORTUNITY'?(OPPORTUNITIES.find(x=>x.id===subjectId)?.relationshipId?RELS.find(r=>r.id===OPPORTUNITIES.find(o=>o.id===subjectId).relationshipId)?.sourceOrganizationId??null:null):(RELS.find(x=>x.id===subjectId)?.sourceOrganizationId??null);
      if(ownerOrg && !inScope(req,ownerOrg)) return json(res,403,{message:'تنظیم امتیاز این رکورد مجاز نیست.'});
      if(method==='GET'){
        const m=manualFor(subject,subjectId);
        let assessment=null; try { assessment=applyManual(subject,subjectId,computeCriteria(subject,subjectId)); } catch {}
        return json(res,200,{manual:m,assessment});
      }
      if(method==='DELETE'){
        DB.criteriaManual=(DB.criteriaManual??[]).filter(x=>!(x.subjectType===subject&&x.subjectId===subjectId));
        saveDb();
        audit(req,'DELETE','criteria-manual',`${subject}:${subjectId}`,'OK',{action:'remove manual nudge'});
        return json(res,200,{removed:true});
      }
      const b=await readBody(req);
      const delta=Number(b.delta);
      if(!Number.isFinite(delta)||delta<-25||delta>25) return json(res,400,{message:'جابه‌جایی باید عددی بین ۲۵- تا ۲۵+ باشد.'});
      const reason=String(b.reason??'').trim();
      if(!reason) return json(res,400,{message:'دلیل تنظیم دستی الزامی است (برای ممیزی و بازبینی بعدی).'});
      if(reason.length>240) return json(res,400,{message:'دلیل حداکثر ۲۴۰ نویسه.'});
      const days=Number(b.expiresInDays);
      const expiresAt=Number.isFinite(days)&&days>0?new Date(Date.now()+days*86400000).toISOString():null;
      const existing=manualFor(subject,subjectId);
      const manual={id:existing?.id??'m-'+Date.now(),subjectType:subject,subjectId,delta:Math.round(delta),
        reason,expiresAt,enabled:b.enabled!==false,createdBy:authUser?.name??authUser?.email??'کارشناس',
        createdAt:existing?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()};
      DB.criteriaManual=(DB.criteriaManual??[]).filter(x=>!(x.subjectType===subject&&x.subjectId===subjectId));
      DB.criteriaManual.push(manual);
      saveDb();
      audit(req,'UPDATE','criteria-manual',`${subject}:${subjectId}`,'OK',{delta,reason,expiresAt});
      NOTIFICATIONS.unshift({id:`n-crit-m-${Date.now()}`,userId:authUser?.id??'u-demo',type:'INFO',title:'تنظیم دستی امتیاز ثبت شد',body:`${subjectLabel(subject,subjectId)}: ${delta>0?'+':''}${delta} — ${reason}`,channel:'IN_APP',priority:'MEDIUM',createdAt:new Date().toISOString(),readAt:null,data:{subjectType:subject,subjectId}});
      let assessment=null; try { assessment=applyManual(subject,subjectId,computeCriteria(subject,subjectId)); } catch {}
      return json(res,200,{manual,assessment});
    }
  }


  /* ─────────────── اخطارهای دادهٔ ناقص / کهنه (nudge) ─────────────── */
  if(is('/criteria/nudges')&&method==='GET'){
    const activeOrg=req.headers['x-tenancy-org']||req.headers['x-workspace-org']||req.headers['x-org-id']||null;
    const category=(DB.criteriaManual??[]).filter((m)=>m.reason).map((m)=>({kind:'MANUAL_ACTIVE',subjectType:m.subjectType,subjectId:m.subjectId,severity:'INFO',title:'تنظیم دستی امتیاز فعال است',body:`${subjectLabel(m.subjectType,m.subjectId)} — ${m.reason}`}));
    const slow=[];
    for(const [key,bucket] of Object.entries(assessmentStore())){
      const [subjectType,subjectId]=key.split(':');
      for(const [code,a] of Object.entries(bucket??{})){
        const c=criterionByCode(code); if(!c) continue;
        const age=a.answeredAt?Math.floor((Date.now()-new Date(a.answeredAt).getTime())/86400000):9999;
        if(age<c.halfLifeDays) continue;
        slow.push({kind:'STALE_ANSWER',subjectType,subjectId,criterionCode:code,age,dueInDays:c.halfLifeDays-age,severity:age>c.halfLifeDays*2?'HIGH':'MEDIUM',title:'ارزیابی کهنهٔ معیارها',body:`${subjectLabel(subjectType,subjectId)}: ${c.name} — ${age>c.halfLifeDays*2?'اعتبار پاسخ گذشته (بیش از دو نیمه‌عمر)':'نزدیک به پایان اعتبار پاسخ'}`,data:{subjectType,subjectId}});
      }
    }
    const all=[...category,...slow].sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
    return json(res,200,{items:all,total:all.length});
  }
  {
    const nM=match('/criteria/nudges/:subjectType/:subjectId');
    if(nM&&method==='POST'){
      const SUBJECTS=['ORGANIZATION','PERSON','RELATIONSHIP','OPPORTUNITY'];
      const subject=String(nM[0]).toUpperCase(); const subjectId=nM[1];
      if(!SUBJECTS.includes(subject)) return json(res,400,{message:'نوع سوژه نامعتبر است.'});
      const b=await readBody(req);
      const kind=String(b.kind??'REVIEW'); const note=String(b.note??'').slice(0,200);
      NOTIFICATIONS.unshift({id:`n-nudge-${Date.now()}`,userId:authUser?.id??'u-demo',type:'INFO',title:'به‌روزرسانی معیارها لازم است',body:`${subjectLabel(subject,subjectId)} — ${note||'داده‌های معیارها کهنه شده‌اند.'}`,channel:'IN_APP',priority:'MEDIUM',createdAt:new Date().toISOString(),readAt:null,data:{subjectType:subject,subjectId,kind}});
      return json(res,200,{queued:true,kind});
    }
  }

  /* ─────────────── عموم‌ها (Publics) ─────────────── */
  const pubOrgIdParam=()=>{
    const h=req.headers['x-tenancy-org']||req.headers['x-workspace-org']||req.headers['x-org-id']||null;
    return q.get('orgId')||h||null;
  };
  const pubHomeOrg=()=>{
    const pid=pubOrgIdParam();
    if(pid) return pid;
    const vis=visibleOrgIds(req);
    if(vis.length) return vis[0];
    return null;
  };
  const pubMemberSource=(sourceType,sourceId)=>{
    const t=String(sourceType??'').toLowerCase();
    if(t==='organization'){ const o=orgById(sourceId); return o?{ok:true,label:o.name}:{ok:false,msg:'سازمان مبدأ یافت نشد.'}; }
    if(t==='person'){ const p=personById(sourceId); return p?{ok:true,label:`${p.firstName??''} ${p.lastName??''}`.trim()||p.id}:{ok:false,msg:'شخص مبدأ یافت نشد.'}; }
    if(t==='relationship'){ const r=RELS.find(x=>x.id===sourceId); return r?{ok:true,label:r.id}:{ok:false,msg:'رابطهٔ مبدأ یافت نشد.'}; }
    if(t==='media'){ const m=(DB.mediaStore??[]).find(x=>x.id===sourceId); return m?{ok:true,label:m.name}:{ok:false,msg:'رسانهٔ مبدأ یافت نشد.'}; }
    return {ok:false,msg:'نوع مبدأ نامعتبر است (organization/person/relationship/media).'};
  };
  if(is('/dev/reset')&&method==='POST'){
    const u=currentUser(req);
    if(!u?.isOwner) return json(res,403,{message:'فقط مالک سامانه می‌تواند دادهٔ دمو را بازنشانی کند.'});
    resetDbInPlace();
    audit(req,'RESET','Demo','*','OK',{meta:{note:'resetDbInPlace'}});
    return json(res,200,{ok:true,seededAt:nowIso()});
  }
  if(is('/publics/catalog')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const cat=DB.publicsCatalog??{version:1,categories:PUBLIC_CATEGORY_ORDER.map(id=>({id,fa:PUBLIC_CATEGORY_FA[id]})),linkages:PUBLIC_LINKAGE_FA,stages:PUBLIC_STAGE_FA,stances:PUBLIC_STANCE_FA,templates:PUBLICS_TEMPLATES};
    return json(res,200,cat);
  }
  const pubSelfRoute=match('/publics/self/:orgId');
  if(pubSelfRoute&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubSelfRoute[0];
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const self=pubByOrg(orgId);
    const tpl=pubTplById(self?.templateId??'HOLDING');
    const totals=pubCoverage(orgId).totals;
    return json(res,200,{orgId,orgName:orgById(orgId)?.name??null,self:self??null,
      template:{id:tpl.id,fa:tpl.fa,focus:tpl.focus??[],groups:(tpl.groups??[]).length},
      effective:(()=>{const eg=pubEffectiveGroups(orgId);return {total:eg.length,active:eg.filter(x=>x.active!==false).length,custom:eg.filter(x=>x.source==='custom').length,overridden:eg.filter(x=>x.overridden).length};})(),
      structure:self?.structure??null,missionTopic:self?.missionTopic??null,
      reviewedAt:self?.reviewedAt??null,reviewIntervalDays:self?.reviewIntervalDays??90,
      coverage:totals,templateCatalog:DB.publicsCatalog??null});
  }
  if(pubSelfRoute&&method==='PUT'){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const orgId=pubSelfRoute[0];
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const b=await readBody(req);
    const companyType=String(b.companyType??'HOLDING');
    if(!PUBLICS_TEMPLATES[companyType]) return json(res,400,{message:`الگوی «${companyType}» در کاتالوگ عموم‌ها وجود ندارد.`});
    const cur=pubByOrg(orgId);
    const row=Object.assign(cur??{orgId},{
      companyType,templateId:companyType,
      structure:b.structure??cur?.structure??{sectors:PUBLIC_SECTORS.slice(),subsidiaries:[],ownership:'PRIVATE'},
      missionTopic:String(b.missionTopic??cur?.missionTopic??'').trim()||null,
      reviewedAt:nowIso(),reviewIntervalDays:Number(b.reviewIntervalDays)||90,
      updatedBy:authUser?.email??null});
    if(!cur) DB.publicsSelf.push(row);
    saveDb();
    audit(req,'UPSERT','Publics',orgId,'OK',{meta:{companyType,templateId:companyType,missionTopic:row.missionTopic}});
    return json(res,200,row);
  }
  const pubGroupsRoute=match('/publics/groups/:orgId');
  const pubGroupOneRoute=match('/publics/groups/:orgId/:groupId');
  if(pubGroupsRoute&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubGroupsRoute[0];
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const self=pubByOrg(orgId); const tpl=pubTplById(self?.templateId??'HOLDING');
    const groups=pubEffectiveGroups(orgId);
    return json(res,200,{orgId,orgName:orgById(orgId)?.name??null,templateId:tpl.id,templateFa:tpl.fa,
      groups,totals:{total:groups.length,active:groups.filter(g=>g.active!==false).length,
      inactive:groups.filter(g=>g.active===false).length,custom:groups.filter(g=>g.source==='custom').length,
      overridden:groups.filter(g=>g.overridden).length}});
  }
  if(pubGroupsRoute&&method==='POST'){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const orgId=pubGroupsRoute[0];
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const b=await readBody(req);
    const fa=String(b.fa??'').trim();
    if(!fa) return json(res,400,{message:'نام گروه لازم است.'});
    const cat=String(b.cat??'');
    if(!PUBLIC_CATEGORY_ORDER.includes(cat)) return json(res,400,{message:'دستهٔ گروه معتبر نیست.'});
    const link=String(b.link??'DIFFUSED');
    if(!PUBLIC_LINKAGE_FA[link]) return json(res,400,{message:'نوع پیوند معتبر نیست.'});
    const smin=String(b.smin??'AWARE'),smax=String(b.smax??'ACTIVE');
    if(!PUBLIC_STAGE_FA[smin]||!PUBLIC_STAGE_FA[smax]) return json(res,400,{message:'بازهٔ مرحله معتبر نیست.'});
    if(PUB_STAGE_ORDER.indexOf(smin)>PUB_STAGE_ORDER.indexOf(smax)) return json(res,400,{message:'شروع بازهٔ مرحله نمی‌تواند بعد از پایان آن باشد.'});
    const stance=String(b.stance??'OBSERVER');
    if(!PUBLIC_STANCE_FA[stance]) return json(res,400,{message:'موضع پایه معتبر نیست.'});
    const row={id:`cg-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,orgId,cat,fa,link,
      smin,smax,stance,kanal:String(b.kanal??'').trim(),note:String(b.note??'').trim(),
      createdAt:nowIso(),createdBy:authUser?.email??null};
    DB.publicsCustomGroups.push(row); saveDb();
    audit(req,'CREATE','PublicGroup',row.id,'OK',{meta:{orgId,cat,fa}});
    return json(res,201,pubEffGroup(orgId,row.id));
  }
  if(pubGroupOneRoute&&(method==='PUT'||method==='DELETE')){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const orgId=pubGroupOneRoute[0],groupId=pubGroupOneRoute[1];
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const b=method==='PUT'?await readBody(req):{};
    const custom=(DB.publicsCustomGroups??[]).find(x=>x.orgId===orgId&&x.id===groupId);
    if(custom){
      if(method==='DELETE'){
        const n=(DB.publicsMembers??[]).filter(m=>m.orgId===orgId&&m.groupId===groupId).length;
        if(n>0) return json(res,400,{message:`این گروه ${n} عضو دارد؛ ابتدا اعضا را حذف یا به گروه دیگری منتقل کنید.`});
        DB.publicsCustomGroups=DB.publicsCustomGroups.filter(x=>x.id!==groupId); saveDb();
        audit(req,'DELETE','PublicGroup',groupId,'OK',{meta:{orgId}});
        return json(res,200,{ok:true,deleted:groupId});
      }
      for(const k of ['cat','fa','link','smin','smax','stance','kanal','note']){
        if(b[k]===undefined) continue;
        const v=String(b[k]??'').trim();
        if(k==='cat'&&!PUBLIC_CATEGORY_ORDER.includes(v)) return json(res,400,{message:'دستهٔ گروه معتبر نیست.'});
        if(k==='link'&&!PUBLIC_LINKAGE_FA[v]) return json(res,400,{message:'نوع پیوند معتبر نیست.'});
        if((k==='smin'||k==='smax')&&!PUBLIC_STAGE_FA[v]) return json(res,400,{message:'بازهٔ مرحله معتبر نیست.'});
        if(k==='stance'&&!PUBLIC_STANCE_FA[v]) return json(res,400,{message:'موضع پایه معتبر نیست.'});
        if(k==='fa'&&!v) return json(res,400,{message:'نام گروه لازم است.'});
        custom[k]=v;
      }
      if(PUB_STAGE_ORDER.indexOf(custom.smin)>PUB_STAGE_ORDER.indexOf(custom.smax)) return json(res,400,{message:'شروع بازهٔ مرحله نمی‌تواند بعد از پایان آن باشد.'});
      saveDb();
      audit(req,'UPDATE','PublicGroup',groupId,'OK',{meta:{orgId}});
      return json(res,200,pubEffGroup(orgId,groupId));
    }
    const self=pubByOrg(orgId); const tpl=pubTplById(self?.templateId??'HOLDING');
    const base=(tpl.groups??[]).find(g=>g.id===groupId);
    if(!base) return json(res,404,{message:'این گروه در الگوی شرکت شما وجود ندارد.'});
    if(method==='DELETE') return json(res,400,{message:'گروه‌های الگو حذف نمی‌شوند؛ در صورت عدم نیاز، آن را غیرفعال کنید.'});
    if(b.restore===true){
      DB.publicsGroupOverrides=(DB.publicsGroupOverrides??[]).filter(x=>!(x.orgId===orgId&&x.groupId===groupId));
      saveDb();
      audit(req,'UPDATE','PublicGroup',groupId,'OK',{meta:{orgId,restored:true}});
      return json(res,200,pubEffGroup(orgId,groupId));
    }
    if(b.active===false){
      const n=(DB.publicsMembers??[]).filter(m=>m.orgId===orgId&&m.groupId===groupId).length;
      if(n>0) return json(res,400,{message:`این گروه ${n} عضو دارد؛ ابتدا اعضا را حذف یا به گروه دیگری منتقل کنید.`});
    }
    let ov=(DB.publicsGroupOverrides??[]).find(x=>x.orgId===orgId&&x.groupId===groupId);
    if(!ov){ ov={orgId,groupId}; DB.publicsGroupOverrides.push(ov); }
    for(const k of ['cat','fa','link','smin','smax','stance','kanal']){
      if(b[k]===undefined||b[k]===null||b[k]==='') continue;
      const v=String(b[k]).trim();
      if(k==='cat'&&!PUBLIC_CATEGORY_ORDER.includes(v)) return json(res,400,{message:'دستهٔ گروه معتبر نیست.'});
      if(k==='link'&&!PUBLIC_LINKAGE_FA[v]) return json(res,400,{message:'نوع پیوند معتبر نیست.'});
      if((k==='smin'||k==='smax')&&!PUBLIC_STAGE_FA[v]) return json(res,400,{message:'بازهٔ مرحله معتبر نیست.'});
      if(k==='stance'&&!PUBLIC_STANCE_FA[v]) return json(res,400,{message:'موضع پایه معتبر نیست.'});
      if(k==='fa'&&!v) return json(res,400,{message:'نام گروه لازم است.'});
      ov[k]=v;
    }
    if(b.note!==undefined) ov.note=String(b.note??'');
    if(b.active!==undefined) ov.active=b.active!==false;
    const okeys=Object.keys(ov).filter(k=>!['orgId','groupId'].includes(k));
    if(!okeys.length||(okeys.length===1&&okeys[0]==='active'&&ov.active!==false))
      DB.publicsGroupOverrides=DB.publicsGroupOverrides.filter(x=>x!==ov);
    saveDb();
    audit(req,'UPDATE','PublicGroup',groupId,'OK',{meta:{orgId,fields:okeys}});
    return json(res,200,pubEffGroup(orgId,groupId));
  }
  if(is('/publics/members')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubOrgIdParam();
    let rows=(DB.publicsMembers??[]);
    if(orgId){ if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'}); rows=rows.filter(m=>m.orgId===orgId); }
    else rows=rows.filter(m=>inScope(req,m.orgId));
    const stance=q.get('stance'); if(stance) rows=rows.filter(m=>m.stance===stance);
    const stage=q.get('stage'); if(stage) rows=rows.filter(m=>m.stage===stage);
    let views=rows.map(pubMemberView);
    const cat=q.get('categoryId'); if(cat) views=views.filter(m=>m.categoryId===cat);
    views.sort((a,b)=>String(a.groupFa??'').localeCompare(String(b.groupFa??''),'fa'));
    return json(res,200,{items:views,total:views.length,orgId:orgId??null});
  }
  if(is('/publics/members')&&method==='POST'){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const b=await readBody(req);
    const orgId=String(b.orgId??''); const groupId=String(b.groupId??'');
    if(!orgId||!groupId) return json(res,400,{message:'شناسهٔ سازمان و گروه لازم است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const self=pubByOrg(orgId)??{orgId,templateId:'HOLDING'};
    const effG=pubEffGroup(orgId,groupId);
    if(!effG) return json(res,400,{message:'گروه انتخابی در نقشهٔ عموم‌های این سازمان وجود ندارد.'});
    if(effG.active===false) return json(res,400,{message:'این گروه در نقشهٔ سازمان شما غیرفعال است؛ ابتدا آن را فعال کنید.'});
    const sourceType=String(b.sourceType??'organization'); const sourceId=String(b.sourceId??'');
    if(!sourceId) return json(res,400,{message:'شناسهٔ منبع لازم است.'});
    const src=pubMemberSource(sourceType,sourceId); if(!src.ok) return json(res,400,{message:src.msg});
    const raw={orgId,groupId,sourceType,sourceId,linkage:b.linkage??null,stage:b.stage??null,
      power:b.power!=null?Number(b.power):null,interest:b.interest!=null?Number(b.interest):null,stance:b.stance??null,note:String(b.note??'')};
    const sug=pubSuggester(raw);
    const row={id:`pm-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,orgId,groupId,sourceType,sourceId,
      linkage:b.linkage??sug.linkage,stage:b.stage??sug.stage,power:Number.isFinite(Number(b.power))?Number(b.power):sug.power,
      interest:Number.isFinite(Number(b.interest))?Number(b.interest):sug.interest,stance:b.stance??sug.stance,
      note:String(b.note??''),assessedAt:nowIso(),reviewDue:new Date(Date.now()+(Number(self.reviewIntervalDays)||90)*86400000).toISOString()};
    DB.publicsMembers.push(row);
    const ctx={publicMember:pubMemberView(row),groupId,orgId,sourceType,sourceId};
    await autoRunWorkflows('PublicMember',row.id,'PUBLIC_MEMBER_ADDED',ctx,`pm-added:${row.id}`);
    // شکاف: عموم کلیدی با مرحلهٔ غیرفعال، یا نبود پوشش رسانه‌ای
    const gaps=pubGaps(orgId).gaps;
    const lag=gaps.find(g=>g.memberId===row.id);
    const gMedia=gaps.find(g=>g.gapId?.startsWith('MEDIA:'));
    if(lag||gMedia){
      const key=`pm-gap:${row.id}:${lag?'lag':''}${gMedia?'media':''}`;
      await autoRunWorkflows('Publics',orgId,'PUBLIC_GAP_DETECTED',{orgId,gapIds:(gaps.filter(g=>g.memberId===row.id||g.gapId?.startsWith('MEDIA:')).map(g=>g.gapId)),publicMemberId:row.id},key);
    }
    saveDb();
    audit(req,'CREATE','PublicMember',row.id,'OK',{meta:{orgId,groupId,sourceType,sourceId,stage:row.stage,stance:row.stance}});
    return json(res,201,pubMemberView(row));
  }
  const pubMemberRoute=match('/publics/members/:id');
  if(pubMemberRoute&&method==='PATCH'){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const m=(DB.publicsMembers??[]).find(x=>x.id===pubMemberRoute[0]);
    if(!m) return json(res,404,{message:'عضو عموم یافت نشد.'});
    if(!inScope(req,m.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const b=await readBody(req);
    const before={stage:m.stage,stance:m.stance,linkage:m.linkage,power:m.power,interest:m.interest};
    if(b.stage!==undefined){ if(!PUBLIC_STAGE_FA[b.stage]) return json(res,400,{message:'مرحله معتبر نیست.'}); m.stage=b.stage; }
    if(b.linkage!==undefined){ if(!PUBLIC_LINKAGE_FA[b.linkage]) return json(res,400,{message:'نوع پیوند معتبر نیست.'}); m.linkage=b.linkage; }
    if(b.stance!==undefined){ if(!PUBLIC_STANCE_FA[b.stance]) return json(res,400,{message:'موضع معتبر نیست.'}); m.stance=b.stance; }
    if(b.power!==undefined){ const v=Number(b.power); if(!Number.isFinite(v)||v<0||v>100) return json(res,400,{message:'قدرت باید عددی بین ۰ تا ۱۰۰ باشد.'}); m.power=v; }
    if(b.interest!==undefined){ const v=Number(b.interest); if(!Number.isFinite(v)||v<0||v>100) return json(res,400,{message:'علاقه باید عددی بین ۰ تا ۱۰۰ باشد.'}); m.interest=v; }
    if(b.note!==undefined) m.note=String(b.note).slice(0,240);
    if(b.power!==undefined||b.interest!==undefined||b.stage!==undefined) m.stance=pubStanceOf(m.power,m.interest);
    if(b.assess!==false){ m.assessedAt=nowIso(); m.reviewDue=new Date(Date.now()+(Number(b.reviewIntervalDays)||90)*86400000).toISOString(); }
    const ctx={publicMember:pubMemberView(m),orgId:m.orgId,groupId:m.groupId,before,after:{stage:m.stage,stance:m.stance,linkage:m.linkage},sourceType:m.sourceType,sourceId:m.sourceId};
    if(m.stage!==before.stage) await autoRunWorkflows('PublicMember',m.id,'PUBLIC_STAGE_CHANGED',ctx,`pm-stage:${m.id}:${before.stage}>${m.stage}`);
    const gaps=pubGaps(m.orgId).gaps;
    const lag=gaps.find(g=>g.memberId===m.id);
    if(lag||m.stance==='KEY_PLAYER'&&m.stage!=='ACTIVE') await autoRunWorkflows('Publics',m.orgId,'PUBLIC_GAP_DETECTED',{orgId:m.orgId,gapIds:gaps.filter(g=>g.memberId===m.id).map(g=>g.gapId),publicMemberId:m.id},`pm-gap:${m.id}:${m.stage}:${m.stance}`);
    saveDb();
    audit(req,'UPDATE','PublicMember',m.id,'OK',{meta:{before,after:{stage:m.stage,stance:m.stance}}});
    return json(res,200,pubMemberView(m));
  }
  if(pubMemberRoute&&method==='DELETE'){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const m=(DB.publicsMembers??[]).find(x=>x.id===pubMemberRoute[0]);
    if(!m) return json(res,404,{message:'عضو عموم یافت نشد.'});
    if(!inScope(req,m.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    DB.publicsMembers=DB.publicsMembers.filter(x=>x.id!==m.id); saveDb();
    audit(req,'DELETE','PublicMember',m.id,'OK',{meta:{orgId:m.orgId,groupId:m.groupId}});
    return json(res,200,{removed:true});
  }
  if(is('/publics/coverage')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubHomeOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    return json(res,200,pubCoverage(orgId));
  }
  if(is('/publics/gaps')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubHomeOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    return json(res,200,pubGaps(orgId));
  }
  if(is('/publics/review-due')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubHomeOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const now=Date.now();
    const due=(DB.publicsMembers??[]).filter(m=>m.orgId===orgId&&m.reviewDue&&new Date(m.reviewDue).getTime()<=now);
    for(const m of due) await autoRunWorkflows('PublicMember',m.id,'PUBLIC_REVIEW_DUE',{publicMember:pubMemberView(m),orgId,groupId:m.groupId},`pm-review:${m.id}:${m.reviewDue}`);
    return json(res,200,{orgId,generatedAt:nowIso(),items:due.map(pubMemberView),total:due.length});
  }
  /* ---------- STRATEGY: تحلیل راهبردی ---------- */
  const stOrg=()=>{ const o=q.get('orgId')||pubHomeOrg(); return o; };
  const stGet=(id)=>{ seedStrategyStore(); return (DB.strategyScenarios??[]).find(s=>s.id===id)??null; };
  const stAnalysis=(sc)=>{
    if(sc.kind==='sequential'){
      try{ const spe=stBackward(sc.tree); return {kind:'sequential',spe}; }
      catch(e){ return {kind:'sequential',error:String(e?.message??e)}; }
    }
    const A=sc.paySelf,B=sc.payRival;
    const out={kind:'normal',bestResponses:stBestResponses(A,B),pureNE:stPureNE(A,B),
      mixed:null,delta:stDeltaCondition(A),dominance:stDominance(A,B,sc.selfStrats,sc.rivalStrats)};
    if(A.length===2&&A[0].length===2) out.mixed=stMixed22(A,B);
    return out;
  };
  if(is('/strategy/archetypes')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    return json(res,200,{items:STRATEGY_ARCHETYPES.map(a=>({...a}))});
  }
  if(is('/strategy/scenarios')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    seedStrategyStore();
    const orgId=stOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const items=(DB.strategyScenarios??[]).filter(s=>s.orgId===orgId);
    return json(res,200,{orgId,items,total:items.length});
  }
  if(is('/strategy/scenarios')&&method==='POST'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const b=await readBody(req);
    const orgId=b.orgId||stOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    let d=b;
    if(b.archetypeId&&!b.selfStrats){ const a=stArchetype(b.archetypeId);
      if(!a) return json(res,400,{message:'قالب کلاسیک نامعتبر است.'});
      d={...b,kind:a.kind==='repeated'?'normal':a.kind,selfStrats:[...(a.self??[])],rivalStrats:[...(a.rival??[])],
        paySelf:(a.paySelf??[]).map(r=>[...r]),payRival:(a.payRival??[]).map(r=>[...r]),
        tree:a.tree?JSON.parse(JSON.stringify(a.tree)):undefined}; }
    const v=stValidateScenario(d);
    if(!v.ok) return json(res,400,{message:'سناریو معتبر نیست.',errors:v.errors});
    const id=`sc-${Date.now().toString(36)}-${(DB.nextId=(DB.nextId??1)+1)}`;
    const row={id,orgId,name:String(d.name??'سناریوی بدون نام').slice(0,120),kind:d.kind==='sequential'?'sequential':'normal',
      archetypeId:d.archetypeId??null,self:{name:String(d.self?.name??'خود').slice(0,80),orgId:d.self?.orgId??null},
      rival:{name:String(d.rival?.name??'رقیب').slice(0,80),orgId:d.rival?.orgId??null},
      selfStrats:(d.selfStrats??[]).map(x=>String(x).slice(0,60)),rivalStrats:(d.rivalStrats??[]).map(x=>String(x).slice(0,60)),
      paySelf:(d.paySelf??[]).map(r=>r.map(stNum)),payRival:(d.payRival??[]).map(r=>r.map(stNum)),
      tree:d.tree??null,payoffSource:d.payoffSource??'stated',source:d.source??'ui',seed:String(d.seed??id),
      createdAt:nowIso(),updatedAt:nowIso()};
    seedStrategyStore(); DB.strategyScenarios.push(row);
    await autoRunWorkflows('Strategy',row.id,'STRATEGY_SCENARIO_CREATED',{scenario:row,id:row.id,name:row.name,orgId},`strategy-created:${row.id}`);
    saveDb(); audit(req,'CREATE','StrategyScenario',row.id,'OK',{meta:{name:row.name,kind:row.kind}});
    return json(res,201,row);
  }
  const stIdRoute=match('/strategy/scenarios/:id');
  if(stIdRoute&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    const sc=stGet(stIdRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    return json(res,200,sc);
  }
  if(stIdRoute&&method==='PUT'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const sc=stGet(stIdRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const b=await readBody(req);
    const d={kind:sc.kind,selfStrats:sc.selfStrats,rivalStrats:sc.rivalStrats,paySelf:sc.paySelf,payRival:sc.payRival,tree:sc.tree,...b};
    const v=stValidateScenario(d);
    if(!v.ok) return json(res,400,{message:'سناریو معتبر نیست.',errors:v.errors});
    Object.assign(sc,{name:String(b.name??sc.name).slice(0,120),
      self:{name:String(b.self?.name??sc.self?.name??'خود').slice(0,80),orgId:b.self?.orgId??sc.self?.orgId??null},
      rival:{name:String(b.rival?.name??sc.rival?.name??'رقیب').slice(0,80),orgId:b.rival?.orgId??sc.rival?.orgId??null},
      selfStrats:d.selfStrats.map(x=>String(x).slice(0,60)),rivalStrats:d.rivalStrats.map(x=>String(x).slice(0,60)),
      paySelf:d.paySelf.map(r=>r.map(stNum)),payRival:d.payRival.map(r=>r.map(stNum)),
      tree:d.tree??null,updatedAt:nowIso()});
    delete DB.strategySims[sc.id];
    saveDb(); audit(req,'UPDATE','StrategyScenario',sc.id,'OK',{});
    return json(res,200,sc);
  }
  if(stIdRoute&&method==='DELETE'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const sc=stGet(stIdRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    DB.strategyScenarios=DB.strategyScenarios.filter(x=>x.id!==sc.id);
    delete DB.strategySims[sc.id];
    saveDb(); audit(req,'DELETE','StrategyScenario',sc.id,'OK',{});
    return json(res,200,{removed:true});
  }
  const stAnRoute=match('/strategy/scenarios/:id/analysis');
  if(stAnRoute&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    const sc=stGet(stAnRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    return json(res,200,{scenarioId:sc.id,generatedAt:nowIso(),...stAnalysis(sc)});
  }
  const stSimRoute=match('/strategy/scenarios/:id/simulate');
  if(stSimRoute&&method==='POST'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const sc=stGet(stSimRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    if(sc.kind!=='normal') return json(res,400,{message:'شبیه‌سازی تکراری فقط برای سناریوی ماتریسی است؛ سناریوی ترتیبی با استقرای پسرو حل می‌شود.'});
    const b=await readBody(req);
    const rules={self:ST_RULES_FA[b.selfRule]?b.selfRule:'TFT',rival:ST_RULES_FA[b.rivalRule]?b.rivalRule:'TFT'};
    const out=stSimulate(sc.paySelf,sc.payRival,sc.selfStrats.length,sc.rivalStrats.length,{rounds:b.rounds,delta:b.delta,selfRule:rules.self,rivalRule:rules.rival,seed:b.seed??sc.id});
    out.scenarioId=sc.id; out.selfStrats=sc.selfStrats; out.rivalStrats=sc.rivalStrats;
    seedStrategyStore(); DB.strategySims[sc.id]=out;
    await autoRunWorkflows('Strategy',sc.id,'STRATEGY_SIMULATED',{scenarioId:sc.id,name:sc.name,rounds:out.rounds,totals:out.totals},`strategy-sim:${sc.id}:${out.rounds}:${rules.self}:${rules.rival}`);
    saveDb(); audit(req,'SIMULATE','StrategyScenario',sc.id,'OK',{meta:{rounds:out.rounds}});
    return json(res,200,out);
  }
  const stPrRoute=match('/strategy/scenarios/:id/predict');
  if(stPrRoute&&method==='POST'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const sc=stGet(stPrRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    if(sc.kind!=='normal') return json(res,400,{message:'پیش‌بینی فقط برای سناریوی ماتریسی است.'});
    const b=await readBody(req);
    const hist=Array.isArray(b.history)&&b.history.length?b.history:(DB.strategySims[sc.id]?.history??[]);
    const pred=stPredict(sc.paySelf,sc.payRival,hist);
    if(!pred.ok) return json(res,400,{message:pred.reason});
    const out={scenarioId:sc.id,generatedAt:nowIso(),predictedLabel:sc.rivalStrats[pred.predicted],recommendLabel:sc.selfStrats[pred.recommend],
      rivalStrats:sc.rivalStrats,selfStrats:sc.selfStrats,...pred};
    await autoRunWorkflows('Strategy',sc.id,'STRATEGY_PREDICTED',{scenarioId:sc.id,name:sc.name,predicted:out.predictedLabel,recommend:out.recommendLabel},`strategy-pred:${sc.id}:${Date.now()}`);
    saveDb(); audit(req,'PREDICT','StrategyScenario',sc.id,'OK',{});
    return json(res,200,out);
  }
  if(is('/strategy/imports/template')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    const fmt=q.get('format')==='csv'?'csv':'json',kind=q.get('kind')==='rounds'?'rounds':'matrix';
    if(fmt==='csv'&&kind==='matrix'){
      const csv='strategy_self,strategy_rival,pay_self,pay_rival\nتثبیت قیمت,تثبیت قیمت,3,3\nتثبیت قیمت,شکست قیمت,0,5\nشکست قیمت,تثبیت قیمت,5,0\nشکست قیمت,شکست قیمت,1,1\n';
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="strategy-matrix-template.csv"'});
      return res.end('﻿'+csv);
    }
    if(fmt==='csv'){
      const csv='round,self,rival,paySelf,payRival\n1,تثبیت قیمت,تثبیت قیمت,3,3\n2,تثبیت قیمت,شکست قیمت,0,5\n3,شکست قیمت,تثبیت قیمت,5,0\n4,شکست قیمت,شکست قیمت,1,1\n';
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="strategy-rounds-template.csv"'});
      return res.end('﻿'+csv);
    }
    const tpl={version:1,players:[{key:'self',name:'هلدینگ آریا'},{key:'rival',name:'شرکت پترو صنعت'}],
      strategies:{self:['تثبیت قیمت','شکست قیمت'],rival:['تثبیت قیمت','شکست قیمت']},
      payoffs:{self:[[3,0],[5,1]],rival:[[3,5],[0,1]]},meta:{source:'template',note:'مثال معمای زندانی با برچسب قیمتی'}};
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="strategy-template.json"'});
    return res.end(JSON.stringify(tpl,null,2));
  }
  if(is('/strategy/imports/validate')&&method==='POST'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const b=await readBody(req);
    return json(res,200,stValidateImport(b.format,b.payload,b.kind??'matrix'));
  }
  if(is('/strategy/imports')&&method==='POST'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const b=await readBody(req);
    const orgId=b.orgId||stOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const v=stValidateImport(b.format,b.payload,b.kind??'matrix');
    if(!v.ok) return json(res,400,{message:'دادهٔ واردشده معتبر نیست.',errors:v.errors,warnings:v.warnings});
    const id=`sc-${Date.now().toString(36)}-${(DB.nextId=(DB.nextId??1)+1)}`;
    const row={id,orgId,name:String(b.name??'سناریوی واردشده').slice(0,120),kind:'normal',archetypeId:null,
      ...v.scenario,source:'import',seed:id,createdAt:nowIso(),updatedAt:nowIso()};
    delete row.importRounds;
    seedStrategyStore(); DB.strategyScenarios.push(row);
    DB.strategyImports.unshift({id:`imp-${id}`,format:b.format,kind:b.kind??'matrix',name:row.name,scenarioId:id,
      warnings:v.warnings??[],createdAt:nowIso(),by:currentUser(req)?.email??null});
    if(DB.strategyImports.length>50) DB.strategyImports.length=50;
    await autoRunWorkflows('Strategy',row.id,'STRATEGY_IMPORT_COMPLETED',{scenarioId:id,name:row.name,format:b.format},`strategy-imp:${id}`);
    saveDb(); audit(req,'IMPORT','StrategyScenario',id,'OK',{meta:{format:b.format}});
    return json(res,201,{scenario:row,warnings:v.warnings??[]});
  }
  if(is('/strategy/imports')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    seedStrategyStore();
    return json(res,200,{items:DB.strategyImports??[],total:(DB.strategyImports??[]).length});
  }
  const stBriefRoute=match('/strategy/brief/:id');
  if(stBriefRoute&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    const sc=stGet(stBriefRoute[0]);
    if(!sc) return json(res,404,{message:'سناریو یافت نشد.'});
    if(!inScope(req,sc.orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const sim=DB.strategySims[sc.id]??null;
    let pred=null;
    if(sc.kind==='normal'&&sim?.history?.length) pred=stPredict(sc.paySelf,sc.payRival,sim.history);
    const an=stAnalysis(sc); if(pred?.ok) an.prediction=pred;
    return json(res,200,{scenarioId:sc.id,generatedAt:nowIso(),lines:stBrief(sc,an,sim)});
  }
  if(is('/strategy/export')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    const orgId=stOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const sid=q.get('scenarioId');
    const list=sid?(DB.strategyScenarios??[]).filter(s=>s.id===sid&&s.orgId===orgId):(DB.strategyScenarios??[]).filter(s=>s.orgId===orgId);
    if(sid&&!list.length) return json(res,404,{message:'سناریو یافت نشد.'});
    const fmt=q.get('format')==='csv'?'csv':q.get('format')==='xls'?'xls':'json';
    if(fmt==='csv'){
      const esc=(v)=>`"${String(v??'').replace(/"/g,'""')}"`;
      const lines=['scenario,self,rival,strategy_self,strategy_rival,pay_self,pay_rival'];
      for(const s of list){ if(s.kind!=='normal') continue;
        s.selfStrats.forEach((a,i)=>s.rivalStrats.forEach((bb,j)=>lines.push([s.name,s.self?.name,s.rival?.name,a,bb,s.paySelf[i][j],s.payRival[i][j]].map(esc).join(',')))); }
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="strategy-${orgId}.csv"`});
      return res.end('﻿'+lines.join('\n'));
    }
    if(fmt==='xls'){
      const hesc=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const tr=(cells)=>`<tr>${cells.map(c=>`<td>${hesc(c)}</td>`).join('')}</tr>`;
      let tables='';
      for(const s of list){ tables+=`<h3>${hesc(s.name)}</h3>`;
        if(s.kind==='normal'){ const head=['خود \\ رقیب',...s.rivalStrats];
          tables+=`<table border="1"><thead>${tr(head)}</thead><tbody>${s.selfStrats.map((a,i)=>tr([a,...s.rivalStrats.map((bb,j)=>`${s.paySelf[i][j]}، ${s.payRival[i][j]}`)])).join('')}</tbody></table>`; }
        else tables+=`<p>سناریوی ترتیبی: ${(stAnalysis(s).spe?.spePath??[]).join(' ← ')}</p>`; }
      const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>تحلیل راهبردی</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tables}</body></html>`;
      res.writeHead(200,{'Content-Type':'application/vnd.ms-excel; charset=utf-8','Content-Disposition':`attachment; filename="strategy-${orgId}.xls"`});
      return res.end(html);
    }
    DB.exportLog=(DB.exportLog??[]);
    return json(res,200,{orgId,generatedAt:nowIso(),total:list.length,items:list.map(s=>({...s,analysis:stAnalysis(s),sim:DB.strategySims[s.id]??null}))});
  }
  if(is('/strategy/orgs/suggest')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    const oid=q.get('orgId');
    if(oid){ const s=stOrgSuggest(oid); if(!s) return json(res,404,{message:'سازمان یافت نشد.'}); return json(res,200,s); }
    const vis=visibleOrgIds(req);
    return json(res,200,{items:vis.map(stOrgSuggest).filter(Boolean)});
  }
  /* ---------- STRATEGY: اتصال به پلتفرم دیگر ---------- */
  if(is('/strategy/connections')&&method==='GET'){
    if(!hasPerm('strategy.read')) return json(res,403,{message:'شما مجوز «مشاهده تحلیل راهبردی» (strategy.read) را ندارید.'});
    seedStrategyStore();
    return json(res,200,{items:DB.strategyConnections??[],total:(DB.strategyConnections??[]).length});
  }
  if(is('/strategy/connections')&&method==='POST'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    const b=await readBody(req);
    const name=String(b.name??'').trim(),url=String(b.url??'').trim(),path=String(b.path??'').trim();
    if(!name) return json(res,400,{message:'نام اتصال لازم است.'});
    if(!/^https?:\/\/.+|^data:.+/.test(url)) return json(res,400,{message:'نشانی باید با http(s) شروع شود یا نشانی‌داده (data:) باشد.'});
    const row={id:`conn-${Date.now().toString(36)}-${(DB.nextId=(DB.nextId??1)+1)}`,name:name.slice(0,80),url:url.slice(0,500),
      path:path.slice(0,200),lastStatus:null,lastAt:null,createdAt:nowIso()};
    seedStrategyStore(); DB.strategyConnections.push(row);
    saveDb(); audit(req,'CREATE','StrategyConnection',row.id,'OK',{meta:{name}});
    return json(res,201,row);
  }
  const stConnRoute=match('/strategy/connections/:id');
  if(stConnRoute&&method==='PUT'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    seedStrategyStore();
    const row=(DB.strategyConnections??[]).find(x=>x.id===stConnRoute[0]);
    if(!row) return json(res,404,{message:'اتصال یافت نشد.'});
    const b=await readBody(req);
    if(b.name!==undefined) row.name=String(b.name).slice(0,80);
    if(b.url!==undefined){ const u=String(b.url).trim(); if(!/^https?:\/\/.+|^data:.+/.test(u)) return json(res,400,{message:'نشانی معتبر نیست.'}); row.url=u.slice(0,500); }
    if(b.path!==undefined) row.path=String(b.path).slice(0,200);
    if(b.lastStatus!==undefined) row.lastStatus=b.lastStatus;
    if(b.lastAt!==undefined) row.lastAt=b.lastAt;
    saveDb(); audit(req,'UPDATE','StrategyConnection',row.id,'OK',{});
    return json(res,200,row);
  }
  if(stConnRoute&&method==='DELETE'){
    if(!hasPerm('strategy.write')) return json(res,403,{message:'شما مجوز «مدیریت تحلیل راهبردی» (strategy.write) را ندارید.'});
    seedStrategyStore();
    if(!(DB.strategyConnections??[]).some(x=>x.id===stConnRoute[0])) return json(res,404,{message:'اتصال یافت نشد.'});
    DB.strategyConnections=DB.strategyConnections.filter(x=>x.id!==stConnRoute[0]);
    saveDb(); audit(req,'DELETE','StrategyConnection',stConnRoute[0],'OK',{});
    return json(res,200,{removed:true});
  }
  if(is('/publics/export')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const orgId=pubHomeOrg();
    if(!orgId) return json(res,400,{message:'سازمان مشخص نشده است.'});
    if(!inScope(req,orgId)) return json(res,403,{message:'سازمان خارج از محدودهٔ دسترسی شماست.'});
    const rows=(DB.publicsMembers??[]).filter(m=>m.orgId===orgId).map(pubMemberView);
    const srcFa={organization:'سازمان',person:'شخص',relationship:'رابطه',media:'رسانه'};
    const fmt=q.get('format')==='csv'?'csv':q.get('format')==='xls'?'xls':'json';
    if(fmt==='csv'){
      const head=['شناسه','گروه','دسته','پیوند','مرحله','موضع','قدرت','علاقه','نوع منبع','منبع','یادداشت','ارزیابی‌شده در','سررسید بازبینی'];
      const esc=(v)=>`"${String(v??'').replace(/"/g,'""')}"`;
      const csv=[head.join(','),...rows.map(r=>[r.id,r.groupFa,r.categoryFa,r.linkageFa,r.stageFa,r.stanceFa,r.power,r.interest,(srcFa[r.sourceType]??r.sourceType),r.sourceName,r.note,r.assessedAt,r.reviewDue].map(esc).join(','))].join('\n');
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="publics-${orgId}.csv"`});
      return res.end('\ufeff'+csv);
    }
    if(fmt==='xls'){
      /* Excel-compatible HTML table (RTL) — بدون وابستگی خارجی */
      const hesc=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const tr=(cells)=>`<tr>${cells.map(c=>`<td>${hesc(c)}</td>`).join('')}</tr>`;
      const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>نقشهٔ عموم‌ها</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1"><thead>${tr(head)}</thead><tbody>${rows.map(r=>tr([r.id,r.groupFa,r.categoryFa,r.linkageFa,r.stageFa,r.stanceFa,r.power,r.interest,(srcFa[r.sourceType]??r.sourceType),r.sourceName,r.note,r.assessedAt,r.reviewDue])).join('')}</tbody></table></body></html>`;
      res.writeHead(200,{'Content-Type':'application/vnd.ms-excel; charset=utf-8','Content-Disposition':`attachment; filename="publics-${orgId}.xls"`});
      return res.end(html);
    }
    DB.exportLog=(DB.exportLog??[]); // keep consistency with other exports
    return json(res,200,{orgId,generatedAt:nowIso(),total:rows.length,items:rows});
  }
  if(is('/publics/media')&&method==='GET'){
    if(!hasPerm('publics.read')) return json(res,403,{message:'شما مجوز «مشاهده عموم‌ها» (publics.read) را ندارید.'});
    const rows=(DB.mediaStore??[]).slice().sort((a,b)=>String(a.createdAt??'').localeCompare(String(b.createdAt??'')));
    return json(res,200,{items:rows,total:rows.length});
  }
  if(is('/publics/media')&&method==='POST'){
    if(!hasPerm('publics.write')) return json(res,403,{message:'شما مجوز «مدیریت عموم‌ها» (publics.write) را ندارید.'});
    const b=await readBody(req);
    const name=String(b.name??'').trim();
    if(!name) return json(res,400,{message:'نام رسانه لازم است.'});
    const row={id:`m-${Date.now()}`,name,type:String(b.type??'TECH_MEDIA'),url:String(b.url??'').trim()||null,
      audience:String(b.audience??'').trim()||null,country:String(b.country??'').trim()||null,
      note:String(b.note??'').trim()||null,createdAt:nowIso()};
    DB.mediaStore.push(row);
    await autoRunWorkflows('Media',row.id,'MEDIA_CREATED',{media:row,id:row.id,name:row.name,type:row.type},`media-created:${row.id}`);
    saveDb(); audit(req,'CREATE','Media',row.id,'OK',{meta:{name:row.name,type:row.type}});
    return json(res,201,row);
  }

  json(res,404,{message:`مسیر ${method} ${path} در Mock API وجود ندارد.`});
  } catch(e){ try { if(!res.headersSent) json(res,500,{message:'خطای داخلی سرور: '+String(e?.message??e)}); else res.end(); } catch {} }
});

loadDb();
USERS = DB.users;

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`[mock-api] SRIP deterministic mock API listening on http://0.0.0.0:${PORT}${V1}`);
  console.log(`[mock-api] persistence: ${DB_FILE}${process.argv.includes('--reset')?' (RESET — reseeded)':''}`);
  console.log('[mock-api] OWNER  demo / 123456  (demo@srip.local — همه محدوده)');
  console.log('[mock-api] CLIENT client / 123456  (client@arya-tech.ir — فقط آریا فناوری)');
});
