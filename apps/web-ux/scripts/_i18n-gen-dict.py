#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تبدیل TSV های ترجمه به فایل‌های TS دیکشنری + گزارش پوشش (فاز ۴/۲۳)."""
import io, os, glob, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
SRC_DIR = os.path.join(HERE, '.i18n-dict-src')
MSGIDS = os.path.join(HERE, '.i18n-msgids.txt')

entries = {}
dupes = []
for p in sorted(glob.glob(os.path.join(SRC_DIR, 'Part*.tsv'))):
    for ln, line in enumerate(io.open(p, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) != 2:
            print(f'!! BAD LINE {p}:{ln}: {line[:60]!r}')
            continue
        k, v = parts
        if k in entries and entries[k] != v:
            dupes.append((k, entries[k], v))
        entries[k] = v

msgids = [l.rstrip('\n') for l in io.open(MSGIDS, encoding='utf-8') if l.strip()]
missing = [m for m in msgids if m not in entries]
extra = [k for k in entries if k not in set(msgids)]

print(f'dict entries: {len(entries)} | msgids: {len(msgids)}')
print(f'missing: {len(missing)} | extra: {len(extra)} | conflicting dupes: {len(dupes)}')
for m in missing[:25]:
    print('  MISSING:', m[:80])
for m in extra[:10]:
    print('  EXTRA:', m[:80])
for d in dupes[:5]:
    print('  DUPE:', d[0][:40], '->', d[1][:20], '/', d[2][:20])

def ts_escape(s: str) -> str:
    return s.replace('\\', '\\\\').replace("'", "\\'")

items = [(k, entries[k]) for k in msgids if k in entries]
# برای کلیدهای extra که در msgid نیستند هم نگه می‌داریم (ایمن)
for k in extra:
    items.append((k, entries[k]))

N = 3
per = (len(items) + N - 1) // N
for i in range(N):
    chunk = items[i*per:(i+1)*per]
    name = chr(ord('a') + i)
    body = ',\n'.join(f"  '{ts_escape(k)}': '{ts_escape(v)}'" for k, v in chunk)
    out = f"/* دیکشنری انگلیسی فاز ۴/۲۳ — بخش {i+1} از {N} (تولیدشده توسط scripts/_i18n-gen-dict.py) */\nexport const EN_DICT_{name.upper()}: Record<string, string> = {{\n{body},\n}};\n"
    io.open(os.path.join(ROOT, 'app', '_lib', f'i18n-dict-{name}.ts'), 'w', encoding='utf-8').write(out)
    print(f'wrote app/_lib/i18n-dict-{name}.ts ({len(chunk)} entries)')
