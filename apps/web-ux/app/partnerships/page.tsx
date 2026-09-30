'use client';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../_components/workspace';
import { api, unwrapList } from '../_lib/api';
import { faNum, faFullDate } from '../_lib/jalali';
import { t } from '../_lib/i18n';
import {
  Badge, ErrorCard, Loading, Modal, PageHeader, StatCard, StatusBadge, EmptyV4,
} from '../_components/page-ui';
import {
  AlertTriangle, ArrowLeft, CalendarClock, FileCheck2, Handshake, Link2, Plus, RefreshCw, Target, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۲.۲ مسترپلن — ماژول مشارکت (Partnership)
   خط لولهٔ چهارسطحی مذاکره → تفاهم‌نامه → فعال → پایان (فرم ۱۱ سند:
   «ثبت وضعیت مذاکره تا فعال‌سازی مشارکت») · متصل به روابط و فرصت‌ها
   · هدف شبکهٔ مشارکت: ۲۵ تفاهم‌نامهٔ فعال (پیوست الف، پروژهٔ ۱۵)
   · قاعدهٔ سند: فعال‌سازی مشارکت بدون قرارداد ثبت نمی‌شود.
   ═══════════════════════════════════════════════════════════════════════════ */

const STAGE_FA: Record<string, string> = { NEGOTIATION: t('مذاکره'), MOU: t('تفاهم‌نامه'), ACTIVE: t('فعال'), ENDED: t('پایان') };
const STAGE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { NEGOTIATION: 'neutral', MOU: 'info', ACTIVE: 'success', ENDED: 'neutral' };
const STAGE_DOT: Record<string, string> = { NEGOTIATION: 'negotiation', MOU: 'mou', ACTIVE: 'active', ENDED: 'ended' };
const STAGES: string[] = ['NEGOTIATION', 'MOU', 'ACTIVE', 'ENDED'];
const ORG_TYPE_FA: Record<string, string> = {
  HOLDING: t('هلدینگ'), SUBSIDIARY: t('زیرمجموعه'), BANK: t('بانک'), PARTNER: t('شریک'),
  CUSTOMER: t('مشتری'), SUPPLIER: t('تأمین‌کننده'), INVESTOR: t('سرمایه‌گذار'),
  GOVERNMENT: t('دولتی'), ACADEMIC: t('دانشگاهی'), ASSOCIATION: t('انجمن'), MEDIA: t('رسانه'),
};

const faDate = (iso?: string | null) => (iso ? faFullDate(new Date(iso)) : '—');

export default function PartnershipsPage() {
  const { can } = useWorkspace();
  const writable = can('partnership.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState<any | null>(null);
  const [stageError, setStageError] = useState('');
  const [contractDraft, setContractDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    partnerOrgId: '', type: '', ownerRole: '', relationshipId: '', opportunityId: '',
    ourCommitments: '', theirCommitments: '', contractName: '', notes: '',
  });
  /* گزینه‌های فرم — فقط بار اولِ باز شدن فرم بارگذاری می‌شوند */
  const [orgs, setOrgs] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [opps, setOpps] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await api<any>('/partnerships');
      setData(result);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setCreateOpen(true); setFormError('');
    if (!orgs.length) {
      try {
        const [o, r, v] = await Promise.all([
          api<any>('/organizations').then(unwrapList),
          api<any>('/relationships').then(unwrapList),
          api<any>('/opportunities').then(unwrapList),
        ]);
        setOrgs(o); setRels(r); setOpps(v);
      } catch { /* فرم بدون گزینه‌های پیوند هم کار می‌کند */ }
    }
  };

  const submit = async () => {
    setFormError(''); setBusy(true);
    try {
      await api('/partnerships', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false);
      setForm({ partnerOrgId: '', type: '', ownerRole: '', relationshipId: '', opportunityId: '', ourCommitments: '', theirCommitments: '', contractName: '', notes: '' });
      load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  /* تغییر مرحله — قاعدهٔ سند سمت سرور اعمال می‌شود (فعال بدون قرارداد → خطا) */
  const setStage = async (row: any, stage: string) => {
    if (!writable || busy) return;
    setStageError(''); setBusy(true);
    try {
      const updated = await api<any>(`/partnerships/${row.id}`, { method: 'PATCH', body: JSON.stringify({ stage }) });
      setDetail(updated); load();
    } catch (x) { setStageError((x as Error).message); }
    finally { setBusy(false); }
  };

  /* پیوست قرارداد — پیش‌نیاز فعال‌سازی */
  const attachContract = async (row: any) => {
    if (!contractDraft.trim()) return;
    setStageError(''); setBusy(true);
    try {
      const updated = await api<any>(`/partnerships/${row.id}`, { method: 'PATCH', body: JSON.stringify({ contractName: contractDraft.trim() }) });
      setDetail(updated); setContractDraft(''); load();
    } catch (x) { setStageError((x as Error).message); }
    finally { setBusy(false); }
  };

  const items: any[] = data?.items ?? [];
  const summary = data?.summary;
  const relLabel = (r: any) => `${r.sourceOrganization?.name ?? '?'} ↔ ${r.targetOrganization?.name ?? '?'}`;

  return (
    <main className="feature-page">
      <PageHeader
        title={t('مشارکت‌ها')}
        description={t('خط لولهٔ همکاری‌ها از مذاکره تا فعال‌سازی — متصل به روابط و فرصت‌ها، با هدف ۲۵ تفاهم‌نامهٔ فعال برای شبکهٔ مشارکت.')}
        actions={<div className="heading-tools">
          <button className="srip-button" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('بازخوانی')}</button>
          {writable ? <button className="srip-button primary" onClick={openCreate}><Plus size={14} /> {t('مشارکت جدید')}</button> : null}
        </div>}
      />
      <ErrorCard message={error} />
      {loading && !data ? <Loading /> : null}

      {summary && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Target size={18} />} iconClass="ic-teal" label={t('تفاهم‌نامه‌های فعال')}
              value={summary.target ? `${faNum(summary.activeMou)} ${t('از')} ${faNum(summary.target)}` : faNum(summary.activeMou)}
              sub={summary.target ? t('هدف ثبت‌شده در تنظیمات برنامهٔ سازمان') : t('هدف مشارکت در تنظیمات برنامه ثبت نشده است')} />
            <StatCard icon={<Handshake size={18} />} iconClass="ic-blue" label={t('در مذاکره')}
              value={faNum(summary.byStage?.NEGOTIATION ?? 0)} sub={t('در آستانهٔ تفاهم‌نامه')} />
            <StatCard icon={<CalendarClock size={18} />} iconClass="ic-gold" label={t('بازبینی نزدیک')}
              value={faNum(summary.reviewsDue)} sub={t('در ۳۰ روز آینده')} />
            <StatCard icon={<Link2 size={18} />} iconClass="ic-red" label={t('متصل به رابطه')}
              value={faNum(summary.linkedRelationship)} sub={`${faNum(summary.linkedOpportunity)} ${t('فرصت مرتبط')}`} />
          </div>

          <div className="note-strip">
            <FileCheck2 size={15} />
            <span>{data?.rule ?? t('فعال‌سازی مشارکت بدون قرارداد ثبت نمی‌شود.')} {t('هر مشارکت از مرحلهٔ مذاکره آغاز می‌شود و تعهدات دوطرفهٔ آن ثبت می‌گردد.')}</span>
          </div>

          {!items.length ? (
            <EmptyV4 icon={<Handshake size={30} />} title={t('هنوز مشارکتی ثبت نشده است')}
              description={t('با ثبت نخستین شریک، خط لولهٔ مذاکره تا فعال‌سازی آغاز می‌شود؛ مشارکت بدون مالک ثبت نمی‌شود.')}
              action={writable ? <button className="srip-button primary" onClick={openCreate}><Plus size={14} /> {t('مشارکت جدید')}</button> : undefined} />
          ) : (
            <div className="pp-board">
              {STAGES.map(st => {
                const col = items.filter((x: any) => x.stage === st);
                return (
                  <div className="pp-col" key={st} data-stage={st}>
                    <div className="pp-col-head">
                      <span className="pp-col-title"><span className={`pp-dot ${STAGE_DOT[st]}`} /> {STAGE_FA[st]}</span>
                      <span className="chip">{faNum(col.length)}</span>
                    </div>
                    {col.map((x: any) => (
                      <button type="button" key={x.id} className="pp-card row-click" onClick={() => { setDetail(x); setStageError(''); setContractDraft(''); }}>
                        <span className="pp-card-head">
                          <span className="pp-name">{x.partnerName}</span>
                          <Badge tone={STAGE_TONE[st]}>{x.type}</Badge>
                        </span>
                        <span className="pp-meta">
                          <span>{t('مالک')}: {x.ownerRole}</span>
                          <span>{t('بازبینی')}: {faDate(x.reviewAt)} {x.reviewDue ? <Badge tone="warning">{t('نزدیک')}</Badge> : null}</span>
                          <span className="pp-contract">
                            {x.contractName
                              ? <><FileCheck2 size={13} /> {x.contractName}</>
                              : <Badge tone="warning">{t('بدون قرارداد')}</Badge>}
                          </span>
                        </span>
                        {(x.relationshipId || x.opportunityId) ? (
                          <span className="pp-links">
                            {x.relationshipId ? <a className="pp-link" href={`/relationships/${x.relationshipId}`} onClick={(e) => e.stopPropagation()}><Link2 size={12} /> {t('رابطه')}</a> : null}
                            {x.opportunityId ? <a className="pp-link" href="/opportunities" onClick={(e) => e.stopPropagation()}><ArrowLeft size={12} /> {t('فرصت')}</a> : null}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    {!col.length ? <div className="pp-col-empty">—</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════ مودال: جزئیات مشارکت و تغییر مرحله ═══════════ */}
      <Modal open={!!detail} title={detail?.partnerName ?? ''} onClose={() => setDetail(null)}
        description={`${t('نوع همکاری')}: ${detail?.type ?? ''} · ${t('مالک')}: ${detail?.ownerRole ?? ''}${detail?.partnerType ? ` · ${ORG_TYPE_FA[detail.partnerType] ?? ''}` : ''}`}>
        {detail && (
          <>
            {writable ? (
              <div className="pp-stage-row">
                {STAGES.map(st => (
                  <button type="button" key={st} disabled={busy || st === detail.stage}
                    className={`pp-stage-chip ${st === detail.stage ? 'current' : ''}`}
                    onClick={() => setStage(detail, st)}>
                    {STAGE_FA[st]}
                  </button>
                ))}
              </div>
            ) : null}
            {stageError ? <div className="alert-banner danger" role="alert" style={{ marginTop: 10 }}><AlertTriangle size={16} /><span>{stageError}</span></div> : null}
            <div className="detail-grid">
              <div><b>{t('تعهدات ما')}</b><p>{detail.ourCommitments || '—'}</p></div>
              <div><b>{t('تعهدات شریک')}</b><p>{detail.theirCommitments || '—'}</p></div>
              <div><b>{t('مرحله')}</b><p><StatusBadge tone={STAGE_TONE[detail.stage]}>{detail.stageFa ?? STAGE_FA[detail.stage]}</StatusBadge></p></div>
              <div><b>{t('قرارداد پیوست')}</b><p>{detail.contractName ? `${detail.contractName} (${faDate(detail.contractSignedAt)})` : t('بدون قرارداد — پیش‌نیاز فعال‌سازی')}</p></div>
              {detail.relationshipId ? <div><b>{t('رابطهٔ مرتبط')}</b><p><a className="pp-link" href={`/relationships/${detail.relationshipId}`}>{detail.relationshipLabel ?? t('مشاهدهٔ رابطه')} <ArrowLeft size={12} /></a></p></div> : null}
              {detail.opportunityId ? <div><b>{t('فرصت مرتبط')}</b><p><a className="pp-link" href="/opportunities">{detail.opportunityName ?? t('مشاهدهٔ فرصت')} <ArrowLeft size={12} /></a></p></div> : null}
              <div><b>{t('تاریخ بازبینی بعدی')}</b><p>{faDate(detail.reviewAt)}</p></div>
              <div><b>{t('تاریخ ثبت')}</b><p>{faDate(detail.createdAt)}</p></div>
              {detail.notes ? <div><b>{t('یادداشت')}</b><p>{detail.notes}</p></div> : null}
            </div>
            {writable && !detail.contractName ? (
              <div className="pp-contract-form">
                <input value={contractDraft} onChange={(e) => setContractDraft(e.target.value)}
                  placeholder={t('نام قرارداد یا تفاهم‌نامهٔ پیوست‌شده…')} />
                <button type="button" className="srip-button" disabled={busy || !contractDraft.trim()} onClick={() => attachContract(detail)}>
                  <FileCheck2 size={14} /> {t('پیوست قرارداد')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </Modal>

      {/* ═══════════ مودال: مشارکت جدید ═══════════ */}
      <Modal open={createOpen} title={t('ثبت مشارکت جدید')} onClose={() => setCreateOpen(false)}
        description={t('هر مشارکت از مرحلهٔ مذاکره آغاز می‌شود؛ فعال‌سازی آن نیازمند قرارداد پیوست است و مشارکت بدون مالک ثبت نمی‌شود.')}
        footer={<>
          <button className="srip-button" onClick={() => setCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="partnership-create-form" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت مشارکت')}</button>
        </>}>
        <form id="partnership-create-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field">
            <span>{t('سازمان شریک')} *</span>
            <select value={form.partnerOrgId} onChange={(e) => setForm(f => ({ ...f, partnerOrgId: e.target.value }))} required>
              <option value="">{t('انتخاب کنید…')}</option>
              {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}{ORG_TYPE_FA[o.type] ? ` (${ORG_TYPE_FA[o.type]})` : ''}</option>)}
            </select>
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('نوع همکاری')} *</span>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {(data?.types ?? []).map((tp: string) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t('مالک مشارکت')} *</span>
              <select value={form.ownerRole} onChange={(e) => setForm(f => ({ ...f, ownerRole: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {(data?.roles ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>{t('رابطهٔ مرتبط (اختیاری)')}</span>
            <select value={form.relationshipId} onChange={(e) => setForm(f => ({ ...f, relationshipId: e.target.value }))}>
              <option value="">{t('بدون رابطه')}</option>
              {rels.map((r: any) => <option key={r.id} value={r.id}>{relLabel(r)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t('فرصت مرتبط (اختیاری)')}</span>
            <select value={form.opportunityId} onChange={(e) => setForm(f => ({ ...f, opportunityId: e.target.value }))}>
              <option value="">{t('بدون فرصت')}</option>
              {opps.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t('تعهدات ما')}</span>
            <input value={form.ourCommitments} onChange={(e) => setForm(f => ({ ...f, ourCommitments: e.target.value }))} placeholder={t('چه چیزی تحویل می‌دهیم…')} />
          </label>
          <label className="field">
            <span>{t('تعهدات شریک')}</span>
            <input value={form.theirCommitments} onChange={(e) => setForm(f => ({ ...f, theirCommitments: e.target.value }))} placeholder={t('چه چیزی از شریک انتظار داریم…')} />
          </label>
          <label className="field">
            <span>{t('قرارداد پیوست (اختیاری)')}</span>
            <input value={form.contractName} onChange={(e) => setForm(f => ({ ...f, contractName: e.target.value }))} placeholder={t('نام قرارداد یا تفاهم‌نامه…')} />
          </label>
          <label className="field">
            <span>{t('یادداشت')}</span>
            <input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </label>
          {formError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{formError}</span></div> : null}
        </form>
      </Modal>
    </main>
  );
}
