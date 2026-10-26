'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { t } from '../_lib/i18n';
import { Badge } from './page-ui';
import { FileSearch, FolderLock, Gavel, ShieldCheck, Siren } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۸.۲ — پنل «پرونده‌های اصالت (ماژول پلتفرمی)»: سیاست اقدام چهارسطحی ۱۹.۵.۱.
   هر پرونده: شناسهٔ حساب/منبع/سرور/دستگاه/نشست + نشانه‌ها + امتیاز + نسخهٔ قاعده +
   اقدام + بازبین + اعتراض و نتیجه.
   اقدام محدودکننده فقط پس از بازبینی انسانی (دکمهٔ بازبین) اعمال می‌شود.
   ═══════════════════════════════════════════════════════════════════════════ */

const LEVEL_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

type Case = {
  id: string; subjectId: string; subjectLabel: string; subjectType: string;
  signalKeys: string[]; riskScore: number; levelKey: string; levelFa: string; ruleVersion: string;
  recommendedAction: string; recommendedActionFa: string; recommendedRestrictive: boolean;
  enforcedAction: string | null; enforcedActionFa: string | null; enforcedRestrictive: boolean;
  status: string; statusFa: string; reviewer: string | null; reviewNote: string; reviewAt: string | null;
  appeal: { filedBy: string; note: string; filedAt: string; outcome: string | null; outcomeNote: string; decidedAt: string | null } | null;
  appealOpen: boolean; outcome: string | null;
};
type CasesData = {
  items: Case[];
  stats: { total: number; open: number; underReview: number; resolved: number; appealsOpen: number };
  rule: string;
};

type Action = 'review-approve' | 'review-reject' | 'enforce' | 'appeal' | 'appeal-resolve' | 'close' | null;

