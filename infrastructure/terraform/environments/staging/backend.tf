terraform {
  # Configure an S3 backend per environment in CI/CD. No local production state should be used.
  backend "s3" {}
}
