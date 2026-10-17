'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۱ — F14 کارت آماده‌سازی سرمایه‌گذار و شریک (کامپوننت)
   موضوع · وضعیت DD (زنده از پروندهٔ DD متصل) · هدف رابطه · شواهد · فهرست هدف ·
   طرح جلسه · تعهدها (زنده از مشارکت) · اقدام بعدی — متصل به مشارکت/فرصت موجود.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { faNum } from '../_lib/jalali';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { Handshake, Plus, Target, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const EMPTY = { subject: '', partnershipId: '', opportunityId: '', ownerRole: '', relationshipGoal: '', evidence: '', targetList: '', meetingPlan: '', nextAction: '' };

export default function ReadinessPacks() {
  const { can } = useWorkspace();
  const writable = can('partnership.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null); /* رکورد یا EMPTY برای ایجاد */
  const [formError, setFormError] = useState('');
  const [partnerships, setPartnerships] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/readiness-packs')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    apiGet('/partnerships').then((r: any) => { setPartnerships(r.items ?? []); setRoles(r.roles ?? []); }).catch(() => {});
    apiGet('/opportunities').then((r: any) => setOpportunities(Array.isArray(r) ? r : r.items ?? [])).catch(() => {});
  }, []);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      if (edit.id) {
        await api(`/readiness-packs/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) });
      } else {
        await api('/readiness-packs', { method: 'POST', body: JSON.stringify(edit) });
      }
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f14>
      <div className="section-head">
        <h2><Handshake size={17} /> {t('آماده‌سازی سرمایه‌گذار و شریک (F14)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('کارت آماده‌سازی جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<Handshake size={22} />} title={t('کارت آماده‌سازی ثبت نشده است')}
          description={t('برای هر سرمایه‌گذار یا شریکِ در آستانهٔ تصمیم، کارت آماده‌سازی متصل به مشارکت/فرصت بسازید.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('موضوع')}</th><th>{t('اتصال')}</th><th>{t('وضعیت DD (زنده)')}</th>
              <th>{t('هدف رابطه')}</th><th>{t('اقدام بعدی')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((p: any) => (
                <tr key={p.id} data-rp={p.id}>
                  <td className="t-primary">{p.subject}<small className="muted" style={{ display: 'block' }}>{t('مالک')}: {p.ownerRole}</small></td>
                  <td>{p.partnerName ? <span className="chip info">{p.partnerName}</span> : null} {p.opportunityName ? <span className="chip">{p.opportunityName}</span> : null}</td>
                  <td>{p.ddStatus
                    ? <span className={`chip ${p.ddStatus.status === 'APPROVED' ? 'success' : p.ddStatus.status === 'REJECTED' ? 'warning' : 'neutral'}`}>{p.ddStatusFa}{p.ddStatus.g2Ready ? ' · ' + t('آمادهٔ G2') : ''}</span>
                    : <span className="chip neutral">{t('بدون پروندهٔ DD')}</span>}</td>
                  <td className="t-muted" style={{ maxWidth: 220 }}>{p.relationshipGoal || '—'}</td>
                  <td className="t-muted" style={{ maxWidth: 200 }}>{p.nextAction || '—'}</td>
                  <td>{writable && <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...p }); }}>{t('ویرایش')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ایجاد/ویرایش کارت */}
      <Modal open={!!edit} title={edit?.id ? t('ویرایش کارت آماده‌سازی') : t('کارت آماده‌سازی جدید')}
        description={t('کارت باید به یک مشارکت یا فرصت موجود متصل باشد؛ وضعیت DD و تعهدها خودکار خوانده می‌شوند.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="rp-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ کارت')}</button>
        </>}>
        {edit && (<form id="rp-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field"><span>{t('موضوع')} *</span>
            <input value={edit.subject} required minLength={3} onChange={(e) => setEdit((d: any) => ({ ...d, subject: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('مشارکت متصل')}</span>
              <select value={edit.partnershipId ?? ''} onChange={(e) => setEdit((d: any) => ({ ...d, partnershipId: e.target.value }))}>
                <option value="">{t('بدون مشارکت')}</option>
                {partnerships.map((p: any) => <option key={p.id} value={p.id}>{p.partnerName}</option>)}
              </select></label>
            <label className="field"><span>{t('فرصت متصل')}</span>
              <select value={edit.opportunityId ?? ''} onChange={(e) => setEdit((d: any) => ({ ...d, opportunityId: e.target.value }))}>
                <option value="">{t('بدون فرصت')}</option>
                {opportunities.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('مالک کارت')} *</span>
            <select value={edit.ownerRole} required onChange={(e) => setEdit((d: any) => ({ ...d, ownerRole: e.target.value }))}>
              <option value="">{t('انتخاب کنید…')}</option>
              {roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select></label>
          <label className="field"><span>{t('هدف رابطه')}</span>
            <input value={edit.relationshipGoal} onChange={(e) => setEdit((d: any) => ({ ...d, relationshipGoal: e.target.value }))} /></label>
          <label className="field"><span>{t('شواهد')}</span>
            <input value={edit.evidence} onChange={(e) => setEdit((d: any) => ({ ...d, evidence: e.target.value }))} /></label>
          <label className="field"><span>{t('فهرست هدف')}</span>
            <input value={edit.targetList} onChange={(e) => setEdit((d: any) => ({ ...d, targetList: e.target.value }))} placeholder={t('نام سرمایه‌گذاران/شرکای هدف، جدا با ؛')} /></label>
          <label className="field"><span>{t('طرح جلسه')}</span>
            <input value={edit.meetingPlan} onChange={(e) => setEdit((d: any) => ({ ...d, meetingPlan: e.target.value }))} /></label>
          <label className="field"><span>{t('اقدام بعدی')}</span>
            <input value={edit.nextAction} onChange={(e) => setEdit((d: any) => ({ ...d, nextAction: e.target.value }))} /></label>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
