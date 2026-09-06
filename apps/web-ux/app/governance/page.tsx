'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, Archive, CheckCircle2, FileScan, Landmark, Lock, RefreshCw, Scale, ScrollText,
  ShieldCheck, ShieldX, TimerReset, XCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  حاکمیت — پاریتی SecurityGovernanceService.preflight                */
/* ------------------------------------------------------------------ */

type Check = { key: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string };
type Preflight = { generatedAt?: string; overall?: 'PASS' | 'WARN' | 'FAIL'; checks?: Check[] };

const OVERALL_FA: Record<string, string> = { PASS: 'مطلوب', WARN: 'نیازمند توجه', FAIL: 'شکست در کنترل' };
const OVERALL_TONE: Record<string, 'success' | 'warning' | 'danger'> = { PASS: 'success', WARN: 'warning', FAIL: 'danger' };
const STATUS_FA: Record<string, string> = { PASS: 'گذر', WARN: 'هشدار', FAIL: 'شکست' };

const CHECK_META: Record<string, { fa: string; icon: React.ReactNode; what: string; fix?: string }> = {
  'origin-check': {
    fa: 'کنترل مبدأ (CSRF)',
    icon: <ShieldCheck size={15} />,
    what: 'درخواست‌های تغییردهندهٔ وضعیت فقط از سامانهٔ خودِ ما پذیرفته می‌شوند و منشأ متقاطع مسدود است.',
    fix: 'اگر غیرفعال شده، ORIGIN_CHECK_ENFORCED را به true برگردانید.',
  },
  'rate-limit-fail-open': {
    fa: 'محدودسازی نرخ (fail-closed)',
    icon: <TimerReset size={15} />,
    what: 'در خطای سرویس محدودسازی نرخ، درخواست‌های حساس باید رد شوند (بسته‌ماندن، نه بازشدن).',
    fix: 'RATE_LIMIT_FAIL_OPEN نباید true باشد؛ سرویس را به حالت بسته برگردانید.',
  },
  'file-scan': {
    fa: 'پویش بدافزار فایل‌ها',
    icon: <FileScan size={15} />,
    what: 'بارگذاری فایل در محیط واقعی باید پیش از ذخیره از پویش بدافزار عبور کند.',
    fix: 'FILE_SCAN_REQUIRED=true را فعال و پویش‌گر را به مسیر بارگذاری متصل کنید.',
  },
  'secret-manager': {
    fa: 'مدیریت اسرار (Secret Manager)',
    icon: <Lock size={15} />,
    what: 'کلیدهای حساس نباید در سورس کنترل نگهداری شوند؛ در محیط واقعی از مدیر اسرار تزریق شوند.',
    fix: 'در production کلیدها را از مدیر اسرار (نه فایل محیطی) تزریق کنید.',
  },
  'data-policy-coverage': {
    fa: 'پوشش خط‌مشی‌های داده',
    icon: <Scale size={15} />,
    what: 'هر خط‌مشی فعال پردازش باید دورهٔ نگهداشت مشخص داشته باشد تا دادهٔ قابل‌پاک‌سازی بدون مهلت باقی نماند.',
    fix: 'برای خط‌مشی‌های پاک‌شدنیِ بدون دورهٔ نگهداشت، retentionDays تعیین کنید (بخش نگهداری داده).',
  },
};

const CHECK_GROUP_FA: Record<string, { label: string; note: string }> = {
  'origin-check': { label: 'حفاظت ورودی', note: 'کنترل‌های پیش از پردازش درخواست' },
  'rate-limit-fail-open': { label: 'حفاظت ورودی', note: 'کنترل‌های پیش از پردازش درخواست' },
  'file-scan': { label: 'زنجیرهٔ داده', note: 'ایمنی ورود/خروج داده' },
  'secret-manager': { label: 'اسرار و پیکربندی', note: 'کلیدها و پیکربندی محیط' },
  'data-policy-coverage': { label: 'خط‌مشی داده', note: 'نگهداشت و پاک‌سازی' },
};

const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  : '—';
const fmtNum = (v: any): string => v == null || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));

