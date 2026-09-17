#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""پچ‌های دستی فاز ۴/۲۳ — محلی‌سازی لایهٔ نمایش مشترک + سوییچر زبان.
(این اسکریپت idempotent نیست — فقط پس از git checkout اجرا شود.)"""
import io, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        assert s.count(old) == 1, f'{path}: anchor not found once: {old[:60]!r}'
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8').write(s)
    print('ok', path)

# ---- fa.ts ----
patch('app/_lib/fa.ts', [
    ("const TYPE_FA: Record<string, string> = {",
     "import { getLocale } from './i18n';\nconst TYPE_FA: Record<string, string> = {"),
    ("""export const fa = (v: unknown): string => {
  if (v == null) return '—';
  const s = String(v);
  return STATUS_FA[s.toUpperCase()] ?? REL_TYPE_FA[s.toUpperCase()] ?? TYPE_FA[s.toUpperCase()] ?? s;
};""",
     """export const fa = (v: unknown): string => {
  if (v == null) return '—';
  const s = String(v);
  /* فاز ۴/۲۳: در حالت انگلیسی مقدار خام (انگلیسی) نمایش داده می‌شود */
  if (getLocale() === 'en') return s;
  return STATUS_FA[s.toUpperCase()] ?? REL_TYPE_FA[s.toUpperCase()] ?? TYPE_FA[s.toUpperCase()] ?? s;
};"""),
    ("export const labelKey = (k: string): string => KEY_FA[k] ?? k.replace(/[A-Z]/g, c => ' ' + c.toLowerCase()).replace(/_/g, ' ');",
     """export const labelKey = (k: string): string => getLocale() === 'en'
  ? k.replace(/[A-Z]/g, c => ' ' + c.toLowerCase()).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
  : (KEY_FA[k] ?? k.replace(/[A-Z]/g, c => ' ' + c.toLowerCase()).replace(/_/g, ' '));"""),
    ("""export const idFa = (v: string): string => {
  if (!v) return v;""",
     """export const idFa = (v: string): string => {
  if (!v) return v;
  if (getLocale() === 'en') return v;"""),
])

# ---- jalali.ts ----
patch('app/_lib/jalali.ts', [
    ("export const JALALI_MONTHS = [",
     "import { getLocale } from './i18n';\nexport const JALALI_MONTHS = ["),
    ("""export function faNum(value: number | string): string {
  return String(value).replace(/\\d/g, (d) => FA_DIGITS[Number(d)]);
}""",
     """export function faNum(value: number | string): string {
  if (getLocale() === 'en') return String(value);
  return String(value).replace(/\\d/g, (d) => FA_DIGITS[Number(d)]);
}"""),
    ("""export function faFullDate(d: Date = new Date()): string {
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());""",
     """export function faFullDate(d: Date = new Date()): string {
  if (getLocale() === 'en') {
    try { return d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d.toDateString(); }
  }
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());"""),
])

# ---- page-ui.tsx ----
patch('app/_components/page-ui.tsx', [
    ("import { X } from 'lucide-react';",
     "import { X } from 'lucide-react';\nimport { localeTag, isEn } from '../_lib/i18n';"),
    ("""  try{
    return withTime ? d.toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'}) : d.toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'});
  }catch{ return d.toLocaleDateString(); }""",
     """  try{
    /* فاز ۴/۲۳: تاریخ/ارقام مطابق زبان رابط (شمسی-فارسی / میلادی-انگلیسی) */
    const tag=localeTag();
    return withTime ? d.toLocaleString(tag,{dateStyle:'medium',timeStyle:'short'}) : d.toLocaleDateString(tag,{year:'numeric',month:'long',day:'numeric'});
  }catch{ return d.toLocaleDateString(); }"""),
    ("""  if(m<1) return 'همین حالا';
  if(m<60) return `${m} دقیقه پیش`;
  const h=Math.round(m/60);
  if(h<24) return `${h} ساعت پیش`;
  const days=Math.round(h/24);
  if(days<30) return `${days} روز پیش`;
  return formatDate(v);""",
     """  const en=isEn();
  if(m<1) return en ? 'just now' : 'همین حالا';
  if(m<60) return en ? `${m} minute${m===1?'':'s'} ago` : `${m} دقیقه پیش`;
  const h=Math.round(m/60);
  if(h<24) return en ? `${h} hour${h===1?'':'s'} ago` : `${h} ساعت پیش`;
  const days=Math.round(h/24);
  if(days<30) return en ? `${days} day${days===1?'':'s'} ago` : `${days} روز پیش`;
  return formatDate(v);"""),
])

# ---- layout.tsx ----
patch('app/layout.tsx', [
    ("import {PreferenceBootstrap} from './_components/preferences';",
     "import {PreferenceBootstrap} from './_components/preferences';\nimport {LocaleBootstrap} from './_components/locale-context';"),
    ("      <head><style dangerouslySetInnerHTML={{__html: gateCriticalCSS}} /></head>",
     """      <head><style dangerouslySetInnerHTML={{__html: gateCriticalCSS}} /><script dangerouslySetInnerHTML={{__html: "try{if(localStorage.getItem('srip_locale')==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr';}}catch(e){}"}} /></head>"""),
    ("<body><PreferenceBootstrap/><SwRegister/>",
     "<body><PreferenceBootstrap/><LocaleBootstrap/><SwRegister/>"),
])

# ---- workspace.tsx ----
patch('app/_components/workspace.tsx', [
    ("import { AppShellEnhancement } from './app-shell-enhancement';",
     "import { AppShellEnhancement } from './app-shell-enhancement';\nimport { LocaleToggle, TranslationCoverageNote } from './locale-context';"),
    ("""            <AppShellEnhancement />
            <ThemeToggle />""",
     """            <AppShellEnhancement />
            <LocaleToggle />
            <ThemeToggle />"""),
    ("""        <main id="workspace-main" className="workspace-content" tabIndex={-1}>{children}</main>""",
     """        <TranslationCoverageNote pathname={pathname} />
        <main id="workspace-main" className="workspace-content" tabIndex={-1}>{children}</main>"""),
])
print('همهٔ پچ‌های دستی اعمال شد.')
