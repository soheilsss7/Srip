import React from 'react';
import './globals.css';
import ShellClient from './_components/shell-client';
import {SkipLink} from './_components/route-state';
import {PreferenceBootstrap} from './_components/preferences';
import SwRegister from './_components/sw-register';

export const metadata={title:'تعاملات | هوش روابط راهبردی',description:'سامانهٔ عامل هوش روابط راهبردی'};
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
