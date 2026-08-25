variable "name" { type=string }
variable "tags" { type=map(string) }
variable "alert_email" { type=string default="" }
variable "application_error_threshold" { type=number default=5 }
variable "slow_query_threshold" { type=number default=10 }
