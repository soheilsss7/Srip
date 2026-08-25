output "vpc_id" {
  value = module.network.vpc_id
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "database_endpoint" {
  value     = module.database.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.redis.endpoint
  sensitive = true
}

output "storage_bucket" {
  value = module.storage.bucket_name
}

output "waf_web_acl_arn" {
  value = module.waf.web_acl_arn
}

output "secret_arns" {
  value = module.secrets.secret_arns
}

output "load_balancer_dns_name" {
  value = module.load_balancer.dns_name
}

output "cdn_domain_name" {
  value = module.cdn.domain_name
}
