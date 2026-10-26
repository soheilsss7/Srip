/* ============================================================================
   Criteria-based scoring — shared mobile UI (same catalog as the API).
   · CriteriaIntake : optional questionnaire shown while creating a record;
     the answers feed the very same criteria the score is computed from.
   · CriteriaScore  : score + information coverage + confidence + unknowns.
   · CriteriaChip   : compact badge for list rows.
   Unknown criteria are never imputed as zero: a blank answer stays blank and
   lowers coverage instead of lowering the score.
   ============================================================================ */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, apiGet, apiPostOffline } from '../services/api-client';
import { colors } from '../lib/ui';

export type Anchor = { level: number; label: string; score: number };
export type Question = {
  code: string; criterionCode: string; family: string; familyName: string; prompt: string; help: string;
  recommended: boolean; polarity: 'GOOD' | 'BAD'; anchors: Anchor[]; warning?: string | null;
};
export type AnswerMap = Record<string, { level: number | null; note?: string; evidence?: string }>;
export type Summary = {
  score: number; coverage: number; confidence: number; rangeLow: number; rangeHigh: number;
  rankable: boolean; verdict: string; verdictLabel: string; verdictHint?: string; known: number; total: number;
  gateCap?: number | null; flags?: { code: string; severity: string; message?: string }[];
};
type Line = {
  code: string; name: string; value: number | null; confidence: number;
  status: 'OBSERVED' | 'ASSESSED' | 'BLENDED' | 'UNKNOWN'; actionHint?: string; needsReview?: boolean;
  note?: string | null;
  assessed?: { value: number; level: number; methodLabel?: string; confidence: number } | null;
};
type Assessment = Summary & {
  criteria?: Line[]; unknown?: { code: string; name: string; family: string }[];
  families?: { family: string; name: string; score: number | null; weightPct: number; coveragePct: number; known: number; total: number }[];
  hints?: string[];
};
export type SubjectType = 'ORGANIZATION' | 'PERSON' | 'RELATIONSHIP' | 'OPPORTUNITY';

const pct = (v?: number | null) => (v == null ? '—' : `${Math.round(v)}%`);
const toneColor = (v: string) =>
  v === 'CRITICAL' || v === 'AT_RISK' ? colors.danger : v === 'STRONG' ? colors.success : v === 'INSUFFICIENT_DATA' || v === 'PRELIMINARY' ? '#B54708' : colors.accent;
/** Environments without /criteria routes: hide the block instead of showing an error. */
const isMissing = (e: unknown) => {
  const err = e as { status?: number; message?: string };
  return err?.status === 404 || /not found|404|وجود ندارد/i.test(String(err?.message ?? ''));
};

/** Answer map → API payload (only answered criteria are sent). */
export function intakePayload(answers: AnswerMap) {
  return Object.entries(answers)
    .filter(([, a]) => a?.level != null)
    .map(([criterionCode, a]) => ({
      criterionCode, level: a.level ?? null, note: a.note?.trim() || null,
      evidence: a.evidence?.trim() || null, method: 'OWNER_ASSESSED',
    }));
}

export function useCriteriaQuestions(subjectType: SubjectType, token?: string | null) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true); setMissing(false);
    apiGet<any>('/criteria/questionnaire/' + subjectType, token)
      .then((data: any) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data?.questions ?? []);
        setQuestions(list);
        setTotal(data?.totalCriteria ?? list.length);
      })
      .catch((e) => { if (alive && isMissing(e)) setMissing(true); else if (alive) setQuestions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subjectType, token]);
  return { questions, total, loading, missing };
}

