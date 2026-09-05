'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  BellRing, RefreshCw, Search, Plus, X, CheckCircle2, Pencil, Power,
  Mail, Smartphone, Inbox, Eye, EyeOff, Rows3, Zap, ListChecks, Filter,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  قواعد اعلان — رویداد → کانال‌ها → قالب (پاریتی admin/notification)  */
/* ------------------------------------------------------------------ */

type Rule = {
  id: string; key: string; name: string;
  eventType: string; channels: string[];
  template?: any; conditions?: any;
  active: boolean; createdAt?: string | null;
};

const EVENT_OPTIONS: Array<{ group: string; groupFa: string; events: string[] }> = [
  { group: 'organization', groupFa: 'سازمان', events: ['organization.created', 'organization.updated', 'organization.deleted'] },
  { group: 'person', groupFa: 'شخص', events: ['person.created', 'person.updated', 'person.deleted'] },
  { group: 'relationship', groupFa: 'رابطه', events: ['relationship.created', 'relationship.updated', 'relationship.deleted', 'relationship.score.changed', 'relationship.status.changed', 'relationship.lifecycle.changed'] },
  { group: 'interaction', groupFa: 'تعامل', events: ['interaction.created', 'interaction.updated', 'interaction.deleted'] },
  { group: 'meeting', groupFa: 'جلسه', events: ['meeting.created', 'meeting.updated', 'meeting.deleted', 'meeting.completed'] },
  { group: 'commitment', groupFa: 'تعهد', events: ['commitment.created', 'commitment.updated', 'commitment.deleted', 'commitment.completed', 'commitment.overdue'] },
  { group: 'action', groupFa: 'اقدام', events: ['action.created', 'action.updated', 'action.deleted', 'action.completed'] },
  { group: 'project', groupFa: 'پروژه', events: ['project.created', 'project.updated', 'project.deleted'] },
  { group: 'score', groupFa: 'امتیاز', events: ['score.updated'] },
  { group: 'opportunity', groupFa: 'فرصت', events: ['opportunity.created', 'opportunity.updated', 'opportunity.deleted', 'opportunity.status.changed'] },
  { group: 'recommendation', groupFa: 'پیشنهاد هوشمند', events: ['recommendation.created', 'recommendation.updated', 'recommendation.deleted', 'recommendation.viewed', 'recommendation.accepted', 'recommendation.action.completed'] },
  { group: 'approval', groupFa: 'تأیید', events: ['approval.requested', 'approval.approved', 'approval.rejected'] },
  { group: 'integration', groupFa: 'یکپارچه‌سازی', events: ['integration.webhook.received', 'integration.sync.completed', 'integration.sync.failed'] },
  { group: 'data', groupFa: 'داده', events: ['data.import.approved', 'data.import.completed'] },
];
const EVENT_ALL = EVENT_OPTIONS.flatMap(g => g.events);
const EVENT_DOMAIN_FA: Record<string, string> = Object.fromEntries(EVENT_OPTIONS.map(g => [g.group, g.groupFa]));
const ACTION_FA: Record<string, string> = {
  created: 'جدید', updated: 'به‌روزرسانی', deleted: 'حذف', completed: 'تکمیل',
  overdue: 'عقب‌افتاده', changed: 'تغییر وضعیت', requested: 'درخواست', approved: 'تأیید شده',
  rejected: 'رد شده', viewed: 'مشاهده', accepted: 'پذیرفته', received: 'دریافت',
  failed: 'ناموفق', 'score.changed': 'تغییر امتیاز', 'status.changed': 'تغییر وضعیت',
  'sync.completed': 'تکمیل همگام', 'sync.failed': 'خطای همگام', 'webhook.received': 'دریافت وبهوک',
  'action.completed': 'تکمیل اقدام', 'import.approved': 'تأیید ورود', 'import.completed': 'تکمیل ورود',
  'lifecycle.changed': 'تغییر چرخهٔ حیات',
};
const CHANNEL_FA: Record<string, string> = { IN_APP: 'درون‌برنامه‌ای', EMAIL: 'ایمیل', PUSH: 'فشاری' };
const CHANNEL_ICON: Record<string, React.ReactNode> = {
  IN_APP: <Inbox size={12} />, EMAIL: <Mail size={12} />, PUSH: <Smartphone size={12} />,
};
const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

