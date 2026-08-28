'use client';
import {useState,useEffect} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {api} from '../_lib/api';

const MIN=12;
function invalidPw(p:string){if(p.length<MIN)return `رمز عبور باید حداقل ${MIN} کاراکتر باشد.`;return '';}

export default function PasswordReset(){
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

 return <main className="auth-page"><section className="auth-card">
   <p className="eyebrow">ACCOUNT RECOVERY</p><h1>بازیابی رمز عبور</h1>
   {error&&<p className="error">{error}</p>}
   {step==='done'?<>
     <p className="success">رمز عبور با موفقیت تغییر کرد.</p>
     <Link href="/login">ورود به حساب</Link>
   </>:
   step==='confirm'?<form onSubmit={applyReset}>
     <label>رمز عبور جدید<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={MIN} required/></label>
     <label>تکرار رمز عبور<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={MIN} required/></label>
     <button className="primary-action">ثبت رمز جدید</button>
   </form>:
   <form onSubmit={requestEmail}>
     <label>ایمیل<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
     <button className="primary-action">ارسال درخواست</button>
   </form>}
   {msg&&<p className="success">{msg}</p>}
   <Link href="/login">بازگشت به ورود</Link>
 </section></main>;
}
