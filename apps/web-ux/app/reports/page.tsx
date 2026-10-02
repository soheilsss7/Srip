'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa, labelKey, KEY_FA, STATUS_FA } from '../_lib/fa';
import { localeTag, t } from '../_lib/i18n';
import { clearStoredExportApproval, downloadReport, storedExportApprovalId } from '../_lib/report-export';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import IntelHub from '../_components/intel-hub';
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardCheck, Clock3, CloudDownload, Database, FileDown, FileJson2,
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
const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));
const fmtDT = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(localeTag(), { year: 'numeric', month: 'long', day: 'numeric' }) + '، ' + d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
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


/* ═══════════════════════════════════════════════════════════════════════════
   گام ۲.۷ مسترپلن — گزارش ماهانهٔ استاندارد (فرم ۱۵؛ بخش ۲۶ سند)
   قالب ثابت گزارش به مدیریت هلدینگ: خلاصهٔ مدیریتی + شاخص‌های کلیدی زندهٔ بخش ۲۶ +
   ریسک‌های درجه بالای بخش ۲۵ + انحراف‌های زمانی بیش از دو هفته (با علت، اثر بر مسیر
   بحرانی و اقدام جبرانی) + برنامهٔ ماه آینده. هر ماه فقط یک گزارش؛ سکوت درباره
   انحراف، تخلف گزارش‌دهی است.
   ═══════════════════════════════════════════════════════════════════════════ */
/* توجه: t() باید در زمان رندر صدا زده شود (نه ثابت ماژول) تا زبان پویا اعمال شود */
const pmrStatusFa = (s: string) => (s === 'SUBMITTED' ? t('ارائه‌شده') : t('پیش‌نویس'));
const KPI_TONE: Record<string, 'success' | 'warning' | 'danger'> = { ON_TARGET: 'success', NEAR: 'warning', OFF_TARGET: 'danger' };

