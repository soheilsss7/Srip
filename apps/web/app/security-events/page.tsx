'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, Modal, PageHeader, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, Clock3, FileDown, Fingerprint, Gauge, KeyRound, Lock, RefreshCw, ScrollText,
  Search, ShieldAlert, ShieldCheck, UserRound, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  رویدادهای امنیتی — پاریتی SecurityService.list                     */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<string, { fa: string; desc: string; icon: React.ReactNode }> = {
  LOGIN_SUCCESS: { fa: 'ورود موفق', desc: 'ورود موفق کاربر با تأیید دومرحله‌ای', icon: <Fingerprint size={13} /> },
  LOGIN_FAILURE: { fa: 'ورود ناموفق', desc: 'تلاش ناموفق برای ورود با رمز/کد نادرست', icon: <Lock size={13} /> },
  ACCOUNT_LOCKED: { fa: 'قفل حساب', desc: 'حساب به دلیل تلاش‌های ناموفق مکرر قفل شد', icon: <Lock size={13} /> },
  PERMISSION_DENIED: { fa: 'دسترسی غیرمجاز', desc: 'درخواست به منبع خارج از مجوز یا محدوده', icon: <ShieldAlert size={13} /> },
  RATE_LIMITED: { fa: 'محدودیت نرخ', desc: 'درخواست به دلیل عبور از حد مجاز نرخ مسدود شد', icon: <Gauge size={13} /> },
  SUSPICIOUS_ACCESS: { fa: 'دسترسی مشکوک', desc: 'الگوی دسترسی غیرعادی (دستگاه/مکان جدید)', icon: <AlertTriangle size={13} /> },
  EXPORT_CREATED: { fa: 'خروجی داده', desc: 'صدور فایل خروجی گزارش', icon: <FileDown size={13} /> },
  MFA_EVENT: { fa: 'رویداد MFA', desc: 'فعال‌سازی/استفاده از تأیید دومرحله‌ای', icon: <KeyRound size={13} /> },
};
const SEV_TONE: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral'> = {
  CRITICAL: 'danger', HIGH: 'danger', WARNING: 'warning', INFO: 'info', LOW: 'success',
};
const SEV_FA: Record<string, string> = { CRITICAL: 'بحرانی', HIGH: 'بالا', WARNING: 'هشدار', INFO: 'اطلاع', LOW: 'کم' };
type Evt = { id: string; type: string; severity: string; requestId?: string | null; ipAddress?: string | null; userAgent?: string | null; userAgentShort?: string | null; entityType?: string | null; entityId?: string | null; organizationId?: string | null; organizationName?: string | null; userName?: string | null; userEmail?: string | null; metadata?: Record<string, any> | null; createdAt?: string };

