resource "aws_route53_record" "mail_spf" {
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:_spf.google.com ~all"]
}

resource "aws_route53_record" "mail_dkim" {
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = "google._domainkey.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  # The provider adds outer quotes; split the TXT value at 255 bytes.
  records = [
    "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0jsiVQyl2p5iba7VtzUHvYgg72rsTBgNM932L4GokN8A45OqI55J43vPpOcP1LovQx3KvgzmT+lNHzlNM8jh4F70T6+bNHzu6J50OKkPgisRsaBotk8Yl/2mOx1CMWj/fkFKf7T7I+IwEI0OnfxFnfKFbjYgmfqOeInqM8DNRNjqJW6oUNT7d8IIbxuNWBPWy\"\"2JF6rLawvLcUkvpPSrtwJ6pC08/fQseJmPv9fE3UdWY+TJGeAOajQLOE+PzDarvSGoyV9ppweITtJJ5BzBKXYlDjeeWSplk8QCy7o485Y5RQW3Y7uSXLdx4JwPhGkHztIU/mw5GRO2aExHN70a92QIDAQAB"
  ]
}

resource "aws_route53_record" "mail_dmarc" {
  zone_id = data.aws_route53_zone.rsmbtv.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=none; rua=mailto:robby@${var.domain_name}"]
}
