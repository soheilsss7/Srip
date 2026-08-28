'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api,clearSession,getAccessToken,getRefreshToken,apiPost,setScope,getScope } from '../_lib/api';

type Role = 'SUPER_ADMIN'|'HOLDING_ADMIN'|'HOLDING_EXECUTIVE'|'SUBSIDIARY_ADMIN'|'SUBSIDIARY_EXECUTIVE'|'RELATIONSHIP_MANAGER'|'PROJECT_MANAGER'|'ANALYST'|'STANDARD_USER'|'READ_ONLY';
type Membership = { id:string; organizationId:string; organizationName:string; role:Role; department?:string|null; dataScope:string; accessScope:string; isPrimary:boolean };
type Me = { id:string; email:string; name:string; memberships:Membership[]; permissions:string[]; accessibleOrganizationIds:string[] };

type WorkspaceContextValue = { me:Me|null; loading:boolean; error:string; scopeId:string; setScopeId:(id:string)=>void; role:Role; can:(permission:string)=>boolean; isAdmin:boolean };
const WorkspaceContext=createContext<WorkspaceContextValue|null>(null);

export const ROLE_LABELS:Record<Role,string>={SUPER_ADMIN:'مدیر کل سیستم',HOLDING_ADMIN:'مدیر هلدینگ',HOLDING_EXECUTIVE:'مدیر ارشد هلدینگ',SUBSIDIARY_ADMIN:'مدیر شرکت',SUBSIDIARY_EXECUTIVE:'مدیر ارشد شرکت',RELATIONSHIP_MANAGER:'مدیر روابط',PROJECT_MANAGER:'مدیر پروژه',ANALYST:'تحلیلگر',STANDARD_USER:'کاربر استاندارد',READ_ONLY:'فقط خواندنی'};

export function WorkspaceProvider({children}:{children:React.ReactNode}){
  const [me,setMe]=useState<Me|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [scopeId,setScopeIdState]=useState('all');
  useEffect(()=>{const stored=getScope(); if(stored) setScopeIdState(stored); const token=getAccessToken(); if(!token&&!getRefreshToken()){setLoading(false);return;} api<Me>('/auth/me').then(v=>setMe(v)).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false));},[]);
  const setScopeId=(id:string)=>{setScopeIdState(id);setScope(id)};
  const role=(me?.memberships.find(m=>m.isPrimary)?.role ?? me?.memberships[0]?.role ?? 'STANDARD_USER') as Role;
  const permissions=me?.permissions??[]; const can=(p:string)=>permissions.includes(p) || permissions.includes('*');
  const isAdmin=['SUPER_ADMIN','HOLDING_ADMIN','SUBSIDIARY_ADMIN'].includes(role);
  return <WorkspaceContext.Provider value={{me,loading,error,scopeId,setScopeId,role,can,isAdmin}}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace(){const v=useContext(WorkspaceContext); if(!v) throw new Error('useWorkspace must be used inside WorkspaceProvider'); return v;}

const baseNav: Array<readonly [string,string,string]>=[
  ['/', 'داشبورد', 'dashboard.read'],['/organizations','سازمان‌ها','organization.read'],['/people','اشخاص','person.read'],['/relationships','روابط','relationship.read'],['/network','شبکه','network.read'],['/interactions','تعاملات','interaction.read'],['/meetings','جلسات','meeting.read'],['/actions','اقدامات','action.read'],['/commitments','تعهدات','commitment.read'],['/projects','پروژه‌ها','project.read'],['/opportunities','فرصت‌ها','opportunity.read'],['/intelligence','هوشمندی','analytics.read'],['/recommendations','پیشنهادات','recommendation.read'],['/reports','گزارش‌ها','report.read'],['/knowledge','دانش','document.read'],['/notifications','اعلان‌ها','notification.read'],['/search','جستجو','search.read'],['/calendar','تقویم','meeting.read'],['/requirements','نیازمندی‌ها','project.read'],['/referrals','معرفی‌ها','relationship.read'],['/approvals','تأییدها','approval.read'],['/settings','تنظیمات','user.read'],['/sessions','نشست‌ها','session.read'],
] as const;
const adminNav: Array<readonly [string,string,string]>=[['/admin','مدیریت سیستم','admin.users'],['/data-management','داده و کیفیت','data.manage'],['/privacy','حریم خصوصی','privacy.read'],['/integrations','یکپارچه‌سازی','integration.read'],['/workflows','Workflow','workflow.read'],['/analytics','تحلیل محصول','analytics.read'],['/data-quality','کیفیت داده','data.quality.read'],['/metrics','سنجه‌ها','metrics.read'],['/observability','مشاهده‌پذیری','metrics.read'],['/monitoring','Monitoring','metrics.read'],['/admin/master-data','Master Data','org.read'],['/admin/feature-flags','Feature Flags','feature_flag.read'],['/admin/exports','Export Control','audit.read'],['/admin/sessions','Session Governance','session.read'],['/admin/retention','Retention','privacy.manage'],['/security','امنیت','security.read'],['/governance','Governance','enterprise.security'],['/monitoring','Monitoring','metrics.read'],['/health','Runtime Health','health.read']] as const;

