'use client';
import {useEffect,useState} from 'react';

type Theme='system'|'light'|'dark';
export function PreferenceBootstrap(){
 const [theme,setTheme]=useState<Theme>('system');
 useEffect(()=>{
  const saved=(localStorage.getItem('srip_theme') as Theme|null)||'system'; setTheme(saved);
 },[]);
 useEffect(()=>{
  const root=document.documentElement; root.dataset.theme=theme;
  localStorage.setItem('srip_theme',theme);
 },[theme]);
 return null;
}
export function ThemeControl(){
 const [theme,setTheme]=useState<Theme>('system');
 useEffect(()=>setTheme((localStorage.getItem('srip_theme') as Theme|null)||'system'),[]);
 const update=(v:Theme)=>{setTheme(v);document.documentElement.dataset.theme=v;localStorage.setItem('srip_theme',v)};
 return <label className="inline-field">پوسته<select value={theme} onChange={e=>update(e.target.value as Theme)}><option value="system">سیستم</option><option value="light">روشن</option><option value="dark">تیره</option></select></label>;
}
