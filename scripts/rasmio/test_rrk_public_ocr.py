import importlib.util
import json
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('ocr_import', Path(__file__).with_name('import-rrk-public-ocr.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ImportTests(unittest.TestCase):
    def test_redaction_and_preservation_of_company_ids(self):
        self.assertIn('[شناسه', m.redacted('کد ۱۲۳۴۵۶۷۸۹۰'))
        self.assertIn('10260492051', m.redacted('شناسه ۱۰۲۶۰۴۹۲۰۵۱'))

    def test_scope_and_duplicate_imports(self):
        rows = [{'text': 'اعلان وراثت فرد نمونه', 'filename': 'a'},
                {'text': 'ثبت شرکت نمونه با مسئولیت محدود', 'filename': 'b'},
                {'text': 'ثبت شرکت نمونه با مسئولیت محدود', 'filename': 'c'}]
        raw = '\n'.join(json.dumps(x) for x in rows).encode()
        records, stats = m.convert(raw)
        self.assertEqual(stats['inputRows'], 3)
        self.assertEqual(stats['selectedBoxes'], 1)
        self.assertEqual(records[0]['source']['boxFilenames'], ['b', 'c'])
        self.assertFalse(records[0]['verification']['fullNoticeVerified'])
        self.assertEqual(m.convert(raw), (records, stats))

    def test_historical_relationships_are_scoped_and_ambiguous_boxes_rejected(self):
        text = 'تاسیس شرکت بنام شرکت نمونه با مسئولیت محدود مدیریت شرکت با آقای فرد نمونه میباشد'
        a, b = m.relationships(text, 'box:a'), m.relationships(text, 'box:b')
        self.assertEqual(len(a), 1)
        self.assertNotEqual(a[0]['personObservationId'], b[0]['personObservationId'])
        self.assertFalse(a[0]['currentRoleVerified'])
        self.assertEqual(m.relationships(text + ' انحلال شرکت دیگر', 'box:c'), [])

if __name__ == '__main__':
    unittest.main()
