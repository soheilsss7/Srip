'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { t } from '../_lib/i18n';
import { Badge } from './page-ui';
import { Activity, Fingerprint, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۸.۱ — پنل «اصالت و ریسک» (سند v6، ۱۹.۵): موتور نشانه‌ها و امتیاز ریسک.
   چهار خانوادهٔ نشانه (هویتی/فنی/شبکه‌ای/رفتاری+محتوایی) به‌عنوان کاتالوگ؛
   امتیاز ریسک قطعی از ترکیب وزن‌دار نشانه‌های ثبت‌شده؛
   خروجی همیشه «امتیاز + دلیل + شاهد» — نه برچسب قطعی.
   ═══════════════════════════════════════════════════════════════════════════ */

const LEVEL_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

type Signal = {
  id: string; subjectId: string; signalKey: string; active: boolean;
  detectedAt?: string; evidence?: string; source?: string; reviewNote?: string;
};
type Subject = {
  id: string; type: string; typeFa: string; label: string; signalCount: number;
  risk: {
    score: number; levelKey: string; levelFa: string; actionFa: string;
    reason: string; rule: string; ruleVersion: string;
    families: { key: string; titleFa: string; count: number }[];
  };
  _signals?: Signal[];
};
type RiskData = {
  items: Subject[];
  catalog: { key: string; family: string; familyFa: string; weight: number; titleFa: string; detailFa: string }[];
  families: { key: string; titleFa: string; signals: number }[];
  levels: { key: string; titleFa: string; actionFa: string }[];
  stats: { subjects: number; withSignals: number; alerts: number; byLevel: { key: string; titleFa: string; count: number }[] };
  rule: string;
};

export default function AuthenticityRisk({ canSecurityRead, canSecurityWrite }: { canSecurityRead: boolean; canSecurityWrite: boolean }) {
  const [data, setData] = useState<RiskData | null>(null);
  const [sel, setSel] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', signalKey: '', evidence: '' });
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!canSecurityRead) return;
    setError('');
    try {
      const d = await api<RiskData>('/authenticity/risks');
      setData(d);
      setSel(s => s ? (d.items.find(x => x.id === s.id) ?? null) : null);
    } catch (e) { setError((e as Error).message); }
  }, [canSecurityRead]);
  useEffect(() => { load(); }, [load]);

  const openSubject = async (s: Subject) => {
    if (sel?.id === s.id) { setSel(null); return; }
    /* شواهد نشانه‌ها از سرور: بازخوانی با جزئیات */
    setSel(s);
    try {
      const d = await api<RiskData>('/authenticity/risks');
      setData(d);
      const hit = d.items.find(x => x.id === s.id);
      if (hit) setSel(hit);
    } catch {}
  };

  const addSignal = async () => {
    setBusy(true); setError('');
    try {
      await api('/authenticity/risks/signals', { method: 'POST', body: JSON.stringify(form) });
      setForm({ subjectId: '', signalKey: '', evidence: '' }); setFormOpen(false);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const toggleSignal = async (id: string, active: boolean) => {
    setBusy(true); setError('');
    try {
      await api(`/authenticity/risks/signals/${id}/toggle`, { method: 'POST', body: JSON.stringify({ active, note }) });
      setNoteFor(null); setNote('');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!canSecurityRead) return null;

  const signalsOf = (s: Subject): Signal[] => ((s as any)._signals ?? []) as Signal[];

  return (
    <section className="panel authenticity-risk">
      <div className="panel-title">
        <div>
          <h2><Fingerprint size={16} /> {t('اصالت و ریسک (موتور نشانه‌ها)')}</h2>
          <p>{t('امتیاز ریسک قطعی از ترکیب وزن‌دار نشانه‌های ثبت‌شده — خروجی همیشه «امتیاز + دلیل + شاهد»، نه برچسب قطعی (۱۹.۵)')}</p>
        </div>
        <div className="toolbar">
          {data && <Badge tone={data.stats.alerts > 0 ? 'danger' : 'success'}>{t('هشدار')}: {fa(data.stats.alerts)}</Badge>}
          {canSecurityWrite && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFormOpen(o => !o); setForm(f => ({ ...f, subjectId: sel?.id ?? f.subjectId })); }}>
              <Plus size={13} /> {t('ثبت نشانهٔ تازه')}
            </button>
          )}
        </div>
      </div>
      {error && <div className="error-card" role="alert">{error}</div>}

      {data && (
        <>
          <div className="pmr-badges" style={{ margin: '8px 0' }}>
            {data.levels.map((l: any) => {
              const st = data.stats.byLevel.find(x => x.key === l.key);
              return <span key={l.key} className={`chip ${l.key === 'CRITICAL' ? 'danger' : l.key === 'HIGH' ? 'warning' : l.key === 'MEDIUM' ? 'info' : 'success'}`}>
                {t(l.titleFa)}: {fa(st?.count ?? 0)} — {t(l.actionFa)}
              </span>;
            })}
            <span className="chip neutral">{t('موضوع پایش')}: {fa(data.stats.subjects)}</span>
          </div>

          {formOpen && (
            <div className="form-grid" style={{ margin: '8px 0', borderTop: '1px dashed var(--card-border-strong)', paddingTop: 8 }}>
              <div className="field">
                <label className="field-label">{t('موضوع پایش')}</label>
                <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))} aria-label="موضوع پایش">
                  <option value="">— {t('انتخاب کنید')} —</option>
                  {data.items.map(s => <option key={s.id} value={s.id}>{s.typeFa} · {s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">{t('نشانه (از کاتالوگ چهار خانواده)')}</label>
                <select value={form.signalKey} onChange={e => setForm(f => ({ ...f, signalKey: e.target.value }))} aria-label="انتخاب نشانه">
                  <option value="">— {t('انتخاب کنید')} —</option>
                  {data.families.map((f: any) => (
                    <optgroup key={f.key} label={`${f.titleFa} (${fa(f.signals)} نشانه)`}>
                      {data.catalog.filter(c => c.family === f.key).map(c => (
                        <option key={c.key} value={c.key}>{c.titleFa} · {t('وزن')} {fa(c.weight)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label className="field-label">{t('شاهد (الزامی)')}</label>
                <input value={form.evidence} onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))} aria-label="شاهد نشانه" placeholder={t('مثال: ۵ تلاش ناموفق پیاپی از ۲۲:۴۰ تا ۲۲:۴۷')} />
              </div>
              <div className="form-actions">
                <button type="button" className="srip-button" disabled={busy} onClick={() => setFormOpen(false)}>{t('انصراف')}</button>
                <button type="button" className="srip-button primary" disabled={busy || !form.subjectId || !form.signalKey || !form.evidence.trim()} onClick={addSignal}>
                  {busy ? t('در حال ذخیره…') : t('ثبت نشانه با شاهد')}
                </button>
              </div>
            </div>
          )}

          <div className="list">
            {data.items.map((s: Subject) => (
              <div key={s.id} className="listRow" style={{ flexWrap: 'wrap' }}>
                <button type="button" onClick={() => openSubject(s)} style={{ flex: 1, minWidth: 220, textAlign: 'start', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                  <strong style={{ fontSize: 12.5 }}>{s.label}</strong>
                  <small style={{ display: 'block' }}>{s.typeFa} · {t('نشانهٔ فعال')}: {fa(s.signalCount)}</small>
                </button>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <strong style={{ fontSize: 13 }}>{fa(s.risk.score)}/۱۰۰</strong>
                  <Badge tone={LEVEL_TONE[s.risk.levelKey] ?? 'neutral'}>{t(s.risk.levelFa)}</Badge>
                </span>
                {sel?.id === s.id && (
                  <div style={{ flexBasis: '100%', borderTop: '1px dashed var(--card-border-strong)', paddingTop: 8, display: 'grid', gap: 6 }}>
                    <p className="field-hint" style={{ margin: 0 }}><Activity size={12} /> {s.risk.reason}</p>
                    {!!s.risk.families.length && (
                      <div className="pmr-badges">
                        {s.risk.families.map((f: any) => <span key={f.key} className="chip neutral">{t(f.titleFa)}: {fa(f.count)}</span>)}
                      </div>
                    )}
                    <div className="list">
                      {signalsOf(s).filter((x: Signal) => x.active !== false).map((x: Signal) => {
                        const def = data.catalog.find(c => c.key === x.signalKey);
                        return (
                          <div key={x.id} className="listRow" style={{ flexWrap: 'wrap' }}>
                            <span style={{ flex: 1, minWidth: 200 }}>
                              <strong style={{ fontSize: 12 }}>{def?.titleFa ?? x.signalKey}</strong>
                              <small style={{ display: 'block' }}>{def ? `${t(def.familyFa)} · ${t('وزن')} ${fa(def.weight)}` : ''} — {x.evidence}</small>
                            </span>
                            {canSecurityWrite && !noteFor && (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNoteFor(x.id); setNote(''); }}>
                                <ShieldCheck size={12} /> {t('غیرفعال با یادداشت')}
                              </button>
                            )}
                            {noteFor === x.id && (
                              <div style={{ flexBasis: '100%', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input style={{ flex: 1, minWidth: 200 }} value={note} onChange={e => setNote(e.target.value)} aria-label="یادداشت بازبین" placeholder={t('چرا این نشانه غیرفعال می‌شود؟ (شاهد تصمیم)')} />
                                <button type="button" className="srip-button primary btn-sm" disabled={busy || !note.trim()} onClick={() => toggleSignal(x.id, false)}>{t('ثبت')}</button>
                                <button type="button" className="srip-button btn-sm" onClick={() => setNoteFor(null)}>{t('انصراف')}</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!signalsOf(s).filter((x: Signal) => x.active !== false).length && <p className="empty-state" style={{ margin: 0 }}>{t('نشانهٔ فعالی ثبت نشده است.')}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="t-muted" style={{ fontSize: 10.5, marginTop: 8 }}>
            <ShieldAlert size={11} style={{ verticalAlign: '-1px' }} /> {data.rule} — {t('نسخهٔ قاعده')}: {data.items[0]?.risk.ruleVersion ?? '—'}
          </p>
        </>
      )}
    </section>
  );
}
