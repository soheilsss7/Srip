locals {
  secret_names = [
    "DATABASE_URL",
    "JWT_SECRET",
    "OIDC_CLIENT_SECRET",
    "API_KEYS",
    "AI_PROVIDER_KEYS",
    "STORAGE_KEYS",
    "OAUTH_SECRETS",
    "SECRET_ENCRYPTION_KEY"
  ]
}

resource "aws_secretsmanager_secret" "this" {
  for_each = toset(local.secret_names)

  name                    = "${var.name}/${each.value}"
  recovery_window_in_days = 30
  tags                    = merge(var.tags, { SecretName = each.value })
}

# Secret values are intentionally NOT created here. Values must be provisioned through
# an approved secret-management pipeline/rotation process, never committed to Terraform.
