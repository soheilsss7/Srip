'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { Zap, Bell, Trash2, User, Link2, ChevronLeft, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';;;

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: any): string => v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const PRIO_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DONE_STATUSES = ['DONE', 'COMPLETED', 'CANCELLED'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  OPEN: 'warning', IN_PROGRESS: 'info', BLOCKED: 'danger', DONE: 'success', COMPLETED: 'success', CANCELLED: 'neutral',
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [a, setA] = useState<any>(null);
  const [allActions, setAllActions] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [newDepId, setNewDepId] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [one, all, ps] = await Promise.all([
        api(`/actions/${id}`),
        api<any>('/actions').catch(() => []),
        api<any>('/people').catch(() => []),
      ]);
      setA(one);
      setAllActions(arr(all).filter((x: any) => x.id !== id));
      setPeople(arr(ps));
    } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function doIt(label: string, fn: () => Promise<any>, doneMsg = '') {
    setBusy(label); setError(''); setInfo('');
    try { await fn(); if (doneMsg) setInfo(doneMsg); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  async function patch(body: any, doneMsg: string) {
    await doIt('patch', () => api(`/actions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), doneMsg);
    await load();
  }
  async function addDependency(depId: string) {
    if (!depId || depId === id) return;
    await doIt('dep', () => api(`/actions/${id}/dependencies/${encodeURIComponent(depId)}`, { method: 'POST' }), 'وابستگی افزوده شد.');
    setNewDepId('');
    await load();
  }
  async function removeDependency(depId: string) {
    await doIt('undep', () => api(`/actions/${id}/dependencies/${encodeURIComponent(depId)}`, { method: 'DELETE' }), 'وابستگی حذف شد.');
    await load();
  }
  async function remove() {
    await doIt('del', async () => { await api(`/actions/${id}`, { method: 'DELETE' }); }, 'اقدام حذف شد.');
    router.replace('/actions');
  }

  const overdue = !!a?.dueAt && !DONE_STATUSES.includes(a?.status) && new Date(a.dueAt).getTime() < Date.now();
  const deps = a?.dependencies ?? [];
  const blockedBy = a?.blockedBy ?? [];
  const depCandidates = useMemo(
    () => allActions.filter((x: any) => !DONE_STATUSES.includes(x.status) && !deps.some((d: any) => d.id === x.id)),
    [allActions, deps],
  );

  if (!a && !error) return <main className="feature-page"><PageHeader eyebrow="اقدام" title="اقدام" description="" actions={<></>} /><Loading /></main>;

  const statusTone = STATUS_TONE[a?.status ?? ''] ?? 'neutral';
  const rel = a?.relationship;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · اقدام"
        title={a?.title ?? 'اقدام'}
        description={a?.description || 'بدون توضیح'}
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <Link className="secondary-action" href="/actions"><ChevronLeft size={14} /> فهرست اقدامات</Link>
            <button className="secondary-action" onClick={load} disabled={!!busy}><RefreshCw size={14} /> بازخوانی</button>
            <button className="danger-action" disabled={!!busy} onClick={() => setConfirmDel(true)}><Trash2 size={14} /> حذف اقدام</button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {!a ? <Loading /> : (
        <>
          {/* وضعیت */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico">{a.status === 'DONE' || a.status === 'COMPLETED' ? <CheckCircle2 size={17} /> : overdue ? <AlertTriangle size={17} /> : <Zap size={17} />}</span>
              <div>
                <h2>وضعیت اقدام</h2>
                <p>{overdue ? 'موعد این اقدام گذشته و هنوز باز است — پیگیری کنید.' : a.status === 'DONE' || a.status === 'COMPLETED' ? 'این اقدام تکمیل شده است.' : a.status === 'BLOCKED' ? 'این اقدام مسدود است — وابستگی‌ها را بررسی کنید.' : 'این اقدام در جریان است.'}</p>
              </div>
              <Badge tone={statusTone}>{fa(a.status)}</Badge>
            </div>
            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>وضعیت</span>
                <div className="rel-metric-value" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <select aria-label="تغییر وضعیت اقدام" className="toolbar-select" style={{ minHeight: 32 }}
                    value={a.status ?? 'OPEN'} disabled={!!busy}
                    onChange={e => patch({ status: e.target.value }, 'وضعیت به‌روزرسانی شد.')}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>اولویت</span>
                <div className="rel-metric-value">
                  <select aria-label="اولویت اقدام" className="toolbar-select" style={{ minHeight: 32, fontSize: 12 }}
                    value={a.priority ?? 'MEDIUM'} disabled={!!busy}
                    onChange={e => patch({ priority: e.target.value }, 'اولویت به‌روزرسانی شد.')}>
                    {PRIO_OPTIONS.map(p => <option key={p} value={p}>{fa(p)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>موعد</span>
                <div className="rel-metric-value">
                  <b className={overdue ? 'h-crit' : a.dueAt ? '' : 'h-null'} style={{ fontSize: 14 }}>{a.dueAt ? fmtDateTime(a.dueAt) : 'ثبت نشده'}</b>
                </div>
                {overdue && <div className="rel-metric-note"><AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> عقب‌افتاده است</div>}
              </div>
              <div className="rel-metric">
                <span>مالک</span>
                <div className="rel-metric-value">
                  {people.length ? (
                    <select aria-label="مالک اقدام" className="toolbar-select" style={{ minHeight: 32, fontSize: 12.5, fontWeight: 700, color: a.owner ? 'var(--srip-accent-text)' : 'var(--text-muted)' }}
                      value={a.ownerId ?? ''} disabled={!!busy}
                      onChange={e => patch({ ownerId: e.target.value || undefined }, 'مالک تعیین شد.')}>
                      <option value="">بدون مالک</option>
                      {people.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                    </select>
                  ) : a.owner ? (
                    <Link href={`/people/${a.ownerId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--srip-accent-text)' }}>
                      <User size={14} /> {a.owner.name}
                    </Link>
                  ) : <b className="h-null" style={{ fontSize: 13 }}>بدون مالک</b>}
                </div>
              </div>
              <div className="rel-metric">
                <span>یادآور</span>
                <div className="rel-metric-value"><b style={{ fontSize: 13 }} className={a.reminderAt ? '' : 'h-null'}>{a.reminderAt ? fmtDateTime(a.reminderAt) : 'تنظیم نشده'}</b></div>
                <div className="rel-metric-note"><Bell size={11} style={{ verticalAlign: '-1px' }} /> {a.reminderAt ? 'اعلان در این زمان' : 'بدون اعلان'}</div>
              </div>
            </div>
          </section>

          <div className="split-panels">
            {/* جزئیات */}
            <section className="panel">
              <div className="panel-title"><div><h2>جزئیات اقدام</h2><p>زمینه و زمان‌بندی</p></div></div>
              <div className="detail-grid">
                {[
                  ['توضیح', a.description || null],
                  ['نتیجهٔ نهایی', a.outcome || null],
                  ['زمان ایجاد', a.createdAt ? fmtDateTime(a.createdAt) : null],
                  ['زمان تکمیل', a.completedAt ? fmtDateTime(a.completedAt) : null],
                ].filter(([, v]) => v != null).map(([k, v]) => (
                  <div className="detail-item" key={String(k)} style={{ gridColumn: '1/-1' }}><small>{String(k)}</small><strong style={{ whiteSpace: 'pre-line', lineHeight: 1.9 }}>{String(v)}</strong></div>
                ))}
              </div>
              {rel && (
                <>
                  <div className="panel-title" style={{ marginTop: 16 }}><div><h2>رابطهٔ مرتبط</h2></div></div>
                  <Link className="rel-status-row" href={`/relationships/${rel.id}`}>
                    <span className="health-dot h-mid" />
                    <span className="rel-status-row-name">
                      {rel.sourceOrganization?.name ?? '—'} ↔ {rel.targetOrganization?.name ?? '—'}
                      <small> ({fa(rel.relationshipType)})</small>
                    </span>
                    <ChevronLeft size={14} style={{ color: 'var(--text-muted)' }} />
                  </Link>
                </>
              )}
              {a.status === 'DONE' || a.status === 'COMPLETED' ? (
                <div className="success-card" style={{ marginTop: 14 }}><CheckCircle2 size={14} /> این اقدام تکمیل شده — دیگر باز نیست.</div>
              ) : null}
            </section>

            {/* وابستگی‌ها */}
            <section className="panel">
              <div className="panel-title">
                <div><h2>وابسته به</h2><p>این اقدام برای پیشرفت به این‌ها نیاز دارد</p></div>
                <Badge>{fmtNum(deps.length)}</Badge>
              </div>
              <div className="inline-form" style={{ marginBottom: 10 }}>
                <select aria-label="افزودن وابستگی" className="toolbar-select" style={{ flex: 1, minWidth: 0 }} value={newDepId} onChange={e => setNewDepId(e.target.value)}>
                  <option value="">انتخاب اقدام باز…</option>
                  {depCandidates.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={!!busy || !newDepId} onClick={() => addDependency(newDepId)}>افزودن</button>
              </div>
              {deps.length ? (
                <div className="list">
                  {deps.map((d: any) => (
                    <div className="listRow" key={d.id}>
                      <Badge tone={d.status === 'DONE' || d.status === 'COMPLETED' ? 'success' : d.status === 'BLOCKED' ? 'danger' : 'warning'}>{fa(d.status)}</Badge>
                      <span style={{ flex: 1 }}>
                        <Link className="t-primary" href={`/actions/${d.id}`} style={{ fontSize: 12.5 }}>{d.title}</Link>
                        {d.dueAt ? <small>موعد: {fmtDateTime(d.dueAt)}</small> : null}
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeDependency(d.id)} disabled={!!busy}>حذف</button>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state"><Link2 size={18} /> وابستگی ثبت نشده — اقداماتِ لازم را از فهرست باز اضافه کنید.</p>}
            </section>
          </div>

          {/* منتظران این اقدام */}
          {blockedBy.length > 0 && (
            <section className="panel">
              <div className="panel-title"><div><h2>در انتظار این اقدام</h2><p>اقداماتی که تکمیلِ این اقدام، پیش‌نیازشان است</p></div><Badge>{fmtNum(blockedBy.length)}</Badge></div>
              <div className="list">
                {blockedBy.map((b: any) => (
                  <div className="listRow" key={b.id}>
                    <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{fa(b.status)}</Badge>
                    <span style={{ flex: 1 }}>
                      <Link className="t-primary" href={`/actions/${b.id}`} style={{ fontSize: 12.5 }}>{b.title}</Link>
                      {b.dueAt ? <small>موعد: {fmtDateTime(b.dueAt)}</small> : null}
                    </span>
                    <Link className="row-action" href={`/actions/${b.id}`} aria-label={`مشاهدهٔ ${b.title}`}><ChevronLeft size={16} /></Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* مودال تأیید حذف */}
      {confirmDel && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="حذف اقدام" onClick={e => { if (e.target === e.currentTarget) setConfirmDel(false); }}>
          <div className="modal-card">
            <div className="modal-head"><div><h2>حذف اقدام</h2><p>این اقدام برای همیشه حذف می‌شود. مطمئن هستید؟</p></div></div>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(false)} disabled={!!busy}>انصراف</button>
              <button className="danger-action" onClick={remove} disabled={!!busy}>{busy === 'del' ? 'در حال حذف…' : 'حذف برای همیشه'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
