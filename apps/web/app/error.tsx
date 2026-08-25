'use client';
import {useEffect} from 'react';
import {RouteError} from './_components/route-state';
export default function Error({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error('SRIP route error',error)},[error]);
  return <main className="error-page"><RouteError message="خطای غیرمنتظره‌ای رخ داد. تغییرات ذخیره‌نشده را بررسی کنید و دوباره تلاش کنید."/><button type="button" onClick={reset}>بازنشانی صفحه</button></main>;
}
