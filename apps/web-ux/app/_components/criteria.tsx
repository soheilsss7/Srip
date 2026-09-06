'use client';
/* ============================================================================
   معیارهای واقعی ارزیابی — رابط مشترک سراسر پلتفرم
   · CriteriaIntake: پرسش‌نامای اختیاری لحظۀ ساخت رکورد (همان معیارهایی که
     بعداً امتیاز از آن‌ها ساخته می‌شود)
   · CriteriaScoreCard: امتیاز + پوشش اطلاعات + اطمینان + باند عدم‌قطعیت +
     پرچم‌ها + معیارهای بدون داده
   · CriteriaBadge: نشان فشردهٔ فهرست‌ها
   داده‌ها از /criteria/* خوانده می‌شود؛ کاتالوگ در کد فرانت‌اند تکرار نمی‌شود.
   ============================================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from './workspace';
import { AlertTriangle, BadgeCheck, BellRing, Gauge, HelpCircle, Info, PenLine, RefreshCw, Save, ShieldAlert, SlidersHorizontal, Trash2 } from 'lucide-react';

export type Anchor = { level: number; label: string; score: number };
export type Question = {
  code: string; criterionCode: string; family: string; familyName: string; prompt: string; help: string;
  recommended: boolean; polarity: 'GOOD' | 'BAD'; anchors: Anchor[]; warning?: string | null;
  criterion?: { name: string; why: string; sources: string[]; evidence: string } | null;
};
export type AnswerMap = Record<string, { level: number | null; note?: string; evidence?: string }>;
export type Manual = {
  id: string; subjectType: string; subjectId: string; delta: number; reason: string;
  expiresAt?: string | null; enabled?: boolean; active?: boolean; expired?: boolean;
  createdBy?: string; createdAt?: string; updatedAt?: string;
};
export type Summary = {
  score: number; coverage: number; confidence: number; uncertainty: number; rangeLow: number; rangeHigh: number;
  rankable: boolean; verdict: string; verdictLabel: string; verdictHint?: string; known: number; total: number;
  gateCap?: number | null;
  flags?: { code: string; severity: string; criterionCode: string; message?: string }[];
  computedAt?: string;
  manual?: Manual | null;
  effectiveScore?: number | null;
  modelScore?: number | null;
  scoreSource?: 'MODEL' | 'MODEL_MANUAL';
};
export type Line = {
  code: string; name: string; familyName: string; why: string; polarity: 'GOOD' | 'BAD'; value: number | null;
  confidence: number; status: 'OBSERVED' | 'ASSESSED' | 'BLENDED' | 'UNKNOWN'; weightPct: number; needsReview: boolean;
  answerAgeDays?: number | null; note?: string | null; evidence?: string | null; actionHint?: string;
  observed?: { value: number; evidence: number; label: string } | null;
  assessed?: { value: number; level: number; methodLabel?: string; confidence: number } | null;
  gate?: { active: boolean; severity: string; message: string; cap: number } | null;
  sources?: string[];
};
export type Assessment = Summary & {
  subjectType: string; subjectId: string; rawScore: number; rankingScore?: number; criteria: Line[];
  unknown: { code: string; name: string; family: string; weightPct: number; prompt?: string; help?: string }[];
  reviewDue: { code: string; name: string; reason: string }[];
  flags: { code: string; severity: string; message: string; criterionCode: string }[];
  families: { family: string; name: string; rationale: string; score: number | null; weightPct: number; coveragePct: number; confidence: number; known: number; total: number; lines: Line[] }[];
  hints: string[]; answeredCount: number; blend?: { behavioralEvidence: number; observedShare: number; coldStart: boolean };
};

/** محیط‌هایی که مسیرهای /criteria را ندارند (کلاینت قدیمی با Mock مستقل) — UI بی‌صدا خاموش می‌شود */
const isMissingCriteriaApi = (e: unknown) => {
  const err = e as { status?: number; message?: string };
  return err?.status === 404 || /وجود ندارد|not found|404/i.test(String(err?.message ?? ''));
};

