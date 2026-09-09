'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiBlob, unwrapList } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard, StatusBadge, Toolbar } from '../_components/page-ui';
import {
  Building2, Users2, Radar, AlertTriangle, Download, FileJson, FileSpreadsheet, Fingerprint,
  Plus, RefreshCw, Trash2, SlidersHorizontal, Megaphone, Newspaper, Target, Eye, Heart,
  CheckCircle2, ChevronLeft, Layers, Landmark, GraduationCap, Briefcase, Newspaper as News2, Cpu,
  Copy, Sparkles, UserPlus, Pencil, RotateCcw, Power,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  عموم‌ها (Publics) — شناسنامهٔ سازمان، بازیگران و شکاف‌ها                      */
/*  GET catalog/self/:orgId · groups/:orgId · members · coverage · gaps */
/*  PUT self/:orgId · groups CRUD · POST/PATCH/DELETE members · export  */
/* ------------------------------------------------------------------ */

type CatMeta = { id: string; fa: string };
type PubGroup = {
  id: string; cat: string; fa: string; link: string; stage: [string, string];
  stance: string; kanal: string; note?: string;
};
type PubTpl = { id: string; fa: string; focus: string[]; note?: string; groups?: PubGroup[] };
type EffGroup = {
  id: string; cat: string; fa: string; link: string; stage: [string, string];
  stance: string; kanal: string; note: string; source: 'template' | 'custom';
  overridden: boolean; active: boolean; templateNote: string;
};
type GroupTotals = { total: number; active: number; inactive: number; custom: number; overridden: number };
type GroupsResp = { orgId: string; orgName: string | null; templateId: string; templateFa: string; groups: EffGroup[]; totals: GroupTotals };
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
  effective: { total: number; active: number; custom: number; overridden: number } | null;
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
type GapPathSuggestion = {
  category: string; categoryFa?: string | null;
  route: Array<{ id: string; label: string }>;
  hops: number; direct: boolean; bridges?: string[];
  note?: string; candidates?: string[];
};
type GapRow = {
  gapId: string; groupId?: string | null; groupFa?: string | null; categoryId?: string | null;
  categoryFa?: string | null; kind: 'missing' | 'lagging'; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  stance?: string | null; stanceFa?: string | null; memberId?: string | null; sourceName?: string | null; action?: string;
  pathSuggestion?: GapPathSuggestion | null;
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

  const [tab, setTab] = useState<'self' | 'groups' | 'members' | 'coverage' | 'gaps' | 'export'>('self');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selfRow, setSelfRow] = useState<SelfRow | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [gaps, setGaps] = useState<GapsResp | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [orgs, setOrgs] = useState<OrgMini[]>([]);
  const [people, setPeople] = useState<PersonMini[]>([]);
  const [rels, setRels] = useState<RelMini[]>([]);
  const [groups, setGroups] = useState<EffGroup[]>([]);
  const [groupTotals, setGroupTotals] = useState<GroupTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');

  /* filters */
  const [fCat, setFCat] = useState('');
  const [fStance, setFStance] = useState('');
  const [fStage, setFStage] = useState('');
  const [q, setQ] = useState('');
  const [gCat, setGCat] = useState('');
  const [gSrc, setGSrc] = useState('');
  const [gQ, setGQ] = useState('');

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

  /* group manager */
  const [gModal, setGModal] = useState<{ mode: 'create' } | { mode: 'edit'; g: EffGroup } | null>(null);
  const [gForm, setGForm] = useState({ cat: 'INTERNAL', fa: '', link: 'DIFFUSED', smin: 'AWARE', smax: 'ACTIVE', stance: 'OBSERVER', kanal: '', note: '' });
  const [gBusy, setGBusy] = useState(false);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 6000);
  };

  const refresh = useCallback(async (oid: string) => {
    setLoading(true); setError('');
    try {
      const [cat, self, grp, mem, cov, gap, med, orgsList, ppl, rls] = await Promise.all([
        api<Catalog>('/publics/catalog'),
        api<SelfRow>(`/publics/self/${oid}`).catch(() => null),
        api<GroupsResp>(`/publics/groups/${oid}`).catch(() => null),
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
      setGroups(grp?.groups ?? []);
      setGroupTotals(grp?.totals ?? null);
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
    const map: Record<string, EffGroup[]> = {};
    for (const g of groups.filter(x => x.active !== false)) { (map[g.cat] ??= []).push(g); }
    return map;
  }, [groups]);
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

  /* ---------- group manager ---------- */
  const filteredGroups = useMemo(() => {
    const needle = (gQ || '').trim();
    return groups.filter(g =>
      (!gCat || g.cat === gCat) &&
      (!gSrc || (gSrc === 'custom' ? g.source === 'custom' : gSrc === 'overridden' ? g.overridden : gSrc === 'inactive' ? g.active === false : g.source === 'template' && !g.overridden)) &&
      (!needle || [g.fa, g.note, g.kanal].some(v => v && String(v).includes(needle))),
    );
  }, [groups, gCat, gSrc, gQ]);
  const openGroupCreate = () => {
    setGForm({ cat: 'INTERNAL', fa: '', link: 'DIFFUSED', smin: 'AWARE', smax: 'ACTIVE', stance: 'OBSERVER', kanal: '', note: '' });
    setGModal({ mode: 'create' });
  };
  const openGroupEdit = (g: EffGroup) => {
    setGForm({ cat: g.cat, fa: g.fa, link: g.link, smin: g.stage[0], smax: g.stage[1], stance: g.stance, kanal: g.kanal, note: g.note });
    setGModal({ mode: 'edit', g });
  };
  const saveGroup = async () => {
    if (!gModal) return;
    if (!gForm.fa.trim()) { notify('نام گروه لازم است.'); return; }
    setGBusy(true);
    try {
      if (gModal.mode === 'create') {
        await api<EffGroup>(`/publics/groups/${orgId}`, { method: 'POST', body: JSON.stringify({ ...gForm, fa: gForm.fa.trim(), kanal: gForm.kanal.trim(), note: gForm.note.trim() }) });
        notify(`گروه «${gForm.fa.trim()}» ساخته و به نقشهٔ سازمان اضافه شد.`);
      } else {
        await api<EffGroup>(`/publics/groups/${orgId}/${gModal.g.id}`, { method: 'PUT', body: JSON.stringify({ ...gForm, fa: gForm.fa.trim(), kanal: gForm.kanal.trim(), note: gForm.note.trim() }) });
        notify(`تغییرات گروه «${gForm.fa.trim()}» فقط در نقشهٔ همین سازمان ذخیره شد.`);
      }
      setGModal(null);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setGBusy(false); }
  };
  const toggleGroup = async (g: EffGroup) => {
    setBusy(`gtog-${g.id}`);
    try {
      await api<EffGroup>(`/publics/groups/${orgId}/${g.id}`, { method: 'PUT', body: JSON.stringify({ active: g.active === false }) });
      notify(g.active === false ? `گروه «${g.fa}» فعال شد و به پوشش بازگشت.` : `گروه «${g.fa}» غیرفعال شد و از پوشش خارج شد.`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };
  const restoreGroup = async (g: EffGroup) => {
    setBusy(`gres-${g.id}`);
    try {
      await api<EffGroup>(`/publics/groups/${orgId}/${g.id}`, { method: 'PUT', body: JSON.stringify({ restore: true }) });
      notify(`گروه «${g.fa}» به حالت الگو بازگشت.`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };
  const deleteGroup = async (g: EffGroup) => {
    if (!window.confirm(`گروه اختصاصی «${g.fa}» به‌طور دائم حذف شود؟`)) return;
    setBusy(`gdel-${g.id}`);
    try {
      await api(`/publics/groups/${orgId}/${g.id}`, { method: 'DELETE' });
      notify('گروه اختصاصی حذف شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- self save ---------- */
  const saveSelf = async () => {
    if (!canWrite) { notify('مجوز ویرایش «عموم‌ها» را ندارید.'); return; }
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
      notify('شناسنامهٔ سازمان ذخیره شد؛ نقشهٔ عموم‌ها به‌روزرسانی شد.');
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
    if (!addForm.groupId || !addForm.sourceId) { notify('گروه و منبع را انتخاب کنید.'); return; }
    setBusy('add');
    try {
      const created = await api<MemberView>('/publics/members', {
        method: 'POST',
        body: JSON.stringify({ orgId, ...addForm }),
      });
      setAddOpen(false);
      const s = created.suggested;
      notify(`عضو «${created.groupFa ?? created.groupId}» افزوده شد — پیشنهاد موتور: ${created.linkageFa ?? created.linkage}، ${created.stageFa ?? created.stage}، قدرت ${s?.power ?? created.power}/علاقه ${s?.interest ?? created.interest}، ${created.stanceFa ?? created.stance}${addFromGap.current ? ' — شکاف انتخاب‌شده پوشش داده شد.' : ''}`);
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
    if (!window.confirm(`«${m.groupFa ?? m.groupId}» از نقشهٔ عموم‌ها حذف شود؟`)) return;
    setBusy(`del-${m.id}`);
    try {
      await api(`/publics/members/${m.id}`, { method: 'DELETE' });
      notify('عضو از نقشه حذف شد.');
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
      notify('رسانه ثبت شد و به فهرست منابع اضافه شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- export ---------- */
  const downloadExport = async (format: 'json' | 'csv' | 'xls') => {
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
        const fmt = format === 'xls' ? 'xls' : 'csv';
        const blob = await apiBlob(`/publics/export?orgId=${encodeURIComponent(orgId)}&format=${fmt}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `publics-${orgId}.${fmt}`; a.click();
        URL.revokeObjectURL(url);
      }
      notify('خروجی نقشهٔ عموم‌ها آماده شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const runReview = async () => {
    setBusy('review');
    try {
      const r = await api<{ total: number }>(`/publics/review-due?orgId=${encodeURIComponent(orgId)}`);
      notify(r.total ? `بازبینی ${fmtNum(r.total)} عموم سررسید شده است؛ گردش‌کار بازبینی اجرا شد.` : 'بازبینی سررسیدشده‌ای وجود ندارد؛ همهٔ اعضا به‌تازگی ارزیابی شده‌اند.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const TABS: Array<{ key: typeof tab; label: string; icon?: React.ReactNode }> = [
    { key: 'self', label: 'شناسنامهٔ سازمان', icon: <Fingerprint size={14} /> },
    { key: 'groups', label: 'گروه‌ها', icon: <Layers size={14} /> },
    { key: 'members', label: 'اعضا و ارزیابی', icon: <Users2 size={14} /> },
    { key: 'coverage', label: 'پوشش', icon: <Radar size={14} /> },
    { key: 'gaps', label: 'شکاف‌ها و اقدام', icon: <AlertTriangle size={14} /> },
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

  const briefText = useMemo(() => {
    const cov = coverage?.totals;
    const pct = cov && cov.groupsExpected ? Math.round((cov.groupsCovered / cov.groupsExpected) * 100) : 0;
    const crit = (gaps?.gaps ?? []).filter(g => g.severity === 'CRITICAL');
    const top = crit.slice(0, 3);
    const route = top[0]?.pathSuggestion?.route.map(r => r.label).join(' ← ') ?? '—';
    return [
      `${coverage?.orgName ?? orgId} — خلاصهٔ مدیریتی نقشهٔ عموم‌ها`,
      `الگو: ${coverage?.templateFa ?? '—'} · ${fmtNum(cov?.groupsExpected ?? 0)} گروه · ${fmtNum(cov?.members ?? 0)} عضو ثبت‌شده · پوشش ${fmtNum(pct)}٪`,
      `شکاف‌ها: ${fmtNum(gaps?.totals.gaps ?? 0)} مورد (${fmtNum(gaps?.totals.criticalGaps ?? 0)} بحرانی) · بازیگر کلیدی: ${fmtNum(cov?.keyPlayers ?? 0)}`,
      top.length ? `اولویت‌های فوری: ${top.map(g => `${g.groupFa}${g.categoryFa ? ` (${g.categoryFa})` : ''}`).join('؛ ')}` : 'شکاف بحرانی فعالی وجود ندارد.',
      `اقدام اول: ${top[0]?.action ?? 'بازبینی دوره‌ای و تعامل با بازیگران کلیدی'} — مسیر پیشنهادی: ${route}`,
      `پیشنهاد: ${crit[0]?.pathSuggestion?.direct ? 'ورود مستقیم به گپ' : (top[0]?.pathSuggestion ? 'تقویت کانال موجود در شبکه' : 'بازبینی و تکمیل نقشه')}`,
    ].join('\n');
  }, [coverage, gaps, orgId]);

  if (!canRead) {
    return (
      <div className="page">
        <PageHeader eyebrow="عموم‌ها" title="نقشهٔ عموم‌ها" description="شناسنامهٔ سازمان و بازیگران اثرگذار" />
        <ErrorCard message="مجوز مشاهدهٔ ماژول «عموم‌ها» را ندارید." />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="عموم‌ها"
        title="نقشهٔ عموم‌ها"
        description="شناخت سازمان، چیدمان گروه‌ها، ارزیابی اعضا و تبدیل شکاف‌ها به اقدام"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="scope-chip" title="سازمانی که نقشهٔ عموم‌های آن را مشاهده می‌کنید">
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
      {loading && <Loading label="در حال بارگذاری نقشهٔ عموم‌ها…" />}

      {!loading && (
        <>
          <nav className="tabs" role="tablist" aria-label="بخش‌های عموم‌ها">
            {TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'tab-active' : ''} onClick={() => setTab(t.key)}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>

          {/* ---------------- شناسنامهٔ سازمان ---------------- */}
          {tab === 'self' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="grid-2" style={{ gap: 14 }}>
                <SectionCard
                  title="ویرایش شناسنامه"
                  icon={<Fingerprint size={15} />}
                  description={canWrite ? 'مشخصات سازمان را کامل کنید و «ذخیرهٔ شناسنامه» را بزنید؛ مبنای پوشش، شکاف‌ها و خلاصهٔ مدیریتی همین است.' : 'نمای خواندنی'}
                  actions={canWrite && <button className="btn btn-primary" disabled={busy === 'self'} onClick={saveSelf}><CheckCircle2 size={14} /> ذخیرهٔ شناسنامه</button>}
                >
                  <div className="form-grid">
                    <div className="field full">
                      <label className="field-label">نوع شرکت (الگوی شروع)</label>
                      <select value={selfForm.companyType} disabled={!canWrite} onChange={e => { setSelfForm(f => ({ ...f, companyType: e.target.value })); setSelfDirty(true); }}>
                        {(Object.values(catalog?.templates ?? {}) as PubTpl[]).map(t => (
                          <option key={t.id} value={t.id}>{t.fa}</option>
                        ))}
                      </select>
                      <span className="field-hint">الگو فقط فهرست آغازین است؛ در تب «گروه‌ها» آن را ویژهٔ سازمان خود کنید.{tpl?.note ? ` راهنمای الگو: ${tpl.note}` : ''}</span>
                    </div>
                    <div className="field full">
                      <label className="field-label">مأموریت سازمان</label>
                      <input value={selfForm.missionTopic} disabled={!canWrite} placeholder="مثلاً: پیشرو در فناوری‌های نوین کشور" onChange={e => { setSelfForm(f => ({ ...f, missionTopic: e.target.value })); setSelfDirty(true); }} />
                      <span className="field-hint">جملهٔ راهنمای سازمان شما؛ در خلاصهٔ مدیریتی و اولویت‌بندی شکاف‌ها به کار می‌رود.</span>
                    </div>
                    <div className="field">
                      <label className="field-label">دورهٔ بازبینی (روز)</label>
                      <input type="number" min={30} max={365} value={selfForm.reviewIntervalDays} disabled={!canWrite} onChange={e => { setSelfForm(f => ({ ...f, reviewIntervalDays: Number(e.target.value) })); setSelfDirty(true); }} />
                      <span className="field-hint">شناسنامه هر چند روز یک‌بار بازبینی می‌شود؟</span>
                    </div>
                    <div className="field">
                      <label className="field-label">نوع مالکیت</label>
                      <select value={selfForm.ownership} disabled={!canWrite} onChange={e => { setSelfForm(f => ({ ...f, ownership: e.target.value })); setSelfDirty(true); }}>
                        {[['PRIVATE', 'خصوصی'], ['STATE', 'دولتی'], ['PUBLIC', 'عمومی/بورسی'], ['FAMILY', 'خانوادگی']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="field full">
                      <label className="field-label">شرکت‌های تابعه</label>
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
                      <span className="field-hint">شرکت‌های زیرمجموعهٔ شما؛ در تب «اعضا و ارزیابی» می‌توانید آن‌ها را به نقشه بیفزایید.</span>
                    </div>
                  </div>
                  {selfDirty && <div className="field-hint" style={{ marginTop: 8 }}>تغییرات ذخیره نشده است؛ دکمهٔ «ذخیرهٔ شناسنامه» را بزنید.</div>}
                </SectionCard>

                <SectionCard title="شناسنامهٔ سازمان" icon={<Fingerprint size={15} />} description={`${selectedOrgName} · الگوی شروع: ${selfRow?.template?.fa ?? '—'} · ${fmtNum(selfRow?.effective?.active ?? 0)} گروه فعال`} actions={<button className="chip info" onClick={() => setTab('groups')}>مدیریت گروه‌ها <ChevronLeft size={12} /></button>}>
                  <div className="stat-grid" style={{ marginBottom: 12 }}>
                    <StatCard icon={<Building2 size={16} />} iconClass="ic-teal" label="سازمان" value={selectedOrgName} />
                    <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروه‌های الگو" value={fmtNum(selfRow?.template?.groups ?? tpl?.groups?.length ?? 0)} sub={`${fmtNum(selfRow?.effective?.active ?? selfRow?.coverage.groupsExpected ?? 0)} فعال در نقشه · ${fmtNum(selfRow?.coverage.groupsCovered ?? 0)} پوشش‌داده‌شده`} />
                    <StatCard icon={<Users2 size={16} />} iconClass="ic-purple" label="اعضای ثبت‌شده" value={fmtNum(selfRow?.coverage.members ?? members.length)} sub={`${fmtNum(selfRow?.coverage.keyPlayers ?? 0)} بازیگر کلیدی`} />
                    <StatCard icon={<Radar size={16} />} iconClass="ic-orange" label="پوشش" value={`${Math.round(((selfRow?.coverage.groupsCovered ?? 0) / Math.max(1, selfRow?.coverage.groupsExpected ?? 1)) * 100)}٪`} sub={`${fmtNum(selfRow?.coverage.groupsExpected ?? 0)} گروه`} />
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>دسته</th><th>گروه‌ها</th><th>کانال اصلی</th><th>یادداشت</th></tr></thead>
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
                description="هر نقطه یک عضو است و رنگ آن، دسته را نشان می‌دهد. برای ارزیابی، روی نقطه کلیک کنید. هدف: قرارگیری بازیگران کلیدی در ربع بالا-راست (قدرت و علاقهٔ بالا)."
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
                    <option value="">همهٔ دسته‌ها</option>
                    {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
                  </select>
                  <select aria-label="موضع" value={fStance} onChange={e => setFStance(e.target.value)}>
                    <option value="">همهٔ مواضع</option>
                    {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select aria-label="مرحله" value={fStage} onChange={e => setFStage(e.target.value)}>
                    <option value="">همهٔ مراحل</option>
                    {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {canWrite && <button className="btn" onClick={() => openAdd()}><Plus size={14} /> عضو جدید</button>}
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
                          <td><b>{fmtNum(m.power)}</b><span className="t-muted"> / </span><b>{fmtNum(m.interest)}</b>{m.signals != null && <div className="t-muted" style={{ fontSize: 10.5 }}>{fmtNum(m.signals)} سیگنال ۹۰ روز اخیر</div>}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{fmtDT(m.reviewDue)}</td>
                          {canWrite && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn icon-only" title="ارزیابی و به‌روزرسانی" onClick={() => openAssess(m)}><SlidersHorizontal size={13} /></button>
                                <button className="btn icon-only danger" title="حذف" disabled={busy === `del-${m.id}`} onClick={() => removeMember(m)}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!filteredMembers.length && (
                        <tr><td colSpan={canWrite ? 9 : 8}><div className="empty-state-v4" style={{ padding: 18 }}><p>عضوی با این فیلترها یافت نشد؛ از دکمهٔ «افزودن عضو» استفاده کنید.</p></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- گروه‌ها ---------------- */}
          {tab === 'groups' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروه‌های فعال نقشه" value={fmtNum(groupTotals?.active ?? 0)} sub={`${fmtNum(groupTotals?.total ?? 0)} گروه در نقشه`} />
                <StatCard icon={<Sparkles size={16} />} iconClass="ic-purple" label="گروه اختصاصی" value={fmtNum(groupTotals?.custom ?? 0)} sub="ساختهٔ شما" />
                <StatCard icon={<Pencil size={16} />} iconClass="ic-teal" label="ویرایش‌شده از الگو" value={fmtNum(groupTotals?.overridden ?? 0)} sub="نام/یادداشت/کانال عوض شده" />
                <StatCard icon={<Power size={16} />} iconClass="ic-orange" label="غیرفعال" value={fmtNum(groupTotals?.inactive ?? 0)} sub="در پوشش محاسبه نمی‌شود" />
              </div>
              <SectionCard
                title="گروه‌های نقشه"
                icon={<Layers size={15} />}
                description="الگو نقطهٔ شروع است: نام، یادداشت، کانال و موضع هر گروه را ویژهٔ سازمان خود کنید؛ گروه‌های غیرضروری را غیرفعال کنید و در صورت نیاز گروه جدید بسازید. پوشش، شکاف‌ها و خلاصهٔ مدیریتی از همین فهرست ساخته می‌شوند."
                actions={canWrite && <button className="btn btn-primary" onClick={openGroupCreate}><Plus size={14} /> گروه جدید</button>}
              >
                <Toolbar search={gQ} onSearch={setGQ} searchPlaceholder="جستجوی گروه/یادداشت…">
                  <select aria-label="دسته" value={gCat} onChange={e => setGCat(e.target.value)}>
                    <option value="">همهٔ دسته‌ها</option>
                    {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
                  </select>
                  <select aria-label="منبع" value={gSrc} onChange={e => setGSrc(e.target.value)}>
                    <option value="">همهٔ منابع</option>
                    <option value="custom">اختصاصی</option>
                    <option value="overridden">ویرایش‌شده</option>
                    <option value="template">بدون تغییر</option>
                    <option value="inactive">غیرفعال‌ها</option>
                  </select>
                </Toolbar>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>گروه</th><th>دسته</th><th>منبع</th><th>وضعیت</th><th>یادداشت</th>{canWrite && <th>اقدام</th>}</tr>
                    </thead>
                    <tbody>
                      {filteredGroups.map(g => (
                        <tr key={g.id} data-gid={g.id} data-active={g.active === false ? 'false' : 'true'}>
                          <td><b style={{ fontSize: 12 }}>{g.fa}</b>{g.kanal && <div className="t-muted" style={{ fontSize: 10.5 }}>کانال: {g.kanal}</div>}<div className="t-muted" style={{ fontSize: 10.5 }}>{PUBLIC_G(g.link)} · موضع پایه: {PUBLIC_S(g.stance)}</div></td>
                          <td><StatusBadge tone="neutral">{CAT_ICONS[g.cat]}{catOf(g.cat)}</StatusBadge></td>
                          <td>{g.source === 'custom' ? <Badge tone="info">اختصاصی</Badge> : g.overridden ? <Badge tone="warning">ویرایش‌شده</Badge> : <Badge tone="neutral">الگو</Badge>}</td>
                          <td>{g.active === false ? <Badge tone="neutral">غیرفعال</Badge> : <Badge tone="success">فعال</Badge>}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{g.note || '—'}{g.overridden && g.templateNote && g.templateNote !== g.note && <div style={{ fontSize: 10.5 }}>یادداشت الگو: {g.templateNote}</div>}</td>
                          {canWrite && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn icon-only" data-act="edit" title="ویرایش" onClick={() => openGroupEdit(g)}><Pencil size={13} /></button>
                                <button className="btn icon-only" data-act="toggle" title={g.active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'} disabled={busy === `gtog-${g.id}`} onClick={() => toggleGroup(g)}><Power size={13} /></button>
                                {(g.overridden || g.active === false) && g.source === 'template' && <button className="btn icon-only" data-act="restore" title="بازگشت به الگو" disabled={busy === `gres-${g.id}`} onClick={() => restoreGroup(g)}><RotateCcw size={13} /></button>}
                                {g.source === 'custom' && <button className="btn icon-only danger" data-act="delete" title="حذف" disabled={busy === `gdel-${g.id}`} onClick={() => deleteGroup(g)}><Trash2 size={13} /></button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!filteredGroups.length && (
                        <tr><td colSpan={canWrite ? 6 : 5}><div className="empty-state-v4" style={{ padding: 18 }}><p>گروهی با این فیلترها یافت نشد.</p></div></td></tr>
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
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروه‌های نقشه" value={fmtNum(coverage?.totals.groupsExpected ?? 0)} sub={`${fmtNum(coverage?.totals.groupsCovered ?? 0)} پوشش‌داده‌شده`} />
                <StatCard icon={<Radar size={16} />} iconClass="ic-teal" label="٪ پوشش" value={`${Math.round(((coverage?.totals.groupsCovered ?? 0) / Math.max(1, coverage?.totals.groupsExpected ?? 1)) * 100)}٪`} />
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-orange" label="شکاف‌ها" value={fmtNum(coverage?.totals.gaps ?? 0)} sub={`${fmtNum(coverage?.totals.criticalGaps ?? 0)} بحرانی`} />
                <StatCard icon={<Eye size={16} />} iconClass="ic-purple" label="اعضای فعال" value={fmtNum(coverage?.totals.active ?? 0)} />
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                {(coverage?.byCategory ?? []).map(c => {
                  const pct = Math.round((c.covered / Math.max(1, c.expected)) * 100);
                  return (
                    <SectionCard key={c.categoryId} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{CAT_ICONS[c.categoryId]}{c.fa}</span>} description={`${fmtNum(c.covered)} از ${fmtNum(c.expected)} گروه پوشش‌داده‌شده · ${fmtNum(c.members)} عضو`}>
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
                        {c.criticalGaps.length > 0 && <span className="chip danger"><AlertTriangle size={12} /> {fmtNum(c.criticalGaps.length)} شکاف بحرانی</span>}
                        <button className="chip info" onClick={() => { setFCat(c.categoryId); setTab('members'); }}>مشاهدهٔ اعضای این دسته <ChevronLeft size={12} /></button>
                      </div>
                    </SectionCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- شکاف‌ها و اقدام ---------------- */}
          {tab === 'gaps' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid" data-kpi="publics">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="پوشش نقشه" value={`${fmtNum(coverage?.totals.groupsExpected ? Math.round((coverage.totals.groupsCovered / coverage.totals.groupsExpected) * 100) : 0)}٪`} sub={`${fmtNum(coverage?.totals.groupsCovered ?? 0)} از ${fmtNum(coverage?.totals.groupsExpected ?? 0)} گروه`} />
                <StatCard icon={<Target size={16} />} iconClass="ic-orange" label="شکاف بحرانی" value={fmtNum(gaps?.totals.criticalGaps ?? 0)} />
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-red" label="شکاف‌ها" value={fmtNum(gaps?.totals.gaps ?? 0)} />
                <StatCard icon={<Users2 size={16} />} iconClass="ic-purple" label="بازیگر کلیدی" value={fmtNum(coverage?.totals.keyPlayers ?? 0)} />
                <StatCard icon={<ClockIcon />} iconClass="ic-amber" label="سررسید بازبینی" value={fmtNum((members ?? []).filter(m => m.reviewDue && new Date(m.reviewDue).getTime() < Date.now()).length)} />
                <StatCard icon={<UserPlus size={16} />} iconClass="ic-green" label="عقب‌مانده" value={fmtNum(gaps?.totals.lagging ?? 0)} />
              </div>
              <SectionCard
                title="خلاصهٔ مدیریتی عموم‌ها"
                icon={<Sparkles size={15} />}
                description="خلاصهٔ اجرایی برای هیئت‌مدیره؛ ساخته‌شده از دادهٔ همین نقشه"
                actions={
                  <button className="btn" onClick={() => { navigator.clipboard?.writeText(briefText).then(() => notify('خلاصهٔ مدیریتی کپی شد.')).catch(() => notify('کپی خلاصهٔ مدیریتی ناموفق بود.')); }}><Copy size={13} /> کپی خلاصه</button>
                }
              >
                <pre data-brief="publics" dir="rtl" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.9, margin: 0, background: 'var(--card-bg-soft, #F7F9FC)', padding: '12px 14px', borderRadius: 10 }}>{briefText}</pre>
              </SectionCard>
              <SectionCard
                title="شکاف‌های نقشهٔ عموم‌ها"
                icon={<AlertTriangle size={15} />}
                description="نخست شکاف‌های بحرانی (بازیگر کلیدیِ غایب یا غیرفعال)، سپس اقدام پیشنهادی هر شکاف"
                actions={<button className="btn" disabled={busy === 'review'} onClick={runReview}><ClockIcon /> بررسی سررسید بازبینی</button>}
              >
                <div className="stack" style={{ gap: 8 }}>
                  {(gaps?.gaps ?? []).map(g => (
                    <div key={g.gapId} className="section-card" style={{ padding: '12px 14px', borderInlineStart: `3px solid ${g.severity === 'CRITICAL' ? 'var(--srip-danger)' : 'var(--srip-amber)'}` }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge tone={g.severity === 'CRITICAL' ? 'danger' : 'warning'}>{g.severity === 'CRITICAL' ? 'بحرانی' : 'بالا'}</Badge>
                        <Badge tone="neutral">{g.kind === 'lagging' ? 'عقب‌مانده' : 'غایب'}</Badge>
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
                      {g.pathSuggestion && (
                        <div className="gap-path" style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
                            <span style={{ fontWeight: 800, color: 'var(--srip-accent-text, #2457D6)' }}>مسیر پیشنهادی:</span>
                            {g.pathSuggestion.route.map((r, i) => (
                              <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {i > 0 && <span className="t-muted">←</span>}
                                <span className="chip neutral" style={{ fontSize: 10.5 }}>{r.label}{r.id?.endsWith(':') ? '' : ''}</span>
                              </span>
                            ))}
                            <span className="chip info" style={{ fontSize: 10.5 }}>
                              {g.pathSuggestion.direct ? 'ورود مستقیم' : `${g.pathSuggestion.hops} پرش`}
                            </span>
                          </div>
                          <div className="t-muted" style={{ fontSize: 10.8 }}>
                            {g.pathSuggestion.note}
                            {g.pathSuggestion.candidates && g.pathSuggestion.candidates.length > 0
                              ? ` گزینه‌ها: ${g.pathSuggestion.candidates.join('، ')}`
                              : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!gaps?.gaps?.length && <div className="empty-state-v4" style={{ padding: 18 }}><p className="t-muted">نقشهٔ عموم‌ها شکافی ندارد.</p></div>}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- خروجی و رسانه ---------------- */}
          {tab === 'export' && (
            <div className="grid-2" style={{ gap: 14 }}>
              <SectionCard title="خروجی نقشهٔ عموم‌ها" icon={<Download size={15} />} description="کل نقشه با ارزیابی‌ها؛ برای گزارش هیئت‌مدیره یا تحلیل بیرونی">
                <div className="stack" style={{ gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy === 'exp-json'} onClick={() => downloadExport('json')}><FileJson size={14} /> خروجی JSON</button>
                  <button className="btn" disabled={busy === 'exp-csv'} onClick={() => downloadExport('csv')}><FileSpreadsheet size={14} /> خروجی CSV</button>
                  <button className="btn" disabled={busy === 'exp-xls'} onClick={() => downloadExport('xls')}><FileSpreadsheet size={14} /> خروجی Excel</button>
                  <span className="field-hint">ستون‌های خروجی: گروه، دسته، پیوند، مرحله، موضع، قدرت، علاقه، منبع، یادداشت، سررسید بازبینی.</span>
                </div>
              </SectionCard>
              <SectionCard
                title="رسانه‌ها و منابع خبری"
                icon={<Newspaper size={15} />}
                description="رسانه‌هایی که رصد می‌کنید؛ مبنای پوشش دستهٔ «رسانه و افکار عمومی»"
                actions={canWrite && <button className="btn btn-primary" onClick={() => setMediaOpen(true)}><Plus size={14} /> رسانهٔ جدید</button>}
              >
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>نام</th><th>نوع</th><th>مخاطب</th><th>کشور</th></tr></thead>
                    <tbody>
                      {media.map(m => (
                        <tr key={m.id}>
                          <td><b style={{ fontSize: 12 }}>{m.name}</b>{m.url && <div className="t-muted" style={{ fontSize: 10.5, direction: 'ltr', textAlign: 'right' }}>{m.url}</div>}</td>
                          <td><Badge tone="info">{MEDIA_TYPE_OPTIONS.find(([v]) => v === m.type)?.[1] ?? m.type}</Badge></td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{m.audience ?? '—'}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{m.country ?? '—'}</td>
                        </tr>
                      ))}
                      {!media.length && <tr><td colSpan={4}><div className="empty-state-v4" style={{ padding: 14 }}><p>هنوز رسانه‌ای ثبت نشده است.</p></div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* ---------- modals ---------- */}
      <Modal open={addOpen} title="افزودن عضو عموم" description={addFromGap.current ? 'از شکاف انتخاب‌شده برای تکمیل نقشه استفاده می‌کنید' : 'گروه را از نقشهٔ سازمان خود انتخاب کنید؛ موتور مرحله و قدرت و علاقهٔ اولیه را پیشنهاد می‌دهد و شما تأیید می‌کنید.'} onClose={() => setAddOpen(false)}
        footer={<><button className="btn" onClick={() => setAddOpen(false)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'add'} onClick={addMember}><Plus size={14} /> افزودن</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">گروه <span className="req">*</span></label>
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
            {addForm.groupId && (() => { const g = (groups ?? []).find(x => x.id === addForm.groupId); return g ? <span className="field-hint">پیشنهاد نقشه: {g.kanal ? `کانال «${g.kanal}» · ` : ''}موضع پایه «{PUBLIC_S(g.stance)}»{g.note ? ` · راهنما: ${g.note}` : ''}</span> : null; })()}
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

      <Modal open={gModal !== null} title={gModal?.mode === 'create' ? 'گروه جدید' : `ویرایش گروه: ${gModal?.mode === 'edit' ? gModal.g.fa : ''}`} description="این تغییر فقط در نقشهٔ سازمان شما اعمال می‌شود؛ الگوی مشترک بدون تغییر می‌ماند." onClose={() => setGModal(null)}
        footer={<><button className="btn" onClick={() => setGModal(null)}>انصراف</button><button className="btn btn-primary" disabled={gBusy} onClick={saveGroup}>{gModal?.mode === 'create' ? 'ساخت گروه' : 'ذخیره'}</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">نام گروه <span className="req">*</span></label>
            <input data-gi="fa" value={gForm.fa} onChange={e => setGForm(f => ({ ...f, fa: e.target.value }))} placeholder="مثلاً: کارگروه تحول دیجیتال" />
          </div>
          <div className="field">
            <label className="field-label">دسته</label>
            <select data-gi="cat" value={gForm.cat} onChange={e => setGForm(f => ({ ...f, cat: e.target.value }))}>
              {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">نوع پیوند</label>
            <select data-gi="link" value={gForm.link} onChange={e => setGForm(f => ({ ...f, link: e.target.value }))}>
              {Object.entries(catalog?.linkages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">موضع پایه</label>
            <select data-gi="stance" value={gForm.stance} onChange={e => setGForm(f => ({ ...f, stance: e.target.value }))}>
              {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">کانال پیشنهادی</label>
            <input data-gi="kanal" value={gForm.kanal} onChange={e => setGForm(f => ({ ...f, kanal: e.target.value }))} placeholder="مثلاً: مکاتبه رسمی" />
          </div>
          <div className="field">
            <label className="field-label">کف بازهٔ مرحله</label>
            <select data-gi="smin" value={gForm.smin} onChange={e => setGForm(f => ({ ...f, smin: e.target.value }))}>
              {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">سقف بازهٔ مرحله</label>
            <select data-gi="smax" value={gForm.smax} onChange={e => setGForm(f => ({ ...f, smax: e.target.value }))}>
              {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت گروه</label>
            <textarea data-gi="note" value={gForm.note} onChange={e => setGForm(f => ({ ...f, note: e.target.value }))} placeholder="راهنمای عملی کار با این گروه" />
            {gModal?.mode === 'edit' && gModal.g.source === 'template' && gModal.g.templateNote && (
              <span className="field-hint">یادداشت الگو: {gModal.g.templateNote}</span>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={!!assessFor} title={`ارزیابی: ${assessFor?.groupFa ?? assessFor?.groupId ?? ''}`} description={assessFor?.sourceName ? `منبع: ${assessFor.sourceName} · ${sourceLabel(assessFor.sourceType)} · سیگنال‌های ۹۰ روز اخیر: ${fmtNum(assessFor.signals)}` : undefined} onClose={() => setAssessFor(null)}
        footer={<><button className="btn" onClick={() => setAssessFor(null)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'assess'} onClick={assessMember}><SlidersHorizontal size={14} /> ثبت ارزیابی</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">موضع پیشنهادی بر اساس قدرت و علاقه: <b>{PUBLIC_S(stanceOf(assessForm.power, assessForm.interest))}</b></label>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label className="field-label">قدرت (نفوذ) — {fmtNum(assessForm.power)}</label>
                <input type="range" min={0} max={100} value={assessForm.power} onChange={e => setAssessForm(f => ({ ...f, power: Number(e.target.value) }))} />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label className="field-label">علاقه (تمایل و تعهد) — {fmtNum(assessForm.interest)}</label>
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
            <label className="field-label">بازبینی جدید</label>
            <label className="chip info" style={{ cursor: 'pointer' }}><input type="checkbox" checked={assessForm.assess} onChange={e => setAssessForm(f => ({ ...f, assess: e.target.checked }))} /> ثبت ارزیابی جدید (۹۰ روز از امروز)</label>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت ارزیابی</label>
            <textarea value={assessForm.note} onChange={e => setAssessForm(f => ({ ...f, note: e.target.value }))} placeholder="دلیل تغییر مرحله یا موضع…" />
          </div>
        </div>
      </Modal>

      <Modal open={mediaOpen} title="ثبت رسانهٔ جدید" description="رسانه به فهرست منابع اضافه می‌شود تا در نقشه قابل اتصال باشد." onClose={() => setMediaOpen(false)}
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
  return ({ ENABLING: 'فعال‌کننده', FUNCTIONAL_INPUT: 'کارکردی-ورودی', FUNCTIONAL_OUTPUT: 'کارکردی-خروجی', NORMATIVE: 'هنجاری', DIFFUSED: 'پراکنده' } as Record<string, string>)[v] ?? v;
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
