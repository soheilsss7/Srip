'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { Badge, DataTable, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import { Activity, BarChart3, Boxes, Cpu, Database, Gauge, HardDrive, MemoryStick, ServerCog, Timer, Users, Zap } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  سنجه‌ها — شاخص‌های عملیاتی سرور (پاریتی GET /metrics/summary)      */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const fmt1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export type Hist = { count: number; sum: number; buckets: Record<string, number> };
export type OpsSnapshot = {
  requests: number; errors: number; averageLatencyMs: number; uptimeSeconds: number; activeUsers: number;
  process: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number; cpuPercent: number };
  availabilityPercent: number;
  apiLatency: Record<string, Hist>; dbLatency: Record<string, Hist>;
  queue: Record<string, Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused', number>>;
  storage: Record<string, { requests: number; errors: number; latency: Hist; bytes: number }>;
  ai: Record<string, { requests: number; errors: number; latency: Hist; inputTokens: number; outputTokens: number; cost: number }>;
};
type Me = { permissions?: string[] };

const bytesFA = (n?: number) => {
  if (n == null) return '—';
  const g = n / 1024 ** 3, m = n / 1024 ** 2;
  if (g >= 1) return `${fmt1.format(g)} گیگابایت`;
  if (m >= 1) return `${fmt1.format(m)} مگابایت`;
  return `${fmt.format(Math.round(n / 1024))} کیلوبایت`;
};
const uptimeFA = (s?: number) => {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${fmt.format(d)} روز و ${fmt.format(h)} ساعت` : h > 0 ? `${fmt.format(h)} ساعت و ${fmt.format(m)} دقیقه` : `${fmt.format(m)} دقیقه`;
};
function pctile(h: Hist, p: number): string {
  if (!h || h.count === 0) return '—';
  const target = (h.count * p) / 100;
  for (const b of Object.keys(h.buckets).map(Number).sort((a, b) => a - b)) {
    if ((h.buckets[String(b)] ?? 0) >= target) return b >= 1000 ? `${fmt1.format(b / 1000)}s` : `${fmt.format(b)}ms`;
  }
  return '∞';
}

export default function Metrics() {
  const [d, setD] = useState<OpsSnapshot | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [prom, setProm] = useState<string | null>(null);
  const [promBusy, setPromBusy] = useState(false);
  const [showProm, setShowProm] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [s, m] = await Promise.all([
        api<OpsSnapshot>('/metrics/summary'),
        api<Me>('/auth/me').catch(() => null),
      ]);
      setD(s); setMe(m);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const canRead = useMemo(() => {
    const p = me?.permissions ?? [];
    return p.includes('*') || p.includes('metrics.read');
  }, [me]);

  async function toggleProm() {
    setShowProm(v => !v);
    if (prom === null && !promBusy) {
      setPromBusy(true);
      try { setProm(await api<string>('/metrics')); }
      catch (x) { setError((x as Error).message); }
      finally { setPromBusy(false); }
    }
  }

  const apiRows = Object.entries(d?.apiLatency ?? {})
    .map(([k, h]) => ({ key: k, count: fmt.format(h.count), avg: h.count ? `${fmt1.format(h.sum / h.count)}ms` : '—', p50: pctile(h, 50), p95: pctile(h, 95), p99: pctile(h, 99) }))
    .sort((a, b) => Number(b.p95.replace('ms', '').replace('s', '000') || 0) - Number(a.p95.replace('ms', '').replace('s', '000') || 0));
  const dbRows = Object.entries(d?.dbLatency ?? {})
    .map(([k, h]) => ({ key: k, count: fmt.format(h.count), avg: h.count ? `${fmt1.format(h.sum / h.count)}ms` : '—', p50: pctile(h, 50), p95: pctile(h, 95) }));
  const stRows = Object.entries(d?.storage ?? {})
    .map(([k, v]) => ({ key: k, req: fmt.format(v.requests), err: fmt.format(v.errors), bytes: bytesFA(v.bytes) }));
  const aiRows = Object.entries(d?.ai ?? {})
    .map(([k, v]) => ({ key: k, req: fmt.format(v.requests), err: fmt.format(v.errors), avg: v.requests ? `${fmt1.format(v.latency.sum / v.requests)}ms` : '—', tokens: `${fmt.format(v.inputTokens)} / ${fmt.format(v.outputTokens)}`, cost: v.cost ? `${fmt1.format(v.cost)}` : '۰' }));
  const qTotal = Object.entries(d?.queue ?? {}).map(([k, v]) => ({ key: k, total: fmt.format(v.waiting + v.active + v.delayed), waiting: fmt.format(v.waiting), active: fmt.format(v.active), failed: fmt.format(v.failed), delayed: fmt.format(v.delayed) }));

  const errRate = d && d.requests ? ((d.errors / d.requests) * 100) : 0;
  const heapPct = d ? Math.round((d.process.heapUsedBytes / Math.max(1, d.process.heapTotalBytes)) * 100) : 0;
  const rssPct = d ? Math.round((d.process.rssBytes / Math.max(1, 1024 ** 3)) * 100) : 0;
  const upt = d?.uptimeSeconds ?? 0;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="سنجه‌های پلتفرم"
        title="سنجه‌ها"
        description="شمارنده‌های سراسری سرور و هیستوگرام‌های تأخیر — پاریتی GET /metrics/summary با مجوز metrics.read؛ نقطهٔ پایانی /metrics خروجی متن پرومتئوس می‌دهد."
        actions={
          <>
            <button className="btn btn-ghost" onClick={toggleProm} style={{ minHeight: 0, padding: '6px 10px', fontSize: 10.5 }}>
              <BarChart3 size={12} /> {showProm ? 'بستن متن پرومتئوس' : 'متن پرومتئوس (scrape)'}
            </button>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <Activity size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </>
        }
      />
      <ErrorCard message={error} />
      {!canRead && me != null && !loading && (
        <div className="notice">حساب شما مجوز «مشاهده سنجه‌ها» (metrics.read) را ندارد — مانند نقش‌های عملیاتی (مدیر/مدیر ارشد شرکت و هلدینگ) در سامانهٔ واقعی.</div>
      )}
      {loading && !d ? <Loading label="در حال خواندن سنجه‌های سرور…" /> : d && (
        <>
          {showProm && (
            <details open style={{ marginBottom: 14 }}>
              <summary className="t-muted" style={{ fontSize: 11, cursor: 'pointer' }}>خروجی GET /metrics (متن ساده، برای خراش‌گر پرومتئوس) — {promBusy ? 'در حال بارگذاری…' : `${(prom ?? '').split('\n').length} خط`}</summary>
              <pre dir="ltr" style={{ background: '#0f172a', color: '#a5f3fc', padding: 12, borderRadius: 10, overflow: 'auto', fontSize: 9.5, maxHeight: 260, lineHeight: 1.5, whiteSpace: 'pre' }}>{prom ?? '—'}</pre>
            </details>
          )}

          <div className="stat-grid">
            <StatCard icon={<Gauge size={18} />} label="درخواست‌های HTTP" value={fmt.format(d.requests)} sub="شمارندهٔ تجمعی فرایند" iconClass="ic-blue" />
            <StatCard icon={<Zap size={18} />} label="خطاهای 5xx" value={fmt.format(d.errors)} sub={`${fmt1.format(errRate)}٪ از کل درخواست‌ها`} iconClass={errRate > 2 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<Timer size={18} />} label="میانگین تأخیر HTTP" value={<>{fmt1.format(d.averageLatencyMs)} <small style={{ fontSize: 12 }}>ms</small></>} sub="در کل مسیرها" iconClass="ic-blue" />
            <StatCard icon={<Cpu size={18} />} label="زمان فعالیت" value={<>{fmt.format(Math.floor(upt / 3600))} <small style={{ fontSize: 12 }}>ساعت</small></>} sub={uptimeFA(upt)} iconClass="ic-purple" />
            <StatCard icon={<Users size={18} />} label="کاربران فعال (۳۰d)" value={fmt.format(d.activeUsers)} sub="یکتای رصدشده" iconClass="ic-green" />
            <StatCard icon={<Activity size={18} />} label="دسترس‌پذیری" value={<>{fmt1.format(d.availabilityPercent)}٪</>} sub="نمونه‌های سلامت" iconClass="ic-green" />
            <StatCard icon={<ServerCog size={18} />} label="پردازنده" value={<>{fmt1.format(d.process.cpuPercent)}٪</>} sub="نمونهٔ لحظه‌ای" iconClass="ic-blue" />
            <StatCard icon={<MemoryStick size={18} />} label="حافظهٔ RSS" value={bytesFA(d.process.rssBytes)} sub={`هیپ: ${bytesFA(d.process.heapUsedBytes)} از ${bytesFA(d.process.heapTotalBytes)}`} iconClass="ic-gold" />
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Cpu size={16} /> پردازش</h2><p>مصرف پردازنده و حافظهٔ فرایند srip-api.</p></div><Badge tone={d.process.cpuPercent > 80 ? 'danger' : d.process.cpuPercent > 55 ? 'warning' : 'success'}>CPU {fmt1.format(d.process.cpuPercent)}٪</Badge></div>
              <div style={{ background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: `${Math.min(100, d.process.cpuPercent)}%`, height: 8, background: d.process.cpuPercent > 80 ? '#dc2626' : d.process.cpuPercent > 55 ? '#d97706' : '#16a34a' }} />
              </div>
              <div className="metric-list">
                <div><span>حافظهٔ هیپ استفاده‌شده</span><strong>{fmt.format(heapPct)}٪</strong></div>
                <div><span>حافظهٔ هیپ اختصاصی</span><strong>{bytesFA(d.process.heapTotalBytes)}</strong></div>
                <div><span>RSS (حافظهٔ ساکن)</span><strong>{bytesFA(d.process.rssBytes)}</strong></div>
                <div><span>نرخ خطا</span><strong><Badge tone={errRate > 2 ? 'danger' : 'success'}>{fmt1.format(errRate)}٪</Badge></strong></div>
              </div>
              <div style={{ background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', borderRadius: 99, height: 8, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${Math.min(100, rssPct)}%`, height: 8, background: '#7c3aed' }} />
              </div>
            </section>

            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Boxes size={16} /> صف‌های کار</h2><p>۱۴ صف BullMQ — تعداد در انتظار، فعال، تأخیری و ناموفق.</p></div></div>
              {qTotal.length === 0 ? <p className="t-muted" style={{ fontSize: 11 }}>داده‌ای نیست.</p> : (
                <div style={{ display: 'grid', gap: 7, maxHeight: 230, overflow: 'auto', paddingLeft: 2 }}>
                  {qTotal.map(q => (
                    <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
                      <code dir="ltr" style={{ width: 150, flex: '0 0 auto', fontSize: 9.5 }}>{q.key}</code>
                      <b style={{ width: 34, textAlign: 'left' }}>{q.total}</b>
                      {Number(q.waiting) > 0 && <Badge tone="warning">در انتظار {q.waiting}</Badge>}
                      {Number(q.active) > 0 && <Badge tone="info">فعال {q.active}</Badge>}
                      {Number(q.delayed) > 0 && <Badge tone="neutral">تأخیری {q.delayed}</Badge>}
                      {Number(q.failed) > 0 && <Badge tone="danger">ناموفق {q.failed}</Badge>}
                      {Number(q.total) === 0 && Number(q.failed) === 0 && <span className="t-muted">آرام</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Database size={16} /> تأخیر API بر پایهٔ مسیر</h2>
                <p>هیستوگرام‌های سطلی (le 5ms … 10s) — صدک‌ها از همان سطل‌های تجمعی محاسبه شده‌اند.</p>
              </div>
              <Badge tone="info">{fmt.format(apiRows.length)} مسیر</Badge>
            </div>
            {apiRows.length ? (
              <DataTable columns={[{ key: 'key', label: 'مسیر' }, { key: 'count', label: 'تعداد' }, { key: 'avg', label: 'میانگین' }, { key: 'p50', label: 'p50' }, { key: 'p95', label: 'p95' }, { key: 'p99', label: 'p99' }]} rows={apiRows.slice(0, 14)} />
            ) : <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p>}
          </section>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Database size={16} /> تأخیر پایگاه داده</h2><p>بر پایهٔ عملیات (query، transaction، …).</p></div></div>
              {dbRows.length ? <DataTable columns={[{ key: 'key', label: 'عملیات' }, { key: 'count', label: 'تعداد' }, { key: 'avg', label: 'میانگین' }, { key: 'p50', label: 'p50' }, { key: 'p95', label: 'p95' }]} rows={dbRows} /> : <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p>}
            </section>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><HardDrive size={16} /> فضای ذخیره‌سازی</h2><p>تقاضا، خطا و حجم دادهٔ انتقالی هر عملیات ذخیره‌سازی.</p></div></div>
              {stRows.length ? <DataTable columns={[{ key: 'key', label: 'عملیات' }, { key: 'req', label: 'تعداد' }, { key: 'err', label: 'خطا' }, { key: 'bytes', label: 'حجم' }]} rows={stRows} /> : <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p>}
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Zap size={16} /> مصرف هوش مصنوعی</h2>
                <p>بر پایهٔ فراهم‌کننده — توکن ورودی/خروجی، هزینه و خطاها.</p>
              </div>
            </div>
            {aiRows.length ? <DataTable columns={[{ key: 'key', label: 'فراهم‌کننده' }, { key: 'req', label: 'درخواست' }, { key: 'err', label: 'خطا' }, { key: 'avg', label: 'میانگین تأخیر' }, { key: 'tokens', label: 'توکن ورودی / خروجی' }, { key: 'cost', label: 'هزینه (تومان)' }]} rows={aiRows} /> : <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p>}
          </section>
        </>
      )}
    </main>
  );
}
