'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiPost } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from './page-ui';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Building2, CalendarX2,
  CopyX, Fingerprint, Gauge, MailX,
  RefreshCw, ScanSearch, Search, ShieldCheck, UserX, Users, Wallet, Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  داشبورد کیفیت داده — هم‌مسیر با /data-quality و /data-management/  */
/*  quality؛ پاریتی DataQualityService: GET /data/quality · POST scan  */
/*  · GET /data/duplicates · POST /data/duplicates/detect             */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const faDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const list = (x: any) => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.values ?? []);
const reasonFA = (r: string) => {
  const m = r.match(/^([a-z_]+)(?::([0-9.]+))?$/);
  if (!m) return r;
  const map: Record<string, string> = {
    name: 'نام یکسان', name_similarity: 'شباهت نام', domain: 'دامنهٔ وب یکسان', registration_id: 'شناسهٔ ثبت یکسان',
    phone: 'شمارهٔ تماس یکسان', country: 'کشور یکسان', email: 'ایمیل یکسان', organization: 'سازمان یکسان',
  };
  return m[2] ? `${map[m[1]] ?? m[1]} (٪${fmt.format(Math.round(Number(m[2]) * 100))})` : (map[m[1]] ?? m[1]);
};

type Cap = { values: string[]; total: number; truncated: boolean };
type StaleVal = { id: string; lastInteractionAt: string | null; nextReviewAt: string | null; reviewCadenceDays: number };
type Snapshot = {
  id: string; organizationId: string | null; createdById: string; scannedAt: string;
  metrics: {
    generatedAt: string; checks: string[];
    duplicateOrganizations: { ids: string[]; reasons: string[] }[];
    missingOwners: Cap;
    missingContacts: { organizations: Cap; people: Cap };
    staleRelationships: Cap & { values: (string | StaleVal)[] };
    invalidEmails: Cap & { values: { entityType: string; id: string; field: string }[] };
    missingOrganizations: { people: Cap; contacts: Cap };
    missingDates: { relationships: Cap; meetings: Cap; actions: Cap; interactions: Cap };
    incompleteProfiles: { organizations: Cap; people: Cap };
    coverage: { organizations: number; people: number; relationships: number; interactions: number; meetings: number; actions: number };
    bounded: boolean; maxReturnedIds: number;
  };
};
type Me = { permissions?: string[] };
type Candidate = { id: string; score: number; reasons: string[]; entityType: string };
type Named = { id: string; name: string };

const OrgSelect = ({ value, onChange, orgs, disabled }: { value: string; onChange: (v: string) => void; orgs: Named[]; disabled?: boolean }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{ maxWidth: 230 }} disabled={disabled} aria-label="سازمان">
    <option value="">همهٔ سازمان‌های محدوده</option>
    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
  </select>
);

