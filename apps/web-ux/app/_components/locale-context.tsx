'use client';
/* ============================================================================
   locale-context.tsx — سوییچر زبان + راه‌انداز جهت/زبان سند (فاز ۴/۲۳)
   ----------------------------------------------------------------------------
   • LocaleToggle: دکمهٔ فا/EN در سربرگ و صفحهٔ ورود؛ با تغییر زبان، تنظیم ذخیره
     و صفحه یک‌بار بارگذاری مجدد می‌شود تا همهٔ ثابت‌های ماژول (ناوبری، فهرست‌های
     گزینه و…) دوباره ارزیابی شوند.
   • LocaleBootstrap: در هر بارگذاری، lang/dir سند را با زبان ذخیره‌شده هماهنگ
     می‌کند (RTL فارسی / LTR انگلیسی).
   • TranslationCoverageNote: در حالت انگلیسی، روی مسیرهای خارج از پوشش ترجمه
     یک یادداشت صادقانه نشان می‌دهد.
   ========================================================================== */
import { useEffect, useState } from 'react';
import { getLocale, setLocale, isEn, isTranslatedRoute, t } from '../_lib/i18n';

export function LocaleBootstrap() {
  useEffect(() => {
    const locale = getLocale();
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === 'en' ? 'ltr' : 'rtl';
  }, []);
  return null;
}

export function LocaleToggle({ compact = false }: { compact?: boolean }) {
  const [locale, setLocal] = useState<'fa' | 'en'>(() => (isEn() ? 'en' : 'fa'));
  const [busy, setBusy] = useState(false);
  const flip = () => {
    const next = locale === 'fa' ? 'en' : 'fa';
    setBusy(true);
    setLocale(next); /* ذخیره در localStorage — سپس بارگذاری مجدد برای ارزیابی تازهٔ همهٔ ماژول‌ها */
    window.location.reload();
  };
  return (
    <button
      className="icon-btn locale-btn"
      onClick={flip}
      disabled={busy}
      title={locale === 'fa' ? 'Switch to English' : t('تغییر به فارسی')}
      aria-label={locale === 'fa' ? 'Switch to English' : t('تغییر زبان به فارسی')}
    >
      {locale === 'fa' ? 'EN' : t('فا')}
      {!compact && <span className="locale-btn-label">{locale === 'fa' ? t('English') : t('فارسی')}</span>}
    </button>
  );
}

export function TranslationCoverageNote({ pathname }: { pathname: string }) {
  const [show, setShow] = useState(true);
  if (!isEn() || isTranslatedRoute(pathname)) return null;
  if (!show) return null;
  return (
    <div className="i18n-coverage-note" role="status">
      <span aria-hidden="true">🌐</span>
      <span>
        This page is not fully translated yet — the core product flow (home, organizations, people,
        relationships, network, referrals, actions, notifications, search, settings, board, AI, QBR,
        enrichment, push) is available in English. Dates, numbers and data values are localized everywhere.
      </span>
      <button className="i18n-note-close" onClick={() => setShow(false)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
