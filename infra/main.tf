# Terraform: Create an Amplify App connected to a GitHub repo
resource "aws_amplify_app" "rsmbtv" {
  name                     = "rsmbtv"
  platform                 = "WEB" # for static websites
  repository               = "https://github.com/robert-bryson/rsmb.tv"
  access_token             = var.github_token # GitHub personal access token for repo access
  enable_branch_auto_build = true             # enable auto CI/CD on pushes

  #   # (Optional) Custom build settings (build spec). If omitted, Amplify can use default builds.
  #   build_spec = <<-YAML
  #     version: 1
  #     frontend:
  #       phases:
  #         preBuild:
  #           commands:
  #             - npm ci       # install dependencies
  #         build:
  #           commands:
  #             - npm run build  # build the static site
  #       artifacts:
  #         baseDirectory: build    # directory to deploy (from build output)
  #         files:
  #           - '**/*'
  #       cache:
  #         paths:
  #           - node_modules/**/*  # cache dependencies to speed up builds
  #   YAML
  #
  #   # (Optional) Environment variables for the app (accessible during build)
  #   environment_variables = {
  #     NODE_ENV     = "production"
  #     API_BASE_URL = "https://api.example.com"
  #   }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.rsmbtv.id
  branch_name = "main"
  stage       = "PRODUCTION"
  # environment_variables can be set here if branch-specific overrides are needed
}

# # (Optional) Custom domain association, if you have a domain ready in Route 53
# resource "aws_amplify_domain_association" "domain" {
#   app_id      = aws_amplify_app.site.id
#   domain_name = "yourdomain.com" # e.g., example.com (should exist in Route 53 hosted zone)
#   sub_domain {
#     branch_name = aws_amplify_branch.main.branch_name # which branch to map to the domain
#     prefix      = ""                                  # prefix for the domain, "" indicates root domain. Use "www" for www.yourdomain.com etc.
#   }
# }
