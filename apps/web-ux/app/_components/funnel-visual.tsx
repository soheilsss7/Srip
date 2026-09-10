'use client';
import { Filter, TrendingDown } from 'lucide-react';

/* ============================================================================
   FunnelVisual — قیف پیشنهادهای هوشمند (تک‌منبع برای داشبورد و تحلیل محصول)
   ----------------------------------------------------------------------------
   اصول طراحی (بازطراحی پاییز ۱۴۰۵ — جایگزین میله‌های درصدیِ فشرده‌شونده):
     ۱) موبایل‌اول: هر مرحله دو سطرِ مستقل دارد — سطر اطلاعات (شماره + نام +
        شمار + درصد) و سطر میله. هیچ عنصری در سطر دیگری فشرده نمی‌شود؛
        بنابراین «هر حرف یک خط» ساختاراً ناممکن است.
     ۲) میله همیشه تمام‌عرضِ ظرف است و «پُرِ» داخل آن نسبت به مرحلهٔ اول
        (دیده‌شده = ۱۰۰٪) کشیده می‌شود — شکل قیف واقعی، بدون min-width درصدی.
     ۳) بین هر دو مرحله، سطر تبدیل با درصد و افت مطلق نشان داده می‌شود.
     ۴) سطح‌بندی رنگی: مراحل اولیه سبزآبی، مراحل پایانی (نتیجه) بنفش —
        سفر پیشنهاد از دیده‌شدن تا ثمردادن.
     ۵) دسترس‌پذیری: role=list + برچسب aria برای هر مرحله و هر تبدیل.
   ========================================================================== */

export type FunnelStages = Record<string, number>;
export type FunnelConversion = Record<string, number>;

const STAGES: ReadonlyArray<{ key: string; fa: string }> = [
  { key: 'viewed', fa: 'دیده‌شده' },
  { key: 'accepted', fa: 'پذیرفته‌شده' },
  { key: 'actionCreated', fa: 'اقدام ساخته‌شده' },
  { key: 'actionCompleted', fa: 'اقدام انجام‌شده' },
  { key: 'outcome', fa: 'ثبت نتیجه' },
];
const CONV: ReadonlyArray<{ key: string; fa: string }> = [
  { key: 'viewedToAcceptedPct', fa: 'دیده‌شده ← پذیرفته‌شده' },
  { key: 'acceptedToActionCreatedPct', fa: 'پذیرفته ← ایجاد اقدام' },
  { key: 'actionCreatedToCompletedPct', fa: 'ایجاد ← انجام' },
  { key: 'completedToOutcomePct', fa: 'انجام ← نتیجه' },
];

const faNum = (v: number) => new Intl.NumberFormat('fa-IR').format(v);
const faPct = (v: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v);

/* رنگ مرحله: از سبزآبی (بالای قیف) به بنفش (نتیجه) */
const stepHue = (i: number, n: number) => {
  const t = n <= 1 ? 0 : i / (n - 1);
  return `color-mix(in srgb, var(--teal,#14b8a6) ${Math.round((1 - t) * 70)}%, var(--purple,#8b5cf6))`;
};

export function FunnelVisual({ stages, conversion, compact = false }: {
  stages?: FunnelStages;
  conversion?: FunnelConversion;
  compact?: boolean;
}) {
  const s = stages ?? {};
  const viewed = s.viewed ?? 0;
  const rows = STAGES.map((x, i) => ({ ...x, value: s[x.key] ?? 0, i }));
  if (!viewed) {
    return <div className="empty-inline">فعلاً داده‌ای از قیف پیشنهادها ثبت نشده است.</div>;
  }

  return (
    <div className="funnel-v2" role="list" aria-label="قیف پیشنهادهای هوشمند">
      {rows.map((r, idx) => {
        const pct = viewed ? (r.value / viewed) * 100 : 0;
        const conv = idx > 0 ? CONV[idx - 1] : null;
        const convVal = conv && conversion ? conversion[conv.key] : null;
        const prev = idx > 0 ? rows[idx - 1].value : 0;
        const drop = idx > 0 ? prev - r.value : 0;
        return (
          <div key={r.key} className="fv-step-wrap">
            {/* سطر تبدیل از مرحلهٔ قبل */}
            {conv && (
              <div className="fv-conv" role="separator" aria-label={`${conv.fa}: ${convVal != null ? faPct(convVal) + '٪' : 'نامشخص'}`}>
                <span className="fv-conv-arrow"><TrendingDown size={12} aria-hidden="true" /></span>
                <span className="fv-conv-text">{conv.fa}</span>
                {convVal != null && <b className="fv-conv-pct">{faPct(convVal)}٪</b>}
                {drop > 0 && <span className="fv-conv-drop">({faNum(drop)} افت)</span>}
              </div>
            )}
            {/* مرحله — سطر اطلاعات */}
            <div className="fv-step" role="listitem" aria-label={`${r.fa}: ${faNum(r.value)} از ${faNum(viewed)}، ${faPct(pct)}٪`}>
              <div className="fv-step-head">
                <span className="fv-idx" style={{ background: stepHue(r.i, rows.length) }} aria-hidden="true">{faNum(idx + 1)}</span>
                <span className="fv-label">{r.fa}</span>
                <b className="fv-count">{faNum(r.value)}</b>
                <span className="fv-pct">{faPct(pct)}٪</span>
              </div>
              {/* میله: ظرف تمام‌عرض + پُر نسبت‌دار */}
              <div className="fv-track" aria-hidden="true">
                <span
                  className="fv-fill"
                  style={{ width: `${Math.max(r.value > 0 ? 4 : 0, pct)}%`, background: `linear-gradient(270deg, ${stepHue(r.i, rows.length)}, color-mix(in srgb, ${stepHue(r.i, rows.length)} 55%, transparent))` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      {!compact && (
        <div className="funnel-caption">
          <Filter size={11} aria-hidden="true" /> نسبت‌ها بر پایهٔ «دیده‌شده» (۱۰۰٪) محاسبه شده‌اند؛ شمارش با شناسهٔ پیشنهاد و تک‌شمار.
        </div>
      )}
    </div>
  );
}
