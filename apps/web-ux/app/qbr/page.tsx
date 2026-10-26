'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, Segmented } from '../_components/page-ui';
import { AlertTriangle, CalendarRange, ClipboardList, FileText, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   QBR خودکار هر حساب/هلدینگ (مسترپلن فاز ۳/۲۰) — الگوی DemandFarm
   مرور فصلی خودکار ۹۰ روزه از دادهٔ واقعی همان حساب: تحرک امتیازها،
   تعهدات و عملکرد، شکاف‌ها و مسیرها، روند پوشش رسانه‌ای و نظرسنجی‌ها →
   بریف یک‌صفحه‌ای قابل ارائه به مدیران (قالب قابل چاپ).
   ═══════════════════════════════════════════════════════════════════════════ */

type Brief = {
  organizationId: string; organizationName: string; headline: string; printable: boolean;
  period: { from: string; to: string; days: number };
  kpis: {
    health: { current: number | null; previous: number | null; relationships: number };
    interactions: { current: number; previous: number };
    commitments: { open: number; overdue: number; fulfilledInPeriod: number };
    gaps: { total: number | null; critical: number | null; note?: string };
    media: { inPeriod: number; previousPeriod: number; positive: number; negative: number; neutral: number };
    surveys: { createdInPeriod: number; answered: number; stanceShifts: number };
    portal: { submissionsInPeriod: number; resolved: number; avgResolutionDays: number | null; slaBreaches: number };
  };
  sections: {
    commitmentsOverdue: { id: string; description: string; dueAt: string | null; direction: string; risk: string }[];
    commitmentsDueSoon: { id: string; description: string; dueAt: string | null; direction: string; risk: string }[];
    criticalGaps: { gapId: string; groupFa: string; categoryFa: string; action: string }[];
    mediaHighlights: { id: string; title: string; tone: string; publishedAt: string; mediaName: string }[];
    stanceShifts: { memberId: string; memberName: string; fromStance: string; toStance: string; cause: string; at: string }[];
    surveyResponses: { id: string; targetName: string; createdAt: string; satisfaction: number | null }[];
  };
  recommendations: string[];
  _meta: { dataDate: string; disclaimer: string };
};

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));
const faDate = (v?: string | null) => v ? new Date(v).toLocaleDateString(localeTag()) : '—';
const TONE_FA: Record<string, string> = lt( { POSITIVE: t('مثبت'), NEGATIVE: t('منفی'), NEUTRAL: t('خنثی') });

function Delta({ current, previous, invert = false }: { current: number | null; previous: number | null; invert?: boolean }) {
  if (current == null || previous == null || current === previous) return <span className="pp-muted" style={{ fontSize: 11 }}>{t('بدون تغییر')}</span>;
  const up = current > previous;
  const good = invert ? !up : up;
  return (
    <span style={{ fontSize: 11, display: 'inline-flex', gap: 4, alignItems: 'center', color: good ? '#047857' : '#b91c1c' }}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {good ? t('رشد') : t('کاهش')} {fmtN(Math.abs(current - previous))}
    </span>
  );
}

