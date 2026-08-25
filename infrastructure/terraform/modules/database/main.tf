resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids
  tags       = merge(var.tags, { Name = "${var.name}-db-subnets" })
}

resource "aws_db_instance" "this" {
  identifier              = "${var.name}-postgres"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.instance_class
  allocated_storage       = 100
  max_allocated_storage   = 500
  storage_type            = "gp3"
  storage_encrypted       = true
  multi_az                = true
  publicly_accessible     = false
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.name}-postgres-final"
  backup_retention_period = var.backup_retention_days
  copy_tags_to_snapshot   = true
  auto_minor_version_upgrade = true
  db_name                 = var.db_name
  username                = var.db_username
  manage_master_user_password = true
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.security_group_id]
  performance_insights_enabled = true

  tags = var.tags
}
