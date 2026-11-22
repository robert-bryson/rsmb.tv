mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }
  mock_data "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000"
    }
  }
}

variables {
  alert_email = "alerts@example.test"
}

run "github_sync_permissions" {
  command = apply

  plan_options {
    target = [aws_iam_role_policy.github_data_sync]
  }

  assert {
    condition = alltrue([
      for key, role in aws_iam_role.github_data_sync : (
        jsondecode(role.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" &&
        jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:robert-bryson/rsmb.tv:ref:refs/heads/main" &&
        jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
        role.max_session_duration == (key == "temperatures" ? 10800 : 3600)
      )
    ])
    error_message = "Workflow roles must trust only this repository's main branch and AWS audience, with bounded sessions matching archive repair and routine sync."
  }

  assert {
    condition = (
      jsondecode(aws_iam_role_policy.github_data_sync["tornadoes"].policy).Statement[1].Resource == ["${aws_s3_bucket.temperature_data.arn}/tornadoes/*"] &&
      contains(jsondecode(aws_iam_role_policy.github_data_sync["tornadoes"].policy).Statement[1].Action, "s3:DeleteObject") &&
      !contains(jsondecode(aws_iam_role_policy.github_data_sync["temperatures"].policy).Statement[1].Action, "s3:DeleteObject") &&
      !contains(jsondecode(aws_iam_role_policy.github_data_sync["temperatures"].policy).Statement[1].Resource, "${aws_s3_bucket.temperature_data.arn}/*")
    )
    error_message = "Each role must write only its project data. Only tornado sync needs deletion permission."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role_policy.github_data_sync["ski-status"].policy).Statement) == 2 &&
      toset(jsondecode(aws_iam_role_policy.github_data_sync["ski-status"].policy).Statement[0].Condition.StringLike["s3:prefix"]) == toset([
        "ski-status/manifest.json", "ski-status/manifest-*.json", "ski-status/reports-*.json", "ski-status/forecasts-*.json", "ski-status/history/*",
      ]) &&
      toset(jsondecode(aws_iam_role_policy.github_data_sync["ski-status"].policy).Statement[1].Resource) == toset([
        for key in ["manifest.json", "manifest-*.json", "reports-*.json", "forecasts-*.json", "history/*"] :
        "${aws_s3_bucket.temperature_data.arn}/ski-status/${key}"
      ]) &&
      jsondecode(aws_iam_role_policy.github_data_sync["ski-status"].policy).Statement[1].Action == ["s3:GetObject", "s3:PutObject"]
    )
    error_message = "Ski status must read and write only its snapshot prefix."
  }

  assert {
    condition = (
      length(jsondecode(aws_iam_role_policy.github_data_sync["ski-driving"].policy).Statement) == 2 &&
      toset(jsondecode(aws_iam_role_policy.github_data_sync["ski-driving"].policy).Statement[0].Condition.StringLike["s3:prefix"]) == toset([
        "ski-status/driving/manifest.json", "ski-status/driving/reports-*.json", "ski-status/driving/cameras-*.json",
      ]) &&
      toset(jsondecode(aws_iam_role_policy.github_data_sync["ski-driving"].policy).Statement[1].Resource) == toset([
        for key in ["manifest.json", "reports-*.json", "cameras-*.json"] :
        "${aws_s3_bucket.temperature_data.arn}/ski-status/driving/${key}"
      ]) &&
      jsondecode(aws_iam_role_policy.github_data_sync["ski-driving"].policy).Statement[1].Action == ["s3:GetObject", "s3:PutObject"]
    )
    error_message = "Ski driving must list, read, and write only its own snapshot prefix."
  }
}
