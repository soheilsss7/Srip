'use client';
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <html lang="fa" dir="rtl"><body><main className="login"><section className="panel"><h1>خطای غیرمنتظره</h1><p>رابط کاربری با یک خطای غیرقابل بازیابی روبه‌رو شد.</p><button onClick={()=>reset()}>تلاش دوباره</button><a href="/login">بازگشت به ورود</a></section></main></body></html>
}
