'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   گام ۱۰.۱ — F02 پروندهٔ Due Diligence (کامپوننت)
   دوازده محور استاندارد ۶.۲.۱ (فنی) و ۶.۲.۲ (کسب‌وکاری) با پاسخ/شاهد/نقص ·
   حق پاسخ طرف مقابل · نظر مدیر تیم Y · وضعیت تصویب G2
   (شرط سرور: تصویب فقط با پذیرش همهٔ محورها + نظر تیم Y).
   ═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet, unwrapList } from '../_lib/api';
import { faNum } from '../_lib/jalali';
import { t } from '../_lib/i18n';
import { Badge, EmptyV4, ErrorCard, Loading, Modal, StatusBadge } from './page-ui';
import { ClipboardCheck, FileSearch, Plus, ShieldCheck, X } from 'lucide-react';
import { useWorkspace } from './workspace';

const AX_STATUS_FA: Record<string, string> = { NOT_STARTED: t('شروع‌نشده'), IN_PROGRESS: t('در جریان'), ACCEPTED: t('پذیرفته‌شده') };
const AX_TONE: Record<string, 'success' | 'warning' | 'neutral'> = { NOT_STARTED: 'neutral', IN_PROGRESS: 'warning', ACCEPTED: 'success' };
const STATUS_FA: Record<string, string> = { DRAFT: t('پیش‌نویس'), IN_REVIEW: t('در بررسی'), APPROVED: t('تصویب‌شده'), REJECTED: t('ردشده') };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { DRAFT: 'neutral', IN_REVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger' };
const OPINION_FA: Record<string, string> = { APPROVE: t('تأیید'), CONDITIONS: t('مشروط'), REJECT: t('رد') };

export default function DdDossiers() {
  const { can } = useWorkspace();
  const writable = can('partnership.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [orgs, setOrgs] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState({ subjectOrgId: '', ownerRole: '' });
  const [axisDraft, setAxisDraft] = useState<Record<string, any>>({});
  const [respDraft, setRespDraft] = useState<Record<string, string>>({});
  const [tyDraft, setTyDraft] = useState<any>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await apiGet('/dossiers');
      setData(r);
      setDetail((d: any) => d ? (r.items ?? []).find((x: any) => x.id === d.id) ?? d : d);
    } catch (x) { setError((x as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); apiGet('/organizations').then((r: any) => setOrgs(unwrapList(r))).catch(() => {}); }, [reload]);
  useEffect(() => { apiGet('/partnerships').then((r: any) => setRoles(r.roles ?? [])).catch(() => {}); }, []);

  async function submit() {
    setBusy('create'); setFormError('');
    try {
      const r: any = await api('/dossiers', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false); setForm({ subjectOrgId: '', ownerRole: '' }); setDetail(r); await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  }
  async function saveAxis(key: string) {
    const d = axisDraft[key]; if (!d) return;
    setBusy('ax-' + key); setError('');
    try {
      const r: any = await api(`/dossiers/${detail.id}/axes/${key}`, { method: 'PATCH', body: JSON.stringify(d) });
      setDetail(r); setAxisDraft((s) => { const n = { ...s }; delete n[key]; return n; }); await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function respondAxis(key: string) {
    const resp = respDraft[key]; if (!resp?.trim()) return;
    setBusy('resp-' + key); setError('');
    try {
      const r: any = await api(`/dossiers/${detail.id}/axes/${key}`, { method: 'POST', body: JSON.stringify({ response: resp }) });
      setDetail(r); setRespDraft((s) => { const n = { ...s }; delete n[key]; return n; }); await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function saveTeamY() {
    if (!tyDraft?.opinion || !tyDraft?.note?.trim()) return;
    setBusy('ty'); setError('');
    try {
      const r: any = await api(`/dossiers/${detail.id}/team-y`, { method: 'POST', body: JSON.stringify(tyDraft) });
      setDetail(r); setTyDraft(null); await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function decide(decision: 'APPROVED' | 'REJECTED') {
    setBusy('dec'); setError('');
    try {
      const r: any = await api(`/dossiers/${detail.id}/approval`, { method: 'POST', body: JSON.stringify({ decision }) });
      setDetail(r); await reload();
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const items = data?.items ?? [];
  const cats = ['621', '622'];

  return (
    <section className="section-card" data-f02>
      <div className="section-head">
        <h2><FileSearch size={17} /> {t('پرونده‌های Due Diligence (F02)')}</h2>
        {writable && <button className="srip-button primary" onClick={() => { setFormError(''); setCreateOpen(true); }}><Plus size={14} /> {t('پروندهٔ DD جدید')}</button>}
      </div>
      <p className="section-desc">{data?.rule}</p>
      <ErrorCard message={error} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyV4 icon={<FileSearch size={22} />} title={t('پروندهٔ DD ثبت نشده است')}
          description={t('برای هر سرمایه‌گذار یا شریک، پروندهٔ بررسی با دوازده محور ۶.۲.۱ و ۶.۲.۲ باز کنید.')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('موضوع بررسی')}</th><th>{t('مالک')}</th><th>{t('محورهای پذیرفته‌شده')}</th>
              <th>{t('نظر مدیر تیم Y')}</th><th>{t('وضعیت تصویب (G2)')}</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((d: any) => (
                <tr key={d.id} className="row-click" onClick={() => { setDetail(d); setAxisDraft({}); setRespDraft({}); setTyDraft(null); }}>
                  <td className="t-primary">{d.subjectName}</td>
                  <td>{d.ownerRole}</td>
                  <td>{faNum(d.acceptedAxes)} / {faNum(d.totalAxes)}{d.ddComplete ? <span className="chip success" style={{ marginInlineStart: 6 }}>{t('تکمیل')}</span> : null}</td>
                  <td>{d.teamY ? <Badge tone={d.teamY.opinion === 'APPROVE' ? 'success' : d.teamY.opinion === 'CONDITIONS' ? 'warning' : 'danger'}>{OPINION_FA[d.teamY.opinion]}</Badge> : <span className="chip neutral">{t('ثبت نشده')}</span>}</td>
                  <td><StatusBadge tone={STATUS_TONE[d.status]}>{STATUS_FA[d.status]}</StatusBadge></td>
                  <td><button className="srip-button" onClick={(e) => { e.stopPropagation(); setDetail(d); setAxisDraft({}); setRespDraft({}); setTyDraft(null); }}>{t('محورها')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* جزئیات پرونده: محورها + حق پاسخ + تیم Y + تصویب */}
      <Modal open={!!detail} title={`${t('پروندهٔ Due Diligence')} — ${detail?.subjectName ?? ''}`}
        description={detail ? `${t('مالک')}: ${detail.ownerRole} · ${faNum(detail.acceptedAxes)}/${faNum(detail.totalAxes)} ${t('محور پذیرفته‌شده')}` : undefined}
        onClose={() => setDetail(null)}>
        {detail && (<div className="list">
          {cats.map(cat => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="section-head"><h3>{cat === '621' ? t('محورهای ۶.۲.۱ — فنی و محصول') : t('محورهای ۶.۲.۲ — کسب‌وکار')}</h3></div>
              {(detail.axes ?? []).filter((a: any) => a.cat === cat).map((a: any) => (
                <details key={a.key} className="axis-row" data-axis={a.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                  <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{a.title}</strong>
                    <StatusBadge tone={AX_TONE[a.status]}>{a.statusFa}</StatusBadge>
                    {a.gap ? <span className="chip warning">{t('نقص')}</span> : null}
                    {a.response ? <span className="chip info">{t('حق پاسخ')}</span> : null}
                  </summary>
                  <div className="form-grid" style={{ marginTop: 8 }}>
                    <label className="field"><span>{t('پاسخ')}</span>
                      <input value={axisDraft[a.key]?.answer ?? a.answer ?? ''} disabled={!writable}
                        onChange={(e) => setAxisDraft((s) => ({ ...s, [a.key]: { ...s[a.key], answer: e.target.value } }))} /></label>
                    <label className="field"><span>{t('شاهد')}</span>
                      <input value={axisDraft[a.key]?.evidence ?? a.evidence ?? ''} disabled={!writable}
                        onChange={(e) => setAxisDraft((s) => ({ ...s, [a.key]: { ...s[a.key], evidence: e.target.value } }))} /></label>
                    <label className="field"><span>{t('نقص')}</span>
                      <input value={axisDraft[a.key]?.gap ?? a.gap ?? ''} disabled={!writable}
                        onChange={(e) => setAxisDraft((s) => ({ ...s, [a.key]: { ...s[a.key], gap: e.target.value } }))} /></label>
                    <label className="field"><span>{t('وضعیت محور')}</span>
                      <select value={axisDraft[a.key]?.status ?? a.status ?? 'NOT_STARTED'} disabled={!writable}
                        onChange={(e) => setAxisDraft((s) => ({ ...s, [a.key]: { ...s[a.key], status: e.target.value } }))}>
                        {Object.entries(AX_STATUS_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select></label>
                    {writable && <div className="field">
                      <button className="srip-button primary" disabled={!axisDraft[a.key] || busy === 'ax-' + a.key} onClick={() => saveAxis(a.key)}>{busy === 'ax-' + a.key ? t('…') : t('ذخیرهٔ محور')}</button>
                    </div>}
                  </div>
                  {a.response && <div style={{ marginTop: 6 }}><b>{t('پاسخ طرف مقابل (حق پاسخ)')}</b><p style={{ margin: '4px 0' }}>{a.response}</p></div>}
                  {writable && (<div className="field" style={{ marginTop: 6 }}>
                    <span>{t('ثبت پاسخ طرف مقابل')}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={respDraft[a.key] ?? ''} placeholder={t('پاسخ شریک/سرمایه‌گذار به یافتهٔ این محور…')}
                        onChange={(e) => setRespDraft((s) => ({ ...s, [a.key]: e.target.value }))} />
                      <button className="srip-button" disabled={!respDraft[a.key]?.trim() || busy === 'resp-' + a.key} onClick={() => respondAxis(a.key)}>{t('ثبت پاسخ')}</button>
                    </div>
                  </div>)}
                </details>
              ))}
            </div>
          ))}

          {/* نظر مدیر تیم Y */}
          <div className="section-head"><h3><ShieldCheck size={15} /> {t('نظر مدیر تیم Y')}</h3></div>
          {detail.teamY ? (
            <div className="detail-grid">
              <div><b>{t('نظر')}</b><p><Badge tone={detail.teamY.opinion === 'APPROVE' ? 'success' : detail.teamY.opinion === 'CONDITIONS' ? 'warning' : 'danger'}>{OPINION_FA[detail.teamY.opinion]}</Badge></p></div>
              <div><b>{t('یادداشت')}</b><p>{detail.teamY.note}</p></div>
              <div><b>{t('ثبت‌کننده')}</b><p>{detail.teamY.by}</p></div>
            </div>
          ) : writable ? (
            <div className="form-grid">
              <label className="field"><span>{t('نظر')}</span>
                <select value={tyDraft?.opinion ?? ''} onChange={(e) => setTyDraft((d: any) => ({ ...d, opinion: e.target.value }))}>
                  <option value="">—</option>
                  {Object.entries(OPINION_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <label className="field"><span>{t('یادداشت (الزامی)')}</span>
                <input value={tyDraft?.note ?? ''} onChange={(e) => setTyDraft((d: any) => ({ ...d, note: e.target.value }))} /></label>
              <div className="field"><button className="srip-button primary" disabled={!tyDraft?.opinion || !tyDraft?.note?.trim() || busy === 'ty'} onClick={saveTeamY}>{busy === 'ty' ? t('…') : t('ثبت نظر تیم Y')}</button></div>
            </div>
          ) : <p className="muted">{t('ثبت نشده')}</p>}

          {/* وضعیت تصویب G2 */}
          <div className="section-head"><h3><ClipboardCheck size={15} /> {t('وضعیت تصویب (G2)')}</h3></div>
          <p className="muted">{t('شرط تصویب: پذیرش همهٔ محورها + ثبت نظر مدیر تیم Y — دروازهٔ G2 سند v14.')}</p>
          {writable && detail.status !== 'APPROVED' && (<div style={{ display: 'flex', gap: 8 }}>
            <button className="srip-button primary" disabled={busy === 'dec'} onClick={() => decide('APPROVED')}>{t('تصویب پرونده')}</button>
            <button className="srip-button" disabled={busy === 'dec'} onClick={() => decide('REJECTED')}>{t('رد پرونده')}</button>
          </div>)}
        </div>)}
      </Modal>

      {/* ایجاد پروندهٔ DD */}
      <Modal open={createOpen} title={t('پروندهٔ DD جدید')} onClose={() => setCreateOpen(false)}
        description={t('دوازده محور استاندارد ۶.۲.۱ و ۶.۲.۲ به‌صورت خودکار باز می‌شوند.')}
        footer={<>
          <button className="srip-button" onClick={() => setCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="dd-create-form" className="srip-button primary" disabled={busy === 'create'}>{busy === 'create' ? t('در حال ذخیره…') : t('باز کردن پرونده')}</button>
        </>}>
        <form id="dd-create-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="field"><span>{t('سازمان موضوع بررسی (سرمایه‌گذار/شریک)')} *</span>
            <select value={form.subjectOrgId} onChange={(e) => setForm((f) => ({ ...f, subjectOrgId: e.target.value }))} required>
              <option value="">{t('انتخاب کنید…')}</option>
              {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select></label>
          <label className="field"><span>{t('مالک پرونده')} *</span>
            <select value={form.ownerRole} onChange={(e) => setForm((f) => ({ ...f, ownerRole: e.target.value }))} required>
              <option value="">{t('انتخاب کنید…')}</option>
              {roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select></label>
          {formError ? <div className="alert-banner danger" role="alert"><span>{formError}</span></div> : null}
        </form>
      </Modal>
    </section>
  );
}
