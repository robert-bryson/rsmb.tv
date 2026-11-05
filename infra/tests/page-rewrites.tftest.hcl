mock_provider "aws" {}

variables {
  alert_email = "alerts@example.test"
}

run "page_metadata_rewrites" {
  command = plan

  plan_options {
    target = [aws_amplify_app.rsmbtv]
  }

  assert {
    condition = alltrue(flatten([
      for route in concat(
        [for route in keys(jsondecode(file("../src/content/sitePages.json"))) : route if route != "/"],
        keys(jsondecode(file("../src/content/siteAliases.json")))
        ) : [for suffix in ["", "/"] : anytrue([
          for rule in slice(aws_amplify_app.rsmbtv.custom_rule, 0, length(aws_amplify_app.rsmbtv.custom_rule) - 1) :
          rule.source == "${route}${suffix}" && rule.target == "${route}.html" && rule.status == "200"
      ])]
    ]))
    error_message = "Public pages and aliases must serve metadata for clean and trailing-slash paths before the SPA fallback."
  }

  assert {
    condition = alltrue([
      for collection in ["blog", "trips"] : anytrue([
        for rule in slice(aws_amplify_app.rsmbtv.custom_rule, 0, length(aws_amplify_app.rsmbtv.custom_rule) - 2) :
        rule.source == "/${collection}/<*>" && rule.target == rule.source && rule.status == "200"
      ])
    ])
    error_message = "Article collections must preserve the full request path for native HTML-file and directory-index lookup before the SPA fallback."
  }

  assert {
    condition = (
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 1].source == "/<*>" &&
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 1].target == "/index.html" &&
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 1].status == "404-200"
    )
    error_message = "Missing files must reach the app through a 404 rewrite, not a redirect that replaces the requested URL."
  }

  assert {
    condition = (
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 2].target == "/index.html" &&
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 2].status == "200" &&
      length(distinct([for rule in aws_amplify_app.rsmbtv.custom_rule : rule.source])) == length(aws_amplify_app.rsmbtv.custom_rule)
    )
    error_message = "The SPA rewrite must precede the final error handler, and rewrite sources must be unique."
  }
}
