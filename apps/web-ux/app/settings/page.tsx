'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader } from '../_components/page-ui';
import { ThemeControl } from '../_components/preferences';
import {
  AlertTriangle, BadgeCheck, Building2, CheckCircle2, Copy, Fingerprint, KeyRound, Link2, Lock, Mail,
  Monitor, RefreshCw, Save, ScrollText, ShieldCheck, Smartphone, Timer, UserRound, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  تنظیمات کاربر — پروفایل از GET /auth/me واقعی + MFA واقعی           */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'مدیر کل سیستم', HOLDING_ADMIN: 'مدیر هلدینگ', HOLDING_EXECUTIVE: 'مدیر ارشد هلدینگ',
  SUBSIDIARY_ADMIN: 'مدیر شرکت', SUBSIDIARY_EXECUTIVE: 'مدیر ارشد شرکت', RELATIONSHIP_MANAGER: 'مدیر روابط',
  PROJECT_MANAGER: 'مدیر پروژه', ANALYST: 'تحلیلگر', STANDARD_USER: 'کاربر استاندارد', READ_ONLY: 'فقط خواندنی',
};
const GROUP_FA: Record<string, string> = {
  General: 'کلی', Core: 'هسته', Admin: 'مدیریت', Security: 'امنیت', DataGovernance: 'حاکمیت داده',
  Account: 'حساب‌ها', Knowledge: 'دانش', Intelligence: 'هوشمندی', Reporting: 'گزارش‌ها', Sales: 'فروش',
};
const SCOPE_FA: Record<string, string> = {
  ALL: 'همهٔ محدوده', ORGANIZATION: 'سازمان', SUBSIDIARIES: 'زیرمجموعه‌ها', DEPARTMENT: 'دپارتمان',
  OWNED: 'تحت مالکیت', SHARED: 'اشتراکی', PRIVATE: 'خصوصی',
};

type Membership = { id: string; organizationId: string; organizationName?: string | null; role: string; department?: string | null; dataScope?: string | null; accessScope?: string | null; scope?: unknown; isPrimary?: boolean };
type Me = { id: string; email: string; name: string; isOwner: boolean; memberships: Membership[]; permissions: string[]; accessibleOrganizationIds: string[] };

const initialPrefs = { theme: 'system', locale: 'fa', timezone: 'Asia/Tehran', defaultScope: 'all' };

