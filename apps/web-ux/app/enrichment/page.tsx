'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, Segmented, StatCard } from '../_components/page-ui';
import IntelHub, { RecSubTabs } from '../_components/intel-hub';
import { Building2, CheckCircle2, Database, FileSearch, Landmark, RefreshCw, ScanSearch, ShieldQuestion, XCircle } from 'lucide-react';
import { localeTag, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   غنی‌سازی از منابع رسمی بیرونی (مسترپلن فاز ۳/۱۸) — الگوی Affinity/TSC
   سه منبع عمومی رسمی → تطبیق با سازمان‌های ردیابی‌شده → پیشنهاد تکمیل
   پروفایل با «منبع + سطح اطمینان» → تأیید انسانی (همان الگوی پیشنهاد یال).
   شفافیت منبع در همهٔ فیلدهای غنی‌شده؛ هرگز دربارهٔ پروفایل خودِ مستأجر.
   ═══════════════════════════════════════════════════════════════════════════ */

type Source = { id: string; kind: string; nameFa: string; fields: string[]; fieldsFa: string[]; cadenceFa: string; coverageFa: string; availableInScope: number; revealed: number; remaining: number };
type Suggestion = { id: string; orgId: string; orgName: string; sourceId: string; sourceNameFa: string; field: string; fieldFa: string; proposedValue: string; currentValue?: string | null; confidence: string; confidenceFa: string; evidence: string; status: string; createdAt: string; applied?: { value: string; sourceNameFa: string; confidence: string; appliedAt: string } | null };
type Metrics = { totalSuggestions: number; accepted: number; rejected: number; pending: number; acceptanceRateFa: string | null; organizationsEnriched: number };

const CONF_TONE: Record<string, 'success' | 'info' | 'warning'> = { HIGH: 'success', MEDIUM: 'info', LOW: 'warning' };
const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));

