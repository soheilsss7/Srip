'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Loading, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  KeySquare, RefreshCw, Search, ShieldCheck, Users, Crown, Inbox, Layers, LockKeyhole, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  مجوزها — ماتریس مجوزهای سامانه و نقش‌های دارنده                     */
/*  بک‌اند: GET /admin/permissions (کاتالوگ + دارندگان)                */
/* ------------------------------------------------------------------ */

type RoleRef = { key: string; name?: string };
type Perm = {
  key: string; name: string; group: string; description?: string;
  rolePermissions?: Array<{ role: RoleRef }>;
};
type Role = { key: string; name: string; isSystem?: boolean; superAdmin?: boolean; holding?: boolean };

const BADGE_TONE = ['info', 'success', 'warning', 'danger', 'neutral'] as const;
type Tone = typeof BADGE_TONE[number];
const GROUPS_FA: Record<string, string> = {
  General: 'عمومی', Core: 'هسته', Meetings: 'جلسات', Work: 'اقدامات و پروژه‌ها',
  Intelligence: 'هوش و تحلیل', Knowledge: 'دانش و جستجو', Account: 'حساب و نشست',
  DataGovernance: 'داده و کیفیت', Security: 'امنیت', Admin: 'مدیریت و یکپارچه‌سازی',
};
const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);
const ROLE_TONE: Record<string, Tone> = {
  SUPER_ADMIN: 'danger', HOLDING_ADMIN: 'info', HOLDING_EXECUTIVE: 'success',
  SUBSIDIARY_ADMIN: 'info', SUBSIDIARY_EXECUTIVE: 'success',
  RELATIONSHIP_MANAGER: 'success', PROJECT_MANAGER: 'success',
  ANALYST: 'warning', STANDARD_USER: 'neutral', READ_ONLY: 'neutral',
};

