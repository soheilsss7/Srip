'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, unwrapList } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, Empty, ErrorCard, Loading, PageHeader } from '../_components/page-ui';

type FollowUp = { id: string; title?: string; description?: string; status?: string; priority?: string; dueAt?: string; organization?: { name?: string }; relationship?: { id?: string; sourceOrganization?: { name?: string }; targetOrganization?: { name?: string } }; person?: { displayName?: string; firstName?: string; lastName?: string }; };
type Meeting = { id: string; title: string; startAt: string; organization?: { name?: string } };

const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : 'بدون موعد';
const itemLabel = (item: FollowUp) => item.title || item.description || 'مورد پیگیری';
const personLabel = (person?: FollowUp['person']) => person ? person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim() : '';

function FollowUpList({ title, items, tone, entity }: { title: string; items: FollowUp[]; tone: 'danger' | 'warning' | 'info'; entity: 'actions' | 'commitments' }) {
  return <section className="panel today-list"><div className="panel-title"><div><h2>{title}</h2><p>{items.length} مورد</p></div><Badge tone={tone}>{items.length}</Badge></div>{items.length ? <div className="today-items">{items.map(item => <Link href={item.id ? `/${entity}/${item.id}` : `/${entity}`} className="today-item" key={item.id}><span className={`today-item-dot ${tone}`} /><span className="today-item-main"><strong>{itemLabel(item)}</strong><small>{[item.organization?.name, personLabel(item.person), item.relationship?.sourceOrganization?.name && item.relationship?.targetOrganization?.name ? `${item.relationship.sourceOrganization.name} ↔ ${item.relationship.targetOrganization.name}` : ''].filter(Boolean).join(' · ') || 'بدون context'}</small></span><span className="today-item-meta"><Badge tone={item.priority === 'CRITICAL' ? 'danger' : 'neutral'}>{item.priority || item.status || 'OPEN'}</Badge><small>{dateLabel(item.dueAt)}</small></span></Link>)}</div> : <Empty>موردی در این بخش وجود ندارد.</Empty>}</section>;
}

export default function TodayPage() {
  const { can, scopeId } = useWorkspace();
  const [overdueActions, setOverdueActions] = useState<FollowUp[]>([]);
  const [dueActions, setDueActions] = useState<FollowUp[]>([]);
  const [overdueCommitments, setOverdueCommitments] = useState<FollowUp[]>([]);
  const [dueCommitments, setDueCommitments] = useState<FollowUp[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const scopeQuery = scopeId !== 'all' ? `&organizationId=${encodeURIComponent(scopeId)}` : '';
      const [actionsOverdue, actionsDue, commitmentsOverdue, commitmentsDue, upcoming] = await Promise.all([
        can('action.read') ? api<any>(`/actions/follow-up/overdue?page=1&pageSize=50${scopeQuery}`) : Promise.resolve([]),
        can('action.read') ? api<any>(`/actions/follow-up/due-soon?days=7&page=1&pageSize=50${scopeQuery}`) : Promise.resolve([]),
        can('commitment.read') ? api<any>(`/commitments/follow-up/overdue?page=1&pageSize=50${scopeQuery}`) : Promise.resolve([]),
        can('commitment.read') ? api<any>(`/commitments/follow-up/due-soon?days=7&page=1&pageSize=50${scopeQuery}`) : Promise.resolve([]),
        can('meeting.read') ? api<any>(`/meetings?upcoming=true&page=1&pageSize=10${scopeQuery}`) : Promise.resolve([]),
      ]);
      setOverdueActions(unwrapList<FollowUp>(actionsOverdue));
      setDueActions(unwrapList<FollowUp>(actionsDue));
      setOverdueCommitments(unwrapList<FollowUp>(commitmentsOverdue));
      setDueCommitments(unwrapList<FollowUp>(commitmentsDue));
      setMeetings(unwrapList<Meeting>(upcoming));
    } catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  }, [can, scopeId]);

  useEffect(() => { void load(); }, [load]);
  const totalOpen = useMemo(() => overdueActions.length + dueActions.length + overdueCommitments.length + dueCommitments.length, [overdueActions, dueActions, overdueCommitments, dueCommitments]);

  return <main className="feature-page today-page">
    <PageHeader eyebrow="DAILY OPERATIONS" title="مرکز عملیات امروز" description="یک صف عملیاتی برای پیگیری‌های عقب‌افتاده، موعدهای نزدیک و جلسه‌های پیش‌رو؛ همه از API واقعی و بر اساس Scope شما." actions={<button className="secondary-action" onClick={load} disabled={loading}>بازخوانی</button>} />
    <ErrorCard message={error} />
    {loading ? <Loading label="در حال جمع‌آوری کارهای امروز…" /> : <>
      <section className="today-kpis"><div className="today-kpi danger"><span>عقب‌افتاده</span><strong>{overdueActions.length + overdueCommitments.length}</strong><small>اقدام و تعهد</small></div><div className="today-kpi warning"><span>۷ روز آینده</span><strong>{dueActions.length + dueCommitments.length}</strong><small>نیازمند برنامه‌ریزی</small></div><div className="today-kpi info"><span>جلسه‌های پیش‌رو</span><strong>{meetings.length}</strong><small>برنامه‌ریزی‌شده</small></div><div className="today-kpi neutral"><span>کل صف پیگیری</span><strong>{totalOpen}</strong><small><Link href="/actions">مشاهده همه</Link></small></div></section>
      <section className="today-grid"><div className="today-column"><FollowUpList title="اقدامات عقب‌افتاده" items={overdueActions} tone="danger" entity="actions" /><FollowUpList title="تعهدات عقب‌افتاده" items={overdueCommitments} tone="danger" entity="commitments" /></div><div className="today-column"><FollowUpList title="اقدامات با موعد نزدیک" items={dueActions} tone="warning" entity="actions" /><FollowUpList title="تعهدات با موعد نزدیک" items={dueCommitments} tone="warning" entity="commitments" /></div><section className="panel today-list"><div className="panel-title"><div><h2>جلسه‌های پیش‌رو</h2><p>برای آماده‌سازی Brief انتخاب کنید</p></div><Badge tone="info">{meetings.length}</Badge></div>{meetings.length ? <div className="today-items">{meetings.map(meeting => <Link className="today-item" href={`/meetings/${meeting.id}`} key={meeting.id}><span className="today-item-dot info" /><span className="today-item-main"><strong>{meeting.title}</strong><small>{meeting.organization?.name || 'بدون سازمان'}</small></span><span className="today-item-meta"><small>{dateLabel(meeting.startAt)}</small></span></Link>)}</div> : <Empty>جلسه‌ی پیش‌رویی ثبت نشده است.</Empty>}</section></section>
    </>}
  </main>;
}
