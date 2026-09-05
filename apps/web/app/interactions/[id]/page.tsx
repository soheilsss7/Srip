'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader } from '../../_components/page-ui';
import {
  Archive, ArrowRight, BellRing, CalendarDays, CheckCircle2, Clock3, FileText, GitBranch,
  HeartPulse, ListChecks, Mail, MessageSquare, MoreHorizontal, Phone, RefreshCw, Scale,
  ShieldAlert, StickyNote, Trash2, UserRound, Users, X, Zap,
} from 'lucide-react';
import { JalaliDateField } from '../../_components/jalali-date-field';

/* ------------------------------------------------------------------ */
/*  جزئیات تعامل — پاریتی InteractionsService (GET/PATCH/DELETE)       */
/* ------------------------------------------------------------------ */

const KIND_META: Record<string, { fa: string; icon: React.ReactNode; color: string }> = {
  CALL: { fa: 'تماس تلفنی', icon: <Phone size={15} />, color: '#3b82f6' },
  EMAIL: { fa: 'ایمیل', icon: <Mail size={15} />, color: '#8b5cf6' },
  MEETING: { fa: 'جلسه', icon: <CalendarDays size={15} />, color: '#0d9488' },
  NOTE: { fa: 'یادداشت', icon: <StickyNote size={15} />, color: '#64748b' },
  MESSAGE: { fa: 'پیام', icon: <MessageSquare size={15} />, color: '#f59e0b' },
  OTHER: { fa: 'سایر', icon: <MoreHorizontal size={15} />, color: '#94a3b8' },
};
const IMP_META: Record<string, { fa: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  LOW: { fa: 'اهمیت کم', tone: 'neutral' }, MEDIUM: { fa: 'اهمیت متوسط', tone: 'info' },
  HIGH: { fa: 'اهمیت زیاد', tone: 'warning' }, CRITICAL: { fa: 'بحرانی', tone: 'danger' },
};
const SENT_META = [
  { v: -1, fa: 'منفی', icon: <ShieldAlert size={13} />, cls: 'sent-neg' },
  { v: 0, fa: 'خنثی', icon: <Scale size={13} />, cls: 'sent-neu' },
  { v: 1, fa: 'مثبت', icon: <HeartPulse size={13} />, cls: 'sent-pos' },
];
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
};
const timeAgo = (iso?: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (diff < 0) return '—';
  if (d === 0) return 'امروز';
  if (d === 1) return 'دیروز';
  if (d < 30) return `${new Intl.NumberFormat('fa-IR').format(d)} روز پیش`;
  if (d < 365) return `${new Intl.NumberFormat('fa-IR').format(Math.floor(d / 30))} ماه پیش`;
  return `${new Intl.NumberFormat('fa-IR').format(Math.floor(d / 365))} سال پیش`;
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, can } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');
  const canWrite = isOwner || can('interaction.write');

  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [form, setForm] = useState({ summary: '', outcome: '', followUpRequired: false, followUpAt: '', importance: 'MEDIUM', sentiment: 0 });

  const load = useCallback(async () => {
    setError(''); setFlash('');
    try { const v = await api<any>(`/interactions/${id}`); setD(v); setDeleted(false); }
    catch (e) { setD(null); setError((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function saveResult() {
    setBusy('patch'); setError(''); setFlash('');
    try {
      const body: Record<string, unknown> = {
        summary: form.summary, outcome: form.outcome,
        followUpRequired: form.followUpRequired,
        followUpAt: form.followUpRequired && form.followUpAt ? form.followUpAt : null,
        importance: form.importance, sentiment: form.sentiment,
      };
      const updated = await api<any>(`/interactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setD(updated); setEditOpen(false);
      setFlash('نتیجهٔ تعامل به‌روزرسانی و در ممیزی ثبت شد.');
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); }
  }
  async function remove() {
    if (!confirm(`تعامل «${d?.subject ?? id}» بایگانی (حذف نرم) شود؟`)) return;
    setBusy('del'); setError(''); setFlash('');
    try {
      await api(`/interactions/${id}`, { method: 'DELETE' });
      setDeleted(true); setD(null);
      setFlash('تعامل بایگانی شد و دیگر در فهرست‌ها نمایش داده نمی‌شود.');
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); }
  }
  function openEdit() {
    if (!d) return;
    setForm({
      summary: d.summary ?? '', outcome: d.outcome ?? '',
      followUpRequired: !!d.followUpRequired,
      followUpAt: d.followUpAt ? String(d.followUpAt).slice(0, 16) : '',
      importance: d.importance ?? 'MEDIUM',
      sentiment: d.sentiment ?? 0,
    });
    setError(''); setEditOpen(true);
  }

  const kind = d ? (KIND_META[d.type] ?? KIND_META.OTHER) : KIND_META.OTHER;
  const imp = d ? (IMP_META[d.importance] ?? IMP_META.MEDIUM) : IMP_META.MEDIUM;
  const sent = SENT_META.find(s => s.v === (d?.sentiment ?? 0)) ?? SENT_META[1];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="تعاملات"
        title={deleted ? 'تعامل بایگانی شد' : (d?.subject ?? 'جزئیات تعامل')}
        description={d ? `${kind.fa} · ${fmtDT(d.occurredAt)} · شناسه ${d.id}` : `شناسه: ${id}`}
        actions={
          <div className="toolbar">
            {canWrite && !deleted && d && <button className="btn btn-primary" onClick={openEdit}><FileText size={15} /> ثبت نتیجه</button>}
            <button className="btn btn-secondary" onClick={load} disabled={!!busy}><RefreshCw size={15} /> بازخوانی</button>
            {canWrite && !deleted && d && (
              <button className="btn btn-danger" disabled={!!busy} onClick={remove}><Trash2 size={15} /> بایگانی</button>
            )}
          </div>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {deleted && (
        <section className="panel">
          <div className="empty-state-v4">
            <div className="empty-ico"><Archive size={26} /></div>
            <strong>تعامل بایگانی شد</strong>
            <p>این تعامل از فهرست‌ها و خط‌های زمانی حذف شد؛ برای بازگردانی با مالک سامانه تماس بگیرید.</p>
            {d?.relationshipDetail?.id && <Link className="btn btn-primary" href={`/relationships/${d.relationshipDetail.id}`}><ArrowRight size={15} /> بازگشت به رابطه</Link>}
          </div>
        </section>
      )}

      {!d && !error && !deleted && <Loading label="در حال بارگذاری تعامل…" />}

      {d && !deleted && (
        <>
          {/* سربرگ جزئیات */}
          <section className="panel">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span className="wf-ico" style={{ background: `color-mix(in srgb, ${kind.color} 14%, transparent)`, color: kind.color }}>{kind.icon}</span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge tone="info">{kind.fa}</Badge>
                  <Badge tone={imp.tone}>{imp.fa}</Badge>
                  <span className={`sent-badge ${sent.cls}`}>{sent.icon} {sent.fa}</span>
                  {d.followUpRequired && (
                    <Badge tone="warning"><BellRing size={11} /> {d.followUpAt ? `پیگیری تا ${fmtDT(d.followUpAt)}` : 'نیازمند پیگیری'}</Badge>
                  )}
                  <code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{d.id}</code>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.8, marginTop: 8, whiteSpace: 'pre-wrap' }}>{d.summary || <span className="t-muted">خلاصه‌ای ثبت نشده است.</span>}</p>
              </div>
            </div>
          </section>

          {/* محورها */}
          <div className="stat-grid">
            {d.relationshipDetail && (
              <Link className="stat-card" href={`/relationships/${d.relationshipDetail.id}`} style={{ textDecoration: 'none' }}>
                <div className="stat-top"><span className="stat-ico ic-blue"><GitBranch size={18} /></span></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, margin: '4px 0' }}>{d.relationshipDetail.sourceOrganization?.name} ↔ {d.relationshipDetail.targetOrganization?.name}</div>
                <div className="stat-label" style={{ fontSize: 11 }}>رابطه · سلامت {d.relationshipDetail.healthScore} · راهبردی {d.relationshipDetail.strategicScore}</div>
              </Link>
            )}
            {d.organization && (
              <Link className="stat-card" href={`/organizations/${d.organization.id}`} style={{ textDecoration: 'none' }}>
                <div className="stat-top"><span className="stat-ico ic-green"><Users size={18} /></span></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, margin: '4px 0' }}>{d.organization.name}</div>
                <div className="stat-label" style={{ fontSize: 11 }}>سازمان</div>
              </Link>
            )}
            {d.person && (
              <div className="stat-card">
                <div className="stat-top"><span className="stat-ico ic-gold"><UserRound size={18} /></span></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, margin: '4px 0' }}>{d.person.name}</div>
                <div className="stat-label" style={{ fontSize: 11 }}>{d.person.title ?? 'شخص'}</div>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-top"><span className="stat-ico ic-indigo"><Clock3 size={18} /></span></div>
              <div style={{ fontSize: 12.5, fontWeight: 700, margin: '4px 0' }}>{timeAgo(d.occurredAt)}</div>
              <div className="stat-label" style={{ fontSize: 11 }}>{d.durationMinutes ? `مدت ${new Intl.NumberFormat('fa-IR').format(d.durationMinutes)} دقیقه` : 'بدون مدت ثبت‌شده'}</div>
            </div>
          </div>

          {/* نتیجه */}
          <section className="panel">
            <div className="panel-title"><div><h2>نتیجه</h2><p>آنچه از این تعامل حاصل شد</p></div></div>
            {d.outcome ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.9 }}>
                <CheckCircle2 size={16} className="t-success" style={{ marginTop: 4, flexShrink: 0 }} />
                <span>{d.outcome}</span>
              </div>
            ) : <p className="empty-state">نتیجه‌ای ثبت نشده است — از دکمهٔ «ثبت نتیجه» استفاده کنید.</p>}
            {d.loggedBy && <div className="t-muted" style={{ fontSize: 11, marginTop: 10 }}>ثبت‌شده توسط {d.loggedBy.name} ({d.loggedBy.email})</div>}
          </section>

          {/* پیوندها */}
          <div className="wf-grid">
            <section className="wf-card">
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Zap size={15} /> اقدام‌های مرتبط</h2></div></div>
              {d.related?.actions?.length ? (
                <div className="list">
                  {d.related.actions.map((a: any) => (
                    <div className="listRow" key={a.id}>
                      <Badge tone={a.status === 'OPEN' ? 'warning' : a.status === 'DONE' || a.status === 'COMPLETED' ? 'success' : 'neutral'}>{a.status}</Badge>
                      <span style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{a.title}</strong>{a.dueAt && <small>سررسید: {fmtDT(a.dueAt)}</small>}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state" style={{ padding: 14 }}>اقدامی برای این رابطه ثبت نشده است.</p>}
            </section>
            <section className="wf-card">
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ListChecks size={15} /> تعهدهای مرتبط</h2></div></div>
              {d.related?.commitments?.length ? (
                <div className="list">
                  {d.related.commitments.map((c: any) => (
                    <div className="listRow" key={c.id}>
                      <Badge tone={c.status === 'OPEN' ? 'warning' : 'success'}>{c.status === 'OPEN' ? 'باز' : c.status}</Badge>
                      <span style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{String(c.description).slice(0, 90)}</strong>{c.dueAt && <small>سررسید: {fmtDT(c.dueAt)}</small>}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state" style={{ padding: 14 }}>تعهدی برای این رابطه ثبت نشده است.</p>}
            </section>
            <section className="wf-card">
              <div className="panel-title"><div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><CalendarDays size={15} /> جلسه‌های مرتبط</h2></div></div>
              {d.related?.meetings?.length ? (
                <div className="list">
                  {d.related.meetings.map((m: any) => (
                    <div className="listRow" key={m.id}>
                      <Badge tone="success">جلسه</Badge>
                      <span style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{m.title}</strong><small>{fmtDT(m.startAt)}</small></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state" style={{ padding: 14 }}>جلسه‌ای مرتبط نیست.</p>}
            </section>
          </div>

          {/* خط زمانی تعاملات */}
          <section className="panel">
            <div className="panel-title">
              <div><h2>تعامل‌های دیگر همین رابطه</h2><p>خط زمانی کامل تعاملات — برای مشاهده، روی هر ردیف کلیک کنید</p></div>
              <Badge>{d.timeline?.length ?? 0}</Badge>
            </div>
            {d.timeline?.length ? (
              <div className="list">
                {d.timeline.map((t: any) => {
                  const km = KIND_META[t.type] ?? KIND_META.OTHER;
                  const sm = SENT_META.find(s => s.v === (t.sentiment ?? 0)) ?? SENT_META[1];
                  const im = IMP_META[t.importance] ?? IMP_META.MEDIUM;
                  return (
                    <Link href={`/interactions/${t.id}`} key={t.id} className="listRow linkRow" style={{ textDecoration: 'none' }}>
                      <span className="wf-ico" style={{ width: 30, height: 30, background: `color-mix(in srgb, ${km.color} 13%, transparent)`, color: km.color }}>{km.icon}</span>
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 12.5 }}>{t.subject}</strong>
                        <small><CalendarDays size={11} style={{ verticalAlign: '-1px' }} /> {fmtDT(t.occurredAt)}</small>
                      </span>
                      <Badge tone={im.tone}>{im.fa}</Badge>
                      <span className={`sent-badge ${sm.cls}`} style={{ fontSize: 10.5 }}>{sm.fa}</span>
                    </Link>
                  );
                })}
              </div>
            ) : <p className="empty-state">تعامل دیگری برای این رابطه ثبت نشده است.</p>}
          </section>
        </>
      )}

      {/* ثبت نتیجه */}
      <Modal
        open={editOpen}
        title="ثبت نتیجه و وضعیت پیگیری"
        description="خلاصه، نتیجه، احساس و اهمیت تعامل به‌روزرسانی می‌شود و در ممیزی با برچسب Interaction ثبت می‌گردد."
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)}><X size={14} /> انصراف</button>
            <button className="btn btn-primary" disabled={busy === 'patch'} onClick={saveResult}>{busy === 'patch' ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} ذخیره</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="field full"><span className="field-label">خلاصه</span>
            <textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="خلاصهٔ گفت‌وگو و دستور جلسه…" />
          </label>
          <label className="field full"><span className="field-label">نتیجه</span>
            <textarea rows={3} value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} placeholder="توافق‌ها، تصمیم‌ها و گام بعدی…" />
          </label>
          <div className="form-grid">
            <label><span className="field-label">اهمیت</span>
              <select value={form.importance} onChange={e => setForm(f => ({ ...f, importance: e.target.value }))}>
                {Object.entries(IMP_META).map(([k, v]) => <option key={k} value={k}>{v.fa}</option>)}
              </select>
            </label>
            <label><span className="field-label">احساس</span>
              <select value={form.sentiment} onChange={e => setForm(f => ({ ...f, sentiment: Number(e.target.value) }))}>
                {SENT_META.map(s => <option key={s.v} value={s.v}>{s.fa}</option>)}
              </select>
            </label>
            <label className="check-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.followUpRequired} onChange={e => setForm(f => ({ ...f, followUpRequired: e.target.checked }))} />
              نیازمند پیگیری
            </label>
            {form.followUpRequired && (
              <label><span className="field-label">موعد پیگیری</span>
                <JalaliDateField withTime value={form.followUpAt} onChange={(v) => setForm(f => ({ ...f, followUpAt: v }))} />
              </label>
            )}
          </div>
        </div>
      </Modal>
    </main>
  );
}