export default function AdminPermissionsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [perms, setPerms] = useState<Perm[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [onlyUnheld, setOnlyUnheld] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try {
      const [ps, rs] = await Promise.all([
        api<Perm[]>('/admin/permissions'),
        api<Role[]>('/authorization/roles'),
      ]);
      setPerms(unwrap(ps));
      setRoles(unwrap(rs));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const holdersOf = useCallback((p: Perm): RoleRef[] => (p.rolePermissions ?? []).map(rp => rp.role).filter(Boolean), []);
  const roleName = useCallback((key?: string) => {
    if (!key) return '—';
    return roles.find(r => r.key === key)?.name ?? key;
  }, [roles]);

  const stats = useMemo(() => {
    const withH = perms.filter(p => holdersOf(p).length > 0).length;
    const groups = new Set(perms.map(p => p.group));
    return {
      total: perms.length,
      groups: groups.size,
      held: withH,
      unheld: perms.length - withH,
      roles: roles.length,
    };
  }, [perms, roles, holdersOf]);

  const groups = useMemo(() => {
    const order = new Map<string, number>();
    perms.forEach((p, i) => { if (!order.has(p.group)) order.set(p.group, i); });
    const byGroup = new Map<string, Perm[]>();
    for (const p of perms) {
      const arr = byGroup.get(p.group) ?? [];
      arr.push(p); byGroup.set(p.group, arr);
    }
    return [...byGroup.entries()]
      .map(([group, list]) => ({ group, list: list.sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => (order.get(a.group) ?? 0) - (order.get(b.group) ?? 0));
  }, [perms]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups.map(g => ({
      group: g.group,
      list: g.list.filter(p => {
        if (groupFilter && p.group !== groupFilter) return false;
        if (roleFilter && !holdersOf(p).some(h => h.key === roleFilter)) return false;
        if (onlyUnheld && holdersOf(p).length > 0) return false;
        if (term && !`${p.name} ${p.key} ${p.description ?? ''}`.toLowerCase().includes(term)) return false;
        return true;
      }),
    })).filter(g => g.list.length > 0);
  }, [groups, q, groupFilter, roleFilter, onlyUnheld, holdersOf]);

  const visibleTotal = visible.reduce((acc, g) => acc + g.list.length, 0);
  const activeFilters = !!q.trim() || !!groupFilter || !!roleFilter || onlyUnheld;

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / مجوزها" title="مجوزها" description="ماتریس مجوزهای سامانه." />
        <div className="empty-state-v4">
          <div className="empty-ico"><ShieldCheck size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مشاهدهٔ مجوزها به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / مجوزها"
        title="مجوزها"
        description="فهرست کامل مجوزهای سامانه در ۱۰ گروه دسترسی و نقش‌های دارندهٔ هر مجوز — مبنای RBAC و کنترل دسترسی آگاه از محدوده."
        actions={
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
        }
      />
      <ErrorCard message={error} />

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 420 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<KeySquare size={18} />} label="کل مجوزها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در کاتالوگ سرور" />
            <StatCard icon={<Layers size={18} />} label="گروه‌های دسترسی" value={fmtNum(stats.groups)} iconClass="ic-teal" sub="هسته، جلسات، امنیت و…" />
            <StatCard icon={<Users size={18} />} label="دارای دارنده" value={fmtNum(stats.held)} iconClass="ic-gold" sub="حداقل یک نقش" />
            <StatCard icon={<Inbox size={18} />} label="بدون دارنده" value={fmtNum(stats.unheld)} iconClass="ic-red" sub="به هیچ نقشی واگذار نشده" />
            <StatCard icon={<ShieldCheck size={18} />} label="نقش‌ها" value={fmtNum(stats.roles)} iconClass="ic-teal" sub="سیستمی و سفارشی" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام یا کلید مجوز…">
            <select aria-label="فیلتر گروه" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ گروه‌ها</option>
              {groups.map(g => <option key={g.group} value={g.group}>{GROUPS_FA[g.group] ?? g.group}</option>)}
            </select>
            <select aria-label="فیلتر نقش دارنده" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="toolbar-select">
              <option value="">دارای هر نقش</option>
              {roles.map(r => <option key={r.key} value={r.key}>{r.superAdmin ? '👑 ' : ''}{r.name}</option>)}
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={onlyUnheld} onChange={e => setOnlyUnheld(e.target.checked)}
                style={{ width: 'auto' }}
              />
              فقط بدون دارنده
            </label>
            {activeFilters && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setGroupFilter(''); setRoleFilter(''); setOnlyUnheld(false); }}>
                <X size={13} /> حذف فیلترها
              </button>
            )}
            <span className="chip info">{fmtNum(visibleTotal)} مجوز</span>
          </Toolbar>

          {visible.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>مجوزی یافت نشد</strong>
              <p>فیلترها یا عبارت جستجو را تغییر دهید.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visible.map(g => {
                const heldInGroup = g.list.filter(p => holdersOf(p).length > 0).length;
                return (
                  <section className="section-card" key={g.group}>
                    <div className="section-head">
                      <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {GROUPS_FA[g.group] ?? g.group}
                          <span className="chip info">{fmtNum(heldInGroup)}/{fmtNum(g.list.length)} دارای دارنده</span>
                        </h2>
                        <p className="t-muted" style={{ fontSize: 12, direction: 'ltr', textAlign: 'right' }}>{g.group}</p>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>مجوز</th>
                            <th style={{ width: 320 }}>دارندگان (نقش‌ها)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.list.map(p => {
                            const holders = holdersOf(p);
                            return (
                              <tr key={p.key}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                      width: 30, height: 30, borderRadius: 9, flex: '0 0 auto',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      background: 'var(--srip-accent-soft, rgba(9,105,218,.12))',
                                      color: 'var(--srip-accent)', fontSize: 11,
                                    }}><KeySquare size={14} /></span>
                                    <div>
                                      <b className="t-primary">{p.name}</b>
                                      <div className="t-muted" style={{ fontSize: 11 }}>{p.description}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <code dir="ltr" style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,Menlo,monospace' }}>{p.key}</code>
                                  </div>
                                </td>
                                <td>
                                  {holders.length === 0 ? (
                                    <Badge tone="warning">بدون دارنده</Badge>
                                  ) : (
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                      {holders.map(h => (
                                        <button
                                          key={h.key}
                                          className={`chip ${ROLE_TONE[h.key] ?? ''}`}
                                          style={{ cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
                                          title={h.key}
                                          onClick={() => setRoleFilter(h.key)}
                                        >
                                          {h.key === 'SUPER_ADMIN' && <Crown size={10} />} {h.name ?? roleName(h.key)}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
