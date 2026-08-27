'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, apiDelete, apiPost, unwrapList } from '../_lib/api';
import { Badge, DataTable, Empty, ErrorCard, Loading, PageHeader } from '../_components/page-ui';

type Session = { id: string; deviceName?: string | null; ipAddress?: string | null; userAgent?: string | null; createdAt?: string; expiresAt?: string; idleExpiresAt?: string; absoluteExpiresAt?: string; lastActivityAt?: string | null; revokedAt?: string | null; rotatedAt?: string | null };

export default function SessionsPage() {
  const [rows, setRows] = useState<Session[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(unwrapList<Session>(await api('/sessions'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setError('');
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }

  function fmt(iso?: string | null) { return iso ? new Date(iso).toLocaleString('fa-IR') : '—'; }
  function status(s: Session): 'active' | 'revoked' | 'rotated' { if (s.revokedAt) return 'revoked'; if (s.rotatedAt) return 'rotated'; return 'active'; }

  const tableRows = rows.map((s) => ({
    id: s.id,
    device: s.deviceName ?? '—',
    ip: s.ipAddress ?? '—',
    userAgent: (s.userAgent?.slice(0, 60) ?? '—') as string,
    created: fmt(s.createdAt),
    expires: fmt(s.absoluteExpiresAt ?? s.expiresAt),
    status: status(s),
  }));

  return (
    <main className="feature-page">
      <PageHeader eyebrow="IDENTITY" title="Sessions" description="لیست Sessionها و مدیریت دستگاههای فعال. یک Session معادل یک refresh token است و فقط به کاربر صاحب آن قابل Revoke است." actions={
        <div className="toolbar">
          <button className="secondary-action" disabled={!!busy} onClick={() => run('revoke-all-except', () => apiPost('/sessions/revoke-all-except-current', {}))}>{busy === 'revoke-all-except' ? 'در حال اعمال…' : 'Revoke all except current'}</button>
          <button className="secondary-action danger" disabled={!!busy || rows.length === 0} onClick={() => run('revoke-all', () => apiPost('/sessions/revoke-all', {}))}>{busy === 'revoke-all' ? 'در حال اعمال…' : 'Revoke all'}</button>
        </div>
      } />
      <ErrorCard message={error} />
      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="panel"><Empty>هیچ Session فعالی یافت نشد.</Empty></div>
      ) : (
        <section className="panel">
          <DataTable
            columns={[
              { key: 'device', label: 'دستگاه' },
              { key: 'ip', label: 'IP' },
              { key: 'userAgent', label: 'User-Agent' },
              { key: 'created', label: 'ساختهشده' },
              { key: 'expires', label: 'انقضا' },
              { key: 'status', label: 'وضعیت' },
            ]}
            rows={tableRows}
          />
          <div className="action-list">
            {rows.map((s) => (
              <div className="panel compact" key={s.id}>
                <strong>{s.deviceName ?? (s.id.slice(0, 8) + '…')}</strong>
                <Badge tone={status(s) === 'active' ? 'success' : status(s) === 'rotated' ? 'warning' : 'danger'}>{status(s)}</Badge>
                <span>{s.ipAddress ?? '—'}</span>
                {status(s) === 'active' && <button disabled={!!busy} onClick={() => run('revoke', () => apiDelete(`/sessions/${s.id}`))}>Revoke</button>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
