import unittest, pathlib, importlib.util, json, copy
BASE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('reader', BASE/'import-public-reader.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
E = [json.loads(p.read_text()) for p in sorted((BASE/'data/sources/rasmio/public-reader/2026-10-31').glob('company-*.json'))]

class PublicReaderTests(unittest.TestCase):
    def test_real_batch_counts(self):
        self.assertEqual(len(E), 4)
        self.assertEqual(sum(len(e['tables']) for e in E), 9)
        self.assertEqual(sum(len(t['rows']) for e in E for t in e['tables']), 45)
        self.assertEqual(sum(len(e['notices']) for e in E), 4)
        self.assertEqual(len(m.graph(E)['edges']), 20)
    def test_identity_mismatch_rejected(self):
        e = copy.deepcopy(E[0]); e['info']['شناسه ملی'] = 'wrong'
        with self.assertRaises(ValueError): m.validate(e)
        with self.assertRaises(ValueError): m.merge(E[0], {'type':'company','id':'wrong'})
    def test_width_and_missing_source_rejected(self):
        e = copy.deepcopy(E[0]); e['tables'][0]['rows'][0].pop()
        with self.assertRaises(ValueError): m.validate(e)
        e = copy.deepcopy(E[0]); e['sourceURL'] = 'https://example.com/'
        with self.assertRaises(ValueError): m.validate(e)
    def test_prior_facts_preserved(self):
        e=E[0]
        old={'type':'company','id':e['id'],'info':{'نشانی ثبتی شرکت':'prior value','custom':'keep'},'rows':[{'header':'old','href':'old','cells':['keep']}],'tables':[{'header':'old','columns':['a'],'rows':[['keep']]}]}
        before=copy.deepcopy(old); p=m.merge(e,old)
        self.assertEqual(old,before)
        self.assertEqual(p['info']['نشانی ثبتی شرکت'],'prior value')
        self.assertIn(before['tables'][0],p['tables'])
        self.assertIn(before['rows'][0],p['rows'])
        self.assertTrue(p['sourceObservations'][0]['conflictsRetained'])
    def test_idempotent_import(self):
        for e in E:
            once=m.merge(e)
            self.assertEqual(m.merge(e,once),once)
    def test_no_completion_or_current_role_claim(self):
        for e in E:
            p=m.merge(e)
            self.assertEqual(p['profileCoverage']['status'],'unverified')
            self.assertFalse(p['profileCoverage']['paginationVerified'])
        g=m.graph(E)
        self.assertFalse(g['canonicalGraphModified'])
        self.assertTrue(all(x['currentRoleVerified'] is False for x in g['edges']))
    def test_notice_privacy_and_provenance(self):
        notices=[n for e in E for n in e['notices']]
        self.assertEqual(len(notices),4)
        for n in notices:
            self.assertFalse(n['directOfficialSourceFetched'])
            self.assertFalse(n['fullOfficialNoticeVerified'])
            self.assertIn('/company/',n['bodyAcquiredFrom'])
        e=copy.deepcopy(next(e for e in E if e['notices']))
        e['notices'][0]['text']+=' 1234567890'
        with self.assertRaises(ValueError):m.validate(e)

if __name__=='__main__': unittest.main()
