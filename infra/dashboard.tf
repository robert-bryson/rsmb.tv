# ─── CloudWatch Dashboard ────────────────────────────────────────────────────
# Single dashboard covering the Amplify app (all branches/subdomains),
# CloudFront apex redirect, Route 53 health checks, and billing.
# Free tier: first 3 dashboards, up to 50 metrics each.

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "rsmbtv"

  dashboard_body = jsonencode({
    widgets = [

      # ── Row 1: Amplify Traffic ─────────────────────────────────────────

      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "## Amplify — All Branches (www, dev, …)"
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Requests"
          region = "us-east-1"
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/AmplifyHosting", "Requests", "App", aws_amplify_app.rsmbtv.id]
          ]
        }
      },

      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Bandwidth (bytes)"
          region = "us-east-1"
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/AmplifyHosting", "BytesDownloaded", "App", aws_amplify_app.rsmbtv.id, { label = "Downloaded" }],
            [".", "BytesUploaded", ".", ".", { label = "Uploaded" }]
          ]
        }
      },

      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Latency (ms)"
          region = "us-east-1"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/AmplifyHosting", "Latency", "App", aws_amplify_app.rsmbtv.id, { stat = "Average", label = "Avg" }],
            ["...", { stat = "p99", label = "p99" }],
            ["...", { stat = "Maximum", label = "Max" }]
          ]
        }
      },

      # ── Row 2: Amplify Errors ──────────────────────────────────────────

      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "Error Count"
          region = "us-east-1"
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/AmplifyHosting", "4xxErrors", "App", aws_amplify_app.rsmbtv.id, { label = "4xx", color = "#ff9900" }],
            [".", "5xxErrors", ".", ".", { label = "5xx", color = "#d13212" }]
          ]
        }
      },

      {
        type   = "metric"
        x      = 12
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "Error Rate (%)"
          region = "us-east-1"
          period = 300
          view   = "timeSeries"
          metrics = [
            [{ expression = "100 * m4xx / m_req", label = "4xx %", id = "e4xx", color = "#ff9900" }],
            [{ expression = "100 * m5xx / m_req", label = "5xx %", id = "e5xx", color = "#d13212" }],
            ["AWS/AmplifyHosting", "4xxErrors", "App", aws_amplify_app.rsmbtv.id, { id = "m4xx", visible = false }],
            [".", "5xxErrors", ".", ".", { id = "m5xx", visible = false }],
            [".", "Requests", ".", ".", { id = "m_req", visible = false }]
          ]
          stat = "Sum"
        }
      },

      # ── Row 3: CloudFront Apex Redirect ────────────────────────────────

      {
        type   = "text"
        x      = 0
        y      = 13
        width  = 24
        height = 1
        properties = {
          markdown = "## CloudFront — Apex Redirect (rsmb.tv → www)"
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 14
        width  = 8
        height = 6
        properties = {
          title  = "Redirect Requests"
          region = "us-east-1"
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.apex_redirect.id, "Region", "Global"]
          ]
        }
      },

      {
        type   = "metric"
        x      = 8
        y      = 14
        width  = 8
        height = 6
        properties = {
          title  = "Error Rates (%)"
          region = "us-east-1"
          stat   = "Average"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", aws_cloudfront_distribution.apex_redirect.id, "Region", "Global", { label = "4xx %", color = "#ff9900" }],
            [".", "5xxErrorRate", ".", ".", ".", ".", { label = "5xx %", color = "#d13212" }],
            [".", "TotalErrorRate", ".", ".", ".", ".", { label = "Total %", color = "#7b7b7b" }]
          ]
        }
      },

      {
        type   = "metric"
        x      = 16
        y      = 14
        width  = 8
        height = 6
        properties = {
          title  = "Function Invocations"
          region = "us-east-1"
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/CloudFront", "FunctionInvocations", "DistributionId", aws_cloudfront_distribution.apex_redirect.id, "Region", "Global"],
            [".", "FunctionComputeUtilization", ".", ".", ".", ".", { stat = "Average", yAxis = "right", label = "Compute %" }]
          ]
        }
      },

      # ── Row 4: Health & Billing ────────────────────────────────────────

      {
        type   = "text"
        x      = 0
        y      = 20
        width  = 24
        height = 1
        properties = {
          markdown = "## Health & Cost"
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 21
        width  = 8
        height = 6
        properties = {
          title  = "Website Health (1 = healthy)"
          region = "us-east-1"
          stat   = "Minimum"
          period = 60
          view   = "timeSeries"
          metrics = [
            ["AWS/Route53", "HealthCheckStatus", "HealthCheckId", aws_route53_health_check.website.id]
          ]
          yAxis = {
            left = { min = 0, max = 1 }
          }
        }
      },

      {
        type   = "metric"
        x      = 8
        y      = 21
        width  = 8
        height = 6
        properties = {
          title  = "Health Check Latency (ms)"
          region = "us-east-1"
          period = 60
          view   = "timeSeries"
          metrics = [
            ["AWS/Route53", "ConnectionTime", "HealthCheckId", aws_route53_health_check.website.id, { stat = "Average", label = "Avg" }],
            ["...", { stat = "Maximum", label = "Max" }],
            ["AWS/Route53", "SSLHandshakeTime", "HealthCheckId", aws_route53_health_check.website.id, { stat = "Average", label = "SSL Avg" }],
            ["AWS/Route53", "TimeToFirstByte", "HealthCheckId", aws_route53_health_check.website.id, { stat = "Average", label = "TTFB Avg" }]
          ]
        }
      },

      {
        type   = "metric"
        x      = 16
        y      = 21
        width  = 8
        height = 6
        properties = {
          title  = "Estimated Charges ($)"
          region = "us-east-1"
          stat   = "Maximum"
          period = 21600
          view   = "singleValue"
          metrics = [
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"]
          ]
        }
      },

      # ── Row 5: Alarm status ────────────────────────────────────────────

      {
        type   = "alarm"
        x      = 0
        y      = 27
        width  = 24
        height = 3
        properties = {
          title  = "Alarm Status"
          alarms = [
            aws_cloudwatch_metric_alarm.cloudfront_5xx.arn,
            aws_cloudwatch_metric_alarm.website_health.arn
          ]
        }
      }
    ]
  })
}
