'use client';
import Link from 'next/link';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, getAccessToken, getRefreshToken, apiPost, setScope, getScope } from '../_lib/api';
import { NAV_ZONES, ADMIN_SUBS, getVisibleZones, getVisibleMobileTabs, NAV_PERMISSION_MAP, ADMIN_PERMISSION_MAP, GLOSS } from '../_lib/nav-structure';
import { AppShellEnhancement } from './app-shell-enhancement';
import { LocaleToggle, TranslationCoverageNote } from './locale-context';
import Portal from './portal';
import { Button } from '@srip/design-system';
import {
  LayoutDashboard, Building2, Users, Share2, Network, MessagesSquare,   CalendarDays, Zap,
  ShieldCheck, FolderKanban, Target, BrainCircuit, FileText, ThumbsUp, BarChart3, BookOpen,
  Bell, Search, Calendar, ListChecks, UserCheck, CheckCircle2, Settings, Settings2, Sparkles, Timer, Database,
  Shield, Plug, Workflow, LineChart, Gauge, Activity, Table2, Flag, FileDown, KeyRound,
  DatabaseBackup, Archive, ScrollText, HeartPulse, ChevronDown, ChevronUp, Landmark, Radar
} from 'lucide-react';
import { lt, t } from '../_lib/i18n';

type Role = 'SUPER_ADMIN'|'HOLDING_ADMIN'|'HOLDING_EXECUTIVE'|'SUBSIDIARY_ADMIN'|'SUBSIDIARY_EXECUTIVE'|'RELATIONSHIP_MANAGER'|'PROJECT_MANAGER'|'ANALYST'|'STANDARD_USER'|'READ_ONLY';
type Membership = { id: string; organizationId: string; organizationName: string; role: Role; department?: string|null; dataScope: string; accessScope: string; isPrimary: boolean };
type Me = { id: string; email: string; name: string; isOwner?: boolean; memberships: Membership[]; permissions: string[]; accessibleOrganizationIds: string[] };

type WorkspaceContextValue = { me: Me|null; loading: boolean; error: string; scopeId: string; setScopeId: (id: string)=>void; role: Role; can: (permission: string)=>boolean; isAdmin: boolean };
const WorkspaceContext = createContext<WorkspaceContextValue|null>(null);

export const ROLE_LABELS: Record<Role,string> = lt( { SUPER_ADMIN:t('مدیر کل سیستم'), HOLDING_ADMIN:t('مدیر هلدینگ'), HOLDING_EXECUTIVE:t('مدیر ارشد هلدینگ'), SUBSIDIARY_ADMIN:t('مدیر شرکت'), SUBSIDIARY_EXECUTIVE:t('مدیر ارشد شرکت'), RELATIONSHIP_MANAGER:t('مدیر روابط'), PROJECT_MANAGER:t('مدیر پروژه'), ANALYST:t('تحلیلگر'), STANDARD_USER:t('کاربر استاندارد'), READ_ONLY:t('فقط خواندنی') });

/**
 * کاوش نشست با مهلت.
 * در نسخۀ استاتیک روی GitHub Pages ممکن است API هرگز پاسخ ندهد؛ بدون این مهلت،
 * `loading` تا ابد true می‌ماند و پردۀ «در حال بررسی نشست…» کاربر را قفل می‌کند.
 */
