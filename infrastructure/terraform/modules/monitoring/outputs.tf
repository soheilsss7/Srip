output "application_log_group" { value = aws_cloudwatch_log_group.application.name }
output "security_log_group" { value = aws_cloudwatch_log_group.security.name }
output "waf_log_group" { value = aws_cloudwatch_log_group.waf.name }
