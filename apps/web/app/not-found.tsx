import Link from 'next/link';
import {AlertTriangle, Home, RefreshCw} from 'lucide-react';

export default function NotFound(){
 return (
  <main className="error-page" style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
   <section className="route-error" style={{maxWidth:460,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
    <div className="empty-ico" style={{width:64,height:64,borderRadius:20}}><AlertTriangle size={30}/></div>
    <div>
      <div className="eyebrow" style={{textAlign:'center'}}>۴۰۴ · یافت نشد</div>
      <strong style={{fontSize:24,display:'block',marginTop:4}}>صفحه پیدا نشد</strong>
      <p style={{marginTop:8}}>مسیر در این Workspace وجود ندارد یا برای شما قابل دسترسی نیست.</p>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
      <Link className="btn btn-primary" href="/"><Home size={16}/> بازگشت به داشبورد</Link>
      <Link className="btn btn-secondary" href="/search"><RefreshCw size={16}/> جستجوی سراسری</Link>
    </div>
   </section>
  </main>
 );
}
