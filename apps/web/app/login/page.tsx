'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiPost,setSession} from '../_lib/api';

export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [mfa,setMfa]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const router=useRouter();
 async function submit(e:FormEvent){
  e.preventDefault(); setBusy(true); setError('');
  try{
   const d=await apiPost<any>('/auth/login',{email,password,...(mfa?{otp}: {})});
   if(!d?.accessToken) throw new Error('پاسخ احراز هویت نامعتبر است.');
   setSession(d); router.replace('/');
  }catch(x){
   const msg=(x as Error).message;
   if(/MFA|کد.*MFA|multi.?factor/i.test(msg)){setMfa(true);setError('کد MFA لازم است. کد ۶ رقمی را وارد کنید.');}
   else setError(msg);
  }finally{setBusy(false);}
 }
 return <main className="login"><form onSubmit={submit} className="panel" noValidate>
  <p className="eyebrow">SRIP</p><h1>ورود به مرکز روابط راهبردی</h1>
  <label>ایمیل<input autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label>
  <label>رمز عبور<input autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} type="password" minLength={12} required/></label>
  {mfa&&<label>کد MFA<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} required/></label>}
  {error&&<p className="error" role="alert">{error}</p>}
  <button disabled={busy||!email||password.length<12||(mfa&&otp.length<6)}>{busy?'در حال احراز هویت…':'ورود امن'}</button>
  <a href="/forgot-password">رمز عبور را فراموش کرده‌اید؟</a>
  <small>هیچ حساب یا رمز پیش‌فرضی در رابط کاربری قرار داده نشده است.</small>
 </form></main>
}
