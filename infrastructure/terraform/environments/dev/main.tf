module "environment" {
  source = "../../"

  project_name         = "srip"
  environment          = "dev"
  aws_region           = "eu-central-1"
  vpc_cidr             = "10.41.0.0/16"
  db_instance_class    = "db.t4g.micro"
  redis_node_type      = "cache.t4g.micro"
  waf_rate_limit_per_5m = 5000
  enable_bot_control   = false
}
