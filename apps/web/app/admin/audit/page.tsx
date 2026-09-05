'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  ScrollText, RefreshCw, Search, CheckCircle2, XCircle, ShieldAlert,
  UserRound, Building2, AlertTriangle, Eye, EyeOff, LogIn, LogOut, RefreshCcw,
  UserPlus, PencilLine, Trash2, KeyRound, FileDown, FileCheck2, FileX2, ListTree, History, ChevronDown,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  لاگ ممیزی — ردپای کامل عملیات (پاریتی با /admin/audit-log)          */
/* ------------------------------------------------------------------ */

type AuditEvent = {
  id: string; at: string;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  outcome: string;
  ip?: string | null;
  meta?: any;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

const ACTION_FA: Record<string, string> = {
  LOGIN_SUCCESS: 'ورود موفق', LOGIN_FAIL: 'ورود ناموفق', LOGOUT: 'خروج از سامانه',
  TOKEN_REFRESH: 'تازه‌سازی نشست', REGISTER: 'ثبت‌نام حساب',
  CREATE: 'ایجاد', UPDATE: 'ویرایش', DELETE: 'حذف',
  PERMISSION_CHANGE: 'تغییر دسترسی', APPROVE: 'تأیید', REJECT: 'رد',
  MEETING_OUTCOME: 'ثبت نتیجهٔ جلسه', FINALIZE: 'نهایی‌سازی جلسه',
  EXPORT: 'خروجی داده', FINALIZE_MEETING: 'نهایی‌سازی جلسه', MEETING_FINALIZE: 'نهایی‌سازی جلسه',
};
const ACTION_TONE: Record<string, string> = {
  LOGIN_SUCCESS: 'success', LOGIN_FAIL: 'danger', LOGOUT: 'neutral', TOKEN_REFRESH: 'info',
  REGISTER: 'info', CREATE: 'success', UPDATE: 'warning', DELETE: 'danger',
  PERMISSION_CHANGE: 'danger', APPROVE: 'success', REJECT: 'danger',
  MEETING_OUTCOME: 'info', FINALIZE: 'info', EXPORT: 'info',
};
const ACTION_ICON: Record<string, React.ReactNode> = {
  LOGIN_SUCCESS: <LogIn size={11} />, LOGIN_FAIL: <LogIn size={11} />, LOGOUT: <LogOut size={11} />,
  TOKEN_REFRESH: <RefreshCcw size={11} />, REGISTER: <UserPlus size={11} />,
  CREATE: <FileCheck2 size={11} />, UPDATE: <PencilLine size={11} />, DELETE: <Trash2 size={11} />,
  PERMISSION_CHANGE: <KeyRound size={11} />, APPROVE: <CheckCircle2 size={11} />, REJECT: <FileX2 size={11} />,
  EXPORT: <FileDown size={11} />,
};
const SENSITIVE = new Set(['DELETE', 'PERMISSION_CHANGE', 'APPROVE', 'REJECT', 'EXPORT']);

function normEntity(e: string): string {
  if (!e) return e;
  return e.charAt(0).toUpperCase() + e.slice(1).toLowerCase();
}
const ENTITY_FA: Record<string, string> = {
  User: 'کاربر', Organization: 'سازمان', Person: 'شخص', Relationship: 'رابطه',
  Meeting: 'جلسه', Action: 'اقدام', Commitment: 'تعهد', Project: 'پروژه',
  Opportunity: 'فرصت', Recommendation: 'پیشنهاد', Referral: 'معرفی', Tag: 'برچسب',
  CustomField: 'فیلد سفارشی', Role: 'نقش', Membership: 'عضویت', ScoringRule: 'قاعده امتیاز',
  NotificationRule: 'قاعده اعلان', Workflow: 'گردش کار', Interaction: 'تعامل',
  Document: 'سند', Report: 'گزارش', Session: 'نشست', AiSetting: 'تنظیمات هوش مصنوعی',
};

function MetaChips({ meta }: { meta?: any }) {
  const m = (meta && typeof meta === 'object' && !Array.isArray(meta)) ? (meta.meta ?? meta) : null;
  if (!m || (typeof m === 'object' && Object.keys(m).length === 0)) return <span className="t-muted">—</span>;
  if (typeof m === 'string') return <span style={{ fontSize: 11.5 }}>{m}</span>;
  const keys = Object.keys(m).slice(0, 3);
  return (
    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {keys.map(k => {
        let v: any = m[k];
        if (v !== null && typeof v === 'object') v = JSON.stringify(v);
        if (typeof v === 'boolean') v = v ? 'بله' : 'خیر';
        if (v === null || v === undefined) return null;
        return (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, background: 'var(--input-bg, #f5f6f9)', borderRadius: 6, padding: '1px 6px' }}>
            <b className="t-muted" style={{ fontWeight: 600 }}>{k}:</b>
            <span dir="auto" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
          </span>
        );
      })}
    </span>
  );
}

