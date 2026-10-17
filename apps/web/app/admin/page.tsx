'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,Badge} from '../_components/page-ui';
import {AdminNav} from '../_components/page-ui';
export default function Admin(){
 const [d,setD]=useState<any>(null),[e,setE]=useState('');
 useEffect(()=>{api('/admin/overview').then(setD).catch(x=>setE(x.message))},[]);
  const cards=[['users','کاربران'],['organizations','سازمان‌ها'],['roles','نقش‌ها'],['permissions','مجوزها'],['tags','برچسب‌ها'],['customFields','فیلدهای سفارشی'],['workflows','گردش کارها'],['integrations','یکپارچه‌سازی‌ها'],['notificationRules','قواعد اعلان']];
 return <main className="admin-layout"><PageHeader eyebrow="مدیریت سازمانی" title="مدیریت سیستم" description="مرکز مدیریت کاربران، نقش‌ها، مجوزها، داده‌های مبنایی، گردش کار، امتیازدهی، اعلان و ممیزی."/><AdminNav/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<><section className="stat-row">{cards.map(([k,l])=><div className="stat-box" key={k}><span>{l}</span><strong>{Array.isArray(d?.[k])?d[k].length:d?.[k]??'—'}</strong></div>)}</section><section className="dashboard-grid"><article className="panel"><h2>حاکمیت</h2><div className="priority-list"><Link href="/admin/users"><b>کاربران</b><span>فعال‌سازی و Scope</span></Link><Link href="/admin/roles"><b>نقش‌ها</b><span>کنترل دسترسی مبتنی بر نقش</span></Link><Link href="/admin/permissions"><b>مجوزها</b><span>ماتریس مجوزها</span></Link><Link href="/admin/audit"><b>ممیزی</b><span>ردیابی تغییرات</span></Link></div></article><article className="panel"><h2>کنترل‌های سازمانی</h2><div className="priority-list"><Link href="/governance"><b>حاکمیت</b><span>خط‌مشی / خروجی</span></Link><Link href="/privacy"><b>حریم خصوصی</b><span>حریم خصوصی / چرخهٔ حیات</span></Link><Link href="/security"><b>امنیت</b><span>رویدادها / بررسی مقدماتی</span></Link><Link href="/admin/feature-flags"><b>پرچم‌های ویژگی</b><span>گسترش کنترل‌شده</span></Link></div></article></section></>}</main>
}
