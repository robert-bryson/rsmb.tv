# Private archive for untouched trip photographs and GPS exports. This bucket
# has no public policy or CloudFront origin; only processed derivatives belong
# in the public data bucket.
resource "aws_s3_bucket" "trip_sources" {
  bucket = "rsmbtv-trip-sources"
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "trip_sources" {
  bucket = aws_s3_bucket.trip_sources.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "trip_sources" {
  bucket = aws_s3_bucket.trip_sources.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "trip_sources" {
  bucket = aws_s3_bucket.trip_sources.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "trip_sources" {
  bucket = aws_s3_bucket.trip_sources.id

  rule {
    id     = "archive-trip-sources"
    status = "Enabled"

    filter {}

    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}