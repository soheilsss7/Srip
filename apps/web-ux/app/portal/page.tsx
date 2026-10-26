'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, EmptyV4, ErrorCard, Loading, PageHeader, SectionCard, StatCard, Modal } from '../_components/page-ui';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Globe2, Inbox, ShieldCheck, Timer, UserPlus } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   پورتال عمومی — صف بررسی و SLA (مسترپلن فاز ۲/۱۳)
   GET  /portal/submissions  صف پیام‌های عمومی (بازخورد/شکایت/درخواست) با وضعیت SLA
   GET  /portal/metrics      روند شکایت، زمان حل، نقض SLA
   POST /portal/submissions/:id/{assign|resolve|close|convert}
   لینک عمومی هر مستأجر: /p?slug=<slug> — فرم بی‌احراز با نرخ‌محدود.
   ═══════════════════════════════════════════════════════════════════════════ */

type Sub = {
  id: string; tenantOrgId: string; type: string; typeFa: string; name: string | null; contact: string | null;
  message: string; status: string; statusFa: string; ownerUserId: string | null;
  createdAt: string; slaDueAt: string; resolvedAt: string | null; resolutionNote: string | null; convertedPersonId: string | null;
  slaBreached: boolean; hoursToSla: number | null; resolutionHours: number | null;
};
type Metrics = {
  total: number; byType: Record<string, number>; byStatus: Record<string, number>; slaBreached: number;
  avgResolutionHours: number | null; trend: { ym: string; complaints: number; feedback: number; requests: number }[];
};

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const faDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};
const TYPE_TONE: Record<string, 'danger' | 'info' | 'neutral'> = { COMPLAINT: 'danger', REQUEST: 'info', FEEDBACK: 'neutral' };
const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = { NEW: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'neutral' };

