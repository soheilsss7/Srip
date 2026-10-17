'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, apiBlob, unwrapList } from '../_lib/api';
import { fa } from '../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, BadgeCheck, Ban, Building2, ClipboardList, Clock3, Download, Eye, FileDown,
  FileJson, Handshake, HeartHandshake, Lock, Plus, RefreshCw, ScrollText, Search,
  ShieldCheck, Trash2, UserRound, UserRoundX, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  حریم خصوصی و حقوق داده — پاریتی PrivacyController                  */
/* ------------------------------------------------------------------ */

const ENTITY_FA: Record<string, string> = {
  Organization: 'سازمان', Person: 'شخص', Relationship: 'رابطه', Interaction: 'تعامل',
  Meeting: 'جلسه', Project: 'پروژه', Opportunity: 'فرصت', Commitment: 'تعهد', Action: 'اقدام',
};
const LEGAL_FA: Record<string, string> = {
  LEGITIMATE_INTEREST: 'منافع مشروع', CONTRACT: 'قرارداد', LEGAL_OBLIGATION: 'الزام قانونی',
  CONSENT: 'رضایت', VITAL_INTEREST: 'منافع حیاتی', PUBLIC_INTEREST: 'منافع عمومی',
};
const CLASS_FA: Record<string, string> = {
  INTERNAL: 'داخلی', CONFIDENTIAL: 'محرمانه', RESTRICTED: 'محدود', PUBLIC: 'عمومی',
};
const PURPOSE_FA: Record<string, string> = {
  marketing: 'بازاریابی و اطلاع‌رسانی', analytics: 'تحلیل و بهبود محصول', newsletter: 'خبرنامه',
  third_party_sharing: 'اشتراک‌گذاری با طرف ثالث', support: 'پشتیبانی و خدمات', hr_records: 'سوابق اداری',
  security: 'امنیت و ضدکلاهبرداری', compliance: 'تطبیق با مقررات',
};
const PURPOSE_SUGGESTIONS = ['marketing', 'analytics', 'newsletter', 'third_party_sharing', 'support', 'hr_records'];
const REQUEST_ICON: Record<string, React.ReactNode> = {
  ACCESS: <Eye size={15} />, EXPORT: <FileDown size={15} />, ERASURE: <UserRoundX size={15} />,
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  GRANTED: 'success', REVOKED: 'neutral',
  PENDING: 'info', PROCESSING: 'warning', COMPLETED: 'success', REJECTED: 'danger',
};
const AUDIT_TONE: Record<string, string> = { CREATE: '#16a34a', UPDATE: '#2563eb', DELETE: '#dc2626', READ: '#7c3aed', EXPORT: '#0891b2', RESTORE: '#16a34a' };

type Policy = { id: string; entityType: string; purpose: string; legalBasis?: string; classification?: string; retentionDays?: number | null; exportable?: boolean; erasable?: boolean; active?: boolean };
type Consent = { id: string; purpose: string; version: string; source?: string; status: string; grantedAt?: string | null; revokedAt?: string | null; createdAt?: string };
type PReq = { id: string; userId: string; type: string; reason?: string | null; status: string; result?: { totalRecords?: number; parts?: number; blockedLegalRetention?: string[] } | null; manifestUrl?: string | null; createdAt?: string; completedAt?: string | null; requestedByName?: string | null };
type AuditRow = { id: string; action: string; entity?: string | null; entityId?: string | null; actorEmail?: string | null; at?: string; meta?: Record<string, any> | null };

