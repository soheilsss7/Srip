#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF="$ROOT/terraform"

required=(
  "$TF/main.tf"
  "$TF/versions.tf"
  "$TF/providers.tf"
  "$TF/modules/network/main.tf"
  "$TF/modules/database/main.tf"
  "$TF/modules/redis/main.tf"
  "$TF/modules/storage/main.tf"
  "$TF/modules/secrets/main.tf"
  "$TF/modules/monitoring/main.tf"
  "$TF/modules/waf/main.tf"
  "$TF/environments/dev/main.tf"
  "$TF/environments/staging/main.tf"
  "$TF/environments/production/main.tf"
)

for f in "${required[@]}"; do
  test -f "$f" || { echo "MISSING: $f"; exit 1; }
done

grep -q 'AWSManagedRulesCommonRuleSet' "$TF/modules/waf/main.tf"
grep -q 'AWSManagedRulesKnownBadInputsRuleSet' "$TF/modules/waf/main.tf"
grep -q 'AWSManagedRulesAmazonIpReputationList' "$TF/modules/waf/main.tf"
grep -q 'rate_based_statement' "$TF/modules/waf/main.tf"
grep -q 'size_constraint_statement' "$TF/modules/waf/main.tf"
grep -q 'geo_match_statement' "$TF/modules/waf/main.tf"
grep -q 'AWSManagedRulesBotControlRuleSet' "$TF/modules/waf/main.tf"

if grep -RInE '(access_key|secret_key|password\s*=|token\s*=).*(["'\''])' "$TF" \
  --include='*.tf' --include='*.tfvars'; then
  echo "Potential hard-coded secret detected."
  exit 1
fi

echo "PHASE_AI_AJ_STATIC_CONTRACT=PASS"
if command -v terraform >/dev/null 2>&1; then
  terraform -chdir="$TF" fmt -check -recursive
  terraform -chdir="$TF" init -backend=false -input=false
  terraform -chdir="$TF" validate
  echo "PHASE_AI_AJ_TERRAFORM_VALIDATE=PASS"
else
  echo "Terraform binary not installed; runtime validation not executed."
fi
