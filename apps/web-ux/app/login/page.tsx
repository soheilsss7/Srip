'use client';
import Link from 'next/link';
import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiPost,setSession} from '../_lib/api';
import {AuthShell} from '../_components/auth-shell';
import {MOCK_PAGES,useMockApiReady,useSwControlled} from '../_lib/mock-ready';
import {Sparkles,Lock,User,ShieldCheck,AlertCircle} from 'lucide-react';
import { t } from '../_lib/i18n';


export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [mfa,setMfa]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [slowWait,setSlowWait]=useState(false),[gaveUp,setGaveUp]=useState(false);
 const mockReady=useMockApiReady();
 const swControlled=useSwControlled();
 const router=useRouter();
 const waitingSw=MOCK_PAGES&&!swControlled;
 /* دکمهٔ ورود هرگز به آماده‌شدن سرویس‌کارگر گره نمی‌خورد — با پرشدن ایمیل و
    رمز فعال می‌شود؛ اگر SW هنوز آماده نباشد، خودِ submit با تلاش مجدد منتظر
    می‌ماند (تا ~۹۰ ثانیه) تا اتصال برقرار شود و ورود خودکار کامل شود. */
 const canSubmit=!busy;
 /* روی هاست واقعی، دانلود اولیهٔ سرویس‌کارگر (~۱٫۲MB) روی اینترنت کند ممکن است
    ده‌ها ثانیه طول بکشد؛ بعد از ۱۲ ثانیه راهنمای دقیق نشان می‌دهیم و بعد از
    ۳۰ ثانیه دکمه را آزاد می‌کنیم تا کاربر به‌جای دکمهٔ مرده، پیام سرور را ببیند. */
 useEffect(()=>{ if(!waitingSw||slowWait) return; const t=setTimeout(()=>setSlowWait(true),12000); return ()=>clearTimeout(t); },[waitingSw,slowWait]);
 useEffect(()=>{ if(!waitingSw||gaveUp) return; const t=setTimeout(()=>setGaveUp(true),30000); return ()=>clearTimeout(t); },[waitingSw,gaveUp]);
 const demoError=(m:string)=>MOCK_PAGES&&/404|Failed to fetch|خطای سرور/.test(m)?t('سرویس در حال راه‌اندازی است؛ یک لحظه صبر کنید و دوباره تلاش کنید.'):m;

 async function finish(d:any){
  if(!d?.accessToken) throw new Error(t('پاسخ احراز هویت نامعتبر است.'));
  setSession(d); router.replace('/dashboard');
 }
 async function submit(e:FormEvent){
  e.preventDefault();
  if(!email.trim()||password.length<6||(mfa&&otp.length<6)) return;
  setBusy(true); setError('');
  /* در بیلد استاتیک، بار اول ممکن است سرویس‌کارگر هنوز دانلود/فعال نشده باشد؛
     به‌جای خطای بی‌فایده، با آرامش تا ~۹۰ ثانیه تلاش مجدد می‌کنیم. */
  const attempts=MOCK_PAGES?30:1;
  for(let i=1;i<=attempts;i++){
   try{
    const d=await apiPost<any>('/auth/login',{email,password,...(otp?{otp}:{})});
    await finish(d);
    setBusy(false);
    return;
   }catch(x){
    const msg=(x as Error).message||'';
    if(/MFA|کد.*MFA|multi.?factor|دومرحله‌ای/i.test(msg)){
     setMfa(true); setError(t('کد تأیید دومرحله‌ای لازم است. کد ۶ رقمی را وارد کنید.'));
     break;
    }
    const transient=MOCK_PAGES&&/404|Failed to fetch|خطای سرور|NetworkError|fetch/i.test(msg);
    if(transient&&i<attempts){
     setError(t('در حال برقراری اتصال به سامانه… چند لحظه صبر کنید؛ ورود خودکار ادامه می‌یابد.'));
     await new Promise(r=>setTimeout(r,3000));
     continue;
    }
    setError(demoError(msg));
    break;
   }
  }
  setBusy(false);
 }
 return (
  <AuthShell>
    <span className="auth-badge"><Sparkles size={14}/> {t('پلتفرم آماده بهره‌برداری است')}</span>
    <h2>{t('ورود به حساب کاربری')}</h2>
    <p className="ac-sub">
      {t('برای ادامه، اطلاعات ورود خود را وارد کنید. دسترسی‌ها بر اساس نقش و محدودهٔ سازمانی شما تعیین می‌شود.')}
    </p>

    <form onSubmit={submit} className="auth-form" noValidate>
      <div className="field">
        <label className="field-label" htmlFor="login-email">{t('ایمیل یا نام کاربری')}</label>
        <div className="field-ic">
          <User aria-hidden="true"/>
          <input id="login-email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}
            type="text" placeholder="aroun / you@company.com" required/>
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="login-pass">{t('رمز عبور')}</label>
        <div className="field-ic">
          <Lock aria-hidden="true"/>
          <input id="login-pass" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}
            type="password" placeholder="••••••" minLength={6} required/>
        </div>
      </div>
      {mfa&&(
        <div className="field">
          <label className="field-label" htmlFor="login-otp">{t('کد تأیید دومرحله‌ای')} <span className="req">*</span></label>
          <div className="field-ic">
            <ShieldCheck aria-hidden="true"/>
            <input id="login-otp" autoComplete="one-time-code" inputMode="numeric" maxLength={6}
              value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="123456" required/>
          </div>
          <span className="field-hint">{t('کد ۶ رقمی را وارد کنید (در محیط دمو هر ۶ رقم پذیرفته می‌شود).')}</span>
        </div>
      )}
      {error&&(
        <p className="auth-err-row" role="alert"><AlertCircle aria-hidden="true"/><span>{error}</span></p>
      )}
      <div className="auth-pass-row">
        <span />
        <Link href="/forgot-password">{t('رمز عبور را فراموش کرده‌اید؟')}</Link>
      </div>
      <div className="auth-submit-row">
        <button className="btn btn-primary btn-block" type="submit"
          disabled={!canSubmit||!email.trim()||password.length<6||(mfa&&otp.length<6)}>
          {busy?t('در حال احراز هویت…'):t('ورود امن')}
        </button>
        {!mockReady&&<span className="auth-sec-note" role="status">{t('در حال آماده‌سازی محیط… (کمتر از یک لحظه)')}</span>}
        {waitingSw&&!slowWait&&<span className="auth-sec-note" role="status">{t('در حال برقراری اتصال به سامانه… بار اول چند لحظه طول می‌کشد.')}</span>}
        {waitingSw&&slowWait&&<span className="auth-sec-note" role="status">{t('اتصال کند است — بار اول فایل سرویس‌دهندهٔ داده (حدود ۱٫۲ مگابایت) دانلود می‌شود و روی اینترنت کند ممکن است تا یک دقیقه طول بکشد؛ دکمهٔ ورود خودکار فعال می‌شود. اگر بیشتر از یک دقیقه گذشت: (۱) آدرس باید با https:// شروع شود، (۲) پنجرهٔ ناشناس/حالت خصوصی مرورگر نباشد، (۳) یک‌بار با Ctrl+Shift+R رفرش کنید.')}</span>}
      </div>
      <p className="auth-note">
        <ShieldCheck size={12} style={{verticalAlign:'-2px'}}/> دسترسی‌ها بر اساس نقش و محدودهٔ سازمانی شما تعیین می‌شود.
      </p>
    </form>

    <div className="auth-links">
      <span style={{color:'var(--text-muted)'}}>{t('حساب کاربری ندارید؟')}</span>
      <Link href="/register">{t('ساخت حساب جدید')}</Link>
    </div>
  </AuthShell>
 );
}
