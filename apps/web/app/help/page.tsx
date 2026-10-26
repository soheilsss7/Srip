'use client';
import Link from 'next/link';
import {
  BookOpen, Crown, Building2, Share2, Network, CalendarDays, Sparkles, BrainCircuit,
  Download, Upload, ShieldCheck, Search, HelpCircle, MessageCircleQuestion, KeyRound, LayoutDashboard,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: <KeyRound size={16} />, title: 'ورود و نقش‌ها', id: 'login',
    body: 'دو نقش در پلتفرم تعریف شده است: «مالک» (همهٔ محدوده‌ها) و «مستأجر» — سازمان یا شخصی که پلتفرم را تحویل گرفته و فقط محدودهٔ سازمان خودش را می‌بیند. برای ورود، از صفحهٔ ورود با نام کاربری و رمز عبور (و کد ۶ رقمی تأیید دومرحله‌ای) استفاده کنید.',
  },
  {
    icon: <LayoutDashboard size={16} />, title: 'داشبورد', id: 'dashboard',
    body: 'نمای کلی سلامت شبکه: شمارندهٔ سازمان‌ها، اشخاص، روابط و جلسات، شاخص سرمایهٔ ارتباطی، و بخش «پیشنهاد ارتباط جدید» که موتور هوشمند بر اساس تعاملات و نتایج جلسات می‌سازد.',
  },
  {
    icon: <Building2 size={16} />, title: 'سازمان‌ها و اشخاص', id: 'entities',
    body: 'در «سازمان‌ها» و «اشخاص» هر موجودیت را می‌توان افزود، جستجو و باز کرد. با کلیک روی هر سازمان یا شخص، پروفایل آن با گراف اختصاصی ارتباطاتش، اعضا، واحدها، تماس‌ها و خط زمانی باز می‌شود.',
  },
  {
    icon: <Network size={16} />, title: 'شبکه اطلاعاتی', id: 'network',
    body: 'گراف تعاملی کل روابط. با تب‌های «همه / شرکت‌ها / اشخاص / پروژه‌ها» می‌توان هر دسته را جداگانه دید؛ هر دسته گراف مخصوص خودش را دارد. روی هر گره کلیک کنید تا پروفایل دقیق همان موجودیت باز شود.',
  },
  {
    icon: <Share2 size={16} />, title: 'روابط', id: 'relationships',
    body: 'هر رابطه بین دو سازمان با وضعیت (فعال، در خطر، …)، سلامت، ریسک و ارزش راهبردی ثبت می‌شود. از صفحهٔ رابطه می‌توان امتیاز را محاسبهٔ مجدد کرد، وضعیت/مرحلهٔ چرخهٔ زندگی را تغییر داد و جلسات و تعاملات مرتبط را دید.',
  },
  {
    icon: <CalendarDays size={16} />, title: 'جلسات و تقویم', id: 'meetings',
    body: 'جلسات را با هدف، دستور جلسه و شرکت‌کنندگان ثبت کنید. بعد از هر جلسه «نتیجه» را ثبت کنید — نتیجهٔ جلسات مستقیماً به پیشنهادهای هوشمند بعدی غذا می‌دهد. تقویم جلالی، نمای ماهانه با امکان پرش به هر روز را دارد.',
  },
  {
    icon: <Sparkles size={16} />, title: 'پیشنهادهای هوشمند', id: 'recommendations',
    body: 'موتور داخلی (کاملاً قطعی — بدون مدل خارجی) بر اساس روابط، تعاملات و نتایج جلسات، پیشنهادهای عملی می‌سازد: پیگیری رابطه، کاهش ریسک، جلسهٔ راهبردی، بهره‌برداری از فرصت. هر پیشنهاد دارای شواهد، درصد اطمینان و دلیل است و قبل از اجرا باید تأیید شود.',
  },
  {
    icon: <BrainCircuit size={16} />, title: 'هوش مصنوعی', id: 'ai',
    body: 'دستیار داخلی با ۹ قابلیت: جستجوی هوشمند، آمادگی جلسه، خلاصه‌سازی، استخراج اقدام و تعهد، تشخیص ریسک و فرصت، و «بهترین اقدام بعدی». همهٔ پاسخ‌ها از موتور قطعی می‌آیند و در محیط دمو هیچ LLM خارجی فراخوانی نمی‌شود.',
  },
  {
    icon: <Download size={16} />, title: 'خروجی و ورودی داده', id: 'exchange',
    body: 'صفحهٔ «تبادل داده» به شما امکان می‌دهد فهرست سازمان‌ها، اشخاص، روابط، جلسات، تعاملات و … را به صورت سازگار با Excel (CSV با پشتیبانی فارسی) دانلود کنید و اشخاص را از فایل CSV (با قالب آماده) به‌صورت گروهی وارد کنید.',
  },
  {
    icon: <Search size={16} />, title: 'جستجوی سراسری', id: 'search',
    body: 'از نوار جستجوی بالای صفحه (میان‌بر ⌘K) همه‌چیز را پیدا کنید: سازمان‌ها، اشخاص، روابط، جلسات، تعاملات، پروژه‌ها و فرصت‌ها — همیشه در محدودهٔ دسترسی شما.',
  },
  {
    icon: <ShieldCheck size={16} />, title: 'امنیت و محدوده', id: 'security',
    body: 'همهٔ درخواست‌ها با JWT امضاشده احراز هویت می‌شوند و هر پاسخ بر اساس محدودهٔ سازمانی شما فیلتر می‌شود؛ دسترسی به داده‌های خارج از محدوده با خطای ۴۰۳ رد می‌شود. رمز عبور با الگوریتم scrypt ذخیره می‌شود و لاگ ممیزی کامل از فعالیت‌ها نگهداری می‌شود.',
  },
];

