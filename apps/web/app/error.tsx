'use client';
import {useEffect} from 'react';
import {RouteError} from './_components/route-state';
import {RefreshCw, AlertTriangle} from 'lucide-react';

export default function Error({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error('SRIP route error',error)},[error]);
  return (
    <main className="error-page" style={{minHeight:'60vh',display:'grid',placeItems:'center',padding:24}}>
      <section className="route-error" style={{maxWidth:460,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
        <div className="empty-ico" style={{width:64,height:64,borderRadius:20,color:'var(--srip-danger)'}}><AlertTriangle size={30}/></div>
        <div>
          <div className="eyebrow" style={{textAlign:'center'}}>خطای مسیر</div>
          <strong style={{fontSize:22,display:'block',marginTop:4}}>خطای غیرمنتظره</strong>
          <p style={{marginTop:8}}>تغییرات ذخیره‌نشده را بررسی کنید و دوباره تلاش کنید.</p>
          {error?.digest && <code className="chip neutral" dir="ltr" style={{marginTop:4}}>{error.digest}</code>}
        </div>
        <button className="btn btn-primary" onClick={reset}><RefreshCw size={16}/> بازنشانی صفحه</button>
      </section>
    </main>
  );
}
