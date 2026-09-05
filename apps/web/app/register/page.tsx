'use client';
import Link from 'next/link';
import {useState} from 'react';
import {api} from '../_lib/api';
import {AuthShell} from '../_components/auth-shell';
import {UserPlus, CheckCircle2} from 'lucide-react';

export default function Register(){
 const[f,setF]=useState({email:'',password:'',name:''}),[e,setE]=useState(''),[ok,setOk]=useState(false),[busy,setBusy]=useState(false);
 async function submit(x:React.FormEvent){
  x.preventDefault(); setBusy(true); setE('');
  try{ await api('/auth/register',{method:'POST',body:JSON.stringify(f)}); setOk(true); }
  catch(z){ setE((z as Error).message); }
  finally{ setBusy(false); }
 }
 return (
  <AuthShell>
    <h2>ایجاد حساب کاربری</h2>
    <p className="ac-sub">حساب طبق سیاست‌های سرور ایجاد می‌شود و پس از تأیید، فعال خواهد شد.</p>
    {ok ? (
      <div className="auth-form" style={{alignItems:'center',textAlign:'center',gap:12}}>
        <CheckCircle2 size={44} style={{color:'var(--srip-success)'}}/>
        <b>ثبت‌نام با موفقیت انجام شد</b>
        <p className="t-muted" style={{fontSize:12.5,lineHeight:1.8}}>ایمیل خود را برای تکمیل فعال‌سازی بررسی کنید.</p>
        <Link className="btn btn-primary btn-block" href="/login">بازگشت به ورود</Link>
      </div>
    ) : (
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="reg-name">نام و نام خانوادگی <span className="req">*</span></label>
          <input id="reg-name" value={f.name} onChange={x=>setF({...f,name:x.target.value})} placeholder="مثلاً: سارا محمدی" required/>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="reg-email">ایمیل سازمانی <span className="req">*</span></label>
          <input id="reg-email" type="email" value={f.email} onChange={x=>setF({...f,email:x.target.value})} placeholder="you@company.com" required/>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="reg-pass">رمز عبور <span className="req">*</span></label>
          <input id="reg-pass" type="password" minLength={12} value={f.password} onChange={x=>setF({...f,password:x.target.value})} placeholder="حداقل ۱۲ کاراکتر" required/>
          <span className="field-hint">حداقل ۱۲ کاراکتر — ترکیبی از حروف و اعداد توصیه می‌شود.</span>
        </div>
        {e&&<p className="error" role="alert">{e}</p>}
        <button className="btn btn-primary btn-block" disabled={busy||!f.email||f.password.length<12||!f.name.trim()}>
          <UserPlus size={16}/> {busy?'در حال ثبت‌نام…':'ثبت‌نام'}
        </button>
      </form>
    )}
    <div className="auth-links" style={{justifyContent:'center'}}>
      <Link href="/login">قبلاً حساب دارید؟ ورود</Link>
    </div>
  </AuthShell>
 );
}
