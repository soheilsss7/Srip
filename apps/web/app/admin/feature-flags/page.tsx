'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  Flag, RefreshCw, Search, Plus, X, CheckCircle2, Power, Percent,
  Rocket, PauseCircle, Gauge, Settings2, Trash2, SlidersHorizontal,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  پرچم‌های ویژگی — فعال‌سازی کنترل‌شدهٔ قابلیت‌ها                      */
/*  بک‌اند: GET/POST /enterprise/feature-flags (upsert واقعی)          */
/* ------------------------------------------------------------------ */

type FlagItem = {
  id: string; key: string; enabled: boolean;
  rollout: number; description?: string | null;
  createdAt?: string | null;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.flags ?? []);
const flagName = (key: string): string => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export default function AdminFeatureFlagsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FlagItem | null>(null);
  const [form, setForm] = useState({ key: '', description: '', rollout: '100', enabled: true });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setFlags(unwrap(await api<FlagItem[]>('/enterprise/feature-flags'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: flags.length,
    on: flags.filter(f => f.enabled).length,
    off: flags.filter(f => !f.enabled).length,
    full: flags.filter(f => f.enabled && f.rollout >= 100).length,
    partial: flags.filter(f => f.enabled && f.rollout < 100).length,
  }), [flags]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return flags.filter(f => {
      if (statusFilter === 'on' && !f.enabled) return false;
      if (statusFilter === 'off' && f.enabled) return false;
      if (statusFilter === 'partial' && !(f.enabled && f.rollout < 100)) return false;
      if (term && !`${f.key} ${f.description ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => a.key.localeCompare(b.key));
  }, [flags, q, statusFilter]);

  const beginCreate = () => {
    setError(''); setFormError('');
    setEditing(null);
    setForm({ key: '', description: '', rollout: '100', enabled: true });
    setOpen(true);
  };
  const beginEdit = (f: FlagItem) => {
    setError(''); setFormError('');
    setEditing(f);
    setForm({ key: f.key, description: f.description ?? '', rollout: String(f.rollout), enabled: f.enabled });
    setOpen(true);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const rollout = Number(form.rollout);
    if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) { setFormError('درصد rollout باید بین ۰ تا ۱۰۰ باشد.'); setSaving(false); return; }
    try {
      const saved = await api<FlagItem>('/enterprise/feature-flags', {
        method: 'POST',
        body: JSON.stringify({
          key: form.key.trim(), enabled: form.enabled, rollout,
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
        }),
      });
      setFlags(list => [...list.filter(f => f.id !== saved.id), saved].sort((a, b) => a.key.localeCompare(b.key)));
      setOpen(false);
      setFlash(editing
        ? `پرچم «${saved.key}» به‌روزرسانی شد (${saved.enabled ? 'فعال' : 'غیرفعال'} · rollout ${fmtNum(saved.rollout)}٪).`
        : `پرچم «${saved.key}» ساخته شد.`);
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function toggle(f: FlagItem, enabled: boolean) {
    if (busy) return;
    setBusy(f.id);
    try {
      const saved = await api<FlagItem>('/enterprise/feature-flags', {
        method: 'POST',
        body: JSON.stringify({ key: f.key, enabled, rollout: f.rollout, ...(f.description ? { description: f.description } : {}) }),
      });
      setFlags(list => list.map(x => x.id === f.id ? saved : x));
      setFlash(saved.enabled ? `پرچم «${saved.key}» برای همهٔ کاربران فعال شد.` : `پرچم «${saved.key}» غیرفعال شد.`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / پرچم‌های ویژگی" title="پرچم‌های ویژگی" description="فعال‌سازی کنترل‌شدهٔ قابلیت‌ها." />
        <div className="empty-state-v4">
          <div className="empty-ico"><Flag size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت پرچم‌های ویژگی به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / پرچم‌های ویژگی"
        title="پرچم‌های ویژگی"
        description="فعال‌سازی تدریجی قابلیت‌ها با درصد rollout — تغییرها فوری در سامانه اعمال و در لاگ ممیزی ثبت می‌شود."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={beginCreate}><Plus size={16} /> پرچم جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 300 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Flag size={18} />} label="کل پرچم‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="قابلیت‌های مدیریت‌شده" />
            <StatCard icon={<Rocket size={18} />} label="فعال" value={fmtNum(stats.on)} iconClass="ic-teal" sub="برای کاربران روشن" />
            <StatCard icon={<PauseCircle size={18} />} label="غیرفعال" value={fmtNum(stats.off)} iconClass="ic-gold" sub="معلق" />
            <StatCard icon={<Gauge size={18} />} label="گسترش کامل" value={fmtNum(stats.full)} iconClass="ic-red" sub="rollout ۱۰۰٪" />
            <StatCard icon={<Percent size={18} />} label="گسترش تدریجی" value={fmtNum(stats.partial)} iconClass="ic-teal" sub="rollout کمتر از ۱۰۰٪" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی کلید یا توضیح پرچم…">
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ پرچم‌ها</option>
              <option value="on">فعال</option>
              <option value="off">غیرفعال</option>
              <option value="partial">گسترش تدریجی</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} پرچم</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>پرچمی یافت نشد</strong>
              <p>{flags.length === 0 ? 'با «پرچم جدید» نخستین پرچم را بسازید.' : 'عبارت جستجو یا فیلتر را تغییر دهید.'}</p>
            </div>
          ) : (
            <div className="tag-cloud">
              {filtered.map(f => (
                <div key={f.id} className={`tag-card ${f.enabled ? '' : 'tag-unused'}`} style={{ gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 10, flex: '0 0 auto',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: f.enabled ? 'var(--srip-accent-soft, rgba(9,105,218,.14))' : 'var(--input-bg, #eef1f5)',
                      color: f.enabled ? 'var(--srip-accent)' : 'var(--text-muted)',
                    }}><Flag size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b className="t-primary" style={{ fontSize: 13.5 }}>{flagName(f.key)}</b>
                      <div><code dir="ltr" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{f.key}</code></div>
                    </div>
                    {/* toggle switch */}
                    <button
                      role="switch" aria-checked={f.enabled} aria-label={`وضعیت ${f.key}`}
                      className={`ff-switch ${f.enabled ? 'ff-on' : ''}`}
                      onClick={() => toggle(f, !f.enabled)} disabled={!!busy}
                      style={{ flex: '0 0 auto' }}
                    >
                      <span className="ff-knob" />
                    </button>
                  </div>

                  {f.description && <p className="t-muted" style={{ fontSize: 12, margin: 0 }}>{f.description}</p>}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 2 }}>
                    <Gauge size={13} className="t-muted" />
                    <div className="rollout-track" style={{ flex: 1, height: 6, background: 'var(--input-bg, #eef1f5)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, f.rollout))}%`, background: f.enabled ? 'var(--srip-accent, #0969da)' : '#b9c2cf', transition: 'width .3s' }} />
                    </div>
                    <b style={{ fontSize: 11.5, width: 42, textAlign: 'left' }}>{fmtNum(f.rollout)}٪</b>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Badge tone={f.enabled ? 'success' : 'neutral'}>
                      {f.enabled ? <><Rocket size={11} /> فعال</> : <><PauseCircle size={11} /> غیرفعال</>}
                    </Badge>
                    <button className="btn btn-ghost btn-sm" onClick={() => beginEdit(f)} disabled={!!busy} title="تنظیمات پرچم">
                      <Settings2 size={13} /> تنظیمات
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ------- create/edit modal ------- */}
      <Modal
        open={open}
        title={editing ? `تنظیمات پرچم «${editing.key}»` : 'پرچم ویژگی جدید'}
        description="درصد rollout تعیین می‌کند چه نسبتی از کاربران قابلیت را ببینند؛ ۱۰۰٪ یعنی همه."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="ff-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
              {editing ? ' ذخیرهٔ تنظیمات' : ' ساخت پرچم'}
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="ff-form" className="entity-form org-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">کلید پرچم <i className="req">*</i></span>
              <input
                dir="ltr" style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace' }}
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '') }))}
                placeholder="beta_export" required minLength={2} maxLength={64}
                disabled={!!editing}
              />
              <small className="t-muted">{editing ? 'کلید پس از ساخت قابل تغییر نیست؛ برای کلید جدید پرچم تازه بسازید.' : 'لاتین کوچک؛ ۲ تا ۶۴ کاراکتر.'}</small>
            </label>
            <label className="field">
              <span className="field-label">توضیح</span>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="این قابلیت چیست؟" />
            </label>
            <label className="field full">
              <span className="field-label">درصد گسترش (rollout): <b style={{ color: 'var(--srip-accent)' }}>{fmtNum(Number(form.rollout) || 0)}٪</b></span>
              <input
                type="range" min={0} max={100} step={5}
                value={Math.max(0, Math.min(100, Number(form.rollout) || 0))}
                onChange={e => setForm(f => ({ ...f, rollout: e.target.value }))}
                style={{ width: '100%', accentColor: 'var(--srip-accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }} className="t-muted">
                <span>۰٪ (فقط مدیران تست)</span><span>۱۰۰٪ (همه)</span>
              </div>
            </label>
            <label className="field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} style={{ width: 'auto' }} />
              <span>پرچم فعال باشد</span>
            </label>
          </div>
        </form>
      </Modal>
    </main>
  );
}
