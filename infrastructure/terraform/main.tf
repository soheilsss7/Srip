locals {
  name = "${var.project_name}-${var.environment}"
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "network" {
  source = "./modules/network"

  name               = local.name
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  tags               = local.tags
}

module "database" {
  source = "./modules/database"

  name                 = local.name
  subnet_ids            = module.network.private_subnet_ids
  security_group_id     = module.network.database_security_group_id
  db_name               = var.db_name
  db_username           = var.db_username
  instance_class        = var.db_instance_class
  backup_retention_days = var.backup_retention_days
  tags                  = local.tags
}

module "redis" {
  source = "./modules/redis"

  name              = local.name
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.redis_security_group_id
  node_type         = var.redis_node_type
  tags              = local.tags
}

module "storage" {
  source = "./modules/storage"

  name = local.name
  tags = local.tags
}

module "secrets" {
  source = "./modules/secrets"

  name = local.name
  tags = local.tags
}

module "monitoring" {
  source = "./modules/monitoring"

  name = local.name
  tags = local.tags
  alert_email = var.alert_email
}

module "load_balancer" {
  source = "./modules/load-balancer"

  name              = local.name
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  tags              = local.tags
}

module "waf" {
  source = "./modules/waf"

  providers = {
    aws = aws.us_east_1
  }

  name                  = local.name
  scope                 = "CLOUDFRONT"
  rate_limit_per_5m     = var.waf_rate_limit_per_5m
  max_body_bytes        = var.waf_max_body_bytes
  block_countries       = var.waf_block_countries
  enable_bot_control    = var.enable_bot_control
  enable_cloudfront_waf = var.enable_cloudfront_waf
  tags                  = local.tags
}

module "cdn" {
  source = "./modules/cdn"

  name              = local.name
  origin_domain_name = module.load_balancer.dns_name
  web_acl_arn       = module.waf.web_acl_arn
  tags              = local.tags
}