const faNum = (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('fa-IR').format(Math.round(v)));
const toneOf = (a: Pick<Summary, 'verdict' | 'rankable' | 'score'>) =>
  a.verdict === 'CRITICAL' ? 'danger' : a.verdict === 'INSUFFICIENT_DATA' || a.verdict === 'PRELIMINARY' ? 'warning'
    : a.verdict === 'AT_RISK' ? 'danger' : a.verdict === 'STRONG' ? 'success' : 'info';
const STATUS_LABEL: Record<Line['status'], string> = {
  OBSERVED: 'از رفتار واقعی', ASSESSED: 'ارزیابی انسانی', BLENDED: 'ترکیب رفتار و ارزیابی', UNKNOWN: 'بدون داده',
};

/* ─────────────────────────── نشان فشرده برای فهرست‌ها ─────────────────────────── */
export function CriteriaBadge({ criteria, showScore = true }: { criteria?: Summary | null; showScore?: boolean }) {
  if (!criteria) return <span className="criteria-badge muted" title="هنوز ارزیابی معیارمحور انجام نشده">بدون ارزیابی</span>;
  const tone = toneOf(criteria);
  const manualOn = !!criteria.manual?.active && (criteria.scoreSource === 'MODEL_MANUAL');
  const score = criteria.effectiveScore ?? criteria.score;
  const label = showScore
    ? `${criteria.rankable ? 'امتیاز معیار' : 'ارزیابی ناقص'} ${faNum(score)}${manualOn ? ' · دستی' : ''} · ${faNum(criteria.coverage)}٪ اطلاعات`
    : `${faNum(criteria.coverage)}٪ اطلاعات`;
  const title = manualOn
    ? `${criteria.verdictLabel} — مدل ${faNum(criteria.score)} ${(criteria.manual?.delta ?? 0) > 0 ? '+' : ''}${faNum(criteria.manual?.delta ?? 0)} دستی = ${faNum(score)}`
    : `${criteria.verdictLabel} — ${criteria.verdictHint ?? ''}`;
  return (
    <span className={`criteria-badge ${tone}${manualOn ? ' manual' : ''}`} title={title}>
      {criteria.flags?.length ? <ShieldAlert size={12} /> : criteria.rankable ? <BadgeCheck size={12} /> : <HelpCircle size={12} />}
      {label}
      {manualOn && <em className="criteria-badge-manual">دستی</em>}
    </span>
  );
}

/** نوار فشرده برای پنل‌های کناری (مثل گراف شبکه) — فقط خلاصۀ یک سوژه */
export function CriteriaRailChip({ subjectType, subjectId }: { subjectType: 'ORGANIZATION' | 'PERSON' | 'RELATIONSHIP'; subjectId: string }) {
  const [data, setData] = useState<Assessment | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    setDone(false); setData(null);
    api(`/criteria/assessment/${subjectType}/${subjectId}`)
      .then((res: any) => { if (alive) setData(res ?? null); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setDone(true); });
    return () => { alive = false; };
  }, [subjectType, subjectId]);
  if (!done) return <span className="criteria-badge muted" title="در حال محاسبه">ارزیابی…</span>;
  if (!data) return <span className="criteria-badge muted" title="هنوز هیچ معیاری برای این رکورد ثبت نشده">بدون ارزیابی</span>;
  const tone = toneOf(data);
  return (
    <span className={`criteria-badge ${tone}`} title={`${data.verdictLabel} — ${data.verdictHint ?? ''}`}>
      {data.flags?.length ? <ShieldAlert size={12} /> : data.rankable ? <BadgeCheck size={12} /> : <HelpCircle size={12} />}
      امتیاز معیار {faNum(data.score)} · پوشش {faNum(data.coverage)}٪ · {faNum(data.unknown?.length ?? 0)} معیار بدون داده
    </span>
  );
}

