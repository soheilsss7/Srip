'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../_components/workspace';
import { api } from '../_lib/api';
import { faNum, faFullDate } from '../_lib/jalali';
import { localeTag, lt, t } from '../_lib/i18n';
import {
  Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, Segmented, StatCard, StatusBadge, EmptyV4,
} from '../_components/page-ui';
import {
  Activity, AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, ClipboardList, Gauge, GitBranch,
  Flag, LayoutDashboard, ListChecks, Package, Plus, RefreshCw, ShieldAlert, ShieldCheck, Target, TrendingUp, Users, Wallet, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   گام ۲.۱ مسترپلن — هاب «حاکمیت برنامه»
   شاخص‌های مالک‌دار (ماژول شاخص‌ها / جدول بخش ۲۶) · ریجستری ریسک (F17 / بخش ۲۵)
   نمرهٔ آمادگی شش‌لایهٔ وزن‌دار (بخش ۱۲/۱۳) · ممیزی سه‌گانه (بخش ۲۰/۲۱)
   قاعدهٔ ثابت سند: مقدار هر شاخص از دادهٔ زندهٔ ماژول‌ها محاسبه می‌شود؛
   عدد دستی وارد داشبورد نمی‌شود و ریسک بدون مالک ثبت نمی‌گردد.
   ═══════════════════════════════════════════════════════════════════════════ */

const LEVEL_FA: Record<string, string> = { LOW: t('پایین'), MEDIUM: t('متوسط'), HIGH: t('بالا') };
/* گام ۹.۲ — F17: ستون‌های AI روی ریسک (مورد استفاده تا توقف) */
const AI_USECASE_FA: Record<string, string> = {
  'org-question': 'جست‌وجوی سازمانی', 'meeting-assist': 'دستیار جلسه', 'dd-review': 'دستیار Due Diligence',
  'opp-priority': 'اولویت‌بندی فرصت', 'next-action': 'پیشنهاد اقدام بعدی', 'content-draft': 'تولید محتوا',
  'authority-monitor': 'پایش مرجعیت', 'authenticity': 'تشخیص اصالت',
};
const AI_DECISION_FA: Record<string, string> = { APPROVED: 'تأیید', CONDITIONAL: 'مشروط', REJECTED: 'رد' };
const LEVEL_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };
const RISK_STATUS_FA: Record<string, string> = { OPEN: t('باز'), IN_PROGRESS: t('در اقدام'), CLOSED: t('بسته') };
const RISK_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { OPEN: 'danger', IN_PROGRESS: 'warning', CLOSED: 'success' };
const GRADE_FA: Record<string, string> = { HIGH: t('درجه بالا'), MEDIUM: t('درجه متوسط'), LOW: t('درجه پایین') };
const GRADE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' };
const KPI_STATUS_FA: Record<string, string> = { ON_TARGET: t('در هدف'), NEAR: t('نزدیک هدف'), OFF_TARGET: t('خارج از هدف') };
const KPI_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { ON_TARGET: 'success', NEAR: 'warning', OFF_TARGET: 'danger' };
const ITEM_STATUS_FA: Record<string, string> = { NOT_STARTED: t('شروع‌نشده'), IN_PROGRESS: t('در جریان'), ACCEPTED: t('پذیرفته‌شده') };
const ITEM_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { NOT_STARTED: 'neutral', IN_PROGRESS: 'warning', ACCEPTED: 'success' };
const MIGRATION_FA = lt<Record<string, string>>({ KEEP: t('نگهداری'), MIGRATE: t('انتقال'), SHUTDOWN: t('خاموش‌سازی') }); /* lt: ترجمه در زمان خواندن */
const MIGRATION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { KEEP: 'info', MIGRATE: 'warning', SHUTDOWN: 'danger' };
const PRIORITY_FA = lt<Record<string, string>>({ KEEP: t('حفظ'), REDEFINE: t('بازتعریف'), HIRE: t('جذب') });
const CHANNEL_ACTION_FA = lt<Record<string, string>>({ ASSIGN_OWNER: t('واگذاری به مالک'), TRANSFER: t('انتقال'), SHUTDOWN: t('خاموش‌سازی') });
/* گام ۴.۳ — F05: وضعیت دارایی برند (رجیستری تب آمادگی) */
const ASSET_STATUS_FA = lt<Record<string, string>>({ IN_PROGRESS: t('در تدوین'), ACTIVE: t('فعال — نسخهٔ جاری') });
const ASSET_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { IN_PROGRESS: 'warning', ACTIVE: 'success' };
const ASSET_FORM_EMPTY = { name: '', version: '', ownerRole: '', location: '', status: 'IN_PROGRESS', reviewAt: '' };
/* گام ۴.۴ — تأیید هزینه: گردش تصویب هزینه پیش از تعهد (نمای کلی) */
const EXPENSE_STATUS_FA = lt<Record<string, string>>({ REQUESTED: t('در انتظار تصویب'), APPROVED: t('تصویب‌شده'), COMMITTED: t('تعهد ثبت‌شده') });
const EXPENSE_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { REQUESTED: 'neutral', APPROVED: 'info', COMMITTED: 'success' };
const EXPENSE_FORM_EMPTY = { title: '', amount: '', category: '', requesterRole: '' };
const faMoney = (v: number | string) => new Intl.NumberFormat(localeTag()).format(Number(v) || 0);
/* گام ۴.۶ — پروژه صفر: چک‌لیست پروژه صفر (نمای کلی) */
const PZ_STATUS_FA = lt<Record<string, string>>({ PENDING: t('در انتظار'), IN_PROGRESS: t('در جریان'), DONE: t('انجام‌شده') });
const PZ_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { PENDING: 'neutral', IN_PROGRESS: 'warning', DONE: 'success' };
/* گام ۵.۱ — کاتالوگ فرم‌های پیوست ب سند v6 (F01–F18) و وضعیت هرکدام در پلتفرم.
   مرجع نگاشت: docs/مسترپلن-v6-سامانه-هوشمند-SRIP.md (بخش ۴ — جدول نگاشت فرم‌ها). */
const FORM_CATALOG = lt<Array<{ code: string; name: string; status: string; where: string }>>([
  { code: 'F01', name: 'کنترل اجرا', status: 'PLANNED', where: 'حاکمیت برنامه — فاز ۱۰' },
  { code: 'F02', name: 'پروندهٔ Due Diligence', status: 'HAVE', where: 'مشارکت‌ها → پرونده‌های Due Diligence' },
  { code: 'F03', name: 'برگهٔ ممیزی ظرفیت و دارایی', status: 'PLANNED', where: 'ممیزی سه‌گانه — فاز ۱۰' },
  { code: 'F04', name: 'کارت محیط، ذی‌نفع و رقیب', status: 'HAVE', where: 'هوشمندی → پروندهٔ رقیب هفت‌بُعدی' },
  { code: 'F05', name: 'درخواست و تصویب دارایی برند', status: 'HAVE', where: 'حاکمیت برنامه → تب آمادگی' },
  { code: 'F06', name: 'فرم صفحه و انتشار PESO', status: 'HAVE', where: 'تقویم → رسانه تخصصی' },
  { code: 'F07', name: 'طرح پژوهش و داوری', status: 'PLANNED', where: 'فاز ۱۰' },
  { code: 'F08', name: 'کارت تولید و کنترل محتوای هوش مصنوعی', status: 'PARTIAL', where: 'تقویم → گردش تأیید محتوا؛ فیلدهای AI: فاز ۷' },
  { code: 'F09', name: 'فرصت مناقصه', status: 'PLANNED', where: 'فاز ۱۰' },
  { code: 'F10', name: 'طرح اجرایی و گزارش رویداد', status: 'HAVE', where: 'تقویم → رویدادها' },
  { code: 'F11', name: 'برگهٔ ورود و تطبیق داده', status: 'HAVE', where: 'ممیزی سه‌گانه → مراحل انتقال' },
  { code: 'F12', name: 'کارت کاربرد و ارزیابی هوش مصنوعی', status: 'PLANNED', where: 'درگاه هوش مصنوعی — فاز ۹' },
  { code: 'F13', name: 'پروندهٔ اصالت و تقلب', status: 'PLANNED', where: 'اصالت و ریسک — فاز ۸' },
  { code: 'F14', name: 'جدول پایش ماهانهٔ مرجعیت هوش مصنوعی', status: 'HAVE', where: 'حاکمیت برنامه → اهداف راهبردی' },
  { code: 'F15', name: 'کارت آماده‌سازی سرمایه‌گذار و شریک', status: 'HAVE', where: 'مشارکت‌ها → آماده‌سازی سرمایه‌گذار و شریک' },
  { code: 'F16', name: 'کارت نقش و ورود همکار', status: 'PLANNED', where: 'فاز ۱۰' },
  { code: 'F17', name: 'دفتر ثبت ریسک و انتشار هوش مصنوعی', status: 'PARTIAL', where: 'حاکمیت برنامه → ریسک‌ها؛ ستون‌های AI: فاز ۹' },
  { code: 'F18', name: 'کارت آماده‌سازی ورود به بازار', status: 'PLANNED', where: 'فاز ۱۰' },
]);
const FORM_STATUS_FA = lt<Record<string, string>>({ HAVE: t('موجود'), PARTIAL: t('موجود — تکمیل در برنامه'), PLANNED: t('در برنامه') });
/* گام ۵.۶ — دروازه‌های کنترل مشترک (پیوست پ سند v6): G0–G6 با شرط عبور و
   «اطلاعات ثبت‌شده در SRIP» — چارچوب مرجع؛ هر دروازه در ماژول مربوط به خودش
   اعمال می‌شود (مثلاً G4 در گردش تأیید محتوا F08 و G6 در گزارش ماهانه). */
const CONTROL_GATES = lt<Array<{ code: string; name: string; pass: string; registered: string }>>([
  { code: 'G0', name: 'دامنه', pass: 'موضوع، مالک، محصول و هدف در فهرست دامنه ثبت شده‌اند.', registered: 'شناسهٔ دامنه و مالک' },
  { code: 'G1', name: 'شواهد', pass: 'اسناد، جلسه، نمایش عملی و منابع لازم برای اظهارنظر فراهم‌اند.', registered: 'شناسهٔ مجموعهٔ شواهد و اثرانگشت دیجیتال' },
  { code: 'G2', name: 'Due Diligence', pass: 'بررسی فنی و کسب‌وکاری تکمیل و نظر مدیر تیم Y ثبت شده است.', registered: 'شناسهٔ ارزیابی و وضعیت تصویب' },
  { code: 'G3', name: 'طراحی', pass: 'طرح اجرایی، مخاطب، پیام، ریسک، دسترسی و معیار پذیرش تصویب شده‌اند.', registered: 'شناسهٔ طرح و تأییدکننده' },
  { code: 'G4', name: 'کیفیت', pass: 'راستی‌آزمایی، کنترل امنیت و حقوق، بررسی منابع و تأیید انسانی انجام شده‌اند.', registered: 'سابقهٔ کنترل کیفیت و شواهد' },
  { code: 'G5', name: 'اجرا', pass: 'نسخهٔ مصوب اجرا و سابقهٔ آن ثبت شده است.', registered: 'شناسهٔ اجرا و نسخه' },
  { code: 'G6', name: 'بازبینی', pass: 'نتیجه، خطا و درس‌آموخته ثبت شده‌اند و اقدام بعدی، مالک و مهلت مشخص دارد.', registered: 'شناسهٔ بازبینی و اقدام' },
]);
const FORM_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { HAVE: 'success', PARTIAL: 'info', PLANNED: 'neutral' };
const SEASON_STATE_FA = lt<Record<string, string>>({ PASSED: t('دروازه پاس شد'), IN_PROGRESS: t('در جریان'), PENDING: t('در انتظار') });
const SEASON_STATE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { PASSED: 'success', IN_PROGRESS: 'warning', PENDING: 'neutral' };
const AUDIT_TABS = lt<Array<[string, string]>>([
  ['people', t('افراد')], ['systems', t('سامانه‌ها')], ['channels', t('کانال‌ها')],
]);

