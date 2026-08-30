'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, PageHeader } from '../_components/page-ui';

function count(value: any) { return typeof value === 'number' ? value : Number(value?.total ?? 0); }
function name(value: any, fallback: string) { return value?.name || value?.title || value?.displayName || fallback; }

export default function DataManagement() {
  const { scopeId } = useWorkspace();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const query = scopeId !== 'all' ? `?organizationId=${encodeURIComponent(scopeId)}` : '';
      setData(await api(`/data/quality${query}`));
    } catch (x) { setError((x as Error).message); }
  }, [scopeId]);
  useEffect(() => { load(); }, [load]);

  const metrics = data?.metrics ?? data ?? {};
  const cards = [
    ['Duplicate candidates', metrics.duplicateOrganizations?.length ?? 0],
    ['Missing owners', count(metrics.missingOwners)],
    ['Stale relationships', count(metrics.staleRelationships)],
    ['Invalid emails', count(metrics.invalidEmails)],
    ['Incomplete profiles', count(metrics.incompleteProfiles?.organizations) + count(metrics.incompleteProfiles?.people)],
  ];
  const issues = [
    ...(metrics.missingOwners?.values ?? []).map((item: any) => ({ kind: 'Missing owner', label: name(item, 'سازمان بدون مالک'), href: item?.id ? `/organizations/${item.id}` : '' })),
    ...(metrics.staleRelationships?.values ?? []).map((item: any) => ({ kind: 'Stale relationship', label: `${name(item.sourceOrganization, 'سازمان مبدأ')} ↔ ${name(item.targetOrganization, 'سازمان مقصد')}`, href: item?.id ? `/relationships/${item.id}` : '' })),
    ...(metrics.invalidEmails?.values ?? []).map((item: any) => ({ kind: 'Invalid email', label: name(item, 'رکورد دارای ایمیل نامعتبر'), href: item?.id ? (item.entityType === 'Person' ? `/people/${item.id}` : `/organizations/${item.id}`) : '' })),
  ];

  return <main className="admin-layout">
    <PageHeader eyebrow="DATA GOVERNANCE" title="Data Management" description="کیفیت داده، Import، Duplicate Detection و Lifecycle در محدوده سازمانی فعلی." actions={<a className="primary-action" href="/data-management/quality">مشاهده Quality Workspace</a>} />
    <ErrorCard message={error} />
    {data && <>
      <section className="stat-row">{cards.map(([label, value]) => <div className="stat-box" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className="split-panels">
        <article className="panel executive-card"><div className="panel-title"><div><h2>Issues</h2><p>رکوردها با نام نمایش داده می‌شوند.</p></div><Badge tone={issues.length ? 'warning' : 'success'}>{issues.length}</Badge></div>{issues.length === 0 ? <p className="muted">هیچ مورد کیفیتی یافت نشد.</p> : <div className="action-list">{issues.slice(0, 20).map((issue: any, index: number) => <div className="listRow" key={`${issue.kind}-${index}`}><Badge tone="warning">{issue.kind}</Badge>{issue.href ? <a href={issue.href}>{issue.label}</a> : <span>{issue.label}</span>}</div>)}</div>}</article>
        <article className="panel executive-card"><h2>Governance</h2><p className="muted">Classification، Retention، Export Controls و Privacy از Backend enforce می‌شوند.</p><div className="toolbar"><a className="secondary-action" href="/privacy">Privacy</a><a className="secondary-action" href="/data-management/import">Import</a></div></article>
      </section>
      <section className="panel"><h2>Coverage</h2><div className="metric-list">{Object.entries(metrics.coverage ?? {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div></section>
    </>}
  </main>;
}
