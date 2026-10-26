'use client';
import {AlertTriangle, RefreshCw, Home} from 'lucide-react';
const LOGIN_HREF = process.env.NEXT_PUBLIC_API_URL?.startsWith('/Srip') ? '/Srip/login' : '/login';
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return (
  <html lang="fa" dir="rtl">
   <body style={{margin:0,fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif',background:'#f3f5f9',color:'#101828'}}>
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
     <section style={{maxWidth:440,width:'100%',textAlign:'center',background:'#fff',border:'1px solid #eaedf3',borderRadius:20,boxShadow:'0 16px 40px -14px rgba(20,30,70,.16)',padding:'34px 28px',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <div style={{width:64,height:64,borderRadius:20,display:'grid',placeItems:'center',background:'rgba(251,77,73,.1)',color:'#fb4d49'}}><AlertTriangle size={30}/></div>
      <div>
       <div style={{letterSpacing:'.14em',textTransform:'uppercase',fontSize:11,fontWeight:800,color:'#5751e9'}}>خطای بحرانی</div>
       <h1 style={{fontSize:22,margin:'6px 0 0'}}>خطای غیرقابل بازیابی</h1>
       <p style={{color:'#667085',fontSize:13,lineHeight:1.8,marginTop:8}}>رابط کاربری با یک خطای غیرمنتظره روبه‌رو شد. با «تلاش دوباره» ادامه دهید.</p>
      </div>

      <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
       <button onClick={()=>reset()} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#6366f1',color:'#fff',border:0,borderRadius:12,padding:'11px 18px',fontSize:13,fontWeight:800,cursor:'pointer'}}><RefreshCw size={16}/> تلاش دوباره</button>
       <a href={LOGIN_HREF} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',color:'#101828',border:'1px solid #dfe3ea',borderRadius:12,padding:'11px 18px',fontSize:13,fontWeight:800,textDecoration:'none'}}><Home size={16}/> بازگشت به ورود</a>
      </div>
     </section>
    </main>
   </body>
  </html>
 );
}