export default function PortalPage() {
  const { me } = useWorkspace();
  const [rows, setRows] = useState<Sub[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [resolveFor, setResolveFor] = useState<Sub | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [q, m] = await Promise.all([api<any>('/portal/submissions'), api<Metrics>('/portal/metrics')]);
      setRows(Array.isArray(q) ? q : (q?.items ?? []));
      setMetrics(m);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string, body?: Record<string, unknown>) => {
    setBusy(`${id}:${action}`);
    setFlash(''); setError('');
    try {
      const out = await api<any>(`/portal/submissions/${id}/${action}`, { method: 'POST', body: JSON.stringify(body ?? {}) });
      setFlash(action === 'convert' ? (out?.message ?? 'تبدیل انجام شد.') : 'ثبت شد.');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const visible = rows.filter(r => !typeFilter || r.type === typeFilter);
  const portalSlug = me?.memberships?.[0] ? (me.memberships[0].organizationId === 'org-pars' ? 'pars' : me.memberships[0].organizationId === 'org-x' ? 'x' : 'arya') : 'arya';
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/portal\/?$/, '')}/p?slug=${portalSlug}` : `/p?slug=${portalSlug}`;

  return (
    <>
      <PageHeader
        eyebrow="مسترپلن فاز ۲/۱۳ — الگوی Tractivity/Borealis"
        title="پورتال عمومی و سازوکار شکایت"
        description="فرم عمومی بی‌احراز برای بازخورد/شکایت/درخواست ذینفعان؛ صف بررسی با SLA، تعیین مسئول، رسیدگی و تبدیل به ذینفع — چرخهٔ کامل ثبت تا بستن."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => { try { navigator.clipboard?.writeText(publicUrl)?.catch?.(() => {}); } catch {} setFlash(`لینک عمومی پورتال: ${publicUrl}`); }}>
            <ExternalLink size={13} /> کپی لینک عمومی
          </button>
        }
      />
      {error && <ErrorCard message={error} />}
      {flash && <div className="notice" role="status">{flash}</div>}
      {loading ? <Loading /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Inbox size={18} />} label="کل پیام‌ها" value={fmtN(metrics?.total)} iconClass="ic-blue" sub="در بازهٔ نگهداری" />
            <StatCard icon={<AlertTriangle size={18} />} label="شکایت" value={fmtN(metrics?.byType?.COMPLAINT ?? 0)} iconClass="ic-red" sub="SLA: ۵ روز" />
            <StatCard icon={<Timer size={18} />} label="نقض SLA" value={fmtN(metrics?.slaBreached ?? 0)} iconClass="ic-gold" sub="پاسخ از مهلت گذشته" />
            <StatCard icon={<Clock3 size={18} />} label="میانگین زمان حل" value={metrics?.avgResolutionHours != null ? `${fmtN(metrics.avgResolutionHours)} ساعت` : '—'} iconClass="ic-teal" sub="از ثبت تا رسیدگی" />
          </div>

          <SectionCard title="روند پیام‌های عمومی (۶ ماه)" icon={<Globe2 size={16} />}
            description="روند ماهانهٔ شکایت/بازخورد/درخواست — مبنای گزارش هیئت‌مدیره.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 90 }}>
              {(metrics?.trend ?? []).map(t => {
                const max = Math.max(1, ...(metrics?.trend ?? []).map(x => Math.max(x.complaints, x.feedback, x.requests)));
                return (
                  <div key={t.ym} style={{ flex: 1, textAlign: 'center' }} title={`${t.ym} — شکایت ${t.complaints} · بازخورد ${t.feedback} · درخواست ${t.requests}`}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 60 }}>
                      <span style={{ width: 7, height: Math.max(3, (t.complaints / max) * 56), background: '#dc2626', borderRadius: 3 }} />
                      <span style={{ width: 7, height: Math.max(3, (t.feedback / max) * 56), background: '#0891b2', borderRadius: 3 }} />
                      <span style={{ width: 7, height: Math.max(3, (t.requests / max) * 56), background: '#6366f1', borderRadius: 3 }} />
                    </div>
                    <small className="t-muted" style={{ fontSize: 10 }}>{t.ym.slice(5)}</small>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11 }}>
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><i style={{ width: 9, height: 9, background: '#dc2626', borderRadius: 2, display: 'inline-block' }} /> شکایت</span>
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><i style={{ width: 9, height: 9, background: '#0891b2', borderRadius: 2, display: 'inline-block' }} /> بازخورد</span>
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><i style={{ width: 9, height: 9, background: '#6366f1', borderRadius: 2, display: 'inline-block' }} /> درخواست</span>
            </div>
          </SectionCard>

          <SectionCard title="صف بررسی" icon={<ShieldCheck size={16} />}
            description="هر پیام با مهلت پاسخ (SLA) و وضعیت رسیدگی — شکایت‌ها محرک گردش‌کار خودکار دارند."
            actions={
              <div className="segmented" role="tablist">
                {[['', 'همه'], ['COMPLAINT', 'شکایت'], ['REQUEST', 'درخواست'], ['FEEDBACK', 'بازخورد']].map(([v, l]) => (
                  <button key={v} role="tab" aria-selected={typeFilter === v} className={typeFilter === v ? 'active' : ''} onClick={() => setTypeFilter(v)}>{l}</button>
                ))}
              </div>
            }>
            {visible.length ? (
              <div className="list">
                {visible.map(r => (
                  <div className="listRow" key={r.id} style={{ alignItems: 'flex-start', borderColor: r.slaBreached ? '#dc2626' : undefined }}>
                    <Badge tone={TYPE_TONE[r.type] ?? 'neutral'}>{r.typeFa}</Badge>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 12.5 }}>{r.name ?? 'ناشناس'}</strong>
                      <p style={{ margin: '4px 0', fontSize: 12, lineHeight: 1.8 }}>{r.message}</p>
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.statusFa}</Badge>
                        {r.slaBreached ? <Badge tone="danger">نقض SLA</Badge>
                          : r.hoursToSla != null ? <span className="chip neutral">مهلت: {fmtN(r.hoursToSla)} ساعت دیگر</span> : null}
                        {r.resolutionHours != null && <span className="chip neutral">حل در {fmtN(r.resolutionHours)} ساعت</span>}
                        <span className="t-muted" style={{ fontSize: 10.5 }}>{faDT(r.createdAt)}{r.contact ? ` · ${r.contact}` : ''}</span>
                      </span>
                      {r.resolutionNote && <p className="criteria-saved" style={{ marginTop: 6, fontSize: 11.5 }}>رسیدگی: {r.resolutionNote}</p>}
                    </span>
                    <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {(r.status === 'NEW' || r.status === 'IN_PROGRESS') && (
                        <button className="btn btn-ghost btn-sm" disabled={!!busy}
                          onClick={() => act(r.id, 'assign', { ownerUserId: undefined })} title="به من اختصاص بده">
                          <UserPlus size={12} /> مسئول
                        </button>
                      )}
                      {r.status !== 'RESOLVED' && r.status !== 'CLOSED' && (
                        <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => { setResolveFor(r); setResolveNote(''); }}>
                          <CheckCircle2 size={12} /> رسیدگی
                        </button>
                      )}
                      {r.status === 'RESOLVED' && !r.convertedPersonId && (
                        <>
                          <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => act(r.id, 'close')}>بستن</button>
                          <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act(r.id, 'convert')} title="ساخت شخص + تعامل نخست">تبدیل به ذینفع</button>
                        </>
                      )}
                      {r.convertedPersonId && <Badge tone="success">تبدیل‌شده به ذینفع</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyV4 icon={<Inbox size={22} />} title="پیامی در صف نیست"
                description="پیام‌های فرم عمومی (/p?slug=…) اینجا می‌آیند — لینک عمومی را از دکمهٔ بالا کپی و در کانال‌های عمومی به اشتراک بگذارید." />
            )}
          </SectionCard>
        </>
      )}

      <Modal open={!!resolveFor} title={`رسیدگی به ${resolveFor?.typeFa ?? ''}`}
        description="یادداشت رسیدگی برای ذینفع ثبت می‌شود و در گزارش روند شکایت دیده خواهد شد."
        onClose={() => setResolveFor(null)}>
        <div className="field">
          <label className="field-label" htmlFor="resolve-note">یادداشت رسیدگی *</label>
          <textarea id="resolve-note" rows={3} value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="چه اقدامی شد؟" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
          <button className="btn btn-primary" disabled={!!busy || resolveNote.trim().length < 5}
            onClick={async () => { if (resolveFor) { await act(resolveFor.id, 'resolve', { resolutionNote: resolveNote.trim() }); setResolveFor(null); } }}>ثبت رسیدگی</button>
          <button className="btn btn-ghost" onClick={() => setResolveFor(null)}>انصراف</button>
        </div>
      </Modal>
    </>
  );
}