const FAQS = [
  { q: 'مستأجر چه چیزهایی را می‌بیند؟', a: 'فقط سازمان خودش: اعضا، روابطِ آن سازمان (با طرف‌های مقابل)، جلسات، تعاملات، اقدامات، تعهدات، پروژه‌ها و فرصت‌های همان محدوده. بقیهٔ داده‌ها ۴۰۳ است.' },
  { q: 'پیشنهادها از کجا می‌آیند؟', a: 'از موتور قطعی داخلی: ارتباطات مشترک، تعاملات اخیر بدون رابطهٔ رسمی، هم‌صنعت‌بودن و کیفیت همسایه‌ها. هیچ وابستگی به LLM خارجی نیست.' },
  { q: 'چطور رابطهٔ جدید پیشنهاد می‌شود؟', a: 'در داشبورد، صفحهٔ پیشنهادها و پروفایل هر سازمان/شخص، بخش «پیشنهاد ارتباط جدید» با امتیاز و دلیل فارسی نمایش داده می‌شود.' },
  { q: 'داده‌ها بعد از ریستارت سرور می‌ماند؟', a: 'بله — در محیط دمو، داده‌ها روی دیسک ذخیره می‌شوند. برای بازنشانی کامل دمو از دستور mock:reset استفاده کنید.' },
  { q: 'چطور فایل اکسل وارد کنم؟', a: 'از «تبادل داده ← ورودی» قالب CSV را دانلود کنید، آن را پر کنید و دوباره بارگذاری کنید؛ پیش‌نمایش قبل از ثبت نشان داده می‌شود.' },
];

