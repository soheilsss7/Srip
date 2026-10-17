'use client';
import React from 'react';
import {ErrorState} from '@srip/design-system';
import {RefreshCw, Loader2} from 'lucide-react';
import { t } from '../_lib/i18n';

export function RouteLoading({label=t('در حال بارگذاری…')}:{label?:string}){
  return (
    <div className="route-state" role="status" aria-live="polite" style={{flexDirection:'column',gap:12,padding:40}}>
      <span className="spinner" aria-hidden="true"/>
      <span style={{fontSize:12.5,color:'var(--text-secondary)',fontWeight:700}}>{label}</span>
    </div>
  );
}

export function RouteError({message=t('در بارگذاری این بخش خطایی رخ داد.')}:{message?:string}){
  return (
    <section className="route-error" role="alert" style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <strong style={{fontSize:20}}>{t('خطا')}</strong>
      <ErrorState message={message}/>
      <button className="btn btn-primary" type="button" onClick={()=>location.reload()}><RefreshCw size={15}/> {t('تلاش مجدد')}</button>
    </section>
  );
}

export function SkipLink(){return <a className="skip-link" href="#main-content">{t('پرش به محتوای اصلی')}</a>}
export {Loader2};
