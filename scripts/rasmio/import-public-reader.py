"""Validate public reader evidence; merge without dropping prior facts or claiming complete profiles."""
import json, hashlib, re, copy
from urllib.parse import urlparse


def sha(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def validate(e):
    if not re.fullmatch(r'\d{11}', e['id']) or e['info'].get('شناسه ملی') != e['id']:
        raise ValueError('Company identity mismatch')
    u = urlparse(e['sourceURL'])
    if u.scheme != 'https' or u.netloc != 'rasmio.com' or u.path != '/company/' + e['id'] + '/direct/':
        raise ValueError('Source scope mismatch')
    if not e['name'].strip() or e.get('acquisition') != 'agent-public-page-reader':
        raise ValueError('Missing source evidence')
    for t in e['tables']:
        if not t['columns'] or any(len(r) != len(t['columns']) for r in t['rows']):
            raise ValueError('Table width mismatch')
        for link in t.get('entityLinks', []):
            if not (0 <= link['row'] < len(t['rows'])) or link['type'] not in ('company', 'person'):
                raise ValueError('Invalid relationship row')
            pattern = r'\d{11}' if link['type'] == 'company' else r'[A-Fa-f0-9]+'
            if not re.fullmatch(pattern, link['id']) or link['name'] not in ' '.join(t['rows'][link['row']]):
                raise ValueError('Relationship identity is not present in source row')
    for n in e.get('notices', []):
        if not re.fullmatch(r'\d+', n['id']) or e['id'] not in n['text'] or len(n['text']) < 80:
            raise ValueError('Invalid notice evidence')
        if re.search(r'(?<!\d)\d{10}(?!\d)', n['text']):
            raise ValueError('Personal identifier not redacted')
    return e


def merge(evidence, previous=None):
    e = validate(evidence)
    p = copy.deepcopy(previous or {'type': 'company', 'id': e['id'], 'rows': []})
    if p.get('id') != e['id'] or p.get('type') != 'company':
        raise ValueError('Existing identity mismatch')
    p['name'] = e['name'] if not p.get('name') or p['name'] == e['id'] else p['name']
    p['url'] = p.get('url') or e['sourceURL']
    p.setdefault('info', {})
    conflicts = []
    for key, value in e['info'].items():
        if not p['info'].get(key) or p['info'][key] == '-':
            p['info'][key] = value
        elif p['info'][key] != value:
            conflicts.append({'field': key, 'retained': p['info'][key], 'observed': value})
    p.setdefault('tables', [])
    p.setdefault('rows', [])
    for incoming in e['tables']:
        header = ' | '.join(incoming['columns'])
        existing = next((t for t in p['tables'] if t.get('header') == header and t.get('columns') == incoming['columns']), None)
        if existing is None:
            existing = {'title': incoming['title'], 'header': header, 'columns': incoming['columns'], 'rows': [], 'cellSpans': []}
            p['tables'].append(existing)
        for row in incoming['rows']:
            if row not in existing['rows']:
                existing['rows'].append(row)
                existing.setdefault('cellSpans', []).append([{'colSpan': 1, 'rowSpan': 1} for _ in row])
        for link in incoming.get('entityLinks', []):
            row = incoming['rows'][link['row']]
            r = {'header': header, 'href': f'https://rasmio.com/{link["type"]}/{link["id"]}/', 'name': link['name'], 'cells': row}
            if not any(x.get('header') == r['header'] and x.get('href') == r['href'] and x.get('cells') == r['cells'] for x in p['rows']):
                p['rows'].append(r)
    p['tableSchemaVersion'] = 2
    p['lastEnrichedAt'] = e['retrievedAt']
    p['profileCompleteness'] = 'unverified'
    p['profileCoverage'] = {**p.get('profileCoverage', {}), 'status': 'unverified', 'paginationVerified': False, 'publicReaderEvidence': True, 'currentRolesIndependentlyVerified': False}
    p.setdefault('sourceObservations', [])
    observation = {'method': e['acquisition'], 'sourceURL': e['sourceURL'], 'retrievedAt': e['retrievedAt'], 'evidenceSHA256': sha(e), 'evidenceFile': e['evidenceFile'], 'tablesObserved': len(e['tables']), 'rowsObserved': sum(len(t['rows']) for t in e['tables']), 'conflictsRetained': conflicts}
    if not any(x.get('evidenceSHA256') == observation['evidenceSHA256'] for x in p['sourceObservations']):
        p['sourceObservations'].append(observation)
    if p.get('via') and p['via'] != 'public-page-reader':
        p.setdefault('previousVia', p['via'])
    p['via'] = 'public-page-reader'
    return p


def graph(evidences):
    nodes, edges = {}, []
    for e in evidences:
        validate(e)
        company = 'company:' + e['id']
        nodes[company] = {'id': company, 'type': 'company', 'nationalId': e['id'], 'name': e['name']}
        for t in e['tables']:
            for link in t.get('entityLinks', []):
                target = link['type'] + ':' + link['id']
                nodes[target] = {'id': target, 'type': link['type'], 'name': link['name'], 'identityNamespace': 'rasmio-provider-linked-id'}
                row = t['rows'][link['row']]
                edges.append({'from': company, 'to': target, 'section': t['title'], 'roleEvidence': row[1], 'cells': row, 'sourceURL': e['sourceURL'], 'evidenceFile': e['evidenceFile'], 'noticeURL': t.get('noticeURLs', [])[link['row']] if t.get('noticeURLs') else None, 'currentRoleVerified': False})
    return {'schemaVersion': 1, 'nodes': list(nodes.values()), 'edges': edges, 'canonicalGraphModified': False, 'nameOnlyIdentityMerges': 0, 'directRrkSourceFetched': False, 'fullCoverageVerified': False}
