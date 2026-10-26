'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader } from '../_components/page-ui';
import { Activity, CheckCircle2, Database, HeartPulse, RefreshCw, Server, Timer, XCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  سلامت و آمادگی — وضعیت سرویس و وابستگی‌های زمان اجرا (public)      */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const fmt1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

type Dep = { status: 'ok' | 'error'; error?: string; latencyMs?: number; configured?: boolean; optional?: boolean };
type HealthStatus = { status: string; service: string; timestamp: string; dependencies: { database: Dep; redis: Dep; queue: Dep; storage: Dep } };
type Liveness = { status: string; service?: string; timestamp?: string };
type Readiness = { status: string; dependencies?: HealthStatus['dependencies'] };

const fmtDT = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function Health() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [live, setLive] = useState<Liveness | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [auto, setAuto] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [s, l, r] = await Promise.all([
        api<HealthStatus>('/health'),
        api<Liveness>('/health/liveness').catch(() => ({ status: 'error' })),
        api<Readiness>('/health/readiness').catch(() => ({ status: 'not_ready' })),
      ]);
      setStatus(s); setLive(l); setReady(r);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { void load(true); }, 20000);
    return () => clearInterval(t);
  }, [auto, load]);

  const ok = status?.status === 'ok';
  const readyOk = ready?.status === 'ready';
  const deps = status?.dependencies ?? { database: {} as Dep, redis: {} as Dep, queue: {} as Dep, storage: {} as Dep };

  const depCards: { key: keyof typeof deps; title: string; icon: ReactNode; detail: string; hint: string }[] = [
    { key: 'database', title: 'پایگاه داده', icon: <Database size={16} />, detail: deps.database?.latencyMs != null ? `${fmt1.format(deps.database.latencyMs)} میلی‌ثانیه` : '—', hint: 'پایگاه دادهٔ رابطه‌ای' },
    { key: 'redis', title: 'ردیس', icon: <Server size={16} />, detail: deps.redis?.latencyMs != null ? `${fmt1.format(deps.redis.latencyMs)} میلی‌ثانیه` : '—', hint: 'صف کار و کش' },
    { key: 'queue', title: 'صف کارها', icon: <Activity size={16} />, detail: deps.queue?.status === 'ok' ? 'دادهٔ صف در دسترس' : 'نامعتبر', hint: '۱۴ صف کار' },
    { key: 'storage', title: 'فضای ذخیره‌سازی', icon: <Server size={16} />, detail: deps.storage?.configured ? 'پیکربندی‌شده' : 'پیکربندی‌نشده', hint: deps.storage?.optional ? 'وابستگی اختیاری (فضای ذخیره‌سازی ابری)' : 'الزامی' },
  ];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="زمان اجرا"
        title="سلامت و آمادگی"
        description="وضعیت زندهٔ سرویس و وابستگی‌های آن — زنده‌بودن، آمادگی و وضعیت پایگاه داده، ردیس، صف کارها و فضای ذخیره‌سازی (هم‌مسیر با سرویس وضعیت‌سنجی در بک‌اند)."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setAuto(v => !v)} disabled={loading} style={{ minHeight: 0, padding: '6px 10px', fontSize: 10.5 }}>
              <RefreshCw size={12} className={auto && refreshing ? 'spin' : ''} /> بازخوانی خودکار: {auto ? 'روشن' : 'خاموش'}
            </button>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </>
        }
      />
      <ErrorCard message={error} />
      {loading && !status ? <Loading label="در حال بررسی سلامت سامانه…" /> : (
        <>
          <div className="notice" role="status" style={ok ? { borderColor: 'var(--green,#16a34a)', color: 'var(--green,#16a34a)', display: 'flex', gap: 8, alignItems: 'center' } : { borderColor: 'var(--red,#dc2626)', color: 'var(--red,#dc2626)', display: 'flex', gap: 8, alignItems: 'center' }}>
            {ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>
              وضعیت کلی: <b>{ok ? 'سالم' : 'تضعیف‌شده'}</b> · سرویس <code dir="ltr">{status?.service ?? 'سرویس سامانه'}</code> · آخرین بررسی: {fmtDT(status?.timestamp)}
            </span>
          </div>

          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <div className="kpi-card"><span>زنده بودن</span><strong><Badge tone={live?.status === 'ok' ? 'success' : 'danger'}>{live?.status === 'ok' ? 'سالم' : '—'}</Badge></strong></div>
            <div className="kpi-card"><span>آمادگی</span><strong><Badge tone={readyOk ? 'success' : 'danger'}>{readyOk ? 'آماده' : '—'}</Badge></strong></div>
            <div className="kpi-card"><span>آمادگی وب</span><strong><code dir="ltr" style={{ fontSize: 13 }}>{readyOk ? 200 : 503}</code></strong></div>
            <div className="kpi-card"><span>وابستگی‌ها</span><strong>{fmt.format(Object.keys(status?.dependencies ?? {}).length)} سرویس</strong></div>
            <div className="kpi-card"><span>دسترس‌پذیری رصدشده</span><strong>{readyOk ? 'آمادهٔ ترافیک' : 'در حال بازیابی'}</strong></div>
          </div>

          <div className="grid2">
            {depCards.map(c => {
              const dep = deps[c.key] ?? {} as Dep;
              const depOk = dep.status === 'ok';
              return (
                <section className="panel" key={c.key} style={{ margin: 0 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: depOk ? 'color-mix(in srgb, var(--green,#16a34a) 12%, transparent)' : 'color-mix(in srgb, var(--red,#dc2626) 12%, transparent)', color: depOk ? 'var(--green,#16a34a)' : 'var(--red,#dc2626)' }}>
                      {c.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 13 }}>{c.title}</b>
                      <small className="t-muted" style={{ fontSize: 9.5 }}>{c.hint}</small>
                    </div>
                    <Badge tone={depOk ? 'success' : 'danger'}>{depOk ? 'متصل' : 'خطا'}</Badge>
                  </div>
                  {dep.error && <p style={{ fontSize: 11, color: 'var(--red,#dc2626)', margin: 0 }}>{dep.error}</p>}
                  {c.key === 'storage' && dep.configured === false && (
                    <p className="t-muted" style={{ fontSize: 10.5, margin: 0 }}>
                      {dep.optional ? 'فضای ذخیره‌سازی ابری پیکربندی نشده — وابستگی اختیاری است و سرویس بدون آن سالم گزارش می‌شود.' : 'فضای ذخیره‌سازی ابریِ الزامی پیکربندی نشده است.'}
                    </p>
                  )}
                  <p style={{ fontSize: 11, margin: '4px 0 0' }}>زمان پاسخ: <b>{c.detail}</b></p>
                </section>
              );
            })}
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><HeartPulse size={16} /> نقطه‌های پایانی سلامت</h2>
                <p>همهٔ نقطه‌های پایانی وضعیت‌سنجی عمومی هستند و به احراز هویت نیاز ندارند؛ وضعیت آمادگی در حالت غیرآماده با کد ۵۰۳ پاسخ می‌دهد.</p>
              </div>
            </div>
            <div className="metric-list" style={{ maxWidth: 560 }}>
              <div><span><code dir="ltr">GET /health</code> — وضعیت کلی و وابستگی‌ها</span><strong><Badge tone="success">عمومی</Badge></strong></div>
              <div><span><code dir="ltr">GET /health/liveness</code> و <code dir="ltr">/live</code></span><strong><Badge tone={live?.status === 'ok' ? 'success' : 'danger'}>{live?.status === 'ok' ? 'سالم' : '—'}</Badge></strong></div>
              <div><span><code dir="ltr">GET /health/readiness</code> و <code dir="ltr">/ready</code> — آمادگی</span><strong><Badge tone={readyOk ? 'success' : 'danger'}>{readyOk ? 'آماده' : 'آماده نیست'}</Badge></strong></div>
              <div><span><Timer size={13} style={{ verticalAlign: -2 }} /> ثبت دسترس‌پذیری در سنجه‌ها</span><strong><Badge tone="neutral">فعال</Badge></strong></div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
