'use client';
import Link from 'next/link';

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
  DatabaseBackup, Archive, ScrollText, HeartPulse, ChevronDown, ChevronUp
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
  const applyMe = (v: Me) => {
    setMe(v);
    const owner = v.permissions?.includes('*');
    if (!owner) {
      // Tenant: default scope = their own organization; 'all' is not offered.
      const prim = v.memberships?.find(m => m.isPrimary) ?? v.memberships?.[0];
      const target = prim?.organizationId ?? '';
      if (getScope() !== target) { setScopeIdState(target); setScope(target); }
    } else if (!getScope()) {
      setScopeIdState('all'); setScope('all');
    }
  };
  useEffect(() => {
    const stored = getScope(); if (stored) setScopeIdState(stored);
    const token = getAccessToken();
    if (!token && !getRefreshToken()) { setLoading(false); return; }
    api<Me>('/auth/me').then(applyMe).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const reload = () => {
      setMe(null);
      setError('');
      const token = getAccessToken();
      if (!token && !getRefreshToken()) { setLoading(false); return; }
      setLoading(true);
      api<Me>('/auth/me').then(applyMe).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
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
  ['/calendar', 'تقویم جلسات', 'meeting.read'],
  ['/data-exchange', 'تبادل داده', 'report.read'],
  ['/requirements', 'نیازمندی‌ها', 'project.read'],
  ['/referrals', 'معرفی‌ها', 'relationship.read'],
  ['/approvals', 'تأییدها', 'approval.read'],
  ['/settings', 'تنظیمات', 'user.read'],
  ['/sessions', 'نشست‌ها', 'session.read'],
  ['/help', 'راهنما', 'help.read'],
] as const;
const ADMIN_NAV: Array<readonly [string, string, string]> = [
  ['/admin', 'مدیریت سیستم', 'admin.users'],
  ['/data-management', 'داده و کیفیت', 'data.manage'],
  ['/privacy', 'حریم خصوصی', 'privacy.read'],
  ['/integrations', 'یکپارچه‌سازی', 'integration.read'],
  ['/workflows', 'گردش کار', 'workflow.read'],
  ['/analytics', 'تحلیل محصول', 'analytics.read'],
  ['/data-quality', 'کیفیت داده', 'data.quality.read'],
  ['/metrics', 'سنجه‌ها', 'metrics.read'],
  ['/observability', 'مشاهده‌پذیری', 'metrics.read'],
  ['/monitoring', 'پایش', 'metrics.read'],
  ['/admin/master-data', 'داده‌های مبنایی', 'org.read'],
  ['/admin/feature-flags', 'پرچم‌های ویژگی', 'feature_flag.read'],
  ['/admin/exports', 'کنترل خروجی داده', 'audit.read'],
  ['/admin/sessions', 'مدیریت نشست‌ها', 'session.read'],
  ['/admin/retention', 'نگهداری داده', 'privacy.manage'],
  ['/security', 'امنیت', 'security.read'],
  ['/security-events', 'رویدادهای امنیتی', 'security.read'],
  ['/governance', 'حاکمیت', 'enterprise.security'],
  ['/enterprise', 'حاکمیت سازمانی', 'enterprise.read'],
  ['/data-lifecycle', 'چرخهٔ حیات داده', 'data.lifecycle_status'],
  ['/health', 'سلامت زمان اجرا', 'health.read'],
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
        <Link href={href} key={href} className={href === activeHref ? 'active' : ''}>{NAV_ICONS[href]}{label}</Link>
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
      aria-label={dark ? 'تغییر به پوستهٔ روشن' : 'تغییر به پوستهٔ تیره'}
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
  const [navOpen, setNavOpen] = useState(false);
  // Close the mobile drawer on navigation
  useEffect(() => { setNavOpen(false); }, [pathname]);
  // Close on Escape
  useEffect(() => {
    if (!navOpen) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [navOpen]);
  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (navOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);
  // NOTE: every hook must run on EVERY render — keep all useState/useEffect
  // above the early returns below (auth pages etc.), otherwise React throws
  // "Rendered fewer hooks than expected" on login↔dashboard navigation.
  const memberships = me?.memberships ?? [];
  const primaryMembership = memberships.find(m => m.isPrimary) ?? memberships[0];
  const isOwner = !!me?.permissions?.includes('*');
  const [ownerOrgs, setOwnerOrgs] = useState<Array<{ id: string; name: string; type?: string }>>([]);
  useEffect(() => {
    if (!isOwner) { setOwnerOrgs([]); return; }
    api('/organizations')
      .then((d: any) => setOwnerOrgs(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => {});
  }, [isOwner]);

  const authPage = ['/login','/mfa','/forgot-password','/password-reset','/register'].some(p => pathname === p || pathname.startsWith(p + '/'));
  // Session gate: an anonymous visitor must NEVER see (even for one frame) the
  // platform.  The veil below is part of the first server-rendered paint, so it
  // covers the shell until the identity probe settles — then it is removed for
  // signed-in users, or we navigate to /login for anonymous ones.
  const gated = !authPage && !me;
  useEffect(() => {
    if (!gated || loading) return;
    router.replace('/login');
  }, [gated, loading, router]);
  // Lock page scroll while the gate veil is up (content behind must not move).
  useEffect(() => {
    if (!gated) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [gated]);
  if (authPage) return <>{children}</>;

  const group = (nav: Array<readonly [string, string, string]>): Array<readonly [string, string, string]> =>
    nav.filter(([href, , permission]) => href === '/' || permission === 'dashboard.read' || can(permission));
  const scopeOptions = [...memberships.map(m => ({ id: m.organizationId, name: m.organizationName })), ...ownerOrgs.filter(o => !memberships.some(m => m.organizationId === o.id))];
  const selectedLabel = scopeId === 'all' ? 'همه محدوده مجاز' : scopeOptions.find(o => o.id === scopeId)?.name ?? 'محدوده انتخاب‌شده';

  const engineState = error ? 'degraded' : me ? 'online' : 'pending';
  const engineLabel = error ? 'ناکارآمد' : me ? 'آنلاین' : 'در حال راه‌اندازی';

  async function logout() {
    try {
      const refresh = getRefreshToken();
      if (refresh) await apiPost('/auth/logout', { token: refresh });
    } catch {}
    finally { clearSession(); router.replace('/login'); }
  }

  return (
    <>
      {gated && (
        <div className="auth-gate" role="status" aria-live="polite">
          <div className="auth-gate-card">
            <div className="auth-gate-mark" aria-hidden="true">S</div>
            <div className="auth-gate-title"><strong>SRIP</strong><span>هوش روابط راهبردی</span></div>
            <div className="spinner" aria-hidden="true" />
            <p>{loading ? 'در حال بررسی نشست و محدودهٔ دسترسی…' : 'نشست فعالی یافت نشد؛ انتقال به صفحهٔ ورود…'}</p>
          </div>
        </div>
      )}
      <div className="app-shell" aria-hidden={gated || undefined}>
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="ناوبری اصلی">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-title">
            <strong>SRIP</strong>
            <span>هوش راهبردی</span>
          </div>
        </div>
        <div className="workspace-role">
          <span>فضای کاری</span>
          <strong>{ROLE_LABELS[role]}</strong>
          {primaryMembership && <strong className="role-org">{primaryMembership.organizationName}</strong>}
        </div>
        <nav className="side-nav" aria-label="ناوبری فضای کاری">
          <NavGroup title="اصلی" items={group(MAIN_NAV)} pathname={pathname} />
          <NavGroup title="هوشمندی" items={group(INTELLIGENCE_NAV)} pathname={pathname} />
          <NavGroup title="سیستم" items={group(SYSTEM_NAV)} pathname={pathname} />
          {isAdmin && <NavGroup title="مدیریت سیستم" items={group(ADMIN_NAV)} pathname={pathname} collapsible defaultOpen={false} />}
        </nav>
        <div className="engine-card">
          <div className="ec-top">
            <span className={`dot ${engineState === 'online' ? '' : engineState}`} />
            <div>
              <b>موتور هوشمندی</b>
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
          <div className="header-left">
            <button className="icon-btn nav-toggle" onClick={() => setNavOpen(true)} aria-label="باز کردن منو" title="منو">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <div className="global-search">
              <Link href="/search">
                <Search size={13}/> جستجوی سراسری…
                <kbd className="kbd">⌘K</kbd>
              </Link>
            </div>
          </div>
          <div className="header-actions">
            {me?.email === 'demo@srip.local' && <span className="demo-chip" title="این یک محیط دمو با دادهٔ نمایشی است">حالت دمو · مالک</span>}
            {me?.email === 'client@arya-tech.ir' && <span className="demo-chip" title="مشتری که پلتفرم را تحویل گرفته — فقط محدودهٔ خودش">مستأجر · آریا فناوری</span>}
            <label className="scope-chip" title="محدوده سازمانی — اعمال‌شده در سرور">
              <span className="globe"><Network size={13}/></span>
              <span className="scope-label">{selectedLabel}</span>
              <select aria-label="محدوده سازمانی" value={scopeId} onChange={e => setScopeId(e.target.value)}>
                {isOwner && <option value="all">همه محدوده مجاز (جلسات من)</option>}
                {scopeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <Link className="ai-btn" href="/ai"><Sparkles size={14}/> دستیار هوش مصنوعی</Link>
            <AppShellEnhancement />
            <ThemeToggle />
            <Link href="/admin" className="user-chip" aria-label="پروفایل">
              <span className="avatar">{(me?.name ?? 'U').slice(0, 1)}</span>
              <span className="uc-meta">
                <strong>{me?.name ?? 'کاربر'}</strong>
                <small>{ROLE_LABELS[role]}</small>
              </span>
              <span className="chev">▾</span>
            </Link>
          </div>
        </header>
        {error && <div className="runtime-banner" role="status">اطلاعات نقش/محدوده از API دریافت نشد؛ سرور همچنان مرجع نهایی مجوزها است.</div>}
        {loading && <div className="loading-strip" aria-live="polite">در حال بارگذاری هویت و محدوده دسترسی…</div>}
        <main id="workspace-main" className="workspace-content" tabIndex={-1}>{children}</main>
      </div>
      </div>
    </>
  );
}

export function ScopeBadge() {
  const { scopeId, me } = useWorkspace();
  const label = scopeId === 'all' ? 'همه محدوده مجاز' : me?.memberships.find(m => m.organizationId === scopeId)?.organizationName ?? 'محدوده';
  return <span className="scope-badge">محدوده: {label}</span>;
}