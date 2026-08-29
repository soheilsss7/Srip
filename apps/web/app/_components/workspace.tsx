'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, getAccessToken, getRefreshToken, apiPost, setScope, getScope } from '../_lib/api';
import { AppShellEnhancement } from './app-shell-enhancement';

type Role = 'SUPER_ADMIN'|'HOLDING_ADMIN'|'HOLDING_EXECUTIVE'|'SUBSIDIARY_ADMIN'|'SUBSIDIARY_EXECUTIVE'|'RELATIONSHIP_MANAGER'|'PROJECT_MANAGER'|'ANALYST'|'STANDARD_USER'|'READ_ONLY';
type Membership = { id: string; organizationId: string; organizationName: string; role: Role; department?: string|null; dataScope: string; accessScope: string; isPrimary: boolean };
type Me = { id: string; email: string; name: string; memberships: Membership[]; permissions: string[]; accessibleOrganizationIds: string[] };

type WorkspaceContextValue = { me: Me|null; loading: boolean; error: string; scopeId: string; setScopeId: (id: string)=>void; role: Role; can: (permission: string)=>boolean; isAdmin: boolean };
const WorkspaceContext = createContext<WorkspaceContextValue|null>(null);

export const ROLE_LABELS: Record<Role,string> = { SUPER_ADMIN:'مدیر کل سیستم', HOLDING_ADMIN:'مدیر هلدینگ', HOLDING_EXECUTIVE:'مدیر ارشد هلدینگ', SUBSIDIARY_ADMIN:'مدیر شرکت', SUBSIDIARY_EXECUTIVE:'مدیر ارشد شرکت', RELATIONSHIP_MANAGER:'مدیر روابط', PROJECT_MANAGER:'مدیر پروژه', ANALYST:'تحلیلگر', STANDARD_USER:'کاربر استاندارد', READ_ONLY:'فقط خواندنی' };

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scopeId, setScopeIdState] = useState('all');
  useEffect(() => {
    const stored = getScope(); if (stored) setScopeIdState(stored);
    const token = getAccessToken();
    if (!token && !getRefreshToken()) { setLoading(false); return; }
    api<Me>('/auth/me').then(v => setMe(v)).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const reload = () => {
      setMe(null);
      setError('');
      const token = getAccessToken();
      if (!token && !getRefreshToken()) { setLoading(false); return; }
      setLoading(true);
      api<Me>('/auth/me').then(v => setMe(v)).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
    };
    window.addEventListener('srip:session', reload);
    return () => window.removeEventListener('srip:session', reload);
  }, []);
  const setScopeId = (id: string) => { setScopeIdState(id); setScope(id); };
  const role = (me?.memberships.find(m => m.isPrimary)?.role ?? me?.memberships[0]?.role ?? 'STANDARD_USER') as Role;
  const permissions = me?.permissions ?? [];
  const can = (p: string) => permissions.includes(p) || permissions.includes('*');
  const isAdmin = ['SUPER_ADMIN','HOLDING_ADMIN','SUBSIDIARY_ADMIN'].includes(role);
  return <WorkspaceContext.Provider value={{ me, loading, error, scopeId, setScopeId, role, can, isAdmin }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const v = useContext(WorkspaceContext);
  if (!v) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return v;
}

/* ---------------------------------------------------------------------------
   Navigation model — grouped into MAIN / INTELLIGENCE / SYSTEM (+ ADMIN).
   Permissions are the same real backend permission keys used elsewhere.
   --------------------------------------------------------------------------- */
