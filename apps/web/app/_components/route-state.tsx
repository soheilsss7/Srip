'use client';
import React from 'react';
import {Button, ErrorState} from '@srip/design-system';

export function RouteLoading({label='در حال بارگذاری…'}:{label?:string}){
  return <div className="route-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/>{label}</div>;
}

export function RouteError({message='در بارگذاری این بخش خطایی رخ داد.'}:{message?:string}){
  return <section className="route-error" role="alert"><strong>خطا</strong><ErrorState message={message}/><Button type="button" onClick={()=>location.reload()}>تلاش مجدد</Button></section>;
}

export function SkipLink(){return <a className="skip-link" href="#main-content">پرش به محتوای اصلی</a>}
