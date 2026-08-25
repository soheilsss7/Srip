'use client';
import {useEffect,useState} from 'react';
import {CommandPalette} from './command-palette';
import {QuickCreate} from './quick-create';
import {NotificationsDrawer} from './notifications-drawer';
export function AppShellEnhancement(){
 const [cmd,setCmd]=useState(false),[quick,setQuick]=useState(false),[notify,setNotify]=useState(false);
 useEffect(()=>{const f=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCmd(true)}if(e.key==='Escape'){setCmd(false);setQuick(false);setNotify(false)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
 return <><div className="shell-actions"><button title="جستجوی سریع" onClick={()=>setCmd(true)}>⌘K</button><button title="ایجاد سریع" onClick={()=>setQuick(true)}>+</button><button title="اعلان‌ها" onClick={()=>setNotify(true)}>🔔</button></div><CommandPalette open={cmd} onClose={()=>setCmd(false)}/><QuickCreate open={quick} onClose={()=>setQuick(false)}/><NotificationsDrawer open={notify} onClose={()=>setNotify(false)}/></>
}