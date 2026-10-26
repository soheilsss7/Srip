variable "project_name" {
  type    = string
  default = "srip"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging, or production."
  }
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["eu-central-1a", "eu-central-1b"]
}

variable "db_name" {
  type    = string
  default = "srip"
}

variable "db_username" {
  type      = string
  sensitive = true
  default   = null
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "backup_retention_days" {
  type    = number
  default = 35
}

variable "enable_bot_control" {
  type    = bool
  default = false
  description = "AWS Managed Bot Control can incur additional charges and may require subscription."
}

variable "waf_rate_limit_per_5m" {
  type    = number
  default = 2000
}

variable "waf_max_body_bytes" {
  type    = number
  default = 1048576
}

variable "waf_block_countries" {
  type    = list(string)
  default = []
  description = "Optional ISO 3166-1 alpha-2 country codes to block."
}

variable "enable_cloudfront_waf" {
  type    = bool
  default = true
}

variable "alert_email" { type=string default="" }
