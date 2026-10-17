#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - "$ROOT" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1])

def read(rel): return (root / rel).read_text()

life = read('apps/api/src/common/data-lifecycle/data-lifecycle.service.ts')
approve = life[life.index('async approvePermanentDelete'):life.index('async rejectPermanentDelete')]
assert 'tx ?? this.prisma' not in approve
assert "const approval=await this.prisma.approvalRequest.findUnique({where:{id:approvalId}});" in approve
assert "entityType: 'DataLifecycle', entityId: approval.entityId" not in life
assert "assertPermission(approverId,'data.permanent_delete',{organizationId: approval.organizationId ?? undefined})" in life

approval = read('apps/api/src/approvals/approval.service.ts')
assert "const actionContext = approval.entityType === 'DataLifecycle'" in approval
assert 'assertPermission(deciderId, APPROVAL_PERMISSIONS[action], actionContext)' in approval
assert "where: { id: approval.id, status: 'PENDING' }" in approval

admin = read('apps/api/src/admin/admin.service.ts')
assert 'scoringRule.findMany' in admin and 'take: 500' in admin[admin.index('async listScoringRules'):admin.index('async upsertScoringRule')]
assert 'notificationRule.findMany' in admin and 'take: 500' in admin[admin.index('async listNotificationRules'):admin.index('async upsertNotificationRule')]

raw = '\n'.join(p.read_text(errors='ignore') for p in (root/'apps/api/src').rglob('*.ts'))
assert '$queryRawUnsafe' not in raw
assert '$executeRawUnsafe' not in raw
print('PACKAGE8_15_FINAL_AUDIT_STATIC=PASS')
PY
