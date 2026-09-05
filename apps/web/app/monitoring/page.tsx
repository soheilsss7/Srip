'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import Link from 'next/link';
import {
  Activity, ArrowLeft, BarChart3, Boxes, Database, Gauge, HeartPulse, Layers,
  RefreshCw, ScrollText, ServerCog, ShieldAlert, Timer, TriangleAlert, Users,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  مرکز پایش — هاب یکپارچهٔ سلامت/سنجه/مشاهده‌پذیری                  */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const fmt1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export default function Monitoring() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [s, h, q] = await Promise.all([
        api('/metrics/summary'),
        api('/health').catch(() => null),
        api('/observability/queue').catch(() => null),
      ]);
      setD({ summary: s, health: h, queue: q });
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = d?.summary ?? {};
  const q = d?.queue ?? {};
  const qKeys = Object.keys(q ?? {});
  const qWaiting = qKeys.reduce((acc: number, k: string) => acc + (q[k]?.waiting ?? 0), 0);
  const qFailed = qKeys.reduce((acc: number, k: string) => acc + (q[k]?.failed ?? 0), 0);
  const deps = d?.health?.dependencies ?? {};
  const depKeys = Object.keys(deps);
  const depOkCount = depKeys.filter(k => deps[k]?.status === 'ok').length;
  const avail = s?.availabilityPercent ?? 100;
  const healthOk = depKeys.length === 0 || depOkCount === depKeys.length;
  const errs = s?.errors ?? 0;
  const errRate = s?.requests ? (errs / s.requests) * 100 : 0;

  const overall: 'success' | 'warning' | 'danger' = !healthOk || errRate > 2 || qFailed > 10 ? 'danger' : qWaiting > 40 || errRate > 0.8 || avail < 99.9 ? 'warning' : 'success';
  const overallTxt = overall === 'success' ? 'همهٔ سیستم‌ها عملیاتی' : overall === 'warning' ? 'توجه لازم است' : 'نیازمند اقدام فوری';

  const hubs = [
    { href: '/health', icon: <HeartPulse size={20} />, title: 'سلامت و آمادگی', desc: 'وضعیت وابستگی‌ها: پایگاه داده، ردیس، صف کارها و فضای ذخیره‌سازی', tone: healthOk ? 'success' : 'danger', tag: healthOk ? 'سالم' : 'تضعیف‌شده' },
    { href: '/metrics', icon: <Gauge size={20} />, title: 'سنجه‌ها', desc: 'شمارنده‌ها، هیستوگرام تأخیر API/پایگاه داده، پردازش و مصرف هوش مصنوعی', tone: 'info' as const, tag: `${fmt.format(s?.requests ?? 0)} درخواست` },
    { href: '/observability', icon: <ScrollText size={20} />, title: 'مشاهده‌پذیری', desc: 'صف‌های BullMQ، رخدادهای سرویس و نمای زمان اجرا', tone: qFailed > 0 ? 'warning' as const : 'success', tag: qFailed > 0 ? `${fmt.format(qFailed)} ناموفق` : 'صف‌ها پایدار' },
    { href: '/security-events', icon: <ShieldAlert size={20} />, title: 'رویدادهای امنیتی', desc: 'رخدادهای امنیتی و دسترسی‌های پرخطر از ممیزی امنیت', tone: 'neutral' as const, tag: 'امنیت' },
  ];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="پایش یکپارچه"
        title="مرکز پایش"
        description="نمای واحد از سلامت، سنجه‌ها و مشاهده‌پذیری پلتفرم — با لینک به چهار نمای تخصصی (نیازمند مجوز metrics.read و health.read)."
        actions={<button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی</button>}
      />
      <ErrorCard message={error} />
      {loading && !d ? <Loading label="در حال جمع‌آوری نمای پایش…" /> : d && (
        <>
          <div className="notice" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', borderColor: overall === 'success' ? 'var(--green,#16a34a)' : overall === 'warning' ? 'var(--gold,#d97706)' : 'var(--red,#dc2626)', color: overall === 'success' ? 'var(--green,#16a34a)' : overall === 'warning' ? 'var(--gold,#b45309)' : 'var(--red,#dc2626)' }}>
            {overall === 'success' ? <Activity size={16} /> : <TriangleAlert size={16} />}
            <span>وضعیت کلی پایش: <b>{overallTxt}</b> · وابستگی‌های سلامت {fmt.format(depOkCount)}/{fmt.format(depKeys.length)} متصل · دسترس‌پذیری {fmt1.format(avail)}٪</span>
          </div>

          <div className="stat-grid">
            <StatCard icon={<HeartPulse size={18} />} label="وضعیت سلامت" value={<Badge tone={healthOk ? 'success' : 'danger'}>{healthOk ? 'سالم' : 'تضعیف‌شده'}</Badge>} sub={`${fmt.format(depKeys.length)} وابستگی: ${deps.database?.status ?? '—'} پایگاه داده · ${deps.redis?.status ?? '—'} ردیس`} iconClass="ic-green" />
            <StatCard icon={<Gauge size={18} />} label="میانگین تأخیر" value={<>{fmt1.format(s?.averageLatencyMs ?? 0)} <small style={{ fontSize: 12 }}>ms</small></>} sub={`p95 نمونه‌ها در صفحهٔ سنجه‌ها`} iconClass="ic-blue" />
            <StatCard icon={<Boxes size={18} />} label="کارهای در انتظار" value={fmt.format(qWaiting)} sub="در همهٔ صف‌های BullMQ" iconClass={qWaiting > 40 ? 'ic-red' : 'ic-gold'} />
            <StatCard icon={<TriangleAlert size={18} />} label="کارهای ناموفق صف" value={fmt.format(qFailed)} sub="نیازمند بررسی DLQ" iconClass={qFailed > 0 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<Users size={18} />} label="کاربران فعال" value={fmt.format(s?.activeUsers ?? 0)} sub="۳۰ روز اخیر" iconClass="ic-green" />
            <StatCard icon={<ServerCog size={18} />} label="پردازنده / حافظه" value={<><small style={{ fontSize: 11 }}>CPU</small> {fmt1.format(s?.process?.cpuPercent ?? 0)}٪</>} sub={`RSS ${fmt1.format((s?.process?.rssBytes ?? 0) / 1024 ** 3)} گیگابایت`} iconClass="ic-purple" />
            <StatCard icon={<BarChart3 size={18} />} label="خطاهای 5xx" value={fmt.format(errs)} sub={`${fmt1.format(errRate)}٪ از کل`} iconClass={errRate > 2 ? 'ic-red' : errRate > 0.8 ? 'ic-gold' : 'ic-green'} />
            <StatCard icon={<Database size={18} />} label="مسیرهای API رصدشده" value={fmt.format(Object.keys(s?.apiLatency ?? {}).length)} sub={`${fmt.format(Object.keys(s?.dbLatency ?? {}).length)} عملیات پایگاه داده`} iconClass="ic-blue" />
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Layers size={16} /> نماهای پایش تخصصی</h2>
                <p>هر نمای تخصصی به یک نقطهٔ پایانی یکسان از بک‌اند وصل است — مسیرهای صفحه از BUILD-ROADMAP گام C پیروی می‌کنند.</p>
              </div>
            </div>
            <div className="grid2" style={{ gap: 10 }}>
              {hubs.map(h => (
                <Link key={h.href} href={h.href} className="listRow" style={{ textDecoration: 'none', color: 'inherit', padding: 14, alignItems: 'center', margin: 0 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--blue,#2563eb) 12%, transparent)', color: 'var(--blue,#2563eb)' }}>{h.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{h.title} <Badge tone={h.tone as any}>{h.tag}</Badge></b>
                    <small className="t-muted" style={{ display: 'block', marginTop: 2, fontSize: 10.5 }}>{h.desc}</small>
                  </span>
                  <ArrowLeft size={15} style={{ color: 'var(--muted,#64748b)' }} />
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Timer size={16} /> خلاصهٔ وابستگی‌های سلامت</h2>
                <p>نتیجهٔ آخرین بررسی GET /health از بک‌اند.</p>
              </div>
              <Badge tone={healthOk ? 'success' : 'danger'}>{healthOk ? 'همه متصل' : `${fmt.format(depKeys.length - depOkCount)} وابستگی خطادار`}</Badge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {depKeys.length === 0 && <p className="t-muted" style={{ fontSize: 11 }}>پاسخی از /health دریافت نشد (احتمالاً مجوز یا در دسترس نبودن).</p>}
              {depKeys.map(k => {
                const v = deps[k];
                return (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border,#e2e8f0)', borderRadius: 12, padding: '7px 12px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: v?.status === 'ok' ? '#16a34a' : '#dc2626' }} />
                    <b style={{ fontSize: 11 }}>{k}</b>
                    {v?.configured === false && <small className="t-muted">اختیاری</small>}
                    {v?.error && <small style={{ color: 'var(--red,#dc2626)' }}>{v.error}</small>}
                  </span>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
