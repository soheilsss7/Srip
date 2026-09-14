'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa, labelKey, KEY_FA, STATUS_FA } from '../_lib/fa';
import { clearStoredExportApproval, downloadReport, storedExportApprovalId } from '../_lib/report-export';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, Building2, CheckCircle2, Clock3, CloudDownload, Database, FileDown, FileJson2,
  FileSpreadsheet, FileText, FolderKanban, Globe2, HeartPulse, Link2, ListChecks, Network, RefreshCw,
  Scale, Share2, ShieldCheck, Table2, Target, TrendingUp, Users, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  گزارش‌ها و خروجی داده — پاریتی ReportingService                    */
/*  GET /reports/:kind (با محدودهٔ سازمانی)                            */
/*  GET /reports/:kind/export/:format?approvalId=  (تأیید دو مرحله‌ای)  */
/* ------------------------------------------------------------------ */

const ORG_TYPE_FA: Record<string, string> = {
  HOLDING: 'هلدینگ', SUBSIDIARY: 'شرکت تابعه', PARTNER: 'شریک', CUSTOMER: 'مشتری',
  SUPPLIER: 'تأمین‌کننده', INVESTOR: 'سرمایه‌گذار', GOVERNMENT: 'دولتی', BANK: 'بانک', AGENCY: 'نمایندگی',
};
const DIR_FA: Record<string, string> = { OURS: 'ما به طرف مقابل', THEIRS: 'طرف مقابل به ما', BOTH: 'دوطرفه' };
const MISC_FA: Record<string, string> = { ...ORG_TYPE_FA, ...DIR_FA, STRATEGIC_PARTNERSHIP: 'مشارکت راهبردی' };
const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const fmtDT = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) + '، ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
};
function cell(key: string, v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '—';
  if (typeof v === 'number') return fmtN(v);
  if (typeof v === 'string') {
    const dt = fmtDT(v);
    if (dt) return dt;
    const idFa = faId(v);
    if (idFa !== v) return idFa;
    const up = v.toUpperCase();
    const tr = MISC_FA[up] ?? STATUS_FA[up] ?? fa(up);
    if (tr !== up && tr !== v) return tr;
    return v;
  }
  return String(v);
}
const COL_FA: Record<string, string> = {
  sourceOrganization: 'سازمان مبدأ', targetOrganization: 'سازمان مقصد', sourcePerson: 'معرف‌کننده',
  targetPerson: 'معرفی‌شده', direction: 'جهت', probability: 'احتمال', expectedDate: 'تاریخ مورد انتظار',
  legalName: 'نام حقوقی', website: 'وب‌سایت', registrationId: 'شناسه ثبت', people: 'افراد',
  relationships: 'روابط', meetings: 'جلسات', projects: 'پروژه‌ها', opportunities: 'فرصت‌ها',
  documents: 'اسناد', nextActionAt: 'اقدام بعدی', targetAt: 'هدف زمانی', owner: 'مسئول',
  department: 'بخش', overdue: 'دیرکرد', section: 'بخش', recommendation: 'پیشنهاد',
  healthyRelationships: 'روابط سالم', atRiskRelationships: 'روابط پرریسک', openOpportunities: 'فرصت‌های باز',
  projectsWithOverdueWork: 'پروژه‌های دارای کار عقب‌افتاده', upcomingMeetings: 'جلسات پیشِ رو',
  companies: 'شرکت‌ها', relationshipsTotal: 'کل روابط',
};
const colLabel = (k: string) => COL_FA[k] ?? KEY_FA[k] ?? labelKey(k);

