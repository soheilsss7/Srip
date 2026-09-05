'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  Tag as TagIcon, RefreshCw, Search, Plus, X, CheckCircle2, Pencil, Trash2, Check, Tags as TagsIcon, Inbox,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  برچسب‌ها — واژه‌نامهٔ برچسب و کاربرد آن روی نهادها                  */
/*  بک‌اند: GET/POST /admin/tags · PATCH/DELETE /admin/tags/:id       */
/* ------------------------------------------------------------------ */

type TagView = {
  id: string; name: string; createdAt: string;
  usage: number; breakdown: Record<string, number>;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string): string => iso ? new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

export default function AdminTagsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [tags, setTags] = useState<TagView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [q, setQ] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setTags(unwrap(await api<TagView[]>('/admin/tags'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);



  const stats = useMemo(() => ({
    total: tags.length,
    used: tags.filter(t => t.usage > 0).length,
    unused: tags.filter(t => t.usage === 0).length,
    assignments: tags.reduce((acc, t) => acc + t.usage, 0),
  }), [tags]);

  const sorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tags
      .filter(t => {
        if (scopeFilter === 'used' && t.usage === 0) return false;
        if (scopeFilter === 'unused' && t.usage > 0) return false;
        if (term && !t.name.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'));
  }, [tags, q, scopeFilter]);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true); setNewError('');
    try {
      const created = await api<TagView>('/admin/tags', { method: 'POST', body: JSON.stringify({ name }) });
      setTags(list => {
        const rest = list.filter(t => t.id !== created.id);
        return [...rest, created].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'));
      });
      setNewName('');
      setFlash(`برچسب «${created.name}» افزوده شد.`);
    } catch (x) { setNewError((x as Error).message); }
    finally { setCreating(false); }
  }

  function beginRename(t: TagView) { setEditingId(t.id); setEditName(t.name); setError(''); }

  async function rename(t: TagView) {
    const name = editName.trim();
    if (!name || name === t.name) { setEditingId(null); return; }
    setBusy(t.id);
    try {
      const updated = await api<TagView>(`/admin/tags/${encodeURIComponent(t.id)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      setTags(list => list.map(x => x.id === t.id ? updated : x));
      setFlash(`نام برچسب به «${updated.name}» تغییر کرد.`);
      setEditingId(null);
    } catch (x) { setError((x as Error).message); setEditingId(null); }
    finally { setBusy(null); }
  }

  async function remove(t: TagView) {
    if (!confirm(`برچسب «${t.name}» حذف شود؟\n${t.usage > 0 ? `از ${fmtNum(t.usage)} مورد (${Object.entries(t.breakdown).map(([k, v]) => `${k} ${fmtNum(v)}`).join('، ')}) جدا می‌شود.` : 'کاربردی ندارد.'}`)) return;
    setBusy(t.id);
    try {
      const r = await api<{ removedAssignments?: number }>(`/admin/tags/${encodeURIComponent(t.id)}`, { method: 'DELETE' });
      setTags(list => list.filter(x => x.id !== t.id));
      setFlash(`برچسب حذف شد${(r?.removedAssignments ?? 0) > 0 ? ` و از ${fmtNum(r!.removedAssignments!)} مورد جدا شد` : ''}.`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / برچسب‌ها" title="برچسب‌ها" description="واژه‌نامهٔ برچسب و کاربرد آن روی نهادها." />
        <div className="empty-state-v4">
          <div className="empty-ico"><TagIcon size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت برچسب‌ها به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / برچسب‌ها"
        title="برچسب‌ها"
        description="واژه‌نامهٔ برچسب‌های سامانه با کاربرد زنده روی سازمان‌ها، اشخاص، روابط و جلسات — یک‌جا ایجاد، تغییر نام و حذف کنید."
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 340 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<TagsIcon size={18} />} label="کل برچسب‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در واژه‌نامه" />
            <StatCard icon={<TagIcon size={18} />} label="در استفاده" value={fmtNum(stats.used)} iconClass="ic-teal" sub="روی حداقل یک نهاد" />
            <StatCard icon={<Inbox size={18} />} label="بدون استفاده" value={fmtNum(stats.unused)} iconClass="ic-gold" sub="آمادهٔ پاک‌سازی" />
            <StatCard icon={<CheckCircle2 size={18} />} label="مجموع کاربردها" value={fmtNum(stats.assignments)} iconClass="ic-red" sub="روی همهٔ نهادها" />
          </div>

          {/* quick create */}
          <section className="form-card" style={{ padding: '14px 16px' }}>
            <form onSubmit={createTag} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <TagIcon size={16} className="t-muted" />
              <input
                className="inline-input" style={{ flex: 1, minWidth: 220 }}
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="نام برچسب جدید… (مثلاً: تصمیم‌ساز کلیدی)"
                maxLength={100}
              />
              <button className="btn btn-primary" disabled={creating || !newName.trim()}>
                {creating ? <RefreshCw size={14} className="spin" /> : <Plus size={15} />} افزودن برچسب
              </button>
            </form>
            {newError && <ErrorCard message={newError} />}
          </section>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام برچسب…">
            <select aria-label="فیلتر کاربرد" value={scopeFilter} onChange={e => setScopeFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ برچسب‌ها</option>
              <option value="used">در استفاده</option>
              <option value="unused">بدون استفاده</option>
            </select>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <span className="chip info">{fmtNum(sorted.length)} برچسب</span>
          </Toolbar>

          {sorted.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>برچسبی یافت نشد</strong>
              <p>{tags.length === 0 ? 'با فرم بالا نخستین برچسب را بسازید.' : 'عبارت جستجو یا فیلتر را تغییر دهید.'}</p>
            </div>
          ) : (
            <div className="tag-cloud">
              {sorted.map(t => (
                <div key={t.id} className={`tag-card ${t.usage === 0 ? 'tag-unused' : ''}`}>
                  {editingId === t.id ? (
                    <form
                      onSubmit={e => { e.preventDefault(); rename(t); }}
                      style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}
                    >
                      <input
                        autoFocus className="inline-input" style={{ minWidth: 0, flex: 1, padding: '6px 10px', fontSize: 12.5 }}
                        value={editName} onChange={e => setEditName(e.target.value)} maxLength={100}
                      />
                      <button className="btn btn-primary btn-sm" disabled={busy === t.id}><Check size={13} /></button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}><X size={13} /></button>
                    </form>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <TagIcon size={15} style={{ color: 'var(--srip-accent)' }} />
                        <b className="t-primary" style={{ fontSize: 13.5, flex: 1 }}>{t.name}</b>
                        <Badge tone={t.usage > 0 ? 'success' : 'neutral'}>{fmtNum(t.usage)}</Badge>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 2 }}>
                        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {Object.keys(t.breakdown).length === 0
                            ? <span className="t-muted" style={{ fontSize: 11 }}>بدون کاربرد</span>
                            : Object.entries(t.breakdown).map(([kind, count]) => (
                              <span key={kind} className="t-muted" style={{ fontSize: 11 }}>{kind} {fmtNum(count)}</span>
                            ))}
                        </span>
                        <span className="t-muted" style={{ fontSize: 10.5 }}>{fmtDate(t.createdAt)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => beginRename(t)} disabled={!!busy} title="تغییر نام"><Pencil size={12} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger, #c0392b)' }} onClick={() => remove(t)} disabled={!!busy} title="حذف برچسب"><Trash2 size={12} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
