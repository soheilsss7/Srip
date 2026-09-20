'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, Segmented, StatCard } from '../_components/page-ui';
import IntelHub, { RecSubTabs } from '../_components/intel-hub';
import { Building2, CheckCircle2, Database, FileSearch, Landmark, RefreshCw, ScanSearch, ShieldCheck, XCircle } from 'lucide-react';
import { localeTag, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   غنی‌سازی منابع رسمی — تکمیل پروفایل سازمان‌های همکار از دادهٔ عمومیِ منابع رسمی
   (ثبت شرکت‌ها، روزنامهٔ رسمی، پورتال‌های نهادی).
   سه گام: پویش ← بازبینی با منبع و سطح اطمینان ← تأیید و ثبت در پروفایل.
   شفافیت منبع در هر فیلد ثبت‌شده؛ پیشنهادها هرگز دربارهٔ سازمان خودِ کاربر نیستند.
   ═══════════════════════════════════════════════════════════════════════════ */

type Source = { id: string; kind: string; nameFa: string; fields: string[]; fieldsFa: string[]; cadenceFa: string; coverageFa: string; availableInScope: number; revealed: number; remaining: number };
type Suggestion = { id: string; orgId: string; orgName: string; sourceId: string; sourceNameFa: string; field: string; fieldFa: string; proposedValue: string; currentValue?: string | null; confidence: string; confidenceFa: string; evidence: string; status: string; createdAt: string; applied?: { value: string; sourceNameFa: string; confidence: string; appliedAt: string } | null };
type Metrics = { totalSuggestions: number; accepted: number; rejected: number; pending: number; acceptanceRateFa: string | null; organizationsEnriched: number };
type OrgRow = { orgId: string; orgName: string; available: number; pending: number; accepted: number; rejected: number; applied: number; coverage: number; fields: { field: string; fieldFa: string; sourceNameFa: string }[] };

const CONF_TONE: Record<string, 'success' | 'info' | 'warning'> = { HIGH: 'success', MEDIUM: 'info', LOW: 'warning' };
const CONF_FA: Record<string, string> = { HIGH: 'بالا', MEDIUM: 'متوسط', LOW: 'کم' };
const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));
const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(localeTag()) : '';

