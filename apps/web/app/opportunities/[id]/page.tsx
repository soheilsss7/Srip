'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { Award, CalendarClock, CheckCircle2, ChevronLeft, Coins, Handshake, RefreshCw, Save, ShieldX, Target, Trash2, TrendingUp, User, XCircle } from 'lucide-react';;

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: any): string => v == null || v === '' || Number.isNaN(v) ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtMoney = (v: any): string => {
  if (v == null || Number.isNaN(v)) return '—';
  const b = v / 1e9;
  if (b >= 1) return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(b)} میلیارد تومان`;
  const m = v / 1e6;
  if (m >= 1) return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(m)} میلیون تومان`;
  return `${fmtNum(v)} تومان`;
};
const fmtDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const STATUS_OPTIONS = ['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON', 'LOST'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  IDENTIFIED: 'neutral', QUALIFYING: 'info', ACTIVE: 'warning', WON: 'success', LOST: 'danger',
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [o, setO] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [valForm, setValForm] = useState({ valueB: '', probability: '' });

  const load = useCallback(async () => {
    setError('');
    try {
      const [one, ps] = await Promise.all([
        api<any>(`/opportunities/${id}`),
        api<any>('/people').catch(() => []),
      ]);
      setO(one);
      setPeople(arr(ps));
      if (one) {
        const b = (one.value ?? 0) / 1e9;
        setValForm({ valueB: b > 0 ? String(b) : '', probability: one.probability != null ? String(one.probability) : '' });
      }
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
    return doIt('patch', () => api(`/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), doneMsg);
  }
  function saveValuation(e: React.FormEvent) {
    e.preventDefault();
    const b = Number(valForm.valueB);
    const prob = Number(valForm.probability);
    const body: any = {};
    if (Number.isFinite(b) && b > 0) body.value = Math.round(b * 1e9);
    if (Number.isFinite(prob)) body.probability = prob;
    return patch(body, 'ارزش و احتمال به‌روزرسانی شد.');
  }
  function remove() {
    return doIt('del', async () => { await api(`/opportunities/${id}`, { method: 'DELETE' }); router.replace('/opportunities'); }, '');
  }

  if (!o && !error) return <main className="feature-page"><PageHeader eyebrow="فرصت" title="فرصت" description="" actions={<></>} /><Loading /></main>;

  const open = !['WON', 'LOST'].includes(o?.status);
  const probability = o?.probability ?? 0;
  const expectedValue = o?.expectedValue ?? 0;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · فرصت"
        title={o?.name ?? 'فرصت'}
        description={o?.description || 'بدون توضیح ثبت‌شده'}
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <Link className="secondary-action" href="/opportunities"><ChevronLeft size={14} /> فهرست فرصت‌ها</Link>
            <button className="secondary-action" onClick={load} disabled={!!busy}><RefreshCw size={14} /> بازخوانی</button>
            <button className="danger-action" disabled={!!busy} onClick={() => setConfirmDel(true)}><Trash2 size={14} /> حذف فرصت</button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {!o ? <Loading /> : (
        <>
          {/* وضعیت */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico">{o.status === 'WON' ? <Award size={17} /> : o.status === 'LOST' ? <ShieldX size={17} /> : <Target size={17} />}</span>
              <div>
                <h2>وضعیت فرصت</h2>
                <p>{o.status === 'WON' ? 'این فرصت برنده شده و به قرارداد تبدیل شده است.' : o.status === 'LOST' ? 'این فرصت از دست رفته است.' : o.status === 'ACTIVE' ? 'فرصت در مرحلهٔ مذاکره و فعال‌سازی است.' : o.status === 'QUALIFYING' ? 'فرصت در حال ارزیابی و شایستگی‌سنجی است.' : 'فرصت تازه شناسایی شده و نیاز به بررسی دارد.'}</p>
              </div>
              <Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>{fa(o.status)}</Badge>
            </div>
            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>مرحله</span>
                <div className="rel-metric-value">
                  <select aria-label="تغییر مرحلهٔ فرصت" className="toolbar-select" style={{ minHeight: 32 }}
                    value={o.status} disabled={!!busy}
                    onChange={e => patch({ status: e.target.value }, 'مرحله به‌روزرسانی شد.')}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="rel-metric">
                <span>ارزش کل</span>
                <div className="rel-metric-value"><b style={{ fontSize: 15 }}>{fmtMoney(o.value)}</b></div>
                <div className="rel-metric-note"><Coins size={11} style={{ verticalAlign: '-1px' }} /> مبلغ قراردادِ هدف</div>
              </div>
              <div className="rel-metric">
                <span>احتمال و ارزش موزون</span>
                <div className="rel-metric-value" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, width: '100%' }}>
                  <div className="prog-line">
                    <div className="prog-bar"><div className={`prog-fill ${probability >= 70 ? '' : probability >= 40 ? 'warn' : 'crit'}`} style={{ width: `${probability}%` }} /></div>
                    <span className="prog-num">{fmtNum(probability)}٪</span>
                  </div>
                </div>
                <div className="rel-metric-note">ارزش موزون: <b>{fmtMoney(expectedValue)}</b></div>
              </div>
              <div className="rel-metric">
                <span>مالک پیگیری</span>
                <div className="rel-metric-value">
                  {people.length ? (
                    <select aria-label="مالک پیگیری فرصت" className="toolbar-select" style={{ minHeight: 32, maxWidth: 170, fontSize: 12 }}
                      value={o.ownerId ?? ''} disabled={!!busy}
                      onChange={e => patch({ ownerId: e.target.value || undefined }, 'مالک تعیین شد.')}>
                      <option value="">بدون مالک</option>
                      {people.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                    </select>
                  ) : o.owner ? (
                    <Link href={`/people/${o.ownerId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--srip-accent-text)' }}>
                      <User size={14} /> {o.owner.name}
                    </Link>
                  ) : <b className="h-null" style={{ fontSize: 13 }}>بدون مالک</b>}
                </div>
              </div>
              <div className="rel-metric">
                <span>موعد بستن</span>
                <div className="rel-metric-value"><b className={o.expectedDate && open && new Date(o.expectedDate).getTime() < Date.now() ? 'h-crit' : o.expectedDate ? '' : 'h-null'} style={{ fontSize: 12.5 }}>{o.expectedDate ? fmtDate(o.expectedDate) : 'ثبت نشده'}</b></div>
                {o.expectedDate && open && new Date(o.expectedDate).getTime() < Date.now() && <div className="rel-metric-note" style={{ color: 'var(--srip-danger)' }}>از موعد گذشته است</div>}
              </div>
            </div>
            <div className="rel-status-actions">
              {open && (
                <>
                  <button className="btn btn-primary btn-sm" disabled={!!busy}
                    onClick={() => patch({ status: 'WON' }, 'برد این فرصت ثبت شد.')}>
                    <CheckCircle2 size={14} /> ثبت به‌عنوان برنده‌شده
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!!busy}
                    onClick={() => patch({ status: 'LOST' }, 'از دست رفتن فرصت ثبت شد.')}>
                    <XCircle size={14} /> ثبت به‌عنوان ازدست‌رفته
                  </button>
                </>
              )}
              {!open && (
                <button className="btn btn-secondary btn-sm" disabled={!!busy}
                  onClick={() => patch({ status: 'ACTIVE' }, 'فرصت دوباره باز شد.')}>
                  <RefreshCw size={14} /> بازگشایی فرصت
                </button>
              )}
            </div>
          </section>

          <div className="split-panels">
            {/* جزئیات */}
            <section className="panel">
              <div className="panel-title"><div><h2>جزئیات فرصت</h2><p>بستر و زمان‌بندی</p></div></div>
              <div className="detail-grid">
                <div className="detail-item">
                  <small>سازمانِ طرف</small>
                  {o.organization ? <Link className="t-primary" href={`/organizations/${o.organizationId}`}>{o.organization.name}</Link> : <strong className="h-null">—</strong>}
                </div>
                <div className="detail-item">
                  <small>مالک پیگیری</small>
                  {o.owner ? <Link className="t-primary" href={`/people/${o.ownerId}`}>{o.owner.name}</Link> : <strong className="h-null">—</strong>}
                </div>
                {o.relationship && (
                  <div className="detail-item">
                    <small>رابطهٔ مرتبط</small>
                    <Link className="t-primary" href={`/relationships/${o.relationship.id}`}>
                      {o.relationship.sourceOrganization?.name ?? '—'} ↔ {o.relationship.targetOrganization?.name ?? '—'} ({fa(o.relationship.relationshipType)})
                    </Link>
                  </div>
                )}
                {o.project && (
                  <div className="detail-item">
                    <small>پروژهٔ مرتبط</small>
                    <Link className="t-primary" href={`/projects/${o.project.id}`}>{o.project.name}</Link>
                  </div>
                )}
                <div className="detail-item"><small>ارزش کل</small><strong>{fmtMoney(o.value)}</strong></div>
                <div className="detail-item"><small>احتمال</small><strong>{fmtNum(o.probability)}٪</strong></div>
                <div className="detail-item"><small>ارزش موزون</small><strong>{fmtMoney(expectedValue)}</strong></div>
                <div className="detail-item"><small>موعد بستن</small><strong>{o.expectedDate ? fmtDate(o.expectedDate) : '—'}</strong></div>
                <div className="detail-item"><small>زمان شناسایی</small><strong>{o.createdAt ? fmtDateTime(o.createdAt) : '—'}</strong></div>
                <div className="detail-item"><small>زمان برد/باخت</small><strong>{o.wonAt ? fmtDateTime(o.wonAt) : o.lostAt ? fmtDateTime(o.lostAt) : '—'}</strong></div>
              </div>
              {o.status === 'WON' ? (
                <div className="success-card" style={{ marginTop: 14 }}><Award size={14} /> این فرصت برنده شده — احتمال آن ۱۰۰٪ ثبت شده است.</div>
              ) : o.status === 'LOST' ? (
                <div className="error-card" style={{ marginTop: 14 }}><XCircle size={14} /> این فرصت از دست رفته — احتمال آن صفر ثبت شده است.</div>
              ) : null}
            </section>

            {/* ارزش‌گذاری */}
            <section className="panel">
              <div className="panel-title"><div><h2>ارزش‌گذاری</h2><p>ارزش موزون = ارزش کل × احتمال</p></div><Badge>{fmtNum(probability)}٪</Badge></div>
              <form className="entity-form org-form" onSubmit={saveValuation}>
                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="ov-value">ارزش (میلیارد تومان)</label>
                    <input id="ov-value" type="number" min={0} step="0.1" value={valForm.valueB}
                      onChange={e => setValForm(f => ({ ...f, valueB: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="ov-prob">احتمال (درصد)</label>
                    <input id="ov-prob" type="number" min={0} max={100} value={valForm.probability}
                      onChange={e => setValForm(f => ({ ...f, probability: e.target.value }))} />
                  </div>
                </div>
                <button className="primary-action" style={{ marginTop: 8 }} type="submit" disabled={!!busy}><Save size={14} /> ذخیرهٔ ارزش‌گذاری</button>
              </form>
              <div className="detail-grid" style={{ marginTop: 14 }}>
                <div className="detail-item"><small>پیش‌بینیِ وزنی</small><strong style={{ color: 'var(--srip-accent-text)' }}>{fmtMoney(expectedValue)}</strong></div>
                <div className="detail-item"><small>درصد پیشرفت تا برد</small><strong>{fmtNum(probability)}٪</strong></div>
              </div>
              <div className="info-card" style={{ marginTop: 12 }}><TrendingUp size={14} /> با تغییر مرحله به «برنده‌شده» احتمال خودکار ۱۰۰٪ و با «ازدست‌رفته» صفر می‌شود.</div>
            </section>
          </div>

          {/* زمینه */}
          <section className="panel">
            <div className="panel-title"><div><h2>زمینهٔ فرصت</h2><p>پیوندهای مرتبط با این فرصت</p></div><Handshake size={16} style={{ color: 'var(--text-muted)' }} /></div>
            <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="detail-item">
                <small>رابطه</small>
                {o.relationship
                  ? <Link className="t-primary" href={`/relationships/${o.relationship.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Handshake size={13} /> {o.relationship.sourceOrganization?.name ?? '—'} ↔ {o.relationship.targetOrganization?.name ?? '—'}</Link>
                  : <strong className="h-null">—</strong>}
              </div>
              <div className="detail-item">
                <small>پروژه</small>
                {o.project
                  ? <Link className="t-primary" href={`/projects/${o.project.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Target size={13} /> {o.project.name}</Link>
                  : <strong className="h-null">—</strong>}
              </div>
              <div className="detail-item">
                <small>سازمانِ طرف</small>
                {o.organization ? <Link className="t-primary" href={`/organizations/${o.organizationId}`}>{o.organization.name}</Link> : <strong className="h-null">—</strong>}
              </div>
              <div className="detail-item">
                <small>مالک</small>
                {o.owner ? <Link className="t-primary" href={`/people/${o.ownerId}`}>{o.owner.name}</Link> : <strong className="h-null">—</strong>}
              </div>
            </div>
            <p className="t-muted" style={{ fontSize: 11, marginTop: 12 }}><CalendarClock size={11} style={{ verticalAlign: '-1px' }} /> فرصت در {o.createdAt ? fmtDateTime(o.createdAt) : '—'} شناسایی شد{o.expectedDate ? ` و بستن آن برای ${fmtDate(o.expectedDate)} پیش‌بینی شده` : ''}.</p>
          </section>
        </>
      )}

      {/* مودال تأیید حذف */}
      {confirmDel && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="حذف فرصت" onClick={e => { if (e.target === e.currentTarget) setConfirmDel(false); }}>
          <div className="modal-card">
            <div className="modal-head"><div><h2>حذف فرصت</h2><p>این فرصت برای همیشه حذف می‌شود. مطمئن هستید؟</p></div></div>
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
