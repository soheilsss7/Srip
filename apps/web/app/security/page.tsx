'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, CheckCircle2, Clock3, FileDown, Fingerprint, Gauge, KeyRound, Lock, RefreshCw,
  ScrollText, Search, ShieldAlert, ShieldCheck, UserRound, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  امنیت و حاکمیت — پاریتی SecurityService/SecurityGovernanceService  */
/*  GET /security/events · GET /security/exports                       */
/*  GET /security/governance/preflight                                 */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<string, { fa: string; icon: React.ReactNode }> = {
  LOGIN_SUCCESS: { fa: 'ورود موفق', icon: <Fingerprint size={13} /> },
  LOGIN_FAILURE: { fa: 'ورود ناموفق', icon: <Lock size={13} /> },
  ACCOUNT_LOCKED: { fa: 'قفل حساب', icon: <Lock size={13} /> },
  PERMISSION_DENIED: { fa: 'دسترسی غیرمجاز', icon: <ShieldAlert size={13} /> },
  RATE_LIMITED: { fa: 'محدودیت نرخ', icon: <Gauge size={13} /> },
  SUSPICIOUS_ACCESS: { fa: 'دسترسی مشکوک', icon: <AlertTriangle size={13} /> },
  EXPORT_CREATED: { fa: 'خروجی داده', icon: <FileDown size={13} /> },
  MFA_EVENT: { fa: 'رویداد MFA', icon: <KeyRound size={13} /> },
};
const SEV_TONE: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral'> = {
  CRITICAL: 'danger', HIGH: 'danger', WARNING: 'warning', INFO: 'info', LOW: 'success',
};
const SEV_FA: Record<string, string> = {
  CRITICAL: 'بحرانی', HIGH: 'بالا', WARNING: 'هشدار', INFO: 'اطلاع', LOW: 'کم',
};
type Evt = { id: string; type: string; severity: string; ipAddress?: string | null; userAgent?: string | null; userAgentShort?: string | null; entityType?: string | null; entityId?: string | null; organizationId?: string | null; organizationName?: string | null; userName?: string | null; userEmail?: string | null; metadata?: Record<string, any> | null; createdAt?: string };
type ExportRow = { id: string; exportType: string; entityType?: string | null; recordCount?: number; classification?: string; requestId?: string | null; ipAddress?: string | null; userName?: string | null; userEmail?: string | null; organizationName?: string | null; createdAt?: string | null };
type Check = { key: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string };
type Preflight = { generatedAt: string; overall: 'PASS' | 'WARN' | 'FAIL'; checks: Check[] };

const fmtNum = (v: unknown) => (v == null ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)));
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';
const unwrap = (x: any) => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.events ?? x?.exports ?? []);
const CHECK_TONE: Record<string, 'success' | 'warning' | 'danger'> = { PASS: 'success', WARN: 'warning', FAIL: 'danger' };
const CHECK_FA: Record<string, { fa: string; icon: React.ReactNode }> = {
  'origin-check': { fa: 'کنترل مبدأ درخواست', icon: <ShieldCheck size={14} /> },
  'rate-limit-fail-open': { fa: 'محدودیت نرخ fail-closed', icon: <Gauge size={14} /> },
  'file-scan': { fa: 'پویش بدافزار فایل‌ها', icon: <FileDown size={14} /> },
  'secret-manager': { fa: 'مدیریت کلیدها', icon: <KeyRound size={14} /> },
  'data-policy-coverage': { fa: 'پوشش خط‌مشی داده', icon: <ScrollText size={14} /> },
  'secret:JWT_SECRET': { fa: 'کلید JWT', icon: <KeyRound size={14} /> },
  'secret:SECRET_ENCRYPTION_KEY': { fa: 'کلید رمزنگاری', icon: <Lock size={14} /> },
};
const CLASS_FA: Record<string, string> = {
  PUBLIC: 'عمومی', INTERNAL: 'داخلی', CONFIDENTIAL: 'محرمانه', RESTRICTED: 'محدود',
  PRIVATE: 'خصوصی', HIGHLY_CONFIDENTIAL: 'بسیار محرمانه',
};
const FMT_FA: Record<string, string> = { CSV: 'CSV', XLSX: 'XLSX', PDF: 'PDF', JSON: 'JSON' };

