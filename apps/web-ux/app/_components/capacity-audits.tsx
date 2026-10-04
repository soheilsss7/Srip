'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۴ — F03 برگهٔ ممیزی ظرفیت و دارایی (کامپوننت)
   گسترش ممیزی سه‌گانه به «فرد یا دارایی»: سطح بلوغ · دسترسی · وابستگی ·
   شاهد · شکاف · ریسک · اقدام
   (قواعد سرور: بلوغ «پیشرفته» نیازمند شاهد؛ ریسک «بالا» نیازمند اقدام.)
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { Boxes, Plus, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const KIND_FA: Record<string, string> = { PERSON: t('فرد'), ASSET: t('دارایی') };
const MATURITY_FA: Record<string, string> = { BASIC: t('پایه'), GOOD: t('خوب'), ADVANCED: t('پیشرفته') };
const MATURITY_TONE: Record<string, 'neutral' | 'warning' | 'success'> = { BASIC: 'neutral', GOOD: 'warning', ADVANCED: 'success' };
const RISK_FA: Record<string, string> = { LOW: t('کم'), MEDIUM: t('متوسط'), HIGH: t('بالا') };
const RISK_TONE: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

const EMPTY: any = { kind: 'ASSET', subject: '', maturity: 'BASIC', access: '', dependency: '', evidence: '', gap: '', risk: 'LOW', action: '' };

export default function CapacityAudits() {
  const { can } = useWorkspace();
  const writable = can('program.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/program/capacity-audits')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      if (edit.id) await api(`/program/capacity-audits/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) });
      else await api('/program/capacity-audits', { method: 'POST', body: JSON.stringify(edit) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f03 style={{ marginTop: 14 }}>
      <div className="section-head">
        <h2><Boxes size={17} /> {t('ممیزی ظرفیت و دارایی (F03)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('برگهٔ ممیزی جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<Boxes size={22} />} title={t('برگهٔ ممیزی ظرفیت ثبت نشده است')}
          description={t('ممیزی سه‌گانه را به فرد یا دارایی کلیدی گسترش دهید — بلوغ، وابستگی و ریسک هر قلم.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('موضوع')}</th><th>{t('سطح بلوغ')}</th><th>{t('وابستگی')}</th>
              <th>{t('شکاف')}</th><th>{t('ریسک')}</th><th>{t('اقدام')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-ca={x.id}>
                  <td className="t-primary">{x.subject}<Badge tone={x.kind === 'PERSON' ? 'info' : 'neutral'}>{x.kindFa}</Badge></td>
                  <td><StatusBadge tone={MATURITY_TONE[x.maturity]}>{x.maturityFa}</StatusBadge></td>
                  <td className="t-muted" style={{ maxWidth: 180 }}>{x.dependency || '—'}</td>
                  <td className="t-muted" style={{ maxWidth: 180 }}>{x.gap || '—'}</td>
                  <td><StatusBadge tone={RISK_TONE[x.risk]}>{x.riskFa}</StatusBadge></td>
                  <td className="t-muted" style={{ maxWidth: 200 }}>{x.action || '—'}</td>
                  <td>{writable && <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x }); }}>{t('ویرایش')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش برگهٔ ممیزی ظرفیت') : t('برگهٔ ممیزی جدید')}
        description={t('بلوغ «پیشرفته» نیازمند شاهد است و ریسک «بالا» نیازمند اقدام.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="ca-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ برگهٔ ممیزی')}</button>
        </>}>
        {edit && (<form id="ca-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field-pair">
            <label className="field"><span>{t('موضوع ممیزی')} *</span>
              <select value={edit.kind} onChange={(e) => setEdit((d: any) => ({ ...d, kind: e.target.value }))}>
                {Object.entries(KIND_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="field"><span>{t('نام فرد یا دارایی')} *</span>
              <input value={edit.subject} required onChange={(e) => setEdit((d: any) => ({ ...d, subject: e.target.value }))} /></label>
          </div>
          <div className="field-pair">
            <label className="field"><span>{t('سطح بلوغ')}</span>
              <select value={edit.maturity} onChange={(e) => setEdit((d: any) => ({ ...d, maturity: e.target.value }))}>
                {Object.entries(MATURITY_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="field"><span>{t('ریسک')}</span>
              <select value={edit.risk} onChange={(e) => setEdit((d: any) => ({ ...d, risk: e.target.value }))}>
                {Object.entries(RISK_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('دسترسی')}</span>
            <input value={edit.access} onChange={(e) => setEdit((d: any) => ({ ...d, access: e.target.value }))} /></label>
          <label className="field"><span>{t('وابستگی')}</span>
            <input value={edit.dependency} onChange={(e) => setEdit((d: any) => ({ ...d, dependency: e.target.value }))} /></label>
          <label className="field"><span>{t('شاهد')}</span>
            <input value={edit.evidence} onChange={(e) => setEdit((d: any) => ({ ...d, evidence: e.target.value }))} /></label>
          <label className="field"><span>{t('شکاف')}</span>
            <input value={edit.gap} onChange={(e) => setEdit((d: any) => ({ ...d, gap: e.target.value }))} /></label>
          <label className="field"><span>{t('اقدام')}</span>
            <input value={edit.action} onChange={(e) => setEdit((d: any) => ({ ...d, action: e.target.value }))} /></label>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
