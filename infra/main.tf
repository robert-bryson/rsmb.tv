# Terraform: Create an Amplify App connected to a GitHub repo
resource "aws_amplify_app" "rsmbtv" {
  name                     = "rsmbtv"
  platform                 = "WEB" # for static websites
  repository               = "https://github.com/robert-bryson/rsmb.tv"
  access_token             = var.github_token # GitHub personal access token for repo access
  enable_branch_auto_build = true             # enable auto CI/CD on pushes

  # SPA rewrite: serve index.html for all routes that don't match a file
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|xml|gz|br|geojson|glb)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
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
