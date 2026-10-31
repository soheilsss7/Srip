"""Export saved evidence to an RTL workbook. Optional dependency: openpyxl."""
import json, pathlib, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

ROOT=pathlib.Path(__file__).resolve().parents[2]
DATA=ROOT/'scripts/rasmio/data/sources/rasmio/public-reader/2026-10-31'
E=[json.loads(p.read_text()) for p in sorted(DATA.glob('company-*.json'))]
if '--followup' in sys.argv:
    merged={e['id']:e for e in E}
    for p in sorted((DATA.parent/'2026-10-31-followup').glob('company-*.json')):
        e=json.loads(p.read_text()); old=merged[e['id']]
        old['tables'].extend(e['tables']);old['notices'].extend(e['notices'])
    E=list(merged.values())
g=json.loads((DATA/'graph-observations.json').read_text())
wb=Workbook(); wb.remove(wb.active)

def sheet(name,headers,rows,widths):
    ws=wb.create_sheet(name); ws.sheet_view.rightToLeft=True
    ws.append(headers)
    for row in rows: ws.append([str(x) if x is not None else '' for x in row])
    ws.freeze_panes='A2'; ws.auto_filter.ref=ws.dimensions
    ws.row_dimensions[1].height=30
    for c in ws[1]:
        c.fill=PatternFill('solid',fgColor='17364D'); c.font=Font(name='Arial',size=11,bold=True,color='FFFFFF'); c.alignment=Alignment(horizontal='right',vertical='center')
    for i,row in enumerate(ws.iter_rows(min_row=2),2):
        ws.row_dimensions[i].height=52
        for c in row:
            c.font=Font(name='Arial',size=11)
            c.alignment=Alignment(horizontal='right',vertical='top',wrap_text=True)
            c.number_format='@'
            if i%2==0:c.fill=PatternFill('solid',fgColor='EDF4F7')
            if str(c.value or '').startswith('https://'):
                c.hyperlink=c.value;c.font=Font(name='Arial',size=10,color='176F9A',underline='single')
    for i,width in enumerate(widths,1):ws.column_dimensions[get_column_letter(i)].width=width
    return ws

sheet('راهنما',['موضوع','شرح'],[
['محتوا',f"{len(E)} پرونده شرکت، {sum(len(e['tables']) for e in E)} جدول، {sum(len(t['rows']) for e in E for t in e['tables'])} ردیف جدول، {sum(len(e['notices']) for e in E)} متن آگهی بازنشرشده، {len(g['edges'])} پیوند مستند"],
['منبع','صفحات عمومی رسمیو؛ دریافت مستقیم از RRK انجام نشده است.'],
['محدوده','این بسته تکمیل همه شرکت‌ها نیست. صفحه‌های محدود، گزینه مشاهده سایر موارد، و بخش‌های نیازمند ورود کامل بررسی نشده‌اند.'],
['تاریخ','۳۱ اکتبر ۲۰۲۶؛ تاریخ‌های شمسی داخل داده بدون تبدیل تقویم حفظ شده‌اند.'],
['اشخاص','شناسه اشخاص شناسه پیوند رسمیو است، نه کد ملی. کد ملی شخصی از متن آگهی حذف شده است.'],
['روابط','روابط مشاهده‌شده دارای ارجاع و تاریخ هستند؛ سمت تاریخی به سمت فعلی تبدیل نشده است. گراف اصلی شاردشده در این ورود تغییر نکرد.'],
['ردیف‌ها','؛ '.join(e['name']+': '+str(sum(len(t['rows']) for t in e['tables'])) for e in E)],
['آگهی ناقص','آگهی 130239471 در خود منبع بریده بود و به عنوان متن کامل وارد نشده است.']
],[24,115])
keys=['تاریخ تاسیس','وضعیت شرکت','نوع شرکت','آخرین آگهی روزنامه رسمی','شماره ثبت','کد اقتصادی','سرمایه ثبتی','کد پستی','نشانی ثبتی شرکت','نشانی ثبتی کارخانه']
sheet('شرکت‌ها',['شناسه ملی شرکت','نام شرکت',*keys,'صفحه منبع','زمان دریافت'],[[e['id'],e['name'],*[e['info'].get(k,'') for k in keys],e['sourceURL'],e['retrievedAt']] for e in E],[19,34,18,20,21,22,16,20,31,19,85,70,65,30])
rows=[]
for e in E:
    for t in e['tables']:
        for i,row in enumerate(t['rows']):
            url=t.get('noticeURLs',[])[i] if t.get('noticeURLs') else t.get('rowURLs',[])[i] if t.get('rowURLs') else ''
            rows.append([e['id'],e['name'],t['title'],' | '.join(t['columns']),*row,*(['']*(5-len(row))),url,e['sourceURL']])
sheet('ردیف‌های جدول',['شناسه شرکت','نام شرکت','جدول','عنوان ستون‌ها','ستون ۱','ستون ۲','ستون ۳','ستون ۴','ستون ۵','ارجاع ردیف','صفحه دریافت'],rows,[19,31,29,60,38,60,35,24,22,60,65])
sheet('پیوندهای مستند',['از','به','بخش','سمت ثبت‌شده در ردیف','داده ردیف','آگهی مرتبط','صفحه دریافت','سمت فعلی مستقل تایید شده؟'],[[r['from'],r['to'],r['section'],r['roleEvidence'],' | '.join(r['cells']),r['noticeURL'],r['sourceURL'],'خیر'] for r in g['edges']],[29,29,30,65,100,60,65,28])
ws=sheet('متن آگهی‌ها',['شناسه شرکت','شناسه آگهی رسمیو','تاریخ چاپ','تاریخ نامه ثبت','متن بازنشرشده با حذف کد ملی اشخاص','پیوند ناشر','صفحه دریافت واقعی','دریافت مستقیم RRK؟'],[[e['id'],n['id'],n['printDate'],n['registrationLetterDate'],n['text'],n['publisherNoticeURL'],n['bodyAcquiredFrom'],'خیر'] for e in E for n in e['notices']],[19,24,19,19,150,60,65,24])
for i in range(2,ws.max_row+1):ws.row_dimensions[i].height=180
out=ROOT/('deliverables/rasmio-data-2026-10-31-expanded.xlsx' if '--followup' in sys.argv else 'deliverables/rasmio-data-2026-10-31.xlsx');out.parent.mkdir(exist_ok=True);wb.save(out)
print(out)