const MAIN_NAV: Array<readonly [string, string, string]> = [
  ['/', 'داشبورد', 'dashboard.read'],
  ['/organizations', 'سازمان‌ها', 'organization.read'],
  ['/people', 'اشخاص', 'person.read'],
  ['/relationships', 'روابط', 'relationship.read'],
  ['/network', 'شبکه اطلاعاتی', 'network.read'],
  ['/interactions', 'تعاملات', 'interaction.read'],
] as const;
const INTELLIGENCE_NAV: Array<readonly [string, string, string]> = [
  ['/meetings', 'جلسات', 'meeting.read'],
  ['/actions', 'اقدامات', 'action.read'],
  ['/commitments', 'تعهدات', 'commitment.read'],
  ['/projects', 'پروژه‌ها', 'project.read'],
  ['/opportunities', 'فرصت‌ها', 'opportunity.read'],
  ['/intelligence', 'هوشمندی', 'analytics.read'],
  ['/ai', 'هوش مصنوعی', 'ai.query'],
  ['/ai-executive-brief', 'گزارش هوش مصنوعی', 'ai.executive_brief'],
  ['/recommendations', 'پیشنهادات', 'recommendation.read'],
  ['/reports', 'گزارش‌ها', 'report.read'],
] as const;
const SYSTEM_NAV: Array<readonly [string, string, string]> = [
  ['/documents', 'دانش', 'document.read'],
  ['/notifications', 'اعلان‌ها', 'notification.read'],
  ['/search', 'جستجو', 'search.read'],
  ['/calendar', 'تقویم', 'meeting.read'],
  ['/requirements', 'نیازمندی‌ها', 'project.read'],
  ['/referrals', 'معرفی‌ها', 'relationship.read'],
  ['/approvals', 'تأییدها', 'approval.read'],
  ['/settings', 'تنظیمات', 'user.read'],
  ['/sessions', 'نشست‌ها', 'session.read'],
] as const;
const ADMIN_NAV: Array<readonly [string, string, string]> = [
  ['/admin', 'مدیریت سیستم', 'admin.users'],
  ['/data-management', 'داده و کیفیت', 'data.manage'],
  ['/privacy', 'حریم خصوصی', 'privacy.read'],
  ['/integrations', 'یکپارچه‌سازی', 'integration.read'],
  ['/workflows', 'Workflow', 'workflow.read'],
  ['/analytics', 'تحلیل محصول', 'analytics.read'],
  ['/data-quality', 'کیفیت داده', 'data.quality.read'],
  ['/metrics', 'سنجه‌ها', 'metrics.read'],
  ['/observability', 'مشاهده‌پذیری', 'metrics.read'],
  ['/monitoring', 'Monitoring', 'metrics.read'],
  ['/admin/master-data', 'Master Data', 'org.read'],
  ['/admin/feature-flags', 'Feature Flags', 'feature_flag.read'],
  ['/admin/exports', 'Export Control', 'audit.read'],
  ['/admin/sessions', 'Session Governance', 'session.read'],
  ['/admin/retention', 'Retention', 'privacy.manage'],
  ['/security', 'امنیت', 'security.read'],
  ['/security-events', 'Security Events', 'security.read'],
  ['/governance', 'Governance', 'enterprise.security'],
  ['/enterprise', 'Enterprise Governance', 'enterprise.read'],
  ['/data-lifecycle', 'Data Lifecycle', 'data.lifecycle_status'],
  ['/health', 'Runtime Health', 'health.read'],
] as const;

const NAV_ICONS: Record<string, React.ReactNode> = {
  '/': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  '/organizations': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" /></svg>,
  '/people': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/relationships': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  '/network': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" /><circle cx="9" cy="9" r="1.6" /><circle cx="15" cy="9" r="1.6" /><circle cx="9" cy="15" r="1.6" /><circle cx="15" cy="15" r="1.6" /><circle cx="12" cy="12" r="1.6" /></svg>,
  '/interactions': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></svg>,
  '/meetings': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 15l3 3 6-6" /></svg>,
  '/actions': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  '/commitments': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  '/projects': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>,
  '/opportunities': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  '/intelligence': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  '/ai': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6z" /></svg>,
  '/ai-executive-brief': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
  '/recommendations': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="9 12 11 14 15 10" /></svg>,
  '/reports': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>,
  '/documents': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.42 10.92a2 2 0 0 0 0-2.83l-5.51-5.51a2 2 0 0 0-2.83 0l-8.25 8.25a2 2 0 0 0 0 2.83L9 20.83a2 2 0 0 0 2.83 0z" /><line x1="12" y1="10" x2="14" y2="12" /></svg>,
  '/notifications': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  '/search': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  '/calendar': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  '/requirements': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>,
  '/referrals': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  '/approvals': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  '/settings': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  '/sessions': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  '/admin': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /></svg>,
  '/admin/master-data': <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>,
};

