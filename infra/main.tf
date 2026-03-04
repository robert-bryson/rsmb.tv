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

  # Redirect apex to www
  custom_rule {
    source = "https://rsmb.tv"
    target = "https://www.rsmb.tv"
    status = "302"
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

# Custom domain: rsmb.tv
resource "aws_amplify_domain_association" "rsmbtv" {
  app_id      = aws_amplify_app.rsmbtv.id
  domain_name = "rsmb.tv"

  # Apex domain → main branch
  sub_domain_setting {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = ""
  }

  # www.rsmb.tv → main branch
  sub_domain_setting {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = "www"
  }

  # dev.rsmb.tv → dev branch
  sub_domain_setting {
    branch_name = aws_amplify_branch.dev.branch_name
    prefix      = "dev"
  }
}