export function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname(); const router=useRouter(); const {me,loading,error,scopeId,setScopeId,role,can,isAdmin}=useWorkspace();
  const authPage=['/login','/mfa','/forgot-password','/password-reset','/register'].some(p=>pathname===p||pathname.startsWith(p+'/'));
  if(authPage) return <>{children}</>;
  if(!me&&!loading&&!error){router.replace('/login');return <div className="loading-strip" role="status">در حال انتقال به صفحه ورود…</div>;}
  if(error && !me && !loading){router.replace('/login');return <div className="loading-strip" role="status">نشست معتبر نیست…</div>;}
  const nav: Array<readonly [string,string,string]>=baseNav.filter(([, , permission])=>permission==='dashboard.read'||can(permission)); if(isAdmin) nav.push(...adminNav.filter(([, ,permission])=>can(permission)));
  const memberships=me?.memberships??[];
  const selectedLabel=scopeId==='all'?'همه محدوده مجاز':memberships.find(m=>m.organizationId===scopeId)?.organizationName??'محدوده انتخاب‌شده';
  async function logout(){try{const refresh=getRefreshToken();if(refresh) await apiPost('/auth/logout',{token:refresh});}catch{} finally{clearSession();router.replace('/login');}}
  return <div className="app-shell">
    <aside className="sidebar" aria-label="ناوبری اصلی">
      <div className="brand"><div className="brand-mark">S</div><div><strong>تعاملات</strong><span>Relationship Intelligence</span></div></div>
      <div className="workspace-role"><span>Workspace</span><strong>{ROLE_LABELS[role]}</strong></div>
      <nav className="side-nav" aria-label="ناوبری Workspace">{nav.map(([href,label,permission])=><a className={pathname===href||pathname.startsWith(href+'/' )?'active':''} href={href} key={href}>{label}</a>)}</nav>
      <button className="logout-button" onClick={logout}>خروج امن</button>
    </aside>
    <div className="app-main">
      <header className="global-header" role="banner">
        <div className="global-search"><a href="/search">Search Everything…</a></div>
        <div className="header-actions">
          <select aria-label="محدوده سازمانی" value={scopeId} onChange={e=>setScopeId(e.target.value)}><option value="all">🌐 همه محدوده مجاز</option>{memberships.map(m=><option key={m.organizationId} value={m.organizationId}>{m.organizationName}</option>)}</select>
          <a href="/notifications" className="header-link">🔔</a>
          <a href="/admin" className="avatar" aria-label="پروفایل">{(me?.name??'U').slice(0,1)}</a>
        </div>
      </header>
      {error&&<div className="runtime-banner" role="status">اطلاعات نقش/محدوده از API دریافت نشد؛ Backend همچنان مرجع نهایی Authorization است.</div>}
      {loading&&<div className="loading-strip" aria-live="polite">در حال بارگذاری هویت و محدوده دسترسی…</div>}
      <main id="workspace-main" className="workspace-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}

export function ScopeBadge(){const {scopeId,me}=useWorkspace();const label=scopeId==='all'?'همه محدوده مجاز':me?.memberships.find(m=>m.organizationId===scopeId)?.organizationName??'محدوده';return <span className="scope-badge">Scope: {label}</span>}