export default function EnrichmentPage() {
  const { can, isRealTenant } = useWorkspace();
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'PENDING' | 'DECIDED'>('PENDING');
  const canWrite = can('organization.write');

  const load = useCallback(async () => {
    try {
      const [s, sg, m] = await Promise.all([
        apiGet<{ sources: Source[] }>('/enrichment/sources'),
        apiGet<{ items: Suggestion[] }>('/enrichment/suggestions'),
        apiGet<Metrics>('/enrichment/metrics'),
      ]);
      setSources(s.sources ?? []); setItems(sg.items ?? []); setMetrics(m);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scan = async (sourceId?: string) => {
    setBusy(sourceId ?? 'ALL'); setError(''); setFlash('');
    try {
      const r = await api<{ created: number; message: string }>('/enrichment/scan', { method: 'POST', body: JSON.stringify(sourceId ? { sourceId } : {}) });
      setFlash(r.message);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  const decide = async (id: string, action: 'accept' | 'reject') => {
    setBusy(id); setError(''); setFlash('');
    try {
      const r = await api<{ fieldFa: string; orgName: string }>(`/enrichment/suggestions/${id}/${action}`, { method: 'POST', body: '{}' });
      setFlash(action === 'accept' ? `«${r.orgName} — ${r.fieldFa}${t('» با منبع و سطح اطمینان ثبت شد.')}` : t('پیشنهاد رد شد.'));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const pending = items.filter(s => s.status === 'PENDING');
  const decided = items.filter(s => s.status !== 'PENDING');
  const rows = tab === 'PENDING' ? pending : decided;

  return (
    <>
      <PageHeader
        eyebrow={t('مسترپلن فاز ۳/۱۸ — الگوی Affinity (۴۰+ منبع) / TSC.ai')}
        title={t('غنی‌سازی از منابع رسمی')}
        description={t('دریافت دوره‌ای دادهٔ عمومی از منابع رسمی، تطبیق با سازمان‌های ردیابی‌شده و پیشنهاد تکمیل پروفایل با «منبع + سطح اطمینان» — اعمال فقط با تأیید انسانی. پیشنهادها فقط دربارهٔ سازمان‌های شخص ثالث‌اند، هرگز پروفایل خودتان.')}
        actions={canWrite ? (
          <button className="btn btn-primary" disabled={!!busy} onClick={() => scan()}>
            <RefreshCw size={14} /> {busy === 'ALL' ? t('در حال پویش…') : t('پویش همهٔ منابع')}
          </button>
        ) : undefined}
      />
      <IntelHub />
      <RecSubTabs />
      {error && <ErrorCard message={error} />}
      {flash && <div className="flash" role="status">{flash}</div>}
      {loading ? <Loading /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Landmark size={18} />} label={t('منابع رسمی فعال')} value={fmtN(sources.length)} iconClass="ic-blue" sub={t('ثبت شرکت‌ها · روزنامهٔ رسمی · پورتال نهادی')} />
            <StatCard icon={<FileSearch size={18} />} label={t('پیشنهاد در انتظار تأیید')} value={fmtN(metrics?.pending ?? 0)} iconClass="ic-teal" sub={`${t('مجموع')} ${fmtN(metrics?.totalSuggestions ?? 0)} ${t('پیشنهاد')}`} />
            <StatCard icon={<CheckCircle2 size={18} />} label={t('نرخ پذیرش پیشنهادها')} value={metrics?.acceptanceRateFa ?? '—'} iconClass="ic-indigo" sub={`${fmtN(metrics?.accepted ?? 0)} ${t('پذیرفته ·')} ${fmtN(metrics?.rejected ?? 0)} ${t('رد')}`} />
            <StatCard icon={<Database size={18} />} label={t('سازمان‌های غنی‌شده')} value={fmtN(metrics?.organizationsEnriched ?? 0)} iconClass="ic-purple" sub={t('با شفافیت منبع در هر فیلد')} />
          </div>

          <SectionCard title={t('منابع رسمی')} icon={<Landmark size={16} />}
            description={isRealTenant ? t('پویش مرحله‌ای است — هر بار بخشی از منبع تازه بررسی می‌شود.') : t('پویش مرحله‌ای است — هر بار بخشی از منبع تازه بررسی می‌شود (بدون فراخوانی زنده در دمو).')}>
            <div className="p3-grid">
              {sources.map(s => {
                const total = Math.max(1, s.availableInScope);
                const pct = Math.round((s.revealed / total) * 100);
                return (
                  <div key={s.id} className="p3-src">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: 13 }}>{s.nameFa}</strong>
                      <Badge tone={s.remaining > 0 ? 'info' : 'neutral'}>{fmtN(s.remaining)} {t('مانده')}</Badge>
                    </div>
                    <p className="pp-muted" style={{ margin: '6px 0' }}>{s.coverageFa}</p>
                    <div style={{ fontSize: 12, display: 'grid', gap: 3 }}>
                      <span>{t('فیلدها')}: {s.fieldsFa.join(t('،'))}</span>
                      <span>{t('دورهٔ به‌روزرسانی')}: {s.cadenceFa}</span>
                      <span>{t('در محدودهٔ شما')}: {fmtN(s.availableInScope)} {t('رکورد')} ({fmtN(s.revealed)} {t('آشکارشده')})</span>
                    </div>
                    <div className="confidence-wrap" style={{ marginTop: 8 }} title={`${t('آشکارشده')}: ${fmtN(s.revealed)}/${fmtN(s.availableInScope)}`}>
                      <div className="confidence-track"><span className="confidence-fill" style={{ width: `${pct}%` }} /></div>
                      <span className="confidence-num">{fmtN(pct)}٪</span>
                    </div>
                    {canWrite && s.remaining > 0 && (
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} disabled={!!busy} onClick={() => scan(s.id)}>
                        <ScanSearch size={13} /> {busy === s.id ? t('در حال پویش…') : t('پویش این منبع')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title={t('صف تأیید انسانی')} icon={<ShieldQuestion size={16} />}
            description={t('هر پیشنهاد با شاهد از منبع و سطح اطمینان نمایش داده می‌شود؛ پذیرش، مقدار را با برچسب منبع در پروفایل سازمان ثبت می‌کند.')}>
            <div style={{ marginBottom: 10 }}>
              <Segmented options={[{ value: 'PENDING', label: t('در انتظار') }, { value: 'DECIDED', label: t('تعیین‌تکلیف‌شده') }]} value={tab} onChange={setTab} counts={{ PENDING: pending.length, DECIDED: decided.length }} />
            </div>
            {rows.length === 0 ? (
              <div className="empty-state-v4" style={{ padding: '18px 12px' }}>
                <div className="empty-ico"><FileSearch size={22} /></div>
                <strong>{tab === 'PENDING' ? t('پیشنهادی در انتظار نیست') : t('هنوز پیشنهادی تعیین تکلیف نشده است')}</strong>
                <p className="pp-muted" style={{ margin: '6px 0 10px' }}>{tab === 'PENDING'
                  ? t('«پویش همهٔ منابع» را اجرا کنید — یا از دکمهٔ پویش روی هر منبع، همان منبع را مرحله‌ای پیش ببرید.')
                  : t('پیشنهادهای پذیرفته/ردشده پس از تعیین تکلیف اینجا می‌مانند.')}</p>
                {tab === 'PENDING' && canWrite && sources.some(x => x.remaining > 0) && (
                  <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => scan()}>
                    <RefreshCw size={13} /> {busy === 'ALL' ? t('در حال پویش…') : t('پویش همهٔ منابع')}
                  </button>
                )}
              </div>
            ) : (
              <div className="p3-list">
                {rows.map(s => (
                  <div key={s.id} className="p3-row">
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Building2 size={14} style={{ flexShrink: 0 }} />
                        <Link href={`/organizations/${s.orgId}`} style={{ fontSize: 12.5, fontWeight: 700 }}>{s.orgName}</Link>
                        <span className="p3-chip">{s.fieldFa}</span>
                        <Badge tone={CONF_TONE[s.confidence] ?? 'neutral'}>اطمینان {s.confidenceFa}</Badge>
                        {s.status !== 'PENDING' && <Badge tone={s.status === 'ACCEPTED' ? 'success' : 'danger'}>{s.status === 'ACCEPTED' ? t('پذیرفته‌شده') : t('ردشده')}</Badge>}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {s.status === 'PENDING' && s.currentValue != null && s.currentValue !== '' && (
                          <span className="chip neutral" style={{ textDecoration: 'line-through', opacity: 0.7 }}>{s.currentValue}</span>
                        )}
                        {s.status === 'PENDING' && s.currentValue != null && s.currentValue !== '' && <span className="t-muted">←</span>}
                        <span className="p3-value">{s.proposedValue}</span>
                      </div>
                      <p className="pp-muted" style={{ margin: '4px 0 0', fontSize: 11.5 }}>{t('منبع')}: {s.sourceNameFa} — {s.evidence}</p>
                    </div>
                    {s.status === 'PENDING' && canWrite && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => decide(s.id, 'accept')}><CheckCircle2 size={13} /> {t('پذیرش')}</button>
                        <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => decide(s.id, 'reject')}><XCircle size={13} /> {t('رد')}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <p className="pp-muted" style={{ fontSize: 11.5 }}>
            {isRealTenant ? t('حاکمیت داده: پیشنهادها فقط دربارهٔ سازمان‌های شخص ثالثِ ردیابی‌شده ساخته می‌شوند؛ پس از تأیید انسانی با منبع، سطح اطمینان، شاهد و تاریخ در پروفایل ثبت می‌شوند.') : t('حاکمیت داده: پیشنهادها فقط دربارهٔ سازمان‌های شخص ثالثِ ردیابی‌شده ساخته می‌شوند؛ مقادیر شبیه‌سازِ قطعیِ «منبع رسمی» در دمو هستند و پس از تأیید انسانی با منبع، سطح اطمینان، شاهد و تاریخ در پروفایل ثبت می‌شوند.')}
          </p>
        </>
      )}
    </>
  );
}
