'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  ShieldCheck, UserCog, RefreshCw, Search, Plus, X, Crown, KeySquare,
  CheckCircle2, LockKeyhole, Layers, Users, Save, Ban, Briefcase, CheckSquare, Square,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  نقش‌ها و مجوزها — RBAC (پاریتی با /authorization/roles واقعی)      */
/* ------------------------------------------------------------------ */

type Perm = { key: string; name: string; group: string };
type Role = {
  id: string; key: string; name: string; description?: string | null;
  isSystem: boolean; holding?: boolean; superAdmin?: boolean;
  permissionCount: number;
  rolePermissions?: Array<{ permission: Perm }>;
};
type AdminUser = { id: string; memberships?: Array<{ role: string }> };

const BADGE_TONE = ['info', 'success', 'warning', 'danger', 'neutral'] as const;
type Tone = typeof BADGE_TONE[number];
const GROUPS_FA: Record<string, string> = {
  General: 'عمومی', Core: 'هسته', Meetings: 'جلسات', Work: 'اقدامات و پروژه‌ها',
  Intelligence: 'هوش و تحلیل', Knowledge: 'دانش و جستجو', Account: 'حساب و نشست',
  DataGovernance: 'داده و کیفیت', Security: 'امنیت', Admin: 'مدیریت و یکپارچه‌سازی',
};
const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);
const sortedKeys = (set: Set<string>) => [...set].sort();

