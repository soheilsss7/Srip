'use client';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { EntityPicker } from './entity-picker';
import { useWorkspace } from './workspace';

type Field = { name: string; label: string; type?: 'text' | 'number' | 'datetime-local' | 'textarea' | 'select' | 'email'; required?: boolean; entityEndpoint?: string; options?: string[] };
type Entity = { key: string; label: string; endpoint: string; fields: Field[]; permission: string };
type Context = Partial<Record<'organizationId' | 'personId' | 'relationshipId' | 'projectId' | 'meetingId', string>>;

const entities: Entity[] = [
  { key: 'interaction', permission: 'interaction.write', label: 'تعامل', endpoint: '/interactions', fields: [
    { name: 'type', label: 'نوع تعامل', type: 'select', options: ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'MESSAGE', 'OTHER'], required: true },
    { name: 'subject', label: 'موضوع', required: true }, { name: 'summary', label: 'خلاصه', type: 'textarea' },
    { name: 'occurredAt', label: 'زمان', type: 'datetime-local', required: true },
    { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }, { name: 'personId', label: 'شخص', entityEndpoint: '/people' }, { name: 'relationshipId', label: 'رابطه', entityEndpoint: '/relationships' },
  ] },
  { key: 'note', permission: 'entity.write', label: 'یادداشت', endpoint: '/notes', fields: [
    { name: 'title', label: 'عنوان' }, { name: 'body', label: 'متن یادداشت', type: 'textarea', required: true },
    { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }, { name: 'personId', label: 'شخص', entityEndpoint: '/people' },
  ] },
  { key: 'organization', permission: 'org.write', label: 'سازمان', endpoint: '/organizations', fields: [{ name: 'name', label: 'نام', required: true }, { name: 'type', label: 'نوع', type: 'select', options: ['HOLDING', 'SUBSIDIARY', 'CUSTOMER', 'PARTNER', 'BANK', 'GOVERNMENT', 'INVESTOR', 'SUPPLIER', 'OTHER'] }] },
  { key: 'person', permission: 'person.write', label: 'شخص', endpoint: '/people', fields: [{ name: 'firstName', label: 'نام', required: true }, { name: 'lastName', label: 'نام خانوادگی', required: true }, { name: 'organizationId', label: 'سازمان', required: true, entityEndpoint: '/organizations' }, { name: 'email', label: 'ایمیل', type: 'email' }] },
  { key: 'relationship', permission: 'relationship.write', label: 'ارتباط', endpoint: '/relationships', fields: [{ name: 'sourceOrganizationId', label: 'سازمان مبدأ', required: true, entityEndpoint: '/organizations' }, { name: 'targetOrganizationId', label: 'سازمان مقصد', required: true, entityEndpoint: '/organizations' }, { name: 'relationshipType', label: 'نوع ارتباط', required: true }] },
  { key: 'meeting', permission: 'meeting.write', label: 'جلسه', endpoint: '/meetings', fields: [{ name: 'title', label: 'عنوان', required: true }, { name: 'startAt', label: 'شروع', type: 'datetime-local', required: true }, { name: 'endAt', label: 'پایان', type: 'datetime-local' }, { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }, { name: 'relationshipId', label: 'رابطه', entityEndpoint: '/relationships' }, { name: 'objective', label: 'هدف', type: 'textarea' }] },
  { key: 'action', permission: 'action.write', label: 'اقدام', endpoint: '/actions', fields: [{ name: 'title', label: 'عنوان', required: true }, { name: 'dueAt', label: 'موعد', type: 'datetime-local' }, { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }, { name: 'personId', label: 'شخص', entityEndpoint: '/people' }, { name: 'relationshipId', label: 'رابطه', entityEndpoint: '/relationships' }] },
  { key: 'commitment', permission: 'commitment.write', label: 'تعهد', endpoint: '/commitments', fields: [{ name: 'description', label: 'توضیح', required: true }, { name: 'dueAt', label: 'موعد', type: 'datetime-local' }, { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }, { name: 'personId', label: 'شخص', entityEndpoint: '/people' }, { name: 'relationshipId', label: 'رابطه', entityEndpoint: '/relationships' }] },
  { key: 'project', permission: 'project.write', label: 'پروژه', endpoint: '/projects', fields: [{ name: 'name', label: 'نام', required: true }, { name: 'description', label: 'توضیح', type: 'textarea' }, { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }] },
  { key: 'opportunity', permission: 'opportunity.write', label: 'فرصت', endpoint: '/opportunities', fields: [{ name: 'name', label: 'نام', required: true }, { name: 'value', label: 'ارزش', type: 'number' }, { name: 'organizationId', label: 'سازمان', entityEndpoint: '/organizations' }, { name: 'projectId', label: 'پروژه', entityEndpoint: '/projects' }, { name: 'relationshipId', label: 'رابطه', entityEndpoint: '/relationships' }] },
];

