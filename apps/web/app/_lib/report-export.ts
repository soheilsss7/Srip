import { api, apiBlob, ApiError } from './api';

const EXPORT_APPROVAL_KEY = 'srip.export.approval.';

export function storedExportApprovalId(kind: string): string | null {
  try { return localStorage.getItem(EXPORT_APPROVAL_KEY + kind); } catch { return null; }
}

export async function clearStoredExportApproval(kind: string) {
  try { localStorage.removeItem(EXPORT_APPROVAL_KEY + kind); } catch { /* ignore */ }
}

export type ExportFlowResult =
  | { status: 'downloaded' }
  | { status: 'approval_pending'; approvalId: string }
  | { status: 'error'; message: string };

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function requestApproval(kind: string, format: string): Promise<string> {
  const created: any = await api('/approvals', {
    method: 'POST',
    body: JSON.stringify({
      entityType: 'Report',
      entityId: kind,
      actionType: 'EXPORT',
      reason: `Export of report ${kind} (${format})`,
    }),
  });
  const approvalId = created?.id ?? created?.approvalId ?? created?.data?.id;
  if (!approvalId) throw new Error('Approval request did not return an identifier');
  localStorage.setItem(EXPORT_APPROVAL_KEY + kind, approvalId);
  return approvalId;
}

export async function downloadReport(
  kind: string,
  format: 'csv' | 'xlsx' | 'pdf' | 'json',
  onPending?: (approvalId: string) => void,
): Promise<ExportFlowResult> {
  const approvalId = storedExportApprovalId(kind);
  const url = `/reports/${encodeURIComponent(kind)}/export/${encodeURIComponent(format)}${approvalId ? `?approvalId=${encodeURIComponent(approvalId)}` : ''}`;
  try {
    const blob = await apiBlob(url);
    triggerDownload(blob, `srip-${kind}.${format}`);
    return { status: 'downloaded' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      try {
        const id = await requestApproval(kind, format);
        onPending?.(id);
        return { status: 'approval_pending', approvalId: id };
      } catch (inner) {
        return { status: 'error', message: inner instanceof Error ? inner.message : String(inner) };
      }
    }
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}