/* ─────────────────────────── optional intake at creation time ─────────────────────────── */
export function CriteriaIntake({
  subjectType, answers, onChange, title = 'Criteria (optional)', recommendedOnly = true, token,
}: { subjectType: SubjectType; answers: AnswerMap; onChange: (next: AnswerMap) => void; title?: string; recommendedOnly?: boolean; token?: string | null }) {
  const { questions, total, loading, missing } = useCriteriaQuestions(subjectType, token);
  const [showAll, setShowAll] = useState(!recommendedOnly);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const visible = useMemo(() => (showAll ? questions : questions.filter((q) => q.recommended)), [questions, showAll]);
  if (missing) return null;
  const answered = Object.values(answers).filter((a) => a?.level != null).length;

  function pick(q: Question, level: number | null) {
    const next = { ...answers };
    if (level == null) delete next[q.criterionCode];
    else next[q.criterionCode] = { ...next[q.criterionCode], level };
    onChange(next);
  }
  function setNote(q: Question, note: string) {
    onChange({ ...answers, [q.criterionCode]: { ...(answers[q.criterionCode] ?? { level: null }), note } });
  }

  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{title}</Text>
      <Text style={s.blockHint}>Every question is optional. A blank answer is not a zero — it stays on the “no data” list and lowers coverage instead of the score.</Text>
      {loading ? <ActivityIndicator /> : null}
      {!loading && !visible.length ? <Text style={s.blockHint}>No criteria defined for this record type yet.</Text> : null}
      {visible.map((q) => {
        const current = answers[q.criterionCode]?.level ?? null;
        return (
          <View key={q.code} style={s.question}>
            <Text style={s.questionText}>{q.prompt}</Text>
            {!!q.help && <Text style={s.questionHelp}>{q.help}</Text>}
            <View style={s.chips}>
              {q.anchors.map((a) => {
                const on = current === a.level;
                const bad = q.polarity === 'BAD' ? a.score >= 60 : a.score < 40;
                return (
                  <Pressable key={a.level} onPress={() => pick(q, a.level)} accessibilityRole="button"
                    accessibilityLabel={`${q.prompt} — ${a.label}`} accessibilityState={{ selected: on }}
                    hitSlop={4}
                    style={[s.chip, on && { backgroundColor: bad ? colors.danger : colors.accent, borderColor: bad ? colors.danger : colors.accent }]}>
                    <Text style={[s.chipText, on && { color: '#fff' }]} numberOfLines={2}>{a.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => pick(q, null)} accessibilityRole="button" accessibilityLabel="Unknown — leave this criterion without data"
                style={[s.chip, s.chipGhost]}>
                <Text style={[s.chipText, s.chipGhostText]}>
                  <Text style={{ writingDirection: 'rtl' }}>{'\u0646\u0645\u06cc\u200c\u062f\u0627\u0646\u0645'}</Text>
                  {' · unknown'}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setOpenNote(openNote === q.criterionCode ? null : q.criterionCode)}>
              <Text style={s.noteToggle}>{answers[q.criterionCode]?.note ? 'Edit note' : '+ Evidence / note'}</Text>
            </Pressable>
            {openNote === q.criterionCode ? (
              <TextInput style={s.noteInput} multiline value={answers[q.criterionCode]?.note ?? ''} onChangeText={(v) => setNote(q, v)}
                placeholder="What is this based on? (document, meeting, contract…)" placeholderTextColor={colors.muted} />
            ) : null}
            {!!q.warning && current != null && q.polarity === 'BAD' && (q.anchors.find((a) => a.level === current)?.score ?? 0) >= 60 ? (
              <Text style={s.warn}>{q.warning}</Text>
            ) : null}
          </View>
        );
      })}
      {questions.length > visible.length ? (
        <Pressable onPress={() => setShowAll((v) => !v)} style={s.moreBtn}>
          <Text style={s.moreText}>{showAll ? `Show only ${questions.filter((q) => q.recommended).length} recommended` : `Show all ${questions.length} criteria questions`}</Text>
        </Pressable>
      ) : null}
      {answered > 0 ? (
        <Text style={s.foot}>
          {answered} of {total || questions.length} criteria answered — the score starts from these and keeps updating as real behaviour is recorded.
        </Text>
      ) : null}
    </View>
  );
}

/* ─────────────────────────── score card for detail screens ─────────────────────────── */
export function CriteriaScore({ subjectType, subjectId, token, onSaved }: { subjectType: SubjectType; subjectId: string; token?: string | null; onSaved?: () => void }) {
  const [data, setData] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setMissing(false);
    try {
      const res = await apiGet<Assessment>(`/criteria/assessment/${subjectType}/${subjectId}`, token);
      setData(res ?? null);
      // پیش‌پرکردن حالت ویرایش با پاسخ‌های انسانیِ فعلی (نه رفتار مشاهده‌شده) تا عدد قبلی گم نشود
      setAnswers(Object.fromEntries(
        (res?.criteria ?? [])
          .filter((l) => l.assessed)
          .map((l) => [l.code, { level: l.assessed!.level, note: l.note ?? '' }]),
      ));
    } catch (e) {
      if (isMissing(e)) setMissing(true); else setError((e as Error).message);
    } finally { setLoading(false); }
  }, [subjectType, subjectId, token]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const payload = intakePayload(answers);
    if (!payload.length) { setEditing(false); return; }
    setSaving(true); setError('');
    try {
      await apiPostOffline(`/criteria/assessment/${subjectType}/${subjectId}`, { answers: payload, source: 'ASSESSMENT' }, token);
      if (subjectType === 'RELATIONSHIP') await api(`/scores/relationship/${subjectId}/recalculate`, { method: 'POST' }, token).catch(() => undefined);
      setEditing(false);
      await load();
      onSaved?.();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  if (loading) return <View style={s.card}><ActivityIndicator /></View>;
  if (missing) return null;
  if (!data) return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Criteria score</Text>
      <Text style={s.blockHint}>{error || 'No criteria assessment available for this record.'}</Text>
      <Pressable style={s.smallBtn} onPress={() => setEditing(true)}><Text style={s.smallBtnText}>Add assessment</Text></Pressable>
      {editing ? <CriteriaIntake subjectType={subjectType} answers={answers} onChange={setAnswers} title="Your assessment" recommendedOnly={false} token={token} /> : null}
      {editing ? <Pressable style={s.primaryBtn} disabled={saving} onPress={save}><Text style={s.primaryBtnText}>{saving ? 'Saving…' : 'Save assessment'}</Text></Pressable> : null}
    </View>
  );

  const color = toneColor(data.verdict);
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>Criteria score</Text>
        <Pressable style={s.smallBtn} onPress={() => setEditing((v) => !v)}><Text style={s.smallBtnText}>{editing ? 'Cancel' : 'Update'}</Text></Pressable>
      </View>
      <View style={s.headline}>
        <View style={{ flex: 1 }}>
          <Text style={[s.bigScore, { color }]}>{Math.round(data.score)}</Text>
          <Text style={s.bigScoreSub}>out of 100 · expected range {Math.round(data.rangeLow)}–{Math.round(data.rangeHigh)}</Text>
          <Text style={[s.verdict, { color }]}>{data.verdictLabel}</Text>
        </View>
        {!data.rankable ? <View style={s.flagBox}><Text style={s.flagText}>Not comparable yet — coverage or confidence is too low</Text></View> : null}
        {data.gateCap != null ? <View style={[s.flagBox, { borderColor: colors.danger }]}><Text style={[s.flagText, { color: colors.danger }]}>Risk gate caps this at {Math.round(data.gateCap)}</Text></View> : null}
      </View>
      <Meter label="Information coverage" value={data.coverage} color={colors.accent} />
      <Meter label="Evidence confidence" value={data.confidence} color={data.confidence >= 65 ? colors.success : '#B54708'} />
      <Text style={s.blockHint}>{data.verdictHint}</Text>
      {!!data.flags?.length && data.flags.map((f) => (
        <View key={f.code} style={[s.flagBox, { borderColor: colors.danger }]}><Text style={[s.flagText, { color: colors.danger }]}>{f.message ?? f.severity}</Text></View>
      ))}
      {(data.families ?? []).length ? (
        <View style={{ gap: 6, marginTop: 4 }}>
          {data.families!.map((f) => (
            <View key={f.family} style={s.familyRow}>
              <Text style={s.familyName} numberOfLines={1}>{f.name}</Text>
              <View style={s.familyBar}><View style={[s.familyBarFill, { width: `${Math.max(0, Math.min(100, f.coveragePct))}%`, backgroundColor: f.score == null ? colors.border : toneColor(f.score >= 70 ? 'STRONG' : f.score >= 45 ? 'SOLID' : 'AT_RISK') }]} /></View>
              <Text style={s.familyValue}>{f.score == null ? 'no data' : Math.round(f.score)}</Text>
              <Text style={s.familyKnown}>{f.known}/{f.total}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {(data.unknown ?? []).length ? (
        <View style={s.unknownBox}>
          <Text style={s.unknownTitle}>{data.unknown!.length} criteria have no data yet</Text>
          {data.unknown!.slice(0, 6).map((u) => <Text key={u.code} style={s.unknownItem}>· {u.name}</Text>)}
          {data.unknown!.length > 6 ? <Text style={s.unknownItem}>· …{data.unknown!.length - 6} more</Text> : null}
        </View>
      ) : null}
      {!!data.hints?.length && data.hints.slice(0, 3).map((h) => <Text key={h} style={s.hint}>→ {h}</Text>)}
      {editing ? (
        <>
          <CriteriaIntake subjectType={subjectType} answers={answers} onChange={setAnswers} title="Record or correct an assessment" recommendedOnly={false} token={token} />
          <Pressable style={s.primaryBtn} disabled={saving} onPress={save}><Text style={s.primaryBtnText}>{saving ? 'Saving…' : 'Save assessment'}</Text></Pressable>
        </>
      ) : null}
    </View>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.meterLabel}>{label}</Text>
        <Text style={[s.meterValue, { color }]}>{pct(v)}</Text>
      </View>
      <View style={s.meterTrack}><View style={[s.meterFill, { width: `${v}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

/** Compact badge for list rows. */
export function CriteriaChip({ criteria }: { criteria?: Summary | null }) {
  if (!criteria) return <Text style={s.chipMuted}>No assessment yet</Text>;
  const color = toneColor(criteria.verdict);
  return (
    <View style={[s.chipInline, { borderColor: color }]}>
      <Text style={[s.chipInlineText, { color }]}>{criteria.rankable ? 'score' : 'partial'} {Math.round(criteria.score)} · {pct(criteria.coverage)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 10 },
  blockTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  blockHint: { fontSize: 12.5, color: colors.muted, lineHeight: 19 },
  question: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  questionText: { fontSize: 14.5, fontWeight: '700', color: colors.text, lineHeight: 22, writingDirection: 'rtl' },
  questionHelp: { fontSize: 12, color: colors.muted, lineHeight: 18, writingDirection: 'rtl' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text, writingDirection: 'rtl' },
  chipGhost: { borderStyle: 'dashed' },
  chipGhostText: { color: colors.muted },
  noteToggle: { minHeight: 32, fontSize: 12, color: colors.accent, fontWeight: '700', writingDirection: 'rtl' },
  noteInput: { minHeight: 68, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.text, backgroundColor: '#fff', textAlignVertical: 'top' },
  warn: { fontSize: 12, color: colors.danger, fontWeight: '700' },
  moreBtn: { minHeight: 44, justifyContent: 'center' },
  moreText: { fontSize: 12.5, color: colors.accent, fontWeight: '700' },
  foot: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 9 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bigScore: { fontSize: 34, fontWeight: '900', lineHeight: 40 },
  bigScoreSub: { fontSize: 11.5, color: colors.muted },
  verdict: { fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  flagBox: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF3F2', borderRadius: 10, padding: 8, flex: 1 },
  flagText: { fontSize: 11.5, color: colors.muted, lineHeight: 17 },
  meterLabel: { fontSize: 11.5, color: colors.muted, fontWeight: '700' },
  meterValue: { fontSize: 11.5, fontWeight: '800' },
  meterTrack: { height: 6, borderRadius: 999, backgroundColor: '#EEF1F5', overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 999 },
  familyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  familyName: { flex: 2, fontSize: 12, color: colors.text, fontWeight: '600', writingDirection: 'rtl', textAlign: 'left' },
  familyBar: { flex: 2, height: 5, borderRadius: 999, backgroundColor: '#EEF1F5', overflow: 'hidden' },
  familyBarFill: { height: 5, borderRadius: 999 },
  familyValue: { width: 34, fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'right' },
  familyKnown: { width: 34, fontSize: 10.5, color: colors.muted, textAlign: 'right' },
  unknownBox: { gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 9, backgroundColor: colors.bg },
  unknownTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  unknownItem: { fontSize: 11.5, color: colors.muted, lineHeight: 17, writingDirection: 'rtl' },
  hint: { fontSize: 12, color: colors.accent, lineHeight: 18, writingDirection: 'rtl' },
  smallBtn: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 11, justifyContent: 'center' },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  primaryBtn: { minHeight: 46, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  chipMuted: { fontSize: 11.5, color: colors.muted },
  chipInline: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: '#fff' },
  chipInlineText: { fontSize: 11, fontWeight: '800' },
});