export default function Governance() {
  const [d, setD] = useState<Preflight | null>(null);
  const [comp, setComp] = useState<any | null>(null);
  const [compBusy, setCompBusy] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setError('');
    setRefreshing(true);
    try { setD(await api<Preflight>('/security/governance/preflight')); }
    catch (x) { setError((x as Error).message); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* P3-1: پایش انطباق — غربالگری دوره‌ای + UBO + پروندهٔ تصمیم */
  const loadCompliance = useCallback(async () => {
    try { setComp(await api<any>('/governance/compliance')); }
    catch (x) { setError((x as Error).message); }
  }, []);
  useEffect(() => { loadCompliance(); }, [loadCompliance]);
  async function runScreen() {
    setCompBusy('screen'); setError(''); setInfo('');
    try {
      const out: any = await api('/governance/compliance/screen', { method: 'POST', body: '{}' });
      setComp(out.view);
      setInfo(`غربالگری دوره‌ای اجرا شد — ${out.createdFindings} یافتهٔ جدید.`);
    } catch (x) { setError((x as Error).message); }
    finally { setCompBusy(''); }
  }
  async function decide(subject: string, decision: string) {
    setCompBusy(subject + '|' + decision); setError(''); setInfo('');
    try {
      const out: any = await api(`/governance/compliance/${subject}/decide`, { method: 'POST', body: JSON.stringify({ decision, rationale: decision === 'ESCALATED' ? 'برای بررسی کمیتهٔ انطباق ارجاع شد.' : 'پروندهٔ انطباق بازبینی و تأیید شد.' }) });
      setComp(out.view);
      setInfo(`تصمیم «${decision}» برای ${out.view?.ubos?.find((u: any) => u.organizationId === subject)?.organization?.name ?? subject} ثبت شد.`);
    } catch (x) { setError((x as Error).message); }
    finally { setCompBusy(''); }
  }

  const checks = d?.checks ?? [];
  const overall = d?.overall ?? 'PASS';
  const counts = { PASS: checks.filter(c => c.status === 'PASS').length, WARN: checks.filter(c => c.status === 'WARN').length, FAIL: checks.filter(c => c.status === 'FAIL').length };
  const order: Record<string, number> = { FAIL: 0, WARN: 1, PASS: 2 };
  const sorted = [...checks].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const groups = new Set(checks.map(c => CHECK_GROUP_FA[c.key]?.label ?? 'سایر'));

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="حاکمیت و امنیت"
        title="وضعیت حاکمیت"
        description="بررسی خودکار مقدماتی (Preflight) پیش از بهره‌برداری: اسرار و پیکربندی، محافظت ورودی، پویش فایل و پوشش خط‌مشی‌های داده — بر پایهٔ SecurityGovernanceService واقعی."
        actions={
          <div className="toolbar">
            <Link className="btn btn-ghost" href="/enterprise"><Archive size={15} /> حاکمیت سازمانی</Link>
            <Link className="btn btn-ghost" href="/security-events"><ScrollText size={15} /> رویدادهای امنیتی</Link>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> اجرای دوبارهٔ بررسی
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {/* P3-1: پایش انطباق */}
      {comp && (
        <section className="panel" aria-label="پایش انطباق">
          <div className="panel-title">
            <div>
              <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={16} /> پایش انطباق — غربالگری، UBO و پروندهٔ تصمیم</h2>
              <p>غربالگری دوره‌ای سازمان‌ها + مالک نهایی (UBO) + یافته‌های رویداد-محور + پروندهٔ تصمیم برای هر تغییر</p>
            </div>
            <div className="toolbar">
              <Badge tone={comp.kpis?.openFindings ? 'warning' : 'success'}>{comp.kpis?.openFindings} یافتهٔ باز</Badge>
              <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 12px', fontSize: 11 }} onClick={runScreen} disabled={compBusy === 'screen'}>
                <RefreshCw size={13} className={compBusy === 'screen' ? 'spin' : ''} /> غربالگری دوره‌ای
              </button>
            </div>
          </div>
          <div className="kpi-grid" style={{ marginBottom: 12 }}>
            <div className="kpi-card" style={{ margin: 0 }}><small>سازمان‌های تحت پوشش</small><strong>{fmtNum(comp.kpis?.organizations)}</strong><span className="t-muted" style={{ fontSize: 10 }}>پوشش UBO {fmtNum(comp.kpis?.uboCoverage)}٪</span></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>UBO پرچم‌دار</small><strong>{fmtNum(comp.kpis?.flaggedUbo)}</strong><span className="t-muted" style={{ fontSize: 10 }}>PEP یا منابع خارجی</span></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>غربالگری معوق</small><strong>{fmtNum(comp.kpis?.overdueScreens)}</strong><span className="t-muted" style={{ fontSize: 10 }}>بعد از مهلت دوره</span></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>پروندهٔ تصمیم</small><strong>{fmtNum(comp.kpis?.dossiers)}</strong><span className="t-muted" style={{ fontSize: 10 }}>ممیزی‌پذیر</span></div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <p className="t-muted" style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800 }}>مالک نهایی (UBO)</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>سازمان</th><th>UBO</th><th>نقش</th><th>سهم</th><th>ملیت</th><th>PEP</th><th>ریسک</th><th>آخرین راستی‌آزمایی</th></tr></thead>
                  <tbody>
                    {(comp.ubos ?? []).map((u: any) => (
                      <tr key={u.id}>
                        <td><Link className="t-primary" href={`/organizations/${u.organizationId}`}>{u.organization?.name ?? u.organizationId}</Link></td>
                        <td>{u.name}</td><td>{u.role}</td><td>{fmtNum(u.ownershipPercent)}٪</td><td>{u.nationality}</td>
                        <td>{u.pep ? <Badge tone="danger">بله</Badge> : <span className="t-muted">خیر</span>}</td>
                        <td><Badge tone={u.riskTier === 'HIGH' ? 'danger' : u.riskTier === 'MEDIUM' ? 'warning' : 'success'}>{u.riskTier === 'HIGH' ? 'بالا' : u.riskTier === 'MEDIUM' ? 'متوسط' : 'پایین'}</Badge></td>
                        <td className="t-muted" style={{ fontSize: 10.5 }}>{fmtDT(u.verifiedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="t-muted" style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800 }}>یافته‌های باز (دوره‌ای + رویداد-محور)</p>
              <div className="list">
                {(comp.findings ?? []).filter((f: any) => f.status === 'OPEN').map((f: any) => (
                  <div className="listRow" key={f.id} style={{ alignItems: 'flex-start' }}>
                    <Badge tone={f.severity === 'HIGH' ? 'danger' : f.severity === 'MEDIUM' ? 'warning' : 'info'}>{f.severity === 'HIGH' ? 'بالا' : f.severity === 'MEDIUM' ? 'متوسط' : 'ملایم'}</Badge>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 12.5 }}>{f.title}</b>
                      <small className="t-muted" style={{ display: 'block', marginTop: 2 }}>{f.detail}</small>
                      <small className="t-muted" style={{ display: 'block', marginTop: 2 }}>{f.type} · {f.trigger === 'periodic' ? 'دوره‌ای' : 'رویداد-محور'} · {fmtDT(f.createdAt)}</small>
                    </span>
                    <span style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'stretch' }}>
                      <button className="btn btn-primary" style={{ minHeight: 0, padding: '4px 12px', fontSize: 10.5 }} disabled={compBusy !== ''} onClick={() => decide(f.subject, 'CLEARED')}>تأیید</button>
                      <button className="btn btn-ghost" style={{ minHeight: 0, padding: '4px 12px', fontSize: 10.5 }} disabled={compBusy !== ''} onClick={() => decide(f.subject, 'ESCALATED')}>ارتقا به کمیته</button>
                    </span>
                  </div>
                ))}
                {(comp.findings ?? []).filter((f: any) => f.status === 'OPEN').length === 0 && <p className="empty-state">یافتهٔ بازی وجود ندارد.</p>}
              </div>
            </div>
            <div>
              <p className="t-muted" style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800 }}>پروندهٔ تصمیم (ممیزی)</p>
              <div className="list">
                {(comp.dossiers ?? []).map((x: any) => (
                  <div className="listRow" key={x.id} style={{ alignItems: 'flex-start' }}>
                    <Badge tone={x.decision === 'ESCALATED' ? 'warning' : 'success'}>{x.decision === 'ESCALATED' ? 'ارجاع‌شده' : x.decision === 'REJECTED' ? 'ردشده' : 'تأییدشده'}</Badge>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 12.5 }}>{x.subject} — {x.type === 'UBO_CHANGE' ? 'تغییر UBO' : x.type === 'SCREENING' ? 'غربالگری' : x.type}</b>
                      <small className="t-muted" style={{ display: 'block', marginTop: 2 }}>{x.decidedBy} · {fmtDT(x.decidedAt)}</small>
                      <small className="t-muted" style={{ display: 'block' }}>{x.rationale ?? '—'}</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!d && !error ? <Loading label="در حال اجرای بررسی‌های مقدماتی…" /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={<CheckCircle2 size={18} />} label="گذر (PASS)" value={counts.PASS} iconClass="ic-blue" sub="کنترل بدون مشکل" />
            <StatCard icon={<AlertTriangle size={18} />} label="هشدار (WARN)" value={counts.WARN} iconClass="ic-gold" sub="نیازمند توجه در production" />
            <StatCard icon={<XCircle size={18} />} label="شکست (FAIL)" value={counts.FAIL} iconClass="ic-red" sub="باید پیش از بهره‌برداری رفع شود" />
            <StatCard icon={<ShieldCheck size={18} />} label="وضعیت کلی" value={OVERALL_FA[overall]} iconClass={overall === 'FAIL' ? 'ic-red' : overall === 'WARN' ? 'ic-gold' : 'ic-purple'} sub={`آخرین بررسی: ${fmtDT(d?.generatedAt)}`} />
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Landmark size={16} /> کنترل‌های خودکار حاکمیتی</h2>
                <p>هر بررسی نشان می‌دهد محیط برای بهره‌برداری امن آماده است یا خیر؛ ترتیب نمایش: شکست ← هشدار ← گذر.</p>
              </div>
              <Badge tone={OVERALL_TONE[overall]}>{STATUS_FA[overall] ?? overall}</Badge>
            </div>
            {sorted.length === 0 ? (
              <div className="empty-state">کنترلی برای نمایش ثبت نشده است.</div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {[...groups].map(grp => (
                  <div key={grp}>
                    <p className="t-muted" style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800 }}>
                      {grp} — {checks.filter(c => (CHECK_GROUP_FA[c.key]?.label ?? 'سایر') === grp).length} بررسی
                    </p>
                    <div className="list" style={{ display: 'grid', gap: 8 }}>
                      {sorted.filter(c => (CHECK_GROUP_FA[c.key]?.label ?? 'سایر') === grp).map(c => {
                        const m = CHECK_META[c.key];
                        const color = c.status === 'FAIL' ? 'var(--red, #dc2626)' : c.status === 'WARN' ? 'var(--gold, #d97706)' : 'var(--success, #16a34a)';
                        return (
                          <article className="listRow" key={c.key} style={{ alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: '1px solid color-mix(in srgb, ' + color + ' 18%, transparent)', background: 'color-mix(in srgb, ' + color + ' 4%, transparent)' }}>
                            <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                              {m?.icon ?? (c.status === 'FAIL' ? <ShieldX size={15} /> : <ShieldCheck size={15} />)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <b>{m?.fa ?? c.key}</b>
                                <Badge tone={c.status === 'PASS' ? 'success' : c.status === 'WARN' ? 'warning' : 'danger'}>{STATUS_FA[c.status] ?? c.status}</Badge>
                                <code dir="ltr" style={{ fontSize: 9.5, opacity: .65 }}>{c.key}</code>
                              </span>
                              <span className="t-muted" style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{m?.what ?? c.detail}</span>
                              {c.status !== 'PASS' && m?.fix && (
                                <span style={{ display: 'block', fontSize: 10.5, marginTop: 3, color: 'var(--text-secondary, #475569)' }}>
                                  <AlertTriangle size={10} style={{ verticalAlign: -1 }} /> اقدام پیشنهادی: {m.fix}
                                </span>
                              )}
                              <span className="t-muted" style={{ display: 'block', fontSize: 10, marginTop: 2 }}>جزئیات بررسی: {c.detail}</span>
                            </span>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid2">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Scale size={16} /> خط‌مشی داده و نگهداشت</h2>
                  <p>بررسی پوشش خط‌مشی، از روی سیاست‌های فعال پردازش محاسبه می‌شود.</p>
                </div>
              </div>
              <p style={{ fontSize: 11.5, margin: 0 }} className="t-muted">
                خط‌مشی‌های داده (خط پوشش، مبنای قانونی، دورهٔ نگهداشت و قابلیت پاک‌سازی) در «حریم خصوصی» و «نگهداری داده» مدیریت می‌شوند.
              </p>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <Link className="btn btn-secondary" href="/privacy"><Scale size={14} /> خط‌مشی‌های پردازش</Link>
                <Link className="btn btn-secondary" href="/admin/retention"><TimerReset size={14} /> نگهداری داده</Link>
              </div>
            </section>
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={16} /> نگاه کلی</h2>
                </div>
              </div>
              <p style={{ fontSize: 11.5, margin: 0 }} className="t-muted">
                وضعیت کلی از جمع کنترل‌ها ساخته می‌شود: هر شکست ← FAIL، هر هشدار ← WARN و در غیر این‌صورت PASS. بررسی‌ها در هر بار بازخوانی دوباره اجرا می‌شوند و زمان اجرا ثبت می‌گردد.
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <Badge tone="success">گذر {counts.PASS}</Badge>
                <Badge tone="warning">هشدار {counts.WARN}</Badge>
                <Badge tone="danger">شکست {counts.FAIL}</Badge>
                <code dir="ltr" style={{ fontSize: 9.5, opacity: .7, alignSelf: 'center' }}>{d?.generatedAt ?? ''}</code>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
