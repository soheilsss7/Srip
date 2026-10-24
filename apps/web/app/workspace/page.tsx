'use client';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import {
  Activity, AlertTriangle, Bell, BellRing, Building2, CalendarDays,
  ClipboardCheck, Compass, FileText, Handshake,
  HeartPulse, LayoutGrid, ListTodo, ShieldCheck, Sparkles, Wallet, Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  مرکز عملیات — هاب یکپارچهٔ وضعیت امروز، عملیات و ناوبری حوزه‌ها    */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const fmt1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const list = (x: any) => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);
const faDT = (iso?: string | null, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fa-IR', withTime ? { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long' });
};
const faDay = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const todayISO = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

type Me = { permissions?: string[]; memberships?: { organizationName?: string; isPrimary?: boolean }[] };
type Ctx = { actions: any[]; meetings: any[]; commitments: any[]; opps: any[]; notifs: any[]; approvals: any[]; recs: any[]; rels: any[]; me: Me | null };

const Q_GROUPS: { title: string; icon: ComponentType<{ size?: number | string }>; items: [string, string][] }[] = [
  { title: 'موجودیت‌ها و روابط', icon: Building2, items: [['/organizations', 'سازمان‌ها'], ['/people', 'اشخاص'], ['/relationships', 'روابط'], ['/meetings', 'جلسات'], ['/network', 'شبکه']] },
  { title: 'اجرا و پیگیری', icon: ListTodo, items: [['/actions', 'اقدامات'], ['/commitments', 'تعهدات'], ['/projects', 'پروژه‌ها'], ['/opportunities', 'فرصت‌ها'], ['/calendar', 'تقویم'], ['/approvals', 'تأییدها']] },
  { title: 'هوش و پیشنهاد', icon: Sparkles, items: [['/recommendations', 'پیشنهادها'], ['/intelligence', 'هوش رابطه'], ['/search', 'جستجو'], ['/analytics', 'تحلیل محصول'], ['/ai', 'دستیار هوشمند']] },
  { title: 'داده و حاکمیت', icon: ShieldCheck, items: [['/admin', 'مرکز مدیریت'], ['/data-quality', 'کیفیت داده'], ['/data-management', 'مدیریت داده'], ['/reports', 'گزارش‌ها'], ['/workflows', 'گردش کار'], ['/integrations', 'یکپارچه‌سازی']] },
  { title: 'مستندات و دانش', icon: FileText, items: [['/documents', 'اسناد'], ['/knowledge', 'دانش'], ['/notifications', 'اعلان‌ها'], ['/requirements', 'نیازمندی‌ها'], ['/referrals', 'معرفی‌ها'], ['/data-exchange', 'تبادل داده']] },
  { title: 'پایش و پایداری', icon: HeartPulse, items: [['/monitoring', 'مرکز پایش'], ['/metrics', 'سنجه‌ها'], ['/observability', 'مشاهده‌پذیری'], ['/health', 'سلامت'], ['/security', 'امنیت'], ['/governance', 'حاکمیت']] },
  { title: 'حساب و تنظیمات', icon: Compass, items: [['/settings', 'تنظیمات کاربر'], ['/sessions', 'نشست‌های من'], ['/privacy', 'حریم خصوصی'], ['/data-lifecycle', 'چرخهٔ حیات داده'], ['/help', 'راهنما']] },
];

