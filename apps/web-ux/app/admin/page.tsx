'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,AdminNav} from '../_components/page-ui';
import {
  Users, KeyRound, Tags, ListChecks, Scale, ShieldCheck, Share2, Workflow,
  History, Flag, Database, Download, Fingerprint, Boxes, Gauge,
  Sparkles, Lock, Landmark, FileHeart, Activity, Eye, HeartPulse, SlidersHorizontal,
  Bell, Building2, Clock3, CheckCircle2,
} from 'lucide-react';

const GROUPS: Array<{ title: string; desc: string; items: Array<[string, string, string, React.ReactNode]> }> = [
  {
    title: 'کاربران، نقش‌ها و مجوزها', desc: 'هویت و سطح دسترسی تیم',
    items: [
      ['/admin/users', 'کاربران', 'فعال‌سازی، نقش و محدوده', <Users size={17} key="u"/>],
      ['/admin/roles', 'نقش‌ها', 'مجموعه‌های نقشی آماده', <KeyRound size={17} key="r"/>],
      ['/admin/permissions', 'مجوزها', 'ماتریس دسترسی دقیق', <ShieldCheck size={17} key="p"/>],
      ['/admin/scoring', 'قواعد امتیازدهی', 'وزن‌های محاسبهٔ ارتباط', <Scale size={17} key="s"/>],
      ['/admin/tags', 'برچسب‌ها', 'برچسب‌های سازمان و شخص', <Tags size={17} key="t"/>],
      ['/admin/custom-fields', 'فیلدهای سفارشی', 'فیلدهای اختصاصی شما', <ListChecks size={17} key="c"/>],
      ['/admin/criteria', 'معیارهای ارزیابی', 'معیارهای تصمیم', <SlidersHorizontal size={17} key="cr"/>],
      ['/admin/notification-rules', 'قواعد اعلان', 'زمان و شیوهٔ اطلاع‌رسانی', <Bell size={17} key="n"/>],
      ['/admin/audit', 'ممیزی', 'ردیابی تغییرات', <History size={17} key="a"/>],
    ],
  },
  {
    title: 'امنیت و حاکمیت', desc: 'کنترل‌ها، خط‌مشی‌ها و چرخهٔ حیات',
    items: [
      ['/security', 'امنیت', 'رویدادها و بررسی مقدماتی', <Lock size={17} key="sec"/>],
      ['/security-events', 'رویدادهای امنیتی', 'گزارش وقایع', <Activity size={17} key="ev"/>],
      ['/governance', 'حاکمیت', 'خط‌مشی و پایبندی', <Landmark size={17} key="g"/>],
      ['/enterprise', 'حاکمیت سازمانی', 'تنظیمات سازمان', <Building2 size={17} key="e"/>],
      ['/privacy', 'حریم خصوصی', 'حریم داده‌ها', <FileHeart size={17} key="pr"/>],
      ['/data-lifecycle', 'چرخهٔ حیات داده', 'نگهداری و انقضا', <Database size={17} key="dl"/>],
      ['/admin/retention', 'نگهداری داده', 'سیاست‌های نگهداری', <Clock3 size={17} key="ret"/>],
      ['/admin/exports', 'کنترل خروجی داده', 'گزارش و خروجی', <Download size={17} key="exp"/>],
    ],
  },
  {
    title: 'یکپارچه‌سازی و داده', desc: 'ورود، کیفیت و اتصال سامانه‌ها',
    items: [
      ['/data-management', 'مدیریت داده', 'کیفیت و حاکمیت داده', <Database size={17} key="dm"/>],
      ['/data-quality', 'کیفیت داده', 'نقص‌ها و پوشش', <Gauge size={17} key="dq"/>],
      ['/data-management/import', 'وارد کردن داده', 'ورود گروهی', <Download size={17} key="imp"/>],
      ['/admin/master-data', 'دادهٔ مبنایی', 'داده‌های مرجع', <Boxes size={17} key="md"/>],
      ['/integrations', 'یکپارچه‌سازی', 'اتصال سامانه‌ها', <Share2 size={17} key="int"/>],
      ['/workflows', 'گردش کار', 'زنجیره‌های خودکار', <Workflow size={17} key="wf"/>],
      ['/approvals', 'تأییدها', 'تأیید دونفره', <CheckCircle2 size={17} key="ap"/>],
    ],
  },
  {
    title: 'پایش و سلامت', desc: 'سلامت سامانه و رفتار محصول',
    items: [
      ['/monitoring', 'مرکز پایش', 'سنجه‌ها، سلامت و مشاهده‌پذیری', <HeartPulse size={17} key="mon"/>],
      ['/analytics', 'تحلیل محصول', 'استفاده و پذیرش', <Sparkles size={17} key="an"/>],
      ['/metrics', 'سنجه‌ها', 'شاخص‌های فنی', <Gauge size={17} key="m"/>],
      ['/observability', 'مشاهده‌پذیری', 'نشانه‌های سامانه', <Eye size={17} key="ob"/>],
      ['/health', 'سلامت زمان اجرا', 'وضعیت سرویس‌ها', <Activity size={17} key="h"/>],
    ],
  },
  {
    title: 'گسترش و ابزارها', desc: 'کنترل‌های فنی پلتفرم',
    items: [
      ['/admin/feature-flags', 'پرچم‌های ویژگی', 'گسترش کنترل‌شده', <Flag size={17} key="f"/>],
      ['/admin/sessions', 'مدیریت نشست‌ها', 'ورودهای فعال', <Fingerprint size={17} key="s"/>],
    ],
  },
];

