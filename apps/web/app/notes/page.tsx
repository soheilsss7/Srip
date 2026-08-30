'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, unwrapList } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, Empty, ErrorCard, Loading, PageHeader } from '../_components/page-ui';

type Organization = { id: string; name: string; type?: string };
type Person = { id: string; displayName?: string; firstName: string; lastName: string; organizationId?: string; organization?: { name: string } };
type Note = { id: string; title?: string | null; body: string; organizationId?: string | null; personId?: string | null; organization?: Organization; person?: Person; createdBy?: { name?: string; email?: string }; createdAt?: string; updatedAt?: string };

function labelOfPerson(person: Person) {
  return person.displayName || `${person.firstName} ${person.lastName}`;
}

function dateLabel(value?: string) {
  return value ? new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function NotesPage() {
  const { scopeId, can } = useWorkspace();
  const writable = can('entity.write');
  const [notes, setNotes] = useState<Note[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', organizationId: '', personId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(() => notes.find(note => note.id === selectedId) ?? null, [notes, selectedId]);
  const visiblePeople = useMemo(() => {
    if (!form.organizationId) return people;
    return people.filter(person => person.organizationId === form.organizationId);
  }, [form.organizationId, people]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (appliedQuery) params.set('q', appliedQuery);
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      const response = await api<any>(`/notes?${params.toString()}`);
      const rows = unwrapList<Note>(response);
      setNotes(rows);
      setSelectedId(current => current && rows.some(note => note.id === current) ? current : rows[0]?.id ?? null);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, scopeId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<any>('/organizations?pageSize=100'),
      api<any>(scopeId === 'all' ? '/people?pageSize=100' : `/people?organizationId=${encodeURIComponent(scopeId)}&pageSize=100`),
    ]).then(([organizationResponse, peopleResponse]) => {
      if (cancelled) return;
      setOrganizations(unwrapList<Organization>(organizationResponse));
      setPeople(unwrapList<Person>(peopleResponse));
    }).catch(value => { if (!cancelled) setError((value as Error).message); });
    return () => { cancelled = true; };
  }, [scopeId]);

  useEffect(() => {
    if (!selected) return;
    setForm({ title: selected.title ?? '', body: selected.body, organizationId: selected.organizationId ?? '', personId: selected.personId ?? '' });
  }, [selected]);

  function newNote() {
    setSelectedId(null);
    setNotice('');
    setError('');
    setForm({ title: '', body: '', organizationId: scopeId === 'all' ? '' : scopeId, personId: '' });
  }

  function selectOrganization(value: string) {
    setForm(current => ({ ...current, organizationId: value, personId: current.personId && people.some(person => person.id === current.personId && (!value || person.organizationId === value)) ? current.personId : '' }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!writable) return;
    const body = form.body.trim();
    if (!body) { setError('متن یادداشت الزامی است.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = { title: form.title.trim() || undefined, body, organizationId: selected ? (form.organizationId || null) : (form.organizationId || undefined), personId: selected ? (form.personId || null) : (form.personId || undefined) };
      const saved = selected
        ? await api<Note>(`/notes/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<Note>('/notes', { method: 'POST', body: JSON.stringify(payload) });
      setNotice(selected ? 'یادداشت به‌روزرسانی شد.' : 'یادداشت ثبت شد.');
      await load();
      if (saved?.id) setSelectedId(saved.id);
    } catch (value) {
      setError((value as Error).message);
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!selected || !writable || !window.confirm('این یادداشت بایگانی شود؟')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/notes/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
      setNotice('یادداشت بایگانی شد.');
      setSelectedId(null);
      setForm({ title: '', body: '', organizationId: '', personId: '' });
      await load();
    } catch (value) {
      setError((value as Error).message);
    } finally { setSaving(false); }
  }

  return <main className="feature-page notes-page">
    <PageHeader eyebrow="RELATIONSHIP MEMORY" title="یادداشت‌ها" description="یادداشت‌های ساختاریافته برای سازمان، شخص و context شخصی؛ متصل به Timeline و جست‌وجوی واقعی Backend." actions={<div className="toolbar"><button className="secondary-action" onClick={() => { setAppliedQuery(query.trim()); }} disabled={loading}>جستجو</button>{writable && <button className="primary-action" onClick={newNote}>+ یادداشت جدید</button>}</div>} />
    {notice && <div className="notice" role="status">{notice}</div>}
    <ErrorCard message={error} />
    <div className="notes-layout">
      <section className="panel notes-list-panel">
        <div className="panel-title"><div><h2>یادداشت‌های قابل دسترس</h2><p>{notes.length} مورد در این محدوده</p></div><input aria-label="جستجوی یادداشت" placeholder="جست‌وجو در عنوان و متن…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setAppliedQuery(query.trim()); }} /></div>
        {loading ? <Loading /> : notes.length === 0 ? <Empty>یادداشتی برای این محدوده پیدا نشد.</Empty> : <div className="notes-list">{notes.map(note => <button className={`note-list-item ${note.id === selectedId ? 'active' : ''}`} key={note.id} onClick={() => { setSelectedId(note.id); setNotice(''); }}><span className="note-list-top"><strong>{note.title || 'یادداشت بدون عنوان'}</strong><Badge tone={note.person ? 'info' : note.organization ? 'success' : 'neutral'}>{note.person ? 'شخص' : note.organization ? 'سازمان' : 'شخصی'}</Badge></span><span className="note-list-context">{note.person ? labelOfPerson(note.person) : note.organization?.name || 'یادداشت شخصی'}</span><span className="note-list-preview">{note.body}</span><small>{dateLabel(note.updatedAt || note.createdAt)}</small></button>)}</div>}
      </section>
      <section className="panel note-editor-panel">
        <div className="panel-title"><div><h2>{selected ? 'ویرایش یادداشت' : 'یادداشت جدید'}</h2><p>{selected ? `آخرین تغییر: ${dateLabel(selected.updatedAt)}` : 'یادداشت را به یک سازمان یا شخص متصل کنید.'}</p></div>{selected && writable && <button className="danger-action" onClick={remove} disabled={saving}>بایگانی</button>}</div>
        {!writable && <div className="notice">مجوز ثبت یا ویرایش یادداشت برای این کاربر فعال نیست.</div>}
        <form className="entity-form" onSubmit={submit}>
          <label>عنوان<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={200} disabled={!writable || saving} placeholder="مثلاً نکات مذاکره با مدیرعامل" /></label>
          <div className="form-grid"><label>سازمان<select value={form.organizationId} onChange={event => selectOrganization(event.target.value)} disabled={!writable || saving}><option value="">یادداشت شخصی</option>{organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label>شخص مرتبط<select value={form.personId} onChange={event => setForm({ ...form, personId: event.target.value })} disabled={!writable || saving}><option value="">بدون شخص مشخص</option>{visiblePeople.map(person => <option key={person.id} value={person.id}>{labelOfPerson(person)}{person.organization?.name ? ` · ${person.organization.name}` : ''}</option>)}</select></label></div>
          <label>متن یادداشت<textarea value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} minLength={1} maxLength={100000} rows={15} required disabled={!writable || saving} placeholder="مشاهدات، تصمیم‌ها، ریسک‌ها و نکات مهم رابطه…" /></label>
          <div className="toolbar"><button className="primary-action" disabled={!writable || saving}>{saving ? 'در حال ذخیره…' : selected ? 'ذخیره تغییرات' : 'ثبت یادداشت'}</button>{selected && <button className="secondary-action" type="button" onClick={newNote} disabled={saving}>یادداشت جدید</button>}</div>
        </form>
      </section>
    </div>
  </main>;
}
