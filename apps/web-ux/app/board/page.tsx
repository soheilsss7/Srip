'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader } from '../_components/page-ui';
import {
  Activity, ArrowDownRight, ArrowUpRight, Banknote, Gauge, Landmark, RefreshCw,
  ShieldAlert, TrendingUp,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  هیئت‌مدیره (P3-4) — بازده سرمایهٔ رابطه، سرمایهٔ رابطه، سلامت پرتفوی، ریسک تک‌نقطه  */
/* ------------------------------------------------------------------ */

const fmtNum = (v: any): string => v == null || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const fmtB = (v: any): string => v == null || Number.isNaN(Number(v)) ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format((Number(v) || 0) / 1e9)} میلیارد تومان`;
const CLASS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  STRATEGIC: 'info', GROWTH: 'success', CORE: 'info', ROUTINE: 'neutral', RISK: 'danger',
};

export default function Board() {
  const [d, setD] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        eyebrow="گزارش هیئت مدیره"
        title="هیئت‌مدیره — پرتفوی روابط"
        description="سرمایهٔ رابطه، بازده سرمایه، سلامت پرتفوی و ریسک تک‌نقطه — محاسبهٔ قطعی از دادهٔ همین محدودهٔ دسترسی"
        actions={
          <div className="toolbar">
            <Link className="btn btn-ghost" href="/intelligence"><Activity size={14} /> هوشمندی</Link>
            <Link className="btn btn-ghost" href="/analytics"><TrendingUp size={14} /> تحلیل محصول</Link>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {loading && !d ? <Loading label="در حال محاسبهٔ گزارش هیئت‌مدیره…" /> : d && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-teal"><Gauge size={17} /></span><span className="st-name">سرمایهٔ رابطهٔ پرتفوی</span></div>
              <strong className="st-value">{fmtNum(k?.portfolioCapital)}</strong>
              <div className="st-foot"><span className="st-delta up">میانگین سلامت {fmtNum(k?.avgHealth)}</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-blue"><Banknote size={17} /></span><span className="st-name">بازده سرمایهٔ رابطه</span></div>
              <strong className="st-value">{fmtB(k?.wonValue)}</strong>
              <div className="st-foot"><span className="st-delta">برابر {fmtNum(k?.roi)}× هزینهٔ تلاش ({fmtNum(k?.totalCost)} واحد)</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-gold"><Landmark size={17} /></span><span className="st-name">سلامت پرتفوی</span></div>
              <strong className="st-value">{fmtNum(k?.healthyCount)} / {fmtNum(k?.atRiskCount)}</strong>
              <div className="st-foot"><span className="st-delta up">سالم / در معرض ریسک · {fmtNum(k?.strategicCount)} راهبردی</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-red"><ShieldAlert size={17} /></span><span className="st-name">ریسک تک‌نقطه</span></div>
              <strong className="st-value">{fmtB(k?.revenueAtRisk)}</strong>
              <div className="st-foot"><span className="st-delta down">{fmtNum(k?.singlePointRelationships)} رابطه · {fmtNum(k?.singlePointPeople)} شخص</span></div>
            </div>
          </div>

          {(d.rows ?? []).length > 0 && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>بازده سرمایه و سلامت هر رابطه</h2>
                  <p>درآمد برنده‌شده ÷ (تعامل×۱ + جلسه×۲ + اقدام باز×۱) · روند ۹۰ روزه و سرمایهٔ سطح اول</p>
                </div>
                <Badge tone="info">{fmtNum(d.rows.length)} رابطه</Badge>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>رابطه</th><th>طبقه</th><th>سرمایه</th><th>روند ۹۰روزه</th><th>سلامت</th><th>ریسک</th><th>درآمد برنده</th><th>تلاش</th><th>بازده سرمایه</th>
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
                <div><h2>ریسک تک‌نقطه</h2><p>درآمد در معرض ریسک = ارزش موزون فرصت باز × ریسک رابطه</p></div>
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
                  <b style={{ fontSize: 11.5 }}>تک‌شخص‌ها</b>
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
                <div><h2>بیشترین سرمایه / بیشترین ریسک</h2><p>ترکیب سرمایهٔ سطح اول با ریسک برای اولویت‌بندی هیئت</p></div>
              </div>
              <b style={{ fontSize: 11.5 }}>سرمایه</b>
              <div className="list" style={{ marginTop: 6 }}>
                {(d.capitalTop ?? []).map((r: any) => (
                  <div className="listRow" key={'c' + r.relationshipId}>
                    <span style={{ flex: 1 }}><b style={{ fontSize: 12 }}>{r.name}</b></span>
                    <Badge tone="info">{fmtNum(r.capital)}</Badge>
                  </div>
                ))}
              </div>
              <b style={{ fontSize: 11.5, display: 'block', marginTop: 12 }}>ریسک</b>
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
          <p className="t-muted" style={{ fontSize: 10.5, marginTop: 8 }}>
            برچسب دمو: اعداد از دادهٔ نمونهٔ همین سامانه محاسبه شده‌اند و برای گزارش‌برداری هیئت واقعی کافی نیستند (بند ۹ — ریسک‌ها و ملاحظات).
          </p>
        </>
      )}
    </main>
  );
}
