#!/usr/bin/env python3
# گام ۵.۱ — بازبرچسب‌گذاری فرم‌ها از شماره‌گذاری v3 به کدهای v6 (F01–F18)
# قاعدهٔ ترتیب: همهٔ جفت‌های دو-رقمی (فرم ۱X) باید پیش از جفت عمومی «فرم ۱» بیایند.
import sys, re

FILES = [
    'app/program/page.tsx',
    'app/calendar/page.tsx',
    'app/intelligence/competitors/page.tsx',
    'app/organizations/[id]/page.tsx',
    'app/partnerships/page.tsx',
    'app/reports/page.tsx',
    'app/ui-v3.css',
    'app/_lib/i18n-dict-c.ts',
    'scripts/mock-api.mjs',
    'scripts/api-tests.mjs',
    'scripts/e2e/program-ui.mjs',
    'scripts/e2e/real-data-ui.mjs',
    'scripts/e2e/partnerships-ui.mjs',
]

FA_PAIRS = [
    # ── نگاشت کددار (فرم‌هایی که در v6 معادل F-code دارند)
    ('فرم ۱۰ و ۱۱.۵', 'F10 و F15'),
    ('فرم ۱۰', 'F10'),
    ('فرم ۱۱', 'F15'),
    ('فرم ۱۲', 'F11'),
    ('فرم ۵', 'F04'),
    ('فرم ۶', 'F05'),
    ('فرم ۷', 'F08'),
    ('فرم ۸', 'F06'),
    ('فرم ۱۶', 'F17'),
    # ── ۱۴: تأیید هزینه (ماژول پلتفرمی — خروجی ۱۶ پروژه صفر v6)
    ('فرم ۱۴ — تأیید هزینه پیش از تعهد', 'تأیید هزینه پیش از تعهد (ماژول پلتفرمی)'),
    ('فرم ۱۴ / پیوست ب سند', 'ماژول پلتفرمی'),
    ('فرم ۱۴ / پیوست ب', 'ماژول پلتفرمی'),
    ('گام ۴.۴ — فرم ۱۴', 'گام ۴.۴ — تأیید هزینه'),
    ('فرم ۱۴', 'تأیید هزینه'),
    # ── ۱۵: گزارش ماهانه (ماژول پلتفرمی — بخش ۲۲ v6)
    ('گزارش ماهانهٔ استاندارد (فرم ۱۵', 'گزارش ماهانهٔ استاندارد (ماژول پلتفرمی'),
    ('گزارش ماهانهٔ تازه (فرم ۱۵)', 'گزارش ماهانهٔ تازه (ماژول پلتفرمی)'),
    ('قالب ثابت فرم ۱۵', 'قالب ثابت گزارش ماهانه'),
    ('(فرم ۱۵؛', '(ماژول پلتفرمی؛'),
    ('(فرم ۱۵ سند)', '(ماژول پلتفرمی)'),
    ('(فرم ۱۵)', '(ماژول پلتفرمی)'),
    ('کارت فرم ۱۵', 'کارت گزارش ماهانه'),
    ('قالب فرم ۱۵', 'قالب گزارش ماهانه'),
    ('از فرم ۱۵ +', 'از گزارش ماهانه +'),
    ('فرم ۱۵:', 'گزارش ماهانه:'),
    ('فرم ۱۵', 'گزارش ماهانه'),
    # ── ۱۷: شاخص‌ها (ماژول پلتفرمی — per-tenant)
    ('فرم ۱۷ سند', 'ماژول شاخص‌ها'),
    ('فرم ۱۷ /', 'ماژول شاخص‌ها /'),
    ('فرم ۱۷', 'ماژول شاخص‌ها'),
    # ── ۱۸: صورت‌جلسهٔ تحویل (ماژول پلتفرمی — F18 v6 کارت دیگری است)
    ('فرم ۱۸ — صورت‌جلسهٔ تحویل برنامه به هلدینگ', 'صورت‌جلسهٔ تحویل برنامه به هلدینگ (ماژول پلتفرمی)'),
    ('فرم ۱۸ — صورت\\u200cجلسهٔ تحویل برنامه به هلدینگ', 'صورت\\u200cجلسهٔ تحویل برنامه به هلدینگ (ماژول پلتفرمی)'),
    ('گام ۴.۵ — فرم ۱۸', 'گام ۴.۵ — صورت‌جلسهٔ تحویل'),
    ('قاعدهٔ فرم ۱۸', 'قاعدهٔ صورت‌جلسهٔ تحویل'),
    ('(فرم ۱۸ سند؛', '(صورت‌جلسهٔ تحویل؛'),
    ('(فرم ۱۸)', '(صورت‌جلسهٔ تحویل)'),
    ('فرم ۱۸:', 'صورت‌جلسهٔ تحویل:'),
    ('فرم ۱۸', 'صورت‌جلسهٔ تحویل'),
    # ── ۱: پروژه صفر (ماژول پلتفرمی — بخش ۵.۱ v6)
    ('فرم ۱ — چک‌لیست پروژه صفر', 'چک‌لیست پروژه صفر (ماژول پلتفرمی)'),
    ('فرم ۱ / پیوست ب', 'ماژول پلتفرمی'),
    ('گام ۴.۶ — فرم ۱', 'گام ۴.۶ — پروژه صفر'),
    ('فرم ۱', 'پروژه صفر'),
    # ── ۲/۳: شناخت (ماژول پلتفرمی — بخش ۶.۱/۶.۲ v6)
    ('فرم ۲ و ۳', 'ماژول شناخت'),
    ('فرم ۲/۳', 'ماژول شناخت'),
    ('فرم ۲ «شناخت هلدینگ»', 'ماژول شناخت هلدینگ'),
    ('فرم ۳ «شناخت زیرمجموعه»', 'ماژول شناخت زیرمجموعه'),
    ('(فرم ۲ سند)', '(ماژول شناخت)'),
    ('(فرم ۳)', '(ماژول شناخت)'),
    ('(فرم ۲)', '(ماژول شناخت)'),
    # ── fixup
    ('F06 و ۷', 'F06 و F08'),
]

