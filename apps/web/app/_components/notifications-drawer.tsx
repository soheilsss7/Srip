'use client';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';

export function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    try {
      const x = await api<any>('/notifications?limit=30');
      setItems(Array.isArray(x) ? x : x?.items ?? x?.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (open) load(); }, [open]);
  // در باز بودن کشو: قفل اسکرول پس‌زمینه (بک‌دراپِ تیره/تار خودش را کنارِ کشو می‌سازیم)
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  async function read(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems(x => x.map(n => n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n));
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="notification-drawer" aria-label="اعلان‌ها">
        <header>
          <div>
            <span className="eyebrow">مرکز اعلان‌ها</span>
            <h2>اعلان‌ها</h2>
          </div>
          <button onClick={onClose} aria-label="بستن">×</button>
        </header>
        <div className="drawer-actions">
          <button onClick={() => api('/notifications/read-all', { method: 'PATCH' }).then(load).catch(e => setError(e.message))}>همه خوانده شد</button>
          <button onClick={load}>↻</button>
        </div>
        {loading ? <p>در حال بارگذاری…</p> :
          items.length ? items.map(n => (
            <button className={'notification-item ' + (!n.read ? 'unread' : '')} key={n.id} onClick={() => read(n.id)}>
              <strong>{n.title ?? n.type ?? 'اعلان'}</strong>
              <span>{n.message ?? n.body ?? ''}</span>
              <small>{n.createdAt ?? ''}</small>
            </button>
          )) : <p>اعلانی وجود ندارد.</p>}
        {error && <div className="error-card">{error}</div>}
      </aside>
    </>
  );
}
