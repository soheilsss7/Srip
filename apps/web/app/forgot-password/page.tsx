'use client';
import {useState} from 'react';
import Link from 'next/link';
import {api} from '../_lib/api';
export default function ForgotPassword(){
 const [email,setEmail]=useState(''),[msg,setMsg]=useState(''),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setMsg('');setError('');try{await api('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email})});setMsg('اگر حساب وجود داشته باشد، درخواست بازیابی ثبت شد.')}catch(x){setError((x as Error).message)}}
 return <main className="auth-page"><section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>بازیابی رمز عبور</h1><form onSubmit={submit}><label>ایمیل<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><button className="primary-action">ارسال درخواست</button></form>{msg&&<p className="success">{msg}</p>}{error&&<p className="error">{error}</p>}<Link href="/login">بازگشت به ورود</Link></section></main>
}