export default function Workspace() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [actions, meetings, commitments, opps, notifs, approvals, recs, rels, me] = await Promise.all([
        api<any>('/actions').then(list).catch(() => [] as any[]),
        api<any>('/meetings').then(list).catch(() => [] as any[]),
        api<any>('/commitments').then(list).catch(() => [] as any[]),
        api<any>('/opportunities').then(list).catch(() => [] as any[]),
        api<any>('/notifications').then(list).catch(() => [] as any[]),
        api<any>('/approvals?status=PENDING').then(list).catch(() => [] as any[]),
        api<any>('/recommendations').then(list).catch(() => [] as any[]),
        api<any>('/relationships').then(list).catch(() => [] as any[]),
        api<Me>('/auth/me').catch(() => null),
      ]);
      setCtx({ actions, meetings, commitments, opps, notifs, approvals, recs, rels, me });
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void load(true); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  const x = useMemo(() => {
    if (!ctx) return null;
    const endToday = todayISO();
    const now = Date.now();
    const actionsOpen = ctx.actions.filter((a: any) => a.status !== 'DONE' && a.status !== 'CANCELLED' && !a.deletedAt);
    const overdueActs = actionsOpen.filter((a: any) => a.dueAt && new Date(a.dueAt).getTime() < now);
    const dueTodayActs = actionsOpen.filter((a: any) => a.dueAt && new Date(a.dueAt).getTime() <= endToday && new Date(a.dueAt).getTime() >= now);
    const meetingsUp = ctx.meetings.filter((m: any) => m.startAt && new Date(m.startAt).getTime() >= now).sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const nextMeeting = meetingsUp[0] ?? null;
    const commitsOpen = ctx.commitments.filter((c: any) => c.status === 'OPEN');
    const commitsLate = commitsOpen.filter((c: any) => c.dueAt && new Date(c.dueAt).getTime() < now);
    const commitsToday = commitsOpen.filter((c: any) => c.dueAt && new Date(c.dueAt).getTime() <= endToday && new Date(c.dueAt).getTime() >= now);
    const oppsOpen = ctx.opps.filter((o: any) => o.openStatus && o.status !== 'WON' && o.status !== 'LOST');
    const pipe = oppsOpen.reduce((s: number, o: any) => s + (o.expectedValue ?? 0), 0);
    const unread = ctx.notifs.filter((n: any) => !n.isRead).length;
    const recsReady = ctx.recs.filter((r: any) => r.status === 'PROPOSED' || r.status === 'APPROVED');
    const atRisk = ctx.rels.filter((r: any) => r.healthScore != null && r.healthScore < 50 && r.status === 'ACTIVE');
    const pendingN = ctx.approvals.length;
    const todayAgenda = [...meetingsUp.filter((m: any) => new Date(m.startAt).getTime() <= endToday), ...dueTodayActs, ...commitsToday].length;
    return { actionsOpen, overdueActs, dueTodayActs, meetingsUp, nextMeeting, commitsOpen, commitsLate, commitsToday, oppsOpen, pipe, unread, recsReady, atRisk, pendingN, todayAgenda };
  }, [ctx]);

  const scopeLabel = useMemo(() => {
    const m = ctx?.me ?? null;
    if (!m) return null;
    if ((m.permissions ?? []).includes('*')) return 'همهٔ سازمان‌ها (مالک)';
    const p = (m.memberships ?? []).find(x => x.isPrimary) ?? (m.memberships ?? [])[0];
    return p?.organizationName ?? null;
  }, [ctx]);

  if (loading && !ctx) return <main className="feature-page"><PageHeader eyebrow="فضای کاری" title="مرکز عملیات" description="نقطهٔ ورود یکپارچه به وضعیت امروز، عملیات و همهٔ حوزه‌های پلتفرم." /><Loading label="در حال جمع‌آوری نمای عملیات…" /></main>;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری"
        title="مرکز عملیات"
        description="خلاصهٔ زندهٔ عملیات: جلسات پیشِ رو، اقدامات و تعهداتِ زمان‌دار، سبد فرصت، اعلان‌ها و روابط در معرض ریسک — همه از نقطه‌های پایانی واقعی سامانه (بازخوانی خودکار هر ۶۰ ثانیه)."
        actions={
          <>
            {scopeLabel && <Badge tone="info"><Building2 size={11} style={{ verticalAlign: -2 }} /> {scopeLabel}</Badge>}
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <Activity size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </>
        }
      />
      <ErrorCard message={error} />
      {!ctx ? <Loading label="در حال بارگذاری…" /> : x && (
        <>
          <div className="notice" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CalendarDays size={14} /> امروز <b>{faDay(new Date().toISOString())}</b> — {x.todayAgenda > 0 ? <b>{fmt.format(x.todayAgenda)} مورد در برنامهٔ امروز</b> : 'مورد زمان‌داری برای امروز نیست'}
            {x.nextMeeting && <> · جلسهٔ بعدی: <b>{x.nextMeeting.title}</b> در {faDT(x.nextMeeting.startAt)}</>}
          </div>

          <div className="stat-grid">
            <StatCard icon={<CalendarDays size={18} />} label="جلسات پیشِ رو" value={fmt.format(x.meetingsUp.length)} sub={x.nextMeeting ? `بعدی: ${faDT(x.nextMeeting.startAt)}` : 'جلسه‌ای ثبت نشده'} iconClass="ic-blue" />
            <StatCard icon={<Zap size={18} />} label="اقدامات باز" value={fmt.format(x.actionsOpen.length)} sub={`${fmt.format(x.overdueActs.length)} عقب‌افتاده`} iconClass={x.overdueActs.length > 0 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<Wallet size={18} />} label="فرصت‌های باز" value={fmt.format(x.oppsOpen.length)} sub={`ارزش موزون ${fmt1.format(x.pipe / 1e9)} میلیارد تومان`} iconClass="ic-gold" />
            <StatCard icon={<Bell size={18} />} label="اعلان‌های خوانده‌نشده" value={fmt.format(x.unread)} sub="آخرین رویدادهای سامانه" iconClass={x.unread > 0 ? 'ic-gold' : 'ic-green'} />
            <StatCard icon={<ClipboardCheck size={18} />} label="تأییدهای در انتظار" value={fmt.format(x.pendingN)} sub="نیازمند تصمیم" iconClass={x.pendingN > 0 ? 'ic-purple' : 'ic-green'} />
            <StatCard icon={<Sparkles size={18} />} label="پیشنهادهای آماده" value={fmt.format(x.recsReady.length)} sub="پیشنهاد/تأییدشدهٔ هوشمند" iconClass="ic-blue" />
            <StatCard icon={<HeartPulse size={18} />} label="روابط در معرض ریسک" value={fmt.format(x.atRisk.length)} sub="سلامت زیر ۵۰" iconClass={x.atRisk.length > 0 ? 'ic-red' : 'ic-green'} />
            <StatCard icon={<Handshake size={18} />} label="تعهدات باز" value={fmt.format(x.commitsOpen.length)} sub={`${fmt.format(x.commitsLate.length)} عقب‌افتاده`} iconClass={x.commitsLate.length > 0 ? 'ic-red' : 'ic-green'} />
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><CalendarDays size={16} /> برنامهٔ پیشِ رو</h2>
                  <p>جلسات آینده و اقدامات/تعهدات بازِ زمان‌دار — مرتب بر پایهٔ موعد.</p>
                </div>
                <Link className="primary-action" href="/calendar">تقویم</Link>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {[...x.meetingsUp.map((m: any) => ({ kind: 'meeting', id: m.id, title: m.title, at: m.startAt, org: m.organization?.name ?? null, meta: 'جلسه' })),
                  ...x.dueTodayActs.map((a: any) => ({ kind: 'action', id: a.id, title: a.title, at: a.dueAt, org: null, meta: 'اقدام' })),
                  ...x.commitsToday.map((c: any) => ({ kind: 'commitment', id: c.id, title: c.description, at: c.dueAt, org: c.organization?.name ?? null, meta: 'تعهد' }))].sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime()).slice(0, 7).map((it: any) => (
                  <div key={`${it.kind}-${it.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '5px 2px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, flex: '0 0 auto', background: it.kind === 'meeting' ? '#2563eb' : it.kind === 'action' ? '#d97706' : '#7c3aed' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/${it.kind === 'meeting' ? 'meetings' : it.kind === 'action' ? 'actions' : 'commitments'}/${it.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <b style={{ fontSize: 11 }}>{it.title}</b>
                      </Link>
                      {it.org && <small className="t-muted" style={{ display: 'block' }}>{it.org}</small>}
                    </span>
                    <Badge tone={it.kind === 'meeting' ? 'info' : it.kind === 'action' ? 'warning' : 'neutral'}>{it.meta}</Badge>
                    <small className="t-muted" style={{ fontSize: 9.5, whiteSpace: 'nowrap' }}>{faDT(it.at)}</small>
                  </div>
                ))}
                {x.meetingsUp.length === 0 && x.dueTodayActs.length === 0 && x.commitsToday.length === 0 && <p className="t-muted" style={{ fontSize: 11 }}>مورد برنامه‌ریزی‌شده‌ای در پیش نیست.</p>}
              </div>
            </section>

            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={16} /> نیازمند توجه</h2>
                  <p>اقدامات/تعهدات عقب‌افتاده و روابط با سلامت زیر ۵۰.</p>
                </div>
                <Link className="primary-action" href="/actions">همهٔ اقدامات</Link>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {[...x.overdueActs.map((a: any) => ({ kind: 'a', id: a.id, title: a.title, at: a.dueAt, tag: 'اقدام عقب‌افتاده' as const })),
                  ...x.commitsLate.map((c: any) => ({ kind: 'c', id: c.id, title: c.description, at: c.dueAt, tag: 'تعهد عقب‌افتاده' as const }))].sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime()).slice(0, 5).map((it: any) => (
                  <div key={`${it.kind}-${it.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '5px 2px' }}>
                    <AlertTriangle size={13} style={{ color: 'var(--red,#dc2626)', flex: '0 0 auto' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/${it.kind === 'a' ? 'actions' : 'commitments'}/${it.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <b style={{ fontSize: 11 }}>{it.title}</b>
                      </Link>
                    </span>
                    <Badge tone="danger">{it.tag}</Badge>
                    <small className="t-muted" style={{ fontSize: 9.5, whiteSpace: 'nowrap' }}>موعد {faDT(it.at)}</small>
                  </div>
                ))}
                {x.atRisk.map((r: any) => (
                  <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '5px 2px' }}>
                    <HeartPulse size={13} style={{ color: 'var(--red,#dc2626)', flex: '0 0 auto' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/relationships/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <b style={{ fontSize: 11 }}>{r.sourceOrganization?.name ?? '—'} ↔ {r.targetOrganization?.name ?? '—'}</b>
                      </Link>
                      <small className="t-muted" style={{ display: 'block', fontSize: 9.5 }}>نوع {r.relationshipType ?? '—'}</small>
                    </span>
                    <Badge tone="danger">سلامت {fmt.format(r.healthScore ?? 0)}</Badge>
                  </div>
                ))}
                {x.overdueActs.length === 0 && x.commitsLate.length === 0 && x.atRisk.length === 0 && <p className="t-muted" style={{ fontSize: 11 }}>مورد نیازمند توجهی نیست — همه چیز تحت کنترل است.</p>}
              </div>
            </section>
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Wallet size={16} /> سبد فرصت</h2>
                  <p>فرصت‌های باز با احتمال و ارزش موزون.</p>
                </div>
                <Link className="primary-action" href="/opportunities">سبد کامل</Link>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {x.oppsOpen.slice(0, 5).map((o: any) => (
                  <div key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '5px 2px' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/opportunities/${o.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <b style={{ fontSize: 11 }}>{o.name}</b>
                      </Link>
                      <small className="t-muted" style={{ display: 'block', fontSize: 9.5 }}>{o.organization?.name ?? '—'} · احتمال {fmt.format(o.probability ?? 0)}٪</small>
                    </span>
                    <b style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{fmt1.format((o.expectedValue ?? 0) / 1e9)} <small className="t-muted">م.ت</small></b>
                    <Badge tone={o.probability >= 70 ? 'success' : o.probability >= 40 ? 'warning' : 'neutral'}>{o.status === 'IDENTIFIED' ? 'شناسایی' : o.status === 'ACTIVE' ? 'در جریان' : o.status}</Badge>
                  </div>
                ))}
                {x.oppsOpen.length === 0 && <p className="t-muted" style={{ fontSize: 11 }}>فرصت باز نیست.</p>}
              </div>
              <div style={{ marginTop: 12, background: 'color-mix(in srgb, var(--border,#e2e8f0) 35%, transparent)', borderRadius: 10, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                <span className="t-muted">جمع ارزش موزون سبد باز</span>
                <b>{fmt1.format(x.pipe / 1e9)} میلیارد تومان</b>
              </div>
            </section>

            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><BellRing size={16} /> اعلان‌ها و تصمیم‌ها</h2>
                  <p>خوانده‌نشده‌ها، تأییدهای در انتظار و پیشنهادهای هوشمند.</p>
                </div>
                <Link className="primary-action" href="/notifications">همه</Link>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {ctx.notifs.filter((n: any) => !n.isRead).slice(0, 3).map((n: any) => (
                  <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 11, padding: '5px 2px' }}>
                    <Bell size={13} style={{ color: 'var(--gold,#d97706)', flex: '0 0 auto', marginTop: 1 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 11, display: 'block' }}>{n.title}</b>
                      <small className="t-muted" style={{ fontSize: 9.5 }}>{n.body ?? ''} · {faDT(n.createdAt)}</small>
                    </span>
                    <Badge tone="warning">{n.priority === 'recommendation' ? 'پیشنهاد' : n.priority}</Badge>
                  </div>
                ))}
                {ctx.approvals.slice(0, 2).map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '5px 2px' }}>
                    <ClipboardCheck size={13} style={{ color: 'var(--purple,#7c3aed)', flex: '0 0 auto' }} />
                    <Link href="/approvals" style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <b style={{ fontSize: 11 }}>{a.entityLabel ?? a.actionType ?? 'درخواست تأیید'}</b>
                      <small className="t-muted" style={{ display: 'block', fontSize: 9.5 }}>{a.requestedByName ?? ''} · {faDT(a.createdAt)}</small>
                    </Link>
                    <Badge tone="neutral">{a.actionType ?? '—'}</Badge>
                  </div>
                ))}
                {x.recsReady.slice(0, 2).map((r: any) => (
                  <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '5px 2px' }}>
                    <Sparkles size={13} style={{ color: 'var(--blue,#2563eb)', flex: '0 0 auto' }} />
                    <Link href={`/recommendations/${r.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <b style={{ fontSize: 11 }}>{r.title}</b>
                      <small className="t-muted" style={{ display: 'block', fontSize: 9.5 }}>اطمینان {fmt.format(r.confidence ?? 0)}٪</small>
                    </Link>
                    <Badge tone={r.status === 'APPROVED' ? 'success' : 'info'}>{r.status === 'APPROVED' ? 'تأییدشده' : 'پیشنهاد'}</Badge>
                  </div>
                ))}
                {ctx.notifs.filter((n: any) => !n.isRead).length === 0 && ctx.approvals.length === 0 && x.recsReady.length === 0 && <p className="t-muted" style={{ fontSize: 11 }}>چیزی برای تصمیم نیست.</p>}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><LayoutGrid size={16} /> حوزه‌های عملیاتی</h2>
                <p>نقطهٔ ورود سریع به همهٔ حوزه‌های پلتفرم — هر مسیر به صفحهٔ تخصصی همان حوزه می‌رود.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))' }}>
              {Q_GROUPS.map(g => {
                const Icon = g.icon;
                return (
                  <div key={g.title} style={{ border: '1px solid var(--border,#e2e8f0)', borderRadius: 14, padding: '12px 14px', display: 'grid', gap: 6, alignContent: 'start' }}>
                    <b style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: 'var(--blue,#2563eb)', display: 'inline-flex' }}><Icon size={14} /></span> {g.title}</b>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {g.items.map(([href, label]) => (
                        <Link key={href} href={href} className="btn btn-ghost" style={{ minHeight: 0, padding: '4px 9px', fontSize: 10, borderRadius: 99 }}>{label}</Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
