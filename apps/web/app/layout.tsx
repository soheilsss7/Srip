import React from 'react';
import './globals.css';
import ShellClient from './_components/shell-client';
import {SkipLink} from './_components/route-state';
import {PreferenceBootstrap} from './_components/preferences';

export const metadata={title:'تعاملات | Strategic Relationship Intelligence',description:'Strategic Relationship Intelligence Operating System'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body><PreferenceBootstrap/><SkipLink/><ShellClient><div id="main-content">{children}</div></ShellClient></body></html>}
