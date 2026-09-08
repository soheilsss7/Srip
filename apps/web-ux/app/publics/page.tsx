'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiBlob, unwrapList } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard, StatusBadge, Toolbar } from '../_components/page-ui';
import {
  Building2, Users2, Radar, AlertTriangle, Download, FileJson, FileSpreadsheet, Fingerprint,
  Plus, RefreshCw, Trash2, SlidersHorizontal, Megaphone, Newspaper, Target, Eye, Heart,
  CheckCircle2, ChevronLeft, Layers, Landmark, GraduationCap, Briefcase, Newspaper as News2, Cpu,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  عموم‌ها (Publics) — شناخت خود، بازیگران و گپ‌ها                      */
/*  GET catalog/self/:orgId · members · coverage · gaps · review-due    */
/*  PUT self/:orgId · POST/PATCH/DELETE members · POST media · export   */
/* ------------------------------------------------------------------ */

type CatMeta = { id: string; fa: string };
type PubGroup = {
  id: string; cat: string; fa: string; link: string; stage: [string, string];
  stance: string; kanal: string; note?: string;
};
type PubTpl = { id: string; fa: string; focus: string[]; note?: string; groups?: PubGroup[] };
type Catalog = {
  version: number; categories: CatMeta[]; linkages: Record<string, string>;
  stages: Record<string, string>; stances: Record<string, string>; templates: Record<string, PubTpl>;
};
type SelfRow = {
  orgId: string; orgName?: string | null; self: {
    orgId: string; companyType: string; templateId: string;
    structure: { sectors?: string[]; subsidiaries?: string[]; ownership?: string };
    missionTopic: string | null; reviewedAt: string | null; reviewIntervalDays: number; updatedBy?: string | null;
  } | null;
  template: { id: string; fa: string; focus: string[]; groups: number };
  structure: { sectors?: string[]; subsidiaries?: string[]; ownership?: string } | null;
  missionTopic: string | null; reviewedAt: string | null; reviewIntervalDays: number;
  coverage: CovTotals; templateCatalog: Catalog | null;
};
type MemberView = {
  id: string; orgId: string; groupId: string; sourceType: string; sourceId: string;
  linkage: string; stage: string; power: number; interest: number; stance: string; note?: string;
  assessedAt?: string | null; reviewDue?: string | null; orgName?: string | null; sourceName?: string | null;
  sourceLabel?: string; groupFa?: string | null; categoryId?: string | null; categoryFa?: string | null;
  linkageFa?: string | null; stageFa?: string | null; stanceFa?: string | null; kanal?: string | null;
  signals?: number; suggested?: { linkage: string; stage: string; power: number; interest: number; stance: string };
};
type CovRow = {
  categoryId: string; fa: string; expected: number; covered: number; members: number;
  stages: Record<string, number>; stances: Record<string, number>; coveragePct: number;
  criticalGaps: string[]; gapGroups: string[];
};
type CovTotals = {
  categories: number; groupsExpected: number; groupsCovered: number; members: number;
  keyPlayers: number; active: number; gaps: number; criticalGaps: number;
};
type Coverage = {
  orgId: string; orgName: string | null; companyType: string | null; templateId: string | null;
  templateFa: string | null; missionTopic: string | null; reviewedAt: string | null;
  reviewIntervalDays: number; generatedAt: string; byCategory: CovRow[]; totals: CovTotals;
};
type GapRow = {
  gapId: string; groupId?: string | null; groupFa?: string | null; categoryId?: string | null;
  categoryFa?: string | null; kind: 'missing' | 'lagging'; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  stance?: string | null; stanceFa?: string | null; memberId?: string | null; sourceName?: string | null; action?: string;
};
type GapsResp = { orgId: string; generatedAt: string; totals: CovTotals & { missing?: number; lagging?: number }; gaps: GapRow[] };
type MediaRow = { id: string; name: string; type: string; url?: string | null; audience?: string | null; country?: string | null; note?: string | null; createdAt: string };
type OrgMini = { id: string; name: string; type?: string | null };
type PersonMini = { id: string; firstName?: string; lastName?: string; title?: string | null; organization?: { name?: string } | null };
type RelMini = { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null; relationshipType?: string };

const CAT_ICONS: Record<string, React.ReactNode> = {
  INTERNAL: <Users2 size={14} />, INSTITUTIONAL: <Landmark size={14} />, ACADEMIC: <GraduationCap size={14} />,
  ECONOMIC: <Briefcase size={14} />, MEDIA: <News2 size={14} />, ECOSYSTEM: <Cpu size={14} />,
};
const CAT_COLORS: Record<string, string> = {
  INTERNAL: '#0f9b8e', INSTITUTIONAL: '#7c3aed', ACADEMIC: '#2563eb', ECONOMIC: '#d97706',
  MEDIA: '#dc2626', ECOSYSTEM: '#16a34a',
};
const STANCE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  KEY_PLAYER: 'danger', INFLUENCER: 'warning', SUPPORTER: 'info', OBSERVER: 'neutral',
};
const STAGE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', AWARE: 'info', LATENT: 'warning', NON_PUBLIC: 'neutral',
};
const MEDIA_TYPE_OPTIONS = [
  ['TECH_MEDIA', 'رسانه تخصصی فناوری'], ['ECONOMIC_MEDIA', 'رسانه اقتصادی'], ['GENERAL_MEDIA', 'رسانه عمومی'],
  ['INFLUENCER', 'اینفلوئنسر/خبرنگار'], ['OTHER', 'سایر'],
];
const SOURCE_LABELS: Record<string, string> = {
  organization: 'سازمان', person: 'شخص', relationship: 'رابطه', media: 'رسانه',
};

