locals {
  managed_rules = {
    ip_reputation = {
      name     = "AWS-AWSManagedRulesAmazonIpReputationList"
      priority = 10
      vendor   = "AWS"
    }
    common = {
      name     = "AWS-AWSManagedRulesCommonRuleSet"
      priority = 20
      vendor   = "AWS"
    }
    known_bad_inputs = {
      name     = "AWS-AWSManagedRulesKnownBadInputsRuleSet"
      priority = 30
      vendor   = "AWS"
    }
  }
}

resource "aws_wafv2_web_acl" "this" {
  name  = "${var.name}-web-acl"
  scope = var.scope

  default_action { allow {} }

  rule {
    name     = "ip-reputation"
    priority = 10
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "common-security-rules"
    priority = 20
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-common-security"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "known-bad-inputs"
    priority = 30
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = var.enable_bot_control ? [1] : []
    content {
      name     = "bot-control"
      priority = 40
      override_action { none {} }
      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesBotControlRuleSet"
          vendor_name = "AWS"
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name}-bot-control"
        sampled_requests_enabled   = true
      }
    }
  }

  rule {
    name     = "rate-abuse"
    priority = 50
    action { block {} }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5m
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate-abuse"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "request-size"
    priority = 60
    action { block {} }
    statement {
      size_constraint_statement {
        field_to_match { body {} }
        comparison_operator = "GT"
        size                = var.max_body_bytes
        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-request-size"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = length(var.block_countries) > 0 ? [1] : []
    content {
      name     = "geo-block"
      priority = 70
      action { block {} }
      statement {
        geo_match_statement {
          country_codes = var.block_countries
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name}-geo-block"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-web-acl"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}
