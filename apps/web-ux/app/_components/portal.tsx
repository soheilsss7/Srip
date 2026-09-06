'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * رندر در <body> — لازم برای overlayهای تمام‌صفحه.
 * اگر والدِ component دارای backdrop-filter / transform باشد،
 * فرزندانِ position:fixed به جای viewport به همان والد (containing block)
 * مقید می‌شوند و overlay فقط داخل آن جعبه می‌ماند (مشکل «فقط نوار تار می‌شود»).
 * این کامپوننت آن زنجیره را می‌شکند و overlay را مستقیم به body می‌برد.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
