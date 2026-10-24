mock_provider "aws" {}

variables {
  alert_email = "alerts@example.test"
}

run "private_origins" {
  command = plan

  plan_options {
    target = [
      aws_s3_bucket_public_access_block.temperature_data,
      aws_s3_bucket_public_access_block.trip_sources,
      aws_cloudfront_origin_access_control.temperature_data,
    ]
  }

  assert {
    condition = alltrue([
      for block in [
        aws_s3_bucket_public_access_block.temperature_data,
        aws_s3_bucket_public_access_block.trip_sources,
      ] : block.block_public_acls && block.ignore_public_acls && block.block_public_policy && block.restrict_public_buckets
    ])
    error_message = "Both S3 buckets must block public policies and ACLs."
  }

  assert {
    condition = (
      aws_cloudfront_origin_access_control.temperature_data.signing_behavior == "always" &&
      aws_cloudfront_origin_access_control.temperature_data.signing_protocol == "sigv4"
    )
    error_message = "CloudFront must sign origin requests with SigV4."
  }
}
