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
  value = "https://www.rsmb.tv"
}
