# S3 bucket for temperature observation data
# Stores generated temperature record JSON, daily observation archives,
# station index, and ACIS response cache entries that are too large or too
# frequently updated to commit to the repo.
#
# Structure:
#   recentRecords.json      — recent broken-record summary for the map
#   stateRecords.json       — all-time state records
#   countyRecords.json      — all-time county records
#   climateTrends.json      — derived county-record trend summary
#   summary.json            — metadata for generated record files
#   daily/YYYY/MM/YYYY-MM-DD.json  — all CONUS station observations for that date
#   stations.json           — station catalog
#   cache/...               — ACIS response cache used by sync jobs

resource "aws_s3_bucket" "temperature_data" {
  bucket = "rsmbtv-temperature-data"
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "temperature_data" {
  bucket = aws_s3_bucket.temperature_data.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false # Allow bucket policy for CloudFront OAC
  restrict_public_buckets = false
}

resource "aws_s3_bucket_lifecycle_configuration" "temperature_data" {
  bucket = aws_s3_bucket.temperature_data.id

  rule {
    id     = "transition-old-daily"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    # Move daily files older than 90 days to Infrequent Access
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }

  rule {
    id     = "expire-old-acis-cache"
    status = "Enabled"

    filter {
      prefix = "cache/"
    }

    expiration {
      days = 365
    }
  }
}

# CORS for browser-side access (station lookup, etc.)
resource "aws_s3_bucket_cors_configuration" "temperature_data" {
  bucket = aws_s3_bucket.temperature_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = [
      "https://www.rsmb.tv",
      "https://dev.rsmb.tv",
      "http://localhost:*",
      "http://127.0.0.1:*",
    ]
    expose_headers  = ["ETag", "Content-Length"]
    max_age_seconds = 3600
  }
}

# CloudFront distribution for serving temperature data
resource "aws_cloudfront_origin_access_control" "temperature_data" {
  name                              = "rsmbtv-temperature-data"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "temperature_data" {
  comment             = "Temperature observation data CDN"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  default_root_object = "stations.json"
  aliases             = ["data.rsmb.tv"]
  wait_for_deployment = false
  tags                = local.common_tags

  origin {
    domain_name              = aws_s3_bucket.temperature_data.bucket_regional_domain_name
    origin_id                = "s3-temperature-data"
    origin_access_control_id = aws_cloudfront_origin_access_control.temperature_data.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-temperature-data"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600   # 1 hour
    max_ttl     = 86400  # 1 day
  }

  # Daily files are immutable — cache aggressively
  ordered_cache_behavior {
    path_pattern           = "daily/*"
    target_origin_id       = "s3-temperature-data"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 86400
    default_ttl = 604800   # 7 days
    max_ttl     = 31536000 # 1 year
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.rsmbtv.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# S3 bucket policy — allow CloudFront OAC to read objects
resource "aws_s3_bucket_policy" "temperature_data" {
  bucket = aws_s3_bucket.temperature_data.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.temperature_data.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.temperature_data.arn
          }
        }
      }
    ]
  })
}

# DNS record for data.rsmb.tv → CloudFront
resource "aws_route53_record" "data_cname" {
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = "data.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.temperature_data.domain_name
    zone_id                = aws_cloudfront_distribution.temperature_data.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "data_aaaa" {
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = "data.${var.domain_name}"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.temperature_data.domain_name
    zone_id                = aws_cloudfront_distribution.temperature_data.hosted_zone_id
    evaluate_target_health = false
  }
}

# --- IAM for GitHub Actions S3 upload ---

resource "aws_iam_user" "github_actions_temperatures" {
  name = "rsmbtv-github-actions-temperatures"
  tags = local.common_tags
}

resource "aws_iam_user_policy" "github_actions_temperatures" {
  name = "s3-temperature-upload"
  user = aws_iam_user.github_actions_temperatures.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "UploadTemperatureData"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.temperature_data.arn,
          "${aws_s3_bucket.temperature_data.arn}/*",
        ]
      },
      {
        Sid    = "InvalidateCache"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
        ]
        Resource = [
          aws_cloudfront_distribution.temperature_data.arn,
        ]
      }
    ]
  })
}
