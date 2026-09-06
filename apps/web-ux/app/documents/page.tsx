'use client';
/* ============================================================================
   مرکز دانش — دانشنامهٔ واقعی و قابل استفاده
   مقالات از رفتار واقعی پلتفرم نوشته شده‌اند (آستانه‌ها، وزن‌ها، مجوزها، جریان کار).
   جست‌وجو، فیلتر، بوک‌مارک، رأی «مفید»، بازدید، مقالهٔ مرتبط و CRUD برای مالک —
   همگی به API واقعی وصل‌اند و در DB ذخیره می‌شوند.
   تب «اسناد و فایل‌ها» چرخهٔ حاکمیت اسناد را در /documents/files نگه می‌دارد.
   ============================================================================ */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Badge, Empty, ErrorCard, Loading, Modal, PageHeader, StatCard } from '../_components/page-ui';
import HubTabs from '../_components/hub-tabs';
import {
  ArrowUpRight, BookOpen, Bookmark, BookmarkCheck, Clock3, Eye, FileText,
  Plus, RefreshCw, Save, Search, Sparkles, ThumbsUp, Trash2, X,
} from 'lucide-react';

const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);
const faNum = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const famOf = (list: any[], key: string) => list.find((f) => f.key === key);

type KbArticle = {
  id: string; slug: string; title: string; excerpt: string; category: string;
  tags: string[]; families: string[]; readMinutes: number; author: string;
  updatedAt?: string; views: number; helpful: number; notHelpful: number;
  bookmarked?: boolean; isMine?: boolean;
  body?: string; related?: KbArticle[]; familyLabels?: Record<string, string>;
};
type KbCategory = { key: string; label: string };

const CAT_ICON: Record<string, React.ReactNode> = {
  GETTING_STARTED: <Sparkles size={14} />,
  SCORING: <BookOpen size={14} />,
  PROCESS: <FileText size={14} />,
  SECURITY: <ArrowUpRight size={14} />,
  ANALYTICS: <Eye size={14} />,
};

