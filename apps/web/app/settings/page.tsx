'use client';
import {useEffect,useState} from 'react';
import {Empty,PageHeader} from '../_components/page-ui';
import {ThemeControl} from '../_components/preferences';
import {useWorkspace} from '../_components/workspace';
export default function Settings(){
 const {can}=useWorkspace();
 const allowed=can('entity.read');
 const[theme,setTheme]=useState('system'),[locale,setLocale]=useState('fa'),[timezone,setTimezone]=useState('Asia/Tehran'),[defaultCompany,setDefaultCompany]=useState('all');
 useEffect(()=>{if(!allowed)return;setTheme((localStorage.getItem('srip_theme')||'system'));setLocale(localStorage.getItem('srip_locale')||'fa');setTimezone(localStorage.getItem('srip_timezone')||'Asia/Tehran');setDefaultCompany(localStorage.getItem('srip_default_company')||'all')},[allowed]);
 function save(){if(!allowed)return;localStorage.setItem('srip_theme',theme);localStorage.setItem('srip_locale',locale);localStorage.setItem('srip_timezone',timezone);localStorage.setItem('srip_default_company',defaultCompany);document.documentElement.dataset.theme=theme as string}
 if(!allowed)return <main className="feature-page"><PageHeader eyebrow="USER SETTINGS" title="Settings" description="تنظیمات شخصی UI و ترجیحات حساب کاربری."/><section className="panel"><Empty>مجوز مشاهده تنظیمات برای شما فعال نیست.</Empty></section></main>;
 return <main className="admin-layout"><PageHeader eyebrow="USER SETTINGS" title="Settings" description="تنظیمات شخصی UI؛ تنظیمات امنیتی و Permission در Backend مرجع نهایی هستند."/><section className="form-card"><div className="form-grid"><ThemeControl/><label>زبان<select value={locale} onChange={e=>setLocale(e.target.value)}><option value="fa">فارسی</option><option value="en">English</option></select></label><label>Timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)}/></label><label>Default Company<select value={defaultCompany} onChange={e=>setDefaultCompany(e.target.value)}><option value="all">همه محدوده مجاز</option></select></label><button className="primary-action" onClick={save}>ذخیره ترجیحات</button></div></section><section className="panel executive-card"><h2>Security</h2><p className="muted">برای مدیریت Sessionها از صفحه امنیت حساب استفاده کنید.</p><a className="secondary-action" href="/sessions">Sessions & Devices</a></section></main>
}
