'use client';
import {useEffect,useState} from 'react';
import {CommandPalette} from './command-palette';
import {QuickCreate} from './quick-create';
import {NotificationsDrawer} from './notifications-drawer';
export function AppShellEnhancement(){
 const [cmd,setCmd]=useState(false),[quick,setQuick]=useState(false),[notify,setNotify]=useState(false);
 useEffect(()=>{const f=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCmd(true)}if(e.key==='Escape'){setCmd(false);setQuick(false);setNotify(false)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
 return <>
    <div className="shell-actions">
      <button className="icon-btn" title="جستجوی سریع" onClick={() => setCmd(true)} aria-label="پالت فرمان"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg></button>
      <button className="icon-btn" title="ایجاد سریع" onClick={() => setQuick(true)} aria-label="ایجاد سریع"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
      <button className="icon-btn" title="اعلان‌ها" onClick={() => setNotify(true)} aria-label="اعلان‌ها"><span className="bell-dot" /><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></button>
    </div>
    <CommandPalette open={cmd} onClose={() => setCmd(false)}/><QuickCreate open={quick} onClose={() => setQuick(false)}/><NotificationsDrawer open={notify} onClose={() => setNotify(false)}/>
  </>
}