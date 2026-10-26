module "environment" {
  source = "../../"

  project_name         = "srip"
  environment          = "production"
  aws_region           = "eu-central-1"
  vpc_cidr             = "10.43.0.0/16"
  db_instance_class    = "db.t4g.medium"
  redis_node_type      = "cache.t4g.small"
  waf_rate_limit_per_5m = 2000
  enable_bot_control   = true
}
