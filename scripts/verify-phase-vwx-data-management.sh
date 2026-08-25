#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python - <<'PY'
from pathlib import Path
schema=Path('apps/api/prisma/schema.prisma').read_text()
for token in ['enum ImportPipelineStage','pipelineStage ImportPipelineStage','UPLOADED','MAPPED','VALIDATING','DUPLICATE_DETECTION','REPORT']:
    assert token in schema, token
q=Path('apps/api/src/data-management/data-quality.service.ts').read_text()
for token in ['Duplicate Organizations','Missing Owners','Missing Contacts','Stale Relationships','Invalid Emails','Missing Organizations','Missing Dates','Incomplete Profiles']:
    assert token in q, token
d=Path('apps/api/src/data-management/duplicate-detection.service.ts').read_text()
for token in ['name_similarity','domain','registration_id','phone','country','email','organization']:
    assert token in d, token
i=Path('apps/api/src/data-management/data-import.service.ts').read_text()
for token in ['MAPPING','VALIDATION','DUPLICATE_DETECTION','PREVIEW','APPROVAL','IMPORT','REPORT','duplicateDetection.detect']:
    assert token in i, token
print('PHASE_VWX_STATIC_CONTRACT=PASS')
PY
python - <<'PY'
from pathlib import Path
c=Path('apps/api/src/data-management/data-management.controller.ts').read_text()
for token in ["duplicates/detect", "DuplicateDetectionService", "data.import"]:
    assert token in c, token
print('PHASE_VWX_API_CONTRACT=PASS')
PY