export default function KnowledgeCenter() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [items, setItems] = useState<KbArticle[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [tag, setTag] = useState('');
  const [mine, setMine] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');

  const [reading, setReading] = useState<KbArticle | null>(null);
  const [readBusy, setReadBusy] = useState('');
  const [voteFlash, setVoteFlash] = useState('');

  const [compose, setCompose] = useState<null | 'new' | string>(null);
  const [form, setForm] = useState({ title: '', excerpt: '', body: '', category: 'GETTING_STARTED', tags: '', families: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 260);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      if (cat) params.set('category', cat);
      if (tag) params.set('tag', tag);
      if (mine) params.set('mine', '1');
      const res: any = await api(`/knowledge${params.toString() ? `?${params}` : ''}`);
      setItems(unwrap(res?.items ?? res));
      setCategories((res?.categories ?? []) as KbCategory[]);
      setTags((res?.tags ?? []) as string[]);
      setStats(res?.stats ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [debouncedQ, cat, tag, mine]);
  useEffect(() => { load(); }, [load]);

  async function openArticle(a: KbArticle) {
    setReadBusy(a.id); setError('');
    try {
      const full: any = await api(`/knowledge/${a.id}`);
      setReading(full as KbArticle);
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, views: (x.views ?? 0) + 1 } : x)));
    } catch (e) { setError((e as Error).message); }
    finally { setReadBusy(''); }
  }
  async function toggleBookmark(a: KbArticle) {
    try {
      const r: any = await api(`/knowledge/${a.id}/bookmark`, { method: 'POST' });
      const on = !!r?.bookmarked;
      if (reading?.id === a.id) setReading({ ...reading, bookmarked: on });
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, bookmarked: on } : x)));
    } catch (e) { setError((e as Error).message); }
  }
  async function vote(helpful: boolean) {
    if (!reading) return;
    setVoteFlash('');
    try {
      const r: any = await api(`/knowledge/${reading.id}/vote`, { method: 'POST', body: JSON.stringify({ helpful }) });
      setReading({ ...reading, helpful: r?.helpful ?? reading.helpful, notHelpful: r?.notHelpful ?? reading.notHelpful });
      setVoteFlash(helpful ? 'ممنون؛ این بازخورد به بهتر شدن دانشنامه کمک می‌کند.' : 'ثبت شد — برای رفع ابهام، مقالهٔ مرتبط را بخوانید یا از دستیار بپرسید.');
      setStats((s: any) => s ? { ...s, helpful: (s.helpful ?? 0) + (helpful ? 1 : 0) } : s);
    } catch (e) { setError((e as Error).message); }
  }

  function beginCompose(kind: 'new' | string) {
    setFormError('');
    if (kind === 'new') {
      setForm({ title: '', excerpt: '', body: '', category: 'SCORING', tags: '', families: '' });
    } else {
      const a = items.find((x) => x.id === kind);
      if (a) {
        setForm({ title: a.title, excerpt: a.excerpt, body: '', category: a.category, tags: a.tags.join('، '), families: a.families.join(',') });
        setFormError('در حال خواندن متن مقاله…');
        api(`/knowledge/${a.id}`).then((full: any) => {
          setForm((f) => ({ ...f, body: full?.body ?? '' }));
          setFormError('');
        }).catch(() => setFormError('متن مقاله خوانده نشد؛ دوباره تلاش کنید.'));
      }
    }
    setCompose(kind);
  }
  async function saveArticle() {
    if (!String(form.title).trim() || !String(form.body).trim()) { setFormError('عنوان و متن مقاله الزامی است.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        title: form.title.trim(), excerpt: form.excerpt.trim(), body: form.body.trim(),
        category: form.category,
        tags: form.tags.split(/[,،;]/).map((t) => t.trim()).filter(Boolean).slice(0, 8),
        families: form.families.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
      };
      if (compose === 'new') await api('/knowledge', { method: 'POST', body: JSON.stringify(payload) });
      else await api(`/knowledge/${compose}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setCompose(null);
      await load();
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }
  async function removeArticle() {
    if (!compose || compose === 'new') return;
    setSaving(true); setFormError('');
    try {
      await api(`/knowledge/${compose}`, { method: 'DELETE' });
      setCompose(null);
      await load();
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }

  const famList: KbCategory[] = useMemo(() => [
    { key: 'STRATEGIC', label: 'راهبردی' }, { key: 'VALUE', label: 'ارزش' }, { key: 'CAPABILITY', label: 'توانمندی' },
    { key: 'RELIABILITY', label: 'قابلیت اعتماد' }, { key: 'ACCESS', label: 'دسترسی' }, { key: 'FINANCIAL', label: 'مالی' },
    { key: 'RISK', label: 'ریسک' }, { key: 'NETWORK', label: 'شبکه' },
  ], []);

  const famLabel = (k: string): string =>
    reading?.familyLabels?.[k] ?? famOf(famList, k)?.label ?? k;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="همکاری و هم‌آموزی"
        title="مرکز دانش"
        description="دانشنامهٔ عملیاتی پلتفرم: مدل امتیازدهی، نردبان حکم، امنیت، گردش‌کارها و تحلیل — نوشته‌شده بر اساس رفتار واقعی سامانه، با جست‌وجو، بوک‌مارک و بازخورد."
        actions={<>
          <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
          {isOwner && <button className="btn btn-primary" onClick={() => beginCompose('new')}><Plus size={15} /> مقالهٔ جدید</button>}
        </>}
      />
      <HubTabs tabs={[
        { href: '/documents', label: 'دانشنامه', icon: <BookOpen size={13} /> },
        { href: '/documents/files', label: 'اسناد و فایل‌ها', icon: <FileText size={13} /> },
        { href: '/help', label: 'راهنمای کامل', icon: <ArrowUpRight size={13} /> },
      ]} />
      <ErrorCard message={error} />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard icon={<BookOpen size={16} />} iconClass="ic-blue" label="مقالهٔ دانشنامه" value={faNum(stats?.total ?? items.length)} sub={`${faNum(categories.length)} دسته`} />
        <StatCard icon={<Eye size={16} />} iconClass="ic-purple" label="بازدید کل" value={faNum(stats?.views)} sub="خواندن واقعی" />
        <StatCard icon={<ThumbsUp size={16} />} iconClass="ic-green" label="رأی «مفید بود»" value={faNum(stats?.helpful)} sub="بازخورد خوانندگان" />
        <StatCard icon={<BookmarkCheck size={16} />} iconClass="ic-gold" label="بوک‌مارک من" value={faNum(stats?.bookmarks)} sub={stats?.mine ? `+${faNum(stats.mine)} نگارش شما` : 'برای دسترسی سریع'} />
      </div>

      <section className="panel">
        <div className="panel-title">
          <div><h2><BookOpen size={15} /> دانشنامه</h2><p>{items.length > 0 ? `${faNum(items.length)} مقالهٔ منطبق` : 'مقاله‌ای مطابق فیلتر نیست.'}</p></div>
          <div className="toolbar">
            <span className="searchbox">
              <Search size={14} className="searchbox-ico" />
              <input aria-label="جست‌وجو در دانشنامه" className="searchbox-input" placeholder="جست‌وجو در عنوان، متن و برچسب‌ها…" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="searchbox-clear" onClick={() => setQ('')} aria-label="پاک کردن"><X size={13} /></button>}
            </span>
            {isOwner && (
              <label className="checkbox-line" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> فقط نوشته‌های من
              </label>
            )}
          </div>
        </div>

        <div className="kb-filters">
          <button className={`kb-chip${!cat ? ' active' : ''}`} onClick={() => setCat('')}>همه</button>
          {categories.map((c) => (
            <button key={c.key} className={`kb-chip${cat === c.key ? ' active' : ''}`} onClick={() => setCat(c.key)}>{CAT_ICON[c.key]}{c.label}</button>
          ))}
          {tags.length > 0 && (
            <select className="toolbar-select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="فیلتر برچسب">
              <option value="">همهٔ برچسب‌ها</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {loading ? <Loading label="در حال خواندن دانشنامه…" /> : items.length === 0 ? (
          <Empty>مقاله‌ای مطابق این فیلتر نیست. جست‌وجو را تغییر دهید یا (اگر مالک هستید) مقالهٔ جدید بسازید.</Empty>
        ) : (
          <div className="kb-grid">
            {items.map((a) => (
              <article key={a.id} className="kb-card">
                <div className="kb-card-top">
                  <span className="chip info">{categories.find((c) => c.key === a.category)?.label ?? fa(a.category)}</span>
                  <button className="kb-bookmark" aria-label={a.bookmarked ? 'حذف بوک‌مارک' : 'بوک‌مارک'} title={a.bookmarked ? 'حذف بوک‌مارک' : 'بوک‌مارک'}
                    onClick={() => toggleBookmark(a)}>
                    {a.bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  </button>
                </div>
                <button className="kb-card-body" onClick={() => openArticle(a)} disabled={readBusy === a.id}>
                  <h3>{a.title}</h3>
                  <p>{a.excerpt}</p>
                  <div className="kb-tags">
                    {(a.tags ?? []).slice(0, 4).map((t) => <span key={t} className="chip neutral">{t}</span>)}
                    {(a.families ?? []).slice(0, 3).map((f) => <span key={f} className="chip info">معیار: {famLabel(f)}</span>)}
                  </div>
                </button>
                <div className="kb-card-meta">
                  <span><Clock3 size={12} /> {faNum(a.readMinutes)} دقیقه</span>
                  <span><Eye size={12} /> {faNum(a.views)} بازدید</span>
                  <span><ThumbsUp size={12} /> {faNum(a.helpful)} مفید</span>
                  <span className="kb-card-author">{fmtDate(a.updatedAt)}{a.isMine ? ' · نوشتهٔ شما' : ` · ${a.author}`}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* خوانندهٔ مقاله */}
      <Modal open={!!reading} title={reading?.title ?? ''} description={reading ? `${categories.find((c) => c.key === reading?.category)?.label ?? ''} · ${faNum(reading.readMinutes)} دقیقه مطالعه · ${fmtDate(reading.updatedAt)}` : ''} onClose={() => setReading(null)}
        footer={reading && <>
          <button className="btn btn-secondary" onClick={() => toggleBookmark(reading)}>{reading.bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {reading.bookmarked ? 'در بوک‌مارک‌ها' : 'بوک‌مارک'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={() => vote(false)}>کمتر توضیح داده شد</button>
          <button className="btn btn-primary" onClick={() => vote(true)}><ThumbsUp size={14} /> مفید بود ({faNum(reading.helpful)})</button>
        </>}>
        {reading && (
          <div className="kb-reader">
            {voteFlash && <div className="notice" role="status">{voteFlash}</div>}
            <div className="kb-tags">
              {(reading.tags ?? []).map((t) => <span key={t} className="chip neutral">{t}</span>)}
            </div>
            <div className="kb-reader-body">
              {String(reading.body ?? '').split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {(reading.families ?? []).length > 0 && (
              <div className="kb-reader-families">
                <strong>مرتبط با معیارها:</strong>
                <div className="kb-tags">
                  {(reading.families ?? []).map((f) => (
                    <Link key={f} href="/admin/criteria" className="chip info">{famLabel(f)} ← کاتالوگ معیارها</Link>
                  ))}
                </div>
              </div>
            )}
            {(reading.related ?? []).length > 0 && (
              <div className="kb-related">
                <strong>مقاله‌های مرتبط:</strong>
                <div className="kb-related-grid">
                  {(reading.related ?? []).map((r) => (
                    <button key={r.id} className="kb-related-item" onClick={() => { setReading(null); openArticle(r); }}>
                      <b>{r.title}</b>
                      <small>{categories.find((c) => c.key === r.category)?.label ?? ''} · {faNum(r.readMinutes)} دقیقه · {faNum(r.helpful)} مفید</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* نوشتن / ویرایش (فقط مالک) */}
      <Modal open={compose !== null} title={compose === 'new' ? 'مقالهٔ جدید دانشنامه' : 'ویرایش مقاله'}
        description="محتوای واقعی بنویسید — عددها، آستانه‌ها و جریان‌های سامانه. این متن همان جایی است که کاربران برای فهم رفتار سیستم می‌خوانند."
        onClose={() => setCompose(null)}
        footer={<>
          {compose !== 'new' && <button className="btn btn-danger" onClick={removeArticle} disabled={saving}><Trash2 size={14} /> حذف</button>}
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={() => setCompose(null)} disabled={saving}>انصراف</button>
          <button className="btn btn-primary" onClick={saveArticle} disabled={saving}><Save size={14} /> {saving ? 'در حال ذخیره…' : 'ذخیرهٔ مقاله'}</button>
        </>}>
        <div className="entity-form">
          <div className="field full"><label className="field-label">عنوان <span className="req">*</span></label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} /></div>
          <div className="field full"><label className="field-label">خلاصه</label><input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} maxLength={220} placeholder="یک یا دو جمله برای کارت دانشنامه" /></div>
          <div className="field full"><label className="field-label">دسته</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="field full"><label className="field-label">برچسب‌ها</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="با ویرگول جدا کنید — مثلاً: ریسک، دروازه، ارزیابی" /></div>
          <div className="field full"><label className="field-label">خانواده‌های معیار مرتبط</label>
            <div className="kb-family-pick">
              {famList.map((f) => {
                const on = form.families.split(',').includes(f.key);
                return (
                  <button type="button" key={f.key} className={`kb-chip${on ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, families: on ? form.families.split(',').filter((x) => x !== f.key).join(',') : [...form.families.split(',').filter(Boolean), f.key].join(',') })}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="field full"><label className="field-label">متن مقاله <span className="req">*</span></label>
            <textarea rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="هر پاراگراف در یک خط؛ اولین خطِ خالی، پاراگراف بعدی را می‌سازد." />
          </div>
          {formError && <div className="criteria-intake-error">{formError}</div>}
        </div>
      </Modal>
    </main>
  );
}
