'use client';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Building2, User, Maximize2, X } from 'lucide-react';

export type EgoNode = {
  id: string;
  name: string;
  kind: 'organization' | 'person';
  sub?: string;
  status?: string;          // relationship status for orgs → edge color
  score?: number;           // drives node size
  href?: string;
  edgeStyle?: 'solid' | 'dashed';
  edgeColor?: string;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  WATCH: '#f5a623',
  AT_RISK: '#fb4d49',
  PROSPECTIVE: '#3b82f6',
  DORMANT: '#98a2b3',
  ARCHIVED: '#98a2b3',
};
const EDGE_DEFAULT = '#6366f1';
const MEMBER_COLOR = '#98a2b3';
const KIND_COLORS: Record<string, string> = {
  organization: '#6366f1',
  person: '#14ccb4',
};

const MAX_NODES = 16;

/** Ego graph — the entity at the center, its connections around it (pure SVG). */
export function EgoGraph({ center, centerHref, nodes, height = 360 }: {
  center: { name: string; kind: 'organization' | 'person'; sub?: string };
  centerHref?: string;
  nodes: EgoNode[];
  height?: number;
}) {
  const W = 560, H = height, CX = W / 2, CY = H / 2 - 6;
  const [fs, setFs] = useState(false);

  // تمام‌صفحه: Esc می‌بندد و اسکرول پس‌زمینه قفل می‌شود
  useEffect(() => {
    if (!fs) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setFs(false); };
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [fs]);

  const ring = useMemo(() => {
    const list = nodes.slice(0, MAX_NODES);
    const n = list.length;
    const rx = W / 2 - 74, ry = H / 2 - 66;
    return list.map((nd, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        ...nd,
        x: CX + Math.cos(angle) * rx,
        y: CY + Math.sin(angle) * ry,
        r: 11 + Math.min(9, (nd.score ?? 50) / 11),
      };
    });
  }, [nodes, W, H, CX, CY]);

  const edgeColorOf = (nd: EgoNode) => {
    if (nd.edgeColor) return nd.edgeColor;
    if (nd.edgeStyle === 'dashed') return MEMBER_COLOR;
    if (nd.status) return STATUS_COLORS[nd.status] ?? EDGE_DEFAULT;
    return EDGE_DEFAULT;
  };

  const short = (s: string, len = 14) => (s.length > len ? s.slice(0, len - 1) + '…' : s);

  /** بدنهٔ SVG (هم در کارت و هم در نمای تمام‌صفحه) */
  const svgBody = (widthCss: string) => (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`گراف ارتباطات ${center.name}`}
      style={{ width: widthCss, height: 'auto', display: 'block' }}>
      <defs>
        <radialGradient id="ego-center-grad" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#7c7ff7" />
          <stop offset="100%" stopColor="#4f46e5" />
        </radialGradient>
        <radialGradient id="ego-node-org" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </radialGradient>
        <radialGradient id="ego-node-person" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </radialGradient>
      </defs>

      {/* edges */}
      {ring.map(nd => (
        <line key={`e-${nd.id}`} x1={CX} y1={CY} x2={nd.x} y2={nd.y}
          stroke={edgeColorOf(nd)} strokeWidth={nd.edgeStyle === 'dashed' ? 1.4 : 2}
          strokeDasharray={nd.edgeStyle === 'dashed' ? '5 4' : undefined}
          opacity={0.65} />
      ))}

      {/* ring nodes */}
      {ring.map(nd => {
        const fill = nd.kind === 'person' ? 'url(#ego-node-person)' : 'url(#ego-node-org)';
        const body = (
          <>
            <circle cx={nd.x} cy={nd.y} r={nd.r} fill={fill} stroke="#fff" strokeWidth={2}
              style={{ transition: 'r .15s' }} />
            <title>{nd.name}{nd.status ? ` — ${nd.status}` : ''}</title>
            <text x={nd.x} y={nd.y + nd.r + 13} textAnchor="middle" fontSize={9.5}
              fontWeight={700} fill="var(--text-secondary)" style={{ pointerEvents: 'none' }}>
              {short(nd.name)}
            </text>
          </>
        );
        return nd.href
          ? <Link key={nd.id} href={nd.href} className="ego-node-link">{body}</Link>
          : <g key={nd.id} className="ego-node-link">{body}</g>;
      })}

      {/* center */}
      <circle cx={CX} cy={CY} r={38} fill="url(#ego-center-grad)" stroke="#fff" strokeWidth={3}
        className="ego-center-pulse" />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff">
        {short(center.name, 12)}
      </text>
      {centerHref && <Link href={centerHref} aria-label={`مشاهده ${center.name}`}>
        <circle cx={CX} cy={CY} r={44} fill="transparent" />
      </Link>}
      {center.sub && (
        <text x={CX} y={CY + 58} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--text-muted)">
          {short(center.sub, 26)}
        </text>
      )}
    </svg>
  );

  const legend = ring.length > 0 ? (
    <div className="ego-legend">
      <span className="chip info"><Building2 size={12}/> سازمان</span>
      <span className="chip" style={{ color: 'var(--teal)', borderColor: 'color-mix(in srgb,var(--teal) 32%,transparent)', background: 'color-mix(in srgb,var(--teal) 12%,transparent)' }}><User size={12}/> شخص</span>
      <span className="chip success">فعال</span>
      <span className="chip warning">در خطر</span>
      <span className="chip neutral">عضویت</span>
    </div>
  ) : null;

  const empty = ring.length === 0 ? (
    <div className="ego-empty"><Link2 size={20}/> هنوز ارتباطی برای این موجودیت ثبت نشده است.</div>
  ) : null;

  const fsOverlay = fs ? (
    createPortal(
      <div className="ego-fs" role="dialog" aria-modal="true" aria-label={`گراف ارتباطات تمام‌صفحه ${center.name}`}
        onMouseDown={(e) => { if ((e.target as HTMLElement).classList.contains('ego-fs')) setFs(false); }}>
        <div className="ego-fs-card">
          <header className="ego-fs-head">
            <div>
              <span className="eyebrow">نمای تمام‌صفحه</span>
              <h2>گراف ارتباطات {center.name}</h2>
            </div>
            <button className="ego-fs-close" onClick={() => setFs(false)} aria-label="بستن نمای تمام‌صفحه" title="بستن (Esc)">
              <X size={16}/>
            </button>
          </header>
          <div className="ego-fs-body">{svgBody('min(1180px,96vw)')}</div>
          {legend}
          {empty}
          <p className="ego-fs-note">برای جزئیات هر گره روی آن کلیک کنید — بستن با دکمهٔ بالا یا کلید Esc.</p>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      <div className="ego-card">
        {ring.length > 0 && (
          <button className="ego-fs-btn" onClick={() => setFs(true)} title="نمایش تمام‌صفحهٔ گراف ارتباطات"
            aria-label={`نمایش تمام‌صفحهٔ گراف ارتباطات ${center.name}`}>
            <Maximize2 size={13}/>
          </button>
        )}
        {svgBody('100%')}
        {legend}
        {empty}
      </div>
      {fsOverlay}
    </>
  );
}
