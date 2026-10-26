'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۴ — F04 کارت محیط، ذی‌نفع و رقیب (کامپوننت)
   ادغام عموم‌ها + رقیب: نوع اطلاعات · نشانهٔ تغییر · منبع · اهمیت · موضع ·
   قدرت · پیام · شواهد رقیب · سناریو · هشدار — با گردش F05 (درخواست و تصویب).
   (قاعدهٔ سرور: هشدار فقط پس از تصویب فعال می‌شود.)
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { BellRing, Radar, Plus, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const KIND_FA: Record<string, string> = { PUBLIC: t('عموم‌ها'), STAKEHOLDER: t('ذی‌نفع'), COMPETITOR: t('رقیب') };
const KIND_TONE: Record<string, 'neutral' | 'info' | 'warning'> = { PUBLIC: 'neutral', STAKEHOLDER: 'info', COMPETITOR: 'warning' };
const STATUS_FA: Record<string, string> = { DRAFT: t('پیش‌نویس'), PENDING: t('در انتظار تصویب'), APPROVED: t('مصوب'), REJECTED: t('ردشده') };
const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = { DRAFT: 'neutral', PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' };
const LEVEL_FA: Record<string, string> = { HIGH: t('زیاد'), MEDIUM: t('متوسط'), LOW: t('کم') };
/* فاز ۱۳.۳ — فیلدهای عمومی ۸.۳.۱ سند v14 (فقط برای kind=PUBLIC) */
const PUBLIC_STATUS_FA: Record<string, string> = { LATENT: t('نهفته'), AWARE: t('آگاه'), ACTIVE: t('فعال'), MEDIATOR: t('میانجی') };
const AWARENESS_FA: Record<string, string> = { NONE: t('ناآگاه'), PARTIAL: t('جزئی'), FULL: t('کامل') };
const ENGAGEMENT_FA: Record<string, string> = { LOW: t('کم'), MEDIUM: t('متوسط'), HIGH: t('زیاد') };
const COMM_FA: Record<string, string> = { RECEIVE: t('دریافت'), SEARCH: t('جست‌وجو'), RESHARE: t('بازنشر'), ACT: t('اقدام') };

const EMPTY: any = { kind: 'COMPETITOR', infoType: '', changeSignal: '', source: '', importance: 'MEDIUM', position: '', power: 'MEDIUM', message: '', competitorEvidence: '', scenario: '', commonIssue: '', publicStatus: '', awareness: '', engagement: '', actionConstraint: '', commBehavior: '' };

export default function EnvStakeholderCards() {
  const { can } = useWorkspace();
  const writable = can('publics.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/env-stakeholder-cards')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      if (edit.id) await api(`/env-stakeholder-cards/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) });
      else await api('/env-stakeholder-cards', { method: 'POST', body: JSON.stringify(edit) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }
  async function flow(id: string, decision: 'APPROVED' | 'REJECTED' | 'PENDING') {
    setBusy('fl-' + id + decision); setError('');
    try {
      await api(`/env-stakeholder-cards/${id}`, { method: 'POST', body: JSON.stringify({ decision }) });
      await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function toggleAlert(row: any) {
    setBusy('al-' + row.id); setError('');
    try {
      await api(`/env-stakeholder-cards/${row.id}`, { method: 'PATCH', body: JSON.stringify({ alert: !row.alert }) });
      await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f04 style={{ marginTop: 14 }}>
      <div className="section-head">
        <h2><Radar size={17} /> {t('کارت محیط، ذی‌نفع، عموم و رقیب (F04)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('کارت محیط جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<Radar size={22} />} title={t('کارت محیط ثبت نشده است')}
          description={t('عموم‌ها و رقیب را در یک کارت واحد ببینید — نشانهٔ تغییر، موضع، سناریو و هشدار.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('نوع')}</th><th>{t('نوع اطلاعات')}</th><th>{t('نشانهٔ تغییر')}</th><th>{t('وضعیت عموم / رفتار')}</th>
              <th>{t('اهمیت')}</th><th>{t('قدرت')}</th><th>{t('وضعیت گردش F05')}</th><th>{t('هشدار')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-env={x.id}>
                  <td><Badge tone={KIND_TONE[x.kind]}>{x.kindFa}</Badge></td>
                  <td className="t-primary">{x.infoType}</td>
                  <td className="t-muted" style={{ maxWidth: 260 }}>{x.changeSignal}</td>
                  <td>{x.kind === 'PUBLIC' ? (
                    <div style={{ display: 'grid', gap: 3, justifyItems: 'start' }}>
                      <Badge tone="info">{x.publicStatusFa ?? '—'}</Badge>
                      <span className="t-muted" style={{ fontSize: 10.5 }}>{t('آگاهی')}: {x.awarenessFa ?? '—'} · {t('دروگیری')}: {x.engagementFa ?? '—'}</span>
                      {x.commBehaviorFa && <span className="t-muted" style={{ fontSize: 10.5 }}>{t('رفتار')}: {x.commBehaviorFa}</span>}
                    </div>
                  ) : <span className="t-muted">—</span>}</td>
                  <td>{x.importanceFa}</td>
                  <td>{LEVEL_FA[x.power] ?? x.power}</td>
                  <td><StatusBadge tone={STATUS_TONE[x.status]}>{x.statusFa}</StatusBadge></td>
                  <td>{x.alert
                    ? <Badge tone="danger"><BellRing size={11} /> {t('فعال')}</Badge>
                    : writable && x.status === 'APPROVED'
                      ? <button className="srip-button" disabled={busy === 'al-' + x.id} onClick={() => toggleAlert(x)}>{t('فعال‌سازی هشدار')}</button>
                      : <span className="chip neutral">{t('غیرفعال')}</span>}</td>
                  <td>
                    {writable && <div style={{ display: 'flex', gap: 4 }}>
                      <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x }); }}>{t('ویرایش')}</button>
                      {x.status !== 'APPROVED' && <button className="srip-button primary" disabled={busy.startsWith('fl-' + x.id)} onClick={() => flow(x.id, 'APPROVED')}>{t('تصویب')}</button>}
                      {x.status === 'APPROVED' && <button className="srip-button" disabled={busy.startsWith('fl-' + x.id)} onClick={() => flow(x.id, 'REJECTED')}>{t('بازگشایی')}</button>}
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش کارت محیط') : t('کارت محیط جدید')}
        description={t('هشدار فقط پس از تصویب کارت در گردش F05 فعال می‌شود.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="env-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ کارت محیط')}</button>
        </>}>
        {edit && (<form id="env-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field-pair">
            <label className="field"><span>{t('نوع کارت')} *</span>
              <select value={edit.kind} onChange={(e) => setEdit((d: any) => ({ ...d, kind: e.target.value }))}>
                {Object.entries(KIND_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="field"><span>{t('نوع اطلاعات')} *</span>
              <input value={edit.infoType} required onChange={(e) => setEdit((d: any) => ({ ...d, infoType: e.target.value }))} placeholder={t('مثلاً: حرکت رقیب، تغییر مقرراتی')} /></label>
          </div>
          <label className="field"><span>{t('نشانهٔ تغییر')} *</span>
            <input value={edit.changeSignal} required onChange={(e) => setEdit((d: any) => ({ ...d, changeSignal: e.target.value }))} /></label>
          <label className="field"><span>{t('منبع')} *</span>
            <input value={edit.source} required onChange={(e) => setEdit((d: any) => ({ ...d, source: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('اهمیت')}</span>
              <select value={edit.importance} onChange={(e) => setEdit((d: any) => ({ ...d, importance: e.target.value }))}>
                {Object.entries(LEVEL_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="field"><span>{t('قدرت')}</span>
              <select value={edit.power} onChange={(e) => setEdit((d: any) => ({ ...d, power: e.target.value }))}>
                {Object.entries(LEVEL_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('موضع')}</span>
            <input value={edit.position} onChange={(e) => setEdit((d: any) => ({ ...d, position: e.target.value }))} /></label>
          <label className="field"><span>{t('پیام')}</span>
            <input value={edit.message} onChange={(e) => setEdit((d: any) => ({ ...d, message: e.target.value }))} /></label>
          <label className="field"><span>{t('شواهد رقیب')}</span>
            <input value={edit.competitorEvidence} onChange={(e) => setEdit((d: any) => ({ ...d, competitorEvidence: e.target.value }))} /></label>
          <label className="field"><span>{t('سناریو')}</span>
            <input value={edit.scenario} onChange={(e) => setEdit((d: any) => ({ ...d, scenario: e.target.value }))} /></label>
          {edit.kind === 'PUBLIC' && (<>
            <div className="field full" style={{ marginTop: 6 }}>
              <span className="field-label">{t('فیلدهای عمومی (۸.۳.۱ سند v14) — برای کارت «عموم‌ها» الزامی')}</span>
            </div>
            <label className="field full"><span>{t('مسئلهٔ مشترک')} *</span>
              <input data-ei="commonIssue" value={edit.commonIssue} required onChange={(e) => setEdit((d: any) => ({ ...d, commonIssue: e.target.value }))} placeholder={t('مسئله یا پیوند مشترک این عموم')} /></label>
            <div className="field-pair">
              <label className="field"><span>{t('وضعیت عموم')} *</span>
                <select data-ei="publicStatus" value={edit.publicStatus} required onChange={(e) => setEdit((d: any) => ({ ...d, publicStatus: e.target.value }))}>
                  <option value="">—</option>
                  {Object.entries(PUBLIC_STATUS_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <label className="field"><span>{t('رفتار ارتباطی')} *</span>
                <select data-ei="commBehavior" value={edit.commBehavior} required onChange={(e) => setEdit((d: any) => ({ ...d, commBehavior: e.target.value }))}>
                  <option value="">—</option>
                  {Object.entries(COMM_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
            </div>
            <div className="field-pair">
              <label className="field"><span>{t('سطح آگاهی')} *</span>
                <select data-ei="awareness" value={edit.awareness} required onChange={(e) => setEdit((d: any) => ({ ...d, awareness: e.target.value }))}>
                  <option value="">—</option>
                  {Object.entries(AWARENESS_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <label className="field"><span>{t('میزان درگیری')} *</span>
                <select data-ei="engagement" value={edit.engagement} required onChange={(e) => setEdit((d: any) => ({ ...d, engagement: e.target.value }))}>
                  <option value="">—</option>
                  {Object.entries(ENGAGEMENT_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
            </div>
            <label className="field full"><span>{t('محدودیت اقدام')}</span>
              <input data-ei="actionConstraint" value={edit.actionConstraint} onChange={(e) => setEdit((d: any) => ({ ...d, actionConstraint: e.target.value }))} placeholder={t('مانع اقدام این عموم (اختیاری)')} /></label>
          </>)}
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
