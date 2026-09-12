'use client';
import Link from 'next/link';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiPost,setSession} from '../_lib/api';
import {AuthShell} from '../_components/auth-shell';
import {MOCK_PAGES,useMockApiReady,useSwControlled} from '../_lib/mock-ready';
import {Sparkles,Lock,User,ShieldCheck,AlertCircle} from 'lucide-react';


export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [mfa,setMfa]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mockReady=useMockApiReady();
 const swControlled=useSwControlled();
 const router=useRouter();
 const waitingSw=MOCK_PAGES&&!swControlled;
 const canSubmit=mockReady&&!waitingSw&&!busy;
 const demoError=(m:string)=>MOCK_PAGES&&/404|Failed to fetch|خطای سرور/.test(m)?'سرویس در حال راه‌اندازی است؛ یک لحظه صبر کنید و دوباره تلاش کنید.':m;

 async function finish(d:any){
  if(!d?.accessToken) throw new Error('پاسخ احراز هویت نامعتبر است.');
  setSession(d); router.replace('/dashboard');
 }
 async function submit(e:FormEvent){
  e.preventDefault();
  if(waitingSw){ setError('سامانه در حال آماده‌سازی اتصال است؛ چند لحظه صبر کنید.'); return; }
  setBusy(true); setError('');
  const ident=email.trim().toLowerCase();
  try{
   const d=await apiPost<any>('/auth/login',{email,password,...(otp?{otp}:{})});
   await finish(d);
  }catch(x){
   const msg=(x as Error).message||'';
   if(/MFA|کد.*MFA|multi.?factor|دومرحله‌ای/i.test(msg)){
    setMfa(true); setError('کد تأیید دومرحله‌ای لازم است. کد ۶ رقمی را وارد کنید.');
   }else setError(demoError(msg));
  }finally{setBusy(false);}
 }
 return (
  <AuthShell>
    <span className="auth-badge"><Sparkles size={14}/> پلتفرم آماده بهره‌برداری است</span>
    <h2>ورود به حساب کاربری</h2>
    <p className="ac-sub">
      برای ادامه، اطلاعات ورود خود را وارد کنید. دسترسی‌ها بر اساس نقش و محدودهٔ سازمانی شما تعیین می‌شود.
    </p>

    <form onSubmit={submit} className="auth-form" noValidate>
      <div className="field">
        <label className="field-label" htmlFor="login-email">ایمیل یا نام کاربری</label>
        <div className="field-ic">
          <User aria-hidden="true"/>
          <input id="login-email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}
            type="text" placeholder="aroun / you@company.com" required/>
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="login-pass">رمز عبور</label>
        <div className="field-ic">
          <Lock aria-hidden="true"/>
          <input id="login-pass" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}
            type="password" placeholder="••••••" minLength={6} required/>
        </div>
      </div>
      {mfa&&(
        <div className="field">
          <label className="field-label" htmlFor="login-otp">کد تأیید دومرحله‌ای <span className="req">*</span></label>
          <div className="field-ic">
            <ShieldCheck aria-hidden="true"/>
            <input id="login-otp" autoComplete="one-time-code" inputMode="numeric" maxLength={6}
              value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="123456" required/>
          </div>
          <span className="field-hint">کد ۶ رقمی را وارد کنید (در محیط دمو هر ۶ رقم پذیرفته می‌شود).</span>
        </div>
      )}
      {error&&(
        <p className="auth-err-row" role="alert"><AlertCircle aria-hidden="true"/><span>{error}</span></p>
      )}
      <div className="auth-pass-row">
        <span />
        <Link href="/forgot-password">رمز عبور را فراموش کرده‌اید؟</Link>
      </div>
      <div className="auth-submit-row">
        <button className="btn btn-primary btn-block" type="submit"
          disabled={!canSubmit||!email.trim()||password.length<6||(mfa&&otp.length<6)}>
          {busy?'در حال احراز هویت…':'ورود امن'}
        </button>
        {!mockReady&&<span className="auth-sec-note" role="status">در حال آماده‌سازی محیط… (کمتر از یک لحظه)</span>}
        {waitingSw&&<span className="auth-sec-note" role="status">در حال برقراری اتصال به سامانه… اگر بیش از چند ثانیه طول کشید، صفحه را یک‌بار به‌صورت عادی رفرش کنید.</span>}
      </div>
      <p className="auth-note">
        <ShieldCheck size={12} style={{verticalAlign:'-2px'}}/> دسترسی‌ها بر اساس نقش و محدودهٔ سازمانی شما تعیین می‌شود.
      </p>
    </form>

    <div className="auth-links">
      <span style={{color:'var(--text-muted)'}}>حساب کاربری ندارید؟</span>
      <Link href="/register">ساخت حساب جدید</Link>
    </div>
  </AuthShell>
 );
}
