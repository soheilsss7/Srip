"""Acquire and import a pinned, MIT-licensed third-party historical RRK OCR sample.
Does not represent a direct crawl, verified transcription, or current company data.
"""
import argparse
import base64
import hashlib
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime, timezone

REPOSITORY = 'Rasmio-com/OldRRK'
COMMIT = 'f7296586b23671ddc296b0492ef70324c68b04c4'
BLOB = '28daa1d1e3fab287a12575e9115e0cfae13361d8'
SOURCE_PATH = 'samples/OCR.Boxes.jsonl'
DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def normalized(text):
    return text.translate(DIGITS).replace('ي', 'ی').replace('ك', 'ک')


def redacted(text):
    return re.sub(r'(?<!\d)\d{10}(?!\d)', '[شناسهٔ ده‌رقمی حذف شد]', normalized(text))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def corporate_candidate(text):
    return bool(re.search(r'(?:ثبت\s*شرکت|شرکت\s*سهامی|شرکت\s*سهامى|شرکت\s*با\s*مسئولیت\s*محدود)', normalized(text)))


def relationships(text, box_id):
    # Extremely narrow historical evidence, deliberately no identity resolution.
    companies = list(re.finditer(r'(?:به\s*نام|بنام)\s+شرکت\s+(.{2,90}?)\s+با\s*مسئولیت\s*محدود', text))
    people = list(re.finditer(r'مدیریت\s+شرکت\s+با\s+(?:آقای|اقای)\s+(.{2,90}?)\s+(?:می\s*باشد|میباشد|است)', text))
    headings = re.findall(r'(?:تاسیس|تأسیس|انحلال|تغییرات)\s+شرکت', text)
    if len(companies) != 1 or len(people) != 1 or len(headings) > 1:
        return []
    company, person = companies[0], people[0]
    if not all(re.fullmatch(r'[\u0600-\u06ff\s‌]+', x.group(1)) for x in (company, person)):
        return []
    return [{'companyObservationId': box_id + ':company', 'companyNameOCR': company.group(1).strip(),
             'personObservationId': box_id + ':person', 'personNameOCR': person.group(1).strip(),
             'roleEvidenceOCR': person.group(0), 'role': 'historical-company-management-observation',
             'companyNameEvidenceOCR': company.group(0), 'sourceBoxId': box_id,
             'identityResolution': 'unresolved', 'ocrTranscriptionVerified': False,
             'currentRoleVerified': False}]


def convert(raw):
    records = {}
    stats = {'inputRows': 0, 'companyCandidateRows': 0, 'duplicateTextRows': 0,
             'selectedBoxes': 0, 'candidateRelationships': 0, 'canonicalIdentityMerges': 0,
             'fullNoticesVerified': 0, 'modernNationalIdsAssigned': 0}
    for line in raw.decode('utf-8').splitlines():
        if not line.strip():
            continue
        stats['inputRows'] += 1
        row = json.loads(line)
        text, filename = row.get('text'), row.get('filename')
        if not isinstance(text, str) or not isinstance(filename, str) or len(text) > 1000000:
            raise ValueError('Invalid OCR source row')
        if not corporate_candidate(text):
            continue
        stats['companyCandidateRows'] += 1
        cleaned = redacted(text).strip()
        content_hash = digest(cleaned.encode())
        if content_hash in records:
            stats['duplicateTextRows'] += 1
            if filename not in records[content_hash]['source']['boxFilenames']:
                records[content_hash]['source']['boxFilenames'].append(filename)
            continue
        box_id = 'rrk:public-ocr-box:' + content_hash
        record = {'schemaVersion': 1, 'recordId': box_id, 'recordType': 'historical-ocr-company-candidate-box',
                  'textOCR': cleaned, 'textSHA256': content_hash,
                  'source': {'repository': REPOSITORY, 'commit': COMMIT, 'blob': BLOB,
                             'path': SOURCE_PATH, 'boxFilenames': [filename],
                             'url': f'https://github.com/{REPOSITORY}/blob/{COMMIT}/{SOURCE_PATH}',
                             'license': 'MIT', 'originalPortalReportedByPublisher': 'ocr.rrk.ir',
                             'directOfficialSourceFetched': False, 'scanImageIndependentlyVerified': False},
                  'verification': {'ocrTranscriptionVerified': False, 'fullNoticeVerified': False,
                                   'dateVerified': False, 'nationalCompanyIdentityResolved': False,
                                   'canonicalProfileModified': False, 'currentRoleVerified': False},
                  'privacy': {'standaloneTenDigitNumbersRedacted': True},
                  'candidateRelationships': relationships(cleaned, box_id)}
        records[content_hash] = record
    result = [records[k] for k in sorted(records)]
    stats['selectedBoxes'] = len(result)
    stats['candidateRelationships'] = sum(len(r['candidateRelationships']) for r in result)
    return result, stats


def api(path):
    return json.loads(subprocess.check_output(['gh', 'api', path], timeout=90))


def acquire():
    tree = api(f'repos/{REPOSITORY}/git/trees/{COMMIT}?recursive=1')
    if tree.get('truncated'):
        raise ValueError('Truncated source tree')
    blobs = {x['path']: x for x in tree['tree'] if x['type'] == 'blob'}
    item = blobs[SOURCE_PATH]
    if item['sha'] != BLOB or item['size'] > 15000000:
        raise ValueError('Pinned source mismatch or oversized source')
    blob = api(f'repos/{REPOSITORY}/git/blobs/{BLOB}')
    raw = base64.b64decode(blob['content'], validate=False)
    if len(raw) != item['size'] or hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != BLOB:
        raise ValueError('Source Git blob digest mismatch')
    license_blob = api(f'repos/{REPOSITORY}/git/blobs/{blobs["LICENSE"]["sha"]}')
    license_text = base64.b64decode(license_blob['content']).decode()
    if 'MIT License' not in license_text or 'Copyright (c) 2025 Rasmio' not in license_text:
        raise ValueError('Expected license not found')
    return raw, license_text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='scripts/rasmio/data/sources/rrk/public-ocr')
    args = parser.parse_args()
    raw, license_text = acquire()
    records, stats = convert(raw)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    payload = ''.join(json.dumps(r, ensure_ascii=False, sort_keys=True) + '\n' for r in records).encode()
    graph = {'schemaVersion': 1, 'canonicalGraphModified': False, 'identityMerges': 0,
             'ocrTranscriptionVerified': False, 'currentRolesVerified': False,
             'edges': [edge for r in records for edge in r['candidateRelationships']]}
    graph_bytes = (json.dumps(graph, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()
    manifest = {'schemaVersion': 1, 'acquiredAt': datetime.now(timezone.utc).isoformat(),
                'sourceRepository': REPOSITORY, 'sourceCommit': COMMIT, 'sourceBlob': BLOB,
                'rawSourceSHA256': digest(raw), 'rawSourceBytes': len(raw), 'license': 'MIT',
                'directOfficialSourceFetched': False, 'completeRrkCoverage': False,
                'stats': stats, 'files': {'company-boxes.jsonl': {'sha256': digest(payload), 'bytes': len(payload)},
                                        'candidate-relationships.json': {'sha256': digest(graph_bytes), 'bytes': len(graph_bytes)}}}
    (output / 'company-boxes.jsonl').write_bytes(payload)
    (output / 'candidate-relationships.json').write_bytes(graph_bytes)
    (output / 'LICENSE.source.txt').write_text(license_text, encoding='utf-8')
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
