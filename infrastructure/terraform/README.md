# Terraform Production Infrastructure

This directory is the Infrastructure-as-Code foundation for the SRIP production architecture.

Target architecture:

Internet
  -> CloudFront/CDN
  -> AWS WAF
  -> Application Load Balancer
  -> containerized API/Web service
  -> managed PostgreSQL / Redis / object storage

The modules are intentionally reusable and environment-specific configuration lives under
`environments/dev`, `environments/staging`, and `environments/production`.

No credentials, tokens, private keys, database passwords, or API keys are stored in Terraform
source. Sensitive values are references to AWS Secrets Manager or deployment-time variables.

Provider choice for this implementation is AWS because the repository already uses AWS/S3-compatible
backup conventions. The modules are still separated so a later provider migration does not require
changing application code.

Production apply is an external-environment operation. A successful `terraform validate`/plan is
not evidence that a real production account, DNS, certificate, WAF, database, Redis, backup or
rollback drill has been exercised.

The root stack also creates an application load balancer target group on port 4000 and a CloudFront distribution in front of it. Application container services must register targets in that target group through the deployment platform; Terraform does not invent a fake application target.
