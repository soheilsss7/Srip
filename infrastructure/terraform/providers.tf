variable "aws_region" {
  type        = string
  description = "AWS region for regional resources."
  default     = "eu-central-1"
}

provider "aws" {
  region = var.aws_region
}

# CloudFront/WAF resources use us-east-1 when a CLOUDFRONT-scope WebACL is selected.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
