'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۲ — F09 فرصت مناقصه (کامپوننت)
   مرجع · عنوان · مهلت · تناسب · الزامات · شواهد توان · ریسک · تصمیم شرکت ·
   مسئول · اسناد · وضعیت ارسال · نتیجه · درس‌آموخته
   (قاعدهٔ سرور: ثبت نتیجه فقط پس از «ارسال شد» و همراه درس‌آموخته).
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { Gavel, Plus, ScrollText, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const DECISION_FA: Record<string, string> = { JOIN: t('می‌کنیم'), CONDITIONAL: t('مشروط'), DECLINE: t('منصرف می‌شویم'), UNDECIDED: t('نامشخص') };
const DECISION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { JOIN: 'success', CONDITIONAL: 'warning', DECLINE: 'danger', UNDECIDED: 'neutral' };
const SUBMIT_FA: Record<string, string> = { NOT_SUBMITTED: t('ارسال نشده'), PREPARING: t('در حال آماده‌سازی'), SUBMITTED: t('ارسال شد'), WITHDRAWN: t('بازپس‌گیری') };
const SUBMIT_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = { NOT_SUBMITTED: 'neutral', PREPARING: 'warning', SUBMITTED: 'success', WITHDRAWN: 'danger' };
const OUTCOME_FA: Record<string, string> = { PENDING: t('در انتظار'), WON: t('برد'), LOST: t('باخت') };

const EMPTY: any = { authority: '', title: '', deadline: '', fit: '', requirements: '', capabilityEvidence: '', risk: '', decision: 'UNDECIDED', ownerRole: '', documents: '', submissionStatus: 'NOT_SUBMITTED', outcome: 'PENDING', lessonsLearned: '' };

export default function TenderOpportunities() {
  const { can } = useWorkspace();
  const writable = can('opportunity.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/tenders')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); apiGet('/program/settings').then((r: any) => setRoles(r.roles ?? [])).catch(() => {}); }, [reload]);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      const payload = { ...edit };
      if (edit.id) await api(`/tenders/${edit.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/tenders', { method: 'POST', body: JSON.stringify(payload) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f09>
      <div className="section-head">
        <h2><Gavel size={17} /> {t('فرصت‌های مناقصه (F09)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('مناقصهٔ جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<Gavel size={22} />} title={t('فرصت مناقصه ثبت نشده است')}
          description={t('هر مناقصه را با مرجع، مهلت، تناسب، الزامات و تصمیم شرکت ثبت کنید؛ نتیجه فقط پس از ارسال و با درس‌آموخته.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('عنوان')}</th><th>{t('مرجع')}</th><th>{t('مهلت ارسال')}</th>
              <th>{t('تناسب')}</th><th>{t('تصمیم شرکت')}</th><th>{t('وضعیت ارسال')}</th><th>{t('نتیجه')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-tnd={x.id}>
                  <td className="t-primary" style={{ maxWidth: 230 }}>{x.title}<small className="muted" style={{ display: 'block' }}>{t('مسئول')}: {x.ownerRole}</small></td>
                  <td className="t-muted">{x.authority}</td>
                  <td className="t-muted">{String(x.deadline ?? '').slice(0, 10)}</td>
                  <td className="t-muted" style={{ maxWidth: 160 }}>{x.fit || '—'}</td>
                  <td><Badge tone={DECISION_TONE[x.decision]}>{x.decisionFa}</Badge></td>
                  <td><StatusBadge tone={SUBMIT_TONE[x.submissionStatus]}>{x.submissionFa}</StatusBadge></td>
                  <td>{x.outcome === 'WON' ? <Badge tone="success">{OUTCOME_FA.WON}</Badge> : x.outcome === 'LOST' ? <Badge tone="danger">{OUTCOME_FA.LOST}</Badge> : <span className="chip neutral">{OUTCOME_FA.PENDING}</span>}{x.lessonsLearned ? <span className="chip purple" style={{ marginInlineStart: 4 }} title={x.lessonsLearned}>{t('درس‌آموخته')}</span> : null}</td>
                  <td>{writable && <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x, deadline: String(x.deadline ?? '').slice(0, 10), lessonsLearned: x.lessonsLearned ?? '' }); }}>{t('ویرایش')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش فرصت مناقصه') : t('مناقصهٔ جدید')}
        description={t('ثبت نتیجه (برد/باخت) فقط پس از «ارسال شد» و همراه درس‌آموخته ممکن است.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="tnd-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ مناقصه')}</button>
        </>}>
        {edit && (<form id="tnd-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field"><span>{t('مرجع مناقصه')} *</span>
            <input value={edit.authority} required onChange={(e) => setEdit((d: any) => ({ ...d, authority: e.target.value }))} /></label>
          <label className="field"><span>{t('عنوان')} *</span>
            <input value={edit.title} required onChange={(e) => setEdit((d: any) => ({ ...d, title: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('مهلت ارسال')} *</span>
              <input type="date" value={edit.deadline} required onChange={(e) => setEdit((d: any) => ({ ...d, deadline: e.target.value }))} /></label>
            <label className="field"><span>{t('مسئول پیگیری')} *</span>
              <select value={edit.ownerRole} required onChange={(e) => setEdit((d: any) => ({ ...d, ownerRole: e.target.value }))}>
                <option value="">{t('انتخاب کنید…')}</option>
                {roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('تناسب')}</span>
            <input value={edit.fit} placeholder={t('بالا/متوسط/پایین + دلیل')} onChange={(e) => setEdit((d: any) => ({ ...d, fit: e.target.value }))} /></label>
          <label className="field"><span>{t('الزامات')}</span>
            <input value={edit.requirements} onChange={(e) => setEdit((d: any) => ({ ...d, requirements: e.target.value }))} /></label>
          <label className="field"><span>{t('شواهد توان')}</span>
            <input value={edit.capabilityEvidence} onChange={(e) => setEdit((d: any) => ({ ...d, capabilityEvidence: e.target.value }))} /></label>
          <label className="field"><span>{t('ریسک')}</span>
            <input value={edit.risk} onChange={(e) => setEdit((d: any) => ({ ...d, risk: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('تصمیم شرکت')}</span>
              <select value={edit.decision} onChange={(e) => setEdit((d: any) => ({ ...d, decision: e.target.value }))}>
                {Object.entries(DECISION_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="field"><span>{t('وضعیت ارسال')}</span>
              <select value={edit.submissionStatus} onChange={(e) => setEdit((d: any) => ({ ...d, submissionStatus: e.target.value }))}>
                {Object.entries(SUBMIT_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('اسناد')}</span>
            <input value={edit.documents} onChange={(e) => setEdit((d: any) => ({ ...d, documents: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('نتیجه')}</span>
              <select value={edit.outcome} onChange={(e) => setEdit((d: any) => ({ ...d, outcome: e.target.value }))}>
                {Object.entries(OUTCOME_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="field"><span>{t('درس‌آموخته (برای ثبت نتیجه الزامی)')}</span>
              <input value={edit.lessonsLearned} onChange={(e) => setEdit((d: any) => ({ ...d, lessonsLearned: e.target.value }))} /></label>
          </div>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
