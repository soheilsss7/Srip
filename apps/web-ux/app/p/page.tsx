'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiPublic } from '../_lib/api';
import { appBase } from '../_lib/api';

/* ═══════════════════════════════════════════════════════════════════════════
   پورتال عمومی SRIP (مسترپلن فاز ۲/۱۳+۱۶) — صفحهٔ بی‌احراز
   ?slug=pars        → فرم بازخورد/شکایت/درخواست (Tractivity-style، با نرخ‌محدود)
   ?survey=<token>   → پاسخ نظرسنجی ذینفع (لینک اختصاصی، یک‌بار مصرف)
   بدون منوی برنامه؛ فقط برند سازمان و فرم — کاربر عمومی نیازی به حساب ندارد.
   ═══════════════════════════════════════════════════════════════════════════ */

type PortalInfo = {
  slug: string; organizationId: string; organizationName: string;
  kinds: { id: string; fa: string; slaDays: number }[];
  privacyNote: string;
};
type SurveyPublic = {
  token: string; organizationName: string; status: string; expiresAt: string;
  questions: { id: string; kind: string; fa: string; required: boolean; options: { id: string; fa: string }[] | null }[];
  privacyNote: string;
};

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));

export default function PublicPortalPage() {
  /* حالت فرم پورتال */
  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [slug, setSlug] = useState('');
  const [form, setForm] = useState({ type: 'FEEDBACK', name: '', contact: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ id: string; slaDays: number; message: string } | null>(null);
  const [err, setErr] = useState('');

  /* حالت نظرسنجی */
  const [survey, setSurvey] = useState<SurveyPublic | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [surveyDone, setSurveyDone] = useState<string>('');
  const [surveyErr, setSurveyErr] = useState('');

  const boot = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const sv = sp.get('survey');
    const sl = sp.get('slug');
    if (sv) {
      try { setSurvey(await apiPublic<SurveyPublic>(`/portal/surveys/${encodeURIComponent(sv)}`)); }
      catch (e) { setSurveyErr((e as Error).message); }
      return;
    }
    if (sl) {
      setSlug(sl);
      try { setInfo(await apiPublic<PortalInfo>(`/portal/${encodeURIComponent(sl)}/info`)); }
      catch (e) { setErr((e as Error).message); }
    }
  }, []);
  useEffect(() => { boot(); }, [boot]);

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setErr('');
    try {
      const out = await apiPublic<{ id: string; slaDays: number; message: string }>(`/portal/${encodeURIComponent(slug)}/submit`, {
        method: 'POST', body: JSON.stringify({ type: form.type, name: form.name || undefined, contact: form.contact || undefined, message: form.message }),
      });
      setSent(out);
    } catch (x) { setErr((x as Error).message); }
    finally { setSending(false); }
  };

  const submitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;
    setSending(true); setSurveyErr('');
    try {
      const out = await apiPublic<{ message: string }>(`/portal/surveys/${survey.token}/respond`, {
        method: 'POST', body: JSON.stringify({ answers }),
      });
      setSurveyDone(out.message ?? 'پاسخ شما ثبت شد.');
    } catch (x) { setSurveyErr((x as Error).message); }
    finally { setSending(false); }
  };

  const base = typeof window !== 'undefined' ? '' : '';

  /* ─── حالت نظرسنجی ─── */
  if (survey || surveyErr) {
    return (
      <main className="public-portal" dir="rtl">
        <div className="pp-card">
          <p className="pp-brand">سامانهٔ هوش روابط راهبردی</p>
          {survey ? (
            surveyDone ? (
              <div className="pp-done">
                <h1>سپاس از همراهی شما</h1>
                <p>{surveyDone}</p>
                <p className="pp-muted">پاسخ شما با برچسب منبع «نظرسنجی» در امتیازها به کار گرفته شد و فقط به‌صورت جمعی دیده می‌شود.</p>
              </div>
            ) : (
              <>
                <h1>نظرسنجی کوتاه — {survey.organizationName}</h1>
                <p className="pp-muted">{survey.privacyNote}</p>
                <form onSubmit={submitSurvey} className="pp-form">
                  {survey.questions.map(q => (
                    <div key={q.id} className="pp-field">
                      <label htmlFor={`q-${q.id}`}>{q.fa}{q.required ? ' *' : ''}</label>
                      {q.kind === 'SCALE_1_5' ? (
                        <div className="pp-scale" role="radiogroup" aria-label={q.fa}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button type="button" key={n} className={answers[q.id] === String(n) ? 'on' : ''}
                              aria-pressed={answers[q.id] === String(n)}
                              onClick={() => setAnswers(a => ({ ...a, [q.id]: String(n) }))}>{fmtN(n)}</button>
                          ))}
                        </div>
                      ) : q.kind === 'CHOICE' ? (
                        <select id={`q-${q.id}`} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}>
                          <option value="">انتخاب کنید…</option>
                          {(q.options ?? []).map(o => <option key={o.id} value={o.id}>{o.fa}</option>)}
                        </select>
                      ) : (
                        <textarea id={`q-${q.id}`} rows={3} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                  {surveyErr && <p className="pp-err" role="alert">{surveyErr}</p>}
                  <button className="pp-submit" disabled={sending || !answers['satisfaction'] || !answers['perception']}>
                    {sending ? 'در حال ثبت…' : 'ثبت پاسخ'}
                  </button>
                </form>
              </>
            )
          ) : (
            <div className="pp-done"><h1>نظرسنجی یافت نشد</h1><p>{surveyErr}</p></div>
          )}
        </div>
      </main>
    );
  }

  /* ─── حالت فرم پورتال ─── */
  return (
    <main className="public-portal" dir="rtl">
      <div className="pp-card">
        <p className="pp-brand">سامانهٔ هوش روابط راهبردی</p>
        {sent ? (
          <div className="pp-done">
            <h1>پیام شما ثبت شد</h1>
            <p>{sent.message}</p>
            <p className="pp-muted">شناسهٔ پیام: {sent.id} — برای پیگیری می‌توانید این شناسه را نزد خود نگه دارید.</p>
            <button className="pp-submit" onClick={() => { setSent(null); setForm({ type: 'FEEDBACK', name: '', contact: '', message: '' }); }}>ثبت پیام تازه</button>
          </div>
        ) : info ? (
          <>
            <h1>ارتباط با {info.organizationName}</h1>
            <p className="pp-muted">{info.privacyNote}</p>
            <form onSubmit={submitMessage} className="pp-form">
              <div className="pp-field">
                <label>نوع پیام *</label>
                <div className="pp-kinds" role="radiogroup">
                  {info.kinds.map(k => (
                    <button type="button" key={k.id} className={form.type === k.id ? 'on' : ''}
                      aria-pressed={form.type === k.id}
                      onClick={() => setForm(f => ({ ...f, type: k.id }))}>
                      {k.fa}<small>پاسخ تا {fmtN(k.slaDays)} روز</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="pp-row">
                <div className="pp-field">
                  <label htmlFor="pp-name">نام (اختیاری)</label>
                  <input id="pp-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="name" />
                </div>
                <div className="pp-field">
                  <label htmlFor="pp-contact">راه تماس (اختیاری)</label>
                  <input id="pp-contact" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="ایمیل یا شماره تماس" />
                </div>
              </div>
              <div className="pp-field">
                <label htmlFor="pp-msg">متن پیام *</label>
                <textarea id="pp-msg" rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="پیام خود را بنویسید…" required minLength={10} maxLength={2000} />
              </div>
              {err && <p className="pp-err" role="alert">{err}</p>}
              <button className="pp-submit" disabled={sending || form.message.trim().length < 10}>
                {sending ? 'در حال ثبت…' : 'ثبت پیام'}
              </button>
            </form>
          </>
        ) : !slug ? (
          <div className="pp-done">
            <h1>پورتال عمومی</h1>
            <p className="pp-muted">نشانی پورتال هر سازمان اختصاصی است؛ نمونه: <a href={base + '/p?slug=pars'}>پورتال هلدینگ پارس</a></p>
            {err && <p className="pp-err">{err}</p>}
          </div>
        ) : (
          <div className="pp-done"><h1>در حال بارگذاری…</h1>{err && <p className="pp-err">{err}</p>}</div>
        )}
      </div>
    </main>
  );
}