EN_PAIRS = [
    ('(Forms 8 & 7)', '(F06 & F08)'),
    ('Forms 8 & 7', 'F06 & F08'),
    ('(Form 8)', '(F06)'),
    ('Form 8', 'F06'),
    ('(Form 7)', '(F08)'),
    ('Form 7', 'F08'),
    ('(Form 5 checklist)', '(F04 checklist)'),
    ('Form 5', 'F04'),
    ('(Form 6)', '(F05)'),
    ('Form 6 — Brand asset registry', 'F05 — Brand asset registry'),
    ('(Form 6 /', '(F05 /'),
    ('(Form 10)', '(F10)'),
    ('Form 10', 'F10'),
    ('(Form 11', '(F15'),
    ('Form 11', 'F15'),
    ('Form 12 — migration steps', 'F11 — data intake & reconciliation steps'),
    ('Form 12 — ten-step system migration control (Section 21)', 'F11 — ten-step data intake & reconciliation control'),
    ("'Form 12 —", "'F11 —"),
    ('Form 12', 'F11'),
    ('Form 17', 'platform KPI module'),
    ('(Form 15)', '(platform module)'),
    ('(Form 14)', '(platform module)'),
    ('Form 14 — Expense approval before commitment', 'Expense approval before commitment (platform module)'),
    ('(Form 14 /', '(platform module /'),
    ('Form 14', 'expense approval'),
    ('Form 18 — Program handover minutes to the holding', 'Program handover minutes (platform module)'),
    ('(Form 18', '(platform module'),
    ('Form 18', 'handover minutes'),
    ('Form 1 — Project Zero checklist', 'Project Zero checklist (platform module)'),
    ('(Form 1 /', '(platform module /'),
    ('Form 1', 'Project Zero'),
]

apply = '--apply' in sys.argv
for f in FILES:
    try:
        txt = open(f, encoding='utf-8').read()
    except FileNotFoundError:
        print(f'⚠ نبود: {f}'); continue
    orig = txt
    counts = []
    for old, new in FA_PAIRS:
        n = txt.count(old)
        if n: counts.append((old, new, n)); txt = txt.replace(old, new)
    if f.endswith('i18n-dict-c.ts'):
        for old, new in EN_PAIRS:
            n = txt.count(old)
            if n: counts.append(('EN: ' + old, new, n)); txt = txt.replace(old, new)
    left = set(re.findall(r'فرم [۰-۹][۰-۹]*', txt)) | set(re.findall(r'پروژه صفر[۰-۹]', txt)) | set(re.findall(r'F06 و ۷', txt))
    if counts or left:
        print(f'── {f}')
        for old, new, n in counts: print(f'   {n}×  «{old}» → «{new}»')
        if left: print(f'   ⚠ باقی‌مانده: {left}')
    if apply and txt != orig:
        open(f, 'w', encoding='utf-8').write(txt)
print('\n✅ اعمال شد' if apply else '\n(dry-run — با --apply اعمال می‌شود)')
