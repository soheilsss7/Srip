'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../_components/workspace';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader } from '../_components/page-ui';
import {
  Activity, ArrowDownRight, ArrowUpRight, Banknote, Gauge, Landmark, Presentation, RefreshCw,
  ShieldAlert, TrendingUp, FileText, X } from 'lucide-react';
import { localeTag, t } from '../_lib/i18n';

/* ------------------------------------------------------------------ */
/*  هیئت‌مدیره (P3-4) — بازده سرمایهٔ رابطه، سرمایهٔ رابطه، سلامت پرتفوی، ریسک تک‌نقطه  */
/* ------------------------------------------------------------------ */

const fmtNum = (v: any): string => v == null || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));
const fmtB = (v: any): string => v == null || Number.isNaN(Number(v)) ? '—' : `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format((Number(v) || 0) / 1e9)} ${t('میلیارد تومان')}`;
const CLASS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  STRATEGIC: 'info', GROWTH: 'success', CORE: 'info', ROUTINE: 'neutral', RISK: 'danger',
};

export default function Board() {
  const { isRealTenant } = useWorkspace();
  const [d, setD] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /* گام ۳.۱ — حالت ارائهٔ مدیریتی: تمام‌صفحه برای پروجکشن جلسهٔ هیئت‌مدیره */
  const [present, setPresent] = useState(false);
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresent(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try { setD(await api<any>('/board/overview')); }
    catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const k = d?.kpis;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow={t('گزارش هیئت مدیره')}
        title={t('هیئت‌مدیره — پرتفوی روابط')}
        description={t('سرمایهٔ رابطه، بازده سرمایه، سلامت پرتفوی و ریسک تک‌نقطه — محاسبهٔ قطعی از دادهٔ همین محدودهٔ دسترسی')}
        actions={
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setPresent(true)}>
              <Presentation size={15} /> {t('حالت ارائهٔ مدیریتی')}
            </button>
            <Link className="btn btn-ghost" href="/qbr"><FileText size={14} /> {t('بریف فصلی (QBR)')}</Link>
            <Link className="btn btn-ghost" href="/intelligence"><Activity size={14} /> {t('هوشمندی')}</Link>
            <Link className="btn btn-ghost" href="/analytics"><TrendingUp size={14} /> {t('تحلیل محصول')}</Link>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {loading && !d ? <Loading label={t('در حال محاسبهٔ گزارش هیئت‌مدیره…')} /> : d && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-teal"><Gauge size={17} /></span><span className="st-name">{t('سرمایهٔ رابطهٔ پرتفوی')}</span></div>
              <strong className="st-value">{fmtNum(k?.portfolioCapital)}</strong>
              <div className="st-foot"><span className="st-delta up">میانگین سلامت {fmtNum(k?.avgHealth)}</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-blue"><Banknote size={17} /></span><span className="st-name">{t('بازده سرمایهٔ رابطه')}</span></div>
              <strong className="st-value">{fmtB(k?.wonValue)}</strong>
              <div className="st-foot"><span className="st-delta">برابر {fmtNum(k?.roi)}× هزینهٔ تلاش ({fmtNum(k?.totalCost)} واحد)</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-gold"><Landmark size={17} /></span><span className="st-name">{t('سلامت پرتفوی')}</span></div>
              <strong className="st-value">{fmtNum(k?.healthyCount)} / {fmtNum(k?.atRiskCount)}</strong>
              <div className="st-foot"><span className="st-delta up">سالم / در معرض ریسک · {fmtNum(k?.strategicCount)} راهبردی</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-red"><ShieldAlert size={17} /></span><span className="st-name">{t('ریسک تک‌نقطه')}</span></div>
              <strong className="st-value">{fmtB(k?.revenueAtRisk)}</strong>
              <div className="st-foot"><span className="st-delta down">{fmtNum(k?.singlePointRelationships)} رابطه · {fmtNum(k?.singlePointPeople)} شخص</span></div>
            </div>
          </div>

          {(d.rows ?? []).length > 0 && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>{t('بازده سرمایه و سلامت هر رابطه')}</h2>
                  <p>{t('درآمد برنده‌شده ÷ (تعامل×۱ + جلسه×۲ + اقدام باز×۱) · روند ۹۰ روزه و سرمایهٔ سطح اول')}</p>
                </div>
                <Badge tone="info">{fmtNum(d.rows.length)} رابطه</Badge>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('رابطه')}</th><th>{t('طبقه')}</th><th>{t('سرمایه')}</th><th>{t('روند ۹۰روزه')}</th><th>{t('سلامت')}</th><th>{t('ریسک')}</th><th>{t('درآمد برنده')}</th><th>{t('تلاش')}</th><th>{t('بازده سرمایه')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.rows ?? []).map((r: any) => (
                      <tr key={r.relationshipId}>
                        <td><Link className="t-primary" href={`/relationships/${r.relationshipId}`}>{r.name}</Link></td>
                        <td><Badge tone={CLASS_TONE[r.classKey] ?? 'neutral'}>{r.classLabel}</Badge></td>
                        <td>{fmtNum(r.capital)}</td>
                        <td>
                          <span className={r.trend === 'DOWN' ? 'chip danger' : r.trend === 'UP' ? 'chip success' : 'chip neutral'}>
                            {r.trend === 'UP' ? <ArrowUpRight size={11} /> : r.trend === 'DOWN' ? <ArrowDownRight size={11} /> : null}
                            {r.trend === 'UP' ? '↗' : r.trend === 'DOWN' ? '↘' : '→'} {fmtNum(r.delta90d)}
                          </span>
                        </td>
                        <td>{fmtNum(r.healthScore)}</td>
                        <td>{fmtNum(r.riskScore)}</td>
                        <td>{fmtB(r.wonValue)}</td>
                        <td>{fmtNum(r.cost)}</td>
                        <td><b>{r.roi != null ? `×${fmtNum(r.roi)}` : '—'}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="grid2">
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2>{t('ریسک تک‌نقطه')}</h2><p>درآمد در معرض ریسک = ارزش موزون فرصت باز × ریسک رابطه</p></div>
              </div>
              <div className="attr-grid">
                {(d.topRisks ?? []).map((x: any) => (
                  <div key={x.relationshipId} className="kpi-card" style={{ margin: 0 }}>
                    <small>{x.relationshipName}</small>
                    <strong>{fmtB(x.revenueAtRisk)}</strong>
                    <span className="t-muted" style={{ fontSize: 10 }}>سهم {fmtNum(x.share)}٪ · ریسک {fmtNum(x.riskScore)}</span>
                  </div>
                ))}
              </div>
              {(d.singlePeople ?? []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <b style={{ fontSize: 11.5 }}>{t('تک‌شخص‌ها')}</b>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {(d.singlePeople ?? []).map((p: any) => (
                      <span key={p.personId} className="chip danger">{p.name} — {fmtB(p.revenueAtRisk)}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2>{t('بیشترین سرمایه / بیشترین ریسک')}</h2><p>{t('ترکیب سرمایهٔ سطح اول با ریسک برای اولویت‌بندی هیئت')}</p></div>
              </div>
              <b style={{ fontSize: 11.5 }}>{t('سرمایه')}</b>
              <div className="list" style={{ marginTop: 6 }}>
                {(d.capitalTop ?? []).map((r: any) => (
                  <div className="listRow" key={'c' + r.relationshipId}>
                    <span style={{ flex: 1 }}><b style={{ fontSize: 12 }}>{r.name}</b></span>
                    <Badge tone="info">{fmtNum(r.capital)}</Badge>
                  </div>
                ))}
              </div>
              <b style={{ fontSize: 11.5, display: 'block', marginTop: 12 }}>{t('ریسک')}</b>
              <div className="list" style={{ marginTop: 6 }}>
                {(d.riskTop ?? []).map((r: any) => (
                  <div className="listRow" key={'r' + r.relationshipId}>
                    <span style={{ flex: 1 }}><b style={{ fontSize: 12 }}>{r.name}</b></span>
                    <Badge tone="danger">{fmtNum(r.riskScore)}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {!isRealTenant && (
          <p className="t-muted" style={{ fontSize: 10.5, marginTop: 8 }}>
            {t('برچسب دمو: اعداد از دادهٔ نمونهٔ همین سامانه محاسبه شده‌اند و برای گزارش‌برداری هیئت واقعی کافی نیستند (بند ۹ — ریسک‌ها و ملاحظات).')}
          </p>
          )}
        </>
      )}

      {/* ═══ گام ۳.۱ — حالت ارائهٔ مدیریتی (تم board): کارت‌های بزرگ شاخص، فضای سفید،
             روایت «یک نگاه» — همان دادهٔ /board/overview، چیدمان ارائه‌ای برای جلسهٔ هیئت‌مدیره ═══ */}
      {present && d && (
        <div className="board-present" role="dialog" aria-modal="true" aria-label={t('حالت ارائهٔ مدیریتی')}>
          <header className="bp-head">
            <div>
              <small className="bp-eyebrow">{t('گزارش هیئت مدیره')} · {t(d.period)}</small>
              <h1>{t('پرتفوی روابط — یک نگاه')}</h1>
              <span className="bp-date">{t('تاریخ تولید')}: {new Intl.DateTimeFormat(localeTag(), { dateStyle: 'long' }).format(new Date(d.generatedAt ?? Date.now()))}</span>
            </div>
            <button className="btn btn-ghost bp-exit" onClick={() => setPresent(false)}>
              <X size={14} /> {t('خروج از ارائه')} · Esc
            </button>
          </header>

          <section className="bp-narrative">
            <h2>{t('روایت یک نگاه')}</h2>
            <p>{t('سرمایهٔ رابطهٔ پرتفوی {capital} است؛ میانگین سلامت {health} از ۱۰۰، با {healthy} رابطهٔ سالم در برابر {atRisk} رابطهٔ در معرض ریسک.')
              .replace('{capital}', fmtNum(k?.portfolioCapital)).replace('{health}', fmtNum(k?.avgHealth))
              .replace('{healthy}', fmtNum(k?.healthyCount)).replace('{atRisk}', fmtNum(k?.atRiskCount))}</p>
            <p>{t('در {period}، درآمد برنده‌شده {won} برابر {roi}× هزینهٔ تلاش ({cost} واحد) بوده است؛ روند {up} رابطه صعودی و {down} رابطه نزولی است.')
              .replace('{period}', t(d.period)).replace('{won}', fmtB(k?.wonValue)).replace('{roi}', fmtNum(k?.roi))
              .replace('{cost}', fmtNum(k?.totalCost)).replace('{up}', fmtNum(k?.trendUp)).replace('{down}', fmtNum(k?.trendDown))}</p>
            <p>{t('ریسک تک‌نقطه: {rev} درآمد در معرض {rels} رابطه و {ppl} شخص تک‌نقطه است — بزرگ‌ترین مورد: {top}.')
              .replace('{rev}', fmtB(k?.revenueAtRisk)).replace('{rels}', fmtNum(k?.singlePointRelationships))
              .replace('{ppl}', fmtNum(k?.singlePointPeople)).replace('{top}', d.topRisks?.[0]?.relationshipName ?? '—')}</p>
          </section>

          <section className="bp-cards">
            <div className="bp-card">
              <small>{t('سرمایهٔ رابطهٔ پرتفوی')}</small>
              <strong>{fmtNum(k?.portfolioCapital)}</strong>
              <span>{t('میانگین سلامت {health} از ۱۰۰').replace('{health}', fmtNum(k?.avgHealth))}</span>
            </div>
            <div className="bp-card">
              <small>{t('بازده سرمایهٔ رابطه')}</small>
              <strong>{fmtB(k?.wonValue)}</strong>
              <span>{t('برابر {roi}× هزینهٔ تلاش ({cost} واحد)').replace('{roi}', fmtNum(k?.roi)).replace('{cost}', fmtNum(k?.totalCost))}</span>
            </div>
            <div className="bp-card">
              <small>{t('سلامت پرتفوی')}</small>
              <strong>{fmtNum(k?.healthyCount)} / {fmtNum(k?.atRiskCount)}</strong>
              <span>{t('{strategic} رابطهٔ راهبردی · {up} صعودی / {down} نزولی')
                .replace('{strategic}', fmtNum(k?.strategicCount)).replace('{up}', fmtNum(k?.trendUp)).replace('{down}', fmtNum(k?.trendDown))}</span>
            </div>
            <div className="bp-card bp-card-risk">
              <small>{t('ریسک تک‌نقطه')}</small>
              <strong>{fmtB(k?.revenueAtRisk)}</strong>
              <span>{t('{rels} رابطه · {ppl} شخص تک‌نقطه')
                .replace('{rels}', fmtNum(k?.singlePointRelationships)).replace('{ppl}', fmtNum(k?.singlePointPeople))}</span>
            </div>
          </section>

          <div className="bp-grid">
            <section className="bp-panel">
              <h2>{t('ریسک تک‌نقطه — بزرگ‌ترین موارد')}</h2>
              <div className="bp-risk-list">
                {(d.topRisks ?? []).map((x: any) => (
                  <div key={x.relationshipId} className="bp-risk">
                    <b>{x.relationshipName}</b>
                    <strong>{fmtB(x.revenueAtRisk)}</strong>
                  </div>
                ))}
              </div>
              {(d.singlePeople ?? []).length > 0 && (
                <p className="bp-people">
                  <b>{t('تک‌شخص‌ها')}:</b>{' '}
                  {(d.singlePeople ?? []).map((p: any) => `${p.name} (${fmtB(p.revenueAtRisk)})`).join('، ')}
                </p>
              )}
            </section>
            <section className="bp-panel">
              <h2>{t('بیشترین سرمایه / بیشترین ریسک')}</h2>
              <div className="bp-duo">
                <div>
                  <b className="bp-col-t">{t('سرمایه')}</b>
                  {(d.capitalTop ?? []).slice(0, 4).map((r: any) => (
                    <div key={'c' + r.relationshipId} className="bp-li"><span>{r.name}</span><b>{fmtNum(r.capital)}</b></div>
                  ))}
                </div>
                <div>
                  <b className="bp-col-t">{t('ریسک')}</b>
                  {(d.riskTop ?? []).slice(0, 4).map((r: any) => (
                    <div key={'r' + r.relationshipId} className="bp-li"><span>{r.name}</span><b>{fmtNum(r.riskScore)}</b></div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {!isRealTenant && (
            <p className="bp-note">{t('برچسب دمو: اعداد از دادهٔ نمونهٔ همین سامانه محاسبه شده‌اند و برای گزارش‌برداری هیئت واقعی کافی نیستند (بند ۹ — ریسک‌ها و ملاحظات).')}</p>
          )}
        </div>
      )}
    </main>
  );
}
