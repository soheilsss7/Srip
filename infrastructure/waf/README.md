# WAF / Edge Contract

Production request path:

Internet
  -> CDN / CloudFront
  -> AWS WAF
  -> Load Balancer
  -> Web/API containers

The WAF policy provides:

- SQL injection protection through AWS Managed Common Rule Set / Known Bad Inputs.
- XSS protection through the managed Common Rule Set.
- IP reputation blocking through AWS Managed IP Reputation List.
- Rate-abuse protection through a WAF rate-based rule.
- Request-body size enforcement.
- Optional geographic blocking.
- Optional AWS Bot Control (disabled by default because it can require an additional subscription/cost).

The WAF is intentionally outside the API application. Application-level Redis rate limiting from Phase AA remains
required and is not replaced by the edge WAF.

Webhook signature verification remains application-level and is not delegated to WAF.

For CloudFront scope, the WAF resource must be created in us-east-1.
