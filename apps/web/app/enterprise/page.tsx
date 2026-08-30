'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, apiDelete, apiPost, unwrapList } from '../_lib/api';
import { Badge, DataTable, Empty, ErrorCard, Loading, PageHeader } from '../_components/page-ui';
import { useWorkspace } from '../_components/workspace';

type Overview = { governance?: { policies: number; securityEvents: number; featureFlags: number; enabledFeatureFlags: number; organizations: number }; exports?: { total: number }; classification?: { documents?: Record<string, number> } };
type Flag = { id: string; key: string; description?: string | null; enabled: boolean; rollout?: number; organizationId?: string | null; updatedAt?: string; createdAt?: string };
type Policy = { id: string; key: string; permissionKey?: string; effect?: string; role?: string | null; enabled?: boolean; createdAt?: string };
type SecEvent = { id: string; type?: string; severity?: string; ipAddress?: string | null; userAgent?: string | null; createdAt?: string };

export default function EnterprisePage() {
  const { can } = useWorkspace();
  const canRead = can('enterprise.read');
  const canAdmin = can('enterprise.admin');
  const canFlags = can('feature_flag.read');
  const canFlagWrite = can('feature_flag.write');
  const canSecurity = can('enterprise.security');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [security, setSecurity] = useState<SecEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ key: '', description: '' });

  const loadAll = useCallback(async () => {
    if (!canRead && !canFlags && !canSecurity) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [ov, fl, po, se] = await Promise.all([
        canRead ? api<Overview>('/enterprise/overview') : Promise.resolve(null),
        canFlags ? api('/enterprise/feature-flags') : Promise.resolve([]),
        canRead ? api('/enterprise/policies') : Promise.resolve([]),
        canSecurity ? api('/enterprise/security-events') : Promise.resolve([]),
      ]);
      setOverview(ov);
      setFlags(unwrapList<Flag>(fl));
      setPolicies(unwrapList<Policy>(po));
      setSecurity(unwrapList<SecEvent>(se));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [canRead, canFlags, canSecurity]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function run(label: string, fn: () => Promise<unknown>, allowed = true) {
    if (!allowed) return;
    setError('');
    try { await fn(); await loadAll(); } catch (e) { setError((e as Error).message); }
  }

  async function toggleFlag(f: Flag) {
    await run('flag', () => apiPost('/enterprise/feature-flags', { key: f.key, enabled: !f.enabled }), canFlagWrite);
  }

  async function togglePolicy(p: Policy) {
    await run('policy', () => apiPost('/enterprise/policies', { key: p.key, permissionKey: p.permissionKey, effect: p.effect ?? 'ALLOW', enabled: !p.enabled }), canAdmin);
  }

  async function deletePolicy(p: Policy) { await run('del-policy', () => apiDelete(`/enterprise/policies/${p.id}`), canAdmin); }

  const g: NonNullable<Overview['governance']> = overview?.governance ?? { policies: 0, securityEvents: 0, featureFlags: 0, enabledFeatureFlags: 0, organizations: 0 };
  const docs = overview?.classification?.documents ?? {};
  const kpis: Array<[string, number | string]> = [
    ['Policies', g.policies ?? 0],
    ['Security Events', g.securityEvents ?? 0],
    ['Feature Flags', g.featureFlags ?? 0],
    ['Enabled Flags', g.enabledFeatureFlags ?? 0],
    ['Organizations', g.organizations ?? 0],
    ['Exports', overview?.exports?.total ?? 0],
  ];

  if(!canRead&&!canFlags&&!canSecurity)return <main className="feature-page"><PageHeader eyebrow="ENTERPRISE" title="Enterprise Governance" description="کنترل‌های حاکمیت سازمانی."/><section className="panel"><Empty>مجوز مشاهده حاکمیت Enterprise برای شما فعال نیست.</Empty></section></main>;

  return (
    <main className="feature-page">
      <PageHeader eyebrow="ENTERPRISE" title="Enterprise Governance" description="Agency-wide policy (ABAC)، ماژول‌های Feature Flag، مستندات طبقه‌بندی‌شده و رویدادهای امنیتی — همه با Authorization گره خورده‌اند." />
      <ErrorCard message={error} />
      {loading ? <Loading /> : (
        <>
          <section className="kpi-grid" aria-label="Enterprise KPIs">
            {kpis.map(([label, value]) => (
              <div className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </section>

          <section className="feature-page">
            <div className="panel">
              <div className="row"><h2>Feature Flags</h2><span className="muted">{flags.length} flags</span></div>
              {flags.length === 0 ? <Empty>هیچ Feature Flag تعریف نشده است.</Empty> : (
                <DataTable
                  columns={[
                    { key: 'key', label: 'Key' },
                    { key: 'description', label: 'توضیح' },
                    { key: 'rollout', label: 'Rollout' },
                    { key: 'enabled', label: 'وضعیت' },
                    { key: 'action', label: 'عملیات' },
                  ]}
                  rows={flags.map((f) => ({ key: f.key, description: f.description ?? '—', rollout: `${f.rollout ?? 100}%`, enabled: <Badge tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'ON' : 'OFF'}</Badge>, action: canFlagWrite ? <button onClick={() => void toggleFlag(f)}>تغییر وضعیت</button> : '—' }))}
                />
              )}
              {canFlagWrite&&<form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (!form.key.trim()) return; run('flag-new', () => apiPost('/enterprise/feature-flags', { key: form.key.trim(), description: form.description || undefined }), canFlagWrite).then(() => { setForm({ key: '', description: '' }); }); }}>
                <label className="inline-field">key<input placeholder="flag key" value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} required /></label>
                <label className="inline-field">توضیح <input placeholder="توضیح (اختیاری)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
                <button className="primary-action">اضافه کردن Flag</button>
              </form>}
            </div>
          </section>

          <section className="grid2">
            <div className="panel">
              <div className="row"><h2>Authorization Policies (ABAC)</h2><span className="muted">{policies.length}</span></div>
              {policies.length === 0 ? <Empty>هیچ Policy تعریف نشده است.</Empty> : (
                <div className="action-list">
                  {policies.map((p) => (
                    <div className="panel compact" key={p.id}>
                      <strong>{p.key}</strong>
                      <Badge tone={p.effect === 'DENY' ? 'danger' : 'success'}>{p.effect ?? 'ALLOW'}</Badge>
                      <Badge tone={p.enabled ? 'success' : 'neutral'}>{p.enabled ? 'enabled' : 'disabled'}</Badge>
                      <span>{p.permissionKey ?? '—'}</span>
                      {canAdmin&&<><button onClick={() => togglePolicy(p)}>فعال/غیرفعال</button>
                      <button onClick={() => deletePolicy(p)}>حذف</button></>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="row"><h2>Security Events</h2><span className="muted">{security.length} آخرین</span></div>
              {security.length === 0 ? <Empty>رویداد امنیتی‌ای ثبت نشده است.</Empty> : (
                <DataTable
                  columns={[
                    { key: 'type', label: 'نوع' },
                    { key: 'severity', label: 'شدت' },
                    { key: 'ip', label: 'IP' },
                    { key: 'created', label: 'زمان' },
                  ]}
                  rows={security.slice(0, 20).map((s) => ({ type: s.type ?? '—', severity: s.severity ?? '—', ip: s.ipAddress ?? '—', created: s.createdAt ? new Date(s.createdAt).toLocaleString('fa-IR') : '—' }))}
                />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="row"><h2>Document Classification</h2></div>
            {Object.keys(docs).length === 0 ? <Empty>مستندات طبقه‌بندی‌شده‌ای وجود ندارد.</Empty> : (
              <div className="metric-list">{[...Object.entries(docs)].map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