/* ───────────────────────────── نوار پیشرفت بصری ───────────────────────────── */
function Meter({ value, tone = 'info', label }: { value: number; tone?: string; label?: string }) {
  return (
    <span className="criteria-meter" title={label}>
      <i className={`criteria-meter-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/* ───────────────────────── پرسش‌نامای اختیاری (cold start) ───────────────────────── */
export function CriteriaIntake({
  subjectType, answers, onChange, heading = 'ارزیابی اولیه (اختیاری)', onlyRecommended = true, dense = false,
}: {
  subjectType: 'ORGANIZATION' | 'PERSON' | 'RELATIONSHIP' | 'OPPORTUNITY';
  answers: AnswerMap;
  onChange: (next: AnswerMap) => void;
  heading?: string;
  onlyRecommended?: boolean;
  dense?: boolean;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [showAll, setShowAll] = useState(!onlyRecommended);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [openHelp, setOpenHelp] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMissing(false);
    api(`/criteria/questionnaire/${subjectType}`)
      .then((data: any) => { if (!alive) return; setQuestions(Array.isArray(data?.questions) ? data.questions : []); setTotal(data?.totalCriteria ?? 0); setError(''); })
      .catch((e: Error) => { if (!alive) return; if (isMissingCriteriaApi(e)) setMissing(true); else setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subjectType]);

  const visible = useMemo(
    () => (showAll ? questions : questions.filter((q) => q.recommended)),
    [questions, showAll],
  );
  const answered = visible.filter((q) => answers[q.criterionCode]?.level != null).length;

  function pick(q: Question, level: number | null) {
    const next = { ...answers };
    if (level == null) delete next[q.criterionCode];
    else next[q.criterionCode] = { ...next[q.criterionCode], level };
    onChange(next);
  }
  function note(q: Question, value: string) {
    onChange({ ...answers, [q.criterionCode]: { ...(answers[q.criterionCode] ?? { level: null }), note: value } });
  }
  if (missing) return null;

  return (
    <div className={`criteria-intake${dense ? ' dense' : ''}`}>
      <div className="criteria-intake-head">
        <div>
          <strong>{heading}</strong>
          <p>هیچ‌کدام اجباری نیست. آنچه نمی‌دانید خالی بگذارید — «خالی» با «صفر» فرق دارد و در امتیاز حساب نمی‌شود.</p>
        </div>
        <span className="chip neutral">{faNum(answered)} پاسخ از {faNum(visible.length)}</span>
      </div>
      {loading && <div className="loading-strip">در حال بارگذاری پرسش‌ها…</div>}
      {error && !loading && <div className="criteria-intake-error">پرسش‌نامه در دسترس نیست: {error}</div>}
      {!loading && !error && !visible.length && <div className="criteria-intake-error">معیاری برای این نوع رکورد تعریف نشده است.</div>}
      <div className="criteria-questions">
        {visible.map((q) => {
          const chosen = answers[q.criterionCode]?.level ?? null;
          return (
            <div key={q.code} className={`criteria-question${chosen != null ? ' answered' : ''}`}>
              <div className="criteria-question-title">
                <span>{q.prompt}</span>
                <button type="button" className="criteria-help-btn" onClick={() => setOpenHelp(openHelp === q.code ? null : q.code)} aria-label="چرا این پرسش">
                  <Info size={13} />
                </button>
              </div>
              <div className="criteria-question-help">{q.help}</div>
              {openHelp === q.code && q.criterion && (
                <div className="criteria-question-why">
                  <p>{q.criterion.why}</p>
                  {!!q.criterion.sources?.length && <small>منبع: {q.criterion.sources.join(' · ')}</small>}
                </div>
              )}
              <div className="criteria-anchors" role="radiogroup" aria-label={q.prompt}>
                {q.anchors.map((a) => (
                  <button
                    key={a.level}
                    type="button"
                    role="radio"
                    aria-checked={chosen === a.level}
                    className={`criteria-anchor${chosen === a.level ? ' on' : ''}${q.polarity === 'BAD' && chosen === a.level && a.score >= 70 ? ' risk' : ''}`}
                    onClick={() => pick(q, chosen === a.level ? null : a.level)}
                  >
                    {a.label}
                  </button>
                ))}
                {chosen != null && (
                  <button type="button" className="criteria-anchor skip" onClick={() => pick(q, null)}>نمی‌دانم</button>
                )}
              </div>
              {chosen != null && (
                <input
                  className="criteria-note"
                  value={answers[q.criterionCode]?.note ?? ''}
                  onChange={(e) => note(q, e.target.value)}
                  placeholder="مدرک یا توضیح (اختیاری — اطمینان امتیاز را بالا می‌برد)"
                />
              )}
            </div>
          );
        })}
      </div>
      {questions.length > visible.length || showAll ? (
        <button type="button" className="btn btn-ghost btn-sm criteria-toggle" onClick={() => setShowAll((v) => !v)}>
          {showAll ? `فقط ${faNum(questions.filter((q) => q.recommended).length)} پرسش پیشنهادی` : `نمایش همهٔ ${faNum(questions.length)} پرسش`}
        </button>
      ) : null}
      {total > 0 && (
        <p className="criteria-intake-foot">
          <Gauge size={13} /> با همین پاسخ‌ها امتیاز ساخته می‌شود؛ بقیۀ {faNum(total)} معیار در فهرست «بدون داده» می‌ماند و بعداً با ثبت رفتار واقعی یا ارزیابی شما پر می‌شود.
        </p>
      )}
    </div>
  );
}

/** تبدیل نقشۀ پاسخ به بدنهٔ درخواست API */
export function intakePayload(answers: AnswerMap) {
  return Object.entries(answers)
    .filter(([, a]) => a?.level != null)
    .map(([criterionCode, a]) => ({ criterionCode, level: a.level ?? null, note: a.note?.trim() || null, evidence: a.evidence?.trim() || null, method: 'OWNER_ASSESSED' }));
}

/* ───────────────────────────── کارت امتیاز معیارها ───────────────────────────── */
export function CriteriaScoreCard({
  subjectType, subjectId, onEdit, onRefresh,
}: { subjectType: 'ORGANIZATION' | 'PERSON' | 'RELATIONSHIP' | 'OPPORTUNITY'; subjectId: string; onEdit?: () => void; onRefresh?: () => void }) {
  const [data, setData] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AnswerMap>({});
  const { can, me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');
  const canManage = isOwner || can('criteria.manage') || can('admin.users');
  const [manualOpen, setManualOpen] = useState(false);
  const [mDelta, setMDelta] = useState(0);
  const [mReason, setMReason] = useState('');
  const [mExpiry, setMExpiry] = useState('90');
  const [mBusy, setMBusy] = useState(false);
  const [mError, setMError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(''); setMissing(false);
    try {
      const res: any = await api(`/criteria/assessment/${subjectType}/${subjectId}`);
      setData(res);
      setMDelta(res?.manual?.active ? Number(res.manual.delta) : 0);
      setMReason(res?.manual?.reason ?? '');
      const daysLeft = res?.manual?.expiresAt ? Math.max(1, Math.round((new Date(res.manual.expiresAt).getTime() - Date.now()) / 86400000)) : 0;
      setMExpiry(daysLeft > 0 ? String([30, 90, 180].find((d) => d >= daysLeft) ?? daysLeft) : 'permanent');
      setMError('');
      setDraft(Object.fromEntries((res?.criteria ?? []).filter((l: Line) => l.assessed).map((l: Line) => [l.code, { level: l.assessed!.level, note: l.note ?? '', evidence: '' }])));
    } catch (e) { if (isMissingCriteriaApi(e)) setMissing(true); else setError((e as Error).message); } finally { setLoading(false); }
  }, [subjectType, subjectId]);
  useEffect(() => { load(); }, [load]);

  async function saveManual() {
    const delta = Number(mDelta);
    if (!Number.isFinite(delta) || delta < -25 || delta > 25) { setMError('جابه‌جایی باید بین ۲۵- تا ۲۵+ باشد.'); return; }
    if (!mReason.trim()) { setMError('دلیل تنظیم دستی الزامی است.'); return; }
    setMBusy(true); setMError('');
    try {
      const payload: any = { delta, reason: mReason.trim(), enabled: true };
      if (mExpiry !== 'permanent') payload.expiresInDays = Number(mExpiry) || 90;
      await api(`/criteria/manual/${subjectType}/${subjectId}`, { method: 'POST', body: JSON.stringify(payload) });
      setManualOpen(false);
      await load();
      onRefresh?.();
    } catch (e) { setMError((e as Error).message); } finally { setMBusy(false); }
  }
  async function removeManual() {
    setMBusy(true); setMError('');
    try {
      await api(`/criteria/manual/${subjectType}/${subjectId}`, { method: 'DELETE' });
      setManualOpen(false);
      await load();
      onRefresh?.();
    } catch (e) { setMError((e as Error).message); } finally { setMBusy(false); }
  }

  const [nudgeBusy, setNudgeBusy] = useState(false);
  async function remind() {
    setNudgeBusy(true);
    try { await api(`/criteria/nudges/${subjectType}/${subjectId}`, { method: 'POST', body: JSON.stringify({ kind: 'REVIEW', note: 'بازبینی معیارها' }) }); }
    catch { /* نمایشی */ }
    finally { setNudgeBusy(false); }
  }

  async function save() {
    const payload = intakePayload(draft);
    if (!payload.length) { setEditing(false); return; }
    setSaving(true); setError('');
    try {
      await api(`/criteria/assessment/${subjectType}/${subjectId}`, { method: 'POST', body: JSON.stringify({ answers: payload, source: 'ASSESSMENT' }) });
      // بازمحاسبۀ امتیاز رابطه تا مدل ترکیبی (رفتار + ارزیابی) به‌روز شود
      if (subjectType === 'RELATIONSHIP') await api(`/scores/relationship/${subjectId}/recalculate`, { method: 'POST' }).catch(() => undefined);
      setEditing(false);
      await load();
      onEdit?.();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  if (missing) return null;
  if (loading) return <div className="criteria-card loading-strip">در حال محاسبۀ امتیاز معیارها…</div>;
  if (error && !data) return <div className="criteria-card"><div className="criteria-intake-error">{error}</div></div>;
  if (!data) return null;
  const tone = toneOf(data);

  return (
    <section className={`section-card criteria-card${tone === 'danger' ? ' has-risk' : ''}`}>
      <div className="section-head">
        <div>
          <h2>امتیاز معیارها</h2>
          <p>{data.verdictHint}</p>
        </div>
        <div className="toolbar">
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}><RefreshCw size={13} /> بازخوانی</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing((v) => !v)}><PenLine size={13} /> {editing ? 'انجام ویرایش' : 'ثبت ارزیابی'}</button>
          {canManage && <button className="btn btn-secondary btn-sm" onClick={() => { setManualOpen((v) => !v); setMError(''); }}><SlidersHorizontal size={13} /> {data.manual?.active ? 'تنظیم دستی' : 'تنظیم دستی'}</button>}
        </div>
      </div>

      <div className="criteria-headline">
        <div className="criteria-score">
          <strong>{faNum(data.effectiveScore ?? data.score)}</strong>
          <span>از ۱۰۰</span>
          {data.scoreSource === 'MODEL_MANUAL' && <em>مدل {faNum(data.modelScore ?? data.score)} {((data.manual?.delta ?? 0)) > 0 ? '+' : ''}{faNum(data.manual?.delta ?? 0)} = {faNum(data.effectiveScore ?? data.score)}</em>}
          {data.scoreSource !== 'MODEL_MANUAL' && <em>بازۀ قابل‌انتظار {faNum(data.rangeLow)} تا {faNum(data.rangeHigh)}</em>}
        </div>
        <div className="criteria-gauges">
          <div><span>پوشش اطلاعات</span><Meter value={data.coverage} tone="info" /><b>{faNum(data.coverage)}٪</b></div>
          <div><span>اطمینان به شواهد</span><Meter value={data.confidence} tone={data.confidence >= 65 ? 'success' : data.confidence >= 40 ? 'warning' : 'danger'} /><b>{faNum(data.confidence)}٪</b></div>
          <div><span>معیارهای پاسخ‌داده‌شده</span><b className="criteria-count">{faNum(data.known)} / {faNum(data.total)}</b></div>
        </div>
        <div className="criteria-verdicts">
          <span className={`chip ${tone}`}>{data.verdictLabel}</span>
          {!data.rankable && <span className="chip warning" title="چون پوشش یا اطمینان کم است، این رکورد در فهرست‌های رتبه‌بندی رقابتی قرار نمی‌گیرد">قابل مقایسه نیست</span>}
          {data.manual?.active && <span className="chip neutral" title={data.manual.reason}>تنظیم دستی {faNum(data.manual.delta)}</span>}
          {data.manual && !data.manual.active && <span className="chip warning" title={data.manual.reason}>تنظیم دستی منقضی</span>}
          {data.gateCap != null && <span className="chip danger">سقف اجباری {faNum(data.gateCap)}</span>}
          {data.blend?.coldStart && <span className="chip neutral">شروع سرد — فقط ارزیابی انسانی</span>}
          {data.blend && !data.blend.coldStart && <span className="chip neutral" title="سهم رفتار واقعی در برابر ارزیابی انسانی">{faNum(data.blend.observedShare)}٪ از رفتار واقعی</span>}
          {data.rankable && <span className="chip neutral" title="امتیاز برای رتبهبندی، در برابر مقایسهٔ منصفانه بین رکوردها">رتبه: {faNum(data.rankingScore ?? data.effectiveScore ?? data.score)}</span>}
        </div>
      </div>

      {!!data.flags?.length && (
        <ul className="criteria-flags">
          {data.flags.map((f) => (
            <li key={f.code} className={String(f.severity).toLowerCase()}>
              <AlertTriangle size={14} />
              <span><b>{f.severity === 'CRITICAL' ? 'پرچم بحرانی' : f.severity === 'HIGH' ? 'پرچم مهم' : 'هشدار'}:</b> {f.message}</span>
            </li>
          ))}
        </ul>
      )}

      {!!data.reviewDue?.length && (
        <div className="criteria-stale-banner">
          <div>
            <strong><BellRing size={13} /> {faNum(data.reviewDue.length)} معیار نیاز به بازبینی دارد</strong>
            <small>{data.reviewDue.slice(0, 3).map((r: any) => r.name).join('، ')}{data.reviewDue.length > 3 ? ` و ${faNum(data.reviewDue.length - 3)} مورد دیگر` : ''} — پاسخ کهنه یا کم‌اطمینان است و امتیاز را خراب می‌کند.</small>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={remind} disabled={nudgeBusy}><BellRing size={12} /> {nudgeBusy ? 'ارسال…' : 'یادآوری بده'}</button>
        </div>
      )}

      {manualOpen && (
        <div className="criteria-manual">
          <h3>تنظیم دستی امتیاز (برای کارشناس)</h3>
          <p>
            مدل {faNum(data.effectiveScore ?? data.score)} را از {faNum(data.known)} معیار ساخته است. اینجا می‌توانید امتیاز را حداکثر تا ۲۵± جابه‌جا کنید؛ دلیلش الزامی است و مبنای مدل دست‌نخورده می‌ماند.
          </p>
          <div className="manual-grid">
            <label className="manual-field">
              <span className="manual-label">جابه‌جایی نسبت به مدل ({faNum(data.modelScore ?? data.score)}):</span>
              <input type="number" min={-25} max={25} step={5} value={mDelta} onChange={(e) => setMDelta(Number(e.target.value))} />
              <small>نتیجه: {faNum(Math.max(0, Math.min(100, (data.modelScore ?? data.score) + (Number(mDelta) || 0))))} از ۱۰۰</small>
            </label>
            <label className="manual-field manual-reason">
              <span className="manual-label">دلیل (برای ممیزی):</span>
              <textarea rows={2} maxLength={240} value={mReason} onChange={(e) => setMReason(e.target.value)} placeholder="مثلاً: قرارداد تمدید شده و ریسک زنجیرهٔ تأمین پایین آمده است." />
            </label>
            <label className="manual-field">
              <span className="manual-label">اعتبار:</span>
              <select value={mExpiry} onChange={(e) => setMExpiry(e.target.value)}>
                <option value="permanent">دائمی (تا لغو)</option>
                <option value="30">۳۰ روز</option>
                <option value="90">۹۰ روز</option>
                <option value="180">۱۸۰ روز</option>
              </select>
              <small>با انقضا، امتیاز خودکار به مدل برمی‌گردد.</small>
            </label>
          </div>
          {mError && <div className="criteria-intake-error">{mError}</div>}
          <div className="toolbar">
            {data.manual && (
              <button type="button" className="btn btn-danger btn-sm" onClick={removeManual} disabled={mBusy}><Trash2 size={13} /> حذف تنظیم دستی</button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setManualOpen(false)} disabled={mBusy}>بستن</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveManual} disabled={mBusy}><Save size={13} /> {mBusy ? 'در حال ثبت…' : (data.manual?.active ? 'به‌روزرسانی' : 'ثبت')}</button>
          </div>
        </div>
      )}

      {editing && (
        <CriteriaIntake subjectType={subjectType} answers={draft} onChange={setDraft} heading="ثبت یا اصلاح ارزیابی" onlyRecommended={false} dense />
      )}
      {editing && (
        <div className="criteria-edit-actions">
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیرهٔ ارزیابی'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>بی‌خیال</button>
          <small>پس از ذخیره، امتیاز رابطه و پیشنهادها دوباره محاسبه می‌شوند.</small>
        </div>
      )}

      {!editing && (
        <>
          <div className="criteria-families">
            {data.families.map((f) => (
              <div key={f.family} className={`criteria-family${open === f.family ? ' open' : ''}`}>
                <button type="button" className="criteria-family-head" onClick={() => setOpen(open === f.family ? null : f.family)}>
                  <span className="criteria-family-name">{f.name}</span>
                  <Meter value={f.score ?? 0} tone={f.score == null ? 'muted' : f.score >= 70 ? 'success' : f.score >= 45 ? 'info' : 'warning'} />
                  <b>{f.score == null ? 'بدون داده' : faNum(f.score)}</b>
                  <i>{faNum(f.weightPct)}٪ وزن · {faNum(f.known)}/{faNum(f.total)} معیار</i>
                </button>
                <p className="criteria-family-why">{f.rationale}</p>
                {open === f.family && (
                  <ul className="criteria-lines">
                    {f.lines.map((l) => (
                      <li key={l.code} className={`criteria-line ${l.value == null ? 'empty' : l.polarity === 'BAD' && (l.value ?? 0) >= 60 ? 'risk' : (l.value ?? 0) < 45 ? 'low' : 'ok'}`}>
                        <div>
                          <strong>{l.name}</strong>
                          <span className="criteria-line-meta">
                            {STATUS_LABEL[l.status]}
                            {l.observed && ` · ${l.observed.label}`}
                            {l.assessed && ` · ${l.assessed.methodLabel ?? 'ارزیابی'}`}
                            {l.answerAgeDays != null && ` · ${faNum(l.answerAgeDays)} روز پیش`}
                          </span>
                        </div>
                        <div className="criteria-line-score">
                          {l.value == null ? <em>—</em> : <b>{faNum(l.value)}</b>}
                          {l.value != null && <small>سهم {faNum(Math.round((l.weightPct ?? 0) * (l.value ?? 0) / 100))} · اطمینان {faNum(l.confidence)}٪</small>}
                        </div>
                        <p className="criteria-line-hint">{l.actionHint}</p>
                        {l.note && <p className="criteria-line-note">یادداشت: {l.note}</p>}
                        {l.evidence && <p className="criteria-line-note">مدرک: {l.evidence}</p>}
                        {!!l.sources?.length && <p className="criteria-line-src">مبنای تحقیقی: {l.sources.join(' · ')}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {!!data.unknown?.length && (
            <div className="criteria-unknown">
              <strong>معیارهای بدون داده ({faNum(data.unknown.length)})</strong>
              <p>برای این‌ها عددی گذاشته نشده تا امتیاز مصنوعی به‌نظر نرسد. نزدیک‌ترین‌ها به تأثیر:</p>
              <ul>
                {data.unknown.slice(0, 8).map((u) => (
                  <li key={u.code}><span>{u.name}</span>{u.weightPct >= 1.5 && <em>{faNum(u.weightPct)}٪ وزن</em>}{u.prompt && <small>{u.prompt}</small>}</li>
                ))}
              </ul>
              <div className="toolbar">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><PenLine size={13} /> پاسخ به این پرسش‌ها</button>
                <button className="btn btn-secondary btn-sm" onClick={remind} disabled={nudgeBusy}><BellRing size={12} /> یادآوری بده</button>
              </div>
            </div>
          )}

          {!!data.hints?.length && (
            <ul className="criteria-hints">
              {data.hints.map((h, i) => <li key={i}><Info size={13} /> {h}</li>)}
            </ul>
          )}
          <p className="criteria-foot">
            امتیاز فقط از {faNum(data.known)} معیارِ دارای داده ساخته شده است؛ {faNum(100 - data.coverage)}٪ وزن مدل هنوز بدون شواهد است.
            {data.computedAt ? ` محاسبه: ${new Date(data.computedAt).toLocaleString('fa-IR')}.` : ''}
          </p>
        </>
      )}
    </section>
  );
}
