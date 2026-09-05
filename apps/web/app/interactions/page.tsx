'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Card, Badge } from '@srip/design-system';
import { Modal } from '../_components/page-ui';
import {
  Phone, Mail, Users, StickyNote, MessageSquare, Plus, Search, CalendarDays,
  BellRing, Clock, Building2, User, ListFilter, Activity, ClipboardList,
} from 'lucide-react';
import { JalaliDateField } from '../_components/jalali-date-field';

type Interaction = {
  id: string;
  type: string;
  subject: string;
  summary?: string;
  outcome?: string;
  occurredAt: string;
  followUpRequired: boolean;
  followUpAt?: string;
  importance?: string;
  sentiment?: number;
  organization?: { name: string };
  person?: { firstName: string; lastName: string };
  relationship?: { sourceOrganization?: { name: string }; targetOrganization?: { name: string } };
};

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  CALL: { icon: <Phone size={16}/>, color: 'type-call', label: 'تماس' },
  EMAIL: { icon: <Mail size={16}/>, color: 'type-email', label: 'ایمیل' },
  MEETING: { icon: <Users size={16}/>, color: 'type-meeting', label: 'جلسه' },
  NOTE: { icon: <StickyNote size={16}/>, color: 'type-note', label: 'یادداشت' },
  MESSAGE: { icon: <MessageSquare size={16}/>, color: 'type-message', label: 'پیام' },
};

