'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۲ — F18 کارت آماده‌سازی ورود به بازار (کامپوننت)
   محصول · وضعیت DD (زنده از پروندهٔ متصل) · مشتری ایدئال · ارزش پیشنهادی ·
   بسته‌بندی · قیمت‌گذاری · کانال · شریک · اجرای آزمایشی · شواهد مشتری · تصمیم
   (قاعدهٔ سرور: تصمیم GO فقط با پروندهٔ DD متصلِ تصویب‌شده).
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { Plus, Rocket, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const DECISION_FA: Record<string, string> = { PENDING: t('در انتظار'), PILOT: t('اجرای آزمایشی'), GO: t('ورود (GO)'), NO_GO: t('ورود نمی‌کنیم') };
const DECISION_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = { PENDING: 'neutral', PILOT: 'warning', GO: 'success', NO_GO: 'danger' };

const EMPTY: any = { product: '', dossierId: '', idealCustomer: '', valueProp: '', packaging: '', pricing: '', channels: '', partner: '', pilot: '', customerEvidence: '', decision: 'PENDING' };

export default function GtmCards() {
  const { can } = useWorkspace();
  const writable = can('opportunity.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [dossiers, setDossiers] = useState<any[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/gtm-cards')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); apiGet('/dossiers').then((r: any) => setDossiers(r.items ?? [])).catch(() => {}); }, [reload]);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      const payload = { ...edit, dossierId: edit.dossierId || null };
      if (edit.id) await api(`/gtm-cards/${edit.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/gtm-cards', { method: 'POST', body: JSON.stringify(payload) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f18>
      <div className="section-head">
        <h2><Rocket size={17} /> {t('کارت‌های ورود به بازار (F18)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('کارت ورود جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<Rocket size={22} />} title={t('کارت ورود به بازار ثبت نشده است')}
          description={t('برای هر محصولِ در آستانهٔ ورود، کارت با مشتری ایدئال، قیمت‌گذاری، کانال و اجرای آزمایشی بسازید.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('محصول')}</th><th>{t('وضعیت DD (زنده)')}</th><th>{t('مشتری ایدئال')}</th>
              <th>{t('قیمت‌گذاری')}</th><th>{t('کانال')}</th><th>{t('تصمیم')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-gtm={x.id}>
                  <td className="t-primary" style={{ maxWidth: 220 }}>{x.product}{x.partner ? <small className="muted" style={{ display: 'block' }}>{t('شریک')}: {x.partner}</small> : null}</td>
                  <td>{x.ddStatus
                    ? <span className={`chip ${x.ddStatus.status === 'APPROVED' ? 'success' : 'neutral'}`}>{x.ddStatusFa}</span>
                    : <span className="chip neutral">{t('بدون پروندهٔ DD')}</span>}</td>
                  <td className="t-muted" style={{ maxWidth: 190 }}>{x.idealCustomer || '—'}</td>
                  <td className="t-muted" style={{ maxWidth: 160 }}>{x.pricing || '—'}</td>
                  <td className="t-muted" style={{ maxWidth: 150 }}>{x.channels || '—'}</td>
                  <td><StatusBadge tone={DECISION_TONE[x.decision]}>{x.decisionFa}</StatusBadge></td>
                  <td>{writable && <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x, dossierId: x.dossierId ?? '' }); }}>{t('ویرایش')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش کارت ورود به بازار') : t('کارت ورود جدید')}
        description={t('تصمیم ورود (GO) فقط با پروندهٔ DD متصلِ تصویب‌شده باز می‌شود.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="gtm-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ کارت ورود')}</button>
        </>}>
        {edit && (<form id="gtm-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field"><span>{t('محصول')} *</span>
            <input value={edit.product} required minLength={3} onChange={(e) => setEdit((d: any) => ({ ...d, product: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('پروندهٔ DD متصل')}</span>
              <select value={edit.dossierId ?? ''} onChange={(e) => setEdit((d: any) => ({ ...d, dossierId: e.target.value }))}>
                <option value="">{t('بدون پروندهٔ DD')}</option>
                {dossiers.map((d: any) => <option key={d.id} value={d.id}>{d.subjectName} — {d.statusFa}</option>)}
              </select></label>
            <label className="field"><span>{t('تصمیم ورود')}</span>
              <select value={edit.decision} onChange={(e) => setEdit((d: any) => ({ ...d, decision: e.target.value }))}>
                {Object.entries(DECISION_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('مشتری ایدئال')}</span>
            <input value={edit.idealCustomer} onChange={(e) => setEdit((d: any) => ({ ...d, idealCustomer: e.target.value }))} /></label>
          <label className="field"><span>{t('ارزش پیشنهادی')}</span>
            <input value={edit.valueProp} onChange={(e) => setEdit((d: any) => ({ ...d, valueProp: e.target.value }))} /></label>
          <label className="field"><span>{t('بسته‌بندی')}</span>
            <input value={edit.packaging} onChange={(e) => setEdit((d: any) => ({ ...d, packaging: e.target.value }))} /></label>
          <label className="field"><span>{t('قیمت‌گذاری')}</span>
            <input value={edit.pricing} onChange={(e) => setEdit((d: any) => ({ ...d, pricing: e.target.value }))} /></label>
          <label className="field"><span>{t('کانال')}</span>
            <input value={edit.channels} onChange={(e) => setEdit((d: any) => ({ ...d, channels: e.target.value }))} /></label>
          <label className="field"><span>{t('شریک')}</span>
            <input value={edit.partner} onChange={(e) => setEdit((d: any) => ({ ...d, partner: e.target.value }))} /></label>
          <label className="field"><span>{t('اجرای آزمایشی')}</span>
            <input value={edit.pilot} onChange={(e) => setEdit((d: any) => ({ ...d, pilot: e.target.value }))} /></label>
          <label className="field"><span>{t('شواهد مشتری')}</span>
            <input value={edit.customerEvidence} onChange={(e) => setEdit((d: any) => ({ ...d, customerEvidence: e.target.value }))} /></label>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
