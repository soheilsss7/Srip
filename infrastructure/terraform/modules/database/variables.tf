variable "name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string, sensitive = true, nullable = true }
variable "instance_class" { type = string }
variable "backup_retention_days" { type = number }
variable "tags" { type = map(string) }
