#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python - <<'PY'
from pathlib import Path
s=Path('apps/api/prisma/schema.prisma').read_text()
for token in ['model DataImport {','model DataImportRow {','model DataImportDuplicate {','model DataQualitySnapshot {','enum ImportEntityType','enum ImportFormat','enum ImportStatus','enum ImportRowStatus','enum DuplicateStrategy']:
    assert token in s, token
src=Path('apps/api/src/data-management')
for f in ['data-import.service.ts','data-quality.service.ts','data-management.controller.ts','data-management.module.ts','data-import.utils.ts']:
    assert (src/f).exists(), f
for token in ['data.import','data.import.approve','data.quality.read','data.quality.execute']:
    assert token in Path('apps/api/src/common/authorization/access.constants.ts').read_text(), token
print('DATA_IMPORT_QUALITY_STATIC_CHECK=PASS')
PY