type MiniOrg = { id: string; name: string; type: string };
type KindDef = { key: string; fa: string; desc: string; shape: 'table' | 'summary' };
const KINDS: KindDef[] = [
  { key: 'relationship-health', fa: 'سلامت روابط', desc: 'امتیاز سلامت، ریسک، راهبردی و زمان اقدام بعدی همهٔ روابط در محدودهٔ شما (حداقل یک سر در محدوده).', shape: 'table' },
  { key: 'relationship-risk', fa: 'روابط پرریسک', desc: 'روابطی با ریسک ≥ ۵۰ یا سلامت < ۵۰ — همان فهرست «در معرض خطر» خلاصهٔ مدیریت ارشد.', shape: 'table' },
  { key: 'company', fa: 'شرکت‌ها', desc: 'شرکت‌های محدوده با شمار افراد، روابط، جلسات، پروژه‌ها و فرصت‌های هرکدام.', shape: 'table' },
  { key: 'contact', fa: 'اشخاص و تماس‌ها', desc: 'اشخاص محدوده با سمت، بخش، راه‌های تماس و امتیاز نفوذ.', shape: 'table' },
  { key: 'meeting', fa: 'جلسات', desc: 'جلسات سازمان‌ها و روابط در محدوده، با هدف، نتیجه و شرکت‌کنندگان.', shape: 'table' },
  { key: 'commitment', fa: 'تعهدات', desc: 'تعهدات باز و انجام‌شده با سررسید، مسئول و ریسک.', shape: 'table' },
  { key: 'action', fa: 'اقدامات', desc: 'اقدامات با اولویت، سررسید، مسئول و وضعیت دیرکرد.', shape: 'table' },
  { key: 'opportunity', fa: 'فرصت‌ها', desc: 'فرصت‌های فروش/همکاری با احتمال موفقیت و تاریخ مورد انتظار.', shape: 'table' },
  { key: 'network', fa: 'نمای شبکه', desc: 'شمارش کلی شبکهٔ محدوده: سازمان‌ها، اشخاص، روابط، جلسات، تعهدات، فرصت‌ها و پروژه‌ها.', shape: 'summary' },
  { key: 'risk', fa: 'ماتریس ریسک', desc: 'همهٔ روابط مرتب‌شده با ریسک نزولی — ستون فقرات گزارش ریسک.', shape: 'table' },
  { key: 'influence', fa: 'نفوذ اشخاص', desc: 'اشخاص محدوده مرتب با امتیاز نفوذ (افراد کلیدی بالای جدول).', shape: 'table' },
  { key: 'executive', fa: 'مدیران اجرایی', desc: 'پروفایل اجرایی اشخاص: سمت، بخش، سازمان و امتیاز نفوذ.', shape: 'table' },
  { key: 'referral', fa: 'معرفی‌ها', desc: 'معرفی‌های مرتبط با محدوده با نرخ موفقیت و وضعیت هر معرفی.', shape: 'summary' },
  { key: 'project', fa: 'پروژه‌ها', desc: 'پروژه‌های محدوده با اولویت، هدف، مسئول و بازهٔ زمانی.', shape: 'table' },
  { key: 'subsidiary-comparison', fa: 'مقایسهٔ زیرمجموعه‌ها', desc: 'مقایسهٔ شرکت‌های تابعه/شریک از نظر افراد، روابط، جلسات، پروژه‌ها و فرصت‌ها.', shape: 'table' },
  { key: 'holding', fa: 'ساختار هلدینگ', desc: 'سازمان‌های محدوده و ساختار سلسله‌مراتب (ریشه‌ها).', shape: 'summary' },
  { key: 'executive-summary', fa: 'خلاصهٔ مدیریت ارشد', desc: 'تصویر یک‌صفحه‌ای: شاخص‌های کلان، روابط پرریسک، فرصت‌های باز و پیشنهادها.', shape: 'summary' },
];
const KINDS_MAP = new Map(KINDS.map(k => [k.key, k]));
const SUMMARY_ROW_FA: Record<string, string> = {
  organizationCount: 'سازمان‌ها', peopleCount: 'اشخاص', relationshipCount: 'روابط', meetings: 'جلسات',
  commitments: 'تعهدات', opportunities: 'فرصت‌ها', projects: 'پروژه‌ها', successful: 'موفق', successRate: 'نرخ موفقیت',
  total: 'کل', organizations: 'سازمان‌ها', roots: 'ریشه‌ها',
  companies: 'سازمان‌ها', relationshipsTotal: 'کل روابط',
  averageRelationshipHealth: 'میانگین سلامت رابطه', averageRelationshipRisk: 'میانگین ریسک رابطه',
  weightedOpportunityValue: 'ارزش موزون فرصت‌ها',
};
const ID_FA_PREFIX: Record<string, string> = {
  r: 'رابطهٔ', rel: 'رابطهٔ', org: 'سازمانٔ', organization: 'سازمانٔ', p: 'شخصٔ', person: 'شخصٔ',
  o: 'فرصتٔ', pr: 'پروژهٔ', project: 'پروژهٔ', m: 'جلسهٔ', meeting: 'جلسهٔ', i: 'تعاملٔ',
  interaction: 'تعاملٔ', a: 'اقدامٔ', c: 'تعهدٔ', u: 'کاربرٔ', rec: 'پیشنهادٔ', e: 'پیوندٔ', ce: 'رویدادٔ',
};
const faId = (v: unknown): string => {
  const raw = String(v ?? '');
  const m = raw.match(/^([a-z]+)[-:](\d+)$/i);
  if (!m) return raw;
  return `${ID_FA_PREFIX[m[1].toLowerCase()] ?? (m[1].toLowerCase() + 'ٔ')} ${new Intl.NumberFormat('fa-IR').format(Number(m[2]))}`;
};
const SUMMARY_ICON: Record<string, React.ReactNode> = {
  organizations: <Building2 size={17} />, organizationCount: <Building2 size={17} />, peopleCount: <Users size={17} />,
  relationshipCount: <Share2 size={17} />, relationshipsTotal: <Share2 size={17} />, meetings: <Clock3 size={17} />,
  commitments: <ListChecks size={17} />, opportunities: <Target size={17} />, projects: <FolderKanban size={17} />,
  total: <Link2 size={17} />, successful: <CheckCircle2 size={17} />, successRate: <TrendingUp size={17} />,
  companies: <Building2 size={17} />, healthyRelationships: <HeartPulse size={17} />, atRiskRelationships: <AlertTriangle size={17} />,
  openOpportunities: <Target size={17} />, projectsWithOverdueWork: <FolderKanban size={17} />, upcomingMeetings: <Clock3 size={17} />,
};

function ReportTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="empty-state">داده‌ای برای این گزارش در محدودهٔ انتخابی نیست.</div>;
  const keys = Object.keys(rows[0]);
  const num = (k: string) => typeof rows[0][k] === 'number';
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{keys.map(k => <th key={k} style={num(k) ? { textAlign: 'left' } : undefined}>{colLabel(k)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)}>
              {keys.map(k => (
                <td key={k} style={{ fontSize: 12 }}>
                  {k === 'id' || /@|^https?:/.test(String(r[k] ?? '')) ? <code dir="ltr" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace' }}>{cell(k, r[k])}</code> : cell(k, r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stats({ map }: { map: Record<string, unknown> }) {
  const items = Object.entries(map).filter(([, v]) => typeof v === 'number');
  return (
    <div className="stat-grid" style={{ marginBottom: 0 }}>
      {items.map(([k, v]) => (
        <StatCard key={k} icon={SUMMARY_ICON[k] ?? <Database size={17} />} label={SUMMARY_ROW_FA[k] ?? colLabel(k)} value={fmtN(v)} />
      ))}
    </div>
  );
}

export default function Reports() {
  const { me, can } = useWorkspace();
  const isOwner = can('*');
  const canExport = can('report.export');
  const canJson = can('enterprise.admin');

  const [kind, setKind] = useState('executive-summary');
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<MiniOrg[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /* مسترپلن فاز ۱/۷ — گزارش دوره‌ای خودکار (الگوی 4Degrees/DemandFarm) */
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [periodic, setPeriodic] = useState<any>(null);
  const [periodicBusy, setPeriodicBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const meta = KINDS_MAP.get(kind) ?? KINDS[0];

  useEffect(() => {
    api<MiniOrg[]>('/organizations').then(o => setOrgs(Array.isArray(o) ? o : [])).catch(() => {});
  }, []);

  async function load(k = kind, org = orgId) {
    setLoading(true); setError('');
    try {
      const q = org ? `?organizationId=${encodeURIComponent(org)}` : '';
      const payload = await api<any>(`/reports/${encodeURIComponent(k)}${q}`);
      setData(payload);
    } catch (x) { setData(null); setError((x as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const loadPeriodic = async (p: 'weekly' | 'monthly', oid?: string) => {
    setPeriodicBusy(true);
    try {
      const qs = new URLSearchParams({ period: p });
      if (oid ?? orgId) qs.set('organizationId', String(oid ?? orgId));
      setPeriodic(await api<any>(`/reports/periodic?${qs.toString()}`));
    } catch (x) { setError((x as Error).message); }
    finally { setPeriodicBusy(false); }
  };
  useEffect(() => { loadPeriodic('weekly'); /* eslint-disable-next-line */ }, []);

  async function exportFile(format: string) {
    setExporting(format); setError(''); setNotice('');
    try {
      const result = await downloadReport(kind, format as 'csv' | 'xlsx' | 'pdf' | 'json', () => {});
      if (result.status === 'downloaded') {
        setTouched(t => ({ ...t, [kind]: false }));
        await clearStoredExportApproval(kind); // درخواست تأیید مصرف شد؛ خروجی بعدی درخواست تازه می‌گیرد
        setNotice(`فایل ${format.toUpperCase()} گزارش «${meta.fa}» دانلود شد و در لاگ خروجی داده ثبت گردید.`);
      } else if (result.status === 'approval_pending') {
        setTouched(t => ({ ...t, [kind]: true }));
        setNotice(`درخواست خروجی ${format.toUpperCase()} «${meta.fa}» ثبت شد (شناسه: ${result.approvalId}). پس از تأیید در صفحهٔ «تأییدها»، دوباره دکمهٔ خروجی را بزنید تا فایل دانلود شود.`);
      } else {
        setError(result.message);
      }
    } catch (x) { setError((x as Error).message); }
    finally { setExporting(''); }
  }

  const rows = useMemo(() => (Array.isArray(data?.data) ? data.data as Record<string, unknown>[] : []), [data]);
  const storedId = storedExportApprovalId(kind);
  const storedNote = touched[kind] ? 'در انتظار تأیید — پس از تأیید، دوباره خروجی بگیرید.' : 'درخواست قبلی برای این گزارش ثبت شده است؛ اگر تأیید شده، خروجی بگیرید و اگر نه، از صفحهٔ تأییدها اقدام کنید.';

  function summaryPart(): React.ReactNode {
    if (!data) return null;
    if (kind === 'executive-summary') {
      const s = (data.summary ?? {}) as Record<string, unknown>;
      const kpi = (data.kpi ?? {}) as Record<string, unknown>;
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <Stats map={s} />
          <div className="stat-grid">
            {Object.entries(kpi).filter(([, v]) => typeof v === 'number').map(([k, v]) => (
              <StatCard key={k} icon={SUMMARY_ICON[k] ?? <TrendingUp size={17} />} label={SUMMARY_ROW_FA[k] ?? colLabel(k)} value={fmtN(v)} />
            ))}
          </div>
          <SectionCard title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={16} className="t-danger" /> روابط در معرض خطر</span>} description="ریسک ≥ ۵۰ یا سلامت < ۵۰">
            {Array.isArray(data.risks) && data.risks.length ? <ReportTable rows={data.risks as Record<string, unknown>[]} /> : <div className="empty-state">رابطهٔ پرریسکی در محدوده نیست.</div>}
          </SectionCard>
          <SectionCard title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Target size={16} /> فرصت‌های باز</span>} description="فرصت‌هایی که نه برنده شده‌اند و نه از دست رفته‌اند">
            {Array.isArray(data.opportunities) && data.opportunities.length ? <ReportTable rows={data.opportunities as Record<string, unknown>[]} /> : <div className="empty-state">فرصت بازی در محدوده نیست.</div>}
          </SectionCard>
          {Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
            <SectionCard title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={16} /> پیشنهادهای خودکار</span>} description="بر اساس روابط پرریسک">
              <ul style={{ display: 'grid', gap: 8, fontSize: 12.5, listStyle: 'none', padding: 0 }}>
                {(data.recommendations as Array<Record<string, unknown>>).map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Scale size={14} className="t-muted" style={{ marginTop: 2 }} />
                    <span>{String(r.recommendation ?? '')} <span className="t-muted">· {faId(r.relationshipId)}</span></span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      );
    }
    if (kind === 'network') {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <Stats map={(data.summary ?? {}) as Record<string, unknown>} />
          <p className="muted">گزارش شبکه در نسخهٔ کامل شامل گراف تعاملی، مرکزیت، پل‌ها و گلوگاه‌ها نیز می‌شود (سرویس network در دمو محدود به شمارش است).</p>
        </div>
      );
    }
    if (kind === 'holding') {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="stat-grid">
            <StatCard icon={<Building2 size={17} />} label="سازمان‌ها در محدوده" value={fmtN(data.organizations ?? 0)} iconClass="ic-indigo" />
            <StatCard icon={<Share2 size={17} />} label="ریشه‌های ساختار" value={fmtN((data.roots ?? []).length)} iconClass="ic-green" />
          </div>
          {Array.isArray(data.roots) && data.roots.length > 0 && (
            <SectionCard title="سازمان‌ها (سلسله‌مراتب)" description="در دمو، دادهٔ سازمانی فاقد والد است؛ ساختار در نسخهٔ کامل با children بازگشتی می‌آید">
              <ul style={{ display: 'grid', gap: 6, fontSize: 12.5, listStyle: 'none', padding: 0 }}>
                {(data.roots as Array<Record<string, unknown>>).map((r, i) => (
                  <li key={String(r.id ?? i)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                    <Building2 size={13} className="t-muted" />
                    <b>{String(r.name ?? '')}</b>
                    <Badge tone="info">{MISC_FA[String(r.type ?? '').toUpperCase()] ?? String(r.type ?? '')}</Badge>
                    <span className="t-muted" style={{ fontSize: 11 }}>{String(r.industry ?? '')} {r.country ? `· ${String(r.country)}` : ''}</span>
                    <code dir="ltr" style={{ marginInlineStart: 'auto', fontSize: 9.5, color: 'var(--text-muted)' }}>{String(r.id)}</code>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      );
    }
    if (kind === 'referral') {
      const s = (data.summary ?? {}) as Record<string, unknown>;
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <Stats map={s} />
          <SectionCard title="معرفی‌ها" description="وضعیت هر معرفی در محدوده">
            {rows.length ? <ReportTable rows={rows} /> : <div className="empty-state">معرفی‌ای در محدوده نیست.</div>}
          </SectionCard>
        </div>
      );
    }
    return null;
  }

  const scopeLabel = orgId ? (orgs.find(o => o.id === orgId)?.name ?? orgId) : `همهٔ محدودهٔ من (${orgs.length} سازمان)`;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="گزارش‌گیری"
        title="گزارش‌ها"
        description="گزارش‌های عملیاتی و مدیریتی با رعایت محدودهٔ دسترسی شما تولید می‌شوند. خروجی فایل (جدولی، صفحه‌ای، سند و متنی) فقط پس از تأیید درخواست، صادر و در «لاگ خروجی داده» ثبت می‌شود."
        actions={
          <div className="toolbar">
            {isOwner && <Link className="btn btn-ghost" href="/admin/exports"><CloudDownload size={15} /> لاگ خروجی داده</Link>}
            <button className="btn btn-secondary" onClick={() => load()} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
          </div>
        }
      />

      <section className="panel" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 320px' }}>
          <span className="field-label">گزارش</span>
          <select value={kind} onChange={e => { const k = e.target.value; setKind(k); setError(''); setNotice(''); load(k, orgId); }}>
            {KINDS.map(k => <option key={k.key} value={k.key}>{k.fa}</option>)}
          </select>
        </label>
        {orgs.length > 1 && (
          <label style={{ flex: '0 1 260px' }}>
            <span className="field-label">محدوده</span>
            <select value={orgId} onChange={e => { const o = e.target.value; setOrgId(o); setError(''); setNotice(''); load(kind, o); }}>
              <option value="">همهٔ محدودهٔ من</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        <div style={{ flex: '0 0 auto', paddingBottom: 2 }}>
          <Badge tone="info">{meta.fa} · {scopeLabel}</Badge>
        </div>
      </section>

      {/* ─── مسترپلن فاز ۱/۷: گزارش دوره‌ای خودکار — الگوی «گزارش جلسهٔ دوشنبه» 4Degrees ─── */}
      <section className="panel" aria-label="گزارش دوره‌ای خودکار">
        <div className="panel-title">
          <div>
            <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Clock3 size={16} /> گزارش دوره‌ای خودکار</h2>
            <p>گزارش هفتگی/ماهانهٔ آمادهٔ ارائه: روابط سردشونده، تعهدات و اقدامات عقب‌افتاده، شکاف‌های بحرانی عمومی، تمرکزهای تک‌نفره و اهداف رشد — همه از دادهٔ زندهٔ همین محدوده.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="segmented" role="tablist">
              <button role="tab" aria-selected={period === 'weekly'} className={period === 'weekly' ? 'active' : ''}
                onClick={() => { setPeriod('weekly'); loadPeriodic('weekly'); }}>هفتگی</button>
              <button role="tab" aria-selected={period === 'monthly'} className={period === 'monthly' ? 'active' : ''}
                onClick={() => { setPeriod('monthly'); loadPeriodic('monthly'); }}>ماهانه</button>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={periodicBusy} onClick={() => loadPeriodic(period)}>
              <RefreshCw size={13} /> بازتولید
            </button>
          </div>
        </div>
        {periodic ? (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
              <Badge tone={periodic.counts?.cooling ? 'warning' : 'success'}>روابط سردشونده: {fmtN(periodic.counts?.cooling ?? 0)}</Badge>
              <Badge tone={periodic.counts?.overdueCommitments ? 'danger' : 'success'}>تعهدات عقب‌افتاده: {fmtN(periodic.counts?.overdueCommitments ?? 0)}</Badge>
              <Badge tone={periodic.counts?.overdueActions ? 'danger' : 'success'}>اقدامات عقب‌افتاده: {fmtN(periodic.counts?.overdueActions ?? 0)}</Badge>
              <Badge tone={periodic.counts?.criticalGaps ? 'warning' : 'success'}>شکاف بحرانی عمومی: {fmtN(periodic.counts?.criticalGaps ?? 0)}</Badge>
              <Badge tone={periodic.counts?.concentrations ? 'warning' : 'success'}>تمرکز تک‌نفره: {fmtN(periodic.counts?.concentrations ?? 0)}</Badge>
              <Badge tone="info">اهداف رشد: {fmtN(periodic.counts?.growthTargets ?? 0)}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              <div>
                <h4 style={{ fontSize: 12.5, margin: '4px 0 6px', display: 'flex', gap: 5, alignItems: 'center' }}><HeartPulse size={13} /> روابط سردشونده</h4>
                {periodic.sections?.coolingRelationships?.length ? (
                  <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 4 }}>
                    {periodic.sections.coolingRelationships.map((r: any) => (
                      <li key={r.relationshipId} style={{ fontSize: 12 }}>
                        {r.relationshipName} — <span className="t-muted">{fmtN(r.daysSinceLastInteraction)} روز بدون تعامل (هدف {fmtN(r.targetDays)})</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="criteria-saved">کیدنس همهٔ روابط برقرار است.</p>}
                <h4 style={{ fontSize: 12.5, margin: '10px 0 6px', display: 'flex', gap: 5, alignItems: 'center' }}><ListChecks size={13} /> عقب‌افتاده‌ها</h4>
                {(periodic.sections?.overdueCommitments?.length || periodic.sections?.overdueActions?.length) ? (
                  <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 4 }}>
                    {periodic.sections.overdueCommitments.map((c: any) => <li key={c.id} style={{ fontSize: 12 }}>تعهد: {c.description} — <span className="t-muted">{fmtDT(c.dueAt)}</span></li>)}
                    {periodic.sections.overdueActions.map((a: any) => <li key={a.id} style={{ fontSize: 12 }}>اقدام: {a.title} — <span className="t-muted">{fmtDT(a.dueAt)}</span></li>)}
                  </ul>
                ) : <p className="criteria-saved">تعهد یا اقدام عقب‌افتاده‌ای نیست.</p>}
              </div>
              <div>
                <h4 style={{ fontSize: 12.5, margin: '4px 0 6px', display: 'flex', gap: 5, alignItems: 'center' }}><AlertTriangle size={13} /> شکاف‌های بحرانی و تمرکزها</h4>
                {(periodic.sections?.criticalGaps?.length || periodic.sections?.concentrations?.length) ? (
                  <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 4 }}>
                    {periodic.sections.criticalGaps.map((g: any, i: number) => <li key={i} style={{ fontSize: 12 }}>گپ: {g.title ?? g.groupFa ?? g.gapId}</li>)}
                    {periodic.sections.concentrations.map((c: any) => <li key={c.relationshipId} style={{ fontSize: 12 }}>تمرکز: {c.relationshipName} — {fmtN(c.topShare)}٪ روی {c.dominantPerson ?? '—'}</li>)}
                  </ul>
                ) : <p className="criteria-saved">شکاف بحرانی یا تمرکز تک‌نفره‌ای نیست.</p>}
                <h4 style={{ fontSize: 12.5, margin: '10px 0 6px', display: 'flex', gap: 5, alignItems: 'center' }}><Target size={13} /> اهداف رشد پیشنهادی</h4>
                {periodic.sections?.growthTargets?.length ? (
                  <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 4 }}>
                    {periodic.sections.growthTargets.map((g: any) => <li key={g.relationshipId} style={{ fontSize: 12 }}>{g.relationshipName} — امتیاز فرصت {fmtN(g.opportunityScore)}</li>)}
                  </ul>
                ) : <p className="criteria-saved">رابطهٔ پرپتانسیل بدون فرصت بازی نیست.</p>}
              </div>
            </div>
            <div style={{ marginTop: 10, background: 'var(--srip-accent-softer, rgba(15,23,42,.04))', borderRadius: 10, padding: '10px 12px', whiteSpace: 'pre-line', fontSize: 12.5, lineHeight: 1.9 }}>
              {periodic.briefText}
            </div>
            <p className="t-muted" style={{ fontSize: 11, margin: '8px 0 0' }}>
              هر بازتولید، رویداد «تولید گزارش دوره‌ای» را در موتور گردش‌کار ثبت می‌کند تا ارسال خودکار آن قابل فعال‌سازی باشد.
            </p>
          </>
        ) : (
          <div className="skeleton skeleton-card" style={{ height: 120 }} />
        )}
      </section>

      <p className="muted" style={{ marginTop: 2 }}>{meta.desc}</p>

      <ErrorCard message={error} />

      {notice && (
        <div className={touched[kind] ? 'notice' : 'notice'} role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ flex: 1 }}>{notice}</span>
          {touched[kind] && <Link className="btn btn-secondary btn-sm" href="/approvals">رفتن به تأییدها</Link>}
        </div>
      )}
      {storedId && !touched[kind] && (
        <div className="notice" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>{storedNote} <code dir="ltr" style={{ fontSize: 10.5 }}>{storedId}</code></span>
          <button className="btn btn-secondary btn-sm" onClick={async () => { await clearStoredExportApproval(kind); setNotice('درخواست ثبت‌شدهٔ قبلی پاک شد.'); }}>
            <X size={13} /> پاک کردن درخواست قبلی
          </button>
        </div>
      )}

      {loading ? <Loading label="در حال تولید گزارش…" /> : data && (
        <section className="panel">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <b className="t-primary" style={{ fontSize: 14 }}>{meta.fa}</b>
            {rows.length > 0 && <Badge tone="success">{fmtN(rows.length)} ردیف</Badge>}
            <span className="t-muted" style={{ fontSize: 11.5, marginInlineStart: 'auto', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <Clock3 size={12} /> تولیدشده در {fmtDT(data.generatedAt) ?? '—'}
            </span>
          </div>

          {meta.shape === 'table'
            ? (rows.length ? <ReportTable rows={rows} /> : <div className="empty-state">داده‌ای برای این گزارش در محدودهٔ انتخابی نیست.</div>)
            : summaryPart()}
        </section>
      )}

      {/* export panel */}
      {canExport && (
        <section className="panel" style={{ display: 'grid', gap: 10 }}>
          <div className="section-head">
            <div>
              <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FileDown size={16} /> خروجی فایل</h2>
              <p>خروجی فقط با درخواست تأیید و پس از تصمیم مالک صادر می‌شود و در لاگ خروجی داده با طبقه‌بندی «داخلی» ثبت می‌گردد. {!canJson && 'قالب متنی ویژهٔ مدیران سازمانی است.'} در محیط دمو، قالب‌های صفحه‌ای و سند به‌صورت فایل جدولی دانلود می‌شوند.</p>
            </div>
          </div>
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            {([['csv', 'CSV', <FileSpreadsheet key="i" size={15} />], ['xlsx', 'XLSX', <Table2 key="i" size={15} />], ['pdf', 'PDF', <FileText key="i" size={15} />], ...(canJson ? [['json', 'JSON', <FileJson2 key="i" size={15} />] as [string, string, React.ReactNode]] : [])] as Array<[string, string, React.ReactNode]>).map(([f, label, icon]) => (
              <button key={f} className="btn btn-primary" disabled={!!exporting || loading} onClick={() => exportFile(f)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {exporting === f ? <RefreshCw size={14} className="spin" /> : icon} {exporting === f ? 'در حال دریافت…' : `خروجی ${label}`}
              </button>
            ))}
            <span className="t-muted" style={{ fontSize: 11.5, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <ShieldCheck size={13} /> درخواست‌ها و دانلودها در ممیزی و لاگ خروجی ثبت می‌شوند
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
