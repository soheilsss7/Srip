'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader } from '../../_components/page-ui';
import { Clock, UserPlus, Zap, ShieldCheck, Sparkles, FileText, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: any): string => v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  UPCOMING: 'info', COMPLETED: 'success', OVERDUE: 'danger', SCHEDULED: 'info',
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [m, setM] = useState<any>(null);
  const [minutes, setMinutes] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [prompt, setPrompt] = useState<null | 'outcome' | 'participant'>(null);
  const [outForm, setOutForm] = useState({ outcome: '', notes: '', decisionsText: '', transcript: '' });
  const [newParticipant, setNewParticipant] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [finalized, setFinalized] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const mt: any = await api(`/meetings/${id}`);
      setM(mt);
      setFinalized(!!mt.isFinalized);
    } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  /* اشخاص (برای افزودن شرکت‌کننده) و روابط (برای نام رابطه) */
  useEffect(() => {
    Promise.all([
      api<any>('/people').catch(() => []),
      api<any>('/relationships').catch(() => []),
    ]).then(([p, r]) => { setPeople(arr(p)); setRels(arr(r)); });
  }, []);

  async function refreshMinutes() {
    setError(''); setInfo('');
    try { setMinutes(await api(`/meetings/${id}/minutes`)); }
    catch (e) { setError((e as Error).message); }
  }
  async function act(label: string, fn: () => Promise<any>, doneMsg = '') {
    setBusy(label); setError(''); setInfo('');
    try { await fn(); if (doneMsg) setInfo(doneMsg); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  async function submitOutcome(e: React.FormEvent) {
    e.preventDefault();
    const decisions = outForm.decisionsText.split('\n').map(x => x.trim()).filter(Boolean);
    await act('outcome', async () => {
      await api(`/meetings/${id}/outcome`, { method: 'POST', body: JSON.stringify({
        outcome: outForm.outcome, notes: outForm.notes, decisions, transcript: outForm.transcript,
      }) });
    }, 'نتیجهٔ جلسه ثبت شد.');
    setPrompt(null); setOutForm({ outcome: '', notes: '', decisionsText: '', transcript: '' });
    setMinutes(null);
    await Promise.all([load(), refreshMinutes()]);
  }

  async function addParticipant() {
    if (!newParticipant) return;
    const ids = [...(m?.participants ?? []).map((p: any) => p.person.id), newParticipant].filter(Boolean);
    await act('participant', async () => {
      await api(`/meetings/${id}/participants`, { method: 'PUT', body: JSON.stringify({ personIds: ids }) });
    }, 'شرکت‌کننده افزوده شد.');
    setNewParticipant('');
    setPrompt(null);
    await load();
  }

  async function extract() {
    await act('extract', async () => {
      const x: any = await api(`/meetings/${id}/action-items/extract`, { method: 'POST', body: '{}' });
      setCandidates(x.candidates ?? []);
      setChecked({});
      if (!(x.candidates ?? []).length) setInfo('اقدام پیشنهادی‌ای یافت نشد.');
    });
  }

  async function applySelected() {
    const items = (candidates ?? [])
      .filter((_, i) => checked[i])
      .map((c: any) => ({
        title: c.suggestedTitle, dueAt: c.suggestedDueAt, asCommitment: c.isCommitmentLike,
        priority: 'MEDIUM', description: c.text,
      }));
    if (!items.length) return;
    await act('apply', async () => {
      await api(`/meetings/${id}/action-items/apply`, { method: 'POST', body: JSON.stringify({ items }) });
    }, `${fmtNum(items.length)} اقدام از این جلسه ثبت شد.`);
    setCandidates([]); setChecked({}); setMinutes(null);
    await Promise.all([load(), refreshMinutes()]);
  }

  async function finalize() {
    await act('finalize', async () => {
      await api(`/meetings/${id}/finalize`, { method: 'POST', body: '{}' });
    }, 'صورتجلسه نهایی شد.');
    setFinalized(true);
    await refreshMinutes();
  }

  const personName = (p: any) => `${p.person?.firstName ?? ''} ${p.person?.lastName ?? ''}`.trim() || (p.person?.id ?? '—');
  const rel = rels.find((r: any) => r.id === m?.relationshipId);
  const decisionItems: string[] = useMemo(() => {
    const d = m?.decisions;
    if (!d) return [];
    if (Array.isArray(d)) return d.map(String);
    return [];
  }, [m?.decisions]);

  if (!m && !error) return <main className="feature-page"><PageHeader eyebrow="جلسه" title="جلسه" description="" actions={<></>} /><Loading /></main>;

  const st = m?.status;
  const pending = st === 'UPCOMING' || st === 'SCHEDULED';
  const actionItems = m?.actions ?? [];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری جلسات · جزئیات"
        title={m?.title ?? 'جلسه'}
        description={m ? `${fmtDateTime(m.startAt)}${m.organization?.name ? ` · ${m.organization.name}` : ''}` : ''}
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button>
            <button className="secondary-action" onClick={refreshMinutes} disabled={!!busy}><FileText size={14}/> صورت‌جلسه</button>
            {st === 'COMPLETED' || m?.outcome ? null : (
              <button className="primary-action" onClick={() => setPrompt('outcome')} disabled={!!busy}><CheckCircle2 size={14}/> ثبت نتیجه</button>
            )}
            <button className="primary-action" onClick={extract} disabled={!!busy}><Sparkles size={14}/> استخراج اقدامات</button>
            {pending && <button className="primary-action" onClick={() => setPrompt('participant')} disabled={!!busy}><UserPlus size={14}/> افزودن شرکت‌کننده</button>}
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {!m ? <Loading /> : (
        <>
          {/* نوار وضعیت */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico">{st === 'COMPLETED' ? <CheckCircle2 size={17} /> : pending ? <Clock size={17} /> : <AlertTriangle size={17} />}</span>
              <div>
                <h2>وضعیت جلسه</h2>
                <p>{pending ? 'این جلسه هنوز برگزار نشده — برنامه‌ریزی و آمادگی.' : st === 'COMPLETED' ? 'جلسه برگزار شده و نتیجهٔ آن ثبت شده است.' : 'زمان جلسه گذشته ولی نتیجه‌ای ثبت نشده — نتیجه را بنویسید.'}</p>
              </div>
              <Badge tone={STATUS_TONE[st ?? ''] ?? 'neutral'}>{fa(st ?? '—')}</Badge>
            </div>
            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>شروع</span>
                <div className="rel-metric-value"><b>{m.startAt ? fmtNum(new Date(m.startAt).getDate()) : '—'}</b><small>{m.startAt ? new Date(m.startAt).toLocaleDateString('fa-IR', { month: 'short' }) : ''}</small></div>
                <div className="rel-metric-note">{fmtDateTime(m.startAt)}</div>
              </div>
              <div className="rel-metric">
                <span>شرکت‌کنندگان</span>
                <div className="rel-metric-value"><b>{fmtNum(m.participants?.length ?? 0)}</b><small>نفر</small></div>
                <div className="rel-metric-note">{(m.participants ?? []).slice(0, 3).map(personName).join('، ') || '—'}</div>
              </div>
              <div className="rel-metric">
                <span>اقدامات پیوندی</span>
                <div className="rel-metric-value"><b>{fmtNum(actionItems.length)}</b><small>مورد</small></div>
                <div className="rel-metric-note">{fmtNum((m.commitments ?? []).length)} تعهد نیز ثبت شده</div>
              </div>
              <div className="rel-metric">
                <span>سازمان مرتبط</span>
                <div className="rel-metric-value"><b style={{ fontSize: 13 }}>{m.organization?.name ?? '—'}</b></div>
                <div className="rel-metric-note">{rel ? `${rel.sourceOrganization?.name ?? ''} ↔ ${rel.targetOrganization?.name ?? ''}` : m.relationshipId ? 'رابطه ثبت شده' : ''}</div>
              </div>
              <div className="rel-metric">
                <span>نتیجه</span>
                <div className="rel-metric-value">
                  <b style={{ fontSize: 13 }}>{m.outcome ? 'ثبت شده' : '—'}</b>
                </div>
                {m.outcome && <div className="rel-metric-note">{m.outcome.slice(0, 60)}{m.outcome.length > 60 ? '…' : ''}</div>}
              </div>
            </div>
          </section>

          <div className="split-panels">
            {/* جزئیات */}
            <section className="panel">
              <div className="panel-title"><div><h2>جزئیات جلسه</h2><p>هدف، دستور کار و پیوندها</p></div></div>
              <div className="detail-grid">
                {[
                  ['شروع', m.startAt ? fmtDateTime(m.startAt) : null],
                  ['پایان', m.endAt ? fmtDateTime(m.endAt) : null],
                  ['هدف', m.objective || null],
                  ['مکان', m.location || null],
                  ['بریف پیش از جلسه', m.preMeetingBrief || null],
                ].filter(([, v]) => v != null).map(([k, v]) => (
                  <div className="detail-item" key={String(k)} style={k === 'هدف' || k === 'بریف پیش از جلسه' ? { gridColumn: '1/-1' } : {}}>
                    <small>{k}</small><strong>{String(v)}</strong>
                  </div>
                ))}
              </div>
              {m.agenda && (
                <>
                  <div className="panel-title" style={{ marginTop: 18 }}><div><h2>دستور کار</h2></div></div>
                  <div className="mini-table">
                    {m.agenda.split('\n').filter(Boolean).map((line: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 8, background: 'var(--srip-accent-soft)', color: 'var(--srip-accent-text)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11, flex: 'none' }}>{fmtNum(i + 1)}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.9 }}>{line}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="rel-status-list" style={{ marginTop: 14 }}>
                {m.organization && (
                  <Link className="rel-status-row" href={`/organizations/${m.organization.id}`}>
                    <span className="health-dot h-mid" />
                    <span className="rel-status-row-name">{m.organization.name} <small>(سازمان)</small></span>
                    <ChevronLeftIcon />
                  </Link>
                )}
                {rel && (
                  <Link className="rel-status-row" href={`/relationships/${rel.id}`}>
                    <span className="health-dot h-hi" />
                    <span className="rel-status-row-name">{rel.sourceOrganization?.name ?? ''} ↔ {rel.targetOrganization?.name ?? ''} <small>(رابطه · {fa(rel.relationshipType)})</small></span>
                    <ChevronLeftIcon />
                  </Link>
                )}
              </div>
            </section>

            {/* شرکت‌کنندگان */}
            <section className="panel">
              <div className="panel-title">
                <div><h2>شرکت‌کنندگان</h2><Badge>{fmtNum(m.participants?.length ?? 0)}</Badge></div>
                {pending && <button className="secondary-action" onClick={() => setPrompt('participant')}><UserPlus size={14}/> افزودن</button>}
              </div>
              {(m.participants ?? []).length ? (
                <div className="list">
                  {(m.participants ?? []).map((p: any, i: number) => (
                    <div className="listRow" key={p.person?.id ?? i}>
                      <span className="avatar avatar-sm">{`${(p.person?.firstName?.[0] ?? '')}${(p.person?.lastName?.[0] ?? '')}`}</span>
                      <span style={{ flex: 1 }}>
                        <strong>{personName(p)}</strong>
                        {p.person?.title ? <small>{p.person.title}</small> : null}
                      </span>
                      {p.person?.id && <Link className="row-action" href={`/people/${p.person.id}`} aria-label={`مشاهدهٔ ${personName(p)}`}>مشاهده</Link>}
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">شرکت‌کننده‌ای ثبت نشده است.</p>}
              {decisionItems.length > 0 && (
                <>
                  <div className="panel-title" style={{ marginTop: 18 }}><div><h2>تصمیم‌های جلسه</h2><Badge>{fmtNum(decisionItems.length)}</Badge></div></div>
                  <div className="mini-table">
                    {decisionItems.map((d, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--card-border)', fontSize: 12.5 }}>
                        <CheckCircle2 size={14} style={{ color: 'var(--srip-success)', flex: 'none', marginTop: 2 }} />
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="split-panels">
            {/* اقدامات */}
            <section className="panel">
              <div className="panel-title"><div><h2>اقدامات این جلسه</h2><Badge>{fmtNum(actionItems.length)}</Badge></div>
                <button className="secondary-action" onClick={extract} disabled={!!busy}><Sparkles size={14}/> استخراج خودکار</button>
              </div>
              {actionItems.length ? (
                <div className="list">
                  {actionItems.map((a: any, i: number) => (
                    <div className="listRow" key={a.id ?? i}>
                      <span><Badge tone={a.status === 'DONE' || a.status === 'COMPLETED' ? 'success' : a.status === 'OVERDUE' ? 'danger' : 'warning'}>{fa(a.status ?? 'OPEN')}</Badge></span>
                      <span style={{ flex: 1 }}><strong>{a.title}</strong>{a.dueAt ? <small>موعد: {fmtDate(a.dueAt)}</small> : null}</span>
                      {a.id?.startsWith('a-') && <Link className="row-action" href={`/actions/${a.id}`}>مشاهده</Link>}
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state"><Zap size={18}/> اقدام مرتبطی نیست — از «استخراج خودکار» استفاده کنید تا از متن جلسه اقدام بسازد.</p>}
            </section>

            {/* صورت‌جلسه */}
            <section className="panel">
              <div className="panel-title">
                <div><h2>صورت‌جلسه</h2>{finalized && <Badge tone="success">نهایی شده</Badge>}</div>
                <div className="table-toolbar">
                  <button className="secondary-action" onClick={refreshMinutes} disabled={!!busy}><FileText size={14}/> نمایش</button>
                  {minutes?.isFinalized === false && !finalized && <button className="primary-action" onClick={finalize} disabled={!!busy}><RotateCcw size={14}/> نهایی‌سازی</button>}
                </div>
              </div>
              {!minutes ? (
                <p className="empty-state">هنوز نمایش داده نشده — دکمهٔ «نمایش» را بزنید یا نتیجهٔ جلسه را ثبت کنید.</p>
              ) : (
                <div className="detail-grid">
                  {[
                    ['نتیجه', minutes.outcome || null],
                    ['یادداشت‌ها', minutes.notes || null],
                    ['تاریخ تولید', minutes.generatedAt ? fmtDateTime(minutes.generatedAt) : null],
                  ].filter(([, v]) => v != null && v !== '—' && v !== null).map(([k, v]) => (
                    <div className="detail-item" key={String(k)} style={{ gridColumn: '1/-1' }}><small>{String(k)}</small><strong style={{ whiteSpace: 'pre-line', lineHeight: 1.9 }}>{String(v)}</strong></div>
                  ))}
                  {minutes.isFinalized && <div className="detail-item" style={{ gridColumn: '1/-1' }}><small>وضعیت</small><Badge tone="success">صورتجلسه نهایی و معتبر است</Badge></div>}
                </div>
              )}
            </section>
          </div>

          {/* کاندیداهای استخراج */}
          {candidates.length > 0 && (
            <section className="panel">
              <div className="panel-title">
                <div><h2>اقدامات پیشنهادی ({fmtNum(candidates.length)})</h2><p>استخراج قطعی از متن جلسه — فقط با تأیید شما ثبت می‌شوند.</p></div>
                <button className="primary-action" onClick={applySelected} disabled={!!busy || !Object.values(checked).some(Boolean)}>ثبت انتخاب‌شده‌ها</button>
              </div>
              <div className="list">
                {candidates.map((c: any, i: number) => (
                  <label className="listRow" key={i} style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!checked[i]} onChange={e => setChecked({ ...checked, [i]: e.target.checked })} />
                    <span className="stat-ico ic-purple" style={{ width: 30, height: 30, borderRadius: 9, flex: 'none' }}>{c.isCommitmentLike ? <ShieldCheck size={14} /> : <Zap size={14} />}</span>
                    <span style={{ flex: 1 }}>
                      <strong>{c.suggestedTitle}</strong>
                      <small>{c.text} · سررسید پیشنهادی {c.suggestedDueAt ? fmtDate(c.suggestedDueAt) : '—'} · {c.isCommitmentLike ? 'تعهد' : 'اقدام'}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* مودال ثبت نتیجه */}
      <Modal open={prompt === 'outcome'} title="ثبت نتیجهٔ جلسه" description="نتیجهٔ کلی، یادداشت‌ها و تصمیم‌ها را ثبت کنید؛ جلسه «تکمیل‌شده» می‌شود و اعلان ثبت می‌گردد." onClose={() => setPrompt(null)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setPrompt(null)}>انصراف</button>
          <button type="submit" form="mt-outcome-form" className="btn btn-primary" disabled={!!busy || !outForm.outcome.trim()}>{busy === 'outcome' ? 'در حال ذخیره…' : 'تکمیل و ثبت'}</button>
        </>}>
        <form id="mt-outcome-form" className="entity-form org-form" onSubmit={submitOutcome}>
          <div className="form-section-head"><h3>نتیجه و تصمیم‌ها</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="mt-outcome">نتیجهٔ کلی <span className="req">*</span></label>
              <textarea id="mt-outcome" required value={outForm.outcome} onChange={e => setOutForm({ ...outForm, outcome: e.target.value })} placeholder="مثلاً: توافق شد تحویل فاز دوم ۱۰ روز زودتر انجام شود." />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="mt-decisions">تصمیم‌های جلسه</label>
              <textarea id="mt-decisions" value={outForm.decisionsText} onChange={e => setOutForm({ ...outForm, decisionsText: e.target.value })} placeholder="هر تصمیم در یک خط…" />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="mt-notes">یادداشت‌های تکمیلی</label>
              <textarea id="mt-notes" value={outForm.notes} onChange={e => setOutForm({ ...outForm, notes: e.target.value })} placeholder="یادداشت‌های جلسه…" />
            </div>
          </div>
        </form>
      </Modal>

      {/* مودال افزودن شرکت‌کننده */}
      <Modal open={prompt === 'participant'} title="افزودن شرکت‌کننده" description="شخص را از فهرست محدودهٔ خود انتخاب کنید تا به این جلسه اضافه شود." onClose={() => setPrompt(null)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setPrompt(null)}>انصراف</button>
          <button type="button" className="btn btn-primary" onClick={addParticipant} disabled={!!busy || !newParticipant}>{busy === 'participant' ? 'در حال…' : 'افزودن'}</button>
        </>}>
        <div className="entity-form org-form">
          <div className="form-section-head"><h3>انتخاب شخص</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="mt-person">شخص <span className="req">*</span></label>
              <select id="mt-person" value={newParticipant} onChange={e => setNewParticipant(e.target.value)}>
                <option value="">انتخاب کنید…</option>
                {people
                  .filter((p: any) => !(m?.participants ?? []).some((x: any) => x.person?.id === p.id))
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.title ? ` — ${p.title}` : ''}</option>
                  ))}
              </select>
              <span className="field-hint">کسانی که عضو جلسه نیستند نمایش داده می‌شوند.</span>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function ChevronLeftIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flex: 'none' }}><path d="m15 18-6-6 6-6" /></svg>;
}