function eventFaLabels(key: string): { groupFa: string; actFa: string } {
  if (key === '*') return { groupFa: 'همهٔ رویدادها', actFa: 'سراسری' };
  const i = key.lastIndexOf('.');
  const domain = i > 0 ? key.slice(0, i) : key;
  const act = i > 0 ? key.slice(i + 1) : key;
  const domainFa = EVENT_DOMAIN_FA[domain] ?? (EVENT_DOMAIN_FA[domain.split('.')[0]] ?? domain);
  const actKey = domain.includes('.') ? domain.slice(domain.indexOf('.') + 1) + '.' + act : act;
  const actFa = ACTION_FA[key] ?? ACTION_FA[actKey] ?? ACTION_FA[act] ?? act;
  return { groupFa: domainFa, actFa };
}

export default function AdminNotificationRulesPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    key: '', name: '', eventType: 'meeting.created',
    inApp: true, email: false, push: false,
    title: '', body: '', conditions: '', active: true,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setRules(unwrap(await api<Rule[]>('/admin/notification-rules'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: rules.length,
    active: rules.filter(r => r.active).length,
    inactive: rules.filter(r => !r.active).length,
    email: rules.filter(r => r.active && r.channels.includes('EMAIL')).length,
    push: rules.filter(r => r.active && r.channels.includes('PUSH')).length,
  }), [rules]);

  const eventsInUse = useMemo(() => {
    const m = new Map<string, number>();
    rules.forEach(r => m.set(r.eventType, (m.get(r.eventType) ?? 0) + 1));
    return m;
  }, [rules]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rules.filter(r => {
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'inactive' && r.active) return false;
      if (channelFilter && !r.channels.includes(channelFilter)) return false;
      if (eventFilter && r.eventType !== eventFilter) return false;
      if (term && !`${r.name} ${r.key} ${r.eventType}`.toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || a.key.localeCompare(b.key));
  }, [rules, q, eventFilter, channelFilter, statusFilter]);

  const channelsOf = (f: typeof form) => [f.inApp && 'IN_APP', f.email && 'EMAIL', f.push && 'PUSH'].filter(Boolean) as string[];

  const beginCreate = () => {
    setError(''); setFormError('');
    setEditing(null);
    setForm({ key: '', name: '', eventType: 'meeting.created', inApp: true, email: false, push: false, title: '', body: '', conditions: '', active: true });
    setOpen(true);
  };
  const beginEdit = (r: Rule) => {
    setError(''); setFormError('');
    setEditing(r);
    const t = (typeof r.template === 'object' && r.template !== null) ? r.template : {};
    setForm({
      key: r.key, name: r.name, eventType: r.eventType,
      inApp: r.channels.includes('IN_APP'), email: r.channels.includes('EMAIL'), push: r.channels.includes('PUSH'),
      title: typeof t.title === 'string' ? t.title : '',
      body: typeof t.body === 'string' ? t.body : (typeof r.template === 'string' ? r.template : ''),
      conditions: r.conditions ? JSON.stringify(r.conditions, null, 1) : '',
      active: r.active,
    });
    setOpen(true);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const channels = channelsOf(form);
    if (!channels.length) { setFormError('دست‌کم یک کانال انتخاب کنید.'); setSaving(false); return; }
    if (!form.title.trim() && !form.body.trim()) { setFormError('قالب اعلان (عنوان یا متن) لازم است.'); setSaving(false); return; }
    try {
      let conditions: unknown = null;
      if (form.conditions.trim()) {
        try { conditions = JSON.parse(form.conditions); }
        catch { setFormError('شرایط باید JSON معتبر باشد (یا خالی بماند).'); setSaving(false); return; }
      }
      const saved = await api<Rule>('/admin/notification-rules', {
        method: 'POST',
        body: JSON.stringify({
          key: form.key, name: form.name, eventType: form.eventType, channels,
          template: { title: form.title.trim(), body: form.body.trim() },
          ...(conditions !== null ? { conditions } : {}),
          active: form.active,
        }),
      });
      setRules(list => {
        const rest = list.filter(r => r.id !== saved.id);
        return [saved, ...rest];
      });
      setOpen(false);
      setFlash(editing ? `قاعدهٔ «${saved.name}» به‌روزرسانی شد.` : `قاعدهٔ «${saved.name}» ساخته شد.`);
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(r: Rule) {
    if (busy) return;
    setBusy(r.id);
    try {
      const saved = await api<Rule>('/admin/notification-rules', {
        method: 'POST',
        body: JSON.stringify({
          key: r.key, name: r.name, eventType: r.eventType, channels: r.channels,
          template: r.template, ...(r.conditions ? { conditions: r.conditions } : {}), active: !r.active,
        }),
      });
      setRules(list => list.map(x => x.id === r.id ? saved : x));
      setFlash(saved.active ? `قاعدهٔ «${saved.name}» فعال شد.` : `قاعدهٔ «${saved.name}» غیرفعال شد.`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / قواعد اعلان" title="قواعد اعلان" description="رویداد → کانال‌ها → قالب." />
        <div className="empty-state-v4">
          <div className="empty-ico"><BellRing size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت قواعد اعلان به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / قواعد اعلان"
        title="قواعد اعلان"
        description="هر رویداد سامانه را به کانال‌های درون‌برنامه‌ای/ایمیل/فشاری با قالب پیام خودش وصل کنید — موتور اعلان‌ها روی سرور اعمال می‌کند."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={beginCreate}><Plus size={16} /> قاعدهٔ جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 400 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<ListChecks size={18} />} label="کل قواعد" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در موتور اعلان" />
            <StatCard icon={<BellRing size={18} />} label="فعال" value={fmtNum(stats.active)} iconClass="ic-teal" sub="در حال اجرا" />
            <StatCard icon={<EyeOff size={18} />} label="غیرفعال" value={fmtNum(stats.inactive)} iconClass="ic-gold" sub="معلق" />
            <StatCard icon={<Mail size={18} />} label="شامل ایمیل" value={fmtNum(stats.email)} iconClass="ic-red" sub="قواعد فعال دارای کانال ایمیل" />
            <StatCard icon={<Smartphone size={18} />} label="شامل فشاری" value={fmtNum(stats.push)} iconClass="ic-teal" sub="قواعد فعال دارای کانال فشاری" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام، کلید یا رویداد…">
            <select aria-label="فیلتر رویداد" value={eventFilter} onChange={e => setEventFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ رویدادها</option>
              {EVENT_ALL.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
            <select aria-label="فیلتر کانال" value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ کانال‌ها</option>
              {Object.keys(CHANNEL_FA).map(c => <option key={c} value={c}>{CHANNEL_FA[c]}</option>)}
            </select>
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} قاعده</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>قاعده‌ای یافت نشد</strong>
              <p>{rules.length === 0 ? 'با «قاعدهٔ جدید» نخستین قاعده را بسازید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>قاعده</th>
                    <th>رویداد</th>
                    <th>کانال‌ها</th>
                    <th>قالب پیام</th>
                    <th>شرایط</th>
                    <th>وضعیت</th>
                    <th style={{ width: 100 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const { groupFa, actFa } = eventFaLabels(r.eventType);
                    const t = (typeof r.template === 'object' && r.template !== null) ? r.template : {};
                    const used = eventsInUse.get(r.eventType) ?? 0;
                    return (
                      <tr key={r.id} className={r.active ? '' : 'row-muted'}>
                        <td>
                          <b className="t-primary">{r.name}</b>
                          <div className="t-muted"><code dir="ltr" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace' }}>{r.key}</code></div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <Zap size={12} style={{ color: 'var(--srip-accent)' }} />
                            <span className="t-primary" style={{ fontSize: 12.5 }}>{groupFa}{r.eventType !== '*' && ` — ${actFa}`}</span>
                          </div>
                          <code dir="ltr" className="t-muted" style={{ fontSize: 10, fontFamily: 'ui-monospace,monospace' }}>{r.eventType}</code>
                          {used > 1 && <div><Badge tone="warning">تکرار: {fmtNum(used)} قاعده</Badge></div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {r.channels.map(c => (
                              <span key={c} className={`chip ${c === 'EMAIL' ? 'info' : c === 'PUSH' ? 'success' : ''}`} style={{ fontSize: 10.5, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {CHANNEL_ICON[c]}{CHANNEL_FA[c] ?? c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          {typeof t.title === 'string' && t.title && <div style={{ fontWeight: 700, fontSize: 12 }}>{t.title}</div>}
                          <div className="t-muted" style={{ fontSize: 11.5 }}>{(typeof t.body === 'string' ? t.body : '').length > 90 ? String(t.body).slice(0, 90) + '…' : (typeof t.body === 'string' ? t.body : '—')}</div>
                        </td>
                        <td>
                          {r.conditions ? (
                            <code dir="ltr" style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', background: 'var(--input-bg, #f5f6f9)', padding: '2px 6px', borderRadius: 6 }}>
                              {JSON.stringify(r.conditions).slice(0, 46)}{JSON.stringify(r.conditions).length > 46 ? '…' : ''}
                            </code>
                          ) : <span className="t-muted" style={{ fontSize: 11.5 }}>—</span>}
                        </td>
                        <td>{r.active ? <Badge tone="success"><Eye size={11} /> فعال</Badge> : <Badge tone="neutral"><EyeOff size={11} /> غیرفعال</Badge>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" title="ویرایش" onClick={() => beginEdit(r)} disabled={!!busy}><Pencil size={13} /></button>
                            <button
                              className="btn btn-ghost btn-sm" title={r.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                              onClick={() => toggleActive(r)} disabled={!!busy} style={!r.active ? { color: 'var(--ok, #0a8f5c)' } : {}}
                            >
                              {busy === r.id ? <RefreshCw size={13} className="spin" /> : <Power size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------- create/edit ------- */}
      <Modal
        open={open}
        title={editing ? `ویرایش قاعدهٔ «${editing.name}»` : 'قاعدهٔ اعلان جدید'}
        description="رویداد و کانال‌ها را تعیین کنید؛ قالب پیام با متغیرهای رویداد (مانند {title}) ساخته می‌شود."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="nr-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : editing ? <Pencil size={14} /> : <Plus size={14} />}
              {editing ? ' ذخیرهٔ تغییرات' : ' ساخت قاعده'}
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="nr-form" className="entity-form org-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">نام قاعده <i className="req">*</i></span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثلاً: هشدار تعهد معوق" required />
            </label>
            <label className="field">
              <span className="field-label">کلید فنی <i className="req">*</i></span>
              <input
                dir="ltr" style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace' }}
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') }))}
                placeholder="overdue_commitment_alert" required
              />
            </label>
            <label className="field full">
              <span className="field-label">رویداد <i className="req">*</i></span>
              <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                <option value="*">* — همهٔ رویدادها (سراسری)</option>
                {EVENT_OPTIONS.map(g => (
                  <optgroup key={g.group} label={g.groupFa}>
                    {g.events.map(ev => <option key={ev} value={ev} dir="ltr">{ev}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field full">
              <span className="field-label">کانال‌های ارسال <i className="req">*</i></span>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 2 }}>
                {(['IN_APP', 'EMAIL', 'PUSH'] as const).map(c => (
                  <label key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox" style={{ width: 'auto' }}
                      checked={c === 'IN_APP' ? form.inApp : c === 'EMAIL' ? form.email : form.push}
                      onChange={e => setForm(f => ({ ...f, [c === 'IN_APP' ? 'inApp' : c === 'EMAIL' ? 'email' : 'push']: e.target.checked }))}
                    />
                    {CHANNEL_ICON[c]}{CHANNEL_FA[c]}
                  </label>
                ))}
              </div>
            </label>
            <label className="field">
              <span className="field-label">عنوان قالب <i className="req">*</i></span>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثلاً: تعهد عقب افتاد" />
            </label>
            <label className="field">
              <span className="field-label">متن قالب</span>
              <input value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="مثلاً: تعهد «{description}» معوق شد." />
            </label>
            <label className="field full">
              <span className="field-label">شرایط (اختیاری) <small className="t-muted">— JSON</small></span>
              <textarea
                dir="ltr" rows={3} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, textAlign: 'left' }}
                value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
                placeholder='{"minRiskChange": 5}'
              />
            </label>
            <label className="field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 'auto' }} />
              <span>قاعده فعال باشد (بلافاصله در موتور اعلان اعمال شود)</span>
            </label>
          </div>
        </form>
      </Modal>
    </main>
  );
}