function MonthlyReportCard() {
  const { can } = useWorkspace();
  const writable = can('program.write');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const nowD = new Date();
  const monthNow = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;
  const monthLabelFa = new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(nowD);
  const emptyForm = { label: monthLabelFa, month: monthNow, summary: '', nextMonthPlan: '', deviations: [] as Array<{ milestone: string; cause: string; criticalPathImpact: string; mitigation: string }> };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setErr('');
      const d: any = await api('/program/monthly-reports');
      setData(d);
      if (d.items?.length && !d.items.some((r: any) => r.id === selId)) setSelId(d.items[0].id);
    } catch (x: any) { setErr(x?.message ?? String(x)); }
  }, [selId]);
  useEffect(() => { load(); }, [load]);

  if (!data && !err) return null;
  const items: any[] = data?.items ?? [];
  const sel = items.find(r => r.id === selId) ?? items[0] ?? null;
  const stats = data?.stats ?? { total: 0, submitted: 0, draft: 0, onTime: 0 };

  const saveReport = async () => {
    setBusy(true);
    try {
      await api('/program/monthly-reports', { method: 'POST', body: JSON.stringify(form) });
      setFormOpen(false); setForm(emptyForm); await load();
    } catch (x: any) { setErr(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  const submitReport = async (id: string) => {
    setBusy(true);
    try { await api(`/program/monthly-reports/${id}/submit`, { method: 'POST' }); await load(); }
    catch (x: any) { setErr(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  const setDev = (i: number, k: string, v: string) => setForm(f => ({ ...f, deviations: f.deviations.map((d, j) => (j === i ? { ...d, [k]: v } : d)) }));

  return (
    <SectionCard
      title={t('گزارش ماهانهٔ استاندارد (فرم ۱۵)')}
      icon={<FileText size={16} />}
      description={t('قالب ثابت گزارش ماهانه به مدیریت هلدینگ — شاخص‌ها و ریسک‌های درجه بالا از داشبورد زنده برداشت می‌شوند؛ انحراف زمانی بیش از دو هفته باید با علت، اثر بر مسیر بحرانی و اقدام جبرانی توضیح داده شود.')}
      actions={
        <div className="toolbar">
          {writable && <button className="btn btn-ghost btn-sm" onClick={() => { setForm(emptyForm); setFormOpen(true); }}>{t('گزارش ماهانهٔ تازه')}</button>}
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> {t('بازخوانی')}</button>
        </div>
      }
    >
      {err && <ErrorCard message={err} />}
      <div className="pmr-stats">
        <span className="chip success">{t('ارائه‌شده')}: {fmtN(stats.submitted)}</span>
        <span className="chip warning">{t('پیش‌نویس')}: {fmtN(stats.draft)}</span>
        <span className="chip info">{t('به‌موقع')}: {fmtN(stats.onTime)}</span>
        <span className="chip neutral">{t('هدف')}: {fmtN(12)} {t('گزارش در سال')}</span>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">{t('هنوز گزارش ماهانه‌ای ثبت نشده است — قالب ثابت فرم ۱۵ را از دکمهٔ «گزارش ماهانهٔ تازه» آغاز کنید.')}</p>
      ) : (
        <div className="pmr-layout">
          <div className="pmr-list">
            {items.map(r => (
              <button type="button" key={r.id} className={`pmr-row ${sel?.id === r.id ? 'active' : ''}`} onClick={() => setSelId(r.id)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{r.label}</strong>
                  <small>{r.ownerRole} · {t('مهلت')}: {fmtDT(r.dueAt)?.split('،')[0] ?? '—'}</small>
                </span>
                <span className="pmr-badges">
                  <Badge tone={r.status === 'SUBMITTED' ? 'success' : 'warning'}>{pmrStatusFa(r.status)}</Badge>
                  {r.onTime === true && <Badge tone="info">{t('به‌موقع')}</Badge>}
                </span>
              </button>
            ))}
          </div>

          {sel && (
            <div className="pmr-detail">
              <div className="pmr-detail-head">
                <h3>{sel.label}</h3>
                <span>{sel.ownerRole}</span>
                {sel.submittedAt && <small>{t('ارائه')}: {fmtDT(sel.submittedAt)}</small>}
              </div>
              <div className="pmr-sec">
                <h4>{t('خلاصهٔ مدیریتی — وضعیت کلی ماه')}</h4>
                <p>{sel.summary || '—'}</p>
              </div>
              <div className="pmr-sec">
                <h4>{t('شاخص‌های کلیدی (بخش ۲۶)')} — {t('زنده')}</h4>
                <div className="pmr-kpis">
                  {(sel.live?.kpis ?? []).map((k: any) => (
                    <span key={k.id} className={`pmr-kpi ${KPI_TONE[k.status] ?? ''}`}><b>{k.valueLabel}</b><small>{k.title}</small></span>
                  ))}
                </div>
              </div>
              <div className="pmr-sec">
                <h4>{t('ریسک‌های درجه بالا (بخش ۲۵)')} — {t('زنده')}</h4>
                {(sel.live?.highRisks ?? []).length === 0 ? <p className="empty-state">{t('ریسک درجه بالای بازی وجود ندارد.')}</p> : (
                  <ul className="pmr-risks">
                    {(sel.live?.highRisks ?? []).map((r: any) => <li key={r.id} className="pmr-risk"><AlertTriangle size={13} /> <b>{r.title}</b> <small>· {r.ownerRole}</small></li>)}
                  </ul>
                )}
              </div>
              <div className="pmr-sec">
                <h4>{t('انحراف‌های زمانی بیش از دو هفته')}</h4>
                {(sel.deviations ?? []).length === 0 ? <p className="t-muted">{t('انحراف زمانی بیش از دو هفته‌ای ثبت نشده است.')}</p> : (
                  (sel.deviations ?? []).map((d: any) => (
                    <div key={d.id} className="pmr-dev">
                      <b>{d.milestone}</b>
                      <small>{t('علت')}: {d.cause} · {t('اثر بر مسیر بحرانی')}: {d.criticalPathImpact} · {t('اقدام جبرانی')}: {d.mitigation}</small>
                    </div>
                  ))
                )}
              </div>
              <div className="pmr-sec">
                <h4>{t('برنامهٔ ماه آینده')}</h4>
                <p>{sel.nextMonthPlan || '—'}</p>
              </div>
              {writable && sel.status === 'DRAFT' && (
                <div className="form-actions">
                  <button type="button" className="btn btn-primary btn-sm pmr-submit" disabled={busy} onClick={() => submitReport(sel.id)}>{busy ? t('در حال ثبت…') : t('ارائه به مدیریت هلدینگ')}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={formOpen} title={t('گزارش ماهانهٔ تازه (فرم ۱۵)')} onClose={() => setFormOpen(false)}>
        <form id="monthly-report-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); saveReport(); }}>
          <div className="field">
            <label className="field-label">{t('نام ماه گزارش')}</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field-label">{t('ماه (میلادی)')}</label>
            <input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
          </div>
          <div className="field full">
            <label className="field-label">{t('خلاصهٔ مدیریتی — وضعیت کلی ماه')}</label>
            <textarea rows={3} required value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
          </div>
          <div className="field full">
            <label className="field-label">{t('برنامهٔ ماه آینده')}</label>
            <textarea rows={2} value={form.nextMonthPlan} onChange={e => setForm(f => ({ ...f, nextMonthPlan: e.target.value }))} />
          </div>
          <div className="field full">
            <label className="field-label">{t('انحراف‌های زمانی بیش از دو هفته (اختیاری)')}</label>
            {form.deviations.map((d, i) => (
              <div className="pmr-dev-form" key={i}>
                <input placeholder={t('نقطهٔ عطف')} value={d.milestone} onChange={e => setDev(i, 'milestone', e.target.value)} />
                <input placeholder={t('علت')} value={d.cause} onChange={e => setDev(i, 'cause', e.target.value)} />
                <input placeholder={t('اثر بر مسیر بحرانی')} value={d.criticalPathImpact} onChange={e => setDev(i, 'criticalPathImpact', e.target.value)} />
                <input placeholder={t('اقدام جبرانی')} value={d.mitigation} onChange={e => setDev(i, 'mitigation', e.target.value)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, deviations: f.deviations.filter((_, j) => j !== i) }))}><X size={13} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, deviations: [...f.deviations, { milestone: '', cause: '', criticalPathImpact: '', mitigation: '' }] }))}>+ {t('انحراف زمانی')}</button>
            <p className="field-hint">{t('هر انحراف باید با هر سه قلم توضیح داده شود: علت، اثر بر مسیر بحرانی و اقدام جبرانی — سکوت درباره انحراف، تخلف گزارش‌دهی است.')}</p>
          </div>
          <div className="form-actions">
            <button type="button" className="srip-button" onClick={() => setFormOpen(false)}>{t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت پیش‌نویس گزارش')}</button>
          </div>
        </form>
      </Modal>
    </SectionCard>
  );
}

export default function Reports() {
  const { me, can, isRealTenant } = useWorkspace();
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
          <p className="muted">گزارش شبکه در نسخهٔ کامل شامل گراف تعاملی، مرکزیت، پل‌ها و گلوگاه‌ها نیز می‌شود{!isRealTenant && ' (سرویس network در دمو محدود به شمارش است)'}.</p>
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
            <SectionCard title="سازمان‌ها (سلسله‌مراتب)" description={!isRealTenant ? "در دمو، دادهٔ سازمانی فاقد والد است؛ ساختار در نسخهٔ کامل با children بازگشتی می‌آید" : "ساختار سلسله‌مراتب در نسخهٔ کامل با children بازگشتی می‌آید"}>
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

/* ═══ گام ۴.۵ — فرم ۱۸: صورت‌جلسهٔ تحویل برنامه به هلدینگ (بخش ۲۸.۱ سند؛ پیوست ب) ═══ */
function DeliveryCard() {
  const { can } = useWorkspace();
  const writable = can('program.write');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [reps, setReps] = useState({ programRep: '', holdingRep: '' });

  const load = useCallback(async () => {
    try { setErr(''); setData(await api('/program/delivery')); } catch (x: any) { setErr(x?.message ?? String(x)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data && !err) return null;

  const deliverItem = async (key: string) => {
    setBusy(true);
    try { setData(await api(`/program/delivery/items/${key}`, { method: 'POST', body: JSON.stringify({}) })); }
    catch (x: any) { setErr(x?.message ?? String(x)); }
    finally { setBusy(false); }
  };
  const completeStep = async (key: string) => {
    setBusy(true);
    try { setData(await api(`/program/delivery/steps/${key}`, { method: 'POST' })); }
    catch (x: any) { setErr(x?.message ?? String(x)); }
    finally { setBusy(false); }
  };
  const sign = async () => {
    setBusy(true);
    try { setData(await api('/program/delivery/sign', { method: 'POST', body: JSON.stringify(reps) })); }
    catch (x: any) { setErr(x?.message ?? String(x)); }
    finally { setBusy(false); }
  };

  return (
    <SectionCard
      className="delivery-panel"
      title={t('فرم ۱۸ — صورت‌جلسهٔ تحویل برنامه به هلدینگ')}
      icon={<ClipboardCheck size={16} />}
      description={t('فهرست پنج‌قلمی تحویل (بخش ۲۸.۱ سند) با شکل تحویل و گیرندهٔ هلدینگ، فرآیند هفت‌گام تحویل و امضای طرفین.')}
      actions={<button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> {t('بازخوانی')}</button>}
    >
      {err && <ErrorCard message={err} />}
      {data && (<>
        <div className="pmr-stats">
          <span className={`chip ${data.allDelivered ? 'success' : 'warning'}`}>{t('اقلام تحویل‌شده')}: {fmtN(data.delivered)} {t('از')} {fmtN(data.totalItems)}</span>
          <span className="chip neutral">{t('مراحل تحویل')}: {fmtN(data.doneSteps)} {t('از')} {fmtN(data.totalSteps)}</span>
          {data.locked ? <span className="chip danger">{t('قفل — امضاشده')}</span> : null}
        </div>

        <div className="table-wrap"><table className="delivery-table">
          <thead><tr>
            <th>{t('قلم تحویل')}</th><th>{t('شکل تحویل')}</th><th>{t('گیرندهٔ هلدینگ')}</th>
            <th>{t('وضعیت')}</th><th>{t('اقدام')}</th>
          </tr></thead>
          <tbody>
            {data.items.map((it: any) => (
              <tr key={it.key}>
                <td className="t-primary">{t(it.title)}</td>
                <td className="t-muted">{t(it.form)}</td>
                <td>{it.receiver}</td>
                <td>{it.status === 'DELIVERED'
                  ? <span className="chip success">{t('تحویل‌شده')}{it.deliveredAt ? ` — ${fmtDT(it.deliveredAt)?.split('،')[0] ?? ''}` : ''}</span>
                  : <span className="chip">{t('در انتظار تحویل')}</span>}</td>
                <td>{it.status === 'DELIVERED' || data.locked || !writable ? '—' : (
                  <button type="button" className="srip-button" style={{ padding: '3px 10px' }} disabled={busy}
                    onClick={() => deliverItem(it.key)}>{t('تحویل انجام شد')}</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table></div>

        <div className="dlv-steps-wrap">
          <b className="dlv-steps-title">{t('فرآیند هفت‌گام تحویل')}</b>
          <ol className="mig-steps-list">
            {data.steps.map((st: any) => (
              <li key={st.key} className={`mig-step ${st.done ? 'done' : ''} ${st.key === data.currentStepKey ? 'current' : ''}`}>
                <span className="mig-step-order">{fmtN(st.order)}</span>
                <span className="mig-step-title">{t(st.title)}</span>
                {st.done ? <CheckCircle2 size={14} /> : st.key === data.currentStepKey && writable && !data.locked ? (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => completeStep(st.key)}>{t('تکمیل مرحله')}</button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {data.locked ? (
          <div className="dlv-signed" role="status">
            <CheckCircle2 size={16} />
            <span><b>{t('صورت‌جلسه امضا و قفل شد')}.</b> {t('نمایندهٔ برنامه')}: {data.signature?.programRep} · {t('نمایندهٔ هلدینگ')}: {data.signature?.holdingRep} — {fmtDT(data.signature?.signedAt) ?? ''}</span>
          </div>
        ) : data.allDelivered ? (
          <form className="dlv-sign-form" onSubmit={(e) => { e.preventDefault(); sign(); }}>
            <label className="field">
              <span>{t('نمایندهٔ برنامه')} *</span>
              <input value={reps.programRep} onChange={(e) => setReps(r => ({ ...r, programRep: e.target.value }))} required minLength={2}
                placeholder={t('مثلاً: مدیر پروژه')} />
            </label>
            <label className="field">
              <span>{t('نمایندهٔ هلدینگ')} *</span>
              <input value={reps.holdingRep} onChange={(e) => setReps(r => ({ ...r, holdingRep: e.target.value }))} required minLength={2}
                placeholder={t('مثلاً: مدیرعامل هلدینگ')} />
            </label>
            <button type="submit" className="srip-button primary" disabled={busy}>{t('امضای صورت‌جلسه')}</button>
          </form>
        ) : (
          <p className="field-hint">{t('امضا فقط پس از تحویل همهٔ اقلام ممکن است')}: {fmtN(data.delivered)} {t('از')} {fmtN(data.totalItems)}</p>
        )}
        <p className="field-hint">{t('امضا فقط پس از تحویل همهٔ اقلام ممکن است و پس از امضای طرفین، صورت‌جلسه قفل می‌شود.')}</p>
      </>)}
    </SectionCard>
  );
}

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
      <IntelHub />

      {/* گزارش ماهانهٔ استاندارد — گام ۲.۷ (فرم ۱۵ سند) */}
      <MonthlyReportCard />

      {/* صورت‌جلسهٔ تحویل — گام ۴.۵ (فرم ۱۸ سند؛ بخش ۲۸.۱) */}
      <DeliveryCard />

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
                ) : <p className="criteria-saved">آهنگ ارتباط همهٔ روابط برقرار است.</p>}
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
              <p>خروجی فقط با درخواست تأیید و پس از تصمیم مالک صادر می‌شود و در لاگ خروجی داده با طبقه‌بندی «داخلی» ثبت می‌گردد. {!canJson && 'قالب متنی ویژهٔ مدیران سازمانی است.'} {!isRealTenant && ' در محیط دمو، قالب‌های صفحه‌ای و سند به‌صورت فایل جدولی دانلود می‌شوند.'}</p>
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