export default function Settings() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /* ---------------------- MFA state ---------------------- */
  const [mfaRequired, setMfaRequired] = useState<boolean | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'verify' | 'done'>('form');
  const [device, setDevice] = useState<{ deviceId?: string; secret?: string; otpauthUrl?: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [testOpen, setTestOpen] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [busy, setBusy] = useState('');
  const [mfaMsg, setMfaMsg] = useState('');

  /* ------------------- UI preferences ------------------- */
  const [prefs, setPrefs] = useState(initialPrefs);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError(''); setNotice('');
    try {
      const m = await api<Me>('/auth/me');
      setMe(m);
      const r = await api<{ required: boolean }>('/auth/mfa/required');
      setMfaRequired(!!r.required);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPrefs({
      theme: localStorage.getItem('srip_theme') ?? 'system',
      locale: localStorage.getItem('srip_locale') ?? 'fa',
      timezone: localStorage.getItem('srip_timezone') ?? 'Asia/Tehran',
      defaultScope: localStorage.getItem('srip_default_company') ?? localStorage.getItem('srip_default_scope') ?? 'all',
    });
  }, []);

  async function savePrefs() {
    try {
      localStorage.setItem('srip_theme', prefs.theme);
      localStorage.setItem('srip_locale', prefs.locale);
      localStorage.setItem('srip_timezone', prefs.timezone);
      localStorage.setItem('srip_default_company', prefs.defaultScope);
      document.documentElement.dataset.theme = prefs.theme;
      setNotice('ترجیحات رابط روی این مرورگر ذخیره شد.');
    } catch (x) { setError((x as Error).message); }
  }

  /* ---------------------- MFA actions ---------------------- */
  async function startEnroll(e: FormEvent) {
    e.preventDefault(); setBusy('enroll'); setError(''); setMfaMsg('');
    try {
      const d = await api<{ deviceId: string; secret: string; otpauthUrl: string }>('/auth/mfa/enroll', { method: 'POST', body: JSON.stringify({ label: 'SRIP Web' }) });
      setDevice(d); setStep('verify'); setCode('');
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function verifyEnroll(e: FormEvent) {
    e.preventDefault(); setBusy('verify-enroll'); setError(''); setMfaMsg('');
    try {
      if (!device?.deviceId) throw new Error('ابتدا دستگاه ساخته شود.');
      if (!/^\d{6}$/.test(code)) throw new Error('کد ۶ رقمی اپلیکشن احراز هویت را وارد کنید.');
      const out = await api<{ verified: boolean; recoveryCodes?: string[] }>('/auth/mfa/verify-enrollment', { method: 'POST', body: JSON.stringify({ deviceId: device.deviceId, code }) });
      setRecoveryCodes(out.recoveryCodes ?? []);
      setStep('done'); setMfaRequired(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function testMfa(e: FormEvent) {
    e.preventDefault(); setBusy('test'); setError(''); setMfaMsg('');
    try {
      if (!/^\d{6}$/.test(testCode)) throw new Error('کد ۶ رقمی وارد کنید.');
      const out = await api<{ verified: boolean }>('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code: testCode }) });
      if (!out.verified) throw new Error('کد نامعتبر است.');
      setMfaMsg('کد دومرحله‌ای معتبر است — تأیید با موفقیت انجام شد.');
      setTestCode(''); setTestOpen(false);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setMfaMsg('کدهای بازیابی کپی شدند — آن‌ها را در جای امن نگه دارید.');
    } catch (x) { setError((x as Error).message); }
  }
  async function copySecret() {
    try {
      if (device?.secret) await navigator.clipboard.writeText(device.secret);
      setMfaMsg('کلید مخفی کپی شد.');
    } catch (x) { setError((x as Error).message); }
  }

  const grouped = useMemo(() => {
    if (!me) return [];
    const out: Array<{ group: string; keys: string[] }> = [];
    for (const p of me.permissions) {
      if (p === '*') continue;
      const [g] = p.split('.');
      const row = out.find(r => r.group === g);
      if (row) row.keys.push(p); else out.push({ group: g, keys: [p] });
    }
    return out.sort((a, b) => String(a.group).localeCompare(String(b.group)));
  }, [me]);
  const isOwner = !!me?.isOwner;
  const role = me?.memberships?.find(m => m.isPrimary)?.role ?? me?.memberships?.[0]?.role;

  const busyOn = (k: string) => busy === k;
  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="حساب کاربری"
        title="تنظیمات کاربر"
        description="پروفایل، عضویت‌های سازمانی و نقش‌ها، امنیت حساب (احراز دومرحله‌ای)، مجوزهای شما و ترجیحات رابط کاربری — دادهٔ پروفایل از سرور (GET /auth/me) است."
        actions={
          <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
          </button>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}
      {mfaMsg && <div className="notice" role="status" style={{ borderColor: 'var(--green,#16a34a)', color: 'var(--green,#16a34a)' }}>{mfaMsg}</div>}

      {loading && !me ? <Loading label="در حال بارگذاری تنظیمات…" /> : (
        <>
          <div className="grid2" style={{ alignItems: 'stretch' }}>
            {/* ------------------- profile card ------------------- */}
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><UserRound size={16} /> پروفایل من</h2><p>شناسه و وضعیت حساب بر پایهٔ سرور.</p></div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ width: 62, height: 62, borderRadius: 18, display: 'grid', placeItems: 'center', flex: '0 0 auto', fontSize: 24, fontWeight: 900, background: 'linear-gradient(135deg, var(--srip-accent,#2563eb), var(--purple,#7c3aed))', color: '#fff' }}>
                  {(me?.name ?? '؟').trim().charAt(0)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 16 }}>{me?.name}</b>
                    {isOwner && <Badge tone="danger">مالک سامانه</Badge>}
                    {role && !isOwner && <Badge tone="info">{ROLE_LABELS[role] ?? role}</Badge>}
                  </span>
                  <span className="t-muted" style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11.5, marginTop: 3 }}><Mail size={11} /> <span dir="ltr">{me?.email}</span></span>
                  <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 3 }}>
                    <code dir="ltr">{me?.id}</code> · {fa((me?.accessibleOrganizationIds ?? []).length)} سازمان در دسترس
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                <Link className="secondary-action" style={{ padding: '7px 12px', minHeight: 0, fontSize: 11.5 }} href="/sessions"><Smartphone size={13} /> نشست‌ها و دستگاه‌ها</Link>
                <Link className="secondary-action" style={{ padding: '7px 12px', minHeight: 0, fontSize: 11.5 }} href="/privacy"><ShieldCheck size={13} /> حقوق داده</Link>
                <Link className="secondary-action" style={{ padding: '7px 12px', minHeight: 0, fontSize: 11.5 }} href="/security"><Lock size={13} /> امنیت</Link>
              </div>
            </section>

            {/* ------------------- memberships ------------------- */}
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Building2 size={16} /> عضویت‌های سازمانی</h2><p>نقش، دپارتمان و محدودهٔ هر عضویت.</p></div>
              </div>
              {!me?.memberships?.length ? <div className="empty-state">عضویتی ثبت نشده است.</div> : (
                <div className="list" style={{ display: 'grid', gap: 8 }}>
                  {me.memberships.map(m => (
                    <article className="listRow" key={m.id} style={{ alignItems: 'flex-start' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--blue,#2563eb) 12%, transparent)', color: 'var(--blue,#2563eb)' }}>
                        <Building2 size={15} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b>{m.organizationName ?? m.organizationId}</b>
                          <Badge tone={m.isPrimary ? 'success' : 'neutral'}>{m.isPrimary ? 'اصلی' : 'فرعی'}</Badge>
                        </span>
                        <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                          نقش: {ROLE_LABELS[m.role] ?? m.role}
                          {m.department ? ` · دپارتمان: ${m.department}` : ''}
                        </span>
                        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                          {m.dataScope && <Badge tone="info">داده: {SCOPE_FA[m.dataScope] ?? m.dataScope}</Badge>}
                          {m.accessScope && <Badge tone="warning">دسترسی: {SCOPE_FA[m.accessScope] ?? m.accessScope}</Badge>}
                          {typeof m.scope === 'string' && m.scope && <Badge tone="neutral">scope: {m.scope}</Badge>}
                        </span>
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            {/* ------------------- MFA card ------------------- */}
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Fingerprint size={16} /> امنیت حساب — تأیید دومرحله‌ای</h2><p>پارتی MfaService واقعی: دستگاه‌های تأییدشده، کدهای بازیابی یک‌بارمصرف.</p></div>
              </div>
              {mfaRequired === null ? <Loading label="بررسی وضعیت MFA…" /> : mfaRequired ? (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--green,#16a34a) 13%, transparent)', color: 'var(--green,#16a34a)' }}><ShieldCheck size={17} /></span>
                    <span>
                      <b style={{ display: 'block', fontSize: 12.5 }}>تأیید دومرحله‌ای فعال است</b>
                      <span className="t-muted" style={{ fontSize: 10.5 }}>ورود به حساب به کد اپلیکشن احراز هویت نیاز دارد؛ در صورت گم‌شدن دستگاه، از کدهای بازیابی استفاده کنید.</span>
                    </span>
                  </div>
                  <button className="secondary-action" style={{ padding: '8px 14px', minHeight: 0 }} onClick={() => { setTestOpen(true); setError(''); }}><KeyRound size={13} /> آزمون کد</button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--gold,#d97706) 13%, transparent)', color: 'var(--gold,#d97706)' }}><Lock size={17} /></span>
                    <span>
                      <b style={{ display: 'block', fontSize: 12.5 }}>تأیید دومرحله‌ای غیرفعال است</b>
                      <span className="t-muted" style={{ fontSize: 10.5 }}>فعال‌سازی برای محافظت از حساب در برابر ورود غیرمجاز توصیه می‌شود.</span>
                    </span>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '8px 14px', minHeight: 0 }} onClick={() => { setEnrollOpen(true); setStep('form'); setDevice(null); setCode(''); setMfaMsg(''); setError(''); }}><Smartphone size={13} /> فعال‌سازی</button>
                </>
              )}
              <p className="t-muted" style={{ margin: '12px 0 0', fontSize: 10.5 }}>
                <Timer size={11} style={{ verticalAlign: -2 }} /> هر تغییر دستگاه در ممیزی امنیتی با TOKEN_CHANGE ثبت می‌شود.
              </p>
            </section>

            {/* ------------------- permission chips ------------------- */}
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><BadgeCheck size={16} /> مجوزهای من</h2><p>برگرفته از نقش‌ها و عضویت‌های شما؛ مجموع {me?.permissions?.length ?? 0} مجوز.</p></div>
              </div>
              {!me?.permissions?.length ? <div className="empty-state">مجوزی ثبت نشده است.</div> : isOwner ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--red,#dc2626) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--red,#dc2626) 20%, transparent)' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--red,#dc2626)' }} />
                  <span style={{ fontSize: 12 }}><b>دسترسی کامل (مالک)</b> — همهٔ مجوزها بدون محدودیت، در همهٔ سازمان‌ها.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {grouped.map(g => (
                    <div key={g.group}>
                      <p className="t-muted" style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 800 }}>{GROUP_FA[g.group] ?? g.group} — {g.keys.length}</p>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {g.keys.map(k => <Badge key={k} tone="neutral"><code dir="ltr" style={{ fontSize: 9.5 }}>{k}</code></Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            {/* ------------------- UI preferences ------------------- */}
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Monitor size={16} /> ترجیحات رابط کاربری</h2><p>این تنظیمات روی همین مرورگر (localStorage) نگهداری می‌شود و به حساب شما در سرور منتقل نمی‌گردد.</p></div>
              </div>
              <div className="entity-form" style={{ gap: 10 }}>
                <ThemeControl />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field-label" style={{ fontSize: 11 }}>
                    زبان
                    <select value={prefs.locale} onChange={e => setPrefs({ ...prefs, locale: e.target.value })}>
                      <option value="fa">فارسی</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label className="field-label" style={{ fontSize: 11 }}>
                    منطقهٔ زمانی
                    <select value={prefs.timezone} onChange={e => setPrefs({ ...prefs, timezone: e.target.value })}>
                      <option value="Asia/Tehran">تهران (Asia/Tehran)</option>
                      <option value="UTC">هماهنگ جهانی (UTC)</option>
                      <option value="Europe/Berlin">برلین (Europe/Berlin)</option>
                    </select>
                  </label>
                </div>
                <label className="field-label" style={{ fontSize: 11 }}>
                  محدودهٔ پیش‌فرض در ورود
                  <select value={prefs.defaultScope} onChange={e => setPrefs({ ...prefs, defaultScope: e.target.value })}>
                    <option value="all">همهٔ محدودهٔ مجاز</option>
                    {me?.accessibleOrganizationIds?.map(id => (
                      <option key={id} value={id}>{me.memberships.find(m => m.organizationId === id)?.organizationName ?? id}</option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 16px', minHeight: 0 }} onClick={savePrefs}><Save size={14} /> ذخیرهٔ ترجیحات</button>
              </div>
            </section>

            {/* ------------------- quick links ------------------- */}
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Link2 size={16} /> دسترسی سریع</h2><p>صفحات مرتبط با حساب، امنیت و حریم خصوصی شما.</p></div>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {[
                  ['/sessions', 'نشست‌ها و دستگاه‌های من', 'مشاهده و لغو نشست‌های فعال', <Smartphone key="i" size={14} />],
                  ['/security', 'امنیت و حاکمیت', 'وضعیت امنیتی حساب و سامانه', <Lock key="i" size={14} />],
                  ['/security-events', 'رویدادهای امنیتی', 'ورودها و رخدادهای امنیتی', <ScrollText key="i" size={14} />],
                  ['/privacy', 'حقوق داده و حریم خصوصی', 'رضایت‌ها و درخواست‌های حق داده', <ShieldCheck key="i" size={14} />],
                  ['/governance', 'وضعیت حاکمیت', 'بررسی‌های مقدماتی حاکمیتی', <CheckCircle2 key="i" size={14} />],
                  ['/enterprise', 'حاکمیت سازمانی', 'خط‌مشی‌ها، پرچم‌ها و خروجی‌ها', <Building2 key="i" size={14} />],
                ].map(([href, title, desc, icon]) => (
                  <Link key={href as string} href={href as string} className="listRow" style={{ textDecoration: 'none', color: 'inherit', alignItems: 'center', padding: '9px 12px', borderRadius: 10 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--srip-accent,#2563eb) 11%, transparent)', color: 'var(--srip-accent,#2563eb)' }}>{icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 12 }}>{title}</b>
                      <span className="t-muted" style={{ fontSize: 10.5 }}>{desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {/* ------------------- MFA enroll modal ------------------- */}
      <Modal
        open={enrollOpen}
        title="فعال‌سازی تأیید دومرحله‌ای"
        description="دستگاه جدید ثبت می‌شود و پس از تأیید با یک کد ۶ رقمی، کدهای بازیابی یک‌بارمصرف صادر می‌گردد."
        onClose={() => setEnrollOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setEnrollOpen(false)}><X size={14} /> بستن</button>
          {step !== 'done' && (
            <button type="submit" form="mfa-enroll-form" className="btn btn-primary" disabled={busyOn('enroll') || busyOn('verify-enroll')}>
              {step === 'form' ? (busyOn('enroll') ? 'در حال ساخت…' : 'ساخت دستگاه') : (busyOn('verify-enroll') ? 'در حال تأیید…' : 'تأیید و دریافت کدهای بازیابی')}
            </button>
          )}
        </>}
      >
        {step === 'form' && (
          <form id="mfa-enroll-form" className="entity-form" onSubmit={startEnroll}>
            <p style={{ fontSize: 11.5, margin: 0 }} className="t-muted">
              <Fingerprint size={12} style={{ verticalAlign: -2 }} /> یک دستگاه احراز هویت (Google Authenticator، 1Password و مانند آن) روی گوشی خود داشته باشید؛ کلید مخفی در گام بعد نمایش داده می‌شود.
            </p>
          </form>
        )}
        {step === 'verify' && device && (
          <form id="mfa-enroll-form" className="entity-form" onSubmit={verifyEnroll}>
            <div style={{ display: 'grid', gap: 7 }}>
              <p style={{ fontSize: 11, margin: 0 }} className="t-muted">
                کلید مخفی را در اپلیکشن وارد کنید (یا روی «کپی» بزنید) سپس کد ۶ رقمی تولیدشده را این‌جا وارد کنید:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--card-bg-soft,#f1f5f9)', borderRadius: 8, padding: '7px 9px', direction: 'ltr' }}>
                <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all' }}>{device.secret}</code>
                <button type="button" className="secondary-action" style={{ padding: '5px 9px', minHeight: 0 }} onClick={copySecret}><Copy size={12} /> کپی</button>
              </div>
              <div style={{ direction: 'ltr', textAlign: 'left' }}>
                <code style={{ fontSize: 9.5, opacity: .75, wordBreak: 'break-all' }}>{device.otpauthUrl}</code>
              </div>
              <label className="field-label" style={{ fontSize: 11 }}>کد ۶ رقمی <span className="req">*</span>
                <input dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" style={{ textAlign: 'left', fontFamily: 'ui-monospace,monospace' }} />
              </label>
            </div>
          </form>
        )}
        {step === 'done' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--green,#16a34a) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--green,#16a34a) 25%, transparent)' }}>
              <CheckCircle2 size={17} style={{ color: 'var(--green,#16a34a)', flex: '0 0 auto' }} />
              <span style={{ fontSize: 11.5 }}><b>تأیید دومرحله‌ای فعال شد.</b> از این پس ورود به کد ۶ رقمی نیاز دارد.</span>
            </div>
            {recoveryCodes.length > 0 && (
              <>
                <p style={{ fontSize: 11, margin: 0 }} className="t-muted">
                  <AlertTriangle size={12} style={{ verticalAlign: -2, color: 'var(--gold,#d97706)' }} /> کدهای بازیابی زیر <b>فقط همین یک بار</b> نمایش داده می‌شوند و هر کدام یک‌بار مصرف‌اند — آن‌ها را ذخیره کنید:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 5 }}>
                  {recoveryCodes.map(c => (
                    <code key={c} dir="ltr" style={{ fontSize: 10, background: 'var(--card-bg-soft,#f1f5f9)', padding: '5px 7px', borderRadius: 6, textAlign: 'center' }}>{c}</code>
                  ))}
                </div>
                <button className="secondary-action" style={{ padding: '7px 12px', minHeight: 0, justifySelf: 'flex-start' }} onClick={copyAll}><Copy size={13} /> کپی همهٔ کدها</button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ------------------- MFA test modal ------------------- */}
      <Modal
        open={testOpen}
        title="آزمون کد دومرحله‌ای"
        description="یک کد ۶ رقمی از اپلیکشن احراز هویت وارد کنید تا مسیر تأیید (mfa/verify) آزمایش شود."
        onClose={() => setTestOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setTestOpen(false)}><X size={14} /> انصراف</button>
          <button type="submit" form="mfa-test-form" className="btn btn-primary" disabled={busyOn('test')}>{busyOn('test') ? 'در حال بررسی…' : 'تأیید کد'}</button>
        </>}
      >
        <form id="mfa-test-form" className="entity-form" onSubmit={testMfa}>
          <label className="field-label">کد ۶ رقمی <span className="req">*</span>
            <input dir="ltr" inputMode="numeric" maxLength={6} value={testCode} onChange={e => setTestCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" style={{ textAlign: 'left', fontFamily: 'ui-monospace,monospace' }} />
          </label>
        </form>
      </Modal>
    </main>
  );
}
