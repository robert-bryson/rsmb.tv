# Terraform: AWS Amplify App for rsmb.tv
resource "aws_amplify_app" "rsmbtv" {
  name                     = "rsmbtv"
  platform                 = "WEB"
  repository               = "https://github.com/robert-bryson/rsmb.tv"
  access_token             = var.github_token
  enable_branch_auto_build = true

  # SPA rewrite: serve index.html for all routes that don't match a static file
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|xml|gz|br|geojson|glb)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  # Cache headers for hashed static assets (immutable)
  custom_headers = <<-HEADERS
    customHeaders:
      - pattern: '/assets/**'
        headers:
          - key: 'Cache-Control'
            value: 'public, max-age=31536000, immutable'
      - pattern: '*.js'
        headers:
          - key: 'Cache-Control'
            value: 'public, max-age=31536000, immutable'
      - pattern: '*.css'
        headers:
          - key: 'Cache-Control'
            value: 'public, max-age=31536000, immutable'
      - pattern: '/basemaps/**'
        headers:
          - key: 'Cache-Control'
            value: 'public, max-age=604800'
      - pattern: '/data/**'
        headers:
          - key: 'Cache-Control'
            value: 'public, max-age=3600'
      - pattern: '**'
        headers:
          - key: 'X-Content-Type-Options'
            value: 'nosniff'
          - key: 'X-Frame-Options'
            value: 'DENY'
          - key: 'Referrer-Policy'
            value: 'strict-origin-when-cross-origin'
          - key: 'Strict-Transport-Security'
            value: 'max-age=63072000; includeSubDomains; preload'
          - key: 'Permissions-Policy'
            value: 'camera=(), microphone=(), geolocation=()'
          - key: 'Content-Security-Policy'
            value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.cartocdn.com; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  HEADERS
}

# Production branch
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.rsmbtv.id
  branch_name = "main"
  stage       = "PRODUCTION"
}

# Dev branch
resource "aws_amplify_branch" "dev" {
  app_id      = aws_amplify_app.rsmbtv.id
  branch_name = "dev"
  stage       = "DEVELOPMENT"
}

# Custom domain: rsmb.tv (www + dev only; apex redirect handled by CloudFront)
resource "aws_amplify_domain_association" "rsmbtv" {
  app_id      = aws_amplify_app.rsmbtv.id
  domain_name = "rsmb.tv"

  # www.rsmb.tv → main branch
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = "www"
  }

  # dev.rsmb.tv → dev branch
  sub_domain {
    branch_name = aws_amplify_branch.dev.branch_name
    prefix      = "dev"
  }
}

# --- Apex redirect: rsmb.tv → www.rsmb.tv (301) ---
# Amplify can't do host-level redirects when both are associated,
# so we use a dedicated CloudFront distribution + CloudFront Function.

resource "aws_cloudfront_function" "apex_redirect" {
  name    = "rsmbtv-apex-redirect"
  runtime = "cloudfront-js-2.0"
  comment = "Redirect rsmb.tv to www.rsmb.tv"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var qs = request.querystring;
      var queryString = '';
      var keys = Object.keys(qs);
      if (keys.length > 0) {
        queryString = '?' + keys.map(function(k) {
          return k + '=' + qs[k].value;
        }).join('&');
      }
      return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
          location: { value: 'https://www.rsmb.tv' + request.uri + queryString },
          'cache-control': { value: 'max-age=86400' }
        }
      };
    }
  JS
}

data "aws_acm_certificate" "rsmbtv" {
  domain      = "rsmb.tv"
  statuses    = ["ISSUED"]
  most_recent = true
}

resource "aws_cloudfront_distribution" "apex_redirect" {
  comment             = "Redirect rsmb.tv apex to www.rsmb.tv"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  aliases             = ["rsmb.tv"]
  wait_for_deployment = false

  origin {
    domain_name = "www.rsmb.tv"
    origin_id   = "dummy-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "dummy-origin"
    viewer_protocol_policy = "redirect-to-https"
    cached_methods         = ["GET", "HEAD"]
    allowed_methods        = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.apex_redirect.arn
    }
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

resource "aws_route53_record" "apex" {
  zone_id = "Z01438012QVABV96CTNJJ"
  name    = "rsmb.tv"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.apex_redirect.domain_name
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront hosted zone ID (global constant)
    evaluate_target_health = false
  }
}
