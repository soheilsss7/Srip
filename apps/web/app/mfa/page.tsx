'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
export default function MFA(){
 const [required,setRequired]=useState<boolean|null>(null),[code,setCode]=useState(''),[label,setLabel]=useState('SRIP Web'),[deviceId,setDeviceId]=useState(''),[secret,setSecret]=useState<any>(null),[msg,setMsg]=useState('');
 useEffect(()=>{api<any>('/auth/mfa/required').then(x=>setRequired(!!x.required)).catch(x=>setMsg(x.message))},[]);
 async function enroll(){try{const x=await api<any>('/auth/mfa/enroll',{method:'POST',body:JSON.stringify({label})});setSecret(x);setDeviceId(x.deviceId??x.id??'')}catch(x){setMsg((x as Error).message)}}
 async function verifyEnrollment(){try{const x=await api('/auth/mfa/verify-enrollment',{method:'POST',body:JSON.stringify({deviceId,code})});setMsg('فعال‌سازی MFA با موفقیت تأیید شد.');console.log(x)}catch(x){setMsg((x as Error).message)}}
 async function verify(){try{await api('/auth/mfa/verify',{method:'POST',body:JSON.stringify({code})});setMsg('کد MFA معتبر است.')}catch(x){setMsg((x as Error).message)}}
 return <main className="auth-page"><section className="auth-card"><p className="eyebrow">SECURITY</p><h1>MFA</h1><p>احراز هویت چندمرحله‌ای با سرویس واقعی Backend.</p><p>الزام فعلی: <strong>{required===null?'—':required?'فعال':'غیرفعال'}</strong></p><label>نام دستگاه<input value={label} onChange={e=>setLabel(e.target.value)}/></label><button className="primary-action" onClick={enroll}>شروع Enrollment</button>{secret&&<pre className="json-view">{JSON.stringify(secret,null,2)}</pre>}<label>Device ID<input value={deviceId} onChange={e=>setDeviceId(e.target.value)}/></label><label>کد ۶ رقمی<input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><div className="toolbar"><button onClick={verifyEnrollment} disabled={!deviceId||code.length<6}>تأیید Enrollment</button><button onClick={verify} disabled={code.length<6}>تأیید کد</button></div>{msg&&<div className="error-card" role="status">{msg}</div>}</section></main>
}
