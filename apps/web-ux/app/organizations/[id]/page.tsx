'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard } from '../../_components/page-ui';
import { EgoGraph, type EgoNode } from '../../_components/ego-graph';
import { CriteriaBadge, CriteriaScoreCard, verdictTone, type Summary as CriteriaSummary } from '../../_components/criteria';
import { suggestConnections } from '../../_lib/connections';
import { Building2, Users, Share2, Link2, Sparkles, ArrowUpRight, CalendarDays, Network, HeartPulse, AlertTriangle, TrendingUp, Clock, ChevronLeft, Fingerprint, Layers, Radar, Users2, CheckCircle2, BookOpenCheck, ShieldCheck, Pencil, RefreshCw, X } from 'lucide-react';
import { localeTag, t } from '../../_lib/i18n';

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat(localeTag()).format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' }) : '—';
function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return '—';
  if (d === 0) return t('امروز');
  if (d === 1) return t('دیروز');
  if (d < 30) return fmtNum(d) + t('روز پیش');
  if (d < 365) return fmtNum(Math.floor(d / 30)) + t('ماه پیش');
  return fmtNum(Math.floor(d / 365)) + t('سال پیش');
}
function healthBand(h: number | null): { label: string; tone: 'success'|'info'|'warning'|'danger'|'neutral'; cls: string } {
  if (h == null) return { label:t('بدون رابطه'), tone:'neutral', cls:'h-null' };
  if (h >= 75) return { label:t('سالم'), tone:'success', cls:'h-hi' };
  if (h >= 55) return { label:t('پایدار'), tone:'info', cls:'h-mid' };
  if (h >= 40) return { label:t('در معرض ریسک'), tone:'warning', cls:'h-low' };
  return { label:t('بحرانی'), tone:'danger', cls:'h-crit' };
}
const bandTone = (cls: string): 'success'|'info'|'warning'|'danger'|'neutral' =>
  cls==='h-hi'?'success':cls==='h-mid'?'info':cls==='h-low'?'warning':cls==='h-crit'?'danger':'neutral';

const UNIT_TYPES = ['DEPARTMENT', 'DIVISION', 'BRANCH', 'BUSINESS_UNIT', 'LOCATION', 'OTHER'];
const CONTACT_KINDS = ['PHONE', 'EMAIL', 'ADDRESS', 'WEBSITE', 'LINKEDIN', 'OTHER'];

