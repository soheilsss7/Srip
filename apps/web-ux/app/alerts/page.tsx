'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { api, unwrapList } from '../_lib/api';
import { faNum } from '../_lib/jalali';
import { ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import {
  Siren, AlertTriangle, AlertCircle, Info, RefreshCw, CheckCheck, Inbox,
  HeartHandshake, Users, ListTodo, ShieldCheck, CalendarClock, Workflow, Database, Lock, Activity, ArrowLeft,
} from 'lucide-react';

/* ============================================================================
   /alerts — هشدارهای یکپارچه (فاز ۳ پلن · ADR-0007)
   یک منبع برای همهٔ سیگنال‌ها: روابط، عموم‌ها، اقدام/تعهد، جلسات، گردش کار،
   کیفیت داده، امنیت و پایش. هر هشدار «چرا» صادر شده را می‌گوید و دکمهٔ اقدام
   مستقیم به موجودیت مربوط می‌برد. تشخیص‌ها همان آستانه‌های قبلی هر ماژول‌اند؛
   فقط خروجی‌ها به شکل واحد (module + severity + reason) جمع می‌شوند.
   ============================================================================ */

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';
type UnifiedAlert = {
  id: string; module: string; moduleFa: string; severity: Severity;
  entityType: string; entityId: string; title: string; reason: string;
  actionLabel: string | null; actionUrl: string | null; createdAt: string;
};

const SEVERITY_META: Record<Severity, { fa: string; chip: string; icon: React.ReactNode; ico: string }> = {
  CRITICAL: { fa: 'بحرانی', chip: 'danger', icon: <Siren size={15} />, ico: 'ic-red' },
  WARNING: { fa: 'هشدار', chip: 'warning', icon: <AlertTriangle size={15} />, ico: 'ic-gold' },
  INFO: { fa: 'اطلاع', chip: 'info', icon: <Info size={15} />, ico: 'ic-blue' },
};

const MODULE_ICON: Record<string, React.ReactNode> = {
  RELATIONSHIP: <HeartHandshake size={14} />,
  PUBLICS: <Users size={14} />,
  ACTION: <ListTodo size={14} />,
  COMMITMENT: <ShieldCheck size={14} />,
  MEETING: <CalendarClock size={14} />,
  WORKFLOW: <Workflow size={14} />,
  DATA_QUALITY: <Database size={14} />,
  SECURITY: <Lock size={14} />,
  MONITORING: <Activity size={14} />,
};

export default function AlertsPage() {
  const [items, setItems] = useState<UnifiedAlert[]>([]);
  const [modules, setModules] = useState<Array<{ id: string; fa: string }>>([]);
  const [summary, setSummary] = useState<{ CRITICAL: number; WARNING: number; INFO: number; byModule: Record<string, number> } | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (moduleFilter) params.set('module', moduleFilter);
      if (severityFilter) params.set('severity', severityFilter);
      const qs = params.toString();
      const d = await api<any>(`/alerts${qs ? `?${qs}` : ''}`);
      setItems(d?.items ?? []);
      setSummary(d?.summary ?? null);
      setModules(d?.modules ?? []);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, [moduleFilter, severityFilter]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: string) {
    setBusy('resolve-' + id); setError(''); setStatus('');
    try {
      await api(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) });
      setStatus('هشدار «حل شد» علامت خورد و از فهرست فعلی خارج شد.');
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); }
  }

  const counts = summary ?? { CRITICAL: 0, WARNING: 0, INFO: 0, byModule: {} as Record<string, number> };
  const total = counts.CRITICAL + counts.WARNING + counts.INFO;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="هوش"
        title="هشدارهای یکپارچه"
        description="همهٔ سیگنال‌های نیازمند اقدام — روابط، عموم‌ها، اقدامات و تعهدات، جلسات، گردش کار، کیفیت داده، امنیت و پایش — در یک نگاه؛ هر هشدار با دلیل صدور و مسیر اقدام مستقیم."
        actions={
          <button className="btn btn-secondary" onClick={load} disabled={!!busy}>
            <RefreshCw size={15} /> بازخوانی
          </button>
        }
      />
      <ErrorCard message={error} />
      {status && <div className="notice" role="status">{status}</div>}

      {loading ? (
        <Loading label="در حال جمع‌آوری هشدارها از همهٔ ماژول‌ها…" />
      ) : (<>
        <div className="stat-grid">
          <StatCard icon={<Siren size={18} />} label="بحرانی — اقدام فوری" value={faNum(counts.CRITICAL)} iconClass="ic-red" sub={counts.CRITICAL > 0 ? 'همین امروز ببندید' : 'مورد بحرانی ندارید'} />
          <StatCard icon={<AlertTriangle size={18} />} label="هشدار" value={faNum(counts.WARNING)} iconClass="ic-gold" sub="در حال تبدیل‌شدن به بحران" />
          <StatCard icon={<Info size={18} />} label="اطلاع — بازبینی" value={faNum(counts.INFO)} iconClass="ic-blue" sub="ثبت نتیجه / بررسی" />
          <StatCard icon={<CheckCheck size={18} />} label="کل فعال" value={faNum(total)} iconClass="ic-teal" sub="پس از اقدام، «حل شد» بزنید" />
        </div>

        {/* فیلتر ماژول — از همان کاتالوگ ۹-ماژولی سرور */}
        <SectionCard title="پالایش بر اساس ماژول" icon={<Activity size={17} />} description="هر ماژول همان منطق تشخیص قبلیِ خودش را دارد؛ فقط خروجی یکجا جمع می‌شود.">
          <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <button className={`chip ${moduleFilter === '' ? 'purple' : 'neutral'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setModuleFilter('')}>همه ({faNum(total)})</button>
            {modules.map(m => (
              <button key={m.id} className={`chip ${moduleFilter === m.id ? 'purple' : 'neutral'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setModuleFilter(moduleFilter === m.id ? '' : m.id)}>
                {MODULE_ICON[m.id]} {m.fa} ({faNum(counts.byModule?.[m.id] ?? 0)})
              </button>
            ))}
            <span style={{ flex: 1 }} />
            {(['CRITICAL', 'WARNING', 'INFO'] as Severity[]).map(sev => (
              <button key={sev} className={`chip ${severityFilter === sev ? SEVERITY_META[sev].chip : 'neutral'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setSeverityFilter(severityFilter === sev ? '' : sev)}>
                {SEVERITY_META[sev].icon} {SEVERITY_META[sev].fa}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="هشدارهای فعال"
          icon={<Siren size={17} />}
          description={items.length ? `${faNum(items.length)} مورد در محدودهٔ دسترسی شما` : undefined}
        >
          {items.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Inbox size={24} /></div>
              <strong>هشدار فعالی در این فیلتر نیست</strong>
              <p>یا همه را بسته‌اید یا دادهٔ شما سالم است. تشخیص‌ها هر بازخوانی دوباره از دادهٔ واقعی ساخته می‌شوند.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.map(a => {
                const meta = SEVERITY_META[a.severity] ?? SEVERITY_META.INFO;
                return (
                  <div key={a.id} className="ai-match-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderInlineStart: `3px solid ${a.severity === 'CRITICAL' ? 'var(--srip-danger)' : a.severity === 'WARNING' ? 'var(--srip-amber)' : 'var(--srip-accent)'}` }}>
                    <span className={`stat-ico ${meta.ico}`} style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto' }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 13.5 }}>{a.title}</b>
                        <span className={`chip ${meta.chip}`}>{meta.fa}</span>
                        <span className="chip neutral">{MODULE_ICON[a.module]} {a.moduleFa}</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '4px 0 0' }}>{a.reason}</p>
                      <div className="match-meta" style={{ marginTop: 7, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {a.actionUrl && (
                          <Link className="btn btn-ghost btn-sm" href={a.actionUrl}>
                            <ArrowLeft size={13} /> {a.actionLabel ?? 'مشاهده'}
                          </Link>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => resolve(a.id)} disabled={!!busy} title="این هشدار را حل‌شده علامت بزنید (از فهرست فعال حذف می‌شود)">
                          {busy === 'resolve-' + a.id ? '…' : <><CheckCheck size={13} /> حل شد</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="notice" role="note" style={{ fontSize: 12 }}>
          منطق تشخیص هیچ ماژولی تغییر نکرده است؛ آستانه‌ها همان‌هایی هستند که پیش‌تر در صفحات خودشان اجرا می‌شدند (مثلاً اقدام عقب‌افتاده = بحرانی، تعهد نزدیک سررسید = هشدار، جلسهٔ بدون نتیجه = اطلاع). این صفحه فقط خروجی‌ها را یکجا و فیلترپذیر می‌آورد — تک‌منبعِ حقیقتِ هشدار (ADR-0007).
        </div>
      </>)}
    </main>
  );
}
