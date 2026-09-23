'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, EmptyV4, ErrorCard, Loading, PageHeader, SectionCard, StatCard, Modal } from '../_components/page-ui';
import { BarChart3, CalendarDays, Check, FileDown, FileUp, Mail, Pencil, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   ورود ساختاریافتهٔ ایمیل/تقویم (مسترپلن فاز ۲/۱۱) — الگوی Affinity/4Degrees،
   درس‌آموخته: تک‌منبعی نبودن (ICS تقویم + CSV ایمیل) و حریم خصوصی:
   فقط متادیتا (تاریخ/موضوع/طرف/جهت) — بدنهٔ پیام هرگز ذخیره نمی‌شود؛
   هر رکورد با تأیید انسانی و امکان اصلاح دستی وارد می‌شود.
   POST /imports → GET /imports/:id → POST rows/:rid (ACCEPT/EDIT/REJECT) → commit
   ═══════════════════════════════════════════════════════════════════════════ */

type Row = {
  rid: string; status: string; kind: string; at: string; subject: string; direction: string;
  matchedPersonIds: string[]; matchedOrganizationIds: string[]; relationshipId: string | null;
  confidence: number; unmatchedEmails: string[]; interactionId?: string;
  /* ردیف پژوهش بازار */
  orgName?: string; industry?: string | null; segment?: string | null; marketShare?: number | null;
  revenue?: string | null; competitors?: string[]; website?: string | null; notes?: string | null; exists?: boolean;
};
type Batch = {
  id: string; kind: string; createdAt: string; status: string; fileName?: string | null;
  stats: { total: number; mapped: number; personMapped: number; unmatched: number; avgConfidence: number };
  governance: { bodyStored: boolean; fieldsCaptured: string[]; humanConfirmation: string };
  rows: Row[]; commitResult?: { created: number; proposedEdges: number; market?: { matched: number; players: number; knowledgeId: string } };
};
const KIND_FA: Record<string, string> = { 'calendar-ics': 'تقویم', 'email-csv': 'ایمیل', 'market-csv': 'پژوهش بازار' };

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const faDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};
const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = { PENDING: 'warning', ACCEPT: 'success', EDITED: 'info', EDIT: 'info', REJECT: 'danger', REJECTED: 'danger', COMMITTED: 'neutral' };
const STATUS_FA: Record<string, string> = { PENDING: 'در انتظار تأیید', ACCEPT: 'پذیرفته', ACCEPTED: 'پذیرفته', EDITED: 'اصلاح‌شده', REJECT: 'ردشده', REJECTED: 'ردشده', COMMITTED: 'ثبت‌شده' };

