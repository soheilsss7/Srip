'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, unwrapList } from '../_lib/api';
import { EntityPicker } from '../_components/entity-picker';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader } from '../_components/page-ui';

type WorkflowAction = { type: string; title?: string; body?: string; description?: string; name?: string; minutes?: number; channel?: string; priority?: string };

const ACTION_TYPES = ['CREATE_NOTIFICATION', 'CREATE_ACTION', 'CREATE_COMMITMENT', 'CREATE_OPPORTUNITY', 'REQUEST_APPROVAL', 'WAIT'];
const ENTITY_ENDPOINTS: Record<string, string> = {
  relationship: '/relationships', meeting: '/meetings', project: '/projects', opportunity: '/opportunities',
  person: '/people', organization: '/organizations', recommendation: '/recommendations',
};
const INITIAL_ACTION: WorkflowAction = { type: 'CREATE_NOTIFICATION', title: 'Workflow notification', body: 'Workflow executed', channel: 'IN_APP', priority: 'MEDIUM' };

function unwrap(value: any) { return unwrapList<any>(value); }
function actionLabel(type: string) { return type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase()); }

export default function Workflows() {
  const { scopeId, can } = useWorkspace();
  const canRead = can('workflow.read');
  const canWrite = can('workflow.write');
  const canExecute = can('workflow.execute');
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('relationship');
  const [isActive, setIsActive] = useState(true);
  const [actions, setActions] = useState<WorkflowAction[]>([INITIAL_ACTION]);
  const [showCreate, setShowCreate] = useState(false);
  const [executionTargets, setExecutionTargets] = useState<Record<string, string>>({});
  const [executionLabels, setExecutionLabels] = useState<Record<string, string>>({});

  async function load() {
    if (!canRead) { setItems([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setItems(unwrap(await api('/workflows'))); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [canRead]);

  function updateAction(index: number, patch: Partial<WorkflowAction>) {
    setActions(current => current.map((action, currentIndex) => currentIndex === index ? { ...action, ...patch } : action));
  }

  async function createWorkflow() {
    if (!canWrite) return;
    if (!name.trim() || actions.length === 0) { setError('نام و حداقل یک action الزامی است.'); return; }
    setBusy('create'); setError(''); setStatus('');
    try {
      await api('/workflows', { method: 'POST', body: JSON.stringify({ name: name.trim(), entityType, isActive, definition: { trigger: { type: 'MANUAL', entityType }, conditions: [], actions } }) });
      setName(''); setActions([INITIAL_ACTION]); setShowCreate(false); setStatus('Workflow ایجاد شد.'); await load();
    } catch (value) { setError((value as Error).message); }
    finally { setBusy(''); }
  }

  async function executeWorkflow(workflow: any) {
    if (!canExecute) return;
    const entityId = executionTargets[workflow.id];
    if (!entityId) { setError('ابتدا رکورد هدف را انتخاب کنید.'); return; }
    setBusy(`run:${workflow.id}`); setError(''); setStatus('');
    try {
      const result: any = await api(`/workflows/${workflow.id}/execute`, { method: 'POST', body: JSON.stringify({ entityType: workflow.entityType, entityId, context: {}, triggerType: 'MANUAL' }) });
      setStatus(`اجرا پایان یافت: ${result?.status ?? 'تکمیل شد'}`);
    } catch (value) { setError((value as Error).message); }
    finally { setBusy(''); }
  }

  const actionCount = useMemo(() => actions.length, [actions]);
  if (!canRead) return <main className="feature-page"><PageHeader eyebrow="WORKFLOW AUTOMATION" title="Workflows" description="Workflowهای قابل اجرا با trigger، action و مجوزهای Backend."/><section className="panel"><p className="empty-state">مجوز مشاهده workflow برای شما فعال نیست.</p></section></main>;
  return <main className="feature-page">
    <PageHeader eyebrow="WORKFLOW AUTOMATION" title="Workflows" description="Workflowهای قابل اجرا با trigger، action و مجوزهای Backend. رکوردهای هدف با جست‌وجوی نام انتخاب می‌شوند." actions={canWrite&&<button className="primary-action" onClick={() => setShowCreate(value => !value)}>{showCreate ? 'بستن' : '+ Workflow جدید'}</button>} />
    <ErrorCard message={error} />
    {status && <div className="notice" role="status">{status}</div>}
    {loading ? <Loading /> : <>
      {canWrite&&showCreate && <section className="panel">
        <div className="panel-title"><div><h2>ساخت Workflow</h2><p>به‌جای JSON خام، مراحل workflow را به‌صورت فرم قابل اعتبارسنجی تعریف کنید.</p></div></div>
        <div className="form-grid">
          <label className="full">نام Workflow<input value={name} onChange={event => setName(event.target.value)} placeholder="مثلاً پیگیری رابطه پرریسک" required /></label>
          <label>نوع رکورد<select value={entityType} onChange={event => setEntityType(event.target.value)}>{Object.keys(ENTITY_ENDPOINTS).map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="checkbox-field">فعال<input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} /></label>
        </div>
        <div className="panel-title"><div><h3>مراحل اجرا</h3><p>{actionCount} action؛ ترتیب اجرا از بالا به پایین است.</p></div><button className="secondary-action" onClick={() => setActions(current => [...current, { ...INITIAL_ACTION }])}>افزودن action</button></div>
        <div className="list">{actions.map((action, index) => <article className="panel compact" key={index}>
          <div className="toolbar"><strong>مرحله {index + 1}</strong><select value={action.type} onChange={event => updateAction(index, { type: event.target.value })} aria-label={`نوع action ${index + 1}`}>{ACTION_TYPES.map(type => <option key={type} value={type}>{actionLabel(type)}</option>)}</select>{actions.length > 1 && <button className="danger-action" onClick={() => setActions(current => current.filter((_, currentIndex) => currentIndex !== index))}>حذف</button>}</div>
          {action.type === 'WAIT' ? <label>مدت انتظار به دقیقه<input type="number" min="1" value={action.minutes ?? 1} onChange={event => updateAction(index, { minutes: Number(event.target.value) })} /></label> : <div className="form-grid">
            {(action.type === 'CREATE_NOTIFICATION' || action.type === 'CREATE_ACTION') && <label>عنوان<input value={action.title ?? ''} onChange={event => updateAction(index, { title: event.target.value })} placeholder="عنوان خروجی" /></label>}
            {action.type === 'CREATE_NOTIFICATION' && <label>متن اعلان<input value={action.body ?? ''} onChange={event => updateAction(index, { body: event.target.value })} placeholder="متن اعلان" /></label>}
            {action.type === 'CREATE_COMMITMENT' && <label className="full">شرح تعهد<input value={action.description ?? ''} onChange={event => updateAction(index, { description: event.target.value })} placeholder="تعهد ایجادشده توسط workflow" /></label>}
            {action.type === 'CREATE_OPPORTUNITY' && <label className="full">نام فرصت<input value={action.name ?? ''} onChange={event => updateAction(index, { name: event.target.value })} placeholder="فرصت جدید" /></label>}
            {action.type === 'REQUEST_APPROVAL' && <p className="muted full">این مرحله قبل از ادامه، تأیید صریح کاربر مجاز را درخواست می‌کند.</p>}
          </div>}
        </article>)}</div>
        <button className="primary-action" onClick={() => void createWorkflow()} disabled={busy === 'create'}>{busy === 'create' ? 'در حال ثبت…' : 'ایجاد Workflow'}</button>
      </section>}
      {items.length === 0 ? <div className="panel"><p className="empty-state">Workflowی تعریف نشده است.</p></div> : <div className="list">{items.map(workflow => {
        const targetEndpoint = ENTITY_ENDPOINTS[workflow.entityType] ?? '/relationships';
        const definition = workflow.definition ?? {};
        const workflowActions = Array.isArray(definition.actions) ? definition.actions.length : 0;
        return <article className="panel compact" key={workflow.id}>
          <div className="panel-title"><div><strong>{workflow.name}</strong><small className="muted">{workflow.entityType} · {workflowActions} action · Trigger: {definition.trigger?.type ?? 'MANUAL'}</small></div><Badge tone={workflow.isActive ? 'success' : 'neutral'}>{workflow.isActive ? 'Active' : 'Paused'}</Badge></div>
          {canExecute&&<div className="toolbar workflow-execute-row">
            <EntityPicker label="رکورد هدف" endpoint={targetEndpoint} value={executionTargets[workflow.id] ?? ''} selectedLabel={executionLabels[workflow.id]} onChange={value => setExecutionTargets(current => ({ ...current, [workflow.id]: value }))} onLabelChange={(_, label) => setExecutionLabels(current => ({ ...current, [workflow.id]: label }))} scopeId={scopeId} disabled={Boolean(busy)} required />
            <button className="secondary-action" onClick={() => void executeWorkflow(workflow)} disabled={Boolean(busy) || !workflow.isActive}>{busy === `run:${workflow.id}` ? 'در حال اجرا…' : 'اجرای دستی'}</button>
          </div>}
          {!workflow.isActive && <p className="muted">این workflow غیرفعال است.</p>}
        </article>;
      })}</div>}
    </>}
  </main>;
}
