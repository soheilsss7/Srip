module "environment" {
  source = "../../"

  project_name         = "srip"
  environment          = "staging"
  aws_region           = "eu-central-1"
  vpc_cidr             = "10.42.0.0/16"
  db_instance_class    = "db.t4g.small"
  redis_node_type      = "cache.t4g.small"
  waf_rate_limit_per_5m = 3000
  enable_bot_control   = false
}