export default function ImportsPage() {
  const { me } = useWorkspace();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [open, setOpen] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [kind, setKind] = useState<'calendar-ics' | 'email-csv' | 'market-csv'>('calendar-ics');
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', organizationId: '', personId: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [list, pl, ol] = await Promise.all([
        api<any>('/imports'),
        api<any>('/people').catch(() => null),
        api<any>('/organizations').catch(() => null),
      ]);
      setBatches(Array.isArray(list) ? list : (list?.items ?? []));
      setPeople(Array.isArray(pl) ? pl : (pl?.data ?? pl?.items ?? []));
      setOrgs(Array.isArray(ol) ? ol : (ol?.data ?? ol?.items ?? []));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openBatch = async (id: string) => {
    setError('');
    try { setOpen(await api<Batch>(`/imports/${id}`)); }
    catch (e) { setError((e as Error).message); }
  };

  const decide = async (rid: string, decision: 'ACCEPT' | 'REJECT' | 'PENDING' | 'EDIT', patch?: Record<string, unknown>) => {
    if (!open) return;
    setBusy(true); setError('');
    try {
      const row = await api<Row>(`/imports/${open.id}/rows/${rid}`, { method: 'POST', body: JSON.stringify({ decision, ...(patch ? { patch } : {}) }) });
      setOpen(b => b ? { ...b, rows: b.rows.map(r => r.rid === rid ? { ...r, ...row } : r) } : b);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!open || !editRow) return;
    await decide(editRow.rid, 'EDIT', {
      subject: editForm.subject,
      organizationId: editForm.organizationId || null,
      personId: editForm.personId || null,
    });
    setEditRow(null);
  };

  const commit = async () => {
    if (!open) return;
    setBusy(true); setError(''); setFlash('');
    try {
      const out = await api<{ created: unknown[]; proposedEdges: { fromOrgName: string; toOrgName: string }[]; message?: string }>(`/imports/${open.id}/commit`, { method: 'POST', body: '{}' });
      setFlash(out.message ?? `${fmtN(out.created.length)} تعامل ثبت شد${out.proposedEdges.length ? ` و ${fmtN(out.proposedEdges.length)} یال پیشنهادی برای روابطِ ثبت‌نشده شناسایی شد (در صفحهٔ روابط قابل ایجاد است).` : '.'}`);
      await openBatch(open.id);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleFile = async (file: File) => {
    setBusy(true); setError(''); setFlash('');
    try {
      const content = await file.text();
      const out = await api<{ id: string; message: string }>('/imports', { method: 'POST', body: JSON.stringify({ kind, content }) });
      setFlash(out.message);
      await openBatch(out.id);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadSample = async () => {
    try {
      const out = await api<{ content: string; kind: string }>(`/imports/sample?type=${kind}&count=25`);
      const blob = new Blob([out.content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = kind === 'calendar-ics' ? 'sample-calendar.ics' : kind === 'market-csv' ? 'sample-market.csv' : 'sample-email.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setError((e as Error).message); }
  };

  const canWrite = !!me?.permissions?.includes('*') || !!me?.permissions?.includes('interaction.write');

  return (
    <>
      <PageHeader
        title="ورود دادهٔ بیرونی (فایل‌محور)"
        description="داده‌های پلتفرم‌های دیگر را فایل‌به‌فایل وارد کنید: خروجی تقویم (ICS) و ایمیل (CSV) به تعامل تبدیل می‌شود و فایل پژوهش بازار (CSV/JSON) به بینش بازار قابل استفاده در مرکز دانش. هر رکورد پیش از ثبت، تأیید شما را می‌گیرد."
      />
      {error && <ErrorCard message={error} />}
      {flash && <div className="notice" role="status">{flash}</div>}

      {canWrite && (
        <SectionCard title="بارگذاری فایل" icon={<UploadCloud size={16} />}
          description="بدون دسترسی زنده به صندوق ایمیل — کنترل کامل با شماست.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ margin: 0, minWidth: 190 }}>
              <span className="field-label">نوع فایل</span>
              <select value={kind} onChange={e => setKind(e.target.value as 'calendar-ics' | 'email-csv' | 'market-csv')}>
                <option value="calendar-ics">تقویم — خروجی ICS</option>
                <option value="email-csv">ایمیل — خروجی CSV</option>
                <option value="market-csv">پژوهش بازار — CSV/JSON</option>
              </select>
            </label>
            <button className="btn btn-secondary" onClick={downloadSample} title="نمونهٔ فایل برای آزمون نگاشت">
              <FileDown size={14} /> نمونهٔ فایل
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <FileUp size={14} /> انتخاب فایل و تجزیه
            </button>
            <input ref={fileRef} type="file" accept=".ics,.csv,.json,text/calendar,text/csv,application/json" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          {kind === 'market-csv' ? (
            <p className="t-muted" style={{ fontSize: 11, marginTop: 10 }}>
              <BarChart3 size={12} style={{ verticalAlign: -2 }} /> فایل پژوهش بازار: ستون «سازمان» الزامی است؛ صنعت، بخش بازار، سهم بازار،
              درآمد، رقبا، وب‌سایت و یادداشت اختیاری‌اند (نام ستون‌ها فارسی یا انگلیسی تشخیص داده می‌شود). نام بازیگران به‌طور خودکار با
              سازمان‌های محدودهٔ شما تطبیق می‌شود و پس از تأیید، تحلیل در «مرکز دانش ← بینش بازار» قابل استفاده است.
            </p>
          ) : (
            <p className="t-muted" style={{ fontSize: 11, marginTop: 10 }}>
              <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> حاکمیت داده: فقط تاریخ، موضوع، طرف‌ها و جهت استخراج می‌شود؛
              محتوای پیام در هیچ مرحله‌ای (حتی در حافظهٔ سرور) ذخیره یا منتقل نمی‌شود.
            </p>
          )}
        </SectionCard>
      )}

      {loading ? <Loading /> : (
        <SectionCard title="دسته‌های ورود" icon={<Mail size={16} />} description="تاریخچهٔ فایل‌های واردشده و وضعیت صف تأیید.">
          {batches.length ? (
            <div className="list">
              {batches.map(b => (
                <div className="listRow" key={b.id}>
                  <Badge tone={b.status === 'COMMITTED' ? 'neutral' : 'info'}>{b.kind === 'calendar-ics' ? <CalendarDays size={12} /> : b.kind === 'market-csv' ? <BarChart3 size={12} /> : <Mail size={12} />} {KIND_FA[b.kind] ?? b.kind}</Badge>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 12.5 }}>{fmtN(b.stats.total)} رکورد · {fmtN(b.stats.mapped)} نگاشت‌شده · اطمینان {fmtN(Math.round(b.stats.avgConfidence * 100))}٪</strong>
                    <span className="t-muted" style={{ display: 'block', fontSize: 10.5 }}>
                      {faDT(b.createdAt)}{b.fileName ? ` · ${b.fileName}` : ''} ·{' '}
                      {b.status === 'COMMITTED'
                        ? (b.kind === 'market-csv'
                          ? `ثبت نهایی: ${fmtN(b.commitResult?.created ?? 0)} رکورد بازار (${fmtN(b.commitResult?.market?.matched ?? 0)} پیوند سازمان، ${fmtN(b.commitResult?.market?.players ?? 0)} بازیگر تازه)`
                          : `ثبت نهایی: ${fmtN(b.commitResult?.created ?? 0)} تعامل`)
                        : 'در انتظار تأیید انسانی'}
                      {b.kind !== 'market-csv' && ' · بدنهٔ پیام ذخیره نشد'}
                    </span>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => openBatch(b.id)}>صف تأیید</button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyV4 icon={<FileUp size={22} />} title="هنوز فایلی وارد نشده است"
              description="با «نمونهٔ فایل» خروجی نمونه بگیرید و همان را بارگذاری کنید تا چرخهٔ کامل را ببینید." />
          )}
        </SectionCard>
      )}

      <Modal open={!!open} title={`صف تأیید انسانی — ${fmtN(open?.stats.total ?? 0)} رکورد`}
        description={open?.kind === 'market-csv'
          ? 'هر بازیگر بازار را پذیرا باشید، اصلاح کنید یا رد کنید؛ ثبت نهایی دادهٔ تأییدشده را به «بینش بازار» و مرکز دانش می‌برد.'
          : 'هر رکورد را پذیرا باشید، اصلاح کنید یا رد کنید؛ سپس ثبت نهایی فقط رکوردهای تأییدشده را تعامل می‌سازد.'}
        onClose={() => setOpen(null)}>
        {open && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Badge tone="success">پذیرفته: {fmtN(open.rows.filter(r => r.status === 'ACCEPT' || r.status === 'EDITED').length)}</Badge>
              <Badge tone="danger">ردشده: {fmtN(open.rows.filter(r => r.status === 'REJECT').length)}</Badge>
              <Badge tone="warning">در انتظار: {fmtN(open.rows.filter(r => r.status === 'PENDING').length)}</Badge>
              {open.status === 'OPEN' && (
                <button className="btn btn-primary btn-sm" style={{ marginInlineStart: 'auto' }} disabled={busy}
                  onClick={commit}>{open.kind === 'market-csv' ? 'ثبت نهایی دادهٔ بازار' : 'ثبت نهایی تعامل‌ها'}</button>
              )}
            </div>
            <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 8 }}>
              {open.rows.map(r => (
                <div key={r.rid} className="listRow" style={{ alignItems: 'flex-start' }}>
                  <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{STATUS_FA[r.status] ?? r.status}</Badge>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12 }}>{r.subject}</strong>
                    <span className="t-muted" style={{ display: 'block', fontSize: 10.5 }}>
                      {faDT(r.at)} · {r.kind === 'MARKET' ? 'بازیگر بازار' : r.kind === 'MEETING' ? 'جلسه' : 'ایمیل'}
                      {r.kind !== 'MARKET' && ` · ${r.direction === 'OUTBOUND' ? 'خروجی' : 'ورودی'}`} · اطمینان {fmtN(Math.round(r.confidence * 100))}٪
                    </span>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {r.kind === 'MARKET' ? (
                        <>
                          {r.exists
                            ? <span className="chip success">تطبیق با سازمان شما</span>
                            : <span className="chip info">بازیگر تازهٔ بازار</span>}
                          {r.segment && <span className="chip neutral">{r.segment}</span>}
                          {r.industry && <span className="chip neutral">{r.industry}</span>}
                          {r.marketShare != null && <span className="chip warning">سهم {fmtN(r.marketShare)}٪</span>}
                          {r.revenue && <span className="chip neutral">{r.revenue}</span>}
                          {(r.competitors ?? []).length > 0 && <span className="chip neutral" title={r.competitors!.join('، ')}>{fmtN(r.competitors!.length)} رقیب</span>}
                          {r.notes && <span className="t-muted" style={{ fontSize: 10.5, alignSelf: 'center' }}>{r.notes}</span>}
                        </>
                      ) : (
                        <>
                          {r.matchedOrganizationIds.map(id => {
                            const o = orgs.find(x => x.id === id);
                            return <span key={id} className="chip neutral">{o?.name ?? id}</span>;
                          })}
                          {r.matchedPersonIds.map(id => {
                            const p = people.find(x => x.id === id);
                            return <span key={id} className="chip info">{p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : id}</span>;
                          })}
                          {r.unmatchedEmails.length > 0 && <span className="chip danger" title={r.unmatchedEmails.join('، ')}>{fmtN(r.unmatchedEmails.length)} طرف ناشناخته</span>}
                          {r.interactionId && <span className="chip success">تعامل {r.interactionId.slice(0, 12)}</span>}
                        </>
                      )}
                    </span>
                  </span>
                  {open.status === 'OPEN' && (
                    <span style={{ display: 'flex', gap: 4 }}>
                      {r.status !== 'ACCEPT' && r.status !== 'COMMITTED' && (
                        <button className="btn btn-ghost btn-sm" title="پذیرش" disabled={busy} onClick={() => decide(r.rid, 'ACCEPT')}><Check size={12} /></button>
                      )}
                      <button className="btn btn-ghost btn-sm" title="اصلاح نگاشت" disabled={busy}
                        onClick={() => { setEditRow(r); setEditForm({ subject: r.subject, organizationId: r.matchedOrganizationIds[0] ?? '', personId: r.matchedPersonIds[0] ?? '' }); }}>
                        <Pencil size={12} />
                      </button>
                      {r.status !== 'REJECT' && r.status !== 'COMMITTED' && (
                        <button className="btn btn-ghost btn-sm" title="رد" disabled={busy} onClick={() => decide(r.rid, 'REJECT')}><X size={12} /></button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!editRow} title="اصلاح نگاشت رکورد" description="نگاشت اشتباه را دستی درست کنید — تغییر با برچسب «اصلاح‌شده» ثبت می‌شود."
        onClose={() => setEditRow(null)}>
        {editRow && (
          <>
            <div className="field">
              <label className="field-label" htmlFor="imp-subject">{editRow?.kind === 'MARKET' ? 'نام بازیگر بازار' : 'موضوع'}</label>
              <input id="imp-subject" value={editForm.subject} onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="imp-org">سازمان مرتبط</label>
              <select id="imp-org" value={editForm.organizationId} onChange={e => setEditForm(f => ({ ...f, organizationId: e.target.value }))}>
                <option value="">بدون سازمان</option>
                {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {editRow?.kind !== 'MARKET' && (
              <div className="field">
                <label className="field-label" htmlFor="imp-person">شخص مرتبط</label>
                <select id="imp-person" value={editForm.personId} onChange={e => setEditForm(f => ({ ...f, personId: e.target.value }))}>
                  <option value="">بدون شخص</option>
                  {people.map((p: any) => <option key={p.id} value={p.id}>{`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary" disabled={busy} onClick={saveEdit}>ذخیره اصلاح</button>
              <button className="btn btn-ghost" onClick={() => setEditRow(null)}>انصراف</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
