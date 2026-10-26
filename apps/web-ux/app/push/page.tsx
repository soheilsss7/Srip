'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing } from 'lucide-react';
import { t } from '../_lib/i18n';

/* «اعلان‌ها و آفلاین» در مرکز اعلان‌ها یکپارچه شد — مسیر قدیمی منتقل می‌کند */
export default function PushRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/notifications'); }, [router]);
  return (
    <main className="feature-page">
      <div className="empty-state-v4" style={{ marginTop: 48 }}>
        <div className="empty-ico"><BellRing size={24} /></div>
        <strong>{t('این بخش به «مرکز اعلان‌ها» منتقل شد')}</strong>
        <p>{t('در حال انتقال…')}</p>
      </div>
    </main>
  );
}
