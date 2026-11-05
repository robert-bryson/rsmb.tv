# Terraform: AWS Amplify App for rsmb.tv
resource "aws_amplify_app" "rsmbtv" {
  name                     = "rsmbtv"
  platform                 = "WEB"
  repository               = "https://github.com/robert-bryson/rsmb.tv"
  access_token             = var.github_token
  enable_branch_auto_build = true

  environment_variables = {}

  tags = local.common_tags

  # Keep secrets, build settings, and repository-managed headers configured in AWS.
  # Remove the relevant entry temporarily to manage one with Terraform.
  lifecycle {
    ignore_changes = [access_token, environment_variables, custom_headers]
  }

  # Serve each public page's metadata before JavaScript, ahead of the SPA fallback.
  dynamic "custom_rule" {
    for_each = flatten([for route in sort(concat(
      [for route in keys(jsondecode(file("${path.module}/../src/content/sitePages.json"))) : route if route != "/"],
      keys(jsondecode(file("${path.module}/../src/content/siteAliases.json")))
    )) : [route, "${route}/"]])
    content {
      source = custom_rule.value
      target = "${trimsuffix(custom_rule.value, "/")}.html"
      status = "200"
    }
  }

  # Protect HTML file paths from receiving a second extension in article rewrites.
  dynamic "custom_rule" {
    for_each = flatten([for collection in ["blog", "trips"] : [
      for suffix in ["", "/"] : {
        source = "/${collection}/<slug>.html${suffix}"
        target = "/${collection}/<slug>"
      }
    ]])
    content {
      source = custom_rule.value.source
      target = custom_rule.value.target
      status = "301"
    }
  }

  # Article aliases retain the same canonical metadata as the current collection.
  dynamic "custom_rule" {
    for_each = ["/blog/<slug>", "/blog/<slug>/", "/trips/<slug>", "/trips/<slug>/"]
    content {
      source = custom_rule.value
      target = "${trimsuffix(custom_rule.value, "/")}/"
      status = "200"
    }
  }

  # SPA rewrite: serve index.html for all routes that don't match a static file
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|html|gif|ico|jpg|js|mjs|mp4|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|webp|xml|gz|br|geojson|glb)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  # Render the app for missing files instead of repeating clean-URL redirects.
  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404"
  }

  custom_headers = jsonencode(yamldecode(file("${path.module}/../customHttp.yml")).customHeaders)
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

# Custom domain (www + dev only; apex redirect handled by CloudFront)
resource "aws_amplify_domain_association" "rsmbtv" {
  app_id      = aws_amplify_app.rsmbtv.id
  domain_name = var.domain_name

  certificate_settings {
    type = "AMPLIFY_MANAGED"
  }

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
  comment = "Redirect ${var.domain_name} to ${local.www_domain}"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var qs = request.querystring;
      var queryString = '';
      var keys = Object.keys(qs);
      if (keys.length > 0) {
        queryString = '?' + keys.map(function(k) {
          var values = qs[k].multiValue || [{ value: qs[k].value }];
          return values.map(function(item) {
            return k + '=' + item.value;
          }).join('&');
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

data "aws_route53_zone" "rsmbtv" {
  name = "${var.domain_name}."
}

data "aws_acm_certificate" "rsmbtv" {
  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
  key_types   = ["RSA_2048"]
}

resource "aws_cloudfront_distribution" "apex_redirect" {
  comment             = "Redirect ${var.domain_name} apex to ${local.www_domain}"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  aliases             = [var.domain_name]
  wait_for_deployment = false
  tags                = local.common_tags

  origin {
    domain_name = local.www_domain
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
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.apex_redirect.domain_name
    zone_id                = aws_cloudfront_distribution.apex_redirect.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.apex_redirect.domain_name
    zone_id                = aws_cloudfront_distribution.apex_redirect.hosted_zone_id
    evaluate_target_health = false
  }
}
