"""Build production enrichment from saved public evidence against an explicit Git baseline.

This does not crawl, change frontier/visited, or modify the existing sharded graph.
Run: python scripts/rasmio/publish-public-reader.py --base-ref <fresh-remote-SHA>
Publish only the returned file list through an isolated Git index.
"""
import argparse, importlib.util, json, pathlib, subprocess, hashlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = 'scripts/rasmio/data/sources/rasmio/public-reader/2026-10-31'
spec = importlib.util.spec_from_file_location('public_reader', ROOT/'scripts/rasmio/import-public-reader.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

def write(path, value):
    p = ROOT/path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--base-ref', required=True)
    args = args.parse_args()
    base = subprocess.check_output(['git', 'rev-parse', args.base_ref], cwd=ROOT, text=True).strip()
    evidence = [reader.validate(json.loads(p.read_text())) for p in sorted((ROOT/DATA).glob('company-*.json'))]
    if len(evidence) != 4:
        raise ValueError('Unexpected source batch size')
    files = [e['evidenceFile'] for e in evidence]
    receipts = []
    for e in evidence:
        file = f'scripts/rasmio/data/entities/company-{e["id"]}.json'
        # Failure to read an existing production file is fatal, not an empty fallback.
        raw = subprocess.check_output(['git', 'show', f'{base}:{file}'], cwd=ROOT)
        old = json.loads(raw)
        merged = reader.merge(e, old)
        for t in old.get('tables', []):
            assert any(all(r in n['rows'] for r in t['rows']) and n['columns'] == t['columns'] for n in merged['tables'])
        def counts(x):
            return {'infoKeys': len(x.get('info', {})), 'tables': len(x.get('tables', [])), 'tableRows': sum(len(t['rows']) for t in x.get('tables', [])), 'linkedRows': len(x.get('rows', []))}
        receipts.append({'id': e['id'], 'name': e['name'], 'file': file, 'beforeSHA256': hashlib.sha256(raw).hexdigest(), 'afterSHA256': write(file, merged), 'before': counts(old), 'after': counts(merged), 'evidenceFile': e['evidenceFile'], 'evidenceSHA256': reader.sha(e)})
        files.append(file)
    overlay = reader.graph(evidence)
    graphfile = DATA+'/graph-observations.json'
    graphhash = write(graphfile, overlay)
    files.append(graphfile)
    reportfile = 'reports/public-reader-import-2026-10-31.json'
    report = {'baseCommit': base, 'acquisition': 'agent-public-page-reader', 'sourceCompanyPages': len(evidence), 'companiesEnriched': len(evidence), 'tablesObserved': sum(len(e['tables']) for e in evidence), 'tableRowsObserved': sum(len(t['rows']) for e in evidence for t in e['tables']), 'netCanonicalTableRowsAdded': sum(r['after']['tableRows']-r['before']['tableRows'] for r in receipts), 'mirroredNoticeBodiesStored': sum(len(e['notices']) for e in evidence), 'graphObservationEdges': len(overlay['edges']), 'graphObservationFile': graphfile, 'graphObservationSHA256': graphhash, 'mainShardedGraphModified': False, 'directOfficialRrkNotices': 0, 'fullProfileCoverageVerified': False, 'frontierVisitedOrRepairModified': False, 'receipts': receipts}
    write(reportfile, report)
    files.append(reportfile)
    print(json.dumps({'files': files, 'report': report}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