export default function QbrPage() {
  const { can } = useWorkspace();
  const [accounts, setAccounts] = useState<{ organizationId: string; organizationName: string; headline: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ items: { organizationId: string; organizationName: string; headline: string }[] }>('/qbr');
        setAccounts(r.items ?? []);
        if (r.items?.length) setSelected(r.items[0].organizationId);
      } catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadBrief = useCallback(async (orgId: string) => {
    if (!orgId) return;
    setBriefLoading(true); setError('');
    try { setBrief(await apiGet<Brief>(`/qbr/${orgId}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setBriefLoading(false); }
  }, []);

  useEffect(() => { if (selected) loadBrief(selected); }, [selected, loadBrief]);

  const k = brief?.kpis;

  return (
    <>
      <PageHeader
        eyebrow={t('مسترپلن فاز ۳/۲۰ — الگوی DemandFarm (نمای ده‌هزارپایی)')}
        title={t('بریف فصلی خودکار (QBR)')}
        description={t('مرور ۹۰ روزهٔ هر حساب از دادهٔ واقعی همان مستأجر — تحرک امتیازها، تعهدات، شکاف‌ها، رسانه و نظرسنجی‌ها در یک صفحهٔ قابل ارائه و چاپ. بدون LLM؛ همهٔ اعداد قابل ردیابی به رکورد منبع‌اند.')}
        actions={brief ? (
          <button className="btn btn-primary no-print" onClick={() => { try { window.print(); } catch {} }}>
            <Printer size={14} /> چاپ بریف
          </button>
        ) : undefined}
      />
      {error && <ErrorCard message={error} />}
      {loading ? <Loading /> : (
        <>
          {accounts.length > 1 && (
            <div className="no-print" style={{ marginBottom: 12 }}>
              <Segmented options={accounts.map(a => ({ value: a.organizationId, label: a.organizationName }))} value={selected} onChange={setSelected} />
            </div>
          )}
          {!can('analytics.read') ? (
            <p className="pp-muted">{t('برای مشاهدهٔ بریف فصلی مجوز «تحلیل‌ها» لازم است.')}</p>
          ) : briefLoading || !brief ? <Loading label={t('در حال تولید بریف…')} /> : (
            <div className="qbr-sheet" aria-live="polite">
              <div className="qbr-head">
                <div>
                  <h2 style={{ margin: 0, fontSize: 17 }}>مرور فصلی — {brief.organizationName}</h2>
                  <p className="pp-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                    <CalendarRange size={12} style={{ verticalAlign: '-2px' }} /> دورهٔ {faDate(brief.period.from)} تا {faDate(brief.period.to)} ({fmtN(brief.period.days)} روز)
                  </p>
                </div>
                <Badge tone="info">{t('تولید خودکار · موتور قطعی')}</Badge>
              </div>
              <p className="qbr-headline">{brief.headline}</p>

              <div className="qbr-kpis">
                <div className="qbr-kpi"><span>{t('میانگین سلامت روابط')}</span><strong>{brief.kpis.health.current != null ? fmtN(brief.kpis.health.current) : '—'}</strong><Delta current={k?.health.current ?? null} previous={k?.health.previous ?? null} /><small>{fmtN(brief.kpis.health.relationships)} رابطه</small></div>
                <div className="qbr-kpi"><span>{t('تعاملات فصل')}</span><strong>{fmtN(k?.interactions.current ?? 0)}</strong><Delta current={k?.interactions.current ?? null} previous={k?.interactions.previous ?? null} /><small>فصل قبل: {fmtN(k?.interactions.previous ?? 0)}</small></div>
                <div className="qbr-kpi"><span>{t('تعهدات باز / معوق')}</span><strong>{fmtN(k?.commitments.open ?? 0)} / {fmtN(k?.commitments.overdue ?? 0)}</strong>{(k?.commitments.overdue ?? 0) > 0 ? <span style={{ fontSize: 11, color: '#b91c1c' }}><AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> {t('نیازمند پیگیری')}</span> : <span className="pp-muted" style={{ fontSize: 11 }}>{t('بدون معوق')}</span>}<small>{fmtN(k?.commitments.fulfilledInPeriod ?? 0)} انجام‌شده در فصل</small></div>
                <div className="qbr-kpi"><span>{t('شکاف‌های پوشش عمومی')}</span><strong>{k?.gaps.total != null ? fmtN(k.gaps.total) : '—'}</strong>{k?.gaps.critical != null && k.gaps.critical > 0 ? <span style={{ fontSize: 11, color: '#b45309' }}>{fmtN(k.gaps.critical)} بحرانی</span> : <span className="pp-muted" style={{ fontSize: 11 }}>{k?.gaps.note ?? 'بدون شکاف بحرانی'}</span>}<small>{t('از برنامهٔ عموم‌ها')}</small></div>
                <div className="qbr-kpi"><span>{t('ذکرهای رسانه‌ای')}</span><strong>{fmtN(k?.media.inPeriod ?? 0)}</strong><span className="pp-muted" style={{ fontSize: 11 }}>{fmtN(k?.media.positive ?? 0)} مثبت · {fmtN(k?.media.negative ?? 0)} منفی · {fmtN(k?.media.neutral ?? 0)} خنثی</span><small>{t('رصد منابع منتخب')}</small></div>
                <div className="qbr-kpi"><span>{t('نظرسنجی و موضع‌ها')}</span><strong>{fmtN(k?.surveys.answered ?? 0)}</strong><span className="pp-muted" style={{ fontSize: 11 }}>{fmtN(k?.surveys.stanceShifts ?? 0)} تغییر موضع</span><small>{fmtN(k?.surveys.createdInPeriod ?? 0)} نظرسنجی در فصل</small></div>
                <div className="qbr-kpi"><span>{t('پورتال عمومی')}</span><strong>{fmtN(k?.portal.submissionsInPeriod ?? 0)}</strong><span className="pp-muted" style={{ fontSize: 11 }}>{fmtN(k?.portal.resolved ?? 0)} حل‌شده{k?.portal.avgResolutionDays != null ? ` ${t('· میانگین')} ${fmtN(k.portal.avgResolutionDays)} ${t('روز')}` : ''}</span><small>{(k?.portal.slaBreaches ?? 0) > 0 ? `${fmtN(k?.portal.slaBreaches ?? 0)} ${t('نقض SLA')}` : t('در چارچوب SLA')}</small></div>
                <div className="qbr-kpi"><span>{t('تاریخ داده')}</span><strong style={{ fontSize: 13 }}>{faDate(brief._meta?.dataDate)}</strong><span className="pp-muted" style={{ fontSize: 11 }}>{t('فقط دادهٔ واقعی این حساب')}</span><small>{t('قابل ردیابی به رکورد منبع')}</small></div>
              </div>

              <div className="qbr-cols">
                <SectionCard title={t('تعهدات معوق')} icon={<AlertTriangle size={15} />}>
                  {brief.sections.commitmentsOverdue.length ? (
                    <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 5, fontSize: 12.5 }}>
                      {brief.sections.commitmentsOverdue.map(c => <li key={c.id}>{c.description} <span className="pp-muted">(سررسید {faDate(c.dueAt)})</span></li>)}
                    </ul>
                  ) : <p className="pp-muted" style={{ fontSize: 12 }}>{t('تعهد معوقی نیست.')}</p>}
                  {brief.sections.commitmentsDueSoon.length > 0 && (
                    <>
                      <p className="pp-muted" style={{ margin: '10px 0 4px', fontSize: 11.5 }}>{t('نزدیک‌ترین سررسیدها:')}</p>
                      <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 4, fontSize: 12 }}>
                        {brief.sections.commitmentsDueSoon.map(c => <li key={c.id}>{c.description} — {faDate(c.dueAt)}</li>)}
                      </ul>
                    </>
                  )}
                </SectionCard>
                <SectionCard title={t('شکاف‌های بحرانی پوشش')} icon={<ClipboardList size={15} />}>
                  {brief.sections.criticalGaps.length ? (
                    <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 5, fontSize: 12.5 }}>
                      {brief.sections.criticalGaps.map(g => <li key={g.gapId}>{g.groupFa} — {g.categoryFa}<span className="pp-muted"> · {g.action}</span></li>)}
                    </ul>
                  ) : <p className="pp-muted" style={{ fontSize: 12 }}>{k?.gaps.note ?? t('شکاف بحرانی ثبت نشده است.')}</p>}
                </SectionCard>
                <SectionCard title={t('پوشش رسانه‌ای فصل')} icon={<FileText size={15} />}>
                  {brief.sections.mediaHighlights.length ? (
                    <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 5, fontSize: 12.5 }}>
                      {brief.sections.mediaHighlights.map(m => <li key={m.id}>{m.title.slice(0, 90)}… <Badge tone={m.tone === 'POSITIVE' ? 'success' : m.tone === 'NEGATIVE' ? 'danger' : 'neutral'}>{TONE_FA[m.tone] ?? m.tone}</Badge></li>)}
                    </ul>
                  ) : <p className="pp-muted" style={{ fontSize: 12 }}>{t('ذکر رسانه‌ای در این فصل شناسایی نشد (رصد محدود به منابع منتخب).')}</p>}
                  {brief.sections.stanceShifts.length > 0 && (
                    <>
                      <p className="pp-muted" style={{ margin: '10px 0 4px', fontSize: 11.5 }}>{t('تغییر موضع‌های فصل:')}</p>
                      <ul style={{ margin: 0, paddingInlineStart: 16, display: 'grid', gap: 4, fontSize: 12 }}>
                        {brief.sections.stanceShifts.map((h, i) => <li key={i}>{h.memberName ?? h.memberId} — {h.fromStance} ← {h.toStance} ({h.cause === 'SURVEY' ? t('نظرسنجی') : h.cause})</li>)}
                      </ul>
                    </>
                  )}
                </SectionCard>
                <SectionCard title={t('توصیه‌های فصل آینده')} icon={<TrendingUp size={15} />}>
                  <ol style={{ margin: 0, paddingInlineStart: 18, display: 'grid', gap: 6, fontSize: 12.5 }}>
                    {brief.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ol>
                </SectionCard>
              </div>
              <p className="pp-muted qbr-foot" style={{ fontSize: 10.5 }}>{brief._meta?.disclaimer} — تولیدشده در {new Date(brief._meta?.dataDate ?? Date.now()).toLocaleString(localeTag())}</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