/* ═══ شناسنامهٔ سازمان — از نقشهٔ عموم‌ها به پروفایل خود سازمان منتقل شد ═══ */
function OrgSelfCard({ orgId, allOrgs, onSaved }: { orgId: string; allOrgs: any[]; onSaved: () => void }) {
  const { me, can } = useWorkspace();
  const canWrite = !!me?.permissions?.includes('*') || can('publics.write');
  const [self, setSelf] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [form, setForm] = useState({ companyType: 'HOLDING', missionTopic: '', reviewIntervalDays: 90, subsidiaries: [] as string[], ownership: 'PRIVATE' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        api<any>(`/publics/self/${orgId}`).catch(() => null),
        api<any>('/publics/catalog').catch(() => null),
      ]);
      setSelf(s); setCatalog(c);
      if (s) setForm({
        companyType: s.self?.companyType ?? s.template?.id ?? 'HOLDING',
        missionTopic: s.missionTopic ?? '',
        reviewIntervalDays: s.reviewIntervalDays ?? 90,
        subsidiaries: s.structure?.subsidiaries ?? [],
        ownership: s.structure?.ownership ?? 'PRIVATE',
      });
      setDirty(false);
    } catch { /* بدون دسترسی به عموم‌ها */ }
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      await api(`/publics/self/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({
          companyType: form.companyType,
          missionTopic: form.missionTopic.trim(),
          reviewIntervalDays: Number(form.reviewIntervalDays) || 90,
          structure: { sectors: [], subsidiaries: form.subsidiaries, ownership: form.ownership },
        }),
      });
      setMsg(t('شناسنامهٔ سازمان ذخیره شد؛ نقشهٔ عموم‌ها به‌روزرسانی شد.'));
      setDirty(false);
      await load();
      onSaved();
    } catch (e) { setMsg(`${t('خطا:')} ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  if (!self && !canWrite) return null;
  const tplFa = self?.template?.fa ?? '—';
  const cov = self?.coverage ?? {};
  const covPct = cov.groupsExpected ? Math.round((cov.groupsCovered ?? 0) / cov.groupsExpected * 100) : null;
  const templates: Array<[string, string]> = Object.entries(catalog?.templates ?? {}).map(([k, v]: any) => [k, v.fa ?? k]);

  return (
    <SectionCard
      title={t('شناسنامهٔ سازمان')}
      icon={<Fingerprint size={16} />}
      description={t('الگوی شروع، مأموریت و ساختار — مبنای نقشهٔ عموم‌ها، پوشش و خلاصه‌های مدیریتی همین سازمان.')}
      actions={<Link className="btn btn-ghost btn-sm" href="/publics">{t('نقشهٔ عموم‌ها ←')}</Link>}
    >
      <div className="stat-grid">
        <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label={t('الگوی شروع')} value={tplFa} sub={self?.effective ? `${fmtNum(self.effective.active)} ${t('گروه فعال در نقشه')}` : undefined} />
        <StatCard icon={<Radar size={16} />} iconClass="ic-teal" label={t('پوشش عموم‌ها')} value={covPct == null ? '—' : `${fmtNum(covPct)}${t('٪')}`} sub={cov.groupsExpected ? `${fmtNum(cov.groupsCovered ?? 0)} ${t('از')} ${fmtNum(cov.groupsExpected)} ${t('گروه')}` : undefined} />
        <StatCard icon={<Users2 size={16} />} iconClass="ic-purple" label={t('اعضای نقشه')} value={fmtNum(cov.members ?? 0)} sub={cov.keyPlayers ? `${fmtNum(cov.keyPlayers)} ${t('بازیگر کلیدی')}` : undefined} />
      </div>
      {canWrite ? (
        <>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field full">
              <label className="field-label">{t('نوع شرکت (الگوی شروع)')}</label>
              <select value={form.companyType} onChange={e => { setForm(f => ({ ...f, companyType: e.target.value })); setDirty(true); }}>
                {templates.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field full">
              <label className="field-label">{t('مأموریت سازمان')}</label>
              <input value={form.missionTopic} placeholder={t('مثلاً: پیشرو در فناوری‌های نوین کشور')} onChange={e => { setForm(f => ({ ...f, missionTopic: e.target.value })); setDirty(true); }} />
            </div>
            <div className="field">
              <label className="field-label">{t('دورهٔ بازبینی (روز)')}</label>
              <input type="number" min={30} max={365} value={form.reviewIntervalDays} onChange={e => { setForm(f => ({ ...f, reviewIntervalDays: Number(e.target.value) })); setDirty(true); }} />
            </div>
            <div className="field">
              <label className="field-label">{t('نوع مالکیت')}</label>
              <select value={form.ownership} onChange={e => { setForm(f => ({ ...f, ownership: e.target.value })); setDirty(true); }}>
                <option value="PRIVATE">{t('خصوصی')}</option>
                <option value="STATE">{t('دولتی')}</option>
                <option value="PUBLIC">{t('عمومی/بورسی')}</option>
                <option value="FAMILY">{t('خانوادگی')}</option>
              </select>
            </div>
            <div className="field full">
              <label className="field-label">{t('شرکت‌های تابعه')}</label>
              <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allOrgs.filter(o => o.id !== orgId).map(o => {
                  const on = form.subsidiaries.includes(o.id);
                  return (
                    <button key={o.id} type="button" className={`chip ${on ? 'info' : 'neutral'}`} onClick={() => {
                      setForm(f => ({ ...f, subsidiaries: on ? f.subsidiaries.filter(x => x !== o.id) : [...f.subsidiaries, o.id] }));
                      setDirty(true);
                    }}>{on ? <CheckCircle2 size={12} /> : null}{o.name}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={save}>{busy ? t('در حال ذخیره…') : t('ذخیرهٔ شناسنامه')}</button>
            {dirty && <span className="field-hint">{t('تغییرات ذخیره نشده است.')}</span>}
          </div>
        </>
      ) : (
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div className="detail-item"><small>{t('مأموریت سازمان')}</small><strong>{self?.missionTopic || '—'}</strong></div>
          <div className="detail-item"><small>{t('دورهٔ بازبینی')}</small><strong>{fmtNum(self?.reviewIntervalDays ?? 90)} {t('روز')}</strong></div>
        </div>
      )}
      {msg && <div className="notice" role="status" style={{ marginTop: 8 }}>{msg}</div>}
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۲.۵ مسترپلن — پروندهٔ شناخت ۳۱بخشی (بخش ۶/۷ سند؛ ماژول شناخت)
   شناخت مبنای تمام تصمیم‌های بعدی است؛ پروندهٔ استاندارد هر سازمان ۳۱ بخش دارد.
   قواعد کیفیت (۷.۳): هر بخش باید منبع و تاریخ داشته باشد — بخش بدون منبع
   صریحاً «نامعتبر» ثبت می‌شود؛ دادهٔ خام و برداشت تحلیلی جدا ثبت می‌شوند و
   هر پرونده حداکثر ۹۰ روز اعتبار دارد و پس از آن بازبینی می‌شود.
   ═══════════════════════════════════════════════════════════════════════════ */
const KNL_STATUS_FA: Record<string, string> = { VALID: t('معتبر'), INVALID: t('نامعتبر') };
const KNL_REVIEW_FA: Record<string, string> = { VALID: t('معتبر'), EXPIRED: t('منقضی — نیازمند بازبینی'), UNREVIEWED: t('اعتبارسنجی نشده') };
/* کاتالوگ‌های ساختاری پلتفرم (بخش ۶/۷ سند) — ترجمهٔ سمت کلاینت مثل ابعاد ۲.۴ */
const KNL_SECTION_FA: Record<string, string> = {
  name: t('نام'), shareholders: t('سهامداران'), executives: t('مدیران'), activityScope: t('حوزه فعالیت'),
  products: t('محصولات / خدمات'), currentStatus: t('وضعیت فعلی'), targetMarket: t('بازار هدف'),
  keyCustomers: t('مشتریان اصلی'), keyPartners: t('شرکای اصلی'), competitors: t('رقبا'),
  strengths: t('نقاط قوت'), weaknesses: t('نقاط ضعف'), commAssets: t('دارایی‌های ارتباطی'),
  website: t('وب‌سایت'), socialNetworks: t('شبکه‌های اجتماعی'), catalog: t('کاتالوگ'),
  visualIdentity: t('هویت بصری'), media: t('رسانه'), expertCredibility: t('اعتبار تخصصی'),
  executivePresence: t('حضور مدیران'), scientificCapacity: t('ظرفیت علمی'),
  investmentCapacity: t('ظرفیت سرمایه‌گذاری'), marketDevCapacity: t('ظرفیت توسعه بازار'),
  internalSystems: t('وضعیت سیستم‌های داخلی'), structuralIssues: t('مشکلات ساختاری'),
  communicationIssues: t('مشکلات ارتباطی'), growthOpportunities: t('فرصت‌های رشد'),
  partnershipPriority: t('اولویت همکاری'), suggestedActions: t('اقدامات پیشنهادی'),
  internalOwner: t('مسئول داخلی'), readinessStatus: t('وضعیت آماده‌سازی'),
};
const KNL_STAGE_FA: Record<string, string> = {
  docsReview: t('بررسی اسناد و تکمیل بخش‌ها'), interview: t('مصاحبهٔ ساختاریافته با مدیران ارشد'),
  fieldSurvey: t('برداشت میدانی دارایی‌های ارتباطی'), validation: t('اعتبارسنجی متقابل داده‌ها'),
  analysis: t('تحلیل و نتیجه‌گیری'), boardApproval: t('تصویب در هیئت‌مدیره'),
  quarterlyUpdate: t('به‌روزرسانی فصلی'),
};
const KNL_GROUP_FA: Record<string, string> = {
  identity: t('هویت و ساختار'), market: t('بازار و ذی‌نفعان'), assets: t('دارایی‌های ارتباطی'),
  capacity: t('ظرفیت‌ها'), issues: t('مسائل، فرصت‌ها و برنامهٔ همکاری'),
};

function OrgKnowledgeCard({ orgId }: { orgId: string }) {
  const { can } = useWorkspace();
  const writable = can('organization.write');
  const [k, setK] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [form, setForm] = useState({ data: '', interpretation: '', source: '', sourceDate: '' });

  const load = useCallback(async () => {
    try { setError(''); setK(await api(`/organizations/${orgId}/knowledge`)); }
    catch (x: any) { setError(x?.message ?? String(x)); }
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  if (!k && !error) return null;
  const stats = k?.stats ?? { total: 31, valid: 0, filled: 0, invalid: 31, coverage: 0 };
  const stageIdx = (k?.stages ?? []).findIndex((s: any) => s.key === k?.stage);
  const nextStage = stageIdx >= 0 ? k.stages[stageIdx + 1] : null;

  const openEdit = (sec: any) => {
    setEditKey(sec.key);
    setForm({ data: sec.data ?? '', interpretation: sec.interpretation ?? '', source: sec.source ?? '', sourceDate: sec.sourceDate ? String(sec.sourceDate).slice(0, 10) : '' });
  };
  const saveSection = async () => {
    if (!editKey) return;
    setBusy(true);
    try {
      await api(`/organizations/${orgId}/knowledge/sections/${editKey}`, { method: 'PATCH', body: JSON.stringify({ ...form, sourceDate: form.sourceDate || null }) });
      setEditKey(null); await load();
    } catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  const doReview = async () => {
    setBusy(true);
    try { await api(`/organizations/${orgId}/knowledge/review`, { method: 'POST' }); await load(); }
    catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  const advanceStage = async () => {
    if (!nextStage) return;
    setBusy(true);
    try { await api(`/organizations/${orgId}/knowledge`, { method: 'PATCH', body: JSON.stringify({ stage: nextStage.key }) }); await load(); }
    catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };

  const editSec = editKey ? k.sections.find((s: any) => s.key === editKey) : null;
  const reviewTone: 'success' | 'danger' | 'neutral' = k?.reviewState === 'VALID' ? 'success' : k?.reviewState === 'EXPIRED' ? 'danger' : 'neutral';

  return (
    <SectionCard
      title={t('پروندهٔ شناخت (۳۱ بخش)')}
      icon={<BookOpenCheck size={16} />}
      description={t('شناخت استاندارد این سازمان — هیچ بخشی بدون منبع معتبر تکمیل نمی‌شود؛ دادهٔ خام و برداشت تحلیلی جدا ثبت می‌شوند و پرونده حداکثر ۹۰ روز اعتبار دارد.')}
      actions={
        <div className="toolbar">
          {writable && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={doReview}><ShieldCheck size={13} /> {t('ثبت بازبینی (۹۰ روز)')}</button>}
          {writable && nextStage && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={advanceStage}>{t('تکمیل مرحلهٔ بعد')}</button>}
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} className={busy ? 'spin' : ''} /> {t('بازخوانی')}</button>
        </div>
      }
    >
      {error && <ErrorCard message={error} />}
      <div className="stat-grid">
        <StatCard icon={<BookOpenCheck size={16} />} iconClass="ic-teal" label={t('بخش‌های معتبر')} value={`${fmtNum(stats.valid)} ${t('از')} ${fmtNum(stats.total)}`} sub={`${fmtNum(stats.filled)} ${t('بخش پرشده')} · ${fmtNum(stats.invalid)} ${t('نامعتبر')}`} />
        <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label={t('تکمیل پرونده')} value={`${fmtNum(stats.coverage)}${t('٪')}`} sub={t('معتبر = داده + منبع')} />
        <StatCard icon={<ShieldCheck size={16} />} iconClass={k?.reviewState === 'EXPIRED' ? 'ic-red' : 'ic-purple'} label={t('اعتبار پرونده')} value={KNL_REVIEW_FA[k?.reviewState ?? 'UNREVIEWED']} sub={k?.daysLeft != null && k.daysLeft >= 0 ? `${fmtNum(k.daysLeft)} ${t('روز مانده تا بازبینی')}` : t('حداکثر ۹۰ روز پس از اعتبارسنجی')} />
        <StatCard icon={<Clock size={16} />} iconClass="ic-teal" label={t('مرحلهٔ شناخت')} value={`${fmtNum(k?.stageNo ?? 1)} ${t('از')} ${fmtNum(7)}`} sub={KNL_STAGE_FA[k?.stage ?? 'docsReview'] ?? ''} />
      </div>

      {/* روش شناخت — هفت‌مرحله‌ای (۷.۲ سند) */}
      <div className="knl-steps" aria-label={t('روش شناخت هفت‌مرحله‌ای')}>
        {(k?.stages ?? []).map((s: any, i: number) => (
          <span key={s.key} className={`knl-step ${i < stageIdx ? 'done' : ''} ${i === stageIdx ? 'current' : ''}`} title={`${s.duration} → ${s.output}`}>
            <b>{fmtNum(s.no)}</b> {KNL_STAGE_FA[s.key] ?? s.label}
          </span>
        ))}
      </div>

      <div className="table-wrap">
        <table className="knl-table">
          <thead>
            <tr>
              <th>{t('ردیف')}</th>
              <th>{t('بخش')}</th>
              <th>{t('داده خام')}</th>
              <th>{t('برداشت تحلیلی')}</th>
              <th>{t('منبع')}</th>
              <th>{t('تاریخ منبع')}</th>
              <th>{t('وضعیت')}</th>
              {writable && <th />}
            </tr>
          </thead>
          <tbody>
            {(k?.groups ?? []).map((g: any) => (
              <Fragment key={g.key}>
                <tr className="knl-group"><td colSpan={writable ? 8 : 7}>{KNL_GROUP_FA[g.key] ?? g.label}</td></tr>
                {(k?.sections ?? []).filter((s: any) => s.group === g.key).map((s: any) => (
                  <tr key={s.key} className={s.status === 'VALID' ? 'knl-valid' : 'knl-invalid'}>
                    <td>{fmtNum(s.no)}</td>
                    <td><strong>{KNL_SECTION_FA[s.key] ?? s.label}</strong></td>
                    <td className="knl-data">{s.data || <span className="t-muted">—</span>}</td>
                    <td className="knl-data">{s.interpretation || <span className="t-muted">—</span>}</td>
                    <td>{s.source || <span className="t-muted">—</span>}</td>
                    <td>{s.sourceDate ? fmtDate(s.sourceDate) : '—'}</td>
                    <td><Badge tone={s.status === 'VALID' ? 'success' : 'danger'}>{KNL_STATUS_FA[s.status]}</Badge></td>
                    {writable && (
                      <td>
                        <button type="button" className="srip-button" style={{ padding: '3px 9px' }} onClick={() => openEdit(s)}><Pencil size={13} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="org-rel-note">{k?.rule}</p>

      {writable && (
        <Modal open={editKey != null} title={`${t('ثبت بخش پرونده')} — ${editSec ? (KNL_SECTION_FA[editSec.key] ?? editSec.label) : ''}`} onClose={() => setEditKey(null)}>
          <form id="knowledge-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); saveSection(); }}>
            <div className="field full">
              <label className="field-label">{t('داده خام')}</label>
              <textarea rows={3} value={form.data} onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))} placeholder={t('واقعیت ثبت‌شده — بدون تحلیل')} />
            </div>
            <div className="field full">
              <label className="field-label">{t('برداشت تحلیلی')}</label>
              <textarea rows={2} value={form.interpretation} onChange={(e) => setForm(f => ({ ...f, interpretation: e.target.value }))} placeholder={t('تفکیک داده از برداشت — تحلیل در ستون جدا')} />
            </div>
            <div className="field">
              <label className="field-label">{t('منبع')}</label>
              <input value={form.source} placeholder={t('مثلاً: روزنامهٔ رسمی، مصاحبهٔ مدیران')} onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label">{t('تاریخ منبع')}</label>
              <input type="date" value={form.sourceDate} onChange={(e) => setForm(f => ({ ...f, sourceDate: e.target.value }))} />
            </div>
            <p className="field-hint full">{t('بدون منبع، بخش صریحاً «نامعتبر» ثبت می‌شود.')}</p>
            <div className="form-actions">
              <button type="button" className="srip-button" onClick={() => setEditKey(null)}><X size={14} /> {t('انصراف')}</button>
              <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ذخیرهٔ بخش')}</button>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [o, setO] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<null | 'unit' | 'contact'>(null);
  const [unitForm, setUnitForm] = useState({ name: '', type: 'DEPARTMENT', parentUnitId: '' });
  const [ctForm, setCtForm] = useState({ kind: 'PHONE', value: '', label: '', isPrimary: false });

  const load = useCallback(async () => {
    setError('');
    try {
      const [org, unitRows, tl, people, relList, orgList, inter] = await Promise.all([
        api(`/organizations/${id}`),
        api(`/core-domain/organizations/${id}/units`),
        api(`/organizations/${id}/timeline`),
        api('/people'),
        api('/relationships'),
        api('/organizations'),
        api('/interactions'),
      ]);
      setO(org); setUnits(arr(unitRows)); setTimeline(arr(tl));
      setMembers(arr(people).filter((p: any) => p.organizationId === id));
      setRels(arr(relList).filter((r: any) => r.sourceOrganizationId === id || r.targetOrganizationId === id));
      setAllOrgs(arr(orgList)); setInteractions(arr(inter));
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const graphNodes: EgoNode[] = useMemo(() => {
    const nodes: EgoNode[] = [];
    rels.slice(0, 10).forEach((r: any) => {
      const otherId = r.sourceOrganizationId === id ? r.targetOrganizationId : r.sourceOrganizationId;
      const other = allOrgs.find((x: any) => x.id === otherId);
      if (!other) return;
      nodes.push({
        id: other.id, name: other.name, kind: 'organization', sub: other.type,
        status: r.status, score: 100 - (r.riskScore ?? 30),
        href: `/organizations/${other.id}`,
      });
    });
    members.slice(0, 8).forEach((m: any) => {
      nodes.push({
        id: m.id, name: `${m.firstName} ${m.lastName ?? ''}`, kind: 'person',
        sub: m.title ?? t('عضو'), edgeStyle: 'dashed', score: m.influenceScore ?? 60,
        href: `/people/${m.id}`,
      });
    });
    return nodes;
  }, [rels, members, allOrgs, id]);

  const suggestions = useMemo(() => {
    if (!o || !allOrgs.length || !rels.length) return [];
    return suggestConnections(id, { orgs: allOrgs, people: members, rels, interactions }).slice(0, 4);
  }, [o, id, allOrgs, members, rels, interactions]);

  /* ---- وضعیت رابطه (پاسخ به «وضعیت این سازمان چیست؟») ---- */
  const relStatus = useMemo(() => {
    if (!rels.length) return null;
    let worstHealth: number | null = null, worst: any = null;
    let maxRisk: number | null = null, maxStrategic: number | null = null, nextAt: string | null = null;
    let lastInter: string | null = null;
    const critScores: number[] = [];
    for (const r of rels) {
      const h = r.healthScore ?? 0, k = r.riskScore ?? 0, st = r.strategicScore ?? 0;
      if (worstHealth == null || h < worstHealth) { worstHealth = h; worst = r; }
      maxRisk = maxRisk == null ? k : Math.max(maxRisk, k);
      maxStrategic = maxStrategic == null ? st : Math.max(maxStrategic, st);
      if (r.nextActionAt && (!nextAt || r.nextActionAt < nextAt)) nextAt = r.nextActionAt;
      const li = r.lastInteractionAt ?? null;
      if (li && (!lastInter || li > lastInter)) lastInter = li;
      const eff = (r.criteria as any)?.effectiveScore ?? (r.criteria as any)?.score;
      if (eff != null && Number.isFinite(Number(eff))) critScores.push(Number(eff));
    }
    for (const i of interactions) {
      if (i.organizationId !== id && !rels.some((r: any) => r.id === i.relationshipId)) continue;
      if (i.occurredAt && (!lastInter || i.occurredAt > lastInter)) lastInter = i.occurredAt;
    }
    return {
      worstHealth, worst, maxRisk, maxStrategic, nextAt, lastInter, count: rels.length,
      criteriaAvg: critScores.length ? Math.round(critScores.reduce((a, b) => a + b, 0) / critScores.length) : null,
      criteriaCount: critScores.length,
      criteriaRankable: rels.filter((r: any) => (r.criteria as any)?.rankable).length,
    };
  }, [rels, interactions, id]);

  if (!o && !error) return <main className="feature-page"><PageHeader eyebrow={t('سازمان')} title={t('سازمان')} description="" actions={<></>} /><Loading /></main>;

  const counts = o?._count ?? {};
  /* فاز ۳/۱۸: فیلدهای غنی‌شده از منابع رسمی (با منبع + سطح اطمینان + تأیید انسانی) */
  const enrich: any[] = (o as any)?.enrichment?.fields ?? [];
  const infoRows: Array<[string, string]> = [];
  if (o?.type) infoRows.push([t('نوع'), fa(o.type)]);
  if (o?.industry) infoRows.push([t('صنعت'), o.industry]);
  if (o?.country) infoRows.push([t('کشور'), o.country]);
  if (o?.createdAt) infoRows.push([t('تاریخ ثبت'), new Date(o.createdAt).toLocaleDateString(localeTag())]);
  if (o?.parentOrganizationId) {
    const parent = allOrgs.find((x: any) => x.id === o.parentOrganizationId);
    infoRows.push([t('سازمان مادر'), parent?.name ?? '—']);
  }
  const band = healthBand(relStatus?.worstHealth ?? null);
  const tlTone = (k: string): any =>
    k === 'MEETING' ? 'success' : k === 'INTERACTION' ? 'info' : k === 'OPPORTUNITY' ? 'purple' : k === 'COMMITMENT' ? 'warning' : 'neutral';

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow={t('سازمان · پروفایل')}
        title={o?.name ?? t('سازمان')}
        description={`${o?.type ? fa(o.type) : ''}${o?.industry ? ` · ${o.industry}` : ''}${o?.country ? ` · ${o.country}` : ''}`}
        actions={
          <div className="toolbar">
            <button className="secondary-action" onClick={() => setPanel('unit')}>{t('+ واحد')}</button>
            <button className="secondary-action" onClick={() => setPanel('contact')}>{t('+ تماس')}</button>
            <button className="secondary-action" onClick={load}>{t('بازخوانی')}</button>
          </div>
        }
      />
      <ErrorCard message={error} />

      {o && (
        <>
          {/* profile strip */}
          <section className="profile-strip">
            <span className="stat-ico ic-blue" style={{ width: 48, height: 48, borderRadius: 14, flex: 'none' }}><Building2 size={22}/></span>
            <div className="profile-main">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2>{o.name}</h2>
                <Badge tone={o.status === 'ACTIVE' ? 'success' : 'neutral'}>{fa(o.status ?? 'ACTIVE')}</Badge>
                {o.parentOrganizationId && <Link className="chip info" href={`/organizations/${o.parentOrganizationId}`}><ArrowUpRight size={12}/> {t('مادر')}</Link>}
              </div>
              <p>{o.industry ?? ''}{o.country ? ` · ${o.country}` : ''}</p>
            </div>
            <div className="profile-metrics">
              <span className="person-score"><Users size={13}/><b className="hi">{fmtNum(counts.people ?? members.length)}</b><small>{t('اعضا')}</small></span>
              <span className="person-score"><Share2 size={13}/><b className="mid">{fmtNum(rels.length)}</b><small>{t('روابط')}</small></span>
              <span className="person-score"><Network size={13}/><b className="mid">{fmtNum((counts.projects ?? 0) + (counts.opportunities ?? 0))}</b><small>{t('پروژه/فرصت')}</small></span>
            </div>
          </section>

          {/* شناسنامهٔ سازمان — الگو، مأموریت و ساختار (از عموم‌ها به اینجا منتقل شد) */}
          <OrgSelfCard orgId={id} allOrgs={allOrgs} onSaved={load} />

          {/* پروندهٔ شناخت ۳۱بخشی — گام ۲.۵ (بخش ۶/۷ سند؛ ماژول شناخت) */}
          <OrgKnowledgeCard orgId={id} />

          {/* رابطه استاتوس — پاسخ به «وضعیت رابطه با این سازمان چیست؟» */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico"><HeartPulse size={17}/></span>
              <div>
                <h2>{t('وضعیت رابطه با این سازمان')}</h2>
                <p>{t('امتیاز هر رابطه از همان کاتالوگ معیارها ساخته شده (شواهد رفتاری + ارزیابی انسانی)؛ سلامتیِ عملیاتی هم به‌عنوان شاخص مکمل کنارش می‌ماند.')}</p>
              </div>
              <div className="toolbar">
                <Badge tone={relStatus?.criteriaAvg != null ? (relStatus.criteriaAvg >= 70 ? 'success' : relStatus.criteriaAvg >= 50 ? 'warning' : 'danger') : 'neutral'}>
                  {relStatus?.criteriaAvg != null ? `${t('میانگین معیارها:')} ${fmtNum(relStatus.criteriaAvg)}` : t('بدون امتیاز معیارها')}
                </Badge>
                <Badge tone={bandTone(band.cls)}>{band.label}</Badge>
              </div>
            </div>
            {relStatus ? (
              <>
                <div className="rel-status-metrics">
                  <div className="rel-metric">
                    <span>{t('سلامت رابطه')}</span>
                    <div className="rel-metric-value"><b className={band.cls}>{fmtNum(relStatus.worstHealth)}</b><small>{t('از ۱۰۰')}</small></div>
                    <div className="rel-metric-bar"><span className={band.cls} style={{ width: `${relStatus.worstHealth ?? 0}%` }}/></div>
                  </div>
                  <div className="rel-metric">
                    <span>{t('ریسک')}</span>
                    <div className="rel-metric-value"><b className={relStatus.maxRisk != null && relStatus.maxRisk >= 60 ? 'h-crit' : relStatus.maxRisk != null && relStatus.maxRisk >= 40 ? 'h-low' : 'h-hi'}>{fmtNum(relStatus.maxRisk)}</b><small>{t('از ۱۰۰')}</small></div>
                    <div className="rel-metric-bar"><span className={relStatus.maxRisk != null && relStatus.maxRisk >= 60 ? 'h-crit' : relStatus.maxRisk != null && relStatus.maxRisk >= 40 ? 'h-low' : 'h-hi'} style={{ width: `${relStatus.maxRisk ?? 0}%` }}/></div>
                  </div>
                  <div className="rel-metric">
                    <span>{t('ارزش راهبردی')}</span>
                    <div className="rel-metric-value"><b>{fmtNum(relStatus.maxStrategic)}</b><small>{t('از ۱۰۰')}</small></div>
                    <div className="rel-metric-bar"><span style={{ width: `${relStatus.maxStrategic ?? 0}%` }}/></div>
                  </div>
                  <div className="rel-metric">
                    <span>{t('آخرین تعامل')}</span>
                    <div className="rel-metric-value"><b>{timeAgo(relStatus.lastInter)}</b><small>{relStatus.lastInter ? fmtDate(relStatus.lastInter) : t('ثبت نشده')}</small></div>
                  </div>
                  <div className="rel-metric">
                    <span>{t('اقدام بعدی')}</span>
                    <div className="rel-metric-value"><b>{relStatus.nextAt ? fmtDate(relStatus.nextAt) : '—'}</b><small>{relStatus.nextAt ? t('برنامه‌ریزی‌شده') : t('اقدامی ثبت نشده')}</small></div>
                  </div>
                </div>
                <div className="rel-status-list">
                  {rels.map((r: any) => {
                    const otherId = r.sourceOrganizationId === id ? r.targetOrganizationId : r.sourceOrganizationId;
                    const other = allOrgs.find((x: any) => x.id === otherId);
                    const c = r.criteria as CriteriaSummary | null | undefined;
                    const eff = c?.effectiveScore ?? c?.rankingScore ?? c?.score ?? null;
                    const vTone = verdictTone(c?.verdict);
                    const h = r.healthScore ?? 0;
                    const b = healthBand(h);
                    return (
                      <Link className="org-rel-row" href={`/relationships/${r.id}`} key={r.id}>
                        <div className="org-rel-name">
                          <strong>{other?.name ?? '—'}</strong>
                          <small>{fa(r.relationshipType)} · {fa(r.status)}</small>
                        </div>
                        <div className="org-rel-criteria">
                          <div className="org-rel-scoreline">
                            <b className={`org-rel-score ${vTone}`}>{eff == null ? '—' : fmtNum(eff)}</b>
                            <span className={`chip ${vTone}`}>{c?.verdictLabel ?? t('داده کافی نیست')}</span>
                            {c?.manual?.active && <em className="criteria-badge-manual" title={`${t('تنظیم دستی:')} ${c.manual.reason}`}>{t('دستی')}</em>}
                          </div>
                          <small>
                            {c
                              ? `${fmtNum(c.coverage)}${t('٪ اطلاعات · اطمینان')} ${fmtNum(c.confidence)}${t('٪')}${c.rankable ? '' : t('· قابل مقایسه نیست')}${c.gateCap != null ? ` ${t('· سقف')} ${fmtNum(c.gateCap)}` : ''}`
                              : t('ارزیابی معیارها در دسترس نیست')}
                          </small>
                        </div>
                        <div className="org-rel-health" title={t('شاخص عملیاتی (سلامت) — مکمل امتیاز معیارها')}>
                          <span className={`health-dot ${b.cls}`} />
                          <span className="health-bar-mini"><span className={`health-fill ${b.cls}`} style={{ width: `${h}%` }} /></span>
                          <b className={`health-num-sm ${b.cls}`}>{fmtNum(h)}</b>
                        </div>
                        <ChevronLeft size={15} className="t-muted" />
                      </Link>
                    );
                  })}
                  <p className="org-rel-note">{t('برای دیدن تفکیک خانواده‌ها و تک‌تک معیارها، هر ردیف را باز کنید.')}</p>
                </div>
              </>
            ) : (
              <p className="empty-state">{t('هنوز رابطه‌ای برای این سازمان ثبت نشده — از صفحهٔ «روابط» نخستین رابطه را ایجاد کنید.')}</p>
            )}
          </section>

          <CriteriaScoreCard subjectType="ORGANIZATION" subjectId={id} onEdit={load} />

          <div className="split-panels">
            {/* Ego graph */}
            <section className="panel graph-panel">
              <div className="panel-title">
                <div><h2>{t('گراف ارتباطات دقیق')}</h2><p>{t('همهٔ روابط این سازمان با وضعیت + اعضای کلیدی')}</p></div>
                <Link className="btn btn-ghost btn-sm" href="/network">{t('شبکهٔ کامل ←')}</Link>
              </div>
              <EgoGraph center={{ name: o.name, kind: 'organization', sub: o.industry ?? fa(o.type) }} centerHref={`/organizations/${id}`} nodes={graphNodes} height={340} />
            </section>

            {/* Info */}
            <section className="panel">
              <div className="panel-title"><div><h2>{t('اطلاعات سازمان')}</h2><p>{t('داده‌های اصلی')}</p></div></div>
              <div className="detail-grid">
                {infoRows.map(([k, v]) => (
                  <div className="detail-item" key={k}><small>{k}</small><strong>{v}</strong></div>
                ))}
                {infoRows.length === 0 && <p className="empty-state">{t('داده‌ای ثبت نشده است.')}</p>}
              </div>

              {enrich.length > 0 && (
                <>
                  <div className="panel-title" style={{ marginTop: 20 }}>
                    <div><h2>{t('غنی‌شده از منابع رسمی')}</h2><p>{t('هر مقدار با منبع، سطح اطمینان و تاریخ تأیید انسانی')}</p></div>
                    <Link className="btn btn-ghost btn-sm" href="/enrichment">{t('مدیریت غنی‌سازی ←')}</Link>
                  </div>
                  <div className="list">
                    {enrich.map((f: any) => (
                      <div className="listRow" key={f.field} style={{ textDecoration: 'none' }}>
                        <span className="avatar"><Building2 size={16} /></span>
                        <span style={{ flex: 1 }}>
                          <strong>{f.fieldFa ?? f.field}: {f.value}</strong>
                          <small>{f.evidence}</small>
                        </span>
                        <Badge tone={f.confidence === 'HIGH' ? 'success' : f.confidence === 'MEDIUM' ? 'info' : 'warning'}>{f.confidenceFa ?? f.confidence}</Badge>
                        <small>{f.sourceNameFa}</small>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="panel-title" style={{ marginTop: 20 }}><div><h2>{t('اعضای سازمان')}</h2><Badge>{fmtNum(members.length)}</Badge></div></div>
              {members.length ? (
                <div className="list">
                  {members.map((m: any) => (
                    <Link className="listRow linkable" href={`/people/${m.id}`} key={m.id} style={{ textDecoration: 'none' }}>
                      <span className="avatar">{`${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`}</span>
                      <span style={{ flex: 1 }}><strong>{m.firstName} {m.lastName}</strong><small>{m.title ?? t('بدون سمت')}</small></span>
                      {m.influenceScore != null && <Badge tone={m.influenceScore >= 75 ? 'success' : 'neutral'}>نفوذ {fmtNum(m.influenceScore)}</Badge>}
                    </Link>
                  ))}
                </div>
              ) : <p className="empty-state">{t('عضوی ثبت نشده است.')}</p>}
            </section>
          </div>

          {/* Suggestions — derived from interactions & meetings results */}
          <section className="panel">
            <div className="panel-title">
              <div><h2><Sparkles size={15}/> {t('پیشنهاد ارتباط جدید')}</h2><p>{t('بر اساس ارتباطات مشترک، تعاملات اخیر و نتایج جلسات — موتور قطعی داخلی')}</p></div>
            </div>
            {suggestions.length ? (
              <div className="suggestions-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
                {suggestions.map((s) => (
                  <Link className="ai-match-card" href={s.href} key={s.id} style={{ textDecoration: 'none', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="stat-ico ic-purple" style={{ width: 30, height: 30, borderRadius: 9 }}><Link2 size={15}/></span>
                        {s.name}
                      </b>
                      <span className="confidence-num">{fmtNum(s.score)}٪</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.reasons.slice(0, 2).map((r) => <span className="chip info" key={r}>{r}</span>)}
                    </div>
                    {s.via.length > 0 && <div className="match-meta"><Sparkles size={12}/> از طریق: {s.via.slice(0, 3).join(t('،'))}</div>}
                  </Link>
                ))}
              </div>
            ) : <p className="empty-state"><Sparkles size={18}/> {t('پیشنهادی برای این شبکه موجود نیست.')}</p>}
          </section>

          {/* Units + contacts */}
          <div className="split-panels">
            <section className="panel">
              <div className="panel-title"><div><h2>{t('واحدها')}</h2><Badge>{fmtNum(units.length)}</Badge></div></div>
              {units.length ? (
                <div className="list">
                  {units.map((u: any) => (
                    <div key={u.id}>
                      <div className="listRow"><Badge tone="neutral">{fa(u.type)}</Badge><span><strong>{u.name}</strong>{u.children?.length ? <small>{fmtNum(u.children.length)} زیرمجموعه</small> : null}</span></div>
                      {(u.children ?? []).map((c: any) => (
                        <div className="listRow indent" key={c.id}><Badge tone="neutral">{fa(c.type)}</Badge><span><strong>{c.name}</strong></span></div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">{t('واحدی ثبت نشده است.')}</p>}
            </section>
            <section className="panel">
              <div className="panel-title"><div><h2>{t('اطلاعات تماس')}</h2><Badge>{fmtNum(contacts.length)}</Badge></div></div>
              {contacts.length ? (
                <div className="list">
                  {contacts.map((c: any) => (
                    <div className="listRow" key={c.id}>
                      <Badge tone={c.isPrimary ? 'success' : 'neutral'}>{fa(c.kind)}</Badge>
                      <span><strong dir="ltr">{c.value}</strong><small>{c.label || ''}{c.isPrimary ? t('· تماس اصلی') : ''}</small></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">{t('تماسی ثبت نشده است.')}</p>}
            </section>
          </div>

          {/* Timeline */}
          <section className="panel">
            <div className="panel-title"><div><h2>{t('خط زمانی')}</h2><p>{t('جلسات، تعاملات، فرصت‌ها و تعهدات')}</p></div><Badge>{fmtNum(timeline.length)}</Badge></div>
            {timeline.length ? (
              <div className="list">
                {timeline.slice(0, 50).map((x: any, i: number) => (
                  <div className="listRow" key={x.id ?? i}>
                    <Badge tone={tlTone(x.kind ?? '')}>{fa(x.kind ?? 'EVENT')}</Badge>
                    <span><strong>{x.title || x.subject || x.description || x.name || x.eventType || '—'}</strong>
                      {(x.date || x.createdAt) ? <small><CalendarDays size={11} style={{ verticalAlign: '-1px' }}/> {new Date(x.date ?? x.createdAt).toLocaleString(localeTag())}</small> : null}</span>
                    {x.status && <Badge tone={x.status === 'OPEN' ? 'warning' : x.status === 'DONE' ? 'success' : x.status === 'WON' ? 'success' : 'neutral'}>{fa(x.status)}</Badge>}
                  </div>
                ))}
              </div>
            ) : <p className="empty-state">{t('رویدادی ثبت نشده است.')}</p>}
          </section>

          {/* Add modal */}
          <Modal open={panel !== null} title={panel === 'contact' ? t('اطلاعات تماس جدید') : t('واحد جدید')} description={panel === 'contact' ? t('یک راه تماس برای این سازمان ثبت کنید.') : t('یک واحد سازمانی جدید زیر این سازمان ثبت کنید.')} onClose={() => setPanel(null)}
            footer={<>
              <button type="button" className="btn btn-secondary" onClick={() => setPanel(null)}>{t('انصراف')}</button>
              {panel === 'contact'
                ? <button type="submit" form="org-contact-form" className="btn btn-primary">{t('ثبت تماس')}</button>
                : <button type="submit" form="org-unit-form" className="btn btn-primary">{t('ثبت واحد')}</button>}
            </>}>
            {panel === 'contact' ? (
              <form id="org-contact-form" className="entity-form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/core-domain/organizations/${id}/contacts`, { method: 'POST', body: JSON.stringify(ctForm) }); setCtForm({ kind: 'PHONE', value: '', label: '', isPrimary: false }); setPanel(null); await load(); } catch (x) { setError((x as Error).message); } }}>
                <div className="field"><label className="field-label">{t('نوع تماس')}</label><select value={ctForm.kind} onChange={(e) => setCtForm({ ...ctForm, kind: e.target.value })}>{CONTACT_KINDS.map((k) => <option key={k} value={k}>{fa(k)}</option>)}</select></div>
                <div className="field"><label className="field-label">{t('مقدار')} <span className="req">*</span></label><input required value={ctForm.value} onChange={(e) => setCtForm({ ...ctForm, value: e.target.value })} placeholder={t('شماره، نشانی یا نشانی وب')}/></div>
                <div className="field full"><label className="field-label">{t('برچسب')}</label><input value={ctForm.label} onChange={(e) => setCtForm({ ...ctForm, label: e.target.value })} placeholder={t('مثلاً: دفتر مرکزی، خط مستقیم')}/></div>
                <div className="field full check-line"><input type="checkbox" checked={ctForm.isPrimary} onChange={(e) => setCtForm({ ...ctForm, isPrimary: e.target.checked })} /> {t('تماس اصلی')}</div>
              </form>
            ) : (
              <form id="org-unit-form" className="entity-form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/core-domain/organizations/${id}/units`, { method: 'POST', body: JSON.stringify({ name: unitForm.name, type: unitForm.type, parentUnitId: unitForm.parentUnitId || undefined }) }); setUnitForm({ name: '', type: 'DEPARTMENT', parentUnitId: '' }); setPanel(null); await load(); } catch (x) { setError((x as Error).message); } }}>
                <div className="field"><label className="field-label">{t('نام واحد')} <span className="req">*</span></label><input required value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} placeholder={t('مثلاً: واحد فروش')}/></div>
                <div className="field"><label className="field-label">{t('نوع واحد')}</label><select value={unitForm.type} onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })}>{UNIT_TYPES.map((t) => <option key={t} value={t}>{fa(t)}</option>)}</select></div>
                <div className="field full"><label className="field-label">{t('واحد والد (اختیاری)')}</label><select value={unitForm.parentUnitId} onChange={(e) => setUnitForm({ ...unitForm, parentUnitId: e.target.value })}><option value="">{t('بدون واحد والد')}</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              </form>
            )}
          </Modal>
        </>
      )}
    </main>
  );
}
