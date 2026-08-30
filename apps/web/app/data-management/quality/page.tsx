'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import { Badge, Empty, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';

type Issue = { kind: string; entity?: string; label: string; href?: string; detail?: string };
type DuplicateGroup = { ids?: string[]; reasons?: string[]; records?: Array<{ id: string; name?: string; type?: string }> };

function unwrap(value: any) { return value?.metrics ?? value ?? {}; }
function targetName(value: any, fallback: string) {
  return value?.name || value?.title || value?.displayName || fallback;
}
function entityHref(type: string | undefined, id: string | undefined) {
  if (!id) return undefined;
  const key = String(type ?? '').toLowerCase();
  return key === 'organization' ? `/organizations/${id}` : key === 'person' ? `/people/${id}` : key === 'relationship' ? `/relationships/${id}` : key === 'meeting' ? `/meetings/${id}` : key === 'action' ? `/actions/${id}` : undefined;
}

export default function DataQuality() {
  const { scopeId, can } = useWorkspace();
  const canRead = can('data.quality.read');
  const canExecute = can('data.quality.execute');
  const [data, setData] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [mergePreview, setMergePreview] = useState<any>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const load = useCallback(async () => {
    if (!canRead) { setData(null); setDuplicates([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const query = scopeId !== 'all' ? `?organizationId=${encodeURIComponent(scopeId)}` : '';
      // Quality metrics honor the selected organization. Duplicate candidates are
      // tenant-scoped by Backend authorization and must remain cross-organization
      // so two separate organization records can actually be compared.
      const [quality, duplicateReport] = await Promise.all([api(`/data/quality${query}`), api('/data/duplicates')]);
      setData(quality);
      const groups = (duplicateReport as any)?.duplicateOrganizations ?? (duplicateReport as any)?.metrics?.duplicateOrganizations ?? [];
      setDuplicates(Array.isArray(groups) ? groups : []);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }, [scopeId, canRead]);
  useEffect(() => { void load(); }, [load]);

  async function previewMerge(primaryId: string, duplicateId: string) {
    if (!canExecute) return;
    setBusy(true); setError(''); setStatus(''); setConfirmation('');
    try {
      setMergePreview(await api('/data/duplicates/merge-preview', { method: 'POST', body: JSON.stringify({ entityType: 'ORGANIZATION', primaryId, duplicateId }) }));
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  }

  async function mergeConfirmed() {
    if (!canExecute || !mergePreview?.primary?.id || !mergePreview?.duplicate?.id) return;
    if (confirmation !== 'MERGE') { setError('برای ادغام واقعی، عبارت MERGE را دقیقاً وارد کنید.'); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      await api('/data/duplicates/merge', { method: 'POST', body: JSON.stringify({ entityType: mergePreview.entityType, primaryId: mergePreview.primary.id, duplicateId: mergePreview.duplicate.id, confirmation }) });
      setMergePreview(null); setConfirmation(''); setStatus('ادغام با موفقیت انجام شد؛ رکورد تکراری آرشیو شد.'); await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  }

  async function scan() {
    if (!canExecute) return;
    setBusy(true); setError('');
    try {
      await api('/data/quality/scan', { method: 'POST', body: JSON.stringify(scopeId !== 'all' ? { organizationId: scopeId } : {}) });
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  }

  const metrics = unwrap(data);
  const number = (value: any) => typeof value === 'number' ? value : Number(value?.total ?? 0);
  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = [];
    (metrics.missingOwners?.values ?? []).forEach((item: any) => out.push({ kind: 'Missing owner', label: targetName(item, 'سازمان بدون مالک'), href: entityHref('organization', item?.id) }));
    (metrics.missingContacts?.organizations?.values ?? []).forEach((item: any) => out.push({ kind: 'Missing organization contact', label: targetName(item, 'سازمان بدون تماس'), href: entityHref('organization', item?.id) }));
    (metrics.missingContacts?.people?.values ?? []).forEach((item: any) => out.push({ kind: 'Missing person contact', label: targetName(item, 'شخص بدون تماس'), href: entityHref('person', item?.id) }));
    (metrics.staleRelationships?.values ?? []).forEach((item: any) => out.push({ kind: 'Stale relationship', label: `${targetName(item.sourceOrganization, 'سازمان مبدأ')} ↔ ${targetName(item.targetOrganization, 'سازمان مقصد')}`, href: entityHref('relationship', item?.id), detail: item.nextReviewAt ? `بازبینی تا ${new Date(item.nextReviewAt).toLocaleDateString('fa-IR')}` : 'تاریخ بازبینی ثبت نشده است' }));
    (metrics.invalidEmails?.values ?? []).forEach((item: any) => out.push({ kind: 'Invalid email', entity: item.entityType, label: targetName(item, 'رکورد دارای ایمیل نامعتبر'), href: entityHref(item.entityType, item?.id) }));
    (metrics.missingDates?.meetings?.values ?? []).forEach((item: any) => out.push({ kind: 'Missing meeting date', label: targetName(item, 'جلسه بدون زمان'), href: entityHref('meeting', item?.id) }));
    (metrics.missingDates?.actions?.values ?? []).forEach((item: any) => out.push({ kind: 'Missing action date', label: targetName(item, 'اقدام بدون موعد'), href: entityHref('action', item?.id) }));
    (metrics.missingDates?.relationships?.values ?? []).forEach((item: any) => out.push({ kind: 'Missing review date', label: `${targetName(item.sourceOrganization, 'سازمان مبدأ')} ↔ ${targetName(item.targetOrganization, 'سازمان مقصد')}`, href: entityHref('relationship', item?.id) }));
    return out;
  }, [metrics]);

  const cards = [
    ['Duplicate candidates', duplicates.length], ['Missing owners', number(metrics.missingOwners)], ['Missing contacts', number(metrics.missingContacts?.organizations) + number(metrics.missingContacts?.people)], ['Stale relationships', number(metrics.staleRelationships)], ['Invalid emails', number(metrics.invalidEmails)], ['Incomplete profiles', number(metrics.incompleteProfiles?.organizations) + number(metrics.incompleteProfiles?.people)],
  ];

  if (!canRead) return <main className="feature-page"><PageHeader eyebrow="DATA QUALITY" title="کیفیت داده" description="پایش کیفیت، موارد قابل اقدام و حل تکراری‌ها."/><section className="panel"><Empty>مجوز مشاهده کیفیت داده برای شما فعال نیست.</Empty></section></main>;

  return <main className="feature-page">
    <PageHeader eyebrow="DATA MANAGEMENT" title="کیفیت داده" description="مسائل قابل اقدام داده را در محدوده سازمانی انتخاب‌شده بررسی کنید؛ رکوردها با نام نمایش داده می‌شوند و برای اصلاح به پرونده مربوط deep-link دارند." actions={canExecute ? <button className="primary-action" disabled={busy || loading} onClick={scan}>{busy ? 'در حال اسکن…' : 'Quality Scan'}</button> : undefined} />
    <ErrorCard message={error} />
    {status && <div className="notice" role="status">{status}</div>}
    {loading && !data ? <Loading /> : <>
      <section className="kpi-grid" aria-label="Quality metrics">{cards.map(([label, value]) => <div className="kpi-card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className="panel"><div className="panel-title"><div><h2>موارد قابل اقدام</h2><p>{issues.length} مورد در محدوده فعلی</p></div><button className="secondary-action" onClick={load} disabled={loading || busy}>بازخوانی</button></div>{issues.length === 0 ? <Empty>هیچ مورد کیفیتی یافت نشد.</Empty> : <div className="action-list">{issues.map((issue, index) => <article className="panel compact" key={`${issue.kind}-${issue.href ?? index}`}><div className="panel-title"><div><Badge tone={issue.kind.includes('Invalid') ? 'danger' : issue.kind.includes('Stale') ? 'warning' : 'info'}>{issue.kind}</Badge><strong>{issue.href ? <Link href={issue.href}>{issue.label}</Link> : issue.label}</strong>{issue.entity && <small className="muted">{issue.entity}</small>}</div>{issue.detail && <small className="muted">{issue.detail}</small>}</div></article>)}</div>}</section>
      <section className="panel"><div className="panel-title"><div><h2>Duplicate resolution preview</h2><p>گروه‌های مشکوک در محدوده مجاز کاربر برای بررسی انسانی؛ هیچ merge بدون تأیید انجام نمی‌شود.</p></div><Badge tone="warning">{duplicates.length} گروه</Badge></div>{duplicates.length === 0 ? <Empty>گروه تکراری‌ای یافت نشد.</Empty> : <div className="action-list">{duplicates.map((group, index) => { const records = group.records ?? []; const primary = records[0]; const duplicate = records[1]; return <article className="panel compact" key={index}><div className="panel-title"><strong>گروه {index + 1}</strong><Badge tone="warning">{(group.reasons ?? []).join(' · ') || 'شباهت بالا'}</Badge></div><div className="chip-row">{records.map(record => <span className="chip" key={record.id}>{record.name || 'رکورد بدون نام'}</span>)}{!records.length && <span className="muted">رکوردهای این گروه برای بررسی در Backend نگهداری شده‌اند.</span>}</div>{canExecute&&primary && duplicate && <button className="secondary-action" onClick={() => previewMerge(primary.id, duplicate.id)} disabled={busy}>پیش‌نمایش ادغام: نگه‌داشتن «{primary.name}»</button>}</article>; })}</div>}{mergePreview && <article className="panel compact"><div className="panel-title"><div><h3>Merge preview</h3><p>{mergePreview.primary?.name} ← {mergePreview.duplicate?.name}</p></div><Badge tone="warning">بدون تغییر در داده</Badge></div><p className="muted">این فقط پیش‌نمایش است و هنوز هیچ رکوردی تغییر نکرده است.</p><ul>{(mergePreview.proposedChanges ?? []).map((change: string) => <li key={change}>{change}</li>)}</ul><div className="form-grid"><label className="full">برای اجرای تراکنش و آرشیو رکورد تکراری، عبارت MERGE را وارد کنید<input value={confirmation} onChange={event => setConfirmation(event.target.value.toUpperCase())} placeholder="MERGE" autoComplete="off" /></label><div className="toolbar"><button className="danger-action" onClick={() => void mergeConfirmed()} disabled={busy || confirmation !== 'MERGE'}>{busy ? 'در حال ادغام…' : 'اجرای ادغام واقعی'}</button><button className="secondary-action" onClick={() => { setMergePreview(null); setConfirmation(''); }}>بستن</button></div></div></article>}</section>
      <section className="panel"><h2>Coverage</h2><div className="metric-list">{Object.entries(metrics.coverage ?? {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div></section>
    </>}
  </main>;
}
