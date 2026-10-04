'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۳ — F01 کنترل اجرا (کامپوننت)
   هدف · دامنه · خارج از محدوده · مالک · ذی‌نفع · وابستگی · تصمیم · اقدام ·
   مانع · تغییر · مهلت · وضعیت — برای پروژه‌های متصل.
   (قاعدهٔ سرور: «بلاک» نیازمند مانع؛ «تکمیل» نیازمند تصمیم نهایی.)
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { ClipboardList, Plus, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const STATUS_FA: Record<string, string> = { ON_TRACK: t('در مسیر'), AT_RISK: t('در معرض ریسک'), BLOCKED: t('بلاک'), DONE: t('تکمیل') };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { ON_TRACK: 'success', AT_RISK: 'warning', BLOCKED: 'danger', DONE: 'neutral' };

const EMPTY: any = { projectId: '', goal: '', scope: '', outOfScope: '', ownerRole: '', stakeholders: '', dependencies: '', decision: '', nextAction: '', blocker: '', scopeChange: '', deadline: '', status: 'ON_TRACK' };

export default function ExecControls() {
  const { can } = useWorkspace();
  const writable = can('project.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGet('/exec-controls')); }
    catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (can('project.read')) apiGet('/projects').then((r: any) => setProjects(Array.isArray(r) ? r : r.items ?? [])).catch(() => {});
    apiGet('/program/settings').then((r: any) => setRoles(r.roles ?? [])).catch(() => {});
  }, [can]);

  async function submit() {
    setBusy('save'); setFormError('');
    try {
      if (edit.id) await api(`/exec-controls/${edit.id}`, { method: 'PATCH', body: JSON.stringify(edit) });
      else await api('/exec-controls', { method: 'POST', body: JSON.stringify(edit) });
      setEdit(null); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  return (
    <section className="section-card" data-f01>
      <div className="section-head">
        <h2><ClipboardList size={17} /> {t('کنترل اجرا (F01)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setEdit({ ...EMPTY }); }}><Plus size={14} /> {t('کنترل اجرای جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<ClipboardList size={22} />} title={t('کنترل اجرا ثبت نشده است')}
          description={t('برای هر پروژه، کنترل اجرا با هدف، دامنه، ذی‌نفع و وابستگی باز کنید.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('کد/پروژه')}</th><th>{t('هدف')}</th><th>{t('مالک')}</th><th>{t('مهلت')}</th>
              <th>{t('تغییر دامنه')}</th><th>{t('وضعیت')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((x: any) => (
                <tr key={x.id} data-ec={x.id}>
                  <td className="t-primary">{x.code} · {x.projectName}</td>
                  <td className="t-muted" style={{ maxWidth: 240 }}>{x.goal}</td>
                  <td>{x.ownerRole}</td>
                  <td className="t-muted">{String(x.deadline ?? '').slice(0, 10)}</td>
                  <td>{x.scopeChange ? <span className="chip warning" title={x.scopeChange}>{t('ثبت شد')}</span> : <span className="chip neutral">{t('ندارد')}</span>}</td>
                  <td><StatusBadge tone={STATUS_TONE[x.status]}>{x.statusFa}</StatusBadge>{x.blocker ? <span className="chip danger" style={{ marginInlineStart: 4 }} title={x.blocker}>{t('مانع')}</span> : null}</td>
                  <td>{writable && <button className="srip-button" onClick={() => { setFormError(''); setEdit({ ...x }); }}>{t('ویرایش')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} title={edit?.id ? t('ویرایش کنترل اجرا') : t('کنترل اجرای جدید')}
        description={t('وضعیت «بلاک» نیازمند ثبت مانع و «تکمیل» نیازمند تصمیم نهایی است.')}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="srip-button" onClick={() => setEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="ec-form" className="srip-button primary" disabled={busy === 'save'}>{busy === 'save' ? t('در حال ذخیره…') : t('ذخیرهٔ کنترل اجرا')}</button>
        </>}>
        {edit && (<form id="ec-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field-pair">
            <label className="field"><span>{t('پروژهٔ متصل')} *</span>
              <select value={edit.projectId} required onChange={(e) => setEdit((d: any) => ({ ...d, projectId: e.target.value }))}>
                <option value="">{t('انتخاب کنید…')}</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
            <label className="field"><span>{t('مالک کنترل اجرا')} *</span>
              <select value={edit.ownerRole} required onChange={(e) => setEdit((d: any) => ({ ...d, ownerRole: e.target.value }))}>
                <option value="">{t('انتخاب کنید…')}</option>
                {roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('هدف')} *</span>
            <input value={edit.goal} required onChange={(e) => setEdit((d: any) => ({ ...d, goal: e.target.value }))} /></label>
          <label className="field"><span>{t('دامنه')} *</span>
            <input value={edit.scope} required onChange={(e) => setEdit((d: any) => ({ ...d, scope: e.target.value }))} /></label>
          <label className="field"><span>{t('خارج از محدوده')}</span>
            <input value={edit.outOfScope} onChange={(e) => setEdit((d: any) => ({ ...d, outOfScope: e.target.value }))} /></label>
          <label className="field"><span>{t('ذی‌نفعان')}</span>
            <input value={edit.stakeholders} onChange={(e) => setEdit((d: any) => ({ ...d, stakeholders: e.target.value }))} /></label>
          <label className="field"><span>{t('وابستگی‌ها')}</span>
            <input value={edit.dependencies} onChange={(e) => setEdit((d: any) => ({ ...d, dependencies: e.target.value }))} /></label>
          <label className="field"><span>{t('تصمیم (آخرین)')}</span>
            <input value={edit.decision} onChange={(e) => setEdit((d: any) => ({ ...d, decision: e.target.value }))} /></label>
          <label className="field"><span>{t('اقدام بعدی')}</span>
            <input value={edit.nextAction} onChange={(e) => setEdit((d: any) => ({ ...d, nextAction: e.target.value }))} /></label>
          <label className="field"><span>{t('مانع')}</span>
            <input value={edit.blocker} onChange={(e) => setEdit((d: any) => ({ ...d, blocker: e.target.value }))} /></label>
          <label className="field"><span>{t('تغییر دامنه/برنامه')}</span>
            <input value={edit.scopeChange} onChange={(e) => setEdit((d: any) => ({ ...d, scopeChange: e.target.value }))} /></label>
          <div className="field-pair">
            <label className="field"><span>{t('مهلت')} *</span>
              <input type="date" value={String(edit.deadline ?? '').slice(0, 10)} required onChange={(e) => setEdit((d: any) => ({ ...d, deadline: e.target.value }))} /></label>
            <label className="field"><span>{t('وضعیت')}</span>
              <select value={edit.status} onChange={(e) => setEdit((d: any) => ({ ...d, status: e.target.value }))}>
                {Object.entries(STATUS_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          </div>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>)}
      </Modal>
    </section>
  );
}