export default function EnrichmentPage() {
  const { can, isRealTenant } = useWorkspace();
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'PENDING' | 'DECIDED'>('PENDING');
  const [srcFilter, setSrcFilter] = useState('ALL');
  const [confFilter, setConfFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const canWrite = can('organization.write');

  const load = useCallback(async () => {
    try {
      const [s, sg, m, og] = await Promise.all([
        apiGet<{ sources: Source[] }>('/enrichment/sources'),
        apiGet<{ items: Suggestion[] }>('/enrichment/suggestions'),
        apiGet<Metrics>('/enrichment/metrics'),
        apiGet<{ items: OrgRow[] }>('/enrichment/organizations').catch(() => ({ items: [] as OrgRow[] })),
      ]);
      setSources(s.sources ?? []); setItems(sg.items ?? []); setMetrics(m); setOrgs(og.items ?? []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scan = async (opts?: { sourceId?: string; orgId?: string }) => {
    setBusy(opts?.sourceId ?? opts?.orgId ?? 'ALL'); setError(''); setFlash('');
    try {
      const r = await api<{ created: number; message: string }>('/enrichment/scan', { method: 'POST', body: JSON.stringify(opts ?? {}) });
      setFlash(r.message);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  const decide = async (id: string, action: 'accept' | 'reject') => {
    setBusy(id); setError(''); setFlash('');
    try {
      const r = await api<{ fieldFa: string; orgName: string }>(`/enrichment/suggestions/${id}/${action}`, { method: 'POST', body: '{}' });
      setFlash(action === 'accept' ? `«${r.orgName} — ${r.fieldFa}${t('» با منبع و سطح اطمینان در پروفایل ثبت شد.')}` : t('پیشنهاد رد شد.'));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  const bulkAcceptHigh = async () => {
    setBusy('bulk'); setError(''); setFlash('');
    try {
      const ids = pendingRows.filter(s => s.confidence === 'HIGH').map(s => s.id);
      const r = await api<{ accepted: number; rejected: number; message: string }>('/enrichment/suggestions/bulk', { method: 'POST', body: JSON.stringify({ action: 'accept', ids }) });
      setFlash(r.message || t('پیشنهادهای اطمینان‌بالا در پروفایل‌ها ثبت شد.'));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const pending = useMemo(() => items.filter(s => s.status === 'PENDING'), [items]);
  const decided = useMemo(() => items.filter(s => s.status !== 'PENDING'), [items]);

  /* فیلترها روی هر دو تب اعمال می‌شوند: منبع، سطح اطمینان، جستجو */
  const applyFilters = (rows: Suggestion[]) => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(s => srcFilter === 'ALL' || s.sourceId === srcFilter)
      .filter(s => confFilter === 'ALL' || s.confidence === confFilter)
      .filter(s => !q || (s.orgName ?? '').toLowerCase().includes(q) || (s.fieldFa ?? '').toLowerCase().includes(q) || (s.proposedValue ?? '').toLowerCase().includes(q));
  };
  const pendingRows = useMemo(() => applyFilters(pending), [pending, srcFilter, confFilter, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const decidedRows = useMemo(() => applyFilters(decided), [decided, srcFilter, confFilter, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = tab === 'PENDING' ? pendingRows : decidedRows;
  const highCount = pendingRows.filter(s => s.confidence === 'HIGH').length;

  return (
    <>
      <PageHeader
        title={t('غنی‌سازی منابع رسمی')}
        description={t('پروفایل سازمان‌های همکار را با داده‌های عمومی منابع رسمی — شمارهٔ ثبت، سال تأسیس، شکل حقوقی، سرمایه و راه‌های ارتباطی — تکمیل کنید. هر پیشنهاد با ذکر منبع، شاهد و سطح اطمینان ارائه می‌شود و فقط با تأیید شما در پروفایل همان سازمان ثبت می‌شود.')}
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

          {/* چطور کار می‌کند — سه گام */}
          <section className="panel" aria-label={t('چطور کار می‌کند')}>
            <div className="panel-title">
              <div><h2>{t('چطور کار می‌کند؟')}</h2><p>{t('سه گام تا تکمیل پروفایل سازمان‌ها — بدون ورود دستی داده')}</p></div>
            </div>
            <div className="enr-steps">
              <div className="enr-step">
                <span className="stat-ico ic-blue"><ScanSearch size={16} /></span>
                <div><strong>{t('۱. پویش کنید')}</strong><small>{t('داده‌های عمومی منابع رسمی به‌صورت دوره‌ای با سازمان‌های محدودهٔ شما تطبیق داده می‌شود.')}</small></div>
              </div>
              <div className="enr-step">
                <span className="stat-ico ic-teal"><FileSearch size={16} /></span>
                <div><strong>{t('۲. بازبینی کنید')}</strong><small>{t('هر پیشنهاد با منبع، شاهد و سطح اطمینان نمایش داده می‌شود؛ مقدار فعلی و پیشنهادی کنار هم می‌آیند.')}</small></div>
              </div>
              <div className="enr-step">
                <span className="stat-ico ic-indigo"><CheckCircle2 size={16} /></span>
                <div><strong>{t('۳. تأیید کنید')}</strong><small>{t('با پذیرش شما، مقدار همراه نام منبع و تاریخ در پروفایل همان سازمان ثبت می‌شود و همیشه قابل ردیابی است.')}</small></div>
              </div>
            </div>
          </section>

          <SectionCard title={t('منابع رسمی')} icon={<Landmark size={16} />}
            description={t('این منابع به‌صورت دوره‌ای بررسی می‌شوند؛ هر پویش بخش تازه‌ای از هر منبع را آشکار و پیشنهادهای تازه را به صف بازبینی می‌آورد.')}>
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
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} disabled={!!busy} onClick={() => scan({ sourceId: s.id })}>
                        <ScanSearch size={13} /> {busy === s.id ? t('در حال پویش…') : t('پویش این منبع')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title={t('صف تأیید انسانی')} icon={<ShieldCheck size={16} />}
            description={t('پیشنهادها را با منبع و سطح اطمینان بازبینی کنید؛ با پذیرش شما، مقدار همراه برچسب منبع در پروفایل سازمان ثبت می‌شود.')}>
            <div className="page-toolbar" style={{ marginBottom: 10 }}>
              <label className="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('جستجوی سازمان، فیلد یا مقدار…')} aria-label={t('جستجو در پیشنهادها')} />
              </label>
              <select aria-label={t('فیلتر منبع')} value={srcFilter} onChange={e => setSrcFilter(e.target.value)}
                style={{ minHeight: 40, border: '1px solid var(--card-border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--card-bg)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 12.5, fontWeight: 700, maxWidth: 220 }}>
                <option value="ALL">{t('همهٔ منابع')}</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.nameFa}</option>)}
              </select>
              <select aria-label={t('فیلتر اطمینان')} value={confFilter} onChange={e => setConfFilter(e.target.value)}
                style={{ minHeight: 40, border: '1px solid var(--card-border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--card-bg)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 12.5, fontWeight: 700, maxWidth: 160 }}>
                <option value="ALL">{t('همهٔ سطوح')}</option>
                <option value="HIGH">{t('اطمینان بالا')}</option>
                <option value="MEDIUM">{t('اطمینان متوسط')}</option>
                <option value="LOW">{t('اطمینان کم')}</option>
              </select>
              <span className="chip info" style={{ marginInlineStart: 'auto' }}>{fmtN(rows.length)} {t('پیشنهاد')}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <Segmented options={[{ value: 'PENDING', label: t('در انتظار') }, { value: 'DECIDED', label: t('تعیین‌تکلیف‌شده') }]} value={tab} onChange={setTab} counts={{ PENDING: pendingRows.length, DECIDED: decidedRows.length }} />
              {tab === 'PENDING' && canWrite && highCount > 0 && (
                <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={bulkAcceptHigh}>
                  <CheckCircle2 size={13} /> {busy === 'bulk' ? t('در حال اعمال…') : t('پذیرش گروهی اطمینان بالا')} ({fmtN(highCount)})
                </button>
              )}
            </div>
            {rows.length === 0 ? (
              <div className="empty-state-v4" style={{ padding: '18px 12px' }}>
                <div className="empty-ico"><FileSearch size={22} /></div>
                <strong>{tab === 'PENDING' ? (pending.length === 0 ? t('پیشنهادی در انتظار نیست') : t('نتیجه‌ای یافت نشد')) : t('هنوز پیشنهادی تعیین تکلیف نشده است')}</strong>
                <p className="pp-muted" style={{ margin: '6px 0 10px' }}>{tab === 'PENDING'
                  ? (pending.length === 0
                    ? t('«پویش همهٔ منابع» را اجرا کنید — یا از دکمهٔ پویش روی هر منبع، همان منبع را مرحله‌ای پیش ببرید.')
                    : t('فیلترها یا عبارت جستجو را تغییر دهید.'))
                  : t('پیشنهادهای پذیرفته/ردشده پس از تعیین تکلیف اینجا می‌مانند.')}</p>
                {tab === 'PENDING' && pending.length === 0 && canWrite && sources.some(x => x.remaining > 0) && (
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
                        <Badge tone={CONF_TONE[s.confidence] ?? 'neutral'}>{t('اطمینان')} {s.confidenceFa}</Badge>
                        {s.status !== 'PENDING' && <Badge tone={s.status === 'ACCEPTED' ? 'success' : 'danger'}>{s.status === 'ACCEPTED' ? t('پذیرفته‌شده') : t('ردشده')}</Badge>}
                        {s.status !== 'PENDING' && s.applied?.appliedAt && <span className="t-muted" style={{ fontSize: 10.5 }}>{t('تاریخ تأیید')}: {fmtDate(s.applied.appliedAt)}</span>}
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

          <SectionCard title={t('سازمان‌ها و پوشش پروفایل')} icon={<Building2 size={16} />}
            description={t('کدام سازمان‌های محدودهٔ شما از منابع رسمی داده دارند، چه بخشی از پروفایل تکمیل شده و چه چیزی در انتظار بازبینی است.')}>
            {orgs.length === 0 ? (
              <p className="pp-muted">{t('سازمانی از منابع رسمی در محدودهٔ شما شناسایی نشده است.')}</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('سازمان')}</th>
                      <th>{t('فیلدهای در دسترس')}</th>
                      <th>{t('در انتظار بازبینی')}</th>
                      <th>{t('پذیرفته‌شده')}</th>
                      <th>{t('پوشش پروفایل')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map(o => {
                      const notSuggested = o.available - o.pending - o.accepted - o.rejected;
                      return (
                        <tr key={o.orgId}>
                          <td><Link className="t-primary" href={`/organizations/${o.orgId}`} style={{ fontWeight: 700 }}>{o.orgName}</Link>
                            <div className="t-muted" style={{ fontSize: 10.5 }}>{o.fields.map(f => f.fieldFa).join('، ')}</div>
                          </td>
                          <td><strong>{fmtN(o.available)}</strong></td>
                          <td>{o.pending > 0 ? <Badge tone="warning">{fmtN(o.pending)}</Badge> : <span className="t-muted">—</span>}</td>
                          <td>{o.accepted > 0 ? <Badge tone="success">{fmtN(o.accepted)}</Badge> : <span className="t-muted">—</span>}</td>
                          <td style={{ minWidth: 130 }}>
                            <div className="confidence-wrap" title={`${fmtN(o.applied)}/${fmtN(o.available)}`}>
                              <div className="confidence-track"><span className="confidence-fill" style={{ width: `${o.coverage}%` }} /></div>
                              <span className="confidence-num">{fmtN(o.coverage)}٪</span>
                            </div>
                          </td>
                          <td>
                            {canWrite && notSuggested > 0 && (
                              <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => scan({ orgId: o.orgId })}>
                                <ScanSearch size={13} /> {busy === o.orgId ? t('در حال پویش…') : t('غنی‌سازی این سازمان')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <p className="pp-muted" style={{ fontSize: 11.5 }}>
            {isRealTenant
              ? t('شفافیت داده: مقدارهای غنی‌شده همیشه با منبع، سطح اطمینان و تاریخ تأیید در پروفایل سازمان می‌مانند و پیشنهادها هرگز دربارهٔ سازمان خودِ شما ساخته نمی‌شوند.')
              : t('شفافیت داده: مقدارهای غنی‌شده همیشه با منبع، سطح اطمینان و تاریخ تأیید در پروفایل سازمان می‌مانند و پیشنهادها هرگز دربارهٔ سازمان خودِ شما ساخته نمی‌شوند. در نسخهٔ نمایشی، دادهٔ منابع رسمی به‌صورت نمونه ارائه می‌شود.')}
          </p>
        </>
      )}
    </>
  );
}
