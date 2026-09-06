'use client';
import Link from 'next/link';
import HubTabs from '../_components/hub-tabs';
import {useEffect,useState} from 'react';import{api}from'../_lib/api';import{DataTable,ErrorCard,PageHeader}from'../_components/page-ui';
export default function DataManagement(){const[q,setQ]=useState<any>(null),[e,setE]=useState('');useEffect(()=>{api<any>('/data/quality').then(setQ).catch(x=>setE(x.message))},[]);const m=q?.metrics??q??{};const dups=Array.isArray(m.duplicateOrganizations)?m.duplicateOrganizations.length:m.duplicateOrganizations?.length??0;const num=(v:any)=>typeof v==='number'?v:typeof v==='object'&&v&&typeof v.total==='number'?v.total:0;
const ENTITY_FA: Record<string,string> = { Organization:'سازمان', Person:'شخص', Relationship:'رابطه', Interaction:'تعامل', Meeting:'جلسه', Action:'اقدام', Project:'پروژه', Opportunity:'فرصت', Document:'سند', User:'کاربر', Organizations:'سازمان‌ها', People:'اشخاص', Relationships:'روابط', Interactions:'تعامل‌ها', Meetings:'جلسات', Actions:'اقدام‌ها' };
const idFa = (v:any): string => { const raw=String(v??''); const m=raw.match(/^([a-z]+)[-:](\d+)$/i); if(!m) return raw; const l:Record<string,string>={org:'سازمان',p:'شخص',o:'فرصت',pr:'پروژه',r:'رابطه',m:'جلسه',i:'تعامل',a:'اقدام',c:'تعهد',u:'کاربر'}; return `${l[m[1].toLowerCase()] ?? m[1]} ${new Intl.NumberFormat('fa-IR').format(Number(m[2]))}`; };const cards:[string,string,number][]=[['duplicates','نامزدهای تکراری',dups],['missingOwners','بدون مالک',num(m.missingOwners)],['staleRelationships','رابطه‌های کهنه',num(m.staleRelationships)],['invalidEmails','ایمیل‌های نامعتبر',num(m.invalidEmails)],['incomplete','پروفایل‌های ناقص',num(m.incompleteProfiles?.organizations)+num(m.incompleteProfiles?.people)]];const issues=[...(Array.isArray(m.missingOwners?.values)?m.missingOwners.values.map((id:any)=>({kind:'بدون مالک',id})):[]),...(Array.isArray(m.staleRelationships?.values)?m.staleRelationships.values.map((r:any)=>({kind:'رابطهٔ کهنه',id:r.id})):[]),...(Array.isArray(m.invalidEmails?.values)?m.invalidEmails.values.map((v:any)=>({kind:'ایمیل نامعتبر',entity: v.entityType,id:v.id})):[])];return <main className="admin-layout"><PageHeader eyebrow="حاکمیت داده" title="مدیریت داده" description="مرکز داده: کیفیت، ورود گروهی، دادهٔ مبنایی و تبادل با سامانه‌های دیگر تحت یک فضای کاری." actions={<Link className="primary-action" href="/data-management/import">+ ورود داده</Link>}/><HubTabs base tabs={[
        {href:'/data-management',label:'نمای کلی'},
        {href:'/data-quality',label:'کیفیت داده'},
        {href:'/data-management/import',label:'ورود داده'},
        {href:'/admin/master-data',label:'دادهٔ مبنایی'},
        {href:'/data-exchange',label:'تبادل داده'},
      ]}/>
      <ErrorCard message={e}/>{!q?null:<>
<section className="stat-row">{cards.map(([k,l,v])=><div className="stat-box" key={k}><span>{l}</span><strong>{v}</strong></div>)}</section>
<section className="split-panels">
<article className="panel executive-card"><h2>مشکلات</h2>{issues.length===0?<p className="muted">هیچ مورد کیفیتی یافت نشد.</p>:<DataTable columns={[{key:'kind',label:'نوع'},{key:'id',label:'شناسه'},{key:'entity',label:'موجودیت'}]} rows={issues.map((x:any)=>({...x,id:idFa(x.id),entity:ENTITY_FA[x.entity] ?? ENTITY_FA[String(x.entity).charAt(0).toUpperCase()+String(x.entity).slice(1)] ?? x.entity}))}/>}</article>
<article className="panel executive-card"><h2>حاکمیت</h2><p className="muted">طبقه‌بندی، نگهداشت، کنترل خروجی و حریم خصوصی از سمت سرویس اعمال می‌شوند.</p><Link className="secondary-action" href="/privacy">حریم خصوصی</Link></article>
</section>
<section className="panel"><h2>پوشش</h2><div className="metric-list">{(Object.entries(m.coverage??{})).map(([k,v])=><div key={k}><span>{ENTITY_FA[k] ?? ENTITY_FA[String(k).charAt(0).toUpperCase()+String(k).slice(1)] ?? k}</span><strong>{String(v)}</strong></div>)}</div></section>
</>}</main>}