const fmtNum = (v: unknown) => (v == null || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fa-IR', { day: 'numeric', month: 'short', year: '2-digit' });
};
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export default function PublicsPage() {
  const { me, scopeId, can } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');
  const canRead = isOwner || can('publics.read');
  const canWrite = isOwner || can('publics.write');

  const primaryOrg = me?.memberships.find(m => m.isPrimary)?.organizationId ?? me?.memberships?.[0]?.organizationId ?? '';
  const [orgId, setOrgId] = useState<string>(() => (scopeId !== 'all' ? scopeId : primaryOrg));
  useEffect(() => { if (orgId !== scopeId && scopeId !== 'all') setOrgId(scopeId); }, [scopeId, orgId]);
  useEffect(() => { if (!orgId && primaryOrg) setOrgId(primaryOrg); }, [orgId, primaryOrg]);

  const [tab, setTab] = useState<'self' | 'members' | 'coverage' | 'gaps' | 'export'>('self');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selfRow, setSelfRow] = useState<SelfRow | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [gaps, setGaps] = useState<GapsResp | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [orgs, setOrgs] = useState<OrgMini[]>([]);
  const [people, setPeople] = useState<PersonMini[]>([]);
  const [rels, setRels] = useState<RelMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');

  /* filters */
  const [fCat, setFCat] = useState('');
  const [fStance, setFStance] = useState('');
  const [fStage, setFStage] = useState('');
  const [q, setQ] = useState('');

  /* add-member */
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ groupId: '', sourceType: 'organization', sourceId: '', note: '' });
  const addFromGap = useRef<string | null>(null);

  /* assess */
  const [assessFor, setAssessFor] = useState<MemberView | null>(null);
  const [assessForm, setAssessForm] = useState({ stage: 'AWARE', linkage: 'DIFFUSED', power: 50, interest: 50, stance: 'OBSERVER', note: '', assess: true });

  /* self form */
  const [selfForm, setSelfForm] = useState({
    companyType: 'HOLDING', missionTopic: '', reviewIntervalDays: 90,
    sectors: [] as string[], subsidiaries: [] as string[], ownership: 'PRIVATE',
  });
  const [selfDirty, setSelfDirty] = useState(false);

  /* media form */
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaForm, setMediaForm] = useState({ name: '', type: 'TECH_MEDIA', url: '', audience: '', country: '', note: '' });

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 6000);
  };

  const refresh = useCallback(async (oid: string) => {
    setLoading(true); setError('');
    try {
      const [cat, self, mem, cov, gap, med, orgsList, ppl, rls] = await Promise.all([
        api<Catalog>('/publics/catalog'),
        api<SelfRow>(`/publics/self/${oid}`).catch(() => null),
        api<{ items: MemberView[] } & MemberView[]>(`/publics/members?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<Coverage>(`/publics/coverage?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<GapsResp>(`/publics/gaps?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<{ items: MediaRow[] }>(`/publics/media`).catch(() => null),
        api<OrgMini[]>('/organizations').catch(() => null),
        api<PersonMini[]>('/people').catch(() => null),
        api<RelMini[]>('/relationships').catch(() => null),
      ]);
      setCatalog(cat ?? null);
      setSelfRow(self);
      setMembers(unwrapList<MemberView>(mem));
      setCoverage(cov);
      setGaps(gap);
      setMedia(med?.items ?? []);
      setOrgs(Array.isArray(orgsList) ? orgsList : []);
      setPeople(Array.isArray(ppl) ? ppl : []);
      setRels(Array.isArray(rls) ? rls : []);
      if (self) {
        const t = cat?.templates[self.self?.templateId ?? 'HOLDING'] ?? cat?.templates.HOLDING;
        setSelfForm(f => ({
          companyType: self.self?.companyType ?? f.companyType,
          missionTopic: self.missionTopic ?? '',
          reviewIntervalDays: self.reviewIntervalDays ?? 90,
          sectors: self.structure?.sectors ?? f.sectors,
          subsidiaries: self.structure?.subsidiaries ?? f.subsidiaries,
          ownership: self.structure?.ownership ?? 'PRIVATE',
        }));
        setSelfDirty(false);
        void t;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (orgId && canRead) refresh(orgId); }, [orgId, canRead, refresh]);

  const tpl = useMemo(() => {
    const id = selfRow?.template?.id ?? 'HOLDING';
    return catalog?.templates[id] ?? catalog?.templates.HOLDING ?? null;
  }, [catalog, selfRow]);
  const groupsByCat = useMemo(() => {
    const groups = tpl?.groups ?? [];
    const map: Record<string, PubGroup[]> = {};
    for (const g of groups) { (map[g.cat] ??= []).push(g); }
    return map;
  }, [tpl]);
  const catMeta = catalog?.categories ?? [];
  const catOf = (id?: string | null) => catMeta.find(c => c.id === id)?.fa ?? id ?? '—';

  const filteredMembers = useMemo(() => {
    const needle = (q || '').trim();
    return members.filter(m =>
      (!fCat || m.categoryId === fCat) &&
      (!fStance || m.stance === fStance) &&
      (!fStage || m.stage === fStage) &&
      (!needle || [m.groupFa, m.sourceName, m.categoryFa, m.sourceLabel].some(v => v && String(v).includes(needle))),
    );
  }, [members, fCat, fStance, fStage, q]);

  /* ---------- self save ---------- */
  const saveSelf = async () => {
    if (!canWrite) { notify('مجوز ویرایش «عمومها» را ندارید.'); return; }
    setBusy('self');
    try {
      await api(`/publics/self/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({
          companyType: selfForm.companyType,
          missionTopic: selfForm.missionTopic.trim(),
          reviewIntervalDays: Number(selfForm.reviewIntervalDays) || 90,
          structure: { sectors: selfForm.sectors, subsidiaries: selfForm.subsidiaries, ownership: selfForm.ownership },
        }),
      });
      notify('شناسنامهٔ «من کیستم» ذخیره شد — قالب عمومها بهروزرسانی شد.');
      setSelfDirty(false);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- add member ---------- */
  const openAdd = (groupId?: string, gapId?: string) => {
    addFromGap.current = gapId ?? null;
    setAddForm(f => ({ ...f, groupId: groupId ?? f.groupId, sourceId: '' }));
    setAddOpen(true);
  };
  const addMember = async () => {
    if (!addForm.groupId || !addForm.sourceId) { notify('گروه عموم و منبع را انتخاب کنید.'); return; }
    setBusy('add');
    try {
      const created = await api<MemberView>('/publics/members', {
        method: 'POST',
        body: JSON.stringify({ orgId, ...addForm }),
      });
      setAddOpen(false);
      const s = created.suggested;
      notify(`«${created.groupFa ?? created.groupId}» افزوده شد — پیشنهاد موتور: ${created.linkageFa ?? created.linkage}، ${created.stageFa ?? created.stage}، قدرت ${s?.power ?? created.power}/علاقه ${s?.interest ?? created.interest}، ${created.stanceFa ?? created.stance}${addFromGap.current ? ' — گپ انتخابشده پوشش داده شد.' : ''}`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- assess ---------- */
  const openAssess = (m: MemberView) => {
    setAssessFor(m);
    setAssessForm({
      stage: m.stage, linkage: m.linkage, power: m.power, interest: m.interest,
      stance: m.stance, note: m.note ?? '', assess: true,
    });
  };
  const stanceOf = (p: number, i: number) => (p >= 60 && i >= 60 ? 'KEY_PLAYER' : p >= 60 ? 'INFLUENCER' : i >= 60 ? 'SUPPORTER' : 'OBSERVER');
  const assessMember = async () => {
    if (!assessFor) return;
    setBusy('assess');
    try {
      const updated = await api<MemberView>(`/publics/members/${assessFor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...assessForm, power: Number(assessForm.power), interest: Number(assessForm.interest), assess: assessForm.assess }),
      });
      setAssessFor(null);
      notify(`ارزیابی «${updated.groupFa ?? updated.groupId}» ثبت شد — ${updated.stageFa ?? updated.stage} · ${updated.stanceFa ?? updated.stance} (قدرت ${updated.power}/علاقه ${updated.interest}). بازبینی: ${fmtDT(updated.reviewDue)}`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };
  const removeMember = async (m: MemberView) => {
    if (!window.confirm(`«${m.groupFa ?? m.groupId}» از نقشهٔ عمومها حذف شود؟`)) return;
    setBusy(`del-${m.id}`);
    try {
      await api(`/publics/members/${m.id}`, { method: 'DELETE' });
      notify('عضو عموم حذف شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- media ---------- */
  const addMedia = async () => {
    if (!mediaForm.name.trim()) { notify('نام رسانه لازم است.'); return; }
    setBusy('media');
    try {
      await api<MediaRow>('/publics/media', { method: 'POST', body: JSON.stringify(mediaForm) });
      setMediaOpen(false);
      setMediaForm({ name: '', type: 'TECH_MEDIA', url: '', audience: '', country: '', note: '' });
      notify('رسانه ثبت شد — گردشکار پایش رسانه (MEDIA_CREATED) اجرا شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- export ---------- */
  const downloadExport = async (format: 'json' | 'csv') => {
    setBusy(`exp-${format}`);
    try {
      if (format === 'json') {
        const data = await api<any>(`/publics/export?orgId=${encodeURIComponent(orgId)}&format=json`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `publics-${orgId}.json`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await apiBlob(`/publics/export?orgId=${encodeURIComponent(orgId)}&format=csv`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `publics-${orgId}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
      notify('خروجی نقشهٔ عمومها آماده شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const runReview = async () => {
    setBusy('review');
    try {
      const r = await api<{ total: number }>(`/publics/review-due?orgId=${encodeURIComponent(orgId)}`);
      notify(r.total ? `${fmtNum(r.total)} عموم بازبینی سررسیدشده پیدا شد — گردشکار بازبینی اجرا شد.` : 'هیچ بازبینی سررسیدشدهای نیست؛ همهٔ اعضا تازه ارزیابی شدهاند.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const TABS: Array<{ key: typeof tab; label: string; icon?: React.ReactNode }> = [
    { key: 'self', label: 'من کیستم', icon: <Fingerprint size={14} /> },
    { key: 'members', label: 'اعضا و ارزیابی', icon: <Users2 size={14} /> },
    { key: 'coverage', label: 'پوشش', icon: <Radar size={14} /> },
    { key: 'gaps', label: 'گپها و اقدام', icon: <AlertTriangle size={14} /> },
    { key: 'export', label: 'خروجی و رسانه', icon: <Download size={14} /> },
  ];

  const orgOptions = useMemo(() => {
    const mine = me?.accessibleOrganizationIds ?? [];
    const map = new Map(orgs.map(o => [o.id, o]));
    const out = mine.map(id => {
      const known = map.get(id);
      return { id, name: known?.name ?? id };
    });
    // fallback: نامهای شناختهشده از عضویت حتی اگر در فهرست سازمانها نیامده باشند
    for (const mb of me?.memberships ?? []) {
      if (!out.some(o => o.id === mb.organizationId)) out.push({ id: mb.organizationId, name: mb.organizationName });
    }
    return out;
  }, [me, orgs]);
  const selectedOrgName = orgOptions.find(o => o.id === orgId)?.name ?? selfRow?.orgName ?? orgId;

  if (!canRead) {
    return (
      <div className="page">
        <PageHeader eyebrow="عمومها" title="نقشهٔ عمومها" description="شناخت خود و بازیگران اثرگذار" />
        <ErrorCard message="مجوز مشاهدهٔ ماژول «عمومها» را ندارید." />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="عمومها"
        title="نقشهٔ عمومها"
        description="برای هر شرکت مشخص است: شناخت خود با دستهبندی درست، شناخت روابط و بازیگران اثرگذار و گپهای نقشه"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="scope-chip" title="سازمانی که نقشهٔ عمومهایش را میبینید">
              <span className="globe"><Building2 size={13} /></span>
              <span className="scope-label">{selectedOrgName}</span>
              <select aria-label="سازمان" value={orgId} onChange={e => setOrgId(e.target.value)}>
                {(scopeId === 'all' ? orgOptions : orgOptions.filter(o => o.id === scopeId)).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <button className="btn icon-only" onClick={() => refresh(orgId)} title="بهروزرسانی" aria-label="بهروزرسانی"><RefreshCw size={14} /></button>
          </div>
        }
      />

      {flash && <div className="notice success" role="status">{flash}</div>}
      {error && <ErrorCard message={error} />}
      {loading && <Loading label="در حال بارگذاری نقشهٔ عمومها…" />}

      {!loading && (
        <>
          <nav className="tabs" role="tablist" aria-label="بخشهای عمومها">
            {TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'tab-active' : ''} onClick={() => setTab(t.key)}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>

          {/* ---------------- من کیستم ---------------- */}
          {tab === 'self' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="grid-2" style={{ gap: 14 }}>
                <SectionCard
                  title="شناسنامهٔ خودشناسی"
                  icon={<Fingerprint size={15} />}
                  description={canWrite ? 'نوع شرکت را انتخاب کنید؛ قالب ۶ دستهای عمومها همانجا مشخص میشود.' : 'نمای خواندنی'}
                  actions={canWrite && <button className="btn btn-primary" disabled={busy === 'self'} onClick={saveSelf}><CheckCircle2 size={14} /> ذخیرهٔ شناسنامه</button>}
                >
                  <div className="form-grid">
                    <div className="field full">
                      <label className="field-label">نوع شرکت</label>
                      <select value={selfForm.companyType} disabled={!canWrite} onChange={e => { setSelfForm(f => ({ ...f, companyType: e.target.value })); setSelfDirty(true); }}>
                        {(Object.values(catalog?.templates ?? {}) as PubTpl[]).map(t => (
                          <option key={t.id} value={t.id}>{t.fa} ({t.id})</option>
                        ))}
                      </select>
                      <span className="field-hint">{tpl?.note ?? 'قالب پیشفرض: هلدینگ/سرمایهگذاری چندبخشی'}</span>
                    </div>
                    <div className="field full">
                      <label className="field-label">موضوع مأموریت (سوژهٔ اصلی روایت)</label>
                      <input value={selfForm.missionTopic} disabled={!canWrite} placeholder="مثلاً: مرجعیت هوش مصنوعی کشور" onChange={e => { setSelfForm(f => ({ ...f, missionTopic: e.target.value })); setSelfDirty(true); }} />
                    </div>
                    <div className="field">
                      <label className="field-label">دورهٔ بازبینی (روز)</label>
                      <input type="number" min={30} max={365} value={selfForm.reviewIntervalDays} disabled={!canWrite} onChange={e => { setSelfForm(f => ({ ...f, reviewIntervalDays: Number(e.target.value) })); setSelfDirty(true); }} />
                    </div>
                    <div className="field">
                      <label className="field-label">نوع مالکیت</label>
                      <select value={selfForm.ownership} disabled={!canWrite} onChange={e => { setSelfForm(f => ({ ...f, ownership: e.target.value })); setSelfDirty(true); }}>
                        {[['PRIVATE', 'خصوصی'], ['STATE', 'دولتی'], ['PUBLIC', 'عمومی/بورسی'], ['FAMILY', 'خانوادگی']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="field full">
                      <label className="field-label">زیرمجموعهها / شرکتهای تابعه</label>
                      <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {orgs.filter(o => o.id !== orgId).map(o => {
                          const on = selfForm.subsidiaries.includes(o.id);
                          return (
                            <button key={o.id} type="button" disabled={!canWrite} className={`chip ${on ? 'info' : 'neutral'}`} onClick={() => {
                              setSelfForm(f => ({ ...f, subsidiaries: on ? f.subsidiaries.filter(x => x !== o.id) : [...f.subsidiaries, o.id] }));
                              setSelfDirty(true);
                            }}>{on ? <CheckCircle2 size={12} /> : null}{o.name}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {selfDirty && <div className="field-hint" style={{ marginTop: 8 }}>تغییرات ذخیره نشده — «ذخیرهٔ شناسنامه» را بزنید.</div>}
                </SectionCard>

                <SectionCard title="کارت «من کیستم»" icon={<Fingerprint size={15} />} description={`${selectedOrgName} · ${selfRow?.template?.fa ?? '—'}`}>
                  <div className="stat-grid" style={{ marginBottom: 12 }}>
                    <StatCard icon={<Building2 size={16} />} iconClass="ic-teal" label="سازمان" value={selectedOrgName} />
                    <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروههای قالب" value={fmtNum(selfRow?.template?.groups ?? tpl?.groups?.length ?? 0)} sub={`${fmtNum(selfRow?.coverage.groupsCovered ?? 0)} پوشش دادهشده`} />
                    <StatCard icon={<Users2 size={16} />} iconClass="ic-purple" label="اعضای ثبتشده" value={fmtNum(selfRow?.coverage.members ?? members.length)} sub={`${fmtNum(selfRow?.coverage.keyPlayers ?? 0)} بازیگر کلیدی`} />
                    <StatCard icon={<Radar size={16} />} iconClass="ic-orange" label="پوشش" value={`${Math.round(((selfRow?.coverage.groupsCovered ?? 0) / Math.max(1, selfRow?.coverage.groupsExpected ?? 1)) * 100)}٪`} sub={`${fmtNum(selfRow?.coverage.groupsExpected ?? 0)} گروه`} />
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>دسته</th><th>گروهها</th><th>کانال اصلی</th><th>یادداشت</th></tr></thead>
                      <tbody>
                        {(tpl?.focus ?? []).map(cid => {
                          const groups = groupsByCat[cid] ?? [];
                          const cnt = groups.length;
                          return (
                            <tr key={cid}>
                              <td><StatusBadge tone="neutral">{CAT_ICONS[cid]}{catOf(cid)}</StatusBadge></td>
                              <td>{fmtNum(cnt)}</td>
                              <td className="t-muted">{groups.slice(0, 2).map(g => g.kanal).filter(Boolean).join('، ') || '—'}</td>
                              <td className="t-muted">{groups.slice(0, 3).map(g => g.fa).join('، ')}{cnt > 3 ? ` +${fmtNum(cnt - 3)}` : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {/* ---------------- اعضا و ارزیابی ---------------- */}
          {tab === 'members' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<Users2 size={16} />} iconClass="ic-blue" label="اعضای نقشه" value={fmtNum(members.length)} />
                <StatCard icon={<Target size={16} />} iconClass="ic-red" label="بازیگر کلیدی" value={fmtNum(members.filter(m => m.stance === 'KEY_PLAYER').length)} />
                <StatCard icon={<Eye size={16} />} iconClass="ic-teal" label="فعال" value={fmtNum(members.filter(m => m.stage === 'ACTIVE').length)} />
                <StatCard icon={<Heart size={16} />} iconClass="ic-purple" label="حامی" value={fmtNum(members.filter(m => m.stance === 'SUPPORTER').length)} />
              </div>

              <SectionCard
                title="ماتریس قدرت × علاقه"
                icon={<SlidersHorizontal size={15} />}
                description="هر نقطه یک عضو است؛ رنگ = دسته. بازیگران کلیدی (بالا-راست) نیازمند تعامل مستقیماند."
              >
                <Matrix members={members} catOf={catOf} openAssess={openAssess} canWrite={canWrite} />
              </SectionCard>

              <SectionCard
                title="اعضای نقشه"
                icon={<Users2 size={15} />}
                description={`${fmtNum(filteredMembers.length)} از ${fmtNum(members.length)} عضو`}
                actions={canWrite && <button className="btn btn-primary" onClick={() => openAdd()}><Plus size={14} /> افزودن عضو</button>}
              >
                <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی گروه/منبع…">
                  <select aria-label="دسته" value={fCat} onChange={e => setFCat(e.target.value)}>
                    <option value="">همه دستهها</option>
                    {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
                  </select>
                  <select aria-label="موضع" value={fStance} onChange={e => setFStance(e.target.value)}>
                    <option value="">همه مواضع</option>
                    {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select aria-label="مرحله" value={fStage} onChange={e => setFStage(e.target.value)}>
                    <option value="">همه مراحل</option>
                    {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {canWrite && <button className="btn" onClick={() => openAdd()}><Plus size={14} /> عضو تازه</button>}
                </Toolbar>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>گروه عموم</th><th>دسته</th><th>منبع</th><th>پیوند</th><th>مرحله</th><th>موضع</th><th>قدرت/علاقه</th><th>بازبینی</th>{canWrite && <th />}</tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(m => (
                        <tr key={m.id}>
                          <td><b style={{ fontSize: 12 }}>{m.groupFa ?? m.groupId}</b>{m.kanal && <div className="t-muted" style={{ fontSize: 10.5 }}>{m.kanal}</div>}</td>
                          <td><StatusBadge tone="neutral">{CAT_ICONS[m.categoryId ?? '']}{m.categoryFa ?? m.categoryId}</StatusBadge></td>
                          <td><div style={{ fontSize: 12 }}>{m.sourceName ?? m.sourceId}</div><div className="t-muted" style={{ fontSize: 10.5 }}>{m.sourceLabel ?? m.sourceType}</div></td>
                          <td><Badge tone="info">{m.linkageFa ?? m.linkage}</Badge></td>
                          <td><Badge tone={STAGE_TONE[m.stage] ?? 'neutral'}>{m.stageFa ?? m.stage}</Badge></td>
                          <td><Badge tone={STANCE_TONE[m.stance] ?? 'neutral'}>{m.stanceFa ?? m.stance}</Badge></td>
                          <td><b>{fmtNum(m.power)}</b><span className="t-muted"> / </span><b>{fmtNum(m.interest)}</b>{m.signals != null && <div className="t-muted" style={{ fontSize: 10.5 }}>{fmtNum(m.signals)} سیگنال(۹۰ روز)</div>}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{fmtDT(m.reviewDue)}</td>
                          {canWrite && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn icon-only" title="ارزیابی/بهروزرسانی" onClick={() => openAssess(m)}><SlidersHorizontal size={13} /></button>
                                <button className="btn icon-only danger" title="حذف" disabled={busy === `del-${m.id}`} onClick={() => removeMember(m)}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!filteredMembers.length && (
                        <tr><td colSpan={canWrite ? 9 : 8}><div className="empty-state-v4" style={{ padding: 18 }}><p>عضوی با این فیلترها نیست — «افزودن عضو» را بزنید.</p></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- پوشش ---------------- */}
          {tab === 'coverage' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروههای قالب" value={fmtNum(coverage?.totals.groupsExpected ?? 0)} sub={`${fmtNum(coverage?.totals.groupsCovered ?? 0)} پوشش دادهشده`} />
                <StatCard icon={<Radar size={16} />} iconClass="ic-teal" label="٪ پوشش" value={`${Math.round(((coverage?.totals.groupsCovered ?? 0) / Math.max(1, coverage?.totals.groupsExpected ?? 1)) * 100)}٪`} />
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-orange" label="گپها" value={fmtNum(coverage?.totals.gaps ?? 0)} sub={`${fmtNum(coverage?.totals.criticalGaps ?? 0)} بحرانی`} />
                <StatCard icon={<Eye size={16} />} iconClass="ic-purple" label="اعضای فعال" value={fmtNum(coverage?.totals.active ?? 0)} />
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                {(coverage?.byCategory ?? []).map(c => {
                  const pct = Math.round((c.covered / Math.max(1, c.expected)) * 100);
                  return (
                    <SectionCard key={c.categoryId} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{CAT_ICONS[c.categoryId]}{c.fa}</span>} description={`${fmtNum(c.covered)} از ${fmtNum(c.expected)} گروه پوشش دادهشده · ${fmtNum(c.members)} عضو`}>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>پوشش گروهی</span>
                          <b style={{ fontSize: 12, color: CAT_COLORS[c.categoryId] ?? 'var(--srip-accent)' }}>{pct}٪</b>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: 'var(--card-bg-soft)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: CAT_COLORS[c.categoryId] ?? 'var(--srip-accent)' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {Object.entries(catalog?.stages ?? {}).map(([k, v]) => c.stages[k] ? <Badge key={k} tone={STAGE_TONE[k] ?? 'neutral'}>{v} {c.stages[k]}</Badge> : null)}
                        {Object.entries(catalog?.stances ?? {}).map(([k, v]) => c.stances[k] ? <Badge key={k} tone={STANCE_TONE[k] ?? 'neutral'}>{v} {c.stances[k]}</Badge> : null)}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.criticalGaps.length > 0 && <span className="chip danger"><AlertTriangle size={12} /> {fmtNum(c.criticalGaps.length)} گپ بحرانی</span>}
                        <button className="chip info" onClick={() => { setFCat(c.categoryId); setTab('members'); }}>دیدن اعضای این دسته <ChevronLeft size={12} /></button>
                      </div>
                    </SectionCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- گپها و اقدام ---------------- */}
          {tab === 'gaps' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-red" label="گپها" value={fmtNum(gaps?.totals.gaps ?? 0)} />
                <StatCard icon={<Target size={16} />} iconClass="ic-orange" label="بحرانی" value={fmtNum(gaps?.totals.criticalGaps ?? 0)} />
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="غایب" value={fmtNum(gaps?.totals.missing ?? 0)} />
                <StatCard icon={<ClockIcon />} iconClass="ic-purple" label="عقبمانده" value={fmtNum(gaps?.totals.lagging ?? 0)} />
              </div>
              <SectionCard
                title="گپهای نقشهٔ عمومها"
                icon={<AlertTriangle size={15} />}
                description="اول گپهای بحرانی (بازیگر کلیدی غایب یا غیرفعال)، سپس اقدام پیشنهادی برای هرکدام"
                actions={<button className="btn" disabled={busy === 'review'} onClick={runReview}><ClockIcon /> بررسی سررسید بازبینی</button>}
              >
                <div className="stack" style={{ gap: 8 }}>
                  {(gaps?.gaps ?? []).map(g => (
                    <div key={g.gapId} className="section-card" style={{ padding: '12px 14px', borderInlineStart: `3px solid ${g.severity === 'CRITICAL' ? 'var(--srip-danger)' : 'var(--srip-amber)'}` }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge tone={g.severity === 'CRITICAL' ? 'danger' : 'warning'}>{g.severity === 'CRITICAL' ? 'بحرانی' : 'بالا'}</Badge>
                        <Badge tone="neutral">{g.kind === 'lagging' ? 'عقبمانده' : 'غایب'}</Badge>
                        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{g.groupFa ?? g.groupId ?? '—'}</span>
                        <span className="t-muted" style={{ fontSize: 11 }}>{g.categoryFa ?? catOf(g.categoryId)} · {g.stanceFa ?? g.stance ?? '—'}</span>
                        <span style={{ flex: 1 }} />
                        {g.kind === 'missing' && canWrite && (
                          <button className="btn" onClick={() => openAdd(g.groupId ?? undefined, g.gapId)}><Plus size={13} /> افزودن عضو</button>
                        )}
                        {g.kind === 'lagging' && canWrite && g.memberId && members.find(m => m.id === g.memberId) && (
                          <button className="btn" onClick={() => openAssess(members.find(m => m.id === g.memberId)!)}><SlidersHorizontal size={13} /> ارزیابی</button>
                        )}
                      </div>
                      <div className="t-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                        {g.sourceName ? `منبع: ${g.sourceName} · ` : ''}{g.action}
                      </div>
                    </div>
                  ))}
                  {!gaps?.gaps?.length && <div className="empty-state-v4" style={{ padding: 18 }}><p className="t-muted">نقشهٔ عمومها بدون گپ است ✨</p></div>}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- خروجی و رسانه ---------------- */}
          {tab === 'export' && (
            <div className="grid-2" style={{ gap: 14 }}>
              <SectionCard title="خروجی نقشهٔ عمومها" icon={<Download size={15} />} description="کل نقشهٔ بههمراه ارزیابیها؛ برای گزارش هیئت یا تحلیلگر">
                <div className="stack" style={{ gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy === 'exp-json'} onClick={() => downloadExport('json')}><FileJson size={14} /> خروجی JSON</button>
                  <button className="btn" disabled={busy === 'exp-csv'} onClick={() => downloadExport('csv')}><FileSpreadsheet size={14} /> خروجی CSV</button>
                  <span className="field-hint">در CSV ستونها: گروه، دسته، پیوند، مرحله، موضع، قدرت/علاقه، منبع، سررسید بازبینی.</span>
                </div>
              </SectionCard>
              <SectionCard
                title="رسانهها و منابع پخش"
                icon={<Newspaper size={15} />}
                description="موجودیت «Media» — مبنای پیوند پراکنده (DIFFUSED) و محرک MEDIA_CREATED"
                actions={canWrite && <button className="btn btn-primary" onClick={() => setMediaOpen(true)}><Plus size={14} /> رسانهٔ تازه</button>}
              >
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>نام</th><th>نوع</th><th>دامنه</th><th>کشور</th></tr></thead>
                    <tbody>
                      {media.map(m => (
                        <tr key={m.id}>
                          <td><b style={{ fontSize: 12 }}>{m.name}</b>{m.url && <div className="t-muted" style={{ fontSize: 10.5, direction: 'ltr', textAlign: 'right' }}>{m.url}</div>}</td>
                          <td><Badge tone="info">{MEDIA_TYPE_OPTIONS.find(([v]) => v === m.type)?.[1] ?? m.type}</Badge></td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{m.audience ?? '—'}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{m.country ?? '—'}</td>
                        </tr>
                      ))}
                      {!media.length && <tr><td colSpan={4}><div className="empty-state-v4" style={{ padding: 14 }}><p>رسانهای ثبت نشده است.</p></div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* ---------- modals ---------- */}
      <Modal open={addOpen} title="افزودن عضو عموم" description={addFromGap.current ? 'از گپ انتخابشده برای تکمیل نقشه استفاده میکنید' : 'منبع را از سازمان/شخص/رابطه/رسانهٔ موجود انتخاب کنید؛ موتور پیوند و مرحله را پیشنهاد میدهد.'} onClose={() => setAddOpen(false)}
        footer={<><button className="btn" onClick={() => setAddOpen(false)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'add'} onClick={addMember}><Plus size={14} /> افزودن</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">گروه عموم <span className="req">*</span></label>
            <select value={addForm.groupId} onChange={e => { setAddForm(f => ({ ...f, groupId: e.target.value })); addFromGap.current = null; }}>
              <option value="">انتخاب گروه…</option>
              {catMeta.map(c => (
                <optgroup key={c.id} label={`${c.fa} (${(groupsByCat[c.id] ?? []).length})`}>
                  {(groupsByCat[c.id] ?? []).map(g => (
                    <option key={g.id} value={g.id}>{g.fa} — {PUBLIC_G(g.link)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {addForm.groupId && (() => { const g = tpl?.groups?.find(x => x.id === addForm.groupId); return g ? <span className="field-hint">کانال پیشنهادی: {g.kanal}{g.note ? ` · ${g.note}` : ''} · موضع پایهٔ قالب: {PUBLIC_S(g.stance)}</span> : null; })()}
          </div>
          <div className="field">
            <label className="field-label">نوع منبع <span className="req">*</span></label>
            <select value={addForm.sourceType} onChange={e => setAddForm(f => ({ ...f, sourceType: e.target.value, sourceId: '' }))}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">منبع <span className="req">*</span></label>
            <select value={addForm.sourceId} onChange={e => setAddForm(f => ({ ...f, sourceId: e.target.value }))}>
              <option value="">انتخاب…</option>
              {addForm.sourceType === 'organization' && orgs.filter(o => o.id !== orgId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              {addForm.sourceType === 'person' && people.map(p => <option key={p.id} value={p.id}>{p.firstName ?? ''} {p.lastName ?? ''}{p.title ? ` — ${p.title}` : ''}{p.organization?.name ? ` (${p.organization.name})` : ''}</option>)}
              {addForm.sourceType === 'relationship' && rels.map(r => <option key={r.id} value={r.id}>{r.sourceOrganization?.name ?? '—'} ↔ {r.targetOrganization?.name ?? '—'}</option>)}
              {addForm.sourceType === 'media' && media.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت (اختیاری)</label>
            <input value={addForm.note} onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))} placeholder="مثلاً: طرف مکاتبه در پروندهٔ …" />
          </div>
        </div>
      </Modal>

      <Modal open={!!assessFor} title={`ارزیابی: ${assessFor?.groupFa ?? assessFor?.groupId ?? ''}`} description={assessFor?.sourceName ? `منبع: ${assessFor.sourceName} · ${sourceLabel(assessFor.sourceType)} · سیگنالهای ۹۰ روزه: ${fmtNum(assessFor.signals)}` : undefined} onClose={() => setAssessFor(null)}
        footer={<><button className="btn" onClick={() => setAssessFor(null)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'assess'} onClick={assessMember}><SlidersHorizontal size={14} /> ثبت ارزیابی</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">موضع خودکار از قدرت/علاقه: <b>{PUBLIC_S(stanceOf(assessForm.power, assessForm.interest))}</b></label>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label className="field-label">قدرت (نفوذ) — {fmtNum(assessForm.power)}</label>
                <input type="range" min={0} max={100} value={assessForm.power} onChange={e => setAssessForm(f => ({ ...f, power: Number(e.target.value) }))} />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label className="field-label">علاقه (خواست/تعهد) — {fmtNum(assessForm.interest)}</label>
                <input type="range" min={0} max={100} value={assessForm.interest} onChange={e => setAssessForm(f => ({ ...f, interest: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <div className="field">
            <label className="field-label">مرحلهٔ بلوغ</label>
            <select value={assessForm.stage} onChange={e => setAssessForm(f => ({ ...f, stage: e.target.value }))}>
              {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">نوع پیوند</label>
            <select value={assessForm.linkage} onChange={e => setAssessForm(f => ({ ...f, linkage: e.target.value }))}>
              {Object.entries(catalog?.linkages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">موضع</label>
            <select value={assessForm.stance} onChange={e => setAssessForm(f => ({ ...f, stance: e.target.value }))}>
              {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">سررسید بازبینی تازه</label>
            <label className="chip info" style={{ cursor: 'pointer' }}><input type="checkbox" checked={assessForm.assess} onChange={e => setAssessForm(f => ({ ...f, assess: e.target.checked }))} /> ارزیابی تازه (۹۰ روز از امروز)</label>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت ارزیابی</label>
            <textarea value={assessForm.note} onChange={e => setAssessForm(f => ({ ...f, note: e.target.value }))} placeholder="شاهد/دلیل تغییر مرحله یا موضع…" />
          </div>
        </div>
      </Modal>

      <Modal open={mediaOpen} title="ثبت رسانهٔ تازه" description="رسانه/اینفلوئنسر به فهرست منابع میپیوندد و گردشکار پایش (MEDIA_CREATED) اجرا میشود." onClose={() => setMediaOpen(false)}
        footer={<><button className="btn" onClick={() => setMediaOpen(false)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'media'} onClick={addMedia}><Megaphone size={14} /> ثبت</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">نام رسانه <span className="req">*</span></label>
            <input value={mediaForm.name} onChange={e => setMediaForm(f => ({ ...f, name: e.target.value }))} placeholder="مثلاً: خبرگزاری فارس" />
          </div>
          <div className="field">
            <label className="field-label">نوع</label>
            <select value={mediaForm.type} onChange={e => setMediaForm(f => ({ ...f, type: e.target.value }))}>
              {MEDIA_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">آدرس</label>
            <input value={mediaForm.url} onChange={e => setMediaForm(f => ({ ...f, url: e.target.value }))} placeholder="example.com" style={{ direction: 'ltr', textAlign: 'right' }} />
          </div>
          <div className="field">
            <label className="field-label">دامنهٔ مخاطب</label>
            <input value={mediaForm.audience} onChange={e => setMediaForm(f => ({ ...f, audience: e.target.value }))} placeholder="تخصصی فناوری" />
          </div>
          <div className="field">
            <label className="field-label">کشور</label>
            <input value={mediaForm.country} onChange={e => setMediaForm(f => ({ ...f, country: e.target.value }))} placeholder="ایران" />
          </div>
          <div className="field full">
            <label className="field-label">یادداشت</label>
            <textarea value={mediaForm.note} onChange={e => setMediaForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PUBLIC_G(v: string) {
  return ({ ENABLING: 'فعالکننده', FUNCTIONAL_INPUT: 'کارکردی-ورودی', FUNCTIONAL_OUTPUT: 'کارکردی-خروجی', NORMATIVE: 'هنجاری', DIFFUSED: 'پراکنده' } as Record<string, string>)[v] ?? v;
}
function PUBLIC_S(v: string) {
  return ({ KEY_PLAYER: 'بازیگر کلیدی', INFLUENCER: 'تأثیرگذار', SUPPORTER: 'حامی', OBSERVER: 'ناظر' } as Record<string, string>)[v] ?? v;
}
function sourceLabel(t: string) {
  return ({ organization: 'سازمان', person: 'شخص', relationship: 'رابطه', media: 'رسانه' } as Record<string, string>)[t] ?? t;
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

/* ماتریس قدرت × علاقه */
function Matrix({ members, catOf, openAssess, canWrite }: {
  members: MemberView[]; catOf: (id?: string | null) => string; openAssess: (m: MemberView) => void; canWrite: boolean;
}) {
  const W = 100, H = 62; // درصدی
  return (
    <div>
      <div style={{ position: 'relative', width: '100%', height: 320, background: 'var(--card-bg-soft)', borderRadius: 12, border: '1px solid var(--card-border-strong)', overflow: 'hidden' }}>
        {/* quadrants */}
        {[
          { x: 50, y: 0, w: 50, h: 31, label: 'بازیگر کلیدی', color: 'var(--srip-danger)', bg: 'color-mix(in srgb, var(--srip-danger) 6%, transparent)' },
          { x: 0, y: 0, w: 50, h: 31, label: 'تأثیرگذار', color: 'var(--srip-amber)', bg: 'color-mix(in srgb, var(--srip-amber) 6%, transparent)' },
          { x: 50, y: 31, w: 50, h: 31, label: 'حامی', color: 'var(--srip-accent)', bg: 'color-mix(in srgb, var(--srip-accent) 6%, transparent)' },
          { x: 0, y: 31, w: 50, h: 31, label: 'ناظر', color: 'var(--text-muted)', bg: 'transparent' },
        ].map((q, i) => (
          <div key={i} style={{ position: 'absolute', left: `${q.x}%`, top: `${q.y / H * 100}%`, width: `${q.w}%`, height: `${q.h / H * 100}%`, background: q.bg, border: '1px dashed color-mix(in srgb, var(--card-border-strong) 80%, transparent)', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: q.color, opacity: .85 }}>{q.label}</span>
          </div>
        ))}
        {/* axes */}
        <div style={{ position: 'absolute', insetInlineStart: 0, top: '50%', width: '100%', borderTop: '1px solid var(--card-border-strong)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderInlineStart: '1px solid var(--card-border-strong)' }} />
        {/* dots */}
        {members.map(m => (
          <button
            key={m.id} type="button"
            title={`${m.groupFa ?? m.groupId} — قدرت ${m.power}/علاقه ${m.interest} · ${m.stageFa ?? m.stage} · ${m.stanceFa ?? m.stance}`}
            onClick={() => canWrite && openAssess(m)}
            style={{
              position: 'absolute',
              left: `${clamp(m.interest) / 100 * W}%`,
              top: `${(H - clamp(m.power) / 100 * H) / H * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 12, height: 12, borderRadius: '50%',
              background: CAT_COLORS[m.categoryId ?? ''] ?? 'var(--srip-accent)',
              border: '2px solid var(--card-bg)', cursor: canWrite ? 'pointer' : 'default',
              boxShadow: '0 1px 4px rgba(0,0,0,.25)',
            }}
          />
        ))}
        <div style={{ position: 'absolute', top: 6, insetInlineStart: 10, fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)' }}>قدرت ↑</div>
        <div style={{ position: 'absolute', bottom: 6, insetInlineEnd: 10, fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)' }}>علاقه ←</div>
      </div>
      <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {Object.keys(CAT_COLORS).map(c => (
          <span key={c} className="chip neutral"><span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[c] }} />{catOf(c)}</span>
        ))}
      </div>
    </div>
  );
}
