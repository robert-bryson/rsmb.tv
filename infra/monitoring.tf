# ─── Monitoring & Alerting ────────────────────────────────────────────────────
# Lightweight monitoring for a personal site:
#   • Budget alerts (free)
#   • Cost anomaly detection (free)
#   • CloudFront error rate alarm
#   • Route 53 uptime health check ($0.50/mo)

# ─── SNS: Central alert channel ──────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "rsmbtv-alerts"
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ─── Budget: Monthly spend alerts ────────────────────────────────────────────

resource "aws_budgets_budget" "monthly" {
  name         = "rsmbtv-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 150
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }
}

# ─── Cost Anomaly Detection ──────────────────────────────────────────────────
# ML-based detection of unexpected cost spikes across the entire account.

resource "aws_ce_anomaly_monitor" "account" {
  name              = "Default-Services-Monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "alerts" {
  name = "rsmbtv-anomaly-alerts"

  monitor_arn_list = [aws_ce_anomaly_monitor.account.arn]

  frequency = "IMMEDIATE"

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = ["5"]
    }
  }

  subscriber {
    type    = "SNS"
    address = aws_sns_topic.alerts.arn
  }
}

# ─── CloudFront: 5xx Error Rate Alarm ────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  alarm_name          = "rsmbtv-cloudfront-5xx-rate"
  alarm_description   = "CloudFront apex-redirect 5xx error rate > 5%"
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.apex_redirect.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# ─── Route 53: Uptime Health Check ───────────────────────────────────────────

resource "aws_route53_health_check" "website" {
  fqdn              = local.www_domain
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true

  tags = merge(local.common_tags, {
    Name = "rsmbtv-website-health"
  })
}

resource "aws_cloudwatch_metric_alarm" "website_health" {
  alarm_name          = "rsmbtv-website-down"
  alarm_description   = "www.rsmb.tv is unreachable"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.website.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  # Route 53 health check metrics are only in us-east-1
  provider = aws

  tags = local.common_tags
}

# ─── SNS Topic Policy: Allow Budgets & Cost Anomaly to publish ───────────────

data "aws_iam_policy_document" "sns_alerts_policy" {
  statement {
    sid    = "AllowBudgetsPublish"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  statement {
    sid    = "AllowCostAnomalyPublish"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["costalerts.amazonaws.com"]
    }
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.sns_alerts_policy.json
}
