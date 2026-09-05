'use client';
import Link from 'next/link';
import {useState,useEffect,Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {api} from '../_lib/api';
import {AuthShell} from '../_components/auth-shell';
import {KeyRound, CheckCircle2, Mail} from 'lucide-react';

const MIN=12;
function invalidPw(p:string){if(p.length<MIN)return `رمز عبور باید حداقل ${MIN} کاراکتر باشد.`;return '';}

function PasswordReset(){
 const sp=useSearchParams();
 const initialToken=(typeof window!=='undefined'&&new window.URLSearchParams(window.location.search).get('token'))||'';
 const [token,setToken]=useState(initialToken);
 const [step,setStep]=useState<'email'|'token'|'confirm'|'done'>(initialToken?'confirm':'email');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [msg,setMsg]=useState('');
 const [error,setError]=useState('');

 useEffect(()=>{const t=new URLSearchParams(typeof window!=='undefined'?window.location.search:'').get('token');if(t){setToken(t);setStep('confirm');}},[sp]);

 async function requestEmail(e:React.FormEvent){e.preventDefault();setMsg('');setError('');try{const r:any=await api('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email})});setMsg('درخواست بازیابی ثبت شد. لینک تأیید به ایمیل شما ارسال شده است.');if(r&&r.developmentToken){setToken(r.developmentToken);setStep('confirm');setMsg('درخواست ثبت شد. در محیط توسعه توکن زیر به شما داده شده است — از آن برای تعیین رمز جدید استفاده کنید.');}}catch(x){setError((x as Error).message)}}

 async function applyReset(e:React.FormEvent){e.preventDefault();setMsg('');setError('');const v=invalidPw(password);if(v){setError(v);return}if(password!==confirm){setError('رمز عبور و تکرار آن یکسان نیستند.');return}if(!token){setError('توکن بازیابی موجود نیست.');return}try{await api('/auth/password-reset/confirm',{method:'POST',body:JSON.stringify({token,password})});setStep('done')}catch(x){setError((x as Error).message)}}

 return (
  <AuthShell>
    <h2>بازیابی رمز عبور</h2>
    <p className="ac-sub">رمز عبور جدید خود را با استفاده از توکن بازیابی ثبت کنید.</p>
    {error&&<p className="error" role="alert">{error}</p>}

    {step==='done' ? (
      <div className="auth-form" style={{alignItems:'center',textAlign:'center',gap:12}}>
        <CheckCircle2 size={44} style={{color:'var(--srip-success)'}}/>
        <b>رمز عبور با موفقیت تغییر کرد</b>
        <Link className="btn btn-primary btn-block" href="/login">ورود به حساب</Link>
      </div>
    ) : step==='confirm' ? (
      <form className="auth-form" onSubmit={applyReset} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="pr-pass">رمز عبور جدید <span className="req">*</span></label>
          <input id="pr-pass" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={MIN} placeholder="حداقل ۱۲ کاراکتر" required/>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pr-pass2">تکرار رمز عبور <span className="req">*</span></label>
          <input id="pr-pass2" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={MIN} required/>
        </div>
        {token && <span className="chip info" dir="ltr" style={{alignSelf:'flex-start',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis'}}>Token: {token}</span>}
        <button className="btn btn-primary btn-block"><KeyRound size={16}/> ثبت رمز جدید</button>
      </form>
    ) : (
      <form className="auth-form" onSubmit={requestEmail} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="pr-email">ایمیل سازمانی <span className="req">*</span></label>
          <input id="pr-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
        </div>
        <button className="btn btn-primary btn-block"><Mail size={16}/> ارسال درخواست بازیابی</button>
      </form>
    )}
    {msg&&<p className="notice" role="status">{msg}</p>}
    <div className="auth-links" style={{justifyContent:'center'}}><Link href="/login">بازگشت به ورود</Link></div>
  </AuthShell>
 );
}

export default function PasswordResetPage(){
 return <Suspense fallback={null}><PasswordReset/></Suspense>;
}