export default function Admin(){
  const [d,setD]=useState<any>(null),[e,setE]=useState('');
  useEffect(()=>{api('/admin/overview').then(setD).catch(x=>setE(x.message))},[]);
  const cards=[['users','کاربران'],['organizations','سازمان‌ها'],['roles','نقش‌ها'],['permissions','مجوزها'],['tags','برچسب‌ها'],['customFields','فیلدهای سفارشی'],['workflows','گردش کارها'],['integrations','یکپارچه‌سازی‌ها'],['notificationRules','قواعد اعلان']];
  return <main className="admin-layout">
    <PageHeader eyebrow="مدیریت سازمانی" title="مرکز سیستم" description="همهٔ بخش‌های مدیریتی، امنیتی، داده و پایش — در یک مکان. بدون رفت‌وبرگشت در منوها."/>
    <AdminNav/>
    <ErrorCard message={e}/>
    {!d&&!e?<Loading/>:<>
      <section className="stat-row">{cards.map(([k,l])=><div className="stat-box" key={k}><span>{l}</span><strong>{Array.isArray(d?.[k])?d[k].length:d?.[k]??'—'}</strong></div>)}</section>
      <div className="dashboard-grid">
        {GROUPS.map(g=>(
          <article className="panel" key={g.title}>
            <h2>{g.title}</h2>
            <p className="muted" style={{margin:'4px 0 12px'}}>{g.desc}</p>
            <div className="priority-list">
              {g.items.map(([href,label,note,icon])=>(
                <Link href={href} key={href}><b>{icon} {label}</b><span>{note}</span></Link>
              ))}
            </div>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>میان‌برهای روزمره</h2>
        <p className="muted">کارهای تیم — بدون اینکه وارد سیستم شوند، از همین‌جا در دسترس‌اند.</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          <Link className="secondary-action" href="/workflows">گردش کار و تأییدها</Link>
          <Link className="secondary-action" href="/integrations">یکپارچه‌سازی</Link>
          <Link className="secondary-action" href="/monitoring">مرکز پایش</Link>
          <Link className="secondary-action" href="/data-quality">کیفیت داده</Link>
        </div>
      </section>
    </>}
  </main>;
}
