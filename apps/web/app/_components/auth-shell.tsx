'use client';
import React from 'react';
import { Building2, Users, Share2, Sparkles, ShieldCheck, BarChart3, Zap } from 'lucide-react';

const FEATURES = [
  {icon:<Share2 size={16}/>, title:'مدیریت روابط راهبردی', desc:'هر رابطه با امتیاز، ریسک و ارزش استراتژیک رصد می‌شود.'},
  {icon:<Zap size={16}/>, title:'پیشنهادهای هوشمند', desc:'موتور قطعی و شفاف — بدون وابستگی به مدل خارجی.'},
  {icon:<BarChart3 size={16}/>, title:'داشبورد فرماندهی', desc:'شاخص‌های زنده از سرمایهٔ شبکه تا هوش روابط راهبردی.'},
  {icon:<ShieldCheck size={16}/>, title:'امنیت چندلایه', desc:'احراز هویت دومرحله‌ای و کنترل دسترسی مبتنی بر نقش.'},
] as const;

/**
 * Split-panel auth layout.
 * خوانندهٔ فارسی از راست شروع می‌کند؛ بنابراین کارت ورود/فرم همیشه نخستین
 * ستون (راست) است و پنل برند گرادیانی سمت چپ می‌نشیند.
 */
export function AuthShell({children}:{children:React.ReactNode}){
  return (
    <main className="auth-shell">
      <section className="auth-card-side">
        <div className="auth-card-inner">
          <div className="auth-card-logo">
            <span className="acl-mark">S</span>
            <span className="acl-title"><strong>SRIP</strong><small>هوش روابط راهبردی</small></span>
          </div>
          {children}
        </div>
      </section>
      <aside className="auth-brand" aria-hidden="true">
        <div className="ab-top">
          <div className="ab-logo">S</div>
          <div className="ab-title"><strong>SRIP</strong><span>پلتفرم هوشمندی روابط راهبردی</span></div>
        </div>
        <div>
          <h1>سیستم عامل هوشمند<br/>روابط <em>استراتژیک</em> سازمان شما</h1>
          <p className="ab-sub">
            از شبکه ارتباطات کسب‌وکار تا اقدام عملی — همه‌چیز در یک داشبورد فرماندهی یکپارچه،
            مبتنی بر داده، با شفافیت کامل و کنترل دسترسی سازمانی.
          </p>
          <div className="auth-features">
            {FEATURES.map(f=>(
              <div className="auth-feature" key={f.title}>
                <span className="af-ico">{f.icon}</span>
                <div><b>{f.title}</b><span>{f.desc}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="ab-foot">
          <span><ShieldCheck size={13}/> احراز هویت امن + دومرحله‌ای</span>
          <span><Building2 size={13}/> محدودهٔ سازمانی</span>
          <span><BarChart3 size={13}/> ممیزی کامل</span>
        </div>
      </aside>
    </main>
  );
}

export function AuthCard({children}:{children:React.ReactNode}){
  return <div className="auth-form">{children}</div>;
}

export { Building2, Users, Sparkles };
