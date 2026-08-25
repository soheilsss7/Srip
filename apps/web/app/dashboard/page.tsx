'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { ScopeBadge, useWorkspace, ROLE_LABELS } from '../_components/workspace';

type Summary={counts:Record<string,number>; engagement?:{activeUsers30d:number;recommendationAcceptance:number;successfulConnections:number;relationshipUpdates:number}};
type Network={relationshipCount:number;peopleCount:number;opportunityCount:number;networkCapital?:{score:number};strategicRelationshipIndex?:{score:number};relationshipResilienceScore?:number;weightedOpportunityValue?:number};
type Report={rows?:Array<any>;data?:Array<any>;summary?:any};

const cards=[['relationships','روابط فعال','/relationships'],['opportunities','فرصت‌های فعال','/opportunities'],['meetings','جلسات','/meetings'],['commitments','تعهدات','/commitments'],['actions','اقدامات','/actions'],['people','اشخاص','/people'],['organizations','سازمان‌ها','/organizations'],['projects','پروژه‌ها','/projects']];
export default function Dashboard(){
 const {me,role,scopeId,can}=useWorkspace(); const [summary,setSummary]=useState<Summary|null>(null); const [network,setNetwork]=useState<Network|null>(null); const [holding,setHolding]=useState<Report|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);setError('');const q=scopeId==='all'?'':'?organizationId='+encodeURIComponent(scopeId);Promise.all([api<Summary>('/analytics/summary'),api<Network>('/analytics/network'+q),can('report.read')?api<Report>('/reports/holding'+q):Promise.resolve(null)]).then(([s,n,h])=>{if(!alive)return;setSummary(s);setNetwork(n);setHolding(h)}).catch(e=>alive&&setError((e as Error).message)).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[scopeId,can]);
 const greeting=me?.name?`سلام ${me.name}`:'سلام'; const counts=summary?.counts??{};
 return <div className="dashboard-page">
   <div className="page-heading"><div><div className="eyebrow">EXECUTIVE / GOVERNANCE WORKSPACE</div><h1>{greeting}</h1><p>نمایش مدیریتی بر اساس نقش، Permission و محدوده سازمانی فعلی.</p></div><div className="heading-tools"><ScopeBadge/><a className="primary-action" href="/organizations">+ ثبت سازمان</a><a className="secondary-action" href="/people">+ ثبت شخص</a><a className="secondary-action" href="/relationships">+ ثبت رابطه</a></div></div>
   {error&&<div className="error-card" role="alert">{error}</div>}
   <section className="strategic-banner"><div><span>نقش فعال</span><strong>{ROLE_LABELS[role]}</strong></div><div><span>محدوده</span><strong>{scopeId==='all'?'همه محدوده مجاز':scopeId}</strong></div><div><span>اصل محصول</span><strong>Relationship First · Network First</strong></div></section>
   <section className="kpi-grid" aria-label="Strategic KPIs">{cards.map(([key,label,href])=><a className="kpi-card" href={href} key={key}><span>{label}</span><strong>{loading?'—':counts[key]??0}</strong><small>مشاهده جزئیات ←</small></a>)}</section>
   <section className="dashboard-grid">
     <article className="panel executive-card"><div className="panel-title"><div><h2>Strategic Overview</h2><p>شاخص‌های تجمیعی برای محدوده انتخاب‌شده</p></div><a href="/reports">گزارش‌ها</a></div><div className="metric-list"><div><span>Network Capital</span><strong>{network?.networkCapital?.score??'—'}</strong></div><div><span>Strategic Relationship Index</span><strong>{network?.strategicRelationshipIndex?.score??'—'}</strong></div><div><span>Resilience</span><strong>{network?.relationshipResilienceScore??'—'}</strong></div><div><span>Weighted Opportunity Value</span><strong>{network?.weightedOpportunityValue!=null?network.weightedOpportunityValue.toLocaleString('en-US'):'—'}</strong></div></div></article>
     <article className="panel executive-card"><div className="panel-title"><div><h2>Holding / Company View</h2><p>مقایسه شرکت‌های در محدوده دسترسی</p></div><a href="/reports">مشاهده</a></div>{holding?.rows?.length?<div className="mini-table">{holding.rows.slice(0,6).map((r:any,i:number)=><div key={r.id??i}><span>{r.name??r.organization??r.company??'Organization'}</span><strong>{r.healthScore??r.relationshipHealth??r.score??'—'}</strong></div>)}</div>:<div className="empty-state">برای این Scope داده مقایسه‌ای در دسترس نیست.</div>}</article>
   </section>
   <section className="dashboard-grid">
     <article className="panel priorities"><div className="panel-title"><div><h2>Today's Priorities</h2><p>کارهایی که باید به اقدام تبدیل شوند</p></div></div><div className="priority-list"><a href="/actions"><b>اقدامات</b><span>{counts.actions??0} مورد</span></a><a href="/commitments"><b>تعهدات</b><span>{counts.commitments??0} مورد</span></a><a href="/meetings"><b>جلسات</b><span>{counts.meetings??0} مورد</span></a><a href="/relationships"><b>روابط</b><span>{counts.relationships??0} مورد</span></a></div></article>
     <article className="panel recommendations"><div className="panel-title"><div><h2>Intelligence</h2><p>این بخش فعلاً فقط داده‌های واقعی Backend را نمایش می‌دهد؛ AI Provider در این مرحله فعال نشده است.</p></div><a href="/intelligence">تحلیل</a></div><div className="recommendation-placeholder"><span>Relationship Health</span><strong>{network?.networkCapital?.score??'—'}</strong><small>Network Capital و SRI از API محاسبه می‌شوند.</small></div></article>
   </section>
   <section className="quick-create panel"><div><h2>ثبت سریع</h2><p>مدیر مجاز می‌تواند موجودیت‌های اصلی را مستقیماً از Workspace ایجاد کند.</p></div><div className="quick-actions"><a href="/organizations">سازمان</a><a href="/people">شخص</a><a href="/relationships">رابطه</a><a href="/meetings">جلسه</a><a href="/actions">اقدام</a><a href="/commitments">تعهد</a><a href="/projects">پروژه</a><a href="/opportunities">فرصت</a></div></section>
 </div>;
}
