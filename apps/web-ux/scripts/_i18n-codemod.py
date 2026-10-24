#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""i18n codemod v3 (فاز ۴/۲۳) — نسخهٔ امن‌شدهٔ نهایی.

ترتیب پاس‌ها: (D) template ها با اسکنر state-machine → (A) اتریبیوت‌های دابل‌کوت JSX
→ (C) لیترال‌های تک‌کوت JS → (B) گره‌های متنی JSX تک‌خط → (E) fa-IR → (F) importها.
"""
import re, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PAGES = ['login','register','forgot-password','password-reset','mfa','dashboard','organizations',
         'people','relationships','network','referrals','actions','notifications','search','settings',
         'board','ai','qbr','enrichment','push']
PERS = re.compile(r'[\u0600-\u06FF]')
WS = re.compile(r'\s+')

target_files = []
for root, dirs, fs in os.walk(os.path.join(ROOT, 'app')):
    for f in fs:
        if not f.endswith(('.tsx', '.ts')):
            continue
        p = os.path.join(root, f)
        r = os.path.relpath(p, ROOT).replace(os.sep, '/')
        if r in ('app/_lib/fa.ts', 'app/_lib/jalali.ts', 'app/layout.tsx', 'app/_lib/i18n.ts'):
            continue
        if os.path.basename(r).startswith('i18n-dict-'):
            continue
        inc = (any(re.search(rf'app/({x})(/|\.|\[)', r) for x in PAGES)
               or r.startswith('app/_components/')
               or r in ('app/page.tsx',)
               or r.startswith(('app/error', 'app/not-found', 'app/loading'))
               or r == 'app/_lib/nav-structure.ts')
        if inc:
            target_files.append(p)

DISPLAY_ATTRS = {'title','aria-label','placeholder','label','description','sub','eyebrow','heading',
                 'emptyLabel','searchPlaceholder','summary','text','caption','hint','alt','content',
                 'confirmText','cancelText','empty','name'}
SKIP_CALL_BEFORE = ('includes(', 'startsWith(', 'endsWith(', 'indexOf(',
                    'replace(', 'replaceAll(', 'split(', 'match(')
msgid = set()

def norm(s: str) -> str:
    return WS.sub(' ', s.strip())

def esc(s: str) -> str:
    return s.replace('\\', '\\\\').replace("'", "\\'")

def register(core: str) -> str:
    v = norm(core)
    if v and PERS.search(v):
        msgid.add(v)
        return v
    return ''

def transform_templates(src: str) -> str:
    """اسکنر state-machine: فقط سگمنت‌های متنی ایستای template واقعی را می‌پیچد."""
    out = []
    i, n = 0, len(src)
    mode = None           # 'sq' 'dq' 'lc' 'bc' — فقط بیرون از template
    tpl_stack = []        # [interp_depth, brace_depth]
    seg_start = None

    def flush_seg():
        if seg_start is None:
            return
        seg = ''.join(out[seg_start:])
        v = register(seg)
        if v:
            lead = seg[:len(seg) - len(seg.lstrip())]
            trail = seg[len(seg.rstrip()):]
            del out[seg_start:]
            out.append(lead + "${t('" + esc(v) + "')}" + trail)

    while i < n:
        c = src[i]
        nxt = src[i+1] if i+1 < n else ''
        in_tpl = bool(tpl_stack)
        in_interp = in_tpl and tpl_stack[-1][0] > 0
        if mode == 'sq':
            if c == '\\': out.append(src[i:i+2]); i += 2; continue
            if c == "'" or c == '\n': mode = None
            out.append(c); i += 1; continue
        if mode == 'dq':
            if c == '\\': out.append(src[i:i+2]); i += 2; continue
            if c == '"' or c == '\n': mode = None
            out.append(c); i += 1; continue
        if mode == 'lc':
            if c == '\n': mode = None
            out.append(c); i += 1; continue
        if mode == 'bc':
            if c == '*' and nxt == '/': mode = None
            out.append(c); i += 1; continue
        if not in_tpl and not in_interp:
            if c == '/' and nxt == '/': mode = 'lc'; out.append('//'); i += 2; continue
            if c == '/' and nxt == '*': mode = 'bc'; out.append('/*'); i += 2; continue
            if c == "'" or c == '"':
                q = c; out.append(c); i += 1
                while i < n:
                    if src[i] == '\\': out.append(src[i:i+2]); i += 2; continue
                    out.append(src[i])
                    if src[i] == q or src[i] == '\n': break
                    i += 1
                i += 1; continue
        if in_interp:
            top = tpl_stack[-1]
            if c == '`':
                # آغاز template تو در تو داخل ${} بیرونی
                tpl_stack.append([0, 0]); out.append('`'); seg_start = len(out)
                i += 1; continue
            if c == "'" or c == '"':
                q = c; out.append(c); i += 1
                while i < n:
                    if src[i] == '\\': out.append(src[i:i+2]); i += 2; continue
                    out.append(src[i])
                    if src[i] == q or src[i] == '\n': break
                    i += 1
                i += 1; continue
            if c == '/' and nxt == '/':
                out.append('//'); i += 2
                while i < n and src[i] != '\n': out.append(src[i]); i += 1
                continue
            if c == '{': top[1] += 1; out.append(c); i += 1; continue
            if c == '}':
                if top[1] > 0:
                    top[1] -= 1
                else:
                    top[0] = 0
                    out.append(c); i += 1
                    seg_start = len(out)
                    continue
                out.append(c); i += 1; continue
            out.append(c); i += 1; continue
        # in template static text
        if c == '`':
            if tpl_stack and tpl_stack[-1][0] == 0:
                # بستن template جاری (در متن ایستای آن هستیم)
                flush_seg()
                out.append('`')
                tpl_stack.pop()
                seg_start = None
                if tpl_stack and tpl_stack[-1][0] > 0:
                    seg_start = None       # داخل ${} بیرونی — کد است
                elif tpl_stack:
                    seg_start = len(out)   # ادامهٔ متن template بیرونی
            else:
                # آغاز template در سطح بالای کد
                tpl_stack.append([0, 0]); out.append('`'); seg_start = len(out)
            i += 1; continue
        if c == '$' and nxt == '{':
            flush_seg()
            out.append('${'); i += 2
            tpl_stack[-1][0] = 1
            tpl_stack[-1][1] = 0
            seg_start = None
            continue
        if c == '\\':
            out.append(src[i:i+2]); i += 2; continue
        out.append(c); i += 1; continue
    # unterminated template — بازتولید ناقص مجاز نیست؛ اگر stack خالی نیست، source را دست‌نخورده برگردان
    if tpl_stack:
        return src
    return ''.join(out)

changed = []
for path in sorted(target_files):
    src = open(path, encoding='utf-8').read()
    orig = src
    imp = os.path.relpath(os.path.join(ROOT, 'app/_lib/i18n'), os.path.dirname(path)).replace(os.sep, '/')
    if not imp.startswith('.'):
        imp = './' + imp

    # ---------- D) template literal ها ----------
    src = transform_templates(src)

    # ---------- A) اتریبیوت‌های JSX (دابل‌کوت) ----------
    def attr_repl(m):
        name, val = m.group(1), m.group(2)
        if name not in DISPLAY_ATTRS:
            return m.group(0)
        v = register(val)
        if not v:
            return m.group(0)
        return f"{name}={{t('{esc(v)}')}}"
    src = re.sub(r'([A-Za-z][A-Za-z0-9-]*)=\"([^\\"\n]*[\u0600-\u06FF][^\"\n]*)\"', attr_repl, src)

    # ---------- C) لیترال‌های تک‌کوت ----------
    lit_re = re.compile(r"'([^'\\\n]*[\u0600-\u06FF][^'\\\n]*)'")
    KEYWORDS = {'return','case','typeof','new','in','of','instanceof','void','delete','throw','yield','await','do','else','from'}
    def lit_repl(m):
        val = m.group(1)
        start, end = m.span()
        pre_s = src[max(0, start-40):start].rstrip()
        if pre_s.endswith('t(') or pre_s.endswith('t ('):
            return m.group(0)
        if re.search(r'\bcase\s$', pre_s):
            return m.group(0)
        if re.search(r'(===|!==|==|!=)\s*$', pre_s):
            return m.group(0)
        if any(pre_s.endswith(c) for c in SKIP_CALL_BEFORE):
            return m.group(0)
        # اگر کاراکتر غیرفاصلهٔ قبل، پایان شناسه/عبارت است، این کوتیشن «بستهٔ»
        # رشتهٔ قبلی است نه آغاز literal — جفت‌شدن غلط را می‌شکند (باگ criteria).
        pre_char = pre_s[-1] if pre_s else ''
        if pre_char and (pre_char.isalnum() or pre_char in '_$)]"\''):
            tok = re.search(r'([A-Za-z_$][A-Za-z0-9_$]*)$', pre_s)
            if not (tok and tok.group(1) in KEYWORDS):
                return m.group(0)
        post = src[end:end+3]
        if re.match(r'\s*:', post) and re.search(r'[\{,(\n]\s*$', pre_s):
            return m.group(0)
        v = register(val)
        if not v:
            return m.group(0)
        return f"t('{esc(v)}')"
    while True:
        new = lit_re.sub(lit_repl, src)
        if new == src:
            break
        src = new

    # ---------- B) گره‌های متنی JSX (تک‌خط، شروع با فارسی) ----------
    def jsx_repl(m):
        lead, body, trail = m.group(1), m.group(2), m.group(3)
        v = register(body)
        if not v:
            return m.group(0)
        return f">{lead}{{t('{esc(v)}')}}{trail}<"
    txt = r"[^<>{};=|&?'\"\n]*?[\u0600-\u06FF][^<>{};=|&?'\"\n]*?"
    src = re.sub(r'>([ \t]*)(' + txt + r')([ \t]*)<', jsx_repl, src)

    # ---------- E) 'fa-IR' ----------
    for pat in ["toLocaleDateString('fa-IR'", "toLocaleString('fa-IR'", "toLocaleTimeString('fa-IR'",
                "Intl.NumberFormat('fa-IR'", "Intl.DateTimeFormat('fa-IR'"]:
        if pat in src:
            src = src.replace(pat, pat.replace("'fa-IR'", 'localeTag()'))

    # ---------- F) importها ----------
    used_t = re.search(r'(?:[\s({\[=,>:!]|\A)t\(', src) is not None
    used_tag = 'localeTag()' in src
    if used_t or used_tag:
        m = re.search(r"import\s*\{([^}]*)\}\s*from\s*'[^']*i18n';", src)
        have = set(x.strip() for x in m.group(1).split(',') if x.strip()) if m else set()
        pieces = set()
        if used_t and 't' not in have: pieces.add('t')
        if used_tag and 'localeTag' not in have: pieces.add('localeTag')
        if pieces:
            if m:
                inner = ', '.join(sorted(have | pieces))
                src = src[:m.start()] + f"import {{ {inner} }} from '{imp}';" + src[m.end():]
            else:
                lines = src.split('\n')
                last_imp = 0
                in_imp = False
                for idx, ln in enumerate(lines[:140]):
                    st = ln.strip()
                    if in_imp:
                        if re.search(r"from\s+['\"][^'\"]+['\"];?\s*$", st):
                            in_imp = False
                            last_imp = idx
                        continue
                    if st.startswith('import '):
                        if re.search(r"from\s+['\"][^'\"]+['\"];?\s*$", st):
                            last_imp = idx      # تک‌خطی کامل
                        else:
                            in_imp = True       # چندخطی — تا خط بسته‌شدن
                if last_imp == 0:
                    # بدون import — بعد از کامنت‌های ابتدایی/«use client»، قبل از نخستین کد
                    for idx, ln in enumerate(lines[:140]):
                        st = ln.strip()
                        if st.startswith(('export ', 'const ', 'function ', 'type ', 'interface ', 'class ', 'declare ')):
                            last_imp = idx - 1
                            break
                lines.insert(last_imp + 1, f"import {{ {', '.join(sorted(pieces))} }} from '{imp}';")
                src = '\n'.join(lines)

    if src != orig:
        open(path, 'w', encoding='utf-8').write(src)
        changed.append(os.path.relpath(path, ROOT))

out = os.path.join(ROOT, 'scripts', '.i18n-msgids.txt')
with open(out, 'w', encoding='utf-8') as f:
    for m in sorted(msgid):
        f.write(m + '\n')
print(f'files changed: {len(changed)} / {len(target_files)}')
print(f'unique msgids: {len(msgid)} -> {out}')
