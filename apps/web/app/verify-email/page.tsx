'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../_lib/api';
import { ErrorCard, PageHeader } from '../_components/page-ui';

export default function VerifyEmail() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const value = searchParams.get('token') ?? '';
    setToken(value);
    if (value) void verify(value);
  }, [searchParams]);

  async function verify(value = token) {
    if (!value.trim()) { setStatus('error'); setMessage('لینک یا کد تأیید ایمیل را وارد کنید.'); return; }
    setStatus('verifying'); setMessage('');
    try { await api('/auth/email/verify', { method: 'POST', body: JSON.stringify({ token: value.trim() }) }); setStatus('verified'); setMessage('ایمیل شما با موفقیت تأیید شد. اکنون می‌توانید وارد شوید.'); }
    catch (error) { setStatus('error'); setMessage((error as Error).message); }
  }

  return <main className="login"><section className="panel"><PageHeader eyebrow="IDENTITY" title="تأیید ایمیل" description="برای فعال‌شدن ورود، لینک تأیید ایمیل را باز کنید یا کد آن را وارد کنید." /><ErrorCard message={status === 'error' ? message : ''} />{status === 'verifying' && <p role="status">در حال تأیید لینک…</p>}{status === 'verified' && <div className="status-message" role="status">{message}<br /><a href="/login">ورود به حساب</a></div>}{status !== 'verified' && <form className="entity-form" onSubmit={event => { event.preventDefault(); void verify(); }}><label>کد تأیید ایمیل<input value={token} onChange={event => setToken(event.target.value)} autoComplete="one-time-code" disabled={status === 'verifying'} required /></label><button className="primary-action" disabled={status === 'verifying'}>{status === 'verifying' ? 'در حال تأیید…' : 'تأیید ایمیل'}</button></form>}<a href="/login">بازگشت به ورود</a></section></main>;
}
