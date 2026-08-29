'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, getAccessToken, getRefreshToken, apiPost, setScope, getScope } from '../_lib/api';
import { AppShellEnhancement } from './app-shell-enhancement';
import { Button } from '@srip/design-system';
import {
  LayoutDashboard, Building2, Users, Share2, Network, MessagesSquare,   CalendarDays, Zap,
  ShieldCheck, FolderKanban, Target, BrainCircuit, FileText, ThumbsUp, BarChart3, BookOpen,
  Bell, Search, Calendar, ListChecks, UserCheck, CheckCircle2, Settings, Settings2, Sparkles, Timer, Database,
  Shield, Plug, Workflow, LineChart, Gauge, Activity, Table2, Flag, FileDown, KeyRound,
  DatabaseBackup, Archive, ScrollText, HeartPulse, ChevronDown, ChevronUp, AlertTriangle, Upload
} from 'lucide-react';

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
const NETWORK_MAIN_NAV: Array<readonly [string, string, string]> = [
  ['/', 'Dashboard', 'dashboard.read'],
  ['/organizations', 'Organizations', 'organization.read'],
  ['/people', 'People', 'person.read'],
  ['/relationships', 'Relationships', 'relationship.read'],
  ['/network', 'Network', 'network.read'],
  ['/calendar', 'Calendar', 'meeting.read'],
] as const;
const NETWORK_INTELLIGENCE_NAV: Array<readonly [string, string, string]> = [
  ['/intelligence', 'Intelligence', 'analytics.read'],
  ['/opportunities', 'Opportunities', 'opportunity.read'],
  ['/network?view=risks', 'Risks', 'network.read'],
  ['/reports', 'Reports', 'report.read'],
] as const;
const NETWORK_SYSTEM_NAV: Array<readonly [string, string, string]> = [
  ['/data-management/import', 'Data Import', 'data.manage'],
  ['/settings', 'Settings', 'user.read'],
  ['/admin/users', 'Users', 'admin.users'],
  ['/admin/audit', 'Audit Log', 'audit.read'],
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
  '/': <LayoutDashboard size={16}/>,
  '/organizations': <Building2 size={16}/>,
  '/people': <Users size={16}/>,
  '/relationships': <Share2 size={16}/>,
  '/network': <Network size={16}/>,
  '/interactions': <MessagesSquare size={16}/>,
  '/meetings': <CalendarDays size={16}/>,
  '/actions': <Zap size={16}/>,
  '/commitments': <ShieldCheck size={16}/>,
  '/projects': <FolderKanban size={16}/>,
  '/opportunities': <Target size={16}/>,
  '/intelligence': <BrainCircuit size={16}/>,
  '/ai': <Sparkles size={16}/>,
  '/ai-executive-brief': <FileText size={16}/>,
  '/recommendations': <ThumbsUp size={16}/>,
  '/reports': <BarChart3 size={16}/>,
  '/documents': <BookOpen size={16}/>,
  '/notifications': <Bell size={16}/>,
  '/search': <Search size={16}/>,
  '/calendar': <Calendar size={16}/>,
  '/requirements': <ListChecks size={16}/>,
  '/referrals': <UserCheck size={16}/>,
  '/approvals': <CheckCircle2 size={16}/>,
  '/settings': <Settings size={16}/>,
  '/sessions': <Timer size={16}/>,
  '/admin': <Settings2 size={16}/>,
  '/data-management': <Database size={16}/>,
  '/privacy': <Shield size={16}/>,
  '/integrations': <Plug size={16}/>,
  '/workflows': <Workflow size={16}/>,
  '/analytics': <LineChart size={16}/>,
  '/data-quality': <Gauge size={16}/>,
  '/metrics': <BarChart3 size={16}/>,
  '/observability': <Activity size={16}/>,
  '/monitoring': <Activity size={16}/>,
  '/admin/master-data': <Table2 size={16}/>,
  '/admin/feature-flags': <Flag size={16}/>,
  '/admin/exports': <FileDown size={16}/>,
  '/admin/sessions': <KeyRound size={16}/>,
  '/admin/retention': <DatabaseBackup size={16}/>,
  '/security': <Shield size={16}/>,
  '/security-events': <ScrollText size={16}/>,
  '/governance': <ScrollText size={16}/>,
  '/enterprise': <Archive size={16}/>,
  '/data-lifecycle': <DatabaseBackup size={16}/>,
  '/health': <HeartPulse size={16}/>,
  '/network?view=risks': <AlertTriangle size={16}/>,
  '/data-management/import': <Upload size={16}/>,
  '/admin/users': <Users size={16}/>,
  '/admin/audit': <ScrollText size={16}/>,
};

function NavGroup({ title, items, pathname, collapsible = false, defaultOpen = true }: { title: string; items: Array<readonly [string, string, string]>; pathname: string; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const activeHref = items.find(([href]) => pathname === href || pathname.startsWith(href + '/'))?.[0];
  return (
    <>
      <div className={`nav-group-title ${collapsible ? 'nav-group-toggle' : ''}`} onClick={collapsible ? () => setOpen(o => !o) : undefined} role={collapsible ? 'button' : undefined} tabIndex={collapsible ? 0 : undefined} onKeyDown={collapsible ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } } : undefined}>
        <span>{title}</span>
        {collapsible && (open ? <ChevronUp size={13} aria-hidden="true"/> : <ChevronDown size={13} aria-hidden="true"/>)}
      </div>
      {(open || !collapsible) && items.map(([href, label]) => (
        <a href={href} key={href} className={href === activeHref ? 'active' : ''}>{NAV_ICONS[href]}{label}</a>
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

  const networkRoute = pathname === '/network';

  return (
    <div className={`app-shell${networkRoute ? ' network-shell' : ''}`}>
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
          {networkRoute ? <>
            <NavGroup title="Main" items={group(NETWORK_MAIN_NAV)} pathname={pathname} />
            <div className="network-nav-divider" />
            <NavGroup title="Intelligence" items={group(NETWORK_INTELLIGENCE_NAV)} pathname={pathname} />
            <div className="network-nav-divider" />
            <NavGroup title="System" items={group(NETWORK_SYSTEM_NAV)} pathname={pathname} />
          </> : <>
            <NavGroup title="Main" items={group(MAIN_NAV)} pathname={pathname} />
            <NavGroup title="Intelligence" items={group(INTELLIGENCE_NAV)} pathname={pathname} />
            <NavGroup title="System" items={group(SYSTEM_NAV)} pathname={pathname} />
            {isAdmin && <NavGroup title="مدیریت سیستم" items={group(ADMIN_NAV)} pathname={pathname} collapsible defaultOpen={false} />}
          </>}
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
        <Button className="logout-button ghost" onClick={logout}><span className="logout-label">خروج امن</span></Button>
      </aside>
      <div className="app-main">
        <header className="global-header" role="banner">
          <div className="global-search">
            <a href="/search">
              <span>🔍</span> {networkRoute ? 'Search people, organizations, projects...' : 'جستجوی سراسری…'}
              <kbd className="kbd">⌘ K</kbd>
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
              <span className="avatar">{networkRoute ? 'A' : (me?.name ?? 'U').slice(0, 1)}</span>
              <span className="uc-meta">
                <strong>{networkRoute ? 'Admin' : (me?.name ?? 'User')}</strong>
                <small>{networkRoute ? 'Super Admin' : ROLE_LABELS[role]}</small>
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