const fmtNum = (v: unknown) => (v == null || v === '' ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)));
const fmtDT = (iso?: string | null, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }) + (withTime ? `، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : '');
};

export default function PrivacyHub() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [requests, setRequests] = useState<PReq[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const [reqOpen, setReqOpen] = useState(false);
  const [reqType, setReqType] = useState('ACCESS');
  const [reqReason, setReqReason] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [version, setVersion] = useState('1.0');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError(''); setNotice('');
    try {
      const [p, c, r] = await Promise.all([
        api<any>('/privacy/policies').then(x => (Array.isArray(x) ? x : x?.policies ?? [])).catch(() => [] as Policy[]),
        api<Consent[]>('/privacy/consents').then(unwrapList<Consent>).catch(() => [] as Consent[]),
        api<PReq[]>('/privacy/requests').then(unwrapList<PReq>).catch(() => [] as PReq[]),
      ]);
      setPolicies(p); setConsents(c); setRequests(r);
      try {
        const a = await api<any>('/privacy/audit');
        setAuditRows(Array.isArray(a) ? a : a?.rows ?? []);
      } catch { setAuditRows([]); }
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const granted = consents.filter(c => c.status === 'GRANTED').length;
  const openReqs = requests.filter(r => ['PENDING', 'PROCESSING'].includes(r.status)).length;
  const ready = requests.filter(r => r.status === 'COMPLETED' && ['ACCESS', 'EXPORT'].includes(r.type));
  const readyRecords = useMemo(() => ready.reduce((s, r) => s + (r.result?.totalRecords ?? 0), 0), [ready]);

  /* ---------------------------- actions ---------------------------- */
  async function submitRequest(e: FormEvent) {
    e.preventDefault(); setBusy('new-req'); setError(''); setNotice('');
    try {
      const made = await api<{ id: string }>('/privacy/requests', { method: 'POST', body: JSON.stringify({ type: reqType, reason: reqReason.trim() }) });
      setNotice(`درخواست ${fa(reqType)} ثبت شد (${made?.id ?? '—'}). درخواست‌های باز تکراری به‌صورت خودکار ادغام می‌شوند.`);
      setReqReason(''); setReqOpen(false); await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function grantConsent(e: FormEvent) {
    e.preventDefault(); setBusy('consent'); setError(''); setNotice('');
    try {
      if (!purpose.trim() || !version.trim()) throw new Error('هدف و نسخهٔ رضایت الزامی است.');
      const made = await api<Consent>('/privacy/consents', { method: 'POST', body: JSON.stringify({ purpose: purpose.trim(), version: version.trim(), source: 'USER' }) });
      setNotice(`رضایت «${PURPOSE_FA[made.purpose] ?? made.purpose}» نسخهٔ ${made.version} با موفقیت ثبت شد (وضعیت: ${fa(made.status)}).`);
      setPurpose(''); setVersion('1.0'); setConsentOpen(false); await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function revokeConsent(c: Consent) {
    if (!window.confirm(`ابطال رضایت «${PURPOSE_FA[c.purpose] ?? c.purpose}» نسخهٔ ${c.version}؟ پردازش بر پایهٔ این رضایت متوقف می‌شود.`)) return;
    setBusy('rev-' + c.id); setError(''); setNotice('');
    try {
      await api('/privacy/consents/revoke', { method: 'POST', body: JSON.stringify({ purpose: c.purpose, version: c.version }) });
      setNotice(`رضایت «${PURPOSE_FA[c.purpose] ?? c.purpose}» ابطال شد.`); await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function runRequest(r: PReq) {
    const verb = r.type === 'ACCESS' ? 'access' : r.type === 'EXPORT' ? 'export' : 'erase';
    if (verb === 'erase' && !window.confirm('پاک‌سازی داده‌ها (GDPR Erasure) حساب شما را ناشناس‌سازی و غیرفعال می‌کند و قابل بازگشت نیست. تأیید می‌کنید؟')) return;
    setBusy(verb + '-' + r.id); setError(''); setNotice('');
    try {
      const out = await api<{ status: string; totalRecords?: number; legalRetention?: string[] }>(`/privacy/requests/${r.id}/${verb}`, { method: 'POST', body: JSON.stringify({}) });
      const kept = out.legalRetention?.length ? ` · رکوردهای غیرقابل‌پاکسازیِ نگهداری‌شده: ${out.legalRetention.map(x => ENTITY_FA[x] ?? x).join('، ')}` : '';
      setNotice(
        verb === 'erase'
          ? `پاک‌سازی کامل شد؛ حساب ناشناس‌سازی و غیرفعال شد${kept}.`
          : `خروجی ${fa(r.type)} آماده شد — ${fmtNum(out.totalRecords)} رکورد.`,
      );
      await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function downloadExport(r: PReq) {
    setBusy('dl-' + r.id); setError(''); setNotice('');
    try {
      const url = r.manifestUrl ?? (await api<any>(`/privacy/requests/${r.id}/export/status`))?.manifestUrl ?? null;
      if (!url) throw new Error('نشانی بستهٔ خروجی در دسترس نیست — ابتدا درخواست را اجرا کنید.');
      const blob = await apiBlob(url);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = `srip-privacy-${r.id}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      setNotice('دانلود بستهٔ خروجی آغاز شد (manifest شامل SHA-256 هر بخش).');
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function showExportStatus(r: PReq) {
    setBusy('st-' + r.id); setError(''); setNotice('');
    try {
      const st = await api<any>(`/privacy/requests/${r.id}/export/status`);
      setNotice(`وضعیت: ${fa(st?.status)}${st?.totalRecords != null ? ` · ${fmtNum(st.totalRecords)} رکورد` : ''}${st?.completedAt ? ` · ${fmtDT(st.completedAt)}` : ''}`);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const busyOn = (k: string) => busy === k;
  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="حریم خصوصی / GDPR"
        title="حقوق داده و حریم خصوصی"
        description="شفافیت پردازش، ثبت و ابطال رضایت، درخواست دسترسی/خروجی/پاک‌سازی داده‌های شخصی، و ممیزی کامل رویدادها — همگی با مجوز و محدودهٔ سازمانی شما."
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <Link className="btn btn-ghost" href="/admin/retention"><Clock3 size={15} /> نگهداری داده</Link>
            <button className="btn btn-primary" onClick={() => { setError(''); setConsentOpen(true); }}><Plus size={15} /> ثبت رضایت</button>
            <button className="btn btn-primary" onClick={() => { setError(''); setReqOpen(true); }}><ClipboardList size={15} /> درخواست حق داده</button>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی</button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="stat-grid">
        <StatCard icon={<ShieldCheck size={18} />} label="خط‌مشی‌های پردازش فعال" value={fmtNum(policies.length)} iconClass="ic-purple" sub="سیاست‌های نگهداری و پاک‌سازی" />
        <StatCard icon={<HeartHandshake size={18} />} label="رضایت‌های فعال" value={fmtNum(granted)} iconClass="ic-blue" sub={`از ${fmtNum(consents.length)} رضایت ثبت‌شده`} />
        <StatCard icon={<ClipboardList size={18} />} label="درخواست‌های باز" value={fmtNum(openReqs)} iconClass="ic-gold" sub="در انتظار / در حال پردازش" />
        <StatCard icon={<FileDown size={18} />} label="خروجی‌های آماده" value={fmtNum(ready.length)} iconClass="ic-red" sub={`جمع ${fmtNum(readyRecords)} رکورد صادرشده`} />
      </div>

      {loading ? <Loading label="در حال بارگذاری حریم خصوصی…" /> : (
        <>
          {/* ------------------------- policies ------------------------- */}
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScrollText size={16} /> خط‌مشی‌های پردازش داده</h2>
                <p>مبنای نگهداشت و پاک‌سازی هر دسته از داده‌ها؛ مدیریت اجرایی در بخش «نگهداری داده» انجام می‌شود.</p>
              </div>
              <Badge tone="info">{fmtNum(policies.length)} سیاست</Badge>
            </div>
            {policies.length === 0 ? (
              <div className="empty-state">سیاست پردازش فعالی ثبت نشده است.</div>
            ) : (
              <div className="list">
                {policies.map(p => (
                  <article className="listRow" key={p.id} style={{ alignItems: 'flex-start' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--purple, #7c3aed) 12%, transparent)', color: 'var(--purple, #7c3aed)' }}>
                      <Building2 size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <b>{ENTITY_FA[p.entityType] ?? p.entityType}</b>
                        <Badge tone={p.erasable === false ? 'danger' : 'success'}>{p.erasable === false ? 'غیرقابل پاک‌سازی' : 'قابل پاک‌سازی'}</Badge>
                        {p.exportable && <Badge tone="info">خروجی‌پذیر</Badge>}
                      </span>
                      <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 2 }}>
                        {PURPOSE_FA[p.purpose] ?? p.purpose}
                        {p.legalBasis ? ` · مبنای قانونی: ${LEGAL_FA[p.legalBasis] ?? p.legalBasis}` : ''}
                        {p.classification ? ` · طبقه‌بندی: ${CLASS_FA[p.classification] ?? p.classification}` : ''}
                      </span>
                    </span>
                    <span style={{ textAlign: 'left', fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <BadgeCheck size={12} style={{ verticalAlign: -1 }} /> نگهداشت:
                      <b style={{ display: 'block', textAlign: 'left' }}>{p.retentionDays != null ? `${fmtNum(p.retentionDays)} روز` : 'نامحدود'}</b>
                    </span>
                  </article>
                ))}
              </div>
            )}
            {policies.some(p => p.erasable === false) && (
              <p className="t-muted" style={{ margin: '10px 0 0', fontSize: 11 }}>
                <Lock size={11} style={{ verticalAlign: -2 }} /> برخی دسته‌ها (مانند الزام قانونی) از دامنهٔ پاک‌سازی مستثنی هستند و پس از درخواست پاک‌سازی با برچسب «بازداشت قانونی» نگهداری می‌شوند.
              </p>
            )}
          </section>

          {/* ------------------------- consents ------------------------- */}
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><HeartHandshake size={16} /> رضایت‌نامه‌های من</h2>
                <p>رضایت برای هر هدف پردازش با نسخه و زمان اعطا/ابطال؛ ثبت دوبارهٔ رضایتِ ابطال‌شده، آن را فعال می‌کند.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => { setError(''); setConsentOpen(true); }}><Plus size={14} /> رضایت جدید</button>
            </div>
            {consents.length === 0 ? (
              <div className="empty-state">
                رضایتی ثبت نشده است. برای شفافیت پردازش، نخستین رضایت خود را ثبت کنید.
              </div>
            ) : (
              <div className="list">
                {consents.map(c => (
                  <article className="listRow" key={c.id} style={{ alignItems: 'center' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--blue, #2563eb) 12%, transparent)', color: 'var(--blue, #2563eb)' }}><Handshake size={15} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <b>{PURPOSE_FA[c.purpose] ?? c.purpose}</b>
                        <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{fa(c.status)}</Badge>
                      </span>
                      <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                        نسخهٔ {c.version} · منبع: {fa(c.source ?? 'USER')}
                        {c.grantedAt ? ` · اعطا: ${fmtDT(c.grantedAt, false)}` : ''}
                        {c.revokedAt ? ` · ابطال: ${fmtDT(c.revokedAt, false)}` : ''}
                      </span>
                    </span>
                    {c.status === 'GRANTED' && (
                      <button className="danger-action" onClick={() => revokeConsent(c)} disabled={busyOn('rev-' + c.id)}>
                        {busyOn('rev-' + c.id) ? '…' : <><Ban size={13} /> ابطال رضایت</>}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ------------------------- requests ------------------------- */}
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ClipboardList size={16} /> درخواست‌های حق داده</h2>
                <p>دسترسی (ACCESS)، خروجی (EXPORT) و پاک‌سازی (ERASURE)؛ درخواست بازِ تکراری برای هر نوع به‌صورت خودکار ادغام می‌شود.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => { setError(''); setReqOpen(true); }}><ClipboardList size={14} /> درخواست جدید</button>
            </div>
            {requests.length === 0 ? (
              <div className="empty-state">درخواستی ثبت نشده است — از دکمهٔ «درخواست حق داده» شروع کنید.</div>
            ) : (
              <div className="list">
                {requests.map(r => {
                  const recs = r.result?.totalRecords ?? null;
                  const kept = r.result?.blockedLegalRetention;
                  return (
                    <article className="listRow" key={r.id} style={{ alignItems: 'flex-start' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: r.type === 'ERASURE' ? 'color-mix(in srgb, var(--red, #dc2626) 12%, transparent)' : 'color-mix(in srgb, var(--blue, #2563eb) 12%, transparent)', color: r.type === 'ERASURE' ? 'var(--red, #dc2626)' : 'var(--blue, #2563eb)' }}>{REQUEST_ICON[r.type] ?? <FileJson size={15} />}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b>{fa(r.type)}</b>
                          <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{fa(r.status)}</Badge>
                          {r.status === 'COMPLETED' && recs != null && (
                            <Badge tone="info">{fmtNum(recs)} رکورد</Badge>
                          )}
                        </span>
                        <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                          {r.reason ? `دلیل: ${r.reason} · ` : ''}
                          ثبت: {fmtDT(r.createdAt)}
                          {r.completedAt ? ` · تکمیل: ${fmtDT(r.completedAt)}` : ''}
                        </span>
                        {kept && kept.length > 0 && (
                          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--gold, #d97706)', marginTop: 3 }}>
                            <Lock size={10} style={{ verticalAlign: -1 }} /> بازداشت قانونی: {kept.map(x => ENTITY_FA[x] ?? x).join('، ')}
                          </span>
                        )}
                      </span>
                      <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {['ACCESS', 'EXPORT'].includes(r.type) && r.status === 'PENDING' && (
                          <button className="secondary-action" onClick={() => runRequest(r)} disabled={busyOn((r.type === 'ACCESS' ? 'access' : 'export') + '-' + r.id)}>
                            {busyOn((r.type === 'ACCESS' ? 'access' : 'export') + '-' + r.id) ? '…' : <><FileDown size={13} /> {r.type === 'ACCESS' ? 'تهیهٔ بستهٔ دسترسی' : 'اجرای خروجی'}</>}
                          </button>
                        )}
                        {['ACCESS', 'EXPORT'].includes(r.type) && r.status === 'PROCESSING' && (
                          <button className="secondary-action" onClick={() => showExportStatus(r)} disabled={busyOn('st-' + r.id)}>
                            {busyOn('st-' + r.id) ? '…' : 'بررسی وضعیت'}
                          </button>
                        )}
                        {r.status === 'COMPLETED' && (r.manifestUrl ?? recs != null) && ['ACCESS', 'EXPORT'].includes(r.type) && (
                          <button className="secondary-action" onClick={() => downloadExport(r)} disabled={busyOn('dl-' + r.id)}>
                            {busyOn('dl-' + r.id) ? '…' : <><Download size={13} /> دانلود خروجی</>}
                          </button>
                        )}
                        {r.type === 'ERASURE' && ['PENDING', 'PROCESSING'].includes(r.status) && (
                          <button className="danger-action" onClick={() => runRequest(r)} disabled={busyOn('erase-' + r.id)}>
                            {busyOn('erase-' + r.id) ? '…' : <><Trash2 size={13} /> اجرای پاک‌سازی</>}
                          </button>
                        )}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ------------------------- audit ------------------------- */}
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Search size={16} /> ممیزی حریم خصوصی</h2>
                <p>آخرین رویدادهای ثبت‌شده بر نهادهای PrivacyRequest / PrivacyData / UserPrivacyData (تا ۵۰۰ رویداد).</p>
              </div>
              <Badge tone="info">{fmtNum(auditRows.length)} رویداد</Badge>
            </div>
            {auditRows.length === 0 ? (
              <div className="empty-state">رویداد ممیزی حریم خصوصی هنوز ثبت نشده است.</div>
            ) : (
              <div className="list">
                {auditRows.slice(0, 8).map(a => (
                  <article className="listRow" key={a.id} style={{ alignItems: 'center' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `color-mix(in srgb, ${AUDIT_TONE[a.action] ?? '#64748b'} 13%, transparent)`, color: AUDIT_TONE[a.action] ?? '#64748b' }}>
                      {a.action === 'DELETE' ? <Trash2 size={13} /> : a.action === 'CREATE' ? <Plus size={13} /> : <ShieldCheck size={13} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <b>{fa(a.action)}</b>
                        <Badge tone="neutral">{a.entity ?? '—'}</Badge>
                        {a.entityId && <code dir="ltr" style={{ fontSize: 10 }}>{String(a.entityId).slice(0, 14)}</code>}
                      </span>
                      {(() => {
                        const mm = (a.meta && typeof a.meta === 'object' && !Array.isArray(a.meta) && a.meta.meta) ? a.meta.meta : (a.meta ?? {});
                        const entries = Object.entries(mm as Record<string, any>).filter(([k]) => !['before', 'after'].includes(k));
                        if (entries.length === 0) return null;
                        return (
                          <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                            {entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ').slice(0, 110)}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="t-muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap', textAlign: 'left' }}>
                      <UserRound size={11} style={{ verticalAlign: -1 }} /> {a.actorEmail ?? '—'}
                      <span style={{ display: 'block', fontSize: 9.5 }}>{fmtDT(a.at)}</span>
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ------------------------- modal: request ------------------------- */}
      <Modal
        open={reqOpen}
        title="درخواست حق داده"
        description="بر پایهٔ GDPR مواد ۱۵–۱۷: دسترسی، انتقال‌پذیری (خروجی) یا پاک‌سازی داده‌های شخصی خود را ثبت کنید."
        onClose={() => setReqOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setReqOpen(false)}><X size={14} /> انصراف</button>
          <button type="submit" form="privacy-request-form" className="btn btn-primary" disabled={busyOn('new-req')}>{busyOn('new-req') ? 'در حال ثبت…' : 'ثبت درخواست'}</button>
        </>}
      >
        <form id="privacy-request-form" className="entity-form" onSubmit={submitRequest}>
          <div className="field">
            <label className="field-label">نوع درخواست</label>
            <select value={reqType} onChange={x => setReqType(x.target.value)}>
              <option value="ACCESS">دسترسی (ACCESS) — مشاهدهٔ همهٔ داده‌های من</option>
              <option value="EXPORT">خروجی (EXPORT) — بستهٔ JSONL قابل انتقال</option>
              <option value="ERASURE">پاک‌سازی (ERASURE) — حذف و ناشناس‌سازی کامل</option>
            </select>
          </div>
          <div className="field full">
            <label className="field-label">دلیل (اختیاری)</label>
            <textarea value={reqReason} onChange={x => setReqReason(x.target.value)} placeholder="شرح کوتاه دلیل درخواست…" rows={3} />
          </div>
          {reqType === 'ERASURE' && (
            <div className="notice" role="note" style={{ borderColor: 'var(--red,#dc2626)', color: 'var(--red,#dc2626)' }}>
              <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> پاک‌سازی، نشست‌ها و داده‌های احراز هویت را لغو، و حساب را ناشناس‌سازی و غیرفعال می‌کند. داده‌های مشمول «الزام قانونی» فقط بازداشت می‌شوند.
            </div>
          )}
        </form>
      </Modal>

      {/* ------------------------- modal: consent ------------------------- */}
      <Modal
        open={consentOpen}
        title="ثبت رضایت جدید"
        description="رضایت برای یک هدف پردازش با نسخهٔ مشخص ثبت می‌شود؛ ثبتِ تکراری، رضایت همان هدف/نسخه را به‌روزرسانی و فعال می‌کند."
        onClose={() => setConsentOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setConsentOpen(false)}><X size={14} /> انصراف</button>
          <button type="submit" form="privacy-consent-form" className="btn btn-primary" disabled={busyOn('consent')}>{busyOn('consent') ? 'در حال ثبت…' : 'ثبت رضایت'}</button>
        </>}
      >
        <form id="privacy-consent-form" className="entity-form" onSubmit={grantConsent}>
          <div className="field full">
            <label className="field-label" htmlFor="consent-purpose">هدف پردازش <span className="req">*</span></label>
            <input id="consent-purpose" list="purpose-suggestions" value={purpose} onChange={x => setPurpose(x.target.value)} required placeholder="مثلاً marketing (بازاریابی)" />
            <datalist id="purpose-suggestions">
              {PURPOSE_SUGGESTIONS.map(p => <option key={p} value={p}>{PURPOSE_FA[p] ?? p}</option>)}
            </datalist>
            <small className="t-muted" style={{ display: 'block', marginTop: 3 }}>کلیدهای پیشنهادی: {PURPOSE_SUGGESTIONS.map(p => `${p} (${PURPOSE_FA[p] ?? ''})`).join('، ')}</small>
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="consent-version">نسخهٔ سیاست <span className="req">*</span></label>
            <input id="consent-version" value={version} onChange={x => setVersion(x.target.value)} required placeholder="مثلاً 1.0" />
          </div>
          <p className="t-muted" style={{ fontSize: 11, margin: 0 }}>
            <Lock size={11} style={{ verticalAlign: -2 }} /> منبع رضایت «کاربر» ثبت می‌شود و هر تغییر (اعطا/ابطال) در ممیزی حریم خصوصی باقی می‌ماند.
          </p>
        </form>
      </Modal>
    </main>
  );
}