export default function AuthenticityCases({ canSecurityRead, canSecurityWrite }: { canSecurityRead: boolean; canSecurityWrite: boolean }) {
  const [data, setData] = useState<CasesData | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; label: string; typeFa: string; risk: { score: number; levelKey: string; levelFa: string } }[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  /* فرم عملیات روی پروندهٔ انتخابی */
  const [act, setAct] = useState<{ kind: Action; caseId: string } | null>(null);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('OVERTURNED');

  const load = useCallback(async () => {
    if (!canSecurityRead) return;
    setError('');
    try {
      const d = await api<CasesData>('/authenticity/cases');
      setData(d);
      const r = await api<{ items: any[] }>('/authenticity/risks');
      setSubjects(r.items.map((x: any) => ({ id: x.id, label: x.label, typeFa: x.typeFa, risk: { score: x.risk.score, levelKey: x.risk.levelKey, levelFa: x.risk.levelFa } })));
    } catch (e) { setError((e as Error).message); }
  }, [canSecurityRead]);
  useEffect(() => { load(); }, [load]);

  const post = async (path: string, body: any, okMsg: string) => {
    setBusy(true); setError(''); setInfo('');
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      setInfo(okMsg); setAct(null); setNote('');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!canSecurityRead) return null;

  const startAct = (kind: Action, caseId: string) => { setAct({ kind, caseId }); setNote(''); setOutcome('OVERTURNED'); };

  return (
    <section className="panel authenticity-cases">
      <div className="panel-title">
        <div>
          <h2><FolderLock size={16} /> {t('پرونده‌های اصالت (ماژول پلتفرمی)')}</h2>
          <p>{t('چهار سطح ۱۹.۵.۱: کم (ثبت و ادامه) · متوسط (شاهد تکمیلی) · بالا (محدودیت موقت + پرونده) · بحرانی (قرنطینه + هشدار) — اقدام محدودکننده فقط پس از بازبینی انسانی.')}</p>
        </div>
        <div className="toolbar">
          {data && <Badge tone={data.stats.appealsOpen > 0 ? 'warning' : 'neutral'}>{t('اعتراض باز')}: {fa(data.stats.appealsOpen)}</Badge>}
          {canSecurityWrite && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenForm(o => !o)} disabled={busy}>
              <FileSearch size={13} /> {t('تشکیل پرونده برای موضوع')}
            </button>
          )}
        </div>
      </div>
      {error && <div className="error-card" role="alert">{error}</div>}
      {info && <div className="success-card" role="status">{info}</div>}

      {data && (
        <>
          {openForm && (
            <div className="form-grid" style={{ margin: '8px 0', borderTop: '1px dashed var(--card-border-strong)', paddingTop: 8 }}>
              <div className="field">
                <label className="field-label">{t('موضوع (حساب/منبع/سرور/دستگاه/نشست)')}</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} aria-label="موضوع پرونده">
                  <option value="">— {t('انتخاب کنید')} —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.typeFa} · {s.label} ({fa(s.risk.score)} — {s.risk.levelFa})</option>)}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="srip-button primary" disabled={busy || !subjectId}
                  onClick={() => post('/authenticity/cases/open', { subjectId }, t('پرونده با snapshot نشانه‌ها، امتیاز و نسخهٔ قاعده تشکیل شد.'))}>
                  {t('تشکیل پرونده')}
                </button>
                <button type="button" className="srip-button" onClick={() => setOpenForm(false)}>{t('انصراف')}</button>
              </div>
            </div>
          )}

          <div className="pmr-badges" style={{ margin: '8px 0' }}>
            <span className="chip neutral">{t('باز')}: {fa(data.stats.open)}</span>
            <span className="chip info">{t('در بازبینی')}: {fa(data.stats.underReview)}</span>
            <span className="chip success">{t('بسته')}: {fa(data.stats.resolved)}</span>
          </div>

          <div className="list">
            {data.items.map((c: Case) => (
              <div key={c.id} className="listRow" style={{ flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 230 }}>
                  <strong style={{ fontSize: 12.5 }}>{c.subjectLabel}</strong>
                  <small style={{ display: 'block' }}>
                    {t('پرونده')} {c.id} · {t('امتیاز')} {fa(c.riskScore)} — {t(c.levelFa)} · {t('اقدام پیشنهادی')}: {t(c.recommendedActionFa)}
                    {c.enforcedActionFa ? ` · ${t('اعمال‌شده')}: ${t(c.enforcedActionFa)}` : ''}
                  </small>
                  {!!c.signalKeys.length && (
                    <small style={{ display: 'block', opacity: 0.75 }}>{t('نشانه‌ها')}: {c.signalKeys.length ? fa(c.signalKeys.length) : '—'} · {t('نسخهٔ قاعده')}: {c.ruleVersion}</small>
                  )}
                  {c.reviewer && <small style={{ display: 'block', opacity: 0.75 }}>{t('بازبین')}: {c.reviewer}{c.reviewNote ? ` — ${c.reviewNote}` : ''}</small>}
                  {c.appeal && (
                    <small style={{ display: 'block' }}>
                      ⚖ {t('اعتراض')}: {c.appeal.filedBy} — {c.appeal.note}
                      {c.appeal.outcome ? ` → ${t(c.appeal.outcome === 'UPHELD' ? 'درستی اقدام تأیید شد' : c.appeal.outcome === 'OVERTURNED' ? 'ابطال — محدودیت برداشته شد' : 'اصلاح شد')}` : ` (${t('باز')})`}
                    </small>
                  )}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge tone={LEVEL_TONE[c.levelKey] ?? 'neutral'}>{t(c.levelFa)}</Badge>
                  <Badge tone={c.status === 'RESOLVED' ? 'success' : c.status === 'UNDER_REVIEW' ? 'info' : 'warning'}>{t(c.statusFa)}</Badge>
                  {c.enforcedRestrictive && <Badge tone="danger"><Siren size={11} /> {t('محدودیت اعمال‌شده')}</Badge>}
                </span>

                {canSecurityWrite && c.status !== 'RESOLVED' && !act && (
                  <span style={{ display: 'flex', gap: 6, flexBasis: '100%', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAct('review-approve', c.id)}><ShieldCheck size={12} /> {t('بازبینی: تأیید اقدام')}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAct('review-reject', c.id)}>{t('بازبینی: رد')}</button>
                    {c.recommendedRestrictive && !c.enforcedAction && c.reviewer && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAct('enforce', c.id)}><Siren size={12} /> {t('اعمال اقدام محدودکننده')}</button>
                    )}
                    {c.enforcedAction && !c.appeal && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAct('appeal', c.id)}><Gavel size={12} /> {t('ثبت اعتراض')}</button>
                    )}
                    {c.appealOpen && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAct('appeal-resolve', c.id)}>{t('نتیجهٔ اعتراض')}</button>
                    )}
                    {!c.appealOpen && <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAct('close', c.id)}>{t('بستن پرونده')}</button>}
                  </span>
                )}

                {act?.caseId === c.id && (
                  <div style={{ flexBasis: '100%', borderTop: '1px dashed var(--card-border-strong)', paddingTop: 8, display: 'grid', gap: 6 }}>
                    {act.kind === 'appeal-resolve' && (
                      <div className="field">
                        <label className="field-label">{t('نتیجهٔ اعتراض')}</label>
                        <select value={outcome} onChange={e => setOutcome(e.target.value)} aria-label="نتیجهٔ اعتراض">
                          <option value="UPHELD">{t('درستی اقدام تأیید شد (UPHELD)')}</option>
                          <option value="OVERTURNED">{t('ابطال — محدودیت برداشته شود (OVERTURNED)')}</option>
                          <option value="ADJUSTED">{t('اصلاح اقدام (ADJUSTED)')}</option>
                        </select>
                      </div>
                    )}
                    <div className="field full">
                      <label className="field-label">{t('یادداشت (شاهد تصمیم — الزامی)')}</label>
                      <input value={note} onChange={e => setNote(e.target.value)} aria-label="یادداشت تصمیم" />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="srip-button" onClick={() => setAct(null)}>{t('انصراف')}</button>
                      {act.kind === 'review-approve' && <button type="button" className="srip-button primary" disabled={busy || !note.trim()} onClick={() => post(`/authenticity/cases/${c.id}/review`, { decision: 'APPROVE', note }, t('بازبینی انسانی ثبت شد — اقدام پیشنهادی تأیید گردید.'))}>{t('ثبت تأیید بازبین')}</button>}
                      {act.kind === 'review-reject' && <button type="button" className="srip-button primary" disabled={busy || !note.trim()} onClick={() => post(`/authenticity/cases/${c.id}/review`, { decision: 'REJECT', note }, t('اقدام پیشنهادی رد شد و پرونده بسته گردید.'))}>{t('ثبت رد بازبین')}</button>}
                      {act.kind === 'enforce' && <button type="button" className="srip-button primary" disabled={busy || !note.trim()} onClick={() => post(`/authenticity/cases/${c.id}/enforce`, { note }, t('اقدام محدودکننده پس از بازبینی انسانی اعمال شد.'))}>{t('اعمال پس از بازبینی')}</button>}
                      {act.kind === 'appeal' && <button type="button" className="srip-button primary" disabled={busy || !note.trim()} onClick={() => post(`/authenticity/cases/${c.id}/appeal`, { note }, t('اعتراض ثبت شد — تا تعیین نتیجه، پرونده باز می‌ماند.'))}>{t('ثبت اعتراض')}</button>}
                      {act.kind === 'appeal-resolve' && <button type="button" className="srip-button primary" disabled={busy || !note.trim()} onClick={() => post(`/authenticity/cases/${c.id}/appeal/resolve`, { outcome, note }, t('نتیجهٔ اعتراض ثبت شد.'))}>{t('ثبت نتیجه')}</button>}
                      {act.kind === 'close' && <button type="button" className="srip-button primary" disabled={busy || !note.trim()} onClick={() => post(`/authenticity/cases/${c.id}/close`, { note }, t('پرونده بسته شد.'))}>{t('بستن پرونده')}</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="t-muted" style={{ fontSize: 10.5, marginTop: 8 }}>{data.rule}</p>
        </>
      )}
    </section>
  );
}
