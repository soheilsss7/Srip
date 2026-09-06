'use client';
/* ============================================================================
   مدیریت معیارها — کاتالوگ، وزن خانوادگی، پرچم‌های دروازه و تقویم بازبینی.
   هیچ معیاری اینجا ساخته نمی‌شود: کاتالوگ از API خوانده می‌شود و تنها چیزی که
   یک سازمان می‌تواند تغییر دهد وزن خانواده‌ها و آستانۀ رتبه‌بندی است (داده‌محور،
   بدون تغییر کد).
   ============================================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { AdminNav, ErrorCard, Loading, PageHeader, StatusBadge } from '../../_components/page-ui';
import { BookOpenCheck, Gauge, Scale, Save, ShieldAlert } from 'lucide-react';

type Family = { key: string; name: string; nameEn: string; rationale: string; criteria: string[] };
type Criterion = {
  code: string; family: string; familyName?: string; name: string; nameEn: string; why: string;
  appliesTo: string[]; polarity: 'GOOD' | 'BAD'; weight: number; evidence: string; halfLifeDays: number;
  sources: string[]; observedFrom?: string | null; intake?: { prompt: string; help: string; recommended: boolean } | null;
  gate?: { trigger: string; threshold: number; cap: number; severity: string; message: string } | null;
};
const faNum = (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('fa-IR').format(Math.round(v)));
const SUBJECTS = [
  { key: 'ORGANIZATION', label: 'سازمان' },
  { key: 'PERSON', label: 'شخص' },
  { key: 'RELATIONSHIP', label: 'رابطه' },
  { key: 'OPPORTUNITY', label: 'فرصت' },
] as const;
type SubjectKey = (typeof SUBJECTS)[number]['key'];
const EVIDENCE_LABEL: Record<string, string> = { ASSESSED: 'ارزیابی انسانی', OBSERVED: 'رفتار مشاهده‌شده', BOTH: 'هر دو — وزن پویا' };

export default function Page() {
  const [catalog, setCatalog] = useState<{ version: string; families: Family[]; criteria: Criterion[] } | null>(null);
  const [defaults, setDefaults] = useState<Record<string, Record<string, number>>>({});
  const [queue, setQueue] = useState<{ tasks: any[]; staleAnswers: any[]; total: number } | null>(null);
  const [subject, setSubject] = useState<SubjectKey>('RELATIONSHIP');
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [minCoverage, setMinCoverage] = useState(40);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [cat, ov, rq] = await Promise.all([
        api('/criteria'),
        api('/criteria/overrides/default').catch(() => null),
        api('/criteria/review-queue').catch(() => null),
      ]);
      setCatalog(cat as any);
      setDefaults(((ov as any)?.defaults ?? {}) as Record<string, Record<string, number>>);
      setQueue(rq as any);
      const first = (ov as any)?.overrides?.[0];
      if (first?.minCoverageForRanking) setMinCoverage(Number(first.minCoverageForRanking));
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (defaults[subject]) setDraft({ ...defaults[subject] }); }, [subject, defaults]);

  const families = catalog?.families ?? [];
  const list = useMemo(
    () => (catalog?.criteria ?? []).filter((c) => c.appliesTo.includes(subject) && (familyFilter === 'ALL' || c.family === familyFilter)),
    [catalog, subject, familyFilter],
  );
  const gated = useMemo(() => (catalog?.criteria ?? []).filter((c) => c.gate), [catalog]);
  const total = Object.values(draft).reduce((sum, v) => sum + (Number(v) || 0), 0) || 1;

  async function saveWeights() {
    setSaving(true); setError(''); setSaved('');
    try {
      const normalized = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Math.round(((Number(v) || 0) / total) * 10000) / 10000]));
      const res: any = await api('/criteria/overrides/default', {
        method: 'PATCH',
        body: JSON.stringify({ subjectType: subject, familyWeights: normalized, minCoverageForRanking: minCoverage }),
      });
      setDefaults((d) => ({ ...d, [subject]: res.familyWeights }));
      setSaved(`ذخیره شد — محاسبۀ «${SUBJECTS.find((s) => s.key === subject)?.label}» از این پس با همین سهم‌ها انجام می‌شود.`);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  if (loading) return <main className="feature-page"><PageHeader eyebrow="مدیریت" title="معیارهای ارزیابی" description="" /><Loading /></main>;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت"
        title="معیارهای ارزیابی"
        description={`کاتالوگ ${faNum(catalog?.criteria.length ?? 0)} معیار در ${faNum(families.length)} خانواده؛ هر معیار به یک پژوهش یا استاندارد مرجع گره خورده است. امتیاز فقط از معیارهای دارای داده ساخته می‌شود و بقیه در فهرست «بدون داده» می‌مانند.`}
        actions={<span className="chip info">{catalog?.version ?? 'criteria'}</span>}
      />
      <AdminNav />
      <ErrorCard message={error} />

      <div className="criteria-admin-grid">
        <section className="section-card">
          <div className="section-head">
            <div>
              <h2><Scale size={15} /> وزن خانوادگی — {SUBJECTS.find((s) => s.key === subject)?.label}</h2>
              <p>سهم هر خانواده در امتیاز. مجموع به‌صورت خودکار نرمال می‌شود. خانوادۀ بدون داده در تقسیم وزن حساب نمی‌شود تا «نبودِ اطلاعات» خودش نمره نگیرد.</p>
            </div>
          </div>
          <div className="criteria-weight-list">
            {families.map((f) => (
              <label key={f.key} className="criteria-weight-row">
                <span>{f.name}</span>
                <input
                  type="number" min={0} max={1} step={0.01} value={draft[f.key] ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Math.max(0, Number(e.target.value) || 0) }))}
                  aria-label={`وزن ${f.name}`}
                />
                <b>{faNum(((draft[f.key] ?? 0) / total) * 100)}٪</b>
                <small>{f.rationale}</small>
              </label>
            ))}
          </div>
          <div className="criteria-weight-foot">
            <label className="criteria-min-coverage">
              <span>حداقل پوشش برای رتبه‌بندی</span>
              <input type="number" min={0} max={100} step={5} value={minCoverage} onChange={(e) => setMinCoverage(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
              <small>زیر این پوشش رکورد «قابل مقایسه» حساب نمی‌شود و در فهرست‌های رتبه‌ای بالا نمی‌آید.</small>
            </label>
            <button className="btn btn-primary btn-sm" onClick={saveWeights} disabled={saving}><Save size={13} /> {saving ? 'در حال ذخیره…' : 'ذخیرهٔ وزن‌ها'}</button>
          </div>
          {saved && <p className="criteria-saved">{saved}</p>}
        </section>

        <section className="section-card">
          <div className="section-head">
            <div><h2><ShieldAlert size={15} /> پرچم‌های دروازۀ ریسک</h2><p>معیارهایی که اگر وضعیتشان بد باشد، سقف امتیاز را تعیین می‌کنند — میانگین‌گیری نمی‌شوند.</p></div>
          </div>
          <ul className="criteria-gate-list">
            {gated.map((c) => (
              <li key={c.code}>
                <strong>{c.name}</strong>
                <span>{c.gate?.trigger === 'ABOVE' ? 'اگر امتیاز ریسک بالاتر از' : 'اگر امتیاز پایین‌تر از'} {faNum(c.gate?.threshold)} ← سقف {faNum(c.gate?.cap)} ({c.gate?.severity})</span>
                <small>{c.gate?.message}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="section-card">
        <div className="section-head">
          <div><h2><BookOpenCheck size={15} /> کاتالوگ معیارها</h2><p>منبع هر معیار، نوع شواهد لازم و عمر اعتبار پاسخ.</p></div>
          <div className="toolbar">
            <select className="toolbar-select" value={subject} onChange={(e) => setSubject(e.target.value as SubjectKey)} aria-label="نوع سوژه">
              {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className="toolbar-select" value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)} aria-label="خانواده">
              <option value="ALL">همهٔ خانواده‌ها</option>
              {families.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
            </select>
            <span className="chip info">{faNum(list.length)} معیار</span>
          </div>
        </div>
        <div className="criteria-catalog">
          {list.map((c) => (
            <article key={c.code} className={`criteria-catalog-item${c.gate ? ' gated' : ''}`}>
              <header>
                <strong>{c.name}</strong>
                <span className="chip neutral">{families.find((f) => f.key === c.family)?.name ?? c.familyName ?? c.family}</span>
              </header>
              <p>{c.why}</p>
              <ul className="criteria-catalog-meta">
                <li><Gauge size={12} /> {EVIDENCE_LABEL[c.evidence] ?? c.evidence}</li>
                <li>وزن {faNum(c.weight)} از ۳</li>
                <li>اعتبار پاسخ {faNum(c.halfLifeDays)} روز</li>
                <li>{c.polarity === 'BAD' ? 'معیار ریسک (بالاتر = بدتر)' : 'معیار مثبت (بالاتر = بهتر)'}</li>
                {c.observedFrom && <li>مشاهده از: {c.observedFrom}</li>}
                {c.intake?.recommended && <li>پرسش پیشنهادی در لحظۀ ثبت رکورد</li>}
              </ul>
              <footer>منبع: {c.sources.join(' · ')}</footer>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-head">
          <div><h2>تقویم بازبینی</h2><p>هر معیار تاریخ انقضا دارد؛ پاسخ کهنه اطمینان را پایین می‌آورد و اینجا فهرست می‌شود.</p></div>
          <StatusBadge tone={queue && queue.total > 0 ? 'warning' : 'success'}>{faNum(queue?.total ?? 0)} مورد</StatusBadge>
        </div>
        {!queue?.total ? (
          <p className="criteria-saved">هیچ معیاری نیازمند بازبینی نیست.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>سوژه</th><th>معیار</th><th>علت</th><th>سن پاسخ</th></tr></thead>
              <tbody>
                {queue.staleAnswers.slice(0, 40).map((row: any, i: number) => (
                  <tr key={`${row.subjectId}-${row.criterionCode}-${i}`}>
                    <td>{row.subjectType} · {row.subjectId}</td>
                    <td>{row.name}</td>
                    <td>{row.reason}</td>
                    <td>{faNum(row.age)} روز</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
