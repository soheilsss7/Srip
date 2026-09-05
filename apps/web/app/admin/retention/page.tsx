'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  Database, RefreshCw, Search, X, CheckCircle2, CalendarClock, ShieldOff,
  Archive, ArchiveRestore, Hourglass, Trash2, Scale, ShieldCheck, Info,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  نگهداری داده — سیاست‌های دورهٔ نگهداری و اجرای بایگانی              */
/*  بک‌اند: GET /privacy/retention/preview · POST /privacy/retention/  */
/*          execute (پاریتی PrivacyService)                            */
/* ------------------------------------------------------------------ */

type RetentionRow = {
  entityType: string; entityName?: string; purpose: string;
  retentionDays: number; cutoff: string;
  erasable: boolean; exportable: boolean; count: number;
};
type RunResult = { executedAt: string; changed: Array<{ entityType: string; count: number }> };

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDay = (iso?: string | null) => iso
  ? new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);
const ENTITY_ICON: Record<string, React.ReactNode> = {
  Organization: <Database size={13} />, Project: <Archive size={13} />,
  Opportunity: <Hourglass size={13} />, Commitment: <Scale size={13} />,
};

export default function AdminRetentionPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [rows, setRows] = useState<RetentionRow[]>([]);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [onlyActionable, setOnlyActionable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setRows(unwrap(await api<RetentionRow[]>('/privacy/retention/preview'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const eligible = rows.reduce((a, r) => a + (r.erasable ? r.count : 0), 0);
    const locked = rows.reduce((a, r) => a + (!r.erasable ? r.count : 0), 0);
    const protectedRows = rows.filter(r => !r.erasable).length;
    return { policies: rows.length, eligible, locked, protectedRows };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (onlyActionable && !(r.erasable && r.count > 0)) return false;
      if (term && !`${r.entityName ?? r.entityType} ${r.purpose}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, q, onlyActionable]);

  const totalActionable = stats.eligible;

  async function execute() {
    if (busy) return;
    setBusy(true); setConfirmOpen(false); setError('');
    try {
      const res = await api<RunResult>('/privacy/retention/execute', { method: 'POST' });
      setLastRun(res);
      const n = res.changed?.reduce((a, c) => a + c.count, 0) ?? 0;
      setFlash(`پاک‌سازی دورهٔ نگهداری انجام شد — ${fmtNum(n)} رکورد بایگانی شد (لاگ ممیزی ثبت شد).`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / نگهداری داده" title="نگهداری داده" description="سیاست‌های دورهٔ نگهداری و بایگانی خودکار." />
        <div className="empty-state-v4">
          <div className="empty-ico"><Archive size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت نگهداری داده به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / نگهداری داده"
        title="نگهداری داده"
        description="سیاست‌های دورهٔ نگهداری، رکوردهای واجد بایگانی و اجرای دوره‌ای پاک‌سازی — خروجی هر اجرا در لاگ ممیزی ثبت می‌شود."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button
              className="btn btn-danger"
              onClick={() => { setError(''); setConfirmOpen(true); }}
              disabled={totalActionable === 0 || busy}
            >
              <Archive size={16} /> اجرای پاک‌سازی {totalActionable > 0 ? `(${fmtNum(totalActionable)} رکورد)` : ''}
            </button>
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
            <StatCard icon={<CalendarClock size={18} />} label="سیاست‌های نگهداری" value={fmtNum(stats.policies)} iconClass="ic-indigo" sub="فعال با دورهٔ نگهداری" />
            <StatCard icon={<Archive size={18} />} label="واجد پاک‌سازی" value={fmtNum(stats.eligible)} iconClass="ic-red" sub="گذشته از دورهٔ نگهداری" />
            <StatCard icon={<ShieldOff size={18} />} label="تحت محافظت" value={fmtNum(stats.locked)} iconClass="ic-gold" sub="غیرقابل‌پاک‌سازی" />
            <StatCard icon={<Trash2 size={18} />} label="سیاست غیرقابل‌حذف" value={fmtNum(stats.protectedRows)} iconClass="ic-teal" sub="erasable = خیر" />
            <StatCard icon={<ShieldCheck size={18} />} label="بازیگر" value={isOwner ? 'مالک' : '—'} iconClass="ic-teal" sub="دسترسی privacy.manage" />
          </div>

          {lastRun && lastRun.changed?.length > 0 && (
            <div className="retention-last-run" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'var(--teal-soft, rgba(15,140,110,.08))', marginBottom: 14 }}>
              <ArchiveRestore size={16} />
              <b style={{ fontSize: 13 }}>آخرین اجرا: {fmtDT(lastRun.executedAt)}</b>
              {lastRun.changed.map(c => (
                <Badge key={c.entityType} tone="neutral"><Database size={10} /> {c.entityType}: {fmtNum(c.count)} رکورد</Badge>
              ))}
            </div>
          )}

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نهاد یا هدف سیاست…">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }} className="t-muted">
              <input type="checkbox" checked={onlyActionable} onChange={e => setOnlyActionable(e.target.checked)} style={{ width: 'auto' }} />
              فقط واجد پاک‌سازی
            </label>
            <span className="chip info">{fmtNum(filtered.length)} سیاست</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>سیاستی یافت نشد</strong>
              <p>جستجو یا فیلتر را تغییر دهید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>نهاد</th>
                    <th>هدف سیاست</th>
                    <th>دورهٔ نگهداری</th>
                    <th>محدودیت (cutoff)</th>
                    <th>قابل‌پاک‌سازی</th>
                    <th>قابل‌خروجی</th>
                    <th>رکورد واجد</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const actionable = r.erasable && r.count > 0;
                    return (
                      <tr key={`${r.entityType}-${r.purpose}`} className={actionable ? 'row-actionable' : ''}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {ENTITY_ICON[r.entityType] ?? <Database size={12} className="t-muted" />}
                            <b className="t-primary" style={{ fontSize: 12.5 }}>{r.entityName ?? r.entityType}</b>
                          </span>
                          <div><code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{r.entityType}</code></div>
                        </td>
                        <td><span style={{ fontSize: 12 }}>{r.purpose}</span></td>
                        <td><Badge tone="info" ><Hourglass size={10} /> {fmtNum(r.retentionDays)} روز</Badge></td>
                        <td><span className="t-muted" style={{ fontSize: 11.5 }}>{fmtDay(r.cutoff)}</span></td>
                        <td>{r.erasable ? <Badge tone="success">بله</Badge> : <Badge tone="neutral"><ShieldOff size={10} /> خیر</Badge>}</td>
                        <td>{r.exportable ? <Badge tone="success">بله</Badge> : <Badge tone="neutral">خیر</Badge>}</td>
                        <td>
                          {actionable ? (
                            <span className="cell-count cell-danger"><Archive size={12} /> {fmtNum(r.count)}</span>
                          ) : (
                            <span className="cell-count"><CheckCircle2 size={12} /> {fmtNum(r.count)}</span>
                          )}
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

      {/* confirm modal */}
      <Modal
        open={confirmOpen}
        title="اجرای پاک‌سازی دورهٔ نگهداری"
        description="رکوردهای واجد شرایطِ گذشته از دورهٔ نگهداری، بایگانی (soft-delete) می‌شوند. این عملیات در لاگ ممیزی ثبت می‌شود."
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}><X size={14} /> انصراف</button>
            <button type="button" className="btn btn-danger" onClick={execute} disabled={busy}>
              {busy ? <RefreshCw size={14} className="spin" /> : <Archive size={14} />} بله، اجرا کن
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
          <div className="empty-ico" style={{ width: 36, height: 36, flex: '0 0 auto' }}><Archive size={18} /></div>
          <div>
            <b style={{ fontSize: 13.5 }}>{fmtNum(totalActionable)} رکورد بایگانی می‌شود:</b>
            <ul style={{ margin: '8px 0 0', paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.9 }}>
              {rows.filter(r => r.erasable && r.count > 0).map(r => (
                <li key={r.entityType}>{r.entityName ?? r.entityType} — {fmtNum(r.count)} رکورد ({r.purpose})</li>
              ))}
            </ul>
            <p className="t-muted" style={{ fontSize: 11.5, margin: '10px 0 0', display: 'flex', gap: 5, alignItems: 'center' }}>
              <Info size={12} /> رکوردهای «غیرقابل‌پاک‌سازی» در این اجرا دست نمی‌خورند.
            </p>
          </div>
        </div>
      </Modal>
    </main>
  );
}