function TypeDot({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { icon: <Activity size={16}/>, color: 'type-other', label: type };
  return <span className={`type-dot ${meta.color}`}>{meta.icon}</span>;
}

export default function InteractionsPage() {
  const { can } = useWorkspace();
  const writable = can('interaction.write');

  const [items, setItems] = useState<Interaction[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState(false);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [form, setForm] = useState({
    type: 'NOTE', subject: '', summary: '',
    occurredAt: new Date().toISOString().slice(0, 16),
    followUpRequired: false, followUpAt: '',
    organizationId: '', personId: '', relationshipId: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    return api<Interaction[]>(`/interactions?followUpOnly=${followUps}`)
      .then(x => setItems(Array.isArray(x) ? x as Interaction[] : (x as any).items ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [followUps]);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/interactions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          occurredAt: new Date(form.occurredAt).toISOString(),
          followUpAt: form.followUpRequired && form.followUpAt ? new Date(form.followUpAt).toISOString() : undefined,
          organizationId: form.organizationId || undefined,
          personId: form.personId || undefined,
          relationshipId: form.relationshipId || undefined,
        }),
      });
      setForm({ ...form, subject: '', summary: '', followUpAt: '' });
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const total = items.length;
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = items.filter(i => new Date(i.occurredAt).getTime() >= weekAgo).length;
    const follow = items.filter(i => i.followUpRequired).length;
    const upcoming = items.filter(i => i.followUpRequired && i.followUpAt && new Date(i.followUpAt).getTime() > Date.now()).length;
    return { total, thisWeek, follow, upcoming };
  }, [items]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter && i.type !== typeFilter) return false;
      if (term && !`${i.subject} ${i.summary ?? ''} ${i.organization?.name ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, q, typeFilter]);

  const typesPresent = [...new Set(items.map(i => i.type))];

  const timeline = useMemo(() => {
    const groups = new Map<string, Interaction[]>();
    for (const i of visible) {
      const key = new Date(i.occurredAt).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    }
    return [...groups.entries()].sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [visible]);

  return (
    <>
    <div className="interactions-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">فضای کاری SRIP · خط زمانی تعاملات</div>
          <h1>تعاملات</h1>
          <p className="subtitle">تماس‌ها، ایمیل‌ها، جلسات، یادداشت‌ها و پیگیری‌ها در یک خط زمانی یکپارچه — از سرور واقعی.</p>
        </div>
        <div className="heading-tools">
          {writable && <button type="button" className="primary-action" onClick={()=>{setError('');setCreateOpen(true)}}><Plus size={14}/> ثبت تعامل</button>}
        </div>
      </section>

      {error && <div className="error-card" role="alert">{error}</div>}

      <section className="stats-row">
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-blue"><Activity size={18}/></span><span className="st-name">کل تعاملات</span></div>
          <strong className="st-value">{counts.total}</strong>
          <div className="st-foot"><span className="st-delta up">{counts.thisWeek} در ۷ روز اخیر</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-gold"><CalendarDays size={18}/></span><span className="st-name">این هفته</span></div>
          <strong className="st-value">{counts.thisWeek}</strong>
          <div className="st-foot"><span className="st-delta">طی ۷ روز</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-red"><BellRing size={18}/></span><span className="st-name">نیازمند پیگیری</span></div>
          <strong className="st-value">{counts.follow}</strong>
          <div className="st-foot"><span className="st-delta down">{counts.upcoming} آتی</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-purple"><ClipboardList size={18}/></span><span className="st-name">انواع</span></div>
          <strong className="st-value">{typesPresent.length}</strong>
          <div className="st-foot"><span className="st-delta">{typesPresent.map(t=>TYPE_META[t]?.label??t).join(' · ') || '—'}</span></div>
        </div>
      </section>

      <div className="interactions-layout">
        <Card className="interactions-feed">
          <div className="panel-title">
            <div><h2>خط زمانی</h2><p>جدیدترین‌ها در بالا</p></div>
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15}/>
                <input placeholder="جستجوی موضوع، خلاصه یا سازمان…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select aria-label="فیلتر نوع" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">همه انواع</option>
                {typesPresent.map((t) => <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>)}
              </select>
            </div>
            <div className="seg-btn">
              <button className={!followUps ? 'active' : ''} onClick={() => setFollowUps(false)}>همه</button>
              <button className={followUps ? 'warning active' : ''} onClick={() => setFollowUps(true)}>پیگیری‌ها</button>
            </div>
          </div>

          {loading ? (
            <div className="loading-row"><span className="spinner" /> در حال بارگذاری…</div>
          ) : timeline.length ? (
            <div className="interaction-timeline">
              {timeline.map(([day, list]) => (
                <div className="timeline-day" key={day}>
                  <div className="timeline-dayhead"><span>{dayLabel(day)}</span><b>{list.length}</b></div>
                  <div className="timeline-items">
                    {list.map((i) => {
                      const meta = TYPE_META[i.type] ?? { label: fa(i.type), color: 'type-other' };
                      return (
                        <article className={`timeline-item ${i.followUpRequired ? 'has-follow' : ''}`} key={i.id}>
                          <TypeDot type={i.type} />
                          <div className="ti-body">
                            <div className="ti-head">
                              <span className="ti-type">{meta.label}</span>
                              <span className="ti-time"><Clock size={12}/>{timeLabel(i.occurredAt)}</span>
                              {i.importance && i.importance !== 'MEDIUM' && <Badge className={i.importance === 'CRITICAL' || i.importance === 'HIGH' ? 'danger' : 'warning'}>{fa(i.importance)}</Badge>}
                            </div>
                            <Link className="ti-subject" href={`/interactions/${i.id}`}>{i.subject}</Link>
                            {i.summary ? <p className="ti-summary">{i.summary}</p> : null}
                            <div className="ti-meta">
                              {i.organization?.name ? <span><Building2 size={12}/>{i.organization.name}</span> : null}
                              {i.person ? <span><User size={12}/>{i.person.firstName} {i.person.lastName}</span> : null}
                              {i.relationship?.sourceOrganization?.name && i.relationship?.targetOrganization?.name
                                ? <span className="ti-rel"><Activity size={12}/>{i.relationship.sourceOrganization.name} ↔ {i.relationship.targetOrganization.name}</span>
                                : null}
                            </div>
                            {i.followUpRequired && (
                              <div className="ti-followup">
                                <BellRing size={12}/>
                                <span>پیگیری {i.followUpAt ? `در ${dateTimeLabel(i.followUpAt)}` : 'لازم'}</span>
                                {i.followUpAt && new Date(i.followUpAt).getTime() < Date.now() ? <Badge className="danger">سررسید گذشته</Badge> : null}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-people">
              <Activity size={28}/>
              <p>{followUps ? 'پیگیری‌ای ثبت نشده است.' : 'تعاملی ثبت نشده است.'}</p>
            </div>
          )}
        </Card>


      </div>
    </div>
    {/* Create modal */}
    <Modal open={createOpen} title="ثبت تعامل" description="تماس، ایمیل، جلسه یا یادداشت — تعامل در تایم‌لاین شما ثبت می‌شود." onClose={() => setCreateOpen(false)}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
        <button type="submit" form="interaction-create-form" className="srip-button primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ثبت تعامل'}</button>
      </>}>
      <form id="interaction-create-form" className="entity-form" onSubmit={create}>
        <div className="field full"><label className="field-label">نوع</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.keys(TYPE_META).map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </div>
        <div className="field full"><label className="field-label">موضوع <span className="req">*</span></label><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div className="field full"><label className="field-label">زمان</label><JalaliDateField withTime value={form.occurredAt} onChange={(v) => setForm({ ...form, occurredAt: v })} /></div>
        <div className="field full"><label className="field-label">خلاصه</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
        <div className="field"><label className="field-label">سازمان</label><input value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} placeholder="شناسه سازمان (اختیاری)" /></div>
        <div className="field"><label className="field-label">شخص</label><input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })} placeholder="شناسه شخص (اختیاری)" /></div>
        <div className="field full check-line">
          <input type="checkbox" checked={form.followUpRequired} onChange={(e) => setForm({ ...form, followUpRequired: e.target.checked })} />
          نیازمند پیگیری
        </div>
        {form.followUpRequired && (
          <div className="field full"><label className="field-label">موعد پیگیری</label><JalaliDateField withTime value={form.followUpAt} onChange={(v) => setForm({ ...form, followUpAt: v })} /></div>
        )}
      </form>
    </Modal>
    </>
  );
}
function dayLabel(day: string): string {
  const d = new Date(day);
  const today = new Date().toDateString();
  const yest = new Date(Date.now() - 86400000).toDateString();
  if (day === today) return 'امروز';
  if (day === yest) return 'دیروز';
  return d.toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) + ' — ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
