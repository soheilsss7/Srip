'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {AuthShell} from '../_components/auth-shell';
import {ShieldCheck, Smartphone, KeyRound} from 'lucide-react';

export default function MFA(){
 const [required,setRequired]=useState<boolean|null>(null),[code,setCode]=useState(''),[label,setLabel]=useState('SRIP Web'),[deviceId,setDeviceId]=useState(''),[secret,setSecret]=useState<any>(null),[msg,setMsg]=useState('');
 useEffect(()=>{api<any>('/auth/mfa/required').then(x=>setRequired(!!x.required)).catch(x=>setMsg(x.message))},[]);
 async function enroll(){try{const x=await api<any>('/auth/mfa/enroll',{method:'POST',body:JSON.stringify({label})});setSecret(x);setDeviceId(x.deviceId??x.id??'')}catch(x){setMsg((x as Error).message)}}
 async function verifyEnrollment(){try{await api('/auth/mfa/verify-enrollment',{method:'POST',body:JSON.stringify({deviceId,code})});setMsg('فعال‌سازی تأیید دومرحله‌ای با موفقیت انجام شد.');}catch(x){setMsg((x as Error).message)}}
 async function verify(){try{await api('/auth/mfa/verify',{method:'POST',body:JSON.stringify({code})});setMsg('کد تأیید دومرحله‌ای معتبر است.')}catch(x){setMsg((x as Error).message)}}
 return (
  <AuthShell>
    <span className="auth-badge"><ShieldCheck size={14}/> امنیت چندمرحله‌ای</span>
    <h2>احراز هویت چندمرحله‌ای (MFA)</h2>
    <p className="ac-sub">الزام فعلی: <b>{required===null?'در حال بررسی…':required?'فعال':'غیرفعال'}</b> — دستگاه خود را ثبت و کد ۶ رقمی را تأیید کنید.</p>

    <div className="auth-form" style={{gap:14}}>
      <div className="field">
        <label className="field-label" htmlFor="mfa-label">نام دستگاه</label>
        <input id="mfa-label" value={label} onChange={e=>setLabel(e.target.value)} placeholder="مثلاً: لپ‌تاپ کاری"/>
      </div>
      <button className="btn btn-primary btn-block" onClick={enroll}><Smartphone size={16}/> شروع ثبت دستگاه</button>

      {secret&&<pre className="json-view" style={{maxHeight:220}}>{JSON.stringify(secret,null,2)}</pre>}

      <div className="field">
        <label className="field-label" htmlFor="mfa-device">شناسه دستگاه (Device ID)</label>
        <input id="mfa-device" dir="ltr" value={deviceId} onChange={e=>setDeviceId(e.target.value)} placeholder="device-…"/>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="mfa-code">کد ۶ رقمی</label>
        <input id="mfa-code" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="123456" style={{letterSpacing:'.5em',direction:'ltr',textAlign:'center',fontWeight:800}}/>
      </div>
      <div style={{display:'flex',gap:10}}>
        <button className="btn btn-secondary" style={{flex:1}} onClick={verifyEnrollment} disabled={!deviceId||code.length<6}><KeyRound size={15}/> تأیید ثبت</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={verify} disabled={code.length<6}>تأیید کد</button>
      </div>
      {msg&&<div className={msg.includes('موفق')?'notice':''} role="status" style={msg.includes('موفق')?undefined:{background:'var(--srip-danger-soft)',color:'var(--srip-danger)',borderRadius:'var(--radius-md)',padding:'10px 13px',fontSize:12}}>{msg}</div>}
    </div>
    <div className="auth-links" style={{justifyContent:'center'}}><Link href="/login">بازگشت به ورود</Link></div>
  </AuthShell>
 );
}
