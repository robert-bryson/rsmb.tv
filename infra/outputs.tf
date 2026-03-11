data "aws_caller_identity" "current" {}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "amplify_app_id" {
  value = aws_amplify_app.rsmbtv.id
}

output "amplify_default_domain" {
  value = aws_amplify_app.rsmbtv.default_domain
}

output "amplify_production_url" {
  value = "https://${local.www_domain}"
}

output "sns_alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "health_check_id" {
  value = aws_route53_health_check.website.id
}

output "dashboard_url" {
  value = "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards/dashboard/rsmbtv"
}
