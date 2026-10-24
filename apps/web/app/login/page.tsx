'use client';
import Link from 'next/link';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiPost,setSession} from '../_lib/api';
import {DEMO_CREDENTIALS,demoOtp} from '../_lib/demo';
import {AuthShell} from '../_components/auth-shell';
import {MOCK_PAGES,useMockApiReady} from '../_lib/mock-ready';
import {Crown,Building2,Sparkles,Lock,User,ShieldCheck,AlertCircle} from 'lucide-react';

const DEMO_CLIENT = { email: 'client@arya-tech.ir', username: 'client', password: '123456' } as const;
const DEMO_ACCOUNTS = [DEMO_CREDENTIALS, DEMO_CLIENT] as const;

export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [mfa,setMfa]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mockReady=useMockApiReady();
 const router=useRouter();
 const canSubmit=mockReady&&!busy;
 const demoError=(m:string)=>MOCK_PAGES&&/404|Failed to fetch|خطای سرور/.test(m)?'سرویس دمو در حال راه‌اندازی است؛ یک لحظه صبر کنید و دوباره تلاش کنید.':m;

 async function finish(d:any){
  if(!d?.accessToken) throw new Error('پاسخ احراز هویت نامعتبر است.');
  setSession(d); router.replace('/dashboard');
 }
 async function submit(e:FormEvent){
  e.preventDefault();
  if(!mockReady){ setError('محیط دمو هنوز آماده نشده است؛ لحظه‌ای صبر کنید.'); return; }
  setBusy(true); setError('');
  const ident=email.trim().toLowerCase();
  try{
   const d=await apiPost<any>('/auth/login',{email,password});
   await finish(d);
  }catch(x){
   const msg=(x as Error).message||'';
   // حساب‌های دمو: اگر MFA خواسته شد، کد را خودکار ساخته و بی‌صدا دوباره تلاش می‌کنیم
   // تا «demo / 123456» در یک مرحله وارد شود (بدون نیاز به کد دستی).
   const isDemo=DEMO_ACCOUNTS.some(a=>ident===a.email.toLowerCase()||ident===(a.username??'').toLowerCase());
   if(isDemo&&/MFA/i.test(msg)){
    try{
     const code=await demoOtp();
     const d=await apiPost<any>('/auth/login',{email,password,otp:code});
     await finish(d); return;
    }catch(x2){
     const m2=(x2 as Error).message||msg;
     setError(demoError(/MFA/i.test(m2)?'کد تأیید دومرحله‌ای لازم است؛ دوباره تلاش کنید.':m2));
    }
   }else if(/MFA|کد.*MFA|multi.?factor/i.test(msg)){
    setMfa(true); setError('کد تأیید دومرحله‌ای لازم است. کد ۶ رقمی را وارد کنید.');
   }else setError(demoError(msg));
  }finally{setBusy(false);}
 }
 async function demoLogin(account:typeof DEMO_ACCOUNTS[number]){
  if(!mockReady){ setError('محیط دمو هنوز آماده نشده است؛ لحظه‌ای صبر کنید.'); return; }
  setBusy(true); setError('');
  try{
   const code=await demoOtp();
   const d=await apiPost<any>('/auth/login',{email:account.email,password:account.password,otp:code});
   await finish(d);
  }catch(x){setError(demoError((x as Error).message||'ورود دمو ناموفق بود.'));}
  finally{setBusy(false);}
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
            type="text" placeholder="demo / you@company.com" required/>
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
        {!mockReady&&<span className="auth-sec-note" role="status">در حال آماده‌سازی محیط دمو… (کمتر از یک لحظه)</span>}
      </div>
      <div className="auth-divider">یا ورود سریع به محیط دمو</div>
      <div className="auth-demo">
        {[
          {a:DEMO_CREDENTIALS as typeof DEMO_ACCOUNTS[number],ico:<Crown size={18}/>,cls:'owner',title:'مالک (همهٔ محدوده)',sub:'همهٔ شرکت‌ها، اشخاص، روابط و تحلیل‌ها'},
          {a:DEMO_CLIENT as typeof DEMO_ACCOUNTS[number],ico:<Building2 size={18}/>,cls:'tenant',title:'سازمان (مستأجر)',sub:'فقط محدودهٔ «آریا فناوری»'},
        ].map(r=>(
          <button type="button" key={r.a.email} className="auth-demo-row" disabled={!canSubmit}
            onClick={()=>demoLogin(r.a)}>
            <span className={`demo-ico ${r.cls}`} aria-hidden="true">{r.ico}</span>
            <span className="demo-meta"><b>{r.title}</b><small>{r.sub}</small></span>
            <span className="demo-creds"><b>{r.a.username}</b> / {r.a.password}</span>
          </button>
        ))}
      </div>
      <p className="auth-demo-hint">
        ورود دستی: <span className="chip">demo / 123456</span> یا <span className="chip">client / 123456</span>
      </p>
      <p className="auth-note">
        <ShieldCheck size={12} style={{verticalAlign:'-2px'}}/> حالت دمو یک دنیای مستقل و پرشده با دادهٔ نمایشی است و به داده‌های واقعی دسترسی ندارد.
      </p>
    </form>

    <div className="auth-links">
      <span style={{color:'var(--text-muted)'}}>حساب کاربری ندارید؟</span>
      <Link href="/register">ساخت حساب جدید</Link>
    </div>
  </AuthShell>
 );
}