export default function AdminRolesPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editorRole, setEditorRole] = useState<Role | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [permQ, setPermQ] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try {
      const [rs, ps, us] = await Promise.all([
        api<Role[]>('/authorization/roles'),
        api<Perm[]>('/admin/permissions'),
        api<AdminUser[]>('/admin/users'),
      ]);
      setRoles(unwrap(rs));
      setPerms(unwrap(ps));
      setUsers(unwrap(us));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) for (const mb of u.memberships ?? []) m.set(mb.role, (m.get(mb.role) ?? 0) + 1);
    return m;
  }, [users]);
  const usageOf = (key: string) => usage.get(key) ?? 0;

  const stats = useMemo(() => ({
    total: roles.length,
    system: roles.filter(r => r.isSystem).length,
    custom: roles.filter(r => !r.isSystem).length,
    inUse: roles.filter(r => usageOf(r.key) > 0).length,
  }), [roles, usage]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const order: Record<string, number> = {};
    perms.forEach((p, i) => { if (!(p.group in order)) order[p.group] = i; });
    const map = new Map<string, Perm[]>();
    for (const p of perms) {
      const arr = map.get(p.group) ?? [];
      arr.push(p); map.set(p.group, arr);
    }
    return [...map.entries()]
      .map(([g, list]) => ({ group: g, list: list.sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => (order[a.group] ?? 0) - (order[b.group] ?? 0));
  }, [perms]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return roles.filter(r => {
      if (typeFilter === 'system' && !r.isSystem) return false;
      if (typeFilter === 'custom' && r.isSystem) return false;
      if (typeFilter === 'unused' && usageOf(r.key) > 0) return false;
      if (term && !`${r.key} ${r.name} ${r.description ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [roles, q, typeFilter, usage]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCreate = () => {
    setError(''); setFormError('');
    setForm({ key: '', name: '', description: '' });
    setCreateOpen(true);
  };

  async function createRole(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const created = await api<Role>('/authorization/roles', {
        method: 'POST',
        body: JSON.stringify({
          key: form.key.trim(), name: form.name.trim(), description: form.description.trim() || null,
          permissions: [],
        }),
      });
      setCreateOpen(false);
      setFlash(`نقش «${form.key.trim().toUpperCase()}» ساخته شد — اکنون مجوزهایش را تعیین کنید.`);
      setRoles(list => [...list.filter(r => r.key !== created.key), created]);
      setEditorRole(created);
      setSelected(new Set());
      setPermQ(''); setEditError('');
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  function openEditor(role: Role) {
    setError(''); setEditError(''); setPermQ('');
    setSelected(new Set((role.rolePermissions ?? []).map(rp => rp.permission.key).filter(k => k !== '*')));
    setEditorRole(role);
  }

  async function savePermissions() {
    if (!editorRole || editorRole.isSystem) return;
    setEditSaving(true); setEditError('');
    try {
      const updated = await api<Role>(`/authorization/roles/${encodeURIComponent(editorRole.key)}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: sortedKeys(selected) }),
      });
      setFlash(`مجوزهای «${editorRole.name}» به‌روزرسانی شد (${fmtNum(updated.permissionCount)} مجوز).`);
      setEditorRole(null);
      await load();
    } catch (x) { setEditError((x as Error).message); }
    finally { setEditSaving(false); }
  }

  const visiblePerms = useMemo(() => {
    const term = permQ.trim().toLowerCase();
    if (!term) return groups;
    return groups.map(g => ({
      group: g.group,
      list: g.list.filter(p => `${p.name} ${p.key}`.toLowerCase().includes(term)),
    })).filter(g => g.list.length);
  }, [groups, permQ]);

  const toggleAll = (list: Perm[], on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      list.forEach(p => { if (on) next.add(p.key); else next.delete(p.key); });
      return next;
    });
  };

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / نقش‌ها" title="نقش‌ها و مجوزها" description="مدیریت نقش‌ها و مجوزهای هر نقش (RBAC)." />
        <div className="empty-state-v4">
          <div className="empty-ico"><ShieldCheck size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت نقش‌ها به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / نقش‌ها"
        title="نقش‌ها و مجوزها"
        description="نقش‌های سیستمی و سفارشی، مجوزهای هر نقش و تعداد کاربرانِ دارندهٔ هر نقش — اعمال‌شده روی سرور."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={startCreate}><Plus size={16} /> نقش جدید</button>
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
            <StatCard icon={<ShieldCheck size={18} />} label="کل نقش‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در کاتالوگ دسترسی" />
            <StatCard icon={<LockKeyhole size={18} />} label="سیستمی" value={fmtNum(stats.system)} iconClass="ic-teal" sub="مجوزهای ثابت و استاندارد" />
            <StatCard icon={<UserCog size={18} />} label="سفارشی" value={fmtNum(stats.custom)} iconClass="ic-gold" sub="ساخته‌شده توسط مدیریت" />
            <StatCard icon={<Users size={18} />} label="در استفاده" value={fmtNum(stats.inUse)} iconClass="ic-red" sub="دارای کاربر فعال" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی کلید، نام یا توضیح نقش…">
            <select aria-label="فیلتر نوع" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ نقش‌ها</option>
              <option value="system">سیستمی</option>
              <option value="custom">سفارشی</option>
              <option value="unused">بدون استفاده</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} نقش</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>نتیجه‌ای یافت نشد</strong>
              <p>عبارت جستجو یا فیلترها را تغییر دهید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>نقش</th>
                    <th>نوع</th>
                    <th>مجوزها</th>
                    <th>کاربران</th>
                    <th style={{ width: 120 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const list = (r.rolePermissions ?? []).map(rp => rp.permission).filter(p => p.key !== '*');
                    const shown = list.slice(0, 4);
                    return (
                      <tr key={r.key}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 30, height: 30, borderRadius: 9, flex: '0 0 auto',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: 'var(--srip-accent-soft, rgba(9,105,218,.12))',
                              color: 'var(--srip-accent)', fontSize: 12,
                            }}>{r.superAdmin ? <Crown size={15} /> : <KeySquare size={15} />}</span>
                            <div>
                              <span className="t-primary" style={{ fontWeight: 800, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{r.key}</span>
                              <span style={{ fontWeight: 700, marginInlineStart: 8 }}>{r.name}</span>
                              {r.holding && <span className="t-muted" style={{ marginInlineStart: 6, fontSize: 11 }}>· هلدینگ</span>}
                              {r.description && <div className="t-muted" style={{ fontSize: 11.5, maxWidth: 300 }}>{r.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {r.superAdmin ? (
                            <Badge tone="danger"><Crown size={11} /> مالک</Badge>
                          ) : r.isSystem ? (
                            <Badge tone="info"><LockKeyhole size={11} /> سیستمی</Badge>
                          ) : (
                            <Badge tone="success"><UserCog size={11} /> سفارشی</Badge>
                          )}
                        </td>
                        <td>
                          {list.length === 0 ? <span className="t-muted">—</span> : (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', maxWidth: 360 }}>
                              {shown.map(p => <span key={p.key} className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }}>{p.name}</span>)}
                              {list.length > shown.length && <span className="t-muted" style={{ fontSize: 11 }}>+ {fmtNum(list.length - shown.length)}</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="cell-count"><Briefcase size={12} /> {fmtNum(usageOf(r.key))}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditor(r)} disabled={loading}>
                              <Layers size={13} /> مجوزها
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

      {/* ---------- create role ---------- */}
      <Modal
        open={createOpen}
        title="ساخت نقش جدید"
        description="نقش سفارشی با کلید یکتا ساخته می‌شود؛ سپس مجوزهایش را انتخاب می‌کنید."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="role-create-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />} ساخت نقش
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="role-create-form" className="entity-form org-form" onSubmit={createRole}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">کلید نقش <i className="req">*</i></span>
              <input
                dir="ltr" style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace' }}
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="REGIONAL_MANAGER" required minLength={3} maxLength={64}
              />
              <small className="t-muted">لاتین؛ ۳ تا ۶۴ کاراکتر؛ فقط A-Z، 0-9 و _ — SUPER_ADMIN رزرو است.</small>
            </label>
            <label className="field">
              <span className="field-label">نام نمایشی <i className="req">*</i></span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثلاً: مدیر منطقه" required />
            </label>
            <label className="field full">
              <span className="field-label">توضیح</span>
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="اختیاری — این نقش برای چه کسانی است؟" />
            </label>
          </div>
        </form>
      </Modal>

      {/* ---------- permission editor / viewer ---------- */}
      <Modal
        open={!!editorRole}
        title={`مجوزهای نقش ${editorRole?.key ?? ''}`}
        description={editorRole ? `${editorRole.name}${editorRole.isSystem ? ' — نقش سیستمی؛ مجوزها ثابت و فقط نمایشی است.' : ' — نقش سفارشی؛ مجوزها را می‌توانید تغییر دهید.'}` : ''}
        onClose={() => setEditorRole(null)}
        footer={editorRole && !editorRole.isSystem ? (
          <>
            <span className="chip info" style={{ marginInlineEnd: 'auto' }}>{fmtNum(selected.size)} مجوز انتخاب شده</span>
            <button type="button" className="btn btn-secondary" onClick={() => setEditorRole(null)}><X size={14} /> انصراف</button>
            <button type="button" className="btn btn-primary" onClick={savePermissions} disabled={editSaving}>
              {editSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} ذخیرهٔ مجوزها
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setEditorRole(null)}><X size={14} /> بستن</button>
        )}
      >
        {editorRole && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {editorRole.superAdmin
                ? <Badge tone="danger"><Crown size={11} /> مالک — دسترسی کامل</Badge>
                : editorRole.isSystem
                  ? <Badge tone="info"><LockKeyhole size={11} /> سیستمی</Badge>
                  : <Badge tone="success"><UserCog size={11} /> سفارشی</Badge>}
              <Badge tone="neutral">{fmtNum(editorRole.permissionCount)} مجوز</Badge>
            </div>

            {!editorRole.superAdmin && !editorRole.isSystem && (
              <label className="toolbar-sort" style={{ marginBottom: 8, display: 'flex' }}>
                <Search size={14} />
                <input
                  style={{ minWidth: 0, flex: 1 }}
                  className="inline-input"
                  value={permQ}
                  onChange={e => setPermQ(e.target.value)}
                  placeholder="جستجوی مجوز…"
                />
              </label>
            )}

            <ErrorCard message={editError} />

            {editorRole.superAdmin ? (
              <div className="empty-state-v4" style={{ padding: '14px 10px' }}>
                <div className="empty-ico"><Crown size={22} /></div>
                <strong>دسترسی کامل (همهٔ مجوزها)</strong>
                <p>نقش مالک شامل همهٔ مجوزهای سامانه است و قابل ویرایش نیست.</p>
              </div>
            ) : editorRole.isSystem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflow: 'auto', paddingLeft: 2 }}>
                {groups.map(g => {
                  const owned = g.list.filter(p => selected.has(p.key));
                  if (!owned.length) return null;
                  return (
                    <div key={g.group}>
                      <div className="panel-title"><h3>{GROUPS_FA[g.group] ?? g.group} <span className="chip" style={{ marginInlineStart: 6 }}>{fmtNum(owned.length)}</span></h3></div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {owned.map(p => <span key={p.key} className="chip" style={{ fontSize: 11 }}>{p.name}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflow: 'auto', paddingLeft: 2 }}>
                {visiblePerms.map(g => (
                  <div key={g.group}>
                    <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>{GROUPS_FA[g.group] ?? g.group} <span className="chip" style={{ marginInlineStart: 6 }}>{fmtNum(g.list.filter(p => selected.has(p.key)).length)}/{fmtNum(g.list.length)}</span></h3>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleAll(g.list, true)}><CheckSquare size={12} /> همه</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleAll(g.list, false)}><Square size={12} /> هیچ</button>
                      </span>
                    </div>
                    <div className="perm-grid">
                      {g.list.map(p => {
                        const on = selected.has(p.key);
                        return (
                          <label key={p.key} className={`perm-item ${on ? 'perm-on' : ''}`}>
                            <input
                              type="checkbox" checked={on}
                              onChange={e => setSelected(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(p.key); else next.delete(p.key);
                                return next;
                              })}
                            />
                            <span className="perm-txt">
                              <b>{p.name}</b>
                              <code dir="ltr">{p.key}</code>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {visiblePerms.length === 0 && (
                  <div className="empty-state-v4"><div className="empty-ico"><Search size={20} /></div><strong>مجوزی یافت نشد</strong></div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </main>
  );
}
