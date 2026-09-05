'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader } from '../../_components/page-ui';
import { CheckCircle2, ChevronLeft, Flag, FolderKanban, Gauge, Link2, Plus, RefreshCw, ShieldAlert, Target, Trash2, User, X } from 'lucide-react';;
import { JalaliDateField } from '../../_components/jalali-date-field';

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: any): string => v == null || v === '' ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const PROJ_STATUS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const REQ_STATUS = ['OPEN', 'IN_PROGRESS', 'SATISFIED', 'BLOCKED', 'CANCELLED'];
const MILESTONE_STATUS = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'];
const RISK_STATUS = ['OPEN', 'MITIGATED', 'ACCEPTED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const CATEGORIES = ['BUSINESS', 'TECHNICAL', 'PROCESS', 'COMPLIANCE', 'RESOURCE'];
const CLOSED = ['COMPLETED', 'CANCELLED'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  PLANNED: 'neutral', ACTIVE: 'info', ON_HOLD: 'warning', COMPLETED: 'success', CANCELLED: 'danger',
};
const PRIO_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
const statusTone = (s?: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' =>
  s === 'SATISFIED' || s === 'COMPLETED' || s === 'CLOSED' ? 'success'
    : s === 'BLOCKED' ? 'danger'
      : s === 'IN_PROGRESS' || s === 'ACTIVE' || s === 'MITIGATED' ? 'info'
        : s === 'ACCEPTED' || s === 'ON_HOLD' || s === 'PLANNED' ? 'warning' : 'neutral';

type Panel = 'requirement' | 'risk' | 'milestone';
type DelItem = { kind: 'requirement' | 'risk' | 'milestone' | 'rel' | 'project'; id: string; title: string } | null;

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [allRels, setAllRels] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [del, setDel] = useState<DelItem>(null);
  const [linkRelId, setLinkRelId] = useState('');
  const [reqForm, setReqForm] = useState({ title: '', description: '', category: '', status: 'OPEN', priority: 'MEDIUM' });
  const [riskForm, setRiskForm] = useState({ title: '', description: '', probability: '', impact: '', mitigation: '', status: 'OPEN' });
  const [msForm, setMsForm] = useState({ title: '', description: '', status: 'PLANNED', dueAt: '' });

  const load = useCallback(async () => {
    setError('');
    try {
      const [one, ps, rs] = await Promise.all([
        api<any>(`/projects/${id}`),
        api<any>('/people').catch(() => []),
        api<any>('/relationships').catch(() => []),
      ]);
      setP(one);
      setPeople(arr(ps)); setAllRels(arr(rs));
    } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function doIt(label: string, fn: () => Promise<any>, doneMsg = '') {
    setBusy(label); setError(''); setInfo('');
    try { await fn(); if (doneMsg) setInfo(doneMsg); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  function patch(path: string, body: any, doneMsg = '') {
    return doIt('patch', () => api(path, { method: 'PATCH', body: JSON.stringify(body) }), doneMsg);
  }

  const linkedRelIds = useMemo(() => new Set((p?.relationships ?? []).map((r: any) => r.relationshipId)), [p]);
  const relCandidates = useMemo(() => {
    if (!p) return [];
    return allRels.filter((r: any) =>
      !linkedRelIds.has(r.id) &&
      (r.sourceOrganizationId === p.organizationId || r.targetOrganizationId === p.organizationId),
    );
  }, [p, allRels, linkedRelIds]);

  function addReq(e: React.FormEvent) {
    e.preventDefault();
    return doIt('req', () => api('/projects/requirements', { method: 'POST', body: JSON.stringify({ ...reqForm, projectId: id }) }), 'الزام ثبت شد.').then(() => {
      setReqForm({ title: '', description: '', category: '', status: 'OPEN', priority: 'MEDIUM' }); setPanel(null);
    });
  }
  function addRisk(e: React.FormEvent) {
    e.preventDefault();
    return doIt('risk', () => api(`/projects/${id}/risks`, { method: 'POST', body: JSON.stringify({ ...riskForm, probability: Number(riskForm.probability) || 0, impact: Number(riskForm.impact) || 0 }) }), 'ریسک ثبت شد.').then(() => {
      setRiskForm({ title: '', description: '', probability: '', impact: '', mitigation: '', status: 'OPEN' }); setPanel(null);
    });
  }
  function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    return doIt('milestone', () => api(`/projects/${id}/milestones`, { method: 'POST', body: JSON.stringify({ ...msForm, dueAt: msForm.dueAt ? new Date(msForm.dueAt).toISOString() : undefined }) }), 'مرحله ثبت شد.').then(() => {
      setMsForm({ title: '', description: '', status: 'PLANNED', dueAt: '' }); setPanel(null);
    });
  }
  function linkRelationship(rid: string) {
    if (!rid) return;
    return doIt('link', () => api(`/projects/${id}/relationships`, { method: 'POST', body: JSON.stringify({ relationshipId: rid }) }), 'رابطه پیوند شد.').then(() => setLinkRelId(''));
  }
  function confirmDel() {
    if (!del) return;
    if (del.kind === 'project') {
      return doIt('del', async () => { await api(`/projects/${id}`, { method: 'DELETE' }); router.replace('/projects'); }, '').then(() => setDel(null));
    }
    const pathMap: Record<string, string> = {
      requirement: `/projects/requirements/${del.id}`,
      risk: `/projects/risks/${del.id}`,
      milestone: `/projects/milestones/${del.id}`,
      rel: `/projects/${id}/relationships/${del.id}`,
    };
    const labels: Record<string, string> = { requirement: 'الزام حذف شد.', risk: 'ریسک حذف شد.', milestone: 'مرحله حذف شد.', rel: 'پیوند رابطه برداشته شد.' };
    return doIt('delItem', () => api(pathMap[del.kind], { method: 'DELETE' }), labels[del.kind]).then(() => setDel(null));
  }

  const items = p?.requirements ?? [];
  const risks = p?.risks ?? [];
  const milestones = p?.milestones ?? [];

  if (!p && !error) return <main className="feature-page"><PageHeader eyebrow="پروژه" title="پروژه" description="" actions={<></>} /><Loading /></main>;

  const open = !!p && !CLOSED.includes(p.status);
  const progress = p?.progress ?? 0;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · پروژه"
        title={p?.name ?? 'پروژه'}
        description={p?.objective || 'بدون هدف ثبت‌شده'}
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <Link className="secondary-action" href="/projects"><ChevronLeft size={14} /> فهرست پروژه‌ها</Link>
            <button className="secondary-action" onClick={load} disabled={!!busy}><RefreshCw size={14} /> بازخوانی</button>
            <button className="danger-action" disabled={!!busy} onClick={() => setDel({ kind: 'project', id, title: p?.name ?? '' })}><Trash2 size={14} /> حذف پروژه</button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {!p ? <Loading /> : (
        <>
          {/* وضعیت */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico">{p.status === 'COMPLETED' ? <CheckCircle2 size={17} /> : p.status === 'ACTIVE' ? <Gauge size={17} /> : <FolderKanban size={17} />}</span>
              <div>
                <h2>وضعیت پروژه</h2>
                <p>{p.status === 'COMPLETED' ? 'پروژه کامل تحویل شده است.' : p.status === 'CANCELLED' ? 'پروژه لغو شده است.' : p.status === 'ON_HOLD' ? 'پروژه موقتاً متوقف است.' : p.status === 'ACTIVE' ? 'پروژه در جریان اجراست.' : 'پروژه برنامه‌ریزی‌شده و در انتظار شروع است.'}</p>
              </div>
              <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{fa(p.status)}</Badge>
            </div>
            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>وضعیت</span>
                <div className="rel-metric-value">
                  <select aria-label="تغییر وضعیت پروژه" className="toolbar-select" style={{ minHeight: 32 }}
                    value={p.status} disabled={!!busy}
                    onChange={e => patch(`/projects/${id}`, { status: e.target.value }, 'وضعیت به‌روزرسانی شد.')}>
                    {PROJ_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>اولویت</span>
                <div className="rel-metric-value">
                  <select aria-label="اولویت پروژه" className="toolbar-select" style={{ minHeight: 32 }}
                    value={p.priority ?? 'MEDIUM'} disabled={!!busy}
                    onChange={e => patch(`/projects/${id}`, { priority: e.target.value }, 'اولویت به‌روزرسانی شد.')}>
                    {PRIORITIES.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>پیشرفت</span>
                <div className="rel-metric-value" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, width: '100%' }}>
                  <div className="prog-line">
                    <div className="prog-bar"><div className={`prog-fill ${progress >= 100 ? 'ok' : progress >= 60 ? '' : 'warn'}`} style={{ width: `${progress}%` }} /></div>
                    <span className="prog-num">{fmtNum(progress)}٪</span>
                  </div>
                </div>
                <div className="rel-metric-note">{fmtNum(p.doneMilestones ?? 0)} از {fmtNum(p.totalMilestones ?? 0)} مرحله تکمیل‌شده</div>
              </div>
              <div className="rel-metric">
                <span>مالک پروژه</span>
                <div className="rel-metric-value">
                  {people.length ? (
                    <select aria-label="مالک پروژه" className="toolbar-select" style={{ minHeight: 32, maxWidth: 180, fontSize: 12 }}
                      value={p.ownerId ?? ''} disabled={!!busy}
                      onChange={e => patch(`/projects/${id}`, { ownerId: e.target.value || undefined }, 'مالک تعیین شد.')}>
                      <option value="">بدون مالک</option>
                      {people.map((pp: any) => <option key={pp.id} value={pp.id}>{pp.firstName} {pp.lastName}</option>)}
                    </select>
                  ) : p.owner ? (
                    <Link href={`/people/${p.ownerId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--srip-accent-text)' }}>
                      <User size={14} /> {p.owner.name}
                    </Link>
                  ) : <b className="h-null" style={{ fontSize: 13 }}>بدون مالک</b>}
                </div>
              </div>
              <div className="rel-metric">
                <span>پایانِ هدف</span>
                <div className="rel-metric-value"><b className={p.targetAt && open && new Date(p.targetAt).getTime() < Date.now() ? 'h-crit' : p.targetAt ? '' : 'h-null'} style={{ fontSize: 13 }}>{p.targetAt ? fmtDate(p.targetAt) : 'ثبت نشده'}</b></div>
                {p.targetAt && open && new Date(p.targetAt).getTime() < Date.now() && <div className="rel-metric-note"><ShieldAlert size={11} style={{ verticalAlign: '-1px' }} /> از هدفِ پایان گذشته است</div>}
              </div>
            </div>
            <div className="rel-status-actions">
              {open && (
                <button className="btn btn-primary btn-sm" disabled={!!busy}
                  onClick={() => patch(`/projects/${id}`, { status: 'COMPLETED' }, 'پایان پروژه ثبت شد.')}>
                  <CheckCircle2 size={14} /> ثبت به‌عنوان تکمیل‌شده
                </button>
              )}
              {p.status === 'COMPLETED' && (
                <button className="btn btn-secondary btn-sm" disabled={!!busy}
                  onClick={() => patch(`/projects/${id}`, { status: 'ACTIVE' }, 'پروژه دوباره فعال شد.')}>
                  <RefreshCw size={14} /> بازگشایی پروژه
                </button>
              )}
            </div>
          </section>

          <div className="split-panels">
            {/* اطلاعات */}
            <section className="panel">
              <div className="panel-title"><div><h2>اطلاعات پروژه</h2><p>بستر و زمان‌بندی</p></div></div>
              <div className="detail-grid">
                <div className="detail-item">
                  <small>سازمانِ کارفرما</small>
                  {p.organization ? <Link className="t-primary" href={`/organizations/${p.organizationId}`}>{p.organization.name}</Link> : <strong className="h-null">—</strong>}
                </div>
                <div className="detail-item">
                  <small>مالک پروژه</small>
                  {p.owner ? <Link className="t-primary" href={`/people/${p.ownerId}`}>{p.owner.name}</Link> : <strong className="h-null">—</strong>}
                </div>
                <div className="detail-item">
                  <small>هدف</small>
                  <strong style={{ whiteSpace: 'pre-line', lineHeight: 1.9 }}>{p.objective || '—'}</strong>
                </div>
                <div className="detail-item">
                  <small>توضیحات</small>
                  <strong style={{ whiteSpace: 'pre-line', lineHeight: 1.9 }}>{p.description || '—'}</strong>
                </div>
                <div className="detail-item"><small>شروع</small><strong>{p.startAt ? fmtDate(p.startAt) : '—'}</strong></div>
                <div className="detail-item"><small>پایانِ هدف</small><strong>{p.targetAt ? fmtDate(p.targetAt) : '—'}</strong></div>
                <div className="detail-item"><small>تاریخ تکمیل</small><strong>{p.endAt ? fmtDateTime(p.endAt) : '—'}</strong></div>
                <div className="detail-item"><small>زمان ایجاد</small><strong>{p.createdAt ? fmtDateTime(p.createdAt) : '—'}</strong></div>
              </div>
            </section>

            {/* مراحل */}
            <section className="panel">
              <div className="panel-title">
                <div><h2>مراحل کلیدی</h2><p>مبنای محاسبهٔ پیشرفت</p></div>
                <Badge>{fmtNum(milestones.length)}</Badge>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPanel('milestone'); }}><Plus size={13} /> افزودن</button>
              </div>
              {milestones.length ? (
                <div className="list">
                  {milestones.map((m: any) => (
                    <div className="listRow" key={m.id}>
                      <Badge tone={statusTone(m.status)}>{fa(m.status)}</Badge>
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 12.5 }}>{m.title}</strong>
                        {m.description && <small>{m.description}</small>}
                        {m.dueAt && <small>سررسید: {fmtDate(m.dueAt)}</small>}
                      </span>
                      <span className="resource-row-actions">
                        <select aria-label={`وضعیت ${m.title}`} className="toolbar-select" style={{ minHeight: 28, fontSize: 11 }}
                          value={m.status} disabled={!!busy}
                          onChange={e => patch(`/projects/milestones/${m.id}`, { status: e.target.value }, 'وضعیت مرحله تغییر کرد.')}>
                          {MILESTONE_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" aria-label={`حذف ${m.title}`} disabled={!!busy} onClick={() => setDel({ kind: 'milestone', id: m.id, title: m.title })}><X size={13} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state"><Flag size={18} /> مرحله‌ای ثبت نشده — با «افزودن» شروع کنید.</p>}
            </section>
          </div>

          <div className="split-panels">
            {/* الزامات */}
            <section className="panel">
              <div className="panel-title">
                <div><h2>الزامات</h2><p>نیازمندی‌های پروژه</p></div>
                <Badge>{fmtNum(items.length)}</Badge>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPanel('requirement'); }}><Plus size={13} /> افزودن</button>
              </div>
              {items.length ? (
                <div className="list">
                  {items.map((r: any) => (
                    <div className="listRow" key={r.id}>
                      <Badge tone={statusTone(r.status)}>{fa(r.status)}</Badge>
                      <Badge tone={PRIO_TONE[r.priority] ?? 'neutral'}>{fa(r.priority)}</Badge>
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 12.5 }}>{r.title}</strong>
                        {r.description && <small>{r.description}</small>}
                        {r.category && <small>دسته: {fa(r.category)}</small>}
                      </span>
                      <span className="resource-row-actions">
                        <select aria-label={`وضعیت ${r.title}`} className="toolbar-select" style={{ minHeight: 28, fontSize: 11 }}
                          value={r.status} disabled={!!busy}
                          onChange={e => patch(`/projects/requirements/${r.id}`, { status: e.target.value }, 'وضعیت الزام تغییر کرد.')}>
                          {REQ_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" aria-label={`حذف ${r.title}`} disabled={!!busy} onClick={() => setDel({ kind: 'requirement', id: r.id, title: r.title })}><X size={13} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state"><Target size={18} /> الزامی ثبت نشده است.</p>}
            </section>

            {/* ریسک‌ها */}
            <section className="panel">
              <div className="panel-title">
                <div><h2>ریسک‌ها</h2><p>احتمال × اثر</p></div>
                <Badge>{fmtNum(risks.length)}</Badge>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPanel('risk'); }}><Plus size={13} /> افزودن</button>
              </div>
              {risks.length ? (
                <div className="list">
                  {risks.map((r: any) => (
                    <div className="listRow" key={r.id}>
                      <Badge tone={(r.score ?? 0) >= 40 ? 'danger' : (r.score ?? 0) >= 20 ? 'warning' : statusTone(r.status)}>{fmtNum(r.score)}</Badge>
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 12.5 }}>{r.title}</strong>
                        {r.description && <small>{r.description}</small>}
                        <small>{fa(r.probability)}٪ × {fa(r.impact)}٪ اثر{r.mitigation ? ` · پایش: ${r.mitigation}` : ''}</small>
                      </span>
                      <span className="resource-row-actions">
                        <select aria-label={`وضعیت ${r.title}`} className="toolbar-select" style={{ minHeight: 28, fontSize: 11 }}
                          value={r.status} disabled={!!busy}
                          onChange={e => patch(`/projects/risks/${r.id}`, { status: e.target.value }, 'وضعیت ریسک تغییر کرد.')}>
                          {RISK_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" aria-label={`حذف ${r.title}`} disabled={!!busy} onClick={() => setDel({ kind: 'risk', id: r.id, title: r.title })}><X size={13} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state"><ShieldAlert size={18} /> ریسکی ثبت نشده است.</p>}
            </section>
          </div>

          {/* روابط مرتبط */}
          <section className="panel">
            <div className="panel-title">
              <div><h2>روابط مرتبط</h2><p>روابط سازمانِ کارفرما که به پروژه پیوند خورده‌اند</p></div>
              <Badge>{fmtNum(p.relationships?.length ?? 0)}</Badge>
            </div>
            {(p.relationships ?? []).length ? (
              <div className="list">
                {(p.relationships ?? []).map((pr: any) => {
                  const rel = pr.relationship;
                  return (
                    <div className="listRow" key={pr.relationshipId}>
                      <Badge tone={pr.required ? 'danger' : 'info'}>{pr.required ? 'حیاتی' : fa(pr.status)}</Badge>
                      <span style={{ flex: 1 }}>
                        <Link className="t-primary" href={`/relationships/${rel.id}`} style={{ fontSize: 12.5 }}>
                          {rel.sourceOrganization?.name} ↔ {rel.targetOrganization?.name} <small>({fa(rel.relationshipType)})</small>
                        </Link>
                        {pr.relevance != null && <small>اهمیت: {fmtNum(pr.relevance)}</small>}
                      </span>
                      <button className="btn btn-ghost btn-sm" disabled={!!busy}
                        onClick={() => setDel({ kind: 'rel', id: rel.id, title: `${rel.sourceOrganization?.name} ↔ ${rel.targetOrganization?.name}` })}>
                        جدا کردن پیوند
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="empty-state"><Link2 size={18} /> رابطه‌ای پیوند نشده است.</p>}
            {relCandidates.length > 0 && (
              <div className="inline-form" style={{ marginTop: 10 }}>
                <select aria-label="پیوند رابطه" className="toolbar-select" style={{ flex: 1, minWidth: 0 }} value={linkRelId} onChange={e => setLinkRelId(e.target.value)}>
                  <option value="">انتخاب رابطه برای پیوند…</option>
                  {relCandidates.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.sourceOrganization?.name} ↔ {r.targetOrganization?.name}{r.relationshipType ? ` (${fa(r.relationshipType)})` : ''}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" disabled={!!busy || !linkRelId} onClick={() => linkRelationship(linkRelId)}>پیوند</button>
              </div>
            )}
          </section>
        </>
      )}

      {/* مودال افزودن الزام */}
      <Modal open={panel === 'requirement'} title="ثبت الزام جدید" description="یک نیازمندی برای این پروژه ثبت می‌شود."
        onClose={() => setPanel(null)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPanel(null)}>انصراف</button>
          <button className="btn btn-primary" form="proj-req-form" type="submit" disabled={!!busy}>{busy === 'req' ? 'در حال ثبت…' : 'ثبت الزام'}</button>
        </>}>
        <form id="proj-req-form" className="entity-form org-form" onSubmit={addReq}>
          <div className="form-grid">
            <div className="field full"><label className="field-label" htmlFor="prq-title">عنوان <span className="req">*</span></label>
              <input id="prq-title" required value={reqForm.title} onChange={e => setReqForm({ ...reqForm, title: e.target.value })} placeholder="مثلاً: اتصال به هستهٔ بانکی" /></div>
            <div className="field full"><label className="field-label" htmlFor="prq-desc">توضیحات</label>
              <textarea id="prq-desc" value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="prq-cat">دسته</label>
              <select id="prq-cat" value={reqForm.category} onChange={e => setReqForm({ ...reqForm, category: e.target.value })}>
                <option value="">بدون دسته</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{fa(c)}</option>)}
              </select></div>
            <div className="field"><label className="field-label" htmlFor="prq-status">وضعیت</label>
              <select id="prq-status" value={reqForm.status} onChange={e => setReqForm({ ...reqForm, status: e.target.value })}>
                {REQ_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select></div>
            <div className="field"><label className="field-label" htmlFor="prq-prio">اولویت</label>
              <select id="prq-prio" value={reqForm.priority} onChange={e => setReqForm({ ...reqForm, priority: e.target.value })}>
                {PRIORITIES.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select></div>
          </div>
        </form>
      </Modal>

      {/* مودال افزودن ریسک */}
      <Modal open={panel === 'risk'} title="ثبت ریسک جدید" description="ریسک با احتمال و اثر سنجیده می‌شود؛ امتیاز = احتمال × اثر."
        onClose={() => setPanel(null)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPanel(null)}>انصراف</button>
          <button className="btn btn-primary" form="proj-risk-form" type="submit" disabled={!!busy}>{busy === 'risk' ? 'در حال ثبت…' : 'ثبت ریسک'}</button>
        </>}>
        <form id="proj-risk-form" className="entity-form org-form" onSubmit={addRisk}>
          <div className="form-grid">
            <div className="field full"><label className="field-label" htmlFor="prk-title">عنوان <span className="req">*</span></label>
              <input id="prk-title" required value={riskForm.title} onChange={e => setRiskForm({ ...riskForm, title: e.target.value })} /></div>
            <div className="field full"><label className="field-label" htmlFor="prk-desc">توضیحات</label>
              <textarea id="prk-desc" value={riskForm.description} onChange={e => setRiskForm({ ...riskForm, description: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="prk-p">احتمال (۰ تا ۱۰۰)</label>
              <input id="prk-p" type="number" min={0} max={100} value={riskForm.probability} onChange={e => setRiskForm({ ...riskForm, probability: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="prk-i">اثر (۰ تا ۱۰۰)</label>
              <input id="prk-i" type="number" min={0} max={100} value={riskForm.impact} onChange={e => setRiskForm({ ...riskForm, impact: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="prk-mit">پایش</label>
              <input id="prk-mit" value={riskForm.mitigation} onChange={e => setRiskForm({ ...riskForm, mitigation: e.target.value })} placeholder="اقدام پیشگیرانه…" /></div>
            <div className="field"><label className="field-label" htmlFor="prk-status">وضعیت</label>
              <select id="prk-status" value={riskForm.status} onChange={e => setRiskForm({ ...riskForm, status: e.target.value })}>
                {RISK_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select></div>
          </div>
        </form>
      </Modal>

      {/* مودال افزودن مرحله */}
      <Modal open={panel === 'milestone'} title="ثبت مرحله کلیدی" description="مرحلهٔ کلیدی به مسیر پروژه اضافه می‌شود و پیشرفت را به‌روز می‌کند."
        onClose={() => setPanel(null)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPanel(null)}>انصراف</button>
          <button className="btn btn-primary" form="proj-ms-form" type="submit" disabled={!!busy}>{busy === 'milestone' ? 'در حال ثبت…' : 'ثبت مرحله'}</button>
        </>}>
        <form id="proj-ms-form" className="entity-form org-form" onSubmit={addMilestone}>
          <div className="form-grid">
            <div className="field full"><label className="field-label" htmlFor="pms-title">عنوان <span className="req">*</span></label>
              <input id="pms-title" required value={msForm.title} onChange={e => setMsForm({ ...msForm, title: e.target.value })} placeholder="مثلاً: فاز ۴ — استقرار" /></div>
            <div className="field full"><label className="field-label" htmlFor="pms-desc">توضیحات</label>
              <textarea id="pms-desc" value={msForm.description} onChange={e => setMsForm({ ...msForm, description: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="pms-status">وضعیت</label>
              <select id="pms-status" value={msForm.status} onChange={e => setMsForm({ ...msForm, status: e.target.value })}>
                {MILESTONE_STATUS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select></div>
            <div className="field"><label className="field-label" htmlFor="pms-due">سررسید</label>
              <JalaliDateField id="pms-due" withTime value={msForm.dueAt} onChange={(v) => setMsForm({ ...msForm, dueAt: v })} /></div>
          </div>
        </form>
      </Modal>

      {/* مودال تأیید حذف */}
      {del && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="تأیید حذف" onClick={e => { if (e.target === e.currentTarget) setDel(null); }}>
          <div className="modal-card">
            <div className="modal-head">
              <div><h2>{del.kind === 'project' ? 'حذف پروژه' : del.kind === 'rel' ? 'جدا کردن رابطه' : 'حذف ' + (del.kind === 'requirement' ? 'الزام' : del.kind === 'risk' ? 'ریسک' : 'مرحله')}</h2>
                <p>{del.kind === 'project' ? 'این پروژه برای همیشه حذف می‌شود و پیوندهایش پاک می‌شود.' : del.kind === 'rel' ? `رابطهٔ «${del.title}» از این پروژه جدا می‌شود.` : `«${del.title}» برای همیشه حذف می‌شود.`} مطمئن هستید؟</p></div>
            </div>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDel(null)} disabled={!!busy}>انصراف</button>
              <button className="danger-action" onClick={confirmDel} disabled={!!busy}>{busy ? 'در حال حذف…' : 'حذف برای همیشه'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}