'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { Badge, DataTable, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import { Activity, Boxes, Cpu, Database, Gauge, Layers, MemoryStick, ScrollText, ServerCog, Timer, Users, Zap } from 'lucide-react';
import type { OpsSnapshot, Hist } from '../metrics/page';

/* ------------------------------------------------------------------ */
/*  مشاهده‌پذیری — نمای زمان اجرا با رخدادها، صف و مصرف هوش مصنوعی    */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const fmt1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const bytesFA = (n?: number) => {
  if (n == null) return '—';
  const g = n / 1024 ** 3, m = n / 1024 ** 2;
  return g >= 1 ? `${fmt1.format(g)} گیگابایت` : m >= 1 ? `${fmt1.format(m)} مگابایت` : `${fmt.format(Math.round(n / 1024))} کیلوبایت`;
};
const uptimeFA = (s?: number) => {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${fmt.format(d)} روز و ${fmt.format(h)} ساعت` : h > 0 ? `${fmt.format(h)} ساعت و ${fmt.format(m)} دقیقه` : `${fmt.format(m)} دقیقه`;
};
function pctile(h: Hist, p: number): string {
  if (!h || h.count === 0) return '—';
  const target = (h.count * p) / 100;
  for (const b of Object.keys(h.buckets ?? {}).map(Number).sort((a, b) => a - b)) if ((h.buckets[String(b)] ?? 0) >= target) return b >= 1000 ? `${fmt1.format(b / 1000)}s` : `${fmt.format(b)}ms`;
  return '∞';
}
const faDT = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

type EventRow = { id?: string; level: string; message: string; source?: string; component?: string; createdAt?: string };
type QueueRow = { queue: string; counts: Record<string, number> };

const LEVEL_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = { INFO: 'info', WARN: 'warning', WARNING: 'warning', ERROR: 'danger', DEBUG: 'neutral' };
const LEVEL_FA: Record<string, string> = { INFO: 'اطلاع', WARN: 'هشدار', WARNING: 'هشدار', ERROR: 'خطا', DEBUG: 'اشکال‌زدایی' };

const QUEUE_FA: Record<string, string> = {
  'srip-default': 'پیش‌فرض', 'srip-notifications': 'اعلان‌ها', 'srip-ai': 'هوش مصنوعی', 'srip-meetings': 'جلسات',
  'srip-documents': 'اسناد', 'srip-recommendations': 'پیشنهادها', 'srip-search': 'جستجو', 'srip-integrations': 'یکپارچه‌سازی',
  'srip-analytics': 'تحلیل', 'srip-reminders': 'یادآورها', 'srip-maintenance': 'نگهداری', 'srip-data-imports': 'وارد کردن داده',
  'srip-privacy-exports': 'خروجی حریم خصوصی', 'srip-dead-letter': 'پیام‌های ناموفق (DLQ)',
};

export default function Observability() {
  const [d, setD] = useState<OpsSnapshot | null>(null);
  const [ev, setEv] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [s, e] = await Promise.all([
        api<OpsSnapshot>('/observability/summary'),
        api<EventRow[]>('/observability/events').catch(() => [] as EventRow[]),
      ]);
      setD(s); setEv(e);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const queueRows: QueueRow[] = useMemo(() => Object.entries(d?.queue ?? {}).map(([queue, counts]) => ({ queue, counts })), [d]);
  const qTotal = queueRows.reduce((s, q) => s + (q.counts.waiting ?? 0) + (q.counts.active ?? 0) + (q.counts.delayed ?? 0), 0);
  const qFailed = queueRows.reduce((s, q) => s + (q.counts.failed ?? 0), 0);
  const errs = (d?.errors ?? 0);
  const errRate = d && d.requests ? (errs / d.requests) * 100 : 0;
  const warns = (ev ?? []).filter(x => (x.level === 'WARN' || x.level === 'WARNING')).length;
  const errEvents = (ev ?? []).filter(x => x.level === 'ERROR').length;
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'] as const;
  const show = (ev ?? []).slice(0, 30);

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="زمان اجرا"
        title="مشاهده‌پذیری"
        description="نمای یکپارچهٔ سنجه‌ها، صف‌های کار و مصرف هوش مصنوعی — پاریتی GET /observability/summary و /observability/queue با مجوز metrics.read."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => { void load(true); }} disabled={refreshing} style={{ minHeight: 0, padding: '6px 10px', fontSize: 10.5 }}>
              <ScrollText size={12} className={refreshing ? 'spin' : ''} /> رخدادهای زمان اجرا
            </button>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <Activity size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </>
        }
      />
      <ErrorCard message={error} />
      {loading && !d ? <Loading label="در حال خواندن نمای مشاهده‌پذیری…" /> : d && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Gauge size={18} />} label="درخواست‌های HTTP" value={fmt.format(d.requests)} sub="شمارندهٔ تجمعی" iconClass="ic-blue" />
            <StatCard icon={<Zap size={18} />} label="خطاهای 5xx" value={fmt.format(errs)} sub={`${fmt1.format(errRate)}٪ از کل`} iconClass={errRate > 2 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<Timer size={18} />} label="میانگین تأخیر" value={<>{fmt1.format(d.averageLatencyMs)} <small style={{ fontSize: 12 }}>ms</small></>} sub="HTTP" iconClass="ic-blue" />
            <StatCard icon={<Cpu size={18} />} label="زمان فعالیت" value={<>{fmt.format(Math.floor((d.uptimeSeconds ?? 0) / 3600))} <small style={{ fontSize: 12 }}>ساعت</small></>} sub={uptimeFA(d.uptimeSeconds)} iconClass="ic-purple" />
            <StatCard icon={<Users size={18} />} label="کاربران فعال" value={fmt.format(d.activeUsers)} sub="۳۰ روز اخیر" iconClass="ic-green" />
            <StatCard icon={<Layers size={18} />} label="صف‌های کار" value={fmt.format(queueRows.length)} sub={`${fmt.format(qTotal)} کار فعال/در انتظار`} iconClass="ic-gold" />
            <StatCard icon={<Boxes size={18} />} label="کارهای ناموفق" value={fmt.format(qFailed)} sub="در همهٔ صف‌ها" iconClass={qFailed > 0 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<ServerCog size={18} />} label="پردازنده" value={<>{fmt1.format(d.process.cpuPercent)}٪</>} sub={`هیپ ${fmt1.format((d.process.heapUsedBytes / Math.max(1, d.process.heapTotalBytes)) * 100)}٪`} iconClass="ic-blue" />
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Activity size={16} /> سلامت لحظه‌ای</h2><p>خلاصهٔ دسترس‌پذیری و پردازش سرویس.</p></div><Badge tone={d.availabilityPercent >= 99 ? 'success' : d.availabilityPercent >= 95 ? 'warning' : 'danger'}>دسترس‌پذیری {fmt1.format(d.availabilityPercent)}٪</Badge></div>
              <div className="metric-list">
                <div><span>رصدهای دسترس‌پذیری</span><strong><Badge tone={d.availabilityPercent >= 99.9 ? 'success' : 'warning'}>{d.availabilityPercent >= 99.9 ? 'عالی (SLO 99.9٪)' : 'نیازمند بازبینی'}</Badge></strong></div>
                <div><span>پردازندهٔ فرایند</span><strong>{fmt1.format(d.process.cpuPercent)}٪</strong></div>
                <div><span>حافظهٔ هیپ</span><strong>{bytesFA(d.process.heapUsedBytes)}</strong></div>
                <div><span>حافظهٔ ساکن (RSS)</span><strong>{bytesFA(d.process.rssBytes)}</strong></div>
              </div>
            </section>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Database size={16} /> تأخیر (نمونه‌های میانی)</h2><p>میانگین هر مسیر API و عملیات پایگاه داده.</p></div></div>
              <div className="metric-list">
                <div><span>مسیرهای رصدشدهٔ API</span><strong>{fmt.format(Object.keys(d.apiLatency ?? {}).length)}</strong></div>
                <div><span>عملیات پایگاه داده</span><strong>{fmt.format(Object.keys(d.dbLatency ?? {}).length)}</strong></div>
                <div><span>فراهم‌کننده‌های هوش مصنوعی</span><strong>{fmt.format(Object.keys(d.ai ?? {}).length)}</strong></div>
                <div><span>مجموعه‌های ذخیره‌سازی</span><strong>{fmt.format(Object.keys(d.storage ?? {}).length)}</strong></div>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Boxes size={16} /> صف‌های کار (BullMQ)</h2><p>دادهٔ زندهٔ هر صف — کارهای ناموفق به صف پیام‌های ناموفق (DLQ) هدایت می‌شوند.</p></div>
              <Badge tone={qFailed > 0 ? 'danger' : 'success'}>{qFailed > 0 ? `${fmt.format(qFailed)} ناموفق` : 'همهٔ صف‌ها سالم'}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {queueRows.map(q => {
                const c = q.counts ?? {};
                const todo = (c.waiting ?? 0) + (c.active ?? 0) + (c.delayed ?? 0);
                return (
                  <div key={q.queue} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                    <span style={{ width: 170, flex: '0 0 auto', fontWeight: 700 }}>{QUEUE_FA[q.queue] ?? q.queue}</span>
                    <code dir="ltr" style={{ width: 110, fontSize: 9.5, flex: '0 0 auto', color: 'var(--muted,#64748b)' }}>{q.queue}</code>
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                      {(c.waiting ?? 0) > 0 && <Badge tone="warning">در انتظار {fmt.format(c.waiting ?? 0)}</Badge>}
                      {(c.active ?? 0) > 0 && <Badge tone="info">فعال {fmt.format(c.active ?? 0)}</Badge>}
                      {(c.delayed ?? 0) > 0 && <Badge tone="neutral">تأخیری {fmt.format(c.delayed ?? 0)}</Badge>}
                      <span className="t-muted" style={{ fontSize: 10 }}>تکمیل‌شده {fmt.format(c.completed ?? 0)}</span>
                    </span>
                    {(c.failed ?? 0) > 0 && <Badge tone="danger">ناموفق {fmt.format(c.failed ?? 0)}</Badge>}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><MemoryStick size={16} /> سرویس‌های پرترافیک</h2><p>پنج مسیر برتر بر پایهٔ p95 (میانگین به‌عنوان ستون کمکی).</p></div></div>
              {(() => {
                const p95n = (h: Hist) => { const x = pctile(h, 95).replace(/[^0-9.]/g, ''); return x ? Number(x) : 0; };
                const rows = Object.entries(d.apiLatency ?? {}).sort((a, b) => p95n(b[1]) - p95n(a[1])).slice(0, 5).map(([k, h]) => ({ key: k, count: fmt.format(h.count), avg: h.count ? `${fmt1.format(h.sum / h.count)}ms` : '—', p95: pctile(h, 95) }));
                return rows.length ? <DataTable columns={[{ key: 'key', label: 'مسیر' }, { key: 'count', label: 'تعداد' }, { key: 'avg', label: 'میانگین' }, { key: 'p95', label: 'p95' }]} rows={rows} /> : <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p>;
              })()}
            </section>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Zap size={16} /> مصرف هوش مصنوعی</h2><p>درخواست، خطا و توکن‌ها بر پایهٔ فراهم‌کننده.</p></div></div>
              {(() => {
                const rows = Object.entries(d.ai ?? {}).map(([k, v]) => ({ key: k, req: fmt.format(v.requests), err: fmt.format(v.errors), tokens: `${fmt.format(v.inputTokens)} در / ${fmt.format(v.outputTokens)} خ` }));
                return rows.length ? <DataTable columns={[{ key: 'key', label: 'فراهم‌کننده' }, { key: 'req', label: 'درخواست' }, { key: 'err', label: 'خطا' }, { key: 'tokens', label: 'توکن ورودی/خروجی' }]} rows={rows} /> : <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p>;
              })()}
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScrollText size={16} /> رخدادهای اخیر</h2><p>آخرین رویدادهای رصدشدهٔ سرویس (ERROR/WARN/INFO/DEBUG) — در نمای محصول به‌عنوان نمای نمونه نمایش داده می‌شوند.</p></div>
              {ev && <Badge tone="info">{fmt.format(show.length)} رخداد</Badge>}
            </div>
            {ev == null ? <p className="t-muted" style={{ fontSize: 11 }}>بدون داده.</p> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {show.map((r, i) => {
                  const tone = LEVEL_TONE[r.level ?? 'INFO'] ?? 'neutral';
                  return (
                    <div key={r.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 10.5, padding: '6px 4px', borderBottom: '1px solid color-mix(in srgb, var(--border,#e2e8f0) 40%, transparent)' }}>
                      <Badge tone={tone}>{LEVEL_FA[r.level ?? 'INFO'] ?? r.level}</Badge>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5 }}>{r.message ?? '—'}</span>
                      {r.source && <span className="t-muted" style={{ fontSize: 9.5, flex: '0 0 auto' }}><code dir="ltr">{r.source}</code></span>}
                      <span className="t-muted" style={{ fontSize: 9.5, flex: '0 0 auto' }}>{faDT(r.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {ev != null && ev.length > 30 && <p className="t-muted" style={{ fontSize: 10, marginTop: 6 }}>۳۰ رخداد آخر از {fmt.format(ev.length)} — فهرست کامل در صفحهٔ «رویدادهای امنیتی»/ممیزی نیست؛ این نمای نمونه است.</p>}
          </section>
        </>
      )}
    </main>
  );
}
