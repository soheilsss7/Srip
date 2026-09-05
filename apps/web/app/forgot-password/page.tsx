'use client';
import Link from 'next/link';
import {useState} from 'react';
import {api} from '../_lib/api';
import {AuthShell} from '../_components/auth-shell';
import {KeyRound, CheckCircle2} from 'lucide-react';

export default function ForgotPassword(){
 const [email,setEmail]=useState(''),[msg,setMsg]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault(); setMsg(''); setError(''); setBusy(true);
  try{
   await api('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email})});
   setMsg('اگر حساب وجود داشته باشد، درخواست بازیابی ثبت شد.');
  }catch(x){ setError((x as Error).message); }
  finally{ setBusy(false); }
 }
 return (
  <AuthShell>
    <h2>بازیابی رمز عبور</h2>
    <p className="ac-sub">ایمیل خود را وارد کنید؛ اگر حسابی وجود داشته باشد، لینک بازیابی برایتان ارسال می‌شود.</p>
    {msg ? (
      <div className="auth-form" style={{alignItems:'center',textAlign:'center',gap:12}}>
        <CheckCircle2 size={44} style={{color:'var(--srip-success)'}}/>
        <b>درخواست ثبت شد</b>
        <p className="t-muted" style={{fontSize:12.5,lineHeight:1.8}}>{msg}</p>
        <Link className="btn btn-primary btn-block" href="/login">بازگشت به ورود</Link>
      </div>
    ) : (
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="fp-email">ایمیل سازمانی <span className="req">*</span></label>
          <input id="fp-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required autoFocus/>
        </div>
        {error&&<p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy||!email}>
          <KeyRound size={16}/> {busy?'در حال ارسال…':'ارسال درخواست بازیابی'}
        </button>
      </form>
    )}
    <div className="auth-links" style={{justifyContent:'center'}}>
      <Link href="/login">بازگشت به ورود</Link>
    </div>
  </AuthShell>
 );
}
