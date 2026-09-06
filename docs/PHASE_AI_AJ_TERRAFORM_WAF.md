# Phase AI + AJ — Terraform / Infrastructure and WAF

## AI — Infrastructure as Code

Implemented:

- Terraform root configuration.
- Reusable modules for network, database, Redis, storage, secrets, monitoring and WAF.
- Separate dev/staging/production environments.
- Managed PostgreSQL.
- Managed Redis.
- S3 object storage with encryption/versioning/public-access blocking.
- AWS Secrets Manager references without committing secret values.
- CloudWatch log groups.
- CloudFront-scope AWS WAF support.

Production architecture target:

Internet
 -> CDN/WAF
 -> Load Balancer
 -> Web/API
 -> Service Layer
 -> PostgreSQL
 -> Redis
 -> Object Storage

## AJ — WAF

Implemented WAF controls:

- SQL injection.
- XSS/common web exploits.
- Known bad inputs.
- IP reputation.
- Rate abuse.
- Request size.
- Optional geographic blocking.
- Optional bot control.

The WAF is complementary to application Redis rate limiting.

## Security rules

Never put secret values in:
- Git
- Terraform source
- frontend bundles
- mobile bundles

Terraform state must be encrypted and stored remotely with access control and locking.

## Deployment semantics

The repository now contains the IaC required to create the production foundation, but applying it to
a real cloud account is intentionally an external deployment operation. Static Terraform checks do not
claim a production deployment is successful.

Before production:
1. Configure the remote state backend.
2. Configure AWS credentials through CI/identity federation.
3. Provision secrets and rotation.
4. Review CIDRs and security groups.
5. Attach WAF to the real CloudFront distribution.
6. Connect CloudFront to the real load balancer.
7. Configure TLS/DNS.
8. Run staging plan/apply.
9. Run health, security, backup/restore and rollback evidence.
10. Promote the reviewed artifact to production.