function initialValues(entity: Entity, context?: Context) {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  const now = new Date().toISOString().slice(0, 16);
  return Object.fromEntries(entity.fields.map(field => [
    field.name,
    context?.[field.name as keyof Context]
      ?? (field.name === 'type' && entity.key === 'interaction' ? 'NOTE'
        : field.name === 'occurredAt' && entity.key === 'interaction' ? now
          : field.name === 'startAt' && entity.key === 'meeting' ? nextHour : ''),
  ]));
}

export function QuickCreate({ open, onClose, onCreated, context }: { open: boolean; onClose: () => void; onCreated?: () => void; context?: Context }) {
  const { scopeId, can } = useWorkspace();
  const [entity, setEntity] = useState(entities[0]);
  const writable = can(entity.permission);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(entities[0], context));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const availableEntities = entities.filter(item => can(item.permission));

  useEffect(() => {
    const next = availableEntities.find(item => item.key === entity.key) ?? availableEntities[0];
    if (next && next.key !== entity.key) {
      setEntity(next);
      setValues(initialValues(next, context));
      setMessage('');
    }
  }, [availableEntities, context, entity.key]);

  useEffect(() => {
    if (!open) return;
    const contextValues: Record<string, string> = {};
    entity.fields.forEach(field => {
      const value = context?.[field.name as keyof Context];
      if (value) contextValues[field.name] = value;
    });
    setValues(current => ({ ...current, ...contextValues }));
  }, [context, entity, open]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!writable) { setMessage('مجوز ایجاد این نوع رکورد برای شما فعال نیست.'); return; } setBusy(true); setMessage('');
    try {
      const body: Record<string, unknown> = {};
      entity.fields.forEach(field => {
        const value = values[field.name]?.trim?.() ?? values[field.name];
        if (field.required && !value) throw new Error(`فیلد «${field.label}» الزامی است.`);
        if (!value) return;
        if (field.type === 'number') { const number = Number(value); if (!Number.isFinite(number)) throw new Error(`مقدار «${field.label}» معتبر نیست.`); body[field.name] = number; }
        else if (field.type === 'datetime-local') { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error(`زمان «${field.label}» معتبر نیست.`); body[field.name] = date.toISOString(); }
        else body[field.name] = value;
      });
      await api(entity.endpoint, { method: 'POST', body: JSON.stringify(body) });
      setMessage('با موفقیت ایجاد شد.');
      setValues(initialValues(entity, context));
      onCreated?.();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  function selectEntity(next: Entity) { setEntity(next); setValues(initialValues(next, context)); setMessage(''); }

  return <div className="quick-overlay" role="dialog" aria-modal="true" aria-label="ایجاد سریع"><section className="quick-card"><header><div><span className="eyebrow">QUICK ACTION</span><h2>ایجاد سریع</h2></div><button type="button" onClick={onClose} aria-label="بستن">×</button></header><div className="quick-types">{availableEntities.map(item => <button type="button" disabled={busy} className={item.key === entity.key ? 'active' : ''} onClick={() => selectEntity(item)} key={item.key}>{item.label}</button>)}</div>{availableEntities.length===0?<div className="notice">هیچ مجوزی برای ایجاد رکورد در دسترس شما نیست.</div>:!writable?<div className="notice">مجوز ایجاد «{entity.label}» برای شما فعال نیست.</div>:<form className="entity-form" onSubmit={submit}>{entity.fields.map(field => field.entityEndpoint ? <EntityPicker key={field.name} label={field.label} value={values[field.name] ?? ''} onChange={value => setValues({ ...values, [field.name]: value })} endpoint={field.entityEndpoint} required={field.required} disabled={busy} scopeId={scopeId} /> : field.type === 'textarea' ? <label key={field.name}>{field.label}<textarea required={field.required} value={values[field.name] ?? ''} onChange={event => setValues({ ...values, [field.name]: event.target.value })} disabled={busy} /></label> : field.type === 'select' ? <label key={field.name}>{field.label}<select required={field.required} value={values[field.name] ?? ''} onChange={event => setValues({ ...values, [field.name]: event.target.value })} disabled={busy}><option value="">انتخاب کنید</option>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select></label> : <label key={field.name}>{field.label}<input type={field.type ?? 'text'} required={field.required} value={values[field.name] ?? ''} onChange={event => setValues({ ...values, [field.name]: event.target.value })} disabled={busy} /></label>)}<button className="primary-action" disabled={busy}>{busy ? 'در حال ثبت…' : `ایجاد ${entity.label}`}</button></form>}{message && <div className="status-message" role="status">{message}</div>}</section></div>;
}
