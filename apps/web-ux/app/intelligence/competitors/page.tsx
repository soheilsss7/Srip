'use client';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../../_components/workspace';
import { api } from '../../_lib/api';
import { faNum, faFullDate } from '../../_lib/jalali';
import { t } from '../../_lib/i18n';
import IntelHub from '../../_components/intel-hub';
import {
  Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard, EmptyV4,
} from '../../_components/page-ui';
import {
  AlertTriangle, ArrowLeft, Crosshair, Pencil, Plus, RefreshCw, Swords, Target, TrendingUp, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۲.۴ مسترپلن — پروندهٔ رقیب ۷بُعدی (فرم ۵ سند، بخش ۹)
   تحلیل رقبا فراتر از فهرست نام‌هاست؛ هدف، یافتن «شکاف جایگاه» است — جایی که
   سازمان می‌تواند مرجع شود و دیگران نیستند. هفت بُعد جایگاه‌یابی + ماتریس شکاف؛
   سه حوزهٔ بیشترین شکاف = محور مرجعیت‌سازی. رقبا و نمرات = دادهٔ سازمان.
   ═══════════════════════════════════════════════════════════════════════════ */

const GAP_FA: Record<string, string> = { LEAD: t('پیشی'), LAG: t('عقب'), EVEN: t('برابر') };
const GAP_TONE: Record<string, 'success' | 'danger' | 'neutral'> = { LEAD: 'success', LAG: 'danger', EVEN: 'neutral' };
const DIM_SHORT: Record<string, string> = {
  dataAuthority: t('مرجعیت داده'), analysisDepth: t('عمق تحلیل'), mediaPresence: t('حضور رسانه‌ای'),
  partnershipNetwork: t('شبکه مشارکت'), eventQuality: t('کیفیت رویداد'), policyAuthority: t('مرجعیت سیاستی'),
  aiVisibility: t('دیده‌شدن در موتورهای هوش مصنوعی'),
};

const faDate = (iso?: string | null) => (iso ? faFullDate(new Date(iso)) : '—');

export default function CompetitorsPage() {
  const { can } = useWorkspace();
  const writable = can('analytics.write');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [editRow, setEditRow] = useState<any | null>(null); /* رقیب یا self برای ویرایش */
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const emptyScores: Record<string, string> = {
    dataAuthority: '', analysisDepth: '', mediaPresence: '', partnershipNetwork: '', eventQuality: '', policyAuthority: '', aiVisibility: '',
  };
  const [form, setForm] = useState({ name: '', segment: '', notes: '', ownerRole: '' });
  const [scores, setScores] = useState<Record<string, string>>({ ...emptyScores });
  const [assets, setAssets] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api<any>('/intelligence/competitors')); }
    catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCreateOpen(true); setFormError('');
    setForm({ name: '', segment: '', notes: '', ownerRole: '' });
    setScores({ ...emptyScores }); setAssets([]);
  };

  const openEdit = (row: any) => {
    setEditRow(row); setFormError('');
    setForm({ name: row.name, segment: row.segment, notes: row.notes ?? '', ownerRole: row.ownerRole ?? '' });
    const sc: Record<string, string> = {};
    for (const d of row.dimensions ?? []) sc[d.key] = String(d.score);
    setScores(sc); setAssets(row.assets ?? []);
  };

  const submit = async () => {
    setFormError(''); setBusy(true);
    try {
      const payload = {
        ...form,
        assets,
        scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Number(v) || 0])),
      };
      if (editRow) await api(`/intelligence/competitors/${editRow.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/intelligence/competitors', { method: 'POST', body: JSON.stringify(payload) });
      setEditRow(null); setCreateOpen(false);
      load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`${t('حذف پروندهٔ رقیب')} «${row.name}»؟`)) return;
    setBusy(true);
    try { await api(`/intelligence/competitors/${row.id}`, { method: 'DELETE' }); load(); }
    catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  };

  const items: any[] = data?.items ?? [];
  const self = items.find((x: any) => x.isSelf);
  const others = items.filter((x: any) => !x.isSelf);
  const matrix = data?.matrix;
  const modal = createOpen || !!editRow;

  return (
    <main className="feature-page">
      <IntelHub />
      <PageHeader
        title={t('رقبا و شکاف جایگاه')}
        description={t('پروندهٔ هفت‌بُعدی هر رقیب کلیدی و ماتریس شکاف جایگاه — سه حوزهٔ دارای بیشترین شکاف، محور مرجعیت‌سازی می‌شوند.')}
        actions={<div className="heading-tools">
          <button className="srip-button" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('بازخوانی')}</button>
          {writable ? <button className="srip-button primary" onClick={openCreate}><Plus size={14} /> {t('پروندهٔ رقیب جدید')}</button> : null}
        </div>}
      />
      <ErrorCard message={error} />
      {loading && !data ? <Loading /> : null}

      {data && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Swords size={18} />} iconClass="ic-red" label={t('رقبای کلیدی پرونده‌دار')}
              value={faNum(others.length)} sub={t('هر رقیب با هفت بُعد جایگاه‌یابی نمره‌دهی می‌شود')} />
            <StatCard icon={<Target size={18} />} iconClass="ic-teal" label={t('ابعاد پیشی (شکاف مثبت)')}
              value={faNum(matrix?.dims?.filter((d: any) => d.position === 'LEAD').length ?? 0)}
              sub={t('جاهایی که می‌توانیم مرجع شویم و دیگران نیستند')} />
            <StatCard icon={<TrendingUp size={18} />} iconClass="ic-gold" label={t('بیشترین عقب‌ماندگی')}
              value={matrix?.worstLag ? `${DIM_SHORT[matrix.worstLag.key]} (${faNum(matrix.worstLag.gap)})` : '—'}
              sub={t('نیازمند سرمایه‌گذاری در این بُعد')} />
            <StatCard icon={<Crosshair size={18} />} iconClass="ic-blue" label={t('محورهای مرجعیت‌سازی')}
              value={faNum((data.topGaps ?? []).length)} sub={t('سه حوزهٔ دارای بیشترین شکاف مثبت')} />
          </div>
          <div className="note-strip"><Crosshair size={15} />
            <span>{data.rule}</span>
          </div>

          {(data.topGaps ?? []).length ? (
            <div className="gap-axes">
              {(data.topGaps ?? []).map((g: any, i: number) => (
                <div key={g.key} className="gap-axis">
                  <span className="gap-axis-n">{faNum(i + 1)}</span>
                  <div>
                    <b>{g.label}</b>
                    <span className="t-muted" style={{ fontSize: 11 }}>{t('شکاف مثبت')} {faNum(g.gap)}+ {t('نمره نسبت به بهترین رقیب')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!items.length ? (
            <EmptyV4 icon={<Swords size={30} />} title={t('هنوز پروندهٔ رقیبی ثبت نشده است')}
              description={t('پروندهٔ رقیب کلیدی خود را با هفت بُعد جایگاه‌یابی ثبت کنید تا ماتریس شکاف ساخته شود؛ پروفایل خودِ سازمان مبنای سنجش است.')}
              action={writable ? <button className="srip-button primary" onClick={openCreate}><Plus size={14} /> {t('پروندهٔ رقیب جدید')}</button> : undefined} />
          ) : (
            <SectionCard title={t('جدول جایگاه‌یابی')} icon={<Swords size={17} />}
              description={t('نمرهٔ هر بُعد از ابزار سنجش متناظرش به دست می‌آید؛ پروفایل خودِ سازمان مبنای ماتریس شکاف است.')}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('پرونده')}</th><th>{t('بخش')}</th>
                      {(data.dimensions ?? []).map((d: any) => <th key={d.key}>{d.label}</th>)}
                      <th>{t('دارایی‌های ارتباطی')}</th><th>{t('بازبینی')}</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row: any) => (
                      <tr key={row.id} className={row.isSelf ? 'comp-self' : ''}>
                        <td>
                          <div className="t-primary">{row.name}</div>
                          {row.isSelf ? <Badge tone="info">{t('خودِ سازمان')}</Badge> : null}
                        </td>
                        <td className="t-muted" style={{ fontSize: 11 }}>{row.segment}</td>
                        {(row.dimensions ?? []).map((d: any) => (
                          <td key={d.key}>
                            <div className="comp-score">
                              <b>{faNum(d.score)}</b>
                              <div className="prog-bar comp-bar"><div className={`prog-fill ${d.score >= 70 ? 'ok' : d.score >= 40 ? 'warn' : 'bad'}`} style={{ width: `${d.score}%` }} /></div>
                            </div>
                          </td>
                        ))}
                        <td>
                          <div className="chip-row">
                            {(row.assets ?? []).length ? row.assets.map((a: string) => <span key={a} className="chip purple">{a}</span>) : <span className="t-muted">—</span>}
                          </div>
                        </td>
                        <td className="t-muted" style={{ fontSize: 11 }}>{faDate(row.reviewAt)}</td>
                        <td>
                          {writable ? (
                            <div className="row-actions">
                              <button type="button" className="srip-button" style={{ padding: '3px 9px' }} onClick={() => openEdit(row)}><Pencil size={13} /></button>
                              {!row.isSelf ? <button type="button" className="srip-button" style={{ padding: '3px 9px' }} disabled={busy} onClick={() => remove(row)}><X size={13} /></button> : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {matrix && others.length ? (
            <SectionCard title={t('ماتریس شکاف جایگاه')} icon={<Crosshair size={17} />}
              description={t('شکاف هر بُعد = نمرهٔ خودِ سازمان منهای بهترین رقیب؛ مثبت یعنی پیشی (فرصت مرجعیت)، منفی یعنی عقب‌ماندگی.')}>
              <div className="table-wrap">
                <table className="comp-matrix">
                  <thead>
                    <tr>
                      <th>{t('بُعد')}</th><th>{matrix.selfName ?? t('خودِ سازمان')}</th>
                      {others.map((o: any) => <th key={o.id}>{o.name}</th>)}
                      <th>{t('شکاف')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.dims.map((d: any) => (
                      <tr key={d.key}>
                        <td>
                          <div className="t-primary">{d.label}</div>
                          <div className="t-muted" style={{ fontSize: 10.5 }}>{d.tool}</div>
                        </td>
                        <td className={`cm-cell ${d.position === 'LEAD' ? 'lead' : d.position === 'LAG' ? 'lag' : ''}`}><b>{faNum(d.selfScore ?? 0)}</b></td>
                        {d.per.map((p: any) => (
                          <td key={p.id} className={`cm-cell ${p.score < (d.selfScore ?? 0) ? 'lead' : p.score > (d.selfScore ?? 0) ? 'lag' : ''}`}>
                            {faNum(p.score)}
                          </td>
                        ))}
                        <td>
                          <Badge tone={GAP_TONE[d.position ?? 'EVEN']}>{d.gap == null ? '—' : `${d.gap > 0 ? '+' : ''}${faNum(d.gap)}`} · {GAP_FA[d.position ?? 'EVEN']}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}
        </>
      )}

      {/* ═══════════ مودال: ثبت/ویرایش پروندهٔ رقیب (فرم ۵) ═══════════ */}
      <Modal open={modal} title={editRow ? `${t('ویرایش پروندهٔ رقیب')} — ${editRow.name}` : t('پروندهٔ رقیب جدید')} onClose={() => { setCreateOpen(false); setEditRow(null); }}
        description={editRow?.isSelf ? t('خودارزیابی هفت‌بُعدی سازمان — مبنای ماتریس شکاف جایگاه.') : t('نمرهٔ هر بُعد عددی بین ۰ تا ۱۰۰ است و از ابزار سنجش متناظرش به دست می‌آید.')}>
        <form id="competitor-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field-pair">
            <label className="field">
              <span>{t('نام رقیب')} *</span>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required minLength={3} />
            </label>
            <label className="field">
              <span>{t('بخش/حوزه')} *</span>
              <input value={form.segment} onChange={(e) => setForm(f => ({ ...f, segment: e.target.value }))} required placeholder={t('مثلاً: اندیشکده پژوهشی')} />
            </label>
          </div>
          {(data?.dimensions ?? []).map((d: any) => (
            <label className="field" key={d.key}>
              <span>{d.label} <span className="t-muted" style={{ fontSize: 10.5 }}>— {d.tool}</span></span>
              <input type="number" min={0} max={100} value={scores[d.key] ?? ''} required
                onChange={(e) => setScores((sc: Record<string, string>) => ({ ...sc, [d.key]: e.target.value }))} />
            </label>
          ))}
          <label className="field">
            <span>{t('دارایی‌های ارتباطی (چک‌لیست فرم ۵)')}</span>
            <div className="chip-row">
              {(data?.assets ?? []).map((a: string) => (
                <button type="button" key={a} className={`chip ${assets.includes(a) ? 'purple' : ''}`} style={{ cursor: 'pointer' }}
                  onClick={() => setAssets((prev: string[]) => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}>
                  {a}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span>{t('مالک پرونده')}</span>
            <input value={form.ownerRole} onChange={(e) => setForm(f => ({ ...f, ownerRole: e.target.value }))} placeholder={t('نقش مسئول پیگیری')} />
          </label>
          <label className="field">
            <span>{t('یادداشت')}</span>
            <input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </label>
          {formError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{formError}</span></div> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="srip-button" onClick={() => { setCreateOpen(false); setEditRow(null); }}><X size={14} /> {t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ذخیرهٔ پرونده')}</button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
