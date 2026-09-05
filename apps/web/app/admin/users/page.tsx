'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { useWorkspace } from '../../_components/workspace';
import { Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar } from '../../_components/page-ui';
import {
  Users, UserPlus, RefreshCw, Search, ShieldCheck, ShieldOff, KeyRound,
  Building2, Star, X, CheckCircle2, MailQuestion, Ban, Layers, UserCheck, LockKeyhole, Plus, Trash2, Crown, ArrowLeft,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  مدیریت کاربران و دسترسی‌ها — مالک سامانه                            */
/*  بک‌اند: /admin/users · /admin/users/:id/active                    */
/*          /authorization/roles · /authorization/memberships         */
/* ------------------------------------------------------------------ */

type Membership = {
  id: string;
  organizationId: string;
  role: string;
  department?: string | null;
  dataScope?: string;
  accessScope?: string;
  isPrimary?: boolean;
};
type AdminUser = {
  id: string; email: string; name: string;
  isActive: boolean; emailVerifiedAt?: string | null;
  lastLoginAt?: string | null; createdAt?: string | null;
  memberships: Membership[];
};
type Org = { id: string; name: string; type?: string };
type Role = { id: string; key: string; name: string; description?: string; holding?: boolean };

const BADGE_TONE = ['info', 'success', 'warning', 'danger', 'neutral'] as const;
type BADGE_TONE = typeof BADGE_TONE[number];
const ROLE_TONE: Record<string, BADGE_TONE> = {
  SUPER_ADMIN: 'info', HOLDING_ADMIN: 'info', HOLDING_EXECUTIVE: 'success',
  SUBSIDIARY_ADMIN: 'info', SUBSIDIARY_EXECUTIVE: 'success',
  RELATIONSHIP_MANAGER: 'success', PROJECT_MANAGER: 'success',
  ANALYST: 'warning', STANDARD_USER: 'neutral', READ_ONLY: 'neutral',
};
const SCOPE_FA: Record<string, string> = {
  ALL: 'کل شبکه', ORGANIZATION: 'سازمان', DEPARTMENT: 'واحد', OWNED: 'تحت مالکیت', INTERNAL: 'داخلی',
};
const FALLBACK_ROLE_FA: Record<string, string> = {
  SUPER_ADMIN: 'مدیر کل سیستم', HOLDING_ADMIN: 'مدیر هلدینگ', HOLDING_EXECUTIVE: 'مدیر ارشد هلدینگ',
  SUBSIDIARY_ADMIN: 'مدیر شرکت', SUBSIDIARY_EXECUTIVE: 'مدیر ارشد شرکت',
  RELATIONSHIP_MANAGER: 'مدیر روابط', PROJECT_MANAGER: 'مدیر پروژه', ANALYST: 'تحلیلگر',
  STANDARD_USER: 'کاربر استاندارد', READ_ONLY: 'فقط خواندنی',
};
const TONE_ANY: BADGE_TONE = 'info';
const fmtNum = (v: number | undefined | null): string => v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string => iso ? new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' }) : '—';
const fmtDT = (iso?: string | null): string => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('');

export default function AdminUsersPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [q, setQ] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<{ id: string; op: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [memberForm, setMemberForm] = useState({ organizationId: '', role: '', department: '', accessScope: 'ORGANIZATION', isPrimary: false });
  const [memberError, setMemberError] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);

  const roleName = useMemo(() => {
    const m: Record<string, string> = { ...FALLBACK_ROLE_FA };
    for (const r of roles) if (r?.name) m[r.key] = r.name;
    return m;
  }, [roles]);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try {
      const [us, os, rs] = await Promise.all([
        api<AdminUser[]>('/admin/users'),
        api<Org[]>('/organizations'),
        api<Role[]>('/authorization/roles'),
      ]);
      setUsers(unwrap(us));
      setOrgs(unwrap(os));
      setRoles(unwrap(rs));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const roleNameOf = (key?: string) => (key ? roleName[key] ?? fa(key) : '—');
  const orgNameOf = (id?: string) => orgs.find(o => o.id === id)?.name ?? id ?? '—';

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    noAccess: users.filter(u => !(u.memberships?.length)).length,
  }), [users]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter(u => {
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (statusFilter === 'noaccess' && (u.memberships?.length ?? 0) > 0) return false;
      if (orgFilter && !(u.memberships ?? []).some(m => m.organizationId === orgFilter)) return false;
      if (roleFilter && !(u.memberships ?? []).some(m => m.role === roleFilter)) return false;
      if (term && !`${u.email ?? ''} ${u.name ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [users, q, orgFilter, roleFilter, statusFilter]);

  const accessUser = accessUserId ? users.find(u => u.id === accessUserId) ?? null : null;

  const startCreate = () => { setError(''); setFormError(''); setCreateForm({ name: '', email: '', password: '' }); setCreateOpen(true); };

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const r = await api<{ id: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: createForm.name.trim(), email: createForm.email.trim().toLowerCase(), password: createForm.password }),
      });
      const newId = r?.id;
      setCreateOpen(false);
      setFlash(`حساب «${createForm.email.trim().toLowerCase()}» ساخته شد — حالا دسترسی اولیه را اعطا کنید.`);
      setUsers(u => [{ ...({ id: newId, email: createForm.email.trim().toLowerCase(), name: createForm.name.trim(), isActive: true, emailVerifiedAt: null, lastLoginAt: null, createdAt: null, memberships: [] }) }, ...u]);
      setAccessUserId(newId ?? null);
      setMemberForm({ organizationId: '', role: '', department: '', accessScope: 'ORGANIZATION', isPrimary: true });
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  function openAccess(user: AdminUser) {
    setError(''); setMemberError('');
    setAccessUserId(user.id);
    setMemberForm({ organizationId: '', role: '', department: '', accessScope: 'ORGANIZATION', isPrimary: !(user.memberships?.length) });
  }

  async function toggleActive(user: AdminUser) {
    if (busy) return;
    const target = !user.isActive;
    if (user.isActive && !confirm(`حساب «${user.email}» غیرفعال شود؟\nاین کاربر دیگر نمی‌تواند وارد سامانه شود.`)) return;
    setBusy({ id: user.id, op: 'toggle' });
    try {
      await api(`/admin/users/${encodeURIComponent(user.id)}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: target }),
      });
      setUsers(list => list.map(u => u.id === user.id ? { ...u, isActive: target } : u));
      setFlash(target ? 'حساب فعال شد.' : 'حساب غیرفعال شد و ورود آن مسدود گردید.');
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function addMembership(e: React.FormEvent) {
    e.preventDefault();
    if (!accessUser) return;
    setMemberSaving(true); setMemberError('');
    try {
      await api('/authorization/memberships', {
        method: 'POST',
        body: JSON.stringify({ userId: accessUser.id, ...memberForm }),
      });
      setFlash('دسترسی جدید ثبت و نقش‌ها/محدوده‌ها بازمحاسبه شد.');
      setMemberForm({ organizationId: '', role: '', department: '', accessScope: 'ORGANIZATION', isPrimary: false });
      setAccessUserId(null);
      await load();
    } catch (x) { setMemberError((x as Error).message); }
    finally { setMemberSaving(false); }
  }

  async function revokeMembership(user: AdminUser, m: Membership) {
    if (busy) return;
    if (!confirm(`دسترسی «${orgNameOf(m.organizationId)} — ${roleNameOf(m.role)}» از «${user.email}» حذف شود؟`)) return;
    setBusy({ id: m.id, op: 'revoke' });
    try {
      await api(`/authorization/memberships/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      setFlash('دسترسی حذف شد و محدودهٔ دادهٔ کاربر بازمحاسبه گردید.');
      setAccessUserId(null);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  /* ---------- permission gate (double safety; backend also enforces) ---------- */
  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / کاربران" title="کاربران و دسترسی‌ها" description="مدیریت حساب‌ها، عضویت سازمانی و نقش‌ها." />
        <div className="empty-state-v4">
          <div className="empty-ico"><ShieldOff size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت کاربران به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / کاربران"
        title="کاربران و دسترسی‌ها"
        description="حساب‌ها، عضویت سازمانی، نقش‌ها و محدودهٔ داده — هم‌راستا با سرویس‌های مدیریتی سرور."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={startCreate}><UserPlus size={16} /> کاربر جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 380 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Users size={18} />} label="کل کاربران" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در سامانه" />
            <StatCard icon={<UserCheck size={18} />} label="فعال" value={fmtNum(stats.active)} iconClass="ic-teal" sub="می‌توانند وارد شوند" />
            <StatCard icon={<Ban size={18} />} label="غیرفعال" value={fmtNum(stats.inactive)} iconClass="ic-red" sub="ورود مسدود است" />
            <StatCard icon={<Layers size={18} />} label="بدون دسترسی" value={fmtNum(stats.noAccess)} iconClass="ic-gold" sub="نیازمند اعطای عضویت" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام یا ایمیل…">
            <select aria-label="فیلتر سازمان" value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ سازمان‌ها</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select aria-label="فیلتر نقش" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ نقش‌ها</option>
              {roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
              <option value="noaccess">بدون دسترسی</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} کاربر</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>{users.length === 0 ? 'کاربری ثبت نشده است' : 'نتیجه‌ای یافت نشد'}</strong>
              <p>{users.length === 0 ? 'با «کاربر جدید» نخستین حساب را بسازید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>عضویت‌ها (سازمان · نقش)</th>
                    <th>وضعیت</th>
                    <th>آخرین ورود</th>
                    <th>ایجاد</th>
                    <th style={{ width: 150 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const isSelf = u.id === me?.id;
                    const primary = u.memberships?.find(m => m.isPrimary);
                    const shown = u.memberships?.slice(0, 2) ?? [];
                    const rest = (u.memberships?.length ?? 0) - shown.length;
                    return (
                      <tr key={u.id} className={u.isActive ? '' : 'row-muted'}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 34, height: 34, borderRadius: 10, flex: '0 0 auto',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: 'var(--srip-accent-soft, rgba(9,105,218,.12))',
                              color: 'var(--srip-accent)', fontWeight: 800, fontSize: 13,
                            }}>{initials(u.name || u.email)}</span>
                            <div>
                              <span className="t-primary" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {u.name || '—'}
                                {u.emailVerifiedAt ? <CheckCircle2 size={13} color="var(--ok, #0a8f5c)" aria-label="ایمیل تأیید شده" /> : <MailQuestion size={13} className="t-muted" aria-label="ایمیل تأیید نشده" />}
                                {isSelf && <Badge tone="info">حساب جاری</Badge>}
                                {u.memberships?.some(m => m.role === 'SUPER_ADMIN') && <Crown size={13} color="var(--srip-accent)" />}
                              </span>
                              <div className="t-muted" dir="ltr" style={{ textAlign: 'right', fontSize: 11.5 }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {shown.length === 0 ? (
                            <Badge tone="warning">بدون دسترسی</Badge>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                              {shown.map(m => (
                                <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <Building2 size={12} className="t-muted" />
                                  <span className="t-primary" style={{ fontSize: 12 }}>{orgNameOf(m.organizationId)}</span>
                                  <Badge tone={ROLE_TONE[m.role] ?? TONE_ANY}>{roleNameOf(m.role)}</Badge>
                                  {m.isPrimary && <Star size={12} fill="#f5b301" color="#f5b301" aria-label="عضویت اصلی" />}
                                </span>
                              ))}
                              {rest > 0 && <span className="t-muted" style={{ fontSize: 11.5 }}>+ {fmtNum(rest)} عضویت دیگر</span>}
                              <span className="t-muted" style={{ fontSize: 10.5 }}>
                                {primary ? `${SCOPE_FA[primary.accessScope ?? ''] ?? primary.accessScope ?? ''}${primary.department ? ` · ${primary.department}` : ''}` : ''}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          {u.isActive
                            ? <Badge tone="success">فعال</Badge>
                            : <Badge tone="neutral">غیرفعال</Badge>}
                        </td>
                        <td><span className="cell-count"><LockKeyhole size={12} /> {u.lastLoginAt ? fmtDT(u.lastLoginAt) : <span className="t-muted">—</span>}</span></td>
                        <td><span className="t-muted" style={{ fontSize: 12 }}>{u.createdAt ? fmtDate(u.createdAt) : '—'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" title="مدیریت دسترسی‌ها" onClick={() => openAccess(u)} disabled={!!busy}>
                              <KeyRound size={13} /> دسترسی‌ها
                            </button>
                            <button
                              className={`btn btn-sm ${u.isActive ? 'btn-ghost' : 'btn-ghost'}`}
                              title={u.isActive ? 'غیرفعال‌سازی حساب' : 'فعال‌سازی حساب'}
                              onClick={() => toggleActive(u)}
                              disabled={!!busy || (isSelf && u.isActive)}
                              style={u.isActive ? { color: 'var(--danger, #c0392b)' } : { color: 'var(--ok, #0a8f5c)' }}
                            >
                              {busy?.id === u.id && busy.op === 'toggle' ? <RefreshCw size={13} className="spin" /> : u.isActive ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------------- create user ---------------- */}
      <Modal
        open={createOpen}
        title="ساخت کاربر جدید"
        description="حساب ساخته می‌شود؛ در گام بعد دسترسی سازمانی (نقش و محدوده) اعطا می‌کنید."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="admin-user-create" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <UserPlus size={14} />} ساخت حساب
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="admin-user-create" className="entity-form org-form" onSubmit={createUser}>
          <div className="form-grid">
            <label className="field full">
              <span className="field-label">نام و نام خانوادگی <i className="req">*</i></span>
              <input autoFocus value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required placeholder="مثلاً: نگار احمدی" />
            </label>
            <label className="field full">
              <span className="field-label">ایمیل سازمانی <i className="req">*</i></span>
              <input type="email" dir="ltr" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required placeholder="name@company.ir" style={{ textAlign: 'left' }} />
            </label>
            <label className="field full">
              <span className="field-label">رمز عبور موقت <i className="req">*</i></span>
              <input type="password" dir="ltr" minLength={12} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required placeholder="حداقل ۱۲ کاراکتر" style={{ textAlign: 'left' }} />
              <small className="t-muted">حداقل ۱۲ کاراکتر — کاربر پس از نخستین ورود می‌تواند آن را تغییر دهد.</small>
            </label>
          </div>
        </form>
      </Modal>

      {/* ---------------- access management ---------------- */}
      <Modal
        open={!!accessUser}
        title={`دسترسی‌های ${accessUser?.name ?? ''}`}
        description={accessUser ? `اعضای سازمانی، نقش و محدودهٔ داده — برای ${accessUser.email}` : ''}
        onClose={() => setAccessUserId(null)}
        footer={null}
      >
        {accessUser && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {accessUser.isActive ? <Badge tone="success">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}
              {!accessUser.emailVerifiedAt && <Badge tone="warning">ایمیل تأیید نشده</Badge>}
              <Badge tone="info">{fmtNum(accessUser.memberships?.length ?? 0)} عضویت</Badge>
            </div>

            <div className="panel-title"><h3>عضویت‌های فعلی</h3></div>
            {(accessUser.memberships ?? []).length === 0 ? (
              <div className="empty-state-v4" style={{ padding: '14px 8px' }}>
                <div className="empty-ico"><KeyRound size={20} /></div>
                <strong>هنوز دسترسی‌ای ندارد</strong>
                <p>با فرم پایین نخستین عضویت را اعطا کنید.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {(accessUser.memberships ?? []).map(m => {
                  const blocked = isSelfGuardRevoke(accessUser, m, me?.id);
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                      border: '1px solid var(--card-border, #e3e8f0)', borderRadius: 12, padding: '8px 12px',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Building2 size={14} className="t-muted" />
                        <b className="t-primary" style={{ fontSize: 13 }}>{orgNameOf(m.organizationId)}</b>
                        <Badge tone={ROLE_TONE[m.role] ?? TONE_ANY}>{roleNameOf(m.role)}</Badge>
                        {m.isPrimary && <Star size={13} fill="#f5b301" color="#f5b301" aria-label="عضویت اصلی" />}
                        <span className="t-muted" style={{ fontSize: 11 }}>
                          {SCOPE_FA[m.accessScope ?? ''] ?? m.accessScope ?? ''}{m.department ? ` · ${m.department}` : ''}
                        </span>
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger, #c0392b)' }}
                        title={blocked ? 'حذف عضویت اصلی حساب جاری ممکن نیست' : 'حذف این دسترسی'}
                        disabled={!!busy || blocked}
                        onClick={() => revokeMembership(accessUser, m)}
                      >
                        {busy?.id === m.id && busy.op === 'revoke' ? <RefreshCw size={13} className="spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="panel-title"><h3>اعطای دسترسی جدید</h3></div>
            <ErrorCard message={memberError} />
            <form className="entity-form org-form" onSubmit={addMembership} style={{ marginTop: 4 }}>
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">سازمان <i className="req">*</i></span>
                  <select required value={memberForm.organizationId} onChange={e => setMemberForm(f => ({ ...f, organizationId: e.target.value }))}>
                    <option value="">انتخاب سازمان…</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">نقش <i className="req">*</i></span>
                  <select required value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="">انتخاب نقش…</option>
                    {roles.filter(r => r.key !== 'SUPER_ADMIN').map(r => (
                      <option key={r.key} value={r.key}>{r.name}</option>
                    ))}
                  </select>
                  <small className="t-muted">نقش SUPER_ADMIN فقط به مالک تعلق دارد.</small>
                </label>
                <label className="field">
                  <span className="field-label">محدودهٔ داده</span>
                  <select value={memberForm.accessScope} onChange={e => setMemberForm(f => ({ ...f, accessScope: e.target.value }))}>
                    <option value="ORGANIZATION">سازمان</option>
                    <option value="ALL">کل شبکه (هلدینگ)</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">واحد / دپارتمان</span>
                  <input value={memberForm.department} onChange={e => setMemberForm(f => ({ ...f, department: e.target.value }))} placeholder="اختیاری — مثلاً: فروش" />
                </label>
                <label className="field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={memberForm.isPrimary} onChange={e => setMemberForm(f => ({ ...f, isPrimary: e.target.checked }))} style={{ width: 'auto' }} />
                  <span>این عضویت، عضویت اصلی کاربر باشد</span>
                </label>
              </div>
              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={memberSaving || !!busy}>
                  {memberSaving ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />} اعطای دسترسی
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </main>
  );
}

function isSelfGuardRevoke(user: AdminUser, m: Membership, meId?: string): boolean {
  return !!meId && user.id === meId && !!m.isPrimary;
}