export default function AdminAuditPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [visible, setVisible] = useState(40);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (entityFilter) params.set('entityType', entityFilter);
      if (outcomeFilter) params.set('outcome', outcomeFilter === 'FAIL' ? 'FAIL' : 'OK');
      if (actorFilter && actorFilter !== 'self') params.set('actor', actorFilter);
      const d = await api<any>(`/admin/audit-log?${params.toString()}`);
      setEvents(unwrap(d?.events ?? d));
      setTotal(typeof d?.total === 'number' ? d.total : (unwrap(d?.events ?? d).length));
      setVisible(40);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner, entityFilter, outcomeFilter, actorFilter]);
  useEffect(() => { load(); }, [load]);

  const entityKinds = useMemo(() => {
    const order: string[] = [];
    const set = new Set<string>();
    for (const e of events) {
      const n = normEntity(e.entity);
      if (!set.has(n)) { set.add(n); order.push(n); }
    }
    return order;
  }, [events]);
  const actors = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.actorEmail && e.actorEmail !== 'anonymous') set.add(e.actorEmail);
    return [...set].sort();
  }, [events]);

  const stats = useMemo(() => {
    const failed = events.filter(e => e.outcome !== 'OK').length;
    const sensitive = events.filter(e => SENSITIVE.has(e.action) && e.outcome === 'OK').length;
    const creates = events.filter(e => e.action === 'CREATE' && e.outcome === 'OK').length;
    const deletes = events.filter(e => e.action === 'DELETE' && e.outcome === 'OK').length;
    return {
      total, failed, sensitive, creates, deletes,
      actorCount: actors.length + 1,
    };
  }, [events, total, actors.length]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = events.filter(e => {
      if (term) {
        const hay = `${e.entityId ?? ''} ${e.action} ${e.entity}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    return filtered.slice(0, visible);
  }, [events, q, visible]);

  const displayActor = (e: AuditEvent): string => {
    if (e.actorEmail && e.actorEmail !== 'anonymous') return e.actorEmail;
    if (!e.actorEmail && e.entityId && /@/.test(e.entityId)) return e.entityId;
    return 'سامانه';
  };

  const fmtDT = (iso: string) => new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / ممیزی" title="لاگ ممیزی" description="ردپای کامل عملیات سامانه." />
        <div className="empty-state-v4">
          <div className="empty-ico"><ScrollText size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مشاهدهٔ لاگ ممیزی به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / ممیزی"
        title="لاگ ممیزی"
        description="ردپای append-only همهٔ عملیات: ورودها، ایجاد/ویرایش/حذف، تغییر دسترسی‌ها، تأییدها و خروجی‌های داده — با بازیگر، نهاد، نتیجه و جزئیات."
        actions={
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
        }
      />
      <ErrorCard message={error} />

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 420 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<History size={18} />} label="کل رویدادها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در بازهٔ نگهداری لاگ" />
            <StatCard icon={<XCircle size={18} />} label="ناموفق" value={fmtNum(stats.failed)} iconClass="ic-red" sub="ورود ناموفق و خطاها" />
            <StatCard icon={<ShieldAlert size={18} />} label="عملیات حساس" value={fmtNum(stats.sensitive)} iconClass="ic-gold" sub="حذف/دسترسی/تأیید/خروجی" />
            <StatCard icon={<FileCheck2 size={18} />} label="ایجاد" value={fmtNum(stats.creates)} iconClass="ic-teal" sub="رکوردهای جدید" />
            <StatCard icon={<Trash2 size={18} />} label="حذف" value={fmtNum(stats.deletes)} iconClass="ic-red" sub="رکوردهای حذف‌شده" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی شناسهٔ نهاد یا عملیات…">
            <select aria-label="فیلتر نهاد" value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ نهادها</option>
              {entityKinds.map(k => <option key={k} value={k}>{ENTITY_FA[k] ?? k}</option>)}
            </select>
            <select aria-label="فیلتر بازیگر" value={actorFilter} onChange={e => setActorFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ بازیگران</option>
              <option value="self">demo@srip.local (مالک)</option>
              {actors.filter(a => a !== 'demo@srip.local').map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select aria-label="فیلتر نتیجه" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ نتایج</option>
              <option value="OK">موفق</option>
              <option value="FAIL">ناموفق</option>
            </select>
            <span className="chip info">{fmtNum(total)} رویداد</span>
          </Toolbar>

          {shown.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>رویدادی یافت نشد</strong>
              <p>فیلترها یا عبارت جستجو را تغییر دهید.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>زمان</th>
                      <th>بازیگر</th>
                      <th>عملیات</th>
                      <th>نهاد</th>
                      <th>نتیجه</th>
                      <th>IP</th>
                      <th>جزئیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(e => {
                      const n = normEntity(e.entity);
                      const isLogin = e.action.startsWith('LOGIN');
                      const who = isLogin && (!e.actorEmail || e.actorEmail === 'anonymous') && e.entityId && /@/.test(e.entityId)
                        ? e.entityId
                        : displayActor(e);
                      return (
                        <tr key={e.id} className={e.outcome !== 'OK' ? 'row-alert' : ''}>
                          <td><span className="t-muted" style={{ fontSize: 11.5 }}>{fmtDT(e.at)}</span></td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <UserRound size={12} className="t-muted" />
                              <span dir="ltr" style={{ fontSize: 11.5 }}>{who}</span>
                            </span>
                          </td>
                          <td>
                            <Badge tone={(ACTION_TONE[e.action] ?? 'neutral') as any}>
                              {ACTION_ICON[e.action]}{ACTION_FA[e.action] ?? e.action}
                            </Badge>
                            <div><code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{e.action}</code></div>
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <Building2 size={12} className="t-muted" />
                              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{ENTITY_FA[n] ?? n}</span>
                            </span>
                            {e.entityId && <div><code dir="ltr" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{e.entityId}</code></div>}
                          </td>
                          <td>
                            {e.outcome === 'OK'
                              ? <Badge tone="success"><CheckCircle2 size={11} /> موفق</Badge>
                              : <Badge tone="danger"><XCircle size={11} /> ناموفق</Badge>}
                          </td>
                          <td><code dir="ltr" className="t-muted" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace' }}>{e.ip ?? '—'}</code></td>
                          <td style={{ maxWidth: 260 }}><MetaChips meta={e.meta} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {events.length > visible && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setVisible(v => v + 40)}>
                    <ChevronDown size={14} /> نمایش بیشتر ({fmtNum(Math.min(40, events.length - visible))} مورد)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
