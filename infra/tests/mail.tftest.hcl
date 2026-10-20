mock_provider "aws" {}

variables {
  alert_email = "alerts@example.test"
}

run "mail_authentication" {
  command = plan

  plan_options {
    target = [
      aws_route53_record.mail_spf,
      aws_route53_record.mail_dkim,
      aws_route53_record.mail_dmarc,
    ]
  }

  assert {
    condition = alltrue([
      for record in [
        aws_route53_record.mail_spf,
        aws_route53_record.mail_dkim,
        aws_route53_record.mail_dmarc,
      ] : record.type == "TXT" && record.ttl == 300 && record.zone_id == data.aws_route53_zone.rsmbtv.zone_id
    ])
    error_message = "Mail authentication must use TXT records in the site zone with a 300-second TTL."
  }

  assert {
    condition = (
      aws_route53_record.mail_spf.name == var.domain_name &&
      aws_route53_record.mail_spf.records == toset(["v=spf1 include:_spf.google.com ~all"])
    )
    error_message = "SPF must authorize Google Workspace at the root domain."
  }

  assert {
    condition = (
      aws_route53_record.mail_dmarc.name == "_dmarc.${var.domain_name}" &&
      aws_route53_record.mail_dmarc.records == toset(["v=DMARC1; p=none; rua=mailto:robby@${var.domain_name}"])
    )
    error_message = "DMARC must retain monitoring mode and the domain report address."
  }

  assert {
    condition = (
      aws_route53_record.mail_dkim.name == "google._domainkey.${var.domain_name}" &&
      length(aws_route53_record.mail_dkim.records) == 1 &&
      startswith(one(aws_route53_record.mail_dkim.records), "v=DKIM1; k=rsa; p=") &&
      alltrue([
        for part in split("\"\"", one(aws_route53_record.mail_dkim.records)) : length(part) > 0 && length(part) <= 255
      ]) &&
      can(regex("^v=DKIM1; k=rsa; p=[A-Za-z0-9+/]{392}$", replace(one(aws_route53_record.mail_dkim.records), "\"\"", "")))
    )
    error_message = "Google DKIM must use one TXT record with a complete 2048-bit public key and strings of at most 255 bytes."
  }
}
