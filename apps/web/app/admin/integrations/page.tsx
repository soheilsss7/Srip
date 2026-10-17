'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  RefreshCw, Search, Plus, X, CheckCircle2, Plug, PlugZap, Unplug, AlertTriangle,
  CalendarDays, Mail, HardDrive, Users, Share2, History, RefreshCw as SyncIcon, Clock, ArrowLeftRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  یکپارچه‌سازی — اتصال به سرویس‌های خارجی و تاریخچهٔ همگام‌سازی       */
/*  بک‌اند: GET /admin/integrations · POST authorize · oauth/callback  */
/*          POST :id/sync · GET :id/sync-runs · DELETE :id             */
/* ------------------------------------------------------------------ */

type Conn = {
  id: string; provider: string; kind: string; status: string;
  accountLabel?: string | null; organizationId?: string | null; organizationName?: string | null;
  userName?: string | null; userEmail?: string | null;
  scopes?: string | null; expiresAt?: string | null;
  lastSyncAt?: string | null; lastError?: string | null; createdAt?: string | null;
};
type Run = {
  id: string; kind: string; status: string; startedAt: string; completedAt?: string | null;
  seen: number; created: number; updated: number; cancelled: number;
  matchedPeople: number; matchedOrganizations: number;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.integrations ?? []);

const PROVIDER_FA: Record<string, string> = { GOOGLE: 'گوگل', MICROSOFT: 'مایکروسافت' };
const KIND_FA: Record<string, string> = {
  CALENDAR: 'تقویم', EMAIL: 'ایمیل', DRIVE: 'درایو', TEAMS: 'تیمز', SHAREPOINT: 'شیرپوینت',
};
const KIND_ICON: Record<string, React.ReactNode> = {
  CALENDAR: <CalendarDays size={15} />, EMAIL: <Mail size={15} />, DRIVE: <HardDrive size={15} />,
  TEAMS: <Users size={15} />, SHAREPOINT: <Share2 size={15} />,
};
const STATUS_FA: Record<string, string> = {
  CONNECTED: 'متصل', PENDING: 'در انتظار', ERROR: 'خطا', DISCONNECTED: 'قطع‌شده',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  CONNECTED: 'success', PENDING: 'warning', ERROR: 'danger', DISCONNECTED: 'neutral',
};
const PROVIDER_COLOR: Record<string, string> = {
  GOOGLE: '#ea4335', MICROSOFT: '#0078d4',
};
const PROVIDER_LETTER: Record<string, string> = { GOOGLE: 'G', MICROSOFT: 'M' };
const CONN_KINDS_BY_PROVIDER: Record<string, string[]> = {
  GOOGLE: ['CALENDAR', 'EMAIL', 'DRIVE'], MICROSOFT: ['CALENDAR', 'EMAIL', 'TEAMS', 'SHAREPOINT'],
};