const faDate = (iso?: string | null) => (iso ? faFullDate(new Date(iso)) : '—');

export default function ProgramPage() {
  const { can } = useWorkspace();
  const writable = can('program.write');
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /* ریسک: فیلترها + مودال‌ها */
  const [riskFilter, setRiskFilter] = useState<{ status: string; grade: string }>({ status: '', grade: '' });
  const [riskDetail, setRiskDetail] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', probability: 'MEDIUM', impact: 'MEDIUM', preventive: '', reactive: '', ownerRole: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [auditTab, setAuditTab] = useState('people');
  const [auditDetail, setAuditDetail] = useState<any | null>(null);

  /* اهداف راهبردی: مؤلفه‌های پایش‌شده + پایش ماهانه (گام ۲.۳) */
  const [goalIdx, setGoalIdx] = useState(0);
  const [goalCreateOpen, setGoalCreateOpen] = useState(false);
  const [goalFormError, setGoalFormError] = useState('');
  const [goalForm, setGoalForm] = useState({ title: '', owner: '', description: '' });
  const [goalComps, setGoalComps] = useState([{ title: '', method: '', target6: '', target12: '', value: '', unit: 'count' }]);
  const [compEdit, setCompEdit] = useState<any | null>(null);
  const [compValue, setCompValue] = useState('');
  const [monOpen, setMonOpen] = useState(false);
  const [monError, setMonError] = useState('');
  const [monForm, setMonForm] = useState({ system: '', referralRate: '', accuracy: '', probableSource: '', action: '' });

  /* شاخص: ثبت ماژول شاخص‌ها — تعریف شاخص دادهٔ سازمان است و به سنجهٔ محاسبهٔ پلتفرم bind می‌شود */
  const [kpiCreateOpen, setKpiCreateOpen] = useState(false);
  const [kpiFormError, setKpiFormError] = useState('');
  const [metrics, setMetrics] = useState<any[]>([]);
  const [kpiForm, setKpiForm] = useState({ title: '', category: '', owner: '', period: '', target: '', metric: '', targetValue: '' });
  /* گام ۴.۳ — F05: رجیستری دارایی برند (تب آمادگی) */
  const [assets, setAssets] = useState<any | null>(null);
  const [assetCreateOpen, setAssetCreateOpen] = useState(false);
  const [assetEdit, setAssetEdit] = useState<any | null>(null);
  const [assetFormError, setAssetFormError] = useState('');
  const [assetForm, setAssetForm] = useState(ASSET_FORM_EMPTY);
  /* گام ۴.۴ — تأیید هزینه: تأیید هزینه پیش از تعهد (نمای کلی) */
  const [expenses, setExpenses] = useState<any | null>(null);
  const [expCreateOpen, setExpCreateOpen] = useState(false);
  const [expFormError, setExpFormError] = useState('');
  const [expForm, setExpForm] = useState(EXPENSE_FORM_EMPTY);
  /* گام ۴.۶ — پروژه صفر: چک‌لیست پروژه صفر (نمای کلی) */
  const [projectZero, setProjectZero] = useState<any | null>(null);

  const load = useCallback(async (which: string) => {
    setLoading(true); setError('');
    try {
      const path = which === 'overview' ? '/program/overview'
        : which === 'kpis' ? '/program/kpis'
          : which === 'risks' ? `/program/risks${riskFilter.status || riskFilter.grade ? `?${new URLSearchParams({ ...(riskFilter.status ? { status: riskFilter.status } : {}), ...(riskFilter.grade ? { grade: riskFilter.grade } : {}) }).toString()}` : ''}`
            : which === 'readiness' ? '/program/readiness'
            : which === 'goals' ? '/program/goals' : '/program/audits';
      const result = await api<any>(path);
      setData((prev: Record<string, any>) => ({ ...prev, [which]: result }));
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, [riskFilter]);

  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  /* تغییر فیلتر ریسک (وضعیت/درجه) → بازخوانی همان تب */
  useEffect(() => { if (tab === 'risks') load('risks'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [riskFilter]);
  /* گام ۴.۳ — رجیستری دارایی برند جدا از نمرهٔ آمادگی بار می‌شود (F05 / پیوست ب) */
  const reloadAssets = useCallback(async () => { try { setAssets(await api<any>('/program/brand-assets')); } catch { /* در نبود مجوز، پنل مخفی می‌شود */ } }, []);
  useEffect(() => { if (tab === 'readiness') reloadAssets(); }, [tab, reloadAssets]);
  /* گام ۴.۴ — گردش هزینه جدا از نمای کلی بار می‌شود (ماژول پلتفرمی) */
  const reloadExpenses = useCallback(async () => { try { setExpenses(await api<any>('/program/expenses')); } catch { /* در نبود مجوز، پنل مخفی می‌شود */ } }, []);
  useEffect(() => { if (tab === 'overview') reloadExpenses(); }, [tab, reloadExpenses]);
  /* گام ۴.۶ — چک‌لیست پروژه صفر (ماژول پلتفرمی) */
  const reloadProjectZero = useCallback(async () => { try { setProjectZero(await api<any>('/program/project-zero')); } catch { /* در نبود مجوز، پنل مخفی می‌شود */ } }, []);
  useEffect(() => { if (tab === 'overview') reloadProjectZero(); }, [tab, reloadProjectZero]);

  const refresh = () => load(tab);

  /* گام ۴.۱ — F11: تکمیل مرحلهٔ جاریِ انتقال سامانه (ترتیبی؛ سرور قاعده را اعمال می‌کند) */
  const completeMigrationStep = async (sysId: string, key: string) => {
    setError('');
    try {
      await api(`/program/audit/systems/${sysId}/steps/${key}`, { method: 'POST' });
      const result = await api<any>('/program/audits');
      setData((prev: Record<string, any>) => ({ ...prev, audit: result }));
      setAuditDetail((d: any) => (d && d.kind === 'systems' ? { ...d, row: result.systems.find((s: any) => s.id === sysId) } : d));
    } catch (x) { setError((x as Error).message); }
  };

  const reloadRisks = () => { load('risks'); load('overview'); };

  const submitRisk = async () => {
    setFormError(''); setBusy(true);
    try {
      /* گام ۹.۲ — اگر کاربرد AI انتخاب شده باشد، ریسک با ستون‌های هشت‌گانهٔ AI ثبت می‌شود */
      const payload: any = { ...form };
      if ((form as any).aiUseCase) payload.ai = { useCase: (form as any).aiUseCase, finding: (form as any).aiFinding ?? '' };
      await api('/program/risks', { method: 'POST', body: JSON.stringify(payload) });
      setCreateOpen(false);
      setForm({ title: '', probability: 'MEDIUM', impact: 'MEDIUM', preventive: '', reactive: '', ownerRole: '', notes: '', aiUseCase: '', aiFinding: '' } as any);
      reloadRisks();
    } catch (x) { setFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  /* گام ۹.۲ — ذخیرهٔ ستون‌های AI ریسک (تصمیم انتشار/توقف) از مودال جزئیات */
  const saveRiskAi = async () => {
    if (!riskDetail?.ai) return;
    setBusy(true);
    try {
      const r: any = await api(`/program/risks/${riskDetail.id}`, { method: 'PATCH', body: JSON.stringify({ ai: riskDetail.ai }) });
      setRiskDetail(r); reloadRisks();
    } catch (x) { setFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  const setRiskStatus = async (id: string, status: string) => {
    setBusy(true);
    try { await api(`/program/risks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); reloadRisks(); if (riskDetail) setRiskDetail({ ...riskDetail, status }); }
    finally { setBusy(false); }
  };

  const cycleReadinessItem = async (layerKey: string, item: any) => {
    if (!writable) return;
    const next = item.status === 'NOT_STARTED' ? 'IN_PROGRESS' : item.status === 'IN_PROGRESS' ? 'ACCEPTED' : 'NOT_STARTED';
    setBusy(true);
    try { await api(`/program/readiness/${layerKey}/items/${item.key}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); load('readiness'); load('overview'); }
    catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  };

  const openKpiCreate = async () => {
    setKpiCreateOpen(true); setKpiFormError('');
    if (!metrics.length) {
      try {
        const r = await api<any>('/program/settings');
        /* سنجهٔ «خط پایهٔ اعلامی» فقط برای دادهٔ بذری است؛ در فرم ارائه نمی‌شود */
        setMetrics((r.metrics ?? []).filter((m: any) => m.key !== 'declared-baseline'));
      } catch { /* اعتبارسنجی سرور راهنما می‌دهد */ }
    }
  };

  const submitKpi = async () => {
    setKpiFormError(''); setBusy(true);
    try {
      await api('/program/kpis', { method: 'POST', body: JSON.stringify({ ...kpiForm, targetValue: Number(kpiForm.targetValue) }) });
      setKpiCreateOpen(false);
      setKpiForm({ title: '', category: '', owner: '', period: '', target: '', metric: '', targetValue: '' });
      load('kpis'); load('overview');
    } catch (x) { setKpiFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  /* گام ۴.۳ — F05: ثبت/ویرایش دارایی برند + مهر بازبینی فصلی */
  const openAssetCreate = () => { setAssetCreateOpen(true); setAssetEdit(null); setAssetFormError(''); setAssetForm({ ...ASSET_FORM_EMPTY }); };
  const openAssetEdit = (row: any) => { setAssetEdit(row); setAssetCreateOpen(false); setAssetFormError('');
    setAssetForm({ name: row.name, version: row.version, ownerRole: row.ownerRole, location: row.location, status: row.status, reviewAt: row.reviewAt ? String(row.reviewAt).slice(0, 10) : '' }); };
  const submitAsset = async () => {
    setAssetFormError(''); setBusy(true);
    try {
      if (assetEdit) await api(`/program/brand-assets/${assetEdit.id}`, { method: 'PATCH', body: JSON.stringify(assetForm) });
      else await api('/program/brand-assets', { method: 'POST', body: JSON.stringify(assetForm) });
      setAssetCreateOpen(false); setAssetEdit(null); await reloadAssets();
    } catch (x) { setAssetFormError((x as Error).message); }
    finally { setBusy(false); }
  };
  const reviewAsset = async () => {
    setAssetFormError(''); setBusy(true);
    try {
      await api(`/program/brand-assets/${assetEdit.id}/review`, { method: 'POST' });
      setAssetEdit(null); await reloadAssets();
    } catch (x) { setAssetFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  /* گام ۴.۴ — تأیید هزینه: ثبت درخواست → تصویب مدیر مالی → ثبت تعهد */
  const openExpCreate = () => { setExpCreateOpen(true); setExpFormError(''); setExpForm({ ...EXPENSE_FORM_EMPTY }); };
  const submitExpense = async () => {
    setExpFormError(''); setBusy(true);
    try {
      await api('/program/expenses', { method: 'POST', body: JSON.stringify({ ...expForm, amount: Number(expForm.amount) }) });
      setExpCreateOpen(false); await reloadExpenses();
    } catch (x) { setExpFormError((x as Error).message); }
    finally { setBusy(false); }
  };
  const expenseAction = async (id: string, action: 'approve' | 'commit') => {
    setError(''); setBusy(true);
    try { await api(`/program/expenses/${id}/${action}`, { method: 'POST' }); await reloadExpenses(); }
    catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  };

  /* گام ۴.۶ — پروژه صفر: چرخش وضعیت خروجی تأسیس (در انتظار → در جریان → انجام‌شده) */
  const cycleZeroItem = async (key: string, status: string) => {
    if (!writable) return;
    const next = status === 'PENDING' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'DONE' : 'PENDING';
    setBusy(true);
    try { setProjectZero(await api(`/program/project-zero/items/${key}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })); }
    catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  };

  const openGoalCreate = () => {
    setGoalCreateOpen(true); setGoalFormError('');
    setGoalForm({ title: '', owner: '', description: '' });
    setGoalComps([{ title: '', method: '', target6: '', target12: '', value: '', unit: 'count' }]);
  };

  const submitGoal = async () => {
    setGoalFormError(''); setBusy(true);
    try {
      const components = goalComps
        .filter((c: any) => c.title.trim() || c.method.trim() || c.target6 || c.target12)
        .map((c: any) => ({ title: c.title, method: c.method, target6: Number(c.target6) || 0, target12: Number(c.target12) || 0, value: Number(c.value) || 0, unit: c.unit }));
      await api('/program/goals', { method: 'POST', body: JSON.stringify({ ...goalForm, components }) });
      setGoalCreateOpen(false);
      load('goals');
    } catch (x) { setGoalFormError((x as Error).message); }
    finally { setBusy(false); }
  };

  const submitMonitoring = async () => {
    setMonError(''); setBusy(true);
    try {
      const g = (data.goals?.items ?? [])[goalIdx];
      await api(`/program/goals/${g.id}/monitoring`, { method: 'POST', body: JSON.stringify({ ...monForm, referralRate: Number(monForm.referralRate), accuracy: Number(monForm.accuracy) }) });
      setMonOpen(false);
      setMonForm({ system: '', referralRate: '', accuracy: '', probableSource: '', action: '' });
      load('goals');
    } catch (x) { setMonError((x as Error).message); }
    finally { setBusy(false); }
  };

  const saveComponentValue = async () => {
    setBusy(true);
    try {
      const g = (data.goals?.items ?? [])[goalIdx];
      const updated = await api<any>(`/program/goals/${g.id}/components/${compEdit.id}`, { method: 'PATCH', body: JSON.stringify({ value: Number(compValue) }) });
      setData((prev: Record<string, any>) => ({ ...prev, goals: { ...prev.goals, items: prev.goals.items.map((x: any, i: number) => i === goalIdx ? updated : x) } }));
      setCompEdit(null);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  };

  const d = data[tab];
  const overview = data.overview;
  const kpis = data.kpis;
  const risks = data.risks;
  const readiness = data.readiness;
  const audits = data.audit; /* کلید ذخیره‌سازی = مقدار تب ('audit') */
  const goals = data.goals;

  const tabs = useMemo(() => ([
    { value: 'overview', label: t('نمای کلی') },
    { value: 'kpis', label: t('شاخص‌ها') },
    { value: 'risks', label: t('ریسک‌ها') },
    { value: 'readiness', label: t('آمادگی بازار') },
    { value: 'audit', label: t('ممیزی سه‌گانه') },
    { value: 'goals', label: t('اهداف راهبردی') },
  ]), []);

  const tabCounts: Record<string, number | undefined> = {
    kpis: kpis?.total, risks: risks?.items?.length, audit: audits ? audits.people.length + audits.systems.length + audits.channels.length : undefined,
  };

  return (
    <main className="feature-page">
      <PageHeader
        title={t('حاکمیت برنامه')}
        description={t('شاخص‌های مالک‌دار، ریجستری ریسک، نمرهٔ آمادگی شش‌لایه و ممیزی سه‌گانه — همه از دادهٔ زندهٔ سامانه محاسبه می‌شود، بدون عدد دستی.')}
        actions={<div className="heading-tools">
          <button className="srip-button" onClick={refresh} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('بازخوانی')}</button>
        </div>}
      />
      <ErrorCard message={error} />
      {loading && !d ? <Loading /> : null}

      <Segmented options={tabs} value={tab} onChange={setTab} counts={tabCounts as any} />

      {/* ═══════════ تب نمای کلی — وضعیت فصل‌ها و دروازه‌ها ═══════════ */}
      {tab === 'overview' && overview && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Gauge size={18} />} label={t('نمرهٔ آمادگی (میانگین وزنی شش لایه)')} value={`${faNum(overview.readiness.total)}٪`} iconClass="ic-blue"
              sub={t('دروازهٔ فصل جاری: آستانهٔ ') + faNum(overview.readiness.seasons.find((s: any) => s.current)?.threshold ?? '—') + '٪'} />
            <StatCard icon={<Target size={18} />} label={t('شاخص‌ها در هدف')} value={`${faNum(overview.kpis.onTarget)} ${t('از')} ${faNum(overview.kpis.total)}`} iconClass="ic-teal"
              sub={`${t('نزدیک هدف')}: ${faNum(overview.kpis.near)} · ${t('خارج از هدف')}: ${faNum(overview.kpis.off)}`} />
            <StatCard icon={<ShieldAlert size={18} />} label={t('ریسک‌های درجهٔ بالا (باز)')} value={faNum(overview.risks.highOpen)} iconClass="ic-red"
              sub={t('طبق سند، وضعیت این ریسک‌ها در گزارش ماهانه به مدیریت هلدینگ ارائه می‌شود')} />
            <StatCard icon={<GitBranch size={18} />} label={t('انتقال سامانه‌ها')} value={`${faNum(overview.audits.migrationDone)} ${t('از')} ${faNum(overview.audits.migrationTotal)}`} iconClass="ic-gold"
              sub={t('سامانه‌های در صف انتقال یا خاموش‌سازی که تکمیل شده‌اند')} />
          </div>

          <SectionCard title={t('فصل‌های برنامه و دروازهٔ عبور')} icon={<ListChecks size={17} />}
            description={t('بدون رسیدن به آستانهٔ مصوب هر فصل، ورود به فاز بعدی برنامه تصویب نمی‌شود.')}>
            {overview.readiness.seasons.length ? null : (
              <EmptyV4 icon={<ListChecks size={30} />} title={t('فصل‌های برنامه تعریف نشده است')}
                description={t('فصل‌ها و آستانه‌های دروازه در تنظیمات برنامهٔ سازمان شما ثبت نشده است.')} />
            )}
            <div className="season-row">
              {overview.readiness.seasons.map((s: any) => (
                <div key={s.season} className={`season-card ${s.state === 'PASSED' ? 'passed' : s.current ? 'current' : ''}`}>
                  <div className="season-head">
                    <b>{t('فصل')} {faNum(s.season)} — {s.title}</b>
                    <StatusBadge tone={SEASON_STATE_TONE[s.state]}>{SEASON_STATE_FA[s.state]}</StatusBadge>
                  </div>
                  <div className="season-meta">{s.months}</div>
                  <div className="season-score">
                    <span>{t('نمره')}: <b>{s.score == null ? '—' : `${faNum(s.score)}٪`}</b></span>
                    <span>{t('آستانه')}: <b>{faNum(s.threshold)}٪</b></span>
                  </div>
                  <div className="prog-bar season-bar"><div className="prog-fill" style={{ width: `${Math.min(100, s.score ?? 0)}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="trend-row" aria-label={t('روند فصلی نمرهٔ آمادگی')}>
              {overview.readiness.trend.map((h: any, i: number) => (
                <div key={i} className="trend-col" title={`${h.label}: ${faNum(h.score)}٪`}>
                  <div className="trend-bar-wrap"><div className={`trend-bar ${h.current ? 'current' : ''}`} style={{ height: `${Math.max(6, h.score)}%` }} /></div>
                  <span className="trend-label">{h.label}</span>
                  <span className="trend-value">{faNum(h.score)}٪</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="two-col-grid">
            <SectionCard title={t('ریسک‌های درجهٔ بالا')} icon={<AlertTriangle size={17} />}
              actions={<button className="srip-button" onClick={() => setTab('risks')}><ArrowLeft size={14} /> {t('مدیریت ریسک‌ها')}</button>}>
              {overview.risks.high.length ? (
                <div className="mini-list">
                  {overview.risks.high.map((r: any) => (
                    <div key={r.id} className="mini-row">
                      <span className="t-primary">{r.title}</span>
                      <span className="t-muted">{t('مالک')}: {r.ownerRole}</span>
                      <StatusBadge tone="danger">{LEVEL_FA[r.probability]} × {LEVEL_FA[r.impact]}</StatusBadge>
                    </div>
                  ))}
                </div>
              ) : <EmptyV4 icon={<CheckCircle2 size={22} />} title={t('ریسک درجهٔ بالایی باز نیست')}
                description={t('فهرست ریسک در آغاز هر فصل بازبینی می‌شود؛ ریسک تازه را از تب «ریسک‌ها» ثبت کنید.')} />}
            </SectionCard>
            <SectionCard title={t('شاخص‌های کلیدی')} icon={<LayoutDashboard size={17} />}
              actions={<button className="srip-button" onClick={() => setTab('kpis')}><ArrowLeft size={14} /> {t('همهٔ شاخص‌ها')}</button>}>
              <div className="mini-list">
                {overview.kpis.items.slice(0, 4).map((k: any) => (
                  <div key={k.id} className="mini-row">
                    <span className="t-primary">{k.title}</span>
                    <span className="t-muted">{k.valueLabel}</span>
                    <StatusBadge tone={KPI_STATUS_TONE[k.status]}>{KPI_STATUS_FA[k.status]}</StatusBadge>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* ═══════════ تأیید هزینه پیش از تعهد (ماژول پلتفرمی) (پیوست ب سند) ═══════════ */}
          <SectionCard className="expense-panel" title={t('تأیید هزینه پیش از تعهد (ماژول پلتفرمی)')} icon={<Wallet size={17} />}
            description={t('هزینه پیش از تعهد تصویب می‌شود: درخواست با شرح، مبلغ و دسته ثبت می‌شود، مدیر مالی تصویب می‌کند و تعهد فقط پس از تصویب ثبت می‌شود.')}
            actions={writable ? <button className="srip-button primary" onClick={openExpCreate}><Plus size={14} /> {t('ثبت درخواست هزینه')}</button> : undefined}>
            {expenses ? (<>
              <div className="chip-row" style={{ margin: '0 0 10px' }}>
                <span className="chip neutral">{t('کل')}: {faNum(expenses.stats.total)}</span>
                <span className="chip neutral">{t('در انتظار تصویب')}: {faNum(expenses.stats.pending)}</span>
                <span className="chip info">{t('تصویب‌شده')}: {faNum(expenses.stats.approved)}</span>
                <span className="chip success">{t('تعهد ثبت‌شده')}: {faNum(expenses.stats.committed)}</span>
                <span className="chip gold">{t('جمع تعهدات')}: {faMoney(expenses.stats.committedAmount)} {t('تومان')}</span>
              </div>
              {expenses.items.length ? (
                <div className="table-wrap"><table className="expense-table">
                  <thead><tr>
                    <th>{t('شرح هزینه')}</th><th>{t('مبلغ (تومان)')}</th><th>{t('دستهٔ هزینه')}</th>
                    <th>{t('درخواست‌کننده')}</th><th>{t('وضعیت')}</th><th>{t('اقدام')}</th>
                  </tr></thead>
                  <tbody>
                    {expenses.items.map((e: any) => (
                      <tr key={e.id}>
                        <td className="t-primary">{e.title}</td>
                        <td><b>{faMoney(e.amount)}</b></td>
                        <td><span className="chip">{e.category}</span></td>
                        <td>{e.requesterRole}</td>
                        <td><StatusBadge tone={EXPENSE_STATUS_TONE[e.status]}>{EXPENSE_STATUS_FA[e.status]}</StatusBadge></td>
                        <td>{e.status === 'COMMITTED' ? <span className="t-muted">{faDate(e.committedAt)}</span>
                          : !writable ? '—' : (
                            <button type="button" className="srip-button" style={{ padding: '3px 10px' }} disabled={busy}
                              onClick={() => expenseAction(e.id, e.status === 'REQUESTED' ? 'approve' : 'commit')}>
                              {e.status === 'REQUESTED' ? t('تصویب') : t('ثبت تعهد')}
                            </button>
                          )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <EmptyV4 icon={<Wallet size={22} />} title={t('هنوز درخواست هزینه‌ای ثبت نشده است')}
                  description={t('هر هزینه پیش از تعهد تصویب می‌شود — از «ثبت درخواست هزینه» آغاز کنید.')} />
              )}
              <p className="field-hint">{t('هزینه پیش از تعهد تصویب می‌شود (ماژول پلتفرمی): درخواست با شرح، مبلغ و دسته ثبت می‌شود، مدیر مالی تصویب می‌کند و تعهد فقط پس از تصویب قابل ثبت است.')}</p>
            </>) : <Loading />}
          </SectionCard>

          {/* ═══════════ چک‌لیست پروژه صفر (ماژول پلتفرمی) (پیوست ب سند) ═══════════ */}
          <SectionCard className="project-zero-panel" title={t('چک‌لیست پروژه صفر (ماژول پلتفرمی)')} icon={<Flag size={17} />}
            description={t('بیست خروجی تأسیس — از تعیین نوع شرکت تا ساختار گزارش مالی؛ تکمیل همهٔ خروجی‌ها شرط عبور از فاز استقرار است.')}>
            {projectZero ? (<>
              <div className={`note-strip ${projectZero.passed ? '' : 'warn'}`}>
                {projectZero.passed
                  ? t('دروازهٔ فاز استقرار برقرار است — هر بیست خروجی تأسیس تکمیل شده و پروژه صفر بسته است.')
                  : t('شرط عبور از فاز استقرار: تکمیل همهٔ بیست خروجی') + ` — ${faNum(projectZero.stats.done)} ${t('از')} ${faNum(projectZero.stats.total)}`}
              </div>
              <div className="prog-bar season-bar" style={{ margin: '10px 0 12px' }}>
                <div className={`prog-fill ${projectZero.passed ? '' : 'warn'}`} style={{ width: `${Math.round((projectZero.stats.done / projectZero.stats.total) * 100)}%` }} />
              </div>
              <div className="chip-row" style={{ margin: '0 0 10px' }}>
                <span className="chip neutral">{t('کل')}: {faNum(projectZero.stats.total)}</span>
                <span className="chip success">{t('انجام‌شده')}: {faNum(projectZero.stats.done)}</span>
                <span className="chip warning">{t('در جریان')}: {faNum(projectZero.stats.inProgress)}</span>
                <span className="chip neutral">{t('در انتظار')}: {faNum(projectZero.stats.pending)}</span>
              </div>
              <div className="pz-grid">
                {projectZero.items.map((it: any) => (
                  <button type="button" key={it.key} className={`pz-item ${it.status} ${writable ? 'clickable' : ''}`}
                    disabled={!writable || busy} onClick={() => cycleZeroItem(it.key, it.status)}
                    title={writable ? t('کلیک: تغییر وضعیت (در انتظار → در جریان → انجام‌شده)') : t('برای تغییر وضعیت به مجوز برنامه نیاز دارید')}>
                    <span className="pz-order">{faNum(it.order)}</span>
                    <span className="pz-title">{t(it.title)}</span>
                    <StatusBadge tone={PZ_STATUS_TONE[it.status]}>{PZ_STATUS_FA[it.status]}</StatusBadge>
                  </button>
                ))}
              </div>
              <p className="field-hint">{t('پروژه صفر با بیست خروجی تأسیس تعریف می‌شود؛ تکمیل همهٔ خروجی‌ها شرط عبور از فاز استقرار است (ماژول پلتفرمی).')}</p>
            </>) : <Loading />}
          </SectionCard>

          {/* ═══════════ گام ۵.۱ — کاتالوگ فرم‌های سند v6 (پیوست ب) ═══════════ */}
          <SectionCard className="form-catalog" title={t('کاتالوگ فرم‌های سند (F01–F18)')} icon={<BookOpen size={17} />}
            description={t('نگاشت هجده فرم عملیاتی پیوست ب سند v6 به ماژول‌های پلتفرم؛ فرم‌های بدون معادل سندی، ماژول پلتفرمی‌اند و کد نمی‌گیرند.')}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>{t('کد')}</th><th>{t('فرم')}</th><th>{t('وضعیت در پلتفرم')}</th><th>{t('محل')}</th></tr>
                </thead>
                <tbody>
                  {FORM_CATALOG.map((f: any) => (
                    <tr key={f.code}>
                      <td className="t-primary">{f.code}</td>
                      <td>{f.name}</td>
                      <td><StatusBadge tone={FORM_STATUS_TONE[f.status]}>{FORM_STATUS_FA[f.status]}</StatusBadge></td>
                      <td className="t-muted" style={{ fontSize: 11.5 }}>{f.where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-hint">{t('ماژول‌های پلتفرمی بدون کد سندی: چک‌لیست پروژه صفر · پروندهٔ شناخت · شاخص‌های برنامه · تأیید هزینه · گزارش ماهانه · صورت‌جلسهٔ تحویل.')}</p>
          </SectionCard>

          {/* ═══════════ گام ۵.۶ — دروازه‌های کنترل مشترک (پیوست پ سند v6) ═══════════ */}
          <SectionCard className="control-gates" title={t('دروازه‌های کنترل مشترک (G0–G6)')} icon={<ShieldCheck size={17} />}
            description={t('چارچوب مشترک عبور در همهٔ پروژه‌ها؛ هر دروازه در ماژول مربوط به خودش اعمال می‌شود — مثلاً G4 در گردش تأیید محتوا (F08) و G6 در گزارش ماهانه.')}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('دروازه')}</th><th>{t('شرط عبور')}</th><th>{t('اطلاعات ثبت‌شده در SRIP')}</th></tr></thead>
                <tbody>
                  {CONTROL_GATES.map((g: any) => (
                    <tr key={g.code}>
                      <td className="t-primary">{g.code} — {t(g.name)}</td>
                      <td>{t(g.pass)}</td>
                      <td className="t-muted" style={{ fontSize: 11.5 }}>{t(g.registered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {/* ═══════════ تب شاخص‌ها — ماژول شاخص‌ها / جدول بخش ۲۶ سند ═══════════ */}
      {tab === 'kpis' && kpis && (
        <>
          <div className="note-strip">{t('قاعدهٔ سند: هر شاخص مالک، هدف عددی و دورهٔ سنجش مشخص دارد و از دادهٔ ثبت‌شده در سامانه محاسبه می‌شود — عدد دستی وارد داشبورد نمی‌شود.')}</div>
          <SectionCard title={t('شاخص‌های برنامه')} icon={<Target size={17} />}
            description={`${faNum(kpis.total)} ${t('شاخص در پنج دسته')} · ${t('در هدف')}: ${faNum(kpis.summary.onTarget)} · ${t('نزدیک')}: ${faNum(kpis.summary.near)} · ${t('خارج از هدف')}: ${faNum(kpis.summary.off)}`}
            actions={writable ? (
              <button className="srip-button primary" onClick={openKpiCreate}><Plus size={14} /> {t('ثبت شاخص')}</button>
            ) : undefined}>
            {!kpis.items.length ? (
              <EmptyV4 icon={<Target size={30} />} title={t('هنوز شاخصی ثبت نشده است')}
                description={t('شاخص‌های برنامهٔ سازمان خود را با مالک، هدف و سنجهٔ محاسبه ثبت کنید؛ مقدار هر شاخص از دادهٔ زندهٔ سامانه محاسبه می‌شود.')}
                action={writable ? <button className="srip-button primary" onClick={openKpiCreate}><Plus size={14} /> {t('ثبت شاخص')}</button> : undefined} />
            ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('شاخص')}</th><th>{t('مالک')}</th><th>{t('دورهٔ سنجش')}</th><th>{t('هدف')}</th>
                    <th>{t('مقدار جاری')}</th><th>{t('وضعیت')}</th><th>{t('منبع محاسبه')}</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.items.map((k: any) => (
                    <tr key={k.id}>
                      <td>
                        <div className="t-primary">{k.title}</div>
                        <div className="t-muted" style={{ fontSize: 11 }}>{k.category}</div>
                      </td>
                      <td>{k.owner}</td>
                      <td>{k.period}</td>
                      <td>{k.target}</td>
                      <td>
                        <div style={{ minWidth: 110 }}>
                          <b>{k.valueLabel}</b>
                          <div className="prog-bar season-bar"><div className={`prog-fill ${k.status === 'OFF_TARGET' ? 'bad' : ''}`} style={{ width: `${Math.min(100, k.percent)}%` }} /></div>
                        </div>
                      </td>
                      <td><StatusBadge tone={KPI_STATUS_TONE[k.status]}>{KPI_STATUS_FA[k.status]}</StatusBadge></td>
                      <td className="t-muted" style={{ fontSize: 11 }}>{k.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </SectionCard>
        </>
      )}

      {/* ═══════════ تب ریسک‌ها — F17 / بخش ۲۵ سند ═══════════ */}
      {tab === 'risks' && risks && (
        <>
          {(risks.summary.highOpen > 0) && (
            <div className="alert-banner warn">
              <ShieldAlert size={18} />
              <div>{t('ریسک‌های درجهٔ بالای باز')}: <b>{faNum(risks.summary.highOpen)}</b> — {t('وضعیت آن‌ها در گزارش ماهانه به مدیریت هلدینگ ارائه می‌شود.')}</div>
            </div>
          )}
          <SectionCard title={t('ماتریس احتمال × اثر')} icon={<Activity size={17} />}
            description={t('سلول‌ها شمار ریسک‌های باز (غیر بسته) هستند؛ کلیک روی سلول، همان درجه را فیلتر می‌کند.')}>
            <div className="risk-matrix" role="table" aria-label={t('ماتریس احتمال و اثر')}>
              <div className="rm-corner" />
              {[...'HIGH,MEDIUM,LOW'].reverse().map(imp => <div key={`h-${imp}`} className="rm-head">{t('اثر')} {LEVEL_FA[imp]}</div>)}
              {['HIGH', 'MEDIUM', 'LOW'].map(prob => (
                <div key={prob} className="rm-row">
                  <div className="rm-head">{t('احتمال')} {LEVEL_FA[prob]}</div>
                  {['LOW', 'MEDIUM', 'HIGH'].map(imp => {
                    const cell = (risks.matrix ?? []).flat().find((c: any) => c.probability === prob && c.impact === imp);
                    /* درجهٔ سلول = همان قاعدهٔ سرور: امتیاز احتمال×اثر (۶+ = درجه بالا) */
                    const LV: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
                    const score = LV[prob] * LV[imp];
                    const grade = score >= 6 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
                    const cls = grade === 'HIGH' ? 'high' : grade === 'MEDIUM' ? 'mid' : 'low';
                    return (
                      <button key={`${prob}-${imp}`} className={`rm-cell ${cls} ${cell?.count ? 'has' : ''}`} disabled={!cell?.count}
                        onClick={() => setRiskFilter(f => (f.grade === grade ? { status: f.status, grade: '' } : { status: f.status, grade }))}
                        title={`${LEVEL_FA[prob]} × ${LEVEL_FA[imp]}: ${faNum(cell?.count ?? 0)}`}>
                        {faNum(cell?.count ?? 0)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="chip-row" style={{ marginTop: 10 }}>
              <button className={`chip ${!riskFilter.status && !riskFilter.grade ? 'purple' : 'neutral'}`} onClick={() => setRiskFilter({ status: '', grade: '' })}>{t('همه')} ({faNum(risks.items.length)})</button>
              {Object.entries(RISK_STATUS_FA).map(([k, label]) => (
                <button key={k} className={`chip ${riskFilter.status === k ? 'purple' : 'neutral'}`}
                  onClick={() => setRiskFilter(f => ({ ...f, status: f.status === k ? '' : k }))}>{label}</button>
              ))}
              <span style={{ flex: 1 }} />
              {Object.entries(GRADE_FA).map(([k, label]) => (
                <button key={k} className={`chip ${riskFilter.grade === k ? 'purple' : 'neutral'}`}
                  onClick={() => setRiskFilter(f => ({ ...f, grade: f.grade === k ? '' : k }))}>{label}</button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t('ریجستری ریسک')} icon={<ClipboardList size={17} />}
            description={t('هر ریسک با چهار قلم بنیادی ثبت می‌شود: احتمال، اثر، پاسخ (پیشگیرانه و واکنشی) و مالک.')}
            actions={writable && (
              <button className="srip-button primary" onClick={() => { setFormError(''); setCreateOpen(true); }}><Plus size={14} /> {t('ریسک جدید')}</button>
            )}>
            {risks.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>{t('ریسک')}</th><th>{t('احتمال')}</th><th>{t('اثر')}</th><th>{t('درجه')}</th><th>{t('مالک')}</th><th>{t('وضعیت')}</th><th>{t('بازبینی')}</th></tr>
                  </thead>
                  <tbody>
                    {risks.items.map((r: any) => (
                      <tr key={r.id} className="row-click" onClick={() => setRiskDetail(r)}>
                        <td className="t-primary">{r.title}{r.kind === 'AI' && <span className="chip purple" style={{marginInlineStart:6}}>AI</span>}</td>
                        <td><StatusBadge tone={LEVEL_TONE[r.probability]}>{r.probabilityFa}</StatusBadge></td>
                        <td><StatusBadge tone={LEVEL_TONE[r.impact]}>{r.impactFa}</StatusBadge></td>
                        <td><StatusBadge tone={GRADE_TONE[r.grade]}>{r.gradeFa}</StatusBadge></td>
                        <td>{r.ownerRole}</td>
                        <td><StatusBadge tone={RISK_STATUS_TONE[r.status]}>{r.statusFa}</StatusBadge></td>
                        <td className="t-muted" style={{ fontSize: 11 }}>{faDate(r.reviewAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyV4 icon={<ShieldAlert size={22} />} title={t('ریسکی ثبت نشده است')}
                description={t('فهرست ریسک در آغاز هر فصل بازبینی می‌شود؛ با «ریسک جدید» نخستین ریسک را با چهار قلم بنیادی ثبت کنید.')} />
            )}
          </SectionCard>
        </>
      )}

      {/* ═══════════ تب آمادگی — شش لایهٔ وزن‌دار بخش ۱۲/۱۳ ═══════════ */}
      {tab === 'readiness' && readiness && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Gauge size={18} />} label={t('نمرهٔ آمادگی کل')} value={`${faNum(readiness.total)}٪`} iconClass="ic-blue"
              sub={t('میانگین وزنی شش لایه — هر فصل در داشبورد محاسبه و گزارش می‌شود')} />
            <StatCard icon={<ListChecks size={18} />} label={t('دروازهٔ فصل جاری')} value={(() => {
              const cur = readiness.seasons.find((s: any) => s.current);
              return cur ? `${t('فصل')} ${faNum(cur.season)} — ${faNum(cur.threshold)}٪` : '—';
            })()} iconClass="ic-gold"
              sub={(() => {
                const cur = readiness.seasons.find((s: any) => s.current);
                if (!readiness.seasons.length) return t('فصل‌های برنامه در تنظیمات سازمان تعریف نشده است');
                if (!cur) return t('برنامه در فصل تحویل است.');
                return cur.score >= cur.threshold ? t('آستانه پاس شد — آمادهٔ تصویب ورود به فاز بعد') : t('هنوز به آستانه نرسیده — اقلام پذیرفته‌شده را بیشتر کنید');
              })()} />
          </div>
          <div className="note-strip">{t('نمرهٔ هر لایه از وضعیت اقلام آن محاسبه می‌شود (پذیرفته‌شده = ۱۰۰، در جریان = ۵۰). لایهٔ «رابطه» مستقیم از دادهٔ زندهٔ روابط و فرصت‌های سامانه محاسبه می‌شود و قابل ثبت دستی نیست.')}{writable ? t(' برای به‌روزرسانی، روی وضعیت هر قلم کلیک کنید.') : ''}</div>
          <div className="readiness-layers">
            {readiness.layers.map((L: any) => (
              <SectionCard key={L.key} title={L.label} icon={<TrendingUp size={16} />}
                description={`${t('وزن')} ${faNum(L.weight)}٪ · ${t('معیار پذیرش')}: ${L.criterion}`}>
                <div className="layer-score-row">
                  <b>{faNum(L.score)}٪</b>
                  <div className="prog-bar season-bar"><div className={`prog-fill ${L.score < 50 ? 'bad' : ''}`} style={{ width: `${Math.min(100, L.score)}%` }} /></div>
                </div>
                <div className="layer-items">
                  {L.items.map((it: any) => (
                    <div key={it.key} className="layer-item">
                      {L.computed ? (
                        <>
                          <span className="t-primary">{it.label}</span>
                          <span className="t-muted">{t('از دادهٔ زنده')}: {faNum(it.percent)}٪</span>
                        </>
                      ) : (
                        <button className={`layer-status ${it.status} ${writable ? 'clickable' : ''}`} disabled={!writable || busy}
                          onClick={() => cycleReadinessItem(L.key, it)}
                          title={writable ? t('کلیک: تغییر وضعیت (شروع‌نشده → در جریان → پذیرفته‌شده)') : t('برای تغییر وضعیت به مجوز برنامه نیاز دارید')}>
                          <span className="t-primary">{it.label}</span>
                          <StatusBadge tone={ITEM_STATUS_TONE[it.status]}>{ITEM_STATUS_FA[it.status]}</StatusBadge>
                        </button>
                      )}
                      {it.evidence ? <span className="t-muted evi">{it.evidence}</span> : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>

          {/* ═══════════ F05 — رجیستری دارایی برند (پیوست ب سند) ═══════════ */}
          <SectionCard className="brand-assets" title={t('F05 — رجیستری دارایی برند')} icon={<Package size={17} />}
            description={t('هر دارایی برند — برندبوک، هویت بصری، تصویر مدیران، قالب ارائه، وب‌سایت و… — با نسخهٔ جاری، مالک، محل نگهداری، وضعیت و تاریخ بازبینی ثبت می‌شود.')}
            actions={writable ? <button className="srip-button primary" onClick={openAssetCreate}><Plus size={14} /> {t('ثبت دارایی برند')}</button> : undefined}>
            {assets ? (<>
              <div className="chip-row" style={{ margin: '0 0 10px' }}>
                <span className="chip neutral">{t('کل')}: {faNum(assets.stats.total)}</span>
                <span className="chip success">{t('فعال — نسخهٔ جاری')}: {faNum(assets.stats.active)}</span>
                <span className="chip warning">{t('در تدوین')}: {faNum(assets.stats.inProgress)}</span>
                <span className="chip danger">{t('بازبینی معوق')}: {faNum(assets.stats.overdue)}</span>
              </div>
              {assets.items.length ? (
                <div className="table-wrap"><table className="asset-table">
                  <thead><tr>
                    <th>{t('دارایی برند')}</th><th>{t('نسخهٔ جاری')}</th><th>{t('مالک')}</th>
                    <th>{t('محل نگهداری')}</th><th>{t('وضعیت')}</th><th>{t('بازبینی بعدی')}</th>
                  </tr></thead>
                  <tbody>
                    {assets.items.map((a: any) => (
                      <tr key={a.id} className={`row-click ${a.overdue ? 'asset-due' : ''}`} onClick={() => writable && openAssetEdit(a)}
                        title={writable ? t('کلیک: ویرایش دارایی یا ثبت بازبینی') : t('برای ویرایش به مجوز برنامه نیاز دارید')}>
                        <td className="t-primary">{a.name}</td>
                        <td><span className="asset-ver">{t('نسخه')} {faNum(a.version)}</span></td>
                        <td>{a.ownerRole}</td>
                        <td className="t-muted">{a.location}</td>
                        <td><StatusBadge tone={ASSET_STATUS_TONE[a.status]}>{ASSET_STATUS_FA[a.status]}</StatusBadge></td>
                        <td>{a.overdue ? <span className="chip danger">{t('بازبینی معوق')}</span>
                          : a.reviewAt ? <span className="t-muted">{faDate(a.reviewAt)}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <EmptyV4 icon={<Package size={22} />} title={t('هنوز دارایی برندی ثبت نشده است')}
                  description={t('رجیستری دارایی با نسخه، مالک، محل نگهداری و تاریخ بازبینی — از «ثبت دارایی برند» آغاز کنید.')} />
              )}
              <p className="field-hint">{t('هر دارایی برند با نسخهٔ جاری، مالک، محل نگهداری، وضعیت و تاریخ بازبینی ثبت می‌شود (F05 / پیوست ب)؛ دارایی بدون مالک ثبت نمی‌شود و بازبینی دوره‌ای هر فصل (۹۰ روز) روی آن مهر می‌شود.')}</p>
            </>) : <Loading />}
          </SectionCard>
        </>
      )}

      {/* ═══════════ تب ممیزی — سه‌گانهٔ بخش ۲۰/۲۱ سند ═══════════ */}
      {tab === 'audit' && audits && (
        <>
          <div className="note-strip">{t('ممیزی، ارزیابی صادقانه از وضعیت موجود است — نه ارزیابی عملکرد اشخاص. خروجی آن، ورودی مستقیم بازسازی نقش‌ها و برنامهٔ انتقال داده و جایگزینی سامانه‌ها و کانال‌هاست.')}</div>
          <SectionCard title={t('ممیزی سه‌گانه')} icon={<ClipboardList size={17} />}
            description={t('برای جزئیات کامل هر قلم، روی ردیف کلیک کنید.')}>
            <Segmented options={AUDIT_TABS.map(([v, l]) => ({ value: v, label: l }))} value={auditTab} onChange={setAuditTab}
              counts={{ people: audits.people.length, systems: audits.systems.length, channels: audits.channels.length } as any} />
            <div className="chip-row" style={{ margin: '10px 0' }}>
              {auditTab === 'people' && <>
                <span className="chip neutral">{t('کل')}: {faNum(audits.summary.peopleTotal)}</span>
                <span className="chip info">{t('حفظ')}: {faNum(audits.summary.peopleKeep)}</span>
                <span className="chip warning">{t('بازتعریف')}: {faNum(audits.summary.peopleRedefine)}</span>
                <span className="chip success">{t('جذب')}: {faNum(audits.summary.peopleHire)}</span>
              </>}
              {auditTab === 'systems' && <>
                <span className="chip neutral">{t('کل')}: {faNum(audits.summary.systemsTotal)}</span>
                <span className="chip info">{t('نگهداری')}: {faNum(audits.summary.systemsKeep)}</span>
                <span className="chip warning">{t('انتقال')}: {faNum(audits.summary.systemsMigrate)}</span>
                <span className="chip danger">{t('خاموش‌سازی')}: {faNum(audits.summary.systemsShutdown)}</span>
                <span className="chip success">{t('تکمیل‌شده')}: {faNum(audits.summary.migrationDone)} {t('از')} {faNum(audits.summary.migrationTotal)}</span>
              </>}
              {auditTab === 'channels' && <>
                <span className="chip neutral">{t('کل')}: {faNum(audits.summary.channelsTotal)}</span>
                <span className="chip danger">{t('بی‌مالک')}: {faNum(audits.summary.channelsOrphan)}</span>
                <span className="chip warning">{t('کانال بی‌مالک یا رهاشده، یا به مالک مشخص واگذار یا خاموش می‌شود.')}</span>
              </>}
            </div>
            {auditTab === 'people' && (audits.people.length ? (
              <div className="table-wrap"><table>
                <thead><tr><th>{t('نقش')}</th><th>{t('شرح واقعی وظایف')}</th><th>{t('مدیر مستقیم')}</th><th>{t('ریسک وابستگی')}</th><th>{t('اولویت')}</th></tr></thead>
                <tbody>{audits.people.map((r: any) => (
                  <tr key={r.id} className="row-click" onClick={() => setAuditDetail({ kind: 'people', row: r })}>
                    <td className="t-primary">{r.role}</td><td>{r.duties}</td><td>{r.manager}</td>
                    <td><StatusBadge tone={LEVEL_TONE[r.dependencyRisk] ?? 'neutral'}>{LEVEL_FA[r.dependencyRisk] ?? '—'}</StatusBadge></td>
                    <td><StatusBadge tone={r.priority === 'KEEP' ? 'success' : r.priority === 'REDEFINE' ? 'warning' : 'info'}>{PRIORITY_FA[r.priority]}</StatusBadge></td>
                  </tr>))}</tbody>
              </table></div>
            ) : <EmptyV4 icon={<ClipboardList size={22} />} title={t('ممیزی افراد ثبت نشده است')} description={t('ممیزی در ماه نخست برنامه آغاز می‌شود تا هیچ تصمیم ساختاری بدون دادهٔ ممیزی گرفته نشود.')} />)}
            {auditTab === 'systems' && (audits.systems.length ? (
              <div className="table-wrap"><table>
                <thead><tr><th>{t('سامانه')}</th><th>{t('مالک فعلی')}</th><th>{t('حساسیت داده')}</th><th>{t('وضعیت در برنامهٔ انتقال')}</th><th>{t('F11 — مراحل انتقال')}</th><th>{t('پیشرفت')}</th></tr></thead>
                <tbody>{audits.systems.map((r: any) => (
                  <tr key={r.id} className="row-click" onClick={() => setAuditDetail({ kind: 'systems', row: r })}>
                    <td className="t-primary">{r.name}</td><td>{r.owner}</td>
                    <td>{r.sensitivity === 'CONFIDENTIAL' ? t('حساس') : r.sensitivity === 'MIXED' ? t('مختلط') : r.sensitivity === 'INTERNAL' ? t('داخلی') : t('عمومی')}</td>
                    <td><StatusBadge tone={MIGRATION_TONE[r.migration]}>{MIGRATION_FA[r.migration]}</StatusBadge></td>
                    <td>{r.migration === 'KEEP' ? '—' : (
                      <span className={`chip ${r.steps?.complete ? 'success' : (r.steps?.done ?? 0) > 0 ? 'warning' : 'neutral'}`}>
                        {faNum(r.steps?.done ?? 0)} / {faNum(r.steps?.total ?? 10)}
                      </span>
                    )}</td>
                    <td>{r.migration === 'KEEP' ? '—' : r.migrationStatus === 'DONE' ? <StatusBadge tone="success">{t('انجام شد')}</StatusBadge>
                      : r.migrationStatus === 'IN_PROGRESS' ? <StatusBadge tone="warning">{t('در جریان')}</StatusBadge>
                        : <StatusBadge tone="neutral">{t('شروع نشده')}</StatusBadge>}</td>
                  </tr>))}</tbody>
              </table></div>
            ) : <EmptyV4 icon={<ClipboardList size={22} />} title={t('ممیزی سامانه‌ها ثبت نشده است')} description={t('همهٔ ابزارهای فعال — از صفحات گسترده تا گروه‌های پیام‌رسان — فهرست و تعیین تکلیف می‌شوند.')} />)}
            {auditTab === 'channels' && (audits.channels.length ? (
              <div className="table-wrap"><table>
                <thead><tr><th>{t('کانال')}</th><th>{t('نشانی')}</th><th>{t('مالک')}</th><th>{t('آخرین فعالیت')}</th><th>{t('اقدام پیشنهادی')}</th></tr></thead>
                <tbody>{audits.channels.map((r: any) => (
                  <tr key={r.id} className="row-click" onClick={() => setAuditDetail({ kind: 'channels', row: r })}>
                    <td className="t-primary">{r.name}</td><td className="t-muted">{r.address}</td><td>{r.owner}</td>
                    <td>{r.lastActivity}</td>
                    <td><StatusBadge tone={r.action === 'SHUTDOWN' ? 'danger' : r.action === 'TRANSFER' ? 'warning' : 'info'}>{CHANNEL_ACTION_FA[r.action]}</StatusBadge></td>
                  </tr>))}</tbody>
              </table></div>
            ) : <EmptyV4 icon={<ClipboardList size={22} />} title={t('ممیزی کانال‌ها ثبت نشده است')} description={t('تمام کانال‌های ارتباطی فعال — وب‌سایت‌ها، شبکه‌های اجتماعی و خبرنامه‌ها — بررسی می‌شوند.')} />)}
          </SectionCard>

          {/* ═══════════ گام ۵.۳ — چارت هدف تیم (بخش ۲۱.۳ سند v6) ═══════════ */}
          {(audits.chart ?? []).length > 0 && (
            <SectionCard className="team-chart" title={t('چارت هدف تیم (v6)')} icon={<Users size={17} />}
              description={t('عنوان نقش‌ها، لایه، زمان ورود ماه هدف و تعداد نفرات — نقش‌های هوش مصنوعی برجسته شده‌اند.')}>
              <div className="chip-row" style={{ margin: '0 0 10px' }}>
                <span className="chip neutral">{t('عنوان نقش')}: {faNum(audits.chart.length)}</span>
                <span className="chip info">{t('جمع نفرات')}: {faNum(audits.chart.reduce((s: number, r: any) => s + (r.count ?? 1), 0))}</span>
                <span className="chip success">{t('نقش هوش مصنوعی')}: {faNum(audits.chart.filter((r: any) => r.ai).length)}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t('لایه')}</th><th>{t('عنوان نقش')}</th><th>{t('زمان ورود')}</th><th>{t('تعداد')}</th></tr></thead>
                  <tbody>
                    {audits.chart.map((r: any, idx: number) => (
                      <tr key={r.title}>
                        <td className="t-muted">{idx === 0 || audits.chart[idx - 1].layer !== r.layer ? t(r.layer) : ''}</td>
                        <td className="t-primary">{t(r.title)}{r.ai ? <span className="chip purple" style={{ marginInlineStart: 6 }}>AI</span> : null}</td>
                        <td>{t('ماه')} {faNum(r.entryMonth)}</td>
                        <td>{faNum(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="field-hint">{audits.chartRule ?? t('زمان ورود، ماه هدف برای فعال‌شدن نقش است و آغاز جذب می‌تواند زودتر انجام شود.')}</p>
            </SectionCard>
          )}
        </>
      )}

      {/* ═══════════ تب اهداف راهبردی — هر سازمان هدف خود را با مؤلفه‌ها و پایش تعریف می‌کند ═══════════ */}
      {tab === 'goals' && goals && (
        <>
          {!goals.items.length ? (
            <EmptyV4 icon={<Target size={30} />} title={t('هنوز هدف راهبردی ثبت نشده است')}
              description={t('هدف راهبردی سازمان خود را با مؤلفه‌های سنجش‌پذیر و مایلستون‌های زمانی ثبت کنید؛ مقدار هر مؤلفه از نتیجهٔ پایش به دست می‌آید.')}
              action={writable ? <button className="srip-button primary" onClick={openGoalCreate}><Plus size={14} /> {t('ثبت هدف')}</button> : undefined} />
          ) : (() => {
            const g = goals.items[Math.min(goalIdx, goals.items.length - 1)];
            return (
              <>
                {goals.items.length > 1 ? (
                  <Segmented options={goals.items.map((x: any, i: number) => ({ value: String(i), label: x.title }))} value={String(goalIdx)} onChange={(v: string) => setGoalIdx(Number(v))} />
                ) : null}
                <div className="stat-grid">
                  <StatCard icon={<Gauge size={18} />} iconClass="ic-blue" label={t('نمرهٔ مرکب هدف (پیشرفت تا مایلستون آخر)')}
                    value={`${faNum(g.composite ?? 0)}٪`} sub={t('میانگین درصد پیشرفت مؤلفه‌ها نسبت به هدف پایان دوره')} />
                  <StatCard icon={<ListChecks size={18} />} iconClass="ic-teal" label={t('مؤلفه‌های سنجش‌پذیر')}
                    value={faNum(g.components.length)} sub={t('هر مؤلفه روش سنجش و اهداف ماه ۶ و ۱۲ دارد')} />
                  <StatCard icon={<ClipboardList size={18} />} iconClass="ic-gold" label={t('پرامپت‌های پایش')}
                    value={faNum(g.promptCount)} sub={t('پایش ماهانه دیده‌شدگی در پاسخ سامانه‌های هوش مصنوعی')} />
                  <StatCard icon={<Activity size={18} />} iconClass="ic-red" label={t('رکوردهای پایش')}
                    value={faNum((g.monitoring ?? []).length)} sub={t('سامانه، ارجاع، دقت بازنمایی و اقدام اصلاحی')} />
                </div>
                <div className="note-strip"><Target size={15} /><span>{g.description} {goals.rule ?? ''}</span></div>

                <SectionCard title={t('مؤلفه‌های هدف')} icon={<ListChecks size={17} />}
                  description={`${t('مالک')}: ${g.owner}`}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th><th>{t('مؤلفه')}</th><th>{t('روش سنجش')}</th>
                          <th>{t('هدف ماه ۶')}</th><th>{t('هدف ماه ۱۲')}</th><th>{t('مقدار جاری')}</th><th>{t('پیشرفت تا هدف')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.components.map((c: any) => (
                          <tr key={c.id}>
                            <td>{faNum(c.order)}</td>
                            <td><div className="t-primary">{c.title}</div></td>
                            <td className="t-muted" style={{ fontSize: 11 }}>{c.method}</td>
                            <td>{faNum(c.target6)}{c.unit === 'percent' ? '٪' : ''}</td>
                            <td>{faNum(c.target12)}{c.unit === 'percent' ? '٪' : ''}</td>
                            <td>{writable ? (
                              <button type="button" className="srip-button" style={{ padding: '3px 10px' }}
                                onClick={() => { setCompEdit(c); setCompValue(String(c.value)); }}>
                                {faNum(c.value)}{c.unit === 'percent' ? '٪' : ''} ✎
                              </button>
                            ) : <b>{faNum(c.value)}{c.unit === 'percent' ? '٪' : ''}</b>}</td>
                            <td>
                              <div style={{ minWidth: 90 }}>
                                <b>{faNum(c.percent12)}٪</b>
                                <div className="prog-bar season-bar"><div className={`prog-fill ${c.percent6 >= 100 ? '' : 'warn'}`} style={{ width: `${Math.min(100, c.percent12)}%` }} /></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                <div className="two-col-grid">
                  <SectionCard title={t('پرامپت‌های پایش')} icon={<ClipboardList size={17} />}
                    description={t('هر ماه همهٔ پرسش‌ها در سامانه‌های هوش مصنوعی پرسیده و نتیجه ثبت می‌شود.')}>
                    <div className="prompt-cats">
                      {(g.prompts ?? []).map((cat: any) => (
                        <div key={cat.id} className="prompt-cat">
                          <div className="prompt-cat-head">
                            <b>{cat.category}</b>
                            <span className="chip">{faNum(cat.questions.length)}</span>
                          </div>
                          <ol className="prompt-list">
                            {cat.questions.map((q: string) => <li key={q}>{q}</li>)}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title={t('جدول پایش ماهانهٔ مرجعیت (F14)')} icon={<Activity size={17} />}
                    description={t('نتیجهٔ هر پایش با اقدام اصلاحی ثبت می‌شود.')}
                    actions={writable ? (
                      <button className="srip-button primary" onClick={() => { setMonOpen(true); setMonError(''); }}><Plus size={14} /> {t('ثبت پایش')}</button>
                    ) : undefined}>
                    {(g.monitoring ?? []).length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>{t('سامانه')}</th><th>{t('تاریخ')}</th><th>{t('ارجاع به ما')}</th><th>{t('دقت بازنمایی')}</th><th>{t('منبع احتمالی پاسخ')}</th><th>{t('اقدام اصلاحی')}</th></tr>
                          </thead>
                          <tbody>
                            {g.monitoring.map((m: any) => (
                              <tr key={m.id}>
                                <td><div className="t-primary">{m.system}</div></td>
                                <td>{faDate(m.checkedAt)}</td>
                                <td><b>{faNum(m.referralRate)}٪</b></td>
                                <td><b>{faNum(m.accuracy)}٪</b></td>
                                <td className="t-muted" style={{ fontSize: 11 }}>{m.probableSource || '—'}</td>
                                <td className="t-muted" style={{ fontSize: 11 }}>{m.action || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <EmptyV4 icon={<Activity size={26} />} title={t('هنوز پایشی ثبت نشده است')} />}
                  </SectionCard>
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ═══════════ مودال: جزئیات ریسک ═══════════ */}
      <Modal open={!!riskDetail} title={riskDetail?.title ?? ''} onClose={() => setRiskDetail(null)}
        description={`${t('احتمال')}: ${riskDetail ? LEVEL_FA[riskDetail.probability] : ''} · ${t('اثر')}: ${riskDetail ? LEVEL_FA[riskDetail.impact] : ''} · ${t('مالک')}: ${riskDetail?.ownerRole ?? ''}`}
        footer={writable && riskDetail && riskDetail.status !== 'CLOSED' ? (
          <button className="srip-button" disabled={busy} onClick={() => setRiskStatus(riskDetail.id, 'CLOSED')}><CheckCircle2 size={14} /> {t('بستن ریسک')}</button>
        ) : null}>
        {riskDetail && (
          <div className="detail-grid">
            <div><b>{t('پاسخ پیشگیرانه')}</b><p>{riskDetail.preventive || '—'}</p></div>
            <div><b>{t('پاسخ واکنشی')}</b><p>{riskDetail.reactive || '—'}</p></div>
            <div><b>{t('وضعیت')}</b><p><StatusBadge tone={RISK_STATUS_TONE[riskDetail.status]}>{RISK_STATUS_FA[riskDetail.status]}</StatusBadge></p></div>
            <div><b>{t('تاریخ بازبینی بعدی')}</b><p>{faDate(riskDetail.reviewAt)}</p></div>
            {riskDetail.notes ? <div><b>{t('یادداشت')}</b><p>{riskDetail.notes}</p></div> : null}
            {/* گام ۹.۲ — ستون‌های هشت‌گانهٔ AI (F17) */}
            {riskDetail.kind === 'AI' && riskDetail.ai && (
              <div style={{ gridColumn: '1 / -1' }}>
                <b>{t('ستون‌های AI (F17)')}</b>
                <div className="detail-grid" style={{ marginTop: 6 }}>
                  <div><b>{t('مورد استفاده')}</b><p>{AI_USECASE_FA[riskDetail.ai.useCase] ?? riskDetail.ai.useCase ?? '—'}</p></div>
                  <div><b>{t('آزمون')}</b><p>{riskDetail.ai.testRun || '—'}</p></div>
                  <div><b>{t('یافته')}</b><p>{riskDetail.ai.finding || '—'}</p></div>
                  <div><b>{t('نسخه')}</b><p dir="ltr" style={{ textAlign: 'start' }}>{riskDetail.ai.version || '—'}</p></div>
                  <div><b>{t('محدودیت')}</b><p>{riskDetail.ai.limitation || '—'}</p></div>
                  <div><b>{t('بازبینی')}</b><p>{riskDetail.ai.review || '—'}</p></div>
                  <div><b>{t('تصمیم انتشار')}</b>
                    <p><select value={riskDetail.ai.releaseDecision || ''} disabled={!writable}
                      onChange={e => setRiskDetail((d: any) => ({ ...d, ai: { ...d.ai, releaseDecision: e.target.value } }))}>
                      <option value="">—</option>
                      {Object.entries(AI_DECISION_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select></p></div>
                  <div><b>{t('توقف')}</b>
                    <p><label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!riskDetail.ai.stopped} disabled={!writable}
                        onChange={e => setRiskDetail((d: any) => ({ ...d, ai: { ...d.ai, stopped: e.target.checked } }))} />
                      {riskDetail.ai.stopped ? t('کاربرد متوقف شده است') : t('فعال')}
                    </label></p></div>
                </div>
                {writable && (
                  <button className="srip-button primary" style={{ marginTop: 8 }} disabled={busy} onClick={saveRiskAi}>
                    {busy ? t('در حال ذخیره…') : t('ذخیرهٔ ستون‌های AI')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══════════ مودال: ریسک جدید (F17) ═══════════ */}
      <Modal open={createOpen} title={t('ثبت ریسک جدید')} onClose={() => setCreateOpen(false)}
        description={t('ریسک بدون مالک ثبت نمی‌شود — مالک یکی از نقش‌های چارت برنامه است.')}
        footer={<>
          <button className="srip-button" onClick={() => setCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="risk-create-form" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت ریسک')}</button>
        </>}>
        <form id="risk-create-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submitRisk(); }}>
          <label className="field">
            <span>{t('عنوان ریسک')}</span>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required minLength={3} placeholder={t('مثلاً: تأخیر در تأیید برندبوک')} />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('احتمال')}</span>
              <select value={form.probability} onChange={(e) => setForm(f => ({ ...f, probability: e.target.value }))}>
                {Object.entries(LEVEL_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t('اثر')}</span>
              <select value={form.impact} onChange={(e) => setForm(f => ({ ...f, impact: e.target.value }))}>
                {Object.entries(LEVEL_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>{t('مالک ریسک')} *</span>
            {(risks?.roles ?? []).length ? (
              <select value={form.ownerRole} onChange={(e) => setForm(f => ({ ...f, ownerRole: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {(risks?.roles ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input value={form.ownerRole} onChange={(e) => setForm(f => ({ ...f, ownerRole: e.target.value }))} required
                placeholder={t('نقش مالک — چارت سازمان در تنظیمات برنامه تعریف نشده')} />
            )}
          </label>
          <label className="field">
            <span>{t('پاسخ پیشگیرانه')}</span>
            <input value={form.preventive} onChange={(e) => setForm(f => ({ ...f, preventive: e.target.value }))} placeholder={t('برای جلوگیری از وقوع…')} />
          </label>
          <label className="field">
            <span>{t('پاسخ واکنشی')}</span>
            <input value={form.reactive} onChange={(e) => setForm(f => ({ ...f, reactive: e.target.value }))} placeholder={t('اگر رخ داد…')} />
          </label>
          {formError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{formError}</span></div> : null}
        
          {/* گام ۹.۲ — F17: ریسک AI (اختیاری) */}
          <label className="field">
            <span>{t('کاربرد AI (اختیاری — ریسک را به کاربرد ۱۹.۲ وصل می‌کند)')}</span>
            <select value={(form as any).aiUseCase ?? ''} onChange={(e) => setForm(f => ({ ...f, aiUseCase: e.target.value } as any))}>
              <option value="">{t('— بدون کاربرد AI —')}</option>
              {Object.entries(AI_USECASE_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {(form as any).aiUseCase ? (
            <label className="field">
              <span>{t('یافتهٔ اولیه')}</span>
              <input value={(form as any).aiFinding ?? ''} onChange={(e) => setForm(f => ({ ...f, aiFinding: e.target.value } as any))} placeholder={t('چه چیزی در آزمون دیده شد؟')} />
            </label>
          ) : null}
        </form>
      </Modal>

      {/* ═══════════ مودال: ثبت هدف راهبردی ═══════════ */}
      <Modal open={goalCreateOpen} title={t('ثبت هدف راهبردی')} onClose={() => setGoalCreateOpen(false)}
        description={t('هدف را با مؤلفه‌های سنجش‌پذیر ثبت کنید؛ مقدار هر مؤلفه از نتیجهٔ پایش به دست می‌آید، نه ورود دستی.')}>
        <form id="goal-create-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submitGoal(); }}>
          <label className="field">
            <span>{t('عنوان هدف')} *</span>
            <input value={goalForm.title} onChange={(e) => setGoalForm(f => ({ ...f, title: e.target.value }))} required minLength={3} />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('مالک')} *</span>
              <input value={goalForm.owner} onChange={(e) => setGoalForm(f => ({ ...f, owner: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t('توصیف هدف')}</span>
              <input value={goalForm.description} onChange={(e) => setGoalForm(f => ({ ...f, description: e.target.value }))} />
            </label>
          </div>
          {goalComps.map((c: any, i: number) => (
            <div key={i} className="goal-comp-row">
              <div className="field-pair">
                <label className="field">
                  <span>{`${t('مؤلفه')} ${faNum(i + 1)} — ${t('عنوان')}`}</span>
                  <input value={c.title} onChange={(e) => setGoalComps((rows: any[]) => rows.map((r, j) => j === i ? { ...r, title: e.target.value } : r))} />
                </label>
                <label className="field">
                  <span>{t('روش سنجش')}</span>
                  <input value={c.method} onChange={(e) => setGoalComps((rows: any[]) => rows.map((r, j) => j === i ? { ...r, method: e.target.value } : r))} />
                </label>
              </div>
              <div className="field-pair">
                <label className="field">
                  <span>{t('هدف ماه ۶')}</span>
                  <input type="number" min={0} value={c.target6} onChange={(e) => setGoalComps((rows: any[]) => rows.map((r, j) => j === i ? { ...r, target6: e.target.value } : r))} />
                </label>
                <label className="field">
                  <span>{t('هدف ماه ۱۲')} *</span>
                  <input type="number" min={1} value={c.target12} onChange={(e) => setGoalComps((rows: any[]) => rows.map((r, j) => j === i ? { ...r, target12: e.target.value } : r))} />
                </label>
                <label className="field">
                  <span>{t('مقدار اولیه')}</span>
                  <input type="number" min={0} value={c.value} onChange={(e) => setGoalComps((rows: any[]) => rows.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                </label>
              </div>
            </div>
          ))}
          <button type="button" className="srip-button" onClick={() => setGoalComps((rows: any[]) => [...rows, { title: '', method: '', target6: '', target12: '', value: '', unit: 'count' }])}>
            <Plus size={14} /> {t('افزودن مؤلفه')}
          </button>
          {goalFormError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{goalFormError}</span></div> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="srip-button" onClick={() => setGoalCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت هدف')}</button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ مودال: ثبت نتیجهٔ پایش مؤلفه ═══════════ */}
      <Modal open={!!compEdit} title={compEdit?.title ?? ''} onClose={() => setCompEdit(null)}
        description={`${t('روش سنجش')}: ${compEdit?.method ?? ''}`}>
        <label className="field">
          <span>{t('مقدار پایش‌شده')}</span>
          <input type="number" min={0} value={compValue} onChange={(e) => setCompValue(e.target.value)} autoFocus />
        </label>
        <div className="note-strip"><Activity size={15} /><span>{t('مقدار مؤلفه از نتیجهٔ پایش ثبت می‌شود؛ نمرهٔ مرکب هدف خودکار بازمحاسبه می‌شود.')}</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="srip-button" onClick={() => setCompEdit(null)}><X size={14} /> {t('انصراف')}</button>
          <button type="button" className="srip-button primary" disabled={busy || compValue === ''} onClick={saveComponentValue}>{t('ذخیرهٔ مقدار')}</button>
        </div>
      </Modal>

      {/* ═══════════ مودال: ثبت پایش ماهانه ═══════════ */}
      <Modal open={monOpen} title={t('ثبت نتیجهٔ پایش')} onClose={() => setMonOpen(false)}
        description={t('نتیجهٔ پرسش پرامپت‌ها در یک سامانهٔ هوش مصنوعی را ثبت کنید.')}>
        <form id="monitoring-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submitMonitoring(); }}>
          <label className="field">
            <span>{t('نام سامانه')} *</span>
            <input value={monForm.system} onChange={(e) => setMonForm(f => ({ ...f, system: e.target.value }))} required />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('میزان ارجاع (٪)')} *</span>
              <input type="number" min={0} max={100} value={monForm.referralRate} onChange={(e) => setMonForm(f => ({ ...f, referralRate: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t('دقت بازنمایی (٪)')} *</span>
              <input type="number" min={0} max={100} value={monForm.accuracy} onChange={(e) => setMonForm(f => ({ ...f, accuracy: e.target.value }))} required />
            </label>
          </div>
          <label className="field">
            <span>{t('منبع احتمالی پاسخ')}</span>
            <input value={monForm.probableSource} onChange={(e) => setMonForm(f => ({ ...f, probableSource: e.target.value }))} />
          </label>
          <label className="field">
            <span>{t('اقدام اصلاحی')}</span>
            <input value={monForm.action} onChange={(e) => setMonForm(f => ({ ...f, action: e.target.value }))} />
          </label>
          {monError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{monError}</span></div> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="srip-button" onClick={() => setMonOpen(false)}><X size={14} /> {t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت پایش')}</button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ مودال: ثبت شاخص (ماژول شاخص‌ها) ═══════════ */}
      <Modal open={kpiCreateOpen} title={t('ثبت شاخص')} onClose={() => setKpiCreateOpen(false)}
        description={t('شاخص‌های برنامهٔ سازمان خود را با مالک، هدف و سنجهٔ محاسبه ثبت کنید؛ مقدار هر شاخص از دادهٔ زندهٔ سامانه محاسبه می‌شود.')}>
        <form id="kpi-create-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submitKpi(); }}>
          <label className="field">
            <span>{t('عنوان شاخص')} *</span>
            <input value={kpiForm.title} onChange={(e) => setKpiForm(f => ({ ...f, title: e.target.value }))} required minLength={3} />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('مالک')} *</span>
              <input value={kpiForm.owner} onChange={(e) => setKpiForm(f => ({ ...f, owner: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t('دسته')}</span>
              <input value={kpiForm.category} onChange={(e) => setKpiForm(f => ({ ...f, category: e.target.value }))} placeholder={t('عمومی')} />
            </label>
          </div>
          <div className="field-pair">
            <label className="field">
              <span>{t('دورهٔ سنجش')}</span>
              <input value={kpiForm.period} onChange={(e) => setKpiForm(f => ({ ...f, period: e.target.value }))} placeholder={t('ماهانه')} />
            </label>
            <label className="field">
              <span>{t('هدف عددی')} *</span>
              <input type="number" min={1} value={kpiForm.targetValue} onChange={(e) => setKpiForm(f => ({ ...f, targetValue: e.target.value }))} required />
            </label>
          </div>
          <label className="field">
            <span>{t('سنجهٔ محاسبه')} *</span>
            <select value={kpiForm.metric} onChange={(e) => setKpiForm(f => ({ ...f, metric: e.target.value }))} required>
              <option value="">{t('انتخاب کنید…')}</option>
              {metrics.map((m: any) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t('هدف')}</span>
            <input value={kpiForm.target} onChange={(e) => setKpiForm(f => ({ ...f, target: e.target.value }))} placeholder={t('توصیف کوتاه هدف')} />
          </label>
          {kpiFormError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{kpiFormError}</span></div> : null}
          <div className="modal-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
            <button type="button" className="srip-button" onClick={() => setKpiCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت شاخص')}</button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ مودال: جزئیات قلم ممیزی ═══════════ */}
      <Modal open={!!auditDetail} title={auditDetail?.kind === 'systems' ? auditDetail?.row?.name : auditDetail?.kind === 'channels' ? auditDetail?.row?.name : auditDetail?.row?.role ?? ''} onClose={() => setAuditDetail(null)}>
        {auditDetail && (
          <div className="detail-grid">
            {auditDetail.kind === 'people' && <>
              <div><b>{t('شرح واقعی وظایف')}</b><p>{auditDetail.row.duties}</p></div>
              <div><b>{t('مدیر مستقیم')}</b><p>{auditDetail.row.manager}</p></div>
              <div><b>{t('ظرفیت زمانی آزاد')}</b><p>{auditDetail.row.capacity === 'HIGH' ? t('زیاد') : auditDetail.row.capacity === 'MEDIUM' ? t('متوسط') : auditDetail.row.capacity === 'LOW' ? t('کم') : '—'}</p></div>
              <div><b>{t('برنامهٔ جانشین‌پروری')}</b><p>{auditDetail.row.successor}</p></div>
              <div><b>{t('اولویت حفظ یا بازتعریف')}</b><p>{PRIORITY_FA[auditDetail.row.priority]}</p></div>
              <div><b>{t('یادداشت ممیزی')}</b><p>{auditDetail.row.note}</p></div>
            </>}
            {auditDetail.kind === 'systems' && <>
              <div><b>{t('مالک و مسئول فعلی')}</b><p>{auditDetail.row.owner}</p></div>
              <div><b>{t('داده‌های نگهداری‌شده و حجم')}</b><p>{auditDetail.row.data}</p></div>
              <div><b>{t('نسخهٔ پشتیبان')}</b><p>{auditDetail.row.backup}</p></div>
              <div><b>{t('هم‌پوشانی با سایر ابزارها')}</b><p>{auditDetail.row.overlap}</p></div>
              <div><b>{t('وضعیت در برنامهٔ انتقال')}</b><p><StatusBadge tone={MIGRATION_TONE[auditDetail.row.migration]}>{MIGRATION_FA[auditDetail.row.migration]}</StatusBadge></p></div>
              <div><b>{t('یادداشت ممیزی')}</b><p>{auditDetail.row.note}</p></div>
            </>}
            {auditDetail.kind === 'systems' && auditDetail.row.migration !== 'KEEP' && (auditDetail.row.steps?.total ?? 0) > 0 && (
              <div className="mig-steps">
                <div className="mig-steps-head">
                  <b>{t('F11 — کنترل ده‌مرحله‌ای انتقال سامانه (بخش ۲۱ سند)')}</b>
                  <span className={`chip ${auditDetail.row.steps.complete ? 'success' : 'warning'}`}>
                    {t('پیشرفت')}: {faNum(auditDetail.row.steps.done)} {t('از')} {faNum(auditDetail.row.steps.total)}
                  </span>
                </div>
                <ol className="mig-steps-list">
                  {auditDetail.row.steps.steps.map((st: any) => (
                    <li key={st.key} className={`mig-step ${st.done ? 'done' : ''} ${st.key === auditDetail.row.steps.currentKey ? 'current' : ''}`}>
                      <span className="mig-step-order">{faNum(st.order)}</span>
                      <span className="mig-step-title">{t(st.title)}</span>
                      {st.done ? <CheckCircle2 size={14} /> : st.key === auditDetail.row.steps.currentKey && writable ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => completeMigrationStep(auditDetail.row.id, st.key)}>{t('تکمیل مرحله')}</button>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className="field-hint">{auditDetail.row.steps.complete
                  ? t('هر ده مرحله تکمیل شده و سامانه در وضعیت «تکمیل‌شده» ثبت شده است.')
                  : t('مراحل ترتیبی‌اند؛ سامانه فقط با اتمام هر ده مرحله «تکمیل‌شده» می‌شود — مرحلهٔ دهم خودش ثبت تکمیل انتقال است.')}</p>
              </div>
            )}
            {auditDetail.kind === 'channels' && <>
              <div><b>{t('نشانی')}</b><p>{auditDetail.row.address}</p></div>
              <div><b>{t('مالک و مدیر دسترسی')}</b><p>{auditDetail.row.owner}</p></div>
              <div><b>{t('آخرین فعالیت')}</b><p>{auditDetail.row.lastActivity}</p></div>
              <div><b>{t('انطباق با هویت بصری')}</b><p>{auditDetail.row.brand}</p></div>
              <div><b>{t('اقدام پیشنهادی')}</b><p><StatusBadge tone={auditDetail.row.action === 'SHUTDOWN' ? 'danger' : 'warning'}>{CHANNEL_ACTION_FA[auditDetail.row.action]}</StatusBadge></p></div>
              <div><b>{t('یادداشت ممیزی')}</b><p>{auditDetail.row.note}</p></div>
            </>}
          </div>
        )}
      </Modal>
      {/* ═══════════ مودال: ثبت درخواست هزینه (ماژول پلتفرمی) ═══════════ */}
      <Modal open={expCreateOpen} title={t('ثبت درخواست هزینه (تأیید هزینه)')}
        onClose={() => setExpCreateOpen(false)}
        description={t('درخواست بدون درخواست‌کننده ثبت نمی‌شود؛ پس از ثبت، مدیر مالی تصویب می‌کند و تعهد فقط پس از تصویب قابل ثبت است.')}
        footer={<>
          <button className="srip-button" onClick={() => setExpCreateOpen(false)}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="expense-form" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت درخواست')}</button>
        </>}>
        <form id="expense-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submitExpense(); }}>
          <label className="field">
            <span>{t('شرح هزینه')} *</span>
            <input value={expForm.title} onChange={(e) => setExpForm(f => ({ ...f, title: e.target.value }))} required minLength={3}
              placeholder={t('مثلاً: میزگرد داده و سیاست عمومی — بخش اجرایی')} />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('مبلغ (تومان)')} *</span>
              <input type="number" min={1} step="any" value={expForm.amount} onChange={(e) => setExpForm(f => ({ ...f, amount: e.target.value }))} required
                placeholder={t('مثلاً: ۲۵۰۰۰۰۰۰۰')} />
            </label>
            <label className="field">
              <span>{t('دستهٔ هزینه')} *</span>
              <input value={expForm.category} onChange={(e) => setExpForm(f => ({ ...f, category: e.target.value }))} required
                placeholder={t('مثلاً: رویداد، تولید محتوا، پژوهش')} />
            </label>
          </div>
          <label className="field">
            <span>{t('درخواست‌کننده')} *</span>
            {(expenses?.roles ?? []).length ? (
              <select value={expForm.requesterRole} onChange={(e) => setExpForm(f => ({ ...f, requesterRole: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {(expenses?.roles ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input value={expForm.requesterRole} onChange={(e) => setExpForm(f => ({ ...f, requesterRole: e.target.value }))} required
                placeholder={t('نقش درخواست‌کننده — چارت سازمان در تنظیمات برنامه تعریف نشده')} />
            )}
          </label>
          {expFormError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{expFormError}</span></div> : null}
        </form>
      </Modal>

      {/* ═══════════ مودال: ثبت/ویرایش دارایی برند (F05 / پیوست ب) ═══════════ */}
      <Modal open={assetCreateOpen || !!assetEdit}
        title={assetEdit ? t('ویرایش دارایی برند') : t('ثبت دارایی برند (F05)')}
        onClose={() => { setAssetCreateOpen(false); setAssetEdit(null); }}
        description={t('دارایی بدون مالک ثبت نمی‌شود — مالک یکی از نقش‌های چارت سازمان است و بازبینی دوره‌ای هر فصل (۹۰ روز) روی رجیستری مهر می‌شود.')}
        footer={<>
          {assetEdit ? <button type="button" className="srip-button" disabled={busy} onClick={reviewAsset}><RefreshCw size={14} /> {t('ثبت بازبینی انجام‌شده (۹۰ روز)')}</button> : null}
          <button className="srip-button" onClick={() => { setAssetCreateOpen(false); setAssetEdit(null); }}><X size={14} /> {t('انصراف')}</button>
          <button type="submit" form="asset-form" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت دارایی')}</button>
        </>}>
        <form id="asset-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submitAsset(); }}>
          <label className="field">
            <span>{t('عنوان دارایی')} *</span>
            <input value={assetForm.name} onChange={(e) => setAssetForm(f => ({ ...f, name: e.target.value }))} required minLength={3}
              placeholder={t('مثلاً: برندبوک و راهنمای هویت بصری')} />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('نسخهٔ جاری')} *</span>
              <input value={assetForm.version} onChange={(e) => setAssetForm(f => ({ ...f, version: e.target.value }))} required
                placeholder={t('مثلاً: ۲٫۱')} />
            </label>
            <label className="field">
              <span>{t('وضعیت')} *</span>
              <select value={assetForm.status} onChange={(e) => setAssetForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(ASSET_STATUS_FA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>{t('مالک دارایی')} *</span>
            {(assets?.roles ?? []).length ? (
              <select value={assetForm.ownerRole} onChange={(e) => setAssetForm(f => ({ ...f, ownerRole: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {(assets?.roles ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input value={assetForm.ownerRole} onChange={(e) => setAssetForm(f => ({ ...f, ownerRole: e.target.value }))} required
                placeholder={t('نقش مالک — چارت سازمان در تنظیمات برنامه تعریف نشده')} />
            )}
          </label>
          <div className="field-pair">
            <label className="field">
              <span>{t('محل نگهداری')} *</span>
              <input value={assetForm.location} onChange={(e) => setAssetForm(f => ({ ...f, location: e.target.value }))} required
                placeholder={t('مثلاً: مرکز دانش › پوشهٔ برند')} />
            </label>
            <label className="field">
              <span>{t('تاریخ بازبینی بعدی (میلادی)')}</span>
              <input value={assetForm.reviewAt} onChange={(e) => setAssetForm(f => ({ ...f, reviewAt: e.target.value }))}
                placeholder="YYYY-MM-DD" />
            </label>
          </div>
          {assetEdit?.lastReviewedAt ? (
            <p className="field-hint">{t('آخرین بازبینی')}: {faDate(assetEdit.lastReviewedAt)}</p>
          ) : null}
          {assetFormError ? <div className="alert-banner danger" role="alert"><AlertTriangle size={16} /><span>{assetFormError}</span></div> : null}
        </form>
      </Modal>
    </main>
  );
}
