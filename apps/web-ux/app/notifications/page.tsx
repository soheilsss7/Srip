'use client';
import {useEffect,useState,useCallback} from 'react';
import {api,unwrapList} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,SectionCard,StatCard} from '../_components/page-ui';
import {Bell, BellRing, Mail, Smartphone, CheckCheck, RefreshCw, Inbox, Zap, CalendarClock, CheckCircle2} from 'lucide-react';

const PREF_FIELDS=['inAppEnabled','emailEnabled','pushEnabled','digestEnabled','criticalOnly','dailyDigest','weeklyDigest'] as const;
const PREF_LABELS:Record<string,{label:string;desc:string}> = {
  inAppEnabled:{label:'اعلان درون‌برنامه‌ای',desc:'نمایش در مرکز اعلان'},
  emailEnabled:{label:'ایمیل',desc:'ارسال به ایمیل سازمانی'},
  pushEnabled:{label:'فشاری',desc:'اعلان لحظه‌ای دستگاه'},
  digestEnabled:{label:'خلاصهٔ فعال',desc:'خلاصهٔ دوره‌ای فعال است'},
  criticalOnly:{label:'فقط موارد بحرانی',desc:'ارسال فقط برای اولویت بحرانی'},
  dailyDigest:{label:'خلاصهٔ روزانه',desc:'خلاصهٔ روزانه'},
  weeklyDigest:{label:'خلاصهٔ هفتگی',desc:'خلاصهٔ هفتگی'},
};
const PRIORITY_TONE:Record<string,'danger'|'warning'|'info'|'neutral'|'success'>={critical:'danger',important:'warning',recommendation:'info',reminder:'info',information:'neutral',success:'success'};
const TYPE_ICON:Record<string,React.ReactNode>={REMINDER:<BellRing size={15}/>,RECOMMENDATION:<Zap size={15}/>,SYSTEM:<CheckCircle2 size={15}/>,ALERT:<BellRing size={15}/>};

