'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, unwrapList } from '../_lib/api';
import { Badge, Empty, ErrorCard, Loading, PageHeader } from '../_components/page-ui';
import { EntityPicker } from '../_components/entity-picker';
import { useWorkspace } from '../_components/workspace';

type Meeting = { id: string; title: string; startAt: string; endAt?: string; objective?: string; agenda?: string; outcome?: string; location?: string; status?: string; organization?: { name?: string }; relationship?: { sourceOrganization?: { name?: string }; targetOrganization?: { name?: string } }; participants?: { person?: { firstName?: string; lastName?: string; displayName?: string } }[]; actions?: any[]; commitments?: any[] };

type MeetingForm = { title: string; startAt: string; endAt: string; objective: string; agenda: string; location: string; meetingUrl: string; organizationId: string; relationshipId: string };

const initialForm = (): MeetingForm => ({ title: '', startAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16), endAt: '', objective: '', agenda: '', location: '', meetingUrl: '', organizationId: '', relationshipId: '' });
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function MeetingsPage() {
  const { scopeId } = useWorkspace();
  const [items, setItems] = useState<Meeting[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upcoming, setUpcoming] = useState(false);
  const [form, setForm] = useState<MeetingForm>(initialForm);
  const [participantId, setParticipantId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantLabels, setParticipantLabels] = useState<Record<string, string>>({});
  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ upcoming: String(upcoming), page: '1', pageSize: '50' });
      if (scopeId !== 'all') query.set('organizationId', scopeId);
      setItems(unwrapList<Meeting>(await api(`/meetings?${query.toString()}`)));
    } catch (value) { setError((value as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [upcoming, scopeId]);

  function addParticipant() {
    if (participantId && !participantIds.includes(participantId)) setParticipantIds(current => [...current, participantId]);
    setParticipantId('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api('/meetings', { method: 'POST', body: JSON.stringify({ ...form, startAt: new Date(form.startAt).toISOString(), endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined, organizationId: form.organizationId || undefined, relationshipId: form.relationshipId || undefined, participantPersonIds: participantIds }) });
      setForm(initialForm()); setParticipantIds([]); setParticipantLabels({}); await load();
    } catch (value) { setError((value as Error).message); } finally { setSaving(false); }
  }
  async function outcome(id: string) {
    const value = (outcomeDrafts[id] ?? '').trim(); if (!value) return;
    setSaving(true); setError('');
    try { await api(`/meetings/${id}/outcome`, { method: 'POST', body: JSON.stringify({ outcome: value }) }); setOutcomeDrafts(current => ({ ...current, [id]: '' })); await load(); }
    catch (reason) { setError((reason as Error).message); } finally { setSaving(false); }
  }

  return <main className="feature-page">
    <PageHeader eyebrow="MEETINGS" title="جلسات" description="جلسه را برنامه‌ریزی کنید، context واقعی به آن بدهید و خروجی را به اقدام و تعهد تبدیل کنید." actions={<Link className="secondary-action" href="/today">مرکز عملیات امروز</Link>} />
    <ErrorCard message={error} />
    <section className="panel meeting-schedule-panel"><div className="panel-title"><div><h2>برنامه‌ریزی جلسه</h2><p>سازمان، رابطه و شرکت‌کنندگان را با نام انتخاب کنید؛ شناسه فنی لازم نیست.</p></div><Badge tone="info">متصل به API</Badge></div><form onSubmit={submit} className="entity-form"><div className="form-grid"><label>عنوان جلسه<input required minLength={2} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>شروع<input required type="datetime-local" value={form.startAt} onChange={event => setForm({ ...form, startAt: event.target.value })} /></label><label>پایان<input type="datetime-local" value={form.endAt} onChange={event => setForm({ ...form, endAt: event.target.value })} /></label><EntityPicker label="سازمان" endpoint="/organizations" value={form.organizationId} onChange={organizationId => setForm({ ...form, organizationId })} scopeId={scopeId} /><EntityPicker label="رابطه" endpoint="/relationships" value={form.relationshipId} onChange={relationshipId => setForm({ ...form, relationshipId })} scopeId={scopeId} /><label>مکان<input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></label><label>لینک جلسه<input type="url" value={form.meetingUrl} onChange={event => setForm({ ...form, meetingUrl: event.target.value })} /></label></div><div className="meeting-participants"><EntityPicker label="شرکت‌کننده" endpoint="/people" value={participantId} onChange={setParticipantId} onLabelChange={(id, label) => setParticipantLabels(current => ({ ...current, [id]: label }))} scopeId={scopeId} /><button type="button" className="secondary-action" onClick={addParticipant} disabled={!participantId}>افزودن</button>{participantIds.length > 0 && <div className="chip-row">{participantIds.map(id => <span className="chip" key={id}>{participantLabels[id] || 'شرکت‌کننده انتخاب‌شده'} <button type="button" onClick={() => setParticipantIds(current => current.filter(item => item !== id))} aria-label="حذف شرکت‌کننده">×</button></span>)}</div>}</div><label>هدف جلسه<textarea value={form.objective} onChange={event => setForm({ ...form, objective: event.target.value })} /></label><label>دستور جلسه<textarea value={form.agenda} onChange={event => setForm({ ...form, agenda: event.target.value })} /></label><button className="primary-action" disabled={saving}>{saving ? 'در حال ذخیره…' : 'برنامه‌ریزی جلسه'}</button></form></section>
    <section className="panel"><div className="panel-title"><div><h2>{upcoming ? 'جلسات پیش‌رو' : 'همه جلسات'}</h2><p>{items.length} جلسه</p></div><div className="toolbar"><button className={upcoming ? 'secondary-action' : 'primary-action'} onClick={() => setUpcoming(false)}>همه</button><button className={upcoming ? 'primary-action' : 'secondary-action'} onClick={() => setUpcoming(true)}>پیش‌رو</button></div></div>{loading ? <Loading /> : items.length === 0 ? <Empty>جلسه‌ای برای نمایش وجود ندارد.</Empty> : <div className="meeting-cards">{items.map(meeting => <article className="meeting-card" key={meeting.id}><div className="meeting-card-top"><Badge tone={meeting.status === 'COMPLETED' ? 'success' : 'info'}>{meeting.status ?? 'SCHEDULED'}</Badge><small>{dateLabel(meeting.startAt)}</small></div><h3><Link href={`/meetings/${meeting.id}`}>{meeting.title}</Link></h3><p>{meeting.objective || 'هدف جلسه ثبت نشده است.'}</p><small>{meeting.organization?.name || 'بدون سازمان'}{meeting.relationship?.sourceOrganization?.name && meeting.relationship?.targetOrganization?.name ? ` · ${meeting.relationship.sourceOrganization.name} ↔ ${meeting.relationship.targetOrganization.name}` : ''}</small><div className="meeting-card-stats"><span>شرکت‌کننده {(meeting.participants ?? []).length}</span><span>اقدام {(meeting.actions ?? []).length}</span><span>تعهد {(meeting.commitments ?? []).length}</span></div>{meeting.agenda && <details><summary>دستور جلسه</summary><p>{meeting.agenda}</p></details>}{meeting.outcome && <p className="meeting-outcome"><strong>خروجی:</strong> {meeting.outcome}</p>}<div className="inline-form"><input className="inline-input" placeholder="ثبت خروجی کوتاه" value={outcomeDrafts[meeting.id] ?? ''} onChange={event => setOutcomeDrafts({ ...outcomeDrafts, [meeting.id]: event.target.value })} /><button className="secondary-action" onClick={() => outcome(meeting.id)} disabled={saving}>ثبت</button></div></article>)}</div>}</section>
  </main>;
}
