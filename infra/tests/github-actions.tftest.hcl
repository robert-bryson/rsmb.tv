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
      for role in aws_iam_role.github_data_sync : (
        jsondecode(role.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" &&
        jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:robert-bryson/rsmb.tv:ref:refs/heads/main" &&
        jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
        role.max_session_duration == 3600
      )
    ])
    error_message = "Workflow roles must trust only this repository's main branch, the AWS audience, and one-hour sessions."
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
}
