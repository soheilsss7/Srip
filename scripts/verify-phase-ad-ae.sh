#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/apps/api/scripts/verify-phase-ad.sh"
"$ROOT/apps/api/scripts/verify-phase-ae.sh"
echo 'PHASE_AD_AE_CONTRACTS=PASS'
