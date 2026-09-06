'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ریدایرکت کلاینتی برای مسیرهای قدیمی/تکراری.
 * صفحهٔ مقصد واقعی در جای دیگری است؛ این کامپوننت فقط URL را بدون
 * از دست رفتن مسیر (بدون ۴۰۴) به مقصد جدید می‌برد.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}