function NavGroup({ title, items, pathname }: { title: string; items: Array<readonly [string, string, string]>; pathname: string }) {
  return (
    <>
      <div className="nav-group-title">{title}</div>
      {items.map(([href, label]) => (
        <a href={href} key={href} className={pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}>{NAV_ICONS[href]}{label}</a>
      ))}
    </>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('srip_theme');
    setDark(saved === 'dark');
  }, []);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setDark(!dark);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('srip_theme', next); } catch {}
  };
  return (
    <button
      className={`icon-btn theme-toggle ${dark ? 'light' : 'dark'}`}
      onClick={toggle}
      title={dark ? 'پوسته روشن' : 'پوسته تیره'}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, error, scopeId, setScopeId, role, can, isAdmin } = useWorkspace();
  const authPage = ['/login','/mfa','/forgot-password','/password-reset','/register'].some(p => pathname === p || pathname.startsWith(p + '/'));
  if (authPage) return <>{children}</>;
  if (!me && !loading && !error) { router.replace('/login'); return <div className="loading-strip" role="status">در حال انتقال به صفحه ورود…</div>; }
  if (error && !me && !loading) { router.replace('/login'); return <div className="loading-strip" role="status">نشست معتبر نیست…</div>; }

  const group = (nav: Array<readonly [string, string, string]>): Array<readonly [string, string, string]> =>
    nav.filter(([href, , permission]) => href === '/' || permission === 'dashboard.read' || can(permission));

  const memberships = me?.memberships ?? [];
  const primaryMembership = memberships.find(m => m.isPrimary) ?? memberships[0];
  const selectedLabel = scopeId === 'all' ? 'همه محدوده مجاز' : memberships.find(m => m.organizationId === scopeId)?.organizationName ?? 'محدوده انتخاب‌شده';

  const engineState = error ? 'degraded' : me ? 'online' : 'pending';
  const engineLabel = error ? 'DEGRADED' : me ? 'ONLINE' : 'BOOTING';

  async function logout() {
    try {
      const refresh = getRefreshToken();
      if (refresh) await apiPost('/auth/logout', { token: refresh });
    } catch {}
    finally { clearSession(); router.replace('/login'); }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="ناوبری اصلی">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-title">
            <strong>SRIP</strong>
            <span>Strategic Intelligence</span>
          </div>
        </div>
        <div className="workspace-role">
          <span>Workspace</span>
          <strong>{ROLE_LABELS[role]}</strong>
          {primaryMembership && <strong className="role-org">{primaryMembership.organizationName}</strong>}
        </div>
        <nav className="side-nav" aria-label="ناوبری Workspace">
          <NavGroup title="Main" items={group(MAIN_NAV)} pathname={pathname} />
          <NavGroup title="Intelligence" items={group(INTELLIGENCE_NAV)} pathname={pathname} />
          <NavGroup title="System" items={group(SYSTEM_NAV)} pathname={pathname} />
          {isAdmin && <NavGroup title="Admin" items={group(ADMIN_NAV)} pathname={pathname} />}
        </nav>
        <div className="engine-card">
          <div className="ec-top">
            <span className={`dot ${engineState === 'online' ? '' : engineState}`} />
            <div>
              <b>Intelligence Engine</b>
              <span>{engineLabel}</span>
            </div>
          </div>
          <svg className="ec-spark" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,16 14,12 28,14 42,9 56,12 70,6 84,10 98,5 120,8" fill="none" stroke="var(--srip-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
          </svg>
        </div>
        <button className="logout-button" onClick={logout}><span className="logout-label">خروج امن</span></button>
      </aside>
      <div className="app-main">
        <header className="global-header" role="banner">
          <div className="global-search">
            <a href="/search">
              <span>🔍</span> جستجوی سراسری…
              <kbd className="kbd">⌘K</kbd>
            </a>
          </div>
          <div className="header-actions">
            {me?.email === 'demo@srip.local' && <span className="demo-chip" title="این یک محیط دمو با دادهٔ نمایشی است">حالت دمو</span>}
            <label className="scope-chip" title="Global Admin scope — backend-enforced">
              <span className="globe">🌐</span>
              <span className="scope-label">{selectedLabel}</span>
              <select aria-label="محدوده سازمانی" value={scopeId} onChange={e => setScopeId(e.target.value)}>
                <option value="all">همه محدوده مجاز</option>
                {memberships.map(m => <option key={m.organizationId} value={m.organizationId}>{m.organizationName}</option>)}
              </select>
            </label>
            <a className="ai-btn" href="/ai">✨ AI Assistant</a>
            <AppShellEnhancement />
            <ThemeToggle />
            <a href="/admin" className="user-chip" aria-label="پروفایل">
              <span className="avatar">{(me?.name ?? 'U').slice(0, 1)}</span>
              <span className="uc-meta">
                <strong>{me?.name ?? 'User'}</strong>
                <small>{ROLE_LABELS[role]}</small>
              </span>
              <span className="chev">▾</span>
            </a>
          </div>
        </header>
        {error && <div className="runtime-banner" role="status">اطلاعات نقش/محدوده از API دریافت نشد؛ Backend همچنان مرجع نهایی Authorization است.</div>}
        {loading && <div className="loading-strip" aria-live="polite">در حال بارگذاری هویت و محدوده دسترسی…</div>}
        <main id="workspace-main" className="workspace-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

export function ScopeBadge() {
  const { scopeId, me } = useWorkspace();
  const label = scopeId === 'all' ? 'همه محدوده مجاز' : me?.memberships.find(m => m.organizationId === scopeId)?.organizationName ?? 'محدوده';
  return <span className="scope-badge">Scope: {label}</span>;
}