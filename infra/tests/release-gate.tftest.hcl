mock_provider "aws" {}

variables {
  alert_email = "alerts@example.test"
}

run "production_requires_preview_gate" {
  command = apply
  plan_options {
    target = [aws_amplify_branch.main, aws_amplify_branch.release_preview, aws_iam_role.github_release, aws_iam_role_policy.github_release, aws_s3_bucket_cors_configuration.temperature_data]
  }
  assert {
    condition     = aws_amplify_branch.main.enable_auto_build == false && aws_amplify_branch.release_preview.enable_auto_build == false
    error_message = "Production and release-preview builds must be started by the validated release workflow."
  }
  assert {
    condition     = contains(tolist(aws_s3_bucket_cors_configuration.temperature_data.cors_rule)[0].allowed_origins, "https://release-preview.${aws_amplify_app.rsmbtv.default_domain}")
    error_message = "The deployed preview must be allowed to read the same data CDN as production."
  }
  assert {
    condition     = jsondecode(aws_iam_role_policy.github_release.policy).Statement[1].Action == ["s3:PutObject"] && jsondecode(aws_iam_role_policy.github_release.policy).Statement[1].Resource == "${aws_s3_bucket.temperature_data.arn}/release-validations/*"
    error_message = "The release role may write validation proofs only in the dedicated prefix."
  }
}