const SESSION_PROBE_TIMEOUT_MS = 4500;
function probeMe(): Promise<Me> {
  return Promise.race<Me>([
    api<Me>('/auth/me'),
    new Promise<Me>((_resolve, reject) => {
      setTimeout(() => reject(new Error(t('بررسی نشست بیش از حد طول کشید'))), SESSION_PROBE_TIMEOUT_MS);
    }),
  ]);
}

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
    probeMe().then(applyMe).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const reload = () => {
      setMe(null);
      setError('');
      const token = getAccessToken();
      if (!token && !getRefreshToken()) { setLoading(false); return; }
      setLoading(true);
      probeMe().then(applyMe).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
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

/* معماری اطلاعات ۳.۰ (شش خانهٔ کاری + مرکز سیستم) — تعریف ساختار در _lib/nav-structure.ts (تک‌منبع) */


const NAV_ICONS: Record<string, React.ReactNode> = {
  '/': <LayoutDashboard size={16}/>,
  '/organizations': <Building2 size={16}/>,
  '/people': <Users size={16}/>,
  '/relationships': <Share2 size={16}/>,
  '/network': <Network size={16}/>,
  '/publics': <Radar size={16}/>,
  '/strategy': <Target size={16}/>,

  '/interactions': <MessagesSquare size={16}/>,
  '/meetings': <CalendarDays size={16}/>,
  '/actions': <Zap size={16}/>,
  '/commitments': <ShieldCheck size={16}/>,
  '/projects': <FolderKanban size={16}/>,
  '/opportunities': <Target size={16}/>,
  '/intelligence': <BrainCircuit size={16}/>,
  '/board': <Landmark size={16}/>,
  '/ai': <Sparkles size={16}/>,
  '/alerts': <Bell size={16}/>,
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
      title={dark ? t('پوسته روشن') : t('پوسته تیره')}
      aria-label={dark ? t('تغییر به پوستهٔ روشن') : t('تغییر به پوستهٔ تیره')}
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
  const [dictOpen, setDictOpen] = useState(false);
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

  /* '/p' = پورتال عمومی بی‌احراز (مسترپلن فاز ۲/۱۳) — فرم شکایت/درخواست و پاسخ نظرسنجی بدون ورود */
  const authPage = ['/login','/mfa','/forgot-password','/password-reset','/register','/p'].some(p => pathname === p || pathname.startsWith(p + '/'));
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
  const selectedLabel = scopeId === 'all' ? t('همه محدوده مجاز') : scopeOptions.find(o => o.id === scopeId)?.name ?? t('محدوده انتخاب‌شده');

  const engineState = error ? 'degraded' : me ? 'online' : 'pending';
  const engineLabel = error ? t('ناکارآمد') : me ? t('آنلاین') : t('در حال راه‌اندازی');

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
            <div className="auth-gate-title"><strong>SRIP</strong><span>{t('هوش روابط راهبردی')}</span></div>
            <div className="spinner" aria-hidden="true" />
            <p>{loading ? t('در حال بررسی نشست و محدودهٔ دسترسی…') : t('نشست فعالی یافت نشد؛ انتقال به صفحهٔ ورود…')}</p>
            <Link className="auth-gate-escape" href="/login" onClick={() => clearSession()}>{t('رفتن به صفحهٔ ورود')}</Link>
          </div>
        </div>
      )}
      <div className="app-shell" aria-hidden={gated || undefined}>
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label={t('ناوبری اصلی')}>
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-title">
            <strong>SRIP</strong>
            <span>{t('هوش راهبردی')}</span>
          </div>
        </div>
        <div className="workspace-role">
          <span>{t('فضای کاری')}</span>
          <strong>{ROLE_LABELS[role]}</strong>
          {primaryMembership && <strong className="role-org">{primaryMembership.organizationName}</strong>}
        </div>
        <nav className="side-nav" aria-label={t('ناوبری فضای کاری')}>
          {getVisibleZones(can, isAdmin).map(([title, sub, vis]) => (
            <React.Fragment key={title}>
              <div className="nav-zone" key={title}>
                <div className="nav-zone-title"><span>{title}</span>{sub ? <small>{sub}</small> : null}</div>
                {vis.map(([href, label]) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link href={href} key={href} className={active ? 'active' : ''} title={GLOSS[href] ?? label}>
                      {NAV_ICONS[href]}{label}
                    </Link>
                  );
                })}
              </div>
          </React.Fragment>
          ))}
          {isAdmin && (
            <div className="nav-zone nav-admin">
              <div className="nav-zone-title"><span>{t('سیستم')}</span><small>{t('مرکز مدیریت')}</small></div>
              <Link href="/admin" className={pathname === '/admin' || pathname.startsWith('/admin/') ? 'active' : ''} title={t('کاربران، حاکمیت، داده و پایش')}>
                {NAV_ICONS['/admin']}مرکز سیستم
              </Link>
            </div>
          )}
        </nav>
        <div className="engine-card">
          <div className="ec-top">
            <span className={`dot ${engineState === 'online' ? '' : engineState}`} />
            <div>
              <b>{t('موتور هوشمندی')}</b>
              <span>{engineLabel}</span>
            </div>
          </div>
          <svg className="ec-spark" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,16 14,12 28,14 42,9 56,12 70,6 84,10 98,5 120,8" fill="none" stroke="var(--srip-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
          </svg>
        </div>
        <div className="sidebar-bottom-actions">
          <button className="icon-btn dict-btn" onClick={() => setDictOpen(true)} title={t('واژه‌نامه و راهنما — هر بخش یعنی چه؟')} aria-label={t('واژه‌نامه و راهنما')}>{t('؟')}</button>
          <Button className="logout-button ghost" onClick={logout}><span className="logout-label">{t('خروج امن')}</span></Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="global-header" role="banner">
          <div className="header-left">
            <button className="icon-btn nav-toggle" onClick={() => setNavOpen(true)} aria-label={t('باز کردن منو')} title={t('منو')}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <div className="global-search">
              <Link href="/search">
                <Search size={13}/>
                <span className="gs-label">{t('جستجوی سراسری…')}</span>
                <kbd className="kbd">⌘K</kbd>
              </Link>
            </div>
          </div>
          <div className="header-actions">
            {me?.email === 'demo@srip.local' && <span className="demo-chip" title={t('این یک محیط دمو با دادهٔ نمایشی است')}>{t('حالت دمو · مالک')}</span>}
            {me?.email === 'client@arya-tech.ir' && <span className="demo-chip" title={t('مشتری که پلتفرم را تحویل گرفته — فقط محدودهٔ خودش')}>{t('مستأجر · آریا فناوری')}</span>}
            <label className="scope-chip" title={t('محدوده سازمانی — اعمال‌شده در سرور')}>
              <span className="globe"><Network size={13}/></span>
              <span className="scope-label">{selectedLabel}</span>
              <select aria-label={t('محدوده سازمانی')} value={scopeId} onChange={e => setScopeId(e.target.value)}>
                {isOwner && <option value="all">{t('همه محدوده مجاز (جلسات من)')}</option>}
                {scopeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <Link className="ai-btn" href="/ai"><Sparkles size={14}/> {t('دستیار هوشمند')}</Link>
            <AppShellEnhancement />
            <LocaleToggle />
            <ThemeToggle />
            <Link href="/settings" className="user-chip" aria-label={t('پروفایل')}>
              <span className="avatar">{(me?.name ?? t('کاربر')).slice(0, 1)}</span>
              <span className="uc-meta">
                <strong>{me?.name ?? t('کاربر')}</strong>
                <small>{ROLE_LABELS[role]}</small>
              </span>
              <span className="chev">▾</span>
            </Link>
          </div>
        </header>
        {error && <div className="runtime-banner" role="status">{t('اطلاعات نقش/محدوده از API دریافت نشد؛ سرور همچنان مرجع نهایی مجوزها است.')}</div>}
        {loading && <div className="loading-strip" aria-live="polite">{t('در حال بارگذاری هویت و محدوده دسترسی…')}</div>}
        <TranslationCoverageNote pathname={pathname} />
        <main id="workspace-main" className="workspace-content" tabIndex={-1}>{children}</main>
      </div>
      </div>
      {/* نوار تب پایین موبایل — در دسکتاپ با CSS پنهان است */}
      <nav className="mobile-tabs" aria-label={t('ناوبری سریع')}>
        {getVisibleMobileTabs(can).map(([href, label]) => {
          const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <span className="mt-ico" aria-hidden="true">{NAV_ICONS[href]}</span>
              <span className="mt-label">{label}</span>
            </Link>
          );
        })}
        <button type="button" className="mobile-tabs-more" onClick={() => setNavOpen(true)} aria-label={t('همهٔ بخش‌ها')} aria-expanded={navOpen}>
          <span className="mt-ico" aria-hidden="true"><ListChecks size={16}/></span>
          <span className="mt-label">{t('بیشتر')}</span>
        </button>
      </nav>
      {dictOpen && (
        <Portal>
        <div className="command-overlay" onClick={() => setDictOpen(false)} role="dialog" aria-modal="true" aria-label={t('واژه‌نامه')}>
          <div className="dict-card" onClick={(e) => e.stopPropagation()}>
            <header>
              <div><span className="eyebrow">{t('راهنمای سریع')}</span><h2>{t('این بخش یعنی چه؟')}</h2></div>
              <button onClick={() => setDictOpen(false)} aria-label={t('بستن')}>×</button>
            </header>
            <div className="dict-list">
              {NAV_ZONES.flatMap(([, , items]) => items)
                .filter(([href]) => href === '/' || can(NAV_PERMISSION_MAP[href] ?? ''))
                .map(([href, label]) => (
                  <div className="dict-row" key={href}>
                    <b>{label}</b>
                    <span>{GLOSS[href] ?? ''}</span>
                  </div>
                ))}
              {isAdmin && ADMIN_SUBS.flatMap(([sub, items]) => items.map(([href, label]) => ({ href, label, sub })))
                .filter(({ href }) => href === '/admin' || can(ADMIN_PERMISSION_MAP[href] ?? ''))
                .map(({ href, label, sub }) => (
                  <div className="dict-row" key={href}>
                    <b>{label} <small>· {sub}</small></b>
                    <span>{GLOSS[href] ?? t('بخش مدیریتی — فقط مدیران')}</span>
                  </div>
                ))}
              <div className="dict-row"><b>{t('جستجو و اعلان‌ها')}</b><span>{t('جستجوی سراسری و اعلان‌ها همیشه در نوار بالا در دسترس‌اند.')}</span></div>
            </div>
            <footer className="dict-foot">
              <Link href="/help" onClick={() => setDictOpen(false)}>{t('راهنمای کامل ←')}</Link>
              <span>{t('هر آیتم منو نیز با نگه‌داشتن نشانگر، توضیح کوتاه نشان می‌دهد.')}</span>
            </footer>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}

export function ScopeBadge() {
  const { scopeId, me } = useWorkspace();
  const label = scopeId === 'all' ? t('همه محدوده مجاز') : me?.memberships.find(m => m.organizationId === scopeId)?.organizationName ?? t('محدوده');
  return <span className="scope-badge">محدوده: {label}</span>;
}