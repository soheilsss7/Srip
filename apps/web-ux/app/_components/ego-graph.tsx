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

const MAX_NODES = 16;
const W = 560;
const CENTER_R = 40;
/** حاشیهٔ امن بوم — هیچ متن/گره‌ای نباید از این محدوده بیرون بزند. */
const SAFE_X = 14;
const SAFE_TOP = 26;
const SAFE_BOTTOM = 20;
const LABEL_FONT = 9.4;
const LABEL_PAD = 5;        // پد پیلِ برچسب
const LABEL_DR = 7;         // فاصلهٔ امن برچسب از لبهٔ دایرهٔ گره

/** برآورد پهنای متن فارسی/لاتین (واحد viewBox) — کمی محافظه‌کارانه. */
function approxWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2fff || ch === ' ' ? fontSize * 0.68 : fontSize * 0.58;
  }
  return w;
}

/** برش متن به حداکثر پهنای مجاز + تضمین جا شدن با textLength. */
function fitText(text: string, fontSize: number, maxWidth: number): { text: string; textLength?: number } {
  const ellipsis = '…';
  let cur = text;
  if (approxWidth(cur, fontSize) <= maxWidth) return { text: cur };
  while (cur.length > 1 && approxWidth(cur + ellipsis, fontSize) > maxWidth) {
    cur = cur.slice(0, -1);
  }
  return { text: cur + ellipsis, textLength: Math.max(22, maxWidth) };
}

/** شکستن نام بلند به حداکثر دو خط — تا حتی در گوشه‌های بوم، نام کامل خوانا بماند. */
function wrapLabel(
  text: string,
  fontSize: number,
  maxWidth: number,
): { lines: string[]; textLength?: number; widths: number[] } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || approxWidth(text, fontSize) <= maxWidth) {
    const f = fitText(text, fontSize, maxWidth);
    return { lines: [f.text], textLength: f.textLength, widths: [f.textLength ?? approxWidth(f.text, fontSize)] };
  }
  // بهترین شکست دو خطی (کمترین انحراف از سقف عرض)
  let best: [string, string] = [text, ''];
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const score = Math.max(0, approxWidth(a, fontSize) - maxWidth) + Math.max(0, approxWidth(b, fontSize) - maxWidth);
    if (score < bestScore) { bestScore = score; best = [a, b]; }
  }
  const out: { text: string; textLength?: number }[] = best
    .filter(Boolean)
    .map((line, idx) => {
      // هر خطی که از سقف عرض بگذرد fit می‌شود؛ «…» فقط به خط آخر می‌رسد
      // تا پیوستگی جمله حفظ شود و هیچ متنی از پیل بیرون نزند.
      return approxWidth(line, fontSize) > maxWidth || idx === best.length - 1
        ? fitText(line, fontSize, maxWidth)
        : { text: line };
    });
  const lines = out.map((o) => o.text);
  const widths = out.map((o, i) =>
    // خط‌های غیر آخر: اگر هنوز جا هستند، تریمر نکنید — فقط آخرین خط فیت می‌شود
    i === out.length - 1 && o.textLength ? o.textLength : approxWidth(o.text, fontSize),
  );
  return { lines, widths };
}

/** نام مرکز: اگر عریض بود به دو خط با متعادل‌ترین شکست می‌شکند. */
function centerLines(name: string, fontSize: number, maxWidth: number): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || approxWidth(name, fontSize) <= maxWidth) {
    return [fitText(name, fontSize, maxWidth).text];
  }
  let best: string[] = [name];
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const over = Math.max(0, approxWidth(a, fontSize) - maxWidth) + Math.max(0, approxWidth(b, fontSize) - maxWidth);
    if (over < bestScore) { bestScore = over; best = [a, b]; }
  }
  return best.map((t) => fitText(t, fontSize, maxWidth).text);
}