export default function HelpPage() {
  return (
    <main className="feature-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">SRIP Workspace · User Guide</div>
          <h1><BookOpen size={22} style={{ verticalAlign: '-4px' }}/> راهنمای کاربر</h1>
          <p className="subtitle">همه‌چیز دربارهٔ پلتفرم: نقش‌ها، بخش‌ها، قابلیت‌ها و پاسخ پرسش‌های پرتکرار — در یک نگاه.</p>
        </div>
        <div className="heading-tools">
          <span className="chip info"><MessageCircleQuestion size={12}/> به‌روزرسانی: شهریور ۱۴۰۵</span>
        </div>
      </section>

      {/* Quick start */}
      <section className="panel" id="quickstart">
        <div className="panel-title"><div><h2>شروع سریع</h2><p>در سه گام با پلتفرم کار کنید</p></div></div>
        <div className="steps-row">
          <div className="step-card"><span className="step-num">۱</span><b>ورود با نقش مناسب</b><p>مالک (همه محدوده) یا مستأجر (محدودهٔ سازمان خودتان) — از صفحهٔ ورود با دو دکمهٔ دمو.</p></div>
          <div className="step-card"><span className="step-num">۲</span><b>سازمان‌ها و اشخاص را ثبت کنید</b><p>از «+ سازمان» و «+ شخص» یا صفحهٔ تبادل داده برای ورود گروهی.</p></div>
          <div className="step-card"><span className="step-num">۳</span><b>جلسه بگذارید و نتیجه ثبت کنید</b><p>نتیجهٔ جلسات، موتور پیشنهاد هوشمند را تغذیه می‌کند — پیشنهادها را تأیید و اجرا کنید.</p></div>
        </div>
      </section>

      {/* Sections */}
      <section className="panel">
        <div className="panel-title"><div><h2>راهنمای بخش‌ها</h2><p>با کلیک روی هر عنوان به صفحهٔ مربوطه بروید</p></div></div>
        <div className="help-grid">
          {SECTIONS.map(s => (
            <article className="help-card" key={s.id}>
              <span className="stat-ico ic-indigo" style={{ width: 34, height: 34, borderRadius: 10 }}>{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="split-panels">
        <article className="panel">
          <div className="panel-title"><div><h2><Crown size={15}/> نقش مالک</h2></div></div>
          <ul className="help-list">
            <li>دسترسی کامل به همهٔ سازمان‌ها، اشخاص و روابط</li>
            <li>بخش‌های مدیریتی: کاربران، داده، امنیت، ممیزی</li>
            <li>پیشنهاد سراسری «ارتباط جدید» روی کل شبکه</li>
            <li>مشاهدهٔ لاگ ممیزی و رویدادهای امنیتی</li>
          </ul>
        </article>
        <article className="panel">
          <div className="panel-title"><div><h2><Building2 size={15}/> نقش مستأجر</h2></div></div>
          <ul className="help-list">
            <li>ورود با نام کاربری و رمز مخصوص خودش</li>
            <li>فقط محدودهٔ سازمان خودش (اعضا، روابط، جلسات، …)</li>
            <li>پیشنهاد ارتباط جدید برای شبکهٔ محدودهٔ خودش</li>
            <li>دسترسی به داده‌های خارج از محدوده → ۴۰۳</li>
          </ul>
        </article>
      </section>

      {/* FAQ */}
      <section className="panel">
        <div className="panel-title"><div><h2><HelpCircle size={15}/> پرسش‌های پرتکرار</h2></div></div>
        <div className="faq-list">
          {FAQS.map(f => (
            <details className="faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer links */}
      <section className="panel">
        <div className="help-footer">
          <Link className="btn btn-ghost" href="/network"><Network size={15}/> شبکه اطلاعاتی</Link>
          <Link className="btn btn-ghost" href="/recommendations"><Sparkles size={15}/> پیشنهادهای هوشمند</Link>
          <Link className="btn btn-ghost" href="/calendar"><CalendarDays size={15}/> تقویم جلسات</Link>
          <Link className="btn btn-ghost" href="/data-exchange"><Download size={15}/> تبادل داده</Link>
          <Link className="btn btn-ghost" href="/ai"><BrainCircuit size={15}/> دستیار هوشمند</Link>
        </div>
      </section>
    </main>
  );
}
