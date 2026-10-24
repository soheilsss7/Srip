#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""_i18n-wrap-lt.py (فاز ۴/۲۳) — پیچیدن ثابت‌های ماژول-سطحِ دارای t() در lt().
تا در زمان خواندن ترجمه شوند (الزام الگوی LocaleGate). idempotent است."""
import re, io, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

TARGETS = [
    ('app/page.tsx', ['KPI_CARDS', 'COMPONENT_LABELS', 'SRI_LABELS', 'FEATURE_LABELS']),
    ('app/_components/auth-shell.tsx', ['FEATURES']),
    ('app/_components/command-palette.tsx', ['commands']),
    ('app/_components/criteria.tsx', ['STATUS_LABEL']),
    ('app/_components/entity-detail.tsx', ['STATUS_FA', 'KEY_FA']),
    ('app/_components/funnel-visual.tsx', ['STAGES', 'CONV']),
    ('app/_components/nudges.tsx', ['TYPE_FA']),
    ('app/_components/quality-dashboard.tsx', ['FIELD_FA', 'ID_FA']),
    ('app/_components/quick-create.tsx', ['ORG_TYPES', 'REL_TYPES', 'MARKET_KINDS', 'PRIORITIES',
                                          'ACTION_STATUSES', 'RISKS', 'COMMITMENT_STATUSES',
                                          'DIRECTIONS', 'OPP_STATUSES', 'OPP_SOURCES', 'entities']),
    ('app/_components/workspace.tsx', ['ROLE_LABELS']),
    ('app/_lib/nav-structure.ts', ['NAV_ZONES', 'ADMIN_SUBS', 'MOBILE_TABS', 'GLOSS']),
    ('app/ai/page.tsx', ['CAP_FA', 'REF_FA']),
    ('app/network/_graph.tsx', ['TYPE_FA']),
    ('app/network/_nodes.ts', ['STATUS_META', 'DEFAULT_STATUS']),
    ('app/network/page.tsx', ['COLUMN_LABELS', 'TAB_LABELS']),
    ('app/notifications/page.tsx', ['TYPE_FA', 'PRIORITY_FA', 'CHANNEL_FA']),
    ('app/organizations/page.tsx', ['TYPE_LABELS']),
    ('app/people/page.tsx', ['SORTS']),
    ('app/referrals/page.tsx', ['STATUS_FA', 'GATE_META', 'REQ_STATUS_FA', 'OUTCOME_FA']),
    ('app/relationships/page.tsx', ['MARKET_LABEL', 'SORTS']),
    ('app/relationships/[id]/page.tsx', ['SCORE_META']),
    ('app/settings/page.tsx', ['ROLE_LABELS', 'GROUP_FA', 'SCOPE_FA']),
    ('app/qbr/page.tsx', ['TONE_FA']),
]

def wrap_single_line(ln):
    """const X ...= {..};  در یک خط →  = lt({..});"""
    head, rest = ln.split('=', 1)
    rest_stripped = rest.lstrip()
    lead_ws = rest[:len(rest) - len(rest_stripped)]
    opener = rest_stripped[0]
    assert opener in '[{', rest_stripped[:20]
    # یافتن انتهای بلوک با شمارش توازن
    depth = 0
    end_idx = None
    in_str = None
    i = 0
    while i < len(rest_stripped):
        c = rest_stripped[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in "'\"`":
            in_str = c
        elif c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0:
                end_idx = i
                break
        i += 1
    assert end_idx is not None, rest_stripped[:60]
    block = rest_stripped[:end_idx + 1]
    tail = rest_stripped[end_idx + 1:]
    return f"{head}= lt({lead_ws}{block}){tail}"

def find_multiline_end(lines, start_idx, opener):
    closer = ']' if opener == '[' else '}'
    depth = 0
    opened = False
    for j in range(start_idx, min(start_idx + 300, len(lines))):
        for ch in lines[j]:
            if ch in '([{':
                depth += 1
                opened = True
            elif ch in ')]}':
                depth -= 1
        if opened and depth <= 0 and j > start_idx:
            return j
        if opened and depth <= 0 and j == start_idx:
            return None  # تک‌خطی
    return None

changed = 0
notes = []
for rel, names in TARGETS:
    path = os.path.join(ROOT, rel)
    s = io.open(path, encoding='utf-8').read()
    lines = s.split('\n')
    for name in names:
        handled = False
        for i, ln in enumerate(lines):
            m = re.match(rf'^(export )?const {re.escape(name)}\b[^=]*= ?', ln)
            if not m:
                continue
            after = ln[m.end():]
            if after.startswith('lt('):
                handled = True
                break
            if not after.startswith(('[', '{')):
                notes.append((rel, name, 'opener=' + after[:10]))
                handled = True
                break
            opener = after[0]
            # تک‌خطی یا چندخطی؟
            depth = 0
            single = False
            in_str = None
            for ch in ln[m.end():]:
                if in_str:
                    if ch == '\\':
                        continue
                    if ch == in_str:
                        in_str = None
                elif ch in "'\"`":
                    in_str = ch
                elif ch in '([{':
                    depth += 1
                elif ch in ')]}':
                    depth -= 1
            if depth == 0:
                single = True
            if single:
                lines[i] = wrap_single_line(ln)
                changed += 1
                handled = True
                break
            end = find_multiline_end(lines, i, opener)
            if end is None:
                notes.append((rel, name, 'no-end'))
                handled = True
                break
            # خط شروع
            lines[i] = re.sub(r'= ?([\[{}])', lambda mm: '= lt(' + mm.group(1), ln, count=1)
            # خط پایان: ] یا } در ابتدای خط (هر ایندنتی) + اختیاری as const
            endline = lines[end]
            mm = re.match(r'^([ \t]*)([\]\}])(\s*)(as const\s*)?;', endline)
            if mm:
                lines[end] = f"{mm.group(1)}{mm.group(2)}{mm.group(3)}{mm.group(4) or ''});"
            else:
                notes.append((rel, name, f'end-format {endline[:20]!r}'))
                handled = True
                break
            changed += 1
            handled = True
            break
        if not handled:
            notes.append((rel, name, 'no-def'))
    io.open(path, 'w', encoding='utf-8').write('\n'.join(lines))

print(f'wrapped: {changed}')
for n in notes:
    print('  NOTE:', n)
