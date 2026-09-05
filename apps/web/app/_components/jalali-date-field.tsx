'use client';
/* ---------------------------------------------------------------------------
 * JalaliDateField — جایگزینِ یکپارچهٔ input[type=date|datetime-local]
 *
 * یک «پاپ‌آپ تقویم شمسی» زیبا را کنارِ فیلد باز می‌کند و همان رشتهٔ ISO
 * میلادیِ قبلی (YYYY-MM-DD یا YYYY-MM-DDTHH:mm) را به فرم برمی‌گرداند؛
 * بنابراین قرارداد API/سرور دست‌نخورده می‌ماند و نمایش همیشه شمسی است.
 * ------------------------------------------------------------------------- */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Eraser, Check } from 'lucide-react';
import {
  parseIsoParts, formatJalaliDisplay, todayJalali, jalaaliMonthLength, jalaaliWeekday,
  toGregorian, toIsoString, JALALI_MONTHS, WEEKDAYS_FA, faNum as faN,
} from '../_lib/jalali';

type Props = {
  value: string;                                   // 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm' | ISO
  onChange: (v: string) => void;
  withTime?: boolean;                              // آیا ساعت/دقیقه هم انتخاب شود؟
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  required?: boolean;
  style?: CSSProperties;
};

const POP_W = 318;
const POP_H = 396;   // بدون نوار زمان؛ با نوار زمان ~+58

