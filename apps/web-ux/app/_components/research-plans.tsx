'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۴ — F07 طرح پژوهش و داوری (کامپوننت)
   پرسش · دامنه · روش · نمونه · منابع · محدودیت · تعارض · داور اول · داور دوم ·
   اصلاحات · نسخه — حلقهٔ ۱۵.۳: انتشار فقط با تأیید دو داور مستقل.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { faNum } from '../_lib/jalali';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { BookOpenCheck, FlaskConical, Plus, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const STATUS_FA: Record<string, string> = { DRAFT: t('پیش‌نویس'), IN_REVIEW: t('در داوری'), PUBLISHED: t('منتشرشده') };
const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success'> = { DRAFT: 'neutral', IN_REVIEW: 'warning', PUBLISHED: 'success' };
const VERDICT_FA: Record<string, string> = { PENDING: t('در انتظار'), APPROVE: t('تأیید'), REVISE: t('اصلاح') };
const VERDICT_TONE: Record<string, 'neutral' | 'success' | 'warning'> = { PENDING: 'neutral', APPROVE: 'success', REVISE: 'warning' };

const EMPTY: any = { question: '', scope: '', method: '', sample: '', sources: '', limitations: '', conflicts: '', reviewer1: '', reviewer2: '', revisions: '' };

export default function ResearchPlans() {
  const { can } = useWorkspace();
  const writable = can('strategy.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/research-plans')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      if (edit.id) await api(`/research-plans/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) });
      else await api('/research-plans', { method: 'POST', body: JSON.stringify(edit) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }
  async function verdict(row: any, reviewer: '1' | '2', v: string) {
    setBusy(`v${reviewer}-${row.id}`); setError('');
    try {
      await api(`/research-plans/${row.id}`, { method: 'POST', body: JSON.stringify({ action: 'verdict', reviewer, verdict: v }) });
      await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function publish(row: any) {
    setBusy('pb-' + row.id); setError('');
    try {
      await api(`/research-plans/${row.id}`, { method: 'POST', body: JSON.stringify({ action: 'publish' }) });
      await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f07 style={{ marginTop: 14 }}>
      <div className="section-head">
        <h2><FlaskConical size={17} /> {t('طرح پژوهش و داوری (F07)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('طرح پژوهش جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<FlaskConical size={22} />} title={t('طرح پژوهش ثبت نشده است')}
          description={t('هر طرح با پرسش، روش و دو داور مستقل — انتشار فقط با تأیید هر دو (حلقهٔ ۱۵.۳).')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('پرسش پژوهش')}</th><th>{t('دامنه')}</th><th>{t('داور اول')}</th>
              <th>{t('داور دوم')}</th><th>{t('نسخه')}</th><th>{t('وضعیت')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-res={x.id}>
                  <td className="t-primary" style={{ maxWidth: 280 }}>{x.question}</td>
                  <td className="t-muted" style={{ maxWidth: 160 }}>{x.scope}</td>
                  <td>{x.reviewer1 ? <><span style={{ display: 'block' }}>{x.reviewer1}</span><Badge tone={VERDICT_TONE[x.rev1Verdict]}>{x.rev1Fa}</Badge></> : '—'}</td>
                  <td>{x.reviewer2 ? <><span style={{ display: 'block' }}>{x.reviewer2}</span><Badge tone={VERDICT_TONE[x.rev2Verdict]}>{x.rev2Fa}</Badge></> : '—'}</td>
                  <td><span className="chip">v{faNum(x.version)}</span></td>
                  <td><StatusBadge tone={STATUS_TONE[x.status]}>{x.statusFa}</StatusBadge></td>
                  <td>
                    {writable && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {x.reviewer1 && x.rev1Verdict !== 'APPROVE' && x.status !== 'PUBLISHED' && <button className="srip-button" disabled={busy === 'v1-' + x.id} onClick={() => verdict(x, '1', 'APPROVE')}>{t('رأی داور ۱: تأیید')}</button>}
                      {x.reviewer2 && x.rev2Verdict !== 'APPROVE' && x.status !== 'PUBLISHED' && <button className="srip-button" disabled={busy === 'v2-' + x.id} onClick={() => verdict(x, '2', 'APPROVE')}>{t('رأی داور ۲: تأیید')}</button>}
                      {x.status !== 'PUBLISHED' && <button className="srip-button primary" disabled={busy === 'pb-' + x.id} onClick={() => publish(x)}><BookOpenCheck size={12} /> {t('انتشار')}</button>}
                      <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x }); }}>{t('ویرایش')}</button>
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش طرح پژوهش') : t('طرح پژوهش جدید')}
        description={t('انتشار فقط با تأیید هر دو داور مستقل (حلقهٔ ۱۵.۳)؛ ثبت اصلاحات، نسخه را یک واحد بالا می‌برد.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="res-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ طرح پژوهش')}</button>
        </>}>
        {edit && (<form id="res-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field"><span>{t('پرسش پژوهش (با «؟»)')} *</span>
            <input value={edit.question} required onChange={(e) => setEdit((d: any) => ({ ...d, question: e.target.value }))} placeholder={t('مثلاً: اثر شفافیت بر اعتماد ذی‌نفعان چیست؟')} /></label>
          <label className="field"><span>{t('دامنه')} *</span>
            <input value={edit.scope} required onChange={(e) => setEdit((d: any) => ({ ...d, scope: e.target.value }))} /></label>
          <label className="field"><span>{t('روش')} *</span>
            <input value={edit.method} required onChange={(e) => setEdit((d: any) => ({ ...d, method: e.target.value }))} /></label>
          <label className="field"><span>{t('نمونه')}</span>
            <input value={edit.sample} onChange={(e) => setEdit((d: any) => ({ ...d, sample: e.target.value }))} /></label>
          <label className="field"><span>{t('منابع')}</span>
            <input value={edit.sources} onChange={(e) => setEdit((d: any) => ({ ...d, sources: e.target.value }))} /></label>
          <label className="field"><span>{t('محدودیت‌ها')}</span>
            <input value={edit.limitations} onChange={(e) => setEdit((d: any) => ({ ...d, limitations: e.target.value }))} /></label>
          <label className="field"><span>{t('تعارض‌ها')}</span>
            <input value={edit.conflicts} onChange={(e) => setEdit((d: any) => ({ ...d, conflicts: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('داور اول (مستقل)')}</span>
              <input value={edit.reviewer1} onChange={(e) => setEdit((d: any) => ({ ...d, reviewer1: e.target.value }))} /></label>
            <label className="field"><span>{t('داور دوم (مستقل)')}</span>
              <input value={edit.reviewer2} onChange={(e) => setEdit((d: any) => ({ ...d, reviewer2: e.target.value }))} /></label>
          </div>
          <label className="field"><span>{t('اصلاحات (ثبت = نسخهٔ بعدی)')}</span>
            <input value={edit.revisions} onChange={(e) => setEdit((d: any) => ({ ...d, revisions: e.target.value }))} /></label>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
