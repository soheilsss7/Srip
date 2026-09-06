import React from 'react';
import './globals.css';
import ShellClient from './_components/shell-client';
import {SkipLink} from './_components/route-state';
import {PreferenceBootstrap} from './_components/preferences';
import SwRegister from './_components/sw-register';

// در نسخۀ استاتیک (GitHub Pages) اپ زیر /Srip/srip2 سرو می‌شود؛ URLهای متادیتا
// خودبه‌خود با basePath حل نمی‌شوند، پس دستی پیشوند می‌گیرند (الگوی sw-register).
const PAGES_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '');
const asset = (p: string) => `${PAGES_BASE}${p}`;

export const metadata={
  title:'تعاملات | هوش روابط راهبردی',
  description:'سامانهٔ عامل هوش روابط راهبردی',
  // PWA: «افزودن به صفحۀ اصلی» بدون این‌ها روی iOS/اندروید نتیجهٔ درست نمی‌دهد
  manifest:asset('/manifest.webmanifest'),
  icons:{
    icon:[
      {url:asset('/favicon-32.png'),sizes:'32x32',type:'image/png'},
      {url:asset('/favicon-64.png'),sizes:'64x64',type:'image/png'},
      {url:asset('/icon.svg'),type:'image/svg+xml'},
    ],
    apple:asset('/apple-touch-icon.png'),
  },
  appleWebApp:{
    capability:'generic',
    statusBarStyle:'black-translucent',
    title:'هوش روابط',
  },
  formatDetection:{telephone:false},
};
// viewport-fit=cover + height:100dvh ⇒ محتوا زیر notch و toolbar بریده نمی‌شود
export const viewport={
  width:'device-width',
  initialScale:1,
  maximumScale:5,
  viewportFit:'cover',
  themeColor:[
    {media:'(prefers-color-scheme: light)',color:'#0F9B8E'},
    {media:'(prefers-color-scheme: dark)',color:'#0B2F4A'},
  ],
};
// Critical inline CSS for the auth-gate veil: guarantees an anonymous visitor
// never sees the platform — even before the main stylesheet arrives.  The same
// rules live in globals.css for post-hydration states (spinner, card, motion).
const gateCriticalCSS = [
  '.auth-gate{position:fixed;inset:0;z-index:999;display:grid;place-items:center;padding:24px;background:var(--srip-bg,#f3f5f9)}',
  '.auth-gate[hidden]{display:none}',
].join('');
export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="fa" dir="rtl">
      <head><style dangerouslySetInnerHTML={{__html: gateCriticalCSS}} /></head>
      <body><PreferenceBootstrap/><SwRegister/><SkipLink/><ShellClient><div id="main-content">{children}</div></ShellClient></body>
    </html>
  );
}
