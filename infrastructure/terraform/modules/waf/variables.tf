variable "name" { type = string }
variable "scope" {
  type    = string
  default = "CLOUDFRONT"
  validation {
    condition     = contains(["CLOUDFRONT", "REGIONAL"], var.scope)
    error_message = "scope must be CLOUDFRONT or REGIONAL."
  }
}
variable "rate_limit_per_5m" { type = number, default = 2000 }
variable "max_body_bytes" { type = number, default = 1048576 }
variable "block_countries" { type = list(string), default = [] }
variable "enable_bot_control" { type = bool, default = false }
variable "enable_cloudfront_waf" { type = bool, default = true }
variable "tags" { type = map(string) }