export default function AdminIntegrationsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ provider: 'GOOGLE', kind: 'CALENDAR', accountLabel: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [runsFor, setRunsFor] = useState<Conn | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setConns(unwrap(await api<Conn[]>('/admin/integrations'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: conns.length,
    connected: conns.filter(c => c.status === 'CONNECTED').length,
    error: conns.filter(c => c.status === 'ERROR').length,
    pending: conns.filter(c => c.status === 'PENDING').length,
    off: conns.filter(c => c.status === 'DISCONNECTED').length,
    syncedToday: conns.filter(c => {
      if (!c.lastSyncAt) return false;
      return Date.now() - new Date(c.lastSyncAt).getTime() < 86400000;
    }).length,
  }), [conns]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return conns.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (term && !`${PROVIDER_FA[c.provider] ?? c.provider} ${KIND_FA[c.kind] ?? c.kind} ${c.accountLabel ?? ''} ${c.organizationName ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [conns, q, statusFilter]);

  async function authorize(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const created = await api<Conn>('/integrations/authorize', {
        method: 'POST',
        body: JSON.stringify({
          provider: form.provider, kind: form.kind, organizationId: 'org-1',
          ...(form.accountLabel.trim() ? { accountLabel: form.accountLabel.trim() } : {}),
        }),
      });
      setOpen(false); setForm({ provider: 'GOOGLE', kind: 'CALENDAR', accountLabel: '' });
      setFlash(`اتصال ${KIND_FA[created.kind]} (${PROVIDER_FA[created.provider]}) در وضعیت «در انتظار تأیید» — با دکمهٔ «تأیید اتصال» تکمیلش کنید.`);
      await load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function completeOauth(c: Conn) {
    if (busy) return;
    setBusy(c.id); setError('');
    try {
      await api('/integrations/oauth/callback', { method: 'POST', body: JSON.stringify({ connectionId: c.id }) });
      setFlash(`اتصال «${c.accountLabel ?? c.id}» تأیید شد و متصل است (دورهٔ دسترسی ۹۰ روز).`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function sync(c: Conn) {
    if (busy) return;
    setBusy(c.id); setError('');
    try {
      const run = await api<Run>(`/integrations/${c.id}/sync`, { method: 'POST' });
      setFlash(`همگام‌سازی «${c.accountLabel ?? c.id}» انجام شد — ${fmtNum(run.seen)} رویداد (${fmtNum(run.created)} تازه · ${fmtNum(run.updated)} به‌روز · ${fmtNum(run.cancelled)} لغو).`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function disconnect(c: Conn) {
    if (busy || !confirm(`اتصال «${c.accountLabel ?? c.id}» قطع شود؟ دسترسی سرویس لغو و همگام‌سازی‌ها متوقف می‌شود.`)) return;
    setBusy(c.id); setError('');
    try {
      await api(`/integrations/${c.id}`, { method: 'DELETE' });
      setFlash(`اتصال «${c.accountLabel ?? c.id}» قطع شد.`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function openRuns(c: Conn) {
    setRunsFor(c); setRuns([]); setRunsLoading(true); setError('');
    try { setRuns(unwrap(await api<Run[]>(`/integrations/${c.id}/sync-runs`))); }
    catch (x) { setError((x as Error).message); }
    finally { setRunsLoading(false); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / یکپارچه‌سازی" title="یکپارچه‌سازی" description="اتصال سامانه به سرویس‌های خارجی." />
        <div className="empty-state-v4">
          <div className="empty-ico"><Plug size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت یکپارچه‌سازی‌ها به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / یکپارچه‌سازی"
        title="یکپارچه‌سازی"
        description="اتصال گوگل و مایکروسافت برای تقویم، ایمیل، درایو و تیمز — با چرخهٔ کامل OAuth، همگام‌سازی دستی و تاریخچهٔ هر اجرا."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={() => { setFormError(''); setOpen(true); }}><Plus size={16} /> اتصال جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 300 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Plug size={18} />} label="کل اتصالات" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="همهٔ سرویس‌ها" />
            <StatCard icon={<PlugZap size={18} />} label="متصل" value={fmtNum(stats.connected)} iconClass="ic-teal" sub="آمادهٔ همگام‌سازی" />
            <StatCard icon={<AlertTriangle size={18} />} label="خطا" value={fmtNum(stats.error)} iconClass="ic-red" sub="نیازمند بررسی" />
            <StatCard icon={<Clock size={18} />} label="در انتظار تأیید" value={fmtNum(stats.pending)} iconClass="ic-gold" sub="OAuth ناتمام" />
            <StatCard icon={<Unplug size={18} />} label="قطع‌شده" value={fmtNum(stats.off)} iconClass="ic-gold" sub="دسترسی لغو شده" />
            <StatCard icon={<SyncIcon size={18} />} label="همگام امروز" value={fmtNum(stats.syncedToday)} iconClass="ic-teal" sub="آخرین اجرا در ۲۴ ساعت" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی سرویس، حساب یا سازمان…">
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="CONNECTED">متصل</option>
              <option value="PENDING">در انتظار</option>
              <option value="ERROR">خطا</option>
              <option value="DISCONNECTED">قطع‌شده</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} اتصال</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>اتصالی یافت نشد</strong>
              <p>با «اتصال جدید» نخستین یکپارچه‌سازی را بسازید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>سرویس</th>
                    <th>حساب</th>
                    <th>وضعیت</th>
                    <th>آخرین همگام‌سازی</th>
                    <th>انقضای دسترسی</th>
                    <th style={{ width: 250 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: '50%', flex: '0 0 auto', color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, background: PROVIDER_COLOR[c.provider] ?? '#777',
                          }}>{PROVIDER_LETTER[c.provider] ?? '?'}</span>
                          <span>
                            <b className="t-primary" style={{ fontSize: 12.5, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                              {KIND_ICON[c.kind]}{KIND_FA[c.kind] ?? c.kind}
                            </b>
                            <div className="t-muted" style={{ fontSize: 10 }}>{PROVIDER_FA[c.provider] ?? c.provider} · <code dir="ltr" style={{ fontFamily: 'ui-monospace,monospace' }}>{c.kind}</code></div>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12 }}>{c.accountLabel ?? '—'}</span>
                        <div className="t-muted" style={{ fontSize: 10 }}>{c.organizationName ?? 'کل سامانه'}{c.userEmail ? ` · ${c.userEmail}` : ''}</div>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{STATUS_FA[c.status] ?? c.status}</Badge>
                        {c.status === 'ERROR' && c.lastError && (
                          <div className="t-muted" style={{ fontSize: 10.5, maxWidth: 190, marginTop: 3 }} title={c.lastError}>⚠ {c.lastError}</div>
                        )}
                      </td>
                      <td><span className="t-muted" style={{ fontSize: 11.5 }}>{c.lastSyncAt ? fmtDT(c.lastSyncAt) : '—'}</span></td>
                      <td>
                        {c.expiresAt ? (
                          <span className={`t-muted ${new Date(c.expiresAt).getTime() < Date.now() + 15 * 86400000 ? 'expiry-near' : ''}`} style={{ fontSize: 11.5 }}>
                            {fmtDT(c.expiresAt)}
                          </span>
                        ) : <span className="t-muted" style={{ fontSize: 11.5 }}>—</span>}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                          {c.status === 'PENDING' && (
                            <button className="btn btn-primary btn-sm" onClick={() => completeOauth(c)} disabled={!!busy}>
                              <CheckCircle2 size={13} /> تأیید اتصال
                            </button>
                          )}
                          {c.status === 'CONNECTED' && (
                            <>
                              <button className="btn btn-secondary btn-sm" onClick={() => sync(c)} disabled={!!busy}><SyncIcon size={13} /> همگام‌سازی</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => openRuns(c)} disabled={!!busy} title="تاریخچهٔ همگام‌سازی"><History size={13} /> اجراها</button>
                            </>
                          )}
                          {(c.status === 'ERROR' || c.status === 'DISCONNECTED') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openRuns(c)} disabled={!!busy} title="تاریخچهٔ همگام‌سازی"><History size={13} /> اجراها</button>
                          )}
                          {c.status !== 'DISCONNECTED' && (
                            <button className="btn btn-ghost btn-sm danger-ghost" onClick={() => disconnect(c)} disabled={!!busy} title="قطع اتصال"><Unplug size={13} /></button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------- new connection ------- */}
      <Modal
        open={open}
        title="اتصال جدید"
        description="ارائه‌دهنده و سرویس را انتخاب کنید؛ پس از ایجاد، اتصال در وضعیت «در انتظار» می‌ماند تا با تأیید OAuth تکمیل شود."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="int-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <PlugZap size={14} />} ایجاد و ادامه
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="int-form" className="entity-form org-form" onSubmit={authorize}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">ارائه‌دهنده <i className="req">*</i></span>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, kind: CONN_KINDS_BY_PROVIDER[e.target.value][0] }))}>
                <option value="GOOGLE">گوگل</option>
                <option value="MICROSOFT">مایکروسافت</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">سرویس <i className="req">*</i></span>
              <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
                {(CONN_KINDS_BY_PROVIDER[form.provider] ?? []).map(k => (
                  <option key={k} value={k}>{KIND_FA[k] ?? k}</option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span className="field-label">برچسب حساب</span>
              <input value={form.accountLabel} onChange={e => setForm(f => ({ ...f, accountLabel: e.target.value }))} placeholder="مثال: تقویم تیم اجرایی" />
              <small className="t-muted">نام نمایشی برای تشخیص حساب در فهرست اتصالات.</small>
            </label>
          </div>
          <p className="t-muted" style={{ fontSize: 11, margin: '10px 0 0', display: 'flex', gap: 5, alignItems: 'center' }}>
            <ArrowLeftRight size={12} /> در محیط دمو، فرایند OAuth با دکمهٔ «تأیید اتصال» شبیه‌سازی می‌شود.
          </p>
        </form>
      </Modal>

      {/* ------- sync runs modal ------- */}
      <Modal
        open={!!runsFor}
        title={`تاریخچهٔ همگام‌سازی — ${runsFor?.accountLabel ?? runsFor?.id ?? ''}`}
        description={runsFor ? `${PROVIDER_FA[runsFor.provider] ?? runsFor.provider} · ${KIND_FA[runsFor.kind] ?? runsFor.kind} — ${STATUS_FA[runsFor.status] ?? runsFor.status}` : ''}
        onClose={() => setRunsFor(null)}
        footer={<button type="button" className="btn btn-secondary" onClick={() => setRunsFor(null)}><X size={14} /> بستن</button>}
      >
        {runsLoading ? (
          <div className="skeleton skeleton-table" style={{ height: 160 }} />
        ) : runs.length === 0 ? (
          <div className="empty-state-v4">
            <div className="empty-ico"><History size={22} /></div>
            <strong>همگام‌سازی‌ای ثبت نشده</strong>
            <p>اولین اجرای همگام‌سازی این اتصال هنوز انجام نشده است.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>زمان شروع</th>
                  <th>وضعیت</th>
                  <th>رویدادها</th>
                  <th>تازه</th>
                  <th>به‌روز</th>
                  <th>لغو</th>
                  <th>تطبیق</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td><span className="t-muted" style={{ fontSize: 11.5 }}>{fmtDT(r.startedAt)}</span></td>
                    <td><Badge tone={r.status === 'SUCCESS' ? 'success' : r.status === 'RUNNING' ? 'info' : 'danger'}>{r.status === 'SUCCESS' ? 'موفق' : r.status === 'RUNNING' ? 'در حال اجرا' : 'ناموفق'}</Badge></td>
                    <td><span className="cell-count"><SyncIcon size={12} /> {fmtNum(r.seen)}</span></td>
                    <td><span style={{ fontSize: 12 }}>{fmtNum(r.created)}</span></td>
                    <td><span style={{ fontSize: 12 }}>{fmtNum(r.updated)}</span></td>
                    <td><span style={{ fontSize: 12 }}>{fmtNum(r.cancelled)}</span></td>
                    <td><span style={{ fontSize: 11.5 }} className="t-muted">{fmtNum(r.matchedPeople)} شخص · {fmtNum(r.matchedOrganizations)} سازمان</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </main>
  );
}
