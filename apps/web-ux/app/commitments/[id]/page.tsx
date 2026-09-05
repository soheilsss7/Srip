'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { Bell, CheckCircle2, ChevronLeft, Clock3, Handshake, RefreshCw, ShieldAlert, Trash2, User, Zap } from 'lucide-react';;

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const STATUS_OPTIONS = ['OPEN', 'OVERDUE', 'FULFILLED', 'CANCELLED'];
const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const OPEN_STATUSES = ['OPEN', 'OVERDUE'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  OPEN: 'warning', OVERDUE: 'danger', FULFILLED: 'success', CANCELLED: 'neutral',
};
const RISK_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger',
};
const DIRS: [string, string][] = [['OURS', 'ما به طرفِ مقابل'], ['THEIRS', 'طرفِ مقابل به ما']];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [one, ps] = await Promise.all([
        api<any>(`/commitments/${id}`),
        api<any>('/people').catch(() => []),
      ]);
      setC(one);
      setNotes(one?.notes ?? '');
      setPeople(arr(ps));
    } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function doIt(label: string, fn: () => Promise<any>, doneMsg = '') {
    setBusy(label); setError(''); setInfo('');
    try { await fn(); if (doneMsg) setInfo(doneMsg); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  function patch(body: any, doneMsg: string) {
    return doIt('patch', () => api(`/commitments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), doneMsg);
  }
  function remove() {
    return doIt('del', async () => { await api(`/commitments/${id}`, { method: 'DELETE' }); router.replace('/commitments'); }, '');
  }

  if (!c && !error) return <main className="feature-page"><PageHeader eyebrow="تعهد" title="تعهد" description="" actions={<></>} /><Loading /></main>;

  const late = !!c && ((c.status === 'OPEN' && c.dueAt && new Date(c.dueAt).getTime() < Date.now()) || c.status === 'OVERDUE');
  const open = !!c && OPEN_STATUSES.includes(c.status);
  const dirLabel = (c?.direction ?? 'OURS') === 'THEIRS'
    ? `${c?.organization?.name ?? 'طرف مقابل'} به ما`
    : `ما به ${c?.organization?.name ?? 'طرف مقابل'}`;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · تعهد"
        title={c?.description?.slice(0, 100) ?? 'تعهد'}
        description={c ? `${dirLabel} · ${c.status === 'FULFILLED' ? 'انجام‌شده' : late ? 'عقب‌افتاده' : c.status === 'CANCELLED' ? 'لغوشده' : 'در جریان'}` : ''}
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <Link className="secondary-action" href="/commitments"><ChevronLeft size={14} /> فهرست تعهدات</Link>
            <button className="secondary-action" onClick={load} disabled={!!busy}><RefreshCw size={14} /> بازخوانی</button>
            <button className="danger-action" disabled={!!busy} onClick={() => setConfirmDel(true)}><Trash2 size={14} /> حذف تعهد</button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {!c ? <Loading /> : (
        <>
          {/* وضعیت */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico">{c.status === 'FULFILLED' ? <CheckCircle2 size={17} /> : late ? <ShieldAlert size={17} /> : <Handshake size={17} />}</span>
              <div>
                <h2>وضعیت تعهد</h2>
                <p>{late
                  ? 'موعد این تعهد گذشته و هنوز انجام نشده — با مسئول یا طرف هماهنگ کنید.'
                  : c.status === 'FULFILLED'
                    ? 'این تعهد انجام و تأیید شده است.'
                    : c.status === 'CANCELLED'
                      ? 'این تعهد لغو شده و دیگر الزامی نیست.'
                      : 'این تعهد باز است و در جریانِ پیگیری.'}</p>
              </div>
              <Badge tone={late ? 'danger' : STATUS_TONE[c.status] ?? 'neutral'}>{late ? fa('OVERDUE') : fa(c.status)}</Badge>
            </div>
            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>وضعیت</span>
                <div className="rel-metric-value">
                  <select aria-label="تغییر وضعیت تعهد" className="toolbar-select" style={{ minHeight: 32 }}
                    value={c.status ?? 'OPEN'} disabled={!!busy}
                    onChange={e => patch({ status: e.target.value }, 'وضعیت به‌روزرسانی شد.')}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>ریسک</span>
                <div className="rel-metric-value">
                  <select aria-label="ریسک تعهد" className="toolbar-select" style={{ minHeight: 32 }}
                    value={c.risk ?? 'MEDIUM'} disabled={!!busy}
                    onChange={e => patch({ risk: e.target.value }, 'ریسک به‌روزرسانی شد.')}>
                    {RISK_OPTIONS.map(r => <option key={r} value={r}>{fa(r)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>موعد</span>
                <div className="rel-metric-value">
                  <b className={late ? 'h-crit' : c.dueAt ? '' : 'h-null'} style={{ fontSize: 13.5 }}>{c.dueAt ? fmtDateTime(c.dueAt) : 'ثبت نشده'}</b>
                </div>
                {late && <div className="rel-metric-note"><ShieldAlert size={11} style={{ verticalAlign: '-1px' }} /> عقب‌افتاده است</div>}
              </div>
              <div className="rel-metric">
                <span>مسئول اجرا</span>
                <div className="rel-metric-value">
                  {people.length ? (
                    <select aria-label="مسئول اجرای تعهد" className="toolbar-select" style={{ minHeight: 32, maxWidth: 190, fontSize: 12 }}
                      value={c.ownerId ?? ''} disabled={!!busy}
                      onChange={e => patch({ ownerId: e.target.value || undefined }, 'مسئول تعیین شد.')}>
                      <option value="">بدون مسئول</option>
                      {people.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                    </select>
                  ) : c.owner ? (
                    <Link href={`/people/${c.ownerId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--srip-accent-text)' }}>
                      <User size={14} /> {c.owner.name}
                    </Link>
                  ) : <b className="h-null" style={{ fontSize: 13 }}>بدون مسئول</b>}
                </div>
              </div>
              <div className="rel-metric">
                <span>یادآور</span>
                <div className="rel-metric-value"><b style={{ fontSize: 12.5 }} className={c.reminderAt ? '' : 'h-null'}>{c.reminderAt ? fmtDateTime(c.reminderAt) : 'تنظیم نشده'}</b></div>
                <div className="rel-metric-note"><Bell size={11} style={{ verticalAlign: '-1px' }} /> {c.reminderAt ? 'اعلان در این زمان' : 'بدون اعلان'}</div>
              </div>
            </div>
            <div className="rel-status-actions">
              {open && (
                <button className="btn btn-primary btn-sm" disabled={!!busy}
                  onClick={() => patch({ status: 'FULFILLED' }, 'انجام این تعهد ثبت شد.')}>
                  <CheckCircle2 size={14} /> ثبت به‌عنوان انجام‌شده
                </button>
              )}
              {c.status === 'OPEN' && late && (
                <button className="btn btn-secondary btn-sm" disabled={!!busy}
                  onClick={() => doIt('markover', () => api(`/commitments/${id}/mark-overdue`, { method: 'POST' }), 'وضعیت «عقب‌افتاده» اعلام شد.')}>
                  <ShieldAlert size={14} /> ثبت به‌عنوان عقب‌افتاده
                </button>
              )}
              {!open && (
                <button className="btn btn-secondary btn-sm" disabled={!!busy}
                  onClick={() => patch({ status: 'OPEN' }, 'تعهد دوباره باز شد.')}>
                  <Zap size={14} /> بازگشایی تعهد
                </button>
              )}
            </div>
          </section>

          <div className="split-panels">
            {/* جزئیات */}
            <section className="panel">
              <div className="panel-title"><div><h2>جزئیات تعهد</h2><p>طرف‌ها، بستر و زمان‌بندی</p></div></div>
              <div className="detail-grid">
                <div className="detail-item">
                  <small>جهت تعهد</small>
                  <select aria-label="جهت تعهد" className="toolbar-select" style={{ minHeight: 30, maxWidth: 200 }}
                    value={c.direction ?? 'OURS'} disabled={!!busy}
                    onChange={e => patch({ direction: e.target.value }, 'جهت تعهد تغییر کرد.')}>
                    {DIRS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="detail-item">
                  <small>سازمان طرف</small>
                  {c.organization ? <Link className="t-primary" href={`/organizations/${c.organizationId}`}>{c.organization.name}</Link> : <strong className="h-null">—</strong>}
                </div>
                <div className="detail-item">
                  <small>مسئول اجرا</small>
                  {c.owner ? <Link className="t-primary" href={`/people/${c.ownerId}`}>{c.owner.name}</Link> : <strong className="h-null">—</strong>}
                </div>
                <div className="detail-item">
                  <small>شخص طرفِ مقابل</small>
                  {c.person ? <Link className="t-primary" href={`/people/${c.personId}`}>{c.person.name}{c.person.title ? ` — ${c.person.title}` : ''}</Link> : <strong className="h-null">—</strong>}
                </div>
                {c.relationship && (
                  <div className="detail-item">
                    <small>رابطهٔ مرتبط</small>
                    <Link className="t-primary" href={`/relationships/${c.relationship.id}`}>
                      {c.relationship.sourceOrganization?.name ?? '—'} ↔ {c.relationship.targetOrganization?.name ?? '—'} ({fa(c.relationship.relationshipType)})
                    </Link>
                  </div>
                )}
                {c.meeting && (
                  <div className="detail-item">
                    <small>جلسهٔ مبدأ</small>
                    <Link className="t-primary" href={`/meetings/${c.meeting.id}`}>{c.meeting.title}</Link>
                  </div>
                )}
                {c.project && (
                  <div className="detail-item">
                    <small>پروژهٔ مرتبط</small>
                    <Link className="t-primary" href={`/projects/${c.project.id}`}>{c.project.name}</Link>
                  </div>
                )}
                <div className="detail-item">
                  <small>زمان ایجاد</small>
                  <strong>{c.createdAt ? fmtDateTime(c.createdAt) : '—'}</strong>
                </div>
                <div className="detail-item">
                  <small>زمان انجام</small>
                  <strong>{c.fulfilledAt ? fmtDateTime(c.fulfilledAt) : '—'}</strong>
                </div>
                <div className="detail-item">
                  <small>ریسک تعهد</small>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Badge tone={RISK_TONE[c.risk ?? ''] ?? 'neutral'}>{fa(c.risk ?? '—')}</Badge></span>
                </div>
                <div className="detail-item">
                  <small>یادآور</small>
                  <strong>{c.reminderAt ? fmtDateTime(c.reminderAt) : '—'}</strong>
                </div>
              </div>
              {c.status === 'FULFILLED' ? (
                <div className="success-card" style={{ marginTop: 14 }}><CheckCircle2 size={14} /> این تعهد انجام شده و دیگر باز نیست.</div>
              ) : c.status === 'CANCELLED' ? (
                <div className="info-card" style={{ marginTop: 14 }}><Clock3 size={14} /> این تعهد لغو شده است.</div>
              ) : null}
            </section>

            {/* توضیحات */}
            <section className="panel">
              <div className="panel-title"><div><h2>توضیح تکمیلی</h2><p>شرایط، جزئیات و منبع قول</p></div></div>
              <textarea className="full-note" aria-label="توضیح تکمیلی تعهد" value={notes} rows={7}
                onChange={e => setNotes(e.target.value)} placeholder="شرح کاملی از شرایط تعهد بنویسید…" />
              <button className="primary-action" style={{ marginTop: 10 }} disabled={!!busy || notes === (c.notes ?? '')}
                onClick={() => patch({ notes }, 'توضیحات ذخیره شد.')}>
                ذخیره توضیحات
              </button>
              {c.notes && <p className="t-muted" style={{ fontSize: 11, marginTop: 8 }}>آخرین ذخیره: {fmtDateTime(c.updatedAt ?? c.createdAt)}</p>}
            </section>
          </div>
        </>
      )}

      {/* مودال تأیید حذف */}
      {confirmDel && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="حذف تعهد" onClick={e => { if (e.target === e.currentTarget) setConfirmDel(false); }}>
          <div className="modal-card">
            <div className="modal-head"><div><h2>حذف تعهد</h2><p>این تعهد برای همیشه حذف می‌شود. مطمئن هستید؟</p></div></div>
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