export default function QualityDashboard({ mode = 'hub' }: { mode?: 'hub' | 'ops' }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [orgs, setOrgs] = useState<Named[]>([]);
  const [orgSel, setOrgSel] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  /* detect tool state */
  const [detType, setDetType] = useState<'ORGANIZATION' | 'PERSON'>('ORGANIZATION');
  const [fOrg, setFOrg] = useState('');
  const [fName, setFName] = useState('');
  const [fWeb, setFWeb] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fReg, setFReg] = useState('');
  const [fCountry, setFCountry] = useState('');
  const [fFirst, setFFirst] = useState('');
  const [fLast, setFLast] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError(''); setForbidden(false);
    try {
      const [s, o, m] = await Promise.all([
        api<Snapshot>('/data/quality'),
        api<Named[]>('/organizations').then(x => list(x).map((o: any) => ({ id: o.id, name: o.name })) as Named[]).catch(() => [] as Named[]),
        api<Me>('/auth/me').catch(() => null),
      ]);
      setSnap(s); setOrgs(o); setMe(m);
    } catch (x) {
      const e = x as Error;
      setError(e.message);
      if (e.message.includes('data.quality.read') || e.message.includes('مجوز')) setForbidden(true);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function scan() {
    setScanning(true); setError(''); setNotice('');
    try {
      const body = orgSel ? { organizationId: orgSel } : {};
      const s = await apiPost<Snapshot>('/data/quality/scan', body);
      setSnap(s);
      setNotice(`بازبینی کیفیت با موفقیت انجام شد — ${fmt.format(issueTotalOf(s))} مورد در ${s.metrics.checks.length} سنجه.`);
    } catch (x) { setError((x as Error).message); }
    finally { setScanning(false); }
  }
  async function rescanForOrg(v: string) {
    setOrgSel(v);
    if (!v) return;
    setScanning(true); setError('');
    try {
      const s = await apiPost<Snapshot>('/data/quality/scan', { organizationId: v });
      setSnap(s);
      setNotice(`بازبینی محدوده به «${orgs.find(o => o.id === v)?.name ?? v}» انجام شد.`);
    } catch (x) { setError((x as Error).message); }
    finally { setScanning(false); }
  }

  const m = snap?.metrics;
  const cov = m?.coverage ?? { organizations: 0, people: 0, relationships: 0, interactions: 0, meetings: 0, actions: 0 };
  const totalCovered = cov.organizations + cov.people + cov.relationships + cov.meetings + cov.actions;
  const issueTotal = useMemo(() => {
    if (!m) return 0;
    return (m.missingOwners?.total ?? 0) + (m.missingContacts?.organizations?.total ?? 0) + (m.missingContacts?.people?.total ?? 0)
      + (m.staleRelationships?.total ?? 0) + (m.invalidEmails?.total ?? 0)
      + (m.missingDates?.relationships?.total ?? 0) + (m.missingDates?.meetings?.total ?? 0) + (m.missingDates?.actions?.total ?? 0)
      + (m.incompleteProfiles?.organizations?.total ?? 0) + (m.incompleteProfiles?.people?.total ?? 0)
      + (m.duplicateOrganizations?.length ?? 0) + (m.missingOrganizations?.people?.total ?? 0) + (m.missingOrganizations?.contacts?.total ?? 0);
  }, [m]);
  const issueTotalOf = (s: Snapshot) => s == null ? 0 : (() => {
    const mm = s.metrics;
    return (mm.missingOwners?.total ?? 0) + (mm.missingContacts?.organizations?.total ?? 0) + (mm.missingContacts?.people?.total ?? 0)
      + (mm.staleRelationships?.total ?? 0) + (mm.invalidEmails?.total ?? 0)
      + (mm.missingDates?.relationships?.total ?? 0) + (mm.missingDates?.meetings?.total ?? 0) + (mm.missingDates?.actions?.total ?? 0)
      + (mm.incompleteProfiles?.organizations?.total ?? 0) + (mm.incompleteProfiles?.people?.total ?? 0)
      + (mm.duplicateOrganizations?.length ?? 0);
  })();
  const score = totalCovered ? Math.max(0, Math.min(100, Math.round(100 - (issueTotal / totalCovered) * 100))) : 100;
  const orgOf = (id: string) => orgs.find(o => o.id === id);
  const affectedOrgs = useMemo(() => {
    if (!m) return 0;
    const set = new Set<string>();
    (m.missingOwners?.values ?? []).forEach(x => set.add(x));
    (m.missingContacts?.organizations?.values ?? []).forEach(x => set.add(x));
    (m.incompleteProfiles?.organizations?.values ?? []).forEach(x => set.add(x));
    (m.invalidEmails?.values ?? []).forEach((v: any) => v.entityType === 'Organization' && set.add(v.id));
    return set.size;
  }, [m]);
  const canExec = useMemo(() => {
    const p = me?.permissions ?? [];
    return p.includes('*') || p.includes('data.quality.execute') || p.includes('data.quality.read');
  }, [me]);
  const canImport = useMemo(() => {
    const p = me?.permissions ?? [];
    return p.includes('*') || p.includes('data.import');
  }, [me]);

  const gradeTone = score >= 85 ? 'success' : score >= 60 ? 'warning' : 'danger';

  async function detect(e: FormEvent) {
    e.preventDefault(); setError(''); setCands(null);
    if (!fOrg) { setError('برای تشخیص تکراری، سازمان مقصد را انتخاب کنید.'); return; }
    const data = detType === 'ORGANIZATION'
      ? { name: fName, website: fWeb || undefined, phone: fPhone || undefined, registrationId: fReg || undefined, country: fCountry || undefined }
      : { firstName: fFirst, lastName: fLast, email: fEmail || undefined, phone: fPhone || undefined };
    setDetecting(true);
    try {
      const out = await apiPost<Candidate[]>('/data/duplicates/detect', { entityType: detType, organizationId: fOrg, data });
      setCands(out);
    } catch (x) { setError((x as Error).message); }
    finally { setDetecting(false); }
  }
  const demoOrg = () => { setDetType('ORGANIZATION'); setFOrg('org-3'); setFName('بانک ملی پارس'); setFWeb(''); setFPhone(''); setFReg(''); setFCountry('ایران'); };
  const demoPerson = () => { setDetType('PERSON'); setFOrg('org-2'); setFFirst('سارا'); setFLast('محمدی'); setFEmail('sara@arya-tech.ir'); setFPhone(''); };

  const isOps = mode === 'ops';
  const checksList = m ? [
    { key: 'dups', icon: <CopyX size={15} />, title: 'سازمان‌های تکراری', desc: 'نام، دامنهٔ وب، شمارهٔ تماس یا شناسهٔ ثبت یکسان', total: m.duplicateOrganizations?.length ?? 0, tone: (m.duplicateOrganizations?.length ?? 0) > 0 ? 'danger' as const : 'success' as const },
    { key: 'owners', icon: <UserX size={15} />, title: 'بدون مالک', desc: 'سازمان‌هایی که مالک (مسئول رابطه) ندارند', total: m.missingOwners?.total ?? 0, tone: (m.missingOwners?.total ?? 0) > 0 ? 'warning' as const : 'success' as const },
    { key: 'contacts', icon: <Users size={15} />, title: 'بدون مخاطب', desc: 'سازمان/شخص بدون مخاطبِ مرتبط', total: (m.missingContacts?.organizations?.total ?? 0) + (m.missingContacts?.people?.total ?? 0), tone: (m.missingContacts?.organizations?.total ?? 0) + (m.missingContacts?.people?.total ?? 0) > 0 ? 'warning' as const : 'success' as const },
    { key: 'stale', icon: <Wallet size={15} />, title: 'روابط کهنه', desc: 'بدون تعامل اخیر یا بازبینیِ عقب‌افتاده', total: m.staleRelationships?.total ?? 0, tone: (m.staleRelationships?.total ?? 0) > 0 ? 'warning' as const : 'success' as const },
    { key: 'invalid', icon: <MailX size={15} />, title: 'ایمیل‌های نامعتبر', desc: 'قالب ایمیل نادرست در سازمان‌ها/اشخاص', total: m.invalidEmails?.total ?? 0, tone: (m.invalidEmails?.total ?? 0) > 0 ? 'danger' as const : 'success' as const },
    { key: 'missingOrgs', icon: <Building2 size={15} />, title: 'سازمان‌های ناموجود', desc: 'ارجاع به سازمان/مخاطبِ حذف‌شده', total: (m.missingOrganizations?.people?.total ?? 0) + (m.missingOrganizations?.contacts?.total ?? 0), tone: 'success' as const },
    { key: 'noDates', icon: <CalendarX2 size={15} />, title: 'تاریخ‌های ازدست‌رفته', desc: 'بازبینی رابطه، زمان جلسه یا موعد اقدام نامشخص', total: (m.missingDates?.relationships?.total ?? 0) + (m.missingDates?.meetings?.total ?? 0) + (m.missingDates?.actions?.total ?? 0) + (m.missingDates?.interactions?.total ?? 0), tone: (m.missingDates?.relationships?.total ?? 0) > 0 ? 'warning' as const : 'success' as const },
    { key: 'incomplete', icon: <Gauge size={15} />, title: 'پروفایل‌های ناقص', desc: 'کمبود فیلدهای الزامی (نام، کشور، وب، تماس، ایمیل)', total: (m.incompleteProfiles?.organizations?.total ?? 0) + (m.incompleteProfiles?.people?.total ?? 0), tone: (m.incompleteProfiles?.organizations?.total ?? 0) + (m.incompleteProfiles?.people?.total ?? 0) > 0 ? 'danger' as const : 'success' as const },
  ] : [];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow={isOps ? 'مدیریت داده' : 'داده و کیفیت'}
        title={isOps ? 'یکسان‌سازی کیفیت داده' : 'کیفیت داده'}
        description="پویش یکپارچهٔ کیفیت: رکوردهای تکراری، بدون مالک/مخاطب، روابط کهنه، ایمیل‌های نامعتبر، تاریخ‌های ازدست‌رفته و پروفایل‌های ناقص — هر دو مسیر /data-quality و /data-management/quality به یک موتور (GET /data/quality · POST /data/quality/scan) وصل‌اند."
        actions={
          <>
            {isOps && <Badge tone="info">هم‌مسیر با /data-quality</Badge>}
            <OrgSelect value={orgSel} onChange={rescanForOrg} orgs={orgs} disabled={scanning} />
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing || scanning}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
            <button className="btn btn-primary" onClick={scan} disabled={scanning || !canExec}>
              {scanning ? 'در حال پویش…' : <><ScanSearch size={15} /> پویش کیفیت</>}
            </button>
          </>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}
      {forbidden && !m && (
        <div className="notice" style={{ borderColor: 'var(--gold,#d97706)', color: 'var(--gold,#b45309)' }}>
          <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> حساب شما مجوزهای کیفیت داده (data.quality.read / data.quality.execute) را ندارد — این قابلیت مانند سامانهٔ واقعی ویژهٔ نقش‌های عملیاتی (مدیر/مدیر ارشد) است.
        </div>
      )}
      {loading && !m ? <Loading label="در حال پویش کیفیت داده…" /> : m && snap && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '2px 0 14px' }}>
            <Badge tone="info"><Fingerprint size={11} style={{ verticalAlign: -2 }} /> شناسهٔ پویش: <code dir="ltr" style={{ fontSize: 9.5 }}>{snap.id}</code></Badge>
            <Badge tone="neutral"><RefreshCw size={11} style={{ verticalAlign: -2 }} /> {faDT(snap.scannedAt)}</Badge>
            <Badge tone="neutral">پوشش: {snap.organizationId ? (orgOf(snap.organizationId)?.name ?? snap.organizationId) : 'همهٔ سازمان‌های محدوده'}</Badge>
            <Badge tone="neutral">محدودشده: {m.bounded ? 'بله' : 'خیر'} (بیشینه {fmt.format(m.maxReturnedIds)} شناسه)</Badge>
          </div>

          <div className="stat-grid">
            <StatCard icon={<Building2 size={18} />} label="پوشش رکوردها" value={fmt.format(totalCovered)} sub={`${fmt.format(cov.organizations)} سازمان · ${fmt.format(cov.people)} شخص · ${fmt.format(cov.relationships)} رابطه`} iconClass="ic-blue" />
            <StatCard icon={<AlertTriangle size={18} />} label="موارد کیفیت" value={fmt.format(issueTotal)} sub="جمع‌شده از ۸ سنجهٔ پویش" iconClass={issueTotal > 0 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<BadgeCheck size={18} />} label="امتیاز کیفیت" value={<>{fmt.format(score)}<small style={{ fontSize: 12 }}> /۱۰۰</small></>} sub="از نسبت موارد به پوشش" iconClass={gradeTone === 'danger' ? 'ic-red' : gradeTone === 'warning' ? 'ic-gold' : 'ic-green'} />
            <StatCard icon={<Gauge size={18} />} label="سازمان‌های دارای مشکل" value={fmt.format(affectedOrgs)} sub={`از ${fmt.format(cov.organizations)} سازمان در محدوده`} iconClass="ic-gold" />
            <StatCard icon={<Zap size={18} />} label="روابط نیازمند توجه" value={fmt.format((m.staleRelationships?.total ?? 0) + (m.missingDates?.relationships?.total ?? 0))} sub="کهنه یا بدون برنامهٔ بازبینی" iconClass="ic-purple" />
            <StatCard icon={<ShieldCheck size={18} />} label="پروفایل‌های ناقص" value={fmt.format((m.incompleteProfiles?.organizations?.total ?? 0) + (m.incompleteProfiles?.people?.total ?? 0))} sub="سازمان‌ها و اشخاص" iconClass="ic-blue" />
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScanSearch size={16} /> نتیجهٔ پویش (۸ سنجه)</h2>
                <p>برای هر سنجه، شناسهٔ رکوردهای مشکل‌دار از همان پویش می‌آید؛ کلیک روی هر شناسه، صفحهٔ همان موجودیت را باز می‌کند.</p>
              </div>
              <Badge tone={issueTotal > 0 ? 'warning' : 'success'}>{issueTotal > 0 ? `${fmt.format(issueTotal)} مورد` : 'پاک'}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {checksList.map(c => {
                const empty = c.total === 0;
                return (
                  <div key={c.key} style={{ border: '1px solid var(--border,#e2e8f0)', borderRadius: 12, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: empty ? 'color-mix(in srgb, var(--green,#16a34a) 10%, transparent)' : 'color-mix(in srgb, var(--gold,#d97706) 12%, transparent)', color: empty ? 'var(--green,#16a34a)' : 'var(--gold,#b45309)' }}>{c.icon}</span>
                    <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                      <b style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{c.title} {empty ? <Badge tone="success">پاک</Badge> : <Badge tone={c.tone}>{fmt.format(c.total)}</Badge>}</b>
                      <small className="t-muted" style={{ display: 'block', marginTop: 1, fontSize: 10 }}>{c.desc}</small>
                    </div>
                    <div style={{ flex: '1 1 320px', minWidth: 240, display: 'grid', gap: 4 }}>
                      {!empty && c.key === 'dups' && (m.duplicateOrganizations ?? []).map((g, i) => (
                        <span key={i} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <small className="t-muted">گروه {fmt.format(i + 1)}:</small>
                          {g.ids.map(id => <code key={id} dir="ltr" style={{ fontSize: 9.5 }}>{id}</code>)}
                          {g.reasons.map(r => <Badge key={r} tone="neutral">{reasonFA(r)}</Badge>)}
                        </span>
                      ))}
                      {!empty && c.key === 'owners' && (m.missingOwners?.values ?? []).map(id => <span key={id} style={{ fontSize: 10.5 }}><code dir="ltr" style={{ fontSize: 9.5 }}>{id}</code> {orgOf(id)?.name && <small className="t-muted">— {orgOf(id)?.name}</small>}</span>)}
                      {!empty && c.key === 'contacts' && (
                        <span style={{ display: 'grid', gap: 3 }}>
                          {(m.missingContacts?.organizations?.values ?? []).length > 0 && <small>سازمان‌ها: {(m.missingContacts.organizations.values ?? []).map(id => <span key={id} style={{ fontSize: 10.5 }}><code dir="ltr" style={{ fontSize: 9.5 }}>{id}</code>{orgOf(id)?.name && <> — {orgOf(id)?.name}</>} · </span>)}</small>}
                          {(m.missingContacts?.people?.values ?? []).length > 0 && <small>اشخاص: {(m.missingContacts.people.values ?? []).join('، ')}</small>}
                        </span>
                      )}
                      {!empty && c.key === 'stale' && (m.staleRelationships?.values ?? []).map((v: any) => (
                        <span key={v.id} style={{ fontSize: 10.5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <code dir="ltr" style={{ fontSize: 9.5 }}>{v.id}</code>
                          <small className="t-muted">تعامل آخر: {faDT(v.lastInteractionAt)}</small>
                          <Badge tone="warning">بازبینی: {faDT(v.nextReviewAt)}</Badge>
                          <Badge tone="neutral">بازهٔ {fmt.format(v.reviewCadenceDays)} روز</Badge>
                        </span>
                      ))}
                      {!empty && c.key === 'invalid' && (m.invalidEmails?.values ?? []).map((v: any) => (
                        <span key={`${v.entityType}-${v.id}`} style={{ fontSize: 10.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Badge tone="neutral">{v.entityType === 'Organization' ? 'سازمان' : 'شخص'}</Badge>
                          <code dir="ltr" style={{ fontSize: 9.5 }}>{v.id}</code>
                          <small className="t-muted">فیلد: {v.field}</small>
                          {v.entityType === 'Organization' && orgOf(v.id)?.name && <small>— {orgOf(v.id)?.name}</small>}
                        </span>
                      ))}
                      {!empty && c.key === 'noDates' && (
                        <span style={{ display: 'grid', gap: 3 }}>
                          {(m.missingDates?.relationships?.values ?? []).length > 0 && <small>بازبینی رابطه: {(m.missingDates.relationships.values ?? []).join('، ')}</small>}
                          {(m.missingDates?.meetings?.values ?? []).length > 0 && <small>زمان جلسه: {(m.missingDates.meetings.values ?? []).join('، ')}</small>}
                          {(m.missingDates?.actions?.values ?? []).length > 0 && <small>موعد اقدام: {(m.missingDates.actions.values ?? []).join('، ')}</small>}
                        </span>
                      )}
                      {!empty && c.key === 'incomplete' && (
                        <span style={{ display: 'grid', gap: 3 }}>
                          {(m.incompleteProfiles?.organizations?.values ?? []).length > 0 && <small>سازمان‌ها: {(m.incompleteProfiles.organizations.values ?? []).map(id => <span key={id} style={{ fontSize: 10.5 }}><code dir="ltr" style={{ fontSize: 9.5 }}>{id}</code>{orgOf(id)?.name && <> — {orgOf(id)?.name}</>} · </span>)}</small>}
                          {(m.incompleteProfiles?.people?.values ?? []).length > 0 && <small>اشخاص: {(m.incompleteProfiles.people.values ?? []).join('، ')}</small>}
                        </span>
                      )}
                      {!empty && c.key === 'missingOrgs' && <small>ارجاع به موجودیت حذف‌شده یافت نشد.</small>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel" style={{ borderColor: 'color-mix(in srgb, var(--blue,#2563eb) 25%, transparent)' }}>
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Search size={16} /> تشخیص تکراری هنگام ثبت (پیش‌ثبت)</h2>
                <p>پاریتی POST /data/duplicates/detect: پیش از ثبت سازمان/شخص، کاندیداهای تکراری با شباهت لون‌اشتاین و قواعد دامنه/شناسه/تلفن/کشور سنجیده می‌شوند (حد آستانه ۰٫۴۰). نیازمند مجوز data.import.</p>
              </div>
              <Badge tone={canImport ? 'success' : 'warning'}>{canImport ? 'مجوز data.import فعال' : 'بدون مجوز data.import'}</Badge>
            </div>
            {!canImport ? <p className="t-muted" style={{ fontSize: 11 }}>حساب شما مجوز data.import را ندارد؛ ابزار پیش‌ثبت برای نقش‌های دارای مجوز وارد کردن داده فعال است.</p> : (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button className="btn btn-ghost" style={{ minHeight: 0, padding: '6px 10px', fontSize: 10.5 }} onClick={demoOrg}>نمونه: «بانک ملی پارس»</button>
                  <button className="btn btn-ghost" style={{ minHeight: 0, padding: '6px 10px', fontSize: 10.5 }} onClick={demoPerson}>نمونه: «سارا محمدی»</button>
                </div>
                <form className="entity-form" onSubmit={detect} style={{ gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                    <div className="field" style={{ minWidth: 150 }}>
                      <label className="field-label" htmlFor="det-type">نوع نهاد</label>
                      <select id="det-type" value={detType} onChange={e => { setDetType(e.target.value as any); setCands(null); }}>
                        <option value="ORGANIZATION">سازمان</option>
                        <option value="PERSON">شخص</option>
                      </select>
                    </div>
                    <div className="field" style={{ minWidth: 200 }}>
                      <label className="field-label" htmlFor="det-org">سازمان مقصد <span className="req">*</span></label>
                      <OrgSelect value={fOrg} onChange={setFOrg} orgs={orgs} />
                    </div>
                    {detType === 'ORGANIZATION' ? (
                      <>
                        <div className="field"><label className="field-label" htmlFor="det-name">نام سازمان</label><input id="det-name" dir="rtl" value={fName} onChange={e => setFName(e.target.value)} placeholder="نامی که می‌خواهید ثبت کنید" /></div>
                        <div className="field"><label className="field-label" htmlFor="det-web">وب‌سایت</label><input id="det-web" dir="ltr" value={fWeb} onChange={e => setFWeb(e.target.value)} placeholder="example.com" style={{ fontSize: 10.5 }} /></div>
                        <div className="field"><label className="field-label" htmlFor="det-ph">تلفن</label><input id="det-ph" dir="ltr" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="+98 …" style={{ fontSize: 10.5 }} /></div>
                        <div className="field"><label className="field-label" htmlFor="det-reg">شناسهٔ ثبت</label><input id="det-reg" dir="ltr" value={fReg} onChange={e => setFReg(e.target.value)} style={{ fontSize: 10.5 }} /></div>
                        <div className="field"><label className="field-label" htmlFor="det-country">کشور</label><input id="det-country" value={fCountry} onChange={e => setFCountry(e.target.value)} placeholder="ایران" style={{ fontSize: 10.5 }} /></div>
                      </>
                    ) : (
                      <>
                        <div className="field"><label className="field-label" htmlFor="det-f">نام</label><input id="det-f" value={fFirst} onChange={e => setFFirst(e.target.value)} /></div>
                        <div className="field"><label className="field-label" htmlFor="det-l">نام خانوادگی</label><input id="det-l" value={fLast} onChange={e => setFLast(e.target.value)} /></div>
                        <div className="field"><label className="field-label" htmlFor="det-em">ایمیل</label><input id="det-em" dir="ltr" value={fEmail} onChange={e => setFEmail(e.target.value)} style={{ fontSize: 10.5 }} /></div>
                        <div className="field"><label className="field-label" htmlFor="det-ph2">تلفن</label><input id="det-ph2" dir="ltr" value={fPhone} onChange={e => setFPhone(e.target.value)} style={{ fontSize: 10.5 }} /></div>
                      </>
                    )}
                    <button className="btn btn-primary" style={{ padding: '9px 16px', minHeight: 0 }} disabled={detecting}>
                      {detecting ? 'در حال سنجش…' : <><ScanSearch size={14} /> بررسی تکراری</>}
                    </button>
                  </div>
                </form>
                {cands && (
                  <div style={{ marginTop: 12 }}>
                    <b style={{ fontSize: 11.5, display: 'block', marginBottom: 7 }}>کاندیداهای تکراری ({fmt.format(cands.length)})</b>
                    {cands.length === 0 ? <p className="t-muted" style={{ fontSize: 11 }}>کاندیدایی بالای آستانه یافت نشد — ثبت امن به نظر می‌رسد.</p> : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {cands.map(c => (
                          <div key={c.id} style={{ border: '1px solid color-mix(in srgb, var(--red,#dc2626) 25%, transparent)', background: 'color-mix(in srgb, var(--red,#dc2626) 4%, transparent)', borderRadius: 10, padding: '8px 10px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Badge tone="danger">{Math.round(c.score * 100)}٪</Badge>
                            <Badge tone="neutral">{c.entityType === 'ORGANIZATION' ? 'سازمان' : 'شخص'}</Badge>
                            <code dir="ltr" style={{ fontSize: 9.5 }}>{c.id}</code>
                            {c.entityType === 'ORGANIZATION' && orgOf(c.id)?.name && <b style={{ fontSize: 11 }}>{orgOf(c.id)?.name}</b>}
                            <span style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {c.reasons.map(r => <Badge key={r} tone="warning">{reasonFA(r)}</Badge>)}
                            </span>
                            <span style={{ width: 110, background: 'color-mix(in srgb, var(--border,#e2e8f0) 60%, transparent)', borderRadius: 99, height: 6 }}>
                              <span style={{ display: 'block', height: 6, borderRadius: 99, width: `${Math.round(c.score * 100)}%`, background: c.score >= 0.7 ? '#dc2626' : c.score >= 0.5 ? '#d97706' : '#eab308' }} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {isOps && (
            <div className="notice" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ArrowLeft size={14} /> برای نمای کامل (KPI و سنجه‌ها) به صفحهٔ «کیفیت داده» بروید — هر دو صفحه به یک پویش و یک شناسهٔ snapshot وصل‌اند و نتیجهٔ پویش در سرور ذخیره می‌شود.
            </div>
          )}
        </>
      )}
    </main>
  );
}