export function JalaliDateField({ value, onChange, withTime = false, placeholder, id, required, style, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // دادهٔ جاری مقدار
  const parsed = useMemo(() => parseIsoParts(value), [value]);
  const today = useMemo(() => todayJalali(), []);

  // نمای تقویم: ماه شمسی در حال نمایش
  const initialView = parsed?.jd ?? today;
  const [view, setView] = useState({ jy: initialView.jy, jm: initialView.jm });
  useEffect(() => {
    // وقتی مقدار بیرونی عوض شد (مثلاً از «امروز»/پاک‌سازی)، نمای هم‌اهنگ بماند
    setView((v) => {
      if (parsed && (v.jy !== parsed.jd.jy || v.jm !== parsed.jd.jm)) return { jy: parsed.jd.jy, jm: parsed.jd.jm };
      return v;
    });
  }, [parsed]);
  // ساعت/دقیقهٔ پیشنهادیِ نوار زمان (پیش‌فرض: زمانِ مقدار یا همین حالا)
  const initTime = parsed?.time ?? (withTime ? { hh: new Date().getHours(), mm: new Date().getMinutes() } : undefined);
  const [hh, setHh] = useState(initTime?.hh ?? 9);
  const [mm, setMm] = useState(initTime?.mm ?? 0);
  useEffect(() => {
    if (open) {
      const t = parseIsoParts(value)?.time ?? (withTime ? { hh: new Date().getHours(), mm: new Date().getMinutes() } : undefined);
      if (t) { setHh(t.hh); setMm(t.mm); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withTime]);

  const display = parsed ? formatJalaliDisplay(parsed.jd, withTime ? parsed.time : null) : '';
  const displayTime = parsed?.time ?? null;

  /* ---------------- باز/بستن و موقعیت‌یابی (پورتال به body) ---------------- */
  function openPopup() {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const up = r.bottom + (withTime ? POP_H + 62 : POP_H) + 10 > vh && r.top > (withTime ? POP_H + 62 : POP_H) + 20;
    let left = Math.min(Math.max(8, r.left), vw - POP_W - 8);
    if (left < 8) left = 8;
    setPos({ top: up ? r.top - (withTime ? POP_H + 58 : POP_H) - 8 : r.bottom + 8, left, up });
    setOpen(true);
  }
  function closePopup() {
    setOpen(false);
    setPos(null);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      closePopup();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { closePopup(); e.stopPropagation(); } };
    const onScroll = () => closePopup(); // هر اسکرولی بستن — مثل پیکرهای استاندارد
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  /* ------------------------------ اقدام‌ها ------------------------------ */
  function commit(jd: { jy: number; jm: number; jd: number }, t?: { hh: number; mm: number } | null) {
    const g = toGregorian(jd.jy, jd.jm, jd.jd);
    const time = t ?? (withTime ? { hh, mm } : null);
    onChange(toIsoString(g.gy, g.gm, g.gd, time));
  }
  function pickDay(jd: number) {
    const jy = view.jy, jm = view.jm;
    commit({ jy, jm, jd }, withTime ? { hh, mm } : null);
    if (!withTime) closePopup();
  }
  function todayNow() {
    const t = todayJalali();
    commit(t, withTime ? { hh: new Date().getHours(), mm: new Date().getMinutes() } : null);
    closePopup();
  }
  function clear() {
    onChange('');
  }
  function shiftMonth(delta: number) {
    setView((v) => {
      let jm = v.jm + delta;
      let jy = v.jy;
      if (jm < 1) { jm = 12; jy -= 1; }
      if (jm > 12) { jm = 1; jy += 1; }
      return { jy, jm };
    });
  }
  function shiftYear(delta: number) {
    setView((v) => ({ jy: Math.max(1300, Math.min(1500, v.jy + delta)), jm: v.jm }));
  }

  /* ---------------------------- سلول‌های ماه ---------------------------- */
  const grid = useMemo(() => {
    const jy = view.jy, jm = view.jm;
    const len = jalaaliMonthLength(jy, jm);
    const w0 = jalaaliWeekday(jy, jm, 1); // 0=شنبه
    const cells: Array<{ day: number; current: boolean } | null> = [];
    for (let i = 0; i < w0; i++) cells.push(null);
    for (let d = 1; d <= len; d++) cells.push({ day: d, current: true });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);
  const selDay = parsed?.jd.jy === view.jy && parsed?.jd.jm === view.jm ? parsed?.jd.jd : null;
  const viewHasDate = selDay != null;

  const inputStyle: CSSProperties = {
    minHeight: 40, border: '1px solid var(--card-border-strong)', background: 'var(--card-bg)',
    color: parsed ? 'var(--text-primary)' : 'var(--text-muted)', borderRadius: 'var(--radius-md)',
    padding: '9px 12px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    width: '100%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...style,
  };

  const pop = (
    <div ref={popRef} className={`jalali-pop ${pos?.up ? 'up' : ''}`} style={{ top: pos?.top, left: pos?.left }}
      role="dialog" aria-label="انتخاب تاریخ شمسی">
      {/* سربرگ: ماه */}
      <div className="jalali-head">
        <button type="button" className="j-nav" onClick={() => shiftMonth(-1)} aria-label="ماه قبل" tabIndex={-1}><ChevronRight size={15} /></button>
        <span className="j-month">{JALALI_MONTHS[view.jm - 1]} <b>{faN(view.jy)}</b></span>
        <button type="button" className="j-nav" onClick={() => shiftMonth(1)} aria-label="ماه بعد" tabIndex={-1}><ChevronLeft size={15} /></button>
      </div>
      {/* سال */}
      <div className="jalali-year">
        <button type="button" className="j-nav sm" onClick={() => shiftYear(-1)} aria-label="سال قبل" tabIndex={-1}><ChevronsRight size={13} /></button>
        <span>سال {faN(view.jy)}</span>
        <button type="button" className="j-nav sm" onClick={() => shiftYear(1)} aria-label="سال بعد" tabIndex={-1}><ChevronsLeft size={13} /></button>
      </div>
      {/* روزهای هفته */}
      <div className="jalali-wdays">
        {WEEKDAYS_FA.map((w, i) => (
          <span key={i} className={i === 6 ? 'fri' : ''}>{w}</span>
        ))}
      </div>
      {/* شبکه روزها */}
      <div className="jalali-grid">
        {grid.map((c, i) =>
          c === null ? (
            <span key={i} />
          ) : (
            <button key={i} type="button"
              className={`j-day${c.day === selDay ? ' sel' : ''}${c.day === today.jd && view.jy === today.jy && view.jm === today.jm ? ' today' : ''}`}
              onClick={() => pickDay(c.day)} tabIndex={-1}>
              {faN(c.day)}
            </button>
          )
        )}
      </div>
      {/* نوار زمان (فقط فیلدهای دارای ساعت) */}
      {withTime && (
        <div className="jalali-time">
          <label>ساعت
            <select value={hh} onChange={(e) => { const v = Number(e.target.value); setHh(v); if (viewHasDate) commit({ jy: view.jy, jm: view.jm, jd: selDay! }, { hh: v, mm }); }} aria-label="ساعت">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{faN(String(h).padStart(2, '0'))}</option>)}
            </select>
          </label>
          <label>دقیقه
            <select value={mm} onChange={(e) => { const v = Number(e.target.value); setMm(v); if (viewHasDate) commit({ jy: view.jy, jm: view.jm, jd: selDay! }, { hh, mm: v }); }} aria-label="دقیقه">
              {Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{faN(String(m).padStart(2, '0'))}</option>)}
            </select>
          </label>
          <span className="j-time-hint">{viewHasDate ? 'تغییر زمان بلافاصله اعمال می‌شود' : 'ابتدا روز را انتخاب کنید'}</span>
        </div>
      )}
      {/* پابرگ */}
      <div className="jalali-foot">
        <button type="button" className="j-ghost" onClick={todayNow}><CalendarDays size={12} /> امروز</button>
        {withTime && (
          <button type="button" className="j-primary" onClick={() => closePopup()} disabled={!viewHasDate}>
            <Check size={12} /> {displayTime ? 'تأیید و بستن' : 'انتخاب شد'}
          </button>
        )}
        <button type="button" className="j-clear" onClick={clear} disabled={!value}><Eraser size={12} /> پاک کردن</button>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className="jalali-field" style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type="text"
        inputMode="none"
        readOnly
        required={required}
        value={display}
        placeholder={placeholder ?? (withTime ? 'انتخاب تاریخ و ساعت شمسی…' : 'انتخاب تاریخ شمسی…')}
        aria-label={rest['aria-label']}
        onClick={openPopup}
        onFocus={openPopup}
        style={inputStyle}
        className={open ? 'j-open' : undefined}
      />
      <span className="jalali-ico" aria-hidden="true">
        <CalendarDays size={15} />
      </span>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(pop, document.body)
        : null}
    </div>
  );
}

export default JalaliDateField;
