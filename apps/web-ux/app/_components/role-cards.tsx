'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۳ — F15 کارت نقش و ورود همکار (کامپوننت)
   عنوان نقش (از چارت سازمان) · مأموریت · مسئولیت · شایستگی · ارزیابی ·
   مسیر ورود · دسترسی · اهداف ۳۰/۶۰/۹۰ · بازخورد · جانشین · تأیید نهایی
   (قاعدهٔ سرور: تأیید فقط با تکمیل هر سه هدف بازه‌ای + مسیر ورود).
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal } from './page-ui';
import { BadgeCheck, Plus, UserCog, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const EMPTY: any = { title: '', mission: '', responsibilities: '', competencies: '', evaluation: '', onboarding: '', access: '', goals30: '', goals60: '', goals90: '', feedback: '', successor: '' };

export default function RoleCards() {
  const { can } = useWorkspace();
  const writable = can('program.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/role-cards')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { apiGet('/program/settings').then((r: any) => setRoles(r.roles ?? [])).catch(() => {}); }, []);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      if (edit.id) await api(`/role-cards/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) });
      else await api('/role-cards', { method: 'POST', body: JSON.stringify(edit) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }
  async function approve(row: any) {
    setBusy('ap-' + row.id); setError('');
    try {
      await api(`/role-cards/${row.id}`, { method: 'PATCH', body: JSON.stringify({ approved: true }) });
      await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  const withCard = new Set(items.map((x: any) => x.title));
  return (
    <section className="section-card" data-f15>
      <div className="section-head">
        <h2><UserCog size={17} /> {t('کارت نقش و ورود همکار (F15)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('کارت نقش جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<UserCog size={22} />} title={t('کارت نقش ثبت نشده است')}
          description={t('برای هر نقش چارت، کارت نقش با مأموریت، مسیر ورود و اهداف ۳۰/۶۰/۹۰ بسازید.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('نقش (چارت)')}</th><th>{t('مأموریت')}</th><th>{t('مسیر ورود')}</th>
              <th>{t('اهداف ۳۰/۶۰/۹۰')}</th><th>{t('جانشین')}</th><th>{t('تأیید')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-rc={x.id}>
                  <td className="t-primary">{x.title}{!x.inChart ? <Badge tone="danger">{t('خارج از چارت')}</Badge> : null}</td>
                  <td className="t-muted" style={{ maxWidth: 220 }}>{x.mission}</td>
                  <td className="t-muted" style={{ maxWidth: 180 }}>{x.onboarding || '—'}</td>
                  <td>{x.goals30 && x.goals60 && x.goals90 ? <Badge tone="success">{t('کامل')}</Badge> : <span className="chip warning">{t('ناقص')}</span>}</td>
                  <td className="t-muted">{x.successor || '—'}</td>
                  <td>{x.approved
                    ? <Badge tone="success"><BadgeCheck size={11} /> {t('تأییدشده')}</Badge>
                    : writable ? <button className="srip-button" disabled={busy === 'ap-' + x.id} onClick={() => approve(x)}>{t('تأیید نهایی')}</button> : <span className="chip neutral">{t('در انتظار')}</span>}</td>
                  <td>{writable && <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x }); }}>{t('ویرایش')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش کارت نقش') : t('کارت نقش جدید')}
        description={t('تأیید نهایی فقط با تکمیل هر سه هدف ۳۰/۶۰/۹۰ و مسیر ورود باز می‌شود.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="rc-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ کارت نقش')}</button>
        </>}>
        {edit && (<form id="rc-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field"><span>{t('عنوان نقش (از چارت سازمان)')} *</span>
            <select value={edit.title} required onChange={(e) => setEdit((d: any) => ({ ...d, title: e.target.value }))}>
              <option value="">{t('انتخاب کنید…')}</option>
              {roles.map((r: string) => <option key={r} value={r} disabled={edit.id ? false : withCard.has(r)}>{r}{withCard.has(r) && !edit.id ? ` (${t('کارت دارد')})` : ''}</option>)}
            </select></label>
          <label className="field"><span>{t('مأموریت')} *</span>
            <input value={edit.mission} required onChange={(e) => setEdit((d: any) => ({ ...d, mission: e.target.value }))} /></label>
          <label className="field"><span>{t('مسئولیت‌ها')}</span>
            <input value={edit.responsibilities} onChange={(e) => setEdit((d: any) => ({ ...d, responsibilities: e.target.value }))} /></label>
          <label className="field"><span>{t('شایستگی‌ها')}</span>
            <input value={edit.competencies} onChange={(e) => setEdit((d: any) => ({ ...d, competencies: e.target.value }))} /></label>
          <label className="field"><span>{t('ارزیابی')}</span>
            <input value={edit.evaluation} onChange={(e) => setEdit((d: any) => ({ ...d, evaluation: e.target.value }))} /></label>
          <label className="field"><span>{t('مسیر ورود')}</span>
            <input value={edit.onboarding} onChange={(e) => setEdit((d: any) => ({ ...d, onboarding: e.target.value }))} /></label>
          <label className="field"><span>{t('دسترسی')}</span>
            <input value={edit.access} onChange={(e) => setEdit((d: any) => ({ ...d, access: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('هدف ۳۰ روزه')}</span>
              <input value={edit.goals30} onChange={(e) => setEdit((d: any) => ({ ...d, goals30: e.target.value }))} /></label>
            <label className="field"><span>{t('هدف ۶۰ روزه')}</span>
              <input value={edit.goals60} onChange={(e) => setEdit((d: any) => ({ ...d, goals60: e.target.value }))} /></label>
          </div>
          <label className="field"><span>{t('هدف ۹۰ روزه')}</span>
            <input value={edit.goals90} onChange={(e) => setEdit((d: any) => ({ ...d, goals90: e.target.value }))} /></label>
          <label className="field"><span>{t('بازخورد')}</span>
            <input value={edit.feedback} onChange={(e) => setEdit((d: any) => ({ ...d, feedback: e.target.value }))} /></label>
          <label className="field"><span>{t('جانشین')}</span>
            <input value={edit.successor} onChange={(e) => setEdit((d: any) => ({ ...d, successor: e.target.value }))} /></label>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
