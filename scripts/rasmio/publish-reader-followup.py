"""Merge the second immutable public-reader batch against an explicit remote commit."""
import argparse, importlib.util, pathlib, json, subprocess, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('reader',ROOT/'scripts/rasmio/import-public-reader.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
DATA='scripts/rasmio/data/sources/rasmio/public-reader/2026-10-31-followup'

def dump(file,value):
 p=ROOT/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--base-ref',required=True);args=parser.parse_args()
 base=subprocess.check_output(['git','rev-parse',args.base_ref],cwd=ROOT,text=True).strip()
 evidence=[m.validate(json.loads(p.read_text())) for p in sorted((ROOT/DATA).glob('company-*.json'))]
 assert len(evidence)==2 and sum(len(t['rows']) for e in evidence for t in e['tables'])==97
 assert sum(len(e['notices']) for e in evidence)==9
 files=[];receipts=[]
 for e in evidence:
  file=f'scripts/rasmio/data/entities/company-{e["id"]}.json';raw=subprocess.check_output(['git','show',f'{base}:{file}'],cwd=ROOT);old=json.loads(raw);result=m.merge(e,old)
  result.setdefault('noticeReferences',[])
  for n in e['notices']:
   ref={'rasmioNoticeId':n['id'],'evidenceFile':e['evidenceFile'],'sourceURL':e['sourceURL'],'directOfficialSourceFetched':False}
   if ref not in result['noticeReferences']:result['noticeReferences'].append(ref)
  before=sum(len(t['rows']) for t in old.get('tables',[]));after=sum(len(t['rows']) for t in result.get('tables',[]))
  receipts.append({'id':e['id'],'file':file,'beforeTableRows':before,'afterTableRows':after,'beforeSHA256':hashlib.sha256(raw).hexdigest(),'afterSHA256':dump(file,result),'evidenceFile':e['evidenceFile'],'evidenceSHA256':m.sha(e)})
  files += [file,e['evidenceFile']]
 report={'baseCommit':base,'companiesEnriched':2,'tablesObserved':6,'tableRowsObserved':97,'netCanonicalTableRowsAdded':sum(r['afterTableRows']-r['beforeTableRows'] for r in receipts),'newMirroredNoticeBodies':9,'directOfficialRrkNotices':0,'fullProfileCoverageVerified':False,'mainGraphModified':False,'frontierOrVisitedModified':False,'receipts':receipts}
 reportfile='reports/public-reader-followup-2026-10-31.json';dump(reportfile,report);files.append(reportfile)
 print(json.dumps({'files':files,'report':report},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