const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtNum = (v: unknown) => (v == null ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)));
const unwrap = (x: any) => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.events ?? []);
const metaText = (e: Evt) => Object.entries(e.metadata ?? {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');

export default function SecurityEvents() {
  const [items, setItems] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sev, setSev] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Evt | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const list = unwrap(await api<Evt[]>('/security/events')) as Evt[];
      setItems(list);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of items) c[e.severity] = (c[e.severity] ?? 0) + 1;
    return { CRITICAL: c.CRITICAL ?? 0, HIGH: c.HIGH ?? 0, WARNING: c.WARNING ?? 0, INFO: c.INFO ?? 0 };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(e => {
      if (sev && e.severity !== sev) return false;
      if (term) {
        const hay = `${e.type} ${TYPE_META[e.type]?.fa ?? ''} ${e.userEmail ?? ''} ${e.userName ?? ''} ${e.ipAddress ?? ''} ${e.entityType ?? ''} ${e.entityId ?? ''} ${e.organizationName ?? ''} ${metaText(e)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [items, sev, q]);

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="امنیت"
        title="رویدادهای امنیتی"
        description="رخدادهای ثبت‌شده در محدودهٔ دسترسی شما: ورود موفق/ناموفق، MFA، قفل حساب، دسترسی غیرمجاز، محدودیت نرخ، دسترسی مشکوک و خروجی داده — همراه با شدت و فرادادهٔ کامل."
        actions={
          <div className="toolbar">
            <Link className="btn btn-ghost" href="/security"><ShieldCheck size={15} /> امنیت و حاکمیت</Link>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی</button>
          </div>
        }
      />
      <ErrorCard message={error} />

      <div className="stat-grid">
        <StatCard icon={<AlertTriangle size={18} />} label="بحرانی" value={fmtNum(counts.CRITICAL)} iconClass="ic-red" sub="نیازمند اقدام فوری" />
        <StatCard icon={<AlertTriangle size={18} />} label="بالا" value={fmtNum(counts.HIGH)} iconClass="ic-red" />
        <StatCard icon={<Clock3 size={18} />} label="هشدار" value={fmtNum(counts.WARNING)} iconClass="ic-gold" />
        <StatCard icon={<Fingerprint size={18} />} label="اطلاع‌رسانی" value={fmtNum(counts.INFO)} iconClass="ic-blue" />
      </div>

      <section className="panel">
        <div className="panel-title">
          <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScrollText size={16} /> فهرست رویدادها</h2><p>آخرین ۲۰۰ رویداد به‌ترتیب زمان</p></div>
          <Badge tone="info">{fmtNum(filtered.length)} رویداد</Badge>
        </div>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', insetInlineStart: 9, top: 10, color: 'var(--text-muted)' }} />
            <input placeholder="جستجو در نوع، کاربر، IP، نهاد…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 30, width: '100%' }} />
          </div>
          <select value={sev} onChange={e => setSev(e.target.value)} style={{ maxWidth: 170 }}>
            <option value="">همهٔ شدت‌ها</option>
            {['CRITICAL', 'HIGH', 'WARNING', 'INFO'].map(s => <option key={s} value={s}>{SEV_FA[s]}</option>)}
          </select>
        </div>

        {loading ? <Loading label="در حال بارگذاری رویدادها…" /> : filtered.length === 0 ? (
          <div className="empty-state">رویداد امنیتی‌ای برای این فیلترها ثبت نشده است.</div>
        ) : (
          <div className="list">
            {filtered.map(e => (
              <button key={e.id} onClick={() => setDetail(e)} className="listRow linkRow" style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'right', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'inherit' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `color-mix(in srgb, ${e.severity === 'CRITICAL' || e.severity === 'HIGH' ? 'var(--srip-danger,#dc2626)' : e.severity === 'WARNING' ? 'var(--srip-warning,#f59e0b)' : 'var(--srip-success,#16a34a)'} 12%, transparent)`, color: e.severity === 'CRITICAL' || e.severity === 'HIGH' ? 'var(--srip-danger,#dc2626)' : e.severity === 'WARNING' ? 'var(--srip-warning,#f59e0b)' : 'var(--srip-success,#16a34a)' }}>
                  {TYPE_META[e.type]?.icon ?? <ShieldAlert size={14} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{TYPE_META[e.type]?.fa ?? e.type}</b>
                    <Badge tone={SEV_TONE[e.severity] ?? 'neutral'}>{SEV_FA[e.severity] ?? e.severity}</Badge>
                    {e.organizationName && <span className="t-muted" style={{ fontSize: 10.5 }}>{e.organizationName}</span>}
                  </span>
                  <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                    {TYPE_META[e.type]?.desc} {e.userName ? `· ${e.userName}` : ''} {metaText(e) ? `· ${metaText(e).slice(0, 90)}` : ''}
                  </span>
                </span>
                <span className="t-muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
                  {fmtDT(e.createdAt)}
                  {e.ipAddress && <span dir="ltr" style={{ display: 'block', textAlign: 'left', fontSize: 9.5, fontFamily: 'ui-monospace,monospace' }}>{e.ipAddress}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={!!detail}
        title={detail ? `${TYPE_META[detail.type]?.fa ?? detail.type} — ${detail.id}` : ''}
        description={detail ? `شدت: ${SEV_FA[detail.severity] ?? detail.severity} · ${fmtDT(detail.createdAt)}` : ''}
        onClose={() => setDetail(null)}
        footer={<button className="btn btn-secondary" onClick={() => setDetail(null)}><X size={14} /> بستن</button>}
      >
        {detail && (
          <div style={{ display: 'grid', gap: 9, fontSize: 12.5 }}>
            <p className="t-muted" style={{ fontSize: 12, margin: 0 }}>{TYPE_META[detail.type]?.desc}</p>
            <div style={{ display: 'flex', gap: 6 }}><Badge tone={SEV_TONE[detail.severity] ?? 'neutral'}>{SEV_FA[detail.severity] ?? detail.severity}</Badge></div>
            <div style={{ display: 'flex', gap: 6 }}><UserRound size={14} className="t-muted" /><span><b>بازیگر:</b> {detail.userName ?? '—'} {detail.userEmail ? `(${detail.userEmail})` : ''}</span></div>
            {detail.organizationName && <div style={{ display: 'flex', gap: 6 }}><ShieldCheck size={14} className="t-muted" /><span><b>سازمان:</b> {detail.organizationName}</span></div>}
            <div style={{ display: 'flex', gap: 6 }}><Lock size={14} className="t-muted" /><span><b>IP:</b> <code dir="ltr">{detail.ipAddress ?? '—'}</code></span></div>
            {detail.userAgent && <div style={{ display: 'flex', gap: 6 }}><ShieldCheck size={14} className="t-muted" /><span><b>مرورگر:</b> <span dir="ltr" style={{ fontSize: 10.5, wordBreak: 'break-all' }}>{detail.userAgent}</span></span></div>}
            {detail.requestId && <div style={{ display: 'flex', gap: 6 }}><Clock3 size={14} className="t-muted" /><span><b>درخواست:</b> <code dir="ltr">{detail.requestId}</code></span></div>}
            <div style={{ display: 'flex', gap: 6 }}><ShieldAlert size={14} className="t-muted" /><span><b>نهاد:</b> {detail.entityType ?? '—'} {detail.entityId ? <code dir="ltr">{detail.entityId}</code> : ''}</span></div>
            {detail.metadata && Object.keys(detail.metadata).length > 0 && (
              <div style={{ display: 'grid', gap: 4, background: 'var(--card-bg-soft)', borderRadius: 8, padding: 8, fontSize: 11 }}>
                <b className="t-muted">فرادادهٔ رویداد:</b>
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
