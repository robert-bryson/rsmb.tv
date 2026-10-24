locals {
  github_oidc_host = "token.actions.githubusercontent.com"
  github_oidc_arn  = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${local.github_oidc_host}"
  github_sync_jobs = {
    temperatures = {
      objects  = ["stateRecords.json", "countyRecords.json", "climateTrends.json", "summary.json", "recentRecords.json", "stations.json", "daily/*", "cache/*"]
      prefixes = ["", "daily/", "daily/*", "cache/", "cache/*"]
      actions  = ["s3:GetObject", "s3:PutObject"]
    }
    tornadoes = {
      objects  = ["tornadoes/*"]
      prefixes = ["tornadoes/*"]
      actions  = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    }
  }
}

# Reuse the account's existing GitHub OIDC provider. Do not recreate or import it here.
resource "aws_iam_role" "github_data_sync" {
  for_each             = local.github_sync_jobs
  name                 = "rsmbtv-sync-${each.key}"
  max_session_duration = 3600
  tags                 = local.common_tags
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = local.github_oidc_arn }
      Condition = {
        StringEquals = {
          "${local.github_oidc_host}:aud" = "sts.amazonaws.com"
          "${local.github_oidc_host}:sub" = "repo:robert-bryson/rsmb.tv:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_data_sync" {
  for_each = local.github_sync_jobs
  name     = "sync-${each.key}"
  role     = aws_iam_role.github_data_sync[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListProjectData"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.temperature_data.arn]
        Condition = {
          StringLike = { "s3:prefix" = each.value.prefixes }
        }
      },
      {
        Sid      = "UpdateProjectData"
        Effect   = "Allow"
        Action   = each.value.actions
        Resource = [for key in each.value.objects : "${aws_s3_bucket.temperature_data.arn}/${key}"]
      },
      {
        Sid      = "InvalidateProjectCDN"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = [aws_cloudfront_distribution.temperature_data.arn]
      },
    ]
  })
}

output "github_data_sync_role_arns" {
  description = "Set the matching AWS_TEMPERATURE_SYNC_ROLE_ARN and AWS_TORNADO_SYNC_ROLE_ARN repository variables after deployment."
  value       = { for job, role in aws_iam_role.github_data_sync : job => role.arn }
}