/** Ego graph — the entity at the center, its connections around it (pure SVG). */
export function EgoGraph({ center, centerHref, nodes, height = 360 }: {
  center: { name: string; kind: 'organization' | 'person'; sub?: string };
  centerHref?: string;
  nodes: EgoNode[];
  height?: number;
}) {
  const H = height, CX = W / 2, CY = H / 2 - 6;
  const [fs, setFs] = useState(false);

  // تمام‌صفحه: Esc می‌بندد و اسکرول پس‌زمینه قفل می‌شود
  useEffect(() => {
    if (!fs) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setFs(false); };
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [fs]);

  /**
   * چیدمان حلقوی امن:
   *  - حلقه داخل‌تر شده تا برچسب گره‌های کناری به لبهٔ بوم نخورند
   *  - برچسب هر گره «بیرونِ» گره در راستای شعاع می‌نشیند و با حلقهٔ تکراری
   *    به اندازه‌ای دور می‌شود که جعبهٔ متن هرگز با دایرهٔ گره تداخل نکند
   *  - جعبهٔ متن همیشه داخل حاشیهٔ امن بوم clamp می‌شود و با textLength
   *    فشرده می‌شود → هرگز بیرون زدن/بریدن متن رخ نمی‌دهد
   *  - نشانِ رابطه در میانهٔ یال با حباب سفید رسم می‌شود (نه روی مرکز/گره)
   */
  const ring = useMemo(() => {
    const list = nodes.slice(0, MAX_NODES);
    const n = list.length;
    const rx = W / 2 - 150;
    const ry = H / 2 - 80;
    const fh = LABEL_FONT / 2 + 2.5; // نصف‌ارتفاع جعبهٔ برچسب (تک‌خط)
    return list.map((nd, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      const x = CX + Math.cos(angle) * rx;
      const y = CY + Math.sin(angle) * ry;
      const r = 11 + Math.min(9, (nd.score ?? 50) / 11);
      const dx = x - CX, dy = y - CY;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // سقف پهنای پیل: هرچه گره‌ها متراکم‌تر، پیل باریک‌تر (نام‌ها دوخطی می‌شوند)
      const countCap = n >= 12 ? 64 : n >= 8 ? 84 : 96;
      const roomX = Math.abs(ux) > 0.05
        ? (ux > 0 ? W - SAFE_X - LABEL_PAD - x : x - SAFE_X - LABEL_PAD)
        : Infinity;
      const roomY = Math.abs(uy) > 0.05
        ? (uy > 0 ? H - SAFE_BOTTOM - LABEL_PAD - y : y - SAFE_TOP - LABEL_PAD)
        : Infinity;
      const capHalf = Math.max(14, Math.min(countCap, roomX));
      // متن: یک خط تا سقف پیل، وگرنه دوخط
      const wrapped = wrapLabel(nd.name, LABEL_FONT, capHalf * 2);
      const lines = wrapped.lines;
      const half = Math.max(14, Math.min(countCap, ...wrapped.widths.map((w) => w / 2 + LABEL_PAD), roomX));
      const labelH = lines.length * (LABEL_FONT + 2.5) + LABEL_PAD; // ارتفاع کامل پیل
      const boxHalfH = labelH / 2;
      const lyMin = SAFE_TOP + boxHalfH;
      const lyMax = H - SAFE_BOTTOM - boxHalfH;
      // برچسب را در راستای شعاع دور کن تا پیلِ متن از دایرهٔ گره فاصله بگیرد
      let lx = x, ly = y;
      for (let t = r + 8; t <= r + 160; t += 3) {
        lx = x + ux * t;
        ly = y + uy * t; // مرکز پیل
        lx = Math.min(Math.max(lx, SAFE_X + half), W - SAFE_X - half);
        ly = Math.min(Math.max(ly, lyMin), lyMax);
        // فاصلهٔ پیل (AABB) تا مرکز گره (دایره)
        const gapX = Math.max(0, Math.abs(lx - x) - half);
        const gapY = Math.max(0, Math.abs(ly - y) - boxHalfH);
        if (Math.hypot(gapX, gapY) >= r + LABEL_DR) break;
      }
      // نقطهٔ میانهٔ یال: در فاصلهٔ امن میان مرکز و گره — نه روی مرکز، نه روی گره
      const dist = len || 1;
      const tm = Math.max(0.52, Math.min(0.75, (CENTER_R + 12) / dist));
      return {
        ...nd,
        x, y, r,
        labelX: lx,       // مرکز پیل
        labelY: ly,       // مرکز پیل
        label: wrapped,
        labelHalf: half,
        labelBoxHalfH: boxHalfH,
        mx: CX + (x - CX) * tm,
        my: CY + (y - CY) * tm,
      };
    });
  }, [nodes, W, H, CX, CY]);

  const edgeColorOf = (nd: EgoNode) => {
    if (nd.edgeColor) return nd.edgeColor;
    if (nd.edgeStyle === 'dashed') return MEMBER_COLOR;
    if (nd.status) return STATUS_COLORS[nd.status] ?? EDGE_DEFAULT;
    return EDGE_DEFAULT;
  };

  /** آیکون نازک «سازمان / شخص» در میانهٔ خط — هم‌زبان با طراحی (lucide-style). */
  const edgeIcon = (nd: EgoNode) => {
    const isOrg = nd.kind === 'organization';
    return isOrg ? (
      /* Building 2 */
      <g stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
      </g>
    ) : (
      /* User */
      <g stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx={12} cy={7} r={4} />
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      </g>
    );
  };

  /** بدنهٔ SVG (هم در کارت و هم در نمای تمام‌صفحه) */
  const svgBody = (widthCss: string) => {
    const centerName = centerLines(center.name, 10.4, CENTER_R * 2 - 18);
    const centerSub = center.sub ? fitText(center.sub, 8.2, CENTER_R * 2 - 16) : null;
    const nameLineY = centerName.length > 1 ? [CY - 5, CY + 5.5] : [CY - 1];
    return (
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
            opacity={0.6} style={{ pointerEvents: 'none' }} />
        ))}

        {/* میانهٔ یال: نشانِ نوع گره در حباب سفید، هم‌رنگ وضعیت رابطه */}
        {ring.map(nd => {
          const ec = edgeColorOf(nd);
          return (
            <g key={`mid-${nd.id}`} style={{ pointerEvents: 'none' }}>
              <circle cx={nd.mx} cy={nd.my} r={10.5}
                fill="var(--card-bg, #FFFFFF)" stroke={ec} strokeWidth={1.5}
                style={{ filter: 'drop-shadow(0 1px 1.5px rgba(15,23,42,.14))' }} />
              <g transform={`translate(${nd.mx - 6} ${nd.my - 6}) scale(0.5)`}
                style={{ color: ec }}>
                {edgeIcon(nd)}
              </g>
              <title>{nd.name}{nd.status ? ` — ${nd.status}` : ''}{nd.sub ? ` · ${nd.sub}` : ''}</title>
            </g>
          );
        })}

        {/* برچسب‌ها با پیل سفید (تک‌خط یا دوخط) — حتی اگر خطی از زیرشان بگذرد، متن خوانا می‌ماند */}
        {ring.map(nd => {
          const pw = nd.labelHalf * 2;
          const pillX = nd.labelX - nd.labelHalf;
          const pillY = nd.labelY - nd.labelBoxHalfH;
          const lines = nd.label.lines;
          const lineH = LABEL_FONT + 2.5;
          const firstBaseline = pillY + LABEL_PAD / 2 + LABEL_FONT - 1;
          return (
            <g key={`lb-${nd.id}`} style={{ pointerEvents: 'none' }}>
              <rect x={pillX} y={pillY} width={pw} height={nd.labelBoxHalfH * 2}
                rx={7} fill="var(--card-bg, #FFFFFF)" opacity={0.94}
                stroke="var(--card-border-strong, #E2E7F0)" strokeWidth={0.8} />
              {lines.map((t, li) => (
                <text key={li} x={nd.labelX} y={firstBaseline + li * lineH} textAnchor="middle"
                  fontSize={LABEL_FONT} fontWeight={700}
                  fill="var(--text-secondary, #667085)"
                  {...(li === lines.length - 1 && nd.label.textLength
                    ? { textLength: nd.label.textLength, lengthAdjust: 'spacingAndGlyphs' as const }
                    : {})}
                  style={{ userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {t}
                </text>
              ))}
            </g>
          );
        })}

        {/* ring nodes — گره + برچسب داخل یک لینک با ناحیهٔ لمس بزرگ */}
        {ring.map(nd => {
          const fill = nd.kind === 'person' ? 'url(#ego-node-person)' : 'url(#ego-node-org)';
          const body = (
            <>
              <title>{nd.name}{nd.status ? ` — ${nd.status}` : ''}</title>
              <circle cx={nd.x} cy={nd.y} r={nd.r} fill={fill} stroke="#fff" strokeWidth={2}
                style={{ transition: 'r .15s' }} />
              {/* ناحیهٔ لمس بزرگ: دایرهٔ اطراف گره + مستطیل روی پیل برچسب → کلیک همیشه کار می‌کند */}
              <circle cx={nd.x} cy={nd.y} r={nd.r + 12} fill="transparent"
                style={{ pointerEvents: 'all', cursor: 'pointer' }} />
              <rect
                x={nd.labelX - nd.labelHalf}
                y={nd.labelY - nd.labelBoxHalfH}
                width={nd.labelHalf * 2}
                height={nd.labelBoxHalfH * 2}
                rx={7}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
              />
            </>
          );
          return nd.href
            ? <Link key={nd.id} href={nd.href} className="ego-node-link" style={{ pointerEvents: 'all', cursor: 'pointer' }}>{body}</Link>
            : <g key={nd.id} className="ego-node-link" style={{ pointerEvents: 'all', cursor: 'pointer' }}>{body}</g>;
        })}

        {/* center — نام + صنعت داخل دایره */}
        <circle cx={CX} cy={CY} r={CENTER_R} fill="url(#ego-center-grad)" stroke="#fff" strokeWidth={3}
          className="ego-center-pulse" />
        {centerName.map((line, i) => (
          <text key={i} x={CX} y={nameLineY[i]} textAnchor="middle" fontSize={centerName.length > 1 ? 10.4 : 11.2}
            fontWeight={900} fill="#fff"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {line}
          </text>
        ))}
        {centerSub && (
          <text x={CX} y={centerName.length > 1 ? CY + 16 : CY + 13} textAnchor="middle" fontSize={8.2}
            fontWeight={700} fill="#FFFFFF" opacity={0.88}
            {...(centerSub.textLength ? { textLength: centerSub.textLength, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {centerSub.text}
          </text>
        )}
        {centerHref && <Link href={centerHref} aria-label={`مشاهده ${center.name}`}>
          <circle cx={CX} cy={CY} r={CENTER_R + 11} fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'pointer' }} />
        </Link>}
      </svg>
    );
  };

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