export default function Notifications(){
 const [items,setItems]=useState<any[]>([]),[unread,setUnread]=useState(0),[prefs,setPrefs]=useState<Record<string,boolean>>({}),[log,setLog]=useState<any[]>([]);
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{
   setLoading(true);setError('');
   try{
     const [n,u,pref,l]=await Promise.all([
       api('/notifications').then(unwrapList),
       api('/notifications/unread-count'),
       api<any>('/notifications/preferences'),
       api('/notifications/delivery-log').then(unwrapList),
     ]);
     setItems(n);
     setUnread(typeof u==='number'?u:typeof (u as any)?.count==='number'?(u as any).count:0);
     setPrefs(pref&&typeof pref==='object'?pref:{});
     setLog(l);
   }catch(x){setError((x as Error).message)}
   finally{setLoading(false)}
 },[setItems,setUnread,setPrefs,setLog,setLoading,setError]);
 useEffect(()=>{load()},[load]);
 async function read(id:string){setBusy('read'+id);try{await api('/notifications/'+id+'/read',{method:'PATCH'});await load()}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function readAll(){setBusy('readall');try{await api('/notifications/read-all',{method:'PATCH'});await load()}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function savePrefs(){setBusy('prefs');setError('');setStatus('');try{await api('/notifications/preferences',{method:'PATCH',body:JSON.stringify(prefs)});setStatus('تنظیمات اعلان ذخیره شد.');await load()}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 async function digest(cadence:string){setBusy(cadence);setError('');setStatus('');try{const r:any=await api(`/notifications/digest/${cadence}`,{method:'POST',body:JSON.stringify({})});setStatus(r?.sent?`Digest ${cadence} ارسال شد (${r?.count??0} مورد).`:r?.reason==='digest-disabled'?`خلاصهٔ دوره‌ای ${cadence} غیرفعال است یا ایمیل خاموش است.`:r?.reason==='empty'?'اعلانی برای خلاصهٔ دوره‌ای نبود.':r?.reason==='no-email'?'حساب شما ایمیل ندارد.':'خلاصهٔ دوره‌ای ارسال نشد.');}catch(x){setError((x as Error).message)}finally{setBusy('')}}
 const toggle=(k:string)=>setPrefs(p=>({...p,[k]:!p[k]}));

 const channels=new Set(items.map(n=>n.channel).filter(Boolean)).size;

 return (
  <main className="feature-page">
    <PageHeader
      eyebrow="اعلان‌ها"
      title="مرکز اعلان"
      description="اعلان‌ها در کانال‌های درون‌برنامه‌ای/ایمیل/فشاری، ترجیحات، خلاصهٔ دوره‌ای و گزارش تحویل — با واقعیت سرور."
      actions={
        <>
          <button className="btn btn-secondary" onClick={load} disabled={!!busy}><RefreshCw size={15}/> بازخوانی</button>
          <button className="btn btn-primary" onClick={readAll} disabled={!!busy}><CheckCheck size={15}/> خواندن همه</button>
        </>
      }
    />
    <ErrorCard message={error}/>
    {status&&<div className="notice" role="status">{status}</div>}

    {loading ? (
      <div className="stat-grid">{[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-card" style={{height:110}}/>)}</div>
    ) : (<>
      <div className="stat-grid">
        <StatCard icon={<Bell size={18}/>} label="خوانده‌نشده" value={unread} iconClass="ic-red" sub={unread>0?'نیازمند توجه':'همه خوانده شد'} trend={unread>0?{dir:'down',text:'جدید'}:undefined}/>
        <StatCard icon={<Inbox size={18}/>} label="کل اعلان‌ها" value={items.length} iconClass="ic-blue"/>
        <StatCard icon={<Smartphone size={18}/>} label="کانال‌های فعال" value={channels} iconClass="ic-teal"/>
        <StatCard icon={<Mail size={18}/>} label="تحویل‌های ثبت‌شده" value={log.length} iconClass="ic-gold"/>
      </div>

      <SectionCard title="اعلان‌ها" icon={<BellRing size={17}/>} description={`${unread} مورد خوانده‌نشده`}
        actions={unread>0&&<button className="btn btn-ghost btn-sm" onClick={readAll} disabled={!!busy}><CheckCheck size={14}/> همه خوانده شد</button>}>
        {items.length===0 ? (
          <div className="empty-state-v4">
            <div className="empty-ico"><Inbox size={24}/></div>
            <strong>اعلانی وجود ندارد</strong>
            <p>اعلان‌های جدید (یادآوری، پیشنهاد هوشمند، سیستم) اینجا نمایش داده می‌شوند.</p>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {items.map(n=>{
              const tone=PRIORITY_TONE[String(n.priority).toLowerCase()]??'neutral';
              const readAt=n.readAt??n.isRead===true;
              return (
                <div key={n.id} className={`ai-match-card ${!readAt?'unread-card':''}`} style={{borderInlineStart:!readAt?'3px solid var(--srip-accent)':undefined,display:'flex',gap:12,alignItems:'flex-start'}}>
                  <span className={`stat-ico ${tone==='danger'?'ic-red':tone==='warning'?'ic-gold':tone==='info'?'ic-purple':'ic-blue'}`} style={{width:36,height:36,borderRadius:10,flex:'0 0 auto'}}>
                    {TYPE_ICON[n.type]??<Bell size={16}/>}
                  </span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <b style={{fontSize:13.5}}>{n.title}</b>
                      {!readAt&&<span className="chip danger">جدید</span>}
                    </div>
                    <p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.75,margin:'3px 0 0'}}>{n.body}</p>
                    <div className="match-meta" style={{marginTop:6}}>
                      <span className="chip neutral">{String(n.priority).toUpperCase()}</span>
                      {n.channel&&<span className="chip neutral">{n.channel}</span>}
                      <span style={{display:'inline-flex',alignItems:'center',gap:4}}><CalendarClock size={12}/> {new Date(n.createdAt).toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'})}</span>
                      {!readAt&&<button className="btn btn-ghost btn-sm" style={{marginInlineStart:'auto'}} onClick={()=>read(n.id)} disabled={!!busy}>علامت‌گذاری خوانده</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))',gap:14}}>
        <SectionCard title="ترجیحات اعلان" icon={<Bell size={17}/>} description="کانال‌ها و حالت‌های ارسال">
          <div style={{display:'grid',gap:9}}>
            {PREF_FIELDS.map(k=>{
              const meta=PREF_LABELS[k];
              return (
                <label key={k} className="checkbox-label" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',border:'1px solid var(--card-border)',borderRadius:'var(--radius-md)',background:'var(--card-bg-soft)',cursor:'pointer'}}>
                  <input type="checkbox" checked={!!prefs[k]} onChange={()=>toggle(k)} style={{width:17,height:17,accentColor:'var(--srip-accent)'}}/>
                  <span style={{flex:1}}><b style={{display:'block',fontSize:12.5,color:'var(--text-primary)'}}>{meta.label}</b><small style={{color:'var(--text-muted)',fontSize:10.5}}>{meta.desc}</small></span>
                </label>
              );
            })}
          </div>
          <div className="form-actions" style={{justifyContent:'flex-start'}}>
            <button className="btn btn-primary btn-sm" onClick={savePrefs} disabled={!!busy}>{busy==='prefs'?'در حال ذخیره…':'ذخیره ترجیحات'}</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>digest('DAILY')} disabled={!!busy}>ارسال Digest روزانه</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>digest('WEEKLY')} disabled={!!busy}>ارسال Digest هفتگی</button>
          </div>
        </SectionCard>

        <SectionCard title="گزارش ارسال" icon={<Mail size={17}/>} description="سوابق تحویل اعلان در کانال‌ها">
          {log.length===0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Mail size={24}/></div>
              <strong>لاگ تحویلی ثبت نشده است</strong>
              <p>پس از اولین ارسال اعلان، سوابق اینجا نمایش داده می‌شوند.</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {log.slice(0,12).map((l:any,i:number)=>(
                <div className="ai-match-card" key={l.id??i} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className={`stat-ico ${l.accepted?'ic-green':'ic-red'}`} style={{width:30,height:30,borderRadius:9,flex:'0 0 auto'}}>{l.accepted?<CheckCircle2 size={14}/>:<BellRing size={14}/>}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <b style={{fontSize:12.5}}>{l.title??l.channel??'تحویل'}</b>
                    <div className="match-meta">{l.channel} · {l.provider} · {l.createdAt?new Date(l.createdAt).toLocaleString('fa-IR'):'—'}</div>
                  </div>
                  <span className={`chip ${l.accepted?'success':'danger'}`}>{l.accepted?'پذیرفته':'خطا'}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>)}
  </main>
 );
}
