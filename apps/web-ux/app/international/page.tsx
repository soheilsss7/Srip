'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../_components/workspace';
import { api, apiGet, apiBlob } from '../_lib/api';
import { faNum, faFullDate } from '../_lib/jalali';
import { t, lt } from '../_lib/i18n';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatusBadge, Toolbar, EmptyV4 } from '../_components/page-ui';
import { ArrowRightCircle, CalendarCheck2, Download, FileText, Globe, Languages, Plus, RefreshCw, Scale, Search, ShieldCheck, X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   فاز ۱۴ مسترپلن v14 — ارتباطات بین‌المللی (۱۰.۶ + F17/P17)
   پروندهٔ ارتباط و فرصت بین‌المللی: شش گروه هدف، هویت طرف ارتباط، متن مرجع فارسی،
   کنترل حقوقی/محرمانگی، پایش ماهانهٔ پنج‌معیاره و ارجاع فرصت واجد شرایط به F14.
   قاعدهٔ ثابت سربرگ: فروش و نهایی‌سازی فقط با مرجع مجاز فناوران.
   ═══════════════════════════════════════════════════════════════════════════ */

const IDENTITY_FA = lt<Record<string, string>>({ UNVERIFIED: 'بررسی‌نشده', IN_REVIEW: 'در حال بررسی', VERIFIED: 'تأییدشده', REJECTED: 'ردشده' });
const STATUS_FA = lt<Record<string, string>>({ OPEN: 'باز', IN_PROGRESS: 'در جریان', CLOSED: 'بسته' });
const CONF_FA = lt<Record<string, string>>({ PUBLIC: 'عمومی', LIMITED: 'محدود', CONFIDENTIAL: 'محرمانه' });
const SHARE_FA = lt<Record<string, string>>({ NONE: 'بدون اشتراک', LIMITED: 'محدود', FULL: 'کامل' });
const REVIEW_FA = lt<Record<string, string>>({ PENDING: 'در انتظار', PASSED: 'گذرنده', FAILED: 'ناموفق' });
const MSGTYPE_FA = lt<Record<string, string>>({ GENERAL: 'عمومی', PRODUCT: 'محصول‌محور' });
const LINK_FA = lt<Record<string, string>>({ ORG: 'سازمان', RELATION: 'رابطه', PERSON: 'شخص', NONE: '—' });
const IDENTITY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { UNVERIFIED: 'neutral', IN_REVIEW: 'info', VERIFIED: 'success', REJECTED: 'danger' };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { OPEN: 'info', IN_PROGRESS: 'warning', CLOSED: 'neutral' };
const REVIEW_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { PENDING: 'neutral', PASSED: 'success', FAILED: 'danger' };
const CORR_TYPE_FA = lt<Record<string, string>>({ EMAIL: 'ایمیل', MEETING: 'جلسه', CALL: 'تماس', LETTER: 'نامه', OTHER: 'سایر' });
const OWNER_ROLES = lt<string[]>(['مدیرعامل', 'مدیر اندیشکده و پژوهش', 'مدیر تحقیق و توسعه', 'مدیر توسعه کسب‌وکار', 'مدیر رسانه', 'مدیر استراتژی', 'مدیر محتوا', 'مدیر محصول', 'مدیر حساب']);

const faD = (iso?: string | null) => (iso ? faFullDate(new Date(iso)) : '—');

const EMPTY_FORM = lt<Record<string, string>>({
  country: '', market: '', targetGroup: '', orgName: '', contactName: '', source: '', purpose: '',
  linkType: 'NONE', linkRef: '', ddDossierId: '', message: '', messageType: 'GENERAL', evidence: '',
  confidentiality: 'PUBLIC', dataSharePerm: 'NONE', commitments: '', ownerRole: '', nextAction: '', dueAt: '',
});

type Tab = 'info' | 'corr' | 'texts' | 'reviews';

export default function InternationalPage() {
  const { can } = useWorkspace();
  const readable = can('international.read');
  const writable = can('international.write');
  const [overview, setOverview] = useState<any>(null);
  const [contacts, setContacts] = useState<any>(null);
  const [reviews, setReviews] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (msg: string) => { setFlash(msg); if (flashTimer.current) clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlash(''), 6000); };

  const [q, setQ] = useState('');
  const [fIdentity, setFIdentity] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM });
  const [createOpen, setCreateOpen] = useState(false);
  const [corr, setCorr] = useState({ type: 'EMAIL', summary: '' });
  const [tver, setTver] = useState({ lang: 'en', role: 'TRANSLATION', text: '', reviewer: '' });
  const [reviewForm, setReviewForm] = useState<any>(null);
  const [packs, setPacks] = useState<any[]>([]);
  const [packId, setPackId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ov, ct, rv] = await Promise.all([apiGet('/international/overview'), apiGet('/international/contacts'), apiGet('/international/reviews')]);
      setOverview(ov); setContacts(ct); setReviews(rv);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const items = contacts?.items ?? [];
  const filtered = useMemo(() => items.filter((r: any) => {
    if (fIdentity && r.identity !== fIdentity) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (q.trim()) {
      const hay = `${r.country ?? ''} ${r.orgName ?? ''} ${r.contactName ?? ''} ${r.purpose ?? ''} ${r.ownerRole ?? ''} ${r.targetGroupFa ?? ''}`;
      if (!hay.includes(q.trim())) return false;
    }
    return true;
  }), [items, q, fIdentity, fStatus]);

  /* ---------- ایجاد پروندهٔ F17 ---------- */
  const openCreate = () => { setFormError(''); setForm({ ...EMPTY_FORM }); setCreateOpen(true); };
  const submitCreate = async () => {
    setBusy('create'); setFormError('');
    try {
      const body: any = { ...form, textVersions: [{ lang: 'fa', role: 'REFERENCE', text: form.message }] };
      await api('/international/contacts', { method: 'POST', body: JSON.stringify(body) });
      setCreateOpen(false); notify('پروندهٔ ارتباط بین‌المللی ثبت شد.');
      await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  };

  /* ---------- ویرایش پرونده ---------- */
  const openDetail = (r: any) => { setDetail(r); setTab('info'); setFormError(''); setForm({ ...EMPTY_FORM, ...pickScalars(r) }); };
  const pickScalars = (r: any) => Object.fromEntries(['country', 'market', 'targetGroup', 'orgName', 'contactName', 'source', 'purpose', 'linkType', 'linkRef', 'ddDossierId', 'message', 'messageType', 'evidence', 'confidentiality', 'dataSharePerm', 'commitments', 'ownerRole', 'nextAction', 'dueAt', 'identity', 'legalReview', 'financialReview', 'status', 'reviewOutcome', 'reviewAt'].map(k => [k, String(r[k] ?? '')]));
  const saveDetail = async () => {
    if (!detail) return;
    setBusy('save'); setFormError('');
    try {
      const body: any = { ...form };
      for (const k of Object.keys(body)) if (body[k] === '' || body[k] == null) delete body[k];
      const r = await api<any>(`/international/contacts/${detail.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setDetail(r); notify('پرونده به‌روزرسانی شد.');
      await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  };
  const addCorr = async () => {
    if (!detail) return;
    setBusy('corr'); setFormError('');
    try {
      const r = await api<any>(`/international/contacts/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ correspondence: corr }) });
      setDetail(r); setCorr({ type: 'EMAIL', summary: '' }); notify('مکاتبه ثبت شد.');
      await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  };
  const addTextVersion = async () => {
    if (!detail) return;
    setBusy('tver'); setFormError('');
    try {
      const r = await api<any>(`/international/contacts/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ textVersion: tver }) });
      setDetail(r); setTver({ lang: 'en', role: 'TRANSLATION', text: '', reviewer: '' }); notify('نسخهٔ متنی ثبت شد.');
      await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  };

  /* ---------- ارجاع فرصت به F14 (قاعدهٔ ۴) ---------- */
  const openReferral = async (r: any) => {
    setDetail(r); setTab('reviews'); setFormError(''); setPackId(r.referral?.packId ?? '');
    try { const p: any = await apiGet('/readiness-packs'); setPacks(p.items ?? []); } catch { /* بدون بسته هم مسیر باز می‌ماند */ }
  };
  const submitReferral = async () => {
    if (!detail) return;
    setBusy('ref'); setFormError('');
    try {
      const r = await api<any>(`/international/contacts/${detail.id}/referral`, { method: 'POST', body: JSON.stringify({ packId }) });
      setDetail(r); notify('فرصت به کارت F14 ارجاع شد؛ فروش و نهایی‌سازی فقط با مرجع مجاز فناوران انجام می‌شود.');
      await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  };

  /* ---------- پایش ماهانه ---------- */
  const openReviewForm = () => {
    const crits = (reviews?.criteria ?? []).map((c: any) => ({ key: c.key, label: c.label, expected: c.expected, value: '', evidence: '' }));
    setReviewForm({ month: '', isBaseline: reviews?.baselineExists ? false : true, target: '', criteria: crits });
  };
  const submitReview = async () => {
    if (!reviewForm) return;
    setBusy('rv'); setFormError('');
    try {
      await api('/international/reviews', { method: 'POST', body: JSON.stringify(reviewForm) });
      setReviewForm(null); notify('پایش ماهانهٔ ارتباطات بین‌المللی ثبت شد.');
      await reload();
    } catch (x) { setFormError((x as Error).message); } finally { setBusy(''); }
  };

  /* ---------- خروجی JSON/CSV (الگوی عموم‌ها) ---------- */
  const downloadExport = async (format: 'json' | 'csv') => {
    setBusy(`exp-${format}`);
    try {
      if (format === 'json') {
        const data = await api<any>('/international/export?format=json');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'international-contacts.json'; a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await apiBlob('/international/export?format=csv');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'international-contacts.csv'; a.click();
        URL.revokeObjectURL(url);
      }
      notify('خروجی ارتباطات بین‌المللی آماده شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  if (!readable) {
    return (
      <main className="page">
        <PageHeader title={t('ارتباطات بین‌المللی (F17)')} description={t('شما مجوز مشاهدهٔ این ماژول را ندارید.')} />
        <EmptyV4 icon={<Scale size={22} />} title={t('دسترسی محدود')} description={t('برای مشاهدهٔ پرونده‌های ارتباطات بین‌المللی، مجوز international.read لازم است.')} />
      </main>
    );
  }

  const sum = overview?.summary ?? {};
  const reviewItems = reviews?.items ?? [];

  return (
    <main className="page">
      <PageHeader
        eyebrow={t('فاز ۱۴ سند v14 — پروژهٔ ۱۷ (P17)')}
        title={t('ارتباطات بین‌المللی (F17)')}
        description={t('پروندهٔ ارتباط و فرصت بین‌المللی: دامنهٔ پس از دروازهٔ Due Diligence، شش گروه هدف، هویت طرف ارتباط، متن مرجع فارسی و پایش ماهانه.')}
        actions={<>
          <button className="srip-button" onClick={() => reload()} disabled={loading}><RefreshCw size={14} /> {t('به‌روزرسانی')}</button>
          {writable && <button className="srip-button primary" onClick={openCreate}><Plus size={14} /> {t('پروندهٔ جدید F17')}</button>}
        </>}
      />
      <div className="status-banner warning" data-intl-sale-rule role="note">
        <ShieldCheck size={15} />
        <span>{t('فروش و نهایی‌سازی فرصت — از جمله مذاکرهٔ نهایی، پذیرش تعهد حقوقی یا مالی و امضای قرارداد — فقط با مرجع مجاز فناوران هوش مصنوعی پارس ایرانیان انجام می‌شود.')}</span>
      </div>
      {flash && <div className="status-banner success" role="status">{flash}</div>}
      {error && <ErrorCard message={error} />}
      {loading && !overview ? <Loading /> : (
        <>
          <div className="stat-grid" data-intl-stats>
            <div className="stat-card"><div className="stat-label">{t('کل پرونده‌ها')}</div><div className="stat-value">{faNum(sum.total ?? 0)}</div></div>
            <div className="stat-card"><div className="stat-label">{t('هویت تأییدشده')}</div><div className="stat-value">{faNum(sum.byIdentity?.VERIFIED ?? 0)}</div></div>
            <div className="stat-card"><div className="stat-label">{t('ارجاع‌شده به F14')}</div><div className="stat-value">{faNum(sum.referred ?? 0)}</div></div>
            <div className="stat-card"><div className="stat-label">{t('ماه‌های پایش')}</div><div className="stat-value">{faNum(reviewItems.length)}</div></div>
          </div>

          {/* ── پنل ۱: نقشهٔ بازارها و گروه‌های هدف ── */}
          <SectionCard title={t('نقشهٔ بازارها و گروه‌های هدف')} icon={<Globe size={16} />} className="data-intl-map" description={overview?.scope}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>{t('کشور اولویت‌دار')}</th><th>{t('دلیل انتخاب، نیاز زبانی و محدودیت اجرا')}</th><th>{t('پرونده‌ها')}</th></tr></thead>
                <tbody>
                  {(overview?.priorityCountries ?? []).map((c: any) => {
                    const st = sum.byCountry?.[c.country];
                    return <tr key={c.country} data-intl-country={c.country}>
                      <td><strong>{c.country}</strong></td>
                      <td className="muted">{c.reason}</td>
                      <td>{st ? <Badge tone="info">{t('کل')} {faNum(st.total)} · {t('تأییدشده')} {faNum(st.verified)}</Badge> : <Badge tone="neutral">{t('بدون پرونده')}</Badge>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>{t('گروه هدف')}</th><th>{t('هدف ارتباط')}</th><th>{t('خروجی قابل ثبت')}</th><th>{t('پرونده‌ها')}</th></tr></thead>
                <tbody>
                  {(overview?.targetGroups ?? []).map((g: any) => (
                    <tr key={g.key} data-intl-group={g.key}>
                      <td><strong>{g.label}</strong></td>
                      <td className="muted">{g.goal}</td>
                      <td className="muted">{g.output}</td>
                      <td>{faNum(items.filter((r: any) => r.targetGroup === g.key).length)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ── پنل ۲: پرونده‌های طرف ارتباط ── */}
          <SectionCard title={t('پرونده‌های طرف ارتباط (F17)')} icon={<FileText size={16} />} className="data-intl-contacts"
            description={t('هر پرونده: کشور و بازار، هویت طرف ارتباط، پیام با نسخهٔ مرجع فارسی، کنترل حقوقی و پیگیری.')}
            actions={<>
              <button className="srip-button" onClick={() => downloadExport('json')} disabled={busy === 'exp-json'}><Download size={13} /> JSON</button>
              <button className="srip-button" onClick={() => downloadExport('csv')} disabled={busy === 'exp-csv'}><Download size={13} /> CSV</button>
            </>}>
            <Toolbar search={q} onSearch={setQ} searchPlaceholder={t('جست‌وجوی کشور، نهاد، طرف ارتباط یا مسئول…')}>
              <select aria-label={t('فیلتر هویت')} value={fIdentity} onChange={e => setFIdentity(e.target.value)} data-intl-filter-identity>
                <option value="">{t('همهٔ هویت‌ها')}</option>
                {Object.keys(IDENTITY_FA).map(k => <option key={k} value={k}>{IDENTITY_FA[k]}</option>)}
              </select>
              <select aria-label={t('فیلتر وضعیت')} value={fStatus} onChange={e => setFStatus(e.target.value)} data-intl-filter-status>
                <option value="">{t('همهٔ وضعیت‌ها')}</option>
                {Object.keys(STATUS_FA).map(k => <option key={k} value={k}>{STATUS_FA[k]}</option>)}
              </select>
            </Toolbar>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>{t('کشور / بازار')}</th><th>{t('نهاد و طرف ارتباط')}</th><th>{t('گروه هدف')}</th><th>{t('هویت')}</th>
                  <th>{t('نوع پیام / DD')}</th><th>{t('محرمانگی / اشتراک داده')}</th><th>{t('مسئول و اقدام بعدی')}</th><th>{t('ارجاع')}</th><th>{t('وضعیت')}</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id} data-intl-id={r.id} data-identity={r.identity} data-status={r.status}>
                      <td><strong>{r.country}</strong>{r.market ? <div className="muted small">{r.market}</div> : null}</td>
                      <td><strong>{r.orgName}</strong>{r.contactName ? <div className="muted small">{r.contactName}</div> : null}</td>
                      <td className="muted">{r.targetGroupFa ?? '—'}</td>
                      <td><StatusBadge tone={IDENTITY_TONE[r.identity] ?? 'neutral'}>{r.identityFa}</StatusBadge></td>
                      <td>{r.messageTypeFa}{r.messageType === 'PRODUCT' ? <div className="muted small">DD: {r.ddStatusFa ?? '—'}</div> : null}</td>
                      <td className="muted small">{r.confidentialityFa} / {r.dataSharePermFa}</td>
                      <td className="muted small">{r.ownerRole}<div>{r.nextAction ?? '—'}{r.dueAt ? ` · ${faD(r.dueAt)}` : ''}</div></td>
                      <td>{r.referralFa ? <Badge tone="info">{t('F14')}</Badge> : '—'}</td>
                      <td><StatusBadge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.statusFa}</StatusBadge></td>
                      <td className="actions">
                        <button className="link-btn" onClick={() => openDetail(r)}>{t('پرونده')}</button>
                        {writable && !r.referral && <button className="link-btn" onClick={() => openReferral(r)} data-intl-referral-btn={r.id}>{t('ارجاع به F14')}</button>}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={10} className="empty-cell">{t('پرونده‌ای با این فیلتر یافت نشد.')}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted small">{contacts?.rule}</p>
          </SectionCard>

          {/* ── پنل ۳: پایش ماهانه ── */}
          <SectionCard title={t('پایش ماهانهٔ ارتباطات بین‌المللی (۱۰.۶.۴)')} icon={<CalendarCheck2 size={16} />} className="data-intl-reviews"
            description={reviews?.rule}
            actions={writable ? <button className="srip-button primary" onClick={openReviewForm} data-intl-review-add><Plus size={14} /> {t('ثبت ماه جدید')}</button> : null}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>{t('ماه')}</th><th>{t('نوع')}</th>
                  {(reviews?.criteria ?? []).map((c: any) => <th key={c.key}>{c.label}</th>)}
                  <th>{t('هدف')}</th>
                </tr></thead>
                <tbody>
                  {reviewItems.map((rv: any) => (
                    <tr key={rv.id} data-intl-review={rv.id} data-baseline={rv.isBaseline ? '1' : '0'}>
                      <td><strong>{rv.month}</strong><div className="muted small">{faD(rv.at)}</div></td>
                      <td>{rv.isBaseline ? <Badge tone="warning">{t('خط مبنا')}</Badge> : <Badge tone="neutral">{t('متابع')}</Badge>}</td>
                      {(reviews?.criteria ?? []).map((c: any) => {
                        const v = (rv.criteria ?? []).find((x: any) => x.key === c.key);
                        return <td key={c.key} className="muted small" title={v?.evidence ?? ''}>{v?.value ?? '—'}</td>;
                      })}
                      <td className="muted small">{rv.target ?? '—'}</td>
                    </tr>
                  ))}
                  {!reviewItems.length && <tr><td colSpan={8} className="empty-cell">{t('هنوز ماه پایشی ثبت نشده است.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ── پنل ۴: قواعد کنترل حقوقی ── */}
          <SectionCard title={t('قواعد کنترل حقوقی، محرمانگی و اعتبار پیام (۱۰.۶.۳)')} icon={<Scale size={16} />} className="data-intl-rules">
            <ol className="rules-list">
              {(overview?.rules ?? []).map((r: string, i: number) => (
                <li key={i} data-intl-rule={i + 1}><Scale size={13} /> <span>{r}</span></li>
              ))}
            </ol>
          </SectionCard>
        </>
      )}

      {/* ── مودال ایجاد پروندهٔ F17 ── */}
      <Modal open={createOpen} title={t('پروندهٔ جدید ارتباط بین‌المللی (F17)')} onClose={() => setCreateOpen(false)}
        description={t('نسخهٔ مرجع فارسی از خودِ پیام ساخته می‌شود؛ ترجمه پس از ثبت در پرونده اضافه می‌شود.')}>
        {formError && <div className="status-banner danger" role="alert">{formError}</div>}
        <div className="form-grid">
          <label>{t('کشور و بازار *')}<input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} data-intl-f="country" /></label>
          <label>{t('بازار')}<input value={form.market} onChange={e => setForm({ ...form, market: e.target.value })} /></label>
          <label>{t('گروه هدف')}
            <select value={form.targetGroup} onChange={e => setForm({ ...form, targetGroup: e.target.value })}>
              <option value="">—</option>
              {(overview?.targetGroups ?? []).map((g: any) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select></label>
          <label>{t('نام نهاد *')}<input value={form.orgName} onChange={e => setForm({ ...form, orgName: e.target.value })} data-intl-f="orgName" /></label>
          <label>{t('طرف ارتباط')}<input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></label>
          <label>{t('منبع شناسایی')}<input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} /></label>
          <label>{t('هدف تعامل *')}<input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} data-intl-f="purpose" /></label>
          <label>{t('نوع پیام *')}
            <select value={form.messageType} onChange={e => setForm({ ...form, messageType: e.target.value })} data-intl-f="messageType">
              <option value="GENERAL">{MSGTYPE_FA.GENERAL}</option>
              <option value="PRODUCT">{MSGTYPE_FA.PRODUCT}</option>
            </select></label>
          {form.messageType === 'PRODUCT' && <label>{t('پروندهٔ Due Diligence (الزامی برای پیام محصول‌محور)')}<input value={form.ddDossierId} onChange={e => setForm({ ...form, ddDossierId: e.target.value })} placeholder="dd-…" data-intl-f="ddDossierId" /></label>}
          <label>{t('مسئول پیگیری (از چارت) *')}
            <input list="intl-roles" value={form.ownerRole} onChange={e => setForm({ ...form, ownerRole: e.target.value })} data-intl-f="ownerRole" />
            <datalist id="intl-roles">{OWNER_ROLES.map(r => <option key={r} value={r} />)}</datalist>
          </label>
          <label>{t('سطح محرمانگی')}
            <select value={form.confidentiality} onChange={e => setForm({ ...form, confidentiality: e.target.value })}>
              {Object.keys(CONF_FA).map(k => <option key={k} value={k}>{CONF_FA[k]}</option>)}
            </select></label>
          <label>{t('مجوز اشتراک داده')}
            <select value={form.dataSharePerm} onChange={e => setForm({ ...form, dataSharePerm: e.target.value })}>
              {Object.keys(SHARE_FA).map(k => <option key={k} value={k}>{SHARE_FA[k]}</option>)}
            </select></label>
          <label className="full">{t('پیام (نسخهٔ مرجع فارسی) *')}<textarea rows={3} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} data-intl-f="message" /></label>
          <label className="full">{t('شاهد تأییدشده')}<input value={form.evidence} onChange={e => setForm({ ...form, evidence: e.target.value })} /></label>
          <label className="full">{t('اقدام بعدی و مهلت')}<input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} /></label>
        </div>
        <footer className="modal-footer">
          <button className="srip-button" onClick={() => setCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
          <button className="srip-button primary" onClick={submitCreate} disabled={busy === 'create'} data-intl-create-submit>{t('ثبت پرونده')}</button>
        </footer>
      </Modal>

      {/* ── مودال پروندهٔ F17 (چهار تب) ── */}
      <Modal open={!!detail} title={detail ? `${t('پروندهٔ F17 —')} ${detail.orgName}` : ''} onClose={() => setDetail(null)}
        description={detail ? `${detail.country}${detail.market ? ' · ' + detail.market : ''} · ${detail.targetGroupFa ?? ''}` : ''}>
        {detail && (
          <>
            <div className="subnav" data-intl-tabs>
              {([['info', t('اطلاعات')], ['corr', t('مکاتبات')], ['texts', t('نسخه‌های متن')], ['reviews', t('بررسی‌ها و ارجاع')]] as [Tab, string][]).map(([k, label]) => (
                <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} data-intl-tab={k}>{label}</button>
              ))}
            </div>
            {formError && <div className="status-banner danger" role="alert">{formError}</div>}

            {tab === 'info' && (
              <div className="form-grid">
                <label>{t('کشور')}<input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></label>
                <label>{t('بازار')}<input value={form.market} onChange={e => setForm({ ...form, market: e.target.value })} /></label>
                <label>{t('نهاد')}<input value={form.orgName} onChange={e => setForm({ ...form, orgName: e.target.value })} /></label>
                <label>{t('طرف ارتباط')}<input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></label>
                <label>{t('هدف تعامل')}<input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></label>
                <label>{t('مسئول پیگیری')}<input value={form.ownerRole} onChange={e => setForm({ ...form, ownerRole: e.target.value })} /></label>
                <label className="full">{t('پیام (مرجع فارسی)')}<textarea rows={2} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label>
                <label className="full">{t('اقدام بعدی')}<input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} /></label>
                <label>{t('مهلت')}<input type="date" value={form.dueAt?.slice(0, 10) ?? ''} onChange={e => setForm({ ...form, dueAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} /></label>
                <label>{t('تعهدهای ثبت‌شده')}<input value={form.commitments} onChange={e => setForm({ ...form, commitments: e.target.value })} /></label>
                {writable && <div className="full"><button className="srip-button primary" onClick={saveDetail} disabled={busy === 'save'} data-intl-save>{t('ذخیرهٔ اطلاعات')}</button></div>}
              </div>
            )}

            {tab === 'corr' && (
              <div data-intl-corrs>
                <ul className="timeline">
                  {(detail.correspondences ?? []).map((c: any, i: number) => (
                    <li key={i}><Badge tone="neutral">{CORR_TYPE_FA[c.type] ?? c.type}</Badge> <span className="muted small">{faD(c.at)} · {c.by}</span><div>{c.summary}</div></li>
                  ))}
                  {!(detail.correspondences ?? []).length && <li className="muted">{t('مکاتبه‌ای ثبت نشده است.')}</li>}
                </ul>
                {writable && (
                  <div className="form-grid">
                    <label>{t('نوع')}
                      <select value={corr.type} onChange={e => setCorr({ ...corr, type: e.target.value })}>
                        {Object.keys(CORR_TYPE_FA).map(k => <option key={k} value={k}>{CORR_TYPE_FA[k]}</option>)}
                      </select></label>
                    <label className="full">{t('خلاصهٔ مکاتبه/جلسه')}<input value={corr.summary} onChange={e => setCorr({ ...corr, summary: e.target.value })} data-intl-corr-summary /></label>
                    <div className="full"><button className="srip-button" onClick={addCorr} disabled={busy === 'corr'} data-intl-corr-add>{t('افزودن مکاتبه')}</button></div>
                  </div>
                )}
              </div>
            )}

            {tab === 'texts' && (
              <div data-intl-texts>
                <ul className="timeline">
                  {(detail.textVersions ?? []).map((v: any, i: number) => (
                    <li key={i} data-intl-tv={v.lang}>
                      <Badge tone={v.role === 'REFERENCE' ? 'success' : 'info'}>{v.role === 'REFERENCE' ? t('مرجع فارسی') : t('ترجمه')} · {v.lang}</Badge>
                      {v.reviewer ? <span className="muted small"> · {t('بازبین')}: {v.reviewer}</span> : null}
                      <div>{v.text}</div>
                    </li>
                  ))}
                </ul>
                {writable && (
                  <div className="form-grid">
                    <label>{t('زبان')}<input value={tver.lang} onChange={e => setTver({ ...tver, lang: e.target.value })} data-intl-tv-lang /></label>
                    <label>{t('نقش')}
                      <select value={tver.role} onChange={e => setTver({ ...tver, role: e.target.value })}>
                        <option value="TRANSLATION">{t('ترجمه')}</option>
                      </select></label>
                    <label className="full">{t('متن')}<textarea rows={2} value={tver.text} onChange={e => setTver({ ...tver, text: e.target.value })} /></label>
                    <label className="full">{t('بازبین ترجمه (الزامی)')}<input value={tver.reviewer} onChange={e => setTver({ ...tver, reviewer: e.target.value })} data-intl-tv-reviewer /></label>
                    <div className="full"><button className="srip-button" onClick={addTextVersion} disabled={busy === 'tver'} data-intl-tv-add>{t('افزودن نسخه')}</button></div>
                  </div>
                )}
                <p className="muted small">{t('متن فارسی مرجع می‌ماند؛ ترجمه بدون منبع و بازبین تأیید نمی‌شود.')}</p>
              </div>
            )}

            {tab === 'reviews' && (
              <div data-intl-review-tab>
                <div className="form-grid">
                  <label>{t('هویت و اختیار نمایندگی')}
                    <select value={form.identity} onChange={e => setForm({ ...form, identity: e.target.value })} disabled={!writable} data-intl-f="identity">
                      {Object.keys(IDENTITY_FA).map(k => <option key={k} value={k}>{IDENTITY_FA[k]}</option>)}
                    </select></label>
                  <label>{t('بررسی حقوقی')}
                    <select value={form.legalReview} onChange={e => setForm({ ...form, legalReview: e.target.value })} disabled={!writable} data-intl-f="legalReview">
                      {Object.keys(REVIEW_FA).map(k => <option key={k} value={k}>{REVIEW_FA[k]}</option>)}
                    </select></label>
                  <label>{t('بررسی مالی')}
                    <select value={form.financialReview} onChange={e => setForm({ ...form, financialReview: e.target.value })} disabled={!writable}>
                      {Object.keys(REVIEW_FA).map(k => <option key={k} value={k}>{REVIEW_FA[k]}</option>)}
                    </select></label>
                  <label>{t('مجوز اشتراک داده')}
                    <select value={form.dataSharePerm} onChange={e => setForm({ ...form, dataSharePerm: e.target.value })} disabled={!writable} data-intl-f="dataSharePerm">
                      {Object.keys(SHARE_FA).map(k => <option key={k} value={k}>{SHARE_FA[k]}</option>)}
                    </select></label>
                  <label>{t('وضعیت پرونده')}
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} disabled={!writable}>
                      {Object.keys(STATUS_FA).map(k => <option key={k} value={k}>{STATUS_FA[k]}</option>)}
                    </select></label>
                  <label>{t('نتیجهٔ بازبینی')}<input value={form.reviewOutcome} onChange={e => setForm({ ...form, reviewOutcome: e.target.value })} disabled={!writable} /></label>
                  <div className="full">{writable && <button className="srip-button primary" onClick={saveDetail} disabled={busy === 'save'}>{t('ذخیرهٔ بررسی‌ها')}</button>}</div>
                </div>
                {detail.messageType === 'PRODUCT' && <div className="status-banner info"><ShieldCheck size={14} /> {t('پیام محصول‌محور — وضعیت DD')} : {detail.ddStatusFa ?? '—'}</div>}
                <div className="referral-box" data-intl-referral>
                  <h4><ArrowRightCircle size={14} /> {t('ارجاع فرصت واجد شرایط به F14 (آماده‌سازی سرمایه‌گذار و شریک)')}</h4>
                  {detail.referral ? (
                    <p className="muted small">{detail.referralFa} · {faD(detail.referral.at)}</p>
                  ) : writable ? (
                    <div className="form-grid">
                      <label>{t('کارت F14')}
                        <select value={packId} onChange={e => setPackId(e.target.value)} data-intl-pack>
                          <option value="">—</option>
                          {packs.map((p: any) => <option key={p.id} value={p.id}>{p.subject}</option>)}
                        </select></label>
                      <div className="full"><button className="srip-button" onClick={submitReferral} disabled={busy === 'ref'} data-intl-referral-submit>{t('ثبت ارجاع به F14')}</button></div>
                    </div>
                  ) : <p className="muted small">{t('فروش و نهایی‌سازی فقط با مرجع مجاز فناوران انجام می‌شود.')}</p>}
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── مودال پایش ماهانه ── */}
      <Modal open={!!reviewForm} title={t('ثبت پایش ماهانهٔ ارتباطات بین‌المللی')} onClose={() => setReviewForm(null)}
        description={t('پنج معیار ۱۰.۶.۴؛ ماه نخست «خط مبنا» است و پیش از آن سهمیه فرض نمی‌شود.')}>
        {formError && <div className="status-banner danger" role="alert">{formError}</div>}
        {reviewForm && (
          <div className="form-grid">
            <label>{t('عنوان ماه *')}<input value={reviewForm.month} onChange={e => setReviewForm({ ...reviewForm, month: e.target.value })} data-intl-rv-month /></label>
            <label>{t('نوع ماه')}
              <select value={reviewForm.isBaseline ? '1' : '0'} onChange={e => setReviewForm({ ...reviewForm, isBaseline: e.target.value === '1' })} disabled={!!reviews?.baselineExists} data-intl-rv-baseline>
                <option value="1">{t('خط مبنا')}</option>
                <option value="0">{t('متابع')}</option>
              </select></label>
            {!reviewForm.isBaseline && <label className="full">{t('هدف کمی متناسب با بازارهای مصوب')}<input value={reviewForm.target} onChange={e => setReviewForm({ ...reviewForm, target: e.target.value })} /></label>}
            {reviewForm.criteria.map((c: any, i: number) => (
              <div key={c.key} className="full" data-intl-rv-crit={c.key}>
                <label>{c.label} <span className="muted small">({c.expected})</span>
                  <input value={c.value} onChange={e => { const cs = [...reviewForm.criteria]; cs[i] = { ...c, value: e.target.value }; setReviewForm({ ...reviewForm, criteria: cs }); }} /></label>
                <label className="small">{t('شاهد')}
                  <input value={c.evidence} onChange={e => { const cs = [...reviewForm.criteria]; cs[i] = { ...c, evidence: e.target.value }; setReviewForm({ ...reviewForm, criteria: cs }); }} /></label>
              </div>
            ))}
          </div>
        )}
        <footer className="modal-footer">
          <button className="srip-button" onClick={() => setReviewForm(null)}><X size={14} /> {t('انصراف')}</button>
          <button className="srip-button primary" onClick={submitReview} disabled={busy === 'rv'} data-intl-rv-submit>{t('ثبت ماه')}</button>
        </footer>
      </Modal>
    </main>
  );
}