function metaDetail(e: Evt): string {
  const m = e.metadata ?? {};
  const parts = Object.entries(m).map(([k, v]) => {
    if (typeof v === 'object' && v) v = JSON.stringify(v);
    return `${k}: ${String(v)}`;
  });
  return parts.join(' · ');
}

export default function Security() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [events, setEvents] = useState<Evt[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Evt | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ev, ex] = await Promise.all([
        api<Evt[]>('/security/events').then(unwrap).catch(() => []),
        api<ExportRow[]>('/security/exports').then(unwrap).catch(() => []),
      ]);
      setEvents(ev as Evt[]); setExports(ex as ExportRow[]);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runPreflight() {
    setRunning(true); setError(''); setNotice('');
    try {
      const p = await api<Preflight>('/security/governance/preflight');
      setPreflight(p);
      setNotice(`بررسی مقدماتی حاکمیت انجام شد — وضعیت کل: ${p.overall === 'PASS' ? 'سالم' : p.overall === 'WARN' ? 'نیازمند توجه' : 'شکست'}.`);
    } catch (x) { setError((x as Error).message); }
    finally { setRunning(false); }
  }

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) c[e.severity] = (c[e.severity] ?? 0) + 1;
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return events.filter(e => {
      if (sevFilter && e.severity !== sevFilter) return false;
      if (term) {
        const hay = `${e.type} ${TYPE_META[e.type]?.fa ?? ''} ${e.severity} ${e.userEmail ?? ''} ${e.userName ?? ''} ${e.ipAddress ?? ''} ${e.entityType ?? ''} ${e.entityId ?? ''} ${e.organizationName ?? ''} ${metaDetail(e)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [events, sevFilter, q]);

  const criticalCount = (sevCounts.CRITICAL ?? 0) + (sevCounts.HIGH ?? 0);
  const exportFormats = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of exports) {
      const f = FMT_FA[String(r.exportType ?? '').toUpperCase()] ? String(r.exportType).toUpperCase() : '—';
      c[f] = (c[f] ?? 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [exports]);

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="امنیت و حاکمیت"
        title="امنیت"
        description="رویدادهای امنیتی (ورود، MFA، خروجی داده، دسترسی غیرمجاز و…)، تاریخچهٔ خروجی‌ها و بررسی مقدماتی حاکمیت — بدون افشای هیچ رمز یا کلیدی."
        actions={
          <div className="toolbar">
            <Link className="btn btn-ghost" href="/security-events"><ScrollText size={15} /> همهٔ رویدادها</Link>
            <Link className="btn btn-ghost" href="/admin/audit"><Clock3 size={15} /> ممیزی کامل</Link>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={runPreflight} disabled={running || loading}>
              {running ? <RefreshCw size={15} className="spin" /> : <ShieldCheck size={15} />} بررسی مقدماتی حاکمیت
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {notice}</div>}

      <div className="stat-grid">
        <StatCard icon={<ScrollText size={18} />} label="رویدادهای امنیتی" value={fmtNum(events.length)} iconClass="ic-blue" sub="آخرین ۲۰۰ رخداد" />
        <StatCard icon={<AlertTriangle size={18} />} label="بحرانی / بالا" value={fmtNum(criticalCount)} iconClass="ic-red" sub={criticalCount ? 'نیازمند بررسی فوری' : 'رخدادی نیست'} />
        <StatCard icon={<Clock3 size={18} />} label="هشدار" value={fmtNum(sevCounts.WARNING ?? 0)} iconClass="ic-gold" sub="رفتارهای مشکوک" />
        <StatCard icon={<FileDown size={18} />} label="خروجی‌های داده" value={fmtNum(exports.length)} iconClass="ic-indigo" sub="ثبت‌شده در ممیزی خروجی" />
      </div>

      {preflight && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Gauge size={16} /> بررسی مقدماتی حاکمیت</h2>
              <p>انجام‌شده در {fmtDT(preflight.generatedAt)} · {preflight.checks.length} چک</p>
            </div>
            <Badge tone={CHECK_TONE[preflight.overall]}>{preflight.overall === 'PASS' ? 'سالم' : preflight.overall === 'WARN' ? 'نیازمند توجه' : 'شکست'}</Badge>
          </div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {preflight.checks.map(c => (
              <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--card-bg-soft)', borderRadius: 10, padding: '8px 10px', border: '1px solid var(--card-border)' }}>
                <span className="t-muted" style={{ marginTop: 2 }}>{CHECK_FA[c.key]?.icon ?? <ShieldCheck size={14} />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 11.5 }}>{CHECK_FA[c.key]?.fa ?? c.key}</b>
                    <Badge tone={CHECK_TONE[c.status]}>{c.status === 'PASS' ? 'گذر' : c.status === 'WARN' ? 'هشدار' : 'شکست'}</Badge>
                  </div>
                  <div className="t-muted" style={{ fontSize: 10.5, marginTop: 3 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? <Loading label="در حال بارگذاری رویدادهای امنیتی…" /> : (
        <>
          <section className="panel">
            <div className="panel-title">
              <div><h2>رویدادهای امنیتی اخیر</h2><p>رخدادهای ثبت‌شده در محدودهٔ دسترسی شما</p></div>
              <Badge tone="info">{fmtNum(filtered.length)} رویداد</Badge>
            </div>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <input className="search-input" placeholder="جستجو در رویدادها…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 260 }} />
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="">همهٔ شدت‌ها</option>
                {['CRITICAL', 'HIGH', 'WARNING', 'INFO'].map(s => <option key={s} value={s}>{SEV_FA[s]}</option>)}
              </select>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state">رویدادی برای این فیلترها نیست.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>رویداد</th><th>شدت</th><th>بازیگر / سازمان</th><th>IP</th><th>نهاد</th><th>زمان</th><th></th></tr></thead>
                  <tbody>
                    {filtered.slice(0, 40).map(e => (
                      <tr key={e.id} onClick={() => setDetail(e)} style={{ cursor: 'pointer' }}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {TYPE_META[e.type]?.icon ?? <ShieldAlert size={12} className="t-muted" />}
                            <b style={{ fontSize: 12.5 }}>{TYPE_META[e.type]?.fa ?? e.type}</b>
                          </span>
                          <div className="t-muted" dir="ltr" style={{ fontSize: 9.5, textAlign: 'left', fontFamily: 'ui-monospace,monospace' }}>{e.id}</div>
                        </td>
                        <td><Badge tone={SEV_TONE[e.severity] ?? 'neutral'}>{SEV_FA[e.severity] ?? e.severity}</Badge></td>
                        <td>
                          <span style={{ fontSize: 11.5 }}>{e.userName ?? '—'}</span>
                          <div className="t-muted" style={{ fontSize: 10 }}>{e.organizationName ?? (e.userEmail ?? '')}</div>
                        </td>
                        <td><code dir="ltr" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace' }}>{e.ipAddress ?? '—'}</code></td>
                        <td>
                          <span style={{ fontSize: 11 }}>{e.entityType ?? '—'}</span>
                          {e.entityId && <div className="t-muted" dir="ltr" style={{ fontSize: 9.5, fontFamily: 'ui-monospace,monospace' }}>{String(e.entityId).slice(0, 24)}</div>}
                        </td>
                        <td><span className="t-muted" style={{ fontSize: 11 }}>{fmtDT(e.createdAt)}</span></td>
                        <td><button className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); setDetail(e); }}>جزئیات</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">
              <div><h2>ممیزی خروجی داده</h2><p>صادرات فایل با طبقه‌بندی و درخواست تأیید</p></div>
              <Badge tone="info">{fmtNum(exports.length)} خروجی</Badge>
            </div>
            {exports.length === 0 ? <div className="empty-state">خروجی ثبت‌شده‌ای در محدودهٔ شما نیست.</div> : (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                {exportFormats.map(([f, n]) => (
                  <div key={f} style={{ background: 'var(--card-bg-soft)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--card-border)' }}>
                    <FileDown size={14} className="t-muted" />
                    <b style={{ fontSize: 12 }}>{f}</b>
                    <Badge tone="info">{fmtNum(n)}</Badge>
                  </div>
                ))}
                <div style={{ background: 'var(--card-bg-soft)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--card-border)' }}>
                  <UserRound size={14} className="t-muted" />
                  <b style={{ fontSize: 12 }}>بازیگرها</b>
                  <Badge tone="info">{fmtNum(new Set(exports.map(r => r.userEmail ?? r.userName ?? '?')).size)}</Badge>
                </div>
              </div>
            )}
            {exports.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table>
                  <thead><tr><th>نوع</th><th>طبقه‌بندی</th><th>رکوردها</th><th>تأیید</th><th>بازیگر</th><th>زمان</th></tr></thead>
                  <tbody>
                    {exports.slice(0, 15).map(r => (
                      <tr key={r.id}>
                        <td>
                          <b style={{ fontSize: 12 }}>{FMT_FA[String(r.exportType ?? '').toUpperCase()] ?? r.exportType}</b>
                          <div className="t-muted" dir="ltr" style={{ fontSize: 9.5, fontFamily: 'ui-monospace,monospace' }}>{r.entityType}</div>
                        </td>
                        <td><Badge tone="neutral">{CLASS_FA[String(r.classification ?? '').toUpperCase()] ?? r.classification ?? '—'}</Badge></td>
                        <td><span style={{ fontSize: 12 }}>{fmtNum(r.recordCount)}</span></td>
                        <td>{r.requestId ? <Badge tone="success">تأییدشده</Badge> : <span className="t-muted" style={{ fontSize: 11 }}>—</span>}</td>
                        <td>
                          <span style={{ fontSize: 11.5 }}>{r.userName ?? '—'}</span>
                          <div className="t-muted" dir="ltr" style={{ fontSize: 9.5 }}>{r.userEmail}</div>
                        </td>
                        <td><span className="t-muted" style={{ fontSize: 11 }}>{fmtDT(r.createdAt)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={!!detail}
        title={detail ? `${TYPE_META[detail.type]?.fa ?? detail.type} — ${detail.id}` : ''}
        description={detail ? `شدت: ${SEV_FA[detail.severity] ?? detail.severity} · ${fmtDT(detail.createdAt)}` : ''}
        onClose={() => setDetail(null)}
        footer={<button className="btn btn-secondary" onClick={() => setDetail(null)}><X size={14} /> بستن</button>}
      >
        {detail && (
          <div style={{ display: 'grid', gap: 9, fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><AlertTriangle size={14} className="t-muted" style={{ marginTop: 2 }} /><span><b>نوع:</b> {TYPE_META[detail.type]?.fa ?? detail.type}</span></div>
            <div style={{ display: 'flex', gap: 6 }}><Badge tone={SEV_TONE[detail.severity] ?? 'neutral'}>{SEV_FA[detail.severity] ?? detail.severity}</Badge></div>
            <div style={{ display: 'flex', gap: 6 }}><UserRound size={14} className="t-muted" /><span><b>بازیگر:</b> {detail.userName ?? '—'} {detail.userEmail ? `(${detail.userEmail})` : ''}</span></div>
            {detail.organizationName && <div style={{ display: 'flex', gap: 6 }}><ShieldCheck size={14} className="t-muted" /><span><b>سازمان:</b> {detail.organizationName}</span></div>}
            <div style={{ display: 'flex', gap: 6 }}><Lock size={14} className="t-muted" /><span><b>IP:</b> <code dir="ltr">{detail.ipAddress ?? '—'}</code> {detail.userAgentShort ? `· ${detail.userAgentShort}` : ''}</span></div>
            <div style={{ display: 'flex', gap: 6 }}><FileDown size={14} className="t-muted" /><span><b>نهاد:</b> {detail.entityType ?? '—'} {detail.entityId ? <code dir="ltr">{detail.entityId}</code> : ''}</span></div>
            {detail.metadata && Object.keys(detail.metadata).length > 0 && (
              <div style={{ display: 'grid', gap: 4, background: 'var(--card-bg-soft)', borderRadius: 8, padding: 8, fontSize: 11 }}>
                <b className="t-muted">فراداده:</b>
                {Object.entries(detail.metadata).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8 }}>
                    <code dir="ltr" style={{ color: 'var(--text-secondary)' }}>{k}</code>
                    <span style={{ flex: 1 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
