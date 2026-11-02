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
      for collection in ["blog", "trips"] : [
        for suffix in ["", "/"] : anytrue([
          for index, rule in aws_amplify_app.rsmbtv.custom_rule :
          rule.source == "/${collection}/<slug>.html${suffix}" &&
          rule.target == "/${collection}/<slug>" && rule.status == "301" &&
          index < index([for candidate in aws_amplify_app.rsmbtv.custom_rule : candidate.source], "/${collection}/<slug>${suffix}")
        ])
      ]
    ]))
    error_message = "HTML article files must redirect to clean paths before a generic article rule can append another extension."
  }

  assert {
    condition = alltrue(flatten([
      for route in concat(
        [for route in keys(jsondecode(file("../src/content/sitePages.json"))) : route if route != "/"],
        keys(jsondecode(file("../src/content/siteAliases.json"))),
        ["/blog/<slug>", "/trips/<slug>"]
        ) : [for suffix in ["", "/"] : anytrue([
          for rule in slice(aws_amplify_app.rsmbtv.custom_rule, 0, length(aws_amplify_app.rsmbtv.custom_rule) - 1) :
          rule.source == "${route}${suffix}" && rule.target == "${route}.html" && rule.status == "200"
      ])]
    ]))
    error_message = "Public pages, aliases, and article collections must serve metadata for clean and trailing-slash paths before the SPA fallback."
  }

  assert {
    condition = (
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 1].target == "/index.html" &&
      aws_amplify_app.rsmbtv.custom_rule[length(aws_amplify_app.rsmbtv.custom_rule) - 1].status == "200" &&
      length(distinct([for rule in aws_amplify_app.rsmbtv.custom_rule : rule.source])) == length(aws_amplify_app.rsmbtv.custom_rule)
    )
    error_message = "The SPA fallback must stay last, and rewrite sources must be unique."
  }
}
